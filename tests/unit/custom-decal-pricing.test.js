/**
 * Locks the oversize/custom-decal pricing math.
 *
 * This calculator moved to its own page on 2026-07-29 when
 * /calculators/sticker-manual-pricing.html was retired. It had NO test coverage
 * for its entire life, and it is the only surface in the repo that can price a
 * decal larger than 6×6 — so the move is the right moment to pin the arithmetic.
 *
 * computeDecalQuote() mirrors caspio-pricing-proxy
 * src/routes/custom-decal-pricing.js computeDecalQuote(). If that changes, this
 * file should fail.
 */

const { computeDecalQuote, decalTierLabel } =
    require('../../shared_components/js/custom-decal-pricing-page.js');

// Shape mirrors GET /api/custom-decal-pricing: tiers ascending by MaxSqFt, the
// last one open-ended. Rates chosen to make the tier boundaries obvious.
const RATES = {
    minMaterial: 90,
    safeRollWidthIn: 52,
    setupFee: { amount: 50, code: 'GRT-50' },
    tiers: [
        { MaxSqFt: 10,     RatePerSqFt: 18, floor: 0 },
        { MaxSqFt: 50,     RatePerSqFt: 12, floor: 180 },
        { MaxSqFt: 999999, RatePerSqFt: 9,  floor: 600 },
    ],
};

describe('decal square-foot math', () => {
    test('one size: (w × h ÷ 144) × qty', () => {
        // 12×12 = 1 sq ft each, ×10 = 10 sq ft — exactly on tier 1's ceiling.
        const q = computeDecalQuote([{ w: 12, h: 12, q: 10 }], RATES, {});
        expect(q.totalSqFt).toBe(10);
        expect(q.rate).toBe(18);
    });

    test('mixed sizes sum before the tier is chosen', () => {
        // The documented example on the page: 6×(6×6) + 10×(12×12) + 10×(18×18)
        // = 1.5 + 10 + 22.5 = 34 sq ft.
        const q = computeDecalQuote([
            { w: 6,  h: 6,  q: 6 },
            { w: 12, h: 12, q: 10 },
            { w: 18, h: 18, q: 10 },
        ], RATES, {});
        expect(q.totalSqFt).toBe(34);
        // 34 lands in tier 2 — this is the whole point of summing first. Pricing
        // each line in its own tier would put all three in tier 1 at $18.
        expect(q.rate).toBe(12);
        expect(q.material).toBe(408);      // 34 × 12
        expect(q.subtotal).toBe(458);      // + $50 setup
    });
});

describe('tier selection', () => {
    test('a total exactly on a boundary stays in the LOWER tier', () => {
        expect(computeDecalQuote([{ w: 12, h: 12, q: 10 }], RATES, {}).rate).toBe(18);  // 10.0 → tier 1
        expect(computeDecalQuote([{ w: 12, h: 12, q: 50 }], RATES, {}).rate).toBe(12);  // 50.0 → tier 2
    });

    test('a hair over the boundary moves up', () => {
        const q = computeDecalQuote([{ w: 12, h: 12, q: 11 }], RATES, {});
        expect(q.totalSqFt).toBe(11);
        expect(q.rate).toBe(12);
    });

    test('past the last boundary uses the open-ended tier', () => {
        const q = computeDecalQuote([{ w: 24, h: 24, q: 100 }], RATES, {}); // 400 sq ft
        expect(q.totalSqFt).toBe(400);
        expect(q.rate).toBe(9);
        expect(q.material).toBe(3600);
    });
});

describe('minimums — the cliff protection', () => {
    test('a tiny job is floored at the material minimum, not rate × sqft', () => {
        // 4×4 ×2 = 0.22 sq ft × $18 = $4.00. Nobody sells two decals for $4.
        const q = computeDecalQuote([{ w: 4, h: 4, q: 2 }], RATES, {});
        expect(q.material).toBe(90);
        expect(q.floorApplied).toBe(true);
    });

    test('a job just over a break can never cost less than one just under', () => {
        // This is why later tiers carry their own floor. 10 sq ft in tier 1 is
        // 10 × 18 = $180; 10.01 sq ft drops to $12/sqft = $120.12 without a
        // floor, so the customer would be punished for ordering LESS.
        const under = computeDecalQuote([{ w: 12, h: 12, q: 10 }], RATES, {});
        const over  = computeDecalQuote([{ w: 12, h: 12, q: 11 }], RATES, {});
        expect(under.material).toBe(180);
        expect(over.material).toBe(180);          // floored, not 132
        expect(over.floorApplied).toBe(true);
        expect(over.material).toBeGreaterThanOrEqual(under.material);
    });

    test('the floor stops applying once volume earns its way past it', () => {
        const q = computeDecalQuote([{ w: 12, h: 12, q: 20 }], RATES, {}); // 20 × 12 = 240
        expect(q.material).toBe(240);
        expect(q.floorApplied).toBe(false);
    });

    test('a floor warning is surfaced, not silent', () => {
        const q = computeDecalQuote([{ w: 4, h: 4, q: 2 }], RATES, {});
        expect(q.warnings.some(w => /minimum applied/i.test(w))).toBe(true);
    });
});

describe('setup fee and tax', () => {
    test('new art adds the GRT-50 setup', () => {
        const q = computeDecalQuote([{ w: 12, h: 12, q: 20 }], RATES, {});
        expect(q.setup).toBe(50);
        expect(q.subtotal).toBe(290);
    });

    test('art on file waives it', () => {
        const q = computeDecalQuote([{ w: 12, h: 12, q: 20 }], RATES, { artOnFile: true });
        expect(q.setup).toBe(0);
        expect(q.subtotal).toBe(240);
    });

    test('tax applies to material + setup, and rounds to the cent', () => {
        const q = computeDecalQuote([{ w: 12, h: 12, q: 20 }], RATES, { taxPct: 10.2 });
        expect(q.subtotal).toBe(290);
        expect(q.tax).toBe(29.58);        // 290 × 0.102 = 29.58
        expect(q.total).toBe(319.58);
    });

    test('no tax rate means no tax, not NaN', () => {
        const q = computeDecalQuote([{ w: 12, h: 12, q: 20 }], RATES, {});
        expect(q.tax).toBe(0);
        expect(q.total).toBe(290);
    });
});

describe('roll-width warning', () => {
    test('a decal over 52in on BOTH sides warns — it cannot be rotated to fit', () => {
        const q = computeDecalQuote([{ w: 60, h: 60, q: 1 }], RATES, {});
        expect(q.warnings.some(w => /Roland print\/cut width/.test(w))).toBe(true);
    });

    test('over on ONE side is fine — rotate it', () => {
        const q = computeDecalQuote([{ w: 60, h: 40, q: 1 }], RATES, {});
        expect(q.warnings.some(w => /Roland print\/cut width/.test(w))).toBe(false);
    });
});

describe('tier labels', () => {
    test('read as ranges, with the last one open-ended', () => {
        expect(decalTierLabel(RATES.tiers, 0)).toBe('Up to 10 sq ft');
        expect(decalTierLabel(RATES.tiers, 1)).toBe('10–50 sq ft');
        expect(decalTierLabel(RATES.tiers, 2)).toBe('Over 50 sq ft');
    });
});

describe('no hardcoded money', () => {
    test('every rate comes from the payload — swapping it swaps the price', () => {
        // Rule #6 as an assertion: if someone reintroduces a constant, the same
        // inputs against a different rate card would stop tracking.
        const doubled = JSON.parse(JSON.stringify(RATES));
        doubled.tiers.forEach(t => { t.RatePerSqFt *= 2; t.floor *= 2; });
        doubled.minMaterial *= 2;
        doubled.setupFee.amount *= 2;

        const base = computeDecalQuote([{ w: 12, h: 12, q: 20 }], RATES, {});
        const dbl  = computeDecalQuote([{ w: 12, h: 12, q: 20 }], doubled, {});
        expect(dbl.material).toBe(base.material * 2);
        expect(dbl.setup).toBe(base.setup * 2);
    });
});
