import React, { useState, useEffect, useMemo } from "react";
import { Vitessce } from "vitessce";
import Plotly from "plotly.js-dist-min";
import factory from "react-plotly.js/factory";
import {
  API_BASE_URL,
  ZARR_DIR,
  EXTRA_OBS_SETS,
  SPATIAL_KEY,
  VITESSCE_DOT_SIZE,
  ANALYSIS_NAME,
  largeColorPalette,
  themeColors,
  DATA_DIR,
  DYNAMIC_ANNOTATIONS,
} from "./config";
import InfoModal from "./InfoModal";
import { tabInfo } from "./infoHelper";

const createPlotlyComponent =
  typeof factory === "function" ? factory : factory.default;
const Plot = createPlotlyComponent(Plotly);

const hexToRgb = (hex) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
};

export default function VitessceViewer({ n, r, embedding, customColors = {} }) {
  const [selectedSlide, setSelectedSlide] = useState("All");
  const [selectedSample, setSelectedSample] = useState("All");
  const [activeCategory, setActiveCategory] = useState(DYNAMIC_ANNOTATIONS[0].name);
  const [spatialViewMode, setSpatialViewMode] = useState("segmentations");

  const [appliedFilters, setAppliedFilters] = useState({
    slide: "All",
    sample: "All",
    category: "Cell Clusters",
    viewMode: "segmentations",
  });

  const [hierarchy, setHierarchy] = useState({});
  const [availableSlides, setAvailableSlides] = useState(["All"]);
  const [availableSamples, setAvailableSamples] = useState(["All"]);

  const [compositionData, setCompositionData] = useState(null);
  const [hoveredSlice, setHoveredSlice] = useState(null);
  const [clickedSlice, setClickedSlice] = useState(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(
          `${API_BASE_URL}/${DATA_DIR}/spatial_metadata_${ANALYSIS_NAME}.json`,
        );
        if (res.ok) {
          const data = await res.json();
          setHierarchy(data);
          setAvailableSlides(["All", ...Object.keys(data)]);
        }
        const compRes = await fetch(`${API_BASE_URL}/${DATA_DIR}/cell_composition.json`);
        if (compRes.ok) setCompositionData(await compRes.json());
      } catch (err) {
        console.warn("Could not load Vitessce JSON data", err);
      }
    }
    fetchData();
  }, []);

  useEffect(() => {
    if (Object.keys(hierarchy).length === 0) return;
    if (selectedSlide === "All") {
      setAvailableSamples(["All", ...Object.values(hierarchy).flat()]);
    } else {
      setAvailableSamples(["All", ...(hierarchy[selectedSlide] || [])]);
    }
  }, [selectedSlide, hierarchy]);

  const handleSlideChange = (e) => {
    setSelectedSlide(e.target.value);
    setSelectedSample("All");
  };

  useEffect(() => {
    setClickedSlice(null);
  }, [appliedFilters, n, r]);

  const internalColName = useMemo(() => {
    const dynamicAnn = DYNAMIC_ANNOTATIONS.find((a) => a.name === appliedFilters.category);
    if (dynamicAnn) return `${dynamicAnn.prefix}_n${n}_r${r}`;
    
    const extra = EXTRA_OBS_SETS.find((e) => e.name === appliedFilters.category);
    return extra ? extra.path.replace("obs/", "") : "";
  }, [appliedFilters.category, n, r]);

  const currentDataCounts = useMemo(() => {
    if (!compositionData) return null;
    const dataKey = `${appliedFilters.slide}_${appliedFilters.sample}`;
    const targetData = compositionData[dataKey] || compositionData["All_All"];
    return targetData[internalColName] || null;
  }, [
    compositionData,
    appliedFilters.slide,
    appliedFilters.sample,
    internalColName,
  ]);

  const colorMap = useMemo(() => {
    if (!currentDataCounts) return {};
    const labels = Object.keys(currentDataCounts).sort();
    const map = {};
    labels.forEach((label, i) => {
      map[label] = customColors[label] || largeColorPalette[i % largeColorPalette.length];
    });
    return map;
  }, [currentDataCounts, customColors]);

  const pieChartData = useMemo(() => {
    if (!currentDataCounts) return null;

    const labels = Object.keys(currentDataCounts);
    const values = Object.values(currentDataCounts);

    const colors = labels.map((label) => {
      if (hoveredSlice)
        return label === hoveredSlice
          ? colorMap[label]
          : themeColors.background;
      if (clickedSlice)
        return label === clickedSlice
          ? colorMap[label]
          : themeColors.background;
      return colorMap[label];
    });

    return [
      {
        values,
        labels,
        type: "pie",
        textinfo: "label+percent",
        textposition: "inside",
        hoverinfo: "label+value+percent",
        marker: { colors },
        sort: false,
        hole: 0.3,
      },
    ];
  }, [currentDataCounts, colorMap, hoveredSlice, clickedSlice]);

  const config = useMemo(() => {
    let spatialEmbeddingKey = `obsm/${SPATIAL_KEY}`;
    let segmentationsFile = `/${DATA_DIR}/segmentations/segmentations.json`;

    if (appliedFilters.sample !== "All") {
      spatialEmbeddingKey = `obsm/${SPATIAL_KEY}_${appliedFilters.sample}`;
      segmentationsFile = `/${DATA_DIR}/segmentations/segmentations_${appliedFilters.sample}.json`;
    } else if (appliedFilters.slide !== "All") {
      spatialEmbeddingKey = `obsm/${SPATIAL_KEY}_${appliedFilters.slide}`;
      segmentationsFile = `/${DATA_DIR}/segmentations/segmentations_${appliedFilters.slide}.json`;
    }

    const obsSetColor = Object.keys(colorMap).map((label) => ({
      path: [appliedFilters.category, label],
      color: hexToRgb(colorMap[label]),
    }));

    const allObsSets = [
      ...DYNAMIC_ANNOTATIONS.map((ann) => ({
        name: ann.name,
        path: `obs/${ann.prefix}_n${n}_r${r}`,
      })),
      ...EXTRA_OBS_SETS,
    ];

    const sortedObsSets = [
      allObsSets.find((set) => set.name === appliedFilters.category),
      ...allObsSets.filter((set) => set.name !== appliedFilters.category),
    ].filter((set) => set && set.path); 

    const coordinationSpace = {
      embeddingType: { ET_UMAP: "UMAP", ET_SPATIAL: "SPATIAL_VIEW" },
      embeddingObsRadiusMode: { RM1: "manual" },
      embeddingObsRadius: { R1: VITESSCE_DOT_SIZE },
      obsSetColor: { OSC1: obsSetColor },
      spatialZoom: { SZ1: -2 },
      spatialTargetX: { STX1: 0 },
      spatialTargetY: { STY1: 0 },
      spatialSegmentationLayer: {
        SSL1: {
          opacity: 0.5,
          radius: 1,
          visible: true,
          stroked: true,
          strokedColor: [100, 100, 100],
        },
      },
    };

    const umapScopes = {
      embeddingType: "ET_UMAP",
      embeddingObsRadiusMode: "RM1",
      embeddingObsRadius: "R1",
      obsSetColor: "OSC1",
    };
    const spatialScopes = {
      spatialSegmentationLayer: "SSL1",
      obsSetColor: "OSC1",
    };
    const pointSpatialScopes = {
      embeddingType: "ET_SPATIAL",
      embeddingObsRadiusMode: "RM1",
      embeddingObsRadius: "R1",
      obsSetColor: "OSC1",
    };
    const obsSetsScopes = { obsSetColor: "OSC1" };

    if (clickedSlice) {
      coordinationSpace.obsSetSelection = {
        OSS1: [[appliedFilters.category, clickedSlice]],
      };
      umapScopes.obsSetSelection = "OSS1";
      spatialScopes.obsSetSelection = "OSS1";
      pointSpatialScopes.obsSetSelection = "OSS1";
      obsSetsScopes.obsSetSelection = "OSS1";
    }

    const files = [
      {
        fileType: "anndata-cells.zarr",
        url: `${API_BASE_URL}/${ZARR_DIR}/`,
        options: {
          mappings: {
            UMAP: { key: `obsm/${embedding}`, dims: [0, 1] },
            SPATIAL_VIEW: { key: spatialEmbeddingKey, dims: [0, 1] },
          },
        },
        coordinationValues: { obsType: "cell" },
      },
      {
        fileType: "obsSets.anndata.zarr",
        url: `${API_BASE_URL}/${ZARR_DIR}/`,
        options: sortedObsSets,
        coordinationValues: { obsType: "cell" },
      },
      {
        fileType: "obsFeatureMatrix.anndata.zarr",
        url: `${API_BASE_URL}/${ZARR_DIR}/`,
        options: { path: "X" },
        coordinationValues: { obsType: "cell" },
      },
    ];

    if (appliedFilters.viewMode === "segmentations") {
      files.push({
        fileType: "obsLocations.anndata.zarr",
        url: `${API_BASE_URL}/${ZARR_DIR}/`,
        options: { path: spatialEmbeddingKey },
        coordinationValues: { obsType: "cell" },
      });
      files.push({
        fileType: "obsSegmentations.json",
        url: `${API_BASE_URL}/${encodeURIComponent(segmentationsFile)}`,
        coordinationValues: { obsType: "cell" },
      });
    }

    return {
      version: "1.0.15",
      name: "Tyler Spatial View",
      initStrategy: "auto",
      datasets: [{ uid: "my-dataset", files: files }],
      coordinationSpace: coordinationSpace,
      layout: [
        {
          component: "scatterplot",
          coordinationScopes: umapScopes,
          x: 0,
          y: 0,
          w: 4,
          h: 12,
        },
        appliedFilters.viewMode === "segmentations"
          ? {
              component: "spatial",
              coordinationScopes: spatialScopes,
              x: 4,
              y: 0,
              w: 4,
              h: 12,
            }
          : {
              component: "scatterplot",
              coordinationScopes: pointSpatialScopes,
              x: 4,
              y: 0,
              w: 4,
              h: 12,
            },
        {
          component: "layerController",
          coordinationScopes: spatialScopes,
          x: 8,
          y: 0,
          w: 4,
          h: 2,
        },
        {
          component: "obsSets",
          coordinationScopes: obsSetsScopes,
          x: 8,
          y: 2,
          w: 2,
          h: 4,
        },
        { component: "featureList", x: 10, y: 3, w: 2, h: 4 },
      ],
    };
  }, [n, r, appliedFilters, clickedSlice, colorMap]);

  return (
    <div className="flex flex-col w-full h-full relative">
      <div className="bg-panel border-b border-borderLight px-4 py-2 flex gap-6 items-center z-10 shadow-sm">
        <span className="font-bold text-sm text-textMain uppercase tracking-wide">
          Spatial Filters:
        </span>

        <div className="flex bg-app rounded p-1 border border-borderMain">
          <button
            className={`px-3 py-1 rounded text-xs font-bold transition ${spatialViewMode === "points" ? "bg-primary-light text-primary-dark shadow-sm" : "text-textMuted hover:text-textMain"}`}
            onClick={() => setSpatialViewMode("points")}
          >
            Points
          </button>
          <button
            className={`px-3 py-1 rounded text-xs font-bold transition ${spatialViewMode === "segmentations" ? "bg-primary-light text-primary-dark shadow-sm" : "text-textMuted hover:text-textMain"}`}
            onClick={() => setSpatialViewMode("segmentations")}
          >
            Polygons
          </button>
        </div>

        <label className="text-sm font-semibold flex items-center gap-2 text-textMain">
          Slide:
          <select
            className="border border-borderMain rounded px-2 py-1 bg-panel text-textMain outline-none focus:border-primary"
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
            className="border border-borderMain rounded px-2 py-1 bg-panel text-textMain outline-none disabled:opacity-50 focus:border-primary"
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

        <label className="text-sm font-semibold flex items-center gap-2 border-l border-borderMain pl-6 text-textMain">
          Color By:
          <select
            className="border border-primary rounded px-2 py-1 bg-primary-light text-primary-dark font-bold outline-none cursor-pointer focus:ring-1 focus:ring-primary"
            value={activeCategory}
            onChange={(e) => setActiveCategory(e.target.value)}
          >
            {DYNAMIC_ANNOTATIONS.map((ann) => (
              <option key={ann.name} value={ann.name}>
                {ann.name}
              </option>
            ))}
            {EXTRA_OBS_SETS.map((s) => (
              <option key={s.name} value={s.name}>
                {s.name}
              </option>
            ))}
          </select>
        </label>

        <div className="ml-auto flex items-center gap-4">
          <button
            onClick={() =>
              setAppliedFilters({
                slide: selectedSlide,
                sample: selectedSample,
                category: activeCategory,
                viewMode: spatialViewMode,
              })
            }
            className="bg-primary hover:bg-primary-dark text-textInverse text-sm font-bold py-1.5 px-4 rounded shadow transition"
          >
            Refresh Plot
          </button>
          <InfoModal
            title={tabInfo.interactive.title}
            content={tabInfo.interactive.content}
          />
        </div>
      </div>

      <div
        className={`flex-1 w-full min-h-0 relative ${appliedFilters.viewMode === "points" ? "flip-spatial-y" : ""}`}
      >
        <Vitessce
          key={`vitessce-${n}-${r}-${appliedFilters.category}-${appliedFilters.slide}-${appliedFilters.sample}-${appliedFilters.viewMode}`}
          config={config}
          theme="light"
        />

        <div className="absolute bottom-0 right-0 w-1/3 h-[50%] bg-panel z-10 border-t border-l border-borderLight p-3 flex flex-col shadow-[-4px_-4px_8px_-1px_rgba(0,0,0,0.05)]">
          <div className="flex justify-between items-center mb-2 pb-2 border-b border-borderLight">
            <span className="text-sm font-bold text-textMain uppercase tracking-wide">
              Composition:{" "}
              <span className="text-primary">{appliedFilters.category}</span>
            </span>

            {clickedSlice && (
              <button
                onClick={() => setClickedSlice(null)}
                className="text-xs font-semibold bg-danger-light border border-danger-light text-danger-dark px-3 py-1 rounded shadow-sm hover:bg-danger hover:text-textInverse transition"
              >
                ✕ Clear Plot Filter: <b>{clickedSlice}</b>
              </button>
            )}
          </div>

          <div className="flex-1 min-h-0 relative">
            {pieChartData ? (
              <Plot
                data={pieChartData}
                layout={{
                  autosize: true,
                  margin: { l: 60, r: 60, t: 40, b: 40 },
                  showlegend: true,
                  paper_bgcolor: themeColors.paper,
                  plot_bgcolor: themeColors.paper,
                  font: { color: themeColors.label },
                }}
                useResizeHandler={true}
                style={{ width: "100%", height: "100%" }}
                onHover={(data) => setHoveredSlice(data.points[0].label)}
                onUnhover={() => setHoveredSlice(null)}
                onClick={(data) =>
                  setClickedSlice(
                    data.points[0].label === clickedSlice
                      ? null
                      : data.points[0].label,
                  )
                }
              />
            ) : (
              <div className="flex items-center justify-center h-full text-sm text-textMuted">
                Loading composition data...
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
