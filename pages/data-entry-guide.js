/**
 * Data Entry Guide — API-driven service code reference
 * Fetches live prices from /api/service-codes (same pattern as service-price-cheat-sheet.js)
 */

(function () {
    'use strict';
    var BASE_URL = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.API && APP_CONFIG.API.BASE_URL)
        ? APP_CONFIG.API.BASE_URL
        : '';
    if (!BASE_URL) console.error('[data-entry-guide] APP_CONFIG.API.BASE_URL missing — the proxy host is not configured');

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
        var missing = [];
        for (var i = 0; i < FALLBACK_SERVICES.length; i++) {
            var row = FALLBACK_SERVICES[i];
            var price = row.price;

            var live = scMap && scMap[row.pn];
            var rawPrice = live && live.SellPrice;
            var apiPrice = rawPrice === null || rawPrice === undefined || String(rawPrice).trim() === '' ? NaN : Number(rawPrice);
            if (scMap && Number.isFinite(apiPrice) && apiPrice >= 0) price = apiPrice;
            else if (row.price !== null) missing.push(row.service);

            html += '<tr>' +
                '<td class="service-name">' + escapeHtml(row.service) + '</td>' +
                '<td class="pn-cell"><code>' + escapeHtml(row.pn) + '</code></td>' +
                '<td class="price-col">' + (price != null ? currency(price) : '<em>Variable</em>') + '</td>' +
                '<td class="notes-cell">' + escapeHtml(row.notes) + '</td>' +
                '</tr>';
        }
        // eslint-disable-next-line no-unsanitized/property -- labels/codes/notes are escaped; prices are validated finite numbers formatted as currency.
        tbody.innerHTML = html;
        if (scMap && missing.length) {
            badge.textContent = 'API + fallback';
            badge.className = 'source-badge source-fallback';
        }
        return missing;
    }

    var busy = false;
    var warning = document.createElement('div');
    warning.id = 'service-source-warning';
    warning.className = 'reference-source-warning';
    warning.setAttribute('role', 'status');
    warning.hidden = true;
    var message = document.createElement('div');
    var retry = document.createElement('button');
    retry.id = 'service-codes-retry'; retry.type = 'button'; retry.className = 'btn'; retry.textContent = 'Retry live prices';
    warning.append(message, retry);
    document.getElementById('price-source').parentElement.after(warning);
    retry.addEventListener('click', init);

    async function init() {
        if (busy) return;
        busy = true; retry.disabled = true;
        warning.hidden = false; message.textContent = 'Loading current service prices…';
        document.getElementById('price-source').textContent = 'Loading';
        // Keep checklists untouched; replace only the price rows so retry never shows stale live figures.
        var tbody = document.getElementById('service-codes-tbody');
        tbody.textContent = '';
        var row = tbody.insertRow(), cell = row.insertCell(); cell.colSpan = 4; cell.textContent = 'Loading current prices…';
        var ts = document.getElementById('load-timestamp');
        try {
            if (!BASE_URL) throw new Error('Pricing service is not configured');
            var resp = await fetch(BASE_URL + '/api/service-codes', {signal: AbortSignal.timeout(20000)});
            if (!resp.ok) throw new Error('HTTP ' + resp.status);
            var data = await resp.json();
            if (!data || data.success !== true || !Array.isArray(data.data) || data.data.some(function (item) { return !item || typeof item.ServiceCode !== 'string'; })) throw new Error('Invalid service price response');
            var scMap = Object.create(null);
            data.data.forEach(function (item) { scMap[item.ServiceCode] = item; });
            var missing = renderServiceTable(scMap);
            warning.hidden = missing.length === 0;
            if (missing.length) message.textContent = 'Current prices were unavailable for ' + missing.join(', ') + '. Those rows use fallback reference prices; confirm them before quoting.';
            if (ts) ts.textContent = new Date().toLocaleString() + (missing.length ? ' (some fallback prices)' : '');
        } catch (error) {
            renderServiceTable(null); warning.hidden = false;
            message.textContent = 'Unable to load current service prices (' + error.message + '). Fallback reference prices are shown; confirm them before quoting.';
            if (ts) ts.textContent = 'Unavailable — fallback prices shown';
        } finally { busy = false; retry.disabled = false; }
    }

    init();
})();
