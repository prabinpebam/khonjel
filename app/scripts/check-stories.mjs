#!/usr/bin/env node
/**
 * Design-system inventory completeness (audit 3.1).
 *
 * Every shared component in src/components/{ui,common} must have a co-located
 * `*.stories.tsx`, so the Storybook inventory can't silently fall behind the library.
 * Exits non-zero with the list of components missing a story.
 */
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const DIRS = ["src/components/ui", "src/components/common"];

/** @type {string[]} */
const missing = [];
let checked = 0;

for (const dir of DIRS) {
  const files = readdirSync(join(ROOT, dir));
  const stories = new Set(files.filter((f) => f.endsWith(".stories.tsx")));
  for (const file of files) {
    // Components are .tsx; skip the story + test files and non-component .ts (e.g. *-variants.ts).
    if (!file.endsWith(".tsx")) continue;
    if (file.endsWith(".stories.tsx") || file.endsWith(".test.tsx")) continue;
    checked += 1;
    const story = file.replace(/\.tsx$/, ".stories.tsx");
    if (!stories.has(story)) missing.push(`${dir}/${file}`);
  }
}

if (missing.length > 0) {
  console.error(`stories: ${missing.length} shared component(s) have no Storybook story:`);
  for (const m of missing) {
    console.error(`  - ${m}  (add ${m.replace(/\.tsx$/, ".stories.tsx")})`);
  }
  process.exit(1);
}

console.log(`stories: OK - all ${checked} shared components have a story.`);
