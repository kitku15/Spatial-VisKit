import React, { useState, useEffect } from "react";
import Plotly from "plotly.js-dist-min";
import factory from "react-plotly.js/factory";
import * as d3 from "d3";
import {
  ANALYSIS_NAME,
  largeColorPalette,
  themeColors,
  EXTRA_OBS_SETS,
} from "./config";
import VitessceSpatialStats from "./VitessceSpatialStats";
import InfoModal from "./InfoModal";
import { tabInfo } from "./infoHelper";

const createPlotlyComponent =
  typeof factory === "function" ? factory : factory.default;
const Plot = createPlotlyComponent(Plotly);

export default function SpatialStats({ n, r }) {
  const [activeTab, setActiveTab] = useState("nhood");

  // Lifted state from Vitessce wrapper
  const [activeCategory, setActiveCategory] = useState("Cell Clusters");
  const [spatialViewMode, setSpatialViewMode] = useState("segmentations");

  const [hierarchy, setHierarchy] = useState({});
  const [availableSlides, setAvailableSlides] = useState(["All"]);
  const [availableSamples, setAvailableSamples] = useState(["All"]);
  const [selectedSlide, setSelectedSlide] = useState("All");
  const [selectedSample, setSelectedSample] = useState("All");

  const [nhoodData, setNhoodData] = useState(null);
  const [centralityData, setCentralityData] = useState(null);
  const [pcfData, setPcfData] = useState(null);
  const [moranData, setMoranData] = useState(null);
  const [morphData, setMorphData] = useState(null);

  const [pcfClusterA, setPcfClusterA] = useState("");
  const [pcfClusterB, setPcfClusterB] = useState("");

  const [activeMorphMetric, setActiveMorphMetric] = useState("Area (µm²)");

  useEffect(() => {
    async function fetchMetadata() {
      try {
        const res = await fetch(`data/spatial_metadata_${ANALYSIS_NAME}.json`);
        if (!res.ok) return;
        const data = await res.json();
        setHierarchy(data);
        setAvailableSlides(["All", ...Object.keys(data)]);
      } catch (err) {
        console.warn(
          `Could not load spatial_metadata_${ANALYSIS_NAME}.json`,
          err,
        );
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
    if (!selectedSample || selectedSample === "All") return;

    const basePath = `data/spatial_stats/${selectedSample}`;

    fetch(`${basePath}/nhood_enrichment_${selectedSample}.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setNhoodData(d))
      .catch(() => setNhoodData(null));

    fetch(`${basePath}/centrality_scores_${selectedSample}.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setCentralityData(d))
      .catch(() => setCentralityData(null));

    d3.csv(`${basePath}/moranI_results_${selectedSample}.csv`)
      .then((d) => setMoranData(d))
      .catch(() => setMoranData(null));

    fetch(`${basePath}/cross_pcf_all.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        setPcfData(d);
        if (d && Object.keys(d.pairs).length > 0) {
          const firstPair = Object.keys(d.pairs)[0].split("|");
          setPcfClusterA(firstPair[0]);
          setPcfClusterB(firstPair[1]);
        }
      })
      .catch(() => setPcfData(null));

    d3.csv(`${basePath}/morphometrics.csv`)
      .then((d) => setMorphData(d))
      .catch(() => setMorphData(null));
  }, [selectedSample]);

  const renderNeighborhoods = () => {
    if (!nhoodData)
      return (
        <div className="p-4 text-textMuted">
          Loading or no Neighborhood Enrichment data found.
        </div>
      );
    return (
      <div className="flex-1 w-full h-full p-4">
        <Plot
          data={[
            {
              z: nhoodData.zscores,
              x: nhoodData.clusters,
              y: nhoodData.clusters,
              type: "heatmap",
              colorscale: "RdBu",
              zmid: 0,
            },
          ]}
          layout={{
            title: "Neighborhood Enrichment (Z-Scores)",
            autosize: true,
            xaxis: { tickangle: 45 },
            yaxis: { autorange: "reversed" },
            margin: { l: 100, b: 100 },
            paper_bgcolor: themeColors.paper,
            plot_bgcolor: themeColors.paper,
            font: { color: themeColors.label },
          }}
          useResizeHandler={true}
          style={{ width: "100%", height: "100%" }}
        />
      </div>
    );
  };

  const renderDistances = () => {
    if (!pcfData)
      return (
        <div className="p-4 text-textMuted">
          Loading or no Cross-PCF data found.
        </div>
      );

    const clusters = Array.from(
      new Set(Object.keys(pcfData.pairs).flatMap((k) => k.split("|"))),
    ).sort();
    const pairKey1 = `${pcfClusterA}|${pcfClusterB}`;
    const pairKey2 = `${pcfClusterB}|${pcfClusterA}`;
    const yValues = pcfData.pairs[pairKey1] || pcfData.pairs[pairKey2] || [];

    return (
      <div className="flex flex-col h-full gap-4">
        <div className="flex gap-4 p-4 bg-app border-b border-borderLight items-center">
          <span className="font-semibold text-sm text-textMain uppercase tracking-wide">
            Interaction Pair:
          </span>
          <select
            className="border border-borderMain bg-panel text-textMain p-2 rounded outline-none focus:border-primary"
            value={pcfClusterA}
            onChange={(e) => setPcfClusterA(e.target.value)}
          >
            {clusters.map((c) => (
              <option key={c} value={c}>
                Cluster {c}
              </option>
            ))}
          </select>
          <span className="text-sm text-textMuted font-bold">↔</span>
          <select
            className="border border-borderMain bg-panel text-textMain p-2 rounded outline-none focus:border-primary"
            value={pcfClusterB}
            onChange={(e) => setPcfClusterB(e.target.value)}
          >
            {clusters.map((c) => (
              <option key={c} value={c}>
                Cluster {c}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1 p-4">
          <Plot
            data={[
              {
                x: pcfData.r_distances,
                y: yValues,
                type: "scatter",
                mode: "lines",
                line: { color: themeColors.primary, width: 3 },
              },
            ]}
            layout={{
              title: `Cross-PCF: Cluster ${pcfClusterA} vs Cluster ${pcfClusterB}`,
              autosize: true,
              xaxis: { title: "Radius r (µm)", gridcolor: themeColors.stroke },
              yaxis: {
                title: "g(r)",
                rangemode: "tozero",
                gridcolor: themeColors.stroke,
              },
              shapes: [
                {
                  type: "line",
                  x0: 0,
                  x1: Math.max(...pcfData.r_distances),
                  y0: 1,
                  y1: 1,
                  line: { color: themeColors.danger, dash: "dash", width: 2 },
                },
              ],
              paper_bgcolor: themeColors.paper,
              plot_bgcolor: themeColors.paper,
              font: { color: themeColors.label },
            }}
            useResizeHandler={true}
            style={{ width: "100%", height: "100%" }}
          />
        </div>
      </div>
    );
  };

  const renderMorphometrics = () => {
    if (!morphData || morphData.length === 0)
      return (
        <div className="p-4 text-textMuted">
          Loading or no Morphometrics data found.
        </div>
      );

    const metrics = Object.keys(morphData[0]).filter(
      (k) => k !== "Cell_ID" && k !== "Cluster",
    );
    const uniqueClusters = Array.from(new Set(morphData.map((d) => d.Cluster)))
      .filter(Boolean)
      .sort();

    const violinTraces = uniqueClusters.map((clusterName, index) => {
      const clusterData = morphData.filter((d) => d.Cluster === clusterName);
      const metricValues = clusterData
        .map((d) => parseFloat(d[activeMorphMetric]))
        .filter((v) => !isNaN(v));

      return {
        y: metricValues,
        type: "violin",
        name: `Cluster ${clusterName}`,
        box: { visible: true },
        meanline: { visible: true },
        marker: { color: largeColorPalette[index % largeColorPalette.length] },
      };
    });

    return (
      <div className="flex flex-col h-full gap-4">
        <div className="flex gap-4 p-4 bg-app border-b border-borderLight items-center">
          <span className="font-semibold text-sm text-textMain uppercase tracking-wide">
            Shape Metric:
          </span>
          <select
            className="border border-borderMain bg-panel text-textMain p-2 rounded outline-none focus:border-primary"
            value={activeMorphMetric}
            onChange={(e) => setActiveMorphMetric(e.target.value)}
          >
            {metrics.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <span className="text-xs text-textMuted italic ml-auto">
            * Click legend items to toggle clusters. Double-click to isolate
            one.
          </span>
        </div>
        <div className="flex-1 p-4">
          <Plot
            data={violinTraces}
            layout={{
              title: `Distribution of ${activeMorphMetric} by Cell Type`,
              autosize: true,
              yaxis: { title: activeMorphMetric, zeroline: false },
              xaxis: { title: "Cell Type" },
              showlegend: true,
              legend: { title: { text: "Cell Types" } },
              paper_bgcolor: themeColors.paper,
              plot_bgcolor: themeColors.paper,
              font: { color: themeColors.label },
            }}
            useResizeHandler={true}
            style={{ width: "100%", height: "100%" }}
          />
        </div>
      </div>
    );
  };

  const renderAutocorrelation = () => {
    if (!centralityData && !moranData)
      return (
        <div className="p-4 text-textMuted">
          Loading or no Autocorrelation/Centrality data found.
        </div>
      );

    const centralityTraces = centralityData
      ? Object.keys(centralityData).map((cluster, index) => ({
          x: ["Degree", "Closeness"],
          y: [
            centralityData[cluster]["degree_centrality"],
            centralityData[cluster]["closeness_centrality"],
          ],
          name: `Cluster ${cluster}`,
          type: "bar",
          marker: {
            color: largeColorPalette[index % largeColorPalette.length],
          },
        }))
      : [];

    const moranTraces = moranData
      ? [
          {
            x: moranData.map((d) => parseFloat(d.I)),
            y: moranData.map(
              (d) => -Math.log10(parseFloat(d["pval_sim"]) || 0.0001),
            ),
            text: moranData.map((d) => d[""]),
            mode: "markers",
            type: "scatter",
            marker: {
              color: moranData.map((d) => parseFloat(d.I)),
              colorscale: "Viridis",
              showscale: true,
              size: 8,
            },
          },
        ]
      : [];

    return (
      <div className="flex flex-col h-full gap-4 overflow-auto p-4">
        {centralityData && (
          <div className="h-1/3 border border-borderLight rounded bg-panel shadow-sm flex-shrink-0">
            <Plot
              data={centralityTraces}
              layout={{
                title: "Network Centrality per Cluster",
                barmode: "group",
                autosize: true,
                paper_bgcolor: themeColors.paper,
                plot_bgcolor: themeColors.paper,
                font: { color: themeColors.label },
              }}
              useResizeHandler={true}
              style={{ width: "100%", height: "100%" }}
            />
          </div>
        )}
        {moranData && (
          <div className="h-2/3 border border-borderLight rounded bg-panel shadow-sm flex-shrink-0">
            <Plot
              data={moranTraces}
              layout={{
                title: "Moran's I Spatial Autocorrelation (Genes)",
                xaxis: {
                  title:
                    "Moran's I Statistic (Higher = More spatially patterned)",
                },
                yaxis: { title: "-log10(p-value)" },
                autosize: true,
                paper_bgcolor: themeColors.paper,
                plot_bgcolor: themeColors.paper,
                font: { color: themeColors.label },
              }}
              useResizeHandler={true}
              style={{ width: "100%", height: "100%" }}
            />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="p-6 flex flex-col gap-4 h-full bg-app">
      <div className="bg-panel p-4 border border-borderLight shadow-sm rounded flex flex-col xl:flex-row justify-between items-center gap-4">
        <div className="flex flex-wrap gap-4 items-center">
          <h2 className="text-xl font-bold text-textMain border-r border-borderMain pr-4">
            Spatial Analytics
          </h2>

          <label className="text-sm font-semibold flex items-center gap-2 text-textMain">
            Slide:
            <select
              className="border border-borderMain rounded px-2 py-1 bg-panel font-normal focus:border-primary outline-none"
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
              className="border border-borderMain rounded px-2 py-1 bg-panel font-normal disabled:opacity-50 focus:border-primary outline-none"
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

        {/* --- MOVED VITESSCE CONTROLS UP HERE --- */}
        <div className="flex items-center gap-4 ml-auto flex-wrap justify-end">
          <div className="flex items-center gap-2 border-r border-borderMain pr-4">
            <span className="text-xs font-bold text-textMuted uppercase tracking-wider">
              Spatial Map:
            </span>

            <select
              className="border border-primary rounded px-2 py-1 text-xs bg-primary-light text-primary-dark font-semibold focus:border-primary outline-none"
              value={activeCategory}
              onChange={(e) => setActiveCategory(e.target.value)}
            >
              <option value="Cell Clusters">Cell Clusters</option>
              <option value="CellTypist (Majority Voting)">CellTypist</option>
              <option value="MuSpAn ROI">MuSpAn ROI</option>
              {EXTRA_OBS_SETS.map((s) => (
                <option key={s.name} value={s.name}>
                  {s.name}
                </option>
              ))}
            </select>

            <div className="flex bg-app rounded p-0.5 border border-borderMain">
              <button
                className={`px-2 py-0.5 rounded text-xs font-bold transition ${spatialViewMode === "points" ? "bg-primary-light text-primary-dark shadow-sm" : "text-textMuted hover:text-textMain"}`}
                onClick={() => setSpatialViewMode("points")}
              >
                Points
              </button>
              <button
                className={`px-2 py-0.5 rounded text-xs font-bold transition ${spatialViewMode === "segmentations" ? "bg-primary-light text-primary-dark shadow-sm" : "text-textMuted hover:text-textMain"}`}
                onClick={() => setSpatialViewMode("segmentations")}
              >
                Polygons
              </button>
            </div>
          </div>

          <div className="flex gap-2 bg-borderLight p-1 rounded">
            {[
              { id: "nhood", label: "Neighborhoods" },
              { id: "pcf", label: "Distances (PCF)" },
              { id: "morph", label: "Morphology" },
              { id: "centrality", label: "Autocorrelation" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-1.5 rounded text-sm font-semibold transition ${activeTab === tab.id ? "bg-panel shadow text-primary" : "text-textMuted hover:bg-borderMain hover:text-textMain"}`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <InfoModal
            title={tabInfo.stats.title}
            content={tabInfo.stats.content}
          />
        </div>
      </div>

      {!selectedSample || selectedSample === "All" ? (
        <div className="flex items-center justify-center h-full text-textMuted bg-panel border border-borderLight shadow-sm rounded flex-1">
          <p className="p-6 text-center">
            <span className="text-2xl block mb-2">⚠️</span>
            Spatial Statistics are calculated at the tissue level.
            <br />
            Please select a specific <b>Sample</b> from the dropdown above to
            view statistics.
          </p>
        </div>
      ) : (
        <div className="flex-1 w-full flex gap-4 overflow-hidden">
          <div className="flex-1 min-w-0 bg-panel border border-borderLight shadow-sm rounded flex flex-col overflow-hidden relative">
            {activeTab === "nhood" && renderNeighborhoods()}
            {activeTab === "pcf" && renderDistances()}
            {activeTab === "morph" && renderMorphometrics()}
            {activeTab === "centrality" && renderAutocorrelation()}
          </div>

          <div className="flex-1 min-w-0 border border-borderLight rounded relative bg-panel">
            <VitessceSpatialStats
              n={n}
              r={r}
              selectedSlide={selectedSlide}
              selectedSample={selectedSample}
              activeTab={activeTab}
              activeCategory={activeCategory}
              spatialViewMode={spatialViewMode}
            />
          </div>
        </div>
      )}
    </div>
  );
}
