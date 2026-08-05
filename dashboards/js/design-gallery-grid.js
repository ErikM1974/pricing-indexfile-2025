/**
 * design-gallery-grid.js — DG.grid · windowed results grid for the Design Vault
 * =============================================================================
 * Renders search/browse results into #dg-grid using dual-spacer chunk windowing:
 * ~200 cards per chunk (snapped to a full-row multiple once measured, so the
 * spacer px math stays exact and chunk swaps never jump the scroll), max 3
 * chunks mounted (~600 cards in the DOM), top/bottom spacers sized from a
 * measured row height, and ONE IntersectionObserver (rootMargin 1200px) driving
 * the window shifts.
 *
 * Also owns: the card template (shared with DG.rails via cardHTML/tileHTML —
 * one template, two surfaces), the density toggle (localStorage 'dg-density'),
 * roving keyboard focus (arrows / Enter / Space / Home / End), the copy-# helper,
 * and the thumbnail fill queue: IO-visible cards with no image but the THUMB
 * source bit are batched ≤20 every 250ms through DesignThumbnailService.
 *
 * Contract: scratchpad DG-CONTRACTS.md · plan here-is-our-design-virtual-puffin.md
 * All dynamic text goes through DG.esc (design-gallery-search.js loads first).
 * No fetches here beyond DesignThumbnailService; URL/history belong to DG.app.
 */
(function () {
    'use strict';

    window.DG = window.DG || {};

    // Source-flag bits — mirrors the index wire contract (jest-locked server-side).
    const SRC = { DIGITIZED: 1, SHOPWORKS: 2, THUMB: 4, ART: 8, RUTH: 16, PHOTO: 32, DESIGNS2026: 64 };
    const SRC_GLYPHS = [
        [SRC.DIGITIZED, 'fa-pen-nib', 'Digitized — DST on file'],
        [SRC.ART, 'fa-palette', 'Art request'],
        [SRC.RUTH, 'fa-layer-group', 'Digitizing mockup'],
        [SRC.PHOTO, 'fa-camera', 'Finished photo'],
        [SRC.THUMB, 'fa-file-image', 'ShopWorks thumbnail']
    ];
    const TIER_CLASS = { standard: 'dg-badge--std', mid: 'dg-badge--mid', large: 'dg-badge--lg', 'full back': 'dg-badge--fb' };

    const CHUNK_TARGET = 200;   // cards per chunk (re-snapped to a row multiple by measure())
    const MAX_CHUNKS = 3;

    const els = {};
    const cbs = {};
    let data = [];
    let dnToIdx = {};
    let chunkSize = CHUNK_TARGET;
    let cols = 1;
    let rowH = 300;             // card height + row gap, measured from the live grid
    let measured = false;
    let winStart = 0;
    let winEnd = -1;            // mounted chunk range, inclusive; -1 = nothing mounted
    let focusIdx = -1;
    let density = 'comfortable';
    let io = null;
    let thumbIO = null;
    let thumbQueue = [];
    const thumbSeen = {};       // dn → true once queued (never re-request the service)
    let thumbTimer = 0;
    let resizeTimer = 0;

    // ── small utils ─────────────────────────────────────────────────────────
    function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
    function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode — density just won't persist */ } }

    function fmtStitch(n) {
        n = +n || 0;
        return n > 0 ? (n / 1000).toFixed(1) + 'k st' : '';
    }

    function initials(d) {
        const src = String(d.company || d.name || '').trim();
        if (!src) return '#';
        const parts = src.split(/\s+/);
        const out = (parts[0].charAt(0) + (parts.length > 1 ? parts[1].charAt(0) : '')).toUpperCase();
        return out || '#';
    }

    // ── card template (shared with DG.rails) ────────────────────────────────
    function imgHTML(dn, url) {
        return '<img loading="lazy" decoding="async" data-dn="' + dn + '" src="' + DG.esc(url) + '" alt="">';
    }

    function tileHTML(d) {
        const dn = +d.dn || 0;
        return '<div class="dg-card-tile dg-tile-' + (dn % 8) + '" aria-hidden="true">' + DG.esc(initials(d)) + '</div>';
    }

    function cardHTML(d, idx) {
        const dn = +d.dn || 0;
        const hasIdx = typeof idx === 'number' && idx >= 0;
        const needsThumb = !d.imgUrl && (d.srcBits & SRC.THUMB);
        const thumb = d.imgUrl ? imgHTML(dn, d.imgUrl) : tileHTML(d);
        const tierCls = TIER_CLASS[String(d.tier || '').toLowerCase()] || '';
        const badge = d.tier ? '<span class="dg-badge' + (tierCls ? ' ' + tierCls : '') + '">' + DG.esc(d.tier) + '</span>' : '';
        const st = fmtStitch(d.maxStitch);
        let glyphs = '';
        for (let i = 0; i < SRC_GLYPHS.length; i++) {
            if (d.srcBits & SRC_GLYPHS[i][0]) {
                glyphs += '<i class="dg-src fas ' + SRC_GLYPHS[i][1] + '" title="' + SRC_GLYPHS[i][2] + '" aria-label="' + SRC_GLYPHS[i][2] + '"></i>';
            }
        }
        let dup = '';
        if (d.dupGroup && d.dupGroup.length > 1) {
            const others = d.dupGroup
                .filter(function (n) { return +n !== dn; })
                .map(function (n) { return '#' + (+n || 0); })
                .join(', ');
            dup = '<span class="dg-dup" title="' + DG.esc('Possible duplicate of ' + others) + '"><i class="fas fa-clone"></i></span>';
        }
        const custAttr = +d.customerId ? ' data-customer="' + (+d.customerId) + '" title="Open customer portfolio"' : '';
        return '<article class="dg-card' + (density === 'wall' ? ' dg-card--wall' : '') + '"'
            + ' data-dn="' + dn + '"' + (hasIdx ? ' data-idx="' + idx + '"' : '') + (needsThumb ? ' data-thumb="1"' : '')
            + ' tabindex="-1" aria-label="' + DG.esc('Design #' + dn + (d.company ? ' — ' + d.company : '') + (d.name ? ' — ' + d.name : '')) + '">'
            + '<div class="dg-card-thumb">' + thumb + '</div>'
            + '<div class="dg-card-number">#' + dn + '</div>'
            + '<div class="dg-card-company"' + custAttr + '>' + (d.company ? DG.esc(d.company) : '&mdash;') + '</div>'
            + '<div class="dg-card-name">' + DG.esc(d.name || '') + '</div>'
            + '<div class="dg-card-meta">' + badge
            + (st ? '<span>' + st + '</span>' : '')
            + (glyphs ? '<span class="dg-src-row">' + glyphs + '</span>' : '')
            + (d.variantCount > 1 ? '<span class="dg-variants">&times;' + (+d.variantCount) + '</span>' : '')
            + dup + '</div>'
            + '<button type="button" class="dg-copy" data-copy-dn="' + dn + '" tabindex="-1"'
            + ' title="Copy design number" aria-label="' + DG.esc('Copy design number ' + dn) + '"><i class="fas fa-copy"></i></button>'
            + '</article>';
    }

    // ── chunk windowing ─────────────────────────────────────────────────────
    function lastChunk() { return Math.max(0, Math.ceil(data.length / chunkSize) - 1); }
    function chunkOf(idx) { return Math.floor(idx / chunkSize); }
    function chunkCount(ci) { return Math.min(data.length, (ci + 1) * chunkSize) - ci * chunkSize; }
    function cardAt(idx) { return els.grid.querySelector('.dg-card[data-idx="' + idx + '"]'); }

    function rangeHTML(start, end) {
        let html = '';
        for (let i = start; i < end; i++) html += cardHTML(data[i], i);
        return html;
    }

    function afterMount(nodes) {
        if (!thumbIO) return;
        for (let i = 0; i < nodes.length; i++) {
            if (nodes[i].hasAttribute && nodes[i].hasAttribute('data-thumb')) thumbIO.observe(nodes[i]);
        }
    }

    function updateSpacers() {
        // chunkSize is a multiple of cols after measure(), so these are exact rows.
        const rowsBefore = Math.ceil((winStart * chunkSize) / cols);
        const totalRows = Math.ceil(data.length / cols);
        const rowsMounted = Math.ceil(els.grid.children.length / cols);
        const rowsAfter = Math.max(0, totalRows - rowsBefore - rowsMounted);
        els.topSpacer.style.height = (rowsBefore * rowH) + 'px';
        els.bottomSpacer.style.height = (rowsAfter * rowH) + 'px';
    }

    function renderWindow() {
        if (!els.grid) return;
        const start = winStart * chunkSize;
        const end = Math.min(data.length, (winEnd + 1) * chunkSize);
        els.grid.innerHTML = end > start ? rangeHTML(start, end) : '';
        afterMount([].slice.call(els.grid.children));
        if (focusIdx >= start && focusIdx < end) {
            const card = cardAt(focusIdx);
            if (card) card.setAttribute('tabindex', '0');
        }
        updateSpacers();
    }

    function mountChunk(ci, atStart) {
        const html = rangeHTML(ci * chunkSize, Math.min(data.length, (ci + 1) * chunkSize));
        const before = els.grid.children.length;
        if (atStart) {
            els.grid.insertAdjacentHTML('afterbegin', html);
            afterMount([].slice.call(els.grid.children, 0, els.grid.children.length - before));
        } else {
            els.grid.insertAdjacentHTML('beforeend', html);
            afterMount([].slice.call(els.grid.children, before));
        }
    }

    function unmountChunk(ci, fromStart) {
        let count = chunkCount(ci);
        while (count-- > 0) {
            const el = fromStart ? els.grid.firstElementChild : els.grid.lastElementChild;
            if (!el) break;
            if (thumbIO) thumbIO.unobserve(el);
            el.remove();
        }
    }

    function shiftDown() {
        winEnd++;
        mountChunk(winEnd, false);
        if (winEnd - winStart + 1 > MAX_CHUNKS) { unmountChunk(winStart, true); winStart++; }
        updateSpacers();
    }

    function shiftUp() {
        winStart--;
        mountChunk(winStart, true);
        if (winEnd - winStart + 1 > MAX_CHUNKS) { unmountChunk(winEnd, false); winEnd--; }
        updateSpacers();
    }

    function onWindowEdge(entries) {
        for (let i = 0; i < entries.length; i++) {
            if (!entries[i].isIntersecting) continue;
            const t = entries[i].target;
            if (t === els.sentinelTop || t === els.topSpacer) {
                if (winStart > 0) shiftUp();
            } else if (data.length && winEnd < lastChunk()) {
                shiftDown();
            }
        }
    }

    function measure() {
        const probe = els.grid.firstElementChild;
        if (!probe) return false;
        const cs = getComputedStyle(els.grid);
        cols = Math.max(1, (cs.gridTemplateColumns || '').split(' ').filter(Boolean).length);
        rowH = probe.getBoundingClientRect().height + (parseFloat(cs.rowGap) || 0);
        measured = true;
        const snapped = Math.max(cols, Math.round(CHUNK_TARGET / cols) * cols);
        if (snapped !== chunkSize) { chunkSize = snapped; return true; }
        return false;
    }

    function ensureMounted(idx) {
        const start = winStart * chunkSize;
        const end = Math.min(data.length, (winEnd + 1) * chunkSize);
        if (idx >= start && idx < end) return;
        winStart = winEnd = chunkOf(idx);   // the IO refills neighbours as needed
        renderWindow();
    }

    // ── thumbnail fill queue ────────────────────────────────────────────────
    function onThumbVisible(entries) {
        let queued = false;
        for (let i = 0; i < entries.length; i++) {
            const en = entries[i];
            if (!en.isIntersecting) continue;
            thumbIO.unobserve(en.target);
            const dn = en.target.getAttribute('data-dn');
            if (!dn || thumbSeen[dn]) continue;
            thumbSeen[dn] = true;
            thumbQueue.push(dn);
            queued = true;
        }
        if (queued && !thumbTimer) thumbTimer = setInterval(flushThumbBatch, 250);
    }

    function flushThumbBatch() {
        if (!thumbQueue.length || !window.DesignThumbnailService) {
            thumbQueue = [];
            clearInterval(thumbTimer);
            thumbTimer = 0;
            return;
        }
        const batch = thumbQueue.splice(0, 20);
        DesignThumbnailService.fetchThumbnailsBatch(batch).then(function (map) {
            for (let i = 0; i < batch.length; i++) {
                if (map[batch[i]]) applyThumb(+batch[i], map[batch[i]]);
            }
        }, function () {
            // The service resolves with nulls on API errors, so a rejection is
            // abnormal — release the dns so a later scroll can retry them.
            for (let i = 0; i < batch.length; i++) delete thumbSeen[batch[i]];
        });
    }

    function applyThumb(dn, url) {
        const idx = dnToIdx[dn];
        if (idx != null && data[idx]) data[idx].imgUrl = url;
        const card = els.grid.querySelector('.dg-card[data-dn="' + dn + '"]');
        if (card) {
            card.removeAttribute('data-thumb');
            const wrap = card.querySelector('.dg-card-thumb');
            if (wrap) wrap.innerHTML = imgHTML(dn, url);
        }
        if (window.DG.store && typeof DG.store.patchImage === 'function') DG.store.patchImage(dn, url);
    }

    // ── events ──────────────────────────────────────────────────────────────
    function onImgError(e) {
        const img = e.target;
        if (!img || img.tagName !== 'IMG') return;
        const card = img.closest('.dg-card');
        const idx = card ? +card.getAttribute('data-idx') : -1;
        const d = idx >= 0 ? data[idx] : null;
        const wrap = card ? card.querySelector('.dg-card-thumb') : null;
        if (wrap && d) {
            d.imgUrl = '';   // dead URL — future renders fall back to the initials tile
            wrap.innerHTML = tileHTML(d);
            if ((d.srcBits & SRC.THUMB) && !thumbSeen[d.dn] && thumbIO) {
                card.setAttribute('data-thumb', '1');   // recovery: the service may still know a good thumb
                thumbIO.observe(card);
            }
        } else if (img.parentNode) {
            img.style.visibility = 'hidden';
        }
    }

    function setRoving(idx) {
        const prev = els.grid.querySelector('.dg-card[tabindex="0"]');
        if (prev) prev.setAttribute('tabindex', '-1');
        focusIdx = idx;
        const card = cardAt(idx);
        if (card) card.setAttribute('tabindex', '0');
    }

    function focusIndex(idx) {
        if (idx < 0 || idx >= data.length) return;
        ensureMounted(idx);
        setRoving(idx);
        const card = cardAt(idx);
        if (card) {
            card.focus({ preventScroll: true });
            card.scrollIntoView({ block: 'nearest' });
        }
    }

    function onKeydown(e) {
        if (!data.length) return;
        if (e.target.closest && e.target.closest('button')) return;   // e.g. the copy button
        let next = null;
        switch (e.key) {
            case 'ArrowRight': next = focusIdx < 0 ? 0 : Math.min(data.length - 1, focusIdx + 1); break;
            case 'ArrowLeft': next = focusIdx < 0 ? 0 : Math.max(0, focusIdx - 1); break;
            case 'ArrowDown': next = focusIdx < 0 ? 0 : Math.min(data.length - 1, focusIdx + cols); break;
            case 'ArrowUp': next = focusIdx < 0 ? 0 : Math.max(0, focusIdx - cols); break;
            case 'Home': next = 0; break;
            case 'End': next = data.length - 1; break;
            case 'Enter':
            case ' ':
                if (focusIdx >= 0 && data[focusIdx] && cbs.onOpen) {
                    e.preventDefault();
                    cbs.onOpen(data[focusIdx].dn);
                }
                return;
            default: return;
        }
        e.preventDefault();
        focusIndex(next);
    }

    function onGridClick(e) {
        const copyBtn = e.target.closest('[data-copy-dn]');
        if (copyBtn) { e.stopPropagation(); copyDn(copyBtn.getAttribute('data-copy-dn')); return; }
        const cust = e.target.closest('[data-customer]');
        if (cust) { e.stopPropagation(); if (cbs.onCustomerClick) cbs.onCustomerClick(+cust.getAttribute('data-customer') || 0); return; }
        const card = e.target.closest('.dg-card');
        if (!card) return;
        const idx = +card.getAttribute('data-idx');
        if (idx >= 0) setRoving(idx);
        if (cbs.onOpen) cbs.onOpen(+card.getAttribute('data-dn') || 0);
    }

    function copyDn(dn) {
        const text = String(dn == null ? '' : dn).replace(/[^0-9]/g, '');
        if (!text) return;
        const ok = function () { if (window.ToastNotifications) ToastNotifications.success('Design #' + text + ' copied'); };
        const fail = function () { if (window.ToastNotifications) ToastNotifications.error('Copy failed — design # is ' + text); };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(ok, fail);
        else fail();
    }

    function onResize() {
        if (!data.length || !measured) return;
        const anchorIdx = winStart * chunkSize;
        if (measure()) {
            winStart = Math.min(chunkOf(anchorIdx), lastChunk());
            winEnd = winStart;
            renderWindow();
        } else {
            updateSpacers();
        }
    }

    // ── public API ──────────────────────────────────────────────────────────
    function init(opts) {
        opts = opts || {};
        els.grid = document.querySelector(opts.container || '#dg-grid');
        els.topSpacer = document.querySelector(opts.topSpacer || '#dg-spacer-top');
        els.bottomSpacer = document.querySelector(opts.bottomSpacer || '#dg-spacer-bottom');
        els.sentinelTop = document.querySelector(opts.sentinelTop || '#dg-sentinel-top');
        els.sentinelBottom = document.querySelector(opts.sentinelBottom || '#dg-sentinel-bottom');
        cbs.onOpen = opts.onOpen || null;
        cbs.onCustomerClick = opts.onCustomerClick || null;
        if (!els.grid || !els.topSpacer || !els.bottomSpacer) return;
        els.viewport = els.grid.closest('[role="grid"]') || els.grid.parentElement;

        density = lsGet('dg-density') === 'wall' ? 'wall' : 'comfortable';
        els.grid.classList.toggle('dg-grid--wall', density === 'wall');

        els.grid.addEventListener('click', onGridClick);
        els.grid.addEventListener('error', onImgError, true);   // delegated — never an on* attribute
        if (els.viewport) {
            els.viewport.style.overflowAnchor = 'none';   // the spacer math owns scroll anchoring
            els.viewport.addEventListener('keydown', onKeydown);
        }
        if (typeof IntersectionObserver !== 'undefined') {
            // Root = the viewport itself when the CSS makes it its own scroll container.
            let rootEl = null;
            if (els.viewport && /(auto|scroll)/.test(getComputedStyle(els.viewport).overflowY || '')) rootEl = els.viewport;
            io = new IntersectionObserver(onWindowEdge, { root: rootEl, rootMargin: '1200px 0px' });
            // The skeleton places the sentinels OUTSIDE the spacers, so alone they only
            // mark the absolute ends of the full 39k-row canvas. The spacers ARE the
            // mounted-window edges — the same single IO watches both pairs so shifts
            // fire while approaching blank space in either direction.
            if (els.sentinelTop) io.observe(els.sentinelTop);
            if (els.sentinelBottom) io.observe(els.sentinelBottom);
            io.observe(els.topSpacer);
            io.observe(els.bottomSpacer);
            thumbIO = new IntersectionObserver(onThumbVisible, { root: rootEl, rootMargin: '400px 0px' });
        }
        window.addEventListener('resize', function () {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(onResize, 150);
        });
    }

    function setData(arr) {
        data = Array.isArray(arr) ? arr : [];
        dnToIdx = {};
        for (let i = 0; i < data.length; i++) dnToIdx[data[i].dn] = i;
        thumbQueue = [];
        winStart = 0;
        winEnd = data.length ? 0 : -1;
        focusIdx = -1;
        renderWindow();
        requestAnimationFrame(function () {
            if (measure()) renderWindow(); else updateSpacers();
        });
    }

    function setDensity(d) {
        const next = d === 'wall' ? 'wall' : 'comfortable';
        if (next === density) return;
        density = next;
        lsSet('dg-density', next);
        if (!els.grid) return;
        els.grid.classList.toggle('dg-grid--wall', next === 'wall');
        renderWindow();   // re-emits cards with/without .dg-card--wall
        requestAnimationFrame(function () {
            if (measure()) renderWindow(); else updateSpacers();
        });
    }

    function getDensity() { return density; }

    function focusDn(dn) {
        const idx = dnToIdx[dn];
        if (idx != null) focusIndex(idx);
    }

    function scrollToDn(dn) {
        const idx = dnToIdx[dn];
        if (idx == null) return;
        ensureMounted(idx);
        const card = cardAt(idx);
        if (card) card.scrollIntoView({ block: 'center' });
    }

    window.DG.grid = {
        init: init,
        setData: setData,
        setDensity: setDensity,
        getDensity: getDensity,
        focusDn: focusDn,
        scrollToDn: scrollToDn,
        cardHTML: cardHTML,   // shared card template — DG.rails renders through these
        tileHTML: tileHTML,
        copyDn: copyDn
    };
})();
