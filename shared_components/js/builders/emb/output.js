/**
 * EMB output + diagnostics module — roadmap 0.4 extraction #5 (2026-07-07).
 *
 * The quote OUTPUT paths: buildEmbroideryPricingData (the pricingData
 * contract handed to the shared embroidery-quote-invoice.js renderer —
 * print/PDF/email all flow through it), printQuote, embEmailQuote,
 * generateEmbQuoteText + copyToClipboard, and diagnoseQuote (the staff
 * diagnostics dump).
 *
 * Moved verbatim from embroidery-quote-builder.js (~775-line contiguous
 * tail cluster). The wrapWithRepricingIndicator tail statement stays in the
 * monolith — it rewraps recalculatePricing (cluster 5).
 *
 * Rule-9 note: printQuote consumes the SAME state math as the screen
 * (buildEmbroideryPricingData ← collectProductsFromTable + pricing state);
 * never re-derive money from DOM text.
 */
// lands with this cluster's render/state split (see emb-decomposition-plan.md).
/* global
   saveAndGetLink, showToast, getLtmControlState,
   parseRatePercent, showLoading, EmbroideryInvoiceGenerator,
   hasUnsavedChanges, emailQuote */
import { getServicePrice } from './pricing.js';
import { buildLogoConfiguration, calculateDiscountableSubtotal, collectProductsFromTable, recalculatePricing, syncALRows, syncDECGRows } from './pricing-sync.js';
import { getAdditionalCharges, collectDECGItems } from './quote-lifecycle.js';
import { getCapEmbellishmentType } from './logo-config.js';
import { dateFromInputValue } from './product-rows.js';
import { embState, EMB_DEFAULTS } from './state.js';

// ============================================================
// DIAGNOSTIC TOOL — diagnoseQuote()
// Captures current quote state, runs validation checks,
// and copies compact JSON to clipboard for analysis
// ============================================================
// T3 split (2026-07-09): diagnoseQuote in three moves — the pricing
// reconstruction (same folds as recalculatePricing), the 8 checks, and the
// orchestrator keeps the report/clipboard. All VERBATIM.
async function _reconstructDiagPricing(products, serviceItems, decgItems) {
    // Re-run pricing engine (same as recalculatePricing)
    const garmentALForDiag = embState.globalAL.garment.enabled ? [{
        id: 'global-al-garment', position: 'AL',
        stitchCount: embState.globalAL.garment.stitchCount,
        needsDigitizing: embState.globalAL.garment.needsDigitizing
    }] : [];
    const capALForDiag = embState.globalAL.cap.enabled ? [{
        id: 'global-al-cap', position: 'AL-Cap',
        stitchCount: embState.globalAL.cap.stitchCount,
        needsDigitizing: embState.globalAL.cap.needsDigitizing
    }] : [];

    const logoConfigs = {
        garment: { primary: { ...embState.primaryLogo, id: 'primary' }, additional: garmentALForDiag },
        cap: { primary: { ...embState.capPrimaryLogo, id: 'cap-primary' }, additional: capALForDiag }
    };
    const allLogos = [{ ...embState.primaryLogo, id: 'primary' }, ...garmentALForDiag];

    let pricing;
    if (products.length === 0) {
        const decgTotal = decgItems.reduce((sum, d) => sum + d.total, 0);
        const decgQty = decgItems.reduce((sum, d) => sum + d.quantity, 0);
        pricing = {
            products: [], totalQuantity: decgQty, subtotal: decgTotal,
            grandTotal: decgTotal,
            tier: decgQty <= 7 ? '1-7' : decgQty <= 23 ? '8-23' : decgQty <= 47 ? '24-47' : decgQty <= 71 ? '48-71' : '72+',
            ltmFee: 0, additionalServices: [], additionalStitchTotal: 0,
            garmentStitchTotal: 0, capStitchTotal: 0,
            garmentSetupFees: 0, capSetupFees: 0,
            garmentQuantity: 0, capQuantity: 0
        };
    } else {
        const ltmEnabledDiag = getLtmControlState('emb-ltm-panel').enabled;
        pricing = await embState.pricingCalculator.calculateQuote(products, allLogos, logoConfigs, { ltmEnabled: ltmEnabledDiag });
    }

    // Include service item totals (same as recalculatePricing)
    let serviceTotal = 0;
    serviceItems.forEach(si => { serviceTotal += si.unitPrice * si.totalQuantity; });
    if (serviceTotal > 0) {
        pricing.subtotal += serviceTotal;
        pricing.grandTotal += serviceTotal;
    }

    // Include DECG/DECC totals (same as recalculatePricing)
    if (decgItems.length > 0) {
        const decgServiceTotal = decgItems.reduce((sum, d) => sum + d.total, 0);
        pricing.subtotal += decgServiceTotal;
        pricing.grandTotal += decgServiceTotal;
    }

    // Include child row override deltas (same as recalculatePricing)
    let childOverrideDelta = 0;
    document.querySelectorAll('#product-tbody tr.child-row').forEach(childRow => {
        const childOverride = parseFloat(/** @type {HTMLElement} */ (childRow).dataset.sellPrice) || 0;
        if (childOverride <= 0) return;
        const childRowId = /** @type {HTMLElement} */ (childRow).dataset.rowId;
        const childPriceCell = document.getElementById(`row-price-${childRowId}`);
        const childQtyCell = document.getElementById(`row-qty-${childRowId}`);
        if (!childPriceCell) return;
        const currentText = childPriceCell.textContent.replace(/[^0-9.]/g, '');
        const calculatedPrice = parseFloat(currentText) || 0;
        const qty = parseInt(childQtyCell?.textContent) || 0;
        childOverrideDelta += (childOverride - calculatedPrice) * qty;
    });
    if (childOverrideDelta !== 0) {
        pricing.subtotal += childOverrideDelta;
        pricing.grandTotal += childOverrideDelta;
    }

    const additionalCharges = getAdditionalCharges();
    // eslint-disable-next-line no-unused-vars -- pre-existing: only adjustedSubtotal is consumed here (verbatim move)
    const { baseSubtotal, discount, adjustedSubtotal } = calculateDiscountableSubtotal();
    return { pricing, serviceTotal, childOverrideDelta, additionalCharges, adjustedSubtotal };
}

function _runDiagChecks(addCheck, dc, products, decgItems) {
    const { pricing, serviceTotal, childOverrideDelta, additionalCharges, adjustedSubtotal } = dc;
    // ---- CHECK 1: Line items sum to subtotal ----
    let productLineTotal = 0;
    if (pricing.products) {
        pricing.products.forEach(pp => {
            pp.lineItems.forEach(li => {
                const price = li.unitPriceWithLTM || li.unitPrice;
                productLineTotal += price * li.quantity;
            });
        });
    }
    productLineTotal += serviceTotal;
    if (decgItems.length > 0) {
        productLineTotal += decgItems.reduce((sum, d) => sum + d.total, 0);
    }
    productLineTotal += childOverrideDelta;
    const subtotalDiff = Math.abs(productLineTotal - pricing.subtotal);
    if (subtotalDiff < 0.02) {
        addCheck('Line items sum to subtotal', 'PASS', `$${productLineTotal.toFixed(2)} == $${pricing.subtotal.toFixed(2)}`);
    } else {
        addCheck('Line items sum to subtotal', 'FAIL', `Product lines: $${productLineTotal.toFixed(2)}, Subtotal: $${pricing.subtotal.toFixed(2)}, diff: $${subtotalDiff.toFixed(2)}`);
    }

    // ---- CHECK 2: Grand total formula ----
    const expectedGrand = pricing.subtotal + (pricing.setupFees || ((pricing.garmentSetupFees || 0) + (pricing.capSetupFees || 0)));
    const actualGrand = pricing.grandTotal;
    const grandDiff = Math.abs(expectedGrand - actualGrand);
    if (grandDiff < 0.02) {
        addCheck('Grand total formula', 'PASS', `subtotal($${pricing.subtotal.toFixed(2)}) + setup($${((pricing.garmentSetupFees || 0) + (pricing.capSetupFees || 0)).toFixed(2)}) = $${actualGrand.toFixed(2)}`);
    } else {
        addCheck('Grand total formula', 'WARN', `Expected: $${expectedGrand.toFixed(2)}, Got: $${actualGrand.toFixed(2)}, diff: $${grandDiff.toFixed(2)}`);
    }

    // ---- CHECK 3: DECG included in output paths ----
    if (decgItems.length > 0) {
        const decgTotal = decgItems.reduce((sum, d) => sum + d.total, 0);
        const grandIncludesDECG = pricing.grandTotal >= decgTotal - 0.01;
        if (grandIncludesDECG) {
            addCheck('DECG in grandTotal', 'PASS', `$${decgTotal.toFixed(2)} included in grandTotal $${pricing.grandTotal.toFixed(2)}`);
        } else {
            addCheck('DECG in grandTotal', 'FAIL', `DECG total $${decgTotal.toFixed(2)} NOT reflected in grandTotal $${pricing.grandTotal.toFixed(2)}`);
        }
    } else {
        addCheck('DECG in grandTotal', 'PASS', 'No DECG items (N/A)');
    }

    // ---- CHECK 4: UI displayed total matches computed total ----
    const displayedGrandText = document.getElementById('grand-total')?.textContent || '$0.00';
    const displayedGrand = parseFloat(displayedGrandText.replace(/[$,]/g, '')) || 0;
    const uiDiff = Math.abs(displayedGrand - pricing.grandTotal);
    if (uiDiff < 0.02) {
        addCheck('UI total matches computed', 'PASS', `Displayed: $${displayedGrand.toFixed(2)}, Computed: $${pricing.grandTotal.toFixed(2)}`);
    } else {
        addCheck('UI total matches computed', 'FAIL', `Displayed: $${displayedGrand.toFixed(2)}, Computed: $${pricing.grandTotal.toFixed(2)}, diff: $${uiDiff.toFixed(2)}`);
    }

    // ---- CHECK 5: AL module arrays in sync with globalAL ----
    const garmentALEnabled = embState.globalAL.garment.enabled;
    const capALEnabled = embState.globalAL.cap.enabled;
    const garmentALInPricing = (pricing.additionalServices || []).filter(s => s.type === 'additional_logo' && !s.isCap);
    const capALInPricing = (pricing.additionalServices || []).filter(s => s.type === 'additional_logo' && s.isCap);

    let alSyncOk = true;
    let alDetail = [];
    if (garmentALEnabled && garmentALInPricing.length === 0 && (pricing.garmentQuantity || 0) > 0) {
        alSyncOk = false;
        alDetail.push('Garment AL enabled but no AL in pricing results');
    }
    if (!garmentALEnabled && garmentALInPricing.length > 0) {
        alSyncOk = false;
        alDetail.push('Garment AL disabled but pricing has AL entries');
    }
    if (capALEnabled && capALInPricing.length === 0 && (pricing.capQuantity || 0) > 0) {
        alSyncOk = false;
        alDetail.push('Cap AL enabled but no AL in pricing results');
    }
    if (!capALEnabled && capALInPricing.length > 0) {
        alSyncOk = false;
        alDetail.push('Cap AL disabled but pricing has AL entries');
    }
    addCheck('AL sync with globalAL', alSyncOk ? 'PASS' : 'FAIL',
        alSyncOk ? `Garment AL: ${garmentALEnabled ? 'ON' : 'OFF'}, Cap AL: ${capALEnabled ? 'ON' : 'OFF'}` : alDetail.join('; '));

    // ---- CHECK 6: Expected ShopWorks fee part numbers ----
    const expectedFees = [];
    if ((pricing.garmentSetupFees || 0) > 0) expectedFees.push('DD (garment digitizing)');
    if ((pricing.capSetupFees || 0) > 0) expectedFees.push('DD (cap digitizing)');
    if ((pricing.garmentStitchTotal || 0) > 0) expectedFees.push('AS-Garm');
    if ((pricing.capStitchTotal || 0) > 0) expectedFees.push('AS-CAP');
    if (garmentALEnabled && garmentALInPricing.length > 0) expectedFees.push('AL');
    if (capALEnabled && capALInPricing.length > 0) expectedFees.push('AL-Cap');
    if (additionalCharges.artCharge > 0) expectedFees.push('GRT-50');
    if (additionalCharges.graphicDesignCharge > 0) expectedFees.push('GRT-75');
    if (additionalCharges.rushFee > 0) expectedFees.push('RUSH');
    if (additionalCharges.discount > 0) expectedFees.push('DISCOUNT');
    addCheck('ShopWorks fee part numbers', 'PASS', expectedFees.length > 0 ? expectedFees.join(', ') : 'No fees');

    // ---- CHECK 7: Product count matches pricing product count ----
    const tableProductCount = products.length;
    const pricingProductCount = pricing.products ? pricing.products.length : 0;
    if (tableProductCount === pricingProductCount) {
        addCheck('Product count match', 'PASS', `${tableProductCount} products in table, ${pricingProductCount} in pricing engine`);
    } else {
        addCheck('Product count match', 'WARN', `Table: ${tableProductCount}, Pricing: ${pricingProductCount} (difference may be from color grouping)`);
    }

    // ---- CHECK 8: TotalAmount = grandTotal + fees - discount ----
    const totalFees = (additionalCharges.artCharge || 0) +
        (additionalCharges.graphicDesignCharge || 0) +
        (additionalCharges.rushFee || 0) +
        (additionalCharges.sampleFee || 0);
    const expectedTotal = pricing.grandTotal + totalFees - (additionalCharges.discount || 0);
    const displayedTotal = adjustedSubtotal;
    const totalDiff = Math.abs(expectedTotal - displayedTotal);
    if (totalDiff < 0.02) {
        addCheck('TotalAmount formula', 'PASS', `grandTotal($${pricing.grandTotal.toFixed(2)}) + fees($${totalFees.toFixed(2)}) - discount($${(additionalCharges.discount || 0).toFixed(2)}) = $${displayedTotal.toFixed(2)}`);
    } else {
        addCheck('TotalAmount formula', 'FAIL', `Expected: $${expectedTotal.toFixed(2)}, Displayed: $${displayedTotal.toFixed(2)}, diff: $${totalDiff.toFixed(2)}`);
    }
    return { garmentALEnabled, capALEnabled, garmentALInPricing, capALInPricing };
}

export async function diagnoseQuote() {
    const allItems = collectProductsFromTable();
    const products = allItems.filter(p => !p.isService);
    const serviceItems = allItems.filter(p => p.isService);
    const decgItems = collectDECGItems();

    if (products.length === 0 && serviceItems.length === 0 && decgItems.length === 0) {
        showToast('Add products before diagnosing', 'error');
        return;
    }

    const checks = [];
    let passCount = 0;
    let warnCount = 0;
    let failCount = 0;

    function addCheck(name, status, detail) {
        checks.push({ name, status, detail });
        if (status === 'PASS') passCount++;
        else if (status === 'WARN') warnCount++;
        else failCount++;
    }

    try {
        const dc = await _reconstructDiagPricing(products, serviceItems, decgItems);
        const { pricing, additionalCharges, adjustedSubtotal } = dc;

        const { garmentALEnabled, capALEnabled, garmentALInPricing, capALInPricing } =
            _runDiagChecks(addCheck, dc, products, decgItems);

        // Build diagnostic output
        const diagnostic = {
            timestamp: new Date().toISOString(),
            quoteId: embState.editingQuoteId || 'DRAFT',
            checks: checks,
            summary: { pass: passCount, warn: warnCount, fail: failCount, total: checks.length },
            state: {
                productCount: products.length,
                serviceCount: serviceItems.length,
                decgCount: decgItems.length,
                totalQuantity: pricing.totalQuantity || 0,
                subtotal: pricing.subtotal,
                grandTotal: pricing.grandTotal,
                adjustedSubtotal: adjustedSubtotal,
                garmentQty: pricing.garmentQuantity || 0,
                capQty: pricing.capQuantity || 0,
                garmentTier: pricing.garmentTier || pricing.tier,
                capTier: pricing.capTier || null,
                ltmFee: pricing.ltmFee || 0,
                garmentSetupFees: pricing.garmentSetupFees || 0,
                capSetupFees: pricing.capSetupFees || 0,
                garmentStitchTotal: pricing.garmentStitchTotal || 0,
                capStitchTotal: pricing.capStitchTotal || 0,
                garmentAL: garmentALEnabled ? { stitchCount: embState.globalAL.garment.stitchCount, total: garmentALInPricing.reduce((s, a) => s + a.total, 0) } : null,
                capAL: capALEnabled ? { stitchCount: embState.globalAL.cap.stitchCount, total: capALInPricing.reduce((s, a) => s + a.total, 0) } : null,
                fees: {
                    artCharge: additionalCharges.artCharge || 0,
                    graphicDesign: additionalCharges.graphicDesignCharge || 0,
                    rushFee: additionalCharges.rushFee || 0,
                    sampleFee: additionalCharges.sampleFee || 0,
                    discount: additionalCharges.discount || 0
                }
            },
            products: products.map(p => ({
                style: p.style,
                color: p.color,
                qty: p.totalQuantity,
                isCap: p.isCap || false,
                sizes: p.sizeBreakdown
            })),
            decgItems: decgItems.map(d => ({
                type: d.type,
                qty: d.quantity,
                unitPrice: d.unitPrice,
                total: d.total
            }))
        };

        // Copy to clipboard
        const jsonStr = JSON.stringify(diagnostic, null, 2);
        await navigator.clipboard.writeText(jsonStr);

        // Show result summary as toast
        const statusIcon = failCount > 0 ? 'error' : warnCount > 0 ? 'warning' : 'success';
        const statusMsg = `Diagnosis: ${passCount} pass, ${warnCount} warn, ${failCount} fail — copied to clipboard`;
        showToast(statusMsg, statusIcon === 'warning' ? 'success' : statusIcon);

    } catch (error) {
        console.error('[Diagnose] Error:', error);
        showToast('Diagnosis error: ' + error.message, 'error');
    }
}

// ============================================================
// ACTION BUTTONS: Copy, Print, Email
// ============================================================

/**
 * Build pricing data structure for EmbroideryInvoiceGenerator
 * Handles garment/cap splits, stitch count tiers, digitizing fees,
 * AL fees, service codes (DECG/DECC), and LTM display mode.
 */
export // D4 split (2026-07-09): ONE product's PDF line items (returns entry or null)
// + the service/stitch-surcharge appends, moved VERBATIM out of
// buildEmbroideryPricingData (SCP-twin cuts).
function _buildEmbInvoiceProduct(product) {
    const lineItems = [];

    // Find the parent row for this product to read its displayed price
    const parentRow = document.querySelector(
        `tr[data-style="${product.style}"][data-catalog-color="${product.catalogColor}"]:not(.child-row)`
    );
    const rowId = /** @type {HTMLElement|null} */ (parentRow)?.dataset?.rowId;

    // Read base price from parent row's price cell
    const basePriceCell = document.getElementById(`row-price-${rowId}`);
    const basePriceText = basePriceCell?.textContent || '$0.00';
    const baseUnitPrice = parseFloat(basePriceText.replace(/[^0-9.]/g, '')) || 0;

    // Base sizes (S, M, L, XL)
    const baseSizes = ['S', 'M', 'L', 'LG', 'XL'];
    const baseSizeQtys = {};
    let baseQty = 0;

    Object.entries(product.sizeBreakdown || {}).forEach(([size, qty]) => {
        if (size === 'SVC') return; // Skip service pseudo-size
        const displaySize = size === 'L' ? 'LG' : size;
        if (baseSizes.includes(size) && qty > 0) {
            baseSizeQtys[displaySize] = qty;
            baseQty += qty;
        }
    });

    // Handle OSFA (beanies, caps without sized variants)
    const osfaQty = product.sizeBreakdown['OSFA'] || 0;
    if (osfaQty > 0 && baseQty === 0) {
        // OSFA-only product — use parent price as base
        lineItems.push({
            description: `OSFA(${osfaQty})`,
            quantity: osfaQty,
            unitPrice: baseUnitPrice,
            total: osfaQty * baseUnitPrice
        });
    } else {
        if (baseQty > 0) {
            const desc = Object.entries(baseSizeQtys)
                .map(([size, qty]) => `${size}(${qty})`)
                .join(' ');
            lineItems.push({
                description: desc,
                quantity: baseQty,
                unitPrice: baseUnitPrice,
                total: baseQty * baseUnitPrice
            });
        }

        // Extended / non-standard sizes — read from child row price cells. Iterate ALL
        // sizeBreakdown keys (NOT a hardcoded list) so tall (LT/XLT…), fitted-cap combos
        // (S/M, M/L, L/XL), youth (YS/YM/YL), toddler (2T–6T), big (LB/XLB…) and 7XL+ are
        // NOT dropped from the PDF — they were silently vanishing from the table while their
        // $ stayed in the total, so the products table under-footed. (2026-06-04 audit B3)
        Object.entries(product.sizeBreakdown || {}).forEach(([size, qty]) => {
            if (!(qty > 0)) return;
            if (size === 'SVC') return;                       // service pseudo-size
            if (baseSizes.includes(size)) return;             // already in the grouped base line
            if (size === 'OSFA' && baseQty === 0) return;     // OSFA-only handled above
            const childRowId = embState.childRowMap[rowId]?.[size];
            const childPriceCell = document.getElementById(`row-price-${childRowId}`);
            const childPriceText = childPriceCell?.textContent || '';
            let unitPrice = parseFloat(childPriceText.replace(/[^0-9.]/g, '')) || 0;
            if (!(unitPrice > 0)) unitPrice = baseUnitPrice;  // no child row found → base price
            lineItems.push({
                description: `${size}(${qty})`,
                quantity: qty,
                unitPrice: unitPrice,
                total: qty * unitPrice,
                hasUpcharge: true
            });
        });
    }

    if (lineItems.length === 0) return null;
    return {
            product: {
                style: product.style,
                title: product.productName || product.style,
                color: product.color,
                isCap: product.isCap || false
            },
            lineItems: lineItems
    };
}

function _appendEmbServiceInvoiceItems(invoiceProducts, serviceItems) {
// Add service items (DECG, DECC, AL, Monogram) as invoice products
serviceItems.forEach(si => {
    invoiceProducts.push({
        product: {
            style: si.style,
            title: si.productName || si.title || si.style,
            color: '',
            isService: true,
            isCap: si.isCap || false,
            position: si.position || '',
            totalQuantity: si.totalQuantity
        },
        isService: true,
        lineItems: [{
            description: si.productName || si.title || si.style,
            quantity: si.totalQuantity,
            unitPrice: si.unitPrice,
            total: si.unitPrice * si.totalQuantity
        }]
    });
});

// Stitch surcharge (AS-Garm / AS-CAP) — a flat per-piece charge for a primary logo over 8K
// stitches. It's in the on-screen fee table AND the grand total, but was NEVER emitted as a
// PDF line item, so the products table under-footed (e.g. $3341.50 table vs $3473.50 subtotal
// on EMB-2026-276 — a $132 gap with nothing explaining it). Read the live fee-row values and
// add a real line so the PDF foots. (2026-06-04 audit B2)
[
    { rowId: 'garment-stitch-fee-row', totalId: 'garment-stitch-fee-total', unitId: 'garment-stitch-fee-unit', qtyId: 'garment-stitch-fee-qty', style: 'AS-Garm', label: 'Additional Stitches (Garment)', isCap: false },
    { rowId: 'cap-stitch-fee-row', totalId: 'cap-stitch-fee-total', unitId: 'cap-stitch-fee-unit', qtyId: 'cap-stitch-fee-qty', style: 'AS-CAP', label: 'Additional Stitches (Cap)', isCap: true }
].forEach(s => {
    const row = document.getElementById(s.rowId);
    if (!row || row.style.display === 'none') return;   // surcharge not active
    const total = parseFloat((document.getElementById(s.totalId)?.textContent || '').replace(/[$,]/g, '')) || 0;
    if (!(total > 0)) return;
    const qty = parseInt(document.getElementById(s.qtyId)?.textContent) || 0;
    const unit = parseFloat((document.getElementById(s.unitId)?.textContent || '').replace(/[$,]/g, '')) || 0;
    invoiceProducts.push({
        product: { style: s.style, title: s.label, color: '', isService: true, isCap: s.isCap },
        isService: true,
        lineItems: [{ description: s.label, quantity: qty || 1, unitPrice: unit, total: total }]
    });
});

// Cap embellishment upcharge (3D Puff / Laser Patch) — a flat per-cap add-on shown in the
// on-screen fee table (#cap-embellishment-fee-row) AND folded into #grand-total, but — exactly
// like the AS-CAP stitch surcharge above — it was NEVER emitted as a PDF line item. The products
// table then under-footed by the upcharge total: laser-patch EMB-2026-313 printed a $360 table
// against a $420 subtotal (a $60 gap with nothing explaining it). The per-cap price EXCLUDES this
// upcharge — the engine tracks it separately (embroidery-quote-pricing.js:658 keeps decorationCost
// at embCost; patch/puff totals are added once at :1848/:1851) — so adding the line makes the table
// foot WITHOUT double-counting. Label carries "CODE : Description" (e.g. "Laser Patch : Patch
// Upcharge" / "3D-EMB : 3D Puff Upcharge"); split it so the Style cell shows the ShopWorks code
// and the description reads cleanly. (2026-07-15)
const capEmbRow = document.getElementById('cap-embellishment-fee-row');
if (capEmbRow && capEmbRow.style.display !== 'none') {
    const total = parseFloat((document.getElementById('cap-embellishment-fee-total')?.textContent || '').replace(/[$,]/g, '')) || 0;
    if (total > 0) {
        const qty = parseInt(document.getElementById('cap-embellishment-fee-qty')?.textContent) || 0;
        const unit = parseFloat((document.getElementById('cap-embellishment-fee-unit')?.textContent || '').replace(/[$,]/g, '')) || 0;
        const rawLabel = (document.getElementById('cap-embellishment-fee-label')?.textContent || '').trim();
        const parts = rawLabel.split(':');
        const style = parts.length > 1 ? parts[0].trim() : 'Laser Patch';
        const title = parts.length > 1 ? parts.slice(1).join(':').trim() : (rawLabel || 'Cap Embellishment Upcharge');
        invoiceProducts.push({
            product: { style: style, title: title, color: '', isService: true, isCap: true },
            isService: true,
            lineItems: [{ description: title, quantity: qty || 1, unitPrice: unit, total: total }]
        });
    }
}
}

function buildEmbroideryPricingData(allItems) {
    const productList = allItems.filter(p => !p.isService);
    const serviceItems = allItems.filter(p => p.isService);
    // Use the REAL saved quote ID — edit mode = editingQuoteId; after a save = _pushQuoteId.
    // The legacy #quote-id element was removed in a refactor, so this ALWAYS fell back to a
    // Date.now() temp ID: every printed PDF showed a garbage quote # (e.g. EMB-1780608435889)
    // instead of EMB-2026-276. Only a brand-new, never-saved quote keeps the temp. (2026-06-04 audit)
    const quoteId = (typeof embState.editingQuoteId !== 'undefined' && embState.editingQuoteId)
        || (typeof embState._pushQuoteId !== 'undefined' && embState._pushQuoteId)
        || document.getElementById('quote-id')?.textContent?.trim()
        || `EMB-${Date.now()}`;

    // Build products array with line items for invoice
    const invoiceProducts = [];

    productList.forEach(product => {
        const e = _buildEmbInvoiceProduct(product);
        if (e) invoiceProducts.push(e);
    });

    _appendEmbServiceInvoiceItems(invoiceProducts, serviceItems);

    // Calculate subtotal from line items
    let subtotal = 0;
    invoiceProducts.forEach(p => {
        p.lineItems.forEach(item => { subtotal += item.total; });
    });

    // Read grand total from DOM (includes LTM, setup fees)
    const grandTotalText = document.getElementById('grand-total')?.textContent || '$0.00';
    const grandTotal = parseFloat(grandTotalText.replace(/[$,]/g, '')) || 0;

    // Authoritative pre-tax adjusted subtotal (= base + art/graphic-design/rush/
    // sample/shipping − discount) — this is what the on-screen #grand-total-with-tax
    // taxes. Passing it makes the printed PDF GRAND TOTAL match the on-screen total;
    // without it the generator taxed bare grandTotal and the printed total ignored
    // every additional charge and discount. (2026-06-01)
    const preTaxText = document.getElementById('pre-tax-subtotal')?.textContent || '';
    const preTaxSubtotalVal = parseFloat(preTaxText.replace(/[$,]/g, ''));

    // Read total quantity from DOM
    const totalQty = parseInt(document.getElementById('total-qty')?.textContent) || 0;

    // Tier from DOM
    const tierText = document.getElementById('pricing-tier')?.textContent || '1-7';

    // Logo configurations for embroidery specs section
    const { logoConfigs, allLogos } = buildLogoConfiguration();
    const garmentLogos = [embState.primaryLogo, ...embState.additionalLogos];
    const capLogos = [embState.capPrimaryLogo, ...embState.capAdditionalLogos];

    // Determine what's in the quote
    const hasGarments = productList.some(p => !p.isCap) || serviceItems.some(s => s.serviceType === 'decg');
    const hasCaps = productList.some(p => p.isCap) || serviceItems.some(s => s.serviceType === 'decc');

    // Setup fees (digitizing). Use the SAME API source the on-screen total uses
    // (pricingCalculator.digitizingFee ← /api/pricing-bundle), falling back to the
    // Service_Codes 'DD' rate, NOT a literal 100 — so the printed PDF's Setup
    // Fees / Subtotal lines never diverge from the screen when Erik changes the
    // Caspio digitizing fee. (Theme F, 2026-06-09)
    const digitizingCount = allLogos.filter(l => l.needsDigitizing).length;
    const perLogoDigitizing = (embState.pricingCalculator && Number(embState.pricingCalculator.digitizingFee) > 0)
        ? Number(embState.pricingCalculator.digitizingFee)
        : (typeof getServicePrice === 'function' ? getServicePrice('DD', 100) : 100);
    const setupFees = digitizingCount * perLogoDigitizing;

    // Cap embellishment type
    const capEmbType = getCapEmbellishmentType();

    // Patch setup fee
    const capHasStyle = hasCaps;
    const showPatchSetup = capEmbType === 'laser-patch' && capHasStyle && embState.capPrimaryLogo.needsSetup;
    // Engine's patchSetupFee is the live Service_Codes GRT-50 value; EMB_DEFAULTS is fallback-only.
    const capPatchSetupFee = showPatchSetup
        ? (Number.isFinite(embState.pricingCalculator?.patchSetupFee) ? embState.pricingCalculator.patchSetupFee : EMB_DEFAULTS.PATCH_SETUP_FEE)
        : 0;

    // LTM state
    const ltmState = getLtmControlState('emb-ltm-panel');
    const ltmDistributed = (ltmState.displayMode === 'builtin');

    // Additional charges
    const charges = getAdditionalCharges();

    // 3D puff upcharge. getEmbellishmentUpcharges() returns { puff, patch }
    // (embroidery-quote-pricing.js:574) — there is NO '3d-puff' key, so the old
    // lookup always resolved to 0 and the PDF silently dropped the "3D Puff
    // Upcharge" spec line (the charge was still in the total). Use .puff.
    const puffUpchargePerCap = (capEmbType === '3d-puff' && embState.pricingCalculator)
        ? (embState.pricingCalculator.getEmbellishmentUpcharges?.()?.puff || 0)
        : 0;

    // Tax rate read here (was post-overridden in printQuote pre-3.1.0; contract
    // normalizes percent → decimal at the boundary). The '10.2' fallback preserves
    // the pre-3.1 behavior: an empty input previously fell through to the
    // generator's hardcoded WA standard rate.
    const taxRateRaw = /** @type {HTMLInputElement|null} */ (document.getElementById('tax-rate-input'))?.value || '10.2';

    return window.QuotePricingData.buildPricingData({
        method: 'EMB',
        quoteId: quoteId,
        tier: tierText,
        products: invoiceProducts,
        subtotal: subtotal,
        grandTotal: grandTotal,
        preTaxSubtotal: isNaN(preTaxSubtotalVal) ? undefined : preTaxSubtotalVal,
        includeTax: document.getElementById('include-tax') ? !!/** @type {HTMLInputElement} */ (document.getElementById('include-tax')).checked : true,
        taxRate: taxRateRaw,
        totalQuantity: totalQty,
        setupFees: setupFees + capPatchSetupFee,
        setupFeesCount: digitizingCount,
        // Embroidery-specific
        logos: allLogos,
        logoConfigs: logoConfigs,
        garmentLogos: garmentLogos,
        capLogos: capLogos,
        hasGarments: hasGarments,
        hasCaps: hasCaps,
        capEmbellishmentType: capEmbType,
        capPatchSetupFee: capPatchSetupFee,
        puffUpchargePerCap: puffUpchargePerCap,
        // LTM — already baked into grandTotal
        ltmFee: 0,
        ltmDistributed: ltmDistributed,
        // Fees
        artCharge: charges.artCharge || 0,
        graphicDesignHours: charges.graphicDesignHours || 0,
        graphicDesignCharge: charges.graphicDesignCharge || 0,
        rushFee: charges.rushFee || 0,
        // Itemized on the PDF so the rows foot to the total (already inside preTaxSubtotal).
        shippingFee: parseFloat(/** @type {HTMLInputElement|null} */ (document.getElementById('shipping-fee'))?.value) || 0,
        discount: charges.discount || 0,
        discountReason: charges.discountReason || '',
        // DECG/DECC
        decgQty: charges.decgQty || 0,
        decgUnit: charges.decgUnit || 0,
        decgTotal: charges.decgTotal || 0,
        deccQty: charges.deccQty || 0,
        deccUnit: charges.deccUnit || 0,
        deccTotal: charges.deccTotal || 0
    });
}

/**
 * Copy embroidery quote to clipboard as formatted text
 */
export async function copyToClipboard() {
    const allItems = collectProductsFromTable();
    const productList = allItems.filter(p => !p.isService);
    const serviceItems = allItems.filter(p => p.isService);

    if (allItems.length === 0) {
        showToast('Add products first', 'error');
        return;
    }

    try {
        const text = generateEmbQuoteText(productList, serviceItems);
        await navigator.clipboard.writeText(text);
        showToast('Quote copied to clipboard!', 'success');
    } catch (error) {
        console.error('Copy error:', error);
        showToast('Error copying to clipboard', 'error');
    }
}

/**
 * Generate formatted text for clipboard copy
 */
export function generateEmbQuoteText(products, serviceItems) {
    const capEmbType = getCapEmbellishmentType();
    const capTypeLabel = { 'embroidery': 'Embroidery', '3d-puff': '3D Puff', 'laser-patch': 'Laser Patch' }[capEmbType] || 'Embroidery';

    const lines = [
        'NORTHWEST CUSTOM APPAREL - EMBROIDERY QUOTE',
        '================================================',
        `Date: ${new Date().toLocaleDateString()}`,
        `Customer: ${/** @type {HTMLInputElement|null} */ (document.getElementById('customer-name'))?.value || 'N/A'}`,
        `Company: ${/** @type {HTMLInputElement|null} */ (document.getElementById('company-name'))?.value || 'N/A'}`,
        ''
    ];

    // Embroidery configuration
    lines.push('EMBROIDERY CONFIGURATION:');
    lines.push(`  Primary: ${embState.primaryLogo.position} (${embState.primaryLogo.stitchCount.toLocaleString()} stitches)`);
    if (embState.primaryLogo.needsDigitizing) lines.push('    Needs Digitizing: Yes');
    if (embState.globalAL.garment.enabled) {
        lines.push(`  Additional Location: ${embState.globalAL.garment.stitchCount.toLocaleString()} stitches`);
    }

    const hasCaps = products.some(p => p.isCap) || serviceItems.some(s => s.isCap);
    if (hasCaps) {
        lines.push(`  Cap: ${capTypeLabel} (${embState.capPrimaryLogo.stitchCount.toLocaleString()} stitches)`);
        if (embState.globalAL.cap.enabled) {
            lines.push(`  Cap AL: ${embState.globalAL.cap.stitchCount.toLocaleString()} stitches`);
        }
    }

    // Products
    lines.push('');
    lines.push('PRODUCTS:');
    lines.push('------------------------------------------------');
    products.forEach(p => {
        const sizes = Object.entries(p.sizeBreakdown || {})
            .filter(([, q]) => q > 0)
            .map(([s, q]) => `${s}:${q}`)
            .join(' ');
        const capTag = p.isCap ? ' [CAP]' : '';
        lines.push(`${p.style} - ${p.color}${capTag} | ${sizes} | Qty: ${p.totalQuantity || 0}`);
    });

    // Service items
    if (serviceItems.length > 0) {
        lines.push('');
        serviceItems.forEach(si => {
            lines.push(`${si.style} - ${si.productName || si.title} | Qty: ${si.totalQuantity} | $${si.unitPrice.toFixed(2)}/ea`);
        });
    }

    // Summary — mirror the on-screen invoice totals exactly. #grand-total is
    // merchandise only; the customer-facing TOTAL must include fees, shipping,
    // discount, and tax (it was copying a number lower than the screen/PDF/save).
    const totalQty = document.getElementById('total-qty')?.textContent || '0';
    const tier = document.getElementById('pricing-tier')?.textContent || '1-7';
    const { baseSubtotal, additionalCharges, discount, adjustedSubtotal } = calculateDiscountableSubtotal();
    const includeTax = /** @type {HTMLInputElement|null} */ (document.getElementById('include-tax'))?.checked;
    const taxRatePct = includeTax ? parseRatePercent(/** @type {HTMLInputElement|null} */ (document.getElementById('tax-rate-input'))?.value, 10.2) : 0;
    const taxAmount = Math.round(adjustedSubtotal * (taxRatePct / 100) * 100) / 100;
    const copyTotal = adjustedSubtotal + taxAmount;

    lines.push('');
    lines.push('------------------------------------------------');
    lines.push(`Total Pieces: ${totalQty}`);
    lines.push(`Pricing Tier: ${tier}`);
    lines.push(`Merchandise Subtotal: $${baseSubtotal.toFixed(2)}`);
    if (additionalCharges > 0) lines.push(`Fees & Shipping: $${additionalCharges.toFixed(2)}`);
    if (discount > 0) lines.push(`Discount: -$${discount.toFixed(2)}`);
    if (includeTax) {
        lines.push(`Sales Tax (${taxRatePct}%): $${taxAmount.toFixed(2)}`);
    } else {
        lines.push('Sales Tax: $0.00 (exempt/out of state)');
    }
    lines.push(`TOTAL: $${copyTotal.toFixed(2)}`);
    lines.push('');
    lines.push('Northwest Custom Apparel | 253-922-5793');

    return lines.join('\n');
}

/**
 * Print embroidery quote using EmbroideryInvoiceGenerator
 */
export async function printQuote() {
    // Settle on-screen prices before snapshotting — same guard the save path has.
    // AL rows + Rush are display-driven; printing during a pending recalc put a
    // stale total on the PDF. (audit 2026-06-10)
    try { await syncALRows(); await syncDECGRows(); await recalculatePricing(); } catch (e) { console.warn('[Print] pre-print recalc skipped', e); }

    const allItems = collectProductsFromTable();
    if (allItems.length === 0) {
        showToast('Add products before printing', 'error');
        return;
    }

    // Belt-and-braces $0-print guard (parity with DTF/SCP printQuote, 2026-07-04).
    // The pre-print recalc above already settled on-screen prices; if the grand total
    // still reads $0 (e.g. pricing bundle never loaded), block rather than emit a
    // silent $0.00 customer PDF. Erik's #1 rule: visible failure, never a wrong price.
    // Reads the on-screen total the customer would see (grand-total-with-tax, falling
    // back to the pre-tax grand-total) rather than recomputing.
    const _embTotalEl = document.getElementById('grand-total-with-tax') || document.getElementById('grand-total');
    const _embTotal = parseFloat((_embTotalEl?.textContent || '').replace(/[$,]/g, ''));
    if (!(Number.isFinite(_embTotal) && _embTotal > 0)) {
        showToast('Quote total computed to $0 — pricing may not have loaded. Please re-enter a quantity or refresh before printing.', 'error');
        return;
    }

    showLoading(true);

    try {
        const pricingData = buildEmbroideryPricingData(allItems);

        const invoiceGenerator = new EmbroideryInvoiceGenerator();

        // Billing + shipping addresses for the invoice (2026-06-02, Erik).
        // Billing = the customer's address: prefer the looked-up customer-record
        // address (stashed on customer select); else the ship-to fields when the
        // order actually ships; else none. Pickup ship-to is the Milton SHOP, so
        // it is never used as the billing address. SHIP TO prints only when shipping.
        const shipMethod = /** @type {HTMLInputElement|null} */ (document.getElementById('ship-method'))?.value || '';
        const isPickup = shipMethod === 'Customer Pickup';
        const shipFields = {
            address: /** @type {HTMLInputElement|null} */ (document.getElementById('ship-address'))?.value || '',
            city: /** @type {HTMLInputElement|null} */ (document.getElementById('ship-city'))?.value || '',
            state: /** @type {HTMLInputElement|null} */ (document.getElementById('ship-state'))?.value || '',
            zip: /** @type {HTMLInputElement|null} */ (document.getElementById('ship-zip'))?.value || ''
        };
        const stash = window._lastCustomerShipTo;
        const stashHasAddr = stash && (stash.address || stash.zip);
        const billing = stashHasAddr
            ? { address: stash.address, city: stash.city, state: stash.state, zip: stash.zip }
            : (!isPickup ? shipFields : {});
        const customerData = {
            name: /** @type {HTMLInputElement|null} */ (document.getElementById('customer-name'))?.value || 'Customer',
            company: /** @type {HTMLInputElement|null} */ (document.getElementById('company-name'))?.value || '',
            project: /** @type {HTMLInputElement|null} */ (document.getElementById('project-name'))?.value?.trim() || '',  // P2-5 (audit 2026-06-06): show on PDF/invoice
            isWholesale: /** @type {HTMLInputElement|null} */ (document.getElementById('wholesale-checkbox'))?.checked || false,  // [2026-06-07]
            email: /** @type {HTMLInputElement|null} */ (document.getElementById('customer-email'))?.value || '',
            phone: /** @type {HTMLInputElement|null} */ (document.getElementById('customer-phone'))?.value || '',
            salesRepEmail: /** @type {HTMLInputElement|null} */ (document.getElementById('sales-rep'))?.value || 'sales@nwcustomapparel.com',
            // Special Notes footer — EMB was the only builder NOT printing its own
            // notes textarea (DTF passes it; the generator supports it). (2026-07-07)
            notes: /** @type {HTMLInputElement|null} */ (document.getElementById('notes'))?.value?.trim() || '',
            // Production/customer reference fields (2026-06-04 audit: were never on the PDF)
            poNumber: /** @type {HTMLInputElement|null} */ (document.getElementById('po-number'))?.value?.trim() || '',
            dateOrderPlaced: dateFromInputValue(/** @type {HTMLInputElement|null} */ (document.getElementById('date-order-placed'))?.value),
            reqShipDate: dateFromInputValue(/** @type {HTMLInputElement|null} */ (document.getElementById('req-ship-date'))?.value),
            billing,
            shipping: (!isPickup && (shipFields.address || shipFields.zip)) ? { ...shipFields, method: shipMethod } : null
        };

        const invoiceHTML = invoiceGenerator.generateInvoiceHTML(pricingData, customerData);
        const printWindow = window.open('', '_blank');
        // eslint-disable-next-line no-unsanitized/method -- print window: invoiceHTML from embroidery-quote-invoice.js, which esc()-escapes every customer/product field
        printWindow.document.write(invoiceHTML);
        printWindow.document.close();

        setTimeout(() => {
            printWindow.print();
        }, 300);

        showToast('Opening print dialog...', 'success');
    } catch (error) {
        console.error('Print error:', error);
        showToast('Error generating PDF', 'error');
    }

    showLoading(false);
}

/**
 * Email embroidery quote — requires save first, then calls shared emailQuote()
 */
export async function embEmailQuote() {
    let quoteId = (typeof embState.editingQuoteId !== 'undefined' && embState.editingQuoteId) || (typeof embState._pushQuoteId !== 'undefined' && embState._pushQuoteId);  // also allow a just-saved NEW quote, mirroring printQuote (round-2 N3)
    // Unsaved (or edited-since-save) → auto-save first, exactly like Push does.
    // The old dead-end ("save first" error) made the most common send action a
    // two-step chore. saveAndGetLink validates + shows its own errors. (audit 2026-06-10)
    const dirty = (typeof hasUnsavedChanges === 'function') ? hasUnsavedChanges() : false;
    if (!quoteId || dirty) {
        showToast('Saving quote before emailing…', 'info', 2500);
        await saveAndGetLink({ skipShareModal: true });
        quoteId = (typeof embState.editingQuoteId !== 'undefined' && embState.editingQuoteId) || (typeof embState._pushQuoteId !== 'undefined' && embState._pushQuoteId);
        if (!quoteId) return;   // save failed/blocked — its error is already on screen
    }
    await emailQuote({
        quoteId,
        customerEmail: /** @type {HTMLInputElement|null} */ (document.getElementById('customer-email'))?.value?.trim(),
        customerName: /** @type {HTMLInputElement|null} */ (document.getElementById('customer-name'))?.value?.trim(),
        salesRepEmail: /** @type {HTMLInputElement|null} */ (document.getElementById('sales-rep'))?.value
    });
}
