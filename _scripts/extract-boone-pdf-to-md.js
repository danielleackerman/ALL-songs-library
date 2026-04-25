const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = process.cwd();
const PDF_DIR = path.join(ROOT, "imports", "boone", "pdfs");
const SONGS_OUT = path.join(ROOT, "imports", "boone", "songs");

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

function extractText(pdfPath) {
  try {
    return execFileSync("pdftotext", ["-layout", pdfPath, "-"], {
      encoding: "utf8",
      maxBuffer: 1024 * 1024 * 20,
    }).trim();
  } catch (err) {
    return "";
  }
}

function markdownTemplate(title, pdfName, extractedText) {
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

## Extracted PDF Text

\`\`\`text
${extractedText || "[No text extracted from PDF. This may be a scanned/image-based PDF.]"}
\`\`\`
`;
}

if (!fs.existsSync(PDF_DIR)) {
  console.error(`Missing PDF folder: ${PDF_DIR}`);
  process.exit(1);
}

const pdfs = fs
  .readdirSync(PDF_DIR)
  .filter(file => file.toLowerCase().endsWith(".pdf"))
  .sort();

let written = 0;
let noText = 0;

for (const pdf of pdfs) {
  const pdfPath = path.join(PDF_DIR, pdf);
  const title = cleanTitle(pdf);
  const letter = firstLetterFolder(title);
  const outFolder = path.join(SONGS_OUT, letter);
  const mdPath = path.join(outFolder, `${safeFilename(title)}.md`);

  ensureDir(outFolder);

  const extractedText = extractText(pdfPath);

  if (!extractedText) noText++;

  fs.writeFileSync(mdPath, markdownTemplate(title, pdf, extractedText), "utf8");
  written++;
}

console.log("Done.");
console.log(`PDFs processed: ${pdfs.length}`);
console.log(`Markdown files written: ${written}`);
console.log(`PDFs with no extractable text: ${noText}`);
console.log(`Output folder: imports/boone/songs/`);