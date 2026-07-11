# SanMar PO Integration — Build Status (Backend ✅ / Frontend ⛔)

**As of 2026-06-23.** Single source of truth for *what is built where*. Backend is drafted + committed on a branch; frontend is not started. Nothing is deployed; nothing runs live until SanMar onboarding + creds.

| Layer | Status | Where |
|---|---|---|
| **Backend (proxy)** | ✅ **BUILT** (drafted, committed, tests green — NOT merged/deployed) | `caspio-pricing-proxy`, branch **`sanmar-po-integration`** @ **`d5b47f1`** |
| **Frontend (pricing-index)** | ⛔ **NOT BUILT** (planned; contract ready below) | `Pricing Index File 2025` (this repo) |
| SanMar onboarding | ⬜ not started | see [ONBOARDING-CHECKLIST.md](ONBOARDING-CHECKLIST.md) |

---

## ✅ Backend — what's built (proxy branch `sanmar-po-integration` @ `d5b47f1`)

Commit: `feat(sanmar): draft SanMar PO Integration backend (getPreSubmitInfo + submitPO)` (+830/−6, 4 files).

**`src/utils/sanmar-soap.js`** (extends the existing shared SOAP client — no new deps):
- `ENDPOINTS.poStandard` / `poStandardTest`, `NS.standardPO`, `getStandardPOAuth(env)`
- Option A: `buildPreSubmitInfoRequest()`, `parsePreSubmitInfoResponse()`
- Option B: `buildSubmitPORequest()`, `parseSubmitPOResponse()`, `consolidatePOLines()`

**`src/routes/sanmar-orders.js`** (2 new routes):
- `POST /api/sanmar-orders/pre-submit-check` — Option A, READ-ONLY availability check
- `POST /api/sanmar-orders/submit` — Option B, the real billable `submitPO` write, 6 guardrails

**Tests** (`tests/jest/`): `sanmar-pre-submit.test.js` (6) + `sanmar-submit-po.test.js` (8) — **14 GREEN**, parsers locked vs the guide's documented responses.

**To resume the backend:** `git checkout sanmar-po-integration` in the proxy → set env creds (below) → live-fire on Test → merge to `develop` → deploy.

**Env vars needed** (after onboarding; TEST creds are separate per SanMar):
`SANMAR_TEST_CUSTOMER_NUMBER`, `SANMAR_TEST_USERNAME`, `SANMAR_TEST_PASSWORD` (test) · existing `SANMAR_CUSTOMER_NUMBER/USERNAME/PASSWORD` (prod, `?env=production`).

---

## ⛔ Frontend — what's NOT built (and the contract to build it)

**Nothing is wired in the UI yet.** Planned home: the **Production group** on `staff-dashboard-v3/index.html:515-537`. A badge/modal on `dashboards/quote-management.html` is the natural spot **but is currently OFF-LIMITS** — a parallel session owns that file (a "SanMar daily inbound" feature). Build the FE only once that's clear, or use a standalone Production-group page.

**Planned FE pieces:**
1. **Availability badge (Option A)** — a "Check SanMar stock" action on an order/PO row → `POST /pre-submit-check` → show per-line ✅/❌ + warehouse. Read-only, safe.
2. **PO preview + confirm modal (Option B)** — render the `po-payload.schema.json` payload for staff review (lines, ship-to, method) → on **explicit confirm** → `POST /submit` with `confirm:true`. NEVER auto-submit. Show the returned `message` + per-line result; surface any error visibly (Erik's #1 rule).

Reuse: `shared_components/js/sanmar-inventory-check.js` (moved 2026-07-11, ex `pages/order-form/inventory/inventory-check.js`), the color/size pickers, `order-form-size-suffix.js`. Call via `APP_CONFIG.API.BASE_URL` (never hardcode the proxy URL).

### API contract (so wiring is unambiguous later)

**A — availability check (read-only):**
```
POST {BASE_URL}/api/sanmar-orders/pre-submit-check?env=test
body: { poNumber, shipTo:{companyName,address1,city,state,zip,email,residence}, shipMethod,
        lines:[{ style, color /*SANMAR_MAINFRAME_COLOR*/, size, quantity, inventoryKey?, sizeIndex? }] }
200 → { allAvailable, lines:[{ style,color,size,quantity, available, whseNo, inventoryKey, sizeIndex, message }], ... }
400 → missing field   401 → auth failed
```

**B — submit PO (real, billable — guarded):**
```
POST {BASE_URL}/api/sanmar-orders/submit?env=test
body: <same as A> + { confirm:true, allowShort?:bool, shopworksPO?:string }
200 → { submitted:true, message:"PO Submission successful", consolidatedLineCount, preCheck:{...}, tracking:{persisted} }
400 → confirm!==true OR bad input   409 → a line is short (resend allowShort:true)   401 → auth   502 → SanMar rejected
```
Guardrails enforced server-side: `confirm:true` required, defaults to TEST, consolidates duplicate lines, availability gate, never false-success, best-effort `SanMar_Orders` tracking write (prod only).

---

## Resume checklist (come-back-later)

1. SanMar onboarding ([ONBOARDING-CHECKLIST.md](ONBOARDING-CHECKLIST.md)) → get TEST creds → set `SANMAR_TEST_*` in the proxy.
2. Proxy: `git checkout sanmar-po-integration`. Live-fire `templates/po-sample.json` → `pre-submit-check` then `submit` (`?env=test`). Confirm "PO Submission successful" + Holding file.
3. Validate extended/multi-SKU sizes (the `PC54_2X`→`Size05` class) on real styles.
4. Build the FE (badge + confirm modal) per the contract above — after the parallel `quote-management.html` work is clear.
5. Merge `sanmar-po-integration` → `develop` → deploy (proxy). Then deploy the FE.
6. Flip statuses 🟡→✅ here, in [README.md](README.md), [INTEGRATION-PLAN.md](INTEGRATION-PLAN.md), and `ACTIVE_FILES.md`.
