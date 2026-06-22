// ./ConditionsDE.jsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import Plotly from 'plotly.js-dist-min';
import factory from 'react-plotly.js/factory';
import * as d3 from 'd3';

const createPlotlyComponent = typeof factory === 'function' ? factory : factory.default;
const Plot = createPlotlyComponent(Plotly);

// --- Custom Multi-Select Dropdown for Genes ---
function MultiSearchableSelect({ options, selected, onChange, max = 5 }) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const wrapperRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setIsOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = options.filter(opt => 
    opt.original.toLowerCase().includes(search.toLowerCase()) &&
    !selected.find(s => s.safe === opt.safe)
  );

  const handleSelect = (opt) => {
    if (selected.length < max) {
      onChange([...selected, opt]);
      setSearch("");
      setIsOpen(false);
    }
  };

  const handleRemove = (safeKey) => {
    onChange(selected.filter(s => s.safe !== safeKey));
  };

  return (
    <div ref={wrapperRef} className="relative flex-1">
      <div className="border border-gray-300 bg-white p-1.5 rounded flex flex-wrap gap-1 items-center cursor-text min-h-[38px]" onClick={() => setIsOpen(true)}>
        {selected.map(sel => (
          <span key={sel.safe} className="bg-blue-100 text-blue-800 text-xs font-semibold px-2 py-1 rounded flex items-center gap-1">
            {sel.original} <button className="text-blue-500 hover:text-red-500" onClick={(e) => { e.stopPropagation(); handleRemove(sel.safe); }}>✕</button>
          </span>
        ))}
        {selected.length < max && (
          <input
            type="text" className="outline-none flex-1 text-sm px-1 min-w-[60px]"
            placeholder={selected.length === 0 ? "Search genes (up to 5)..." : ""}
            value={search} onChange={(e) => setSearch(e.target.value)}
          />
        )}
      </div>
      {isOpen && selected.length < max && (
        <div className="absolute z-20 w-full mt-1 bg-white border border-gray-300 rounded shadow-lg max-h-48 overflow-y-auto">
          {filteredOptions.length > 0 ? (
            filteredOptions.map((opt) => (
              <div key={opt.safe} className="p-2 text-sm hover:bg-blue-100 cursor-pointer" onClick={() => handleSelect(opt)}>
                {opt.original}
              </div>
            ))
          ) : (<div className="p-2 text-sm text-gray-500 italic">No more genes found</div>)}
        </div>
      )}
    </div>
  );
}

export default function ConditionsDE() {
  // Config & Structure State
  const [config, setConfig] = useState(null);
  const [comparisonsMap, setComparisonsMap] = useState({});
  const [availableGenes, setAvailableGenes] = useState([]);
  
  // Selection State
  const [selectedCellType, setSelectedCellType] = useState("");
  const [selectedComparison, setSelectedComparison] = useState("");
  const [selectedGenes, setSelectedGenes] = useState([]);

  // Data State
  const [volcanoData, setVolcanoData] = useState(null);
  const [summaryTable, setSummaryTable] = useState([]);
  const [cellClusters, setCellClusters] = useState(null);
  const [geneExpressions, setGeneExpressions] = useState({});
  const [filterZeros, setFilterZeros] = useState(false);


  // 1. Initial Load
  useEffect(() => {
    async function initData() {
      try {
        const meta = await fetch('data/conditions_de_analysis/conditions_de_metadata.json').then(r => r.json());
        const genes = await fetch('data/genes_list.json').then(r => r.json());
        const clusters = await fetch('data/cell_clusters.json').then(r => r.json());

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
      } catch (err) {
        console.warn("Conditions DE Analysis data not found. Did you enable it in the pipeline config?");
      }
    }
    initData();
  }, []);

  // Update comparison dropdown when cell type changes
  useEffect(() => {
    if (selectedCellType && comparisonsMap[selectedCellType]) {
      const availableComparisons = comparisonsMap[selectedCellType];
      
      setSelectedComparison(prev => {
        // If the previously selected comparison exists for this new cell type, keep it!
        if (availableComparisons.includes(prev)) {
          return prev;
        }
        // Otherwise, fallback to the first available one
        return availableComparisons[0] || "";
      });
    }
  }, [selectedCellType, comparisonsMap]);

  // 2. Fetch Plot Data when Selections Change
  useEffect(() => {
    if (!selectedCellType || !selectedComparison) return;

    // Load Volcano JSON
    fetch(`data/conditions_de_analysis/${selectedCellType}_comparison_${selectedComparison}.json`)
      .then(r => r.json())
      .then(setVolcanoData)
      .catch(() => setVolcanoData(null));

    // Load Summary CSV
    d3.csv(`data/conditions_de_analysis/summary_${selectedCellType}.csv`)
      .then(data => {
        const compRow = data.find(d => d.Comparison === selectedComparison);
        if (compRow) {
          // Pre-populate genes based on top 2 up and top 2 down
          const upList = compRow["Top Upregulated"].replace(/[\[\]']/g, '').split(',').map(s => s.trim()).filter(Boolean);
          const downList = compRow["Top Downregulated"].replace(/[\[\]']/g, '').split(',').map(s => s.trim()).filter(Boolean);
          
          const defaultGeneNames = [...upList.slice(0, 2), ...downList.slice(0, 2)];
          const initialGenes = availableGenes.filter(g => defaultGeneNames.includes(g.original)).slice(0, 5);
          
          if (selectedGenes.length === 0) setSelectedGenes(initialGenes);
          setSummaryTable([compRow]);
        }
      }).catch(err => console.warn(err));

  }, [selectedCellType, selectedComparison, availableGenes]);

  // 3. Dynamically Fetch Expressions for Selected Genes
  useEffect(() => {
    selectedGenes.forEach(g => {
      if (!geneExpressions[g.safe]) {
        fetch(`data/genes/${g.safe}.json`)
          .then(r => r.json())
          .then(d => setGeneExpressions(prev => ({ ...prev, [g.safe]: d })));
      }
    });
  }, [selectedGenes, geneExpressions]);

  // --- Process Volcano Plot ---
  const [testCond, refCond] = selectedComparison ? selectedComparison.split('_vs_') : ["Test", "Ref"];

  const volcanoPlot = useMemo(() => {
    if (!volcanoData) return null;
    const colors = [];
    const hover = [];
    const logp = [];

    for (let i=0; i<volcanoData.names.length; i++) {
      let fc = volcanoData.logfc[i];
      let p = Math.max(volcanoData.pvals[i], 1e-300);
      logp.push(-Math.log10(p));
      
      hover.push(`<b>${volcanoData.names[i]}</b><br>Log2FC: ${fc}<br>Adj P: ${p.toExponential(2)}`);
      if (fc > 0.5 && p < 0.05) colors.push('#d62728'); // Up in Test
      else if (fc < -0.5 && p < 0.05) colors.push('#1f77b4'); // Up in Ref
      else colors.push('#b3b3b3');
    }

    return [{
      x: volcanoData.logfc, y: logp, text: hover,
      mode: 'markers', type: 'scattergl', hoverinfo: 'text',
      marker: { color: colors, size: 6, opacity: 0.7 }
    }];
  }, [volcanoData]);

  // --- Process Split Violins ---
  const violinPlot = useMemo(() => {
    if (!config || !cellClusters || selectedGenes.length === 0) return null;

    const cellTypeArr = cellClusters[config.celltype_col];
    const treatArr = cellClusters[config.treatment_col];
    if (!cellTypeArr || !treatArr) return null;

    const traces = [];

    const norm = (s) => String(s || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");

    const normTargetCT = norm(selectedCellType);
    const normTest = norm(testCond);
    const normRef = norm(refCond);

    selectedGenes.forEach(gene => {
      const exprData = geneExpressions[gene.safe];
      if (!exprData || !exprData.i) return;

      const dense = new Float32Array(cellTypeArr.length);
      exprData.i.forEach((idx, k) => dense[idx] = exprData.v[k]);

      const testVals = [];
      const refVals = [];

      for (let i = 0; i < cellTypeArr.length; i++) {
        const ct = norm(cellTypeArr[i]);
        const treat = norm(treatArr[i]);

        if (ct === normTargetCT) {
          const val = dense[i];
          
          if (filterZeros && val === 0) continue; 

          if (treat === normTest) testVals.push(val);
          if (treat === normRef) refVals.push(val);
        }
      }

      // Trace for Test Condition (Right side of violin)
      traces.push({
        type: 'violin',
        name: testCond,
        y: testVals,
        x: Array(testVals.length).fill(gene.original),
        legendgroup: testCond,
        scalegroup: gene.original,
        side: 'positive',
        line: { color: '#d62728' }, 
        meanline: { visible: true },
        points: false,               // Hides the ugly outlier dots
        spanmode: 'hard',            // Stops the violin from curving below zero
        box: { visible: false },     // Removes the crushed boxplot
        showlegend: traces.findIndex(t => t.name === testCond) === -1
      });

      // Trace for Ref Condition (Left side of violin)
      traces.push({
        type: 'violin',
        name: refCond,
        y: refVals,
        x: Array(refVals.length).fill(gene.original),
        legendgroup: refCond,
        scalegroup: gene.original,
        side: 'negative',
        line: { color: '#1f77b4' }, 
        meanline: { visible: true },
        points: false,              
        spanmode: 'hard',            
        box: { visible: false },    
        showlegend: traces.findIndex(t => t.name === refCond) === -1
      });
    });

    return traces;
  }, [selectedGenes, geneExpressions, config, cellClusters, selectedCellType, testCond, refCond, filterZeros]); 

  return (
    <div className="p-6 flex flex-col gap-4 h-full bg-gray-100 overflow-y-auto">
      
      {/* Top Filter Bar */}
      <div className="bg-white p-4 border shadow-sm rounded flex flex-wrap gap-6 items-center">
        <label className="text-sm font-semibold flex flex-col gap-1">
          <span className="text-gray-500 uppercase tracking-wide text-xs">Cell Type</span>
          <select 
            className="border border-gray-300 p-2 rounded outline-none w-64 bg-white"
            value={selectedCellType} 
            onChange={e => { setSelectedCellType(e.target.value); setSelectedGenes([]); }}
          >
            {Object.keys(comparisonsMap).map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>

        <label className="text-sm font-semibold flex flex-col gap-1">
          <span className="text-blue-600 uppercase tracking-wide text-xs">Pairwise Comparison</span>
          <select 
            className="border border-blue-400 bg-blue-50 text-blue-900 p-2 rounded outline-none w-64"
            value={selectedComparison} 
            onChange={e => { setSelectedComparison(e.target.value); setSelectedGenes([]); }}
          >
            {(comparisonsMap[selectedCellType] || []).map(c => (
              <option key={c} value={c}>{c.replace('_vs_', ' vs ')}</option>
            ))}
          </select>
        </label>
      </div>

      {/* Top Half: Volcano and Table */}
      <div className="flex gap-4 h-[400px] shrink-0">
        
        {/* Volcano Plot */}
        <div className="w-1/2 bg-white border shadow-sm rounded p-4 flex flex-col relative">
          <h3 className="font-bold text-gray-700 text-center mb-1">Pairwise Volcano Plot</h3>
          <p className="text-xs text-center text-gray-500 mb-2 truncate">
            <b className="text-red-600">{testCond}</b> (Right/Up) vs <b className="text-blue-600">{refCond}</b> (Left/Down) in <b>{selectedCellType}</b>
          </p>
          <div className="flex-1 min-h-0">
            {volcanoPlot ? (
              <Plot
                data={volcanoPlot}
                layout={{
                  autosize: true,
                  xaxis: { title: 'Log2 Fold Change', zeroline: true, zerolinecolor: '#000', automargin: true },
                  yaxis: { title: '-Log10(Adj. P-Value)', zeroline: true, automargin: true },
                  showlegend: false, margin: { l: 50, r: 20, t: 10, b: 40 }
                }}
                useResizeHandler={true} style={{ width: "100%", height: "100%" }}
              />
            ) : <div className="flex justify-center items-center h-full text-gray-400">Loading Volcano Data...</div>}
          </div>
        </div>

        {/* Top Genes Summary */}
        <div className="w-1/2 bg-white border shadow-sm rounded flex flex-col overflow-hidden">
          <div className="bg-gray-100 border-b px-4 py-2">
            <h3 className="font-bold text-sm text-gray-700">Top DE Genes for {selectedCellType}</h3>
          </div>
          <div className="flex-1 overflow-auto p-4">
            {summaryTable.length > 0 ? (
              <div className="flex flex-col gap-6">
                <div>
                  <h4 className="text-sm font-bold text-red-600 mb-2 border-b pb-1">Upregulated in {testCond}</h4>
                  <div className="flex flex-wrap gap-2">
                    {summaryTable[0]["Top Upregulated"].replace(/[\[\]']/g, '').split(',').map(g => (
                      <span key={g} className="bg-red-50 text-red-700 border border-red-200 px-2 py-1 rounded text-sm">{g.trim()}</span>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-blue-600 mb-2 border-b pb-1">Upregulated in {refCond}</h4>
                  <div className="flex flex-wrap gap-2">
                    {summaryTable[0]["Top Downregulated"].replace(/[\[\]']/g, '').split(',').map(g => (
                      <span key={g} className="bg-blue-50 text-blue-700 border border-blue-200 px-2 py-1 rounded text-sm">{g.trim()}</span>
                    ))}
                  </div>
                </div>
              </div>
            ) : <div className="text-gray-400 text-center mt-10">No summary data available.</div>}
          </div>
        </div>
      </div>

      {/* Bottom Half: Multi-Gene Split Violin */}
      <div className="flex-1 bg-white border shadow-sm rounded p-4 flex flex-col min-h-[400px]">
        <div className="flex gap-4 items-center mb-4 bg-gray-50 p-2 border rounded">
          <span className="font-bold text-sm text-gray-700 shrink-0">Compare Expression:</span>
          <MultiSearchableSelect 
            options={availableGenes} 
            selected={selectedGenes} 
            onChange={setSelectedGenes} 
            max={5} 
          />
          <label className="flex items-center gap-2 text-sm text-gray-600 ml-auto cursor-pointer font-semibold">
            <input 
              type="checkbox" 
              checked={filterZeros} 
              onChange={e => setFilterZeros(e.target.checked)} 
              className="cursor-pointer w-4 h-4"
            />
            Hide Zero-Expression Cells
          </label>
        </div>
        
        <div className="flex-1 relative">
          {selectedGenes.length === 0 ? (
            <div className="flex justify-center items-center h-full text-gray-400">Search and select genes above to view expression distribution.</div>
          ) : violinPlot ? (
            <Plot
              data={violinPlot}
              layout={{
                autosize: true,
                violinmode: 'overlay', // This is what splits them side-by-side perfectly
                xaxis: { title: 'Genes', automargin: true },
                yaxis: { title: 'Log Expression', automargin: true, zeroline: false },
                legend: { orientation: 'h', y: 1.1, x: 0.5, xanchor: 'center' },
                margin: { l: 50, r: 20, t: 30, b: 40 }
              }}
              useResizeHandler={true} style={{ width: "100%", height: "100%" }}
            />
          ) : <div className="flex justify-center items-center h-full text-gray-400">Loading Expression Data...</div>}
        </div>
      </div>

    </div>
  );
}