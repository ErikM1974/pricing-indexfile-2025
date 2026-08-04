/**
 * dst-parser.test.js — Tajima DST parser + production-math unit tests.
 *
 * Builds synthetic DST buffers with a bit-exact encoder (inverse of the
 * EduTech Wiki mapping the parser decodes) so decode is verified as a true
 * round-trip, then locks the derived run/trim/stats/estimate math.
 */

const DST = require('../../pages/js/dst-parser.js');

// ─── synthetic DST encoder (test-only) ─────────────────────────────────────

// Every delta in [-121, 121] is representable as a signed sum over
// {81, 27, 9, 3, 1}. Enumerate all 3^5 combos once and keep the first.
const TIERS = [81, 27, 9, 3, 1];
const COMBOS = (() => {
    const map = new Map();
    const states = [-1, 0, 1];
    for (const a of states) for (const b of states) for (const c of states)
        for (const d of states) for (const e of states) {
            const signs = [a, b, c, d, e];
            const val = signs.reduce((sum, s, i) => sum + s * TIERS[i], 0);
            if (!map.has(val)) map.set(val, signs);
        }
    return map;
})();

// [tier][axis] → {byte index, plus bit, minus bit}
const BITS = {
    x: { 1: [0, 0x01, 0x02], 9: [0, 0x04, 0x08], 3: [1, 0x01, 0x02], 27: [1, 0x04, 0x08], 81: [2, 0x04, 0x08] },
    y: { 1: [0, 0x80, 0x40], 9: [0, 0x20, 0x10], 3: [1, 0x80, 0x40], 27: [1, 0x20, 0x10], 81: [2, 0x20, 0x10] },
};

function encodeRecord(dx, dy, type) {
    if (!COMBOS.has(dx) || !COMBOS.has(dy)) throw new Error(`delta out of range: ${dx},${dy}`);
    const bytes = [0, 0, 0x03]; // low 2 bits of byte 2 always set in real files
    for (const [axis, delta] of [['x', dx], ['y', dy]]) {
        COMBOS.get(delta).forEach((sign, i) => {
            if (sign === 0) return;
            const [bi, plus, minus] = BITS[axis][TIERS[i]];
            bytes[bi] |= sign > 0 ? plus : minus;
        });
    }
    if (type === DST.STITCH_JUMP) bytes[2] |= 0x80;
    if (type === DST.STITCH_COLOR_CHANGE) bytes[2] |= 0xC0;
    return bytes;
}

function buildDST(stitches, headerFields = {}) {
    const header = Buffer.alloc(512, 0x20);
    const label = headerFields.label || 'TESTFILE';
    const text = `LA:${label}\rST:${String(stitches.length).padStart(7)}\rCO:  1\r` +
        `+X:  500\r-X:  500\r+Y:  400\r-Y:  400\r`;
    header.write(text, 0, 'ascii');
    const body = [];
    for (const s of stitches) body.push(...encodeRecord(s.dx, s.dy, s.type));
    body.push(0x00, 0x00, 0xF3); // END
    const buf = Buffer.concat([header, Buffer.from(body)]);
    // Return a clean ArrayBuffer slice (what FileReader hands the browser code)
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

const N = (dx, dy) => ({ dx, dy, type: DST.STITCH_NORMAL });
const J = (dx, dy) => ({ dx, dy, type: DST.STITCH_JUMP });
const CC = () => ({ dx: 0, dy: 0, type: DST.STITCH_COLOR_CHANGE });

// ─── decode round-trip ─────────────────────────────────────────────────────

describe('decodeStitches round-trip', () => {
    test('recovers exact deltas and types across the full delta range', () => {
        const stitches = [
            N(1, -1), N(-9, 9), N(3, -3), N(-27, 27), N(81, -81),
            N(121, -121), N(40, 7), N(-58, 113), J(100, -100), CC(),
            N(-2, 5), N(0, 0),
        ];
        const decoded = DST.decodeStitches(buildDST(stitches));
        // END record is appended by the builder
        expect(decoded).toHaveLength(stitches.length + 1);
        stitches.forEach((s, i) => {
            expect(decoded[i]).toEqual({ type: s.type, dx: s.dx, dy: s.dy });
        });
        expect(decoded[decoded.length - 1].type).toBe(DST.STITCH_END);
    });

    test('parseHeader reads label, count and extents', () => {
        const buf = buildDST([N(1, 1)], { label: 'EAGLE_LC' });
        const h = DST.parseHeader(buf);
        expect(h.label).toBe('EAGLE_LC');
        expect(h.stitchCount).toBe(1);
        expect(h.widthMM).toBeCloseTo(100, 5);
        expect(h.heightMM).toBeCloseTo(80, 5);
    });
});

// ─── run / break / trim processing ─────────────────────────────────────────

describe('processStitches', () => {
    test('splits color runs and counts only normal stitches per run', () => {
        // Run 1: 5 normal. CC. Run 2: 3 normal.
        const stitches = [N(10, 0), N(10, 0), N(10, 0), N(10, 0), N(10, 0), CC(), N(0, 10), N(0, 10), N(0, 10)];
        const data = DST.processStitches(DST.decodeStitches(buildDST(stitches)));

        expect(data.colorRuns).toHaveLength(2);
        expect(data.colorRuns[0].stitchCount).toBe(5);
        expect(data.colorRuns[1].stitchCount).toBe(3);
        expect(data.stats.totalStitches).toBe(8);
        expect(data.stats.colorChanges).toBe(1);
        expect(data.stats.totalColors).toBe(2);
        // 4 segments of 1mm in run 1 (origin→first point is not a segment)
        expect(data.colorRuns[0].lengthMM).toBeCloseTo(4, 5);
        // Run 2 starts fresh after CC: 2 segments of 1mm
        expect(data.colorRuns[1].lengthMM).toBeCloseTo(2, 5);
        expect(data.stats.lengthMM).toBeCloseTo(6, 5);
    });

    test('three consecutive jumps register exactly one trim; two do not', () => {
        const trimmed = DST.processStitches(DST.decodeStitches(buildDST([
            N(5, 0), J(50, 0), J(50, 0), J(50, 0), N(5, 0),
        ])));
        expect(trimmed.stats.trims).toBe(1);
        expect(trimmed.trims[0].jumpCount).toBe(3);

        const noTrim = DST.processStitches(DST.decodeStitches(buildDST([
            N(5, 0), J(50, 0), J(50, 0), N(5, 0),
        ])));
        expect(noTrim.stats.trims).toBe(0);
    });

    test('bbox ignores jump travel', () => {
        const data = DST.processStitches(DST.decodeStitches(buildDST([
            N(10, 10), N(10, 10), J(121, 121), J(121, 121), N(-10, -10),
        ])));
        // Normal points: (10,10),(20,20), then jumps to (262,262), back one normal to (252,252)
        // — the far normal point counts, the pure jump apex does not exist as normal.
        expect(data.bbox.maxX).toBe(252);
        expect(data.bbox.minX).toBe(10);
    });

    test('longest single stitch is surfaced (satin-width check)', () => {
        const data = DST.processStitches(DST.decodeStitches(buildDST([
            N(10, 0), N(80, 0), N(10, 0),
        ])));
        expect(data.stats.maxStitchMM).toBeCloseTo(8, 5);
    });
});

// ─── estimates ─────────────────────────────────────────────────────────────

describe('production estimates', () => {
    test('sew time composes machine speed, color changes, trims and overhead', () => {
        const stats = { totalStitches: 7500, colorChanges: 2, trims: 4 };
        const t = DST.estimateSewTime(stats, { spm: 750, colorChangeSec: 25, trimSec: 5, hoopSec: 60 });
        expect(t.sewSec).toBeCloseTo(600, 5);
        expect(t.totalSec).toBeCloseTo(600 + 50 + 20 + 60, 5);
        expect(t.totalMin).toBeCloseTo(730 / 60, 5);
    });

    test('thread usage: 1m of stitching ≈ 1.75m top / 1m bobbin', () => {
        const usage = DST.estimateThreadUsage([{ lengthMM: 1000 }, { lengthMM: 500 }]);
        expect(usage.runs[0].topM).toBeCloseTo(1.75, 5);
        expect(usage.runs[0].bobbinM).toBeCloseTo(1.0, 5);
        expect(usage.topM).toBeCloseTo(1.75 + 0.875, 5);
    });

    test('density flags a stacked cell as a hotspot', () => {
        // 30 penetrations inside one 1mm cell, plus a sparse far column.
        const stitches = [];
        for (let i = 0; i < 30; i++) stitches.push(N(i % 2 ? 4 : -4, 0));
        stitches.push(J(121, 0), J(121, 0));
        for (let i = 0; i < 5; i++) stitches.push(N(0, 20));
        const data = DST.processStitches(DST.decodeStitches(buildDST(stitches)));
        const density = DST.computeDensity(data.points, data.bbox, { cellMM: 1, threshold: 18 });
        expect(density.max).toBeGreaterThanOrEqual(15);
        expect(density.hotspots.length).toBeGreaterThanOrEqual(1);
        expect(density.hotspots[0].count).toBe(density.max);
    });
});

// ─── guardrails ────────────────────────────────────────────────────────────

describe('parse() guardrails', () => {
    test('rejects a buffer smaller than header + one stitch', () => {
        expect(() => DST.parse(new ArrayBuffer(100))).toThrow(/too small/i);
    });

    test('rejects a header-only file with no decodable stitches', () => {
        const empty = Buffer.alloc(515, 0x20);
        empty[512] = 0x00; empty[513] = 0x00; empty[514] = 0xF3; // immediate END
        const buf = empty.buffer.slice(empty.byteOffset, empty.byteOffset + empty.byteLength);
        expect(() => DST.parse(buf)).toThrow(/no stitches/i);
    });

    test('full parse pipeline returns header + stats together', () => {
        const data = DST.parse(buildDST([N(10, 0), N(10, 0), N(10, 0)], { label: 'ROUNDTRIP' }));
        expect(data.header.label).toBe('ROUNDTRIP');
        expect(data.stats.totalStitches).toBe(3);
        expect(data.bbox.widthMM).toBeCloseTo(2, 5);
    });
});
