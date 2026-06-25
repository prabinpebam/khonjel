// Recompute electron-updater's latest.yml after an external (post-build) code signing changed the
// installer. SignPath signs the built .exe, which alters its bytes and therefore invalidates the
// SHA-512 + size electron-builder wrote into latest.yml; the auto-updater would then reject the
// download. This rewrites those values from the signed file and drops the now-stale block map so
// updates fall back to a full, hash-verified download.
//
// Usage:  node scripts/resign-update-metadata.mjs <release-dir> <installer-filename>
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";

const [, , releaseDir, installer] = process.argv;
if (!releaseDir || !installer) {
  console.error("usage: resign-update-metadata.mjs <release-dir> <installer-filename>");
  process.exit(1);
}

const installerPath = join(releaseDir, installer);
const ymlPath = join(releaseDir, "latest.yml");

const sha512 = createHash("sha512").update(readFileSync(installerPath)).digest("base64");
const size = statSync(installerPath).size;

let yml = readFileSync(ymlPath, "utf8");
// latest.yml repeats the same sha512 at the file entry and the top level (single-file installer);
// replace every occurrence of the old hash with the new one.
const oldSha = yml.match(/^sha512:\s*(.+)$/m)?.[1]?.trim();
if (oldSha && oldSha !== sha512) yml = yml.split(oldSha).join(sha512);
// Update the file size (the single `size:` under `files:`).
yml = yml.replace(/^(\s*size:\s*)\d+\s*$/m, `$1${size}`);
// Drop any block-map reference; the stale .blockmap is deleted below.
yml = yml.replace(/^\s*blockMapSize:.*\n/m, "");
writeFileSync(ymlPath, yml);

const blockmap = `${installerPath}.blockmap`;
if (existsSync(blockmap)) rmSync(blockmap);

console.log(`resigned latest.yml -> ${installer}: sha512=${sha512.slice(0, 16)}... size=${size}`);
