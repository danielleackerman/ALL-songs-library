#!/usr/bin/env node

/**
 * migrate-frontmatter-v1.js
 *
 * Purpose:
 * - Migrate old song frontmatter to the new schema:
 *
 *   ---
 *   title: ""
 *   artist: ""
 *   key:
 *   bpm:
 *   time_sig:
 *   meter:
 *   tempo:
 *   theme: []
 *   function: []
 *   tags: []
 *   genre: []
 *   profile: []
 *   keywords:
 *   ccli:
 *   copyright:
 *   source:
 *   year:
 *   medley: []
 *   id: ""
 *   ---
 *
 * Rules:
 * - Keep profile as an array
 * - Keep keywords unchanged
 * - Rename time -> time_sig
 * - Add bpm
 * - If old tempo is numeric, move it to bpm
 * - Move old energy into tempo using cleaned tempo vocabulary
 * - Add meter as blank
 * - Add theme: []
 * - Add function: []
 * - Preserve tags, genre, ccli, copyright, source, year, medley, id
 * - Preserve body unchanged
 *
 * Usage:
 *   node migrate-frontmatter-v1.js /path/to/song/folder
 *   node migrate-frontmatter-v1.js /path/to/song/folder --apply
 *   node migrate-frontmatter-v1.js /path/to/song/folder --apply --out /path/to/output
 *
 * Notes:
 * - Dry run by default
 * - Recurses through subfolders
 * - Writes migrated files to output dir in apply mode
 * - Skips files without valid frontmatter
 */

const fs = require("fs");
const path = require("path");
const matter = require("gray-matter");

const inputDir = process.argv[2];
const APPLY = process.argv.includes("--apply");

const outIndex = process.argv.indexOf("--out");
const outputDir =
  outIndex >= 0 && process.argv[outIndex + 1]
    ? process.argv[outIndex + 1]
    : path.join(process.cwd(), "songs_migrated_v1");

if (!inputDir) {
  console.error(
    "Usage: node migrate-frontmatter-v1.js /path/to/song/folder [--apply] [--out /path/to/output]"
  );
  process.exit(1);
}

if (!fs.existsSync(inputDir)) {
  console.error(`Directory not found: ${inputDir}`);
  process.exit(1);
}

function collectMdFiles(dir, results = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectMdFiles(fullPath, results);
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
      results.push(fullPath);
    }
  }
  return results;
}

function isNumericTempo(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "string") return false;

  const trimmed = value.trim();
  if (!trimmed) return false;

  if (/^\d+(\.\d+)?$/.test(trimmed)) return true;
  if (/^\d+(\.\d+)?\s*bpm$/i.test(trimmed)) return true;

  return false;
}

function normalizeBpm(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return String(value);

  const trimmed = String(value).trim();
  const match = trimmed.match(/^(\d+(?:\.\d+)?)/);
  return match ? match[1] : "";
}

function ensureArray(value) {
  if (Array.isArray(value)) {
    return value.filter((v) => v !== null && v !== undefined && String(v).trim() !== "");
  }
  if (value === null || value === undefined || value === "") return [];
  return [String(value)];
}

function ensureScalar(value) {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) {
    if (value.length === 0) return "";
    return value.join(", ");
  }
  return value;
}

/**
 * Normalize old energy vocabulary into the new tempo vocabulary.
 * This keeps pass 1 tempo values clean and avoids carrying "energy"
 * language like "high" into the new schema.
 */
function normalizeEnergyToTempo(value) {
  if (value === null || value === undefined) return "";

  const raw = String(value).trim().toLowerCase();
  if (!raw) return "";

  const map = {
    "high": "fast",
    "medium-fast": "medium-fast",
    "medium": "medium",
    "medium-slow": "medium-slow",
    "slow": "slow",
    "medium-slow-energetic": "medium-slow",
    "medium-slow-reverential": "medium-slow"
  };

  return map[raw] || raw;
}

function migrateData(oldData) {
  const changes = [];

  const oldTempo = oldData.tempo;
  const oldTime = oldData.time;
  const oldEnergy = oldData.energy;

  const newData = {};

  newData.title = ensureScalar(oldData.title || "");
  newData.artist = ensureScalar(oldData.artist || "");
  newData.key = ensureScalar(oldData.key || "");

  let bpm = "";
  let tempo = "";

  if (isNumericTempo(oldTempo)) {
    bpm = normalizeBpm(oldTempo);
    changes.push(`moved numeric tempo "${oldTempo}" -> bpm "${bpm}"`);

    if (oldEnergy !== null && oldEnergy !== undefined && String(oldEnergy).trim() !== "") {
      const normalizedTempo = normalizeEnergyToTempo(oldEnergy);
      tempo = normalizedTempo;
      if (normalizedTempo !== String(oldEnergy).trim()) {
        changes.push(`mapped energy "${oldEnergy}" -> tempo "${normalizedTempo}"`);
      } else {
        changes.push(`moved energy "${oldEnergy}" -> tempo`);
      }
    }
  } else {
    if (oldTempo !== null && oldTempo !== undefined && String(oldTempo).trim() !== "") {
      tempo = String(oldTempo).trim();
      changes.push(`kept non-numeric tempo "${oldTempo}"`);
    } else if (oldEnergy !== null && oldEnergy !== undefined && String(oldEnergy).trim() !== "") {
      const normalizedTempo = normalizeEnergyToTempo(oldEnergy);
      tempo = normalizedTempo;
      if (normalizedTempo !== String(oldEnergy).trim()) {
        changes.push(`mapped energy "${oldEnergy}" -> tempo "${normalizedTempo}"`);
      } else {
        changes.push(`moved energy "${oldEnergy}" -> tempo`);
      }
    }
  }

  newData.bpm = bpm;
  newData.time_sig =
    oldTime !== null && oldTime !== undefined && String(oldTime).trim() !== ""
      ? String(oldTime).trim()
      : "";

  if (newData.time_sig) {
    changes.push(`renamed time "${oldTime}" -> time_sig`);
  }

  newData.meter = "";
  newData.tempo = tempo;

  newData.theme = [];
  newData.function = [];

  newData.tags = ensureArray(oldData.tags);
  newData.genre = ensureArray(oldData.genre);
  newData.profile = ensureArray(oldData.profile);
  newData.medley = ensureArray(oldData.medley);

  newData.keywords = ensureScalar(oldData.keywords);
  newData.ccli = ensureScalar(oldData.ccli);
  newData.copyright = ensureScalar(oldData.copyright);
  newData.source = ensureScalar(oldData.source);
  newData.year = ensureScalar(oldData.year);
  newData.id = ensureScalar(oldData.id || "");

  changes.push("added meter as blank");
  changes.push("added theme as empty array");
  changes.push("added function as empty array");

  if (Object.prototype.hasOwnProperty.call(oldData, "time")) {
    changes.push("removed legacy field time");
  }
  if (Object.prototype.hasOwnProperty.call(oldData, "energy")) {
    changes.push("removed legacy field energy");
  }

  return { newData, changes };
}

function buildOrderedData(migrated) {
  return {
    title: migrated.title ?? "",
    artist: migrated.artist ?? "",
    key: migrated.key ?? "",
    bpm: migrated.bpm ?? "",
    time_sig: migrated.time_sig ?? "",
    meter: migrated.meter ?? "",
    tempo: migrated.tempo ?? "",
    theme: ensureArray(migrated.theme),
    function: ensureArray(migrated.function),
    tags: ensureArray(migrated.tags),
    genre: ensureArray(migrated.genre),
    profile: ensureArray(migrated.profile),
    keywords: migrated.keywords ?? "",
    ccli: migrated.ccli ?? "",
    copyright: migrated.copyright ?? "",
    source: migrated.source ?? "",
    year: migrated.year ?? "",
    medley: ensureArray(migrated.medley),
    id: migrated.id ?? "",
  };
}

function migrateFile(fullPath) {
  let raw;
  try {
    raw = fs.readFileSync(fullPath, "utf8");
  } catch (err) {
    return { status: "ERROR", file: fullPath, reason: `Read failed: ${err.message}` };
  }

  let parsed;
  try {
    parsed = matter(raw);
  } catch (err) {
    return { status: "ERROR", file: fullPath, reason: `Frontmatter parse failed: ${err.message}` };
  }

  const hasFrontmatter = raw.startsWith("---");
  if (!hasFrontmatter) {
    return { status: "SKIP", file: fullPath, reason: "No frontmatter" };
  }

  const oldData = parsed.data || {};
  const body = parsed.content || "";

  const { newData, changes } = migrateData(oldData);
  const ordered = buildOrderedData(newData);

  const newRaw = matter.stringify(body.replace(/^\n+/, ""), ordered, {
    lineWidth: 0,
    quotes: true,
  });

  return {
    status: "OK",
    file: fullPath,
    newRaw,
    changes,
  };
}

function ensureParentDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

const allFiles = collectMdFiles(inputDir).sort();
const report = [];

if (APPLY) {
  fs.mkdirSync(outputDir, { recursive: true });
}

let okCount = 0;
let skipCount = 0;
let errorCount = 0;

for (const fullPath of allFiles) {
  const result = migrateFile(fullPath);

  if (result.status === "ERROR") {
    errorCount++;
    report.push(`ERROR: ${fullPath}`);
    report.push(`  ${result.reason}`);
    continue;
  }

  if (result.status === "SKIP") {
    skipCount++;
    report.push(`SKIP: ${fullPath}`);
    report.push(`  ${result.reason}`);
    continue;
  }

  okCount++;
  const relative = path.relative(inputDir, fullPath);

  report.push(`OK: ${relative}`);
  if (result.changes.length) {
    for (const change of result.changes) {
      report.push(`  - ${change}`);
    }
  } else {
    report.push(`  - no changes needed`);
  }

  if (APPLY) {
    const outPath = path.join(outputDir, relative);
    ensureParentDir(outPath);
    fs.writeFileSync(outPath, result.newRaw, "utf8");
  }
}

report.push("");
report.push("============================================================");
report.push(`Scanned : ${allFiles.length}`);
report.push(`OK      : ${okCount}`);
report.push(`Skipped : ${skipCount}`);
report.push(`Errors  : ${errorCount}`);
report.push(`Mode    : ${APPLY ? "APPLY" : "DRY RUN"}`);
if (APPLY) {
  report.push(`Output  : ${outputDir}`);
}
report.push("============================================================");

const reportText = report.join("\n");
console.log(reportText);

const reportPath = APPLY
  ? path.join(outputDir, "_migration_report.txt")
  : path.join(process.cwd(), "_migration_report_dryrun.txt");

try {
  fs.writeFileSync(reportPath, reportText, "utf8");
  console.log(`\nReport saved to: ${reportPath}`);
} catch (err) {
  console.warn(`\nCould not save report: ${err.message}`);
}