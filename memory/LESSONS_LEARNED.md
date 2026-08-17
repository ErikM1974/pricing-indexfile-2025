# LESSONS LEARNED

Bug â†’ root cause â†’ fix â†’ prevention. Newest first. **Hard limit 300 lines** â€” archive the
oldest resolved entry to `LESSONS_LEARNED_ARCHIVE.md` once this passes 250.

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
