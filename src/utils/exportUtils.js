// ./exportUtils.js

// Utility to convert D3 SVGs to High-Res PNGs with Backgrounds & Legends
export function downloadSvgAsPng({
  svgNode,
  filename = "export.png",
  bgColor = "#ffffff",
  scaleMultiplier = 2,
  includeLegend = false,
  legends = [],
}) {
  if (!svgNode) return;

  const dpr = window.devicePixelRatio || 1;
  const finalScale = dpr * scaleMultiplier;

  let width, height;
  const viewBox = svgNode.getAttribute("viewBox");
  if (viewBox) {
    const coords = viewBox.split(/[ ,]+/).map(Number);
    width = coords[2];
    height = coords[3];
  } else {
    const rect = svgNode.getBoundingClientRect();
    width = rect.width;
    height = rect.height;
  }

  const serializer = new XMLSerializer();
  let svgString = serializer.serializeToString(svgNode);

  svgString = svgString.replace(/<svg([^>]*)>/, (match, attrs) => {
    let newAttrs = attrs.replace(/\s(width|height)="[^"]*"/g, "");
    return `<svg${newAttrs} width="${width}" height="${height}">`;
  });
  if (!svgString.match(/^<svg[^>]+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/)) {
    svgString = svgString.replace(
      /^<svg/,
      '<svg xmlns="http://www.w3.org/2000/svg"',
    );
  }

  const img = new Image();
  const svgBlob = new Blob([svgString], {
    type: "image/svg+xml;charset=utf-8",
  });
  const url = URL.createObjectURL(svgBlob);

  img.onload = () => {
    const lineSpacing = 26 * finalScale;
    const hasLegends = includeLegend && legends && legends.length > 0;
    const legendWidth = hasLegends ? 320 * finalScale : 0;

    let requiredLegendHeight = 40 * finalScale;
    if (hasLegends) {
      legends.forEach((legend) => {
        requiredLegendHeight += lineSpacing * 1.5;
        requiredLegendHeight += Object.keys(legend.map).length * lineSpacing;
        requiredLegendHeight += lineSpacing;
      });
    }

    const canvas = document.createElement("canvas");
    canvas.width = width * finalScale + legendWidth;
    canvas.height = Math.max(height * finalScale, requiredLegendHeight);
    const ctx = canvas.getContext("2d");

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    if (bgColor === "transparent") {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    } else {
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    ctx.drawImage(img, 0, 0, width * finalScale, height * finalScale);

    if (hasLegends) {
      const legendX = width * finalScale + 20 * finalScale;
      let legendY = 40 * finalScale;
      const boxSize = 16 * finalScale;
      const fontSize = 14 * finalScale;
      const textColor = bgColor === "#000000" ? "#ffffff" : "#000000";

      legends.forEach((legend) => {
        ctx.font = `bold ${fontSize + 2 * finalScale}px sans-serif`;
        ctx.textBaseline = "middle";
        ctx.fillStyle = textColor;
        ctx.fillText(legend.title, legendX, legendY);

        legendY += lineSpacing * 1.5;

        ctx.font = `normal ${fontSize}px sans-serif`;
        Object.entries(legend.map).forEach(([label, color]) => {
          ctx.fillStyle = color;
          ctx.fillRect(legendX, legendY - boxSize / 2, boxSize, boxSize);
          ctx.strokeStyle = textColor;
          ctx.lineWidth = 1 * finalScale;
          ctx.strokeRect(legendX, legendY - boxSize / 2, boxSize, boxSize);
          ctx.fillStyle = textColor;
          ctx.fillText(label, legendX + boxSize + 12 * finalScale, legendY);
          legendY += lineSpacing;
        });

        legendY += lineSpacing;
      });
    }

    const link = document.createElement("a");
    link.download = filename.endsWith(".png") ? filename : `${filename}.png`;
    link.href = canvas.toDataURL("image/png", 1.0);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };
  img.src = url;
}

export function downloadSvg(svgNode, filename = "export.svg") {
  if (!svgNode) {
    alert("No SVG found to export.");
    return;
  }
  const serializer = new XMLSerializer();
  let source = serializer.serializeToString(svgNode);

  if (!source.match(/^<svg[^>]+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/)) {
    source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
  }

  const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(source);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Utility to extract a specific Vitessce view by its title with advanced settings
export function downloadVitessceView({
  containerRef,
  viewTitle,
  filename = "export.png",
  bgColor = "#ffffff",
  scaleMultiplier = 2,
  includeLegend = false,
  legends = [],
}) {
  try {
    if (!containerRef.current) return;
    const container = containerRef.current;

    const allTextElements = Array.from(
      container.querySelectorAll("span, div, h1, h2, h3"),
    );
    const titleEl = allTextElements.find(
      (el) => el.textContent.trim() === viewTitle && el.children.length === 0,
    );

    if (!titleEl) {
      alert(`Could not find view with title: "${viewTitle}"`);
      return;
    }

    let panel = titleEl.parentElement;
    while (
      panel &&
      panel !== container &&
      panel.querySelectorAll("canvas").length === 0
    ) {
      panel = panel.parentElement;
    }

    if (!panel) return alert(`Could not find canvases for: "${viewTitle}"`);

    const canvases = Array.from(panel.querySelectorAll("canvas"));
    if (canvases.length === 0)
      return alert("No canvas elements found to draw.");

    // --- DOM SCRAPING FOR CONTINUOUS LEGEND ---
    let scrapedLegend = null;
    if (includeLegend) {
      // Look inside this exact panel for the vitessce colormap image
      const colormapImg = panel.querySelector('img[alt="Colormap gradient"]');
      if (colormapImg) {
        const titleText = panel.querySelector(
          'svg text[dominant-baseline="hanging"]',
        );
        const minInput = panel.querySelector(
          'input[aria-label="Colormap minimum"]',
        );
        const maxInput = panel.querySelector(
          'input[aria-label="Colormap maximum"]',
        );

        scrapedLegend = {
          title: titleText ? titleText.textContent : "Expression",
          base64: colormapImg.src, // Grab exact gradient image off the screen
          min: minInput ? minInput.getAttribute("aria-valuetext") : "0.0", // Grab exact min
          max: maxInput ? maxInput.getAttribute("aria-valuetext") : "1.0", // Grab exact max
        };

        // If a continuous legend is on the screen, ignore categorical legends
        legends = [];
      }
    }

    const panelRect = panel.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const finalScale = dpr * scaleMultiplier;
    const lineSpacing = 26 * finalScale;

    const hasLegends = includeLegend && legends && legends.length > 0;
    const hasContinuous = includeLegend && scrapedLegend !== null;

    const legendWidth = hasLegends || hasContinuous ? 320 * finalScale : 0;

    let requiredLegendHeight = 40 * finalScale;
    if (hasLegends) {
      legends.forEach((legend) => {
        requiredLegendHeight += lineSpacing * 1.5;
        const mapKeys = Object.keys(legend.map || {});
        requiredLegendHeight += mapKeys.length * lineSpacing;
        requiredLegendHeight += lineSpacing;
      });
    }

    const composite = document.createElement("canvas");
    composite.width = panelRect.width * finalScale + legendWidth;
    composite.height = Math.max(
      panelRect.height * finalScale,
      requiredLegendHeight,
    );

    const ctx = composite.getContext("2d");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    if (bgColor === "transparent") {
      ctx.clearRect(0, 0, composite.width, composite.height);
    } else {
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, composite.width, composite.height);
    }

    canvases.forEach((canvas) => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const x = (rect.left - panelRect.left) * finalScale;
      const y = (rect.top - panelRect.top) * finalScale;
      const w = rect.width * finalScale;
      const h = rect.height * finalScale;
      try {
        ctx.drawImage(canvas, x, y, w, h);
      } catch (e) {
        console.warn("Skipped unrendered canvas layer during export.", e);
      }
    });

    const finalizeExport = (gradientImage) => {
      if (hasLegends) {
        const legendX = panelRect.width * finalScale + 20 * finalScale;
        let legendY = 40 * finalScale;
        const boxSize = 16 * finalScale;
        const fontSize = 14 * finalScale;
        const textColor = bgColor === "#000000" ? "#ffffff" : "#000000";

        legends.forEach((legend) => {
          ctx.font = `bold ${fontSize + 2 * finalScale}px sans-serif`;
          ctx.textBaseline = "middle";
          ctx.fillStyle = textColor;
          ctx.fillText(legend.title || "Legend", legendX, legendY);

          legendY += lineSpacing * 1.5;

          ctx.font = `normal ${fontSize}px sans-serif`;
          Object.entries(legend.map || {}).forEach(([label, color]) => {
            ctx.fillStyle = color;
            ctx.fillRect(legendX, legendY - boxSize / 2, boxSize, boxSize);
            ctx.strokeStyle = textColor;
            ctx.lineWidth = 1 * finalScale;
            ctx.strokeRect(legendX, legendY - boxSize / 2, boxSize, boxSize);
            ctx.fillStyle = textColor;
            ctx.fillText(label, legendX + boxSize + 12 * finalScale, legendY);
            legendY += lineSpacing;
          });
          legendY += lineSpacing;
        });
      }

      if (hasContinuous && scrapedLegend && gradientImage) {
        const legendX = panelRect.width * finalScale + 20 * finalScale;
        let legendY = 40 * finalScale;
        const fontSize = 14 * finalScale;
        const textColor = bgColor === "#000000" ? "#ffffff" : "#000000";

        ctx.font = `bold ${fontSize + 2 * finalScale}px sans-serif`;
        ctx.textBaseline = "middle";
        ctx.fillStyle = textColor;
        ctx.fillText(scrapedLegend.title, legendX, legendY);

        legendY += 30 * finalScale;

        const barWidth = 220 * finalScale;
        const barHeight = 22 * finalScale;

        // Draw the exact Base64 Image gradient from the screen!
        ctx.drawImage(gradientImage, legendX, legendY, barWidth, barHeight);

        ctx.strokeStyle = textColor;
        ctx.lineWidth = 1 * finalScale;
        ctx.strokeRect(legendX, legendY, barWidth, barHeight);

        legendY += barHeight + 15 * finalScale;
        ctx.font = `bold ${fontSize}px sans-serif`;
        ctx.fillStyle = textColor;

        ctx.fillText(scrapedLegend.min, legendX, legendY);
        const maxTextWidth = ctx.measureText(scrapedLegend.max).width;
        ctx.fillText(
          scrapedLegend.max,
          legendX + barWidth - maxTextWidth,
          legendY,
        );
      }

      const link = document.createElement("a");
      link.download = filename.endsWith(".png") ? filename : `${filename}.png`;
      link.href = composite.toDataURL("image/png", 1.0);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };

    // If we scraped an image, wait for it to load into a JS Image object, then draw
    if (hasContinuous && scrapedLegend.base64) {
      const img = new Image();
      img.onload = () => finalizeExport(img);
      img.src = scrapedLegend.base64;
    } else {
      finalizeExport(null);
    }
  } catch (error) {
    alert("An error occurred while generating the image:\n" + error.message);
  }
}

export function parseVitessceCsv(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const text = event.target.result;
        const extractedCells = [];
        const lines = text.split(/\r?\n/);

        if (lines.length > 0) {
          const headers = lines[0].split(",").map((h) =>
            h
              .replace(/^["']|["']$/g, "")
              .trim()
              .toLowerCase(),
          );
          const obsIdIdx = headers.findIndex(
            (h) => h === "obsid" || h === "cell_id" || h === "cellid",
          );

          if (obsIdIdx !== -1) {
            for (let i = 1; i < lines.length; i++) {
              if (!lines[i].trim()) continue;
              const parts = lines[i].split(",");
              if (parts.length > obsIdIdx) {
                let cellId = parts[obsIdIdx].replace(/^["']|["']$/g, "").trim();
                if (
                  cellId &&
                  cellId !== "NA" &&
                  cellId.toLowerCase() !== "null"
                ) {
                  extractedCells.push(cellId);
                }
              }
            }
          } else {
            return reject(
              new Error(
                `Could not find 'obsId' column. Found columns: ${headers.join(", ")}`,
              ),
            );
          }
        }

        const uniqueCells = Array.from(new Set(extractedCells));
        if (uniqueCells.length === 0)
          return reject(
            new Error("No valid cell IDs found in the uploaded CSV."),
          );

        resolve(uniqueCells);
      } catch {
        reject(new Error("Failed to parse CSV due to an unexpected error."));
      }
    };

    reader.onerror = () => reject(new Error("Error reading file from disk."));
    reader.readAsText(file);
  });
}
