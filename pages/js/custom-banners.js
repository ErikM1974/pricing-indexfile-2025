/**
 * custom-banners.js — controller for the public /custom-banners page.
 *
 * 🔴 ONE BOOT FETCH. GET /api/public/banner-presets prices every preset size
 * server-side in a single round trip, so switching size re-prices from memory
 * with no network at all. Only a CUSTOM size or a finishing option needs the
 * server, and those fire ON COMMIT (blur / button / checkbox change) — never
 * per keystroke. A debounced call per keystroke makes the price flicker while
 * you type, which is the opposite of the stillness this page is copying.
 *
 * 🔴 NO CLIENT-SIDE PRICE MATH. Every dollar comes from computeBannerQuote via
 * the server. This file selects and formats; it never multiplies.
 *
 * 🔴 NO VOLUME BREAK EXISTS. Quantity is a plain multiplier. Nothing here may
 * imply a discount for ordering more — the rate card doesn't have one, and a
 * customer arriving from the sticker page has been trained to look for one.
 */
(function () {
    'use strict';

    var L = window.BannerLadder;

    var DEFAULT_KEY = '3x6';   // "Most popular" — mid-ladder, a believable first look

    var state = {
        presets: [],
        rateCard: null,
        setupFee: null,
        safeRollWidthIn: 52,
        sizeKey: DEFAULT_KEY,
        custom: null,          // { widthFt, heightFt } when a custom size is priced
        qty: 1,
        doubleSided: false,
        polePockets: false,
        priced: null,          // last server quote
        pending: false
    };

    function byId(id) { return document.getElementById(id); }
    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }
    function toast(msg) {
        var el = byId('bnToast');
        el.textContent = msg; el.classList.add('is-up');
        clearTimeout(el._t); el._t = setTimeout(function () { el.classList.remove('is-up'); }, 2600);
    }
    function fatal() {
        byId('bnAlert').hidden = false;
        byId('configurator').hidden = true;
        byId('bnBar').hidden = true;
    }

    // ── Boot ──────────────────────────────────────────────────────────
    async function boot() {
        try {
            var r = await fetch('/api/public/banner-presets');
            if (!r.ok) throw new Error('HTTP ' + r.status);
            var d = await r.json();
            if (!d || !Array.isArray(d.presets) || !d.presets.length) throw new Error('no presets');

            state.presets = d.presets;
            state.rateCard = d.rateCard || null;
            state.setupFee = d.setupFee || null;
            state.safeRollWidthIn = d.safeRollWidthIn || 52;
            if (d.source && d.source !== 'caspio') byId('bnWarn').hidden = false;

            readUrl();
            wire();
            selectSize(state.sizeKey, { silent: true });
        } catch (e) {
            console.error('[custom-banners] boot failed:', e);
            fatal();
        }
    }

    function readUrl() {
        var p = new URLSearchParams(location.search);
        var size = p.get('size');
        var w = parseFloat(p.get('w')), h = parseFloat(p.get('h'));
        var qty = parseInt(p.get('qty'), 10);
        if (qty > 0) { state.qty = qty; byId('bnQty').value = qty; }
        if (p.get('double') === '1') { state.doubleSided = true; byId('bnDouble').checked = true; }
        if (p.get('pockets') === '1') { state.polePockets = true; byId('bnPockets').checked = true; }
        if (isFinite(w) && w > 0 && isFinite(h) && h > 0) {
            state.custom = { widthFt: w, heightFt: h };
            state.sizeKey = null;
            byId('bnW').value = w; byId('bnH').value = h;
        } else if (size && state.presets.some(function (x) { return x.key === size; })) {
            state.sizeKey = size;
        }
    }

    function writeUrl() {
        var p = new URLSearchParams();
        if (state.custom) { p.set('w', state.custom.widthFt); p.set('h', state.custom.heightFt); }
        else if (state.sizeKey) p.set('size', state.sizeKey);
        if (state.qty > 1) p.set('qty', state.qty);
        if (state.doubleSided) p.set('double', '1');
        if (state.polePockets) p.set('pockets', '1');
        history.replaceState(null, '', location.pathname + (p.toString() ? '?' + p.toString() : ''));
    }

    // ── Pricing (server only) ─────────────────────────────────────────
    function currentSizeIn() {
        if (state.custom) {
            return { w: L.ftToIn(state.custom.widthFt), h: L.ftToIn(state.custom.heightFt) };
        }
        var p = state.presets.find(function (x) { return x.key === state.sizeKey; });
        return p ? { w: p.widthIn, h: p.heightIn } : null;
    }

    /**
     * Ask the server for a price. Called on COMMIT only: size click, quantity
     * change, finishing toggle, or the custom-size "Price it" button.
     */
    async function repriceFromServer() {
        var size = currentSizeIn();
        if (!size) return;
        state.pending = true;
        renderPending();

        var qs = new URLSearchParams({ width: size.w, height: size.h, qty: state.qty });
        if (state.doubleSided) qs.set('doubleSided', 'true');
        if (state.polePockets) qs.set('polePockets', 'both');

        try {
            var base = (window.APP_CONFIG && window.APP_CONFIG.API && window.APP_CONFIG.API.BASE_URL) || '';
            if (!base) throw new Error('no API base');
            var r = await fetch(base.replace(/\/+$/, '') + '/api/banner-pricing/quote?' + qs.toString());
            if (!r.ok) throw new Error('HTTP ' + r.status);
            var q = await r.json();
            if (q.error) throw new Error(q.error);
            state.priced = q;
            state.pending = false;
            render();
        } catch (e) {
            console.error('[custom-banners] reprice failed:', e);
            state.pending = false;
            state.priced = null;
            // Rule 4 — show nothing rather than a stale or guessed number.
            byId('bnAlert').hidden = false;
            render();
        }
    }

    /**
     * The instant path: a preset click uses the price already fetched on boot,
     * so long as no finishing option is on (those need the server).
     */
    function canUsePresetPrice() {
        return !state.custom && !state.doubleSided && !state.polePockets && state.qty === 1;
    }

    function selectSize(key, opts) {
        state.sizeKey = key;
        state.custom = null;
        byId('bnW').value = ''; byId('bnH').value = '';
        if (canUsePresetPrice()) {
            var p = state.presets.find(function (x) { return x.key === key; });
            state.priced = p ? {
                orderTotal: p.price,
                perBanner: { total: p.price },
                dimensions: { widthIn: p.widthIn, heightIn: p.heightIn, sqft: p.sqft },
                appliedRules: { minimum: p.atMinimum ? 'minimum applied' : null }
            } : null;
            render();
        } else {
            repriceFromServer();
        }
        if (!opts || !opts.silent) writeUrl();
    }

    // ── Render ────────────────────────────────────────────────────────
    function render() {
        renderLadder();
        renderPrice();
        renderSizeNote();
        renderSetup();
        renderBar();
        renderRateCard();
        renderFigure();
        writeUrl();
    }

    function renderPending() {
        byId('bnTotal').textContent = '…';
        byId('bnUnit').textContent = 'pricing';
        byId('bnCta').disabled = true;
    }

    function renderLadder() {
        var rows = L.ladderFrom(state.presets, state.custom ? null : state.sizeKey);
        byId('bnLadder').querySelector('tbody').innerHTML = rows.map(function (r) {
            return '<tr class="' + (r.isSelected ? 'is-selected' : '') + '" data-key="' + esc(r.key) + '">' +
                '<td class="stk-l-radio"><input type="radio" name="bnSize" value="' + esc(r.key) + '"' +
                (r.isSelected ? ' checked' : '') +
                ' aria-label="' + esc(r.label + ', $' + L.formatMoney(r.unitPrice) + ' each') + '"></td>' +
                '<td class="bn-l-size">' + esc(r.label) + '</td>' +
                '<td class="bn-l-note">' + esc(r.note || '') + '</td>' +
                '<td class="bn-l-price">$' + L.formatMoney(r.unitPrice) +
                (r.atMinimum ? '<span class="bn-l-flat">min</span>' : '') + '</td>' +
                '</tr>';
        }).join('');
    }

    function renderPrice() {
        var total = byId('bnTotal'), unit = byId('bnUnit'), cta = byId('bnCta');
        if (!state.priced || !isFinite(state.priced.orderTotal)) {
            total.textContent = '—'; unit.textContent = '';
            cta.disabled = true; cta.setAttribute('aria-disabled', 'true');
            return;
        }
        var per = state.priced.perBanner && isFinite(state.priced.perBanner.total)
            ? state.priced.perBanner.total
            : state.priced.orderTotal / Math.max(1, state.qty);
        total.textContent = '$' + L.formatMoney(state.priced.orderTotal);
        unit.textContent = state.qty > 1
            ? '$' + L.formatMoney(per) + ' each × ' + L.formatInt(state.qty)
            : '';
        cta.disabled = false; cta.removeAttribute('aria-disabled');
        byId('bnAlert').hidden = true;
    }

    function renderSizeNote() {
        var el = byId('bnSizeNote');
        var notes = [];

        if (state.custom) {
            var c = L.checkCustomSize(state.custom.widthFt, state.custom.heightFt, state.safeRollWidthIn);
            if (c.ok) {
                notes.push(L.formatSize(state.custom.widthFt, state.custom.heightFt) +
                    ' = ' + c.sqft.toFixed(1) + ' sq ft.');
                if (c.needsPaneling) {
                    notes.push('Wider than our 52″ roll on both sides, so we seam it from panels — still one banner, and we tell you before we print.');
                }
            }
        }
        if (state.priced && state.priced.appliedRules && state.priced.appliedRules.minimum) {
            // Say it plainly: below the floor, shrinking the banner changes nothing.
            notes.push('This size is under our $' + L.formatMoney(state.rateCard ? state.rateCard.minimum : 40) +
                ' per-banner minimum, so anything smaller costs the same. Go bigger at no extra cost.');
        }
        if (!notes.length) { el.hidden = true; return; }
        el.textContent = notes.join(' ');
        el.className = 'stk-inline-note' + (state.priced && state.priced.appliedRules && state.priced.appliedRules.minimum ? ' is-upgrade' : '');
        el.hidden = false;
    }

    function renderSetup() {
        var fee = state.setupFee ? state.setupFee.amount : null;
        byId('bnSetupLine').innerHTML = fee == null ? '' :
            'A one-time $' + L.formatMoney(fee) + ' art setup applies to new designs — once per order, however many banners. ' +
            'Reprints of the same design are $0 setup.';
    }

    function renderBar() {
        var bar = byId('bnBar');
        if (!state.priced || !isFinite(state.priced.orderTotal)) { bar.hidden = true; return; }
        bar.hidden = false;
        byId('bnBarTotal').textContent = '$' + L.formatMoney(state.priced.orderTotal);
        var d = state.priced.dimensions;
        var label = state.custom
            ? L.formatSize(state.custom.widthFt, state.custom.heightFt)
            : (state.presets.find(function (x) { return x.key === state.sizeKey; }) || {}).label || '';
        byId('bnBarDetail').textContent = L.formatInt(state.qty) + ' × ' + label +
            (d ? ' · ' + d.sqft + ' sq ft each' : '');
    }

    function renderRateCard() {
        var host = byId('bnRateCard');
        var activeKey = state.custom ? null : state.sizeKey;
        host.innerHTML = '<div class="bn-rate-grid">' + state.presets.map(function (p) {
            return '<div class="bn-rate-cell' + (p.key === activeKey ? ' is-active-tier' : '') + '">' +
                '<strong>' + esc(p.label) + '</strong>' +
                '<div class="bn-rate-price">$' + L.formatMoney(p.price) + '</div>' +
                '<div class="bn-rate-sub">' + esc(p.sqft + ' sq ft · ' + (p.note || '')) + '</div>' +
                '</div>';
        }).join('') + '</div>';
    }

    /** Banner sizes against a 6ft figure, so scale is legible at a glance. */
    function renderFigure() {
        var svg = byId('bnFigure');
        var shown = state.presets.slice(0, 4);
        var maxFt = Math.max.apply(null, shown.map(function (p) { return Math.max(p.widthFt, p.heightFt); }).concat([6]));
        var pxPerFt = 150 / maxFt;
        var parts = ['<title id="bnFigureTitle">Banner sizes at true relative scale next to a six-foot person</title>'];
        var x = 10, baseY = 190;

        // 6ft person for scale
        parts.push('<rect x="' + x + '" y="' + (baseY - 6 * pxPerFt) + '" width="' + (1.6 * pxPerFt) +
            '" height="' + (6 * pxPerFt) + '" rx="3" fill="none" stroke="#cfc8b6" stroke-dasharray="4 3"/>');
        parts.push('<text x="' + (x + 2) + '" y="' + (baseY + 14) + '" font-size="9" fill="#75847c">6 ft person</text>');
        x += 1.6 * pxPerFt + 20;

        shown.forEach(function (p) {
            var w = p.widthFt * pxPerFt, h = p.heightFt * pxPerFt;
            var on = p.key === state.sizeKey && !state.custom;
            // Banners hang wide: render width horizontally.
            parts.push('<rect x="' + x + '" y="' + (baseY - h) + '" width="' + h + '" height="' + w +
                '" rx="2" fill="' + (on ? '#e3f1e4' : '#faf8f3') + '" stroke="' + (on ? '#2f7d3b' : '#e4dfd2') +
                '" stroke-width="' + (on ? 2 : 1) + '"/>');
            parts.push('<text x="' + (x + h / 2) + '" y="' + (baseY + 14) + '" font-size="9" text-anchor="middle" fill="' +
                (on ? '#1b4424' : '#75847c') + '" font-weight="' + (on ? 700 : 400) + '">' + esc(p.label.replace(' ft', '')) + '</text>');
            x += h + 14;
        });
        svg.setAttribute('viewBox', '0 0 ' + Math.max(460, x) + ' 220');
        svg.innerHTML = parts.join('');
    }

    // ── Lead ──────────────────────────────────────────────────────────
    function summaryText() {
        if (!state.priced) return '';
        var label = state.custom
            ? L.formatSize(state.custom.widthFt, state.custom.heightFt)
            : (state.presets.find(function (x) { return x.key === state.sizeKey; }) || {}).label || '';
        return L.formatInt(state.qty) + ' × ' + label + ' vinyl banner' + (state.qty > 1 ? 's' : '') +
            ' — $' + L.formatMoney(state.priced.orderTotal);
    }

    async function submitLead() {
        var err = byId('bnLeadError');
        var name = byId('bnName').value.trim();
        var email = byId('bnEmail').value.trim();
        var phone = byId('bnPhone').value.trim();
        var missing = [];
        if (!name) missing.push('your name');
        if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) missing.push('a valid email');
        if (!phone) missing.push('a phone number');
        if (missing.length) { err.textContent = 'We still need ' + missing.join(', ') + '.'; err.hidden = false; return; }
        err.hidden = true;
        if (byId('bnHp').value) { showSuccess(); return; }

        var btn = byId('bnLeadSubmit');
        btn.disabled = true; btn.textContent = 'Sending…';
        var base = (window.APP_CONFIG && window.APP_CONFIG.API && window.APP_CONFIG.API.BASE_URL) || '';
        var size = currentSizeIn();
        var label = state.custom
            ? L.formatSize(state.custom.widthFt, state.custom.heightFt)
            : (state.presets.find(function (x) { return x.key === state.sizeKey; }) || {}).label || '';

        try {
            var r = await fetch(base.replace(/\/+$/, '') + '/api/form-submissions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    formId: 'quote-request',
                    company: byId('bnCompany').value.trim() || name,
                    summary: summaryText(),
                    name: name, email: email, phone: phone, hp: '',
                    payload: {
                        fields: [
                            ['Product', 'Vinyl banners'],
                            ['Size', label + (size ? ' (' + size.w + '" × ' + size.h + '")' : '')],
                            ['Quantity', String(state.qty)],
                            ['Double-sided', state.doubleSided ? 'Yes' : 'No'],
                            ['Pole pockets', state.polePockets ? 'Top & bottom' : 'No (grommets included)'],
                            ['Banner price', '$' + L.formatMoney(state.priced.orderTotal)],
                            ['Source', 'custom-banners configurator'],
                            ['Configured link', location.href]
                        ],
                        notes: [['Customer message', byId('bnMessage').value.trim()]]
                    }
                })
            });
            if (!r.ok) throw new Error('HTTP ' + r.status);
            showSuccess();
        } catch (e) {
            console.error('[custom-banners] lead failed:', e);
            btn.disabled = false; btn.textContent = 'Send my quote request';
            err.innerHTML = 'That didn\'t go through. Please call <a href="tel:253-922-5793">(253) 922-5793</a> or email ' +
                '<a href="mailto:sales@nwcustomapparel.com">sales@nwcustomapparel.com</a> — we\'ve kept everything you typed.';
            err.hidden = false;
        }
    }

    function showSuccess() {
        // Replace in place — never scroll to the top, the customer must land on
        // their confirmation rather than the hero.
        byId('bnLead').innerHTML = '<h3>Got it — thank you.</h3>' +
            '<p class="stk-lead-sub">' + (summaryText() ? esc(summaryText()) + '. ' : '') +
            'We\'ll email you this quote shortly and follow up about artwork. ' +
            'If it\'s urgent, call <a href="tel:253-922-5793">(253) 922-5793</a> and mention vinyl banners.</p>';
        byId('bnLead').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }

    // ── Wiring ────────────────────────────────────────────────────────
    function wire() {
        byId('bnLadder').addEventListener('change', function (e) {
            if (e.target.name === 'bnSize') selectSize(e.target.value);
        });

        byId('bnCustomGo').addEventListener('click', commitCustom);
        ['bnW', 'bnH'].forEach(function (id) {
            byId(id).addEventListener('blur', commitCustom);
            byId(id).addEventListener('keydown', function (e) { if (e.key === 'Enter') commitCustom(); });
        });

        byId('bnQty').addEventListener('change', function () {
            state.qty = Math.max(1, parseInt(this.value, 10) || 1);
            this.value = state.qty;
            repriceFromServer();
        });
        byId('bnPlus').addEventListener('click', function () { step(1); });
        byId('bnMinus').addEventListener('click', function () { step(-1); });

        byId('bnDouble').addEventListener('change', function () { state.doubleSided = this.checked; repriceFromServer(); });
        byId('bnPockets').addEventListener('change', function () { state.polePockets = this.checked; repriceFromServer(); });

        var dlg = byId('bnSizeDialog');
        byId('bnSizeHelp').addEventListener('click', function () { dlg.showModal(); });
        byId('bnSizeDialogClose').addEventListener('click', function () { dlg.close(); });

        byId('bnCta').addEventListener('click', openLead);
        byId('bnBarCta').addEventListener('click', openLead);
        byId('bnLeadSubmit').addEventListener('click', submitLead);

        byId('bnCopyLink').addEventListener('click', function () {
            navigator.clipboard.writeText(location.href)
                .then(function () { toast('Link copied — the price travels with it.'); })
                .catch(function () { toast('Couldn\'t copy — use your browser\'s address bar.'); });
        });
        byId('bnPrint').addEventListener('click', function () { window.print(); });
    }

    function step(n) {
        state.qty = Math.max(1, state.qty + n);
        byId('bnQty').value = state.qty;
        repriceFromServer();
    }

    /** Commit-on-blur, deliberately not per-keystroke. */
    function commitCustom() {
        var w = parseFloat(byId('bnW').value), h = parseFloat(byId('bnH').value);
        var chk = L.checkCustomSize(w, h, state.safeRollWidthIn);
        byId('bnW').classList.toggle('is-invalid', !!byId('bnW').value && !chk.ok);
        byId('bnH').classList.toggle('is-invalid', !!byId('bnH').value && !chk.ok);
        if (!chk.ok) return;
        if (state.custom && state.custom.widthFt === w && state.custom.heightFt === h) return;
        state.custom = { widthFt: w, heightFt: h };
        state.sizeKey = null;
        repriceFromServer();
    }

    function openLead() {
        byId('bnLead').classList.add('is-open');
        byId('bnLead').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        byId('bnName').focus();
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
})();
