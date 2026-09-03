/**
 * shop-services-pricing.js — customer-facing Shop Services price card (2026-09-03).
 *
 * Every price comes from Caspio Service_Codes rows with ServiceType 'SHOP' (Erik-editable, no
 * deploy). Rows with Position 'RULE' feed the rules strip (job minimum, quarter-hour rates,
 * materials markup, laser setup); every other row is a line on the card, grouped by Category
 * and ordered by SortOrder. UnitCost on each row holds the book minutes (internal; not shown).
 *
 * Built from the 2023-2026 ShopWorks history of what customers actually asked for — see
 * memory/SHOP_HOURLY_RATE_2026-09.md. Bench rate $90/h and machine rate $150/h sit underneath
 * the per-piece prices but never appear on this card; customers see prices and one minimum.
 */
(function () {
    'use strict';

    // CLAUDE.md rule 6: proxy host from config; the literal is the offline fallback only.
    const API_BASE_URL = (window.APP_CONFIG && window.APP_CONFIG.API && window.APP_CONFIG.API.BASE_URL) ||
        'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';

    const money = (n) => '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    document.addEventListener('DOMContentLoaded', async () => {
        document.getElementById('printBtn').addEventListener('click', () => window.print());
        try {
            // Whole catalogue in one read (the SHOP menu rows; the part rows are read for the
            // rep pages, which show the ShopWorks part beside each line).
            const resp = await fetch(`${API_BASE_URL}/api/service-codes`);
            if (!resp.ok) throw new Error('API ' + resp.status);
            const json = await resp.json();
            const all = (Array.isArray(json) ? json : (json.data || [])).filter((r) => r.IsActive !== false);
            const parts = {};
            all.forEach((r) => { if (r.ServiceType !== 'SHOP' && r.ServiceCode && !(r.ServiceCode in parts)) parts[r.ServiceCode] = r; });
            // The SHOP menu row is the price of record; AliasFor is only the ShopWorks part
            // (several lines share DT or DECG at different prices, so the part cannot price).
            void parts;
            const rows = all.filter((r) => r.ServiceType === 'SHOP').map((r) => Object.assign({}, r, { SellPrice: Number(r.SellPrice) }));
            if (!rows.length) throw new Error('no SHOP rows');
            render(rows);
            document.getElementById('loadingState').hidden = true;
            document.getElementById('pricingContent').hidden = false;
        } catch (err) {
            console.error('[shop-services] pricing failed to load:', err);
            document.getElementById('loadingState').hidden = true;
            const b = document.getElementById('errorBanner');
            b.textContent = 'Unable to load shop services pricing. Please refresh, or call 253-922-5793 for a quote.';
            b.classList.add('show');
        }
    });

    function render(rows) {
        const byCode = {};
        rows.forEach((r) => { byCode[String(r.ServiceCode || '').toUpperCase()] = r; });
        const rule = (code) => byCode[code] ? Number(byCode[code].SellPrice) : null;
        const set = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
        const min = rule('SHOP-JOB-MIN'), bench = rule('SHOP-BENCH-QH'), machine = rule('SHOP-MACHINE-QH'), markup = rule('SHOP-MATERIAL-MARKUP');
        if (min != null) set('ruleMin', money(min));
        if (bench != null) set('ruleBench', money(bench));
        if (machine != null) set('ruleMachine', money(machine));
        if (markup != null) set('ruleMarkup', markup + '%');

        // Card lines: everything that is not a RULE, grouped by Category.
        const cats = new Map();
        rows.filter((r) => String(r.Position || '').toUpperCase() !== 'RULE' || /LASER-SETUP/i.test(r.ServiceCode))
            .sort((a, b) => (Number(a.SortOrder) || 0) - (Number(b.SortOrder) || 0))
            .forEach((r) => {
                const cat = r.Category || 'Other';
                if (!cats.has(cat)) cats.set(cat, []);
                cats.get(cat).push(r);
            });
        const root = document.getElementById('categories');
        root.innerHTML = [...cats.entries()].map(([cat, list]) =>
            '<section class="ssp-cat"><h2>' + esc(cat) + '</h2><table><tbody>' +
            list.map((r) => {
                const unit = String(r.PerUnit || 'each');
                const isUp = /upcharge/i.test(unit);
                return '<tr><td class="name">' + esc(r.DisplayName) + '</td>' +
                    '<td class="price">' + (isUp ? '+' : '') + money(r.SellPrice) + '<small>' + esc(unit.replace(/^upcharge\s*/i, '')) + '</small></td></tr>';
            }).join('') + '</tbody></table></section>'
        ).join('');

        // Worked examples, computed from the same rows so they can never drift from the card.
        const ex = [];
        const price = (code) => byCode[code] ? Number(byCode[code].SellPrice) : null;
        const job = (total) => Math.max(total, min || 0);
        if (price('SHOP-NAME') != null) {
            const four = 4 * price('SHOP-NAME'); ex.push('4 shirts, a name on each: 4 × ' + money(price('SHOP-NAME')) + ' = ' + money(four) + (job(four) > four ? ', billed at the ' + money(min) + ' minimum' : '') + '.');
            const eight = 8 * price('SHOP-NAME'); ex.push('8 shirts with names: ' + money(eight) + '.');
        }
        if (price('SHOP-PATCH-BAG') != null) ex.push('12 backpacks, your patches sewn on: 12 × ' + money(price('SHOP-PATCH-BAG')) + ' = ' + money(job(12 * price('SHOP-PATCH-BAG'))) + '.');
        if (price('SHOP-PATCH-CAP') != null) ex.push('200 caps, your emblems sewn on: 200 × ' + money(price('SHOP-PATCH-CAP')) + ' = ' + money(200 * price('SHOP-PATCH-CAP')) + '.');
        if (price('SHOP-LASER-TUMBLER') != null && price('SHOP-LASER-SETUP') != null) ex.push('5 of your tumblers, one logo engraved: ' + money(price('SHOP-LASER-SETUP')) + ' setup + 5 × ' + money(price('SHOP-LASER-TUMBLER')) + ' = ' + money(price('SHOP-LASER-SETUP') + 5 * price('SHOP-LASER-TUMBLER')) + '.');
        if (bench != null) ex.push('Something not listed, estimated at 1½ hours of bench work: 6 × ' + money(bench) + ' = ' + money(6 * bench) + '.');
        document.getElementById('examples').innerHTML = ex.map((t) => '<li>' + esc(t) + '</li>').join('');
    }
})();
