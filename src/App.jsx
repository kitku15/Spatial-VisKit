import { useState, useEffect, useMemo } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  NavLink,
  Navigate,
} from "react-router-dom";
import { APP_MODE, PROJECT_TITLE, API_BASE_URL } from "./config";
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

// --- NAVIGATION CONFIGURATION ---
const exploreLinks = [
  { to: "/interactive", label: "Interactive Explorer" },
  { to: "/annotation", label: "Cell Type Annotation" },
  { to: "/composition", label: "Composition Analysis" },
  { to: "/multiplex", label: "Multiplex Overlay" },
];

const analysisLinks = [
  { to: "/qc", label: "Quality Control" },
  { to: "/stats", label: "Spatial Statistics" },
  { to: "/tf", label: "Transcription Factor Enrichment" },
  { to: "/ccc", label: "Cell-Cell Communication" },
  { to: "/spatial-ccc", label: "Spatial CCC" },
  { to: "/de-analysis", label: "Cell Type DE Analysis" },
  { to: "/conditions-de", label: "Conditions DE Analysis" },
  { to: "/conditions-causal", label: "Conditions CCC" },
];

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
  needsUpdate,
}) => {
  const isFullMode = APP_MODE === "full";

  // --- STYLING FOR SIDEBAR LINKS ---
  const navItemBase =
    "block w-full text-left px-4 py-2 text-sm transition-colors border-l-4 ";
  const activeNav =
    navItemBase + "bg-primary-light text-primary-dark border-primary font-bold";
  const inactiveNav =
    navItemBase +
    "text-textMain border-transparent hover:bg-borderLight hover:border-borderMain font-medium";
  const disabledNav =
    navItemBase +
    "text-textMuted border-transparent opacity-50 cursor-not-allowed font-medium flex justify-between items-center";

  useEffect(() => {
    const timer = setTimeout(() => {
      window.dispatchEvent(new Event("resize"));
    }, 250);
    return () => clearTimeout(timer);
  }, [sidebarOpen]);

  return (
    <div className="flex flex-col h-screen bg-app">
      {/* HEADER */}
      <header className="bg-header text-3xl p-3 flex items-center gap-4 text-textInverse font-semibold shrink-0">
        <button
          onClick={() => setSidebarOpen((prev) => !prev)}
          className="text-2xl flex items-center justify-center w-10 h-10 rounded hover:bg-primary transition-colors focus:outline-none cursor-pointer"
          title="Toggle Sidebar"
        >
          ☰
        </button>
        <span>{PROJECT_TITLE}</span>
        {!isFullMode && (
          <span className="ml-auto text-sm font-bold bg-primary px-3 py-1 rounded">
            Lite Mode
          </span>
        )}
      </header>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 overflow-hidden flex">
        {/* LEFT SIDEBAR */}
        <aside
          className={`bg-sidebar border-r border-borderMain flex flex-col transition-all duration-200 shrink-0 ${
            sidebarOpen ? "w-72" : "w-0 overflow-hidden border-none"
          }`}
        >
          {/* Logo */}
          <div className="p-4 bg-borderLight flex justify-center border-b border-borderMain shrink-0">
            <img
              src="/logo_hor.svg"
              alt="Project Logo"
              className="h-8 w-auto"
            />
          </div>

          {/* Scrollable Navigation & Settings Area */}
          <div className="flex-1 overflow-y-auto flex flex-col py-2">
            {/* Section 1: Explore */}
            <div className="mb-4">
              <h3 className="px-4 text-xs font-extrabold text-textMuted uppercase tracking-wider mb-2">
                Explore
              </h3>
              <nav className="flex flex-col">
                {exploreLinks.map((link) => (
                  <NavLink
                    key={link.to}
                    to={link.to}
                    className={({ isActive }) =>
                      isActive ? activeNav : inactiveNav
                    }
                  >
                    {link.label}
                  </NavLink>
                ))}
              </nav>
            </div>

            {/* Section 2: Analysis Outputs */}
            <div className="mb-4">
              <h3 className="px-4 text-xs font-extrabold text-textMuted uppercase tracking-wider mb-2">
                Analysis Outputs
              </h3>
              <nav className="flex flex-col">
                {analysisLinks.map((link) => {
                  // If in Lite mode, render a disabled grey div with a locked badge
                  if (!isFullMode) {
                    return (
                      <div
                        key={link.to}
                        className={disabledNav}
                        title="Requires Full Pipeline Output"
                      >
                        {link.label}
                        <span className="text-[10px] bg-borderMain text-textInverse px-1.5 py-0.5 rounded font-bold tracking-wide">
                          LOCKED
                        </span>
                      </div>
                    );
                  }
                  // Otherwise, render normally
                  return (
                    <NavLink
                      key={link.to}
                      to={link.to}
                      className={({ isActive }) =>
                        isActive ? activeNav : inactiveNav
                      }
                    >
                      {link.label}
                    </NavLink>
                  );
                })}
              </nav>
            </div>

            <div className="mx-4 border-t border-borderMain my-2"></div>

            {/* Section 3: Plot Settings */}
            <div className="p-4 pt-2">
              <h3 className="text-xs font-extrabold text-textMuted uppercase tracking-wider mb-4">
                Plot Settings
              </h3>
              <div className="flex flex-col gap-4">
                {/* Colors (Both Modes) */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-textMain">
                    Colors
                  </label>
                  <NavLink
                    to="/colors"
                    className={({ isActive }) =>
                      isActive
                        ? "bg-primary-light text-primary-dark border border-primary px-3 py-2 rounded text-sm font-bold text-center shadow-sm"
                        : "bg-panel text-textMain border border-borderMain hover:border-primary hover:text-primary px-3 py-2 rounded text-sm font-semibold text-center shadow-sm transition-colors"
                    }
                  >
                    Edit Color Palette
                  </NavLink>
                </div>

                {/* Neighbours (Only Full Mode) */}
                {isFullMode && (
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-semibold text-textMain">
                      Neighbours (n)
                    </label>
                    <div className="bg-panel border border-borderMain rounded p-2 flex flex-col gap-1 shadow-sm">
                      {availableN.length === 0 && (
                        <span className="text-xs text-textMuted">
                          Scanning...
                        </span>
                      )}
                      {availableN.map((val) => (
                        <label
                          key={val}
                          className="flex items-center text-sm text-textMain cursor-pointer hover:text-primary transition-colors"
                        >
                          <input
                            type="radio"
                            name="n_val"
                            value={val}
                            checked={selectedN === String(val)}
                            onChange={(e) => setSelectedN(e.target.value)}
                            className="mr-2 accent-primary cursor-pointer"
                          />
                          {val}
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Resolution (Only Full Mode) */}
                {isFullMode && (
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-semibold text-textMain">
                      Resolution (r)
                    </label>
                    <div className="bg-panel border border-borderMain rounded p-2 flex flex-col gap-1 shadow-sm">
                      {availableR.length === 0 && (
                        <span className="text-xs text-textMuted">
                          Scanning...
                        </span>
                      )}
                      {availableR.map((val) => (
                        <label
                          key={val}
                          className="flex items-center text-sm text-textMain cursor-pointer hover:text-primary transition-colors"
                        >
                          <input
                            type="radio"
                            name="r_val"
                            value={val}
                            checked={selectedR === String(val)}
                            onChange={(e) => setSelectedR(e.target.value)}
                            className="mr-2 accent-primary cursor-pointer"
                          />
                          {val}
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Embedding (Both Modes) */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-textMain">
                    Embedding
                  </label>
                  <div className="bg-panel border border-borderMain rounded p-2 flex flex-col gap-1 shadow-sm">
                    {availableEmbeddings.length === 0 && (
                      <span className="text-xs text-textMuted">
                        Scanning...
                      </span>
                    )}
                    {availableEmbeddings.map((val) => (
                      <label
                        key={val}
                        className="flex items-center text-sm text-textMain cursor-pointer hover:text-primary transition-colors"
                      >
                        <input
                          type="radio"
                          name="embedding_val"
                          value={val}
                          checked={selectedEmbedding === val}
                          onChange={(e) => setSelectedEmbedding(e.target.value)}
                          className="mr-2 accent-primary cursor-pointer"
                        />
                        {val}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Sticky Bottom "Update Plot" Button */}
          <div className="p-4 border-t border-borderMain bg-sidebar shrink-0 flex flex-col gap-2 relative min-h-[90px] justify-center shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-10">
            {needsUpdate && (
              <span className="text-xs text-warning-dark font-bold text-center animate-pulse">
                ⚠️ Please click to apply changes
              </span>
            )}
            <button
              onClick={handleRefresh}
              className={`w-full px-4 py-2.5 text-sm font-bold rounded shadow-sm transition-colors cursor-pointer ${
                needsUpdate
                  ? "bg-warning text-textInverse border border-warning-dark hover:bg-warning-dark shadow-md"
                  : "bg-success-light text-success-dark border border-success hover:bg-success hover:text-textInverse"
              }`}
            >
              Update Plot
            </button>
          </div>
        </aside>

        {/* TAB CONTENT */}
        <div className="flex-1 bg-app overflow-hidden">{children}</div>
      </main>
    </div>
  );
};

export default function App() {
  const [availableN, setAvailableN] = useState([]);
  const [selectedN, setSelectedN] = useState("");
  const [selectedR, setSelectedR] = useState("");
  const [selectedEmbedding, setSelectedEmbedding] = useState("");

  const [appliedN, setAppliedN] = useState("");
  const [appliedR, setAppliedR] = useState("");
  const [appliedEmbedding, setAppliedEmbedding] = useState("");

  const [allColumns, setAllColumns] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [datasetConfig, setDatasetConfig] = useState(null);

  const [clusterMap, setClusterMap] = useState({});
  const [allEmbeddings, setAllEmbeddings] = useState([]);

  const [customColors, setCustomColors] = useState(() => {
    const savedColors = localStorage.getItem("app_custom_colors");
    if (savedColors) {
      try {
        return JSON.parse(savedColors);
      } catch (e) {
        console.warn(e);
      }
    }
    return {};
  });

  useEffect(() => {
    localStorage.setItem("app_custom_colors", JSON.stringify(customColors));
  }, [customColors]);

  const availableR = useMemo(() => {
    if (APP_MODE !== "full" || Object.keys(clusterMap).length === 0) return [];
    return Array.from(clusterMap[selectedN] || []).sort(
      (a, b) => Number(a) - Number(b),
    );
  }, [selectedN, clusterMap]);

  const availableEmbeddings = useMemo(() => {
    if (APP_MODE !== "full" || allEmbeddings.length === 0) return allEmbeddings;
    return allEmbeddings.filter((val) => {
      const match = val.match(/_n(\d+)/);
      return !match || match[1] === String(selectedN);
    });
  }, [selectedN, allEmbeddings]);

  useEffect(() => {
    async function fetchZarrMetadata() {
      try {
        const response = await fetch(`${API_BASE_URL}/api/metadata.json`);
        const data = await response.json();

        setDatasetConfig(data);
        const columns = data.obs_columns || [];
        const obsmKeys = data.obsm_keys || [];
        setAllColumns(columns);

        let nList = [];
        let eList = [];
        const cMap = {};

        if (APP_MODE === "full") {
          columns.forEach((col) => {
            const match = col.match(/_n(\d+)_r([\d.]+)/);
            if (match) {
              const nVal = match[1];
              const rVal = match[2];
              if (!cMap[nVal]) cMap[nVal] = new Set();
              cMap[nVal].add(rVal);
            }
          });
          nList = Object.keys(cMap).sort((a, b) => Number(a) - Number(b));

          const actualEmbeddings = obsmKeys.filter(
            (k) => typeof k === "string" && !k.startsWith("_"),
          );
          eList = actualEmbeddings.length > 0 ? actualEmbeddings : ["X_umap"];
        } else {
          nList = [];
          const configEmbeddings =
            data.available_embeddings && data.available_embeddings.length > 0
              ? data.available_embeddings
              : [{ name: "UMAP", path: "obsm/X_umap" }];
          eList = configEmbeddings.map((e) => e.path.replace("obsm/", ""));
        }

        setClusterMap(cMap);
        setAllEmbeddings(eList);
        setAvailableN(nList);

        const initialN = nList.length > 0 ? nList[0] : "";
        setSelectedN(initialN);
        setAppliedN(initialN);

        const initialRs = Array.from(cMap[initialN] || []).sort(
          (a, b) => Number(a) - Number(b),
        );
        const initialR = initialRs.length > 0 ? String(initialRs[0]) : "";
        setSelectedR(initialR);
        setAppliedR(initialR);

        const initialEmbeddings = eList.filter((val) => {
          const match = val.match(/_n(\d+)/);
          return !match || match[1] === String(initialN);
        });
        const initialEmbedding =
          initialEmbeddings.length > 0
            ? initialEmbeddings[0]
            : eList[0] || "none";
        setSelectedEmbedding(initialEmbedding);
        setAppliedEmbedding(initialEmbedding);
      } catch (error) {
        console.error("Failed to fetch API metadata.", error);
      }
    }
    fetchZarrMetadata();
  }, []);

  const handleSelectN = (newN) => {
    setSelectedN(newN);
    if (APP_MODE !== "full") return;

    const validRs = Array.from(clusterMap[newN] || []).sort(
      (a, b) => Number(a) - Number(b),
    );
    if (
      validRs.length > 0 &&
      !validRs.map(String).includes(String(selectedR))
    ) {
      setSelectedR(String(validRs[0]));
    }

    const validEmbeddings = allEmbeddings.filter((val) => {
      const match = val.match(/_n(\d+)/);
      return !match || match[1] === String(newN);
    });
    if (
      validEmbeddings.length > 0 &&
      !validEmbeddings.includes(selectedEmbedding)
    ) {
      setSelectedEmbedding(validEmbeddings[0]);
    }
  };

  const [globalUpdateSignal, setGlobalUpdateSignal] = useState(0);
  const [hasUnappliedChildChanges, setHasUnappliedChildChanges] =
    useState(false);

  const globalChanged =
    selectedN !== appliedN ||
    selectedR !== appliedR ||
    selectedEmbedding !== appliedEmbedding;

  const needsUpdate = globalChanged || hasUnappliedChildChanges;

  const handleRefresh = () => {
    if (!needsUpdate) return;
    setAppliedN(selectedN);
    setAppliedR(selectedR);
    setAppliedEmbedding(selectedEmbedding);
    setGlobalUpdateSignal((prev) => prev + 1);
    setHasUnappliedChildChanges(false);
  };

  const isFullMode = APP_MODE === "full";
  const isReady =
    (isFullMode ? appliedN !== "" && appliedR !== "" : true) &&
    appliedEmbedding !== "" &&
    datasetConfig !== null;

  return (
    <Router>
      <Layout
        availableN={availableN}
        availableR={availableR}
        availableEmbeddings={availableEmbeddings}
        selectedN={selectedN}
        setSelectedN={handleSelectN}
        selectedR={selectedR}
        setSelectedR={setSelectedR}
        selectedEmbedding={selectedEmbedding}
        setSelectedEmbedding={setSelectedEmbedding}
        handleRefresh={handleRefresh}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        needsUpdate={needsUpdate}
      >
        <Routes>
          <Route path="/" element={<Navigate to="/interactive" />} />

          <Route
            path="/interactive"
            element={
              isReady ? (
                <VitessceViewer
                  n={appliedN}
                  r={appliedR}
                  embedding={appliedEmbedding}
                  customColors={customColors}
                  datasetConfig={datasetConfig}
                  globalUpdateSignal={globalUpdateSignal}
                  setHasUnappliedChildChanges={setHasUnappliedChildChanges}
                />
              ) : (
                <div className="p-6">Loading data from Zarr...</div>
              )
            }
          />
          <Route
            path="/annotation"
            element={
              datasetConfig ? (
                <CellTypeAnnotation
                  availableColumns={allColumns}
                  datasetConfig={datasetConfig}
                />
              ) : (
                <div className="p-6">Loading metadata...</div>
              )
            }
          />
          <Route
            path="/composition"
            element={<CompositionAnalysis customColors={customColors} />}
          />
          <Route path="/multiplex" element={<MultiplexGeneOverlay />} />
          <Route
            path="/colors"
            element={
              <ColorSettings
                customColors={customColors}
                setCustomColors={setCustomColors}
              />
            }
          />

          {isFullMode && (
            <>
              <Route path="/qc" element={<QualityControl />} />
              <Route
                path="/stats"
                element={
                  isReady ? (
                    <SpatialStats
                      n={appliedN}
                      r={appliedR}
                      customColors={customColors}
                      datasetConfig={datasetConfig}
                    />
                  ) : (
                    <div className="p-6">Loading data from Zarr...</div>
                  )
                }
              />
              <Route
                path="/tf"
                element={
                  isReady ? (
                    <TranscriptionFactor
                      n={appliedN}
                      r={appliedR}
                      embedding={appliedEmbedding}
                      customColors={customColors}
                      datasetConfig={datasetConfig}
                    />
                  ) : (
                    <div className="p-6">Loading data from Zarr...</div>
                  )
                }
              />
              <Route
                path="/ccc"
                element={
                  isReady ? (
                    <CellCellCommunication
                      n={appliedN}
                      r={appliedR}
                      datasetConfig={datasetConfig}
                      globalUpdateSignal={globalUpdateSignal}
                      setHasUnappliedChildChanges={setHasUnappliedChildChanges}
                    />
                  ) : (
                    <div className="p-6">Loading data from Zarr...</div>
                  )
                }
              />
              <Route
                path="/spatial-ccc"
                element={
                  isReady ? (
                    <SpatialCCC
                      n={appliedN}
                      r={appliedR}
                      customColors={customColors}
                      datasetConfig={datasetConfig}
                    />
                  ) : (
                    <div className="p-6">Loading data from Zarr...</div>
                  )
                }
              />
              <Route
                path="/de-analysis"
                element={<DEAnalysis customColors={customColors} />}
              />
              <Route path="/conditions-de" element={<ConditionsDE />} />
              <Route path="/conditions-causal" element={<ConditionsCausal />} />
            </>
          )}
        </Routes>
      </Layout>
    </Router>
  );
}
