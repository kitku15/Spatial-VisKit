import { useState, useEffect, useMemo } from "react";
import Plotly from "plotly.js-dist-min";
import factory from "react-plotly.js/factory";
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
  const [viewDirection, setViewDirection] = useState("UP");

  // Tracks the parameters of the currently displayed plot
  const [appliedParams, setAppliedParams] = useState(null);

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
    if (!plotData || plotData.length === 0) return null;

    // Filter by user-selected direction
    const filtered = plotData.filter((d) =>
      viewDirection === "UP" ? d.NES > 0 : d.NES < 0,
    );

    if (filtered.length === 0) return null;

    // Take top 15 by absolute NES
    const sorted = [...filtered]
      .sort((a, b) => Math.abs(b.NES) - Math.abs(a.NES))
      .slice(0, 15)
      .reverse(); // Reverse for horizontal bar plot (highest at top)

    const terms = sorted.map((d) => {
      let t = d.Term.replace(/HALLMARK_|KEGG_|REACTOME_/gi, "");
      t = t.replace(/_/g, " ").toLowerCase();
      return t.charAt(0).toUpperCase() + t.slice(1);
    });

    const nes = sorted.map((d) => d.NES);
    // Clamp the p-value at 1e-15 so extremely significant dots don't vanish into infinity
    const pvals = sorted.map((d) => Math.max(d["FDR q-val"], 1e-15));

    const barColor = viewDirection === "UP" ? "#ded328" : "#4682B4";

    const traces = [
      {
        type: "bar",
        x: nes,
        y: terms,
        orientation: "h",
        marker: { color: barColor },
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

    const maxAbsNes = Math.max(...nes.map(Math.abs)) + 0.2;

    const layout = {
      autosize: true,
      margin: { l: 250, r: 50, t: 80, b: 60 },
      paper_bgcolor: themeColors.app,
      plot_bgcolor: "white",
      showlegend: false,
      xaxis: {
        title: { text: "Normalized enrichment score", font: { size: 18 } },
        range: viewDirection === "UP" ? [-0.2, maxAbsNes] : [-maxAbsNes, 0.2],
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
                className="border border-borderMain p-2 rounded outline-none w-48 bg-panel text-textMain"
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
                className="border border-borderMain p-2 rounded outline-none w-48 bg-panel text-textMain"
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
                className="border border-borderMain p-2 rounded outline-none w-48 bg-panel text-textMain"
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
                      ? "bg-warning text-textInverse"
                      : "text-textMain hover:bg-borderLight"
                  }`}
                >
                  UP
                </button>
                <button
                  onClick={() => setViewDirection("DOWN")}
                  className={`px-3 text-xs font-bold transition-colors ${
                    viewDirection === "DOWN"
                      ? "bg-primary text-textInverse"
                      : "text-textMain hover:bg-borderLight"
                  }`}
                >
                  DOWN
                </button>
              </div>
            </div>

            <div className="border-l border-borderMain h-8 mx-2"></div>

            <label className="text-sm font-semibold flex flex-col gap-1">
              <span className="text-textMuted text-xs">Min Size</span>
              <input
                type="number"
                value={minSize}
                onChange={(e) => setMinSize(e.target.value)}
                className="border p-2 rounded w-20 bg-panel text-textMain"
              />
            </label>
            <label className="text-sm font-semibold flex flex-col gap-1">
              <span className="text-textMuted text-xs">Max Size</span>
              <input
                type="number"
                value={maxSize}
                onChange={(e) => setMaxSize(e.target.value)}
                className="border p-2 rounded w-20 bg-panel text-textMain"
              />
            </label>
            <label className="text-sm font-semibold flex flex-col gap-1">
              <span className="text-textMuted text-xs">Max P-Adj</span>
              <input
                type="number"
                step="0.01"
                value={padjThreshold}
                onChange={(e) => setPadjThreshold(e.target.value)}
                className="border p-2 rounded w-20 bg-panel text-textMain"
              />
            </label>
            <label className="text-sm font-semibold flex flex-col gap-1">
              <span className="text-textMuted text-xs">Min NES</span>
              <input
                type="number"
                step="0.1"
                value={nesThreshold}
                onChange={(e) => setNesThreshold(e.target.value)}
                className="border p-2 rounded w-20 bg-panel text-textMain"
              />
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
                  className={`ml-auto flex items-center justify-center font-bold px-4 py-2 rounded shadow-sm transition-all disabled:opacity-50 ${
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

      <div className="flex-1 bg-panel border border-borderLight shadow-sm rounded flex flex-col p-4">
        {errorMsg && (
          <div className="bg-danger-light text-danger-dark p-3 rounded mb-4 text-sm font-bold border border-danger">
            Error: {errorMsg}
          </div>
        )}

        {isComputing ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-lg font-semibold text-primary animate-pulse">
              Running Fast GSEA Backend Task...
            </div>
          </div>
        ) : dualPlotConfig ? (
          <Plot
            data={dualPlotConfig.traces}
            layout={dualPlotConfig.layout}
            useResizeHandler={true}
            style={{ width: "100%", height: "100%" }}
            config={{ displayModeBar: true }}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-textMuted font-medium">
            No significant {viewDirection} pathways found for the given
            criteria.
          </div>
        )}
      </div>
    </div>
  );
}
