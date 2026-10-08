import { useState, useEffect, useMemo } from "react";
import { Vitessce } from "vitessce";
import { API_BASE_URL, largeColorPalette } from "../../config/config";

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

  const dataUrl = new URLSearchParams(window.location.search)
    .get("data")
    ?.replace(/\/$/, "");
  const zarrUrl = `${dataUrl}/${datasetConfig?.zarr_filename}`;

  const [obsData, setObsData] = useState(null);

  useEffect(() => {
    if (!dataUrl) return;
    const params = new URLSearchParams(window.location.search);
    const configB64 = params.get("config") || "";
    Promise.all([
      fetch(
        `${API_BASE_URL}/api/metadata?data_url=${encodeURIComponent(dataUrl)}&config_b64=${configB64}`,
      ).then((res) => (res.ok ? res.json() : Promise.reject(res))),
      fetch(
        `${API_BASE_URL}/api/obs?data_url=${encodeURIComponent(dataUrl)}`,
      ).then((res) => (res.ok ? res.json() : Promise.reject(res))),
    ])
      .then(([, obs]) => {
        setObsData(obs);
      })
      .catch((err) =>
        console.warn("Failed to load Spatial Stats metadata/obs:", err),
      );
  }, [dataUrl]);

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
    if (clusterLabels.length === 0 || !dataUrl) return null;

    const spatialEmbeddingKey = `obsm/${spatialKey}`;
    const segmentationsFile =
      selectedSample === "All"
        ? selectedSlide === "All"
          ? `${dataUrl}/aux_data/segmentations/segmentations.json`
          : `${dataUrl}/aux_data/segmentations/segmentations_Slide_${selectedSlide}.json`
        : `${dataUrl}/aux_data/segmentations/segmentations_${selectedSample}.json`;

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

    const files = [
      {
        fileType: "anndata-cells.zarr",
        url: `${zarrUrl}/`,
        options: {
          mappings: {
            spatial_view: { key: spatialEmbeddingKey, dims: [0, 1] },
          },
        },
        coordinationValues: { obsType: "cell" },
      },
      {
        fileType: "obsSets.anndata.zarr",
        url: `${zarrUrl}/`,
        options: sortedObsSets,
        coordinationValues: { obsType: "cell" },
      },
      {
        fileType: "obsFeatureMatrix.anndata.zarr",
        url: `${zarrUrl}/`,
        options: { path: "X" },
        coordinationValues: { obsType: "cell" },
      },
      {
        fileType: "obsLocations.anndata.zarr",
        url: `${zarrUrl}/`,
        options: { path: spatialEmbeddingKey },
        coordinationValues: { obsType: "cell" },
      },
      {
        fileType: "obsSegmentations.json",
        url: segmentationsFile,
        coordinationValues: { obsType: "cell" },
      },
    ];

    return {
      version: "1.0.15",
      name: "Spatial Stats Focus",
      initStrategy: "auto",
      datasets: [{ uid: "spatial-stats-dataset", files }],
      coordinationSpace: {
        embeddingType: { ET1: "spatial_view" },
        obsSetColor: { OSC1: obsSetColor },
        obsSetSelection: { OSS1: obsSetSelection },
        obsColorEncoding: { OCE1: "cellSetSelection" },
        featureSelection: { FS1: null },
        spatialPointLayer: { SPL1: { visible: true, opacity: 0, radius: 0 } },
        spatialSegmentationLayer: {
          SSL1: {
            visible: true,
            opacity: 1.0,
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
      },
      layout: [
        {
          component: "spatial",
          coordinationScopes: {
            spatialPointLayer: "SPL1",
            spatialSegmentationLayer: "SSL1",
            obsSetColor: "OSC1",
            obsColorEncoding: "OCE1",
            obsSetSelection: "OSS1",
            featureSelection: "FS1",
            obsSetFilter: "OSF1",
          },
          x: 0,
          y: 0,
          w: 9,
          h: 12,
        },
        {
          component: "obsSets",
          coordinationScopes: {
            obsSetColor: "OSC1",
            obsSetSelection: "OSS1",
            obsColorEncoding: "OCE1",
            obsSetFilter: "OSF1",
          },
          x: 9,
          y: 0,
          w: 3,
          h: 6,
        },
        {
          component: "featureList",
          coordinationScopes: {
            featureSelection: "FS1",
            obsColorEncoding: "OCE1",
          },
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
    clusterLabels,
    activeCategory,
    customColors,
    dynamicAnnotations,
    extraObsSets,
    spatialKey,
    dataUrl,
    zarrUrl,
  ]);

  if (!config)
    return (
      <div className="p-4 flex items-center justify-center h-full text-textMuted font-bold">
        Loading spatial data...
      </div>
    );

  return (
    <div className="w-full h-full relative border border-borderLight rounded overflow-hidden bg-panel">
      <Vitessce
        key={`vitessce-stats-${internalColName}-${selectedSlide}-${selectedSample}-${activeCategory}`}
        config={config}
        theme="light"
      />
    </div>
  );
}
