import { useState } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import { APP_MODE } from "./config/config";
import { useMetadata } from "./hooks/useMetadata";
import { useCustomColors } from "./hooks/useCustomColors";
import Layout from "./components/layout/Layout";

import VitessceViewer from "./components/vitessce/VitessceViewer";
import CellTypeAnnotation from "./pages/CellTypeAnnotation";
import CellCellCommunication from "./pages/CellCellCommunication";
import TranscriptionFactor from "./pages/TranscriptionFactor";
import SpatialStats from "./pages/SpatialStats";
import QualityControl from "./pages/QualityControl";
import MultiplexGeneOverlay from "./pages/MultiplexGeneOverlay";
import DEAnalysis from "./pages/DEAnalysis";
import ConditionsDE from "./pages/ConditionsDE";
import GSEAExplorer from "./pages/GSEAExplorer";
import SpatialCCC from "./pages/SpatialCCC";
import ConditionsCausal from "./pages/ConditionsCausal";
import CompositionAnalysis from "./pages/CompositionAnalysis";
import ColorSettings from "./pages/ColorSettings";
import DataExport from "./pages/DataExport";
import DatasetSettingsModal from "./components/ui/DatasetSettingsModal";

export default function App() {
  const params = new URLSearchParams(window.location.search);
  let dataUrl = params.get("data");
  let configB64 = params.get("config");
  let appMode = params.get("mode");
  let appTitle = params.get("title");

  // 1. If we have params, save them to memory
  if (dataUrl) {
    sessionStorage.setItem("byod_dataUrl", dataUrl);
    if (configB64) sessionStorage.setItem("byod_config", configB64);
    else sessionStorage.removeItem("byod_config");

    if (appMode) sessionStorage.setItem("byod_mode", appMode);
    if (appTitle) sessionStorage.setItem("byod_title", appTitle);
  }
  // 2. If React Router stripped the URL, restore it from memory!
  else {
    dataUrl = sessionStorage.getItem("byod_dataUrl");
    configB64 = sessionStorage.getItem("byod_config");
    appMode = sessionStorage.getItem("byod_mode");
    appTitle = sessionStorage.getItem("byod_title");

    if (dataUrl) {
      params.set("data", dataUrl);
      if (configB64) params.set("config", configB64);
      if (appMode) params.set("mode", appMode);
      if (appTitle) params.set("title", appTitle);
      // Silently put the parameters back in the address bar
      window.history.replaceState(
        {},
        "",
        `${window.location.pathname}?${params.toString()}`,
      );
    }
  }

  const [inputUrl, setInputUrl] = useState("");
  const [inputMode, setInputMode] = useState("full");
  const [inputTitle, setInputTitle] = useState("My Analysis");

  // Pass the dataUrl to your hook so it knows where to fetch metadata!
  const meta = useMetadata(dataUrl);
  const [customColors, setCustomColors] = useCustomColors();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // MOVE THESE HOOKS UP HERE!
  const [globalUpdateSignal, setGlobalUpdateSignal] = useState(0);
  const [hasUnappliedChildChanges, setHasUnappliedChildChanges] =
    useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  // BYOD Landing Page: If no data URL is present in the address bar, show this.
  if (!dataUrl) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="bg-paper p-8 rounded-lg shadow-lg border border-stroke max-w-lg w-full text-center">
          <h1 className="text-2xl font-bold text-label mb-2">
            Spatial Transcriptomics Explorer
          </h1>
          <p className="text-selpanel text-sm mb-6">
            Enter the public URL of your dataset (Cloudflare R2, AWS S3) to
            begin visualization.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              window.location.href = `/?data=${encodeURIComponent(inputUrl.trim())}&mode=${encodeURIComponent(inputMode)}&title=${encodeURIComponent(inputTitle)}`;
            }}
            className="flex flex-col gap-4 text-left"
          >
            <label className="flex flex-col gap-1">
              <span className="font-bold text-sm text-label">
                Dataset URL (Cloudflare R2 / AWS S3)
              </span>
              <input
                type="url"
                required
                className="w-full border border-stroke rounded p-3 bg-background text-label outline-none focus:border-primary"
                placeholder="e.g., https://pub-xyz.r2.dev/my-dataset"
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
              />
            </label>

            <div className="flex gap-4">
              <label className="flex flex-col gap-1 flex-1">
                <span className="font-bold text-sm text-label">App Mode</span>
                <select
                  className="w-full border border-stroke rounded p-3 bg-background text-label outline-none focus:border-primary cursor-pointer"
                  value={inputMode}
                  onChange={(e) => setInputMode(e.target.value)}
                >
                  <option value="full">Full (All Analytics)</option>
                  <option value="lite">Lite (Viewer Only)</option>
                </select>
              </label>

              <label className="flex flex-col gap-1 flex-1">
                <span className="font-bold text-sm text-label">
                  Project Title
                </span>
                <input
                  type="text"
                  required
                  className="w-full border border-stroke rounded p-3 bg-background text-label outline-none focus:border-primary"
                  placeholder="My Analysis"
                  value={inputTitle}
                  onChange={(e) => setInputTitle(e.target.value)}
                />
              </label>
            </div>

            <button
              type="submit"
              className="w-full bg-primary text-white font-bold py-3 px-4 rounded hover:opacity-90 transition-opacity mt-2 shadow-sm"
            >
              Load Dataset
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Local state for bridging Layout Refresh requests with Child Components
  const isFullMode = APP_MODE === "full";
  const globalChanged =
    meta.selectedN !== meta.appliedN ||
    meta.selectedR !== meta.appliedR ||
    meta.selectedEmbedding !== meta.appliedEmbedding;

  const needsUpdate = globalChanged || hasUnappliedChildChanges;

  const handleRefresh = () => {
    if (!needsUpdate) return;
    meta.setAppliedN(meta.selectedN);
    meta.setAppliedR(meta.selectedR);
    meta.setAppliedEmbedding(meta.selectedEmbedding);
    setGlobalUpdateSignal((prev) => prev + 1);
    setHasUnappliedChildChanges(false);
  };

  const isReady =
    (isFullMode ? meta.appliedN !== "" && meta.appliedR !== "" : true) &&
    meta.appliedEmbedding !== "" &&
    meta.datasetConfig !== null;

  return (
    <Router>
      <Layout
        availableN={meta.availableN}
        availableR={meta.availableR}
        availableEmbeddings={meta.availableEmbeddings}
        selectedN={meta.selectedN}
        setSelectedN={meta.handleSelectN}
        selectedR={meta.selectedR}
        setSelectedR={meta.setSelectedR}
        selectedEmbedding={meta.selectedEmbedding}
        setSelectedEmbedding={meta.setSelectedEmbedding}
        handleRefresh={handleRefresh}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        needsUpdate={needsUpdate}
      >
        <Routes>
          <Route
            path="/"
            element={
              <Navigate to={`/interactive${window.location.search}`} replace />
            }
          />

          <Route
            path="/interactive"
            element={
              isReady ? (
                <VitessceViewer
                  n={meta.appliedN}
                  r={meta.appliedR}
                  embedding={meta.appliedEmbedding}
                  customColors={customColors}
                  datasetConfig={meta.datasetConfig}
                  globalUpdateSignal={globalUpdateSignal}
                  setHasUnappliedChildChanges={setHasUnappliedChildChanges}
                />
              ) : (
                <div className="p-6">
                  Loading data from Zarr... Don't refresh just wait!!
                </div>
              )
            }
          />
          <Route
            path="/annotation"
            element={
              meta.datasetConfig ? (
                <CellTypeAnnotation
                  availableColumns={meta.allColumns}
                  datasetConfig={meta.datasetConfig}
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
          <Route path="/export" element={<DataExport />} />
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
                      n={meta.appliedN}
                      r={meta.appliedR}
                      customColors={customColors}
                      datasetConfig={meta.datasetConfig}
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
                      n={meta.appliedN}
                      r={meta.appliedR}
                      embedding={meta.appliedEmbedding}
                      customColors={customColors}
                      datasetConfig={meta.datasetConfig}
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
                      n={meta.appliedN}
                      r={meta.appliedR}
                      datasetConfig={meta.datasetConfig}
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
                      n={meta.appliedN}
                      r={meta.appliedR}
                      customColors={customColors}
                      datasetConfig={meta.datasetConfig}
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
              <Route path="/gsea" element={<GSEAExplorer />} />
              <Route path="/conditions-causal" element={<ConditionsCausal />} />
            </>
          )}
        </Routes>

        {/* Floating Action Buttons */}
        {dataUrl && (
          <div className="fixed bottom-4 right-4 flex flex-col gap-3 z-50">
            <button
              onClick={() => {
                sessionStorage.clear();
                window.location.href = "/";
              }}
              className="bg-danger text-white p-3 rounded-full shadow-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2 group"
            >
              <span className="text-xl leading-none">✕</span>
              <span className="max-w-0 overflow-hidden whitespace-nowrap group-hover:max-w-xs transition-all duration-300 ease-in-out font-bold text-sm">
                Close Dataset
              </span>
            </button>
            <button
              onClick={() => setIsSettingsModalOpen(true)}
              className="bg-primary text-white p-3 rounded-full shadow-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2 group"
            >
              <span className="text-xl leading-none">⚙️</span>
              <span className="max-w-0 overflow-hidden whitespace-nowrap group-hover:max-w-xs transition-all duration-300 ease-in-out font-bold text-sm">
                Dataset Settings
              </span>
            </button>
          </div>
        )}

        <DatasetSettingsModal
          isOpen={isSettingsModalOpen}
          onClose={() => setIsSettingsModalOpen(false)}
          datasetConfig={meta.datasetConfig}
          allColumns={meta.allColumns}
        />
      </Layout>
    </Router>
  );
}
