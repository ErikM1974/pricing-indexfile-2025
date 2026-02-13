#!/usr/bin/env node
/**
 * E2E Batch Runner — Headless Quote Import, Price, Save, Verify & Cleanup
 *
 * Processes a multi-order ShopWorks batch file through the full embroidery
 * quote builder pipeline: parse → enrich → price → save → verify → cleanup.
 *
 * Usage:
 *   node tests/e2e-batch-runner.js <batch-file>                       (dry run — default)
 *   node tests/e2e-batch-runner.js <batch-file> --live                (save + verify + cleanup)
 *   node tests/e2e-batch-runner.js <batch-file> --live --no-cleanup   (save + verify, keep quotes)
 *   node tests/e2e-batch-runner.js <batch-file> --dry-run             (explicit dry run)
 *
 * Batch file format: Orders separated by ===== ORDER N ===== delimiters.
 */
const path = require('path');
const fs = require('fs');

// ── Stub browser globals before loading modules ─────────────────────────────
if (typeof window === 'undefined') global.window = undefined;
if (typeof document === 'undefined') {
    const makeElement = () => ({
        style: {}, className: '', id: '', innerHTML: '', textContent: '',
        appendChild: () => {}, insertBefore: () => {}, removeChild: () => {},
        setAttribute: () => {}, addEventListener: () => {},
        querySelector: () => null, querySelectorAll: () => [],
        parentNode: null, children: [], value: '', checked: false
    });
    global.document = {
        getElementById: () => null,
        querySelector: () => null,
        querySelectorAll: () => [],
        createElement: () => makeElement(),
        createTextNode: () => makeElement(),
        head: makeElement(),
        body: makeElement()
    };
}

const BASE_URL = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';

const ShopWorksImportParser = require('../shared_components/js/shopworks-import-parser');
const EmbroideryPricingCalculator = require('../shared_components/js/embroidery-quote-pricing');

// ── Display Helpers ─────────────────────────────────────────────────────────

function currency(val) {
    if (val == null || isNaN(val)) return '—';
    return '$' + Number(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function printTable(headers, rows) {
    const widths = headers.map((h, i) => {
        const maxData = rows.reduce((max, row) => Math.max(max, String(row[i] || '').length), 0);
        return Math.max(h.length, maxData) + 2;
    });
    const headerLine = headers.map((h, i) => h.padEnd(widths[i])).join('│');
    const separator = widths.map(w => '─'.repeat(w)).join('┼');
    console.log(`  ${headerLine}`);
    console.log(`  ${separator}`);
    for (const row of rows) {
        const rowLine = row.map((cell, i) => String(cell ?? '').padEnd(widths[i])).join('│');
        console.log(`  ${rowLine}`);
    }
}

// ── API Helpers ─────────────────────────────────────────────────────────────

async function fetchJSON(url) {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`API ${resp.status}: ${url}`);
    return resp.json();
}

async function postJSON(url, data) {
    const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`POST ${resp.status}: ${text.substring(0, 200)}`);
    }
    return resp;
}

async function deleteJSON(url) {
    const resp = await fetch(url, { method: 'DELETE' });
    if (!resp.ok) throw new Error(`DELETE ${resp.status}: ${url}`);
    return resp;
}

// ── Verify & Cleanup Helpers ──────────────────────────────────────────────

/**
 * Verify a saved quote by fetching it back and validating fields.
 * Round-trip verification: ensures what was saved can be loaded and matches.
 * @param {string} quoteId - The QuoteID to verify
 * @param {number} expectedProducts - Expected product item count
 * @param {number} expectedTotal - Expected TotalAmount (with tax)
 * @param {Object} [savedSessionData] - Original session data for deep field comparison
 * @returns {{ ok: boolean, checks: Array, session: Object, items: Array }}
 */
async function verifyQuote(quoteId, expectedProducts, expectedTotal, savedSessionData) {
    try {
        // Fetch session and items separately (backend doesn't have /api/public/quote combo endpoint)
        const sessResp = await fetch(`${BASE_URL}/api/quote_sessions?filter=QuoteID%3D'${encodeURIComponent(quoteId)}'`);
        if (!sessResp.ok) return { ok: false, checks: [{ name: 'Fetch session', ok: false, detail: `HTTP ${sessResp.status}` }] };
        const sessions = await sessResp.json();
        if (!sessions || sessions.length === 0) return { ok: false, checks: [{ name: 'Session exists', ok: false, detail: 'No session found' }] };
        const session = sessions[0];

        const itemsResp = await fetch(`${BASE_URL}/api/quote_items?filter=QuoteID%3D'${encodeURIComponent(quoteId)}'`);
        if (!itemsResp.ok) return { ok: false, checks: [{ name: 'Fetch items', ok: false, detail: `HTTP ${itemsResp.status}` }] };
        const allItems = await itemsResp.json();
        const items = (allItems || []).filter(i => i.QuoteID === quoteId);
        const checks = [];

        // ── Core checks (original 8) ────────────────────────────────────

        // 1. Session exists with correct QuoteID
        checks.push({ name: 'QuoteID match', ok: session.QuoteID === quoteId });

        // 2. Status is Open
        checks.push({ name: 'Status=Open', ok: session.Status === 'Open' });

        // 3. Items exist
        checks.push({ name: 'Items saved', ok: items.length > 0, detail: `${items.length} items` });

        // 4. Product item count (embroidery type)
        const productItems = items.filter(i => i.EmbellishmentType === 'embroidery');
        checks.push({ name: 'Product count', ok: productItems.length >= expectedProducts,
            detail: `got ${productItems.length}, expected ${expectedProducts}` });

        // 5. Pricing math: sum of ALL item LineTotals (including TAX) vs session TotalAmount
        const itemsTotal = items.reduce((sum, i) => sum + (parseFloat(i.LineTotal) || 0), 0);
        const sessionTotal = parseFloat(session.TotalAmount) || 0;
        const totalDiff = Math.abs(itemsTotal - sessionTotal);
        checks.push({ name: 'Total math', ok: totalDiff < 2.00,
            detail: `items=$${itemsTotal.toFixed(2)} session=$${sessionTotal.toFixed(2)} diff=$${totalDiff.toFixed(2)}` });

        // 6. Required customer fields present
        checks.push({ name: 'Customer data', ok: !!session.CustomerName && !!session.CustomerEmail });

        // 7. All items have correct QuoteID
        checks.push({ name: 'Item QuoteIDs', ok: items.every(i => i.QuoteID === quoteId) });

        // 8. EmbellishmentType distribution is valid
        const validTypes = new Set(['embroidery', 'embroidery-additional', 'customer-supplied', 'fee', 'monogram']);
        const allTypesValid = items.every(i => validTypes.has(i.EmbellishmentType));
        checks.push({ name: 'Item types valid', ok: allTypesValid });

        // ── Round-trip session field checks (Gap 2 fix) ─────────────────

        if (savedSessionData) {
            // 9. TotalQuantity round-trip
            const savedQty = savedSessionData.TotalQuantity || 0;
            const loadedQty = parseInt(session.TotalQuantity) || 0;
            checks.push({ name: 'TotalQuantity RT', ok: savedQty === loadedQty,
                detail: `saved=${savedQty} loaded=${loadedQty}` });

            // 10. CustomerName round-trip
            checks.push({ name: 'CustomerName RT', ok: session.CustomerName === savedSessionData.CustomerName,
                detail: session.CustomerName !== savedSessionData.CustomerName
                    ? `saved="${savedSessionData.CustomerName}" loaded="${session.CustomerName}"`
                    : undefined });

            // 11. CompanyName round-trip
            checks.push({ name: 'CompanyName RT', ok: session.CompanyName === savedSessionData.CompanyName,
                detail: session.CompanyName !== savedSessionData.CompanyName
                    ? `saved="${savedSessionData.CompanyName}" loaded="${session.CompanyName}"`
                    : undefined });

            // 12. TaxRate round-trip (within floating point tolerance)
            const savedTaxRate = parseFloat(savedSessionData.TaxRate) || 0;
            const loadedTaxRate = parseFloat(session.TaxRate) || 0;
            checks.push({ name: 'TaxRate RT', ok: Math.abs(savedTaxRate - loadedTaxRate) < 0.001,
                detail: `saved=${savedTaxRate} loaded=${loadedTaxRate}` });

            // 13. TaxAmount round-trip
            const savedTaxAmt = parseFloat(savedSessionData.TaxAmount) || 0;
            const loadedTaxAmt = parseFloat(session.TaxAmount) || 0;
            checks.push({ name: 'TaxAmount RT', ok: Math.abs(savedTaxAmt - loadedTaxAmt) < 0.02,
                detail: `saved=$${savedTaxAmt.toFixed(2)} loaded=$${loadedTaxAmt.toFixed(2)}` });

            // 14. OrderNumber round-trip
            if (savedSessionData.OrderNumber) {
                checks.push({ name: 'OrderNumber RT', ok: session.OrderNumber === savedSessionData.OrderNumber,
                    detail: session.OrderNumber !== savedSessionData.OrderNumber
                        ? `saved="${savedSessionData.OrderNumber}" loaded="${session.OrderNumber}"`
                        : undefined });
            }

            // 15. ShipToState round-trip (important for tax determination)
            if (savedSessionData.ShipToState) {
                checks.push({ name: 'ShipToState RT', ok: session.ShipToState === savedSessionData.ShipToState,
                    detail: session.ShipToState !== savedSessionData.ShipToState
                        ? `saved="${savedSessionData.ShipToState}" loaded="${session.ShipToState}"`
                        : undefined });
            }

            // 16. DigitizingCodes round-trip
            if (savedSessionData.DigitizingCodes) {
                checks.push({ name: 'DigitizingCodes RT', ok: (session.DigitizingCodes || '') === savedSessionData.DigitizingCodes,
                    detail: `saved="${savedSessionData.DigitizingCodes}" loaded="${session.DigitizingCodes || ''}"` });
            }

            // 17. SWTotal round-trip
            const savedSW = parseFloat(savedSessionData.SWTotal) || 0;
            const loadedSW = parseFloat(session.SWTotal) || 0;
            if (savedSW > 0) {
                checks.push({ name: 'SWTotal RT', ok: Math.abs(savedSW - loadedSW) < 0.01,
                    detail: `saved=${savedSW} loaded=${loadedSW}` });
            }

            // 18. SWSubtotal round-trip
            const savedSWSub = parseFloat(savedSessionData.SWSubtotal) || 0;
            const loadedSWSub = parseFloat(session.SWSubtotal) || 0;
            if (savedSWSub > 0) {
                checks.push({ name: 'SWSubtotal RT', ok: Math.abs(savedSWSub - loadedSWSub) < 0.01,
                    detail: `saved=${savedSWSub} loaded=${loadedSWSub}` });
            }
        }

        // ── Line item detail checks ─────────────────────────────────────

        // 17. Fee items: check expected ShopWorks part numbers present
        const feeItems = items.filter(i => i.EmbellishmentType === 'fee');
        const feePartNumbers = new Set(feeItems.map(i => i.StyleNumber));
        const validFeePNs = new Set([
            'AS-Garm', 'AS-CAP', 'DD', 'GRT-50', 'GRT-75', 'RUSH', 'SAMPLE',
            'DISCOUNT', '3D-EMB', 'Laser Patch', 'SHIP', 'TAX',
            'Monogram', 'NAME', 'WEIGHT'
        ]);
        const unknownFees = [...feePartNumbers].filter(pn => !validFeePNs.has(pn));
        checks.push({ name: 'Fee PNs valid', ok: unknownFees.length === 0,
            detail: unknownFees.length > 0 ? `unknown: ${unknownFees.join(', ')}` : `${feePartNumbers.size} fee type(s)` });

        // 18. All product items have non-zero FinalUnitPrice
        const zeroPrice = productItems.filter(i => !parseFloat(i.FinalUnitPrice));
        checks.push({ name: 'Product prices', ok: zeroPrice.length === 0,
            detail: zeroPrice.length > 0
                ? `${zeroPrice.length} item(s) with $0 price`
                : `${productItems.length} item(s) priced` });

        // 19. All product items have non-empty SizeBreakdown
        const noSizes = productItems.filter(i => !i.SizeBreakdown || i.SizeBreakdown === '{}');
        checks.push({ name: 'Size breakdowns', ok: noSizes.length === 0,
            detail: noSizes.length > 0
                ? `${noSizes.length} item(s) missing sizes`
                : `all ${productItems.length} have sizes` });

        const allOk = checks.every(c => c.ok);
        return { ok: allOk, checks, session, items };
    } catch (err) {
        return { ok: false, checks: [{ name: 'Verify error', ok: false, detail: err.message }] };
    }
}

/**
 * Delete a saved test quote (session + all items) from Caspio.
 * @param {string} quoteId - The QuoteID to clean up
 * @returns {{ deleted: number, errors: number }}
 */
async function cleanupQuote(quoteId) {
    let deleted = 0;
    let errors = 0;
    try {
        // Fetch session and items separately (backend doesn't have /api/public/quote combo endpoint)
        const sessResp = await fetch(`${BASE_URL}/api/quote_sessions?filter=QuoteID%3D'${encodeURIComponent(quoteId)}'`);
        if (!sessResp.ok) return { deleted: 0, errors: 1 };
        const sessions = await sessResp.json();
        if (!sessions || sessions.length === 0) return { deleted: 0, errors: 1 };
        const session = sessions[0];

        const itemsResp = await fetch(`${BASE_URL}/api/quote_items?filter=QuoteID%3D'${encodeURIComponent(quoteId)}'`);
        const items = itemsResp.ok ? ((await itemsResp.json()) || []).filter(i => i.QuoteID === quoteId) : [];

        // Delete items first (foreign key safety)
        for (const item of items) {
            if (item.PK_ID) {
                try {
                    await deleteJSON(`${BASE_URL}/api/quote_items/${item.PK_ID}`);
                    deleted++;
                } catch (e) { errors++; }
            }
        }

        // Delete session
        if (session.PK_ID) {
            try {
                await deleteJSON(`${BASE_URL}/api/quote_sessions/${session.PK_ID}`);
                deleted++;
            } catch (e) { errors++; }
        }
    } catch (e) { errors++; }
    return { deleted, errors };
}

// ── Known Service Codes (defense-in-depth: catch misclassified services) ────

const SERVICE_CODES = new Set([
    'MONOGRAM', 'NAME', 'NAMES', 'WEIGHT', 'AL', 'DD', 'FB', 'CB', 'CS',
    'GRT-50', 'GRT-75', 'RUSH', 'ART', 'LTM', 'SEG', 'SHIP',
    'SHIPPING', 'FREIGHT', 'DECG', 'DECC', 'AS-GARM', 'AS-CAP',
    'DGT-001', 'DGT-002', 'DGT-003', 'DGT-004'
]);

// ── Cap & SanMar Detection ──────────────────────────────────────────────────

const CAP_KEYWORDS = ['cap', 'hat', 'snapback', 'trucker', 'visor', 'beanie', 'skull'];

function isCapFromDesc(desc) {
    if (!desc) return false;
    const lower = desc.toLowerCase();
    return CAP_KEYWORDS.some(k => lower.includes(k));
}

/**
 * Check if a style is in SanMar via the API.
 * Returns { isSanMar, isCap, title } or null on failure.
 */
async function checkSanMarStyle(style) {
    try {
        // stylesearch returns an array — if any match, it's SanMar
        const data = await fetchJSON(`${BASE_URL}/api/stylesearch?term=${encodeURIComponent(style)}`);
        if (data && data.length > 0) {
            const match = data.find(d => (d.STYLE || d.styleNumber || '').toUpperCase() === style.toUpperCase()) || data[0];
            // Check if it's a cap via CATEGORY_NAME
            let isCap = false;
            try {
                const colors = await fetchJSON(`${BASE_URL}/api/product-colors?styleNumber=${encodeURIComponent(style)}`);
                if (colors && colors.length > 0 && colors[0].CATEGORY_NAME) {
                    isCap = colors[0].CATEGORY_NAME.toLowerCase().includes('cap') ||
                            colors[0].CATEGORY_NAME.toLowerCase().includes('hat');
                }
            } catch (e) { /* cap detection fallback below */ }
            return {
                isSanMar: true,
                isCap,
                title: match.PRODUCT_TITLE || match.productTitle || style
            };
        }
    } catch (e) { /* not found */ }
    return null;
}

// ── Order Processing Pipeline ───────────────────────────────────────────────

/**
 * Process a single order through the full pipeline.
 * @param {string} orderText - Raw text for one order
 * @param {number} orderIndex - 1-based order number in batch
 * @param {EmbroideryPricingCalculator} calc - Pre-initialized pricing calculator
 * @param {boolean} doSave - Whether to save to Caspio
 * @returns {Object} Result summary for this order
 */
async function processOrder(orderText, orderIndex, calc, doSave, noCleanup) {
    const result = {
        orderIndex,
        orderId: null,
        company: null,
        productCount: 0,
        nonSanMarProducts: [],
        services: [],
        ourTotal: 0,
        swTotal: 0,
        swSubtotal: 0,
        priceAudit: null,
        quoteId: null,
        quoteUrl: null,
        savedItems: 0,
        verified: null,       // null=not attempted, true=passed, false=failed
        verifyChecks: [],
        cleanedUp: 0,
        warnings: [],
        error: null
    };

    try {
        // ── STEP 1: PARSE ───────────────────────────────────────────────
        const parser = new ShopWorksImportParser();
        const parsed = parser.parse(orderText);

        result.orderId = parsed.orderId;
        result.company = parsed.customer.company || '(unknown)';
        result.swTotal = parsed.orderSummary.total || 0;
        result.swSubtotal = parsed.orderSummary.subtotal || 0;

        // ── STEP 2: MERGE SIZE-SUFFIXED PRODUCTS ────────────────────────
        const productMap = new Map();
        for (const p of parsed.products) {
            const baseStyle = (p.partNumber || '').replace(/_\w+$/, '');
            const key = `${baseStyle}||${p.color || ''}`;

            if (!productMap.has(key)) {
                productMap.set(key, {
                    style: baseStyle,
                    color: p.color || 'Unknown',
                    catalogColor: p.catalogColor || p.color || '',
                    title: p.description || baseStyle,
                    productName: p.description || baseStyle,
                    sizeBreakdown: {},
                    totalQuantity: 0,
                    isCap: false,
                    sellPriceOverride: 0,
                    sizeOverrides: {},
                    imageUrl: '',
                    logoAssignments: { primary: null, additional: [] },
                    _swUnitPrice: p.unitPrice || 0
                });
            }

            const merged = productMap.get(key);
            const sizes = p.sizes || {};
            for (const [sz, qty] of Object.entries(sizes)) {
                if (qty > 0) {
                    merged.sizeBreakdown[sz] = (merged.sizeBreakdown[sz] || 0) + qty;
                    merged.totalQuantity += qty;
                }
            }
        }

        // ── STEP 3: ENRICH — SanMar check + cap detection ──────────────
        // Cache style lookups to avoid duplicate API calls within a batch
        const uniqueStyles = [...new Set(Array.from(productMap.values()).map(p => p.style))];
        const sanMarCache = {};

        for (const style of uniqueStyles) {
            // Skip SanMar lookup for known service codes (parser misclassification guard)
            const upperStyle = style.toUpperCase().replace(/_OSFA$/, '');
            if (SERVICE_CODES.has(upperStyle) || upperStyle.startsWith('DGT-')) {
                result.warnings.push(`"${style}" is a service code, not a product (parser misclassified)`);
                productMap.forEach((val, key) => {
                    if (val.style === style) productMap.delete(key);
                });
                continue;
            }
            const info = await checkSanMarStyle(style);
            sanMarCache[style] = info; // null if not SanMar
        }

        // Apply enrichment results
        for (const [, product] of productMap) {
            const info = sanMarCache[product.style];
            if (info) {
                product.isCap = info.isCap || isCapFromDesc(product.title);
                product.title = info.title || product.title;
            } else {
                // Not in SanMar — use ShopWorks price as override
                product.sellPriceOverride = product._swUnitPrice;
                product.isCap = isCapFromDesc(product.title);
                result.nonSanMarProducts.push({
                    style: product.style,
                    description: product.title,
                    swPrice: product._swUnitPrice,
                    color: product.color
                });
            }
        }

        // Add custom products (parser already classified these)
        for (const p of parsed.customProducts) {
            const key = `custom_${p.partNumber}||${p.color || ''}`;
            const isCap = isCapFromDesc(p.description);
            productMap.set(key, {
                style: p.partNumber || 'Custom',
                color: p.color || 'Unknown',
                catalogColor: '',
                title: p.description || p.partNumber || 'Custom Item',
                productName: p.description || p.partNumber || 'Custom Item',
                sizeBreakdown: p.sizes && Object.keys(p.sizes).length > 0
                    ? p.sizes
                    : { 'OSFA': p.quantity || 1 },
                totalQuantity: p.quantity || 1,
                isCap,
                sellPriceOverride: p.unitPrice || 0,
                sizeOverrides: {},
                imageUrl: '',
                logoAssignments: { primary: null, additional: [] }
            });

            // Track non-SanMar
            result.nonSanMarProducts.push({
                style: p.partNumber || 'Custom',
                description: p.description || 'Custom Item',
                swPrice: p.unitPrice || 0,
                color: p.color || ''
            });
        }

        // Filter out zero-quantity products (e.g., $0 duplicate lines)
        const mergedProducts = Array.from(productMap.values()).filter(p => p.totalQuantity > 0);
        result.productCount = mergedProducts.length;

        // ── STEP 4: BUILD LOGO CONFIGURATION ────────────────────────────
        const garmentProducts = mergedProducts.filter(p => !p.isCap);
        const capProductsList = mergedProducts.filter(p => p.isCap);
        const garmentQty = garmentProducts.reduce((s, p) => s + p.totalQuantity, 0);
        const capQty = capProductsList.reduce((s, p) => s + p.totalQuantity, 0);

        const primaryGarmentLogo = garmentQty > 0 ? {
            id: 'primary', position: 'Left Chest', stitchCount: 8000,
            needsDigitizing: parsed.services.digitizing, isPrimary: true
        } : null;

        const primaryCapLogo = capQty > 0 ? {
            id: 'cap-primary', position: 'Cap Front', stitchCount: 5000,
            needsDigitizing: parsed.services.digitizing && parsed.services.digitizingCount > 1,
            isPrimary: true, embellishmentType: 'embroidery'
        } : null;

        // Additional logos from parsed services
        const garmentALLogos = [];
        const capALLogos = [];

        if (parsed.services.additionalLogos && parsed.services.additionalLogos.length > 0) {
            for (const al of parsed.services.additionalLogos) {
                if (al.type === 'cb' || al.type === 'cs') {
                    // Cap back/side — cap AL
                    capALLogos.push({
                        id: `cap-al-${al.type}`, position: al.position,
                        stitchCount: 5000, needsDigitizing: false, isPrimary: false
                    });
                } else if (al.type === 'fb') {
                    // Full back — garment AL
                    garmentALLogos.push({
                        id: `garment-al-fb`, position: 'Full Back',
                        stitchCount: 25000, needsDigitizing: false, isPrimary: false
                    });
                } else {
                    // Standard AL
                    if (garmentQty > 0) {
                        garmentALLogos.push({
                            id: 'global-al-garment', position: 'AL',
                            stitchCount: 8000, needsDigitizing: false, isPrimary: false
                        });
                    }
                }
            }
        } else if (parsed.services.additionalLogo) {
            // Legacy single AL
            if (garmentQty > 0) {
                garmentALLogos.push({
                    id: 'global-al-garment', position: 'AL',
                    stitchCount: 8000, needsDigitizing: false, isPrimary: false
                });
            }
        }

        // Assign logos to products
        for (const p of mergedProducts) {
            if (p.isCap) {
                p.logoAssignments.primary = primaryCapLogo
                    ? { logoId: 'cap-primary', quantity: p.totalQuantity }
                    : null;
                if (capALLogos.length > 0) {
                    p.logoAssignments.additional = capALLogos.map(al => ({
                        id: al.id, position: al.position,
                        stitchCount: al.stitchCount, quantity: p.totalQuantity
                    }));
                }
            } else {
                p.logoAssignments.primary = primaryGarmentLogo
                    ? { logoId: 'primary', quantity: p.totalQuantity }
                    : null;
                if (garmentALLogos.length > 0) {
                    p.logoAssignments.additional = garmentALLogos.map(al => ({
                        id: al.id, position: al.position,
                        stitchCount: al.stitchCount, quantity: p.totalQuantity
                    }));
                }
            }
        }

        const logoConfigs = {
            garment: { primary: primaryGarmentLogo, additional: garmentALLogos },
            cap: { primary: primaryCapLogo, additional: capALLogos }
        };
        const allLogos = [primaryGarmentLogo, ...garmentALLogos, primaryCapLogo, ...capALLogos].filter(Boolean);

        // Collect services for summary
        if (parsed.services.digitizing) {
            // Show DGT codes if available, otherwise just DD
            const dgtCodes = parsed.services.digitizingFees?.filter(f => f.code.startsWith('DGT-'));
            if (dgtCodes?.length > 0) {
                for (const dgt of dgtCodes) result.services.push(`${dgt.code} $${dgt.amount}`);
            } else {
                result.services.push(`DD x${parsed.services.digitizingCount}`);
            }
        }
        if (parsed.services.additionalLogos?.length > 0) result.services.push(`AL x${parsed.services.additionalLogos.length}`);
        else if (parsed.services.additionalLogo) result.services.push('AL');
        if (parsed.services.monograms.length > 0) result.services.push(`Monogram x${parsed.services.monograms.reduce((s, m) => s + m.quantity, 0)}`);
        if (parsed.services.weights?.length > 0) result.services.push(`Weight x${parsed.services.weights.reduce((s, w) => s + w.quantity, 0)}`);
        if (parsed.services.rush) result.services.push('RUSH');
        if (parsed.services.artCharges) result.services.push('ART');
        if (parsed.services.graphicDesign) result.services.push('GRT-75');
        if (parsed.services.patchSetup) result.services.push('GRT-50');
        if (parsed.services.shipping) result.services.push('SHIP');

        // ── STEP 5: PRICE ───────────────────────────────────────────────
        // Calculate DECG/DECC totals (customer-supplied garments/caps)
        const decgTotal = parsed.decgItems.reduce((sum, d) => sum + ((d.unitPrice || 0) * (d.quantity || 0)), 0);

        if (mergedProducts.length === 0 && decgTotal === 0) {
            result.warnings.push('No products to price');
            return result;
        }

        let pricingGrandTotal = 0;
        if (mergedProducts.length > 0) {
            const pricing = await calc.calculateQuote(mergedProducts, allLogos, logoConfigs);
            if (!pricing || pricing.error) {
                result.error = `Pricing failed: ${pricing?.error || 'null result'}`;
                return result;
            }
            pricingGrandTotal = pricing.grandTotal || 0;
            // Store pricing for save step
            result._pricing = pricing;
        }

        if (parsed.decgItems.length > 0) {
            result.services.push(`DECG x${parsed.decgItems.reduce((s, d) => s + (d.quantity || 0), 0)}`);
        }

        // Calculate fees from parsed services
        const artCharge = parsed.services.artCharges?.amount || 0;
        const graphicDesignHours = parsed.services.graphicDesign?.hours || 0;
        const graphicDesignCharge = parsed.services.graphicDesign?.amount || 0;
        const rushFee = parsed.services.rush?.amount || 0;
        const shippingFee = parsed.orderSummary.shipping || parsed.services.shipping?.amount || 0;
        const monogramTotal = parsed.services.monograms.reduce((s, m) => s + m.total, 0);
        const weightTotal = parsed.services.weights?.reduce((s, w) => s + w.total, 0) || 0;
        const taxRate = (parsed.orderSummary.taxRate || 0) / 100;
        // Include DECG, monogram, weight in taxable base (matches embroidery builder behavior)
        const taxableBase = pricingGrandTotal + decgTotal + artCharge + graphicDesignCharge + rushFee + shippingFee + monogramTotal + weightTotal;
        const taxAmount = Math.round(taxableBase * taxRate * 100) / 100;
        const totalAmount = taxableBase + taxAmount;

        result.ourTotal = totalAmount;

        // ── PRICE AUDIT: Compare SW pricing vs 2026 calculated ─────────
        const pricingForAudit = result._pricing || { grandTotal: 0, products: [] };
        const swSub = parsed.orderSummary.subtotal || 0;
        const ourSub = pricingGrandTotal;
        const deltaSub = ourSub - swSub;
        const deltaPct = swSub > 0 ? Math.abs(deltaSub / swSub) * 100 : 0;
        const auditFlag = deltaPct <= 5 ? 'OK' : deltaPct <= 15 ? 'REVIEW' : 'MISMATCH';

        const auditProducts = [];
        for (const pp of (pricingForAudit.products || [])) {
            const firstLi = (pp.lineItems || [pp])[0];
            const ourUnit = firstLi?.unitPriceWithLTM || firstLi?.unitPrice || 0;
            const swUnit = pp.product?._swUnitPrice || 0;
            const qty = pp.product?.totalQuantity || 0;
            const pDelta = ourUnit - swUnit;
            const pPct = swUnit > 0 ? Math.abs(pDelta / swUnit) * 100 : 0;
            auditProducts.push({
                style: pp.product?.style || '?',
                color: pp.product?.color || '?',
                qty,
                swUnit: parseFloat(swUnit.toFixed(2)),
                ourUnit: parseFloat(ourUnit.toFixed(2)),
                delta: parseFloat(pDelta.toFixed(2)),
                flag: pPct <= 5 ? 'OK' : pPct <= 15 ? 'REVIEW' : 'MISMATCH'
            });
        }

        result.priceAudit = {
            swTotal: result.swTotal,
            swSubtotal: swSub,
            ourSubtotal: parseFloat(ourSub.toFixed(2)),
            deltaSubtotal: parseFloat(deltaSub.toFixed(2)),
            deltaPct: parseFloat(deltaPct.toFixed(1)),
            flag: auditFlag,
            products: auditProducts
        };

        // ── STEP 6: SAVE (--live only) ──────────────────────────────────
        const pricing = result._pricing || { grandTotal: 0, totalQuantity: 0, subtotal: 0, ltmFee: 0, products: [], additionalServices: [], garmentQuantity: 0, capQuantity: 0 };
        if (doSave) {
            const seqResp = await fetchJSON(`${BASE_URL}/api/quote-sequence/EMB`);
            const quoteID = `${seqResp.prefix}-${seqResp.year}-${String(seqResp.sequence).padStart(3, '0')}`;
            const sessionID = `emb_batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().replace(/\.\d{3}Z$/, '');
            const addedAt = new Date().toISOString().replace(/\.\d{3}Z$/, '');

            result.quoteId = quoteID;
            result.quoteUrl = `https://nwcustomapparel.com/pages/quote-view.html?quoteId=${quoteID}`;

            const primaryLogo = allLogos.find(l => l?.id === 'primary' || l?.isPrimary);
            const additionalLogo = allLogos.find(l => l?.id?.includes('additional') && !l?.id?.includes('cap'));
            const capPrimLogo = allLogos.find(l => l?.id === 'cap-primary');

            const customerData = {
                email: parsed.customer.email || 'import@nwcustomapparel.com',
                name: parsed.customer.contactName || parsed.customer.company || 'Import',
                company: parsed.customer.company || 'Not Provided',
                salesRepEmail: parsed.salesRep.email || 'sales@nwcustomapparel.com',
                salesRepName: parsed.salesRep.name || ''
            };

            // Build session data (mirrors EmbroideryQuoteService.saveQuote)
            const sessionData = {
                QuoteID: quoteID,
                SessionID: sessionID,
                CustomerEmail: customerData.email,
                CustomerName: customerData.name,
                CompanyName: customerData.company,
                SalesRepEmail: customerData.salesRepEmail,
                SalesRepName: customerData.salesRepName,
                TotalQuantity: pricing.totalQuantity || 0,
                SubtotalAmount: parseFloat(((pricing.subtotal || 0) + (pricing.ltmFee || 0) + decgTotal + monogramTotal + weightTotal).toFixed(2)),
                LTMFeeTotal: parseFloat((pricing.ltmFee || 0).toFixed(2)),
                TotalAmount: parseFloat(totalAmount.toFixed(2)),
                Status: 'Open',
                CreatedAt_Quote: addedAt,
                ExpiresAt: expiresAt,
                Notes: parsed.notes.join('\n') || '',
                PrintLocation: primaryLogo?.position || 'Left Chest',
                StitchCount: primaryLogo?.stitchCount || 8000,
                DigitizingFee: primaryLogo?.needsDigitizing ? 100 : 0,
                AdditionalLogoLocation: additionalLogo?.position || '',
                AdditionalStitchCount: pricing.additionalServices?.find(s => !s.isCap && s.type === 'additional_logo')?.stitchCount || 0,
                CapPrintLocation: capPrimLogo?.position || '',
                CapStitchCount: capPrimLogo?.stitchCount || 0,
                CapDigitizingFee: capPrimLogo?.needsDigitizing ? 100 : 0,
                CapEmbellishmentType: pricing.capEmbellishmentType || 'embroidery',
                GarmentStitchCharge: parseFloat(pricing.garmentStitchTotal?.toFixed(2)) || 0,
                CapStitchCharge: parseFloat(pricing.capStitchTotal?.toFixed(2)) || 0,
                AdditionalStitchCharge: parseFloat(pricing.additionalStitchTotal?.toFixed(2)) || 0,
                ALChargeGarment: parseFloat(pricing.additionalServices?.filter(s => !s.isCap)?.reduce((sum, s) => sum + (s.total || 0), 0)?.toFixed(2)) || 0,
                ALChargeCap: parseFloat(pricing.additionalServices?.filter(s => s.isCap)?.reduce((sum, s) => sum + (s.total || 0), 0)?.toFixed(2)) || 0,
                ALGarmentQty: pricing.garmentQuantity || 0,
                ALCapQty: pricing.capQuantity || 0,
                ALGarmentUnitPrice: pricing.additionalServices?.find(s => !s.isCap)?.unitPrice || 0,
                ALCapUnitPrice: pricing.additionalServices?.find(s => s.isCap)?.unitPrice || 0,
                ALGarmentDesc: pricing.additionalServices?.find(s => !s.isCap)?.description || '',
                ALCapDesc: pricing.additionalServices?.find(s => s.isCap)?.description || '',
                GarmentDigitizing: parseFloat(pricing.garmentSetupFees?.toFixed(2)) || 0,
                CapDigitizing: parseFloat(pricing.capSetupFees?.toFixed(2)) || 0,
                AdditionalStitchUnitPrice: pricing.totalQuantity > 0
                    ? parseFloat((pricing.additionalStitchTotal / pricing.totalQuantity).toFixed(4)) || 0 : 0,
                ArtCharge: parseFloat(artCharge.toFixed(2)) || 0,
                GraphicDesignHours: graphicDesignHours || 0,
                GraphicDesignCharge: parseFloat(graphicDesignCharge.toFixed(2)) || 0,
                RushFee: parseFloat(rushFee.toFixed(2)) || 0,
                SampleFee: 0,
                SampleQty: 0,
                LTM_Garment: 0,
                LTM_Cap: 0,
                Discount: 0,
                DiscountPercent: 0,
                DiscountReason: '',
                Phone: parsed.customer.phone || '',
                OrderNumber: parsed.orderId || '',
                CustomerNumber: parsed.customer.customerId || '',
                PurchaseOrderNumber: parsed.purchaseOrderNumber || '',
                ShipToAddress: parsed.shipping?.street || '',
                ShipToCity: parsed.shipping?.city || '',
                ShipToState: parsed.shipping?.state || '',
                ShipToZip: parsed.shipping?.zip || '',
                ShipMethod: parsed.shipping?.method || '',
                DateOrderPlaced: parsed.dateOrderPlaced ? new Date(parsed.dateOrderPlaced).toISOString() : null,
                ReqShipDate: parsed.reqShipDate ? new Date(parsed.reqShipDate).toISOString() : null,
                DropDeadDate: parsed.dropDeadDate ? new Date(parsed.dropDeadDate).toISOString() : null,
                PaymentTerms: parsed.paymentTerms || '',
                DesignNumbers: JSON.stringify(parsed.designNumbers || []),
                DigitizingCodes: (parsed.services.digitizingCodes || []).join(','),
                TaxRate: taxRate,
                TaxAmount: taxAmount,
                ImportNotes: JSON.stringify([...parsed.warnings, ...parsed.unmatchedLines.map(u =>
                    typeof u === 'object' ? `[${u.section}] ${u.line}` : u
                )]),
                PaidToDate: parsed.orderSummary.paidToDate ?? 0,
                BalanceAmount: parsed.orderSummary.balance ?? 0,
                OrderNotes: parsed.orderNotes || '',
                // ShopWorks pricing audit (2026-02-13)
                SWTotal: parsed.orderSummary.total || 0,
                SWSubtotal: parsed.orderSummary.subtotal || 0,
                PriceAuditJSON: JSON.stringify(result.priceAudit || {})
            };

            // Save session
            await postJSON(`${BASE_URL}/api/quote_sessions`, sessionData);

            // Save product line items
            let lineNumber = 1;
            let savedCount = 0;
            let isFirstItem = true;

            for (const pp of pricing.products) {
                for (const li of pp.lineItems) {
                    let logoSpecsData = '';
                    if (isFirstItem) {
                        try {
                            logoSpecsData = JSON.stringify({
                                logos: allLogos.map(l => ({
                                    pos: l.position, stitch: l.stitchCount,
                                    digit: l.needsDigitizing ? 1 : 0, primary: l.isPrimary ? 1 : 0
                                })),
                                tier: pricing.tier, setup: pricing.setupFees
                            });
                        } catch (e) { logoSpecsData = ''; }
                    }

                    // Parse size breakdown from description
                    const sizeBreakdown = {};
                    const sizeRegex = /([A-Z0-9\/]+)\((\d+)\)/gi;
                    let match;
                    while ((match = sizeRegex.exec(li.description)) !== null) {
                        sizeBreakdown[match[1].toUpperCase()] = parseInt(match[2]);
                    }

                    // Check for sell price override
                    const hasPriceOverride = pp.product.sellPriceOverride > 0;
                    let itemLogoSpecs = logoSpecsData;
                    if (hasPriceOverride) {
                        try {
                            const parsed2 = itemLogoSpecs ? JSON.parse(itemLogoSpecs) : {};
                            parsed2.priceOverride = true;
                            parsed2.overridePrice = pp.product.sellPriceOverride;
                            itemLogoSpecs = JSON.stringify(parsed2);
                        } catch (e) {
                            itemLogoSpecs = JSON.stringify({ priceOverride: true, overridePrice: pp.product.sellPriceOverride });
                        }
                    }

                    await postJSON(`${BASE_URL}/api/quote_items`, {
                        QuoteID: quoteID,
                        LineNumber: lineNumber++,
                        StyleNumber: pp.product.style,
                        ProductName: `${pp.product.title} - ${pp.product.color}`,
                        Color: pp.product.color,
                        ColorCode: pp.product.catalogColor || '',
                        EmbellishmentType: 'embroidery',
                        PrintLocation: allLogos.map(l => l.positionCode || l.position).join('_'),
                        PrintLocationName: allLogos.map(l => l.position).join(' + '),
                        Quantity: li.quantity,
                        HasLTM: pricing.ltmFee > 0 ? 'Yes' : 'No',
                        BaseUnitPrice: parseFloat((li.unitPriceWithLTM || li.unitPrice).toFixed(2)),
                        LTMPerUnit: parseFloat((li.ltmPerUnit || 0).toFixed(2)),
                        FinalUnitPrice: parseFloat((li.unitPriceWithLTM || li.unitPrice).toFixed(2)),
                        LineTotal: parseFloat(((li.unitPriceWithLTM || li.unitPrice) * li.quantity).toFixed(2)),
                        SizeBreakdown: JSON.stringify(sizeBreakdown),
                        PricingTier: pp.isCap ? pricing.capTier : pricing.garmentTier,
                        ImageURL: pp.product.imageUrl || '',
                        AddedAt: addedAt,
                        LogoSpecs: itemLogoSpecs
                    });
                    savedCount++;
                    isFirstItem = false;
                }
            }

            // Save additional service items (AL, Monogram, FB)
            for (const svc of pricing.additionalServices) {
                await postJSON(`${BASE_URL}/api/quote_items`, {
                    QuoteID: quoteID,
                    LineNumber: lineNumber++,
                    StyleNumber: svc.partNumber,
                    ProductName: svc.description,
                    Color: '',
                    ColorCode: '',
                    EmbellishmentType: svc.type === 'monogram' ? 'monogram' : 'embroidery-additional',
                    PrintLocation: svc.location || '',
                    PrintLocationName: svc.location || '',
                    Quantity: svc.quantity,
                    HasLTM: 'No',
                    BaseUnitPrice: parseFloat(svc.unitPrice.toFixed(2)),
                    LTMPerUnit: 0,
                    FinalUnitPrice: parseFloat(svc.unitPrice.toFixed(2)),
                    LineTotal: parseFloat(svc.total.toFixed(2)),
                    SizeBreakdown: JSON.stringify(svc.metadata || {}),
                    PricingTier: svc.isCap ? pricing.capTier : pricing.tier,
                    ImageURL: '',
                    AddedAt: addedAt,
                    LogoSpecs: ''
                });
                savedCount++;
            }

            // Save DECG items
            if (parsed.decgItems.length > 0) {
                for (const decg of parsed.decgItems) {
                    const isDECC = decg.type === 'DECC' || (decg.serviceType === 'decc');
                    await postJSON(`${BASE_URL}/api/quote_items`, {
                        QuoteID: quoteID,
                        LineNumber: lineNumber++,
                        StyleNumber: isDECC ? 'DECC' : 'DECG',
                        ProductName: isDECC ? 'Customer-Supplied Caps' : 'Customer-Supplied Garments',
                        Color: '',
                        ColorCode: '',
                        EmbellishmentType: 'customer-supplied',
                        PrintLocation: '',
                        PrintLocationName: '',
                        Quantity: decg.quantity,
                        HasLTM: 'No',
                        BaseUnitPrice: parseFloat((decg.unitPrice || 0).toFixed(2)),
                        LTMPerUnit: 0,
                        FinalUnitPrice: parseFloat((decg.unitPrice || 0).toFixed(2)),
                        LineTotal: parseFloat(((decg.unitPrice || 0) * decg.quantity).toFixed(2)),
                        SizeBreakdown: JSON.stringify({ type: isDECC ? 'DECC' : 'DECG' }),
                        PricingTier: '',
                        ImageURL: '',
                        AddedAt: addedAt,
                        LogoSpecs: ''
                    });
                    savedCount++;
                }
            }

            // Build and save fee items
            const feeItems = [];

            if (sessionData.GarmentStitchCharge > 0) {
                const gQty = pricing.garmentQuantity || 1;
                feeItems.push({ pn: 'AS-Garm', name: 'Extra Stitches - Garments', qty: gQty,
                    unit: parseFloat((sessionData.GarmentStitchCharge / gQty).toFixed(4)), total: sessionData.GarmentStitchCharge });
            }
            if (sessionData.CapStitchCharge > 0) {
                const cQty = pricing.capQuantity || 1;
                feeItems.push({ pn: 'AS-CAP', name: 'Extra Stitches - Caps', qty: cQty,
                    unit: parseFloat((sessionData.CapStitchCharge / cQty).toFixed(4)), total: sessionData.CapStitchCharge });
            }
            if (sessionData.GarmentDigitizing > 0)
                feeItems.push({ pn: 'DD', name: 'Digitizing - Garments', qty: 1, unit: sessionData.GarmentDigitizing, total: sessionData.GarmentDigitizing });
            if (sessionData.CapDigitizing > 0)
                feeItems.push({ pn: 'DD', name: 'Digitizing - Caps', qty: 1, unit: sessionData.CapDigitizing, total: sessionData.CapDigitizing });
            if (artCharge > 0)
                feeItems.push({ pn: 'GRT-50', name: 'Art/Setup Fee', qty: 1, unit: artCharge, total: artCharge });
            if (graphicDesignCharge > 0)
                feeItems.push({ pn: 'GRT-75', name: 'Graphic Design Services', qty: graphicDesignHours || 1, unit: 75, total: graphicDesignCharge });
            if (rushFee > 0)
                feeItems.push({ pn: 'RUSH', name: 'Rush Order Fee', qty: 1, unit: rushFee, total: rushFee });
            if (shippingFee > 0)
                feeItems.push({ pn: 'SHIP', name: 'Shipping', qty: 1, unit: shippingFee, total: shippingFee });
            // Monogram/Name fee items
            for (const mono of parsed.services.monograms) {
                feeItems.push({ pn: 'Monogram', name: `Names/Monograms: ${mono.description || 'Personalization'}`, qty: mono.quantity, unit: mono.unitPrice, total: mono.total });
            }
            // Weight service fee items
            for (const wt of (parsed.services.weights || [])) {
                feeItems.push({ pn: 'WEIGHT', name: `Weight: ${wt.description || 'Per-Person Weight'}`, qty: wt.quantity, unit: wt.unitPrice, total: wt.total });
            }
            if (taxAmount > 0)
                feeItems.push({ pn: 'TAX', name: `Sales Tax (${(taxRate * 100).toFixed(1)}%)`, qty: 1, unit: taxRate * 100, total: taxAmount });

            for (const fee of feeItems) {
                await postJSON(`${BASE_URL}/api/quote_items`, {
                    QuoteID: quoteID,
                    LineNumber: lineNumber++,
                    StyleNumber: fee.pn,
                    ProductName: fee.name,
                    Color: '',
                    ColorCode: '',
                    EmbellishmentType: 'fee',
                    PrintLocation: '',
                    PrintLocationName: '',
                    Quantity: fee.qty,
                    HasLTM: 'No',
                    BaseUnitPrice: parseFloat(fee.unit.toFixed(2)),
                    LTMPerUnit: 0,
                    FinalUnitPrice: parseFloat(fee.unit.toFixed(2)),
                    LineTotal: parseFloat(fee.total.toFixed(2)),
                    SizeBreakdown: '',
                    PricingTier: '',
                    ImageURL: '',
                    AddedAt: addedAt,
                    LogoSpecs: ''
                });
                savedCount++;
            }

            result.savedItems = savedCount;

            // ── STEP 7: VERIFY SAVED QUOTE ───────────────────────────────
            // Brief delay for Caspio to process the writes
            await new Promise(r => setTimeout(r, 1500));

            const verify = await verifyQuote(quoteID, result.productCount, totalAmount, sessionData);
            result.verified = verify.ok;
            result.verifyChecks = verify.checks;

            if (!verify.ok) {
                const failures = verify.checks.filter(c => !c.ok).map(c =>
                    c.detail ? `${c.name} (${c.detail})` : c.name
                );
                result.warnings.push(`Verify failed: ${failures.join(', ')}`);
            }

            // ── STEP 8: CLEANUP (unless --no-cleanup) ────────────────────
            if (!noCleanup) {
                const cleanup = await cleanupQuote(quoteID);
                result.cleanedUp = cleanup.deleted;
            }
        }

        result.warnings.push(...parsed.warnings, ...parsed.unmatchedLines.map(u =>
            typeof u === 'object' ? `[${u.section}] ${u.line}` : u
        ));

    } catch (err) {
        result.error = err.message;
    }

    return result;
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
    const args = process.argv.slice(2);
    const filePath = args.find(a => !a.startsWith('--'));
    const doSave = args.includes('--live');
    const noCleanup = args.includes('--no-cleanup');

    if (!filePath) {
        console.error('Usage: node tests/e2e-batch-runner.js <batch-file> [--live] [--no-cleanup] [--dry-run]');
        console.error('  --dry-run      Parse + enrich + price + report (default)');
        console.error('  --live         Save to Caspio + verify + cleanup');
        console.error('  --no-cleanup   Keep quotes after verification (use with --live)');
        process.exit(1);
    }

    const absPath = path.resolve(filePath);
    if (!fs.existsSync(absPath)) {
        console.error(`File not found: ${absPath}`);
        process.exit(1);
    }

    const batchText = fs.readFileSync(absPath, 'utf8');

    // Suppress noisy module logs
    const origLog = console.log;
    const origWarn = console.warn;
    const origError = console.error;
    const suppress = (...a) => {
        if (typeof a[0] === 'string' && (
            a[0].includes('[ShopWorksImportParser]') ||
            a[0].includes('[EmbroideryPricingCalculator]') ||
            a[0].includes('Module loaded') ||
            a[0].includes('utilities loaded')
        )) return;
        origLog.apply(console, a);
    };
    const suppressWarn = (...a) => {
        if (typeof a[0] === 'string' && (
            a[0].includes('[Embroidery') ||
            a[0].includes('[ShopWorks')
        )) return;
        origWarn.apply(console, a);
    };
    console.log = suppress;
    console.warn = suppressWarn;

    // Split batch into individual orders
    const batchDelimiter = /^={10,}\s*ORDER\s+\d+\s*={10,}$/m;
    let orderTexts;

    if (batchDelimiter.test(batchText)) {
        const chunks = batchText.split(batchDelimiter);
        orderTexts = chunks
            .map(c => c.replace(/^={10,}\s*$/gm, '').trim())
            .filter(c => c.length > 0 && /Order\s*#:/i.test(c)); // Skip preamble chunks
    } else {
        // Single order
        orderTexts = [batchText.trim()];
    }

    console.log = origLog;
    console.warn = origWarn;

    console.log('\n' + '═'.repeat(70));
    console.log(`  E2E BATCH RUNNER — ${orderTexts.length} order(s)`);
    const modeLabel = doSave
        ? (noCleanup ? 'LIVE (save + verify, keep quotes)' : 'LIVE (save + verify + cleanup)')
        : 'DRY RUN (no saves)';
    console.log(`  Mode: ${modeLabel}`);
    console.log(`  File: ${path.basename(absPath)}`);
    console.log('═'.repeat(70));

    // Initialize pricing calculator once (reuse across all orders)
    console.log('\n  Initializing pricing engine (live API)...');
    console.log = suppress;
    console.warn = suppressWarn;
    console.error = (...a) => {
        if (typeof a[0] === 'string' && a[0].includes('[EmbroideryPricingCalculator]')) return;
        origError.apply(console, a);
    };

    const calc = new EmbroideryPricingCalculator({ skipInit: true });
    await calc.initializeConfig();
    if (calc.apiError) {
        console.log = origLog;
        console.warn = origWarn;
        console.error = origError;
        console.error('  FATAL: Pricing engine failed to initialize. Cannot proceed.');
        process.exit(1);
    }
    // Ensure cap pricing is also loaded
    await calc.initializeCapConfig();

    console.log = origLog;
    console.warn = origWarn;
    console.error = origError;
    console.log('  Pricing engine ready.\n');

    // Process each order (with delay between live saves to avoid rate limiting)
    const results = [];
    for (let i = 0; i < orderTexts.length; i++) {
        // Rate limit delay: 5s between orders in live mode to avoid 429
        if (doSave && i > 0) await new Promise(r => setTimeout(r, 5000));

        const orderNum = i + 1;
        process.stdout.write(`  Processing order ${orderNum}/${orderTexts.length}...`);

        // Suppress logs during order processing
        console.log = suppress;
        console.warn = suppressWarn;
        console.error = (...a) => {
            if (typeof a[0] === 'string' && a[0].includes('[EmbroideryPricingCalculator]')) return;
            origError.apply(console, a);
        };

        const result = await processOrder(orderTexts[i], orderNum, calc, doSave, noCleanup);
        results.push(result);

        console.log = origLog;
        console.warn = origWarn;
        console.error = origError;

        // Print per-order summary
        const icon = result.error ? 'x' : (doSave ? 'v' : '-');
        console.log(` ${icon} #${result.orderId || '?'} (${result.company})`);

        if (result.error) {
            console.log(`    ERROR: ${result.error}`);
        } else {
            const parts = [`${result.productCount} product(s)`];
            if (result.services.length > 0) parts.push(result.services.join(', '));
            if (result.nonSanMarProducts.length > 0) parts.push(`${result.nonSanMarProducts.length} non-SanMar`);
            console.log(`    ${parts.join(' | ')}`);

            if (doSave && result.quoteId) {
                // Live mode: show save/verify/cleanup status
                const saveTag = `SAVED (${result.savedItems} items)`;
                const verifyTag = result.verified === true ? 'VERIFIED' : result.verified === false ? 'VERIFY FAILED' : '';
                const cleanTag = result.cleanedUp > 0 ? 'CLEANED' : (noCleanup ? 'KEPT' : '');
                console.log(`    ${currency(result.ourTotal)} | ${saveTag} | ${verifyTag} | ${cleanTag}`);
                if (noCleanup && result.quoteUrl) {
                    console.log(`    URL: ${result.quoteUrl}`);
                }
            } else {
                console.log(`    Our price: ${currency(result.ourTotal)}  (ShopWorks: ${currency(result.swTotal)})`);
            }
        }
    }

    // ── BATCH SUMMARY ───────────────────────────────────────────────────
    console.log('\n' + '═'.repeat(70));
    console.log('  BATCH SUMMARY');
    console.log('═'.repeat(70));

    const successful = results.filter(r => !r.error);
    const failed = results.filter(r => r.error);
    const saved = results.filter(r => r.quoteId);
    const verified = results.filter(r => r.verified === true);
    const verifyFailed = results.filter(r => r.verified === false);
    const cleanedUp = results.filter(r => r.cleanedUp > 0);
    const allNonSanMar = [];

    for (const r of results) {
        for (const ns of r.nonSanMarProducts) {
            allNonSanMar.push({ ...ns, orderId: r.orderId, orderIndex: r.orderIndex });
        }
    }

    console.log(`\n  ${orderTexts.length} orders processed. ${successful.length} OK. ${failed.length} failed.`);
    if (doSave) {
        console.log(`  ${saved.length} saved to Caspio. ${verified.length} verified. ${verifyFailed.length} verify failures.`);
        if (!noCleanup) {
            console.log(`  ${cleanedUp.length} cleaned up.`);
        } else {
            console.log(`  Cleanup skipped (--no-cleanup).`);
        }
    }

    // Summary table
    console.log('');
    const tableHeaders = ['#', 'Order ID', 'Company', 'Products', 'Our Total', 'SW Total', 'Status'];
    if (doSave) tableHeaders.push('Verify', 'Cleanup');
    printTable(
        tableHeaders,
        results.map(r => {
            const row = [
                r.orderIndex,
                r.orderId || '?',
                (r.company || '').substring(0, 25),
                r.productCount,
                currency(r.ourTotal),
                currency(r.swTotal),
                r.error ? 'FAIL' : 'OK'
            ];
            if (doSave) {
                row.push(r.verified === true ? 'PASS' : r.verified === false ? 'FAIL' : '—');
                row.push(r.cleanedUp > 0 ? 'YES' : (noCleanup ? 'KEPT' : '—'));
            }
            return row;
        })
    );

    // Non-SanMar report
    if (allNonSanMar.length > 0) {
        console.log(`\n  Non-SanMar products found (${allNonSanMar.length}):`);
        printTable(
            ['Style', 'Order', 'Description', 'SW Price'],
            allNonSanMar.map(ns => [
                ns.style,
                `#${ns.orderId || ns.orderIndex}`,
                (ns.description || '').substring(0, 40),
                currency(ns.swPrice)
            ])
        );
    } else {
        console.log('\n  All products are SanMar.');
    }

    // ── PRICING AUDIT ────────────────────────────────────────────────────
    const auditable = results.filter(r => !r.error && r.priceAudit);
    if (auditable.length > 0) {
        console.log('\n  PRICING AUDIT');
        console.log('  ' + '═'.repeat(66));
        printTable(
            ['#', 'Order ID', 'SW Subtotal', 'Our Subtotal', 'Delta', 'Flag'],
            auditable.map(r => {
                const a = r.priceAudit;
                const sign = a.deltaSubtotal >= 0 ? '+' : '';
                return [
                    r.orderIndex,
                    r.orderId || '?',
                    currency(a.swSubtotal),
                    currency(a.ourSubtotal),
                    `${sign}${currency(a.deltaSubtotal)} (${a.deltaPct}%)`,
                    a.flag
                ];
            })
        );

        // Per-product breakdown for REVIEW/MISMATCH orders
        const flagged = auditable.filter(r => r.priceAudit.flag !== 'OK');
        for (const r of flagged) {
            const a = r.priceAudit;
            if (a.products.length > 0) {
                console.log(`\n  #${r.orderId} — Per-product breakdown:`);
                printTable(
                    ['Style', 'Color', 'Qty', 'SW/pc', '2026/pc', 'Delta/pc', 'Flag'],
                    a.products.map(p => {
                        const sign = p.delta >= 0 ? '+' : '';
                        return [
                            p.style,
                            (p.color || '').substring(0, 15),
                            p.qty,
                            currency(p.swUnit),
                            currency(p.ourUnit),
                            `${sign}${currency(p.delta)}`,
                            p.flag
                        ];
                    })
                );
            }
        }

        const okCount = auditable.filter(r => r.priceAudit.flag === 'OK').length;
        const reviewCount = auditable.filter(r => r.priceAudit.flag === 'REVIEW').length;
        const mismatchCount = auditable.filter(r => r.priceAudit.flag === 'MISMATCH').length;
        console.log(`\n  Audit: ${okCount} OK, ${reviewCount} REVIEW, ${mismatchCount} MISMATCH`);
    }

    // Warnings
    const ordersWithWarnings = results.filter(r => r.warnings.length > 0);
    if (ordersWithWarnings.length > 0) {
        console.log(`\n  Orders with warnings:`);
        for (const r of ordersWithWarnings) {
            console.log(`    #${r.orderId || r.orderIndex}: ${r.warnings.length} warning(s)`);
            for (const w of r.warnings.slice(0, 3)) {
                console.log(`      - ${typeof w === 'string' ? w : JSON.stringify(w)}`);
            }
            if (r.warnings.length > 3) console.log(`      ... and ${r.warnings.length - 3} more`);
        }
    }

    // Verification details (if any failures)
    if (verifyFailed.length > 0) {
        console.log('\n  Verification failures:');
        for (const r of verifyFailed) {
            console.log(`    #${r.orderId || r.orderIndex} (${r.quoteId}):`);
            for (const c of r.verifyChecks.filter(c => !c.ok)) {
                console.log(`      FAIL: ${c.name}${c.detail ? ` — ${c.detail}` : ''}`);
            }
        }
    }

    // Verification summary (if live mode)
    if (doSave && verified.length > 0) {
        // Aggregate check results across all verified orders
        const checkNames = [
            'QuoteID match', 'Status=Open', 'Items saved', 'Product count', 'Total math',
            'Customer data', 'Item QuoteIDs', 'Item types valid',
            // Round-trip session field checks
            'TotalQuantity RT', 'CustomerName RT', 'CompanyName RT',
            'TaxRate RT', 'TaxAmount RT', 'OrderNumber RT', 'ShipToState RT', 'DigitizingCodes RT',
            'SWTotal RT', 'SWSubtotal RT',
            // Line item detail checks
            'Fee PNs valid', 'Product prices', 'Size breakdowns'
        ];
        console.log('\n  Verification checks:');
        for (const name of checkNames) {
            const passed = results.filter(r => r.verifyChecks.find(c => c.name === name && c.ok)).length;
            const total = results.filter(r => r.verifyChecks.find(c => c.name === name)).length;
            if (total > 0) {
                const icon = passed === total ? 'v' : 'x';
                console.log(`    ${icon} ${name}: ${passed}/${total}`);
            }
        }
    }

    // Quote URLs (if saved and kept)
    if (saved.length > 0 && noCleanup) {
        console.log('\n  Quote URLs (kept for inspection):');
        for (const r of saved) {
            console.log(`    ${r.quoteUrl}`);
        }
    }

    console.log('\n' + '═'.repeat(70) + '\n');
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
