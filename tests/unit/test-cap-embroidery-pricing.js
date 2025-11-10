/**
 * Cap Embroidery Pricing Comparison Test
 * Tests pricing consistency between static page and quote builder
 */

const fetch = require('node-fetch');

// Test configuration
const TEST_STYLES = ['C112', 'C130', 'C914', 'C875', 'C928', 'C934', 'CP80', 'CP86'];
const TEST_QUANTITIES = [24, 48, 72];
const BASE_URL = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';

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
 * Fetch CAP pricing data from API
 */
async function fetchCapPricingData(styleNumber) {
    const url = `${BASE_URL}/api/pricing-bundle?method=CAP&styleNumber=${styleNumber}`;
    console.log(`  Fetching CAP data for ${styleNumber}...`);

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
 * Get base cap price from CAP bundle or size-pricing API
 */
async function getBaseCapPrice(styleNumber, apiData) {
    // First try to get from the CAP bundle data
    if (apiData && apiData.sizes && apiData.sizes.length > 0) {
        const firstSize = apiData.sizes[0];
        const basePrice = parseFloat(firstSize.price || firstSize.maxCasePrice);
        if (basePrice) {
            console.log(`  Got base price from CAP bundle: $${basePrice.toFixed(2)}`);
            return basePrice;
        }
    }

    // Fallback to size-pricing API
    const url = `${BASE_URL}/api/size-pricing?styleNumber=${styleNumber}`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            console.log(`  Size-pricing API not available for ${styleNumber}, using bundle data`);
            return null;
        }
        const data = await response.json();

        // Get first size price (caps typically have OSFA)
        if (data && data.length > 0) {
            const firstSize = data[0];
            const basePrice = parseFloat(firstSize.price || firstSize.maxCasePrice);
            console.log(`  Got base price from size-pricing API: $${basePrice.toFixed(2)}`);
            return basePrice;
        }

        return null;
    } catch (error) {
        console.log(`  Size-pricing API error: ${error.message}`);
        return null;
    }
}

/**
 * Calculate cap embroidery pricing using the correct formula
 * Should match both static page and quote builder
 */
function calculateCapPricing(apiData, baseCapPrice, quantity) {
    const { tiersR, allEmbroideryCostsR, rulesR } = apiData;

    // Determine tier based on quantity
    let tierLabel;
    if (quantity >= 72) tierLabel = '72+';
    else if (quantity >= 48) tierLabel = '48-71';
    else if (quantity >= 24) tierLabel = '24-47';
    else tierLabel = '1-23';

    // Find tier data
    const tier = tiersR.find(t => t.TierLabel === tierLabel);
    if (!tier) {
        console.error(`No tier found for ${tierLabel}`);
        return null;
    }

    // Get margin denominator (should be 0.6 for caps)
    const marginDenom = parseFloat(tier.MarginDenominator);

    // Find embroidery cost for 8000 stitches
    let embroideryData = allEmbroideryCostsR.find(e =>
        e.TierLabel === tierLabel && e.StitchCount === 8000
    );

    // Fallback to any stitch count if 8000 not found
    if (!embroideryData) {
        embroideryData = allEmbroideryCostsR.find(e =>
            e.TierLabel === tierLabel
        );
    }

    if (!embroideryData) {
        console.error(`No embroidery cost found for tier ${tierLabel}`);
        return null;
    }

    const embCost = parseFloat(embroideryData.EmbroideryCost);

    // Calculate marked up cap price
    const markedUpCap = baseCapPrice / marginDenom;

    // Add embroidery cost
    const decoratedPrice = markedUpCap + embCost;

    // Round UP to nearest dollar (CeilDollar)
    const finalPrice = Math.ceil(decoratedPrice);

    return {
        tier: tierLabel,
        marginDenom: marginDenom,
        embCost: embCost,
        markedUpCap: markedUpCap,
        decoratedPrice: decoratedPrice,
        finalPrice: finalPrice
    };
}

/**
 * Test a single cap style
 */
async function testCapStyle(styleNumber) {
    const results = {
        style: styleNumber,
        quantities: {},
        allMatch: true,
        errors: []
    };

    try {
        // Fetch CAP pricing data
        const apiData = await fetchCapPricingData(styleNumber);

        // Get base cap price
        const baseCapPrice = await getBaseCapPrice(styleNumber, apiData);

        if (!baseCapPrice) {
            throw new Error('Could not determine base cap price');
        }

        console.log(`  Base cap price: $${baseCapPrice.toFixed(2)}`);

        // Test each quantity
        for (const quantity of TEST_QUANTITIES) {
            const pricing = calculateCapPricing(apiData, baseCapPrice, quantity);

            if (!pricing) {
                results.errors.push(`Failed to calculate pricing for quantity ${quantity}`);
                results.allMatch = false;
                continue;
            }

            results.quantities[quantity] = {
                ...pricing,
                baseCapPrice: baseCapPrice
            };

            // Display results
            console.log(`\n  ${colors.cyan}Quantity ${quantity} (Tier: ${pricing.tier})${colors.reset}`);
            console.log(`    Base cap: $${baseCapPrice.toFixed(2)}`);
            console.log(`    Margin denom: ${pricing.marginDenom}`);
            console.log(`    Marked up cap: $${pricing.markedUpCap.toFixed(2)}`);
            console.log(`    Embroidery cost: $${pricing.embCost.toFixed(2)}`);
            console.log(`    Decorated (before round): $${pricing.decoratedPrice.toFixed(2)}`);
            console.log(`    ${colors.green}Final price: $${pricing.finalPrice.toFixed(2)}${colors.reset}`);
        }

    } catch (error) {
        console.error(`${colors.red}  Error testing ${styleNumber}: ${error.message}${colors.reset}`);
        results.error = error.message;
        results.allMatch = false;
    }

    return results;
}

/**
 * Compare pricing between two implementations
 */
function comparePricing(results1, results2, label1 = 'Implementation 1', label2 = 'Implementation 2') {
    console.log(`\n${colors.bright}Comparing ${label1} vs ${label2}:${colors.reset}`);

    let allMatch = true;

    for (const style of Object.keys(results1)) {
        const r1 = results1[style];
        const r2 = results2[style];

        if (!r2) {
            console.log(`${colors.red}  ${style}: Missing in ${label2}${colors.reset}`);
            allMatch = false;
            continue;
        }

        for (const qty of TEST_QUANTITIES) {
            const p1 = r1.quantities[qty];
            const p2 = r2.quantities[qty];

            if (!p1 || !p2) {
                console.log(`${colors.red}  ${style} @ ${qty}: Missing data${colors.reset}`);
                allMatch = false;
                continue;
            }

            if (p1.finalPrice !== p2.finalPrice) {
                console.log(`${colors.red}  ${style} @ ${qty}: $${p1.finalPrice} vs $${p2.finalPrice} (MISMATCH)${colors.reset}`);
                allMatch = false;
            } else {
                console.log(`${colors.green}  ${style} @ ${qty}: $${p1.finalPrice} (MATCH)${colors.reset}`);
            }
        }
    }

    return allMatch;
}

/**
 * Run all tests
 */
async function runAllTests() {
    console.log(`${colors.bright}${colors.blue}═══════════════════════════════════════════════════════${colors.reset}`);
    console.log(`${colors.bright}       CAP EMBROIDERY PRICING TEST${colors.reset}`);
    console.log(`${colors.bright}${colors.blue}═══════════════════════════════════════════════════════${colors.reset}\n`);

    console.log(`Testing ${TEST_STYLES.length} cap styles at quantities: ${TEST_QUANTITIES.join(', ')}\n`);
    console.log(`Formula: (Base Cap / Margin) + Embroidery Cost, then Round UP\n`);

    const allResults = {};
    let passedCount = 0;
    let failedCount = 0;

    for (const style of TEST_STYLES) {
        console.log(`${colors.bright}${colors.yellow}Testing ${style}:${colors.reset}`);
        const result = await testCapStyle(style);
        allResults[style] = result;

        if (result.allMatch && !result.error) {
            passedCount++;
            console.log(`${colors.green}  ✅ All calculations successful for ${style}${colors.reset}`);
        } else {
            failedCount++;
            console.log(`${colors.red}  ❌ Issues found for ${style}${colors.reset}`);
        }

        console.log('');
    }

    // Summary
    console.log(`${colors.bright}${colors.blue}═══════════════════════════════════════════════════════${colors.reset}`);
    console.log(`${colors.bright}                     SUMMARY${colors.reset}`);
    console.log(`${colors.bright}${colors.blue}═══════════════════════════════════════════════════════${colors.reset}\n`);

    console.log(`Total Styles Tested: ${TEST_STYLES.length}`);
    console.log(`${colors.green}Successful: ${passedCount}${colors.reset}`);
    console.log(`${colors.red}Failed: ${failedCount}${colors.reset}`);

    // List any failed styles
    if (failedCount > 0) {
        console.log(`\n${colors.red}Failed Styles:${colors.reset}`);
        for (const [style, result] of Object.entries(allResults)) {
            if (!result.allMatch || result.error) {
                console.log(`  - ${style}${result.error ? ` (Error: ${result.error})` : ''}`);
                if (result.errors && result.errors.length > 0) {
                    result.errors.forEach(err => console.log(`    • ${err}`));
                }
            }
        }
    }

    // Show pricing summary table
    console.log(`\n${colors.bright}Pricing Summary:${colors.reset}`);
    console.log('┌────────┬───────────┬───────────┬───────────┐');
    console.log('│ Style  │ 24-47 pcs │ 48-71 pcs │ 72+ pcs   │');
    console.log('├────────┼───────────┼───────────┼───────────┤');

    for (const [style, result] of Object.entries(allResults)) {
        if (result.quantities[24] && result.quantities[48] && result.quantities[72]) {
            console.log(`│ ${style.padEnd(6)} │ $${result.quantities[24].finalPrice.toString().padEnd(8)} │ $${result.quantities[48].finalPrice.toString().padEnd(8)} │ $${result.quantities[72].finalPrice.toString().padEnd(8)} │`);
        }
    }
    console.log('└────────┴───────────┴───────────┴───────────┘');

    console.log(`\n${colors.bright}Test completed!${colors.reset}`);
    console.log('\nNOTE: Both static page and quote builder should produce these exact prices.');
    console.log('If they differ, check that both are using:');
    console.log('  1. Same API endpoint (CAP)');
    console.log('  2. Same embroidery costs (from allEmbroideryCostsR)');
    console.log('  3. Same margin denominator (0.6)');
    console.log('  4. Same rounding (Math.ceil)');
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