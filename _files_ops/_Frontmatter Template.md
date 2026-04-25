
## Status

The approved current frontmatter schema is:
---
title: ""
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
source: []
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

This note contains older migration thinking.
```yaml
---
title: ""
artist: ""
key:
bpm:
time_sig:
meter:
tempo:
theme: []
function: []
tags: []
genre: []
profile: []
keywords:
ccli:
copyright:
source:
year:
medley: []
id: ""
---
```


 older migration thinking
---
title: "A Brand New Touch"
artist: "Lanny Wolfe"
key: Eb
tempo:              # ← explicitly present but empty, not just missing
time:
ccli: "6618"
copyright: "1977 Lanny Wolfe Music..."
tags: [...]
genre: []
energy: slow        # ← derived from tags when tempo is missing
profile:
keywords: "OS Apo Slow"
source:
year:
medley: []
 id: "FD21514D-312A-4257-822A-8E4FEC284FFD"
---

Let me walk through each one using your actual files as examples.

---

**Strip duplicate ChordPro directives from body**

Right now, "A Perfect Heart" has this situation:

```yaml
---
title: "A PERFECT HEART"      # ← In YAML frontmatter
key: F                         # ← In YAML frontmatter
tempo: 74                      # ← In YAML frontmatter
---

{title: A PERFECT HEART}      # ← SAME info repeated in body as ChordPro
{key: F}                       # ← duplicate
{tempo: 74}                    # ← duplicate
{subtitle: Reba Rambo...}      # ← this is really "artist" — also in frontmatter
{time: 4/4}
{keywords: OLD SCHOOL...}
{copyright: 1981 Bud John...}
{ccli: 12860}
```

The YAML frontmatter is what any system (Obsidian, Supabase, your PWA) actually reads for metadata. The ChordPro `{directives}` in the body are leftovers from whatever app exported these files originally. They're dead weight that clutters the body.

**What the script does:** Pulls any useful info from the ChordPro directives that ISN'T already in frontmatter (like `copyright`, `ccli`, `time`) and moves it UP into the YAML. Then deletes the ChordPro directives from the body. After:

```yaml
---
title: "A Perfect Heart"
artist: "Reba Rambo and Dony McGuire"
key: F
tempo: 74
time: "4/4"
copyright: "1981 Bud John Songs, Inc..."
ccli: "12860"
keywords: "OLD SCHOOL SOUTHERN GOSPEL"
---

VERSE 1:
MORNING SUN, LIGHT OF CREATION...
```

Clean body, complete frontmatter, no duplication.

---

**Split compound tags + generate profile field**

Your "A New Name In Glory" currently has:

```yaml
tags:
  - "Black-Gospel"
  - "Choir"
  - "Energetic"
  - "Medium-Fast"
  - "Praise"
  - "Southern-Gospel"
  - "Traditional"
  - "Worship"
  - "Black-Gospel-Choir-Choruses-Congregational-Contemporary-Energetic-Medium-Fast-Praise-Solo-Songs-Southern-Gospel-Traditional-Worship"
```

That last tag is a concatenation of all the others. You told me it exists because you wanted to mark songs that share that EXACT combination — it's a style fingerprint. The script splits them apart but preserves your intent:

```yaml
tags:
  - black-gospel
  - choir
  - energetic
  - medium-fast
  - praise
  - southern-gospel
  - traditional
  - worship
profile: "black-gospel-full-energy-praise"   # ← auto-generated from the compound tag
```

Now `tags` are individually filterable ("show me all `energetic` songs") AND `profile` preserves your grouping concept ("show me all songs with this exact style fingerprint"). The profile name gets auto-generated, and you can rename them later to something meaningful to you.

---

**Move THEMES into frontmatter tags**

"A Brand New Touch" has this at the very bottom of the body:

```
Won't you touch me, Lord
Give me the strength to carry on

THEMES: COMFORT, PETITION

אי
```

Those themes are metadata, not lyrics. They belong in frontmatter where they're searchable and filterable. The script moves them:

```yaml
tags:
  - worship
  - slow
  - traditional
  - comfort      # ← moved from THEMES
  - petition     # ← moved from THEMES
```

The `אי` at the end (looks like a stray Hebrew character) gets stripped as artifact/noise.

---

**Normalize artist format**

Look at the inconsistency across your 5 files:

- `"Lanny Wolfe"` — clean
- `"C. Austin Miles, 1910"` — has a year embedded
- `"Reba Rambo and Dony McGuire"` — clean
- `"Henry Francis Lyte & W.H. Monk (Sing Unto The Lord Songbook, 16)"` — has a songbook reference and page number embedded
- `""` — completely empty (Above All Else, where "Doug Davis" is buried in the ChordPro body instead)

Across 2,500 files, this will be a mess. The script normalizes to:

```yaml
artist: "Henry Francis Lyte & W.H. Monk"
year: 1910                                    # extracted when present
source: "Sing Unto The Lord Songbook, p.16"   # extracted when present
```

Each piece of info goes in its own field. Now you can filter by artist cleanly without "C. Austin Miles, 1910" and "C. Austin Miles" showing up as two different artists.

---

**Standardize section labels**

Across your files, sections are labeled inconsistently:

```
CHORUS:          ← good
VERSE 1:         ← good
CHORUS MOD       ← what is this? no colon, unclear label
VERSE 3:         ← appears twice in A Brand New Touch
TAG:             ← good
*Between the...  ← performance note mixed in with sections
```

The script normalizes to a strict vocabulary: `VERSE 1:`, `VERSE 2:`, `CHORUS:`, `CHORUS 2:`, `BRIDGE:`, `TAG:`, `VAMP:`, `INTRO:`, `OUTRO:`, `INTERLUDE:`. Anything that doesn't match gets flagged for your manual review rather than silently changed, since things like `CHORUS MOD` might mean something specific to you.

---

**Flag/remove duplicate sections**

"A Brand New Touch" literally has VERSE 3 and the CHORUS written twice — identical text, back to back. The script detects sections with identical lyrics and removes the duplicate, keeping one copy. It generates a report showing you what it removed so you can verify nothing meaningful was lost.

---

**Add missing fields with null/empty defaults**

"A Brand New Touch" has no `tempo` value. "Above All Else" has no `artist` in frontmatter. The script ensures every file has the full schema, even if values are empty:

```yaml
---
title: "A Brand New Touch"
artist: "Lanny Wolfe"
key: Eb
tempo:              # ← explicitly present but empty, not just missing
time:
ccli: "6618"
copyright: "1977 Lanny Wolfe Music..."
tags: [...]
genre: []
energy: slow        # ← derived from tags when tempo is missing
profile:
keywords: "OS Apo Slow"
source:
year:
medley: []
id: "FD21514D-312A-4257-822A-8E4FEC284FFD"
---
```

This way every file has identical structure. No surprises during ingestion.

---

**For your 2,500 files:** You don't need to zip them. Upload them in batches of 50-100, or better — put them in a GitHub repo or shared folder and give me access. Or I can build the script against these 5 samples, you run it locally on the full vault, and we iterate on edge cases it flags.



That's valuable musical information. So `CHORUS MOD` means "play the chorus here but modulate up" (key change). The script should NOT strip that — it should standardize the format and potentially extract the modulation as structured data.

So the section label vocabulary expands:

```
CHORUS:
CHORUS MOD:        ← chorus with key modulation
CHORUS 2:          ← alternate/modified chorus lyrics
CHORUS MOD 2:      ← second chorus with modulation
```

And during ingestion into Supabase, the section parser captures it:

```json
{
  "type": "chorus",
  "label": "CHORUS MOD",
  "modulation": true,
  "text": "Bless the Lord, O my soul...",
  "chords": ["C2", "Gdim7/Db", "Csus/D"]
}
```

That `modulation: true` flag becomes useful later — your PWA could show a key-change indicator in the chord chart, and when you build a setlist builder, it knows the song ends in a different key than it starts (critical for planning song transitions).

Are there other section markers like this that carry musical meaning beyond just "verse/chorus"? Things like `VAMP`, `TURNAROUND`, `AD LIB`, `SHOUT`, `INSTRUMENTAL`? The more of your vocabulary I know upfront, the better the script handles your 2,500 files without flagging false positives.