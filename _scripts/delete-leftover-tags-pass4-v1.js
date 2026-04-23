#!/usr/bin/env node

/**
 * delete-leftover-tags-pass4-v1.js
 *
 * Purpose:
 * - Remove specific unwanted leftover tags from song frontmatter `tags`
 * - Preserve everything else
 * - Read from songs_taxonomy_normalized_v3
 * - Write to a new output folder
 *
 * Usage:
 *   node delete-leftover-tags-pass4-v1.js ../songs_taxonomy_normalized_v3
 *   node delete-leftover-tags-pass4-v1.js ../songs_taxonomy_normalized_v3 --apply --out ../songs_taxonomy_normalized_v4
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
    : path.join(process.cwd(), "songs_taxonomy_normalized_v4");

if (!inputDir) {
  console.error(
    "Usage: node delete-leftover-tags-pass4-v1.js /path/to/input [--apply] [--out /path/to/output]"
  );
  process.exit(1);
}

const resolvedInputDir = path.resolve(inputDir);

if (!fs.existsSync(resolvedInputDir)) {
  console.error(`Input folder not found: ${resolvedInputDir}`);
  process.exit(1);
}

const TAGS_TO_DELETE = new Set([
  "ccli",
  "classic",
  "songbook",
  "my-edit",
  "teaching",
  "image",
  "baby",
  "teach",
  "contemporary-christian-slow",
  "stl",
  "touching",
  "andante",
  "anointed",
  "mod-apo"
]);

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
    return value
      .map((v) => String(v).trim())
      .filter(Boolean);
  }
  if (value === null || value === undefined || value === "") return [];
  return [String(value).trim()].filter(Boolean);
}

function unique(arr) {
  return [...new Set(arr)];
}

function normalizeToken(text) {
  return String(text)
    .toLowerCase()
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function ensureParentDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function buildOrderedData(oldData, cleanedTags) {
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
    source: ensureArray(oldData.source),
    tags: cleanedTags,
    genre: ensureArray(oldData.genre),
    profile: ensureArray(oldData.profile),
    keywords: oldData.keywords ?? "",
    ccli: oldData.ccli ?? "",
    copyright: oldData.copyright ?? "",
    year: oldData.year ?? "",
    medley: ensureArray(oldData.medley),
    id: oldData.id ?? "",
  };
}

function processFile(fullPath) {
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
  const oldTags = ensureArray(oldData.tags);
  const cleanedTags = [];
  const removed = [];

  for (const tag of oldTags) {
    const normalized = normalizeToken(tag);
    if (TAGS_TO_DELETE.has(normalized)) {
      removed.push(normalized);
    } else {
      cleanedTags.push(tag);
    }
  }

  const finalTags = unique(cleanedTags);
  const newData = buildOrderedData(oldData, finalTags);

  const newRaw = matter.stringify(body.replace(/^\n+/, ""), newData, {
    lineWidth: 0,
    quotes: true,
  });

  return {
    status: "OK",
    file: fullPath,
    newRaw,
    removed: unique(removed),
    remainingTags: finalTags
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
let changedCount = 0;
let removedTagCount = 0;

for (const fullPath of allFiles) {
  const result = processFile(fullPath);

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

  if (result.removed.length) {
    changedCount++;
    removedTagCount += result.removed.length;
    for (const tag of result.removed) {
      report.push(`  - removed tag "${tag}"`);
    }
  } else {
    report.push(`  - no listed leftover tags found`);
  }

  if (APPLY) {
    const outPath = path.join(outputDir, relative);
    ensureParentDir(outPath);
    fs.writeFileSync(outPath, result.newRaw, "utf8");
  }
}

report.push("");
report.push("============================================================");
report.push(`Scanned          : ${allFiles.length}`);
report.push(`OK               : ${okCount}`);
report.push(`Skipped          : ${skipCount}`);
report.push(`Errors           : ${errorCount}`);
report.push(`Changed files    : ${changedCount}`);
report.push(`Removed tag hits : ${removedTagCount}`);
report.push(`Mode             : ${APPLY ? "APPLY" : "DRY RUN"}`);
if (APPLY) {
  report.push(`Output           : ${outputDir}`);
}
report.push("============================================================");

const reportText = report.join("\n");
console.log(reportText);

const reportPath = APPLY
  ? path.join(outputDir, "_delete_leftover_tags_pass4_v1_report.txt")
  : path.join(process.cwd(), "_delete_leftover_tags_pass4_v1_report_dryrun.txt");

try {
  fs.writeFileSync(reportPath, reportText + "\n", "utf8");
  console.log(`\nReport saved to: ${reportPath}`);
} catch (err) {
  console.warn(`\nCould not save report: ${err.message}`);
}