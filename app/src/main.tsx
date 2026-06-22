import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@mock/electron-api-shim";
import "./styles/globals.css";
import { App } from "./App";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element #root not found.");
}

// The floating dictation bar runs in a transparent, frameless window. Tag the document so the base
// `body { bg-canvas }` fill is dropped for this surface only — otherwise an opaque page background
// paints behind the bar pill and defeats the window's transparency.
if (new URLSearchParams(window.location.search).get("surface") === "floating-bar") {
  document.documentElement.classList.add("surface-floating-bar");
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
