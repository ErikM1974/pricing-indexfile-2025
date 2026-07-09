/**
 * Service_Codes pricing — THE ONE implementation (Batch 3.5, 2026-07-09).
 *
 * Erik's rule (2026-06-03): every service fee comes from the Caspio
 * Service_Codes table via GET /api/service-codes; a hardcoded number is only a
 * fallback and must surface a VISIBLE warning (toast + persistent 1.15 badge).
 *
 * History: this logic existed twice — builders/emb/pricing.js (the EMB module)
 * and typeof-guarded copies in quote-builder-utils.js for the other pages.
 * Now: this module is bundled + window-bridged by ALL FOUR builder entry
 * points; emb/pricing.js re-exports it; the utils copies are gone.
 *
 * window._serviceCodes stays the cache location — a cross-file CONTRACT
 * (quote-services-bar.js + the EMB rush-fee sync read it directly, and
 * warnIfServiceCodeMissing in quote-builder-utils.js checks it).
 */

import { showFallbackPricingWarning } from './errors.js';

/**
 * Fetch all Service_Codes rows and cache them for getServicePrice().
 * @returns {Promise<Record<string, any>|null>} code→row map, or null on failure
 */
export async function loadServiceCodePrices() {
    try {
        const resp = await fetch(`${window.APP_CONFIG.API.BASE_URL}/api/service-codes`);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const json = await resp.json();
        const map = {};
        (json.data || []).forEach(sc => { if (sc.ServiceCode) map[String(sc.ServiceCode).toUpperCase()] = sc; });
        // eslint-disable-next-line no-restricted-syntax -- legacy cross-file cache contract (services bar + EMB rush sync + warnIfServiceCodeMissing read window._serviceCodes); migrates to module state when the last reader does
        window._serviceCodes = map;
        return map;
    } catch (e) {
        console.error('[ServiceCodes] Could not load live prices from /api/service-codes:', e);
        if (typeof window.showToast === 'function') window.showToast("Couldn't reach the pricing service — using default service prices", 'warning', 5000);
        showFallbackPricingWarning('service prices'); // persistent badge (1.15) — outlives the 5s toast
        return null;
    }
}

/**
 * Live Service_Codes price with documented fallback.
 * @param {string} code Service code (case-insensitive)
 * @param {number} fallback Used only when the API was unreachable or the code is missing
 * @returns {number}
 */
export function getServicePrice(code, fallback) {
    const sc = window._serviceCodes && window._serviceCodes[String(code).toUpperCase()];
    if (!sc) return fallback;
    const sell = parseFloat(sc.SellPrice);
    return isNaN(sell) ? fallback : sell;
}
