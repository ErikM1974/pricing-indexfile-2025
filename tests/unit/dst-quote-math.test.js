/**
 * dst-quote-math.test.js — risk assessment, machine-time and multi-location
 * price combination for stitch-file-driven contract quoting.
 *
 * The combineLines cases encode Erik's 2026-08-04 ruling on combo orders:
 * ONE LTM per order at the HIGHEST applicable rate. Getting this wrong is a
 * wrong price, so the boundaries are locked here rather than left to the UI.
 */

const QM = require('../../shared_components/js/dst-quote-math.js');
const DST = require('../../pages/js/dst-parser.js');

// ─── helpers ───────────────────────────────────────────────────────────────

const stats = (over = {}) => ({
    totalStitches: 10000,
    jumps: 0,
    trims: 5,
    colorChanges: 2,
    totalColors: 3,
    lengthMM: 20000,
    avgStitchMM: 2,
    maxStitchMM: 4,
    ...over,
});

const codes = flags => flags.map(f => f.code);

// ─── risk assessment ───────────────────────────────────────────────────────

describe('assessRisk', () => {
    test('a clean file raises nothing', () => {
        expect(QM.assessRisk({ stats: stats() }, { hotspots: [] })).toEqual([]);
    });

    test('flags a satin wider than the 12.7mm limit, and not one at the limit', () => {
        expect(codes(QM.assessRisk({ stats: stats({ maxStitchMM: 14 }) }))).toContain('long-stitch');
        expect(codes(QM.assessRisk({ stats: stats({ maxStitchMM: 12.7 }) }))).not.toContain('long-stitch');
    });

    test('flags dense areas only past the hotspot floor', () => {
        const many = { hotspots: new Array(QM.DENSITY_HOTSPOT_MIN).fill({ count: 20 }) };
        const few = { hotspots: new Array(QM.DENSITY_HOTSPOT_MIN - 1).fill({ count: 20 }) };
        expect(codes(QM.assessRisk({ stats: stats() }, many))).toContain('density');
        expect(codes(QM.assessRisk({ stats: stats() }, few))).not.toContain('density');
    });

    test('trim flag is RELATIVE to stitch count, not an absolute count', () => {
        // 30 trims on 10K stitches = 3.0 per 1K → over the 2.0 threshold
        expect(codes(QM.assessRisk({ stats: stats({ trims: 30 }) }))).toContain('trims');
        // The SAME 30 trims across 60K stitches = 0.5 per 1K → fine
        expect(codes(QM.assessRisk({ stats: stats({ trims: 30, totalStitches: 60000 }) })))
            .not.toContain('trims');
    });

    test('zero-stitch input cannot divide by zero into a spurious trim flag', () => {
        const flags = QM.assessRisk({ stats: stats({ totalStitches: 0, trims: 4 }) });
        expect(codes(flags)).not.toContain('trims');
    });

    test('colour changes are info, not a warning', () => {
        const flags = QM.assessRisk({ stats: stats({ colorChanges: 9 }) });
        const colour = flags.find(f => f.code === 'colors');
        expect(colour.level).toBe('info');
    });

    test('missing or malformed input degrades to no flags rather than throwing', () => {
        expect(QM.assessRisk(null)).toEqual([]);
        expect(QM.assessRisk({})).toEqual([]);
    });
});

// ─── machine time ──────────────────────────────────────────────────────────

describe('estimateMachineHours', () => {
    test('scales single-piece time by the run quantity', () => {
        const s = { totalStitches: 7500, colorChanges: 2, trims: 4 };
        const one = QM.estimateMachineHours(DST, s, 1, { spm: 750, colorChangeSec: 25, trimSec: 5, hoopSec: 60 });
        const many = QM.estimateMachineHours(DST, s, 24, { spm: 750, colorChangeSec: 25, trimSec: 5, hoopSec: 60 });
        // 600s sew + 50s changes + 20s trims + 60s hoop = 730s = 12.1667 min
        expect(one.perPieceMin).toBeCloseTo(730 / 60, 5);
        expect(many.totalMin).toBeCloseTo((730 / 60) * 24, 5);
        expect(many.totalHours).toBeCloseTo((730 / 60) * 24 / 60, 5);
    });

    test('separates sewing from stopped time (the two behave differently on a run)', () => {
        const s = { totalStitches: 7500, colorChanges: 2, trims: 4 };
        const r = QM.estimateMachineHours(DST, s, 10, { spm: 750, colorChangeSec: 25, trimSec: 5, hoopSec: 60 });
        expect(r.sewMin).toBeCloseTo(100, 5);      // 600s × 10 = 100 min
        expect(r.stoppedMin).toBeCloseTo(70 / 60 * 10, 5);
    });

    test('a zero or absent quantity is treated as one piece, never zero', () => {
        const s = { totalStitches: 1000, colorChanges: 0, trims: 0 };
        expect(QM.estimateMachineHours(DST, s, 0).totalMin).toBeGreaterThan(0);
    });
});

// ─── multi-location price combination ──────────────────────────────────────

describe('combineLines', () => {
    // Mirrors the calculator's live config: $50 flat/cap, $100 full back, 1-23 pcs
    const ltm = { threshold: 23, feeFor: p => (p === 'fullback' ? 100 : 50) };

    test('sums the per-piece base price across locations', () => {
        const r = QM.combineLines(
            [{ unit: 7.20, product: 'garment' }, { unit: 27.00, product: 'fullback' }], 48, ltm);
        expect(r.baseUnit).toBeCloseTo(34.20, 5);
        expect(r.orderTotal).toBeCloseTo(34.20 * 48, 5);
        expect(r.hasLtm).toBe(false);
    });

    test('ONE LTM per order at the HIGHEST rate — a combo is $100, not $150', () => {
        const r = QM.combineLines(
            [{ unit: 7.20, product: 'garment' }, { unit: 27.00, product: 'fullback' }], 12, ltm);
        expect(r.ltmFee).toBe(100);
        expect(r.ltmPerPiece).toBeCloseTo(100 / 12, 5);
        expect(r.finalUnit).toBeCloseTo(34.20 + 100 / 12, 5);
    });

    test('order of the lines cannot change the fee', () => {
        const a = QM.combineLines([{ unit: 1, product: 'fullback' }, { unit: 1, product: 'cap' }], 5, ltm);
        const b = QM.combineLines([{ unit: 1, product: 'cap' }, { unit: 1, product: 'fullback' }], 5, ltm);
        expect(a.ltmFee).toBe(b.ltmFee);
        expect(a.ltmFee).toBe(100);
    });

    test('two flat locations carry a single $50, not $100', () => {
        const r = QM.combineLines(
            [{ unit: 5, product: 'garment' }, { unit: 6, product: 'cap' }], 10, ltm);
        expect(r.ltmFee).toBe(50);
    });

    test('a single line matches the pre-combo behaviour exactly', () => {
        const r = QM.combineLines([{ unit: 7.20, product: 'garment' }], 12, ltm);
        expect(r.baseUnit).toBeCloseTo(7.20, 5);
        expect(r.ltmFee).toBe(50);
        expect(r.finalUnit).toBeCloseTo(7.20 + 50 / 12, 5);
    });

    test('the LTM threshold is inclusive at 23 and clear at 24', () => {
        const lines = [{ unit: 7.20, product: 'garment' }];
        expect(QM.combineLines(lines, 23, ltm).ltmFee).toBe(50);
        expect(QM.combineLines(lines, 24, ltm).ltmFee).toBe(0);
        expect(QM.combineLines(lines, 24, ltm).finalUnit).toBeCloseTo(7.20, 5);
    });

    test('no lines yields a zero quote rather than NaN', () => {
        const r = QM.combineLines([], 24, ltm);
        expect(r.baseUnit).toBe(0);
        expect(r.orderTotal).toBe(0);
        expect(r.lineCount).toBe(0);
    });

    test('null entries and non-numeric units are ignored, never NaN-poisoning the total', () => {
        const r = QM.combineLines(
            [{ unit: 7.20, product: 'garment' }, null, { unit: undefined, product: 'cap' }], 48, ltm);
        expect(r.baseUnit).toBeCloseTo(7.20, 5);
        expect(Number.isNaN(r.orderTotal)).toBe(false);
    });

    test('omitting the ltm config prices with no fee instead of throwing', () => {
        const r = QM.combineLines([{ unit: 7.20, product: 'garment' }], 1, null);
        expect(r.ltmFee).toBe(0);
        expect(r.finalUnit).toBeCloseTo(7.20, 5);
    });
});

// ─── staff margin ──────────────────────────────────────────────────────────

describe('estimateMargin', () => {
    // 🔴 DELIBERATELY FICTIONAL RATES. Everything under /tests is served by a
    // PUBLIC static mount (server.js `app.use('/tests', express.static(...))`)
    // and ships in the Heroku slug, so a real rate written here is published to
    // the open web — which would defeat the whole point of putting the cost
    // model behind requireStaff. The assertions below are pure arithmetic and
    // do not care what the numbers are. NEVER paste the real model in here.
    const model = { productionHourRate: 100, orderPool: 10 };

    test('cost is machine time x the loaded hour, plus ONE order pool', () => {
        const r = QM.estimateMargin(2000, 10, model, 24);
        expect(r.productionCost).toBeCloseTo(1000, 5);
        expect(r.orderPool).toBe(10);
        expect(r.cost).toBeCloseTo(1010, 5);
        expect(r.margin).toBeCloseTo(990, 5);
        expect(r.marginPct).toBeCloseTo(49.5, 4);
    });

    test('returns NULL without a model — a non-staff caller gets no cost data', () => {
        expect(QM.estimateMargin(1000, 10, null, 24)).toBeNull();
        expect(QM.estimateMargin(1000, 10, {}, 24)).toBeNull();
        expect(QM.estimateMargin(1000, 10, { productionHourRate: 0 }, 24)).toBeNull();
    });

    test('a loss is reported as a negative margin, not clamped away', () => {
        // The cap 1-7 shape: tiny revenue, real machine time
        const r = QM.estimateMargin(60, 3, model, 6);
        expect(r.margin).toBeLessThan(0);
        expect(r.marginPct).toBeLessThan(0);
    });

    test('zero revenue reports a null percentage rather than Infinity', () => {
        const r = QM.estimateMargin(0, 5, model, 12);
        expect(r.marginPct).toBeNull();
        expect(Number.isFinite(r.margin)).toBe(true);
    });

    test('per-piece figures divide by quantity and never by zero', () => {
        const r = QM.estimateMargin(2000, 10, model, 0);
        expect(Number.isFinite(r.perPieceCost)).toBe(true);
        expect(r.perPieceCost).toBeCloseTo(1010, 5);   // qty 0 treated as 1
    });
});

// ─── file fingerprint ──────────────────────────────────────────────────────

describe('fingerprint', () => {
    const buf = s => new TextEncoder().encode(s).buffer;

    test('same bytes → same id; one changed byte → different id', async () => {
        const a = await QM.fingerprint(buf('EAGLE_LC stitches'));
        const b = await QM.fingerprint(buf('EAGLE_LC stitches'));
        const c = await QM.fingerprint(buf('EAGLE_LC stitchez'));
        expect(a).toBe(b);
        expect(a).not.toBe(c);
    });

    test('uses SHA-256 when subtle crypto is available', async () => {
        const fp = await QM.fingerprint(buf('x'), require('crypto').webcrypto.subtle);
        expect(fp).toMatch(/^sha256:[0-9a-f]{64}$/);
    });

    test('falls back to FNV when subtle crypto is absent, still stable+distinct', async () => {
        const noSubtle = null;
        // Force the fallback by passing an object without digest
        const a = await QM.fingerprint(buf('hello'), {});
        const b = await QM.fingerprint(buf('hello'), {});
        const c = await QM.fingerprint(buf('hellp'), {});
        expect(a).toMatch(/^fnv:/);
        expect(a).toBe(b);
        expect(a).not.toBe(c);
    });

    test('the two schemes are namespaced so they can never collide in one store', async () => {
        const sha = await QM.fingerprint(buf('same'), require('crypto').webcrypto.subtle);
        const fnv = await QM.fingerprint(buf('same'), {});
        expect(sha.split(':')[0]).not.toBe(fnv.split(':')[0]);
    });

    test('a digest that rejects degrades to the fallback instead of throwing', async () => {
        const broken = { digest: () => Promise.reject(new Error('no')) };
        await expect(QM.fingerprint(buf('z'), broken)).resolves.toMatch(/^fnv:/);
    });
});

// ─── saved-quote money invariant ───────────────────────────────────────────

/**
 * Mirrors saveContractEmbroideryQuote's line-item allocation. The saved
 * quote_items rows MUST sum to the quote_sessions TotalAmount: the quote
 * renderer sums LineTotal for the products table but prints TotalAmount as the
 * grand total and taxes it, so any drift shows the customer a table that does
 * not add up to its own total. Per-line rounding always drifts, so the LAST
 * line absorbs the residual.
 */
function allocateLineTotals(locations, qty, ltmPerPiece, orderTotalExact) {
    const rows = [];
    let allocated = 0;
    locations.forEach((loc, i) => {
        const unit = loc.unit + (i === 0 ? ltmPerPiece : 0);
        const isLast = i === locations.length - 1;
        const lineTotal = isLast
            ? Number((orderTotalExact - allocated).toFixed(2))
            : Number((unit * qty).toFixed(2));
        if (!isLast) allocated += lineTotal;
        rows.push({ unit: Number(unit.toFixed(2)), lineTotal });
    });
    return rows;
}

describe('saved line items reconcile to the session total', () => {
    const sum = rows => Number(rows.reduce((t, r) => t + r.lineTotal, 0).toFixed(2));

    test('multi-location: rows sum EXACTLY to the order total', () => {
        // 12 pcs, garment 9,412 st @ $1.00/1K = $9.411667, full back 25K = $26.00, $100 LTM
        const qty = 12, ltmPerPiece = 100 / 12;
        const locs = [{ unit: 9.411666666 }, { unit: 26.00 }];
        const orderTotal = Number(((9.411666666 + 26.00 + ltmPerPiece) * qty).toFixed(2));
        expect(sum(allocateLineTotals(locs, qty, ltmPerPiece, orderTotal))).toBe(orderTotal);
    });

    test('single location at a large qty — the case that drifted 23 cents', () => {
        const qty = 288, ltmPerPiece = 0;
        const locs = [{ unit: 8.4708 }];
        const orderTotal = Number((8.4708 * qty).toFixed(2));
        const rows = allocateLineTotals(locs, qty, ltmPerPiece, orderTotal);
        expect(sum(rows)).toBe(orderTotal);
        // and a single line must equal the total outright (pre-Phase-2 behaviour)
        expect(rows[0].lineTotal).toBe(orderTotal);
    });

    test('three locations still reconcile', () => {
        const qty = 7, ltmPerPiece = 100 / 7;
        const locs = [{ unit: 3.333333 }, { unit: 6.666666 }, { unit: 9.999999 }];
        const orderTotal = Number(((3.333333 + 6.666666 + 9.999999 + ltmPerPiece) * qty).toFixed(2));
        expect(sum(allocateLineTotals(locs, qty, ltmPerPiece, orderTotal))).toBe(orderTotal);
    });

    test('the residual lands on the last line, never on the first', () => {
        const qty = 3, ltmPerPiece = 0;
        const locs = [{ unit: 1.005 }, { unit: 2.005 }];
        const orderTotal = Number(((1.005 + 2.005) * qty).toFixed(2));
        const rows = allocateLineTotals(locs, qty, ltmPerPiece, orderTotal);
        expect(rows[0].lineTotal).toBe(Number((1.005 * 3).toFixed(2)));
        expect(sum(rows)).toBe(orderTotal);
    });
});

// ─── end-to-end against a real parsed buffer ───────────────────────────────

describe('integration with the DST parser', () => {
    // Minimal synthetic file: 40 normal stitches, one 20mm jump-free leap that
    // registers as an over-limit satin.
    function buildBuffer(stitches) {
        const TIERS = [81, 27, 9, 3, 1];
        const combos = new Map();
        const st = [-1, 0, 1];
        for (const a of st) for (const b of st) for (const c of st) for (const d of st) for (const e of st) {
            const signs = [a, b, c, d, e];
            const v = signs.reduce((s, x, i) => s + x * TIERS[i], 0);
            if (!combos.has(v)) combos.set(v, signs);
        }
        const BITS = {
            x: { 1: [0, 0x01, 0x02], 9: [0, 0x04, 0x08], 3: [1, 0x01, 0x02], 27: [1, 0x04, 0x08], 81: [2, 0x04, 0x08] },
            y: { 1: [0, 0x80, 0x40], 9: [0, 0x20, 0x10], 3: [1, 0x80, 0x40], 27: [1, 0x20, 0x10], 81: [2, 0x20, 0x10] },
        };
        const body = [];
        for (const s of stitches) {
            const bytes = [0, 0, 0x03];
            for (const [axis, delta] of [['x', s.dx], ['y', s.dy]]) {
                combos.get(delta).forEach((sign, i) => {
                    if (!sign) return;
                    const [bi, plus, minus] = BITS[axis][TIERS[i]];
                    bytes[bi] |= sign > 0 ? plus : minus;
                });
            }
            body.push(...bytes);
        }
        body.push(0x00, 0x00, 0xF3);
        const header = Buffer.alloc(512, 0x20);
        header.write(`LA:RISKTEST\rST:${String(stitches.length).padStart(7)}\rCO:  1\r`, 0, 'ascii');
        const buf = Buffer.concat([header, Buffer.from(body)]);
        return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    }

    test('a real over-long satin parses through to a long-stitch warning', () => {
        const N = (dx, dy) => ({ dx, dy });
        // Deltas are per-AXIS in 0.1mm, so the stitch length is the diagonal:
        // sqrt(100² + 100²) = 141.4 units = 14.1mm, past the 12.7mm limit.
        const parsed = DST.parse(buildBuffer([N(10, 0), N(100, 100), N(10, 0)]));
        const flags = QM.assessRisk(parsed, QM.densityFor(DST, parsed));
        const warn = flags.find(f => f.code === 'long-stitch');
        expect(warn).toBeDefined();
        expect(warn.level).toBe('warn');
        expect(warn.detail).toMatch(/mm/);
    });

    test('densityFor uses the same threshold the Embroidery Studio ships', () => {
        const parsed = DST.parse(buildBuffer([{ dx: 10, dy: 0 }, { dx: 10, dy: 0 }, { dx: 10, dy: 0 }]));
        const d = QM.densityFor(DST, parsed);
        expect(d.threshold).toBe(QM.DENSITY_THRESHOLD);
        expect(d.cellMM).toBe(QM.DENSITY_CELL_MM);
    });
});
