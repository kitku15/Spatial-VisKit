import React, { useState, useEffect } from "react";
import Plotly from "plotly.js-dist-min";
import factory from "react-plotly.js/factory";
import InfoModal from "./InfoModal";
import { tabInfo } from "./infoHelper";
import { annotationColorPalette, themeColors, DATA_DIR, DYNAMIC_ANNOTATIONS  } from "./config";

const createPlotlyComponent =
  typeof factory === "function" ? factory : factory.default;
const Plot = createPlotlyComponent(Plotly);

const hexToRgba = (hex, alpha) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const CellTypeAnnotation = ({ availableColumns }) => {
  const annotationCols = availableColumns.filter((col) =>
    DYNAMIC_ANNOTATIONS.some((ann) => col.includes(ann.prefix)) || col.includes("cluster")
  );

  const [selectedCols, setSelectedCols] = useState(["", ""]);

  useEffect(() => {
    if (annotationCols.length >= 2 && !selectedCols[0] && !selectedCols[1]) {
      setSelectedCols([annotationCols[0], annotationCols[1]]);
    }
  }, [annotationCols]);

  const [plotData, setPlotData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [selectedInsight, setSelectedInsight] = useState(null);

  const cleanLabel = (rawLabel) => {
    let clean = rawLabel;
    selectedCols.forEach((col) => {
      const prefix = col + "_";
      if (clean.startsWith(prefix)) {
        clean = clean.replace(prefix, "");
      }
    });
    return clean;
  };

  const handleColumnChange = (index, value) => {
    const newCols = [...selectedCols];
    newCols[index] = value;
    setSelectedCols(newCols);
  };

  const addColumn = () => {
    setSelectedCols([...selectedCols, annotationCols[0]]);
  };

  const removeColumn = (index) => {
    if (selectedCols.length <= 2) return;
    const newCols = selectedCols.filter((_, i) => i !== index);
    setSelectedCols(newCols);
  };

  const handleGenerateSankey = async () => {
    if (selectedCols.some((col) => !col)) {
      setErrorMsg("Please ensure all dropdowns have a selection.");
      return;
    }

    for (let i = 0; i < selectedCols.length - 1; i++) {
      if (selectedCols[i] === selectedCols[i + 1]) {
        setErrorMsg("Adjacent columns cannot be the same.");
        return;
      }
    }

    setIsLoading(true);
    setErrorMsg("");
    setPlotData(null);

    try {
      const globalNodes = [];
      const nodeNameToIndex = new Map();
      const globalLinks = [];

      const getOrAddNode = (name) => {
        if (!nodeNameToIndex.has(name)) {
          const index = globalNodes.length;
          nodeNameToIndex.set(name, index);
          const nodeColor =
            annotationColorPalette[index % annotationColorPalette.length];
          globalNodes.push({ name, color: nodeColor });
          return index;
        }
        return nodeNameToIndex.get(name);
      };

      for (let i = 0; i < selectedCols.length - 1; i++) {
        const colA = selectedCols[i];
        const colB = selectedCols[i + 1];
        const fileName = `${colA}_vs_${colB}.json`;

        const response = await fetch(`${DATA_DIR}/sankeys/${fileName}`);
        if (!response.ok) {
          throw new Error(`Data not found for: ${colA} → ${colB}`);
        }
        const data = await response.json();

        data.links.forEach((link) => {
          const sourceName = data.nodes[link.source].name;
          const targetName = data.nodes[link.target].name;

          const globalSourceIdx = getOrAddNode(sourceName);
          const globalTargetIdx = getOrAddNode(targetName);

          const sourceColor = globalNodes[globalSourceIdx].color;
          const linkColor = hexToRgba(sourceColor, 0.4);

          globalLinks.push({
            source: globalSourceIdx,
            target: globalTargetIdx,
            value: link.value,
            color: linkColor,
          });
        });
      }

      const plotlySankey = {
        type: "sankey",
        orientation: "h",
        node: {
          pad: 15,
          thickness: 20,
          line: { color: themeColors.black, width: 0.5 },
          label: globalNodes.map((n) => cleanLabel(n.name)),
          color: globalNodes.map((n) => n.color),
        },
        link: {
          source: globalLinks.map((l) => l.source),
          target: globalLinks.map((l) => l.target),
          value: globalLinks.map((l) => l.value),
          color: globalLinks.map((l) => l.color),
        },
      };

      setPlotData([plotlySankey]);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6 flex flex-col gap-6 h-full bg-app">
      <div className="bg-panel p-4 border border-borderLight shadow-sm rounded">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-textMain">
            Annotation Flow Comparison
          </h2>
          <div className="flex items-center gap-4">
            <button
              onClick={addColumn}
              className="bg-success-light text-success-dark border border-success px-3 py-1 rounded text-sm hover:bg-success hover:text-textInverse transition"
            >
              + Add Flow Step
            </button>
            <div className="pl-4 border-l border-borderMain flex items-center">
              <InfoModal
                title={tabInfo.annotation.title}
                content={tabInfo.annotation.content}
              />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-4 items-end">
          {selectedCols.map((col, index) => (
            <div
              key={`col-select-${index}`}
              className="flex-1 min-w-[200px] flex items-end gap-2"
            >
              <div className="flex-1">
                <label className="block text-xs font-semibold text-textMuted mb-1 uppercase tracking-wider">
                  Step {index + 1}
                </label>
                <select
                  className="w-full border border-borderMain p-2 rounded text-sm bg-panel text-textMain outline-none focus:border-primary"
                  value={col}
                  onChange={(e) => handleColumnChange(index, e.target.value)}
                >
                  {annotationCols.map((c) => (
                    <option key={`opt-${index}-${c}`} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              {selectedCols.length > 2 && (
                <button
                  onClick={() => removeColumn(index)}
                  className="bg-danger-light text-danger px-2 py-2 rounded hover:bg-danger hover:text-textInverse border border-danger-light transition-colors"
                  title="Remove this step"
                >
                  ✕
                </button>
              )}
              {index < selectedCols.length - 1 && (
                <div className="text-textMuted font-bold px-2 py-2">→</div>
              )}
            </div>
          ))}

          <button
            onClick={handleGenerateSankey}
            disabled={isLoading}
            className={`font-semibold px-6 py-2 rounded shadow transition ml-auto border ${isLoading ? "bg-borderMain text-borderLight border-borderMain cursor-not-allowed" : "bg-primary text-textInverse border-primary hover:bg-primary-dark"}`}
          >
            {isLoading ? "Loading..." : "Generate Sankey"}
          </button>
        </div>
      </div>

      <div className="flex gap-6 flex-1 min-h-0">
        <div className="bg-panel p-4 border border-borderLight shadow-sm rounded flex-1 flex flex-col relative">
          <h3 className="font-bold text-lg mb-2 text-center text-textMain">
            Multi-Step Annotation Flow
          </h3>

          <div className="flex-1 w-full bg-app flex items-center justify-center border border-dashed border-borderMain rounded">
            {errorMsg && (
              <p className="text-danger font-semibold">{errorMsg}</p>
            )}
            {!errorMsg && !plotData && !isLoading && (
              <p className="text-textMuted">
                Select column steps and click Generate
              </p>
            )}

            {plotData && (
              <Plot
                data={plotData}
                layout={{
                  autosize: true,
                  margin: { l: 20, r: 20, t: 40, b: 20 },
                  paper_bgcolor: themeColors.background,
                  plot_bgcolor: themeColors.background,
                  font: { color: themeColors.label },
                }}
                useResizeHandler={true}
                style={{ width: "100%", height: "100%" }}
                onHover={(e) => {
                  if (!e || !e.points || e.points.length === 0) return;
                  const point = e.points[0];
                  const sankey = plotData[0];

                  let nodeIndex;
                  if ("source" in point && "target" in point) {
                    const linkIndex = point.pointNumber;
                    nodeIndex = sankey.link.source[linkIndex];
                  } else {
                    nodeIndex = point.pointNumber;
                  }

                  let nodeValueOut = 0;
                  let nodeValueIn = 0;
                  for (let i = 0; i < sankey.link.source.length; i++) {
                    if (sankey.link.source[i] === nodeIndex)
                      nodeValueOut += sankey.link.value[i];
                    if (sankey.link.target[i] === nodeIndex)
                      nodeValueIn += sankey.link.value[i];
                  }
                  const totalCells = Math.max(nodeValueOut, nodeValueIn);

                  const outgoing = [];
                  const incoming = [];

                  for (let i = 0; i < sankey.link.source.length; i++) {
                    if (sankey.link.source[i] === nodeIndex) {
                      outgoing.push({
                        targetLabel: sankey.node.label[sankey.link.target[i]],
                        value: sankey.link.value[i],
                        pct: (
                          (sankey.link.value[i] / totalCells) *
                          100
                        ).toFixed(1),
                      });
                    }
                    if (sankey.link.target[i] === nodeIndex) {
                      incoming.push({
                        sourceLabel: sankey.node.label[sankey.link.source[i]],
                        value: sankey.link.value[i],
                        pct: (
                          (sankey.link.value[i] / totalCells) *
                          100
                        ).toFixed(1),
                      });
                    }
                  }

                  outgoing.sort((a, b) => b.value - a.value);
                  incoming.sort((a, b) => b.value - a.value);

                  setSelectedInsight({
                    type: "node",
                    label: sankey.node.label[nodeIndex],
                    value: totalCells,
                    outgoing,
                    incoming,
                  });
                }}
              />
            )}
          </div>
        </div>

        <div className="bg-panel p-4 border border-borderLight shadow-sm rounded w-1/4 flex flex-col overflow-y-auto">
          <h3 className="font-bold text-lg mb-2 text-textMain border-b border-borderMain pb-2">
            Insights
          </h3>

          {!selectedInsight ? (
            <p className="text-sm text-textMuted mt-2">
              Hover over any cluster (box) or connection line (flow) in the
              diagram to view detailed transition statistics.
            </p>
          ) : (
            <div className="mt-2 animate-fade-in flex flex-col gap-4">
              <div className="bg-success-light border border-success-light p-3 rounded shadow-sm">
                <p className="text-sm text-textMain font-semibold mb-1">
                  {selectedInsight.label}
                </p>
                <p className="text-sm text-textMain">
                  Total Cells:{" "}
                  <span className="font-bold text-success-dark">
                    {selectedInsight.value.toLocaleString()}
                  </span>
                </p>
              </div>

              {selectedInsight.outgoing &&
                selectedInsight.outgoing.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-textMuted uppercase tracking-wider mb-2">
                      Becomes (Next Step)
                    </h4>
                    <ul className="flex flex-col gap-1.5">
                      {selectedInsight.outgoing.map((out, idx) => (
                        <li
                          key={`out-${idx}`}
                          className="text-sm flex justify-between items-center bg-app border border-borderMain p-1.5 rounded"
                        >
                          <span
                            className="font-medium text-textMain truncate mr-2"
                            title={out.targetLabel}
                          >
                            {out.targetLabel}
                          </span>
                          <span className="text-xs font-bold text-primary-dark bg-primary-light px-1.5 py-0.5 rounded shrink-0 border border-primary-light">
                            {out.pct}% ({out.value})
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

              {selectedInsight.incoming &&
                selectedInsight.incoming.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-textMuted uppercase tracking-wider mb-2 mt-2">
                      Comes From (Prev Step)
                    </h4>
                    <ul className="flex flex-col gap-1.5">
                      {selectedInsight.incoming.map((inc, idx) => (
                        <li
                          key={`inc-${idx}`}
                          className="text-sm flex justify-between items-center bg-app border border-borderMain p-1.5 rounded"
                        >
                          <span
                            className="font-medium text-textMain truncate mr-2"
                            title={inc.sourceLabel}
                          >
                            {inc.sourceLabel}
                          </span>
                          <span className="text-xs font-bold text-info-dark bg-info-light px-1.5 py-0.5 rounded shrink-0 border border-info-light">
                            {inc.pct}% ({inc.value})
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CellTypeAnnotation;
