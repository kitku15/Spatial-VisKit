// ./SpatialStats.jsx
import React, { useState, useEffect } from 'react';
import Plotly from 'plotly.js-dist-min';
import factory from 'react-plotly.js/factory';
import * as d3 from 'd3';
import { ANALYSIS_NAME, largeColorPalette } from './config';
import VitessceSpatialStats from './VitessceSpatialStats'; // IMPORT NEW COMPONENT

const createPlotlyComponent = typeof factory === 'function' ? factory : factory.default;
const Plot = createPlotlyComponent(Plotly);

// ADD PROPS n AND r HERE
export default function SpatialStats({ n, r }) {
  const [activeTab, setActiveTab] = useState("nhood");
  
  // --- Slide & Sample Selection State ---
  const [hierarchy, setHierarchy] = useState({});
  const [availableSlides, setAvailableSlides] = useState(["All"]);
  const [availableSamples, setAvailableSamples] = useState(["All"]);
  const [selectedSlide, setSelectedSlide] = useState("All");
  const [selectedSample, setSelectedSample] = useState("All");

  // --- Data states ---
  const [nhoodData, setNhoodData] = useState(null);
  const [centralityData, setCentralityData] = useState(null);
  const [pcfData, setPcfData] = useState(null);
  const [moranData, setMoranData] = useState(null);
  const [morphData, setMorphData] = useState(null);

  // PCF Dropdown states
  const [pcfClusterA, setPcfClusterA] = useState("");
  const [pcfClusterB, setPcfClusterB] = useState("");

  // Morph Dropdown state
  const [activeMorphMetric, setActiveMorphMetric] = useState("Area (µm²)");

  // 1. Fetch available slides and samples on load
  useEffect(() => {
    async function fetchMetadata() {
      try {
        const res = await fetch(`data/spatial_metadata_${ANALYSIS_NAME}.json`);
        if (!res.ok) return;
        const data = await res.json();
        setHierarchy(data);
        setAvailableSlides(["All", ...Object.keys(data)]);
      } catch (err) {
        console.warn(`Could not load spatial_metadata_${ANALYSIS_NAME}.json`, err);
      }
    }
    fetchMetadata();
  }, []);

  // 2. Update available samples when slide changes
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

  // 3. Load the statistics data whenever the selectedSample changes
  useEffect(() => {
    if (!selectedSample || selectedSample === "All") return;

    const basePath = `data/spatial_stats/${selectedSample}`;

    fetch(`${basePath}/nhood_enrichment_${selectedSample}.json`)
      .then(r => r.ok ? r.json() : null)
      .then(d => setNhoodData(d)).catch(() => setNhoodData(null));

    fetch(`${basePath}/centrality_scores_${selectedSample}.json`)
      .then(r => r.ok ? r.json() : null)
      .then(d => setCentralityData(d)).catch(() => setCentralityData(null));

    d3.csv(`${basePath}/moranI_results_${selectedSample}.csv`)
      .then(d => setMoranData(d)).catch(() => setMoranData(null));

    fetch(`${basePath}/cross_pcf_all.json`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        setPcfData(d);
        if (d && Object.keys(d.pairs).length > 0) {
          const firstPair = Object.keys(d.pairs)[0].split("|");
          setPcfClusterA(firstPair[0]);
          setPcfClusterB(firstPair[1]);
        }
      }).catch(() => setPcfData(null));

    d3.csv(`${basePath}/morphometrics.csv`)
      .then(d => setMorphData(d)).catch(() => setMorphData(null));

  }, [selectedSample]);

  // --- RENDERERS FOR EACH TAB ---
  const renderNeighborhoods = () => {
    if (!nhoodData) return <div className="p-4 text-gray-500">Loading or no Neighborhood Enrichment data found.</div>;
    return (
      <div className="flex-1 w-full h-full p-4">
        <Plot
          data={[{
            z: nhoodData.zscores,
            x: nhoodData.clusters,
            y: nhoodData.clusters,
            type: 'heatmap',
            colorscale: 'RdBu',
            zmid: 0 
          }]}
          layout={{ 
            title: 'Neighborhood Enrichment (Z-Scores)', 
            autosize: true,
            xaxis: { tickangle: 45 },
            yaxis: { autorange: 'reversed' },
            margin: { l: 100, b: 100 }
          }}
          useResizeHandler={true}
          style={{ width: "100%", height: "100%" }}
        />
      </div>
    );
  };

  const renderDistances = () => {
    if (!pcfData) return <div className="p-4 text-gray-500">Loading or no Cross-PCF data found.</div>;
    
    const clusters = Array.from(new Set(Object.keys(pcfData.pairs).flatMap(k => k.split("|")))).sort();
    const pairKey1 = `${pcfClusterA}|${pcfClusterB}`;
    const pairKey2 = `${pcfClusterB}|${pcfClusterA}`; 
    const yValues = pcfData.pairs[pairKey1] || pcfData.pairs[pairKey2] || [];

    return (
      <div className="flex flex-col h-full gap-4">
        <div className="flex gap-4 p-4 bg-gray-50 border-b items-center">
          <span className="font-semibold text-sm text-gray-700 uppercase tracking-wide">Interaction Pair:</span>
          <select className="border border-gray-300 p-2 rounded outline-none" value={pcfClusterA} onChange={e => setPcfClusterA(e.target.value)}>
            {clusters.map(c => <option key={c} value={c}>Cluster {c}</option>)}
          </select>
          <span className="text-sm text-gray-500 font-bold">↔</span>
          <select className="border border-gray-300 p-2 rounded outline-none" value={pcfClusterB} onChange={e => setPcfClusterB(e.target.value)}>
            {clusters.map(c => <option key={c} value={c}>Cluster {c}</option>)}
          </select>
        </div>
        <div className="flex-1 p-4">
          <Plot
            data={[{
              x: pcfData.r_distances,
              y: yValues,
              type: 'scatter',
              mode: 'lines',
              line: { color: '#1f77b4', width: 3 }
            }]}
            layout={{ 
              title: `Cross-PCF: Cluster ${pcfClusterA} vs Cluster ${pcfClusterB}`, 
              autosize: true,
              xaxis: { title: 'Radius r (µm)' },
              yaxis: { title: 'g(r)', rangemode: 'tozero' },
              shapes: [{
                type: 'line', x0: 0, x1: Math.max(...pcfData.r_distances), y0: 1, y1: 1,
                line: { color: 'red', dash: 'dash', width: 2 }
              }]
            }}
            useResizeHandler={true}
            style={{ width: "100%", height: "100%" }}
          />
        </div>
      </div>
    );
  };

  const renderMorphometrics = () => {
    if (!morphData || morphData.length === 0) return <div className="p-4 text-gray-500">Loading or no Morphometrics data found.</div>;
    
    const metrics = Object.keys(morphData[0]).filter(k => k !== "Cell_ID" && k !== "Cluster");
    const uniqueClusters = Array.from(new Set(morphData.map(d => d.Cluster))).filter(Boolean).sort();

    const violinTraces = uniqueClusters.map((clusterName, index) => {
      const clusterData = morphData.filter(d => d.Cluster === clusterName);
      const metricValues = clusterData.map(d => parseFloat(d[activeMorphMetric])).filter(v => !isNaN(v));

      return {
        y: metricValues,
        type: 'violin',
        name: `Cluster ${clusterName}`,
        box: { visible: true },
        meanline: { visible: true },
        marker: { color: largeColorPalette[index % largeColorPalette.length] }
      };
    });

    return (
      <div className="flex flex-col h-full gap-4">
        <div className="flex gap-4 p-4 bg-gray-50 border-b items-center">
          <span className="font-semibold text-sm text-gray-700 uppercase tracking-wide">Shape Metric:</span>
          <select className="border border-gray-300 p-2 rounded outline-none" value={activeMorphMetric} onChange={e => setActiveMorphMetric(e.target.value)}>
            {metrics.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <span className="text-xs text-gray-500 italic ml-auto">
            * Click legend items to toggle clusters. Double-click to isolate one.
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
              legend: { title: { text: 'Cell Types' } }
            }}
            useResizeHandler={true}
            style={{ width: "100%", height: "100%" }}
          />
        </div>
      </div>
    );
  };

  const renderAutocorrelation = () => {
    if (!centralityData && !moranData) return <div className="p-4 text-gray-500">Loading or no Autocorrelation/Centrality data found.</div>;

    const centralityTraces = centralityData ? Object.keys(centralityData).map((cluster, index) => ({
      x: ['Degree', 'Closeness'],
      y: [centralityData[cluster]['degree_centrality'], centralityData[cluster]['closeness_centrality']],
      name: `Cluster ${cluster}`,
      type: 'bar',
      marker: { color: largeColorPalette[index % largeColorPalette.length] }
    })) : [];

    const moranTraces = moranData ? [{
      x: moranData.map(d => parseFloat(d.I)),
      y: moranData.map(d => -Math.log10(parseFloat(d['pval_sim']) || 0.0001)), 
      text: moranData.map(d => d['']), 
      mode: 'markers',
      type: 'scatter',
      marker: { color: moranData.map(d => parseFloat(d.I)), colorscale: 'Viridis', showscale: true, size: 8 }
    }] : [];

    return (
      <div className="flex flex-col h-full gap-4 overflow-auto p-4">
        {centralityData && (
          <div className="h-[400px] border rounded bg-white shadow-sm flex-shrink-0">
             <Plot
                data={centralityTraces}
                layout={{ title: 'Network Centrality per Cluster', barmode: 'group', autosize: true }}
                useResizeHandler={true}
                style={{ width: "100%", height: "100%" }}
              />
          </div>
        )}
        {moranData && (
          <div className="h-[400px] border rounded bg-white shadow-sm flex-shrink-0">
             <Plot
                data={moranTraces}
                layout={{ 
                  title: "Moran's I Spatial Autocorrelation (Genes)", 
                  xaxis: { title: "Moran's I Statistic (Higher = More spatially patterned)" },
                  yaxis: { title: "-log10(p-value)" },
                  autosize: true 
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
    <div className="p-6 flex flex-col gap-4 h-full">
      {/* Top Header & Tab Navigation */}
      <div className="bg-white p-4 border shadow-sm rounded flex flex-col xl:flex-row justify-between items-center gap-4">
        
        <div className="flex flex-wrap gap-4 items-center">
          <h2 className="text-xl font-bold text-gray-800 border-r pr-4">Spatial Analytics</h2>
          
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

        <div className="flex gap-2 bg-gray-200 p-1 rounded">
          {[
            { id: "nhood", label: "Neighborhoods" },
            { id: "pcf", label: "Distances (PCF)" },
            { id: "morph", label: "Morphology" },
            { id: "centrality", label: "Autocorrelation" }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded text-sm font-semibold transition ${activeTab === tab.id ? 'bg-white shadow text-blue-600' : 'text-gray-600 hover:bg-gray-300'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main SPLIT Content Area */}
      {(!selectedSample || selectedSample === "All") ? (
         <div className="flex items-center justify-center h-full text-gray-500 bg-white border shadow-sm rounded flex-1">
           <p className="p-6 text-center">
             <span className="text-2xl block mb-2">⚠️</span>
             Spatial Statistics are calculated at the tissue level.<br/> 
             Please select a specific <b>Sample</b> from the dropdown above to view statistics.
           </p>
         </div>
      ) : (
        <div className="flex-1 w-full flex gap-4 overflow-hidden">
          
          {/* Left Side: Stats Plots */}
          <div className="flex-1 min-w-0 bg-white border shadow-sm rounded flex flex-col overflow-hidden relative">
            {activeTab === "nhood" && renderNeighborhoods()}
            {activeTab === "pcf" && renderDistances()}
            {activeTab === "morph" && renderMorphometrics()}
            {activeTab === "centrality" && renderAutocorrelation()}
          </div>
          
          {/* Right Side: Vitessce Spatial Map */}
          <div className="flex-1 min-w-0 border border-gray-200 rounded relative bg-white">
            <VitessceSpatialStats 
              n={n} 
              r={r} 
              selectedSlide={selectedSlide} 
              selectedSample={selectedSample} 
              activeTab={activeTab}
            />
          </div>

        </div>
      )}
    </div>
  );
}