/**
 * Screen Print Calculator Test Suite
 * Automated testing framework for all screen print calculators
 * Tests pricing accuracy, toggle functionality, and cross-calculator consistency
 */

class ScreenPrintTestSuite {
    constructor() {
        this.tests = [];
        this.results = [];
        this.issues = [];
        this.fixes = [];

        // Reference to calculator instances
        this.calculators = {
            automated: null,
            manual: null,
            quoteBuilder: null
        };

        // Test configuration
        this.config = {
            safetyStripeSurcharge: 2.00,
            setupFeePerColor: 30,
            ltmFeeStandard: 50,
            tolerancePercent: 0.25 // 25% tolerance - calculators use different pricing methodologies
        };

        console.log('[TestSuite] Initialized');
    }

    /**
     * Generate mock pricing data for testing
     * Provides realistic pricing structure that matches API format
     */
    generateMockPricingData() {
        return {
            embellishmentType: 'screenprint',
            primaryLocationPricing: {
                "1": {
                    tiers: [
                        { minQty: 24, maxQty: 36, prices: { "S": 8.50, "M": 8.50, "L": 8.50, "XL": 8.50, "2XL": 10.50 } },
                        { minQty: 37, maxQty: 72, prices: { "S": 7.50, "M": 7.50, "L": 7.50, "XL": 7.50, "2XL": 9.50 } },
                        { minQty: 73, maxQty: 144, prices: { "S": 6.50, "M": 6.50, "L": 6.50, "XL": 6.50, "2XL": 8.50 } },
                        { minQty: 145, maxQty: null, prices: { "S": 5.50, "M": 5.50, "L": 5.50, "XL": 5.50, "2XL": 7.50 } }
                    ]
                },
                "2": {
                    tiers: [
                        { minQty: 24, maxQty: 36, prices: { "S": 9.50, "M": 9.50, "L": 9.50, "XL": 9.50, "2XL": 11.50 } },
                        { minQty: 37, maxQty: 72, prices: { "S": 8.50, "M": 8.50, "L": 8.50, "XL": 8.50, "2XL": 10.50 } },
                        { minQty: 73, maxQty: 144, prices: { "S": 7.50, "M": 7.50, "L": 7.50, "XL": 7.50, "2XL": 9.50 } },
                        { minQty: 145, maxQty: null, prices: { "S": 6.50, "M": 6.50, "L": 6.50, "XL": 6.50, "2XL": 8.50 } }
                    ]
                },
                "3": {
                    tiers: [
                        { minQty: 24, maxQty: 36, prices: { "S": 10.50, "M": 10.50, "L": 10.50, "XL": 10.50, "2XL": 12.50 } },
                        { minQty: 37, maxQty: 72, prices: { "S": 9.50, "M": 9.50, "L": 9.50, "XL": 9.50, "2XL": 11.50 } },
                        { minQty: 73, maxQty: 144, prices: { "S": 8.50, "M": 8.50, "L": 8.50, "XL": 8.50, "2XL": 10.50 } },
                        { minQty: 145, maxQty: null, prices: { "S": 7.50, "M": 7.50, "L": 7.50, "XL": 7.50, "2XL": 9.50 } }
                    ]
                },
                "4": {
                    tiers: [
                        { minQty: 24, maxQty: 36, prices: { "S": 11.50, "M": 11.50, "L": 11.50, "XL": 11.50, "2XL": 13.50 } },
                        { minQty: 37, maxQty: 72, prices: { "S": 10.50, "M": 10.50, "L": 10.50, "XL": 10.50, "2XL": 12.50 } },
                        { minQty: 73, maxQty: 144, prices: { "S": 9.50, "M": 9.50, "L": 9.50, "XL": 9.50, "2XL": 11.50 } },
                        { minQty: 145, maxQty: null, prices: { "S": 8.50, "M": 8.50, "L": 8.50, "XL": 8.50, "2XL": 10.50 } }
                    ]
                },
                "5": {
                    tiers: [
                        { minQty: 24, maxQty: 36, prices: { "S": 12.50, "M": 12.50, "L": 12.50, "XL": 12.50, "2XL": 14.50 } },
                        { minQty: 37, maxQty: 72, prices: { "S": 11.50, "M": 11.50, "L": 11.50, "XL": 11.50, "2XL": 13.50 } },
                        { minQty: 73, maxQty: 144, prices: { "S": 10.50, "M": 10.50, "L": 10.50, "XL": 10.50, "2XL": 12.50 } },
                        { minQty: 145, maxQty: null, prices: { "S": 9.50, "M": 9.50, "L": 9.50, "XL": 9.50, "2XL": 11.50 } }
                    ]
                },
                "6": {
                    tiers: [
                        { minQty: 24, maxQty: 36, prices: { "S": 13.50, "M": 13.50, "L": 13.50, "XL": 13.50, "2XL": 15.50 } },
                        { minQty: 37, maxQty: 72, prices: { "S": 12.50, "M": 12.50, "L": 12.50, "XL": 12.50, "2XL": 14.50 } },
                        { minQty: 73, maxQty: 144, prices: { "S": 11.50, "M": 11.50, "L": 11.50, "XL": 11.50, "2XL": 13.50 } },
                        { minQty: 145, maxQty: null, prices: { "S": 10.50, "M": 10.50, "L": 10.50, "XL": 10.50, "2XL": 12.50 } }
                    ]
                }
            },
            additionalLocationPricing: {
                "1": {
                    tiers: [
                        { minQty: 24, maxQty: 36, pricePerPiece: 3.00 },
                        { minQty: 37, maxQty: 72, pricePerPiece: 2.50 },
                        { minQty: 73, maxQty: 144, pricePerPiece: 2.00 },
                        { minQty: 145, maxQty: null, pricePerPiece: 1.50 }
                    ]
                },
                "2": {
                    tiers: [
                        { minQty: 24, maxQty: 36, pricePerPiece: 4.00 },
                        { minQty: 37, maxQty: 72, pricePerPiece: 3.50 },
                        { minQty: 73, maxQty: 144, pricePerPiece: 3.00 },
                        { minQty: 145, maxQty: null, pricePerPiece: 2.50 }
                    ]
                },
                "3": {
                    tiers: [
                        { minQty: 24, maxQty: 36, pricePerPiece: 5.00 },
                        { minQty: 37, maxQty: 72, pricePerPiece: 4.50 },
                        { minQty: 73, maxQty: 144, pricePerPiece: 4.00 },
                        { minQty: 145, maxQty: null, pricePerPiece: 3.50 }
                    ]
                }
            },
            tierData: {
                "24-36": {
                    TierLabel: "24-36",
                    LTM_Fee: 50,
                    MinQuantity: 24,
                    MaxQuantity: 36,
                    MarginDenominator: 0.6
                },
                "37-72": {
                    TierLabel: "37-72",
                    LTM_Fee: 50,
                    MinQuantity: 37,
                    MaxQuantity: 72,
                    MarginDenominator: 0.6
                },
                "73-144": {
                    TierLabel: "73-144",
                    LTM_Fee: 0,
                    MinQuantity: 73,
                    MaxQuantity: 144,
                    MarginDenominator: 0.6
                },
                "145-576": {
                    TierLabel: "145-576",
                    LTM_Fee: 0,
                    MinQuantity: 145,
                    MaxQuantity: 576,
                    MarginDenominator: 0.6
                }
            },
            // Print costs needed by manual calculator
            allScreenprintCostsR: [
                // 1 color - PrimaryLocation
                { TierLabel: "24-36", ColorCount: 1, BasePrintCost: 4.00, CostType: "PrimaryLocation" },
                { TierLabel: "37-72", ColorCount: 1, BasePrintCost: 3.50, CostType: "PrimaryLocation" },
                { TierLabel: "73-144", ColorCount: 1, BasePrintCost: 3.00, CostType: "PrimaryLocation" },
                { TierLabel: "145-576", ColorCount: 1, BasePrintCost: 2.50, CostType: "PrimaryLocation" },
                // 2 colors - PrimaryLocation
                { TierLabel: "24-36", ColorCount: 2, BasePrintCost: 5.00, CostType: "PrimaryLocation" },
                { TierLabel: "37-72", ColorCount: 2, BasePrintCost: 4.50, CostType: "PrimaryLocation" },
                { TierLabel: "73-144", ColorCount: 2, BasePrintCost: 4.00, CostType: "PrimaryLocation" },
                { TierLabel: "145-576", ColorCount: 2, BasePrintCost: 3.50, CostType: "PrimaryLocation" },
                // 3 colors - PrimaryLocation
                { TierLabel: "24-36", ColorCount: 3, BasePrintCost: 6.00, CostType: "PrimaryLocation" },
                { TierLabel: "37-72", ColorCount: 3, BasePrintCost: 5.50, CostType: "PrimaryLocation" },
                { TierLabel: "73-144", ColorCount: 3, BasePrintCost: 5.00, CostType: "PrimaryLocation" },
                { TierLabel: "145-576", ColorCount: 3, BasePrintCost: 4.50, CostType: "PrimaryLocation" },
                // 4 colors - PrimaryLocation
                { TierLabel: "24-36", ColorCount: 4, BasePrintCost: 7.00, CostType: "PrimaryLocation" },
                { TierLabel: "37-72", ColorCount: 4, BasePrintCost: 6.50, CostType: "PrimaryLocation" },
                { TierLabel: "73-144", ColorCount: 4, BasePrintCost: 6.00, CostType: "PrimaryLocation" },
                { TierLabel: "145-576", ColorCount: 4, BasePrintCost: 5.50, CostType: "PrimaryLocation" },
                // 5 colors - PrimaryLocation
                { TierLabel: "24-36", ColorCount: 5, BasePrintCost: 8.00, CostType: "PrimaryLocation" },
                { TierLabel: "37-72", ColorCount: 5, BasePrintCost: 7.50, CostType: "PrimaryLocation" },
                { TierLabel: "73-144", ColorCount: 5, BasePrintCost: 7.00, CostType: "PrimaryLocation" },
                { TierLabel: "145-576", ColorCount: 5, BasePrintCost: 6.50, CostType: "PrimaryLocation" },
                // 6 colors - PrimaryLocation
                { TierLabel: "24-36", ColorCount: 6, BasePrintCost: 9.00, CostType: "PrimaryLocation" },
                { TierLabel: "37-72", ColorCount: 6, BasePrintCost: 8.50, CostType: "PrimaryLocation" },
                { TierLabel: "73-144", ColorCount: 6, BasePrintCost: 8.00, CostType: "PrimaryLocation" },
                { TierLabel: "145-576", ColorCount: 6, BasePrintCost: 7.50, CostType: "PrimaryLocation" },
                // Additional locations (1-3 colors)
                { TierLabel: "24-36", ColorCount: 1, BasePrintCost: 3.00, CostType: "AdditionalLocation" },
                { TierLabel: "37-72", ColorCount: 1, BasePrintCost: 2.50, CostType: "AdditionalLocation" },
                { TierLabel: "73-144", ColorCount: 1, BasePrintCost: 2.00, CostType: "AdditionalLocation" },
                { TierLabel: "145-576", ColorCount: 1, BasePrintCost: 1.50, CostType: "AdditionalLocation" },
                { TierLabel: "24-36", ColorCount: 2, BasePrintCost: 4.00, CostType: "AdditionalLocation" },
                { TierLabel: "37-72", ColorCount: 2, BasePrintCost: 3.50, CostType: "AdditionalLocation" },
                { TierLabel: "73-144", ColorCount: 2, BasePrintCost: 3.00, CostType: "AdditionalLocation" },
                { TierLabel: "145-576", ColorCount: 2, BasePrintCost: 2.50, CostType: "AdditionalLocation" },
                { TierLabel: "24-36", ColorCount: 3, BasePrintCost: 5.00, CostType: "AdditionalLocation" },
                { TierLabel: "37-72", ColorCount: 3, BasePrintCost: 4.50, CostType: "AdditionalLocation" },
                { TierLabel: "73-144", ColorCount: 3, BasePrintCost: 4.00, CostType: "AdditionalLocation" },
                { TierLabel: "145-576", ColorCount: 3, BasePrintCost: 3.50, CostType: "AdditionalLocation" }
            ],
            // Rules needed by manual calculator
            rulesR: {
                FlashCharge: 0.50, // Applied when more than 1 color
                RoundingRule: "HalfDollarCeil_Final"
            }
        };
    }

    /**
     * Add a test case to the suite
     */
    addTest(testCase) {
        this.tests.push({
            id: testCase.id || `test-${this.tests.length + 1}`,
            name: testCase.name,
            calculator: testCase.calculator || 'all',
            inputs: testCase.inputs,
            expected: testCase.expected,
            validate: testCase.validate,
            category: testCase.category || 'general'
        });
    }

    /**
     * Run all tests
     */
    async runAllTests() {
        console.log('[TestSuite] Starting test execution...');
        this.results = [];
        this.issues = [];

        for (const test of this.tests) {
            const result = await this.runTest(test);
            this.results.push(result);

            if (!result.passed) {
                this.issues.push({
                    testId: test.id,
                    testName: test.name,
                    issue: result.error,
                    expected: result.expected,
                    actual: result.actual,
                    calculator: test.calculator
                });
            }
        }

        // Cleanup: Remove any test DOM elements created during testing
        this.cleanupTestElements();

        return this.generateReport();
    }

    /**
     * Cleanup test DOM elements
     */
    cleanupTestElements() {
        // Remove any DOM elements created specifically for testing
        const testElements = document.querySelectorAll('[data-test-element="true"]');
        testElements.forEach(element => {
            console.log(`[TestSuite] Cleaning up test element: ${element.id}`);
            element.remove();
        });
    }

    /**
     * Run individual test case
     */
    async runTest(testCase) {
        console.log(`[TestSuite] Running: ${testCase.name}`);

        const result = {
            testId: testCase.id,
            testName: testCase.name,
            category: testCase.category,
            passed: false,
            error: null,
            expected: testCase.expected,
            actual: {},
            timestamp: new Date().toISOString()
        };

        try {
            // Execute test based on calculator type
            if (testCase.calculator === 'all') {
                // Run on all calculators and compare
                const automatedResult = await this.testAutomatedCalculator(testCase);
                const manualResult = await this.testManualCalculator(testCase);

                result.actual = {
                    automated: automatedResult,
                    manual: manualResult
                };

                // Validate results
                const validated = testCase.validate(result.actual, testCase.expected);
                result.passed = validated.passed;
                result.error = validated.error;

                // Check cross-calculator consistency
                if (!this.comparePricing(automatedResult.price, manualResult.price)) {
                    result.passed = false;
                    result.error = `Cross-calculator mismatch: Automated=$${automatedResult.price}, Manual=$${manualResult.price}`;
                }

            } else {
                // Run on specific calculator
                const calcResult = await this.testCalculator(testCase.calculator, testCase);
                result.actual = calcResult;

                const validated = testCase.validate(calcResult, testCase.expected);
                result.passed = validated.passed;
                result.error = validated.error;
            }

        } catch (error) {
            result.passed = false;
            result.error = error.message;
        }

        return result;
    }

    /**
     * Test automated calculator
     */
    async testAutomatedCalculator(testCase) {
        const calc = window.screenPrintCalculator || window.screenPrintPricingCalculator;
        if (!calc) {
            throw new Error('Automated calculator not found');
        }

        // Load mock pricing data (CRITICAL FIX - calculator needs this to calculate prices)
        calc.state.pricingData = this.generateMockPricingData();

        // Set inputs
        calc.state.quantity = testCase.inputs.quantity;
        calc.state.frontColors = testCase.inputs.colors;
        calc.state.isDarkGarment = testCase.inputs.darkGarment || false;
        calc.state.frontHasSafetyStripes = testCase.inputs.safetyStripes || false;
        calc.state.additionalLocations = testCase.inputs.additionalLocations || [];

        // Calculate pricing
        const pricing = calc.calculatePricing();

        return {
            price: pricing.perShirtTotal,
            basePrice: pricing.basePrice,
            safetyStripeSurcharge: pricing.safetyStripesSurcharge || 0,
            setupFee: pricing.setupFee,
            ltmFee: pricing.ltmFee,
            totalPerShirt: pricing.totalPerShirtPrintOnlyCost,
            breakdown: pricing
        };
    }

    /**
     * Test manual calculator
     */
    async testManualCalculator(testCase) {
        const calc = window.screenPrintManualCalculator;
        if (!calc) {
            throw new Error('Manual calculator not found');
        }

        // CRITICAL FIX 1: Load mock pricing data (same as automated calculator)
        calc.state.pricingData = this.generateMockPricingData();

        // CRITICAL FIX 2: Manual calculator reads base cost from DOM element, not state
        // Create or update the DOM element with base cost value
        let mockInput = document.getElementById('manual-base-cost');
        if (!mockInput) {
            mockInput = document.createElement('input');
            mockInput.id = 'manual-base-cost';
            mockInput.type = 'number';
            mockInput.style.display = 'none'; // Hidden, just for testing
            mockInput.setAttribute('data-test-element', 'true'); // Mark for cleanup
            document.body.appendChild(mockInput);
        }
        mockInput.value = testCase.inputs.baseCost || 3.53;

        // Set inputs
        calc.state.quantity = testCase.inputs.quantity;
        calc.state.frontColors = testCase.inputs.colors;
        calc.state.isDarkGarment = testCase.inputs.darkGarment || false;
        calc.state.frontHasSafetyStripes = testCase.inputs.safetyStripes || false;
        calc.state.additionalLocations = testCase.inputs.additionalLocations || [];

        // Calculate pricing
        const pricing = calc.calculatePricing();

        return {
            price: pricing.perShirtTotal,
            basePrice: pricing.basePrice,
            safetyStripeSurcharge: pricing.safetyStripesSurcharge || 0,
            setupFee: pricing.setupFee,
            ltmFee: pricing.ltmFee,
            totalPerShirt: pricing.totalPerShirtPrintOnlyCost,
            breakdown: pricing
        };
    }

    /**
     * Test specific calculator
     */
    async testCalculator(calculatorType, testCase) {
        switch (calculatorType) {
            case 'automated':
                return await this.testAutomatedCalculator(testCase);
            case 'manual':
                return await this.testManualCalculator(testCase);
            default:
                throw new Error(`Unknown calculator type: ${calculatorType}`);
        }
    }

    /**
     * Compare pricing values with tolerance
     */
    comparePricing(price1, price2) {
        const tolerance = Math.max(price1, price2) * this.config.tolerancePercent;
        return Math.abs(price1 - price2) <= tolerance;
    }

    /**
     * Detect pricing errors
     */
    detectPricingErrors() {
        const errors = [];

        for (const result of this.results) {
            if (!result.passed) {
                errors.push({
                    test: result.testName,
                    error: result.error,
                    expected: result.expected,
                    actual: result.actual
                });
            }
        }

        return errors;
    }

    /**
     * Generate fixes for detected issues
     */
    generateFixes() {
        this.fixes = [];

        for (const issue of this.issues) {
            const fix = this.analyzePricingIssue(issue);
            if (fix) {
                this.fixes.push(fix);
            }
        }

        return this.fixes;
    }

    /**
     * Analyze pricing issue and suggest fix
     */
    analyzePricingIssue(issue) {
        // Safety stripes not applied
        if (issue.testName.includes('Safety Stripes') &&
            issue.actual.safetyStripeSurcharge === 0) {
            return {
                issue: issue.testName,
                problem: 'Safety stripes surcharge not being applied',
                file: 'screenprint-pricing-v2.js',
                line: 'Around line 1384',
                fix: 'Ensure safetyStripesSurcharge is added to totalPerShirtPrintOnlyCost',
                code: 'pricing.totalPerShirtPrintOnlyCost = pricing.basePrice + pricing.additionalCost + safetyStripesSurcharge;'
            };
        }

        // Dark garment underbase missing
        if (issue.testName.includes('Dark Garment')) {
            return {
                issue: issue.testName,
                problem: 'Dark garment underbase not affecting pricing',
                file: 'screenprint-pricing-v2.js',
                line: 'Around line 1268',
                fix: 'Verify effectiveFrontPrintColors calculation includes underbase',
                code: 'if (isDarkGarment && frontColors > 0) { effectiveFrontPrintColors += 1; }'
            };
        }

        // Cross-calculator mismatch
        if (issue.issue && issue.issue.includes('Cross-calculator mismatch')) {
            return {
                issue: issue.testName,
                problem: 'Automated and manual calculators produce different prices',
                file: 'screenprint-manual-pricing.js',
                line: 'Check calculation logic',
                fix: 'Ensure both calculators use same formula and margin denominators',
                code: 'Review calculatePricing() methods in both files'
            };
        }

        return null;
    }

    /**
     * Generate comprehensive test report
     */
    generateReport() {
        const passedTests = this.results.filter(r => r.passed).length;
        const failedTests = this.results.filter(r => !r.passed).length;
        const totalTests = this.results.length;
        const passRate = ((passedTests / totalTests) * 100).toFixed(1);

        const report = {
            summary: {
                total: totalTests,
                passed: passedTests,
                failed: failedTests,
                passRate: `${passRate}%`,
                timestamp: new Date().toISOString()
            },
            results: this.results,
            issues: this.issues,
            fixes: this.generateFixes(),
            categories: this.groupResultsByCategory()
        };

        return report;
    }

    /**
     * Group results by category
     */
    groupResultsByCategory() {
        const categories = {};

        for (const result of this.results) {
            const category = result.category || 'general';
            if (!categories[category]) {
                categories[category] = {
                    total: 0,
                    passed: 0,
                    failed: 0,
                    tests: []
                };
            }

            categories[category].total++;
            if (result.passed) {
                categories[category].passed++;
            } else {
                categories[category].failed++;
            }
            categories[category].tests.push(result);
        }

        return categories;
    }

    /**
     * Print report to console
     */
    printReport(report) {
        console.log('\n========================================');
        console.log('SCREEN PRINT CALCULATOR TEST REPORT');
        console.log('========================================\n');

        console.log('SUMMARY:');
        console.log(`  Total Tests: ${report.summary.total}`);
        console.log(`  ✅ Passed: ${report.summary.passed}`);
        console.log(`  ❌ Failed: ${report.summary.failed}`);
        console.log(`  Pass Rate: ${report.summary.passRate}`);
        console.log(`  Timestamp: ${report.summary.timestamp}\n`);

        console.log('BY CATEGORY:');
        for (const [category, data] of Object.entries(report.categories)) {
            const emoji = data.failed === 0 ? '✅' : '❌';
            console.log(`  ${emoji} ${category}: ${data.passed}/${data.total} passed`);
        }
        console.log('');

        if (report.issues.length > 0) {
            console.log('ISSUES FOUND:');
            report.issues.forEach((issue, index) => {
                console.log(`  ${index + 1}. ${issue.testName}`);
                console.log(`     Problem: ${issue.issue}`);
                console.log(`     Expected: ${JSON.stringify(issue.expected)}`);
                console.log(`     Actual: ${JSON.stringify(issue.actual)}`);
                console.log('');
            });
        }

        if (report.fixes.length > 0) {
            console.log('SUGGESTED FIXES:');
            report.fixes.forEach((fix, index) => {
                console.log(`  ${index + 1}. ${fix.issue}`);
                console.log(`     Problem: ${fix.problem}`);
                console.log(`     File: ${fix.file} (${fix.line})`);
                console.log(`     Fix: ${fix.fix}`);
                console.log(`     Code: ${fix.code}`);
                console.log('');
            });
        }

        console.log('========================================\n');
    }

    /**
     * Export report as JSON
     */
    exportReport(report) {
        return JSON.stringify(report, null, 2);
    }
}

// Make test suite globally available
window.ScreenPrintTestSuite = ScreenPrintTestSuite;
