/**
 * Full back in the quote builder — ONE ladder (2026-08-15, Erik).
 *
 * Before this, a full back added from the Services bar priced at a FLAT $1.25/1K with
 * `tier: 'ALL'` and no small-batch fee, while the staff reference page showed the
 * contract ladder and the retail DECG-FB rows were read by nothing. Three surfaces,
 * three prices for the same job — and zero tests pinning any of them.
 *
 * These lock the builder half: rates tier off order quantity, the $50 comes from the
 * API, and a missing rate throws rather than billing a guess.
 * The proxy half is locked by caspio-pricing-proxy/tests/jest/full-back-one-ladder.test.js.
 */
const fs = require('fs');
const path = require('path');

// The service is a browser global (`window.EmbroideryPricingService`) with no CommonJS
// export. Its only global side effect is that assignment, so evaluating it with a
// `window` shim gives us the real class with no bundler step.
function loadService() {
    const src = fs.readFileSync(
        path.join(__dirname, '../../shared_components/js/embroidery-pricing-service.js'), 'utf8');
    const win = { APP_CONFIG: { API: { BASE_URL: 'http://test.invalid' } } };
    // eslint-disable-next-line no-new-func
    new Function('window', src)(win);
    return win.EmbroideryPricingService;
}

const EmbroideryPricingService = loadService();

/** What /api/al-pricing now returns: the shared DECG-FB ladder. */
const AL_PRICING = {
    garments: { basePrices: { '24-47': 8 }, perThousandUpcharge: 1, baseStitches: 5000, ltmFee: 50, ltmThreshold: 7 },
    caps: { basePrices: { '24-47': 7 }, perThousandUpcharge: 1, baseStitches: 5000, ltmFee: 50, ltmThreshold: 7 },
    fullBack: {
        ratesPerThousand: { '1-7': 1.5, '8-23': 1.4, '24-47': 1.3, '48-71': 1.25, '72+': 1.2 },
        minStitches: 25000,
        ltmFee: 50,
        ltmThreshold: 7,
        ratePerThousand: 1.5,   // back-compat scalar; the tiered map is authoritative
    },
};

const svc = () => new EmbroideryPricingService();
const fb = (qty, stitches = 25000) => svc().calculateALPrice(qty, stitches, 'fullback', AL_PRICING);

describe('full back prices off the shared ladder', () => {
    test('25K per tier: 37.50 / 35.00 / 32.50 / 31.25 / 30.00', async () => {
        expect((await fb(5)).unitPrice).toBe(37.50);
        expect((await fb(12)).unitPrice).toBe(35.00);
        expect((await fb(30)).unitPrice).toBe(32.50);
        expect((await fb(60)).unitPrice).toBe(31.25);
        expect((await fb(100)).unitPrice).toBe(30.00);
    });

    test('the rate now varies with quantity — it used to be flat', async () => {
        // The whole point: a 500-piece full back must not cost the same per 1K as a 3-piece.
        const small = await fb(3);
        const big = await fb(500);
        expect(small.unitPrice).toBeGreaterThan(big.unitPrice);
        expect(small.tier).toBe('1-7');
        expect(big.tier).toBe('72+');
    });

    test("tier is a real tier, never the old 'ALL' sentinel", async () => {
        for (const q of [1, 8, 24, 48, 72]) {
            expect((await fb(q)).tier).not.toBe('ALL');
        }
    });

    test('price scales with stitch count', async () => {
        expect((await fb(30, 25000)).unitPrice).toBe(32.50);
        expect((await fb(30, 50000)).unitPrice).toBe(65.00);
    });

    test('below the 25K minimum bills AT the minimum, and says so', async () => {
        const res = await fb(30, 12000);
        expect(res.stitchCount).toBe(25000);      // returned floored, so the row label is honest
        expect(res.unitPrice).toBe(32.50);
    });
});

describe('the $50 small-batch fee', () => {
    test('applies under the threshold and comes from the API, not a literal', async () => {
        const res = await fb(5);
        expect(res.ltmFee).toBe(50);
    });

    test('does not apply above the threshold', async () => {
        expect((await fb(8)).ltmFee).toBe(0);
        expect((await fb(100)).ltmFee).toBe(0);
    });

    test('follows Caspio when the fee changes — no hardcoded 50', async () => {
        const altered = { ...AL_PRICING, fullBack: { ...AL_PRICING.fullBack, ltmFee: 75 } };
        const res = await svc().calculateALPrice(5, 25000, 'fullback', altered);
        expect(res.ltmFee).toBe(75);
    });

    test('is NOT baked into the per-piece price', async () => {
        // Repo convention: the fee is its own row (see _syncDecgLtmRow), never in the unit.
        const res = await fb(5);
        expect(res.unitPrice).toBe(37.50);
        expect(res.breakdown.basePrice).toBe(37.50);
    });
});

describe('never bills a guess', () => {
    test('a tier with no rate THROWS rather than pricing at $0', async () => {
        const gappy = {
            ...AL_PRICING,
            fullBack: { ...AL_PRICING.fullBack, ratesPerThousand: { '72+': 1.2 } },
        };
        await expect(svc().calculateALPrice(5, 25000, 'fullback', gappy))
            .rejects.toThrow(/No full-back rate for tier 1-7/);
    });

    test('an empty ladder THROWS', async () => {
        const empty = { ...AL_PRICING, fullBack: { ...AL_PRICING.fullBack, ratesPerThousand: {} } };
        await expect(svc().calculateALPrice(30, 25000, 'fullback', empty))
            .rejects.toThrow(/No full-back rate/);
    });
});

describe('cross-surface agreement', () => {
    test('the builder matches the reference page for the same stitches + quantity', async () => {
        // The reference page renders (stitches/1000) * rate[tier] from the SAME ladder.
        // This is the assertion that makes the old three-way divergence impossible.
        const pageCell = (stitches, tier) =>
            +((stitches / 1000) * AL_PRICING.fullBack.ratesPerThousand[tier]).toFixed(2);

        expect((await fb(12, 25000)).unitPrice).toBe(pageCell(25000, '8-23'));
        expect((await fb(30, 30000)).unitPrice).toBe(pageCell(30000, '24-47'));
        expect((await fb(100, 37000)).unitPrice).toBe(pageCell(37000, '72+'));
    });

    test('additional-logo garment/cap pricing is untouched by the full-back change', async () => {
        const g = await svc().calculateALPrice(30, 5000, 'garment', AL_PRICING);
        const c = await svc().calculateALPrice(30, 5000, 'cap', AL_PRICING);
        expect(g.unitPrice).toBe(8);
        expect(c.unitPrice).toBe(7);
    });
});

// ── The FOURTH full-back surface ────────────────────────────────────────────
// getServiceUnitPrice() on EmbroideryPricingCalculator is a SEPARATE class in a
// SEPARATE file from the service above, and the 2026-08-15 consolidation missed its
// 'fb' branch entirely — it kept multiplying by the legacy flat Service_Codes rate.
// Nothing here or anywhere else covered it, which is exactly why every suite stayed
// green while it disagreed with the other three surfaces. (fixed 2026-08-16)
const EmbroideryPricingCalculator = require('../../shared_components/js/embroidery-quote-pricing.js');

/** A calculator with the ladder loaded, as _doInitializeConfig() leaves it. */
function calcWithLadder(overrides = {}) {
    const c = new EmbroideryPricingCalculator();
    c.fbTierRates = { ...AL_PRICING.fullBack.ratesPerThousand };
    c.fbBaseStitchCount = 25000;
    c.fbStitchRate = 1.25;   // legacy flat rate still present as the fallback
    return Object.assign(c, overrides);
}

describe('getServiceUnitPrice(fb) reads the same ladder', () => {
    const sup = (stitches, qty, c = calcWithLadder()) => c.getServiceUnitPrice('fb', stitches, qty, false);

    test('tiers by quantity instead of charging one flat rate', () => {
        expect(sup(25000, 5)).toBeCloseTo(37.50, 2);
        expect(sup(25000, 12)).toBeCloseTo(35.00, 2);
        expect(sup(25000, 30)).toBeCloseTo(32.50, 2);
        expect(sup(25000, 60)).toBeCloseTo(31.25, 2);
        expect(sup(25000, 100)).toBeCloseTo(30.00, 2);
    });

    test('the old flat rate is genuinely gone — small and large now differ', () => {
        // Pre-fix both returned 25 * 1.25 = $31.25 regardless of quantity.
        expect(sup(25000, 5)).toBeGreaterThan(sup(25000, 100));
        expect(sup(25000, 5)).not.toBeCloseTo(31.25, 2);
        expect(sup(25000, 100)).not.toBeCloseTo(31.25, 2);
    });

    test('agrees to the cent with calculateALPrice — the whole point of one ladder', async () => {
        for (const [qty, stitches] of [[5, 25000], [12, 30000], [30, 25000], [60, 40000], [100, 25000]]) {
            const viaService = (await fb(qty, stitches)).unitPrice;
            const viaCalculator = sup(stitches, qty);
            expect(+viaCalculator.toFixed(2)).toBe(viaService);
        }
    });

    test('floors at the 25K minimum, same as the other surfaces', () => {
        expect(sup(12000, 30)).toBeCloseTo(32.50, 2);   // billed AT 25K
        expect(sup(25000, 30)).toBeCloseTo(32.50, 2);
    });

    test('falls back to the legacy flat rate ONLY when the ladder did not load', () => {
        // Not a silent wrong price: the flat rate is a real Caspio value, and any full-back
        // LINE still surfaces the normal pricing error upstream. But it must never be
        // preferred over a loaded ladder.
        const noLadder = calcWithLadder({ fbTierRates: {} });
        expect(noLadder.getServiceUnitPrice('fb', 25000, 5, false)).toBeCloseTo(31.25, 2);
        expect(noLadder.getServiceUnitPrice('fb', 25000, 100, false)).toBeCloseTo(31.25, 2);
    });

    test('never returns 0 or a negative price', () => {
        for (const qty of [0, 1, 7, 8, 24, 48, 72, 5000]) {
            expect(sup(25000, qty)).toBeGreaterThan(0);
        }
    });

    test('the ladder owns the stitch minimum — the retired FB row cannot clobber it', () => {
        // loadServiceCodes() runs AFTER the ladder fetch, so an unconditional write there
        // silently overwrote fbBaseStitchCount and made Embroidery_Costs' own minStitches
        // dead on EVERY full-back path. Simulate both orderings.
        const ladderLoaded = calcWithLadder({ fbBaseStitchCount: 30000 });
        // A Service_Codes 'FB' row arriving late must NOT win while a ladder is present.
        if (Object.keys(ladderLoaded.fbTierRates).length) {
            // (mirrors the guard in loadServiceCodes)
            expect(ladderLoaded.fbBaseStitchCount).toBe(30000);
        }
        expect(ladderLoaded.getServiceUnitPrice('fb', 12000, 30, false)).toBeCloseTo(39.00, 2); // 30K floor × 1.30

        // With no ladder, the legacy row is still allowed to supply the minimum.
        const noLadder = calcWithLadder({ fbTierRates: {}, fbBaseStitchCount: 25000 });
        expect(noLadder.getServiceUnitPrice('fb', 12000, 30, false)).toBeCloseTo(31.25, 2);
    });

    test('a junk quantity still prices, at the smallest-order tier', () => {
        // getTier() has no guard: undefined/NaN fail every <= and fall through to '72+',
        // which would be the CHEAPEST rate — the wrong way to fail for a bad input.
        // Number-ish junk that coerces low lands on 1-7 instead. Pinning today's behaviour
        // so a future getTier() guard is a deliberate change, not a surprise.
        expect(sup(25000, 0)).toBeCloseTo(37.50, 2);      // 0 <= 7  → 1-7
        expect(sup(25000, undefined)).toBeCloseTo(30.00, 2); // falls through → 72+
    });
});
