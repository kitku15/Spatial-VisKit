import { useState, useEffect } from "react";
import { API_BASE_URL } from "../config/config";
import SearchableStringSelect from "../components/ui/SearchableStringSelect";
import { parseVitessceCsv } from "../utils/exportUtils";

export default function DataExport() {
  const [metadataMap, setMetadataMap] = useState({});
  const [availableGenes, setAvailableGenes] = useState([]);

  const [filters, setFilters] = useState([]);
  const [selectedGenes, setSelectedGenes] = useState([]);
  const [selectedColumns, setSelectedColumns] = useState([]);
  const [bulkGeneInput, setBulkGeneInput] = useState("");
  const [lassoCells, setLassoCells] = useState([]);

  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE_URL}/api/obs`).then((res) =>
        res.ok ? res.json() : Promise.reject(res),
      ),
      fetch(`${API_BASE_URL}/api/genes`).then((res) =>
        res.ok ? res.json() : Promise.reject(res),
      ),
    ])
      .then(([obsData, genesData]) => {
        setMetadataMap(obsData);
        // By default, select all available metadata columns
        setSelectedColumns(Object.keys(obsData).sort());
        setAvailableGenes(genesData.map((g) => g.original));
      })
      .catch((err) => console.error("Failed to load export metadata:", err));
  }, []);

  const columns = Object.keys(metadataMap).sort();

  const addFilter = () => {
    if (columns.length === 0) return;
    setFilters([
      ...filters,
      { column: columns[0], value: metadataMap[columns[0]]?.[0] || "" },
    ]);
  };

  const updateFilter = (index, field, val) => {
    const newFilters = [...filters];
    newFilters[index][field] = val;
    // Auto-update value if column changes to prevent invalid states
    if (field === "column")
      newFilters[index].value = metadataMap[val]?.[0] || "";
    setFilters(newFilters);
  };

  const removeFilter = (index) =>
    setFilters(filters.filter((_, i) => i !== index));

  const addGene = (gene) => {
    if (!selectedGenes.includes(gene))
      setSelectedGenes([...selectedGenes, gene]);
  };
  const removeGene = (gene) =>
    setSelectedGenes(selectedGenes.filter((g) => g !== gene));

  const handleBulkGenes = () => {
    // Split by comma, newline, or tab
    const parsed = bulkGeneInput
      .split(/[\n,\t]+/)
      .map((g) => g.trim())
      .filter(Boolean);
    const validGenes = parsed.filter(
      (g) => availableGenes.includes(g) && !selectedGenes.includes(g),
    );

    if (validGenes.length > 0) {
      setSelectedGenes((prev) => [...prev, ...validGenes]);
    }

    const invalidCount = parsed.length - validGenes.length;
    if (invalidCount > 0) {
      alert(
        `Added ${validGenes.length} genes.\nSkipped ${invalidCount} (invalid or already added).`,
      );
    }
    setBulkGeneInput("");
  };

  const toggleColumn = (col) => {
    if (selectedColumns.includes(col)) {
      setSelectedColumns(selectedColumns.filter((c) => c !== col));
    } else {
      setSelectedColumns([...selectedColumns, col]);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".csv")) {
      alert("Please upload a .csv file.");
      e.target.value = null;
      return;
    }

    try {
      const uniqueCells = await parseVitessceCsv(file);
      setLassoCells(uniqueCells);
    } catch (err) {
      alert(err.message);
      console.error(err);
    } finally {
      e.target.value = null; // Reset input
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filters,
          obs_columns: selectedColumns,
          genes: selectedGenes,
          lasso_cells: lassoCells,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || "Export failed");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "spatial_export.csv";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      alert(`Export Error: ${error.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="p-6 flex gap-6 h-full bg-app overflow-y-auto">
      {/* LEFT COLUMN: Query Builder */}
      <div className="flex-1 flex flex-col gap-6">
        {/* LASSO FILTER */}
        <div className="bg-panel border border-borderLight shadow-sm rounded p-5">
          <h2 className="text-xl font-bold text-textMain mb-2">
            1. Spatial Lasso Filter (Optional)
          </h2>

          <div className="text-sm text-textMuted mb-4">
            <p className="mb-2">To export a specific spatial region:</p>
            <ol className="list-decimal pl-5 space-y-1">
              <li>
                Go to the <b>Interactive Explorer</b> and use the Lasso tool
                (dashed box).
              </li>
              <li>
                Click the <b>+</b> button in the <i>Cell Sets</i> panel to save
                your selection.
              </li>
              <li>
                Click the download icon (Cloud/Arrow) in the <i>Cell Sets</i>{" "}
                panel to export it.
              </li>
              <li>Upload that file here.</li>
            </ol>
          </div>

          {lassoCells.length > 0 ? (
            <div className="flex items-center gap-4 bg-primary-light border border-primary p-3 rounded">
              <span className="text-primary-dark font-bold text-sm">
                ✅ {lassoCells.length.toLocaleString()} cells imported
                successfully!
              </span>
              <button
                onClick={() => setLassoCells([])}
                className="ml-auto text-xs font-bold bg-panel text-danger border border-danger px-3 py-1 rounded hover:bg-danger hover:text-textInverse shadow-sm transition"
              >
                ✕ Clear Cells
              </button>
            </div>
          ) : (
            <div>
              <label className="cursor-pointer inline-block px-4 py-2 bg-primary-light text-primary-dark border border-primary rounded text-sm font-bold hover:bg-primary hover:text-textInverse transition shadow-sm">
                Upload Vitessce Export (.csv)
                <input
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </label>
            </div>
          )}
        </div>

        {/* METADATA FILTERS */}
        <div className="bg-panel border border-borderLight shadow-sm rounded p-5">
          <h2 className="text-xl font-bold text-textMain mb-2">
            2. Filter Cells (Metadata)
          </h2>
          <p className="text-sm text-textMuted mb-4">
            Add logical rules to isolate a specific niche of cells.
          </p>

          <div className="flex flex-col gap-3 mb-4">
            {filters.length === 0 && (
              <div className="text-sm italic text-textMuted p-2 bg-borderLight rounded">
                No filters applied. Exporting all cells.
              </div>
            )}

            {filters.map((f, i) => (
              <div
                key={i}
                className="flex gap-3 items-center bg-app p-2 border border-borderMain rounded"
              >
                <select
                  className="border border-borderMain p-2 rounded text-sm w-1/3 outline-none"
                  value={f.column}
                  onChange={(e) => updateFilter(i, "column", e.target.value)}
                >
                  {columns.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <span className="font-bold text-textMuted text-sm">==</span>
                <select
                  className="border border-borderMain p-2 rounded text-sm w-1/3 outline-none"
                  value={f.value}
                  onChange={(e) => updateFilter(i, "value", e.target.value)}
                >
                  {Array.from(new Set(metadataMap[f.column] || []))
                    .sort()
                    .map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                </select>
                <button
                  onClick={() => removeFilter(i)}
                  className="ml-auto text-danger hover:text-danger-dark font-bold px-2"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          <button
            onClick={addFilter}
            disabled={columns.length === 0}
            className="px-4 py-2 bg-borderLight border border-borderMain rounded text-sm font-bold text-textMain hover:bg-borderMain transition disabled:opacity-50"
          >
            + Add Filter Rule
          </button>
        </div>

        {/* METADATA COLUMNS SELECTOR */}
        <div className="bg-panel border border-borderLight shadow-sm rounded p-5">
          <div className="flex justify-between items-end mb-4">
            <div>
              <h2 className="text-xl font-bold text-textMain mb-1">
                3. Select Metadata Columns
              </h2>
              <p className="text-sm text-textMuted">
                Choose which properties (e.g. Clusters, CCC Scores, Sample ID)
                to include in the CSV.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setSelectedColumns(columns)}
                className="text-xs font-bold text-primary hover:underline"
              >
                Select All
              </button>
              <button
                onClick={() => setSelectedColumns([])}
                className="text-xs font-bold text-danger hover:underline"
              >
                Clear All
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 max-h-48 overflow-y-auto p-2 border border-borderLight bg-app rounded">
            {columns.map((col) => (
              <label
                key={col}
                className="flex items-center gap-2 cursor-pointer hover:bg-borderLight p-1 rounded transition"
              >
                <input
                  type="checkbox"
                  checked={selectedColumns.includes(col)}
                  onChange={() => toggleColumn(col)}
                  className="accent-primary cursor-pointer w-4 h-4"
                />
                <span className="text-xs text-textMain truncate" title={col}>
                  {col}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* GENE EXPRESSION */}
        <div className="bg-panel border border-borderLight shadow-sm rounded p-5 flex-1 min-h-[300px]">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-xl font-bold text-textMain mb-1">
                4. Append Gene Expression (Optional)
              </h2>
              <p className="text-sm text-textMuted">
                Include raw transcript counts as new columns in the CSV.
              </p>
            </div>
            {selectedGenes.length > 0 && (
              <button
                onClick={() => setSelectedGenes([])}
                className="text-xs font-bold bg-danger-light text-danger-dark border border-danger-light px-2 py-1 rounded hover:bg-danger hover:text-textInverse transition"
              >
                Clear All Genes
              </button>
            )}
          </div>

          <div className="flex gap-6 items-start">
            <div className="flex-1 flex flex-col gap-2">
              <SearchableStringSelect
                options={availableGenes}
                onSelect={addGene}
                placeholder="Search for a single gene..."
              />

              <div className="text-center text-xs font-bold text-textMuted uppercase my-1">
                - OR -
              </div>

              <textarea
                className="border border-borderMain rounded p-2 text-sm bg-app text-textMain outline-none focus:border-primary resize-y h-24"
                placeholder="Bulk Paste: Paste multiple genes separated by commas, spaces, or new lines..."
                value={bulkGeneInput}
                onChange={(e) => setBulkGeneInput(e.target.value)}
              ></textarea>
              <button
                onClick={handleBulkGenes}
                disabled={!bulkGeneInput.trim()}
                className="bg-borderDark text-textInverse font-bold text-sm py-2 rounded hover:bg-textMain transition disabled:opacity-50"
              >
                Add Parsed Genes
              </button>
            </div>

            <div className="flex-1 flex flex-wrap gap-2 mt-4">
              {selectedGenes.map((g) => (
                <div
                  key={g}
                  className="flex items-center gap-2 bg-primary-light border border-primary text-primary-dark px-3 py-1 rounded-full text-sm font-semibold shadow-sm"
                >
                  {g}
                  <button
                    onClick={() => removeGene(g)}
                    className="hover:text-danger"
                  >
                    ✕
                  </button>
                </div>
              ))}
              {selectedGenes.length === 0 && (
                <span className="text-sm text-textMuted italic">
                  No genes selected.
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: Summary & Download */}
      <div className="w-80 flex flex-col gap-4">
        <div className="bg-panel border border-borderLight shadow-lg rounded p-5 flex flex-col sticky top-6">
          <h2 className="text-lg font-bold text-textMain border-b border-borderLight pb-2 mb-4">
            Export Summary
          </h2>

          {lassoCells.length > 0 && (
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-bold text-textMuted uppercase tracking-wide">
                Lasso Filter:
              </span>
              <span className="text-sm font-bold text-success text-right">
                Active
                <br />({lassoCells.length} cells)
              </span>
            </div>
          )}

          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-bold text-textMuted uppercase tracking-wide">
              Metadata Filters:
            </span>
            <span className="text-sm font-bold text-primary">
              {filters.length}
            </span>
          </div>

          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-bold text-textMuted uppercase tracking-wide">
              Columns:
            </span>
            <span className="text-sm font-bold text-info">
              {selectedColumns.length}
            </span>
          </div>

          <div className="flex justify-between items-center mb-6 border-b border-borderLight pb-4">
            <span className="text-sm font-bold text-textMuted uppercase tracking-wide">
              Genes Attached:
            </span>
            <span className="text-sm font-bold text-success">
              {selectedGenes.length}
            </span>
          </div>

          <p className="text-xs text-textMuted mb-6 leading-relaxed">
            Clicking download will query the Zarr matrix and generate a CSV
            containing all spatial metadata for the filtered cells, alongside
            the requested gene expression counts.
          </p>

          <button
            onClick={handleExport}
            disabled={isExporting}
            className={`w-full py-3 rounded text-base font-bold text-textInverse shadow-md transition-colors ${
              isExporting
                ? "bg-borderDark cursor-not-allowed animate-pulse"
                : "bg-primary hover:bg-primary-dark"
            }`}
          >
            {isExporting ? "Compiling CSV..." : "Download CSV"}
          </button>
        </div>
      </div>
    </div>
  );
}
