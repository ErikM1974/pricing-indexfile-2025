# Quick Quote and customer-inclusive pricing — September 13, 2026

## Approved behavior

Erik requested a simpler workflow for Nika and Taneisha, clearer customer options and PDFs, and small-order/LTM charges inside customer per-piece prices across Quick Quote, all full builders and the main catalog. Retain the API's method-specific fees, thresholds and rounding; do not impose a new universal $50 rule.

- Quick Quote defaults to Compare products. Compare decoration shows one garment across applicable methods. Both use the existing QuoteCartEngine and canonical pricing services.
- Enter product by style/name, choose color and actual quantity, then decoration. Favorite/recent products and explicit restore of a 14-day input-only draft save repetition. No customer details or prices persist in the draft.
- Each customer option is a separate estimate, never added together. Reps may recommend an option and exclude others. Optional customer/company/rep/contact/note fields carry to the customer output.
- Screen, native print and downloadable PDF share `quick-quote-document.js`. Show actual quantity, inclusive per-piece price, setup and order total; standard sizes, 30-day validity, tax/shipping assumptions and independent-option wording are explicit.
- Quantity comparison columns use actual quantities, including the requested quantity. Never show a tier's base unit with a separate LTM row that the customer must add.
- Versioned, validated handoff URLs carry the selected product, quantity and decoration to the full builder. Preserve stitches, additional logos, digitizing, puff/patch, print placements, ink counts, sleeves and dark/safety options. URL inputs never supply prices.
- Errors and in-flight changes invalidate exports. Failed lookups, pricing, PDF assets and storage have visible recovery. Product searches cannot race another row or silently retain stale pricing.
- PDF photos use the existing same-origin `/api/image-proxy` relay for external supplier URLs. A photo displaying in HTML does not prove that its origin allows canvas reads. Verified an actual CT104670 customer PDF with live pricing and the SanMar photo, without any business writes.

## Small-order policy and exact totals

- Staff fee controls retain apply/waive; customer display always uses builtin mode, including restored legacy preferences. API fee breakdowns remain available internally.
- EMB/cap, DTG and DTF retain their canonical billing rules. SCP divides the fee by exact quantity without flooring the share first. Screen and PDF receive the same precise unit value; rounded display text is not a calculation input.
- The catalog configurator's quantity table calls the same preview engine at each displayed quantity. Its selected-quantity price agrees with its main quote selection. Larger-size charges and one-time setup stay explicit.
- Customer cart and saved web quotes include SCP LTM inside product prices and omit its separate fee row. Saved rows allocate cumulative cents so fractional shares across sizes preserve the engine total exactly.
- Saved quote view reads billed `LineTotal / Quantity`, then FinalUnitPrice, then BaseUnitPrice. A legitimate free $0 remains zero. Merged sizes use weighted billed values.
- Existing saved quotes remain frozen; retain any original separate fees and recorded totals. This presentation change does not silently reprice old customer records or ERP orders.

## Implementation and regression coverage

- UI owners: `calculators/quick-quote/{index.html,quick-quote.js,quick-quote.css,quick-quote-workspace.js,quick-quote-document.js,linesheet-print.css}`.
- Shared handoff and LTM controls: `shared_components/js/quote-builder-utils.js`; method hydration in the EMB/SCP/DTF/DTG builder modules.
- Exact output: EMB/SCP pricing-sync and output modules; customer cart, WebQuoteService and quote-view; catalog `product/js/pdp-configurator.js`.
- Unit: document, handoff, customer-price presentation, WebQuoteService fractional-cent allocation, both original price parity suites, source guards.
- Browser: `quick-quote-workflow.spec.js` covers all five methods, low quantities, real PDFs, stale requests, drafts and full-builder numeric handoffs including cap puff/patch and back-only SCP. Included in release CI.
- Existing Quick Quote/catalog/builder/cart/quote-view browser suites retain historical evidence and add explicit checks for approved new behavior. Historical fixture hashes stay unchanged through `tests/fixtures/quick-quote-workflow-source-mappings.json`; never replace originals to accommodate feature work.
- Shared CSS tokens and page-family owners remain in place; Quick Quote stylesheet payload decreased, budgets were not raised. Four viewport widths, keyboard/axe checks and complete PDF pages reviewed.
- All test writes, email, quote allocation and checkout are intercepted. No real orders or customer emails are created during validation.

## Release checkpoint

Prepared for v2026.09.13.6; not live until release verification is recorded. Previous live version is v2026.09.13.5 / Heroku 2116.
Local development gates and release CI must pass on the committed source before deployment. The external session memory links this topic and records final release evidence.

Local release checks: 274 unit/DOM/accessibility suites, 6,402 passed and 4 intentional skips; strict lint, types, CSS and production audit clean. Browser coverage: 28 Quick Quote CSS cases; 125 catalog/builder/workflow cases (four intentional new-location comparisons corrected and all rerun successfully), plus cap puff/patch handoffs; 120 customer cart/saved-quote/money-path/live-calculator/accessibility cases. Complete two-page PDF visually reviewed. Source CI additionally runs the whole application CSS gate and the new Quick Quote workflow spec.
