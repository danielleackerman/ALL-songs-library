const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const SOURCE_PDF_DIR = path.join(ROOT, "music-score-boone-lead-pdfs");
const IMPORT_ROOT = path.join(ROOT, "imports", "boone");
const PDF_ARCHIVE = path.join(IMPORT_ROOT, "pdfs");
const SONGS_OUT = path.join(IMPORT_ROOT, "songs");

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function cleanTitle(filename) {
  return path
    .basename(filename, ".pdf")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, c => c.toUpperCase());
}

function safeFilename(title) {
  return title.replace(/[<>:"/\\|?*]+/g, "").trim();
}

function firstLetterFolder(title) {
  const first = title.charAt(0).toUpperCase();
  return /^[A-Z]$/.test(first) ? first : "_";
}

function markdownTemplate(title, pdfName) {
  return `---
title: "${title}"
artist: ""
key: ""
bpm: ""
time_sig: ""
meter: ""
tempo: ""
feel: []
theme: []
function: []
context: []
style: []
tradition: []
use: []
source:
  - "Boone Open Bible Worship Team PDF Archive"
tags: []
genre: []
profile: []
keywords: ""
ccli: ""
copyright: ""
year: ""
medley: []
id: ""
---

# ${title}

## Source PDF

imports/boone/pdfs/${pdfName}

`;
}

ensureDir(PDF_ARCHIVE);
ensureDir(SONGS_OUT);

if (!fs.existsSync(SOURCE_PDF_DIR)) {
  console.error(`Missing source folder: ${SOURCE_PDF_DIR}`);
  console.error(`Put your downloaded PDFs in: music-score-boone-lead-pdfs/`);
  process.exit(1);
}

const pdfs = fs
  .readdirSync(SOURCE_PDF_DIR)
  .filter(file => file.toLowerCase().endsWith(".pdf"))
  .sort();

let created = 0;
let skipped = 0;

for (const pdf of pdfs) {
  const sourcePdfPath = path.join(SOURCE_PDF_DIR, pdf);
  const archivePdfPath = path.join(PDF_ARCHIVE, pdf);

  if (!fs.existsSync(archivePdfPath)) {
    fs.copyFileSync(sourcePdfPath, archivePdfPath);
  }

  const title = cleanTitle(pdf);
  const cleanMdName = `${safeFilename(title)}.md`;
  const letter = firstLetterFolder(title);
  const outFolder = path.join(SONGS_OUT, letter);
  const mdPath = path.join(outFolder, cleanMdName);

  ensureDir(outFolder);

  if (fs.existsSync(mdPath)) {
    skipped++;
    continue;
  }

  fs.writeFileSync(mdPath, markdownTemplate(title, pdf), "utf8");
  created++;
}

console.log(`Done.`);
console.log(`PDFs archived: ${pdfs.length}`);
console.log(`Markdown files created: ${created}`);
console.log(`Markdown files skipped because they already existed: ${skipped}`);
console.log(`Output folder: imports/boone/`);