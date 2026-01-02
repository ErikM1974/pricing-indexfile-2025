/**
 * Comprehensive Cap Embroidery Pricing Test
 * Tests all 354 cap styles from SanmarCaps.csv
 * Validates pricing formula: (Base Cap / 0.57) + Embroidery Cost, round UP (2026 margin)
 */

const fs = require('fs');
const fetch = require('node-fetch');
const readline = require('readline');

// Configuration
const BASE_URL = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
const TEST_QUANTITIES = [24, 48, 72];
const CHECKPOINT_INTERVAL = 25; // Save progress every 25 styles
const CSV_FILE = '/mnt/c/Users/erik/Downloads/SanmarCaps.csv';

// Expected embroidery costs from API (2026 - increased by $1.00)
const EXPECTED_EMBROIDERY = {
    '24-47': 13.00,
    '48-71': 11.00,
    '72+': 9.50
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

// Results tracking
let totalStyles = 0;
let passedStyles = 0;
let failedStyles = 0;
let errorStyles = 0;
let skippedStyles = 0;
const failures = [];
const fullResults = {};

/**
 * Read cap styles from CSV file
 */
async function readCapStyles() {
    return new Promise((resolve, reject) => {
        const styles = [];
        const fileStream = fs.createReadStream(CSV_FILE);
        const rl = readline.createInterface({
            input: fileStream,
            crlfDelay: Infinity
        });

        let isFirstLine = true;

        rl.on('line', (line) => {
            if (isFirstLine) {
                isFirstLine = false;
                return; // Skip header
            }

            const parts = line.split(',');
            if (parts[0]) {
                styles.push(parts[0].trim());
            }
        });

        rl.on('close', () => {
            console.log(`📋 Loaded ${styles.length} cap styles from CSV`);
            resolve(styles);
        });

        rl.on('error', reject);
    });
}

/**
 * Fetch CAP pricing data from API
 */
async function fetchCapPricingData(styleNumber) {
    const url = `${BASE_URL}/api/pricing-bundle?method=CAP&styleNumber=${styleNumber}`;

    try {
        const response = await fetch(url, {
            timeout: 10000 // 10 second timeout
        });

        if (!response.ok) {
            if (response.status === 404) {
                return { error: 'Style not found', status: 404 };
            }
            return { error: `API error: ${response.status}`, status: response.status };
        }

        const data = await response.json();
        return data;
    } catch (error) {
        if (error.name === 'AbortError' || error.message.includes('timeout')) {
            return { error: 'Request timeout', status: 'timeout' };
        }
        return { error: error.message, status: 'error' };
    }
}

/**
 * Get base cap price from bundle data
 */
function getBaseCapPrice(apiData) {
    if (apiData && apiData.sizes && apiData.sizes.length > 0) {
        const firstSize = apiData.sizes[0];
        const basePrice = parseFloat(firstSize.price || firstSize.maxCasePrice);
        if (basePrice && basePrice > 0) {
            return basePrice;
        }
    }
    return null;
}

/**
 * Calculate expected cap embroidery price
 */
function calculateExpectedPrice(baseCapPrice, quantity) {
    // Determine tier
    let tier, embCost;
    if (quantity >= 72) {
        tier = '72+';
        embCost = EXPECTED_EMBROIDERY['72+'];
    } else if (quantity >= 48) {
        tier = '48-71';
        embCost = EXPECTED_EMBROIDERY['48-71'];
    } else {
        tier = '24-47';
        embCost = EXPECTED_EMBROIDERY['24-47'];
    }

    // Apply formula: (Base / 0.57) + Embroidery, round UP (2026 margin)
    const marginDenom = 0.57;
    const markedUpCap = baseCapPrice / marginDenom;
    const decoratedPrice = markedUpCap + embCost;
    const finalPrice = Math.ceil(decoratedPrice);

    return {
        tier: tier,
        embCost: embCost,
        markedUpCap: markedUpCap,
        decoratedPrice: decoratedPrice,
        finalPrice: finalPrice
    };
}

/**
 * Validate embroidery costs in API data
 */
function validateEmbroideryData(apiData) {
    if (!apiData || !apiData.allEmbroideryCostsR) {
        return { valid: false, message: 'No embroidery cost data in response' };
    }

    const issues = [];

    // Check each tier
    for (const [tier, expectedCost] of Object.entries(EXPECTED_EMBROIDERY)) {
        const embData = apiData.allEmbroideryCostsR.find(e =>
            e.TierLabel === tier && e.StitchCount === 8000
        );

        if (!embData) {
            issues.push(`Missing ${tier} embroidery data`);
        } else if (parseFloat(embData.EmbroideryCost) !== expectedCost) {
            issues.push(`${tier}: Expected $${expectedCost}, got $${embData.EmbroideryCost}`);
        }
    }

    return {
        valid: issues.length === 0,
        message: issues.length > 0 ? issues.join('; ') : 'All embroidery costs valid'
    };
}

/**
 * Test a single cap style
 */
async function testCapStyle(styleNumber) {
    const result = {
        style: styleNumber,
        status: 'pending',
        prices: {},
        errors: []
    };

    try {
        // Fetch pricing data
        const apiData = await fetchCapPricingData(styleNumber);

        // Handle API errors
        if (apiData.error) {
            if (apiData.status === 404) {
                result.status = 'skipped';
                result.errors.push('Style not found in API');
                return result;
            }
            throw new Error(apiData.error);
        }

        // Get base cap price
        const baseCapPrice = getBaseCapPrice(apiData);
        if (!baseCapPrice) {
            throw new Error('Could not determine base cap price');
        }

        // Validate embroidery data
        const embValidation = validateEmbroideryData(apiData);
        if (!embValidation.valid) {
            throw new Error(`Invalid embroidery data: ${embValidation.message}`);
        }

        // Calculate prices for each quantity
        for (const quantity of TEST_QUANTITIES) {
            const calculated = calculateExpectedPrice(baseCapPrice, quantity);
            result.prices[quantity] = {
                baseCapPrice: baseCapPrice,
                ...calculated
            };
        }

        result.status = 'passed';
        result.baseCapPrice = baseCapPrice;

    } catch (error) {
        result.status = 'failed';
        result.errors.push(error.message);
    }

    return result;
}

/**
 * Process styles in batches
 */
async function processStylesBatch(styles, startIdx, batchSize = 10) {
    const endIdx = Math.min(startIdx + batchSize, styles.length);
    const batch = styles.slice(startIdx, endIdx);

    const promises = batch.map(style => testCapStyle(style));
    const results = await Promise.all(promises);

    return results;
}

/**
 * Save checkpoint
 */
function saveCheckpoint(processedCount, results) {
    const checkpoint = {
        timestamp: new Date().toISOString(),
        processedCount: processedCount,
        totalStyles: totalStyles,
        passedStyles: passedStyles,
        failedStyles: failedStyles,
        errorStyles: errorStyles,
        skippedStyles: skippedStyles
    };

    fs.writeFileSync('cap-test-checkpoint.json', JSON.stringify(checkpoint, null, 2));
}

/**
 * Generate summary report
 */
function generateSummary(startTime, endTime) {
    const duration = (endTime - startTime) / 1000;
    const minutes = Math.floor(duration / 60);
    const seconds = Math.round(duration % 60);
    const rate = totalStyles > 0 ? Math.round(totalStyles / (duration / 60)) : 0;

    const summary = `
============================================================
FINAL REPORT - SANMAR CAP EMBROIDERY PRICING TEST
============================================================

Total Styles Tested: ${totalStyles}
Passed: ${passedStyles} (${((passedStyles/totalStyles)*100).toFixed(1)}%)
Failed: ${failedStyles} (${((failedStyles/totalStyles)*100).toFixed(1)}%)
Errors: ${errorStyles} (${((errorStyles/totalStyles)*100).toFixed(1)}%)
Skipped: ${skippedStyles}

Test Duration: ${minutes}m ${seconds}s
Average Rate: ${rate} styles/minute

Formula Used:
  (Base Cap Price / 0.57) + Embroidery Cost, then Round UP (2026)

Expected Embroidery Costs (2026):
  24-47 pieces: $13.00
  48-71 pieces: $11.00
  72+ pieces: $9.50

Output Files:
  Summary: cap-test-results-summary.txt
  Failures: cap-test-failures.csv
  Full Results: cap-test-full-results.json
`;

    return summary;
}

/**
 * Main test function
 */
async function runAllTests() {
    const startTime = Date.now();

    console.log(`${colors.bright}${colors.blue}═══════════════════════════════════════════════════════${colors.reset}`);
    console.log(`${colors.bright}       SANMAR CAP EMBROIDERY PRICING TEST${colors.reset}`);
    console.log(`${colors.bright}${colors.blue}═══════════════════════════════════════════════════════${colors.reset}\n`);

    try {
        // Read cap styles from CSV
        const capStyles = await readCapStyles();
        totalStyles = capStyles.length;

        console.log(`\n📊 Testing ${totalStyles} cap styles at quantities: ${TEST_QUANTITIES.join(', ')}`);
        console.log(`📐 Formula: (Base Cap / 0.57) + Embroidery, round UP (2026)\n`);

        // Prepare CSV for failures
        const failuresCsv = ['Style,Status,BasePrice,Q24_Expected,Q48_Expected,Q72_Expected,Errors'];

        // Process styles in batches
        const batchSize = 10;
        let processedCount = 0;

        for (let i = 0; i < capStyles.length; i += batchSize) {
            const batchResults = await processStylesBatch(capStyles, i, batchSize);

            for (const result of batchResults) {
                processedCount++;
                fullResults[result.style] = result;

                // Update counters
                switch (result.status) {
                    case 'passed':
                        passedStyles++;
                        process.stdout.write(`${colors.green}.${colors.reset}`);
                        break;
                    case 'failed':
                        failedStyles++;
                        failures.push(result);
                        process.stdout.write(`${colors.red}F${colors.reset}`);

                        // Add to failures CSV
                        const prices = result.prices || {};
                        failuresCsv.push([
                            result.style,
                            result.status,
                            result.baseCapPrice || 'N/A',
                            prices[24]?.finalPrice || 'N/A',
                            prices[48]?.finalPrice || 'N/A',
                            prices[72]?.finalPrice || 'N/A',
                            result.errors.join('; ')
                        ].join(','));
                        break;
                    case 'skipped':
                        skippedStyles++;
                        process.stdout.write(`${colors.yellow}S${colors.reset}`);
                        break;
                    default:
                        errorStyles++;
                        process.stdout.write(`${colors.red}E${colors.reset}`);
                }

                // Progress indicator
                if (processedCount % 50 === 0) {
                    const pct = ((processedCount / totalStyles) * 100).toFixed(1);
                    process.stdout.write(` [${processedCount}/${totalStyles} - ${pct}%]\n`);
                }

                // Save checkpoint
                if (processedCount % CHECKPOINT_INTERVAL === 0) {
                    saveCheckpoint(processedCount, fullResults);
                }
            }
        }

        console.log('\n');

        // Save final results
        const endTime = Date.now();
        const summary = generateSummary(startTime, endTime);

        // Write output files
        fs.writeFileSync('cap-test-results-summary.txt', summary);
        fs.writeFileSync('cap-test-failures.csv', failuresCsv.join('\n'));
        fs.writeFileSync('cap-test-full-results.json', JSON.stringify(fullResults, null, 2));

        // Display summary
        console.log(summary);

        // Show sample failures if any
        if (failures.length > 0) {
            console.log(`${colors.red}Sample Failed Styles (first 10):${colors.reset}`);
            failures.slice(0, 10).forEach(f => {
                console.log(`  ${f.style}: ${f.errors.join(', ')}`);
            });

            if (failures.length > 10) {
                console.log(`  ... and ${failures.length - 10} more failures`);
            }
        }

        // Clean up checkpoint file
        if (fs.existsSync('cap-test-checkpoint.json')) {
            fs.unlinkSync('cap-test-checkpoint.json');
        }

    } catch (error) {
        console.error(`${colors.red}Fatal error: ${error.message}${colors.reset}`);
        console.error(error.stack);
        process.exit(1);
    }
}

// Check dependencies and run
async function main() {
    // Check if CSV file exists
    if (!fs.existsSync(CSV_FILE)) {
        console.error(`${colors.red}Error: CSV file not found at ${CSV_FILE}${colors.reset}`);
        process.exit(1);
    }

    // Check if node-fetch is installed
    try {
        require.resolve('node-fetch');
    } catch(e) {
        console.log(`${colors.yellow}Installing node-fetch...${colors.reset}`);
        const { execSync } = require('child_process');
        execSync('npm install node-fetch@2', { stdio: 'inherit' });
        console.log(`${colors.green}node-fetch installed.${colors.reset}\n`);
    }

    // Run tests
    await runAllTests();
}

// Start the test
main().catch(error => {
    console.error(`${colors.red}Unhandled error: ${error.message}${colors.reset}`);
    process.exit(1);
});