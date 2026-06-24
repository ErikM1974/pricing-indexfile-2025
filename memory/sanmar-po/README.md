# SanMar Purchase Order Integration (outbound PO submission)

**Status:** 🟡 REVIEW — assessment + buildable templates + **Option A (getPreSubmitInfo) AND Option B (submitPO) backends drafted (uncommitted)** in `caspio-pricing-proxy`, tests green. No code committed/deployed, no SanMar onboarding started, no UI yet.
**Created:** 2026-06-23 (from review of *SanMar Purchase Order Integration Guide v24.3*, Feb 2026).
**Owner decision pending:** whether to pursue at all (see "Decision log" + INTEGRATION-PLAN.md).
**Scope:** placing purchase orders *to* SanMar for blank goods (the WRITE side). This is **distinct** from the existing read-only SanMar integration (product/inventory/order-status/shipment/invoice), which is documented in [../SANMAR_API_REFERENCE.md](../SANMAR_API_REFERENCE.md).

> This folder is the single home for SanMar **PO-submission** knowledge + the templates that "become a PO." The actual implementation code, when built, lives in `caspio-pricing-proxy` (a back-pointer should be added there at build time).

---

## Bottom line (why this is tractable)

You already do everything this API needs **except the one step it automates.** Today ShopWorks creates the SanMar PO (Caspio `PurchaseOrders` table, 100k+ rows, SanMar is a vendor in `tbl_vendor_basics`), a human re-keys it into sanmar.com, SanMar ships, and the app pulls status/shipments/invoices back. This integration replaces the manual re-keying with a direct electronic submit — and because you'd then **own the PO number**, it eliminates the fragile "match SanMar orders to ShopWorks by style+date / manual linking" code in `caspio-pricing-proxy/src/routes/sanmar-orders.js`.

**What exists vs. what's missing**

| Need | Status |
|---|---|
| SanMar SOAP client (auth, XML, transport) | ✅ `caspio-pricing-proxy/src/utils/sanmar-soap.js` — generic `makeSoapRequest()` + `xmlEscape()`, both auth schemes (lines 40-54) |
| The PO data itself | ✅ ShopWorks already builds it (Caspio `PurchaseOrders`) |
| Line-item color SanMar wants | ✅ `SANMAR_MAINFRAME_COLOR` already in Caspio `Sanmar_Bulk` (`sanmar-product-data.js:704`) |
| Live stock pre-check | ✅ per-warehouse inventory already surfaced (`calculator-inventory.js`, quick-quote) |
| Place to store the acknowledgement | ✅ `SanMar_Orders` / `_Items` / `_Shipments` tables already exist |
| **`submitPO` / `getPreSubmitInfo` builders + endpoints** | ❌ **MISSING — the entire gap.** Every SanMar call today is read-only. |
| `inventoryKey` / `sizeIndex` stored in Caspio | ❌ Not stored — but the PO accepts `style+color+size` instead, and getPricing resolves the keys on demand. **Not a blocker.** See FIELD-MAPPING.md |

---

## Files in this folder

| File | What it is |
|---|---|
| `README.md` | This — status, bottom line, decision log, index |
| [BUILD-STATUS.md](BUILD-STATUS.md) | ⭐ **What's built where** — backend ✅ (proxy branch `sanmar-po-integration` @ `d5b47f1`) vs frontend ⛔ (not built; API contract ready). Start here to resume. |
| [INTEGRATION-PLAN.md](INTEGRATION-PLAN.md) | The options (A/B/C/D), recommended sequence, where each piece of code goes |
| [FIELD-MAPPING.md](FIELD-MAPPING.md) | Caspio / ShopWorks → SanMar PO field crosswalk; the inventoryKey/sizeIndex/color question, resolved |
| [ONBOARDING-CHECKLIST.md](ONBOARDING-CHECKLIST.md) | SanMar's onboarding/test-env steps with live status checkboxes |
| `templates/po-payload.schema.json` | ★ JSON Schema — the canonical PO shape (the "document that becomes a PO") |
| `templates/po-sample.json` | ★ A filled, schema-valid example = the multi-line test PO SanMar requires for go-live |
| `templates/submitPO.soap.xml` | Annotated SanMar Standard `submitPO` envelope (the real submit body) |
| `templates/getPreSubmitInfo.soap.xml` | Annotated `getPreSubmitInfo` envelope (read-only availability pre-check = Option A) |

## Related docs (don't duplicate — link)

- [../SANMAR_API_REFERENCE.md](../SANMAR_API_REFERENCE.md) — the READ-side SanMar bible (endpoints, auth, **sizeIndex ordinal**, color system, warehouses). Its "PO Submission" section points here.
- [../SANMAR_TO_SHOPWORKS_GUIDE.md](../SANMAR_TO_SHOPWORKS_GUIDE.md) / [../SHOPWORKS_SIZE_MAPPING.md](../SHOPWORKS_SIZE_MAPPING.md) — size/color/SKU transforms.
- Source PDF: `~/Downloads/SanMar-Purchase-Order-Integration-Guide-24.3.pdf` (text dump was at `~/Downloads/sanmar-po-guide.txt` during the 2026-06-23 review).

---

## Decision log

| Date | Decision / note |
|---|---|
| 2026-06-23 | Reviewed PO Guide v24.3. Found existing SanMar integration is 100% read-only; PO submission is the only missing piece and the SOAP foundation makes it incremental. Confirmed ShopWorks already creates supplier POs (Caspio `PurchaseOrders`). Recommendation: confirm the manual-rekey gap, then build **Option A (getPreSubmitInfo)** first as a no-money proof, then **Option B (one-click human-confirmed submit)**; treat **Option C (full auto)** as someday-maybe. Captured this folder + templates. **No build authorized yet.** |
| 2026-06-23 | **Drafted Option A** (uncommitted, on `caspio-pricing-proxy` `develop`): `POST /api/sanmar-orders/pre-submit-check` (read-only availability check, env-aware test/prod). Added `poStandard`/`poStandardTest` endpoints, `NS.standardPO`, `getStandardPOAuth()`, `buildPreSubmitInfoRequest()`, `parsePreSubmitInfoResponse()` to `src/utils/sanmar-soap.js`; route in `src/routes/sanmar-orders.js`. Locked by `tests/jest/sanmar-pre-submit.test.js` (6 tests, GREEN — parser verified vs the guide's two documented response scenarios). **NOT committed/deployed; needs SanMar TEST creds (`SANMAR_TEST_*` env) to run live.** |
| 2026-06-23 | **Drafted Option B** (uncommitted, same checkout): `POST /api/sanmar-orders/submit` — the real billable `submitPO` write, with 6 guardrails (confirm:true, default TEST, line consolidation, availability gate w/ allowShort, no-false-success, best-effort SanMar_Orders tracking write). Added `buildSubmitPORequest()`, `parseSubmitPOResponse()`, `consolidatePOLines()` to `sanmar-soap.js`. Locked by `tests/jest/sanmar-submit-po.test.js` (8 tests, GREEN). **No auto-submit — needs a UI confirm + TEST creds.** Next: Erik review → onboard → set `SANMAR_TEST_*` → live-fire `templates/po-sample.json` (A then B) on Test → build the Production-group preview/confirm UI (frontend badge/modal currently blocked: `quote-management.html` owned by a parallel session). |

## Next action

1. Confirm with purchasing that SanMar POs are re-keyed by hand today (that's the business case).
2. If yes → start ONBOARDING-CHECKLIST.md (email `sanmarintegrations@sanmar.com`) and build Option A per INTEGRATION-PLAN.md.
