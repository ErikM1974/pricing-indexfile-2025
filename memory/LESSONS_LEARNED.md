# LESSONS LEARNED

Bug â†’ root cause â†’ fix â†’ prevention. Newest first. **Hard limit 300 lines** â€” archive the
oldest resolved entry to `LESSONS_LEARNED_ARCHIVE.md` once this passes 250.

---

## A consolidation is only as complete as the LAST thing that writes the value (2026-08-16)

**Problem.** The 2026-08-15 "one full-back ladder" work moved every surface onto Caspio
`Embroidery_Costs` `ItemType='DECG-FB'`. Two follow-on defects survived it, both invisible to a
green suite.

**Root cause 1 — a later init step clobbered the ladder.** `_doInitializeConfig()` reads the
ladder at ~:284 (`fbBaseStitchCount = fullBack.minStitches`), then calls `loadServiceCodes()` at
:334, which at :420 did an **unconditional** `this.fbBaseStitchCount = fb.StitchBase || 25000`
from the retired `Service_Codes` 'FB' row. The ladder's own minimum was overwritten moments
after being read, on **all three** full-back paths. Erik could edit the 25,000 minimum in Caspio
and nothing would move.

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
