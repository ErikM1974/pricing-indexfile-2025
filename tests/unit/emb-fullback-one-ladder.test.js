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
