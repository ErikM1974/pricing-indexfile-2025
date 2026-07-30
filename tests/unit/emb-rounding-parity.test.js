/**
 * All three EMB price surfaces must round identically. (Rule 9)
 *
 * Caspio sends RoundingMethod = 'HalfDollarCeil_Final'. Three implementations existed:
 *   embroidery-quote-pricing.js      KNOWN_HALF includes it        -> half dollar  ✓
 *   cap-embroidery-pricing-service.js  only 'CeilDollar' is whole  -> half dollar  ✓
 *   embroidery-pricing-service.js    tested only 'HalfDollarUp'    -> WHOLE dollar ✗
 * The live value matched neither branch of the third, so it fell through to Math.ceil and
 * priced $0.50 above the others on 195 of 380 real (style, tier) cells — putting Quick Quote
 * and the customer golf pages half a dollar off the quote builders.
 *
 * Nothing compared them numerically, and the fixture pinned 'HalfDollarUp', so tests took a
 * branch production never takes. This locks the actual behaviour of all three.
 *
 * The services keep roundPrice as an inner closure, so it is extracted and executed here —
 * a real behavioural test, not a source match: rewriting the logic still fails it.
 */
const fs = require('fs');
const path = require('path');
const Calc = require('../../shared_components/js/embroidery-quote-pricing.js');

const ROOT = path.join(__dirname, '..', '..', 'shared_components', 'js');

/** Pull `const roundPrice = (…) => { … }` out of a source file and make it callable. */
function extractRoundPrice(file) {
    const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
    const start = src.indexOf('const roundPrice = (');
    expect(start).toBeGreaterThan(-1);
    const open = src.indexOf('{', src.indexOf('=>', start));
    let depth = 0, end = -1;
    for (let i = open; i < src.length; i++) {
        if (src[i] === '{') depth++;
        else if (src[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
    }
    expect(end).toBeGreaterThan(open);
    // eslint-disable-next-line no-new-func
    return new Function(`return (price, roundingMethod) => ${src.slice(open, end + 1)}`)();
}

const garmentSvc = extractRoundPrice('embroidery-pricing-service.js');
const capSvc = extractRoundPrice('cap-embroidery-pricing-service.js');
const builder = (price, method) => {
    const c = new Calc({ skipInit: true });
    c.roundingMethod = method;
    return c.roundPrice(price);
};

// Raw decorated prices that land on halves, quarters and exact dollars.
const PRICES = [24.3585, 24.01, 24.49, 24.50, 24.51, 24.99, 25.00, 6.5091, 83.4999, 7.25, 30.75];

describe('HalfDollarCeil_Final — the value Caspio actually sends', () => {
    test.each(PRICES)('all three surfaces agree on %p', (p) => {
        const b = builder(p, 'HalfDollarCeil_Final');
        expect(garmentSvc(p, 'HalfDollarCeil_Final')).toBe(b);
        expect(capSvc(p, 'HalfDollarCeil_Final')).toBe(b);
    });

    test('and it means half-dollar, not whole-dollar', () => {
        // The exact regression: PC55 1-7 raw 24.3585 billed $25.00 via the service and
        // $24.50 via the builder.
        expect(builder(24.3585, 'HalfDollarCeil_Final')).toBe(24.5);
        expect(garmentSvc(24.3585, 'HalfDollarCeil_Final')).toBe(24.5);
        expect(capSvc(24.3585, 'HalfDollarCeil_Final')).toBe(24.5);
    });
});

describe('CeilDollar is the only whole-dollar method', () => {
    test.each(PRICES)('both services round %p up to the dollar', (p) => {
        expect(garmentSvc(p, 'CeilDollar')).toBe(Math.ceil(p));
        expect(capSvc(p, 'CeilDollar')).toBe(Math.ceil(p));
    });

    test('switching Caspio to CeilDollar moves every surface together', () => {
        // Stated so the lever is explicit: whole-dollar pricing is a Caspio field change,
        // not a code change. If this ever fails, one surface stopped honouring it.
        for (const p of PRICES) {
            expect(garmentSvc(p, 'CeilDollar')).toBe(builder(p, 'CeilDollar'));
            expect(capSvc(p, 'CeilDollar')).toBe(builder(p, 'CeilDollar'));
        }
    });
});

describe('an unknown or missing method degrades to half-dollar everywhere', () => {
    test.each([undefined, null, '', 'SomethingNew'])('method %p', (m) => {
        const b = builder(24.3585, m);
        expect(garmentSvc(24.3585, m)).toBe(b);
        expect(capSvc(24.3585, m)).toBe(b);
        expect(b).toBe(24.5);
    });
});

describe('legacy HalfDollarUp still behaves as half-dollar', () => {
    // The old fixture value; manual-cost mode still passes it.
    test.each(PRICES)('%p', (p) => {
        const b = builder(p, 'HalfDollarUp');
        expect(garmentSvc(p, 'HalfDollarUp')).toBe(b);
        expect(capSvc(p, 'HalfDollarUp')).toBe(b);
    });
});
