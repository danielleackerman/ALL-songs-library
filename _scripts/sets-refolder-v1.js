#!/usr/bin/env node

/**
 * sets-refolder-v1.js
 *
 * Purpose:
 * - Move generated set notes from ../sets into normalized subfolders based on
 *   the frontmatter service field.
 *
 * Target folders:
 *   sets/
 *     sunday-am/
 *     sunday-pm/
 *     midweek/
 *     practice/
 *     altar/
 *     unclear-needs-review/
 *
 * Rules:
 * - Read only .md set notes in ../sets root
 * - Ignore report files beginning with "_"
 * - Use frontmatter service field for classification
 * - Do not modify frontmatter/content
 * - Move files into the target subfolder
 * - If a file already exists at the destination, skip and report it
 *
 * Usage:
 *   node sets-refolder-v1.js
 */

const fs = require("fs");
const path = require("path");
const matter = require("gray-matter");

const setsRoot = path.resolve(process.cwd(), "../sets");

if (!fs.existsSync(setsRoot)) {
  console.error(`Sets folder not found: ${setsRoot}`);
  process.exit(1);
}

const TARGET_FOLDERS = [
  "sunday-am",
  "sunday-pm",
  "midweek",
  "practice",
  "altar",
  "unclear-needs-review",
];

for (const folder of TARGET_FOLDERS) {
  fs.mkdirSync(path.join(setsRoot, folder), { recursive: true });
}

function classifyService(rawService) {
  const service = String(rawService || "").trim().toLowerCase();

  if (!service) return "unclear-needs-review";

  // altar
  if (
    service.includes("altar")
  ) {
    return "altar";
  }

  // practice
  if (
    service.includes("practice") ||
    service.includes("rehears")
  ) {
    return "practice";
  }

  // sunday am
  if (
    service === "am" ||
    service.includes("am sunday") ||
    service.includes("sunday am") ||
    service.includes("am sun") ||
    service.includes("sun am")
  ) {
    return "sunday-am";
  }

  // sunday pm
  if (
    service.includes("pm sunday") ||
    service.includes("sunday pm") ||
    service.includes("pm sun") ||
    service.includes("sun pm")
  ) {
    return "sunday-pm";
  }

  // midweek
  if (
    service.includes("wednesday") ||
    service.includes("wednes") ||
    service.includes("weds") ||
    service.includes("wdnesday") ||
    service.includes("thursday") ||
    service.includes("thurs") ||
    service.includes("tuesday") ||
    service.includes("tues") ||
    service.includes("friday") ||
    service.includes("frid")
  ) {
    return "midweek";
  }

  return "unclear-needs-review";
}

function isRootSetNote(fileName) {
  if (!fileName.toLowerCase().endsWith(".md")) return false;
  if (fileName.startsWith("_")) return false;
  return true;
}

const entries = fs.readdirSync(setsRoot, { withFileTypes: true });
const rootNotes = entries
  .filter((entry) => entry.isFile() && isRootSetNote(entry.name))
  .map((entry) => entry.name)
  .sort();

const report = [];
const counts = {
  moved: 0,
  skipped_existing: 0,
  errors: 0,
};

const bucketCounts = Object.fromEntries(TARGET_FOLDERS.map((f) => [f, 0]));

for (const fileName of rootNotes) {
  const sourcePath = path.join(setsRoot, fileName);

  let raw;
  try {
    raw = fs.readFileSync(sourcePath, "utf8");
  } catch (err) {
    counts.errors++;
    report.push(`ERROR: ${fileName}`);
    report.push(`  Could not read file: ${err.message}`);
    continue;
  }

  let parsed;
  try {
    parsed = matter(raw);
  } catch (err) {
    counts.errors++;
    report.push(`ERROR: ${fileName}`);
    report.push(`  Could not parse frontmatter: ${err.message}`);
    continue;
  }

  const service = parsed.data?.service || "";
  const bucket = classifyService(service);
  const destPath = path.join(setsRoot, bucket, fileName);

  if (fs.existsSync(destPath)) {
    counts.skipped_existing++;
    report.push(`SKIP EXISTS: ${fileName}`);
    report.push(`  service: ${service || "(blank)"}`);
    report.push(`  target: ${bucket}/`);
    continue;
  }

  try {
    fs.renameSync(sourcePath, destPath);
    counts.moved++;
    bucketCounts[bucket]++;
    report.push(`MOVED: ${fileName}`);
    report.push(`  service: ${service || "(blank)"}`);
    report.push(`  target: ${bucket}/`);
  } catch (err) {
    counts.errors++;
    report.push(`ERROR: ${fileName}`);
    report.push(`  Move failed: ${err.message}`);
  }
}

report.push("");
report.push("============================================================");
report.push(`Root set notes scanned : ${rootNotes.length}`);
report.push(`Moved                  : ${counts.moved}`);
report.push(`Skipped (exists)       : ${counts.skipped_existing}`);
report.push(`Errors                 : ${counts.errors}`);
report.push("------------------------------------------------------------");
for (const folder of TARGET_FOLDERS) {
  report.push(`${folder.padEnd(22)} ${bucketCounts[folder]}`);
}
report.push("============================================================");

const reportText = report.join("\n");
const reportPath = path.join(setsRoot, "_sets_refolder_report.txt");

fs.writeFileSync(reportPath, reportText + "\n", "utf8");

console.log(reportText);
console.log(`\nReport saved to: ${reportPath}`);