# Customer-supplied garment quoting — what exists, what is wrong, the redesign (2026-09-07)

Erik 2026-09-07: "look at the entire customer supplied quoting page and develop a new and better way to
quote customers that bring in their own garments … a construction company or a local business that buys
blank garments and only brings them in for us to decorate. We don't offer customer-supplied DTG."

## 1. What exists today (mapped 2026-09-07, all LIVE — `v2026.08.15.1` shipped the vendor/CS work)

| Method | Surface | Pricing | Saves a quote? | Pushes to ShopWorks? |
|---|---|---|---|---|
| Embroidery | EMB quote builder → services bar → **Customer-Supplied** chips (`DECG` garment / `DECC` cap) + ✏️ Describe dialog | `/api/decg-pricing` (Caspio `Embroidery_Costs` DECG-Garmt / DECG-Cap / DECG-FB): $28→$20 garments, $22.50→$16 caps, +$1.25/1K (garment) / +$1.00/1K (cap) over 8K, +$10 heavyweight, **$50 LTM ≤ 7 pcs**, pooled tiering across supplied rows | yes (`EMB…`) | yes — `DECG`/`DECC` lines + a Receiving note from the manifest |
| Screen print | **standalone** `/calculators/screenprint-customer/` ("Print on Their Shirts" tile) | engine `singleItemPreview` with `customerSuppliedGarment: true` → `generateManualPricingData(0)` (print cost only, garment $0); `SPSU` setup, LTM through 24-47, 13-pc minimum, safety stripes | yes (`SPC…`, emailed) | **no** — calculator, not a builder |
| DTF | nothing ("coming soon" note on the dashboard) | — | — | — |
| DTG | contract calculator only (wholesale partners' blanks) | — | — | — |
| Reference | `/calculators/embroidery-pricing-all/?tab=decg-retail` ("Customer's Garment" tile) | DECG matrices | — | — |

Non-pricing pieces: garment drop-off waiver form (`pages/forms/garment-drop-off-form.html`),
`Customer-Supplied-Garments-Acknowledgment.pdf`, the negotiation-policy script ("$30 customer-supplied
embroidery is not negotiable"), and the customer quote page's `renderCustomerSuppliedRows`.

## 2. What is wrong with it (why a rep quoting a construction company today has a bad time)

1. **Three different doors for one job.** Embroidery lives inside the builder; screen print is a separate
   calculator that cannot push to ShopWorks; DTF has no door at all. A rep with "40 hoodies, left-chest
   embroidery AND a printed back" has to build two quotes on two surfaces and re-key the order by hand.
2. **The screen-print calculator dead-ends.** It emails a price and saves an `SPC` quote, but the order
   still has to be typed into OnSite — the one place the pushed order's Receiving note ("count in 40 navy
   hoodies from ACME") would have mattered most.
3. **Nothing captures the intake.** Only the EMB Describe dialog records brand / colour / size manifest,
   and only as free text. There is no count-received, no condition/waiver acknowledgement on the quote,
   no "customer ships to us by" date the shop can plan around.
4. **The customer never sees a customer-supplied quote page that explains the rules** (no garment
   warranty, misprint allowance, minimums, bring-extras advice). The policy exists in the Policies Hub
   only.
5. **ShopWorks parts are the real blocker for SCP/DTF.** `DECG`/`DECC` are EMBROIDERY parts. The SCP and
   DTF push transformers had NO catch-all — an item of type `customer-supplied` was dropped from the
   pushed order with no note (fixed in the proxy 2026-09-07: it now lands as an UNBILLED note). To push a
   supplied-garment screen-print or DTF line as a real ShopWorks line, OnSite needs a part for it.

## 3. The redesign — one door, three methods, one intake

**Principle:** the customer-supplied case is a *garment source*, not a separate product. So it belongs
INSIDE the existing quote builders (EMB / SCP / DTF) as a row type, exactly as the EMB builder already
does — not as a fifth builder and not as standalone calculators. Everything downstream (save, revision,
PDF/invoice, customer quote page, ShopWorks push, Quote Management) is reused.

### 3a. Row type "Customer-supplied garment" in all three builders (Rule 8: one shared module)
- Services-bar chip group **Customer-Supplied** on SCP and DTF, mirroring EMB's: `Customer Garment`
  (+ `Customer Cap` where the method decorates caps). Adding one inserts a row whose garment cost is $0
  and whose decoration price comes from the SAME engine path each method already trusts:
  EMB `calculateDECGPrice` · SCP `generateManualPricingData(0)` · DTF the DTF service with garment cost 0
  (the DTF service already takes a garment-cost argument — the adapter's `garmentCost` fix on 2026-09-06
  proves the seam).
- Shared **intake card** (`shared_components/js/builders/shared/customer-supplied-intake.js`) replacing
  the EMB Describe dialog: brand/style · colour · size manifest (S/M/L/XL/2XL… counts, so the quantity
  is DERIVED from the manifest, not typed twice) · expected arrival date · "customer brings 2–3 extras"
  checkbox · waiver acknowledged (date + who). Persists in `quote_items.Notes` (Receiving note) +
  `SizeBreakdown` metadata, exactly where EMB writes today.
- Pooled tiering across supplied rows (EMB already does this — "15 jackets + 15 hoodies = one 30-pc
  run"); the `$50` small-batch fee row from Caspio `LTM` on the tier, never typed.
- Method rules from Caspio, not code: minimum pieces per method, heavyweight upcharge, the "no
  customer-supplied DTG" rule = simply no chip on the DTG builder (Erik 2026-09-07).

### 3b. Customer-facing quote page block
`quote-view.js` `renderCustomerSuppliedRows` grows a short **"Your garments"** panel: what we expect to
receive (from the manifest), the arrival date, and the four policy sentences (no replacement of
customer goods beyond the misprint allowance, bring extras, minimums, turnaround starts when goods
arrive). Same numbers as the rep's screen — no second copy.

### 3c. ShopWorks push
EMB unchanged (`DECG`/`DECC` + Receiving note). SCP/DTF supplied rows push as a decoration-only line on a
part Erik names in OnSite (proposed `DECG-SP` and `DECG-DTF`, or reuse of an existing print part), read
from Caspio `Service_Codes` (`AliasFor` = the OnSite part) so a rename is a Caspio edit, not a deploy.
Until the parts exist the transformer's new UNBILLED note keeps the order honest.

### 3d. Retire, don't duplicate
Once SCP supplied rows live in the SCP builder, `/calculators/screenprint-customer/` becomes a customer
self-serve estimator or is retired (it duplicates the engine path). "Customer's Garment" reference tab
stays.

## 4. Decisions only Erik can make (asked 2026-09-07)
1. **DTF on customer blanks — offered or not?** (Only DTG was excluded.) If yes, the DTF chip ships.
2. **OnSite part numbers** for a supplied-garment screen-print line and a DTF line (or "use X").
3. **Minimums**: EMB supplied has none beyond the $50 fee ≤ 7; the screen-print calculator refuses under
   13. Keep as is, or one rule across methods?
4. **Screen-print pricing basis**: print price only (garment $0, as today) — confirm, or a supplied-garment
   handling charge per piece on top?
5. Keep the standalone screen-print customer calculator as a public estimator, or retire it?

## 5. Verification bar for the build
- Parity: a supplied row's decoration price on each builder == the engine's price for the same inputs
  with garment cost 0 (extend `web-quote-cart-parity`).
- Money path e2e: add a supplied row, set the manifest, save, reprice, PDF; push mocked → the payload
  carries the Receiving note and the right part.
- Axe + Rule 3 + the repo hygiene lock, as for every builder change.
