/**
 * Data Entry Guide — API-driven service code reference
 * Fetches live prices from /api/service-codes (same pattern as service-price-cheat-sheet.js)
 */

(function () {
    var BASE_URL = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.API && APP_CONFIG.API.BASE_URL)
        ? APP_CONFIG.API.BASE_URL
        : 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';

    // Fallback data — matches service-price-cheat-sheet.js FALLBACK_FIXED exactly
    var FALLBACK_SERVICES = [
        { service: 'Digitizing (New)',    pn: 'DD',           price: 100.00, notes: 'New design setup' },
        { service: 'Digitizing (Edit)',   pn: 'DDE',          price: 50.00,  notes: 'Design revision' },
        { service: 'Digitizing (Text)',   pn: 'DDT',          price: 50.00,  notes: 'Text-only design' },
        { service: 'Monogram',            pn: 'Monogram',     price: 12.50,  notes: 'Per piece' },
        { service: 'Name & Number',      pn: 'Name/Number',  price: 15.00,  notes: 'Per piece' },
        { service: 'Sewing (Garment)',    pn: 'SEG',          price: 10.00,  notes: 'Per piece' },
        { service: 'Sewing (Cap)',        pn: 'SECC',         price: 10.00,  notes: 'Per piece' },
        { service: 'Design Transfer',     pn: 'DT',           price: 50.00,  notes: 'One-time fee' },
        { service: 'Weight',             pn: 'WEIGHT',       price: 6.25,   notes: 'Per piece' },
        { service: '3D Puff',            pn: '3D-EMB',       price: 5.00,   notes: 'Per cap upcharge' },
        { service: 'Laser Patch',        pn: 'Laser Patch',  price: 5.00,   notes: 'Per cap upcharge' },
        { service: 'Patch Setup',        pn: 'GRT-50',       price: 50.00,  notes: 'One-time fee' },
        { service: 'Graphic Design',     pn: 'GRT-75',       price: 75.00,  notes: 'One-time fee' },
        { service: 'Contract (Garment)', pn: 'CTR-GARMT',    price: null,   notes: 'Per contract' },
        { service: 'Contract (Cap)',     pn: 'CTR-CAP',      price: null,   notes: 'Per contract' },
    ];

    function currency(val) {
        if (val == null) return '\u2014';
        return '$' + Number(val).toFixed(2);
    }

    function escapeHtml(str) {
        var div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function renderServiceTable(scMap) {
        var tbody = document.getElementById('service-codes-tbody');
        var badge = document.getElementById('price-source');
        var source = scMap ? 'API' : 'Fallback';

        badge.textContent = source;
        badge.className = 'source-badge ' + (source === 'API' ? 'source-api' : 'source-fallback');

        var html = '';
        for (var i = 0; i < FALLBACK_SERVICES.length; i++) {
            var row = FALLBACK_SERVICES[i];
            var price = row.price;

            // Override with API price if available
            if (scMap && scMap[row.pn]) {
                var apiPrice = parseFloat(scMap[row.pn].SellPrice);
                if (!isNaN(apiPrice)) price = apiPrice;
            }

            html += '<tr>' +
                '<td class="service-name">' + escapeHtml(row.service) + '</td>' +
                '<td class="pn-cell"><code>' + escapeHtml(row.pn) + '</code></td>' +
                '<td class="price-col">' + (price != null ? currency(price) : '<em>Variable</em>') + '</td>' +
                '<td class="notes-cell">' + escapeHtml(row.notes) + '</td>' +
                '</tr>';
        }
        tbody.innerHTML = html;
    }

    async function init() {
        try {
            var resp = await fetch(BASE_URL + '/api/service-codes');
            if (!resp.ok) throw new Error('HTTP ' + resp.status);
            var data = await resp.json();

            if (data.success && Array.isArray(data.data)) {
                var scMap = {};
                for (var i = 0; i < data.data.length; i++) {
                    var sc = data.data[i];
                    if (sc.ServiceCode) scMap[sc.ServiceCode] = sc;
                }
                renderServiceTable(scMap);
            } else {
                renderServiceTable(null);
            }
        } catch (err) {
            console.warn('Data Entry Guide: Using fallback prices:', err.message);
            renderServiceTable(null);
        }

        // Timestamp
        var ts = document.getElementById('load-timestamp');
        if (ts) ts.textContent = new Date().toLocaleString();
    }

    init();
})();
