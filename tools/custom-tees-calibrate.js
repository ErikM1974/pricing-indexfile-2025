/**
 * custom-tees-calibrate.js — STAFF tool: lay the 16×20 print envelope onto
 * each style's photo once; the storefront designer anchors to the saved box.
 *
 * Flow: pick style → pick view/color → drag the box (move) or its corner
 * (scale; aspect locked to 16:20) → Save. Rows upsert to Caspio
 * DTG_Calibration via the proxy (/api/dtg-calibration) — no deploy to edit.
 * "Save for this color only" writes a color-specific override row; otherwise
 * the row applies to every color of the style (CatalogColor = '').
 *
 * The initial box position = saved layout > silhouette auto-detect (same
 * algorithm as the storefront) > static default — so usually Erik just
 * nudges, not draws from scratch.
 */
(function () {
    'use strict';

    const API_BASE = (window.APP_CONFIG && window.APP_CONFIG.API && window.APP_CONFIG.API.BASE_URL)
        || '';
    if (!API_BASE) console.error('[custom-tees-calibrate] APP_CONFIG.API.BASE_URL missing — the proxy host is not configured');
    const ASPECT = 20 / 16;   // envelope h/w — locked

    const $ = (id) => document.getElementById(id);

    const S = {
        styles: [],            // top-sellers list
        overrides: [],         // all saved rows (refreshed after saves)
        style: null,           // selected style record
        details: [],           // product-details rows for the style
        view: 'front',
        color: null,           // selected catalogColor
        img: null,             // loaded HTMLImageElement (natural dims)
        box: null,             // { xFrac, yFrac, wFrac } (hFrac derived from aspect + image dims)
        drag: null,
        styleRequest: 0,
        photoRequest: 0,
        bootRequest: 0,
        busy: false,
        copyBusy: false,
        warning: '',
    };

    function toast(msg, type) {
        const el = document.createElement('div');
        el.className = 'cal-toast' + (type ? ' is-' + type : '');
        el.textContent = msg;
        $('cal-toasts').replaceChildren(el);
        setTimeout(() => el.remove(), 4500);
    }

    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
        }[c]));
    }

    async function grab(url) {
        const r = await fetch(url);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
    }

    function syncControls() {
        const ready = !!(S.style && S.img && S.box);
        $('cal-save').disabled = S.busy || !ready || !!S.warning;
        $('cal-delete').disabled = S.busy || !ready || !!S.warning;
        $('cal-auto').disabled = S.busy || !ready;
        $('cal-copy').disabled = S.busy || S.copyBusy || !ready;
        $('cal-adjust').disabled = S.busy || !ready;
        $('cal-color').disabled = S.busy || !S.details.length;
        $('cal-color-only').disabled = S.busy || !ready;
        for (const b of document.querySelectorAll('.style-item')) b.disabled = S.busy;
        for (const id of ['cal-tab-front', 'cal-tab-back']) $(id).disabled = S.busy || !S.details.length;
        $('cal-box-handle').disabled = S.busy || !ready;
        document.querySelector('.cal-stage').setAttribute('aria-busy', String(S.busy));
    }

    function warning(message) {
        S.warning = message;
        $('cal-warning').textContent = message;
        $('cal-warning').hidden = !message;
        $('cal-retry').hidden = !message;
        syncControls();
    }

    function clearPhoto(message) {
        S.img = null; S.box = null; S.drag = null;
        $('cal-photo').hidden = true;
        $('cal-photo').removeAttribute('src');
        $('cal-box').hidden = true;
        $('cal-delete').hidden = true;
        $('cal-readout').textContent = '';
        $('cal-empty').hidden = false;
        $('cal-empty').textContent = message;
        syncControls();
    }

    async function boot() {
        if (S.busy) return;
        const request = ++S.bootRequest;
        ++S.styleRequest; ++S.photoRequest;
        S.style = null; S.details = []; S.color = null;
        $('cal-color').replaceChildren();
        clearPhoto('Pick a style to start');
        $('cal-retry').disabled = true;
        $('style-list').textContent = 'Loading catalog…';
        try {
            const [styles, cal] = await Promise.all([
                grab(`${API_BASE}/api/dtg/top-sellers/styles`),
                grab(`${API_BASE}/api/dtg-calibration?refresh=1`).catch(() => null),
            ]);
            if (request !== S.bootRequest) return;
            const rows = styles.records || styles.data;
            if (!Array.isArray(rows)) throw new Error('Unexpected catalog response');
            S.styles = rows;
            S.overrides = Array.isArray(cal?.data) ? cal.data : [];
            warning(!cal || !Array.isArray(cal.data)
                ? 'Saved layouts could not be loaded. Reload to retry; you can still adjust a layout and copy its JSON.'
                : cal.tableMissing ? 'Saved layouts are unavailable. You can adjust a layout and copy its JSON until saving is available.' : '');
            renderStyleList();
            $('cal-status').textContent = '';
        } catch (e) {
            if (request !== S.bootRequest) return;
            S.styles = []; S.overrides = [];
            $('style-list').textContent = 'Failed to load catalog: ' + e.message;
            warning('The garment catalog is unavailable. Reload to retry.');
        } finally {
            if (request === S.bootRequest) $('cal-retry').disabled = false;
        }
    }

    function savedRowsFor(style) {
        return S.overrides.filter((r) => r.StyleNumber === style);
    }

    function renderStyleList() {
        const focusedStyle = document.activeElement?.matches('.style-item') ? document.activeElement.dataset.style : null;
        if (!S.styles.length) { $('style-list').textContent = 'No styles are available for calibration.'; return; }
        $('style-list').innerHTML = S.styles.map((st) => {
            const n = savedRowsFor(st.style).length;
            return `<button type="button" class="style-item${S.style && S.style.style === st.style ? ' is-active' : ''}" data-style="${esc(st.style)}" aria-pressed="${!!(S.style && S.style.style === st.style)}">
                <img src="/api/image-proxy?url=${encodeURIComponent(st.main_image_url || '')}" alt="" loading="lazy">
                <span class="style-item-name">${esc(st.style)}<small>${esc((st.product_title || '').replace(/\.\s*\w+$/, ''))}</small></span>
                <span class="style-item-state ${n ? 'is-saved' : ''}">${n ? `✓ ${n} saved` : 'auto'}</span>
            </button>`;
        }).join('');
        [...document.querySelectorAll('.style-item')].forEach((b) => {
            b.addEventListener('click', () => selectStyle(b.dataset.style));
        });
        syncControls();
        if (focusedStyle) [...document.querySelectorAll('.style-item')].find(b => b.dataset.style === focusedStyle)?.focus();
    }

    // ── Style / view / color selection ─────────────────────────────────
    async function selectStyle(styleNumber) {
        if (S.busy) return;
        const st = S.styles.find(s => s.style === styleNumber);
        if (!st) return;
        const request = ++S.styleRequest;
        ++S.photoRequest;
        S.style = st; S.view = 'front'; S.details = []; S.color = null;
        $('cal-color').replaceChildren();
        clearPhoto('Loading garment photos…');
        renderStyleList();
        $('cal-status').textContent = 'Loading photos…';
        try {
            const det = await grab(`${API_BASE}/api/product-details?styleNumber=${encodeURIComponent(styleNumber)}`);
            if (request !== S.styleRequest) return;
            const rows = Array.isArray(det) ? det : (det.data || det.records);
            if (!Array.isArray(rows)) throw new Error('Unexpected product response');
            S.details = rows;
        } catch (e) {
            if (request !== S.styleRequest) return;
            clearPhoto('Product photos could not be loaded. Select the style again to retry.');
            $('cal-status').textContent = 'Could not load product photos: ' + e.message;
            return;
        }
        const seen = new Map();
        S.details.forEach(r => {
            if (!seen.has(r.CATALOG_COLOR) && (r.FRONT_FLAT || r.FRONT_MODEL || r.PRODUCT_IMAGE || r.BACK_FLAT || r.BACK_MODEL)) seen.set(r.CATALOG_COLOR, r);
        });
        $('cal-color').innerHTML = [...seen.values()].map(r =>
            `<option value="${esc(r.CATALOG_COLOR)}">${esc(r.COLOR_NAME || r.CATALOG_COLOR)}</option>`).join('');
        S.color = $('cal-color').value || null;
        setView('front');
    }

    function detailRow() {
        return S.details.find((r) => r.CATALOG_COLOR === S.color) || S.details[0] || null;
    }

    function photoUrl() {
        const r = detailRow();
        if (!r) return null;
        return S.view === 'back'
            ? (r.BACK_FLAT || r.BACK_MODEL || null)
            : (r.FRONT_FLAT || r.FRONT_MODEL || r.PRODUCT_IMAGE || null);
    }

    function setView(v) {
        if (S.busy || !S.style) return;
        S.view = v;
        for (const name of ['front', 'back']) {
            const tab = $('cal-tab-' + name), active = v === name;
            tab.classList.toggle('is-active', active);
            tab.setAttribute('aria-selected', String(active));
            tab.tabIndex = active ? 0 : -1;
        }
        $('cal-canvas-wrap').setAttribute('aria-labelledby', 'cal-tab-' + v);
        loadPhoto();
    }

    function viewName() { return S.view === 'back' ? 'flatBack' : 'flatFront'; }

    function savedRowForCurrent() {
        const rows = savedRowsFor(S.style.style).filter((r) => r.ViewName === viewName());
        return rows.find((r) => (r.CatalogColor || '') === S.color)
            || rows.find((r) => !(r.CatalogColor || '')) || null;
    }

    async function loadPhoto() {
        if (S.busy) return;
        const request = ++S.photoRequest, url = photoUrl();
        clearPhoto(url ? 'Loading garment photo…' : 'No photo for this view/color in SanMar\'s library.');
        if (!url) { $('cal-status').textContent = 'Choose another view or color.'; return; }
        const candidate = new Image();
        const loaded = await new Promise(resolve => {
            candidate.onload = () => resolve(true);
            candidate.onerror = () => resolve(false);
            candidate.src = '/api/image-proxy?url=' + encodeURIComponent(url);
        });
        if (request !== S.photoRequest) return;
        if (!loaded || !candidate.naturalWidth) {
            clearPhoto('Photo failed to load. Select the view or color again to retry.');
            $('cal-status').textContent = 'Photo unavailable; no layout can be saved for this view.';
            return;
        }
        const img = $('cal-photo');
        img.src = candidate.src;
        try { await img.decode(); } catch (_) { /* dimensions checked below */ }
        if (request !== S.photoRequest) return;
        if (!img.naturalWidth) { clearPhoto('Photo failed to load. Select the view again to retry.'); return; }
        img.hidden = false;
        img.alt = S.style.style + ' ' + S.color + ' ' + S.view + ' garment photo';
        $('cal-empty').hidden = true;
        S.img = img;
        $('cal-photo-frame').style.setProperty('--cal-image-ratio', String(img.naturalWidth / img.naturalHeight));
        initBox();
    }

    // Initial box: saved row > auto-detect > static default
    function initBox() {
        const saved = savedRowForCurrent();
        if (saved) {
            S.box = { xFrac: parseFloat(saved.XFrac), yFrac: parseFloat(saved.YFrac), wFrac: parseFloat(saved.WFrac) };
        } else {
            const g = detectGarment($('cal-photo'));
            if (g) {
                const b = g.bbox;
                const iw = S.img.naturalWidth, ih = S.img.naturalHeight;
                if (g.kind === 'flat') {
                    const ppi = b.w / 22;
                    const topIn = S.view === 'back' ? 2 : 1.5;
                    S.box = {
                        xFrac: (b.x + b.w / 2 - (16 * ppi) / 2) / iw,
                        yFrac: (b.y + b.h * 0.02 + topIn * ppi) / ih,
                        wFrac: (16 * ppi) / iw,
                    };
                } else {
                    const ppi = (b.w * 0.52) / 16;
                    S.box = {
                        xFrac: (b.x + b.w / 2 - (16 * ppi) / 2) / iw,
                        yFrac: (b.y + b.h * (S.view === 'back' ? 0.26 : 0.30)) / ih,
                        wFrac: (16 * ppi) / iw,
                    };
                }
            } else {
                S.box = { xFrac: 0.30, yFrac: 0.25, wFrac: 0.40 };
            }
        }
        $('cal-delete').hidden = !saved;
        renderBox();
        const src = saved ? (saved.CatalogColor ? `saved (this color)` : 'saved (all colors)') : 'auto-detect — adjust + save';
        $('cal-status').textContent = `${S.style.style} · ${S.view} · ${S.color} — starting from ${src}.`;
        syncControls();
    }

    // Same detector the storefront uses (96px white-bg bbox scan)
    function detectGarment(img) {
        try {
            const W = 96;
            const H = Math.max(1, Math.round(W * img.naturalHeight / img.naturalWidth));
            const c = document.createElement('canvas');
            c.width = W; c.height = H;
            const cx = c.getContext('2d', { willReadFrequently: true });
            cx.drawImage(img, 0, 0, W, H);
            const d = cx.getImageData(0, 0, W, H).data;
            let minX = W, minY = H, maxX = -1, maxY = -1, count = 0;
            for (let y = 0; y < H; y++) {
                for (let x = 0; x < W; x++) {
                    const i = (y * W + x) * 4;
                    const bg = d[i + 3] < 24 || (d[i] > 236 && d[i + 1] > 236 && d[i + 2] > 236);
                    if (!bg) {
                        count++;
                        if (x < minX) minX = x;
                        if (x > maxX) maxX = x;
                        if (y < minY) minY = y;
                        if (y > maxY) maxY = y;
                    }
                }
            }
            if (maxX <= minX || maxY <= minY || count / (W * H) < 0.15) return null;
            const sx = img.naturalWidth / W, sy = img.naturalHeight / H;
            const bbox = { x: minX * sx, y: minY * sy, w: (maxX - minX + 1) * sx, h: (maxY - minY + 1) * sy };
            return { bbox, kind: (bbox.h / bbox.w) > 1.35 ? 'model' : 'flat' };
        } catch (_) { return null; }
    }

    // ── Box rendering + gestures (CSS-pixel space over the <img>) ──────
    function imgRectOnScreen() {
        const img = $('cal-photo');
        return img.getBoundingClientRect();
    }

    function hFracFor(wFrac) {
        // box pixel height = pixel width × aspect; convert via image dims
        const iw = S.img.naturalWidth, ih = S.img.naturalHeight;
        return wFrac * iw * ASPECT / ih;
    }

    function renderBox() {
        const box = $('cal-box');
        const hf = hFracFor(S.box.wFrac);
        // Relative to the photo frame: screen and print share the same geometry.
        box.style.left = (S.box.xFrac * 100) + '%';
        box.style.top = (S.box.yFrac * 100) + '%';
        box.style.width = (S.box.wFrac * 100) + '%';
        box.style.height = (hf * 100) + '%';
        box.hidden = false;
        const ppi = (S.box.wFrac * S.img.naturalWidth) / 16;
        $('cal-readout').textContent =
            `xFrac ${S.box.xFrac.toFixed(4)} · yFrac ${S.box.yFrac.toFixed(4)} · wFrac ${S.box.wFrac.toFixed(4)} · hFrac ${hf.toFixed(4)}  (≈ ${ppi.toFixed(1)} px/inch on this photo)`;
    }

    const boxEl = () => $('cal-box');

    function startDrag(e, mode) {
        if (S.busy || !S.img || !S.box) return;
        e.preventDefault();
        const r = imgRectOnScreen();
        S.drag = {
            mode, // 'move' | 'scale'
            startX: e.clientX, startY: e.clientY,
            start: { ...S.box },
            imgW: r.width, imgH: r.height,
        };
        try { e.target.setPointerCapture(e.pointerId); } catch (_) { /* ok */ }
    }

    function onDragMove(e) {
        if (S.busy || !S.drag) return;
        const dx = (e.clientX - S.drag.startX) / S.drag.imgW;
        const dy = (e.clientY - S.drag.startY) / S.drag.imgH;
        if (S.drag.mode === 'move') {
            S.box.xFrac = S.drag.start.xFrac + dx;
            S.box.yFrac = S.drag.start.yFrac + dy;
        } else {
            S.box.wFrac = Math.max(0.08, S.drag.start.wFrac + dx);
        }
        clampBox();
        renderBox();
    }

    function clampBox() {
        // soft clamp inside the image
        const hf = hFracFor(S.box.wFrac);
        S.box.wFrac = Math.min(S.box.wFrac, 1);
        S.box.xFrac = Math.min(Math.max(S.box.xFrac, -0.1), 1.1 - S.box.wFrac);
        S.box.yFrac = Math.min(Math.max(S.box.yFrac, -0.1), 1.1 - hf);
    }

    function endDrag() { S.drag = null; }

    // ── Save / delete / copy ────────────────────────────────────────────
    function currentRecord() {
        return {
            StyleNumber: S.style.style,
            ViewName: viewName(),
            CatalogColor: $('cal-color-only').checked ? S.color : '',
            XFrac: +S.box.xFrac.toFixed(5),
            YFrac: +S.box.yFrac.toFixed(5),
            WFrac: +S.box.wFrac.toFixed(5),
            HFrac: +hFracFor(S.box.wFrac).toFixed(5),
            ImageURL: photoUrl() || '',
            UpdatedBy: 'calibration-tool',
        };
    }

    async function refreshSavedLayouts() {
        const cal = await grab(`${API_BASE}/api/dtg-calibration?refresh=1`);
        if (cal.tableMissing || !Array.isArray(cal.data)) throw new Error('Saved layouts are unavailable');
        S.overrides = cal.data;
        warning('');
        renderStyleList();
    }

    async function save() {
        if (S.busy || S.warning || !S.style || !S.img || !S.box) return;
        const rec = currentRecord();
        S.busy = true; S.drag = null; syncControls();
        let saved = false;
        try {
            // Same-origin staff forwarder; payload geometry remains unchanged.
            const r = await fetch('/api/dtg-calibration', {
                method:'POST', credentials:'same-origin',
                headers:{'Content-Type':'application/json'}, body:JSON.stringify(rec),
            });
            const j = await r.json();
            if (!r.ok || !j.success) throw new Error(j.error || 'HTTP ' + r.status);
            saved = true;
            toast(`Saved ${rec.StyleNumber} ${rec.ViewName === 'flatBack' ? 'back' : 'front'}${rec.CatalogColor ? ' (' + rec.CatalogColor + ' only)' : ' (all colors)'} ✓`, 'ok');
            await refreshSavedLayouts();
            $('cal-delete').hidden = !savedRowForCurrent();
        } catch (e) {
            if (saved) {
                S.overrides = []; renderStyleList(); $('cal-delete').hidden = true;
                warning('Layout saved, but saved layouts could not be refreshed. Reload before saving again.');
            } else {
                $('cal-status').textContent = 'Save could not be confirmed: ' + e.message + '. Your adjustment is still here.';
                toast('Save could not be confirmed. Your adjustment is still here.', 'error');
            }
        } finally { S.busy = false; syncControls(); }
    }

    async function removeSaved() {
        if (S.busy || S.warning || !S.style || !S.img || !S.box) return;
        const row = savedRowForCurrent();
        if (!row || !row.PK_ID) return;
        S.busy = true; S.drag = null; syncControls();
        let removed = false;
        try {
            const r = await fetch('/api/dtg-calibration/' + encodeURIComponent(row.PK_ID), {method:'DELETE',credentials:'same-origin'});
            const j = await r.json();
            if (!r.ok || !j.success) throw new Error(j.error || 'HTTP ' + r.status);
            removed = true;
            toast('Saved layout removed — back to auto-detect.', 'ok');
            await refreshSavedLayouts();
            initBox();
        } catch (e) {
            if (removed) {
                S.overrides = []; renderStyleList(); $('cal-delete').hidden = true;
                warning('Saved layout removed, but layouts could not be refreshed. Reload to continue.');
            } else {
                $('cal-status').textContent = 'Removal could not be confirmed: ' + e.message;
                toast('Removal could not be confirmed. Reload before trying again.', 'error');
            }
        } finally { S.busy = false; syncControls(); }
    }

    async function copyRecord() {
        if (S.busy || S.copyBusy || !S.img || !S.box) return;
        const record = currentRecord();
        S.copyBusy = true; syncControls();
        try {
            await navigator.clipboard.writeText(JSON.stringify(record, null, 2));
            toast('JSON copied.', 'ok');
        } catch (_) {
            toast('Could not copy JSON. Allow clipboard access and try again.', 'error');
        } finally { S.copyBusy = false; syncControls(); }
    }

    function adjustBox(direction, amount = 0.01) {
        if (S.busy || !S.img || !S.box) return;
        if (direction === 'left') S.box.xFrac -= amount;
        if (direction === 'right') S.box.xFrac += amount;
        if (direction === 'up') S.box.yFrac -= amount;
        if (direction === 'down') S.box.yFrac += amount;
        if (direction === 'smaller') S.box.wFrac = Math.max(0.08, S.box.wFrac - amount);
        if (direction === 'larger') S.box.wFrac += amount;
        clampBox(); renderBox();
    }

    // ── Wire up ─────────────────────────────────────────────────────────
    $('cal-tab-front').addEventListener('click', () => setView('front'));
    $('cal-tab-back').addEventListener('click', () => setView('back'));
    $('cal-color').addEventListener('change', () => { if (S.busy) return; S.color = $('cal-color').value; loadPhoto(); });
    $('cal-retry').addEventListener('click', boot);
    $('cal-save').addEventListener('click', save);
    $('cal-delete').addEventListener('click', removeSaved);
    $('cal-auto').addEventListener('click', () => {
        if (S.busy || !S.img || !S.box) return;
        const saved = savedRowForCurrent();
        if (saved) { S.overrides = S.overrides.filter((r) => r !== saved); }   // ignore saved for re-init only
        initBox();
        if (saved) S.overrides.push(saved);
    });
    $('cal-copy').addEventListener('click', copyRecord);
    for (const button of document.querySelectorAll('[data-adjust]')) button.addEventListener('click', () => adjustBox(button.dataset.adjust));
    for (const tab of document.querySelectorAll('.cal-tab')) tab.addEventListener('keydown', e => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key) || S.busy) return;
        e.preventDefault();
        const view = e.key === 'Home' ? 'front' : e.key === 'End' ? 'back' : S.view === 'front' ? 'back' : 'front';
        setView(view); $('cal-tab-' + view).focus();
    });
    boxEl().addEventListener('keydown', e => {
        const directions = {ArrowLeft:'left',ArrowRight:'right',ArrowUp:'up',ArrowDown:'down'};
        if (!directions[e.key]) return;
        e.preventDefault();
        const scale = e.target === $('cal-box-handle');
        adjustBox(scale ? (['ArrowLeft','ArrowUp'].includes(e.key) ? 'smaller' : 'larger') : directions[e.key], e.shiftKey ? 0.05 : 0.01);
    });

    boxEl().addEventListener('pointerdown', (e) => {
        if (e.target.closest('#cal-box-handle')) startDrag(e, 'scale');
        else startDrag(e, 'move');
    });
    document.addEventListener('pointermove', onDragMove);
    document.addEventListener('pointerup', endDrag);
    document.addEventListener('pointercancel', endDrag);
    window.addEventListener('resize', () => { if (S.box && S.img) renderBox(); });

    boot();
})();
