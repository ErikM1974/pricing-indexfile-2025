---
name: Memory Maintenance
description: Keep the project's Claude memory healthy and current — compact the auto-loaded MEMORY.md index, archive resolved LESSONS_LEARNED entries, de-duplicate across the two memory trees, and regenerate INDEX.md. Use when the user says `/memory-maintain`, "clean up memory", "compact memory", "the memory is bloated", "archive lessons", "memory is over the limit", or roughly monthly / when MEMORY.md > 22 KB or LESSONS_LEARNED.md > 250 lines. Governing architecture is memory/MEMORY_SYSTEM.md.
---

# /memory-maintain — Memory Maintenance Skill

Runs the upkeep that keeps NWCA's Claude memory loading fully, routing correctly, and free of drift. The governing design is **[memory/MEMORY_SYSTEM.md](../../memory/MEMORY_SYSTEM.md)** — read it first; this skill executes its rules.

## Why this exists
Memory rots in three ways: the auto-loaded `MEMORY.md` index bloats past its 24 KB budget and **silently truncates** (bottom entries stop loading); `LESSONS_LEARNED.md` hits its 300-line cap; and the same fact gets restated in two files (or both memory trees) and the copies **diverge** — a wrong-price risk under Erik's #1 rule. This skill fixes all three.

## Two memory trees (know which you're touching)
- **Auto-memory** `~/.claude/projects/C--Users-erik-OneDrive---Northwest-Custom-Apparel-2025-Pricing-Index-File-2025/memory/` — machine-local, NOT git, can be silently reverted. Holds `MEMORY.md` + per-fact files.
- **Repo memory** `<repo>/memory/` — git-tracked, canonical. Holds durable refs, `LESSONS_LEARNED*`, `INDEX.md`, topic files, `MEMORY_SYSTEM.md`.

## Procedure

### 0. Measure (always)
```bash
CL="$HOME/.claude/projects/C--Users-erik-OneDrive---Northwest-Custom-Apparel-2025-Pricing-Index-File-2025/memory"
wc -lc "$CL/MEMORY.md"                       # budget: < 24576 bytes
wc -l  memory/LESSONS_LEARNED.md             # cap 300, target < 250
git status --short                            # note any PARALLEL-session dirt — never stage it
```
Back up the auto-loaded index before rewriting: `cp "$CL/MEMORY.md" "$TEMP/MEMORY_preoptimize.md"` (it is NOT in git).

### 1. Compact MEMORY.md (if > ~22 KB)
The reference sections (Sync Rules, Gotchas, Caspio schema, Backend, etc.) are durable — **keep them verbatim**. Bloat is almost always in the top "Recently Shipped" block where one-liners grew into paragraphs.
- **Before deleting any detail, VERIFY it's preserved in the entry's topic file.** Fan out one read per bloated entry (a Workflow is ideal): confirm the topic file captures the substance; flag any reusable gotcha that's missing.
- Compress each shipped entry to ONE line: status emoji + name + date + the single load-bearing rule/gotcha + `→ topic-file`. Drop version/release numbers, suite counts, deploy-trivia (recoverable from git/changelog).
- **Age down:** newest items get a full line under "Recently Shipped"; older ones demote to terse pointers under "Earlier Milestones"; oldest drop entirely (detail stays in the topic file).
- Splice safely: write the new top block to a temp file, then `cat _newtop.md <(sed -n '<first-reference-line>,$p' MEMORY.md) > MEMORY.md` — never re-type the 17 KB of reference sections by hand. Re-measure; aim ≤ 23.5 KB for headroom.

### 2. Archive LESSONS_LEARNED.md (if > 250 lines)
- Identify the **oldest RESOLVED one-time fixes** (specific bug shipped + locked by a test) — NOT recurring rules / active architecture invariants.
- Move each full entry to `LESSONS_LEARNED_ARCHIVE.md` (unbounded) under a dated `## Archived YYYY-MM-DD` section; leave a **1-line keep-alive stub** in the active file (`### <title> (<date>, ARCHIVED <today>): <one rule>. Full entry in archive.`).
- Do this as a **single Python write per file** (this repo's OneDrive checkout silently reverts piecemeal edits — see `feedback_onedrive_edit_silent_fail`), then verify on disk with grep.
- To get under the 250 *target* (not just the 300 cap): graduate foundational always-true rules (falsy-zero, Caspio pagination, pricing-from-API, parity disciplines) OUT of the bug log into CLAUDE.md Critical Patterns, leaving a pointer.

### 3. De-dupe across trees (the drift killer)
- Find topics that exist in BOTH trees (e.g. `wa-sales-tax-rules.md`, `garment-art-form*`). The **repo copy is canonical**; reconcile any divergence into it, then reduce the auto-memory copy to a 1-line pointer. NEVER leave two full copies of a pricing/tax fact.
- Within the repo tree, collapse superseded duplicates (e.g. multiple unification plans) to one current doc + archive the rest.

### 4. Regenerate INDEX.md
- `git ls-files memory` → diff against `INDEX.md`. Remove orphan links (files that no longer exist), add missing files (or deliberately exclude one-time session logs), bump "Last Updated".

### 5. Commit (OneDrive-revert guard) — repo files only
Stage **only the memory files you changed** (never the parallel-session dirt from step 0):
```bash
git add -- memory/LESSONS_LEARNED.md memory/LESSONS_LEARNED_ARCHIVE.md memory/INDEX.md memory/MEMORY_SYSTEM.md
git commit -m "Memory: <what changed>"
git show --stat HEAD | head   # confirm the commit captured it
```
The auto-loaded `MEMORY.md` lives outside the repo (`~/.claude`) — it is not committed, just saved on disk.

### 6. Report
One or two sentences: sizes before→after, what was archived/de-duped, and any cleanup left on the MEMORY_SYSTEM.md backlog.

## Guardrails
- **Verify before you delete** — a fact only leaves the index/log if its detail is confirmed elsewhere.
- **Never stage another session's files** — a shared OneDrive checkout means `git status` can show dirt you didn't create. Stage explicit paths only.
- **Keep the reference sections of MEMORY.md verbatim** — they're the durable core; compaction only touches the shipped-log.
- **One fact, one home** — the point of this pass is to *remove* duplication, not relocate it.
