import React, { useState, useEffect, useMemo } from "react";
import { Vitessce } from "vitessce";
import {
  API_BASE_URL,
  ZARR_DIR,
  SPATIAL_KEY,
  VITESSCE_DOT_SIZE,
  largeColorPalette,
  EXTRA_OBS_SETS,
  ANNOTATION_PREFIX,
  DATA_DIR
} from "./config";

const hexToRgb = (hex) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
};

export default function VitessceSpatialStats({
  n,
  r,
  selectedSlide,
  selectedSample,
  activeCategory,
  spatialViewMode,
}) {
  const [compositionData, setCompositionData] = useState(null);

  useEffect(() => {
    fetch(`${DATA_DIR}/cell_composition.json`)
      .then((res) => res.json())
      .then((data) => setCompositionData(data))
      .catch((err) =>
        console.warn("Could not load cell_composition.json", err),
      );
  }, []);

  const internalColName = useMemo(() => {
    if (activeCategory === "MuSpAn ROI") return "muspan_region";
    if (activeCategory === "Cell Clusters") return `leiden_n${n}_r${r}`;
    if (activeCategory === "CellTypist (Majority Voting)")
      return `${ANNOTATION_PREFIX}_n${n}_r${r}`;
    const extra = EXTRA_OBS_SETS.find((e) => e.name === activeCategory);
    return extra ? extra.path.replace("obs/", "") : "";
  }, [activeCategory, n, r]);

  const clusterLabels = useMemo(() => {
    if (activeCategory === "MuSpAn ROI") return ["In ROI", "Outside ROI"];
    if (
      !compositionData ||
      !internalColName ||
      !compositionData["All_All"] ||
      !compositionData["All_All"][internalColName]
    )
      return [];
    return Object.keys(compositionData["All_All"][internalColName]).sort();
  }, [compositionData, internalColName, activeCategory]);

  const config = useMemo(() => {
    if (clusterLabels.length === 0) return null;

    const spatialEmbeddingKey =
      selectedSample === "All"
        ? selectedSlide === "All"
          ? `obsm/${SPATIAL_KEY}`
          : `obsm/${SPATIAL_KEY}_${selectedSlide}`
        : `obsm/${SPATIAL_KEY}_${selectedSample}`;
    const segmentationsFile =
      selectedSample === "All"
        ? selectedSlide === "All"
          ? `/${DATA_DIR}/segmentations/segmentations.json`
          : `/${DATA_DIR}/segmentations/segmentations_${selectedSlide}.json`
        : `/${DATA_DIR}/segmentations/segmentations_${selectedSample}.json`;

    const obsSetColor = clusterLabels.map((label, i) => {
      if (activeCategory === "MuSpAn ROI") {
        if (label === "In ROI")
          return { path: [activeCategory, label], color: [255, 215, 0] };
        if (label === "Outside ROI")
          return { path: [activeCategory, label], color: [50, 50, 50] };
      }
      return {
        path: [activeCategory, label],
        color: hexToRgb(largeColorPalette[i % largeColorPalette.length]),
      };
    });

    const obsSetSelection = clusterLabels.map((label) => [
      activeCategory,
      label,
    ]);

    const allObsSets = [
      { name: "Cell Clusters", path: `obs/leiden_n${n}_r${r}` },
      {
        name: "CellTypist (Majority Voting)",
        path: `obs/${ANNOTATION_PREFIX}_n${n}_r${r}`,
      },
      { name: "MuSpAn ROI", path: "obs/muspan_region" },
      ...EXTRA_OBS_SETS,
    ];

    const sortedObsSets = [
      allObsSets.find((set) => set.name === activeCategory),
      ...allObsSets.filter((set) => set.name !== activeCategory),
    ].filter(Boolean);

    const files = [
      {
        fileType: "anndata-cells.zarr",
        url: `${API_BASE_URL}/${ZARR_DIR}/`,
        options: {
          mappings: {
            spatial_view: { key: spatialEmbeddingKey, dims: [0, 1] },
          },
        },
        coordinationValues: { obsType: "cell" },
      },
      {
        fileType: "obsSets.anndata.zarr",
        url: `${API_BASE_URL}/${ZARR_DIR}/`,
        options: sortedObsSets,
        coordinationValues: { obsType: "cell" },
      },
      {
        fileType: "obsFeatureMatrix.anndata.zarr",
        url: `${API_BASE_URL}/${ZARR_DIR}/`,
        options: { path: "X" },
        coordinationValues: { obsType: "cell" },
      },
    ];

    if (spatialViewMode === "segmentations") {
      files.push({
        fileType: "obsLocations.anndata.zarr",
        url: `${API_BASE_URL}/${ZARR_DIR}/`,
        options: { path: spatialEmbeddingKey },
        coordinationValues: { obsType: "cell" },
      });
      files.push({
        fileType: "obsSegmentations.json",
        url: `${API_BASE_URL}/${encodeURIComponent(segmentationsFile)}`,
        coordinationValues: { obsType: "cell" },
      });
    }

    const spatialScopes = {
      spatialSegmentationLayer: "SSL1",
      obsSetColor: "OSC1",
      obsColorEncoding: "OCE1",
      obsSetSelection: "OSS1",
      featureSelection: "FS1",
    };
    const pointScopes = {
      embeddingType: "ET1",
      obsSetColor: "OSC1",
      obsColorEncoding: "OCE1",
      obsSetSelection: "OSS1",
      embeddingObsRadiusMode: "RM1",
      embeddingObsRadius: "R1",
      featureSelection: "FS1",
    };
    const obsSetsScopes = {
      obsSetColor: "OSC1",
      obsSetSelection: "OSS1",
      obsColorEncoding: "OCE1",
    };
    const featureListScopes = {
      featureSelection: "FS1",
      obsColorEncoding: "OCE1",
    };

    return {
      version: "1.0.15",
      name: "Spatial Stats Focus",
      initStrategy: "auto",
      datasets: [{ uid: "spatial-stats-dataset", files: files }],
      coordinationSpace: {
        embeddingType: { ET1: "spatial_view" },
        obsSetColor: { OSC1: obsSetColor },
        obsSetSelection: { OSS1: obsSetSelection },
        obsColorEncoding: { OCE1: "cellSetSelection" },
        featureSelection: { FS1: null },
        embeddingObsRadiusMode: { RM1: "manual" },
        embeddingObsRadius: { R1: VITESSCE_DOT_SIZE },
        spatialZoom: { SZ1: -2 },
        spatialTargetX: { STX1: 0 },
        spatialTargetY: { STY1: 0 },
        spatialSegmentationLayer: {
          SSL1: {
            opacity: 1.0,
            radius: 1,
            visible: true,
            stroked: true,
            strokedColor: [100, 100, 100],
          },
        },
      },
      layout: [
        spatialViewMode === "segmentations"
          ? {
              component: "spatial",
              coordinationScopes: spatialScopes,
              x: 0,
              y: 0,
              w: 9,
              h: 12,
            }
          : {
              component: "scatterplot",
              coordinationScopes: pointScopes,
              x: 0,
              y: 0,
              w: 9,
              h: 12,
            },
        {
          component: "obsSets",
          coordinationScopes: obsSetsScopes,
          x: 9,
          y: 0,
          w: 3,
          h: 6,
        },
        {
          component: "featureList",
          coordinationScopes: featureListScopes,
          x: 9,
          y: 6,
          w: 3,
          h: 6,
        },
      ],
    };
  }, [
    n,
    r,
    selectedSlide,
    selectedSample,
    spatialViewMode,
    clusterLabels,
    activeCategory,
  ]);

  if (!config)
    return (
      <div className="p-4 flex items-center justify-center h-full text-textMuted">
        Loading spatial data...
      </div>
    );

  return (
    <div
      className={`w-full h-full relative border border-borderLight rounded overflow-hidden bg-panel ${spatialViewMode === "points" ? "flip-spatial-y" : ""}`}
    >
      <Vitessce
        key={`vitessce-stats-${internalColName}-${selectedSlide}-${selectedSample}-${spatialViewMode}-${activeCategory}`}
        config={config}
        theme="light"
      />
    </div>
  );
}
