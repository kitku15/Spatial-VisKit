// ./src/config.js

// =========================================================
// THESE ARE CONTROLLED BY YOUR ROOT .env FILE
// =========================================================
export const APP_MODE = import.meta.env.VITE_APP_MODE || "full";
export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";
export const PROJECT_TITLE =
  import.meta.env.VITE_PROJECT_TITLE || "Spatial Transcriptomics Explorer";

// =========================================================
// PIPELINE CONVENTIONS (Do not change)
// =========================================================
export const DATA_DIR = "data/aux_data";
export const SPATIAL_CCC_PREFIXES = { LR: "LR_", CCC: "CCC_" };
export const MICROENV_PREFIX = "spatial_microenv_";
export const DEFAULT_MORPH_METRIC = "Area (µm²)";

// =========================================================
// UI THEMES & COLORS
// =========================================================
const getCSSVar = (name) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim();

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
