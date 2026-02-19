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
        { service: 'Monogram',            pns: 'Monogram',          price: 12.50,  notes: 'Per piece' },
        { service: 'Name',               pns: 'NAME',              price: 12.50,  notes: 'Per piece' },
        { service: 'Name & Number',      pns: 'Name/Number',       price: 15.00,  notes: 'Per piece' },
        { service: 'Sewing (Garment)',    pns: 'SEG',               price: 10.00,  notes: 'Per piece' },
        { service: 'Sewing (Cap)',        pns: 'SECC',              price: 10.00,  notes: 'Per piece' },
        { service: 'Design Transfer',     pns: 'DT',                price: 50.00,  notes: 'One-time fee' },
        { service: '3D Puff',            pns: '3D-EMB',            price: 5.00,   notes: 'Per cap upcharge' },
        { service: 'Laser Patch',        pns: 'Laser Patch',       price: 5.00,   notes: 'Per cap upcharge' },
        { service: 'Patch Setup',        pns: 'GRT-50',            price: 50.00,  notes: 'One-time fee' },
        { service: 'Graphic Design',     pns: 'GRT-75',            price: 75.00,  notes: 'One-time fee' },
        { service: 'LTM Fee',            pns: 'LTM',               price: 50.00,  notes: 'Qty \u22647, divided across pcs' },
        { service: 'Rush',               pns: 'RUSH',              price: null,   notes: '25% of subtotal' },
    ];

    const FALLBACK_OTHER_SERVICES = [
        { service: 'Art Charges',           pns: 'Art',           price: 75.00, notes: 'Hourly rate (same as GRT-75)' },
        { service: 'Freight',               pns: 'Freight',       price: null, notes: 'Pass-through actual cost' },
        { service: 'Screen Print Set Up',   pns: 'SPSU',          price: 30.00, notes: 'Screen print orders' },
        { service: 'Screen Reset',          pns: 'SPRESET',       price: 30.00, notes: 'Screen print orders' },
        { service: 'Heavyweight Surcharge', pns: 'HW-SURCHG',     price: 10.00, notes: 'Per heavyweight garment' },
        { service: 'Digital Print',         pns: 'CDP',           price: null, notes: 'Customer-supplied, pass-through' },
        { service: 'Digital Print \u22645"', pns: 'CDP 5x5',      price: null, notes: 'Pass-through' },
        { service: 'Digital Print 5"-10"',  pns: 'CDP 5x5-10',   price: null, notes: 'Pass-through' },
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
            { service: 'Monogram',            pns: 'Monogram',          price: lookup('Monogram') ?? 12.50, notes: 'Per piece' },
            { service: 'Name',               pns: 'NAME',              price: lookup('NAME') ?? 12.50, notes: 'Per piece' },
            { service: 'Name & Number',      pns: 'Name/Number',       price: lookup('Name/Number') ?? 15.00, notes: 'Per piece' },
            { service: 'Sewing (Garment)',    pns: 'SEG',               price: lookup('SEG') ?? 10.00, notes: 'Per piece' },
            { service: 'Sewing (Cap)',        pns: 'SECC',              price: lookup('SECC') ?? 10.00, notes: 'Per piece' },
            { service: 'Design Transfer',     pns: 'DT',                price: lookup('DT') ?? 50.00, notes: 'One-time fee' },
            { service: '3D Puff',            pns: '3D-EMB',            price: lookup('3D-EMB') ?? 5.00, notes: 'Per cap upcharge' },
            { service: 'Laser Patch',        pns: 'Laser Patch',       price: lookup('Laser Patch') ?? 5.00, notes: 'Per cap upcharge' },
            { service: 'Patch Setup',        pns: 'GRT-50',            price: lookup('GRT-50') ?? 50.00, notes: 'One-time fee' },
            { service: 'Graphic Design',     pns: 'GRT-75',            price: lookup('GRT-75') ?? 75.00, notes: 'One-time fee' },
            { service: 'LTM Fee',            pns: 'LTM',               price: 50.00, notes: 'Qty \u22647, divided across pcs' },
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
            { service: 'Screen Print Set Up',   pns: 'SPSU',          price: lookup('SPSU') ?? 30.00, notes: 'Screen print orders' },
            { service: 'Screen Reset',          pns: 'SPRESET',       price: lookup('SPRESET') ?? 30.00, notes: 'Screen print orders' },
            { service: 'Heavyweight Surcharge', pns: 'HW-SURCHG',     price: lookup('HW-SURCHG') ?? lookup('HEAVYWEIGHT-SURCHARGE') ?? 10.00, notes: 'Per heavyweight garment' },
            { service: 'Digital Print',         pns: 'CDP',           price: null, notes: 'Customer-supplied, pass-through' },
            { service: 'Digital Print \u22645"', pns: 'CDP 5x5',      price: null, notes: 'Pass-through' },
            { service: 'Digital Print 5"-10"',  pns: 'CDP 5x5-10',   price: null, notes: 'Pass-through' },
            { service: 'Pallet Change',         pns: 'Pallet',        price: null, notes: 'Pass-through' },
            { service: 'Discount',              pns: 'Discount',      price: null, notes: 'Variable customer discount' },
        ];
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
            } else {
                renderFixedServices(FALLBACK_FIXED, 'Fallback');
                renderOtherServices(FALLBACK_OTHER_SERVICES);
            }
        } catch (err) {
            console.error('Service codes API failed:', err);
            renderFixedServices(FALLBACK_FIXED, 'Fallback');
            renderOtherServices(FALLBACK_OTHER_SERVICES);
        }

        document.getElementById('load-timestamp').textContent = new Date().toLocaleString();
    }

    init();
})();
