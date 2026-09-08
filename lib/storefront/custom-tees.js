// Storefront custom-tees: one cache/state owner per application instance.
module.exports = function create(ctx) {
    const { CTS_PRICING, STOREFRONT_CHANNEL_CONFIG, TDT_PROXY, TDT_SIZES, fetch, resolveTdtTax } =
        ctx;

    // ── Custom T-Shirts: per-style config + reprice (2026-06-10) ────────────────
    // Multi-style DTG storefront. Pricing parity contract: a customer ordering N
    // pieces of style X at /custom-tees pays EXACTLY what the internal DTG quote
    // builder computes for the same inputs (tiers/costs/upcharges from the same
    // per-style pricing-bundle; LTM = the builder's distributed floor math, which
    // lives inside CTS_PRICING). Rush is OPT-IN (+3DT-RUSH %) and only on
    // whitelisted rush-eligible styles. All fail-closed — never a guessed price.

    // 3-Day Rush launch scope — single source is the channel registry (the page's
    // window.CTS_RUSH_ELIGIBLE in custom-tees-app.js must be kept in sync; the
    // deferred catalog-admin rush_eligible-column plan replaces both).
    const CTS_RUSH_ELIGIBLE = new Set(
        STOREFRONT_CHANNEL_CONFIG.CHANNELS['custom-tees'].rushEligible
    );

    // Service codes are STYLE-INDEPENDENT, so they get their own shared 5-min
    // promise-memo (2026-06-12): the per-style config previously re-fetched the
    // same 5 codes for every style — the gallery's 20-style reference pricing
    // burst-fired ~100 identical calls and the proxy 429'd. Staleness is
    // UNCHANGED (each style's config already cached the codes 5 min); failures
    // evict immediately so a transient error never sticks, and a missing/
    // inactive row still throws (fail-closed, Erik's #1 rule).
    const _ctsCodeCache = new Map();

    // code → { at, promise }
    function getCtsServiceCode(c) {
        const hit = _ctsCodeCache.get(c);
        if (hit && Date.now() - hit.at < 5 * 60 * 1000) return hit.promise;
        const promise = (async () => {
            const r = await fetch(`${TDT_PROXY}/api/service-codes?code=${c}`);
            if (!r.ok) throw new Error(`HTTP ${r.status} from ${TDT_PROXY}/api/service-codes`);
            const j = await r.json();
            const row = j && j.data && j.data[0];
            if (!row || !row.IsActive || !(parseFloat(row.SellPrice) >= 0)) {
                throw new Error(`Service code ${c} missing/inactive in Caspio`);
            }
            return parseFloat(row.SellPrice);
        })();
        _ctsCodeCache.set(c, { at: Date.now(), promise });
        promise.catch(() => _ctsCodeCache.delete(c));
        return promise;
    }

    // Per-style SALE (2026-06-12, Erik): Caspio code CTS-SALE-{STYLE} → $/shirt
    // off, strike-through on the gallery card. OPTIONAL — unlike fees, a sale is
    // safe to miss: absent/inactive row OR a fetch error → 0 (customer pays the
    // REGULAR price, never less). Erik runs/stops sales in Caspio, zero deploys.
    // ALL sales load in ONE ?category= call (5-min promise-memo) — a per-style
    // ?code= lookup ×20 styles re-created the burst that 429'd the proxy earlier.
    let _ctsSalesCache = { at: 0, promise: null };

    function getCtsSalesMap() {
        if (_ctsSalesCache.promise && Date.now() - _ctsSalesCache.at < 5 * 60 * 1000) {
            return _ctsSalesCache.promise;
        }
        const promise = (async () => {
            const r = await fetch(
                `${TDT_PROXY}/api/service-codes?category=${encodeURIComponent('Custom Tees')}`
            );
            if (!r.ok) throw new Error(`HTTP ${r.status} from service-codes?category`);
            const j = await r.json();
            const map = new Map();
            ((j && j.data) || []).forEach((row) => {
                const m = /^CTS-SALE-(.+)$/.exec(String(row.ServiceCode || ''));
                const off = parseFloat(row.SellPrice);
                if (m && row.IsActive && off > 0) map.set(m[1].toUpperCase(), off);
            });
            return map;
        })();
        _ctsSalesCache = { at: Date.now(), promise };
        promise.catch(() => {
            _ctsSalesCache = { at: 0, promise: null };
        });
        return promise;
    }

    async function getCtsSaleOff(style) {
        try {
            const map = await getCtsSalesMap();
            return map.get(String(style || '').toUpperCase()) || 0;
        } catch (e) {
            console.warn(
                `[CTS] sale lookup failed for ${style} (selling at regular price):`,
                e.message
            );
            return 0;
        }
    }

    const _ctsCfgCache = new Map();

    // styleNumber → { at, value }
    async function getCtsPricingConfig(styleNumber) {
        const style = String(styleNumber || '')
            .trim()
            .toUpperCase();
        if (!/^[A-Z0-9_-]{2,20}$/.test(style))
            throw new Error(`Invalid style number: ${styleNumber}`);
        const hit = _ctsCfgCache.get(style);
        if (hit && Date.now() - hit.at < 5 * 60 * 1000) return hit.value;

        const grab = async (url) => {
            const r = await fetch(url);
            if (!r.ok) throw new Error(`HTTP ${r.status} from ${url.split('?')[0]}`);
            return r.json();
        };
        const code = getCtsServiceCode;

        const [pricingData, rushPct, shipFee, shipFlat, shipFreeOver, saleOff] = await Promise.all([
            // method=DTG_Store — retail storefront's own tiers/margin/LTM (DecorationMethod=
            // 'DTG_Store' in Pricing_Tiers; reuses DTG print costs). Decoupled from wholesale
            // DTG. MUST match the client fetch (custom-tees-app.js) or the reprice would 409.
            grab(
                `${TDT_PROXY}/api/pricing-bundle?method=DTG_Store&styleNumber=${encodeURIComponent(style)}`
            ),
            code('3DT-RUSH'),
            code('3DT-SHIP'),
            // Small-batch fee now lives on the DTG_Store tier rows (LTM_Fee $25 on the
            // 1-11/12-23 tiers); the legacy CTS-LTM service-code override was retired
            // 2026-06-22, so we no longer load it here.
            // UberPrints shipping model (Erik 2026-06-10): flat under the threshold,
            // FREE at/over it. Both Caspio-tunable, both fail-closed via code().
            code('CTS-SHIP-FLAT'),
            code('CTS-SHIP-FREE-OVER'),
            // Per-style sale — OPTIONAL (0 when absent; errors → 0, regular price).
            getCtsSaleOff(style),
        ]);
        if (!Array.isArray(pricingData.tiersR) || !pricingData.tiersR.length) {
            throw new Error(`No DTG pricing tiers for style ${style}`);
        }
        // Per-style size whitelist comes from the SERVER-fetched bundle (load-bearing:
        // an unknown client size key must never inflate the tier while pricing $0).
        const sizes = (pricingData.sizes || []).map((s) => s.size).filter(Boolean);
        // LTM threshold (label use only — the FEE math lives on the tier rows inside
        // CTS_PRICING) = first non-LTM tier's MinQuantity, same as the TDT loader.
        const nonLtm = (pricingData.tiersR || [])
            .filter((t) => !parseFloat(t.LTM_Fee || 0))
            .sort((a, b) => a.MinQuantity - b.MinQuantity);
        if (!nonLtm.length)
            throw new Error(`DTG pricing tiers for ${style} missing a non-LTM tier`);
        const value = {
            pricingData,
            config: {
                rushPct,
                shipFee,
                bakeLtm: true,
                shipFlat,
                shipFreeOver,
                saleOff,
                ltmThreshold: nonLtm[0].MinQuantity,
                sizes: sizes.length ? sizes : TDT_SIZES.slice(),
            },
        };
        _ctsCfgCache.set(style, { at: Date.now(), value });
        return value;
    }

    // Curated-catalog whitelist: customers may only order the ~20 DTG-tested top
    // sellers (same source the internal builder renders). Cached 1h; fail-closed.
    let _ctsCatalogCache = null;

    let _ctsCatalogAt = 0;

    async function getCtsCatalog() {
        if (_ctsCatalogCache && Date.now() - _ctsCatalogAt < 60 * 60 * 1000)
            return _ctsCatalogCache;
        // /styles is the aggregate list endpoint (the same one the gallery renders).
        const r = await fetch(`${TDT_PROXY}/api/dtg/top-sellers/styles`);
        if (!r.ok) throw new Error(`top-sellers fetch failed: HTTP ${r.status}`);
        const j = await r.json();
        const styles = Array.isArray(j) ? j : j.records || j.data || j.styles || [];
        if (!styles.length) throw new Error('top-sellers returned an empty catalog');
        const map = new Map();
        styles.forEach((s) => {
            const k = String(s.style || s.styleNumber || '').toUpperCase();
            if (k) map.set(k, s);
        });
        _ctsCatalogCache = map;
        _ctsCatalogAt = Date.now();
        return map;
    }

    // Per-style piece weight for the UPS estimate (PC54's getTdtShipMeta is the
    // single-style original; this one keys the SanMar lookup by style, 1h cache).
    const _ctsShipMetaCache = new Map();

    async function getCtsShipMeta(styleNumber) {
        const style = String(styleNumber || 'PC54').toUpperCase();
        const hit = _ctsShipMetaCache.get(style);
        if (hit && Date.now() - hit.at < 60 * 60 * 1000) return hit.value;
        let pieceWeightLb = 0.44; // tee-class default; refreshed from SanMar below
        let perBox = 58;
        try {
            const r = await fetch(`${TDT_PROXY}/api/shipping/box-density`);
            if (r.ok) {
                const j = await r.json();
                const v = parseInt(j && j.density && j.density['T-Shirt'], 10);
                if (v > 0) perBox = v;
            }
        } catch (e) {
            console.warn('[CTS ship] box-density fetch failed, using default 58:', e.message);
        }
        try {
            const r = await fetch(
                `${TDT_PROXY}/api/inventory?styleNumber=${encodeURIComponent(style)}`
            );
            if (r.ok) {
                const j = await r.json();
                const rows = Array.isArray(j) ? j : j.data || j.result || [];
                const w = parseFloat(
                    (rows.find((x) => parseFloat(x.PIECE_WEIGHT) > 0) || {}).PIECE_WEIGHT
                );
                if (w > 0) pieceWeightLb = w;
            }
        } catch (e) {
            console.warn(
                `[CTS ship] piece-weight fetch failed for ${style}, using default 0.44:`,
                e.message
            );
        }
        const value = { pieceWeightLb, perBox };
        _ctsShipMetaCache.set(style, { at: Date.now(), value });
        return value;
    }

    // → { amount, source } like resolveTdtShipping, but weight keyed to the style.
    async function resolveCtsShipping(toZip, qty, styleNumber) {
        const zip = String(toZip || '')
            .trim()
            .slice(0, 5);
        const pieces = Math.max(1, parseInt(qty, 10) || 1);
        if (/^\d{5}$/.test(zip)) {
            try {
                const meta = await getCtsShipMeta(styleNumber);
                const boxes = Math.max(1, Math.ceil(pieces / meta.perBox));
                const totalLb = pieces * meta.pieceWeightLb;
                const boxWeightsLb = Array.from(
                    { length: boxes },
                    () => Math.round((totalLb / boxes) * 100) / 100
                );
                const r = await fetch(`${TDT_PROXY}/api/shipping/estimate-ups-ground`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        toZip: zip,
                        weightLb: totalLb,
                        boxes,
                        boxWeightsLb,
                        residential: true,
                    }),
                });
                const j = r.ok ? await r.json() : null;
                const est = j && parseFloat(j.estimate);
                if (Number.isFinite(est) && est > 0) {
                    return {
                        amount: Math.round(est * 100) / 100,
                        source: 'ups-estimate',
                        detail: { boxes, weightLb: totalLb, zone: j.zone, residential: true },
                    };
                }
                console.warn(
                    '[CTS ship] estimator returned no usable estimate, falling back to flat'
                );
            } catch (e) {
                console.warn('[CTS ship] UPS estimate failed, falling back to flat:', e.message);
            }
        }
        const { config } = await getCtsPricingConfig(styleNumber || 'PC54');
        return { amount: config.shipFee, source: 'flat' };
    }

    // Rebuild the full Custom-Tees quote server-side (authoritative, like
    // rebuildTdtQuote but per-style + rush-aware). Returns the same shape plus
    // style/product metadata the checkout route stamps onto the order.
    async function rebuildCtsQuote(colorConfigs, orderSettings, customerData) {
        const styleRaw = orderSettings && orderSettings.styleNumber;
        const style = String(styleRaw || '')
            .trim()
            .toUpperCase();
        const catalog = await getCtsCatalog();
        if (!catalog.has(style)) {
            throw Object.assign(
                new Error(`Style ${styleRaw || '(none)'} is not in the Custom T-Shirts catalog`),
                { code: 'STYLE_NOT_ALLOWED' }
            );
        }
        const product = catalog.get(style);

        const rushRequested = !!(orderSettings && orderSettings.rush);
        if (rushRequested && !CTS_RUSH_ELIGIBLE.has(style)) {
            throw Object.assign(new Error(`3-Day Rush is not available for style ${style}`), {
                code: 'RUSH_NOT_ELIGIBLE',
            });
        }

        const { pricingData, config } = await getCtsPricingConfig(style);
        const tax = await resolveTdtTax(customerData);

        // FREE-PLACEMENT model (Erik 2026-06-10): the price tier derives from the
        // ART'S PRINTED SIZE. The server re-derives it from the submitted placement
        // dimensions (clamped to the 16×20 envelope) via the SAME pure rule the
        // browser uses — the client's location codes are advisory; a doctored
        // payload cannot buy jumbo art at the Left Chest rate.
        const clampDim = (v, max) => Math.min(Math.max(parseFloat(v) || 0, 0), max);
        const sideDims = (p) => {
            if (!p || !(parseFloat(p.wIn) > 0)) return null;
            const wIn = clampDim(p.wIn, 16);
            const hIn = clampDim(p.hIn || p.wIn, 20); // legacy payloads without hIn: assume square-ish
            return { wIn, hIn };
        };
        const fDims = sideDims(orderSettings?.placement?.front);
        const bDims = sideDims(orderSettings?.placement?.back);
        let frontLoc;
        let backLoc;
        if (fDims || bDims) {
            frontLoc = fDims ? CTS_PRICING.locationForArtSize('front', fDims.wIn, fDims.hIn) : null;
            backLoc = bDims ? CTS_PRICING.locationForArtSize('back', bDims.wIn, bDims.hIn) : null;
        } else {
            // Legacy fallback (pre-free-placement payloads): trust the explicit codes.
            const front = String(
                orderSettings?.frontLocation || orderSettings?.printLocationCode || 'LC'
            ).toUpperCase();
            frontLoc = ['LC', 'FF', 'JF'].includes(front.split('_')[0])
                ? front.split('_')[0]
                : 'LC';
            backLoc = orderSettings?.backLocation
                ? String(orderSettings.backLocation).toUpperCase()
                : null;
            if (!backLoc && /_FB/.test(front)) backLoc = 'FB';
            if (!backLoc && /_JB/.test(front)) backLoc = 'JB';
            if (backLoc && !['FB', 'JB'].includes(backLoc)) backLoc = null;
        }

        const sizes = config.sizes;
        const cart = Object.values(colorConfigs || {}).map((c) => {
            const qty = {};
            sizes.forEach((size) => {
                const sd = (c.sizeBreakdown || {})[size];
                const q = parseInt(sd && sd.quantity, 10) || 0;
                if (q > 0) qty[size] = q;
            });
            return {
                catalogColor: c.catalogColor,
                colorName: c.displayColor || c.catalogColor,
                qty,
            };
        });
        const method = customerData.deliveryMethod === 'pickup' ? 'pickup' : 'ship';

        // Shipping is the UberPrints threshold model since 2026-06-10: the pricing
        // module computes it from config.shipFlat/shipFreeOver vs the merchandise
        // subtotal — no per-ZIP UPS resolver in the CTS charge path anymore
        // (resolveCtsShipping stays for the legacy 3DT estimate endpoint).
        const quote = CTS_PRICING.quote({
            pricingData,
            config,
            cart,
            location: frontLoc,
            backLocation: backLoc,
            rush: rushRequested,
            delivery: { method, taxRate: tax.rate },
        });
        const shipResolved =
            method === 'pickup'
                ? { amount: 0, source: 'pickup' }
                : {
                      amount: quote.shipping,
                      source: quote.shipping > 0 ? 'flat-under-threshold' : 'free-over-threshold',
                  };
        return {
            quote,
            tax,
            config,
            shipping: shipResolved,
            style,
            rush: rushRequested,
            frontLocation: frontLoc,
            backLocation: backLoc,
            sizes,
            productName: product.product_title || product.name || `${style} Tee`,
        };
    }

    return { getCtsCatalog, getCtsPricingConfig, rebuildCtsQuote, resolveCtsShipping };
};
