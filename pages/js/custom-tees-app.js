/**
 * custom-tees-app.js — application core for the Custom T-Shirts page
 * (20-garment catalog edition of the 3-Day Tees design studio).
 *
 * Owns: the step-1 product gallery (/api/dtg/top-sellers — the same curated
 * 20-style catalog the internal DTG builder uses), state + sessionStorage
 * persistence, per-style API loads (pricing bundle, product images,
 * Service_Codes config, inventory, tax lookup), every UI renderer (sticky
 * bar, smart CTA, color cards, tier meter, review panel), the designer
 * wiring, and the 4-step checkout pipeline (stock recheck → uploads →
 * quote save + Stripe session → redirect).
 *
 * Money rules (Erik):
 *   - Every price comes from an API at runtime: /api/pricing-bundle +
 *     Service_Codes 3DT-RUSH / 3DT-LTM / 3DT-SHIP + /api/tax-rates/lookup.
 *     Config failure = full-page fatal state. NEVER a guessed price.
 *   - All math lives in TDTPricing.quote() — this file only renders it.
 *     Rush is OFF by default; S.rush flows into every quote() call.
 *   - COLOR_NAME is display-only; CATALOG_COLOR keys everything.
 *
 * Modules loaded before this file: TDTPricing, TDTShipDate, TDTCalibration,
 * TDTDesigner (see custom-tees.html script order).
 */
(function () {
    'use strict';

    // ── Config ──────────────────────────────────────────────────────
    const API_BASE = (window.APP_CONFIG && window.APP_CONFIG.API && window.APP_CONFIG.API.BASE_URL)
        || 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
    // Styles eligible for the 3-Day Rush upgrade. Eligibility is config;
    // the rush % itself still comes from Caspio 3DT-RUSH via /api/service-codes.
    window.CTS_RUSH_ELIGIBLE = ['PC54'];
    // Per-style size run — replaced from the pricing bundle on every
    // product selection (intersected with stocked sizes). S.config.sizes
    // always points at this array.
    let SIZES = ['S', 'M', 'L', 'XL', '2XL', '3XL'];
    const PERSIST_KEY = 'cts_studio_v1';

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
        styleNumber: null,             // selected garment (set by the gallery)
        rush: false,                   // 3-Day Rush upgrade — OFF by default
        gallery: { items: [], category: '', search: '' },
        config: { rushPct: null, ltmFee: null, ltmThreshold: null, shipFee: null, sizes: SIZES },
        pricing: null,
        product: {
            colors: [],                // [{catalogColor, colorName, swatchImage, images:{...}}]
            curated: [],               // print-tested colors from /api/dtg/top-sellers?style=X
            title: '',
            brand: '',
            rushEligible: false,
        },
        inventory: { byColor: {}, fetchedAt: 0, error: false, source: null },
        design: {
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
    const fmtInt = (n) => (Number(n) || 0).toLocaleString('en-US');
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

    // Pricing config + the rush flag. TDTPricing owns ALL math — we only
    // pass `rush` through (its quote() defaults rush OFF).
    function pricingConfig() {
        return Object.assign({}, S.config, { rush: S.rush });
    }

    // ── Free placement (Erik 2026-06-10): price follows the ART'S SIZE ──
    // There is no location picker. Customers drag/resize anywhere inside the
    // full 16×20 envelope; the PRICE TIER derives from the art's printed
    // dimensions via TDTPricing.locationForArtSize() — the same pure rule the
    // server reprice uses on orderSettings.placement dims.
    function artDims(slot) {
        const h = slot.placement.wIn * (slot.naturalH / slot.naturalW);
        return { wIn: slot.placement.wIn, hIn: h };
    }

    // 'LC' = the "from" rate before any art; null = back-only design
    // (no front print cost — TDTPricing.unitPrice accepts location:null).
    function derivedFrontLocation() {
        const s = S.design.front;
        if (s) {
            const d = artDims(s);
            return TDTPricing.locationForArtSize('front', d.wIn, d.hIn);
        }
        return S.design.back ? null : 'LC';
    }

    function derivedBackLocation() {
        const s = S.design.back;
        if (!s) return null;
        const d = artDims(s);
        return TDTPricing.locationForArtSize('back', d.wIn, d.hIn);
    }

    const LOC_NAMES = { LC: 'Left Chest', FF: 'Full Front', JF: 'Jumbo Front', FB: 'Full Back', JB: 'Jumbo Back' };

    // ── Ship promise (standard 7–10 days vs 3-Day Rush) ─────────────
    // Standard copy comes from TDTShipDate.standardPromise() when the
    // shipdate module exposes it; plain copy otherwise (no countdown).
    function shipPromise() {
        if (S.rush) {
            const p = TDTShipDate.promise(new Date());
            return {
                rush: true,
                iso: p.shipDateIso,
                label: p.shipDateLong,
                long: 'Ships ' + p.shipDateLong,
                short: 'ships ' + p.shipDateShort,
            };
        }
        const SD = window.TDT_SHIPDATE || window.TDTShipDate;
        if (SD && typeof SD.standardPromise === 'function') {
            try {
                const sp = SD.standardPromise(new Date());
                if (sp) {
                    // {rangeLabel:'Mon, Jun 22 – Thu, Jun 25', shipDateIso/
                    //  Long/Short = binding END of the window, mode:'standard'}
                    return {
                        rush: false,
                        iso: sp.shipDateIso || null,
                        label: sp.rangeLabel || sp.shipDateLong || '7–10 business days',
                        long: sp.rangeLabel ? 'Ships ' + sp.rangeLabel
                            : (sp.shipDateLong ? 'Ships by ' + sp.shipDateLong : 'Ships in 7–10 business days'),
                        short: sp.shipDateShort ? 'ships by ' + sp.shipDateShort : 'ships in 7–10 business days',
                    };
                }
            } catch (e) {
                console.warn('[CTS] standardPromise failed — using plain copy:', e);
            }
        }
        return {
            rush: false,
            iso: null,
            label: '7–10 business days',
            long: 'Ships in 7–10 business days',
            short: 'ships in 7–10 business days',
        };
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
        if (S.delivery.method !== 'ship' || !/^\d{5}(-\d{4})?$/.test(zip) || !qty || !S.styleNumber) return;
        const key = `${zip.slice(0, 5)}|${qty}|${S.styleNumber}`;
        if (est.key === key && (est.status === 'done' || est.status === 'loading')) return;
        est.key = key;
        est.status = 'loading';
        clearTimeout(shipEstimateTimer);
        shipEstimateTimer = setTimeout(async () => {
            try {
                const j = await fetchJson('/api/three-day-tees/shipping-estimate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ toZip: zip.slice(0, 5), qty, styleNumber: S.styleNumber }),
                });
                if (S.delivery.shipEstimate.key !== key) return; // stale
                est.status = 'done';
                est.amount = parseFloat(j.amount);
                est.source = j.source;
            } catch (e) {
                console.error('[CTS] Shipping estimate failed (using flat rate):', e);
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
                config: Object.assign({}, pricingConfig(), { shipFee: effectiveShip().fee }),
                rush: S.rush,
                cart: S.cart.lines.map((l) => ({
                    catalogColor: l.catalogColor,
                    colorName: colorOf(l.catalogColor).colorName,
                    qty: l.qty,
                })),
                location: derivedFrontLocation(),
                backLocation: derivedBackLocation(),
                delivery: { method: S.delivery.method, taxRate: S.delivery.tax.rate },
            });
        } catch (e) {
            console.error('[CTS] Pricing failed:', e);
            fatal('Live pricing failed: ' + e.message);
            return null;
        }
    }

    function colorOf(catalogColor) {
        return S.product.colors.find((c) => c.catalogColor === catalogColor)
            || { catalogColor, colorName: catalogColor, images: {} };
    }

    function stockFor(catalogColor, size) {
        if (!inventoryTracked()) return 9999;   // untracked style — no stock gating (v1)
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
            // Service-code config + the curated 20-style catalog load first;
            // everything style-specific loads in selectProduct/loadProduct.
            const [rushPct, ltmFee, shipFee, catalog] = await Promise.all([
                loadServiceCode('3DT-RUSH'),
                loadServiceCode('3DT-LTM'),
                loadServiceCode('3DT-SHIP'),
                fetchJson(`${API_BASE}/api/dtg/top-sellers/styles`),
            ]);

            S.config.rushPct = rushPct;
            S.config.ltmFee = ltmFee;
            S.config.shipFee = shipFee;

            S.gallery.items = (catalog && catalog.records) || [];
            if (!S.gallery.items.length) throw new Error('The curated catalog returned no styles');

            $('gallery-loading').hidden = true;
            renderGallery();
            wireEverything();
            renderPromise();
            setInterval(renderPromise, 30000);

            const runway = TDTShipDate.calendarRunwayDays(new Date());
            if (runway < 400) {
                console.warn(`[CTS] Holiday calendar has ${runway} days of runway — extend custom-tees-shipdate.js`);
            }
            if (new URLSearchParams(location.search).get('canceled')) {
                toast('Your order is saved — ready when you are.', 'success');
            }

            // Resume a saved session (same style must still be in the catalog)
            const snap = readSnapshot();
            if (snap && snap.styleNumber && S.gallery.items.some((g) => g.style === snap.styleNumber)) {
                await loadProduct(snap.styleNumber, snap.design && snap.design.previewColor);
                restoreSession(snap);
                enterStudio({ scroll: false });
            }

            // Dev/QA hook (localhost only): lets the calibration sweep and
            // Preview-driven tests reach the designer + state directly.
            if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
                window.__TDT = { S, designer: () => designer, quote: currentQuote, colorOf, selectProduct };
            }
        } catch (e) {
            console.error('[CTS] Boot failed:', e);
            fatal('We couldn’t load live pricing or the catalog (' + e.message + ').');
        }
    }

    // ── Product selection + per-style loads ─────────────────────────
    let productLoading = false;

    async function selectProduct(styleNumber, catalogColor) {
        if (productLoading || !styleNumber) return;
        // Same style — just hop back into the studio (optionally on a new color)
        if (S.boot.ready && S.styleNumber === styleNumber) {
            if (catalogColor && S.product.colors.some((c) => c.catalogColor === catalogColor)) {
                S.design.previewColor = catalogColor;
                designer.setColor(colorOf(catalogColor));
                checkContrast();
                persistSoon();
            }
            enterStudio();
            return;
        }
        productLoading = true;
        const grid = $('gallery-grid');
        grid.classList.add('is-busy');
        try {
            await loadProduct(styleNumber, catalogColor);
            enterStudio();
            persistSoon();
        } catch (e) {
            console.error('[CTS] Product load failed:', e);
            fatal(`We couldn’t load live pricing or stock for ${styleNumber} (` + e.message + ')');
        } finally {
            productLoading = false;
            grid.classList.remove('is-busy');
        }
    }

    async function loadProduct(styleNumber, preferColor) {
        const galleryItem = S.gallery.items.find((g) => g.style === styleNumber);
        if (!galleryItem) throw new Error(`${styleNumber} is not in the curated catalog`);
        const enc = encodeURIComponent(styleNumber);
        const styleChanged = S.styleNumber !== styleNumber;

        const [pricing, details, styleColors, calRows] = await Promise.all([
            fetchJson(`${API_BASE}/api/pricing-bundle?method=DTG&styleNumber=${enc}`),
            fetchJson(`${API_BASE}/api/product-details?styleNumber=${enc}`),
            fetchJson(`${API_BASE}/api/dtg/top-sellers?style=${enc}`),
            // Staff-laid print-box layouts (calibration tool) — best-effort:
            // failure just means the silhouette auto-fit keeps doing the work.
            fetchJson(`${API_BASE}/api/dtg-calibration?styleNumber=${enc}`).catch(() => null),
        ]);

        if (calRows && calRows.data && calRows.data.length && window.CTS_CALIBRATION
            && typeof window.CTS_CALIBRATION.applyRemoteOverrides === 'function') {
            try { window.CTS_CALIBRATION.applyRemoteOverrides(styleNumber, calRows.data); } catch (_) { /* auto-fit fallback */ }
        }

        // Curated colors = the print-tested list. Customers NEVER get the
        // full SanMar color run here — only colors we know print well.
        const curated = [];
        const seen = new Set();
        const addCurated = (cc, name, swatch) => {
            if (!cc || seen.has(cc)) return;
            seen.add(cc);
            curated.push({ catalogColor: cc, colorName: name || cc, swatchImage: swatch || '' });
        };
        ((styleColors && styleColors.records) || []).forEach((r) =>
            addCurated(r.catalog_color, r.color_name, r.swatch_image_url));
        (galleryItem.top_colors || []).forEach((c) =>
            addCurated(c.catalog_color, c.color_name, c.swatch_image_url));
        if (!curated.length) throw new Error(`No print-tested colors for ${styleNumber}`);

        // Inventory (style-aware, v1). PC54 = live Milton stock; everything
        // else is untracked (no stock gating — server confirms at order time).
        // A PC54 feed failure is NOT fatal: the inventory-error banner shows
        // and quantities lock instead.
        if (styleChanged) {
            S.inventory.byColor = {};
            S.inventory.fetchedAt = 0;
            S.inventory.error = false;
        }
        if (styleNumber === 'PC54') {
            S.inventory.source = 'milton';
            try {
                applyInventory(await fetchJson(`${API_BASE}/api/manageorders/pc54-inventory`));
            } catch (e) {
                console.error('[CTS] Inventory load failed:', e);
                S.inventory.error = true;
            }
        } else {
            S.inventory.source = 'untracked';
            S.inventory.fetchedAt = Date.now();
        }

        S.styleNumber = styleNumber;
        S.pricing = pricing;
        S.product.curated = curated;
        S.product.title = stripStyleSuffix(galleryItem.product_title) || styleNumber;
        S.product.brand = extractBrand(galleryItem.product_title);
        S.product.rushEligible = (window.CTS_RUSH_ELIGIBLE || []).indexOf(styleNumber) !== -1;
        if (!S.product.rushEligible) S.rush = false;

        // LTM threshold = the lowest non-LTM tier's floor (API-driven, today 24)
        const nonLtm = (pricing.tiersR || [])
            .filter((t) => !parseFloat(t.LTM_Fee || 0))
            .sort((a, b) => a.MinQuantity - b.MinQuantity);
        if (!nonLtm.length) throw new Error('Pricing tiers missing a non-LTM tier');
        S.config.ltmThreshold = nonLtm[0].MinQuantity;

        // Per-style size run from the bundle (PC54: intersected with the
        // Milton-stocked sizes so the grid matches what we can actually ship)
        const bundleSizes = (pricing.sizes || []).slice()
            .sort((a, b) => (a.sortOrder || 999) - (b.sortOrder || 999))
            .map((s) => s.size);
        if (!bundleSizes.length) throw new Error(`No size data for ${styleNumber}`);
        let run = bundleSizes;
        if (inventoryTracked() && !S.inventory.error) {
            const stocked = new Set();
            Object.values(S.inventory.byColor).forEach((c) =>
                Object.keys((c && c.sizes) || {}).forEach((sz) => stocked.add(sz)));
            const filtered = bundleSizes.filter((sz) => stocked.has(sz));
            if (filtered.length) run = filtered;
        }
        SIZES = run;
        S.config.sizes = SIZES;

        // Curated colors joined to SanMar imagery (CATALOG_COLOR keys both)
        const rows = Array.isArray(details) ? details : (details.result || []);
        const byCatalog = new Map();
        rows.forEach((r) => { if (!byCatalog.has(r.CATALOG_COLOR)) byCatalog.set(r.CATALOG_COLOR, r); });
        S.product.colors = curated.map((c) => {
            const r = byCatalog.get(c.catalogColor);
            return {
                catalogColor: c.catalogColor,
                colorName: (r && r.COLOR_NAME) || c.colorName,
                swatchImage: (r && r.COLOR_SQUARE_IMAGE) || c.swatchImage,
                images: r ? {
                    // flatFront = TRUE flats only. PRODUCT_IMAGE is the style-level
                    // catalog shot — usually a MODEL photo and ALWAYS the default
                    // color, so using it as a flat fallback put the print box on a
                    // person (PC61LS) and could show the wrong garment color. Model
                    // shots route through frontModel, where the designer's silhouette
                    // auto-fit applies model anchors. (Erik feedback 2026-06-10)
                    flatFront: r.FRONT_FLAT || '',
                    flatBack: r.BACK_FLAT || '',
                    frontModel: r.FRONT_MODEL || r.PRODUCT_IMAGE || '',
                    backModel: r.BACK_MODEL || '',
                } : {},
            };
        });

        if (styleChanged) {
            // The old style's cart, contrast caches and mockups no longer apply
            S.cart.lines = [];
            S.ui.celebratedTier = false;
            Object.keys(garmentLumCache).forEach((k) => { delete garmentLumCache[k]; });
            contrastToasted.clear();
            mockupKey = '';
            S.delivery.shipEstimate = { status: 'idle', amount: null, source: null, key: '' };
        }

        initDesigner(preferColor);
        // Re-fit any kept artwork to the new garment's print geometry
        ['front', 'back'].forEach((k) => {
            const slot = S.design[k];
            if (!slot) return;
            slot.placement = designer.defaultPlacement(k, slot.naturalW, slot.naturalH);
            refreshDpi(slot);
            designer.setSlot(k, slot);
        });
        // Re-fit may move the art across a price-tier boundary — re-record
        // silently instead of toasting a "tier changed" message.
        tierToastState.front = null;
        tierToastState.back = null;
        renderCurrentProduct();
        syncRushUI();
    }

    function enterStudio(opts) {
        S.boot.ready = true;
        $('studio').hidden = false;
        $('order-bar').hidden = false;
        const zoomBtn = $('canvas-zoom-btn');
        if (zoomBtn) zoomBtn.hidden = false;   // product loaded → close-up available
        syncDeliveryUI();
        syncRushUI();
        renderStage2();
        renderDesignControls();
        renderAll();
        renderPromise();
        if (!opts || opts.scroll !== false) {
            document.querySelector('#stage-design').scrollIntoView({ behavior: 'smooth' });
        }
    }

    function renderCurrentProduct() {
        // product_title already leads with the brand — no need to prepend it
        $('current-product-name').textContent = S.product.title || S.styleNumber || '—';
        $('current-product-style').textContent = S.styleNumber ? `Style ${S.styleNumber} · ${S.product.curated.length} print-tested colors` : '';
    }

    function syncRushUI() {
        $('turnaround-card').hidden = !S.product.rushEligible;
        $('rush-toggle').checked = S.rush;
    }

    // ── Inventory (style-aware, v1) ─────────────────────────────────
    // PC54 keeps the live Milton-warehouse feed (/api/manageorders/
    // pc54-inventory — PC54-hardcoded on the proxy, per server stream).
    // Every other style is UNTRACKED for v1: curated colors render without
    // stock badges and quantities aren't stock-gated; the server confirms
    // stock at order time.
    function inventoryTracked() { return S.inventory.source === 'milton'; }

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
        if (inventoryTracked()) {
            try {
                const url = `${API_BASE}/api/manageorders/pc54-inventory` + (bustCache ? `?t=${Date.now()}` : '');
                applyInventory(await fetchJson(url));
            } catch (e) {
                console.error('[CTS] Inventory refresh failed:', e);
                S.inventory.error = true;
            }
        }
        renderStage2();
        renderAll();
    }

    // ── Step 1: product gallery ─────────────────────────────────────
    function extractBrand(title) {
        const t = String(title || '').trim();
        if (/^Port\s*&\s*Co/i.test(t)) return 'Port & Co';
        if (/^Port Authority/i.test(t)) return 'Port Authority';
        if (/^BELLA\+CANVAS/i.test(t)) return 'BELLA+CANVAS';
        if (/^District/i.test(t)) return 'District';
        if (/^Sport-Tek/i.test(t)) return 'Sport-Tek';
        if (/^Next Level/i.test(t)) return 'Next Level';
        if (/^Gildan/i.test(t)) return 'Gildan';
        return '';
    }

    // "Port & Co Core Cotton Tee. PC54" → "Port & Co Core Cotton Tee"
    function stripStyleSuffix(title) {
        return String(title || '').replace(/\.?\s*[A-Z0-9]+\s*$/, '').trim();
    }

    function galleryFiltered() {
        const cat = S.gallery.category;
        const q = S.gallery.search.trim().toLowerCase();
        return S.gallery.items.filter((it) => {
            if (cat && (it.category || 'Other') !== cat) return false;
            if (q && (`${it.style} ${it.product_title}`).toLowerCase().indexOf(q) === -1) return false;
            return true;
        });
    }

    function renderGallery() {
        renderGalleryChips();
        renderGalleryGrid();
    }

    function renderGalleryChips() {
        const wrap = $('gallery-chips');
        const cats = [];
        S.gallery.items.forEach((it) => {
            const c = it.category || 'Other';
            if (cats.indexOf(c) === -1) cats.push(c);
        });
        const chip = (label, value) => {
            const n = value
                ? S.gallery.items.filter((i) => (i.category || 'Other') === value).length
                : S.gallery.items.length;
            return `<button type="button" class="gallery-chip${S.gallery.category === value ? ' is-active' : ''}" data-cat="${escapeHTML(value)}">${escapeHTML(label)} <small>${n}</small></button>`;
        };
        wrap.innerHTML = chip('All', '') + cats.map((c) => chip(c, c)).join('');
        wrap.querySelectorAll('.gallery-chip').forEach((b) => {
            b.addEventListener('click', () => {
                S.gallery.category = b.dataset.cat || '';
                renderGalleryChips();
                renderGalleryGrid();
            });
        });
    }

    function galleryCardHtml(it) {
        const colors = Array.isArray(it.top_colors) ? it.top_colors : [];
        const def = colors[0] || null;
        const hero = (def && def.front_image_url) || it.main_image_url || '';
        const brand = extractBrand(it.product_title);
        const name = stripStyleSuffix(it.product_title) || it.style;
        const swatches = colors.slice(0, 6).map((c) => `
            <button type="button" class="gallery-swatch"
                    data-style="${escapeHTML(it.style)}" data-cc="${escapeHTML(c.catalog_color)}"
                    title="${escapeHTML(c.color_name)} — print-tested"
                    aria-label="Customize ${escapeHTML(it.style)} in ${escapeHTML(c.color_name)}">
                ${c.swatch_image_url
                    ? `<img src="${escapeHTML(c.swatch_image_url)}" alt="" loading="lazy">`
                    : '<span class="gallery-swatch-blank"></span>'}
            </button>`).join('');
        return `
            <article class="gallery-card" role="button" tabindex="0"
                     data-style="${escapeHTML(it.style)}" data-cc="${escapeHTML(def ? def.catalog_color : '')}"
                     aria-label="Customize ${escapeHTML(name)}">
                <div class="gallery-card-hero">
                    ${hero
                        ? `<img src="${escapeHTML(hero)}" alt="${escapeHTML(name)}" loading="lazy">`
                        : '<i class="fas fa-shirt" aria-hidden="true"></i>'}
                </div>
                <div class="gallery-card-body">
                    ${brand ? `<small class="gallery-card-brand">${escapeHTML(brand)}</small>` : ''}
                    <strong class="gallery-card-name">${escapeHTML(name)}</strong>
                    <small class="gallery-card-style">${escapeHTML(it.style)} · ${escapeHTML(it.category || 'Other')}</small>
                    <div class="gallery-card-swatches">
                        ${swatches}
                        ${it.color_count > 6 ? `<span class="gallery-swatch-more">+${Math.max(0, (Number(it.color_count) || 0) - 6)}</span>` : ''}
                    </div>
                    <div class="gallery-card-foot">
                        <span class="gallery-card-proof"><i class="fas fa-fire" aria-hidden="true"></i> ${fmtInt(it.total_units_sold)} printed</span>
                        <span class="gallery-card-cta">Customize <i class="fas fa-arrow-right" aria-hidden="true"></i></span>
                    </div>
                </div>
            </article>`;
    }

    function renderGalleryGrid() {
        const grid = $('gallery-grid');
        const items = galleryFiltered();
        $('gallery-empty').hidden = items.length > 0;
        grid.innerHTML = items.map(galleryCardHtml).join('');
        grid.querySelectorAll('.gallery-card').forEach((card) => {
            card.addEventListener('click', () => selectProduct(card.dataset.style, card.dataset.cc || null));
            card.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    selectProduct(card.dataset.style, card.dataset.cc || null);
                }
            });
        });
        grid.querySelectorAll('.gallery-swatch').forEach((sw) => {
            sw.addEventListener('click', (e) => {
                e.stopPropagation();
                selectProduct(sw.dataset.style, sw.dataset.cc);
            });
        });
    }

    function backToGallery() {
        if (S.design.front || S.design.back) {
            const ok = window.confirm('Head back to the catalog? Your artwork is kept — picking a different shirt resets placement and quantities.');
            if (!ok) return;
        }
        document.querySelector('#stage-gallery').scrollIntoView({ behavior: 'smooth' });
    }

    // ── Designer init + artwork handling ────────────────────────────
    // Re-created on every product selection. styleNumber + the curated
    // colors' SanMar image URLs flow in; the calibration stream's
    // CTS_CALIBRATION.forStyle(styleNumber) decides calibrated vs generic
    // print-box geometry — this file never does geometry itself.
    function initDesigner(preferColor) {
        if (designer && typeof designer.destroy === 'function') designer.destroy();
        designer = TDTDesigner.create({
            canvas: $('tdt-canvas'),
            calibration: window.CTS_CALIBRATION || TDTCalibration,
            styleNumber: S.styleNumber,
            liveRegion: $('designer-live'),
            onPlacementChange(slotKey, placement) {
                const slot = S.design[slotKey];
                if (!slot) return;
                slot.placement = placement;
                refreshDpi(slot);
                renderDesignControls();
                // Resizing can cross a price-tier boundary (LC→FF→JF) —
                // re-quote everything, not just the design panel.
                renderAll();
                persistSoon();
            },
            onTapEmptyArea() { $('art-input').click(); },
            onError(msg) { showCanvasNote(msg); },
        });
        const pick = (preferColor && S.product.colors.find((c) => c.catalogColor === preferColor))
            || S.product.colors[0];
        S.design.previewColor = pick.catalogColor;
        designer.setColor(pick);
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
            console.warn('[CTS] Preview decode failed, falling back to placeholder:', e);
            slot.previewable = false;
        }

        slot.placement = designer.defaultPlacement(slotKey, slot.naturalW, slot.naturalH);
        slot.artLum = slot.previewable && slot.bitmap ? computeArtLuminance(slot.bitmap) : null;
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
        checkContrast();
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

    // ── Contrast guard (dark-art-on-dark-shirt = DTG reprint ticket) ───
    // Alpha-weighted artwork luminance vs the garment's print-area patch;
    // close values get a toast + ⚠ badge + a line in the review ack and the
    // ShopWorks placement warnings. Advisory, never blocks (we print what
    // the customer approves).
    const CONTRAST_DELTA = 55;          // 0-255 luminance distance
    const garmentLumCache = {};
    const contrastToasted = new Set();

    function computeArtLuminance(bitmap) {
        try {
            const c = document.createElement('canvas');
            c.width = c.height = 48;
            const x = c.getContext('2d');
            x.drawImage(bitmap, 0, 0, 48, 48);
            const d = x.getImageData(0, 0, 48, 48).data;
            let sum = 0, wsum = 0;
            for (let i = 0; i < 48 * 48; i++) {
                const o = i * 4;
                const a = d[o + 3] / 255;
                if (a < 0.05) continue;     // transparent pixels don't print
                sum += (0.2126 * d[o] + 0.7152 * d[o + 1] + 0.0722 * d[o + 2]) * a;
                wsum += a;
            }
            return wsum > 0 ? sum / wsum : null;
        } catch (_) { return null; }
    }

    function garmentLuminance(colorObj) {
        const cc = colorObj.catalogColor;
        if (cc in garmentLumCache) return Promise.resolve(garmentLumCache[cc]);
        const src = colorObj.images.flatFront || colorObj.images.frontModel;
        if (!src) { garmentLumCache[cc] = null; return Promise.resolve(null); }
        return new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                try {
                    const a = TDTCalibration.areaPx('flatFront', 'FF', cc, img.naturalWidth, img.naturalHeight);
                    const c = document.createElement('canvas');
                    c.width = c.height = 32;
                    const x = c.getContext('2d');
                    x.drawImage(img, a.x, a.y, a.w, a.h, 0, 0, 32, 32);
                    const d = x.getImageData(0, 0, 32, 32).data;
                    let sum = 0;
                    for (let i = 0; i < 32 * 32; i++) {
                        const o = i * 4;
                        sum += 0.2126 * d[o] + 0.7152 * d[o + 1] + 0.0722 * d[o + 2];
                    }
                    garmentLumCache[cc] = sum / (32 * 32);
                } catch (_) { garmentLumCache[cc] = null; }
                resolve(garmentLumCache[cc]);
            };
            img.onerror = () => { garmentLumCache[cc] = null; resolve(null); };
            img.src = '/api/image-proxy?url=' + encodeURIComponent(src);
        });
    }

    async function checkContrast() {
        const colors = new Set(S.cart.lines.map((l) => l.catalogColor));
        if (S.design.previewColor) colors.add(S.design.previewColor);
        let changed = false;
        for (const k of ['front', 'back']) {
            const slot = S.design[k];
            if (!slot) continue;
            if (slot.previewable && slot.artLum != null) {
                for (const cc of colors) {
                    const gl = await garmentLuminance(colorOf(cc));
                    if (gl == null) continue;
                    const warnKey = 'contrast:' + cc;
                    const low = Math.abs(slot.artLum - gl) < CONTRAST_DELTA;
                    const has = slot.warnings.includes(warnKey);
                    if (low && !has) {
                        slot.warnings.push(warnKey);
                        changed = true;
                        const tkey = `${slot.fileName}|${cc}|${k}`;
                        if (!contrastToasted.has(tkey)) {
                            contrastToasted.add(tkey);
                            toast(`Heads up — your ${k} art may be hard to see on ${colorOf(cc).colorName}. We print exactly what you upload.`, 'error');
                        }
                    } else if (!low && has) {
                        slot.warnings.splice(slot.warnings.indexOf(warnKey), 1);
                        changed = true;
                    }
                }
            }
            // Drop contrast warnings for colors no longer in play
            const before = slot.warnings.length;
            slot.warnings = slot.warnings.filter((w) =>
                !w.startsWith('contrast:') || colors.has(w.slice(9)));
            if (slot.warnings.length !== before) changed = true;
        }
        if (changed) { renderDesignControls(); renderAll(); persistSoon(); }
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
            const warn = (s.effectiveDpi && s.effectiveDpi < DPI_AMBER) || (s.warnings || []).length;
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
                // Guard: a slot without fileName must not throw here — an
                // exception in this DISPLAY line kills the whole render chain
                // (readout/totals stop updating). (found via QA probe 2026-06-10)
                thumb.textContent = ((slot.fileName || 'ART').split('.').pop() || 'ART').toUpperCase();
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
                msgs.push('We can’t preview this file type in the browser. Position the gray box where you want your art — our art team will match it and email you a proof before printing (usually within 2 business hours). Your production clock starts at proof approval.');
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

        renderSizePriceReadout();
    }

    // ── Print size & price readout (free placement) ─────────────────
    // One row per side with art: "FRONT — 10.0″ × 7.5″ → Full Front ·
    // $X.XX/shirt"; the BACK row shows its INCREMENTAL cost. Prices are the
    // size-M per-shirt rate at the cart's combined quantity (or the lowest
    // volume tier before any quantities exist).
    function renderSizePriceReadout() {
        if (!S.boot.ready && !S.pricing) return;
        const el = $('size-price-readout');
        if (!el) return;
        const combined = TDTPricing.combinedQuantity(S.cart.lines);
        const qty = combined || S.config.ltmThreshold || 24;
        const fl = derivedFrontLocation();
        const bl = derivedBackLocation();
        const u = (loc, back) => TDTPricing.unitPrice(S.pricing, pricingConfig(), qty, loc, back, 'M', S.rush).finalPrice;
        const dimTxt = (slot) => {
            const d = artDims(slot);
            return `${d.wIn.toFixed(1)}″ × ${d.hIn.toFixed(1)}″`;
        };
        const rowHtml = (side, dims, tierName, price) =>
            `<div class="spr-row">
                <span class="spr-side">${side}</span>
                <span class="spr-dims">${escapeHTML(dims)}</span>
                <i class="fas fa-arrow-right spr-arrow" aria-hidden="true"></i>
                <span class="spr-tier">${escapeHTML(tierName)}</span>
                <span class="spr-price">${escapeHTML(price)}</span>
            </div>`;
        const emptyRow = (side, msg) =>
            `<div class="spr-row is-empty"><span class="spr-side">${side}</span><span>${escapeHTML(msg)}</span></div>`;

        let html = '';
        try {
            if (S.design.front && fl) {
                html += rowHtml('FRONT', dimTxt(S.design.front), LOC_NAMES[fl], money(u(fl, null)) + '/shirt');
            } else {
                html += emptyRow('FRONT', 'add artwork (price starts at the Left Chest 4×4″ rate)');
            }
            if (S.design.back && bl) {
                // Incremental cost of the back print on top of the front;
                // back-only designs show the full per-shirt rate instead.
                const price = fl
                    ? '+' + money(u(fl, bl) - u(fl, null)) + '/shirt'
                    : money(u(null, bl)) + '/shirt';
                html += rowHtml('BACK', dimTxt(S.design.back), LOC_NAMES[bl], price);
            } else if (S.design.backEnabled) {
                html += emptyRow('BACK', 'add back artwork to price it');
            }
            html += `<div class="spr-foot">per shirt (size M) at ${combined || `${qty}+`} pieces${S.rush ? ' · 3-Day Rush' : ''}</div>`;
        } catch (e) {
            console.error('[CTS] Size/price readout failed:', e);
            html = emptyRow('PRICE', 'unavailable — refresh to reload live pricing');
        }
        el.innerHTML = html;

        // "Add a back print" toggle: live incremental rate for the current art
        try {
            if (fl) {
                const withBack = u(fl, bl || 'FB');
                $('back-delta').textContent = `+${money(withBack - u(fl, null))}/shirt — priced by your art’s size`;
            } else {
                $('back-delta').textContent = 'priced by your art’s size';
            }
        } catch (_) { /* leave default */ }

        scheduleTierToast();
    }

    // ── Tier-change feedback ────────────────────────────────────────
    // Toast ONLY when a resize SETTLES on a different derived tier than the
    // last one we toasted/recorded — dragging through a boundary and back
    // stays quiet. First placement of a side records silently.
    const tierToastState = { front: null, back: null, timer: null };
    const LOC_RANK = { LC: 0, FF: 1, JF: 2, FB: 1, JB: 2 };
    const LOC_LIMITS = { LC: '4×4″', FF: '12×16″', FB: '12×16″' };
    function tierChangeMsg(side, from, to) {
        const sideName = side === 'back' ? 'Back' : 'Front';
        if (LOC_RANK[to] > LOC_RANK[from]) {
            return `${sideName} print is now larger than ${LOC_LIMITS[from]} — the ${LOC_NAMES[to]} rate applies`;
        }
        return `${sideName} print now fits within ${LOC_LIMITS[to] || '12×16″'} — the ${LOC_NAMES[to]} rate applies`;
    }
    function scheduleTierToast() {
        clearTimeout(tierToastState.timer);
        tierToastState.timer = setTimeout(() => {
            [['front', derivedFrontLocation], ['back', derivedBackLocation]].forEach(([side, derive]) => {
                if (!S.design[side]) { tierToastState[side] = null; return; }
                const now = derive();
                if (!now) { tierToastState[side] = null; return; }
                const last = tierToastState[side];
                if (last && last !== now) {
                    toast(tierChangeMsg(side, last, now), LOC_RANK[now] < LOC_RANK[last] ? 'success' : null);
                }
                tierToastState[side] = now;
            });
        }, 650);
    }

    // ── Promise banner (standard 7–10 days; 3-Day Rush when toggled) ─
    function renderPromise() {
        const main = $('promise-main');
        const sub = $('promise-sub');
        if (S.rush) {
            const p = TDTShipDate.promise(new Date());
            if (p.beforeCutoff) {
                main.textContent = `Order in the next ${p.cutoff.hours}h ${p.cutoff.minutes}m → ships ${p.shipDateShort}`;
                sub.textContent = `3-Day Rush · 9 AM ${p.tzAbbr} cutoff · from Milton, WA`;
            } else {
                main.textContent = `Order today → ships ${p.shipDateShort}`;
                sub.textContent = `3-Day Rush · next cutoff: ${p.cutoff.dayLong.split(',')[0]} 9 AM ${p.tzAbbr} (${p.cutoff.hours}h ${p.cutoff.minutes}m)`;
            }
        } else {
            const sp = shipPromise();
            main.textContent = 'Ships in 7–10 business days';
            sub.textContent = (sp.iso ? `Estimated ship window: ${sp.label} · ` : '') + 'full-color DTG · printed in Milton, WA';
        }
        renderBar();
    }

    // ── Stage 2: colors + sizes ─────────────────────────────────────
    function renderStage2() {
        renderColorChips();
        renderColorCards();
        $('inventory-error').hidden = !S.inventory.error;
        $('inventory-stamp').textContent = inventoryTracked() && S.inventory.fetchedAt
            ? `Live stock from our Milton warehouse · updated ${new Date(S.inventory.fetchedAt).toLocaleTimeString()}`
            : '';
    }

    function renderColorChips() {
        const wrap = $('color-chips');
        wrap.innerHTML = '';
        const tracked = inventoryTracked();
        S.product.colors.forEach((c) => {
            const inCart = S.cart.lines.some((l) => l.catalogColor === c.catalogColor);
            const inv = S.inventory.byColor[c.catalogColor];
            const total = inv ? inv.total : 0;
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'color-chip' + (inCart ? ' is-active' : '');
            btn.disabled = tracked && S.inventory.error;
            let stockHtml = '';
            if (tracked) {
                const stockCls = total <= 0 ? 'is-out' : total <= 24 ? 'is-low' : '';
                const stockTxt = total <= 0 ? 'Out of stock' : total <= 24 ? `${total} left` : 'In stock';
                stockHtml = `<span class="chip-stock ${stockCls}">${stockTxt}</span>`;
            }
            btn.innerHTML =
                `<span class="chip-swatch" style="background-image:url('${escapeHTML(c.swatchImage)}')"></span>` +
                `<span>${escapeHTML(c.colorName)}</span>` +
                stockHtml;
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
            checkContrast();
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

            const tracked = inventoryTracked();
            let cells = '';
            SIZES.forEach((size) => {
                const stock = stockFor(line.catalogColor, size);
                const q = line.qty[size] || 0;
                const up = (S.pricing && (S.pricing.sellingPriceDisplayAddOns || {})[size]) || 0;
                const stockCls = stock <= 0 ? 'is-out' : stock <= 12 ? 'is-low' : '';
                const stockTxt = !tracked ? ''
                    : stock <= 0 ? 'Out of stock' : stock <= 12 ? `Only ${stock} left` : `${stock} in stock`;
                cells += `
                    <div class="size-cell ${stock <= 0 ? 'is-out' : ''}">
                        <div class="size-cell-label">${size}${up ? ` <small>+${money(up)}</small>` : ''}</div>
                        ${tracked ? `<div class="size-cell-stock ${stockCls}">${stockTxt}</div>` : ''}
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
                label = money(TDTPricing.unitPrice(S.pricing, pricingConfig(), t.MinQuantity,
                    derivedFrontLocation(), derivedBackLocation(), 'M', S.rush).finalPrice);
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
            toast('Volume pricing unlocked — the small-batch fee is gone', 'success');
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
            console.error('[CTS] Tax lookup failed:', e);
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
        const sp = shipPromise();
        $('review-promise').innerHTML = `<i class="fas fa-truck-fast"></i> ${escapeHTML(sp.long)} from Milton, WA`;

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
            if (s) {
                (s.warnings || []).filter((w) => w.indexOf('contrast:') === 0).forEach((w) => {
                    acks.push(`⚠ Your ${k} art may be hard to see on ${escapeHTML(colorOf(w.slice(9)).colorName)} — we print exactly what you upload.`);
                });
            }
        });
        ackEl.innerHTML = acks.join('<br>');
        ackEl.hidden = !acks.length;

        renderReviewMockups();
    }

    function buildTotalsHtml(q) {
        let h = `<div class="tot-row"><span>Shirts (${q.combinedQty})</span><span>${money(q.shirtsSubtotal)}</span></div>`;
        if (S.rush) {
            h += `<div class="tot-row is-included"><span>3-Day Rush production</span><span>included ✓</span></div>`;
        }
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

    // Sides worth mocking up = sides with art (front-only fallback so an
    // empty design still shows the blank garment).
    function mockupViews() {
        const v = [];
        if (S.design.front) v.push('front');
        if (S.design.back) v.push('back');
        return v.length ? v : ['front'];
    }

    let mockupKey = '';
    let mockupUrls = [];   // revoked on every replacement — blob URLs leak otherwise
    const renderReviewMockups = debounce(async function () {
        const wrap = $('review-mockups');
        if ((!S.design.front && !S.design.back) || !S.cart.lines.length) {
            wrap.innerHTML = '';
            mockupKey = '';
            mockupUrls.forEach((u) => URL.revokeObjectURL(u));
            mockupUrls = [];
            return;
        }
        const slotSig = (s) => s && [s.fileName, s.naturalW, s.naturalH, s.placement];
        const key = JSON.stringify([S.cart.lines.map((l) => l.catalogColor),
            derivedFrontLocation(), derivedBackLocation(),
            slotSig(S.design.front), slotSig(S.design.back)]);
        if (key === mockupKey) return;
        mockupKey = key;

        const colors = S.cart.lines.slice(0, 4).map((l) => colorOf(l.catalogColor));
        const views = mockupViews();
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
        // At least one side needs art (back-only designs are valid — the
        // front then contributes no print cost).
        if (!S.design.front && !S.design.back) reasons.push({ label: 'Add artwork', target: '#stage-design', act: () => $('art-input').click() });
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
        renderSizePriceReadout();
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
        const sp = shipPromise();
        pay.disabled = reasons.length > 0 || S.checkout.running;
        $('pay-btn-label').textContent = reasons.length
            ? 'Pay' : `Pay ${money(q.total)} — ${sp.short}`;
    }

    let lastQuote = null;
    function renderBarWith(q) {
        lastQuote = q;
        $('bar-total').textContent = money(q.total);
        const sp = shipPromise();
        $('bar-meta').textContent = q.combinedQty
            ? `${q.combinedQty} shirt${q.combinedQty === 1 ? '' : 's'} · ${sp.short}`
            : (() => {
                try {
                    const from = TDTPricing.unitPrice(S.pricing, pricingConfig(), S.config.ltmThreshold, 'LC', null, 'M', S.rush).finalPrice;
                    return `From ${money(from)}/shirt at ${S.config.ltmThreshold}+ pieces`;
                } catch (_) { return 'Design yours now'; }
            })();

        // Smart CTA — always names the first incomplete thing
        const cta = $('smart-cta');
        if (!S.design.front && !S.design.back) {
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
        $('sheet-promise').textContent = q.lines.length ? shipPromise().long : '';
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
            // ① Stock recheck (fresh, cache-busted) — Milton-tracked styles
            // only; untracked styles are stock-confirmed server-side at
            // order time (v1).
            plStep(1);
            if (inventoryTracked()) {
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
                const views = mockupViews();
                for (const v of views) {
                    const blob = await designer.exportMockup(c, v, S.design, 1200);
                    if (!blob) continue;   // tainted/failed export NEVER blocks checkout
                    const f = new File([blob], `CTS-mockup-${S.styleNumber}-${c.catalogColor.replace(/\W+/g, '')}-${v}.jpg`, { type: 'image/jpeg' });
                    try {
                        const r = await up(f);
                        mockups.push({ color: c.colorName, catalogColor: c.catalogColor, view: v, url: r.hostedUrl });
                    } catch (e) {
                        console.warn('[CTS] Mockup upload failed (continuing):', e);
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
            console.error('[CTS] Checkout pipeline failed:', e);
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
        // Derived from the art's printed size — the server re-derives the
        // tier from orderSettings.placement.{front,back}.{wIn,hIn} and these
        // codes are advisory (push notes / display).
        const frontLoc = derivedFrontLocation();
        const backLocation = derivedBackLocation();
        const locCode = [frontLoc, backLocation].filter(Boolean).join('_') || 'LC';
        const locName = [frontLoc, backLocation].filter(Boolean)
            .map((c) => LOC_NAMES[c] || c).join(' + ') || 'Left Chest';
        const sp = shipPromise();

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
                location: k === 'back' ? backLocation : frontLoc,
                wIn: s.placement.wIn, xIn: s.placement.xIn, yIn: s.placement.yIn,
                // hIn is REQUIRED: the server re-derives the price tier from
                // wIn × hIn and rejects mismatched client codes.
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
                channel: 'custom-tees',                  // server-validated — selects the custom-tees pricing path
                styleNumber: S.styleNumber,
                productTitle: S.product.title,
                rush: S.rush,                            // server 400s rush on non-eligible styles
                frontLocation: frontLoc,                 // 'LC'|'FF'|'JF' | null (back-only) — derived from art size
                backLocation: backLocation,              // 'FB'|'JB' | null — derived from art size
                printLocationCode: locCode,
                printLocationName: locName,
                frontLogo: S.design.front && S.design.front.uploaded
                    ? { fileUrl: S.design.front.uploaded.hostedUrl, fileName: S.design.front.uploaded.fileName } : null,
                backLogo: S.design.back && S.design.back.uploaded
                    ? { fileUrl: S.design.back.uploaded.hostedUrl, fileName: S.design.back.uploaded.fileName } : null,
                mockups,
                placement: { front: placementOf('front'), back: placementOf('back') },
                shipPromise: { iso: sp.iso, label: sp.label, rush: S.rush },
                needsArtReview: ['front', 'back'].some((k) => S.design[k] && (!S.design[k].previewable || S.design[k].warnings.includes('svg-needs-review'))),
            },
            successUrl: `${location.origin}/pages/custom-tees-success.html?session_id={CHECKOUT_SESSION_ID}`,
            cancelUrl: `${location.origin}/custom-tees?canceled=1`,
        };
    }

    // ── Persistence ─────────────────────────────────────────────────
    function snapshot() {
        const slotLite = (s) => s ? {
            fileName: s.fileName, previewable: s.previewable, isVector: s.isVector,
            naturalW: s.naturalW, naturalH: s.naturalH, placement: s.placement,
            effectiveDpi: s.effectiveDpi, lowDpiAck: s.lowDpiAck, artLum: s.artLum,
            warnings: s.warnings, uploaded: s.uploaded,
        } : null;
        return {
            // v3 (2026-06-10): frontLocation dropped — free placement derives
            // the price tier from the persisted placement dims instead.
            v: 3, ts: Date.now(),
            styleNumber: S.styleNumber,
            rush: S.rush,
            design: {
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

    function readSnapshot() {
        let snap;
        try { snap = JSON.parse(sessionStorage.getItem(PERSIST_KEY) || 'null'); } catch (_) { return null; }
        if (!snap || snap.v !== 3) return null;
        if (Date.now() - snap.ts > 24 * 3600 * 1000) return null;
        return snap;
    }

    function restoreSession(snap) {
        if (!snap || snap.styleNumber !== S.styleNumber) return;

        S.rush = !!snap.rush && S.product.rushEligible;
        S.cart = snap.cart && Array.isArray(snap.cart.lines) ? snap.cart : S.cart;
        // Drop cart colors that are no longer in the curated list
        S.cart.lines = S.cart.lines.filter((l) =>
            S.product.colors.some((c) => c.catalogColor === l.catalogColor));
        Object.assign(S.customer, snap.customer || {});
        if (snap.delivery) {
            S.delivery.method = snap.delivery.method === 'pickup' ? 'pickup' : 'ship';
            Object.assign(S.delivery.address, snap.delivery.address || {});
            S.delivery.notes = snap.delivery.notes || '';
        }
        if (snap.design) {
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
            if (snap.design.previewColor && S.product.colors.some((c) => c.catalogColor === snap.design.previewColor)) {
                S.design.previewColor = snap.design.previewColor;
                designer.setColor(colorOf(snap.design.previewColor));
            }
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
        // Hero CTA — gallery first; once a product is picked, jump to art
        $('hero-cta').addEventListener('click', () => {
            if (!S.boot.ready) {
                document.querySelector('#stage-gallery').scrollIntoView({ behavior: 'smooth' });
                return;
            }
            document.querySelector('#stage-design').scrollIntoView({ behavior: 'smooth' });
            setTimeout(() => $('art-input').click(), 400);
        });
        $('tdt-fatal-retry').addEventListener('click', () => location.reload());

        // Gallery search
        $('gallery-search').addEventListener('input', debounce((e) => {
            S.gallery.search = e.target.value || '';
            renderGalleryGrid();
        }, 150));

        // Change product → back to the catalog
        $('change-product').addEventListener('click', backToGallery);

        // 3-Day Rush toggle (only visible on rush-eligible styles)
        $('rush-toggle').addEventListener('change', (e) => {
            S.rush = !!e.target.checked && S.product.rushEligible;
            renderPromise();
            renderDesignControls();
            renderAll();
            persistSoon();
        });

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

        // ── Zoom lightbox: hi-res close-up of the print area (2026-06-10) ──
        // exportZoomCrop renders from the NATURAL-resolution garment photo, so
        // the close-up is crisp — not a blow-up of the on-screen canvas. The
        // button unhides in enterStudio() once a product is loaded.
        function currentView() {
            return $('tab-back').classList.contains('is-active') ? 'back' : 'front';
        }
        async function openZoomLightbox() {
            const view = currentView();
            const btn = $('canvas-zoom-btn');
            if (btn) { btn.disabled = true; }
            let url = null;
            try { url = await designer.exportZoomCrop(view, 1100); } catch (_) { /* fall through */ }
            if (btn) { btn.disabled = false; }
            if (!url) { toast('Close-up unavailable for this view right now.'); return; }
            const slot = view === 'back' ? S.design.back : S.design.front;
            const locCode = view === 'back' ? derivedBackLocation() : (slot ? derivedFrontLocation() : null);
            const locName = slot && locCode
                ? `${LOC_NAMES[locCode]} rate`
                : 'print area up to 16″×20″';
            $('zoom-lightbox-img').src = url;
            $('zoom-lightbox-caption').textContent =
                `${view === 'back' ? 'Back' : 'Front'} — ${locName}` +
                (slot && slot.placement ? ` · art ${slot.placement.wIn}″ wide` : ' · no artwork placed yet') +
                ' · placement preview is approximate';
            $('zoom-lightbox').hidden = false;
            document.body.style.overflow = 'hidden';
            $('zoom-lightbox-close').focus();
        }
        function closeZoomLightbox() {
            $('zoom-lightbox').hidden = true;
            $('zoom-lightbox-img').src = '';
            document.body.style.overflow = '';
        }
        $('canvas-zoom-btn').addEventListener('click', openZoomLightbox);
        $('zoom-lightbox-close').addEventListener('click', closeZoomLightbox);
        $('zoom-lightbox').addEventListener('click', (e) => {
            if (e.target === $('zoom-lightbox')) closeZoomLightbox();
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !$('zoom-lightbox').hidden) closeZoomLightbox();
        });

        // (Location pills removed 2026-06-10 — free placement: the price
        // tier follows the art's printed size, see renderSizePriceReadout.)

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
