/**
 * ShopWorks import — a Full Back is not an Additional Logo, and a cap logo is not a garment one.
 *
 * `result.services.additionalLogos` is a mixed bag: garment ALs, Full Backs ('fb') and cap logos
 * ('cb'/'cs') all land in the same array. `collectAlReviewItem()` used to fold every one of them
 * into a SINGLE review row hardcoded to `type:'AL'`, `isCap:false`, summing quantity across kinds
 * and taking `firstAL.stitchCount || 8000`. Three separate charges collapsed into one shape:
 *
 *   - a full back priced off the garment Additional-Logo tier instead of the DECG-FB ladder;
 *   - a cap logo priced off the GARMENT ladder, at the garment 8,000-stitch base rather than the
 *     cap 5,000 — and, because nothing ever set `globalAL.cap`, on a cap-ONLY order the charge
 *     reached no product at all and was silently unbilled;
 *   - the real position discarded, so the engine (which decides full back purely by
 *     `logo.position === 'Full Back'`) could never take the ladder branch from an import.
 *
 * Locks the split, the per-kind stitch bases, and that the ORDER quantity — not the summed
 * logo-line quantity — is what tiers the price.
 */
const path = require('path');
const esbuild = require('esbuild');

function loadModule() {
    const result = esbuild.buildSync({
        entryPoints: [path.join(__dirname, '../../../shared_components/js/builders/emb/shopworks-import.js')],
        bundle: true, format: 'cjs', target: 'es2020', write: false, logLevel: 'silent',
    });
    const doc = { getElementById: () => null, querySelectorAll: () => [], addEventListener() {} };
    const moduleObj = { exports: {} };
    new Function('module', 'exports', 'window', 'document', 'console', result.outputFiles[0].text)(
        moduleObj, moduleObj.exports,
        { document: doc, APP_CONFIG: { API: { BASE_URL: 'http://test' } } },
        doc, { log() {}, warn() {}, error() {} }
    );
    return moduleObj.exports;
}

const mod = loadModule();

const fb = (over = {}) => ({ position: 'Full Back', type: 'fb', quantity: 24, description: 'FB', ...over });
const cb = (over = {}) => ({ position: 'Cap Back', type: 'cb', quantity: 24, description: 'CB', ...over });
const cs = (over = {}) => ({ position: 'Cap Side', type: 'cs', quantity: 24, description: 'CS', ...over });
const al = (over = {}) => ({ position: 'Right Sleeve', type: 'al', quantity: 24, description: 'AL', unitPrice: 8, ...over });

describe('_groupAdditionalLogos splits by what the logo actually is', () => {
    test('each kind lands in its own bucket', () => {
        const g = mod._groupAdditionalLogos([al(), fb(), cb(), cs(), al()]);
        expect(g.garment).toHaveLength(2);
        expect(g.fullBack).toHaveLength(1);
        expect(g.cap).toHaveLength(2);   // cb AND cs are both cap logos
    });

    test('an unknown or missing type is treated as a garment AL, not dropped', () => {
        // Silently discarding an unrecognised logo would be an unbilled decoration — the exact
        // failure mode the cap path already had.
        const g = mod._groupAdditionalLogos([{ quantity: 5 }, { type: 'weird', quantity: 5 }]);
        expect(g.garment).toHaveLength(2);
        expect(g.cap).toHaveLength(0);
        expect(g.fullBack).toHaveLength(0);
    });

    test('case does not decide the price', () => {
        const g = mod._groupAdditionalLogos([fb({ type: 'FB' }), cb({ type: 'CB' })]);
        expect(g.fullBack).toHaveLength(1);
        expect(g.cap).toHaveLength(1);
    });
});

describe('collectAlReviewItem emits one row per kind', () => {
    // The module closes over its own embState, whose pricingCalculator is null under node — so
    // apiPrice comes back null and these assertions are about ROUTING (which row, what shape),
    // which is exactly what was broken. The prices themselves are locked by
    // tests/unit/emb-fullback-one-ladder.test.js.
    const rows = (logos, orderQty = 100) => {
        const out = [];
        mod.collectAlReviewItem(logos, out, orderQty);
        return out;
    };

    test('a mixed order produces THREE distinct rows, not one', () => {
        const out = rows([al(), fb(), cb()]);
        expect(out.map((r) => r.type).sort()).toEqual(['AL', 'CB', 'FB']);
    });

    test('the Full Back row carries the Full Back position — the engine keys off it', () => {
        const [row] = rows([fb()]);
        expect(row.type).toBe('FB');
        expect(row.position).toBe('Full Back');
        expect(row.isCap).toBe(false);
    });

    test('the Full Back row floors at the ladder minimum, not the garment AL base', () => {
        // 8000 was the old shared default and is below the 25,000 the ladder bills at.
        expect(rows([fb()])[0].stitchCount).toBe(25000);
        // an explicit stitch count is respected
        expect(rows([fb({ stitchCount: 40000 })])[0].stitchCount).toBe(40000);
    });

    test('the cap row is marked isCap and uses the CAP stitch base', () => {
        const [row] = rows([cb()]);
        // 'CB', not 'AL-CAP': the review modal reprices through getServiceUnitPrice via
        // `item.type.toLowerCase()`, which has a 'cb' case and no 'al-cap' one — an 'AL-CAP'
        // row would hit `default: return null` and read "(unavailable)" the moment a rep
        // edited the cap stitch count.
        expect(row.type).toBe('CB');
        expect(row.isCap).toBe(true);
        expect(row.stitchCount).toBe(5000);   // not the garment 8000
    });

    test('Cap Side rides the same cap row as Cap Back', () => {
        const out = rows([cb({ quantity: 10 }), cs({ quantity: 5 })]);
        const cap = out.find((r) => r.type === 'CB');
        expect(cap.quantity).toBe(15);
        expect(cap.isCap).toBe(true);
    });

    test('a garment AL is unchanged — the fix must not disturb the common case', () => {
        const [row] = rows([al()]);
        expect(row.type).toBe('AL');
        expect(row.isCap).toBe(false);
        expect(row.stitchCount).toBe(8000);
        expect(row.shopWorksPrice).toBe(8);
    });

    test('quantities are summed WITHIN a kind and never across kinds', () => {
        // The old single row summed a 24-piece full back with a 24-piece cap logo into 48.
        const out = rows([fb({ quantity: 24 }), cb({ quantity: 24 }), al({ quantity: 12 })]);
        expect(out.find((r) => r.type === 'FB').quantity).toBe(24);
        expect(out.find((r) => r.type === 'CB').quantity).toBe(24);
        expect(out.find((r) => r.type === 'AL').quantity).toBe(12);
    });

    test('the ShopWorks price survives onto every kind of row', () => {
        const out = rows([fb({ unitPrice: 32.5 }), cb({ unitPrice: 7 })]);
        expect(out.find((r) => r.type === 'FB').shopWorksPrice).toBe(32.5);
        expect(out.find((r) => r.type === 'CB').shopWorksPrice).toBe(7);
    });

    test('nothing in, nothing out', () => {
        expect(rows([])).toEqual([]);
    });
});
