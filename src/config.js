// ./config.js

export const API_BASE_URL = "http://127.0.0.1:8000";
export const ANALYSIS_NAME = "tyler_manual";
export const DATA_DIR = "data/aux_data";
export const ZARR_DIR = `data/adata_${ANALYSIS_NAME}_web.zarr`;
export const TF_ZARR_DIR = `data/adata_${ANALYSIS_NAME}_tf_web.zarr`;

// --- PROJECT SETTINGS ---
export const PROJECT_TITLE = "CosMx SMI: Tyler - FFPE Human Colonic Biopsies";

// "global" for CosMx, "spatial" for Xenium
export const SPATIAL_KEY = "global";

// Visual size of dots in Vitessce (CosMx ~ 2.0, Xenium ~ 0.5)
export const VITESSCE_DOT_SIZE = 2;

// --- ANNOTATION SETTINGS ---

// For annotations that change based on neighbors/resolution (e.g. they end in _n10_r0.1)
export const DYNAMIC_ANNOTATIONS = [
  { name: "Cell Clusters (Leiden)", prefix: "leiden" },
  // { name: "CellTypist", prefix: "CellTypist_majorityvoting_leiden" },
];

// For components that only display a single primary annotation (like Cell-Cell Communication)
export const PRIMARY_ANNOTATION_PREFIX = "Final_Annotation"; 
// export const PRIMARY_ANNOTATION_PREFIX = 'CellTypist_majorityvoting_leiden_n15_r1.0'

// NOTE: Static annotations that DO NOT change by resolution (like 'scanvi_label') 
// should simply be placed in EXTRA_OBS_SETS below!

// Define extra categorical columns from adata.obs you want to view in Vitessce.
// The "path" must precisely match the column name in your Python AnnData object (e.g., 'obs/DiseaseType').
export const EXTRA_OBS_SETS = [
  { name: "FOV", path: "obs/fov" },
  // { name: "FOV", path: "obs/region" },
  { name: "Disease Type", path: "obs/DiseaseType" },
  { name: "Treatment Response", path: "obs/TreatmentResponse" },
  { name: "Sample ID", path: "obs/sample_id" },
  { name: "Slide ID", path: "obs/slide_ID" },
  { name: "Spatial Microenvironment", path: "obs/spatial_microenvironment" },
  { name: "scANVI", path: "obs/C_scANVI" },
  { name: "Coarse Cell Type", path: "obs/Coarse_Celltype" },
  { name: "Broad Cell Type", path: "obs/Broad_Celltype" },
  { name: "Broad Lineage", path: "obs/Broad_Lineage" },
  { name: "Final Annotation", path: "obs/Final_Annotation" },
];

// Spatial CCC prefixes (e.g., Ligand-Receptor pairs or NMF factors)
export const SPATIAL_CCC_PREFIXES = {
  LR: "LR_",
  CCC: "CCC_"
};

// Prefix used for microenvironment embedding and segmentation files
export const MICROENV_PREFIX = "spatial_microenv_";

// Default column name for the morphology violin plot in Spatial Stats
export const DEFAULT_MORPH_METRIC = "Area (µm²)";

const getCSSVar = (name) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim();

// Now Javascript grabs the colors directly from index.css!
export const themeColors = {
  primary: getCSSVar("--primary") || "#3b82f6",
  success: getCSSVar("--success") || "#22c55e",
  warning: getCSSVar("--warning") || "#f59e0b",
  danger: getCSSVar("--danger") || "#ef4444",
  info: getCSSVar("--info") || "#a855f7",
  neutral: getCSSVar("--border-dark") || "#94a3b8",
  label: getCSSVar("--text-main") || "#1e293b",
  selpanel: getCSSVar("--text-muted") || "#64748b",
  background: getCSSVar("--bg-app") || "#f8fafc",
  paper: getCSSVar("--bg-panel") || "#ffffff",
  stroke: getCSSVar("--border-light") || "#e2e8f0",
  black: "#000000",
  white: "#ffffff",
};

export const annotationColorPalette = [
  themeColors.primary,
  themeColors.warning,
  themeColors.success,
  themeColors.danger,
  themeColors.info,
  "#8c564b",
  "#e377c2",
  "#7f7f7f",
  "#bcbd22",
  "#17becf",
  "#aec7e8",
  "#ffbb78",
  "#98df8a",
  "#ff9896",
  "#c5b0d5",
  "#c49c94",
  "#f7b6d2",
  "#c7c7c7",
  "#dbdb8d",
  "#9edae5",
  "#393b79",
  "#637939",
  "#8c6d31",
  "#843c39",
  "#7b4173",
];

export const defaultCategoryPalette = [
  "#1f77b4",
  "#ff7f0e",
  "#2ca02c",
  "#d62728",
  "#9467bd",
  "#8c564b",
  "#e377c2",
  "#7f7f7f",
  "#bcbd22",
  "#17becf",
];

export const channelColorMap = {
  Red: [255, 0, 0],
  Green: [0, 255, 0],
  Blue: [0, 150, 255],
  Magenta: [255, 0, 255],
  Cyan: [0, 255, 255],
  Yellow: [255, 255, 0],
};

export const defaultChannelColorNames = [
  "Red",
  "Green",
  "Blue",
  "Magenta",
  "Cyan",
  "Yellow",
];

export const largeColorPalette = [
  "#e78ac3",
  "#FFE119",
  "#D62728",
  "#4363D8",
  "#AAFFC3",
  "#911EB4",
  "#46F0F0",
  "#F032E6",
  "#008080",
  "#FABEBE",
  "#3CB44B",
  "#E6BEFF",
  "#4FC601",
  "#D62728",
  "#800000",
  "#9467BD",
  "#808000",
  "#FFD8B1",
  "#000075",
  "#52828D",
  "#FF4A46",
  "#FF7A5C",
  "#1CE6FF",
  "#FF34FF",
  "#8C564B",
  "#008941",
  "#006FA6",
  "#A30059",
  "#FFDBE5",
  "#7A4900",
  "#0000A6",
  "#63FFAC",
  "#B79762",
  "#004D43",
  "#8FB0FF",
  "#997D87",
  "#5A0007",
  "#809693",
  "#F58231",
  "#1B4400",
  "#9A6324",
  "#3B5DFF",
  "#4A3B53",
  "#FF2F80",
];

export const defaultPlotTheme = {
  markerColor: themeColors.primary,
  thresholdLine: themeColors.danger,
  highlightLine: themeColors.primary,
  scatterLow: themeColors.neutral,
  scatterHigh: themeColors.primary,
  axisLine: themeColors.black,
  axisText: themeColors.label,
  paperBg: themeColors.paper,
  plotBg: themeColors.paper,
  gridColor: "#e5e7eb",
};
