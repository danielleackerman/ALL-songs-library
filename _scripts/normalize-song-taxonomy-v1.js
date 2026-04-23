#!/usr/bin/env node

/**
 * normalize-song-taxonomy-v1.js
 *
 * Purpose:
 * - Read song notes from songs_with_category_fields_v2
 * - Move known tag/profile terms into structured fields:
 *   tempo, feel, function, context, style, tradition, use
 * - Leave unmatched / theme-ish leftovers in tags
 * - Preserve profile for now
 * - Write to a new output folder
 * - Produce reports
 *
 * Usage:
 *   node normalize-song-taxonomy-v1.js ../songs_with_category_fields_v2
 *   node normalize-song-taxonomy-v1.js ../songs_with_category_fields_v2 --apply --out ../songs_taxonomy_normalized_v1
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
    : path.join(process.cwd(), "songs_taxonomy_normalized_v1");

if (!inputDir) {
  console.error(
    "Usage: node normalize-song-taxonomy-v1.js /path/to/input [--apply] [--out /path/to/output]"
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
    return value
      .map((v) => String(v).trim())
      .filter((v) => v.length > 0);
  }
  if (value === null || value === undefined || value === "") return [];
  return [String(value).trim()].filter(Boolean);
}

function unique(arr) {
  return [...new Set(arr)];
}

function slugifySpaces(text) {
  return text
    .toLowerCase()
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeToken(text) {
  return slugifySpaces(text)
    .replace(/\//g, " / ")
    .replace(/\s+/g, " ")
    .trim();
}

function addValue(obj, key, value) {
  if (!value) return;
  if (key === "tempo") {
    if (!obj[key]) obj[key] = "";
    if (!obj[key]) obj[key] = value;
    return;
  }
  if (!Array.isArray(obj[key])) obj[key] = [];
  if (!obj[key].includes(value)) obj[key].push(value);
}

function tokenizeProfile(profileArr) {
  const joined = ensureArray(profileArr)
    .join(" ")
    .toLowerCase()
    .replace(/[,_]+/g, " ")
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();

  if (!joined) return [];

  // Keep a whole-string candidate plus split pieces.
  const pieces = joined
    .split(/[-]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  return unique([joined, ...pieces]);
}

const EXACT_MAPPINGS = {
  // tempo
  "slow": [{ field: "tempo", value: "slow" }],
  "medium slow": [{ field: "tempo", value: "medium-slow" }],
  "medium-slow": [{ field: "tempo", value: "medium-slow" }],
  "medium": [{ field: "tempo", value: "medium" }],
  "medium fast": [{ field: "tempo", value: "medium-fast" }],
  "medium-fast": [{ field: "tempo", value: "medium-fast" }],
  "fast": [{ field: "tempo", value: "fast" }],
  "(medium) fast": [{ field: "tempo", value: "fast" }],

  // style
  "black gospel": [{ field: "style", value: "black-gospel" }],
  "black-gospel": [{ field: "style", value: "black-gospel" }],
  "southern gospel": [{ field: "style", value: "southern-gospel" }],
  "southern-gospel": [{ field: "style", value: "southern-gospel" }],
  "traditional gospel": [{ field: "style", value: "traditional-gospel" }],
  "traditional-gospel": [{ field: "style", value: "traditional-gospel" }],
  "ccm": [{ field: "style", value: "ccm" }],
  "ccm/gospel": [{ field: "style", value: "ccm-gospel" }],
  "ccm gospel": [{ field: "style", value: "ccm-gospel" }],
  "ccm-gospel": [{ field: "style", value: "ccm-gospel" }],
  "ccm/pop": [{ field: "style", value: "ccm-pop" }],
  "ccm pop": [{ field: "style", value: "ccm-pop" }],
  "ccm-pop": [{ field: "style", value: "ccm-pop" }],
  "maranatha": [{ field: "style", value: "maranatha" }],
  "jesus movement": [{ field: "style", value: "jesus-movement" }],
  "jesus-movement": [{ field: "style", value: "jesus-movement" }],
  "jesus movement/ccm": [
    { field: "style", value: "jesus-movement" },
    { field: "style", value: "ccm" }
  ],
  "middle eastern": [{ field: "style", value: "middle-eastern" }],
  "middle-eastern": [{ field: "style", value: "middle-eastern" }],
  "middle eastern black gospel": [
    { field: "style", value: "middle-eastern" },
    { field: "style", value: "black-gospel" }
  ],
  "bluegrass": [{ field: "style", value: "bluegrass" }],
  "black gospel opera": [{ field: "style", value: "black-gospel-opera" }],
  "black-gospel-opera": [{ field: "style", value: "black-gospel-opera" }],

  // tradition
  "traditional": [{ field: "tradition", value: "traditional" }],
  "contemporary": [{ field: "tradition", value: "contemporary" }],
  "traditional contemporary": [{ field: "tradition", value: "blended" }],
  "contemporary traditional": [{ field: "tradition", value: "blended" }],

  // use
  "congregational": [{ field: "use", value: "congregational" }],
  "choir": [{ field: "use", value: "choir" }],
  "solo": [{ field: "use", value: "solo" }],
  "chorus": [{ field: "use", value: "chorus" }],
  "choruses": [{ field: "use", value: "chorus" }],
  "choir songs": [{ field: "use", value: "choir" }],
  "songs": [],
  "song": [],

  // function
  "praise": [{ field: "function", value: "praise" }],
  "worship": [{ field: "function", value: "worship" }],
  "praise worship": [
    { field: "function", value: "praise" },
    { field: "function", value: "worship" }
  ],

  // context
  "altar songs": [{ field: "context", value: "altar" }],
  "altar": [{ field: "context", value: "altar" }],

  // feel
  "reverential": [{ field: "feel", value: "reverential" }],
  "energetic": [{ field: "feel", value: "energetic" }],
  "high energy": [{ field: "feel", value: "high-energy" }],
  "high-energy": [{ field: "feel", value: "high-energy" }],
  "shouting": [{ field: "feel", value: "shouting" }],
  "funky": [{ field: "feel", value: "funky" }],
  "cheeky": [{ field: "feel", value: "cheeky" }],
  "novel": [{ field: "feel", value: "novelty" }],
  "novelty": [{ field: "feel", value: "novelty" }],
  "novel cheeky": [
    { field: "feel", value: "novelty" },
    { field: "feel", value: "cheeky" }
  ],

  // combos from spreadsheet headers
  "reverential worship": [
    { field: "feel", value: "reverential" },
    { field: "function", value: "worship" }
  ],
  "energetic worship": [
    { field: "feel", value: "energetic" },
    { field: "function", value: "worship" }
  ],
  "energetic praise worship": [
    { field: "feel", value: "energetic" },
    { field: "function", value: "praise" },
    { field: "function", value: "worship" }
  ],
  "high energy praise worship": [
    { field: "feel", value: "high-energy" },
    { field: "function", value: "praise" },
    { field: "function", value: "worship" }
  ],
  "fast shouting": [
    { field: "tempo", value: "fast" },
    { field: "feel", value: "shouting" }
  ],
  "medium fast shouting": [
    { field: "tempo", value: "fast" },
    { field: "feel", value: "shouting" }
  ]
};

function buildOrderedData(oldData, structuredTags) {
  return {
    title: oldData.title ?? "",
    artist: oldData.artist ?? "",
    key: oldData.key ?? "",
    bpm: oldData.bpm ?? "",
    time_sig: oldData.time_sig ?? "",
    meter: oldData.meter ?? "",
    tempo: structuredTags.tempo || oldData.tempo || "",
    feel: unique([
      ...ensureArray(oldData.feel),
      ...ensureArray(structuredTags.feel)
    ]),
    theme: ensureArray(oldData.theme),
    function: unique([
      ...ensureArray(oldData.function),
      ...ensureArray(structuredTags.function)
    ]),
    context: unique([
      ...ensureArray(oldData.context),
      ...ensureArray(structuredTags.context)
    ]),
    style: unique([
      ...ensureArray(oldData.style),
      ...ensureArray(structuredTags.style)
    ]),
    tradition: unique([
      ...ensureArray(oldData.tradition),
      ...ensureArray(structuredTags.tradition)
    ]),
    use: unique([
      ...ensureArray(oldData.use),
      ...ensureArray(structuredTags.use)
    ]),
    tags: unique(structuredTags.remainingTags),
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

function normalizeSong(fullPath) {
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

  const incomingTags = ensureArray(oldData.tags).map(normalizeToken);
  const incomingProfileTokens = tokenizeProfile(oldData.profile).map(normalizeToken);

  const structured = {
    tempo: "",
    feel: [],
    function: [],
    context: [],
    style: [],
    tradition: [],
    use: [],
    remainingTags: []
  };

  const changes = [];
  const leftovers = [];
  const consumedProfileTokens = new Set();

  // Process tags first
  for (const tag of incomingTags) {
    const mapping = EXACT_MAPPINGS[tag];
    if (mapping !== undefined) {
      for (const m of mapping) {
        addValue(structured, m.field, m.value);
      }
      if (mapping.length > 0) {
        changes.push(`mapped tag "${tag}"`);
      }
      continue;
    }
    leftovers.push(tag);
  }

  // Process profile tokens / profile whole string
  for (const token of incomingProfileTokens) {
    const mapping = EXACT_MAPPINGS[token];
    if (mapping !== undefined) {
      for (const m of mapping) {
        addValue(structured, m.field, m.value);
      }
      consumedProfileTokens.add(token);
      if (mapping.length > 0) {
        changes.push(`mapped profile token "${token}"`);
      }
    }
  }

  structured.remainingTags = unique(leftovers);

  const newData = buildOrderedData(oldData, structured);

  const newRaw = matter.stringify(body.replace(/^\n+/, ""), newData, {
    lineWidth: 0,
    quotes: true,
  });

  return {
    status: "OK",
    file: fullPath,
    newRaw,
    changes: unique(changes),
    leftovers: structured.remainingTags,
    summary: {
      tempo: newData.tempo,
      feel: newData.feel,
      function: newData.function,
      context: newData.context,
      style: newData.style,
      tradition: newData.tradition,
      use: newData.use
    }
  };
}

const allFiles = collectMdFiles(resolvedInputDir).sort();
const report = [];
const leftoversReport = [];

if (APPLY) {
  fs.mkdirSync(outputDir, { recursive: true });
}

let okCount = 0;
let skipCount = 0;
let errorCount = 0;
let changedCount = 0;
let leftoverFiles = 0;

for (const fullPath of allFiles) {
  const result = normalizeSong(fullPath);

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

  const hadChanges =
    result.changes.length > 0 ||
    result.summary.tempo ||
    result.summary.feel.length ||
    result.summary.function.length ||
    result.summary.context.length ||
    result.summary.style.length ||
    result.summary.tradition.length ||
    result.summary.use.length;

  if (hadChanges) changedCount++;

  report.push(`OK: ${relative}`);
  if (result.changes.length) {
    for (const change of result.changes) {
      report.push(`  - ${change}`);
    }
  } else {
    report.push(`  - no mapped taxonomy terms found`);
  }

  if (result.leftovers.length) {
    leftoverFiles++;
    leftoversReport.push(`FILE: ${relative}`);
    leftoversReport.push(`LEFTOVER TAGS: ${result.leftovers.join(", ")}`);
    leftoversReport.push("");
  }

  if (APPLY) {
    const outPath = path.join(outputDir, relative);
    ensureParentDir(outPath);
    fs.writeFileSync(outPath, result.newRaw, "utf8");
  }
}

report.push("");
report.push("============================================================");
report.push(`Scanned        : ${allFiles.length}`);
report.push(`OK             : ${okCount}`);
report.push(`Skipped        : ${skipCount}`);
report.push(`Errors         : ${errorCount}`);
report.push(`Changed files  : ${changedCount}`);
report.push(`Leftover files : ${leftoverFiles}`);
report.push(`Mode           : ${APPLY ? "APPLY" : "DRY RUN"}`);
if (APPLY) {
  report.push(`Output         : ${outputDir}`);
}
report.push("============================================================");

const reportText = report.join("\n");
console.log(reportText);

const mainReportPath = APPLY
  ? path.join(outputDir, "_normalize_song_taxonomy_v1_report.txt")
  : path.join(process.cwd(), "_normalize_song_taxonomy_v1_report_dryrun.txt");

const leftoversPath = APPLY
  ? path.join(outputDir, "_normalize_song_taxonomy_v1_leftovers.txt")
  : path.join(process.cwd(), "_normalize_song_taxonomy_v1_leftovers_dryrun.txt");

try {
  fs.writeFileSync(mainReportPath, reportText + "\n", "utf8");
  fs.writeFileSync(
    leftoversPath,
    leftoversReport.length ? leftoversReport.join("\n") + "\n" : "No leftovers.\n",
    "utf8"
  );
  console.log(`\nMain report saved to: ${mainReportPath}`);
  console.log(`Leftovers report saved to: ${leftoversPath}`);
} catch (err) {
  console.warn(`\nCould not save report(s): ${err.message}`);
}