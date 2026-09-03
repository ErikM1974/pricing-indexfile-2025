/**
 * shop-services.js — rep calculator for work on customer-supplied goods (Erik, 2026-09-03).
 *
 * The third piece of the shop-services build (card → Caspio rows → this). Reps pick lines
 * from the same Caspio Service_Codes SHOP rows the customer card prints, add quarter-hour
 * time for anything not on the card, add materials at cost + markup, and the page applies
 * the one job minimum. "Save quote" mints SHP-YYYY-NNN and writes quote_sessions +
 * quote_items through the same-origin relays, so the job shows in Quote Management
 * (read-only there — this page is the editor).
 *
 * Nothing priced here: every unit price, the minimum, the quarter-hour rates and the
 * material markup come from GET /api/service-codes?type=SHOP. If that fails the page shows
 * the error and no totals (rule #4). See memory/SHOP_HOURLY_RATE_2026-09.md.
 */
(function () {
    'use strict';

    const state = { rows: [], rules: {}, lines: [], savedQuoteId: null };
    let nextId = 1;
    const $ = (id) => document.getElementById(id);
    const money = (n) => '$' + (Math.round(n * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const ceil2 = (n) => Math.round(n * 100) / 100;

    document.addEventListener('DOMContentLoaded', () => {
        wire();
        load().then(() => { render(); }).catch((err) => {
            console.error('[shop-services] load failed:', err);
            DashPage.showError('Unable to load the shop services card from Caspio: ' + err.message + '. Nothing is priced until it loads.');
            $('ss-rules-note').textContent = 'Card not loaded.';
        });
    });

    async function load() {
        // One read of the whole catalogue: the SHOP menu rows (price of record) and the
        // ShopWorks part rows they name in AliasFor (billing code shown to the rep).
        const res = await DashPage.fetchJson('/api/service-codes');
        const all = (Array.isArray(res) ? res : (res.data || [])).filter((r) => r.IsActive !== false);
        const parts = {};
        all.forEach((r) => { if (r.ServiceType !== 'SHOP' && r.ServiceCode && !(r.ServiceCode in parts)) parts[r.ServiceCode] = r; });
        // The SHOP menu row is the price of record; AliasFor is only the ShopWorks part the rep
        // bills on (several lines share DT or DECG at different prices, so the part cannot price).
        void parts;
        const rows = all.filter((r) => r.ServiceType === 'SHOP').map((r) => Object.assign({}, r, {
            PartNumber: r.AliasFor || '',
            Price: Number(r.SellPrice)
        }));
        if (!rows.length) throw new Error('no SHOP rows');
        rows.sort((a, b) => (Number(a.SortOrder) || 0) - (Number(b.SortOrder) || 0));
        state.rows = rows;
        const byCode = {};
        rows.forEach((r) => { byCode[String(r.ServiceCode || '').toUpperCase()] = r; });
        const need = (c) => { if (!byCode[c] || !isFinite(Number(byCode[c].Price))) throw new Error('row ' + c + ' missing'); return Number(byCode[c].Price); };
        state.rules = { min: need('SHOP-JOB-MIN'), benchQH: need('SHOP-BENCH-QH'), machineQH: need('SHOP-MACHINE-QH'), markupPct: need('SHOP-MATERIAL-MARKUP') };
        $('ss-rules-note').textContent = 'Job minimum ' + money(state.rules.min) + ' · off-card time ' + money(state.rules.benchQH) + ' per quarter hour bench, ' +
            money(state.rules.machineQH) + ' per quarter hour machine · materials we supply at cost + ' + state.rules.markupPct + '%. Customer-supplied goods are worked at the customer\'s risk.';
    }

    function services() {
        return state.rows.filter((r) => String(r.Position || '').toUpperCase() !== 'RULE' || /LASER-SETUP/i.test(r.ServiceCode));
    }

    // ── lines ──────────────────────────────────────────────────────────────
    function addService(code) {
        const list = services();
        const r = list.find((x) => x.ServiceCode === code) || list[0];
        state.lines.push({ id: nextId++, kind: 'service', code: r.ServiceCode, qty: 1 });
        render();
    }
    function addTime() { state.lines.push({ id: nextId++, kind: 'time', desc: '', mode: 'bench', quarters: 2 }); render(); }
    function addMaterial() { state.lines.push({ id: nextId++, kind: 'material', desc: '', qty: 1, cost: 0 }); render(); }

    function priceLine(l) {
        if (l.kind === 'service') {
            const r = state.rows.find((x) => x.ServiceCode === l.code);
            const unit = r ? Number(r.Price) : 0;
            return { label: r ? r.DisplayName : l.code, part: r ? r.PartNumber : '', unitText: r ? (r.PerUnit || 'each') : '', unit, qty: l.qty, total: unit * l.qty };
        }
        if (l.kind === 'time') {
            const unit = l.mode === 'machine' ? state.rules.machineQH : state.rules.benchQH;
            return { label: (l.desc || 'Shop time') + ' (' + (l.mode === 'machine' ? 'machine' : 'bench') + ')', part: 'DECG', unitText: 'per ¼ hour', unit, qty: l.quarters, total: unit * l.quarters };
        }
        const unit = ceil2(l.cost * (1 + state.rules.markupPct / 100));
        return { label: (l.desc || 'Material') + ' (we supply)', part: '', unitText: 'each', unit, qty: l.qty, total: unit * l.qty };
    }

    function compute() {
        const priced = state.lines.map((l) => ({ line: l, p: priceLine(l) }));
        const subtotal = priced.reduce((s, x) => s + x.p.total, 0);
        const minimumApplied = priced.length > 0 && subtotal < state.rules.min;
        const total = minimumApplied ? state.rules.min : subtotal;
        return { priced, subtotal, minimumApplied, total };
    }

    // ── render ─────────────────────────────────────────────────────────────
    function render() {
        if (!state.rows.length) return;
        const root = $('ss-lines');
        const opts = services().map((r) => '<option value="' + esc(r.ServiceCode) + '">' + esc(r.Category) + ' — ' + esc(r.DisplayName) + ' · ' + money(r.Price) + ' ' + esc(r.PerUnit || '') + (r.PartNumber ? ' · ShopWorks ' + esc(r.PartNumber) : '') + '</option>').join('');
        const c = compute();
        root.innerHTML = c.priced.length ? c.priced.map(({ line, p }) => {
            let main = '';
            if (line.kind === 'service') {
                main = '<select data-f="code">' + opts.replace('value="' + esc(line.code) + '"', 'value="' + esc(line.code) + '" selected') + '</select>' +
                    (p.part ? '<small>ShopWorks part: <b>' + esc(p.part) + '</b></small>' : '');
            } else if (line.kind === 'time') {
                main = '<input type="text" data-f="desc" value="' + esc(line.desc) + '" placeholder="What the time is for"><small>' +
                    '<label><input type="radio" name="mode' + line.id + '" data-f="mode" value="bench"' + (line.mode === 'bench' ? ' checked' : '') + '> bench</label> &nbsp; ' +
                    '<label><input type="radio" name="mode' + line.id + '" data-f="mode" value="machine"' + (line.mode === 'machine' ? ' checked' : '') + '> machine</label> &nbsp; quarter hours → &nbsp; ShopWorks part: <b>DECG</b> (caps DECC, laser items Laser)</small>';
            } else {
                main = '<input type="text" data-f="desc" value="' + esc(line.desc) + '" placeholder="Material (transfer, labels, bags…)"><small>Our cost each: $<input type="number" data-f="cost" min="0" step="0.01" value="' + line.cost + '" class="ss-cost"> → price = cost + ' + state.rules.markupPct + '%</small>';
            }
            const qtyField = line.kind === 'time' ? 'quarters' : 'qty';
            return '<div class="ss-line" data-id="' + line.id + '">' +
                '<div class="ss-line-main">' + main + '</div>' +
                '<input type="number" class="num" data-f="' + qtyField + '" min="0" step="1" value="' + line[qtyField] + '">' +
                '<div class="num">' + money(p.unit) + '<br><small>' + esc(p.unitText) + '</small></div>' +
                '<div class="num"><b>' + money(p.total) + '</b></div>' +
                '<button type="button" class="ss-line-remove" title="Remove"><i class="fas fa-times"></i></button></div>';
        }).join('') : '<div class="ss-empty">No lines yet. Add a service from the card, time for something not on it, or a material we supply.</div>';

        renderTotals(c);
    }

    function summary(c) {
        if (!c.priced.length) return 'Add a line to build the quote.';
        const L = [];
        L.push('Northwest Custom Apparel — Shop Services quote' + (state.savedQuoteId ? ' ' + state.savedQuoteId : ''));
        const cust = $('ss-customer').value.trim(); const desc = $('ss-desc').value.trim();
        if (cust) L.push('For: ' + cust);
        if (desc) L.push('Job: ' + desc);
        L.push('');
        c.priced.forEach(({ p }) => L.push('  ' + p.label + ' — ' + p.qty + ' × ' + money(p.unit) + ' = ' + money(p.total)));
        if (c.minimumApplied) L.push('  Job minimum ' + money(state.rules.min) + ' applies (lines total ' + money(c.subtotal) + ')');
        L.push('');
        L.push('ShopWorks lines: ' + c.priced.map(({ p }) => (p.part || 'material part') + ' ' + p.qty + ' @ ' + money(p.unit)).join(' · ') +
            (c.minimumApplied ? ' · LTM 1 @ ' + money(c.total - c.subtotal) : ''));
        L.push('');
        L.push('Total: ' + money(c.total) + (c.priced.length && c.priced[0].p.qty ? '' : ''));
        L.push('Goods you supply are worked at your risk; please include a spare for a test where possible. Sales tax extra.');
        return L.join('\n');
    }

    // ── events ─────────────────────────────────────────────────────────────
    function wire() {
        $('ss-add-service').addEventListener('click', () => addService());
        $('ss-add-time').addEventListener('click', addTime);
        $('ss-add-material').addEventListener('click', addMaterial);
        ['ss-customer', 'ss-desc', 'ss-rep', 'ss-email'].forEach((id) => $(id).addEventListener('input', () => { $('ss-summary').textContent = summary(compute()); }));
        $('ss-lines').addEventListener('input', onLineEdit);
        $('ss-lines').addEventListener('change', onLineEdit);
        $('ss-lines').addEventListener('click', (e) => {
            const btn = e.target.closest('.ss-line-remove'); if (!btn) return;
            const id = Number(btn.closest('.ss-line').dataset.id);
            state.lines = state.lines.filter((l) => l.id !== id); render();
        });
        $('ss-copy').addEventListener('click', async () => {
            try { await navigator.clipboard.writeText($('ss-summary').textContent); $('ss-copy').innerHTML = '<i class="fas fa-check"></i> Copied'; }
            catch (e) { DashPage.showError('Copy failed — select the summary text and copy it manually.'); }
            setTimeout(() => { $('ss-copy').innerHTML = '<i class="fas fa-copy"></i> Copy'; }, 1500);
        });
        $('ss-save').addEventListener('click', saveQuote);
    }

    function onLineEdit(e) {
        const row = e.target.closest('.ss-line'); if (!row) return;
        const line = state.lines.find((l) => l.id === Number(row.dataset.id)); if (!line) return;
        const f = e.target.dataset.f; if (!f) return;
        if (f === 'code') { line.code = e.target.value; }
        else if (f === 'desc') { line.desc = e.target.value; }
        else if (f === 'mode') { line.mode = e.target.value; }
        else if (f === 'cost') { line.cost = Math.max(0, parseFloat(e.target.value) || 0); }
        else { line[f] = Math.max(0, parseInt(e.target.value, 10) || 0); }
        // Never rebuild a row while the rep is typing in it: update that row's unit/total
        // cells and the totals in place. Only a service or mode change rebuilds (the row's
        // shape changes), and those come from a select/radio, not a text field.
        if (f === 'code' || f === 'mode') { render(); return; }
        const p = priceLine(line);
        const cells = row.querySelectorAll('.num');
        if (cells[1]) cells[1].innerHTML = money(p.unit) + '<br><small>' + esc(p.unitText) + '</small>';
        if (cells[2]) cells[2].innerHTML = '<b>' + money(p.total) + '</b>';
        renderTotals(compute());
    }

    function renderTotals(c) {
        $('ss-subtotal').textContent = money(c.subtotal);
        $('ss-min-row').hidden = !c.minimumApplied;
        if (c.minimumApplied) $('ss-min-note').textContent = money(state.rules.min) + ' (lines total ' + money(c.subtotal) + ')';
        $('ss-total').textContent = money(c.total);
        $('ss-summary').textContent = summary(c);
    }

    // ── save (quote_sessions + quote_items, prefix SHP) ──────────────────────
    async function saveQuote() {
        const c = compute();
        const status = $('ss-save-status');
        const setStatus = (m, cls) => { status.textContent = m; status.className = 'ss-save-status' + (cls ? ' ss-save-status--' + cls : ''); };
        if (!c.priced.length) { setStatus('Add at least one line.', 'error'); return; }
        const customer = $('ss-customer').value.trim();
        if (!customer) { setStatus('Enter the customer first.', 'error'); return; }
        $('ss-save').disabled = true; setStatus('Saving…', '');
        try {
            const seqResp = await fetch('/api/quote-sequence/SHP');
            if (!seqResp.ok) throw new Error('quote number service returned ' + seqResp.status);
            const seq = await seqResp.json();
            const quoteId = seq.prefix + '-' + seq.year + '-' + String(seq.sequence).padStart(3, '0');
            const now = new Date().toISOString().replace(/\.\d{3}Z$/, '');
            const expires = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10) + 'T23:59:59';
            const totalQty = c.priced.filter((x) => x.line.kind === 'service').reduce((s, x) => s + x.p.qty, 0);
            const session = {
                QuoteID: quoteId, SessionID: 'shop_services_' + Date.now(),
                CustomerName: customer, CompanyName: customer, CustomerEmail: $('ss-email').value.trim(),
                SalesRepName: $('ss-rep').value.trim(), SalesRepEmail: 'sales@nwcustomapparel.com',
                TotalQuantity: totalQty, SubtotalAmount: ceil2(c.total), LTMFeeTotal: c.minimumApplied ? ceil2(c.total - c.subtotal) : 0, TotalAmount: ceil2(c.total),
                Status: 'Open', CreatedAt_Quote: now, ExpiresAt: expires,
                PrintLocation: '', StitchCount: 0, DigitizingFee: 0,
                Notes: 'SHOP SERVICES on customer-supplied goods. ' + ($('ss-desc').value.trim() || '') +
                    (c.minimumApplied ? ' Job minimum ' + money(state.rules.min) + ' applied.' : '') + ' Goods worked at customer risk.'
            };
            const sResp = await fetch('/api/quote_sessions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(session) });
            if (!sResp.ok) throw new Error('quote_sessions save returned ' + sResp.status);
            let n = 0, failed = 0;
            const items = c.priced.map(({ line, p }) => ({
                QuoteID: quoteId, LineNumber: ++n,
                // StyleNumber = the ShopWorks part the rep will type (Monogram, SECC, SEG, DECG, DT…).
                StyleNumber: p.part || (line.kind === 'material' ? 'MATERIAL' : line.code),
                ProductName: p.label + (line.kind === 'service' ? ' [' + line.code + ']' : ''), Color: '', ColorCode: '', EmbellishmentType: 'shop-service',
                PrintLocation: '', PrintLocationName: '', Quantity: p.qty, HasLTM: 'No',
                BaseUnitPrice: ceil2(p.unit), LTMPerUnit: 0, FinalUnitPrice: ceil2(p.unit), LineTotal: ceil2(p.total),
                SizeBreakdown: '{}', PricingTier: line.kind === 'time' ? (line.mode + ' ¼h') : 'Shop services', ImageURL: '', AddedAt: now, LogoSpecs: ''
            }));
            if (c.minimumApplied) items.push({
                QuoteID: quoteId, LineNumber: ++n, StyleNumber: 'LTM', ProductName: 'Job minimum top-up to ' + money(state.rules.min), Color: '', ColorCode: '',
                EmbellishmentType: 'shop-service', PrintLocation: '', PrintLocationName: '', Quantity: 1, HasLTM: 'Yes',
                BaseUnitPrice: ceil2(c.total - c.subtotal), LTMPerUnit: 0, FinalUnitPrice: ceil2(c.total - c.subtotal), LineTotal: ceil2(c.total - c.subtotal),
                SizeBreakdown: '{}', PricingTier: 'Shop services', ImageURL: '', AddedAt: now, LogoSpecs: ''
            });
            for (const it of items) {
                const r = await fetch('/api/quote_items', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(it) });
                if (!r.ok) failed++;
            }
            if (failed) throw new Error(quoteId + ' saved but ' + failed + ' line(s) failed — check it in Quote Management');
            state.savedQuoteId = quoteId;
            setStatus('Saved as ' + quoteId + ' — in Quote Management.', 'ok');
            $('ss-summary').textContent = summary(c);
        } catch (err) {
            console.error('[shop-services] save failed:', err);
            setStatus('Not saved: ' + err.message, 'error');
            DashPage.showError('Quote not saved: ' + err.message);
        } finally { $('ss-save').disabled = false; }
    }
})();
