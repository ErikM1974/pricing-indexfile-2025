/**
 * quick-quote-ladder.test.js — the line sheet's "Per pc + Small-batch fee" table must never
 * under-quote the engine at any quantity inside a tier (Erik 2026-09-16), and a price check
 * that fails must surface instead of silently dropping or lowering a column.
 *
 * Runs the real probeLadder() text from calculators/quick-quote/quick-quote.js against fake
 * engines that reproduce each method's small-order rounding:
 *   DTF — fee share floored to the cent, then the whole piece rounded UP to $0.50; freight
 *         steps at 50/100/200 pieces, inside the pricing tiers.
 *   EMB — fee added once to the order total.
 *   DTG — fee share floored to the cent and added to every piece.
 */
const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '../../calculators/quick-quote/quick-quote.js'), 'utf8').replace(/\r\n/g, '\n');
function extract(signature) {
    const start = SRC.indexOf(signature);
    expect(start).toBeGreaterThan(-1);
    const end = SRC.indexOf('\n    }\n', start);
    return SRC.slice(start, end + 6);
}
const PROBE_QTYS = new Function('return ' + SRC.match(/var PROBE_QTYS = (\{[^;]+\});/)[1])();
const parseRange = new Function(extract('function parseRange(label) {') + '\nreturn parseRange;')();
const r2 = v => Math.round((v + Number.EPSILON) * 100) / 100;

function ladderWith(engine) {
    const window = { QuoteCartEngine: engine };
    const METHODS = { dtf: { groups: () => ({}) }, emb: { groups: () => ({}) }, dtg: { groups: () => ({}) } };
    return new Function('METHODS', 'PROBE_QTYS', 'stdSizeFor', 'buildItemFor', 'engineDeps', 'parseRange', 'r2', 'window',
        extract('async function probeLadder(id, product, color) {') + '\nreturn probeLadder;')(
        METHODS, PROBE_QTYS, () => 'S', (def, product, color, sizes) => ({ sizes }), () => ({}), parseRange, r2, window);
}

const cents = v => Math.floor(v * 100 + 1e-9) / 100;
const halfUp = v => Math.ceil(v * 2 - 1e-9) / 2;
function tierFor(tiers, q) { return tiers.find(t => q >= t.min && q <= t.max); }
function engine(tiers, total, failAt = {}) {
    return {
        singleItemPreview: async item => {
            const q = item.sizes.S;
            if (failAt[q]) return { ok: false, error: { code: failAt[q], message: 'no price' } };
            const t = tierFor(tiers, q);
            if (!t) return { ok: false, error: { code: 'BELOW_MINIMUM', message: 'minimum' } };
            return {
                ok: true, lines: [{}], tierLabel: t.label, groupTotal: total(q, t), fees: [],
                ltm: t.fee ? { fee: t.fee } : null,
                trace: { tierTable: tiers.map(x => ({ minQty: x.min, label: x.label })) },
            };
        },
    };
}
const DTF_TIERS = [
    { label: '10-23', min: 10, max: 23, transfer: 9.5, fee: 50 },
    { label: '24-47', min: 24, max: 47, transfer: 7.25, fee: 0 },
    { label: '48-71', min: 48, max: 71, transfer: 6.1, fee: 0 },
    { label: '72+', min: 72, max: Infinity, transfer: 5.05, fee: 0 },
];
const freight = q => q >= 200 ? 0.2 : q >= 100 ? 0.3 : q >= 50 ? 0.45 : 0.75;
const dtfTotal = garment => (q, t) => q * halfUp(garment + t.transfer + 2 * freight(q) + 2 + (t.fee ? cents(t.fee / q) : 0));

function assertNeverUnder(ladder, tiers, total) {
    for (const t of tiers) {
        const row = ladder.find(r => r.range.min === t.min);
        expect(row).toBeTruthy();
        const last = Number.isFinite(t.max) ? t.max : t.min + 250;
        for (let q = t.min; q <= last; q++) {
            const shown = row.base * q + row.ltmFee;
            expect(shown).toBeGreaterThanOrEqual(total(q, t) - 1e-9);
        }
    }
}

test.each([8.9, 11.37, 14.02, 16.5, 21.83, 27.26])('DTF price breaks never under-quote any quantity (garment $%s)', async garment => {
    const total = dtfTotal(garment);
    const ladder = await ladderWith(engine(DTF_TIERS, total))('dtf', {}, {});
    expect(ladder.map(r => r.label)).toEqual(['10-23', '24-47', '48-71', '72+']);
    expect(ladder[0].ltmFee).toBe(50);
    assertNeverUnder(ladder, DTF_TIERS, total);
    // The shown price is still the tightest safe one: at most a cent above the worst quantity.
    const worst = Math.max(...Array.from({ length: 14 }, (_, i) => (total(10 + i, DTF_TIERS[0]) - 50) / (10 + i)));
    expect(ladder[0].base - worst).toBeLessThan(0.01 + 1e-9);
});

test('embroidery and DTG fee tiers keep the exact tier price', async () => {
    const tiers = [
        { label: '1-7', min: 1, max: 7, fee: 50, unit: 24 },
        { label: '8-23', min: 8, max: 23, fee: 0, unit: 24 },
        { label: '24-47', min: 24, max: 47, fee: 0, unit: 20 },
        { label: '48-71', min: 48, max: 71, fee: 0, unit: 19 },
        { label: '72+', min: 72, max: Infinity, fee: 0, unit: 18 },
    ];
    const emb = (q, t) => q * t.unit + t.fee;
    const embLadder = await ladderWith(engine(tiers, emb))('emb', {}, {});
    expect(embLadder.map(r => r.base)).toEqual([24, 24, 20, 19, 18]);
    assertNeverUnder(embLadder, tiers, emb);
    const dtg = (q, t) => q * (t.unit + (t.fee ? cents(t.fee / q) : 0));
    const dtgTiers = tiers.map((t, i) => i === 0 ? { ...t, label: '1-11 (LTM)', max: 11 } : i === 1 ? { ...t, label: '12-23', min: 12 } : t);
    const dtgLadder = await ladderWith(engine(dtgTiers, dtg))('dtg', {}, {});
    expect(dtgLadder.map(r => r.base)).toEqual([24, 24, 20, 19, 18]);
    assertNeverUnder(dtgLadder, dtgTiers, dtg);
});

test('a tier that moved in Caspio is priced at its new lowest quantity', async () => {
    const moved = DTF_TIERS.map(t => t.label === '48-71' ? { ...t, label: '50-71', min: 50 } : t.label === '24-47' ? { ...t, label: '24-49', max: 49 } : t);
    const total = dtfTotal(12);
    const ladder = await ladderWith(engine(moved, total))('dtf', {}, {});
    expect(ladder.map(r => r.label)).toEqual(['10-23', '24-49', '50-71', '72+']);
    expect(ladder.find(r => r.label === '50-71').sampleQuantity).toBe(50);
    assertNeverUnder(ladder, moved, total);
});

test.each(['PRICING_ERROR', 'PRICE_UNAVAILABLE', 'AUTHORITY_ERROR', 'API_ERROR'])('a %s in any pass is reported, not skipped', async code => {
    const total = dtfTotal(12);
    await expect(ladderWith(engine(DTF_TIERS, total, { 10: code }))('dtf', {}, {})).rejects.toThrow('Some quantity prices could not be checked');
    await expect(ladderWith(engine(DTF_TIERS, total, { 17: code }))('dtf', {}, {})).rejects.toThrow('Some quantity prices could not be checked');
});

test('below-minimum quantities are simply not a column', async () => {
    const withFloor = [{ label: '1-9', min: 1, max: 9, transfer: 0, fee: 0 }, ...DTF_TIERS];
    const eng = engine(DTF_TIERS, dtfTotal(12));
    eng.singleItemPreview = (orig => async item => {
        const p = await orig(item);
        if (p.trace) p.trace.tierTable = withFloor.map(x => ({ minQty: x.min, label: x.label }));
        return p;
    })(eng.singleItemPreview);
    const ladder = await ladderWith(eng)('dtf', {}, {});
    expect(ladder.map(r => r.label)).toEqual(['10-23', '24-47', '48-71', '72+']);
});
