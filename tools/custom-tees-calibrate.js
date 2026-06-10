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
        || 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
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
    };

    function toast(msg, type) {
        const el = document.createElement('div');
        el.className = 'cal-toast' + (type ? ' is-' + type : '');
        el.textContent = msg;
        $('cal-toasts').appendChild(el);
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

    // ── Boot: catalog + saved overrides ────────────────────────────────
    async function boot() {
        try {
            const [styles, cal] = await Promise.all([
                grab(`${API_BASE}/api/dtg/top-sellers/styles`),
                // Best-effort: a 404 (route not deployed) or table-missing must
                // not block the catalog — the tool still works in layout+copy mode.
                grab(`${API_BASE}/api/dtg-calibration?refresh=1`).catch(() => ({ data: [], routeMissing: true })),
            ]);
            S.styles = (styles.records || styles.data || []);
            S.overrides = (cal.data || []);
            if (cal.routeMissing) {
                $('cal-status').textContent = '⚠️ Calibration API not deployed on the proxy yet — layouts can\'t save (use Copy JSON meanwhile).';
            }
            if (cal.tableMissing) {
                $('cal-status').innerHTML = '⚠️ The Caspio table <strong>DTG_Calibration</strong> doesn\'t exist yet — layouts can\'t save until it\'s created (use Copy JSON meanwhile). Column spec is in the proxy route file.';
            }
            renderStyleList();
        } catch (e) {
            $('style-list').innerHTML = `<div class="cal-loading">Failed to load catalog: ${esc(e.message)} — refresh to retry.</div>`;
        }
    }

    function savedRowsFor(style) {
        return S.overrides.filter((r) => r.StyleNumber === style);
    }

    function renderStyleList() {
        $('style-list').innerHTML = S.styles.map((st) => {
            const n = savedRowsFor(st.style).length;
            return `<button type="button" class="style-item${S.style && S.style.style === st.style ? ' is-active' : ''}" data-style="${esc(st.style)}">
                <img src="/api/image-proxy?url=${encodeURIComponent(st.main_image_url || '')}" alt="" loading="lazy">
                <span class="style-item-name">${esc(st.style)}<small>${esc((st.product_title || '').replace(/\.\s*\w+$/, ''))}</small></span>
                <span class="style-item-state ${n ? 'is-saved' : ''}">${n ? `✓ ${n} saved` : 'auto'}</span>
            </button>`;
        }).join('');
        [...document.querySelectorAll('.style-item')].forEach((b) => {
            b.addEventListener('click', () => selectStyle(b.dataset.style));
        });
    }

    // ── Style / view / color selection ─────────────────────────────────
    async function selectStyle(styleNumber) {
        const st = S.styles.find((s) => s.style === styleNumber);
        if (!st) return;
        S.style = st;
        S.view = 'front';
        renderStyleList();
        $('cal-status').textContent = 'Loading photos…';
        try {
            const det = await grab(`${API_BASE}/api/product-details?styleNumber=${encodeURIComponent(styleNumber)}`);
            S.details = Array.isArray(det) ? det : (det.data || det.records || []);
        } catch (e) {
            toast('Couldn\'t load product photos: ' + e.message, 'error');
            return;
        }
        // Color list: unique CATALOG_COLORs that have any front or back image
        const seen = new Map();
        S.details.forEach((r) => {
            if (!seen.has(r.CATALOG_COLOR) && (r.FRONT_FLAT || r.FRONT_MODEL || r.PRODUCT_IMAGE || r.BACK_FLAT || r.BACK_MODEL)) {
                seen.set(r.CATALOG_COLOR, r);
            }
        });
        $('cal-color').innerHTML = [...seen.values()].map((r) =>
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
        S.view = v;
        $('cal-tab-front').classList.toggle('is-active', v === 'front');
        $('cal-tab-back').classList.toggle('is-active', v === 'back');
        loadPhoto();
    }

    function viewName() { return S.view === 'back' ? 'flatBack' : 'flatFront'; }

    function savedRowForCurrent() {
        const rows = savedRowsFor(S.style.style).filter((r) => r.ViewName === viewName());
        return rows.find((r) => (r.CatalogColor || '') === S.color)
            || rows.find((r) => !(r.CatalogColor || '')) || null;
    }

    async function loadPhoto() {
        const url = photoUrl();
        const img = $('cal-photo');
        $('cal-box').hidden = true;
        if (!url) {
            img.removeAttribute('src');
            $('cal-empty').hidden = false;
            $('cal-empty').textContent = 'No photo for this view/color in SanMar\'s library.';
            return;
        }
        $('cal-empty').hidden = true;
        await new Promise((resolve) => {
            img.onload = resolve;
            img.onerror = resolve;
            img.src = '/api/image-proxy?url=' + encodeURIComponent(url);
        });
        if (!img.naturalWidth) {
            $('cal-empty').hidden = false;
            $('cal-empty').textContent = 'Photo failed to load.';
            return;
        }
        S.img = img;
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
        const r = imgRectOnScreen();
        const wrap = $('cal-canvas-wrap').getBoundingClientRect();
        const hf = hFracFor(S.box.wFrac);
        box.style.left = (r.left - wrap.left + S.box.xFrac * r.width) + 'px';
        box.style.top = (r.top - wrap.top + S.box.yFrac * r.height) + 'px';
        box.style.width = (S.box.wFrac * r.width) + 'px';
        box.style.height = (hf * r.height) + 'px';
        box.hidden = false;
        const ppi = (S.box.wFrac * S.img.naturalWidth) / 16;
        $('cal-readout').textContent =
            `xFrac ${S.box.xFrac.toFixed(4)} · yFrac ${S.box.yFrac.toFixed(4)} · wFrac ${S.box.wFrac.toFixed(4)} · hFrac ${hf.toFixed(4)}  (≈ ${ppi.toFixed(1)} px/inch on this photo)`;
    }

    const boxEl = () => $('cal-box');

    function startDrag(e, mode) {
        if (!S.img || !S.box) return;
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
        if (!S.drag) return;
        const dx = (e.clientX - S.drag.startX) / S.drag.imgW;
        const dy = (e.clientY - S.drag.startY) / S.drag.imgH;
        if (S.drag.mode === 'move') {
            S.box.xFrac = S.drag.start.xFrac + dx;
            S.box.yFrac = S.drag.start.yFrac + dy;
        } else {
            S.box.wFrac = Math.max(0.08, S.drag.start.wFrac + dx);
        }
        // soft clamp inside the image
        const hf = hFracFor(S.box.wFrac);
        S.box.wFrac = Math.min(S.box.wFrac, 1);
        S.box.xFrac = Math.min(Math.max(S.box.xFrac, -0.1), 1.1 - S.box.wFrac);
        S.box.yFrac = Math.min(Math.max(S.box.yFrac, -0.1), 1.1 - hf);
        renderBox();
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

    async function save() {
        if (!S.style || !S.box) return;
        const rec = currentRecord();
        $('cal-save').disabled = true;
        try {
            const r = await fetch(`${API_BASE}/api/dtg-calibration`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(rec),
            });
            const j = await r.json();
            if (!r.ok || !j.success) {
                if (j.tableMissing) {
                    await navigator.clipboard.writeText(JSON.stringify(rec, null, 2)).catch(() => {});
                    toast('Caspio table DTG_Calibration doesn\'t exist yet — JSON copied to clipboard instead.', 'error');
                } else {
                    toast('Save failed: ' + (j.error || r.status), 'error');
                }
                return;
            }
            toast(`Saved ${rec.StyleNumber} ${S.view}${rec.CatalogColor ? ' (' + rec.CatalogColor + ' only)' : ' (all colors)'} ✓`, 'ok');
            const cal = await grab(`${API_BASE}/api/dtg-calibration?refresh=1`);
            S.overrides = cal.data || [];
            renderStyleList();
            $('cal-delete').hidden = false;
        } catch (e) {
            toast('Save failed: ' + e.message, 'error');
        } finally {
            $('cal-save').disabled = false;
        }
    }

    async function removeSaved() {
        const row = savedRowForCurrent();
        if (!row || !row.PK_ID) return;
        try {
            const r = await fetch(`${API_BASE}/api/dtg-calibration/${row.PK_ID}`, { method: 'DELETE' });
            const j = await r.json();
            if (!j.success) { toast('Delete failed', 'error'); return; }
            toast('Saved layout removed — back to auto-detect.', 'ok');
            const cal = await grab(`${API_BASE}/api/dtg-calibration?refresh=1`);
            S.overrides = cal.data || [];
            renderStyleList();
            initBox();
        } catch (e) {
            toast('Delete failed: ' + e.message, 'error');
        }
    }

    // ── Wire up ─────────────────────────────────────────────────────────
    $('cal-tab-front').addEventListener('click', () => setView('front'));
    $('cal-tab-back').addEventListener('click', () => setView('back'));
    $('cal-color').addEventListener('change', () => { S.color = $('cal-color').value; loadPhoto(); });
    $('cal-save').addEventListener('click', save);
    $('cal-delete').addEventListener('click', removeSaved);
    $('cal-auto').addEventListener('click', () => {
        const saved = savedRowForCurrent();
        if (saved) { S.overrides = S.overrides.filter((r) => r !== saved); }   // ignore saved for re-init only
        initBox();
        if (saved) S.overrides.push(saved);
    });
    $('cal-copy').addEventListener('click', async () => {
        if (!S.box) return;
        await navigator.clipboard.writeText(JSON.stringify(currentRecord(), null, 2)).catch(() => {});
        toast('JSON copied.', 'ok');
    });

    boxEl().addEventListener('pointerdown', (e) => {
        if (e.target.closest('#cal-box-handle')) startDrag(e, 'scale');
        else startDrag(e, 'move');
    });
    document.addEventListener('pointermove', onDragMove);
    document.addEventListener('pointerup', endDrag);
    window.addEventListener('resize', () => { if (S.box && S.img) renderBox(); });

    boot();
})();
