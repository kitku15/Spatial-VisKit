import React, { useState, useEffect, useMemo, useRef } from "react";
import Plotly from "plotly.js-dist-min";
import factory from "react-plotly.js/factory";
import * as d3 from "d3";
import { largeColorPalette, themeColors, DATA_DIR, API_BASE_URL } from "./config";
import InfoModal from "./InfoModal";
import { tabInfo } from "./infoHelper";

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

  const filteredOptions = options.filter((opt) =>
    opt.original.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div ref={wrapperRef} className="relative flex-1 max-w-[200px]">
      <div
        className="border border-borderMain bg-panel p-1 rounded flex items-center justify-between cursor-text"
        onClick={() => setIsOpen(true)}
      >
        <input
          type="text"
          className="outline-none w-full text-xs px-1 bg-transparent text-textMain"
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
        <div className="absolute z-10 w-full mt-1 bg-panel border border-borderMain rounded shadow-lg max-h-48 overflow-y-auto">
          {filteredOptions.length > 0 ? (
            filteredOptions.map((opt) => (
              <div
                key={opt.safe}
                className="p-2 text-xs text-textMain hover:bg-primary-light cursor-pointer"
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
            <div className="p-2 text-xs text-textMuted italic">
              No genes found
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function DEAnalysis({ customColors = {} }) {
  const [annotations, setAnnotations] = useState([]);
  const [selectedAnnotation, setSelectedAnnotation] = useState("");
  const [selectedCluster, setSelectedCluster] = useState("");

  const [topGenesTable, setTopGenesTable] = useState([]);
  const [volcanoData, setVolcanoData] = useState(null);

  const [clusterLabels, setClusterLabels] = useState(null);
  const [availableGenes, setAvailableGenes] = useState([]);

  const [gene1, setGene1] = useState(null);
  const [expr1, setExpr1] = useState(null);
  const [chunkIndex, setChunkIndex] = useState({});


  useEffect(() => {
    async function initData() {
      const meta = await fetch(`${API_BASE_URL}/${DATA_DIR}/de_analysis/de_metadata.json`).then((r) =>
        r.json(),
      );
      const annos = Object.keys(meta);
      setAnnotations(annos);
      if (annos.length > 0) setSelectedAnnotation(annos[0]);
      fetch(`${API_BASE_URL}/api/obs`)
        .then((r) => r.json())
        .then(setClusterLabels);
      fetch(`${API_BASE_URL}/api/genes`)
        .then((r) => r.json())
        .then(setAvailableGenes);
    }
    initData();
  }, []);

  useEffect(() => {
    if (!selectedAnnotation) return;
    async function fetchTable() {
      const tableCsv = await d3.csv(
        `${API_BASE_URL}/${DATA_DIR}/de_analysis/top_DEgenes_${selectedAnnotation}.csv`,
      );
      setTopGenesTable(tableCsv);
      if (tableCsv.length > 0) setSelectedCluster(tableCsv[0]["Cluster Name"]);
    }
    fetchTable();
  }, [selectedAnnotation]);

  useEffect(() => {
    if (!selectedAnnotation || !selectedCluster || topGenesTable.length === 0)
      return;

    const clusterRow = topGenesTable.find(
      (r) => r["Cluster Name"] === selectedCluster,
    );
    if (clusterRow && clusterRow["Top Genes"] && availableGenes.length > 0) {
      const topStr = clusterRow["Top Genes"].replace(/[\[\]']/g, "");
      const topArr = topStr.split(",").map((s) => s.trim());
      if (topArr.length >= 1) {
        setGene1(
          availableGenes.find((g) => g.original === topArr[0]) ||
            availableGenes[0],
        );
      }
    }

    const safeCluster = selectedCluster
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "_");
    fetch(`${API_BASE_URL}/${DATA_DIR}/de_analysis/${selectedAnnotation}_cluster_${safeCluster}.json`)
      .then((r) => r.json())
      .then(setVolcanoData)
      .catch(() => setVolcanoData(null));
  }, [selectedAnnotation, selectedCluster, availableGenes, topGenesTable]);

  useEffect(() => {
    if (gene1) {
      fetch(`${API_BASE_URL}/api/expression/${encodeURIComponent(gene1.safe)}`)
        .then((r) => r.json())
        .then((data) => setExpr1(data[gene1.safe]));
    }
  }, [gene1]);

  const clusterColorMap = useMemo(() => {
    if (
      !clusterLabels ||
      !selectedAnnotation ||
      !clusterLabels[selectedAnnotation]
    )
      return {};
    const uniqueClusters = Array.from(
      new Set(clusterLabels[selectedAnnotation]),
    ).sort();
    const map = {};
    uniqueClusters.forEach(
      (c, i) => (map[c] = customColors[c] || largeColorPalette[i % largeColorPalette.length]),
    );
    return map;
  }, [clusterLabels, selectedAnnotation, customColors]);

  const volcanoPlot = useMemo(() => {
    if (!volcanoData) return null;
    const colors = [];
    const hover = [];
    const logp = [];

    for (let i = 0; i < volcanoData.names.length; i++) {
      let fc = volcanoData.logfc[i];
      let p = Math.max(volcanoData.pvals[i], 1e-300);
      logp.push(-Math.log10(p));

      hover.push(
        `<b>${volcanoData.names[i]}</b><br>Log2FC: ${fc}<br>Adj P: ${p.toExponential(2)}`,
      );
      if (fc > 1 && p < 0.05) colors.push(themeColors.danger);
      else if (fc < -1 && p < 0.05) colors.push(themeColors.primary);
      else colors.push(themeColors.neutral);
    }

    return [
      {
        x: volcanoData.logfc,
        y: logp,
        text: hover,
        mode: "markers",
        type: "scattergl",
        hoverinfo: "text",
        marker: { color: colors, size: 6, opacity: 0.7 },
      },
    ];
  }, [volcanoData]);

  const createViolinPlot = (geneObj, sparseExprData) => {
    if (!clusterLabels || !sparseExprData || !selectedAnnotation || !geneObj)
      return null;

    const labelsArray = clusterLabels[selectedAnnotation];
    if (!labelsArray) return null;

    const clusters = {};
    const exprArray = new Float32Array(labelsArray.length);
    sparseExprData.i.forEach(
      (idx, i) => (exprArray[idx] = sparseExprData.v[i]),
    );

    for (let i = 0; i < labelsArray.length; i++) {
      const cluster = labelsArray[i];
      if (!clusters[cluster]) clusters[cluster] = [];
      clusters[cluster].push(exprArray[i]);
    }

    const sortedLabels = Object.keys(clusters).sort();
    return sortedLabels.map((label) => ({
      y: clusters[label],
      name: label,
      type: "violin",
      points: false,
      jitter: 0.5,
      pointpos: 0,
      line: { color: clusterColorMap[label] || themeColors.label },
      marker: { size: 3, opacity: 0.5 },
      box: { visible: true },
      meanline: { visible: true },
    }));
  };

  return (
    <div className="p-6 flex flex-col gap-4 h-full bg-app">
      <div className="bg-panel p-4 border border-borderLight shadow-sm rounded flex flex-wrap gap-6 items-center">
        <label className="text-sm font-semibold flex flex-col gap-1">
          <span className="text-textMuted uppercase tracking-wide text-xs">
            Annotation / Clustering
          </span>
          <select
            className="border border-borderMain p-2 rounded outline-none w-64 bg-panel text-textMain focus:border-primary"
            value={selectedAnnotation}
            onChange={(e) => setSelectedAnnotation(e.target.value)}
          >
            {annotations.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm font-semibold flex flex-col gap-1">
          <span className="text-primary-dark uppercase tracking-wide text-xs">
            Target Cluster (Vs Rest)
          </span>
          <select
            className="border border-primary bg-primary-light text-primary-dark p-2 rounded outline-none w-48 max-w-full focus:ring-1 focus:ring-primary"
            value={selectedCluster}
            onChange={(e) => setSelectedCluster(e.target.value)}
          >
            {topGenesTable
              .map((r) => r["Cluster Name"])
              .map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
          </select>
        </label>

        <div className="ml-auto flex items-center">
          <InfoModal
            title={tabInfo.deAnalysis.title}
            content={tabInfo.deAnalysis.content}
          />
        </div>
      </div>

      <div className="flex gap-4 flex-1 min-h-0">
        <div className="w-1/3 bg-panel border border-borderLight shadow-sm rounded p-4 flex flex-col">
          <h3 className="font-bold text-textMain text-center mb-1">
            Volcano Plot
          </h3>
          <p className="text-xs text-center text-textMuted mb-2 truncate">
            Cluster{" "}
            <b title={selectedCluster} className="text-textMain">
              {selectedCluster}
            </b>{" "}
            vs All Other Cells
          </p>
          <div className="flex-1 relative">
            {volcanoPlot ? (
              <Plot
                data={volcanoPlot}
                layout={{
                  autosize: true,
                  xaxis: {
                    title: { text: "Log2 Fold Change", standoff: 15 },
                    zeroline: true,
                    zerolinecolor: themeColors.black,
                    automargin: true,
                  },
                  yaxis: {
                    title: { text: "-Log10(Adj. P-Value)", standoff: 15 },
                    zeroline: true,
                    automargin: true,
                  },
                  showlegend: false,
                  margin: { l: 60, r: 20, t: 20, b: 60 },
                  paper_bgcolor: themeColors.paper,
                  plot_bgcolor: themeColors.paper,
                  font: { color: themeColors.label },
                }}
                useResizeHandler={true}
                style={{ width: "100%", height: "100%" }}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-textMuted">
                Loading Volcano Data...
              </div>
            )}
          </div>
        </div>

        <div className="w-2/3 flex flex-col gap-4">
          <div className="flex gap-4 h-1/2">
            <div className="w-full bg-panel border border-borderLight shadow-sm rounded p-3 flex flex-col">
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-bold text-xs text-textMain mr-2">
                  Gene 1:
                </h3>
                <SearchableSelect
                  options={availableGenes}
                  value={gene1}
                  onChange={setGene1}
                  placeholder="Search..."
                />
              </div>
              <div className="flex-1 relative">
                {expr1 ? (
                  <Plot
                    data={createViolinPlot(gene1, expr1)}
                    layout={{
                      autosize: true,
                      showlegend: true,
                      xaxis: {
                        showticklabels: false,
                        title: { text: "Cell Clusters", standoff: 10 },
                        automargin: true,
                      },
                      yaxis: {
                        title: {
                          text: "Log Normalized Expression",
                          standoff: 10,
                        },
                        automargin: true,
                        zeroline: false,
                      },
                      margin: { l: 60, r: 120, t: 10, b: 50 },
                      paper_bgcolor: themeColors.paper,
                      plot_bgcolor: themeColors.paper,
                      font: { color: themeColors.label },
                    }}
                    useResizeHandler={true}
                    style={{ width: "100%", height: "100%" }}
                  />
                ) : (
                  <span className="text-xs text-textMuted">Loading...</span>
                )}
              </div>
            </div>
          </div>

          <div className="h-1/2 bg-panel border border-borderLight shadow-sm rounded flex flex-col overflow-hidden">
            <div className="bg-app border-b border-borderLight px-4 py-2">
              <h3 className="font-bold text-sm text-textMain">
                Top Marker Genes per Cluster
              </h3>
            </div>
            <div className="flex-1 overflow-auto p-0">
              <table className="w-full text-sm text-left">
                <thead className="bg-app sticky top-0 border-b border-borderMain z-10">
                  <tr>
                    <th className="px-4 py-2 text-textMain font-bold w-48">
                      Cluster
                    </th>
                    <th className="px-4 py-2 text-textMain font-bold">
                      Top Genes
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {topGenesTable.map((row, i) => {
                    const clusterName = row["Cluster Name"];
                    const pythonCleanedName = clusterName.replace(
                      /[^a-zA-Z0-9 ]/g,
                      "_",
                    );
                    const exactClusterKey =
                      Object.keys(clusterColorMap).find(
                        (k) =>
                          k === clusterName ||
                          k === pythonCleanedName ||
                          k.trim().toLowerCase() ===
                            pythonCleanedName.trim().toLowerCase() ||
                          k.trim().toLowerCase() ===
                            clusterName.trim().toLowerCase(),
                      ) || clusterName;

                    const color =
                      clusterColorMap[exactClusterKey] || themeColors.neutral;
                    const isSelected = clusterName === selectedCluster;

                    return (
                      <tr
                        key={i}
                        className={`border-b border-borderLight hover:bg-primary-light ${isSelected ? "bg-primary-light bg-opacity-50" : ""}`}
                      >
                        <td className="px-4 py-2 font-semibold">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-3 h-3 rounded-full flex-shrink-0 border border-borderDark shadow-sm"
                              style={{ backgroundColor: color }}
                            ></span>
                            <span
                              className="truncate max-w-[150px] text-textMain"
                              title={clusterName}
                            >
                              {clusterName}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-2 font-mono text-xs text-textMuted">
                          {row["Top Genes"]?.replace(/[\[\]']/g, "")}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
