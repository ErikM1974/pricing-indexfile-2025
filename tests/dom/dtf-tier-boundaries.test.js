/**
 * DTF tier boundaries + minimum gate — A-grade Batch 2.2 money-math lock.
 *
 * DTF had no unit tests on tier resolution. Locks the REAL
 * DTFQuoteBuilder.prototype methods: nudge-map boundaries (10/24/48/72),
 * the API-derived minimum gate ("Min N" label under the floor), and the
 * fallback minimum of 10 when the pricing calculator hasn't loaded.
 */

const path = require('path');

// Pre-bundled by tests/dom/global-setup.js (esbuild cannot run inside jsdom).
const { DTFQuoteBuilder } = require(path.join(__dirname, '.bundles', 'dtf-quote-builder-class.cjs'));

function tierAt(qty, apiMin) {
    const receiver = {
        pricingCalculator: apiMin == null ? null : { getMinimumQuantity: () => apiMin },
        getMinimumQuantity: DTFQuoteBuilder.prototype.getMinimumQuantity,
    };
    return DTFQuoteBuilder.prototype.getTierForQuantity.call(receiver, qty);
}

describe('DTFQuoteBuilder.getTierForQuantity (Batch 2.2)', () => {
    test.each([
        [10, '10-23'],
        [23, '10-23'],
        [24, '24-47'],
        [47, '24-47'],
        [48, '48-71'],
        [71, '48-71'],
        [72, '72+'],
        [5000, '72+'],
    ])('qty %i → %s', (qty, label) => {
        expect(tierAt(qty)).toBe(label);
    });

    test('below the fallback minimum (calculator not loaded) → "Min 10"', () => {
        expect(tierAt(9)).toBe('Min 10');
    });

    test('API-derived minimum wins over the fallback (min 12 → qty 11 gated)', () => {
        expect(tierAt(11, 12)).toBe('Min 12');
        expect(tierAt(12, 12)).toBe('10-23');
    });
});
