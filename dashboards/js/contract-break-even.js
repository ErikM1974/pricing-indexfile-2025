/**
 * contract-break-even.js — controller for dashboards/contract-break-even.html (Admin → Analysis)
 *
 * WHY (Erik 2026-09-02): "make the same price list with our costs that make us break even."
 * The contract price list is rate × stitches per tier; this page lays the same grid out with
 * the COST of each cell, so a card rate can be checked against what the job actually costs.
 *
 * Every number comes from the API — nothing priced or costed in this file:
 *   - cost model   GET /api/service-codes?type=VOLUME   (VOL-* rows: hour rate, order cost,
 *                  setup minutes, handling minutes, SPM, worst-case heads, slack %)
 *   - the card     GET /api/contract-pricing            (per-1K rates by tier, full-back ladder)
 *   - the minimum  GET /api/service-codes?code=CTR-MIN-ORDER
 *   - thread       GET /api/service-codes?code=VOL-THREAD-PER-1K (optional; 0 with a note if absent)
 *
 * Model (same as the Volume Quote page, see memory/EMBROIDERY_STITCH_COST_2026-09.md):
 *   minutes per piece = stitches ÷ (SPM × heads) + handling            [× (1 + slack) worst case]
 *   order hours       = (setup [× (1 + slack) worst] + minutes/pc × qty) ÷ 60
 *   break-even / pc   = (order hours × hour rate + thread × Kstitches × qty + order cost) ÷ qty
 * Typical = 8-head machines (the shop's garment/cap fleet) with no slack; worst = VOL-HEADS-WORST
 * with VOL-SLACK on everything. Overhead beyond the order cost is deliberately excluded (July model).
 */
(function () {
    'use strict';

    const CODES = {
        hourRate: 'VOL-HOUR-RATE', orderCost: 'VOL-ORDER-COST', setupMin: 'VOL-SETUP-MIN',
        handling: 'VOL-HANDLING-MIN', spm: 'VOL-SPM', headsWorst: 'VOL-HEADS-WORST', slackPct: 'VOL-SLACK'
    };
    const TIERS = [
        { label: '1-7', qty: 4 }, { label: '8-23', qty: 12 }, { label: '24-47', qty: 36 },
        { label: '48-71', qty: 60 }, { label: '72+', qty: 144 }
    ];
    const PRODUCTS = [
        { key: 'garments', title: 'Contract Garments', code: 'CTR-Garmt', stitches: [8000, 9000, 10000, 11000, 12000, 13000, 14000, 15000, 16000, 17000, 18000, 19000, 20000], headsTypical: 8 },
        { key: 'caps', title: 'Contract Caps (any single panel)', code: 'CTR-Cap', stitches: [8000, 9000, 10000, 11000, 12000, 13000, 14000, 15000, 16000, 17000, 18000, 19000, 20000], headsTypical: 8 },
        { key: 'fullBack', title: 'Full Back', code: 'DECG-FB', stitches: [25000, 30000, 35000, 40000, 45000, 50000], headsTypical: 8 }
    ];
    // Thin-margin threshold for the profit view: under this many dollars a piece reads amber.
    const THIN = 1.0;

    const state = { cfg: null, card: null, minimum: 0, threadPerK: 0, threadNote: '', prodCase: 'typical', view: 'cost' };
    const $ = (id) => document.getElementById(id);
    const money = (n) => '$' + (Math.round(n * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    document.addEventListener('DOMContentLoaded', () => {
        wire();
        load().then(render).catch((err) => {
            console.error('[contract-break-even] load failed:', err);
            DashPage.showError('Unable to load the cost model or the contract card: ' + err.message + '. Nothing is shown rather than a wrong cost.');
            $('cbe-assumptions').textContent = 'Not loaded.';
        });
    });

    function wire() {
        document.querySelectorAll('[data-case]').forEach((b) => b.addEventListener('click', () => {
            state.prodCase = b.dataset.case; syncToggles(); render();
        }));
        document.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => {
            state.view = b.dataset.view; syncToggles(); render();
        }));
        $('cbe-print').addEventListener('click', () => window.print());
    }

    function syncToggles() {
        document.querySelectorAll('[data-case]').forEach((b) => {
            const on = b.dataset.case === state.prodCase;
            b.classList.toggle('dash-btn--primary', on); b.setAttribute('aria-pressed', on);
        });
        document.querySelectorAll('[data-view]').forEach((b) => {
            const on = b.dataset.view === state.view;
            b.classList.toggle('dash-btn--primary', on); b.setAttribute('aria-pressed', on);
        });
    }

    async function load() {
        const [vol, card, minRes, threadRes] = await Promise.all([
            DashPage.fetchJson('/api/service-codes?type=VOLUME'),
            DashPage.fetchJson('/api/contract-pricing'),
            DashPage.fetchJson('/api/service-codes?code=CTR-MIN-ORDER'),
            DashPage.fetchJson('/api/service-codes?code=VOL-THREAD-PER-1K').catch(() => null)
        ]);
        const rows = Array.isArray(vol) ? vol : (vol.data || []);
        const byCode = {};
        rows.forEach((r) => { byCode[String(r.ServiceCode || '').toUpperCase()] = r; });
        const cfg = {};
        Object.keys(CODES).forEach((k) => {
            const row = byCode[CODES[k]];
            if (!row) throw new Error('Service_Codes row ' + CODES[k] + ' is missing');
            const v = Number(row.SellPrice);
            if (!isFinite(v) || v <= 0) throw new Error(CODES[k] + ' is not a positive number');
            cfg[k] = v;
        });
        state.cfg = cfg;
        if (!card || !card.garments || !card.caps || !card.fullBack) throw new Error('contract-pricing payload incomplete');
        state.card = card;
        const minRows = Array.isArray(minRes) ? minRes : (minRes.data || []);
        const minV = minRows.length ? Number(minRows[0].SellPrice) : NaN;
        if (!isFinite(minV) || minV < 0) throw new Error('CTR-MIN-ORDER row missing');
        state.minimum = minV;
        const tRows = threadRes ? (Array.isArray(threadRes) ? threadRes : (threadRes.data || [])) : [];
        if (tRows.length && isFinite(Number(tRows[0].SellPrice))) {
            state.threadPerK = Number(tRows[0].SellPrice);
        } else {
            state.threadPerK = 0;
            state.threadNote = 'No VOL-THREAD-PER-1K row in Service_Codes — thread is costed at $0 here (the 2025 ledger put it near $0.02 per 1,000 stitches; add the row to include it).';
        }
    }

    // ── math ────────────────────────────────────────────────────────────────
    function costPerPiece(product, stitches, qty) {
        const c = state.cfg;
        const worst = state.prodCase === 'worst';
        const heads = worst ? c.headsWorst : product.headsTypical;
        const slack = worst ? 1 + c.slackPct / 100 : 1;
        const minPc = (stitches / (c.spm * heads) + c.handling) * slack;
        const hours = (c.setupMin * slack + minPc * qty) / 60;
        const total = hours * c.hourRate + state.threadPerK * (stitches / 1000) * qty + c.orderCost;
        return { perPc: total / qty, minPc, hours };
    }

    function cardRate(product, tier) {
        const p = state.card[product.key];
        const rates = p.perThousandRates || p.ratesPerThousand || {};
        return Number(rates[tier.label]) || 0;
    }

    function pricePerPiece(product, stitches, tier) {
        const raw = cardRate(product, tier) * (stitches / 1000) * tier.qty;
        const billed = Math.max(raw, state.minimum);
        return { perPc: billed / tier.qty, minimumApplied: billed > raw };
    }

    // ── render ──────────────────────────────────────────────────────────────
    function render() {
        if (!state.cfg) return;
        const c = state.cfg;
        const worst = state.prodCase === 'worst';
        $('cbe-assumptions').innerHTML = [
            ['Hour rate', money(c.hourRate) + ' / h', 'VOL-HOUR-RATE'],
            ['Order cost', money(c.orderCost) + ' / order', 'VOL-ORDER-COST'],
            ['Setup', c.setupMin.toFixed(0) + ' min / order', 'VOL-SETUP-MIN'],
            ['Handling', c.handling.toFixed(2) + ' min / pc', 'VOL-HANDLING-MIN'],
            ['Sewing speed', c.spm + ' spm', 'VOL-SPM'],
            ['Heads', (worst ? c.headsWorst + ' (worst machine)' : '8 (garment / cap fleet)'), worst ? 'VOL-HEADS-WORST' : 'typical'],
            ['Slack', (worst ? c.slackPct + '%' : 'none'), 'VOL-SLACK'],
            ['Thread', money(state.threadPerK) + ' / 1,000 st', 'VOL-THREAD-PER-1K'],
            ['Order minimum', money(state.minimum), 'CTR-MIN-ORDER']
        ].map((a) => '<div>' + esc(a[0]) + ' <b>' + esc(a[1]) + '</b><small>' + esc(a[2]) + '</small></div>').join('');
        const notes = [];
        if (state.threadNote) notes.push(state.threadNote);
        if (c.handling < 2) notes.push('Handling is ' + c.handling.toFixed(2) + ' min/pc; the production logs fit 2.4 (garments) to 2.7 (caps). Cells understate cost by roughly ' + money((2.4 - c.handling) * c.hourRate / 60) + ' a piece until VOL-HANDLING-MIN is raised.');
        $('cbe-case-note').innerHTML = notes.map((n) => '<span class="cbe-warn">⚠ ' + esc(n) + '</span>').join('<br>');

        $('cbe-tables').innerHTML = PRODUCTS.map(renderProduct).join('');
    }

    function renderProduct(product) {
        const isProfit = state.view === 'profit';
        const head = '<tr><th>Stitches</th>' + TIERS.map((t) => '<th>' + esc(t.label) + '<br><small>' + t.qty + ' pcs</small></th>').join('') + '</tr>';
        const body = product.stitches.map((st) => {
            const cells = TIERS.map((t) => {
                const cost = costPerPiece(product, st, t.qty);
                const price = pricePerPiece(product, st, t);
                if (!isProfit) {
                    return '<td class="num" title="' + cost.minPc.toFixed(2) + ' min/pc · card ' + money(price.perPc) + (price.minimumApplied ? ' (minimum)' : '') + '">' + money(cost.perPc) + '</td>';
                }
                const profit = price.perPc - cost.perPc;
                const cls = profit < 0 ? ' loss' : (profit < THIN ? ' thin' : '');
                return '<td class="num' + cls + '" title="card ' + money(price.perPc) + (price.minimumApplied ? ' (minimum ÷ qty)' : '') + ' − cost ' + money(cost.perPc) + '">' + (profit < 0 ? '−' : '') + money(Math.abs(profit)) + '</td>';
            }).join('');
            return '<tr><td>' + (st / 1000) + 'K</td>' + cells + '</tr>';
        }).join('');
        // Footer: break-even $ per 1,000 stitches at the product's minimum stitch count vs the card rate.
        const base = product.stitches[0];
        const foot = '<tr><td>' + (isProfit ? 'Card $ / 1K' : 'Break-even $ / 1K at ' + (base / 1000) + 'K') + '</td>' + TIERS.map((t) => {
            if (isProfit) return '<td class="num">' + money(cardRate(product, t)) + '</td>';
            const cost = costPerPiece(product, base, t.qty);
            return '<td class="num">' + money(cost.perPc / (base / 1000)) + '</td>';
        }).join('') + '</tr>';
        return '<section class="dash-card cbe-product">' +
            '<div class="dash-card-header"><h2 class="dash-card-title">' + esc(product.title) + ' <span class="cbe-sub">' + esc(product.code) + ' · ' +
            (isProfit ? 'profit per piece at the card' : 'break-even cost per piece') + ' · ' + (state.prodCase === 'worst' ? 'worst case' : 'typical run') + '</span></h2></div>' +
            '<div class="cbe-table-wrap"><table class="cbe-table"><thead>' + head + '</thead><tbody>' + body + '</tbody><tfoot>' + foot + '</tfoot></table></div>' +
            (isProfit ? '<div class="cbe-legend"><span><span class="sw loss"></span>loses money</span><span><span class="sw thin"></span>under ' + money(THIN) + ' a piece</span><span>minimum ÷ qty is used where the card total is below the order minimum</span></div>' : '') +
            '</section>';
    }
})();
