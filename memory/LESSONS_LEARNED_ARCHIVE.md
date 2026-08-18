# LESSONS LEARNED â€” ARCHIVE

Resolved entries aged out of `LESSONS_LEARNED.md` (300-line cap). Newest first. No limit here.

---

## Two silent no-ops in the quote sync: '' IS NOT NULL, and a clock read in the wrong zone (2026-08-17)

**Problem.** Both were found while fixing the Aug 10-17 sync outage, and neither had ever
shown a symptom. ① The proxy's `syncCandidates=true` filter returned **9 of 9** non-cancelled
rows, so the hourly cron synced a `Status='Web Quote Request'` quote with no WO# forever. ②
`ShopWorks_Last_Synced` was **written UTC and read Pacific**, so a just-synced row parsed ~7-8 h
in the FUTURE, `now - lastSynced` went NEGATIVE, and the 30-minute staleness test could not fire
— the hourly re-sync was really running ~3x/day.

**Root cause.** ① Caspio stores an unset column as an **EMPTY STRING**, and `'' IS NOT NULL`, so
`(Status='Processed' OR PushedToShopWorks IS NOT NULL)` matched everything and the OR swallowed
the Status test. Only 1 of the 9 rows had a real `PushedToShopWorks`. ② `nowPacificNaiveIso()`
already existed in `server.js` and the sync handler simply didn't use it.

**Solution.** ① `PushedToShopWorks<>''` **plus** `ShopWorks_Order_Number>0`; proxy `v2026.08.17.1`
(Heroku v1088), verified live 9→8. ② `nowIso = nowPacificNaiveIso()`; app `v2026.08.17.5`
(Heroku v1867), verified live: stored `05:55:52` vs Pacific-now `05:56:05`, exactly 7 h behind UTC.

**Prevention.**
- 🔴 **In Caspio, `IS NOT NULL` does NOT mean "has a value".** Unset text columns come back as
  `''`. Any "was this ever stamped?" predicate needs `AND col<>''`, and a bare `IS NOT NULL`
  inside an `OR` silently promotes the whole clause to `TRUE`. Check the other named filters
  before trusting one.
- 🔴 **Tightening an over-matching filter can silently DROP real work.** Two DTG rows sat at
  `Status='Accepted'` with an empty `PushedToShopWorks` but a REAL WO# — they were being synced
  *only because of the bug*. The obvious one-line fix would have stopped their deletion detection
  and the ShipStation cancel-cascade with no error anywhere. **Before narrowing a predicate, dump
  what it currently matches and account for EVERY row you are about to exclude.**
- 🔑 **`toContain()` cannot see a MISSING conjunct.** The jest lock asserted
  `toContain('PushedToShopWorks IS NOT NULL')`, which passes with or without the `<>''` half. A
  substring assertion tests presence, never sufficiency — assert the part that carries the meaning.
- 🔴 **A timestamp has no type.** Nothing failed, nothing logged; the only tell was a cadence
  nobody was measuring. **When a column is written in one place and read in another, the writer
  and reader must name the same zone out loud** — and the fix belongs in the WRITER when every
  reader already agrees. The June "Purges in 31 days" patch fixed the *reader* on the dashboard;
  the reader had been right all along.
- 🔑 The regression test **parses both functions out of the shipped `server.js` and round-trips
  them**, with a negative control that re-creates the old writer and asserts the skew is still
  6.5-8.5 h. A source-grep for the call would pass whether or not the two agree.
- ⚠️ **The proxy caches `quote_sessions` reads** — a verification GET without `&refresh=true`
  returned the PRE-fix row and read as "not fixed". Always add `refresh=true` when checking a write.

---

## Gating a proxy route breaks every caller that never sent the secret (2026-08-17)

**Problem.** Slack fired `Quote→ShopWorks sync unhealthy / sync-errors+sync-noop` every hour.
The cron was running fine; every row it touched failed — `errors == candidates`, `synced: 0`.
ShopWorks snapshots had been frozen on EVERY quote for a week: not just the cron, but
quote-management's "Sync all", quote-view's page-load auto-sync and manual refresh, and
`pages/js/invoice.js`, which all call the same endpoint.

**Root cause.** Proxy `191c906` (2026-08-10 09:35 PT, "Gate the ManageOrders PII reads") added
`app.use('/api/manageorders/order', requireCrmApiSecret)`. That prefix covers `/order/:id/snapshot`,
and the fetch in `sync-from-shopworks` (`server.js` ~12770) was **the one proxy call in the whole
file sending no `X-CRM-API-Secret`**. Every sync 401'd; the handler turns that into a 502.

**Solution.** Send the secret, guarded like every other proxy call in the file, and `console.warn`
the non-OK response. Shipped `v2026.08.17.4` (Heroku v1866). Verified in prod: OF-0061/OF-0062 now
return `synced:true, status:Imported` with real snapshots, health is `ok:true, reason:null`.

**Prevention.**
- 🔴 **A gate lands on a PREFIX; the blast radius is every caller of every route under it.** The
  commit gated six prefixes and its message reasoned carefully about `/customers` (2 callers,
  correctly deployed app-first). `/order` got one line and no caller audit — and it had a caller.
  Before gating a prefix, grep all three repos for the prefix, not for the route you had in mind.
- 🔑 **The odd one out is the bug.** `server.js` sends `X-CRM-API-Secret` on ~80 proxy calls and
  omitted it on exactly one. `grep -c` the header against the count of `SYNC_PROXY_BASE`/
  `CRM_API_BASE` fetches — a single unauthenticated straggler is findable in one command, and is
  a live outage waiting for someone to gate its route.
- 🔴 **A 502 return path that logs nothing hides the outage completely.** `grep bulk-sync` showed
  only the summary line; there were ZERO `[sync-from-shopworks]` entries, so the logs looked like
  the sync wasn't even reaching the handler. Erik's #1 rule applies to SERVER logs too, not just
  customer-facing banners: every early `return res.status(5xx)` needs a `console.warn` naming the
  quote and the upstream status.
- 🔑 **Fast failure is a fingerprint.** 3 candidates in 3.2s with a 1s throttle each = ~0ms of real
  work per row. A run whose elapsed time is exactly its own throttle never talked to upstream.
- 🔑 The watchdog earned its keep — it caught a silent no-op within the hour and named it precisely
  (`sync-errors+sync-noop`). What it could NOT do is say WHICH quote or WHY: `recordQuoteSyncRun()`
  drops `errorDetails`. Worth carrying the first error string into the health payload.
- ⚠️ **Deploy left the repo on `main` with `develop` 2 commits behind** (a prior run's Step 16
  never completed), and a concurrent session moved the branch mid-diagnosis. In this shared
  OneDrive checkout, re-read `git branch --show-current` immediately before staging — never trust
  the branch you saw one command ago.

---

## Four silent pricing fallbacks, and the one that was never read (2026-08-17)

**Problem.** Four places substituted a hardcoded price with nothing on screen:
`getServicePrice()` returned its fallback silently when the Service_Codes map had loaded but the
row was missing; `fetchRoundingRules()`'s catch set `CeilDollar`; the DTG engine synthesised a
`24-47` tier with `LTM_Fee: 0`; and `calculators/embroidery-pricing.html` hardcoded `LTM_FEE = 50`.

**Root cause.** Every one had a *warning mechanism already available* and simply wasn't wired to it
— `warnIfServiceCodeMissing` existed and was called at ~4 of ~20 sites; `showFallbackPricingWarning`
existed; the DTG tier even set `_fallback: true`, and **nothing in the repo has ever read that flag**.
The gap was never "we didn't know how to warn", it was that the warning lived at the CALL SITE, so
every new caller silently opted out.

**Fix.** Warn INSIDE `getServicePrice` — one place, every caller covered by construction, including
future ones. `_fallback` surfaced at the DTG consumer (the engine file is byte-locked to the proxy,
so the fix belongs at the reader). Rounding flip sets a sticky `_roundingFallbackUsed`, toasted and
returned. The calculator reads `LTM_Fee` off the tier row carrying a non-zero fee — matching on the
FEE not a `'1-7'` label, so a Caspio re-band keeps working.

**Prevention.**
- 🔴 **Put the warning where the substitution happens, not where it's consumed.** A per-call-site
  warning is a rule you have to remember; a warning inside the function is one you cannot forget.
- 🔴 **A flag nobody reads is not a warning.** `_fallback: true` looked like diligence for months.
  Grep for a READER before believing a flag protects anything.
- 🔑 **`null` can be load-bearing.** `roundingMethod = null` MEANS half-dollar; the "harmless
  default" in the catch was a whole-dollar flip worth $0.49/pc. Check what a default actually does
  before calling a fallback safe.
- 🔑 **Node 18 has native `fetch`, so `tests/setup.js`'s stub never installs.** Two new tests
  silently hit the LIVE proxy (449 ms) and asserted the wrong thing — `/api/pricing-rules` answered
  `HalfDollarCeil_Final`, so the catch never ran. Stub `global.fetch` per test; a slow unit test is
  the tell.
- 🔑 Mutation-tested: reverting `getServicePrice` to the silent version fails 3 of 7 new tests.

---

## The staff quote builders were on the open internet, and a review found it (2026-08-17)

**Problem.** `https://www.teamnwca.com/quote-builders/embroidery-quote-builder.html` returned the
fully working staff tool to anyone — customer search, pricing table, ShopWorks import/export.
Separately, `admin/universal-records-admin.html` and the PUBLIC homepage (`catalog-search.js`)
rendered untrusted data into `innerHTML` unescaped.

**Root cause.** `app.use('/quote-builders', express.static(...))` sat between `/dashboards` and
`/vendor-portals` — **both gated** — and was simply never given a gate. Nothing detects a *missing*
`app.use`; the neighbours looked right, so review kept passing over it. `staff-auth-helper.js` made
it *look* protected, but it is a sessionStorage rep-name autofill, not authentication. The XSS side
had the same shape: `eslint.config.mjs` already enables `no-unsanitized` with `escapeHTML`
registered as a sanitizer — it never fired because **ESLint cannot see inside an HTML file**, and
the admin page keeps 60 KB of inline script.

**Fix.** `app.use('/quote-builders', gateStaffHtml)` **above** the `/quote-builders/:page` route
(not next to the static mount — Express matches in registration order, so a gate by the mount is
bypassed by the earlier route). The four ROOT aliases (`/embroidery-quote-builder.html` etc.) are
separate routes and needed their own `gateStaffPage`. Escaped every API-derived interpolation in
both files and replaced all inline `onclick`/`onchange`/`onsubmit` carrying data with `data-*` +
delegated listeners.

**Prevention.**
- 🔴 **A missing gate is invisible; only an inventory finds it.** Nothing greps for "the `app.use`
  that isn't there." The durable fix is a jest manifest test asserting every route declares a
  posture (`public` / `staff` / `page:x.html`), so a NEW route fails CI until classified. Reviewing
  the gates that exist will never find the one that doesn't.
- 🔴 **Escaping does NOT protect an inline event handler.** The HTML parser decodes entities BEFORE
  the JS is parsed, so `onclick="f('&#39;')"` still breaks out. `catalog-search.js` had already
  half-learned this — it escaped quotes *for the onclick* and left the HTML context open. Two
  contexts, two different rules: use `data-*` + delegation and the second context disappears.
- 🔴 **Escape BEFORE transforming, not after.** `Notes.replace(/\n/g,'<br>')` must be
  `escapeHtml(Notes).replace(...)` — escaping afterwards would neutralise the `<br>` you just added,
  and escaping first is the only order that is both safe and correct.
- 🔑 **Assets are content-hashed — an unverified fix is an unshipped fix.** The first browser check
  showed the payload STILL firing: `dist/` was serving the pre-edit file. `npm run build` is part of
  verifying, not just deploying. The network log is the proof (a live `GET /x` from the injected
  `<img src=x>` before, gone after).
- 🔑 **Gating a page does not gate its data.** These builders write to the proxy DIRECTLY
  (`APP_CONFIG.API.BASE_URL` is the proxy host), and proxy `quoteWriteOnly` is a rate limiter, not
  auth. The page gate is step one of two.

---

## We push part numbers our own importer cannot read (2026-08-16)

**Problem.** Re-importing a ShopWorks order that OUR builder created misrouted its decoration
lines. `DECG-FB` (every full back we push) and `AL-CAP` (every cap additional logo) classified as
**`product`** — not a mispriced decoration but a GARMENT ROW whose style number was the literal
string `"DECG-FB"`, carrying the decoration charge as its unit price, with no warning.

**Root cause.** The parser knew only the LEGACY vocabulary — `FB`, `CB`, `CS`. The builder's push
side moved on to `DECG-FB` / `AL-CAP` (the proxy's `KNOWN_FEE_PNS` even annotates `CB`/`CS` as
"legacy/imported; new builder uses AL-CAP") and nothing kept the two vocabularies in step. Orders
from the old system round-tripped; orders from the current one did not.

**Fix.** Both spellings classify. `unitPrice` is now kept on `fb`/`cb`/`cs` too — only the `al`
branch had it, so everything else hit the review modal with `shopWorksPrice 0`, which DISABLES its
ShopWorks radio (`swAvail = swPrice > 0`) and removes the rep's option to bill what the customer
was actually billed. Also fixed two defects that stopped the ">= $40 Back Logo is really a full
back" rule ever firing: `parseFloat('$45.00')` is NaN → 0 (so the line missed its own threshold),
and the guard tested `position === 'Back'` while `_parseALPosition` returns the more specific
`'Full Back'` — the clearest spelling of a full back was the one the full-back detector could not
see.

**Prevention.**
- 🔴 **Round-trip vocabulary is a CONTRACT, and nothing was checking it.** A test now
  parameterises the whole `KNOWN_FEE_PNS` list, so the next fee part we invent and forget to teach
  the parser fails there instead of appearing as a garment row named "GRT-75" in a customer quote.
  Push-side and parse-side vocabularies must be asserted against each other, not maintained in
  parallel by hand across two repos.
- 🔴 **"It classified as something" is not "it classified correctly".** A wrong-but-valid
  classification produces no error anywhere. Enumerate what a value SHOULD be, don't check that it
  parsed.
- 🔑 **A price a human can read must never parse to zero.** That zero wasn't cosmetic — it silently
  changed routing, because a downstream guard compared it to a threshold.
- 🔑 The fixture corpus (24 files / 100 orders) contains ZERO `FB`/`CB`/`CS` lines — the entire
  legacy decoration path had no fixture coverage, only three string-level `classifyPartNumber`
  assertions. Absence of a fixture is why none of this surfaced.

---

## Never assert on serialized data with a substring grep (2026-08-16)

**Problem.** `tests/unit/quote-cart-store.test.js` failed at random on a clean tree, roughly
1 run in N. Everyone re-ran it and moved on — which is the real damage: it trains the team to
treat a red suite as noise.

**Root cause.** The assertion was
`expect(JSON.stringify(raw)).not.toContain('504')` — stringify the WHOLE stored record and grep
it for the digits of a price that must not persist. But the record also holds `createdAt` /
`addedAt` epoch-ms and a base36 `id`. Any clock whose digits happen to contain "504" fails it.
Caught red-handed at `createdAt: 1786925049163` → "…25**049**163…". The store was always correct;
only the assertion was wrong.

**Fix.** Assert the INVARIANT, not the bytes. `add()` builds its item from an explicit allowlist
(`quote-cart-store.js:130-146`), so the test now pins the whole key set, checks the deep-copied
`sizes` (the one nested object a caller could smuggle through), and runs a recursive
**key** scan for price-bearing names. Plus a regression lock that stubs `Date.now()` to the exact
repro timestamp and asserts `toContain('504')` — proving the timestamps really do carry it while
the invariant still holds. Verified 50/50 clean runs, and a deliberately injected price leak fails
both tests with exact paths (`items[0].price.total`).

**Prevention.**
- 🔴 **A negative substring assertion over serialized data is a time bomb** — timestamps, ids,
  hashes and random suffixes all inject arbitrary digits. Assert on the field, not the string.
  Positive `toContain` on a NARROW value is fine; it was the whole-record negative that broke.
  Swept both repos: this was the only instance.
- 🔑 **A key-set assertion beats naming the bad fields.** Pinning all 15 keys also catches the
  refactor that actually lets money in — someone replacing the allowlist with a spread.
- 🔴 **Mutation-test the fix, and check the mutation applied.** My first injection silently did
  nothing (searched `\n`, the file is CRLF) and the suite "passed", which looked like proof and
  was the opposite. Always confirm the injected break actually landed — `git diff --stat` — before
  believing a green run means the test is watching.

---

## A consolidation is only as complete as the LAST thing that writes the value (2026-08-16)

**Problem.** The 2026-08-15 "one full-back ladder" work moved every surface onto Caspio
`Embroidery_Costs` `ItemType='DECG-FB'`. Two follow-on defects survived it, both invisible to a
green suite.

**Root cause 1 — a later init step clobbers the ladder.** `_doInitializeConfig()` reads the
ladder at ~:284 (`fbBaseStitchCount = fullBack.minStitches`), then calls `loadServiceCodes()` at
:334, which at :420 did an **unconditional** `this.fbBaseStitchCount = fb.StitchBase || 25000`
from the retired `Service_Codes` 'FB' row — overwriting the ladder's own minimum moments after
it was read, on all three full-back paths.
⚠️ **LATENT, not live — I first reported this as live and was wrong.** `GET
/api/service-codes?code=FB` returns **count 0**: the row is deleted, so `if (fb)` never fires and
nothing is being clobbered today. It would fire the moment anyone recreated an 'FB' row — exactly
the kind of no-deploy Caspio edit this shop makes. Same reason `fbStitchRate`'s "fallback" is
really the constructor constant `1.25` (`:39`), not a Caspio value, despite comments saying so.

**Root cause 2 — one branch was simply missed**, and nothing could catch it:
`getServiceUnitPrice`'s `'fb'` case kept multiplying by the flat `Service_Codes` rate. It lives
on `EmbroideryPricingCalculator` (`embroidery-quote-pricing.js`) — a **different class in a
different file** from the `EmbroideryPricingService` (`embroidery-pricing-service.js`) that the
full-back tests and the EMB-08 baseline both exercise. Two classes, same money, one tested.

**Fix.** `StitchBase` is taken only when no ladder loaded (`SellPrice` stays unconditional — it
IS the documented fallback). `'fb'` now calls `_getFBRateForQty(quantity)`. Seven new cases in
`emb-fullback-one-ladder.test.js`, including a **to-the-cent cross-check between the two
classes** — the assertion that makes them unable to drift again.

**Prevention.**
- 🔴 **Grep for every WRITE to a config field, not just the read you are fixing.** A migration
  that changes where a value comes from is incomplete until you have checked what else assigns
  it, and in what order. `initializeConfig` is a sequence — last writer wins.
- 🔴 **"All surfaces" means all CLASSES.** Two classes in two files own EMB pricing
  (`EmbroideryPricingCalculator` = builder/import, `EmbroideryPricingService` = services/AL).
  A consolidation that only touches one is half done, and the tests for one prove nothing about
  the other. Cross-check them in the same test.
- 🔑 **A dead branch is still worth fixing, but say that it is dead.** `case 'fb'` has no
  production caller — Full Backs parsed from ShopWorks lose their position at
  `shopworks-import.js:1219` / `_syncALArrays()` and get priced as plain additional logos. Fixing
  the rate is right; claiming it moved money would have been wrong. Verify reachability before
  writing an impact claim, and re-check any claim about *why* something is broken — the first
  explanation here (that the review modal's displayed price was billed) was refuted: that price
  is a comparison display, `applyServiceResults` discards it.

---
## A regression gate's scenario NAME is not evidence of what it tests (2026-08-16)

**Problem.** `baselines.locked.json` had a scenario called *"EMB-04 — Full Back (DECG-FB
pricing)"*. Full back was consolidated onto one Caspio source on 2026-08-15, the price moved on
**every** full-back surface, and all 22 locked scenarios passed unchanged. The gate whose entire
job is catching price drift sat green through a deliberate, repo-wide price change.

**Root cause.** `capture-pricing-baselines.js` branches on `inputs.location === 'Full Back'` and
prices it with `calculateDECGPrice(qty, stitches, 'garment')` — the customer-supplied **garment**
path (base + per-1K stitch upcharge). It has never called a full-back rate. The name said full
back; the code said DECG garment; nobody diffed the two. EMB-04 also sits at 15K, **below** the
25,000-stitch full-back minimum, so even a correctly-routed scenario there would have been
floored and insensitive to the rate.

**Fix.** Renamed EMB-04 to what it actually measures (its number is fine, the label lied) and
added **EMB-08**: an `isFullBackLadder` flag routing to `calculateALPrice(qty, stitches,
'fullback')`. 25K @ qty 24 puts both knobs in play — 25,000 is exactly ON the minimum, qty 24 is
the 24-47 tier ($1.30/1K) clear of the 1-7 fee. Baseline $32.50/pc, $780 line, LTM $0. Its price
is **decoration-only**, unlike every other EMB scenario, because that's what `calculateALPrice`
returns for a full back — noted in `SCENARIOS.md` so nobody "fixes" it later by adding a garment.

**Prevention.**
- 🔴 **A new gate is unproven until you make it fail.** After locking EMB-08 I reverted its
  values to the old flat $1.25/1K and confirmed it failed (+$1.25/pc, +$30/line), then restored.
  A green test proves nothing about a test that *cannot* go red.
- 🔴 **Re-lock surgically, never `cp captured.json locked.json`.** The documented re-lock step in
  `pricing-baselines.test.js` is a wholesale copy, which re-blesses all 23 scenarios against
  whatever Caspio holds today — any unrelated live drift gets silently adopted as the new truth.
  Insert only the changed keys and leave the rest with their original provenance.
- 🔑 **When a price change lands and the pricing gate does NOT move, that is the alarm.** Ask
  which scenario should have caught it and go read its runner — don't take the green as proof.
- 🔑 Same trap wherever a fixture is named after an intent instead of a code path. Check the
  runner, not the label.

---
## OnSite keeps an unknown PartNumber and throws every tax field away (2026-08-15)

**Problem.** Vendor garments (S&S et al.) push whatever style the rep typed as `PartNumber`.
Product lines are NOT gated by `KNOWN_FEE_PNS` — only fee lines are — so nobody knew whether
OnSite would reject, substitute or silently drop a part it had never seen.

**Root cause.** Never tested. The gate exists for fees; product parts were assumed safe.

**Solution.** Pushed a real TEST order and diffed our payload against OnSite's own transform
(`EMB-TEST-2026-315`).

**Prevention.**
- ✅ **An unknown PartNumber SURVIVES intact.** `SS-LIVE-CHECK` came back verbatim with
  `Color`, `Size`, `Qty`, `Price` and `id_ProductClass: 1` unchanged, and all 12 typed notes
  present. Vendor styles are safe to push; product lines need no allowlist.
- 🔴 **OnSite DISCARDS every tax field we send.** `TaxPartNumber`, `TaxPartDescription`,
  `coa_AccountSalesTax01` and the per-line `sts_EnableTax01..04` / `sts_TaxOverride` are ALL
  absent from the transform. That is why the payload carries "Apply Tax: Manually in
  ShopWorks" — the manual step is forced by OnSite, not a choice. Do NOT try to fix the tax
  push by sending more fields; they get dropped too.
- 🔑 `Attachments` / `Designs` / `Payments` are dropped when empty; `"30"`→`30` and `\n`→`\r`
  are normalised; OnSite ADDS `id_Integration: "200"` + `id_Receiving/Sales/ShippingStatus`.
- 🔑 **Upload ≠ order.** The push returns `'ExtOrderID … has been uploaded.'` while
  `GET /api/manageorders/getorderno/{id}` stays **count 0** — it queues for import, and the
  proforma prints "Order # — (pending import)". An empty order number straight after a push is
  EXPECTED, not a failure. Don't debug it.
- 🔑 A **manual** vendor item has no `VendorCode`, so the "VENDOR: …" `LineItemNotes` never
  fires — deliberate (Erik). The vendor rides in the rep's DESCRIPTION, which OnSite keeps.

---
## Five prices for one ShopWorks part — and a $50 fee hidden behind a misspelled column (2026-08-15)

**Problem.** Full-back embroidery had **five** price sources across **three** Caspio tables, so what
a customer paid depended on *which screen the rep used*, not on the job. At 25K stitches / 12 pcs:
the staff reference page said **$25.00/pc**, the quote builder charged **$31.25**, and the retail
rows nobody read said **$35.00**. The page was even titled "Full Back Embroidery — **DECG-FB**"
while rendering **CTR-FB contract/wholesale** numbers, and its own banner claimed "same rate
applies whether wholesale, NWCA-supplied, or customer-supplied" — false in code, three ways.
Full-back LTM was simultaneously **$50** (reference page), **$100** (contract calculator) and
**$0** (quote builder). **No test anywhere pinned any of it.**

**Root cause.** Each surface was built at a different time and read whichever endpoint it already
had open. Nobody ever asked "how many ItemTypes does one ShopWorks part need?" — the answer was
always one: OnSite has exactly one full-back part, `DECG-FB`, and `FEE_PN_ALIASES` already mapped
`FB → DECG-FB`. The *part* was unified years ago; only the *pricing* forked.

**Solution.** One ladder — `Embroidery_Costs` where `ItemType='DECG-FB'` — read once by a shared
`getFullBackLadder()` and served into all three endpoints' `.fullBack` blocks under their existing
key names. `CTR-FB` and `FB` rows retired. Erik's ruling: one rate for everyone, contract included.

**Prevention.**
- 🔑 **One ShopWorks part should mean one price ladder.** When a part number is universal but the
  price isn't, that asymmetry IS the bug. Use `KNOWN_FEE_PNS` / `FEE_PN_ALIASES` as the map of what
  ought to be unified.
- 🔴 **`LTM`, not `LTM_Fee`.** `Embroidery_Costs` has no `LTM_Fee` column. Reading it returned
  `undefined`, so the fee silently became `0` — and the $50 the DECG garment/cap paths *appeared*
  to charge came from a hardcoded default that happened to match. **Editing that fee in Caspio did
  nothing, on already-shipped pricing.** A fallback that matches the real value hides a dead read
  indefinitely; verify against the raw row, not against the rendered number.
- 🔴 **`PerThousandRate` is NULL on the DECG-FB rows — the rate is in `EmbroideryCost`.** The
  contract path *prefers* `PerThousandRate`, so a shared helper that inherited that preference
  would have priced every full back at **$0**. When consolidating readers, check the columns are
  actually populated on the rows you're consolidating *onto*.
- 🔴 **A cached object handed out by reference gets decorated by its callers.** Each endpoint added
  its own back-compat key (`perThousandRates` / `ratePerThousand`) to the shared ladder, which
  leaked into every other response through the cache. Return a copy from any cached-price getter.
- 🔑 **"Min charge $20" was a hardcoded `|| 20.00` in four files, presented to staff as policy.**
  No Caspio column ever fed it. It was also inert — the cheapest cell equalled it exactly. Deleted
  rather than wired up: under the new ladder the cheapest full back is $30, so it could never fire.
  **Before building a knob, check whether it can ever move.**
- ⚠️ **Dead renderers keep myths alive.** Three full-back matrix builders (127 lines) had lost their
  target divs and rendered nothing — but one carried the comment *"DECG Full Back uses same pricing
  (DECG-FB)"*, which is where the whole misconception came from. Delete dead code or it keeps
  teaching.
- 🔑 **A per-design negotiated price is an override, not drift** — keep it, but LABEL it, or the
  line just looks like the published table is wrong and the rep can't explain the number.

**Retired rows — recovery values** (captured live 2026-08-15, before deletion; the endpoints no
longer expose them, so this is the only record). Both sets are safe to delete: the two queries that
still SELECT them ignore the results, and each query still returns its other ItemTypes so the
"no records → 404" guards cannot trip.
- `Embroidery_Costs` `ItemType='CTR-FB'` — 5 rows, `EmbroideryCostID` **163-167**, `StitchCount`
  25000, `BaseStitchCount` 25000, `StitchIncrement` 1000, `DigitizingFee` 100,
  `LogoPositions` "Full Back", `LTM` 50 on the 1-7 row / 0 on the rest. Per `TierLabel`:

  | Tier | `EmbroideryCost` (25K total) | `AdditionalStitchRate` |
  |---|---|---|
  | 1-7 | 30.0000 | 1.2 |
  | 8-23 | 25.0000 | 1.0 |
  | 24-47 | 22.5000 | 0.9 |
  | 48-71 | 21.2500 | 0.85 |
  | 72+ | 20.0000 | 0.8 |

  🔑 **`PerThousandRate` is BLANK on these rows** — the $/1K the API served was DERIVED
  (`EmbroideryCost / (StitchCount/1000)`, `pricing.js`), i.e. 30 ÷ 25 = 1.20. Restoring the
  per-1K figure into `PerThousandRate` would NOT reproduce these rows; write `EmbroideryCost`.
- `Embroidery_Costs` `ItemType='FB'` — flat **1.25** /1K in `EmbroideryCost`, `BaseStitchCount` 25000.
- ⚠️ Do NOT delete `CTR-Garmt`, `CTR-Cap`, `AL`, `AL-CAP`, `CB`, `CS` — live pricing depends on them.
- 🔴 **Filter `ItemType` with EQUALS, never CONTAINS.** "FB" as a contains-match also selects
  `CTR-FB` and — fatally — `DECG-FB`, which is the master full-back ladder every surface reads.

---

## A dashboard promised cost-plus pricing the builder could not read (2026-08-14)

**Problem.** The staff Product Manager has offered **"Automatic (cost ÷ margin + logo — same as
SanMar)"** since 2026-07-06 (`PricingMethod: 'Margin'`, `DefaultSellPrice: 0`). A product created
that way **could not be quoted at all**: `populateNonSanmarRow()` did
`row.dataset.sellPrice = product.DefaultSellPrice || 0` → the string `'0'` → a ⚠ $0.00 price cell
→ the save gate refused the quote. The rep saw a zero and no explanation. Reps were instead
hand-computing a decorated price for every S&S Activewear garment (~5% of orders), so the margin,
tier, embroidery cost, size upcharges and LTM were all bypassed and nobody could see whether the
number was right.

**Root cause.** Two halves of one feature were built a month apart against no shared contract.
The dashboard wrote a *mode*; the builder only ever read a *price*. `PricingMethod` had also
drifted to **three spellings** in live data — `'FIXED'` (builder modal + proxy seed),
`'FixedPrice'` and `'Margin'` (dashboard) — with older rows blank, so there was no single value a
naïve reader could test for.

**Solution.** `resolveNonSanmarPricingMode()` in `quote-builder-utils.js` reads all three
spellings tolerantly (and infers from whichever of cost/sell is > 0 when blank); writers now emit
only the canonical two. The price itself comes from `buildSyntheticSizePricing()`
(`embroidery-quote-pricing.js`), which builds a **`/api/size-pricing`-shaped payload** from the
rep's blank cost — because that endpoint never returned prices, only SanMar's raw `CASE_PRICE`
plus the upcharge ladder. The formula is untouched; only its input differs.

**Prevention.**
- 🔑 **`/api/size-pricing` returns COST, not price.** The engine does
  `cost / marginDenominator + embCost → round → + upcharge`. Feed it a synthesized payload and a
  non-SanMar garment prices identically to a SanMar one — **one new input shape, no 4th pricing
  path** (Rule 9). `tests/unit/emb-nonsanmar-costplus.test.js` asserts *byte-identical* lineItems
  between the two; point reviewers there rather than re-arguing it.
- 🔴 **Do NOT seed `sizePricingCache` to do this.** It is keyed by bare style, **never cleared**,
  and shared with `getProductSizePrices()` — a seeded entry is a permanent page-lifetime shadow
  over a real SanMar style, and vendor styles demonstrably drift into SanMar
  (`non-sanmar-products.js` documents six that had to be deleted for exactly that). Passing the
  cost on the product object has no shared state, so there is nothing to invalidate.
- 🔑 **Anchor sizes are load-bearing, not clutter.** The garment path computes upcharges
  *relative* to its chosen base size; the cap path adds them *absolutely*. Injecting S/M/L/XL
  (garments) / OSFA (caps) pins the base to a zero-upcharge size so relative ≡ absolute and
  neither path needs a branch. They never emit a line (the loop iterates `sizeBreakdown`, not
  `basePrices`) — delete them and a 2XL/3XL-only order silently loses its upcharge.
- 🔴 **`quote_items.SizeBreakdown` is an ALLOWLIST, not a bag.** `buildProductLines()` filters a
  short list of known metadata keys and treats **every other key as a SIZE** — a stray `vendor`
  key would ship a LinesOE line with `Size:"SSA"`, `Qty:"SSA"` and a real Price. Per-item
  metadata goes in `LogoSpecs` (already JSON, 60 KB `LONG_FIELDS`). `heavyweight` was already
  being written and was NOT in that filter; it survived only because customer-supplied items route
  to `buildServiceLine()`. Added it to the list — one refactor and it would have been a live bug.
- 🔴 **`saveQuote()` and `updateQuote()` are byte-identical duplicates.** Patch one and every
  *revision* silently drops the new field, while reload masks it by re-reading Caspio. Both, always.
- 🔑 **A search-result cache can defeat a source guard.** `showSearchSuggestions()` wrote every
  autocomplete hit into `embState.productCache`, which `_lookupStyleProduct()` checks **before**
  the API — so a cached vendor row would have sailed past the `source: 'non-sanmar'` check. Fixing
  the API alone was not enough.
- ⚠️ **Making a style findable can break the path that handled it.** Once `/api/stylesearch`
  returned vendor styles, `_lookupStyleProduct()` started *succeeding*, sending the row down the
  SanMar branch (`/api/product-colors` → empty) and never reaching `populateNonSanmarRow()`. The
  proxy and builder changes must ship as ONE unit.
- 🔑 **A free-text code column plus an exact-match filter is a reporting trap.**
  `GET /api/non-sanmar-products?vendor=` compares uppercase-exact, so "S&S" / "SS" / "SSA" typed
  by three reps split the vendor forever. Curated `<select>` + an `Other…` escape; the two copies
  (builder + dashboard) are drift-locked by a test.

---

## Ruth's "Final notes" box saved her words and told nobody (2026-08-14)

**Problem.** Porting the Approve-note box from the art-request page to the mockup page
(`pages/js/mockup-detail.js`, Ruth's digitizing surface, route `/mockup/:id`) surfaced a
live bug beside it: `openMarkCompleteModal()` collects a "Final notes (optional)" textarea
and posts it with **`notify: false`**, so anything Ruth typed on completion was stored in
Caspio and reached no one. The AE got only the fixed one-liner from `sendStatusNotifications`.

**Root cause.** `notify: false` was a correct default for *audit* notes (status rows the
timeline scanner needs) and was copy-pasted onto a note that carries **user-authored text**.
Those are different things wearing the same shape.

**Solution.** `notify: !!notesText` + explicit `Posted_By_Role`. Blank note = today's exact
behaviour; typed note = the other party actually gets it.

**Prevention.**
- 🔑 **`notify: false` is right for a note the system wrote and wrong for a note a human
  wrote.** Audit the distinction wherever both share a POST body — there are 10 `notify:`
  sites in `mockup-detail.js` alone, and the free-text ones are the minority.
- 🔑 **Routing direction: `Posted_By_Role: 'ae'` → Ruth (`mockup-routes.js:1489`); `'artist'`
  → the rep of record.** Omitting it falls through to an author-NAME heuristic
  (`['ruth','digitiz',…]`, :1477) — right today, fragile forever. Set it explicitly.
  Same contract as `/api/design-notes` on the art-request side; only the field names differ
  (`Mockup_ID`/`Author`/snake_case `Note_Type` vs `ID_Design`/`Note_By`).
- 🔑 **To add opt-in notify to a function shared by N callers, add a trailing parameter that
  defaults to the old behaviour** — `handleStatusUpdate(status, notes, btnEl, notifyNote)`
  has 4 callers; only Approve passes the 4th, so the other three are provably unchanged.
- ⚠️ **This page's approve had NO `confirm()` to replace**, unlike the art-request one — so
  the modal ADDS a click rather than swapping one. Worth saying out loud before shipping a
  "same as the other page" change; the two are not the same UX delta.
- ⚠️ `openReviseModal()` re-`addEventListener`s its cancel/submit on every open and never
  removes them; `statusUpdateInProgress` masks the duplicate status write but **the
  file-upload branch is unguarded, so a re-opened revise modal uploads twice.** Not fixed.
  New modals here use `.onclick =`, which is idempotent.

---

## `table-layout: fixed` reads widths from the FIRST ROW, not from your `<th>` classes (2026-08-13)

**Problem.** The new per-rep Past Due print sheets came out with all 8 columns an identical
90 px despite explicit per-column width classes on the `<th>`. Customer names wrapped to two
lines, which nearly doubled sheet height (Nika: 9.7 in of a 10 in page for 23 rows).

**Root cause.** Under `table-layout: fixed` the browser derives every column width from the
**first row of the table** and ignores later rows. The first row here was the repeating rep
banner — `<tr><th colspan="8">` — which expresses no per-column width, so the engine fell back
to equal division. The width classes on the third row were never consulted.

**Solution.** Move the widths onto a `<colgroup>` / `<col>` set. `<colgroup>` outranks all rows
under fixed layout, so it works regardless of what the first row looks like.

**Prevention.**
- 🔑 **`table-layout: fixed` + any `colspan` in the first row ⇒ you MUST use `<colgroup>`.** This
  is the normal shape for a print table, because the repeating `<thead>` banner that carries the
  rep/customer name onto spilled pages is itself a full-width `colspan` row.
- 🔑 **A repeating identity row belongs in `<thead>`, not in an `<h*>` above the table.** Only
  `thead { display: table-header-group }` reprints on the next physical page. The old printout
  put the rep name in an `<h3>`, which is exactly why page 3 of Erik's 8/13 PDF was an orphan
  list belonging to nobody.
- 🔑 **Verify print layout by MEASURING, not by eyeballing.** `getBoundingClientRect()` per cell
  plus `Range.getClientRects().length` for line count found this in one pass; the rendered page
  looked plausible. Careful: an inline-block (the days-late badge) reports 2 rects without
  wrapping, so line-count alone false-positives.
- 🔴 **Harness trap:** the sheet's typography is scoped to `#pdo-print-sheet`. Cloning its
  *innerHTML* into a differently-id'd preview div silently drops every rule and renders at
  browser-default 16 px — the first measurements were 2× too tall and entirely fictional. Move
  the real node, or reuse the real id.

### The print-isolation rule also hides disclosures that used to print

Shipping this, a pre-deploy review caught what the isolation rule
`body.pdo-printing > *:not(#pdo-print-sheet) { display: none }` costs. The OLD printout
carried "30-day window · 475 orders scanned" because `#pdo-asof` sits in `<main>`, not in the
hidden `.dash-header-right`. Hiding the whole shell removed it — so a 30-day sheet read as a
rep's *complete* past-due list while silently omitting the oldest orders, the ones most needing
action. Fixed by stamping the window + print time on every rep sheet.

- 🔑 **When you replace a whole-page print with an isolated sheet, diff what the old print
  DISCLOSED, not just how it looked.** Scope/as-of/provenance lines are the easiest to lose and
  the most expensive to lose, because the artifact leaves the building and states a count.
- 🔑 **A handout needs a freshness gate, not just a data gate.** `!lastData` is not enough:
  the page is opened at 7:40 and printed at 8:05, and a 25-minute-old list still prints
  *today's* date, so nothing on paper reveals its age. Re-pull past a bound (120 s here) and
  ABORT the print if the re-pull fails — same call `sanmar-inbound-today.js:syncBeforeOutput`
  makes. Riding the upstream cache keeps it ~free on Caspio quota.
- 🔑 **Scoping every print rule to a class the button sets regresses Ctrl+P**, which then falls
  back to the raw board. Handle `beforeprint` so a keyboard print builds the same sheet, and
  keep a `body:not(.printing)` fallback for when there is no data to build from.

---

---

## Never forward a Content-Length you did not measure (2026-08-12)

**Problem.** Steve's "Send to Supacolor" picker answered searches with `Unterminated string in
JSON at position 476` — the browser was told the response was shorter than it was and stopped
mid-string. `/api/box/folder-files` broke the same way for folders of 5–27 files: **8 of 16 real
art folders sampled**. Live 7 days (2026-08-05→12); fixed app `v2026.08.12.1` + proxy same day.

**Root cause.** `boxForward` copied `content-length` from upstream then piped the body, but
**node-fetch asks for gzip and inflates transparently** — so the header described the COMPRESSED
bytes while the pipe sent decompressed ones. `content-encoding` was correctly NOT copied, which is
what made the length a *lie* rather than a detectable mismatch.

**Why it looked intermittent — a BAND, not a threshold.** Corruption needs uncompressed ≥ 1024 (so
the proxy gzips) AND gzip < 1024 (so our own `compression()` declines to re-compress and leaves
the bogus header). Below the band the proxy sends plaintext; above it `compression()` strips the
header and goes chunked — accidentally correct. **Small is safe by being small, huge by being
huge, and every picker lives in the broken middle.** Search caps at `limit=20`, so it could never
reach the size that recovers: 14+ hits always failed, ≤13 always worked.

**Solution.** Stop copying `content-length` in `boxForward`, `boxForwardWrite` and the proxy's `jotform.js`; let Node frame the response.

**Prevention.**
- 🔑 **Do NOT gate the copy on `content-encoding` being absent.** That works for
  node-fetch/undici, but **axios DELETES that header after inflating while keeping the stale
  length** (measured: 47 on a 3008-byte stream), so the conditional form is unwritable in the
  proxy. Portable rule: **only ever set a length you computed from the bytes you are about to
  write.** Sweep: 5 `.pipe(res)` sites across both repos, these two the only offenders.
- 🔑 **The obvious source-grep lock is VACUOUS.**
  `not.toContain("upstream.headers.get('content-length')")` would have been GREEN all week — that
  literal never existed; the code reads `.get(h)` in a loop. Both tests instead PARSE the real
  array/handler out of source and drive it through a live HTTP round trip.
- 🔑 **An express+`compression()` upstream CANNOT reproduce this** — it removes Content-Length
  when it gzips, so the harness passes against the bug. Use a raw `http.createServer` writing
  `Content-Encoding: gzip` AND a gzip-sized `Content-Length` by hand.
- 🔑 **Test the BAND** — one small + one large payload both pass while broken. Assert the
  predicate and guard that the sizes straddle it.
- ⚠️ Worse than truncation: with keep-alive the surplus bytes are parsed as the next response and
  the connection desynchronises (`HPE_INVALID_CONSTANT`).
- ⚠️ `application/octet-stream` is compressible in the app's mime-db 1.54.0 but not the proxy's
  1.52.0 — a routine proxy `npm install` would have started **silently corrupting small `.DST`
  downloads** (a bad stitch file, not a visible error). Closed permanently by the same change.
- ⚠️ `git blame` misleads: the loop arrived in `76b6aa85`, a commit about content-hashed caching.
- Locked by `box-forward-content-length.test.js` + `jotform-file-content-length.test.js`, both
  verified to go red when the bug is reintroduced.

---

---

## A prefix gate covers its prefix and nothing beside it; Origin is not auth (2026-08-11)

**Problem.** `GET /api/mockup-notes/:id` and `GET /api/mockup-versions/:id` answered a bare
anonymous curl with AE note text, author emails, thread colours and Box file ids. Separately,
`curl -H 'Origin: https://www.teamnwca.com'` returned `Company_Name`, `Id_Customer`,
`Work_Order_Number` and `AE_Notes` — 500 rows a time from the list route.

**Root cause.** Two different holes wearing one costume. `src/routes/mockup-routes.js` is ONE
router serving FOUR PII prefixes, and the 2026-07-04 fix gated `app.use('/api/mockups', …)` —
a path-prefix gate, so the three sibling prefixes were never covered. And the gate it did have
was `secret-OR-browser-Origin`, which accepts a header the caller supplies.

**Solution.** Every prefix gated, reads secret-only, with an app-side session-gated forwarder
(`mockupForward`) so browsers authenticate by SAML cookie and only the server holds the secret.
`guardReadsOnly` throughout — the customer approval view writes these same paths with no staff
session. Locked in both repos; the app-side test greps browser JS for cross-origin GETs.

**Prevention.**
- 🔑 **A prefix gate secures exactly its prefix.** Ask what OTHER prefixes the router serves —
  derive the list from the router source in a test, so a new prefix fails until someone makes an
  auth decision about it. Third time this shape has bitten (four gated sub-prefixes on `/api`,
  the Box family, now this).
- 🔴 **`Origin` is a CSRF signal, never an authentication one.** It is caller-controlled: one
  curl flag impersonates any allowlisted browser. "secret-or-origin" reads like defence in depth
  and is really just "or".
- 🔑 **Check the sibling that looks like plumbing.** `mockup-notifications` looked like transient
  toast machinery; each entry carries `companyName` + `designNumber`, and it filters by `?user=`
  only when that param is *supplied*, so an anonymous poll with no user returned everything. It
  is in-memory and usually empty, which is exactly why it read as harmless.
- 🔴 **Gating reads changes who can still call it server-side.** `send-ruth-digest.js` scans via
  `localhost/api/mockups/broken-mockups` — loopback still goes through Express, so without the
  secret the nightly digest 401s and reports *nothing broken*. Grep for internal callers,
  including ones that look local.
- 🔑 **Moving a call same-origin moves it under the app's rate limiter.** These reads bypassed the
  200-req/15-min `/api/` bucket while they were cross-origin; a 30 s notification poll now counts
  against a ceiling the whole office shares behind one egress IP.
- 🔑 **A content-hashed page serves `dist/`, not your edit** — art-hub-ruth kept calling the proxy
  after the fix because the browser had `mockup-ruth.c1a6c72b6a.js`. Run `npm run build` and
  confirm the HASH changed before believing a dashboard behaves the old way.
- 🔑 **`EADDRINUSE` means you just tested the OLD code.** A restart that silently failed to bind
  left the previous process serving, and the first "verification" showed the pre-fix behaviour.
  Read the startup log, not just the response.

---

---

## An ungated shell over gated assets tells the user the wrong story (2026-08-11)

**Problem.** Ruth: "I can't see any images, the screen is completely dark." Her mockup detail page
showed a black overlay reading *"Image could not be loaded — link may have expired"*, a red
*"Failed to load Box files"*, and an anonymous `IMG` badge — while Ruth's Fields, the notes and the
slots all rendered perfectly. Nothing was broken and no link had expired: **she was signed out.**

**Root cause.** Two halves of the same page authenticate differently. The record, notes and versions
load **anonymously** from the proxy (`mockup-detail.js:336-352`), so the page renders fully. Every
Box asset goes through the app's same-origin forwarders (`server.js:3809-3817`), all `requireStaff`,
so all of them 401. And `/mockup/:id` (`server.js:5192`) was registered with **no gate at all** —
unlike `/art-hub-ruth.html` five lines above it — so she was never bounced to SSO. The staff session
is `cookie-session` with **no `maxAge`** (`server.js:786-792`): it dies when the browser closes, so
this is reached routinely, not after some long idle. "Expired" was impossible by construction.

**Solution.** `gateStaffDetailPage` on `/mockup/:id` and `/art-request/:designId`, exempting
`?view=customer` (external approval links carry their own capability token and cannot complete staff
SSO). Client side, `mockup-detail.js` now branches on the real HTTP status — 401 → "You're signed
out" + a `/auth/saml/login?next=…` link in both a page banner and the lightbox label; 502/503 →
"Box service is temporarily unavailable". An `<img>` error carries no status, so the lightbox
HEAD-probes to recover one. Locked by `tests/unit/detail-page-gate.test.js`.

**Prevention.**
- 🔑 **If a page's shell and its assets have different auth requirements, the weaker one sets what
  the user sees.** Anonymous data + gated images = a page that looks healthy and is useless. Gate
  the shell at the same level as its most-protected dependency, or the failure is silent.
- 🔴 **Never let an error string assert a cause the code cannot know.** An `<img>` error event has
  no status, so "link may have expired" was a guess — and it was wrong in the common case, sending
  the diagnosis toward Box and expiry instead of toward a missing cookie. Probe for the status, or
  say only what you know.
- 🔑 **A 401 that renders as a generic broken-file badge is unactionable.** `handleBoxImageError()`
  branched on 404 only; every other status fell to the same anonymous placeholder. The page had
  **zero** references to `401`, `loginUrl` or `auth/saml` — nothing to click.
- 🔑 **"Only one person is affected" can mean "only one person is signed out."** These routes gate on
  session *presence*, not role, so no registry/allowlist entry could have caused it — which ruled
  out the whole `Ruthie`-vs-`ruth@` family of causes before any code was read.
- 🔑 **Verify a suspected auth hole with a CLEAN client.** A browser fetch returned 200 for a Box
  endpoint while `/api/crm-session/me` said `authenticated:false` — which looked exactly like an
  anonymous data leak. It was `Cache-Control: private, max-age=300` replaying the earlier
  authenticated response. `curl` with no cookie returned 401 and killed the false positive.
- 🔑 **`/api/crm-session/me` is the cheap "are you actually signed in?" test** — 200 either way, safe
  to paste into the address bar, no redirect. Reach for it before theorising.

---

---

## A new lead source saved fine and stayed invisible — the form-ID vocabulary lives in 12 places (2026-08-10)

**Problem.** A customer's free sample request (`NWCA-SAMPLE-0808-1-480`, Inland Beef Company)
reached Erik's inbox and nowhere else. Erik: "shouldn't it be in Leads so Taneisha can follow up?"

**Root cause.** The free branch of `/sample-cart.html` pushed a ShopWorks order and fired two
EmailJS sends — and wrote **no database row at all**. Leads reads exactly one table
(`Form_Submissions`) filtered to a hard-coded list of lead `Form_ID`s, and the cart called neither
of that table's writers. The dashboard's "Sample Follow-ups" widget *looks* like the safety net but
filters on `date_Invoiced`, so it can only show samples already invoiced — a post-sale call
list, not an inbox. No dashboard surface reads uninvoiced ShopWorks orders at all.

**Solution.** New `sample-request` formId, POSTed from the cart to the already-public
`POST /api/form-submissions` — which buys AE auto-assign (email match → their rep, else
Taneisha), the "new lead" email and the Slack card for free. Full site list + fix detail:
`memory/sample-request-routing.md`.

**Prevention.**
- 🔑 **The lead form-ID vocabulary is duplicated in 12 places across 2 repos.** Adding a
  source means updating all of them; miss one and the row saves but stays invisible.
- 🔴 **A missing map entry becomes a WRONG DEFAULT, not an error.** No `STATUS_CHOICES`
  entry → the Forms Inbox falls back to `['New','Completed']`, and `Completed` is a **WON**
  status (`leads-common.js:40,50`) → closing the lead banks a $0 win and drops it from the
  follow-up digest. Same family as `[]`-is-truthy and `Number(null) === 0`.
- 🔑 **Derive a filter list from the canonical constant, never re-type it.** `leads.js`
  built its Source dropdown from a literal that *happened* to equal `LEAD_FORM_IDS` minus
  `jotform-lead`; the 6th id broke that invariant silently.
- 🔑 **A payload only "saves" if a renderer knows its shape.** The Inbox renders only
  `fields`/`checks`/`tables`/`notes` — a bespoke object stores fine and shows a blank modal.
- 🔴 **`House` is a dropdown DEFAULT, not a rep.** Sending it satisfies the server's
  "rep already set" check, suppresses auto-assign and leaves the lead owned by nobody — the
  exact failure the change existed to prevent. Send blank and let the server assign.
- 🔑 **A content-hashed page serves `dist/`, not your file.** The preview runs
  `node server.js` (no `prestart`), so the browser executed a stale asset and the new function read
  as `undefined` — indistinguishable from a scope bug. Run `npm run build`, then confirm the
  asset HASH changed.
- ⚠️ 3 of the 4 review defects were on STAFF surfaces the customer path never touches:
  the customer flow was right on the first pass, the staff rendering was not.

---

## A sum-based gate passes vacuously on a document that has no sums (2026-08-10)

**Problem.** Erik uploaded the one-page "Available Vacation And Sick Time" report to the payroll
uploader. It read fine — 21 employees — and the reconciliation gate returned **`passed=true`**,
enabling *Save to payroll records*. Saving would have written 21 `Payroll_Register` rows with every
hour and wage 0, `Paid_This_Period=false`, under a check date the model had to guess: a pay period
that never happened, permanently in the Pay Periods tab.

**Root cause.** `reconcile()` ran 7 checks, 4 of them money/count (gross, net, deductions, check
count). A leave-only page prints none of those. The extraction schema marked them `required`, so the
model returned 0; the gate compared **0 to 0** and called it a match. The gate reported success having
verified nothing. Only the 3 vacation checks did real work.

**Solution.** An explicit `mode` on `POST /parse` — `'packet'` or `'leave'`, rejected if it is
anything else, never inferred. Leave mode uses its own schema (no money field exists to zero out),
its own prompt, and `reconcileLeave()`, which checks all six leave columns against the report's own
`Total:` row. Leave mode writes only the `Employees` leave columns — no register row, no `Pay`.
`tests/jest/payroll-leave-reconcile.test.js` locks it with the real 21-row page.

**Prevention.**
- 🔑 **A gate that compares derived to printed is only as strong as the printed side being NON-ZERO.**
  Assert the reference values exist before trusting the verdict. `expect(checks.every(c => c.printed
  !== 0))` is the whole lesson in one line.
- 🔑 **"Required field" + "figure isn't on the page" = a fabricated zero.** A schema cannot ask for
  something that isn't there and get an honest answer; it gets a plausible one that then sails through
  arithmetic. Give each document shape its own schema instead of one superset.
- 🔑 **Never infer which document you were handed — make the caller declare it.** Auto-detection here
  would have had to fail *safe*, and the failure mode of guessing "packet" is exactly the vacuous gate.
- 🔑 **A sum-based check is invariant to row permutation.** On a skewed photo the totals can reconcile
  while every individual row is attributed to the wrong person. Totals matching is necessary, not
  sufficient — the prompt now tells the reader to verify alignment against the ID column.
- 🔑 **Erik's "16 vacation hours" was real and the import would have contradicted it.** The report
  prints `Hrs Avail.` as a column; the importer recomputed it as accrued − used. Those differ whenever
  the report floors an over-drawn balance at zero (Taneisha Clark: 0 accrued, 16 used, printed 0, not
  −16) — the entire 16-hour gap between the 1112/796 and 332 totals. **Save the printed column, don't
  re-derive it.** Erik, asked directly 2026-08-10: *"exactly what Liesls payroll packet says"* —
  **both** paths now save it.
- 🔑 **"It's already validated" is worth one grep.** Extending the printed-column rule to the packet
  path looked like a two-line edit because `reconcile()` checks `Vacation available`. It has **no sick
  check at all** — `PACKET_SCHEMA.printedTotals` carried only vacation, so all three sick figures had
  been reaching `Employees` unverified since the uploader shipped. Saving the printed sick column
  without fixing that would have traded a derived-but-consistent number for an unchecked one. The
  packet gate went from 7 checks to 10.
- 🔴 **Changing what a column MEANS silently broke a feature two files away — and my algebra said it
  hadn't.** `vacation-carryover.js` guarded its blocking `identity-failed` flag with *"the import
  writes Vacation_Hours_Remaining as exactly r2(accrued − used), so this check is a tautology"*.
  Switching to the printed column made that false. I reasoned it through and concluded no NEW block
  appears, because a floored row already fails `E − U` vs `A − U` **when `A < E`**. That qualifier was
  the whole problem: a new hire short of their anniversary has the entitlement forced to **0**, so
  `A = E = 0`, the carryover clamp is **inert**, and the old check passed *exactly* (−16 vs −16).
  Taneisha's slip printed before the change and was blocked after it. **Erik caught it by asking
  "will the print still work" — nothing in 1490 passing tests did.**
- 🔑 **When you change an invariant, RUN the dependent code over real rows — don't reason about it.**
  The module was already Node-requireable with 63 tests; a 20-line script over the actual figures,
  old value vs new, showed `printable: true → false` in one line. Algebra with an unexamined case
  reads exactly like algebra without one.
- 🔑 **A relaxed check needs the narrow shape, not a looser threshold.** The fix splits the one
  comparison into the entitlement algebra (`slip.accrued − slip.used` vs `available − used`) and the
  import's self-consistency (`remaining` vs `available − used`), and exempts ONLY over-drawn-and-
  printed-as-exactly-zero. Both original guards still block — including `remaining: 999` and a
  `remaining: 0` on a row that is not over-drawn, which a sloppier exemption would have waved through.
- 🔑 **A QA harness must cache-bust the files it is testing.** The browser served a stale
  `vacation-carryover.js` and the harness confidently showed the OLD blocked slip after the fix was
  already on disk. A harness that can show you yesterday's build is worse than no harness.

---

---

## Two note endpoints write the same table; only one of them tells anybody (2026-08-07)

**Problem.** The AE "Approve Design" button on `/art-request/:id?view=ae` fired a native
`confirm()` and collected no free text, so anything the AE wanted Steve to know had to go
through a separate `+ Add Note` afterwards. Adding an optional note box meant picking a
route for it.

**Root cause / the trap.** The page has TWO note endpoints that look interchangeable and
are not:
- `POST /api/art-requests/:designId/note` (proxy `src/routes/art.js:1436`) — writes
  `DesignNotes`, **no fan-out, and no length validation at all**.
- `POST /api/design-notes` (`art.js:760`) — writes the **same table with the same fields**,
  plus direction-aware Slack + email. `Posted_By_Role:'ae'` routes the primary email to
  Steve at `art@nwcustomapparel.com`; `notify:false` short-circuits the whole fan-out
  before any lookup.

So `/api/design-notes` is a strict **superset** — swapping to it is one row, not two. The
tempting wrong move is to keep the thin call and *add* a design-notes call for the Slack
ping; that duplicates the timeline row.

**Solution.** Swap the approve step to `/api/design-notes` with `notify: !!typedNote`, so a
blank note behaves byte-identically to before (Steve still gets `template_art_completed`
+ the dashboard push, and gains no third ping) and a typed note reaches him.

**Prevention.**
- 🔑 **Before adding a second call to get a side effect, check whether the endpoint you are
  already calling has a superset sibling.** Two routes writing one Caspio table is the norm
  in this repo, not the exception.
- 🔴 **The status write commits BEFORE the note write and is never rolled back.** A rejected
  note leaves the record `Approved` in Caspio while the UI shows "Error — retry", and a
  retry re-fires the status write, the note, the EmailJS to Steve and the dashboard push.
  Free text is the first input that can realistically trigger it — hence `maxlength="2000"`
  on the textarea *plus* a JS length guard (maxlength does not apply to a programmatic
  `.value` set).
- 🔑 **`approveDesign()` never called `refreshNotes()`.** Tolerable for an auto-generated
  status line, invisible-looking for a note the user just typed. If a write is user-authored,
  the surface that displays it must refresh in the same success block.
- 🔑 **`.onclick =` beats `cloneNode`/`replaceChild` for re-openable modals.** Property
  assignment is idempotent; the clone trick used by `openChangesModal()` also copies the
  reflected `disabled` attribute and `innerHTML`, so a modal closed mid-error reopens dead.
  `openCustomerReviseModal():4344` additionally leaks one overlay listener per open.
- 🔴 **A namespaced export reads like a global at the call site — and the ReferenceError
  landed INSIDE a `.catch()`, so it soft-locked the modal (FIXED 2026-08-07).** Three sites in
  `pages/js/art-request-detail.js` called a bare `showToast(...)`. It is defined only as
  `window.TransferActions.showToast` (`transfer-actions-shared.js:593`, inside that file's
  IIFE), so a bare reference threw — proven at runtime: `TransferActions.showToast` is a
  `function` while `window.showToast` is `undefined` and `showToast` alone throws
  `ReferenceError`. Fixed by switching all three to the page's own `showArdToast()`.
  - 🔑 **The upload-failure one was in a `.catch()` handler, so the two lines AFTER it never
    ran** — `btn.disabled = false` and `btn.textContent = 'Submit Revision Request'`. A failed
    upload left Submit permanently disabled reading "Uploading N files…". Compounded by the
    `cloneNode` bug above: reopening the modal clones the *disabled* button, so the flow stayed
    dead. **An error handler that can itself throw converts a visible failure into a soft-lock.**
  - 🔑 The two size/count guards threw *before* their `return`, so they rejected the file by
    accident while aborting the caller's loop — remaining dropped files were silently skipped.
  - 🔑 **Prevention: prefer the page's own helper over one that "seems" global.** Grep for
    `function <name>` AND `window.<name>` before calling — a helper exported as
    `window.NS.<name>` is not in scope, and nothing in a browser fails at load time to tell you.

---

## Colour never changed the photo, and every existing check passed (2026-08-07)

**Problem.** On 253gear.com, choosing a colour did not change the product photo. A
shopper picking Charcoal was shown Athletic Heather and bought on that picture. Live on
**6 of the 7 multi-colour products**; on two of them the correct photo was already
uploaded and bound to nothing. Nobody reported it — Erik only asked how to *structure*
the product.

**Root cause.** Variants were bound to a photo by **Style alone**; Colour was never part
of the key. The audit asked only whether each variant had *an* image, which was true
throughout — so `variant_image_binding`, the headline check written after this defect
shipped twice before, passed cleanly on every affected product.

**Solution.** `scripts/253gear-align-media.js` + a declared `(Style|Colour) -> position`
map (`253gear-media-maps.json`). Two new audit checks in `src/utils/shopify-audit.js`:
`colour_image_distinct` (blocking — every pair resolves to its OWN photo) and
`orphan_media` (non-blocking — names uploaded-but-unbound photos and their position).

**Prevention.**
- 🔴 **"Every X has a Y" does not imply "every X has its OWN Y."** The reciprocal check is
  a different check. Whenever a binding is one-per-group, assert **distinctness**, not
  just presence — presence passes for the entire lifetime of the bug.
- 🔴 **Media ORDER is load-bearing.** The theme gives an **unbound** photo the options of
  the *nearest preceding bound* photo (`product-template.CURRENT.liquid:393-402`), so a
  lifestyle shot after the wrong flat-lay silently switches the shopper's colour on click.
  Calico's maroon lifestyle shot sat behind the charcoal tee and did exactly that. My own
  first instinct — "move lifestyle photos to the end" — would have *created* this bug on
  Spanaway; the theme code said otherwise.
- 🔴 **Never infer a binding from a filename.** Two of Spanaway's photos are named `34082`
  for design `34084`; the lifestyle files are stock names with no colour at all. Both
  Calico lifestyle shots had to be **opened and looked at** to learn their colour.
- 🔑 **A dry run that previews the wrong state is worse than none.** The first version
  validated against the *pre*-reorder gallery and printed bindings that were plainly
  wrong. Simulate every mutation in memory so the preview describes the state that will
  actually exist.
- 🔑 **Pick the statistic before trusting the data.** Taking the **max** of SanMar's
  `PIECE_WEIGHT` per size picked single outlier rows (hoodie L: 74 of 75 colourways say
  558 g, one says 567 g) and would have re-weighed **284 variants across 37 products**.
  The **mode** matched the catalogue on PC54 7/7 and PC78H 6/7. Check the distribution
  before writing, not after.
- 🔑 **`productReorderMedia` returns `UserError`, which has no `code` field** (unlike
  `MediaUserError`). Selecting it fails the whole query at parse time.
- 🔴 **A BAD GATE DOES NOT FAIL LOUDLY — IT REPORTS SUCCESS.** Both new checks shipped green
  and an adversarial review found **11 defects, 6 real**, in code I had just written and
  self-reviewed as safe. My own confirming pass called it "safe to deploy". Specifics worth
  keeping:
  - **`MediaImage` GID ≠ `ProductImage` GID** — two namespaces for one picture, so
    `media.id === variant.image.id` is NEVER true. Only the **normalised URL** joins them.
    (This bit me twice in one day: first in a script, then again in the audit check.)
  - **A check is only as good as the query feeding it.** `checkOrphanMedia` was inert on the
    publish gate because that query never selected `media { image { url } }` — it reported
    "no media to check" on products full of photos. Now drift-locked by a test.
  - **When a check cannot answer, it must SAY so** — never return a clean pass on data it
    never received.
  - **`byPair[k] = x` in a loop is last-write-wins.** It silently hid pairs whose sizes
    disagreed. Collect a Set when "these must all agree" is the actual invariant.
  - 🔑 Strip the CDN `?v=` before comparing image URLs — it differs between reads of one file.
- 🔴 **Shopify options are PRODUCT-level, so a colour listed is offered for EVERY style.** Four
  products sold "tee in one colour, hoodie in the other" while advertising all four pairs; the
  theme does no availability filtering, so half of each was **"Unavailable" with a dead Add to
  Cart**. Two fixes: recolour to one colour (Colour survives single-value and renders as static
  text), or **fold the colour into the Style value** ("T-Shirt - Royal") and delete the Colour
  option. Delete it with **`NON_DESTRUCTIVE`**, which refuses rather than deleting variants.
- 🔑 **Folding colour into Style silently breaks every config lookup** — price, weight, SKU and
  filter tag all key on the option string, and each tool **SKIPS an unknown style rather than
  erroring**, so the product drops out of coverage with nothing reporting it. `baseStyleOption()`
  resolves it, exact match first. ⚠️ It treats ANY `" - suffix"` as a colour, so
  `T-Shirt - Premium` would price as a plain tee — `align-prices` now names every style it
  resolved that way, because it is the one path that rewrites what a customer pays.
- 🔑 **`productDeleteMedia` does NOT delete the file.** It detaches the image; the file stays in
  Shopify Files, still `READY`, at a **different CDN url** (the `/products/` path, no attachment
  UUID) while the url the product was serving 404s. Recovery is a `files(query:)` lookup, not a
  re-upload — that turned a reshoot into five minutes.
- 🔑 **Only `productUpdate` and `publishablePublish` return a plain `UserError` with NO `code`
  field**; every other product mutation returns a typed error that has one. Selecting `code` on
  those two fails the whole query at parse time. **`productReorderMedia`'s canonical field is
  `mediaUserErrors`** — `userErrors` is a deprecated alias that can read empty while the real
  errors sit in the other, so select both.
- ⚠️ **A scripted edit to this repo can be silently reverted (OneDrive) — re-read before
  assuming it landed.** Two python-rewrite edits reported success and left the file unchanged;
  one produced a warning whose feeder set existed but whose print block was never inserted, so
  the warning could never fire. Verify the OUTPUT, not the edit's exit code.
- 🔑 **Backticks inside a JS template literal end the string** — a GraphQL `#` comment containing
  `` `userErrors` `` broke two files. No backticks in embedded GraphQL.
- 🔑 Verified on the **live storefront by clicking every thumbnail**, not in the admin —
  both prior binding incidents were invisible to the API. Set a distinctive size first:
  if a click moves Size, the image is bound to too few variants.

---

## Two Shopify shapes both use `name`, so every variant keyed to the same string (2026-08-07)

**Problem.** In the 253Gear Publisher build, `buildVariantMediaBindings()` produced a binding key
of the literal string `"season|||color"` for EVERY variant. Had it shipped, an entire product would
have bound to one image — or to none — which is exactly the defect that already hit 253gear.com
twice (644 variants after the tee/hoodie merge, then 7 Fall variants of #40749).

**Root cause.** Shopify uses the key `name` for two different things depending on direction:

    input  (ProductVariantSetInput):  { optionName: 'Style', name: 'T-Shirt' }   -> name is the VALUE
    output (variant.selectedOptions): { name: 'Style', value: 'T-Shirt' }        -> name is the OPTION

My helper did `found.name || found.value`, which is correct for the shape I SEND and silently
returns the option NAME for the shape Shopify RETURNS. Nothing throws; the keys just collapse.

**Solution.** Disambiguate on the presence of `optionName`, never on `name` — `optionValue()` in
`src/utils/shopify-product-builder.js` (caspio-pricing-proxy).

**Prevention.**
- 🔑 **Test against the shape the API RETURNS, not the shape you send.** The builder's own unit
  tests passed throughout — they exercised objects the builder had just constructed, which carried
  an internal `_key`. Only a fixture shaped like a real `productSet` response exposed it.
- 🔑 **A field name reused with two meanings is a silent-failure generator.** When an API round-trips
  through differently-shaped input and output types, write the collision down at the read site —
  a fallback chain like `a.x || a.y` will pick the wrong one and never complain.
- 🔑 **A key-building function deserves a test that two DIFFERENT inputs produce two different keys.**
  Asserting the happy path only would have passed here: every key was well-formed, just identical.

---

## A page size counted DESIGNS while the table stores design×LOCATION (2026-08-06)

**Problem.** After the artwork fix shipped, the SanMar inbound sheet still showed the 🎨 "no
logo" tile for 6 of 18 orders. Erik's read: "probably no thumbnail in ShopWorks yet." True for
2 of them; the other 4 had artwork the whole time.

**Root cause.** `proxy src/routes/thumbnails.js` `/thumbnails/by-designs` built its Caspio page
as `'q.limit': uncachedIds.length`. `Shopworks_Thumbnail_Report` is keyed
`Thumb_DesLocid_Design` — **one row per design PER LOCATION** — so 18 designs can match far more
than 18 rows. Caspio truncated the page, every design past the cut was reported `found:false`,
and that wrong answer was then cached for the 5-minute TTL. Rows arrive in serial order, so the
designs dropped were the NEWEST — exactly what an inbound sheet is made of, which is why it
looked like a bandit/ShopWorks sync lag. Fixed to `min(1000, ids × 25)`; live batch went 12 → 16
of 18 found, and the 2 remaining genuinely have no row.

**Prevention.**
- 🔑 **Size a page by the ROWS it can return, not the KEYS you asked for.** Any `q.limit` derived
  from an input count is wrong the moment the table is one-to-many.
- 🔴 **Truncation that reports `found:false` is indistinguishable from real absence** — and here
  it was cached, so it persisted. A short page should be detected and retried/raised, never
  reinterpreted as "no data".
- ⚠️ **My own probe was the broken instrument twice.** A 33-id sweep read `.thumbnails` off a
  400 body (`Maximum 20 design IDs`) and printed "all missing"; earlier runs disagreed with each
  other for the same reason. **Check the HTTP status before parsing.** The finding only became
  real when single-id queries returned artwork the batch had denied.
- 🔑 A mock that ignores `q.limit` cannot catch this — the regression test makes the fake Caspio
  honour the limit, so it fails against the old code (verified by reverting).
- 🔑 **Same route file, same disease: `/thumbnails/sync-status` reported `totalRecords: 20000`,
  which was `maxPages 20 × 1000` — the CAP, presented as a count** (true size 27,665). It also
  counted `recordsWithImages` off **`ExternalKey`, the retired Caspio Files key**, so it answered
  "0 of 20,000 have images" about a table where 26,990 do — artwork moved to Box and lives in
  `FileUrl`. **A metric outliving its schema reads as a catastrophe rather than a stale field.**
  Now counts `ExternalKey || FileUrl`, `strict: true` so truncation throws, and counts are opt-in
  behind `?counts=true` (a count means ~28 Caspio reads; `lastSync` is one).
- 🔑 **Caspio v2 does NOT return `TotalRecords`** on a `q.limit=1` read — the body is just
  `Result`, and `makeCaspioRequest` strips even that. There is no cheap COUNT; verify before
  designing around one. Use `discardResults: true` + `pageCallback` to count without holding
  27k rows in dyno memory.
- 🔑 **`lastSync` is the field that actually answers "is the sync stalled?"** — it showed the
  bandit thumbnail sync running 09:22 the same morning, which proved the two remaining blank
  designs had no artwork attached in ShopWorks rather than a sync lag.
- 🔑 **The inbound sheet has THREE artwork states, not two**: has art · has a design but no art
  (a real gap) · **no design at all** (blanks/undecorated, `method: "Other"`, empty
  `designNumber` — nothing is missing). Rendering the last two identically sent people hunting
  for artwork that never existed: on 2026-08-05, 3 of 4 "missing" tiles were blanks orders.
  Blanks now get their own glyph + solid tile; **the glyph must differ, not just the tooltip,
  because the printed sheet has none.**
- ⚠️ **Screen and print do NOT share the logo tile** — `logoTile()` vs `psLogo` in the print
  builders. Fixing one leaves the other; print used to render *nothing* for both no-image cases,
  so a missing proof, a blanks order and a failed image were indistinguishable on paper.
- 🔑 **These sheets go to a MONO LASER** (the `.sit-ps-rush` rule says so). On paper the signal
  must be shape/text, never colour — and a 42px emoji is a smudge. Print uses the words `NO ART`
  (dashed border, black) and `BLANKS` (solid, flat fill + `print-color-adjust: exact`, since
  browsers drop backgrounds when printing).
- 🔴 **`window.print()` SNAPSHOTS the DOM — an `<img>` still in flight is simply absent from the
  PDF.** No error, no gap, nothing to notice. The sheet builds fresh `<img>` tags and the screen
  tiles are `loading="lazy"`, so only orders the user had scrolled past were warm: everything
  below the fold silently lost its thumbnail. Measured on a real AE sheet — **7 POs with artwork,
  3 images in the PDF**; and cold-loading the full sheet, only **8 of 16** screen tiles were warm.
  Fix: `await img.decode()` on every sheet image before printing (`decode()` resolves when the
  bitmap can PAINT; `load` can fire a frame earlier — that frame is where this lived), capped at
  6s so a dead Box file degrades to the old behaviour instead of hanging the dialog. After: 14/14
  decoded, 0 missing, 4.5s wait. 🔑 **This masqueraded as the artwork bug being only half-fixed —
  two different causes producing the same "missing thumbnail".**
- ⚠️ **A fixture with a real Box url would 401 offline** and silently exercise the FALLBACK path
  while looking like it covered the image case — the print harness uses a `data:` URI instead.
  Note `/tests` is not served (removed in the 2026-08-05 source-exposure fix), so that harness
  only runs from disk; verify print by stubbing `window.print` on the real page and grabbing
  `#sit-print-sheet` before its 1.5s self-cleanup removes it.

---
## Monogram thread-color dropdown dead in prod: API envelope change nobody re-tested (2026-08-04)

**Problem.** The monogram form's thread-color selector had been silently broken live:
`this.threadColors.filter is not a function` on every page load. Users could still type
names, so nobody reported it.

**Root cause.** `GET /api/thread-colors` originally returned a bare array; at some point the
proxy started returning an `{success, count, colors}` envelope. `fetchThreadColors()` kept
`return await response.json()` with the comment "Returns array directly" â€” HTTP 200, valid
JSON, wrong shape. The error surfaced only in the console + a toast reps ignored.

**Solution.** Service now unwraps both shapes and **throws** on anything else
(`monogram-form-service.js` `fetchThreadColors`). Found while browser-verifying the
Stitch-Proof feature, fixed in `ced3bc2f`.

**Prevention.**
- ðŸ”‘ **HTTP 200 + valid JSON â‰  valid response â€” assert the SHAPE at every fetch boundary**
  (same family as the pricing-bundle empty-arrays-on-rate-limit lesson, v1791).
- ðŸ”‘ **When a proxy route's response shape changes, grep ALL frontend consumers** â€” the app
  and proxy deploy independently, so shape drift breaks quietly.
- ðŸ”‘ A broken feature users can work around generates zero bug reports; only a
  browser-verification pass with the console open finds it.

---

## /deploy's cache-bust silently does nothing if you pushed develop first (2026-08-03)

**Problem.** Deploying the vacation-slip work, the skill's Step 2 found **zero** changed assets
and bumped no `?v=` string â€” even though `payroll.js`, `payroll.css` and the brand-new
`vacation-carryover.js` were all in the release. Left alone, the deploy would have shipped new
JS/CSS behind unchanged URLs, so every browser that had ever opened the page would keep serving
the cached old files.

**Root cause.** Step 2 detects changed assets with
`git diff --name-only origin/develop HEAD` plus the dirty working tree. Both are empty in the
**normal** workflow â€” commit your work, `git push origin develop`, *then* `/deploy`. Once
develop is pushed, `origin/develop == HEAD`; once it's committed, the tree is clean. The
comparison answers "what have I not pushed yet?", which has nothing to do with what is live.

**Solution.** Compare against **`main`** â€” the branch that actually reflects production:
`git diff --name-only main develop -- '*.js' '*.jsx' '*.css'`. That correctly returned all
three files, and the bump then verified live (`/api/version` sha matched the deployed commit).

**Prevention.**
- ðŸ”‘ **A cache-bust's baseline must be what is LIVE (`main`), never what is PUSHED
  (`origin/develop`).** Pushing develop is not deploying; any diff based on push state measures
  the wrong thing.
- ðŸ”‘ **This is a silent success, which is the dangerous kind.** The deploy reports âœ…, the
  Heroku release succeeds, and the backend SHA check *passes* â€” because the backend really did
  update. Only the browser assets are stale, and nothing in the pipeline looks at them. It is
  the same failure class the skill already documents for `.jsx` files ("deployed but nothing
  changed"), reached by a different route.
- âš ï¸ The skill file still contains the `origin/develop` comparison. Until it's fixed, check
  `git diff --name-only main develop -- '*.js' '*.jsx' '*.css'` by hand and confirm Step 2's
  bump list is non-empty whenever a release touches front-end assets.

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


## A corrupt file that "parses" becomes a silent wrong price â€” DST has no magic bytes (2026-08-04)

**Problem.** Browser-verifying the contract calculator's new DST drop zone: 2,000 bytes of
arbitrary garbage named `.dst` didn't error â€” it "decoded" into ~500 nonsense stitches, silently
replaced the previously loaded file, and priced the order at the 8K contract minimum.

**Root cause.** Tajima DST has no file signature: ANY 3-byte record decodes into *some* stitch
delta. `dst-parser.js`'s only guardrails were "file too small" and "zero stitches decoded" â€”
tuned for the Embroidery Studio VIEWER, where garbage is self-evident as noise on the canvas.
On a PRICING surface the same parse produces a plausible number with no visual to contradict it.

**Solution.** Calculator-side validity gate (`embroidery-contract.js handleDstFile`): every real
DST declares its record count in the `ST:` header â€” refuse loudly when it's 0 or disagrees with
the decoded record total by >25%.

**Prevention.**
- ðŸ”‘ **A parser succeeding â‰  the input being valid. For signature-less formats, cross-check an
  internal redundancy** (declared vs decoded counts) before trusting the result with money.
- ðŸ”‘ **The same parse carries different risk per surface**: viewer â†’ garbage renders as visible
  noise; calculator â†’ silent wrong price (Erik's #1 rule). Reused code inherits the validation
  needs of its STRICTEST consumer.
- Verify error paths with actively hostile bytes, not just wrong extensions â€” 12 green jest
  tests and a clean happy path coexisted with this hole.

---


## `el.hidden` doesn't hide a flex element â€” and asserting the property hides the bug too (2026-08-04)

**Problem.** On the contract calculator's DST card, `el.hidden = true` left three elements fully
visible: the drop zone stayed on screen *under* the loaded file card, and two empty note rows
rendered inside the card as stray dashed-bordered strips whenever no note applied.

**Root cause.** `[hidden] { display: none }` lives in the **UA stylesheet**, so ANY author
`display` declaration beats it regardless of specificity â€” and `.dst-drop` / `.dst-note` /
`.dst-suggest` are all `display: flex`. Elements with no author `display` (the card, the error,
the buttons) hid correctly, which is exactly why it looked like the pattern worked.

**Why the first verification pass missed it.** The browser check asserted `el.hidden` â€” the
**property** â€” which is just reading back the attribute that was set. It is true whether or not
the element is visible. Only `getComputedStyle(el).display` answers the actual question.

**Solution.** Attribute-qualified rules, which outrank the plain class rule:
`.dst-drop[hidden], .dst-note[hidden], .dst-suggest[hidden] { display: none; }`

**Prevention.**
- ðŸ”‘ **Any component that sets both a `display` and `[hidden]` needs an explicit
  `.thing[hidden]{display:none}`** â€” assume the UA rule loses.
- ðŸ”‘ **Verify visibility with `getComputedStyle().display` / `getBoundingClientRect()`, never
  the `.hidden` property or a class check.** Asserting the input you just set proves nothing;
  assert the rendered consequence.
- ðŸ”‘ An adversarial review pass caught this after a "passing" browser pass. When a verification
  result is a tautology, it will pass forever.

---


## Releasing from a SHARED checkout: excluding a file cuts both ways (2026-08-04)

**Problem.** Deploying the Embroidery Studio, the release also carried
`quote-builders/monogram-form.html` â€” a parallel session's WIP that another session's
`git add -A` had swept into `baafe9f3`. Shipping it would have put a **dead "Print Customer
Proof" button** in front of reps (its controller/CSS were still in review on develop). Two
further traps followed: `git checkout main` **aborted** because the shared tree was dirty with
three sessions' edits, and the develop sync-back **silently reverted** the WIP the release had
deliberately excluded.

**Root cause.** A shared working tree makes branch-level operations sweep in work whose owner
isn't in the room. And a merge that restores a file to main's version encodes "main's copy
wins" â€” merging that commit back into develop faithfully replays the deletion.

**Solution.** Cut the release at *my* verified sha in an isolated `git worktree`
(`git merge --no-ff --no-commit <sha>` â†’ `git checkout HEAD -- <foreign file>` â†’ commit with the
exclusion stated in the message), then on the sync-back re-take develop's copy
(`git checkout origin/develop -- <file>`) before pushing.

**Prevention.**
- ðŸ”‘ **Never `git checkout <branch>` in a shared checkout â€” release from a `git worktree`.** Also
  put that worktree at a SHORT path: `/Temp/nwca-rel` worked where the session scratchpad path
  blew Windows MAX_PATH on a deep blog filename ("Filename too long", `Could not reset index`).
- ðŸ”‘ **Every file-level exclusion needs a matching restore on the merge-back**, or the release
  silently deletes the work it was protecting. Verify with `grep` for a marker from the WIP
  *before* pushing the sync â€” not after.
- ðŸ”‘ **Deploy the dependency first and prove it with a live probe**: the box-labels page needed
  proxy `/api/sanmar-orders/label-data` â€” curl'd for HTTP 200 (and absence of `ContactEmail`)
  before the app slug went out.

---


## The shared print block flattens every color you set inline (2026-08-04)

**Problem.** The monogram Customer Proof renders each name in its real thread color — the whole
point of the sheet. On screen it was perfect. **On paper every name printed black**, and the
tiny color swatch beside it still printed correct, so the sheet looked deliberate rather than
broken. Found by review, not by the browser pass that had already "verified" the feature.

**Root cause.** `quote-builder-common.css`'s `@media print` block contains
`* { color: black !important; }`. The controller set the thread color as a *normal* inline
declaration (`style="color:#003DA5"`), and an author `!important` beats any normal declaration —
including inline. Backgrounds were unaffected, which is why the swatch survived and the defect
read as intentional.

**Solution.** The inline color is now `!important` too (inline `!important` outranks stylesheet
`!important`). Proven in-page rather than assumed: the same cascade reproduced synthetically
yields `rgb(0,0,0)` without the flag and the true color with it.

**Prevention.**
- 🔑 **A print stylesheet is a second rendering nobody looks at.** Screen verification says
  nothing about it — check print explicitly, or the defect ships looking fine.
- 🔑 **`quote-builder-common.css` forces black text and is loaded by ALL 4 quote builders** — any
  feature whose *meaning* is carried by color (thread, status, warning) must use `!important`
  inline or a rule with its own `!important`, or it silently prints monochrome.
- 🔑 **A partial survivor disguises the failure**: the swatch (background) printed while the text
  (color) did not, which reads as a design choice instead of a bug. When one half of a visual
  pair works, suspect a property-scoped override rather than a broken feature.

---


## A per-frame `getImageData` capped the spin at whatever the readback allowed (2026-08-04)

**Problem.** The garment designer's 🔄 Spin preview looked choppy and "unreal" no matter how the
motion was tuned. Three defects were stacked, and each masked the next.

**Root cause.**
1. **Rendering.** 24 photos 15° apart were composited as a *permanent linear crossfade* — the
   shirt was a double exposure 100% of the time, and it stepped photo-to-photo while the printed
   logo (drawn from continuous `theta`) glided. The eye reads that desync as chop.
2. **Settle.** On release, momentum rounded to a virtual step but wrapped `PHOTO.pos` by
   `PHOTO.frames.length` (24) instead of `effectiveSpinSteps()` (96). Measured from four
   arbitrary positions it jumped **180°, 1.5°, 179.3°, 91.1°** and parked at blend fractions
   0.52/0.56/0.96 — i.e. the resting shirt was usually a half-and-half ghost.
3. **Throughput.** `rebuildMockup()` runs every tick, and it called `maybeWarnLowContrast()` →
   `artMeanLuminance()` → **`getImageData()`**: a GPU→CPU readback that stalls the pipeline,
   inside a 6.1 ms frame budget.

**Solution.** View morph (scale each neighbour photo horizontally about the shared registered
torso axis by the ratio of apparent turntable widths, *then* blend — silhouettes align, so the
fade stops reading as a ghost); fade compressed to the middle 40% of each gap so the shirt is a
single pure photo 60% of the time; settle glides onto the nearest **real photo angle**;
delta-time scaling on both momentum and auto-spin; and the contrast warning memoized on
`id§eraseN§knockOn§garment`. Measured after: **163.9 fps on a 163.9 Hz display**, median frame
6.1 ms in a 6.1 ms budget, 5 dropped frames per 400, revolution 6.58 s.

**Prevention.**
- 🔑 **`getImageData()` anywhere reachable from an animation tick is a frame-rate cap, not a
  slow function.** It forces a pipeline flush. Memoize on the inputs that actually change, or
  hoist it out of the loop entirely.
- 🔑 **Fixed per-frame increments are a refresh-rate bug**: `pos += k` ran twice as fast on a
  120 Hz screen. Advance by measured elapsed time and clamp `dt` for tab switches.
- 🔑 **Two position spaces (24 real frames vs 96 virtual steps) invite a wrap in the wrong one** —
  and the symptom (an occasional jump at the *end* of a coast) looks like a physics-tuning
  problem, not an indexing one. Assert the parked state, not just the motion.
- 🔑 **Blending frames is not interpolating geometry.** If a crossfade looks like ghosting,
  align the silhouettes before fading rather than tuning the fade curve.
- ⚠️ **rAF is paused in a hidden tab, so any in-page fps probe hangs there** (a CDP eval waiting
  on it times out at 45 s and reads as "renderer frozen"). Arm the probe on `visibilitychange`
  and read the stored result afterwards.

---

## A 403 <img> is invisible to every automated check — only eyes caught it (2026-08-05)

**Problem.** DST Studio shipped with a broken NWCA logo in the header: the alt text and a
broken-image icon, on every visit. The same dead URL was in the **customer-facing Approval
Sheet**, so a printed proof would have carried a broken logo to a customer. It survived a
full live-verification pass and only surfaced when Erik sent a screenshot.

**Root cause.** I built the studio's header by copying `mockup-generator.html`, inheriting its
`cdn.caspio.com/A0E1B000/...` logo and favicon. That host returns **403**. Those two pages were
the only places in the repo still using it — the house standard is `/favicon.png` (179 pages)
and the `A0E15000` logo (230 pages).

**Why every check passed.** A failed `<img>` does not fail the page: the HTML is 200, the DOM
is correct, `grep` of served markup matches, and a broken image logs nothing my
console-error probe surfaced. I verified *the page*, never *the page's sub-resources*.

**Solution.** Point both pages at the house-standard URLs. The logo PNG is RGBA, so the existing
`brightness(0) invert(1)` (white on dark header) and `brightness(0)` (black on printed sheet)
filters still work untouched.

**Prevention.**
- 🔑 **Assert `img.naturalWidth > 0`, not that the page loaded.** `complete` is true for a
  failed image too — `naturalWidth` is the only honest signal, and it works headless where
  screenshots don't.
- 🔑 **Copying a header inherits its bugs.** Before reusing markup from a neighbouring page,
  probe its absolute asset URLs; a `grep -c` for the repo's dominant favicon/logo URL tells you
  instantly whether the source page is the odd one out.
- 🔑 **Anything that prints for a customer deserves its own asset check** — the broken sheet
  logo was the costlier half of this bug and the half no staff member would have reported.

---

## Steve's Box picker searched a number that has never existed (2026-08-05)

**Problem.** Steve loaded a mockup into Box, opened **Send Mockup**, and got the yellow "No Box
folder found for this design", an empty picker, and a Send button stuck disabled at "0 of 6
selected". The one "Previously Sent" card rendered as a grey **File** placeholder. Erik's read
was "this used to work" — half right, and the half that was right pointed at the wrong defect.

**Root cause — two independent bugs, only one a regression.**
1. The picker called `/api/box/folder-files?designNumber=` with Caspio's **`ID_Design`** (53069).
   Steve names his Box folders with the **ShopWorks** number **`Design_Num_SW`** ("40733 Ironside
   Marine"). The two series are unrelated: across 2,710 art requests they coincide **4 times**,
   all hand-typed in 2024. `ID_Design` runs 50092-53069, `Design_Num_SW` runs 111-1232434. So the
   search matched nothing, ever — wrong since `7193982d` / proxy `3b05395`, masked all along by
   the paste-URL fallback. The proxy's own comment (`box-upload.js:1432`) had documented the
   correct key the whole time.
2. The broken thumbnail WAS a regression, two days old. `b9e9d2a3` session-gated the Box surface;
   335 stored Caspio mockup URLs are absolute `https://caspio-pricing-proxy…/api/box/thumbnail/<id>`
   and now 401. `box-url.js` was written **in that same commit** to fix exactly this — and wired
   into only the two transfer pages. Every art/mockup surface kept rendering raw stored URLs.

**Solution.** Picker keys off `Design_Num_SW` (6/6 on recent jobs) with a named empty state, and
**no** company-name fallback — a company search resolves to the first folder merely *containing*
the name, i.e. another design's artwork (it is how design 53069's mockup got filed into
"40640 Ironside Marine"). `boxUrl()` adopted across all 10 art/mockup renderers + 6 pages. The
send path converts any `/api/box/thumbnail/<id>` into a real Box shared link before it reaches an
email. Proxy upload routes accept `designNumSw` so uploads and the picker agree on one folder.

**Prevention.**
- `tests/unit/box-url.test.js` drift-locks it: any page loading a script that calls `boxUrl()`
  must also load `box-url.js`, **and load it first**.
- `tests/jest/box-folder-files-design-number.test.js` (proxy) pins that a ShopWorks number
  resolves and a Caspio `ID_Design` returns an honest `200 + found:false`.
- 🔑 **A module that ships unwired is invisible to unit tests that only exercise the module.**
  `box-url.js` had 20 passing tests while doing nothing on 8 of the 10 pages that needed it.
- 🔑 **"It used to work" is a hypothesis — check git before redesigning.** Two minutes of
  `git log -S` separated a year-old latent bug from a 2-day-old regression.
- 🔑 **Two ID series that both read as "the design number" WILL be confused.** Name the variable
  for the system it belongs to (`swDesignNum`, not `designId`).
- 🔑 **`img.src` returns an ABSOLUTE url** — comparing it against the relative literal you just
  set is always false. Use `getAttribute('src')`. It silently killed a lightbox fallback in two files.

---

## Gating a shared image route broke every CUSTOMER, and only a real login showed it (2026-08-05)

**Problem.** The Aug 5 Box gating (`b9e9d2a3`) put `/api/box/thumbnail/:fileId` behind
`requireStaff`. Customer-portal artwork is STORED as absolute URLs pointing at exactly that route,
so every proof a customer saw started 401ing. Measured against live data: **92% of art proofs, 8 of
9 mockup proofs, and 100% of the logo library** (128/128) — the whole "My Logos" showcase was blank.
Nobody reported it, because customers do not file bug reports.

**Root cause.** The gate was designed and verified entirely from a STAFF session, where
same-origin + the SAML cookie makes it work. `/portal` is a different identity: `requireCustomer`
sets `req.customerSession.portalCustomer`, which has no `crmUser`, so `requireStaff` rejects it.
The obvious fix — `boxUrl()`, which repointed stored URLs at this origin and fixed all the staff
pages — does **nothing** here: same-origin still lands on `requireStaff`.

**Solution.** A capability, not a relaxation. `portalProofUrl()` rewrites each stored Box URL to
`/api/portal/proof-image/<token>` while projecting rows the server has ALREADY authorized as that
customer's; the token is HMAC-signed (`lib/customer-magic-link`) and binds one fileId to one
customer. The route takes the fileId ONLY from the verified token, so the customer never supplies a
Box id and there is nothing to enumerate — the "any id, any file" power the staff route still has
was deliberately not extended. Not `requireCustomer`-gated, because `/mockup/:id` and
`/art-request/:designId` are public email-link pages whose images must render for a logged-out
customer; when a session IS present it must match, so a token cannot be replayed into another
customer's browser.

**Prevention.**
- 🔑 **"Verify with a real session" is not a formality.** 18 unit tests passed and the whole thing
  was still broken end to end: `portalLimiter` allows 60 req/15 min, and one portal page view is
  **53 images**, so the customer 429'd out of their own portal partway down the page. Nothing short
  of loading a real customer's portal would have found that. Images now have their own budget.
- 🔑 **A gate is per-IDENTITY, not per-origin.** Before gating a shared route, enumerate every
  identity that reaches it — staff SAML, customer portal cookie, logged-out email link, server-side
  callers — and test each. Two of the four here were never considered.
- 🔑 **Two token types signed with the same key need a `t` discriminator**, or a stolen session
  cookie is an image capability and vice versa. Jest-locked both directions.
- 🔑 **A customer route must not inherit a staff forwarder's param allowlist.** Reusing
  `boxForward` also reused `BOX_FORWARD_QUERY` (`full`, `url`, `folderId`, …). The proxy's
  thumbnail route ignores those *today*, so nothing leaked — but the customer route would have
  silently widened the day upstream started honouring one. It now forwards `size` only, and forces
  `Cache-Control: private` rather than echoing upstream, since the response is a per-caller
  capability that must never land in a shared cache.
- 🔑 Distinguish "my code is broken" from "the data is": 2 of the 53 failures were Box files that
  no longer exist (`Item not found`) — a pre-existing dead reference, not the fix. Check the asset
  before blaming the change.
- Drift guard: `tests/unit/portal-proof-image.test.js` fails if any Box-carrying field in the four
  portal projections stops going through `portalProofUrl` — an unwrapped field is invisible, it
  just renders broken for a customer who will never tell you.

---

## The boxUrl() migration missed every surface that never called boxUrl() (2026-08-06)

**Problem.** Erik: finished-photo thumbnails were blank on the Photo Library, the capture page's
design picker, its "on file" list, and the dashboard Pride Wall. Cards, captions, counts and
"18 photos / 18 live" were all correct — only the images were dead.

**Root cause.** The Aug-5 Box gating put the proxy's `/api/box/thumbnail/:fileId` behind
`requireCrmApiSecret`. `Finished_Photos.Image_URL` is written ABSOLUTE at upload time
(`proxy src/routes/finished-photos.js:125` → `${PROXY_BASE_URL}/api/box/thumbnail/<id>`), and
`designs-by-method.js` returns stored `FileUrl` thumbnails in the same absolute shape. Absolute =
cross-origin = no SAML cookie → **401 on every `<img>`** (verified live: anonymous GET returns
`401 {"error":"Unauthorized"}`). The fix everywhere else was `boxUrl()`, which re-points stored
urls at this origin so the cookie authorises them — these four renderers were never migrated.

**Solution.** `resolveBoxUrl()` at each render site (finished-photos-library.js,
finished-photos.js ×2 — design tiles AND the manage list, pride-wall-controller.js) plus the
`box-url.js` script tag on their three pages. The Pride Wall is an ES module, so it reads
`window.boxUrl`; a classic script always executes before any `type="module"`.

**Prevention.**
- 🔑 **A migration guarded by "everyone who calls X must also load X" cannot see the files that
  never call X.** `box-url.test.js` was green throughout — its consumer scan starts from
  `boxUrl(` call sites, so an unmigrated renderer is invisible by construction. The blast radius
  of a gating change is *every reader of the gated data*, not the subset already adapted to it.
- 🔑 **Scans define the blind spot.** That test listed JS non-recursively and skipped
  `staff-dashboard-v3/`, so the Pride Wall was doubly unreachable. Both widened; the JS walk is
  now recursive and the page walk follows `type="module"` **import graphs**, since a module
  consumer has no `<script src>` of its own to match on.
- 🔑 **Ask what the field actually holds before assuming which fixer applies.** The design tiles
  looked like a different bug (`/api/files/<key>`, which is open and returns 400 not 401); the
  live payload showed they were `/api/box/thumbnail/` urls after all. One `curl` of the real
  endpoint beat reading the writer code.
- ⚠️ **"Upload works" ≠ "images work."** The capture preview is a local `URL.createObjectURL`
  blob, so a phone upload looks completely healthy while every stored url is 401ing.
- 🔑 **The reported pages were a third of it.** A 43-agent sweep found the same defect on AE
  Mission Control, the Send Mockup picker (shipped the day before, `807184ee` — it *builds*
  `API_BASE + thumbnailUrl`, so it was cross-origin by construction), both Bradley boards, the
  quote-builder design combobox, the DTG catalog search, the EMB design search, and the SanMar
  inbound sheet (`/api/thumbnails` returns the same absolute shape — that is why the printed
  PDF had no artwork). **When a shared gate changes, enumerate every reader of the gated data
  and check them all — the ones a human happens to notice are a biased sample.**
- 🔑 **A path-blind drift lock creates the collision it is meant to prevent.** Matching consumers
  to pages by BASENAME made every page loading any `utils.js` fail once a helper landed in
  `builders/dtg/utils.js` — 20 false failures, the same shape as the 2026-06-09 `?v=` incident.
  Match on the resolved repo path, and follow `<script src>` → import graph (that covers both
  the `type="module"` dashboard and the esbuild-bundled quote builders).
- 🔑 **The VENDOR portal needed a third mechanism, not a third copy of the second.** Supacolor/L&P
  are neither staff nor customers, so `boxUrl()` (origin) and `portalProofUrl()` (customer token)
  both miss. `vendorProofUrl` + `lib/vendor-magic-link.mintProofToken` mints a capability bound to
  `{fileId, vendorName}` from rows `vendorOwnsRow()` already cleared. 🔴 **Type tag `'vproof'`, not
  `'proof'`** — both families sign with SESSION_SECRET, so without it one outside company's image
  URL verifies inside another identity. Jest-locked in BOTH directions.
- 🔑 **`.map(projectVendorJob)` hands map's INDEX to the second parameter** — every token would be
  minted for vendor "0"/"1"/… and 404 on redemption. Silent at author time, total at runtime;
  a regex test now forbids the bare reference.
- 🔑 **A wall of 404s looks exactly like a working deny-list.** Prove the negative AND the positive
  in the same run: the customer token 404ing at the vendor route only means something because the
  same token returned a 200 PNG at the customer route seconds earlier.
- 🔑 **To see a customer-facing change, use the STAFF PORTAL PREVIEW:
  `/portal-admin/preview/<idCustomer>`** (linked from `dashboards/customer-portal-admin.html`) —
  read-only, renders exactly what the customer sees, no customer credentials needed. Erik had to
  point this out after I'd concluded it was unverifiable: I grepped
  `customer-portal-admin.html` for "preview|viewAs|impersonat" and the *route* lives elsewhere.
  **Grep the route table, not just the page you expect to host the button.**
- ⚠️ **A hand-minted portal session is NOT a substitute.** `requireCustomer` re-checks the live
  `Customer_Portal_Access` table, so a signed cookie for an unregistered email 401s and *clears
  itself*. Worse, the 401 body has no `mockups` key — so a naive parse prints "0 mockups" and
  reads as a real empty result. Check the HTTP status before interpreting a body.
- ⚠️ **Do not read `img.complete`/`naturalWidth` on a polling board.** Bradley's queue re-renders
  every 60s, replacing every `<img>`, so a snapshot mid-poll shows "0 decoded, 38 pending" on a
  page that is working perfectly. The network log (40/40 → 200) was the truthful instrument.
  Also: 401 vs 404 matters — one 404 here is a Box file that was genuinely deleted, not a break.

---



