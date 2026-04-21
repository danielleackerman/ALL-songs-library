#!/usr/bin/env node

/**
 * sets-import-v1.js
 *
 * Purpose:
 * - Convert extracted set .txt files into Obsidian set notes.
 *
 * Locked rules:
 * - Create a wikilink for every title
 * - Preserve duplicates exactly
 * - Do not guess at all
 * - Do not rewrite song titles
 * - Leave function: [] and feel: [] empty
 * - Report missing song-note targets separately
 * - Report duplicates within sets separately
 *
 * Expected input folder shape:
 *   My_Sets-txt/
 *     2014-03-09-AM.txt
 *     2014-03-09-ALTAR CALL.txt
 *     ...
 *
 * Expected text format:
 *   SETLIST: AM
 *   DATE: 2014-03-09
 *   ------------------------------
 *
 *   1. In His Presence
 *   2. Falling In Love With Jesus V2
 *   ...
 *
 * Usage:
 *   node sets-import-v1.js /path/to/My_Sets-txt /path/to/songs_migrated_v1
 *
 * Example:
 *   node sets-import-v1.js ../My_Sets-txt ../songs_migrated_v1
 *
 * Output:
 *   ../sets/
 *   ../sets/_sets_import_report.txt
 *   ../sets/_sets_missing_song_notes.txt
 *   ../sets/_sets_duplicates_report.txt
 */

const fs = require("fs");
const path = require("path");
const matter = require("gray-matter");

const setsInputDir = process.argv[2];
const songsDir = process.argv[3];

if (!setsInputDir || !songsDir) {
  console.error(
    "Usage: node sets-import-v1.js /path/to/My_Sets-txt /path/to/songs_migrated_v1"
  );
  process.exit(1);
}

if (!fs.existsSync(setsInputDir)) {
  console.error(`Sets input folder not found: ${setsInputDir}`);
  process.exit(1);
}

if (!fs.existsSync(songsDir)) {
  console.error(`Songs folder not found: ${songsDir}`);
  process.exit(1);
}

const outputDir = path.resolve(process.cwd(), "../sets");
fs.mkdirSync(outputDir, { recursive: true });

function collectFiles(dir, results = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.name === "__MACOSX") continue;
    if (entry.name.startsWith("._")) continue;

    if (entry.isDirectory()) {
      collectFiles(fullPath, results);
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".txt")) {
      results.push(fullPath);
    }
  }

  return results;
}

function collectSongNoteNames(dir, results = new Set()) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      collectSongNoteNames(fullPath, results);
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
      const base = path.basename(entry.name, ".md");
      results.add(base);
    }
  }

  return results;
}

function sanitizeFileName(name) {
  return name.replace(/[<>:"/\\|?*\x00-\x1F]/g, "").trim();
}

function normalizeLineEndings(text) {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function parseSetFile(rawText, filePath) {
  const text = normalizeLineEndings(rawText);
  const lines = text.split("\n").map((line) => line.trim());

  let service = "";
  let date = "";
  const songs = [];

  for (const line of lines) {
    if (!line) continue;

    const setlistMatch = line.match(/^SETLIST:\s*(.+)$/i);
    if (setlistMatch) {
      service = setlistMatch[1].trim();
      continue;
    }

    const dateMatch = line.match(/^DATE:\s*(\d{4}-\d{2}-\d{2})$/i);
    if (dateMatch) {
      date = dateMatch[1].trim();
      continue;
    }

    if (/^-{3,}$/.test(line)) continue;

    const numberedSongMatch = line.match(/^\d+\.\s+(.+?)\s*$/);
    if (numberedSongMatch) {
      songs.push(numberedSongMatch[1].trim());
    }
  }

  if (!service && !date && songs.length === 0) {
    return {
      ok: false,
      reason: "Could not parse SETLIST/DATE/song lines",
      filePath,
    };
  }

  const fallbackTitle = path.basename(filePath, ".txt");
  const title = [date, service].filter(Boolean).join(" ").trim() || fallbackTitle;

  return {
    ok: true,
    title,
    date,
    service,
    songs,
    filePath,
  };
}

function countDuplicates(items) {
  const map = new Map();
  for (const item of items) {
    map.set(item, (map.get(item) || 0) + 1);
  }
  return Array.from(map.entries())
    .filter(([, count]) => count > 1)
    .sort((a, b) => a[0].localeCompare(b[0]));
}

function buildSetFrontmatter(parsed) {
  return {
    title: parsed.title || "",
    date: parsed.date || "",
    service: parsed.service || "",
    function: [],
    feel: [],
    songs: parsed.songs.map((song) => `[[${song}]]`),
  };
}

function buildSetBody(parsed, missingSongs, duplicateSongs) {
  const parts = [];

  parts.push("## Songs");
  for (const song of parsed.songs) {
    parts.push(`- [[${song}]]`);
  }

  if (missingSongs.length > 0) {
    parts.push("");
    parts.push("## Missing Song Notes");
    for (const song of missingSongs) {
      parts.push(`- ${song}`);
    }
  }

  if (duplicateSongs.length > 0) {
    parts.push("");
    parts.push("## Duplicate Titles In This Set");
    for (const [song, count] of duplicateSongs) {
      parts.push(`- ${song} (${count})`);
    }
  }

  return parts.join("\n") + "\n";
}

const setFiles = collectFiles(setsInputDir).sort();
const songNoteNames = collectSongNoteNames(songsDir);

const mainReport = [];
const missingReport = [];
const duplicatesReport = [];

let okCount = 0;
let errorCount = 0;
let totalSongs = 0;
let totalMissing = 0;
let totalDuplicateEntries = 0;

for (const filePath of setFiles) {
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = parseSetFile(raw, filePath);

  if (!parsed.ok) {
    errorCount++;
    mainReport.push(`ERROR: ${filePath}`);
    mainReport.push(`  ${parsed.reason}`);
    continue;
  }

  okCount++;
  totalSongs += parsed.songs.length;

  const missingSongs = parsed.songs.filter((song) => !songNoteNames.has(song));
  const duplicateSongs = countDuplicates(parsed.songs);

  totalMissing += missingSongs.length;
  totalDuplicateEntries += duplicateSongs.length;

  const frontmatter = buildSetFrontmatter(parsed);
  const body = buildSetBody(parsed, missingSongs, duplicateSongs);

  const outputFileName = sanitizeFileName(parsed.title || path.basename(filePath, ".txt")) + ".md";
  const outputPath = path.join(outputDir, outputFileName);

  const noteText = matter.stringify(body, frontmatter, {
    lineWidth: 0,
    quotes: true,
  });

  fs.writeFileSync(outputPath, noteText, "utf8");

  mainReport.push(`OK: ${path.basename(filePath)}`);
  mainReport.push(`  title: ${parsed.title}`);
  mainReport.push(`  service: ${parsed.service || "(blank)"}`);
  mainReport.push(`  date: ${parsed.date || "(blank)"}`);
  mainReport.push(`  songs: ${parsed.songs.length}`);
  if (missingSongs.length > 0) {
    mainReport.push(`  missing song notes: ${missingSongs.length}`);
  }
  if (duplicateSongs.length > 0) {
    mainReport.push(`  duplicate titles: ${duplicateSongs.length}`);
  }

  if (missingSongs.length > 0) {
    missingReport.push(`${parsed.title}`);
    for (const song of missingSongs) {
      missingReport.push(`  - ${song}`);
    }
    missingReport.push("");
  }

  if (duplicateSongs.length > 0) {
    duplicatesReport.push(`${parsed.title}`);
    for (const [song, count] of duplicateSongs) {
      duplicatesReport.push(`  - ${song} (${count})`);
    }
    duplicatesReport.push("");
  }
}

mainReport.push("");
mainReport.push("============================================================");
mainReport.push(`Set files scanned       : ${setFiles.length}`);
mainReport.push(`Set notes created       : ${okCount}`);
mainReport.push(`Errors                  : ${errorCount}`);
mainReport.push(`Total song entries      : ${totalSongs}`);
mainReport.push(`Missing linked targets  : ${totalMissing}`);
mainReport.push(`Duplicate title entries : ${totalDuplicateEntries}`);
mainReport.push(`Output folder           : ${outputDir}`);
mainReport.push("============================================================");

fs.writeFileSync(
  path.join(outputDir, "_sets_import_report.txt"),
  mainReport.join("\n") + "\n",
  "utf8"
);

fs.writeFileSync(
  path.join(outputDir, "_sets_missing_song_notes.txt"),
  (missingReport.length ? missingReport.join("\n") : "No missing song-note targets.\n"),
  "utf8"
);

fs.writeFileSync(
  path.join(outputDir, "_sets_duplicates_report.txt"),
  (duplicatesReport.length ? duplicatesReport.join("\n") : "No duplicate song titles within sets.\n"),
  "utf8"
);

console.log(mainReport.join("\n"));
console.log(`\nWrote set notes to: ${outputDir}`);
console.log(`Main report: ${path.join(outputDir, "_sets_import_report.txt")}`);
console.log(`Missing song report: ${path.join(outputDir, "_sets_missing_song_notes.txt")}`);
console.log(`Duplicate report: ${path.join(outputDir, "_sets_duplicates_report.txt")}`);