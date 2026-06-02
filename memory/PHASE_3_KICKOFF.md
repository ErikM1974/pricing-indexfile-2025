# Phase 3 Kickoff — Unify the 5 Order Surfaces ("change a main element once")

> **Set 2026-06-02.** Erik approved Phase 3 and chose: **fresh session, start with Phase 3.1.**
> Read this FIRST, then the manifest: [quote-builder-architecture.md](quote-builder-architecture.md).

## The goal (Erik's words)
"We don't want everything to be exactly the same, but we want the **main elements to remain uniform.**"
**Principle: unify the LOGIC, not the look.** Keep each surface's own UX shell; extract the shared "main-element" modules so all surfaces feed off one source. **Each phase ships independently and is verified live — no flag day, no big-bang rewrite.**

## The 5 surfaces (all push to ManageOrders)
DTG (flagship, inline-form) · EMB · SCP · DTF (the "quote-builder" trio) · **Order Form** (`pages/order-form.html`, multi-method WIP). See manifest for the file list per surface.

## What's ALREADY shared (the proof this works)
- **All 7 pricing engines** — `{embroidery,cap-embroidery,screenprint,dtg,dtf,emblem,sticker}-pricing-service.js` are used by BOTH the builders AND the Order Form. Same math, different UI. *This is the model.*
- **The ManageOrders push** — every surface lands via the push path; the Order Form via `server.js /api/submit-order-form` → `NWCA-OrderForm`.
- **The PDF/invoice generator** — `shared_components/js/embroidery-quote-invoice.js` (`EmbroideryInvoiceGenerator`) is shared by the 4 builders (dispatches by `isDTG`/`isScreenprint`/`isDTF`/else=EMB). *(Order Form doesn't use it yet — a 3.5 item.)*

## Already DONE + DEPLOYED today (2026-06-02) — do NOT redo
Backend (caspio-pricing-proxy): base-PN size suffix (no double-stamp) v779 · global-unique design ExtDesignID v780 · Notes To Production v781 · tax block 2200.101/2202 + `buildSalesTaxNote` v782. Frontend (sanmar-inventory-app): PDF 2-page fit v1219 · DTG apiSource→blank routing v1220/v1221. Jest: `caspio-pricing-proxy/tests/jest/push-size-suffix.test.js` (9 tests) green.

## The phased plan
- **3.1 — shared `pricingData` contract** ← **START HERE** (lowest risk, foundation)
- 3.2 — unify sizes + per-size pricing (fixes 2XL upcharge across trio + Order Form)
- 3.3 — shared save/load base (promote `quote-builder-base.js`)
- 3.4 — promote common UI panels (size matrix, fee/customer panels, modals) to shared renderers
- 3.5 — fold DTG fully in + give the Order Form the shared invoice/size modules

---

## Phase 3.1 — concrete first steps
**Why first:** additive, behavior-preserving, and it locks the #1 main element (the invoice). It also formalizes the input shape — exactly where the DTG-$0 and SCP-double-tax bugs got in this spring.

**Step 1 — Map the 4 builders' pricingData builders** (the object each hands `embroidery-quote-invoice.js`):
- DTG: `dtgPrintQuote` in `dtg-inline-form.js` — builds `{product, lineItems[]}` from `_priceBySize` (already per-size).
- EMB: `buildEmbroideryPricingData` (in `embroidery-quote-builder.js` / its quote service).
- SCP: `buildScreenprintPricingData`.
- DTF: the DTF equivalent (in `dtf-quote-builder.js` / `dtf-quote-pricing.js`).
- List every field each one sets; diff them to find drift.

**Step 2 — Define the canonical contract.** One documented shape, e.g.:
`{ method, isDTG/isScreenprint/isDTF, product, lineItems:[{size, qty, unitPrice, lineTotal}], preTaxSubtotal, fees:[{label, amount}], discount, taxRate(decimal), taxAmount, includeTax, grandTotal, specs:{...method-specific...} }`
(Anchor on the fields the generator's total math already needs — `preTaxSubtotal` + `includeTax` + `taxRate` — those were the spring fixes. Don't change the generator's math; just feed it one consistent shape.)

**Step 3 — Build a shared builder/validator** (new `shared_components/js/quote-pricing-data.js`): a `buildPricingData(input)` that normalizes + a `validatePricingData(obj)` that throws on missing/malformed fields. Wire each builder to call it.

**Step 4 — Lock it with a jest test** that asserts all 4 builders produce a valid, foot-able pricingData (extend `tests/unit/invoice-totals.test.js`).

**Step 5 — Verify live, per builder, BEFORE/AFTER:** render the PDF via Preview (`mcp__Claude_Preview__preview_eval`, intercept `window.open`) and confirm the printed invoice is unchanged. Ship via `/deploy`.

## Gotchas to carry in
- **OneDrive silent-revert:** commit immediately after editing; verify with `git show HEAD:<file>`. (OneDrive reverted an un-committed batch mid-deploy on 2026-06-01 — commit-first.)
- **Proxy GET /quote_sessions is cached** — verify writes by PK_ID (`/quote_sessions/:id`), not `?QuoteID=`.
- Frontend deploy: `/deploy` skill (develop→main→Heroku, ~30s). Proxy: `git push heroku develop:main`.
- The invoice generator's total math was fixed this spring (taxes `preTaxSubtotal`, respects `includeTax`, shipping row). The contract must preserve those inputs.

## Tracked, NOT part of 3.1
- **2XL upcharge** — DTG has per-size (`_priceBySize`); trio + Order Form apply ONE unit price → no per-size upcharge. This is **Phase 3.2**. (Confirm with Erik whether SCP/DTF/EMB should upcharge 2XL on the push.)
- **Erik's ShopWorks side:** blank the kept "Manage Orders" integration's APISource field so blank-apiSource orders (all surfaces) import as the catch-all.
