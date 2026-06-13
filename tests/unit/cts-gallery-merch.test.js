/**
 * Locks pages/js/cts-gallery-merch.js — the pure merchandising helpers behind
 * GET /api/cts/gallery-extras and the /custom-tees gallery cards (2026-06-12).
 * The PC54 description below is the REAL live Caspio Sanmar_Bulk value
 * (verified via /api/product-details 2026-06-12) — if SanMar's copy format
 * shifts, these tests say exactly which parse broke.
 */

const M = require('../../pages/js/cts-gallery-merch.js');

const PC54_DESC = 'An indispensable t-shirt in our classic silhouette&mdash;with a very friendly price.     5.4-ounce  100% cotton     98/2 cotton/poly (Ash)     90/10 cotton/poly (Athletic Heather)     50/50 cotton/poly (Black Heather  Dark Heather Grey)     Natural: Minimally processed.     Tear-away label';

describe('decodeEntities', () => {
    test('named + numeric entities', () => {
        expect(M.decodeEntities('a&mdash;b &amp; c&#8217;s')).toBe('a—b & c’s');
    });
    test('null/empty safe', () => {
        expect(M.decodeEntities(null)).toBe('');
        expect(M.decodeEntities('')).toBe('');
    });
});

describe('extractBlurb', () => {
    test('PC54: first selling sentence, entities decoded, fabric block dropped', () => {
        expect(M.extractBlurb(PC54_DESC))
            .toBe('An indispensable t-shirt in our classic silhouette—with a very friendly price.');
    });
    test('decimal weights never end a sentence ("5.4-ounce" has no dot+space)', () => {
        const blurb = M.extractBlurb('Soft 5.4-ounce cotton built for everyday wear. More specs here.');
        expect(blurb).toBe('Soft 5.4-ounce cotton built for everyday wear.');
    });
    test('no sentence end → word-boundary truncation with ellipsis', () => {
        const long = 'word '.repeat(60).trim();   // 299 chars, no punctuation
        const blurb = M.extractBlurb(long);
        expect(blurb.length).toBeLessThanOrEqual(141);
        expect(blurb.endsWith('…')).toBe(true);
    });
    test('empty → empty string', () => {
        expect(M.extractBlurb('')).toBe('');
        expect(M.extractBlurb(undefined)).toBe('');
    });
});

describe('extractSpecs (step-2 "About this shirt" panel)', () => {
    test('PC54: lead sentence + spec bullets, paren color lists NOT split', () => {
        const r = M.extractSpecs(PC54_DESC);
        expect(r.lead).toBe('An indispensable t-shirt in our classic silhouette—with a very friendly price.');
        expect(r.specs).toEqual([
            '5.4-ounce',
            '100% cotton',
            '98/2 cotton/poly (Ash)',
            '90/10 cotton/poly (Athletic Heather)',
            '50/50 cotton/poly (Black Heather Dark Heather Grey)',   // double-spaces INSIDE parens collapse, never split
            'Natural: Minimally processed.',
            'Tear-away label',
        ]);
    });
    test('single-space-only description → all lead, no bullets', () => {
        const r = M.extractSpecs('Retail fit Tear-away label Side seamed.');
        expect(r.lead).toBe('Retail fit Tear-away label Side seamed.');
        expect(r.specs).toEqual([]);
    });
    test('bullets capped at 12; empty/null safe', () => {
        const many = Array.from({ length: 20 }, (_, i) => `Spec ${i}`).join('   ');
        expect(M.extractSpecs(`Lead.   ${many}`).specs.length).toBe(12);
        expect(M.extractSpecs('')).toEqual({ lead: '', specs: [] });
        expect(M.extractSpecs(null)).toEqual({ lead: '', specs: [] });
    });
});

describe('extractFabric', () => {
    test('PC54: weight + 100% cotton', () => {
        expect(M.extractFabric(PC54_DESC)).toEqual({
            weightOz: '5.4', fiber: '100% cotton', label: '5.4 oz · 100% cotton',
        });
    });
    test('ring spun counts as 100% cotton', () => {
        expect(M.extractFabric('4.5-ounce, 100% ring spun cotton').fiber).toBe('100% cotton');
    });
    test('blend ratio when no 100% claim', () => {
        const f = M.extractFabric('7.8-ounce, 50/50 cotton/poly fleece');
        expect(f).toEqual({ weightOz: '7.8', fiber: '50/50 cotton/poly', label: '7.8 oz · 50/50 cotton/poly' });
    });
    test('tri-blend recognized', () => {
        expect(M.extractFabric('4.5-ounce poly/cotton/rayon tri-blend').fiber).toBe('Tri-blend');
    });
    test('nothing recognizable → nulls + empty label (card omits the chip)', () => {
        expect(M.extractFabric('A cap made of mystery.')).toEqual({ weightOz: null, fiber: null, label: '' });
    });
});

describe('pickVariedHeroColors', () => {
    const item = (style, ccs) => ({
        style,
        top_colors: ccs.map((cc, i) => ({ catalog_color: cc, color_name: cc, color_rank: i + 1 })),
    });

    test('de-dupes the repeated #1 color across neighboring cards', () => {
        const items = [
            item('A', ['Jet Black', 'White']),
            item('B', ['Jet Black', 'Navy']),
            item('C', ['Jet Black', 'Red']),
        ];
        const picks = M.pickVariedHeroColors(items, 3);
        expect(picks.A.catalog_color).toBe('Jet Black');   // first card keeps its top seller
        expect(picks.B.catalog_color).toBe('Navy');        // black seen → next-ranked
        expect(picks.C.catalog_color).toBe('Red');
    });

    test('falls back to the #1 color when every option was seen recently', () => {
        const items = [
            item('A', ['Jet Black']),
            item('B', ['Jet Black']),   // only option — must still get a hero
        ];
        const picks = M.pickVariedHeroColors(items, 3);
        expect(picks.B.catalog_color).toBe('Jet Black');
    });

    test('lookback window expires: the color comes back after N cards', () => {
        const items = [
            item('A', ['Jet Black']),
            item('B', ['White']),
            item('C', ['Jet Black', 'Navy']),   // lookback 1 → black already expired
        ];
        const picks = M.pickVariedHeroColors(items, 1);
        expect(picks.C.catalog_color).toBe('Jet Black');
    });

    test('deterministic (same input → same output) and null-safe', () => {
        const items = [item('A', ['Jet Black', 'White']), item('B', ['Jet Black'])];
        expect(M.pickVariedHeroColors(items, 3)).toEqual(M.pickVariedHeroColors(items, 3));
        expect(M.pickVariedHeroColors(null, 3)).toEqual({});
        expect(M.pickVariedHeroColors([{ style: 'X' }], 3)).toEqual({ X: null });
    });
});
