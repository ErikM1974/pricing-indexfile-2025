# Quote-Builder → ShopWorks Field Coverage Audit

**Date:** 2026-06-01
**Scope:** EMB / SCP / DTF quote builders → ManageOrders PUSH API (`/onsite/order-push`) → ShopWorks.
**Reference schema:** `caspio-pricing-proxy/memory/MANAGEORDERS_PUSH_TEMPLATE.md` (full ExternalOrderJson).
**Verdict:** All three push real orders into ShopWorks like DTG. We populate the large majority of relevant fields. Remaining gaps are either intentional (customer object, payments) or minor/documented.

Releases: BE `caspio-pricing-proxy@c7b861a`, FE `sanmar-inventory-app v1208` (tag `v2026.06.01.2`).

---

## 1. Order-level fields

| Field | EMB | SCP | DTF | Notes |
|---|:--:|:--:|:--:|---|
| ExtOrderID (year-safe) | ✅ | ✅ | ✅ | Shared `buildExtOrderID` → `EMB-2026-…` / `SCP-2026-…` / `DTF-2026-…` |
| ExtSource / ExtCustomerPref | ✅ | ✅ | ✅ | `NWCA-EMB/SCP/DTF` |
| id_OrderType | 21 | 13 | 18 | Custom Embroidery / Screen Print Subcontract (4200) / Transfers (4005) |
| id_Customer | ✅ | ✅ | ✅ | From `session.CustomerNumber`; fallback 3739 if blank. **SCP capture fixed 2026-06-01.** |
| id_DesignType (new design) | 2 | 1 | 8 | |
| date_OrderPlaced / RequestedToShip / DropDead | ✅ | ✅ | ✅ | |
| Contact (name/email/phone) | ✅ | ✅ | ✅ | |
| CustomerPurchaseOrder | ✅ | ✅ | ✅ | |
| CustomerServiceRep | ✅ | ✅ | ✅ | Mapped from sales-rep email |
| Terms | ✅ | ✅ | ✅ | |
| TaxTotal | 0 | 0 | 0 | Intentional — OnSite calcs from line flags; rate+account in Notes |
| coa_AccountSalesTax01 | ✅* | ✅* | ✅* | *Sent, but **not echoed** by MO→SW conversion (see Open Items) |
| cur_Shipping | ✅ | ✅ | ✅ | |
| TotalDiscounts | ✅ | ✅ | ✅ | |

**TaxRate storage differs by builder (by design):** EMB stores a **decimal** (`0.101`); SCP/DTF store a **percent** (`10.1`) normalized via `toRateDecimal()`. Verified across 11 real EMB quotes.

---

## 2. Line items (`LinesOE[]`)

| Field | Status | Notes |
|---|:--:|---|
| PartNumber (+ size suffix) | ✅ | `getPartNumber()` — `_2X`, `_3XL`, `_OSFA`, etc. CSV-verified (15,151 SKUs) |
| Description / Color / Size / Qty / Price | ✅ | |
| id_ProductClass | ✅ | 1 |
| ExtDesignIDBlock | ✅ | SCP/DTF lines carry `G-<seq>`; **now links** to the design's `ExtDesignID` (fixed 2026-06-01). EMB links at order level (line block blank, by design). |
| sts_EnableTax01-04 / sts_TaxOverride | ✅ | Sent on every line. **NOTE:** MO strips these in the SW conversion — watch line-tax on a taxable order. |
| LineItemNotes / WorkOrderNotes | ⬜ | Empty — per-line notes not used today (order-level Notes cover it) |
| playerName (NameFirst/Last) | ⬜ | Not used (no name/number personalization in these builders) |

**Fees → LinesOE:** the builder emits service items by exact ShopWorks part number; the transformer routes any `KNOWN_FEE_PNS` match to a line, else to a note. Verified landing: `SPSU`, `Art`, `GRT-75`, `RUSH`, `AS-Garm`, `AS-CAP`, `DD`, **`3D-EMB` (3D puff)**, **`Laser Patch` (leatherette)**.

---

## 3. Designs (`Designs[]`)

| Field | Status | Notes |
|---|:--:|---|
| Existing design → `id_Design` | ✅ | Garment + cap separately (EMB) |
| New design → `DesignName` | ✅ | **Fixed 2026-06-01** (was `name`, which MO ignored → blank) |
| `ExtDesignID` | ✅ | **Added 2026-06-01** — `G-<seq>` so lines link |
| `id_DesignType` / Locations[] | ✅ | |
| Location.ImageURL (artwork) | ✅ | Hosted via `/api/files/{externalKey}` (serves image/png; ShopWorks-pullable) |
| Location.TotalStitches (EMB) | ✅ | **Added 2026-06-01** — garment `StitchCount` / cap `CapStitchCount` |
| Location.TotalColors (SCP) | ✅ | **Added 2026-06-01** — front + back ink colors |
| Location.details[] (thread colors) | ⬜ | Not sent — possible future enhancement |

---

## 4. Notes (`Notes[]`)

We use **5–7 of the 9** OnSite note lanes: Notes On Order, To Art, To Production, To Purchasing, To Shipping. **Confirmed landing** in the MO→SW conversion (tax account, "NO DESIGN LINKED", line-item summary, ship-to).

Unused lanes that *could* fit us: **Notes To Subcontract** (SCP is a subcontract order type) and **Notes To Accounting** (tax/terms).

---

## 5. Intentionally NOT sent

| Block | Why |
|---|---|
| **Customer object** (billing, tax-exempt, type, custom fields) | We attach to the **existing** ShopWorks customer via `id_Customer`; its record supplies these. Only relevant for NEW-customer creation. |
| **Billing address** | Comes from the customer record |
| **Payments[]** | **No online payments yet.** Schema is ready (`status:"success"`, gateway, authCode, amount, fees) when Stripe is added. |
| **files[] base64 upload** | We use `Designs[].Locations[].ImageURL` (hosted URL) instead — works, lighter payload |

---

## 6. Open items (non-blocking)

1. **`coa_AccountSalesTax01` not echoed** by the MO→SW conversion → the SW tax-account dropdown won't auto-fill. Mitigated: account + rate are in Notes On Order for the operator. Fixing it is an **OnSite integration-mapping** change, not code.
2. **`/verify/:extOrderId` 400s** on all three (MO order-pull rejects the param) → no automated post-push verification. Push success is still confirmed by MO's `"has been uploaded"` response.
3. **Per-line `sts_EnableTax*` stripped** in conversion + `TaxTotal:0` → operator sets tax. Fine for the tax-in-Notes model; watch on a fully taxable order.
4. **EMB tax robustness** — EMB lacks SCP/DTF's `toRateDecimal()`; only bites if an EMB quote ever stored a percent (real EMB data is decimal). Latent hardening.
5. **OnSite integration config** — confirm the `NWCA-SCP`/`NWCA-DTF` integrations leave Order/Design Type **blank** so the payload's 13/18 win. (Live tests show integration 200 does NOT override, so likely already fine.)

---

## 7. Fixed 2026-06-01 (this effort)

- SCP/DTF order Notes key `NotesOnOrders` → `Notes` (notes were being dropped)
- SCP ship-to: correct schema + source columns (was blank)
- Year-safe `ExtOrderID` (shared `buildExtOrderID`; was daily-colliding)
- EMB push route: zero-line + $0-price guards
- DTF: review-before-push preview modal + gate lift
- New-design `name` → `DesignName` (was blank in SW)
- Design enrichment: `ExtDesignID` line-link, EMB stitch counts (garment+cap), SCP ink colors
- **SCP customer-# capture** (builder never saved `id_Customer` → orders hit fallback 3739)

Live conversion-JSON verified: `DTF-TEST-2026-0317-7906`, `SCP-TEST-2026-0601-9001`, `EMB-TEST-2026-9001`, `EMB-TEST-2026-9002` (cap + 3D-puff + leatherette).
