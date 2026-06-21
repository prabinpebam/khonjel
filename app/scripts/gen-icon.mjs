#!/usr/bin/env node
/**
 * Generates the Electron app icon (build/icon.png) from the brand mark.
 * Composes a rounded gradient tile with the mark in white, rasterized at 1024px.
 * electron-builder auto-detects build/icon.png and derives the platform icons.
 */
import { Resvg } from "@resvg/resvg-js";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const markSvg = readFileSync(join(root, "src/assets/brand/khonjel-mark.svg"), "utf8");

// Strip the outer <svg> wrapper and recolor the mark white for the tile.
const inner = markSvg
  .replace(/^[\s\S]*?<svg[^>]*>/, "")
  .replace(/<\/svg>\s*$/, "")
  .replace(/fill="(?:currentColor|black)"/g, 'fill="#ffffff"');

const icon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1024" height="1024">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#6c5ce7"/>
      <stop offset="1" stop-color="#e0478c"/>
    </linearGradient>
  </defs>
  <rect width="24" height="24" rx="5.2" fill="url(#g)"/>
  <g transform="translate(4.2 4.2) scale(0.65)">${inner}</g>
</svg>`;

const png = new Resvg(icon, { fitTo: { mode: "width", value: 1024 } }).render().asPng();
mkdirSync(join(root, "build"), { recursive: true });
writeFileSync(join(root, "build/icon.png"), png);
console.log("Wrote build/icon.png (1024x1024).");
