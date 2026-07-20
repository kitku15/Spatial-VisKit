import React, { useState, useEffect, useMemo } from "react";
import Plotly from "plotly.js-dist-min";
import factory from "react-plotly.js/factory";
import { DATA_DIR, themeColors, largeColorPalette } from "./config";
import InfoModal from "./InfoModal";
import { tabInfo } from "./infoHelper";

const createPlotlyComponent = typeof factory === "function" ? factory : factory.default;
const Plot = createPlotlyComponent(Plotly);

export default function CompositionAnalysis({ customColors = {} }) {
  const [obsData, setObsData] = useState(null);
  const [availableCols, setAvailableCols] = useState([]);

  // Selections
  const [filterCol, setFilterCol] = useState("None");
  const [filterVal, setFilterVal] = useState("");
  const [xaxisCol, setXaxisCol] = useState("");
  const [breakdownCol, setBreakdownCol] = useState("");

  // Fetch the data
  useEffect(() => {
    fetch(`/${DATA_DIR}/cell_clusters.json`)
      .then((res) => res.json())
      .then((data) => {
        setObsData(data);
        const cols = Object.keys(data).sort();
        setAvailableCols(cols);

        // Set smart defaults if possible
        if (cols.length > 0) {
          setXaxisCol(cols.includes("DiseaseType") ? "DiseaseType" : cols[0]);
          setBreakdownCol(cols.includes("Broad_CellType") ? "Broad_CellType" : cols[0]);
        }
      })
      .catch((err) => console.error("Could not load cell_clusters.json", err));
  }, []);

  // Update Filter Values when Filter Column changes
  const availableFilterVals = useMemo(() => {
    if (!obsData || filterCol === "None") return [];
    return Array.from(new Set(obsData[filterCol])).sort();
  }, [obsData, filterCol]);

  useEffect(() => {
    if (availableFilterVals.length > 0 && !availableFilterVals.includes(filterVal)) {
      setFilterVal(availableFilterVals[0]);
    }
  }, [availableFilterVals, filterVal]);

  // Compute Cross-Tabulation
  const plotData = useMemo(() => {
    if (!obsData || !xaxisCol || !breakdownCol) return null;

    const xArray = obsData[xaxisCol];
    const bArray = obsData[breakdownCol];
    const fArray = filterCol !== "None" ? obsData[filterCol] : null;

    const counts = {};
    const bSet = new Set();
    const xSet = new Set();

    // Loop through all cells
    for (let i = 0; i < xArray.length; i++) {
      // 1. Apply Filter
      if (fArray && fArray[i] !== filterVal) continue;

      const xVal = xArray[i];
      const bVal = bArray[i];

      // Skip NaNs or undefined
      if (!xVal || xVal === "nan" || xVal === "None") continue;

      bSet.add(bVal);
      xSet.add(xVal);

      if (!counts[xVal]) counts[xVal] = {};
      if (!counts[xVal][bVal]) counts[xVal][bVal] = 0;
      counts[xVal][bVal]++;
    }

    const xLabels = Array.from(xSet).sort();
    const bLabels = Array.from(bSet).sort();

    // 2. Normalize by index (Rows sum to 1) and create Plotly Traces
    const traces = bLabels.map((bVal, idx) => {
      const yData = xLabels.map((xVal) => {
        const rowTotal = Object.values(counts[xVal] || {}).reduce((a, b) => a + b, 0);
        return rowTotal === 0 ? 0 : (counts[xVal][bVal] || 0) / rowTotal;
      });

      return {
        x: xLabels,
        y: yData,
        name: bVal,
        type: "bar",
        marker: { color: customColors[bVal] || largeColorPalette[idx % largeColorPalette.length] },
      };
    });

    return traces;
  }, [obsData, xaxisCol, breakdownCol, filterCol, filterVal, customColors]);

  return (
    <div className="p-6 flex flex-col gap-6 h-full bg-app overflow-y-auto">
      {/* Settings Panel */}
      <div className="bg-panel p-4 border border-borderLight shadow-sm rounded flex flex-wrap gap-6 items-center">
        
        {/* Step 1: Filter */}
        <div className="flex gap-2 p-2 border border-borderMain bg-borderLight rounded">
          <label className="text-sm font-semibold flex flex-col gap-1">
            <span className="text-textMuted uppercase tracking-wide text-xs">Filter By (Col A)</span>
            <select
              className="border border-borderMain p-2 rounded outline-none w-48 bg-panel text-textMain focus:border-primary"
              value={filterCol}
              onChange={(e) => setFilterCol(e.target.value)}
            >
              <option value="None">-- No Filter --</option>
              {availableCols.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>

          {filterCol !== "None" && (
            <label className="text-sm font-semibold flex flex-col gap-1">
              <span className="text-primary-dark uppercase tracking-wide text-xs">Filter Category</span>
              <select
                className="border border-primary bg-primary-light text-primary-dark p-2 rounded outline-none w-48 focus:ring-1 focus:ring-primary"
                value={filterVal}
                onChange={(e) => setFilterVal(e.target.value)}
              >
                {availableFilterVals.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </label>
          )}
        </div>

        {/* Step 2: X-Axis */}
        <label className="text-sm font-semibold flex flex-col gap-1">
          <span className="text-textMuted uppercase tracking-wide text-xs">X-Axis Group (Col C)</span>
          <select
            className="border border-borderMain p-2 rounded outline-none w-48 bg-panel text-textMain focus:border-primary"
            value={xaxisCol}
            onChange={(e) => setXaxisCol(e.target.value)}
          >
            {availableCols.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>

        {/* Step 3: Breakdown */}
        <label className="text-sm font-semibold flex flex-col gap-1">
          <span className="text-textMuted uppercase tracking-wide text-xs">Breakdown/Colors (Col B)</span>
          <select
            className="border border-borderMain p-2 rounded outline-none w-48 bg-panel text-textMain focus:border-primary"
            value={breakdownCol}
            onChange={(e) => setBreakdownCol(e.target.value)}
          >
            {availableCols.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>

        <div className="ml-auto flex items-center gap-4">
          <InfoModal title={tabInfo.composition.title} content={tabInfo.composition.content} />
        </div>
      </div>

      {/* Plot Panel */}
      <div className="bg-panel border border-borderLight shadow-sm rounded flex-1 flex flex-col min-h-[500px]">
        <div className="bg-app border-b border-borderLight px-4 py-2">
          <h3 className="font-bold text-sm text-textMain">
            {filterCol !== "None" ? `Proportions of ${breakdownCol} inside ${xaxisCol} (Filtered to ${filterCol} == ${filterVal})` : `Proportions of ${breakdownCol} inside ${xaxisCol}`}
          </h3>
        </div>
        
        <div className="flex-1 relative p-4">
          {!plotData ? (
            <div className="flex h-full items-center justify-center text-textMuted">Loading data...</div>
          ) : (
            <Plot
              data={plotData}
              layout={{
                autosize: true,
                barmode: "stack",
                xaxis: { title: xaxisCol, automargin: true, tickangle: 45 },
                yaxis: { title: "Fraction of cells", range: [0, 1.05] },
                margin: { l: 60, r: 150, t: 20, b: 80 },
                legend: { title: { text: breakdownCol } },
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
  );
}