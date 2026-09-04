/**
 * ae-dashboard-init.js — page bootstrap for dashboards/ae-dashboard.html
 *
 * Was the inline <script> at the foot of the page until 2026-09-04 (Rule 3:
 * no inline code). Owns:
 *   1. gallery + Ruth-form initialisation
 *   2. the Item-Type control (Garment / Sticker / Banner / JDS) — which form
 *      is mounted, lazily, the first time its pill is chosen — with proper
 *      tab keyboard behaviour
 *   3. one click delegator for every data-action on the page (the More menu,
 *      its items, the Grid/Board toggles, the Requirements jump links) —
 *      there are no onclick attributes on this page any more
 *   4. the Requirements tab's art fees, read from Caspio Service_Codes so the
 *      page never states a price on its own (Erik's rule: pricing = API)
 *
 * Depends on: app-config.js, ae-dashboard.js (showTab / toggleMoreDropdown /
 * closeMoreDropdown / toggleAeKanbanView / toggleRuthAeKanbanView), the four
 * *-submit-form.js modules, art-ae.js, mockup-ae.js.
 */
(function () {
    'use strict';

    var API_BASE = (window.APP_CONFIG && window.APP_CONFIG.API && window.APP_CONFIG.API.BASE_URL)
        || 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';

    // ── 1. Galleries + Ruth's form ──────────────────────────────────────
    if (typeof ArtAeGallery !== 'undefined') ArtAeGallery.init('art-ae-gallery');
    if (typeof MockupAeGallery !== 'undefined') MockupAeGallery.init('mockup-ae-gallery');
    if (typeof MockupSubmitForm !== 'undefined') MockupSubmitForm.init('mockup-submit-container');

    // ── 2. Item-Type control ────────────────────────────────────────────
    (function () {
        var pills = [].slice.call(document.querySelectorAll('.ae-item-pill'));
        var garmentBox = document.getElementById('garment-form-container');
        var sbBox = document.getElementById('sticker-banner-form-container');
        var jdsBox = document.getElementById('jds-form-container');
        var sbInited = false, jdsInited = false, garmentInited = false;

        function hideAll() {
            if (garmentBox) garmentBox.hidden = true;
            if (sbBox) sbBox.hidden = true;
            if (jdsBox) jdsBox.hidden = true;
        }
        function showGarment() {
            hideAll();
            if (garmentBox) garmentBox.hidden = false;
            if (typeof GarmentSubmitForm === 'undefined') return;
            if (!garmentInited) { GarmentSubmitForm.init('garment-form-container'); garmentInited = true; }
        }
        function showStickerBanner(itemType) {
            hideAll();
            if (sbBox) sbBox.hidden = false;
            if (typeof StickerBannerSubmitForm === 'undefined') return;
            if (!sbInited) { StickerBannerSubmitForm.init('sticker-banner-form-container'); sbInited = true; }
            StickerBannerSubmitForm.setItemType(itemType);
        }
        function showJds() {
            hideAll();
            if (jdsBox) jdsBox.hidden = false;
            if (typeof JDSSubmitForm === 'undefined') return;
            if (!jdsInited) { JDSSubmitForm.init('jds-form-container'); jdsInited = true; }
        }
        function select(pill) {
            var type = pill.getAttribute('data-item-type');
            pills.forEach(function (p) {
                var active = (p === pill);
                p.classList.toggle('is-active', active);
                p.setAttribute('aria-selected', active ? 'true' : 'false');
                p.tabIndex = active ? 0 : -1;
            });
            if (type === 'Garment') showGarment();
            else if (type === 'JDS') showJds();
            else showStickerBanner(type);
        }
        pills.forEach(function (pill, i) {
            pill.tabIndex = pill.classList.contains('is-active') ? 0 : -1;
            pill.addEventListener('click', function () { select(pill); });
        });
        // role="tab" means arrows move between pills (WAI-ARIA tabs pattern).
        var bar = document.querySelector('.ae-item-type-bar');
        if (bar) bar.addEventListener('keydown', function (e) {
            var idx = pills.indexOf(document.activeElement);
            if (idx < 0) return;
            var next = -1;
            if (e.key === 'ArrowRight') next = (idx + 1) % pills.length;
            else if (e.key === 'ArrowLeft') next = (idx - 1 + pills.length) % pills.length;
            else if (e.key === 'Home') next = 0;
            else if (e.key === 'End') next = pills.length - 1;
            if (next < 0) return;
            e.preventDefault();
            pills[next].focus();
            select(pills[next]);
        });
        // Garment is the default active pill — render its form on load.
        showGarment();
    })();

    // ── 3. data-action delegation ───────────────────────────────────────
    document.addEventListener('click', function (e) {
        var el = e.target.closest('[data-action]');
        if (!el) return;
        var action = el.getAttribute('data-action');
        if (action === 'more-toggle') {
            e.preventDefault();
            if (typeof window.toggleMoreDropdown === 'function') window.toggleMoreDropdown();
        } else if (action === 'tab') {
            e.preventDefault();
            if (typeof window.showTab === 'function') window.showTab(el.getAttribute('data-tab'));
            if (typeof window.closeMoreDropdown === 'function') window.closeMoreDropdown();
        } else if (action === 'view') {
            var gallery = el.getAttribute('data-gallery');
            var view = el.getAttribute('data-view');
            var fn = gallery === 'ruth' ? window.toggleRuthAeKanbanView : window.toggleAeKanbanView;
            if (typeof fn === 'function') fn(view);
        } else if (action === 'scroll-to') {
            var target = document.getElementById(el.getAttribute('data-target'));
            if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    });

    // ── 4. Requirements tab: art fees from Service_Codes ────────────────
    function money(n) {
        var v = Number(n);
        return '$' + (Number.isInteger(v) ? v.toFixed(0) : v.toFixed(2));
    }
    function fillArtFees() {
        var warn = document.getElementById('req-fees-warning');
        var hooks = document.querySelectorAll('[data-fee-price], [data-fee-rate], [data-fee-frac], [data-fee-name]');
        if (!hooks.length) return;
        fetch(API_BASE + '/api/service-codes')
            .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
            .then(function (d) {
                var rows = (d && (d.data || d.Result)) || (Array.isArray(d) ? d : []);
                var byCode = {};
                rows.forEach(function (r) { if (r && r.ServiceCode) byCode[String(r.ServiceCode).toUpperCase()] = r; });
                var missing = [];
                hooks.forEach(function (el) {
                    var code, row;
                    if (el.hasAttribute('data-fee-frac')) {
                        var parts = el.getAttribute('data-fee-frac').split(':');
                        code = parts[0].toUpperCase(); row = byCode[code];
                        if (!row || row.SellPrice == null) { missing.push(code); el.textContent = '—'; return; }
                        el.textContent = money(Number(row.SellPrice) * Number(parts[1] || 1));
                        return;
                    }
                    code = (el.getAttribute('data-fee-price') || el.getAttribute('data-fee-rate') || el.getAttribute('data-fee-name')).toUpperCase();
                    row = byCode[code];
                    if (!row || (row.SellPrice == null && !el.hasAttribute('data-fee-name'))) { missing.push(code); el.textContent = '—'; return; }
                    if (el.hasAttribute('data-fee-name')) { if (row.DisplayName) el.textContent = row.DisplayName; return; }
                    var per = el.hasAttribute('data-fee-rate') && /hour/i.test(String(row.PerUnit || '')) ? '/hr' : '';
                    el.textContent = money(row.SellPrice) + per;
                });
                if (warn) {
                    var uniq = missing.filter(function (c, i) { return missing.indexOf(c) === i; });
                    warn.hidden = uniq.length === 0;
                    warn.textContent = uniq.length ? 'These codes are not in Caspio Service_Codes right now: ' + uniq.join(', ') + '. Check the table before quoting them.' : '';
                }
            })
            .catch(function (err) {
                console.error('[ae-dashboard] art fees failed to load:', err);
                hooks.forEach(function (el) { if (!el.hasAttribute('data-fee-name')) el.textContent = '—'; });
                if (warn) {
                    warn.hidden = false;
                    warn.textContent = 'Could not load the art fees from Caspio (' + err.message + '). The figures above are unavailable, not zero — refresh to retry.';
                }
            });
    }
    fillArtFees();
})();
