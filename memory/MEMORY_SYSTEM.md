# Memory System — how NWCA remembers code, gotchas & decisions

> **This is the single source of truth for HOW our project memory works** (not what's in it).
> Read this when you're unsure where a new fact belongs, or when memory feels bloated/stale.
> Maintained as part of the 2026-06-25 memory-system pass. Run `/memory-maintain` to keep it healthy.
>
> **Recovered 2026-08-12** from `cc9a61e4^` after the 2026-07-28 `/memory/` reset deleted it
> (git and `Downloads\repo-memory-backup-2026-07-28\` agree byte-for-byte apart from line
> endings, so this is the original design, not a reconstruction). The DESIGN below is unchanged
> and still correct. What the reset invalidated is *inventory* — see **Current state** at the
> bottom before trusting any specific filename on this page.

---

## TL;DR — "I just learned something. Where does it go?"

| What you learned | Where it goes | Why |
|---|---|---|
| A **never-break rule / convention** that's always true | **CLAUDE.md** (Critical Patterns / Top rules) | Loads every turn; it's law |
| A **bug + root cause + fix + prevention** (could recur) | **LESSONS_LEARNED.md** (repo) | The bug log; Problem/Root Cause/Solution/Prevention shape |
| A **one-line "shipped X" / decision / gotcha pointer** | **MEMORY.md** index (`~/.claude/.../memory`) | The auto-loaded session index |
| **>2 lines of feature/domain detail** | a **topic file** in repo `/memory` + add a line to `INDEX.md` and a pointer in `MEMORY.md` | Detail loads on-demand, index stays small |
| A **repeatable procedure** (how to deploy, scaffold, audit) | a **skill** in `.claude/skills/` | Body loads only when invoked |
| A **ManageOrders / Caspio / integration field or endpoint** | the routing table below | Keeps one master per integration |
| A **personal preference / feedback about how to work** | a `feedback_*` / `user_*` per-fact file in `~/.claude/.../memory` | Auto-memory's modern per-fact format |

**Golden rule: one fact, one home.** If it already lives somewhere, update that — don't restate it in a second file. Restated facts drift and become wrong (the #1 way our memory rots).

### Integration routing (the existing ManageOrders table, generalized)

> ⚠️ **2026-08-12: most targets below no longer exist.** The 2026-07-28 reset deleted them and
> they survive only in `Downloads\repo-memory-backup-2026-07-28\`. The *routing* is still the
> intended design; the *destinations* must be restored (or the rule retargeted) before it works.
> 🔴 `CLAUDE.md` still routes ManageOrders discoveries to two of these missing files, so
> following that rule today writes into a ghost — restore them or fix CLAUDE.md.
| Discovery | Destination |
|---|---|
| ManageOrders fields/endpoints/implementations | `MANAGEORDERS_COMPLETE_REFERENCE.md` (master) — ⚠️ **BACKUP ONLY** |
| ManageOrders bugs/gotchas | `LESSONS_LEARNED.md` (Order Processing) |
| ManageOrders CRM/Order-Entry | `MANAGEORDERS_CRM_CAPABILITY_REFERENCE.md` — ⚠️ **BACKUP ONLY** |
| 3-Day Tees Stripe→ShopWorks flow | `3-day-tees/ORDER_PUSH_FLOW.md` — ⚠️ **BACKUP ONLY** |
| Caspio API behavior/gotcha | `caspio-schema.md` (auto-memory, EXISTS) / `CASPIO_API_CORE.md` — ⚠️ **BACKUP ONLY** (+ LESSONS if a bug) |
| Pricing decision / parity baseline change | the method's `*-pricing` topic file + re-run the parity tests |
| SanMar read API | `SANMAR_API_REFERENCE.md` · SanMar PO (write) `sanmar-po/README.md` — ⚠️ **BOTH BACKUP ONLY** |

---

## The 6 memory surfaces (tiered by WHEN they load)

| # | Surface | Location | Loads | Holds | Budget |
|---|---|---|---|---|---|
| 1 | **CLAUDE.md** | repo root | **every turn** | Never-break rules, conventions, where-things-go | **< 200 lines** |
| 2 | **MEMORY.md** (index) | `~/.claude/projects/<proj>/memory/` | **every session** (first ~200 lines / 24 KB only) | One-liner index: open actions, recently-shipped (ages down), durable rules, topic-file pointers | **< 24 KB** |
| 3 | **Topic files** | repo `/memory` (durable) · `~/.claude` (volatile) | **on-demand** (Read) | Deep per-domain/feature detail | keep each focused |
| 4 | **LESSONS_LEARNED.md** (+ `_ARCHIVE`) | repo `/memory` | **on-demand** | Recurring bugs & gotchas (Problem/Root Cause/Solution/Prevention) | **< 300 lines, target < 250**; archive oldest resolved when over 250 |
| 5 | **Skills** | `.claude/skills/<name>/SKILL.md` | description always; body on invoke | Repeatable procedures (`deploy`, `dash-page`, `memory-maintain`) | < 500 lines/skill |
| 6 | **Path-scoped rules** | `.claude/rules/*.md` | **lazy** — when Claude opens a file matching the rule's `paths:` globs | Domain rules that only matter in a subtree (`quote-builders`, `pricing-services`) | keep focused |

> **2026-08-12 practical target for MEMORY.md is ≤17 KB, not 24 KB.** 24 KB is the cliff, not a
> goal — aiming at it leaves no headroom, and the failure is SILENT (the bottom simply stops
> loading). The durable-gotchas block was moved to `DURABLE_GOTCHAS.md` for exactly this reason.

**Anything that exceeds its budget overflows DOWN a tier** (CLAUDE.md rule → topic file; MEMORY.md paragraph → topic file + one-line pointer). Budgets are not suggestions: MEMORY.md silently truncates past ~24 KB (bottom entries stop loading), and CLAUDE.md adherence drops past ~200 lines.

---

## Two trees — which copy is canonical

We have **two** memory directories. Know the difference:

- **`~/.claude/projects/<proj>/memory/`** — Claude's **auto-memory**. Machine-local, **NOT in git**, and on this OneDrive checkout it can be **silently reverted** mid-session. Holds the `MEMORY.md` index + modern per-fact files (`user_`/`feedback_`/`project_`/`reference_`) + a few topic files. **Treat as volatile.**
- **repo `/memory/`** — git-tracked, shared across machines, survives. The durable references, guides, `LESSONS_LEARNED`, and session docs. **This is the canonical store.**

**Rules:**
1. Anything that must survive a machine change or be shared → put it in the **repo tree** (or commit it there).
2. When a topic exists in **both** trees, the **repo copy is canonical**; the auto-memory keeps only a **one-line pointer**, never a second full copy. (Two divergent copies of a pricing/tax fact is a wrong-price risk — Erik's #1 rule.)
3. After editing any repo memory file, **`git commit` immediately** — committed objects survive the OneDrive revert; working-tree edits may not.

---

## Code: store pointers, not bodies

- **Never paste code bodies into memory** — they rot the moment the file changes. Store `file:line + one-sentence WHY + the gotcha`.
  - Good: `screenprint-pricing-service.js priceScpGroup() — sleeves price as additional locations (== back); legacy sleeveCount:0 must stay byte-identical (Rule 9 parity).`
  - Bad: pasting the function.
- **Find fresh code with Grep/Glob/Explore**, not memory recall. Memory answers **WHY** (decision, risk, gotcha) and **WHERE** (file:line); the code itself answers HOW and is always re-fetched.
- Keep a tiny **critical-files map** (the 3–5 single-source files: the pricing engine, the invoice generator, the push transformers) so a new session knows the load-bearing seams without grepping blind.

---

## Size budgets & aging-down

The index has **fixed capacity** — it does not grow with the project; the project's knowledge grows in **topic files**. As new work ships, **age old index entries down**:

`full one-liner` → `terse pointer in "Earlier Milestones"` → `dropped from the index` (detail stays in its topic file forever).

Durable **rules/gotchas** graduate the other way: when a shipped item proves a lasting invariant, lift it OUT of "recently shipped" into CLAUDE.md (Critical Patterns) or a permanent reference — those are the only things that live in the index forever.

---

## Maintenance — keeping it current

- **Every substantive session** updates memory per the decision tree above — it's part of finishing the task, not a separate ask (CLAUDE.md "Auto-Update Memory").
- **Run `/memory-maintain`** when MEMORY.md > ~22 KB, LESSONS_LEARNED > 250 lines, or roughly monthly. It compacts the index, archives resolved lessons, de-dupes across the two trees, and regenerates `INDEX.md`.
- **OneDrive:** commit memory edits immediately; re-Read/grep on disk after editing — never trust the edit-success message alone (this checkout reverts silently).
- **Naming a new repo topic file:** `SCREAMING_SNAKE_YYYY-MM.md` for dated session/audit docs, `kebab-case.md` for durable references. **Always add a line to `INDEX.md`** when you create one.

---

## Current state — 2026-08-12

The `/memory/` knowledge base was **emptied on 2026-07-28** (`cc9a61e4`, "fresh start"). The
design on this page survived only because it was recoverable from git. Where things stand now:

| | State |
|---|---|
| repo `/memory/` | **23 files** — rebuilt organically since the reset, not restored from backup |
| `INDEX.md` | recreated 2026-08-12 (had been missing since the reset, so the canonical tree had no index at all) |
| `MEMORY.md` index | 12.6 KB / 75 lines — well under the 24 KB cliff |
| `DURABLE_GOTCHAS.md` | **new 2026-08-12** — ~60 traps moved out of `MEMORY.md`; they no longer auto-load, so they are grouped by TRIGGER with a lookup table in both files |
| `LESSONS_LEARNED.md` | 250 lines (cap 300) · `_ARCHIVE.md` 1,600 lines |
| `memory/archive/` | **gone** — wiped by the reset |

**Open backlog:**

- 🔴 **Restore the integration-reference files, or retarget the rules that name them.**
  `MANAGEORDERS_COMPLETE_REFERENCE.md`, `MANAGEORDERS_CRM_CAPABILITY_REFERENCE.md`,
  `3-day-tees/ORDER_PUSH_FLOW.md`, `CASPIO_API_CORE.md`, `SANMAR_API_REFERENCE.md` and
  `sanmar-po/README.md` exist only in the Downloads backup, yet **CLAUDE.md and this page both
  still route new discoveries to them.** Note they are pre-2026-07-28 and ManageOrders has moved
  since (e.g. the 2026-08-10 ORDER_ODBC reconcile), so a restore needs a currency check — do not
  copy them back blind.
- ⚠️ **Auto-memory `caspio-api-usage-audit-2026-07.md` vs repo `CASPIO_QUOTA_2026-07.md`** — same
  subject, DIFFERENT date ranges (waves 2–3 on 18+26 Jul vs 27 Jul–1 Aug). Deliberately NOT
  collapsed: folding one into the other would drop the wave-2 record. Reconcile, don't delete.
- ⚠️ **A machine-local file is not a record.** The 2026-08-12 pass found facts living ONLY in
  `~/.claude/.../MEMORY.md` — unversioned, silently revertible. Anything durable belongs in the
  repo tree. This is now also a durable gotcha.

---

## ✅ Memory-system redesign — status (2026-06-25, HISTORICAL — pre-reset)

> Kept as the record of how the system was built. 🔴 Several items below were UNDONE by the
> 2026-07-28 reset (INDEX.md was deleted, `memory/archive/` was wiped, the 108-file inventory is
> gone). Read it as history, not as current state.

**Phase 1 — foundation** (`develop`: `8c06b638` archive · `42986c9d` system · `74d337fb`+`d1aa37c5` CLAUDE.md trim):
- `MEMORY.md` index compacted 47 KB → 24.4 KB (fully loads again; aging-down rule baked in).
- `LESSONS_LEARNED.md` archived 300 → 272 lines (7 oldest resolved fixes → `_ARCHIVE.md`, keep-alive stubs).
- This `MEMORY_SYSTEM.md` + `CLAUDE.md` "Where things go" routing + the `/memory-maintain` skill created. CLAUDE.md back under 200 lines.

**Phase 2 — cleanup** (`develop`: `9a6f15f9` wa-sales-tax · `c2da4af5` INDEX+archive):
- `wa-sales-tax-rules.md` reconciled to one canonical (repo) copy; machine-local copy stubbed.
- `INDEX.md` regenerated from `git ls-files` (108/108 categorized); 15 zero-reference historical docs moved to `memory/archive/`.

**Remaining = optional only** (see backlog below — all DEFERRED with rationale: frontmatter unify, LESSONS-to-250, `.claude/rules/`). Nothing blocking. Non-memory to-dos live in the `MEMORY.md` "⏳ Open Actions" block.

### Known cleanup backlog as of 2026-06-25 (HISTORICAL — several undone by the reset)

- [x] **`wa-sales-tax-rules.md`** — DONE 2026-06-25: promoted the newer superset (with the 2026-06-07 EMB tax findings) into the canonical repo copy; machine-local copy reduced to a pointer.
- [x] **`INDEX.md`** — DONE 2026-06-25: regenerated from `git ls-files memory` (108/108 files categorized, 0 uncategorized). The 2 "orphan links" the audit flagged actually exist on disk (untracked), so they were NOT removed. Now regenerable via `/memory-maintain`.
- [x] **Archive one-time docs** — DONE 2026-06-25: moved 15 zero-reference historical docs (NEXT_SESSION_PICKUP_*, OVERNIGHT/PHASE_3, EMB_* pickups, 2026-01 audits, superseded plan) to `/memory/archive/`. 3 still-referenced (EMB_FINAL_VERDICT, EMB_TO100, QUOTE_BUILDER_UNIFICATION_PLAN) left in place; ~10 still-pointed-to audit docs bucketed under "historical" in INDEX rather than moved.
- [x] **Auto-memory frontmatter unified** — DONE 2026-06-25: all 21 flat `type:` files converted to the nested `metadata.node_type/type` schema (`originSessionId` and extra fields preserved). 0 flat-type files remain.
- [x] **LESSONS under 250** — DONE 2026-06-25: 271 → 246 lines. Reduced 5 duplicated foundational rules to 1-line pointers (falsy-zero, Caspio pagination, pricing-from-API, OnSite-drops-tax, EMB falsy-zero recurrence) + archived 2 resolved one-time fixes (SCP `manualCost` gate, deploy `git add -u`).
- [x] **`.claude/rules/` introduced** — DONE 2026-06-25: path-scoped `quote-builders.md` + `pricing-services.md` + README. The builder sync manifest moved OUT of CLAUDE.md into the rule (loads only when editing builder files); CLAUDE.md points to it.
