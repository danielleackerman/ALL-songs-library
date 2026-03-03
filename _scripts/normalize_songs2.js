#!/usr/bin/env node
/**
 * normalize_songs.js — Song Markdown Normalization Script v2
 * Usage: node normalize_songs.js <input_dir> [--apply] [--out <output_dir>]
 */
const fs = require('fs');
const path = require('path');

// ─── CONFIG ─────────────────────────────────────────────────────────────────
const SACRED_WORDS = new Set([
  'i','lord','god','jesus','christ','holy','spirit','father','king','lamb',
  'savior','saviour','messiah','emmanuel','immanuel','jehovah','adonai','elohim',
  'zion','calvary','israel','jordan','nazareth','bethlehem','galilee','jerusalem','eden',
  'mary','moses','david','abraham','solomon','paul','peter','john','satan','devil',
  'bible','scripture','psalm','christmas','easter','pentecost',
  'hallelujah','alleluia','hosanna','amen',
  'o','oh','thy','thee','thou','thine','he','his','him','you','your',
]);
const SECTION_LABELS = [
  'INTRO','VERSE','CHORUS','CHORUS MOD','BRIDGE','TAG','VAMP','OUTRO',
  'INTERLUDE','INSTRUMENTAL','AD LIB','DESCANT','TURNAROUND','ENDING','PRE-CHORUS',
];
const ENERGY_MAP = {
  'high-energy':'high','energetic':'high','shouting':'high',
  'medium-fast':'medium-fast','medium-fast-shouting':'medium-fast',
  'medium':'medium','medium-slow':'medium-slow',
  'slow':'slow','reverential':'slow','ballad':'slow','slow-reverential':'slow',
  'slow-energetic':'medium-slow',
};

// ─── YAML / FRONTMATTER HELPERS ─────────────────────────────────────────────
function parseFrontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { fm: {}, body: text };
  return { fm: parseYaml(m[1]), body: m[2] };
}
function parseYaml(yaml) {
  const r = {}; const lines = yaml.split('\n');
  let curKey = null, curList = null;
  for (const line of lines) {
    const kv = line.match(/^(\w[\w-]*):\s*(.*)$/);
    if (kv) {
      if (curKey && curList) r[curKey] = curList;
      curKey = kv[1]; const v = kv[2].trim(); curList = null;
      if (v===''||v==='~'||v==='null') r[curKey] = '';
      else if (v==='[]') r[curKey] = [];
      else if (v.startsWith('[')&&v.endsWith(']')) r[curKey]=v.slice(1,-1).split(',').map(s=>s.trim().replace(/^["']|["']$/g,'')).filter(Boolean);
      else r[curKey]=v.replace(/^["']|["']$/g,'');
    } else { const it=line.match(/^\s+-\s+(.*)$/); if(it){if(!curList)curList=[];curList.push(it[1].trim().replace(/^["']|["']$/g,''));} }
  }
  if (curKey&&curList) r[curKey]=curList;
  return r;
}
function q(val) {
  if(val===null||val===undefined||val==='') return '""';
  const s=String(val); return `"${s.replace(/\\/g,'\\\\').replace(/"/g,'\\"')}"`;
}
function writeFrontmatter(fm) {
  const L = ['---'];
  L.push(`title: ${q(fm.title)}`);
  L.push(`artist: ${q(fm.artist)}`);
  L.push(`key: ${fm.key||''}`);
  L.push(`tempo: ${fm.tempo||''}`);
  L.push(`time: ${fm.time?q(fm.time):''}`);
  L.push(`ccli: ${fm.ccli?q(fm.ccli):''}`);
  L.push(`copyright: ${fm.copyright?q(fm.copyright):''}`);
  if(fm.tags&&fm.tags.length){L.push('tags:');for(const t of fm.tags)L.push(`  - "${t}"`);}else L.push('tags: []');
  L.push(`genre: ${fm.genre&&fm.genre.length?JSON.stringify(fm.genre):'[]'}`);
  L.push(`energy: ${fm.energy||''}`);
  if(fm.profile&&fm.profile.length){L.push('profile:');for(const p of fm.profile)L.push(`  - "${p}"`);}else L.push('profile: []');
  L.push(`keywords: ${fm.keywords?q(fm.keywords):''}`);
  L.push(`source: ${fm.source?q(fm.source):''}`);
  L.push(`year: ${fm.year||''}`);
  if(fm.medley&&fm.medley.length){L.push('medley:');for(const m of fm.medley)L.push(`  - ${q(m)}`);}else L.push('medley: []');
  L.push(`id: ${q(fm.id)}`);
  L.push('---');
  return L.join('\n');
}

// ─── SECTION HELPERS ────────────────────────────────────────────────────────
function isSectionLabel(line) {
  const t = line.trim().replace(/:?\s*$/,'').toUpperCase();
  return /^(VERSE|CHORUS|BRIDGE|TAG|VAMP|INTRO|OUTRO|INTERLUDE|INSTRUMENTAL|AD\s*LIB|DESCANT|TURNAROUND|ENDING|PRE-CHORUS)\s*(MOD)?\s*\d*\s*(x\d+)?$/i.test(t);
}
function isChordOnlyLine(line) {
  const t = line.trim().replace(/[-=]+/g,'').trim();
  if (!t || t.length < 2) return false;
  const tokens = t.split(/\s+/).filter(Boolean);
  if (!tokens.length) return false;
  let chords = 0;
  for (const tok of tokens) {
    const c = tok.replace(/[()]/g,'');
    if (!c) continue;
    if (/^[A-Ga-g][b#]?(m|maj|min|dim|aug|sus|add|no|M|[0-9]|\/[A-Ga-g][b#]?[a-z0-9]*|\(.*?\))*[0-9]?$/.test(c)) chords++;
    else if (/^[x]?\d+[x]?$/.test(c)||c==='/'||c==='|'||c==='||') {}
    else return false;
  }
  return chords >= 1;
}

// ─── TRANSFORM: CHORDPRO DIRECTIVES ────────────────────────────────────────
function harvestChordPro(body, fm) {
  const changes = [], newLines = [];
  const map = {title:'title',subtitle:'artist',key:'key',tempo:'tempo',time:'time',keywords:'keywords',copyright:'copyright',ccli:'ccli'};
  for (const line of body.split('\n')) {
    const m = line.match(/^\{(\w+):\s*(.*?)\}$/);
    if (m) {
      const d = m[1].toLowerCase(), v = m[2].trim(), f = map[d];
      if (f) {
        if (!fm[f]||fm[f]==='') { fm[f]=v; changes.push(`  Harvested {${d}: ${v}} -> frontmatter.${f}`); }
        else changes.push(`  Stripped duplicate {${d}: ${v}}`);
        continue;
      }
    }
    newLines.push(line);
  }
  return { body: newLines.join('\n'), changes };
}

// ─── TRANSFORM: STRIP BARE METADATA LINES ──────────────────────────────────
function stripBareMetadata(body, fm) {
  const changes = [], newLines = [], lines = body.split('\n');
  let inHeader = true, capturedNames = [];
  for (const line of lines) {
    if (!inHeader) { newLines.push(line); continue; }
    const t = line.trim();
    if (t === '') { newLines.push(line); continue; }
    // Exit header on chord lines or section labels
    if (isChordOnlyLine(t) || isSectionLabel(t)) { inHeader = false; newLines.push(line); continue; }
    let stripped = false;
    if (fm.title && t.toLowerCase() === fm.title.toLowerCase()) { changes.push(`  Stripped bare title line: "${t}"`); stripped = true; }
    else if (fm.artist && t.toLowerCase() === fm.artist.toLowerCase()) { changes.push(`  Stripped bare artist line: "${t}"`); stripped = true; }
    else if (/^key:\s*.+/i.test(t)) { const v=t.replace(/^key:\s*/i,'').trim().replace(/[\[\]]/g,''); if(!fm.key||fm.key==='')fm.key=v; changes.push(`  Stripped bare Key line: "${t}"`); stripped=true; }
    else if (/^tempo:\s*.+/i.test(t)) { const v=t.replace(/^tempo:\s*/i,'').trim(); if(!fm.tempo||fm.tempo==='')fm.tempo=v; changes.push(`  Stripped bare Tempo line: "${t}"`); stripped=true; }
    else if (/^time:\s*.+/i.test(t)) { const v=t.replace(/^time:\s*/i,'').trim(); if(!fm.time||fm.time==='')fm.time=v; changes.push(`  Stripped bare Time line: "${t}"`); stripped=true; }
    else if (/^ccli:\s*.+/i.test(t)) { const v=t.replace(/^ccli:\s*/i,'').trim(); if(!fm.ccli||fm.ccli==='')fm.ccli=v; changes.push(`  Stripped bare CCLI line: "${t}"`); stripped=true; }
    else if (/^copyright:\s*.+/i.test(t)) { const v=t.replace(/^copyright:\s*/i,'').trim(); if(!fm.copyright||fm.copyright==='')fm.copyright=v; changes.push(`  Stripped bare Copyright line: "${t}"`); stripped=true; }
    else if (/^keywords:\s*.+/i.test(t)) { const v=t.replace(/^keywords:\s*/i,'').trim(); if(!fm.keywords||fm.keywords==='')fm.keywords=v; changes.push(`  Stripped bare Keywords line: "${t}"`); stripped=true; }
    else if (/^artist:\s*.+/i.test(t)) { const v=t.replace(/^artist:\s*/i,'').trim(); if(!fm.artist||fm.artist==='')fm.artist=v; changes.push(`  Stripped bare Artist line: "${t}"`); stripped=true; }
    else if (/^title:\s*.+/i.test(t)) { changes.push(`  Stripped bare Title line: "${t}"`); stripped=true; }
    else if (!t.startsWith('[') && t.length < 80 && !t.includes(':') && inHeader) {
      // Possible bare byline/performer name — capture to source
      const hasChord = /[A-G][b#]?(m|sus|dim|aug|maj|add|\/[A-G])|\d/.test(t);
      const isAllCaps = t === t.toUpperCase() && /[A-Z]{3,}/.test(t);
      if (!hasChord && !isAllCaps && /^[A-Z][a-zA-Z\s.,&\/|'"-]+$/.test(t) && t.length < 60 && t.length > 3) {
        capturedNames.push(t);
        changes.push(`  Captured body name -> source: "${t}"`);
        stripped = true;
      } else { inHeader = false; newLines.push(line); }
    } else { inHeader = false; newLines.push(line); }
  }
  // Append captured names to source
  if (capturedNames.length > 0) {
    const existing = fm.source || '';
    const combined = [existing, ...capturedNames].filter(Boolean).join('; ');
    fm.source = combined;
  }
  return { body: newLines.join('\n'), changes };
}

// ─── TRANSFORM: THEMES FROM BODY ───────────────────────────────────────────
function extractThemes(body) {
  const changes = [], themes = [], newLines = [];
  for (const line of body.split('\n')) {
    const m = line.match(/^\s*THEMES?:\s*(.+)$/i);
    if (m) { const raw=m[1].split(/[,;]+/).map(t=>t.trim().toLowerCase()).filter(Boolean); themes.push(...raw); changes.push(`  Moved THEMES to tags: ${raw.join(', ')}`); continue; }
    const cleaned = line.replace(/[\u0590-\u05FF]+/g,'').trimEnd();
    if (cleaned !== line && cleaned.trim()==='' && line.trim().length<=4) { changes.push(`  Stripped artifact: "${line.trim()}"`); continue; }
    newLines.push(cleaned);
  }
  return { body: newLines.join('\n'), themes, changes };
}

// ─── TRANSFORM: COMPOUND TAGS → PROFILE ARRAY ──────────────────────────────
function processCompoundTags(tags) {
  const changes = [], profiles = [], cleanTags = [], seen = new Set();
  for (const tag of tags) {
    const parts = tag.split('-');
    const isLong = parts.length >= 4 && tag.length > 25;
    const isKeyword = parts.length >= 3 && tag.length >= 8 && tag.length < 26 && /^[A-Za-z0-9-]+$/.test(tag) && !/^(medium|slow|fast|high|energetic|reverential|ballad|shouting)/i.test(tag);
    if (isLong || isKeyword) {
      profiles.push(tag.toLowerCase());
      changes.push(`  Extracted compound tag -> profile: "${tag}"`);
      continue;
    }
    const key = tag.toLowerCase();
    if (!seen.has(key)) { seen.add(key); cleanTags.push(tag); }
  }
  return { tags: cleanTags, profiles, changes };
}

// ─── TRANSFORM: NORMALIZE ARTIST ───────────────────────────────────────────
function normalizeArtist(artist) {
  if (!artist) return { artist:'', year:'', source:'', changes:[] };
  const changes = []; let year='',source='',clean=artist;
  const ym = clean.match(/,?\s*(\d{4})\s*$/);
  if (ym) { year=ym[1]; clean=clean.replace(ym[0],'').trim(); changes.push(`  Extracted year: ${year}`); }
  const pm = clean.match(/\s*\(([^)]+)\)\s*$/);
  if (pm) { source=pm[1].trim(); clean=clean.replace(pm[0],'').trim(); changes.push(`  Extracted source: "${source}"`); }
  if (clean!==artist) changes.push(`  Normalized artist: "${artist}" -> "${clean}"`);
  return { artist:clean, year, source, changes };
}

// ─── TRANSFORM: SECTION LABELS ─────────────────────────────────────────────
function standardizeSections(body) {
  const changes = [], newLines = [];
  for (const line of body.split('\n')) {
    const t = line.trim();
    if (!t) { newLines.push(line); continue; }
    const m = t.match(/^(VERSE|CHORUS|BRIDGE|TAG|VAMP|INTRO|OUTRO|INTERLUDE|INSTRUMENTAL|AD\s*LIB|DESCANT|TURNAROUND|ENDING|PRE-CHORUS)\s*(MOD)?\s*(\d*)\s*(x\d+)?\s*:?\s*$/i);
    if (m) {
      const type=m[1].toUpperCase().replace(/\s+/g,' '), mod=m[2]?' MOD':'', num=m[3]||'', rep=m[4]?` ${m[4].toLowerCase()}`:'';
      const std = `${type}${mod}${num?' '+num:''}:${rep}`;
      if (std!==t) changes.push(`  Section: "${t}" -> "${std}"`);
      newLines.push(std);
    } else newLines.push(line);
  }
  return { body: newLines.join('\n'), changes };
}

// ─── TRANSFORM: REMOVE DUPLICATE SECTIONS ───────────────────────────────────
function removeDupeSections(body) {
  const changes = [], lines = body.split('\n'), sections = [];
  let cur = { label:'__pre__', lines:[] };
  for (const line of lines) { if(isSectionLabel(line.trim())){sections.push(cur);cur={label:line.trim(),lines:[]};}else cur.lines.push(line); }
  sections.push(cur);
  const kept = [];
  for (let i=0;i<sections.length;i++) {
    if (i>0) { const p=sections[i-1],c=sections[i]; if(p.label===c.label&&p.lines.join('\n').trim().toLowerCase()===c.lines.join('\n').trim().toLowerCase()&&c.lines.join('').trim().length>0){changes.push(`  Removed duplicate: "${c.label}"`);continue;} }
    kept.push(sections[i]);
  }
  const out = [];
  for (const s of kept) { if(s.label!=='__pre__')out.push(s.label); out.push(...s.lines); }
  return { body: out.join('\n'), changes };
}

// ─── TRANSFORM: ENERGY ─────────────────────────────────────────────────────
function deriveEnergy(tags, tempo) {
  if (tempo) { const b=parseInt(tempo); if(!isNaN(b)){if(b>=140)return'high';if(b>=110)return'medium-fast';if(b>=85)return'medium';if(b>=65)return'medium-slow';return'slow';} }
  for (const t of tags) { const k=t.toLowerCase(); if(ENERGY_MAP[k])return ENERGY_MAP[k]; }
  return '';
}

// ─── TRANSFORM: TITLE CASE ─────────────────────────────────────────────────
function toTitleCase(str) {
  if (!str) return '';
  const small = new Set(['a','an','the','and','but','or','for','nor','at','by','in','of','on','to','up','as','is','it']);
  return str.replace(/\w+('[a-z]+)?/gi, (word, suf, idx) => {
    if (idx===0||idx+word.length===str.length) return word.charAt(0).toUpperCase()+word.slice(1).toLowerCase();
    if (small.has(word.toLowerCase())) return word.toLowerCase();
    return word.charAt(0).toUpperCase()+word.slice(1).toLowerCase();
  });
}

// ─── TRANSFORM: SENTENCE CASE ──────────────────────────────────────────────
function toSentenceCase(line) {
  if (!line) return '';
  if (isSectionLabel(line.trim())) return line;
  if (isChordOnlyLine(line)) return line;
  if (line.trim().startsWith('*')) return line;
  const chords = [];
  let s = line.replace(/\[([^\]]*)\]/g, (match) => { chords.push(match); return `\x01${chords.length-1}\x02`; });
  const textOnly = s.replace(/\x01\d+\x02/g,'').replace(/[^a-zA-Z]/g,'');
  if (!textOnly.length) { let r=s; chords.forEach((c,i)=>{r=r.replace(`\x01${i}\x02`,c);}); return r; }
  const upper = (textOnly.match(/[A-Z]/g)||[]).length;
  if (upper/textOnly.length < 0.8) { let r=s; chords.forEach((c,i)=>{r=r.replace(`\x01${i}\x02`,c);}); return r; }
  s = s.toLowerCase();
  s = s.replace(/^(\s*)([a-z])/, (m,ws,ch) => ws+ch.toUpperCase());
  s = s.replace(/([.!?]\s+)([a-z])/g, (m,p,ch) => p+ch.toUpperCase());
  s = s.replace(/\b([a-z]+)\b/g, (match) => {
    if (SACRED_WORDS.has(match)) { if(match==='i')return'I'; return match.charAt(0).toUpperCase()+match.slice(1); }
    return match;
  });
  let r = s;
  chords.forEach((c,i) => { r = r.replace(`\x01${i}\x02`, c); });
  // Capitalize first text char after leading chords
  r = r.replace(/^(\s*(?:\[[^\]]*\]\s*)*)([a-z])/, (m,pre,ch) => pre+ch.toUpperCase());
  return r;
}

// ─── TRANSFORM: CHORDS ABOVE → INLINE ──────────────────────────────────────
function mergeChordLine(chordLine, lyricLine) {
  const chords = [];
  const re = /(\S+)/g; let m;
  while ((m=re.exec(chordLine))!==null) {
    const t = m[1].replace(/[()]/g,'');
    if (/^[A-Ga-g][b#]?(m|maj|min|dim|aug|sus|add|no|M|[0-9]|\/[A-Ga-g][b#]?[a-z0-9]*)*[0-9]?$/.test(t))
      chords.push({pos:m.index,chord:m[1]});
  }
  if (!chords.length) return lyricLine;
  if (!lyricLine||!lyricLine.trim()) return chords.map(c=>`[${c.chord}]`).join(' ');
  let result=lyricLine, offset=0;
  for (const {pos,chord} of chords) {
    const br=`[${chord}]`, at=Math.min(pos+offset,result.length);
    result=result.slice(0,at)+br+result.slice(at);
    offset+=br.length;
  }
  return result;
}
function convertChordsAbove(body) {
  const changes=[], lines=body.split('\n'), newLines=[]; let convs=0, i=0;
  while (i<lines.length) {
    const line=lines[i];
    if (isChordOnlyLine(line) && i+1<lines.length) {
      const next=lines[i+1], nt=next.trim();
      if (nt && !isChordOnlyLine(next) && !isSectionLabel(nt) && /[a-zA-Z]{2,}/.test(nt)) {
        newLines.push(mergeChordLine(line,next)); convs++; i+=2; continue;
      } else if (!nt||isChordOnlyLine(next)) {
        if (!line.includes('[')) {
          newLines.push(line.replace(/([A-Ga-g][b#]?(?:m|maj|min|dim|aug|sus|add|no|M|[0-9]|\/[A-Ga-g][b#]?[a-z0-9]*)*[0-9]?)/g,'[$1]'));
          convs++;
        } else newLines.push(line);
        i++; continue;
      }
    }
    newLines.push(line); i++;
  }
  if (convs) changes.push(`  Converted ${convs} chords-above-line -> inline brackets`);
  return { body: newLines.join('\n'), changes };
}

// ─── MAIN PIPELINE ──────────────────────────────────────────────────────────
function normalizeFile(filePath) {
  const raw = fs.readFileSync(filePath,'utf8');
  const fileName = path.basename(filePath);
  const ch = [];
  const { fm, body: rawBody } = parseFrontmatter(raw);
  if (!fm.title && !rawBody) return { fileName, changes:['  SKIPPED'], output:raw, profiles:[] };

  // 1. Harvest ChordPro
  let { body, changes:c1 } = harvestChordPro(rawBody, fm); ch.push(...c1);
  // 2. Strip bare metadata, capture names -> source
  let r2 = stripBareMetadata(body, fm); body=r2.body; ch.push(...r2.changes);
  // 3. Themes -> tags
  let r3 = extractThemes(body); body=r3.body; ch.push(...r3.changes);
  // 4. Compound tags -> profiles
  const curTags = Array.isArray(fm.tags)?[...fm.tags]:[];
  const { tags:cleanTags, profiles, changes:c4 } = processCompoundTags(curTags); ch.push(...c4);
  // Add themes
  const tagSet = new Set(cleanTags.map(t=>t.toLowerCase()));
  for (const t of r3.themes) { if(!tagSet.has(t)){cleanTags.push(t);tagSet.add(t);} }
  fm.tags = cleanTags.map(t=>t.toLowerCase());
  fm.profile = profiles; // array
  // 5. Normalize artist
  const ar = normalizeArtist(fm.artist);
  fm.artist=ar.artist; if(ar.year&&!fm.year)fm.year=ar.year;
  if(ar.source){fm.source=[fm.source,ar.source].filter(Boolean).join('; ');}
  ch.push(...ar.changes);
  // 6. Energy
  const en = deriveEnergy(fm.tags,fm.tempo);
  if(en&&en!==fm.energy){ch.push(`  Derived energy: "${en}"`);fm.energy=en;}
  // 7. Title case
  if(fm.title){const orig=fm.title,txt=orig.replace(/[^a-zA-Z]/g,''),ur=(txt.match(/[A-Z]/g)||[]).length/(txt.length||1);
    if(ur>0.8||ur<0.1){fm.title=toTitleCase(orig);if(fm.title!==orig)ch.push(`  Title case: "${orig}" -> "${fm.title}"`);}}
  // 8. Section labels
  let r8=standardizeSections(body);body=r8.body;ch.push(...r8.changes);
  // 9. Remove dupes
  let r9=removeDupeSections(body);body=r9.body;ch.push(...r9.changes);
  // 10. Chords above -> inline
  let r10=convertChordsAbove(body);body=r10.body;ch.push(...r10.changes);
  // 11. Sentence case
  const scLines=body.split('\n').map(l=>toSentenceCase(l));
  const scCount=scLines.filter((l,i)=>l!==body.split('\n')[i]).length;
  if(scCount)ch.push(`  Sentence-cased ${scCount} ALL CAPS lyric lines`);
  body=scLines.join('\n');
  // 12. Clean whitespace
  body=body.replace(/^\n+/,'').replace(/\n{3,}/g,'\n\n').trimEnd();
  // 13. Defaults
  for(const k of['time','ccli','copyright','energy','keywords','source','year','id'])fm[k]=fm[k]||'';
  fm.genre=fm.genre||[];fm.medley=fm.medley||[];fm.profile=fm.profile||[];

  return { fileName, changes:ch, output: writeFrontmatter(fm)+'\n\n'+body+'\n', profiles };
}

// ─── CLI ────────────────────────────────────────────────────────────────────
function main() {
  const args=process.argv.slice(2);
  if(!args.length){console.log('Usage: node normalize_songs.js <dir> [--apply] [--out <dir>]');process.exit(1);}
  const inputDir=args[0], apply=args.includes('--apply');
  const oi=args.indexOf('--out'), outputDir=oi>=0?args[oi+1]:inputDir+'_normalized';
  if(!fs.existsSync(inputDir)){console.error('Not found:',inputDir);process.exit(1);}
  const files=fs.readdirSync(inputDir).filter(f=>f.endsWith('.md'));
  console.log(`Found ${files.length} .md files`);
  console.log(apply?'MODE: APPLY':'MODE: DRY RUN\n');
  if(apply)fs.mkdirSync(outputDir,{recursive:true});
  const report=[],profileMap=new Map();
  let total=0,changed=0;
  for(const file of files){
    try{
      const{fileName,changes,output,profiles}=normalizeFile(path.join(inputDir,file));
      if(changes.length){report.push(`\n${fileName} (${changes.length} changes)`,...changes);total+=changes.length;changed++;}
      // Track profiles for legend
      for(const p of(profiles||[])){profileMap.set(p,(profileMap.get(p)||0)+1);}
      if(apply)fs.writeFileSync(path.join(outputDir,file),output,'utf8');
    }catch(e){report.push(`\nERROR ${file}: ${e.message}`);}
  }
  // Summary
  const summary=['\n'+'='.repeat(60),'SUMMARY','='.repeat(60),
    `Files: ${files.length}  Changed: ${changed}  Total changes: ${total}`,
    apply?`Output: ${outputDir}`:'DRY RUN','='.repeat(60)];
  const full=[...report,...summary].join('\n');
  console.log(full);
  // Write report
  const rp=apply?path.join(outputDir,'_REPORT.txt'):path.join(inputDir,'_DRY_RUN_REPORT.txt');
  fs.writeFileSync(rp,full,'utf8');
  // Write profile legend
  if(profileMap.size>0){
    const legend=['profile,song_count',...[...profileMap.entries()].sort((a,b)=>b[1]-a[1]).map(([p,c])=>`"${p}",${c}`)].join('\n');
    const lp=apply?path.join(outputDir,'_profile_legend.csv'):path.join(inputDir,'_profile_legend.csv');
    fs.writeFileSync(lp,legend,'utf8');
    console.log(`\nProfile legend: ${lp} (${profileMap.size} unique profiles)`);
  }
}
main();
