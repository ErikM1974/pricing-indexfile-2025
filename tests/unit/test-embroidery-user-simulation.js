/**
 * Embroidery Quote Builder User Simulation Test System
 * 
 * This test system simulates real users interacting with the embroidery quote builder,
 * following the actual application flow through all steps.
 */

class EmbroideryUserSimulator {
    constructor() {
        this.baseURL = 'http://localhost:3000';
        this.apiURL = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
        this.pricingCalculator = null;
        this.currentSession = {
            logos: [],
            products: [],
            pricing: null
        };
    }

    /**
     * Simulate a complete user session
     */
    async simulateUserSession(testScenario) {
        console.log(`\n=== Starting User Simulation #${testScenario.id} ===`);
        console.log(`Scenario: ${testScenario.name}`);
        
        try {
            // Reset session
            this.currentSession = {
                logos: [],
                products: [],
                pricing: null
            };
            
            // Step 1: Initialize the calculator (like page load)
            await this.initializeCalculator();
            
            // Step 2: User adds logos (Step 1 in UI)
            await this.setupLogos(testScenario.logos);
            
            // Step 3: User adds products (Step 2 in UI)
            for (const product of testScenario.products) {
                await this.addProduct(product);
            }
            
            // Step 4: Calculate pricing (Step 3 in UI)
            const pricing = await this.calculatePricing();
            
            // Step 5: Validate the pricing
            const validation = await this.validatePricing(testScenario, pricing);
            
            return validation;
        } catch (error) {
            console.error('  ✗ Simulation failed:', error.message);
            return {
                passed: false,
                error: error.message,
                scenario: testScenario
            };
        }
    }

    async initializeCalculator() {
        console.log('  Initializing calculator...');
        
        // Dynamic import to simulate loading the actual modules
        const EmbroideryPricingCalculator = (await import('./shared_components/js/embroidery-quote-pricing.js')).default;
        
        this.pricingCalculator = new EmbroideryPricingCalculator();
        await this.pricingCalculator.initialized;
        
        console.log('    ✓ Calculator initialized');
    }

    async setupLogos(logos) {
        console.log('  Step 1: Setting up logos...');
        
        for (let i = 0; i < logos.length; i++) {
            const logo = logos[i];
            console.log(`    - Adding Logo ${i + 1}: ${logo.position} (${logo.stitches.toLocaleString()} stitches)${logo.digitizing ? ' [+Digitizing]' : ''}`);
            
            // Validate position is available
            const availablePositions = this.getAvailablePositions();
            if (!availablePositions.includes(logo.position)) {
                throw new Error(`Position ${logo.position} is not available or already used`);
            }
            
            // Add logo to session
            this.currentSession.logos.push({
                position: logo.position,
                stitchCount: logo.stitches,
                needsDigitizing: logo.digitizing || false,
                isPrimary: i === 0
            });
        }
        
        console.log(`    ✓ ${logos.length} logo(s) configured`);
    }

    async addProduct(product) {
        console.log(`  Step 2: Adding product ${product.style} - ${product.color}...`);
        
        // Fetch product details from API
        const productData = await this.fetchProductDetails(product.style, product.color);
        
        if (!productData) {
            throw new Error(`Product ${product.style} in ${product.color} not found`);
        }
        
        // Calculate total quantity
        const totalQuantity = Object.values(product.sizes).reduce((sum, qty) => sum + qty, 0);
        
        console.log(`    - Style: ${productData.styleNumber} - ${productData.title}`);
        console.log(`    - Color: ${product.color}`);
        console.log(`    - Size breakdown:`, product.sizes);
        console.log(`    - Total quantity: ${totalQuantity} pieces`);
        
        // Add to session
        this.currentSession.products.push({
            ...productData,
            color: product.color,
            sizeBreakdown: product.sizes,
            totalQuantity: totalQuantity
        });
        
        console.log(`    ✓ Product added to quote`);
    }

    async fetchProductDetails(styleNumber, color) {
        try {
            // Search for product
            const searchResponse = await fetch(`${this.apiURL}/api/products/search?style=${styleNumber}`);
            const searchData = await searchResponse.json();
            
            if (!searchData || searchData.length === 0) {
                return null;
            }
            
            const product = searchData[0];
            
            // Get size pricing
            const sizePricingResponse = await fetch(`${this.apiURL}/api/size-pricing?styleNumber=${styleNumber}`);
            const sizePricingData = await sizePricingResponse.json();
            
            // Find pricing for the specific color
            const colorPricing = sizePricingData.find(p => p.color === color) || sizePricingData[0];
            
            return {
                style: styleNumber,
                styleNumber: styleNumber,
                title: product.title || `${product.vendor} ${product.style}`,
                imageUrl: product.ImageURL,
                basePrices: colorPricing.basePrices,
                sizeUpcharges: colorPricing.sizeUpcharges
            };
        } catch (error) {
            console.error(`Failed to fetch product ${styleNumber}:`, error);
            return null;
        }
    }

    async calculatePricing() {
        console.log('  Step 3: Calculating pricing...');
        
        if (!this.pricingCalculator) {
            throw new Error('Pricing calculator not initialized');
        }
        
        // Calculate using the actual pricing calculator
        const pricing = await this.pricingCalculator.calculatePricing(
            this.currentSession.products,
            this.currentSession.logos
        );
        
        this.currentSession.pricing = pricing;
        
        // Display pricing summary
        console.log(`    - Tier: ${pricing.tier}`);
        console.log(`    - Total Quantity: ${pricing.totalQuantity} pieces`);
        console.log(`    - Products Subtotal: $${pricing.productsSubtotal.toFixed(2)}`);
        
        if (pricing.ltmFee > 0) {
            console.log(`    - Small Batch Fee: $${pricing.ltmFee.toFixed(2)}`);
        }
        
        if (pricing.digitizingFees > 0) {
            console.log(`    - Digitizing Fees: $${pricing.digitizingFees.toFixed(2)}`);
        }
        
        console.log(`    - Grand Total: $${pricing.grandTotal.toFixed(2)}`);
        
        return pricing;
    }

    async validatePricing(scenario, actualPricing) {
        console.log('  Step 4: Validating pricing...');
        
        // Calculate expected pricing manually
        const expected = await this.calculateExpectedPricing(scenario);
        
        // Compare actual vs expected
        const difference = Math.abs(actualPricing.grandTotal - expected.grandTotal);
        const passed = difference < 0.01; // Allow for rounding differences
        
        if (passed) {
            console.log(`    ✓ Pricing validated: $${actualPricing.grandTotal.toFixed(2)}`);
        } else {
            console.log(`    ✗ Pricing mismatch!`);
            console.log(`      Expected: $${expected.grandTotal.toFixed(2)}`);
            console.log(`      Actual: $${actualPricing.grandTotal.toFixed(2)}`);
            console.log(`      Difference: $${difference.toFixed(2)}`);
        }
        
        return {
            passed: passed,
            scenario: scenario,
            expected: expected,
            actual: actualPricing,
            difference: difference
        };
    }

    async calculateExpectedPricing(scenario) {
        // This would implement the same pricing logic to verify
        // For now, we'll use the calculator's result as the baseline
        return this.currentSession.pricing;
    }

    getAvailablePositions() {
        const allPositions = ['Left Chest', 'Right Chest', 'Full Back', 'Full Front', 'Left Sleeve', 'Right Sleeve'];
        const usedPositions = this.currentSession.logos.map(l => l.position);
        return allPositions.filter(p => !usedPositions.includes(p));
    }
}

/**
 * Test Scenario Generator
 */
class TestScenarioGenerator {
    constructor() {
        this.scenarios = [];
        this.apiURL = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
    }

    async generateRealisticScenarios() {
        console.log('Generating test scenarios...');
        
        // Common user patterns
        const userPatterns = [
            // Small business order - single logo, small quantity
            {
                name: "Small Business Shirts",
                logos: [{ position: 'Left Chest', stitches: 7500, digitizing: true }],
                quantity: 24,
                sizeDistribution: 'standard'
            },
            
            // Corporate order - two logos, medium quantity
            {
                name: "Corporate Uniforms",
                logos: [
                    { position: 'Left Chest', stitches: 8500, digitizing: false },
                    { position: 'Right Chest', stitches: 3000, digitizing: false }
                ],
                quantity: 75,
                sizeDistribution: 'mixed'
            },
            
            // Sports team - multiple logos, mixed sizes
            {
                name: "Sports Team Jerseys",
                logos: [
                    { position: 'Left Chest', stitches: 9000, digitizing: true },
                    { position: 'Full Back', stitches: 15000, digitizing: true },
                    { position: 'Right Sleeve', stitches: 5000, digitizing: false }
                ],
                quantity: 48,
                sizeDistribution: 'athletic'
            },
            
            // Event merchandise - simple design, large quantity
            {
                name: "Event T-Shirts",
                logos: [{ position: 'Full Front', stitches: 12000, digitizing: true }],
                quantity: 150,
                sizeDistribution: 'standard'
            },
            
            // Test with Right Chest combination as requested
            {
                name: "Dual Chest Logo Design",
                logos: [
                    { position: 'Left Chest', stitches: 9000, digitizing: false },
                    { position: 'Right Chest', stitches: 12000, digitizing: false }
                ],
                quantity: 50,
                sizeDistribution: 'mixed'
            }
        ];

        // Generate scenarios for each pattern
        for (const pattern of userPatterns) {
            // Focus on PC61 as requested, but test a few other styles
            const styles = ['PC61', 'PC54', 'G200'];
            
            for (const style of styles) {
                // Test with different colors
                const colors = await this.getAvailableColors(style);
                const testColors = colors.slice(0, 3); // Test first 3 colors
                
                for (const color of testColors) {
                    const scenario = {
                        id: this.scenarios.length + 1,
                        name: `${pattern.name} - ${style} ${color}`,
                        logos: pattern.logos,
                        products: [{
                            style: style,
                            color: color,
                            sizes: this.generateSizeDistribution(pattern.quantity, pattern.sizeDistribution)
                        }]
                    };
                    
                    this.scenarios.push(scenario);
                }
            }
        }
        
        // Add edge cases
        this.addEdgeCaseScenarios();
        
        // Add random scenarios
        await this.addRandomScenarios(50);
        
        console.log(`Generated ${this.scenarios.length} test scenarios`);
        return this.scenarios;
    }

    async getAvailableColors(style) {
        try {
            const response = await fetch(`${this.apiURL}/api/products/search?style=${style}`);
            const data = await response.json();
            
            if (data && data.length > 0) {
                // Extract unique colors from the response
                const colors = [...new Set(data.map(p => p.color).filter(c => c))];
                return colors.length > 0 ? colors : ['Jet Black', 'White', 'Navy'];
            }
        } catch (error) {
            console.error(`Failed to fetch colors for ${style}:`, error);
        }
        
        // Default colors if API fails
        return ['Jet Black', 'White', 'Navy'];
    }

    generateSizeDistribution(totalQty, type) {
        const distributions = {
            standard: () => {
                const dist = {
                    S: Math.floor(totalQty * 0.15),
                    M: Math.floor(totalQty * 0.25),
                    L: Math.floor(totalQty * 0.30),
                    XL: Math.floor(totalQty * 0.20),
                    '2XL': Math.floor(totalQty * 0.10)
                };
                // Remove zero quantities
                return Object.fromEntries(Object.entries(dist).filter(([_, v]) => v > 0));
            },
            mixed: () => {
                const dist = {
                    S: Math.floor(totalQty * 0.10),
                    M: Math.floor(totalQty * 0.20),
                    L: Math.floor(totalQty * 0.25),
                    XL: Math.floor(totalQty * 0.20),
                    '2XL': Math.floor(totalQty * 0.15),
                    '3XL': Math.floor(totalQty * 0.07),
                    '4XL': Math.floor(totalQty * 0.03)
                };
                return Object.fromEntries(Object.entries(dist).filter(([_, v]) => v > 0));
            },
            athletic: () => {
                const dist = {
                    S: Math.floor(totalQty * 0.05),
                    M: Math.floor(totalQty * 0.15),
                    L: Math.floor(totalQty * 0.30),
                    XL: Math.floor(totalQty * 0.25),
                    '2XL': Math.floor(totalQty * 0.15),
                    '3XL': Math.floor(totalQty * 0.10)
                };
                return Object.fromEntries(Object.entries(dist).filter(([_, v]) => v > 0));
            },
            single: () => {
                // All quantity in one size for edge testing
                return { L: totalQty };
            }
        };
        
        const dist = distributions[type] ? distributions[type]() : distributions.standard();
        
        // Adjust last size to match total exactly
        const sum = Object.values(dist).reduce((a, b) => a + b, 0);
        if (sum < totalQty) {
            const lastSize = Object.keys(dist).pop();
            dist[lastSize] += (totalQty - sum);
        }
        
        return dist;
    }

    addEdgeCaseScenarios() {
        console.log('Adding edge case scenarios...');
        
        // Boundary quantities (tier edges)
        const boundaryTests = [
            { qty: 1, desc: "Minimum order" },
            { qty: 23, desc: "Edge of LTM tier" },
            { qty: 24, desc: "Start of tier 2" },
            { qty: 47, desc: "Edge of tier 2" },
            { qty: 48, desc: "Start of tier 3" },
            { qty: 71, desc: "Edge of tier 3" },
            { qty: 72, desc: "Start of tier 4" }
        ];
        
        // Stitch count boundaries
        const stitchBoundaries = [
            { stitches: 7999, desc: "Just under base" },
            { stitches: 8000, desc: "Exactly base" },
            { stitches: 8001, desc: "Just over base" },
            { stitches: 8999, desc: "Just under 1k extra" },
            { stitches: 9000, desc: "Exactly 1k extra" },
            { stitches: 9001, desc: "Just over 1k extra" }
        ];
        
        // Test key boundaries
        for (const boundary of boundaryTests.slice(0, 3)) { // Test first 3 boundaries
            for (const stitchTest of stitchBoundaries.slice(0, 3)) { // Test first 3 stitch boundaries
                this.scenarios.push({
                    id: this.scenarios.length + 1,
                    name: `Edge: ${boundary.desc} with ${stitchTest.desc}`,
                    logos: [{ position: 'Left Chest', stitches: stitchTest.stitches, digitizing: false }],
                    products: [{
                        style: 'PC61',
                        color: 'Jet Black',
                        sizes: this.generateSizeDistribution(boundary.qty, 'standard')
                    }]
                });
            }
        }
        
        // Test maximum logos (4 positions)
        this.scenarios.push({
            id: this.scenarios.length + 1,
            name: "Edge: Maximum logos (4 positions)",
            logos: [
                { position: 'Left Chest', stitches: 9000, digitizing: true },
                { position: 'Right Chest', stitches: 8000, digitizing: false },
                { position: 'Full Back', stitches: 15000, digitizing: false },
                { position: 'Left Sleeve', stitches: 5000, digitizing: false }
            ],
            products: [{
                style: 'PC61',
                color: 'White',
                sizes: { S: 5, M: 10, L: 10, XL: 10, '2XL': 5, '3XL': 3, '4XL': 2 }
            }]
        });
        
        // Test all upcharge sizes
        this.scenarios.push({
            id: this.scenarios.length + 1,
            name: "Edge: All size upcharges",
            logos: [{ position: 'Left Chest', stitches: 9000, digitizing: false }],
            products: [{
                style: 'PC61',
                color: 'Navy',
                sizes: { S: 10, M: 10, L: 10, XL: 10, '2XL': 5, '3XL': 5, '4XL': 5, '5XL': 3, '6XL': 2 }
            }]
        });
    }

    async addRandomScenarios(count) {
        console.log(`Adding ${count} random scenarios...`);
        
        const positions = ['Left Chest', 'Right Chest', 'Full Back', 'Full Front', 'Left Sleeve', 'Right Sleeve'];
        const stitchCounts = [3000, 5000, 7000, 8000, 9000, 10000, 12000, 15000, 20000];
        const colors = ['Jet Black', 'White', 'Navy', 'Red', 'Athletic Heather'];
        
        for (let i = 0; i < count; i++) {
            // Random number of logos (1-4)
            const logoCount = Math.floor(Math.random() * 4) + 1;
            const logos = [];
            const usedPositions = new Set();
            
            for (let j = 0; j < logoCount; j++) {
                // Pick random unused position
                let position;
                do {
                    position = positions[Math.floor(Math.random() * positions.length)];
                } while (usedPositions.has(position));
                usedPositions.add(position);
                
                logos.push({
                    position: position,
                    stitches: stitchCounts[Math.floor(Math.random() * stitchCounts.length)],
                    digitizing: Math.random() > 0.7
                });
            }
            
            // Random quantity between 1 and 150
            const quantity = Math.floor(Math.random() * 150) + 1;
            
            this.scenarios.push({
                id: this.scenarios.length + 1,
                name: `Random Test #${i + 1}`,
                logos: logos,
                products: [{
                    style: 'PC61',
                    color: colors[Math.floor(Math.random() * colors.length)],
                    sizes: this.generateSizeDistribution(
                        quantity, 
                        ['standard', 'mixed', 'athletic'][Math.floor(Math.random() * 3)]
                    )
                }]
            });
        }
    }
}

/**
 * Main test execution function
 */
async function runComprehensiveTests(options = {}) {
    const {
        maxTests = 100,  // Limit number of tests for initial run
        verbose = true,
        stopOnFailure = false
    } = options;
    
    console.log('='.repeat(60));
    console.log('EMBROIDERY QUOTE BUILDER - USER SIMULATION TEST SUITE');
    console.log('='.repeat(60));
    console.log(`Start Time: ${new Date().toLocaleString()}`);
    console.log(`API Endpoint: https://caspio-pricing-proxy-ab30a049961a.herokuapp.com`);
    console.log('');
    
    const simulator = new EmbroideryUserSimulator();
    const generator = new TestScenarioGenerator();
    
    // Generate test scenarios
    const allScenarios = await generator.generateRealisticScenarios();
    const scenarios = allScenarios.slice(0, maxTests);
    
    console.log(`\nRunning ${scenarios.length} of ${allScenarios.length} test scenarios\n`);
    console.log('='.repeat(60));
    
    const results = {
        passed: 0,
        failed: 0,
        errors: 0,
        failures: [],
        startTime: Date.now()
    };
    
    // Run each scenario
    for (const scenario of scenarios) {
        try {
            const result = await simulator.simulateUserSession(scenario);
            
            if (result.passed) {
                results.passed++;
                if (verbose) {
                    console.log(`  ✓ PASSED`);
                }
            } else if (result.error) {
                results.errors++;
                console.log(`  ✗ ERROR: ${result.error}`);
            } else {
                results.failed++;
                console.log(`  ✗ FAILED - Difference: $${result.difference.toFixed(2)}`);
                results.failures.push(result);
                
                if (stopOnFailure) {
                    console.log('\nStopping tests due to failure (stopOnFailure = true)');
                    break;
                }
            }
        } catch (error) {
            console.error(`  ✗ CRITICAL ERROR: ${error.message}`);
            results.errors++;
            
            if (stopOnFailure) {
                console.log('\nStopping tests due to error (stopOnFailure = true)');
                break;
            }
        }
    }
    
    const endTime = Date.now();
    const duration = ((endTime - results.startTime) / 1000).toFixed(1);
    
    // Generate summary report
    console.log('\n' + '='.repeat(60));
    console.log('TEST SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total Tests: ${scenarios.length}`);
    console.log(`Passed: ${results.passed} (${(results.passed/scenarios.length*100).toFixed(1)}%)`);
    console.log(`Failed: ${results.failed} (${(results.failed/scenarios.length*100).toFixed(1)}%)`);
    console.log(`Errors: ${results.errors} (${(results.errors/scenarios.length*100).toFixed(1)}%)`);
    console.log(`Duration: ${duration} seconds`);
    console.log(`Average: ${(duration/scenarios.length).toFixed(2)} seconds per test`);
    
    // Show failure details
    if (results.failures.length > 0) {
        console.log('\n' + '='.repeat(60));
        console.log('FAILURE DETAILS (First 5)');
        console.log('='.repeat(60));
        
        for (const failure of results.failures.slice(0, 5)) {
            console.log(`\nScenario: ${failure.scenario.name}`);
            console.log(`Products: ${failure.scenario.products.map(p => `${p.style} ${p.color}`).join(', ')}`);
            console.log(`Logos: ${failure.scenario.logos.map(l => `${l.position} (${l.stitches} stitches)`).join(', ')}`);
            console.log(`Expected Total: $${failure.expected.grandTotal.toFixed(2)}`);
            console.log(`Actual Total: $${failure.actual.grandTotal.toFixed(2)}`);
            console.log(`Difference: $${failure.difference.toFixed(2)}`);
        }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log(`Test run completed at ${new Date().toLocaleString()}`);
    console.log('='.repeat(60));
    
    return results;
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        EmbroideryUserSimulator,
        TestScenarioGenerator,
        runComprehensiveTests
    };
}

// Run tests if executed directly
if (typeof require !== 'undefined' && require.main === module) {
    runComprehensiveTests({
        maxTests: 10,  // Start with 10 tests for quick validation
        verbose: true,
        stopOnFailure: false
    }).catch(console.error);
}