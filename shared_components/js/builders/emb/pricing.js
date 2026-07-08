/**
 * EMB pricing module — roadmap 0.4 extraction (cluster #0: Service_Codes fees).
 *
 * Destination architecture: this module becomes the ONLY place the EMB
 * builder talks to the pricing APIs (/api/service-codes now; /api/pricing-bundle
 * wrappers migrate here as the decomposition proceeds).
 *
 * Extracted verbatim from embroidery-quote-builder.js (was lines 8-36).
 * Semantics preserved exactly:
 *   - Service-fee prices = Caspio Service_Codes via GET /api/service-codes,
 *     fetched once at startup (DOMContentLoaded init), cached on
 *     window._serviceCodes — that window location is a cross-file CONTRACT
 *     (the monolith's rush-fee sync reads it directly) — do not move it
 *     until every reader migrates.
 *   - getServicePrice(code, fallback) returns the live SellPrice, or the
 *     documented fallback WITH a visible warning toast if the API was
 *     unreachable — never a silent wrong price (Erik's #1 rule, 2026-06-03).
 */

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
        // eslint-disable-next-line no-restricted-syntax -- legacy cross-file cache contract (monolith rush sync + services bar read window._serviceCodes); migrates to module state when the last reader does
        window._serviceCodes = map;
        return map;
    } catch (e) {
        console.error('[ServiceCodes] Could not load live prices from /api/service-codes:', e);
        if (typeof window.showToast === 'function') window.showToast("Couldn't reach the pricing service — using default service prices", 'warning', 5000);
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
