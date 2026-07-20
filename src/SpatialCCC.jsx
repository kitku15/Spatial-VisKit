import React, { useState, useEffect } from "react";
import VitessceSpatialCCC from "./VitessceSpatialCCC";
import { API_BASE_URL, ZARR_DIR, ANALYSIS_NAME, DATA_DIR, SPATIAL_CCC_PREFIXES  } from "./config";
import InfoModal from "./InfoModal";
import { tabInfo } from "./infoHelper";

export default function SpatialCCC({ n }) {
  const [viewMode, setViewMode] = useState("points");
  const [selectedSlide, setSelectedSlide] = useState("All");
  const [selectedSample, setSelectedSample] = useState("All");

  const [hierarchy, setHierarchy] = useState({});
  const [availableSlides, setAvailableSlides] = useState(["All"]);
  const [availableSamples, setAvailableSamples] = useState(["All"]);

  const [availableInteractions, setAvailableInteractions] = useState([]);
  const [selectedInteraction, setSelectedInteraction] = useState("");

  const [sliderValue, setSliderValue] = useState(0.4);
  const [minColorRange, setMinColorRange] = useState(0.4);

  // 1. Fetch Spatial Hierarchy Metadata
  useEffect(() => {
    async function fetchMetadata() {
      try {
        const res = await fetch(`${API_BASE_URL}/${DATA_DIR}/spatial_metadata_${ANALYSIS_NAME}.json`);
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

  // Update available samples when slide changes
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

  // 2. Fetch Zarr Metadata to find LR_ and CCC_ columns
  useEffect(() => {
    async function fetchInteractions() {
      try {
        const res = await fetch(`${API_BASE_URL}/${ZARR_DIR}/obs/.zattrs`);
        if (!res.ok) return;
        const data = await res.json();
        
        const columns = data["column-order"] || [];
        const interactions = columns.filter((c) => 
          c.startsWith(SPATIAL_CCC_PREFIXES.LR) || c.startsWith(SPATIAL_CCC_PREFIXES.CCC)
        );
        
        setAvailableInteractions(interactions);
        if (interactions.length > 0) {
          setSelectedInteraction(interactions[0]);
        }
      } catch (err) {
        console.warn("Could not load interactions from Zarr", err);
      }
    }
    fetchInteractions();
  }, []);

  return (
    <div className="p-6 flex flex-col gap-6 h-full bg-app">
      {/* Control Panel */}
      <div className="bg-panel p-4 border border-borderLight shadow-sm rounded flex flex-wrap items-center gap-6">
        
        {/* Interaction Dropdown */}
        <label className="text-sm font-semibold flex flex-col">
          <span className="text-primary-dark uppercase tracking-wider text-xs mb-1">
            Spatial Interaction Target
          </span>
          <select
            className="border border-primary bg-primary-light text-primary-dark rounded px-3 py-1.5 font-bold outline-none focus:ring-1 focus:ring-primary w-64 max-w-full"
            value={selectedInteraction}
            onChange={(e) => setSelectedInteraction(e.target.value)}
          >
            {availableInteractions.length === 0 && <option value="">Loading...</option>}
            {availableInteractions.map((intx) => (
              <option key={intx} value={intx}>
                {intx.replace(SPATIAL_CCC_PREFIXES.LR, "Pair: ").replace(SPATIAL_CCC_PREFIXES.CCC, "NMF Factor: ")}
              </option>
            ))}
          </select>
        </label>

        {/* View Mode Toggle */}
        <div className="flex flex-col border-l border-borderMain pl-4">
          <span className="text-textMuted uppercase tracking-wider text-xs mb-1 font-semibold">
            Spatial View
          </span>
          <div className="flex bg-borderLight rounded p-1 border border-borderMain">
            <button
              className={`px-3 py-0.5 rounded text-xs font-bold transition ${viewMode === "points" ? "bg-panel shadow text-primary" : "text-textMuted hover:text-textMain"}`}
              onClick={() => setViewMode("points")}
            >
              Points
            </button>
            <button
              className={`px-3 py-0.5 rounded text-xs font-bold transition ${viewMode === "segmentations" ? "bg-panel shadow text-primary" : "text-textMuted hover:text-textMain"}`}
              onClick={() => setViewMode("segmentations")}
            >
              Polygons
            </button>
          </div>
        </div>

        {/* Slide/Sample Selectors */}
        <div className="flex gap-4 border-l border-borderMain pl-4">
          <label className="text-sm font-semibold flex flex-col gap-1 text-textMain">
            <span className="text-textMuted uppercase tracking-wider text-xs">Slide</span>
            <select
              className="border border-borderMain rounded px-2 py-1 bg-panel font-normal outline-none focus:border-primary"
              value={selectedSlide}
              onChange={handleSlideChange}
            >
              {availableSlides.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold flex flex-col gap-1 text-textMain">
            <span className="text-textMuted uppercase tracking-wider text-xs">Sample</span>
            <select
              className="border border-borderMain rounded px-2 py-1 bg-panel font-normal disabled:opacity-50 outline-none focus:border-primary"
              value={selectedSample}
              onChange={(e) => setSelectedSample(e.target.value)}
              disabled={availableSamples.length <= 1}
            >
              {availableSamples.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>
        </div>

        {/* Threshold Slider */}
        <div className="flex items-center gap-3 border-l border-borderMain pl-4">
          <label className="text-sm font-semibold flex flex-col">
            <span className="text-textMuted uppercase tracking-wider text-xs mb-1">
              Min Color Threshold: {sliderValue}
            </span>
            <input
              type="range"
              min="0"
              max="0.99"
              step="0.01"
              value={sliderValue}
              onChange={(e) => setSliderValue(e.target.value)}
              onMouseUp={() => setMinColorRange(parseFloat(sliderValue))}
              onTouchEnd={() => setMinColorRange(parseFloat(sliderValue))}
              className="cursor-pointer accent-primary"
            />
          </label>
        </div>

        <div className="ml-auto flex items-center">
          <InfoModal title={tabInfo.spatialCcc?.title} content={tabInfo.spatialCcc?.content} />
        </div>
      </div>

      {/* Main Viewer */}
      <div className="flex-1 bg-panel border border-borderLight shadow-sm rounded flex flex-col overflow-hidden relative">
        <div className="bg-app border-b border-borderLight px-4 py-2 flex justify-between items-center z-10">
          <h3 className="font-bold text-sm text-textMain">
            Single-Cell Spatial Interaction Map
          </h3>
          <span className="text-xs text-textMuted">
            Highlighting areas with active {selectedInteraction.replace("LR_", "").replace("CCC_", "Signature ")}
          </span>
        </div>
        <div className="flex-1 relative">
          {!selectedInteraction ? (
            <div className="flex items-center justify-center h-full text-textMuted">
              No LIANA Spatial CCC data found in Zarr store.
            </div>
          ) : (
            <VitessceSpatialCCC
              viewMode={viewMode}
              selectedSlide={selectedSlide}
              selectedSample={selectedSample}
              selectedInteraction={selectedInteraction}
              minColorRange={minColorRange}
            />
          )}
        </div>
      </div>
    </div>
  );
}