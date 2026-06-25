# NEXT SESSION PICKUP — set 2026-06-04 PM (Erik powering off)

## 🔧 THE FIX FOR NEXT SESSION: AS-Garm stitch surcharge missing from EMB quote Subtotal

**Problem (Erik's #1 rule — silent wrong price):** On EMB orders that carry a **garment stitch
surcharge (`AS-Garm` = "Extra Stitches - Garments")**, the quote's displayed **Subtotal EXCLUDES
the AS-Garm charge**, but the **Tax base AND the pushed ShopWorks line items INCLUDE it**. So the
quote total is internally inconsistent and **under-counts vs what ShopWorks sums from the lines**.

**Evidence — order `EMB-TEST-2026-291`** (Erik pasted the converted order; a DECG full-back +
AS-Garm test order):
- Line items (what ShopWorks sums):
  - PC54 / M  ×24 @ $20 = $480
  - PC54 / 2XL ×4 @ $22 = $88
  - DECG-FB   ×28 @ $68.75 = $1925
  - **AS-Garm ×28 @ $4 = $112**
  - **Σ lines = $2605**
- Notes On Order said:
  - `Subtotal: $2493.00`  → = $480+$88+$1925 = **$2605 − $112 (AS-Garm excluded)**
  - `Tax Amount: $263.10` → = **10.1% × $2605** (AS-Garm INCLUDED in tax base)
  - `Total with Tax: $2756.10` → = $2493 + $263.10 (subtotal-excl-AS-Garm + tax-on-full)
- Net: Subtotal excludes AS-Garm, tax base + lines include it. ShopWorks will sum $2605 and apply
  its own tax → its invoice ≈ **$112 higher (pre-tax)** than the quote showed.

**Where to look:**
- `shared_components/js/embroidery-quote-builder.js` — the totals math. The `garment-stitch-fee-total`
  (AS-Garm) is fed into the **tax base** and emitted as a **pushed line**, but is NOT being added to
  the **`SubtotalAmount`** the quote stores/displays (`recalculatePricing()` for on-screen +
  `saveAndGetLink()` for the saved `SubtotalAmount`). The on-screen `#pre-tax-subtotal` is the
  authority — check whether IT includes AS-Garm.
- Push side: `caspio-pricing-proxy/lib/embroidery-push-transformer.js` `buildSalesTaxNote()` reads
  `session.SubtotalAmount` (= $2493) and `session.TaxAmount` (= computed on $2605). The mismatch
  originates in the BUILDER's totals, not the transformer — the transformer just echoes both.

**Hypothesis:** `SubtotalAmount` is computed as garments + DECG/other-fees but OMITS the AS-Garm
(garment stitch) surcharge, while `TaxAmount` is computed on the all-in total. Fix = include AS-Garm
in `SubtotalAmount` so subtotal / tax base / line items / grand total all agree.

**To confirm next session (fast):** Build an EMB order with a garment design >base stitches so
`AS-Garm` fires ($4 or $10 tier). Check: does `#pre-tax-subtotal` include the AS-Garm $/pc? Compare
to the tax base and the pushed `LinesOE`. **Also check `AS-CAP`** (cap stitch surcharge) for the
same bug, and whether it's all AS-Garm orders or only the DECG+AS-Garm combo. (291 is a DECG order,
so test a plain garment+AS-Garm order too.)

**Erik said:** leave this for next session, just make the notes. ✅ This is the note.

---

## ✅ STATE OF EVERYTHING ELSE (so we DON'T redo it)

### ShopWorks receiving outage — FIXED, DEPLOYED, VERIFIED (the big win 2026-06-04)
- **Root cause:** the OnSite "Manage Orders" integration's **APISource filter was set to
  `ManageOrders`** (a strict match-filter, not a label). Our pushes sent blank/`OrderForm`, so the
  integration silently dropped **100%** of orders. Proven with an A/B push (blank skipped vs
  `ManageOrders` imported = CTRL-B landed).
- **Erik's call:** keep the integration field = `ManageOrders`; stamp `APISource:"ManageOrders"` on
  EVERY push. **Every path now does:**
  - EMB/SCP/DTF transformers + `manageorders-push-config` ONSITE_DEFAULTS → **proxy Heroku v787** ✅
  - order-form/3DT/DTG via proxy `transformOrder` (forces it) → v787 ✅ (`server.js` apiSource also
    set to `ManageOrders`, commit `18f5e213`, **redundant + UNDEPLOYED** — rides next FE release)
  - Python InkSoft `transform.py` → **inksoft-transform Heroku v262** ✅
- **Verified end-to-end:** fresh EMB push `EMB-TEST-2026-294` pulled back with `APISource:ManageOrders`;
  and `EMB-TEST-2026-291` CONVERTED into ShopWorks (Erik's pasted JSON: APISource/APIType
  `ManageOrders`, `id_Integration:200`, all 4 lines + full notes + Milton pickup, 2XL→`PC54_2X`).
- LESSONS_LEARNED updated (the 06/02 "all-blank" entry → REVERSED to all-`ManageOrders`).

### ⚠️ GOTCHA learned: `/order-pull` (`/api/manageorders/orders/verify/:id`) can return a STALE
APISource right after a **re-push** of an already-uploaded ExtOrderID. I wrongly concluded "re-push
doesn't update" off that blank read — it DID update (the converted order showed `ManageOrders`).
**Trust the CONVERTED order / `getorderno`, not an immediate `/order-pull` after a re-push.**

### Test orders to DELETE in ShopWorks (all customer 3739, disposable):
`EMB-TEST-2026-291`, `EMB-TEST-2026-294`, `VERIFY-1/2/3-0604` (`NWCA-TEST-…`), `CTRLA/CTRLB-0604`,
and earlier `EMB-TEST-2026-271…292`. Also a throwaway Caspio draft quote **`EMB-2026-294`** (Quote_Sessions).
NOTE: blank-APISource ones (CTRL-A, VERIFY-1, 271–292) will NOT import (correct — they predate the fix).

### Open / unconfirmed:
- `getorderno` for 291/294 still returned `count:0` at session end — final ShopWorks `id_Order` was
  still syncing. Re-check next session that they resolved an `id_Order` (or were deleted).
- Two EXPECTED manual steps in ShopWorks per pushed EMB order (by design, not bugs): apply tax
  manually (notes carry rate/amount/acct), assign design when "NO DESIGN LINKED".
