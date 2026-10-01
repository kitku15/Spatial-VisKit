import { useState, useEffect } from "react";

export function useCustomColors() {
  const [customColors, setCustomColors] = useState(() => {
    const savedColors = localStorage.getItem("app_custom_colors");
    if (savedColors) {
      try {
        return JSON.parse(savedColors);
      } catch (e) {
        console.warn("Failed to parse custom colors from local storage", e);
      }
    }
    return {};
  });

  useEffect(() => {
    localStorage.setItem("app_custom_colors", JSON.stringify(customColors));
  }, [customColors]);

  return [customColors, setCustomColors];
}
