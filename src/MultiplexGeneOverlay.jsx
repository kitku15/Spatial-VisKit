import React, { useState, useEffect, useMemo, useRef } from 'react';
import Plotly from 'plotly.js-dist-min';
import factory from 'react-plotly.js/factory';
import * as d3 from 'd3';

const createPlotlyComponent = typeof factory === 'function' ? factory : factory.default;
const Plot = createPlotlyComponent(Plotly);

// Standard additive primary colors for fluorescence
const CHANNEL_COLORS = {
  Red: [255, 0, 0],
  Green: [0, 255, 0],
  Blue: [0, 150, 255],
  Magenta: [255, 0, 255],
  Cyan: [0, 255, 255],
  Yellow: [255, 255, 0]
};

// Lightweight custom Searchable Dropdown
function SearchableSelect({ options, value, onChange, placeholder }) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const wrapperRef = useRef(null);

  // Close the dropdown if the user clicks anywhere outside of it
  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filter options based on what the user types
  const filteredOptions = options.filter(opt =>
    opt.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div ref={wrapperRef} className="relative flex-1">
      {/* The Toggle Box */}
      <div 
        className="border border-gray-300 bg-white p-1 rounded flex items-center justify-between cursor-text"
        onClick={() => setIsOpen(true)}
      >
        <input
          type="text"
          className="outline-none flex-1 w-full text-sm px-1 bg-transparent"
          placeholder={value || placeholder}
          // If open, show what they are typing. If closed, show the selected gene.
          value={isOpen ? search : value}
          onChange={(e) => {
            setSearch(e.target.value);
            setIsOpen(true);
          }}
        />
        {/* Dropdown Arrow Toggle */}
        <button 
          className="text-gray-500 px-2 cursor-pointer hover:text-gray-800"
          onClick={(e) => {
            e.stopPropagation(); // Prevent the parent div's onClick from firing
            setIsOpen(!isOpen);
          }}
        >
          ▼
        </button>
      </div>

      {/* The Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded shadow-lg max-h-48 overflow-y-auto">
          {filteredOptions.length > 0 ? (
            filteredOptions.map((opt) => (
              <div
                key={opt}
                className="p-2 text-sm hover:bg-blue-100 cursor-pointer"
                onClick={() => {
                  onChange(opt);   // Update the parent's state
                  setSearch("");   // Clear the search term
                  setIsOpen(false); // Close the dropdown
                }}
              >
                {opt}
              </div>
            ))
          ) : (
            <div className="p-2 text-sm text-gray-500 italic">No genes found</div>
          )}
        </div>
      )}
    </div>
  );
}

export default function MultiplexGeneOverlay() {
  // --- Metadata & UI State ---
  const [hierarchy, setHierarchy] = useState({});
  const [availableSlides, setAvailableSlides] = useState(["__ALL__"]);
  const [availableSamples, setAvailableSamples] = useState(["__ALL__"]);
  const [selectedSlide, setSelectedSlide] = useState("__ALL__");
  const [selectedSample, setSelectedSample] = useState("__ALL__");

  // --- Data State ---
  const [genes, setGenes] = useState([]);
  const [cellData, setCellData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // --- Plot Settings State ---
  const [gene1, setGene1] = useState("");
  const [gene2, setGene2] = useState("");
  const [color1, setColor1] = useState("Red");
  const [color2, setColor2] = useState("Green");
  const [maxThresh1, setMaxThresh1] = useState(5);
  const [maxThresh2, setMaxThresh2] = useState(5);
  
  // Point Size State
  const [pointSize, setPointSize] = useState(4);
  
  // Display background tissue?
  const [showBackground, setShowBackground] = useState(true);

  // 1. Load Data on mount
  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        // Load metadata, genes list, locations, and expression
        const [metaRes, geneRes, locRes, expRes] = await Promise.all([
          fetch('data/spatial_metadata.json').catch(() => null),
          fetch('data/genes.json'),
          d3.csv('data/locations.csv'),
          d3.csv('data/expression_matrix.csv')
        ]);

        const metaData = metaRes ? await metaRes.json() : {"All": ["All"]};
        const geneList = await geneRes.json();
        
        // Setup Hierarchy Options
        const slides = Object.keys(metaData);
        setHierarchy(metaData);
        setAvailableSlides(["__ALL__", ...slides]);

        // Auto-select if there is only 1 slide (great for test datasets)
        if (slides.length === 1) {
          setSelectedSlide(slides[0]);
        }

        setGenes(geneList);
        if (geneList.length >= 2) {
          setGene1(geneList[0]);
          setGene2(geneList[1]);
        }

        // Merge locations + expressions + slide/sample info into a fast lookup array
        const merged = locRes.map((loc, i) => ({
          id: loc.cell_id,
          x: +loc.CenterX_global_px,
          y: +loc.CenterY_global_px,
          slide: loc.slide_id || "All",
          sample: loc.sample_id || "All",
          expr: expRes[i] // Reference to the expression row
        }));
        
        setCellData(merged);
      } catch (err) {
        console.error("Failed to load multiplex data:", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  // 2. Update available samples when slide changes
  useEffect(() => {
    if (Object.keys(hierarchy).length === 0) return;
    
    let samps = [];
    if (selectedSlide === "__ALL__") {
      samps = Array.from(new Set(Object.values(hierarchy).flat()));
    } else {
      samps = hierarchy[selectedSlide] || [];
    }
    
    setAvailableSamples(["__ALL__", ...samps]);

    // Auto-select sample if there's only 1 valid sample (great for test datasets)
    if (samps.length === 1) {
      setSelectedSample(samps[0]);
    }
  }, [selectedSlide, hierarchy]);

  const handleSlideChange = (e) => {
    setSelectedSlide(e.target.value);
    setSelectedSample("__ALL__"); // Reset sample when manually changing slide
  };

  // 3. Compute Colors dynamically using Additive Blending
  const plotData = useMemo(() => {
    // Block plotting if NO specific sample is chosen
    if (!cellData || !gene1 || !gene2 || selectedSample === "__ALL__") return null;

    const rgb1 = CHANNEL_COLORS[color1];
    const rgb2 = CHANNEL_COLORS[color2];

    const xCoords = [];
    const yCoords = [];
    const colors = [];
    const hoverTexts = [];

    cellData.forEach(cell => {
      // SKIP cells that don't belong to the selected sample
      if (cell.sample !== selectedSample) return;

      // Get raw expression values safely
      const val1 = cell.expr ? +(cell.expr[gene1] || 0) : 0;
      const val2 = cell.expr ? +(cell.expr[gene2] || 0) : 0;

      // If NO expression, render as background tissue (if enabled)
      if (val1 === 0 && val2 === 0) {
        if (!showBackground) return; // Skip if toggle is off
        
        xCoords.push(cell.x);
        yCoords.push(cell.y);
        colors.push('rgb(30, 30, 30)'); // Faint dark grey for tissue
        hoverTexts.push(`${cell.id}<br>No expression`);
        return;
      }

      // Normalize by threshold (0.0 to 1.0)
      const norm1 = Math.min(val1 / maxThresh1, 1.0);
      const norm2 = Math.min(val2 / maxThresh2, 1.0);

      // Additive Blending logic (Mixing Red + Green = Yellow, etc.)
      const r = Math.min(255, Math.floor(norm1 * rgb1[0] + norm2 * rgb2[0]));
      const g = Math.min(255, Math.floor(norm1 * rgb1[1] + norm2 * rgb2[1]));
      const b = Math.min(255, Math.floor(norm1 * rgb1[2] + norm2 * rgb2[2]));

      xCoords.push(cell.x);
      yCoords.push(cell.y);
      colors.push(`rgb(${r},${g},${b})`);
      hoverTexts.push(`${cell.id}<br>${gene1}: ${val1.toFixed(2)}<br>${gene2}: ${val2.toFixed(2)}`);
    });

    return [{
      x: xCoords,
      y: yCoords,
      text: hoverTexts,
      mode: 'markers',
      type: 'scattergl', // WebGL is essential for thousands of cells
      hoverinfo: 'text',
      marker: {
        color: colors,
        size: pointSize, // <-- Linked to the state!
        opacity: 0.9
      }
    }];
  // Ensure pointSize is in the dependency array!
  }, [cellData, gene1, gene2, color1, color2, maxThresh1, maxThresh2, selectedSample, showBackground, pointSize]); 

  if (isLoading) {
    return <div className="p-6 text-gray-500">Loading spatial coordinates and expression matrix... This may take a moment.</div>;
  }

  return (
    <div className="p-6 flex flex-col gap-4 h-full">
      
      {/* Settings Panel */}
      <div className="bg-white p-4 border shadow-sm rounded flex flex-col gap-4">
        
        {/* TOP ROW: Slide & Sample Selectors */}
        <div className="flex flex-wrap gap-6 items-center border-b border-gray-200 pb-4">
          <span className="font-bold text-sm text-gray-800 uppercase tracking-wide">Spatial Context:</span>
          
          <label className="text-sm font-semibold flex items-center gap-2">
            Slide:
            <select className="border border-gray-400 rounded px-2 py-1 bg-white font-normal outline-none" value={selectedSlide} onChange={handleSlideChange}>
              <option value="__ALL__">All Slides</option>
              {availableSlides.filter(s => s !== "__ALL__").map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>

          <label className="text-sm font-semibold flex items-center gap-2">
            Sample:
            <select 
              className="border border-gray-400 rounded px-2 py-1 bg-white font-normal outline-none disabled:bg-gray-100 disabled:text-gray-400"
              value={selectedSample} onChange={(e) => setSelectedSample(e.target.value)} disabled={availableSamples.length <= 1}
            >
              <option value="__ALL__">-- Select a Sample --</option>
              {availableSamples.filter(s => s !== "__ALL__").map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>

          <div className="ml-auto flex items-center gap-6">
            {/* NEW: Point Size Slider */}
            <label className="flex flex-col text-xs font-semibold text-gray-600">
              Point Size: {pointSize}
              <input 
                type="range" 
                min="0.5" 
                max="15" 
                step="0.5" 
                value={pointSize} 
                onChange={e => setPointSize(Number(e.target.value))} 
                className="cursor-pointer mt-1"
              />
            </label>

            <label className="flex items-center gap-2 text-sm font-semibold text-gray-600 cursor-pointer">
              <input type="checkbox" checked={showBackground} onChange={e => setShowBackground(e.target.checked)} className="cursor-pointer" />
              Show Background Cells
            </label>
          </div>
        </div>

        {/* BOTTOM ROW: Gene & Color Controls */}
        <div className="flex flex-wrap gap-8 items-center">
          
          {/* Gene 1 Controls */}
          <div className="flex flex-col gap-2 flex-1 min-w-[250px] bg-gray-50 p-3 border border-gray-200 rounded">
            <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Channel 1</h3>
            <div className="flex gap-2">
              
              {/* NEW CUSTOM DROPDOWN */}
              <SearchableSelect 
                options={genes} 
                value={gene1} 
                onChange={setGene1} 
                placeholder="Search Channel 1..." 
              />

              <select className="border p-1 rounded outline-none text-sm font-semibold" style={{ color: color1.toLowerCase() }} value={color1} onChange={e => setColor1(e.target.value)}>
                {Object.keys(CHANNEL_COLORS).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <label className="text-xs text-gray-600 flex flex-col mt-1">
              Max Intensity Threshold: {maxThresh1}
              <input type="range" min="0.1" max="20" step="0.1" value={maxThresh1} onChange={e => setMaxThresh1(Number(e.target.value))} />
            </label>
          </div>

          {/* Gene 2 Controls */}
          <div className="flex flex-col gap-2 flex-1 min-w-[250px] bg-gray-50 p-3 border border-gray-200 rounded">
            <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Channel 2</h3>
            <div className="flex gap-2">
              
              {/* NEW CUSTOM DROPDOWN */}
              <SearchableSelect 
                options={genes} 
                value={gene2} 
                onChange={setGene2} 
                placeholder="Search Channel 2..." 
              />

              <select className="border p-1 rounded outline-none text-sm font-semibold" style={{ color: color2.toLowerCase() }} value={color2} onChange={e => setColor2(e.target.value)}>
                {Object.keys(CHANNEL_COLORS).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <label className="text-xs text-gray-600 flex flex-col mt-1">
              Max Intensity Threshold: {maxThresh2}
              <input type="range" min="0.1" max="20" step="0.1" value={maxThresh2} onChange={e => setMaxThresh2(Number(e.target.value))} />
            </label>
          </div>
        </div>

      </div>

      {/* Plot Area */}
      <div className="flex-1 bg-black border shadow-sm rounded overflow-hidden relative">
        {selectedSample === "__ALL__" ? (
           <div className="flex items-center justify-center h-full text-gray-400 bg-gray-100">
             <p className="p-6 text-center">
               <span className="text-2xl block mb-2">⚠️</span>
               Multiplex Overlay requires a specific sample to prevent coordinate overlap.<br/> 
               Please select a specific <b>Sample</b> from the dropdown above.
             </p>
           </div>
        ) : plotData ? (
          <Plot
            data={plotData}
            layout={{
              autosize: true,
              margin: { l: 0, r: 0, t: 0, b: 0 },
              paper_bgcolor: 'black',
              plot_bgcolor: 'black',
              xaxis: { showgrid: false, zeroline: false, visible: false },
              yaxis: { showgrid: false, zeroline: false, visible: false, scaleanchor: 'x', autorange: 'reversed' },
              uirevision: selectedSample 
            }}
            useResizeHandler={true}
            style={{ width: "100%", height: "100%" }}
          />
        ) : (
          <div className="text-white p-6">No data to display. Ensure genes are selected.</div>
        )}
      </div>
    </div>
  );
}