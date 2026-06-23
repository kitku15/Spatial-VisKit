import React, { useState, useMemo } from 'react';
import { Vitessce } from 'vitessce';
import { API_BASE_URL, ZARR_DIR, SPATIAL_KEY, ANNOTATION_PREFIX, VITESSCE_DOT_SIZE } from './config';

const hexToRgb = (hex) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
};

export default function VitessceCCC({ n, r, selectedMicroenv, cellColorMap }) {
  const [spatialViewMode, setSpatialViewMode] = useState("points");

  const config = useMemo(() => {
    const spatialEmbeddingKey = selectedMicroenv === "All" ? `obsm/${SPATIAL_KEY}` : `obsm/spatial_microenv_${selectedMicroenv}`;
    const segmentationsFile = selectedMicroenv === "All" ? `segmentations/segmentations.json` : `segmentations/segmentations_microenv_${selectedMicroenv}.json`;
    const cellTypeName = "Cell Annotation";
    const cellTypePath = `obs/${ANNOTATION_PREFIX}_n${n}_r${r}`;
    const obsSetColor = cellColorMap.map(c => ({ path: [cellTypeName, c.name], color: hexToRgb(c.color) }));
    const obsSetSelection = cellColorMap.map(c => [cellTypeName, c.name]);

    const files = [
      { fileType: "anndata-cells.zarr", url: `${API_BASE_URL}/${ZARR_DIR}/`, options: { mappings: { spatial_view: { key: spatialEmbeddingKey, dims: [0, 1] } } }, coordinationValues: { obsType: "cell" } },
      { fileType: "obsSets.anndata.zarr", url: `${API_BASE_URL}/${ZARR_DIR}/`, options: [ { name: cellTypeName, path: cellTypePath }, { name: "Microenvironment", path: "obs/spatial_microenvironment" } ], coordinationValues: { obsType: "cell" } }
    ];

    if (spatialViewMode === "segmentations") {
      files.push({ fileType: "obsLocations.anndata.zarr", url: `${API_BASE_URL}/${ZARR_DIR}/`, options: { path: spatialEmbeddingKey }, coordinationValues: { obsType: "cell" } });
      files.push({ fileType: "obsSegmentations.json", url: `${API_BASE_URL}/${encodeURIComponent(segmentationsFile)}`, coordinationValues: { obsType: "cell" } });
    }

    const pointScopes = { embeddingType: "ET1", obsSetColor: "OSC1", obsSetSelection: "OSS1", embeddingObsRadiusMode: "RM1", embeddingObsOpacityMode: "OM1", embeddingObsRadius: "ECR1", embeddingObsOpacity: "ECO1" };
    const spatialScopes = { spatialSegmentationLayer: "SSL1", obsSetColor: "OSC1", obsSetSelection: "OSS1" };

    return {
      version: "1.0.15", name: "CCC Spatial Focus", initStrategy: "auto",
      datasets: [{ uid: "ccc-dataset", files: files }],
      coordinationSpace: {
        embeddingType: { ET1: "spatial_view" }, obsSetColor: { OSC1: obsSetColor }, obsSetSelection: { OSS1: obsSetSelection.length > 0 ? obsSetSelection : null },
        embeddingObsRadiusMode: { RM1: "manual" }, embeddingObsOpacityMode: { OM1: "manual" }, embeddingObsRadius: { ECR1: VITESSCE_DOT_SIZE }, embeddingObsOpacity: { ECO1: 1 },
        spatialZoom: { SZ1: -2 }, spatialTargetX: { STX1: 0 }, spatialTargetY: { STY1: 0 },
        spatialSegmentationLayer: { SSL1: { opacity: 0.5, radius: 1, visible: true, stroked: true, strokedColor: [100, 100, 100] } }
      },
      layout: [
        spatialViewMode === "segmentations" ? { component: "spatial", coordinationScopes: spatialScopes, x: 0, y: 0, w: 12, h: 12 } : { component: "scatterplot", coordinationScopes: pointScopes, x: 0, y: 0, w: 12, h: 12 }
      ]
    };
  }, [n, r, selectedMicroenv, cellColorMap, spatialViewMode]);

  return (
    <div className={`w-full h-full relative border border-borderLight rounded overflow-hidden shadow-inner bg-panel ${spatialViewMode === 'points' ? 'flip-spatial-y' : ''}`}>
      <div className="absolute top-0.5 right-5 z-10 flex bg-panel/90 rounded p-1 shadow border border-borderMain backdrop-blur-sm">
        <button className={`px-3 py-1 rounded text-xs font-bold transition ${spatialViewMode === 'points' ? 'bg-primary-light text-primary-dark shadow-sm' : 'text-textMuted hover:text-textMain'}`} onClick={() => setSpatialViewMode('points')}>Points</button>
        <button className={`px-3 py-1 rounded text-xs font-bold transition ${spatialViewMode === 'segmentations' ? 'bg-primary-light text-primary-dark shadow-sm' : 'text-textMuted hover:text-textMain'}`} onClick={() => setSpatialViewMode('segmentations')}>Polygons</button>
      </div>
      <Vitessce key={`vitessce-ccc-${n}-${r}-${selectedMicroenv}-${spatialViewMode}`} config={config} theme="light" />
    </div>
  );
}