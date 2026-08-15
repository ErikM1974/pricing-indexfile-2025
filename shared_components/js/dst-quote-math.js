/**
 * dst-quote-math.js — production-risk assessment, machine-time estimation and
 * multi-location price combination for stitch-file-driven quoting (pure, no DOM).
 *
 * Used by /calculators/embroidery-contract/ in the browser and by
 * tests/unit/dst-quote-math.test.js under Node. Keep this file free of DOM,
 * fetch and rendering concerns so it stays require()-able.
 *
 * ─── What this module deliberately does NOT do ─────────────────────────────
 * It never turns a stitch count into a price. Converting (rate, stitches) →
 * dollars happens in exactly ONE place, the calculator's computeUnit(), which
 * reads live rates from /api/contract-pricing. combineLines() below takes
 * ALREADY-PRICED lines and only sums them + picks the LTM, so this file can
 * never become a second pricing path (CLAUDE.md rule 9).
 *
 * Risk flags are ADVISORY. They describe the file; they never alter a price.
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.DSTQuoteMath = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    /* ─── Risk thresholds ───────────────────────────────────────────────────
       Deliberately conservative and shown alongside the measured value in the
       UI, so a human can overrule any of them at a glance. These are
       digitizing-quality heuristics, not pass/fail gates. */

    // Classic satin limit. Past ~12.7 mm (0.5") an unsplit satin snags, loops
    // and catches on wear — the single most common re-digitize trigger.
    var MAX_SATIN_MM = 12.7;

    // Penetrations per 1 mm² cell. Matches the Embroidery Studio's shipped
    // hotspot threshold so both surfaces call the same fabric "dense".
    var DENSITY_CELL_MM = 1;
    var DENSITY_THRESHOLD = 18;
    // A handful of dense cells is normal (small lettering, logo centres).
    // Flag once the dense area is big enough to mean repeated needle strikes.
    var DENSITY_HOTSPOT_MIN = 25;

    // Each trim costs a machine stop (~5 s). Past ~2 per 1,000 stitches the
    // trims cost more time than the stitching they separate.
    var TRIMS_PER_1K_WARN = 2.0;

    // Each colour change is a needle swap (~25 s) and a chance to mis-thread.
    var COLOR_CHANGE_NOTE = 8;

    /**
     * Assess a parsed DST for production risk.
     *
     * @param parsed  the object returned by DSTParser.parse()
     * @param density optional precomputed DSTParser.computeDensity() result;
     *                pass it in when the caller already has one (avoids
     *                re-gridding a large design).
     * @returns [{level, code, title, detail, value}] — 'warn' first, then
     *          'info'. Empty array means the file looks clean.
     */
    function assessRisk(parsed, density) {
        if (!parsed || !parsed.stats) return [];
        var stats = parsed.stats;
        var flags = [];

        if (stats.maxStitchMM > MAX_SATIN_MM) {
            flags.push({
                level: 'warn',
                code: 'long-stitch',
                title: 'Long stitches',
                detail: 'Longest stitch is ' + stats.maxStitchMM.toFixed(1) + ' mm (over the ' +
                    MAX_SATIN_MM + ' mm satin limit). Wide satins snag and loop in wear — ' +
                    'they usually need splitting or a fill.',
                value: stats.maxStitchMM
            });
        }

        var hotspots = (density && density.hotspots) ? density.hotspots.length : 0;
        if (hotspots >= DENSITY_HOTSPOT_MIN) {
            flags.push({
                level: 'warn',
                code: 'density',
                title: 'Dense areas',
                detail: hotspots.toLocaleString('en-US') + ' areas exceed ' + DENSITY_THRESHOLD +
                    ' penetrations per mm². Stacked fills push thread breaks and needle ' +
                    'strikes — expect slower sewing, and puckering on lightweight fabric.',
                value: hotspots
            });
        }

        var per1K = stats.totalStitches > 0 ? (stats.trims / (stats.totalStitches / 1000)) : 0;
        if (per1K > TRIMS_PER_1K_WARN) {
            flags.push({
                level: 'warn',
                code: 'trims',
                title: 'Heavy trimming',
                detail: stats.trims.toLocaleString('en-US') + ' trims across ' +
                    stats.totalStitches.toLocaleString('en-US') + ' stitches (' +
                    per1K.toFixed(1) + ' per 1K). Every trim stops the machine — ' +
                    'this design spends a lot of its run not sewing.',
                value: per1K
            });
        }

        if (stats.colorChanges >= COLOR_CHANGE_NOTE) {
            flags.push({
                level: 'info',
                code: 'colors',
                title: 'Many colour changes',
                detail: stats.colorChanges + ' colour changes (' + stats.totalColors +
                    ' threads). Each is a needle swap — fine on a multi-needle head, ' +
                    'slow on a single.',
                value: stats.colorChanges
            });
        }

        return flags;
    }

    /** Convenience: compute density with this module's thresholds. */
    function densityFor(parser, parsed) {
        return parser.computeDensity(parsed.points, parsed.bbox, {
            cellMM: DENSITY_CELL_MM,
            threshold: DENSITY_THRESHOLD
        });
    }

    /**
     * Machine time for a whole run.
     *
     * Per-piece time comes straight from DSTParser.estimateSewTime (sew +
     * colour changes + trims + a fixed hooping allowance), multiplied by the
     * piece count. This is SINGLE-HEAD machine time: it deliberately makes no
     * assumption about how many heads or machines are free, because that is a
     * scheduling question the calculator cannot see. Presenting it as
     * "machine-hours" keeps it a fact about the file rather than a promise
     * about a delivery date.
     */
    function estimateMachineHours(parser, stats, qty, opts) {
        var t = parser.estimateSewTime(stats, opts || {});
        var pieces = Math.max(1, Number(qty) || 1);
        var totalMin = t.totalMin * pieces;
        return {
            perPieceMin: t.totalMin,
            totalMin: totalMin,
            totalHours: totalMin / 60,
            sewMin: (t.sewSec / 60) * pieces,
            stoppedMin: ((t.colorChangeSec + t.trimSec) / 60) * pieces
        };
    }

    /**
     * Combine already-priced locations into one per-piece price.
     *
     * @param lines [{unit, product}] — `unit` is the per-piece BASE price for
     *              that location, already computed by the caller's single
     *              pricing function. `product` selects the LTM band.
     * @param qty   piece count (the same garments carry every location)
     * @param ltm   {threshold, feeFor(product) -> number}
     *
     * LTM RULE (confirmed by Erik 2026-08-04): one LTM per ORDER, charged at
     * the HIGHEST applicable rate — a left-chest + full-back combo under the
     * threshold carries $100, not $150 and not $50. Stacking per location
     * would double-charge a small-order fee that exists once per order.
     */
    function combineLines(lines, qty, ltm) {
        var list = Array.isArray(lines) ? lines.filter(Boolean) : [];
        var pieces = Math.max(1, Number(qty) || 1);
        var baseUnit = 0;
        for (var i = 0; i < list.length; i++) baseUnit += Number(list[i].unit) || 0;

        var fee = 0;
        if (ltm && pieces <= ltm.threshold) {
            for (var j = 0; j < list.length; j++) {
                // feeFor receives the QUANTITY as well as the product (2026-08-15) so a
                // product whose own small-batch band is narrower than the order-level
                // `threshold` can decline the fee. Full back bands at 1-7 while contract
                // garments band at 1-23; without this a 12-pc full back was charged here
                // and not in the quote builder — the same job, two answers.
                // `ltm.threshold` stays the OUTER bound (the widest band); each product
                // self-gates inside it. Callers that ignore the 2nd arg are unaffected.
                var f = Number(ltm.feeFor(list[j].product, pieces)) || 0;
                if (f > fee) fee = f;           // highest applicable, charged once
            }
        }
        var ltmPerPiece = fee / pieces;
        var finalUnit = baseUnit + ltmPerPiece;
        return {
            baseUnit: baseUnit,
            ltmFee: fee,
            ltmPerPiece: ltmPerPiece,
            finalUnit: finalUnit,
            orderTotal: finalUnit * pieces,
            hasLtm: fee > 0,
            lineCount: list.length
        };
    }

    /**
     * Staff-only margin for a run.
     *
     * cost = machine time × the fully-loaded production hour + one order pool.
     * The rates are NEVER hardcoded here — they arrive from the staff-gated
     * /api/contract-embroidery/cost-model, because the calculator page itself is
     * public and anything in its bundle is readable by every ASI distributor.
     *
     * @param revenue     order total the customer is quoted
     * @param machineHours single-head machine time for the whole run
     * @param model       {productionHourRate, orderPool} from the gated endpoint
     * @returns {cost, productionCost, orderPool, margin, marginPct, perPieceCost}
     *          or null when the model is missing (i.e. the caller is not staff).
     */
    function estimateMargin(revenue, machineHours, model, qty) {
        if (!model || !(Number(model.productionHourRate) > 0)) return null;
        var rev = Number(revenue) || 0;
        var hours = Math.max(0, Number(machineHours) || 0);
        var pieces = Math.max(1, Number(qty) || 1);
        var productionCost = hours * Number(model.productionHourRate);
        var pool = Number(model.orderPool) || 0;
        var cost = productionCost + pool;
        var margin = rev - cost;
        return {
            cost: cost,
            productionCost: productionCost,
            orderPool: pool,
            margin: margin,
            // Margin as a share of REVENUE (contribution margin). Guarded so a
            // zero-revenue quote reports null rather than Infinity/NaN.
            marginPct: rev > 0 ? (margin / rev) * 100 : null,
            perPieceCost: cost / pieces,
            perPieceMargin: margin / pieces
        };
    }

    /**
     * Stable identity for a stitch file.
     *
     * Prefers a real SHA-256 of the bytes (crypto.subtle, available in any
     * secure context incl. localhost). Falls back to FNV-1a when subtle crypto
     * is unavailable — this is an identity key for a local "seen before"
     * lookup, never a security boundary, so a non-cryptographic fallback is
     * acceptable and keeps the feature working on plain http.
     *
     * @returns Promise<string> hex digest, prefixed so the two schemes can
     *          never collide in the same store.
     */
    function fingerprint(buffer, subtleCrypto) {
        var subtle = subtleCrypto ||
            (typeof crypto !== 'undefined' && crypto && crypto.subtle) || null;
        if (subtle && subtle.digest) {
            return subtle.digest('SHA-256', buffer).then(function (hash) {
                var bytes = new Uint8Array(hash);
                var hex = '';
                for (var i = 0; i < bytes.length; i++) {
                    hex += (bytes[i] < 16 ? '0' : '') + bytes[i].toString(16);
                }
                return 'sha256:' + hex;
            }).catch(function () {
                return 'fnv:' + fnv1a(buffer);
            });
        }
        return Promise.resolve('fnv:' + fnv1a(buffer));
    }

    function fnv1a(buffer) {
        var bytes = new Uint8Array(buffer);
        var h = 0x811c9dc5;
        for (var i = 0; i < bytes.length; i++) {
            h ^= bytes[i];
            // 32-bit FNV prime multiply, kept in range without BigInt
            h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
        }
        return ('00000000' + h.toString(16)).slice(-8) + '-' + bytes.length.toString(16);
    }

    return {
        MAX_SATIN_MM: MAX_SATIN_MM,
        DENSITY_CELL_MM: DENSITY_CELL_MM,
        DENSITY_THRESHOLD: DENSITY_THRESHOLD,
        DENSITY_HOTSPOT_MIN: DENSITY_HOTSPOT_MIN,
        TRIMS_PER_1K_WARN: TRIMS_PER_1K_WARN,
        COLOR_CHANGE_NOTE: COLOR_CHANGE_NOTE,
        assessRisk: assessRisk,
        densityFor: densityFor,
        estimateMachineHours: estimateMachineHours,
        combineLines: combineLines,
        estimateMargin: estimateMargin,
        fingerprint: fingerprint
    };
}));
