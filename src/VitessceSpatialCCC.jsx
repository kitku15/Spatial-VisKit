import { useMemo } from "react";
import { Vitessce } from "vitessce";
import { API_BASE_URL, DATA_DIR } from "./config";

export default function VitessceSpatialCCC({
  selectedSlide,
  selectedSample,
  selectedInteraction,
  ligand,
  receptor,
  datasetConfig,
}) {
  const spatialKey = datasetConfig?.spatial_key || "global";
  const zarrDir = `data/${datasetConfig?.zarr_filename}`;

  const config = useMemo(() => {
    if (!selectedInteraction || !datasetConfig) return null;

    let embeddingKey = `obsm/${spatialKey}`;
    let segmentationsFile =
      selectedSample !== "All"
        ? `${DATA_DIR}/segmentations/segmentations_${selectedSample}.json`
        : selectedSlide !== "All"
          ? `${DATA_DIR}/segmentations/segmentations_Slide_${selectedSlide}.json`
          : `${DATA_DIR}/segmentations/segmentations.json`;

    const isLR = Boolean(ligand && receptor);

    // DATASET 1: Interaction Score (uses obsFeatureColumns to read from 'obs')
    const filesScore = [
      {
        fileType: "anndata-cells.zarr",
        url: `${API_BASE_URL}/${zarrDir}/`,
        options: {
          mappings: { current_view: { key: embeddingKey, dims: [0, 1] } },
        },
        coordinationValues: { obsType: "cell" },
      },
      {
        fileType: "anndata.zarr",
        url: `${API_BASE_URL}/${zarrDir}/`,
        options: {
          obsFeatureColumns: [{ path: `obs/${selectedInteraction}` }],
        },
        coordinationValues: { obsType: "cell" },
      },
      {
        fileType: "obsSets.anndata.zarr",
        url: `${API_BASE_URL}/${zarrDir}/`,
        options: [
          { name: "Sample ID", path: "obs/sample_id" },
          { name: "Slide ID", path: "obs/slide_id" },
        ],
        coordinationValues: { obsType: "cell" },
      },
      {
        fileType: "obsSegmentations.json",
        url: `${API_BASE_URL}/${segmentationsFile}`,
        coordinationValues: { obsType: "cell" },
      },
    ];

    // DATASET 2: Ligand and Receptor Expression (uses obsFeatureMatrix to read from 'X')
    const filesGene = [
      {
        fileType: "anndata-cells.zarr",
        url: `${API_BASE_URL}/${zarrDir}/`,
        options: {
          mappings: { current_view: { key: embeddingKey, dims: [0, 1] } },
        },
        coordinationValues: { obsType: "cell" },
      },
      {
        fileType: "obsFeatureMatrix.anndata.zarr",
        url: `${API_BASE_URL}/${zarrDir}/`,
        options: { path: "X" },
        coordinationValues: { obsType: "cell" },
      },
      {
        fileType: "obsSets.anndata.zarr",
        url: `${API_BASE_URL}/${zarrDir}/`,
        options: [
          { name: "Sample ID", path: "obs/sample_id" },
          { name: "Slide ID", path: "obs/slide_id" },
        ],
        coordinationValues: { obsType: "cell" },
      },
      {
        fileType: "obsSegmentations.json",
        url: `${API_BASE_URL}/${segmentationsFile}`,
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
      // Give each panel its own independent colormap
      featureValueColormap: {
        CM_SCORE: "plasma",
        CM_LIGAND: "viridis",
        CM_RECEPTOR: "viridis",
      },
      // EXPLICITLY UNLINK SLIDERS: Give each panel its own independent min/max threshold scope
      featureValueColormapRange: {
        CR_SCORE: [0, 1],
        CR_LIGAND: [0, 1],
        CR_RECEPTOR: [0, 1],
      },
      obsSetFilter: {
        OSF1:
          selectedSample !== "All"
            ? [["Sample ID", selectedSample]]
            : selectedSlide !== "All"
              ? [["Slide ID", selectedSlide]]
              : null,
      },
      spatialPointLayer: { SPL1: { visible: true, opacity: 0, radius: 0 } },
      spatialSegmentationLayer: {
        SSL1: {
          opacity: 0.8,
          radius: 1,
          visible: true,
          stroked: true,
          strokedColor: [100, 100, 100],
        },
      },

      // Kept perfectly synced across all panels
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
      spatialPointLayer: "SPL1",
      spatialSegmentationLayer: "SSL1",
      featureSelection: "FS_SCORE",
      obsColorEncoding: "OCE_SCORE",
      featureValueColormap: "CM_SCORE",
      featureValueColormapRange: "CR_SCORE", // Apply unlinked scopes
      obsSetFilter: "OSF1",
      spatialZoom: "SZ1",
      spatialTargetX: "STX1",
      spatialTargetY: "STY1",
    };

    const ligandScopes = isLR
      ? {
          dataset: "DS_GENE",
          spatialPointLayer: "SPL1",
          spatialSegmentationLayer: "SSL1",
          featureSelection: "FS_LIGAND",
          obsColorEncoding: "OCE_LIGAND",
          featureValueColormap: "CM_LIGAND",
          featureValueColormapRange: "CR_LIGAND", // Apply unlinked scopes
          obsSetFilter: "OSF1",
          spatialZoom: "SZ1",
          spatialTargetX: "STX1",
          spatialTargetY: "STY1",
        }
      : null;

    const receptorScopes = isLR
      ? {
          dataset: "DS_GENE",
          spatialPointLayer: "SPL1",
          spatialSegmentationLayer: "SSL1",
          featureSelection: "FS_RECEPTOR",
          obsColorEncoding: "OCE_RECEPTOR",
          featureValueColormap: "CM_RECEPTOR",
          featureValueColormapRange: "CR_RECEPTOR", // Apply unlinked scopes
          obsSetFilter: "OSF1",
          spatialZoom: "SZ1",
          spatialTargetX: "STX1",
          spatialTargetY: "STY1",
        }
      : null;

    const layout = [];
    if (isLR) {
      // Top Half: Full-width Score view. Bottom Half: Split Ligand & Receptor Views
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
      // 1 Full View for NMF Factors since they don't have distinct Ligand/Receptor
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
    zarrDir,
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
