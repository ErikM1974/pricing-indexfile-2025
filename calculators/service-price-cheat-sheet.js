/**
 * Service Price Cheat Sheet — API-driven reference page
 * Fetches service codes, DECG tiers, and AL tiers in parallel.
 */

(function () {
    const BASE_URL = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.API && APP_CONFIG.API.BASE_URL)
        ? APP_CONFIG.API.BASE_URL
        : 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';

    // ── Fallback data (used when API is unavailable) ────────────────────────
    const FALLBACK_FIXED = [
        { service: 'Digitizing (New)',    pns: 'DD / DGT-001',      price: 100.00, notes: 'New design setup' },
        { service: 'Digitizing (Edit)',   pns: 'DDE / DGT-002',     price: 50.00,  notes: 'Design revision' },
        { service: 'Digitizing (Text)',   pns: 'DDT / DGT-003',     price: 50.00,  notes: 'Text-only design' },
        { service: 'Monogram',            pns: 'Monogram',          price: 12.50,  notes: 'Per piece' },
        { service: 'Name',               pns: 'NAME',              price: 12.50,  notes: 'Per piece' },
        { service: 'Sewing (Garment)',    pns: 'SEG',               price: 10.00,  notes: 'Per piece' },
        { service: 'Sewing (Cap)',        pns: 'SECC',              price: 10.00,  notes: 'Per piece' },
        { service: 'Design Transfer',     pns: 'DT',                price: 50.00,  notes: 'One-time fee' },
        { service: 'Weight',             pns: 'WEIGHT',            price: 6.25,   notes: 'Per piece' },
        { service: '3D Puff',            pns: '3D-EMB',            price: 5.00,   notes: 'Per cap upcharge' },
        { service: 'Laser Patch',        pns: 'Laser Patch',       price: 5.00,   notes: 'Per cap upcharge' },
        { service: 'Patch Setup',        pns: 'GRT-50',            price: 50.00,  notes: 'One-time fee' },
        { service: 'Graphic Design',     pns: 'GRT-75',            price: 75.00,  notes: 'One-time fee' },
        { service: 'LTM Fee',            pns: 'LTM',               price: 50.00,  notes: 'Qty \u22647, divided across pcs' },
        { service: 'Rush',               pns: 'RUSH',              price: null,   notes: '25% of subtotal' },
    ];

    const FALLBACK_DECG_GARMENT = [
        { tier: '1-7',   price: 28.00 },
        { tier: '8-23',  price: 26.00 },
        { tier: '24-47', price: 24.00 },
        { tier: '48-71', price: 22.00 },
        { tier: '72+',   price: 20.00 },
    ];

    const FALLBACK_DECC_CAP = [
        { tier: '1-7',   price: 22.50 },
        { tier: '8-23',  price: 21.00 },
        { tier: '24-47', price: 19.00 },
        { tier: '48-71', price: 17.50 },
        { tier: '72+',   price: 16.00 },
    ];

    const FALLBACK_AL_GARMENT = [
        { tier: '1-7',   price: 10.00 },
        { tier: '8-23',  price: 9.00 },
        { tier: '24-47', price: 8.00 },
        { tier: '48-71', price: 7.50 },
        { tier: '72+',   price: 7.00 },
    ];

    const FALLBACK_AL_CAP = [
        { tier: '1-7',   price: 6.50 },
        { tier: '8-23',  price: 6.00 },
        { tier: '24-47', price: 5.75 },
        { tier: '48-71', price: 5.50 },
        { tier: '72+',   price: 5.25 },
    ];

    // ── Fetch helpers ───────────────────────────────────────────────────────
    async function fetchAPI(endpoint) {
        const resp = await fetch(`${BASE_URL}${endpoint}`);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        return resp.json();
    }

    function currency(val) {
        if (val == null) return '—';
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

    function renderTierTable(tbodyId, tiers, source, sourceBadgeId) {
        const tbody = document.getElementById(tbodyId);
        if (sourceBadgeId) {
            const badge = document.getElementById(sourceBadgeId);
            badge.textContent = source;
            badge.className = 'source-badge ' + (source === 'API' ? 'source-api' : 'source-fallback');
        }

        let html = '';
        for (const t of tiers) {
            html += `<tr>
                <td>${escapeHtml(t.tier)}</td>
                <td class="price-col">${currency(t.price)}</td>
            </tr>`;
        }
        tbody.innerHTML = html;
    }

    // ── Build fixed services from API service codes ─────────────────────────
    function buildFixedFromAPI(serviceCodeMap) {
        // Map service codes to our display rows
        const lookup = (code) => {
            const rec = serviceCodeMap[code];
            return rec ? parseFloat(rec.SellPrice) : null;
        };

        return [
            { service: 'Digitizing (New)',    pns: 'DD / DGT-001',      price: lookup('DD') ?? lookup('DGT-001') ?? 100, notes: 'New design setup' },
            { service: 'Digitizing (Edit)',   pns: 'DDE / DGT-002',     price: lookup('DDE') ?? lookup('DGT-002') ?? 50, notes: 'Design revision' },
            { service: 'Digitizing (Text)',   pns: 'DDT / DGT-003',     price: lookup('DDT') ?? lookup('DGT-003') ?? 50, notes: 'Text-only design' },
            { service: 'Monogram',            pns: 'Monogram',          price: lookup('Monogram') ?? 12.50, notes: 'Per piece' },
            { service: 'Name',               pns: 'NAME',              price: lookup('NAME') ?? 12.50, notes: 'Per piece' },
            { service: 'Sewing (Garment)',    pns: 'SEG',               price: lookup('SEG') ?? 10.00, notes: 'Per piece' },
            { service: 'Sewing (Cap)',        pns: 'SECC',              price: lookup('SECC') ?? 10.00, notes: 'Per piece' },
            { service: 'Design Transfer',     pns: 'DT',                price: lookup('DT') ?? 50.00, notes: 'One-time fee' },
            { service: 'Weight',             pns: 'WEIGHT',            price: lookup('WEIGHT') ?? 6.25, notes: 'Per piece' },
            { service: '3D Puff',            pns: '3D-EMB',            price: lookup('3D-EMB') ?? 5.00, notes: 'Per cap upcharge' },
            { service: 'Laser Patch',        pns: 'Laser Patch',       price: lookup('Laser Patch') ?? 5.00, notes: 'Per cap upcharge' },
            { service: 'Patch Setup',        pns: 'GRT-50',            price: lookup('GRT-50') ?? 50.00, notes: 'One-time fee' },
            { service: 'Graphic Design',     pns: 'GRT-75',            price: lookup('GRT-75') ?? 75.00, notes: 'One-time fee' },
            { service: 'LTM Fee',            pns: 'LTM',               price: 50.00, notes: 'Qty \u22647, divided across pcs' },
            { service: 'Rush',               pns: 'RUSH',              price: null, notes: '25% of subtotal' },
        ];
    }

    // ── Build tier arrays from API data ─────────────────────────────────────
    function buildDECGTiersFromAPI(serviceCodeMap) {
        const tiers = ['1-7', '8-23', '24-47', '48-71', '72+'];
        const garment = [];
        const cap = [];
        let apiFound = false;

        for (const t of tiers) {
            const gRec = serviceCodeMap['DECG-' + t.replace('-', '-')];
            const cRec = serviceCodeMap['DECC-' + t.replace('-', '-')];
            if (gRec) apiFound = true;
            garment.push({ tier: t, price: gRec ? parseFloat(gRec.SellPrice) : null });
            cap.push({ tier: t, price: cRec ? parseFloat(cRec.SellPrice) : null });
        }

        return { garment, cap, apiFound };
    }

    function buildALTiersFromAPI(serviceCodeMap) {
        const tiers = ['1-7', '8-23', '24-47', '48-71', '72+'];
        const garment = [];
        const cap = [];
        let apiFound = false;

        for (const t of tiers) {
            const gRec = serviceCodeMap['AL-' + t];
            const cRec = serviceCodeMap['AL-CAP-' + t];
            if (gRec) apiFound = true;
            garment.push({ tier: t, price: gRec ? parseFloat(gRec.SellPrice) : null });
            cap.push({ tier: t, price: cRec ? parseFloat(cRec.SellPrice) : null });
        }

        return { garment, cap, apiFound };
    }

    // ── Error renderer ──────────────────────────────────────────────────────
    function renderError(tbodyId, message) {
        const tbody = document.getElementById(tbodyId);
        const cols = tbody.closest('table').querySelectorAll('thead th').length;
        tbody.innerHTML = `<tr><td colspan="${cols}" class="error-cell">
            <i class="fas fa-exclamation-triangle"></i> ${escapeHtml(message)}
        </td></tr>`;
    }

    // ── Main load ───────────────────────────────────────────────────────────
    async function init() {
        const [scResult, decgResult, alResult] = await Promise.allSettled([
            fetchAPI('/api/service-codes'),
            fetchAPI('/api/decg-pricing'),
            fetchAPI('/api/al-pricing')
        ]);

        // --- Fixed Services ---
        if (scResult.status === 'fulfilled' && scResult.value.success) {
            const scMap = {};
            for (const sc of scResult.value.data) {
                if (sc.ServiceCode) scMap[sc.ServiceCode] = sc;
            }
            renderFixedServices(buildFixedFromAPI(scMap), 'API');

            // Also try to use service codes for DECG/AL if dedicated endpoints fail
            window._scMap = scMap;
        } else {
            renderFixedServices(FALLBACK_FIXED, 'Fallback');
        }

        // --- DECG Tiers ---
        if (decgResult.status === 'fulfilled' && decgResult.value) {
            const data = decgResult.value;
            // Handle actual backend format: { garments: { basePrices: {...} }, caps: { basePrices: {...} } }
            if (data.garments && data.garments.basePrices) {
                const garment = Object.entries(data.garments.basePrices).map(([tier, price]) => ({ tier, price }));
                const cap = data.caps && data.caps.basePrices
                    ? Object.entries(data.caps.basePrices).map(([tier, price]) => ({ tier, price }))
                    : FALLBACK_DECC_CAP;
                renderTierTable('decg-garment-tbody', garment, 'API', 'decg-source');
                renderTierTable('decc-cap-tbody', cap, 'API', null);
            } else if (data.garment && Array.isArray(data.garment)) {
                renderTierTable('decg-garment-tbody', data.garment, 'API', 'decg-source');
                renderTierTable('decc-cap-tbody', data.cap || FALLBACK_DECC_CAP, 'API', null);
            } else if (data.data && Array.isArray(data.data)) {
                // Parse from flat array format
                const garment = [];
                const cap = [];
                for (const row of data.data) {
                    const entry = { tier: row.Tier || row.tier, price: parseFloat(row.SellPrice || row.price) };
                    if (row.Type === 'cap' || row.type === 'cap') { cap.push(entry); }
                    else { garment.push(entry); }
                }
                renderTierTable('decg-garment-tbody', garment.length > 0 ? garment : FALLBACK_DECG_GARMENT, 'API', 'decg-source');
                renderTierTable('decc-cap-tbody', cap.length > 0 ? cap : FALLBACK_DECC_CAP, 'API', null);
            } else {
                // Try service code map fallback
                if (window._scMap) {
                    const built = buildDECGTiersFromAPI(window._scMap);
                    if (built.apiFound) {
                        const gFilled = built.garment.map((g, i) => ({ tier: g.tier, price: g.price ?? FALLBACK_DECG_GARMENT[i].price }));
                        const cFilled = built.cap.map((c, i) => ({ tier: c.tier, price: c.price ?? FALLBACK_DECC_CAP[i].price }));
                        renderTierTable('decg-garment-tbody', gFilled, 'API', 'decg-source');
                        renderTierTable('decc-cap-tbody', cFilled, 'API', null);
                    } else {
                        renderTierTable('decg-garment-tbody', FALLBACK_DECG_GARMENT, 'Fallback', 'decg-source');
                        renderTierTable('decc-cap-tbody', FALLBACK_DECC_CAP, 'Fallback', null);
                    }
                } else {
                    renderTierTable('decg-garment-tbody', FALLBACK_DECG_GARMENT, 'Fallback', 'decg-source');
                    renderTierTable('decc-cap-tbody', FALLBACK_DECC_CAP, 'Fallback', null);
                }
            }
        } else {
            renderTierTable('decg-garment-tbody', FALLBACK_DECG_GARMENT, 'Fallback', 'decg-source');
            renderTierTable('decc-cap-tbody', FALLBACK_DECC_CAP, 'Fallback', null);
        }

        // --- AL Tiers ---
        if (alResult.status === 'fulfilled' && alResult.value) {
            const data = alResult.value;
            // Handle actual backend format: { garments: { basePrices: {...} }, caps: { basePrices: {...} } }
            if (data.garments && data.garments.basePrices) {
                const garment = Object.entries(data.garments.basePrices).map(([tier, price]) => ({ tier, price }));
                const cap = data.caps && data.caps.basePrices
                    ? Object.entries(data.caps.basePrices).map(([tier, price]) => ({ tier, price }))
                    : FALLBACK_AL_CAP;
                renderTierTable('al-garment-tbody', garment, 'API', 'al-source');
                renderTierTable('al-cap-tbody', cap, 'API', null);
            } else if (data.garment && Array.isArray(data.garment)) {
                renderTierTable('al-garment-tbody', data.garment, 'API', 'al-source');
                renderTierTable('al-cap-tbody', data.cap || FALLBACK_AL_CAP, 'API', null);
            } else if (data.data && Array.isArray(data.data)) {
                const garment = [];
                const cap = [];
                for (const row of data.data) {
                    const entry = { tier: row.Tier || row.tier, price: parseFloat(row.SellPrice || row.price) };
                    if (row.Type === 'cap' || row.type === 'cap') { cap.push(entry); }
                    else { garment.push(entry); }
                }
                renderTierTable('al-garment-tbody', garment.length > 0 ? garment : FALLBACK_AL_GARMENT, 'API', 'al-source');
                renderTierTable('al-cap-tbody', cap.length > 0 ? cap : FALLBACK_AL_CAP, 'API', null);
            } else {
                if (window._scMap) {
                    const built = buildALTiersFromAPI(window._scMap);
                    if (built.apiFound) {
                        const gFilled = built.garment.map((g, i) => ({ tier: g.tier, price: g.price ?? FALLBACK_AL_GARMENT[i].price }));
                        const cFilled = built.cap.map((c, i) => ({ tier: c.tier, price: c.price ?? FALLBACK_AL_CAP[i].price }));
                        renderTierTable('al-garment-tbody', gFilled, 'API', 'al-source');
                        renderTierTable('al-cap-tbody', cFilled, 'API', null);
                    } else {
                        renderTierTable('al-garment-tbody', FALLBACK_AL_GARMENT, 'Fallback', 'al-source');
                        renderTierTable('al-cap-tbody', FALLBACK_AL_CAP, 'Fallback', null);
                    }
                } else {
                    renderTierTable('al-garment-tbody', FALLBACK_AL_GARMENT, 'Fallback', 'al-source');
                    renderTierTable('al-cap-tbody', FALLBACK_AL_CAP, 'Fallback', null);
                }
            }
        } else {
            renderTierTable('al-garment-tbody', FALLBACK_AL_GARMENT, 'Fallback', 'al-source');
            renderTierTable('al-cap-tbody', FALLBACK_AL_CAP, 'Fallback', null);
        }

        // Timestamp
        document.getElementById('load-timestamp').textContent = new Date().toLocaleString();
    }

    init();
})();
