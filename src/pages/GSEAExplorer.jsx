import { useState, useEffect, useMemo, useRef } from "react";
import Plotly from "plotly.js-dist-min";
import ForceGraph2D from "react-force-graph-2d";
import factory from "react-plotly.js/factory";
import * as d3 from "d3";
import InfoModal from "../components/ui/InfoModal";
import { themeColors, DATA_DIR, API_BASE_URL } from "../config/config";

const createPlotlyComponent =
  typeof factory === "function" ? factory : factory.default;
const Plot = createPlotlyComponent(Plotly);

export default function GSEAExplorer() {
  const [meta, setMeta] = useState(null);
  const [selectedCellType, setSelectedCellType] = useState("");
  const [selectedComparison, setSelectedComparison] = useState("");
  const [selectedDatabase, setSelectedDatabase] = useState("");

  const [minSize, setMinSize] = useState(5);
  const [maxSize, setMaxSize] = useState(1000);
  const [padjThreshold, setPadjThreshold] = useState(0.05);
  const [nesThreshold, setNesThreshold] = useState(1.5);

  const [plotData, setPlotData] = useState(null);
  const [isComputing, setIsComputing] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [viewDirection, setViewDirection] = useState("BOTH");
  const [nodeSizeMultiplier, setNodeSizeMultiplier] = useState(1.0);

  // Tracks the parameters of the currently displayed plot
  const [appliedParams, setAppliedParams] = useState(null);
  const [hoveredPathway, setHoveredPathway] = useState(null);

  // For responsive network graph sizing
  const graphContainerRef = useRef(null);
  const fgRef = useRef(null);
  const [graphDim, setGraphDim] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!graphContainerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      setGraphDim({
        width: entries[0].contentRect.width,
        height: entries[0].contentRect.height,
      });
    });
    observer.observe(graphContainerRef.current);
    return () => observer.disconnect();
  }, [plotData]);

  useEffect(() => {
    async function fetchMetadata() {
      try {
        const res = await fetch(
          `${API_BASE_URL}/${DATA_DIR}/gsea/gsea_metadata.json`,
        );
        if (!res.ok) throw new Error("GSEA metadata not found.");
        const data = await res.json();
        setMeta(data);

        if (data.celltypes?.length > 0) {
          const ct = data.celltypes[0];
          setSelectedCellType(ct);
          if (data.comparisons[ct]?.length > 0) {
            setSelectedComparison(data.comparisons[ct][0]);
          }
        }
        if (data.databases?.length > 0) {
          setSelectedDatabase(data.databases[0]);
        }
      } catch (err) {
        console.warn(err.message);
      }
    }
    fetchMetadata();
  }, []);

  // Try to load precomputed defaults initially
  useEffect(() => {
    if (!selectedCellType || !selectedComparison || !selectedDatabase) return;

    fetch(
      `${API_BASE_URL}/${DATA_DIR}/gsea/precomputed/${selectedCellType}_${selectedComparison}_${selectedDatabase}.json`,
    )
      .then((r) => {
        if (!r.ok) throw new Error("No default precomputed state found.");
        return r.json();
      })
      .then((data) => {
        setPlotData(data);
        setAppliedParams({
          celltype: selectedCellType,
          comparison: selectedComparison,
          database: selectedDatabase,
          minSize,
          maxSize,
          padjThreshold,
          nesThreshold,
        });
      })
      .catch(() => setPlotData(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCellType, selectedComparison, selectedDatabase]);

  const runInteractiveGSEA = async () => {
    if (!selectedCellType || !selectedComparison || !selectedDatabase) return;

    setIsComputing(true);
    setErrorMsg("");

    try {
      const payload = {
        celltype: selectedCellType,
        comparison: selectedComparison,
        database: selectedDatabase,
        min_size: Number(minSize),
        max_size: Number(maxSize),
        padj_threshold: Number(padjThreshold),
        nes_threshold: Number(nesThreshold),
      };

      const res = await fetch(`${API_BASE_URL}/api/gsea`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("GSEA computation failed on the backend.");
      const result = await res.json();
      setPlotData(result);
      setAppliedParams({
        celltype: selectedCellType,
        comparison: selectedComparison,
        database: selectedDatabase,
        minSize,
        maxSize,
        padjThreshold,
        nesThreshold,
      });
    } catch (err) {
      setErrorMsg(err.message);
      setPlotData(null);
    } finally {
      setIsComputing(false);
    }
  };

  const dualPlotConfig = useMemo(() => {
    if (!plotData || !plotData.table || plotData.table.length === 0)
      return null;

    // Filter by user-selected direction
    const filtered = plotData.table.filter((d) => {
      if (viewDirection === "BOTH") return true;
      return viewDirection === "UP" ? d.NES > 0 : d.NES < 0;
    });

    if (filtered.length === 0) return null;

    // Take top 15 by absolute NES
    let sorted = [...filtered]
      .sort((a, b) => Math.abs(b.NES) - Math.abs(a.NES))
      .slice(0, 15);

    // Sort by NES so positive is at top, negative at bottom
    sorted.sort((a, b) => a.NES - b.NES);

    const terms = sorted.map((d) => {
      let t = d.Term.replace(/HALLMARK_|KEGG_|REACTOME_/gi, "");
      t = t.replace(/_/g, " ").toLowerCase();
      return t.charAt(0).toUpperCase() + t.slice(1);
    });

    const nes = sorted.map((d) => d.NES);
    // Clamp the p-value at 1e-15 so extremely significant dots don't vanish into infinity
    const pvals = sorted.map((d) => Math.max(d["FDR q-val"], 1e-15));

    const maxAbsNesBase = Math.max(...nes.map(Math.abs), 0.2);

    // Create a color scale: Blue -> White -> Red based on NES (matches network map)
    const colorScale = d3
      .scaleLinear()
      .domain([-maxAbsNesBase, 0, maxAbsNesBase])
      .range(["#4575b4", "#f7f7f7", "#d73027"]);

    const colors = nes.map((val) => colorScale(val));

    const traces = [
      {
        type: "bar",
        x: nes,
        y: terms,
        orientation: "h",
        marker: {
          color: colors,
          line: { color: "black", width: 0.5 }, // Keep very light bars visible
        },
        name: "NES",
        xaxis: "x1",
      },
      {
        type: "scatter",
        x: pvals,
        y: terms,
        mode: "lines+markers",
        name: "Adjusted P-Value",
        xaxis: "x2",
        marker: {
          size: 14,
          color: "white",
          line: { color: "black", width: 2 },
        },
        line: { color: "black", width: 1.5 },
      },
    ];

    const maxAbsNes = maxAbsNesBase + 0.2;
    let xRange = [-maxAbsNes, maxAbsNes];
    if (viewDirection === "UP") xRange = [-0.2, maxAbsNes];
    if (viewDirection === "DOWN") xRange = [-maxAbsNes, 0.2];

    const layout = {
      autosize: true,
      margin: { l: 250, r: 50, t: 80, b: 60 },
      paper_bgcolor: themeColors.app,
      plot_bgcolor: "white",
      showlegend: false,
      hovermode: "closest",
      xaxis: {
        title: { text: "Normalized enrichment score", font: { size: 18 } },
        range: xRange,
        side: "bottom",
        showgrid: false,
        zeroline: true,
        zerolinecolor: "black",
      },
      xaxis2: {
        title: { text: "Adjusted P value", font: { size: 18 } },
        type: "log",
        autorange: "reversed",
        overlaying: "x",
        side: "top",
        showgrid: false,
      },
      yaxis: {
        automargin: true,
        tickfont: { size: 14 },
      },
    };

    return { traces, layout };
  }, [plotData, viewDirection]);

  const networkConfig = useMemo(() => {
    if (!plotData || !plotData.table) return null;

    const formatName = (name) => {
      let t = name
        .replace(/HALLMARK_|KEGG_|REACTOME_/gi, "")
        .replace(/_/g, " ")
        .toLowerCase();
      return t.charAt(0).toUpperCase() + t.slice(1);
    };

    // 1. Build ID to Name map from backend network data
    const idToName = {};
    if (plotData.network && plotData.network.nodes) {
      plotData.network.nodes.forEach((n) => {
        idToName[n.id] = n.name;
      });
    }

    // 2. Filter the table to match the view direction
    const activeTable = plotData.table.filter((d) => {
      if (viewDirection === "BOTH") return true;
      return viewDirection === "UP" ? d.NES > 0 : d.NES < 0;
    });

    if (activeTable.length === 0) return null;

    const maxAbsNes = Math.max(...activeTable.map((d) => Math.abs(d.NES)), 1);

    // Create a color scale: Blue -> White -> Red based on NES
    const colorScale = d3
      .scaleLinear()
      .domain([-maxAbsNes, 0, maxAbsNes])
      .range(["#4575b4", "#f7f7f7", "#d73027"]);

    // 3. Create nodes explicitly from the active table so isolated nodes don't disappear
    const nodes = activeTable.map((d) => ({
      id: d.Term, // Use raw term as ID
      displayName: formatName(d.Term),
      nes: d.NES,
      color: colorScale(d.NES),
      val: 6, // Constant size
    }));

    const validTerms = new Set(nodes.map((n) => n.id));
    const links = [];

    // 4. Map edges using the ID->Name dictionary
    if (plotData.network && plotData.network.edges) {
      plotData.network.edges.forEach((e) => {
        const srcName = idToName[String(e.source)];
        const tgtName = idToName[String(e.target)];

        if (validTerms.has(srcName) && validTerms.has(tgtName)) {
          links.push({
            source: srcName,
            target: tgtName,
            weight: e.weight,
          });
        }
      });
    }

    return { nodes, links };
  }, [plotData, viewDirection]);

  // Adjust physics simulation to space nodes further apart
  useEffect(() => {
    if (fgRef.current) {
      fgRef.current.d3Force("charge").strength(-250);
      fgRef.current.d3Force("link").distance(60);
    }
  }, [networkConfig]);

  return (
    <div className="p-6 flex flex-col gap-4 h-full bg-app overflow-y-auto">
      <div className="bg-panel p-4 border border-borderLight shadow-sm rounded flex flex-wrap gap-4 items-end">
        {meta ? (
          <>
            <label className="text-sm font-semibold flex flex-col gap-1">
              <span className="text-textMuted uppercase tracking-wide text-xs">
                Cell Type
              </span>
              <select
                className="border border-borderMain p-2 rounded outline-none focus:border-primary w-48 bg-panel text-textMain h-[38px]"
                value={selectedCellType}
                onChange={(e) => setSelectedCellType(e.target.value)}
              >
                {meta.celltypes.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm font-semibold flex flex-col gap-1">
              <span className="text-textMuted uppercase tracking-wide text-xs">
                Comparison
              </span>
              <select
                className="border border-borderMain p-2 rounded outline-none focus:border-primary w-48 bg-panel text-textMain h-[38px]"
                value={selectedComparison}
                onChange={(e) => setSelectedComparison(e.target.value)}
              >
                {(meta.comparisons[selectedCellType] || []).map((c) => (
                  <option key={c} value={c}>
                    {c.replace("_vs_", " vs ")}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm font-semibold flex flex-col gap-1">
              <span className="text-textMuted uppercase tracking-wide text-xs">
                Database
              </span>
              <select
                className="border border-borderMain p-2 rounded outline-none focus:border-primary w-48 bg-panel text-textMain h-[38px]"
                value={selectedDatabase}
                onChange={(e) => setSelectedDatabase(e.target.value)}
              >
                {meta.databases.map((db) => (
                  <option key={db} value={db}>
                    {db}
                  </option>
                ))}
              </select>
            </label>

            <div className="border-l border-borderMain h-8 mx-2"></div>

            <div className="flex flex-col gap-1">
              <span className="text-textMuted uppercase tracking-wide text-xs">
                Direction
              </span>
              <div className="flex bg-panel border border-borderMain rounded overflow-hidden shadow-sm h-[38px]">
                <button
                  onClick={() => setViewDirection("UP")}
                  className={`px-3 text-xs font-bold transition-colors ${
                    viewDirection === "UP"
                      ? "bg-danger-light text-danger-dark border-r border-borderMain"
                      : "text-textMain hover:bg-borderLight border-r border-borderMain"
                  }`}
                >
                  UP
                </button>
                <button
                  onClick={() => setViewDirection("BOTH")}
                  className={`px-3 text-xs font-bold transition-colors ${
                    viewDirection === "BOTH"
                      ? "bg-textMuted text-textInverse border-r border-borderMain"
                      : "text-textMain hover:bg-borderLight border-r border-borderMain"
                  }`}
                >
                  BOTH
                </button>
                <button
                  onClick={() => setViewDirection("DOWN")}
                  className={`px-3 text-xs font-bold transition-colors ${
                    viewDirection === "DOWN"
                      ? "bg-primary-light text-primary-dark"
                      : "text-textMain hover:bg-borderLight"
                  }`}
                >
                  DOWN
                </button>
              </div>
            </div>

            <div className="border-l border-borderMain h-8 mx-2"></div>

            <label className="text-sm font-semibold flex flex-col gap-1">
              <span className="text-textMuted uppercase tracking-wide text-xs">
                Min Size
              </span>
              <input
                type="number"
                value={minSize}
                onChange={(e) => setMinSize(e.target.value)}
                className="border border-borderMain outline-none focus:border-primary px-2 rounded w-20 bg-panel text-textMain h-[38px]"
              />
            </label>
            <label className="text-sm font-semibold flex flex-col gap-1">
              <span className="text-textMuted uppercase tracking-wide text-xs">
                Max Size
              </span>
              <input
                type="number"
                value={maxSize}
                onChange={(e) => setMaxSize(e.target.value)}
                className="border border-borderMain outline-none focus:border-primary px-2 rounded w-20 bg-panel text-textMain h-[38px]"
              />
            </label>
            <label className="text-sm font-semibold flex flex-col gap-1">
              <span className="text-textMuted uppercase tracking-wide text-xs">
                Max P-Adj
              </span>
              <input
                type="number"
                step="0.01"
                value={padjThreshold}
                onChange={(e) => setPadjThreshold(e.target.value)}
                className="border border-borderMain outline-none focus:border-primary px-2 rounded w-20 bg-panel text-textMain h-[38px]"
              />
            </label>
            <label className="text-sm font-semibold flex flex-col gap-1">
              <span className="text-textMuted uppercase tracking-wide text-xs">
                Min NES
              </span>
              <input
                type="number"
                step="0.1"
                value={nesThreshold}
                onChange={(e) => setNesThreshold(e.target.value)}
                className="border border-borderMain outline-none focus:border-primary px-2 rounded w-20 bg-panel text-textMain h-[38px]"
              />
            </label>

            <div className="border-l border-borderMain h-8 mx-2"></div>

            <label className="text-sm font-semibold flex flex-col gap-1">
              <span className="text-textMuted uppercase tracking-wide text-xs">
                Node Size
              </span>
              <div className="h-[38px] flex items-center">
                <input
                  type="range"
                  min="0.2"
                  max="10.0"
                  step="0.1"
                  value={nodeSizeMultiplier}
                  onChange={(e) =>
                    setNodeSizeMultiplier(Number(e.target.value))
                  }
                  className="w-28 accent-primary cursor-pointer"
                  title="Adjust the size of the Network Map nodes"
                />
              </div>
            </label>

            {(() => {
              const isDirty =
                appliedParams &&
                (selectedCellType !== appliedParams.celltype ||
                  selectedComparison !== appliedParams.comparison ||
                  selectedDatabase !== appliedParams.database ||
                  Number(minSize) !== Number(appliedParams.minSize) ||
                  Number(maxSize) !== Number(appliedParams.maxSize) ||
                  Number(padjThreshold) !==
                    Number(appliedParams.padjThreshold) ||
                  Number(nesThreshold) !== Number(appliedParams.nesThreshold));

              return (
                <button
                  onClick={runInteractiveGSEA}
                  disabled={isComputing}
                  className={`ml-auto flex items-center justify-center font-bold px-4 h-[38px] rounded shadow-sm transition-all disabled:opacity-50 ${
                    isDirty
                      ? "bg-warning text-textInverse border border-warning-dark hover:bg-warning-dark shadow-md animate-pulse"
                      : "bg-primary text-textInverse hover:bg-primary-dark"
                  }`}
                >
                  {isComputing
                    ? "Computing..."
                    : isDirty
                      ? "Update Interactive GSEA"
                      : "Run Interactive GSEA"}
                </button>
              );
            })()}

            <InfoModal
              title="Interactive GSEA"
              content={
                <p>
                  Perform instantaneous Gene Set Enrichment Analysis across
                  selected pathways using pre-calculated differential expression
                  rankings.
                </p>
              }
            />
          </>
        ) : (
          <div className="text-sm text-textMuted">Loading GSEA metadata...</div>
        )}
      </div>

      <div className="flex-1 flex gap-4 min-h-0">
        <div className="w-1/2 bg-panel border border-borderLight shadow-sm rounded flex flex-col p-4">
          <h3 className="font-bold text-textMain text-sm mb-2 text-center">
            Pathway Enrichment Profile
          </h3>
          {errorMsg && (
            <div className="bg-danger-light text-danger-dark p-3 rounded mb-4 text-sm font-bold border border-danger">
              Error: {errorMsg}
            </div>
          )}

          {isComputing ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-lg font-semibold text-primary animate-pulse">
                Running Fast GSEA...
              </div>
            </div>
          ) : dualPlotConfig ? (
            <div className="flex-1 min-h-0">
              <Plot
                data={dualPlotConfig.traces}
                layout={dualPlotConfig.layout}
                useResizeHandler={true}
                style={{ width: "100%", height: "100%" }}
                config={{ displayModeBar: true }}
                onHover={(e) => {
                  if (e.points && e.points.length > 0) {
                    setHoveredPathway(e.points[0].y);
                  }
                }}
                onUnhover={() => setHoveredPathway(null)}
              />
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-textMuted font-medium">
              No significant {viewDirection} pathways found.
            </div>
          )}
        </div>

        <div className="w-1/2 bg-panel border border-borderLight shadow-sm rounded flex flex-col p-4">
          <h3 className="font-bold text-textMain text-sm mb-2 text-center">
            Enrichment Network Map
          </h3>
          <div className="flex-1 min-h-0 relative" ref={graphContainerRef}>
            {isComputing ? (
              <div className="flex h-full items-center justify-center">
                <div className="text-lg font-semibold text-primary animate-pulse">
                  Building Network...
                </div>
              </div>
            ) : networkConfig && networkConfig.nodes.length > 0 ? (
              <ForceGraph2D
                ref={fgRef}
                width={graphDim.width}
                height={graphDim.height}
                graphData={networkConfig}
                backgroundColor={themeColors.paper}
                d3VelocityDecay={0.3}
                linkColor={() => "#CDDBD4"}
                linkWidth={(link) => link.weight * 5}
                onNodeHover={(node) => {
                  setHoveredPathway(node ? node.displayName : null);
                  document.body.style.cursor = node ? "pointer" : "default";
                }}
                nodeCanvasObject={(node, ctx, globalScale) => {
                  const isHovered = hoveredPathway === node.displayName;
                  // Dynamically scale node based on UI slider
                  const size = node.val * nodeSizeMultiplier;

                  // Draw Node
                  ctx.beginPath();
                  ctx.arc(node.x, node.y, size, 0, 2 * Math.PI, false);
                  ctx.fillStyle = node.color;
                  ctx.fill();

                  // Highlight / Stroke
                  if (isHovered) {
                    ctx.lineWidth = 3 / globalScale;
                    ctx.strokeStyle = "#000000";
                    ctx.stroke();

                    // Draw Label if hovered
                    const label = node.displayName;
                    const fontSize = 13 / globalScale;
                    ctx.font = `bold ${fontSize}px Sans-Serif`;
                    ctx.fillStyle = "#000000";
                    ctx.textAlign = "center";
                    ctx.fillText(label, node.x, node.y + size + fontSize + 2);
                  } else {
                    ctx.lineWidth = 1 / globalScale;
                    ctx.strokeStyle = "#999999";
                    ctx.stroke();
                  }
                }}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-textMuted font-medium text-center px-4">
                Not enough overlapping genes to build a network map for{" "}
                {viewDirection} pathways.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
