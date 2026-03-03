#!/usr/bin/env node
/**
 * normalize_songs.js
 * 
 * Song Markdown Normalization Script
 * Transforms .md song files to a consistent schema and format.
 * 
 * Usage:
 *   node normalize_songs.js <input_dir> [--apply] [--out <output_dir>]
 * 
 * Default: dry-run mode (writes report, changes nothing)
 * --apply: writes normalized files to output dir
 * --out: output directory (default: <input_dir>_normalized)
 */

const fs = require('fs');
const path = require('path');

// ─── CONFIG ─────────────────────────────────────────────────────────────────

const SACRED_WORDS = new Set([
  'i', 'lord', 'god', 'jesus', 'christ', 'holy', 'spirit',
  'father', 'king', 'lamb', 'savior', 'saviour', 'messiah',
  'emmanuel', 'immanuel', 'jehovah', 'adonai', 'elohim',
  'zion', 'calvary', 'israel', 'jordan', 'nazareth',
  'bethlehem', 'galilee', 'jerusalem', 'eden',
  'mary', 'moses', 'david', 'abraham', 'solomon', 'paul',
  'peter', 'john', 'satan', 'devil',
  'bible', 'scripture', 'psalm',
  'christmas', 'easter', 'pentecost',
  'hallelujah', 'alleluia', 'hosanna', 'amen',
  'o', 'oh', 'thy', 'thee', 'thou', 'thine',
  'he', 'his', 'him', 'you', 'your',
]);

const SECTION_LABELS = [
  'INTRO', 'VERSE', 'CHORUS', 'CHORUS MOD', 'BRIDGE', 'TAG',
  'VAMP', 'OUTRO', 'INTERLUDE', 'INSTRUMENTAL', 'AD LIB',
  'DESCANT', 'TURNAROUND', 'ENDING', 'PRE-CHORUS',
];

const ENERGY_MAP = {
  'high-energy': 'high',
  'energetic': 'high',
  'shouting': 'high',
  'medium-fast': 'medium-fast',
  'medium-fast-shouting': 'medium-fast',
  'medium': 'medium',
  'medium-slow': 'medium-slow',
  'slow': 'slow',
  'reverential': 'slow',
  'ballad': 'slow',
};

const CHORDPRO_DIRECTIVE_RE = /^\{(\w+):\s*(.*?)\}$/;
const CHORD_TOKEN_RE = /^[A-Ga-g][b#]?(m|maj|min|dim|aug|sus|add|no|M|[0-9]|\/[A-Ga-g][b#]?|\(.*?\))*$/;

// ─── HELPERS ────────────────────────────────────────────────────────────────

function parseFrontmatter(text) {
  const match = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { fm: {}, body: text, raw_fm: '' };
  const raw_fm = match[1];
  const body = match[2];
  const fm = parseYamlSimple(raw_fm);
  return { fm, body, raw_fm };
}

function parseYamlSimple(yaml) {
  const result = {};
  const lines = yaml.split('\n');
  let currentKey = null;
  let currentList = null;

  for (const line of lines) {
    const kvMatch = line.match(/^(\w[\w-]*):\s*(.*)$/);
    if (kvMatch) {
      if (currentKey && currentList) {
        result[currentKey] = currentList;
      }
      currentKey = kvMatch[1];
      const val = kvMatch[2].trim();
      if (val === '' || val === '~' || val === 'null') {
        result[currentKey] = '';
        currentList = null;
      } else if (val === '[]') {
        result[currentKey] = [];
        currentList = null;
      } else if (val.startsWith('[') && val.endsWith(']')) {
        // inline list
        result[currentKey] = val.slice(1, -1).split(',').map(s => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
        currentList = null;
      } else {
        result[currentKey] = val.replace(/^["']|["']$/g, '');
        currentList = null;
      }
    } else if (line.match(/^\s+-\s+(.*)$/)) {
      const itemMatch = line.match(/^\s+-\s+(.*)$/);
      if (itemMatch) {
        if (!currentList) currentList = [];
        currentList.push(itemMatch[1].trim().replace(/^["']|["']$/g, ''));
      }
    }
  }
  if (currentKey && currentList) {
    result[currentKey] = currentList;
  }
  return result;
}

function yamlQuote(val) {
  if (val === null || val === undefined || val === '') return '';
  const s = String(val);
  if (/[:{}\[\],&*?|>!%@`#'"]/.test(s) || s.includes('\n') || /^\s|\s$/.test(s)) {
    return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  }
  return s;
}

function yamlQuoteAlways(val) {
  if (val === null || val === undefined || val === '') return '""';
  const s = String(val);
  return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function writeFrontmatter(fm) {
  const lines = ['---'];
  lines.push(`title: ${yamlQuoteAlways(fm.title || '')}`);
  lines.push(`artist: ${yamlQuoteAlways(fm.artist || '')}`);
  lines.push(`key: ${fm.key || ''}`);
  lines.push(`tempo: ${fm.tempo || ''}`);
  lines.push(`time: ${fm.time ? yamlQuoteAlways(fm.time) : ''}`);
  lines.push(`ccli: ${fm.ccli ? yamlQuoteAlways(fm.ccli) : ''}`);
  lines.push(`copyright: ${fm.copyright ? yamlQuoteAlways(fm.copyright) : ''}`);

  // tags
  if (fm.tags && fm.tags.length > 0) {
    lines.push('tags:');
    for (const t of fm.tags) {
      lines.push(`  - "${t}"`);
    }
  } else {
    lines.push('tags: []');
  }

  lines.push(`genre: ${fm.genre && fm.genre.length ? JSON.stringify(fm.genre) : '[]'}`);
  lines.push(`energy: ${fm.energy || ''}`);
  lines.push(`profile: ${fm.profile ? yamlQuoteAlways(fm.profile) : ''}`);
  lines.push(`keywords: ${fm.keywords ? yamlQuoteAlways(fm.keywords) : ''}`);
  lines.push(`source: ${fm.source ? yamlQuoteAlways(fm.source) : ''}`);
  lines.push(`year: ${fm.year || ''}`);

  // medley
  if (fm.medley && fm.medley.length > 0) {
    lines.push('medley:');
    for (const m of fm.medley) {
      lines.push(`  - ${yamlQuoteAlways(m)}`);
    }
  } else {
    lines.push('medley: []');
  }

  lines.push(`id: ${yamlQuoteAlways(fm.id || '')}`);
  lines.push('---');
  return lines.join('\n');
}

// ─── TRANSFORM: CHORDPRO DIRECTIVES ────────────────────────────────────────

function harvestChordProDirectives(body, fm) {
  const changes = [];
  const newLines = [];
  const directiveMap = {
    title: 'title', subtitle: 'artist', key: 'key', tempo: 'tempo',
    time: 'time', keywords: 'keywords', copyright: 'copyright', ccli: 'ccli',
  };

  for (const line of body.split('\n')) {
    const m = line.match(CHORDPRO_DIRECTIVE_RE);
    if (m) {
      const directive = m[1].toLowerCase();
      const value = m[2].trim();
      const fmField = directiveMap[directive];
      if (fmField) {
        if (!fm[fmField] || fm[fmField] === '') {
          fm[fmField] = value;
          changes.push(`  Harvested {${directive}: ${value}} → frontmatter.${fmField}`);
        } else {
          changes.push(`  Stripped duplicate {${directive}: ${value}} (already in frontmatter)`);
        }
        continue; // remove from body
      }
    }
    newLines.push(line);
  }
  return { body: newLines.join('\n'), changes };
}

// ─── TRANSFORM: STRIP BARE METADATA LINES AT TOP OF BODY ───────────────────

function stripBareMetadataLines(body, fm) {
  const changes = [];
  const lines = body.split('\n');
  const newLines = [];
  let inHeaderZone = true; // only strip from the top of the body

  for (const line of lines) {
    if (!inHeaderZone) {
      newLines.push(line);
      continue;
    }

    const trimmed = line.trim();

    // Empty lines in header zone — keep but continue checking
    if (trimmed === '') {
      newLines.push(line);
      continue;
    }

    // Check if this line is a bare metadata duplicate
    let stripped = false;

    // Exit header zone if we see a chord-only line or section label
    if (isChordOnlyLine(trimmed) || isSectionLabel(trimmed)) {
      inHeaderZone = false;
      newLines.push(line);
      continue;
    }

    // Bare title line (matches frontmatter title, case-insensitive)
    if (fm.title && trimmed.toLowerCase() === fm.title.toLowerCase()) {
      changes.push(`  Stripped bare title line: "${trimmed}"`);
      stripped = true;
    }
    // Bare artist line
    else if (fm.artist && trimmed.toLowerCase() === fm.artist.toLowerCase()) {
      changes.push(`  Stripped bare artist line: "${trimmed}"`);
      stripped = true;
    }
    // Key: X or just the key
    else if (/^key:\s*.+/i.test(trimmed)) {
      const val = trimmed.replace(/^key:\s*/i, '').trim();
      if (!fm.key || fm.key === '') fm.key = val;
      changes.push(`  Stripped bare Key line: "${trimmed}"`);
      stripped = true;
    }
    // Tempo: X
    else if (/^tempo:\s*.+/i.test(trimmed)) {
      const val = trimmed.replace(/^tempo:\s*/i, '').trim();
      if (!fm.tempo || fm.tempo === '') fm.tempo = val;
      changes.push(`  Stripped bare Tempo line: "${trimmed}"`);
      stripped = true;
    }
    // Time: X
    else if (/^time:\s*.+/i.test(trimmed)) {
      const val = trimmed.replace(/^time:\s*/i, '').trim();
      if (!fm.time || fm.time === '') fm.time = val;
      changes.push(`  Stripped bare Time line: "${trimmed}"`);
      stripped = true;
    }
    // CCLI: X
    else if (/^ccli:\s*.+/i.test(trimmed)) {
      const val = trimmed.replace(/^ccli:\s*/i, '').trim();
      if (!fm.ccli || fm.ccli === '') fm.ccli = val;
      changes.push(`  Stripped bare CCLI line: "${trimmed}"`);
      stripped = true;
    }
    // Copyright: X
    else if (/^copyright:\s*.+/i.test(trimmed)) {
      const val = trimmed.replace(/^copyright:\s*/i, '').trim();
      if (!fm.copyright || fm.copyright === '') fm.copyright = val;
      changes.push(`  Stripped bare Copyright line: "${trimmed}"`);
      stripped = true;
    }
    // Keywords: X
    else if (/^keywords:\s*.+/i.test(trimmed)) {
      const val = trimmed.replace(/^keywords:\s*/i, '').trim();
      if (!fm.keywords || fm.keywords === '') fm.keywords = val;
      changes.push(`  Stripped bare Keywords line: "${trimmed}"`);
      stripped = true;
    }
    // Artist: X (some files have "Artist: Name" in body)
    else if (/^artist:\s*.+/i.test(trimmed)) {
      const val = trimmed.replace(/^artist:\s*/i, '').trim();
      if (!fm.artist || fm.artist === '') fm.artist = val;
      changes.push(`  Stripped bare Artist line: "${trimmed}"`);
      stripped = true;
    }
    // Title: X
    else if (/^title:\s*.+/i.test(trimmed)) {
      changes.push(`  Stripped bare Title line: "${trimmed}"`);
      stripped = true;
    }
    // Bare line that exactly matches artist with extra info (like "Leonard J Le Blanc/ Paul Joseph Baloche")
    // Only strip if it looks like a byline (no chords, short, at top)
    else if (!trimmed.startsWith('[') && trimmed.length < 80 && !trimmed.includes(':') && inHeaderZone) {
      // Check if it looks like a bare author/byline line (no chords, not a lyric)
      // Must: already have stripped header lines, look like a name, be mixed case (not ALL CAPS)
      // Must NOT: contain chord-like patterns, be all uppercase (that's lyrics)
      const hasChordPattern = /[A-G][b#]?(m|sus|dim|aug|maj|add|\/[A-G])|\d/.test(trimmed);
      const isAllCaps = trimmed === trimmed.toUpperCase() && /[A-Z]{3,}/.test(trimmed);
      if (changes.length > 0 && !hasChordPattern && !isAllCaps && /^[A-Z][a-zA-Z\s.,&\/|'"-]+$/.test(trimmed) && trimmed.length < 60) {
        changes.push(`  Stripped bare byline: "${trimmed}"`);
        stripped = true;
      } else {
        inHeaderZone = false;
        newLines.push(line);
      }
    } else {
      inHeaderZone = false;
      newLines.push(line);
    }

    if (!stripped) {
      // already pushed above
    }
  }

  return { body: newLines.join('\n'), changes };
}

// ─── TRANSFORM: COMPOUND TAGS → PROFILE ────────────────────────────────────

function processCompoundTags(tags) {
  const changes = [];
  let profile = '';
  const cleanTags = [];
  const seen = new Set();

  for (const tag of tags) {
    // Detect mega compound tag: has 3+ hyphens and is longer than any reasonable two-word tag
    const parts = tag.split('-');
    if (parts.length >= 4 && tag.length > 25) {
      profile = tag.toLowerCase();
      changes.push(`  Extracted compound tag → profile: "${tag}"`);
      // Don't add individual parts — they should already exist as separate tags
      continue;
    }

    const normalized = tag; // Keep original casing for now, we'll lowercase later
    const key = normalized.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      cleanTags.push(normalized);
    }
  }

  return { tags: cleanTags, profile, changes };
}

// ─── TRANSFORM: THEMES FROM BODY ───────────────────────────────────────────

function extractThemesFromBody(body) {
  const changes = [];
  const themes = [];
  const newLines = [];

  for (const line of body.split('\n')) {
    const m = line.match(/^\s*THEMES?:\s*(.+)$/i);
    if (m) {
      const raw = m[1].split(/[,;]+/).map(t => t.trim().toLowerCase()).filter(Boolean);
      themes.push(...raw);
      changes.push(`  Moved THEMES to tags: ${raw.join(', ')}`);
      continue;
    }
    // Strip stray Hebrew/artifact characters
    const cleaned = line.replace(/[\u0590-\u05FF]+/g, '').trimEnd();
    if (cleaned !== line) {
      if (cleaned.trim() === '' && line.trim().length <= 4) {
        changes.push(`  Stripped artifact characters: "${line.trim()}"`);
        continue;
      }
    }
    newLines.push(cleaned);
  }

  return { body: newLines.join('\n'), themes, changes };
}

// ─── TRANSFORM: NORMALIZE ARTIST ───────────────────────────────────────────

function normalizeArtist(artist) {
  if (!artist) return { artist: '', year: '', source: '', changes: [] };
  const changes = [];
  let year = '';
  let source = '';
  let clean = artist;

  // Extract year: "Rev. J. Michael Wilson, 1984" → year=1984
  const yearMatch = clean.match(/,?\s*(\d{4})\s*$/);
  if (yearMatch) {
    year = yearMatch[1];
    clean = clean.replace(yearMatch[0], '').trim();
    changes.push(`  Extracted year from artist: ${year}`);
  }

  // Extract parenthetical source: "(Sing Unto The Lord Songbook, 16)"
  const parenMatch = clean.match(/\s*\(([^)]+)\)\s*$/);
  if (parenMatch) {
    source = parenMatch[1].trim();
    clean = clean.replace(parenMatch[0], '').trim();
    changes.push(`  Extracted source from artist: "${source}"`);
  }

  if (clean !== artist) {
    changes.push(`  Normalized artist: "${artist}" → "${clean}"`);
  }

  return { artist: clean, year, source, changes };
}

// ─── TRANSFORM: SECTION LABELS ─────────────────────────────────────────────

function isSectionLabel(line) {
  const trimmed = line.trim().replace(/:?\s*$/, '').toUpperCase();
  // Match "VERSE 1", "CHORUS", "CHORUS MOD", "BRIDGE 2", "TAG", etc.
  for (const label of SECTION_LABELS) {
    if (trimmed === label || trimmed.match(new RegExp(`^${label}\\s*\\d*$`))) {
      return true;
    }
  }
  // Also match things like "Verse 1:", "Chorus:", "Intro 2x:"
  if (/^(VERSE|CHORUS|BRIDGE|TAG|VAMP|INTRO|OUTRO|INTERLUDE|INSTRUMENTAL|AD\s*LIB|DESCANT|TURNAROUND|ENDING|PRE-CHORUS)\s*(MOD)?\s*\d*\s*(x\d+)?/i.test(trimmed)) {
    return true;
  }
  return false;
}

function standardizeSectionLabels(body) {
  const changes = [];
  const lines = body.split('\n');
  const newLines = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) { newLines.push(line); continue; }

    // Check if this line is a section label
    const labelMatch = trimmed.match(/^(VERSE|CHORUS|BRIDGE|TAG|VAMP|INTRO|OUTRO|INTERLUDE|INSTRUMENTAL|AD\s*LIB|DESCANT|TURNAROUND|ENDING|PRE-CHORUS)\s*(MOD)?\s*(\d*)\s*(x\d+)?\s*:?\s*$/i);
    if (labelMatch) {
      const type = labelMatch[1].toUpperCase().replace(/\s+/g, ' ');
      const mod = labelMatch[2] ? ' MOD' : '';
      const num = labelMatch[3] || '';
      const repeat = labelMatch[4] ? ` ${labelMatch[4].toLowerCase()}` : '';
      const standardized = `${type}${mod}${num ? ' ' + num : ''}:${repeat}`;

      if (standardized !== trimmed) {
        changes.push(`  Section label: "${trimmed}" → "${standardized}"`);
      }
      newLines.push(standardized);
    } else {
      newLines.push(line);
    }
  }

  return { body: newLines.join('\n'), changes };
}

// ─── TRANSFORM: DUPLICATE SECTIONS ─────────────────────────────────────────

function removeDuplicateSections(body) {
  const changes = [];
  const lines = body.split('\n');
  const sections = [];
  let currentSection = { label: '__preamble__', lines: [] };

  // Parse into sections
  for (const line of lines) {
    if (isSectionLabel(line.trim())) {
      sections.push(currentSection);
      currentSection = { label: line.trim(), lines: [] };
    } else {
      currentSection.lines.push(line);
    }
  }
  sections.push(currentSection);

  // Detect consecutive duplicates
  const kept = [];
  for (let i = 0; i < sections.length; i++) {
    const sec = sections[i];
    if (i > 0) {
      const prev = sections[i - 1];
      const prevText = prev.lines.join('\n').trim().toLowerCase();
      const curText = sec.lines.join('\n').trim().toLowerCase();
      if (prev.label === sec.label && prevText === curText && prevText.length > 0) {
        changes.push(`  Removed duplicate section: "${sec.label}"`);
        continue;
      }
    }
    kept.push(sec);
  }

  // Rebuild
  const newLines = [];
  for (const sec of kept) {
    if (sec.label !== '__preamble__') {
      newLines.push(sec.label);
    }
    newLines.push(...sec.lines);
  }

  return { body: newLines.join('\n'), changes };
}

// ─── TRANSFORM: ENERGY DERIVATION ──────────────────────────────────────────

function deriveEnergy(tags, tempo) {
  // If tempo exists, derive from that
  if (tempo) {
    const bpm = parseInt(tempo);
    if (!isNaN(bpm)) {
      if (bpm >= 140) return 'high';
      if (bpm >= 110) return 'medium-fast';
      if (bpm >= 85) return 'medium';
      if (bpm >= 65) return 'medium-slow';
      return 'slow';
    }
  }

  // Otherwise derive from tags
  for (const tag of tags) {
    const key = tag.toLowerCase();
    if (ENERGY_MAP[key]) return ENERGY_MAP[key];
  }

  return '';
}

// ─── TRANSFORM: TITLE CASE ─────────────────────────────────────────────────

function toTitleCase(str) {
  if (!str) return '';
  const smallWords = new Set(['a', 'an', 'the', 'and', 'but', 'or', 'for', 'nor', 'at', 'by', 'in', 'of', 'on', 'to', 'up', 'as', 'is', 'it']);
  return str.replace(/\w+('[a-z]+)?/gi, (word, suffix, index) => {
    // Always capitalize first and last word
    if (index === 0 || index + word.length === str.length) {
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    }
    if (smallWords.has(word.toLowerCase())) {
      return word.toLowerCase();
    }
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  });
}

// ─── TRANSFORM: SENTENCE CASE FOR LYRICS ────────────────────────────────────

function toSentenceCase(line) {
  if (!line) return '';

  // Don't touch section labels
  if (isSectionLabel(line.trim())) return line;

  // Don't touch lines that are only chords (standalone chord lines like intros)
  if (isChordOnlyLine(line)) return line;

  // Don't touch performance notes (lines starting with *)
  if (line.trim().startsWith('*')) return line;

  // Extract chord brackets to protect them
  const chords = [];
  let stripped = line.replace(/\[([^\]]*)\]/g, (match) => {
    chords.push(match);
    return `\x01${chords.length - 1}\x02`;
  });

  // If the line is already mixed case (has both upper and lower), leave it
  // Only convert if line is ALL CAPS (or mostly)
  const textOnly = stripped.replace(/\x01\d+\x02/g, '').replace(/[^a-zA-Z]/g, '');
  if (textOnly.length === 0) {
    // Re-insert chords and return
    let result = stripped;
    chords.forEach((c, i) => { result = result.replace(`\x01${i}\x02`, c); });
    return result;
  }

  const upperCount = (textOnly.match(/[A-Z]/g) || []).length;
  const lowerCount = (textOnly.match(/[a-z]/g) || []).length;

  // Only convert if >80% uppercase (i.e., it's an ALL CAPS line)
  if (upperCount / textOnly.length < 0.8) {
    let result = stripped;
    chords.forEach((c, i) => { result = result.replace(`\x01${i}\x02`, c); });
    return result;
  }

  // Convert to sentence case
  stripped = stripped.toLowerCase();

  // Capitalize first letter of the line
  stripped = stripped.replace(/^(\s*)([a-z])/, (m, ws, ch) => ws + ch.toUpperCase());

  // Capitalize after sentence-ending punctuation
  stripped = stripped.replace(/([.!?]\s+)([a-z])/g, (m, punct, ch) => punct + ch.toUpperCase());

  // Capitalize sacred/proper words
  stripped = stripped.replace(/\b([a-z]+)\b/g, (match) => {
    if (SACRED_WORDS.has(match)) {
      // Special handling: "i" should be "I", others get title case
      if (match === 'i') return 'I';
      if (match === 'o' || match === 'oh') return match.charAt(0).toUpperCase() + match.slice(1);
      return match.charAt(0).toUpperCase() + match.slice(1);
    }
    return match;
  });

  // Re-insert chords
  let result = stripped;
  chords.forEach((c, i) => { result = result.replace(`\x01${i}\x02`, c); });

  // Capitalize first actual letter of the line (may come after chord brackets)
  result = result.replace(/^(\s*(?:\[[^\]]*\]\s*)*)([a-z])/, (m, prefix, ch) => prefix + ch.toUpperCase());

  return result;
}

// ─── TRANSFORM: CHORDS ABOVE LINE → INLINE BRACKETS ────────────────────────

function isChordOnlyLine(line) {
  const trimmed = line.trim();
  if (!trimmed) return false;

  // Remove common non-chord decorations
  let cleaned = trimmed.replace(/[-─—=]+/g, '').trim();
  if (!cleaned) return false;

  // Split by whitespace and check if every token looks like a chord
  const tokens = cleaned.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return false;

  let chordCount = 0;
  for (const token of tokens) {
    // Allow: chord symbols, slashes between chords, repeat markers, parentheses
    const t = token.replace(/[()]/g, '');
    if (!t) continue;
    // Chord pattern: starts with A-G, optionally has b/#, then qualifiers
    if (/^[A-Ga-g][b#]?(m|maj|min|dim|aug|sus|add|no|M|[0-9]|\/[A-Ga-g][b#]?[a-z0-9]*|\(.*?\))*[0-9]?$/.test(t)) {
      chordCount++;
    }
    // Also allow: [/] rhythm markers, repeat indicators like "2x", "x2"
    else if (/^[x×]?\d+[x×]?$/.test(t) || t === '/' || t === '|' || t === '||') {
      // not a chord but allowed on chord lines
    } else {
      return false;
    }
  }
  return chordCount >= 1;
}

function mergeChordLineWithLyric(chordLine, lyricLine) {
  // Parse chord positions from chord line
  const chords = [];
  const re = /(\S+)/g;
  let m;
  while ((m = re.exec(chordLine)) !== null) {
    const token = m[1].replace(/[()]/g, '');
    // Verify it looks like a chord
    if (/^[A-Ga-g][b#]?(m|maj|min|dim|aug|sus|add|no|M|[0-9]|\/[A-Ga-g][b#]?[a-z0-9]*|\(.*?\))*[0-9]?$/.test(token)) {
      chords.push({ pos: m.index, chord: m[1] }); // keep original with parens
    }
  }

  if (chords.length === 0) return lyricLine;

  // If lyric line is empty, just return chords in brackets
  if (!lyricLine || !lyricLine.trim()) {
    return chords.map(c => `[${c.chord}]`).join(' ');
  }

  // Insert chords into lyric at corresponding positions
  // We need to account for the offset added by previous insertions
  let result = lyricLine;
  let offset = 0;

  for (const { pos, chord } of chords) {
    const bracket = `[${chord}]`;
    const insertAt = Math.min(pos + offset, result.length);

    // Try to insert at a word boundary if close
    result = result.slice(0, insertAt) + bracket + result.slice(insertAt);
    offset += bracket.length;
  }

  return result;
}

function convertChordsAboveToInline(body) {
  const changes = [];
  const lines = body.split('\n');
  const newLines = [];
  let conversions = 0;

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Check if this is a chord-only line followed by a lyric line
    if (isChordOnlyLine(line) && i + 1 < lines.length) {
      const nextLine = lines[i + 1];
      const nextTrimmed = nextLine.trim();

      // If next line has actual text (lyrics), merge
      if (nextTrimmed && !isChordOnlyLine(nextLine) && !isSectionLabel(nextTrimmed) && /[a-zA-Z]{2,}/.test(nextTrimmed)) {
        const merged = mergeChordLineWithLyric(line, nextLine);
        newLines.push(merged);
        conversions++;
        i += 2; // skip both lines
        continue;
      }
      // If next line is empty or another chord line, wrap chords in brackets
      else if (!nextTrimmed || isChordOnlyLine(nextLine)) {
        // Standalone chord line (like an intro) — wrap individual chords
        const wrapped = line.replace(/([A-Ga-g][b#]?(?:m|maj|min|dim|aug|sus|add|no|M|[0-9]|\/[A-Ga-g][b#]?[a-z0-9]*|\(.*?\))*[0-9]?)/g, '[$1]');
        // Only convert if it actually changed (avoid double-bracketing)
        if (!line.includes('[')) {
          newLines.push(wrapped);
          conversions++;
        } else {
          newLines.push(line);
        }
        i++;
        continue;
      }
    }

    newLines.push(line);
    i++;
  }

  if (conversions > 0) {
    changes.push(`  Converted ${conversions} chords-above-line → inline brackets`);
  }

  return { body: newLines.join('\n'), changes };
}

// ─── TRANSFORM: CLEAN TRAILING WHITESPACE & BLANK LINES ────────────────────

function cleanWhitespace(body) {
  // Remove leading blank lines
  let cleaned = body.replace(/^\n+/, '');
  // Remove trailing blank lines
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  cleaned = cleaned.trimEnd();
  return cleaned;
}

// ─── MAIN NORMALIZATION PIPELINE ────────────────────────────────────────────

function normalizeFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const fileName = path.basename(filePath);
  const allChanges = [];

  // 1. Parse frontmatter
  const { fm, body: rawBody } = parseFrontmatter(raw);
  if (!fm.title && !rawBody) {
    return { fileName, changes: ['  SKIPPED: Could not parse frontmatter'], output: raw };
  }

  // 2. Harvest ChordPro directives from body → frontmatter
  let { body, changes: chordProChanges } = harvestChordProDirectives(rawBody, fm);
  allChanges.push(...chordProChanges);

  // 3. Strip bare metadata lines at top of body
  let result2 = stripBareMetadataLines(body, fm);
  body = result2.body;
  allChanges.push(...result2.changes);

  // 4. Extract THEMES from body → tags
  let result3 = extractThemesFromBody(body);
  body = result3.body;
  allChanges.push(...result3.changes);
  const extraTags = result3.themes;

  // 5. Process compound tags → profile
  const currentTags = Array.isArray(fm.tags) ? [...fm.tags] : [];
  const { tags: cleanTags, profile, changes: tagChanges } = processCompoundTags(currentTags);
  allChanges.push(...tagChanges);

  // Add theme tags
  const tagSet = new Set(cleanTags.map(t => t.toLowerCase()));
  for (const t of extraTags) {
    if (!tagSet.has(t.toLowerCase())) {
      cleanTags.push(t);
      tagSet.add(t.toLowerCase());
    }
  }

  // Lowercase all tags
  fm.tags = cleanTags.map(t => t.toLowerCase());
  if (profile) fm.profile = profile;

  // 6. Normalize artist
  const artistResult = normalizeArtist(fm.artist);
  fm.artist = artistResult.artist;
  if (artistResult.year && (!fm.year || fm.year === '')) fm.year = artistResult.year;
  if (artistResult.source && (!fm.source || fm.source === '')) fm.source = artistResult.source;
  allChanges.push(...artistResult.changes);

  // 7. Derive energy
  const energy = deriveEnergy(fm.tags, fm.tempo);
  if (energy && energy !== fm.energy) {
    allChanges.push(`  Derived energy: "${energy}"`);
    fm.energy = energy;
  }

  // 8. Title case the title
  if (fm.title) {
    const original = fm.title;
    // Only modify if ALL CAPS or all lowercase
    const textOnly = original.replace(/[^a-zA-Z]/g, '');
    const upperRatio = (textOnly.match(/[A-Z]/g) || []).length / (textOnly.length || 1);
    if (upperRatio > 0.8 || upperRatio < 0.1) {
      fm.title = toTitleCase(original);
      if (fm.title !== original) {
        allChanges.push(`  Title case: "${original}" → "${fm.title}"`);
      }
    }
  }

  // 9. Standardize section labels
  let result5 = standardizeSectionLabels(body);
  body = result5.body;
  allChanges.push(...result5.changes);

  // 10. Remove duplicate sections
  let result6 = removeDuplicateSections(body);
  body = result6.body;
  allChanges.push(...result6.changes);

  // 11. Convert chords-above-line → inline brackets
  let result7 = convertChordsAboveToInline(body);
  body = result7.body;
  allChanges.push(...result7.changes);

  // 12. Sentence case for lyrics (only ALL CAPS lines)
  const sentenceCaseLines = body.split('\n').map(l => toSentenceCase(l));
  const scCount = sentenceCaseLines.filter((l, i) => l !== body.split('\n')[i]).length;
  if (scCount > 0) {
    allChanges.push(`  Sentence-cased ${scCount} ALL CAPS lyric lines`);
  }
  body = sentenceCaseLines.join('\n');

  // 13. Clean whitespace
  body = cleanWhitespace(body);

  // 14. Ensure all fields exist
  fm.time = fm.time || '';
  fm.ccli = fm.ccli || '';
  fm.copyright = fm.copyright || '';
  fm.genre = fm.genre || [];
  fm.energy = fm.energy || '';
  fm.profile = fm.profile || '';
  fm.keywords = fm.keywords || '';
  fm.source = fm.source || '';
  fm.year = fm.year || '';
  fm.medley = fm.medley || [];
  fm.id = fm.id || '';

  // Build output
  const output = writeFrontmatter(fm) + '\n\n' + body + '\n';

  return { fileName, changes: allChanges, output, fm };
}

// ─── CLI ────────────────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.log('Usage: node normalize_songs.js <input_dir> [--apply] [--out <output_dir>]');
    process.exit(1);
  }

  const inputDir = args[0];
  const applyMode = args.includes('--apply');
  const outIdx = args.indexOf('--out');
  const outputDir = outIdx >= 0 ? args[outIdx + 1] : inputDir + '_normalized';

  if (!fs.existsSync(inputDir)) {
    console.error(`Input directory not found: ${inputDir}`);
    process.exit(1);
  }

  const files = fs.readdirSync(inputDir).filter(f => f.endsWith('.md'));
  console.log(`Found ${files.length} .md files in ${inputDir}`);
  console.log(applyMode ? 'MODE: APPLY (will write files)' : 'MODE: DRY RUN (report only)');
  console.log('');

  const report = [];
  let totalChanges = 0;
  let filesChanged = 0;
  let filesUnchanged = 0;

  if (applyMode) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  for (const file of files) {
    const filePath = path.join(inputDir, file);
    try {
      const { fileName, changes, output } = normalizeFile(filePath);

      if (changes.length > 0) {
        report.push(`\n📝 ${fileName} (${changes.length} changes)`);
        report.push(...changes);
        totalChanges += changes.length;
        filesChanged++;
      } else {
        filesUnchanged++;
      }

      if (applyMode) {
        const outPath = path.join(outputDir, file);
        fs.writeFileSync(outPath, output, 'utf8');
      }
    } catch (err) {
      report.push(`\n❌ ${file}: ERROR - ${err.message}`);
    }
  }

  // Summary
  const summary = [
    '\n' + '═'.repeat(60),
    'NORMALIZATION REPORT SUMMARY',
    '═'.repeat(60),
    `Files processed:  ${files.length}`,
    `Files changed:    ${filesChanged}`,
    `Files unchanged:  ${filesUnchanged}`,
    `Total changes:    ${totalChanges}`,
    applyMode ? `Output written to: ${outputDir}` : 'DRY RUN — no files were modified',
    '═'.repeat(60),
  ];

  const fullReport = [...report, ...summary].join('\n');
  console.log(fullReport);

  // Write report file
  const reportPath = applyMode ? path.join(outputDir, '_REPORT.txt') : path.join(inputDir, '_DRY_RUN_REPORT.txt');
  fs.writeFileSync(reportPath, fullReport, 'utf8');
  console.log(`\nReport written to: ${reportPath}`);
}

main();
