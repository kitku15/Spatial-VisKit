import React, { useState, useEffect, useMemo, useRef } from 'react';
import Plotly from 'plotly.js-dist-min';
import factory from 'react-plotly.js/factory';
import * as d3 from 'd3';
import InfoModal from './InfoModal';
import { tabInfo } from './infoHelper';

const createPlotlyComponent = typeof factory === 'function' ? factory : factory.default;
const Plot = createPlotlyComponent(Plotly);

// --- Standard Single Searchable Dropdown ---
function SearchableSelect({ options, value, onChange, placeholder }) {
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

  const filteredOptions = options.filter(opt => opt.original.toLowerCase().includes(search.toLowerCase()));

  return (
    <div ref={wrapperRef} className="relative flex-1 max-w-[250px]">
      <div className="border border-gray-300 bg-white p-1.5 rounded flex items-center justify-between cursor-text" onClick={() => setIsOpen(true)}>
        <input
          type="text" className="outline-none w-full text-sm px-1 bg-transparent"
          placeholder={value ? value.original : placeholder}
          value={isOpen ? search : (value ? value.original : "")}
          onChange={(e) => { setSearch(e.target.value); setIsOpen(true); }}
        />
        <button className="text-gray-500 px-1 text-xs cursor-pointer" onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}>▼</button>
      </div>
      {isOpen && (
        <div className="absolute z-20 w-full mt-1 bg-white border border-gray-300 rounded shadow-lg max-h-48 overflow-y-auto">
          {filteredOptions.length > 0 ? (
            filteredOptions.map((opt) => (
              <div key={opt.safe} className="p-2 text-sm hover:bg-blue-100 cursor-pointer" onClick={() => { onChange(opt); setSearch(""); setIsOpen(false); }}>
                {opt.original}
              </div>
            ))
          ) : (<div className="p-2 text-sm text-gray-500 italic">No genes found</div>)}
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
  
  // 3 Explicit slots for the 3-column row
  const [panelGenes, setPanelGenes] = useState([null, null, null]);

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
        console.warn("Conditions DE Analysis data not found.");
      }
    }
    initData();
  }, []);

  // Update comparison dropdown when cell type changes
  useEffect(() => {
    if (selectedCellType && comparisonsMap[selectedCellType]) {
      const availableComparisons = comparisonsMap[selectedCellType];
      setSelectedComparison(prev => availableComparisons.includes(prev) ? prev : (availableComparisons[0] || ""));
    }
  }, [selectedCellType, comparisonsMap]);

  // 2. Fetch Plot Data when Selections Change
  useEffect(() => {
    if (!selectedCellType || !selectedComparison) return;

    fetch(`data/conditions_de_analysis/${selectedCellType}_comparison_${selectedComparison}.json`)
      .then(r => r.json())
      .then(setVolcanoData)
      .catch(() => setVolcanoData(null));

    d3.csv(`data/conditions_de_analysis/summary_${selectedCellType}.csv`)
      .then(data => {
        const compRow = data.find(d => d.Comparison === selectedComparison);
        if (compRow) {
          const upList = compRow["Top Upregulated"].replace(/[\[\]']/g, '').split(',').map(s => s.trim()).filter(Boolean);
          const downList = compRow["Top Downregulated"].replace(/[\[\]']/g, '').split(',').map(s => s.trim()).filter(Boolean);
          
          const defaultGeneNames = [...upList.slice(0, 2), ...downList.slice(0, 1)];
          const initialGenes = defaultGeneNames.map(name => availableGenes.find(g => g.original === name)).filter(Boolean);
          
          // Pad to ensure we have exactly 3 slots
          const paddedGenes = [
            initialGenes[0] || null, 
            initialGenes[1] || null, 
            initialGenes[2] || null
          ];
          
          // Only auto-populate if all current panels are empty
          if (panelGenes.every(g => g === null)) {
            setPanelGenes(paddedGenes);
          }
          setSummaryTable([compRow]);
        }
      }).catch(err => console.warn(err));

  }, [selectedCellType, selectedComparison, availableGenes]);

  // 3. Dynamically Fetch Expressions for Selected Genes
  useEffect(() => {
    panelGenes.forEach(g => {
      if (g && !geneExpressions[g.safe]) {
        fetch(`data/genes/${g.safe}.json`)
          .then(r => r.json())
          .then(d => setGeneExpressions(prev => ({ ...prev, [g.safe]: d })));
      }
    });
  }, [panelGenes, geneExpressions]);

  const handleGeneChange = (index, newGene) => {
    const updated = [...panelGenes];
    updated[index] = newGene;
    setPanelGenes(updated);
  };

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
      
      if (fc > 0.5 && p < 0.05) colors.push('#d62728');
      else if (fc < -0.5 && p < 0.05) colors.push('#1f77b4');
      else colors.push('#b3b3b3');
    }

    return [{
      x: volcanoData.logfc, y: logp, text: hover,
      mode: 'markers', type: 'scattergl', hoverinfo: 'text',
      marker: { color: colors, size: 6, opacity: 0.7 }
    }];
  }, [volcanoData]);

  // --- Helper to Generate a Split Violin & Mean Lines ---
  const createSingleSplitViolin = (gene) => {
    if (!config || !cellClusters || !gene || !geneExpressions[gene.safe]) return null;

    const cellTypeArr = cellClusters[config.celltype_col];
    const treatArr = cellClusters[config.treatment_col];
    const exprData = geneExpressions[gene.safe];
    
    if (!cellTypeArr || !treatArr || !exprData || !exprData.i) return null;

    const norm = (s) => String(s || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
    const normTargetCT = norm(selectedCellType);
    const normTest = norm(testCond);
    const normRef = norm(refCond);

    const dense = new Float32Array(cellTypeArr.length);
    exprData.i.forEach((idx, k) => dense[idx] = exprData.v[k]);

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

    // Calculate the means for our full-width reference lines
    const testMean = testVals.length > 0 ? testVals.reduce((a, b) => a + b, 0) / testVals.length : 0;
    const refMean = refVals.length > 0 ? refVals.reduce((a, b) => a + b, 0) / refVals.length : 0;

    // Create the full-width dotted lines
    const meanShapes = [
      {
        type: 'line',
        xref: 'paper', x0: 0, x1: 1, // 'paper' makes it span the full plot width
        yref: 'y', y0: testMean, y1: testMean,
        line: { color: '#d62728', dash: 'dot', width: 2 },
        opacity: 0.8
      },
      {
        type: 'line',
        xref: 'paper', x0: 0, x1: 1,
        yref: 'y', y0: refMean, y1: refMean,
        line: { color: '#1f77b4', dash: 'dot', width: 2 },
        opacity: 0.8
      }
    ];

    return {
      traces: [
        {
          type: 'violin', name: testCond, y: testVals, x: Array(testVals.length).fill(gene.original),
          legendgroup: testCond, scalegroup: 'group', side: 'positive', line: { color: '#d62728' }, 
          meanline: { visible: false }, points: false, spanmode: 'soft', box: { visible: false } // Turned off internal meanline
        },
        {
          type: 'violin', name: refCond, y: refVals, x: Array(refVals.length).fill(gene.original),
          legendgroup: refCond, scalegroup: 'group', side: 'negative', line: { color: '#1f77b4' }, 
          meanline: { visible: false }, points: false, spanmode: 'soft', box: { visible: false } // Turned off internal meanline
        }
      ],
      shapes: meanShapes
    };
  };

  return (
    <div className="p-6 flex flex-col gap-4 h-full bg-gray-100 overflow-y-auto">
      
      {/* Top Filter Bar */}
      <div className="bg-white p-4 border shadow-sm rounded flex flex-wrap gap-6 items-center">
        <label className="text-sm font-semibold flex flex-col gap-1">
          <span className="text-gray-500 uppercase tracking-wide text-xs">Cell Type</span>
          <select 
            className="border border-gray-300 p-2 rounded outline-none w-64 bg-white"
            value={selectedCellType} 
            onChange={e => { setSelectedCellType(e.target.value); setPanelGenes([null, null, null]); }}
          >
            {Object.keys(comparisonsMap).map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>

        <label className="text-sm font-semibold flex flex-col gap-1">
          <span className="text-blue-600 uppercase tracking-wide text-xs">Pairwise Comparison</span>
          <select 
            className="border border-blue-400 bg-blue-50 text-blue-900 p-2 rounded outline-none w-64"
            value={selectedComparison} 
            onChange={e => { setSelectedComparison(e.target.value); setPanelGenes([null, null, null]); }}
          >
            {(comparisonsMap[selectedCellType] || []).map(c => (
              <option key={c} value={c}>{c.replace('_vs_', ' vs ')}</option>
            ))}
          </select>
        </label>
        
        <div className="ml-auto flex items-center gap-6 mt-4">
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer font-semibold">
            <input 
              type="checkbox" checked={filterZeros} onChange={e => setFilterZeros(e.target.checked)} 
              className="cursor-pointer w-4 h-4"
            />
            Hide Zero-Expression Cells
          </label>

          <InfoModal 
            title={tabInfo.conditionsDe.title} 
            content={tabInfo.conditionsDe.content} 
          />
        </div>
      </div>

      {/* Top Half: Volcano and Table */}
      <div className="flex gap-4 h-[350px] shrink-0">
        <div className="w-1/2 bg-white border shadow-sm rounded p-4 flex flex-col relative">
          <h3 className="font-bold text-gray-700 text-center mb-1">Pairwise Volcano Plot</h3>
          <div className="flex-1 min-h-0">
            {volcanoPlot ? (
              <Plot
                data={volcanoPlot}
                layout={{ autosize: true, xaxis: { title: 'Log2 Fold Change', zeroline: true }, yaxis: { title: '-Log10(Adj. P-Value)', zeroline: true }, showlegend: false, margin: { l: 50, r: 20, t: 10, b: 40 } }}
                useResizeHandler={true} style={{ width: "100%", height: "100%" }}
              />
            ) : <div className="flex justify-center items-center h-full text-gray-400">Loading Data...</div>}
          </div>
        </div>

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

      {/* Bottom Half: 3-Column Grid of Gene Panels */}
      <div className="grid grid-cols-3 gap-4 flex-1">
        {panelGenes.map((gene, index) => {
          const plotData = createSingleSplitViolin(gene);
          
          return (
            <div key={index} className="bg-white border shadow-sm rounded p-3 flex flex-col min-h-[300px]">
              <div className="flex justify-between items-center mb-2 z-10">
                <span className="font-bold text-xs text-gray-500 uppercase">Panel {index + 1}</span>
                <SearchableSelect 
                  options={availableGenes} 
                  value={gene} 
                  onChange={(newGene) => handleGeneChange(index, newGene)} 
                  placeholder="Select a gene..." 
                />
              </div>
              
              <div className="flex-1 relative">
                {!gene ? (
                  <div className="flex justify-center items-center h-full text-gray-400 text-sm">Select a gene above to view distribution</div>
                ) : plotData ? (
                  <Plot
                    data={plotData.traces} // Inject the traces
                    layout={{
                      autosize: true,
                      violinmode: 'overlay',
                      shapes: plotData.shapes, // Inject the full-width mean lines
                      xaxis: { showticklabels: false, automargin: true },
                      yaxis: { title: index === 0 ? 'Log Expression' : '', automargin: true, zeroline: false },
                      showlegend: false,
                      margin: { l: index === 0 ? 50 : 30, r: 20, t: 10, b: 20 }
                    }}
                    useResizeHandler={true} style={{ width: "100%", height: "100%" }}
                  />
                ) : (
                  <div className="flex justify-center items-center h-full text-gray-400 text-sm">Loading {gene.original}...</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
}