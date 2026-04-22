#!/usr/bin/env node

/**
 * append-song-sets-dataview-v1.js
 *
 * Appends a standard "sets using this song" Dataview block
 * to the bottom of every song note in the songs/ folder.
 *
 * Rules:
 * - Only touches .md files
 * - Skips files that already contain the exact Dataview query
 * - Preserves existing content
 * - Dry run by default
 * - In apply mode, edits files in place
 *
 * Usage:
 *   node append-song-sets-dataview-v1.js ../songs
 *   node append-song-sets-dataview-v1.js ../songs --apply
 */

const fs = require("fs");
const path = require("path");

const inputDir = process.argv[2];
const APPLY = process.argv.includes("--apply");

if (!inputDir) {
  console.error("Usage: node append-song-sets-dataview-v1.js /path/to/songs [--apply]");
  process.exit(1);
}

const resolvedInputDir = path.resolve(inputDir);

if (!fs.existsSync(resolvedInputDir)) {
  console.error(`Songs folder not found: ${resolvedInputDir}`);
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

const QUERY_INNER = [
  "TABLE WITHOUT ID file.link AS set, date, service",
  'FROM "sets"',
  "WHERE contains(string(songs), this.file.name)",
  "SORT date DESC",
].join("\n");

const DATAVIEW_BLOCK = [
  "## Sets Using This Song",
  "",
  "```dataview",
  QUERY_INNER,
  "```",
  "",
].join("\n");

function normalizeLineEndings(text) {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function hasDataviewBlock(content) {
  const normalized = normalizeLineEndings(content);
  return normalized.includes(QUERY_INNER);
}

function appendBlock(content) {
  const normalized = normalizeLineEndings(content).replace(/\s+$/, "");
  return normalized + "\n\n" + DATAVIEW_BLOCK;
}

const files = collectMdFiles(resolvedInputDir).sort();

let okCount = 0;
let skipCount = 0;
let errorCount = 0;

const report = [];

for (const filePath of files) {
  let raw;
  try {
    raw = fs.readFileSync(filePath, "utf8");
  } catch (err) {
    errorCount++;
    report.push(`ERROR: ${filePath}`);
    report.push(`  Read failed: ${err.message}`);
    continue;
  }

  const relative = path.relative(resolvedInputDir, filePath);

  if (hasDataviewBlock(raw)) {
    skipCount++;
    report.push(`SKIP: ${relative}`);
    report.push(`  Dataview block already present`);
    continue;
  }

  const updated = appendBlock(raw);

  if (APPLY) {
    try {
      fs.writeFileSync(filePath, updated, "utf8");
    } catch (err) {
      errorCount++;
      report.push(`ERROR: ${relative}`);
      report.push(`  Write failed: ${err.message}`);
      continue;
    }
  }

  okCount++;
  report.push(`OK: ${relative}`);
  report.push(`  Appended sets Dataview block`);
}

report.push("");
report.push("============================================================");
report.push(`Scanned : ${files.length}`);
report.push(`OK      : ${okCount}`);
report.push(`Skipped : ${skipCount}`);
report.push(`Errors  : ${errorCount}`);
report.push(`Mode    : ${APPLY ? "APPLY" : "DRY RUN"}`);
report.push("============================================================");

const reportText = report.join("\n");
console.log(reportText);

const reportPath = path.join(
  process.cwd(),
  APPLY ? "_append_song_sets_dataview_report.txt" : "_append_song_sets_dataview_report_dryrun.txt"
);

try {
  fs.writeFileSync(reportPath, reportText + "\n", "utf8");
  console.log(`\nReport saved to: ${reportPath}`);
} catch (err) {
  console.warn(`\nCould not save report: ${err.message}`);
}