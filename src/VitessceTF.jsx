import React, { useState, useEffect, useMemo } from "react";
import { Vitessce } from "vitessce";
import { API_BASE_URL, ZARR_DIR, TF_ZARR_DIR, SPATIAL_KEY, VITESSCE_DOT_SIZE, DATA_DIR, DYNAMIC_ANNOTATIONS, EXTRA_OBS_SETS, largeColorPalette } from "./config";

const hexToRgb = (hex) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
};

export default function VitessceTF({
  viewMode,
  selectedSlide,
  selectedSample,
  n, r,
  embedding,
  activeCategory,
  customColors = {},
}) {

  const [zarrColumns, setZarrColumns] = useState(null);
  const [obsData, setObsData] = useState(null);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/metadata`).then(res => res.json()).then(data => setZarrColumns(data.obs_columns)).catch(err => console.warn(err));
    fetch(`${API_BASE_URL}/api/obs`).then(res => res.json()).then(setObsData).catch(err => console.warn(err));
  }, []);

  const internalColName = useMemo(() => {
    if (activeCategory === "MuSpAn ROI") return "muspan_region";
    const dynamicAnn = DYNAMIC_ANNOTATIONS.find((a) => a.name === activeCategory);
    if (dynamicAnn) return `${dynamicAnn.prefix}_n${n}_r${r}`;
    const extra = EXTRA_OBS_SETS.find((e) => e.name === activeCategory);
    return extra ? extra.path.replace("obs/", "") : "";
  }, [activeCategory, n, r]);

  const clusterLabels = useMemo(() => {
    if (activeCategory === "MuSpAn ROI") return ["In ROI", "Outside ROI"];
    if (!obsData || !internalColName || !obsData[internalColName]) return [];
    return Array.from(new Set(obsData[internalColName])).filter(val => val && val !== "nan" && val !== "None").sort();
  }, [obsData, internalColName, activeCategory]);

  const config = useMemo(() => {
    if (clusterLabels.length === 0) return null;

    let segmentationsFile = selectedSample !== "All" ? `${DATA_DIR}/segmentations/segmentations_${selectedSample}.json`
      : selectedSlide !== "All" ? `${DATA_DIR}/segmentations/segmentations_Slide_${selectedSlide}.json` : `${DATA_DIR}/segmentations/segmentations.json`;

    const obsSetColor = clusterLabels.map((label, i) => {
      if (activeCategory === "MuSpAn ROI") {
        if (label === "In ROI") return { path: [activeCategory, label], color: [255, 215, 0] };
        if (label === "Outside ROI") return { path: [activeCategory, label], color: [50, 50, 50] };
      }
      return { path: [activeCategory, label], color: hexToRgb(customColors[label] || largeColorPalette[i % largeColorPalette.length]) };
    });

    const obsSetSelection = clusterLabels.map((label) => [activeCategory, label]);

    const allObsSets = [
      ...DYNAMIC_ANNOTATIONS.map((ann) => {
        const pathSuffix = (!n || n === "N/A" || !r || r === "N/A") ? ann.prefix : `${ann.prefix}_n${n}_r${r}`;
        return { name: ann.name, path: `obs/${pathSuffix}` };
      }),
      { name: "MuSpAn ROI", path: "obs/muspan_region" },
      ...EXTRA_OBS_SETS,
    ];

    const sortedObsSets = [
      allObsSets.find((set) => set.name === activeCategory),
      ...allObsSets.filter((set) => set.name !== activeCategory),
    ].filter((set) => {
      if (!set || !set.path || !zarrColumns) return false;
      return zarrColumns.includes(set.path.replace("obs/", ""));
    });

    const sampleSetName = EXTRA_OBS_SETS.find(e => e.path.toLowerCase().includes("sample"))?.name || "Sample ID";
    const slideSetName = EXTRA_OBS_SETS.find(e => e.path.toLowerCase().includes("slide"))?.name || "Slide ID";

    const files = [
      {
        fileType: "anndata-cells.zarr", url: `${API_BASE_URL}/${ZARR_DIR}/`,
        options: { mappings: { current_view: { key: `obsm/${embedding}`, dims: [0, 1] }, spatial_view: { key: `obsm/${SPATIAL_KEY}`, dims: [0, 1] } } },
        coordinationValues: { obsType: "cell" },
      },
      {
        fileType: "obsSets.anndata.zarr", url: `${API_BASE_URL}/${ZARR_DIR}/`, options: sortedObsSets, coordinationValues: { obsType: "cell" },
      },
      {
        fileType: "obsLocations.anndata.zarr", url: `${API_BASE_URL}/${ZARR_DIR}/`, options: { path: `obsm/${SPATIAL_KEY}` }, coordinationValues: { obsType: "cell" },
      },
      {
        fileType: "obsSegmentations.json", url: `${API_BASE_URL}/${segmentationsFile}`, coordinationValues: { obsType: "cell" },
      },
      // Note: We use the TF zarr ONLY for the feature matrix
      {
        fileType: "obsFeatureMatrix.anndata.zarr", url: `${API_BASE_URL}/${TF_ZARR_DIR}/`, options: { path: "X" }, coordinationValues: { obsType: "cell" },
      }
    ];

    const coordinationSpace = {
      embeddingType: { ET1: viewMode === "Spatial" ? "spatial_view" : "current_view" },
      embeddingObsRadiusMode: { RM1: "manual" },
      embeddingObsRadius: { R1: VITESSCE_DOT_SIZE },
      featureValueColormap: { CM1: "plasma" },
      obsSetColor: { OSC1: obsSetColor },
      obsSetSelection: { OSS1: obsSetSelection },
      obsColorEncoding: { OCE1: "cellSetSelection" },
      spatialPointLayer: { SPL1: { visible: true, opacity: 0, radius: 0 } },
      spatialSegmentationLayer: { SSL1: { visible: true, opacity: 0.8, radius: 1, stroked: true, strokedColor: [100, 100, 100] } },
      obsSetFilter: {
        OSF1: selectedSample !== "All" ? [[sampleSetName, selectedSample]] : selectedSlide !== "All" ? [[slideSetName, selectedSlide]] : null
      },
    };

    const spatialScopes = {
      embeddingType: "ET1", spatialPointLayer: "SPL1", spatialSegmentationLayer: "SSL1", embeddingObsRadiusMode: "RM1", embeddingObsRadius: "R1",
      featureValueColormap: "CM1", obsSetFilter: "OSF1", obsSetColor: "OSC1", obsSetSelection: "OSS1", obsColorEncoding: "OCE1"
    };

    const scatterplotScopes = {
      embeddingType: "ET1", embeddingObsRadiusMode: "RM1", embeddingObsRadius: "R1",
      featureValueColormap: "CM1", obsSetFilter: "OSF1", obsSetColor: "OSC1", obsSetSelection: "OSS1", obsColorEncoding: "OCE1"
    };

    return {
      version: "1.0.15", name: "TF Activity Viewer", initStrategy: "auto",
      datasets: [{ uid: "tf-dataset", files }],
      coordinationSpace,
      layout: [
        {
          component: viewMode === "Spatial" ? "spatial" : "scatterplot",
          coordinationScopes: viewMode === "Spatial" ? spatialScopes : scatterplotScopes,
          x: 0, y: 0, w: 7, h: 12,
        },
        {
          component: "layerController",
          coordinationScopes: viewMode === "Spatial" ? spatialScopes : scatterplotScopes,
          x: 7, y: 0, w: 3, h: 5,
        },
        {
          component: "obsSets",
          coordinationScopes: { obsSetColor: "OSC1", obsSetSelection: "OSS1", obsColorEncoding: "OCE1", obsSetFilter: "OSF1" },
          x: 7, y: 5, w: 3, h: 7,
        },
        { component: "featureList", coordinationScopes: { obsColorEncoding: "OCE1" }, x: 10, y: 0, w: 2, h: 12 },
      ],
    };
  }, [viewMode, selectedSlide, selectedSample, n, r, embedding, clusterLabels, activeCategory, zarrColumns]);

  if (!config) return <div className="p-4 flex items-center justify-center h-full text-textMuted font-bold">Loading TF spatial data...</div>;

  return (
    <div className="w-full h-full relative border border-borderLight rounded overflow-hidden bg-panel">
      <Vitessce key={`vitessce-tf-${viewMode}-${selectedSlide}-${selectedSample}-${internalColName}`} config={config} theme="light" />
    </div>
  );
}