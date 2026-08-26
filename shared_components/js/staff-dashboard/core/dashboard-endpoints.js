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

    // Q3 2026 Embroidery Bonus. Routed through the main app's SAML-authed
    // /api/crm-proxy/* forwarder (same-origin, sends the session cookie) — the proxy
    // endpoints are secret-only because they carry customer names + payroll dollars.
    // 🔒 The SHARED staff dashboard uses ONLY the /team feed — company revenue and targets,
    // never a rep's earnings. Compensation belongs on each rep's own Mission Control page.
    embroideryBonusTeam:    () => `/api/crm-proxy/embroidery-bonus/team`,

    // Caspio archived per-rep daily sales
    dailySalesByRepYTD: (year) => `${BASE}/caspio/daily-sales-by-rep/ytd?year=${encodeURIComponent(year)}`,

    // Unreferenced factories pruned 2026-08-26 (garment-tracker trio pointed at
    // unmounted routes; lineItems/dailySalesByRep/crmSession/crmGapReport/
    // embroideryBonus{,Cfg,Dormant} had zero call sites). NOTE some widgets
    // still build same-origin URLs inline (/api/staff/payments/recent,
    // /api/staff/finished-photos/library, /api/staff/command-search,
    // quote_sessions on the proxy base) — this registry covers the proxy-base
    // and forwarder URLs the services share, not literally every URL.
};

export const apiBaseUrl = BASE;
