# LESSONS LEARNED â€” ARCHIVE

Resolved entries aged out of `LESSONS_LEARNED.md` (300-line cap). Newest first. No limit here.

---

on all five: CT104670 called a "Duck Jacketâ€¦ rugged duck canvas" (it is the **Storm Defender
Shoreline Jacket**, a rain shell), CTK121 called a "**Crewneck**â€¦ no-hood option" (it is the
**Midweight Hooded** Sweatshirt), CT102208 called the "Gilliam **Vest**â€¦ without the sleeves"
(it is the Gilliam **Jacket**), CT100617 given CTK121's name, CT100615 left unnamed filler.
A reader clicking any link lands on a product that contradicts the sentence that sold it.

**Root cause.** The 2026-07-13 seeding batch generated prose *around* style numbers instead of
*from* the catalog â€” the numbers are real and active, so every existence check is satisfied while
the identity behind each number is invented. An audit across all 23 drafts found the defect is
systemic: **only 3 drafts are clean**; 2 recommend styles that are now **Discontinued**
(NE1000 in 6 drafts, CS413), and CornerStone `CS410`/`CS413` are sold as "tee" and "pocket tee"
when both are **polos**.

**Fix.** Published the oldest genuinely-clean draft instead (`custom-ogio-bags-polos-corporate-gifts`
â€” all 5 styles Active, every prose claim corroborated by the catalog, `COMPANION_STYLES` confirming
its one relational claim). The other 20 drafts stay Draft pending rewrite; nothing was edited.

**Prevention.**
- **`PRODUCT_STATUS: "Active"` proves a style exists, not that the sentence about it is true.**
  Diff the prose against `PRODUCT_TITLE` for every recommended style before publishing.
- **Check prose, not just anchor text.** An anchor-text-only audit scored the Carhartt draft
  1 mismatch; reading the body found 5. The regex could not see errors in the description
  sentences, which is exactly where a generated draft puts them.
- **A bare style number as anchor text (`[PC54](â€¦)`) is fine and reads as a false positive** â€”
  rank findings by whether the anchor *asserts a wrong identity*, not by string mismatch.
- **Content written ahead of publication decays two ways**: the catalog moves under it (the
  documented risk) *and* it may never have been right (the undocumented one). Verify both.

---

---

## A stand-in fallback address is a silent-failure bug (2026-08-01)

**Problem.** 14 art requests saved with `User_Email: ae@nwcustomapparel.com` and
`Sales_Rep: Taneisha Clark`. Nobody owns that inbox, so those AEs' confirmation emails went
nowhere and the records carried a bogus submitter.

**Root cause.** `getSubmitterEmail()` in all four AE submit forms ended
`return localStorage.getItem('userEmail') || 'ae@nwcustomapparel.com';` â€” inventing an identity
when the staff session was missing instead of refusing.

**Why it hid for months.** Steve's notification still arrived, because **his** address is
hardcoded in `sendNotificationEmails` rather than derived. Only the AE's own copy vanished, and
nobody misses an email they never expected. Found while investigating an unrelated report.

**Solution.** Return `''` when unidentified; `handleSubmit()` blocks with a visible toast before
any upload or POST. Applied to all four forms (Rule 8). `tests/unit/art-submit-identity.test.js`
â€” two of its six cases grep all four files so no form can quietly reintroduce it.

**Prevention.** ðŸ”‘ **A fallback identity is the same class of bug as a fallback price** â€” it
manufactures plausible-looking data instead of failing. If the answer is "we don't know who this
is", the only safe output is an error. ðŸ”‘ When one recipient of a fan-out is hardcoded and the
rest are derived, the hardcoded one **masks** breakage in the derived ones â€” an alert that always
fires proves nothing about its siblings.

## Two renderings of the same timestamp never compared equal, so a sync re-wrote 456 orders a day forever (2026-07-29)

**Problem.** `sync-manageorders` spent **2,901 billed Caspio calls in 22 minutes** â€” ~18% of the
whole 16,129/day budget. It looked like legitimate churn in a 60-day window.

**Root cause.** The ManageOrders API returns `"2026-07-27T00:00:00.000Z"`; Caspio hands the same
value back as `"2026-07-27T00:00:00"` â€” no milliseconds, no zone. `normalize()` was
`String(val).trim()`, so the two renderings of one instant were **never equal**. Every order
carrying `date_Shipped`, `date_Invoiced` or `date_Produced` was detected as "changed" on **every
run, forever**, re-PUT and had its entire line-item set deleted and re-posted. Measured: 457 of
611 orders flagged â€” 403 / 43 / 10 on those three date fields, and exactly **one** real change (a
`CustomerName` edit). Confirmed structurally: 402 of the newest 611 archived orders carry a
`date_Shipped`; 403 were flagged on it.

**Solution.** Canonicalise ISO datetimes to `YYYY-MM-DDTHH:MM:SS` before comparing â€” format noise
only; a different date *or time-of-day* still registers. Same dry run afterwards: **457 â†’ 1**.
Second layer: compare line-item CONTENT before rewriting, so even a real order change (a payment
posting) does not delete-and-repost identical rows. 29 of 29 sampled changed-orders had
byte-identical line items.

**Prevention.**
- **A round-trip through a datastore is a format conversion.** Never compare a value you just sent
  against the value it hands back without canonicalising first â€” especially dates, which every
  system renders differently. Print both raw representations side by side before trusting `!==`.
- **A change-detector that always fires is indistinguishable from a busy business.** If "changed"
  counts sit near 100% of the window every run, suspect the comparator, not the data. Break the
  count down BY TRIGGER FIELD â€” 403/43/10 on three date fields and 1 on everything else named the
  bug instantly, where the total never would have.
- **Prefer comparing content over guessing which upstream field implies a change.** The tempting
  heuristic here â€” "only re-sync line items when `TotalProductQuantity` moves" â€” silently misses a
  colour or description edit that leaves totals untouched, and that stale `PartColor` feeds
  `check-zero-billing`'s match.
- **Measure the fix against live data before shipping.** A read-only dry run using the real
  exported helpers gave 457 â†’ 1 and 29/29 identical, which is what turned an estimate into a number.

### Found in passing, both worse than the cost bug

- **`syncLineItems` was DELETE-then-fetch.** A rate-limited ManageOrders read (`fetchWithRetry`
  throws after 3 attempts â€” I tripped exactly this with 11 consecutive 429s while sampling) left
  the archive rows destroyed with nothing to put back. **Fetch first; remove nothing until the
  replacement is in hand.**
- **`caspioReadAll` paged without `q.orderBy`.** Caspio's paged reads are not stably ordered, so
  rows silently drop and duplicate. Load-bearing now that "absent from the read" means "not
  archived" â€” a dropped row would read as a deletion.

ESSONS LEARNED â€” ARCHIVE

Entries retired from `LESSONS_LEARNED.md` to keep it under its 300-line cap.
No limit here. Newest-archived first; each entry keeps its original date.

---

## The pacing alert's first real firing was a false alarm off its own repaired meter (2026-08-03)

**Problem.** At 4 AM on 1 Aug the Caspio pacing alert DMed Erik: *projected 493,729 / 500,000 â€”
99% of cap*. The true projection was **~341,000 (68%)**. The alert had worked end to end â€”
computed, deduped, reached Slack â€” on its first real firing, and was wrong.

**Root cause.** It projects `spent + (mean of the last 3 complete days Ã— days remaining)`, read
from our own `API_Usage_Daily` rollup. Two of those three days were written **before the meter
was repaired**, and pre-repair rows disagree with Caspio's billing by amounts that change daily
*and flip sign*: 27 Jul âˆ’33%, 30 Jul **+18%**. The window `{29,30,31 Jul}` averaged 16,415/day
against a real ~10,600. A rate gets multiplied by every remaining day, so a 55% rate error
became a 45% projection error.

**Second, independent bias found while fixing it.** A 3-day window on a **Monday** reads
{Fri, Sat, Sun} and on a **Friday** reads three weekdays. Weekends run about half a weekday here
(Sat 6,657 / Sun 4,531 vs Fri 10,626), so the same data projected ~50,000 calls apart â€” a tenth
of the cap â€” purely by which day you looked.

**Solution.** `ROLLUP_TRUSTED_FROM = '2026-07-31'` (first day the repaired meter came in at
+2.2% vs Caspio) bars older rows from setting a **rate**, and `TREND_DAYS` 3 â†’ **7** so the
window always spans exactly two weekend days. The rows stay in the table and on the chart,
hatched, because they are the evidence of what the overage cost. `computePacing` now returns
`trend: {daysUsed, windowDays, trustedFrom, excludedDays}` and the Slack body states its basis.

**Prevention.**
- ðŸ”‘ **Exclude bad history from the RATE, never from the LEVEL.** Dropping those days from
  `periodToDate` would have understated spend â€” the more dangerous direction. A number that is
  multiplied by 25 needs different care from one that is merely displayed.
- ðŸ”‘ **After repairing an instrument, mark the boundary in code.** "We fixed it on the 31st" in
  someone's head is not a guard; the next consumer of that table silently averages across the
  repair. The constant carries the measured per-day error table as its comment so the WHY
  survives.
- ðŸ”‘ **A trailing window inherits every seasonality shorter than itself.** For anything with a
  weekly rhythm, 7 days is the smallest window that cannot be biased by the day you sample.
- **Validate a monitor's first firing against the source of truth before trusting it.** The
  plumbing being correct is not the same as the answer being right â€” and an alarm that cries
  wolf on day 6 is one you have learned to ignore by day 30, which is the exact failure the
  alert exists to prevent.

**Found in passing.** The trend filter compared rollup keys (Pacific account days) against
`ymd(now)` (**UTC**), so between 5 PM Pacific and midnight UTC the still-running day sorted as
complete and its partial count dragged the rate down. Hidden because the scheduled run is 4 AM
Pacific, outside that seven-hour window. Now uses `accountDay(now)` â€” the same
UTC-vs-account-clock trap as [[caspio-account-clock]], third time in this subsystem.

---

---
## Realization figures are meaningless until webstore orders are separated out (2026-07-30)

**Problem.** "Cap 8-23 is the worst cell in the book at 80% realization" sent a whole investigation
at a cell that was fine. Quoted cap 8-23 actually realizes **88.9%**, and the real gap is
**~$1,500/yr**, not the implied five figures.

**Root cause.** Webstore/company-store orders carry their own program pricing (Hops n Drops hats at
$11, company stores with a dozen assorted items at flat price points) and realize **76.5%**. Averaged
in with quoted work at **97.9%**, they drag any tier-level figure down â€” hardest on small tiers,
where they are the biggest share.

**Two more confounds in the same measurement.** Some orders bill decoration on its **own line**
(`id_ProductClass` 9/10, e.g. `DECG`), so the garment line's price legitimately excludes decoration
and reads as a deep discount. And at least one order (141715) billed 20 caps at exactly blank cost
with **no decoration line at all** â€” a missing charge, not a discount.

**Solution / prevention.** ðŸ”‘ **Split by `Orders.ExtSource` before computing realization** â€” blank =
quoted, populated = webstore. ðŸ”‘ **Check for class-9/10 lines on the order** before treating a low
garment price as a discount. Both are cheap; neither is optional. The three-way split
(webstore / separate-decoration / quoted) is what turned an alarming number into a real one.

âš ï¸ Verified by reading the raw LinesOE rows for the outlier orders. **The line-level look is what
found it** â€” every aggregate up to that point agreed with the wrong answer.

## A 200 with empty arrays is not success â€” the quote builder priced off seed values (2026-07-30)

**Problem.** `/api/pricing-bundle` answers **HTTP 200 with `{tiersR:[], allEmbroideryCostsR:[]}`**
when Caspio rate-limits, rather than erroring the way its sibling `/api/pricing-tiers` does.
`embroidery-quote-pricing.js` pre-seeds a full tier ladder in the constructor and only replaces it
`if (data.tiersR.length > 0)` â€” but set `initialized = true` regardless. So an empty 200 priced an
entire quote from hardcoded numbers frozen at the last edit of the file, with no banner and no toast.

**Root cause.** The guard tested the *shape* of the response (`if (data)`) instead of whether the
data needed to price actually arrived. `response.ok` was true, so the catch never ran.

**Why it hid.** The seed values happened to equal live Caspio, so the loss was $0 and nothing looked
wrong. It would have broken silently the first time anyone changed a price in Caspio â€” i.e. exactly
when the source-of-truth design matters.

**Solution.** Throw when either array is empty/missing, which routes into the existing catch
(apiError + critical banner + `disableQuoteCreation()`), plus a second check before
`initialized = true`. Seed ladder kept but commented **never-authoritative** so nobody "helpfully"
syncs it to Caspio and restores the bug. `tests/unit/emb-empty-bundle-guard.test.js`.

**Prevention.** ðŸ”‘ **A fallback that happens to be correct is still a silent-wrong-price bug** â€”
judge the mechanism, not today's output. And when a fixture pins a value production never sends
(`RoundingMethod: 'HalfDollarUp'` vs the live `HalfDollarCeil_Final`), the tests exercise a branch
that does not exist in prod: **fixtures must carry live values.**

---

## A shared modal's CSS lived in ONE page's stylesheet â€” the other host printed the whole dashboard (2026-07-29)

**Problem.** `sanmar-inbound-today.js` is loaded by BOTH `quote-management.html` and
`ae-mission-control.html`, but every `.sit-*` rule lived in `quote-management.css`, which only
the first page loads. From AE Mission Control the modal opened `position: static` at
**y = 3862px** â€” ~3.8 screens below the fold, so the Inbound button looked dead â€” with no
scroll container, and **without `body.sit-printing > *:not(#sit-print-sheet){display:none}`**,
so printing a report or a box label would have printed the entire dashboard.

**Root cause.** A page-named stylesheet became a silent dependency of a *shared* component.
Nothing links the two: the JS loads fine, the modal builds fine, and the failure only shows on
the page nobody tests. It also leaned on that file's generic `.modal` / `.modal-content` /
`.btn-cancel` **and** its global `* { box-sizing: border-box }` â€” no stylesheet on the AE page
declares one, which by itself moved the panel 960px â†’ 945px.

**Fix** (`d78e1391`). `dashboards/css/sanmar-inbound.css`, loaded by every host page. Block moved
**verbatim** (byte-identical, diffed), plus a scoped border-box reset and restatements of
`.modal`/`.modal-content`/`.btn-cancel` at `.modal.sit-modal` specificity (0,2,0) so they win
regardless of load order â€” self-contained, no dependency on any other sheet.

**Prevention.**
- **A shared JS component owns a stylesheet of the same name, loaded by every page that loads
  the JS.** Styles for `foo.js` never live in `some-page.css`. Grep for other offenders.
- **Verify a CSS refactor by computed-style diff, not by eye.** Snapshotting 519 elements Ã— 41
  properties across three configurations (pre-split re-injected inline, and each new host page)
  proved 0 differences on quote-management.html â€” and caught a `font-family` I had "helpfully"
  pinned, which would have silently restyled the whole modal.
- **What a modal inherits is part of its contract**: `box-sizing`, `color`, `font-family` all
  came from the host page. List them explicitly before moving a component between hosts.

---
## A security fix landed on ONE route; six identical siblings sat open for 5 days (2026-07-29)

**Problem.** Six proxy AI routes â€” `contract-embroidery-ai`, `contract-dtg-ai`, `contract-emblem-ai`,
`contract-webstore-ai`, `dtg-quote-ai`, `emb-quote-ai` â€” each declare a `lookup_customer` tool
returning company, contact, email, phone, address, sales rep, payment terms and last-ordered date,
five matches for any 2-char query. All six were mounted with only a per-IP rate limiter. The
customer list was readable with curl. Each request also spends Anthropic tokens, so it was an open
tab on the bill as well.

**Root cause.** The identical hole was found and fixed on `contract-sticker-ai` on 2026-07-24. The
fix was applied to that one mount and stopped there. Nothing swept the siblings, and the file's own
comment had been advertising the gap the whole time: *"These are unauthenticated â€¦ (Coarse guard;
true protection is auth â€” TODO.)"* A TODO is not a ticket.

**How it surfaced.** Only because a *removal* task made me diff the sticker route against its
family. Nobody was looking for it.

**Fix.** The sticker pattern, applied to all six: a session-gated forwarder per route in the app
(`requireStaff` + `CRM_API_SECRET`, one loop, app path mirrors proxy path), each browser caller
repointed to same-origin, then `requireCrmApiSecret` added to all six proxy mounts. App shipped
first (v2026.07.29.4) then proxy (v2026.07.29.6) â€” reversed, every chat 401s until the app catches up.

**Prevention.**
- **A security fix on one member of a family is not done until you have swept the family.** Grep for
  the shape (`app.use('/api/â€¦-ai'`), not the instance. Sibling routes that "mirror" each other in a
  header comment mirror each other's holes too.
- **Probe, don't read.** An anonymous POST with an empty body told the whole story in one line: 401
  on the gated route, `400 "messages array is required"` on the open ones â€” they answered strangers.
  Status codes beat reading mount lines, and they cost nothing.
- Don't demonstrate a PII hole by extracting PII. The mount line plus the 400-vs-401 split is proof.

---
## An audit said "zero coverage loss"; the only HTTP test of a live endpoint was in that file (2026-07-29)

**Problem.** Removing `contract-sticker-ai` meant removing `sticker-quote-single-path.test.js`,
which `require`s the route's `__testables`. Three independent audit passes all certified the deletion
as "zero"/"nil" coverage loss, because `sticker-pricing.test.js` covers the same pricing rules.

**Root cause.** It covers the same *engine*, by calling `loadGrid`/`quoteStickerFromGrid` directly.
It never builds a req/res, so it cannot see the **route envelope** â€” and the envelope renames things:
engine `kind` â†’ wire `reason`; engine `bad_input` â†’ wire `400 {error:'bad_request'}`; plus
`pricePerSticker`, a wire-only money field matched by exactly one line in the whole test tree. That
deleted file was the only test driving the real Express handler for `GET /api/sticker-pricing/quote`
â€” live, customer-facing, behind the public `/custom-stickers` page.

**Fix.** `git mv` to `sticker-quote-route-surface.test.js`: drop the AI-parity half (vacuous once
there is one implementation), keep and sharpen the HTTP half. 16 tests, still green.

**Prevention.**
- **"Another test covers it" is a claim about a LAYER, not a file.** Before deleting a test, ask
  which layer it drives â€” pure function, route handler, or wire. `rg -l "router.stack|req, res"` over
  the test tree finds the handful that touch HTTP; they are rarely redundant.
- **Have a skeptic try to REFUTE the audit, not confirm it.** Three passes agreed and were wrong in
  the direction that ships risk; one adversarial pass instructed to default-to-refuted found it in
  minutes. Agreement between agents that share a framing is not corroboration.

---
## Deleting a `requireStaff` route can UNGATE the file, not remove it (2026-07-29)

**Problem.** Retiring `/calculators/sticker-manual-pricing.html` meant deleting its
`app.get([...], requireStaff, â€¦)` route. That route was the *only* thing gating a page whose AI
drawer could return customer email, phone, address, sales rep and payment terms.

**Root cause.** `app.use('/calculators', express.static(...))` is mounted a few lines below it.
The gated route existed *because* it sits earlier in the stack and wins. Remove it and the request
falls through to the static mount, which cheerfully serves the same file **to anyone** â€” so the
"removal" would have silently converted a staff-only page into a public one. The file was staying
on disk (flag-don't-delete policy), which is exactly what makes this reachable.

**Fix.** An explicit tombstone route at the old paths returning **410** with a signpost to the
replacements. Verified by status code, not by reading the diff: `410`, not `200`.

**Prevention.** **Before deleting any route, check whether a `static` mount covers its path.** If
one does, the route is load-bearing access control and deleting it is a privilege escalation, not
a cleanup â€” replace it with a tombstone or delete the file too. Same trap as the 2026-07-29
`express.static('.')` repo-root exposure, one layer down: *static mounts serve whatever the router
didn't claim.* Grep `app.use\(.*express.static` and compare against the path you're removing.

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

Both are **three class-level selectors** â€” an attribute selector weighs the same as a class,
which is easy to misread as "more specific because it's longer". Equal specificity â†’ source
order decides â†’ the later `1400px` rule won *even while `.collapsed` was applied*. The class
toggled, `aria-expanded` flipped, the chevron rotated; only the height never changed.

**Solution.** Scope the raise to the open state so it can't compete with the collapse rule:
`.nav-section[data-section="admin"]:not(.collapsed) > .nav-section-content`. `:not()` adds
specificity AND makes the rule inapplicable when collapsed â€” belt and braces.

**Prevention.**
- **Never let an override tie the rule it must not beat.** When adding a per-section override
  next to a state rule (`.collapsed`, `.active`, `.is-open`), either scope it with `:not(<state>)`
  or place it BEFORE the state rule. Count specificity properly: `[attr]` == `.class`.
- **A UI test that only opens things proves nothing about closing.** The harness passed the
  whole time because every assertion expanded and measured. The bug lived entirely in the
  closed state. Assert both directions â€” "it opens" is half a contract.
- **Symptom shape is a tell:** class/ARIA/chevron all correct but geometry wrong â‡’ the JS is
  fine, a CSS rule is winning. Enumerate matching rules with `el.matches(r.selectorText)` over
  `document.styleSheets` rather than eyeballing the file.

### Stale-cache QA: the harness verified files that no longer existed

Twice in one sitting the browser served cached copies while the fix sat on disk â€” an edited
module kept reporting its OLD assertion count, then a fixed stylesheet kept computing the OLD
`max-height`. **Neither a reload, `location.reload(true)`, nor a forced navigation evicts a
cached ES module or stylesheet â€” they're keyed by URL.** For a harness whose job is asserting
on computed CSS this manufactures confidence, which is worse than no harness.

Fix: `tests/ui/test-admin-nav-boot.js` â€” a shim that never changes (so caching it is harmless),
re-points every stylesheet at a timestamped URL, waits for them to apply, then imports the
harness with the same stamp. The HTML document can still 304 with a stale `<script src>`;
load it as `?bust=<anything>` when the assertion count looks wrong. **Always confirm what the
SERVER returns (`curl`) before concluding a fix didn't work.**

---

---

## RBAC: an unlisted page defaults to OPEN, so half the Administration menu was public to staff (2026-07-28)

**Problem.** The staff dashboard's Administration menu held 18 links shown to every logged-in
staffer. Ten had a hard route gate (`requireCrmRole(['admin'])` / `requireCrmEmail`), but
eight did not â€” Blog Editor, SEO Strategy, API Usage, SanMar Payables, Commission Structure,
Bandit Integration, Policy Migration, Universal Records Admin. Any staffer could open them.
Two APIs were worse than the pages: `/api/crm-proxy/blog-posts*` (publishes to the PUBLIC
website) and the `/api/staff/sanmar-invoices/*` + `/api/staff/shopworks-payables` feeds were
only `requireStaff`.

**Root cause.** `gateStaffPage` resolves a page with no `Staff_Page_Access` row to *"any
logged-in staff"* (`if (!rule) return true`). That's the correct default for the ~100 ordinary
staff pages, and it's why the table-driven design is pleasant to use â€” but it means security
depends on someone **remembering** to add a Caspio row. Nothing in the code, the menu, or a
test said a row was missing. A forgotten row failed OPEN and looked identical to a deliberate
decision. The client had no role signal at all, so the menu rendered all 18 links for everyone.

**Solution.**
- Extracted the decision to `lib/page-access.js` (the `lib/cors-allowlist.js` precedent) and
  added `ADMIN_DEFAULT_PAGES` â€” the 18 Administration pages. For that set only, no row now
  means **admin-only** instead of any-staff. The Caspio table still wins, so widening is still
  a no-deploy edit in Access Admin.
- `gateStaffPage`'s error path used to fail open for everything; admin pages now fail closed.
- Gave the exposed APIs the same page/API-twin gate payroll already used:
  `requirePageAccess('blog-editor.html')` and `requirePageAccess('sanmar-payables.html')` â€”
  one Caspio row governs a page and its data, so they can't drift.
- Sidebar: `data-requires-role="admin"` + `hidden`, resolved by `nav-access-controller.js`.

**Prevention.**
- `tests/unit/admin-page-access.test.js` has a **drift lock**: it parses the Administration
  menu out of `staff-dashboard-v3/index.html` and fails if the menu and `ADMIN_DEFAULT_PAGES`
  disagree in *either* direction. A new admin page cannot land in the sidebar without an
  access rule behind it, and a retired one can't rot in the list.
- Rule of thumb: **gating a page is only half the job â€” gate the API that feeds it too.**
  A page gate stops the UI; only the API gate stops a direct request.

### Gotchas found while fixing this

- **`[hidden]` does not hide `.nav-section`.** `base.css` sets `.nav-section { display: flex }`,
  which outranks the UA `[hidden]` rule â€” the block stayed visible. Needs an explicit
  `[data-requires-role][hidden] { display: none !important; }`.
- **Hide is not enough â€” remove.** `command-palette-controller.js` harvests its Ctrl+K registry
  from the live DOM on every open. A merely-hidden admin link is still searchable by name.
- **Sidebar `aria-expanded` was decorative.** The markup shipped `aria-expanded="false"` and
  `toggleSection` never updated it, so screen readers were told every section was collapsed
  while open â€” and the `[aria-expanded="true"]` rule in `dashboard-v3-theme.css` never fired.
  Now synced in `sidebar-controller.js`.
- **New `.nav-section` headers render as a solid green square** unless they get a
  `data-section`-specific `mask-image` â€” `.nav-section-title > span[aria-hidden]:first-child`
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
   127 â†’ 155. The change was correctly synced to all 4 builders per Rule 8, but only DTG
   tipped over â€” DTG's `init` is the only one carrying every entry-mode branch inline
   (emb/scp/dtf equivalents sit at 133â€“146, just under the cap).
2. *Why it went unseen.* The `/deploy` skill's Step 0.6 smoke gate runs **`npm run
   test:parser`** â€” `tests/unit/parser` only. A red ratchet in `tests/unit/` does not block
   a deploy. `npm test` is the thing that catches it, and nothing runs it automatically.

**Solution.** Genuinely refactored rather than allowlisted. `init()` was a 5-way entry-mode
dispatcher, not the allowlist's justified case ("one cohesive HTML template", like
`form-core.js:render` at 383). Extracted `configureOrderSummaryBand()`,
`ensureRowsAndRender()`, and one predicate per entry mode (`tryDuplicateMode`, `tryEditMode`,
`tryQuickQuotePrefill`, `tryMethodSwitchPrefill`, `restoreOrStartFresh`) â€” each returns true
when it owns the load. `init()` is now 18 lines and the priority chain is explicit. DTG-only:
this is `init` dispatch, not one of Rule 8's sync categories.

**Prevention.**
- **Allowlisting a ratchet entry is almost always the wrong call.** It freezes the regression
  as acceptable and releases the pressure keeping the sibling builders at 133â€“146.
- The entry-mode ORDER is behavioral, not cosmetic (`?duplicate=` > `?edit=` > handoffs >
  auto-restore). Verify it with both params present, not one at a time â€” a one-at-a-time
  pass looks identical whether or not the priority survived.
- `adapter.js`'s JSDoc had already flagged this: *"the real split lands if init is ever
  unpacked."* When a file comment names a future refactor, that's the map â€” follow it.

---
---

## An audit measured our own broken meter and declared us on budget (2026-07-28)

**Problem.** An external code audit of Caspio call volume opened with "the cross-dyno rollup
shows 16,055 calls on 7/27 vs the 16,129/day budget â€” the July fixes already took you from
~22k to ~16k." Every savings estimate in it was then sized against that denominator. Caspio
billed **23,959** that day. We were at ~132% of pace, not at it.

**Root cause.** 16,055 was our own meter's known-low reading â€” the exact figure recorded one
entry below as the *under-count*. The audit read the number from `/api/admin/usage`, saw the
field labelled `mode: "rollup"`, and treated it as cross-dyno truth. It was one row from one
web dyno. The label was accurate about the code path and silent about the coverage.

**Solution.** Re-anchored on Caspio's own billing page and re-derived every estimate from it.
Then closed the biggest remaining hole: `sync-manageorders`, `check-zero-billing` and
`sync-commissions` build their own Caspio URLs with raw axios and never load `api-tracker`.
The global interceptor installs as a side effect of **loading** that module, so it attaches
**per-process** â€” the docs claiming it catches "any process that talks to Caspio" were wrong;
it catches any process that *loads the tracker*. ~950 calls/day were invisible.

**Prevention.**
- **A meter may not grade its own coverage.** Reconcile against the party that bills you,
  every time, before quoting a number to anyone â€” including to a tool you asked for advice.
- **A label describes a code path, not a guarantee.** `mode: "rollup"` was true and useless.
  When a field asserts scope, make it carry the evidence: row count, dyno list, first/last
  write. A scope claim nothing can falsify will eventually be believed while wrong.
- **Give an outside auditor your known-wrong numbers up front.** This audit was competent â€”
  it independently found the metering hole â€” but nobody told it the baseline was suspect, so
  it anchored on it and mis-ranked everything downstream. The brief is part of the tool.
- Sixth appearance this week of the same shape: **the error always points DOWN, and
  under-reporting reads as "we're fine."**

### The same audit's fixes had to be adversarially checked before shipping

Three of six proposed fixes would have introduced a silent wrong answer, each in the
"looks healthy, isn't" family â€” worth internalizing as a pattern, not three anecdotes:
- **`Promise.allSettled` status is not a completeness test.** `fetchAllCaspioPages` *resolves*
  with PARTIAL results when pagination fails mid-way, so `status === 'fulfilled'` is true for
  a truncated read. Test the DATA (`length > 0`, expected keys present), never promise state.
- **A cache TTL borrowed from a neighbour imports its freshness assumptions.** Reusing the
  1-hour `STATIC_TABLE_TTL_MS` for `Pricing_Tiers`/`DTG_Costs` would have quadrupled staleness
  on the tables Erik actually edits, and desynced DTG from `/api/pricing-bundle`, which reads
  the same two tables at 15 min. Match the TTL to the sibling that shares the table.
- **Failing only when EVERYTHING fails is failing open.** `/api/dtg/quote-pricing` 502'd only
  when every bundle was missing. A partial set still answered 200 â€” `priceLines()` drops the
  failing line but keeps its quantity in `combinedQty`, and the cart engine index-aligns items
  to a now-shorter array. Under-stated subtotal *and* mis-attributed line items. The
  any/all distinction in an error guard is a pricing decision.

## Our "day" was 7 hours off the vendor's, and the offset looked like thousands of missing API calls (2026-07-28)

**Problem.** Reconciling our Caspio call meter against Caspio's own usage chart showed a
persistent 30-40% shortfall â€” 23,959 billed vs 16,055 measured on 27 Jul. A full day went
into hunting the "missing" caller: audited Python Inksoft, the main app's runtime, every
`fetch`/raw-HTTP path in the proxy, and the Caspio account's API profiles. All clean.

**Root cause.** Two independent under-counts, and neither was an unknown integration.
(a) Heroku Scheduler runs every `npm run sync-*` job as a **one-off dyno** that lives for
seconds and exits via `process.exit(0)`. The rollup flushed on a 60-minute `setInterval`, so
it never fired there and SIGTERM never arrived â€” the table held `web.1` rows and nothing
else, hiding ~30% of traffic. (b) **Caspio buckets usage on the ACCOUNT timezone** â€” its
Integrations log header reads literally `Log date (UTC-07:00)` â€” while we keyed days on UTC.
Our "28 Jul" began at 5 PM Pacific on the 27th, so the two windows were never comparable.

**Solution.** Flush on a **call-count threshold** (250) instead of a timer, so a trigger
fires regardless of process lifetime; writes became **append-only deltas** (no read, no
read-modify-write race between concurrent dynos); auto-start metering from `api-tracker` so
any process talking to Caspio records, not just the one that loads `server.js`. And a single
`utils/account-time.js` now owns "what day is it" (DST-aware `America/Los_Angeles`), used by
the tracker, the rollup and the period window â€” they must agree, because the rollup looks
days up by the tracker's own key.

**Prevention.** **Before reconciling your number against a vendor's, match their clock â€”
check the timezone on their own log/report headers first.** A whole-day offset is
indistinguishable from missing data and will send you hunting a phantom. And **a time-based
flush cannot work in a short-lived process**: if a metric must survive processes you don't
control the lifetime of, trigger on *work done*, not on elapsed time. Both bugs shared the
signature that has now appeared five times this week â€” the error only ever pointed one way,
DOWN, and under-reporting always reads as "we're fine".

---

---

## RBAC: an unlisted page defaults to OPEN, so half the Administration menu was public to staff (2026-07-28)

Full entry archived to `LESSONS_LEARNED_ARCHIVE.md`. The durable parts now live in CLAUDE.md's
Security Checklist: **an unlisted page defaults to any-logged-in-staff, so a new restricted page
needs a `Staff_Page_Access` row (or a spot in `ADMIN_DEFAULT_PAGES`)** â€” and **gating a page is
half the job; gate the routes that feed it with `requirePageAccess` too.**

---

## A ratchet test sat red for 9 days because /deploy only runs test:parser (2026-07-28)

Full entry archived to `LESSONS_LEARNED_ARCHIVE.md`. The durable part: **`/deploy`'s smoke
gate runs `npm run test:parser` only, so a red ratchet anywhere else in `tests/unit/` does
not block a release** â€” run `npm test` yourself before shipping. And allowlisting a ratchet
entry is almost always wrong; it freezes the regression as acceptable.

---

## A CSS specificity TIE pinned the Administration menu permanently open (2026-07-28)

Full entry archived to `LESSONS_LEARNED_ARCHIVE.md`. Durable part: **two rules with EQUAL
specificity are resolved by source order, so a later `max-height: none` silently beat the
collapse** â€” when a CSS edit appears to do nothing, count specificity AND check what comes
after it. See also the `@layer`-vs-unlayered entry above.

---

## The 4 AM inbound printout missed 4 POs â€” the WA cartons sync in AFTER it prints (2026-07-29)

**Problem.** The Daily Inbound PDF Erik printed at **3:57 AM on 7/29** listed 8 POs / 17 boxes /
751 pcs / $5,956. SanMar's PSST freight manifest for ship-date 7/28 showed 4 more POs
(**142476, 113825, 113834, 113835** â€” 5 cartons, 126 pcs, $398) that UPS had already scheduled
for 7/29 delivery. Reloading the page at 4:03 AM gave the correct **12 POs / 22 boxes / 877 pcs
/ $6,354**. Nothing on the printed sheet was *wrong* â€” it was 6 minutes too early.

**Root cause.** All four are **WA-INV (Issaquah)** shipments that SanMar packed between
**4:58 and 6:55 PM PDT on 7/28**. The shipment sync writes those cartons to the Caspio
`shipments` table in the small hours; on 7/29 they landed **between 10:56:56 and ~11:02 UTC**
(3:57â€“4:02 AM PDT). `/api/sanmar-orders/inbound-today` caches its payload for **600 s**
(`sanmar-orders.js` â†’ `orderCache.set(cacheKey, payload, 600)`), and the print builders render
`lastData` â€” the payload captured when the modal loaded. So a 3:57 AM print serves a payload
built at 3:56:56 AM, before the WA rows existed. WA is the worst case precisely *because* its
transit is 1 business day: an Issaquah carton packed at 6 PM is inbound **the next morning**,
with no slack for the sync to catch up. NV/AZ/TX/VA cartons get 2â€“5 days, so a late sync never
shows on their printout.

**Fix (operational).** Print the inbound report **after ~5:00 AM**, and hit **Refresh** on the
SanMar Inbound modal before printing or running Box Labels. Re-check any pre-5 AM printout
against that day's PSST manifest CSV.

**Prevention.** Treat `generatedAt` as the report's real timestamp, not the print time. Worth
building: have the "Print forâ€¦" flow force `load(true, viewDate)` first, or surface a banner
when `generatedAt` predates the last shipment sync. Same trap applies to Box Labels â€” labels
printed at 3:57 AM would have been 5 cartons short.

**Fixed 2026-07-29** (`b97868e2`): Print forâ€¦, Box Labels and the per-box label button all call
`syncBeforeOutput()` first â€” force `refresh=true`, re-render, then build the sheet â€” with a
2-minute freshness window so a printing session costs ONE re-pull, not one per sheet. A failed
re-pull shows an alert strip and prints **nothing**.

**Related drift found the same day (not fixed).** The calendar heat-map (`/daily-inbound`) and
the detail modal (`/inbound-today`) disagree on the *same* day: 7/29 = 13 PO / 478 pcs on the
calendar vs 12 PO / 877 pcs in the detail; PO 113805 sits on 8/4 in the calendar and 8/3 in the
detail. Calendar buckets on ship-date + transit **estimate** and sums the PO items table;
the detail view uses **UPS's real delivery date** and live carton contents. Clicking a "13 PO"
day and getting 12 reads as a bug to staff.

---

## Two syncs land AFTER the 4 AM inbound print â€” the second one blanked the box labels (2026-07-29)

**Problem.** POs 113825 and 113834 printed as **"Unmatched"** on the inbound sheet and, worse,
on the receiving box label: no company, no due date, no design, no contact, no rep, method
"Other". They were real orders â€” Stella Jones and All The Bases Youth Sports.

**Root cause.** Same shape as the carton lag above, different sync. `scripts/sync-manageorders.js`
runs on **Heroku Scheduler at 12:00 UTC = 5:00 AM PT**, an hour *after* the report prints, so a
work order written yesterday afternoon has no `ManageOrders_Orders` row when the sheet is built.
`inbound-today` reads only that archive, so it had nothing to show. `PurchaseOrders` resolves the
WO **number** but carries no customer (its only name column is `VendorName` = SanMar), which is
why the WO printed while the company didn't.

**Fix** (`a0e2bc6`). For any arriving work order missing from the archive, pull it from the
**live ManageOrders API** (`fetchOrderByNumber`). The API returns the *same field names* as the
Caspio columns, so rows drop into `moByIdOrder` unchanged. Pooled 4-at-a-time, capped at 25 per
request with a `console.warn` when it truncates â€” a silent cap would read as "nothing was
missing" when the sync is down.

**Prevention.**
- **Anything printed at ~4 AM is upstream of both syncs.** Before trusting a field on that sheet,
  ask which table feeds it and when that table is written â€” shipments ~4 AM, ManageOrders 5 AM.
- **A staff-facing view should not be limited to the archive's freshness** when the live source is
  one call away and the miss count is small. Archive first, live for the remainder.
- Two independent bugs, one date, one cause: *our copy* of the truth lagged the truth.

### The UI harness stalled because printing became async

Making print `await` a refresh broke `tests/ui/test-inbound-print.js`, which read
`#sit-print-sheet` on the same tick as the click. Converting it to `setInterval` polling then
stalled at profile 3 in a way that looked like an app bug â€” it wasn't. **A backgrounded tab
throttles `setInterval` to ~1 s and then to a crawl**, so a polling harness hangs while the page
underneath is perfectly healthy. `MutationObserver` fires on the DOM change regardless of tab
visibility â€” use it, never a timer, to wait for a node in a UI harness. (Second time this class
of trap has cost a debugging session; the first was throttled CSS transitions.) Also: wait for a
*new* node â€” the previous profile's sheet lingers until its 1500 ms cleanup, so "a sheet exists"
silently clones the previous profile.

---

---

## A closed `<details>` still reports its old size â€” `checkVisibility()`, not `getBoundingClientRect()` (2026-07-29)

**Problem.** A layout test asserted that collapsing the Pride Wall hid its photo track:
`pw.open = false; track.getBoundingClientRect().height === 0`. It failed at **every** viewport
width â€” the track kept reporting 164.6px while the parent `<details>` correctly shrank 191px â†’ 19px.
The widget was working; the assertion could never pass.

**Root cause.** A closed `<details>` hides its content with **`content-visibility: hidden`**, not
`display: none`. The subtree is skipped for rendering but **retains its last laid-out geometry**, so
`getBoundingClientRect()` returns the size it had when it was last open. `getComputedStyle(el).display`
is likewise still `grid`. Nothing about the element's own boxes says "I am hidden".

**Fix.** `!el.checkVisibility()` â€” it accounts for content-visibility, `visibility`, and opacity, and
correctly returns `false` inside a closed `<details>`. Alternatively assert on the *parent*
`<details>` height, which does collapse.

**Prevention.** Never probe visibility through the geometry of a descendant â€” measure the collapsing
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
so the container queries in components.css had never once matched â€” they looked live and were dead.

**Fix.** patch-2 Â§7 is now the single owner of the tracks; components.css keeps a 1fr base and the
theme keeps only the gap, each with a comment naming the owner.

**Prevention.** In this codebase `@layer` = "loses to everything in the theme/patch files". Before
editing a dashboard rule, check whether an unlayered file also declares it â€” and when a CSS edit
appears to do nothing, suspect layering before specificity.

---

## An audit measured our own broken meter, and our "day" was 7h off the vendor's (2026-07-28)

Both archived to `LESSONS_LEARNED_ARCHIVE.md`. The durable pair: **before reconciling your number
against a vendor's, match their clock** â€” check the timezone on their own report header first; a
whole-day offset is indistinguishable from missing data. And **never treat your own meter as ground
truth when auditing that meter** â€” under-reporting always reads as "we're fine".

---

## "Steve gets no notification" was a second submission path, not broken notification code (2026-08-01)

**Problem.** Steve got no email and no Slack ping for Ruth's art requests, and Ruth got no
confirmation â€” yet the artwork landed in his queue normally. Worked fine for Nika and Taneisha.
Every instinct said the notification code was broken for one user.

**Root cause.** Ruth was never using the AE dashboard form. She submits through a legacy **Caspio
DataPage**, which writes straight into the `ArtRequests` table and never calls
`POST /api/artrequests` â€” and BOTH notifications hang off that POST (browser EmailJS in
`garment-submit-form.js sendNotificationEmails`, plus server-side Slack in the proxy's
`art.js notifyArtRequestSubmission`). Nothing was broken; the requests never touched the code.
The Slack webhook was set and healthy the whole time.

**Why it hid.** A DataPage write is indistinguishable from an API write *in the queue* â€” the row
looks normal. Only the columns give it away.

**Solution.** Moved Ruth to the AE form (people fix, zero code). Shipped
`scripts/art-request-source-audit.js` to name anyone whose NEWEST request bypassed the form.

**Prevention.** ðŸ”‘ **When a feature fails for exactly one person, verify they're on the code path
before debugging the code.** Cheapest possible test: diff their DATA against a working user's.
Fields a form writes *unconditionally* are a free fingerprint of which form produced a row â€”
here `Item_Type`/`Sales_Rep`/`Status` were empty on 6/6 of Ruth's rows and populated on everyone
else's, and her `Garment_Placement` values weren't even options in the AE form's dropdown.
ðŸ”‘ **A second write path into a shared table silently skips every side effect** the first path
owns. Retiring the old UI isn't enough while the DataPage URL still works.


## A 23-digit ID stored as a number is 7 digits of identity â€” 71 of 92 payables vanished (2026-08-03)

**Problem.** The Atmos credit-card formatter's CSV imported into Caspio `CreditCard_NWCA_ATMOS`
as **21 rows out of 92**, with "value is not unique" on the rest. The 21 that landed totalled
**âˆ’$7,564.88** against the statement's true net of **$11,426.76** â€” wrong data, not just partial.

**Root cause.** `Reference_ID` was emitted as the BoA reference stripped to **digits only** (23 of
them). No numeric type holds 23 digits â€” a 64-bit integer tops out at 19 â€” so Excel (on open+save)
and a numeric Caspio field both keep the leading ~7 significant digits. On a BoA reference those
are the **acquirer/BIN prefix: they identify the payment PROCESSOR, not the charge.** So all 21
SUPACOLOR + all 7 ANTHROPIC + INKSOFT + SHOPIFY + ZAPIER + PADDLE + ZOHO â€” 33 charges â€” became the
single key `24011346`, and 92 references collapsed to 21. `Reference_ID` is marked Unique, so the
rest were rejected.

**Why it hid.** BoA's own export prefixes the field `Ref: `, which makes it text and protects it
through Excel. `_bare_ref()` stripped exactly that guard â€” the code removed the thing keeping the
value safe. Import "succeeded" with a row count nobody reconciled against the statement.

**Fix.** Canonical key is now `R` + digits (`_ref_key()` in `Python Inksoft/web/atmos_formatter.py`;
`refKey()`/`refDigits()` in the proxy's `src/routes/creditcard-lookups.js`). The upsert compares on
the bare digit run so legacy bare-digit rows still match, and PUTs against the *stored* value while
rewriting it to canonical form â€” migrating in place. Locked by
`tests/jest/creditcard-atmos-refkey.test.js` (11 tests). Caspio field must be **Text (255), Unique**.

**Prevention.**
- ðŸ”‘ **An all-digits identifier is not a number â€” give it a non-numeric character.** A leading
  letter costs nothing and makes every consumer (Excel, Caspio, CSV, JSON) treat it as text.
  It also converts a wrong field type from a *silent merge* into a *loud rejection*.
- ðŸ”‘ **Truncation of an ID is worse than loss of an ID**: the surviving prefix is usually a
  *grouping* code (issuer, region, vendor), so unrelated records silently merge and look plausible.
- **Verify an import by RECONCILING A TOTAL, never by "no error appeared."** 21 rows summing to the
  wrong sign should have been the first thing checked.
- Diagnosing: group the source rows by the suspected mangling (float32, N-digit truncation) and
  check the group count against what actually landed â€” 21 groups vs 21 rows named the cause exactly,
  and the survivor of each group matched row-for-row.

**Tail (same day, found only by exporting the WHOLE table).** The 92 rows landed clean but carried
`Month_Reconciled` as `Aug-26` while all 1,354 older rows use `26-Aug` â€” so they grouped with
nothing. ðŸ”‘ **A format built in two places must be changed in both**: the Python
`month_year_to_reconciled()` AND `applyRecon()` in `static/atmos_formatter.js`, which rewrites the
column client-side when the month dropdown moves. Fixing only the server would have let the dropdown
put the old format straight back. That JS had **no `?v=` cache-bust** either, so a stale copy would
have done it anyway â€” added one off the Heroku release number. ðŸ”‘ **Verifying the rows you just
wrote is not enough; export the whole table and compare the new rows against the existing
convention.** Every per-row check passed â€” the defect was only visible next to the other 1,577 rows.
Realigned with one `q.where`-scoped Caspio PUT touching only that field
(`proxy scripts/fix-atmos-month-reconciled.js`), so hand edits and `Reconciled` survived.

**Second tail: the month was also off by one.** `compute_default_reconciled()` returned the month
AFTER the latest posting date, so the 6/9â€“7/8 statement imported as August; a BoA cycle runs ~9th
to 8th, so that IS the July statement. ðŸ”‘ **The convention was already sitting in the table â€” 1,669
rows answered both "which format" and "which month" definitively (15/15 use the closing month, 0 use
the month after). Derive a convention from the data instead of inventing one, then replay history
through the new rule as the test** (reproduced 11/11 correct labels). âš ï¸ Don't reach for the *most
common* posting month either â€” on a 9th-to-8th cycle most charges fall in the earlier month, which is
off by one the other way. ðŸ”´ **Re-read before writing when the user is working in the same table**: a
dry run showed 40 rows, not the 92 verified minutes earlier â€” Erik was hand-retagging them, and to a
third format (`26-July` vs the table's `25-Jul`). Scope the fix by a stable key (`Reference_ID LIKE
'R%'`), not by the value being edited. **Found separately and FIXED: 239 rows carried the wrong YEAR** â€” the
Feb/Mar/Apr **2026** statements sat under `25-Feb`/`25-Mar`/`25-Apr` (each label held two
statements) while `26-Feb`/`26-Mar`/`26-Apr` didn't exist. Split on `PayableDate` year,
`proxy scripts/fix-atmos-statement-year.js`. ðŸ”‘ **That split is only safe for Febâ€“Dec: a JANUARY
cycle runs Dec 9 â†’ Jan 8 and legitimately spans two calendar years**, so `26-Jan` must stay mixed
and the script refuses month 1. ðŸ”‘ **Validate a bulk relabel by asserting the SHAPE of both
resulting sets** â€” each must close in the month it claims and span less than one cycle; the 2025
and 2026 windows mirroring each other day-for-day is what proved these were two statements and
not one messy month. âš ï¸ All 239 were already `Reconciled`, so this restated closed months â€”
Erik's call, taken explicitly.

---

*(Older resolved entries live in `LESSONS_LEARNED_ARCHIVE.md`.)*

## The blog content bank was written from style numbers it never looked up — 20 of 23 drafts misdescribe products (2026-08-03)

**Problem.** The weekly blog autopilot reached `best-carhartt-styles-custom-company-workwear`.
Every publish-time check the task specifies **passed**: all 5 linked styles returned HTTP 200,
all 5 were `PRODUCT_STATUS: "Active"`, every internal link resolved. The body was still wrong
on all five: CT104670 called a "Duck Jacket… rugged duck canvas" (it is the **Storm Defender
Shoreline Jacket**, a rain shell), CTK121 called a "**Crewneck**… no-hood option" (it is the
**Midweight Hooded** Sweatshirt), CT102208 called the "Gilliam **Vest**… without the sleeves"
(it is the Gilliam **Jacket**), CT100617 given CTK121's name, CT100615 left unnamed filler.
A reader clicking any link lands on a product that contradicts the sentence that sold it.

**Root cause.** The 2026-07-13 seeding batch generated prose *around* style numbers instead of
*from* the catalog — the numbers are real and active, so every existence check is satisfied while
the identity behind each number is invented. An audit across all 23 drafts found the defect is
systemic: **only 3 drafts are clean**; 2 recommend styles that are now **Discontinued**
(NE1000 in 6 drafts, CS413), and CornerStone `CS410`/`CS413` are sold as "tee" and "pocket tee"
when both are **polos**.

**Fix.** Published the oldest genuinely-clean draft instead (`custom-ogio-bags-polos-corporate-gifts`
— all 5 styles Active, every prose claim corroborated by the catalog, `COMPANION_STYLES` confirming
its one relational claim). The other 20 drafts stay Draft pending rewrite; nothing was edited.

**Prevention.**
- **`PRODUCT_STATUS: "Active"` proves a style exists, not that the sentence about it is true.**
  Diff the prose against `PRODUCT_TITLE` for every recommended style before publishing.
- **Check prose, not just anchor text.** An anchor-text-only audit scored the Carhartt draft
  1 mismatch; reading the body found 5. The regex could not see errors in the description
  sentences, which is exactly where a generated draft puts them.
- **A bare style number as anchor text (`[PC54](…)`) is fine and reads as a false positive** —
  rank findings by whether the anchor *asserts a wrong identity*, not by string mismatch.
- **Content written ahead of publication decays two ways**: the catalog moves under it (the
  documented risk) *and* it may never have been right (the undocumented one). Verify both.

---
## The vacation slip printed the accountant's tax year, not the employee's (2026-08-03)

**Problem.** Sorphorn Sorm's slip read **112 accrued / 56 used / 56 remaining**. Both figures
were wrong by the same 32 hours; it should read **80 / 24 / 56**.

**Root cause.** Payroll books hours to the tax year of the **check date**, not the work date.
She took 32 h on 12/22, 12/23, 12/29 and 12/30 of 2025 â€” a pay period whose check date was
01/09/2026. Those hours therefore land in the 2026 payroll year and on her 2026 W-2, and to pay
them the system carried 32 h of 2025 balance forward. **Accrued and used are both inflated by
the same carryover, so they cancel** â€” which is why remaining was right the whole time and the
defect was invisible in the one column anyone checks. Correct cash-basis accounting on the
accountant's side; a display problem on ours.

**Solution.** New hand-maintained Caspio column `Employees.Vacation_Annual_Entitlement`, read
live at slip time: `carryover = max(0, available âˆ’ entitlement)`, `slip_accrued = entitlement`,
`slip_used = used âˆ’ carryover`, `slip_remaining = remaining` untouched. Blocking gates before
anything reaches paper (`accrued âˆ’ used == remaining` Â±0.01; entitlement must be set) and a
per-run audit CSV carrying raw + adjusted + carryover + flags.

**Prevention.**
- ðŸ”‘ **Two errors that cancel leave one clean column and no symptom.** Remaining reconciled
  perfectly for months while both inputs were wrong. When a derived figure is right, that is
  evidence about the *derivation*, not about its inputs â€” check the source columns too. (Same
  shape as the 2026-07-27 finding where `Sick_Hours_Remaining` was correct while
  `Sick_Accum_Hours_Available` sat at 0.)
- ðŸ”‘ **An "as of" date is not a date field, it is the frame every derived value must be read
  in.** The entitlement is date-effective off `Leave_Balances_As_Of`, never `today` â€” otherwise
  reprinting July's packet in September silently prints September's grant.
- ðŸ”´ **Never store a hand-maintained value in a column an importer writes.** The Friday import
  overwrites all three `Vacation_Hours_*` columns; the entitlement had to be its own field or it
  would be destroyed weekly. The tell that this was already happening: someone had hand-patched
  Sorphorn to 80/24/56 in Caspio, and the next import would have silently reverted it.
- ðŸ”´ **`Number('') === 0`.** Caspio returns a blank NUMBER as `''`, so blank and zero collapse
  under any numeric coercion. Here blank must *block* the slip while 0 is legitimate (salaried
  staff) â€” the two had to be separated explicitly, and the round-trip verified against live
  Caspio rather than assumed.
- ðŸ”´ **Do not generalise a correction to the neighbouring field because it looks similar.**
  Sick hours carry over year to year *by Washington statute*, so the identical-looking inflation
  there is correct. Both rules are jest-locked precisely because "fixing" sick too is the
  obvious next mistake.
- ðŸ”‘ **When a computed figure can't be trusted, refuse to print it â€” don't print a guess.** A
  missing entitlement defaults to nothing, never to 80; the employee is named in a banner and in
  the audit CSV so a missing slip is explained rather than merely absent.

### The validation gate I wrote was a tautology, and my own comment said so (same day)

An adversarial review of the above found the spec-mandated check had **zero power over the
value it existed to guard**. `carryover = max(0, available âˆ’ entitlement)` makes the clamp inert
whenever entitlement â‰¤ available, so `accrued âˆ’ used` collapses to `available âˆ’ used` â€” the
entitlement cancels, and the importer writes `remaining = accrued âˆ’ used` by construction. A
mis-keyed entitlement of 8 gave `{accrued 8, used âˆ’48, remaining 56}`: identity satisfied, no
flags, "Hours used âˆ’48.00" printed for an employee. Fixed by asserting the one relation the
identity cannot see â€” a carryover is hours both accrued *and* used last year, so
`carryover > used` is impossible.

- ðŸ”‘ **"This always holds" written next to an assertion is a bug report, not reassurance.** My
  comment read "holds algebraically for every case, because the carryover is added to accrued and
  used in equal measure" â€” a correct proof that the check could never fail, i.e. never fire.
  **An invariant that cannot fail is not validating anything.** Before trusting a check, ask what
  input makes it trip; if the answer is only "corrupt data from a system that can't produce it",
  the check is decorative.
- ðŸ”‘ **A hand-maintained value needs a check that constrains IT, not the machine-written values
  around it.** Everything else on the record came from one importer and agreed with itself by
  construction, so any relation among those fields was self-satisfying. Only a relation the
  hand-typed number participates in asymmetrically has power.
- ðŸ”‘ **State the limits of a guard in the same breath as the guard.** The fix catches an
  entitlement below `remaining` and nothing above it â€” so 70 instead of 80 still prints silently.
  That gap is now a passing test named "documenting the gap", because the failure mode of a
  partial guard is someone later assuming it was total.
- ðŸ”‘ **Adversarial review earns its keep on code that already passes its own tests.** 47 green
  tests, a live round-trip against Caspio and a rendered print check all missed this; four
  independent reviewers found it, and asking each finding's verifier to *refute* it killed 10 of
  17 claims. Confirming passes would have kept all 17.
- ðŸ”´ **A field allowlist protects fields, not strings built from them.** The same review found a
  pre-existing leak: the payroll reconciliation put `"NAME: gross X - deductions Y != net Z"`
  into a `rowIssues` array that bypassed the careful per-field `toSafeReview()` filter, and the
  page rendered it â€” on the one page whose stated purpose is that compensation never reaches the
  browser. **Audit the error and log paths with the same rigour as the data path.**
