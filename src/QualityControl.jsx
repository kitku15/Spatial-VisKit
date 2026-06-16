import React, { useState, useEffect } from 'react';
import Plotly from 'plotly.js-dist-min';
import factory from 'react-plotly.js/factory';
import * as d3 from 'd3';

const createPlotlyComponent = typeof factory === 'function' ? factory : factory.default;
const Plot = createPlotlyComponent(Plotly);

export default function QualityControl() {
  const [qcData, setQcData] = useState(null);
  const [thresholds, setThresholds] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch threshold JSON
        const threshRes = await fetch('data/qc/qc_thresholds.json');
        if (threshRes.ok) {
          const threshData = await threshRes.json();
          setThresholds(threshData);
        }

        // Fetch metrics CSV
        const csvData = await d3.csv('data/qc/qc_metrics.csv');
        if (csvData && csvData.length > 0) {
          setQcData(csvData);
        }
      } catch (err) {
        console.error("Failed to load QC data:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  if (isLoading) {
    return <div className="p-6 text-gray-500">Loading QC Metrics...</div>;
  }

  if (!qcData || !thresholds) {
    return (
      <div className="p-6">
        <p className="bg-red-50 p-4 border border-red-200 text-red-600 rounded">
          Failed to load QC data. Please ensure qc_metrics.csv and qc_thresholds.json exist in public/data/qc/.
        </p>
      </div>
    );
  }

  // Parse columns into float arrays for plotting
  const totalCounts = qcData.map(d => parseFloat(d.total_counts));
  const uniqueGenes = qcData.map(d => parseFloat(d.n_genes_by_counts));
  const area = qcData.map(d => parseFloat(d.area));
  const nucleusSignal = qcData.map(d => parseFloat(d.nucleus_signal));

  // Helper to draw a red cutoff line
  const createThresholdLine = (value) => {
    if (value === null || value === undefined) return [];
    return [{
      type: 'line',
      x0: value,
      x1: value,
      y0: 0,
      y1: 1,
      yref: 'paper', // Spans the entire height of the plot
      line: { color: 'red', width: 2, dash: 'dash' }
    }];
  };

  return (
    <div className="p-6 flex flex-col gap-6 h-full overflow-y-auto">
      <div className="bg-white p-4 border shadow-sm rounded flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Pre-Filter Quality Control Metrics</h2>
          <p className="text-sm text-gray-500">
            Interactive distributions of cell metrics. Red dashed lines indicate the cutoff thresholds applied during the pipeline.
          </p>
        </div>
        <div className="text-sm bg-blue-50 border border-blue-200 text-blue-800 px-4 py-2 rounded">
          Total Cells Analyzed: <b>{qcData.length.toLocaleString()}</b>
        </div>
      </div>

      {/* Grid for the 4 histograms */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        
        {/* Plot 1: Total Transcripts */}
        <div className="bg-white p-4 border shadow-sm rounded h-96 flex flex-col">
          <h3 className="font-bold text-gray-700 text-center mb-2">Total Transcripts per Cell</h3>
          <div className="flex-1 min-h-0">
            <Plot
              data={[{ x: totalCounts, type: 'histogram', marker: { color: '#1f77b4' } }]}
              layout={{
                autosize: true,
                margin: { l: 50, r: 20, t: 10, b: 40 }, // Reduced top margin (t: 10)
                xaxis: { title: 'Counts' },
                yaxis: { title: 'Frequency' },
                shapes: createThresholdLine(thresholds.min_counts)
              }}
              useResizeHandler={true}
              style={{ width: "100%", height: "100%" }}
            />
          </div>
        </div>

        {/* Plot 2: Unique Genes */}
        <div className="bg-white p-4 border shadow-sm rounded h-96 flex flex-col">
          <h3 className="font-bold text-gray-700 text-center mb-2">Unique Genes per Cell</h3>
          <div className="flex-1 min-h-0">
            <Plot
              data={[{ x: uniqueGenes, type: 'histogram', marker: { color: '#2ca02c' } }]}
              layout={{
                autosize: true,
                margin: { l: 50, r: 20, t: 10, b: 40 },
                xaxis: { title: 'Genes' },
                yaxis: { title: 'Frequency' }
              }}
              useResizeHandler={true}
              style={{ width: "100%", height: "100%" }}
            />
          </div>
        </div>

        {/* Plot 3: Cell Area */}
        <div className="bg-white p-4 border shadow-sm rounded h-96 flex flex-col">
          <h3 className="font-bold text-gray-700 text-center mb-2">Cell Area ({thresholds.area_col})</h3>
          <div className="flex-1 min-h-0">
            <Plot
              data={[{ x: area, type: 'histogram', marker: { color: '#ff7f0e' } }]}
              layout={{
                autosize: true,
                margin: { l: 50, r: 20, t: 10, b: 40 },
                xaxis: { title: 'Area' },
                yaxis: { title: 'Frequency' },
                shapes: [
                  ...createThresholdLine(thresholds.min_area),
                  ...createThresholdLine(thresholds.max_area)
                ]
              }}
              useResizeHandler={true}
              style={{ width: "100%", height: "100%" }}
            />
          </div>
        </div>

        {/* Plot 4: Nucleus / DAPI Signal */}
        <div className="bg-white p-4 border shadow-sm rounded h-96 flex flex-col">
          <h3 className="font-bold text-gray-700 text-center mb-2">
            {thresholds.has_dapi ? 'Mean DAPI (Nucleus Signal)' : 'Nucleus to Cell Area Ratio'}
          </h3>
          <div className="flex-1 min-h-0">
            <Plot
              data={[{ x: nucleusSignal, type: 'histogram', marker: { color: '#9467bd' } }]}
              layout={{
                autosize: true,
                margin: { l: 50, r: 20, t: 10, b: 40 },
                xaxis: { title: 'Signal' },
                yaxis: { title: 'Frequency' },
                shapes: createThresholdLine(thresholds.min_dapi)
              }}
              useResizeHandler={true}
              style={{ width: "100%", height: "100%" }}
            />
          </div>
        </div>

      </div>
    </div>
  );
}