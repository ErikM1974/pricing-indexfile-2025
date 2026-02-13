/**
 * Test helper — creates a pre-configured EmbroideryPricingCalculator
 * with default fallback values (no API calls).
 */
const EmbroideryPricingCalculator = require('../../shared_components/js/embroidery-quote-pricing.js');

/**
 * Create a calculator with known defaults for deterministic testing.
 * Uses the same defaults the constructor sets (lines 12-71 of pricing engine).
 * @param {Object} overrides - Optional property overrides
 * @returns {EmbroideryPricingCalculator}
 */
function createTestCalculator(overrides = {}) {
    const calc = new EmbroideryPricingCalculator({ skipInit: true });

    // Garment defaults (match constructor)
    calc.marginDenominator = 0.57;
    calc.ltmFee = 50.00;
    calc.digitizingFee = 100.00;
    calc.additionalStitchRate = 1.25;
    calc.baseStitchCount = 8000;
    calc.stitchIncrement = 1000;
    calc.roundingMethod = 'HalfDollarUp';
    calc.tiers = {
        '1-7': { embCost: 18.00, hasLTM: true },
        '8-23': { embCost: 18.00, hasLTM: false },
        '24-47': { embCost: 14.00, hasLTM: false },
        '48-71': { embCost: 13.00, hasLTM: false },
        '72+': { embCost: 12.00, hasLTM: false }
    };
    calc.stitchSurchargeTiers = [
        { max: 10000, fee: 0 },
        { max: 15000, fee: 4 },
        { max: 25000, fee: 10 }
    ];

    // Cap defaults
    calc.capTiers = {
        '1-7': { embCost: 14.00 },
        '8-23': { embCost: 14.00 },
        '24-47': { embCost: 11.00 },
        '48-71': { embCost: 10.00 },
        '72+': { embCost: 9.00 }
    };
    calc.capRoundingMethod = 'HalfDollarUp';
    calc.capAdditionalStitchRate = 1.00;
    calc.puffUpchargePerCap = 5.00;
    calc.patchUpchargePerCap = 5.00;
    calc.patchSetupFee = 50.00;

    calc.initialized = true;
    calc.capInitialized = true;

    // Apply any overrides
    Object.assign(calc, overrides);

    return calc;
}

module.exports = { createTestCalculator };
