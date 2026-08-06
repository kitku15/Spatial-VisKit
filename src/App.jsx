import React, { useState, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  NavLink,
  Navigate,
} from "react-router-dom";
import { ZARR_DIR, PROJECT_TITLE, DATA_DIR} from "./config";
import VitessceViewer from "./VitessceViewer";
import CellTypeAnnotation from "./CellTypeAnnotation";
import CellCellCommunication from "./CellCellCommunication";
import TranscriptionFactor from "./TranscriptionFactor";
import SpatialStats from "./SpatialStats";
import QualityControl from "./QualityControl";
import MultiplexGeneOverlay from "./MultiplexGeneOverlay";
import DEAnalysis from "./DEAnalysis";
import ConditionsDE from "./ConditionsDE";
import SpatialCCC from "./SpatialCCC";
import ConditionsCausal from "./ConditionsCausal";
import CompositionAnalysis from "./CompositionAnalysis";
import ColorSettings from "./ColorSettings";

// --- MAIN LAYOUT COMPONENT ---
// We now pass our state and functions into the layout as props
// Add availableN and availableR to the incoming props
const Layout = ({
  children,
  availableN,
  availableR,
  availableEmbeddings,
  selectedN,
  setSelectedN,
  selectedR,
  selectedEmbedding,
  setSelectedEmbedding,
  setSelectedR,
  handleRefresh,
  sidebarOpen,
  setSidebarOpen,
}) => {
  // Using our new semantic variables
  const activeClass = "bg-selpanel text-textInverse font-semibold px-4 py-3";
  const inactiveClass =
    "bg-panel text-textMuted font-semibold px-4 py-3 border-r border-borderLight hover:bg-primary-light hover:text-primary-dark";

  useEffect(() => {
    const timer = setTimeout(() => {
      window.dispatchEvent(new Event("resize"));
    }, 250);
    return () => clearTimeout(timer);
  }, [sidebarOpen]);

  return (
    <div className="flex flex-col h-screen bg-app">
      {/* Header */}
      <header className="bg-header text-3xl p-3 flex items-center gap-4 text-textInverse font-semibold">
        <button
          onClick={() => setSidebarOpen((prev) => !prev)}
          className="text-2xl flex items-center justify-center w-10 h-10 rounded hover:bg-primary transition-colors focus:outline-none cursor-pointer"
          title="Toggle Settings Sidebar"
        >
          ☰
        </button>
        <span>{PROJECT_TITLE}</span>
      </header>

      {/* Navigation */}
      <nav className="flex border-b border-borderMain bg-panel shadow-sm">
        <NavLink
          to="/colors"
          className={({ isActive }) => (isActive ? activeClass : inactiveClass)}
        >
          Color Settings
        </NavLink>
        <NavLink
          to="/qc"
          className={({ isActive }) => (isActive ? activeClass : inactiveClass)}
        >
          Quality Control
        </NavLink>
        <NavLink
          to="/interactive"
          className={({ isActive }) => (isActive ? activeClass : inactiveClass)}
        >
          Interactive Explorer
        </NavLink>
        <NavLink
          to="/composition"
          className={({ isActive }) => (isActive ? activeClass : inactiveClass)}
        >
          Composition Analysis
        </NavLink>
        <NavLink
          to="/multiplex"
          className={({ isActive }) => (isActive ? activeClass : inactiveClass)}
        >
          Multiplex Overlay
        </NavLink>
        <NavLink
          to="/stats"
          className={({ isActive }) => (isActive ? activeClass : inactiveClass)}
        >
          Spatial Stats
        </NavLink>
        <NavLink
          to="/tf"
          className={({ isActive }) => (isActive ? activeClass : inactiveClass)}
        >
          Transcription Factor Analysis
        </NavLink>
        <NavLink
          to="/ccc"
          className={({ isActive }) => (isActive ? activeClass : inactiveClass)}
        >
          Cell Cell Communication
        </NavLink>
        <NavLink
          to="/spatial-ccc"
          className={({ isActive }) => (isActive ? activeClass : inactiveClass)}
        >
          Spatial CCC (LIANA)
        </NavLink>
        <NavLink
          to="/de-analysis"
          className={({ isActive }) => (isActive ? activeClass : inactiveClass)}
        >
          Cell Type DE Analysis
        </NavLink>
        <NavLink
          to="/conditions-de"
          className={({ isActive }) => (isActive ? activeClass : inactiveClass)}
        >
          Conditions DE Analysis
        </NavLink>
        <NavLink
          to="/annotation"
          className={({ isActive }) => (isActive ? activeClass : inactiveClass)}
        >
          Cell Type Annotation
        </NavLink>
        <NavLink
          to="/conditions-causal"
          className={({ isActive }) => (isActive ? activeClass : inactiveClass)}
        >
          Condition Signaling (Causal)
        </NavLink>
      </nav>

      <main className="flex-1 overflow-auto flex">
        {/* Sidebar */}
        <aside
          className={`bg-sidebar border-r border-borderMain flex flex-col transition-all duration-200 ${
            sidebarOpen ? "w-64" : "w-0 overflow-hidden"
          }`}
        >
          <div className="p-4 bg-borderLight flex justify-center border-b border-borderMain">
            <img
              src="/logo_hor.svg"
              alt="Project Logo"
              className="h-10 w-auto"
            />
          </div>
          <div className="p-4 border-b border-borderMain flex justify-center gap-2">
            <button
              onClick={handleRefresh}
              className="bg-success-light text-success-dark border border-success px-4 py-1 text-sm font-semibold rounded shadow-sm hover:bg-success hover:text-textInverse transition-colors"
            >
              Refresh plot
            </button>
            <button className="bg-danger-light text-danger-dark border border-danger px-4 py-1 text-sm font-semibold rounded shadow-sm hover:bg-danger hover:text-textInverse transition-colors">
              Clear Filters
            </button>
          </div>

          <div className="p-4 overflow-y-auto">
            <details className="mb-4" open>
              <summary className="font-bold text-textMain cursor-pointer outline-none border-b border-borderMain pb-1 mb-2">
                Settings
              </summary>
              <div className="ml-2">
                <details className="mb-3" open>
                  <summary className="text-sm font-semibold text-textMuted cursor-pointer outline-none">
                    Neighbours (n)
                  </summary>
                  <div className="ml-4 mt-1 space-y-1 bg-borderLight p-2 rounded border border-borderMain">
                    {availableN.length === 0 && (
                      <span className="text-xs text-textMuted">
                        Scanning...
                      </span>
                    )}
                    {availableN.map((val) => (
                      <label
                        key={val}
                        className="block text-sm text-textMain cursor-pointer"
                      >
                        <input
                          type="radio"
                          name="n_val"
                          value={val}
                          checked={selectedN === String(val)}
                          onChange={(e) => setSelectedN(e.target.value)}
                          className="mr-2 accent-primary"
                        />
                        {val}
                      </label>
                    ))}
                  </div>
                </details>

                <details className="mb-3" open>
                  <summary className="text-sm font-semibold text-textMuted cursor-pointer outline-none">
                    UMAP Embedding
                  </summary>
                  <div className="ml-4 mt-1 space-y-1 bg-borderLight p-2 rounded border border-borderMain">
                    {availableEmbeddings.length === 0 && (
                      <span className="text-xs text-textMuted">Scanning...</span>
                    )}
                    {availableEmbeddings.map((val) => (
                      <label key={val} className="block text-sm text-textMain cursor-pointer">
                        <input
                          type="radio"
                          name="embedding_val"
                          value={val}
                          checked={selectedEmbedding === val}
                          onChange={(e) => setSelectedEmbedding(e.target.value)}
                          className="mr-2 accent-primary"
                        />
                        {val}
                      </label>
                    ))}
                  </div>
                </details>

                <details className="mb-3" open>
                  <summary className="text-sm font-semibold text-textMuted cursor-pointer outline-none">
                    Resolution (r)
                  </summary>
                  <div className="ml-4 mt-1 space-y-1 bg-borderLight p-2 rounded border border-borderMain">
                    {availableR.length === 0 && (
                      <span className="text-xs text-textMuted">
                        Scanning...
                      </span>
                    )}
                    {availableR.map((val) => (
                      <label
                        key={val}
                        className="block text-sm text-textMain cursor-pointer"
                      >
                        <input
                          type="radio"
                          name="r_val"
                          value={val}
                          checked={selectedR === String(val)}
                          onChange={(e) => setSelectedR(e.target.value)}
                          className="mr-2 accent-primary"
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

        <div className="flex-1 bg-app">{children}</div>
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

  const [availableEmbeddings, setAvailableEmbeddings] = useState([]);
  const [selectedEmbedding, setSelectedEmbedding] = useState("");

  // 3. "Applied" state (Only updates when "Refresh plot" is clicked)
  const [appliedN, setAppliedN] = useState("");
  const [appliedR, setAppliedR] = useState("");
  const [appliedEmbedding, setAppliedEmbedding] = useState("");

  // 4. For Cell Type Annotation page
  const [allColumns, setAllColumns] = useState([]);

  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Initialize state from Local Storage (if it exists)
  const [customColors, setCustomColors] = useState(() => {
    const savedColors = localStorage.getItem("app_custom_colors");
    if (savedColors) {
      try {
        return JSON.parse(savedColors);
      } catch (e) {
        console.warn("Failed to parse colors from local storage", e);
      }
    }
    return {};
  });

  // Whenever customColors changes, save it to Local Storage
  useEffect(() => {
    localStorage.setItem("app_custom_colors", JSON.stringify(customColors));
  }, [customColors]);

  // 4. Read the Zarr file on load to detect what's available!
  useEffect(() => {
    async function fetchZarrMetadata() {
      try {
        // 1. Fetch column names to determine available N and R values
        const response = await fetch(`/${ZARR_DIR}/obs/.zattrs`);
        const data = await response.json();

        const columns = data["column-order"] || [];
        setAllColumns(columns);

        const ns = new Set();
        const rs = new Set();

        columns.forEach((col) => {
          const match = col.match(/leiden_n(\d+)_r([\d.]+)/);
          if (match) {
            ns.add(match[1]);
            rs.add(match[2]);
          }
        });

        const nList = Array.from(ns).sort((a, b) => Number(a) - Number(b));
        const rList = Array.from(rs).sort((a, b) => Number(a) - Number(b));

        setAvailableN(nList);
        setAvailableR(rList);

        if (nList.length > 0) {
          setSelectedN(nList[0]);
          setAppliedN(nList[0]);
        }
        if (rList.length > 0) {
          setSelectedR(rList[0]);
          setAppliedR(rList[0]);
        }

        // 2. Scan for available UMAP/PCA Embeddings
        let eList = [];

        // Attempt A: Try to read from consolidated metadata (if it exists)
        try {
          const zmetaRes = await fetch(`/${ZARR_DIR}/.zmetadata`);
          if (zmetaRes.ok) {
            const zmeta = await zmetaRes.json();
            const eKeys = new Set();
            Object.keys(zmeta.metadata || {}).forEach((k) => {
              if (k.startsWith("obsm/")) {
                const embName = k.split("/")[1];
                // Ignore zarr internal files like .zgroup or .zattrs
                if (embName && !embName.startsWith(".")) {
                  eKeys.add(embName);
                }
              }
            });
            eList = Array.from(eKeys).sort();
          }
        } catch (e) {
          console.warn("Could not load .zmetadata, trying fallback probe...");
        }

        // Attempt B: Probing Fallback (If .zmetadata doesn't exist)
        // We know the pattern from your image is X_umap_n{N}_X_pca
        if (eList.length === 0) {
          const potentialEmbeddings = ["X_umap"];
          nList.forEach((n) => {
            potentialEmbeddings.push(`X_umap_n${n}_X_pca`);
            potentialEmbeddings.push(`X_umap_n${n}`); // Added just in case
          });

          // Fire off tiny requests to see which ones actually exist in the Zarr
          const checks = await Promise.all(
            potentialEmbeddings.map(async (emb) => {
              try {
                const res = await fetch(`/${ZARR_DIR}/obsm/${emb}/.zarray`, { method: "HEAD" });
                return res.ok ? emb : null;
              } catch {
                return null;
              }
            })
          );

          // Filter out the ones that failed
          eList = checks.filter(Boolean);
        }

        // Absolute fallback if everything fails
        if (eList.length === 0) eList = ["X_umap"];

        // Eliminate any potential duplicates and set state
        const uniqueElist = Array.from(new Set(eList));
        
        setAvailableEmbeddings(uniqueElist);
        setAppliedEmbedding(uniqueElist[0]);
        setSelectedEmbedding(uniqueElist[0]);

      } catch (error) {
        console.error(
          "Failed to fetch Zarr metadata. Is the server running?",
          error,
        );
      }
    }

    fetchZarrMetadata();
  }, []);

  const handleRefresh = () => {
    setAppliedN(selectedN);
    setAppliedR(selectedR);
    setAppliedEmbedding(selectedEmbedding);
  };

  // Prevent loading Vitessce until we actually know what N and R to ask for
  // const isReady = appliedN !== "" && appliedR !== "";
  const isReady = appliedN !== "" && appliedR !== "" && appliedEmbedding !== "";

  return (
    <Router>
      <Layout
        availableN={availableN}
        availableR={availableR}
        availableEmbeddings={availableEmbeddings}
        selectedN={selectedN}
        setSelectedN={setSelectedN}
        selectedR={selectedR}
        setSelectedR={setSelectedR}
        selectedEmbedding={selectedEmbedding}
        setSelectedEmbedding={setSelectedEmbedding}
        handleRefresh={handleRefresh}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
      >
        <Routes>
          <Route path="/colors" element={<ColorSettings customColors={customColors} setCustomColors={setCustomColors} />} />
          <Route path="/" element={<Navigate to="/qc" />} />
          <Route path="/qc" element={<QualityControl />} />
          <Route
            path="/interactive"
            element={
              isReady ? (
                <VitessceViewer n={appliedN} r={appliedR} embedding={appliedEmbedding} customColors={customColors} />
              ) : (
                <div className="p-6">Loading data from Zarr...</div>
              )
            }
          />
          <Route path="/composition" element={<CompositionAnalysis customColors={customColors} />} />
          <Route path="/multiplex" element={<MultiplexGeneOverlay />} />
          <Route
            path="/stats"
            element={
              isReady ? (
                <SpatialStats n={appliedN} r={appliedR} embedding={appliedEmbedding} customColors={customColors} />
              ) : (
                <div className="p-6">Loading data from Zarr...</div>
              )
            }
          />
          <Route
            path="/tf"
            element={
              isReady ? (
                // <TranscriptionFactor n={appliedN} r={appliedR} />
                <TranscriptionFactor n={appliedN} r={appliedR} embedding={appliedEmbedding} />
              ) : (
                <div className="p-6">Loading data from Zarr...</div>
              )
            }
          />
          <Route
            path="/ccc"
            element={
              isReady ? (
                <CellCellCommunication n={appliedN} r={appliedR} />
              ) : (
                <div className="p-6">Loading data from Zarr...</div>
              )
            }
          />
          <Route
            path="/spatial-ccc"
            element={
              isReady ? (
                <SpatialCCC n={appliedN} />
              ) : (
                <div className="p-6">Loading data from Zarr...</div>
              )
            }
          />
          <Route
            path="/annotation"
            element={<CellTypeAnnotation availableColumns={allColumns} />}
          />
          <Route path="/de-analysis" element={<DEAnalysis customColors={customColors} />} />
          <Route path="/conditions-de" element={<ConditionsDE />} />
          <Route
            path="/conditions-causal"
            element={<ConditionsCausal />}
          />
        </Routes>
      </Layout>
    </Router>
  );
}
