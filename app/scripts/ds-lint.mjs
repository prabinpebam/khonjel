#!/usr/bin/env node
/**
 * Khonjel design-system lint (L1 of the eval loop).
 * Enforces the parts of the design-system discipline (P1, P5, P6, anti-patterns) that
 * ESLint cannot easily express. See:
 *   docs/product-spec/03-ux-ui/design-system/01-intent.md
 *   docs/product-spec/04-architecture-and-delivery/06-test-and-validation-strategy.md
 *
 * Scans src/ TS/TSX (NOT styles/, where token values legitimately live) for forbidden
 * patterns and exits non-zero with a file:line report if any are found.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SRC = join(ROOT, "src");
const STYLES = join(SRC, "styles");

/** @type {{ id: string, re: RegExp, msg: string }[]} */
const RULES = [
  {
    id: "arbitrary-color",
    re: /\b(?:bg|text|border|fill|stroke|ring|outline|from|via|to|decoration|caret|accent|shadow)-\[#?(?:[0-9a-fA-F]{3,8}|rgb)/,
    msg: "Arbitrary color value in a utility. Use a semantic token utility (bg-surface, text-foreground, …).",
  },
  {
    id: "hex-literal",
    re: /['"`]#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})['"`]/,
    msg: "Hex color literal. Colors live in tokens (src/styles/tokens.css), not components.",
  },
  {
    id: "rgb-literal",
    re: /\brgba?\(\s*\d/,
    msg: "rgb()/rgba() literal. Use a token or color-mix(in srgb, var(--token) N%, transparent).",
  },
  {
    id: "arbitrary-px",
    re: /\b(?:p|px|py|pt|pb|pl|pr|ps|pe|m|mx|my|mt|mb|ml|mr|ms|me|gap|gap-x|gap-y|w|h|min-w|min-h|max-w|max-h|rounded(?:-[a-z]+)?|text|leading|tracking|inset|top|bottom|left|right|start|end|size|space-x|space-y)-\[\d*\.?\d+px\]/,
    msg: "Bare px in a utility. Use the spacing/radius/type scale, or a named token var: -[var(--name)].",
  },
  {
    id: "important",
    re: /!important/,
    msg: "!important is forbidden — fix the layering instead.",
  },
  {
    id: "z-magic",
    re: /\bz-\[\d+\]/,
    msg: "Magic z-index. Use a z-scale token utility.",
  },
  {
    id: "emoji",
    // Common emoji blocks; UI uses lucide icons, never emoji.
    re: /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}\u{FE0F}\u{2705}\u{274C}\u{26A0}]/u,
    msg: "Emoji in source/UI copy. Use a lucide icon instead.",
  },
];

/** @param {string} dir @returns {string[]} */
function walk(dir) {
  /** @type {string[]} */
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (full.startsWith(STYLES)) continue; // tokens/styles may hold raw values
    const s = statSync(full);
    if (s.isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx)$/.test(name) && !name.endsWith(".d.ts")) out.push(full);
  }
  return out;
}

let violations = 0;
for (const file of walk(SRC)) {
  const lines = readFileSync(file, "utf8").split(/\r?\n/);
  lines.forEach((line, i) => {
    // allow an explicit, reviewed escape hatch
    if (line.includes("ds-lint-disable-line")) return;
    for (const rule of RULES) {
      if (rule.re.test(line)) {
        violations++;
        console.error(`${relative(ROOT, file)}:${i + 1}  [${rule.id}]  ${rule.msg}`);
        console.error(`    ${line.trim()}`);
      }
    }
  });
}

if (violations > 0) {
  console.error(`\nds-lint: ${violations} design-system violation(s). See P1-P13 in design-system/01-intent.md.`);
  process.exit(1);
}
console.log("ds-lint: clean (no design-system violations).");
