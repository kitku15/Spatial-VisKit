import React, { useState, useEffect, useRef, useMemo } from "react";
import Plotly from "plotly.js-dist-min";
import factory from "react-plotly.js/factory";
import * as d3 from "d3";
import { themeColors, DATA_DIR } from "./config";
import InfoModal from "./InfoModal";
import { tabInfo } from "./infoHelper";

const createPlotlyComponent =
  typeof factory === "function" ? factory : factory.default;
const Plot = createPlotlyComponent(Plotly);

export default function ConditionsCausal() {
  const [causalData, setCausalData] = useState(null);
  const [sourceCell, setSourceCell] = useState("All");
  const [targetCell, setTargetCell] = useState("All");
  const [availableSources, setAvailableSources] = useState(["All"]);
  const [availableTargets, setAvailableTargets] = useState(["All"]);

  const d3Container = useRef(null);

  // 1. Fetch Data
  useEffect(() => {
    fetch(`/${DATA_DIR}/causal_ccc/causal_data.json`)
      .then((res) => res.json())
      .then((data) => {
        setCausalData(data);
        
        // Extract unique cell types
        const sources = Array.from(new Set(data.lr_interactions.map(d => d.source))).sort();
        const targets = Array.from(new Set(data.tf_activities.map(d => d.cell_type))).sort();
        
        setAvailableSources(["All", ...sources]);
        setAvailableTargets(["All", ...targets]);
        
        if (sources.length > 0) setSourceCell(sources[0]);
        if (targets.length > 0) setTargetCell(targets[0]);
      })
      .catch((err) => console.warn("Causal data not found.", err));
  }, []);

  // 2. Prepare Plotly Dot Plot (Ligand-Receptor)
  const lrPlotData = useMemo(() => {
    if (!causalData) return null;
    
    let filtered = causalData.lr_interactions;
    if (sourceCell !== "All") filtered = filtered.filter(d => d.source === sourceCell);
    if (targetCell !== "All") filtered = filtered.filter(d => d.target === targetCell);

    if (filtered.length === 0) return null;

    const x = filtered.map(d => d.ligand);
    const y = filtered.map(d => d.receptor);
    const color = filtered.map(d => d.stat); // Wald Stat
    
    // Scale marker size by -log10(p-value), bounded between 5 and 20
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
        reversescale: true, // Red = up, Blue = down
        showscale: true,
        colorbar: { title: "Wald Stat", thickness: 15 },
        line: { width: 1, color: themeColors.stroke }
      }
    }];
  }, [causalData, sourceCell, targetCell]);

  // 3. Prepare Plotly Bar Chart (TF Activities)
  const tfPlotData = useMemo(() => {
    if (!causalData) return null;
    
    let filtered = causalData.tf_activities;
    if (targetCell !== "All") filtered = filtered.filter(d => d.cell_type === targetCell);

    // Sort by absolute stat to get top shifts
    filtered.sort((a, b) => Math.abs(b.stat) - Math.abs(a.stat));
    filtered = filtered.slice(0, 20); // Top 20 for readability

    if (filtered.length === 0) return null;

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
  }, [causalData, targetCell]);

  // 4. Render D3 Force Directed Graph (Intracellular Signaling)
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

    // Deep copy nodes and links so D3 doesn't mutate React state directly
    const nodes = causalData.network.nodes.map(d => Object.create(d));
    const links = causalData.network.edges.map(d => Object.create(d));

    const svg = container.append("svg")
      .attr("width", "100%")
      .attr("height", "100%")
      .attr("viewBox", [0, 0, width, height]);

    // Zoom behavior
    const g = svg.append("g");
    svg.call(d3.zoom().on("zoom", (event) => g.attr("transform", event.transform)));

    // Arrow markers
    svg.append("defs").selectAll("marker")
      .data(["activation", "inhibition"])
      .join("marker")
      .attr("id", d => `arrow-${d}`)
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 18) // Shift arrow back so it doesn't hide under the node circle
      .attr("refY", 0)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("fill", d => d === "activation" ? themeColors.neutral : themeColors.danger)
      .attr("d", d => d === "activation" ? "M0,-5L10,0L0,5" : "M0,-5L2,-5L2,5L0,5"); // Arrow vs Flat line (inhibition)

    // Force simulation
    const simulation = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(links).id(d => d.id).distance(50))
      .force("charge", d3.forceManyBody().strength(-200))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collide", d3.forceCollide().radius(20));

    // Links
    const link = g.append("g")
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke", d => d.sign > 0 ? themeColors.neutral : themeColors.danger)
      .attr("stroke-width", d => Math.max(d.weight * 2, 1))
      .attr("stroke-dasharray", d => d.sign < 0 ? "4,4" : "none") // dashed for inhibition
      .attr("marker-end", d => `url(#arrow-${d.sign > 0 ? 'activation' : 'inhibition'})`);

    // Nodes
    const nodeColor = (type) => {
        if (type === "Receptor") return themeColors.success;
        if (type === "TF") return themeColors.info;
        return themeColors.neutral; // Kinase
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

  if (!causalData) {
    return <div className="p-6 text-textMuted flex items-center justify-center h-full">Loading Causal Network Data... (If this persists, ensure LIANA_Causal module ran successfully).</div>;
  }

  return (
    <div className="p-6 flex flex-col gap-4 h-full bg-app">
      {/* Top Bar: Controls */}
      <div className="bg-panel p-4 border border-borderLight shadow-sm rounded flex flex-wrap items-center gap-6">
        <label className="text-sm font-semibold flex flex-col gap-1">
          <span className="text-textMuted uppercase tracking-wide text-xs">Sender Cell Type (Ligands)</span>
          <select
            className="border border-borderMain p-2 rounded outline-none w-48 bg-panel text-textMain focus:border-primary"
            value={sourceCell}
            onChange={(e) => setSourceCell(e.target.value)}
          >
            {availableSources.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>

        <label className="text-sm font-semibold flex flex-col gap-1">
          <span className="text-primary-dark uppercase tracking-wide text-xs">Receiver Cell Type (Receptors & TFs)</span>
          <select
            className="border border-primary bg-primary-light text-primary-dark p-2 rounded outline-none w-48 focus:ring-1 focus:ring-primary"
            value={targetCell}
            onChange={(e) => setTargetCell(e.target.value)}
          >
            {availableTargets.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>

        <div className="ml-auto flex items-center gap-4">
            {/* Legend for Network */}
            <div className="flex gap-3 text-xs font-bold text-textMuted border-r border-borderMain pr-4">
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full" style={{backgroundColor: themeColors.success}}></span> Receptor</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full" style={{backgroundColor: themeColors.neutral}}></span> Kinase/Int</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full" style={{backgroundColor: themeColors.info}}></span> TF</span>
            </div>
            <InfoModal title={tabInfo.causal.title} content={tabInfo.causal.content} />
        </div>
      </div>

      {/* Main Layout: 3 Panels */}
      <div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-0">
        
        {/* Left Column: Ligand-Receptor & TF Activities */}
        <div className="flex flex-col w-full lg:w-1/3 gap-4">
            
            {/* Panel 1: Condition L-R Pairs */}
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
                    ) : (<div className="flex h-full items-center justify-center text-textMuted text-sm">No LR pairs for this selection.</div>)}
                </div>
            </div>

            {/* Panel 2: TF Activities */}
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
                    ) : (<div className="flex h-full items-center justify-center text-textMuted text-sm">No TF shifts for this target.</div>)}
                </div>
            </div>
        </div>

        {/* Right Column: Intracellular Causal Network */}
        <div className="w-full lg:w-2/3 bg-panel border border-borderLight shadow-sm rounded flex flex-col overflow-hidden relative">
            <div className="bg-app border-b border-borderLight px-4 py-2 flex justify-between items-center z-10">
                <h3 className="font-bold text-sm text-textMain">Prior Knowledge Causal Network</h3>
                <span className="text-xs text-textMuted">Scroll to Zoom. Drag nodes to reposition.</span>
            </div>
            <div className="flex-1 relative bg-panel" ref={d3Container}>
            </div>
        </div>

      </div>
    </div>
  );
}