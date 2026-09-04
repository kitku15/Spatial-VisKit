import React, { useMemo } from "react";
import { Vitessce } from "vitessce";
import { API_BASE_URL, ZARR_DIR, SPATIAL_KEY, DATA_DIR} from "./config";

export default function VitessceSpatialCCC({
  selectedSlide,
  selectedSample,
  selectedInteraction,
}) {
  const config = useMemo(() => {
    if (!selectedInteraction) return null;

    let embeddingKey = `obsm/${SPATIAL_KEY}`;
    let segmentationsFile = `${DATA_DIR}/segmentations/segmentations.json`;

    if (selectedSample !== "All") {
      segmentationsFile = `${DATA_DIR}/segmentations/segmentations_${selectedSample}.json`;
    } else if (selectedSlide !== "All") {
      segmentationsFile = `${DATA_DIR}/segmentations/segmentations_Slide_${selectedSlide}.json`;
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
          obsFeatureColumns: [
            { path: `obs/${selectedInteraction}` }
          ] 
        },
        coordinationValues: { obsType: "cell" },
      },
      {
        fileType: "obsSets.anndata.zarr",
        url: `${API_BASE_URL}/${ZARR_DIR}/`,
        options: [
          { name: "Sample ID", path: "obs/sample_id" },
          { name: "Slide ID", path: "obs/slide_id" },
          { name: "FOV", path: "obs/fov" },
          { name: "region", path: "obs/region" }
        ],
        coordinationValues: { obsType: "cell" },
      },
      {
        fileType: "obsLocations.anndata.zarr",
        url: `${API_BASE_URL}/${ZARR_DIR}/`,
        options: { path: embeddingKey },
        coordinationValues: { obsType: "cell" },
      },
      {
        fileType: "obsSegmentations.json",
        url: `${API_BASE_URL}/${segmentationsFile}`,
        coordinationValues: { obsType: "cell" },
      }
    ];

    const coordinationSpace = {
      embeddingType: { ET1: "current_view" },
      featureSelection: { FS1: [selectedInteraction] },
      obsColorEncoding: { OCE1: "geneSelection" },
      featureValueColormap: { CM1: "plasma" },
      obsSetFilter: {
        OSF1: selectedSample !== "All"
          ? [["Sample ID", selectedSample]]
          : selectedSlide !== "All"
          ? [["Slide ID", selectedSlide]]
          : null
      },
      spatialPointLayer: {
        SPL1: { visible: true, opacity: 0, radius: 0 }
      },
      spatialSegmentationLayer: {
        SSL1: {
          opacity: 0.8,
          radius: 1,
          visible: true,
          stroked: true,
          strokedColor: [100, 100, 100],
        },
      }
    };

    return {
      version: "1.0.15",
      name: "Spatial CCC Viewer",
      initStrategy: "auto",
      datasets: [{ uid: "spatial-ccc-dataset", files }],
      coordinationSpace,
      layout: [
        {
          component: "spatial",
          coordinationScopes: {
            spatialPointLayer: "SPL1",
            spatialSegmentationLayer: "SSL1",
            featureSelection: "FS1",
            obsColorEncoding: "OCE1",
            featureValueColormap: "CM1",
            obsSetFilter: "OSF1",
          },
          x: 0, y: 0, w: 9, h: 12,
        },
        {
          component: "layerController",
          coordinationScopes: {
            spatialPointLayer: "SPL1",
            spatialSegmentationLayer: "SSL1",
            featureSelection: "FS1",
            obsColorEncoding: "OCE1",
            featureValueColormap: "CM1",
            obsSetFilter: "OSF1",
          },
          x: 9, y: 0, w: 3, h: 6,
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
  }, [selectedSlide, selectedSample, selectedInteraction]);

  if (!config) return <div className="p-4 text-textMuted">Loading visualization...</div>;

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