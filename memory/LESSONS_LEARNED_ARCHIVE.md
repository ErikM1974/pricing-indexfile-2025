# LESSONS LEARNED — ARCHIVE

Entries retired from `LESSONS_LEARNED.md` to keep it under its 300-line cap.
No limit here. Newest-archived first; each entry keeps its original date.

---

## A CSS specificity TIE pinned the Administration menu permanently open (2026-07-28)

**Problem.** Erik reported the Administration sub-menus couldn't be closed. The section's
chevron flipped to the collapsed arrow, but all 5 sub-group rows stayed on screen. Shipped
in v2026.07.28.4.

**Root cause.** Giving the admin section more room for its sub-groups:

```css
.nav-section.collapsed .nav-section-content        { max-height: 0; }      /* (0,3,0) */
.nav-section[data-section="admin"] > .nav-section-content { max-height: 1400px; } /* (0,3,0) */
```

Both are **three class-level selectors** — an attribute selector weighs the same as a class,
which is easy to misread as "more specific because it's longer". Equal specificity → source
order decides → the later `1400px` rule won *even while `.collapsed` was applied*. The class
toggled, `aria-expanded` flipped, the chevron rotated; only the height never changed.

**Solution.** Scope the raise to the open state so it can't compete with the collapse rule:
`.nav-section[data-section="admin"]:not(.collapsed) > .nav-section-content`. `:not()` adds
specificity AND makes the rule inapplicable when collapsed — belt and braces.

**Prevention.**
- **Never let an override tie the rule it must not beat.** When adding a per-section override
  next to a state rule (`.collapsed`, `.active`, `.is-open`), either scope it with `:not(<state>)`
  or place it BEFORE the state rule. Count specificity properly: `[attr]` == `.class`.
- **A UI test that only opens things proves nothing about closing.** The harness passed the
  whole time because every assertion expanded and measured. The bug lived entirely in the
  closed state. Assert both directions — "it opens" is half a contract.
- **Symptom shape is a tell:** class/ARIA/chevron all correct but geometry wrong ⇒ the JS is
  fine, a CSS rule is winning. Enumerate matching rules with `el.matches(r.selectorText)` over
  `document.styleSheets` rather than eyeballing the file.

### Stale-cache QA: the harness verified files that no longer existed

Twice in one sitting the browser served cached copies while the fix sat on disk — an edited
module kept reporting its OLD assertion count, then a fixed stylesheet kept computing the OLD
`max-height`. **Neither a reload, `location.reload(true)`, nor a forced navigation evicts a
cached ES module or stylesheet — they're keyed by URL.** For a harness whose job is asserting
on computed CSS this manufactures confidence, which is worse than no harness.

Fix: `tests/ui/test-admin-nav-boot.js` — a shim that never changes (so caching it is harmless),
re-points every stylesheet at a timestamped URL, waits for them to apply, then imports the
harness with the same stamp. The HTML document can still 304 with a stale `<script src>`;
load it as `?bust=<anything>` when the assertion count looks wrong. **Always confirm what the
SERVER returns (`curl`) before concluding a fix didn't work.**

---

---

## RBAC: an unlisted page defaults to OPEN, so half the Administration menu was public to staff (2026-07-28)

**Problem.** The staff dashboard's Administration menu held 18 links shown to every logged-in
staffer. Ten had a hard route gate (`requireCrmRole(['admin'])` / `requireCrmEmail`), but
eight did not — Blog Editor, SEO Strategy, API Usage, SanMar Payables, Commission Structure,
Bandit Integration, Policy Migration, Universal Records Admin. Any staffer could open them.
Two APIs were worse than the pages: `/api/crm-proxy/blog-posts*` (publishes to the PUBLIC
website) and the `/api/staff/sanmar-invoices/*` + `/api/staff/shopworks-payables` feeds were
only `requireStaff`.

**Root cause.** `gateStaffPage` resolves a page with no `Staff_Page_Access` row to *"any
logged-in staff"* (`if (!rule) return true`). That's the correct default for the ~100 ordinary
staff pages, and it's why the table-driven design is pleasant to use — but it means security
depends on someone **remembering** to add a Caspio row. Nothing in the code, the menu, or a
test said a row was missing. A forgotten row failed OPEN and looked identical to a deliberate
decision. The client had no role signal at all, so the menu rendered all 18 links for everyone.

**Solution.**
- Extracted the decision to `lib/page-access.js` (the `lib/cors-allowlist.js` precedent) and
  added `ADMIN_DEFAULT_PAGES` — the 18 Administration pages. For that set only, no row now
  means **admin-only** instead of any-staff. The Caspio table still wins, so widening is still
  a no-deploy edit in Access Admin.
- `gateStaffPage`'s error path used to fail open for everything; admin pages now fail closed.
- Gave the exposed APIs the same page/API-twin gate payroll already used:
  `requirePageAccess('blog-editor.html')` and `requirePageAccess('sanmar-payables.html')` —
  one Caspio row governs a page and its data, so they can't drift.
- Sidebar: `data-requires-role="admin"` + `hidden`, resolved by `nav-access-controller.js`.

**Prevention.**
- `tests/unit/admin-page-access.test.js` has a **drift lock**: it parses the Administration
  menu out of `staff-dashboard-v3/index.html` and fails if the menu and `ADMIN_DEFAULT_PAGES`
  disagree in *either* direction. A new admin page cannot land in the sidebar without an
  access rule behind it, and a retired one can't rot in the list.
- Rule of thumb: **gating a page is only half the job — gate the API that feeds it too.**
  A page gate stops the UI; only the API gate stops a direct request.

### Gotchas found while fixing this

- **`[hidden]` does not hide `.nav-section`.** `base.css` sets `.nav-section { display: flex }`,
  which outranks the UA `[hidden]` rule — the block stayed visible. Needs an explicit
  `[data-requires-role][hidden] { display: none !important; }`.
- **Hide is not enough — remove.** `command-palette-controller.js` harvests its Ctrl+K registry
  from the live DOM on every open. A merely-hidden admin link is still searchable by name.
- **Sidebar `aria-expanded` was decorative.** The markup shipped `aria-expanded="false"` and
  `toggleSection` never updated it, so screen readers were told every section was collapsed
  while open — and the `[aria-expanded="true"]` rule in `dashboard-v3-theme.css` never fired.
  Now synced in `sidebar-controller.js`.
- **New `.nav-section` headers render as a solid green square** unless they get a
  `data-section`-specific `mask-image` — `.nav-section-title > span[aria-hidden]:first-child`
  masks the emoji slot. Sub-group headers dodge this by having no leading icon span.
- **A backgrounded tab throttles CSS transitions.** With `document.visibilityState === 'hidden'`
  a `max-height` transition never advances, so a timing-based UI assertion reads the START
  value forever and "fails" a perfectly correct stylesheet. Disable transitions in UI harnesses
  (`.qa-no-motion`) and force a reflow instead of sleeping.
- **A `max-height` collapse still reports a non-zero bounding box** for clipped children
  (`overflow: hidden`). Counting "visible" rows by height over-counts; walk up to the nearest
  collapsible ancestor and check its computed `max-height`.

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
---

## An audit measured our own broken meter and declared us on budget (2026-07-28)

**Problem.** An external code audit of Caspio call volume opened with "the cross-dyno rollup
shows 16,055 calls on 7/27 vs the 16,129/day budget — the July fixes already took you from
~22k to ~16k." Every savings estimate in it was then sized against that denominator. Caspio
billed **23,959** that day. We were at ~132% of pace, not at it.

**Root cause.** 16,055 was our own meter's known-low reading — the exact figure recorded one
entry below as the *under-count*. The audit read the number from `/api/admin/usage`, saw the
field labelled `mode: "rollup"`, and treated it as cross-dyno truth. It was one row from one
web dyno. The label was accurate about the code path and silent about the coverage.

**Solution.** Re-anchored on Caspio's own billing page and re-derived every estimate from it.
Then closed the biggest remaining hole: `sync-manageorders`, `check-zero-billing` and
`sync-commissions` build their own Caspio URLs with raw axios and never load `api-tracker`.
The global interceptor installs as a side effect of **loading** that module, so it attaches
**per-process** — the docs claiming it catches "any process that talks to Caspio" were wrong;
it catches any process that *loads the tracker*. ~950 calls/day were invisible.

**Prevention.**
- **A meter may not grade its own coverage.** Reconcile against the party that bills you,
  every time, before quoting a number to anyone — including to a tool you asked for advice.
- **A label describes a code path, not a guarantee.** `mode: "rollup"` was true and useless.
  When a field asserts scope, make it carry the evidence: row count, dyno list, first/last
  write. A scope claim nothing can falsify will eventually be believed while wrong.
- **Give an outside auditor your known-wrong numbers up front.** This audit was competent —
  it independently found the metering hole — but nobody told it the baseline was suspect, so
  it anchored on it and mis-ranked everything downstream. The brief is part of the tool.
- Sixth appearance this week of the same shape: **the error always points DOWN, and
  under-reporting reads as "we're fine."**

### The same audit's fixes had to be adversarially checked before shipping

Three of six proposed fixes would have introduced a silent wrong answer, each in the
"looks healthy, isn't" family — worth internalizing as a pattern, not three anecdotes:
- **`Promise.allSettled` status is not a completeness test.** `fetchAllCaspioPages` *resolves*
  with PARTIAL results when pagination fails mid-way, so `status === 'fulfilled'` is true for
  a truncated read. Test the DATA (`length > 0`, expected keys present), never promise state.
- **A cache TTL borrowed from a neighbour imports its freshness assumptions.** Reusing the
  1-hour `STATIC_TABLE_TTL_MS` for `Pricing_Tiers`/`DTG_Costs` would have quadrupled staleness
  on the tables Erik actually edits, and desynced DTG from `/api/pricing-bundle`, which reads
  the same two tables at 15 min. Match the TTL to the sibling that shares the table.
- **Failing only when EVERYTHING fails is failing open.** `/api/dtg/quote-pricing` 502'd only
  when every bundle was missing. A partial set still answered 200 — `priceLines()` drops the
  failing line but keeps its quantity in `combinedQty`, and the cart engine index-aligns items
  to a now-shorter array. Under-stated subtotal *and* mis-attributed line items. The
  any/all distinction in an error guard is a pricing decision.

## Our "day" was 7 hours off the vendor's, and the offset looked like thousands of missing API calls (2026-07-28)

**Problem.** Reconciling our Caspio call meter against Caspio's own usage chart showed a
persistent 30-40% shortfall — 23,959 billed vs 16,055 measured on 27 Jul. A full day went
into hunting the "missing" caller: audited Python Inksoft, the main app's runtime, every
`fetch`/raw-HTTP path in the proxy, and the Caspio account's API profiles. All clean.

**Root cause.** Two independent under-counts, and neither was an unknown integration.
(a) Heroku Scheduler runs every `npm run sync-*` job as a **one-off dyno** that lives for
seconds and exits via `process.exit(0)`. The rollup flushed on a 60-minute `setInterval`, so
it never fired there and SIGTERM never arrived — the table held `web.1` rows and nothing
else, hiding ~30% of traffic. (b) **Caspio buckets usage on the ACCOUNT timezone** — its
Integrations log header reads literally `Log date (UTC-07:00)` — while we keyed days on UTC.
Our "28 Jul" began at 5 PM Pacific on the 27th, so the two windows were never comparable.

**Solution.** Flush on a **call-count threshold** (250) instead of a timer, so a trigger
fires regardless of process lifetime; writes became **append-only deltas** (no read, no
read-modify-write race between concurrent dynos); auto-start metering from `api-tracker` so
any process talking to Caspio records, not just the one that loads `server.js`. And a single
`utils/account-time.js` now owns "what day is it" (DST-aware `America/Los_Angeles`), used by
the tracker, the rollup and the period window — they must agree, because the rollup looks
days up by the tracker's own key.

**Prevention.** **Before reconciling your number against a vendor's, match their clock —
check the timezone on their own log/report headers first.** A whole-day offset is
indistinguishable from missing data and will send you hunting a phantom. And **a time-based
flush cannot work in a short-lived process**: if a metric must survive processes you don't
control the lifetime of, trigger on *work done*, not on elapsed time. Both bugs shared the
signature that has now appeared five times this week — the error only ever pointed one way,
DOWN, and under-reporting always reads as "we're fine".

---

---

## RBAC: an unlisted page defaults to OPEN, so half the Administration menu was public to staff (2026-07-28)

Full entry archived to `LESSONS_LEARNED_ARCHIVE.md`. The durable parts now live in CLAUDE.md's
Security Checklist: **an unlisted page defaults to any-logged-in-staff, so a new restricted page
needs a `Staff_Page_Access` row (or a spot in `ADMIN_DEFAULT_PAGES`)** — and **gating a page is
half the job; gate the routes that feed it with `requirePageAccess` too.**

---

## A ratchet test sat red for 9 days because /deploy only runs test:parser (2026-07-28)

Full entry archived to `LESSONS_LEARNED_ARCHIVE.md`. The durable part: **`/deploy`'s smoke
gate runs `npm run test:parser` only, so a red ratchet anywhere else in `tests/unit/` does
not block a release** — run `npm test` yourself before shipping. And allowlisting a ratchet
entry is almost always wrong; it freezes the regression as acceptable.

---

## A CSS specificity TIE pinned the Administration menu permanently open (2026-07-28)

Full entry archived to `LESSONS_LEARNED_ARCHIVE.md`. Durable part: **two rules with EQUAL
specificity are resolved by source order, so a later `max-height: none` silently beat the
collapse** — when a CSS edit appears to do nothing, count specificity AND check what comes
after it. See also the `@layer`-vs-unlayered entry above.
