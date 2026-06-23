import React, { useState, useEffect } from "react";
import Plotly from "plotly.js-dist-min";
import factory from "react-plotly.js/factory";
import InfoModal from "./InfoModal";
import { tabInfo } from "./infoHelper";
import { themeColors } from "./config";

const createPlotlyComponent =
  typeof factory === "function" ? factory : factory.default;
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
          fetch("data/qc/qc_thresholds.json"),
          fetch("data/qc/qc_histograms.json"),
        ]);

        if (threshRes.ok) {
          const tData = await threshRes.json();
          setThresholds(tData);
        }
        if (histRes.ok) {
          const hData = await histRes.json();
          setHistData(hData);

          const slides = Object.keys(hData);
          const sortedSlides = ["All", ...slides.filter((s) => s !== "All")];
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

  if (isLoading)
    return <div className="p-6 text-textMuted">Loading Fast QC Metrics...</div>;
  if (!histData || !thresholds)
    return <div className="p-6 text-danger">Failed to load QC JSONs.</div>;

  const activeHistData = histData[selectedSlide];
  const activeThresholds = thresholds[selectedSlide];

  const makePlot = (metricKey, color, title, threshLines = []) => {
    const d = activeHistData?.[metricKey];
    if (!d)
      return (
        <div className="text-textMuted flex items-center justify-center h-full">
          No data
        </div>
      );

    const xBins = d.edges.slice(0, -1);

    const shapes = threshLines
      .filter((val) => val !== null && val !== undefined)
      .map((val) => ({
        type: "line",
        x0: val,
        x1: val,
        y0: 0,
        y1: 1,
        yref: "paper",
        line: { color: themeColors.danger, width: 2, dash: "dash" },
      }));

    return (
      <Plot
        data={[{ x: xBins, y: d.counts, type: "bar", marker: { color } }]}
        layout={{
          autosize: true,
          bargap: 0,
          margin: { l: 50, r: 20, t: 10, b: 40 },
          xaxis: { title },
          yaxis: { title: "Frequency" },
          shapes,
          paper_bgcolor: themeColors.paper,
          plot_bgcolor: themeColors.paper,
          font: { color: themeColors.label },
        }}
        useResizeHandler={true}
        style={{ width: "100%", height: "100%" }}
      />
    );
  };

  return (
    <div className="p-6 flex flex-col gap-6 h-full overflow-y-auto bg-app">
      <div className="bg-panel p-4 border border-borderLight shadow-sm rounded flex flex-wrap gap-4 justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-textMain">
            Pre-Filter Quality Control Metrics
          </h2>
          <p className="text-sm text-textMuted">
            Distributions of raw cell metrics. Red dashed lines indicate cutoff
            thresholds.
          </p>
        </div>

        <div className="flex items-center gap-4">
          <label className="text-sm font-semibold flex items-center gap-2">
            <span className="text-textMuted">Slide:</span>
            <select
              className="border border-borderMain rounded px-3 py-1.5 bg-panel text-textMain font-normal outline-none focus:border-primary"
              value={selectedSlide}
              onChange={(e) => setSelectedSlide(e.target.value)}
            >
              {availableSlides.map((s) => (
                <option key={s} value={s}>
                  {s === "All" ? "All Slides (Aggregate)" : s}
                </option>
              ))}
            </select>
          </label>

          <InfoModal title={tabInfo.qc.title} content={tabInfo.qc.content} />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="bg-panel p-4 border border-borderLight shadow-sm rounded h-96 flex flex-col">
          <h3 className="font-bold text-textMain text-center mb-2">
            Total Transcripts per Cell
          </h3>
          <div className="flex-1 min-h-0">
            {makePlot("total_counts", themeColors.primary, "Counts", [
              activeThresholds?.min_counts,
            ])}
          </div>
        </div>

        <div className="bg-panel p-4 border border-borderLight shadow-sm rounded h-96 flex flex-col">
          <h3 className="font-bold text-textMain text-center mb-2">
            Unique Genes per Cell
          </h3>
          <div className="flex-1 min-h-0">
            {makePlot("n_genes_by_counts", themeColors.success, "Genes", [
              activeThresholds?.min_genes,
            ])}
          </div>
        </div>

        <div className="bg-panel p-4 border border-borderLight shadow-sm rounded h-96 flex flex-col">
          <h3 className="font-bold text-textMain text-center mb-2">
            Cell Area ({activeThresholds?.area_col})
          </h3>
          <div className="flex-1 min-h-0">
            {makePlot("area", themeColors.warning, "Area", [
              activeThresholds?.min_area,
              activeThresholds?.max_area,
            ])}
          </div>
        </div>

        <div className="bg-panel p-4 border border-borderLight shadow-sm rounded h-96 flex flex-col">
          <h3 className="font-bold text-textMain text-center mb-2">
            {activeThresholds?.has_dapi ? "Mean DAPI" : "Nucleus Ratio"}
          </h3>
          <div className="flex-1 min-h-0">
            {makePlot("nucleus_signal", themeColors.info, "Signal", [
              activeThresholds?.min_dapi,
            ])}
          </div>
        </div>
      </div>
    </div>
  );
}
