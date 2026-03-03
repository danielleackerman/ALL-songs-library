# Song Database "Open Brain" — Architecture Analysis

## Clarifying Assumptions

1. **You have ~200–2,000+ songs** in Obsidian-style Markdown with YAML frontmatter (title, artist, key, tempo, tags, id/UUID) and ChordPro-style bodies. The total corpus fits comfortably in memory (<100 MB).
2. **You are willing to host something lightweight** (Cloudflare Pages, Vercel, or a $5/mo VPS) but you do NOT want to run a complex self-managed server stack (no Kubernetes, no Docker Compose with 4 containers).
3. **"Offline on iPad" means offline-read and search**, not offline-write-and-sync-back. You're okay syncing when connected; you don't need full CRDT conflict resolution for multi-device editing.
4. **You are the primary author/user**, not a team. Multi-user collaboration is not a V1 requirement.
5. **Markdown files remain the source of truth.** Any database or index is derived from them — if you lose the DB, you rebuild from the `.md` files. This is non-negotiable for portability.
6. **You're comfortable with light code work** (editing config files, running a build script, basic JS/Python) but you're not looking to write a full native iOS app from scratch.
7. **"Semantic search" means finding songs by mood/theme/description**, not just keyword matching. e.g. "songs about struggling through hard times" should surface "A Brand New Touch" even if that phrase never appears literally.
8. **Future modules** (practice logs, setlist builder, lyric prompts, chord progression tools) will share the same song IDs and tag vocabulary — they need to reference the same song entities.
9. **Budget target is <$20/month** in steady-state operating cost, ideally under $5.
10. **You value "works in 2 years" over "cool tech right now."** You've been burned by apps disappearing or repricing and you want architectural durability.

---

## Option Comparison

### A) Obsidian-Based (Stay in Ecosystem)

**Sub-options:** Obsidian mobile app (direct), Obsidian Publish, Quartz/digital-garden static site, or Obsidian + plugins (Dataview, Omnisearch, Smart Connections).

| Dimension | Assessment |
|-----------|------------|
| **Full-text search** | Excellent. Obsidian's native search is fast, supports regex, path/tag/property filters. Dataview adds SQL-like queries over frontmatter. |
| **Tag faceting** | Good. Tags are first-class. Dataview can build filtered views (e.g., all songs in key of Eb tagged "Worship"). No proper faceted UI though — it's query-based, not click-to-filter. |
| **Backlink graph** | Excellent. This is Obsidian's superpower. Graph view, local graphs, backlink pane all work. |
| **Semantic search** | Possible via "Smart Connections" plugin (local embeddings). Quality is decent, speed is slow on large vaults, and it does NOT work on iOS. Desktop-only plugin. |
| **iPad UX** | Mediocre. Obsidian iOS exists and works, but it feels like a desktop app squeezed onto a tablet. No smooth swipe navigation, no card-based browsing. Search works but the results list is utilitarian. You cannot run community plugins on mobile (Dataview, Smart Connections = desktop only). |
| **Offline** | Excellent on desktop (local files). On iPad via iCloud sync — works but iCloud sync has well-documented reliability issues (phantom conflicts, slow initial sync of large vaults). Obsidian Sync ($8/mo) is more reliable. |
| **Data ownership** | Perfect. Plain Markdown files on your filesystem. Zero lock-in. |
| **Portability** | Perfect. The files ARE the data. Move them anywhere. |
| **Complexity** | Low to set up. Medium to get a good workflow (plugin config, CSS snippets for song display). |
| **Cost** | Free (iCloud sync) or $8/mo (Obsidian Sync). Publish is $8/mo but doesn't give you an "app" — it gives you a read-only website. |
| **What breaks** | iCloud sync conflicts with large vaults. No community plugins on mobile kills Dataview queries and semantic search on iPad. Obsidian Publish is read-only, no search filtering. If Obsidian Inc. changes direction or pricing, your files are still fine but your workflow tooling is gone. |

**Verdict:** Best data ownership story, but the iPad experience is fundamentally limited by the mobile plugin restriction. You'll always feel like you're using a reduced version on iPad.

---

### B) Local-First PKM Apps (Anytype, Logseq, SiYuan)

| Dimension | Assessment |
|-----------|------------|
| **Full-text search** | Logseq: decent but slower than Obsidian on large graphs. Anytype: good, with object-type filtering. SiYuan: excellent, SQL-based under the hood. |
| **Tag faceting** | Logseq: via queries (Datalog-based, steep learning curve). Anytype: native — objects have types and relations, closest to real faceted search. SiYuan: custom attributes searchable. |
| **Backlink graph** | Logseq: strong (block-level refs). Anytype: has relations/links but graph view is immature. SiYuan: good. |
| **Semantic search** | None of these have built-in semantic search. You'd need an external layer. |
| **iPad UX** | Logseq: no native iPad app (web version is sluggish). Anytype: has an iOS app, reasonably polished, offline-capable. Best in this category. SiYuan: has iOS app but it's rough. |
| **Offline** | Anytype: excellent (local-first with P2P sync, no server needed). Logseq: local files but sync is via iCloud/git (same issues as Obsidian). SiYuan: local with paid cloud sync. |
| **Data ownership** | Anytype: data is local + encrypted, but stored in a proprietary format (not plain Markdown). Export exists but it's a one-way operation, not a live mirror. Logseq: Markdown/org-mode files. SiYuan: proprietary JSON internally, Markdown export. |
| **Portability** | Logseq: good (Markdown). Anytype: poor (proprietary format, export required). SiYuan: medium. |
| **Complexity** | Medium. All require learning a new system and importing/converting your data. Anytype import from Markdown is lossy — frontmatter doesn't map cleanly to their "relations" model without manual setup. |
| **Cost** | All free for personal use currently. Anytype and SiYuan have paid sync tiers. |
| **What breaks** | Anytype is VC-funded and pre-revenue — high risk of pricing changes or shutdown. Logseq's development has slowed significantly (team layoffs in 2024). SiYuan is a small Chinese team — English ecosystem is thin. All three are smaller than Obsidian's ecosystem. Importing your ChordPro-flavored Markdown will require custom conversion for any of them. |

**Verdict:** Anytype has the best iPad story in this category, but you'd be trading Markdown portability for a proprietary format. Logseq's future is uncertain. None solve the semantic search problem. Net: trading one set of limitations for another, with worse ecosystem support.

---

### C) Database-First Apps (Notion, Airtable, Tana, Capacities)

| Dimension | Assessment |
|-----------|------------|
| **Full-text search** | Notion: good but noticeably slow on large workspaces. Airtable: fast for structured fields, poor for long-text body search. Tana: fast (supertags model). Capacities: good. |
| **Tag faceting** | Notion: via database filters — works but clunky multi-select UX. Airtable: excellent faceted filtering, best in class for structured data. Tana: excellent (supertags = typed facets). Capacities: good (object-type filtering). |
| **Backlink graph** | Notion: basic (backlinks exist, no graph view). Airtable: none. Tana: good bi-directional refs. Capacities: has a graph/canvas. |
| **Semantic search** | Notion AI: exists ($10/mo extra), but it's a chatbot layer, not true semantic search of your content. Others: no. |
| **iPad UX** | Notion: polished iPad app, fast, good navigation. Best consumer UX in this category. Airtable: good iPad app for structured views, but terrible for reading long-form song lyrics. Tana: no native app (web only, no offline). Capacities: iOS app exists, decent. |
| **Offline** | Notion: partial (caches recently viewed pages, but search requires connection). Airtable: partial. Tana: none. Capacities: partial. None are truly offline-first. |
| **Data ownership** | All SaaS. Your data lives on their servers. Notion export = Markdown (decent). Airtable export = CSV (loses formatting). Tana export = JSON (proprietary structure). |
| **Portability** | Poor to medium. You're putting data INTO their format. Getting it back out in a useful shape requires ongoing effort. |
| **Complexity** | Low to import (Notion can import Markdown). But structuring 1,000 songs as Notion database entries with the right properties takes real setup time. ChordPro formatting in the body will render as plain text — no chord highlighting. |
| **Cost** | Notion: free tier works but limited. Plus = $10/mo. Airtable: free tier limited to 1,000 records. Pro = $20/mo. Tana: free beta (no pricing yet = high uncertainty). |
| **What breaks** | SaaS lock-in is the core risk. Notion repricing, Tana shutting down, Airtable changing limits — you've seen this movie. Also: none of these understand ChordPro notation natively. Your chord charts will be unformatted text blobs. Building a proper song-sheet renderer inside Notion/Airtable is not possible. |

**Verdict:** Notion gives you the best iPad UX out of the box, but at the cost of total SaaS dependency and no chord rendering. Airtable is great for the metadata layer but terrible for the content layer. These tools were built for project management, not music knowledge bases.

---

### D) Build Your Own (PWA / Web App with Markdown as Source)

| Dimension | Assessment |
|-----------|------------|
| **Full-text search** | You control this entirely. Options: (1) client-side with Fuse.js or Lunr.js on a pre-built index — fast, works offline, good for <5,000 docs. (2) Server-side with SQLite FTS5 or Postgres full-text — handles any scale. (3) Both, with client-side for offline and server for advanced queries. |
| **Tag faceting** | Build exactly what you want. Parse frontmatter → create facet filters for key, tempo, tags, artist. Click-to-filter UI with instant results. This is where you'd blow away every other option. |
| **Backlink graph** | Parse `[[wikilinks]]` from your Markdown at build time. Store as a link table. Render a graph with D3 or vis.js. More work than Obsidian gives you for free, but fully customizable. |
| **Semantic search** | Embed your songs with OpenAI's text-embedding-3-small (~$0.01 for 1,000 songs). Store vectors in Supabase (pgvector) or a local JSON file for client-side cosine similarity. Query: "upbeat songs about salvation" → ranked results by meaning. This is where you leapfrog Obsidian. |
| **iPad UX** | PWA (Progressive Web App): install to home screen, full-screen, fast, custom navigation. You design the UX — card grids, swipe between songs, big tap targets, dark mode. No App Store needed. This is your biggest win. |
| **Offline** | Service Worker + cached index = full offline search and reading. Pre-cache all song content at install time (if corpus is <50 MB, this is trivial). Offline writes are harder — you'd queue them and sync later. For V1, offline-read is sufficient. |
| **Data ownership** | Perfect. Markdown files are the source of truth. The app reads from them. If the app dies, you still have every file. |
| **Portability** | Perfect. Your data never enters a proprietary format. |
| **Complexity** | **This is the main trade-off.** You're building an app. MVP is 2–4 weeks if you're focused. You need: a build script to parse Markdown → JSON index, a frontend framework (React/Svelte/vanilla), a search implementation, and hosting. Not trivial, but well within reach with AI-assisted development. |
| **Cost** | Hosting: $0 (Cloudflare Pages / Vercel free tier) for static. $5–6/mo (Supabase free tier or Railway) if you want server-side search or vector DB. Embeddings: <$0.10/mo for the corpus. |
| **What breaks** | You're the maintainer. If a dependency breaks, you fix it. Mitigation: keep the stack minimal (vanilla JS or lightweight framework, SQLite, no complex build chain). The simpler you build it, the longer it lasts. The Markdown files always survive regardless. |

**Verdict:** Highest effort, highest reward. You get exactly the iPad UX you want, exactly the search you want, full data ownership, and a modular architecture that can grow. The risk is building something too complex — the key is aggressive simplicity in V1.

---

## Summary Comparison Matrix

| | Obsidian | Anytype | Notion | Build Your Own (PWA) |
|---|---|---|---|---|
| **Full-text search** | ★★★★★ | ★★★☆☆ | ★★★★☆ | ★★★★★ |
| **Tag faceting** | ★★★☆☆ | ★★★★☆ | ★★★☆☆ | ★★★★★ |
| **Backlinks/graph** | ★★★★★ | ★★★☆☆ | ★★☆☆☆ | ★★★☆☆ (must build) |
| **Semantic search** | ★★★☆☆ (desktop) | ☆☆☆☆☆ | ★★☆☆☆ | ★★★★★ |
| **iPad UX** | ★★☆☆☆ | ★★★☆☆ | ★★★★☆ | ★★★★★ (you design it) |
| **Offline** | ★★★★☆ | ★★★★★ | ★★☆☆☆ | ★★★★☆ |
| **Data ownership** | ★★★★★ | ★★★☆☆ | ★★☆☆☆ | ★★★★★ |
| **Portability** | ★★★★★ | ★★☆☆☆ | ★★☆☆☆ | ★★★★★ |
| **Low complexity** | ★★★★☆ | ★★★☆☆ | ★★★★☆ | ★★☆☆☆ |
| **Future modules** | ★★☆☆☆ | ★★★☆☆ | ★★★☆☆ | ★★★★★ |

---

## Recommended Paths (Top 3)

### 🥇 Path 1: Build a PWA with Static JSON Index (Primary Recommendation)

**Why:** You get the iPad app feeling you want, the search capabilities you want, full data ownership, and a modular foundation for everything else. Your Markdown files stay as source of truth. The "app" is just a viewer/search layer on top.

**Architecture:**
```
Markdown files (source of truth)
    ↓ build script (Node.js)
JSON index (songs.json + search index)
    ↓ deployed to
Cloudflare Pages / Vercel (free)
    ↓ served as
PWA (installable, offline-capable)
    ↓ optional V2
Supabase (pgvector for semantic search)
```

### 🥈 Path 2: Obsidian + Custom Publish via Quartz

**Why:** If building feels like too much, Quartz (static site generator for Obsidian vaults) gives you a searchable, linkable website you can open on iPad. You keep using Obsidian for authoring. Lower effort, lower ceiling.

**Trade-off:** No offline on iPad, no custom faceted search, no semantic search, limited UX customization. You're accepting Obsidian's mobile limitations in exchange for not building anything.

### 🥉 Path 3: Hybrid — Obsidian for Authoring + PWA for Consumption

**Why:** Use Obsidian on desktop for writing/editing songs (where it excels). Run a build script that reads the vault, generates the JSON index, and deploys the PWA. iPad always uses the PWA. Best of both ecosystems.

**This is really Path 1 with the explicit acknowledgment that Obsidian remains your editor.** The PWA is your reader/search tool. They coexist via the shared Markdown files.

---

## Implementation Plan: Path 1 / Path 3 (PWA with Markdown Source)

### Suggested Data Model

#### Frontmatter Schema (standardize across all songs)

```yaml
---
title: "A Brand New Touch"          # Required. Display title.
artist: "Lanny Wolfe"               # Required. Primary artist/composer.
key: "Eb"                           # Required. Musical key.
tempo: 72                           # Optional. BPM as integer.
time: "4/4"                         # Optional. Time signature.
ccli: "6618"                        # Optional. CCLI license number.
copyright: "1977 Lanny Wolfe Music" # Optional. Copyright line.
tags:                               # Required. Flat list, lowercase-hyphenated.
  - worship
  - slow
  - solo
  - traditional
  - comfort                         # ← thematic tags (merge THEMES into tags)
  - petition
genre:                              # Optional. Separated from style tags for faceting.
  - southern-gospel
  - black-gospel
energy: slow                        # Normalized: slow | medium-slow | medium | medium-fast | fast
keywords: "OS Apo Slow"             # Optional. Legacy search terms.
medley: []                          # Optional. Linked song IDs for medley grouping.
id: "FD21514D-312A-4257-822A-8E4FEC284FFD"  # Required. Stable UUID.
---
```

**Key changes from your current format:**
- Flatten compound tags ("Black-Gospel-Choir-Choruses-...") into individual tags. The compound ones are redundant and break faceted filtering.
- Add a normalized `energy` field (enum) derived from your tempo/style tags. This gives you a clean slider/filter in the UI.
- Move `THEMES: COMFORT, PETITION` from the body into frontmatter `tags`. Themes belong in metadata.
- Keep `keywords` for legacy compatibility but don't rely on it for search — full-text handles this.

#### Folder Conventions

```
/songs/
  a-brand-new-touch.md
  a-new-name-in-glory.md
  ...
/modules/                    # V3: future modules
  /setlists/
  /practice-logs/
  /chord-progressions/
/scripts/
  build-index.js             # Parses Markdown → JSON
  embed.js                   # V2: Generates vector embeddings
/public/
  index.html                 # PWA shell
  songs.json                 # Generated search index
  sw.js                      # Service worker for offline
  manifest.json              # PWA manifest
```

#### Generated Index Structure (songs.json)

```json
{
  "songs": [
    {
      "id": "FD21514D-...",
      "slug": "a-brand-new-touch",
      "title": "A Brand New Touch",
      "artist": "Lanny Wolfe",
      "key": "Eb",
      "tempo": null,
      "energy": "slow",
      "time": null,
      "ccli": "6618",
      "tags": ["worship", "slow", "solo", "traditional", "comfort", "petition"],
      "genre": ["southern-gospel"],
      "sections": [
        { "type": "chorus", "text": "Lord, You know I need a brand new touch...", "chords": ["Eb", "Fm", "Bb7", "Ab/Bb"] },
        { "type": "verse", "label": "1", "text": "I thought the sun had come to stay...", "chords": [] }
      ],
      "fullText": "Lord you know I need a brand new touch...",
      "chords_used": ["Eb", "Fm", "Fm7", "Bb7", "Ab/Bb", "Gm/Bb", "Eb7"],
      "links": [],
      "backlinks": []
    }
  ],
  "tagIndex": { "worship": ["FD21514D-...", "26340856-..."], ... },
  "chordIndex": { "Eb": ["FD21514D-..."], ... },
  "buildTime": "2026-03-03T10:00:00Z"
}
```

---

### Phase 1: MVP (Weeks 1–4)

**Goal:** A working PWA you can add to your iPad home screen that lets you browse, search, and read all your songs with a polished UI.

**Week 1: Build Pipeline**
- Write `build-index.js` (Node script): reads all `.md` files from `/songs/`, parses YAML frontmatter with `gray-matter`, extracts sections/chords from the body, outputs `songs.json`.
- Normalize your existing tags during the build (strip compound tags, lowercase, deduplicate).
- Set up a Git repo. Markdown files + build script + output.

**Week 2: Core PWA**
- Single-page app (React or vanilla JS — pick one, keep it simple).
- Song list view: card grid with title, artist, key, energy badge. Sortable by title/artist/key.
- Song detail view: rendered chord chart with section headers. Chords highlighted inline. Transpose button (shift all chords up/down by semitone — this is a killer feature for musicians).
- Install: `manifest.json` + service worker for add-to-home-screen.

**Week 3: Search + Filters**
- Client-side full-text search with Fuse.js or FlexSearch over `fullText` + `title` + `artist`. Instant results as you type.
- Tag facet filters: tap a tag to filter the list. Multi-select. Show tag counts.
- Key filter: dropdown or circle-of-fifths visual picker.
- Energy filter: slow → fast slider or segmented control.

**Week 4: Offline + Polish**
- Service worker caches `songs.json` + all app assets on first load. Full offline read/search after that.
- Dark mode (for stage use — musicians on iPad at night need this).
- Deploy to Cloudflare Pages (free, fast, global CDN).
- Test on iPad Safari. Fix touch targets, font sizes, scroll behavior.

**MVP Deliverable:** An installable PWA at `yourdomain.com` that loads your full song library, supports instant full-text search with tag/key/energy facets, renders chord charts with transpose, works offline, and feels like a native app on iPad.

---

### Phase 2: V2 — Semantic Search + Enhanced UI (Weeks 5–8)

**Week 5–6: Semantic Search**
- Run `embed.js`: sends each song's full text to OpenAI `text-embedding-3-small` API (~$0.02 for 1,000 songs). Stores vectors as a JSON file or in Supabase (pgvector) if you want server-side search.
- Option A (simple): Store embeddings in a flat JSON file, load client-side, do cosine similarity in the browser. Works for <2,000 songs. Zero server cost.
- Option B (scalable): Supabase free tier with pgvector. Query via edge function. Adds a server dependency but handles larger corpora and is what the video describes.
- UI: Add a "Search by meaning" toggle. When active, the search bar does semantic search instead of keyword search. Show similarity scores.

**Week 7: Backlink Graph**
- During build, scan song bodies for `[[wikilinks]]` or references to other song titles. Build a link table.
- Add a "Related Songs" section to each song detail view (songs that share 3+ tags, same key, or explicit links).
- Optional: lightweight graph visualization with D3 force-directed layout. Nice to have, not essential.

**Week 8: UI Enhancements**
- Setlist mode: drag songs into an ordered list, export as PDF or text.
- Quick-jump alphabet bar (A–Z sidebar for fast scrolling through songs by title).
- Recent/favorites using IndexedDB or localStorage.
- Share a song via URL (deep linking to specific songs).

---

### Phase 3: V3 — Module Expansion (Weeks 9+)

**Architecture for modules:** Each module is a separate data directory with its own Markdown/JSON files, its own build step that outputs to the same index, and its own UI route in the PWA.

**Module: Practice Logs**
- `/modules/practice-logs/2026-03-03.md` with frontmatter: `songs_practiced: [id1, id2]`, `duration_minutes: 30`, `notes: "..."`.
- Build step adds practice history to each song's index entry.
- UI: "Last practiced" date on each song card. Practice streak tracking.

**Module: Setlist Builder**
- `/modules/setlists/sunday-2026-03-09.md` with frontmatter: `songs: [id1, id2, id3]`, `date: 2026-03-09`, `event: "Sunday Morning"`.
- UI: Drag-and-drop setlist creation. Key flow detection (flag awkward key transitions). Time estimation from tempo.

**Module: Chord Progression Library**
- `/modules/progressions/` with common progressions tagged by genre/energy.
- Link progressions to songs that use them.

**Module: AI Lyric/Song Tools**
- Connect to Claude or OpenAI API directly from the PWA.
- "Find songs similar to this one" (semantic search is already built).
- "Suggest songs that would pair well in a medley" (based on key, tempo, theme proximity).
- "Help me write a new verse in the style of this song" (send song text as context).

**MCP Integration (Agent-Readable Brain):**
- If you follow the video's Supabase + MCP architecture, your songs.json data (or the Supabase DB) becomes queryable from Claude, ChatGPT, Cursor, etc.
- An MCP server exposes: `search_songs(query)`, `get_song(id)`, `list_by_tag(tag)`, `semantic_search(description)`.
- Now any AI tool you use can say: "You have 14 songs in the key of G tagged 'worship' — here are three that would work for a reflective opening set."

---

### Indexing & Search Architecture (Summary)

```
Layer 1: Full-text (MVP)
  ├── FlexSearch or Fuse.js, client-side
  ├── Indexes: title, artist, fullText, tags
  └── Works offline, instant, zero cost

Layer 2: Faceted filtering (MVP)
  ├── In-memory filter on songs.json arrays
  ├── Facets: tags, key, energy, genre, artist
  └── Combinable (e.g., key=G AND energy=slow AND tag=worship)

Layer 3: Semantic search (V2)
  ├── OpenAI embeddings → pgvector (Supabase) or client-side cosine
  ├── Query: natural language description → ranked song results
  └── Cost: ~$0.02 to embed, ~$0.001/query

Layer 4: Graph/relational (V2)
  ├── Build-time link extraction from [[wikilinks]] and shared tags
  ├── "Related songs" and optional graph visualization
  └── Backlink index in songs.json
```

---

### Tech Stack Recommendation

| Component | Choice | Why |
|-----------|--------|-----|
| **Source of truth** | Markdown files in Git repo | Portable, versionable, editable in Obsidian or any editor |
| **Build script** | Node.js + gray-matter + custom parser | Parse YAML frontmatter + ChordPro body → JSON |
| **Frontend** | React (single .jsx file) or Svelte | PWA-capable, component-based for modules |
| **Search (V1)** | FlexSearch (client-side) | Fastest client-side full-text. 0 server cost. |
| **Hosting** | Cloudflare Pages | Free, fast, global CDN, supports PWA |
| **Semantic search (V2)** | Supabase pgvector (free tier) | 500 MB free, pgvector built-in, edge functions |
| **Embeddings (V2)** | OpenAI text-embedding-3-small | Cheapest quality embeddings, ~$0.02/1K songs |
| **MCP server (V3)** | Supabase Edge Function or Cloudflare Worker | Standard MCP protocol, connects to any AI client |

### What This Costs

| Phase | Monthly Cost |
|-------|-------------|
| MVP | $0 (Cloudflare Pages free, client-side only) |
| V2 with semantic search | $0–5 (Supabase free tier, pennies for API calls) |
| V3 with MCP | $0–6 (same infra, edge function adds negligible cost) |

---

### Risk Mitigation

| Risk | Mitigation |
|------|------------|
| "I built it but never maintain it" | Keep the stack boring. No framework-of-the-month. If it runs on vanilla HTML + JS, it'll run in 5 years. |
| "Cloudflare/Supabase changes pricing" | Your data is Markdown files in Git. The PWA is a static site. Redeploy anywhere in an afternoon. |
| "My build script breaks with new song formats" | Validate frontmatter during build. Fail loudly on malformed files. Keep the schema strict. |
| "Offline sync conflicts" | V1 is read-only on iPad. Edits happen in Obsidian/VS Code → push to Git → rebuild. No conflict possible. |
| "I want to switch to a different frontend framework later" | The `songs.json` index is framework-agnostic. Throw away the UI, keep the index and build pipeline. |



## Obsidian

The normalization script is step 1. Here's the roadmap:

**Right now (before next session):**

- Run the script on all your letter folders
- Review the output, flag anything weird
- Upload the remaining zips to me in the next session so I can catch edge cases the script missed

**Next session — Obsidian polish:**

- Add Dataview plugin for dynamic queries (e.g., "show me all songs where energy is slow and genre contains black-gospel")
- Build Dataview templates for setlist planning, song lookup by key, browse by profile
- Folder structure cleanup if needed
- The theme CSV pass you mentioned

**After that — the build:**

- Supabase schema + ingestion script (Node.js, reads your normalized .md files into Postgres)
- PWA scaffold (search, filter by tags/profile/energy/key, chord chart display)
- MCP server connecting Obsidian to Supabase

The Obsidian Dataview step is valuable even before the PWA because it gives you a working search/filter tool immediately while we build the real thing. Want me to focus on that next session?