/**
 * 3-day-tees-designer.js — interactive t-shirt designer canvas for the
 * 3-Day Tees page.
 *
 * Isolated component (jds-mockup-creator.js precedent): owns canvas drawing
 * and gestures ONLY. It never reads or writes TDT.state or outside DOM —
 * the app pushes product/design data in via setters and listens on
 * callbacks. Adding another garment later = new calibration entries.
 *
 * Coordinate contract (the production contract — see ORDER_PUSH_FLOW.md):
 *   placement = { wIn, xIn, yIn } in INCHES, top-center anchor:
 *     wIn — artwork printed width
 *     xIn — inches RIGHT of the print area's vertical centerline
 *     yIn — inches BELOW the print area's top edge
 *   Height derives from the artwork aspect ratio. Invariant under color
 *   swaps, canvas resizes, and photo changes. pxPerInch comes from
 *   TDTCalibration.areaPx().
 *
 * Garment photos load through the SAME-ORIGIN /api/image-proxy (server.js)
 * so canvas exports can never throw a cross-origin SecurityError.
 *
 * Usage:
 *   const dz = TDTDesigner.create({
 *     canvas, calibration: TDTCalibration,
 *     onPlacementChange(slotKey, placement) {},   // debounced during drag
 *     onTapEmptyArea(slotKey) {},                 // open the file picker
 *     onInteract() {},                            // any gesture (idle-fade reset)
 *   });
 *   dz.setColor(colorObj) / dz.setView('front'|'back') /
 *   dz.setLocation('LC'|'FF') / dz.setSlot('front', slot|null) /
 *   dz.exportMockup(colorObj, view, slots, widthPx) → Promise<Blob|null>
 */
(function (global) {
    'use strict';

    const SNAP_IN = 0.08;          // snap-to-centerline threshold (inches)
    const MIN_ART_W_IN = 0.5;      // smallest printable width we allow
    const HIT_SLOP_PX = 12;        // grab slop around the art bounding box
    const IDLE_FADE_MS = 1500;     // print-area outline fade delay
    const EXPORT_JPEG_Q = 0.85;

    function proxied(url) {
        // Same-origin proxy → CORS-clean canvas reads everywhere.
        return '/api/image-proxy?url=' + encodeURIComponent(url);
    }

    function loadImage(url) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error('Image load failed: ' + url));
            img.src = url;
        });
    }

    function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

    function create(opts) {
        const canvas = opts.canvas;
        const cal = opts.calibration;
        const ctx = canvas.getContext('2d');

        const state = {
            color: null,            // { catalogColor, colorName, images:{flatFront, flatBack} }
            view: 'front',          // 'front' | 'back'
            location: 'LC',         // front print location; back is always FB
            slots: { front: null, back: null },
            garmentImg: null,       // loaded HTMLImageElement for current color+view
            loadError: null,
            outlineOpacity: 1,
            idleTimer: null,
            drag: null,             // { pointerId, startX, startY, startPlacement }
            pinch: null,            // { d0, w0 }
            pointers: new Map(),
            raf: 0,
            dirty: false,
            destroyed: false,
        };

        const imageCache = {};      // url → Promise<HTMLImageElement>

        // ── Geometry ────────────────────────────────────────────────────
        function viewKey() { return state.view === 'back' ? 'flatBack' : 'flatFront'; }
        function activeSlotKey() { return state.view === 'back' ? 'back' : 'front'; }
        function activeLocation() { return state.view === 'back' ? 'FB' : state.location; }

        function garmentUrl(colorObj, view) {
            const imgs = (colorObj && colorObj.images) || {};
            return view === 'back'
                ? (imgs.flatBack || imgs.backModel || null)
                : (imgs.flatFront || imgs.frontModel || null);
        }

        /** Where the garment image lands on the canvas (fit-contain). */
        function imageRect(img, cw, ch) {
            const scale = Math.min(cw / img.naturalWidth, ch / img.naturalHeight);
            const w = img.naturalWidth * scale;
            const h = img.naturalHeight * scale;
            return { x: (cw - w) / 2, y: (ch - h) / 2, w, h, scale };
        }

        /** Print-area rect in canvas coords + pxPerInch at canvas scale. */
        function areaOnCanvas(img, rect) {
            const a = cal.areaPx(viewKey(), activeLocation(),
                state.color && state.color.catalogColor,
                img.naturalWidth, img.naturalHeight);
            if (!a) return null;
            return {
                x: rect.x + a.x * rect.scale,
                y: rect.y + a.y * rect.scale,
                w: a.w * rect.scale,
                h: a.h * rect.scale,
                wIn: a.wIn,
                hIn: a.hIn,
                ppi: a.pxPerInch * rect.scale,
            };
        }

        /** Artwork rect in canvas coords from its inch placement. */
        function artRect(slot, area) {
            const aspect = slot.naturalH / slot.naturalW;
            const w = slot.placement.wIn * area.ppi;
            const h = w * aspect;
            const cx = area.x + area.w / 2 + slot.placement.xIn * area.ppi;
            const y = area.y + slot.placement.yIn * area.ppi;
            return { x: cx - w / 2, y, w, h, cx };
        }

        /** Keep the art fully inside the print area (inch space). */
        function clampPlacement(slot, area) {
            const aspect = slot.naturalH / slot.naturalW;
            const p = slot.placement;
            p.wIn = clamp(p.wIn, MIN_ART_W_IN, area.wIn);
            let hIn = p.wIn * aspect;
            if (hIn > area.hIn) {       // too tall at this width — shrink
                p.wIn = area.hIn / aspect;
                hIn = area.hIn;
            }
            const halfW = p.wIn / 2;
            p.xIn = clamp(p.xIn, -(area.wIn / 2 - halfW), area.wIn / 2 - halfW);
            p.yIn = clamp(p.yIn, 0, area.hIn - hIn);
        }

        // ── Drawing ─────────────────────────────────────────────────────
        function requestRender() {
            state.dirty = true;
            if (!state.raf) {
                state.raf = requestAnimationFrame(() => {
                    state.raf = 0;
                    if (state.dirty && !state.destroyed) { state.dirty = false; draw(); }
                });
            }
        }

        function draw() {
            const dpr = window.devicePixelRatio || 1;
            const cssW = canvas.clientWidth || 460;
            const cssH = canvas.clientHeight || Math.round(cssW * 1.2);
            if (canvas.width !== Math.round(cssW * dpr) || canvas.height !== Math.round(cssH * dpr)) {
                canvas.width = Math.round(cssW * dpr);
                canvas.height = Math.round(cssH * dpr);
            }
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.clearRect(0, 0, cssW, cssH);

            const img = state.garmentImg;
            if (!img) return;

            const rect = imageRect(img, cssW, cssH);
            ctx.drawImage(img, rect.x, rect.y, rect.w, rect.h);

            const area = areaOnCanvas(img, rect);
            if (!area) return;

            const slot = state.slots[activeSlotKey()];
            if (slot) {
                clampPlacement(slot, area);
                const r = artRect(slot, area);
                ctx.save();
                ctx.beginPath();
                ctx.rect(area.x, area.y, area.w, area.h);
                ctx.clip();
                if (slot.previewable && slot.bitmap) {
                    ctx.drawImage(slot.bitmap, r.x, r.y, r.w, r.h);
                } else {
                    drawPlaceholder(r, slot);
                }
                ctx.restore();

                // Centerline snap guide while dragging on the line
                if (state.drag && Math.abs(slot.placement.xIn) < 0.001) {
                    ctx.save();
                    ctx.strokeStyle = 'rgba(47, 125, 59, 0.9)';
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(area.x + area.w / 2, area.y);
                    ctx.lineTo(area.x + area.w / 2, area.y + area.h);
                    ctx.stroke();
                    ctx.restore();
                }
            }

            drawAreaOutline(area, !!slot);
        }

        function drawPlaceholder(r, slot) {
            ctx.save();
            ctx.fillStyle = 'rgba(107, 114, 128, 0.25)';
            ctx.strokeStyle = 'rgba(75, 85, 99, 0.8)';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([6, 4]);
            roundRect(r.x, r.y, r.w, r.h, 6);
            ctx.fill();
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillStyle = 'rgba(31, 41, 55, 0.9)';
            ctx.font = '600 12px Inter, Arial, sans-serif';
            ctx.textAlign = 'center';
            const ext = (slot.fileName || '').split('.').pop().toUpperCase();
            ctx.fillText(ext + ' — positioned for our art team',
                r.x + r.w / 2, r.y + r.h / 2 - 4, r.w - 12);
            ctx.font = '400 11px Inter, Arial, sans-serif';
            ctx.fillText((slot.fileName || '').slice(0, 32),
                r.x + r.w / 2, r.y + r.h / 2 + 12, r.w - 12);
            ctx.restore();
        }

        function roundRect(x, y, w, h, r) {
            ctx.beginPath();
            ctx.moveTo(x + r, y);
            ctx.arcTo(x + w, y, x + w, y + h, r);
            ctx.arcTo(x + w, y + h, x, y + h, r);
            ctx.arcTo(x, y + h, x, y, r);
            ctx.arcTo(x, y, x + w, y, r);
            ctx.closePath();
        }

        function drawAreaOutline(area, hasArt) {
            ctx.save();
            ctx.globalAlpha = hasArt ? state.outlineOpacity : 1;
            ctx.strokeStyle = '#2f7d3b';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([8, 6]);
            ctx.strokeRect(area.x, area.y, area.w, area.h);
            ctx.setLineDash([]);
            // Corner ticks
            const t = 10;
            ctx.lineWidth = 2.5;
            [[area.x, area.y, 1, 1], [area.x + area.w, area.y, -1, 1],
             [area.x, area.y + area.h, 1, -1], [area.x + area.w, area.y + area.h, -1, -1]]
                .forEach(([cx2, cy2, sx, sy]) => {
                    ctx.beginPath();
                    ctx.moveTo(cx2 + sx * t, cy2);
                    ctx.lineTo(cx2, cy2);
                    ctx.lineTo(cx2, cy2 + sy * t);
                    ctx.stroke();
                });
            // Inch label
            ctx.globalAlpha = Math.max(ctx.globalAlpha, 0.55);
            ctx.fillStyle = '#2f7d3b';
            ctx.font = '600 11px Inter, Arial, sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText(`${area.wIn}″ × ${area.hIn}″`, area.x + 4, area.y - 6);
            ctx.restore();
        }

        function pokeIdleFade() {
            state.outlineOpacity = 1;
            if (state.idleTimer) clearTimeout(state.idleTimer);
            state.idleTimer = setTimeout(() => {
                state.outlineOpacity = 0.4;
                requestRender();
            }, IDLE_FADE_MS);
            if (opts.onInteract) opts.onInteract();
            requestRender();
        }

        // ── Garment image management ────────────────────────────────────
        function ensureGarment() {
            const url = garmentUrl(state.color, state.view);
            state.garmentImg = null;
            state.loadError = null;
            requestRender();
            if (!url) {
                state.loadError = 'No product photo available for this view.';
                if (opts.onError) opts.onError(state.loadError);
                return;
            }
            const p = proxied(url);
            if (!imageCache[p]) imageCache[p] = loadImage(p);
            const want = { color: state.color, view: state.view };
            imageCache[p].then((img) => {
                if (state.destroyed) return;
                if (want.color !== state.color || want.view !== state.view) return; // stale
                state.garmentImg = img;
                requestRender();
            }).catch(() => {
                delete imageCache[p];
                if (want.color !== state.color || want.view !== state.view) return;
                state.loadError = 'Couldn’t load the shirt photo. Check your connection and refresh.';
                if (opts.onError) opts.onError(state.loadError);
            });
        }

        /** Warm the cache for every color × view so swaps are instant. */
        function preload(colors) {
            (colors || []).forEach((c) => {
                ['front', 'back'].forEach((v) => {
                    const u = garmentUrl(c, v);
                    if (u) {
                        const p = proxied(u);
                        if (!imageCache[p]) imageCache[p] = loadImage(p);
                    }
                });
            });
        }

        // ── Gestures ────────────────────────────────────────────────────
        function canvasPoint(evt) {
            const r = canvas.getBoundingClientRect();
            return { x: evt.clientX - r.left, y: evt.clientY - r.top };
        }

        function currentGeometry() {
            const img = state.garmentImg;
            if (!img) return null;
            const rect = imageRect(img, canvas.clientWidth, canvas.clientHeight);
            const area = areaOnCanvas(img, rect);
            return area ? { rect, area } : null;
        }

        canvas.addEventListener('pointerdown', (e) => {
            const g = currentGeometry();
            if (!g) return;
            const slot = state.slots[activeSlotKey()];
            const pt = canvasPoint(e);
            state.pointers.set(e.pointerId, pt);

            if (state.pointers.size === 2 && slot) {
                const pts = Array.from(state.pointers.values());
                state.pinch = {
                    d0: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y),
                    w0: slot.placement.wIn,
                };
                state.drag = null;
                e.preventDefault();
                return;
            }

            if (!slot) {
                // Tap inside the empty print area → open the picker.
                if (pt.x >= g.area.x && pt.x <= g.area.x + g.area.w &&
                    pt.y >= g.area.y && pt.y <= g.area.y + g.area.h) {
                    if (opts.onTapEmptyArea) opts.onTapEmptyArea(activeSlotKey());
                }
                return;
            }

            const r = artRect(slot, g.area);
            if (pt.x >= r.x - HIT_SLOP_PX && pt.x <= r.x + r.w + HIT_SLOP_PX &&
                pt.y >= r.y - HIT_SLOP_PX && pt.y <= r.y + r.h + HIT_SLOP_PX) {
                state.drag = {
                    pointerId: e.pointerId,
                    startX: pt.x,
                    startY: pt.y,
                    startP: { wIn: slot.placement.wIn, xIn: slot.placement.xIn, yIn: slot.placement.yIn },
                };
                try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* ok */ }
                e.preventDefault();
                pokeIdleFade();
            }
        });

        canvas.addEventListener('pointermove', (e) => {
            if (state.pointers.has(e.pointerId)) {
                state.pointers.set(e.pointerId, canvasPoint(e));
            }
            const g = currentGeometry();
            const slot = state.slots[activeSlotKey()];
            if (!g || !slot) return;

            if (state.pinch && state.pointers.size >= 2) {
                const pts = Array.from(state.pointers.values());
                const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
                if (state.pinch.d0 > 0) {
                    slot.placement.wIn = state.pinch.w0 * (d / state.pinch.d0);
                    clampPlacement(slot, g.area);
                    emitPlacement(slot);
                    pokeIdleFade();
                }
                e.preventDefault();
                return;
            }

            if (state.drag && state.drag.pointerId === e.pointerId) {
                const pt = canvasPoint(e);
                const dxIn = (pt.x - state.drag.startX) / g.area.ppi;
                const dyIn = (pt.y - state.drag.startY) / g.area.ppi;
                slot.placement.xIn = state.drag.startP.xIn + dxIn;
                slot.placement.yIn = state.drag.startP.yIn + dyIn;
                if (Math.abs(slot.placement.xIn) < SNAP_IN) slot.placement.xIn = 0;
                clampPlacement(slot, g.area);
                emitPlacement(slot);
                pokeIdleFade();
                e.preventDefault();
            }
        });

        function endPointer(e) {
            state.pointers.delete(e.pointerId);
            if (state.pointers.size < 2) state.pinch = null;
            if (state.drag && state.drag.pointerId === e.pointerId) {
                state.drag = null;
                const slot = state.slots[activeSlotKey()];
                if (slot) emitPlacement(slot, true);
                requestRender();
            }
            try { canvas.releasePointerCapture(e.pointerId); } catch (_) { /* ok */ }
        }
        canvas.addEventListener('pointerup', endPointer);
        canvas.addEventListener('pointercancel', endPointer);

        canvas.addEventListener('keydown', (e) => {
            const g = currentGeometry();
            const slot = state.slots[activeSlotKey()];
            if (!g || !slot) return;
            const step = e.shiftKey ? 0.25 : 0.05;
            const p = slot.placement;
            let handled = true;
            if (e.key === 'ArrowLeft') p.xIn -= step;
            else if (e.key === 'ArrowRight') p.xIn += step;
            else if (e.key === 'ArrowUp') p.yIn -= step;
            else if (e.key === 'ArrowDown') p.yIn += step;
            else if (e.key === '+' || e.key === '=') p.wIn += 0.1;
            else if (e.key === '-' || e.key === '_') p.wIn -= 0.1;
            else if (e.key === 'c' || e.key === 'C') p.xIn = 0;
            else handled = false;
            if (handled) {
                e.preventDefault();
                clampPlacement(slot, g.area);
                emitPlacement(slot, true);
                pokeIdleFade();
                announce(slot, g.area);
            }
        });

        let emitTimer = null;
        // slotKey must be EXPLICIT for non-gesture callers — keying off the
        // current view would write the front slot's placement into the BACK
        // slot when setLocation() fires while the customer views the back.
        function emitPlacement(slot, immediate, slotKey) {
            requestRender();
            if (!opts.onPlacementChange) return;
            const key = slotKey || activeSlotKey();
            const fire = () => opts.onPlacementChange(key, {
                wIn: round2(slot.placement.wIn),
                xIn: round2(slot.placement.xIn),
                yIn: round2(slot.placement.yIn),
            });
            if (immediate) { clearTimeout(emitTimer); emitTimer = null; fire(); return; }
            if (!emitTimer) {
                emitTimer = setTimeout(() => { emitTimer = null; fire(); }, 150);
            }
        }

        function round2(v) { return Math.round(v * 100) / 100; }

        function announce(slot, area) {
            const live = opts.liveRegion;
            if (!live) return;
            const p = slot.placement;
            const horiz = Math.abs(p.xIn) < 0.01 ? 'centered'
                : (p.xIn > 0 ? `${Math.abs(p.xIn).toFixed(1)}″ right of center`
                             : `${Math.abs(p.xIn).toFixed(1)}″ left of center`);
            live.textContent = `Artwork ${p.wIn.toFixed(1)} inches wide, ` +
                `${p.yIn.toFixed(1)} inches below the print area top, ${horiz}.`;
        }

        // ── Public geometry helpers ─────────────────────────────────────
        /** Auto-fit: 80% of area width (LC) / 10″ wide 1″ down (FF/FB). */
        function defaultPlacement(slotKey, naturalW, naturalH) {
            const loc = slotKey === 'back' ? 'FB' : state.location;
            const a = cal.area(slotKey === 'back' ? 'flatBack' : 'flatFront', loc, null);
            const aspect = naturalH / naturalW;
            if (!a) return { wIn: 3, xIn: 0, yIn: 0.5 };
            let wIn = loc === 'LC' ? a.wIn * 0.8 : Math.min(10, a.wIn);
            let hIn = wIn * aspect;
            if (hIn > a.hIn * 0.9) { hIn = a.hIn * 0.9; wIn = hIn / aspect; }
            const yIn = loc === 'LC' ? Math.max(0, (a.hIn - hIn) / 2) : Math.min(1, a.hIn - hIn);
            return { wIn: round2(wIn), xIn: 0, yIn: round2(yIn) };
        }

        function fitWidth(slotKey) {
            const slot = state.slots[slotKey];
            const g = currentGeometry();
            if (!slot || !g) return;
            slot.placement.wIn = g.area.wIn;
            slot.placement.xIn = 0;
            clampPlacement(slot, g.area);
            emitPlacement(slot, true, slotKey);
            pokeIdleFade();
        }

        function center(slotKey) {
            const slot = state.slots[slotKey];
            if (!slot) return;
            slot.placement.xIn = 0;
            emitPlacement(slot, true, slotKey);
            pokeIdleFade();
        }

        function setWidthIn(slotKey, wIn) {
            const slot = state.slots[slotKey];
            const g = currentGeometry();
            if (!slot) return;
            slot.placement.wIn = wIn;
            if (g) clampPlacement(slot, g.area);
            emitPlacement(slot, true, slotKey);
            pokeIdleFade();
        }

        /** Max printable width (inches) for a slot's aspect in its area. */
        function maxWidthIn(slotKey) {
            const slot = state.slots[slotKey];
            const loc = slotKey === 'back' ? 'FB' : state.location;
            const a = cal.area(slotKey === 'back' ? 'flatBack' : 'flatFront', loc, null);
            if (!a) return 12;
            if (!slot) return a.wIn;
            const aspect = slot.naturalH / slot.naturalW;
            return round2(Math.min(a.wIn, a.hIn / aspect));
        }

        // ── Export (hi-res mockup, guides stripped) ─────────────────────
        async function exportMockup(colorObj, view, slots, widthPx) {
            const url = garmentUrl(colorObj, view);
            if (!url) return null;
            const p = proxied(url);
            if (!imageCache[p]) imageCache[p] = loadImage(p);
            let img;
            try { img = await imageCache[p]; } catch (_) { return null; }

            const slotKey = view === 'back' ? 'back' : 'front';
            const slot = slots[slotKey];
            const loc = view === 'back' ? 'FB' : state.location;

            const w = widthPx || 1200;
            const h = Math.round(w * (img.naturalHeight / img.naturalWidth));
            const off = document.createElement('canvas');
            off.width = w;
            off.height = h;
            const octx = off.getContext('2d');
            octx.drawImage(img, 0, 0, w, h);

            if (slot) {
                const a = cal.areaPx(view === 'back' ? 'flatBack' : 'flatFront', loc,
                    colorObj.catalogColor, img.naturalWidth, img.naturalHeight);
                if (a) {
                    const scale = w / img.naturalWidth;
                    const area = { x: a.x * scale, y: a.y * scale, w: a.w * scale,
                                   h: a.h * scale, ppi: a.pxPerInch * scale };
                    const aspect = slot.naturalH / slot.naturalW;
                    const artW = slot.placement.wIn * area.ppi;
                    const artH = artW * aspect;
                    const cx = area.x + area.w / 2 + slot.placement.xIn * area.ppi;
                    const y = area.y + slot.placement.yIn * area.ppi;
                    octx.save();
                    octx.beginPath();
                    octx.rect(area.x, area.y, area.w, area.h);
                    octx.clip();
                    if (slot.previewable && slot.bitmap) {
                        octx.drawImage(slot.bitmap, cx - artW / 2, y, artW, artH);
                    }
                    octx.restore();
                }
            }

            return new Promise((resolve) => {
                try {
                    off.toBlob((b) => resolve(b), 'image/jpeg', EXPORT_JPEG_Q);
                } catch (_) {
                    resolve(null); // tainted canvas — caller falls back, never blocks
                }
            });
        }

        /** Boot-time taint canary — should never fire via the proxy. */
        async function taintCanary() {
            try {
                const g = state.garmentImg;
                if (!g) return true;
                const c = document.createElement('canvas');
                c.width = c.height = 2;
                c.getContext('2d').drawImage(g, 0, 0, 2, 2);
                c.toDataURL();
                return true;
            } catch (_) {
                if (opts.onError) opts.onError('Mockup export is blocked by the browser; ' +
                    'orders still work — our team composites placement manually.');
                return false;
            }
        }

        // Re-render on element resize (sticky column / orientation changes).
        const ro = typeof ResizeObserver !== 'undefined'
            ? new ResizeObserver(() => requestRender()) : null;
        if (ro) ro.observe(canvas);

        return {
            setColor(colorObj) { state.color = colorObj; ensureGarment(); },
            setView(v) { state.view = v === 'back' ? 'back' : 'front'; ensureGarment(); },
            setLocation(loc) {
                state.location = loc === 'FF' ? 'FF' : 'LC';
                const slot = state.slots.front;
                // Clamp against the FRONT area explicitly — currentGeometry()
                // is view-relative and would be the back geometry if the
                // customer is looking at the back when the location changes.
                if (slot && state.garmentImg && state.view === 'front') {
                    const g = currentGeometry();
                    if (g) clampPlacement(slot, g.area);
                }
                if (slot) emitPlacement(slot, true, 'front');
                requestRender();
            },
            setSlot(slotKey, slot) {
                state.slots[slotKey] = slot || null;
                requestRender();
                pokeIdleFade();
            },
            getView() { return state.view; },
            defaultPlacement,
            fitWidth,
            center,
            setWidthIn,
            maxWidthIn,
            preload,
            exportMockup,
            taintCanary,
            render: requestRender,
            destroy() {
                state.destroyed = true;
                if (ro) ro.disconnect();
                if (state.idleTimer) clearTimeout(state.idleTimer);
            },
        };
    }

    const TDTDesigner = { create };
    if (typeof module !== 'undefined' && module.exports) module.exports = TDTDesigner;
    global.TDTDesigner = TDTDesigner;
})(typeof window !== 'undefined' ? window : globalThis);
