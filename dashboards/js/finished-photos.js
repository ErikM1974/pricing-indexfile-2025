/**
 * Finished Photos — staff capture + manage (factory iPad / phones).
 *
 * Flow: find the order (scan the work-order barcode / type the order # / search the company)
 * → pick the design → snap/choose a photo → upload. New photos land HIDDEN; a staffer taps
 * "Publish" to show them on that customer's portal.
 *
 * Find modes:
 *   scan   — camera reads the work-order barcodes via the vendored html5-qrcode lib
 *            (footer barcode = order #, design-sheet barcode = "40121Loc1" → design + customer).
 *   order  — hand-typed order/design # (also catches keyboard-wedge scanners).
 *   search — company-name search (the original flow).
 * All three resolve through GET /api/staff/finished-photos/lookup (SAML) → proxy → ORDER_ODBC /
 * Designs2026.
 *
 * Auth: the page is SAML-gated (served under /dashboards/). Open reads (customer search, designs)
 * and the photo UPLOAD go straight to the proxy (the upload route is open + rate-limited, same as
 * the mockup uploads). Lookup + manage list/publish/delete go same-origin to
 * /api/staff/finished-photos*, which forwards to the proxy with the CRM secret (server.js).
 *
 * Photos are re-encoded client-side (≤2000px JPEG) before upload — an iPhone 12MP shot drops
 * ~4MB → ~500KB, so floor uploads are fast and the portal serves lean images.
 */
(function () {
    'use strict';

    var PROXY_DEFAULT = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
    function apiBase() {
        return (window.APP_CONFIG && window.APP_CONFIG.API && window.APP_CONFIG.API.BASE_URL) || PROXY_DEFAULT;
    }
    function el(id) { return document.getElementById(id); }
    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }
    function fmtDate(s) {
        if (!s) return '';
        try { var d = new Date(s); if (isNaN(d.getTime())) return ''; return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
        catch (e) { return ''; }
    }
    function fmtMB(bytes) {
        if (!(bytes > 0)) return '';
        return bytes >= 1024 * 1024 ? (bytes / (1024 * 1024)).toFixed(1) + ' MB' : Math.round(bytes / 1024) + ' KB';
    }
    function debounce(fn, ms) {
        var t; return function () { var a = arguments, self = this; clearTimeout(t); t = setTimeout(function () { fn.apply(self, a); }, ms); };
    }

    var state = { cust: null, order: null, design: null, designChosen: false, file: null };

    // ── Find modes (segmented control; last-used mode remembered per device) ──
    var MODE_KEY = 'nwca-fp-find-mode';
    var hasCamera = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    function setMode(mode, focus) {
        if (mode !== 'scan' && mode !== 'order' && mode !== 'search') mode = 'search';
        ['scan', 'order', 'search'].forEach(function (m) {
            var btn = el('fp-mode-' + m), pane = el('fp-pane-' + m);
            var on = m === mode;
            if (btn) { btn.classList.toggle('is-active', on); btn.setAttribute('aria-selected', on ? 'true' : 'false'); }
            if (pane) pane.hidden = !on;
        });
        try { localStorage.setItem(MODE_KEY, mode); } catch (e) { /* private browsing */ }
        setFindStatus('', '');
        if (focus) {
            if (mode === 'order') { var oi = el('fp-order-input'); if (oi) oi.focus(); }
            if (mode === 'search') { var si = el('fp-cust-search'); if (si) si.focus(); }
        }
    }
    document.querySelectorAll('.fp-mode').forEach(function (btn) {
        btn.addEventListener('click', function () { setMode(btn.getAttribute('data-mode'), true); });
    });
    (function initMode() {
        var saved = null;
        try { saved = localStorage.getItem(MODE_KEY); } catch (e) { /* ignore */ }
        if (saved === 'scan' && !hasCamera) saved = 'order';
        setMode(saved || (hasCamera ? 'scan' : 'search'), false);
    })();

    function setFindStatus(kind, msg) {
        var s = el('fp-find-status'); if (!s) return;
        s.className = 'fp-status' + (kind ? ' is-' + kind : ''); s.textContent = msg || '';
    }

    // ── Order / design # lookup (same-origin, SAML-gated → proxy with secret) ──
    function lookupCode(raw) {
        var code = String(raw == null ? '' : raw).trim();
        if (!code) return;
        setFindStatus('busy', 'Looking up “' + code + '”…');
        fetch('/api/staff/finished-photos/lookup?code=' + encodeURIComponent(code), { credentials: 'same-origin' })
            .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
            .then(function (res) {
                if (!res.ok || !res.j || res.j.success === false) {
                    throw new Error((res.j && res.j.error) || 'Lookup failed');
                }
                var m = res.j.match;
                if (!m) { setFindStatus('err', 'No order or design matches “' + code + '”. Try the company search.'); return; }
                if (!m.idCustomer) { setFindStatus('err', 'Found it, but there’s no customer on that record — use the company search.'); return; }
                setFindStatus('', '');
                if (m.type === 'order') {
                    pickCustomer(m.idCustomer, m.companyName, { order: m.orderNumber });
                } else {
                    pickCustomer(m.idCustomer, m.companyName, {});
                    pickDesign(m.designNumber, m.designName);
                }
            })
            .catch(function (err) {
                setFindStatus('err', '✗ ' + ((err && err.message) || 'Lookup failed — try the company search.'));
            });
    }
    el('fp-order-find').addEventListener('click', function () { lookupCode(el('fp-order-input').value); });
    el('fp-order-input').addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); lookupCode(el('fp-order-input').value); }
    });

    // ── Barcode scanner (vendored html5-qrcode — works on iOS Safari via getUserMedia) ──
    var scanner = null;
    function setScanStatus(msg) { var s = el('fp-scan-status'); if (s) s.textContent = msg; }
    function openScanner() {
        el('fp-scan-modal').hidden = false;
        setScanStatus('Starting camera…');
        if (!window.Html5Qrcode) { setScanStatus('Scanner failed to load — type the order # instead.'); return; }
        if (scanner) return; // already running
        var formats = null;
        if (window.Html5QrcodeSupportedFormats) {
            formats = [
                window.Html5QrcodeSupportedFormats.CODE_39,
                window.Html5QrcodeSupportedFormats.CODE_128,
                window.Html5QrcodeSupportedFormats.QR_CODE
            ];
        }
        try {
            scanner = new window.Html5Qrcode('fp-scan-video', formats ? { formatsToSupport: formats, verbose: false } : undefined);
        } catch (e) {
            scanner = null; setScanStatus('Scanner error — type the order # instead.'); return;
        }
        scanner.start(
            { facingMode: 'environment' },
            {
                fps: 10,
                // Wide, short box — these are 1-D Code 39 bars on paper.
                qrbox: function (vw, vh) { return { width: Math.min(340, Math.round(vw * 0.85)), height: 150 }; }
            },
            function (text) { closeScanner(); lookupCode(text); },
            function () { /* per-frame miss — normal */ }
        ).then(function () {
            setScanStatus('Point the camera at the barcode on the work order.');
        }).catch(function (err) {
            var name = (err && (err.name || err.message)) || 'error';
            setScanStatus('Camera unavailable (' + name + '). Type the order # instead.');
            var dead = scanner; scanner = null;
            if (dead) { try { dead.clear(); } catch (e) { /* not started */ } }
        });
    }
    function closeScanner() {
        el('fp-scan-modal').hidden = true;
        var s = scanner; scanner = null;
        if (s) {
            s.stop().then(function () { s.clear(); }).catch(function () { try { s.clear(); } catch (e) { /* already gone */ } });
        }
    }
    el('fp-scan-open').addEventListener('click', openScanner);
    el('fp-scan-close').addEventListener('click', closeScanner);
    el('fp-scan-modal').addEventListener('click', function (e) { if (e.target === el('fp-scan-modal')) closeScanner(); });

    // ── Customer search (open proxy GET) ──
    var searchInput = el('fp-cust-search'), results = el('fp-cust-results');
    searchInput.addEventListener('input', debounce(function () {
        var q = searchInput.value.trim();
        if (q.length < 2) { results.hidden = true; results.innerHTML = ''; return; }
        fetch(apiBase() + '/api/company-contacts/search?q=' + encodeURIComponent(q) + '&limit=25')
            .then(function (r) { return r.ok ? r.json() : { contacts: [] }; })
            .then(function (d) {
                var seen = {}, rows = [];
                ((d && d.contacts) || []).forEach(function (c) { var id = c.id_Customer; if (id && !seen[id]) { seen[id] = 1; rows.push(c); } });
                // A staffer is picking a COMPANY, not a contact named "Adam" — float company-name
                // matches to the top (name starts-with > contains > matched only via a contact/email).
                // Stable within a tier so the backend's most-recent-first order is preserved.
                var ql = q.toLowerCase();
                rows = rows.map(function (c, i) {
                    var n = String(c.CustomerCompanyName || '').toLowerCase();
                    var s = n.indexOf(ql) === 0 ? 3 : (n.indexOf(ql) !== -1 ? 2 : 1);
                    return { c: c, s: s, i: i };
                }).sort(function (a, b) { return b.s - a.s || a.i - b.i; }).map(function (x) { return x.c; });
                if (!rows.length) { results.innerHTML = '<div class="fp-result fp-muted">No matches</div>'; results.hidden = false; return; }
                results.innerHTML = rows.map(function (c) {
                    return '<button type="button" class="fp-result" data-id="' + esc(c.id_Customer) + '" data-name="' + esc(c.CustomerCompanyName) + '">'
                        + esc(c.CustomerCompanyName || ('Customer ' + c.id_Customer))
                        + '<span class="fp-r-sub">#' + esc(c.id_Customer) + (c.ct_NameFull ? ' · ' + esc(c.ct_NameFull) : '') + '</span></button>';
                }).join('');
                results.hidden = false;
            })
            .catch(function () { results.hidden = true; });
    }, 300));
    results.addEventListener('click', function (e) {
        var btn = e.target.closest('.fp-result[data-id]'); if (!btn) return;
        pickCustomer(btn.getAttribute('data-id'), btn.getAttribute('data-name'), {});
    });

    function pickCustomer(id, name, meta) {
        state.cust = { id: String(id), name: name || '' };
        state.order = (meta && meta.order) ? String(meta.order) : null;
        state.design = null; state.designChosen = false;
        el('fp-find-picker').hidden = true;
        el('fp-cust-chosen').hidden = false;
        el('fp-cust-name').textContent = state.cust.name || ('Customer ' + id);
        el('fp-cust-id').textContent = '#' + id;
        var oc = el('fp-order-chip');
        if (state.order) { oc.textContent = 'Order #' + state.order; oc.hidden = false; }
        else { oc.hidden = true; }
        results.hidden = true; results.innerHTML = ''; searchInput.value = '';
        setFindStatus('', '');
        el('fp-step-design').hidden = false;
        el('fp-design-grid').hidden = false; el('fp-design-none').hidden = false; el('fp-design-chosen').hidden = true;
        el('fp-design-hint').hidden = false;
        el('fp-step-photo').hidden = true;
        el('fp-step-manage').hidden = false;
        loadDesigns(state.cust.id);
        loadManage(state.cust.id);
    }
    el('fp-cust-change').addEventListener('click', function () {
        el('fp-find-picker').hidden = false; el('fp-cust-chosen').hidden = true;
        el('fp-step-design').hidden = true; el('fp-step-photo').hidden = true; el('fp-step-manage').hidden = true;
        state.cust = null; state.order = null;
        setMode(el('fp-mode-scan').classList.contains('is-active') ? 'scan'
            : el('fp-mode-order').classList.contains('is-active') ? 'order' : 'search', true);
    });

    // ── Designs (open proxy GET; method=all, not date-gated) ──
    function loadDesigns(cid) {
        var grid = el('fp-design-grid');
        grid.innerHTML = '<div class="fp-muted">Loading designs…</div>';
        fetch(apiBase() + '/api/designs/by-customer/' + encodeURIComponent(cid) + '?method=all&limit=200')
            .then(function (r) { return r.ok ? r.json() : { designs: [] }; })
            .then(function (d) {
                var ds = (d && d.designs) || [];
                if (!ds.length) { grid.innerHTML = '<div class="fp-muted">No registered designs — use “No specific design” below.</div>'; return; }
                grid.innerHTML = ds.map(function (x) {
                    var img = x.thumbnailUrl
                        ? '<img class="fp-d-img" src="' + esc(x.thumbnailUrl) + '" alt="" loading="lazy" onerror="this.style.visibility=\'hidden\'">'
                        : '<div class="fp-d-img"></div>';
                    return '<button type="button" class="fp-design" data-num="' + esc(x.idDesign) + '" data-name="' + esc(x.designName || '') + '">'
                        + img + '<div class="fp-d-cap"><b>#' + esc(x.idDesign) + '</b>' + esc(x.designName || '') + '</div></button>';
                }).join('');
            })
            .catch(function () { grid.innerHTML = '<div class="fp-muted">Couldn’t load designs.</div>'; });
    }
    el('fp-design-grid').addEventListener('click', function (e) {
        var b = e.target.closest('.fp-design[data-num]'); if (!b) return;
        pickDesign(b.getAttribute('data-num'), b.getAttribute('data-name'));
    });
    el('fp-design-none').addEventListener('click', function () { pickDesign('', ''); });
    function pickDesign(num, name) {
        state.design = { number: num ? String(num) : '', name: name || '' }; state.designChosen = true;
        el('fp-design-grid').hidden = true; el('fp-design-none').hidden = true; el('fp-design-hint').hidden = true;
        el('fp-design-chosen').hidden = false;
        el('fp-design-name').textContent = state.design.name || (num ? 'Design #' + num : 'General photo (no specific design)');
        el('fp-design-num').textContent = num ? '#' + num : 'no design';
        el('fp-step-photo').hidden = false;
        refreshUploadBtn();
    }
    el('fp-design-change').addEventListener('click', function () {
        el('fp-design-grid').hidden = false; el('fp-design-none').hidden = false; el('fp-design-hint').hidden = false;
        el('fp-design-chosen').hidden = true;
        state.designChosen = false; refreshUploadBtn();
    });

    // ── Photo ──
    // Two ways to add a photo: "Take a photo" (fp-file has capture=camera → opens the camera
    // directly, fast on the factory floor) and "Choose from album" (fp-file-album, no capture →
    // the phone's photo library + Files). Both feed the same handler, which re-encodes the image
    // down to ≤2000px JPEG before upload (huge phone originals otherwise crawl on shop wifi).
    var fileInput = el('fp-file');
    var albumInput = el('fp-file-album');
    var previewUrl = null;

    function prepareImage(file) {
        return new Promise(function (resolve) {
            if (!file) return resolve({ file: file, note: '' });
            var url;
            try { url = URL.createObjectURL(file); } catch (e) { return resolve({ file: file, note: '' }); }
            var img = new Image();
            img.onload = function () {
                try {
                    var w = img.naturalWidth, h = img.naturalHeight;
                    var MAX = 2000;
                    var scale = Math.min(1, MAX / Math.max(w, h || 1));
                    var isWebFormat = /^image\/(jpe?g|png|webp)$/i.test(file.type || '');
                    // Skip the re-encode only when it can't help: already web-friendly, small, and modest pixels.
                    if (scale === 1 && isWebFormat && file.size <= 1500 * 1024) {
                        URL.revokeObjectURL(url); return resolve({ file: file, note: '' });
                    }
                    var cw = Math.max(1, Math.round(w * scale)), ch = Math.max(1, Math.round(h * scale));
                    var c = document.createElement('canvas'); c.width = cw; c.height = ch;
                    c.getContext('2d').drawImage(img, 0, 0, cw, ch);
                    c.toBlob(function (b) {
                        URL.revokeObjectURL(url);
                        if (!b || (b.size >= file.size && isWebFormat)) return resolve({ file: file, note: '' });
                        var name = String(file.name || 'photo').replace(/\.[^.]+$/, '') + '.jpg';
                        var out;
                        try { out = new File([b], name, { type: 'image/jpeg' }); } catch (e) { out = b; }
                        resolve({ file: out, note: fmtMB(file.size) + ' → ' + fmtMB(b.size) });
                    }, 'image/jpeg', 0.85);
                } catch (e) { URL.revokeObjectURL(url); resolve({ file: file, note: '' }); }
            };
            img.onerror = function () { URL.revokeObjectURL(url); resolve({ file: file, note: '' }); }; // HEIC on desktop etc. — upload the original
            img.src = url;
        });
    }

    function onPhotoChosen(f) {
        if (!f) {
            state.file = null; el('fp-preview-wrap').hidden = true; el('fp-photo-btns').hidden = false;
            refreshUploadBtn(); return;
        }
        setStatus('busy', 'Preparing photo…');
        prepareImage(f).then(function (out) {
            state.file = out.file;
            if (previewUrl) { try { URL.revokeObjectURL(previewUrl); } catch (e) { /* ignore */ } }
            previewUrl = URL.createObjectURL(out.file);
            el('fp-preview').src = previewUrl;
            el('fp-preview-wrap').hidden = false;
            el('fp-photo-btns').hidden = true;
            var note = el('fp-size-note');
            if (out.note) { note.textContent = out.note; note.hidden = false; } else { note.hidden = true; }
            setStatus('', '');
            refreshUploadBtn();
        });
    }
    fileInput.addEventListener('change', function () { onPhotoChosen(fileInput.files && fileInput.files[0]); });
    if (albumInput) albumInput.addEventListener('change', function () { onPhotoChosen(albumInput.files && albumInput.files[0]); });
    el('fp-retake').addEventListener('click', function () {
        fileInput.value = ''; if (albumInput) albumInput.value = '';
        onPhotoChosen(null);
    });
    el('fp-caption-chips').addEventListener('click', function (e) {
        var chip = e.target.closest('.fp-cchip[data-cap]'); if (!chip) return;
        var input = el('fp-caption');
        var cap = chip.getAttribute('data-cap');
        input.value = input.value.trim() ? (input.value.trim() + ' · ' + cap) : cap;
    });

    function refreshUploadBtn() { el('fp-upload-btn').disabled = !(state.file && state.designChosen && state.cust); }
    function setStatus(kind, msg) { var s = el('fp-status'); s.className = 'fp-status' + (kind ? ' is-' + kind : ''); s.textContent = msg || ''; }

    el('fp-upload-btn').addEventListener('click', function () {
        if (!(state.file && state.cust && state.designChosen)) return;
        var btn = el('fp-upload-btn');
        btn.disabled = true; setStatus('busy', 'Uploading…');
        var fd = new FormData();
        fd.append('file', state.file);
        fd.append('idCustomer', state.cust.id);
        if (state.design.number) fd.append('designNumber', state.design.number);
        if (state.design.name) fd.append('designName', state.design.name);
        if (state.order) fd.append('idOrder', state.order);
        fd.append('companyName', state.cust.name || '');
        var cap = el('fp-caption').value.trim(); if (cap) fd.append('caption', cap);
        fetch(apiBase() + '/api/finished-photos', { method: 'POST', body: fd })
            .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
            .then(function (res) {
                if (!res.ok || !res.j.success) throw new Error((res.j && res.j.error) || 'Upload failed');
                setStatus('ok', '✓ Uploaded — it stays hidden until you tap “Publish” below.');
                fileInput.value = ''; if (albumInput) albumInput.value = '';
                state.file = null;
                el('fp-preview-wrap').hidden = true; el('fp-photo-btns').hidden = false;
                el('fp-caption').value = '';
                refreshUploadBtn();
                loadManage(state.cust.id);
            })
            .catch(function (err) { setStatus('err', '✗ ' + (err.message || 'Upload failed')); btn.disabled = false; });
    });

    // ── Manage: list / publish / delete (same-origin, SAML-gated → proxy with secret) ──
    function loadManage(cid) {
        var listEl = el('fp-manage-list'), emptyEl = el('fp-manage-empty');
        listEl.innerHTML = '<div class="fp-muted">Loading…</div>'; emptyEl.hidden = true;
        fetch('/api/staff/finished-photos?idCustomer=' + encodeURIComponent(cid), { credentials: 'same-origin' })
            .then(function (r) { return r.ok ? r.json() : { photos: [] }; })
            .then(function (d) {
                var ps = (d && d.photos) || [];
                if (!ps.length) { listEl.innerHTML = ''; emptyEl.hidden = false; return; }
                listEl.innerHTML = ps.map(function (p) {
                    var title = p.designName || (p.designNumber ? 'Design #' + p.designNumber : 'Finished photo');
                    var on = !!p.showToCustomer;
                    // Sub-line: design # (when the title is a name, so it isn't repeated) · caption · date.
                    var subParts = [];
                    if (p.designNumber && p.designName) subParts.push('Design #' + p.designNumber);
                    if (p.idOrder) subParts.push('Order #' + p.idOrder);
                    if (p.caption) subParts.push(p.caption);
                    var dt = fmtDate(p.uploadedDate); if (dt) subParts.push(dt);
                    var sub = subParts.map(esc).join(' · ');
                    return '<div class="fp-mrow' + (on ? ' is-live' : '') + '" data-pk="' + esc(p.pkId) + '">'
                        + '<button type="button" class="fp-mrow-thumb" data-act="view" data-src="' + esc(p.imageUrl) + '" aria-label="View photo full size">'
                        + '<img src="' + esc(p.imageUrl) + '" alt="" loading="lazy"></button>'
                        + '<div class="fp-mrow-body"><div class="fp-mrow-title">' + esc(title) + '</div>'
                        + '<div class="fp-mrow-sub">' + (on ? '<span class="fp-live-dot">Live on portal</span>' + (sub ? ' · ' : '') : '') + sub + '</div></div>'
                        + '<div class="fp-mrow-actions">'
                        + '<button type="button" class="fp-toggle' + (on ? ' is-on' : '') + '" data-act="toggle" data-on="' + (on ? '1' : '0') + '">' + (on ? '✓ Published' : 'Publish') + '</button>'
                        + '<button type="button" class="fp-del" data-act="del">Delete</button>'
                        + '</div></div>';
                }).join('');
            })
            .catch(function () { listEl.innerHTML = '<div class="fp-muted">Couldn’t load photos.</div>'; });
    }
    el('fp-manage-list').addEventListener('click', function (e) {
        var row = e.target.closest('.fp-mrow[data-pk]'); if (!row) return;
        var t = e.target.closest('[data-act]'); if (!t) return;
        var pk = row.getAttribute('data-pk'), act = t.getAttribute('data-act');
        if (act === 'view') {
            var src = t.getAttribute('data-src');
            if (src) { el('fp-lightbox-img').src = src; el('fp-lightbox').hidden = false; }
        } else if (act === 'toggle') {
            var turnOn = t.getAttribute('data-on') !== '1';
            t.disabled = true;
            fetch('/api/staff/finished-photos/' + encodeURIComponent(pk), {
                method: 'PATCH', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ show: turnOn })
            }).then(function (r) { return r.json(); })
                .then(function () { if (state.cust) loadManage(state.cust.id); })
                .catch(function () { t.disabled = false; });
        } else if (act === 'del') {
            if (!window.confirm('Delete this photo permanently?')) return;
            fetch('/api/staff/finished-photos/' + encodeURIComponent(pk), { method: 'DELETE', credentials: 'same-origin' })
                .then(function () { if (state.cust) loadManage(state.cust.id); })
                .catch(function () { });
        }
    });
    function closeLightbox() { el('fp-lightbox').hidden = true; el('fp-lightbox-img').src = ''; }
    el('fp-lightbox-close').addEventListener('click', closeLightbox);
    el('fp-lightbox').addEventListener('click', function (e) { if (e.target === el('fp-lightbox')) closeLightbox(); });
})();
