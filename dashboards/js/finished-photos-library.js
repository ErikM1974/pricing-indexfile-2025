/**
 * finished-photos-library.js — controller for dashboards/finished-photos-library.html
 *
 * Company-wide finished-photo library, grouped by account, each account tagged with its
 * sales rep (Sales_Reps_2026 join done server-side). One fetch of
 * GET /api/staff/finished-photos/library (same-origin, SAML → proxy w/ CRM secret);
 * rep chips / search / visibility filters are applied client-side.
 *
 * Deep link: #rep=Taneisha%20Clark pre-selects that rep's chip (Mission Control's
 * "My Finished Photos" button lands here). #hash, never ?x= — house rule.
 *
 * Publish/Hide toggles PATCH /api/staff/finished-photos/:pk (same route the capture
 * page uses). Errors are always VISIBLE via DashPage.showError — never a silently
 * empty library.
 */
(function () {
    'use strict';

    var HOUSE = 'House / Unassigned';

    var state = {
        photos: [],       // raw rows from the library endpoint (newest first)
        reps: [],         // [{name, count}] from the endpoint (full dataset)
        rep: '',          // '' = all · rep full name · HOUSE
        search: '',
        visibility: 'all', // all | live | hidden
        truncated: 0,
    };

    function el(id) { return document.getElementById(id); }
    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }
    function fmtDate(s) {
        if (!s) return '';
        var d = new Date(s);
        if (isNaN(d.getTime())) return '';
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    document.addEventListener('DOMContentLoaded', function () {
        state.rep = repFromHash();
        wireControls();
        load(false);
    });

    function repFromHash() {
        var m = /(?:^|[#&])rep=([^&]*)/.exec(window.location.hash || '');
        if (!m) return '';
        try { return decodeURIComponent(m[1]); } catch (e) { return ''; }
    }

    function wireControls() {
        el('fpl-refresh').addEventListener('click', function () { load(true); });
        el('fpl-search').addEventListener('input', function () {
            state.search = el('fpl-search').value.trim().toLowerCase();
            render();
        });
        el('fpl-visibility').addEventListener('change', function () {
            state.visibility = el('fpl-visibility').value;
            render();
        });
        window.addEventListener('hashchange', function () {
            state.rep = repFromHash();
            render();
        });
        // Delegated once — the container survives every render(), so no stacking listeners.
        el('fpl-body').addEventListener('click', bodyClick);
        el('fpl-lightbox-close').addEventListener('click', closeLightbox);
        el('fpl-lightbox').addEventListener('click', function (e) {
            if (e.target === el('fpl-lightbox')) closeLightbox();
        });
        document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeLightbox(); });
    }

    // ── data ──
    function load(refresh) {
        DashPage.hideError();
        el('fpl-body').innerHTML = '<div class="dash-loading">Loading the photo library…</div>';
        fetch('/api/staff/finished-photos/library?limit=1000' + (refresh ? '&refresh=1' : ''), { credentials: 'same-origin' })
            .then(function (r) {
                return r.json().catch(function () { return {}; }).then(function (j) {
                    if (!r.ok || j.success === false) throw new Error(j.error || ('HTTP ' + r.status));
                    return j;
                });
            })
            .then(function (data) {
                state.photos = data.photos || [];
                state.reps = data.reps || [];
                state.truncated = data.truncated || 0;
                render();
            })
            .catch(function (err) {
                el('fpl-body').innerHTML = '<div class="fpl-empty">The library could not load.</div>';
                DashPage.showError('Unable to load finished photos: ' + err.message + ' — refresh to retry.');
            });
    }

    // ── filtering ──
    function filtered() {
        return state.photos.filter(function (p) {
            if (state.rep === HOUSE) { if (p.repName) return false; }
            else if (state.rep) { if ((p.repName || '').toLowerCase() !== state.rep.toLowerCase()) return false; }
            if (state.visibility === 'live' && !p.showToCustomer) return false;
            if (state.visibility === 'hidden' && p.showToCustomer) return false;
            if (state.search) {
                var hay = [p.companyName, p.designName, p.designNumber, p.caption, p.idOrder, p.repName]
                    .join(' ').toLowerCase();
                if (hay.indexOf(state.search) === -1) return false;
            }
            return true;
        });
    }

    // ── render ──
    function render() {
        renderStats();
        renderChips();
        var rows = filtered();
        var sub = rows.length + ' photo' + (rows.length === 1 ? '' : 's');
        if (state.rep) sub += ' · ' + state.rep;
        el('fpl-sub').textContent = '(' + sub + ')';

        if (!rows.length) {
            el('fpl-body').innerHTML = '<div class="fpl-empty">' +
                (state.photos.length
                    ? 'No photos match these filters.'
                    : 'No finished photos yet — snap the first one from the <a href="/dashboards/finished-photos.html">capture page</a>.') +
                '</div>';
            return;
        }

        // Group by account, sections ordered by their newest photo (rows arrive newest-first).
        var groups = [], byId = {};
        rows.forEach(function (p) {
            var key = String(p.idCustomer || '0');
            if (!byId[key]) {
                byId[key] = { idCustomer: key, company: p.companyName || ('Customer #' + key), repName: p.repName || '', photos: [] };
                groups.push(byId[key]);
            }
            if (!byId[key].company && p.companyName) byId[key].company = p.companyName;
            byId[key].photos.push(p);
        });

        el('fpl-body').innerHTML = groups.map(function (g) {
            return '<section class="fpl-account">' +
                '<div class="fpl-account-head">' +
                '<h3 class="fpl-account-name">' + esc(g.company) + '</h3>' +
                '<span class="fpl-rep-badge">' + esc(g.repName || HOUSE) + '</span>' +
                '<span class="fpl-account-meta">#' + esc(g.idCustomer) + ' · ' + g.photos.length + ' photo' + (g.photos.length === 1 ? '' : 's') + '</span>' +
                '</div>' +
                '<div class="fpl-grid">' + g.photos.map(cardHtml).join('') + '</div>' +
                '</section>';
        }).join('') +
            (state.truncated ? '<p class="fpl-more">Showing the newest 1,000 — ' + state.truncated + ' older photo' + (state.truncated === 1 ? '' : 's') + ' not loaded.</p>' : '');
    }

    function cardHtml(p) {
        var title = p.designName || (p.designNumber ? 'Design #' + p.designNumber : 'Finished photo');
        var subParts = [];
        if (p.designNumber && p.designName) subParts.push('Design #' + p.designNumber);
        if (p.idOrder) subParts.push('Order #' + p.idOrder);
        var dt = fmtDate(p.uploadedDate); if (dt) subParts.push(dt);
        var capBits = [p.companyName, title, p.caption].filter(Boolean).join(' · ');
        return '<article class="fpl-card" data-pk="' + esc(p.pkId) + '">' +
            '<button type="button" class="fpl-card-imgbtn" data-act="view" data-src="' + esc(p.imageUrl) + '" data-cap="' + esc(capBits) + '" aria-label="View full size">' +
            '<img src="' + esc(p.imageUrl) + '" alt="" loading="lazy" onerror="this.style.visibility=\'hidden\'">' +
            '</button>' +
            '<div class="fpl-card-body">' +
            '<div class="fpl-card-title">' + esc(title) + '</div>' +
            (subParts.length ? '<div>' + esc(subParts.join(' · ')) + '</div>' : '') +
            (p.caption ? '<div>' + esc(p.caption) + '</div>' : '') +
            '<div class="fpl-card-foot">' +
            (p.showToCustomer
                ? '<span class="fpl-live"><i class="fas fa-circle"></i> Live on portal</span><button type="button" class="fpl-pub-btn" data-act="pub" data-on="1">Hide</button>'
                : '<span class="fpl-hidden-note">Hidden</span><button type="button" class="fpl-pub-btn" data-act="pub" data-on="0">Publish</button>') +
            '</div></div></article>';
    }

    function bodyClick(e) {
        var btn = e.target.closest('[data-act]');
        if (!btn) return;
        if (btn.getAttribute('data-act') === 'view') {
            el('fpl-lightbox-img').src = btn.getAttribute('data-src') || '';
            el('fpl-lightbox-cap').textContent = btn.getAttribute('data-cap') || '';
            el('fpl-lightbox').hidden = false;
            return;
        }
        // publish / hide
        var card = btn.closest('.fpl-card[data-pk]');
        if (!card) return;
        var pk = card.getAttribute('data-pk');
        var turnOn = btn.getAttribute('data-on') !== '1';
        btn.disabled = true;
        fetch('/api/staff/finished-photos/' + encodeURIComponent(pk), {
            method: 'PATCH', credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ show: turnOn })
        })
            .then(function (r) {
                return r.json().catch(function () { return {}; }).then(function (j) {
                    if (!r.ok || j.success === false) throw new Error(j.error || ('HTTP ' + r.status));
                });
            })
            .then(function () {
                var p = state.photos.find(function (x) { return String(x.pkId) === pk; });
                if (p) p.showToCustomer = turnOn;
                render();
            })
            .catch(function (err) {
                btn.disabled = false;
                DashPage.showError('Photo NOT ' + (turnOn ? 'published' : 'hidden') + ': ' + err.message);
            });
    }

    function renderStats() {
        var live = 0, accounts = {};
        state.photos.forEach(function (p) {
            if (p.showToCustomer) live++;
            accounts[String(p.idCustomer || '0')] = 1;
        });
        el('fpl-stat-total').textContent = state.photos.length;
        el('fpl-stat-live').textContent = live;
        el('fpl-stat-hidden').textContent = state.photos.length - live;
        el('fpl-stat-accounts').textContent = Object.keys(accounts).length;
    }

    function renderChips() {
        var host = el('fpl-rep-chips');
        var chips = [{ name: '', label: 'All photos', count: state.photos.length }];
        state.reps.forEach(function (r) {
            chips.push({ name: r.name, label: r.name, count: r.count });
        });
        host.innerHTML = chips.map(function (c) {
            var active = (state.rep || '') === c.name ||
                (c.name !== '' && state.rep.toLowerCase() === c.name.toLowerCase());
            return '<button type="button" class="fpl-chip' + (active ? ' is-active' : '') + '" data-rep="' + esc(c.name) + '">' +
                esc(c.label) + '<span class="fpl-chip-count">' + c.count + '</span></button>';
        }).join('');
        Array.prototype.forEach.call(host.querySelectorAll('.fpl-chip'), function (btn) {
            btn.addEventListener('click', function () {
                state.rep = btn.getAttribute('data-rep') || '';
                // keep the hash shareable/bookmarkable
                var h = state.rep ? '#rep=' + encodeURIComponent(state.rep) : '';
                if (window.location.hash !== h) history.replaceState(null, '', window.location.pathname + h);
                render();
            });
        });
    }

    function closeLightbox() {
        el('fpl-lightbox').hidden = true;
        el('fpl-lightbox-img').src = '';
    }
})();
