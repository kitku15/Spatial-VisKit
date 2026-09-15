import { useState, useEffect, useMemo, useRef } from "react";
import VitessceSpatialCCC from "./VitessceSpatialCCC";
import { API_BASE_URL, SPATIAL_CCC_PREFIXES, ZARR_PREFIX } from "./config";
import InfoModal from "./InfoModal";
import { tabInfo } from "./infoHelper";

function SearchableSelect({ options, value, onChange, placeholder }) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const wrapperRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target))
        setIsOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = options.filter((opt) =>
    opt.label.toLowerCase().includes(search.toLowerCase()),
  );
  const selectedLabel = value ? options.find((o) => o.id === value)?.label : "";

  return (
    <div ref={wrapperRef} className="relative flex-1 w-72 max-w-full">
      <div
        className="border border-primary bg-primary-light text-primary-dark p-1.5 rounded flex items-center justify-between cursor-text"
        onClick={() => setIsOpen(true)}
      >
        <input
          type="text"
          className="outline-none w-full text-sm px-1 font-bold bg-transparent placeholder-primary-dark"
          placeholder={selectedLabel || placeholder}
          value={isOpen ? search : selectedLabel || ""}
          onChange={(e) => {
            setSearch(e.target.value);
            setIsOpen(true);
          }}
        />
        <button
          className="text-primary-dark px-1 text-xs cursor-pointer hover:text-primary"
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(!isOpen);
          }}
        >
          ▼
        </button>
      </div>
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-panel border border-borderMain rounded shadow-lg max-h-64 overflow-y-auto">
          {filteredOptions.length > 0 ? (
            filteredOptions.map((opt) => (
              <div
                key={opt.id}
                className="p-2 text-sm text-textMain hover:bg-primary-light cursor-pointer border-b border-borderLight last:border-0"
                onClick={() => {
                  onChange(opt.id);
                  setSearch("");
                  setIsOpen(false);
                }}
              >
                {opt.label}
              </div>
            ))
          ) : (
            <div className="p-2 text-sm text-textMuted italic">
              No interactions found
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function SpatialCCC({ datasetConfig }) {
  const dynamicAnnotations = useMemo(
    () => datasetConfig?.dynamic_annotations || [],
    [datasetConfig],
  );
  const extraObsSets = useMemo(
    () => datasetConfig?.extra_obs_sets || [],
    [datasetConfig],
  );
  const zarrDir = `${ZARR_PREFIX}${datasetConfig?.zarr_filename}`;

  const [selectedSlide, setSelectedSlide] = useState("All");
  const [selectedSample, setSelectedSample] = useState("All");
  const [activeCategory, setActiveCategory] = useState(
    dynamicAnnotations[0]?.name || "Cell Clusters (Leiden)",
  );

  const [hierarchy, setHierarchy] = useState({});
  const [availableSlides, setAvailableSlides] = useState(["All"]);

  const [availableInteractions, setAvailableInteractions] = useState([]);
  const [selectedInteraction, setSelectedInteraction] = useState("");

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/metadata.json`)
      .then((res) => res.json())
      .then((data) => {
        setHierarchy(data.hierarchy);
        const slideKeys = Object.keys(data.hierarchy);
        setAvailableSlides(
          slideKeys.includes("All") ? slideKeys : ["All", ...slideKeys],
        );
      })
      .catch((err) => console.warn(err));
  }, []);

  const availableSamples = useMemo(() => {
    if (Object.keys(hierarchy).length === 0) return ["All"];
    if (selectedSlide === "All")
      return ["All", ...Array.from(new Set(Object.values(hierarchy).flat()))];
    return ["All", ...(hierarchy[selectedSlide] || [])];
  }, [selectedSlide, hierarchy]);

  const handleSlideChange = (e) => {
    setSelectedSlide(e.target.value);
    setSelectedSample("All");
  };

  useEffect(() => {
    if (!datasetConfig?.zarr_filename) return;
    fetch(`${API_BASE_URL}/${zarrDir}/obs/.zattrs`)
      .then((res) => res.json())
      .then((data) => {
        const columns = data["column-order"] || [];
        const interactions = columns.filter(
          (c) =>
            c.startsWith(SPATIAL_CCC_PREFIXES.LR) ||
            c.startsWith(SPATIAL_CCC_PREFIXES.CCC),
        );
        const mappedInteractions = interactions.map((intx) => ({
          id: intx,
          label: intx
            .replace(SPATIAL_CCC_PREFIXES.LR, "Pair: ")
            .replace(SPATIAL_CCC_PREFIXES.CCC, "NMF Factor: "),
        }));
        setAvailableInteractions(mappedInteractions);
        if (mappedInteractions.length > 0)
          setSelectedInteraction(mappedInteractions[0].id);
      })
      .catch((err) => console.warn(err));
  }, [datasetConfig, zarrDir]);

  const isLR = selectedInteraction.startsWith(SPATIAL_CCC_PREFIXES.LR);
  const ligand = isLR
    ? selectedInteraction.replace(SPATIAL_CCC_PREFIXES.LR, "").split("^")[0]
    : null;
  const receptor = isLR
    ? selectedInteraction.replace(SPATIAL_CCC_PREFIXES.LR, "").split("^")[1]
    : null;

  return (
    <div className="p-6 flex flex-col gap-4 h-full bg-app">
      <div className="bg-panel p-4 border border-borderLight shadow-sm rounded flex flex-wrap items-center gap-6 z-20">
        <label className="text-sm font-semibold flex flex-col">
          <span className="text-primary-dark uppercase tracking-wider text-xs mb-1">
            Spatial Interaction Target
          </span>
          <SearchableSelect
            options={availableInteractions}
            value={selectedInteraction}
            onChange={setSelectedInteraction}
            placeholder="Search interactions..."
          />
        </label>

        <div className="flex gap-4 border-l border-borderMain pl-4">
          <label className="text-sm font-semibold flex flex-col gap-1 text-textMain">
            <span className="text-textMuted uppercase tracking-wider text-xs">
              Slide
            </span>
            <select
              className="border border-borderMain rounded px-2 py-1 bg-panel font-normal outline-none focus:border-primary"
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
          <label className="text-sm font-semibold flex flex-col gap-1 text-textMain">
            <span className="text-textMuted uppercase tracking-wider text-xs">
              Sample
            </span>
            <select
              className="border border-borderMain rounded px-2 py-1 bg-panel font-normal disabled:opacity-50 outline-none focus:border-primary"
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

        <label className="text-sm font-semibold flex flex-col gap-1 border-l border-borderMain pl-4 text-textMain">
          <span className="text-textMuted uppercase tracking-wider text-xs">
            Identify Target Cell Types
          </span>
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

        <div className="ml-auto flex items-center">
          <InfoModal
            title={tabInfo.spatialCcc?.title}
            content={tabInfo.spatialCcc?.content}
          />
        </div>
      </div>

      <div className="flex gap-4 flex-1 min-h-0">
        <div className="w-full bg-panel border border-borderLight shadow-sm rounded flex flex-col overflow-hidden relative z-10">
          <div className="bg-app border-b border-borderLight px-4 py-2 flex justify-between items-center z-10">
            <h3 className="font-bold text-sm text-textMain">
              Single-Cell Spatial Interaction Map
            </h3>
            <span className="text-xs text-textMuted">
              Maps for {isLR ? "Ligand-Receptor pairs" : "NMF factors"}
            </span>
          </div>
          <div className="flex-1 relative">
            {!selectedInteraction ? (
              <div className="flex items-center justify-center h-full text-textMuted">
                No LIANA Spatial CCC data found in Zarr store.
              </div>
            ) : (
              <VitessceSpatialCCC
                selectedSlide={selectedSlide}
                selectedSample={selectedSample}
                selectedInteraction={selectedInteraction}
                ligand={ligand}
                receptor={receptor}
                datasetConfig={datasetConfig}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
