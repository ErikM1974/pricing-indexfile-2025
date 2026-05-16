/**
 * dash-page-helpers.js — Canonical helpers for staff-dashboard child pages
 *
 * Used by every page scaffolded with the /dash-page skill. Exposes a small
 * window.DashPage namespace with error banner toggles and a thin fetch
 * wrapper that enforces the CLAUDE.md API-error rule (no silent fallbacks).
 *
 * Load order (in the page HTML <head>):
 *   1. /config/app.config.js        (sets window.APP_CONFIG)
 *   2. /shared_components/js/fetch-timeout.js  (15s global fetch timeout)
 *   3. /shared_components/js/dash-page-helpers.js  (this file)
 *   4. /dashboards/js/<page>.js     (the page's own controller)
 */
(function (global) {
    'use strict';

    const ERROR_BANNER_SELECTOR = '.dash-error-banner';
    const ERROR_MESSAGE_SELECTOR = '.dash-error-banner-message';

    function getBanner() {
        return document.querySelector(ERROR_BANNER_SELECTOR);
    }

    function showError(message) {
        const banner = getBanner();
        if (!banner) {
            console.error('[DashPage] No .dash-error-banner element found. Error:', message);
            return;
        }
        const msgEl = banner.querySelector(ERROR_MESSAGE_SELECTOR);
        if (msgEl) {
            msgEl.textContent = message;
        }
        banner.classList.add('show');
    }

    function hideError() {
        const banner = getBanner();
        if (banner) {
            banner.classList.remove('show');
        }
    }

    function apiUrl(path) {
        if (!global.APP_CONFIG || !global.APP_CONFIG.API || !global.APP_CONFIG.API.BASE_URL) {
            throw new Error(
                '[DashPage] APP_CONFIG.API.BASE_URL not loaded. ' +
                'Ensure /config/app.config.js loads BEFORE any DashPage.apiUrl call.'
            );
        }
        const base = global.APP_CONFIG.API.BASE_URL.replace(/\/+$/, '');
        const suffix = String(path || '');
        return suffix.startsWith('/') ? base + suffix : base + '/' + suffix;
    }

    async function fetchJson(path, options) {
        const url = path.startsWith('http') ? path : apiUrl(path);
        const resp = await fetch(url, options);
        if (!resp.ok) {
            const detail = resp.status + ' ' + (resp.statusText || '');
            throw new Error('[DashPage] ' + detail.trim() + ' on ' + url);
        }
        return resp.json();
    }

    function wireErrorBannerClose() {
        const banner = getBanner();
        if (!banner) return;
        const closeBtn = banner.querySelector('.dash-error-banner-close');
        if (closeBtn && !closeBtn.dataset.dashWired) {
            closeBtn.addEventListener('click', hideError);
            closeBtn.dataset.dashWired = '1';
        }
    }

    global.DashPage = {
        showError: showError,
        hideError: hideError,
        apiUrl: apiUrl,
        fetchJson: fetchJson
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', wireErrorBannerClose);
    } else {
        wireErrorBannerClose();
    }
})(window);
