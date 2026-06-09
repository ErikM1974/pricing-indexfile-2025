/**
 * 3-day-tees-app.js — application core for the 3-Day Tees design studio.
 *
 * Owns: state + sessionStorage persistence, API loads (pricing bundle,
 * product images, Service_Codes config, bulk inventory, tax lookup),
 * every UI renderer (sticky bar, smart CTA, color cards, tier meter,
 * review panel), the designer wiring, and the 4-step checkout pipeline
 * (stock recheck → uploads → quote save + Stripe session → redirect).
 *
 * Money rules (Erik):
 *   - Every price comes from an API at runtime: /api/pricing-bundle +
 *     Service_Codes 3DT-RUSH / 3DT-LTM / 3DT-SHIP + /api/tax-rates/lookup.
 *     Config failure = full-page fatal state. NEVER a guessed price.
 *   - All math lives in TDTPricing.quote() — this file only renders it.
 *   - COLOR_NAME is display-only; CATALOG_COLOR keys everything.
 *
 * Modules loaded before this file: TDTPricing, TDTShipDate, TDTCalibration,
 * TDTDesigner (see 3-day-tees.html script order).
 */
(function () {
    'use strict';

    // ── Config ──────────────────────────────────────────────────────
    const API_BASE = (window.APP_CONFIG && window.APP_CONFIG.API && window.APP_CONFIG.API.BASE_URL)
        || 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
    const STYLE = 'PC54';
    const SIZES = ['S', 'M', 'L', 'XL', '2XL', '3XL'];
    const PERSIST_KEY = '3dt_studio_v1';

    // Artwork quality gates (UX thresholds, not money — money lives in Caspio)
    const DPI_GREEN = 150;
    const DPI_AMBER = 100;
    const DPI_HARD_STOP = 60;
    const RASTER_EXTS = /\.(png|jpe?g|webp)$/i;
    const SVG_EXT = /\.svg$/i;
    const ALL_EXTS = /\.(png|jpe?g|webp|svg|ai|eps|pdf|psd|tiff?)$/i;
    const MAX_BYTES = 20 * 1024 * 1024;

    // ── State ───────────────────────────────────────────────────────
    const S = {
        boot: { ready: false, fatal: null },
        config: { rushPct: null, ltmFee: null, ltmThreshold: null, shipFee: null, sizes: SIZES },
        pricing: null,
        product: { colors: [] },       // [{catalogColor, colorName, swatchImage, images:{...}}]
        inventory: { byColor: {}, fetchedAt: 0, error: false },
        design: {
            frontLocation: 'LC',
            backEnabled: false,
            previewColor: null,        // catalogColor shown on the canvas
            front: null,               // artwork slot | null
            back: null,
        },
        cart: { lines: [] },           // [{catalogColor, qty:{S:0,...}}]
        customer: { firstName: '', lastName: '', email: '', phone: '', company: '' },
        delivery: {
            method: 'ship',
            address: { address1: '', city: '', state: '', zip: '' },
            notes: '',
            tax: { rate: null, account: null, accountName: null, source: null, error: false },
            // Real UPS Ground estimate from /api/three-day-tees/shipping-estimate
            // (server-resolved so display == charge). 'flat' = 3DT-SHIP fallback.
            shipEstimate: { status: 'idle', amount: null, source: null, key: '' },
        },
        checkout: { running: false, quoteId: null },
        ui: { celebratedTier: false },
    };

    let designer = null;
    const $ = (id) => document.getElementById(id);

    // ── Tiny helpers ────────────────────────────────────────────────
    function escapeHTML(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
        }[c]));
    }
    const money = (v) => '$' + (Number(v) || 0).toFixed(2);
    // 0.101 → "10.1", 0.1055 → "10.55" — never hide rate precision the
    // charge math actually uses.
    const ratePct = (r) => String(Math.round(r * 10000) / 100);
    const debounce = (fn, ms) => {
        let t = null;
        return function () {
            clearTimeout(t);
            const args = arguments;
            t = setTimeout(() => fn.apply(null, args), ms);
        };
    };

    function toast(msg, type, action) {
        const wrap = $('tdt-toasts');
        const el = document.createElement('div');
        el.className = 'tdt-toast' + (type ? ' is-' + type : '');
        el.innerHTML = '<span>' + escapeHTML(msg) + '</span>';
        if (action) {
            const btn = document.createElement('button');
            btn.className = 'link-btn';
            btn.textContent = action.label;
            btn.addEventListener('click', () => { action.fn(); el.remove(); });
            el.appendChild(btn);
        }
        wrap.appendChild(el);
        setTimeout(() => el.remove(), action ? 6000 : 3600);
    }

    async function fetchJson(url, opts) {
        const res = await fetch(url, opts);
        if (!res.ok) {
            const body = await res.text().catch(() => '');
            throw new Error(`HTTP ${res.status} from ${url.split('?')[0]} ${body.slice(0, 140)}`);
        }
        return res.json();
    }

    // ── Shipping (server-resolved UPS estimate, flat fallback) ──────
    function effectiveShip() {
        const est = S.delivery.shipEstimate;
        if (S.delivery.method === 'pickup') return { fee: 0, label: 'Pickup — Milton, WA', tag: 'pickup' };
        if (est.status === 'done' && est.source === 'ups-estimate') {
            return { fee: est.amount, label: 'UPS Ground shipping (estimated)', tag: 'estimated' };
        }
        if (est.status === 'done' && est.source === 'flat') {
            return { fee: est.amount, label: 'UPS Ground shipping (flat rate)', tag: 'flat' };
        }
        // idle / loading / failed → provisional flat from Caspio 3DT-SHIP;
        // Pay is gated while a live estimate is still loading.
        return {
            fee: S.config.shipFee,
            label: est.status === 'loading' ? 'UPS Ground shipping (updating…)' : 'UPS Ground shipping (flat rate)',
            tag: est.status === 'loading' ? 'loading' : 'flat',
        };
    }

    let shipEstimateTimer = null;
    function maybeRequestShipEstimate() {
        const est = S.delivery.shipEstimate;
        const zip = (S.delivery.address.zip || '').trim();
        const qty = TDTPricing.combinedQuantity(S.cart.lines);
        if (S.delivery.method !== 'ship' || !/^\d{5}(-\d{4})?$/.test(zip) || !qty) return;
        const key = `${zip.slice(0, 5)}|${qty}`;
        if (est.key === key && (est.status === 'done' || est.status === 'loading')) return;
        est.key = key;
        est.status = 'loading';
        clearTimeout(shipEstimateTimer);
        shipEstimateTimer = setTimeout(async () => {
            try {
                const j = await fetchJson('/api/three-day-tees/shipping-estimate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ toZip: zip.slice(0, 5), qty }),
                });
                if (S.delivery.shipEstimate.key !== key) return; // stale
                est.status = 'done';
                est.amount = parseFloat(j.amount);
                est.source = j.source;
            } catch (e) {
                console.error('[3DT] Shipping estimate failed (using flat rate):', e);
                if (S.delivery.shipEstimate.key !== key) return;
                est.status = 'failed';
                est.amount = null;
                est.source = null;
            }
            renderAll();
        }, 350);
    }

    // ── Quote (single money source) ─────────────────────────────────
    function currentQuote() {
        try {
            return TDTPricing.quote({
                pricingData: S.pricing,
                config: Object.assign({}, S.config, { shipFee: effectiveShip().fee }),
                cart: S.cart.lines.map((l) => ({
                    catalogColor: l.catalogColor,
                    colorName: colorOf(l.catalogColor).colorName,
                    qty: l.qty,
                })),
                location: S.design.frontLocation,
                backEnabled: S.design.backEnabled,
                delivery: { method: S.delivery.method, taxRate: S.delivery.tax.rate },
            });
        } catch (e) {
            console.error('[3DT] Pricing failed:', e);
            fatal('Live pricing failed: ' + e.message);
            return null;
        }
    }

    function colorOf(catalogColor) {
        return S.product.colors.find((c) => c.catalogColor === catalogColor)
            || { catalogColor, colorName: catalogColor, images: {} };
    }

    function stockFor(catalogColor, size) {
        const c = S.inventory.byColor[catalogColor];
        if (!c || !c.sizes) return 0;
        const n = parseInt(c.sizes[size], 10);
        return Number.isFinite(n) ? Math.max(0, n) : 0;
    }

    // ── Boot ────────────────────────────────────────────────────────
    function fatal(msg) {
        S.boot.fatal = msg;
        $('tdt-fatal-msg').textContent = msg + ' — or call us and we’ll take your order by phone.';
        $('tdt-fatal').hidden = false;
    }

    async function loadServiceCode(code) {
        const j = await fetchJson(`${API_BASE}/api/service-codes?code=${encodeURIComponent(code)}`);
        const row = j && j.data && j.data[0];
        if (!row || !row.IsActive || !(parseFloat(row.SellPrice) >= 0)) {
            throw new Error(`Service code ${code} missing/inactive in Caspio`);
        }
        return parseFloat(row.SellPrice);
    }

    async function boot() {
        try {
            const [pricing, details, inv, rushPct, ltmFee, shipFee] = await Promise.all([
                fetchJson(`${API_BASE}/api/pricing-bundle?method=DTG&styleNumber=${STYLE}`),
                fetchJson(`${API_BASE}/api/product-details?styleNumber=${STYLE}`),
                fetchJson(`${API_BASE}/api/manageorders/pc54-inventory`),
                loadServiceCode('3DT-RUSH'),
                loadServiceCode('3DT-LTM'),
                loadServiceCode('3DT-SHIP'),
            ]);

            S.pricing = pricing;
            S.config.rushPct = rushPct;
            S.config.ltmFee = ltmFee;
            S.config.shipFee = shipFee;
            // LTM threshold = the lowest non-LTM tier's floor (API-driven, today 24)
            const nonLtm = (pricing.tiersR || [])
                .filter((t) => !parseFloat(t.LTM_Fee || 0))
                .sort((a, b) => a.MinQuantity - b.MinQuantity);
            if (!nonLtm.length) throw new Error('Pricing tiers missing a non-LTM tier');
            S.config.ltmThreshold = nonLtm[0].MinQuantity;

            // Stocked colors (inventory is the authority) joined to imagery
            applyInventory(inv);
            const rows = Array.isArray(details) ? details : (details.result || []);
            const byCatalog = new Map();
            rows.forEach((r) => { if (!byCatalog.has(r.CATALOG_COLOR)) byCatalog.set(r.CATALOG_COLOR, r); });
            S.product.colors = Object.keys(S.inventory.byColor).map((cc) => {
                const r = byCatalog.get(cc);
                if (!r) return { catalogColor: cc, colorName: cc, swatchImage: '', images: {} };
                return {
                    catalogColor: cc,
                    colorName: r.COLOR_NAME || cc,
                    swatchImage: r.COLOR_SQUARE_IMAGE || '',
                    images: {
                        flatFront: r.FRONT_FLAT || r.PRODUCT_IMAGE || r.FRONT_MODEL || '',
                        flatBack: r.BACK_FLAT || r.BACK_MODEL || '',
                        frontModel: r.FRONT_MODEL || '',
                        backModel: r.BACK_MODEL || '',
                    },
                };
            });
            if (!S.product.colors.length) throw new Error('No stocked colors returned');

            initDesigner();
            restoreSession();
            wireEverything();

            S.boot.ready = true;
            syncDeliveryUI();
            renderStage2();
            renderDesignControls();
            renderAll();
            renderPromise();
            setInterval(renderPromise, 30000);

            const runway = TDTShipDate.calendarRunwayDays(new Date());
            if (runway < 400) {
                console.warn(`[3DT] Holiday calendar has ${runway} days of runway — extend 3-day-tees-shipdate.js`);
            }
            if (new URLSearchParams(location.search).get('canceled')) {
                toast('Your order is saved — ready when you are.', 'success');
            }
        } catch (e) {
            console.error('[3DT] Boot failed:', e);
            fatal('We couldn’t load live pricing or stock (' + e.message + ').');
        }
    }

    function applyInventory(inv) {
        if (!inv || !inv.colors || !Object.keys(inv.colors).length) {
            S.inventory.error = true;
            return;
        }
        S.inventory.byColor = inv.colors;
        S.inventory.fetchedAt = Date.now();
        S.inventory.error = false;
    }

    async function refreshInventory(bustCache) {
        try {
            const url = `${API_BASE}/api/manageorders/pc54-inventory` + (bustCache ? `?t=${Date.now()}` : '');
            applyInventory(await fetchJson(url));
        } catch (e) {
            console.error('[3DT] Inventory refresh failed:', e);
            S.inventory.error = true;
        }
        renderStage2();
        renderAll();
    }

    // ── Designer init + artwork handling ────────────────────────────
    function initDesigner() {
        designer = TDTDesigner.create({
            canvas: $('tdt-canvas'),
            calibration: TDTCalibration,
            liveRegion: $('designer-live'),
            onPlacementChange(slotKey, placement) {
                const slot = S.design[slotKey];
                if (!slot) return;
                slot.placement = placement;
                refreshDpi(slot);
                renderDesignControls();
                persistSoon();
            },
            onTapEmptyArea() { $('art-input').click(); },
            onError(msg) { showCanvasNote(msg); },
        });
        const first = S.product.colors[0];
        S.design.previewColor = first.catalogColor;
        designer.setColor(first);
        designer.preload(S.product.colors);
        $('canvas-loading').hidden = true;
        setTimeout(() => designer.taintCanary(), 1500);
    }

    function showCanvasNote(msg) {
        const el = $('canvas-note');
        if (!msg) { el.hidden = true; return; }
        el.textContent = msg;
        el.hidden = false;
        setTimeout(() => { el.hidden = true; }, 6000);
    }

    function activeSlotKey() { return designer && designer.getView() === 'back' ? 'back' : 'front'; }

    async function handleArtworkFile(file) {
        if (!file) return;
        if (!ALL_EXTS.test(file.name)) {
            toast(`We can’t use .${file.name.split('.').pop()} files. PNG, JPG, SVG, AI, EPS, PDF, PSD or TIFF.`, 'error');
            return;
        }
        if (file.size > MAX_BYTES) {
            toast('That file is over 20 MB — email it to sales@nwcustomapparel.com and we’ll take it from there.', 'error');
            return;
        }

        const slotKey = activeSlotKey();
        const slot = {
            file, fileName: file.name, mime: file.type || '',
            previewable: false, bitmap: null, naturalW: 1000, naturalH: 1000,
            isVector: false, placement: null, effectiveDpi: null,
            lowDpiAck: false, warnings: [], uploaded: null,
        };

        try {
            if (RASTER_EXTS.test(file.name)) {
                const decoded = await decodeRaster(file);
                slot.previewable = true;
                slot.bitmap = decoded.bitmap;
                slot.naturalW = decoded.naturalW;
                slot.naturalH = decoded.naturalH;
                if (/\.jpe?g$/i.test(file.name) && decoded.whiteBox) {
                    slot.warnings.push('jpeg-white-box');
                }
            } else if (SVG_EXT.test(file.name)) {
                const decoded = await decodeSvg(file);
                slot.previewable = true;
                slot.isVector = true;
                slot.bitmap = decoded.bitmap;
                slot.naturalW = decoded.naturalW;
                slot.naturalH = decoded.naturalH;
                if (decoded.needsReview) slot.warnings.push('svg-needs-review');
            }
        } catch (e) {
            console.warn('[3DT] Preview decode failed, falling back to placeholder:', e);
            slot.previewable = false;
        }

        slot.placement = designer.defaultPlacement(slotKey, slot.naturalW, slot.naturalH);
        if (slotKey === 'back' && !S.design.backEnabled) {
            S.design.backEnabled = true;
            $('back-toggle').checked = true;
        }
        S.design[slotKey] = slot;
        designer.setSlot(slotKey, slot);
        refreshDpi(slot);
        renderDesignControls();
        renderAll();
        persistSoon();
    }

    async function decodeRaster(file) {
        let bitmap;
        if (window.createImageBitmap) {
            bitmap = await createImageBitmap(file);
        } else {
            bitmap = await new Promise((resolve, reject) => {
                const img = new Image();
                const url = URL.createObjectURL(file);
                img.onload = () => resolve(img);
                img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode failed')); };
                img.src = url;
            });
        }
        const naturalW = bitmap.naturalWidth || bitmap.width;
        const naturalH = bitmap.naturalHeight || bitmap.height;

        // Downscale huge previews (iOS memory) — DPI math keeps original dims.
        let preview = bitmap;
        const LONG = 2048;
        if (Math.max(naturalW, naturalH) > LONG) {
            const k = LONG / Math.max(naturalW, naturalH);
            const c = document.createElement('canvas');
            c.width = Math.round(naturalW * k);
            c.height = Math.round(naturalH * k);
            c.getContext('2d').drawImage(bitmap, 0, 0, c.width, c.height);
            preview = c;
        }

        // White-box JPEG check: are the border pixels ~all near-white?
        let whiteBox = false;
        try {
            const c = document.createElement('canvas');
            const w = 64, h = 64;
            c.width = w; c.height = h;
            const x = c.getContext('2d');
            x.drawImage(bitmap, 0, 0, w, h);
            const d = x.getImageData(0, 0, w, h).data;
            let border = 0, white = 0;
            for (let i = 0; i < w * h; i++) {
                const px = i % w, py = (i / w) | 0;
                if (px > 1 && px < w - 2 && py > 1 && py < h - 2) continue;
                border++;
                const o = i * 4;
                if (d[o] > 245 && d[o + 1] > 245 && d[o + 2] > 245) white++;
            }
            whiteBox = border > 0 && white / border >= 0.98;
        } catch (_) { /* taint-proof: skip the tip */ }

        return { bitmap: preview, naturalW, naturalH, whiteBox };
    }

    async function decodeSvg(file) {
        const text = await file.text();
        const needsReview = /<text[\s>]/i.test(text) || /href\s*=\s*["']https?:/i.test(text);
        const blob = new Blob([text], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        try {
            const img = await new Promise((resolve, reject) => {
                const i = new Image();
                i.onload = () => resolve(i);
                i.onerror = () => reject(new Error('SVG decode failed'));
                i.src = url;
            });
            let w = img.naturalWidth, h = img.naturalHeight;
            if (!w || !h) {
                const vb = /viewBox\s*=\s*["'][\d.\s-]*?([\d.]+)[\s,]+([\d.]+)\s*["']/i.exec(text);
                const aspect = vb ? (parseFloat(vb[2]) / parseFloat(vb[1])) : 1;
                w = 1600; h = Math.round(1600 * aspect);
            }
            const c = document.createElement('canvas');
            c.width = w; c.height = h;
            c.getContext('2d').drawImage(img, 0, 0, w, h);
            return { bitmap: c, naturalW: w, naturalH: h, needsReview };
        } finally {
            URL.revokeObjectURL(url);
        }
    }

    function refreshDpi(slot) {
        if (!slot || slot.isVector || !slot.previewable) { return; }
        slot.effectiveDpi = Math.round(slot.naturalW / Math.max(0.1, slot.placement.wIn));
        if (slot.effectiveDpi >= DPI_AMBER) slot.lowDpiAck = false;
    }

    function removeArtwork(slotKey, opts) {
        const prev = S.design[slotKey];
        if (!prev) return;
        S.design[slotKey] = null;
        designer.setSlot(slotKey, null);
        renderDesignControls();
        renderAll();
        persistSoon();
        if (!opts || !opts.silent) {
            toast(`Removed ${prev.fileName}`, null, {
                label: 'Undo',
                fn() {
                    S.design[slotKey] = prev;
                    designer.setSlot(slotKey, prev);
                    renderDesignControls();
                    renderAll();
                    persistSoon();
                },
            });
        }
    }

    // ── Designer-side renderers ─────────────────────────────────────
    function renderDesignControls() {
        const view = designer ? designer.getView() : 'front';
        const slotKey = view === 'back' ? 'back' : 'front';
        const slot = S.design[slotKey];

        $('drop-label').textContent = view === 'back' ? 'Back artwork' : 'Front artwork';
        $('canvas-hint').textContent = slot
            ? 'Drag to position · pinch or use the slider to resize'
            : 'Tap inside the dashed area to add your artwork';

        // Tab badges
        ['front', 'back'].forEach((k) => {
            const badge = $(`tab-${k}-badge`);
            const s = S.design[k];
            if (!s) { badge.hidden = true; return; }
            const warn = (s.effectiveDpi && s.effectiveDpi < DPI_AMBER) || s.warnings.length;
            badge.textContent = warn ? '!' : '✓';
            badge.classList.toggle('is-warn', !!warn);
            badge.hidden = false;
        });

        // File card
        if (slot) {
            $('art-drop').hidden = true;
            $('art-file').hidden = false;
            $('art-file-name').textContent = slot.fileName;
            $('art-file-size').textContent = (slot.file ? (slot.file.size / 1024 / 1024).toFixed(1) + ' MB'
                : 'restored — re-attach to change');
            const thumb = $('art-file-thumb');
            if (slot.previewable && slot.bitmap && slot.bitmap.toDataURL) {
                thumb.style.backgroundImage = `url("${slot.bitmap.toDataURL()}")`;
                thumb.textContent = '';
            } else if (slot.previewable && slot.file) {
                const fr = new FileReader();
                fr.onload = () => { thumb.style.backgroundImage = `url("${fr.result}")`; };
                fr.readAsDataURL(slot.file);
                thumb.textContent = '';
            } else {
                thumb.style.backgroundImage = '';
                thumb.textContent = slot.fileName.split('.').pop().toUpperCase();
            }
        } else {
            $('art-drop').hidden = false;
            $('art-file').hidden = true;
        }

        // Size block + slider
        $('size-block').hidden = !slot;
        if (slot) {
            const slider = $('art-size');
            slider.max = designer.maxWidthIn(slotKey);
            slider.value = slot.placement.wIn;
            $('art-size-label').textContent = slot.placement.wIn.toFixed(1) + '″';
        }

        // DPI meter
        const meter = $('dpi-meter');
        const ackRow = $('dpi-ack-row');
        if (slot && slot.previewable && !slot.isVector && slot.effectiveDpi) {
            meter.hidden = false;
            const dot = $('dpi-dot');
            const dpi = slot.effectiveDpi;
            dot.className = 'dpi-dot ' + (dpi >= DPI_GREEN ? 'is-ok' : dpi >= DPI_AMBER ? 'is-warn' : 'is-bad');
            let label;
            if (dpi >= DPI_GREEN) label = `${dpi} DPI — prints crisp ✓`;
            else if (dpi >= DPI_AMBER) {
                const okWidth = (slot.naturalW / DPI_GREEN).toFixed(1);
                label = `${dpi} DPI — OK, crisp at ${okWidth}″ or smaller`;
            } else if (dpi >= DPI_HARD_STOP) {
                label = `${dpi} DPI — too low to print well at this size.`;
            } else {
                label = `${dpi} DPI — far too low; shrink it or email us your original art.`;
            }
            $('dpi-text').textContent = label;
            ackRow.hidden = !(dpi < DPI_AMBER && dpi >= DPI_HARD_STOP);
            $('dpi-ack').checked = slot.lowDpiAck;
        } else if (slot && slot.isVector) {
            meter.hidden = false;
            $('dpi-dot').className = 'dpi-dot is-ok';
            $('dpi-text').textContent = 'Vector — sharp at any size ✓';
            ackRow.hidden = true;
        } else {
            meter.hidden = true;
            ackRow.hidden = true;
        }

        // Warnings
        const warnEl = $('art-warning');
        if (slot && (slot.warnings.length || !slot.previewable)) {
            const msgs = [];
            if (!slot.previewable) {
                msgs.push('We can’t preview this file type in the browser. Position the gray box where you want your art — our art team will match it and email you a proof before printing (usually within 2 business hours). Your 3-day clock starts at proof approval.');
            }
            if (slot.warnings.includes('jpeg-white-box')) {
                msgs.push('Heads-up: JPGs have no transparency — the white rectangle will print. Upload a PNG with transparency to avoid it.');
            }
            if (slot.warnings.includes('svg-needs-review')) {
                msgs.push('This SVG uses live text or linked images, which can render differently on press — we’ll send a proof before printing.');
            }
            warnEl.innerHTML = msgs.map(escapeHTML).join('<br><br>');
            warnEl.classList.toggle('is-info', !slot.previewable && !slot.warnings.length);
            warnEl.hidden = false;
        } else {
            warnEl.hidden = true;
        }

        renderLocationPrices();
    }

    function renderLocationPrices() {
        if (!S.boot.ready && !S.pricing) return;
        const q = (loc) => {
            try {
                const qty = Math.max(1, TDTPricing.combinedQuantity(S.cart.lines));
                return TDTPricing.unitPrice(S.pricing, S.config, qty, loc, S.design.backEnabled, 'M').finalPrice;
            } catch (_) { return null; }
        };
        const lc = q('LC'), ff = q('FF');
        $('loc-LC-price').textContent = lc != null ? money(lc) + '/shirt' : '$—';
        $('loc-FF-price').textContent = ff != null ? money(ff) + '/shirt' : '$—';
        try {
            const qty = Math.max(1, TDTPricing.combinedQuantity(S.cart.lines));
            const without = TDTPricing.unitPrice(S.pricing, S.config, qty, S.design.frontLocation, false, 'M').finalPrice;
            const withBack = TDTPricing.unitPrice(S.pricing, S.config, qty, S.design.frontLocation, true, 'M').finalPrice;
            $('back-delta').textContent = `12″×16″ · +${money(withBack - without)}/shirt`;
        } catch (_) { /* leave default */ }
    }

    // ── Promise banner ──────────────────────────────────────────────
    function renderPromise() {
        const p = TDTShipDate.promise(new Date());
        const main = $('promise-main');
        const sub = $('promise-sub');
        if (p.beforeCutoff) {
            main.textContent = `Order in the next ${p.cutoff.hours}h ${p.cutoff.minutes}m → ships ${p.shipDateShort}`;
            sub.textContent = `9 AM ${p.tzAbbr} cutoff · 3 business days · from Milton, WA`;
        } else {
            main.textContent = `Order today → ships ${p.shipDateShort}`;
            sub.textContent = `Next cutoff: ${p.cutoff.dayLong.split(',')[0]} 9 AM ${p.tzAbbr} (${p.cutoff.hours}h ${p.cutoff.minutes}m)`;
        }
        renderBar();
    }

    // ── Stage 2: colors + sizes ─────────────────────────────────────
    function renderStage2() {
        renderColorChips();
        renderColorCards();
        $('inventory-error').hidden = !S.inventory.error;
        $('inventory-stamp').textContent = S.inventory.fetchedAt
            ? `Live stock from our Milton warehouse · updated ${new Date(S.inventory.fetchedAt).toLocaleTimeString()}`
            : '';
    }

    function renderColorChips() {
        const wrap = $('color-chips');
        wrap.innerHTML = '';
        S.product.colors.forEach((c) => {
            const inCart = S.cart.lines.some((l) => l.catalogColor === c.catalogColor);
            const inv = S.inventory.byColor[c.catalogColor];
            const total = inv ? inv.total : 0;
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'color-chip' + (inCart ? ' is-active' : '');
            btn.disabled = S.inventory.error;
            const stockCls = total <= 0 ? 'is-out' : total <= 24 ? 'is-low' : '';
            const stockTxt = total <= 0 ? 'Out of stock' : total <= 24 ? `${total} left` : 'In stock';
            btn.innerHTML =
                `<span class="chip-swatch" style="background-image:url('${escapeHTML(c.swatchImage)}')"></span>` +
                `<span>${escapeHTML(c.colorName)}</span>` +
                `<span class="chip-stock ${stockCls}">${stockTxt}</span>`;
            btn.addEventListener('click', () => toggleColor(c.catalogColor));
            wrap.appendChild(btn);
        });
    }

    function toggleColor(catalogColor) {
        const i = S.cart.lines.findIndex((l) => l.catalogColor === catalogColor);
        if (i >= 0) {
            const removed = S.cart.lines.splice(i, 1)[0];
            const count = Object.values(removed.qty).reduce((a, b) => a + (b || 0), 0);
            renderStage2(); renderAll(); persistSoon();
            if (count > 0) {
                toast(`Removed ${colorOf(catalogColor).colorName} (${count} shirts)`, null, {
                    label: 'Undo',
                    fn() { S.cart.lines.splice(i, 0, removed); renderStage2(); renderAll(); persistSoon(); },
                });
            }
        } else {
            const qty = {};
            SIZES.forEach((s) => { qty[s] = 0; });
            S.cart.lines.push({ catalogColor, qty });
            S.design.previewColor = catalogColor;
            designer.setColor(colorOf(catalogColor));
            renderStage2(); renderAll(); persistSoon();
        }
    }

    function renderColorCards() {
        const wrap = $('color-cards');
        wrap.innerHTML = '';
        S.cart.lines.forEach((line, idx) => {
            const c = colorOf(line.catalogColor);
            const card = document.createElement('div');
            card.className = 'color-card';
            const count = Object.values(line.qty).reduce((a, b) => a + (b || 0), 0);

            let cells = '';
            SIZES.forEach((size) => {
                const stock = stockFor(line.catalogColor, size);
                const q = line.qty[size] || 0;
                const up = (S.pricing && (S.pricing.sellingPriceDisplayAddOns || {})[size]) || 0;
                const stockCls = stock <= 0 ? 'is-out' : stock <= 12 ? 'is-low' : '';
                const stockTxt = stock <= 0 ? 'Out of stock' : stock <= 12 ? `Only ${stock} left` : `${stock} in stock`;
                cells += `
                    <div class="size-cell ${stock <= 0 ? 'is-out' : ''}">
                        <div class="size-cell-label">${size}${up ? ` <small>+${money(up)}</small>` : ''}</div>
                        <div class="size-cell-stock ${stockCls}">${stockTxt}</div>
                        <div class="stepper">
                            <button type="button" data-color="${escapeHTML(line.catalogColor)}" data-size="${size}" data-d="-1" aria-label="Fewer ${size}" ${q <= 0 ? 'disabled' : ''}>−</button>
                            <input type="text" inputmode="numeric" value="${q}" data-color="${escapeHTML(line.catalogColor)}" data-size="${size}" aria-label="${size} quantity" ${stock <= 0 ? 'disabled' : ''}>
                            <button type="button" data-color="${escapeHTML(line.catalogColor)}" data-size="${size}" data-d="1" aria-label="More ${size}" ${q >= stock ? 'disabled' : ''}>+</button>
                        </div>
                    </div>`;
            });

            const copyLink = idx > 0
                ? `<button type="button" class="link-btn copy-sizes" data-from="${escapeHTML(S.cart.lines[idx - 1].catalogColor)}" data-to="${escapeHTML(line.catalogColor)}">Copy sizes from ${escapeHTML(colorOf(S.cart.lines[idx - 1].catalogColor).colorName)}</button>`
                : '';

            card.innerHTML = `
                <div class="color-card-head">
                    <span class="chip-swatch" style="background-image:url('${escapeHTML(c.swatchImage)}')"></span>
                    <strong>${escapeHTML(c.colorName)}</strong>
                    ${copyLink}
                    <button type="button" class="color-card-remove" data-remove="${escapeHTML(line.catalogColor)}" aria-label="Remove ${escapeHTML(c.colorName)}"><i class="fas fa-times"></i></button>
                </div>
                <div class="size-grid">${cells}</div>
                <div class="color-card-foot"><span>${count} piece${count === 1 ? '' : 's'}</span></div>`;
            wrap.appendChild(card);
        });

        // Wire steppers
        wrap.querySelectorAll('.stepper button').forEach((b) => {
            b.addEventListener('click', () => {
                setQty(b.dataset.color, b.dataset.size,
                    (lineQty(b.dataset.color, b.dataset.size) || 0) + parseInt(b.dataset.d, 10));
            });
        });
        wrap.querySelectorAll('.stepper input').forEach((inp) => {
            inp.addEventListener('focus', () => inp.select());
            inp.addEventListener('change', () => {
                setQty(inp.dataset.color, inp.dataset.size, parseInt(inp.value, 10) || 0);
            });
        });
        wrap.querySelectorAll('[data-remove]').forEach((b) => {
            b.addEventListener('click', () => toggleColor(b.dataset.remove));
        });
        wrap.querySelectorAll('.copy-sizes').forEach((b) => {
            b.addEventListener('click', () => {
                const from = S.cart.lines.find((l) => l.catalogColor === b.dataset.from);
                const to = S.cart.lines.find((l) => l.catalogColor === b.dataset.to);
                if (!from || !to) return;
                SIZES.forEach((s) => {
                    to.qty[s] = Math.min(from.qty[s] || 0, stockFor(to.catalogColor, s));
                });
                renderColorCards(); renderAll(); persistSoon();
            });
        });
    }

    function lineQty(catalogColor, size) {
        const l = S.cart.lines.find((x) => x.catalogColor === catalogColor);
        return l ? (l.qty[size] || 0) : 0;
    }

    function setQty(catalogColor, size, q) {
        const l = S.cart.lines.find((x) => x.catalogColor === catalogColor);
        if (!l) return;
        const stock = stockFor(catalogColor, size);
        let v = Math.max(0, q | 0);
        if (v > stock) {
            v = stock;
            toast(`Only ${stock} left in ${size}`, 'error');
        }
        l.qty[size] = v;
        renderColorCards();
        renderAll();
        persistSoon();
    }

    function renderTierMeter(q) {
        const card = $('tier-card');
        if (!q || !q.combinedQty) { card.hidden = true; return; }
        card.hidden = false;

        const tiers = (S.pricing.tiersR || []).slice().sort((a, b) => a.MinQuantity - b.MinQuantity);
        const MAXQ = 96; // display window
        const pct = (n) => Math.min(100, (n / MAXQ) * 100);
        let html = '<div class="tier-track"></div>' +
            `<div class="tier-fill" style="width:${pct(q.combinedQty)}%"></div>`;
        tiers.forEach((t) => {
            if (t.MinQuantity <= 1 || t.MinQuantity > MAXQ) return;
            let label;
            try {
                label = money(TDTPricing.unitPrice(S.pricing, S.config, t.MinQuantity,
                    S.design.frontLocation, S.design.backEnabled, 'M').finalPrice);
            } catch (_) { label = ''; }
            html += `<div class="tier-notch" style="left:${pct(t.MinQuantity)}%"></div>` +
                `<div class="tier-notch-label" style="left:${pct(t.MinQuantity)}%">${t.MinQuantity}+ ${label}</div>`;
        });
        html += `<div class="tier-marker" style="left:${pct(q.combinedQty)}%"></div>`;
        $('tier-meter').innerHTML = html;

        // One computed nudge sentence
        const n = q.nudge;
        const el = $('nudge-line');
        el.classList.remove('is-celebrate');
        if (!n) { el.textContent = ''; return; }
        if (n.type === 'ltm-drop-saves') {
            el.textContent = `${n.hereQty} shirts = ${money(n.hereTotal)} · ${n.thereQty} shirts = ${money(n.thereTotal)} — adding ${n.addQty === 1 ? 'one shirt' : n.addQty + ' shirts'} saves you ${money(n.savings)}`;
        } else if (n.type === 'ltm-drop') {
            el.textContent = `Add ${n.addQty} more shirt${n.addQty === 1 ? '' : 's'} to drop the ${money(n.ltmFee)} small-batch fee`;
        } else if (n.type === 'tier-up') {
            el.textContent = `Add ${n.addQty} more → ${money(n.nextUnit)}/shirt (save ${money(n.perShirtSave)} each)`;
        } else {
            el.textContent = `${money(q.unitBySize.M ? q.unitBySize.M.finalPrice : 0)}/shirt — best price`;
        }

        // One-time celebration on crossing out of LTM
        if (q.combinedQty >= S.config.ltmThreshold && !S.ui.celebratedTier) {
            S.ui.celebratedTier = true;
            el.classList.add('is-celebrate');
            toast(`Volume pricing unlocked — you saved ${money(S.config.ltmFee)}`, 'success');
        }
        if (q.combinedQty < S.config.ltmThreshold) S.ui.celebratedTier = false;
    }

    // ── Tax ─────────────────────────────────────────────────────────
    const lookupTax = debounce(async function () {
        const t = S.delivery.tax;
        t.error = false;
        if (S.delivery.method === 'pickup') {
            await taxLookupCall({ address: '', city: 'Milton', state: 'WA', zip: '98354' }, 'pickup');
            return;
        }
        const a = S.delivery.address;
        if (!a.zip || a.zip.length < 5 || !a.state) {
            t.rate = null; t.account = null; t.source = null;
            renderAll();
            return;
        }
        await taxLookupCall({ address: a.address1, city: a.city, state: a.state, zip: a.zip }, 'ship');
    }, 350);

    async function taxLookupCall(addr, source) {
        const t = S.delivery.tax;
        try {
            const j = await fetchJson(`${API_BASE}/api/tax-rates/lookup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(addr),
            });
            if (!j || j.success === false || !Number.isFinite(parseFloat(j.rate))) {
                throw new Error('Lookup returned no rate');
            }
            t.rate = parseFloat(j.rate);
            t.account = j.account || null;
            t.accountName = j.accountName || null;
            t.source = source;
            t.error = false;
        } catch (e) {
            console.error('[3DT] Tax lookup failed:', e);
            t.rate = null; t.account = null; t.source = null;
            t.error = true;   // blocks checkout visibly — never a guessed rate
        }
        renderAll();
    }

    function renderTaxStamp() {
        const t = S.delivery.tax;
        $('tax-error').hidden = !t.error;
        const stamp = $('tax-stamp');
        if (S.delivery.method === 'pickup') { stamp.textContent = ''; return; }
        if (t.rate === null) { stamp.textContent = 'Sales tax is calculated from your ZIP.'; return; }
        stamp.textContent = t.rate > 0
            ? `Sales tax: ${ratePct(t.rate)}% — ${t.accountName || 'WA destination rate'}`
            : 'No sales tax — shipping out of state.';
    }

    // ── Review + totals ─────────────────────────────────────────────
    function renderReview(q) {
        const lines = $('review-lines');
        const totals = $('review-totals');
        if (!q || !q.lines.length) {
            lines.innerHTML = '<p class="review-empty">Add artwork and quantities above — your full order appears here before you pay.</p>';
            totals.innerHTML = '';
            $('review-promise').textContent = '';
            $('review-mockups').innerHTML = '';
            return;
        }

        lines.innerHTML = '<table><thead><tr><th>Color</th><th>Size</th><th>Qty</th><th>Each</th><th>Total</th></tr></thead><tbody>' +
            q.lines.map((l) =>
                `<tr><td>${escapeHTML(l.colorName)}</td><td>${l.size}</td><td>${l.quantity}</td>` +
                `<td>${money(l.unitPrice)}</td><td>${money(l.extended)}</td></tr>`).join('') +
            '</tbody></table>';

        totals.innerHTML = buildTotalsHtml(q);
        const p = TDTShipDate.promise(new Date());
        $('review-promise').innerHTML = `<i class="fas fa-truck-fast"></i> Ships ${escapeHTML(p.shipDateLong)} from Milton, WA`;

        // Low-DPI acknowledgment restated
        const ackEl = $('review-ack');
        const acks = [];
        ['front', 'back'].forEach((k) => {
            const s = S.design[k];
            if (s && s.lowDpiAck && s.effectiveDpi) {
                acks.push(`⚠ You approved low-resolution ${k} art (${s.effectiveDpi} DPI at ${s.placement.wIn.toFixed(1)}″).`);
            }
            if (s && !s.previewable) {
                acks.push(`Your ${k} file (${escapeHTML(s.fileName)}) gets a human proof by email before we print.`);
            }
        });
        ackEl.innerHTML = acks.join('<br>');
        ackEl.hidden = !acks.length;

        renderReviewMockups();
    }

    function buildTotalsHtml(q) {
        let h = `<div class="tot-row"><span>Shirts (${q.combinedQty})</span><span>${money(q.shirtsSubtotal)}</span></div>` +
            `<div class="tot-row is-included"><span>3-day rush production</span><span>included ✓</span></div>`;
        if (q.ltmFee > 0) {
            h += `<div class="tot-row is-fee"><span>Small-batch fee <small>(under ${S.config.ltmThreshold} pieces)</small></span><span>${money(q.ltmFee)}</span></div>`;
        }
        const ship = effectiveShip();
        h += `<div class="tot-row"><span>${escapeHTML(ship.label)}</span><span>${S.delivery.method === 'pickup' ? 'FREE' : money(q.shipping)}</span></div>`;
        if (q.taxRate === null && S.delivery.method === 'ship') {
            h += `<div class="tot-row"><span>Sales tax</span><span>enter address</span></div>`;
        } else {
            h += `<div class="tot-row"><span>Sales tax${q.taxRate ? ` (${ratePct(q.taxRate)}%)` : ''}</span><span>${money(q.tax)}</span></div>`;
        }
        h += `<div class="tot-row is-grand"><span>Total</span><span>${money(q.total)}</span></div>`;
        return h;
    }

    let mockupKey = '';
    let mockupUrls = [];   // revoked on every replacement — blob URLs leak otherwise
    const renderReviewMockups = debounce(async function () {
        const wrap = $('review-mockups');
        if (!S.design.front || !S.cart.lines.length) {
            wrap.innerHTML = '';
            mockupKey = '';
            mockupUrls.forEach((u) => URL.revokeObjectURL(u));
            mockupUrls = [];
            return;
        }
        const slotSig = (s) => s && [s.fileName, s.naturalW, s.naturalH, s.placement];
        const key = JSON.stringify([S.cart.lines.map((l) => l.catalogColor),
            S.design.frontLocation, S.design.backEnabled,
            slotSig(S.design.front), slotSig(S.design.back)]);
        if (key === mockupKey) return;
        mockupKey = key;

        const colors = S.cart.lines.slice(0, 4).map((l) => colorOf(l.catalogColor));
        const views = S.design.backEnabled && S.design.back ? ['front', 'back'] : ['front'];
        const out = [];
        for (const c of colors) {
            for (const v of views) {
                const blob = await designer.exportMockup(c, v, S.design, 360);
                if (blob) {
                    out.push({ url: URL.createObjectURL(blob), label: `${c.colorName} · ${v}` });
                }
            }
        }
        if (key !== mockupKey) { out.forEach((o) => URL.revokeObjectURL(o.url)); return; }
        mockupUrls.forEach((u) => URL.revokeObjectURL(u));
        mockupUrls = out.map((o) => o.url);
        wrap.innerHTML = out.map((o) =>
            `<figure class="review-mockup"><img src="${o.url}" alt="Mockup ${escapeHTML(o.label)}"><small>${escapeHTML(o.label)}</small></figure>`).join('');
    }, 700);

    // ── Gates + smart CTA ───────────────────────────────────────────
    function gateReasons(q) {
        const reasons = [];
        if (!S.design.front) reasons.push({ label: 'Add artwork', target: '#stage-design', act: () => $('art-input').click() });
        if (S.design.backEnabled && !S.design.back) reasons.push({ label: 'Add back artwork (or turn off back print)', target: '#stage-design' });
        ['front', 'back'].forEach((k) => {
            const s = S.design[k];
            if (!s || !s.previewable || s.isVector || !s.effectiveDpi) return;
            if (s.effectiveDpi < DPI_HARD_STOP) reasons.push({ label: `Fix very low-res ${k} art`, target: '#stage-design' });
            else if (s.effectiveDpi < DPI_AMBER && !s.lowDpiAck) reasons.push({ label: `Fix or approve low-res ${k} art`, target: '#stage-design' });
        });
        if (!q || !q.combinedQty) reasons.push({ label: 'Add quantities', target: '#stage-colors' });
        if (S.inventory.error) reasons.push({ label: 'Stock unavailable — retry', target: '#stage-colors' });

        const c = S.customer;
        if (!c.firstName || !c.lastName || !validEmail(c.email) || !c.phone) {
            reasons.push({ label: 'Enter contact info', target: '#stage-checkout' });
        }
        if (S.delivery.method === 'ship') {
            const a = S.delivery.address;
            if (!a.address1 || !a.city || !a.state || !/^\d{5}(-\d{4})?$/.test(a.zip)) {
                reasons.push({ label: 'Enter shipping address', target: '#stage-checkout' });
            } else if (S.delivery.tax.error) {
                reasons.push({ label: 'Tax lookup failed — retry', target: '#stage-checkout' });
            } else if (S.delivery.tax.rate === null) {
                reasons.push({ label: 'Confirming sales tax…', target: '#stage-checkout' });
            } else if (S.delivery.shipEstimate.status === 'loading') {
                reasons.push({ label: 'Calculating shipping…', target: '#stage-checkout' });
            }
        } else if (S.delivery.tax.rate === null) {
            reasons.push({ label: S.delivery.tax.error ? 'Tax lookup failed — retry' : 'Confirming sales tax…', target: '#stage-checkout' });
        }
        return reasons;
    }

    function validEmail(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e || ''); }

    function renderAll() {
        if (!S.boot.ready && !S.pricing) return;
        maybeRequestShipEstimate();
        const q = currentQuote();
        if (!q) return;
        renderBarWith(q);
        renderTierMeter(q);
        renderReview(q);
        renderTaxStamp();
        renderLocationPrices();
        const est = S.delivery.shipEstimate;
        $('ship-fee-label').textContent =
            est.status === 'done' && est.source === 'ups-estimate' ? `UPS Ground — ${money(est.amount)} estimated`
            : est.status === 'loading' ? 'UPS Ground — estimating…'
            : `UPS Ground — ${money(S.config.shipFee)} flat`;

        const reasons = gateReasons(q);
        const wrap = $('pay-reasons');
        wrap.innerHTML = '';
        reasons.forEach((r) => {
            const chip = document.createElement('button');
            chip.type = 'button';
            chip.className = 'reason-chip';
            chip.textContent = r.label;
            chip.addEventListener('click', () => {
                document.querySelector(r.target).scrollIntoView({ behavior: 'smooth' });
                if (r.act) setTimeout(r.act, 350);
            });
            wrap.appendChild(chip);
        });

        const pay = $('pay-btn');
        const p = TDTShipDate.promise(new Date());
        pay.disabled = reasons.length > 0 || S.checkout.running;
        $('pay-btn-label').textContent = reasons.length
            ? 'Pay' : `Pay ${money(q.total)} — ships ${p.shipDateShort}`;
    }

    let lastQuote = null;
    function renderBarWith(q) {
        lastQuote = q;
        $('bar-total').textContent = money(q.total);
        const p = TDTShipDate.promise(new Date());
        $('bar-meta').textContent = q.combinedQty
            ? `${q.combinedQty} shirt${q.combinedQty === 1 ? '' : 's'} · ships ${p.shipDateShort}`
            : (() => {
                try {
                    const from = TDTPricing.unitPrice(S.pricing, S.config, S.config.ltmThreshold, 'LC', false, 'M').finalPrice;
                    return `From ${money(from)}/shirt at ${S.config.ltmThreshold}+ pieces`;
                } catch (_) { return 'Design yours now'; }
            })();

        // Smart CTA — always names the first incomplete thing
        const cta = $('smart-cta');
        if (!S.design.front) {
            cta.textContent = 'Upload your art';
            cta.onclick = () => { document.querySelector('#stage-design').scrollIntoView({ behavior: 'smooth' }); setTimeout(() => $('art-input').click(), 350); };
        } else if (!q.combinedQty) {
            cta.textContent = 'Next: pick quantities';
            cta.onclick = () => document.querySelector('#stage-colors').scrollIntoView({ behavior: 'smooth' });
        } else {
            const reasons = gateReasons(q);
            if (reasons.length) {
                cta.textContent = 'Next: ' + reasons[0].label.toLowerCase();
                cta.onclick = () => document.querySelector(reasons[0].target).scrollIntoView({ behavior: 'smooth' });
            } else {
                cta.textContent = `Pay ${money(q.total)} →`;
                cta.onclick = runCheckout;
            }
        }
    }
    function renderBar() { if (lastQuote) renderBarWith(lastQuote); }

    // ── Summary sheet ───────────────────────────────────────────────
    function openSheet() {
        const q = lastQuote || currentQuote();
        if (!q) return;
        $('sheet-lines').innerHTML = q.lines.length
            ? '<div class="review-lines"><table><tbody>' + q.lines.map((l) =>
                `<tr><td>${escapeHTML(l.colorName)} · ${l.size}</td><td>×${l.quantity}</td><td style="text-align:right">${money(l.extended)}</td></tr>`).join('') +
              '</tbody></table></div>'
            : '<p class="review-empty">Nothing yet — add artwork and quantities.</p>';
        $('sheet-totals').innerHTML = q.lines.length ? '<div class="review-totals">' + buildTotalsHtml(q) + '</div>' : '';
        const p = TDTShipDate.promise(new Date());
        $('sheet-promise').textContent = q.lines.length ? `Ships ${p.shipDateLong}` : '';
        $('summary-sheet').hidden = false;
        $('sheet-backdrop').hidden = false;
    }
    function closeSheet() {
        $('summary-sheet').hidden = true;
        $('sheet-backdrop').hidden = true;
    }

    // ── Checkout pipeline ───────────────────────────────────────────
    function plStep(n, stateCls) {
        for (let i = 1; i <= 4; i++) {
            const li = $(`pl-step-${i}`);
            li.className = i < n ? 'is-done' : (i === n ? (stateCls || 'is-active') : '');
            li.querySelector('i').className =
                i < n ? 'fas fa-circle-check'
                : i === n && stateCls === 'is-error' ? 'fas fa-circle-xmark'
                : i === n ? 'fas fa-circle-notch fa-spin'
                : 'far fa-circle';
        }
    }

    async function runCheckout() {
        if (S.checkout.running) return;
        const q0 = currentQuote();
        if (!q0) return;
        const reasons = gateReasons(q0);
        if (reasons.length) {
            document.querySelector(reasons[0].target).scrollIntoView({ behavior: 'smooth' });
            return;
        }

        S.checkout.running = true;
        let cancelled = false;
        $('pipeline-cancel').onclick = () => { cancelled = true; closePipeline(); };
        $('pipeline-error').hidden = true;
        $('pipeline-backdrop').hidden = false;

        function closePipeline() {
            $('pipeline-backdrop').hidden = true;
            S.checkout.running = false;
            renderAll();
        }
        function fail(msg) {
            $('pipeline-error').innerHTML = escapeHTML(msg) +
                ' — nothing was charged. Need a hand? <a href="tel:253-922-5793">253-922-5793</a>';
            $('pipeline-error').hidden = false;
        }

        try {
            // ① Stock recheck (fresh, cache-busted)
            plStep(1);
            const inv = await fetchJson(`${API_BASE}/api/manageorders/pc54-inventory?t=${Date.now()}`);
            applyInventory(inv);
            if (S.inventory.error) throw new Error('Live stock is unavailable right now');
            const conflicts = [];
            S.cart.lines.forEach((l) => {
                SIZES.forEach((s) => {
                    const want = l.qty[s] || 0;
                    const have = stockFor(l.catalogColor, s);
                    if (want > have) conflicts.push({ catalogColor: l.catalogColor, size: s, want, have });
                });
            });
            if (conflicts.length) {
                closePipeline();
                showConflicts(conflicts);
                return;
            }
            if (cancelled) return;

            // ② Upload originals + mockups
            plStep(2);
            const up = window.ArtworkUpload && window.ArtworkUpload.uploadOne
                ? window.ArtworkUpload.uploadOne : uploadFallback;
            for (const k of ['front', 'back']) {
                const slot = S.design[k];
                if (!slot) continue;
                if (!slot.uploaded) {
                    if (!slot.file) throw new Error(`Please re-attach your ${k} artwork file (it didn’t survive the page reload)`);
                    slot.uploaded = await up(slot.file);
                }
            }
            if (cancelled) return;
            const mockups = [];
            for (const line of S.cart.lines) {
                const c = colorOf(line.catalogColor);
                const views = S.design.backEnabled && S.design.back ? ['front', 'back'] : ['front'];
                for (const v of views) {
                    const blob = await designer.exportMockup(c, v, S.design, 1200);
                    if (!blob) continue;   // tainted/failed export NEVER blocks checkout
                    const f = new File([blob], `3DT-mockup-${c.catalogColor.replace(/\W+/g, '')}-${v}.jpg`, { type: 'image/jpeg' });
                    try {
                        const r = await up(f);
                        mockups.push({ color: c.colorName, catalogColor: c.catalogColor, view: v, url: r.hostedUrl });
                    } catch (e) {
                        console.warn('[3DT] Mockup upload failed (continuing):', e);
                    }
                }
                if (cancelled) return;
            }

            // ③+④ Save + Stripe session (server reprices authoritatively)
            plStep(3);
            const payload = buildCheckoutPayload(mockups);
            plStep(4);
            const resp = await fetch('/api/create-checkout-session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const j = await resp.json().catch(() => ({}));
            if (!resp.ok || !j.url) {
                throw new Error(j.error || j.message || 'Checkout could not be created');
            }
            persistNow();
            window.location.href = j.url;
        } catch (e) {
            console.error('[3DT] Checkout pipeline failed:', e);
            plStep(4, 'is-error');
            fail(e.message);
            S.checkout.running = false;
        }
    }

    // Minimal uploader if the shared widget isn't loaded (we don't mount its UI)
    function uploadFallback(file) {
        const fd = new FormData();
        fd.append('file', file);
        return fetchJson(`${API_BASE}/api/files/upload`, { method: 'POST', body: fd })
            .then((r) => {
                if (!r.externalKey) throw new Error('Upload response missing externalKey');
                return {
                    externalKey: r.externalKey,
                    hostedUrl: `${API_BASE}/api/files/${r.externalKey}`,
                    fileName: r.fileName || file.name,
                };
            });
    }

    function showConflicts(conflicts) {
        $('conflict-list').innerHTML = conflicts.map((c) =>
            `<div class="conflict-row">${escapeHTML(colorOf(c.catalogColor).colorName)} ${c.size}: you want ${c.want}, ` +
            `<strong>only ${c.have} left</strong> → we’ll set it to ${c.have}.</div>`).join('');
        $('conflict-backdrop').hidden = false;
        $('conflict-apply').onclick = () => {
            conflicts.forEach((c) => {
                const l = S.cart.lines.find((x) => x.catalogColor === c.catalogColor);
                if (l) l.qty[c.size] = c.have;
            });
            $('conflict-backdrop').hidden = true;
            renderStage2(); renderAll(); persistSoon();
            runCheckout();
        };
        $('conflict-close').onclick = () => { $('conflict-backdrop').hidden = true; renderStage2(); renderAll(); };
    }

    function buildCheckoutPayload(mockups) {
        const q = currentQuote();
        const locCode = S.design.frontLocation + (S.design.backEnabled && S.design.back ? '_FB' : '');
        const locNames = { LC: 'Left Chest', FF: 'Full Front', LC_FB: 'Left Chest + Full Back', FF_FB: 'Full Front + Full Back' };
        const p = TDTShipDate.promise(new Date());

        // colorConfigs — EXACT legacy shape (server push + webhook contract)
        const colorConfigs = {};
        S.cart.lines.forEach((l) => {
            const sizeBreakdown = {};
            SIZES.forEach((s) => {
                if (l.qty[s] > 0) {
                    sizeBreakdown[s] = { quantity: l.qty[s], unitPrice: q.unitBySize[s].finalPrice };
                }
            });
            if (!Object.keys(sizeBreakdown).length) return;
            colorConfigs[l.catalogColor] = {
                catalogColor: l.catalogColor,
                displayColor: colorOf(l.catalogColor).colorName,
                totalQuantity: Object.values(l.qty).reduce((a, b) => a + (b || 0), 0),
                sizeBreakdown,
            };
        });

        const placementOf = (k) => {
            const s = S.design[k];
            if (!s) return null;
            return {
                location: k === 'back' ? 'FB' : S.design.frontLocation,
                wIn: s.placement.wIn, xIn: s.placement.xIn, yIn: s.placement.yIn,
                hIn: Math.round(s.placement.wIn * (s.naturalH / s.naturalW) * 100) / 100,
                anchor: 'top-center',
                effectiveDpi: s.effectiveDpi,
                lowDpiAck: s.lowDpiAck,
                previewable: s.previewable,
                fileName: s.uploaded ? s.uploaded.fileName : s.fileName,
                warnings: s.warnings,
            };
        };

        return {
            customer_email: S.customer.email,
            customerData: {
                firstName: S.customer.firstName,
                lastName: S.customer.lastName,
                email: S.customer.email,
                phone: S.customer.phone,
                company: S.customer.company,
                address1: S.delivery.address.address1,
                city: S.delivery.address.city,
                state: S.delivery.method === 'pickup' ? 'WA' : S.delivery.address.state.toUpperCase(),
                zip: S.delivery.method === 'pickup' ? '98354' : S.delivery.address.zip,
                deliveryMethod: S.delivery.method,
                notes: S.delivery.notes,
            },
            colorConfigs,
            orderTotals: {
                totalQuantity: q.combinedQty,
                subtotal: q.shirtsSubtotal,
                rushFee: 0,                       // rush is baked into unit prices
                ltmFee: q.ltmFee,
                shipping: q.shipping,
                shippingSource: S.delivery.method === 'pickup' ? 'pickup'
                    : (S.delivery.shipEstimate.source || 'flat'),
                salesTax: q.tax,
                taxRate: q.taxRate,
                taxableBase: q.taxableBase,
                taxAccount: S.delivery.tax.account,
                taxAccountName: S.delivery.tax.accountName,
                grandTotal: q.total,
            },
            orderSettings: {
                printLocationCode: locCode,
                printLocationName: locNames[locCode] || 'Left Chest',
                frontLogo: S.design.front && S.design.front.uploaded
                    ? { fileUrl: S.design.front.uploaded.hostedUrl, fileName: S.design.front.uploaded.fileName } : null,
                backLogo: S.design.back && S.design.back.uploaded
                    ? { fileUrl: S.design.back.uploaded.hostedUrl, fileName: S.design.back.uploaded.fileName } : null,
                mockups,
                placement: { front: placementOf('front'), back: placementOf('back') },
                shipPromise: { iso: p.shipDateIso, label: p.shipDateLong },
                needsArtReview: ['front', 'back'].some((k) => S.design[k] && (!S.design[k].previewable || S.design[k].warnings.includes('svg-needs-review'))),
            },
            successUrl: `${location.origin}/pages/3-day-tees-success.html?session_id={CHECKOUT_SESSION_ID}`,
            cancelUrl: `${location.origin}/pages/3-day-tees.html?canceled=1`,
        };
    }

    // ── Persistence ─────────────────────────────────────────────────
    function snapshot() {
        const slotLite = (s) => s ? {
            fileName: s.fileName, previewable: s.previewable, isVector: s.isVector,
            naturalW: s.naturalW, naturalH: s.naturalH, placement: s.placement,
            effectiveDpi: s.effectiveDpi, lowDpiAck: s.lowDpiAck,
            warnings: s.warnings, uploaded: s.uploaded,
        } : null;
        return {
            v: 1, ts: Date.now(),
            design: {
                frontLocation: S.design.frontLocation,
                backEnabled: S.design.backEnabled,
                previewColor: S.design.previewColor,
                front: slotLite(S.design.front),
                back: slotLite(S.design.back),
            },
            cart: S.cart,
            customer: S.customer,
            delivery: { method: S.delivery.method, address: S.delivery.address, notes: S.delivery.notes },
        };
    }
    function persistNow() {
        try { sessionStorage.setItem(PERSIST_KEY, JSON.stringify(snapshot())); } catch (_) { /* quota */ }
    }
    const persistSoon = debounce(persistNow, 400);

    function restoreSession() {
        let snap;
        try { snap = JSON.parse(sessionStorage.getItem(PERSIST_KEY) || 'null'); } catch (_) { return; }
        if (!snap || snap.v !== 1) return;
        if (Date.now() - snap.ts > 24 * 3600 * 1000) return;

        S.cart = snap.cart && Array.isArray(snap.cart.lines) ? snap.cart : S.cart;
        // Drop cart colors that are no longer stocked
        S.cart.lines = S.cart.lines.filter((l) => S.inventory.byColor[l.catalogColor]);
        Object.assign(S.customer, snap.customer || {});
        if (snap.delivery) {
            S.delivery.method = snap.delivery.method === 'pickup' ? 'pickup' : 'ship';
            Object.assign(S.delivery.address, snap.delivery.address || {});
            S.delivery.notes = snap.delivery.notes || '';
        }
        if (snap.design) {
            S.design.frontLocation = snap.design.frontLocation === 'FF' ? 'FF' : 'LC';
            // Sync the segmented control (HTML defaults to LC active)
            $('loc-LC').classList.toggle('is-active', S.design.frontLocation === 'LC');
            $('loc-FF').classList.toggle('is-active', S.design.frontLocation === 'FF');
            S.design.backEnabled = !!snap.design.backEnabled;
            ['front', 'back'].forEach((k) => {
                const s = snap.design[k];
                if (!s) return;
                S.design[k] = Object.assign({ file: null, bitmap: null, mime: '' }, s);
                // Try to restore the preview from the already-hosted upload.
                if (s.uploaded && s.uploaded.hostedUrl && s.previewable) {
                    const img = new Image();
                    img.crossOrigin = 'anonymous';
                    img.onload = () => {
                        if (S.design[k]) {
                            S.design[k].bitmap = img;
                            designer.setSlot(k, S.design[k]);
                            renderDesignControls();
                        }
                    };
                    img.src = s.uploaded.hostedUrl;
                } else if (s.previewable) {
                    // No file and no hosted copy → must re-attach to preview.
                    S.design[k].previewable = false;
                    S.design[k].warnings = (s.warnings || []).slice();
                }
                designer.setSlot(k, S.design[k]);
            });
            if (snap.design.previewColor && S.inventory.byColor[snap.design.previewColor]) {
                S.design.previewColor = snap.design.previewColor;
                designer.setColor(colorOf(snap.design.previewColor));
            }
            designer.setLocation(S.design.frontLocation);
        }

        // Re-fill form fields
        $('f-first').value = S.customer.firstName;
        $('f-last').value = S.customer.lastName;
        $('f-email').value = S.customer.email;
        $('f-phone').value = S.customer.phone;
        $('f-company').value = S.customer.company;
        $('f-addr1').value = S.delivery.address.address1;
        $('f-city').value = S.delivery.address.city;
        $('f-state').value = S.delivery.address.state;
        $('f-zip').value = S.delivery.address.zip;
        $('f-notes').value = S.delivery.notes;
        $('back-toggle').checked = S.design.backEnabled;
        ($(S.delivery.method === 'pickup' ? 'd-pickup' : 'd-ship')).checked = true;
        syncDeliveryUI();
        if (S.delivery.method === 'pickup' || S.delivery.address.zip) lookupTax();

        const hasAnything = S.cart.lines.length || S.design.front;
        if (hasAnything) toast('Your order is saved — ready when you are.', 'success');
    }

    // ── Wiring ──────────────────────────────────────────────────────
    function syncDeliveryUI() {
        const pickup = S.delivery.method === 'pickup';
        $('pickup-card').hidden = !pickup;
        $('address-fields').hidden = pickup;
    }

    function wireEverything() {
        // Hero CTA
        $('hero-cta').addEventListener('click', () => {
            document.querySelector('#stage-design').scrollIntoView({ behavior: 'smooth' });
            setTimeout(() => $('art-input').click(), 400);
        });
        $('tdt-fatal-retry').addEventListener('click', () => location.reload());

        // Tabs
        $('tab-front').addEventListener('click', () => setView('front'));
        $('tab-back').addEventListener('click', () => setView('back'));

        function setView(v) {
            designer.setView(v);
            $('tab-front').classList.toggle('is-active', v === 'front');
            $('tab-back').classList.toggle('is-active', v === 'back');
            $('tab-front').setAttribute('aria-selected', String(v === 'front'));
            $('tab-back').setAttribute('aria-selected', String(v === 'back'));
            renderDesignControls();
        }

        // Location segmented control
        $('loc-LC').addEventListener('click', () => setLocation('LC'));
        $('loc-FF').addEventListener('click', () => setLocation('FF'));
        function setLocation(loc) {
            const prev = S.design.frontLocation;
            S.design.frontLocation = loc;
            $('loc-LC').classList.toggle('is-active', loc === 'LC');
            $('loc-FF').classList.toggle('is-active', loc === 'FF');
            designer.setLocation(loc);
            const slot = S.design.front;
            if (slot && prev !== loc) {
                // Re-fit to the new area's default (4″→12″ areas read wrong at
                // the old size); customer can resize after.
                slot.placement = designer.defaultPlacement('front', slot.naturalW, slot.naturalH);
                designer.setSlot('front', slot);
                if (prev === 'FF' && loc === 'LC') toast('Resized to fit Left Chest (4″ max)');
                refreshDpi(slot);
            }
            renderDesignControls(); renderAll(); persistSoon();
        }

        // Back toggle
        $('back-toggle').addEventListener('change', (e) => {
            if (!e.target.checked && S.design.back) {
                const prevSlot = S.design.back;
                S.design.backEnabled = false;
                S.design.back = null;
                designer.setSlot('back', null);
                if (designer.getView() === 'back') setView('front');
                toast(`Back print off — removed ${prevSlot.fileName}`, null, {
                    label: 'Undo',
                    fn() {
                        S.design.backEnabled = true;
                        S.design.back = prevSlot;
                        designer.setSlot('back', prevSlot);
                        $('back-toggle').checked = true;
                        renderDesignControls(); renderAll(); persistSoon();
                    },
                });
            } else {
                S.design.backEnabled = e.target.checked;
                if (e.target.checked) setView('back');
            }
            renderDesignControls(); renderAll(); persistSoon();
        });

        // Upload affordances
        const drop = $('art-drop');
        drop.addEventListener('click', () => $('art-input').click());
        drop.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('art-input').click(); }
        });
        ['dragover', 'dragleave', 'drop'].forEach((evt) => {
            drop.addEventListener(evt, (e) => {
                e.preventDefault();
                drop.classList.toggle('is-over', evt === 'dragover');
                if (evt === 'drop' && e.dataTransfer.files.length) handleArtworkFile(e.dataTransfer.files[0]);
            });
        });
        const wrap = $('canvas-wrap');
        ['dragover', 'drop'].forEach((evt) => {
            wrap.addEventListener(evt, (e) => {
                e.preventDefault();
                if (evt === 'drop' && e.dataTransfer.files.length) handleArtworkFile(e.dataTransfer.files[0]);
            });
        });
        $('art-input').addEventListener('change', (e) => {
            if (e.target.files.length) handleArtworkFile(e.target.files[0]);
            e.target.value = '';
        });
        $('art-remove').addEventListener('click', () => removeArtwork(activeSlotKey()));

        // Size slider + actions
        $('art-size').addEventListener('input', (e) => {
            designer.setWidthIn(activeSlotKey(), parseFloat(e.target.value));
        });
        $('art-center').addEventListener('click', () => designer.center(activeSlotKey()));
        $('art-fit').addEventListener('click', () => designer.fitWidth(activeSlotKey()));
        $('art-reset').addEventListener('click', () => {
            const k = activeSlotKey();
            const s = S.design[k];
            if (!s) return;
            s.placement = designer.defaultPlacement(k, s.naturalW, s.naturalH);
            designer.setSlot(k, s);
            refreshDpi(s);
            renderDesignControls(); persistSoon();
        });
        $('dpi-ack').addEventListener('change', (e) => {
            const s = S.design[activeSlotKey()];
            if (s) { s.lowDpiAck = e.target.checked; renderAll(); persistSoon(); }
        });

        // Inventory retry
        $('inventory-retry').addEventListener('click', () => refreshInventory(true));

        // Contact + address
        const bind = (id, obj, key, after) => {
            $(id).addEventListener('input', (e) => {
                obj[key] = e.target.value.trim();
                persistSoon();
                if (after) after();
                renderAll();
            });
        };
        bind('f-first', S.customer, 'firstName');
        bind('f-last', S.customer, 'lastName');
        bind('f-email', S.customer, 'email');
        bind('f-phone', S.customer, 'phone');
        bind('f-company', S.customer, 'company');
        bind('f-addr1', S.delivery.address, 'address1');
        bind('f-city', S.delivery.address, 'city');
        // Editing the destination IMMEDIATELY invalidates the old tax rate —
        // otherwise Pay stays enabled with the previous address's rate during
        // the debounce window (stale-tax gate gap, review fix 2026-06-09).
        const invalidateTaxThenLookup = () => {
            S.delivery.tax.rate = null;
            S.delivery.tax.error = false;
            lookupTax();
        };
        bind('f-state', S.delivery.address, 'state', invalidateTaxThenLookup);
        bind('f-zip', S.delivery.address, 'zip', invalidateTaxThenLookup);
        $('f-notes').addEventListener('input', (e) => { S.delivery.notes = e.target.value; persistSoon(); });
        $('tax-retry').addEventListener('click', () => lookupTax());

        // Delivery method
        ['d-ship', 'd-pickup'].forEach((id) => {
            $(id).addEventListener('change', () => {
                S.delivery.method = $('d-pickup').checked ? 'pickup' : 'ship';
                S.delivery.tax.rate = null;
                S.delivery.tax.error = false;
                S.delivery.shipEstimate = { status: 'idle', amount: null, source: null, key: '' };
                syncDeliveryUI();
                lookupTax();
                renderAll();
                persistSoon();
            });
        });

        // Order bar + sheet
        $('order-bar-summary').addEventListener('click', openSheet);
        $('sheet-close').addEventListener('click', closeSheet);
        $('sheet-backdrop').addEventListener('click', closeSheet);

        // Pay
        $('pay-btn').addEventListener('click', runCheckout);

        // Hide the order bar while the mobile keyboard is open
        if (window.visualViewport) {
            const baseH = window.visualViewport.height;
            window.visualViewport.addEventListener('resize', () => {
                $('order-bar').classList.toggle('is-hidden',
                    window.visualViewport.height < baseH - 150);
            });
        }
    }

    // ── Go ──────────────────────────────────────────────────────────
    document.addEventListener('DOMContentLoaded', boot);
})();
