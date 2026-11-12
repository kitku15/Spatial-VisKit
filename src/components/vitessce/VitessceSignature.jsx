import { useMemo } from "react";
import { Vitessce } from "vitessce";

export default function VitessceSignature({
  viewMode,
  selectedSlide,
  selectedSample,
  embedding,
  datasetConfig,
  overlayFeature, // { type: "signature" | "gene", value: "Sig_Inflammatory" | "IL6" }
}) {
  const spatialKey = datasetConfig?.spatial_key || "global";
  const dotSize = datasetConfig?.vitessce_dot_size || 2;

  const dataUrl = new URLSearchParams(window.location.search)
    .get("data")
    ?.replace(/\/$/, "");
  const zarrUrl = `${dataUrl}/${datasetConfig?.zarr_filename}`;

  const config = useMemo(() => {
    if (!datasetConfig || !dataUrl) return null;

    const segmentationsFile =
      selectedSample !== "All"
        ? `${dataUrl}/aux_data/segmentations/segmentations_${selectedSample}.json`
        : selectedSlide !== "All"
          ? `${dataUrl}/aux_data/segmentations/segmentations_Slide_${selectedSlide}.json`
          : `${dataUrl}/aux_data/segmentations/segmentations.json`;

    const coordinationSpace = {
      embeddingType: {
        ET_MAIN: viewMode === "Spatial" ? "spatial_view" : "current_view",
      },
      embeddingObsRadiusMode: { RM1: "manual" },
      embeddingObsRadius: { R1: dotSize },
      featureValueColormap: { CM1: "viridis" },

      // Force Vitessce to color by the selected feature
      obsColorEncoding: { OCE1: "geneSelection" },
      featureSelection: { FS1: [overlayFeature.value] },

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
    };

    const sharedScopes = {
      embeddingType: "ET_MAIN",
      embeddingObsRadiusMode: "RM1",
      embeddingObsRadius: "R1",
      featureValueColormap: "CM1",
      obsColorEncoding: "OCE1",
      featureSelection: "FS1",
      spatialPointLayer: "SPL1",
      spatialSegmentationLayer: "SSL1",
    };

    const files = [
      {
        fileType: "obsLocations.anndata.zarr",
        url: `${zarrUrl}/`,
        options: { path: `obsm/${spatialKey}` },
        coordinationValues: { obsType: "cell" },
      },
      {
        fileType: "obsEmbedding.anndata.zarr",
        url: `${zarrUrl}/`,
        options: { path: `obsm/${spatialKey}` },
        coordinationValues: { obsType: "cell", embeddingType: "spatial_view" },
      },
      {
        fileType: "obsEmbedding.anndata.zarr",
        url: `${zarrUrl}/`,
        options: { path: `obsm/${embedding}` },
        coordinationValues: { obsType: "cell", embeddingType: "current_view" },
      },
      {
        fileType: "obsSegmentations.json",
        url: segmentationsFile,
        coordinationValues: { obsType: "cell" },
      },
      {
        fileType: "obsFeatureMatrix.anndata.zarr",
        url: `${zarrUrl}/`,
        options: { path: "X" },
        coordinationValues: { obsType: "cell" },
      },
    ];

    const layout = [];

    // Clean, isolated layout tailored for UMAP vs Spatial.
    // Removed Vitessce featureList because we built the React Signature Inspector!
    if (viewMode === "UMAP") {
      layout.push({
        component: "scatterplot",
        coordinationScopes: sharedScopes,
        x: 0,
        y: 0,
        w: 12,
        h: 12,
        props: { title: "UMAP" },
      });
    } else {
      layout.push({
        component: "spatial",
        coordinationScopes: sharedScopes,
        x: 0,
        y: 0,
        w: 9,
        h: 12,
        props: { title: "Spatial (Segmentations)" },
      });
      layout.push({
        component: "layerController",
        coordinationScopes: sharedScopes,
        x: 9,
        y: 0,
        w: 3,
        h: 12,
        props: { title: "Layers" },
      });
    }

    return {
      version: "1.0.15",
      name: "Signature Viewer",
      initStrategy: "auto",
      datasets: [{ uid: "signature-dataset", files }],
      coordinationSpace,
      layout,
    };
  }, [
    viewMode,
    selectedSlide,
    selectedSample,
    embedding,
    spatialKey,
    dataUrl,
    zarrUrl,
    dotSize,
    overlayFeature,
    datasetConfig,
  ]);

  if (!config) {
    return (
      <div className="p-4 flex items-center justify-center h-full text-textMuted font-bold">
        Loading spatial data...
      </div>
    );
  }

  return (
    <div className="w-full h-full relative border border-borderLight rounded overflow-hidden bg-panel">
      {/* The Key prop forces a clean Vitessce reboot when swapping from Signatures (obs) to Genes (X) */}
      <Vitessce
        key={`vitessce-sig-${viewMode}-${selectedSlide}-${selectedSample}-${overlayFeature.type}-${overlayFeature.value}`}
        config={config}
        theme="light"
      />
    </div>
  );
}
