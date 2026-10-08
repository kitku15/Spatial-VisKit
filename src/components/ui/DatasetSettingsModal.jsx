import { useState, useEffect } from "react";

export default function DatasetSettingsModal({
  isOpen,
  onClose,
  datasetConfig,
  allColumns,
}) {
  const [formData, setFormData] = useState({});

  useEffect(() => {
    if (datasetConfig && isOpen) {
      // eslint-disable-next-line
      setFormData({
        slide_col: datasetConfig.slide_col || "",
        sample_col: datasetConfig.sample_col || "",
        spatial_key: datasetConfig.spatial_key || "",
        vitessce_dot_size: datasetConfig.vitessce_dot_size || 2,
        primary_annotation: datasetConfig.primary_annotation || "",
      });
    }
  }, [datasetConfig, isOpen]);

  if (!isOpen) return null;

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleApply = () => {
    const overrides = {};
    Object.keys(formData).forEach((k) => {
      if (formData[k] !== datasetConfig[k]) overrides[k] = formData[k];
    });

    const params = new URLSearchParams(window.location.search);

    // If there are overrides, encode them. If empty, remove the config param.
    if (Object.keys(overrides).length > 0) {
      const currentConfig = params.get("config")
        ? JSON.parse(atob(params.get("config")))
        : {};
      const mergedConfig = { ...currentConfig, ...overrides };
      params.set("config", btoa(JSON.stringify(mergedConfig)));
    }

    // Update the URL and trigger a reload to apply safely
    window.location.search = params.toString();
  };

  const handleDownload = () => {
    const fullConfig = { ...datasetConfig, ...formData };
    const blob = new Blob([JSON.stringify(fullConfig, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "dataset_config.json";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const categoricalColumns = allColumns.filter((c) => !c.startsWith("_"));

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-paper border border-stroke rounded shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center p-4 border-b border-stroke">
          <h2 className="text-lg font-bold text-label">
            ⚙️ Dataset Configuration
          </h2>
          <button
            onClick={onClose}
            className="text-selpanel hover:text-danger font-bold text-xl leading-none"
          >
            &times;
          </button>
        </div>

        <div className="p-6 flex-1 overflow-y-auto flex flex-col gap-5 text-sm">
          <p className="text-selpanel text-xs mb-2">
            These settings override your cloud configuration temporarily. To
            make them permanent for all users, download the file and replace it
            in your bucket.
          </p>

          <label className="flex flex-col gap-1">
            <span className="font-bold text-label">Vitessce Dot Size</span>
            <input
              type="number"
              step="0.5"
              className="border border-stroke rounded p-2 bg-background outline-none focus:border-primary"
              value={formData.vitessce_dot_size || 2}
              onChange={(e) =>
                handleChange("vitessce_dot_size", parseFloat(e.target.value))
              }
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="font-bold text-label">
              Spatial Coordinates Key (obsm)
            </span>
            <input
              type="text"
              className="border border-stroke rounded p-2 bg-background outline-none focus:border-primary"
              value={formData.spatial_key || ""}
              onChange={(e) => handleChange("spatial_key", e.target.value)}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="font-bold text-label">Slide Column</span>
            <select
              className="border border-stroke rounded p-2 bg-background outline-none focus:border-primary"
              value={formData.slide_col}
              onChange={(e) => handleChange("slide_col", e.target.value)}
            >
              <option value="">-- None --</option>
              {categoricalColumns.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="font-bold text-label">Sample Column</span>
            <select
              className="border border-stroke rounded p-2 bg-background outline-none focus:border-primary"
              value={formData.sample_col}
              onChange={(e) => handleChange("sample_col", e.target.value)}
            >
              <option value="">-- None --</option>
              {categoricalColumns.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="p-4 border-t border-stroke bg-background flex justify-between gap-3">
          <button
            onClick={handleDownload}
            className="px-4 py-2 text-primary font-bold border border-primary rounded hover:bg-primary hover:text-white transition-colors"
          >
            ↓ Download JSON
          </button>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-selpanel hover:text-label transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              className="px-6 py-2 bg-primary text-white font-bold rounded hover:opacity-90 transition-opacity shadow-sm"
            >
              Apply to URL
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
