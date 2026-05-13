/* =====================================================
   STAFF DASHBOARD v3 — CONFIG BOOTSTRAP
   Sets window.APP_CONFIG.API.BASE_URL for dashboard-endpoints.js.
   Loaded BEFORE the ES module entry so the module can read it
   at import time.

   This is the only place the proxy URL is referenced — Rule #7.
   ===================================================== */
(function () {
    'use strict';
    window.APP_CONFIG = window.APP_CONFIG || {};
    window.APP_CONFIG.API = window.APP_CONFIG.API || {
        BASE_URL: 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api',
    };
})();
