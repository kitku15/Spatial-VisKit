import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import VitessceViewer from './VitessceViewer';
import CellTypeAnnotation from './CellTypeAnnotation';
import CellCellCommunication from './CellCellCommunication';

// --- PAGE COMPONENTS ---

// 1. Quality Control Page (Showing your static matplotlib plots)
const QualityControl = () => (
  <div className="p-6">
    <div className="flex gap-4 mb-4">
      <button className="bg-green-200 border border-black px-4 py-1 text-sm">Refresh plot</button>
      <button className="bg-red-200 border border-black px-4 py-1 text-sm">Clear Filters</button>
    </div>
    <div className="bg-white p-4 border shadow-sm">
      <h2 className="text-lg font-bold mb-4">Pipeline QC Metrics</h2>
      {/* This image points to the public/data folder where users will unzip their files */}
      <img src="/data/cell_summary_histograms.png" alt="QC Histograms" className="max-w-full h-auto" />
    </div>
  </div>
);

// 2. Spatial Stats Page
const SpatialStats = () => (
  <div className="p-6 grid grid-cols-2 gap-4">
    <div className="bg-white p-4 border flex flex-col items-center justify-center h-64">
      <h2 className="text-xl font-bold bg-gray-200 px-4 py-2 rounded mb-2 absolute opacity-80">Centrality Scores</h2>
      <img src="/data/centrality_scores.png" alt="Centrality Scores" className="max-h-full" />
    </div>
    <div className="bg-white p-4 border flex flex-col items-center justify-center h-64">
      <h2 className="text-xl font-bold bg-gray-200 px-4 py-2 rounded mb-2 absolute opacity-80">Co-occurrence</h2>
      <img src="/data/co_occurrence.png" alt="Co-occurrence" className="max-h-full" />
    </div>
  </div>
);



// --- MAIN LAYOUT COMPONENT ---
// We now pass our state and functions into the layout as props
// Add availableN and availableR to the incoming props
const Layout = ({ children, availableN, availableR, selectedN, setSelectedN, selectedR, setSelectedR, handleRefresh }) => {
  const activeClass = "bg-gray-500 text-white font-semibold px-4 py-3";
  const inactiveClass = "bg-white text-black font-semibold px-4 py-3 border-r border-gray-300 hover:bg-gray-100";

  return (
    <div className="flex flex-col h-screen">
      {/* ... (keep your header and nav the same as before) ... */}
      <header className="bg-gray-400 text-3xl p-4 flex justify-between items-center text-white font-semibold">
        <span>CosMx NanoString: Tyler Slide 1</span>
        <span className="text-xl cursor-pointer">⚙️</span>
      </header>

      <nav className="flex border-b border-gray-400 bg-white shadow-sm">
        <NavLink to="/qc" className={({ isActive }) => isActive ? activeClass : inactiveClass}>Quality Control</NavLink>
        <NavLink to="/interactive" className={({ isActive }) => isActive ? activeClass : inactiveClass}>Interactive Explorer (Vitessce)</NavLink>
        <NavLink to="/stats" className={({ isActive }) => isActive ? activeClass : inactiveClass}>Spatial Stats</NavLink>
        <NavLink to="/tf" className={({ isActive }) => isActive ? activeClass : inactiveClass}>Transcription Factor Analysis</NavLink>
        <NavLink to="/ccc" className={({ isActive }) => isActive ? activeClass : inactiveClass}>Cell Cell Communication</NavLink>
        <NavLink to="/annotation" className={({ isActive }) => isActive ? activeClass : inactiveClass}>Cell Type Annotation</NavLink>
      </nav>

      <main className="flex-1 overflow-auto flex">
        <aside className="w-64 bg-gray-300 border-r border-gray-400 flex flex-col">
          <div className="p-4 border-b border-gray-400 flex justify-center gap-2">
            <button onClick={handleRefresh} className="bg-green-200 border border-black px-4 py-1 text-sm font-semibold rounded shadow-sm hover:bg-green-300">Refresh plot</button>
            <button className="bg-red-200 border border-black px-4 py-1 text-sm font-semibold rounded shadow-sm hover:bg-red-300">Clear Filters</button>
          </div>

          <div className="p-4 overflow-y-auto">
            <details className="mb-4" open>
              <summary className="font-bold cursor-pointer outline-none border-b border-gray-400 pb-1 mb-2">Settings</summary>
              <div className="ml-2">
                
                {/* DYNAMIC Neighbours Dropdown */}
                <details className="mb-3" open>
                  <summary className="text-sm font-semibold text-gray-700 cursor-pointer outline-none">Neighbours (n)</summary>
                  <div className="ml-4 mt-1 space-y-1 bg-gray-200 p-2 rounded border border-gray-300">
                    {availableN.length === 0 && <span className="text-xs text-gray-500">Scanning...</span>}
                    {availableN.map(val => (
                      <label key={val} className="block text-sm cursor-pointer">
                        <input 
                          type="radio" name="n_val" value={val} 
                          checked={selectedN === String(val)} 
                          onChange={(e) => setSelectedN(e.target.value)} 
                          className="mr-2"
                        /> 
                        {val}
                      </label>
                    ))}
                  </div>
                </details>

                {/* DYNAMIC Resolution Dropdown */}
                <details className="mb-3" open>
                  <summary className="text-sm font-semibold text-gray-700 cursor-pointer outline-none">Resolution (r)</summary>
                  <div className="ml-4 mt-1 space-y-1 bg-gray-200 p-2 rounded border border-gray-300">
                    {availableR.length === 0 && <span className="text-xs text-gray-500">Scanning...</span>}
                    {availableR.map(val => (
                      <label key={val} className="block text-sm cursor-pointer">
                        <input 
                          type="radio" name="r_val" value={val} 
                          checked={selectedR === String(val)} 
                          onChange={(e) => setSelectedR(e.target.value)} 
                          className="mr-2"
                        /> 
                        {val}
                      </label>
                    ))}
                  </div>
                </details>

              </div>
            </details>
          </div>
        </aside>

        <div className="flex-1 bg-gray-100">
          {children}
        </div>
      </main>
    </div>
  );
};

export default function App() {
  // 1. Available options state (Populated dynamically from Zarr)
  const [availableN, setAvailableN] = useState([]);
  const [availableR, setAvailableR] = useState([]);

  // 2. "Draft" state (Updates instantly when clicking radio buttons)
  const [selectedN, setSelectedN] = useState("");
  const [selectedR, setSelectedR] = useState("");

  // 3. "Applied" state (Only updates when "Refresh plot" is clicked)
  const [appliedN, setAppliedN] = useState("");
  const [appliedR, setAppliedR] = useState("");

  // 4. For Cell Type Annotation page
  const [allColumns, setAllColumns] = useState([]);

  // 4. Read the Zarr file on load to detect what's available!
  useEffect(() => {
    async function fetchZarrMetadata() {
      try {
        // Zarr stores AnnData column names in the obs/.zattrs file
        const response = await fetch("data/adata_tyler.zarr/obs/.zattrs");
        const data = await response.json();
        
        // Scanpy saves the column names in "column-order"
        const columns = data["column-order"] || [];
        setAllColumns(columns); // save the full list
        
        const ns = new Set();
        const rs = new Set();
        
        // Loop through columns and find ones that match leiden_nX_rY
        columns.forEach(col => {
          const match = col.match(/leiden_n(\d+)_r([\d.]+)/);
          if (match) {
            ns.add(match[1]); // Grab the n value
            rs.add(match[2]); // Grab the r value
          }
        });
        
        // Convert Sets to sorted arrays so the sidebar buttons are in order!
        const nList = Array.from(ns).sort((a, b) => Number(a) - Number(b));
        const rList = Array.from(rs).sort((a, b) => Number(a) - Number(b));
        
        setAvailableN(nList);
        setAvailableR(rList);
        
        // Automatically set the default selected values to the first items found
        if (nList.length > 0) {
          setSelectedN(nList[0]);
          setAppliedN(nList[0]);
        }
        if (rList.length > 0) {
          setSelectedR(rList[0]);
          setAppliedR(rList[0]);
        }
        
      } catch (error) {
        console.error("Failed to fetch Zarr metadata. Is the server running?", error);
      }
    }
    
    fetchZarrMetadata();
  }, []); // The empty bracket means this runs exactly once when the app opens

  const handleRefresh = () => {
    setAppliedN(selectedN);
    setAppliedR(selectedR);
  };

  // Prevent loading Vitessce until we actually know what N and R to ask for
  const isReady = appliedN !== "" && appliedR !== "";

  return (
    <Router>
      <Layout 
        availableN={availableN} availableR={availableR}
        selectedN={selectedN} setSelectedN={setSelectedN}
        selectedR={selectedR} setSelectedR={setSelectedR}
        handleRefresh={handleRefresh}
      >
        <Routes>
          <Route path="/" element={<Navigate to="/qc" />} />
          <Route path="/qc" element={<QualityControl />} />
          
          {/* Only render Vitessce once we have detected the available columns */}
          <Route path="/interactive" element={isReady ? <VitessceViewer n={appliedN} r={appliedR} /> : <div className="p-6">Loading data from Zarr...</div>} />
          
          <Route path="/stats" element={<SpatialStats />} />
          <Route path="/tf" element={<div className="p-6">TF Data Goes Here...</div>} />
          <Route path="/ccc" element={<CellCellCommunication />} />

          <Route path="/annotation" element={<CellTypeAnnotation availableColumns={allColumns} />} />
        </Routes>
      </Layout>
    </Router>
  );
}