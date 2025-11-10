/**
 * Screen Print Calculator Test Cases
 * Comprehensive test scenarios for all features
 */

const ScreenPrintTestCases = [
    // ============================================
    // CATEGORY: BASIC PRICING
    // ============================================
    {
        id: 'basic-001',
        name: 'Basic Pricing - 48 qty, 3 colors, light garment',
        category: 'basic-pricing',
        calculator: 'all',
        inputs: {
            quantity: 48,
            colors: 3,
            darkGarment: false,
            safetyStripes: false,
            baseCost: 3.53
        },
        expected: {
            priceGreaterThan: 0,
            hasSetupFee: true,
            setupFee: 90 // 3 colors × $30
        },
        validate: (actual, expected) => {
            const automated = actual.automated || actual;
            const manual = actual.manual || actual;

            if (automated.price <= 0) {
                return { passed: false, error: 'Price should be greater than 0' };
            }

            if (automated.setupFee !== expected.setupFee) {
                return { passed: false, error: `Setup fee should be $${expected.setupFee}, got $${automated.setupFee}` };
            }

            return { passed: true };
        }
    },

    {
        id: 'basic-002',
        name: 'Tier 1 Pricing - 24-47 quantity range',
        category: 'basic-pricing',
        calculator: 'all',
        inputs: {
            quantity: 37,
            colors: 2,
            darkGarment: false,
            safetyStripes: false,
            baseCost: 3.53
        },
        expected: {
            tier: '37-72',
            ltmFee: 50
        },
        validate: (actual, expected) => {
            const automated = actual.automated || actual;

            if (automated.ltmFee !== expected.ltmFee) {
                return { passed: false, error: `LTM fee should be $${expected.ltmFee}, got $${automated.ltmFee}` };
            }

            return { passed: true };
        }
    },

    {
        id: 'basic-003',
        name: 'Tier 2 Pricing - 48-71 quantity range',
        category: 'basic-pricing',
        calculator: 'all',
        inputs: {
            quantity: 60,
            colors: 3,
            darkGarment: false,
            safetyStripes: false,
            baseCost: 3.53
        },
        expected: {
            tier: '48-71',
            ltmFee: 0
        },
        validate: (actual, expected) => {
            const automated = actual.automated || actual;

            if (automated.ltmFee !== expected.ltmFee) {
                return { passed: false, error: `LTM fee should be $${expected.ltmFee}, got $${automated.ltmFee}` };
            }

            return { passed: true };
        }
    },

    // ============================================
    // CATEGORY: SAFETY STRIPES
    // ============================================
    {
        id: 'safety-001',
        name: 'Safety Stripes Add $2.00 Surcharge',
        category: 'safety-stripes',
        calculator: 'all',
        inputs: {
            quantity: 48,
            colors: 3,
            darkGarment: false,
            safetyStripes: true,
            baseCost: 3.53
        },
        expected: {
            safetyStripeSurcharge: 2.00
        },
        validate: (actual, expected) => {
            const automated = actual.automated || actual;
            const manual = actual.manual || actual;

            if (automated.safetyStripeSurcharge !== expected.safetyStripeSurcharge) {
                return {
                    passed: false,
                    error: `Safety stripe surcharge should be $${expected.safetyStripeSurcharge}, got $${automated.safetyStripeSurcharge}`
                };
            }

            // Verify price difference (compare with safety stripes off)
            // This test assumes previous test ran with same params but safetyStripes: false

            return { passed: true };
        }
    },

    {
        id: 'safety-002',
        name: 'Safety Stripes with Dark Garment',
        category: 'safety-stripes',
        calculator: 'all',
        inputs: {
            quantity: 48,
            colors: 3,
            darkGarment: true,
            safetyStripes: true,
            baseCost: 3.53
        },
        expected: {
            safetyStripeSurcharge: 2.00,
            effectiveColors: 4 // 3 design + 1 underbase
        },
        validate: (actual, expected) => {
            const automated = actual.automated || actual;

            if (automated.safetyStripeSurcharge !== expected.safetyStripeSurcharge) {
                return {
                    passed: false,
                    error: `Safety stripe surcharge should be $${expected.safetyStripeSurcharge}, got $${automated.safetyStripeSurcharge}`
                };
            }

            return { passed: true };
        }
    },

    {
        id: 'safety-003',
        name: 'Safety Stripes on Additional Location',
        category: 'safety-stripes',
        calculator: 'all',
        inputs: {
            quantity: 48,
            colors: 3,
            darkGarment: false,
            safetyStripes: false,
            additionalLocations: [{
                location: 'back',
                colors: 2,
                hasSafetyStripes: true
            }],
            baseCost: 3.53
        },
        expected: {
            safetyStripeSurcharge: 2.00 // $2 for back location
        },
        validate: (actual, expected) => {
            const automated = actual.automated || actual;

            if (automated.safetyStripeSurcharge !== expected.safetyStripeSurcharge) {
                return {
                    passed: false,
                    error: `Safety stripe surcharge should be $${expected.safetyStripeSurcharge}, got $${automated.safetyStripeSurcharge}`
                };
            }

            return { passed: true };
        }
    },

    {
        id: 'safety-004',
        name: 'Multiple Safety Stripes Locations',
        category: 'safety-stripes',
        calculator: 'all',
        inputs: {
            quantity: 48,
            colors: 3,
            darkGarment: false,
            safetyStripes: true, // Front has safety stripes
            additionalLocations: [{
                location: 'back',
                colors: 2,
                hasSafetyStripes: true // Back also has safety stripes
            }],
            baseCost: 3.53
        },
        expected: {
            safetyStripeSurcharge: 4.00 // $2 front + $2 back
        },
        validate: (actual, expected) => {
            const automated = actual.automated || actual;

            if (automated.safetyStripeSurcharge !== expected.safetyStripeSurcharge) {
                return {
                    passed: false,
                    error: `Safety stripe surcharge should be $${expected.safetyStripeSurcharge}, got $${automated.safetyStripeSurcharge}`
                };
            }

            return { passed: true };
        }
    },

    // ============================================
    // CATEGORY: DARK GARMENT
    // ============================================
    {
        id: 'dark-001',
        name: 'Dark Garment Adds Underbase (Color Count +1)',
        category: 'dark-garment',
        calculator: 'all',
        inputs: {
            quantity: 48,
            colors: 3,
            darkGarment: true,
            safetyStripes: false,
            baseCost: 3.53
        },
        expected: {
            effectiveColors: 4,
            setupFee: 120 // 4 colors × $30
        },
        validate: (actual, expected) => {
            const automated = actual.automated || actual;

            if (automated.setupFee !== expected.setupFee) {
                return {
                    passed: false,
                    error: `Setup fee should be $${expected.setupFee} for 4 colors (3 + underbase), got $${automated.setupFee}`
                };
            }

            return { passed: true };
        }
    },

    {
        id: 'dark-002',
        name: 'Dark Garment with No Colors (No Underbase)',
        category: 'dark-garment',
        calculator: 'all',
        inputs: {
            quantity: 48,
            colors: 0,
            darkGarment: true,
            safetyStripes: false,
            baseCost: 3.53
        },
        expected: {
            effectiveColors: 0,
            setupFee: 0
        },
        validate: (actual, expected) => {
            const automated = actual.automated || actual;

            if (automated.setupFee !== expected.setupFee) {
                return {
                    passed: false,
                    error: `Setup fee should be $${expected.setupFee} for garment only, got $${automated.setupFee}`
                };
            }

            return { passed: true };
        }
    },

    // ============================================
    // CATEGORY: LTM FEE
    // ============================================
    {
        id: 'ltm-001',
        name: 'LTM Fee Applied at Minimum Tier',
        category: 'ltm-fee',
        calculator: 'all',
        inputs: {
            quantity: 24,
            colors: 2,
            darkGarment: false,
            safetyStripes: false,
            baseCost: 3.53
        },
        expected: {
            ltmFee: 50
        },
        validate: (actual, expected) => {
            const automated = actual.automated || actual;

            if (automated.ltmFee !== expected.ltmFee) {
                return {
                    passed: false,
                    error: `LTM fee should be $${expected.ltmFee}, got $${automated.ltmFee}`
                };
            }

            return { passed: true };
        }
    },

    {
        id: 'ltm-002',
        name: 'No LTM Fee Above Minimum',
        category: 'ltm-fee',
        calculator: 'all',
        inputs: {
            quantity: 72,
            colors: 3,
            darkGarment: false,
            safetyStripes: false,
            baseCost: 3.53
        },
        expected: {
            ltmFee: 0
        },
        validate: (actual, expected) => {
            const automated = actual.automated || actual;

            if (automated.ltmFee !== expected.ltmFee) {
                return {
                    passed: false,
                    error: `LTM fee should be $${expected.ltmFee}, got $${automated.ltmFee}`
                };
            }

            return { passed: true };
        }
    },

    // ============================================
    // CATEGORY: ADDITIONAL LOCATIONS
    // ============================================
    {
        id: 'addl-001',
        name: 'Additional Location - Back 2 Colors',
        category: 'additional-locations',
        calculator: 'all',
        inputs: {
            quantity: 48,
            colors: 3,
            darkGarment: false,
            safetyStripes: false,
            additionalLocations: [{
                location: 'back',
                colors: 2,
                hasSafetyStripes: false
            }],
            baseCost: 3.53
        },
        expected: {
            hasAdditionalCost: true,
            totalSetupColors: 5, // 3 front + 2 back
            setupFee: 150 // 5 colors × $30
        },
        validate: (actual, expected) => {
            const automated = actual.automated || actual;

            if (automated.setupFee !== expected.setupFee) {
                return {
                    passed: false,
                    error: `Setup fee should be $${expected.setupFee}, got $${automated.setupFee}`
                };
            }

            return { passed: true };
        }
    },

    {
        id: 'addl-002',
        name: 'Multiple Additional Locations',
        category: 'additional-locations',
        calculator: 'all',
        inputs: {
            quantity: 48,
            colors: 3,
            darkGarment: false,
            safetyStripes: false,
            additionalLocations: [
                { location: 'back', colors: 2, hasSafetyStripes: false },
                { location: 'left-sleeve', colors: 1, hasSafetyStripes: false }
            ],
            baseCost: 3.53
        },
        expected: {
            totalSetupColors: 6, // 3 front + 2 back + 1 sleeve
            setupFee: 180 // 6 colors × $30
        },
        validate: (actual, expected) => {
            const automated = actual.automated || actual;

            if (automated.setupFee !== expected.setupFee) {
                return {
                    passed: false,
                    error: `Setup fee should be $${expected.setupFee}, got $${automated.setupFee}`
                };
            }

            return { passed: true };
        }
    },

    // ============================================
    // CATEGORY: COLOR COUNT
    // ============================================
    {
        id: 'color-001',
        name: '1 Color Print',
        category: 'color-count',
        calculator: 'all',
        inputs: {
            quantity: 48,
            colors: 1,
            darkGarment: false,
            safetyStripes: false,
            baseCost: 3.53
        },
        expected: {
            setupFee: 30 // 1 color × $30
        },
        validate: (actual, expected) => {
            const automated = actual.automated || actual;

            if (automated.setupFee !== expected.setupFee) {
                return {
                    passed: false,
                    error: `Setup fee should be $${expected.setupFee}, got $${automated.setupFee}`
                };
            }

            return { passed: true };
        }
    },

    {
        id: 'color-002',
        name: '6 Color Print (Maximum)',
        category: 'color-count',
        calculator: 'all',
        inputs: {
            quantity: 48,
            colors: 6,
            darkGarment: false,
            safetyStripes: false,
            baseCost: 3.53
        },
        expected: {
            setupFee: 180 // 6 colors × $30
        },
        validate: (actual, expected) => {
            const automated = actual.automated || actual;

            if (automated.setupFee !== expected.setupFee) {
                return {
                    passed: false,
                    error: `Setup fee should be $${expected.setupFee}, got $${automated.setupFee}`
                };
            }

            return { passed: true };
        }
    },

    // ============================================
    // CATEGORY: COMPLEX SCENARIOS
    // ============================================
    {
        id: 'complex-001',
        name: 'All Features Combined - Ultimate Test',
        category: 'complex-scenarios',
        calculator: 'all',
        inputs: {
            quantity: 37, // LTM tier
            colors: 3,
            darkGarment: true, // +1 color for underbase
            safetyStripes: true, // +$2
            additionalLocations: [{
                location: 'back',
                colors: 2,
                hasSafetyStripes: true // +$2
            }],
            baseCost: 3.53
        },
        expected: {
            safetyStripeSurcharge: 4.00, // $2 front + $2 back
            effectiveColorsTotal: 7, // 4 front (3+underbase) + 3 back (2+underbase)
            setupFee: 210, // 7 colors × $30
            ltmFee: 50
        },
        validate: (actual, expected) => {
            const automated = actual.automated || actual;

            if (automated.safetyStripeSurcharge !== expected.safetyStripeSurcharge) {
                return {
                    passed: false,
                    error: `Safety stripe surcharge should be $${expected.safetyStripeSurcharge}, got $${automated.safetyStripeSurcharge}`
                };
            }

            if (automated.setupFee !== expected.setupFee) {
                return {
                    passed: false,
                    error: `Setup fee should be $${expected.setupFee}, got $${automated.setupFee}`
                };
            }

            if (automated.ltmFee !== expected.ltmFee) {
                return {
                    passed: false,
                    error: `LTM fee should be $${expected.ltmFee}, got $${automated.ltmFee}`
                };
            }

            return { passed: true };
        }
    },

    {
        id: 'complex-002',
        name: 'Edge Case - Minimum Quantity with Maximum Colors',
        category: 'complex-scenarios',
        calculator: 'all',
        inputs: {
            quantity: 24,
            colors: 6,
            darkGarment: true, // Would be 7 colors but capped at 6
            safetyStripes: true,
            baseCost: 3.53
        },
        expected: {
            safetyStripeSurcharge: 2.00,
            ltmFee: 50
        },
        validate: (actual, expected) => {
            const automated = actual.automated || actual;

            if (automated.safetyStripeSurcharge !== expected.safetyStripeSurcharge) {
                return {
                    passed: false,
                    error: `Safety stripe surcharge should be $${expected.safetyStripeSurcharge}, got $${automated.safetyStripeSurcharge}`
                };
            }

            if (automated.ltmFee !== expected.ltmFee) {
                return {
                    passed: false,
                    error: `LTM fee should be $${expected.ltmFee}, got $${automated.ltmFee}`
                };
            }

            return { passed: true };
        }
    }
];

// Make test cases globally available
window.ScreenPrintTestCases = ScreenPrintTestCases;
