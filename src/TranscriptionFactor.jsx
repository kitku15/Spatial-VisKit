import React, { useState, useEffect } from "react";
import Plotly from "plotly.js-dist-min";
import factory from "react-plotly.js/factory";
import VitessceTF from "./VitessceTF";
import { API_BASE_URL, ANALYSIS_NAME, DATA_DIR, themeColors  } from "./config";
import InfoModal from "./InfoModal";
import { tabInfo } from "./infoHelper";

const createPlotlyComponent =
  typeof factory === "function" ? factory : factory.default;
const Plot = createPlotlyComponent(Plotly);

export default function TranscriptionFactor({ n, r }) {
  const [viewMode, setViewMode] = useState("UMAP");
  const [selectedSlide, setSelectedSlide] = useState("All");
  const [selectedSample, setSelectedSample] = useState("All");

  const [hierarchy, setHierarchy] = useState({});
  const [availableSlides, setAvailableSlides] = useState(["All"]);
  const [availableSamples, setAvailableSamples] = useState(["All"]);

  const [heatmapData, setHeatmapData] = useState(null);
  const [selectedCellTypes, setSelectedCellTypes] = useState([]);
  const [allCellTypes, setAllCellTypes] = useState([]);

  const [sliderValue, setSliderValue] = useState(0.4);
  const [minColorRange, setMinColorRange] = useState(0.4);

  useEffect(() => {
    async function fetchMetadata() {
      try {
        const res = await fetch(`/${DATA_DIR}/spatial_metadata_${ANALYSIS_NAME}.json`);
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
    async function fetchHeatmap() {
      try {
        const res = await fetch(`/${DATA_DIR}/tf_heatmap_data.json`);
        if (!res.ok) return;
        const data = await res.json();
        setHeatmapData(data);

        setAllCellTypes(data.y);
        setSelectedCellTypes(data.y);
      } catch (err) {
        console.warn("Could not load tf_heatmap_data.json", err);
      }
    }
    fetchHeatmap();
  }, []);

  const filteredHeatmap = React.useMemo(() => {
    if (!heatmapData) return null;

    const indicesToKeep = heatmapData.y
      .map((ct, idx) => (selectedCellTypes.includes(ct) ? idx : -1))
      .filter((idx) => idx !== -1);

    return [
      {
        type: "heatmap",
        x: heatmapData.x,
        y: indicesToKeep.map((i) => heatmapData.y[i]),
        z: indicesToKeep.map((i) => heatmapData.z[i]),
        colorscale: "RdBu",
        reversescale: false,
        colorbar: { title: "Z-Scaled Scores" },
      },
    ];
  }, [heatmapData, selectedCellTypes]);

  const toggleCellType = (ct) => {
    if (selectedCellTypes.includes(ct)) {
      setSelectedCellTypes((prev) => prev.filter((item) => item !== ct));
    } else {
      setSelectedCellTypes((prev) => [...prev, ct]);
    }
  };

  return (
    <div className="p-6 flex flex-col gap-6 h-full bg-app">
      <div className="bg-panel p-4 border border-borderLight shadow-sm rounded flex flex-wrap items-center gap-6">
        <div className="flex bg-borderLight rounded p-1">
          <button
            className={`px-4 py-1 rounded text-sm font-semibold transition ${viewMode === "UMAP" ? "bg-panel shadow text-primary" : "text-textMuted hover:text-textMain"}`}
            onClick={() => setViewMode("UMAP")}
          >
            UMAP
          </button>
          <button
            className={`px-4 py-1 rounded text-sm font-semibold transition ${viewMode === "Spatial" ? "bg-panel shadow text-primary" : "text-textMuted hover:text-textMain"}`}
            onClick={() => setViewMode("Spatial")}
          >
            Spatial
          </button>
        </div>

        {viewMode === "Spatial" && (
          <div className="flex gap-4 border-l border-borderMain pl-4">
            <label className="text-sm font-semibold flex items-center gap-2 text-textMain">
              Slide:
              <select
                className="border border-borderMain rounded px-2 py-1 bg-panel font-normal outline-none focus:border-primary"
                value={selectedSlide}
                onChange={handleSlideChange}
              >
                {availableSlides.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-semibold flex items-center gap-2 text-textMain">
              Sample:
              <select
                className="border border-borderMain rounded px-2 py-1 bg-panel font-normal disabled:opacity-50 outline-none focus:border-primary"
                value={selectedSample}
                onChange={(e) => setSelectedSample(e.target.value)}
                disabled={availableSamples.length <= 1}
              >
                {availableSamples.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

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
          <InfoModal title={tabInfo.tf.title} content={tabInfo.tf.content} />
        </div>
      </div>

      <div className="flex gap-6 flex-1 min-h-0">
        <div className="flex-1 bg-panel border border-borderLight shadow-sm rounded flex flex-col overflow-hidden relative">
          <div className="bg-app border-b border-borderLight px-4 py-2 flex justify-between items-center z-10">
            <h3 className="font-bold text-sm text-textMain">
              TF Spatial Explorer
            </h3>
            <span className="text-xs text-textMuted">
              Select a TF from the right list to color cells
            </span>
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

        <div className="w-[45%] bg-panel border border-borderLight shadow-sm rounded flex flex-col overflow-hidden">
          <div className="bg-app border-b border-borderLight px-4 py-2">
            <h3 className="font-bold text-sm text-textMain">
              TF Enrichment per Cell Type
            </h3>
          </div>

          <div className="p-2 border-b border-borderLight flex gap-2 overflow-x-auto">
            {allCellTypes.map((ct) => (
              <button
                key={ct}
                onClick={() => toggleCellType(ct)}
                className={`flex-shrink-0 text-xs px-2 py-1 rounded border transition ${selectedCellTypes.includes(ct) ? "bg-primary-light border-primary text-primary-dark" : "bg-app border-borderLight text-textMuted hover:bg-borderLight"}`}
              >
                {ct}
              </button>
            ))}
          </div>

          <div className="flex-1 p-2 relative flex items-center justify-center">
            {!heatmapData ? (
              <span className="text-textMuted text-sm">
                Loading Heatmap Data...
              </span>
            ) : selectedCellTypes.length === 0 ? (
              <span className="text-textMuted text-sm">
                Select at least one cell type above.
              </span>
            ) : (
              <Plot
                data={filteredHeatmap}
                layout={{
                  autosize: true,
                  margin: { l: 180, r: 20, t: 20, b: 100 },
                  xaxis: { tickangle: 45 },
                  yaxis: { automargin: true, autorange: "reversed" },
                  paper_bgcolor: themeColors.paper,
                  plot_bgcolor: themeColors.paper,
                  font: { color: themeColors.label },
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
