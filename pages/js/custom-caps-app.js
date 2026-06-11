/**
 * custom-caps-app.js — application core for the Custom Hats storefront
 * ('custom-caps' channel; the cap-native sibling of custom-tees-app.js).
 *
 * Owns: the step-1 cap gallery (GET /api/caps/catalog — Caspio
 * CAPS_Catalog_2026, 9 curated styles × hero colors), state + sessionStorage
 * persistence (caps_studio_v1), per-style API loads (CAP pricing bundle,
 * product images, live SanMar stock), every UI renderer (sticky bar, smart
 * CTA, color cards, tier ladder, proof panel, review), logo uploads, and the
 * 4-step checkout pipeline (stock recheck → uploads → quote save + Stripe
 * session → redirect).
 *
 * Money rules (Erik):
 *   - Every price comes from an API at runtime: /api/pricing-bundle
 *     (method=CAP per style + CAP-AL once) + Service_Codes CAPS-SHIP-FLAT /
 *     CAPS-SHIP-FREE-OVER + /api/tax-rates/lookup. Config failure =
 *     full-page fatal state. NEVER a guessed price.
 *   - ALL math lives in CAPSPricing.quote() — this file only renders it.
 *     The server reprice (rebuildCapsQuote) runs the SAME module on the SAME
 *     inputs; a mismatch 409s checkout before Stripe.
 *   - 8-cap minimum (Erik decision #9): the module throws structured
 *     BELOW_MINIMUM under the lowest non-LTM tier — this file renders the
 *     inline error, it never prices the 1-7 tier.
 *   - COLOR_NAME is display-only; CATALOG_COLOR keys everything (cart,
 *     stock aggregation, checkout colorConfigs).
 *
 * Cap-native differences from the tees chassis (deliberate):
 *   - NO canvas designer / DPI gates — embroidery is digitized by hand and
 *     proofed by email before anything stitches (decision #11). The proof
 *     panel is an honest side-by-side: cap photo + logo thumbnail + location
 *     chip. Customers never see stitch counts (decision #2).
 *   - NO size grid — OSFA, one quantity stepper per color (starts at 24).
 *   - Stock aggregates by CATALOG_COLOR, never per size: cap feeds carry
 *     stale sized partIds at 0 qty next to the real OSFA rows (C402 lesson).
 *
 * Module loaded before this file: CAPSPricing (custom-caps-pricing.js).
 */
(function () {
    'use strict';

    // ── Config ──────────────────────────────────────────────────────
    const API_BASE = (window.APP_CONFIG && window.APP_CONFIG.API && window.APP_CONFIG.API.BASE_URL)
        || 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
    const PERSIST_KEY = 'caps_studio_v1';
    const DEFAULT_FIRST_QTY = 24;          // first color line starts here (min is API-derived, 8)

    const RASTER_EXTS = /\.(png|jpe?g|webp)$/i;
    const SVG_EXT = /\.svg$/i;
    const ALL_EXTS = /\.(png|jpe?g|webp|svg|ai|eps|pdf|psd|tiff?)$/i;
    const MAX_BYTES = 20 * 1024 * 1024;

    // ── State ───────────────────────────────────────────────────────
    const S = {
        boot: { ready: false, fatal: null },
        styleNumber: null,
        gallery: { items: [] },            // [{style, rank, title, brand, role, colors:[{catalogColor,colorName,rank}]}]
        config: { shipFlat: null, shipFreeOver: null },   // Caspio CAPS-SHIP-* (live)
        capBundle: null,                   // /api/pricing-bundle?method=CAP&styleNumber=X (selected style)
        capAlBundle: null,                 // /api/pricing-bundle?method=CAP-AL (back-logo add-on)
        product: { colors: [], title: '', brand: '', role: '' },
        inventory: { byColor: {}, fetchedAt: 0, error: false, tracked: false },
        logos: {
            backEnabled: false,
            front: null,                   // {file, fileName, mime, previewable, isVector, thumbUrl, uploaded, warnings[]}
            back: null,
            previewColor: null,            // catalogColor shown on the proof panel
        },
        cart: { lines: [] },               // [{catalogColor, quantity}] — OSFA only
        customer: { firstName: '', lastName: '', email: '', phone: '', company: '' },
        delivery: {
            method: 'ship',
            address: { address1: '', city: '', state: '', zip: '' },
            notes: '',
            tax: { rate: null, account: null, accountName: null, source: null, error: false },
        },
        checkout: { running: false },
        // Artwork-rights attestation — intentionally NOT persisted: each
        // session re-checks it so orderSettings.rightsAck carries a fresh
        // timestamp (server 400s checkout without it).
        rightsAck: false,
        ui: { celebratedTier: false },
    };

    // style → { bundle, detailsByColor:Map, promise } — gallery prices +
    // configure step share these; bundles are fetched lazily per style and
    // cached in-page (never re-derived, never guessed).
    const styleCache = new Map();

    const $ = (id) => document.getElementById(id);

    // ── Tiny helpers ────────────────────────────────────────────────
    function escapeHTML(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
        }[c]));
    }
    const money = (v) => '$' + (Number(v) || 0).toFixed(2);
    // "$23" not "$23.00" — CeilDollar prices are whole dollars; keep cents
    // only when the live value actually has them (back-logo add-ons do).
    const moneyTrim = (v) => {
        const n = Number(v) || 0;
        return '$' + (n % 1 === 0 ? String(n) : n.toFixed(2));
    };
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
        const wrap = $('caps-toasts');
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

    function fatal(msg) {
        S.boot.fatal = msg;
        $('caps-fatal-msg').textContent = msg + ' — or call us and we’ll take your order by phone.';
        $('caps-fatal').hidden = false;
    }

    async function loadServiceCode(code) {
        const j = await fetchJson(`${API_BASE}/api/service-codes?code=${encodeURIComponent(code)}`);
        const row = j && j.data && j.data[0];
        if (!row || !row.IsActive || !(parseFloat(row.SellPrice) >= 0)) {
            throw new Error(`Service code ${code} missing/inactive in Caspio`);
        }
        return parseFloat(row.SellPrice);
    }

    function colorOf(catalogColor) {
        return S.product.colors.find((c) => c.catalogColor === catalogColor)
            || { catalogColor, colorName: catalogColor, images: {} };
    }

    function combinedQty() {
        return S.cart.lines.reduce((a, l) => a + (l.quantity || 0), 0);
    }

    function minQty() {
        try { return CAPSPricing.minOrderQuantity(S.capBundle && S.capBundle.tiersR); }
        catch (_) { return 8; }
    }

    // ── Quote (single money source — CAPSPricing only) ──────────────
    // Returns the module quote, or { belowMin:{minQuantity,quantity} } when
    // the combined qty is under the store minimum (renderers handle both),
    // or null after a fatal pricing error.
    function currentQuote() {
        try {
            return CAPSPricing.quote({
                capBundle: S.capBundle,
                capAlBundle: S.capAlBundle,
                config: { shipFlat: S.config.shipFlat, shipFreeOver: S.config.shipFreeOver },
                cart: S.cart.lines.map((l) => ({
                    catalogColor: l.catalogColor,
                    colorName: colorOf(l.catalogColor).colorName,
                    quantity: l.quantity,
                })),
                backLogo: S.logos.backEnabled,
                delivery: { method: S.delivery.method, taxRate: S.delivery.tax.rate },
            });
        } catch (e) {
            if (e && e.code === 'BELOW_MINIMUM') {
                return { belowMin: { minQuantity: e.minQuantity, quantity: e.quantity } };
            }
            console.error('[Caps] Pricing failed:', e);
            fatal('Live pricing failed: ' + e.message);
            return null;
        }
    }

    // Per-cap price at a given quantity (ladder rows, "from $X" copy).
    // Includes the back-logo add-on when the toggle is on. Throws on data
    // gaps — callers surface it, never guess.
    function perCapAt(qty) {
        const u = CAPSPricing.unitPrice(S.capBundle, qty);
        const back = S.logos.backEnabled ? CAPSPricing.backLogoPerCap(S.capAlBundle, qty) : 0;
        return { perCap: Math.round((u.perCap + back + Number.EPSILON) * 100) / 100, base: u.perCap, back };
    }

    // ── Boot ────────────────────────────────────────────────────────
    async function boot() {
        try {
            // Channel config (Caspio CAPS-SHIP-*), the CAP-AL add-on bundle
            // and the curated catalog load first — ALL fail-closed (fatal
            // card, never a fallback price). Per-style CAP bundles load
            // lazily as gallery cards fill in.
            const [shipFlat, shipFreeOver, capAl, catalog] = await Promise.all([
                loadServiceCode('CAPS-SHIP-FLAT'),
                loadServiceCode('CAPS-SHIP-FREE-OVER'),
                fetchJson(`${API_BASE}/api/pricing-bundle?method=CAP-AL`),
                fetchJson(`${API_BASE}/api/caps/catalog`),
            ]);
            S.config.shipFlat = shipFlat;
            S.config.shipFreeOver = shipFreeOver;
            if (!capAl || !Array.isArray(capAl.tiersR) || !capAl.tiersR.length) {
                throw new Error('Back-logo (CAP-AL) pricing returned no tiers');
            }
            S.capAlBundle = capAl;

            S.gallery.items = groupCatalog(catalog);
            if (!S.gallery.items.length) throw new Error('The cap catalog returned no active styles');

            $('gallery-loading').hidden = true;
            renderGallery();
            wireEverything();

            if (new URLSearchParams(location.search).get('canceled')) {
                toast('Your order is saved — ready when you are.', 'success');
            }

            // Resume a saved session (style must still be in the catalog)
            const snap = readSnapshot();
            if (snap && snap.styleNumber && S.gallery.items.some((g) => g.style === snap.styleNumber)) {
                await loadProduct(snap.styleNumber, snap.logos && snap.logos.previewColor);
                restoreSession(snap);
                enterStudio({ scroll: false });
            }

            // Dev/QA hook (localhost only): Preview-driven tests reach state
            // + quote directly.
            if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
                window.__CAPS = { S, quote: currentQuote, perCapAt, colorOf, selectProduct, buildCheckoutPayload };
            }
        } catch (e) {
            console.error('[Caps] Boot failed:', e);
            fatal('We couldn’t load live pricing or the cap lineup (' + e.message + ').');
        }
    }

    // /api/caps/catalog rows (one per style+hero color) → gallery items.
    function groupCatalog(rows) {
        const list = Array.isArray(rows) ? rows : ((rows && (rows.records || rows.data)) || []);
        const byStyle = new Map();
        list.forEach((r) => {
            if (!r || r.is_active === false) return;
            const style = String(r.style || '').trim().toUpperCase();
            if (!style) return;
            if (!byStyle.has(style)) {
                byStyle.set(style, {
                    style,
                    rank: Number(r.style_rank) || 999,
                    title: r.product_title || style,
                    brand: r.brand || '',
                    role: r.role || '',
                    colors: [],
                });
            }
            if (r.catalog_color) {
                byStyle.get(style).colors.push({
                    catalogColor: r.catalog_color,
                    colorName: r.color_name || r.catalog_color,
                    rank: Number(r.color_rank) || 999,
                });
            }
        });
        const items = Array.from(byStyle.values()).filter((it) => it.colors.length);
        items.forEach((it) => it.colors.sort((a, b) => a.rank - b.rank));
        items.sort((a, b) => a.rank - b.rank);
        return items;
    }

    // Per-style assets: CAP bundle (prices) + product-details (images),
    // fetched once and cached. Throws on bundle failure — callers decide
    // whether that's a card-level retry chip or a fatal.
    function loadStyleAssets(style) {
        const hit = styleCache.get(style);
        if (hit && hit.promise) return hit.promise;
        const enc = encodeURIComponent(style);
        const promise = (async () => {
            const [bundle, details] = await Promise.all([
                fetchJson(`${API_BASE}/api/pricing-bundle?method=CAP&styleNumber=${enc}`),
                fetchJson(`${API_BASE}/api/product-details?styleNumber=${enc}`).catch((e) => {
                    console.warn(`[Caps] product-details failed for ${style} (images degrade):`, e.message);
                    return [];
                }),
            ]);
            if (!bundle || !Array.isArray(bundle.tiersR) || !bundle.tiersR.length) {
                throw new Error(`No cap pricing tiers for ${style}`);
            }
            const rows = Array.isArray(details) ? details : ((details && details.result) || []);
            const detailsByColor = new Map();
            rows.forEach((r) => {
                if (r && r.CATALOG_COLOR && !detailsByColor.has(r.CATALOG_COLOR)) {
                    detailsByColor.set(r.CATALOG_COLOR, r);
                }
            });
            const value = { bundle, detailsByColor };
            styleCache.set(style, { promise: Promise.resolve(value), value });
            return value;
        })();
        styleCache.set(style, { promise });
        promise.catch(() => styleCache.delete(style));   // failed loads retry cleanly
        return promise;
    }

    // ── Step 1: cap gallery ─────────────────────────────────────────
    function renderGallery() {
        const grid = $('gallery-grid');
        grid.innerHTML = S.gallery.items.map((it) => `
            <article class="gallery-card" role="button" tabindex="0"
                     data-style="${escapeHTML(it.style)}"
                     aria-label="Customize ${escapeHTML(it.title)}">
                <div class="gallery-card-hero" id="card-hero-${escapeHTML(it.style)}">
                    <i class="fas fa-hat-cowboy" aria-hidden="true"></i>
                </div>
                <div class="gallery-card-body">
                    ${it.brand ? `<small class="gallery-card-brand">${escapeHTML(it.brand)}</small>` : ''}
                    <strong class="gallery-card-name">${escapeHTML(it.title)}</strong>
                    <small class="gallery-card-role">${escapeHTML(it.role)}</small>
                    <small class="gallery-card-colors">${it.colors.length} stocked color${it.colors.length === 1 ? '' : 's'}</small>
                    <div class="gallery-card-foot">
                        <span class="gallery-card-price" id="card-price-${escapeHTML(it.style)}"><span class="skel">$00 /cap</span></span>
                        <span class="gallery-card-cta">Customize <i class="fas fa-arrow-right" aria-hidden="true"></i></span>
                    </div>
                </div>
            </article>`).join('');

        grid.querySelectorAll('.gallery-card').forEach((card) => {
            card.addEventListener('click', () => selectProduct(card.dataset.style));
            card.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    selectProduct(card.dataset.style);
                }
            });
        });

        S.gallery.items.forEach((it) => hydrateGalleryCard(it));
    }

    // Live image + "from $X /cap at 72+" per card. Price failure = visible
    // per-card retry chip — the card never shows a guessed number.
    function hydrateGalleryCard(it) {
        loadStyleAssets(it.style).then(({ bundle, detailsByColor }) => {
            const heroColor = it.colors[0];
            const row = heroColor ? detailsByColor.get(heroColor.catalogColor) : null;
            const img = row && (row.FRONT_MODEL || row.FRONT_FLAT || row.PRODUCT_IMAGE);
            if (img) {
                $(`card-hero-${it.style}`).innerHTML =
                    `<img src="${escapeHTML(img)}" alt="${escapeHTML(it.title)} — ${escapeHTML(heroColor.colorName)}" loading="lazy">`;
            }
            const tiers = (bundle.tiersR || []).filter((t) => !parseFloat(t.LTM_Fee || 0));
            const top = tiers.slice().sort((a, b) => b.MinQuantity - a.MinQuantity)[0];
            const u = CAPSPricing.unitPrice(bundle, top.MinQuantity);
            const el = $(`card-price-${it.style}`);
            el.classList.remove('is-error');
            el.innerHTML = `from <strong>${moneyTrim(u.perCap)}</strong> /cap <small>at ${top.MinQuantity}+</small>`;
        }).catch((e) => {
            console.error(`[Caps] Live price unavailable for ${it.style}:`, e);
            const el = $(`card-price-${it.style}`);
            el.classList.add('is-error');
            el.textContent = 'Live price unavailable — tap to retry';
            el.onclick = (ev) => { ev.stopPropagation(); el.innerHTML = '<span class="skel">$00 /cap</span>'; hydrateGalleryCard(it); };
        });
    }

    // ── Product selection + per-style loads ─────────────────────────
    let productLoading = false;

    async function selectProduct(styleNumber, preferColor) {
        if (productLoading || !styleNumber) return;
        if (S.boot.ready && S.styleNumber === styleNumber) {
            enterStudio();
            return;
        }
        productLoading = true;
        const grid = $('gallery-grid');
        grid.classList.add('is-busy');
        try {
            await loadProduct(styleNumber, preferColor);
            enterStudio();
            persistSoon();
        } catch (e) {
            console.error('[Caps] Product load failed:', e);
            fatal(`We couldn’t load live pricing or stock for ${styleNumber} (` + e.message + ')');
        } finally {
            productLoading = false;
            grid.classList.remove('is-busy');
        }
    }

    async function loadProduct(styleNumber, preferColor) {
        const item = S.gallery.items.find((g) => g.style === styleNumber);
        if (!item) throw new Error(`${styleNumber} is not in the cap catalog`);

        const [{ bundle, detailsByColor }] = await Promise.all([
            loadStyleAssets(styleNumber),
            loadInventory(styleNumber),
        ]);

        const styleChanged = S.styleNumber !== styleNumber;
        S.styleNumber = styleNumber;
        S.capBundle = bundle;
        S.product.title = item.title;
        S.product.brand = item.brand;
        S.product.role = item.role;

        // Curated hero colors (Caspio catalog = the whitelist) joined to
        // SanMar imagery — CATALOG_COLOR keys both. Colors the image feed
        // doesn't know are dropped (render the intersection — a swatchless,
        // photo-less color sells nothing and risks a mis-key).
        S.product.colors = item.colors.map((c) => {
            const r = detailsByColor.get(c.catalogColor);
            if (!r) return null;
            return {
                catalogColor: c.catalogColor,
                colorName: r.COLOR_NAME || c.colorName,
                swatchImage: r.COLOR_SQUARE_IMAGE || '',
                images: {
                    frontModel: r.FRONT_MODEL || r.PRODUCT_IMAGE || '',
                    frontFlat: r.FRONT_FLAT || '',
                    backFlat: r.BACK_FLAT || '',
                },
            };
        }).filter(Boolean);
        if (!S.product.colors.length) throw new Error(`No displayable colors for ${styleNumber}`);

        if (styleChanged) {
            S.cart.lines = [];
            S.ui.celebratedTier = false;
        }
        const pick = (preferColor && S.product.colors.find((c) => c.catalogColor === preferColor))
            || S.product.colors[0];
        S.logos.previewColor = pick.catalogColor;

        renderCurrentProduct();
    }

    function enterStudio(opts) {
        S.boot.ready = true;
        $('studio').hidden = false;
        $('order-bar').hidden = false;
        syncDeliveryUI();
        renderStage2();
        renderLogoControls();
        renderAll();
        if (!opts || opts.scroll !== false) {
            document.querySelector('#stage-logos').scrollIntoView({ behavior: 'smooth' });
        }
    }

    function renderCurrentProduct() {
        $('current-product-name').textContent = S.product.title || S.styleNumber || '—';
        $('current-product-style').textContent = S.styleNumber
            ? `Style ${S.styleNumber} · ${S.product.colors.length} stocked colors · one size fits most`
            : '';
    }

    function backToGallery() {
        document.querySelector('#stage-gallery').scrollIntoView({ behavior: 'smooth' });
    }

    // ── Inventory (live SanMar, aggregated by CATALOG_COLOR) ────────
    // Cap feeds carry STALE SIZED partIds (XL/SM rows at 0 qty next to the
    // real OSFA rows) — never compare per size. Fail-OPEN like the tees
    // SanMar path: a dead feed means untracked quantities here, and the
    // server-side stock gate re-confirms every color at order time.
    async function loadInventory(style, bustCache) {
        const bust = bustCache ? `?t=${Date.now()}` : '';
        try {
            const j = await fetchJson(`${API_BASE}/api/sanmar/inventory/${encodeURIComponent(style)}` + bust);
            const byColor = {};
            ((j && j.inventory) || []).forEach((p) => {
                if (!p || !p.color) return;
                const k = String(p.color).toUpperCase();
                byColor[k] = (byColor[k] || 0) + (parseInt(p.totalQty, 10) || 0);
            });
            if (!Object.keys(byColor).length) throw new Error('stock feed returned no rows');
            S.inventory = { byColor, fetchedAt: Date.now(), error: false, tracked: true };
        } catch (e) {
            console.warn(`[Caps] Live stock unavailable for ${style} (fail-open, server gate re-checks):`, e.message);
            S.inventory = { byColor: {}, fetchedAt: 0, error: true, tracked: false };
        }
    }

    function colorTracked(catalogColor) {
        return S.inventory.tracked
            && Object.prototype.hasOwnProperty.call(S.inventory.byColor, String(catalogColor).toUpperCase());
    }

    function stockFor(catalogColor) {
        if (!colorTracked(catalogColor)) return 9999;   // untracked — no client gating
        return Math.max(0, S.inventory.byColor[String(catalogColor).toUpperCase()] || 0);
    }

    async function refreshInventory() {
        if (!S.styleNumber) return;
        await loadInventory(S.styleNumber, true);
        renderStage2();
        renderAll();
    }

    // ── Logos ───────────────────────────────────────────────────────
    async function handleLogoFile(slotKey, file) {
        if (!file) return;
        if (!ALL_EXTS.test(file.name)) {
            toast(`We can’t use .${file.name.split('.').pop()} files. PNG, JPG, SVG, AI, EPS, PDF, PSD or TIFF.`, 'error');
            return;
        }
        if (file.size > MAX_BYTES) {
            toast('That file is over 20 MB — email it to sales@nwcustomapparel.com and we’ll take it from there.', 'error');
            return;
        }
        const previewable = RASTER_EXTS.test(file.name) || SVG_EXT.test(file.name);
        const slot = {
            file, fileName: file.name, mime: file.type || '',
            previewable, isVector: SVG_EXT.test(file.name),
            thumbUrl: null, uploaded: null, warnings: [],
        };
        if (previewable) {
            try {
                slot.thumbUrl = await new Promise((resolve, reject) => {
                    const fr = new FileReader();
                    fr.onload = () => resolve(fr.result);
                    fr.onerror = () => reject(new Error('preview failed'));
                    fr.readAsDataURL(file);
                });
            } catch (_) { slot.previewable = false; }
        }
        if (slotKey === 'back' && !S.logos.backEnabled) {
            S.logos.backEnabled = true;
            $('back-toggle').checked = true;
        }
        S.logos[slotKey] = slot;
        renderLogoControls();
        renderAll();
        persistSoon();
    }

    function removeLogo(slotKey) {
        const prev = S.logos[slotKey];
        if (!prev) return;
        S.logos[slotKey] = null;
        renderLogoControls();
        renderAll();
        persistSoon();
        toast(`Removed ${prev.fileName}`, null, {
            label: 'Undo',
            fn() {
                S.logos[slotKey] = prev;
                renderLogoControls();
                renderAll();
                persistSoon();
            },
        });
    }

    function renderLogoSlotUi(slotKey) {
        const slot = S.logos[slotKey];
        $(`${slotKey}-drop`).hidden = !!slot;
        $(`${slotKey}-file`).hidden = !slot;
        const warnEl = $(`${slotKey}-warning`);
        if (slot) {
            $(`${slotKey}-file-name`).textContent = slot.fileName;
            $(`${slotKey}-file-size`).textContent = slot.file
                ? (slot.file.size / 1024 / 1024).toFixed(1) + ' MB'
                : 'restored — re-attach to change';
            const thumb = $(`${slotKey}-file-thumb`);
            if (slot.thumbUrl) {
                thumb.style.backgroundImage = `url("${slot.thumbUrl}")`;
                thumb.textContent = '';
            } else if (slot.uploaded && slot.previewable) {
                thumb.style.backgroundImage = `url("${slot.uploaded.hostedUrl}")`;
                thumb.textContent = '';
            } else {
                thumb.style.backgroundImage = '';
                thumb.textContent = ((slot.fileName || 'ART').split('.').pop() || 'ART').toUpperCase();
            }
            if (!slot.previewable) {
                warnEl.textContent = 'Browsers can’t preview this file type — no problem. Our digitizers open the original, and your emailed proof shows exactly how it will stitch before we start.';
                warnEl.classList.add('is-info');
                warnEl.hidden = false;
            } else {
                warnEl.hidden = true;
            }
        } else {
            warnEl.hidden = true;
        }
    }

    function renderLogoControls() {
        renderLogoSlotUi('front');
        $('back-upload-block').hidden = !S.logos.backEnabled;
        if (S.logos.backEnabled) renderLogoSlotUi('back');
        renderProofPanel();
        renderBackDelta();
    }

    // Side-by-side proof panel: cap photo (preview color) + logo thumbs.
    function renderProofPanel() {
        const c = S.logos.previewColor ? colorOf(S.logos.previewColor) : null;
        const img = c && (c.images.frontModel || c.images.frontFlat);
        $('proof-cap-img').hidden = !img;
        $('proof-cap-placeholder').hidden = !!img;
        if (img) {
            const el = $('proof-cap-img');
            el.src = img;
            el.alt = `${S.product.title} — ${c.colorName}`;
        }
        const colorTag = $('proof-cap-color');
        colorTag.hidden = !c;
        if (c) colorTag.textContent = c.colorName;

        ['front', 'back'].forEach((k) => {
            const slot = S.logos[k];
            const thumb = $(`proof-${k}-thumb`);
            const empty = $(`proof-${k}-empty`);
            const wrap = $(`proof-${k}-slot`);
            const src = slot && (slot.thumbUrl || (slot.uploaded && slot.previewable && slot.uploaded.hostedUrl));
            if (slot) {
                wrap.classList.add('has-art');
                if (src) {
                    thumb.style.backgroundImage = `url("${src}")`;
                    thumb.textContent = '';
                } else {
                    thumb.style.backgroundImage = '';
                    thumb.textContent = ((slot.fileName || 'ART').split('.').pop() || 'ART').toUpperCase();
                }
                thumb.hidden = false;
                empty.hidden = true;
            } else {
                wrap.classList.remove('has-art');
                thumb.hidden = true;
                empty.hidden = false;
            }
        });
        $('proof-back-slot').hidden = !S.logos.backEnabled;
    }

    // Live back-logo add-on price ("+$4.75/cap at your quantity") — straight
    // from the CAP-AL bundle, never a literal.
    function renderBackDelta() {
        const el = $('back-delta');
        try {
            const q = Math.max(combinedQty(), minQty());
            const back = CAPSPricing.backLogoPerCap(S.capAlBundle, q);
            el.textContent = `+${money(back)}/cap at your quantity — priced live, drops as you add caps`;
        } catch (_) {
            el.textContent = 'priced per cap by quantity';
        }
    }

    // ── Stage 3: colors + quantities ────────────────────────────────
    function renderStage2() {
        renderColorChips();
        renderColorCards();
        $('inventory-error').hidden = !S.inventory.error;
        $('inventory-stamp').textContent = S.inventory.tracked && S.inventory.fetchedAt
            ? `Live supplier stock · updated ${new Date(S.inventory.fetchedAt).toLocaleTimeString()}`
            : '';
    }

    function renderColorChips() {
        const wrap = $('color-chips');
        wrap.innerHTML = '';
        S.product.colors.forEach((c) => {
            const inCart = S.cart.lines.some((l) => l.catalogColor === c.catalogColor);
            const tracked = colorTracked(c.catalogColor);
            const total = tracked ? stockFor(c.catalogColor) : null;
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'color-chip' + (inCart ? ' is-active' : '');
            let stockHtml = '';
            if (tracked) {
                const cls = total <= 0 ? 'is-out' : total <= 48 ? 'is-low' : '';
                const txt = total <= 0 ? 'Out of stock' : total <= 48 ? `${total} left` : 'In stock';
                stockHtml = `<span class="chip-stock ${cls}">${txt}</span>`;
            }
            btn.innerHTML =
                `<span class="chip-swatch" style="background-image:url('${escapeHTML(c.swatchImage)}')"></span>` +
                `<span>${escapeHTML(c.colorName)}</span>` +
                stockHtml;
            btn.setAttribute('aria-pressed', String(inCart));
            btn.setAttribute('aria-label', `${inCart ? 'Remove' : 'Add'} ${c.colorName}`);
            btn.addEventListener('click', () => toggleColor(c.catalogColor));
            wrap.appendChild(btn);
        });
    }

    function toggleColor(catalogColor) {
        const i = S.cart.lines.findIndex((l) => l.catalogColor === catalogColor);
        if (i >= 0) {
            const removed = S.cart.lines.splice(i, 1)[0];
            renderStage2(); renderAll(); persistSoon();
            if (removed.quantity > 0) {
                toast(`Removed ${colorOf(catalogColor).colorName} (${removed.quantity} caps)`, null, {
                    label: 'Undo',
                    fn() { S.cart.lines.splice(i, 0, removed); renderStage2(); renderAll(); persistSoon(); },
                });
            }
        } else {
            // First color starts at 24 caps (volume-tier default); extra
            // colors start at 0 so the combined qty never jumps unseen.
            // Stock-capped — never offer more than the live feed has.
            const start = S.cart.lines.length === 0
                ? Math.min(DEFAULT_FIRST_QTY, stockFor(catalogColor))
                : 0;
            S.cart.lines.push({ catalogColor, quantity: start });
            S.logos.previewColor = catalogColor;
            renderProofPanel();
            renderStage2(); renderAll(); persistSoon();
        }
    }

    function renderColorCards() {
        const wrap = $('color-cards');
        wrap.innerHTML = '';
        S.cart.lines.forEach((line) => {
            const c = colorOf(line.catalogColor);
            const tracked = colorTracked(line.catalogColor);
            const stock = stockFor(line.catalogColor);
            const card = document.createElement('div');
            card.className = 'color-card';
            let stockNote = '';
            if (tracked) {
                const cls = stock <= 0 ? 'is-out' : stock <= 48 ? 'is-low' : '';
                const txt = stock <= 0 ? 'Out of stock' : stock <= 48 ? `Only ${stock} left` : `${stock.toLocaleString('en-US')} in stock`;
                stockNote = `<small class="${cls}">${txt}</small>`;
            }
            card.innerHTML = `
                <span class="chip-swatch" style="background-image:url('${escapeHTML(c.swatchImage)}')"></span>
                <span class="color-card-name">${escapeHTML(c.colorName)}${stockNote}</span>
                <div class="stepper">
                    <button type="button" data-color="${escapeHTML(line.catalogColor)}" data-d="-1" aria-label="Fewer ${escapeHTML(c.colorName)} caps" ${line.quantity <= 0 ? 'disabled' : ''}>−</button>
                    <input type="text" inputmode="numeric" value="${line.quantity}" data-color="${escapeHTML(line.catalogColor)}" aria-label="${escapeHTML(c.colorName)} cap quantity" ${stock <= 0 ? 'disabled' : ''}>
                    <button type="button" data-color="${escapeHTML(line.catalogColor)}" data-d="1" aria-label="More ${escapeHTML(c.colorName)} caps" ${line.quantity >= stock ? 'disabled' : ''}>+</button>
                </div>
                <button type="button" class="color-card-remove" data-remove="${escapeHTML(line.catalogColor)}" aria-label="Remove ${escapeHTML(c.colorName)}"><i class="fas fa-times"></i></button>`;
            wrap.appendChild(card);
        });

        wrap.querySelectorAll('.stepper button').forEach((b) => {
            b.addEventListener('click', () => {
                const line = S.cart.lines.find((l) => l.catalogColor === b.dataset.color);
                if (line) setQty(b.dataset.color, line.quantity + parseInt(b.dataset.d, 10));
            });
        });
        wrap.querySelectorAll('.stepper input').forEach((inp) => {
            inp.addEventListener('focus', () => inp.select());
            inp.addEventListener('change', () => setQty(inp.dataset.color, parseInt(inp.value, 10) || 0));
        });
        wrap.querySelectorAll('[data-remove]').forEach((b) => {
            b.addEventListener('click', () => toggleColor(b.dataset.remove));
        });
    }

    function setQty(catalogColor, q) {
        const l = S.cart.lines.find((x) => x.catalogColor === catalogColor);
        if (!l) return;
        const stock = stockFor(catalogColor);
        let v = Math.max(0, q | 0);
        if (v > stock) {
            v = stock;
            toast(`Only ${stock} ${colorOf(catalogColor).colorName} caps left in stock`, 'error');
        }
        l.quantity = v;
        renderColorCards();
        renderAll();
        persistSoon();
    }

    // ── Tier ladder (8-23 / 24-47 / 48-71 / 72+, API tiers) ─────────
    function renderLadder(q) {
        const card = $('ladder-card');
        if (!S.capBundle) { card.hidden = true; return; }
        card.hidden = false;
        const combined = combinedQty();
        const tiers = (S.capBundle.tiersR || [])
            .filter((t) => !parseFloat(t.LTM_Fee || 0))
            .sort((a, b) => a.MinQuantity - b.MinQuantity);
        const activeLabel = q && q.tierLabel ? q.tierLabel : null;

        let rows = '';
        let ladderOk = true;
        tiers.forEach((t) => {
            let priceTxt;
            try {
                priceTxt = moneyTrim(perCapAt(t.MinQuantity).perCap) + '/cap';
            } catch (e) {
                ladderOk = false;
                priceTxt = '—';
            }
            const isActive = activeLabel === t.TierLabel;
            const label = t.MaxQuantity >= 99999 ? `${t.MinQuantity}+` : `${t.MinQuantity}–${t.MaxQuantity}`;
            rows += `<tr class="${isActive ? 'is-active' : ''}">
                <td>${escapeHTML(label)} caps${isActive ? '<span class="tier-you">← you</span>' : ''}</td>
                <td>${escapeHTML(priceTxt)}</td>
            </tr>`;
        });
        $('tier-ladder').innerHTML =
            '<thead><tr><th scope="col">Quantity</th><th scope="col">Price</th></tr></thead><tbody>' + rows + '</tbody>';
        $('ladder-foot').textContent = ladderOk
            ? (S.logos.backEnabled
                ? 'Includes your embroidered front logo + the back logo add-on. Free setup.'
                : 'Includes your embroidered front logo. Free setup, always.')
            : 'Live pricing unavailable — refresh to reload.';

        // One computed nudge sentence (next tier savings)
        const el = $('nudge-line');
        el.textContent = '';
        if (q && combined > 0) {
            const next = tiers.find((t) => t.MinQuantity > combined);
            if (next) {
                try {
                    const here = perCapAt(combined).perCap;
                    const there = perCapAt(next.MinQuantity).perCap;
                    if (there < here) {
                        el.textContent = `Add ${next.MinQuantity - combined} more → ${moneyTrim(there)}/cap (save ${money(here - there)} each)`;
                    }
                } catch (_) { /* nudge is optional */ }
            } else {
                try {
                    el.textContent = `${moneyTrim(perCapAt(combined).perCap)}/cap — best price`;
                } catch (_) { /* optional */ }
            }
            if (!S.ui.celebratedTier && tiers.length > 1 && combined >= tiers[1].MinQuantity) {
                S.ui.celebratedTier = true;
            }
        }
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
            console.error('[Caps] Tax lookup failed:', e);
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
    function shipPromiseCopy() {
        return S.delivery.method === 'pickup'
            ? 'Ready for pickup 7–10 business days after you approve your proof — 2025 Freeman Rd E, Milton, WA 98354'
            : 'Ships free, 7–10 business days after you approve your proof — from Milton, WA';
    }

    function renderReview(q) {
        const lines = $('review-lines');
        const totals = $('review-totals');
        const logosEl = $('review-logos');

        // Logo thumbs restated in the review
        const logoFig = (k, label) => {
            const slot = S.logos[k];
            if (!slot) return '';
            const src = slot.thumbUrl || (slot.uploaded && slot.previewable && slot.uploaded.hostedUrl);
            const inner = src
                ? `<span class="proof-logo-thumb" style="background-image:url('${escapeHTML(src)}')"></span>`
                : `<span class="proof-logo-thumb">${escapeHTML(((slot.fileName || 'ART').split('.').pop() || 'ART').toUpperCase())}</span>`;
            return `<div class="review-logo">${inner}<small>${escapeHTML(label)}</small></div>`;
        };
        logosEl.innerHTML = logoFig('front', 'Front logo') + (S.logos.backEnabled ? logoFig('back', 'Back logo') : '');

        if (!q || q.belowMin || !q.lines || !q.lines.length) {
            lines.innerHTML = q && q.belowMin
                ? `<p class="review-empty">Custom Hats orders have a ${q.belowMin.minQuantity}-cap minimum — add ${q.belowMin.minQuantity - q.belowMin.quantity} more cap${q.belowMin.minQuantity - q.belowMin.quantity === 1 ? '' : 's'} above.</p>`
                : '<p class="review-empty">Add your logo and quantities above — your full order appears here before you pay.</p>';
            totals.innerHTML = '';
            $('review-promise').textContent = '';
            $('review-ack').hidden = true;
            return;
        }

        lines.innerHTML = '<table><thead><tr><th>Color</th><th>Qty</th><th>Each</th><th>Total</th></tr></thead><tbody>' +
            q.lines.map((l) =>
                `<tr><td>${escapeHTML(l.colorName)}</td><td>${l.quantity}</td>` +
                `<td>${money(l.unitPrice)}</td><td>${money(l.extended)}</td></tr>`).join('') +
            '</tbody></table>';

        totals.innerHTML = buildTotalsHtml(q);
        $('review-promise').innerHTML =
            `<i class="fas ${S.delivery.method === 'pickup' ? 'fa-store' : 'fa-truck-fast'}"></i> ` +
            escapeHTML(shipPromiseCopy());

        const ackEl = $('review-ack');
        const acks = [];
        ['front', 'back'].forEach((k) => {
            const s = S.logos[k];
            if (s && !s.previewable) {
                acks.push(`Your ${k} file (${escapeHTML(s.fileName)}) can’t preview in the browser — your emailed proof shows exactly how it stitches before we start.`);
            }
        });
        ackEl.innerHTML = acks.join('<br>');
        ackEl.hidden = !acks.length;
    }

    function buildTotalsHtml(q) {
        let h = `<div class="tot-row"><span>Caps (${q.combinedQty}) — front logo included</span><span>${money(q.capsSubtotal)}</span></div>`;
        h += `<div class="tot-row is-included"><span>Logo setup &amp; digitizing</span><span>FREE ✓</span></div>`;
        if (q.backLogo) {
            h += `<div class="tot-row is-included"><span>Back logo add-on (+${money(q.backLogoPerCap)}/cap)</span><span>included in price ✓</span></div>`;
        }
        const shipLabel = S.delivery.method === 'pickup' ? 'Pickup — Milton, WA' : 'Shipping';
        const shipValue = (S.delivery.method === 'pickup' || q.shipping === 0) ? 'FREE' : money(q.shipping);
        h += `<div class="tot-row"><span>${escapeHTML(shipLabel)}</span><span>${shipValue}</span></div>`;
        if (q.taxRate === null && S.delivery.method === 'ship') {
            h += `<div class="tot-row"><span>Sales tax</span><span>enter address</span></div>`;
        } else {
            h += `<div class="tot-row"><span>Sales tax${q.taxRate ? ` (${ratePct(q.taxRate)}%)` : ''}</span><span>${money(q.tax)}</span></div>`;
        }
        h += `<div class="tot-row is-grand"><span>Total</span><span>${money(q.total)}</span></div>`;
        return h;
    }

    // ── Gates + smart CTA ───────────────────────────────────────────
    function validEmail(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e || ''); }

    function gateReasons(q) {
        const reasons = [];
        if (!S.logos.front) reasons.push({ label: 'Add your front logo', target: '#stage-logos', act: () => $('front-input').click() });
        if (S.logos.backEnabled && !S.logos.back) reasons.push({ label: 'Add back logo art (or turn off the back logo)', target: '#stage-logos' });

        const combined = combinedQty();
        if (!combined) {
            reasons.push({ label: 'Add quantities', target: '#stage-colors' });
        } else if (q && q.belowMin) {
            const add = q.belowMin.minQuantity - q.belowMin.quantity;
            reasons.push({ label: `8-cap minimum — add ${add} more`, target: '#stage-colors' });
        }

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
            }
        } else if (S.delivery.tax.rate === null) {
            reasons.push({ label: S.delivery.tax.error ? 'Tax lookup failed — retry' : 'Confirming sales tax…', target: '#stage-checkout' });
        }
        if (!S.rightsAck) {
            reasons.push({ label: 'Confirm you have rights to your logo', target: '#review-card', act: () => $('rights-ack').focus() });
        }
        return reasons;
    }

    function renderAll() {
        if (!S.boot.ready || !S.capBundle) return;
        const q = currentQuote();
        if (q === null) return;   // fatal already shown
        renderBarWith(q);
        renderLadder(q.belowMin ? null : q);
        renderReview(q);
        renderTaxStamp();
        renderBackDelta();

        // 8-cap minimum — inline error (decision #9)
        const minAlert = $('min-alert');
        if (q.belowMin) {
            const add = q.belowMin.minQuantity - q.belowMin.quantity;
            minAlert.textContent = `Custom Hats orders have an ${q.belowMin.minQuantity}-cap minimum — you have ${q.belowMin.quantity}. Add ${add} more cap${add === 1 ? '' : 's'} (mix colors if you like).`;
            minAlert.hidden = false;
        } else {
            minAlert.hidden = true;
        }

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
        pay.disabled = reasons.length > 0 || S.checkout.running || !!q.belowMin;
        $('pay-btn-label').textContent = (reasons.length || q.belowMin)
            ? 'Pay'
            : `Pay ${money(q.total)} — proof in 2–3 days`;
    }

    let lastQuote = null;
    function renderBarWith(q) {
        lastQuote = q;
        const combined = combinedQty();
        const minNote = $('bar-min-note');
        if (q && q.belowMin) {
            $('bar-total').textContent = '—';
            $('bar-meta').textContent = `${combined} cap${combined === 1 ? '' : 's'}`;
            minNote.hidden = false;
            minNote.textContent = `8-cap minimum — add ${q.belowMin.minQuantity - q.belowMin.quantity} more`;
        } else if (q && q.combinedQty) {
            $('bar-total').textContent = money(q.total);
            $('bar-meta').textContent = `${q.combinedQty} cap${q.combinedQty === 1 ? '' : 's'} · proof in 2–3 days`;
            minNote.hidden = true;
        } else {
            $('bar-total').textContent = '$0.00';
            minNote.hidden = true;
            try {
                const from = perCapAt(DEFAULT_FIRST_QTY).perCap;
                $('bar-meta').textContent = `From ${moneyTrim(from)}/cap at ${DEFAULT_FIRST_QTY}+ caps`;
            } catch (_) {
                $('bar-meta').textContent = 'Front logo + setup included';
            }
        }

        // Smart CTA — always names the first incomplete thing
        const cta = $('smart-cta');
        if (!S.logos.front) {
            cta.textContent = 'Upload your logo';
            cta.onclick = () => { document.querySelector('#stage-logos').scrollIntoView({ behavior: 'smooth' }); setTimeout(() => $('front-input').click(), 350); };
        } else if (!combined || (q && q.belowMin)) {
            cta.textContent = (q && q.belowMin) ? 'Add more caps (8 min)' : 'Next: pick quantities';
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

    // ── Summary sheet ───────────────────────────────────────────────
    function openSheet() {
        const q = lastQuote || currentQuote();
        if (!q) return;
        const hasLines = q.lines && q.lines.length;
        $('sheet-lines').innerHTML = hasLines
            ? '<div class="review-lines"><table><tbody>' + q.lines.map((l) =>
                `<tr><td>${escapeHTML(l.colorName)}</td><td>×${l.quantity}</td><td style="text-align:right">${money(l.extended)}</td></tr>`).join('') +
              '</tbody></table></div>'
            : `<p class="review-empty">${q.belowMin ? 'Below the 8-cap minimum — add more caps.' : 'Nothing yet — add your logo and quantities.'}</p>`;
        $('sheet-totals').innerHTML = hasLines ? '<div class="review-totals">' + buildTotalsHtml(q) + '</div>' : '';
        $('sheet-promise').textContent = hasLines ? shipPromiseCopy() : '';
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
        if (!q0 || q0.belowMin) return;
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
            // ① Stock recheck (fresh, cache-busted), aggregated by
            // CATALOG_COLOR. Fail-OPEN — the server gate re-confirms every
            // color at session-create, so a recheck hiccup never blocks here.
            plStep(1);
            if (S.inventory.tracked || S.inventory.error) {
                await loadInventory(S.styleNumber, true);
            }
            if (S.inventory.tracked) {
                const conflicts = [];
                S.cart.lines.forEach((l) => {
                    if (!colorTracked(l.catalogColor)) return;
                    const have = stockFor(l.catalogColor);
                    if (l.quantity > have) {
                        conflicts.push({ catalogColor: l.catalogColor, size: 'OSFA', want: l.quantity, have });
                    }
                });
                if (conflicts.length) {
                    closePipeline();
                    showConflicts(conflicts);
                    return;
                }
            }
            if (cancelled) return;

            // ② Upload logos (originals only — no client mockups on caps;
            // the digitized proof is the visual record, decision #11)
            plStep(2);
            const up = window.ArtworkUpload && window.ArtworkUpload.uploadOne
                ? window.ArtworkUpload.uploadOne : uploadFallback;
            for (const k of ['front', 'back']) {
                const slot = S.logos[k];
                if (!slot) continue;
                if (k === 'back' && !S.logos.backEnabled) continue;
                if (!slot.uploaded) {
                    if (!slot.file) throw new Error(`Please re-attach your ${k} logo file (it didn’t survive the page reload)`);
                    slot.uploaded = await up(slot.file);
                }
            }
            if (cancelled) return;

            // ③+④ Save + Stripe session (server reprices authoritatively —
            // the orderTotals we send are advisory, validated to 1 cent)
            plStep(3);
            const payload = buildCheckoutPayload();
            plStep(4);
            const resp = await fetch('/api/create-checkout-session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const j = await resp.json().catch(() => ({}));
            // Server-confirmed shortage (the gate re-fetched fresh stock
            // before declaring it) — reuse the conflict modal.
            if (resp.status === 409 && j.code === 'STOCK_CONFLICT' && Array.isArray(j.conflicts) && j.conflicts.length) {
                closePipeline();
                showConflicts(j.conflicts);
                return;
            }
            // 409 without a code = PRICING_CHANGED (server repriced to a
            // different total) — visible, with the server's own message.
            if (!resp.ok || !j.url) {
                throw new Error(j.error || j.message || 'Checkout could not be created');
            }
            if (cancelled) return;
            suppressUnloadGuard = true;   // Stripe redirect must not trip the guard
            persistNow();
            window.location.href = j.url;
        } catch (e) {
            console.error('[Caps] Checkout pipeline failed:', e);
            plStep(4, 'is-error');
            fail(e.message);
            S.checkout.running = false;
        }
    }

    // Minimal uploader (same proxy files API the tees flow uses)
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
            `<div class="conflict-row">${escapeHTML(colorOf(c.catalogColor).colorName)}: you want ${c.want}, ` +
            `<strong>only ${c.have} left</strong> → we’ll set it to ${c.have}.</div>`).join('');
        $('conflict-backdrop').hidden = false;
        $('conflict-apply').onclick = () => {
            conflicts.forEach((c) => {
                const l = S.cart.lines.find((x) => x.catalogColor === c.catalogColor);
                if (l) l.quantity = c.have;
            });
            $('conflict-backdrop').hidden = true;
            renderStage2(); renderAll(); persistSoon();
            // Re-run only if the fixed cart still clears every gate (the
            // 8-cap minimum may now block — renderAll just surfaced it).
            const q = currentQuote();
            if (q && !q.belowMin && !gateReasons(q).length) runCheckout();
        };
        $('conflict-close').onclick = () => { $('conflict-backdrop').hidden = true; renderStage2(); renderAll(); };
    }

    // The EXACT shape rebuildCapsQuote + the shared checkout route consume:
    // colorConfigs[CATALOG_COLOR].sizeBreakdown.OSFA.quantity (sizeWhitelist
    // is ['OSFA']), orderSettings.{channel,styleNumber,backLogo,rightsAck},
    // customerData.deliveryMethod/address for the DOR tax lookup, and
    // orderTotals.grandTotal validated server-side to 1 cent.
    function buildCheckoutPayload() {
        const q = currentQuote();
        if (!q || q.belowMin) throw new Error('Order is below the 8-cap minimum');

        const colorConfigs = {};
        S.cart.lines.forEach((l) => {
            if (!l.quantity) return;
            colorConfigs[l.catalogColor] = {
                catalogColor: l.catalogColor,                       // CATALOG_COLOR — API/ShopWorks key
                displayColor: colorOf(l.catalogColor).colorName,    // COLOR_NAME — display only
                totalQuantity: l.quantity,
                sizeBreakdown: {
                    OSFA: { quantity: l.quantity, unitPrice: q.unitBySize.OSFA.finalPrice },
                },
            };
        });

        const back = S.logos.backEnabled && S.logos.back ? S.logos.back : null;
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
            orderTotals: {                                  // advisory — server reprices to 1 cent
                totalQuantity: q.combinedQty,
                subtotal: q.capsSubtotal,
                rushFee: 0,                                 // no rush on caps v1
                ltmFee: 0,                                  // NO LTM on this channel, ever (8-cap min)
                shipping: q.shipping,
                shippingSource: S.delivery.method === 'pickup' ? 'pickup'
                    : (q.shipping === 0 ? 'free-threshold' : 'flat'),
                salesTax: q.tax,
                taxRate: q.taxRate,
                taxableBase: q.taxableBase,
                taxAccount: S.delivery.tax.account,
                taxAccountName: S.delivery.tax.accountName,
                grandTotal: q.total,
            },
            orderSettings: {
                channel: 'custom-caps',                     // selects rebuildCapsQuote on the server
                styleNumber: S.styleNumber,
                productTitle: S.product.title,
                rush: false,                                // server 400s a doctored rush flag
                frontLocation: 'CF',                        // → 'Cap Front' via swLocationMap at push
                backLocation: back ? 'CB' : null,           // → 'Cap Back'
                printLocationCode: back ? 'CF_CB' : 'CF',
                printLocationName: back ? 'Cap Front + Cap Back' : 'Cap Front',
                frontLogo: S.logos.front && S.logos.front.uploaded
                    ? { fileUrl: S.logos.front.uploaded.hostedUrl, fileName: S.logos.front.uploaded.fileName } : null,
                // The server's backLogo PRICING flag keys on this object
                // (fileUrl present ⇒ priced) — never on a client price.
                backLogo: back && back.uploaded
                    ? { fileUrl: back.uploaded.hostedUrl, fileName: back.uploaded.fileName } : null,
                backLogoPerCap: q.backLogoPerCap,           // advisory audit trail
                mockups: [],                                // no client mockups — proof-first channel
                needsArtReview: true,                       // server forces this ON regardless
                // Fresh attestation every session — never persisted
                rightsAck: S.rightsAck ? { checked: true, ts: new Date().toISOString() } : null,
            },
        };
    }

    // ── Persistence (caps_studio_v1, 24h TTL) ───────────────────────
    function snapshot() {
        const slotLite = (s) => s ? {
            fileName: s.fileName, previewable: s.previewable, isVector: s.isVector,
            uploaded: s.uploaded,
        } : null;
        return {
            v: 1, ts: Date.now(),
            styleNumber: S.styleNumber,
            logos: {
                backEnabled: S.logos.backEnabled,
                previewColor: S.logos.previewColor,
                front: slotLite(S.logos.front),
                back: slotLite(S.logos.back),
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
        if (!snap || snap.v !== 1) return null;
        if (Date.now() - snap.ts > 24 * 3600 * 1000) return null;
        return snap;
    }

    function restoreSession(snap) {
        if (!snap || snap.styleNumber !== S.styleNumber) return;

        S.cart = snap.cart && Array.isArray(snap.cart.lines) ? snap.cart : S.cart;
        S.cart.lines = S.cart.lines.filter((l) =>
            S.product.colors.some((c) => c.catalogColor === l.catalogColor));
        Object.assign(S.customer, snap.customer || {});
        if (snap.delivery) {
            S.delivery.method = snap.delivery.method === 'pickup' ? 'pickup' : 'ship';
            Object.assign(S.delivery.address, snap.delivery.address || {});
            S.delivery.notes = snap.delivery.notes || '';
        }
        if (snap.logos) {
            S.logos.backEnabled = !!snap.logos.backEnabled;
            ['front', 'back'].forEach((k) => {
                const s = snap.logos[k];
                if (!s) return;
                S.logos[k] = Object.assign({ file: null, thumbUrl: null, mime: '', warnings: [] }, s);
            });
            if (snap.logos.previewColor && S.product.colors.some((c) => c.catalogColor === snap.logos.previewColor)) {
                S.logos.previewColor = snap.logos.previewColor;
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
        $('back-toggle').checked = S.logos.backEnabled;
        ($(S.delivery.method === 'pickup' ? 'd-pickup' : 'd-ship')).checked = true;
        syncDeliveryUI();
        renderLogoControls();
        if (S.delivery.method === 'pickup' || S.delivery.address.zip) lookupTax();

        if (S.cart.lines.length || S.logos.front) {
            toast('Your order is saved — ready when you are.', 'success');
        }
    }

    // ── beforeunload guard ──────────────────────────────────────────
    // Replicates the shared quote-builder-utils pattern locally (loading the
    // 1,000-line staff utils file on a customer page would drag builder
    // assumptions in). sessionStorage already restores everything EXCEPT raw
    // File objects — so the guard arms only while an un-uploaded logo file
    // would be lost, and disarms for the Stripe redirect.
    let suppressUnloadGuard = false;
    function hasUnsavedChanges() {
        if (suppressUnloadGuard) return false;
        return ['front', 'back'].some((k) => {
            const s = S.logos[k];
            return s && s.file && !s.uploaded;
        });
    }
    function setupBeforeUnloadGuard() {
        window.addEventListener('beforeunload', (e) => {
            try {
                if (hasUnsavedChanges()) {
                    e.preventDefault();
                    e.returnValue = '';   // required by Chromium to show the dialog
                }
            } catch (_) { /* never block navigation on a guard bug */ }
        });
    }

    // ── Wiring ──────────────────────────────────────────────────────
    function syncDeliveryUI() {
        const pickup = S.delivery.method === 'pickup';
        $('pickup-card').hidden = !pickup;
        $('address-fields').hidden = pickup;
    }

    function wireLogoSlot(slotKey) {
        const drop = $(`${slotKey}-drop`);
        const input = $(`${slotKey}-input`);
        drop.addEventListener('click', () => input.click());
        drop.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); }
        });
        ['dragover', 'dragleave', 'drop'].forEach((evt) => {
            drop.addEventListener(evt, (e) => {
                e.preventDefault();
                drop.classList.toggle('is-over', evt === 'dragover');
                if (evt === 'drop' && e.dataTransfer.files.length) handleLogoFile(slotKey, e.dataTransfer.files[0]);
            });
        });
        input.addEventListener('change', (e) => {
            if (e.target.files.length) handleLogoFile(slotKey, e.target.files[0]);
            e.target.value = '';
        });
        $(`${slotKey}-remove`).addEventListener('click', () => removeLogo(slotKey));
    }

    function wireEverything() {
        $('hero-cta').addEventListener('click', () => {
            document.querySelector('#stage-gallery').scrollIntoView({ behavior: 'smooth' });
        });
        $('caps-fatal-retry').addEventListener('click', () => location.reload());
        $('gallery-retry').addEventListener('click', () => location.reload());
        $('change-product').addEventListener('click', backToGallery);

        wireLogoSlot('front');
        wireLogoSlot('back');

        // Back-logo toggle — prices the add-on live; removing keeps Undo
        $('back-toggle').addEventListener('change', (e) => {
            if (!e.target.checked && S.logos.back) {
                const prevSlot = S.logos.back;
                S.logos.backEnabled = false;
                S.logos.back = null;
                toast(`Back logo off — removed ${prevSlot.fileName}`, null, {
                    label: 'Undo',
                    fn() {
                        S.logos.backEnabled = true;
                        S.logos.back = prevSlot;
                        $('back-toggle').checked = true;
                        renderLogoControls(); renderAll(); persistSoon();
                    },
                });
            } else {
                S.logos.backEnabled = e.target.checked;
            }
            renderLogoControls(); renderAll(); persistSoon();
        });

        // Rights attestation — gates Pay; never persisted
        $('rights-ack').addEventListener('change', (e) => {
            S.rightsAck = e.target.checked;
            renderAll();
        });

        $('inventory-retry').addEventListener('click', refreshInventory);

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
        // Editing the destination IMMEDIATELY invalidates the old tax rate —
        // all four fields (WA destination rates are street-level).
        const invalidateTaxThenLookup = () => {
            S.delivery.tax.rate = null;
            S.delivery.tax.error = false;
            lookupTax();
        };
        bind('f-addr1', S.delivery.address, 'address1', invalidateTaxThenLookup);
        bind('f-city', S.delivery.address, 'city', invalidateTaxThenLookup);
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
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !$('summary-sheet').hidden) closeSheet();
        });

        // Pay
        $('pay-btn').addEventListener('click', runCheckout);

        setupBeforeUnloadGuard();

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
