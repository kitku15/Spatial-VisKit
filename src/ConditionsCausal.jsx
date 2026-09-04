import React, { useState, useEffect, useRef, useMemo } from "react";
import Plotly from "plotly.js-dist-min";
import factory from "react-plotly.js/factory";
import * as d3 from "d3";
import { themeColors, DATA_DIR, API_BASE_URL  } from "./config";
import InfoModal from "./InfoModal";
import { tabInfo } from "./infoHelper";

const createPlotlyComponent =
  typeof factory === "function" ? factory : factory.default;
const Plot = createPlotlyComponent(Plotly);

export default function ConditionsCausal() {
  const [metadata, setMetadata] = useState(null);
  const [causalData, setCausalData] = useState(null);
  
  // Selections
  const [selectedComparison, setSelectedComparison] = useState("");
  const [selectedSource, setSelectedSource] = useState("");
  const [selectedTarget, setSelectedTarget] = useState("");

  // Available options
  const [availableComparisons, setAvailableComparisons] = useState([]);
  const [availableSources, setAvailableSources] = useState([]);
  const [availableTargets, setAvailableTargets] = useState([]);

  const d3Container = useRef(null);

  // 1. Fetch Metadata mapping on mount
  useEffect(() => {
    fetch(`${API_BASE_URL}/${DATA_DIR}/causal_ccc/causal_metadata.json`)
      .then((res) => res.json())
      .then((data) => {
        setMetadata(data);
        const comps = Object.keys(data).sort();
        setAvailableComparisons(comps);
        if (comps.length > 0) setSelectedComparison(comps[0]);
      })
      .catch((err) => console.warn("Causal metadata not found. Did the pipeline run?", err));
  }, []);

  // 2. Update available sources/targets when Comparison changes
  useEffect(() => {
    if (!metadata || !selectedComparison) return;
    
    const pairsForComp = metadata[selectedComparison] || [];
    const sources = Array.from(new Set(pairsForComp.map(p => p.source))).sort();
    setAvailableSources(sources);
    
    if (sources.length > 0) {
      const defaultSource = sources.includes(selectedSource) ? selectedSource : sources[0];
      setSelectedSource(defaultSource);
    } else {
      setSelectedSource("");
    }
  }, [selectedComparison, metadata]);

  // 3. Update targets when Source changes
  useEffect(() => {
    if (!metadata || !selectedComparison || !selectedSource) return;
    
    const pairsForComp = metadata[selectedComparison] || [];
    const validTargets = Array.from(
      new Set(pairsForComp.filter(p => p.source === selectedSource).map(p => p.target))
    ).sort();
    
    setAvailableTargets(validTargets);
    if (validTargets.length > 0) {
        const defaultTarget = validTargets.includes(selectedTarget) ? selectedTarget : validTargets[0];
        setSelectedTarget(defaultTarget);
    } else {
        setSelectedTarget("");
    }
  }, [selectedSource, selectedComparison, metadata]);

  // 4. Fetch the specific JSON file when all 3 selections are valid
  useEffect(() => {
    if (!metadata || !selectedComparison || !selectedSource || !selectedTarget) {
        setCausalData(null);
        return;
    }

    const pairInfo = metadata[selectedComparison].find(
        p => p.source === selectedSource && p.target === selectedTarget
    );

    if (pairInfo && pairInfo.file) {
        fetch(`${API_BASE_URL}/${DATA_DIR}/causal_ccc/${pairInfo.file}`)
          .then(res => res.json())
          .then(data => setCausalData(data))
          .catch(err => {
              console.error("Failed to load specific causal data json", err);
              setCausalData(null);
          });
    } else {
        setCausalData(null);
    }
  }, [selectedComparison, selectedSource, selectedTarget, metadata]);


  // 5. Prepare Plotly Dot Plot (Ligand-Receptor)
  const lrPlotData = useMemo(() => {
    if (!causalData || causalData.lr_interactions.length === 0) return null;
    
    const filtered = causalData.lr_interactions;
    const x = filtered.map(d => d.ligand);
    const y = filtered.map(d => d.receptor);
    const color = filtered.map(d => d.stat); // Wald Stat
    
    const size = filtered.map(d => {
        const nLogP = -Math.log10(Math.max(d.pval, 1e-10));
        return Math.min(Math.max(nLogP * 3, 5), 20); 
    });

    const hovertext = filtered.map(d => `Source: ${d.source}<br>Target: ${d.target}<br>Ligand: ${d.ligand}<br>Receptor: ${d.receptor}<br>Stat: ${d.stat.toFixed(2)}<br>P-val: ${d.pval.toExponential(2)}`);

    return [{
      x, y,
      mode: 'markers',
      type: 'scatter',
      text: hovertext,
      hoverinfo: "text",
      marker: {
        size,
        color,
        colorscale: 'RdBu',
        reversescale: true, 
        showscale: true,
        colorbar: { title: "Wald Stat", thickness: 15 },
        line: { width: 1, color: themeColors.stroke }
      }
    }];
  }, [causalData]);

  // 6. Prepare Plotly Bar Chart (TF Activities)
  const tfPlotData = useMemo(() => {
    if (!causalData || causalData.tf_activities.length === 0) return null;
    
    let filtered = [...causalData.tf_activities];
    filtered.sort((a, b) => Math.abs(b.stat) - Math.abs(a.stat));
    filtered = filtered.slice(0, 20); 

    const x = filtered.map(d => d.stat);
    const y = filtered.map(d => d.tf);
    const colors = x.map(val => val > 0 ? themeColors.danger : themeColors.primary);

    return [{
      x, y,
      type: 'bar',
      orientation: 'h',
      marker: { color: colors },
      text: x.map(val => val.toFixed(2)),
      textposition: 'auto',
      hoverinfo: 'y+text'
    }];
  }, [causalData]);

  // 7. Render D3 Force Directed Graph
  useEffect(() => {
    if (!causalData || !d3Container.current) return;
    
    const container = d3.select(d3Container.current);
    container.selectAll("*").remove();

    if (causalData.network.nodes.length === 0) {
      container.append("div").attr("class", "flex h-full items-center justify-center text-textMuted").text("No intracellular network data available.");
      return;
    }

    const width = d3Container.current.clientWidth || 600;
    const height = d3Container.current.clientHeight || 500;

    const nodes = causalData.network.nodes.map(d => Object.create(d));
    const links = causalData.network.edges.map(d => Object.create(d));

    const svg = container.append("svg")
      .attr("width", "100%")
      .attr("height", "100%")
      .attr("viewBox", [0, 0, width, height]);

    const g = svg.append("g");
    svg.call(d3.zoom().on("zoom", (event) => g.attr("transform", event.transform)));

    // Define 3 types of arrows: activation, inhibition, and unknown
    svg.append("defs").selectAll("marker")
      .data(["activation", "inhibition", "unknown"])
      .join("marker")
      .attr("id", d => `arrow-${d}`)
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 18) 
      .attr("refY", 0)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("fill", d => {
          if (d === "activation") return themeColors.neutral;
          if (d === "inhibition") return themeColors.danger;
          return themeColors.textMuted; // Unknown is grey
      })
      .attr("d", d => {
          if (d === "inhibition") return "M0,-5L2,-5L2,5L0,5"; // Flat head for inhibition
          return "M0,-5L10,0L0,5"; // Triangle for activation and unknown
      });

    const simulation = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(links).id(d => d.id).distance(50))
      .force("charge", d3.forceManyBody().strength(-200))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collide", d3.forceCollide().radius(20));

    // Properly map edges based on 1 (Act), -1 (Inh), 0 (Unknown)
    const link = g.append("g")
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke", d => {
          if (d.sign > 0) return themeColors.neutral;
          if (d.sign < 0) return themeColors.danger;
          return themeColors.textMuted;
      })
      .attr("stroke-width", 2)
      .attr("stroke-dasharray", d => d.sign < 0 ? "4,4" : "none") 
      .attr("marker-end", d => {
          if (d.sign > 0) return "url(#arrow-activation)";
          if (d.sign < 0) return "url(#arrow-inhibition)";
          return "url(#arrow-unknown)";
      });

    const nodeColor = (type) => {
        if (type === "Receptor") return themeColors.success;
        if (type === "TF") return themeColors.info;
        return themeColors.neutral; 
    };

    const node = g.append("g")
      .selectAll("g")
      .data(nodes)
      .join("g")
      .call(d3.drag()
        .on("start", (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x; d.fy = d.y;
        })
        .on("drag", (event, d) => { d.fx = event.x; d.fy = event.y; })
        .on("end", (event, d) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null; d.fy = null;
        }));

    node.append("circle")
      .attr("r", 8)
      .attr("fill", d => nodeColor(d.type))
      .attr("stroke", themeColors.paper)
      .attr("stroke-width", 1.5);

    node.append("text")
      .text(d => d.id)
      .attr("x", 12)
      .attr("y", 3)
      .attr("font-size", "10px")
      .attr("fill", themeColors.label)
      .style("pointer-events", "none")
      .style("text-shadow", `0 1px 0 ${themeColors.paper}, 1px 0 0 ${themeColors.paper}, 0 -1px 0 ${themeColors.paper}, -1px 0 0 ${themeColors.paper}`);

    simulation.on("tick", () => {
      link.attr("x1", d => d.source.x).attr("y1", d => d.source.y)
          .attr("x2", d => d.target.x).attr("y2", d => d.target.y);
      node.attr("transform", d => `translate(${d.x},${d.y})`);
    });

    return () => simulation.stop();
  }, [causalData]);

  if (!metadata) {
    return <div className="p-6 text-textMuted flex items-center justify-center h-full">Loading Causal Network Data...</div>;
  }

  return (
    <div className="p-6 flex flex-col gap-4 h-full bg-app">
      {/* Top Bar: Controls */}
      <div className="bg-panel p-4 border border-borderLight shadow-sm rounded flex flex-wrap items-center gap-6">
        
        {/* NEW: Condition Comparison Selector */}
        <label className="text-sm font-semibold flex flex-col gap-1">
          <span className="text-primary-dark uppercase tracking-wide text-xs">Treatment Comparison</span>
          <select
            className="border border-primary bg-primary-light text-primary-dark p-2 rounded outline-none focus:ring-1 focus:ring-primary w-48"
            value={selectedComparison}
            onChange={(e) => setSelectedComparison(e.target.value)}
          >
            {availableComparisons.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>

        <div className="h-8 border-l border-borderLight mx-2"></div>

        <label className="text-sm font-semibold flex flex-col gap-1">
          <span className="text-textMuted uppercase tracking-wide text-xs">Sender Cell Type (Ligands)</span>
          <select
            className="border border-borderMain p-2 rounded outline-none w-48 bg-panel text-textMain focus:border-primary"
            value={selectedSource}
            onChange={(e) => setSelectedSource(e.target.value)}
          >
            {availableSources.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>

        <label className="text-sm font-semibold flex flex-col gap-1">
          <span className="text-textMuted uppercase tracking-wide text-xs">Receiver Cell Type (Receptors)</span>
          <select
            className="border border-borderMain p-2 rounded outline-none w-48 bg-panel text-textMain focus:border-primary"
            value={selectedTarget}
            onChange={(e) => setSelectedTarget(e.target.value)}
          >
            {availableTargets.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>

        <div className="ml-auto flex items-center gap-4">
            <div className="flex gap-3 text-xs font-bold text-textMuted border-r border-borderMain pr-4">
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full" style={{backgroundColor: themeColors.success}}></span> Receptor</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full" style={{backgroundColor: themeColors.neutral}}></span> Kinase/Int</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full" style={{backgroundColor: themeColors.info}}></span> TF</span>
            </div>
            <InfoModal title={tabInfo.causal.title} content={tabInfo.causal.content} />
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-0">
        <div className="flex flex-col w-full lg:w-1/3 gap-4">
            <div className="bg-panel border border-borderLight shadow-sm rounded p-3 flex-1 flex flex-col min-h-0">
                <h3 className="font-bold text-sm text-textMain text-center mb-1">Condition-Altered Signals (LR)</h3>
                <p className="text-xs text-center text-textMuted mb-1 truncate">Sender ➔ Receiver</p>
                <div className="flex-1 relative">
                    {lrPlotData ? (
                        <Plot
                            data={lrPlotData}
                            layout={{
                                autosize: true,
                                margin: { l: 80, r: 20, t: 10, b: 60 },
                                xaxis: { title: "Ligand", tickangle: 45, automargin: true },
                                yaxis: { title: "Receptor", automargin: true },
                                paper_bgcolor: themeColors.paper,
                                plot_bgcolor: themeColors.paper,
                                font: { color: themeColors.label },
                            }}
                            useResizeHandler={true}
                            style={{ width: "100%", height: "100%" }}
                        />
                    ) : (<div className="flex h-full items-center justify-center text-textMuted text-sm text-center px-4">No LR pairs met criteria.</div>)}
                </div>
            </div>

            <div className="bg-panel border border-borderLight shadow-sm rounded p-3 flex-1 flex flex-col min-h-0">
                <h3 className="font-bold text-sm text-textMain text-center mb-1">Altered TF Activity</h3>
                <p className="text-xs text-center text-textMuted mb-1 truncate">Inside Receiver Cell</p>
                <div className="flex-1 relative">
                    {tfPlotData ? (
                        <Plot
                            data={tfPlotData}
                            layout={{
                                autosize: true,
                                margin: { l: 60, r: 20, t: 10, b: 40 },
                                xaxis: { title: "Activity Score (Wald)", zeroline: true, zerolinecolor: themeColors.black },
                                yaxis: { autorange: 'reversed', automargin: true },
                                paper_bgcolor: themeColors.paper,
                                plot_bgcolor: themeColors.paper,
                                font: { color: themeColors.label },
                            }}
                            useResizeHandler={true}
                            style={{ width: "100%", height: "100%" }}
                        />
                    ) : (<div className="flex h-full items-center justify-center text-textMuted text-sm text-center px-4">No TF shifts for this target.</div>)}
                </div>
            </div>
        </div>

        <div className="w-full lg:w-2/3 bg-panel border border-borderLight shadow-sm rounded flex flex-col overflow-hidden relative">
            <div className="bg-app border-b border-borderLight px-4 py-2 flex justify-between items-center z-10">
                <h3 className="font-bold text-sm text-textMain">Prior Knowledge Causal Network</h3>
                <span className="text-xs text-textMuted">Scroll to Zoom. Drag nodes to reposition.</span>
            </div>
            <div className="flex-1 relative bg-panel" ref={d3Container}>
               {!causalData && (
                  <div className="flex h-full items-center justify-center text-textMuted text-sm text-center px-4">
                    Select a valid combination above to load the network.
                  </div>
               )}
            </div>
        </div>
      </div>
    </div>
  );
}