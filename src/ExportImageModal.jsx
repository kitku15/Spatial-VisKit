import { useState, useEffect } from "react";

export default function ExportImageModal({ 
  isOpen, 
  onClose, 
  onExport, 
  defaultFilename, 
  defaultBg = "#ffffff",
  allowLegend = true
}) {
  const [filename, setFilename] = useState(defaultFilename);
  const [scale, setScale] = useState(2);
  const [bgColor, setBgColor] = useState(defaultBg);
  const [includeLegend, setIncludeLegend] = useState(true);

  // Reset states when opened with a new target
  useEffect(() => {
    if (isOpen) {
      setFilename(defaultFilename);
      setBgColor(defaultBg);
    }
  }, [isOpen, defaultFilename, defaultBg]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4">
      <div className="bg-panel rounded-lg shadow-xl border border-borderMain w-full max-w-md flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="bg-app border-b border-borderLight px-4 py-3 flex justify-between items-center">
          <h2 className="font-bold text-lg text-textMain">Export Image Settings</h2>
          <button onClick={onClose} className="text-textMuted hover:text-danger">
            ✕
          </button>
        </div>
        
        <div className="p-5 flex flex-col gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-semibold text-textMain">Filename</span>
            <input 
              type="text" 
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              className="border border-borderMain rounded p-2 text-sm outline-none focus:border-primary bg-app"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-semibold text-textMain">Resolution Multiplier</span>
            <select 
              value={scale} 
              onChange={(e) => setScale(Number(e.target.value))}
              className="border border-borderMain rounded p-2 text-sm outline-none focus:border-primary bg-app"
            >
              <option value={1}>Standard (1x)</option>
              <option value={2}>High Quality (2x)</option>
              <option value={3}>Ultra Quality (3x)</option>
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-semibold text-textMain">Background Color</span>
            <select 
              value={bgColor} 
              onChange={(e) => setBgColor(e.target.value)}
              className="border border-borderMain rounded p-2 text-sm outline-none focus:border-primary bg-app"
            >
              <option value="#ffffff">White</option>
              <option value="#000000">Black</option>
              <option value="transparent">Transparent</option>
            </select>
          </label>

          {allowLegend && (
            <label className="flex items-center gap-2 cursor-pointer mt-1">
              <input 
                type="checkbox" 
                checked={includeLegend}
                onChange={(e) => setIncludeLegend(e.target.checked)}
                className="w-4 h-4 accent-primary cursor-pointer"
              />
              <span className="text-sm font-semibold text-textMain">Append Legend to Image</span>
            </label>
          )}
        </div>

        <div className="bg-app border-t border-borderLight px-4 py-3 flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 rounded text-sm font-semibold text-textMuted hover:bg-borderLight transition"
          >
            Cancel
          </button>
          <button 
            onClick={() => onExport({ filename, scale, bgColor, includeLegend })}
            className="px-4 py-2 rounded text-sm font-bold bg-primary text-textInverse hover:bg-primary-dark shadow-sm transition"
          >
            Download Image
          </button>
        </div>
      </div>
    </div>
  );
}