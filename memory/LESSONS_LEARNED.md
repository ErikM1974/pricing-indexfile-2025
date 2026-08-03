# LESSONS LEARNED

Bug → root cause → fix → prevention. Newest first. **Hard limit 300 lines** — archive the
oldest resolved entry to `LESSONS_LEARNED_ARCHIVE.md` once this passes 250.

---

## The vacation slip printed the accountant's tax year, not the employee's (2026-08-03)

**Problem.** Sorphorn Sorm's slip read **112 accrued / 56 used / 56 remaining**. Both figures
were wrong by the same 32 hours; it should read **80 / 24 / 56**.

**Root cause.** Payroll books hours to the tax year of the **check date**, not the work date.
She took 32 h on 12/22, 12/23, 12/29 and 12/30 of 2025 — a pay period whose check date was
01/09/2026. Those hours therefore land in the 2026 payroll year and on her 2026 W-2, and to pay
them the system carried 32 h of 2025 balance forward. **Accrued and used are both inflated by
the same carryover, so they cancel** — which is why remaining was right the whole time and the
defect was invisible in the one column anyone checks. Correct cash-basis accounting on the
accountant's side; a display problem on ours.

**Solution.** New hand-maintained Caspio column `Employees.Vacation_Annual_Entitlement`, read
live at slip time: `carryover = max(0, available − entitlement)`, `slip_accrued = entitlement`,
`slip_used = used − carryover`, `slip_remaining = remaining` untouched. Blocking gates before
anything reaches paper (`accrued − used == remaining` ±0.01; entitlement must be set) and a
per-run audit CSV carrying raw + adjusted + carryover + flags.

**Prevention.**
- 🔑 **Two errors that cancel leave one clean column and no symptom.** Remaining reconciled
  perfectly for months while both inputs were wrong. When a derived figure is right, that is
  evidence about the *derivation*, not about its inputs — check the source columns too. (Same
  shape as the 2026-07-27 finding where `Sick_Hours_Remaining` was correct while
  `Sick_Accum_Hours_Available` sat at 0.)
- 🔑 **An "as of" date is not a date field, it is the frame every derived value must be read
  in.** The entitlement is date-effective off `Leave_Balances_As_Of`, never `today` — otherwise
  reprinting July's packet in September silently prints September's grant.
- 🔴 **Never store a hand-maintained value in a column an importer writes.** The Friday import
  overwrites all three `Vacation_Hours_*` columns; the entitlement had to be its own field or it
  would be destroyed weekly. The tell that this was already happening: someone had hand-patched
  Sorphorn to 80/24/56 in Caspio, and the next import would have silently reverted it.
- 🔴 **`Number('') === 0`.** Caspio returns a blank NUMBER as `''`, so blank and zero collapse
  under any numeric coercion. Here blank must *block* the slip while 0 is legitimate (salaried
  staff) — the two had to be separated explicitly, and the round-trip verified against live
  Caspio rather than assumed.
- 🔴 **Do not generalise a correction to the neighbouring field because it looks similar.**
  Sick hours carry over year to year *by Washington statute*, so the identical-looking inflation
  there is correct. Both rules are jest-locked precisely because "fixing" sick too is the
  obvious next mistake.
- 🔑 **When a computed figure can't be trusted, refuse to print it — don't print a guess.** A
  missing entitlement defaults to nothing, never to 80; the employee is named in a banner and in
  the audit CSV so a missing slip is explained rather than merely absent.

### The validation gate I wrote was a tautology, and my own comment said so (same day)

An adversarial review of the above found the spec-mandated check had **zero power over the
value it existed to guard**. `carryover = max(0, available − entitlement)` makes the clamp inert
whenever entitlement ≤ available, so `accrued − used` collapses to `available − used` — the
entitlement cancels, and the importer writes `remaining = accrued − used` by construction. A
mis-keyed entitlement of 8 gave `{accrued 8, used −48, remaining 56}`: identity satisfied, no
flags, "Hours used −48.00" printed for an employee. Fixed by asserting the one relation the
identity cannot see — a carryover is hours both accrued *and* used last year, so
`carryover > used` is impossible.

- 🔑 **"This always holds" written next to an assertion is a bug report, not reassurance.** My
  comment read "holds algebraically for every case, because the carryover is added to accrued and
  used in equal measure" — a correct proof that the check could never fail, i.e. never fire.
  **An invariant that cannot fail is not validating anything.** Before trusting a check, ask what
  input makes it trip; if the answer is only "corrupt data from a system that can't produce it",
  the check is decorative.
- 🔑 **A hand-maintained value needs a check that constrains IT, not the machine-written values
  around it.** Everything else on the record came from one importer and agreed with itself by
  construction, so any relation among those fields was self-satisfying. Only a relation the
  hand-typed number participates in asymmetrically has power.
- 🔑 **State the limits of a guard in the same breath as the guard.** The fix catches an
  entitlement below `remaining` and nothing above it — so 70 instead of 80 still prints silently.
  That gap is now a passing test named "documenting the gap", because the failure mode of a
  partial guard is someone later assuming it was total.
- 🔑 **Adversarial review earns its keep on code that already passes its own tests.** 47 green
  tests, a live round-trip against Caspio and a rendered print check all missed this; four
  independent reviewers found it, and asking each finding's verifier to *refute* it killed 10 of
  17 claims. Confirming passes would have kept all 17.
- 🔴 **A field allowlist protects fields, not strings built from them.** The same review found a
  pre-existing leak: the payroll reconciliation put `"NAME: gross X - deductions Y != net Z"`
  into a `rowIssues` array that bypassed the careful per-field `toSafeReview()` filter, and the
  page rendered it — on the one page whose stated purpose is that compensation never reaches the
  browser. **Audit the error and log paths with the same rigour as the data path.**

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

**Tail (same day, found only by exporting the WHOLE table).** The 92 rows landed clean but carried
`Month_Reconciled` as `Aug-26` while all 1,354 older rows use `26-Aug` — so they grouped with
nothing. 🔑 **A format built in two places must be changed in both**: the Python
`month_year_to_reconciled()` AND `applyRecon()` in `static/atmos_formatter.js`, which rewrites the
column client-side when the month dropdown moves. Fixing only the server would have let the dropdown
put the old format straight back. That JS had **no `?v=` cache-bust** either, so a stale copy would
have done it anyway — added one off the Heroku release number. 🔑 **Verifying the rows you just
wrote is not enough; export the whole table and compare the new rows against the existing
convention.** Every per-row check passed — the defect was only visible next to the other 1,577 rows.
Realigned with one `q.where`-scoped Caspio PUT touching only that field
(`proxy scripts/fix-atmos-month-reconciled.js`), so hand edits and `Reconciled` survived.

**Second tail: the month was also off by one.** `compute_default_reconciled()` returned the month
AFTER the latest posting date, so the 6/9–7/8 statement imported as August; a BoA cycle runs ~9th
to 8th, so that IS the July statement. 🔑 **The convention was already sitting in the table — 1,669
rows answered both "which format" and "which month" definitively (15/15 use the closing month, 0 use
the month after). Derive a convention from the data instead of inventing one, then replay history
through the new rule as the test** (reproduced 11/11 correct labels). ⚠️ Don't reach for the *most
common* posting month either — on a 9th-to-8th cycle most charges fall in the earlier month, which is
off by one the other way. 🔴 **Re-read before writing when the user is working in the same table**: a
dry run showed 40 rows, not the 92 verified minutes earlier — Erik was hand-retagging them, and to a
third format (`26-July` vs the table's `25-Jul`). Scope the fix by a stable key (`Reference_ID LIKE
'R%'`), not by the value being edited. **Found separately: 239 rows carry the wrong YEAR** — the Feb/
Mar/Apr **2026** statements are stored under `25-Feb`/`25-Mar`/`25-Apr`, and `26-Feb`/`26-Mar`/
`26-Apr` are absent; those three months are overstated and the 2026 ones missing. Unfixed.

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

