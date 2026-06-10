/**
 * custom-tees-designer.js — interactive t-shirt designer canvas for the
 * Custom T-Shirts page (multi-style fork of 3-day-tees-designer.js).
 *
 * Isolated component (jds-mockup-creator.js precedent): owns canvas drawing
 * and gestures ONLY. It never reads or writes app state or outside DOM —
 * the app pushes product/design data in via setters and listens on
 * callbacks.
 *
 * Multi-style: init takes a styleNumber and resolves its print-area frames
 * through CTS_CALIBRATION.forStyle(styleNumber) (custom-tees-calibration.js).
 * Hand-calibrated styles (PC54) get pixel-true frames; every other style
 * gets the generic flat-lay model — the canvas then shows a subtle
 * "approximate preview" hint and exposes isCalibrated() so the app can
 * render its own badge. Box dimensions in INCHES are exact in BOTH modes.
 *
 * Coordinate contract (the production contract — see ORDER_PUSH_FLOW.md):
 *   placement = { wIn, xIn, yIn } in INCHES, top-center anchor:
 *     wIn — artwork printed width
 *     xIn — inches RIGHT of the print area's vertical centerline
 *     yIn — inches BELOW the print area's top edge
 *   Height derives from the artwork aspect ratio. Invariant under color
 *   swaps, canvas resizes, photo changes, and calibration mode. pxPerInch
 *   comes from the style entry's areaPx().
 *
 * Locations: front LC 4×4″ / FF 12×16″ / JF 16×20″ · back FB 12×16″ /
 * JB 16×20″ (inches authoritative in CTS_CALIBRATION.LOCATIONS).
 *
 * Garment photos load through the SAME-ORIGIN /api/image-proxy (server.js)
 * so canvas exports can never throw a cross-origin SecurityError.
 *
 * Usage:
 *   const dz = TDTDesigner.create({
 *     canvas,
 *     calibration: CTS_CALIBRATION,               // registry (or a legacy
 *     styleNumber: 'PC54',                        //  TDTCalibration object)
 *     onPlacementChange(slotKey, placement) {},   // debounced during drag
 *     onTapEmptyArea(slotKey) {},                 // open the file picker
 *     onInteract() {},                            // any gesture (idle-fade reset)
 *   });
 *   dz.setColor(colorObj) / dz.setView('front'|'back') /
 *   dz.setStyle(styleNumber) / dz.isCalibrated() /
 *   dz.setLocation('LC'|'FF'|'JF'|'FB'|'JB') / dz.setSlot('front', slot|null) /
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

    /**
     * Accepts either the CTS_CALIBRATION registry (has forStyle) or a legacy
     * pre-resolved calibration object (TDTCalibration shape) for back-compat.
     * Legacy objects lack `calibrated` → treated as calibrated (no hint).
     */
    function resolveCalibration(calOpt, styleNumber) {
        const registry = calOpt || global.CTS_CALIBRATION;
        if (registry && typeof registry.forStyle === 'function') {
            return registry.forStyle(styleNumber);
        }
        return registry;
    }

    function create(opts) {
        const canvas = opts.canvas;
        let cal = resolveCalibration(opts.calibration, opts.styleNumber);
        const ctx = canvas.getContext('2d');

        const state = {
            color: null,            // { catalogColor, colorName, images:{flatFront, flatBack} }
            view: 'front',          // 'front' | 'back'
            location: 'LC',         // front print location: 'LC' | 'FF' | 'JF'
            backLocation: 'FB',     // back print location: 'FB' | 'JB'
            slots: { front: null, back: null },
            garmentImg: null,       // loaded HTMLImageElement for current color+view
            loadError: null,
            outlineOpacity: 1,
            idleTimer: null,
            drag: null,             // { pointerId, startX, startY, startPlacement }
            resize: null,           // { pointerId } — corner-handle drag-to-size
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
        // FREE PLACEMENT (Erik 2026-06-10): the drawable area is the SIDE'S
        // FULL ENVELOPE (JF front / JB back, 16×20) — customers place and size
        // art anywhere inside it (right chest, center, low). The PRICE tier is
        // derived from the art's printed size (TDTPricing.locationForArtSize),
        // not from a picked location box. state.location/backLocation remain
        // only as legacy inputs from setLocation() and no longer drive geometry.
        function activeLocation() { return state.view === 'back' ? 'JB' : 'JF'; }
        function locationFor(slotKey) { return slotKey === 'back' ? 'JB' : 'JF'; }

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

        // ── Garment silhouette auto-fit (Erik 2026-06-10) ────────────────
        // SanMar's photo inventory is inconsistent per style/color (flats
        // missing → model shots; framing varies per era). Static fractions
        // can't survive that, so for UNCALIBRATED styles we detect the
        // garment's bounding box in the actual photo (white background scan)
        // and anchor the print envelope to it — flat lays scale by garment
        // width; model shots use chest-band ratios of the person's box.
        // Detection failure (e.g. white shirt on white bg) falls back to the
        // static fractions — never worse than before. Hand-calibrated styles
        // (PC54) skip all of this.
        const geomCache = {};   // proxied url → {bbox,kind} | null

        function detectGarmentGeometry(img, url) {
            if (url in geomCache) return geomCache[url];
            let out = null;
            try {
                const W = 96;
                const H = Math.max(1, Math.round(W * img.naturalHeight / img.naturalWidth));
                const c = document.createElement('canvas');
                c.width = W;
                c.height = H;
                const cx2 = c.getContext('2d', { willReadFrequently: true });
                cx2.drawImage(img, 0, 0, W, H);
                const d = cx2.getImageData(0, 0, W, H).data;
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
                const coverage = count / (W * H);
                if (maxX > minX && maxY > minY && coverage > 0.15) {
                    const sx = img.naturalWidth / W;
                    const sy = img.naturalHeight / H;
                    const bbox = {
                        x: minX * sx, y: minY * sy,
                        w: (maxX - minX + 1) * sx, h: (maxY - minY + 1) * sy,
                    };
                    // People are tall; flat garments (sleeves spread) are wide.
                    out = { bbox, kind: (bbox.h / bbox.w) > 1.35 ? 'model' : 'flat' };
                }
            } catch (_) { out = null; }   // tainted canvas → static fallback
            geomCache[url] = out;
            return out;
        }

        // Anchor ratios (tuned against live SanMar imagery 2026-06-10):
        const FLAT_GARMENT_W_IN = 22;     // adult tee flat width
        const MODEL_CHEST_W_FRAC = 0.52;  // 16″ envelope spans this much of the person bbox
        const MODEL_CHEST_TOP_FRAC = 0.30;// envelope top, fraction of person bbox height
        const MODEL_BACK_TOP_FRAC = 0.26; // back shots: yoke sits a touch higher

        function detectedAreaPx(geom, isBackView, dims) {
            const b = geom.bbox;
            if (geom.kind === 'flat') {
                const ppi = b.w / FLAT_GARMENT_W_IN;
                const collarY = b.y + b.h * 0.02;
                const topIn = isBackView ? 2 : 1.5;   // same press anchors as the static model
                const w = dims.wIn * ppi;
                const h = dims.hIn * ppi;
                return { x: b.x + b.w / 2 - w / 2, y: collarY + topIn * ppi, w, h,
                         wIn: dims.wIn, hIn: dims.hIn, pxPerInch: ppi };
            }
            const ppi = (b.w * MODEL_CHEST_W_FRAC) / 16;
            const w = dims.wIn * ppi;
            const h = dims.hIn * ppi;
            const topFrac = isBackView ? MODEL_BACK_TOP_FRAC : MODEL_CHEST_TOP_FRAC;
            return { x: b.x + b.w / 2 - w / 2, y: b.y + b.h * topFrac, w, h,
                     wIn: dims.wIn, hIn: dims.hIn, pxPerInch: ppi };
        }

        /** areaPx with silhouette auto-fit for uncalibrated styles. */
        function areaPxFor(view, loc, catalogColor, img, url) {
            if (!cal || cal.calibrated !== false) {
                return cal.areaPx(view, loc, catalogColor, img.naturalWidth, img.naturalHeight);
            }
            const geom = url ? detectGarmentGeometry(img, url) : null;
            if (geom) {
                const dims = (cal.locations && cal.locations[loc]) || { wIn: 16, hIn: 20 };
                return detectedAreaPx(geom, view === 'flatBack', dims);
            }
            return cal.areaPx(view, loc, catalogColor, img.naturalWidth, img.naturalHeight);
        }

        /** Print-area rect in canvas coords + pxPerInch at canvas scale. */
        function areaOnCanvas(img, rect) {
            const a = areaPxFor(viewKey(), activeLocation(),
                state.color && state.color.catalogColor,
                img, proxied(garmentUrl(state.color, state.view) || ''));
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

        /** Resize-handle center (art bottom-right corner). */
        function handlePoint(r) {
            return { x: r.x + r.w, y: r.y + r.h };
        }
        const HANDLE_R = 9;            // drawn radius
        const HANDLE_HIT = 16;         // pointer hit radius

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

                // Resize handle at the art's bottom-right corner (drag to size;
                // pinch + the slider still work too). (Erik 2026-06-10)
                const hp = handlePoint(r);
                ctx.save();
                ctx.globalAlpha = Math.max(state.outlineOpacity, 0.85);
                ctx.beginPath();
                ctx.arc(hp.x, hp.y, HANDLE_R, 0, Math.PI * 2);
                ctx.fillStyle = '#ffffff';
                ctx.fill();
                ctx.lineWidth = 2;
                ctx.strokeStyle = '#2f7d3b';
                ctx.stroke();
                // Diagonal resize glyph
                ctx.beginPath();
                ctx.moveTo(hp.x - 3.5, hp.y + 3.5);
                ctx.lineTo(hp.x + 3.5, hp.y - 3.5);
                ctx.moveTo(hp.x + 0.5, hp.y - 3.5);
                ctx.lineTo(hp.x + 3.5, hp.y - 3.5);
                ctx.lineTo(hp.x + 3.5, hp.y - 0.5);
                ctx.moveTo(hp.x - 0.5, hp.y + 3.5);
                ctx.lineTo(hp.x - 3.5, hp.y + 3.5);
                ctx.lineTo(hp.x - 3.5, hp.y + 0.5);
                ctx.lineWidth = 1.6;
                ctx.stroke();
                ctx.restore();
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
            // Generic (uncalibrated) styles: subtle on-canvas hint — the app
            // reads dz.isCalibrated() to render its own styled badge.
            if (cal && cal.calibrated === false) {
                ctx.font = 'italic 400 10px Inter, Arial, sans-serif';
                ctx.textAlign = 'right';
                ctx.globalAlpha = Math.max(state.outlineOpacity, 0.45);
                ctx.fillText('approximate preview', area.x + area.w - 2, area.y - 6);
            }
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

            // Resize handle wins over move — its hit circle sits on the art corner.
            const hp = handlePoint(r);
            if (Math.hypot(pt.x - hp.x, pt.y - hp.y) <= HANDLE_HIT) {
                state.resize = { pointerId: e.pointerId };
                state.drag = null;
                try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* ok */ }
                e.preventDefault();
                pokeIdleFade();
                return;
            }

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

            if (state.resize && state.resize.pointerId === e.pointerId) {
                // Drag-to-size from the bottom-right corner; the art's
                // TOP-CENTER anchor stays put (xIn/yIn unchanged), so growing
                // feels like pulling the corner outward. Width follows
                // whichever axis the pointer pulled further.
                const pt = canvasPoint(e);
                const aspect = slot.naturalH / slot.naturalW;
                const cx = g.area.x + g.area.w / 2 + slot.placement.xIn * g.area.ppi;
                const yTop = g.area.y + slot.placement.yIn * g.area.ppi;
                const wFromX = (2 * (pt.x - cx)) / g.area.ppi;
                const wFromY = ((pt.y - yTop) / g.area.ppi) / aspect;
                slot.placement.wIn = Math.max(wFromX, wFromY);
                clampPlacement(slot, g.area);
                emitPlacement(slot);
                pokeIdleFade();
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
            if (state.resize && state.resize.pointerId === e.pointerId) {
                state.resize = null;
                const slot = state.slots[activeSlotKey()];
                if (slot) emitPlacement(slot, true);
                requestRender();
            }
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
        /** Auto-fit: 80% of area width (LC) / 10″ (FF/FB) / 13″ (JF/JB), 1″ down. */
        function defaultPlacement(slotKey, naturalW, naturalH) {
            const loc = locationFor(slotKey);
            const a = cal.area(slotKey === 'back' ? 'flatBack' : 'flatFront', loc, null);
            const aspect = naturalH / naturalW;
            if (!a) return { wIn: 3, xIn: 0, yIn: 0.5 };
            let wIn = loc === 'LC' ? a.wIn * 0.8
                : Math.min(loc === 'JF' || loc === 'JB' ? 13 : 10, a.wIn);
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
            const loc = locationFor(slotKey);
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
            const loc = locationFor(slotKey);

            const w = widthPx || 1200;
            const h = Math.round(w * (img.naturalHeight / img.naturalWidth));
            const off = document.createElement('canvas');
            off.width = w;
            off.height = h;
            const octx = off.getContext('2d');
            octx.drawImage(img, 0, 0, w, h);

            if (slot) {
                const a = areaPxFor(view === 'back' ? 'flatBack' : 'flatFront', loc,
                    colorObj.catalogColor, img, p);
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

        // ── Zoom crop (close-up of the print area, natural-res source) ───
        // Renders the print area + margin from the FULL-RESOLUTION garment
        // photo (1200×1800-class), art composited at the same inch→px map the
        // mockup export uses — so the lightbox close-up is crisp, not a CSS
        // blow-up of the on-screen canvas. (Erik 2026-06-10)
        async function exportZoomCrop(view, outWidthPx) {
            const colorObj = state.color;
            if (!colorObj) return null;
            const url = garmentUrl(colorObj, view);
            if (!url) return null;
            const p = proxied(url);
            if (!imageCache[p]) imageCache[p] = loadImage(p);
            let img;
            try { img = await imageCache[p]; } catch (_) { return null; }

            const slotKey = view === 'back' ? 'back' : 'front';
            const slot = state.slots[slotKey];
            const loc = locationFor(slotKey);
            const a = areaPxFor(view === 'back' ? 'flatBack' : 'flatFront', loc,
                colorObj.catalogColor, img, p);
            if (!a) return null;

            // Crop = print area + breathing room (more above for collar context)
            const mx = a.w * 0.30;
            const myTop = a.h * 0.18;
            const myBot = a.h * 0.10;
            const sx = Math.max(0, a.x - mx);
            const sy = Math.max(0, a.y - myTop);
            const sw = Math.min(img.naturalWidth - sx, a.w + mx * 2);
            const sh = Math.min(img.naturalHeight - sy, a.h + myTop + myBot);

            const outW = outWidthPx || 1000;
            const outH = Math.round(outW * (sh / sw));
            const off = document.createElement('canvas');
            off.width = outW;
            off.height = outH;
            const octx = off.getContext('2d');
            octx.imageSmoothingQuality = 'high';
            octx.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH);

            if (slot && slot.previewable && slot.bitmap) {
                const k = outW / sw;   // natural-px → crop-out px
                const aspect = slot.naturalH / slot.naturalW;
                const artW = slot.placement.wIn * a.pxPerInch;
                const artH = artW * aspect;
                const cx = a.x + a.w / 2 + slot.placement.xIn * a.pxPerInch;
                const y = a.y + slot.placement.yIn * a.pxPerInch;
                octx.save();
                octx.beginPath();
                octx.rect((a.x - sx) * k, (a.y - sy) * k, a.w * k, a.h * k);
                octx.clip();
                octx.drawImage(slot.bitmap, (cx - artW / 2 - sx) * k, (y - sy) * k, artW * k, artH * k);
                octx.restore();
            }

            try { return off.toDataURL('image/jpeg', 0.9); } catch (_) { return null; }
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
            /**
             * Swap calibration to another style (frames change, placements
             * in inches survive — they're re-clamped against the new areas).
             */
            setStyle(styleNumber) {
                cal = resolveCalibration(opts.calibration, styleNumber);
                const slot = state.slots[activeSlotKey()];
                if (slot && state.garmentImg) {
                    const g = currentGeometry();
                    if (g) { clampPlacement(slot, g.area); emitPlacement(slot, true); }
                }
                requestRender();
            },
            /** false → app should show its "approximate preview" badge. */
            isCalibrated() { return !(cal && cal.calibrated === false); },
            getLocations() { return cal && cal.locations; },
            setLocation(loc) {
                const isBackLoc = loc === 'FB' || loc === 'JB';
                // Clamp against the OWNING side's area explicitly —
                // currentGeometry() is view-relative and would be the wrong
                // geometry if the customer is looking at the other side when
                // the location changes.
                if (isBackLoc) {
                    state.backLocation = loc;
                    const slot = state.slots.back;
                    if (slot && state.garmentImg && state.view === 'back') {
                        const g = currentGeometry();
                        if (g) clampPlacement(slot, g.area);
                    }
                    if (slot) emitPlacement(slot, true, 'back');
                } else {
                    state.location = (loc === 'FF' || loc === 'JF') ? loc : 'LC';
                    const slot = state.slots.front;
                    if (slot && state.garmentImg && state.view === 'front') {
                        const g = currentGeometry();
                        if (g) clampPlacement(slot, g.area);
                    }
                    if (slot) emitPlacement(slot, true, 'front');
                }
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
            exportZoomCrop,
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
