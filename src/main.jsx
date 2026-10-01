import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";

// HACK: Force all WebGL canvases to preserve their drawing buffer.
// Vitessce/Deck.gl defaults to preserveDrawingBuffer: false for performance,
// which causes canvas exports to result in blank/white PNGs.
// By intercepting canvas context creation globally, we force the pixels to stay in memory.
const originalGetContext = HTMLCanvasElement.prototype.getContext;
HTMLCanvasElement.prototype.getContext = function (type, options) {
  if (type === "webgl" || type === "webgl2") {
    options = { ...(options || {}), preserveDrawingBuffer: true };
  }
  return originalGetContext.call(this, type, options);
};

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
