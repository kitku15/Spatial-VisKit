import { useMemo } from "react";
import { Vitessce } from "vitessce";

export default function VitessceSpatialCCC({
  selectedSlide,
  selectedSample,
  selectedInteraction,
  ligand,
  receptor,
  datasetConfig,
  layoutMode,
}) {
  const spatialKey = datasetConfig?.spatial_key || "global";
  const dataUrl = new URLSearchParams(window.location.search)
    .get("data")
    ?.replace(/\/$/, "");
  const zarrUrl = `${dataUrl}/${datasetConfig?.zarr_filename}`;
  const isLR = Boolean(ligand && receptor);

  const config = useMemo(() => {
    if (!selectedInteraction || !datasetConfig || !dataUrl) return null;

    let embeddingKey = `obsm/${spatialKey}`;
    let segmentationsFile =
      selectedSample !== "All"
        ? `${dataUrl}/aux_data/segmentations/segmentations_${selectedSample}.json`
        : selectedSlide !== "All"
          ? `${dataUrl}/aux_data/segmentations/segmentations_Slide_${selectedSlide}.json`
          : `${dataUrl}/aux_data/segmentations/segmentations.json`;

    const filesScore = [
      {
        fileType: "anndata-cells.zarr",
        url: `${zarrUrl}/`,
        options: {
          mappings: { current_view: { key: embeddingKey, dims: [0, 1] } },
        },
        coordinationValues: { obsType: "cell" },
      },
      {
        fileType: "anndata.zarr",
        url: `${zarrUrl}/`,
        options: {
          obsFeatureColumns: [{ path: `obs/${selectedInteraction}` }],
        },
        coordinationValues: { obsType: "cell" },
      },
      {
        fileType: "obsSets.anndata.zarr",
        url: `${zarrUrl}/`,
        options: [
          { name: "Sample ID", path: "obs/sample_id" },
          { name: "Slide ID", path: "obs/slide_id" },
        ],
        coordinationValues: { obsType: "cell" },
      },
      {
        fileType: "obsSegmentations.json",
        url: segmentationsFile,
        coordinationValues: { obsType: "cell" },
      },
    ];

    const filesGene = [
      {
        fileType: "anndata-cells.zarr",
        url: `${zarrUrl}/`,
        options: {
          mappings: { current_view: { key: embeddingKey, dims: [0, 1] } },
        },
        coordinationValues: { obsType: "cell" },
      },
      {
        fileType: "obsFeatureMatrix.anndata.zarr",
        url: `${zarrUrl}/`,
        options: { path: "X" },
        coordinationValues: { obsType: "cell" },
      },
      {
        fileType: "obsSets.anndata.zarr",
        url: `${zarrUrl}/`,
        options: [
          { name: "Sample ID", path: "obs/sample_id" },
          { name: "Slide ID", path: "obs/slide_id" },
        ],
        coordinationValues: { obsType: "cell" },
      },
      {
        fileType: "obsSegmentations.json",
        url: segmentationsFile,
        coordinationValues: { obsType: "cell" },
      },
    ];

    const coordinationSpace = {
      dataset: {
        DS_SCORE: "dataset-score",
        DS_GENE: "dataset-gene",
      },
      embeddingType: { ET1: "current_view" },
      featureSelection: {
        FS_SCORE: [selectedInteraction],
      },
      obsColorEncoding: {
        OCE_SCORE: "geneSelection",
        OCE_LIGAND: "geneSelection",
        OCE_RECEPTOR: "geneSelection",
      },
      featureValueColormap: {
        CM_SCORE: "plasma",
        CM_LIGAND: "viridis",
        CM_RECEPTOR: "viridis",
      },
      featureValueColormapRange: {
        FVR_SCORE: [0.0, 1.0],
        FVR_LIGAND: [0.0, 1.0],
        FVR_RECEPTOR: [0.0, 1.0],
      },
      obsSetFilter: {
        OSF1:
          selectedSample !== "All"
            ? [["Sample ID", selectedSample]]
            : selectedSlide !== "All"
              ? [["Slide ID", selectedSlide]]
              : null,
      },
      spatialPointLayer: {
        SPL_SCORE: { visible: true, opacity: 0, radius: 0 },
        SPL_LIGAND: { visible: true, opacity: 0, radius: 0 },
        SPL_RECEPTOR: { visible: true, opacity: 0, radius: 0 },
      },
      spatialSegmentationLayer: {
        SSL_SCORE: {
          opacity: 0.8,
          radius: 1,
          visible: true,
          stroked: true,
          strokedColor: [100, 100, 100],
        },
        SSL_LIGAND: {
          opacity: 0.8,
          radius: 1,
          visible: true,
          stroked: true,
          strokedColor: [100, 100, 100],
        },
        SSL_RECEPTOR: {
          opacity: 0.8,
          radius: 1,
          visible: true,
          stroked: true,
          strokedColor: [100, 100, 100],
        },
      },
      spatialZoom: { SZ1: -2 },
      spatialTargetX: { STX1: 0 },
      spatialTargetY: { STY1: 0 },
    };

    if (isLR) {
      coordinationSpace.featureSelection.FS_LIGAND = [ligand];
      coordinationSpace.featureSelection.FS_RECEPTOR = [receptor];
    }

    const scoreScopes = {
      dataset: "DS_SCORE",
      spatialPointLayer: "SPL_SCORE",
      spatialSegmentationLayer: "SSL_SCORE",
      featureSelection: "FS_SCORE",
      obsColorEncoding: "OCE_SCORE",
      featureValueColormap: "CM_SCORE",
      featureValueColormapRange: "FVR_SCORE",
      obsSetFilter: "OSF1",
      spatialZoom: "SZ1",
      spatialTargetX: "STX1",
      spatialTargetY: "STY1",
    };

    const ligandScopes = isLR
      ? {
          dataset: "DS_GENE",
          spatialPointLayer: "SPL_LIGAND",
          spatialSegmentationLayer: "SSL_LIGAND",
          featureSelection: "FS_LIGAND",
          obsColorEncoding: "OCE_LIGAND",
          featureValueColormap: "CM_LIGAND",
          featureValueColormapRange: "FVR_LIGAND",
          obsSetFilter: "OSF1",
          spatialZoom: "SZ1",
          spatialTargetX: "STX1",
          spatialTargetY: "STY1",
        }
      : null;

    const receptorScopes = isLR
      ? {
          dataset: "DS_GENE",
          spatialPointLayer: "SPL_RECEPTOR",
          spatialSegmentationLayer: "SSL_RECEPTOR",
          featureSelection: "FS_RECEPTOR",
          obsColorEncoding: "OCE_RECEPTOR",
          featureValueColormap: "CM_RECEPTOR",
          featureValueColormapRange: "FVR_RECEPTOR",
          obsSetFilter: "OSF1",
          spatialZoom: "SZ1",
          spatialTargetX: "STX1",
          spatialTargetY: "STY1",
        }
      : null;

    const layout = [];

    // 2. BUILD THE GRID DYNAMICALLY BASED ON LAYOUT MODE
    if (isLR) {
      if (layoutMode === "horizontal") {
        // Original layout: Top Interaction, Bottom Left Ligand, Bottom Right Receptor
        layout.push({
          component: "spatial",
          coordinationScopes: scoreScopes,
          x: 0,
          y: 0,
          w: 12,
          h: 6,
          props: {
            title: `Interaction Score: ${selectedInteraction.replace("LR_", "")}`,
          },
        });
        layout.push({
          component: "spatial",
          coordinationScopes: ligandScopes,
          x: 0,
          y: 6,
          w: 6,
          h: 6,
          props: { title: `Ligand Expression: ${ligand}` },
        });
        layout.push({
          component: "spatial",
          coordinationScopes: receptorScopes,
          x: 6,
          y: 6,
          w: 6,
          h: 6,
          props: { title: `Receptor Expression: ${receptor}` },
        });
      } else {
        // New layout: Left Interaction, Top Right Ligand, Bottom Right Receptor
        layout.push({
          component: "spatial",
          coordinationScopes: scoreScopes,
          x: 0,
          y: 0,
          w: 6,
          h: 12,
          props: {
            title: `Interaction Score: ${selectedInteraction.replace("LR_", "")}`,
          },
        });
        layout.push({
          component: "spatial",
          coordinationScopes: ligandScopes,
          x: 6,
          y: 0,
          w: 6,
          h: 6,
          props: { title: `Ligand Expression: ${ligand}` },
        });
        layout.push({
          component: "spatial",
          coordinationScopes: receptorScopes,
          x: 6,
          y: 6,
          w: 6,
          h: 6,
          props: { title: `Receptor Expression: ${receptor}` },
        });
      }
    } else {
      // NMF condition (single big screen)
      layout.push({
        component: "spatial",
        coordinationScopes: scoreScopes,
        x: 0,
        y: 0,
        w: 12,
        h: 12,
        props: {
          title: `NMF Factor Score: ${selectedInteraction.replace("CCC_", "")}`,
        },
      });
    }

    return {
      version: "1.0.15",
      name: "Spatial CCC Viewer",
      initStrategy: "auto",
      datasets: [
        { uid: "dataset-score", files: filesScore },
        { uid: "dataset-gene", files: filesGene },
      ],
      coordinationSpace,
      layout,
    };
  }, [
    selectedSlide,
    selectedSample,
    selectedInteraction,
    ligand,
    receptor,
    datasetConfig,
    spatialKey,
    dataUrl,
    zarrUrl,
    layoutMode,
    isLR,
  ]);

  if (!config)
    return <div className="p-4 text-textMuted">Loading visualization...</div>;

  return (
    <div className="w-full h-full relative">
      <Vitessce
        key={`vitessce-spatial-ccc-${selectedSlide}-${selectedSample}-${selectedInteraction}`}
        config={config}
        theme="light"
      />
    </div>
  );
}
