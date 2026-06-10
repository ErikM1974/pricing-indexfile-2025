/**
 * 3-day-tees-pricing.js — PURE pricing engine for the 3-Day Tees page.
 *
 * The ONLY place 3-Day Tees price math exists. The sticky bar, tier meter,
 * order summary, review panel, Stripe line items (server-side reprice in
 * server.js) and the saved quote all call quote() with the same inputs.
 * No DOM, no fetch, no Date — everything injected, so jest can lock it
 * (tests/unit/3dt-pricing.test.js) and server.js can require() it.
 *
 * Formula (parity with the legacy page + DTG flagship, verified 2026-06-09):
 *   tier        = tiersR row matching COMBINED qty across all colors
 *   markedUp    = min(sizes.price > 0) / tier.MarginDenominator
 *   printCost   = front location + FB when a back print is on
 *                 — cost rows looked up by tier label; when the matched tier
 *                 (the 1-23 LTM tier) has NO cost rows, fall back to the
 *                 LOWEST NON-LTM tier's rows (24-47), same as
 *                 dtg-pricing-service.js. A missing cost row after fallback
 *                 THROWS — never a silent $0 print cost (the legacy page bug
 *                 that under-charged every sub-24 cart by ~$8-19/shirt).
 *   base        = halfDollarCeil(markedUp + printCost)
 *   withRush    = halfDollarCeil(base × (1 + rushPct/100))
 *   final       = withRush + sizeUpcharge          (upcharge AFTER rounding)
 *
 * Order math:
 *   ltmFee   = config.ltmFee when 0 < combinedQty < config.ltmThreshold
 *   shipping = config.shipFee when delivery.method === 'ship', else 0
 *   tax      = (shirts + LTM + shipping) × rate — billable shipping joins the
 *              WA tax base per the platform-wide DTG-parity ruling 2026-06-09.
 *
 * Config values (rushPct/ltmFee/ltmThreshold/shipFee) come from Caspio
 * Service_Codes 3DT-RUSH / 3DT-LTM / 3DT-SHIP via /api/service-codes —
 * never hardcode them here (Erik's pricing-is-API rule).
 */
(function (global) {
    'use strict';

    /** Round UP to the next half dollar (e.g. 12.01 → 12.50, 12.50 → 12.50). */
    function halfDollarCeil(v) {
        return Math.ceil(v * 2) / 2;
    }

    /** Round to cents without float dust (12.499999 → 12.5). */
    function r2(v) {
        return Math.round((v + Number.EPSILON) * 100) / 100;
    }

    function PricingError(message, code) {
        const e = new Error(message);
        e.name = 'PricingError';
        e.code = code || 'PRICING_DATA';
        return e;
    }

    function findTier(tiersR, qty) {
        return (tiersR || []).find(
            (t) => qty >= t.MinQuantity && qty <= t.MaxQuantity
        ) || null;
    }

    /**
     * Tier label to use for DTG_Costs lookups. The 1-23 LTM tier has no rows
     * in the costs table; fall back to the lowest non-LTM tier (24-47) —
     * identical to dtg-pricing-service.js resolve logic.
     */
    function resolveCostLabel(tiersR, costs, tier) {
        const hasRows = (costs || []).some((c) => c.TierLabel === tier.TierLabel);
        if (hasRows) return tier.TierLabel;
        const nonLtm = (tiersR || [])
            .filter((t) => !parseFloat(t.LTM_Fee || 0))
            .sort((a, b) => a.MinQuantity - b.MinQuantity);
        if (nonLtm.length) return nonLtm[0].TierLabel;
        return tier.TierLabel;
    }

    function printCostFor(costs, locationCode, costLabel) {
        const row = (costs || []).find(
            (c) => c.PrintLocationCode === locationCode && c.TierLabel === costLabel
        );
        if (!row || !(parseFloat(row.PrintCost) > 0)) {
            throw PricingError(
                `No DTG print cost for location ${locationCode} at tier ${costLabel}`,
                'MISSING_PRINT_COST'
            );
        }
        return parseFloat(row.PrintCost);
    }

    /**
     * Per-piece price for one size at the given combined quantity.
     * location: 'LC' | 'FF'; backEnabled adds the FB print cost.
     * Throws PricingError when the bundle can't price it — callers surface
     * a visible error, never a $0.
     */
    function unitPrice(pricingData, config, combinedQty, location, backEnabled, size) {
        if (!pricingData || !Array.isArray(pricingData.tiersR) || !pricingData.tiersR.length) {
            throw PricingError('Pricing data not loaded', 'NO_PRICING_DATA');
        }
        const qty = Math.max(1, combinedQty | 0);
        const tier = findTier(pricingData.tiersR, qty);
        if (!tier) throw PricingError(`No pricing tier covers quantity ${qty}`, 'NO_TIER');
        if (!(parseFloat(tier.MarginDenominator) > 0)) {
            throw PricingError(`Tier ${tier.TierLabel} has no MarginDenominator`, 'NO_MARGIN');
        }

        const prices = (pricingData.sizes || [])
            .map((s) => parseFloat(s.price))
            .filter((p) => p > 0);
        if (!prices.length) throw PricingError('No garment cost in pricing data', 'NO_GARMENT');
        const garment = Math.min.apply(null, prices) / parseFloat(tier.MarginDenominator);

        const costLabel = resolveCostLabel(pricingData.tiersR, pricingData.allDtgCostsR, tier);
        let print = printCostFor(pricingData.allDtgCostsR, location, costLabel);
        if (backEnabled) print += printCostFor(pricingData.allDtgCostsR, 'FB', costLabel);

        const base = halfDollarCeil(garment + print);
        const rushPct = parseFloat(config && config.rushPct);
        if (!(rushPct >= 0)) throw PricingError('Rush percent not loaded', 'NO_RUSH_PCT');
        const withRush = halfDollarCeil(base * (1 + rushPct / 100));
        const upcharge = parseFloat((pricingData.sellingPriceDisplayAddOns || {})[size]) || 0;

        return {
            finalPrice: r2(withRush + upcharge),
            basePrice: base,
            rushFee: r2(withRush - base),
            upcharge: upcharge,
            tierLabel: tier.TierLabel,
            costLabel: costLabel,
        };
    }

    function combinedQuantity(cart) {
        let total = 0;
        (cart || []).forEach((line) => {
            Object.keys(line.qty || {}).forEach((size) => {
                total += Math.max(0, parseInt(line.qty[size], 10) || 0);
            });
        });
        return total;
    }

    /**
     * Full order quote. Returns every number the UI and the server reprice
     * need. Throws PricingError on unpriceable inputs (missing cost rows,
     * unloaded config) — never returns a guessed total.
     *
     * input = {
     *   pricingData: /api/pricing-bundle?method=DTG response,
     *   config: { rushPct, ltmFee, ltmThreshold, shipFee, sizes: ['S',...] },
     *   cart: [{ catalogColor, colorName, qty: { S: 2, ... } }],
     *   location: 'LC' | 'FF',
     *   backEnabled: bool,
     *   delivery: { method: 'ship'|'pickup', taxRate: decimal|null },
     * }
     */
    function quote(input) {
        const cfg = input.config || {};
        const sizes = cfg.sizes || ['S', 'M', 'L', 'XL', '2XL', '3XL'];
        const cart = input.cart || [];
        const combinedQty = combinedQuantity(cart);

        const empty = combinedQty === 0;
        const unitBySize = {};
        let tierLabel = null;
        if (!empty) {
            sizes.forEach((size) => {
                unitBySize[size] = unitPrice(
                    input.pricingData, cfg, combinedQty, input.location, !!input.backEnabled, size
                );
            });
            tierLabel = unitBySize[sizes[0]].tierLabel;
        }

        const lines = [];
        let shirtsSubtotal = 0;
        cart.forEach((line) => {
            sizes.forEach((size) => {
                const q = Math.max(0, parseInt((line.qty || {})[size], 10) || 0);
                if (!q) return;
                const u = unitBySize[size].finalPrice;
                const ext = r2(q * u);
                lines.push({
                    catalogColor: line.catalogColor,
                    colorName: line.colorName || line.catalogColor,
                    size: size,
                    quantity: q,
                    unitPrice: u,
                    extended: ext,
                });
                shirtsSubtotal = r2(shirtsSubtotal + ext);
            });
        });

        const ltmThreshold = parseInt(cfg.ltmThreshold, 10);
        const ltmFeeRate = parseFloat(cfg.ltmFee);
        if (!empty && (!(ltmThreshold > 0) || !(ltmFeeRate >= 0))) {
            throw PricingError('LTM config not loaded', 'NO_LTM_CONFIG');
        }
        const ltmFee = !empty && combinedQty < ltmThreshold ? r2(ltmFeeRate) : 0;

        const shipFee = parseFloat(cfg.shipFee);
        if (!empty && input.delivery && input.delivery.method === 'ship' && !(shipFee >= 0)) {
            throw PricingError('Shipping fee not loaded', 'NO_SHIP_FEE');
        }
        const shipping = !empty && input.delivery && input.delivery.method === 'ship'
            ? r2(shipFee) : 0;

        // Billable shipping joins the tax base (platform ruling 2026-06-09).
        const taxRate = input.delivery && Number.isFinite(parseFloat(input.delivery.taxRate))
            ? parseFloat(input.delivery.taxRate) : null;
        const taxableBase = r2(shirtsSubtotal + ltmFee + shipping);
        const tax = taxRate ? r2(taxableBase * taxRate) : 0;

        const total = r2(shirtsSubtotal + ltmFee + shipping + tax);

        return {
            combinedQty: combinedQty,
            tierLabel: tierLabel,
            unitBySize: unitBySize,
            lines: lines,
            shirtsSubtotal: shirtsSubtotal,
            ltmFee: ltmFee,
            shipping: shipping,
            taxRate: taxRate,
            taxableBase: taxableBase,
            tax: tax,
            total: total,
            perShirt: combinedQty ? r2((shirtsSubtotal + ltmFee) / combinedQty) : 0,
            nudge: empty ? null : buildNudge(input, combinedQty),
        };
    }

    /**
     * Tier-nudge data ("add N more → save $X"). Pure math, the UI turns it
     * into exactly one sentence. Compares REAL totals (so the LTM-drop case
     * is only claimed when literally true).
     */
    function buildNudge(input, combinedQty) {
        const tiers = (input.pricingData.tiersR || [])
            .slice()
            .sort((a, b) => a.MinQuantity - b.MinQuantity);
        const next = tiers.find((t) => t.MinQuantity > combinedQty);
        if (!next) return { type: 'best' };

        const addQty = next.MinQuantity - combinedQty;
        const refSize = (input.config.sizes || ['M'])[1] || 'M';

        const here = unitPrice(input.pricingData, input.config, combinedQty,
            input.location, !!input.backEnabled, refSize);
        const there = unitPrice(input.pricingData, input.config, next.MinQuantity,
            input.location, !!input.backEnabled, refSize);

        const ltmThreshold = parseInt(input.config.ltmThreshold, 10);
        if (combinedQty < ltmThreshold && next.MinQuantity >= ltmThreshold) {
            // Crossing out of the small-batch fee: compare whole-order totals
            // at the M rate (approximation is exact when cart is all standard
            // sizes; close enough for a nudge either way).
            const ltm = parseFloat(input.config.ltmFee) || 0;
            const hereTotal = r2(combinedQty * here.finalPrice + ltm);
            const thereTotal = r2(next.MinQuantity * there.finalPrice);
            if (thereTotal < hereTotal) {
                return {
                    type: 'ltm-drop-saves',
                    addQty: addQty,
                    hereQty: combinedQty,
                    hereTotal: hereTotal,
                    thereQty: next.MinQuantity,
                    thereTotal: thereTotal,
                    savings: r2(hereTotal - thereTotal),
                };
            }
            return { type: 'ltm-drop', addQty: addQty, ltmFee: ltm };
        }

        const perShirtSave = r2(here.finalPrice - there.finalPrice);
        if (perShirtSave <= 0) return { type: 'best' };
        return {
            type: 'tier-up',
            addQty: addQty,
            nextUnit: there.finalPrice,
            perShirtSave: perShirtSave,
        };
    }

    const TDTPricing = {
        quote: quote,
        unitPrice: unitPrice,
        combinedQuantity: combinedQuantity,
        halfDollarCeil: halfDollarCeil,
        findTier: findTier,
        resolveCostLabel: resolveCostLabel,
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = TDTPricing;
    }
    if (typeof global.window !== 'undefined' || typeof window !== 'undefined') {
        global.TDTPricing = TDTPricing;
    }
})(typeof window !== 'undefined' ? window : globalThis);
