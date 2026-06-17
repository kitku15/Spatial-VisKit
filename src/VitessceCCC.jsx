// ./VitessceCCC.jsx
import React, { useMemo } from 'react';
import { Vitessce } from 'vitessce';
import { API_BASE_URL, ZARR_DIR, SPATIAL_KEY, ANNOTATION_PREFIX, VITESSCE_DOT_SIZE } from './config';

// Helper to convert D3 Hex colors to RGB arrays for Vitessce
const hexToRgb = (hex) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
};

export default function VitessceCCC({ n, r, selectedMicroenv, cellColorMap }) {
  const config = useMemo(() => {
    // 1. Determine which spatial mask to load based on Microenv (Using config SPATIAL_KEY)
    const spatialEmbeddingKey = selectedMicroenv === "All" 
      ? `obsm/${SPATIAL_KEY}` 
      : `obsm/spatial_microenv_${selectedMicroenv}`;

    // 2. Identify the target AnnData column based on current N and R
    const cellTypeName = "Cell Annotation";
    const cellTypePath = `obs/${ANNOTATION_PREFIX}_n${n}_r${r}`;

    // 3. Map D3 cell colors to Vitessce obsSetColor format
    const obsSetColor = cellColorMap.map(c => ({
      path: [cellTypeName, c.name],
      color: hexToRgb(c.color)
    }));

    // 4. Highlight only the interacting cells (dims everything else out)
    const obsSetSelection = cellColorMap.map(c => [cellTypeName, c.name]);

    return {
      version: "1.0.15",
      name: "CCC Spatial Focus",
      initStrategy: "auto",
      datasets: [
        {
          uid: "ccc-dataset",
          files: [
            {
              fileType: "anndata-cells.zarr",
              url: `${API_BASE_URL}/${ZARR_DIR}/`,
              options: {
                mappings: {
                  spatial_view: {
                    key: spatialEmbeddingKey,
                    dims: [0, 1]
                  }
                }
              }
            },
            {
              fileType: "obsSets.anndata.zarr",
              url: `${API_BASE_URL}/${ZARR_DIR}/`,
              options: [
                { name: cellTypeName, path: cellTypePath },
                { name: "Microenvironment", path: "obs/spatial_microenvironment" }
              ]
            }
          ]
        }
      ],
      coordinationSpace: {
        embeddingType: { ET1: "spatial_view" },
        obsSetColor: { OSC1: obsSetColor },
        obsSetSelection: { OSS1: obsSetSelection.length > 0 ? obsSetSelection : null },
        embeddingObsRadiusMode: { RM1: "manual" },
        embeddingObsOpacityMode: { OM1: "manual" },
        embeddingObsRadius: { ECR1: VITESSCE_DOT_SIZE },   
        embeddingObsOpacity: { ECO1: 1 }  
      },
      layout: [
        {
          component: "scatterplot",
          coordinationScopes: { 
            embeddingType: "ET1",
            obsSetColor: "OSC1",
            obsSetSelection: "OSS1",
            embeddingObsRadiusMode: "RM1",
            embeddingObsOpacityMode: "OM1",
            embeddingObsRadius: "ECR1",
            embeddingObsOpacity: "ECO1"
          },
          x: 0, y: 0, w: 12, h: 12
        }
      ]
    };
  }, [n, r, selectedMicroenv, cellColorMap]);

  return (
    // ADDED 'flip-spatial-y' CLASS HERE
    <div className="w-full h-full relative border border-gray-200 rounded overflow-hidden shadow-inner bg-gray-50 flip-spatial-y">
      <Vitessce config={config} theme="light" />
    </div>
  );
}