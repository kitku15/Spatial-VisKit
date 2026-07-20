import React, { useMemo } from "react";
import { Vitessce } from "vitessce";
import { API_BASE_URL, TF_ZARR_DIR, SPATIAL_KEY } from "./config";

export default function VitessceTF({
  viewMode,
  selectedSlide,
  selectedSample,
  n,
  minColorRange,
  embedding,
}) {
  const config = useMemo(() => {
    let embeddingKey = `obsm/${embedding}`;
    if (viewMode === "Spatial") {
      if (selectedSample !== "All")
        embeddingKey = `obsm/${SPATIAL_KEY}_${selectedSample}`;
      else if (selectedSlide !== "All")
        embeddingKey = `obsm/${SPATIAL_KEY}_${selectedSlide}`;
      else embeddingKey = `obsm/${SPATIAL_KEY}`;
    }

    return {
      version: "1.0.15",
      name: "TF Activity Viewer",
      initStrategy: "auto",
      datasets: [
        {
          uid: "tf-dataset",
          files: [
            {
              fileType: "anndata-cells.zarr",
              url: `${API_BASE_URL}/${TF_ZARR_DIR}/`,
              options: {
                mappings: { current_view: { key: embeddingKey, dims: [0, 1] } },
              },
            },
            {
              fileType: "obsFeatureMatrix.anndata.zarr",
              url: `${API_BASE_URL}/${TF_ZARR_DIR}/`,
              options: { path: "X" },
            },
          ],
        },
      ],
      coordinationSpace: {
        embeddingType: { ET1: "current_view" },
        embeddingObsRadiusMode: { RM1: "manual" },
        embeddingObsRadius: { R1: 2.0 },
        featureValueColormap: { CM1: "plasma" },
        featureValueColormapRange: { CR1: [minColorRange, 1.0] },
      },
      layout: [
        {
          component: "scatterplot",
          coordinationScopes: {
            embeddingType: "ET1",
            embeddingObsRadiusMode: "RM1",
            embeddingObsRadius: "R1",
            featureValueColormap: "CM1",
            featureValueColormapRange: "CR1",
          },
          x: 0,
          y: 0,
          w: 9,
          h: 12,
        },
        { component: "featureList", x: 9, y: 0, w: 3, h: 12 },
      ],
    };
  }, [viewMode, selectedSlide, selectedSample, n, minColorRange]);

  return (
    <div
      className={`w-full h-full relative ${viewMode === "Spatial" ? "flip-spatial-y" : ""}`}
    >
      <Vitessce
        key={`vitessce-tf-${viewMode}-${selectedSlide}-${selectedSample}-${n}`}
        config={config}
        theme="light"
      />
    </div>
  );
}
