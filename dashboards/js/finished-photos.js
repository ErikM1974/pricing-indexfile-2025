/**
 * Finished Photos — staff capture + manage (factory iPad / phones).
 *
 * Flow: search a customer → pick the design → snap/choose a photo → upload. New photos land
 * HIDDEN; a staffer taps "Show to customer" to publish to that customer's portal.
 *
 * Auth: the page is SAML-gated (served under /dashboards/). Open reads (customer search, designs)
 * and the photo UPLOAD go straight to the proxy (the upload route is open + rate-limited, same as the
 * mockup uploads). The manage list/approve/delete go same-origin to /api/staff/finished-photos, which
 * forwards to the proxy with the CRM secret (server.js).
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
    function debounce(fn, ms) {
        var t; return function () { var a = arguments, self = this; clearTimeout(t); t = setTimeout(function () { fn.apply(self, a); }, ms); };
    }

    var state = { cust: null, design: null, designChosen: false, file: null };

    // ── Customer search (open proxy GET) ──
    var searchInput = el('fp-cust-search'), results = el('fp-cust-results');
    searchInput.addEventListener('input', debounce(function () {
        var q = searchInput.value.trim();
        if (q.length < 2) { results.hidden = true; results.innerHTML = ''; return; }
        fetch(apiBase() + '/api/company-contacts/search?q=' + encodeURIComponent(q) + '&limit=15')
            .then(function (r) { return r.ok ? r.json() : { contacts: [] }; })
            .then(function (d) {
                var seen = {}, rows = [];
                ((d && d.contacts) || []).forEach(function (c) { var id = c.id_Customer; if (id && !seen[id]) { seen[id] = 1; rows.push(c); } });
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
        pickCustomer(btn.getAttribute('data-id'), btn.getAttribute('data-name'));
    });

    function pickCustomer(id, name) {
        state.cust = { id: id, name: name }; state.design = null; state.designChosen = false;
        el('fp-cust-picker').hidden = true;
        el('fp-cust-chosen').hidden = false;
        el('fp-cust-name').textContent = name || ('Customer ' + id);
        el('fp-cust-id').textContent = '#' + id;
        results.hidden = true; results.innerHTML = ''; searchInput.value = '';
        el('fp-step-design').hidden = false;
        el('fp-design-grid').hidden = false; el('fp-design-none').hidden = false; el('fp-design-chosen').hidden = true;
        el('fp-step-photo').hidden = true;
        el('fp-step-manage').hidden = false;
        loadDesigns(id);
        loadManage(id);
    }
    el('fp-cust-change').addEventListener('click', function () {
        el('fp-cust-picker').hidden = false; el('fp-cust-chosen').hidden = true;
        el('fp-step-design').hidden = true; el('fp-step-photo').hidden = true; el('fp-step-manage').hidden = true;
        state.cust = null; searchInput.focus();
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
        state.design = { number: num, name: name }; state.designChosen = true;
        el('fp-design-grid').hidden = true; el('fp-design-none').hidden = true; el('fp-design-chosen').hidden = false;
        el('fp-design-name').textContent = name || (num ? 'Design #' + num : 'General photo (no specific design)');
        el('fp-design-num').textContent = num ? '#' + num : '';
        el('fp-step-photo').hidden = false;
        refreshUploadBtn();
    }
    el('fp-design-change').addEventListener('click', function () {
        el('fp-design-grid').hidden = false; el('fp-design-none').hidden = false; el('fp-design-chosen').hidden = true;
        state.designChosen = false; refreshUploadBtn();
    });

    // ── Photo ──
    var fileInput = el('fp-file');
    fileInput.addEventListener('change', function () {
        var f = fileInput.files && fileInput.files[0];
        state.file = f || null;
        if (f) { el('fp-preview').src = URL.createObjectURL(f); el('fp-preview-wrap').hidden = false; }
        else { el('fp-preview-wrap').hidden = true; }
        refreshUploadBtn();
    });
    function refreshUploadBtn() { el('fp-upload-btn').disabled = !(state.file && state.designChosen && state.cust); }
    function setStatus(kind, msg) { var s = el('fp-status'); s.className = 'fp-status is-' + kind; s.textContent = msg; }

    el('fp-upload-btn').addEventListener('click', function () {
        if (!(state.file && state.cust && state.designChosen)) return;
        var btn = el('fp-upload-btn');
        btn.disabled = true; setStatus('busy', 'Uploading…');
        var fd = new FormData();
        fd.append('file', state.file);
        fd.append('idCustomer', state.cust.id);
        if (state.design.number) fd.append('designNumber', state.design.number);
        if (state.design.name) fd.append('designName', state.design.name);
        fd.append('companyName', state.cust.name || '');
        var cap = el('fp-caption').value.trim(); if (cap) fd.append('caption', cap);
        fetch(apiBase() + '/api/finished-photos', { method: 'POST', body: fd })
            .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
            .then(function (res) {
                if (!res.ok || !res.j.success) throw new Error((res.j && res.j.error) || 'Upload failed');
                setStatus('ok', '✓ Uploaded — it’s hidden until you tap “Show to customer” below.');
                fileInput.value = ''; state.file = null; el('fp-preview-wrap').hidden = true; el('fp-caption').value = '';
                refreshUploadBtn();
                loadManage(state.cust.id);
            })
            .catch(function (err) { setStatus('err', '✗ ' + (err.message || 'Upload failed')); btn.disabled = false; });
    });

    // ── Manage: list / approve / delete (same-origin, SAML-gated → proxy with secret) ──
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
                    return '<div class="fp-mrow" data-pk="' + esc(p.pkId) + '">'
                        + '<img src="' + esc(p.imageUrl) + '" alt="" loading="lazy">'
                        + '<div class="fp-mrow-body"><div class="fp-mrow-title">' + esc(title) + '</div>'
                        + '<div class="fp-mrow-sub">' + (p.caption ? esc(p.caption) + ' · ' : '') + esc(fmtDate(p.uploadedDate)) + '</div></div>'
                        + '<div class="fp-mrow-actions">'
                        + '<button type="button" class="fp-toggle' + (on ? ' is-on' : '') + '" data-act="toggle" data-on="' + (on ? '1' : '0') + '">' + (on ? '✓ Shown' : 'Show to customer') + '</button>'
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
        if (act === 'toggle') {
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
})();
