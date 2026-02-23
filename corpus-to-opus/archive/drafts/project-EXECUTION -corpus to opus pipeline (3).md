# project-EXECUTION -corpus to opus pipeline (3)
Execution \= where this stops being “a concept” and becomes **a thing you can run on your machine**.

You want the *fastest path to a working sorter* that you can actually use with your real notes, without building a cathedral.

Here’s the straight plan.

---

## **The ruthless MVP (what you build first)**

**Goal:** Take a folder of text notes → auto-label each chunk as `POEM / SONG / STORY / FRAMEWORK / MOMENT / ARCHIVE` → output a reviewable CSV \+ route into folders.

### **Output artifacts (MVP deliverables)**

1. `results.csv` with:  
   `id, source_file, chunk_index, label, confidence, reasons, excerpt`  
2. A folder tree:  
   `/OUTPUT/POEM/`, `/OUTPUT/SONG/`, `/OUTPUT/STORY/`, `/OUTPUT/FRAMEWORK/`, `/OUTPUT/MOMENT/`, `/OUTPUT/ARCHIVE/`  
3. A “Review Queue” file for uncertain items:  
   `review.csv` (confidence \< threshold)

That’s enough to cut sorting time in half immediately.

---

## **Step 0: Normalize your input (don’t skip this)**

You cannot classify chaos formats efficiently. So:

* **Export / dump** anything digital into one directory: `INBOX_TEXT/`  
* Preferred formats for MVP:  
  * `.txt` or `.md`  
* If you have PDFs, Apple Notes, or Google Docs, convert later. Start with what’s easiest.

**You do not need to solve every source now.**  
You need one big batch to prove the pipeline.

---

## **Step 1: Decide what “one item” is (this prevents garbage output)**

You have two choices:

### **A) File \= one item**

Fast, but messy if your files are long.

### **B) Chunk \= one item (recommended)**

Split on:

* blank lines  
* `---`  
* headings  
* or a max length (e.g., 800–1200 characters)

Chunks are the right unit for:

* poems  
* fragments  
* premises  
* story seeds

---

## **Step 2: Choose your classifier style (pick one)**

### **Option 1 — Rule-based only (fastest, deterministic)**

Scores features like:

* repetition tolerance  
* causality markers  
* abstraction density  
* context dependence

Then assigns label by max score.

✅ private, cheap  
❌ needs tuning for your voice

### **Option 2 — LLM-only (most accurate on messy fragments)**

Send chunk \+ rubric → label \+ confidence \+ reasons.

✅ strong accuracy  
❌ variability \+ cost \+ needs guardrails

### **Option 3 — Hybrid (best)**

Rules produce score signals → LLM decides using the signals → confidence threshold routes uncertain items to MOMENT.

✅ accurate \+ auditable \+ stable

**My execution recommendation:** Hybrid.

---

## **Step 3: Routing (the part that makes it useful)**

After labeling, the script either:

* **copies** each chunk into the right folder as a new text file  
  OR  
* **appends** chunks into a single file per label (fewer files)

I’d do **append-per-label** for sanity at scale:

* `POEM__bucket.md`  
* `SONG__bucket.md`  
  etc.

Plus you keep the CSV for search/filter later.

---

## **Step 4: The human override loop (this is where it gets scary-good)**

You need one action:

* When you disagree, you change the label in `review.csv` and rerun.  
* The tool records your correction in `overrides.csv`:  
  * `text_hash, predicted_label, corrected_label`

Later, you can:

* adjust rule weights  
* improve prompts  
* train a lightweight model (optional)

This is how it becomes *your instrument*.

---

## **The UI question (execution-wise)**

**Do not build UI first.**

UI is Phase 2\.

### **Phase 1: CLI \+ CSV \+ folders (1–2 sessions)**

This gets you sorting **now**.

### **Phase 2: “Review UI” (simple web page)**

A barebones local web app that:

* loads `review.csv`  
* shows one chunk at a time  
* hotkeys: P/S/T/F/M/A  
* writes corrections

### **Phase 3: “Orbit UI”**

That becomes a **mode selector / identity layer**, not the workbench.

---

## **Tech stack that fits you (and why)**

Since you’re already in the JS/React world:

### **MVP backend**

* **Node.js script** (reads files, chunks, labels, outputs CSV)  
* Optional: call OpenAI API for LLM labeling (if you choose)

### **Review UI**

* Next.js (or plain React) reading the CSV/JSON generated output

This fits your existing motion and avoids context switching into Python unless you want it.

---

## **What I need from you to lock the build path (no big interrogation)**

Just answer these two:

1. Your notes are currently mostly in:  
   **(A)** plain text/markdown files, **(B)** Apple Notes, **(C)** Google Docs, **(D)** mixed  
2. Do you want the first version to run:  
   **(1)** fully offline (rules-only), or  
   **(2)** ok with an LLM call for better labeling accuracy?

---

## **If you want the “first executable” today**

The fastest possible execution sequence is:

1. Create `INBOX_TEXT/` and drop 20–50 representative notes (even copied/pasted).  
2. Run a script that:  
   * chunks  
   * labels  
   * outputs CSV \+ bucket files  
3. Manually review the top 50 low-confidence items.  
4. Adjust threshold \+ one or two rubric weights.  
5. Run on the full corpus.

That’s it. No perfection.

---

If you tell me **A/B/C/D** and **1/2**, I’ll give you the exact build recipe next: folder structure, file naming conventions, chunking rules, and the classifier approach that best matches your material density.

