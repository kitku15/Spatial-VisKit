import React, { useState, useEffect } from 'react';
import Plotly from 'plotly.js-dist-min';
import factory from 'react-plotly.js/factory';

const createPlotlyComponent = typeof factory === 'function' ? factory : factory.default;
const Plot = createPlotlyComponent(Plotly);

// ----------------------------
// Color Management Logic
// ----------------------------
// A vibrant, distinct color palette for the clusters
const colorPalette = [
  '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd',
  '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf',
  '#aec7e8', '#ffbb78', '#98df8a', '#ff9896', '#c5b0d5',
  '#c49c94', '#f7b6d2', '#c7c7c7', '#dbdb8d', '#9edae5',
  '#393b79', '#637939', '#8c6d31', '#843c39', '#7b4173'
];

// Helper to convert HEX to RGBA so our links can be slightly transparent
const hexToRgba = (hex, alpha) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const CellTypeAnnotation = ({ availableColumns }) => {
  const annotationCols = availableColumns.filter(col => 
    col.includes('leiden') || col.includes('CellTypist') || col.includes('cluster')
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

  // --- Handlers for Adding/Removing Columns ---
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

  // --- Data Fetching and Stitching Logic ---
  const handleGenerateSankey = async () => {
    if (selectedCols.some(col => !col)) {
      setErrorMsg("Please ensure all dropdowns have a selection.");
      return;
    }

    for (let i = 0; i < selectedCols.length - 1; i++) {
      if (selectedCols[i] === selectedCols[i+1]) {
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

      // Helper function to keep track of nodes AND assign them unique colors
      const getOrAddNode = (name) => {
        if (!nodeNameToIndex.has(name)) {
          const index = globalNodes.length;
          nodeNameToIndex.set(name, index);
          
          // Assign a color from the palette, looping back to the start if we run out
          const nodeColor = colorPalette[index % colorPalette.length];
          globalNodes.push({ name, color: nodeColor });
          
          return index;
        }
        return nodeNameToIndex.get(name);
      };

      for (let i = 0; i < selectedCols.length - 1; i++) {
        const colA = selectedCols[i];
        const colB = selectedCols[i + 1];
        const fileName = `${colA}_vs_${colB}.json`;
        
        const response = await fetch(`data/sankeys/${fileName}`);
        if (!response.ok) {
          throw new Error(`Data not found for: ${colA} → ${colB}`);
        }
        const data = await response.json();

        data.links.forEach(link => {
          const sourceName = data.nodes[link.source].name;
          const targetName = data.nodes[link.target].name;

          const globalSourceIdx = getOrAddNode(sourceName);
          const globalTargetIdx = getOrAddNode(targetName);

          // Get the source node's solid color, and make it 40% transparent for the link
          const sourceColor = globalNodes[globalSourceIdx].color;
          const linkColor = hexToRgba(sourceColor, 0.4);

          globalLinks.push({
            source: globalSourceIdx,
            target: globalTargetIdx,
            value: link.value,
            color: linkColor // Apply the custom link color
          });
        });
      }

      // Build the final Plotly object
      const plotlySankey = {
        type: "sankey",
        orientation: "h",
        node: {
          pad: 15,
          thickness: 20,
          line: { color: "black", width: 0.5 },
          label: globalNodes.map(n => n.name),
          color: globalNodes.map(n => n.color) // Apply the unique node colors
        },
        link: {
          source: globalLinks.map(l => l.source),
          target: globalLinks.map(l => l.target),
          value: globalLinks.map(l => l.value),
          color: globalLinks.map(l => l.color) // Apply the inherited transparent colors
        }
      };

      setPlotData([plotlySankey]);

    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6 flex flex-col gap-6 h-full">
      {/* Top Controls Section */}
      <div className="bg-white p-4 border shadow-sm rounded">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Annotation Flow Comparison</h2>
          <button 
            onClick={addColumn}
            className="bg-green-100 border border-green-600 text-green-700 font-semibold px-3 py-1 rounded text-sm hover:bg-green-200 transition"
          >
            + Add Flow Step
          </button>
        </div>

        <div className="flex flex-wrap gap-4 items-end">
          {selectedCols.map((col, index) => (
            <div key={`col-select-${index}`} className="flex-1 min-w-[200px] flex items-end gap-2">
              <div className="flex-1">
                <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">
                  Step {index + 1}
                </label>
                <select 
                  className="w-full border border-gray-300 p-2 rounded text-sm"
                  value={col}
                  onChange={(e) => handleColumnChange(index, e.target.value)}
                >
                  {annotationCols.map(c => <option key={`opt-${index}-${c}`} value={c}>{c}</option>)}
                </select>
              </div>
              {selectedCols.length > 2 && (
                <button 
                  onClick={() => removeColumn(index)}
                  className="bg-red-100 text-red-600 px-2 py-2 rounded hover:bg-red-200 border border-red-200"
                  title="Remove this step"
                >
                  ✕
                </button>
              )}
              {index < selectedCols.length - 1 && (
                <div className="text-gray-400 font-bold px-2 py-2">→</div>
              )}
            </div>
          ))}

          <button 
            onClick={handleGenerateSankey}
            disabled={isLoading}
            className={`font-semibold px-6 py-2 rounded shadow transition ml-auto ${isLoading ? 'bg-gray-400 text-gray-200' : 'bg-blue-500 text-white hover:bg-blue-600'}`}
          >
            {isLoading ? 'Loading...' : 'Generate Sankey'}
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex gap-6 flex-1 min-h-0">
        
        {/* Sankey Diagram Container */}
        <div className="bg-white p-4 border shadow-sm rounded flex-1 flex flex-col relative">
          <h3 className="font-bold text-lg mb-2 text-center text-gray-700">
            Multi-Step Annotation Flow
          </h3>
          
          <div className="flex-1 w-full bg-gray-50 flex items-center justify-center border border-dashed border-gray-200 rounded">
             {errorMsg && <p className="text-red-500 font-semibold">{errorMsg}</p>}
             {!errorMsg && !plotData && !isLoading && <p className="text-gray-400">Select column steps and click Generate</p>}
             
             {plotData && (
               <Plot
                  data={plotData}
                  layout={{ autosize: true, margin: { l: 20, r: 20, t: 40, b: 20 } }}
                  useResizeHandler={true}
                  style={{ width: "100%", height: "100%" }}
                />
             )}
          </div>
        </div>

        {/* Space for future annotation features */}
        <div className="bg-white p-4 border shadow-sm rounded w-1/4 flex flex-col">
          <h3 className="font-bold text-lg mb-2 text-gray-700">Insights</h3>
          <p className="text-sm text-gray-500 mb-4">Hover over a connection to see the exact number of cells transitioning.</p>
        </div>
      </div>
    </div>
  );
};

export default CellTypeAnnotation;