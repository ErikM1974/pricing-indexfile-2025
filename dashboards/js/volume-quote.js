/**
 * volume-quote.js — controller for dashboards/volume-quote.html (Admin → Money & Payroll)
 *
 * WHY (Erik 2026-09-02, Braun NW 500-pc request): the embroidery price list tops out at
 * the 72+ tier, so a 500-piece order prices exactly like a 72-piece one, and the flat
 * per-piece embroidery charge assumes a logo near the 8,000-stitch base. Erik wants ONE
 * place to build a one-time price for a large order, see what it costs in margin, and
 * hand the rep a written reason for the price so it never turns into a new price list.
 *
 * Everything priced here comes from the API, never a number in this file:
 *   - standard price      GET /api/pricing-bundle?method=EMB&styleNumber=…
 *                         (tiers + MarginDenominator, Shirt embroidery cost, SanMar CASE price)
 *   - piece price + title GET /api/product-details?styleNumber=…
 *   - stock               GET /api/sanmar/inventory/:style
 *   - cost model          GET /api/service-codes?type=VOLUME  (VOL-* rows, Erik-editable in Caspio)
 * If the VOLUME rows are missing the cost panel is disabled and a banner says so — no
 * built-in fallback, because this .js is served anonymously and the hour rate is internal.
 *
 * The price math mirrors embroidery-pricing-service.js: garment case cost ÷ MarginDenominator
 * + embroidery cost, rounded UP to the half dollar, then the RELATIVE size upcharge.
 * Nothing is persisted (v1): the memo is copied or printed and attached to the quote.
 */
(function () {
    'use strict';

    const VOL_CODES = {
        hourRate:   'VOL-HOUR-RATE',   // $ per machine hour (production pool incl. art)
        orderCost:  'VOL-ORDER-COST',  // $ per order (order-level admin cost, driver-based)
        setupMin:   'VOL-SETUP-MIN',   // minutes of machine time per order before the first piece
        minPerPc:   'VOL-MIN-PER-PC',  // minutes per piece at StitchBase stitches
        minGm:      'VOL-MIN-GM',      // % gross margin floor — the tool warns below it
        minQty:     'VOL-MIN-QTY',     // pieces before a one-time price is even considered
        denomFloor: 'VOL-DENOM-FLOOR', // largest garment denominator Erik allows (lowest margin)
        // Worst-case production model (Erik 2026-09-02: "include slack time and worst production
        // case scenarios"). Sewing time = stitches / (SPM × heads) on the SMALLEST machine the
        // job could land on, plus handling per piece, all inflated by the slack percentage.
        // The cost shown is max(fitted model, worst case) — never the optimistic one.
        spm:        'VOL-SPM',          // stitches per minute while sewing (ShopWorks Machines: 500)
        headsWorst: 'VOL-HEADS-WORST',  // heads on the worst-case machine (the 4-head)
        handling:   'VOL-HANDLING-MIN', // hoop / unhoop / trim / inspect, minutes per piece
        slackPct:   'VOL-SLACK'         // % added for thread breaks, bobbins, rehoops, downtime
    };

    const state = {
        config: null,          // { hourRate, orderCost, setupMin, minPerPc, stitchBase, minGm, minQty, denomFloor }
        configError: null,
        locations: [],
        lines: [],             // { id, style, qty, data|null, status }
        embStandard: null,     // Shirt 72+ EmbroideryCost from the first loaded style
        stitchRow: null,       // Shirt 72+ cost row (BaseStitchCount, StitchIncrement, AdditionalStitchRate)
        denomStandard: null,   // MarginDenominator of the 72+ tier
        rounding: null
    };
    let nextLineId = 1;

    const $ = (id) => document.getElementById(id);
    const money = (n) => '$' + (Math.round(n * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const money0 = (n) => '$' + Math.round(n).toLocaleString('en-US');
    const pct = (n) => (Math.round(n * 1000) / 10) + '%';

    document.addEventListener('DOMContentLoaded', init);

    async function init() {
        wireEvents();
        const today = new Date();
        const valid = new Date(today.getTime() + 30 * 86400000);
        $('vq-valid-until').value = valid.toISOString().slice(0, 10);
        await Promise.all([loadConfig(), loadReps()]);
        addLine();
        renderLines();
        render();
    }

    // ── loads ──────────────────────────────────────────────────────────────

    async function loadConfig() {
        try {
            const res = await DashPage.fetchJson('/api/service-codes?type=VOLUME');
            const rows = Array.isArray(res) ? res : (res.data || []);
            const byCode = {};
            rows.forEach((r) => { byCode[String(r.ServiceCode || '').toUpperCase()] = r; });
            const need = (key) => {
                const row = byCode[VOL_CODES[key]];
                if (!row) throw new Error('Service_Codes row ' + VOL_CODES[key] + ' is missing');
                return row;
            };
            const cfg = {
                hourRate:   Number(need('hourRate').SellPrice),
                orderCost:  Number(need('orderCost').SellPrice),
                setupMin:   Number(need('setupMin').SellPrice),
                minPerPc:   Number(need('minPerPc').SellPrice),
                stitchBase: Number(need('minPerPc').StitchBase) || 8000,
                minGm:      Number(need('minGm').SellPrice) / 100,
                minQty:     Number(need('minQty').SellPrice),
                denomFloor: Number(need('denomFloor').SellPrice),
                spm:        Number(need('spm').SellPrice),
                headsWorst: Number(need('headsWorst').SellPrice),
                handling:   Number(need('handling').SellPrice),
                slackPct:   Number(need('slackPct').SellPrice)
            };
            Object.keys(cfg).forEach((k) => { if (!isFinite(cfg[k]) || cfg[k] <= 0) throw new Error('Service_Codes VOL value for ' + k + ' is not a positive number'); });
            state.config = cfg;
            $('vq-denom').max = cfg.denomFloor.toFixed(2);
        } catch (err) {
            console.error('[volume-quote] cost model failed:', err);
            state.configError = err.message;
            DashPage.showError('Cost model not loaded from Caspio (Service_Codes VOL-* rows): ' + err.message +
                '. Prices still compute; machine hours, cost and margin are unavailable.');
        }
    }

    // Name → email via the shared StaffAuthHelper.STAFF_EMAIL_MAP (staff-auth-helper.js,
    // loaded by the page). Accepts a full name or a first name ("Taneisha").
    function repEmailFor(name) {
        const n = String(name || '').trim().toLowerCase();
        const map = (typeof StaffAuthHelper !== 'undefined' && StaffAuthHelper.STAFF_EMAIL_MAP) || {};
        if (n) {
            for (const full of Object.keys(map)) {
                const f = full.toLowerCase();
                if (f === n || f.split(/\s+/)[0] === n) return map[full];
            }
        }
        return 'sales@nwcustomapparel.com';
    }

    async function loadReps() {
        // Same-origin staff route (login-gated). Non-fatal: the field stays free text.
        try {
            const resp = await fetch('/api/staff/employees');
            if (!resp.ok) return;
            const data = await resp.json();
            const list = Array.isArray(data) ? data : (data.employees || data.data || []);
            const names = list.map((e) => typeof e === 'string' ? e : (e.name || e.Name || [e.firstName || e.FirstName, e.lastName || e.LastName].filter(Boolean).join(' '))).filter(Boolean);
            const dl = $('vq-rep-list');
            names.forEach((n) => { const o = document.createElement('option'); o.value = n; dl.appendChild(o); });
        } catch (e) { /* free text is fine */ }
    }

    async function loadStyle(line) {
        const style = line.style.trim().toUpperCase();
        line.data = null;
        line.status = 'loading';
        renderLines();
        try {
            const [bundle, details] = await Promise.all([
                DashPage.fetchJson('/api/pricing-bundle?method=EMB&styleNumber=' + encodeURIComponent(style)),
                DashPage.fetchJson('/api/product-details?styleNumber=' + encodeURIComponent(style)).catch(() => null)
            ]);
            if (!bundle || !bundle.tiersR || !bundle.allEmbroideryCostsR || !bundle.sizes || !bundle.sizes.length) {
                throw new Error('No embroidery pricing for ' + style);
            }
            const sizes = [...bundle.sizes].sort((a, b) => (a.sortOrder || Infinity) - (b.sortOrder || Infinity));
            const base = sizes.find((s) => String(s.size).toUpperCase() === 'S') || sizes[0];
            const caseCost = parseFloat(base.price || base.maxCasePrice);
            if (!isFinite(caseCost)) throw new Error('No case price for ' + style);
            const tier72 = bundle.tiersR.find((t) => t.TierLabel === '72+') || bundle.tiersR.reduce((a, b) => (Number(b.MinQuantity) > Number(a.MinQuantity) ? b : a));
            const costRow = bundle.allEmbroideryCostsR.find((c) => c.ItemType === 'Shirt' && c.TierLabel === tier72.TierLabel);
            if (!costRow) throw new Error('No Shirt embroidery cost for tier ' + tier72.TierLabel);
            const ups = bundle.sellingPriceDisplayAddOns || {};
            const baseUp = parseFloat(ups[base.size] || 0);
            const rel = (sz) => parseFloat(ups[sz] || 0) - baseUp;
            const d0 = Array.isArray(details) ? details[0] : details;
            line.data = {
                style,
                title: (d0 && (d0.PRODUCT_TITLE || '')) || style,
                brand: (d0 && d0.BRAND_NAME) || '',
                caseCost,
                pieceCost: d0 && isFinite(parseFloat(d0.PIECE_PRICE)) ? parseFloat(d0.PIECE_PRICE) : null,
                up2xl: sizes.some((s) => s.size === '2XL') ? rel('2XL') : null,
                up3xl: sizes.some((s) => s.size === '3XL') ? rel('3XL') : null,
                tierLabel: tier72.TierLabel,
                denom: parseFloat(tier72.MarginDenominator),
                embCost: parseFloat(costRow.EmbroideryCost),
                costRow,
                rounding: bundle.rulesR && bundle.rulesR.RoundingMethod,
                stock: null
            };
            // First style loaded defines the page-level standard values shown on the levers.
            if (state.embStandard === null) {
                state.embStandard = line.data.embCost;
                state.stitchRow = costRow;
                state.denomStandard = line.data.denom;
                state.rounding = line.data.rounding;
                if (!bundle.locations || !bundle.locations.length) throw new Error('No embroidery locations returned');
                state.locations = bundle.locations;
                fillLocations();
                if ($('vq-emb-price').value === '') $('vq-emb-price').value = state.embStandard.toFixed(2);
                $('vq-emb-note').textContent = 'Standard ' + tier72.TierLabel + ': ' + money(state.embStandard) + ' (base ' + Number(costRow.BaseStitchCount).toLocaleString() + ' stitches)';
                if (!$('vq-denom').dataset.touched) { $('vq-denom').value = state.denomStandard; $('vq-denom-out').value = state.denomStandard.toFixed(2); }
                $('vq-denom-note').textContent = 'Standard: ' + state.denomStandard.toFixed(2) + ' (' + pct(1 - state.denomStandard) + ' garment margin)';
            }
            line.status = 'ok';
            renderLines();
            render();
            loadStock(line);
        } catch (err) {
            console.error('[volume-quote] style load failed:', err);
            line.status = 'error: ' + err.message;
            renderLines();
            render();
        }
    }

    async function loadStock(line) {
        try {
            const inv = await DashPage.fetchJson('/api/sanmar/inventory/' + encodeURIComponent(line.data.style));
            const byColor = {};
            (inv.inventory || []).forEach((r) => { byColor[r.color] = (byColor[r.color] || 0) + (Number(r.totalQty) || 0); });
            const top = Object.entries(byColor).sort((a, b) => b[1] - a[1]).slice(0, 3);
            line.data.stock = { total: Number(inv.grandTotal) || 0, top };
        } catch (e) {
            line.data.stock = { error: true };
        }
        renderLines();
    }

    function fillLocations() {
        const sel = $('vq-location');
        sel.innerHTML = '';
        state.locations.forEach((l) => {
            const o = document.createElement('option');
            o.value = l.code; o.textContent = l.name; sel.appendChild(o);
        });
        sel.value = 'LC';
    }

    // ── events ─────────────────────────────────────────────────────────────

    function wireEvents() {
        $('vq-add-line').addEventListener('click', () => { addLine(); renderLines(); });
        ['vq-customer', 'vq-rep', 'vq-stitches', 'vq-design', 'vq-digitized', 'vq-valid-until', 'vq-hold-qty', 'vq-location', 'vq-emb-price']
            .forEach((id) => $(id).addEventListener('input', render));
        $('vq-denom').addEventListener('input', (e) => {
            e.target.dataset.touched = '1';
            $('vq-denom-out').value = Number(e.target.value).toFixed(2);
            render();
        });
        $('vq-lines').addEventListener('input', (e) => {
            const row = e.target.closest('.vq-line'); if (!row) return;
            const line = state.lines.find((l) => l.id === Number(row.dataset.id)); if (!line) return;
            if (e.target.classList.contains('vq-line-qty')) { line.qty = Math.max(0, parseInt(e.target.value, 10) || 0); render(); }
        });
        $('vq-lines').addEventListener('change', (e) => {
            const row = e.target.closest('.vq-line'); if (!row) return;
            const line = state.lines.find((l) => l.id === Number(row.dataset.id)); if (!line) return;
            if (e.target.classList.contains('vq-line-style')) {
                line.style = e.target.value.trim();
                if (line.style) loadStyle(line); else { line.data = null; line.status = ''; renderLines(); render(); }
            }
        });
        $('vq-lines').addEventListener('click', (e) => {
            const btn = e.target.closest('.vq-line-remove'); if (!btn) return;
            const row = btn.closest('.vq-line');
            state.lines = state.lines.filter((l) => l.id !== Number(row.dataset.id));
            renderLines(); render();
        });
        $('vq-copy').addEventListener('click', async () => {
            try { await navigator.clipboard.writeText($('vq-memo').textContent); $('vq-copy').innerHTML = '<i class="fas fa-check"></i> Copied'; }
            catch (e) { DashPage.showError('Copy failed. Select the memo text and copy it manually.'); }
            setTimeout(() => { $('vq-copy').innerHTML = '<i class="fas fa-copy"></i> Copy'; }, 1500);
        });
        // Two print modes: the internal memo (cost + margin) and the customer sheet (prices only).
        // The body class picks which card survives @media print; cleared after the dialog closes.
        const printAs = (mode) => {
            document.body.classList.add('vq-mode-' + mode);
            window.print();
        };
        window.addEventListener('afterprint', () => document.body.classList.remove('vq-mode-memo', 'vq-mode-customer'));
        $('vq-print').addEventListener('click', () => printAs('memo'));
        $('vq-print-customer').addEventListener('click', () => printAs('customer'));
        $('vq-save').addEventListener('click', saveQuote);
    }

    // ── save to Quote Management (quote_sessions + quote_items, prefix VQ) ──────
    // Same-origin relays (/api/quote-sequence, /api/quote_sessions, /api/quote_items) —
    // the staff cookie authorises them. The row stores customer-safe fields only; the
    // internal rationale is kept in the first item's LogoSpecs (short JSON), never in Notes,
    // because Notes can surface on customer-facing quote views.
    async function saveQuote() {
        const r = compute();
        const btn = $('vq-save');
        const status = $('vq-save-status');
        const setStatus = (msg, cls) => { status.textContent = msg; status.className = 'vq-save-status' + (cls ? ' vq-save-status--' + cls : ''); };
        if (!r.rows.length) { setStatus('Add at least one style with a quantity.', 'error'); return; }
        const customer = $('vq-customer').value.trim();
        if (!customer) { setStatus('Enter the customer name first.', 'error'); return; }
        btn.disabled = true;
        setStatus('Saving…', '');
        try {
            const seqResp = await fetch('/api/quote-sequence/VQ');
            if (!seqResp.ok) throw new Error('quote number service returned ' + seqResp.status);
            const seq = await seqResp.json();
            const quoteId = seq.prefix + '-' + seq.year + '-' + String(seq.sequence).padStart(3, '0');
            const now = new Date().toISOString().replace(/\.\d{3}Z$/, '');
            const validUntil = $('vq-valid-until').value;
            const locSel = $('vq-location');
            const locCode = locSel.value || 'LC';
            const locName = locSel.options.length ? locSel.options[locSel.selectedIndex].textContent : 'Left Chest';
            const hold = parseInt($('vq-hold-qty').value, 10) || r.qty;
            const design = $('vq-design').value.trim();
            const session = {
                QuoteID: quoteId,
                SessionID: 'volume_quote_' + Date.now(),
                CustomerName: customer,
                CompanyName: customer,
                CustomerEmail: '',
                SalesRepName: $('vq-rep').value.trim(),
                // The rep's real email, not sales@ (2026-09-05): Mission Control's Pipeline tab
                // attributes quotes by SalesRepEmail, so Taneisha's $30,959 Braun NW volume
                // quote showed as "no quotes carry your name". Unknown names keep sales@.
                SalesRepEmail: repEmailFor($('vq-rep').value),
                TotalQuantity: r.qty,
                SubtotalAmount: Math.round(r.orderVol * 100) / 100,
                LTMFeeTotal: 0,
                TotalAmount: Math.round(r.orderVol * 100) / 100,
                Status: 'Open',
                CreatedAt_Quote: now,
                ExpiresAt: validUntil ? validUntil + 'T23:59:59' : '',
                PrintLocation: locName,
                StitchCount: r.stitches,
                DigitizingFee: 0,
                Notes: 'VOLUME QUOTE — one-time price approved by Erik Mickelson. Holds at ' + hold.toLocaleString() +
                       '+ pcs on one PO, ' + locName + ', ' + r.stitches.toLocaleString() + ' stitches' + (design ? ', design #' + design : '') +
                       (validUntil ? ', valid until ' + validUntil : '') + '. Standard price applies below that quantity.'
            };
            const sResp = await fetch('/api/quote_sessions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(session) });
            if (!sResp.ok) throw new Error('quote_sessions save returned ' + sResp.status);
            const internal = JSON.stringify({ vq: { emb: r.embVol, std: state.embStandard, denom: r.denomVol, hrs: r.cost ? +r.cost.hours.toFixed(1) : null, gm: r.gmTotal === null ? null : +r.gmTotal.toFixed(3), given: Math.round(r.orderStd - r.orderVol) } });
            let failed = 0;
            for (let i = 0; i < r.rows.length; i++) {
                const x = r.rows[i];
                const item = {
                    QuoteID: quoteId,
                    LineNumber: i + 1,
                    StyleNumber: x.d.style,
                    ProductName: x.d.title,
                    Color: '',
                    ColorCode: '',
                    EmbellishmentType: 'embroidery',
                    PrintLocation: locCode,
                    PrintLocationName: locName,
                    Quantity: x.line.qty,
                    HasLTM: 'No',
                    BaseUnitPrice: x.vol,
                    LTMPerUnit: 0,
                    FinalUnitPrice: x.vol,
                    LineTotal: Math.round(x.vol * x.line.qty * 100) / 100,
                    SizeBreakdown: JSON.stringify({ upcharges: { '2XL': x.vol2, '3XL': x.vol3 }, standard: x.std }),
                    PricingTier: 'Volume (one-time)',
                    ImageURL: '',
                    AddedAt: now,
                    LogoSpecs: i === 0 ? internal : ''
                };
                const iResp = await fetch('/api/quote_items', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(item) });
                if (!iResp.ok) failed++;
            }
            if (failed) throw new Error(quoteId + ' saved but ' + failed + ' of ' + r.rows.length + ' line items failed — open it in Quote Management and check');
            state.savedQuoteId = quoteId;
            setStatus('Saved as ' + quoteId + ' — visible in Quote Management.', 'ok');
            render();
        } catch (err) {
            console.error('[volume-quote] save failed:', err);
            setStatus('Not saved: ' + err.message, 'error');
            DashPage.showError('Quote not saved: ' + err.message);
        } finally {
            btn.disabled = false;
        }
    }

    function addLine() {
        state.lines.push({ id: nextLineId++, style: '', qty: 0, data: null, status: '' });
    }

    // ── math ───────────────────────────────────────────────────────────────

    function roundPrice(p) {
        if (!isFinite(p)) return null;
        if (state.rounding === 'CeilDollar') return Math.ceil(p);
        return p % 0.5 === 0 ? p : Math.ceil(p * 2) / 2;
    }

    function extraStitchCharge(stitches, row) {
        const base = Number(row.BaseStitchCount) || 8000;
        const inc = Number(row.StitchIncrement) || 1000;
        const rate = Number(row.AdditionalStitchRate) || 0;
        if (stitches <= base) return 0;
        return Math.ceil((stitches - base) / inc) * rate;
    }

    function compute() {
        const stitches = Math.max(100, parseInt($('vq-stitches').value, 10) || 0);
        const embVol = Math.max(0, parseFloat($('vq-emb-price').value) || 0);
        const denomVol = parseFloat($('vq-denom').value) || state.denomStandard || 0.53;
        const lines = state.lines.filter((l) => l.data && l.qty > 0);
        const qty = lines.reduce((s, l) => s + l.qty, 0);

        let cost = null;
        if (state.config && qty > 0) {
            const c = state.config;
            // Typical: the fitted production-log model, run time scaled by the logo; handling keeps
            // a floor at half the base minutes.
            const stitchFactor = Math.max(0.5, stitches / c.stitchBase);
            const minTypical = c.minPerPc * stitchFactor;
            const hoursTypical = (c.setupMin + minTypical * qty) / 60;
            // Worst case: smallest machine, real sewing speed, handling, and slack on everything.
            const slack = 1 + c.slackPct / 100;
            const minWorst = (stitches / (c.spm * c.headsWorst) + c.handling) * slack;
            const hoursWorst = (c.setupMin * slack + minWorst * qty) / 60;
            // The number the page prices against is whichever is worse.
            const minUsed = Math.max(minTypical, minWorst);
            const hours = Math.max(hoursTypical, hoursWorst);
            const total = hours * c.hourRate + c.orderCost;
            const totalTypical = hoursTypical * c.hourRate + c.orderCost;
            cost = {
                hours, total, perPc: total / qty, stitchFactor,
                minPerPcActual: minUsed, minTypical, minWorst, hoursTypical, hoursWorst,
                perPcTypical: totalTypical / qty, slack
            };
        }
        const decoPerPc = cost ? cost.perPc : 0;

        const rows = lines.map((l) => {
            const d = l.data;
            const extra = extraStitchCharge(stitches, d.costRow);
            const std = roundPrice(d.caseCost / d.denom + d.embCost + extra);
            const vol = roundPrice(d.caseCost / denomVol + embVol + extra);
            const gm = vol > 0 ? (vol - d.caseCost - decoPerPc) / vol : 0;
            return {
                line: l, d, extra, std, vol,
                std2: d.up2xl === null ? null : std + d.up2xl, std3: d.up3xl === null ? null : std + d.up3xl,
                vol2: d.up2xl === null ? null : vol + d.up2xl, vol3: d.up3xl === null ? null : vol + d.up3xl,
                garmentMargin: d.caseCost / denomVol - d.caseCost,
                garmentMarginStd: d.caseCost / d.denom - d.caseCost,
                gm, orderStd: std * l.qty, orderVol: vol * l.qty
            };
        });
        const orderStd = rows.reduce((s, r) => s + r.orderStd, 0);
        const orderVol = rows.reduce((s, r) => s + r.orderVol, 0);
        const garmentCost = rows.reduce((s, r) => s + r.d.caseCost * r.line.qty, 0);
        const gmTotal = orderVol > 0 && cost ? (orderVol - garmentCost - cost.total) / orderVol : null;
        return { stitches, embVol, denomVol, qty, cost, rows, orderStd, orderVol, garmentCost, gmTotal };
    }

    // ── render ─────────────────────────────────────────────────────────────

    // Rows are updated IN PLACE: a style finishing its load (or its stock check) must not
    // rebuild the inputs of the other rows, or it wipes whatever the user is typing there.
    function renderLines() {
        const root = $('vq-lines');
        const keep = new Set(state.lines.map((l) => String(l.id)));
        [...root.querySelectorAll('.vq-line')].forEach((row) => { if (!keep.has(row.dataset.id)) row.remove(); });
        state.lines.forEach((l) => {
            let row = root.querySelector('.vq-line[data-id="' + l.id + '"]');
            if (!row) {
                row = document.createElement('div');
                row.className = 'vq-line';
                row.dataset.id = l.id;
                row.innerHTML =
                    '<input type="text" class="vq-line-style" value="' + esc(l.style) + '" placeholder="1566" autocomplete="off">' +
                    '<input type="number" class="vq-line-qty" min="0" step="1" value="' + (l.qty || '') + '" placeholder="500">' +
                    '<div class="vq-line-info"></div><div class="vq-line-info"></div><div class="vq-line-info"></div>' +
                    '<button type="button" class="vq-line-remove" title="Remove"><i class="fas fa-times"></i></button>';
                root.appendChild(row);
            }
            const d = l.data;
            let title = '', cost = '', stock = '';
            if (d) {
                title = '<div class="vq-line-title">' + esc(d.title) + (d.brand ? '<small>' + esc(d.brand) + '</small>' : '') + '</div>';
                cost = '<div class="vq-line-cost">' + money(d.caseCost) + (d.pieceCost !== null ? ' <small>/ ' + money(d.pieceCost) + ' piece</small>' : '') + '</div>';
                if (d.stock === null) stock = '<span class="vq-line-stock">checking…</span>';
                else if (d.stock.error) stock = '<span class="vq-line-stock vq-line-status--error">stock check failed</span>';
                else stock = '<span class="vq-line-stock">' + d.stock.total.toLocaleString() + ' total' +
                    (d.stock.top.length ? '<br>' + d.stock.top.map((t) => esc(t[0]) + ' ' + t[1].toLocaleString()).join(' · ') : '') + '</span>';
            } else if (l.status) {
                const isErr = l.status.startsWith('error');
                title = '<span class="vq-line-status' + (isErr ? ' vq-line-status--error' : '') + '">' + esc(isErr ? l.status.slice(7) : 'Loading…') + '</span>';
            }
            const cells = row.querySelectorAll('.vq-line-info');
            cells[0].innerHTML = title;
            cells[1].innerHTML = cost;
            cells[2].innerHTML = stock;
        });
    }

    function render() {
        const r = compute();
        const c = state.config;

        $('st-qty').textContent = r.qty.toLocaleString();
        $('st-hours').textContent = r.cost ? r.cost.hours.toFixed(1) : (c ? '0' : 'n/a');
        $('st-deco-cost').textContent = r.cost ? money(r.cost.perPc) : (c ? '$0' : 'n/a');
        $('st-order-list').textContent = money0(r.orderStd);
        $('st-order-vol').textContent = money0(r.orderVol);
        $('st-given').textContent = money0(r.orderStd - r.orderVol);
        $('st-gm').textContent = r.gmTotal === null ? (c ? '0%' : 'n/a') : pct(r.gmTotal);

        const warn = [];
        if (c && r.qty > 0 && r.qty < c.minQty) warn.push({ t: 'Only ' + r.qty + ' pieces. A one-time price is meant for ' + c.minQty + '+ pieces on one PO; below that the standard tiers already apply.', d: false });
        if (c && r.gmTotal !== null && r.gmTotal < c.minGm) warn.push({ t: 'Gross margin ' + pct(r.gmTotal) + ' is under the ' + pct(c.minGm) + ' floor (VOL-MIN-GM).', d: true });
        if (state.embStandard !== null && r.embVol > state.embStandard) warn.push({ t: 'Embroidery charge is above the standard ' + money(state.embStandard) + '.', d: false });
        if (state.stitchRow && r.stitches > Number(state.stitchRow.BaseStitchCount)) warn.push({ t: 'Logo is over the ' + Number(state.stitchRow.BaseStitchCount).toLocaleString() + '-stitch base: the standard extra-stitch charge is included in both prices.', d: false });
        $('vq-warnings').innerHTML = warn.map((w) => '<div class="vq-warning' + (w.d ? ' vq-warning--danger' : '') + '">' + esc(w.t) + '</div>').join('');

        const tb = $('vq-result').querySelector('tbody');
        const tf = $('vq-result').querySelector('tfoot');
        tb.innerHTML = r.rows.map((x) =>
            '<tr><td>' + esc(x.d.style) + '<br><small>' + esc(x.d.title) + '</small></td>' +
            '<td class="vq-num">' + x.line.qty.toLocaleString() + '</td>' +
            '<td class="vq-num">' + money(x.d.caseCost) + '</td>' +
            '<td class="vq-num">' + money(x.std) + sizeTail(x.std2, x.std3) + '</td>' +
            '<td class="vq-num vq-vol">' + money(x.vol) + sizeTail(x.vol2, x.vol3) + '</td>' +
            '<td class="vq-num">' + money(x.garmentMargin) + '<br><small>std ' + money(x.garmentMarginStd) + '</small></td>' +
            '<td class="vq-num' + (c && x.gm < c.minGm ? ' vq-gm-low' : '') + '">' + (c ? pct(x.gm) : 'n/a') + '</td>' +
            '<td class="vq-num">' + money0(x.orderStd) + ' / ' + money0(x.orderVol) + '</td></tr>'
        ).join('');
        tf.innerHTML = r.rows.length ? '<tr><td>Total</td><td class="vq-num">' + r.qty.toLocaleString() + '</td><td></td><td></td><td></td><td></td>' +
            '<td class="vq-num">' + (r.gmTotal === null ? 'n/a' : pct(r.gmTotal)) + '</td><td class="vq-num">' + money0(r.orderStd) + ' / ' + money0(r.orderVol) + '</td></tr>' : '';

        $('vq-model-note').textContent = c
            ? 'Cost model (Service_Codes VOL-*): $' + c.hourRate.toFixed(2) + '/machine hour, $' + c.orderCost.toFixed(0) + ' per order. ' +
              'WORST CASE = ' + c.headsWorst + '-head machine at ' + c.spm + ' spm + ' + c.handling.toFixed(1) + ' min handling/pc, everything +' + c.slackPct + '% slack' +
              (r.cost ? ' → ' + r.cost.minWorst.toFixed(2) + ' min/pc, ' + r.cost.hoursWorst.toFixed(1) + ' h, ' + money(r.cost.perPc) + '/pc' : '') +
              '. Typical (fitted from production logs) = ' + c.minPerPc.toFixed(2) + ' min/pc at ' + c.stitchBase.toLocaleString() + ' stitches' +
              (r.cost ? ' → ' + r.cost.minTypical.toFixed(2) + ' min/pc, ' + r.cost.hoursTypical.toFixed(1) + ' h, ' + money(r.cost.perPcTypical) + '/pc' : '') +
              '. Margins use the worse of the two. GM % = (price − case cost − decoration cost/pc) ÷ price. Setup fee, tax and freight are not included.'
            : 'Cost model unavailable: ' + (state.configError || 'loading');

        $('vq-memo').textContent = buildMemo(r);
        renderCustomerQuote(r);
    }

    // The customer sheet: prices, quantities and terms only. Never cost, margin or levers.
    function renderCustomerQuote(r) {
        const customer = $('vq-customer').value.trim() || '(customer)';
        const rep = $('vq-rep').value.trim();
        const locSel = $('vq-location');
        const loc = locSel.options.length ? locSel.options[locSel.selectedIndex].textContent : 'Left Chest';
        const design = $('vq-design').value.trim();
        const validUntil = $('vq-valid-until').value;
        const hold = parseInt($('vq-hold-qty').value, 10) || r.qty;
        const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        const validText = validUntil ? new Date(validUntil + 'T12:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '(date)';

        $('vq-cq-meta').innerHTML = 'Quote # <strong>' + esc(state.savedQuoteId || 'not saved yet') + '</strong><br>' +
            'Date: ' + esc(today) + '<br>Valid until: ' + esc(validText);
        $('vq-cq-parties').innerHTML =
            '<div><h4>Prepared for</h4><div>' + esc(customer) + '</div></div>' +
            '<div><h4>Your sales representative</h4><div>' + esc(rep || 'Northwest Custom Apparel') + '<br><small>253-922-5793 · sales@nwcustomapparel.com</small></div></div>';

        const rows = $('vq-cq-rows');
        const foot = $('vq-cq-foot');
        if (!r.rows.length) {
            rows.innerHTML = '<tr><td colspan="7" class="vq-cq-empty">Add a style and a quantity to build the quote.</td></tr>';
            foot.innerHTML = '';
        } else {
            rows.innerHTML = r.rows.map((x) =>
                '<tr><td>' + esc(x.d.style) + '</td><td>' + esc(x.d.title) + '<br><small>' + esc(loc) + ' embroidery included</small></td>' +
                '<td class="vq-num">' + x.line.qty.toLocaleString() + '</td>' +
                '<td class="vq-num">' + money(x.vol) + '</td>' +
                '<td class="vq-num">' + (x.vol2 === null ? '—' : money(x.vol2)) + '</td>' +
                '<td class="vq-num">' + (x.vol3 === null ? '—' : money(x.vol3)) + '</td>' +
                '<td class="vq-num">' + money(x.orderVol) + '</td></tr>'
            ).join('');
            foot.innerHTML = '<tr><td colspan="2">Estimated total (S–XL pricing, before tax and freight)</td><td class="vq-num">' + r.qty.toLocaleString() + '</td><td></td><td></td><td></td><td class="vq-num">' + money(r.orderVol) + '</td></tr>';
        }

        $('vq-cq-decoration').innerHTML = '<h4>Decoration</h4><div>' + esc(loc) + ' embroidery, ' + r.stitches.toLocaleString() + ' stitches' +
            (design ? ', design #' + esc(design) : '') + '. ' + ($('vq-digitized').checked ? 'Digitizing on file, no setup fee.' : 'Digitizing/setup billed separately.') + '</div>';

        $('vq-cq-terms').innerHTML = [
            'Volume pricing for this order only. It applies to ' + hold.toLocaleString() + ' or more pieces on a single purchase order for the decoration shown; smaller orders are quoted at our standard pricing.',
            'Prices are per piece, S–XL; 2XL and 3XL as listed. Estimated total uses S–XL pricing; the invoice reflects the actual size run.',
            'Washington sales tax and freight are additional. Subject to garment availability at the time the order is placed.',
            'Pricing is valid through ' + validText + '.'
        ].map((t) => '<li>' + esc(t) + '</li>').join('');
    }

    function sizeTail(p2, p3) {
        if (p2 === null && p3 === null) return '';
        return '<br><small>' + (p2 === null ? '—' : money(p2)) + ' / ' + (p3 === null ? '—' : money(p3)) + '</small>';
    }

    function buildMemo(r) {
        if (!r.rows.length) return 'Add a style and a quantity to build the memo.';
        const c = state.config;
        const customer = $('vq-customer').value.trim() || '(customer)';
        const rep = $('vq-rep').value.trim() || '(rep)';
        const locSel = $('vq-location');
        const loc = locSel.options.length ? locSel.options[locSel.selectedIndex].textContent : 'Left Chest';
        const design = $('vq-design').value.trim();
        const digitized = $('vq-digitized').checked;
        const validUntil = $('vq-valid-until').value || '(date)';
        const hold = parseInt($('vq-hold-qty').value, 10) || r.qty;
        const base = state.stitchRow ? Number(state.stitchRow.BaseStitchCount) : 8000;
        const share = Math.round(100 * r.stitches / base);
        const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        const L = [];
        L.push('ONE-TIME VOLUME PRICE — APPROVAL MEMO (INTERNAL — do not send to the customer)');
        L.push('Northwest Custom Apparel · ' + today + (state.savedQuoteId ? ' · Quote # ' + state.savedQuoteId : ' · not saved yet'));
        L.push('');
        L.push('Customer:     ' + customer);
        L.push('Sales rep:    ' + rep);
        L.push('Approved by:  Erik Mickelson');
        L.push('Order:        ' + r.qty.toLocaleString() + ' pieces, ' + loc + ' embroidery, ' + r.stitches.toLocaleString() + ' stitches' + (design ? ', design #' + design : ''));
        L.push('');
        L.push('WHY THIS PRICE IS OFFERED ONCE');
        const topTier = r.rows[0].d.tierLabel;
        const topMin = parseInt(topTier, 10) || 72;
        L.push('1. Quantity. ' + r.qty.toLocaleString() + ' pieces on a single PO is ' + (r.qty / topMin).toFixed(1) + 'x the top published tier (' +
               topTier + '). One setup, one thread change, one continuous run.');
        L.push('2. Logo size. ' + r.stitches.toLocaleString() + ' stitches is ' + share + '% of the ' + base.toLocaleString() + '-stitch base our embroidery charge is built on' +
               (r.cost ? '. At ' + c.spm + ' stitches/min that is ' + (r.stitches / c.spm).toFixed(1) + ' minutes of sewing per head.' : '.'));
        if (r.cost) {
            L.push('3. Production cost, WORST CASE. Priced as if the job runs on the ' + c.headsWorst + '-head machine with ' + c.handling.toFixed(1) +
                   ' min handling per piece and ' + c.slackPct + '% slack for thread breaks, rehoops and downtime: ' + r.cost.minWorst.toFixed(1) + ' min/pc, ' +
                   r.cost.hoursWorst.toFixed(1) + ' machine hours, decoration cost about ' + money(r.cost.perPc) + ' per piece against ' + money(r.embVol) +
                   ' charged. Typical run from our production logs would be ' + r.cost.minTypical.toFixed(1) + ' min/pc (' + money(r.cost.perPcTypical) +
                   '/pc). Gross margin on the order at the worst case: ' + pct(r.gmTotal) + '.');
        }
        L.push((r.cost ? '4' : '3') + '. Setup. ' + (digitized ? 'Logo is already digitized; no setup fee.' : 'Digitizing/setup is billed separately at the standard rate.'));
        L.push('');
        L.push('STANDARD (72+) vs ONE-TIME PRICE, per piece');
        r.rows.forEach((x) => {
            L.push('  ' + x.d.style.padEnd(10) + ' ' + String(x.line.qty).padStart(5) + ' pcs   standard ' + money(x.std).padStart(8) + '   one-time ' + money(x.vol).padStart(8) +
                   (x.vol2 !== null ? '   (2XL ' + money(x.vol2) + (x.vol3 !== null ? ', 3XL ' + money(x.vol3) : '') + ')' : ''));
        });
        L.push('  Order value: standard ' + money0(r.orderStd) + ' · one-time ' + money0(r.orderVol) + ' · difference ' + money0(r.orderStd - r.orderVol));
        L.push('  Levers: embroidery ' + money(r.embVol) + '/pc (standard ' + (state.embStandard === null ? '—' : money(state.embStandard)) + ')' +
               ', garment markup denominator ' + r.denomVol.toFixed(2) + ' (standard ' + (state.denomStandard === null ? '—' : state.denomStandard.toFixed(2)) + ')');
        L.push('');
        L.push('TERMS');
        L.push('- Valid until ' + validUntil + '. Price holds only at ' + hold.toLocaleString() + ' or more pieces on ONE purchase order, this design, this location.');
        L.push('- This is a one-time price for this order, not a new price list. Reorders below ' + hold.toLocaleString() + ' pieces return to the standard tiers.');
        L.push('- Garment prices are S-XL; 2XL/3XL carry the standard upcharges. Sales tax and freight are extra. Subject to SanMar stock at time of order.');
        return L.join('\n');
    }

    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
    }
})();
