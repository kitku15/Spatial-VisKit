import React, { useState, useEffect, useMemo } from 'react';
import { Vitessce } from 'vitessce';
import Plotly from 'plotly.js-dist-min';
import factory from 'react-plotly.js/factory';
import { API_BASE_URL, ZARR_DIR, EXTRA_OBS_SETS, SPATIAL_KEY, ANNOTATION_PREFIX, VITESSCE_DOT_SIZE } from './config';

const createPlotlyComponent = typeof factory === 'function' ? factory : factory.default;
const Plot = createPlotlyComponent(Plotly);

const largeColorPalette = [
  "#be84bf", "#ffff34", "#e41c1e", "#b5df6e", "#65c1a4", "#d95e01",
  "#135561", "#984da3", "#ff8045", "#e78ac3", "#2d81b9", "#050582",
  "#ffd92e", "#fb9a74", "#92a5cd", "#e6aa02", "#ff7f00", "#fb9998",
  "#f0027f", "#ff50a7", "#746fb2", "#199d76", "#5c5c0d", "#fc5d5d",
  "#77b975", "#bf5c18", "#36a230", "#4084bb", "#8e2a2a", "#b1df89"
];

const hexToRgb = (hex) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
};

export default function VitessceViewer({ n, r }) {
  const [selectedSlide, setSelectedSlide] = useState("All");
  const [selectedSample, setSelectedSample] = useState("All");
  const [activeCategory, setActiveCategory] = useState("Cell Clusters");

  const [hierarchy, setHierarchy] = useState({});
  const [availableSlides, setAvailableSlides] = useState(["All"]);
  const [availableSamples, setAvailableSamples] = useState(["All"]);

  const [compositionData, setCompositionData] = useState(null);
  const [hoveredSlice, setHoveredSlice] = useState(null);
  const [clickedSlice, setClickedSlice] = useState(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`${API_BASE_URL}/spatial_metadata.json`);
        if (res.ok) {
          const data = await res.json();
          setHierarchy(data);
          setAvailableSlides(["All", ...Object.keys(data)]);
        }

        const compRes = await fetch(`${API_BASE_URL}/cell_composition.json`);
        if (compRes.ok) setCompositionData(await compRes.json());
      } catch (err) {
        console.warn("Could not load Vitessce JSON data", err);
      }
    }
    fetchData();
  }, []);

  useEffect(() => {
    if (Object.keys(hierarchy).length === 0) return;
    if (selectedSlide === "All") {
      setAvailableSamples(["All", ...Object.values(hierarchy).flat()]);
    } else {
      setAvailableSamples(["All", ...(hierarchy[selectedSlide] || [])]);
    }
  }, [selectedSlide, hierarchy]);

  const handleSlideChange = (e) => {
    setSelectedSlide(e.target.value);
    setSelectedSample("All");
  };

  useEffect(() => {
    setClickedSlice(null);
  }, [selectedSlide, selectedSample, n, r, activeCategory]);

  const internalColName = useMemo(() => {
    if (activeCategory === "Cell Clusters") return `leiden_n${n}_r${r}`;
    if (activeCategory === "CellTypist (Majority Voting)") return `CellTypist_majorityvoting_leiden_n${n}_r${r}`;
    const extra = EXTRA_OBS_SETS.find(e => e.name === activeCategory);
    return extra ? extra.path.replace("obs/", "") : "";
  }, [activeCategory, n, r]);

  const currentDataCounts = useMemo(() => {
    if (!compositionData) return null;
    const dataKey = `${selectedSlide}_${selectedSample}`;
    const targetData = compositionData[dataKey] || compositionData["All_All"];
    return targetData[internalColName] || null;
  }, [compositionData, selectedSlide, selectedSample, internalColName]);

  const colorMap = useMemo(() => {
    if (!currentDataCounts) return {};
    const labels = Object.keys(currentDataCounts).sort(); 
    const map = {};
    labels.forEach((label, i) => {
      map[label] = largeColorPalette[i % largeColorPalette.length];
    });
    return map;
  }, [currentDataCounts]);

  const pieChartData = useMemo(() => {
    if (!currentDataCounts) return null;

    const labels = Object.keys(currentDataCounts);
    const values = Object.values(currentDataCounts);

    const colors = labels.map((label) => {
      if (hoveredSlice) return label === hoveredSlice ? colorMap[label] : '#e5e7eb';
      if (clickedSlice) return label === clickedSlice ? colorMap[label] : '#e5e7eb';
      return colorMap[label];
    });

    return [{
      values,
      labels,
      type: 'pie',
      textinfo: 'label+percent',
      hoverinfo: 'label+value+percent',
      marker: { colors },
      sort: false, 
      hole: 0.3 
    }];
  }, [currentDataCounts, colorMap, hoveredSlice, clickedSlice]);

  const config = useMemo(() => {
    let spatialEmbeddingKey = `obsm/${SPATIAL_KEY}`;
    if (selectedSample !== "All") spatialEmbeddingKey = `obsm/${SPATIAL_KEY}_${selectedSample}`;
    else if (selectedSlide !== "All") spatialEmbeddingKey = `obsm/${SPATIAL_KEY}_${selectedSlide}`;

    const obsSetColor = Object.keys(colorMap).map(label => ({
      path: [activeCategory, label],
      color: hexToRgb(colorMap[label])
    }));

    const allObsSets = [
      { name: "Cell Clusters", path: `obs/leiden_n${n}_r${r}` },
      { name: "CellTypist (Majority Voting)", path: `obs/CellTypist_majorityvoting_leiden_n${n}_r${r}` },
      ...EXTRA_OBS_SETS
    ];

    const sortedObsSets = [
      allObsSets.find(set => set.name === activeCategory),
      ...allObsSets.filter(set => set.name !== activeCategory)
    ].filter(Boolean);

    const coordinationSpace = {
      embeddingType: { ET1: "UMAP" }, 
      embeddingObsRadiusMode: { RM1: "manual" },
      embeddingObsRadius: { R1: VITESSCE_DOT_SIZE },
      obsSetColor: { OSC1: obsSetColor },
      spatialZoom: { SZ1: -2 }, 
      spatialTargetX: { STX1: 0 },
      spatialTargetY: { STY1: 0 },
      // ONE SINGLE LAYER FOR CELLS (Controls both Centroid dots and Polygon lines)
      spatialSegmentationLayer: {
        SSL1: {
          opacity: 1,
          radius: 1,    
          visible: true,
          stroked: true,   
          strokedColor: [100, 100, 100]
        }
      }
    };

    const umapScopes = { 
      embeddingType: "ET1", 
      embeddingObsRadiusMode: "RM1", 
      embeddingObsRadius: "R1", 
      obsSetColor: "OSC1" 
    };

    const spatialScopes = { 
      spatialSegmentationLayer: "SSL1",
      obsSetColor: "OSC1" 
    };
    
    const obsSetsScopes = { obsSetColor: "OSC1" };

    if (clickedSlice) {
      coordinationSpace.obsSetSelection = { OSS1: [[activeCategory, clickedSlice]] };
      umapScopes.obsSetSelection = "OSS1";
      spatialScopes.obsSetSelection = "OSS1";
      obsSetsScopes.obsSetSelection = "OSS1";
    }

    return {
      version: "1.0.15",
      name: "Tyler Spatial View",
      initStrategy: "auto",
      datasets: [{
        uid: "my-dataset",
        files: [
          {
            fileType: "anndata-cells.zarr", url: `${API_BASE_URL}/${ZARR_DIR}/`,
            options: { mappings: { UMAP: { key: `obsm/X_umap_n${n}`, dims: [0, 1] } } },
            coordinationValues: { obsType: "cell" }
          },
          {
            // 1. The physical dots (Centroids)
            fileType: "obsLocations.anndata.zarr", 
            url: `${API_BASE_URL}/${ZARR_DIR}/`,
            options: { path: spatialEmbeddingKey },
            coordinationValues: { obsType: "cell" }
          },
          {
            // 2. The physical polygons (Segmentations) 
            // Vitessce merges this with the dots above automatically!
            fileType: "obsSegmentations.json", 
            url: `${API_BASE_URL}/segmentations.json`,
            coordinationValues: { obsType: "cell" }
          },
          {
            fileType: "obsSets.anndata.zarr", url: `${API_BASE_URL}/${ZARR_DIR}/`,
            options: sortedObsSets,
            coordinationValues: { obsType: "cell" }
          },
          { 
            fileType: "obsFeatureMatrix.anndata.zarr", 
            url: `${API_BASE_URL}/${ZARR_DIR}/`, 
            options: { path: "X" },
            coordinationValues: { obsType: "cell" }
          }
        ]
      }],
      coordinationSpace: coordinationSpace,
      layout: [
        { component: "scatterplot", coordinationScopes: umapScopes, x: 0, y: 0, w: 4, h: 12 },
        { component: "spatial", coordinationScopes: spatialScopes, x: 4, y: 0, w: 4, h: 12 },
        { component: "layerController", coordinationScopes: spatialScopes, x: 8, y: 0, w: 4, h: 3 },
        { component: "obsSets", coordinationScopes: obsSetsScopes, x: 8, y: 3, w: 2, h: 4 },
        { component: "featureList", x: 10, y: 3, w: 2, h: 4 }
      ]
    };
  }, [n, r, selectedSlide, selectedSample, clickedSlice, activeCategory, colorMap]);

  return (
    <div className="flex flex-col w-full h-full relative">
      <div className="bg-gray-200 border-b border-gray-400 px-4 py-2 flex gap-6 items-center z-10">
        <span className="font-bold text-sm text-gray-800 uppercase tracking-wide">Spatial Filters:</span>
        
        <label className="text-sm font-semibold flex items-center gap-2">
          Slide:
          <select className="border border-gray-400 rounded px-2 py-1 bg-white font-normal outline-none" value={selectedSlide} onChange={handleSlideChange}>
            {availableSlides.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>

        <label className="text-sm font-semibold flex items-center gap-2">
          Sample:
          <select 
            className="border border-gray-400 rounded px-2 py-1 bg-white font-normal outline-none disabled:bg-gray-100 disabled:text-gray-400"
            value={selectedSample} onChange={(e) => setSelectedSample(e.target.value)} disabled={availableSamples.length <= 1}
          >
            {availableSamples.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>

        <label className="text-sm font-semibold flex items-center gap-2 border-l border-gray-400 pl-6">
          Color By:
          <select 
            className="border border-blue-500 rounded px-2 py-1 bg-blue-50 text-blue-900 font-bold outline-none cursor-pointer"
            value={activeCategory} 
            onChange={(e) => setActiveCategory(e.target.value)}
          >
            <option value="Cell Clusters">Cell Clusters</option>
            <option value="CellTypist (Majority Voting)">CellTypist</option>
            {EXTRA_OBS_SETS.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
          </select>
        </label>
      </div>

      <div className="flex-1 w-full min-h-0 relative">
        <Vitessce
          key={`vitessce-${n}-${r}-${activeCategory}`}
          config={config}
          theme="light"
        />

        <div className="absolute bottom-0 right-0 w-1/3 h-[40%] bg-white z-10 border-t border-l border-gray-300 p-3 flex flex-col shadow-[-4px_-4px_8px_-1px_rgba(0,0,0,0.05)]">
          <div className="flex justify-between items-center mb-2 pb-2 border-b border-gray-100">
            <span className="text-sm font-bold text-gray-700 uppercase tracking-wide">
              Composition: <span className="text-blue-600">{activeCategory}</span>
            </span>
            
            {clickedSlice && (
              <button
                onClick={() => setClickedSlice(null)}
                className="text-xs font-semibold bg-red-100 border border-red-200 text-red-700 px-3 py-1 rounded shadow-sm hover:bg-red-200 transition"
              >
                ✕ Clear Plot Filter: <b>{clickedSlice}</b>
              </button>
            )}
          </div>

          <div className="flex-1 min-h-0 relative">
            {pieChartData ? (
              <Plot
                data={pieChartData}
                layout={{
                  autosize: true,
                  margin: { l: 20, r: 20, t: 10, b: 20 },
                  showlegend: false
                }}
                useResizeHandler={true}
                style={{ width: "100%", height: "100%" }}
                onHover={(data) => setHoveredSlice(data.points[0].label)}
                onUnhover={() => setHoveredSlice(null)}
                onClick={(data) => setClickedSlice(data.points[0].label === clickedSlice ? null : data.points[0].label)}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-sm text-gray-400">Loading composition data...</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}