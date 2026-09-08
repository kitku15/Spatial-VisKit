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
  const activeClass =
    "bg-selpanel text-textInverse font-semibold px-4 py-3 whitespace-nowrap";
  const inactiveClass =
    "bg-panel text-textMuted font-semibold px-4 py-3 border-r border-borderLight hover:bg-primary-light hover:text-primary-dark whitespace-nowrap";

  const isFullMode = APP_MODE === "full";

  useEffect(() => {
    const timer = setTimeout(() => {
      window.dispatchEvent(new Event("resize"));
    }, 250);
    return () => clearTimeout(timer);
  }, [sidebarOpen]);

  return (
    <div className="flex flex-col h-screen bg-app">
      <header className="bg-header text-3xl p-3 flex items-center gap-4 text-textInverse font-semibold">
        <button
          onClick={() => setSidebarOpen((prev) => !prev)}
          className="text-2xl flex items-center justify-center w-10 h-10 rounded hover:bg-primary transition-colors focus:outline-none cursor-pointer"
          title="Toggle Settings Sidebar"
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

      <nav className="flex border-b border-borderMain bg-panel shadow-sm overflow-x-auto">
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
          to="/colors"
          className={({ isActive }) => (isActive ? activeClass : inactiveClass)}
        >
          Color Settings
        </NavLink>

        {isFullMode && (
          <>
            <NavLink
              to="/qc"
              className={({ isActive }) =>
                isActive ? activeClass : inactiveClass
              }
            >
              Quality Control
            </NavLink>
            <NavLink
              to="/stats"
              className={({ isActive }) =>
                isActive ? activeClass : inactiveClass
              }
            >
              Spatial Stats
            </NavLink>
            <NavLink
              to="/tf"
              className={({ isActive }) =>
                isActive ? activeClass : inactiveClass
              }
            >
              Transcription Factor Analysis
            </NavLink>
            <NavLink
              to="/ccc"
              className={({ isActive }) =>
                isActive ? activeClass : inactiveClass
              }
            >
              Cell Cell Communication
            </NavLink>
            <NavLink
              to="/spatial-ccc"
              className={({ isActive }) =>
                isActive ? activeClass : inactiveClass
              }
            >
              Spatial CCC (LIANA)
            </NavLink>
            <NavLink
              to="/de-analysis"
              className={({ isActive }) =>
                isActive ? activeClass : inactiveClass
              }
            >
              Cell Type DE Analysis
            </NavLink>
            <NavLink
              to="/conditions-de"
              className={({ isActive }) =>
                isActive ? activeClass : inactiveClass
              }
            >
              Conditions DE Analysis
            </NavLink>
            <NavLink
              to="/annotation"
              className={({ isActive }) =>
                isActive ? activeClass : inactiveClass
              }
            >
              Cell Type Annotation
            </NavLink>
            <NavLink
              to="/conditions-causal"
              className={({ isActive }) =>
                isActive ? activeClass : inactiveClass
              }
            >
              Condition Signaling (Causal)
            </NavLink>
          </>
        )}
      </nav>

      <main className="flex-1 overflow-auto flex">
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
                      <span className="text-xs text-textMuted">
                        Scanning...
                      </span>
                    )}
                    {availableEmbeddings
                      .filter((val) => {
                        const match = val.match(/_n(\d+)/);
                        return !match || match[1] === String(selectedN);
                      })
                      .map((val) => (
                        <label
                          key={val}
                          className="block text-sm text-textMain cursor-pointer"
                        >
                          <input
                            type="radio"
                            name="embedding_val"
                            value={val}
                            checked={selectedEmbedding === val}
                            onChange={(e) =>
                              setSelectedEmbedding(e.target.value)
                            }
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
        const response = await fetch(`${API_BASE_URL}/api/metadata`);
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
          nList = ["10"];
          const configEmbeddings =
            data.available_embeddings && data.available_embeddings.length > 0
              ? data.available_embeddings
              : [{ name: "UMAP", path: "obsm/X_umap" }];
          eList = configEmbeddings.map((e) => e.path.replace("obsm/", ""));
        }

        setClusterMap(cMap);
        setAllEmbeddings(eList);
        setAvailableN(nList);

        const initialN = nList.length > 0 ? nList[0] : "N/A";
        setSelectedN(initialN);
        setAppliedN(initialN);

        const initialRs = Array.from(cMap[initialN] || []).sort(
          (a, b) => Number(a) - Number(b),
        );
        const initialR = initialRs.length > 0 ? String(initialRs[0]) : "N/A";
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

  const handleRefresh = () => {
    setAppliedN(selectedN);
    setAppliedR(selectedR);
    setAppliedEmbedding(selectedEmbedding);
  };

  const isReady =
    appliedN !== "" &&
    appliedR !== "" &&
    appliedEmbedding !== "" &&
    datasetConfig !== null;
  const isFullMode = APP_MODE === "full";

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
      >
        <Routes>
          <Route
            path="/"
            element={<Navigate to={isFullMode ? "/qc" : "/interactive"} />}
          />

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
                />
              ) : (
                <div className="p-6">Loading data from Zarr...</div>
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
