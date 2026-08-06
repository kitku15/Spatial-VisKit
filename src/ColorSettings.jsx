import React, { useState, useEffect, useMemo } from "react";
import { DATA_DIR, largeColorPalette } from "./config";

// Maximum number of unique categories to render color pickers for.
// Anything above this is likely continuous data or cell barcodes.
const MAX_CATEGORIES_LIMIT = 100; 

export default function ColorSettings({ customColors, setCustomColors }) {
  const [obsData, setObsData] = useState(null);
  const [availableCols, setAvailableCols] = useState([]);
  const [selectedCol, setSelectedCol] = useState("");

  useEffect(() => {
    fetch(`/${DATA_DIR}/cell_clusters.json`)
      .then((res) => res.json())
      .then((data) => {
        setObsData(data);
        const cols = Object.keys(data).sort();
        setAvailableCols(cols);
        if (cols.length > 0) setSelectedCol(cols[0]);
      })
      .catch((err) => console.error("Could not load cell_clusters.json", err));
  }, []);

  const uniqueLabels = useMemo(() => {
    if (!obsData || !selectedCol) return [];
    const labels = Array.from(new Set(obsData[selectedCol]))
      .filter((val) => val && val !== "nan" && val !== "None")
      .sort();
      
    return labels;
  }, [obsData, selectedCol]);

  // Check if we hit the memory-crashing threshold
  const isTooManyCategories = uniqueLabels.length > MAX_CATEGORIES_LIMIT;

  const handleColorChange = (label, newColor) => {
    setCustomColors((prev) => ({ ...prev, [label]: newColor }));
  };

  const handleReset = () => {
    if (isTooManyCategories) return;
    const newColors = { ...customColors };
    uniqueLabels.forEach((label) => delete newColors[label]);
    setCustomColors(newColors);
  };

  return (
    <div className="p-6 flex flex-col gap-6 h-full bg-app overflow-y-auto">
      <div className="bg-panel p-4 border border-borderLight shadow-sm rounded flex justify-between items-center">
        <label className="text-sm font-semibold flex flex-col gap-1">
          <span className="text-textMuted uppercase tracking-wide text-xs">
            Select Category to Color
          </span>
          <select
            className="border border-borderMain p-2 rounded outline-none w-64 bg-panel text-textMain focus:border-primary"
            value={selectedCol}
            onChange={(e) => setSelectedCol(e.target.value)}
          >
            {availableCols.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        <button
          onClick={handleReset}
          disabled={isTooManyCategories}
          className="bg-danger-light text-danger-dark border border-danger px-4 py-2 rounded text-sm font-bold shadow-sm hover:bg-danger hover:text-textInverse transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Reset {selectedCol} to Defaults
        </button>
      </div>

      <div className="bg-panel p-6 border border-borderLight shadow-sm rounded flex-1">
        <h3 className="font-bold text-lg mb-4 text-textMain">
          Customize Palette
        </h3>

        {/* Safety UI Check */}
        {isTooManyCategories ? (
          <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-danger-light bg-danger-light/10 rounded">
            <span className="text-danger-dark font-bold text-lg mb-2">
              ⚠️ Too Many Unique Values ({uniqueLabels.length})
            </span>
            <p className="text-textMuted text-center max-w-md">
              The category <b>"{selectedCol}"</b> contains too many unique values to render as distinct colors. It is likely a continuous variable (like gene expression) or unique identifiers (like cell barcodes).
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {uniqueLabels.map((label, i) => {
              const defaultColor = largeColorPalette[i % largeColorPalette.length];
              const currentColor = customColors[label] || defaultColor;

              return (
                <div
                  key={label}
                  className="flex items-center gap-3 p-2 border border-borderLight rounded bg-app shadow-sm"
                >
                  <input
                    type="color"
                    value={currentColor}
                    onChange={(e) => handleColorChange(label, e.target.value)}
                    className="w-8 h-8 cursor-pointer rounded border-none bg-transparent"
                  />
                  <span
                    className="text-sm font-semibold text-textMain truncate"
                    title={label}
                  >
                    {label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}