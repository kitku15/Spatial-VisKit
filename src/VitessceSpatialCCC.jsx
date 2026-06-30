import React, { useMemo } from "react";
import { Vitessce } from "vitessce";
import { API_BASE_URL, ZARR_DIR, SPATIAL_KEY, VITESSCE_DOT_SIZE, DATA_DIR} from "./config";

export default function VitessceSpatialCCC({
  viewMode, // "points" or "segmentations"
  selectedSlide,
  selectedSample,
  selectedInteraction,
  minColorRange,
}) {
  const config = useMemo(() => {
    if (!selectedInteraction) return null;

    let embeddingKey = `obsm/${SPATIAL_KEY}`;
    let segmentationsFile = `/${DATA_DIR}/segmentations/segmentations.json`;

    if (selectedSample !== "All") {
      embeddingKey = `obsm/${SPATIAL_KEY}_${selectedSample}`;
      segmentationsFile = `/${DATA_DIR}/segmentations/segmentations_${selectedSample}.json`;
    } else if (selectedSlide !== "All") {
      embeddingKey = `obsm/${SPATIAL_KEY}_${selectedSlide}`;
      segmentationsFile = `/${DATA_DIR}/segmentations/segmentations_${selectedSlide}.json`;
    }

    const files = [
      {
        fileType: "anndata-cells.zarr",
        url: `${API_BASE_URL}/${ZARR_DIR}/`,
        options: {
          mappings: { current_view: { key: embeddingKey, dims: [0, 1] } },
        },
        coordinationValues: { obsType: "cell" },
      },
      {
        fileType: "anndata.zarr",
        url: `${API_BASE_URL}/${ZARR_DIR}/`,
        options: { 
          // An Array containing an Object with the 'path' key!
          obsFeatureColumns: [
            { path: `obs/${selectedInteraction}` }
          ] 
        },
        coordinationValues: { obsType: "cell" },
      },
    ];

    if (viewMode === "segmentations") {
      files.push({
        fileType: "obsLocations.anndata.zarr",
        url: `${API_BASE_URL}/${ZARR_DIR}/`,
        options: { path: embeddingKey },
        coordinationValues: { obsType: "cell" },
      });
      files.push({
        fileType: "obsSegmentations.json",
        url: `${API_BASE_URL}/${encodeURIComponent(segmentationsFile)}`,
        coordinationValues: { obsType: "cell" },
      });
    }

    const coordinationSpace = {
      embeddingType: { ET1: "current_view" },
      featureSelection: { FS1: [selectedInteraction] },
      obsColorEncoding: { OCE1: "geneSelection" },
      featureValueColormap: { CM1: "plasma" },
      featureValueColormapRange: { CR1: [minColorRange, 1.0] },
      embeddingObsRadiusMode: { RM1: "manual" },
      embeddingObsRadius: { R1: VITESSCE_DOT_SIZE },
      spatialZoom: { SZ1: -2 },
      spatialTargetX: { STX1: 0 },
      spatialTargetY: { STY1: 0 },
    };

    if (viewMode === "segmentations") {
      coordinationSpace.spatialSegmentationLayer = {
        SSL1: {
          opacity: 0.8,
          radius: 1,
          visible: true,
          stroked: true,
          strokedColor: [100, 100, 100],
        },
      };
    }

    return {
      version: "1.0.15",
      name: "Spatial CCC Viewer",
      initStrategy: "auto",
      datasets: [{ uid: "spatial-ccc-dataset", files }],
      coordinationSpace,
      layout: [
        viewMode === "segmentations"
          ? {
              component: "spatial",
              coordinationScopes: {
                spatialSegmentationLayer: "SSL1",
                featureSelection: "FS1",
                obsColorEncoding: "OCE1",
                featureValueColormap: "CM1",
                featureValueColormapRange: "CR1",
              },
              x: 0,
              y: 0,
              w: 9,
              h: 12,
            }
          : {
              component: "scatterplot",
              coordinationScopes: {
                embeddingType: "ET1",
                embeddingObsRadiusMode: "RM1",
                embeddingObsRadius: "R1",
                featureSelection: "FS1",
                obsColorEncoding: "OCE1",
                featureValueColormap: "CM1",
                featureValueColormapRange: "CR1",
              },
              x: 0,
              y: 0,
              w: 9,
              h: 12,
            },
        {
          component: "featureList",
          coordinationScopes: {
            featureSelection: "FS1",
            obsColorEncoding: "OCE1",
          },
          x: 9,
          y: 0,
          w: 3,
          h: 12,
        },
      ],
    };
  }, [viewMode, selectedSlide, selectedSample, selectedInteraction, minColorRange]);

  if (!config) return <div className="p-4 text-textMuted">Loading visualization...</div>;

  return (
    <div className={`w-full h-full relative ${viewMode === "points" ? "flip-spatial-y" : ""}`}>
      <Vitessce
        key={`vitessce-spatial-ccc-${viewMode}-${selectedSlide}-${selectedSample}-${selectedInteraction}`}
        config={config}
        theme="light"
      />
    </div>
  );
}