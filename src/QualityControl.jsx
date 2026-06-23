import React, { useState, useEffect } from 'react';
import Plotly from 'plotly.js-dist-min';
import factory from 'react-plotly.js/factory';

const createPlotlyComponent = typeof factory === 'function' ? factory : factory.default;
const Plot = createPlotlyComponent(Plotly);

export default function QualityControl() {
  const [histData, setHistData] = useState(null);
  const [thresholds, setThresholds] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const [availableSlides, setAvailableSlides] = useState(["All"]);
  const [selectedSlide, setSelectedSlide] = useState("All");

  useEffect(() => {
    async function fetchData() {
      try {
        const [threshRes, histRes] = await Promise.all([
          fetch('data/qc/qc_thresholds.json'),
          fetch('data/qc/qc_histograms.json')
        ]);
        
        if (threshRes.ok) {
          const tData = await threshRes.json();
          setThresholds(tData);
        }
        if (histRes.ok) {
          const hData = await histRes.json();
          setHistData(hData);
          
          // Extract available slides from the top-level keys of the JSON
          const slides = Object.keys(hData);
          
          // Ensure "All" is always at the top of the dropdown list
          const sortedSlides = ["All", ...slides.filter(s => s !== "All")];
          setAvailableSlides(sortedSlides);
        }
      } catch (err) {
        console.error("Failed to load QC data:", err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, []);

  if (isLoading) return <div className="p-6 text-gray-500">Loading Fast QC Metrics...</div>;
  if (!histData || !thresholds) return <div className="p-6 text-red-600">Failed to load QC JSONs.</div>;

  // Grab the specific data for the selected slide
  const activeHistData = histData[selectedSlide];
  const activeThresholds = thresholds[selectedSlide];

  // Helper to construct a pre-binned bar chart that looks like a histogram
  const makePlot = (metricKey, color, title, threshLines = []) => {
    const d = activeHistData?.[metricKey];
    if (!d) return <div className="text-gray-400 flex items-center justify-center h-full">No data</div>;

    // Remove the last edge to match counts length
    const xBins = d.edges.slice(0, -1);
    
    const shapes = threshLines
      .filter(val => val !== null && val !== undefined)
      .map(val => ({
        type: 'line', x0: val, x1: val, y0: 0, y1: 1, yref: 'paper',
        line: { color: 'red', width: 2, dash: 'dash' }
      }));

    return (
      <Plot
        data={[{ x: xBins, y: d.counts, type: 'bar', marker: { color } }]}
        layout={{
          autosize: true, bargap: 0, 
          margin: { l: 50, r: 20, t: 10, b: 40 },
          xaxis: { title }, yaxis: { title: 'Frequency' },
          shapes
        }}
        useResizeHandler={true} style={{ width: "100%", height: "100%" }}
      />
    );
  };

  return (
    <div className="p-6 flex flex-col gap-6 h-full overflow-y-auto bg-gray-100">
      
      {/* Header and Slide Filter Controls */}
      <div className="bg-white p-4 border shadow-sm rounded flex flex-wrap gap-4 justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Pre-Filter Quality Control Metrics</h2>
          <p className="text-sm text-gray-500">
            Interactive distributions of cell metrics. Red dashed lines indicate cutoff thresholds.
          </p>
        </div>
        
        {/* New Slide Dropdown UI */}
        <label className="text-sm font-semibold flex items-center gap-2">
          <span className="text-gray-600">Slide:</span>
          <select 
            className="border border-gray-400 rounded px-3 py-1.5 bg-white font-normal outline-none focus:border-blue-500" 
            value={selectedSlide} 
            onChange={(e) => setSelectedSlide(e.target.value)}
          >
            {availableSlides.map(s => (
              <option key={s} value={s}>{s === "All" ? "All Slides (Aggregate)" : s}</option>
            ))}
          </select>
        </label>
      </div>

      {/* Plot Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="bg-white p-4 border shadow-sm rounded h-96 flex flex-col">
          <h3 className="font-bold text-gray-700 text-center mb-2">Total Transcripts per Cell</h3>
          <div className="flex-1 min-h-0">{makePlot('total_counts', '#1f77b4', 'Counts', [activeThresholds?.min_counts])}</div>
        </div>

        <div className="bg-white p-4 border shadow-sm rounded h-96 flex flex-col">
          <h3 className="font-bold text-gray-700 text-center mb-2">Unique Genes per Cell</h3>
          <div className="bg-white p-4 border shadow-sm rounded h-96 flex flex-col">
          <div className="flex-1 min-h-0">
            {makePlot('n_genes_by_counts', '#2ca02c', 'Genes', [activeThresholds?.min_genes])}
          </div>
        </div>
        </div>

        <div className="bg-white p-4 border shadow-sm rounded h-96 flex flex-col">
          <h3 className="font-bold text-gray-700 text-center mb-2">Cell Area ({activeThresholds?.area_col})</h3>
          <div className="flex-1 min-h-0">{makePlot('area', '#ff7f0e', 'Area', [activeThresholds?.min_area, activeThresholds?.max_area])}</div>
        </div>

        <div className="bg-white p-4 border shadow-sm rounded h-96 flex flex-col">
          <h3 className="font-bold text-gray-700 text-center mb-2">{activeThresholds?.has_dapi ? 'Mean DAPI' : 'Nucleus Ratio'}</h3>
          <div className="flex-1 min-h-0">{makePlot('nucleus_signal', '#9467bd', 'Signal', [activeThresholds?.min_dapi])}</div>
        </div>
      </div>
    </div>
  );
}