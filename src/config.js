// ./config.js

export const API_BASE_URL = "http://192.168.1.220:9001";
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
  { name: "Sample ID", path: "obs/sample_id" },
  { name: "Slide ID", path: "obs/slide_id" },
  // { name: "MuSpan ROI", path: "obs/muspan_region" },
  { name: "Spatial Microenvironment", path: "obs/spatial_microenvironment" },
];

export const largeColorPalette = [
  "#e78ac3", "#FFE119", "#D62728", "#4363D8", "#AAFFC3", 
  "#911EB4", "#46F0F0", "#F032E6", "#008080", "#FABEBE", 
  "#3CB44B", "#E6BEFF", "#4FC601", "#D62728", "#800000", 
  "#9467BD", "#808000", "#FFD8B1", "#000075", "#52828D", 
  "#FF4A46", "#FF7A5C", "#1CE6FF", "#FF34FF", "#8C564B", 
  "#008941", "#006FA6", "#A30059", "#FFDBE5", "#7A4900", 
  "#0000A6", "#63FFAC", "#B79762", "#004D43", "#8FB0FF", 
  "#997D87", "#5A0007", "#809693", "#F58231", "#1B4400", 
  "#9A6324", "#3B5DFF", "#4A3B53", "#FF2F80"
];