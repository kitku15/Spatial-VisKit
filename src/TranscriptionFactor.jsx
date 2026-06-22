// ./TranscriptionFactor.jsx
import React, { useState, useEffect } from 'react';
import Plotly from 'plotly.js-dist-min';
import factory from 'react-plotly.js/factory';
import VitessceTF from './VitessceTF';
import { API_BASE_URL, ANALYSIS_NAME } from './config';

const createPlotlyComponent = typeof factory === 'function' ? factory : factory.default;
const Plot = createPlotlyComponent(Plotly);

export default function TranscriptionFactor({ n, r }) {
  // --- UI State ---
  const [viewMode, setViewMode] = useState("UMAP"); // "UMAP" or "Spatial"
  const [selectedSlide, setSelectedSlide] = useState("All");
  const [selectedSample, setSelectedSample] = useState("All");
  
  const [hierarchy, setHierarchy] = useState({});
  const [availableSlides, setAvailableSlides] = useState(["All"]);
  const [availableSamples, setAvailableSamples] = useState(["All"]);

  // --- Heatmap State ---
  const [heatmapData, setHeatmapData] = useState(null);
  const [selectedCellTypes, setSelectedCellTypes] = useState([]);
  const [allCellTypes, setAllCellTypes] = useState([]);

  const [sliderValue, setSliderValue] = useState(0.4);
  const [minColorRange, setMinColorRange] = useState(0.4);

  // Fetch slide/sample metadata
  useEffect(() => {
    async function fetchMetadata() {
      try {
        const res = await fetch(`${API_BASE_URL}/spatial_metadata_${ANALYSIS_NAME}.json`);
        if (!res.ok) return;
        const data = await res.json();
        setHierarchy(data);
        setAvailableSlides(["All", ...Object.keys(data)]);
      } catch (err) {
        console.warn("Could not load spatial_metadata.json", err);
      }
    }
    fetchMetadata();
  }, []);

  // Update samples when slide changes
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

  // Fetch Heatmap JSON
  useEffect(() => {
    async function fetchHeatmap() {
      try {
        const res = await fetch('data/tf_heatmap_data.json');
        if (!res.ok) return;
        const data = await res.json();
        setHeatmapData(data);
        
        // Y axis is now Cell Types! 
        setAllCellTypes(data.y);
        setSelectedCellTypes(data.y); // Select all by default
      } catch (err) {
        console.warn("Could not load tf_heatmap_data.json", err);
      }
    }
    fetchHeatmap();
  }, []);

  // Filter Heatmap based on selected cell types
  const filteredHeatmap = React.useMemo(() => {
    if (!heatmapData) return null;
    
    // Find the indices of the selected cell types in the Y array
    const indicesToKeep = heatmapData.y
      .map((ct, idx) => selectedCellTypes.includes(ct) ? idx : -1)
      .filter(idx => idx !== -1);

    return [{
      type: 'heatmap',
      x: heatmapData.x, // TFs are now on the X axis
      y: indicesToKeep.map(i => heatmapData.y[i]), // Filtered Cell Types on Y axis
      z: indicesToKeep.map(i => heatmapData.z[i]), // Keep only the selected rows of data
      colorscale: 'RdBu',
      reversescale: false, 
      colorbar: { title: 'Z-Scaled Scores' }
    }];
  }, [heatmapData, selectedCellTypes]);

  const toggleCellType = (ct) => {
    if (selectedCellTypes.includes(ct)) {
      setSelectedCellTypes(prev => prev.filter(item => item !== ct));
    } else {
      setSelectedCellTypes(prev => [...prev, ct]);
    }
  };

  return (
    <div className="p-6 flex flex-col gap-6 h-full">
      {/* Settings Bar */}
      <div className="bg-white p-4 border shadow-sm rounded flex flex-wrap items-center gap-6">
        
        <div className="flex bg-gray-200 rounded p-1">
          <button 
            className={`px-4 py-1 rounded text-sm font-semibold transition ${viewMode === 'UMAP' ? 'bg-white shadow' : 'text-gray-600'}`}
            onClick={() => setViewMode('UMAP')}
          >
            UMAP
          </button>
          <button 
            className={`px-4 py-1 rounded text-sm font-semibold transition ${viewMode === 'Spatial' ? 'bg-white shadow' : 'text-gray-600'}`}
            onClick={() => setViewMode('Spatial')}
          >
            Spatial
          </button>
        </div>

        {/* Only show Spatial filters if Spatial mode is active */}
        {viewMode === "Spatial" && (
          <div className="flex gap-4 border-l border-gray-300 pl-4">
            <label className="text-sm font-semibold flex items-center gap-2">
              Slide:
              <select className="border border-gray-400 rounded px-2 py-1 bg-white font-normal" value={selectedSlide} onChange={handleSlideChange}>
                {availableSlides.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <label className="text-sm font-semibold flex items-center gap-2">
              Sample:
              <select className="border border-gray-400 rounded px-2 py-1 bg-white font-normal disabled:opacity-50" value={selectedSample} onChange={(e) => setSelectedSample(e.target.value)} disabled={availableSamples.length <= 1}>
                {availableSamples.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
          </div>
        )}
        {/* SLIDER UI */}
        <div className="flex items-center gap-3 border-l border-gray-300 pl-4">
          <label className="text-sm font-semibold flex flex-col">
            <span className="text-gray-500 uppercase tracking-wider text-xs mb-1">
              Min Color Threshold: {sliderValue}
            </span>
            <input 
              type="range" 
              min="0" 
              max="0.99" 
              step="0.01" 
              value={sliderValue} 
              onChange={(e) => setSliderValue(e.target.value)}
              // Only apply to Vitessce when the user finishes dragging
              onMouseUp={() => setMinColorRange(parseFloat(sliderValue))}
              onTouchEnd={() => setMinColorRange(parseFloat(sliderValue))}
              className="cursor-pointer"
            />
          </label>
        </div>
      </div>

      {/* Main Split Layout */}
      <div className="flex gap-6 flex-1 min-h-0">
        
        {/* Left: Vitessce Explorer */}
        <div className="flex-1 bg-white border shadow-sm rounded flex flex-col overflow-hidden relative">
          <div className="bg-gray-100 border-b px-4 py-2 flex justify-between items-center z-10">
            <h3 className="font-bold text-sm text-gray-700">TF Spatial Explorer</h3>
            <span className="text-xs text-gray-500">Select a TF from the right list to color cells</span>
          </div>
          <div className="flex-1 relative">
            <VitessceTF 
              viewMode={viewMode} 
              selectedSlide={selectedSlide} 
              selectedSample={selectedSample} 
              n={n} 
              minColorRange={minColorRange} 
            />
          </div>
        </div>

        {/* Right: Heatmap */}
        <div className="w-[45%] bg-white border shadow-sm rounded flex flex-col overflow-hidden">
          <div className="bg-gray-100 border-b px-4 py-2">
            <h3 className="font-bold text-sm text-gray-700">TF Enrichment per Cell Type</h3>
          </div>
          
          <div className="p-2 border-b flex gap-2 overflow-x-auto">
            {allCellTypes.map(ct => (
              <button 
                key={ct}
                onClick={() => toggleCellType(ct)}
                className={`flex-shrink-0 text-xs px-2 py-1 rounded border transition ${selectedCellTypes.includes(ct) ? 'bg-blue-100 border-blue-400 text-blue-800' : 'bg-gray-50 border-gray-200 text-gray-400 hover:bg-gray-100'}`}
              >
                {ct}
              </button>
            ))}
          </div>

          <div className="flex-1 p-2 relative flex items-center justify-center">
            {!heatmapData ? (
              <span className="text-gray-400 text-sm">Loading Heatmap Data...</span>
            ) : selectedCellTypes.length === 0 ? (
              <span className="text-gray-400 text-sm">Select at least one cell type above.</span>
            ) : (
              <Plot
                data={filteredHeatmap}
                layout={{
                  autosize: true,
                  margin: { l: 180, r: 20, t: 20, b: 100 },
                  xaxis: { tickangle: 45 },
                  yaxis: { 
                    automargin: true,
                    autorange: 'reversed'
                  }
                }}
                useResizeHandler={true}
                style={{ width: "100%", height: "100%" }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}