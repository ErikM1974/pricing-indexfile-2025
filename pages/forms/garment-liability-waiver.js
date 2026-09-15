/**
 * garment-liability-waiver.js — pages/forms/garment-liability-waiver.html
 *
 * Electronic signature for the Customer-Supplied Garment Liability Waiver.
 * One page, two audiences:
 *   - STAFF (staff cookie present → /api/crm-session/me authenticated): a
 *     "send to customer" panel appears. Fill the customer's details, then
 *     "Email customer" POSTs same-origin /api/garment-waiver/send-link (staff-
 *     gated; the SERVER builds the link and emails it through EmailJS) or
 *     "Copy link" copies the prefilled URL (?c=&n=&e=&p=&o=&g=&q=&r=&re=&m=).
 *   - CUSTOMER (anonymous link): reads the waiver, types their name, optionally
 *     draws a signature, ticks consent, clicks Sign → POST proxy
 *     /api/form-submissions (formId garment-waiver, GLW prefix) → Forms Inbox
 *     "Waivers". The proxy stamps IP / user-agent / receipt time / text hash
 *     into payload.audit. Then same-origin POST /api/garment-waiver/signed
 *     confirms the row is on file and emails the customer a copy + the rep a
 *     notice — "not found" there means nothing was stored (e.g. the honeypot
 *     tripped), so the page UNLOCKS and says so; a mail failure keeps the
 *     signature and says "print this page".
 *
 * Evidence stored per signature (payload.signature): typed name, drawn PNG
 * (optional, size-capped), client time (ISO + Pacific text + zone), waiver
 * version + SHA-256 of the exact text shown, user agent, screen size, rep
 * email. The full waiver text rides in payload.notes so the record is
 * self-describing. No localStorage draft: this is a short customer form and a
 * draft would offer one customer's details to the next person on a shared
 * tablet.
 *
 * Failures are ALWAYS visible (CLAUDE.md #4): nothing typed is lost and the
 * banner says what to do. Print / Clear / dirty-guard come from NWCAForm.
 */
(function () {
    'use strict';

    var FORM_ID = 'garment-waiver';
    var WAIVER_VERSION = '2026-09-15';
    var MAX_DRAWN_CHARS = 30000; // data-URL cap so Payload_JSON stays small
    var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/; // same rule the server applies
    var PARAM_FIELDS = [
        ['c', 'fldCompany', 160], ['n', 'fldContact', 120], ['e', 'fldEmail', 160], ['p', 'fldPhone', 60],
        ['o', 'fldOrderRef', 60], ['g', 'fldGarments', 600], ['q', 'fldCount', 12], ['r', 'fldRep', 80], ['re', 'fldRepEmail', 160],
    ];
    var METHODS = [
        ['decoEmbroidery', 'emb', 'Embroidery'], ['decoScreen', 'scr', 'Screen Printing'], ['decoDtf', 'dtf', 'DTF / Heat Transfer'],
        ['decoLaser', 'las', 'Laser Engraving'], ['decoPatches', 'pat', 'Patches'],
    ];

    var pad = null;
    var signed = false;

    document.addEventListener('DOMContentLoaded', function () {
        pad = createSignaturePad(document.getElementById('sigPad'));
        NWCAForm.init({ onAfterClear: function () { pad.clear(); prefillFromUrl(); stampDate(); } });
        prefillFromUrl();
        stampDate();
        document.getElementById('clearSigBtn').addEventListener('click', function () { pad.clear(); });
        document.getElementById('signWaiverBtn').addEventListener('click', sign);
        document.getElementById('printSignedBtn').addEventListener('click', function () { window.print(); });
        wireStaffPanel();
    });

    // ── helpers ──────────────────────────────────────────────────────────
    function apiBase() {
        if (window.APP_CONFIG && APP_CONFIG.API && APP_CONFIG.API.BASE_URL) return APP_CONFIG.API.BASE_URL.replace(/\/+$/, '');
        return null;
    }
    function val(id) { var el = document.getElementById(id); return el ? el.value.trim() : ''; }
    function checked(id) { var el = document.getElementById(id); return !!(el && el.checked); }
    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    // Pacific-clock stamp for the record + the on-screen date (ISO stays UTC).
    function pacificNow() {
        var now = new Date();
        var out = { iso: now.toISOString(), date: '', text: '', zone: '' };
        try {
            out.date = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', month: 'numeric', day: 'numeric', year: 'numeric' }).format(now);
            out.text = out.date + ' ' + new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', hour: 'numeric', minute: '2-digit' }).format(now) + ' PT';
            out.zone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
        } catch (e) {
            out.date = (now.getMonth() + 1) + '/' + now.getDate() + '/' + now.getFullYear();
            out.text = out.date + ' ' + now.toLocaleTimeString();
        }
        return out;
    }

    // Pacific text for the proxy's receipt time (the time of record); null when absent/unparsable.
    function serverStamp(iso) {
        var d = iso ? new Date(iso) : null;
        if (!d || isNaN(d.getTime())) return null;
        try {
            var date = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', month: 'numeric', day: 'numeric', year: 'numeric' }).format(d);
            var time = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', hour: 'numeric', minute: '2-digit' }).format(d);
            return { iso: d.toISOString(), date: date, text: date + ' ' + time + ' PT', zone: 'America/Los_Angeles' };
        } catch (e) { return null; }
    }

    function stampDate() {
        var el = document.getElementById('fldSignDate');
        if (el && !signed) el.value = pacificNow().date;
    }

    // Deep-link prefill from the staff-built customer link. Only fills blanks.
    function prefillFromUrl() {
        var params;
        try { params = new URLSearchParams(window.location.search); } catch (e) { return; }
        PARAM_FIELDS.forEach(function (pair) {
            var v = (params.get(pair[0]) || '').trim().slice(0, pair[2]);
            var el = document.getElementById(pair[1]);
            if (v && el && !el.value) el.value = v;
            // the rep's own fields (order #, rep name) are read-only for the customer when the link set them
            if (v && el && (pair[1] === 'fldOrderRef' || pair[1] === 'fldRep')) el.readOnly = true;
        });
        (params.get('m') || '').split(',').forEach(function (key) {
            var hit = METHODS.filter(function (m) { return m[1] === key.trim().toLowerCase(); })[0];
            if (hit) document.getElementById(hit[0]).checked = true;
        });
    }

    function waiverPlainText() {
        var box = document.getElementById('waiverText');
        return box ? box.textContent.replace(/\s+/g, ' ').trim() : '';
    }

    // SHA-256 of the waiver text shown (provenance). Resolves '' when the
    // browser has no crypto.subtle (plain http) — never blocks signing.
    function hashText(text) {
        try {
            if (!(window.crypto && crypto.subtle && window.TextEncoder)) return Promise.resolve('');
            return crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)).then(function (buf) {
                return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
            }).catch(function () { return ''; });
        } catch (e) { return Promise.resolve(''); }
    }

    // ── banners (same look as the twins' save banner, placed by the action) ──
    function banner(kind, html, focusId) {
        var el = document.querySelector('.waiver-banner');
        if (!el) {
            el = document.createElement('div');
            el.className = 'form-save-banner waiver-banner no-print';
            el.setAttribute('role', 'alert');
            var section = document.getElementById('signatureSection');
            section.insertBefore(el, section.firstChild);
        }
        el.classList.remove('form-save-banner--ok', 'form-save-banner--error');
        el.classList.add(kind === 'ok' ? 'form-save-banner--ok' : 'form-save-banner--error');
        el.innerHTML = html;
        var field = focusId ? document.getElementById(focusId) : null;
        if (field) {
            // bring the field that needs attention on screen (it may sit far above the banner)
            field.focus({ preventScroll: true });
            field.scrollIntoView({ block: 'center', behavior: 'smooth' });
        } else {
            el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }
    }
    function removeBanner() { var el = document.querySelector('.waiver-banner'); if (el) el.remove(); }
    function fail(text, focusId) {
        banner('error', '<i class="fas fa-circle-exclamation" aria-hidden="true"></i> ' + escapeHtml(text), focusId);
    }

    // ── sign & submit ─────────────────────────────────────────────────────
    function sign() {
        if (signed) return;
        var contact = val('fldContact'), email = val('fldEmail'), name = val('fldSignedName');
        if (!contact) return fail('Please enter your name.', 'fldContact');
        if (!EMAIL_RE.test(email)) return fail('Please enter one valid email address so we can send you your signed copy.', 'fldEmail');
        if (!name) return fail('Please type your full name in the signature box.', 'fldSignedName');
        if (!checked('chkAgree')) return fail('Please tick the box to confirm you have read and agree to the waiver.', 'chkAgree');
        var base = apiBase();
        if (!base) return fail('We could not load our connection. Please call 253-922-5793 and we will take it by phone.');

        var btn = document.getElementById('signWaiverBtn');
        btn.disabled = true;
        var oldLabel = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin" aria-hidden="true"></i> Signing…';

        var when = pacificNow();
        var text = waiverPlainText();
        hashText(text).then(function (hash) {
            var body = buildSubmission(name, when, text, hash);
            return fetch(base + '/api/form-submissions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            }).then(function (resp) {
                return resp.json().catch(function () { return {}; }).then(function (data) {
                    if (!resp.ok) throw new Error(data.error || ('HTTP ' + resp.status));
                    return data;
                });
            });
        }).then(function (data) {
            onSigned(data.submissionId || '', name, serverStamp(data.receivedAt) || when, email);
        }).catch(function (err) {
            console.error('[garment-waiver] sign failed:', err);
            fail('That did not go through (' + (err && err.message ? err.message : 'request failed') + '). Nothing you typed was lost — try again in a minute, or call 253-922-5793.');
        }).finally(function () {
            if (!signed) { btn.disabled = false; btn.innerHTML = oldLabel; }
        });
    }

    function buildSubmission(name, when, text, hash) {
        var methods = METHODS.filter(function (m) { return checked(m[0]); }).map(function (m) { return m[2]; });
        var drawn = pad.toDataUrl(MAX_DRAWN_CHARS);
        var company = val('fldCompany') || val('fldContact');
        var count = val('fldCount');
        var order = val('fldOrderRef');
        var summary = 'Signed by ' + name + (count ? ' · ' + count + ' pcs' : '') + (order ? ' · ' + order : '') + (methods.length ? ' · ' + methods.join(', ') : '') + ' · v' + WAIVER_VERSION;
        var signature = {
            typedName: name,
            drawn: drawn,
            signedAt: when.iso,
            signedAtPacific: when.text,
            timeZone: when.zone,
            waiverVersion: WAIVER_VERSION,
            textSha256: hash,
            userAgent: navigator.userAgent || '',
            screen: (window.screen ? screen.width + 'x' + screen.height : ''),
            repEmail: val('fldRepEmail'),
        };
        return {
            formId: FORM_ID,
            company: company,
            contactName: val('fldContact'),
            phone: val('fldPhone'),
            email: val('fldEmail'),
            salesRep: val('fldRep'),
            dueDateIso: '',
            summary: summary.slice(0, 250),
            payload: {
                fields: [
                    ['Company', val('fldCompany')], ['Contact Name', val('fldContact')], ['Email', val('fldEmail')], ['Phone', val('fldPhone')],
                    ['Order / Quote #', order], ['NWCA Rep', val('fldRep')], ['Total Pieces', count], ['Decoration', methods.join(', ')],
                ],
                checks: ['Agreed to the Customer-Supplied Garment Liability Waiver v' + WAIVER_VERSION, 'Consented to electronic signature and electronic records'],
                notes: [
                    ['Garments Supplied', val('fldGarments')],
                    ['Electronic Signature', 'Typed: ' + name + ' · ' + when.text + (drawn ? ' · drawn signature attached' : ' · typed signature only')],
                    ['Waiver Text (as signed)', text],
                ],
                signature: signature,
            },
            hp: val('hpWebsite'), // honeypot — humans never see the field
        };
    }

    function onSigned(id, name, when, email) {
        signed = true;
        document.getElementById('fldSignDate').value = when.date; // the date of record, not the page-load date
        setLocked(true);
        document.getElementById('signedRef').textContent = id;
        var stamp = document.getElementById('sigStamp');
        stamp.textContent = 'Electronically signed by ' + name + ' on ' + when.text + ' · Reference ' + id + ' · Waiver version ' + WAIVER_VERSION;
        stamp.hidden = false;
        document.getElementById('signRow').hidden = true;
        var panel = document.getElementById('signedPanel');
        panel.hidden = false;
        removeBanner();
        NWCAForm.markClean();
        panel.scrollIntoView({ block: 'center', behavior: 'smooth' });
        panel.focus({ preventScroll: true });
        confirmAndEmail(id, email);
    }

    // Ask the server to confirm the row is on file and email the copies.
    // 404 = nothing was stored (e.g. the honeypot tripped) → unlock and say so.
    // Any other failure = the signature IS on file; only the email failed.
    function confirmAndEmail(id, email) {
        var note = document.getElementById('signedCopyNote');
        note.textContent = 'Emailing your copy to ' + email + '…';
        fetch('/api/garment-waiver/signed', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ submissionId: id, email: email }),
        }).then(function (resp) {
            return resp.json().catch(function () { return {}; }).then(function (data) {
                if (resp.status === 404) throw Object.assign(new Error('not on file'), { notFound: true });
                if (!resp.ok) throw new Error(data.error || ('HTTP ' + resp.status));
                return data;
            });
        }).then(function () {
            note.textContent = 'A copy has been emailed to ' + email + '.';
        }).catch(function (err) {
            console.error('[garment-waiver] confirm/copy failed:', err);
            if (err && err.notFound) {
                unsign();
                fail('We could not confirm your signature was recorded (reference ' + id + '). Nothing you typed was lost — please click Sign again, or call 253-922-5793.', 'signWaiverBtn');
                return;
            }
            note.textContent = 'Your waiver is signed and on file, but we could not email your copy just now — please print or save this page for your records.';
        });
    }

    function unsign() {
        signed = false;
        setLocked(false);
        document.getElementById('signedPanel').hidden = true;
        document.getElementById('signRow').hidden = false;
        var stamp = document.getElementById('sigStamp');
        stamp.hidden = true;
        stamp.textContent = '';
        document.getElementById('signedRef').textContent = '';
        var btn = document.getElementById('signWaiverBtn');
        btn.innerHTML = '<i class="fas fa-file-signature" aria-hidden="true"></i> Sign &amp; Submit Waiver';
    }

    function setLocked(on) {
        document.querySelectorAll('.form-sheet input, .form-sheet textarea').forEach(function (el) {
            if (el.type === 'checkbox') el.disabled = on;
            else if (el.id !== 'fldSignDate') el.readOnly = on;
        });
        pad.setLocked(on);
        document.getElementById('clearSigBtn').disabled = on;
        document.getElementById('clearFormBtn').disabled = on;
        document.getElementById('signWaiverBtn').disabled = on;
    }

    // ── staff: send the link ─────────────────────────────────────────────
    function buildCustomerLink() {
        var p = new URLSearchParams();
        PARAM_FIELDS.forEach(function (pair) {
            var v = val(pair[1]).slice(0, pair[2]);
            if (v) p.set(pair[0], v);
        });
        var m = METHODS.filter(function (x) { return checked(x[0]); }).map(function (x) { return x[1]; }).join(',');
        if (m) p.set('m', m);
        var q = p.toString();
        return window.location.origin + window.location.pathname + (q ? '?' + q : '');
    }

    function sendStatus(text, isError) {
        var el = document.getElementById('sendLinkStatus');
        el.textContent = text;
        el.classList.toggle('is-error', !!isError);
    }

    function wireStaffPanel() {
        fetch('/api/crm-session/me')
            .then(function (r) { return r.json(); })
            .then(function (me) {
                if (!me || !me.authenticated) return;
                var panel = document.getElementById('staffSendPanel');
                panel.hidden = false;
                var rep = document.getElementById('fldRep');
                if (rep && !rep.value) rep.value = me.name || me.firstName || '';
                var repEmail = document.getElementById('fldRepEmail');
                if (repEmail && !repEmail.value) repEmail.value = me.email || '';
                var home = document.getElementById('toolbarHomeLink');
                home.href = '/dashboards/forms-library.html';
                home.innerHTML = '<i class="fas fa-arrow-left" aria-hidden="true"></i> Forms Library';

                var preview = document.getElementById('customerLinkPreview');
                var refresh = function () { preview.textContent = buildCustomerLink(); };
                document.addEventListener('input', refresh);
                document.addEventListener('change', refresh);
                refresh();

                document.getElementById('copyLinkBtn').addEventListener('click', function () {
                    var link = buildCustomerLink();
                    if (!(navigator.clipboard && navigator.clipboard.writeText)) { sendStatus('Copy is blocked here — select the link below and copy it.', true); return; }
                    navigator.clipboard.writeText(link).then(function () { sendStatus('Link copied — paste it into an email or text.'); })
                        .catch(function () { sendStatus('Copy is blocked here — select the link below and copy it.', true); });
                });

                document.getElementById('emailLinkBtn').addEventListener('click', sendLinkEmail);
            })
            .catch(function () { /* anonymous — customer mode */ });
    }

    function sendLinkEmail() {
        var email = val('fldEmail');
        if (!EMAIL_RE.test(email)) { sendStatus('Enter the customer\'s email address first.', true); document.getElementById('fldEmail').focus(); return; }
        if (!val('fldContact')) { sendStatus('Enter the customer\'s name first.', true); document.getElementById('fldContact').focus(); return; }
        var btn = document.getElementById('emailLinkBtn');
        btn.disabled = true;
        sendStatus('Sending…');
        var methods = METHODS.filter(function (x) { return checked(x[0]); }).map(function (x) { return x[1]; });
        fetch('/api/garment-waiver/send-link', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                to: email, customerName: val('fldContact'), company: val('fldCompany'), phone: val('fldPhone'),
                orderRef: val('fldOrderRef'), garments: val('fldGarments'), count: val('fldCount'), rep: val('fldRep'), methods: methods,
            }),
        }).then(function (resp) {
            return resp.json().catch(function () { return {}; }).then(function (data) {
                if (!resp.ok) throw new Error(data.error || ('HTTP ' + resp.status));
                return data;
            });
        }).then(function (data) {
            NWCAForm.markClean();
            sendStatus('Sent to ' + email + (data.link ? ' — the same link is below if you need to resend it.' : '.'));
        }).catch(function (err) {
            console.error('[garment-waiver] send-link failed:', err);
            sendStatus('NOT sent (' + (err && err.message ? err.message : 'request failed') + '). Copy the link below and email it yourself.', true);
        }).finally(function () { btn.disabled = false; });
    }

    // ── signature pad ─────────────────────────────────────────────────────
    // Strokes are stored NORMALISED to the canvas box they were drawn in
    // (0..1 with that box's aspect), then letter-boxed into whatever box the
    // canvas has now — so a phone rotation, a narrow reflow or the smaller
    // print box redraws the same signature undistorted. Pointer events cover
    // mouse, touch and pen; DPR-aware backing store; redrawn before printing.
    function createSignaturePad(canvas) {
        var ctx = canvas.getContext('2d');
        var strokes = [];        // arrays of {x, y} in 0..1 of the drawing box
        var drawBox = null;      // {w, h} CSS px of the box the strokes were drawn in
        var current = null;
        var activePointer = null;
        var locked = false;

        function cssSize() { var r = canvas.getBoundingClientRect(); return { w: Math.max(1, Math.round(r.width)), h: Math.max(1, Math.round(r.height)) }; }
        function penStyle(c, scale) { c.lineWidth = 2.4 * (scale || 1); c.lineCap = 'round'; c.lineJoin = 'round'; c.strokeStyle = getComputedStyle(canvas).color; }
        // Fit the drawing box into (w, h) preserving its aspect; returns {s, ox, oy}
        function fit(w, h) {
            if (!drawBox) return { s: 1, ox: 0, oy: 0, bw: w, bh: h };
            var s = Math.min(w / drawBox.w, h / drawBox.h);
            return { s: s, ox: (w - drawBox.w * s) / 2, oy: (h - drawBox.h * s) / 2 };
        }
        function drawStroke(c, pts, f) {
            if (!pts.length) return;
            var X = function (p) { return f.ox + p.x * drawBox.w * f.s; };
            var Y = function (p) { return f.oy + p.y * drawBox.h * f.s; };
            c.beginPath();
            c.moveTo(X(pts[0]), Y(pts[0]));
            if (pts.length === 1) c.lineTo(X(pts[0]) + 0.1, Y(pts[0]));
            for (var i = 1; i < pts.length; i++) c.lineTo(X(pts[i]), Y(pts[i]));
            c.stroke();
        }
        function redraw() {
            var s = cssSize();
            ctx.clearRect(0, 0, s.w, s.h);
            if (!strokes.length) return;
            var f = fit(s.w, s.h);
            penStyle(ctx, f.s);
            strokes.forEach(function (pts) { drawStroke(ctx, pts, f); });
        }
        function resize() {
            var s = cssSize(), dpr = window.devicePixelRatio || 1;
            canvas.width = Math.round(s.w * dpr);
            canvas.height = Math.round(s.h * dpr);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            redraw();
        }
        // Pointer position normalised to the CURRENT box, which equals the drawing box while a
        // signature is in progress (the box is fixed at the first stroke; Clear resets it).
        function pos(e) {
            var r = canvas.getBoundingClientRect();
            var w = Math.max(1, r.width), h = Math.max(1, r.height);
            return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / w)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / h)) };
        }

        canvas.addEventListener('pointerdown', function (e) {
            if (locked) return;
            e.preventDefault();
            if (current && activePointer !== null && e.pointerId !== activePointer) return; // second finger / palm
            activePointer = e.pointerId;
            try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* older browsers */ }
            if (!drawBox) drawBox = cssSize();
            else { var now = cssSize(); if (now.w !== drawBox.w || now.h !== drawBox.h) { resize(); } }
            current = [pos(e)];
            strokes.push(current);
            var f = fit(cssSize().w, cssSize().h);
            penStyle(ctx, f.s);
            drawStroke(ctx, current, f);
        });
        canvas.addEventListener('pointermove', function (e) {
            if (!current || e.pointerId !== activePointer) return;
            e.preventDefault();
            var p = pos(e);
            current.push(p);
            var n = current.length;
            var s = cssSize();
            var f = fit(s.w, s.h);
            ctx.beginPath();
            ctx.moveTo(f.ox + current[n - 2].x * drawBox.w * f.s, f.oy + current[n - 2].y * drawBox.h * f.s);
            ctx.lineTo(f.ox + p.x * drawBox.w * f.s, f.oy + p.y * drawBox.h * f.s);
            ctx.stroke();
        });
        function end(e) { if (e && activePointer !== null && e.pointerId !== activePointer) return; current = null; activePointer = null; }
        canvas.addEventListener('pointerup', end);
        canvas.addEventListener('pointercancel', end);
        window.addEventListener('resize', resize);
        window.addEventListener('beforeprint', resize); // print box is smaller — redraw at that size
        window.addEventListener('afterprint', resize);
        resize();

        return {
            clear: function () { if (locked) return; strokes = []; drawBox = null; current = null; redraw(); },
            isEmpty: function () { return !strokes.some(function (pts) { return pts.length > 1; }); },
            setLocked: function (on) { locked = !!on; current = null; canvas.classList.toggle('is-locked', locked); },
            // Fixed-size PNG export (letter-boxed, aspect kept), stepping down until it fits the cap; '' when empty/too big.
            toDataUrl: function (maxChars) {
                if (this.isEmpty()) return '';
                var sizes = [[600, 180], [400, 120], [300, 90]];
                for (var i = 0; i < sizes.length; i++) {
                    var off = document.createElement('canvas');
                    off.width = sizes[i][0]; off.height = sizes[i][1];
                    var c = off.getContext('2d');
                    var f = fit(sizes[i][0], sizes[i][1]);
                    penStyle(c, f.s);
                    strokes.forEach(function (pts) { drawStroke(c, pts, f); });
                    var url;
                    try { url = off.toDataURL('image/png'); } catch (e) { return ''; }
                    if (url.length <= maxChars) return url;
                }
                return '';
            },
        };
    }
})();
