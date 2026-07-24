/**
 * custom-banners-ladder.js — PURE. No DOM, no fetch, no globals.
 *
 * 🔴 THE BANNER RATE CARD HAS NO VOLUME BREAK. BAN-SQFT is a flat $10/sqft, so
 * ten banners cost exactly ten times one banner. The savings-% ladder that
 * carries /custom-stickers has NOTHING to attach to here, and any UI that
 * implies a quantity discount would be lying. What varies on a banner is SIZE —
 * so the ladder is a size ladder, and quantity is a plain multiplier.
 *
 * 🔴 ORDER OF OPERATIONS IS LOAD-BEARING (banner-pricing.js:174-226):
 *     sqft × rate  →  FLOOR TO THE $40 MINIMUM  →  × 1.8 if double-sided
 *                  →  + finishing extras  →  × 1.25 if rush  →  × qty
 * Floor-then-multiply and multiply-then-floor differ: a 6×6in double-sided
 * banner is $72 the correct way and $40 the wrong way. This module never
 * computes a price — the server does — but it must not imply a different order
 * in what it renders.
 *
 * This file only decides WHICH server price to show and how to describe it.
 */
(function (global) {
    'use strict';

    // Common finished banner sizes, in feet. Every one is priced by the server
    // on boot — these are just the sizes we offer as one-click presets, chosen
    // to span the range a customer actually asks for.
    var PRESET_SIZES = [
        { w: 2, h: 4,  label: '2 × 4 ft',  note: 'Table banner' },
        { w: 2, h: 6,  label: '2 × 6 ft',  note: 'Table / rail' },
        { w: 3, h: 5,  label: '3 × 5 ft',  note: 'Fence banner' },
        { w: 3, h: 6,  label: '3 × 6 ft',  note: 'Most popular' },
        { w: 3, h: 8,  label: '3 × 8 ft',  note: 'Wide fence' },
        { w: 4, h: 8,  label: '4 × 8 ft',  note: 'Field / building' },
        { w: 4, h: 10, label: '4 × 10 ft', note: 'Large format' }
    ];

    function ftToIn(ft) { return Math.round(Number(ft) * 12); }

    /** sqft of a finished banner given feet. Geometry, not money. */
    function sqft(wFt, hFt) { return Number(wFt) * Number(hFt); }

    /**
     * Below this the $40 order minimum swallows the difference, so shrinking a
     * banner stops changing the price. Customers read that as a broken
     * calculator unless it is said out loud.
     */
    function minimumCoversSqFt(minimumCharge, ratePerSqFt) {
        if (!(ratePerSqFt > 0)) return 0;
        return minimumCharge / ratePerSqFt;
    }

    /** True when this size lands in the flat-rate zone. */
    function isInMinimumZone(wFt, hFt, minimumCharge, ratePerSqFt) {
        return sqft(wFt, hFt) < minimumCoversSqFt(minimumCharge, ratePerSqFt);
    }

    /**
     * Validate a custom size against the roll. Returns a decision, never a price.
     * Over the safe roll width the banner has to be panelled and seamed, which
     * is a real production difference the customer should hear about up front
     * rather than discover on their proof.
     */
    function checkCustomSize(wFt, hFt, safeRollWidthIn) {
        var w = Number(wFt), h = Number(hFt);
        if (!isFinite(w) || w <= 0 || !isFinite(h) || h <= 0) {
            return { ok: false, reason: 'incomplete' };
        }
        var maxIn = Math.max(ftToIn(w), ftToIn(h));
        var minIn = Math.min(ftToIn(w), ftToIn(h));
        var roll = Number(safeRollWidthIn) || 52;
        return {
            ok: true,
            widthIn: ftToIn(w),
            heightIn: ftToIn(h),
            sqft: sqft(w, h),
            // The SHORT side is what has to fit the roll — a 3ft × 30ft banner
            // prints fine, a 6ft × 6ft one has to be seamed.
            needsPaneling: minIn > roll,
            longestIn: maxIn
        };
    }

    /** Rows for the size ladder, priced entirely from the server payload. */
    function ladderFrom(pricedSizes, selectedKey) {
        return (pricedSizes || []).map(function (p) {
            return {
                key: p.key,
                label: p.label,
                note: p.note,
                sqft: p.sqft,
                unitPrice: p.price,           // price for ONE banner this size
                isSelected: p.key === selectedKey,
                atMinimum: !!p.atMinimum
            };
        });
    }

    function keyFor(wFt, hFt) { return wFt + 'x' + hFt; }

    function formatMoney(n) {
        if (!isFinite(n)) return '0.00';
        return n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }

    function formatInt(n) {
        if (!isFinite(n)) return '0';
        return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }

    /** "2 × 4 ft" from feet. */
    function formatSize(wFt, hFt) { return wFt + ' × ' + hFt + ' ft'; }

    var BannerLadder = {
        PRESET_SIZES: PRESET_SIZES,
        ftToIn: ftToIn,
        sqft: sqft,
        minimumCoversSqFt: minimumCoversSqFt,
        isInMinimumZone: isInMinimumZone,
        checkCustomSize: checkCustomSize,
        ladderFrom: ladderFrom,
        keyFor: keyFor,
        formatMoney: formatMoney,
        formatInt: formatInt,
        formatSize: formatSize
    };

    if (typeof module !== 'undefined' && module.exports) module.exports = BannerLadder;
    if (typeof global !== 'undefined') global.BannerLadder = BannerLadder;
})(typeof window !== 'undefined' ? window : globalThis);
