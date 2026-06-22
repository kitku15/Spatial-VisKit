// ./VitessceCCC.jsx
import React, { useState, useMemo } from 'react';
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
  // Toggle View Mode: "points" or "segmentations"
  const [spatialViewMode, setSpatialViewMode] = useState("points");

  const config = useMemo(() => {
    // 1. Determine which spatial mask to load based on Microenv
    const spatialEmbeddingKey = selectedMicroenv === "All" 
      ? `obsm/${SPATIAL_KEY}` 
      : `obsm/spatial_microenv_${selectedMicroenv}`;

    // 2. Determine which specific segmentations file to load
    const segmentationsFile = selectedMicroenv === "All"
      ? `segmentations/segmentations.json`
      : `segmentations/segmentations_microenv_${selectedMicroenv}.json`;

    // 3. Identify the target AnnData column based on current N and R
    const cellTypeName = "Cell Annotation";
    const cellTypePath = `obs/${ANNOTATION_PREFIX}_n${n}_r${r}`;

    // 4. Map D3 cell colors to Vitessce obsSetColor format
    const obsSetColor = cellColorMap.map(c => ({
      path: [cellTypeName, c.name],
      color: hexToRgb(c.color)
    }));

    // 5. Highlight only the interacting cells (dims everything else out)
    const obsSetSelection = cellColorMap.map(c => [cellTypeName, c.name]);

    // Base files array
    const files = [
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
        },
        coordinationValues: { obsType: "cell" }
      },
      {
        fileType: "obsSets.anndata.zarr",
        url: `${API_BASE_URL}/${ZARR_DIR}/`,
        options: [
          { name: cellTypeName, path: cellTypePath },
          { name: "Microenvironment", path: "obs/spatial_microenvironment" }
        ],
        coordinationValues: { obsType: "cell" }
      }
    ];

    // Conditionally load segmentations ONLY if Polygons are selected
    if (spatialViewMode === "segmentations") {
      files.push({
        fileType: "obsLocations.anndata.zarr", 
        url: `${API_BASE_URL}/${ZARR_DIR}/`,
        options: { path: spatialEmbeddingKey },
        coordinationValues: { obsType: "cell" }
      });
      files.push({
        fileType: "obsSegmentations.json", 
        url: `${API_BASE_URL}/${encodeURIComponent(segmentationsFile)}`,
        coordinationValues: { obsType: "cell" }
      });
    }

    // Define Scopes
    const pointScopes = { 
      embeddingType: "ET1",
      obsSetColor: "OSC1",
      obsSetSelection: "OSS1",
      embeddingObsRadiusMode: "RM1",
      embeddingObsOpacityMode: "OM1",
      embeddingObsRadius: "ECR1",
      embeddingObsOpacity: "ECO1"
    };

    const spatialScopes = { 
      spatialSegmentationLayer: "SSL1", 
      obsSetColor: "OSC1",
      obsSetSelection: "OSS1"
    };

    return {
      version: "1.0.15",
      name: "CCC Spatial Focus",
      initStrategy: "auto",
      datasets: [{ uid: "ccc-dataset", files: files }],
      coordinationSpace: {
        embeddingType: { ET1: "spatial_view" },
        obsSetColor: { OSC1: obsSetColor },
        obsSetSelection: { OSS1: obsSetSelection.length > 0 ? obsSetSelection : null },
        embeddingObsRadiusMode: { RM1: "manual" },
        embeddingObsOpacityMode: { OM1: "manual" },
        embeddingObsRadius: { ECR1: VITESSCE_DOT_SIZE },   
        embeddingObsOpacity: { ECO1: 1 },
        spatialZoom: { SZ1: -2 }, 
        spatialTargetX: { STX1: 0 },
        spatialTargetY: { STY1: 0 },
        spatialSegmentationLayer: {
          SSL1: {
            opacity: 0.5, radius: 1, visible: true, stroked: true, strokedColor: [100, 100, 100]
          }
        }
      },
      layout: [
        spatialViewMode === "segmentations"
          ? { component: "spatial", coordinationScopes: spatialScopes, x: 0, y: 0, w: 12, h: 12 }
          : { component: "scatterplot", coordinationScopes: pointScopes, x: 0, y: 0, w: 12, h: 12 }
      ]
    };
  }, [n, r, selectedMicroenv, cellColorMap, spatialViewMode]);

  return (
    // DYNAMIC CSS FLIP: If points mode is active, apply the global CSS flip to correct Y-axis
    <div className={`w-full h-full relative border border-gray-200 rounded overflow-hidden shadow-inner bg-gray-50 ${spatialViewMode === 'points' ? 'flip-spatial-y' : ''}`}>
      
      {/* Floating Toggle View Mode UI */}
      <div className="absolute top-0.5 right-5 z-10 flex bg-white/90 rounded p-1 shadow border border-gray-300 backdrop-blur-sm">
        <button 
          className={`px-3 py-1 rounded text-xs font-bold transition ${spatialViewMode === 'points' ? 'bg-blue-100 text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
          onClick={() => setSpatialViewMode('points')}
        >
          Points
        </button>
        <button 
          className={`px-3 py-1 rounded text-xs font-bold transition ${spatialViewMode === 'segmentations' ? 'bg-blue-100 text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
          onClick={() => setSpatialViewMode('segmentations')}
        >
          Polygons
        </button>
      </div>

      <Vitessce 
        // CRITICAL: Force remount by adding view mode and microenv to key
        key={`vitessce-ccc-${n}-${r}-${selectedMicroenv}-${spatialViewMode}`} 
        config={config} 
        theme="light" 
      />
    </div>
  );
}