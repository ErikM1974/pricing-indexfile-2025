/**
 * custom-stickers-ladder.js — PURE. No DOM, no fetch, no globals.
 *
 * Everything on /custom-stickers that turns the fetched grid into what the user
 * sees, with zero I/O, so it can be unit-tested in Node and lifted into a shared
 * configurator component later without a rewrite.
 *
 * 🔴 ARITHMETIC RULE — read before editing.
 * This module MAY divide an authoritative TotalPrice by an authoritative
 * Quantity, and MAY compare the quotients. It MUST NOT add, multiply or round
 * any money value into a new price. Every dollar figure it returns is either a
 * server-supplied TotalPrice or a difference between two of them. Prices are the
 * server's job (Erik's iron rule: never compute a price client-side); this file
 * only decides which server price to show and how to describe it.
 *
 * 🔴 NEVER read `PricePerSticker`. It is a 2-dp Caspio column and 26 of the 50
 * rows do not multiply back to their own TotalPrice — STK-4X4-10000 publishes
 * $0.58, which implies $5,800 against a real $5,846. Use `unitPrice` (supplied
 * by the server) or derive it here. Unit-tested with a deliberately-wrong
 * fixture so this cannot regress.
 */
(function (global) {
    'use strict';

    // Badges below this read as a broken volume story rather than a deal — our
    // 6x6 @ 100 tier computes to 12%, sitting right under a 27% on the size
    // above it. Render nothing instead of advertising a weak break.
    var MIN_SAVINGS_BADGE_PCT = 20;

    // A nudge has to clear BOTH bars to be worth showing:
    //   - the per-unit price has to improve by at least this much, and
    //   - the extra spend can't exceed what they're already spending.
    // Without the second guard the default state (3x3 @ 100, $124) proposes
    // "add 200 more for $172" — a +139% ask to someone who hasn't clicked yet.
    var NUDGE_MIN_IMPROVEMENT = 0.15;
    var NUDGE_MAX_DELTA_RATIO = 1.0;

    function unitOf(row) {
        if (!row) return 0;
        if (typeof row.unitPrice === 'number' && isFinite(row.unitPrice)) return row.unitPrice;
        var qty = Number(row.Quantity) || 0;
        return qty > 0 ? Number(row.TotalPrice) / qty : 0;
    }

    function rowsForSize(grid, size) {
        return (grid || [])
            .filter(function (r) { return r.Size === size; })
            .sort(function (a, b) { return a.Quantity - b.Quantity; });
    }

    /** Distinct sizes present in the grid, in ascending physical order. */
    function sizesIn(grid) {
        var seen = {};
        (grid || []).forEach(function (r) { seen[r.Size] = true; });
        return Object.keys(seen).sort(function (a, b) {
            return parseFloat(a) - parseFloat(b);
        });
    }

    /**
     * The savings badge for a row. Server-supplied `savingsPct` wins; we only
     * decide whether it's worth showing. Returns null for "render nothing".
     */
    function badgeFor(row, baselineRow) {
        if (!row) return null;
        var pct = row.savingsPct;
        // Fallback for the window before the server started sending savingsPct.
        // Permitted by the arithmetic rule above: this is a RATIO of two
        // authoritative totals, not a new price, and it never reaches a payload.
        if (pct == null && baselineRow) {
            var base = unitOf(baselineRow);
            if (!(base > 0) || baselineRow === row) return null;
            pct = (1 - unitOf(row) / base) * 100;
        }
        if (pct == null) return null;
        pct = Math.round(pct);
        return pct >= MIN_SAVINGS_BADGE_PCT ? pct : null;
    }

    /**
     * Build the 10-row ladder for one size. Everything the table needs, already
     * decided — the renderer does no arithmetic and no branching on price.
     */
    function ladderFor(grid, size, selectedQty) {
        var rows = rowsForSize(grid, size);
        var baseline = rows.length ? rows[0] : null;
        return rows.map(function (r) {
            return {
                partNumber: r.PartNumber,
                quantity: r.Quantity,
                totalPrice: r.TotalPrice,
                unitPrice: unitOf(r),
                savingsPct: badgeFor(r, baseline),
                isBestValue: !!r.IsBestValue,
                isSelected: r.Quantity === selectedQty
            };
        });
    }

    /**
     * "300 stickers is $296 — $0.99 each instead of $1.24."
     *
     * Scans FORWARD from the selected tier and takes the first that clears both
     * guards. Returns null when nothing qualifies (including on the last tier),
     * which is the common case and is correct — a nudge that doesn't earn its
     * place is just noise above the CTA.
     */
    function nudgeFrom(grid, size, selectedQty) {
        var rows = rowsForSize(grid, size);
        var i = rows.findIndex(function (r) { return r.Quantity === selectedQty; });
        if (i < 0 || i >= rows.length - 1) return null;

        var current = rows[i];
        var currentUnit = unitOf(current);
        if (!(currentUnit > 0)) return null;

        for (var j = i + 1; j < rows.length; j++) {
            var next = rows[j];
            var improvement = (currentUnit - unitOf(next)) / currentUnit;
            if (improvement < NUDGE_MIN_IMPROVEMENT) continue;

            var deltaTotal = next.TotalPrice - current.TotalPrice;
            if (deltaTotal > current.TotalPrice * NUDGE_MAX_DELTA_RATIO) return null;

            return {
                quantity: next.Quantity,
                totalPrice: next.TotalPrice,
                unitPrice: unitOf(next),
                fromUnitPrice: currentUnit,
                deltaTotal: deltaTotal,
                improvementPct: Math.round(improvement * 100)
            };
        }
        return null;
    }

    /**
     * Resolve a requested width/height to a standard square, mirroring the
     * server's bounding-box rule (larger dimension rounds UP). Returns a
     * decision, never a price — the caller looks the answer up in the grid.
     */
    function resolveSize(grid, width, height) {
        var w = Number(width);
        var h = Number(height);
        if (!isFinite(w) || w <= 0 || !isFinite(h) || h <= 0) {
            return { ok: false, reason: 'incomplete' };
        }
        var sizes = sizesIn(grid);
        var maxDim = Math.max(w, h);
        var match = sizes.find(function (s) { return parseFloat(s) >= maxDim; });
        if (!match) {
            // Above the largest square this stops being a sticker and becomes a
            // large-format decal on a different (square-foot) rate card. The two
            // ladders must never be on screen together — they invert across 6in.
            return { ok: false, reason: 'oversize', maxDim: maxDim };
        }
        var tierDim = parseFloat(match);
        return {
            ok: true,
            size: match,
            wasRounded: !(w === h && tierDim === w),
            // True when the artwork does not already fill the tier square, so
            // they could go bigger at no extra cost. Note this is per-axis, not
            // just the larger dimension: a 2×3 is already at the 3in ceiling on
            // height but has a full inch of free width, and "you can go up to a
            // full 3 × 3 at no extra cost" is true and worth saying.
            canUpgrade: w < tierDim || h < tierDim,
            tierDim: tierDim,
            requested: { width: w, height: h }
        };
    }

    /**
     * Resolve a requested quantity to a standard tier. Rounds UP, always —
     * rounding down would quote below the published sheet.
     */
    function resolveQty(grid, size, qty) {
        var q = Math.trunc(Number(qty));
        if (!isFinite(q) || q <= 0) return { ok: false, reason: 'incomplete' };

        var rows = rowsForSize(grid, size);
        if (!rows.length) return { ok: false, reason: 'incomplete' };

        var min = rows[0].Quantity;
        var max = rows[rows.length - 1].Quantity;
        if (q < min) return { ok: false, reason: 'below_minimum', minimum: min, minimumRow: rows[0] };
        if (q > max) return { ok: false, reason: 'above_maximum', maximum: max };

        var tier = rows.find(function (r) { return r.Quantity >= q; });
        return { ok: true, quantity: tier.Quantity, wasRounded: tier.Quantity !== q, requested: q };
    }

    /** The one row the price block renders. Pure lookup — no arithmetic. */
    function selectRow(grid, size, qty) {
        var row = (grid || []).find(function (r) {
            return r.Size === size && r.Quantity === qty;
        });
        if (!row) return null;
        return {
            partNumber: row.PartNumber,
            size: row.Size,
            quantity: row.Quantity,
            totalPrice: row.TotalPrice,
            unitPrice: unitOf(row),
            isBestValue: !!row.IsBestValue
        };
    }

    /** "3x3" → "3 × 3 in" */
    function formatSize(size) {
        var parts = String(size || '').split('x');
        return parts.length === 2 ? parts[0] + ' × ' + parts[1] + ' in' : String(size || '');
    }

    /**
     * Money for display. Totals are exact and print at 2dp. Per-unit figures are
     * ROUNDED — 3dp under a dollar so sub-cent tiers stay distinguishable — and
     * the caller must prefix them with ≈, because at 10,000 pieces even 3dp
     * multiplies back to a number a few dollars off the true total.
     */
    function formatMoney(n) {
        if (!isFinite(n)) return '0.00';
        return n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }

    function formatUnit(n) {
        if (!isFinite(n)) return '0.00';
        return n < 1 ? n.toFixed(3) : formatMoney(n);
    }

    function formatInt(n) {
        if (!isFinite(n)) return '0';
        return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }

    var StickerLadder = {
        MIN_SAVINGS_BADGE_PCT: MIN_SAVINGS_BADGE_PCT,
        NUDGE_MIN_IMPROVEMENT: NUDGE_MIN_IMPROVEMENT,
        unitOf: unitOf,
        sizesIn: sizesIn,
        rowsForSize: rowsForSize,
        badgeFor: badgeFor,
        ladderFor: ladderFor,
        nudgeFrom: nudgeFrom,
        resolveSize: resolveSize,
        resolveQty: resolveQty,
        selectRow: selectRow,
        formatSize: formatSize,
        formatMoney: formatMoney,
        formatUnit: formatUnit,
        formatInt: formatInt
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = StickerLadder;
    }
    if (typeof global !== 'undefined') {
        global.StickerLadder = StickerLadder;
    }
})(typeof window !== 'undefined' ? window : globalThis);
