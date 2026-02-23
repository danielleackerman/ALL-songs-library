
# CORPUS QUEUE_spec v0.0
**Project: Execution Engine / Corpus-to-Opus Pipeline**
*Written in the spirit of the Dark Factory Engineer: the spec is the software.*

---

## WHAT THIS IS (IN ONE SENTENCE)

A local-first pipeline that ingests raw creative material — poems, song fragments, stories, frameworks, moments, and archive debris — classifies each chunk by type, routes it to its correct vessel, and produces a reviewable, correctable, permanently organized corpus.

---

## THE PROBLEM IT SOLVES

You have years of creative output scattered across formats, files, and devices. The material exists. The meaning exists. What doesn't exist is a system that knows *what kind of thing each piece is* — and therefore where it belongs, what it's for, and how to work it. Right now, every time you need to find a poem or a framework, you're doing archeology. This tool ends that. It assigns jurisdiction to every piece of material and routes it accordingly. You stop searching. You start building.

The secondary problem: your Chaos Portal ecosystem (the corpus, the library, the frameworks) has no intake valve. Material accumulates without being sorted. This pipeline *is* the intake valve.

---

## THE ECOSYSTEM WHERE THIS LIVES

Your existing system is a layered creative knowledge architecture:

**Chaos Portal** — the public-facing research and navigation environment for music, story, and systems analysis. The Story Coordinate Compass (13-position × 6-dimension grid) lives here. This is the "Atlas" layer: knowledge organized spatially.

**The Library** — your curated reference corpus already tagged and structured in `library.js`, covering music tools, datasets, frameworks, cross-domain bridges.

**RA-H** — the infrastructure candidate. It's a local SQLite knowledge graph with Node.js frontend, MCP server access for Claude/AI agents, semantic search, and edge/dimension tagging. It runs at `localhost:3000`. It stores nodes, links them, and lets AI agents read and write to it.

**Your raw material** — the unsorted creative corpus: poems, songs, story fragments, frameworks, moments, and archive material.

The Corpus Queue pipeline sits **between your raw material and all three of those systems.** It is the intake, classification, and routing layer that everything else depends on.

---

## WHAT THE TOOL ACTUALLY DOES — FUNCTIONAL SPECIFICATION

### Stage 1 — Ingest

Reads files from a designated `INBOX_TEXT/` directory. Accepts `.md` and `.txt` to start. Splits each file into discrete chunks using a priority-ordered set of split signals: section separators (`---`), blank lines, headings, or a character ceiling of ~1000 characters. Each chunk is assigned a `chunk_id` derived from filename + index.

### Stage 2 — Classify

Each chunk is evaluated against six content types. These are your vessels:

`POEM` — compression, image density, line-break intentionality, repetition that strengthens.
`SONG` — melodic/rhythmic patterning, hook structures, lyric logic, verse-chorus topology.
`STORY` — causality, character, temporal sequence, scene.
`FRAMEWORK` — abstraction, principle-form, definitional logic, reusability.
`MOMENT` — experiential, present-tense, singular, non-generalizable.
`ARCHIVE` — historical record, reference, no active production value.

Classification uses a hybrid approach. A rule-based scorer evaluates each chunk across signal dimensions (abstraction density, repetition tolerance, causality markers, context dependence). An LLM call then confirms or overrides using the rule scores as context, producing a label, confidence score (0–1), and a brief reasoning string. Items below a confidence threshold (initially 0.65) route automatically to a Review Queue.

### Stage 3 — Route

Classified chunks write to:
- `results.csv` with fields: `id, source_file, chunk_index, label, confidence, reasons, excerpt`
- Append-style bucket files: `POEM__bucket.md`, `SONG__bucket.md`, etc.
- `review.csv` for low-confidence items requiring human review

### Stage 4 — Override Loop

When you correct a label in `review.csv`, the tool writes your correction to `overrides.csv`: `text_hash, predicted_label, corrected_label`. These corrections accumulate. Over time they become the training signal to refine the rule weights and prompt rubric. The system learns your editorial voice.

---

## HOW IT WILL BE BUILT — TECHNICAL SPECIFICATION

**Runtime:** Node.js. You are already in this world. No Python context switch required for MVP.

**Storage backend:** RA-H's local SQLite database is the correct long-term target. It already has the node/edge/dimension schema, MCP tooling, and semantic search. In MVP, you skip RA-H integration and write flat files (CSV + markdown buckets). In Phase 2, classified items write directly to RA-H as nodes tagged with their vessel dimension.

**LLM integration:** OpenAI API (or Claude API) for the classification confirmation step. Cost is negligible — classification calls on ~500-character chunks run at fractions of a cent. Budget: under $2/month for heavy corpus processing.

**Interface — Phase 1:** CLI only. One command: `node classify.js` reads `INBOX_TEXT/`, writes outputs. No UI. Fast.

**Interface — Phase 2:** Local web review UI reading `review.csv`. One chunk at a time, hotkeys P/S/T/F/M/A for label assignment, writes to `overrides.csv`. Built in Next.js or plain React. Runs at `localhost:3001`.

**Interface — Phase 3:** The orbit visualization (already built) becomes the mode-selector wrapper. Center node = MOMENT, inner ring = the six vessels, outer ring = pipeline stages. This is the identity layer, not the workbench.

---

## FOLDER STRUCTURE

```
/corpus-queue/
├── INBOX_TEXT/           ← drop raw .md/.txt here
├── OUTPUT/
│   ├── POEM__bucket.md
│   ├── SONG__bucket.md
│   ├── STORY__bucket.md
│   ├── FRAMEWORK__bucket.md
│   ├── MOMENT__bucket.md
│   └── ARCHIVE__bucket.md
├── results.csv
├── review.csv
├── overrides.csv
├── classify.js           ← main script
├── chunker.js            ← splitting logic
├── scorer.js             ← rule-based signal scoring
├── labeler.js            ← LLM classification call
└── router.js             ← writes to buckets + CSV
```

---

## WHO ELSE BENEFITS FROM THIS

**You, immediately** — sorting time collapses. The corpus becomes navigable. Production unblocks.

**Other solo creators with high-volume output** — songwriters, poets, essayists, systems thinkers who have accumulated years of material across apps and formats and cannot find their own work.

**The Chaos Portal itself** — once the corpus is sorted, the classified material feeds the Atlas, the Workbench, the Field Guide. The portal gets richer without manual curation effort.

**Anyone using RA-H** — if Phase 2 integration is built, this pipeline becomes a "content ingestor" module for the RA-H knowledge graph system, which is explicitly designed for AI agents to read/write. There is a public tool opportunity here: a classification pipeline that feeds a personal knowledge graph.

---

## PHASES — BROAD TO SPECIFIC

**Phase 0 — Pre-conditions (do this before writing code)**
Gather 50–100 representative chunks from your actual corpus and manually label them. This becomes your ground truth test set. You will use it to calibrate the classifier before running on the full corpus.

**Phase 1 — MVP (1–2 sessions)**
`classify.js` script: reads `INBOX_TEXT/`, chunks, calls scorer + labeler, writes `results.csv` + bucket files + `review.csv`. Run on the test set. Adjust confidence threshold and 2–3 rule weights. Run on the full corpus.

**Phase 2 — Review UI + Override Loop (1 session)**
Local web UI for `review.csv`. Hotkey label assignment. `overrides.csv` accumulates corrections. Periodic rubric refinement based on correction patterns.

**Phase 3 — RA-H Integration**
Classified nodes write to RA-H SQLite database via `rah_add_node` and `rah_create_edge` tools. Each node gets a vessel dimension tag. Semantic search across the corpus becomes available. Claude Code can now query the corpus via MCP.

**Phase 4 — Orbit UI as Portal Entry**
The existing orbit component becomes the entry point to the full system. Clicking a vessel enters that vessel's triage queue. The system is now the Corpus Queue as a product, not just a script.

---

## THE THREE THINGS TO DECIDE BEFORE WRITING CODE

1. Where does most of your unsorted material currently live? (plain text files, Apple Notes, Google Docs, or mixed — this determines what the ingest step needs to handle at MVP vs. later)

2. Do you want Phase 1 to run fully offline (rule-based only, no API call) or with LLM classification calls? (Offline is faster to build and private; LLM is significantly more accurate on messy fragments)

3. Do you want Phase 2 to target RA-H as the storage backend, or keep flat files indefinitely? (RA-H is the right long-term answer; the question is when the complexity is worth it)

---

**The spec is the software. Answer those three questions and the first executable is one session away.**>>