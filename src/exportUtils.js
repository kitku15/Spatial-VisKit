// Utility to convert D3 SVGs to High-Res PNGs with Backgrounds & Legends
export function downloadSvgAsPng({
  svgNode,
  filename = "export.png",
  bgColor = "#ffffff",
  scaleMultiplier = 2,
  includeLegend = false,
  legends = [] // Array of objects: { title: "...", map: { label: color } }
}) {
  if (!svgNode) return;

  const dpr = window.devicePixelRatio || 1;
  const finalScale = dpr * scaleMultiplier;

  // Extract TRUE intrinsic dimensions from the SVG viewBox (prevents squishing)
  let width, height;
  const viewBox = svgNode.getAttribute("viewBox");
  if (viewBox) {
    const coords = viewBox.split(/[ ,]+/).map(Number);
    width = coords[2]; // width is the 3rd parameter in viewBox
    height = coords[3]; // height is the 4rd parameter
  } else {
    const rect = svgNode.getBoundingClientRect();
    width = rect.width;
    height = rect.height;
  }

  // Serialize SVG
  const serializer = new XMLSerializer();
  let svgString = serializer.serializeToString(svgNode);
  
  // Force absolute pixel dimensions on the root SVG to prevent browser distortion
  svgString = svgString.replace(/<svg([^>]*)>/, (match, attrs) => {
    // Strip out any existing relative width/height (like 100%)
    let newAttrs = attrs.replace(/\s(width|height)="[^"]*"/g, "");
    return `<svg${newAttrs} width="${width}" height="${height}">`;
  });
  if (!svgString.match(/^<svg[^>]+xmlns="http\:\/\/www\.w3\.org\/2000\/svg"/)) {
    svgString = svgString.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
  }

  // Create Image from SVG
  const img = new Image();
  const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);

  img.onload = () => {
    const lineSpacing = 26 * finalScale;
    const hasLegends = includeLegend && legends && legends.length > 0;
    const legendWidth = hasLegends ? 320 * finalScale : 0;
    
    // Calculate required height for stacked legends so they don't get cut off
    let requiredLegendHeight = 40 * finalScale; 
    if (hasLegends) {
      legends.forEach(legend => {
        requiredLegendHeight += lineSpacing * 1.5; // Title
        requiredLegendHeight += Object.keys(legend.map).length * lineSpacing; // Items
        requiredLegendHeight += lineSpacing; // Spacing between legends
      });
    }

    const canvas = document.createElement("canvas");
    canvas.width = (width * finalScale) + legendWidth;
    // Make canvas tall enough for either the plot or the full legend
    canvas.height = Math.max(height * finalScale, requiredLegendHeight);
    const ctx = canvas.getContext("2d");

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    // Draw Background
    if (bgColor === "transparent") {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    } else {
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Draw SVG
    ctx.drawImage(img, 0, 0, width * finalScale, height * finalScale);

    // Draw Legends
    if (hasLegends) {
      const legendX = (width * finalScale) + (20 * finalScale);
      let legendY = 40 * finalScale;
      const boxSize = 16 * finalScale;
      const fontSize = 14 * finalScale;
      const textColor = (bgColor === "#000000") ? "#ffffff" : "#000000";

      legends.forEach(legend => {
        ctx.font = `bold ${fontSize + (2 * finalScale)}px sans-serif`;
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
          ctx.fillText(label, legendX + boxSize + (12 * finalScale), legendY);
          legendY += lineSpacing;
        });
        
        legendY += lineSpacing; // Extra space before next legend
      });
    }

    // Export
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

// Utility to serialize and download D3 SVG elements
export function downloadSvg(svgNode, filename = "export.svg") {
  if (!svgNode) {
    alert("No SVG found to export.");
    return;
  }
  const serializer = new XMLSerializer();
  let source = serializer.serializeToString(svgNode);
  
  // Ensure the SVG namespace is present
  if (!source.match(/^<svg[^>]+xmlns="http\:\/\/www\.w3\.org\/2000\/svg"/)) {
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

// Utility to extract a specific Vitessce view by its title with advanced settings (Scale, BG, Legend)
export function downloadVitessceView({ 
  containerRef, 
  viewTitle, 
  filename = "export.png", 
  bgColor = "#ffffff", 
  scaleMultiplier = 2,
  includeLegend = false,
  legends = [] // Array of { title, map }
}) {
  if (!containerRef.current) return;
  
  const container = containerRef.current;
  
  // 1. Find the specific panel by searching for the title text
  const allTextElements = Array.from(container.querySelectorAll("span, div, h1, h2, h3"));
  const titleEl = allTextElements.find(el => el.textContent.trim() === viewTitle && el.children.length === 0);
  
  if (!titleEl) {
    alert(`Could not find view with title: "${viewTitle}"`);
    return;
  }

  // 2. Traverse up to find the container that holds the canvases
  let panel = titleEl.parentElement;
  while (panel && panel !== container && panel.querySelectorAll("canvas").length === 0) {
    panel = panel.parentElement;
  }

  if (!panel) {
    alert(`Could not find canvases for: "${viewTitle}"`);
    return;
  }

  const canvases = Array.from(panel.querySelectorAll("canvas"));
  if (canvases.length === 0) return;

  // 3. Setup high-res composite canvas
  const panelRect = panel.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const finalScale = dpr * scaleMultiplier;
  const lineSpacing = 26 * finalScale;
  const hasLegends = includeLegend && legends && legends.length > 0;

  // Calculate extra width/height needed if we are drawing stacked legends
  const legendWidth = hasLegends ? 320 * finalScale : 0;
  
  let requiredLegendHeight = 40 * finalScale; 
  if (hasLegends) {
    legends.forEach(legend => {
      requiredLegendHeight += lineSpacing * 1.5;
      requiredLegendHeight += Object.keys(legend.map).length * lineSpacing;
      requiredLegendHeight += lineSpacing;
    });
  }

  const composite = document.createElement("canvas");
  composite.width = (panelRect.width * finalScale) + legendWidth;
  composite.height = Math.max(panelRect.height * finalScale, requiredLegendHeight);
  
  const ctx = composite.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  // 4. Draw Background
  if (bgColor === "transparent") {
    ctx.clearRect(0, 0, composite.width, composite.height);
  } else {
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, composite.width, composite.height);
  }

  // 5. Draw WebGL Canvases
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
      console.warn(`Could not draw canvas layer for ${viewTitle}:`, e);
    }
  });

  // 6. Draw Custom Legends using Canvas 2D API (if requested)
  if (hasLegends) {
    const legendX = (panelRect.width * finalScale) + (20 * finalScale);
    let legendY = 40 * finalScale;
    const boxSize = 16 * finalScale;
    const fontSize = 14 * finalScale;
    const textColor = (bgColor === "#000000") ? "#ffffff" : "#000000";

    legends.forEach(legend => {
      ctx.font = `bold ${fontSize + (2 * finalScale)}px sans-serif`;
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
        ctx.fillText(label, legendX + boxSize + (12 * finalScale), legendY);
        legendY += lineSpacing;
      });
      
      legendY += lineSpacing; // Space between legends
    });
  }

  // 7. Trigger download
  const link = document.createElement("a");
  // Ensure filename ends in .png
  link.download = filename.endsWith(".png") ? filename : `${filename}.png`;
  link.href = composite.toDataURL("image/png", 1.0);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}