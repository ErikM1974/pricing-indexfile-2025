/**
 * custom-stickers.js — controller for the public /custom-stickers page.
 *
 * 🔴 ONE BOOT FETCH, THEN ZERO PRICING CALLS. Every size in the grid arrives in
 * the single GET /api/sticker-pricing, so changing size re-prices all ten
 * quantity rows from memory with no network at all — Sticker Mule's
 * one-call-ten-prices behaviour with no infrastructure. NEVER call
 * /sticker-pricing/quote from a change handler: five sizes tabbed through would
 * be five Caspio calls, and this page is public.
 *
 * 🔴 NO CLIENT-SIDE PRICE MATH. unitPrice and savingsPct come from the server.
 * This file selects and formats; it never computes a price. Rendering decisions
 * live in the pure custom-stickers-ladder.js so they can be unit-tested.
 *
 * 🔴 NO CACHING HERE. No localStorage, no grid baked into the HTML — that would
 * be a fourth copy of the money and reopens the silent-stale hole Rule 4
 * forbids. Caching belongs on the proxy (15-min TTL, Caspio-verified only).
 */
(function () {
    'use strict';

    var L = window.StickerLadder;

    // Default: 3×3 @ 100. Our strongest cell against the competition AND the
    // server's own best-value knee, so the default row wears the badge.
    var DEFAULT_SIZE = '3x3';
    var DEFAULT_QTY = 100;

    var CUSTOM_SIZE = '__custom__';
    var CUSTOM_QTY = '__custom__';

    var state = {
        grid: null,
        setupFee: null,
        size: DEFAULT_SIZE,
        qty: DEFAULT_QTY,
        sizeMode: 'standard',   // 'standard' | 'custom'
        qtyMode: 'standard',
        customW: '',
        customH: '',
        customQty: '',
        setupAnswer: null,      // null | 'reorder' | 'new'   (null = unanswered)
        resolved: null,         // the row currently priced, or null
        blocked: null           // { reason, message } when we must NOT show a price
    };

    function byId(id) { return document.getElementById(id); }

    function apiBase() {
        if (window.APP_CONFIG && window.APP_CONFIG.API && window.APP_CONFIG.API.BASE_URL) {
            return window.APP_CONFIG.API.BASE_URL.replace(/\/+$/, '');
        }
        return null;
    }

    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    function toast(msg) {
        var el = byId('stkToast');
        el.textContent = msg;
        el.classList.add('is-up');
        clearTimeout(el._t);
        el._t = setTimeout(function () { el.classList.remove('is-up'); }, 2600);
    }

    // ── Boot ──────────────────────────────────────────────────────────
    function fatal(msg) {
        var a = byId('stkAlert');
        if (msg) a.querySelector('strong').textContent = msg;
        a.hidden = false;
        byId('configurator').hidden = true;
        byId('stkBar').hidden = true;
    }

    async function boot() {
        var base = apiBase();
        if (!base) {
            // Never fall back to a host literal — the no-hardcoded-hosts ratchet
            // exists precisely to stop that, and a wrong host means wrong prices.
            fatal('Configuration failed to load.');
            return;
        }
        try {
            var r = await fetch(base + '/api/sticker-pricing');
            if (!r.ok) throw new Error('HTTP ' + r.status);
            var data = await r.json();
            if (!data || !Array.isArray(data.grid) || !data.grid.length) throw new Error('empty grid');

            state.grid = data.grid;
            state.setupFee = data.setupFee || null;

            // Rule 4: prices from the backup card are allowed, but only WITH a
            // visible warning. The API answers 200 either way.
            if (data.source !== 'caspio' || data.degraded) byId('stkWarn').hidden = false;

            readUrl();
            renderSizes();
            wire();
            render();
        } catch (e) {
            console.error('[custom-stickers] pricing load failed:', e);
            fatal();
        }
    }

    // ── URL state (the link IS the quote) ─────────────────────────────
    function readUrl() {
        var p = new URLSearchParams(location.search);
        var size = p.get('size');
        var qty = parseInt(p.get('qty'), 10);
        var w = p.get('w');
        var h = p.get('h');

        if (w && h) {
            state.sizeMode = 'custom';
            state.customW = w;
            state.customH = h;
            byId('stkW').value = w;
            byId('stkH').value = h;
        } else if (size && L.sizesIn(state.grid).indexOf(size) >= 0) {
            state.size = size;
        }
        if (qty && qty > 0) {
            var rows = L.rowsForSize(state.grid, state.size);
            var exact = rows.some(function (r) { return r.Quantity === qty; });
            if (exact) {
                state.qty = qty;
            } else {
                state.qtyMode = 'custom';
                state.customQty = String(qty);
                byId('stkCustomQty').value = qty;
            }
        }
    }

    function writeUrl() {
        var p = new URLSearchParams();
        if (state.sizeMode === 'custom') {
            if (state.customW) p.set('w', state.customW);
            if (state.customH) p.set('h', state.customH);
        } else {
            p.set('size', state.size);
        }
        var q = state.qtyMode === 'custom' ? state.customQty : state.qty;
        if (q) p.set('qty', q);
        // replaceState, never pushState — configuring a quote should not fill
        // the back button with twenty history entries.
        history.replaceState(null, '', location.pathname + '?' + p.toString());
    }

    // ── Size control ──────────────────────────────────────────────────
    function renderSizes() {
        var sizes = L.sizesIn(state.grid);
        var html = sizes.map(function (s) {
            var rows = L.rowsForSize(state.grid, s);
            var from = rows.length ? rows[0] : null;
            return '<li><label class="stk-size-row">' +
                '<input type="radio" name="stkSize" value="' + esc(s) + '"' +
                (state.sizeMode === 'standard' && state.size === s ? ' checked' : '') + '>' +
                '<span class="stk-size-label">' + esc(L.formatSize(s)) + '</span>' +
                (from ? '<span class="stk-size-from">From $' + L.formatMoney(from.TotalPrice) + ' / ' + L.formatInt(from.Quantity) + '</span>' : '') +
                '</label></li>';
        }).join('');

        html += '<li><label class="stk-size-row">' +
            '<input type="radio" name="stkSize" value="' + CUSTOM_SIZE + '"' +
            (state.sizeMode === 'custom' ? ' checked' : '') + '>' +
            '<span class="stk-size-label">My design isn\'t square</span>' +
            '<span class="stk-size-from">Enter your exact size</span>' +
            '</label></li>';

        byId('stkSizes').innerHTML = html;
        byId('stkCustomDims').classList.toggle('is-open', state.sizeMode === 'custom');
    }

    /**
     * Work out what the customer is actually buying. Applies the same rules the
     * server applies (bounding box up, quantity up) and then LOOKS THE ANSWER UP
     * in the fetched grid — it computes no price of its own.
     */
    function resolve() {
        state.blocked = null;
        state.resolved = null;

        var size = state.size;
        var sizeInfo = null;

        if (state.sizeMode === 'custom') {
            sizeInfo = L.resolveSize(state.grid, state.customW, state.customH);
            if (!sizeInfo.ok) {
                state.blocked = sizeInfo.reason === 'oversize'
                    ? { reason: 'oversize' }
                    : { reason: 'incomplete' };
                return;
            }
            size = sizeInfo.size;
        }
        state.effectiveSize = size;
        state.sizeInfo = sizeInfo;

        var qtyReq = state.qtyMode === 'custom' ? state.customQty : state.qty;
        var qtyInfo = L.resolveQty(state.grid, size, qtyReq);
        if (!qtyInfo.ok) {
            if (qtyInfo.reason === 'below_minimum') {
                state.blocked = {
                    reason: 'below_minimum',
                    message: 'We print in runs of ' + qtyInfo.minimum + ' or more — ' + qtyInfo.minimum +
                        ' ' + L.formatSize(size) + ' stickers is $' + L.formatMoney(qtyInfo.minimumRow.TotalPrice) +
                        '. Need fewer? Call (253) 922-5793 and we\'ll tell you straight away whether we can do it.'
                };
            } else if (qtyInfo.reason === 'above_maximum') {
                state.blocked = {
                    reason: 'above_maximum',
                    message: 'Over ' + L.formatInt(qtyInfo.maximum) + ' we price it individually. Tell us the size and quantity and we\'ll come back with a number.'
                };
            } else {
                state.blocked = { reason: 'incomplete' };
            }
            return;
        }
        state.qtyInfo = qtyInfo;
        state.resolved = L.selectRow(state.grid, size, qtyInfo.quantity);
        if (!state.resolved) state.blocked = { reason: 'incomplete' };
    }

    // ── Render ────────────────────────────────────────────────────────
    function render() {
        resolve();
        writeUrl();

        var oversize = state.blocked && state.blocked.reason === 'oversize';
        byId('stkOversize').hidden = !oversize;
        byId('stkQtyBlock').hidden = oversize;
        byId('stkCustomDims').classList.toggle('is-open', state.sizeMode === 'custom');
        byId('stkCustomQtyWrap').classList.toggle('is-open', state.qtyMode === 'custom');

        renderSizeNote();
        if (oversize) { renderBar(); return; }

        renderLadder();
        renderQtyNote();
        renderPrice();
        renderSetup();
        renderNudge();
        renderRateCard();
        renderFigure();
        renderBar();
    }

    function renderSizeNote() {
        var el = byId('stkSizeNote');
        var info = state.sizeInfo;
        if (state.sizeMode !== 'custom' || !info || !info.ok) { el.hidden = true; return; }

        var asked = info.requested.width + ' × ' + info.requested.height;
        var tier = L.formatSize(info.size).replace(' in', '');
        var msg = 'A ' + asked + ' in design prices at our ' + tier + ' tier.';
        if (info.canUpgrade) {
            msg += ' You can go up to a full ' + tier + ' at no extra cost.';
        }
        el.textContent = msg;
        el.className = 'stk-inline-note' + (info.canUpgrade ? ' is-upgrade' : '');
        el.hidden = false;
    }

    function renderLadder() {
        var size = state.effectiveSize;
        var selected = state.resolved ? state.resolved.quantity : null;
        var rows = L.ladderFor(state.grid, size, selected);

        var tbody = byId('stkLadder').querySelector('tbody');
        tbody.innerHTML = rows.map(function (r) {
            var badge = r.savingsPct != null ? 'Save ' + r.savingsPct + '%' : '';
            var best = r.isBestValue ? '<span class="stk-l-best">Best value</span>' : '';
            var label = L.formatInt(r.quantity) + ' stickers, $' + L.formatMoney(r.totalPrice) +
                (r.savingsPct != null ? ', save ' + r.savingsPct + ' percent' : '');
            return '<tr class="' + (r.isSelected && state.qtyMode === 'standard' ? 'is-selected' : '') + '" data-qty="' + r.quantity + '">' +
                '<td class="stk-l-radio"><input type="radio" name="stkQty" value="' + r.quantity + '"' +
                (r.isSelected && state.qtyMode === 'standard' ? ' checked' : '') +
                ' aria-label="' + esc(label) + '"></td>' +
                '<td class="stk-l-qty">' + L.formatInt(r.quantity) + '</td>' +
                '<td class="stk-l-price">$' + L.formatMoney(r.totalPrice) + '</td>' +
                '<td class="stk-l-save" aria-hidden="true">' + badge + best + '</td>' +
                '</tr>';
        }).join('') +
            '<tr data-qty="' + CUSTOM_QTY + '" class="' + (state.qtyMode === 'custom' ? 'is-selected' : '') + '">' +
            '<td class="stk-l-radio"><input type="radio" name="stkQty" value="' + CUSTOM_QTY + '"' +
            (state.qtyMode === 'custom' ? ' checked' : '') + ' aria-label="A different quantity"></td>' +
            '<td colspan="3" class="stk-l-qty">A different quantity</td></tr>';

        // Mobile: price + savings ride in the option label, since the table is
        // hidden below 900px.
        byId('stkQtySelect').innerHTML = rows.map(function (r) {
            return '<option value="' + r.quantity + '"' +
                (r.isSelected && state.qtyMode === 'standard' ? ' selected' : '') + '>' +
                esc(L.formatInt(r.quantity) + ' stickers — $' + L.formatMoney(r.totalPrice) +
                    (r.savingsPct != null ? ' — Save ' + r.savingsPct + '%' : '')) +
                '</option>';
        }).join('');
    }

    function renderQtyNote() {
        var el = byId('stkQtyNote');
        if (state.blocked && state.blocked.message) {
            el.textContent = state.blocked.message;
            el.className = 'stk-inline-note is-error';
            el.hidden = false;
            return;
        }
        if (state.qtyInfo && state.qtyInfo.wasRounded && state.resolved) {
            el.textContent = L.formatInt(state.qtyInfo.requested) + ' stickers price at our ' +
                L.formatInt(state.resolved.quantity) + ' tier — $' + L.formatMoney(state.resolved.totalPrice) +
                ' (≈ $' + L.formatUnit(state.resolved.unitPrice) + ' each).';
            el.className = 'stk-inline-note';
            el.hidden = false;
            return;
        }
        el.hidden = true;
    }

    function renderPrice() {
        var total = byId('stkTotal');
        var unit = byId('stkUnit');
        var cta = byId('stkCta');
        var ladder = byId('stkLadder');

        if (!state.resolved) {
            // A dash, not $0 — we don't know the price, and saying zero implies
            // we do.
            total.textContent = '—';
            unit.textContent = '';
            cta.disabled = true;
            cta.setAttribute('aria-disabled', 'true');
            ladder.classList.toggle('is-disabled', state.blocked && state.blocked.reason === 'incomplete');
            return;
        }
        ladder.classList.remove('is-disabled');
        total.textContent = '$' + L.formatMoney(state.resolved.totalPrice);
        unit.textContent = '≈ $' + L.formatUnit(state.resolved.unitPrice) + ' per sticker';
        cta.disabled = false;
        cta.removeAttribute('aria-disabled');
    }

    function renderSetup() {
        var el = byId('stkSetupLine');
        var fee = state.setupFee ? state.setupFee.amount : null;
        if (fee == null) { el.textContent = ''; return; }

        if (state.setupAnswer === 'reorder') {
            el.innerHTML = '<span class="stk-setup-total">No setup fee</span> — we already have your design on file.';
        } else if (state.setupAnswer === 'new' && state.resolved) {
            el.innerHTML = '<span class="stk-setup-total">+ $' + L.formatMoney(fee) + ' one-time art setup</span> — ' +
                'your mockup, a print-readiness check on the die line, and up to 2 rounds of revisions. ' +
                'Estimated total <span class="stk-setup-total">$' + L.formatMoney(state.resolved.totalPrice + fee) + '</span>. ' +
                'Pay it once — every reorder of this design is $0 setup, forever.';
        } else {
            // Unanswered: no "estimated total" appears, so the headline number
            // stays the sticker price rather than opening at price-plus-fee.
            el.innerHTML = 'A one-time $' + L.formatMoney(fee) + ' art setup applies to new designs. ' +
                'Pay it once — every reorder of that design is $0 setup, forever.';
        }
    }

    function renderNudge() {
        var el = byId('stkNudge');
        if (!state.resolved || state.qtyMode === 'custom') { el.hidden = true; return; }
        var n = L.nudgeFrom(state.grid, state.effectiveSize, state.resolved.quantity);
        if (!n) { el.hidden = true; return; }
        el.textContent = L.formatInt(n.quantity) + ' stickers is $' + L.formatMoney(n.totalPrice) +
            ' — ≈ $' + L.formatUnit(n.unitPrice) + ' each instead of ≈ $' + L.formatUnit(n.fromUnitPrice) + '.';
        el.hidden = false;
    }

    function renderBar() {
        var bar = byId('stkBar');
        if (!state.resolved) { bar.hidden = true; return; }
        bar.hidden = false;
        byId('stkBarTotal').textContent = '$' + L.formatMoney(state.resolved.totalPrice);
        byId('stkBarDetail').textContent = L.formatInt(state.resolved.quantity) + ' × ' +
            L.formatSize(state.resolved.size) + ' · ≈ $' + L.formatUnit(state.resolved.unitPrice) + ' each';
    }

    function renderRateCard() {
        var host = byId('stkRates');
        if (host.dataset.rendered && host.dataset.active === (state.resolved ? state.resolved.partNumber : '')) return;

        var active = state.resolved ? state.resolved.partNumber : '';
        host.innerHTML = L.sizesIn(state.grid).map(function (s) {
            var rows = L.ladderFor(state.grid, s, null);
            return '<div class="stk-rate-block"><h3>' + esc(L.formatSize(s)) + '</h3>' +
                '<table><thead><tr><th>Qty</th><th class="num">Total</th><th class="num">≈ each</th><th class="num">Save</th></tr></thead><tbody>' +
                rows.map(function (r) {
                    return '<tr' + (r.partNumber === active ? ' class="is-active-tier"' : '') + '>' +
                        '<td>' + L.formatInt(r.quantity) + '</td>' +
                        '<td class="num">$' + L.formatMoney(r.totalPrice) + '</td>' +
                        '<td class="num">$' + L.formatUnit(r.unitPrice) + '</td>' +
                        '<td class="num">' + (r.savingsPct != null ? r.savingsPct + '%' : '') + '</td></tr>';
                }).join('') +
                '</tbody></table></div>';
        }).join('');
        host.dataset.rendered = '1';
        host.dataset.active = active;
    }

    /** Squares at true relative scale beside a credit card (3.37in wide). */
    function renderFigure() {
        var svg = byId('stkFigure');
        var sizes = L.sizesIn(state.grid);
        var maxIn = Math.max.apply(null, sizes.map(parseFloat).concat([3.37]));
        var pxPerIn = 170 / maxIn;
        var x = 8;
        var parts = ['<title id="stkFigureTitle">Sticker sizes at true relative scale next to a credit card</title>'];

        parts.push('<rect x="' + x + '" y="' + (180 - 2.13 * pxPerIn) + '" width="' + (3.37 * pxPerIn) +
            '" height="' + (2.13 * pxPerIn) + '" rx="4" fill="none" stroke="#cfc8b6" stroke-dasharray="4 3"/>');
        parts.push('<text x="' + (x + 4) + '" y="192" font-size="9" fill="#75847c">credit card</text>');
        x += 3.37 * pxPerIn + 16;

        sizes.forEach(function (s) {
            var inches = parseFloat(s);
            var w = inches * pxPerIn;
            var on = s === state.effectiveSize;
            parts.push('<rect x="' + x + '" y="' + (180 - w) + '" width="' + w + '" height="' + w +
                '" rx="3" fill="' + (on ? '#e3f1e4' : '#faf8f3') + '" stroke="' + (on ? '#2f7d3b' : '#e4dfd2') +
                '" stroke-width="' + (on ? 2 : 1) + '"/>');
            parts.push('<text x="' + (x + w / 2) + '" y="192" font-size="9" text-anchor="middle" fill="' +
                (on ? '#1b4424' : '#75847c') + '" font-weight="' + (on ? 700 : 400) + '">' + esc(inches + '″') + '</text>');
            x += w + 12;
        });

        svg.setAttribute('viewBox', '0 0 ' + Math.max(420, x) + ' 200');
        svg.innerHTML = parts.join('');
    }

    // ── Lead capture ──────────────────────────────────────────────────
    function summaryText() {
        if (!state.resolved) return '';
        return L.formatInt(state.resolved.quantity) + ' × ' + L.formatSize(state.resolved.size) +
            ' die-cut stickers — $' + L.formatMoney(state.resolved.totalPrice);
    }

    function openLead(mode) {
        var lead = byId('stkLead');
        lead.classList.add('is-open');
        byId('stkLeadTitle').textContent = mode === 'email' ? 'Where should we email it?' : 'Where should we send it?';
        byId('stkLeadSub').textContent = mode === 'email'
            ? 'We\'ll email you this exact quote — usually within the hour.'
            : 'We\'ll email you this exact quote and follow up about artwork — usually within the hour.';
        lead.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        byId('stkName').focus();
    }

    async function submitLead() {
        var err = byId('stkLeadError');
        var name = byId('stkName').value.trim();
        var email = byId('stkEmail').value.trim();
        var phone = byId('stkPhone').value.trim();

        var missing = [];
        if (!name) missing.push('your name');
        if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) missing.push('a valid email');
        if (!phone) missing.push('a phone number');
        if (missing.length) {
            err.textContent = 'We still need ' + missing.join(', ') + '.';
            err.hidden = false;
            return;
        }
        err.hidden = true;

        // Honeypot: a real person never fills a field they cannot see.
        if (byId('hpWebsite').value) { showLeadSuccess(); return; }

        var base = apiBase();
        var btn = byId('stkLeadSubmit');
        btn.disabled = true;
        btn.textContent = 'Sending…';

        var fee = state.setupFee ? state.setupFee.amount : 0;
        var setupLabel = state.setupAnswer === 'reorder'
            ? '$0.00 (reorder — design on file)'
            : '$' + L.formatMoney(fee) + (state.setupAnswer === 'new' ? ' (new design)' : ' (not yet answered — assumed new)');

        var payload = {
            formId: 'quote-request',
            company: byId('stkCompany').value.trim() || name,
            summary: summaryText(),
            payload: {
                fields: [
                    ['Product', 'Die-cut stickers'],
                    ['Size', L.formatSize(state.resolved.size)],
                    ['Quantity', String(state.resolved.quantity)],
                    ['Part number', state.resolved.partNumber],
                    ['Sticker price', '$' + L.formatMoney(state.resolved.totalPrice)],
                    ['Art setup', setupLabel],
                    ['Source', 'custom-stickers configurator'],
                    ['Configured link', location.href]
                ],
                notes: [['Customer message', byId('stkMessage').value.trim()]]
            },
            name: name,
            email: email,
            phone: phone,
            hp: ''
        };

        try {
            var r = await fetch(base + '/api/form-submissions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!r.ok) throw new Error('HTTP ' + r.status);
            showLeadSuccess();
        } catch (e) {
            console.error('[custom-stickers] lead submit failed:', e);
            btn.disabled = false;
            btn.textContent = 'Send my quote request';
            err.innerHTML = 'That didn\'t go through. Please call <a href="tel:253-922-5793">(253) 922-5793</a> or email ' +
                '<a href="mailto:sales@nwcustomapparel.com">sales@nwcustomapparel.com</a> — we\'ve kept everything you typed.';
            err.hidden = false;
        }
    }

    function showLeadSuccess() {
        // Replace the panel in place. Deliberately NOT scrolling to the top of
        // the page — the customer must land on their confirmation, not the hero.
        byId('stkLead').innerHTML =
            '<h3>Got it — thank you.</h3>' +
            '<p class="stk-lead-sub">We\'ll email you this quote shortly. ' +
            (summaryText() ? esc(summaryText()) + '. ' : '') +
            'If it\'s urgent, call <a href="tel:253-922-5793">(253) 922-5793</a> and mention die-cut stickers.</p>';
        byId('stkLead').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }

    // ── Wiring ────────────────────────────────────────────────────────
    function wire() {
        byId('stkSizes').addEventListener('change', function (e) {
            if (e.target.name !== 'stkSize') return;
            if (e.target.value === CUSTOM_SIZE) {
                state.sizeMode = 'custom';
            } else {
                state.sizeMode = 'standard';
                state.size = e.target.value;
            }
            render();
        });

        ['stkW', 'stkH'].forEach(function (id) {
            byId(id).addEventListener('input', function () {
                state.customW = byId('stkW').value;
                state.customH = byId('stkH').value;
                render();
            });
        });

        byId('stkLadder').addEventListener('change', function (e) {
            if (e.target.name !== 'stkQty') return;
            if (e.target.value === CUSTOM_QTY) {
                state.qtyMode = 'custom';
                render();
                byId('stkCustomQty').focus();
            } else {
                state.qtyMode = 'standard';
                state.qty = parseInt(e.target.value, 10);
                render();
            }
        });

        byId('stkCustomQty').addEventListener('input', function () {
            state.customQty = this.value;
            render();
        });

        byId('stkQtySelect').addEventListener('change', function () {
            state.qtyMode = 'standard';
            state.qty = parseInt(this.value, 10);
            render();
        });

        document.querySelectorAll('input[name="stkSetup"]').forEach(function (el) {
            el.addEventListener('change', function () {
                state.setupAnswer = this.value;
                renderSetup();
            });
        });

        // Native <dialog>: focus trap, Escape and focus-return all for free.
        var dlg = byId('stkSizeDialog');
        byId('stkSizeHelp').addEventListener('click', function () { dlg.showModal(); });
        byId('stkSizeDialogClose').addEventListener('click', function () { dlg.close(); });

        byId('stkCta').addEventListener('click', function () { openLead('quote'); });
        byId('stkBarCta').addEventListener('click', function () { openLead('quote'); });
        byId('stkEmailMe').addEventListener('click', function () { openLead('email'); });
        byId('stkLeadSubmit').addEventListener('click', submitLead);
        byId('stkOversizeCta').addEventListener('click', function () {
            location.href = '/pages/request-a-quote.html?source=custom-stickers&product=' +
                encodeURIComponent('Large-format decal ' + state.customW + '" x ' + state.customH + '"');
        });

        byId('stkCopyLink').addEventListener('click', function () {
            navigator.clipboard.writeText(location.href)
                .then(function () { toast('Link copied — the price travels with it.'); })
                .catch(function () { toast('Couldn\'t copy — use your browser\'s address bar.'); });
        });

        byId('stkPrint').addEventListener('click', function () { window.print(); });

        // The whole ladder as tab-separated text. Buyers paste this into a
        // spreadsheet; making them retype it is friction for no reason.
        byId('stkCopyList').addEventListener('click', function () {
            var rows = L.ladderFor(state.grid, state.effectiveSize, null);
            var text = L.formatSize(state.effectiveSize) + ' die-cut stickers — Northwest Custom Apparel\n' +
                'Quantity\tTotal\tPer sticker (approx)\n' +
                rows.map(function (r) {
                    return L.formatInt(r.quantity) + '\t$' + L.formatMoney(r.totalPrice) + '\t$' + L.formatUnit(r.unitPrice);
                }).join('\n');
            navigator.clipboard.writeText(text)
                .then(function () { toast('Price list copied.'); })
                .catch(function () { toast('Couldn\'t copy to the clipboard.'); });
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})();
