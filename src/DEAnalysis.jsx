import React, { useState, useEffect, useMemo } from 'react';
import Plotly from 'plotly.js-dist-min';
import factory from 'react-plotly.js/factory';
import * as d3 from 'd3';
import { API_BASE_URL } from './config';


const createPlotlyComponent = typeof factory === 'function' ? factory : factory.default;
const Plot = createPlotlyComponent(Plotly);

export default function DEAnalysis() {
  // --- State ---
  const [deMetadata, setDeMetadata] = useState({});
  const [selectedAnnotation, setSelectedAnnotation] = useState("");
  const [selectedCluster, setSelectedCluster] = useState("");
  
  const [topGenesTable, setTopGenesTable] = useState([]);
  const [volcanoData, setVolcanoData] = useState([]);
  
  const [gene1, setGene1] = useState("");
  const [gene2, setGene2] = useState("");
  const [availableGenes, setAvailableGenes] = useState([]);
  
  const [expressionData, setExpressionData] = useState(null); 
  const [obsData, setObsData] = useState(null); 

  // --- Load Metadata & Setup ---
  useEffect(() => {
    async function initData() {
      try {
        const metaRes = await fetch('data/de_analysis/de_metadata.json');
        if (metaRes.ok) {
          const meta = await metaRes.json();
          setDeMetadata(meta);
          const annos = Object.keys(meta);
          if (annos.length > 0) {
            setSelectedAnnotation(annos[0]);
            setSelectedCluster(meta[annos[0]][0]);
          }
        }

        const geneRes = await fetch('data/genes.json');
        if (geneRes.ok) {
          const genes = await geneRes.json();
          setAvailableGenes(genes);
        }

        const [obsCsv, exprCsv] = await Promise.all([
          d3.csv(`${API_BASE_URL}/obs.csv`),
          d3.csv(`${API_BASE_URL}/expression_matrix.csv`)
        ]);
        setObsData(obsCsv);
        setExpressionData(exprCsv);

      } catch (err) {
        console.error("Failed to load DE base data:", err);
      }
    }
    initData();
  }, []);

  // Update cluster list when annotation changes
  useEffect(() => {
    if (deMetadata[selectedAnnotation]) {
      setSelectedCluster(deMetadata[selectedAnnotation][0]);
    }
  }, [selectedAnnotation, deMetadata]);

  // --- Load Volcano & Table Data ---
  useEffect(() => {
    if (!selectedAnnotation || !selectedCluster) return;

    async function fetchDEFiles() {
      try {
        // Load Table Data
        const tableCsv = await d3.csv(`${API_BASE_URL}/de_analysis/top_DEgenes_${selectedAnnotation}.csv`);
        setTopGenesTable(tableCsv);

        // FIX 1: Set Default Genes from the robust Table data, NOT the fold-change Volcano data
        const clusterRow = tableCsv.find(r => r["Cluster Name"] === selectedCluster);
        if (clusterRow && clusterRow["Top Genes"]) {
            const topGenesStr = clusterRow["Top Genes"].replace(/[\[\]']/g, ''); // Clean Python string
            const topGenesArr = topGenesStr.split(',').map(s => s.trim());
            if (topGenesArr.length >= 2) {
                setGene1(topGenesArr[0]);
                setGene2(topGenesArr[1]);
            }
        }

        // Load Volcano Data
        const safeClusterName = selectedCluster.replace(/[^\w\s-]/g, "").replace(/\s+/g, "_");
        const volcanoCsv = await d3.csv(`${API_BASE_URL}/de_analysis/${selectedAnnotation}_cluster_${safeClusterName}_data.csv`);
        setVolcanoData(volcanoCsv);

      } catch (err) {
        console.warn("Could not load DE specific files.", err);
      }
    }
    fetchDEFiles();
  }, [selectedAnnotation, selectedCluster]);

  // --- Generate Volcano Plot Config ---
  const volcanoPlot = useMemo(() => {
    if (!volcanoData || volcanoData.length === 0) return null;

    const x = [];
    const y = [];
    const text = [];
    const colors = [];

    volcanoData.forEach(row => {
      let logfc = parseFloat(row.logfoldchanges);
      let rawPval = parseFloat(row.pvals_adj);
      
      if (isNaN(logfc)) logfc = 0;
      if (isNaN(rawPval)) rawPval = 1.0;

      const padj = Math.max(rawPval, 1e-300); 
      const logp = -Math.log10(padj);
      
      x.push(logfc);
      y.push(logp);
      text.push(`<b>${row.names}</b><br>Log2FC: ${logfc.toFixed(2)}<br>Adj P-val: ${padj.toExponential(2)}`);

      if (logfc > 1 && padj < 0.05) colors.push('#d62728'); // Red (Upregulated)
      else if (logfc < -1 && padj < 0.05) colors.push('#1f77b4'); // Blue (Downregulated)
      else colors.push('#b3b3b3'); // Grey (Not significant)
    });

    return [{
      x, y, text,
      mode: 'markers',
      type: 'scattergl', 
      hoverinfo: 'text',
      marker: { color: colors, size: 6, opacity: 0.7 }
    }];
  }, [volcanoData]);

  // --- Generate Violin Plot Configs ---
  const createViolinPlot = (targetGene) => {
    if (!obsData || !expressionData || !selectedAnnotation || !targetGene) return null;

    // Safely find the exact matching gene key ignoring case/whitespace
    const geneKeys = Object.keys(expressionData[0] || {});
    const exactGeneKey = geneKeys.find(k => k.trim().toLowerCase() === targetGene.trim().toLowerCase()) || targetGene;

    const clusters = {};
    for (let i = 0; i < obsData.length; i++) {
      if (!obsData[i] || !expressionData[i]) continue;
        
      const cluster = obsData[i][selectedAnnotation];
      if (!cluster) continue;

      const expr = parseFloat(expressionData[i][exactGeneKey]) || 0;
      
      if (!clusters[cluster]) clusters[cluster] = [];
      clusters[cluster].push(expr);
    }

    const sortedLabels = Object.keys(clusters).sort();
    
    // FIX 2: Switched to Violin plot for better single-cell zero-inflation visualization
    return sortedLabels.map((label) => ({
      y: clusters[label],
      name: label,
      type: 'violin',
      points: 'all', 
      jitter: 0.5,
      pointpos: 0,
      marker: { size: 3, opacity: 0.5 },
      box: { visible: true },
      meanline: { visible: true }
    }));
  };

  return (
    <div className="p-6 flex flex-col gap-4 h-full bg-gray-100">
      
      <div className="bg-white p-4 border shadow-sm rounded flex flex-wrap gap-6 items-center">
        <label className="text-sm font-semibold flex flex-col gap-1">
          <span className="text-gray-500 uppercase tracking-wide text-xs">Annotation / Clustering</span>
          <select 
            className="border border-gray-300 p-2 rounded outline-none w-64 bg-white"
            value={selectedAnnotation} 
            onChange={e => setSelectedAnnotation(e.target.value)}
          >
            {Object.keys(deMetadata).map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>

        <label className="text-sm font-semibold flex flex-col gap-1">
          <span className="text-blue-600 uppercase tracking-wide text-xs">Target Cluster (Vs Rest)</span>
          <select 
            className="border border-blue-400 bg-blue-50 text-blue-900 p-2 rounded outline-none w-48"
            value={selectedCluster} 
            onChange={e => setSelectedCluster(e.target.value)}
          >
            {(deMetadata[selectedAnnotation] || []).map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
      </div>

      <div className="flex gap-4 flex-1 min-h-0">
        
        <div className="w-1/2 bg-white border shadow-sm rounded p-4 flex flex-col">
          <h3 className="font-bold text-gray-700 text-center mb-1">Volcano Plot</h3>
          <p className="text-xs text-center text-gray-500 mb-2">Cluster <b>{selectedCluster}</b> vs All Other Cells</p>
          <div className="flex-1 relative">
            {volcanoPlot ? (
              <Plot
                data={volcanoPlot}
                layout={{
                  autosize: true,
                  // FIX 3: automargin handles the clipping of labels automatically
                  xaxis: { 
                    title: { text: 'Log2 Fold Change', standoff: 15 }, 
                    zeroline: true, 
                    zerolinecolor: '#000',
                    automargin: true 
                  },
                  yaxis: { 
                    title: { text: '-Log10(Adj. P-Value)', standoff: 15 }, 
                    zeroline: true,
                    automargin: true 
                  },
                  showlegend: false,
                  margin: { l: 60, r: 20, t: 20, b: 60 }
                }}
                useResizeHandler={true}
                style={{ width: "100%", height: "100%" }}
              />
            ) : <div className="flex items-center justify-center h-full text-gray-400">Loading Volcano Data...</div>}
          </div>
        </div>

        <div className="w-1/2 flex flex-col gap-4">
          
          <div className="flex gap-4 h-1/2">
            
            <div className="w-1/2 bg-white border shadow-sm rounded p-3 flex flex-col">
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-bold text-xs text-gray-700">Gene 1:</h3>
                <select className="border p-1 text-xs rounded outline-none bg-white max-w-[120px]" value={gene1} onChange={e => setGene1(e.target.value)}>
                  {availableGenes.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div className="flex-1 relative">
                {expressionData ? (
                  <Plot
                    data={createViolinPlot(gene1)}
                    layout={{
                      autosize: true, 
                      showlegend: false,
                      xaxis: { 
                        showticklabels: false, 
                        title: { text: 'Cell Clusters', standoff: 10 },
                        automargin: true 
                      },
                      yaxis: { 
                        title: { text: 'Log-Norm Expression', standoff: 10 },
                        automargin: true,
                        zeroline: false
                      },
                      margin: { l: 60, r: 10, t: 10, b: 50 }
                    }}
                    useResizeHandler={true} style={{ width: "100%", height: "100%" }}
                  />
                ) : <span className="text-xs text-gray-400">Loading...</span>}
              </div>
            </div>

            <div className="w-1/2 bg-white border shadow-sm rounded p-3 flex flex-col">
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-bold text-xs text-gray-700">Gene 2:</h3>
                <select className="border p-1 text-xs rounded outline-none bg-white max-w-[120px]" value={gene2} onChange={e => setGene2(e.target.value)}>
                  {availableGenes.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div className="flex-1 relative">
                {expressionData ? (
                  <Plot
                    data={createViolinPlot(gene2)}
                    layout={{
                      autosize: true, 
                      showlegend: false,
                      xaxis: { 
                        showticklabels: false, 
                        title: { text: 'Cell Clusters', standoff: 10 },
                        automargin: true 
                      },
                      yaxis: { 
                        title: { text: 'Log-Norm Expression', standoff: 10 },
                        automargin: true,
                        zeroline: false
                      },
                      margin: { l: 60, r: 10, t: 10, b: 50 }
                    }}
                    useResizeHandler={true} style={{ width: "100%", height: "100%" }}
                  />
                ) : <span className="text-xs text-gray-400">Loading...</span>}
              </div>
            </div>
          </div>

          <div className="h-1/2 bg-white border shadow-sm rounded flex flex-col overflow-hidden">
            <div className="bg-gray-100 border-b px-4 py-2">
              <h3 className="font-bold text-sm text-gray-700">Top Marker Genes per Cluster</h3>
            </div>
            <div className="flex-1 overflow-auto p-0">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 sticky top-0 border-b border-gray-200 z-10">
                  <tr>
                    <th className="px-4 py-2 text-gray-700 font-bold w-32">Cluster</th>
                    <th className="px-4 py-2 text-gray-700 font-bold">Top Genes</th>
                  </tr>
                </thead>
                <tbody>
                  {topGenesTable.map((row, i) => (
                    <tr key={i} className={`border-b hover:bg-blue-50 ${row["Cluster Name"] === selectedCluster ? 'bg-blue-100' : ''}`}>
                      <td className="px-4 py-2 font-semibold">{row["Cluster Name"]}</td>
                      <td className="px-4 py-2 font-mono text-xs text-gray-600">
                        {row["Top Genes"]?.replace(/[\[\]']/g, '')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}