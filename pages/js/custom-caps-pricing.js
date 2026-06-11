/**
 * custom-caps-pricing.js — PURE pricing engine for the Custom Hats storefront
 * ('custom-caps' channel).
 *
 * Written FRESH against the internal EMB quote builder's CAP contract
 * (embroidery-quote-pricing.js calculateCapProductPrice) — NOT adapted from
 * custom-tees-pricing.js. The two systems round and gate differently and
 * mixing them produces wrong-but-plausible prices:
 *
 *   DTG / tees: halfDollarCeil rounding, LTM tier gates at <24 pieces.
 *   EMB / caps: CeilDollar (round UP to the next whole dollar), LTM tier is
 *               1-7 caps — and this storefront has an 8-CAP MINIMUM (Erik
 *               decision #9, 2026-06-11), so the 1-7 tier is UNREACHABLE.
 *               There is NO LTM fee and NO digitizing/setup line anywhere
 *               (decision #10: free logo setup, always).
 *
 * Per-cap formula (front logo INCLUDED, ≤10K stitches priced at the 8,000-
 * stitch Embroidery_Costs row — customers never see stitch counts, Erik
 * decision #2):
 *
 *   tier    = capBundle.tiersR row matching the COMBINED cap qty (8-23 /
 *             24-47 / 48-71 / 72+; caps ALWAYS tier separately from garments)
 *   garment = blank OSFA price ÷ tier.MarginDenominator
 *   perCap  = ceilDollar(garment + EmbroideryCost(tier, 8000))   // CeilDollar
 *   + back  = CAP-AL tier price per cap when the back logo is on (flat tiered
 *             add-on, added AFTER the CeilDollar rounding — same as the EMB
 *             builder's separate AL-CAP line; NOT re-rounded)
 *
 * Order math:
 *   shipping = threshold model (Caspio CAPS-SHIP-FLAT + CAPS-SHIP-FREE-OVER):
 *              merchandise at/over the threshold ships FREE, under it pays
 *              the flat rate. No legacy flat-fee fallback — missing config
 *              THROWS (fail closed). NOTE: with the 8-cap minimum every order
 *              clears the launch $100 threshold, so shipping is effectively
 *              always free until Erik raises the threshold in Caspio.
 *   tax      = (merchandise + billable shipping) × rate   (WA destination
 *              rule, platform ruling 2026-06-09)
 *
 * Below-minimum input (qty < the lowest non-LTM tier's MinQuantity, i.e. 8)
 * throws a structured PricingError { code: 'BELOW_MINIMUM', minQuantity } —
 * NEVER a 1-7-tier price. Missing bundle/cost rows also throw — never a
 * fallback number (Erik's #1 rule).
 *
 * The ONLY place Custom-Caps price math exists. The page UI, the server
 * reprice (server.js rebuildCapsQuote), Stripe line items and the saved order
 * all call quote() with the same inputs. No DOM, no fetch, no Date —
 * jest-locked by tests/unit/custom-caps-pricing.test.js against the verified
 * 9-style lineup (memory/CUSTOMER_SITE_REDESIGN_2026-06.md).
 *
 * All numbers come from the APIs at runtime:
 *   capBundle   = /api/pricing-bundle?method=CAP&styleNumber=X
 *   capAlBundle = /api/pricing-bundle?method=CAP-AL
 *   config.shipFlat / shipFreeOver = Caspio Service_Codes CAPS-SHIP-FLAT /
 *     CAPS-SHIP-FREE-OVER (the FREE-OVER code's SellPrice holds the THRESHOLD
 *     dollars, not a price — same semantic trap as CTS-SHIP-FREE-OVER).
 */
(function (global) {
    'use strict';

    /** Stitch count the included front logo is priced at (Embroidery_Costs row). */
    var INCLUDED_STITCH_COUNT = 8000;

    /** Round to cents without float dust (29.999999 → 30). */
    function r2(v) {
        return Math.round((v + Number.EPSILON) * 100) / 100;
    }

    /**
     * CeilDollar — round UP to the next whole dollar (29.74 → 30, 26 → 26).
     * Cents-rounded first so IEEE dust on an exact dollar (e.g. 5.30/0.53+17
     * = 27.000000000000004) can't silently bill an extra dollar.
     */
    function ceilDollar(v) {
        return Math.ceil(r2(v));
    }

    function PricingError(message, code, extra) {
        var e = new Error(message);
        e.name = 'PricingError';
        e.code = code || 'PRICING_DATA';
        if (extra) Object.keys(extra).forEach(function (k) { e[k] = extra[k]; });
        return e;
    }

    function findTier(tiersR, qty) {
        return (tiersR || []).find(function (t) {
            return qty >= t.MinQuantity && qty <= t.MaxQuantity;
        }) || null;
    }

    /**
     * Store minimum = the lowest NON-LTM tier's MinQuantity (8 with today's
     * EmbroideryCaps tiers). API-derived on purpose: Erik retunes the tiers
     * in Caspio and the storefront minimum follows with no deploy.
     */
    function minOrderQuantity(tiersR) {
        var nonLtm = (tiersR || [])
            .filter(function (t) { return !(parseFloat(t.LTM_Fee || 0) > 0); })
            .sort(function (a, b) { return a.MinQuantity - b.MinQuantity; });
        if (!nonLtm.length) {
            throw PricingError('Cap pricing tiers have no non-LTM tier', 'NO_MIN_TIER');
        }
        return nonLtm[0].MinQuantity;
    }

    function requireBundle(capBundle) {
        if (!capBundle || !Array.isArray(capBundle.tiersR) || !capBundle.tiersR.length) {
            throw PricingError('Cap pricing data not loaded', 'NO_PRICING_DATA');
        }
    }

    /** The matched, validated, NON-LTM tier for qty — or a structured throw. */
    function resolveTier(tiersR, qty) {
        var minQty = minOrderQuantity(tiersR);
        var q = Math.max(0, qty | 0);
        if (q < minQty) {
            throw PricingError(
                'Custom Hats orders have a ' + minQty + '-cap minimum (you have ' + q + ')',
                'BELOW_MINIMUM',
                { minQuantity: minQty, quantity: q }
            );
        }
        var tier = findTier(tiersR, q);
        if (!tier) throw PricingError('No cap pricing tier covers quantity ' + q, 'NO_TIER');
        // Belt + suspenders: never price off an LTM tier even if tier data
        // shifts under us — the storefront has no LTM, ever.
        if (parseFloat(tier.LTM_Fee || 0) > 0) {
            throw PricingError(
                'Quantity ' + q + ' falls in the small-batch tier — below the store minimum',
                'BELOW_MINIMUM',
                { minQuantity: minQty, quantity: q }
            );
        }
        return tier;
    }

    /** Blank OSFA price from the bundle's sizes[] — OSFA-only store (v1). */
    function blankOsfaPrice(capBundle) {
        var row = (capBundle.sizes || []).find(function (s) {
            return String(s && s.size).trim().toUpperCase() === 'OSFA' && parseFloat(s.price) > 0;
        });
        if (!row) {
            throw PricingError(
                'No OSFA blank price in cap pricing data (fitted caps are not supported)',
                'NOT_OSFA'
            );
        }
        return parseFloat(row.price);
    }

    /**
     * Per-cap price with the front logo INCLUDED, at the given combined qty.
     * Returns { perCap, blankPrice, garmentCost, embCost, tierLabel,
     * marginDenominator, minQuantity }. Throws PricingError on any gap —
     * callers surface a visible error, never a guessed price.
     */
    function unitPrice(capBundle, qty) {
        requireBundle(capBundle);
        var tier = resolveTier(capBundle.tiersR, qty);
        var margin = parseFloat(tier.MarginDenominator);
        if (!(margin > 0)) {
            throw PricingError('Tier ' + tier.TierLabel + ' has no MarginDenominator', 'NO_MARGIN');
        }
        var blank = blankOsfaPrice(capBundle);
        var embRow = (capBundle.allEmbroideryCostsR || []).find(function (c) {
            return c && c.ItemType === 'Cap'
                && Number(c.StitchCount) === INCLUDED_STITCH_COUNT
                && c.TierLabel === tier.TierLabel;
        });
        var embCost = embRow ? parseFloat(embRow.EmbroideryCost) : NaN;
        if (!(embCost > 0)) {
            throw PricingError(
                'No cap embroidery cost for tier ' + tier.TierLabel + ' at ' + INCLUDED_STITCH_COUNT + ' stitches',
                'MISSING_EMB_COST'
            );
        }
        var garmentCost = blank / margin;
        return {
            perCap: ceilDollar(garmentCost + embCost),
            blankPrice: blank,
            garmentCost: r2(garmentCost),
            embCost: embCost,
            tierLabel: tier.TierLabel,
            marginDenominator: margin,
            minQuantity: minOrderQuantity(capBundle.tiersR),
        };
    }

    /**
     * Back-logo add-on per cap (flat tiered CAP-AL price; NOT re-rounded —
     * matches the EMB builder's separate AL-CAP line). Throws when the
     * CAP-AL bundle or its tier row is missing.
     */
    function backLogoPerCap(capAlBundle, qty) {
        if (!capAlBundle || !Array.isArray(capAlBundle.tiersR) || !capAlBundle.tiersR.length) {
            throw PricingError('Back-logo (CAP-AL) pricing data not loaded', 'NO_BACK_LOGO_DATA');
        }
        var tier = resolveTier(capAlBundle.tiersR, qty);
        // The builder accepts both ItemType spellings ('AL-CAP' preferred,
        // legacy 'AL' tolerated) — embroidery-quote-pricing.js 2026-02-01 fix.
        var rows = capAlBundle.allEmbroideryCostsR || [];
        var row = rows.find(function (c) { return c && c.ItemType === 'AL-CAP' && c.TierLabel === tier.TierLabel; })
            || rows.find(function (c) { return c && c.ItemType === 'AL' && c.TierLabel === tier.TierLabel; });
        var cost = row ? parseFloat(row.EmbroideryCost) : NaN;
        if (!(cost > 0)) {
            throw PricingError('No CAP-AL back-logo price for tier ' + tier.TierLabel, 'MISSING_BACK_LOGO_COST');
        }
        return r2(cost);
    }

    function combinedQuantity(cart) {
        var total = 0;
        (cart || []).forEach(function (line) {
            total += Math.max(0, parseInt(line && line.quantity, 10) || 0);
        });
        return total;
    }

    /**
     * Full order quote. Returns every number the UI and the server reprice
     * need. Throws PricingError on unpriceable inputs — never a guessed total.
     *
     * input = {
     *   capBundle:   /api/pricing-bundle?method=CAP&styleNumber=X response,
     *   capAlBundle: /api/pricing-bundle?method=CAP-AL response (required
     *                only when backLogo is on),
     *   config: { shipFlat, shipFreeOver },   // Caspio CAPS-SHIP-* codes
     *   cart: [{ catalogColor, colorName, quantity }],   // OSFA, one qty per color
     *   backLogo: bool,
     *   delivery: { method: 'ship'|'pickup', taxRate: decimal|null },
     * }
     *
     * Checkout-route compatibility: the shared /api/create-checkout-session
     * route reads unitBySize[size].finalPrice, lines, combinedQty,
     * shirtsSubtotal (kept as a route-compat alias of capsSubtotal), ltmFee
     * (always 0 here), shipping, tax, taxRate, taxableBase, total,
     * shipFreeOver — same shape contract as the tees module.
     */
    function quote(input) {
        var cfg = (input && input.config) || {};
        var cart = (input && input.cart) || [];
        var backLogo = !!(input && input.backLogo);
        var combinedQty = combinedQuantity(cart);

        var base = unitPrice(input && input.capBundle, combinedQty);
        var backPer = backLogo ? backLogoPerCap(input.capAlBundle, combinedQty) : 0;
        var perCap = r2(base.perCap + backPer);

        // One size (OSFA), one price — keyed like the tees unitBySize so the
        // shared checkout route prices cleanConfigs identically for caps.
        var unitBySize = {
            OSFA: {
                finalPrice: perCap,
                basePrice: base.perCap,        // front-logo-included, CeilDollar'd
                backLogoPerCap: backPer,
                upcharge: 0,
                tierLabel: base.tierLabel,
            },
        };

        var lines = [];
        var capsSubtotal = 0;
        cart.forEach(function (line) {
            var q = Math.max(0, parseInt(line && line.quantity, 10) || 0);
            if (!q) return;
            var ext = r2(q * perCap);
            lines.push({
                catalogColor: line.catalogColor,
                colorName: line.colorName || line.catalogColor,
                size: 'OSFA',
                quantity: q,
                unitPrice: perCap,
                extended: ext,
            });
            capsSubtotal = r2(capsSubtotal + ext);
        });

        // SHIPPING — threshold model ONLY (CAPS-SHIP-FLAT / CAPS-SHIP-FREE-
        // OVER). Unlike tees there is NO legacy flat-fee fallback: a shipped
        // order without both codes loaded fails closed.
        var shipFlat = parseFloat(cfg.shipFlat);
        var shipFreeOver = parseFloat(cfg.shipFreeOver);
        var shipping = 0;
        var freeShipRemaining = null;
        var shipModelLoaded = Number.isFinite(shipFlat) && Number.isFinite(shipFreeOver);
        if (input && input.delivery && input.delivery.method === 'ship') {
            if (!shipModelLoaded) {
                throw PricingError('Shipping configuration not loaded (CAPS-SHIP-FLAT / CAPS-SHIP-FREE-OVER)', 'NO_SHIP_CONFIG');
            }
            shipping = capsSubtotal >= shipFreeOver ? 0 : r2(shipFlat);
            freeShipRemaining = capsSubtotal >= shipFreeOver ? 0 : r2(shipFreeOver - capsSubtotal);
        }

        // Billable shipping joins the WA tax base (platform ruling 2026-06-09).
        var taxRate = input && input.delivery && Number.isFinite(parseFloat(input.delivery.taxRate))
            ? parseFloat(input.delivery.taxRate) : null;
        var taxableBase = r2(capsSubtotal + shipping);
        var tax = taxRate ? r2(taxableBase * taxRate) : 0;

        var total = r2(capsSubtotal + shipping + tax);

        return {
            combinedQty: combinedQty,
            tierLabel: base.tierLabel,
            minQuantity: base.minQuantity,
            unitBySize: unitBySize,
            perCap: perCap,
            backLogo: backLogo,
            backLogoPerCap: backPer,
            lines: lines,
            capsSubtotal: capsSubtotal,
            shirtsSubtotal: capsSubtotal,   // checkout-route compat alias — do not remove
            ltmFee: 0,                      // NO LTM on this channel, ever (8-cap minimum)
            ltmPerPiece: 0,
            shipping: shipping,
            shippingModel: 'threshold',
            freeShipRemaining: freeShipRemaining,
            shipFreeOver: shipModelLoaded ? shipFreeOver : null,
            taxRate: taxRate,
            taxableBase: taxableBase,
            tax: tax,
            total: total,
        };
    }

    var CAPSPricing = {
        quote: quote,
        unitPrice: unitPrice,
        backLogoPerCap: backLogoPerCap,
        combinedQuantity: combinedQuantity,
        minOrderQuantity: minOrderQuantity,
        findTier: findTier,
        ceilDollar: ceilDollar,
        INCLUDED_STITCH_COUNT: INCLUDED_STITCH_COUNT,
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = CAPSPricing;
    }
    if (typeof global.window !== 'undefined' || typeof window !== 'undefined') {
        global.CAPSPricing = CAPSPricing;
    }
})(typeof window !== 'undefined' ? window : globalThis);
