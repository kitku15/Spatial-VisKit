import React, { useState, useEffect, useMemo, useRef } from 'react';
import Plotly from 'plotly.js-dist-min';
import factory from 'react-plotly.js/factory';
import { ANALYSIS_NAME, channelColorMap, defaultChannelColorNames } from './config';
import InfoModal from './InfoModal';
import { tabInfo } from './infoHelper';

const createPlotlyComponent = typeof factory === 'function' ? factory : factory.default;
const Plot = createPlotlyComponent(Plotly);

function SearchableSelect({ options, value, onChange, placeholder }) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const wrapperRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = options.filter(opt =>
    opt.original.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div ref={wrapperRef} className="relative flex-1 min-w-0">
      <div 
        className="border border-borderMain bg-panel p-1 rounded flex items-center justify-between cursor-text"
        onClick={() => setIsOpen(true)}
      >
        <input
          type="text"
          className="outline-none flex-1 w-full text-sm px-1 bg-transparent truncate text-textMain"
          placeholder={value ? value.original : placeholder}
          value={isOpen ? search : (value ? value.original : "")}
          onChange={(e) => { setSearch(e.target.value); setIsOpen(true); }}
        />
        <button 
          className="text-textMuted px-2 cursor-pointer hover:text-textMain flex-shrink-0"
          onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
        >
          ▼
        </button>
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-panel border border-borderMain rounded shadow-lg max-h-48 overflow-y-auto">
          {filteredOptions.length > 0 ? (
            filteredOptions.map((opt) => (
              <div
                key={opt.safe}
                className="p-2 text-sm text-textMain hover:bg-primary-light cursor-pointer"
                onClick={() => { onChange(opt); setSearch(""); setIsOpen(false); }}
              >
                {opt.original}
              </div>
            ))
          ) : (
            <div className="p-2 text-sm text-textMuted italic">No genes found</div>
          )}
        </div>
      )}
    </div>
  );
}

export default function MultiplexGeneOverlay() {
  const [hierarchy, setHierarchy] = useState({});
  const [availableSlides, setAvailableSlides] = useState(["__ALL__"]);
  const [availableSamples, setAvailableSamples] = useState(["__ALL__"]);
  const [selectedSlide, setSelectedSlide] = useState("__ALL__");
  const [selectedSample, setSelectedSample] = useState("__ALL__");

  const [genes, setGenes] = useState([]);
  const [locData, setLocData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const [channels, setChannels] = useState([]);
  const [exprData, setExprData] = useState({});

  const [pointSize, setPointSize] = useState(4);
  const [showBackground, setShowBackground] = useState(true);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const [metaRes, geneRes, locRes] = await Promise.all([
          fetch(`data/spatial_metadata_${ANALYSIS_NAME}.json`).catch(() => null),
          fetch('data/genes_list.json'),
          fetch('data/locations_optimized.json')
        ]);

        const metaData = metaRes ? await metaRes.json() : {"All": ["All"]};
        const geneList = await geneRes.json();
        const locations = await locRes.json();
        
        setHierarchy(metaData);
        const slides = Object.keys(metaData);
        setAvailableSlides(["__ALL__", ...slides]);

        if (slides.length === 1) setSelectedSlide(slides[0]);

        setGenes(geneList);
        
        if (geneList.length >= 2) {
          setChannels([
            { id: 1, gene: geneList[0], color: defaultChannelColorNames[0], thresh: 5 },
            { id: 2, gene: geneList[1], color: defaultChannelColorNames[1], thresh: 5 }
          ]);
        }
        
        setLocData(locations);
      } catch (err) {
        console.error("Failed to load base multiplex data:", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  useEffect(() => {
    if (Object.keys(hierarchy).length === 0) return;
    let samps = [];
    if (selectedSlide === "__ALL__") {
      samps = Array.from(new Set(Object.values(hierarchy).flat()));
    } else {
      samps = hierarchy[selectedSlide] || [];
    }
    setAvailableSamples(["__ALL__", ...samps]);
    if (samps.length === 1) setSelectedSample(samps[0]);
  }, [selectedSlide, hierarchy]);

  const handleSlideChange = (e) => {
    setSelectedSlide(e.target.value);
    setSelectedSample("__ALL__"); 
  };

  useEffect(() => {
    channels.forEach(ch => {
      if (ch.gene && !exprData[ch.gene.safe]) {
        setExprData(prev => ({ ...prev, [ch.gene.safe]: { loading: true } }));
        fetch(`data/genes/${ch.gene.safe}.json`)
          .then(r => r.json())
          .then(data => setExprData(prev => ({ ...prev, [ch.gene.safe]: data })))
          .catch(err => console.error(`Failed to load gene: ${ch.gene.safe}`, err));
      }
    });
  }, [channels, exprData]);

  const updateChannel = (id, field, value) => {
    setChannels(prev => prev.map(ch => ch.id === id ? { ...ch, [field]: value } : ch));
  };

  const removeChannel = (id) => {
    setChannels(prev => prev.filter(ch => ch.id !== id));
  };

  const addChannel = () => {
    if (channels.length >= 5) return;
    const usedColors = channels.map(c => c.color);
    const availColors = defaultChannelColorNames.filter(c => !usedColors.includes(c));
    const nextColor = availColors.length > 0 ? availColors[0] : defaultChannelColorNames[0];

    setChannels(prev => [...prev, { id: Date.now(), gene: null, color: nextColor, thresh: 5 }]);
  };

  const plotData = useMemo(() => {
    if (!locData || !locData.x || selectedSample === "__ALL__") return null;

    const activeChannels = channels.filter(ch => ch.gene && exprData[ch.gene.safe] && exprData[ch.gene.safe].i);
    if (activeChannels.length === 0) return null;

    const channelSpecs = activeChannels.map(ch => {
      const dense = new Float32Array(locData.x.length);
      const expr = exprData[ch.gene.safe];
      expr.i.forEach((idx, i) => dense[idx] = expr.v[i]);
      return { dense, rgb: channelColorMap[ch.color] || [255, 255, 255], thresh: ch.thresh, name: ch.gene.original };
    });

    const xCoords = [];
    const yCoords = [];
    const colors = [];
    const hoverTexts = [];

    for (let i = 0; i < locData.x.length; i++) {
      let cellSample = (locData.sample && locData.sample[i] != null) ? String(locData.sample[i]) : "All";
      let cellSlide = (locData.slide && locData.slide[i] != null) ? String(locData.slide[i]) : "All";
      
      if (cellSample === "All" && cellSlide !== "All") cellSample = cellSlide; 
      if (cellSample !== String(selectedSample)) continue;

      let r = 0, g = 0, b = 0;
      let isExpressed = false;
      let hoverStr = `${locData.id ? locData.id[i] : i}`;

      for (const spec of channelSpecs) {
        const v = spec.dense[i];
        if (v > 0) {
          isExpressed = true;
          const norm = Math.min(v / spec.thresh, 1.0);
          r += norm * spec.rgb[0];
          g += norm * spec.rgb[1];
          b += norm * spec.rgb[2];
        }
        hoverStr += `<br>${spec.name}: ${v.toFixed(2)}`;
      }

      if (!isExpressed) {
        if (!showBackground) continue; 
        xCoords.push(locData.x[i]);
        yCoords.push(locData.y[i]);
        colors.push('rgb(30, 30, 30)'); 
        hoverTexts.push(`${locData.id ? locData.id[i] : i}<br>No expression`);
        continue;
      }

      xCoords.push(locData.x[i]);
      yCoords.push(locData.y[i]);
      colors.push(`rgb(${Math.min(255, Math.floor(r))},${Math.min(255, Math.floor(g))},${Math.min(255, Math.floor(b))})`);
      hoverTexts.push(hoverStr);
    }

    if (xCoords.length === 0) return "EMPTY";

    return [{
      x: xCoords, y: yCoords, text: hoverTexts, mode: 'markers', type: 'scattergl', 
      hoverinfo: 'text', marker: { color: colors, size: pointSize, opacity: 0.9 }
    }];
  }, [locData, channels, exprData, selectedSample, showBackground, pointSize]); 

  if (isLoading) {
    return <div className="p-6 text-textMuted">Loading spatial coordinates and expression matrix...</div>;
  }

  return (
    <div className="p-6 flex flex-col gap-4 h-full bg-app">
      <div className="bg-panel p-4 border border-borderLight shadow-sm rounded flex flex-col gap-4 z-20">
        
        <div className="flex flex-wrap gap-6 items-center border-b border-borderLight pb-4">
          <span className="font-bold text-sm text-textMain uppercase tracking-wide">Spatial Context:</span>
          
          <label className="text-sm font-semibold flex items-center gap-2 text-textMain">
            Slide:
            <select className="border border-borderMain rounded px-2 py-1 bg-panel font-normal outline-none focus:border-primary" value={selectedSlide} onChange={handleSlideChange}>
              <option value="__ALL__">All Slides</option>
              {availableSlides.filter(s => s !== "__ALL__").map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>

          <label className="text-sm font-semibold flex items-center gap-2 text-textMain">
            Sample:
            <select 
              className="border border-borderMain rounded px-2 py-1 bg-panel font-normal outline-none disabled:opacity-50 focus:border-primary"
              value={selectedSample} onChange={(e) => setSelectedSample(e.target.value)} disabled={availableSamples.length <= 1}
            >
              <option value="__ALL__">-- Select a Sample --</option>
              {availableSamples.filter(s => s !== "__ALL__").map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>

          <div className="ml-auto flex items-center gap-6">
            <label className="flex flex-col text-xs font-semibold text-textMuted">
              Point Size: {pointSize}
              <input type="range" min="0.5" max="15" step="0.5" value={pointSize} onChange={e => setPointSize(Number(e.target.value))} className="cursor-pointer mt-1 accent-primary" />
            </label>

            <label className="flex items-center gap-2 text-sm font-semibold text-textMuted cursor-pointer hover:text-textMain">
              <input type="checkbox" checked={showBackground} onChange={e => setShowBackground(e.target.checked)} className="cursor-pointer accent-primary" />
              Show Background Cells
            </label>

            <InfoModal title={tabInfo.multiplex.title} content={tabInfo.multiplex.content} />
          </div>
        </div>

        <div className="flex flex-wrap gap-4 items-stretch">
          
          {channels.map((ch, idx) => (
            <div key={ch.id} className="flex flex-col gap-2 flex-1 min-w-[230px] max-w-[300px] bg-app p-3 border border-borderLight rounded relative shadow-sm">
              
              {channels.length > 1 && (
                <button 
                  onClick={() => removeChannel(ch.id)}
                  className="absolute top-2 right-2 text-textMuted hover:text-danger font-bold text-sm leading-none"
                  title="Remove Channel"
                >✕</button>
              )}

              <h3 className="text-xs font-bold text-textMain uppercase tracking-wide">Channel {idx + 1}</h3>
              
              <div className="flex gap-2 items-center">
                <SearchableSelect 
                  options={genes} value={ch.gene} 
                  onChange={(val) => updateChannel(ch.id, "gene", val)} 
                  placeholder="Search..." 
                />

                <select 
                  className="border border-borderMain p-1 rounded outline-none text-xs font-bold uppercase tracking-wider bg-panel" 
                  style={{ color: ch.color.toLowerCase() }} 
                  value={ch.color} 
                  onChange={e => updateChannel(ch.id, "color", e.target.value)}
                >
                  {Object.keys(channelColorMap).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <label className="text-xs text-textMuted flex flex-col mt-1">
                <span className="flex justify-between text-textMain">
                  <span>Intensity Threshold:</span>
                  <span className="font-bold">{ch.thresh}</span>
                </span>
                <input 
                  type="range" min="0.1" max="20" step="0.1" 
                  value={ch.thresh} onChange={e => updateChannel(ch.id, "thresh", Number(e.target.value))} 
                  className="accent-primary"
                />
              </label>
            </div>
          ))}

          {channels.length < 5 && (
            <button 
              onClick={addChannel}
              className="flex-1 min-w-[150px] max-w-[200px] border-2 border-dashed border-borderMain rounded flex flex-col items-center justify-center text-textMuted hover:text-primary hover:border-primary hover:bg-primary-light transition min-h-[100px]"
            >
              <span className="text-2xl font-bold leading-none mb-1">+</span>
              <span className="text-xs font-bold uppercase tracking-wide">Add Channel</span>
            </button>
          )}

        </div>
      </div>

      <div className="flex-1 bg-black border shadow-sm rounded overflow-hidden relative z-0">
        {selectedSample === "__ALL__" ? (
           <div className="flex items-center justify-center h-full text-textMuted bg-app">
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
              autosize: true, margin: { l: 0, r: 0, t: 0, b: 0 },
              paper_bgcolor: 'black', plot_bgcolor: 'black',
              xaxis: { showgrid: false, zeroline: false, visible: false },
              yaxis: { showgrid: false, zeroline: false, visible: false, scaleanchor: 'x', autorange: 'reversed' },
              uirevision: selectedSample 
            }}
            useResizeHandler={true} style={{ width: "100%", height: "100%" }}
          />
        ) : (
          <div className="text-textMuted p-6">No data to display. Ensure genes are selected.</div>
        )}
      </div>
    </div>
  );
}