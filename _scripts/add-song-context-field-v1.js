#!/usr/bin/env node

/**
 * add-song-context-field-v1.js
 *
 * Adds `context: []` to song frontmatter.
 *
 * Expected input schema already includes:
 * - function
 * - style
 * - tradition
 * - use
 *
 * This script inserts:
 * - context: []
 *
 * Order:
 * tempo
 * feel
 * theme
 * function
 * context
 * style
 * tradition
 * use
 *
 * Usage:
 *   node add-song-context-field-v1.js ../songs_with_category_fields_v1
 *   node add-song-context-field-v1.js ../songs_with_category_fields_v1 --apply --out ../songs_with_category_fields_v2
 */

const fs = require("fs");
const path = require("path");
const matter = require("gray-matter");

const inputDir = process.argv[2];
const APPLY = process.argv.includes("--apply");

const outIndex = process.argv.indexOf("--out");
const outputDir =
  outIndex >= 0 && process.argv[outIndex + 1]
    ? path.resolve(process.argv[outIndex + 1])
    : path.join(process.cwd(), "songs_with_category_fields_v2");

if (!inputDir) {
  console.error(
    "Usage: node add-song-context-field-v1.js /path/to/input [--apply] [--out /path/to/output]"
  );
  process.exit(1);
}

const resolvedInputDir = path.resolve(inputDir);

if (!fs.existsSync(resolvedInputDir)) {
  console.error(`Input folder not found: ${resolvedInputDir}`);
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

function ensureArray(value) {
  if (Array.isArray(value)) {
    return value.filter(
      (v) => v !== null && v !== undefined && String(v).trim() !== ""
    );
  }
  if (value === null || value === undefined || value === "") return [];
  return [String(value)];
}

function buildOrderedData(oldData) {
  return {
    title: oldData.title ?? "",
    artist: oldData.artist ?? "",
    key: oldData.key ?? "",
    bpm: oldData.bpm ?? "",
    time_sig: oldData.time_sig ?? "",
    meter: oldData.meter ?? "",
    tempo: oldData.tempo ?? "",
    feel: ensureArray(oldData.feel),
    theme: ensureArray(oldData.theme),
    function: ensureArray(oldData.function),
    context: ensureArray(oldData.context),
    style: ensureArray(oldData.style),
    tradition: ensureArray(oldData.tradition),
    use: ensureArray(oldData.use),
    tags: ensureArray(oldData.tags),
    genre: ensureArray(oldData.genre),
    profile: ensureArray(oldData.profile),
    keywords: oldData.keywords ?? "",
    ccli: oldData.ccli ?? "",
    copyright: oldData.copyright ?? "",
    source: oldData.source ?? "",
    year: oldData.year ?? "",
    medley: ensureArray(oldData.medley),
    id: oldData.id ?? "",
  };
}

function ensureParentDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function migrateFile(fullPath) {
  let raw;
  try {
    raw = fs.readFileSync(fullPath, "utf8");
  } catch (err) {
    return { status: "ERROR", file: fullPath, reason: `Read failed: ${err.message}` };
  }

  if (!raw.startsWith("---")) {
    return { status: "SKIP", file: fullPath, reason: "No frontmatter" };
  }

  let parsed;
  try {
    parsed = matter(raw);
  } catch (err) {
    return {
      status: "ERROR",
      file: fullPath,
      reason: `Frontmatter parse failed: ${err.message}`,
    };
  }

  const oldData = parsed.data || {};
  const body = parsed.content || "";
  const changes = [];

  if (!Object.prototype.hasOwnProperty.call(oldData, "context")) {
    changes.push("added context as empty array");
  } else {
    changes.push("context already present");
  }

  const ordered = buildOrderedData(oldData);

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

const allFiles = collectMdFiles(resolvedInputDir).sort();
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
  const relative = path.relative(resolvedInputDir, fullPath);

  report.push(`OK: ${relative}`);
  for (const change of result.changes) {
    report.push(`  - ${change}`);
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
  ? path.join(outputDir, "_add_song_context_field_report.txt")
  : path.join(process.cwd(), "_add_song_context_field_report_dryrun.txt");

try {
  fs.writeFileSync(reportPath, reportText, "utf8");
  console.log(`\nReport saved to: ${reportPath}`);
} catch (err) {
  console.warn(`\nCould not save report: ${err.message}`);
}