/**
 * SCP pricing-sync module — SCP decomposition S1b (2026-07-08).
 * SCREENPRINT_TIERS + findPricingTier (the byte-compared tier authority —
 * web-quote-cart-parity locks the engine copy against THIS file), the
 * recalculatePricing pipeline (live `export let`, reprice-pill wrapped at the
 * tail), row/summary display sync, tax + wholesale. Moved verbatim.
 */
/* global Event, updatePrintConfig, updateDarkGarmentNudge, updateFeeTableRows,
   getScpExtraFees, updateAdditionalCharges, markScreenPrintDirty,
   updateScpPushButtonState, escapeHtml, showToast, formatPrice,
   wrapWithRepricingIndicator, renderOrderRecap, getServicePrice,
   renderLtmControlPanel, initLtmControlListeners, setLtmControlState,
   getLtmControlState, updatePerUnitPrice, updateQuantityNudge */
import { scpState, LOCATION_NAMES, SIZE06_EXTENDED_SIZES } from './state.js';

// Alias for backward compatibility
export function recalculateAllPrices() {
    recalculatePricing();
}

// Screen Print tier mapping — FALLBACK ONLY (used when the Caspio-matched tier label
// is unavailable). Boundaries follow the 2026-06-19 remap (24-47/48-71/72-144/145+);
// the old 24-36/37-72/73-144 labels survived here and printed nonexistent tiers on
// failure-path saves/PDFs. (expert audit 2026-07-07)
const SCREENPRINT_TIERS = [
    { label: '24-47', min: 24, max: 47 },
    { label: '48-71', min: 48, max: 71 },
    { label: '72-144', min: 72, max: 144 },
    { label: '145+', min: 145, max: Infinity }
];

function getScreenPrintTier(qty) {
    // Under 24 uses 24-47 pricing (+ LTM fee applied separately)
    if (qty < 24) return SCREENPRINT_TIERS[0];
    for (const tier of SCREENPRINT_TIERS) {
        if (qty >= tier.min && qty <= tier.max) return tier;
    }
    return SCREENPRINT_TIERS[SCREENPRINT_TIERS.length - 1];
}

// Find the pricing tier from the Caspio tiers array for a given qty.
// Clamps to the top tier when qty exceeds all tier maxes — otherwise a
// capped top tier (e.g. ScreenPrint's 145-576) silently reprices anything
// above the cap at the worst tier.
function findPricingTier(tiers, qty) {
    if (!tiers || tiers.length === 0) return null;
    const sorted = [...tiers].sort((a, b) => a.minQty - b.minQty);
    const match = sorted.find(t =>
        qty >= t.minQty && (t.maxQty == null || qty <= t.maxQty)
    );
    if (match) return match;
    const top = sorted[sorted.length - 1];
    if (qty > (top.maxQty ?? Infinity)) return top;
    return sorted[0];
}

// D3 split (2026-07-09): LTM fee resolve (API-first + warned fallback + control
// panel wiring), moved VERBATIM out of _recalculatePricingImpl.
async function _resolveLtmState(productList, totalQty) {
    // LTM fee — from Caspio Pricing_Tiers.LTM_Fee (the matched qty tier), NOT
    // hardcoded $75/$50 bands. The SCP service exposes `ltmFee` on each
    // primaryLocationPricing tier row (the fee is the same across color counts).
    // Fetch the first product's bundle (cached — the loop re-uses it) to read it.
    // Fall back to the documented bands WITH a warning only if the API is silent,
    // so a Caspio LTM change reaches the builder with no deploy (matches the
    // /pricing/screen-print calculator, which already reads it from the API).
    let baseLtmFee = 0;
    const _ltmStyle = productList.find(p => p.style)?.style;
    if (_ltmStyle) {
        try {
            const _ltmBundle = await scpState.screenPrintPricingService.fetchPricingData(_ltmStyle);
            const _plp = _ltmBundle && _ltmBundle.primaryLocationPricing;
            const _anyTiers = _plp ? (Object.values(_plp).find(p => p && Array.isArray(p.tiers))?.tiers || []) : [];
            let _m = _anyTiers.find(t => totalQty >= t.minQty && totalQty <= (t.maxQty ?? Infinity));
            if (!_m && _anyTiers.length) _m = [..._anyTiers].sort((a, b) => a.minQty - b.minQty)[0]; // below lowest tier → use lowest (LTM territory)
            if (_m && Number.isFinite(Number(_m.ltmFee))) baseLtmFee = Number(_m.ltmFee);
        } catch (e) { /* fall through to the warned fallback below */ }
    }
    // Fallback ONLY when the API is silent (rare). Matches the CURRENT Caspio model ($50 LTM at
    // the 24-47 tier; none at 48+) — was the stale pre-2026-06-19 $75/$50 bands. Surfaces a VISIBLE
    // warning (de-duped) so a rep never saves a silently-estimated fee. (2026-06-20 audit SCP-5)
    if (!baseLtmFee && totalQty > 0 && totalQty <= 47) {
        baseLtmFee = 50;
        console.warn('[ScreenPrint] LTM fee unavailable from API — using $' + baseLtmFee + ' fallback');
        if (!window._scpLtmFallbackWarned && typeof showToast === 'function') {
            window._scpLtmFallbackWarned = true;
            showToast('Small-batch fee is an estimate — live pricing didn\'t return it. Verify before saving.', 'warning');
        }
    }
    const wouldHaveLTM = baseLtmFee > 0;

    const ltmWrapper = document.getElementById('spc-ltm-wrapper');
    if (ltmWrapper) {
        if (wouldHaveLTM) {
            ltmWrapper.style.display = '';
            if (!document.querySelector('#spc-ltm-panel .ltm-control-panel')) {
                renderLtmControlPanel('spc-ltm-panel', { feeAmount: baseLtmFee });
                initLtmControlListeners('spc-ltm-panel', () => {
                    recalculatePricing();
                    markScreenPrintDirty();
                });
            } else {
                setLtmControlState('spc-ltm-panel', { feeAmount: baseLtmFee });
            }
        } else {
            ltmWrapper.style.display = 'none';
            setLtmControlState('spc-ltm-panel', { enabled: true, displayMode: 'builtin' });
        }
    }

    // Read LTM control state
    const ltmState = getLtmControlState('spc-ltm-panel');
    const ltmEnabled = wouldHaveLTM ? ltmState.enabled : true;
    const ltmDisplayMode = ltmState.displayMode || 'builtin';
    const ltmFee = (wouldHaveLTM && ltmEnabled) ? baseLtmFee : 0;
    const perUnitLTM = ltmFee > 0 ? Math.floor(ltmFee / totalQty * 100) / 100 : 0;
    return { ltmEnabled, ltmDisplayMode, ltmFee, perUnitLTM };
}

// D3 split (2026-07-09): ONE product's pricing + row paint, moved VERBATIM from
// the _recalculatePricingImpl loop. Returns { entry, productSubtotal } or null
// (dropped — reason already pushed onto ctx.droppedProducts). ctx.first captures
// the first-priced product's pricing/tier for the nudge + Caspio tier label.
async function _priceOneProduct(product, ctx) {
        const style = product.style;

        // Fetch Screen Print pricing data for this style
        const pricingData = await scpState.screenPrintPricingService.fetchPricingData(style);

        if (!pricingData) {
            console.warn(`No pricing data for ${style}`);
            ctx.droppedProducts.push({ style, reason: 'no pricing data returned' });
            return null;
        }

        // Get primary location pricing (garment + print)
        const frontColors = scpState.printConfig.frontColors.toString();
        const primaryPricing = pricingData.primaryLocationPricing?.[frontColors];

        if (!primaryPricing || !primaryPricing.tiers) {
            console.warn(`No primary pricing for ${frontColors} colors`);
            ctx.droppedProducts.push({ style, reason: `no pricing for ${frontColors}-color front` });
            return null;
        }

        // Find the tier data for this quantity
        const tierData = findPricingTier(primaryPricing.tiers, ctx.totalQty);
        if (!tierData) { ctx.droppedProducts.push({ style, reason: `no price tier for qty ${ctx.totalQty}` }); return null; }

        // Capture first product's pricing for nudge savings calculation
        if (!ctx.first.pricing) {
            ctx.first.pricing = primaryPricing;
            ctx.first.tierData = tierData;
            // Caspio-accurate tier label from the MATCHED bundle tier (not the static
            // SCREENPRINT_TIERS map) — mirrors the engine (quote-cart-engine.js:624-632).
            const _hasMax = tierData.maxQty != null && isFinite(Number(tierData.maxQty));
            ctx.first.caspioTierLabel = _hasMax ? (tierData.minQty + '-' + tierData.maxQty) : (tierData.minQty + '+');
        }

        // Get additional location pricing if back location enabled
        let additionalPricePerPiece = 0;
        if (scpState.printConfig.backLocation) {
            const backColors = scpState.printConfig.backColors.toString();
            const additionalPricing = pricingData.additionalLocationPricing?.[backColors];
            const additionalTier = (additionalPricing && additionalPricing.tiers)
                ? findPricingTier(additionalPricing.tiers, ctx.totalQty)
                : null;
            if (!additionalTier || typeof additionalTier.pricePerPiece !== 'number') {
                // Never silently price the back print at $0 (Rule 4) — same guard the
                // sleeve loop below already has; the engine hard-throws this case.
                ctx.droppedProducts.push({ style, reason: `no add-location pricing for a ${backColors}-color back print` });
                return null;
            }
            additionalPricePerPiece = additionalTier.pricePerPiece;
        }

        // Sleeves — each checked sleeve is its OWN additional print location at its own color count,
        // priced like the back (additionalLocationPricing[colors] at the POOLED qty), SUMMED, never
        // re-rounded (pricePerPiece is already HalfDollarCeil'd in the service). Mirrors engine
        // quote-cart-engine.js priceScpGroup so the builder matches the engine/Quick Quote to the cent.
        let sleeveAddlPerPiece = 0;
        let sleeveDropped = false;
        for (const c of (scpState.printConfig.sleeveColorsList || [])) {
            const sleevePricing = pricingData.additionalLocationPricing?.[String(c)];
            if (!sleevePricing || !sleevePricing.tiers) {
                ctx.droppedProducts.push({ style, reason: `no add-location pricing for a ${c}-color sleeve` });
                sleeveDropped = true;
                break;
            }
            const sleeveTier = findPricingTier(sleevePricing.tiers, ctx.totalQty);
            if (!sleeveTier || typeof sleeveTier.pricePerPiece !== 'number') {
                ctx.droppedProducts.push({ style, reason: `no add-location price tier (qty ${ctx.totalQty}) for a ${c}-color sleeve` });
                sleeveDropped = true;
                break;
            }
            sleeveAddlPerPiece += sleeveTier.pricePerPiece;
        }
        if (sleeveDropped) return null; // never silently price a sleeve at $0 (Rule 4)

        // No silent M/L substitution for an unpriced size — the engine refuses the
        // same case (quote-cart-engine.js:726-731) and substituting drops the
        // extended-size upcharge, so builder and engine would disagree per SKU.
        const unpricedSize = Object.entries(product.sizeBreakdown || {})
            .find(([sz, q]) => q > 0 && typeof tierData.prices?.[sz] !== 'number');
        if (unpricedSize) {
            ctx.droppedProducts.push({ style, reason: `no price for size ${unpricedSize[0]} at tier ${ctx.first.caspioTierLabel || (tierData.minQty + '+')}` });
            return null;
        }

        // Find parent row for this product
        const parentRow = /** @type {HTMLElement|null} */ (document.querySelector(`tr[data-style="${style}"][data-catalog-color="${product.catalogColor}"]:not(.child-row)`));
        if (!parentRow) return null;

        const rowId = parentRow.dataset.rowId;
        const { productSubtotal, parentOnlySubtotal } = _paintProductSizes(product, tierData, additionalPricePerPiece, sleeveAddlPerPiece, rowId, ctx);

        // Update parent row total (standard sizes only — child rows show their own totals)
        const parentTotalCell = document.getElementById(`row-total-${rowId}`);
        if (parentTotalCell) {
            const displayTotal = parentOnlySubtotal > 0 ? parentOnlySubtotal : productSubtotal;
            parentTotalCell.textContent = product.totalQty > 0 ? `$${displayTotal.toFixed(2)}` : '-';
        }

        // Update pricing breakdown for the row
        updateRowBreakdownScreenPrint(rowId, product, tierData);


        // Persist a fully-priced, save-ready snapshot. saveAndGetLink() reads
        // these instead of re-scraping the DOM. (The old save map read
        // product.qty/.sizes/.unitPrice — fields collectProductsFromTable never
        // returns — so saved quote_items had empty sizes and $0 unit prices,
        // which the ShopWorks push then under-billed.) unitPrice is the per-
        // product BLENDED price (productSubtotal / qty) so the saved LineTotal and
        // the pushed order total exactly equal the quoted subtotal, even when
        // extended-size upcharges make per-size prices differ within a product.
        const _pqty = product.totalQty || 0;
        const entry = {
            product,
            prices: tierData.prices,
            tier: ctx.first.caspioTierLabel || ctx.tier.label,
            // save-ready fields (consumed by saveAndGetLink → ScreenPrintQuoteService)
            style: product.style,
            productName: product.productName || product.style,
            color: product.color,
            catalogColor: product.catalogColor,
            sizeBreakdown: product.sizeBreakdown,
            totalQty: _pqty,
            unitPrice: _pqty > 0 ? Math.round((productSubtotal / _pqty) * 100) / 100 : 0,
            lineTotal: Math.round(productSubtotal * 100) / 100,
            ltmPerUnit: ctx.perUnitLTM,
            imageUrl: product.imageUrl || ''
        };
        return { entry, productSubtotal };
}

// D3 split (2026-07-09): the per-size price paint, moved VERBATIM out of the
// product loop (accumulates and returns the two subtotals).
function _paintProductSizes(product, tierData, additionalPricePerPiece, sleeveAddlPerPiece, rowId, ctx) {
    const { safetyStripesPerPiece, ltmDisplayMode, perUnitLTM } = ctx;
    let productSubtotal = 0;      // ALL sizes (for sidebar subtotal)
    let parentOnlySubtotal = 0;   // Standard sizes only (for parent row Total cell)

    // Calculate and display price for each size
    Object.entries(product.sizeBreakdown || {}).forEach(([size, qty]) => {
        if (qty <= 0) return;

        // Base price for this size from primary location — guaranteed present by
        // the unpricedSize guard above (no M/L fallback: that silently dropped
        // extended-size upcharges and broke builder↔engine parity).
        let sizePrice = tierData.prices[size];

        // Add additional location price (back)
        sizePrice += additionalPricePerPiece;

        // Add sleeve additional-location price(s) — left + right, each at its own color count
        sizePrice += sleeveAddlPerPiece;

        // Add safety stripes (front/back only — sleeves get no hi-vis stripe)
        sizePrice += safetyStripesPerPiece;

        // Display price: builtin mode adds LTM per-unit, separate mode shows base price
        const displayPrice = (ltmDisplayMode === 'builtin' && perUnitLTM > 0) ? sizePrice + perUnitLTM : sizePrice;
        // Use displayPrice for subtotal so row totals match displayed unit prices
        productSubtotal += displayPrice * qty;

        // Update row price cell (for standard sizes, update parent row)
        // Note: 2XL/XXL are child rows but NOT in SIZE06_EXTENDED_SIZES (they go in Size05 column)
        const isExtendedSize = SIZE06_EXTENDED_SIZES.includes(size) || size === '2XL' || size === 'XXL';
        if (!isExtendedSize) {
            parentOnlySubtotal += displayPrice * qty;
        }
        if (!isExtendedSize) {
            const priceCell = document.getElementById(`row-price-${rowId}`);
            if (priceCell) {
                priceCell.textContent = `$${displayPrice.toFixed(2)}`;
            }
        } else {
            // Extended size - find child row
            const childRowId = scpState.childRowMap[rowId]?.[size];
            if (childRowId) {
                const childPriceCell = document.getElementById(`row-price-${childRowId}`);
                if (childPriceCell) {
                    childPriceCell.textContent = `$${displayPrice.toFixed(2)}`;
                }
                // Update child row total (qty × price)
                const childTotalCell = document.getElementById(`row-total-${childRowId}`);
                if (childTotalCell) {
                    const childTotal = displayPrice * qty;
                    childTotalCell.textContent = qty > 0 ? `$${childTotal.toFixed(2)}` : '-';
                }
            }
        }
    });
    return { productSubtotal, parentOnlySubtotal };
}

async function _recalculatePricingImpl() {
    // Collect products from table (parent rows only)
    const productList = collectProductsFromTable();

    // Dark-garment reminder — evaluated on every reprice so a navy hoodie added
    // mid-quote still nudges while the underbase toggle is off.
    try { updateDarkGarmentNudge(productList); } catch (_) {}

    if (productList.length === 0) {
        updatePricingDisplay({
            totalQuantity: 0,
            tier: '24-47',
            subtotal: 0,
            ltmFee: 0,
            setupFees: scpState.printConfig.setupFee,
            grandTotal: scpState.printConfig.setupFee
        });
        // Clear all price and total cells
        document.querySelectorAll('.cell-price').forEach(cell => {
            cell.textContent = '-';
        });
        document.querySelectorAll('.cell-total').forEach(cell => {
            cell.textContent = '-';
        });
        return;
    }

    // Calculate total quantity across all products
    let totalQty = 0;
    productList.forEach(p => {
        totalQty += p.totalQty || 0;
    });

    // Determine tier based on total quantity. NOTE: getScreenPrintTier's labels are a
    // STATIC fallback only — the real displayed/saved tier label is derived below from the
    // matched Caspio bundle tier. SCREENPRINT_TIERS drifted from Caspio's boundaries after the
    // 2026-06-19 remap (it labels qty 48 "37-72" while Caspio prices the "48-71" tier).
    const tier = getScreenPrintTier(totalQty);

    const { ltmEnabled, ltmDisplayMode, ltmFee, perUnitLTM } = await _resolveLtmState(productList, totalQty);
    void ltmEnabled;

    // Safety stripes: per-piece-per-location surcharge from Caspio Service_Codes
    // 'SP-STRIPE' (fallback $2). (Pricing=API)
    const locationCount = scpState.printConfig.backLocation ? 2 : 1;
    const safetyStripesPerPiece = scpState.printConfig.isSafetyStripes ? (getServicePrice('SP-STRIPE', 2.00) * locationCount) : 0;

    let subtotal = 0;
    const pricedProducts = [];
    const droppedProducts = []; // products that couldn't be priced (surfaced after the loop)

    try {
        // Process each product
        const ctx = { totalQty, tier, safetyStripesPerPiece, ltmDisplayMode, perUnitLTM, droppedProducts,
            first: { pricing: null, tierData: null, caspioTierLabel: null } };
        for (const product of productList) {
            const r = await _priceOneProduct(product, ctx);
            if (!r) continue;
            subtotal += r.productSubtotal;
            pricedProducts.push(r.entry);
        }
        const { caspioTierLabel } = ctx.first;
        const firstPricing = ctx.first.pricing;
        const firstTierData = ctx.first.tierData;

        // Surface any product that couldn't be priced. It was EXCLUDED from the
        // subtotal/saved/pushed quote with only a console.warn before, so a rep could
        // quote and push a total that silently dropped a line. Erik's #1 rule. (2026-06-01)
        if (droppedProducts.length > 0) {
            const styles = [...new Set(droppedProducts.map(d => d.style))].join(', ');
            showToast(`Could not price ${styles} for the selected colors/quantity — NOT included in the total. Adjust colors/qty or remove before saving.`, 'error');
        }

        // Calculate grand total — in builtin mode LTM is already in subtotal via inflated unit prices
        const setupFees = scpState.printConfig.setupFee;
        const grandTotal = (ltmDisplayMode === 'builtin') ? subtotal + setupFees : subtotal + ltmFee + setupFees;

        // Compute per-piece savings for next tier nudge
        let nextTierSavings = null;
        if (pricedProducts.length > 0 && firstPricing?.tiers && firstTierData) {
            try {
                const currentTierIdx = firstPricing.tiers.indexOf(firstTierData);
                if (currentTierIdx >= 0 && currentTierIdx < firstPricing.tiers.length - 1) {
                    const nextTier = firstPricing.tiers[currentTierIdx + 1];
                    const curPrice = firstTierData.prices?.['M'] ?? firstTierData.prices?.['L'] ?? Object.values(firstTierData.prices || {})[0] ?? 0;
                    const nextPrice = nextTier.prices?.['M'] ?? nextTier.prices?.['L'] ?? Object.values(nextTier.prices || {})[0] ?? 0;
                    if (curPrice > nextPrice) nextTierSavings = curPrice - nextPrice;
                }
            } catch (e) { /* graceful fallback */ }
        }

        // Store LTM state for tax/discount calculations
        window.currentPricingData = window.currentPricingData || {};
        window.currentPricingData.ltmFee = ltmFee;
        window.currentPricingData.ltmDisplayMode = ltmDisplayMode;
        window.currentPricingData.nextTierSavings = nextTierSavings;

        // Update pricing display sidebar
        updatePricingDisplay({
            totalQuantity: totalQty,
            tier: caspioTierLabel || tier.label,
            subtotal: subtotal,
            ltmFee: ltmFee,
            ltmDisplayMode: ltmDisplayMode,
            setupFees: setupFees,
            grandTotal: grandTotal,
            products: pricedProducts
        });

    } catch (error) {
        console.error('Screen Print Pricing calculation error:', error);
        showToast('Error calculating prices. Please try again.', 'error');
    }

    // Mark as dirty for auto-save (2026 consolidation)
    markScreenPrintDirty();
}

// Update row breakdown display for Screen Print
function updateRowBreakdownScreenPrint(rowId, product, tierData) {
    const breakdownEl = document.getElementById(`breakdown-${rowId}`);
    if (!breakdownEl) return;

    const frontName = LOCATION_NAMES[scpState.printConfig.frontLocation] || scpState.printConfig.frontLocation;
    const basePrice = tierData.prices?.['M'] || tierData.prices?.['L'] || 0;

    let breakdownHtml = `
        <span class="breakdown-item">${frontName} (${scpState.printConfig.frontColors}-color)</span>
        <span class="breakdown-separator">|</span>
        <span class="breakdown-item">$${basePrice.toFixed(2)}/ea</span>
    `;

    if (scpState.printConfig.backLocation) {
        const backName = LOCATION_NAMES[scpState.printConfig.backLocation] || scpState.printConfig.backLocation;
        breakdownHtml += `
            <span class="breakdown-separator">+</span>
            <span class="breakdown-item">${backName} (${scpState.printConfig.backColors}-color)</span>
        `;
    }

    if (scpState.printConfig.leftSleeveColors > 0) {
        breakdownHtml += `
            <span class="breakdown-separator">+</span>
            <span class="breakdown-item">L Sleeve (${scpState.printConfig.leftSleeveColors}-color)</span>
        `;
    }
    if (scpState.printConfig.rightSleeveColors > 0) {
        breakdownHtml += `
            <span class="breakdown-separator">+</span>
            <span class="breakdown-item">R Sleeve (${scpState.printConfig.rightSleeveColors}-color)</span>
        `;
    }

    // eslint-disable-next-line no-unsanitized/property -- audited (1.4): internal LOCATION_NAMES labels + numeric colors/prices only
    breakdownEl.innerHTML = breakdownHtml;
}

export function collectProductsFromTable() {
    const products = [];
    // Only collect from parent rows (not child rows or AL config rows)
    const rows = document.querySelectorAll('#product-tbody tr:not(.child-row):not(.al-config-row)');

    rows.forEach(row => {
        const rowId = parseInt(row.id.replace('row-', ''));
        const style = /** @type {HTMLElement} */ (row).dataset.style;
        const parentColor = /** @type {HTMLElement} */ (row).dataset.color;
        const parentCatalogColor = /** @type {HTMLElement} */ (row).dataset.catalogColor || '';

        if (!style || !parentColor) return;

        // Group sizes by color - different colors become separate products
        const colorGroups = {};

        // Initialize parent color group
        colorGroups[parentCatalogColor] = {
            color: parentColor,
            catalogColor: parentCatalogColor,
            sizeBreakdown: {},
            totalQty: 0
        };

        // Collect size inputs from parent row (standard or remapped sizes)
        // IMPORTANT: Exclude .xxxl-picker-btn (shows TOTAL) and .osfa-qty-input (handled separately)
        // Note: For non-standard products (combo, youth, toddler, tall), data-size is remapped
        // eslint-disable-next-line no-unused-vars -- verbatim (S1b): unused in monolith
        const sizeCategory = /** @type {HTMLElement} */ (row).dataset.sizeCategory;
        row.querySelectorAll('.size-input:not(.xxxl-picker-btn):not(.osfa-qty-input):not(:disabled)').forEach(input => {
            const size = /** @type {HTMLElement} */ (input).dataset.size;
            const qty = parseInt(/** @type {HTMLInputElement} */ (input).value) || 0;
            if (qty > 0 && size) {
                colorGroups[parentCatalogColor].sizeBreakdown[size] = qty;
                colorGroups[parentCatalogColor].totalQty += qty;
            }
        });

        // Handle OSFA-only products (beanies, caps, bags)
        // OSFA qty is stored in parent row, not child rows
        if (/** @type {HTMLElement} */ (row).dataset.isOsfaOnly === 'true') {
            const osfaQty = parseInt(/** @type {HTMLElement} */ (row).dataset.osfaQty) || 0;
            if (osfaQty > 0) {
                colorGroups[parentCatalogColor].sizeBreakdown['OSFA'] = osfaQty;
                colorGroups[parentCatalogColor].totalQty += osfaQty;
            }
        }

        // Collect extended sizes from CHILD ROWS - GROUP BY COLOR
        // Child rows may have different colors than parent
        const childRows = document.querySelectorAll(`tr[data-parent-row-id="${rowId}"]`);
        childRows.forEach(childRow => {
            const size = /** @type {HTMLElement} */ (childRow).dataset.extendedSize;
            const childColor = /** @type {HTMLElement} */ (childRow).dataset.color;
            const childCatalogColor = /** @type {HTMLElement} */ (childRow).dataset.catalogColor || '';
            const qtyDisplay = childRow.querySelector('.qty-display');
            const qty = parseInt(qtyDisplay?.textContent) || 0;

            if (qty > 0 && size) {
                // Initialize color group if different from parent
                if (!colorGroups[childCatalogColor]) {
                    colorGroups[childCatalogColor] = {
                        color: childColor,
                        catalogColor: childCatalogColor,
                        sizeBreakdown: {},
                        totalQty: 0
                    };
                }

                colorGroups[childCatalogColor].sizeBreakdown[size] = qty;
                colorGroups[childCatalogColor].totalQty += qty;
            }
        });

        // Create product entry for each color group with quantities
        // eslint-disable-next-line no-unused-vars -- verbatim (S1b): destructured key unused in monolith
        Object.entries(colorGroups).forEach(([catalogColor, group]) => {
            if (group.totalQty > 0) {
                products.push({
                    style: style,
                    color: group.color,
                    catalogColor: group.catalogColor,
                    productName: /** @type {HTMLElement} */ (row).dataset.productName || style,
                    sizeBreakdown: group.sizeBreakdown,
                    totalQty: group.totalQty,
                    rowId: rowId
                });
            }
        });
    });

    return products;
}

function updatePricingDisplay(pricing) {
    // Store for toggle reference
    window.currentPricingData = pricing;

    // Update sidebar print configuration display
    updateSidebarPrintConfig();

    // Basic pricing info
    const totalQty = pricing.totalQuantity || 0;
    document.getElementById('total-qty').textContent = totalQty;
    document.getElementById('subtotal').textContent = `$${(pricing.subtotal || 0).toFixed(2)}`;
    updatePerUnitPrice(pricing.subtotal || 0, pricing.totalQuantity || 0);
    updateQuantityNudge(pricing.totalQuantity || 0, 'scp', window.currentPricingData?.nextTierSavings);

    // Small-batch warning banner — Caspio charges the $50 LTM through the 24-47 tier,
    // so the banner must show whenever the fee applies (<48), not just under the
    // 24-piece minimum. The old <24 gate had reps promising "the fee disappears at 24"
    // and getting contradicted by their own 30-piece quote. (expert audit 2026-07-07)
    const minWarning = document.getElementById('min-order-warning');
    if (minWarning) {
        minWarning.style.display = (totalQty > 0 && totalQty < 48) ? 'flex' : 'none';
    }

    // Update pre-tax subtotal for tax calculation (grand total before tax)
    document.getElementById('pre-tax-subtotal').textContent = `$${(pricing.grandTotal || 0).toFixed(2)}`;
    { const _pb = document.getElementById('pre-tax-subtotal'); if (_pb) _pb.dataset.base = (pricing.grandTotal || 0); }  // [2026-06-08] P1: stable base for updateTaxCalculation (no re-read of its own fee-inflated textContent → double-count)

    // Update tax calculation
    updateTaxCalculation();

    // Pricing tier
    const pricingTierEl = document.getElementById('pricing-tier');
    pricingTierEl.textContent = pricing.tier || '24-47';

    // LTM display — show table row only in "separate" mode
    const ltmTableRow = document.getElementById('ltm-fee-row');
    const ltmTableUnit = document.getElementById('ltm-row-unit');
    const ltmTableTotal = document.getElementById('ltm-row-total');
    const ltmMode = pricing.ltmDisplayMode || 'builtin';

    if (pricing.ltmFee > 0 && ltmMode === 'separate') {
        if (ltmTableRow) {
            ltmTableRow.style.display = 'table-row';
            if (ltmTableUnit) ltmTableUnit.textContent = `$${pricing.ltmFee.toFixed(2)}`;
            if (ltmTableTotal) ltmTableTotal.textContent = `$${pricing.ltmFee.toFixed(2)}`;
        }
    } else {
        if (ltmTableRow) ltmTableRow.style.display = 'none';
    }

    // Update all fee table rows (setup, art, design, rush, discount)
    updateFeeTableRows();

    // [2026-06-08] keep the order-summary band (recap + ship-to card) current on every recompute
    if (typeof window.renderOrderRecap === 'function') window.renderOrderRecap();
}

// Update sidebar to reflect current print configuration
function updateSidebarPrintConfig() {
    const frontName = LOCATION_NAMES[scpState.printConfig.frontLocation] || scpState.printConfig.frontLocation;
    document.getElementById('sidebar-front').textContent = `${frontName} (${scpState.printConfig.frontColors}-color)`;

    // Back location
    const backRow = document.getElementById('sidebar-back-row');
    if (scpState.printConfig.backLocation) {
        const backName = LOCATION_NAMES[scpState.printConfig.backLocation] || scpState.printConfig.backLocation;
        document.getElementById('sidebar-back').textContent = `${backName} (${scpState.printConfig.backColors}-color)`;
        backRow.style.display = 'flex';
    } else {
        backRow.style.display = 'none';
    }

    // Sleeves (each its own color count)
    const sleevesRow = document.getElementById('sidebar-sleeves-row');
    if (sleevesRow) {
        const sleeveBits = [];
        if (scpState.printConfig.leftSleeveColors > 0) sleeveBits.push(`L ${scpState.printConfig.leftSleeveColors}-color`);
        if (scpState.printConfig.rightSleeveColors > 0) sleeveBits.push(`R ${scpState.printConfig.rightSleeveColors}-color`);
        if (sleeveBits.length) {
            document.getElementById('sidebar-sleeves').textContent = sleeveBits.join(', ');
            sleevesRow.style.display = 'flex';
        } else {
            sleevesRow.style.display = 'none';
        }
    }

    // Total screens
    document.getElementById('sidebar-screens').textContent = /** @type {any} */ (scpState.printConfig.totalScreens);

    // Dark garment
    document.getElementById('sidebar-dark-row').style.display = scpState.printConfig.isDarkGarment ? 'flex' : 'none';

    // Safety stripes
    const stripesRow = document.getElementById('sidebar-stripes-row');
    if (scpState.printConfig.isSafetyStripes) {
        const locationCount = scpState.printConfig.backLocation ? 2 : 1;
        document.getElementById('sidebar-stripes-cost').textContent = `+$${(getServicePrice('SP-STRIPE', 2.00) * locationCount).toFixed(2)}/pc`;
        stripesRow.style.display = 'flex';
    } else {
        stripesRow.style.display = 'none';
    }

    // Update fee table rows (includes setup fee)
    updateFeeTableRows();
}

// ============================================================
// TAX CALCULATION & ADDITIONAL CHARGES
// ============================================================

export function updateTaxCalculation() {
    const includeTax = /** @type {HTMLInputElement|null} */ (document.getElementById('include-tax'))?.checked;
    const subtotalEl = document.getElementById('pre-tax-subtotal');
    const taxRowEl = document.getElementById('tax-row');
    const taxAmountEl = document.getElementById('tax-amount');
    const grandTotalEl = document.getElementById('grand-total-with-tax');

    // Get base subtotal from pricing
    // [2026-06-08] P1: read the STABLE base (data-base set by updatePricingDisplay), NOT the textContent this fn writes
    // back — else a 2nd direct call double-adds fees+shipping. Falls back to textContent only before the first recalc.
    let subtotal = parseFloat(subtotalEl?.dataset?.base);
    if (!Number.isFinite(subtotal)) subtotal = parseFloat(subtotalEl?.textContent?.replace(/[$,]/g, '') || /** @type {any} */ (0));

    // Add art charge if enabled
    const artChargeToggle = /** @type {HTMLInputElement|null} */ (document.getElementById('art-charge-toggle'));
    const artCharge = artChargeToggle?.checked ? parseFloat(/** @type {HTMLInputElement|null} */ (document.getElementById('art-charge'))?.value || /** @type {any} */ (0)) : 0;
    subtotal += artCharge;

    // Add graphic design fee
    const designHours = parseFloat(/** @type {HTMLInputElement|null} */ (document.getElementById('graphic-design-hours'))?.value || /** @type {any} */ (0));
    const designFee = designHours * getServicePrice('GRT-75', 75);
    subtotal += designFee;

    // Add rush fee if present
    const rushFee = parseFloat(/** @type {HTMLInputElement|null} */ (document.getElementById('rush-fee'))?.value || /** @type {any} */ (0));
    subtotal += rushFee;

    // Add Vellum + Color Change setup fees (Erik's official parts, 2026-06-27).
    // Added before discount so a percent discount applies to them (parity with art/rush).
    const _xfTax = getScpExtraFees();
    subtotal += _xfTax.vellumFee + _xfTax.colorChangeFee;

    // Subtract discount if present
    const discountAmount = parseFloat(/** @type {HTMLInputElement|null} */ (document.getElementById('discount-amount'))?.value || /** @type {any} */ (0));
    const discountType = /** @type {HTMLInputElement|null} */ (document.getElementById('discount-type'))?.value || 'fixed';
    let discount = 0;
    if (discountType === 'percent') {
        discount = subtotal * (discountAmount / 100);
    } else {
        discount = discountAmount;
    }
    subtotal = Math.max(0, subtotal - discount);

    // Add shipping fee (after discount — shipping not discountable)
    const shippingFee = parseFloat(/** @type {HTMLInputElement|null} */ (document.querySelector('#spc-order-fields .os-shipping-fee'))?.value) || 0;
    subtotal += shippingFee;

    // Update the pre-tax subtotal display to show adjusted amount
    if (subtotalEl) {
        subtotalEl.textContent = '$' + subtotal.toFixed(2);
    }

    // Dynamic tax rate from ZIP lookup or manual input
    // [2026-06-08] P0 (#1 rule): Number.isFinite so an exempt/out-of-state rate of 0 STAYS 0% — `parseFloat('0')||10.1`
    // is the falsy trap that re-taxed exempt orders at 10.1% on screen when include-tax was still checked.
    const _scpRate = parseFloat(/** @type {HTMLInputElement|null} */ (document.getElementById('tax-rate-input'))?.value);
    const taxRateInput = Number.isFinite(_scpRate) ? _scpRate : 10.2;
    const taxRate = taxRateInput / 100;

    // Sales Tax row stays visible for invoice transparency; label shows the rate when charged,
    // "(exempt)"/"(not charged)" when $0 (best-of-both level-up 2026-06-14).
    const _scpTaxLabel = document.getElementById('tax-rate-label');
    if (taxRowEl) taxRowEl.style.display = 'flex';
    if (_scpTaxLabel) _scpTaxLabel.textContent = (includeTax && taxRateInput > 0)
        ? `Sales Tax (${taxRateInput}%)`
        : ((window._isWholesale || window._taxExempt) ? 'Sales Tax (exempt)' : 'Sales Tax (not charged)');
    if (includeTax) {
        const tax = Math.round(subtotal * taxRate * 100) / 100;
        taxAmountEl.textContent = '$' + tax.toFixed(2);
        grandTotalEl.textContent = '$' + (subtotal + tax).toFixed(2);
    } else {
        taxAmountEl.textContent = '$0.00';
        grandTotalEl.textContent = '$' + subtotal.toFixed(2);
    }
    // Mirror the grand TOTAL into the sticky sidebar total bar (EMB/DTF parity 2026-06-14) so the rep sees
    // the customer-facing total even though the Subtotal/Tax/TOTAL box moved to the footer invoice band.
    { const _sgt = document.getElementById('sidebar-grand-total'); const _stb = document.getElementById('sidebar-total-bar');
      if (_sgt) _sgt.textContent = grandTotalEl.textContent;
      if (_stb) _stb.hidden = false; }
    // Keep the always-visible Push button + readiness checklist in lock-step with product/fee changes.
    try { if (typeof updateScpPushButtonState === 'function') updateScpPushButtonState(); } catch (_) {}
}

// toggleAdditionalCharges() moved to quote-builder-utils.js

// [2026-06-08] Wholesale / reseller toggle (mirror EMB). Per-order checkbox by the sales tax → 0 tax + push GL 2203.
export function toggleWholesale() {
    const cb = /** @type {HTMLInputElement|null} */ (document.getElementById('wholesale-checkbox'));
    window._isWholesale = !!(cb && cb.checked);
    const incTax = /** @type {HTMLInputElement|null} */ (document.getElementById('include-tax'));
    const rateInput = /** @type {HTMLInputElement|null} */ (document.getElementById('tax-rate-input'));
    if (window._isWholesale) {
        if (incTax) incTax.checked = false;
        if (rateInput) rateInput.value = '0';
    } else {
        // [2026-06-08] un-toggle wholesale → re-derive the correct rate for the ship address (parity with DTF's
        // guarded lookupTaxRate) instead of leaving a flat 10.1: exempt stays 0; out-of-state 0; WA re-fetches the DOR rate.
        if (window._taxExempt) {
            if (incTax) /** @type {HTMLInputElement} */ (incTax).checked = false;
            if (rateInput) /** @type {HTMLInputElement} */ (rateInput).value = '0';
        } else {
            if (incTax) /** @type {HTMLInputElement} */ (incTax).checked = true;
            const _st = (/** @type {HTMLInputElement|null} */ (document.querySelector('#spc-order-fields .os-ship-state'))?.value || 'WA').toUpperCase();
            const _zip = /** @type {HTMLInputElement|null} */ (document.querySelector('#spc-order-fields .os-ship-zip'));
            if (_st === 'WA') {
                if (rateInput) /** @type {HTMLInputElement} */ (rateInput).value = '10.2';  // fallback until the async DOR lookup (ZIP blur) returns — Milton 10.2% since 2026-07-06
                if (_zip && (_zip.value || '').trim().length >= 5) { _zip.dispatchEvent(new Event('blur')); }
            } else if (rateInput) {
                /** @type {HTMLInputElement} */ (rateInput).value = '0';  // out-of-state — no WA tax
            }
        }
    }
    updateTaxCalculation();
}
// (window bridge moved to builders/scp/index.js)

// ── recalculatePricing live binding (verbatim wrap tail from the monolith):
//    the reprice pill wraps the impl; `export let` keeps every importer AND
//    the window bridge on the wrapped version. ──
export let recalculatePricing = _recalculatePricingImpl;
if (typeof wrapWithRepricingIndicator === 'function') {
    recalculatePricing = wrapWithRepricingIndicator(_recalculatePricingImpl);
}
