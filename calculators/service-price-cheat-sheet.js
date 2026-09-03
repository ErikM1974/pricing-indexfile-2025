/**
 * Service Price Cheat Sheet — API-driven reference page
 * Shows fixed-price services and other services from the Service_Codes table.
 */

(function () {
    const BASE_URL = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.API && APP_CONFIG.API.BASE_URL)
        ? APP_CONFIG.API.BASE_URL
        : 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';

    // ── Fallback data (used when API is unavailable) ────────────────────────
    const FALLBACK_FIXED = [
        { service: 'Digitizing (New)',    pns: 'DD',                price: 100.00, notes: 'New design setup' },
        { service: 'Digitizing (Edit)',   pns: 'DDE',               price: 50.00,  notes: 'Design revision' },
        { service: 'Digitizing (Text)',   pns: 'DDT',               price: 50.00,  notes: 'Text-only design' },
        { service: 'Patch Setup',        pns: 'GRT-50',            price: 50.00,  notes: 'One-time fee' },
        { service: 'Graphic Design',     pns: 'GRT-75',            price: 75.00,  notes: 'One-time fee' },
        { service: 'LTM Fee',            pns: 'LTM',               price: 50.00,  notes: 'Qty \u22647, divided across pcs' },
        { service: 'Rush',               pns: 'RUSH',              price: null,   notes: '25% of subtotal' },
    ];

    const FALLBACK_OTHER_SERVICES = [
        { service: 'Art Charges',           pns: 'Art',           price: 75.00, notes: 'Hourly rate (same as GRT-75)' },
        { service: 'Freight',               pns: 'Freight',       price: null, notes: 'Pass-through actual cost' },
        { service: 'Screen Print Set Up Charge', pns: 'SPSU',        price: 30.00, notes: 'New screen — per screen/color' },
        { service: 'Re-Order Screenprint Setup', pns: 'SPRESET',     price: 30.00, notes: 'Reorder — screens on file' },
        { service: 'Vellum Print',          pns: 'Vellum',        price: 10.00, notes: 'Film positive output' },
        { service: 'Color Change',          pns: 'Color Chg',     price: 15.00, notes: 'Press-run color change' },
        { service: 'Heavyweight Surcharge', pns: 'HW-SURCHG',     price: 10.00, notes: 'Per heavyweight garment' },
        { service: 'Digital Print (DTG)',    pns: 'CDP',           price: null, notes: 'Pass-through' },
        { service: 'Pallet Change',         pns: 'Pallet',        price: null, notes: 'Pass-through' },
        { service: 'Discount',              pns: 'Discount',      price: null, notes: 'Variable customer discount' },
    ];

    // ── Helpers ────────────────────────────────────────────────────────────
    async function fetchAPI(endpoint) {
        const resp = await fetch(`${BASE_URL}${endpoint}`);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        return resp.json();
    }

    function currency(val) {
        if (val == null) return '\u2014';
        return '$' + Number(val).toFixed(2);
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // ── Render functions ────────────────────────────────────────────────────
    function renderFixedServices(data, source) {
        const tbody = document.getElementById('fixed-services-tbody');
        const badge = document.getElementById('fixed-source');
        badge.textContent = source;
        badge.className = 'source-badge ' + (source === 'API' ? 'source-api' : 'source-fallback');

        let html = '';
        for (const row of data) {
            html += `<tr>
                <td class="service-name">${escapeHtml(row.service)}</td>
                <td class="pn-cell"><code>${escapeHtml(row.pns)}</code></td>
                <td class="price-col">${row.price != null ? currency(row.price) : '<em>Variable</em>'}</td>
                <td class="notes-cell">${escapeHtml(row.notes)}</td>
            </tr>`;
        }
        tbody.innerHTML = html;
    }

    function renderOtherServices(data) {
        const tbody = document.getElementById('other-services-tbody');
        let html = '';
        for (const row of data) {
            html += `<tr>
                <td class="service-name">${escapeHtml(row.service)}</td>
                <td class="pn-cell"><code>${escapeHtml(row.pns)}</code></td>
                <td class="price-col">${row.price != null ? currency(row.price) : '<em>Pass-through</em>'}</td>
                <td class="notes-cell">${escapeHtml(row.notes)}</td>
            </tr>`;
        }
        tbody.innerHTML = html;
    }

    // ── Build from API ────────────────────────────────────────────────────
    function buildFixedFromAPI(scMap) {
        const lookup = (code) => {
            const rec = scMap[code];
            return rec ? parseFloat(rec.SellPrice) : null;
        };

        return [
            { service: 'Digitizing (New)',    pns: 'DD',                price: lookup('DD') ?? 100, notes: 'New design setup' },
            { service: 'Digitizing (Edit)',   pns: 'DDE',               price: lookup('DDE') ?? 50, notes: 'Design revision' },
            { service: 'Digitizing (Text)',   pns: 'DDT',               price: lookup('DDT') ?? 50, notes: 'Text-only design' },
            { service: 'Patch Setup',        pns: 'GRT-50',            price: lookup('GRT-50') ?? 50.00, notes: 'One-time fee' },
            { service: 'Graphic Design',     pns: 'GRT-75',            price: lookup('GRT-75') ?? 75.00, notes: 'One-time fee' },
            { service: 'LTM Fee (embroidery orders)', pns: 'LTM',        price: lookup('LTM') ?? 50.00, notes: 'Qty \u22647 on an embroidery order, divided across pcs. Shop-services jobs use LTM for the $75 minimum top-up instead.' },
            { service: 'Rush',               pns: 'RUSH',              price: null, notes: '25% of subtotal' },
        ];
    }

    function buildOtherServicesFromAPI(scMap) {
        const lookup = (code) => {
            const rec = scMap[code];
            return rec ? parseFloat(rec.SellPrice) : null;
        };

        return [
            { service: 'Art Charges',           pns: 'Art',           price: lookup('Art') ?? 75.00, notes: 'Hourly rate (same as GRT-75)' },
            { service: 'Freight',               pns: 'Freight',       price: null, notes: 'Pass-through actual cost' },
            { service: 'Screen Print Set Up Charge', pns: 'SPSU',        price: lookup('SPSU') ?? 30.00, notes: 'New screen — per screen/color' },
            { service: 'Re-Order Screenprint Setup', pns: 'SPRESET',     price: lookup('SPRESET') ?? 30.00, notes: 'Reorder — screens on file' },
            { service: 'Vellum Print',          pns: 'Vellum',        price: lookup('Vellum') ?? 10.00, notes: 'Film positive output' },
            { service: 'Color Change',          pns: 'Color Chg',     price: lookup('Color Chg') ?? 15.00, notes: 'Press-run color change' },
            { service: 'Heavyweight Surcharge', pns: 'HW-SURCHG',     price: lookup('HW-SURCHG') ?? lookup('HEAVYWEIGHT-SURCHARGE') ?? 10.00, notes: 'Per heavyweight garment' },
            { service: 'Digital Print (DTG)',    pns: 'CDP',           price: null, notes: 'Pass-through' },
            { service: 'Pallet Change',         pns: 'Pallet',        price: null, notes: 'Pass-through' },
            { service: 'Discount',              pns: 'Discount',      price: null, notes: 'Variable customer discount' },
        ];
    }

    // ── Shop services on customer goods (2026-09-03) ───────────────────────
    // Menu = Service_Codes rows with ServiceType SHOP; each names its ShopWorks part in
    // AliasFor. Price of record = the part row when it carries a flat price (Monogram,
    // SECC, SEG, DT, 3D-EMB, Laser Patch…), else the menu row. Same rule as the customer
    // card (/pages/shop-services-pricing) and the calculator (/calculators/shop-services).
    function buildShopServicesFromAPI(allRows, scMap) {
        const menu = allRows.filter(r => r.ServiceType === 'SHOP' && r.IsActive !== false)
            .sort((a, b) => (Number(a.SortOrder) || 0) - (Number(b.SortOrder) || 0));
        // The SHOP menu row is the price of record; AliasFor is only the ShopWorks part to
        // bill on (several menu lines share one part — DT, DECG — at different prices). If a
        // part row carries its own flat price that disagrees, flag it here so it gets fixed.
        const priceOf = (r) => Number(r.SellPrice);
        // Only meaningful when a part backs exactly ONE menu line (Monogram, SECC, SEG…);
        // DT and DECG carry several lines at different typed prices by design.
        const partUse = {};
        menu.forEach(r => { if (r.AliasFor) partUse[r.AliasFor] = (partUse[r.AliasFor] || 0) + 1; });
        const partMismatch = (r) => {
            if (!r.AliasFor || partUse[r.AliasFor] !== 1) return null;
            const part = scMap[r.AliasFor];
            const pp = part && String(part.PricingMethod || '').toUpperCase() !== 'TIERED' ? Number(part.SellPrice) : NaN;
            return isFinite(pp) && pp > 0 && Math.abs(pp - Number(r.SellPrice)) > 0.001 ? pp : null;
        };
        const rules = {};
        menu.filter(r => String(r.Position || '').toUpperCase() === 'RULE').forEach(r => { rules[r.ServiceCode] = priceOf(r); });
        const lines = menu.filter(r => String(r.Position || '').toUpperCase() !== 'RULE' || /LASER-SETUP/i.test(r.ServiceCode)).map(r => ({
            category: r.Category || 'Other',
            service: r.DisplayName,
            pns: r.AliasFor || '\u2014',
            price: priceOf(r),
            unit: r.PerUnit || 'each',
            notes: (Number(r.UnitCost) > 0 ? 'Book ' + Number(r.UnitCost) + ' min ' + (String(r.Position || '').toUpperCase() === 'MACHINE' ? 'machine' : 'bench') : '') +
                   (/upcharge/i.test(r.PerUnit || '') ? ' \u00b7 upcharge on the embroidery price' : '') +
                   (partMismatch(r) != null ? ' \u26a0 part ' + r.AliasFor + ' row says ' + currency(partMismatch(r)) + ' \u2014 align it in Caspio' : '')
        }));
        return { rules, lines };
    }

    // Rule #4: no fallback prices for shop services — say it is unavailable instead.
    function shopServicesUnavailable() {
        const tbody = document.getElementById('shop-services-tbody');
        if (tbody) tbody.innerHTML = '<tr><td colspan="4" class="loading-cell">Shop services pricing unavailable \u2014 refresh the page. Do not quote from memory.</td></tr>';
        const badge = document.getElementById('shop-source');
        if (badge) badge.textContent = 'Unavailable';
    }

    function renderShopServices(model, source) {
        const tbody = document.getElementById('shop-services-tbody');
        if (!tbody) return;
        const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
        if (model.rules['SHOP-JOB-MIN'] != null) set('rule-min', Number(model.rules['SHOP-JOB-MIN']).toFixed(0));
        if (model.rules['SHOP-BENCH-QH'] != null) set('rule-bench', Number(model.rules['SHOP-BENCH-QH']).toFixed(2).replace(/\.00$/, ''));
        if (model.rules['SHOP-MACHINE-QH'] != null) set('rule-machine', Number(model.rules['SHOP-MACHINE-QH']).toFixed(2));
        if (model.rules['SHOP-MATERIAL-MARKUP'] != null) set('rule-markup', Number(model.rules['SHOP-MATERIAL-MARKUP']).toFixed(0));
        let html = '', lastCat = null;
        for (const row of model.lines) {
            if (row.category !== lastCat) { html += `<tr class="cat-row"><td colspan="4">${escapeHtml(row.category)}</td></tr>`; lastCat = row.category; }
            html += `<tr>
                <td class="service-name">${escapeHtml(row.service)}</td>
                <td class="pn-cell"><code>${escapeHtml(row.pns)}</code></td>
                <td class="price-col">${currency(row.price)} <span class="notes-cell">${escapeHtml(row.unit)}</span></td>
                <td class="notes-cell">${escapeHtml(row.notes)}</td>
            </tr>`;
        }
        tbody.innerHTML = html || '<tr><td colspan="4" class="loading-cell">No shop-services rows in Caspio.</td></tr>';
        const badge = document.getElementById('shop-source');
        if (badge) badge.textContent = source;
    }

    // ── Main load ───────────────────────────────────────────────────────────
    async function init() {
        try {
            const result = await fetchAPI('/api/service-codes');
            if (result.success) {
                const scMap = {};
                for (const sc of result.data) {
                    if (sc.ServiceCode) scMap[sc.ServiceCode] = sc;
                }
                renderFixedServices(buildFixedFromAPI(scMap), 'API');
                renderOtherServices(buildOtherServicesFromAPI(scMap));
                renderShopServices(buildShopServicesFromAPI(result.data, scMap), 'API');
            } else {
                renderFixedServices(FALLBACK_FIXED, 'Fallback');
                renderOtherServices(FALLBACK_OTHER_SERVICES);
                shopServicesUnavailable();
            }
        } catch (err) {
            console.error('Service codes API failed:', err);
            renderFixedServices(FALLBACK_FIXED, 'Fallback');
            renderOtherServices(FALLBACK_OTHER_SERVICES);
            shopServicesUnavailable();
        }

        document.getElementById('load-timestamp').textContent = new Date().toLocaleString();
    }

    init();
})();
