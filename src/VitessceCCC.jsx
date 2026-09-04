import React, { useMemo } from "react";
import { Vitessce } from "vitessce";
import {
  API_BASE_URL,
  ZARR_DIR,
  SPATIAL_KEY,
  DATA_DIR,
  MICROENV_PREFIX,
  PRIMARY_ANNOTATION_PREFIX,
} from "./config";

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
}) {
  const config = useMemo(() => {
    const spatialEmbeddingKey = `obsm/${SPATIAL_KEY}`;
    const segmentationsFile =
      selectedMicroenv === "All"
        ? `${DATA_DIR}/segmentations/segmentations.json`
        : `${DATA_DIR}/segmentations/segmentations_microenv_${selectedMicroenv}.json`; 
    const cellTypeName = "Cell Annotation";
    const cellTypePath = `obs/${PRIMARY_ANNOTATION_PREFIX}`;
    const obsSetColor = cellColorMap.map((c) => ({
      path: [cellTypeName, c.name],
      color: hexToRgb(c.color),
    }));
    const obsSetSelection = cellColorMap.map((c) => [cellTypeName, c.name]);

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
        options: [
          { name: cellTypeName, path: cellTypePath },
          { name: "Microenvironment", path: "obs/spatial_microenvironment" },
        ],
        coordinationValues: { obsType: "cell" },
      },
      {
        fileType: "obsLocations.anndata.zarr",
        url: `${API_BASE_URL}/${ZARR_DIR}/`,
        options: { path: spatialEmbeddingKey },
        coordinationValues: { obsType: "cell" },
      },
      {
        fileType: "obsSegmentations.json",
        url: `${API_BASE_URL}/${segmentationsFile}`,
        coordinationValues: { obsType: "cell" },
      }
    ];

    const spatialScopes = {
      spatialPointLayer: "SPL1", 
      spatialSegmentationLayer: "SSL1",
      obsSetColor: "OSC1",
      obsSetSelection: "OSS1",
      obsColorEncoding: "OCE1"
    };

    return {
      version: "1.0.15",
      name: "CCC Spatial Focus",
      initStrategy: "auto",
      datasets: [{ uid: "ccc-dataset", files: files }],
      coordinationSpace: {
        embeddingType: { ET1: "spatial_view" },
        obsSetColor: { OSC1: obsSetColor },
        obsSetSelection: {
          OSS1: obsSetSelection.length > 0 ? obsSetSelection : null,
        },
        spatialPointLayer: {
          SPL1: { visible: true, opacity: 0, radius: 0 },
        },
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
          OSF1: selectedMicroenv !== "All"
            ? [["Microenvironment", selectedMicroenv]]
            : null
        },
        obsColorEncoding: { OCE1: "cellSetSelection" }
      },
      layout: [
        {
          component: "spatial",
          coordinationScopes: { ...spatialScopes, obsSetFilter: "OSF1" },
          x: 0, y: 0, w: 12, h: 12,
        }
      ],
    };
  }, [n, r, selectedMicroenv, cellColorMap]);

  return (
    <div
      className="w-full h-full relative border border-borderLight rounded overflow-hidden shadow-inner bg-panel"
    >
      <Vitessce
        key={`vitessce-ccc-${n}-${r}-${selectedMicroenv}`}
        config={config}
        theme="light"
      />
    </div>
  );
}