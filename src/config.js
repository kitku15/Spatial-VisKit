// ./config.js

export const API_BASE_URL = "http://192.168.0.165:9001";
export const ANALYSIS_NAME = "tyler_better";
export const ZARR_DIR = `adata_${ANALYSIS_NAME}.zarr`;
export const TF_ZARR_DIR = `adata_${ANALYSIS_NAME}_tf.zarr`;

// --- PROJECT SETTINGS ---
export const PROJECT_TITLE = "CosMx Colon";

// "global" for CosMx, "spatial" for Xenium
export const SPATIAL_KEY = "global"; 

// Base prefix for the cell annotation column used in pipeline (e.g. "CellTypist_majorityvoting_leiden" or "sctype_leiden")
export const ANNOTATION_PREFIX = "CellTypist_majorityvoting_leiden";

// Visual size of dots in Vitessce (CosMx ~ 2.0, Xenium ~ 0.5)
export const VITESSCE_DOT_SIZE = 2; 

// Define extra categorical columns from adata.obs you want to view in Vitessce.
// The "path" must precisely match the column name in your Python AnnData object (e.g., 'obs/DiseaseType').
export const EXTRA_OBS_SETS = [
  { name: "FOV", path: "obs/fov" },
  { name: "Disease Type", path: "obs/DiseaseType" },
  { name: "Treatment Response", path: "obs/TreatmentResponse" },
];
