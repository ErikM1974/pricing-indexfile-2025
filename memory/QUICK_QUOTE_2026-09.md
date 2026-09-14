# Quick Quote and customer-inclusive pricing — September 2026

## September 14 speed improvements (release v2026.09.14.2; rep trial pending)

Taneisha asked for the familiar left controls and quantity price breaks with fewer clicks and less scrolling. Erik approved the plan. Use September 8 as a layout reference; retain the September 13 pricing, document and supplier-photo fixes.

- Default single-method Quick Quote has one style/name search path, exact matches first, Enter selection and closed suggestions after selection. Editing immediately invalidates old output. Additional product rows reuse the same search panel.
- A compact method selector and native placement selectors replace expanded chips. Quantity is optional and sits just below the method so essential controls fit together on a laptop. No quantity means a price sheet without an invented order total; clicking a quantity in the table requests an exact total.
- Every customer tier is priced through the canonical engine at its displayed quantity. The requested quantity replaces its range's sample. Keep inclusive small-order pricing and separate one-time setup. Remove the unqualified staff "from" teaser.
- Product details and the quantity table lead the customer sheet. Copy prices, PDF and Print use the same document model. Copy has a selectable-text fallback. Hide copy/draft feedback in print.
- Catalog quoting is directly beside Decoration. More settings summarizes active sleeves/dark garments/safety stripes. Compare decoration, optional customer details, favorites and explicit input-only restore remain available. Recommend/include/reorder controls appear only for multiple products; full-builder links require an actual quantity.
- The desktop acceptance case uses 1265 × 712 with the method, quantity, front/back controls, first price table and download action visible together. Retain four-width, keyboard, pricing parity, stale-output and complete-PDF checks.
- Prepared for the approved v2026.09.14.2 deployment; verify the release before recording it live. Taneisha/Nika's observed trial and any usage-driven presets are the next phase; no rep preferences have been invented or messages sent.

Validation: 337 unit/source/CSS checks passed; 56 browser cases validated across the workflow and family suites, including isolated successful reruns after two overlapping test runs collided during trace cleanup. JavaScript and CSS lint passed. Reviewed 1440/768/390/320 screenshots, the 1265 × 712 common DTF/embroidery controls, native print, a downloaded no-quantity sheet and both pages of the long multi-option PDF. All business requests used test fixtures. Live production data and rep timing trials remain release/trial checks.

## Approved behavior

Erik requested a simpler workflow for Nika and Taneisha, clearer customer options and PDFs, and small-order/LTM charges inside customer per-piece prices across Quick Quote, all full builders and the main catalog. Retain the API's method-specific fees, thresholds and rounding; do not impose a new universal $50 rule.

- Quick Quote defaults to one decoration method and quantity price breaks. Compare decoration shows one garment across applicable methods. Both use the existing QuoteCartEngine and canonical pricing services.
- Enter product by style/name, choose color and decoration; actual quantity is optional. Favorite/recent products and explicit restore of a 14-day input-only draft save repetition. No customer details or prices persist in the draft.
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

## September 14 release checkpoint

Prepared v2026.09.14.2 from production v2026.09.14.1 (56a93a0f / Heroku 2119), preserving the existing December Finish Line release. Local checks passed on Node 22.23.2: 276 unit/DOM/accessibility suites, 6,427 passed and 26 existing skips; strict lint, types, 287-file CSS lint, build and production dependency audit clean. Startup returned HTTP 200. The exact source commit must pass the full release CI before deployment; record the deployed SHA and live checks in external session memory. Rep trials remain pending.

## September 13 release checkpoint (historical)

Prepared for v2026.09.13.6; not live until release verification is recorded. Previous live version is v2026.09.13.5 / Heroku 2116.
Local development gates and release CI must pass on the committed source before deployment. The external session memory links this topic and records final release evidence.

Local release checks: 274 unit/DOM/accessibility suites, 6,402 passed and 4 intentional skips; strict lint, types, CSS and production audit clean. Browser coverage: 28 Quick Quote CSS cases; 125 catalog/builder/workflow cases (four intentional new-location comparisons corrected and all rerun successfully), plus cap puff/patch handoffs; 120 customer cart/saved-quote/money-path/live-calculator/accessibility cases. Complete two-page PDF visually reviewed. Source CI additionally runs the whole application CSS gate and the new Quick Quote workflow spec.
