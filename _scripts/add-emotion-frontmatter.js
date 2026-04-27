const fs = require("fs");
const path = require("path");

const WRITE = process.argv.includes("--write");
const ROOT = process.cwd();
const SONGS_DIR = path.join(ROOT, "songs");
const REPORT_DIR = path.join(ROOT, "_reports");
const REPORT_PATH = path.join(REPORT_DIR, "add-emotion-frontmatter-report.json");

const NEW_FIELD_LINE = "emotion: []";

function walkMarkdownFiles(dir, results = []) {
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      walkMarkdownFiles(fullPath, results);
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
      results.push(fullPath);
    }
  }

  return results;
}

function hasTopLevelField(lines, fieldName) {
  const re = new RegExp(`^${fieldName}\\s*:`);
  return lines.some((line) => re.test(line));
}

function findTopLevelField(lines, fieldName) {
  const re = new RegExp(`^${fieldName}\\s*:`);
  return lines.findIndex((line) => re.test(line));
}

function findBlockEnd(lines, startIndex) {
  let i = startIndex + 1;

  while (i < lines.length) {
    const line = lines[i];

    // Next top-level YAML key starts a new field.
    if (/^[A-Za-z0-9_-]+\s*:/.test(line)) {
      break;
    }

    i++;
  }

  return i;
}

function insertEmotionField(frontmatterLines) {
  if (hasTopLevelField(frontmatterLines, "emotion")) {
    return {
      changed: false,
      lines: frontmatterLines,
      reason: "already_has_emotion",
    };
  }

  let insertAt = -1;

  // Preferred placement:
  // feel: []
  // theme: []
  // emotion: []
  // function: []
  const themeIndex = findTopLevelField(frontmatterLines, "theme");

  if (themeIndex !== -1) {
    insertAt = findBlockEnd(frontmatterLines, themeIndex);
  } else {
    const feelIndex = findTopLevelField(frontmatterLines, "feel");

    if (feelIndex !== -1) {
      insertAt = findBlockEnd(frontmatterLines, feelIndex);
    } else {
      const functionIndex = findTopLevelField(frontmatterLines, "function");

      if (functionIndex !== -1) {
        insertAt = functionIndex;
      } else {
        insertAt = frontmatterLines.length;
      }
    }
  }

  const updatedLines = [
    ...frontmatterLines.slice(0, insertAt),
    NEW_FIELD_LINE,
    ...frontmatterLines.slice(insertAt),
  ];

  return {
    changed: true,
    lines: updatedLines,
    reason: "added_emotion",
  };
}

function processFile(filePath) {
  const original = fs.readFileSync(filePath, "utf8");
  const hasBom = original.charCodeAt(0) === 0xfeff;
  const withoutBom = hasBom ? original.slice(1) : original;
  const eol = withoutBom.includes("\r\n") ? "\r\n" : "\n";

  const normalized = withoutBom.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");

  if (lines[0].trim() !== "---") {
    return {
      status: "skipped",
      reason: "no_frontmatter",
    };
  }

  const closingIndex = lines.findIndex((line, index) => {
    return index > 0 && line.trim() === "---";
  });

  if (closingIndex === -1) {
    return {
      status: "skipped",
      reason: "frontmatter_not_closed",
    };
  }

  const frontmatterLines = lines.slice(1, closingIndex);
  const restOfFile = lines.slice(closingIndex);

  const result = insertEmotionField(frontmatterLines);

  if (!result.changed) {
    return {
      status: "unchanged",
      reason: result.reason,
    };
  }

  const updatedNormalized = [
    "---",
    ...result.lines,
    ...restOfFile,
  ].join("\n");

  const updated = (hasBom ? "\ufeff" : "") + updatedNormalized.replace(/\n/g, eol);

  if (WRITE) {
    fs.writeFileSync(filePath, updated, "utf8");
  }

  return {
    status: WRITE ? "changed" : "would_change",
    reason: result.reason,
  };
}

function main() {
  if (!fs.existsSync(SONGS_DIR)) {
    console.error("ERROR: songs folder not found.");
    console.error(`Expected path: ${SONGS_DIR}`);
    process.exit(1);
  }

  fs.mkdirSync(REPORT_DIR, { recursive: true });

  const files = walkMarkdownFiles(SONGS_DIR).sort();

  const report = {
    mode: WRITE ? "write" : "dry-run",
    target_folder: "songs",
    field_added: NEW_FIELD_LINE,
    placement: "after theme; fallback after feel; fallback before function; fallback end of frontmatter",
    scanned_count: files.length,
    changed_count: 0,
    unchanged_count: 0,
    skipped_count: 0,
    changed_files: [],
    unchanged_files: [],
    skipped_files: [],
  };

  for (const filePath of files) {
    const relativePath = path.relative(ROOT, filePath);
    const result = processFile(filePath);

    if (result.status === "changed" || result.status === "would_change") {
      report.changed_count++;
      report.changed_files.push({
        file: relativePath,
        status: result.status,
        reason: result.reason,
      });
    } else if (result.status === "unchanged") {
      report.unchanged_count++;
      report.unchanged_files.push({
        file: relativePath,
        reason: result.reason,
      });
    } else {
      report.skipped_count++;
      report.skipped_files.push({
        file: relativePath,
        reason: result.reason,
      });
    }
  }

  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2) + "\n", "utf8");

  console.log("");
  console.log("Emotion frontmatter update complete.");
  console.log(`Mode: ${report.mode}`);
  console.log(`Scanned: ${report.scanned_count}`);
  console.log(`${WRITE ? "Changed" : "Would change"}: ${report.changed_count}`);
  console.log(`Unchanged: ${report.unchanged_count}`);
  console.log(`Skipped: ${report.skipped_count}`);
  console.log(`Report: ${path.relative(ROOT, REPORT_PATH)}`);
  console.log("");

  if (!WRITE) {
    console.log("Dry run only. To actually update files, run:");
    console.log("node _scripts/add-emotion-frontmatter.js --write");
    console.log("");
  }
}

main();