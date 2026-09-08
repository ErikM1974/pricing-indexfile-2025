// Storefront three-day-tees: one cache/state owner per application instance.
module.exports = function create(ctx) {
    const { TDT_PRICING, TDT_PROXY, fetch, resolveTdtTax } = ctx;

    const TDT_SIZES = ['S', 'M', 'L', 'XL', '2XL', '3XL'];

    let _tdtCfgCache = null;

    let _tdtCfgAt = 0;

    async function getTdtPricingConfig() {
        if (_tdtCfgCache && Date.now() - _tdtCfgAt < 5 * 60 * 1000) return _tdtCfgCache;

        const grab = async (url) => {
            const r = await fetch(url);
            if (!r.ok) throw new Error(`HTTP ${r.status} from ${url.split('?')[0]}`);
            return r.json();
        };
        const code = async (c) => {
            const j = await grab(`${TDT_PROXY}/api/service-codes?code=${c}`);
            const row = j && j.data && j.data[0];
            if (!row || !row.IsActive || !(parseFloat(row.SellPrice) >= 0)) {
                throw new Error(`Service code ${c} missing/inactive in Caspio`);
            }
            return parseFloat(row.SellPrice);
        };

        const [pricingData, rushPct, ltmFee, shipFee] = await Promise.all([
            grab(`${TDT_PROXY}/api/pricing-bundle?method=DTG&styleNumber=PC54`),
            code('3DT-RUSH'),
            code('3DT-LTM'),
            code('3DT-SHIP'),
        ]);
        const nonLtm = (pricingData.tiersR || [])
            .filter((t) => !parseFloat(t.LTM_Fee || 0))
            .sort((a, b) => a.MinQuantity - b.MinQuantity);
        if (!nonLtm.length) throw new Error('DTG pricing tiers missing a non-LTM tier');

        _tdtCfgCache = {
            pricingData,
            config: {
                rushPct,
                ltmFee,
                shipFee,
                ltmThreshold: nonLtm[0].MinQuantity,
                sizes: TDT_SIZES,
            },
        };
        _tdtCfgAt = Date.now();
        return _tdtCfgCache;
    }

    // ── 3-Day Tees shipping: real UPS Ground estimate, flat-rate fallback ───────
    // Same estimator stack the EMB quote builder uses (negotiated-cost model,
    // proxy /api/shipping/estimate-ups-ground; box density from Caspio via
    // /api/shipping/box-density; PC54 piece weight from SanMar /api/inventory).
    // Lives ONLY here — the page asks this server for the number it displays
    // (POST /api/three-day-tees/shipping-estimate) and the reprice recomputes via
    // the same function, so the estimate shown and the amount charged can't drift.
    // Estimator failure falls back to the Caspio 3DT-SHIP flat rate (a defined
    // price, labeled "flat rate" — never a guess).
    let _tdtShipMetaCache = null;

    let _tdtShipMetaAt = 0;

    async function getTdtShipMeta() {
        if (_tdtShipMetaCache && Date.now() - _tdtShipMetaAt < 60 * 60 * 1000)
            return _tdtShipMetaCache;
        let pieceWeightLb = 0.44; // PC54 catalog weight; refreshed from SanMar below
        let perBox = 58; // T-Shirt density; refreshed from Caspio below
        try {
            const r = await fetch(`${TDT_PROXY}/api/shipping/box-density`);
            if (r.ok) {
                const j = await r.json();
                const v = parseInt(j && j.density && j.density['T-Shirt'], 10);
                if (v > 0) perBox = v;
            }
        } catch (e) {
            console.warn('[3DT ship] box-density fetch failed, using default 58:', e.message);
        }
        try {
            const r = await fetch(`${TDT_PROXY}/api/inventory?styleNumber=PC54`);
            if (r.ok) {
                const j = await r.json();
                const rows = Array.isArray(j) ? j : j.data || j.result || [];
                const w = parseFloat(
                    (rows.find((x) => parseFloat(x.PIECE_WEIGHT) > 0) || {}).PIECE_WEIGHT
                );
                if (w > 0) pieceWeightLb = w;
            }
        } catch (e) {
            console.warn('[3DT ship] piece-weight fetch failed, using default 0.44:', e.message);
        }
        _tdtShipMetaCache = { pieceWeightLb, perBox };
        _tdtShipMetaAt = Date.now();
        return _tdtShipMetaCache;
    }

    // → { amount, source: 'ups-estimate'|'flat', detail? }. Throws only if BOTH
    // the estimator and the 3DT-SHIP flat fallback are unavailable.
    async function resolveTdtShipping(toZip, qty) {
        const zip = String(toZip || '')
            .trim()
            .slice(0, 5);
        const pieces = Math.max(1, parseInt(qty, 10) || 1);
        if (/^\d{5}$/.test(zip)) {
            try {
                const meta = await getTdtShipMeta();
                const boxes = Math.max(1, Math.ceil(pieces / meta.perBox));
                const totalLb = pieces * meta.pieceWeightLb;
                const boxWeightsLb = Array.from(
                    { length: boxes },
                    () => Math.round((totalLb / boxes) * 100) / 100
                );
                const r = await fetch(`${TDT_PROXY}/api/shipping/estimate-ups-ground`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    // Residential ON: 3-Day Tees customers overwhelmingly ship to homes.
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
                    '[3DT ship] estimator returned no usable estimate, falling back to flat'
                );
            } catch (e) {
                console.warn('[3DT ship] UPS estimate failed, falling back to flat:', e.message);
            }
        }
        const { config } = await getTdtPricingConfig();
        return { amount: config.shipFee, source: 'flat' };
    }

    // Rebuild the full quote from the submitted cart using server-fetched config.
    async function rebuildTdtQuote(colorConfigs, orderSettings, customerData) {
        const { pricingData, config } = await getTdtPricingConfig();
        const tax = await resolveTdtTax(customerData);
        const locCode = String(orderSettings?.printLocationCode || 'LC');
        // Size whitelist is LOAD-BEARING: combinedQuantity counts EVERY qty key but
        // only whitelisted sizes get priced — a crafted unknown size key would
        // inflate the tier (cheaper rate / dropped LTM) while paying for nothing.
        const cart = Object.values(colorConfigs || {}).map((c) => {
            const qty = {};
            TDT_SIZES.forEach((size) => {
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

        // Real UPS Ground estimate replaces the flat fee for shipped orders
        // (2026-06-09, Erik). Falls back to the 3DT-SHIP flat rate internally.
        let shipResolved = { amount: 0, source: 'pickup' };
        if (method === 'ship') {
            shipResolved = await resolveTdtShipping(
                customerData.zip,
                TDT_PRICING.combinedQuantity(cart)
            );
        }

        const quote = TDT_PRICING.quote({
            pricingData,
            config: Object.assign({}, config, { shipFee: shipResolved.amount }),
            cart,
            location: locCode.indexOf('FF') === 0 ? 'FF' : 'LC',
            backEnabled: locCode.indexOf('_FB') !== -1,
            delivery: { method, taxRate: tax.rate },
        });
        return { quote, tax, config, shipping: shipResolved };
    }

    return { TDT_SIZES, rebuildTdtQuote, resolveTdtShipping };
};
