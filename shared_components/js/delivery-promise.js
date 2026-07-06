// delivery-promise.js — "Order today → estimated to ship by X" chips
// (Broken Arrow teardown adoption #1, 2026-07-06 — memory/BAW_CHECKOUT_TEARDOWN_2026-07.md).
//
// Lead times come from Caspio Service_Codes rows LEAD-DAYS-{EMB|CAP|DTG|SCP|DTF}
// (SellPrice = business days, Category 'Lead Times') — Erik tunes them in Caspio
// with NO deploy, same pattern as every other fee/config (CLAUDE.md: config = API).
//
// FAIL-SOFT BY DESIGN: this is marketing copy, not pricing. A missing row, an
// inactive row, or a fetch error hides the chip — we never show a guessed date
// (hiding is correct here; a visible error banner would be wrong for a promo line).
(function () {
    'use strict';

    let cache = null;
    let cacheAt = 0;
    const TTL = 5 * 60 * 1000;

    function apiBase() {
        return (window.APP_CONFIG && window.APP_CONFIG.API && window.APP_CONFIG.API.BASE_URL)
            || 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
    }

    // ONE call loads every method's lead days (mirrors getCtsSalesMap's
    // category-fetch pattern — per-code lookups across methods would burst).
    async function leadDaysMap() {
        if (cache && Date.now() - cacheAt < TTL) return cache;
        const r = await fetch(apiBase() + '/api/service-codes?category=' + encodeURIComponent('Lead Times'));
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const j = await r.json();
        const map = {};
        ((j && j.data) || []).forEach(function (row) {
            const m = /^LEAD-DAYS-(.+)$/.exec(String(row.ServiceCode || ''));
            const days = parseFloat(row.SellPrice);
            if (m && row.IsActive && days > 0) map[m[1].toUpperCase()] = days;
        });
        cache = map;
        cacheAt = Date.now();
        return map;
    }

    // Calendar walk skipping weekends. Holidays are intentionally ignored —
    // it's an estimate, and the chip's title text says so.
    function addBusinessDays(start, days) {
        const d = new Date(start.getTime());
        let left = Math.ceil(days);
        while (left > 0) {
            d.setDate(d.getDate() + 1);
            const w = d.getDay();
            if (w !== 0 && w !== 6) left--;
        }
        return d;
    }

    function fmt(d) {
        return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    }

    // method: engine key — EMB | CAP | DTG | SCP | DTF (case-insensitive).
    async function shipDateFor(method) {
        const map = await leadDaysMap();
        const days = map[String(method || '').toUpperCase()];
        if (!(days > 0)) return null;
        return { date: addBusinessDays(new Date(), days), businessDays: days };
    }

    // Fills `el` with the promise line for `method`, or hides it. Never throws.
    async function render(el, method) {
        if (!el) return;
        try {
            const s = await shipDateFor(method);
            if (!s) { el.style.display = 'none'; return; }
            el.textContent = '🚚 Order today — estimated to ship by ' + fmt(s.date);
            el.title = 'Estimate from current production times; assumes prompt proof approval. We confirm your date with the proof.';
            el.style.display = '';
        } catch (_) {
            el.style.display = 'none';
        }
    }

    window.DeliveryPromise = {
        shipDateFor: shipDateFor,
        render: render,
        _addBusinessDays: addBusinessDays, // exposed for tests
    };
}());
