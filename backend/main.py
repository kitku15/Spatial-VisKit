from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
import zarr
import pandas as pd
import numpy as np
import os

# --- Configuration ---
MODULE_10_DIR = os.getenv("MODULE_10_DIR", "/data")
AUX_DATA_PATH = os.path.join(MODULE_10_DIR, "aux_data")

# FIX 1: Explicitly ignore the TF Zarr so we connect to the MAIN Zarr!
ZARR_PATH = None
if os.path.exists(MODULE_10_DIR):
    for f in os.listdir(MODULE_10_DIR):
        if f.endswith("_web.zarr") and "_tf_" not in f:
            ZARR_PATH = os.path.join(MODULE_10_DIR, f)
            break

# --- Globals for Zarr Data ---
ZARR_STORE = None
OBS_DF = None
VAR_DF = None

# Smart column detectors
SLIDE_COL = None
SAMPLE_COL = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global ZARR_STORE, OBS_DF, VAR_DF, SLIDE_COL, SAMPLE_COL
    if not ZARR_PATH or not os.path.exists(ZARR_PATH):
        print(f"WARNING: Zarr path not found in {MODULE_10_DIR}!")
    else:
        print(f"Connecting to MAIN Zarr store at {ZARR_PATH}...")
        try:
            ZARR_STORE = zarr.open(ZARR_PATH, mode='r')
            obs_group = ZARR_STORE['obs']
            
            obs_dict = {}
            for col in obs_group.keys():
                if col.startswith('_'): 
                    continue
                
                try:
                    item = obs_group[col]
                    if isinstance(item, zarr.Array):
                        obs_dict[col] = item[:]
                    elif isinstance(item, zarr.Group):
                        # FIX 2: Safely parse Categoricals (like your Final_Annotation)
                        if 'codes' in item and 'categories' in item:
                            codes = item['codes'][:]
                            cats = [c.decode('utf-8') if isinstance(c, bytes) else str(c) for c in item['categories'][:]]
                            obs_dict[col] = [cats[c] if c >= 0 else "Unknown" for c in codes]
                except Exception as col_err:
                    print(f"WARNING: Failed to parse column '{col}': {col_err}")

            OBS_DF = pd.DataFrame(obs_dict)
            
            var_group = ZARR_STORE['var']
            index_name = var_group.attrs.get('_index', '_index')
            VAR_DF = pd.DataFrame(index=var_group[index_name][:])
            
            # --- SMART COLUMN DETECTION ---
            for c in OBS_DF.columns:
                if c.lower() in ['slide_id', 'batch', 'slide id']: SLIDE_COL = c
                if c.lower() in ['sample_id', 'sample', 'sample id']: SAMPLE_COL = c
                
            print(f"Loaded {len(OBS_DF)} cells and {len(VAR_DF)} genes.")
            print(f"Detected Slide Col: {SLIDE_COL} | Sample Col: {SAMPLE_COL}")
            
        except Exception as e:
            print(f"FATAL ERROR ON STARTUP: {e}")
            import traceback
            traceback.print_exc()
            
    yield  

app = FastAPI(title="Spatial Transcriptomics API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

if os.path.exists(MODULE_10_DIR):
    app.mount("/data", StaticFiles(directory=MODULE_10_DIR), name="data")

@app.get("/api/metadata")
def get_metadata():
    if OBS_DF is None: raise HTTPException(status_code=500, detail="Data not loaded.")
    
    # Dynamically build the Slide -> Sample hierarchy using the smart columns
    hierarchy = {}
    if SLIDE_COL and SAMPLE_COL:
        for slide in OBS_DF[SLIDE_COL].dropna().unique():
            samples = OBS_DF[OBS_DF[SLIDE_COL] == slide][SAMPLE_COL].dropna().unique().tolist()
            hierarchy[str(slide)] = [str(s) for s in samples]
    elif SLIDE_COL:
        for slide in OBS_DF[SLIDE_COL].dropna().unique():
            hierarchy[str(slide)] = ["All"]
    else:
        hierarchy = {"All": ["All"]}

    return {
        "n_cells": len(OBS_DF),
        "n_genes": len(VAR_DF),
        "obs_columns": list(OBS_DF.columns),
        "hierarchy": hierarchy
    }

@app.get("/api/genes")
def get_genes():
    if VAR_DF is None: raise HTTPException(status_code=500, detail="Data not loaded.")
    return [{"original": str(g), "safe": str(g)} for g in VAR_DF.index]

@app.get("/api/expression/{gene_name:path}")
def get_expression(gene_name: str):
    try:
        if ZARR_STORE is None: raise HTTPException(status_code=500, detail="Data not loaded.")
        if gene_name not in VAR_DF.index: raise HTTPException(status_code=404, detail="Gene not found.")
            
        gene_idx = VAR_DF.index.get_loc(gene_name)
        if isinstance(gene_idx, slice): gene_idx = gene_idx.start
        elif isinstance(gene_idx, np.ndarray): gene_idx = np.where(gene_idx)[0][0]
        else: gene_idx = int(gene_idx)

        X_group = ZARR_STORE['X']
        
        if isinstance(X_group, zarr.hierarchy.Group) and 'data' in X_group:
            encoding = X_group.attrs.get('encoding-type', '')
            if 'csc' in encoding:
                indptr = X_group['indptr']
                indices = X_group['indices']
                data = X_group['data']
                
                start, end = int(indptr[gene_idx]), int(indptr[gene_idx + 1])
                if start == end: return {gene_name: {"i": [], "v": []}}
                
                return {gene_name: {
                    "i": indices[start:end].tolist(), 
                    "v": [round(float(v), 3) for v in data[start:end]]
                }}
            else:
                import scipy.sparse as sp
                sparse_mat = sp.csr_matrix((X_group['data'][:], X_group['indices'][:], X_group['indptr'][:]), shape=(len(OBS_DF), len(VAR_DF)))
                col_data = sparse_mat[:, gene_idx].toarray().flatten()
                non_zero = np.nonzero(col_data)[0]
                values = col_data[non_zero]
                return {gene_name: {
                    "i": non_zero.tolist(), 
                    "v": [round(float(v), 3) for v in values]
                }}

        elif isinstance(X_group, zarr.core.Array):
            col_data = X_group[:, gene_idx]
            non_zero = np.nonzero(col_data)[0]
            values = col_data[non_zero]
            return {gene_name: {
                "i": non_zero.tolist(), 
                "v": [round(float(v), 3) for v in values]
            }}
            
        else:
            raise HTTPException(status_code=500, detail=f"Unknown Zarr X format: {type(X_group)}")

    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/obs")
def get_obs():
    if OBS_DF is None: raise HTTPException(status_code=500, detail="Data not loaded.")
    
    # SMART FILTER: Get all columns that are categories or strings, with < 100 unique values
    # Ignore boring columns like cell_ID, fov, etc.
    ignore_cols = ['cell_id', 'cell_id_string', 'cellsegmentationsetid', 'assay_type', 'width', 'centroid_x', 'centroid_y']
    cat_cols = []
    
    for c in OBS_DF.columns:
        if c.lower() in ignore_cols: continue
        if OBS_DF[c].dtype == 'category' or OBS_DF[c].dtype == 'object':
            if OBS_DF[c].nunique() < 100:  # Ensures we don't send raw barcodes
                cat_cols.append(c)

    return {c: OBS_DF[c].fillna("Unknown").astype(str).tolist() for c in cat_cols}

@app.get("/api/locations")
def get_locations():
    if ZARR_STORE is None: raise HTTPException(status_code=500, detail="Data not loaded.")
    spatial_key = "global" if "global" in ZARR_STORE['obsm'] else "spatial"
    coords = ZARR_STORE['obsm'][spatial_key][:]
    return {
        "id": OBS_DF.index.tolist(),
        "x": np.round(coords[:, 0], 2).tolist(),
        "y": np.round(coords[:, 1], 2).tolist(),
        "slide": OBS_DF[SLIDE_COL].tolist() if SLIDE_COL else ["All"] * len(OBS_DF),
        "sample": OBS_DF[SAMPLE_COL].tolist() if SAMPLE_COL else ["All"] * len(OBS_DF),
    }

@app.get("/api/composition")
def get_composition():
    if OBS_DF is None: raise HTTPException(status_code=500, detail="Data not loaded.")
    
    ignore_cols = ['cell_id', 'cell_id_string', 'cellsegmentationsetid', 'assay_type', 'width', 'centroid_x', 'centroid_y']
    cat_cols = [c for c in OBS_DF.columns if (OBS_DF[c].dtype == 'category' or OBS_DF[c].dtype == 'object') and OBS_DF[c].nunique() < 100 and c.lower() not in ignore_cols]
    
    composition = {}
    
    def get_counts(df):
        res = {}
        for col in cat_cols:
            if col in df.columns:
                counts = df[col].value_counts().to_dict()
                res[col] = {str(k): int(v) for k, v in counts.items()}
        return res

    composition["All_All"] = get_counts(OBS_DF)

    if SLIDE_COL:
        for slide in OBS_DF[SLIDE_COL].dropna().unique():
            slide_mask = OBS_DF[SLIDE_COL] == slide
            composition[f"{slide}_All"] = get_counts(OBS_DF[slide_mask])

            if SAMPLE_COL:
                samples = OBS_DF[slide_mask][SAMPLE_COL].dropna().unique()
                for sample in samples:
                    composition[f"{slide}_{sample}"] = get_counts(OBS_DF[(OBS_DF[SLIDE_COL]==slide) & (OBS_DF[SAMPLE_COL]==sample)])
                    
    return composition

@app.get("/api/sankey")
def get_sankey(col_a: str, col_b: str):
    if OBS_DF is None: raise HTTPException(status_code=500, detail="Data not loaded.")
    if col_a not in OBS_DF.columns or col_b not in OBS_DF.columns:
        raise HTTPException(status_code=400, detail=f"Columns {col_a} or {col_b} not found.")
        
    df = OBS_DF[[col_a, col_b]].dropna().copy()
    df["source_node"] = col_a + "_" + df[col_a].astype(str)
    df["target_node"] = col_b + "_" + df[col_b].astype(str)
    
    flows = df.groupby(["source_node", "target_node"]).size().reset_index(name="value")
    flows = flows[flows["value"] > 0]
    
    unique_nodes = list(pd.unique(flows[["source_node", "target_node"]].values.ravel("K")))
    node_map = {name: i for i, name in enumerate(unique_nodes)}
    
    nodes = [{"name": name} for name in unique_nodes]
    links = [{"source": node_map[row["source_node"]], "target": node_map[row["target_node"]], "value": int(row["value"])} for _, row in flows.iterrows()]
    
    return {"nodes": nodes, "links": links}