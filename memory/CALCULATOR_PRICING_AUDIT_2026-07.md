# Customer-Facing Calculator Pricing & Submit-Flow Audit

**Date:** 2026-07-01 · **Trigger:** follow-up to the `screenprint-customer` 4th-price-surface fix (that calculator was 100% hardcoded + actively wrong). Erik asked to sweep the rest.
**Method:** 30-agent workflow — discover every live calculator → deep-audit each (pricing source, hardcoded constants, 2 submit bugs) → **adversarially verify each hardcoded price against LIVE Caspio data** (hardcoded ≠ wrong; only hardcoded-AND-drifted is a real bug) → synthesize.
**Fix policy:** audit-and-report first; pricing fixes applied by hand with parity testing after Erik greenlights (same as the SCP fix went).

## Bottom line

**14 live calculators audited. NO calculator is auto-quoting a customer a wrong price today** — the SCP calculator was the one genuinely-broken surface, and it's already fixed. Findings:

- **1 CONFIRMED-WRONG number a human reads:** *Embroidery Pricing All* Full Back tab shows **LTM $100** where live Caspio says **$50** — but it's a **staff reference tab** (reps misinformed; no customer auto-quoted from it). One-line fix.
- **Laser Tumbler hardcoded file is DEAD CODE.** `laser-tumbler-calculator.js` has wrong prices ($16.68 vs live $19.50 etc.) BUT grep confirms **zero HTML loads it** — the live tumbler page (`laser-tumbler-polarcamel.html`) prices correctly through `jds-api-service.js` (Caspio-backed). So no customer sees the wrong numbers. Fix = delete the landmine.
- **1 live BACKEND rule-violation (in the proxy repo, not this one):** the Webstores Fundraiser AI-chat tool (`caspio-pricing-proxy/src/routes/contract-webstore-ai.js:42-47`) hardcodes `margin 0.43 / ccFee 0.035 / embellishment $15 / decoration $8` and quotes real fundraiser customers reading NONE from Caspio. Highest real risk of the lot because it's a live customer surface.
- **5 UNVERIFIABLE_NO_SOURCE** (hardcoded, violate Erik's rule, can't self-update, but not *provably* wrong): Webstores Setup, Leatherette Patch, Christmas Bundles, Webstores Fundraiser (frontend), Safety Stripe Creator.
- **7 MATCHES_LIVE / compliant** — hardcoded-but-currently-correct (latent drift risk) or already API-driven.
- **Submit-flow bugs** (the two we fixed in SCP, copy-pasted around): double-quote-ID in Webstores Setup + Leatherette Patch (+ dead laser file); email-masks-save in Webstores Setup + Christmas Bundles + Safety Stripe Creator (+ dead laser file).

## Ranked findings

| # | Calculator | Pricing verdict | Submit bugs | Severity | Recommended fix |
|---|---|---|---|---|---|
| 1 | **Embroidery Pricing All** (staff ref) | 🔴 CONFIRMED_WRONG | none | medium | Render Full Back LTM from `CONTRACT_PRICING.fullBack.ltmFee` (kills $100-vs-$50) |
| 2 | **Laser Tumbler (`laser-tumbler-calculator.js`)** | 🔴 CONFIRMED_WRONG *(dead code)* | double-ID + email-masks | low | **DELETE** orphaned file + quote-service; live page already correct |
| 3 | **Webstores Setup** | 🟠 UNVERIFIABLE_NO_SOURCE | double-ID + email-masks | medium | Wire logo→`DD`; add `WEB-*` Service_Codes; apply both SCP submit fixes |
| 4 | **Leatherette Patch** | 🟠 UNVERIFIABLE_NO_SOURCE | double-ID | medium | Fix double-ID; correct tier labels to live PATCH bands; real fix is out-of-repo DataPage |
| 5 | **Christmas Bundles** | 🟠 UNVERIFIABLE_NO_SOURCE | email-masks | medium | Erik-confirm retail values → Caspio table; decouple email from save; delete dead service |
| 6 | **Webstores Fundraiser** (backend AI) | 🟠 UNVERIFIABLE_NO_SOURCE | none | medium | DELETE dead frontend `.js`; **wire the LIVE backend** `contract-webstore-ai.js` defaults to Caspio |
| 7 | **Safety Stripe Creator** | 🟢 design-only ($0) | email-masks | low | Apply email-masks fix; no pricing change (design configurator) |
| 8 | **Richardson Factory Direct** | 🟢 MATCHES_LIVE | none | medium | Move `DIGITIZING_FEE`/`CAP_LTM_FEE` consts into the API loop; add fallback warning |
| 9 | **Manual Pricing 2026** (staff) | 🟢 MATCHES_LIVE | none | low | Replace hardcoded `50` with API `LTM_Fee`; fix stale "1-23" DTG note text |
| 10 | **Compare Pricing** (staff beta) | 🟢 MATCHES_LIVE | none | low | Wire LTM/SPSU/AS-Garm/AS-CAP overlays to already-live Caspio rows |
| 11 | **Contract DTG** (Ruth tool) | 🟢 MATCHES_LIVE | none | low | Latent: write API HW-upcharge var + tax-lookup into saved line items |
| 12 | **Service Price Cheat Sheet** (staff) | 🟢 MATCHES_LIVE | none | low | `LTM` row → `lookup('LTM')`; flag `Name/Number` + `HW-SURCHG` as no-source |
| 13 | **Embroidered Emblem** | 🟢 NOT_HARDCODED | none | low | Data-bind static accordion copy to fetched `rules` (drift only) |
| 14 | **Customer Supplied Screen Print** | ✅ NOT_HARDCODED *(fixed 07-01)* | both **FIXED** | none | Reference pattern — verified clean, no action |

## Key per-calculator detail

### 1. Embroidery Pricing All — the one active defect (staff-visible)
`index.html:573` hardcodes static text **`LTM Fee: $100.00`** for the Full Back tab; live `GET /api/contract-pricing` returns `fullBack.ltmFee = 50` (the same $50 shown elsewhere on the page). Reps reading this tab see a $100-vs-$50 self-contradiction. **Fix:** bind to the already-loaded `CONTRACT_PRICING.fullBack.ltmFee`. Secondary latent: Full Back `$20 min` (`|| 20.00`, always in effect since the API omits `minPrice`) and `$5` laser-patch upcharge (matches live today). Exemplary pattern to copy: its cap-upgrade fallback uses `|| 5.00` **and** a visible warning banner. No submit flow (no save/email).

### 2. Laser Tumbler — wrong numbers, but DEAD code
`laser-tumbler-calculator.js:30-33` flat prices are all live-wrong (1-23 $16.68 vs live **$19.50**; 24-119 $16.68 vs **$17.00**; 120-239 $16.10 vs **$16.50**; 240+ $15.53 vs **$16.00**), missing the $50 `JDS-LTM`, wrong tier boundaries. BUT **zero HTML references it** — the live page uses `laser-tumbler-simple.js` + `jds-api-service.js` (100% Caspio, visible failure toast). Fix = **DELETE** `laser-tumbler-calculator.js` + `laser-tumbler-quote-service.js` (confirm `simple.js` doesn't reference the service first) + update ACTIVE_FILES.md. Both submit bugs live in the dead file (would recur if revived).

### 6. Webstores Fundraiser — the audit's key catch (LIVE backend, out of this repo)
Frontend `webstores-fundraiser.js` is orphaned (delete it). But the **same constants are baked into the LIVE backend** `caspio-pricing-proxy/src/routes/contract-webstore-ai.js:42-47` `FUNDRAISER_DEFAULTS { margin:0.43, ccFee:0.035, embellishment:15.00, decorationCost:8.00 }` — its own comment says "match webstores-fundraiser.js line 71-74." That AI-chat tool quotes real fundraiser customers reading NONE from Caspio. `embellishment $15` already exists as `Service_Codes CATALOG-EMB-EST` → wire it; `decoration $8` → add a code; `margin 43%` / `ccFee 3.5%` are business-policy knobs (new `Fundraiser_Config` table or Erik owns them, with a "defaults not from Caspio" note until then). **Lives in the sibling proxy repo → separate deploy.**

### Submit-flow bugs (SCP pattern applies verbatim)
- **Webstores Setup** — both. double-ID (re-mints on error path) + email-masks (single try/catch in `sendQuote`).
- **Leatherette Patch** — double-ID only (`quote-service.js:79` calls `generateQuoteID()` with no arg; email-masks lives in the out-of-repo DataPage). Also tier labels drifted from live PATCH bands (metadata on the saved row, not the charge).
- **Christmas Bundles** — email-masks via a `Promise.race` 10s timeout that *rejects* into the outer catch → "error occurred" despite a saved quote. Free $0 sample flow, so retail numbers are VALUE displays not charges.
- **Safety Stripe Creator** — email-masks. Design-only ($0), no pricing change.

### 8–13. MATCHES_LIVE (latent-drift hardening only — no customer impact today)
Richardson Factory Direct (`DIGITIZING_FEE`/`CAP_LTM_FEE` consts match live but aren't read from the payload they already fetch), Manual Pricing 2026, Compare Pricing, Contract DTG, Service Price Cheat Sheet, Embroidered Emblem. All either already API-driven or hardcoded-but-currently-correct. Fix = move the last constants into the API loop + add fallback warnings so future Caspio edits propagate with no deploy.

## Suggested fix order (highest impact first)

1. **Embroidery Pricing All — Full Back LTM $100 → $50** (`index.html:573`). Only CONFIRMED-WRONG number a human reads; one-line bind. *(this repo)*
2. **Webstores Fundraiser backend** — wire `contract-webstore-ai.js:42-47` defaults to Caspio. Live customer-quoting surface silently ignoring Caspio — higher risk than any dead file. *(proxy repo, separate deploy, needs Erik's margin/ccFee policy call)*
3. **Delete Laser Tumbler dead code** — removes a revive-and-misprice landmine. *(this repo, zero-risk, grep-confirmed dead)*
4. **Submit-flow fixes (SCP pattern) where confirmed:** Webstores Setup (both), Leatherette Patch (double-ID), Christmas Bundles (email-masks/`Promise.race`), Safety Stripe Creator (email-masks). Prevents "saved but reported failed" + rep-can't-find-quote-by-shown-ID.
5. **Webstores Setup pricing → Service_Codes** (logo→`DD` now; add `WEB-*` rows so $300/$2/$10/$2,000 self-update); **Leatherette Patch tier-label** correction. *(needs new Caspio rows)*
6. **Christmas Bundles retail values** — Erik confirms → Caspio table or markup factor; add box/shipping codes. *(needs Erik)*
7. **Latent-drift hardening** on the 6 MATCHES_LIVE files. No customer impact; satisfies the no-hardcode rule so future Caspio edits propagate with no deploy.

## Caveats / honest notes
- The synthesis said "16 calculators" in one spot; discovery actually found **14** (laser-tumbler was double-counted conceptually — dead `-calculator.js` vs live `-simple.js`).
- "UNVERIFIABLE_NO_SOURCE" ≠ "wrong." It means the numbers are hardcoded with no live Caspio source to compare against — a rule violation and a self-update gap, but Erik must confirm the numbers are current before we can call any of them wrong.
- The Leatherette Patch and Webstores Fundraiser *real* price surfaces live outside this repo (a Caspio DataPage and the proxy backend respectively) — those can't be fixed from here.
