import { useState, useEffect, useMemo, useRef } from "react";
import Plotly from "plotly.js-dist-min";
import factory from "react-plotly.js/factory";
import * as d3 from "d3";
import InfoModal from "../components/ui/InfoModal";
import { tabInfo } from "../constants/infoHelper";
import { themeColors, API_BASE_URL } from "../config/config";

const createPlotlyComponent =
  typeof factory === "function" ? factory : factory.default;
const Plot = createPlotlyComponent(Plotly);

function SearchableSelect({ options, value, onChange, placeholder }) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const wrapperRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target))
        setIsOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = useMemo(() => {
    const query = search.toLowerCase();
    return options.filter((opt) => opt.original.toLowerCase().includes(query));
  }, [options, search]);

  return (
    <div ref={wrapperRef} className="relative flex-1 max-w-[250px]">
      <div
        className="border border-borderMain bg-panel px-3 h-9 rounded flex items-center justify-between cursor-text"
        onClick={() => setIsOpen(true)}
      >
        <input
          type="text"
          className="outline-none w-full text-sm px-1 bg-transparent text-textMain"
          placeholder={value ? value.original : placeholder}
          value={isOpen ? search : value ? value.original : ""}
          onChange={(e) => {
            setSearch(e.target.value);
            setIsOpen(true);
          }}
        />
        <button
          className="text-textMuted px-1 text-xs cursor-pointer hover:text-textMain"
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(!isOpen);
          }}
        >
          ▼
        </button>
      </div>
      {isOpen && (
        <div className="absolute z-20 w-full mt-1 bg-panel border border-borderMain rounded shadow-lg max-h-48 overflow-y-auto">
          {filteredOptions.length > 0 ? (
            filteredOptions.map((opt) => (
              <div
                key={opt.safe}
                className="p-2 text-sm text-textMain hover:bg-primary-light cursor-pointer"
                onClick={() => {
                  onChange(opt);
                  setSearch("");
                  setIsOpen(false);
                }}
              >
                {opt.original}
              </div>
            ))
          ) : (
            <div className="p-2 text-sm text-textMuted italic">
              No genes found
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ConditionsDE() {
  const [config, setConfig] = useState(null);
  const [comparisonsMap, setComparisonsMap] = useState({});
  const [availableGenes, setAvailableGenes] = useState([]);

  const [selectedCellType, setSelectedCellType] = useState("");
  const [selectedComparison, setSelectedComparison] = useState("");

  const [panelGenes, setPanelGenes] = useState([null, null, null]);

  const [volcanoData, setVolcanoData] = useState(null);
  const [summaryTable, setSummaryTable] = useState([]);
  const [cellClusters, setCellClusters] = useState(null);
  const [geneExpressions, setGeneExpressions] = useState({});
  const [filterZeros, setFilterZeros] = useState(false);
  const [plotType, setPlotType] = useState("volcano");

  useEffect(() => {
    async function initData() {
      try {
        const dataUrl = new URLSearchParams(window.location.search)
          .get("data")
          ?.replace(/\/$/, "");
        const configB64 =
          new URLSearchParams(window.location.search).get("config") || "";
        if (!dataUrl) return;

        const [metaRes, genesRes, clustersRes] = await Promise.all([
          fetch(
            `${dataUrl}/aux_data/conditions_de_analysis/conditions_de_metadata.json`,
          ),
          fetch(
            `${API_BASE_URL}/api/genes?data_url=${encodeURIComponent(dataUrl)}`,
          ),
          fetch(
            `${API_BASE_URL}/api/obs?data_url=${encodeURIComponent(dataUrl)}&config_b64=${configB64}`,
          ),
        ]);

        if (!metaRes.ok || !genesRes.ok || !clustersRes.ok) {
          throw new Error("One or more API requests failed.");
        }

        const meta = await metaRes.json();
        const genes = await genesRes.json();
        const clusters = await clustersRes.json();

        setConfig(meta.config);
        setComparisonsMap(meta.comparisons);
        setAvailableGenes(genes);
        setCellClusters(clusters);

        const cellTypes = Object.keys(meta.comparisons);
        if (cellTypes.length > 0) {
          setSelectedCellType(cellTypes[0]);
          if (meta.comparisons[cellTypes[0]].length > 0) {
            setSelectedComparison(meta.comparisons[cellTypes[0]][0]);
          }
        }
      } catch {
        console.warn("Conditions DE Analysis data not found.");
      }
    }
    initData();
  }, []);

  useEffect(() => {
    if (!selectedCellType || !selectedComparison) return;
    const dataUrl = new URLSearchParams(window.location.search)
      .get("data")
      ?.replace(/\/$/, "");
    if (!dataUrl) return;

    fetch(
      `${dataUrl}/aux_data/conditions_de_analysis/${selectedCellType}_comparison_${selectedComparison}.json`,
    )
      .then((r) => {
        if (!r.ok) throw new Error("Volcano data fetch failed");
        return r.json();
      })
      .then(setVolcanoData)
      .catch(() => setVolcanoData(null));

    d3.csv(
      `${dataUrl}/aux_data/conditions_de_analysis/summary_${selectedCellType}.csv`,
    )
      .then((data) => {
        const compRow = data.find((d) => d.Comparison === selectedComparison);
        if (compRow) {
          const upList = compRow["Top Upregulated"]
            .replace(/[[\]']/g, "")
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
          const downList = compRow["Top Downregulated"]
            .replace(/[[\]']/g, "")
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);

          const defaultGeneNames = [
            ...upList.slice(0, 2),
            ...downList.slice(0, 1),
          ];
          const initialGenes = defaultGeneNames
            .map((name) => availableGenes.find((g) => g.original === name))
            .filter(Boolean);

          const paddedGenes = [
            initialGenes[0] || null,
            initialGenes[1] || null,
            initialGenes[2] || null,
          ];

          setPanelGenes((prev) =>
            prev.every((g) => g === null) ? paddedGenes : prev,
          );
          setSummaryTable([compRow]);
        }
      })
      .catch((err) => console.warn(err));
  }, [selectedCellType, selectedComparison, availableGenes]);

  useEffect(() => {
    const dataUrl = new URLSearchParams(window.location.search)
      .get("data")
      ?.replace(/\/$/, "");
    if (!dataUrl) return;

    panelGenes.forEach((g) => {
      if (g && !geneExpressions[g.safe]) {
        fetch(
          `${API_BASE_URL}/api/expression/${encodeURIComponent(g.safe)}?data_url=${encodeURIComponent(dataUrl)}`,
        )
          .then((r) => {
            if (!r.ok) throw new Error("Expression fetch failed");
            return r.json();
          })
          .then((data) => {
            setGeneExpressions((prev) => ({ ...prev, ...data }));
          })
          .catch((err) => console.error(err));
      }
    });
  }, [panelGenes, geneExpressions]);

  const handleGeneChange = (index, newGene) => {
    const updated = [...panelGenes];
    updated[index] = newGene;
    setPanelGenes(updated);
  };

  const [testCond, refCond] = selectedComparison
    ? selectedComparison.split("_vs_")
    : ["Test", "Ref"];

  const downloadFullTable = () => {
    if (!volcanoData || !volcanoData.names) return;

    // Dynamically grab all columns (names, logfc, pvals, scores, etc.)
    const keys = Object.keys(volcanoData);
    const cols = ["names", ...keys.filter((k) => k !== "names")]; // Ensure 'names' (Gene) is first

    // Build CSV string
    let csvContent =
      cols.map((c) => (c === "names" ? "Gene" : c)).join(",") + "\n";
    const numRows = volcanoData.names.length;

    for (let i = 0; i < numRows; i++) {
      const row = cols.map((col) => volcanoData[col][i]);
      csvContent += row.join(",") + "\n";
    }

    // Trigger download
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Conditions_DE_${selectedCellType}_${selectedComparison}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const plotConfig = useMemo(() => {
    if (!volcanoData) return null;

    const colors = [];
    const hover = [];
    const xVals = [];
    const yVals = [];

    for (let i = 0; i < volcanoData.names.length; i++) {
      let fc = volcanoData.logfc[i];
      let p = Math.max(volcanoData.pvals[i], 1e-300);
      let bm = volcanoData.baseMean ? volcanoData.baseMean[i] : 0;
      let logp = -Math.log10(p);

      if (fc > 0.5 && p < 0.05) colors.push(themeColors.danger);
      else if (fc < -0.5 && p < 0.05) colors.push(themeColors.primary);
      else colors.push(themeColors.neutral);

      hover.push(
        `<b>${volcanoData.names[i]}</b><br>Base Mean: ${bm.toFixed(2)}<br>Log2FC: ${fc}<br>Adj P: ${p.toExponential(2)}`,
      );

      if (plotType === "volcano") {
        xVals.push(fc);
        yVals.push(logp);
      } else {
        // MA Plot: X is Base Mean (clamp at 1e-3 so log scale doesn't break on 0s), Y is Log2FC
        xVals.push(Math.max(bm, 1e-3));
        yVals.push(fc);
      }
    }

    const traces = [
      {
        x: xVals,
        y: yVals,
        text: hover,
        mode: "markers",
        type: "scattergl",
        hoverinfo: "text",
        marker: { color: colors, size: 6, opacity: 0.7 },
      },
    ];

    const layout = {
      autosize: true,
      showlegend: false,
      margin: { l: 50, r: 20, t: 10, b: 40 },
      paper_bgcolor: themeColors.paper,
      plot_bgcolor: themeColors.paper,
      font: { color: themeColors.label },
    };

    if (plotType === "volcano") {
      layout.xaxis = {
        title: "Log2 Fold Change",
        zeroline: true,
        zerolinecolor: themeColors.border,
      };
      layout.yaxis = {
        title: "-Log10(Adj. P-Value)",
        zeroline: true,
        zerolinecolor: themeColors.border,
      };
    } else {
      layout.xaxis = {
        title: "Mean Expression (baseMean)",
        type: "log",
        zeroline: false,
      };
      layout.yaxis = {
        title: "Log2 Fold Change",
        zeroline: true,
        zerolinecolor: themeColors.border,
      };
      layout.shapes = [
        {
          type: "line",
          xref: "paper",
          x0: 0,
          x1: 1,
          yref: "y",
          y0: 0,
          y1: 0,
          line: { color: "black", width: 1, dash: "dot" },
          opacity: 0.5,
        },
      ];
    }

    return { traces, layout };
  }, [volcanoData, plotType]);

  const createSingleSplitViolin = (gene) => {
    if (!config || !cellClusters || !gene || !geneExpressions[gene.safe])
      return null;

    const cellTypeArr = cellClusters[config.celltype_col];
    const treatArr = cellClusters[config.treatment_col];
    const exprData = geneExpressions[gene.safe];

    if (!cellTypeArr || !treatArr || !exprData || !exprData.i) return null;

    const norm = (s) =>
      String(s || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
    const normTargetCT = norm(selectedCellType);
    const normTest = norm(testCond);
    const normRef = norm(refCond);

    const dense = new Float32Array(cellTypeArr.length);
    exprData.i.forEach((idx, k) => (dense[idx] = exprData.v[k]));

    const testVals = [];
    const refVals = [];

    for (let i = 0; i < cellTypeArr.length; i++) {
      if (norm(cellTypeArr[i]) === normTargetCT) {
        const treat = norm(treatArr[i]);
        const val = dense[i];

        if (filterZeros && val === 0) continue;

        if (treat === normTest) testVals.push(val);
        if (treat === normRef) refVals.push(val);
      }
    }

    const testMean =
      testVals.length > 0
        ? testVals.reduce((a, b) => a + b, 0) / testVals.length
        : 0;
    const refMean =
      refVals.length > 0
        ? refVals.reduce((a, b) => a + b, 0) / refVals.length
        : 0;

    const meanShapes = [
      {
        type: "line",
        xref: "paper",
        x0: 0,
        x1: 1,
        yref: "y",
        y0: testMean,
        y1: testMean,
        line: { color: themeColors.danger, dash: "dot", width: 2 },
        opacity: 0.8,
      },
      {
        type: "line",
        xref: "paper",
        x0: 0,
        x1: 1,
        yref: "y",
        y0: refMean,
        y1: refMean,
        line: { color: themeColors.primary, dash: "dot", width: 2 },
        opacity: 0.8,
      },
    ];

    return {
      traces: [
        {
          type: "violin",
          name: testCond,
          y: testVals,
          x: Array(testVals.length).fill(gene.original),
          legendgroup: testCond,
          scalegroup: "group",
          side: "positive",
          line: { color: themeColors.danger },
          meanline: { visible: false },
          points: false,
          spanmode: "hard",
          box: { visible: false },
        },
        {
          type: "violin",
          name: refCond,
          y: refVals,
          x: Array(refVals.length).fill(gene.original),
          legendgroup: refCond,
          scalegroup: "group",
          side: "negative",
          line: { color: themeColors.primary },
          meanline: { visible: false },
          points: false,
          spanmode: "hard",
          box: { visible: false },
        },
      ],
      shapes: meanShapes,
    };
  };

  return (
    <div className="p-6 flex flex-col gap-4 h-full bg-app overflow-y-auto">
      <div className="bg-panel p-4 border border-borderLight shadow-sm rounded flex flex-wrap gap-6 items-end">
        <label className="text-sm font-semibold flex flex-col gap-1">
          <span className="text-textMuted uppercase tracking-wide text-xs">
            Cell Type
          </span>
          <select
            className="border border-borderMain px-3 h-9 rounded outline-none w-64 bg-panel text-textMain focus:border-primary"
            value={selectedCellType}
            onChange={(e) => {
              const newCellType = e.target.value;
              setSelectedCellType(newCellType);
              setPanelGenes([null, null, null]);
              const availableComparisons = comparisonsMap[newCellType] || [];
              setSelectedComparison(availableComparisons[0] || "");
            }}
          >
            {Object.keys(comparisonsMap).map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm font-semibold flex flex-col gap-1">
          <span className="text-primary-dark uppercase tracking-wide text-xs">
            Pairwise Comparison
          </span>
          <select
            className="border border-primary bg-primary-light text-primary-dark px-3 h-9 rounded outline-none w-64 focus:ring-1 focus:ring-primary"
            value={selectedComparison}
            onChange={(e) => {
              setSelectedComparison(e.target.value);
              setPanelGenes([null, null, null]);
            }}
          >
            {(comparisonsMap[selectedCellType] || []).map((c) => (
              <option key={c} value={c}>
                {c.replace("_vs_", " vs ")}
              </option>
            ))}
          </select>
        </label>

        <div className="ml-auto flex items-center gap-5 h-9">
          <label className="flex items-center h-full gap-2 text-sm text-textMuted cursor-pointer font-semibold hover:text-textMain">
            <input
              type="checkbox"
              checked={filterZeros}
              onChange={(e) => setFilterZeros(e.target.checked)}
              className="cursor-pointer w-4 h-4 accent-primary"
            />
            Hide Zeros
          </label>

          <div className="border-l border-borderMain h-8 mx-1"></div>

          <button
            onClick={downloadFullTable}
            disabled={!volcanoData}
            className="flex items-center justify-center gap-2 px-3 h-9 text-xs font-bold text-textMain bg-panel border border-borderMain rounded hover:border-primary hover:text-primary transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            title="Download Full Differential Expression Table (CSV)"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              ></path>
            </svg>
            Export Stats Table
          </button>

          <InfoModal
            title={tabInfo.conditionsDe.title}
            content={tabInfo.conditionsDe.content}
          />
        </div>
      </div>

      <div className="flex gap-4 h-[350px] shrink-0">
        <div className="w-1/2 bg-panel border border-borderLight shadow-sm rounded p-4 flex flex-col relative">
          <div className="flex justify-between items-center mb-1">
            <h3 className="font-bold text-textMain text-sm">
              Differential Expression
            </h3>
            <div className="flex bg-app border border-borderMain rounded overflow-hidden shadow-sm">
              <button
                onClick={() => setPlotType("volcano")}
                className={`px-3 py-1 text-xs font-bold transition-colors ${
                  plotType === "volcano"
                    ? "bg-primary text-textInverse"
                    : "text-textMain hover:bg-borderLight"
                }`}
              >
                Volcano Plot
              </button>
              <button
                onClick={() => setPlotType("ma")}
                className={`px-3 py-1 text-xs font-bold transition-colors ${
                  plotType === "ma"
                    ? "bg-primary text-textInverse"
                    : "text-textMain hover:bg-borderLight"
                }`}
              >
                MA Plot
              </button>
            </div>
          </div>
          <div className="flex-1 min-h-0 mt-2">
            {plotConfig ? (
              <Plot
                data={plotConfig.traces}
                layout={plotConfig.layout}
                useResizeHandler={true}
                style={{ width: "100%", height: "100%" }}
                config={{ displayModeBar: true }}
              />
            ) : (
              <div className="flex justify-center items-center h-full text-textMuted">
                Loading Data...
              </div>
            )}
          </div>
        </div>

        <div className="w-1/2 bg-panel border border-borderLight shadow-sm rounded flex flex-col overflow-hidden">
          <div className="bg-app border-b border-borderMain px-4 py-2">
            <h3 className="font-bold text-sm text-textMain">
              Top DE Genes for {selectedCellType}
            </h3>
          </div>
          <div className="flex-1 overflow-auto p-4">
            {summaryTable.length > 0 ? (
              <div className="flex flex-col gap-6">
                <div>
                  <h4 className="text-sm font-bold text-danger-dark mb-2 border-b border-borderLight pb-1">
                    Upregulated in {testCond}
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {summaryTable[0]["Top Upregulated"]
                      .replace(/[[\]']/g, "")
                      .split(",")
                      .map((g) => (
                        <span
                          key={g}
                          className="bg-danger-light text-danger-dark border border-danger-light px-2 py-1 rounded text-sm"
                        >
                          {g.trim()}
                        </span>
                      ))}
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-primary-dark mb-2 border-b border-borderLight pb-1">
                    Upregulated in {refCond}
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {summaryTable[0]["Top Downregulated"]
                      .replace(/[[\]']/g, "")
                      .split(",")
                      .map((g) => (
                        <span
                          key={g}
                          className="bg-primary-light text-primary-dark border border-primary-light px-2 py-1 rounded text-sm"
                        >
                          {g.trim()}
                        </span>
                      ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-textMuted text-center mt-10">
                No summary data available.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 flex-1">
        {panelGenes.map((gene, index) => {
          const plotData = createSingleSplitViolin(gene);

          return (
            <div
              key={index}
              className="bg-panel border border-borderLight shadow-sm rounded p-3 flex flex-col min-h-[300px]"
            >
              <div className="flex justify-between items-center mb-2 z-10">
                <span className="font-bold text-xs text-textMuted uppercase">
                  Panel {index + 1}
                </span>
                <SearchableSelect
                  options={availableGenes}
                  value={gene}
                  onChange={(newGene) => handleGeneChange(index, newGene)}
                  placeholder="Select a gene..."
                />
              </div>

              <div className="flex-1 relative">
                {!gene ? (
                  <div className="flex justify-center items-center h-full text-textMuted text-sm">
                    Select a gene above to view distribution
                  </div>
                ) : plotData ? (
                  <Plot
                    data={plotData.traces}
                    layout={{
                      autosize: true,
                      violinmode: "overlay",
                      shapes: plotData.shapes,
                      xaxis: {
                        showticklabels: false,
                        title: { text: "Conditions", standoff: 10 },
                        automargin: true,
                      },
                      yaxis: {
                        title:
                          index === 0
                            ? {
                                text: "Log Normalized Expression",
                                standoff: 10,
                              }
                            : "",
                        automargin: true,
                        zeroline: false,
                      },
                      showlegend: false,
                      margin: { l: index === 0 ? 50 : 30, r: 20, t: 10, b: 20 },
                      paper_bgcolor: themeColors.paper,
                      plot_bgcolor: themeColors.paper,
                      font: { color: themeColors.label },
                    }}
                    useResizeHandler={true}
                    style={{ width: "100%", height: "100%" }}
                  />
                ) : (
                  <div className="flex justify-center items-center h-full text-textMuted text-sm">
                    Loading {gene.original}...
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
