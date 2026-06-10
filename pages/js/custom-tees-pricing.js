/**
 * custom-tees-pricing.js — PURE pricing engine for the Custom T-Shirts page.
 *
 * Cloned from 3-day-tees-pricing.js (2026-06-10) and converted to be
 * IDENTICAL to the internal DTG quote builder's math (Erik's decision):
 *
 *   • Rush is OPT-IN: standard orders price with NO rush markup; the
 *     3-Day Rush toggle applies config.rushPct (Service_Codes 3DT-RUSH, 25%)
 *     on top — same halfDollarCeil(base × (1+pct/100)) as 3DT used always.
 *   • LTM matches the DTG builder EXACTLY: when the matched tier carries an
 *     LTM_Fee (the 1-23 tier, $50), it is distributed per piece with
 *     floor((fee/qty)*100)/100 and the order LTM line = perPiece × qty
 *     (e.g. 12 pcs → $4.16/pc → $49.92 — NOT a flat $50, NOT 3DT's $75).
 *     A rep quoting 12 pcs in the internal builder and a customer
 *     self-serving 12 pcs see the SAME total.
 *   • Back print can be FB (12×16) or JB (16×20) — input.backLocation.
 *
 * The ONLY place Custom-Tees price math exists. The UI, the server reprice
 * (server.js), Stripe line items, and the saved order all call quote() with
 * the same inputs. No DOM, no fetch, no Date — jest-locked by
 * tests/unit/custom-tees-pricing.test.js.
 *
 * Formula (per-piece):
 *   tier        = tiersR row matching COMBINED qty across all colors
 *   markedUp    = min(sizes.price > 0) / tier.MarginDenominator
 *   printCost   = front location (LC/FF/JF) + back location (FB/JB) if on
 *                 — missing cost row after the LTM-tier fallback THROWS,
 *                 never a silent $0.
 *   base        = halfDollarCeil(markedUp + printCost)
 *   withRush    = rush ? halfDollarCeil(base × (1 + rushPct/100)) : base
 *   final       = withRush + sizeUpcharge          (upcharge AFTER rounding)
 *
 * Order math:
 *   ltmPerPiece = tier.LTM_Fee ? floor((LTM_Fee/qty)*100)/100 : 0
 *   ltmFee      = r2(ltmPerPiece × qty)
 *   shipping    = config.shipFee when delivery.method === 'ship', else 0
 *   tax         = (shirts + LTM + shipping) × rate — billable shipping joins
 *                 the WA tax base (platform ruling 2026-06-09).
 *
 * Config values (rushPct/shipFee) come from Caspio Service_Codes via
 * /api/service-codes; tiers/costs/upcharges/LTM_Fee come from the per-style
 * /api/pricing-bundle — never hardcode them here (Erik's pricing-is-API rule).
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
     * Price tier from the ART'S PRINTED SIZE (Erik 2026-06-10): customers
     * place/resize freely; the location code — and therefore the DTG print
     * cost — follows the size. Thresholds are the platen envelopes:
     *   front: ≤4×4 → LC · ≤12×16 → FF · else JF (envelope max 16×20)
     *   back:  ≤12×16 → FB · else JB (envelope max 16×20)
     * Used by BOTH the browser (live readout + quote) and the server reprice
     * (which re-derives from sanitized dimensions — client codes are advisory).
     */
    function locationForArtSize(side, wIn, hIn) {
        const w = parseFloat(wIn) || 0;
        const h = parseFloat(hIn) || 0;
        if (String(side) === 'back') {
            return (w <= 12 && h <= 16) ? 'FB' : 'JB';
        }
        if (w <= 4 && h <= 4) return 'LC';
        if (w <= 12 && h <= 16) return 'FF';
        return 'JF';
    }

    /** Normalize the back-print input: legacy backEnabled:true means 'FB'. */
    function resolveBackLocation(input) {
        if (input.backLocation === 'FB' || input.backLocation === 'JB') return input.backLocation;
        return input.backEnabled ? 'FB' : null;
    }

    /**
     * Per-piece price for one size at the given combined quantity.
     * location: 'LC' | 'FF' | 'JF'; backLocation: 'FB' | 'JB' | null.
     * rush: boolean — rush is OPT-IN; standard orders take no markup.
     * Throws PricingError when the bundle can't price it — callers surface
     * a visible error, never a $0.
     */
    function unitPrice(pricingData, config, combinedQty, location, backLocation, size, rush) {
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
        const back = (backLocation === 'FB' || backLocation === 'JB') ? backLocation
            : (backLocation === true ? 'FB' : null);   // tolerate legacy boolean
        // location may be NULL for a back-only design (free-placement model) —
        // then the front contributes no print cost. NO print at all is an error:
        // an undecorated shirt must never be silently priced as garment-only.
        if (!location && !back) {
            throw PricingError('No print on either side', 'NO_PRINT');
        }
        let print = location ? printCostFor(pricingData.allDtgCostsR, location, costLabel) : 0;
        if (back) print += printCostFor(pricingData.allDtgCostsR, back, costLabel);

        const base = halfDollarCeil(garment + print);
        let withRush = base;
        if (rush) {
            const rushPct = parseFloat(config && config.rushPct);
            if (!(rushPct >= 0)) throw PricingError('Rush percent not loaded', 'NO_RUSH_PCT');
            withRush = halfDollarCeil(base * (1 + rushPct / 100));
        }
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
     *   pricingData: per-style /api/pricing-bundle?method=DTG response,
     *   config: { rushPct, shipFee, sizes: ['S',...] },
     *   cart: [{ catalogColor, colorName, qty: { S: 2, ... } }],
     *   location: 'LC' | 'FF' | 'JF',
     *   backLocation: 'FB' | 'JB' | null   (backEnabled:true tolerated → 'FB'),
     *   rush: bool — 3-Day Rush opt-in (default false = standard 7-10 day),
     *   delivery: { method: 'ship'|'pickup', taxRate: decimal|null },
     * }
     */
    function quote(input) {
        const cfg = input.config || {};
        const sizes = cfg.sizes || ['S', 'M', 'L', 'XL', '2XL', '3XL'];
        const cart = input.cart || [];
        const combinedQty = combinedQuantity(cart);
        const rush = !!input.rush;
        const backLocation = resolveBackLocation(input);

        const empty = combinedQty === 0;
        const unitBySize = {};
        let tierLabel = null;
        let matchedTier = null;
        if (!empty) {
            sizes.forEach((size) => {
                unitBySize[size] = unitPrice(
                    input.pricingData, cfg, combinedQty, input.location, backLocation, size, rush
                );
            });
            tierLabel = unitBySize[sizes[0]].tierLabel;
            matchedTier = findTier(input.pricingData.tiersR, combinedQty);
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

        // LTM — EXACT internal-DTG-builder math: the matched tier's LTM_Fee
        // (the 1-23 tier carries $50) distributed per piece with floor-to-cent,
        // order line = perPiece × qty (12 pcs → 4.16/pc → $49.92). The fee and
        // its threshold live on the TIER ROW (per-style bundle), not in
        // Service_Codes — one source shared with the internal builder.
        const tierLtmFee = matchedTier ? parseFloat(matchedTier.LTM_Fee || 0) : 0;
        const ltmPerPiece = (!empty && tierLtmFee > 0)
            ? Math.floor((tierLtmFee / combinedQty) * 100) / 100 : 0;
        const ltmFee = r2(ltmPerPiece * combinedQty);

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
            ltmPerPiece: ltmPerPiece,
            rush: rush,
            backLocation: backLocation,
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
        const rush = !!input.rush;
        const backLocation = resolveBackLocation(input);

        const here = unitPrice(input.pricingData, input.config, combinedQty,
            input.location, backLocation, refSize, rush);
        const there = unitPrice(input.pricingData, input.config, next.MinQuantity,
            input.location, backLocation, refSize, rush);

        // LTM threshold/fee from the TIER ROWS (same source as the order math).
        const hereTier = findTier(input.pricingData.tiersR, combinedQty);
        const thereTier = findTier(input.pricingData.tiersR, next.MinQuantity);
        const hereLtmFee = hereTier ? parseFloat(hereTier.LTM_Fee || 0) : 0;
        const thereLtmFee = thereTier ? parseFloat(thereTier.LTM_Fee || 0) : 0;
        if (hereLtmFee > 0 && !(thereLtmFee > 0)) {
            // Crossing out of the small-batch fee: compare whole-order totals
            // at the M rate (approximation is exact when cart is all standard
            // sizes; close enough for a nudge either way). Distributed math.
            const ltm = r2((Math.floor((hereLtmFee / combinedQty) * 100) / 100) * combinedQty);
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
        locationForArtSize: locationForArtSize,
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = TDTPricing;
    }
    if (typeof global.window !== 'undefined' || typeof window !== 'undefined') {
        global.TDTPricing = TDTPricing;
    }
})(typeof window !== 'undefined' ? window : globalThis);
