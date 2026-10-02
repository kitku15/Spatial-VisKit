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

export default function App() {
  const meta = useMetadata();
  const [customColors, setCustomColors] = useCustomColors();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Local state for bridging Layout Refresh requests with Child Components
  const [globalUpdateSignal, setGlobalUpdateSignal] = useState(0);
  const [hasUnappliedChildChanges, setHasUnappliedChildChanges] =
    useState(false);

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
          <Route path="/" element={<Navigate to="/interactive" />} />

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
                <div className="p-6">Loading data from Zarr...</div>
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
      </Layout>
    </Router>
  );
}
