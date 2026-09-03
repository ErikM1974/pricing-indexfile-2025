/**
 * service-price-cheat-sheet.js — the NWCA Shop Menu (rewritten 2026-09-03)
 *
 * THE one rep price page (Erik). Every course on the menu comes from Caspio Service_Codes:
 *   - Shop services on customer goods: rows with ServiceType 'SHOP'. The menu row is the
 *     PRICE OF RECORD; its AliasFor names the existing ShopWorks part the rep bills on
 *     (Monogram, SECC, SEG, DT, DECG, Transfer, Laser, Setup, LTM…). Position 'RULE' rows
 *     feed the House Rules ($75 minimum, quarter-hour rates, materials markup).
 *   - Setup & art fees and screen-print/other services: the part rows themselves (DD, DDE,
 *     DDT, GRT-50, GRT-75, LTM, RUSH, Art, SPSU…), same codes the old cheat sheet showed.
 * Two views on one page: rep (codes + book times) and customer (prices only). Print prints
 * the current view. Rule #4: if Caspio cannot be read, the menu says so and shows no prices
 * for the shop-services courses; the fee courses fall back to the documented list but are
 * badged as such.
 */
(function () {
    'use strict';

    const BASE_URL = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.API && APP_CONFIG.API.BASE_URL)
        ? APP_CONFIG.API.BASE_URL
        : 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';

    // Fee courses: what to show and in what order. Prices come from Caspio by code; the
    // fallback price is used only when the API is down and is badged "fallback".
    const FEE_COURSE = [
        { code: 'DD',     name: 'Digitizing, new logo',           fallback: 100,  unit: 'per design', desc: 'Sets up your logo for the embroidery machines. Yours to keep.' },
        { code: 'DDE',    name: 'Digitizing, edit an existing design', fallback: 50, unit: 'per design' },
        { code: 'DDT',    name: 'Digitizing, text only',          fallback: 50,   unit: 'per design' },
        { code: 'GRT-50', name: 'Logo mockup & print review',      fallback: 50,   unit: 'per order' },
        { code: 'GRT-75', name: 'Graphic design',                 fallback: 75,   unit: 'per hour', desc: 'Billed in quarter hours.' },
        { code: 'LTM',    name: 'Small-order fee, embroidery orders', fallback: 50, unit: 'per order', desc: 'Orders of 7 pieces or fewer, spread across the pieces.' },
        { code: 'RUSH',   name: 'Rush',                           fallback: null, unit: '25% of subtotal', text: '25%' },
    ];
    const OTHER_COURSE = [
        { code: 'Art',       name: 'Art charges',                    fallback: 75, unit: 'per hour' },
        { code: 'SPSU',      name: 'Screen setup, new screen',       fallback: 30, unit: 'per screen / color' },
        { code: 'SPRESET',   name: 'Screen setup, reorder',          fallback: 30, unit: 'per reset' },
        { code: 'Vellum',    name: 'Vellum print',                   fallback: 10, unit: 'per print' },
        { code: 'Color Chg', name: 'Color change on press',          fallback: 15, unit: 'per change' },
        { code: 'HW-SURCHG', name: 'Heavyweight garment surcharge',  fallback: 10, unit: 'per garment' },
        { code: 'Freight',   name: 'Freight',                        fallback: null, text: 'at cost' },
        { code: 'Discount',  name: 'Customer discount',              fallback: null, text: 'varies' },
    ];
    // Shop-services categories → course titles and the order they appear.
    const COURSES = [
        { cat: 'Sewing',                        title: 'From the Sewing Bench',     note: 'Your patches, emblems and labels, sewn on by hand.' },
        { cat: 'Embroidery on your goods',      title: 'From the Embroidery Heads', note: 'Names, samples and extras on garments you bring us.' },
        { cat: 'Finishing',                     title: 'Finishing',                 note: 'Pressed, bagged, tagged and ready to hand out.' },
        { cat: 'Laser engraving on your items', title: 'The Laser Bar',             note: 'Tumblers, boards, plaques and cases you supply.' },
    ];

    const currency = (v) => '$' + Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    // ── views ──────────────────────────────────────────────────────────────────
    function setView(view) {
        document.body.classList.toggle('view-rep', view === 'rep');
        document.body.classList.toggle('view-customer', view === 'customer');
        document.querySelectorAll('.view-btn').forEach((b) => {
            const on = b.dataset.view === view;
            b.classList.toggle('is-active', on); b.setAttribute('aria-pressed', on);
        });
        try { localStorage.setItem('nwca-menu-view', view); } catch (e) { /* fine */ }
    }

    // ── data ───────────────────────────────────────────────────────────────────
    async function loadCatalogue() {
        const resp = await fetch(`${BASE_URL}/api/service-codes`);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const json = await resp.json();
        const rows = (Array.isArray(json) ? json : (json.data || [])).filter((r) => r.IsActive !== false);
        if (!rows.length) throw new Error('empty catalogue');
        return rows;
    }

    function buildShop(rows) {
        const scMap = {};
        rows.forEach((r) => { if (r.ServiceType !== 'SHOP' && r.ServiceCode && !(r.ServiceCode in scMap)) scMap[r.ServiceCode] = r; });
        const menu = rows.filter((r) => r.ServiceType === 'SHOP').sort((a, b) => (Number(a.SortOrder) || 0) - (Number(b.SortOrder) || 0));
        const isRule = (r) => String(r.Position || '').toUpperCase() === 'RULE' && !/LASER-SETUP/i.test(r.ServiceCode);
        const rules = {};
        menu.filter(isRule).forEach((r) => { rules[r.ServiceCode] = Number(r.SellPrice); });
        // A part backing exactly one menu line should agree with it; DT/DECG back several at
        // different prices by design, so they are never flagged.
        const partUse = {};
        menu.forEach((r) => { if (r.AliasFor) partUse[r.AliasFor] = (partUse[r.AliasFor] || 0) + 1; });
        const items = menu.filter((r) => !isRule(r)).map((r) => {
            const part = r.AliasFor ? scMap[r.AliasFor] : null;
            const pp = part && partUse[r.AliasFor] === 1 && String(part.PricingMethod || '').toUpperCase() !== 'TIERED' ? Number(part.SellPrice) : NaN;
            return {
                cat: r.Category || 'Other', name: r.DisplayName, code: r.AliasFor || '',
                price: Number(r.SellPrice), unit: r.PerUnit || 'each',
                book: Number(r.UnitCost) > 0 ? Number(r.UnitCost) + ' min ' + (String(r.Position || '').toUpperCase() === 'MACHINE' ? 'machine' : 'bench') : '',
                mismatch: isFinite(pp) && pp > 0 && Math.abs(pp - Number(r.SellPrice)) > 0.001 ? pp : null
            };
        });
        return { rules, items, scMap };
    }

    // ── render ─────────────────────────────────────────────────────────────────
    function itemHtml(it, opts) {
        const isUp = /upcharge/i.test(it.unit || '');
        const unitText = (it.unit || '').replace(/^upcharge\s*/i, '');
        const priceHtml = it.text
            ? '<span class="item-price">' + esc(it.text) + '</span>'
            : '<span class="item-price">' + (isUp ? '<span class="plus">+</span>' : '') + currency(it.price) + '<span class="unit">' + esc(unitText) + '</span></span>';
        const meta = [];
        if (it.code) meta.push('<code>' + esc(it.code) + '</code>');
        if (it.book) meta.push('<span class="book">book ' + esc(it.book) + '</span>');
        if (it.mismatch != null) meta.push('<span class="warn">⚠ part row says ' + currency(it.mismatch) + ' — align it in Caspio</span>');
        if (opts && opts.fallback) meta.push('<span class="warn">fallback price — Caspio unreachable</span>');
        return '<div class="item">' +
            '<span class="item-name"><span class="txt">' + esc(it.name) + '</span><span class="leader"></span></span>' + priceHtml +
            (it.desc ? '<span class="item-desc">' + esc(it.desc) + '</span>' : '') +
            (meta.length ? '<span class="item-meta rep-only">' + meta.join('') + '</span>' : '') +
            '</div>';
    }

    function courseHtml(title, note, itemsHtml, wide) {
        return '<section class="course' + (wide ? ' course--wide' : '') + '"><h2 class="course-title">' + esc(title) + '</h2>' +
            (note ? '<p class="course-note">' + esc(note) + '</p>' : '') + itemsHtml + '</section>';
    }

    function feeCourse(list, scMap, title, note, apiOk) {
        const html = list.map((f) => {
            const rec = scMap[f.code];
            const live = rec ? Number(rec.SellPrice) : NaN;
            const price = isFinite(live) && live > 0 ? live : f.fallback;
            return itemHtml({ name: f.name, code: f.code, unit: f.unit, desc: f.desc, price, text: f.text || (price == null ? 'varies' : null) },
                { fallback: !apiOk && f.fallback != null });
        }).join('');
        return courseHtml(title, note, html, false);
    }

    function render(rows) {
        const shop = buildShop(rows);
        const set = (k, v) => document.querySelectorAll('[data-rule="' + k + '"]').forEach((el) => { el.textContent = v; });
        if (shop.rules['SHOP-JOB-MIN'] != null) set('min', Number(shop.rules['SHOP-JOB-MIN']).toFixed(0));
        if (shop.rules['SHOP-BENCH-QH'] != null) set('bench', Number(shop.rules['SHOP-BENCH-QH']).toFixed(2).replace(/\.00$/, ''));
        if (shop.rules['SHOP-MACHINE-QH'] != null) set('machine', Number(shop.rules['SHOP-MACHINE-QH']).toFixed(2));
        if (shop.rules['SHOP-MATERIAL-MARKUP'] != null) set('markup', Number(shop.rules['SHOP-MATERIAL-MARKUP']).toFixed(0));

        let html = '';
        COURSES.forEach((c) => {
            const items = shop.items.filter((it) => it.cat === c.cat);
            if (items.length) html += courseHtml(c.title, c.note, items.map((it) => itemHtml(it)).join(''), false);
        });
        // Any SHOP category not in the fixed list still shows, at the end.
        const known = new Set(COURSES.map((c) => c.cat));
        const extra = shop.items.filter((it) => !known.has(it.cat));
        if (extra.length) html += courseHtml('Also on the menu', '', extra.map((it) => itemHtml(it)).join(''), false);
        html += feeCourse(FEE_COURSE, shop.scMap, 'Setup & Art', 'Once per design or per order, on any kind of job.', true);
        html += feeCourse(OTHER_COURSE, shop.scMap, 'Screen Print & Other', '', true);
        document.getElementById('courses').innerHTML = html;
    }

    function renderUnavailable(err) {
        const b = document.getElementById('errorBanner');
        b.textContent = 'Could not load prices from Caspio (' + err.message + '). Shop-services prices are not shown; do not quote from memory. Refresh to try again.';
        b.classList.add('show');
        let html = courseHtml('Shop services on customer goods', 'Unavailable until Caspio answers.', '<p class="course-note">No prices shown.</p>', true);
        html += feeCourse(FEE_COURSE, {}, 'Setup & Art', 'Documented prices — badged as fallback until Caspio answers.', false);
        html += feeCourse(OTHER_COURSE, {}, 'Screen Print & Other', '', false);
        document.getElementById('courses').innerHTML = html;
    }

    // ── init ───────────────────────────────────────────────────────────────────
    async function init() {
        document.querySelectorAll('.view-btn').forEach((b) => b.addEventListener('click', () => setView(b.dataset.view)));
        document.getElementById('printBtn').addEventListener('click', () => window.print());
        let saved = 'rep';
        try { saved = localStorage.getItem('nwca-menu-view') || 'rep'; } catch (e) { /* fine */ }
        setView(saved === 'customer' ? 'customer' : 'rep');
        document.getElementById('menuDate').textContent = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        try {
            render(await loadCatalogue());
        } catch (err) {
            console.error('[shop-menu] Service codes API failed:', err);
            renderUnavailable(err);
        }
        document.getElementById('loadTimestamp').textContent = new Date().toLocaleString();
    }

    init();
})();
