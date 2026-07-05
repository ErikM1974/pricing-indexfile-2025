/**
 * ladder-numeric-parity.test.js — NUMERIC lock on the price-ladder (matrix) base
 * formula in the two probe surfaces:
 *
 *   calculators/quick-quote/quick-quote.js  → probeLadder() / probeQty()
 *   product/js/pdp-configurator.js          → probeLadder() / probeQty()
 *
 * WHY: the 2026-07-04 review found DTF's small-batch ($50 LTM) fee double-displayed
 * because the ladder derived its base from the engine's `baseUnit` — which is
 * LTM-inclusive for DTF but LTM-stripped for EMB/SCP/DTG. The fix derives the base
 * from groupTotal instead:
 *
 *   base = (groupTotal − Σ oneTime fees − ltmFlat) / qty
 *
 * The existing parity suites (web-quote-cart-parity, quick-quote-parity) lock the
 * ENGINE's dollars and the tools' wiring SHAPE — but nothing numerically exercised
 * this display-layer formula, so the exact bug class could regress in both files
 * "in sync" and still pass. This test EXTRACTS the real formula lines from each
 * source file and EXECUTES them against mocked engine previews with known totals,
 * asserting exact derived values (and that both surfaces derive identical numbers).
 *
 * If an extraction regex fails, the formula was refactored — update the regex AND
 * re-verify the math here rather than deleting the assertion.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const QQ = fs.readFileSync(path.join(ROOT, 'calculators', 'quick-quote', 'quick-quote.js'), 'utf8');
const CFG = fs.readFileSync(path.join(ROOT, 'product', 'js', 'pdp-configurator.js'), 'utf8');

const r2 = (n) => Math.round(n * 100) / 100;

/**
 * Pull the three formula statements (oneTimeT reducer, ltmFlat, base/price expr)
 * out of a source file and compile them into a callable (preview, pq) => base.
 * Executes the PRODUCTION text, not a re-implementation — if the shipped math
 * changes, these functions change with it and the numeric asserts catch drift.
 */
function compileQuickQuoteFormula() {
    const fn = QQ.match(/async function probeQty\(pq\) \{[\s\S]*?\n        \}/);
    expect(fn).toBeTruthy();
    const body = fn[0];
    const oneTime = body.match(/var oneTimeT = [^\n]+;/);
    const ltm = body.match(/var ltmFlat = [^\n]+;/);
    const base = body.match(/var base = [^\n]+;/);
    expect(oneTime && ltm && base).toBeTruthy();
    // eslint-disable-next-line no-new-func
    return new Function('preview', 'pq', 'r2',
        oneTime[0] + '\n' + ltm[0] + '\n' + base[0] + '\nreturn r2(base);');
}

function compileConfiguratorFormula() {
    const fn = CFG.match(/async function probeQty\(pq\) \{[\s\S]*?\n        \}/);
    expect(fn).toBeTruthy();
    const body = fn[0];
    const oneTime = body.match(/const oneTimeT = [^\n]+;/);
    const ltm = body.match(/const ltmFlat = [^\n]+;/);
    const price = body.match(/price: r2\(([^\n]+)\),/);
    expect(oneTime && ltm && price).toBeTruthy();
    // eslint-disable-next-line no-new-func
    return new Function('preview', 'pq', 'r2',
        oneTime[0] + '\n' + ltm[0] + '\nreturn r2(' + price[1] + ');');
}

/** Build a mocked singleItemPreview result with known money parts. */
function mockPreview({ perPiece, qty, ltmFee = 0, oneTimeFees = [], perPieceFees = [] }) {
    // groupTotal = everything the engine folded in: scaled per-piece lines,
    // one-time fees, and (when applicable) the flat LTM fee — for EVERY method.
    const oneTimeT = oneTimeFees.reduce((s, a) => s + Number(a), 0);
    const groupTotal = perPiece * qty + oneTimeT + ltmFee;
    return {
        ok: true,
        lines: [{}],
        tierLabel: 'test-tier',
        groupTotal,
        ltm: ltmFee ? { fee: ltmFee } : null,
        fees: [
            ...oneTimeFees.map((amount) => ({ oneTime: true, amount })),
            ...perPieceFees.map((amount) => ({ oneTime: false, amount })),
        ],
    };
}

describe('ladder base formula — numeric lock (DTF double-LTM bug class)', () => {
    const quickQuoteBase = compileQuickQuoteFormula();
    const configuratorBase = compileConfiguratorFormula();

    test('DTF-style baked LTM: base strips the $50 so it is NOT double-shown next to the "+$50" row', () => {
        // qty 15 @ $10/pc + $50 LTM + $30 one-time setup → groupTotal $230.
        // Correct base = (230 − 30 − 50)/15 = $10.00. The pre-fix bug (deriving from
        // an LTM-inclusive baseUnit) showed ≈ $13.33 — ~$50 high over the group.
        const p = mockPreview({ perPiece: 10, qty: 15, ltmFee: 50, oneTimeFees: [30] });
        expect(quickQuoteBase(p, 15, r2)).toBe(10);
        expect(configuratorBase(p, 15, r2)).toBe(10);
    });

    test('EMB-style itemized LTM + digitizing: base excludes both LTM and one-time', () => {
        // qty 4 @ $18/pc + $50 LTM + $100 digitizing → groupTotal $222 → base $18.00
        const p = mockPreview({ perPiece: 18, qty: 4, ltmFee: 50, oneTimeFees: [100] });
        expect(quickQuoteBase(p, 4, r2)).toBe(18);
        expect(configuratorBase(p, 4, r2)).toBe(18);
    });

    test('no-LTM tier with multiple one-time fees: base is the pure per-piece', () => {
        // qty 36 @ $9.50/pc + $30 + $45 one-time screens → groupTotal $417 → base $9.50
        const p = mockPreview({ perPiece: 9.5, qty: 36, oneTimeFees: [30, 45] });
        expect(quickQuoteBase(p, 36, r2)).toBe(9.5);
        expect(configuratorBase(p, 36, r2)).toBe(9.5);
    });

    test('per-piece (non-oneTime) fees stay IN the base — only oneTime fees are stripped', () => {
        // qty 24 @ $12/pc, plus a $48 fee flagged oneTime:false (already scaled into
        // groupTotal by the engine, e.g. a stitch surcharge line) → base must include it.
        const oneTimeT = 0;
        const groupTotal = 12 * 24 + 48 + oneTimeT; // engine folded the per-piece fee in
        const p = {
            ok: true, lines: [{}], tierLabel: 't', groupTotal,
            ltm: null, fees: [{ oneTime: false, amount: 48 }],
        };
        expect(quickQuoteBase(p, 24, r2)).toBe(r2(groupTotal / 24)); // $14.00
        expect(configuratorBase(p, 24, r2)).toBe(r2(groupTotal / 24));
    });

    test('string fee amounts coerce numerically; junk amounts count as 0 (no NaN ladder)', () => {
        const p = mockPreview({ perPiece: 10, qty: 10, oneTimeFees: ['30'] });
        p.fees.push({ oneTime: true, amount: 'n/a' }); // must coerce to 0, not NaN
        expect(quickQuoteBase(p, 10, r2)).toBe(10);
        expect(configuratorBase(p, 10, r2)).toBe(10);
    });

    test('missing fees / ltm objects do not throw and derive the plain per-piece', () => {
        const p = { ok: true, lines: [{}], tierLabel: 't', groupTotal: 120, ltm: null, fees: undefined };
        expect(quickQuoteBase(p, 12, r2)).toBe(10);
        expect(configuratorBase(p, 12, r2)).toBe(10);
    });

    test('quick-quote clamps a pathological negative base to $0 (never a negative price row)', () => {
        // one-time fees exceeding groupTotal can only happen on a malformed preview —
        // the ladder must clamp, not render "−$2.50/pc".
        const p = { ok: true, lines: [{}], tierLabel: 't', groupTotal: 20, ltm: { fee: 50 }, fees: [] };
        expect(quickQuoteBase(p, 12, r2)).toBe(0);
    });

    test('cross-surface numeric parity: both files derive IDENTICAL bases over a scenario grid', () => {
        const scenarios = [];
        [4, 6, 15, 24, 36, 72, 145].forEach((qty) => {
            [7.25, 10, 13.37, 18.5].forEach((perPiece) => {
                [0, 50].forEach((ltmFee) => {
                    scenarios.push(mockPreview({ perPiece, qty, ltmFee, oneTimeFees: [0, 30, 100], _qty: qty }));
                    scenarios[scenarios.length - 1]._qty = qty;
                });
            });
        });
        scenarios.forEach((p) => {
            expect(configuratorBase(p, p._qty, r2)).toBe(quickQuoteBase(p, p._qty, r2));
        });
        expect(scenarios.length).toBeGreaterThan(40);
    });
});
