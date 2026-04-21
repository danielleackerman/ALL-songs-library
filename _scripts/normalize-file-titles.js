#!/usr/bin/env node
/**
 * normalize-file-titles.js
 * Renames .md files so the filename matches the normalized title in frontmatter.
 * Recurses into all subfolders automatically.
 *
 * Rules:
 *   - Reads title: from YAML frontmatter
 *   - Restores apostrophes mangled during SQLite export (I_ll → I'll, don_t → don't)
 *   - Other underscores become spaces (word separators)
 *   - Fixes capitalized letters after apostrophes mid-word (I'Ve → I've)
 *   - Strips Mac-illegal characters (: and /)
 *   - Renames file to that title + .md
 *   - If target filename already exists → appends [2], [3], etc.
 *   - Dry run by default — no files changed until you pass --apply
 *
 * Usage:
 *   node normalize-file-titles.js /path/to/songs/            # dry run + report
 *   node normalize-file-titles.js /path/to/songs/ --apply    # actually rename
 *
 * Requires: npm install gray-matter
 */

const fs     = require('fs');
const path   = require('path');
const matter = require('gray-matter');

// ─── Args ────────────────────────────────────────────────────────────────────

const SONGS_DIR = process.argv[2];
const APPLY     = process.argv.includes('--apply');

if (!SONGS_DIR) {
  console.error('Usage: node normalize-file-titles.js /path/to/songs/ [--apply]');
  process.exit(1);
}

if (!fs.existsSync(SONGS_DIR)) {
  console.error(`Directory not found: ${SONGS_DIR}`);
  process.exit(1);
}

// ─── Collect all .md files recursively ───────────────────────────────────────

function collectMdFiles(dir, results = []) {
  const entries = fs.readdirSync(dir);
  for (const name of entries) {
    const fullPath = path.join(dir, name);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      collectMdFiles(fullPath, results);
    } else if (stat.isFile() && name.endsWith('.md')) {
      results.push(fullPath);
    }
  }
  return results;
}

// ─── Title → Filename ────────────────────────────────────────────────────────

function titleToFilename(raw) {
  let s = raw.trim();

  // Restore apostrophes mangled during SQLite export — only for genuine contractions
  // e.g. I_ll → I'll, don_t → don't, I_ve → I've, I_m → I'm, I_d → I'd, you_re → you're
  // Always lowercase the suffix so I_LL → I'll not I'LL
  s = s.replace(/([a-zA-Z])_(ll|t|ve|m|d|re|s)\b/gi,
    (_, letter, suffix) => letter + "'" + suffix.toLowerCase());

  // All remaining underscores were word separators — replace with space
  s = s.replace(/_/g, ' ');

  // Fix capitalized letter after apostrophe mid-word (handles both straight and curly apostrophes)
  // Only fires when apostrophe is preceded by a letter (skips 'Tis at start of word)
  s = s.replace(/([a-zA-Z])[’']([A-Z])/g,
    (_, before, cap) => before + "'" + cap.toLowerCase());

  // Strip Mac-illegal characters
  s = s.replace(/:/g, '').replace(/\//g, '');

  // Collapse multiple spaces
  s = s.replace(/\s+/g, ' ').trim();

  return s;
}

// ─── Collision-safe target path ───────────────────────────────────────────────

function safeTarget(dir, baseName, currentFile) {
  const first = path.join(dir, baseName + '.md');

  // If target is the same file (case-insensitive), it's a case-only change — allow it
  if (first.toLowerCase() === path.join(dir, currentFile).toLowerCase()) {
    return first;
  }

  if (!fs.existsSync(first)) return first;

  let n = 2;
  while (true) {
    const candidate = path.join(dir, `${baseName} [${n}].md`);
    if (!fs.existsSync(candidate)) return candidate;
    n++;
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const allFiles = collectMdFiles(SONGS_DIR).sort();
const report   = [];

for (const fullPath of allFiles) {
  const dir  = path.dirname(fullPath);
  const file = path.basename(fullPath);
  let raw;

  try {
    raw = fs.readFileSync(fullPath, 'utf8');
  } catch (e) {
    report.push({ status: 'ERROR', fullPath, file, reason: 'Could not read file: ' + e.message });
    continue;
  }

  let parsed;
  try {
    parsed = matter(raw);
  } catch (e) {
    report.push({ status: 'ERROR', fullPath, file, reason: 'YAML parse error: ' + e.message });
    continue;
  }

  const title = parsed.data.title;

  if (!title || typeof title !== 'string' || !title.trim()) {
    report.push({ status: 'NO_TITLE', fullPath, file });
    continue;
  }

  const newBase     = titleToFilename(title);
  const newFilename = newBase + '.md';

  // Already correct (exact match)
  if (newFilename === file) {
    report.push({ status: 'OK', fullPath, file });
    continue;
  }

  const targetPath    = safeTarget(dir, newBase, file);
  const finalFilename = path.basename(targetPath);
  const isCollision   = finalFilename !== newFilename;

  report.push({
    status:      APPLY ? 'RENAMED' : 'WILL_RENAME',
    fullPath,
    file,
    dir,
    newFilename: finalFilename,
    collision:   isCollision
  });

  if (APPLY) {
    fs.renameSync(fullPath, targetPath);
  }
}

// ─── Build report ─────────────────────────────────────────────────────────────

const lines  = [];
const header = APPLY ? 'RENAME COMPLETE' : 'DRY RUN — no files were changed';

lines.push('═══════════════════════════════════════════════════════════════');
lines.push(`  ${header}`);
lines.push('═══════════════════════════════════════════════════════════════');
lines.push('');

const willRename = report.filter(r => r.status === 'WILL_RENAME' || r.status === 'RENAMED');
const collisions = willRename.filter(r => r.collision);
const clean      = willRename.filter(r => !r.collision);
const alreadyOk  = report.filter(r => r.status === 'OK');
const noTitle    = report.filter(r => r.status === 'NO_TITLE');
const errors     = report.filter(r => r.status === 'ERROR');

if (clean.length) {
  lines.push(`── ${APPLY ? 'Renamed' : 'Will rename'} (${clean.length}) ──────────────────────────────────`);
  clean.forEach(r => {
    const subfolder = path.relative(SONGS_DIR, r.dir);
    const prefix    = subfolder ? `[${subfolder}] ` : '';
    lines.push(`  ${prefix}"${r.file}"\n    → "${r.newFilename}"`);
  });
  lines.push('');
}

if (collisions.length) {
  lines.push(`── ⚠️  Collision resolved with [n] suffix (${collisions.length}) ──────────`);
  collisions.forEach(r => {
    const subfolder = path.relative(SONGS_DIR, r.dir);
    const prefix    = subfolder ? `[${subfolder}] ` : '';
    lines.push(`  ${prefix}"${r.file}"\n    → "${r.newFilename}"  ← [n] added to avoid overwrite`);
  });
  lines.push('');
}

if (noTitle.length) {
  lines.push(`── ⚠️  No title in frontmatter — skipped (${noTitle.length}) ──────────────`);
  noTitle.forEach(r => lines.push(`  "${r.fullPath}"`));
  lines.push('');
}

if (errors.length) {
  lines.push(`── ❌  Errors — skipped (${errors.length}) ──────────────────────────────`);
  errors.forEach(r => lines.push(`  "${r.fullPath}": ${r.reason}`));
  lines.push('');
}

lines.push('───────────────────────────────────────────────────────────────');
lines.push(`  Total scanned      : ${allFiles.length}`);
lines.push(`  ${APPLY ? 'Renamed' : 'To rename'}            : ${willRename.length}`);
lines.push(`    Clean renames    : ${clean.length}`);
lines.push(`    Collision [n]    : ${collisions.length}`);
lines.push(`  Already correct    : ${alreadyOk.length}`);
lines.push(`  No title (skipped) : ${noTitle.length}`);
lines.push(`  Errors (skipped)   : ${errors.length}`);
lines.push('───────────────────────────────────────────────────────────────');

if (!APPLY && willRename.length > 0) {
  lines.push('');
  lines.push('  Run with --apply to perform the renames.');
}

lines.push('');

const reportText = lines.join('\n');

// ─── Output ───────────────────────────────────────────────────────────────────

console.log(reportText);

const reportFilename = APPLY ? 'rename-report-applied.txt' : 'rename-report-dryrun.txt';
const reportPath     = path.join(SONGS_DIR, reportFilename);
try {
  fs.writeFileSync(reportPath, reportText, 'utf8');
  console.log(`  Report saved to: ${reportPath}\n`);
} catch (e) {
  console.warn(`  Could not save report file: ${e.message}`);
}
