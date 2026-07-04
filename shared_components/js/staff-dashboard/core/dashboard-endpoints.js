/* =====================================================
   STAFF DASHBOARD v3 — API ENDPOINT REGISTRY
   Single source of truth for every URL the dashboard hits.
   Reads BASE from window.APP_CONFIG.API.BASE_URL — never
   hardcoded (Rule #7).
   ===================================================== */

const BASE = (typeof window !== 'undefined') ? window.APP_CONFIG?.API?.BASE_URL : null;

if (!BASE) {
    throw new Error(
        '[dashboard] APP_CONFIG.API.BASE_URL is required. ' +
        'Make sure /shared_components/js/app-config.js loads before any dashboard module.'
    );
}

/* =====================================================
   Endpoint factories — call as functions so future
   query-string params don't require touching call sites.
   ===================================================== */
export const endpoints = {
    // ManageOrders (ShopWorks) — routed through the main app's SAML-authed
    // /api/mo/* forwarder (same-origin, sends the session cookie) instead of the
    // proxy directly, so the proxy's PII gate can be tightened to secret-only.
    manageOrders:          () => `/api/mo/orders`,
    lineItems:        (id) => `/api/mo/lineitems/${encodeURIComponent(id)}`,

    // Garment tracker (Caspio cache)
    garmentTracker:        () => `${BASE}/garment-tracker`,
    garmentTrackerCfg:     () => `${BASE}/garment-tracker/config`,
    garmentTrackerArchive: () => `${BASE}/garment-tracker/archive-from-live`,

    // Caspio archived per-rep daily sales
    dailySalesByRep:       () => `${BASE}/caspio/daily-sales-by-rep`,
    dailySalesByRepYTD: (year) => `${BASE}/caspio/daily-sales-by-rep/ytd?year=${encodeURIComponent(year)}`,

    // CRM session + gap reports (proxy on same Express app, not Caspio proxy)
    crmSession:            () => `/api/crm-session`,
    crmGapReport: (rep, dir) => `/api/crm-proxy/${encodeURIComponent(rep)}-accounts/${dir === 'inbound' ? 'reverse-' : ''}gap-report`,
};

export const apiBaseUrl = BASE;
