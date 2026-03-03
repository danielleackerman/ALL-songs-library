#!/usr/bin/env node
var fs = require('fs');
var path = require('path');

var SACRED = new Set(['i','lord','god','jesus','christ','holy','spirit','father','king','lamb','savior','saviour','messiah','emmanuel','immanuel','jehovah','adonai','elohim','zion','calvary','israel','jordan','nazareth','bethlehem','galilee','jerusalem','eden','mary','moses','david','abraham','solomon','paul','peter','john','satan','devil','bible','scripture','psalm','christmas','easter','pentecost','hallelujah','alleluia','hosanna','amen','o','oh','thy','thee','thou','thine','he','his','him','you','your']);
var ENERGY_MAP = {'high-energy':'high','energetic':'high','fast-shouting':'high','medium-fast':'medium-fast','medium':'medium','medium-slow':'medium-slow','slow':'slow','reverential':'slow','ballad':'slow','slow-reverential':'slow','slow-energetic':'medium-slow'};

function parseFrontmatter(text) {
  var m = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return {fm:{},body:text};
  return {fm:parseYaml(m[1]),body:m[2]};
}
function parseYaml(yaml) {
  var r={},lines=yaml.split('\n'),curKey=null,curList=null;
  for (var ii=0;ii<lines.length;ii++) {
    var line=lines[ii];
    var kv=line.match(/^(\w[\w-]*):\s*(.*)$/);
    if (kv) {
      if (curKey&&curList) r[curKey]=curList;
      curKey=kv[1]; var v=kv[2].trim(); curList=null;
      if (v===''||v==='~'||v==='null') r[curKey]='';
      else if (v==='[]') r[curKey]=[];
      else if (v.startsWith('[')&&v.endsWith(']')) {
        r[curKey]=v.slice(1,-1).split(',').map(function(s){return s.trim().replace(/^["']|["']$/g,'')}).filter(Boolean);
      }
      else r[curKey]=v.replace(/^["']|["']$/g,'');
    } else {
      var it=line.match(/^\s+-\s+(.*)$/);
      if (it) { if(!curList)curList=[]; curList.push(it[1].trim().replace(/^["']|["']$/g,'')); }
    }
  }
  if (curKey&&curList) r[curKey]=curList;
  return r;
}
function q(val) {
  if (val===null||val===undefined||val==='') return '""';
  var s=String(val); return '"'+s.replace(/\\/g,'\\\\').replace(/"/g,'\\"')+'"';
}
function writeFrontmatter(fm) {
  var L=['---'];
  L.push('title: '+q(fm.title||''));
  L.push('artist: '+q(fm.artist||''));
  L.push('key: '+(fm.key||''));
  L.push('tempo: '+(fm.tempo||''));
  L.push('time: '+(fm.time?q(fm.time):''));
  L.push('ccli: '+(fm.ccli?q(fm.ccli):''));
  L.push('copyright: '+(fm.copyright?q(fm.copyright):''));
  if (fm.tags&&fm.tags.length) { L.push('tags:'); fm.tags.forEach(function(t){L.push('  - "'+t+'"')}); } else L.push('tags: []');
  L.push('genre: '+(fm.genre&&fm.genre.length?JSON.stringify(fm.genre):'[]'));
  L.push('energy: '+(fm.energy||''));
  if (fm.profile&&fm.profile.length) { L.push('profile:'); fm.profile.forEach(function(p){L.push('  - "'+p+'"')}); } else L.push('profile: []');
  L.push('keywords: '+(fm.keywords?q(fm.keywords):''));
  L.push('source: '+(fm.source?q(fm.source):''));
  L.push('year: '+(fm.year||''));
  if (fm.medley&&fm.medley.length) { L.push('medley:'); fm.medley.forEach(function(mm){L.push('  - '+q(mm))}); } else L.push('medley: []');
  L.push('id: '+q(fm.id||''));
  L.push('---');
  return L.join('\n');
}
function isSectionLabel(line) {
  var t=line.trim().replace(/:?\s*$/,'').toUpperCase();
  return /^(VERSE|CHORUS|BRIDGE|TAG|VAMP|INTRO|OUTRO|INTERLUDE|INSTRUMENTAL|AD\s*LIB|DESCANT|TURNAROUND|ENDING|PRE-CHORUS)\s*(MOD)?\s*\d*\s*(x\d+)?$/i.test(t);
}
function isChordOnly(line) {
  var t=line.trim().replace(/[-=]+/g,'').trim();
  if (!t||t.length<2) return false;
  var tokens=t.split(/\s+/).filter(Boolean); if(!tokens.length) return false;
  var chords=0;
  for (var jj=0;jj<tokens.length;jj++) {
    var c=tokens[jj].replace(/[()]/g,''); if(!c) continue;
    if (/^[A-Ga-g][b#]?(m|maj|min|dim|aug|sus|add|no|M|[0-9]|\/[A-Ga-g][b#]?[a-z0-9]*)*[0-9]?$/.test(c)) chords++;
    else if (/^[x]?\d+[x]?$/.test(c)||c==='/'||c==='|') {}
    else return false;
  }
  return chords>=1;
}
function harvestChordPro(body, fm) {
  var ch=[], nl=[], map={title:'title',subtitle:'artist',key:'key',tempo:'tempo',time:'time',keywords:'keywords',copyright:'copyright',ccli:'ccli'};
  var blines=body.split('\n');
  for(var i=0;i<blines.length;i++){
    var line=blines[i];
    var m=line.match(/^\{(\w+):\s*(.*?)\}$/);
    if (m) { var d=m[1].toLowerCase(),v=m[2].trim(),f=map[d];
      if(f){if(!fm[f]||fm[f]===''){fm[f]=v;ch.push('  Harvested {'+d+'} -> frontmatter.'+f);}else ch.push('  Stripped duplicate {'+d+'}');continue;}
    }
    nl.push(line);
  }
  return {body:nl.join('\n'),changes:ch};
}
function stripBareMetadata(body, fm) {
  var ch=[],nl=[],inH=true,names=[],blines=body.split('\n');
  for(var i=0;i<blines.length;i++){
    var line=blines[i];
    if(!inH){nl.push(line);continue;}
    var t=line.trim();
    if(t===''){nl.push(line);continue;}
    if(isChordOnly(t)||isSectionLabel(t)){inH=false;nl.push(line);continue;}
    if(fm.title&&t.toLowerCase()===fm.title.toLowerCase()){ch.push('  Stripped bare title');continue;}
    if(fm.artist&&t.toLowerCase()===fm.artist.toLowerCase()){ch.push('  Stripped bare artist');continue;}
    if(/^key:\s*.+/i.test(t)){var v=t.replace(/^key:\s*/i,'').trim().replace(/[\[\]]/g,'');if(!fm.key||fm.key==='')fm.key=v;ch.push('  Stripped bare Key');continue;}
    if(/^tempo:\s*.+/i.test(t)){var v=t.replace(/^tempo:\s*/i,'').trim();if(!fm.tempo||fm.tempo==='')fm.tempo=v;ch.push('  Stripped bare Tempo');continue;}
    if(/^time:\s*.+/i.test(t)){var v=t.replace(/^time:\s*/i,'').trim();if(!fm.time||fm.time==='')fm.time=v;ch.push('  Stripped bare Time');continue;}
    if(/^ccli:\s*.+/i.test(t)){var v=t.replace(/^ccli:\s*/i,'').trim();if(!fm.ccli||fm.ccli==='')fm.ccli=v;ch.push('  Stripped bare CCLI');continue;}
    if(/^copyright:\s*.+/i.test(t)){var v=t.replace(/^copyright:\s*/i,'').trim();if(!fm.copyright||fm.copyright==='')fm.copyright=v;ch.push('  Stripped bare Copyright');continue;}
    if(/^keywords:\s*.+/i.test(t)){var v=t.replace(/^keywords:\s*/i,'').trim();if(!fm.keywords||fm.keywords==='')fm.keywords=v;ch.push('  Stripped bare Keywords');continue;}
    if(/^artist:\s*.+/i.test(t)){var v=t.replace(/^artist:\s*/i,'').trim();if(!fm.artist||fm.artist==='')fm.artist=v;ch.push('  Stripped bare Artist');continue;}
    if(/^title:\s*.+/i.test(t)){ch.push('  Stripped bare Title');continue;}
    if(!t.startsWith('[')&&t.length<80&&t.length>3&&!t.includes(':')){
      var hasChord=/[A-G][b#]?(m|sus|dim|aug|maj|add|\/[A-G])|\d/.test(t);
      var isAllCaps=t===t.toUpperCase()&&/[A-Z]{3,}/.test(t);
      if(!hasChord&&!isAllCaps&&/^[A-Z][a-zA-Z\s.,&\/|'"-]+$/.test(t)&&t.length<60){
        names.push(t); ch.push('  Captured name -> source: "'+t+'"'); continue;
      }
    }
    inH=false; nl.push(line);
  }
  if(names.length){fm.source=[fm.source].concat(names).filter(Boolean).join('; ');}
  return {body:nl.join('\n'),changes:ch};
}
function extractThemes(body) {
  var ch=[],themes=[],nl=[],blines=body.split('\n');
  for(var i=0;i<blines.length;i++){
    var line=blines[i];
    var m=line.match(/^\s*THEMES?:\s*(.+)$/i);
    if(m){var raw=m[1].split(/[,;]+/).map(function(t){return t.trim().toLowerCase()}).filter(Boolean);themes=themes.concat(raw);ch.push('  Moved THEMES to tags: '+raw.join(', '));continue;}
    var cleaned=line.replace(/[\u0590-\u05FF]+/g,'').trimEnd();
    if(cleaned!==line&&cleaned.trim()===''&&line.trim().length<=4){ch.push('  Stripped artifact');continue;}
    nl.push(cleaned);
  }
  return {body:nl.join('\n'),themes:themes,changes:ch};
}
function processCompoundTags(tags) {
  var ch=[],profiles=[],clean=[],seen=new Set();
  for(var i=0;i<tags.length;i++){
    var tag=tags[i],parts=tag.split('-');
    var isLong=parts.length>=4&&tag.length>25;
    var isKW=parts.length>=3&&tag.length>=8&&tag.length<26&&/^[A-Za-z0-9-]+$/.test(tag)&&!/^(medium|slow|fast|high|energetic|reverential|ballad|shouting)/i.test(tag);
    if(isLong||isKW){profiles.push(tag.toLowerCase());ch.push('  Extracted -> profile: "'+tag+'"');continue;}
    var key=tag.toLowerCase();
    if(!seen.has(key)){seen.add(key);clean.push(tag);}
  }
  return {tags:clean,profiles:profiles,changes:ch};
}
function normalizeArtist(artist) {
  if(!artist) return {artist:'',year:'',source:'',changes:[]};
  var ch=[],year='',source='',clean=artist;
  var ym=clean.match(/,?\s*(\d{4})\s*$/);
  if(ym){year=ym[1];clean=clean.replace(ym[0],'').trim();ch.push('  Extracted year: '+year);}
  var pm=clean.match(/\s*\(([^)]+)\)\s*$/);
  if(pm){source=pm[1].trim();clean=clean.replace(pm[0],'').trim();ch.push('  Extracted source: "'+source+'"');}
  if(clean!==artist) ch.push('  Normalized artist: "'+artist+'" -> "'+clean+'"');
  return {artist:clean,year:year,source:source,changes:ch};
}
function standardizeSections(body) {
  var ch=[],nl=[],blines=body.split('\n');
  for(var i=0;i<blines.length;i++){
    var line=blines[i],t=line.trim(); if(!t){nl.push(line);continue;}
    var m=t.match(/^(VERSE|CHORUS|BRIDGE|TAG|VAMP|INTRO|OUTRO|INTERLUDE|INSTRUMENTAL|AD\s*LIB|DESCANT|TURNAROUND|ENDING|PRE-CHORUS)\s*(MOD)?\s*(\d*)\s*(x\d+)?\s*:?\s*$/i);
    if(m){var type=m[1].toUpperCase().replace(/\s+/g,' '),mod=m[2]?' MOD':'',num=m[3]||'',rep=m[4]?' '+m[4].toLowerCase():'';
      var std=type+mod+(num?' '+num:'')+':'+rep;
      if(std!==t) ch.push('  Section: "'+t+'" -> "'+std+'"');
      nl.push(std);
    } else nl.push(line);
  }
  return {body:nl.join('\n'),changes:ch};
}
function removeDupes(body) {
  var ch=[],lines=body.split('\n'),secs=[],cur={label:'__pre__',lines:[]};
  for(var i=0;i<lines.length;i++){if(isSectionLabel(lines[i].trim())){secs.push(cur);cur={label:lines[i].trim(),lines:[]};}else cur.lines.push(lines[i]);}
  secs.push(cur);
  var kept=[];
  for(var i=0;i<secs.length;i++){
    if(i>0){var p=secs[i-1],c=secs[i];if(p.label===c.label&&p.lines.join('\n').trim().toLowerCase()===c.lines.join('\n').trim().toLowerCase()&&c.lines.join('').trim().length>0){ch.push('  Removed duplicate: "'+c.label+'"');continue;}}
    kept.push(secs[i]);
  }
  var out=[];for(var i=0;i<kept.length;i++){if(kept[i].label!=='__pre__')out.push(kept[i].label);out=out.concat(kept[i].lines);}
  return {body:out.join('\n'),changes:ch};
}
function deriveEnergy(tags, tempo) {
  if(tempo){var b=parseInt(tempo);if(!isNaN(b)){if(b>=140)return'high';if(b>=110)return'medium-fast';if(b>=85)return'medium';if(b>=65)return'medium-slow';return'slow';}}
  for(var i=0;i<tags.length;i++){var k=tags[i].toLowerCase();if(ENERGY_MAP[k])return ENERGY_MAP[k];}
  return '';
}
function toTitleCase(str) {
  if(!str) return '';
  var small=new Set(['a','an','the','and','but','or','for','nor','at','by','in','of','on','to','up','as','is','it']);
  return str.replace(/\w+('[a-z]+)?/gi, function(word,suf,idx){
    if(idx===0||idx+word.length===str.length) return word.charAt(0).toUpperCase()+word.slice(1).toLowerCase();
    if(small.has(word.toLowerCase())) return word.toLowerCase();
    return word.charAt(0).toUpperCase()+word.slice(1).toLowerCase();
  });
}
function toSentenceCase(line) {
  if(!line) return '';
  if(isSectionLabel(line.trim())) return line;
  if(isChordOnly(line)) return line;
  if(line.trim().startsWith('*')) return line;
  var chords=[];
  var s=line.replace(/\[([^\]]*)\]/g, function(match){chords.push(match);return '\x01'+(chords.length-1)+'\x02';});
  var textOnly=s.replace(/\x01\d+\x02/g,'').replace(/[^a-zA-Z]/g,'');
  if(!textOnly.length){var r=s;chords.forEach(function(c,i){r=r.replace('\x01'+i+'\x02',c);});return r;}
  var upper=(textOnly.match(/[A-Z]/g)||[]).length;
  if(upper/textOnly.length<0.8){var r=s;chords.forEach(function(c,i){r=r.replace('\x01'+i+'\x02',c);});return r;}
  s=s.toLowerCase();
  s=s.replace(/^(\s*)([a-z])/,function(m,ws,ch){return ws+ch.toUpperCase();});
  s=s.replace(/([.!?]\s+)([a-z])/g,function(m,p,ch){return p+ch.toUpperCase();});
  s=s.replace(/\b([a-z]+)\b/g,function(match){if(SACRED.has(match)){if(match==='i')return'I';return match.charAt(0).toUpperCase()+match.slice(1);}return match;});
  var r=s; chords.forEach(function(c,i){r=r.replace('\x01'+i+'\x02',c);});
  r=r.replace(/^(\s*(?:\[[^\]]*\]\s*)*)([a-z])/,function(m,pre,ch){return pre+ch.toUpperCase();});
  return r;
}
function mergeChordLine(chordLine, lyricLine) {
  var chords=[],re=/(\S+)/g,m;
  while((m=re.exec(chordLine))!==null){var t=m[1].replace(/[()]/g,'');if(/^[A-Ga-g][b#]?(m|maj|min|dim|aug|sus|add|no|M|[0-9]|\/[A-Ga-g][b#]?[a-z0-9]*)*[0-9]?$/.test(t))chords.push({pos:m.index,chord:m[1]});}
  if(!chords.length) return lyricLine;
  if(!lyricLine||!lyricLine.trim()) return chords.map(function(c){return '['+c.chord+']'}).join(' ');
  var result=lyricLine,offset=0;
  for(var i=0;i<chords.length;i++){var br='['+chords[i].chord+']',at=Math.min(chords[i].pos+offset,result.length);result=result.slice(0,at)+br+result.slice(at);offset+=br.length;}
  return result;
}
function convertChordsAbove(body) {
  var ch=[],lines=body.split('\n'),nl=[],convs=0,i=0;
  while(i<lines.length){
    var line=lines[i];
    if(isChordOnly(line)&&i+1<lines.length){
      var next=lines[i+1],nt=next.trim();
      if(nt&&!isChordOnly(next)&&!isSectionLabel(nt)&&/[a-zA-Z]{2,}/.test(nt)){nl.push(mergeChordLine(line,next));convs++;i+=2;continue;}
      else if(!nt||isChordOnly(next)){if(!line.includes('[')){nl.push(line.replace(/([A-Ga-g][b#]?(?:m|maj|min|dim|aug|sus|add|no|M|[0-9]|\/[A-Ga-g][b#]?[a-z0-9]*)*[0-9]?)/g,'[$1]'));convs++;}else nl.push(line);i++;continue;}
    }
    nl.push(line);i++;
  }
  if(convs) ch.push('  Converted '+convs+' chords-above -> inline brackets');
  return {body:nl.join('\n'),changes:ch};
}
function normalizeFile(filePath) {
  var raw=fs.readFileSync(filePath,'utf8'),fn=path.basename(filePath),ch=[];
  var parsed=parseFrontmatter(raw),fm=parsed.fm,body=parsed.body;
  if(!fm.title&&!body) return {fn:fn,newFn:fn,ch:['  SKIPPED'],out:raw,profiles:[]};
  var r1=harvestChordPro(body,fm);body=r1.body;ch=ch.concat(r1.changes);
  var r2=stripBareMetadata(body,fm);body=r2.body;ch=ch.concat(r2.changes);
  var r3=extractThemes(body);body=r3.body;ch=ch.concat(r3.changes);
  var curTags=Array.isArray(fm.tags)?fm.tags.slice():[];
  var r4=processCompoundTags(curTags);ch=ch.concat(r4.changes);
  var tagSet=new Set(r4.tags.map(function(t){return t.toLowerCase()}));
  r3.themes.forEach(function(t){if(!tagSet.has(t)){r4.tags.push(t);tagSet.add(t);}});
  fm.tags=r4.tags.map(function(t){return t.toLowerCase()});
  fm.profile=r4.profiles;
  var r5=normalizeArtist(fm.artist);fm.artist=r5.artist;
  if(r5.year&&!fm.year)fm.year=r5.year;
  if(r5.source){fm.source=[fm.source,r5.source].filter(Boolean).join('; ');}
  ch=ch.concat(r5.changes);
  var en=deriveEnergy(fm.tags,fm.tempo);
  if(en&&en!==fm.energy){ch.push('  Derived energy: "'+en+'"');fm.energy=en;}
  if(fm.title){var orig=fm.title,txt=orig.replace(/[^a-zA-Z]/g,''),ur=(txt.match(/[A-Z]/g)||[]).length/(txt.length||1);
    if(ur>0.8||ur<0.1){fm.title=toTitleCase(orig);if(fm.title!==orig)ch.push('  Title case: "'+orig+'" -> "'+fm.title+'"');}}
  var r8=standardizeSections(body);body=r8.body;ch=ch.concat(r8.changes);
  var r9=removeDupes(body);body=r9.body;ch=ch.concat(r9.changes);
  var r10=convertChordsAbove(body);body=r10.body;ch=ch.concat(r10.changes);
  var origLines=body.split('\n'),scLines=origLines.map(toSentenceCase);
  var scCount=scLines.filter(function(l,i){return l!==origLines[i]}).length;
  if(scCount)ch.push('  Sentence-cased '+scCount+' ALL CAPS lines');
  body=scLines.join('\n');
  body=body.replace(/^\n+/,'').replace(/\n{3,}/g,'\n\n').trimEnd();
  ['time','ccli','copyright','energy','keywords','source','year','id'].forEach(function(k){fm[k]=fm[k]||''});
  if(fm.keywords) fm.keywords=fm.keywords.toLowerCase();
  fm.genre=fm.genre||[];fm.medley=fm.medley||[];fm.profile=fm.profile||[];
  // --- FILE RENAME: match filename to title-cased frontmatter title ---
  var newFn=fn;
  if(fm.title){
    // Preserve bracket suffixes like [2], [3] from original filename
    var bracketSuffix='';
    var bm=fn.replace(/\.md$/i,'').match(/(\s*\[\d+\])$/);
    if(bm) bracketSuffix=bm[1];
    // Preserve dash suffixes like "- my edit", "-EASY", "- version 2"
    var dashSuffix='';
    var fnNoExt=fn.replace(/\.md$/i,'');
    var fnNoBracket=fnNoExt.replace(/\s*\[\d+\]$/,'');
    var dm=fnNoBracket.match(/(\s*-\s*.+)$/);
    if(dm){
      var possibleSuffix=dm[1];
      var titleLow=fm.title.toLowerCase();
      var baseWithoutSuffix=fnNoBracket.replace(possibleSuffix,'').trim().toLowerCase();
      // Only keep as suffix if the title matches the base without the suffix
      if(titleLow.indexOf(baseWithoutSuffix)===0 || baseWithoutSuffix.indexOf(titleLow)===0){
        dashSuffix=possibleSuffix;
      }
    }
    var sanitized=fm.title.replace(/[<>:"\/\\|?*]/g,'').trim();
    newFn=sanitized+dashSuffix+bracketSuffix+'.md';
    if(newFn!==fn) ch.push('  Renamed: "'+fn+'" -> "'+newFn+'"');
  }
  return {fn:fn,newFn:newFn,ch:ch,out:writeFrontmatter(fm)+'\n\n'+body+'\n',profiles:fm.profile};
}
var args=process.argv.slice(2);
if(!args.length){console.log('Usage: node normalize_songs.js <dir> [--apply] [--out <dir>]');process.exit(1);}
var inputDir=args[0],apply=args.indexOf('--apply')>=0;
var oi=args.indexOf('--out'),outputDir=oi>=0?args[oi+1]:inputDir+'_normalized';
if(!fs.existsSync(inputDir)){console.error('Not found:',inputDir);process.exit(1);}
var files=fs.readdirSync(inputDir).filter(function(f){return f.endsWith('.md')});
console.log('Found '+files.length+' .md files');
console.log(apply?'MODE: APPLY':'MODE: DRY RUN');
if(apply) fs.mkdirSync(outputDir,{recursive:true});
var report=[],profileMap=new Map(),total=0,changed=0;
var usedNames=new Set();
for(var fi=0;fi<files.length;fi++){
  try{
    var r=normalizeFile(path.join(inputDir,files[fi]));
    if(r.ch.length){report.push('\n'+r.fn+' ('+r.ch.length+' changes)');report=report.concat(r.ch);total+=r.ch.length;changed++;}
    (r.profiles||[]).forEach(function(p){profileMap.set(p,(profileMap.get(p)||0)+1);});
    if(apply){
      var outName=r.newFn||files[fi];
      if(usedNames.has(outName.toLowerCase())){
        var base=outName.replace(/\.md$/i,'');
        var n=2;
        while(usedNames.has((base+' ['+n+'].md').toLowerCase())) n++;
        outName=base+' ['+n+'].md';
        report.push('  COLLISION: saved as "'+outName+'"');
      }
      usedNames.add(outName.toLowerCase());
      fs.writeFileSync(path.join(outputDir,outName),r.out,'utf8');
    }
  }catch(e){report.push('\nERROR '+files[fi]+': '+e.message);}
}
report.push('\n============================================================');
report.push('SUMMARY');
report.push('============================================================');
report.push('Files: '+files.length+'  Changed: '+changed+'  Total changes: '+total);
report.push(apply?'Output: '+outputDir:'DRY RUN');
report.push('============================================================');
console.log(report.join('\n'));
var rp=apply?path.join(outputDir,'_REPORT.txt'):path.join(inputDir,'_DRY_RUN_REPORT.txt');
fs.writeFileSync(rp,report.join('\n'),'utf8');
if(profileMap.size>0){
  var legend=['profile,song_count'];
  Array.from(profileMap.entries()).sort(function(a,b){return b[1]-a[1]}).forEach(function(e){legend.push('"'+e[0]+'",'+e[1])});
  var lp=apply?path.join(outputDir,'_profile_legend.csv'):path.join(inputDir,'_profile_legend.csv');
  fs.writeFileSync(lp,legend.join('\n'),'utf8');
  console.log('\nProfile legend: '+lp+' ('+profileMap.size+' unique profiles)');
}
