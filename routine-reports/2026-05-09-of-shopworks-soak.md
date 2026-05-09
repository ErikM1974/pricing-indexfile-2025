# OF-* ShopWorks Routing Soak Audit — 2026-05-09

**Audit window:** 2026-05-02 → 2026-05-09 (1-week post-refactor soak)  
**Refactor:** proxy v606→v608 + main app v903→v907 (2026-05-02)  
**Auditor:** Claude Code (automated, read-only)  
**Status:** ⚠️ CANNOT FULLY VERIFY — ZERO LIVE OF-* ORDERS IN SOAK WINDOW

---

## Pass/Fail Summary

| Check | Result | Notes |
|---|---|---|
| OF-* orders exist in ShopWorks (2026-04-21–05-09) | ❌ NONE FOUND | 225 orders queried; 0 with OF-* identifiers |
| `APISource === 'OrderForm'` (code) | ✅ PASS | server.js:2558 |
| `id_Integration === 208` (proxy config) | ⚠️ UNVERIFIABLE | Set in proxy; no access to proxy source |
| `id_Customer` = real ID (not 2791) | ✅ PASS (code) | server.js:2541; no orders to confirm live |
| `CustomerServiceRep` is full name | ✅ PASS (code) | SALES_REP_FULL_NAMES maps all 5 reps correctly |
| `id_EmpCreatedBy` per rep table | ✅ PASS (code) | jim=1, erik=2, ruth=24, nika=169, taneisha=281 |
| `id_OrderType` per method | ✅ PASS (code) | emb=21, sp=13, dtg=5, dtf=18, sticker=41, emblem=7, default=6 |
| `id_DesignType` per method | ✅ PASS (code) | emb=2, sp=1, dtg=45, dtf=8, sticker=4, emblem=5 |
| `Designs: []` when no design# | ✅ PASS (code) | server.js:2339-2351; 0 and non-integer filtered |
| `id_Design > 0` (no orphan risk from design object) | ✅ PASS (code) | filter: `n > 0 && n < 1000000` |
| `LinesOE[].Color` = abbreviated CATALOG_COLOR | ✅ PASS (code) | server sends `catalogColor`; proxy v606+ maps it to Color |
| Orphan designs created since 2026-05-02 | ⚠️ UNVERIFIABLE | No design-by-date endpoint on proxy |
| Real-customer routing hit rate | N/A | 0 OF-* orders to measure |

**Overall verdict: ⚠️ DEVIATIONS FOUND** — not regressions in the code, but a critical gap: **zero OF-* orders have reached ShopWorks** during the soak period, making field verification impossible.

---

## Critical Finding: Zero OF-* Orders in ShopWorks

### What was checked

1. **ManageOrders PULL API** — queried all orders from 2026-04-21 to 2026-05-09 (225 total):
   - 0 orders with `CustomerPurchaseOrder` containing `OF-` or `NWCA-OF-`
   - 0 orders with `id_Customer = 2791` (order form catch-all)
   - 0 `DesignName` values matching `* — Embroidery`, `* — DTG`, etc.

2. **`getorderno` lookup** — probed NWCA-OF-0001 through NWCA-OF-0060 AND OF-0001 through OF-0060:
   - All 120 lookups returned `{"result":[],"count":0}` — no ExtOrderIDs registered in ShopWorks

3. **Sequence counter** — `/api/quote-sequence/OF` returned `sequence: 38`:
   - 38 OF-* IDs have been allocated (drafts created or direct submits initiated)
   - Despite 38 allocations, zero corresponding ShopWorks orders exist

4. **Caspio `quote_sessions`** — `/api/quote_sessions?quoteID=OF-NNNN` for all 38 IDs:
   - All returned `[]`. The proxy's quote_sessions GET endpoint appears to have a hardcoded filter returning only EMB-* sessions; OF-* sessions are not queryable via this path.

### Most likely explanations (mutually exclusive)

A. **Staff is using the form for draft/quote generation only** — 38 drafts saved and shared with customers for approval, but no one has clicked the final Submit button yet. This would be normal for a form in early rollout.

B. **Submissions are failing at the ShopWorks push** — `POST /api/submit-order-form` reaches server.js but the downstream `POST /api/manageorders/orders/create` returns an error; sessions get marked `Status: 'Processed - ShopWorks Failed'`. The Heroku logs for server.js would show `[Order Form Submit] Push failed:` entries.

C. **The submit button is broken on the deployed page** — JavaScript error prevents `POST /api/submit-order-form` from being called at all.

**Recommendation:** Pull last 7 days of Heroku logs for `pricing-indexfile-2025` and grep `[Order Form Submit]`. Presence of `✓ Pushed OF-` confirms A (orders exist, just outside our query window or with different PO format). Presence of `Push failed:` confirms B. Absence of any `[Order Form Submit]` lines confirms C.

---

## Real-Customer Routing Hit Rate

**N/A — zero OF-* orders in ShopWorks.**

In the broader 225-order PULL result (2026-04-21 to 2026-05-09):
- `id_Customer = 2791` count: **0** (good — no catch-all usage from any submission path)
- All named CSRs are full canonical names (Jim Mickelson, Erik Mickelson, Ruthie Nhoung, Nika Lao, Taneisha Clark, House)

---

## Per-Order Audit Table

No OF-* orders found to audit. Table would appear here once live orders exist.

| Order# | Customer | id_Customer | CSR | id_EmpCreatedBy | id_OrderType | id_DesignType | id_Design | Color sample | Issues |
|---|---|---|---|---|---|---|---|---|---|
| — | — | — | — | — | — | — | — | — | No orders found |

---

## Code Implementation Audit (server.js v907)

All 2026-05-02 fixes verified correct in source:

### `apiSource: 'OrderForm'` ✅
```javascript
// server.js:2558
apiSource: 'OrderForm'
```

### `idCustomer` routing ✅
```javascript
// server.js:2541
idCustomer: Number(info.companyId) || 2791,
```
Real ShopWorks customer ID from autocomplete; 2791 only for brand-new typed names.

### Sales rep full-name + empId mapping ✅
```javascript
// server.js:1982-2018
const SALES_REP_FULL_NAMES = {
  nika: 'Nika Lao', taneisha: 'Taneisha Clark',
  erik: 'Erik Mickelson', ruth: 'Ruthie Nhoung', jim: 'Jim Mickelson',
};
const SALES_REP_EMP_IDS = { jim: 1, erik: 2, ruth: 24, nika: 169, taneisha: 281 };

// server.js:2530, 2545
salesRep: SALES_REP_FULL_NAMES[info.salesRep] || info.salesRep || '',
idEmpCreatedBy: SALES_REP_EMP_IDS[info.salesRep] || 2,
```
All 5 reps match spec exactly.

### Order type IDs ✅
```javascript
// server.js:2323-2324
const ORDER_TYPE_ID = { embroidery: 21, screenprint: 13, dtg: 5, dtf: 18, sticker: 41, emblem: 7 };
const ORDER_TYPE_DEFAULT = 6;
```

### Design type IDs ✅
```javascript
// server.js:2304
const DESIGN_TYPE_ID = { embroidery: 2, screenprint: 1, dtg: 45, dtf: 8, sticker: 4, emblem: 5 };
```

### Design auto-link (Phase B) ✅
```javascript
// server.js:2339-2351
const linkedIdDesigns = (Array.isArray(designNumbers) ? designNumbers : [])
  .map(n => Number(String(n || '').trim()))
  .filter(n => Number.isInteger(n) && n > 0 && n < 1000000);
const designs = linkedIdDesigns.length === 0 ? [] : methodsUsed.map(...);
```
Empty array when no valid integer design#. `id_Design: 0` is impossible (filtered by `n > 0`).

### CATALOG_COLOR for LinesOE.Color ✅
```javascript
// server.js:2138-2187
const color = r.colorName || r.color || '';        // display name
const catalogColor = r.catalogColor || r.color || ''; // CATALOG_COLOR
lineItems.push({ ..., color: color, catalogColor: catalogColor, ... });
```
Server sends both; proxy v606+ uses `catalogColor` for ShopWorks `LinesOE.Color`.

---

## Anomaly Section

### A1 — Zero OF-* Orders in ShopWorks ⚠️ HIGH PRIORITY
**Spec section violated**: All of §Online Order Form (MANAGEORDERS_COMPLETE_REFERENCE.md:1674)  
**Detail**: Soak audit was designed to verify production traffic. Without live orders, field verification of routing, customer ID resolution, color codes, design IDs, and CSR names is impossible.  
**Action**: Check Heroku logs; determine if form is being used for drafts only or if submits are failing.

### A2 — quote_sessions GET endpoint doesn't expose OF-* sessions ℹ️ LOW
**Detail**: `GET /api/quote_sessions?quoteID=OF-NNNN` returns `[]` for all 38 OF-* IDs. The proxy endpoint appears hardcoded to EMB-* sessions. This prevents the audit tool from querying session status (Draft vs Processed vs Processed-Failed).  
**Action**: Not a blocker, but a future proxy endpoint enhancement would help monitoring.

### A3 — CSR='DEAD' on order 141683 ℹ️ INFO ONLY
**Detail**: Gordon Trucking order has CSR='DEAD' in ShopWorks — clearly a pre-existing manual entry, not related to order form routing. No action required.

### A4 — Sequence counter consumed by audit tool ℹ️ INFO
**Detail**: Calling `GET /api/quote-sequence/OF` during this audit likely incremented the counter from 37→38 (the endpoint allocates on each call). OF-0038 is now an orphaned sequence number with no corresponding session. Recommendation: The sequence endpoint should have a read-only "peek" variant to avoid consuming IDs during monitoring.

---

## Orphan Designs

**Cannot verify** — no design-by-creation-date endpoint is exposed through the proxy. The ShopWorks ManageOrders PULL API's `/orders` endpoint does not include a `DateDesignCreated` filter.

**Code guarantee**: server.js:2343-2351 ensures `Designs: []` when no valid integer design# is provided. When a design# IS provided, id_Design is validated as `> 0` and `< 1000000` before inclusion. The latent orphan-creation bug (described in spec §Phase B) was fixed in v906/v907. If any orphans exist from before 2026-05-02, they predate this fix and are out of scope for this soak audit.

---

## Data Sources & Methodology

| Source | Method | Result |
|---|---|---|
| ManageOrders PULL `/orders` | `date_Ordered_start=2026-04-21&date_Ordered_end=2026-05-09` | 225 orders, 0 OF-* |
| ManageOrders PULL `/getorderno` | NWCA-OF-0001…0060 + OF-0001…0060 | 120 lookups, all empty |
| Quote sequence counter | `GET /api/quote-sequence/OF` | sequence=38 |
| Caspio quote_sessions | `quoteID=OF-NNNN` for IDs 0001-0038 | All `[]` |
| server.js code audit | Read source at v907 | All mappings correct |

---

*Report generated: 2026-05-09 by automated routine audit*  
*Spec reference: `/memory/MANAGEORDERS_COMPLETE_REFERENCE.md` §Online Order Form (line 1674)*
