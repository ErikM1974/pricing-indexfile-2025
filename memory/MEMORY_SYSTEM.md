# Memory System — how NWCA remembers code, gotchas & decisions

> **This is the single source of truth for HOW our project memory works** (not what's in it).
> Read this when you're unsure where a new fact belongs, or when memory feels bloated/stale.
> Maintained as part of the 2026-06-25 memory-system pass. Run `/memory-maintain` to keep it healthy.

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
| Discovery | Destination |
|---|---|
| ManageOrders fields/endpoints/implementations | `MANAGEORDERS_COMPLETE_REFERENCE.md` (master) |
| ManageOrders bugs/gotchas | `LESSONS_LEARNED.md` (Order Processing) |
| ManageOrders CRM/Order-Entry | `MANAGEORDERS_CRM_CAPABILITY_REFERENCE.md` |
| 3-Day Tees Stripe→ShopWorks flow | `3-day-tees/ORDER_PUSH_FLOW.md` |
| Caspio API behavior/gotcha | `caspio-schema.md` / `CASPIO_API_CORE.md` (+ LESSONS if a bug) |
| Pricing decision / parity baseline change | the method's `*-pricing` topic file + re-run the parity tests |
| SanMar read API | `SANMAR_API_REFERENCE.md` · SanMar PO (write) | `sanmar-po/README.md` |

---

## The 5 memory surfaces (tiered by WHEN they load)

| # | Surface | Location | Loads | Holds | Budget |
|---|---|---|---|---|---|
| 1 | **CLAUDE.md** | repo root | **every turn** | Never-break rules, conventions, where-things-go | **< 200 lines** |
| 2 | **MEMORY.md** (index) | `~/.claude/projects/<proj>/memory/` | **every session** (first ~200 lines / 24 KB only) | One-liner index: open actions, recently-shipped (ages down), durable rules, topic-file pointers | **< 24 KB** |
| 3 | **Topic files** | repo `/memory` (durable) · `~/.claude` (volatile) | **on-demand** (Read) | Deep per-domain/feature detail | keep each focused |
| 4 | **LESSONS_LEARNED.md** (+ `_ARCHIVE`) | repo `/memory` | **on-demand** | Recurring bugs & gotchas (Problem/Root Cause/Solution/Prevention) | **< 300 lines, target < 250**; archive oldest resolved when over 250 |
| 5 | **Skills** | `.claude/skills/<name>/SKILL.md` | description always; body on invoke | Repeatable procedures (`deploy`, `dash-page`, `memory-maintain`) | < 500 lines/skill |

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

## 🔄 Resume here — memory-system redesign status (paused 2026-06-25)

**Phase 1 DONE + committed** (`develop`, commits `8c06b638` archive · `42986c9d` system · `74d337fb`+`d1aa37c5` CLAUDE.md trim):
- `MEMORY.md` index compacted 47 KB → 24.4 KB (fully loads again; aging-down rule baked in).
- `LESSONS_LEARNED.md` archived 300 → 271 lines (7 oldest resolved fixes → `_ARCHIVE.md`, keep-alive stubs left).
- This `MEMORY_SYSTEM.md` + `CLAUDE.md` "Where things go" routing + the `/memory-maintain` skill created. CLAUDE.md back under 200 lines.

**Open question for Erik (answer to resume):** run the deeper cleanup (the backlog below) now in one pass, or leave it to the spawned chip + future `/memory-maintain` runs?

**Next when we resume:** (1) the `wa-sales-tax` reconcile — a chip was spawned (`task_845aae16`); (2) then work the backlog below, ideally by invoking `/memory-maintain`. Non-memory to-dos (decoration pricing decision, caps go-live checks, EmailJS bugs, test-data cleanup) live in the `MEMORY.md` "⏳ Open Actions" block.

## Known cleanup backlog (work the next `/memory-maintain` passes do)

- [x] **`wa-sales-tax-rules.md`** — DONE 2026-06-25: promoted the newer superset (with the 2026-06-07 EMB tax findings) into the canonical repo copy; machine-local copy reduced to a pointer.
- [x] **`INDEX.md`** — DONE 2026-06-25: regenerated from `git ls-files memory` (108/108 files categorized, 0 uncategorized). The 2 "orphan links" the audit flagged actually exist on disk (untracked), so they were NOT removed. Now regenerable via `/memory-maintain`.
- [x] **Archive one-time docs** — DONE 2026-06-25: moved 15 zero-reference historical docs (NEXT_SESSION_PICKUP_*, OVERNIGHT/PHASE_3, EMB_* pickups, 2026-01 audits, superseded plan) to `/memory/archive/`. 3 still-referenced (EMB_FINAL_VERDICT, EMB_TO100, QUOTE_BUILDER_UNIFICATION_PLAN) left in place; ~10 still-pointed-to audit docs bucketed under "historical" in INDEX rather than moved.
- [ ] **Unify auto-memory frontmatter** to one schema (nested `metadata.type`); 21 files still use the older flat `type:`.
- [ ] **Graduate ~6 foundational LESSONS rules** (falsy-zero, Caspio pagination, pricing-from-API, parity disciplines) into CLAUDE.md Critical Patterns so the bug log drops under its 250 target.
- [ ] **Consider `.claude/rules/*.md`** (path-scoped lazy-loaded rules with `paths:` frontmatter) for domain rules that only matter when editing certain files (e.g. quote-builder rules) — keeps CLAUDE.md lean.
