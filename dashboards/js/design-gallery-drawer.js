/**
 * Design Vault — inspector drawer (window.DG.drawer)
 *
 * Opens instantly from the local index, then hydrates three server sources in
 * parallel: digitized-designs/lookup (variants, DST files, threads, placement),
 * artrequests (Steve), mockups (Ruth). Each section owns its own error state —
 * a failed section says so inline with a Retry button and never silently
 * vanishes (Rule 4 at section granularity).
 *
 * Images from every source are merged into one labeled strip, deduped by URL
 * (the pattern from pages/js/design-view.js collectAllImages, extended with the
 * art/mockup slots). Hero click opens the lightbox and upgrades to ?size=large
 * once that image actually loads — never swap in a URL that might 404.
 *
 * History is NOT touched here; DG.app owns the URL. The drawer reports movement
 * through opts.onNavigate so back/forward stays in one place.
 *
 * Contract: scratchpad DG-CONTRACTS.md §DG.drawer.
 */
(function () {
    'use strict';

    window.DG = window.DG || {};

    var els = {};
    var cbs = { onNavigate: null, onCustomerClick: null };
    var state = { dn: 0, list: [], idx: -1, images: [], active: 0, lastFocus: null, token: 0 };
    var wired = false;

    var ART_SLOTS = ['Box_File_Mockup', 'BoxFileLink', 'Company_Mockup', 'Mockup_4', 'Mockup_5', 'Mockup_6'];
    var RUTH_SLOTS = ['Box_Mockup_1', 'Box_Mockup_2', 'Box_Mockup_3', 'Box_Mockup_4', 'Box_Mockup_5', 'Box_Mockup_6'];

    function base() {
        if (!window.APP_CONFIG || !APP_CONFIG.API || !APP_CONFIG.API.BASE_URL) {
            throw new Error('APP_CONFIG.API.BASE_URL missing');
        }
        return APP_CONFIG.API.BASE_URL;
    }

    function getJSON(url) {
        var f = window.fetchWithTimeout || window.fetch;
        return f(url, { headers: { Accept: 'application/json' } }).then(function (r) {
            if (!r.ok) throw new Error('HTTP ' + r.status);
            return r.json();
        });
    }

    /** Push a URL into the strip if it's real and not already present. */
    function addImage(list, seen, url, label) {
        if (!url || typeof url !== 'string') return;
        var u = url.trim();
        if (u.length <= 10) return;                 // same guard the index uses
        var key = u.toLowerCase();
        if (seen[key]) return;
        seen[key] = 1;
        list.push({ url: u, label: label });
    }

    function fmtStitch(n) {
        n = +n || 0;
        if (!n) return '';
        return n >= 1000 ? (Math.round(n / 100) / 10) + 'k st' : n + ' st';
    }

    function fmtYYMM(v) {
        v = +v || 0;
        if (!v) return '';
        var yy = Math.floor(v / 100), mm = v % 100;
        var MONTHS = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return (MONTHS[mm] || '') + ' 20' + (yy < 10 ? '0' + yy : yy);
    }

    function metaRow(label, valueHTML) {
        if (!valueHTML) return '';
        return '<div class="dg-meta-row"><dt>' + DG.esc(label) + '</dt><dd>' + valueHTML + '</dd></div>';
    }

    function sectionShell(id, icon, title) {
        return '<section class="dg-drawer-section" data-section="' + id + '">'
            + '<h3><i class="fas ' + icon + '"></i> ' + DG.esc(title) + '</h3>'
            + '<div class="dg-section-body" data-body="' + id + '"><div class="dg-skel dg-skel--rows"></div></div>'
            + '</section>';
    }

    function sectionError(id, msg) {
        var host = els.body && els.body.querySelector('[data-body="' + id + '"]');
        if (!host) return;
        host.innerHTML = '<div class="dg-section-err">'
            + '<i class="fas fa-triangle-exclamation"></i> '
            + DG.esc(msg)
            + ' <button type="button" class="dash-btn dash-btn--sm" data-retry="' + id + '">Retry</button>'
            + '</div>';
    }

    function setSection(id, html) {
        var host = els.body && els.body.querySelector('[data-body="' + id + '"]');
        if (host) host.innerHTML = html;
    }

    // ── image strip ─────────────────────────────────────────────────────────
    function renderStrip() {
        if (!state.images.length) {
            els.body.querySelector('[data-hero]').innerHTML =
                '<div class="dg-card-tile dg-tile-' + (state.dn % 8) + '"><span>No image on file</span></div>';
            return;
        }
        var img = state.images[state.active] || state.images[0];
        var hero = els.body.querySelector('[data-hero]');
        hero.innerHTML = '<img src="' + DG.esc(img.url) + '" alt="' + DG.esc(img.label + ' for design ' + state.dn) + '" data-hero-img>';

        var strip = '';
        for (var i = 0; i < state.images.length; i++) {
            strip += '<button type="button" class="dg-strip-thumb' + (i === state.active ? ' dg-strip-thumb--active' : '') + '"'
                + ' data-img="' + i + '" title="' + DG.esc(state.images[i].label) + '">'
                + '<img src="' + DG.esc(state.images[i].url) + '" alt="" loading="lazy" decoding="async">'
                + '<span>' + DG.esc(state.images[i].label) + '</span>'
                + '</button>';
        }
        els.body.querySelector('[data-strip]').innerHTML = strip;
    }

    function addImagesAndRefresh(fn) {
        var seen = {};
        for (var i = 0; i < state.images.length; i++) seen[state.images[i].url.toLowerCase()] = 1;
        var before = state.images.length;
        fn(state.images, seen);
        if (state.images.length !== before) renderStrip();
    }

    // ── hydration ───────────────────────────────────────────────────────────
    function hydrateLookup(dn, token) {
        return getJSON(base() + '/api/digitized-designs/lookup?designs=' + encodeURIComponent(dn))
            .then(function (data) {
                if (token !== state.token) return;
                var d = data && data.designs && data.designs[String(dn)];
                if (!d) { setSection('detail', '<p class="dg-empty">No digitized record for this design.</p>'); return; }

                addImagesAndRefresh(function (list, seen) {
                    addImage(list, seen, d.mockupUrl, 'Mockup');
                    addImage(list, seen, d.dstPreviewUrl, 'DST preview');
                    addImage(list, seen, d.thumbnailUrl, 'Thumbnail');
                    addImage(list, seen, d.artworkUrl, 'Artwork');
                    var vs = d.variants || [];
                    for (var i = 0; i < vs.length; i++) {
                        var tag = vs[i].dstFilename ? String(vs[i].dstFilename) : ('Variant ' + (i + 1));
                        addImage(list, seen, vs[i].dstPreviewUrl, tag);
                        addImage(list, seen, vs[i].thumbnailUrl, tag);
                    }
                });

                var rows = '';
                rows += metaRow('Placement', d.placement ? DG.esc(d.placement) : '');
                if (d.threadColors) {
                    var chips = String(d.threadColors).split(/[,;/]+/).map(function (t) {
                        t = t.trim();
                        return t ? '<span class="dg-chip">' + DG.esc(t) + '</span>' : '';
                    }).join('');
                    rows += metaRow('Thread colors', chips);
                }
                var files = (d.variants || []).filter(function (v) { return v.dstFilename; });
                var dst = '';
                if (files.length) {
                    dst = '<ul class="dg-dst-list">';
                    for (var j = 0; j < files.length; j++) {
                        var fn = String(files[j].dstFilename);
                        dst += '<li><span class="dg-mono">' + DG.esc(fn) + '</span>'
                            + (files[j].stitchCount ? '<em>' + DG.esc(fmtStitch(files[j].stitchCount)) + '</em>' : '')
                            + '<button type="button" class="dg-copy-inline" data-copy-text="' + DG.esc(fn) + '" title="Copy filename"><i class="fas fa-copy"></i></button></li>';
                    }
                    dst += '</ul>';
                }
                setSection('detail', (rows ? '<dl class="dg-meta-rows">' + rows + '</dl>' : '')
                    + (dst || (rows ? '' : '<p class="dg-empty">No stitch detail recorded.</p>')));
            })
            .catch(function (err) {
                if (token !== state.token) return;
                sectionError('detail', 'Stitch detail unavailable (' + err.message + ').');
            });
    }

    function hydrateArt(dn, token) {
        return getJSON(base() + '/api/artrequests?id_designs=' + encodeURIComponent(dn) + '&limit=20')
            .then(function (data) {
                if (token !== state.token) return;
                var rows = Array.isArray(data) ? data : (data && data.Result) || [];
                addImagesAndRefresh(function (list, seen) {
                    for (var i = 0; i < rows.length; i++) {
                        for (var s = 0; s < ART_SLOTS.length; s++) {
                            addImage(list, seen, rows[i][ART_SLOTS[s]], 'Steve · art request');
                        }
                    }
                });
                if (!rows.length) { setSection('art', '<p class="dg-empty">No art requests for this design.</p>'); return; }
                var html = '<ul class="dg-mini-list">';
                for (var k = 0; k < rows.length && k < 8; k++) {
                    var r = rows[k];
                    html += '<li><span class="dg-mono">#' + DG.esc(String(r.ID_Design || dn)) + '</span> '
                        + DG.esc(r.CompanyName || '')
                        + (r.Status ? ' <span class="dg-chip">' + DG.esc(r.Status) + '</span>' : '')
                        + (r.Date_Created ? ' <em>' + DG.esc(String(r.Date_Created).slice(0, 10)) + '</em>' : '')
                        + '</li>';
                }
                setSection('art', html + '</ul>');
            })
            .catch(function (err) {
                if (token !== state.token) return;
                sectionError('art', 'Art requests unavailable (' + err.message + ').');
            });
    }

    function hydrateRuth(dn, token) {
        return getJSON(base() + '/api/mockups?designNumber=' + encodeURIComponent(dn) + '&limit=20')
            .then(function (data) {
                if (token !== state.token) return;
                var rows = (data && data.records) || [];
                addImagesAndRefresh(function (list, seen) {
                    for (var i = 0; i < rows.length; i++) {
                        for (var s = 0; s < RUTH_SLOTS.length; s++) {
                            addImage(list, seen, rows[i][RUTH_SLOTS[s]], 'Ruth · mockup');
                        }
                        addImage(list, seen, rows[i].Box_Reference_File, 'Reference');
                    }
                });
                if (!rows.length) { setSection('ruth', '<p class="dg-empty">No digitizing mockups for this design.</p>'); return; }
                var html = '<ul class="dg-mini-list">';
                for (var k = 0; k < rows.length && k < 8; k++) {
                    var r = rows[k];
                    html += '<li>' + DG.esc(r.Company_Name || '')
                        + (r.Status ? ' <span class="dg-chip">' + DG.esc(r.Status) + '</span>' : '')
                        + (r.Submitted_Date ? ' <em>' + DG.esc(String(r.Submitted_Date).slice(0, 10)) + '</em>' : '')
                        + '</li>';
                }
                setSection('ruth', html + '</ul>');
            })
            .catch(function (err) {
                if (token !== state.token) return;
                sectionError('ruth', 'Digitizing mockups unavailable (' + err.message + ').');
            });
    }

    function hydrate(dn, token) {
        hydrateLookup(dn, token);
        hydrateArt(dn, token);
        hydrateRuth(dn, token);
    }

    // ── open / close / navigate ─────────────────────────────────────────────
    function shellHTML(d) {
        var pos = state.list.length > 1 && state.idx >= 0
            ? '<span class="dg-actions-pos dg-mono">' + (state.idx + 1) + ' of ' + state.list.length + '</span>' : '';
        var rows = '';
        rows += metaRow('Customer', d.customerId
            ? '<button type="button" class="dg-chip" data-customer="' + (+d.customerId) + '">#' + (+d.customerId) + (d.company ? ' · ' + DG.esc(d.company) : '') + '</button>'
            : (d.company ? DG.esc(d.company) : ''));
        rows += metaRow('Sales rep', d.rep ? DG.esc(d.rep) : '');
        rows += metaRow('Customer type', d.custType ? DG.esc(d.custType) : '');
        rows += metaRow('Stitches', d.maxStitch ? DG.esc(fmtStitch(d.maxStitch)) + (d.tier ? ' · ' + DG.esc(d.tier) : '') : (d.tier ? DG.esc(d.tier) : ''));
        rows += metaRow('Orders', d.orderCount ? (d.orderCount + (d.lastOrderYYMM ? ' · last ' + DG.esc(fmtYYMM(d.lastOrderYYMM)) : '')) : '');
        rows += metaRow('Variants', d.variantCount > 1 ? String(d.variantCount) : '');
        if (d.dupGroup && d.dupGroup.length > 1) {
            var others = d.dupGroup.filter(function (n) { return +n !== +d.dn; });
            var links = others.map(function (n) {
                return '<button type="button" class="dg-chip" data-goto="' + (+n) + '">#' + (+n) + '</button>';
            }).join('');
            rows += metaRow('Possible duplicates', links);
        }

        return '<header class="dg-drawer-head">'
            + '<div><h2 class="dg-mono">#' + (+d.dn) + '</h2>'
            + '<p class="dg-drawer-company">' + DG.esc(d.company || '') + '</p>'
            + '<p class="dg-drawer-name">' + DG.esc(d.name || '') + '</p></div>'
            + '<button type="button" class="dg-drawer-close" data-close="1" aria-label="Close"><i class="fas fa-xmark"></i></button>'
            + '</header>'
            + '<div class="dg-drawer-hero" data-hero></div>'
            + '<div class="dg-drawer-strip" data-strip></div>'
            + '<dl class="dg-meta-rows">' + rows + '</dl>'
            + sectionShell('detail', 'fa-microchip', 'Stitch detail & files')
            + sectionShell('art', 'fa-palette', "Steve's art requests")
            + sectionShell('ruth', 'fa-layer-group', "Ruth's mockups")
            + '<div class="dg-actions">'
            + '<button type="button" class="dash-btn dash-btn--primary" data-act="copy"><i class="fas fa-copy"></i> Copy #</button>'
            + '<button type="button" class="dash-btn" data-act="share"><i class="fas fa-link"></i> Share</button>'
            + '<a class="dash-btn" data-act="quote" href="/quote-builders/embroidery-quote-builder.html?design=' + (+d.dn) + '"><i class="fas fa-file-invoice-dollar"></i> Quote</a>'
            + '<span class="dg-actions-nav">'
            + '<button type="button" class="dash-btn" data-act="prev" aria-label="Previous design"><i class="fas fa-chevron-left"></i></button>'
            + pos
            + '<button type="button" class="dash-btn" data-act="next" aria-label="Next design"><i class="fas fa-chevron-right"></i></button>'
            + '</span></div>';
    }

    function open(dn, opts) {
        dn = +dn || 0;
        var d = DG.search.byDn(dn);
        if (!d) return false;
        opts = opts || {};
        state.dn = dn;
        state.list = opts.list || [];
        state.idx = typeof opts.idx === 'number' ? opts.idx : state.list.indexOf(dn);
        state.active = 0;
        state.token++;
        state.images = [];
        if (!els.drawer) return false;
        if (document.activeElement && els.drawer.hidden) state.lastFocus = document.activeElement;

        els.body.innerHTML = shellHTML(d);
        addImagesAndRefresh(function (list, seen) {
            addImage(list, seen, d.imgUrl, 'Index thumbnail');
        });
        renderStrip();

        els.drawer.hidden = false;
        els.overlay.hidden = false;
        document.body.classList.add('dg-drawer-open');
        var closeBtn = els.body.querySelector('[data-close]');
        if (closeBtn) closeBtn.focus();

        hydrate(dn, state.token);
        return true;
    }

    function close() {
        if (!els.drawer || els.drawer.hidden) return;
        state.token++;                       // orphan any in-flight hydration
        els.drawer.hidden = true;
        els.overlay.hidden = true;
        document.body.classList.remove('dg-drawer-open');
        if (state.lastFocus && state.lastFocus.focus) state.lastFocus.focus();
        state.lastFocus = null;
    }

    function isOpen() { return !!(els.drawer && !els.drawer.hidden); }

    function step(delta) {
        if (!state.list.length || state.idx < 0) return;
        var next = state.idx + delta;
        if (next < 0 || next >= state.list.length) return;
        var dn = state.list[next];
        if (open(dn, { list: state.list, idx: next }) && cbs.onNavigate) cbs.onNavigate(dn);
    }

    // ── lightbox ────────────────────────────────────────────────────────────
    function openLightbox() {
        var img = state.images[state.active];
        if (!img || !els.lightbox) return;
        els.lightboxImg.src = img.url;
        els.lightboxCap.textContent = img.label + ' · design ' + state.dn;
        els.lightbox.hidden = false;
        // Upgrade to the large Box render only once it has actually decoded —
        // a failed upgrade must never blank a working image.
        if (/\/api\/box\/thumbnail\//.test(img.url) && img.url.indexOf('size=large') === -1) {
            var big = new Image();
            var target = img.url + (img.url.indexOf('?') === -1 ? '?' : '&') + 'size=large';
            big.onload = function () { if (!els.lightbox.hidden && els.lightboxImg.src === img.url) els.lightboxImg.src = target; };
            big.src = target;
        }
        if (els.lightboxClose) els.lightboxClose.focus();
    }

    function closeLightbox() {
        if (!els.lightbox || els.lightbox.hidden) return;
        els.lightbox.hidden = true;
        els.lightboxImg.removeAttribute('src');
    }

    function lightboxOpen() { return !!(els.lightbox && !els.lightbox.hidden); }

    // ── events ──────────────────────────────────────────────────────────────
    function onBodyClick(e) {
        var t = e.target;
        if (t.closest('[data-close]')) { close(); if (cbs.onNavigate) cbs.onNavigate(0); return; }

        var thumb = t.closest('[data-img]');
        if (thumb) { state.active = +thumb.getAttribute('data-img') || 0; renderStrip(); return; }

        if (t.closest('[data-hero-img]') || (t.closest('[data-hero]') && state.images.length)) { openLightbox(); return; }

        var retry = t.closest('[data-retry]');
        if (retry) {
            var id = retry.getAttribute('data-retry');
            setSection(id, '<div class="dg-skel dg-skel--rows"></div>');
            if (id === 'detail') hydrateLookup(state.dn, state.token);
            else if (id === 'art') hydrateArt(state.dn, state.token);
            else if (id === 'ruth') hydrateRuth(state.dn, state.token);
            return;
        }

        var copyText = t.closest('[data-copy-text]');
        if (copyText) { writeClipboard(copyText.getAttribute('data-copy-text'), 'Filename copied'); return; }

        var goto = t.closest('[data-goto]');
        if (goto) { var g = +goto.getAttribute('data-goto'); if (open(g, { list: state.list, idx: state.list.indexOf(g) }) && cbs.onNavigate) cbs.onNavigate(g); return; }

        var cust = t.closest('[data-customer]');
        if (cust && cbs.onCustomerClick) { cbs.onCustomerClick(+cust.getAttribute('data-customer')); return; }

        var act = t.closest('[data-act]');
        if (!act) return;
        var kind = act.getAttribute('data-act');
        if (kind === 'copy') writeClipboard(String(state.dn), 'Design #' + state.dn + ' copied');
        else if (kind === 'share') writeClipboard(window.location.origin + '/design/' + state.dn, 'Share link copied');
        else if (kind === 'prev') step(-1);
        else if (kind === 'next') step(1);
        // 'quote' is a real <a href> — let the browser navigate.
    }

    function writeClipboard(text, okMsg) {
        function ok() { if (window.ToastNotifications) ToastNotifications.success(okMsg); }
        function fail() { if (window.ToastNotifications) ToastNotifications.error('Copy failed — select and copy manually.'); }
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(ok).catch(fail);
        } else {
            fail();
        }
    }

    function onKeydown(e) {
        if (lightboxOpen()) {
            if (e.key === 'Escape') { e.preventDefault(); closeLightbox(); }
            return;
        }
        if (!isOpen()) return;
        if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
        else if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
        else if (e.key === 'Tab') trapFocus(e);
    }

    function trapFocus(e) {
        var f = els.drawer.querySelectorAll('a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])');
        if (!f.length) return;
        var first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }

    function init(opts) {
        opts = opts || {};
        els.drawer = document.getElementById('dg-drawer');
        els.body = document.getElementById('dg-drawer-body');
        els.overlay = document.getElementById('dg-drawer-overlay');
        els.lightbox = document.getElementById('dg-lightbox');
        els.lightboxImg = document.getElementById('dg-lightbox-img');
        els.lightboxCap = document.getElementById('dg-lightbox-cap');
        els.lightboxClose = document.getElementById('dg-lightbox-close');
        cbs.onNavigate = opts.onNavigate || null;
        cbs.onCustomerClick = opts.onCustomerClick || null;

        if (wired || !els.drawer) return;
        wired = true;
        els.body.addEventListener('click', onBodyClick);
        els.overlay.addEventListener('click', function () { close(); if (cbs.onNavigate) cbs.onNavigate(0); });
        if (els.lightbox) {
            els.lightbox.addEventListener('click', function (e) {
                if (e.target === els.lightbox || e.target.closest('#dg-lightbox-close')) closeLightbox();
            });
        }
        document.addEventListener('keydown', onKeydown);
    }

    window.DG.drawer = {
        init: init,
        open: open,
        close: close,
        isOpen: isOpen,
        lightboxOpen: lightboxOpen,
        closeLightbox: closeLightbox,
        next: function () { step(1); },
        prev: function () { step(-1); },
        currentDn: function () { return isOpen() ? state.dn : 0; }
    };
})();
