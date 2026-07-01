# TeamNWCA.com Catalog → Pricing → Quote → PDF: UX Audit & Enhancement Proposal

**Date:** 2026-07-01 · **Requested by:** Erik · **Author:** Claude (code audit, 3 parallel deep-dives)
**Scope:** the 4 areas Erik asked to review — (1) how customers get pricing, (2) the quote process landing→final view, (3) product discovery + embellishment selection, (4) generating a quote and a printable PDF.
**Cross-checked against:** `CUSTOMER_SITE_REDESIGN_2026-06.md` (+`_FINDINGS.md`), `CUSTOMER_QUOTE_CART_DESIGN_2026-06.md`, `PRICING_ENGINE_AUDIT_2026-06.md`, `TODO_QUOTE_ACCEPTANCE_EMAILS.md` — so this doesn't re-propose work that's already shipped or already backlogged. Where a finding below duplicates existing backlog, it says so and links it instead of restating it.

## Bottom line

The architecture is unusually disciplined for a site this size: **one pricing engine** (`QuoteCartEngine.singleItemPreview` / `.priceCart`, `shared_components/js/quote-cart-engine.js`) feeds the Customer Catalog product page, Quick Quote, the customer Quote Cart, and all 4 staff quote builders. The 2026-06-20 17-agent pricing audit already confirmed **no active wrong-price bug** — every headline price is single-source and Caspio-driven. That means this proposal is **not** about fixing broken pricing. It's about **what's shown to the customer, and when** — fee/LTM disclosure timing, terminology consistency across touchpoints, two storefronts that dead-end without a real quote/PDF, and a handful of already-tracked polish items that just haven't been picked up yet.

Nothing in this document proposes a new pricing formula, a 4th price surface, or hardcoded numbers — every recommendation either surfaces data the engine already computes, or reuses an existing pattern (`probeLadder()`, `singleItemPreview()`, `Service_Codes`) from elsewhere in the codebase. Per CLAUDE.md Rule 9, any change here still requires re-running `web-quote-cart-parity` + `quick-quote-parity` if it touches a file the pricing tests cover.

**✅ Update 2026-07-01 — P0 item #2 (Screen Print Customer calculator) turned out worse than flagged, now FIXED.** A closer read of `calculators/screenprint-customer/screenprint-customer-calculator.js` found it wasn't just missing a tier ladder — it was **100% hardcoded pricing, a 4th price surface fully disconnected from Caspio/`QuoteCartEngine`** (wrong tier boundaries, a flat $100 LTM vs. the real $50-only-at-24-47, and the pre-2026-06-11 dark-garment bug that inflates the per-piece price). Fixed by adding a `customerSuppliedGarment:true` option to `quote-cart-engine.js`'s `priceScpGroup` — routes to the existing `ScreenPrintPricingService.generateManualPricingData(0)` pattern (same manual-cost machinery Order Form and the manual calculator already use) — so the calculator now calls the exact same `QuoteCartEngine.singleItemPreview()` Quick Quote uses. Live-verified against the real API, browser-verified in preview, locked by `tests/unit/screenprint-customer-parity.test.js` (9 tests), zero regressions across all 1477 existing unit tests. Full writeup → `LESSONS_LEARNED.md`.

---

## 1. Current State — the 4 requested areas

### 1a. Usage & how customers obtain pricing

| Touchpoint | File | What it shows | Fees visible up front? |
|---|---|---|---|
| Product page configurator | `product/js/pdp-configurator.js` + `product-2026.js` | 3-question flow (qty → placement → method chips), all eligible methods side-by-side, expandable "See every quantity price" ladder (now **engine-probed** via `probeLadder()`, can't drift from the headline per the 2026-06-20 fix) | LTM honestly baked into per-piece price + labeled row; setup/digitizing NOT shown until Quote Cart |
| Quick Quote (staff tool, same engine) | `calculators/quick-quote/quick-quote.js` | Every eligible method at once; Line Sheet mode = up to 6 styles → one-page PDF | Fee rows shown in results panel |
| Embroidery Pricing calculator | `calculators/embroidery-pricing-all/` | Dedicated tier tables (1-7/8-23/24-47/48-71/72+) with an explicit "$50 LTM" banner | Yes — clearest LTM disclosure on the site |
| Screen Print Customer calculator | `calculators/screenprint-customer/` | Single per-unit price only — **no tier ladder shown pre-submission** | No — customer can't see the 24/48/72 price break until they submit |
| Custom Tees / Custom Caps storefronts | `pages/custom-tees.html`, `pages/custom-caps.html` | Live tier ladder in the designer itself (24/48/72/144), FAQ blurb for the LTM ("small-batch fee") | Partial — LTM explained, setup/digitizing N/A (free-setup model, decision #10) |
| Quote Cart | `pages/quote-cart.html` + `quote-cart-page.js` | Full itemization: per-method group cards, fee rows, LTM nudge, sticky totals — **this is where setup/digitizing/rush first become visible today** | Yes, but only at this late stage |

**Consistency gap (new finding):** the same underlying data is labeled differently per surface — "LTM Fee" (embroidery calculator) vs. "small-batch fee" (Custom Tees) vs. unlabeled (Quick Quote, until the final panel). Tier notation is also inconsistent: ranges ("24-47") vs. point values ("24/48/72"). None of this is a pricing bug — it's copy/labeling drift across pages that were built at different times.

### 1b. The quote process — landing to final view

```
/ (home)  →  /catalog (facets: search, category, brand, color, size, price, method)
          →  /product?style=X  (3-question configurator, Add-to-Quote)
          →  /quote-cart  (pooled per-method group cards, qty steppers, totals)
          →  Save & email  (WebQuoteService: WQ-{year}-{seq}, parity gate, footing assert, EmailJS)
          →  /quote/WQ-2026-NNN  (quote-view.js: line items, fees, tax, notes, art thumbnails)
          →  PDF via window.print() (quote-print.css)
```

This is a genuinely complete, well-built pipeline (`web-quote-service.js`, `quote-view.js`) with real safety rails: a **parity gate** that forces a fresh re-price before saving (rejects if the total moved >$0.01), a **footing assert** that blocks the save if line items don't sum to the group total, and fire-and-forget email that never blocks the save on failure. Storefront checkouts (Custom Tees, Custom Caps) run a parallel, separate path (Stripe checkout, server-authoritative re-price with 1¢ tolerance) rather than the WQ quote flow — reasonable, since those are pay-now, not quote-then-approve.

**Gap:** the two self-serve storefronts (`/custom-tees`, `/custom-caps`) land on an order-status/success page after checkout, not a proper `/quote/…` view — no dedicated printable receipt/PDF the way a WQ or staff quote gets. Not a defect (different business model — paid order vs. quote) but worth deciding if customers should still get a branded, printable order confirmation equivalent to the quote PDF.

### 1c. Product discovery & embellishment selection

`/catalog` has full faceted search (search/category/brand/color/size/price/sort/**method**), URL-state-driven (shareable, back-button-safe), server-computed `displayPriceLabel` (no client-side pricing math — the old hardcoded 0.57-margin formula was swept in the 2026-06-11 P2 pass). The product page's 3-question configurator is genuinely good UX: qty → placement → **all eligible methods rendered as priced chips side-by-side**, gated by live `Decoration_Method_Rules` (cotton-blend DTG warnings, method eligibility per category), with a visible fallback (EMB-only + alert) if the rules API is down — this already satisfies Erik's "no silent failure" rule.

**Gaps here are mostly already-tracked**, not new discoveries:
- Homepage search still runs in-page rather than routing to `/catalog?q=` (tracked: P3 backlog, `CUSTOMER_SITE_REDESIGN_2026-06.md` line 12).
- A dedicated multi-tab "method matrix" (for products eligible across many methods, e.g. jackets/bags) is an open Erik decision, not yet built (same doc, P3 line).
- Zero conversion-funnel analytics on catalog→product→add-to-quote (tracked: P7, "currently ZERO").

### 1d. Generating a quote & the printable PDF

PDF generation is **browser-native `window.print()`** driven by `css/quote-print.css` — deliberately not jsPDF (a prior 600-line coordinate-positioning implementation was replaced; the current approach gives selectable vector text and a much smaller/more reliable surface). Every quote type (EMB/DTG/SCP/DTF staff quotes, WQ customer quotes, OF order-form drafts) renders through the same `quote-view.js` + print stylesheet, so the PDF layout is unified. Quick Quote's Line Sheet mode has its own one-page `window.print()` export (up to 6 styles).

**Confirmed gap:** Richardson Caps (`RICH`) and the storefront paths have no dedicated `/quote/…` PDF — they rely on the checkout success page. **Confirmed gap:** quote-acceptance emails (customer + rep notification when a customer clicks "Accept") are fully specced but blocked on two manual steps from Erik — see `TODO_QUOTE_ACCEPTANCE_EMAILS.md` (add 3 Caspio fields to `quote_sessions`, create 2 EmailJS templates). This is not a code gap, it's a "waiting on Erik" item, and it's the single highest-leverage 30-minute task on this whole list.

---

## 2. Recommendations

Ranked by (business impact) ÷ (effort), not just severity. "Reuses" tells you whether this is new logic or just re-displaying something the engine already computes — that's the fastest, lowest-risk category.

### P0 — Do first (small, high-leverage, mostly non-code)

1. **Unblock quote-acceptance emails.** Fully designed already (`TODO_QUOTE_ACCEPTANCE_EMAILS.md`). Needs: Erik adds 3 fields to Caspio `quote_sessions` (`AcceptedAt`, `AcceptedByName`, `AcceptedByEmail`) + creates 2 EmailJS templates (copy provided in that file). Once done, ~1 hour of code in `server.js` (~line 2645) wires it up. **This is the biggest gap in "final view" — right now a customer can accept a quote and nobody gets told.**
2. ✅ **DONE 2026-07-01 — Surface fees/LTM earlier on the Screen Print Customer calculator.** Turned out bigger than a UI port: the calculator had 100% hardcoded, disconnected pricing (see the Update note above + `LESSONS_LEARNED.md`). Fixed to price via the shared `QuoteCartEngine` (same authority Quick Quote uses) + added the pre-submission tier ladder using the same probe pattern `pdp-configurator.js`'s `probeLadder()` uses. File: `calculators/screenprint-customer/`.
3. **Standardize LTM/fee terminology across all customer surfaces.** Pick one term ("Less-Than-Minimum Fee" is already the internal name and the clearest) and one tier notation (ranges, e.g. "24-47", already used on 3 of 5 surfaces) and apply it everywhere fees are shown: Quick Quote, Custom Tees FAQ copy, Quote Cart nudge banners. Pure copy change, zero pricing-logic risk, no parity-test re-run needed.

### P1 — Medium effort, real customer-facing value

4. **Preview setup/digitizing/rush fees earlier than the Quote Cart.** Today a customer can build a configurator total on the product page that looks final, then discover a $30 screen setup or $100 digitizing charge only after adding to cart. `singleItemPreview()` already returns a `lines[]` array with these as fee rows (Agent research confirmed the engine computes them) — the fix is to render a compact "+ setup/digitizing may apply, shown in your cart" note or the actual fee lines on the configurator chip itself, not to compute anything new. Files: `product/js/pdp-configurator.js` (render), zero changes to `quote-cart-engine.js`.
5. **Add a public, customer-facing "How Pricing Works" page.** Nothing like this exists today — Policies Hub covers it but is staff-only/auth-gated. A short page (tier breakpoints, what LTM means and why, what setup/digitizing/rush are, when a rep steps in for anything beyond the 2 configurator-priced locations) removes the single biggest ambiguity a first-time visitor hits. Link it from the LTM/fee labels above. New file under `/pages/`, no backend change.
6. **Give Custom Tees / Custom Caps a proper printable order confirmation.** Right now these two self-serve storefronts end at a success page, not a `/quote/…`-style PDF. Decide whether that's fine (they're paid orders, not quotes — arguably a receipt is a different artifact than a quote) or whether Erik wants a branded printable summary for these too, reusing `quote-print.css`. **This one needs an Erik decision, not just code** — see open questions below.
7. **Add a rough shipping-cost indicator to the Quote Cart totals.** Even a coarse "Est. shipping: $X–$Y, confirmed at checkout" closes the last "what will this actually cost me" gap. Lowest priority of the P1 items since it requires a new estimate source (not currently computed anywhere) rather than just re-displaying existing data.

### P2 — Already tracked, just re-flagging with a pointer (do not re-plan these — link and go)

8. Homepage search → `/catalog?q=` cutover — `CUSTOMER_SITE_REDESIGN_2026-06.md` P3.
9. Multi-tab "method matrix" UI for high-eligibility categories — same doc, P3 (pending Erik decision).
10. Conversion/analytics instrumentation (catalog → product → add-to-quote funnel) — same doc, P7 — this is the prerequisite for measuring whether any of the above actually moves the needle, worth pulling forward if this project is a priority.
11. DTG pricing has two formula copies across two repos (proxy `dtg-canonical-pricing.js` vs. FE `dtg-pricing-service.js`) — `PRICING_ENGINE_AUDIT_2026-06.md` "DTG-1 collapse", still open. Not customer-visible today but the highest latent drift-risk item in the whole pricing stack; worth scheduling opportunistically.
12. SEO/legal/analytics/favicon cross-cutting pass — same doc, P7.

---

## 3. Open questions for Erik (before building P1 items)

- **#6:** Do Custom Tees / Custom Caps orders need a quote-style printable PDF, or is the current success/order-status page sufficient since these are paid checkouts, not quotes?
- **#5:** Should the "How Pricing Works" page live at a top-level URL (e.g. `/pricing-explained`) linked from the main nav, or stay a contextual link off fee labels only?
- **#7:** Is a rough shipping estimate worth building now, or should it wait for the UPS Shipping Integration project already in the roadmap (`UPS_SHIPPING_INTEGRATION_PLAN.md`)? If that project lands soon, #7 may be redundant — check status before starting.

---

## 4. Verification plan (once any of the above ships)

- Any change touching `pdp-configurator.js`, `quote-cart-engine.js`, or a `*-pricing-service.js` → re-run `tests/unit/web-quote-cart-parity.test.js` + Quick Quote's parity suite per CLAUDE.md Rule 9, and manually confirm Customer Catalog / Quick Quote / Quote Builder still agree on the same style+qty+placement.
- UI/copy-only changes (terminology standardization, FAQ page) → no parity re-run needed, but do a visual pass across all 5 pricing touchpoints in the table in §1a to confirm the new wording actually landed everywhere (it's easy to fix 4 of 5 and miss one).
- New "Accept Quote" emails → send a real test quote through `/quote/WQ-...`, click Accept, confirm both EmailJS templates fire (customer + `sales@nwcustomapparel.com`), and confirm the 3 new Caspio fields populate — mirror the existing WQ E2E test-then-delete pattern used for prior features (see `CUSTOMER_SITE_REDESIGN_2026-06.md` HATS E2E entry for the pattern).

---

## Appendix — File map (for whoever implements this)

| Area | Key files |
|---|---|
| Pricing engine (single source, do not duplicate) | `shared_components/js/quote-cart-engine.js` (`singleItemPreview`, `priceCart`) |
| Product page / configurator | `product/js/product-2026.js`, `product/js/pdp-configurator.js`, `product/css/product-2026.css` |
| Catalog | `pages/catalog.html`, `pages/js/catalog-2026.js`, `pages/css/catalog-2026.css` |
| Quote Cart | `pages/quote-cart.html`, `pages/js/quote-cart-page.js`, `shared_components/js/quote-cart-store.js`, `shared_components/js/web-quote-service.js` |
| Quote view / PDF | `pages/js/quote-view.js`, `pages/quote-view.html`, `css/quote-print.css` |
| Quick Quote | `calculators/quick-quote/quick-quote.js`, `index.html` |
| Screen Print customer calculator | `calculators/screenprint-customer/` |
| Embroidery calculator (LTM disclosure reference pattern) | `calculators/embroidery-pricing-all/` |
| Storefronts | `pages/custom-tees.html`, `pages/custom-caps.html` |
| Decoration eligibility rules | `shared_components/js/decoration-methods.js` (Caspio `Decoration_Method_Rules`) |
| Quote acceptance emails (blocked on manual steps) | `TODO_QUOTE_ACCEPTANCE_EMAILS.md`, `server.js` ~line 2645 |
| Related design docs | `CUSTOMER_SITE_REDESIGN_2026-06.md`, `CUSTOMER_QUOTE_CART_DESIGN_2026-06.md`, `PRICING_ENGINE_AUDIT_2026-06.md` |
