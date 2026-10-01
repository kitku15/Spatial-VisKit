import io
import logging
import os
from contextlib import asynccontextmanager

import numpy as np
import pandas as pd
import scipy.sparse as sp
import zarr
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles

from store import store
from schemas import ExportRequest

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    store.load_data()
    yield


app = FastAPI(title="Spatial Transcriptomics API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

if os.path.exists(store.module_dir):
    app.mount("/data", StaticFiles(directory=store.module_dir), name="data")


def _ensure_loaded():
    if store.obs_df is None or store.var_df is None or store.zarr_store is None:
        raise HTTPException(status_code=500, detail="Data not loaded.")


@app.get("/api/metadata")
def get_metadata():
    _ensure_loaded()

    hierarchy = {}
    if (
        store.slide_col in store.obs_df.columns
        and store.sample_col in store.obs_df.columns
    ):
        for slide in store.obs_df[store.slide_col].dropna().unique():
            samples = (
                store.obs_df[store.obs_df[store.slide_col] == slide][store.sample_col]
                .dropna()
                .unique()
                .tolist()
            )
            hierarchy[str(slide)] = [str(s) for s in samples]
    elif store.slide_col in store.obs_df.columns:
        for slide in store.obs_df[store.slide_col].dropna().unique():
            hierarchy[str(slide)] = ["All"]
    else:
        hierarchy = {"All": ["All"]}

    obsm_keys = (
        list(store.zarr_store["obsm"].keys()) if "obsm" in store.zarr_store else []
    )
    zarr_file = store.zarr_filename_actual or (
        os.path.basename(store.zarr_path) if store.zarr_path else ""
    )

    return {
        "n_cells": len(store.obs_df),
        "n_genes": len(store.var_df),
        "obs_columns": list(store.obs_df.columns),
        "obsm_keys": obsm_keys,
        "hierarchy": hierarchy,
        "zarr_filename": zarr_file,
        "tf_zarr_filename": store.tf_zarr_filename,
        "spatial_key": store.spatial_key,
        "vitessce_dot_size": store.vitessce_dot_size,
        "primary_annotation": store.primary_annotation,
        "available_embeddings": store.available_embeddings,
        "dynamic_annotations": store.dynamic_annotations,
        "extra_obs_sets": store.extra_obs_sets,
        "has_segmentations": store.has_segmentations,
    }


@app.get("/api/genes")
def get_genes():
    _ensure_loaded()
    return [{"original": str(g), "safe": str(g)} for g in store.var_df.index]


@app.get("/api/expression/{gene_name:path}")
def get_expression(gene_name: str):
    _ensure_loaded()
    try:
        if gene_name not in store.var_df.index:
            raise HTTPException(status_code=404, detail="Gene not found.")

        gene_idx = store.var_df.index.get_loc(gene_name)
        if isinstance(gene_idx, slice):
            gene_idx = gene_idx.start
        elif isinstance(gene_idx, np.ndarray):
            gene_idx = np.where(gene_idx)[0][0]
        else:
            gene_idx = int(gene_idx)

        X_group = store.zarr_store["X"]

        if isinstance(X_group, zarr.Group) and "data" in X_group:
            encoding = X_group.attrs.get("encoding-type", "")
            if "csc" in encoding:
                indptr, indices, data = (
                    X_group["indptr"],
                    X_group["indices"],
                    X_group["data"],
                )
                start, end = int(indptr[gene_idx]), int(indptr[gene_idx + 1])

                if start == end:
                    return {gene_name: {"i": [], "v": []}}

                return {
                    gene_name: {
                        "i": indices[start:end].tolist(),
                        "v": [round(float(v), 3) for v in data[start:end]],
                    }
                }
            else:
                sparse_mat = sp.csr_matrix(
                    (X_group["data"][:], X_group["indices"][:], X_group["indptr"][:]),
                    shape=(len(store.obs_df), len(store.var_df)),
                )
                col_data = sparse_mat[:, gene_idx].toarray().flatten()
                non_zero = np.nonzero(col_data)[0]
                return {
                    gene_name: {
                        "i": non_zero.tolist(),
                        "v": [round(float(v), 3) for v in col_data[non_zero]],
                    }
                }

        elif isinstance(X_group, zarr.Array):
            col_data = X_group[:, gene_idx]
            non_zero = np.nonzero(col_data)[0]
            return {
                gene_name: {
                    "i": non_zero.tolist(),
                    "v": [round(float(v), 3) for v in col_data[non_zero]],
                }
            }

        else:
            raise HTTPException(
                status_code=500, detail=f"Unknown Zarr X format: {type(X_group)}"
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching expression for {gene_name}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/obs")
def get_obs():
    _ensure_loaded()

    ignore_cols = {
        "cell_id",
        "cell_id_string",
        "cellsegmentationsetid",
        "assay_type",
        "width",
        "centroid_x",
        "centroid_y",
    }
    cat_cols = [
        c
        for c in store.obs_df.columns
        if c.lower() not in ignore_cols
        and store.obs_df[c].dtype in ["category", "object"]
        and store.obs_df[c].nunique() < 100
    ]

    return {c: store.obs_df[c].fillna("Unknown").astype(str).tolist() for c in cat_cols}


@app.get("/api/locations")
def get_locations():
    _ensure_loaded()
    if not store.spatial_key:
        raise HTTPException(
            status_code=500, detail="No spatial coordinates found in obsm."
        )
    if store.spatial_key not in store.zarr_store["obsm"]:
        raise HTTPException(
            status_code=500, detail=f"Key {store.spatial_key} not found in obsm."
        )

    coords = store.zarr_store["obsm"][store.spatial_key][:]

    slides = (
        store.obs_df[store.slide_col].tolist()
        if store.slide_col in store.obs_df.columns
        else ["All"] * len(store.obs_df)
    )
    samples = (
        store.obs_df[store.sample_col].tolist()
        if store.sample_col in store.obs_df.columns
        else ["All"] * len(store.obs_df)
    )

    return {
        "id": store.obs_df.index.tolist(),
        "x": np.round(coords[:, 0], 2).tolist(),
        "y": np.round(coords[:, 1], 2).tolist(),
        "slide": slides,
        "sample": samples,
    }


@app.get("/api/composition")
def get_composition():
    _ensure_loaded()

    ignore_cols = {
        "cell_id",
        "cell_id_string",
        "cellsegmentationsetid",
        "assay_type",
        "width",
        "centroid_x",
        "centroid_y",
    }
    cat_cols = [
        c
        for c in store.obs_df.columns
        if (store.obs_df[c].dtype in ["category", "object"])
        and store.obs_df[c].nunique() < 100
        and c.lower() not in ignore_cols
    ]

    def get_counts(df: pd.DataFrame) -> dict:
        res = {}
        for col in cat_cols:
            if col in df.columns:
                counts = df[col].value_counts().to_dict()
                res[col] = {str(k): int(v) for k, v in counts.items()}
        return res

    composition = {"All_All": get_counts(store.obs_df)}

    if store.slide_col and store.slide_col in store.obs_df.columns:
        for slide in store.obs_df[store.slide_col].dropna().unique():
            slide_mask = store.obs_df[store.slide_col] == slide
            composition[f"{slide}_All"] = get_counts(store.obs_df[slide_mask])

            if store.sample_col and store.sample_col in store.obs_df.columns:
                samples = store.obs_df[slide_mask][store.sample_col].dropna().unique()
                for sample in samples:
                    sample_mask = slide_mask & (
                        store.obs_df[store.sample_col] == sample
                    )
                    composition[f"{slide}_{sample}"] = get_counts(
                        store.obs_df[sample_mask]
                    )

    return composition


@app.get("/api/sankey")
def get_sankey(col_a: str, col_b: str):
    _ensure_loaded()
    if col_a not in store.obs_df.columns or col_b not in store.obs_df.columns:
        raise HTTPException(
            status_code=400, detail=f"Columns {col_a} or {col_b} not found."
        )

    df = store.obs_df[[col_a, col_b]].dropna().copy()
    df["source_node"] = col_a + "_" + df[col_a].astype(str)
    df["target_node"] = col_b + "_" + df[col_b].astype(str)

    flows = df.groupby(["source_node", "target_node"]).size().reset_index(name="value")
    flows = flows[flows["value"] > 0]

    unique_nodes = list(
        pd.unique(flows[["source_node", "target_node"]].values.ravel("K"))
    )
    node_map = {name: i for i, name in enumerate(unique_nodes)}

    nodes = [{"name": name} for name in unique_nodes]
    links = [
        {
            "source": node_map[row["source_node"]],
            "target": node_map[row["target_node"]],
            "value": int(row["value"]),
        }
        for _, row in flows.iterrows()
    ]

    return {"nodes": nodes, "links": links}


@app.post("/api/export")
def export_data(req: ExportRequest):
    _ensure_loaded()

    mask = pd.Series(True, index=store.obs_df.index)
    for f in req.filters:
        if f.column in store.obs_df.columns:
            mask = mask & (store.obs_df[f.column].astype(str) == f.value)

    if req.lasso_cells:
        mask = mask & store.obs_df.index.isin(req.lasso_cells)

    filtered_obs = store.obs_df[mask].copy()
    if filtered_obs.empty:
        raise HTTPException(status_code=400, detail="No cells match the given filters.")

    valid_cols = [c for c in req.obs_columns if c in filtered_obs.columns]
    filtered_obs = filtered_obs[valid_cols].copy()

    if req.genes:
        row_indices = np.where(mask)[0]
        X_group = store.zarr_store["X"]

        for gene in req.genes:
            if gene in store.var_df.index:
                gene_idx = store.var_df.index.get_loc(gene)
                if isinstance(gene_idx, slice):
                    gene_idx = gene_idx.start
                elif isinstance(gene_idx, np.ndarray):
                    gene_idx = np.where(gene_idx)[0][0]
                else:
                    gene_idx = int(gene_idx)

                if isinstance(X_group, zarr.Group) and "data" in X_group:
                    encoding = X_group.attrs.get("encoding-type", "")
                    if "csc" in encoding:
                        indptr, indices, data = (
                            X_group["indptr"],
                            X_group["indices"],
                            X_group["data"],
                        )
                        start, end = int(indptr[gene_idx]), int(indptr[gene_idx + 1])

                        dense_col = np.zeros(len(store.obs_df), dtype=np.float32)
                        if start < end:
                            dense_col[indices[start:end]] = data[start:end]
                        filtered_obs[f"Expr_{gene}"] = dense_col[row_indices]
                    else:
                        sparse_mat = sp.csr_matrix(
                            (
                                X_group["data"][:],
                                X_group["indices"][:],
                                X_group["indptr"][:],
                            ),
                            shape=(len(store.obs_df), len(store.var_df)),
                        )
                        col_data = sparse_mat[:, gene_idx].toarray().flatten()
                        filtered_obs[f"Expr_{gene}"] = col_data[row_indices]
                else:
                    col_data = X_group[:, gene_idx]
                    filtered_obs[f"Expr_{gene}"] = col_data[row_indices]

    stream = io.StringIO()
    filtered_obs.to_csv(stream)
    stream.seek(0)

    response = StreamingResponse(iter([stream.getvalue()]), media_type="text/csv")
    response.headers["Content-Disposition"] = "attachment; filename=spatial_export.csv"
    return response
