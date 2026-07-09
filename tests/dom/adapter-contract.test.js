/**
 * Adapter contract + nudge-tier locks in a REAL DOM (roadmap 1.14).
 *
 * QuoteBuilderBase validates the MethodAdapter contract at construction —
 * these tests prove, per builder, that `new QuoteBuilderBase(new Adapter())`
 * boots in a DOM without throwing (a dropped adapter method fails here, not
 * at click time in production).
 *
 * Also THE sync lock for quantity-nudge tiers: each adapter's getNudgeTiers()
 * must match the canonical per-method map inside quote-builder-utils.js
 * (renderQuantityNudge) — the two have drifted apart before (SCP 2026-06-19
 * remap). DTG joined via DtgAdapter (F1, 2026-07-09) — all 4 builders now
 * boot through the base.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');
// Pre-bundled by tests/dom/global-setup.js (esbuild cannot run inside jsdom).
const BUNDLES = path.join(__dirname, '.bundles');

// Canonical tiers (MEMORY "Quantity nudge tiers"; utils renderQuantityNudge map)
const CANONICAL = {
    dtg: [12, 24, 48, 72],
    dtf: [10, 24, 48, 72],
    scp: [24, 48, 72, 145],
    emb: [8, 24, 48, 72],
};

const ADAPTERS = [
    { key: 'emb', bundle: 'emb-adapter.cjs', className: 'EmbAdapter' },
    { key: 'scp', bundle: 'scp-adapter.cjs', className: 'ScpAdapter' },
    { key: 'dtf', bundle: 'dtf-adapter.cjs', className: 'DtfAdapter' },
    { key: 'dtg', bundle: 'dtg-adapter.cjs', className: 'DtgAdapter' },
];

const { QuoteBuilderBase } = require(path.join(BUNDLES, 'quote-builder-base.cjs'));

describe.each(ADAPTERS)('$className', ({ key, bundle, className }) => {
    const Adapter = require(path.join(BUNDLES, bundle))[className];

    test('satisfies the MethodAdapter contract (QuoteBuilderBase construction does not throw)', () => {
        const adapter = new Adapter();
        expect(() => new QuoteBuilderBase(adapter)).not.toThrow();
    });

    test('a dropped contract method fails base construction LOUDLY', () => {
        const adapter = new Adapter();
        adapter.getPricingService = undefined;
        expect(() => new QuoteBuilderBase(adapter)).toThrow(/missing required method/);
    });

    test(`getNudgeTiers() === canonical ${key.toUpperCase()} tiers`, () => {
        expect(new Adapter().getNudgeTiers()).toEqual(CANONICAL[key]);
    });
});

test('utils renderQuantityNudge map matches the SAME canonical tiers (all 4 incl. DTG)', () => {
    const src = fs.readFileSync(path.join(ROOT, 'shared_components/js/quote-builder-utils.js'), 'utf8');
    for (const [method, tiers] of Object.entries(CANONICAL)) {
        const re = new RegExp(`${method}:\\s*\\[${tiers.join(',\\s*')}\\]`);
        expect(src).toMatch(re);
    }
});
