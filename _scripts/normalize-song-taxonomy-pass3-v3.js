#!/usr/bin/env node

/**
 * normalize-song-taxonomy-pass3-v3.js
 *
 * Purpose:
 * - Read song notes from songs_taxonomy_normalized_v2
 * - Move approved leftover tags into:
 *   theme, source, tradition, feel, context
 * - Leave unknown leftovers in tags
 * - Preserve everything else
 * - Write to a new output folder
 * - Produce reports
 *
 * Usage:
 *   node normalize-song-taxonomy-pass3-v3.js ../songs_taxonomy_normalized_v2
 *   node normalize-song-taxonomy-pass3-v3.js ../songs_taxonomy_normalized_v2 --apply --out ../songs_taxonomy_normalized_v3
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
    : path.join(process.cwd(), "songs_taxonomy_normalized_v3");

if (!inputDir) {
  console.error(
    "Usage: node normalize-song-taxonomy-pass3-v3.js /path/to/input [--apply] [--out /path/to/output]"
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

function normalizeToken(text) {
  return String(text)
    .toLowerCase()
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function addValue(obj, key, value) {
  if (!value) return;
  if (!Array.isArray(obj[key])) obj[key] = [];
  if (!obj[key].includes(value)) obj[key].push(value);
}

const PASS3_MAPPINGS = {
  // source
  "sutl": [{ field: "source", value: "sing-unto-the-lord" }],

  // tradition
  "old-school": [{ field: "tradition", value: "old-school" }],
  "os-slow": [{ field: "tradition", value: "old-school" }],
  "os-gospel-slow": [{ field: "tradition", value: "old-school" }],
  "os-apo": [{ field: "tradition", value: "old-school" }],
  "os-presbyterian": [{ field: "tradition", value: "old-school" }],
  "os-christian": [{ field: "tradition", value: "old-school" }],
  "roots": [{ field: "tradition", value: "roots" }],

  // feel
  "anthemic": [{ field: "feel", value: "anthemic" }],
  "march": [{ field: "feel", value: "march" }],
  "upbeat": [{ field: "feel", value: "upbeat" }],

  // context
  "offering": [{ field: "context", value: "offering" }],

  // theme
  "grace": [{ field: "theme", value: "grace" }],
  "glory": [{ field: "theme", value: "glory" }],
  "love": [{ field: "theme", value: "love" }],
  "hope": [{ field: "theme", value: "hope" }],
  "cross": [{ field: "theme", value: "cross" }],
  "blood": [{ field: "theme", value: "blood" }],
  "presence": [{ field: "theme", value: "presence" }],
  "jesus": [{ field: "theme", value: "jesus" }],
  "father": [{ field: "theme", value: "father" }],
  "heaven": [{ field: "theme", value: "heaven" }],
  "holy-fire": [{ field: "theme", value: "holy-fire" }],
  "holy-spirit": [{ field: "theme", value: "holy-spirit" }],
  "holy-ghost": [{ field: "theme", value: "holy-ghost" }],
  "christ": [{ field: "theme", value: "christ" }],
  "king": [{ field: "theme", value: "king" }],
  "mercy": [{ field: "theme", value: "mercy" }],
  "peace": [{ field: "theme", value: "peace" }],
  "victory": [{ field: "theme", value: "victory" }],
  "joy": [{ field: "theme", value: "joy" }],
  "faith": [{ field: "theme", value: "faith" }],
  "power": [{ field: "theme", value: "power" }],
  "healing": [{ field: "theme", value: "healing" }],
  "salvation": [{ field: "theme", value: "salvation" }],
  "savior": [{ field: "theme", value: "savior" }],
  "saviour": [{ field: "theme", value: "savior" }],
  "redeemer": [{ field: "theme", value: "redeemer" }],
  "redemption": [{ field: "theme", value: "redemption" }],
  "holiness": [{ field: "theme", value: "holiness" }],
  "righteousness": [{ field: "theme", value: "righteousness" }],
  "blessing": [{ field: "theme", value: "blessing" }],
  "breakthrough": [{ field: "theme", value: "breakthrough" }],
  "calling": [{ field: "theme", value: "calling" }],
  "comfort": [{ field: "theme", value: "comfort" }],
  "commitment": [{ field: "theme", value: "commitment" }],
  "confidence": [{ field: "theme", value: "confidence" }],
  "consecration": [{ field: "theme", value: "consecration" }],
  "conversion": [{ field: "theme", value: "conversion" }],
  "crucifixion": [{ field: "theme", value: "crucifixion" }],
  "death": [{ field: "theme", value: "death" }],
  "deliverance": [{ field: "theme", value: "deliverance" }],
  "desire": [{ field: "theme", value: "desire" }],
  "easter": [{ field: "theme", value: "easter" }],
  "eternal": [{ field: "theme", value: "eternal-life" }],
  "eternal-life": [{ field: "theme", value: "eternal-life" }],
  "family": [{ field: "theme", value: "family" }],
  "freedom": [{ field: "theme", value: "freedom" }],
  "friend": [{ field: "theme", value: "friendship" }],
  "friendship": [{ field: "theme", value: "friendship" }],
  "giving": [{ field: "theme", value: "giving" }],
  "goodness": [{ field: "theme", value: "goodness" }],
  "gratitude": [{ field: "theme", value: "gratitude" }],
  "guidance": [{ field: "theme", value: "guidance" }],
  "help": [{ field: "theme", value: "help" }],
  "his-name": [{ field: "theme", value: "the-name" }],
  "the-name": [{ field: "theme", value: "the-name" }],
  "home": [{ field: "theme", value: "heaven-home" }],
  "hunger": [{ field: "theme", value: "hunger" }],
  "immerse": [{ field: "theme", value: "immersion" }],
  "light": [{ field: "theme", value: "light" }],
  "living-water": [{ field: "theme", value: "living-water" }],
  "longing": [{ field: "theme", value: "longing" }],
  "men": [{ field: "theme", value: "men" }],
  "name": [{ field: "theme", value: "the-name" }],
  "one-god": [{ field: "theme", value: "one-god" }],
  "peaceful": [{ field: "theme", value: "peace" }],
  "pentecost": [{ field: "theme", value: "pentecost" }],
  "petition": [{ field: "theme", value: "petition" }],
  "prayer": [{ field: "theme", value: "prayer" }],
  "promise": [{ field: "theme", value: "promise" }],
  "protection": [{ field: "theme", value: "protection" }],
  "provision": [{ field: "theme", value: "provision" }],
  "refuge": [{ field: "theme", value: "refuge" }],
  "rejoice": [{ field: "theme", value: "rejoicing" }],
  "rejoicing": [{ field: "theme", value: "rejoicing" }],
  "renewal": [{ field: "theme", value: "renewal" }],
  "rest": [{ field: "theme", value: "rest" }],
  "revival": [{ field: "theme", value: "revival" }],
  "river": [{ field: "theme", value: "river" }],
  "rock": [{ field: "theme", value: "rock" }],
  "sacrifice": [{ field: "theme", value: "sacrifice" }],
  "sanctification": [{ field: "theme", value: "sanctification" }],
  "santification": [{ field: "theme", value: "sanctification" }],
  "service": [{ field: "theme", value: "service" }],
  "shield": [{ field: "theme", value: "shield" }],
  "sin": [{ field: "theme", value: "sin" }],
  "sorrow": [{ field: "theme", value: "sorrow" }],
  "strength": [{ field: "theme", value: "strength" }],
  "surrender": [{ field: "theme", value: "surrender" }],
  "testimony": [{ field: "theme", value: "testimony" }],
  "thank": [{ field: "theme", value: "thanksgiving" }],
  "thanks": [{ field: "theme", value: "thanksgiving" }],
  "thankful": [{ field: "theme", value: "thanksgiving" }],
  "thanksgiving": [{ field: "theme", value: "thanksgiving" }],
  "thankfulness": [{ field: "theme", value: "thankfulness" }],
  "thirst": [{ field: "theme", value: "thirst" }],
  "truth": [{ field: "theme", value: "truth" }],
  "trust": [{ field: "theme", value: "trust" }],
  "unity": [{ field: "theme", value: "unity" }],
  "vessel": [{ field: "theme", value: "vessel" }],
  "victorious": [{ field: "theme", value: "victory" }],
  "warfare": [{ field: "theme", value: "warfare" }],
  "water": [{ field: "theme", value: "water" }],
  "witness": [{ field: "theme", value: "witness" }],
  "women": [{ field: "theme", value: "women" }],
  "wise": [{ field: "theme", value: "wisdom" }],
  "wisdom": [{ field: "theme", value: "wisdom" }],
  "alive": [{ field: "theme", value: "life" }],
  "life": [{ field: "theme", value: "life" }],
  "awesome": [{ field: "theme", value: "awesome" }],
  "adoration": [{ field: "theme", value: "adoration" }],
  "almighty": [{ field: "theme", value: "almighty" }],
  "alleluia": [{ field: "theme", value: "alleluia" }],
  "angels": [{ field: "theme", value: "angels" }],
  "anointing": [{ field: "theme", value: "anointing" }],
  "army": [{ field: "theme", value: "army" }],
  "aspiration": [{ field: "theme", value: "aspiration" }],
  "assurance": [{ field: "theme", value: "assurance" }],
  "atomement": [{ field: "theme", value: "atonement" }],
  "atonement": [{ field: "theme", value: "atonement" }],
  "authority": [{ field: "theme", value: "authority" }],
  "baptism": [{ field: "theme", value: "baptism" }],
  "beauty": [{ field: "theme", value: "beauty" }],
  "believe": [{ field: "theme", value: "belief" }],
  "belief": [{ field: "theme", value: "belief" }],
  "bible": [{ field: "theme", value: "bible" }],
  "birth": [{ field: "theme", value: "birth" }],
  "calvary": [{ field: "theme", value: "calvary" }],
  "celebration": [{ field: "theme", value: "celebration" }],
  "change": [{ field: "theme", value: "change" }],
  "childrens": [{ field: "theme", value: "children" }],
  "children": [{ field: "theme", value: "children" }],
  "christian-life": [{ field: "theme", value: "christian-life" }],
  "cleansing": [{ field: "theme", value: "cleansing" }],
  "cornerstone": [{ field: "theme", value: "cornerstone" }],
  "dance": [{ field: "theme", value: "dance" }],
  "declaration": [{ field: "theme", value: "declaration" }],
  "declaration-worship": [{ field: "theme", value: "declaration" }],
  "desperation": [{ field: "theme", value: "desperation" }],
  "dreams": [{ field: "theme", value: "dreams" }],
  "exaltation": [{ field: "theme", value: "exaltation" }],
  "faithfulness": [{ field: "theme", value: "faithfulness" }],
  "foundation": [{ field: "theme", value: "foundation" }],
  "gladness": [{ field: "theme", value: "gladness" }],
  "gods-word": [{ field: "theme", value: "gods-word" }],
  "good": [{ field: "theme", value: "goodness" }],
  "greatness": [{ field: "theme", value: "greatness" }],
  "hell": [{ field: "theme", value: "hell" }],
  "holy-place": [{ field: "theme", value: "holy-place" }],
  "honor": [{ field: "theme", value: "honor" }],
  "israel": [{ field: "theme", value: "israel" }],
  "jericho": [{ field: "theme", value: "jericho" }],
  "jehovah": [{ field: "theme", value: "jehovah" }],
  "lullaby": [{ field: "theme", value: "lullaby" }],
  "messiah": [{ field: "theme", value: "messiah" }],
  "miracles": [{ field: "theme", value: "miracles" }],
  "prodigal": [{ field: "theme", value: "prodigal" }],
  "redemeer": [{ field: "theme", value: "redeemer" }],
  "reverence": [{ field: "theme", value: "reverence" }],
  "shelter": [{ field: "theme", value: "shelter" }],
  "temptation": [{ field: "theme", value: "temptation" }],
  "triumph": [{ field: "theme", value: "triumph" }],
  "urban-gospel": [{ field: "theme", value: "urban-gospel" }],
  "will": [{ field: "theme", value: "will" }],
  "wonder": [{ field: "theme", value: "wonder" }],
  "acceptance": [{ field: "theme", value: "acceptance" }],
  "anticipation": [{ field: "theme", value: "anticipation" }]
};

function buildOrderedData(oldData, pass3Data) {
  return {
    title: oldData.title ?? "",
    artist: oldData.artist ?? "",
    key: oldData.key ?? "",
    bpm: oldData.bpm ?? "",
    time_sig: oldData.time_sig ?? "",
    meter: oldData.meter ?? "",
    tempo: oldData.tempo ?? "",
    feel: unique([
      ...ensureArray(oldData.feel),
      ...ensureArray(pass3Data.feel)
    ]),
    theme: unique([
      ...ensureArray(oldData.theme),
      ...ensureArray(pass3Data.theme)
    ]),
    function: ensureArray(oldData.function),
    context: unique([
      ...ensureArray(oldData.context),
      ...ensureArray(pass3Data.context)
    ]),
    style: ensureArray(oldData.style),
    tradition: unique([
      ...ensureArray(oldData.tradition),
      ...ensureArray(pass3Data.tradition)
    ]),
    use: ensureArray(oldData.use),
    source: unique([
      ...ensureArray(oldData.source),
      ...ensureArray(pass3Data.source)
    ]),
    tags: unique(pass3Data.remainingTags),
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

  const pass3Data = {
    theme: [],
    source: [],
    tradition: [],
    feel: [],
    context: [],
    remainingTags: []
  };

  const changes = [];

  for (const tag of incomingTags) {
    const mapping = PASS3_MAPPINGS[tag];

    if (mapping !== undefined) {
      for (const m of mapping) {
        addValue(pass3Data, m.field, m.value);
      }
      if (mapping.length > 0) {
        changes.push(`mapped leftover tag "${tag}"`);
      }
      continue;
    }

    pass3Data.remainingTags.push(tag);
  }

  pass3Data.remainingTags = unique(pass3Data.remainingTags);

  const newData = buildOrderedData(oldData, pass3Data);

  const newRaw = matter.stringify(body.replace(/^\n+/, ""), newData, {
    lineWidth: 0,
    quotes: true,
  });

  return {
    status: "OK",
    file: fullPath,
    newRaw,
    changes: unique(changes),
    leftovers: pass3Data.remainingTags,
    summary: {
      theme: newData.theme,
      source: newData.source,
      tradition: newData.tradition,
      feel: newData.feel,
      context: newData.context
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
    result.summary.theme.length ||
    result.summary.source.length ||
    result.summary.tradition.length ||
    result.summary.feel.length ||
    result.summary.context.length;

  if (hadChanges) changedCount++;

  report.push(`OK: ${relative}`);
  if (result.changes.length) {
    for (const change of result.changes) {
      report.push(`  - ${change}`);
    }
  } else {
    report.push(`  - no pass-3 mappings found`);
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
  ? path.join(outputDir, "_normalize_song_taxonomy_pass3_v3_report.txt")
  : path.join(process.cwd(), "_normalize_song_taxonomy_pass3_v3_report_dryrun.txt");

const leftoversPath = APPLY
  ? path.join(outputDir, "_normalize_song_taxonomy_pass3_v3_leftovers.txt")
  : path.join(process.cwd(), "_normalize_song_taxonomy_pass3_v3_leftovers_dryrun.txt");

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