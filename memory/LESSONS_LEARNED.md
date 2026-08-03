# LESSONS LEARNED

Bug → root cause → fix → prevention. Newest first. **Hard limit 300 lines** — archive the
oldest resolved entry to `LESSONS_LEARNED_ARCHIVE.md` once this passes 250.

---

## A 23-digit ID stored as a number is 7 digits of identity — 71 of 92 payables vanished (2026-08-03)

**Problem.** The Atmos credit-card formatter's CSV imported into Caspio `CreditCard_NWCA_ATMOS`
as **21 rows out of 92**, with "value is not unique" on the rest. The 21 that landed totalled
**−$7,564.88** against the statement's true net of **$11,426.76** — wrong data, not just partial.

**Root cause.** `Reference_ID` was emitted as the BoA reference stripped to **digits only** (23 of
them). No numeric type holds 23 digits — a 64-bit integer tops out at 19 — so Excel (on open+save)
and a numeric Caspio field both keep the leading ~7 significant digits. On a BoA reference those
are the **acquirer/BIN prefix: they identify the payment PROCESSOR, not the charge.** So all 21
SUPACOLOR + all 7 ANTHROPIC + INKSOFT + SHOPIFY + ZAPIER + PADDLE + ZOHO — 33 charges — became the
single key `24011346`, and 92 references collapsed to 21. `Reference_ID` is marked Unique, so the
rest were rejected.

**Why it hid.** BoA's own export prefixes the field `Ref: `, which makes it text and protects it
through Excel. `_bare_ref()` stripped exactly that guard — the code removed the thing keeping the
value safe. Import "succeeded" with a row count nobody reconciled against the statement.

**Fix.** Canonical key is now `R` + digits (`_ref_key()` in `Python Inksoft/web/atmos_formatter.py`;
`refKey()`/`refDigits()` in the proxy's `src/routes/creditcard-lookups.js`). The upsert compares on
the bare digit run so legacy bare-digit rows still match, and PUTs against the *stored* value while
rewriting it to canonical form — migrating in place. Locked by
`tests/jest/creditcard-atmos-refkey.test.js` (11 tests). Caspio field must be **Text (255), Unique**.

**Prevention.**
- 🔑 **An all-digits identifier is not a number — give it a non-numeric character.** A leading
  letter costs nothing and makes every consumer (Excel, Caspio, CSV, JSON) treat it as text.
  It also converts a wrong field type from a *silent merge* into a *loud rejection*.
- 🔑 **Truncation of an ID is worse than loss of an ID**: the surviving prefix is usually a
  *grouping* code (issuer, region, vendor), so unrelated records silently merge and look plausible.
- **Verify an import by RECONCILING A TOTAL, never by "no error appeared."** 21 rows summing to the
  wrong sign should have been the first thing checked.
- Diagnosing: group the source rows by the suspected mangling (float32, N-digit truncation) and
  check the group count against what actually landed — 21 groups vs 21 rows named the cause exactly,
  and the survivor of each group matched row-for-row.

---

## "Steve gets no notification" was a second submission path, not broken notification code (2026-08-01)

**Problem.** Steve got no email and no Slack ping for Ruth's art requests, and Ruth got no
confirmation — yet the artwork landed in his queue normally. Worked fine for Nika and Taneisha.
Every instinct said the notification code was broken for one user.

**Root cause.** Ruth was never using the AE dashboard form. She submits through a legacy **Caspio
DataPage**, which writes straight into the `ArtRequests` table and never calls
`POST /api/artrequests` — and BOTH notifications hang off that POST (browser EmailJS in
`garment-submit-form.js sendNotificationEmails`, plus server-side Slack in the proxy's
`art.js notifyArtRequestSubmission`). Nothing was broken; the requests never touched the code.
The Slack webhook was set and healthy the whole time.

**Why it hid.** A DataPage write is indistinguishable from an API write *in the queue* — the row
looks normal. Only the columns give it away.

**Solution.** Moved Ruth to the AE form (people fix, zero code). Shipped
`scripts/art-request-source-audit.js` to name anyone whose NEWEST request bypassed the form.

**Prevention.** 🔑 **When a feature fails for exactly one person, verify they're on the code path
before debugging the code.** Cheapest possible test: diff their DATA against a working user's.
Fields a form writes *unconditionally* are a free fingerprint of which form produced a row —
here `Item_Type`/`Sales_Rep`/`Status` were empty on 6/6 of Ruth's rows and populated on everyone
else's, and her `Garment_Placement` values weren't even options in the AE form's dropdown.
🔑 **A second write path into a shared table silently skips every side effect** the first path
owns. Retiring the old UI isn't enough while the DataPage URL still works.

---

## A stand-in fallback address is a silent-failure bug (2026-08-01)

**Problem.** 14 art requests saved with `User_Email: ae@nwcustomapparel.com` and
`Sales_Rep: Taneisha Clark`. Nobody owns that inbox, so those AEs' confirmation emails went
nowhere and the records carried a bogus submitter.

**Root cause.** `getSubmitterEmail()` in all four AE submit forms ended
`return localStorage.getItem('userEmail') || 'ae@nwcustomapparel.com';` — inventing an identity
when the staff session was missing instead of refusing.

**Why it hid for months.** Steve's notification still arrived, because **his** address is
hardcoded in `sendNotificationEmails` rather than derived. Only the AE's own copy vanished, and
nobody misses an email they never expected. Found while investigating an unrelated report.

**Solution.** Return `''` when unidentified; `handleSubmit()` blocks with a visible toast before
any upload or POST. Applied to all four forms (Rule 8). `tests/unit/art-submit-identity.test.js`
— two of its six cases grep all four files so no form can quietly reintroduce it.

**Prevention.** 🔑 **A fallback identity is the same class of bug as a fallback price** — it
manufactures plausible-looking data instead of failing. If the answer is "we don't know who this
is", the only safe output is an error. 🔑 When one recipient of a fan-out is hardcoded and the
rest are derived, the hardcoded one **masks** breakage in the derived ones — an alert that always
fires proves nothing about its siblings.

---

## The pacing alert's first real firing was a false alarm off its own repaired meter (2026-08-03)

**Problem.** At 4 AM on 1 Aug the Caspio pacing alert DMed Erik: *projected 493,729 / 500,000 —
99% of cap*. The true projection was **~341,000 (68%)**. The alert had worked end to end —
computed, deduped, reached Slack — on its first real firing, and was wrong.

**Root cause.** It projects `spent + (mean of the last 3 complete days × days remaining)`, read
from our own `API_Usage_Daily` rollup. Two of those three days were written **before the meter
was repaired**, and pre-repair rows disagree with Caspio's billing by amounts that change daily
*and flip sign*: 27 Jul −33%, 30 Jul **+18%**. The window `{29,30,31 Jul}` averaged 16,415/day
against a real ~10,600. A rate gets multiplied by every remaining day, so a 55% rate error
became a 45% projection error.

**Second, independent bias found while fixing it.** A 3-day window on a **Monday** reads
{Fri, Sat, Sun} and on a **Friday** reads three weekdays. Weekends run about half a weekday here
(Sat 6,657 / Sun 4,531 vs Fri 10,626), so the same data projected ~50,000 calls apart — a tenth
of the cap — purely by which day you looked.

**Solution.** `ROLLUP_TRUSTED_FROM = '2026-07-31'` (first day the repaired meter came in at
+2.2% vs Caspio) bars older rows from setting a **rate**, and `TREND_DAYS` 3 → **7** so the
window always spans exactly two weekend days. The rows stay in the table and on the chart,
hatched, because they are the evidence of what the overage cost. `computePacing` now returns
`trend: {daysUsed, windowDays, trustedFrom, excludedDays}` and the Slack body states its basis.

**Prevention.**
- 🔑 **Exclude bad history from the RATE, never from the LEVEL.** Dropping those days from
  `periodToDate` would have understated spend — the more dangerous direction. A number that is
  multiplied by 25 needs different care from one that is merely displayed.
- 🔑 **After repairing an instrument, mark the boundary in code.** "We fixed it on the 31st" in
  someone's head is not a guard; the next consumer of that table silently averages across the
  repair. The constant carries the measured per-day error table as its comment so the WHY
  survives.
- 🔑 **A trailing window inherits every seasonality shorter than itself.** For anything with a
  weekly rhythm, 7 days is the smallest window that cannot be biased by the day you sample.
- **Validate a monitor's first firing against the source of truth before trusting it.** The
  plumbing being correct is not the same as the answer being right — and an alarm that cries
  wolf on day 6 is one you have learned to ignore by day 30, which is the exact failure the
  alert exists to prevent.

**Found in passing.** The trend filter compared rollup keys (Pacific account days) against
`ymd(now)` (**UTC**), so between 5 PM Pacific and midnight UTC the still-running day sorted as
complete and its partial count dragged the rate down. Hidden because the scheduled run is 4 AM
Pacific, outside that seven-hour window. Now uses `accountDay(now)` — the same
UTC-vs-account-clock trap as [[caspio-account-clock]], third time in this subsystem.

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
