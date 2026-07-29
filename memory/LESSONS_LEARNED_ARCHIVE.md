# LESSONS LEARNED — ARCHIVE

Entries retired from `LESSONS_LEARNED.md` to keep it under its 300-line cap.
No limit here. Newest-archived first; each entry keeps its original date.

---

## A ratchet test sat red for 9 days because /deploy only runs test:parser (2026-07-28)

**Problem.** `tests/unit/builders-function-length.test.js` was failing on `develop`:
`dtg/form-core.js:init` measured 155 lines against a 150 cap. Nobody noticed for 9 days,
across several deploys.

**Root cause (two layers).**
1. *The regression.* Commit `b25c68ca` (2026-07-19, "fix(leads): quote-builder prefill from
   a lead now works") added the `?from=methodswitch` branch to DTG's `init()`, taking it
   127 → 155. The change was correctly synced to all 4 builders per Rule 8, but only DTG
   tipped over — DTG's `init` is the only one carrying every entry-mode branch inline
   (emb/scp/dtf equivalents sit at 133–146, just under the cap).
2. *Why it went unseen.* The `/deploy` skill's Step 0.6 smoke gate runs **`npm run
   test:parser`** — `tests/unit/parser` only. A red ratchet in `tests/unit/` does not block
   a deploy. `npm test` is the thing that catches it, and nothing runs it automatically.

**Solution.** Genuinely refactored rather than allowlisted. `init()` was a 5-way entry-mode
dispatcher, not the allowlist's justified case ("one cohesive HTML template", like
`form-core.js:render` at 383). Extracted `configureOrderSummaryBand()`,
`ensureRowsAndRender()`, and one predicate per entry mode (`tryDuplicateMode`, `tryEditMode`,
`tryQuickQuotePrefill`, `tryMethodSwitchPrefill`, `restoreOrStartFresh`) — each returns true
when it owns the load. `init()` is now 18 lines and the priority chain is explicit. DTG-only:
this is `init` dispatch, not one of Rule 8's sync categories.

**Prevention.**
- **Allowlisting a ratchet entry is almost always the wrong call.** It freezes the regression
  as acceptable and releases the pressure keeping the sibling builders at 133–146.
- The entry-mode ORDER is behavioral, not cosmetic (`?duplicate=` > `?edit=` > handoffs >
  auto-restore). Verify it with both params present, not one at a time — a one-at-a-time
  pass looks identical whether or not the priority survived.
- `adapter.js`'s JSDoc had already flagged this: *"the real split lands if init is ever
  unpacked."* When a file comment names a future refactor, that's the map — follow it.

---
