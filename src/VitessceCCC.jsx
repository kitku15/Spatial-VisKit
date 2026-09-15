import { useMemo } from "react";
import { Vitessce } from "vitessce";
import { API_BASE_URL, DATA_DIR, ZARR_PREFIX } from "./config";

const hexToRgb = (hex) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
};

export default function VitessceCCC({
  n,
  r,
  selectedMicroenv,
  cellColorMap,
  datasetConfig,
}) {
  const spatialKey = datasetConfig?.spatial_key || "global";
  const primaryAnnotation =
    datasetConfig?.primary_annotation || "Final_Annotation";
  const zarrDir = `${ZARR_PREFIX}${datasetConfig?.zarr_filename}`;

  const config = useMemo(() => {
    if (!datasetConfig) return null;

    const spatialEmbeddingKey = `obsm/${spatialKey}`;
    const segmentationsFile =
      selectedMicroenv === "All"
        ? `${DATA_DIR}/segmentations/segmentations.json`
        : `${DATA_DIR}/segmentations/segmentations_microenv_${selectedMicroenv}.json`;

    const cellTypeName = "Cell Annotation";
    const cellTypePath = `obs/${primaryAnnotation}`;

    const obsSetColor = cellColorMap.map((c) => ({
      path: [cellTypeName, c.name],
      color: hexToRgb(c.color),
    }));
    const obsSetSelection = cellColorMap.map((c) => [cellTypeName, c.name]);

    const files = [
      {
        fileType: "anndata-cells.zarr",
        url: `${API_BASE_URL}/${zarrDir}/`,
        options: {
          mappings: {
            spatial_view: { key: spatialEmbeddingKey, dims: [0, 1] },
          },
        },
        coordinationValues: { obsType: "cell" },
      },
      {
        fileType: "obsSets.anndata.zarr",
        url: `${API_BASE_URL}/${zarrDir}/`,
        options: [
          { name: cellTypeName, path: cellTypePath },
          { name: "Microenvironment", path: "obs/spatial_microenvironment" },
        ],
        coordinationValues: { obsType: "cell" },
      },
      {
        fileType: "obsLocations.anndata.zarr",
        url: `${API_BASE_URL}/${zarrDir}/`,
        options: { path: spatialEmbeddingKey },
        coordinationValues: { obsType: "cell" },
      },
      {
        fileType: "obsSegmentations.json",
        url: `${API_BASE_URL}/${segmentationsFile}`,
        coordinationValues: { obsType: "cell" },
      },
    ];

    const spatialScopes = {
      spatialPointLayer: "SPL1",
      spatialSegmentationLayer: "SSL1",
      obsSetColor: "OSC1",
      obsSetSelection: "OSS1",
      obsColorEncoding: "OCE1",
    };

    return {
      version: "1.0.15",
      name: "CCC Spatial Focus",
      initStrategy: "auto",
      datasets: [{ uid: "ccc-dataset", files }],
      coordinationSpace: {
        embeddingType: { ET1: "spatial_view" },
        obsSetColor: { OSC1: obsSetColor },
        obsSetSelection: {
          OSS1: obsSetSelection.length > 0 ? obsSetSelection : null,
        },
        spatialPointLayer: { SPL1: { visible: true, opacity: 0, radius: 0 } },
        spatialSegmentationLayer: {
          SSL1: {
            opacity: 0.5,
            radius: 1,
            visible: true,
            stroked: true,
            strokedColor: [100, 100, 100],
          },
        },
        obsSetFilter: {
          OSF1:
            selectedMicroenv !== "All"
              ? [["Microenvironment", selectedMicroenv]]
              : null,
        },
        obsColorEncoding: { OCE1: "cellSetSelection" },
      },
      layout: [
        {
          component: "spatial",
          coordinationScopes: { ...spatialScopes, obsSetFilter: "OSF1" },
          x: 0,
          y: 0,
          w: 12,
          h: 12,
        },
      ],
    };
  }, [
    selectedMicroenv,
    cellColorMap,
    datasetConfig,
    spatialKey,
    primaryAnnotation,
    zarrDir,
  ]);

  if (!config)
    return <div className="p-4 text-textMuted">Loading visualization...</div>;

  return (
    <div className="w-full h-full relative border border-borderLight rounded overflow-hidden shadow-inner bg-panel">
      <Vitessce
        key={`vitessce-ccc-${n}-${r}-${selectedMicroenv}`}
        config={config}
        theme="light"
      />
    </div>
  );
}
