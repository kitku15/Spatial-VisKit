import { useState, useEffect, useMemo } from "react";
import Plotly from "plotly.js-dist-min";
import factory from "react-plotly.js/factory";
import VitessceSignature from "../components/vitessce/VitessceSignature";
import { API_BASE_URL, themeColors } from "../config/config";

const createPlotlyComponent =
  typeof factory === "function" ? factory : factory.default;
const Plot = createPlotlyComponent(Plotly);

export default function SignatureExplorer({ n, r, embedding, datasetConfig }) {
  const [viewMode, setViewMode] = useState("UMAP");
  const [heatmapData, setHeatmapData] = useState(null);

  const [selectedSlide, setSelectedSlide] = useState("All");
  const [selectedSample, setSelectedSample] = useState("All");
  const [hierarchy, setHierarchy] = useState({});
  const [availableSlides, setAvailableSlides] = useState(["All"]);

  // Signature State
  const [availableSignatures, setAvailableSignatures] = useState([]);
  const [activeSignature, setActiveSignature] = useState("");
  const [signatureGenes, setSignatureGenes] = useState(null);

  // Controls what Vitessce is actually rendering!
  const [overlayFeature, setOverlayFeature] = useState({
    type: "signature",
    value: "",
  });

  useEffect(() => {
    async function fetchSignatureData() {
      try {
        const dataUrl = new URLSearchParams(window.location.search)
          .get("data")
          ?.replace(/\/$/, "");
        if (!dataUrl) return;

        const res = await fetch(`${dataUrl}/aux_data/signature_metadata.json`);
        if (!res.ok) return;

        const data = await res.json();
        setHeatmapData(data);

        if (data.x && data.x.length > 0) {
          setAvailableSignatures(data.x);
          setActiveSignature(data.x[0]);
          setSignatureGenes(data.genes[data.x[0]]);
          setOverlayFeature({ type: "signature", value: `Sig_${data.x[0]}` });
        }
      } catch (err) {
        console.warn("Could not load signature_metadata.json", err);
      }
    }
    fetchSignatureData();

    // Fetch metadata for Slide/Sample dropdowns
    async function fetchMetadata() {
      try {
        const dataUrl = new URLSearchParams(window.location.search)
          .get("data")
          ?.replace(/\/$/, "");
        const configB64 =
          new URLSearchParams(window.location.search).get("config") || "";
        if (!dataUrl) return;

        const res = await fetch(
          `${API_BASE_URL}/api/metadata?data_url=${encodeURIComponent(dataUrl)}&config_b64=${configB64}`,
        );
        if (!res.ok) return;
        const data = await res.json();
        setHierarchy(data.hierarchy);
        const slideKeys = Object.keys(data.hierarchy);
        setAvailableSlides(
          slideKeys.includes("All") ? slideKeys : ["All", ...slideKeys],
        );
      } catch (err) {
        console.warn("Could not load spatial metadata", err);
      }
    }
    fetchMetadata();
  }, []);

  const availableSamples = useMemo(() => {
    if (Object.keys(hierarchy).length === 0) return ["All"];
    if (selectedSlide === "All") {
      return ["All", ...Array.from(new Set(Object.values(hierarchy).flat()))];
    }
    return ["All", ...(hierarchy[selectedSlide] || [])];
  }, [selectedSlide, hierarchy]);

  const handleSlideChange = (e) => {
    setSelectedSlide(e.target.value);
    setSelectedSample("All");
  };

  const handleSignatureChange = (sigName) => {
    setActiveSignature(sigName);
    setOverlayFeature({ type: "signature", value: `Sig_${sigName}` });
    if (heatmapData && heatmapData.genes) {
      setSignatureGenes(heatmapData.genes[sigName]);
    }
  };

  const handleGeneClick = (geneName) => {
    setOverlayFeature({ type: "gene", value: geneName });
  };

  const plotData = useMemo(() => {
    if (!heatmapData) return null;
    return [
      {
        type: "heatmap",
        x: heatmapData.x,
        y: heatmapData.y,
        z: heatmapData.z,
        colorscale: "Viridis",
        colorbar: { title: "Scaled Score" },
      },
    ];
  }, [heatmapData]);

  return (
    <div className="p-6 flex flex-col gap-6 h-full bg-app">
      <div className="bg-panel p-4 border border-borderLight shadow-sm rounded flex items-center gap-6">
        <div className="flex items-center h-9 bg-borderLight rounded p-1">
          <button
            className={`px-4 h-full rounded text-sm font-semibold transition ${viewMode === "UMAP" ? "bg-panel shadow text-primary" : "text-textMuted"}`}
            onClick={() => setViewMode("UMAP")}
          >
            UMAP
          </button>
          <button
            className={`px-4 h-full rounded text-sm font-semibold transition ${viewMode === "Spatial" ? "bg-panel shadow text-primary" : "text-textMuted"}`}
            onClick={() => setViewMode("Spatial")}
          >
            Spatial
          </button>
        </div>

        {viewMode === "Spatial" && (
          <div className="flex gap-4 border-l border-borderMain pl-4">
            <label className="text-sm font-semibold flex items-center gap-2 text-textMain">
              Slide:
              <select
                className="border border-borderMain rounded px-3 h-9 bg-panel font-normal outline-none focus:border-primary"
                value={selectedSlide}
                onChange={handleSlideChange}
              >
                {availableSlides.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-semibold flex items-center gap-2 text-textMain">
              Sample:
              <select
                className="border border-borderMain rounded px-3 h-9 bg-panel font-normal disabled:opacity-50 outline-none focus:border-primary"
                value={selectedSample}
                onChange={(e) => setSelectedSample(e.target.value)}
                disabled={availableSamples.length <= 1}
              >
                {availableSamples.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

        <label className="text-sm font-semibold flex items-center gap-2 border-l border-borderMain pl-6 text-textMain">
          Select Signature:
          <select
            className="border border-primary rounded px-3 h-9 bg-primary-light text-primary-dark font-bold outline-none cursor-pointer"
            value={activeSignature}
            onChange={(e) => handleSignatureChange(e.target.value)}
          >
            {availableSignatures.map((sig) => (
              <option key={sig} value={sig}>
                {sig}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex gap-6 flex-1 min-h-0">
        {/* Left Panel: Vitessce Viewer */}
        <div className="flex-1 bg-panel border border-borderLight shadow-sm rounded flex flex-col overflow-hidden">
          <div className="bg-app border-b border-borderLight px-4 py-2 flex justify-between items-center">
            <h3 className="font-bold text-sm text-textMain">
              Spatial Signature Distribution
            </h3>
          </div>
          <div className="flex-1 relative">
            <VitessceSignature
              viewMode={viewMode}
              selectedSlide={selectedSlide}
              selectedSample={selectedSample}
              n={n}
              r={r}
              embedding={embedding}
              datasetConfig={datasetConfig}
              overlayFeature={overlayFeature}
            />
          </div>
        </div>

        {/* Right Panel: Analytics */}
        <div className="w-[45%] flex flex-col gap-6 min-h-0">
          {/* Heatmap */}
          <div className="flex-[2] bg-panel border border-borderLight shadow-sm rounded flex flex-col overflow-hidden">
            <div className="bg-app border-b border-borderLight px-4 py-2">
              <h3 className="font-bold text-sm text-textMain">
                Signature Enrichment per Cell Type
              </h3>
            </div>
            <div className="flex-1 p-2 flex items-center justify-center">
              {!heatmapData ? (
                <span className="text-textMuted text-sm">
                  Loading Heatmap...
                </span>
              ) : (
                <Plot
                  data={plotData}
                  layout={{
                    autosize: true,
                    margin: { l: 150, r: 20, t: 20, b: 80 },
                    xaxis: { tickangle: 45 },
                    yaxis: {
                      type: "category",
                      automargin: true,
                      autorange: "reversed",
                    },
                    paper_bgcolor: themeColors.paper,
                    plot_bgcolor: themeColors.paper,
                    font: { color: themeColors.label },
                  }}
                  useResizeHandler={true}
                  style={{ width: "100%", height: "100%" }}
                  onClick={(data) => handleSignatureChange(data.points[0].x)}
                />
              )}
            </div>
          </div>

          {/* Signature Inspector */}
          <div className="flex-1 bg-panel border border-borderLight shadow-sm rounded flex flex-col overflow-hidden">
            <div className="bg-app border-b border-borderLight px-4 py-3 flex items-center justify-between">
              <div className="flex flex-col">
                <h3 className="font-bold text-sm text-textMain">
                  Signature Inspector: {activeSignature}
                </h3>
                <span className="text-xs text-textMuted font-medium mt-0.5">
                  Click a gene to overlay its raw expression
                </span>
              </div>

              {/* Back to Score Button - Appears only when a gene is actively being viewed */}
              {overlayFeature.type === "gene" && (
                <button
                  onClick={() =>
                    setOverlayFeature({
                      type: "signature",
                      value: `Sig_${activeSignature}`,
                    })
                  }
                  className="px-3 py-1.5 bg-primary text-textInverse font-bold text-xs rounded hover:opacity-90 transition shadow-sm animate-pulse"
                >
                  ← Back to Score
                </button>
              )}
            </div>

            <div className="flex-1 p-4 overflow-y-auto text-sm text-textMain">
              <div className="flex flex-wrap gap-2">
                {signatureGenes?.map((gene) => {
                  const isActiveGene =
                    overlayFeature.type === "gene" &&
                    overlayFeature.value === gene;
                  return (
                    <button
                      key={gene}
                      onClick={() => handleGeneClick(gene)}
                      className={`px-3 py-1.5 rounded border text-xs font-bold transition shadow-sm cursor-pointer
                        ${
                          isActiveGene
                            ? "bg-primary text-textInverse border-primary"
                            : "bg-primary-light text-primary-dark border-primary hover:bg-primary hover:text-textInverse"
                        }`}
                    >
                      {gene}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
