# Washington State Sales Tax Rules — NWCA Operating Cheatsheet

**Read this before touching any tax-calculation code on any quote builder or order form.**

WA moved to **destination-based sourcing** in 2008. The customer-receives-the-goods location drives the rate, not the seller's location — with one exception for pickup. The three rules below are the law, not a NWCA convention.

---

## The 3 Rules

| Situation | Rate | Authority |
|---|---|---|
| **Customer picks up at NWCA Milton, WA** | **10.2%** (Milton rate, flat — DOR-verified 2026-07-06; was 10.1%) | WAC 458-20-145 — seller's-location sourcing when customer takes possession at the seller's place of business |
| **Ship within WA** | **Destination city's rate** (varies 7.0% – 10.6%) | WAC 458-20-145 — destination-based sourcing when buyer receives goods elsewhere |
| **Ship out of WA state** | **0%** (do not collect) | WAC 458-20-193 — interstate sales, no nexus on out-of-state delivery |

DOR's verbatim wording:

- **Pickup**: *"If your customer takes possession of a product…at your business location, calculate the sales tax based on the rate at your business location."*
- **In-WA ship**: *"If your customer will receive the product…at a location other than your business location, code the sales tax to the location where the customer receives the product."*
- **Out-of-state ship**: *"Do not collect Washington sales tax. Report the sales on your Washington excise tax return. Claim the Interstate and Foreign Sales deduction."*

---

## ⚠ Critical gotcha — Shipping CHARGES are taxable

**WAC 458-20-110**: *"Tax applies to charges to deliver products subject to retail sales taxes in Washington state, even if the delivery charges are billed separately or the seller is also the carrier."*

The legally correct tax base is **`(subtotal + shipping) × rate`**, not `subtotal × rate`.

**Why this isn't currently biting us:**
- Customer Pickup → `cur_Shipping: 0` always → math is correct ✅
- UPS Ground orders from DTG/EMB/etc. → form doesn't capture a $shipping line → `cur_Shipping: 0` in ShopWorks payload → math is correct for what's actually billed ✅

**When this WILL bite us:** the day any quote builder adds a "shipping cost passed to customer" line item. At that point every `taxRate * subtotal` site needs to become `taxRate * (subtotal + shipping)`. Mentioned in MEMORY.md "Top Critical Gotchas" already (Tax line).

---

## Tax-Rate API We Use

`POST /api/tax-rates/lookup` (in `pricing-index/server.js`) wraps DOR's official API:

```
https://webgis.dor.wa.gov/webapi/AddressRates.aspx
  ?output=json
  &addr=<address>
  &city=<city>
  &zip=<zip>
```

This is the SAME engine behind DOR's [public lookup tool](https://webgis.dor.wa.gov/taxratelookup/SalesTax.aspx) and the WA Tax Rate mobile app. Authoritative. Rates are updated quarterly by DOR.

**Response shape**: `{ success: true, taxRate: 10.25, locationCode: "1234", outOfState: false, fallback: false }`. `taxRate` is a PERCENTAGE (e.g. `10.25`), not a float (`0.1025`). Divide by 100 before multiplying.

**Fallback**: when DOR API is unreachable, the proxy returns a state-level default with `fallback: true`. UI should warn the rep ("Default rate 10.2% — DOR unavailable") and the rep can override if they know the right rate.

---

## Exceptions That DON'T Apply to NWCA

For completeness — none of these affect apparel decoration:

- **Motor vehicles, boats, aircraft, trailers** — taxed at seller's location even when delivered elsewhere. Apparel is NOT in this category.
- **B&O tax** — separate tax on business gross receipts. NOT a sales tax. Filed quarterly to DOR; never pushed to ShopWorks.
- **Marketplace facilitator rules** — only relevant if NWCA were Amazon-style marketplace. Not applicable.

---

## Where the Rules Live in Code

Single source of truth for "what GL account" is `getTaxAccount(state, isCustomerPickup)` in `pricing-index/server.js` (search for `WAC 458-20-145`). The three branches map 1:1 to the 3 rules above.

Single source of truth for "what RATE" is `recomputeTaxRate()` in `shared_components/js/dtg-inline-form.js`. Other quote builders (EMB, DTF, etc.) each have their own analog — they all call `/api/tax-rates/lookup` so the rate itself is consistent. The lookup endpoint returns BOTH the rate AND the matched Caspio `sales_tax_accounts_2026` row (`account` + `accountName`); the frontend captures both into `state.shipping.taxAccount` / `taxAccountName`.

## ShopWorks push: TaxTotal = 0, tax applied manually (Erik's workflow, 2026-05-20)

**Order Form submit path (`/api/submit-order-form`) sends `taxTotal: 0` to ManageOrders.** This is intentional, not a bug.

⚠️ **STALE AS OF 2026-07-06 — Milton is now 10.2% (DOR-verified). ERIK ACTION: update the ShopWorks integration defaults to `Tax_10.2` / `2200.102` (create the part/account in ShopWorks if missing).** The reason: the ShopWorks ManageOrders integration is configured with hardcoded `Tax Line Item = "Tax_10.1"` and `Tax Account = "2200.101"`. Those defaults are stamped on EVERY order pulled by the integration — there's no per-order override mechanism. If we pushed `TaxTotal: $X` for a Seattle 10.35% order, ShopWorks would auto-create a line labeled `Tax_10.1 — City of Milton Sales Tax 10.1%` with the correct dollar amount but the wrong GL account and wrong description.

**Erik's chosen workflow:**
1. Form computes the correct destination-based tax for the customer-facing quote
2. Submit sends `TaxTotal: 0` (no auto-tax-line created in ShopWorks)
3. Notes On Order carries a structured tax block (rate, Caspio account, dollar amount) — see `buildOrderNote()` in `server.js`
4. Erik reviews the order, manually adds the correct tax line in ShopWorks using the Notes block as a cheat sheet
5. Invoices the customer

This puts a human in the loop for every order, which Erik wants for AR accuracy.

**Notes On Order tax block format** (4 variants):

```
TAX — APPLY MANUALLY IN SHOPWORKS       ← pickup OR in-WA shipping
Rate:    10.35%  (Seattle — DOR lookup)
Account: 2200.103 — 10.30%
Amount:  $25.88 on $250.00 subtotal

TAX — DO NOT APPLY (out of state)       ← out-of-state shipping
State:   OR
Account: 2202 — Out of State Sales
Reason:  WAC 458-20-193 (no nexus on out-of-state delivery)

TAX — NEEDS REVIEW                      ← defensive: rep didn't fill destination
Subtotal: $150.00
Rep: confirm destination + apply correct WA rate before invoicing
```

**Future option:** If the manual-application step becomes a bottleneck, ask Bradley if ManageOrders supports per-order tax part override. **[2026-06-07 UPDATE: tested end-to-end — it does NOT. See the EMB section below.]**

---

## EMB/SCP/DTF push tax — UPDATE (2026-06-07): connection blanked, OnSite STILL drops the pushed tax field → MANUAL + accounting note

Erik **blanked** the OnSite "Manage Orders" connection's **Tax Line Item + Tax Account** (Sales Tax Settings) to let our pushed per-destination tax part win. The proxy EMB transformer now derives + sends `TaxPartNumber: "Tax_<rate>"` + `coa_AccountSalesTax01: <acct>` per destination (`getTaxAccount` in `manageorders-emb-config.js`).

**PROVEN it does NOT work (EMB-2026-298, order 142061):** we sent `TaxPartNumber: "Tax_9.6"` / `coa_AccountSalesTax01: "2200.96"`, but the MO→OnSite **conversion blanks them** (`TaxPartNumber: ""`, no account). OnSite always overwrites the order-level tax field with the connection's (now-blank) "Tax Line Item" — the pushed value is ignored. The OnSite "Tax Account" tooltip confirms: *"The Tax Line Item must be present on the order for this to work"* — and only the connection field (not our push) sets it. There is **no "Split Tax Line" toggle** in NWCA's OnSite version. **Order-level tax fields do NOT survive the conversion; LINE ITEMS do** (the Size→S service lines passed through untouched — so a tax LINE item is the only automation path, not the order field).

**The working answer = MANUAL (verified on order 142061):** the rep selects the right account from the ShopWorks invoice **Tax dropdown** (e.g. `2200.96 — 9.6%`) → ShopWorks computes Sales Tax `$253.48` → total matches the note. `TaxTotal` stays `0`.

**Two note guardrails (both pushed):**
1. **Notes On Order** (`buildSalesTaxNote`) — tells the rep which rate/account to pick. NOW folds shipping into the total: `Subtotal → Shipping → Taxable: $X (subtotal + shipping) → Tax → Total with Tax`. Wholesale/out-of-state branches included. (Was previously showing `subtotal + tax` only — dropped shipping; fixed 2026-06-07.)
2. **Notes To Accounting** (`buildAccountingTaxNote`, NEW) — gives the accountant the rate/account/taxable/amount/total to verify after invoicing.

**Account routing — `getTaxAccount(taxRate, shipState)` → `{accountCode, description, partNumber}`:**
- WA ship → exact per-address rate `2200.<rate>` / `Tax_<rate>` · Milton pickup → `2200.102` (10.2%) / `Tax_10.2` (rate rose from 10.1% — code updated 2026-07-06) · out-of-state → `2202` / no part · **wholesale** (per-order `Quote_Sessions.IsWholesale` Yes/No checkbox, default No in code) → `2203` / no part.
- Whole-number accts are `2200.8 / 2200.9 / 2200.1` (NOT `.80/.90/.100`) — code mirrors the Caspio `sales_tax_accounts_2026` table (which now also has a `Tax_Part_Number` column). Push does NOT read the table live — uses the hardcoded `TAX_ACCOUNT_LOOKUP` mirror.

**Per-address DOR cache fix (2026-06-07):** `/api/tax-rates/lookup`'s DOR cache was keyed by **ZIP only** → a precise address could be served a neighbor's approximate (ZIP-centroid, resultCode 5) rate. Now keyed by **full address**. Verified: Sumner full-address = 9.6% exact (resultCode 0); ZIP-only = 9.5% approx. Also: Caspio returns `Account_Number` as a NUMBER → normalized to string in `fetchTaxAccounts` (the `=== '2200'` default match was silently failing).

---

## Sources

- [WA DOR — Determine the location of my sale](https://dor.wa.gov/taxes-rates/sales-use-tax-rates/determine-location-my-sale) — canonical rules summary
- [WA DOR — WA businesses selling to out-of-state customers](https://dor.wa.gov/taxes-rates/retail-sales-tax/marketplace-fairness-leveling-playing-field/washington-businesses-selling-customers-other-states)
- [WA DOR — Delivery charges](https://dor.wa.gov/forms-publications/publications-subject/tax-topics/delivery-charges) — the shipping-tax gotcha
- [WAC 458-20-145](https://app.leg.wa.gov/wac/default.aspx?cite=458-20-145) — Sourcing
- [WAC 458-20-193](https://app.leg.wa.gov/wac/default.aspx?cite=458-20-193) — Interstate sales
- [WAC 458-20-110](https://app.leg.wa.gov/wac/default.aspx?cite=458-20-110) — Delivery charges
- [DOR Tax Rate Lookup Tool](https://webgis.dor.wa.gov/taxratelookup/SalesTax.aspx) — manual rate lookup (matches our API)
