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
 * Surface a fallback substitution (2026-08-17). Split out so BOTH fallback
 * paths warn — the missing-row case and the unparseable-SellPrice case.
 *
 * `warnIfServiceCodeMissing` (quote-builder-utils.js) owns the missing-row
 * case: it is once-per-page-per-code and deliberately silent until the fetch
 * resolves, so an early call during load doesn't warn about a map that simply
 * hasn't arrived yet. It returns false when the row EXISTS, so it cannot cover
 * a present-but-junk SellPrice — that path goes straight to the badge.
 * @param {string} code
 * @param {number} fallback
 * @param {boolean} rowExists true when the row was found but its price was unusable
 */
function warnFallbackUsed(code, fallback, rowExists) {
    if (typeof window === 'undefined') return;
    if (!rowExists && typeof window.warnIfServiceCodeMissing === 'function') {
        window.warnIfServiceCodeMissing(code, fallback);
        return;
    }
    if (rowExists) {
        console.warn(`[ServiceCodes] ${code} returned an unparseable SellPrice — using fallback ${fallback}`);
        showFallbackPricingWarning(String(code));
    }
}

/**
 * Live Service_Codes price with documented fallback.
 *
 * 🔴 The fallback is now VISIBLE (2026-08-17). It used to return silently when
 * the map had loaded but this row was missing — so a service code renamed or
 * deleted in Caspio substituted a hardcoded literal into a CHARGED, SAVED and
 * PUSHED total with nothing on screen. That is the exact shape of Erik's #1
 * rule ("wrong pricing is worse than an error"). `warnIfServiceCodeMissing`
 * already existed for this and was wired at only ~4 of the ~20 call sites;
 * warning HERE covers every caller by construction, including future ones.
 *
 * In a healthy system this is silent: it fires only when Caspio is genuinely
 * missing the row, which is a real misconfiguration, not per-render noise.
 * @param {string} code Service code (case-insensitive)
 * @param {number} fallback Used only when the API was unreachable or the code is missing
 * @returns {number}
 */
export function getServicePrice(code, fallback) {
    const sc = window._serviceCodes && window._serviceCodes[String(code).toUpperCase()];
    if (!sc) {
        warnFallbackUsed(code, fallback, false);
        return fallback;
    }
    const sell = parseFloat(sc.SellPrice);
    if (isNaN(sell)) {
        warnFallbackUsed(code, fallback, true);
        return fallback;
    }
    return sell;
}
