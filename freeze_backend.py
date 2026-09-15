import os
import json
import zarr
import pandas as pd
import numpy as np
import scipy.sparse as sp
import itertools
import re

# --- CONFIGURATION ---
# Change this to match the folder inside your /public directory
DATASET_FOLDER = "public/data_tyler" 
# ---------------------

def main():
    print(f"Freezing backend for {DATASET_FOLDER}...")
    
    api_dir = os.path.join(DATASET_FOLDER, "api")
    os.makedirs(api_dir, exist_ok=True)
    
    config_path = os.path.join(DATASET_FOLDER, "dataset_config.json")
    with open(config_path, "r") as f:
        config = json.load(f)
        
    zarr_filename = config.get("zarr_filename")
    zarr_path = os.path.join(DATASET_FOLDER, zarr_filename)
    
    print(f"Opening Zarr: {zarr_path}")
    store = zarr.open(zarr_path, mode='r')
    
    # 1. Build OBS_DF and VAR_DF
    obs_group = store['obs']
    obs_attrs = obs_group.attrs  # <--- Grab the parent folder's metadata!
    obs_dict = {}
    
    for col in obs_group.keys():
        if col.startswith('_'): continue
        item = obs_group[col]
        
        if isinstance(item, zarr.Array):
            codes = item[:]
            
            # Check AnnData v0.8+ format (metadata is in the parent obs folder)
            if col in obs_attrs and isinstance(obs_attrs[col], dict) and 'categories' in obs_attrs[col]:
                cat_key = obs_attrs[col]['categories']
                if cat_key in obs_group:
                    cats_array = obs_group[cat_key][:]
                    cats = [c.decode('utf-8') if isinstance(c, bytes) else str(c) for c in cats_array]
                    obs_dict[col] = [cats[c] if c >= 0 else "Unknown" for c in codes]
                else:
                    obs_dict[col] = codes
            
            # Check Alternative format (metadata is on the array itself)
            elif 'categories' in item.attrs:
                cat_key = item.attrs['categories']
                if cat_key in obs_group:
                    cats_array = obs_group[cat_key][:]
                    cats = [c.decode('utf-8') if isinstance(c, bytes) else str(c) for c in cats_array]
                    obs_dict[col] = [cats[c] if c >= 0 else "Unknown" for c in codes]
                else:
                    obs_dict[col] = codes
                    
            else:
                obs_dict[col] = codes
                
        # Handle AnnData v0.7- Categoricals (Stored as a sub-folder)
        elif isinstance(item, zarr.Group) and 'codes' in item and 'categories' in item:
            codes = item['codes'][:]
            cats = [c.decode('utf-8') if isinstance(c, bytes) else str(c) for c in item['categories'][:]]
            obs_dict[col] = [cats[c] if c >= 0 else "Unknown" for c in codes]

    obs_df = pd.DataFrame(obs_dict)
    var_group = store['var']
    index_name = var_group.attrs.get('_index', '_index')
    var_df = pd.DataFrame(index=var_group[index_name][:])
    
    slide_col = config.get("slide_col")
    sample_col = config.get("sample_col")

    if slide_col in obs_df.columns:
        obs_df[slide_col] = obs_df[slide_col].astype(str).apply(lambda x: f"Slide_{x}" if x.isdigit() else x)
    
    # 2. Freeze Metadata
    print("Freezing /api/metadata.json...")
    hierarchy = {}
    if slide_col in obs_df.columns and sample_col in obs_df.columns:
        for slide in obs_df[slide_col].dropna().unique():
            samples = obs_df[obs_df[slide_col] == slide][sample_col].dropna().unique().tolist()
            hierarchy[str(slide)] = [str(s) for s in samples]
    elif slide_col in obs_df.columns:
        for slide in obs_df[slide_col].dropna().unique():
            hierarchy[str(slide)] = ["All"]
    else:
        hierarchy = {"All": ["All"]}

    config["hierarchy"] = hierarchy
    config["n_cells"] = len(obs_df)
    config["n_genes"] = len(var_df)
    config["obs_columns"] = list(obs_df.columns)
    config["obsm_keys"] = list(store['obsm'].keys()) if 'obsm' in store else []
    config["has_segmentations"] = True # Force true for demo
    
    with open(os.path.join(api_dir, "metadata.json"), "w") as f:
        json.dump(config, f)

    # 3. Freeze Genes
    print("Freezing /api/genes.json...")
    
    def get_safe_name(name):
        # Replaces illegal file characters with an underscore
        return re.sub(r'[\\/*?:"<>|]', "_", str(name))

    genes_list = [{"original": str(g), "safe": get_safe_name(g)} for g in var_df.index]
    with open(os.path.join(api_dir, "genes.json"), "w") as f:
        json.dump(genes_list, f)

    # 4. Freeze OBS (Categoricals)
    print("Freezing /api/obs.json...")
    cat_cols = [c for c in obs_df.columns if obs_df[c].nunique() < 100 and c.lower() not in ['cell_id', 'centroid_x', 'centroid_y']]
    obs_export = {c: obs_df[c].fillna("Unknown").astype(str).tolist() for c in cat_cols}
    with open(os.path.join(api_dir, "obs.json"), "w") as f:
        json.dump(obs_export, f)

    # 5. Freeze Composition
    print("Freezing /api/composition.json...")
    composition = {}
    def get_counts(df):
        return {col: {str(k): int(v) for k, v in df[col].value_counts().items()} for col in cat_cols if col in df.columns}

    composition["All_All"] = get_counts(obs_df)
    if slide_col in obs_df.columns:
        for slide in obs_df[slide_col].dropna().unique():
            slide_mask = obs_df[slide_col] == slide
            composition[f"{slide}_All"] = get_counts(obs_df[slide_mask])
            if sample_col in obs_df.columns:
                for sample in obs_df[slide_mask][sample_col].dropna().unique():
                    composition[f"{slide}_{sample}"] = get_counts(obs_df[(obs_df[slide_col]==slide) & (obs_df[sample_col]==sample)])
                    
    with open(os.path.join(api_dir, "composition.json"), "w") as f:
        json.dump(composition, f)

    # return
    # 6. Freeze Sankey
    print("Freezing /api/sankey/...")
    sankey_dir = os.path.join(api_dir, "sankey")
    os.makedirs(sankey_dir, exist_ok=True)
    for col_a, col_b in itertools.permutations(cat_cols, 2):
        df = obs_df[[col_a, col_b]].dropna().copy()
        df["source_node"] = col_a + "_" + df[col_a].astype(str)
        df["target_node"] = col_b + "_" + df[col_b].astype(str)
        flows = df.groupby(["source_node", "target_node"]).size().reset_index(name="value")
        flows = flows[flows["value"] > 0]
        
        unique_nodes = list(pd.unique(flows[["source_node", "target_node"]].values.ravel("K")))
        node_map = {name: i for i, name in enumerate(unique_nodes)}
        
        nodes = [{"name": name} for name in unique_nodes]
        links = [{"source": node_map[row["source_node"]], "target": node_map[row["target_node"]], "value": int(row["value"])} for _, row in flows.iterrows()]
        
        with open(os.path.join(sankey_dir, f"{col_a}__{col_b}.json"), "w") as f:
            json.dump({"nodes": nodes, "links": links}, f)
  
    # 7. Freeze Expression (All Genes)
    print("Freezing /api/expression/ (This might take a minute)...")
    expr_dir = os.path.join(api_dir, "expression")
    os.makedirs(expr_dir, exist_ok=True)
    
    x_group = store['X']
    if 'csc' in x_group.attrs.get('encoding-type', ''):
        indptr, indices, data = x_group['indptr'][:], x_group['indices'][:], x_group['data'][:]
        for i, gene in enumerate(var_df.index): # No [:100] limit!
            safe_gene = get_safe_name(gene)
            start, end = int(indptr[i]), int(indptr[i + 1])
            with open(os.path.join(expr_dir, f"{safe_gene}.json"), "w") as f:
                json.dump({gene: {"i": indices[start:end].tolist(), "v": [round(float(v), 3) for v in data[start:end]]}}, f)
    else:
        # Fallback for standard CSR matrices
        sparse_mat = sp.csr_matrix((x_group['data'][:], x_group['indices'][:], x_group['indptr'][:]), shape=(len(obs_df), len(var_df)))
        for i, gene in enumerate(var_df.index): # No [:100] limit!
            safe_gene = get_safe_name(gene)
            col_data = sparse_mat[:, i].toarray().flatten()
            non_zero = np.nonzero(col_data)[0]
            with open(os.path.join(expr_dir, f"{safe_gene}.json"), "w") as f:
                json.dump({gene: {"i": non_zero.tolist(), "v": [round(float(v), 3) for v in col_data[non_zero]]}}, f)

    # 8. Freeze Locations
    print("Freezing /api/locations.json...")
    spatial_key = config.get("spatial_key", "global")
    if spatial_key in store['obsm']:
        coords = store['obsm'][spatial_key][:]
        slides = obs_df[slide_col].astype(str).tolist() if slide_col in obs_df.columns else ["All"] * len(obs_df)
        samples = obs_df[sample_col].astype(str).tolist() if sample_col in obs_df.columns else ["All"] * len(obs_df)
        loc_data = {
            "id": obs_df.index.tolist(),
            "x": np.round(coords[:, 0], 2).tolist(),
            "y": np.round(coords[:, 1], 2).tolist(),
            "slide": slides,
            "sample": samples,
        }
        with open(os.path.join(api_dir, "locations.json"), "w") as f:
            json.dump(loc_data, f)


    print("✅ Backend successfully frozen! You can now run purely on React.")

if __name__ == "__main__":
    main()