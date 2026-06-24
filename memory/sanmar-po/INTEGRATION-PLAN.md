# SanMar PO — Integration Plan

Options ranked by value/effort, plus where each piece of code goes. Pairs with [README.md](README.md) and [FIELD-MAPPING.md](FIELD-MAPPING.md).

## Guiding principles

- **This is the first WRITE to SanMar** — money + irreversibility. Erik's #1 rule (wrong price/data is worse than an error) applies doubly: **never auto-submit silently, never swallow a `submitPO` fault.** Surface every failure; gate v1 behind a human-confirmed preview.
- **Don't build a PO builder from scratch** — ShopWorks already creates the PO (Caspio `PurchaseOrders`). The integration is *transmission*, not *creation*.
- **Reuse, don't fork** — the SOAP client, auth, and SanMar tables already exist. Adding PO = ~2 endpoints + request builders + a confirm UI.

## Onboarding is a prerequisite for ALL options

You cannot write to SanMar prod until onboarding + a passing multi-line test PO. See [ONBOARDING-CHECKLIST.md](ONBOARDING-CHECKLIST.md). Even Option A (read-only) needs Test-env creds. Start here.

---

## Option A — `getPreSubmitInfo` availability pre-check — 🟡 DRAFTED (uncommitted)

- **What:** read-only "can SanMar fill these qty/sizes to this destination state?" Places nothing. Returns Y/N per line + resolved `inventoryKey`/`sizeIndex`/`whseNo`.
- **Why first:** no money, fully reversible, and it (a) proves the PO pipe works on your existing SOAP foundation, (b) exercises Test-env onboarding, (c) validates your style+mainframe-color line mapping against SanMar's live data **before** any real PO.
- **STATUS (2026-06-23): backend drafted on `caspio-pricing-proxy` `develop` (uncommitted), tests green.** Done:
  - `src/utils/sanmar-soap.js`: added `ENDPOINTS.poStandard` / `poStandardTest`, `NS.standardPO`, `getStandardPOAuth(env)`, `buildPreSubmitInfoRequest({poNumber,shipTo,shipMethod,lines,auth})`, `parsePreSubmitInfoResponse(xml)` (+ exports).
  - `src/routes/sanmar-orders.js`: `POST /api/sanmar-orders/pre-submit-check?env=test|production`. Validates input loudly (Erik's #1 rule), gates on creds, surfaces auth/SOAP errors, returns `{ allAvailable, lines:[{available, whseNo, inventoryKey, sizeIndex, message}], ... }`.
  - `tests/jest/sanmar-pre-submit.test.js`: 6 tests, GREEN — parser locked vs the guide's two documented response scenarios; builder verified for per-line detail + XML-escaping.
- **REMAINING:**
  - Set SanMar **TEST** creds in proxy env: `SANMAR_TEST_CUSTOMER_NUMBER`, `SANMAR_TEST_USERNAME`, `SANMAR_TEST_PASSWORD` (after onboarding).
  - Live-fire with `templates/po-sample.json` against Test, confirm Y/N + resolved keys.
  - Frontend: a "Check SanMar availability" badge on `dashboards/quote-management.html` (it already has the `Inbound` column + refresh pattern). [not started]
  - Commit on a branch + deploy when Erik approves.
- **Effort:** S (backend done). **Risk:** ~zero (read-only).

## Option B — One-click "Order/Transmit Blanks to SanMar" — 🟡 BACKEND DRAFTED (uncommitted)

- **What:** staff opens a ShopWorks SanMar PO, sees a **previewed payload** (lines + ship-to + method) built from `po-payload.schema.json`, clicks confirm; proxy runs `getPreSubmitInfo` → `submitPO`, records the PO in `SanMar_Orders`, surfaces the result. You now own the PO number → exact linkage.
- **STATUS (2026-06-23): backend drafted on `caspio-pricing-proxy` `develop` (uncommitted), tests green.** Done:
  - `src/utils/sanmar-soap.js`: `buildSubmitPORequest()`, `parseSubmitPOResponse()` (success only when SanMar confirms), `consolidatePOLines()` (pure, dedups/sums) (+ exports).
  - `src/routes/sanmar-orders.js`: `POST /api/sanmar-orders/submit?env=test|production` with **6 guardrails** (Erik's #1 rule — never a silent/accidental order): (1) requires `confirm:true`; (2) defaults to TEST; (3) consolidates duplicate lines; (4) runs `getPreSubmitInfo` first and blocks a short order unless `allowShort:true`; (5) never reports success on a SanMar fault; (6) best-effort `SanMar_Orders` tracking write (production only) with a visible warning if it fails. **No auto-submit path — designed to sit behind a UI confirm.**
  - `tests/jest/sanmar-submit-po.test.js`: 8 tests, GREEN — parser locked vs the guide's success/error responses; consolidation + builder + XML-escaping verified.
- **REMAINING:**
  - Live-fire against **Test** after onboarding (uses the same `SANMAR_TEST_*` creds as Option A). Submit the multi-line `templates/po-sample.json`, confirm "PO Submission successful" + the Holding file.
  - Frontend: a builder/preview modal in the Production group (`staff-dashboard-v3/index.html:515-537`) [blocked for now — `quote-management.html` is owned by a parallel session]. Reuse `pages/order-form/inventory/inventory-check.js`, color/size pickers, `order-form-size-suffix.js`.
  - Confirm `SanMar_Orders` column names for the tracking write (`SanMar_PO`, `ShopWorks_PO`, `Matched_By`, `Last_Sync_Date` — mirrors the existing `/link` route).
  - Chosen ship mode (consolidation vs will-call); extended-size validation on real styles.
- **Effort:** backend done; UI + live-fire remain. **Risk:** Medium — first supplier write. **Mitigated by the 6 guardrails + a required human-confirmed preview. Keep a human in the loop.**

## Option C — Fully automatic PO on order confirmation — ⛔ NOT YET

- **What:** auto-submit on ShopWorks order push, or a nightly batch aggregating the day's blanks.
- **Why not:** irreversible supplier orders with no human review violates the spirit of the #1 rule (here: no *silent supplier orders*). One mis-mapped line or qty double-count ships + bills real product. The "when do we order blanks?" decision isn't even in code today — it's human.
- **Earn it** only after B runs clean for months, with idempotency keys + a tested cancel/backout path.

## Option D — Do nothing / let ShopWorks own it — the honest baseline

- ShopWorks OnSite already creates supplier POs. If staff are content re-keying into sanmar.com (or ShopWorks transmits them some other way), the integration may be solving little. **Confirm the manual-rekey actually happens** — that's the whole business case. If it doesn't, stop here.

---

## Recommended sequence

1. **Confirm the manual-rekey gap** (purchasing) — zero code.
2. **Onboard** (ONBOARDING-CHECKLIST.md) + **build Option A**.
3. Once A is clean → **Option B** (human-confirmed submit). Re-baseline nothing pricing-related (this doesn't touch the 3 price surfaces), but DO validate extended sizes + duplicate consolidation.
4. Treat **C** as someday-maybe.

## Transport choice: SOAP vs FTP

Prefer **SOAP Standard `submitPO`** (immediate response, comma-safe, reuses `sanmar-soap.js`). FTP flat-file adds file naming/batching, a separate `Release.txt` step, `Holding.txt` polling, and comma landmines — only worth it for high-volume batch. PromoStandards `sendPO` is an alternative SOAP flavor (more required-but-ignored fields); Standard `submitPO` is the leaner fit.

## Code touch-points (quick index)

| Piece | File |
|---|---|
| SOAP endpoints (add PO) | `caspio-pricing-proxy/src/utils/sanmar-soap.js:14-26` |
| SOAP auth (covers PO) | `…/sanmar-soap.js:40-54` |
| SOAP transport | `…/sanmar-soap.js:76-120` |
| New PO routes | `caspio-pricing-proxy/src/routes/sanmar-orders.js` (`/pre-submit-check`, `/submit`) |
| Mainframe color source | `…/src/routes/sanmar-product-data.js:704` |
| ShopWorks PO data | Caspio `PurchaseOrders` (read pattern: `…/src/routes/creditcard-lookups.js`) |
| Frontend home | `staff-dashboard-v3/index.html:515-537` (Production) + `dashboards/quote-management.html` |
| Inventory pre-check UI | `pages/order-form/inventory/inventory-check.js` |

> When code lands, add a back-pointer comment in the proxy route header → this folder, and update [../INDEX.md](../INDEX.md) + ACTIVE_FILES.md status from 🟡 to ✅.
