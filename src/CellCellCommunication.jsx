// ./CellCellCommunication.jsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as d3 from 'd3';

export default function CellCellCommunication() {
  const [rawData, setRawData] = useState([]);
  const [microenvsDict, setMicroenvsDict] = useState({}); 
  const [globalCellCounts, setGlobalCellCounts] = useState({}); 
  const [plotData, setPlotData] = useState([]); 
  
  // Dropdown options
  const [availableMicroenvs, setAvailableMicroenvs] = useState([]);
  const [availableCells, setAvailableCells] = useState([]);
  const [availableInteractions, setAvailableInteractions] = useState([]);
  
  // Selected states for filtering
  const [selectedMicroenv, setSelectedMicroenv] = useState("All");
  const [selectedCell, setSelectedCell] = useState("All");
  const [selectedInteractions, setSelectedInteractions] = useState([]);
  
  // UI States
  const [minCells, setMinCells] = useState(50); 
  const [colorBy, setColorBy] = useState("Receiver"); 
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef(null);
  
  // D3 ref
  const d3Container = useRef(null);

  const interactionColorScale = useMemo(() => {
    return d3.scaleOrdinal(d3.schemeCategory10).domain(availableInteractions);
  }, [availableInteractions]);

  // 1. Load Data
  useEffect(() => {
    async function loadData() {
      try {
        const [edgesRes, microRes] = await Promise.all([
          fetch("data/cpdb_edges.json"),
          fetch("data/cpdb_microenvs.json") 
        ]);
        
        const edgesData = await edgesRes.json();
        const microData = await microRes.json();
        
        setRawData(edgesData);
        setMicroenvsDict(microData);
        
        const gCounts = {};
        Object.values(microData).forEach(envCounts => {
          Object.entries(envCounts).forEach(([cell, count]) => {
            gCounts[cell] = (gCounts[cell] || 0) + count;
          });
        });
        setGlobalCellCounts(gCounts);
        
        const cells = Array.from(new Set(edgesData.flatMap(d => [d.source, d.target]))).sort();
        const interactions = Array.from(new Set(edgesData.map(d => d.interaction))).sort();
        const microenvs = Object.keys(microData).sort((a, b) => Number(a) - Number(b)); 
        
        setAvailableCells(["All", ...cells]);
        setAvailableMicroenvs(["All", ...microenvs]);
        setAvailableInteractions(interactions);
        setSelectedInteractions(interactions); 
        
        // --- NEW: Pick a random Microenvironment and Cell Type on load! ---
        if (microenvs.length > 0) {
          // 1. Pick a random Region
          const randomEnv = microenvs[Math.floor(Math.random() * microenvs.length)];
          setSelectedMicroenv(randomEnv);
          
          // 2. Pick a random Cell Type that actually exists in that Region
          const cellsInEnv = Object.keys(microData[randomEnv] || {});
          if (cellsInEnv.length > 0) {
            const randomCell = cellsInEnv[Math.floor(Math.random() * cellsInEnv.length)];
            setSelectedCell(randomCell);
          }
        }
        
      } catch (err) {
        console.error("Could not load CPDB data:", err);
      }
    }
    loadData();
  }, []);

  // Close multi-select dropdown if clicked outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // 2. Filter Data 
  const handleRefresh = () => {
    if (!rawData.length) return;

    const filteredData = rawData.filter(d => {
      if (selectedCell !== "All" && d.source !== selectedCell && d.target !== selectedCell) return false;
      if (!selectedInteractions.includes(d.interaction)) return false;

      let sCount = 0;
      let tCount = 0;
      
      if (selectedMicroenv !== "All") {
        sCount = microenvsDict[selectedMicroenv]?.[d.source] || 0;
        tCount = microenvsDict[selectedMicroenv]?.[d.target] || 0;
      } else {
        sCount = globalCellCounts[d.source] || 0;
        tCount = globalCellCounts[d.target] || 0;
      }

      if (sCount < minCells || tCount < minCells) return false;

      return true;
    });

    const edgeMap = new Map();
    filteredData.forEach(d => {
      const key = `${d.source}|${d.target}|${d.interaction}`;
      if (!edgeMap.has(key)) edgeMap.set(key, { ...d, value: 0 });
      edgeMap.get(key).value += d.value;
    });
    
    setPlotData(Array.from(edgeMap.values()));
  };

  // Run initial filter (now uses the random selections!)
  useEffect(() => {
    if (rawData.length > 0) handleRefresh();
  }, [rawData]);

  // 3. Draw D3 Chart
  useEffect(() => {
    if (!d3Container.current) return;
    
    const container = d3.select(d3Container.current);
    container.selectAll("*").remove();

    if (plotData.length === 0) {
      container.append("text")
        .attr("x", "50%")
        .attr("y", "50%")
        .attr("text-anchor", "middle")
        .text("No significant interactions found for current filters.");
      return;
    }

    const width = 600;
    const height = 600;
    const innerRadius = Math.min(width, height) * 0.5 - 120;
    const outerRadius = innerRadius + 10;

    const names = Array.from(new Set(plotData.flatMap(d => [d.source, d.target]))).sort();
    const index = new Map(names.map((name, i) => [name, i]));
    const matrix = Array.from(index, () => new Array(names.length).fill(0));
    
    const interactionMap = new Map();
    
    for (const {source, target, interaction, value} of plotData) {
      const sIdx = index.get(source);
      const tIdx = index.get(target);
      matrix[sIdx][tIdx] += value;
      
      const key = `${sIdx}-${tIdx}`;
      if (!interactionMap.has(key)) interactionMap.set(key, []);
      interactionMap.get(key).push({ interaction, value, source, target });
    }

    interactionMap.forEach(arr => arr.sort((a, b) => b.value - a.value));

    const chord = d3.chordDirected().padAngle(12 / innerRadius).sortSubgroups(d3.descending).sortChords(d3.descending);
    const chords = chord(matrix);
    
    const splitChords = [];
    chords.forEach(d => {
      const sIdx = d.source.index;
      const tIdx = d.target.index;
      const key = `${sIdx}-${tIdx}`;
      const interactions = interactionMap.get(key) || [];
      
      let currS = d.source.startAngle;
      let currT = d.target.startAngle;
      
      const sRange = d.source.endAngle - d.source.startAngle;
      const tRange = d.target.endAngle - d.target.startAngle;
      
      interactions.forEach(intx => {
        const prop = intx.value / d.source.value; 
        const sStep = sRange * prop;
        const tStep = tRange * prop;
        
        splitChords.push({
          source: { index: sIdx, startAngle: currS, endAngle: currS + sStep, value: intx.value },
          target: { index: tIdx, startAngle: currT, endAngle: currT + tStep, value: intx.value },
          interaction: intx.interaction,
          sourceName: intx.source,
          targetName: intx.target
        });
        
        currS += sStep;
        currT += tStep;
      });
    });

    const arc = d3.arc().innerRadius(innerRadius).outerRadius(outerRadius);
    const ribbon = d3.ribbonArrow().radius(innerRadius - 0.5).padAngle(1 / innerRadius);
    
    const colors = d3.schemeCategory10; 
    const formatValue = x => `${x.toFixed(2)}`;

    const svg = container.append("svg")
        .attr("width", "100%")
        .attr("height", "100%")
        .attr("viewBox", [-width / 2, -height / 2, width, height])
        // REVERTED SVG SIZING: Back to 60% so it is smaller and centered!
        .attr("style", "max-width: 60%; height: auto; font: 10px sans-serif;");

    const textId = `text-path-${Math.random().toString(36).substring(2, 9)}`;

    svg.append("path")
        .attr("id", textId)
        .attr("fill", "none")
        .attr("d", d3.arc()({outerRadius, startAngle: 0, endAngle: 2 * Math.PI}));

    svg.append("g")
        .attr("fill-opacity", 0.8)
      .selectAll("path")
      .data(splitChords) 
      .join("path")
        .attr("d", ribbon)
        .attr("fill", d => {
          if (colorBy === "Receiver") return colors[d.target.index % colors.length];
          if (colorBy === "Sender") return colors[d.source.index % colors.length];
          if (colorBy === "Interaction") return interactionColorScale(d.interaction);
        })
        .attr("stroke", "#ffffff") 
        .attr("stroke-width", 1)
        .style("mix-blend-mode", "multiply")
      .append("title")
        .text(d => `${d.sourceName} ➔ ${d.targetName}\nPair: ${d.interaction}\nStrength: ${formatValue(d.source.value)}`);

    const g = svg.append("g").selectAll("g").data(chords.groups).join("g");

    g.append("path")
        .attr("d", arc)
        .attr("fill", d => colors[d.index % colors.length])
        .attr("stroke", "#fff");

    g.append("text")
        .attr("dy", -3)
      .append("textPath")
        .attr("href", `#${textId}`)
        .attr("startOffset", d => d.startAngle * outerRadius)
        .text(d => names[d.index]);

    g.append("title")
        .text(d => `${names[d.index]}\nOutgoing: ${formatValue(d3.sum(matrix[d.index]))}\nIncoming: ${formatValue(d3.sum(matrix, row => row[d.index]))}`);

  }, [plotData, colorBy, interactionColorScale]); 

  const activeInteractions = Array.from(new Set(plotData.map(d => d.interaction))).sort();

  return (
    <div className="p-6 flex flex-col gap-6 h-full">
      {/* Settings Bar */}
      <div className="bg-white p-4 border shadow-sm rounded flex flex-wrap items-end gap-4">
        
        <label className="flex-1 min-w-[120px] flex flex-col">
          <span className="text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">Microenv</span>
          <select 
            className="border border-gray-300 p-2 rounded text-sm outline-none bg-white"
            value={selectedMicroenv} onChange={(e) => setSelectedMicroenv(e.target.value)}
          >
            {availableMicroenvs.map(m => <option key={m} value={m}>{m === "All" ? "All" : `Region ${m}`}</option>)}
          </select>
        </label>

        <label className="flex-1 min-w-[140px] flex flex-col">
          <span className="text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">Focal Cell Type</span>
          <select 
            className="border border-gray-300 p-2 rounded text-sm outline-none bg-white"
            value={selectedCell} onChange={(e) => setSelectedCell(e.target.value)}
          >
            {availableCells.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>

        <div className="flex-1 min-w-[200px] flex flex-col relative" ref={dropdownRef}>
          <span className="text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">Ligand-Receptor Pairs</span>
          <button 
            type="button"
            className="border border-gray-300 p-2 rounded text-sm bg-white flex justify-between items-center outline-none text-left"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          >
            <span className="truncate">
              {selectedInteractions.length === availableInteractions.length 
                ? "All Pairs Selected" 
                : `${selectedInteractions.length} Pairs Selected`}
            </span>
            <span className="text-xs ml-2 text-gray-500">▼</span>
          </button>

          {isDropdownOpen && (
            <div className="absolute top-[100%] left-0 right-0 mt-1 bg-white border border-gray-300 shadow-xl rounded z-50 flex flex-col max-h-80">
              <div className="p-2 border-b border-gray-200 bg-gray-50">
                <input 
                  type="text" 
                  placeholder="Search pairs..." 
                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm outline-none"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
                <div className="flex justify-between mt-2 px-1">
                  <button 
                    type="button"
                    onClick={() => setSelectedInteractions(availableInteractions)} 
                    className="text-xs font-semibold text-blue-600 hover:underline"
                  >
                    Select All
                  </button>
                  <button 
                    type="button"
                    onClick={() => setSelectedInteractions([])} 
                    className="text-xs font-semibold text-red-600 hover:underline"
                  >
                    Clear All
                  </button>
                </div>
              </div>
              <div className="overflow-y-auto p-2 flex flex-col gap-1">
                {availableInteractions
                  .filter(i => i.toLowerCase().includes(searchTerm.toLowerCase()))
                  .map(i => (
                  <label key={i} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-100 p-1 rounded transition-colors">
                    <input 
                      type="checkbox" 
                      className="cursor-pointer"
                      checked={selectedInteractions.includes(i)}
                      onChange={() => {
                        if (selectedInteractions.includes(i)) {
                          setSelectedInteractions(prev => prev.filter(item => item !== i));
                        } else {
                          setSelectedInteractions(prev => [...prev, i]);
                        }
                      }}
                    />
                    <span className="truncate">{i}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        <button 
          onClick={handleRefresh}
          className="bg-green-100 border border-green-600 text-green-700 font-semibold px-4 py-2 rounded shadow hover:bg-green-200 transition h-[38px] mr-2"
        >
          Refresh Data
        </button>

        {/* Visual Settings Group */}
        <div className="flex gap-4 border-l border-gray-300 pl-4">
          <label className="flex-1 min-w-[100px] flex flex-col">
            <span className="text-xs font-semibold text-blue-600 mb-1 uppercase tracking-wider">Min Cells</span>
            <input 
              type="number" 
              className="border border-blue-400 bg-blue-50 text-blue-900 p-2 rounded text-sm outline-none"
              value={minCells} 
              onChange={(e) => setMinCells(Number(e.target.value))}
              min="0"
            />
          </label>
          
          <label className="flex-1 min-w-[130px] flex flex-col">
            <span className="text-xs font-semibold text-blue-600 mb-1 uppercase tracking-wider">Color By</span>
            <select 
              className="border border-blue-400 bg-blue-50 text-blue-900 p-2 rounded text-sm outline-none"
              value={colorBy} onChange={(e) => setColorBy(e.target.value)}
            >
              <option value="Receiver">Receiving Cell</option>
              <option value="Sender">Sending Cell</option>
              <option value="Interaction">Ligand-Receptor</option>
            </select>
          </label>
        </div>

      </div>

      {/* Plot Area */}
      <div className="bg-white p-4 border shadow-sm rounded flex-1 flex flex-col min-h-[600px] relative">
        <h3 className="font-bold text-lg mb-2 text-center text-gray-700">Directed Interaction Network</h3>
        <p className="text-sm text-gray-500 text-center mb-4">Arrows indicate direction from Sender (Ligand) to Receiver (Receptor).</p>
        
        <div className="flex-1 w-full flex overflow-hidden">
          
          {/* Main D3 Chart */}
          <div className="flex-1 flex items-center justify-center min-w-0">
            {/* REVERTED: Removed maxWidth limit so it uses the whole area to center */}
            <div ref={d3Container} style={{ width: '100%', height: '100%' }}></div>
          </div>

          {/* Conditional Legend Panel */}
          {colorBy === "Interaction" && activeInteractions.length > 0 && (
            <div className="w-64 flex flex-col border-l border-gray-200 pl-4 ml-4 overflow-y-auto max-h-full">
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 sticky top-0 bg-white py-1 shadow-sm">
                Active Pairs
              </h4>
              <div className="flex flex-col gap-2 pb-4">
                {activeInteractions.map(intx => (
                  <div key={intx} className="flex items-center gap-2 text-sm text-gray-700">
                    <span 
                      className="w-4 h-4 rounded shadow-sm flex-shrink-0" 
                      style={{ backgroundColor: interactionColorScale(intx) }}
                    />
                    <span className="truncate" title={intx}>{intx}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}