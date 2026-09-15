import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Vitessce } from "vitessce";
import Plotly from "plotly.js-dist-min";
import factory from "react-plotly.js/factory";
import {
  API_BASE_URL,
  DATA_DIR,
  ZARR_PREFIX,
  largeColorPalette,
  themeColors,
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

export default function VitessceViewer({
  n,
  r,
  embedding,
  customColors = {},
  datasetConfig,
  globalUpdateSignal,
  setHasUnappliedChildChanges,
}) {
  // Memoize dataset config values to satisfy exhaustive dependencies
  const dynamicAnnotations = useMemo(
    () =>
      datasetConfig?.dynamic_annotations || [
        { name: "Cell Clusters (Leiden)", prefix: "leiden" },
      ],
    [datasetConfig],
  );
  const extraObsSets = useMemo(
    () => datasetConfig?.extra_obs_sets || [],
    [datasetConfig],
  );
  const spatialKey = datasetConfig?.spatial_key || "global";
  const dotSize = datasetConfig?.vitessce_dot_size || 2;
  const zarrDir = `${ZARR_PREFIX}${datasetConfig?.zarr_filename}`;

  const [selectedSlide, setSelectedSlide] = useState("");
  const [selectedSample, setSelectedSample] = useState("");
  const [activeCategory, setActiveCategory] = useState(
    dynamicAnnotations[0]?.name || extraObsSets[0]?.name || "Unknown",
  );

  const [appliedFilters, setAppliedFilters] = useState({
    slide: "",
    sample: "",
    category: dynamicAnnotations[0]?.name || extraObsSets[0]?.name || "Unknown",
  });

  const [hierarchy, setHierarchy] = useState({});
  const [availableSlides, setAvailableSlides] = useState(["All"]);

  const [compositionData, setCompositionData] = useState(null);
  // const [zarrColumns, setZarrColumns] = useState(null);
  const [hoveredSlice, setHoveredSlice] = useState(null);
  const [clickedSlice, setClickedSlice] = useState(null);

  // Derive available samples based on selectedSlide and hierarchy
  const availableSamples = useMemo(() => {
    if (Object.keys(hierarchy).length === 0) return ["All"];
    if (selectedSlide === "All") {
      return Array.from(new Set(["All", ...Object.values(hierarchy).flat()]));
    }
    return Array.from(new Set(["All", ...(hierarchy[selectedSlide] || [])]));
  }, [selectedSlide, hierarchy]);

  // Adjust clicked slice during render if n or r changes (no effect required)
  const [prevFilterKey, setPrevFilterKey] = useState(`${n}-${r}`);
  const currentFilterKey = `${n}-${r}`;
  if (currentFilterKey !== prevFilterKey) {
    setPrevFilterKey(currentFilterKey);
    setClickedSlice(null);
  }
  // Notify parent if local dropdowns don't match the applied filters
  useEffect(() => {
    if (!setHasUnappliedChildChanges) return;

    const isDirty =
      selectedSlide !== appliedFilters.slide ||
      selectedSample !== appliedFilters.sample ||
      activeCategory !== appliedFilters.category;

    setHasUnappliedChildChanges(isDirty);

    // Clean up when leaving the tab so the button resets
    return () => setHasUnappliedChildChanges(false);
  }, [
    selectedSlide,
    selectedSample,
    activeCategory,
    appliedFilters,
    setHasUnappliedChildChanges,
  ]);

  const handleApplyFilters = useCallback(() => {
    setAppliedFilters({
      slide: selectedSlide,
      sample: selectedSample,
      category: activeCategory,
    });
    setClickedSlice(null);
  }, [selectedSlide, selectedSample, activeCategory]);

  const prevSignalRef = useRef(globalUpdateSignal);

  useEffect(() => {
    if (globalUpdateSignal > prevSignalRef.current) {
      handleApplyFilters();
      prevSignalRef.current = globalUpdateSignal;
    }
  }, [globalUpdateSignal, handleApplyFilters]);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`${API_BASE_URL}/api/metadata.json`);
        if (res.ok) {
          const data = await res.json();
          setHierarchy(data.hierarchy);
          // setZarrColumns(data.obs_columns);

          const slides = Object.keys(data.hierarchy);
          setAvailableSlides(
            slides.includes("All") ? slides : ["All", ...slides],
          );

          if (slides.length > 0) {
            const randomSlide =
              slides[Math.floor(Math.random() * slides.length)];
            const samplesInSlide = data.hierarchy[randomSlide] || [];
            const randomSample =
              samplesInSlide.length > 0
                ? samplesInSlide[
                    Math.floor(Math.random() * samplesInSlide.length)
                  ]
                : "All";

            setSelectedSlide(randomSlide);
            setSelectedSample(randomSample);

            const initialCategory =
              dynamicAnnotations[0]?.name || extraObsSets[0]?.name || "Unknown";

            setActiveCategory(initialCategory); // Ensure dropdown syncs visually

            setAppliedFilters({
              slide: randomSlide,
              sample: randomSample,
              category: initialCategory,
            });
          }
        }
        const compRes = await fetch(`${API_BASE_URL}/api/composition.json`);
        if (compRes.ok) setCompositionData(await compRes.json());
      } catch (err) {
        console.warn("Could not load spatial metadata", err);
      }
    }
    fetchData();
  }, [dynamicAnnotations, extraObsSets]);

  const handleSlideChange = (e) => {
    setSelectedSlide(e.target.value);
    setSelectedSample("All");
  };

  const internalColName = useMemo(() => {
    const dynamicAnn = dynamicAnnotations.find(
      (a) => a.name === appliedFilters.category,
    );
    if (dynamicAnn) return `${dynamicAnn.prefix}_n${n}_r${r}`;
    const extra = extraObsSets.find((e) => e.name === appliedFilters.category);
    return extra ? extra.path.replace("obs/", "") : "";
  }, [appliedFilters.category, n, r, dynamicAnnotations, extraObsSets]);

  const currentDataCounts = useMemo(() => {
    if (!compositionData) return null;
    const dataKey = `${appliedFilters.slide}_${appliedFilters.sample}`;
    const targetData = compositionData[dataKey] || compositionData["All_All"];
    return targetData ? targetData[internalColName] || null : null;
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
      map[label] =
        customColors[label] || largeColorPalette[i % largeColorPalette.length];
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
    const hasSegmentations = datasetConfig?.has_segmentations ?? false;
    const spatialEmbeddingKey = `obsm/${spatialKey}`;
    const segmentationsFile =
      appliedFilters.sample !== "All"
        ? `${DATA_DIR}/segmentations/segmentations_${appliedFilters.sample}.json`
        : appliedFilters.slide !== "All"
          ? `${DATA_DIR}/segmentations/segmentations_Slide_${appliedFilters.slide}.json`
          : `${DATA_DIR}/segmentations/segmentations.json`;

    const obsSetColor = Object.keys(colorMap).map((label) => ({
      path: [appliedFilters.category, label],
      color: hexToRgb(colorMap[label]),
    }));

    const allObsSets = [
      ...dynamicAnnotations.map((ann) => {
        const pathSuffix =
          !n || n === "N/A" || !r || r === "N/A"
            ? ann.prefix
            : `${ann.prefix}_n${n}_r${r}`;
        return { name: ann.name, path: `obs/${pathSuffix}` };
      }),
      ...extraObsSets,
    ];

    const activeObsSet = allObsSets.find(
      (set) => set.name === appliedFilters.category,
    );
    const sortedObsSets = activeObsSet ? [activeObsSet] : [];

    const sampleSetName =
      extraObsSets.find((e) => e.path.toLowerCase().includes("sample"))?.name ||
      "Sample ID";
    const slideSetName =
      extraObsSets.find((e) => e.path.toLowerCase().includes("slide"))?.name ||
      "Slide ID";

    const coordinationSpace = {
      embeddingType: { ET_UMAP: "UMAP", ET_SPATIAL: "SPATIAL_VIEW" },
      embeddingZoom: { EZ_UMAP: 0, EZ_SPATIAL: 0 },
      embeddingTargetX: { EX_UMAP: 0, EX_SPATIAL: 0 },
      embeddingTargetY: { EY_UMAP: 0, EY_SPATIAL: 0 },
      embeddingObsRadiusMode: { RM1: "manual", RM_SPATIAL: "manual" },
      embeddingObsRadius: { R1: dotSize, R_SPATIAL: dotSize },
      obsSetColor: { OSC1: obsSetColor },
      featureValueColormap: { CVM1: "viridis" },

      spatialPointLayer: {
        SPL1: { visible: true, opacity: 0, radius: 0 },
      },
      spatialSegmentationLayer: {
        SSL1: {
          visible: true,
          opacity: 0.5,
          radius: 1,
          stroked: true,
          strokedColor: [100, 100, 100],
        },
      },
      obsSetSelection: {
        OSS1: clickedSlice ? [[appliedFilters.category, clickedSlice]] : null,
      },
      obsSetFilter: {
        OSF1:
          appliedFilters.sample !== "All"
            ? [[sampleSetName, appliedFilters.sample]]
            : appliedFilters.slide !== "All"
              ? [[slideSetName, appliedFilters.slide]]
              : null,
      },
      obsColorEncoding: { OCE1: "cellSetSelection" },
    };

    const umapScopes = {
      embeddingType: "ET_UMAP",
      embeddingObsRadiusMode: "RM1",
      embeddingObsRadius: "R1",
      obsSetColor: "OSC1",
      obsSetSelection: "OSS1",
      obsSetFilter: "OSF1",
      obsColorEncoding: "OCE1",
      featureSelection: "FS1",
      featureValueColormap: "CVM1",
    };

    const spatialScatterplotScopes = {
      embeddingType: "ET_SPATIAL",
      embeddingZoom: "EZ_SPATIAL",
      embeddingTargetX: "EX_SPATIAL",
      embeddingTargetY: "EY_SPATIAL",
      embeddingObsRadiusMode: "RM_SPATIAL",
      embeddingObsRadius: "R_SPATIAL",
      obsSetColor: "OSC1",
      obsSetSelection: "OSS1",
      obsSetFilter: "OSF1",
      obsColorEncoding: "OCE1",
      featureSelection: "FS1",
      featureValueColormap: "CVM1",
    };

    const spatialScopes = {
      spatialPointLayer: "SPL1",
      spatialSegmentationLayer: "SSL1",
      obsSetColor: "OSC1",
      obsSetSelection: "OSS1",
      obsSetFilter: "OSF1",
      obsColorEncoding: "OCE1",
      featureSelection: "FS1",
      featureValueColormap: "CVM1",
    };

    const obsSetsScopes = {
      obsSetColor: "OSC1",
      obsSetSelection: "OSS1",
      obsSetFilter: "OSF1",
      obsColorEncoding: "OCE1",
    };

    const files = [
      {
        fileType: "anndata-cells.zarr",
        url: `${API_BASE_URL}/${zarrDir}/`,
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
        url: `${API_BASE_URL}/${zarrDir}/`,
        options: sortedObsSets,
        coordinationValues: { obsType: "cell" },
      },
      {
        fileType: "obsFeatureMatrix.anndata.zarr",
        url: `${API_BASE_URL}/${zarrDir}/`,
        options: { path: "X" },
        coordinationValues: { obsType: "cell" },
      },
    ];

    // Only inject segmentation files if they actually exist
    if (hasSegmentations) {
      files.push({
        fileType: "obsSegmentations.json",
        url: `${API_BASE_URL}/${segmentationsFile}?t=${globalUpdateSignal}`,
        coordinationValues: { obsType: "cell" },
      });
      files.push({
        fileType: "obsLocations.anndata.zarr",
        url: `${API_BASE_URL}/${zarrDir}/`,
        options: { path: spatialEmbeddingKey },
        coordinationValues: { obsType: "cell" },
      });
    }

    // Build the dynamic layout
    const layout = [
      {
        component: "scatterplot",
        coordinationScopes: umapScopes,
        x: 0,
        y: 0,
        w: 4,
        h: 12,
        props: { title: "UMAP" },
      },
    ];

    if (hasSegmentations) {
      layout.push({
        component: "spatial",
        coordinationScopes: spatialScopes,
        x: 4,
        y: 0,
        w: 4,
        h: 12,
        props: { title: "Spatial (Segmentations)" },
      });
      layout.push({
        component: "layerController",
        coordinationScopes: spatialScopes,
        x: 8,
        y: 0,
        w: 4,
        h: 3,
        props: { title: "Spatial Layers" },
      });
      layout.push({
        component: "obsSets",
        coordinationScopes: obsSetsScopes,
        x: 8,
        y: 3,
        w: 2,
        h: 9,
      });
      layout.push({
        component: "featureList",
        coordinationScopes: {
          featureSelection: "FS1",
          obsColorEncoding: "OCE1",
        },
        x: 10,
        y: 3,
        w: 2,
        h: 9,
      });
    } else {
      // Substitute the Spatial Viewer with a Scatterplot Viewer
      layout.push({
        component: "scatterplot",
        coordinationScopes: spatialScatterplotScopes,
        x: 4,
        y: 0,
        w: 4,
        h: 12,
        props: { title: "Spatial (Coordinates)" },
      });
      // Expand the right side menus since LayerController is no longer needed
      layout.push({
        component: "obsSets",
        coordinationScopes: obsSetsScopes,
        x: 8,
        y: 0,
        w: 2,
        h: 12,
      });
      layout.push({
        component: "featureList",
        coordinationScopes: {
          featureSelection: "FS1",
          obsColorEncoding: "OCE1",
        },
        x: 10,
        y: 0,
        w: 2,
        h: 12,
      });
    }

    return {
      version: "1.0.15",
      name: "Interactive Explorer",
      initStrategy: "auto",
      datasets: [{ uid: "my-dataset", files }],
      coordinationSpace,
      layout,
    };
  }, [
    n,
    r,
    appliedFilters,
    clickedSlice,
    colorMap,
    embedding,
    dotSize,
    dynamicAnnotations,
    extraObsSets,
    spatialKey,
    zarrDir,
    datasetConfig,
    globalUpdateSignal,
  ]);

  return (
    <div className="flex flex-col w-full h-full relative">
      <div className="bg-panel border-b border-borderLight px-4 py-2 flex gap-6 items-center z-10 shadow-sm">
        <span className="font-bold text-sm text-textMain uppercase tracking-wide">
          Spatial Filters:
        </span>

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
            {dynamicAnnotations.map((ann) => (
              <option key={ann.name} value={ann.name}>
                {ann.name}
              </option>
            ))}
            {extraObsSets.map((s) => (
              <option key={s.name} value={s.name}>
                {s.name}
              </option>
            ))}
          </select>
        </label>

        <div className="ml-auto flex items-center gap-4">
          <InfoModal
            title={tabInfo.interactive.title}
            content={tabInfo.interactive.content}
          />
        </div>
      </div>

      <div className="flex-1 w-full h-full min-h-0 relative overflow-hidden">
        {appliedFilters.slide && compositionData ? (
          <Vitessce
            key={`vitessce-${n}-${r}-${appliedFilters.category}-${appliedFilters.slide}-${appliedFilters.sample}`}
            config={config}
            theme="light"
          />
        ) : (
          <div className="flex items-center justify-center w-full h-full text-textMuted font-bold">
            Loading spatial data...
          </div>
        )}

        <div className="absolute bottom-0 right-0 w-1/3 h-[50%] bg-panel z-10 border-t border-l border-borderLight p-3 flex flex-col shadow-[-4px_-4px_8px_-1px_rgba(0,0,0,0.05)]">
          <div className="flex justify-between items-center mb-2 pb-2 border-b border-borderLight">
            <span className="text-sm font-bold text-textMain uppercase tracking-wide">
              Composition:{" "}
              <span className="text-primary">{appliedFilters.category}</span>
            </span>
            {clickedSlice && (
              <button
                onClick={() => setClickedSlice(null)}
                className="text-xs font-semibold bg-danger-light border border-danger-light text-danger-dark px-3 py-1 rounded shadow-sm hover:bg-danger hover:text-textInverse transition cursor-pointer"
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
