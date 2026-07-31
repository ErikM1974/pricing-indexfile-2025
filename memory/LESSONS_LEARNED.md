# LESSONS LEARNED

Bug → root cause → fix → prevention. Newest first. **Hard limit 300 lines** — archive the
oldest resolved entry to `LESSONS_LEARNED_ARCHIVE.md` once this passes 250.

---

## A 200 with empty arrays is not success — the quote builder priced off seed values (2026-07-30)

**Problem.** `/api/pricing-bundle` answers **HTTP 200 with `{tiersR:[], allEmbroideryCostsR:[]}`**
when Caspio rate-limits, rather than erroring the way its sibling `/api/pricing-tiers` does.
`embroidery-quote-pricing.js` pre-seeds a full tier ladder in the constructor and only replaces it
`if (data.tiersR.length > 0)` — but set `initialized = true` regardless. So an empty 200 priced an
entire quote from hardcoded numbers frozen at the last edit of the file, with no banner and no toast.

**Root cause.** The guard tested the *shape* of the response (`if (data)`) instead of whether the
data needed to price actually arrived. `response.ok` was true, so the catch never ran.

**Why it hid.** The seed values happened to equal live Caspio, so the loss was $0 and nothing looked
wrong. It would have broken silently the first time anyone changed a price in Caspio — i.e. exactly
when the source-of-truth design matters.

**Solution.** Throw when either array is empty/missing, which routes into the existing catch
(apiError + critical banner + `disableQuoteCreation()`), plus a second check before
`initialized = true`. Seed ladder kept but commented **never-authoritative** so nobody "helpfully"
syncs it to Caspio and restores the bug. `tests/unit/emb-empty-bundle-guard.test.js`.

**Prevention.** 🔑 **A fallback that happens to be correct is still a silent-wrong-price bug** —
judge the mechanism, not today's output. And when a fixture pins a value production never sends
(`RoundingMethod: 'HalfDollarUp'` vs the live `HalfDollarCeil_Final`), the tests exercise a branch
that does not exist in prod: **fixtures must carry live values.**

---

## Realization figures are meaningless until webstore orders are separated out (2026-07-30)

**Problem.** "Cap 8-23 is the worst cell in the book at 80% realization" sent a whole investigation
at a cell that was fine. Quoted cap 8-23 actually realizes **88.9%**, and the real gap is
**~$1,500/yr**, not the implied five figures.

**Root cause.** Webstore/company-store orders carry their own program pricing (Hops n Drops hats at
$11, company stores with a dozen assorted items at flat price points) and realize **76.5%**. Averaged
in with quoted work at **97.9%**, they drag any tier-level figure down — hardest on small tiers,
where they are the biggest share.

**Two more confounds in the same measurement.** Some orders bill decoration on its **own line**
(`id_ProductClass` 9/10, e.g. `DECG`), so the garment line's price legitimately excludes decoration
and reads as a deep discount. And at least one order (141715) billed 20 caps at exactly blank cost
with **no decoration line at all** — a missing charge, not a discount.

**Solution / prevention.** 🔑 **Split by `Orders.ExtSource` before computing realization** — blank =
quoted, populated = webstore. 🔑 **Check for class-9/10 lines on the order** before treating a low
garment price as a discount. Both are cheap; neither is optional. The three-way split
(webstore / separate-decoration / quoted) is what turned an alarming number into a real one.

⚠️ Verified by reading the raw LinesOE rows for the outlier orders. **The line-level look is what
found it** — every aggregate up to that point agreed with the wrong answer.

---
## Two renderings of the same timestamp never compared equal, so a sync re-wrote 456 orders a day forever (2026-07-29)

**Problem.** `sync-manageorders` spent **2,901 billed Caspio calls in 22 minutes** — ~18% of the
whole 16,129/day budget. It looked like legitimate churn in a 60-day window.

**Root cause.** The ManageOrders API returns `"2026-07-27T00:00:00.000Z"`; Caspio hands the same
value back as `"2026-07-27T00:00:00"` — no milliseconds, no zone. `normalize()` was
`String(val).trim()`, so the two renderings of one instant were **never equal**. Every order
carrying `date_Shipped`, `date_Invoiced` or `date_Produced` was detected as "changed" on **every
run, forever**, re-PUT and had its entire line-item set deleted and re-posted. Measured: 457 of
611 orders flagged — 403 / 43 / 10 on those three date fields, and exactly **one** real change (a
`CustomerName` edit). Confirmed structurally: 402 of the newest 611 archived orders carry a
`date_Shipped`; 403 were flagged on it.

**Solution.** Canonicalise ISO datetimes to `YYYY-MM-DDTHH:MM:SS` before comparing — format noise
only; a different date *or time-of-day* still registers. Same dry run afterwards: **457 → 1**.
Second layer: compare line-item CONTENT before rewriting, so even a real order change (a payment
posting) does not delete-and-repost identical rows. 29 of 29 sampled changed-orders had
byte-identical line items.

**Prevention.**
- **A round-trip through a datastore is a format conversion.** Never compare a value you just sent
  against the value it hands back without canonicalising first — especially dates, which every
  system renders differently. Print both raw representations side by side before trusting `!==`.
- **A change-detector that always fires is indistinguishable from a busy business.** If "changed"
  counts sit near 100% of the window every run, suspect the comparator, not the data. Break the
  count down BY TRIGGER FIELD — 403/43/10 on three date fields and 1 on everything else named the
  bug instantly, where the total never would have.
- **Prefer comparing content over guessing which upstream field implies a change.** The tempting
  heuristic here — "only re-sync line items when `TotalProductQuantity` moves" — silently misses a
  colour or description edit that leaves totals untouched, and that stale `PartColor` feeds
  `check-zero-billing`'s match.
- **Measure the fix against live data before shipping.** A read-only dry run using the real
  exported helpers gave 457 → 1 and 29/29 identical, which is what turned an estimate into a number.

### Found in passing, both worse than the cost bug

- **`syncLineItems` was DELETE-then-fetch.** A rate-limited ManageOrders read (`fetchWithRetry`
  throws after 3 attempts — I tripped exactly this with 11 consecutive 429s while sampling) left
  the archive rows destroyed with nothing to put back. **Fetch first; remove nothing until the
  replacement is in hand.**
- **`caspioReadAll` paged without `q.orderBy`.** Caspio's paged reads are not stably ordered, so
  rows silently drop and duplicate. Load-bearing now that "absent from the read" means "not
  archived" — a dropped row would read as a deletion.

---

## A shared modal's CSS lived in ONE page's stylesheet — the other host printed the whole dashboard (2026-07-29)

**Problem.** `sanmar-inbound-today.js` is loaded by BOTH `quote-management.html` and
`ae-mission-control.html`, but every `.sit-*` rule lived in `quote-management.css`, which only
the first page loads. From AE Mission Control the modal opened `position: static` at
**y = 3862px** — ~3.8 screens below the fold, so the Inbound button looked dead — with no
scroll container, and **without `body.sit-printing > *:not(#sit-print-sheet){display:none}`**,
so printing a report or a box label would have printed the entire dashboard.

**Root cause.** A page-named stylesheet became a silent dependency of a *shared* component.
Nothing links the two: the JS loads fine, the modal builds fine, and the failure only shows on
the page nobody tests. It also leaned on that file's generic `.modal` / `.modal-content` /
`.btn-cancel` **and** its global `* { box-sizing: border-box }` — no stylesheet on the AE page
declares one, which by itself moved the panel 960px → 945px.

**Fix** (`d78e1391`). `dashboards/css/sanmar-inbound.css`, loaded by every host page. Block moved
**verbatim** (byte-identical, diffed), plus a scoped border-box reset and restatements of
`.modal`/`.modal-content`/`.btn-cancel` at `.modal.sit-modal` specificity (0,2,0) so they win
regardless of load order — self-contained, no dependency on any other sheet.

**Prevention.**
- **A shared JS component owns a stylesheet of the same name, loaded by every page that loads
  the JS.** Styles for `foo.js` never live in `some-page.css`. Grep for other offenders.
- **Verify a CSS refactor by computed-style diff, not by eye.** Snapshotting 519 elements × 41
  properties across three configurations (pre-split re-injected inline, and each new host page)
  proved 0 differences on quote-management.html — and caught a `font-family` I had "helpfully"
  pinned, which would have silently restyled the whole modal.
- **What a modal inherits is part of its contract**: `box-sizing`, `color`, `font-family` all
  came from the host page. List them explicitly before moving a component between hosts.

---

## A security fix landed on ONE route; six identical siblings sat open for 5 days (2026-07-29)

**Problem.** Six proxy AI routes — `contract-embroidery-ai`, `contract-dtg-ai`, `contract-emblem-ai`,
`contract-webstore-ai`, `dtg-quote-ai`, `emb-quote-ai` — each declare a `lookup_customer` tool
returning company, contact, email, phone, address, sales rep, payment terms and last-ordered date,
five matches for any 2-char query. All six were mounted with only a per-IP rate limiter. The
customer list was readable with curl. Each request also spends Anthropic tokens, so it was an open
tab on the bill as well.

**Root cause.** The identical hole was found and fixed on `contract-sticker-ai` on 2026-07-24. The
fix was applied to that one mount and stopped there. Nothing swept the siblings, and the file's own
comment had been advertising the gap the whole time: *"These are unauthenticated … (Coarse guard;
true protection is auth — TODO.)"* A TODO is not a ticket.

**How it surfaced.** Only because a *removal* task made me diff the sticker route against its
family. Nobody was looking for it.

**Fix.** The sticker pattern, applied to all six: a session-gated forwarder per route in the app
(`requireStaff` + `CRM_API_SECRET`, one loop, app path mirrors proxy path), each browser caller
repointed to same-origin, then `requireCrmApiSecret` added to all six proxy mounts. App shipped
first (v2026.07.29.4) then proxy (v2026.07.29.6) — reversed, every chat 401s until the app catches up.

**Prevention.**
- **A security fix on one member of a family is not done until you have swept the family.** Grep for
  the shape (`app.use('/api/…-ai'`), not the instance. Sibling routes that "mirror" each other in a
  header comment mirror each other's holes too.
- **Probe, don't read.** An anonymous POST with an empty body told the whole story in one line: 401
  on the gated route, `400 "messages array is required"` on the open ones — they answered strangers.
  Status codes beat reading mount lines, and they cost nothing.
- Don't demonstrate a PII hole by extracting PII. The mount line plus the 400-vs-401 split is proof.

---

## An audit said "zero coverage loss"; the only HTTP test of a live endpoint was in that file (2026-07-29)

**Problem.** Removing `contract-sticker-ai` meant removing `sticker-quote-single-path.test.js`,
which `require`s the route's `__testables`. Three independent audit passes all certified the deletion
as "zero"/"nil" coverage loss, because `sticker-pricing.test.js` covers the same pricing rules.

**Root cause.** It covers the same *engine*, by calling `loadGrid`/`quoteStickerFromGrid` directly.
It never builds a req/res, so it cannot see the **route envelope** — and the envelope renames things:
engine `kind` → wire `reason`; engine `bad_input` → wire `400 {error:'bad_request'}`; plus
`pricePerSticker`, a wire-only money field matched by exactly one line in the whole test tree. That
deleted file was the only test driving the real Express handler for `GET /api/sticker-pricing/quote`
— live, customer-facing, behind the public `/custom-stickers` page.

**Fix.** `git mv` to `sticker-quote-route-surface.test.js`: drop the AI-parity half (vacuous once
there is one implementation), keep and sharpen the HTTP half. 16 tests, still green.

**Prevention.**
- **"Another test covers it" is a claim about a LAYER, not a file.** Before deleting a test, ask
  which layer it drives — pure function, route handler, or wire. `rg -l "router.stack|req, res"` over
  the test tree finds the handful that touch HTTP; they are rarely redundant.
- **Have a skeptic try to REFUTE the audit, not confirm it.** Three passes agreed and were wrong in
  the direction that ships risk; one adversarial pass instructed to default-to-refuted found it in
  minutes. Agreement between agents that share a framing is not corroboration.

---

## Deleting a `requireStaff` route can UNGATE the file, not remove it (2026-07-29)

**Problem.** Retiring `/calculators/sticker-manual-pricing.html` meant deleting its
`app.get([...], requireStaff, …)` route. That route was the *only* thing gating a page whose AI
drawer could return customer email, phone, address, sales rep and payment terms.

**Root cause.** `app.use('/calculators', express.static(...))` is mounted a few lines below it.
The gated route existed *because* it sits earlier in the stack and wins. Remove it and the request
falls through to the static mount, which cheerfully serves the same file **to anyone** — so the
"removal" would have silently converted a staff-only page into a public one. The file was staying
on disk (flag-don't-delete policy), which is exactly what makes this reachable.

**Fix.** An explicit tombstone route at the old paths returning **410** with a signpost to the
replacements. Verified by status code, not by reading the diff: `410`, not `200`.

**Prevention.** **Before deleting any route, check whether a `static` mount covers its path.** If
one does, the route is load-bearing access control and deleting it is a privilege escalation, not
a cleanup — replace it with a tombstone or delete the file too. Same trap as the 2026-07-29
`express.static('.')` repo-root exposure, one layer down: *static mounts serve whatever the router
didn't claim.* Grep `app.use\(.*express.static` and compare against the path you're removing.

---

## A closed `<details>` still reports its old size — `checkVisibility()`, not `getBoundingClientRect()` (2026-07-29)

**Problem.** A layout test asserted that collapsing the Pride Wall hid its photo track:
`pw.open = false; track.getBoundingClientRect().height === 0`. It failed at **every** viewport
width — the track kept reporting 164.6px while the parent `<details>` correctly shrank 191px → 19px.
The widget was working; the assertion could never pass.

**Root cause.** A closed `<details>` hides its content with **`content-visibility: hidden`**, not
`display: none`. The subtree is skipped for rendering but **retains its last laid-out geometry**, so
`getBoundingClientRect()` returns the size it had when it was last open. `getComputedStyle(el).display`
is likewise still `grid`. Nothing about the element's own boxes says "I am hidden".

**Fix.** `!el.checkVisibility()` — it accounts for content-visibility, `visibility`, and opacity, and
correctly returns `false` inside a closed `<details>`. Alternatively assert on the *parent*
`<details>` height, which does collapse.

**Prevention.** Never probe visibility through the geometry of a descendant — measure the collapsing
container, or use `checkVisibility()`. This bites anything wrapped in `content-visibility`
(`<details>`, `content-visibility: auto` virtualization), and it fails *silently in the passing
direction* too: a "the panel is hidden" assertion written this way would pass while the panel is open.

---

## Three stylesheets declared the same grid; two had never applied (2026-07-29)

**Problem.** `.quick-access-grid` column tracks were declared in components.css (with `@container`
breakpoints), again in dashboard-v3-theme.css, and a third time in dashboard-v3-patch-2.css with
`!important`. Editing the first two did nothing, and it was not obvious why.

**Root cause.** components.css is inside `@layer components`; the theme and patch files are
**unlayered**. Unlayered styles beat *any* layered style regardless of specificity or source order,
so the container queries in components.css had never once matched — they looked live and were dead.

**Fix.** patch-2 §7 is now the single owner of the tracks; components.css keeps a 1fr base and the
theme keeps only the gap, each with a comment naming the owner.

**Prevention.** In this codebase `@layer` = "loses to everything in the theme/patch files". Before
editing a dashboard rule, check whether an unlayered file also declares it — and when a CSS edit
appears to do nothing, suspect layering before specificity.

---

## An audit measured our own broken meter, and our "day" was 7h off the vendor's (2026-07-28)

Both archived to `LESSONS_LEARNED_ARCHIVE.md`. The durable pair: **before reconciling your number
against a vendor's, match their clock** — check the timezone on their own report header first; a
whole-day offset is indistinguishable from missing data. And **never treat your own meter as ground
truth when auditing that meter** — under-reporting always reads as "we're fine".
