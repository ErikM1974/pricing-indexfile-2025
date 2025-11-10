/**
 * Node.js test script for embroidery pricing comparison
 * Tests quote builder vs static page pricing
 */

const fetch = require('node-fetch');

// Test configuration
const TEST_STYLES = ['L570', 'L525', 'TLCS410', 'LK863', 'CT104315', 'PC61PT', 'TLK100', 'TK469'];
const TEST_QUANTITIES = [24, 48, 72];
const BASE_URL = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';

// Tier configuration
const TIER_CONFIG = {
    24: { tier: '24-47', embCost: 13.00 },
    48: { tier: '48-71', embCost: 12.00 },
    72: { tier: '72+', embCost: 11.00 }
};

// Colors for console output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

/**
 * Fetch pricing data from API
 */
async function fetchPricingData(styleNumber) {
    const url = `${BASE_URL}/api/pricing-bundle?method=EMB&styleNumber=${styleNumber}`;
    console.log(`  Fetching: ${styleNumber}...`);

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`API request failed: ${response.status}`);
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error(`${colors.red}Error fetching ${styleNumber}: ${error.message}${colors.reset}`);
        throw error;
    }
}

/**
 * Calculate pricing using the service logic (static page)
 */
function calculateServicePricing(apiData) {
    const { tiersR, rulesR, allEmbroideryCostsR, sizes, sellingPriceDisplayAddOns } = apiData;

    // Sort sizes and find standard garment
    const sortedSizes = [...sizes].sort((a, b) => (a.sortOrder || Infinity) - (b.sortOrder || Infinity));
    const standardGarment = sortedSizes.find(s => s.size.toUpperCase() === 'S') || sortedSizes[0];

    if (!standardGarment) {
        throw new Error("No sizes found to determine standard garment cost");
    }

    const standardGarmentCost = parseFloat(standardGarment.price || standardGarment.maxCasePrice);

    // Find base size for relative upcharge calculation
    const baseSize = sortedSizes.find(s => s.size.toUpperCase() === 'S') || sortedSizes[0];
    const baseSizeUpcharge = parseFloat(sellingPriceDisplayAddOns?.[baseSize.size] || 0);

    // Rounding function
    const roundPrice = (price, roundingMethod) => {
        if (isNaN(price)) return null;
        if (roundingMethod === 'CeilDollar') {
            return Math.ceil(price);
        }
        // Default to HalfDollarUp
        if (price % 0.5 === 0) return price;
        return Math.ceil(price * 2) / 2;
    };

    const priceProfile = {};

    // Process each tier
    tiersR.forEach(tier => {
        const tierLabel = tier.TierLabel;
        priceProfile[tierLabel] = {};

        // Find embroidery cost for this tier
        const costEntry = allEmbroideryCostsR.find(c =>
            c.TierLabel === tierLabel && c.ItemType === 'Shirt'
        );

        if (!costEntry) {
            console.warn(`No embroidery cost found for tier ${tierLabel}`);
            return;
        }

        const embCost = parseFloat(costEntry.EmbroideryCost);
        const marginDenom = parseFloat(tier.MarginDenominator);

        if (isNaN(marginDenom) || marginDenom === 0 || isNaN(embCost)) {
            return;
        }

        // Calculate marked up garment price
        const markedUpGarment = standardGarmentCost / marginDenom;

        // Add embroidery cost to get decorated price
        const decoratedStandardPrice = markedUpGarment + embCost;

        // Apply rounding
        const roundedStandardPrice = roundPrice(decoratedStandardPrice, rulesR?.RoundingMethod);

        // Apply to each size with RELATIVE upcharges
        sortedSizes.forEach(sizeInfo => {
            const absoluteUpcharge = parseFloat(sellingPriceDisplayAddOns?.[sizeInfo.size] || 0);
            const relativeUpcharge = absoluteUpcharge - baseSizeUpcharge;
            const finalPrice = roundedStandardPrice + relativeUpcharge;
            priceProfile[tierLabel][sizeInfo.size] = parseFloat(finalPrice.toFixed(2));
        });
    });

    return {
        pricing: priceProfile,
        uniqueSizes: sortedSizes.map(s => s.size),
        standardGarmentBaseCostUsed: standardGarmentCost
    };
}

/**
 * Test a single style
 */
async function testStyle(styleNumber) {
    const results = {
        style: styleNumber,
        quantities: {},
        allMatch: true
    };

    try {
        // Fetch API data
        const apiData = await fetchPricingData(styleNumber);

        // Calculate pricing using service logic
        const servicePricing = calculateServicePricing(apiData);

        // Test each quantity
        for (const quantity of TEST_QUANTITIES) {
            const tierConfig = TIER_CONFIG[quantity];
            const tierPrices = servicePricing.pricing[tierConfig.tier];

            results.quantities[quantity] = {
                tier: tierConfig.tier,
                embCost: tierConfig.embCost,
                prices: tierPrices || {},
                sizes: servicePricing.uniqueSizes
            };

            // Display tier results
            console.log(`\n  ${colors.cyan}Quantity ${quantity} (Tier: ${tierConfig.tier}, Emb Cost: $${tierConfig.embCost})${colors.reset}`);

            if (tierPrices && Object.keys(tierPrices).length > 0) {
                // Show first few sizes as sample
                const samplSizes = Object.entries(tierPrices).slice(0, 5);
                samplSizes.forEach(([size, price]) => {
                    console.log(`    ${size}: $${price.toFixed(2)}`);
                });
                if (Object.keys(tierPrices).length > 5) {
                    console.log(`    ... and ${Object.keys(tierPrices).length - 5} more sizes`);
                }
            } else {
                console.log(`    ${colors.red}No pricing data available${colors.reset}`);
                results.allMatch = false;
            }
        }

    } catch (error) {
        console.error(`${colors.red}  Error testing ${styleNumber}: ${error.message}${colors.reset}`);
        results.error = error.message;
        results.allMatch = false;
    }

    return results;
}

/**
 * Run all tests
 */
async function runAllTests() {
    console.log(`${colors.bright}${colors.blue}═══════════════════════════════════════════════════════${colors.reset}`);
    console.log(`${colors.bright}       EMBROIDERY PRICING TEST - NODE.JS VERSION${colors.reset}`);
    console.log(`${colors.bright}${colors.blue}═══════════════════════════════════════════════════════${colors.reset}\n`);

    console.log(`Testing ${TEST_STYLES.length} styles at quantities: ${TEST_QUANTITIES.join(', ')}\n`);

    const allResults = [];
    let passedCount = 0;
    let failedCount = 0;

    for (const style of TEST_STYLES) {
        console.log(`${colors.bright}${colors.yellow}Testing ${style}:${colors.reset}`);
        const result = await testStyle(style);
        allResults.push(result);

        if (result.allMatch && !result.error) {
            passedCount++;
            console.log(`${colors.green}  ✅ All tests passed for ${style}${colors.reset}`);
        } else {
            failedCount++;
            console.log(`${colors.red}  ❌ Tests failed for ${style}${colors.reset}`);
        }

        console.log('');
    }

    // Summary
    console.log(`${colors.bright}${colors.blue}═══════════════════════════════════════════════════════${colors.reset}`);
    console.log(`${colors.bright}                     SUMMARY${colors.reset}`);
    console.log(`${colors.bright}${colors.blue}═══════════════════════════════════════════════════════${colors.reset}\n`);

    console.log(`Total Styles Tested: ${TEST_STYLES.length}`);
    console.log(`${colors.green}Passed: ${passedCount}${colors.reset}`);
    console.log(`${colors.red}Failed: ${failedCount}${colors.reset}`);

    // List failed styles
    if (failedCount > 0) {
        console.log(`\n${colors.red}Failed Styles:${colors.reset}`);
        allResults.forEach(result => {
            if (!result.allMatch || result.error) {
                console.log(`  - ${result.style}${result.error ? ` (Error: ${result.error})` : ''}`);
            }
        });
    }

    console.log(`\n${colors.bright}Test completed!${colors.reset}`);
}

// Check if node-fetch is installed
try {
    require.resolve('node-fetch');
    // Run the tests
    runAllTests().catch(error => {
        console.error(`${colors.red}Fatal error: ${error.message}${colors.reset}`);
        process.exit(1);
    });
} catch(e) {
    console.log(`${colors.yellow}Installing node-fetch...${colors.reset}`);
    const { execSync } = require('child_process');
    execSync('npm install node-fetch@2', { stdio: 'inherit' });
    console.log(`${colors.green}node-fetch installed. Please run the script again.${colors.reset}`);
}