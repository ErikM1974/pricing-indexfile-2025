/**
 * DTG inline form — pricing module (Batch 5, 2026-07-09). Moved VERBATIM from the
 * dtg-inline-form.js IIFE; lexical references became the imports below.
 */
// @ts-nocheck — MOVED legacy DOM code (pre-existing checkJs frictions).
/* global */
import { effectiveLocationCode, effectiveLocationLabel, isRowColorInvalid, renderBand, renderTable, syncDueDateFromQty, updateSubmitEnabled } from './form-core.js';
import { _bundleCache, dtgIF, state } from './state.js';
import { effectiveShipFee } from './tax-shipping.js';
import { escapeHtml, fmtMoney, isPickupMethod, shipLabel } from './utils.js';

export function combinedQty() {
    // Exclude invalid-color rows from the tier / piece count. They're
    // not real orders until the rep picks a valid catalog color.
    return state.rows.reduce((sum, r) => {
        if (isRowColorInvalid(r)) return sum;
        return sum + Object.values(r.sizes || {}).reduce((s, v) => s + (Number(v) || 0), 0);
    }, 0);
}

export async function fetchBundle(style) {
    const sn = String(style || '').trim().toUpperCase();
    if (!sn) return null;
    if (_bundleCache.has(sn)) return _bundleCache.get(sn);
    if (!window.DTGPricingService) {
        console.warn('[dtg-inline-form] window.DTGPricingService unavailable — preview disabled');
        return null;
    }
    try {
        const svc = new window.DTGPricingService();
        const b = await svc.fetchPricingData(sn);
        if (b) _bundleCache.set(sn, b);
        return b;
    } catch (err) {
        console.error('[dtg-inline-form] bundle fetch failed:', err);
        // Return an ERROR SENTINEL (not null) so updateLivePrices surfaces a VISIBLE
        // failure instead of silently pricing the row at $0 — a too-low total a rep
        // could quote. Erik's #1 rule: an API failure must be shown, never a silent
        // fallback to zero. (Not cached → retried on the next recompute.) (2026-06-01)
        return { __pricingError: true, style: sn, message: (err && err.message) || 'pricing unavailable' };
    }
}

export function renderSummary() {
    const el = document.getElementById('dtgPriceSummary');
    if (!el) return;
    const cq = combinedQty();
    // Recompute due date based on current qty (auto-mode only).
    syncDueDateFromQty();
    if (cq === 0) {
        el.innerHTML = `<div class="dps-empty">Add at least one row with sizes to see live pricing.</div>`;
        updateSubmitEnabled();
        return;
    }
    // Resolve tier from the FIRST row's cached bundle so we get the
    // Caspio Pricing_Tiers row (incl. real LTM_Fee). Falls back to the
    // standard label buckets if no bundle is cached yet.
    const firstRowWithBundle = state.rows.find((r) => r.style && _bundleCache.has(r.style.toUpperCase()));
    const tierRow = firstRowWithBundle
        ? findTierRowInBundle(_bundleCache.get(firstRowWithBundle.style.toUpperCase()), cq)
        : null;
    const tier = tierRow ? tierRow.TierLabel : tierLabelFromQty(cq);
    const ltmFee = Number(tierRow && tierRow.LTM_Fee) || 0;
    const isLtm = ltmFee > 0;
    const ltmPP = isLtm ? window.DTGCanonicalPricing.ltmPerUnit({ LTM_Fee: ltmFee }, cq) : 0;  // canonical floor-to-cents (Batch 6)
    const subtotal = state.rows.reduce((s, r) => s + (Number(r._lineTotal) || 0), 0);
    const tierDisplay = isLtm ? `${tier} (LTM)` : tier;

    // Tax estimate per Erik's 3 rules (2026-05-20). The taxRate on
    // state.shipping is the authoritative source — populated by
    // recomputeTaxRate() any time the rep toggles pickup OR types a
    // ship-to address. Pickup = 0.102, out-of-state = 0, in-WA = DOR
    // destination city rate.
    const isPickup = isPickupMethod(state.shipping.method);
    const shState = (state.shipping.state || '').toUpperCase();
    // [2026-06-09] Phase 2 — billed shipping is TAXABLE in WA (WAC 458-20-110), so the
    // fee enters the tax BASE here, NOT added after tax. effectiveShipFee() is 0 for
    // pickup. Same base formula at submit / PDF / save so the 4 sites can't desync.
    const shipFee = effectiveShipFee();
    const taxRate = Number(state.shipping.taxRate);
    const taxBase = Math.round((subtotal + shipFee) * 100) / 100;
    const taxEstimate = Math.round(taxBase * (Number.isFinite(taxRate) ? taxRate : 0) * 100) / 100;
    const grandTotal = Math.round((taxBase + taxEstimate) * 100) / 100;
    const taxPct = (taxRate * 100).toFixed(taxRate * 100 < 10 ? 1 : 2);
    // [2026-06-08] Phase 1 — label the new 0% sources (wholesale/exempt/opt-out/manual)
    // set by recomputeTaxRate. The DOLLAR amount is already correct (taxRate is 0 for
    // these); this only makes the row TEXT honest instead of "out of state — 0%".
    const src = state.shipping.taxRateSource;
    const taxLabel =
        src === 'wholesale'   ? 'Tax (wholesale / reseller — 0%)' :
        src === 'tax-exempt'  ? 'Tax (tax-exempt customer — 0%)' :
        src === 'tax-opt-out' ? 'Tax (not included)' :
        src === 'manual'      ? `Tax (manual rate ${taxPct}%)` :
        isPickup
        ? `Tax (pickup, Milton WA ${taxPct}%)`
        : (!shState || shState === 'WA')
            ? (src === 'dor-lookup' || src === 'dor-fallback'
                ? `Tax (${escapeHtml(state.shipping.city || 'WA destination')} ${taxPct}%)`
                : `Tax (WA destination — enter city + ZIP)`)
            : `Tax (out of state — 0%)`;

    // eslint-disable-next-line no-unsanitized/property -- audited (Batch 5 move): every interpolation is escapeHtml()d, numeric, or static config
    el.innerHTML = `
        <div class="dps-label">Live DTG quote · ${effectiveLocationLabel()} · ${escapeHtml(shipLabel(state.shipping.method))}</div>
        <div class="dps-grid">
            <div><span class="dps-tier-pill${isLtm ? ' ltm' : ''}">${escapeHtml(tierDisplay)}</span></div>
            <div>${cq} combined pieces${isLtm ? ` · LTM +$${ltmPP.toFixed(2)}/pc` : ''}</div>
            <div class="dps-total">$${fmtMoney(grandTotal)}</div>
        </div>
        <div class="dps-totals-rows">
            <div class="dps-totals-row"><span>Subtotal</span><span class="dps-mono">$${fmtMoney(subtotal)}</span></div>
            ${shipFee > 0 ? `<div class="dps-totals-row dps-ship-row"><span>Shipping</span><span class="dps-mono">$${fmtMoney(shipFee)}</span></div>` : ''}
            <div class="dps-totals-row dps-tax-row"><span>${taxLabel}</span><span class="dps-mono">$${fmtMoney(taxEstimate)}</span></div>
            <div class="dps-totals-row dps-grand-row"><span>Order total</span><span class="dps-mono">$${fmtMoney(grandTotal)}</span></div>
        </div>
        ${isLtm ? `<div class="dps-note">Bump combined qty above this tier and the $${ltmFee} LTM fee disappears.</div>` : ''}
    `;
    updateSubmitEnabled();
    renderBand();  // [2026-06-08] Phase 0: keep the order-summary band current on every priced render
}

// Display-only tier-label buckets — used when no bundle has been cached
// yet (initial render before the first style search resolves). Matches
// the Caspio Pricing_Tiers row labels (1-23, 24-47, 48-71, 72+).
export function tierLabelFromQty(qty) {
    if (qty < 24) return '1-23';
    if (qty <= 47) return '24-47';
    if (qty <= 71) return '48-71';
    return '72+';
}

// Find the tier ROW in a bundle's Caspio-driven tiers list.
export function findTierRowInBundle(bundle, qty) {
    const tiers = (bundle && bundle.tiers) || [];
    if (!tiers.length || qty <= 0) return null;
    return tiers.find((t) =>
        qty >= Number(t.MinQuantity) && qty <= Number(t.MaxQuantity)
    ) || null;
}

// Return the next tier above the current one in MinQuantity order, or
// null if currentTier is already the top tier or tiers list is missing.
export function findNextTier(tiers, currentTier, _currentQty) {
    if (!Array.isArray(tiers) || !currentTier) return null;
    const sorted = tiers.slice().sort((a, b) => Number(a.MinQuantity) - Number(b.MinQuantity));
    const idx = sorted.findIndex((t) => t.TierLabel === currentTier.TierLabel);
    if (idx < 0 || idx === sorted.length - 1) return null;
    const next = sorted[idx + 1];
    return {
        TierLabel: next.TierLabel,
        MinQty: Number(next.MinQuantity),
        MaxQty: Number(next.MaxQuantity),
        LTM_Fee: Number(next.LTM_Fee) || 0,
    };
}

export function schedulePriceUpdate() {
    clearTimeout(dtgIF._priceTimer);
    dtgIF._priceTimer = setTimeout(() => updateLivePrices().catch((e) => console.error('[dtg-inline-form] price update failed:', e)), 200);
}

export async function updateLivePrices() {
    const code = effectiveLocationCode();
    const cq = combinedQty();
    if (!code || cq === 0 || !window.DTGPricingService) {
        for (const r of state.rows) { r._perPiece = null; r._lineTotal = 0; r._priceError = null; r._priceBySize = {}; r._ltmPP = 0; r._baseUnit = null; r._tierLabel = null; }
        dtgIF._lastTier = null; dtgIF._allTiers = null; dtgIF._lastPerPiece = null;
        renderPriceErrorBanner(null);
        renderTable();
        renderSummary();
        return;
    }
    const svc = new window.DTGPricingService();
    dtgIF._lastPerPiece = null; // reset; first priced row sets it
    let _anyPriceError = false;
    const _erroredStyles = new Set();

    for (const row of state.rows) {
        // [2026-06-08] Phase 1 Chunk C fix — clear ALL derived price fields up front so a
        // row that fails to price (invalid color / API error / no tier) cannot leak STALE
        // _priceBySize/_ltmPP/_baseUnit/_tierLabel into the PDF (dtgPrintQuote re-derives the
        // invoice subtotal from _priceBySize) or the saved quote_items. The success path
        // below repopulates them for priced rows.
        row._priceBySize = {}; row._ltmPP = 0; row._baseUnit = null; row._tierLabel = null;
        if (!row.style || !row.color) { row._perPiece = null; row._lineTotal = 0; continue; }
        // Block pricing on rows where the rep typed a color the catalog
        // doesn't have (no catalogColor → no SanMar match → invalid).
        // Without this guard, the live total includes phantom dollars
        // for orders that would fail in ShopWorks.
        if (isRowColorInvalid(row)) { row._perPiece = null; row._lineTotal = 0; continue; }
        try {
            const bundle = await fetchBundle(row.style);
            if (bundle && bundle.__pricingError) {
                // Pricing API failed for this style — surface it; do NOT let the row
                // sit at $0 in the rep-facing total. (2026-06-01)
                row._perPiece = null; row._lineTotal = 0; row._priceError = bundle.message;
                _anyPriceError = true; _erroredStyles.add(row.style);
                continue;
            }
            row._priceError = null;
            if (!bundle) { row._perPiece = null; row._lineTotal = 0; continue; }
            // Resolve the tier ROW from Caspio (incl. LTM_Fee). The
            // row's LTM_Fee column drives per-piece LTM dynamically —
            // no more hardcoded $50.
            const tier = svc.getTierForQuantity(bundle.tiers, cq);
            if (!tier) { row._perPiece = null; row._lineTotal = 0; continue; }
            // Cache for the pre-flight panel's tier-break hint.
            dtgIF._lastTier = tier;
            dtgIF._allTiers = bundle.tiers;
            const ltmFee = Number(tier.LTM_Fee) || 0;
            const ltmPP = window.DTGCanonicalPricing.ltmPerUnit({ LTM_Fee: ltmFee }, cq);  // canonical floor-to-cents (Batch 6)

            const allPrices = svc.calculateAllLocationPrices(bundle, cq);
            if (!allPrices || !allPrices[code]) { row._perPiece = null; row._lineTotal = 0; continue; }
            const locPrices = allPrices[code];

            // Build a per-size price map for the card to render under
            // each cell. Reps see "$30.99" under S and "$33.99" under
            // 2XL at a glance — no mental math for upcharges.
            row._priceBySize = {};
            const sizesToPrice = Array.isArray(row.availableSizes) && row.availableSizes.length
                ? row.availableSizes
                : Object.keys(locPrices);
            for (const sz of sizesToPrice) {
                const priceObj = locPrices[String(sz).toUpperCase()] || locPrices[sz];
                const base = priceObj && priceObj[tier.TierLabel];
                if (typeof base === 'number') {
                    row._priceBySize[String(sz).toUpperCase()] = Math.round((base + ltmPP) * 100) / 100;
                }
            }

            // Sum line total + weighted-average per-piece across typed sizes.
            let lineTotal = 0;
            let count = 0;
            let aggregate = 0;
            for (const [sz, qty] of Object.entries(row.sizes || {})) {
                const q = Number(qty) || 0; if (q <= 0) continue;
                const priceObj = locPrices[String(sz).toUpperCase()] || locPrices[sz];
                const base = priceObj && priceObj[tier.TierLabel];
                if (typeof base !== 'number') continue;
                const final = base + ltmPP;
                lineTotal += final * q;
                aggregate += final * q;
                count += q;
            }
            row._perPiece = count > 0 ? Math.round((aggregate / count) * 100) / 100 : null;
            row._lineTotal = Math.round(lineTotal * 100) / 100;
            // [2026-06-08] Phase 1 Chunk C — stash the breakdown the SAVE path needs
            // (computePriceQuoteFromState → handleSaveQuote item map). _perPiece is the
            // LTM-amortized weighted unit; ltmPP is added uniformly to every size's final,
            // so the weighted base = _perPiece − ltmPP. _tierLabel drives PricingTier.
            row._ltmPP = ltmPP;
            row._baseUnit = row._perPiece != null ? Math.round((row._perPiece - ltmPP) * 100) / 100 : null;
            row._tierLabel = tier.TierLabel;
            if (row._perPiece && dtgIF._lastPerPiece == null) dtgIF._lastPerPiece = row._perPiece;
        } catch (err) {
            console.error('[dtg-inline-form] row price update failed:', row.style, err);
            row._perPiece = null;
            row._lineTotal = 0;
            row._ltmPP = 0;
            row._baseUnit = null;
            row._priceError = (err && err.message) || 'pricing error';
            _anyPriceError = true; _erroredStyles.add(row.style);
        }
    }
    // Surface any pricing failure so the rep never quotes an incomplete total
    // that silently dropped a $0 row. (2026-06-01)
    renderPriceErrorBanner(_anyPriceError ? Array.from(_erroredStyles) : null);
    renderTable();
    renderSummary();
}

// Persistent red banner shown when one or more rows failed to price due to a
// pricing-API error. Pass null/empty to clear it. Erik's #1 rule: a failed
// pricing call must be visible, never silently zeroed into the total.
export function renderPriceErrorBanner(styles) {
    let banner = document.getElementById('dtg-price-error-banner');
    if (!styles || styles.length === 0) { if (banner) banner.remove(); return; }
    if (!banner) {
        banner = document.createElement('div');
        banner.id = 'dtg-price-error-banner';
        banner.setAttribute('role', 'alert');
        banner.style.cssText = 'margin:10px 0;padding:10px 14px;background:#fef2f2;border:1px solid #ef4444;border-left:4px solid #b91c1c;border-radius:6px;color:#991b1b;font-size:13px;font-weight:600;line-height:1.4;';
        const mount = document.getElementById('dtgResumeBannerMount') || document.getElementById('dtgInlineFormMount');
        if (mount) mount.insertBefore(banner, mount.firstChild); else return;
    }
    banner.textContent = `⚠ Live pricing failed for ${styles.join(', ')} — the total below is INCOMPLETE. Refresh and try again before quoting this customer.`;
}

// Lightweight pricing snapshot the invoice generator can consume. Reads
// from in-memory `state` + the existing live preview helper rather than
// running the full async submit flow. Returns null when state is empty.
export function computePriceQuoteFromState() {
    // Build from the AUTHORITATIVE live-price fields updateLivePrices() writes:
    // row._perPiece (LTM-amortized unit), row._lineTotal, row._priceBySize.
    // The old code read window.aiState.lastPriceQuote (never assigned anywhere)
    // and r.previewUnit (never written) → every printed line priced at $0 while
    // the on-screen live table showed correct dollars. (2026-06-01)
    // DTG's print location is shared across all rows (not per-line).
    const locCode = effectiveLocationCode();
    const locLabel = effectiveLocationLabel();
    const lineItems = state.rows
        // [2026-06-08] Phase 1 Chunk C fix — exclude invalid-color rows (mirror combinedQty +
        // updateLivePrices) so the saved record + PDF match the on-screen subtotal, which
        // already drops them. Without this an invalidated row saves a $0 line + inflates qty.
        .filter(r => r.style && r.color && !isRowColorInvalid(r) && Object.keys(r.sizes || {}).length > 0)
        .map(r => {
            const totalQty = Object.values(r.sizes).reduce((s, q) => s + (Number(q) || 0), 0);
            const unitPrice = Number(r._perPiece) || 0;
            const lineTotal = Number(r._lineTotal) || (unitPrice * totalQty);
            // [2026-06-08] Phase 1 Chunk C — emit the FULL item shape handleSaveQuote's item
            // map reads (baseUnitPrice/ltmPerUnit/tier/location). Omitting these saved
            // BaseUnitPrice=0/LTMPerUnit=0/HasLTM=No → LTM silently stripped from the record
            // (the DTF under-pricing bug class). _ltmPP/_baseUnit/_tierLabel come from updateLivePrices.
            const ltmPerUnit = Number(r._ltmPP) || 0;
            const baseUnit = (r._baseUnit != null)
                ? Number(r._baseUnit)
                : Math.round((unitPrice - ltmPerUnit) * 100) / 100;
            return {
                style: r.style,
                color: r.color,
                description: r.description || `${r.style} ${r.color}`,
                sizes: r.sizes,
                priceBySize: r._priceBySize || {},
                totalQuantity: totalQty,
                baseUnitPrice: baseUnit,
                ltmPerUnit: ltmPerUnit,
                finalUnitPrice: unitPrice,
                lineTotal: lineTotal,
                locationCode: locCode,
                locationLabel: locLabel,
                tier: r._tierLabel || (dtgIF._lastTier && (dtgIF._lastTier.TierLabel || dtgIF._lastTier.tierLabel)) || 'Standard',
            };
        });
    const subtotal = Math.round(lineItems.reduce((s, li) => s + (li.lineTotal || 0), 0) * 100) / 100;
    const combinedQuantity = lineItems.reduce((s, li) => s + (li.totalQuantity || 0), 0);
    const totalLtmFee = Math.round(lineItems.reduce((s, li) => s + ((li.ltmPerUnit * li.totalQuantity) || 0), 0) * 100) / 100;
    // [2026-06-08] Phase 1 Chunk C — tax rides from the SINGLE authority
    // (recomputeTaxRate → state.shipping.taxRate, a DECIMAL). It is ALREADY 0 for
    // wholesale / exempt / out-of-state / opt-out, so no re-check is needed here.
    const taxRate = Number(state.shipping.taxRate) || 0;
    // [2026-06-09] Phase 2 — billed shipping (taxable in WA) enters the tax base here too,
    // so the SAVE (handleSaveQuote reads this) + the PDF foot to the same number the screen
    // shows. effectiveShipFee() is 0 for pickup. subtotal stays products-only (→ SubtotalAmount).
    const shippingFee = effectiveShipFee();
    const taxBase = Math.round((subtotal + shippingFee) * 100) / 100;
    const taxAmount = Math.round(taxBase * taxRate * 100) / 100;
    const grandTotal = Math.round((taxBase + taxAmount) * 100) / 100;
    return {
        lineItems,
        combinedQuantity,
        subtotal,
        shippingFee,
        grandTotal,
        totalLtmFee,
        tier: (dtgIF._lastTier && (dtgIF._lastTier.TierLabel || dtgIF._lastTier.tierLabel)) || 'Standard',
        locationCode: locCode,
        locationLabel: locLabel,
        // Tax block consumed by the SAVE path (dtg-quote-page handleSaveQuote).
        // taxRate is a DECIMAL (0.102) — matches EMB; quote-view/invoice normalize >1?/100,
        // so decimal round-trips. DO NOT change to percent or /invoice's verbatim TaxAmount breaks.
        taxRate,
        taxAmount,
        taxAccount: state.shipping.taxAccount || '',
        taxAccountName: state.shipping.taxAccountName || '',
        isWholesale: !!(state.customer && state.customer.isWholesale),
        isTaxExempt: !!(state.customer && state.customer.isTaxExempt),
        taxExemptNumber: (state.customer && state.customer.taxExemptNumber) || '',
        totals: { subtotal, shippingFee, taxRate, taxAmount, grandTotal },
    };
}
