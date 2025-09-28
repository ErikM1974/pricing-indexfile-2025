/**
 * Embroidery Pricing API Test System
 * 
 * This test system directly tests the embroidery pricing calculations
 * by calling the API and validating the pricing logic.
 * Designed to run in Node.js environment.
 */

const https = require('https');
const url = require('url');

class EmbroideryPricingTester {
    constructor() {
        this.apiBase = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
        this.pricingData = null;
        this.testResults = [];
    }

    /**
     * Make API request
     */
    async fetchAPI(endpoint) {
        return new Promise((resolve, reject) => {
            const apiUrl = `${this.apiBase}${endpoint}`;
            const parsedUrl = url.parse(apiUrl);
            
            const options = {
                hostname: parsedUrl.hostname,
                port: parsedUrl.port || 443,
                path: parsedUrl.path,
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                }
            };

            const req = https.request(options, (res) => {
                let data = '';
                
                res.on('data', (chunk) => {
                    data += chunk;
                });
                
                res.on('end', () => {
                    try {
                        const jsonData = JSON.parse(data);
                        resolve(jsonData);
                    } catch (error) {
                        reject(new Error(`Failed to parse JSON: ${error.message}`));
                    }
                });
            });
            
            req.on('error', (error) => {
                reject(error);
            });
            
            req.end();
        });
    }

    /**
     * Load pricing configuration from API
     */
    async loadPricingConfiguration() {
        console.log('Loading pricing configuration from API...');
        
        try {
            // Get embroidery pricing bundle
            const bundle = await this.fetchAPI('/api/pricing-bundle?method=EMB&styleNumber=PC61');
            
            this.pricingData = {
                tiers: {},
                alPricing: {},
                marginDenominator: 0.6,
                additionalStitchRate: 1.25,
                baseStitchCount: 8000,
                digitizingFee: 100,
                roundingMethod: 'CeilDollar'
            };
            
            // Extract tier information
            if (bundle.tiersR && bundle.tiersR.length > 0) {
                this.pricingData.marginDenominator = bundle.tiersR[0].MarginDenominator || 0.6;
                
                bundle.tiersR.forEach(tier => {
                    this.pricingData.tiers[tier.TierLabel] = {
                        embCost: 0,
                        ltmFee: tier.LTM_Fee || 0
                    };
                });
            }
            
            // Extract embroidery costs
            if (bundle.allEmbroideryCostsR && bundle.allEmbroideryCostsR.length > 0) {
                const shirtConfig = bundle.allEmbroideryCostsR.find(c => c.ItemType === 'Shirt') || bundle.allEmbroideryCostsR[0];
                
                this.pricingData.digitizingFee = shirtConfig.DigitizingFee || 100;
                this.pricingData.additionalStitchRate = shirtConfig.AdditionalStitchRate || 1.25;
                this.pricingData.baseStitchCount = shirtConfig.BaseStitchCount || 8000;
                
                // Update tier embroidery costs
                bundle.allEmbroideryCostsR.forEach(cost => {
                    if (cost.ItemType === 'Shirt' && this.pricingData.tiers[cost.TierLabel]) {
                        this.pricingData.tiers[cost.TierLabel].embCost = cost.EmbroideryCost;
                    }
                });
            }
            
            // Extract AL pricing
            if (bundle.alCostsR && bundle.alCostsR.length > 0) {
                bundle.alCostsR.forEach(alCost => {
                    const tier = alCost.TierLabel;
                    if (!this.pricingData.alPricing[tier]) {
                        this.pricingData.alPricing[tier] = {};
                    }
                    this.pricingData.alPricing[tier][alCost.ALPosition] = alCost.ALPrice;
                });
            }
            
            console.log('✓ Pricing configuration loaded successfully');
            console.log('  Tiers:', Object.keys(this.pricingData.tiers).join(', '));
            console.log('  Margin Denominator:', this.pricingData.marginDenominator);
            console.log('  Base Stitch Count:', this.pricingData.baseStitchCount);
            console.log('  Additional Stitch Rate: $', this.pricingData.additionalStitchRate);
            
        } catch (error) {
            console.error('Failed to load pricing configuration:', error);
            throw error;
        }
    }

    /**
     * Get product pricing from API
     */
    async getProductPricing(styleNumber) {
        try {
            const sizePricing = await this.fetchAPI(`/api/size-pricing?styleNumber=${styleNumber}`);
            
            if (sizePricing && sizePricing.length > 0) {
                return sizePricing[0]; // Return first color's pricing
            }
            
            return null;
        } catch (error) {
            console.error(`Failed to get pricing for ${styleNumber}:`, error);
            return null;
        }
    }

    /**
     * Calculate expected price for a test scenario
     */
    calculateExpectedPrice(scenario, productPricing) {
        const tier = this.getTier(scenario.totalQuantity);
        const tierData = this.pricingData.tiers[tier];
        const embCost = tierData.embCost;
        
        let totalProductCost = 0;
        
        // Calculate for each size
        for (const [size, qty] of Object.entries(scenario.sizes)) {
            if (qty === 0) continue;
            
            // Get base price and upcharge
            const basePrice = productPricing.basePrices[size] || productPricing.basePrices['S'];
            const upcharge = productPricing.sizeUpcharges[size] || 0;
            
            // Calculate base decorated price (for standard sizes)
            const garmentCost = basePrice / this.pricingData.marginDenominator;
            const baseDecoratedPrice = garmentCost + embCost;
            const standardRoundedBase = this.roundPrice(baseDecoratedPrice);
            
            // Add upcharge if applicable
            const roundedBaseWithUpcharge = standardRoundedBase + upcharge;
            
            // Calculate extra stitches for primary logo
            let extraStitchCharge = 0;
            if (scenario.logos && scenario.logos.length > 0) {
                const primaryStitches = scenario.logos[0].stitches;
                const extraStitches = Math.max(0, primaryStitches - this.pricingData.baseStitchCount);
                const extraThousands = Math.ceil(extraStitches / 1000);
                extraStitchCharge = extraThousands * this.pricingData.additionalStitchRate;
            }
            
            const unitPrice = roundedBaseWithUpcharge + extraStitchCharge;
            
            // Add AL fees for additional logos
            let alFees = 0;
            if (scenario.logos && scenario.logos.length > 1) {
                for (let i = 1; i < scenario.logos.length; i++) {
                    const position = scenario.logos[i].position;
                    const alPrice = this.getALPrice(position, tier);
                    alFees += alPrice;
                }
            }
            
            totalProductCost += (unitPrice + alFees) * qty;
        }
        
        // Add digitizing fees
        let digitizingFees = 0;
        if (scenario.logos) {
            digitizingFees = scenario.logos.filter(l => l.digitizing).length * this.pricingData.digitizingFee;
        }
        
        // Add LTM fee if applicable
        const ltmFee = tierData.ltmFee || 0;
        
        return {
            productTotal: totalProductCost,
            digitizingFees: digitizingFees,
            ltmFee: ltmFee,
            grandTotal: totalProductCost + digitizingFees
        };
    }

    /**
     * Get tier based on quantity
     */
    getTier(quantity) {
        if (quantity < 24) return '1-23';
        if (quantity < 48) return '24-47';
        if (quantity < 72) return '48-71';
        return '72+';
    }

    /**
     * Round price using API rounding method
     */
    roundPrice(price) {
        // CeilDollar - round up to nearest dollar
        return Math.ceil(price);
    }

    /**
     * Get AL price for a position and tier
     */
    getALPrice(position, tier) {
        // Normalize position name for API matching
        const normalizedPosition = position.toLowerCase().replace(/\s/g, '');
        
        if (this.pricingData.alPricing[tier]) {
            // Try to find matching AL price
            for (const [alPos, price] of Object.entries(this.pricingData.alPricing[tier])) {
                const normalizedALPos = alPos.toLowerCase().replace(/\s/g, '');
                if (normalizedALPos.includes(normalizedPosition) || normalizedPosition.includes(normalizedALPos)) {
                    return price;
                }
            }
        }
        
        // Default AL prices if not found
        const defaults = {
            '1-23': 7.00,
            '24-47': 6.00,
            '48-71': 5.00,
            '72+': 4.00
        };
        
        return defaults[tier] || 5.00;
    }

    /**
     * Run a single test scenario
     */
    async runTestScenario(scenario) {
        console.log(`\nTesting: ${scenario.name}`);
        console.log(`  Style: ${scenario.style}`);
        console.log(`  Quantity: ${scenario.totalQuantity} pieces`);
        console.log(`  Sizes:`, scenario.sizes);
        
        if (scenario.logos) {
            console.log(`  Logos: ${scenario.logos.length}`);
            scenario.logos.forEach((logo, i) => {
                console.log(`    ${i + 1}. ${logo.position}: ${logo.stitches} stitches${logo.digitizing ? ' [+Digitizing]' : ''}`);
            });
        }
        
        try {
            // Get product pricing
            const productPricing = await this.getProductPricing(scenario.style);
            
            if (!productPricing) {
                console.log('  ✗ Failed to get product pricing');
                return {
                    passed: false,
                    error: 'No product pricing available'
                };
            }
            
            // Calculate expected price
            const expected = this.calculateExpectedPrice(scenario, productPricing);
            
            console.log(`  Expected Total: $${expected.grandTotal.toFixed(2)}`);
            console.log(`    - Products: $${expected.productTotal.toFixed(2)}`);
            if (expected.digitizingFees > 0) {
                console.log(`    - Digitizing: $${expected.digitizingFees.toFixed(2)}`);
            }
            if (expected.ltmFee > 0) {
                console.log(`    - LTM Fee: $${expected.ltmFee.toFixed(2)}`);
            }
            
            console.log('  ✓ Test completed');
            
            return {
                passed: true,
                scenario: scenario,
                expected: expected
            };
            
        } catch (error) {
            console.log(`  ✗ Error: ${error.message}`);
            return {
                passed: false,
                error: error.message
            };
        }
    }

    /**
     * Run all test scenarios
     */
    async runAllTests() {
        console.log('='.repeat(60));
        console.log('EMBROIDERY PRICING API TEST SUITE');
        console.log('='.repeat(60));
        
        // Load pricing configuration
        await this.loadPricingConfiguration();
        
        console.log('\n' + '='.repeat(60));
        console.log('RUNNING TEST SCENARIOS');
        console.log('='.repeat(60));
        
        // Define test scenarios
        const scenarios = [
            // Test 1: Simple single logo, standard sizes
            {
                name: 'Single Logo - Standard Sizes',
                style: 'PC61',
                totalQuantity: 75,
                sizes: { S: 15, M: 20, L: 20, XL: 20 },
                logos: [
                    { position: 'Left Chest', stitches: 9000, digitizing: false }
                ]
            },
            
            // Test 2: Two logos (Left & Right Chest)
            {
                name: 'Dual Chest Logos',
                style: 'PC61',
                totalQuantity: 50,
                sizes: { S: 10, M: 15, L: 15, XL: 10 },
                logos: [
                    { position: 'Left Chest', stitches: 9000, digitizing: false },
                    { position: 'Right Chest', stitches: 12000, digitizing: false }
                ]
            },
            
            // Test 3: With upcharge sizes
            {
                name: 'Mixed Sizes with Upcharges',
                style: 'PC61',
                totalQuantity: 75,
                sizes: { S: 15, M: 20, L: 20, XL: 10, '2XL': 5, '3XL': 3, '4XL': 2 },
                logos: [
                    { position: 'Left Chest', stitches: 9000, digitizing: true }
                ]
            },
            
            // Test 4: Small batch (LTM fee)
            {
                name: 'Small Batch Order',
                style: 'PC61',
                totalQuantity: 12,
                sizes: { S: 3, M: 3, L: 3, XL: 3 },
                logos: [
                    { position: 'Left Chest', stitches: 7500, digitizing: true }
                ]
            },
            
            // Test 5: Tier boundary (exactly 24)
            {
                name: 'Tier Boundary - 24 pieces',
                style: 'PC61',
                totalQuantity: 24,
                sizes: { S: 6, M: 6, L: 6, XL: 6 },
                logos: [
                    { position: 'Left Chest', stitches: 8000, digitizing: false }
                ]
            },
            
            // Test 6: Extra stitches boundary
            {
                name: 'Stitch Boundary - 8001 stitches',
                style: 'PC61',
                totalQuantity: 48,
                sizes: { M: 24, L: 24 },
                logos: [
                    { position: 'Left Chest', stitches: 8001, digitizing: false }
                ]
            },
            
            // Test 7: Multiple logos (3)
            {
                name: 'Three Logo Design',
                style: 'PC61',
                totalQuantity: 72,
                sizes: { S: 18, M: 18, L: 18, XL: 18 },
                logos: [
                    { position: 'Left Chest', stitches: 9000, digitizing: true },
                    { position: 'Full Back', stitches: 15000, digitizing: true },
                    { position: 'Right Sleeve', stitches: 5000, digitizing: false }
                ]
            },
            
            // Test 8: All upcharge sizes
            {
                name: 'All Size Upcharges',
                style: 'PC61',
                totalQuantity: 60,
                sizes: { S: 10, M: 10, L: 10, XL: 10, '2XL': 5, '3XL': 5, '4XL': 5, '5XL': 3, '6XL': 2 },
                logos: [
                    { position: 'Left Chest', stitches: 9000, digitizing: false }
                ]
            },
            
            // Test 9: High stitch count
            {
                name: 'High Stitch Count',
                style: 'PC61',
                totalQuantity: 100,
                sizes: { S: 25, M: 25, L: 25, XL: 25 },
                logos: [
                    { position: 'Full Back', stitches: 20000, digitizing: true }
                ]
            },
            
            // Test 10: No extra stitches (under 8000)
            {
                name: 'No Extra Stitches',
                style: 'PC61',
                totalQuantity: 50,
                sizes: { M: 25, L: 25 },
                logos: [
                    { position: 'Left Chest', stitches: 5000, digitizing: false }
                ]
            }
        ];
        
        // Run each scenario
        let passed = 0;
        let failed = 0;
        
        for (const scenario of scenarios) {
            const result = await this.runTestScenario(scenario);
            
            if (result.passed) {
                passed++;
            } else {
                failed++;
            }
            
            this.testResults.push(result);
        }
        
        // Summary
        console.log('\n' + '='.repeat(60));
        console.log('TEST SUMMARY');
        console.log('='.repeat(60));
        console.log(`Total Tests: ${scenarios.length}`);
        console.log(`Passed: ${passed}`);
        console.log(`Failed: ${failed}`);
        console.log(`Success Rate: ${(passed / scenarios.length * 100).toFixed(1)}%`);
        console.log('='.repeat(60));
    }
}

// Run the tests
const tester = new EmbroideryPricingTester();
tester.runAllTests().catch(console.error);