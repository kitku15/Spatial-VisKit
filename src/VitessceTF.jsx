import { useState, useEffect, useMemo } from "react";
import { Vitessce } from "vitessce";
import { API_BASE_URL, DATA_DIR, largeColorPalette } from "./config";

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
  n,
  r,
  embedding,
  activeCategory,
  customColors = {},
  datasetConfig,
}) {
  const dynamicAnnotations = useMemo(
    () => datasetConfig?.dynamic_annotations || [],
    [datasetConfig],
  );
  const extraObsSets = useMemo(
    () => datasetConfig?.extra_obs_sets || [],
    [datasetConfig],
  );
  const spatialKey = datasetConfig?.spatial_key || "global";
  const dotSize = datasetConfig?.vitessce_dot_size || 2;

  // Safe fallback just in case the backend variable is missing
  const tfFallback = datasetConfig?.zarr_filename?.replace(
    "_web.zarr",
    "_tf_web.zarr",
  );
  const zarrDir = `data/${datasetConfig?.zarr_filename}`;
  const tfZarrDir = `data/${datasetConfig?.tf_zarr_filename || tfFallback}`;

  const [zarrColumns, setZarrColumns] = useState(null);
  const [obsData, setObsData] = useState(null);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/metadata`)
      .then((res) => res.json())
      .then((data) => setZarrColumns(data.obs_columns))
      .catch((err) => console.warn(err));
    fetch(`${API_BASE_URL}/api/obs`)
      .then((res) => res.json())
      .then(setObsData)
      .catch((err) => console.warn(err));
  }, []);

  const internalColName = useMemo(() => {
    if (activeCategory === "MuSpAn ROI") return "muspan_region";
    const dynamicAnn = dynamicAnnotations.find(
      (a) => a.name === activeCategory,
    );
    if (dynamicAnn) return `${dynamicAnn.prefix}_n${n}_r${r}`;
    const extra = extraObsSets.find((e) => e.name === activeCategory);
    return extra ? extra.path.replace("obs/", "") : "";
  }, [activeCategory, n, r, dynamicAnnotations, extraObsSets]);

  const clusterLabels = useMemo(() => {
    if (activeCategory === "MuSpAn ROI") return ["In ROI", "Outside ROI"];
    if (!obsData || !internalColName || !obsData[internalColName]) return [];
    return Array.from(new Set(obsData[internalColName]))
      .filter((val) => val && val !== "nan" && val !== "None")
      .sort();
  }, [obsData, internalColName, activeCategory]);

  const config = useMemo(() => {
    if (clusterLabels.length === 0 || !datasetConfig) return null;

    const segmentationsFile =
      selectedSample !== "All"
        ? `${DATA_DIR}/segmentations/segmentations_${selectedSample}.json`
        : selectedSlide !== "All"
          ? `${DATA_DIR}/segmentations/segmentations_Slide_${selectedSlide}.json`
          : `${DATA_DIR}/segmentations/segmentations.json`;

    const obsSetColor = clusterLabels.map((label, i) => {
      if (activeCategory === "MuSpAn ROI") {
        if (label === "In ROI")
          return { path: [activeCategory, label], color: [255, 215, 0] };
        if (label === "Outside ROI")
          return { path: [activeCategory, label], color: [50, 50, 50] };
      }
      return {
        path: [activeCategory, label],
        color: hexToRgb(
          customColors[label] ||
            largeColorPalette[i % largeColorPalette.length],
        ),
      };
    });

    const obsSetSelection = clusterLabels.map((label) => [
      activeCategory,
      label,
    ]);

    const allObsSets = [
      ...dynamicAnnotations.map((ann) => {
        const pathSuffix =
          !n || n === "N/A" || !r || r === "N/A"
            ? ann.prefix
            : `${ann.prefix}_n${n}_r${r}`;
        return { name: ann.name, path: `obs/${pathSuffix}` };
      }),
      { name: "MuSpAn ROI", path: "obs/muspan_region" },
      ...extraObsSets,
    ];

    const activeObsSet = allObsSets.find((set) => set.name === activeCategory);
    const sortedObsSets = activeObsSet ? [activeObsSet] : [];

    const sampleSetName =
      extraObsSets.find((e) => e.path.toLowerCase().includes("sample"))?.name ||
      "Sample ID";
    const slideSetName =
      extraObsSets.find((e) => e.path.toLowerCase().includes("slide"))?.name ||
      "Slide ID";

    // EXPLICIT LOADERS: Maps exact pieces to exact Zarrs, preventing 'obs' errors in TF zarr
    const files = [
      // 1. Locations from Main Zarr
      {
        fileType: "obsLocations.anndata.zarr",
        url: `${API_BASE_URL}/${zarrDir}/`,
        options: { path: `obsm/${spatialKey}` },
        coordinationValues: { obsType: "cell" },
      },
      // 2. Spatial Embedding from Main Zarr
      {
        fileType: "obsEmbedding.anndata.zarr",
        url: `${API_BASE_URL}/${zarrDir}/`,
        options: { path: `obsm/${spatialKey}` },
        coordinationValues: { obsType: "cell", embeddingType: "spatial_view" },
      },
      // 3. UMAP Embedding from Main Zarr
      {
        fileType: "obsEmbedding.anndata.zarr",
        url: `${API_BASE_URL}/${zarrDir}/`,
        options: { path: `obsm/${embedding}` },
        coordinationValues: { obsType: "cell", embeddingType: "current_view" },
      },
      // 4. Labels from Main Zarr
      {
        fileType: "obsSets.anndata.zarr",
        url: `${API_BASE_URL}/${zarrDir}/`,
        options: sortedObsSets,
        coordinationValues: { obsType: "cell" },
      },
      // 5. Segmentations from JSON
      {
        fileType: "obsSegmentations.json",
        url: `${API_BASE_URL}/${segmentationsFile}`,
        coordinationValues: { obsType: "cell" },
      },
      // 6. TF Matrix from TF Zarr
      {
        fileType: "obsFeatureMatrix.anndata.zarr",
        url: `${API_BASE_URL}/${tfZarrDir}/`,
        options: { path: "X" },
        coordinationValues: { obsType: "cell" },
      },
    ];

    const coordinationSpace = {
      embeddingType: {
        ET_MAIN: viewMode === "Spatial" ? "spatial_view" : "current_view",
      },

      // Enforce sync between the two views by defining shared zoom/target scopes
      spatialZoom: { SZ1: -2 },
      spatialTargetX: { STX1: 0 },
      spatialTargetY: { STY1: 0 },
      embeddingZoom: { EZ1: 0 },
      embeddingTargetX: { EX1: 0 },
      embeddingTargetY: { EY1: 0 },

      embeddingObsRadiusMode: { RM1: "manual" },
      embeddingObsRadius: { R1: dotSize },
      featureValueColormap: { CM1: "plasma" },
      obsSetColor: { OSC1: obsSetColor },
      obsSetSelection: { OSS1: obsSetSelection },

      // Tells the Left Panel to color by Labels, and the Right Panel to color by TFs
      obsColorEncoding: {
        OCE_LABELS: "cellSetSelection",
        OCE_TF: "geneSelection",
      },

      spatialPointLayer: { SPL1: { visible: true, opacity: 0, radius: 0 } },
      spatialSegmentationLayer: {
        SSL1: {
          visible: true,
          opacity: 0.8,
          radius: 1,
          stroked: true,
          strokedColor: [100, 100, 100],
        },
      },
      obsSetFilter: {
        OSF1:
          selectedSample !== "All"
            ? [[sampleSetName, selectedSample]]
            : selectedSlide !== "All"
              ? [[slideSetName, selectedSlide]]
              : null,
      },
    };

    const sharedScopes = {
      embeddingType: "ET_MAIN",
      spatialZoom: "SZ1",
      spatialTargetX: "STX1",
      spatialTargetY: "STY1",
      embeddingZoom: "EZ1",
      embeddingTargetX: "EX1",
      embeddingTargetY: "EY1",
      spatialPointLayer: "SPL1",
      spatialSegmentationLayer: "SSL1",
      embeddingObsRadiusMode: "RM1",
      embeddingObsRadius: "R1",
      obsSetFilter: "OSF1",
    };

    // Scopes for the Left Panel (Labels)
    const scopesLabels = {
      ...sharedScopes,
      obsSetColor: "OSC1",
      obsSetSelection: "OSS1",
      obsColorEncoding: "OCE_LABELS",
    };

    // Scopes for the Right Panel (TF Matrix)
    const scopesTF = {
      ...sharedScopes,
      featureValueColormap: "CM1",
      obsColorEncoding: "OCE_TF",
    };

    const viewComponent = viewMode === "Spatial" ? "spatial" : "scatterplot";

    return {
      version: "1.0.15",
      name: "TF Activity Viewer",
      initStrategy: "auto",
      datasets: [{ uid: "hybrid-tf-dataset", files: files }],
      coordinationSpace,
      layout: [
        {
          component: viewComponent,
          coordinationScopes: scopesLabels,
          x: 0,
          y: 0,
          w: 4,
          h: 12,
          props: { title: "Cell Labels" },
        },
        {
          component: viewComponent,
          coordinationScopes: scopesTF,
          x: 4,
          y: 0,
          w: 4,
          h: 12,
          props: { title: "TF Activity" },
        },
        {
          component: "obsSets",
          coordinationScopes: {
            obsSetColor: "OSC1",
            obsSetSelection: "OSS1",
            obsColorEncoding: "OCE_LABELS",
            obsSetFilter: "OSF1",
          },
          x: 8,
          y: 0,
          w: 2,
          h: 12,
          props: { title: "Clusters" },
        },
        {
          component: "featureList",
          coordinationScopes: { obsColorEncoding: "OCE_TF" },
          x: 10,
          y: 0,
          w: 2,
          h: 12,
          props: { title: "TFs" },
        },
      ],
    };
  }, [
    viewMode,
    selectedSlide,
    selectedSample,
    n,
    r,
    embedding,
    clusterLabels,
    activeCategory,
    zarrColumns,
    datasetConfig,
    spatialKey,
    zarrDir,
    tfZarrDir,
    customColors,
    dotSize,
    dynamicAnnotations,
    extraObsSets,
  ]);

  if (!config)
    return (
      <div className="p-4 flex items-center justify-center h-full text-textMuted font-bold">
        Loading TF spatial data...
      </div>
    );

  return (
    <div className="w-full h-full relative border border-borderLight rounded overflow-hidden bg-panel">
      <Vitessce
        key={`vitessce-tf-${viewMode}-${selectedSlide}-${selectedSample}-${internalColName}`}
        config={config}
        theme="light"
      />
    </div>
  );
}
