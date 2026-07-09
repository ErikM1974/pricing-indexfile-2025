/**
 * DTG inline form — tax-shipping module (Batch 5, 2026-07-09). Moved VERBATIM from the
 * dtg-inline-form.js IIFE; lexical references became the imports below.
 */
// @ts-nocheck — MOVED legacy DOM code (pre-existing checkJs frictions).
/* global */
import { renderSummary } from './pricing.js';
import { API_BASE, state } from './state.js';
import { isPickupMethod } from './utils.js';

// [2026-06-09] Phase 2 — the billed shipping charge that enters the tax base + total.
// SINGLE source of the pickup rule: a Customer-Pickup order never carries a shipping
// charge (the customer collects at Milton), so ALL FOUR total/tax sites (renderSummary,
// computePriceQuoteFromState, dtgPrintQuote, submitToShopWorks) + the save read THIS,
// never state.shipping.fee directly. Mirrors recomputeTaxRate being the single tax
// authority — wire one rule once so the four consumers can't desync on the taxed base.
export function effectiveShipFee() {
    if (isPickupMethod(state.shipping.method)) return 0;
    const f = Number(state.shipping.fee);
    return Number.isFinite(f) && f > 0 ? Math.round(f * 100) / 100 : 0;
}

// [2026-06-09] Phase 2 — pull the #dtgShipFee input into state. The shared estimator
// (quote-order-summary.estimateShipping) writes #dtgShipFee.value DIRECTLY, so its
// onApplied hook + the manual input handler both call this to sync state before the
// tax base re-renders.
export function syncShipFeeFromDom() {
    const el = document.getElementById('dtgShipFee');
    if (!el) return;
    const v = parseFloat(el.value);
    state.shipping.fee = (Number.isFinite(v) && v > 0) ? v : 0;
}

// Sync the pickup toggle UI to whatever state.shipping.method currently is.
// Called from the ship-method dropdown handler so dropdown-picked
// "Customer Pickup" also flips the toggle.
export function syncPickupToggleFromShipMethod() {
    const tgl = document.getElementById('dtgPickupToggle');
    const block = document.getElementById('dtgShipToBlock');
    const isPickup = isPickupMethod(state.shipping.method);
    if (tgl) tgl.checked = isPickup;
    if (block) block.hidden = isPickup;
}

// Re-derive state.shipping.taxRate per WA's destination-based sourcing law
// (WAC 458-20-145 + 458-20-193). Three rules:
//   - pickup            → 10.2% (Milton flat — WAC 458-20-145, seller's location)
//   - out of WA state   → 0%    (WAC 458-20-193 — no nexus on out-of-state sales)
//   - in WA state       → /api/tax-rates/lookup destination city rate
//                          (backend hits webgis.dor.wa.gov AddressRates API)
// Writes status text into #dtgTaxStatus + updates state.shipping.taxRate.
// Caller is responsible for renderSummary() afterwards.
//
// Note: shipping CHARGES are taxable in WA (WAC 458-20-110). As of Phase 2 (2026-06-09)
// DTG BILLS shipping (state.shipping.fee via effectiveShipFee()), so the tax base is now
// (subtotal + shipping) × rate at all 4 sites (renderSummary / submit / PDF / save) and
// the push sends cur_Shipping = fee. recomputeTaxRate only owns the RATE — the fee doesn't
// change it, so the fee handler re-renders without calling this (avoids a redundant DOR hit).
export async function recomputeTaxRate() {
    const status = document.getElementById('dtgTaxStatus');
    const setStatus = (text, cls) => {
        if (!status) return;
        status.textContent = text;
        status.className = 'dcp-tax-status' + (cls ? ' dcp-tax-status--' + cls : '');
    };

    // [2026-06-08] Tax-exempt customer (CRM Is_Tax_Exempt) → force 0% + skip the pickup/DOR lookup (parity with
    // EMB/DTF/SCP). DTG previously showed an "exempt" chip but STILL taxed them on screen + PDF + the saved total.
    // [2026-06-08] Phase 1: wholesale/reseller → 0% + GL 2203 (highest priority; backend resolveTaxAccount routes it).
    if (state.customer && state.customer.isWholesale) {
        state.shipping.taxRate = 0;
        state.shipping.taxRateSource = 'wholesale';
        state.shipping.taxAccount = '2203';
        state.shipping.taxAccountName = 'Wholesale Sales (WA reseller permit)';
        setStatus('Wholesale / reseller — no tax (GL 2203)', 'success');
        renderSummary();
        return;
    }
    if (state.customer && state.customer.isTaxExempt) {
        state.shipping.taxRate = 0;
        state.shipping.taxRateSource = 'tax-exempt';
        state.shipping.taxAccount = '2204';
        state.shipping.taxAccountName = 'Tax Exempt';
        setStatus('Tax-exempt customer — no sales tax', 'success');
        renderSummary();
        return;
    }
    // [2026-06-08] Phase 1: rep opted the quote out of tax (include-tax unchecked) → 0%.
    if (!state.shipping.includeTax) {
        state.shipping.taxRate = 0;
        state.shipping.taxRateSource = 'tax-opt-out';
        state.shipping.taxAccount = '';
        state.shipping.taxAccountName = 'No tax (opted out)';
        setStatus('Tax not included (rep opted out)', 'info');
        renderSummary();
        return;
    }
    // [2026-06-08] Phase 1: rep typed a manual rate override → use it, skip the DOR lookup.
    if (state.shipping.taxRateOverride != null && Number.isFinite(Number(state.shipping.taxRateOverride))) {
        state.shipping.taxRate = Number(state.shipping.taxRateOverride) / 100;
        state.shipping.taxRateSource = 'manual';
        state.shipping.taxAccount = '';
        state.shipping.taxAccountName = 'Manual rate';
        setStatus('Manual rate ' + Number(state.shipping.taxRateOverride).toFixed(2) + '%', 'info');
        renderSummary();
        return;
    }
    const isPickup = isPickupMethod(state.shipping.method);
    if (isPickup) {
        state.shipping.taxRate = 0.102;
        state.shipping.taxRateSource = 'pickup-flat';
        // Milton pickup → ShopWorks account 2200.102 (Wash:10.2%), created by Erik 2026-07-09. Hardcoded
        // since pickup destination doesn't change.
        state.shipping.taxAccount = '2200.102';
        state.shipping.taxAccountName = 'Wash:10.2%';
        setStatus('Pickup at Milton, WA — 10.2% flat', 'success');
        renderSummary();
        return;
    }
    const shState = (state.shipping.state || '').toUpperCase();
    if (shState && shState !== 'WA') {
        state.shipping.taxRate = 0;
        state.shipping.taxRateSource = 'out-of-state';
        // Out-of-state → Caspio account 2202 (Out of State Sales, 0%).
        state.shipping.taxAccount = '2202';
        state.shipping.taxAccountName = 'Out of State Sales';
        setStatus('Out of state — no tax', 'info');
        renderSummary();
        return;
    }
    if (!shState || !state.shipping.city || !state.shipping.zip || state.shipping.zip.length < 5) {
        // Not enough info yet; keep last known rate but show prompt.
        setStatus('Enter ship-to city + WA + ZIP to look up tax rate', 'info');
        return;
    }
    // In-WA shipping → DOR lookup.
    try {
        setStatus('Looking up destination tax rate…', 'loading');
        const r = await fetch(`${API_BASE}/api/tax-rates/lookup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                address: state.shipping.address1 || '',
                city: state.shipping.city,
                state: shState,
                zip: state.shipping.zip,
            }),
        });
        const j = await r.json();
        if (!r.ok || !j.success) {
            setStatus(j.error || `Lookup failed (HTTP ${r.status})`, 'error');
            return;
        }
        // API returns taxRate as a percentage (e.g. 10.25). Convert to float.
        const ratePct = Number(j.taxRate);
        if (!Number.isFinite(ratePct)) {
            setStatus('Lookup returned no rate', 'error');
            return;
        }
        state.shipping.taxRate = ratePct / 100;
        state.shipping.taxRateSource = j.fallback ? 'dor-fallback' : 'dor-lookup';
        // The lookup endpoint matched the DOR rate to a Caspio
        // sales_tax_accounts_2026 row — capture both for the
        // ShopWorks Notes block.
        state.shipping.taxAccount = j.account || '2200';
        state.shipping.taxAccountName = j.accountName || 'WA Sales Tax';
        const loc = state.shipping.city || j.locationCode || 'WA';
        setStatus(
            j.fallback
                ? `Default rate ${ratePct.toFixed(2)}% (DOR unavailable)`
                : `${loc} — ${ratePct.toFixed(2)}%`,
            j.fallback ? 'warning' : 'success'
        );
        renderSummary();
    } catch (err) {
        setStatus('Lookup failed — keeping last known rate', 'error');
    }
}
