---
paths:
  - "quote-builders/**"
  - "shared_components/js/*-quote-builder.js"
  - "shared_components/js/quote-builder-utils.js"
  - "shared_components/css/quote-builder-common.css"
  - "shared_components/js/embroidery-quote-invoice.js"
---

# Quote Builder rules

Loads automatically when you open any of the 4 quote builders or their shared files. The always-loaded `CLAUDE.md` keeps only the never-break headlines (Rules 7/8/9); this is the detail. Full architecture manifest: `memory/quote-builder-architecture.md`.

## The 4 builders share one structure
- HTML: `quote-builders/{dtg,dtf,embroidery,screenprint}-quote-builder.html` — **external JS/CSS only** (no inline `<style>`/`<script>`).
- Logic: `shared_components/js/{method}-quote-builder.js` · shared utils: `quote-builder-utils.js` · shared CSS: `quote-builder-common.css`.
- ⭐ **Invoice / PDF / totals / tax = ONE shared file `embroidery-quote-invoice.js`** → a change there hits all 4 at once. DTG uses a separate inline-form architecture, so trio UI changes don't reach it automatically.

## Rule 8 — sync all 4
- **SYNC across all 4:** CSS/layout/spacing · table structure · fee/charges panel · customer info panel · modal styling · utilities in `quote-builder-utils.js`.
- **Do NOT sync (method-specific):** pricing logic · location-selection UI · logo/artwork config · `*-pricing-service.js` / `*-quote-service.js` · `updateDiscountType()` / `updateAdditionalCharges()` / `updateFeeTableRows()`.
- After any builder change, ask: *"Does this apply to the other 3? Should it move to `quote-builder-utils.js`? Does it affect `printQuote()` or `saveAndGetLink()`?"*

## Rules 7 & 9 — pricing parity (when you touch pricing)
- **Pricing = API, never hardcoded** (fallback ONLY + visible warning). Fees → Caspio `Service_Codes` via `getServicePrice(code, fallback)`; decoration/garment → `/api/pricing-bundle` + `{method}-pricing-service.js`.
- **3 price surfaces, one engine:** Catalog / Quick Quote / Builders all price via `QuoteCartEngine.singleItemPreview` → Caspio. NEVER add a 4th path or a hardcoded number.
- Any pricing change → **re-run `web-quote-cart-parity` + `quick-quote-parity` AND verify all 3 surfaces**.
- `printQuote()` and `saveAndGetLink()` must use the SAME inputs as `recalculatePricing()`; every new toggle/flag MUST be reset in `resetQuote()`.
- Print + save must single-source from state math (e.g. DTF `calculateFromState()` + `computeFeesAndTotals()`) — never re-derive prices from DOM text.

## EMB specifics (if touching the EMB builder)
- LTM threshold **qty ≤ 7** (NOT `< 24` like DTG/DTF). 5 tiers + per-tier `MarginDenominator` from Caspio `Pricing_Tiers` (0.55 tier 1-7 / 0.53 others — never hardcode) + `LTM_Fee $50` at qty 1-7. Caps and garments tier **separately**.
- `Embroidery_Costs` uses `StitchCount` (NOT `StitchCountRange`). Beanie = flat, NOT cap (`ProductCategoryFilter.isFlatHeadwear()`). Detail: `memory/emb-builder-details.md`.

## Quantity nudge tiers
DTG 12/24/48/72 · DTF 10/24/48/72 · SCP 24/37/73/145 · EMB 8/24/48/72.
