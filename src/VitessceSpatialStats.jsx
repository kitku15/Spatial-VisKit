import React, { useState, useEffect, useMemo } from "react";
import { Vitessce } from "vitessce";
import { API_BASE_URL, ZARR_DIR, SPATIAL_KEY, VITESSCE_DOT_SIZE, largeColorPalette, EXTRA_OBS_SETS, DATA_DIR, DYNAMIC_ANNOTATIONS } from "./config";

const hexToRgb = (hex) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
};

export default function VitessceSpatialStats({ n, r, selectedSlide, selectedSample, activeCategory, customColors = {} }) {
  const [zarrColumns, setZarrColumns] = useState(null);
  const [obsData, setObsData] = useState(null);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/metadata`).then((res) => res.json()).then((data) => setZarrColumns(data.obs_columns)).catch((err) => console.warn(err));
    fetch(`${API_BASE_URL}/api/obs`).then((res) => res.json()).then((data) => setObsData(data)).catch((err) => console.warn(err));
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
    return Array.from(new Set(obsData[internalColName])).filter((val) => val && val !== "nan" && val !== "None").sort();
  }, [obsData, internalColName, activeCategory]);

  const config = useMemo(() => {
    if (clusterLabels.length === 0) return null;

    const spatialEmbeddingKey = `obsm/${SPATIAL_KEY}`;
    const segmentationsFile = selectedSample === "All" ? selectedSlide === "All" ? `${DATA_DIR}/segmentations/segmentations.json` : `${DATA_DIR}/segmentations/segmentations_${selectedSlide}.json` : `${DATA_DIR}/segmentations/segmentations_${selectedSample}.json`;

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
      if (!set || !set.path) return false;
      if (!zarrColumns) return true; 
      return zarrColumns.includes(set.path.replace("obs/", ""));
    });

    const sampleSetName = EXTRA_OBS_SETS.find(e => e.path.toLowerCase().includes("sample"))?.name || "Sample ID";
    const slideSetName = EXTRA_OBS_SETS.find(e => e.path.toLowerCase().includes("slide"))?.name || "Slide ID";

    const files = [
      { fileType: "anndata-cells.zarr", url: `${API_BASE_URL}/${ZARR_DIR}/`, options: { mappings: { spatial_view: { key: spatialEmbeddingKey, dims: [0, 1] } } }, coordinationValues: { obsType: "cell" } },
      { fileType: "obsSets.anndata.zarr", url: `${API_BASE_URL}/${ZARR_DIR}/`, options: sortedObsSets, coordinationValues: { obsType: "cell" } },
      { fileType: "obsFeatureMatrix.anndata.zarr", url: `${API_BASE_URL}/${ZARR_DIR}/`, options: { path: "X" }, coordinationValues: { obsType: "cell" } },
      { fileType: "obsLocations.anndata.zarr", url: `${API_BASE_URL}/${ZARR_DIR}/`, options: { path: spatialEmbeddingKey }, coordinationValues: { obsType: "cell" } },
      { fileType: "obsSegmentations.json", url: `${API_BASE_URL}/${segmentationsFile}`, coordinationValues: { obsType: "cell" } }
    ];

    return {
      version: "1.0.15", name: "Spatial Stats Focus", initStrategy: "auto",
      datasets: [{ uid: "spatial-stats-dataset", files: files }],
      coordinationSpace: {
        embeddingType: { ET1: "spatial_view" }, obsSetColor: { OSC1: obsSetColor }, obsSetSelection: { OSS1: obsSetSelection }, obsColorEncoding: { OCE1: "cellSetSelection" }, featureSelection: { FS1: null },
        spatialPointLayer: { SPL1: { visible: true, opacity: 0, radius: 0 } },
        spatialSegmentationLayer: { SSL1: { visible: true, opacity: 1.0, radius: 1, stroked: true, strokedColor: [100, 100, 100] } },
        obsSetFilter: { OSF1: selectedSample !== "All" ? [[sampleSetName, selectedSample]] : selectedSlide !== "All" ? [[slideSetName, selectedSlide]] : null },
      },
      layout: [
        { component: "spatial", coordinationScopes: { spatialPointLayer: "SPL1", spatialSegmentationLayer: "SSL1", obsSetColor: "OSC1", obsColorEncoding: "OCE1", obsSetSelection: "OSS1", featureSelection: "FS1", obsSetFilter: "OSF1" }, x: 0, y: 0, w: 9, h: 12 },
        { component: "obsSets", coordinationScopes: { obsSetColor: "OSC1", obsSetSelection: "OSS1", obsColorEncoding: "OCE1", obsSetFilter: "OSF1" }, x: 9, y: 0, w: 3, h: 6 },
        { component: "featureList", coordinationScopes: { featureSelection: "FS1", obsColorEncoding: "OCE1" }, x: 9, y: 6, w: 3, h: 6 },
      ],
    };
  }, [n, r, selectedSlide, selectedSample, clusterLabels, activeCategory, obsData, zarrColumns]);

  if (!config) return <div className="p-4 flex items-center justify-center h-full text-textMuted font-bold">Loading spatial data...</div>;

  return (
    <div className="w-full h-full relative border border-borderLight rounded overflow-hidden bg-panel">
      <Vitessce key={`vitessce-stats-${internalColName}-${selectedSlide}-${selectedSample}-${activeCategory}`} config={config} theme="light" />
    </div>
  );
}