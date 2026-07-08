// tenant.js — runtime tenant resolution + hydration (roadmap 0.3)
//
// Loads immediately AFTER config/app.config.js (which seeds window.TENANT
// with the default NWCA tenant and defines the APP_CONFIG delegating shim).
//
// Resolution order:
//   1. `?tenant=<id>` query param (dev/demo override)
//   2. hostname map (subdomain white-labeling lands with Phase 2 hosting;
//      every current production host resolves to the default tenant)
//   3. default tenant already seeded by app.config.js
//
// A non-default tenant is hydrated from GET /api/tenants/:id/config (served
// by server.js from config/tenants/<id>.json today; the Phase 2 admin
// console swaps that backing store without changing this contract). The
// fetched config is DEEP-MERGED into window.TENANT so partial overlays work
// (a tenant file may specify only branding). On success we dispatch
// `tenant:loaded` on document; consumers that render branding re-read
// APP_CONFIG then. On failure we KEEP the default tenant and log loudly —
// a wrong-tenant render must never be silent (Erik's #1 rule applies to
// identity as much as pricing).
//
// window.TENANT.ready — a Promise that resolves with the active tenant id
// once resolution settles (immediately for the default tenant).

(function () {
    'use strict';
    if (typeof window === 'undefined') return; // browser-only

    var VALID_ID = /^[a-z0-9][a-z0-9-]{0,31}$/;

    function resolveTenantId() {
        try {
            var fromQuery = new URLSearchParams(window.location.search).get('tenant');
            if (fromQuery && VALID_ID.test(fromQuery)) return fromQuery;
        } catch (e) { /* URLSearchParams unavailable → fall through */ }

        // Hostname → tenant map. Subdomain-style resolution
        // (acme.quotebuilder.app → acme) activates with Phase 2 hosting.
        return window.TENANT ? window.TENANT.id : 'nwca';
    }

    function deepMerge(target, overlay) {
        for (var key in overlay) {
            if (!Object.prototype.hasOwnProperty.call(overlay, key)) continue;
            var val = overlay[key];
            if (val && typeof val === 'object' && !Array.isArray(val) &&
                target[key] && typeof target[key] === 'object' && !Array.isArray(target[key])) {
                deepMerge(target[key], val);
            } else {
                target[key] = val;
            }
        }
        return target;
    }

    var tenantId = resolveTenantId();

    if (!window.TENANT) {
        // app.config.js must load first; fail loudly rather than invent config.
        console.error('[tenant] window.TENANT missing — load /config/app.config.js before /config/tenant.js');
        return;
    }

    if (tenantId === window.TENANT.id) {
        window.TENANT.ready = Promise.resolve(window.TENANT.id);
        return; // default tenant — nothing to hydrate
    }

    window.TENANT.ready = fetch('/api/tenants/' + encodeURIComponent(tenantId) + '/config', {
        headers: { Accept: 'application/json' }
    })
        .then(function (resp) {
            if (!resp.ok) throw new Error('HTTP ' + resp.status);
            return resp.json();
        })
        .then(function (config) {
            deepMerge(window.TENANT, config);
            window.TENANT.id = tenantId;
            document.dispatchEvent(new CustomEvent('tenant:loaded', { detail: { id: tenantId } }));
            console.log('[tenant] active tenant: ' + tenantId);
            return tenantId;
        })
        .catch(function (err) {
            // Keep the seeded default — but say so, visibly.
            console.error('[tenant] failed to load tenant "' + tenantId + '" (' + err.message +
                ') — continuing as "' + window.TENANT.id + '"');
            return window.TENANT.id;
        });
})();
