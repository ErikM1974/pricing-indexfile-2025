/**
 * The EMB rounding-rule fallback must be VISIBLE (2026-08-17 pricing review).
 *
 * THE BUG THIS LOCKS: fetchRoundingRules()'s catch set
 * `this.roundingMethod = 'CeilDollar'` with only a console.warn. That is not a
 * no-op — the constructor default is `null`, and roundPrice() treats null as
 * HALF-dollar-up. So an API hiccup silently flipped every garment to WHOLE-dollar
 * rounding, up to +$0.49 a piece, with nothing on screen. Erik's #1 rule: a
 * fallback that MOVES A PRICE carries a visible warning.
 *
 * Reachable only when the pricing-bundle carried no rulesR.RoundingMethod AND
 * /api/pricing-rules failed — fetchRoundingRules is called from the `else` branch
 * (embroidery-quote-pricing.js), so it cannot clobber a good value.
 *
 * Deliberately NOT escalated to a hard error the way costFallbackUsed is in
 * quote-cart-engine.js: this only coarsens rounding by ≤$0.49 and always rounds
 * UP, so refusing to quote would take the customer catalog down over a rounding
 * hiccup. The rep is told; the number is still returned.
 */

const Calc = require('../../shared_components/js/embroidery-quote-pricing.js');

describe('roundingMethod default is meaningful', () => {
    test('null → HALF-dollar-up (not whole dollar)', () => {
        const c = new Calc({ skipInit: true });
        expect(c.roundingMethod).toBeNull();
        expect(c.roundPrice(24.10)).toBe(24.5);
        expect(c.roundPrice(24.51)).toBe(25);
    });

    test('CeilDollar → whole dollar — the flip is worth up to $0.49/pc', () => {
        const c = new Calc({ skipInit: true });
        c.roundingMethod = 'CeilDollar';
        expect(c.roundPrice(24.10)).toBe(25);

        const half = new Calc({ skipInit: true });
        expect(c.roundPrice(24.01) - half.roundPrice(24.01)).toBeCloseTo(0.5, 2);
    });
});

// fetch MUST be stubbed per-test. tests/setup.js only installs its stub when
// `fetch` is undefined, and Node 18 ships a native one — so an unstubbed test
// here silently hit the LIVE proxy (observed: 449 ms, and /api/pricing-rules
// answered 'HalfDollarCeil_Final', so the catch never ran and the assertion
// failed for the wrong reason). Deterministic stubs, no network.
describe('fetchRoundingRules — failure is FLAGGED, not silent', () => {
    const realFetch = global.fetch;
    afterEach(() => { global.fetch = realFetch; });

    test('API failure sets CeilDollar AND _roundingFallbackUsed', async () => {
        global.fetch = () => Promise.reject(new Error('network down'));
        const c = new Calc({ skipInit: true });
        expect(c._roundingFallbackUsed).toBeNull();

        await c.fetchRoundingRules();

        expect(c.roundingMethod).toBe('CeilDollar');
        expect(c._roundingFallbackUsed).toBeTruthy();
        expect(String(c._roundingFallbackUsed)).toMatch(/rounding/i);
        // The flip is the whole point: 24.10 now rounds to 25.00, not 24.50.
        expect(c.roundPrice(24.10)).toBe(25);
    });

    test('a non-OK response is also a failure, and is flagged', async () => {
        global.fetch = () => Promise.resolve({ ok: false, status: 503, statusText: 'down' });
        const c = new Calc({ skipInit: true });
        await c.fetchRoundingRules();
        expect(c.roundingMethod).toBe('CeilDollar');
        expect(c._roundingFallbackUsed).toBeTruthy();
    });

    test('a SUCCESSFUL fetch leaves no fallback flag', async () => {
        global.fetch = () => Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve([{ RuleName: 'RoundingMethod', RuleValue: 'HalfDollarUp' }]),
        });
        const c = new Calc({ skipInit: true });
        await c.fetchRoundingRules();
        expect(c.roundingMethod).toBe('HalfDollarUp');
        expect(c._roundingFallbackUsed).toBeNull();
        expect(c.roundPrice(24.10)).toBe(24.5);
    });

    test('the flag is STICKY — it describes how this calculator was configured', async () => {
        global.fetch = () => Promise.reject(new Error('network down'));
        const c = new Calc({ skipInit: true });
        await c.fetchRoundingRules();
        const flagged = c._roundingFallbackUsed;
        // calculateQuote() resets the per-RUN _costFallbackUsed; this one is
        // per-INIT and must survive, or a later quote reports clean rounding.
        expect(flagged).toBeTruthy();
        expect(c._roundingFallbackUsed).toBe(flagged);
    });
});
