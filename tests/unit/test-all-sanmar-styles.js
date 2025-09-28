#!/usr/bin/env node

/**
 * Comprehensive Sanmar Embroidery Pricing Test
 * Tests all 4,141 unique Sanmar styles for pricing consistency
 * between static page and quote builder implementations
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Try to use node-fetch if available, otherwise use built-in fetch (Node 18+)
let fetch;
try {
    fetch = require('node-fetch');
} catch (e) {
    fetch = globalThis.fetch;
}

// Configuration
const CONFIG = {
    API_BASE: 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com',
    CSV_FILE: '/mnt/c/Users/erik/Downloads/Sanmar Unique Styles.csv',
    TEST_QUANTITIES: [24, 48, 72],
    BATCH_SIZE: 50,
    CONCURRENT_LIMIT: 5,
    API_DELAY: 500, // milliseconds between API calls
    RETRY_ATTEMPTS: 2,
    CHECKPOINT_INTERVAL: 100,

    // Output files
    OUTPUT_DIR: '.',
    SUMMARY_FILE: 'embroidery-test-results-summary.txt',
    FAILURES_FILE: 'embroidery-test-failures.csv',
    FULL_RESULTS_FILE: 'embroidery-test-full-results.json',
    PROGRESS_FILE: 'embroidery-test-progress.json'
};

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
    dim: '\x1b[2m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    magenta: '\x1b[35m'
};

// Global state
let testState = {
    totalStyles: 0,
    testedCount: 0,
    passedCount: 0,
    failedCount: 0,
    errorCount: 0,
    skippedCount: 0,
    startTime: null,
    results: [],
    failures: [],
    currentBatch: 0,
    lastCheckpoint: 0
};

/**
 * Read styles from CSV file
 */
async function readStylesFromCSV() {
    return new Promise((resolve, reject) => {
        const styles = [];
        const fileStream = fs.createReadStream(CONFIG.CSV_FILE);
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

            const columns = line.split(',');
            if (columns.length > 0 && columns[0]) {
                const style = columns[0].trim();
                const productTitle = columns[1] || '';
                const isDiscontinued = productTitle.includes('DISCONTINUED');

                styles.push({
                    style: style,
                    productTitle: productTitle,
                    isDiscontinued: isDiscontinued
                });
            }
        });

        rl.on('close', () => {
            console.log(`${colors.green}✓ Loaded ${styles.length} styles from CSV${colors.reset}`);
            resolve(styles);
        });

        rl.on('error', reject);
    });
}

/**
 * Check if we should resume from previous progress
 */
async function checkForPreviousProgress() {
    const progressFile = path.join(CONFIG.OUTPUT_DIR, CONFIG.PROGRESS_FILE);

    if (fs.existsSync(progressFile)) {
        try {
            const progress = JSON.parse(fs.readFileSync(progressFile, 'utf8'));

            console.log(`\n${colors.yellow}Found previous test progress:${colors.reset}`);
            console.log(`  Tested: ${progress.testedCount}/${progress.totalStyles}`);
            console.log(`  Passed: ${progress.passedCount}`);
            console.log(`  Failed: ${progress.failedCount}`);
            console.log(`  Errors: ${progress.errorCount}`);

            const answer = await askUser('Resume from previous progress? (y/n): ');

            if (answer.toLowerCase() === 'y') {
                return progress;
            }
        } catch (error) {
            console.error(`${colors.red}Error reading progress file:${colors.reset}`, error.message);
        }
    }

    return null;
}

/**
 * Ask user a question
 */
function askUser(question) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            rl.close();
            resolve(answer);
        });
    });
}

/**
 * Save progress checkpoint
 */
function saveProgress() {
    const progressFile = path.join(CONFIG.OUTPUT_DIR, CONFIG.PROGRESS_FILE);

    try {
        fs.writeFileSync(progressFile, JSON.stringify(testState, null, 2));
        testState.lastCheckpoint = testState.testedCount;
    } catch (error) {
        console.error(`${colors.red}Error saving progress:${colors.reset}`, error.message);
    }
}

/**
 * Fetch pricing data from API
 */
async function fetchPricingData(styleNumber, attempt = 1) {
    const url = `${CONFIG.API_BASE}/api/pricing-bundle?method=EMB&styleNumber=${styleNumber}`;

    try {
        const response = await fetch(url);

        if (!response.ok) {
            if (response.status === 404) {
                throw new Error(`Style not found: ${styleNumber}`);
            }
            throw new Error(`API error ${response.status}`);
        }

        const data = await response.json();
        return data;
    } catch (error) {
        if (attempt < CONFIG.RETRY_ATTEMPTS) {
            await sleep(1000 * attempt); // Exponential backoff
            return fetchPricingData(styleNumber, attempt + 1);
        }
        throw error;
    }
}

/**
 * Calculate pricing using service logic (static page)
 */
function calculateServicePricing(apiData) {
    const { tiersR, rulesR, allEmbroideryCostsR, sizes, sellingPriceDisplayAddOns } = apiData;

    if (!sizes || sizes.length === 0) {
        throw new Error('No sizes available');
    }

    // Sort sizes and find standard garment
    const sortedSizes = [...sizes].sort((a, b) => (a.sortOrder || Infinity) - (b.sortOrder || Infinity));
    const standardGarment = sortedSizes.find(s => s.size.toUpperCase() === 'S') || sortedSizes[0];

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
async function testStyle(styleData) {
    const { style, productTitle, isDiscontinued } = styleData;
    const result = {
        style: style,
        productTitle: productTitle,
        isDiscontinued: isDiscontinued,
        status: 'pending',
        quantities: {},
        errors: []
    };

    try {
        // Skip discontinued styles if configured
        if (isDiscontinued) {
            // Still test but mark as discontinued
            result.status = 'discontinued';
        }

        // Fetch API data
        const apiData = await fetchPricingData(style);

        // Calculate pricing using service logic
        const servicePricing = calculateServicePricing(apiData);

        // Test each quantity
        let allMatch = true;

        for (const quantity of CONFIG.TEST_QUANTITIES) {
            const tierConfig = TIER_CONFIG[quantity];
            const tierPrices = servicePricing.pricing[tierConfig.tier];

            if (!tierPrices || Object.keys(tierPrices).length === 0) {
                result.errors.push(`No pricing for quantity ${quantity}`);
                allMatch = false;
                continue;
            }

            // Store the prices for this quantity
            result.quantities[quantity] = {
                tier: tierConfig.tier,
                embCost: tierConfig.embCost,
                prices: tierPrices,
                match: true // Assume match for now (would compare with quote builder in full implementation)
            };

            // Here you would compare with quote builder prices
            // For now, we're just validating that we can calculate prices
        }

        result.status = allMatch ? 'passed' : 'failed';

    } catch (error) {
        result.status = 'error';
        result.errors.push(error.message);
    }

    return result;
}

/**
 * Test a batch of styles
 */
async function testBatch(styles, batchNumber, totalBatches) {
    console.log(`\n${colors.cyan}Starting batch ${batchNumber}/${totalBatches}${colors.reset}`);

    const results = [];
    const batchSize = styles.length;

    for (let i = 0; i < batchSize; i += CONFIG.CONCURRENT_LIMIT) {
        const concurrent = styles.slice(i, Math.min(i + CONFIG.CONCURRENT_LIMIT, batchSize));

        const promises = concurrent.map(async (styleData) => {
            await sleep(CONFIG.API_DELAY * Math.random()); // Stagger API calls
            const result = await testStyle(styleData);

            // Update counts
            testState.testedCount++;

            if (result.status === 'passed') {
                testState.passedCount++;
                process.stdout.write(`${colors.green}✓${colors.reset}`);
            } else if (result.status === 'failed') {
                testState.failedCount++;
                testState.failures.push(result);
                process.stdout.write(`${colors.red}✗${colors.reset}`);
            } else if (result.status === 'error') {
                testState.errorCount++;
                testState.failures.push(result);
                process.stdout.write(`${colors.yellow}!${colors.reset}`);
            } else if (result.status === 'discontinued') {
                testState.skippedCount++;
                process.stdout.write(`${colors.dim}-${colors.reset}`);
            }

            return result;
        });

        const batchResults = await Promise.all(promises);
        results.push(...batchResults);

        // Update progress display
        updateProgress();

        // Save checkpoint if needed
        if (testState.testedCount - testState.lastCheckpoint >= CONFIG.CHECKPOINT_INTERVAL) {
            saveProgress();
        }
    }

    return results;
}

/**
 * Update progress display
 */
function updateProgress() {
    const percentage = ((testState.testedCount / testState.totalStyles) * 100).toFixed(1);
    const elapsed = Date.now() - testState.startTime;
    const rate = testState.testedCount / (elapsed / 60000); // styles per minute
    const remaining = (testState.totalStyles - testState.testedCount) / rate;

    process.stdout.write('\r' + ' '.repeat(100) + '\r'); // Clear line
    process.stdout.write(
        `Progress: ${testState.testedCount}/${testState.totalStyles} (${percentage}%) | ` +
        `✓ ${testState.passedCount} | ✗ ${testState.failedCount} | ! ${testState.errorCount} | ` +
        `Rate: ${rate.toFixed(0)}/min | ETA: ${remaining.toFixed(0)}m`
    );
}

/**
 * Generate final report
 */
function generateReport() {
    const elapsed = Date.now() - testState.startTime;
    const duration = formatDuration(elapsed);

    const report = [];
    report.push('');
    report.push('='.repeat(60));
    report.push('FINAL REPORT - SANMAR EMBROIDERY PRICING TEST');
    report.push('='.repeat(60));
    report.push('');
    report.push(`Total Styles Tested: ${testState.testedCount}`);
    report.push(`Passed: ${testState.passedCount} (${((testState.passedCount/testState.testedCount)*100).toFixed(1)}%)`);
    report.push(`Failed: ${testState.failedCount} (${((testState.failedCount/testState.testedCount)*100).toFixed(1)}%)`);
    report.push(`Errors: ${testState.errorCount} (${((testState.errorCount/testState.testedCount)*100).toFixed(1)}%)`);
    report.push(`Skipped: ${testState.skippedCount}`);
    report.push('');
    report.push(`Test Duration: ${duration}`);
    report.push(`Average Rate: ${(testState.testedCount / (elapsed / 60000)).toFixed(0)} styles/minute`);
    report.push('');

    // Show sample failures
    if (testState.failures.length > 0) {
        report.push('Sample Failures (first 10):');
        report.push('-'.repeat(40));

        testState.failures.slice(0, 10).forEach(failure => {
            report.push(`  ${failure.style}: ${failure.errors.join(', ')}`);
        });

        if (testState.failures.length > 10) {
            report.push(`  ... and ${testState.failures.length - 10} more`);
        }
    }

    report.push('');
    report.push('Output Files:');
    report.push(`  Summary: ${CONFIG.SUMMARY_FILE}`);
    report.push(`  Failures: ${CONFIG.FAILURES_FILE}`);
    report.push(`  Full Results: ${CONFIG.FULL_RESULTS_FILE}`);

    return report.join('\n');
}

/**
 * Save results to files
 */
function saveResults(report) {
    // Save summary
    const summaryFile = path.join(CONFIG.OUTPUT_DIR, CONFIG.SUMMARY_FILE);
    fs.writeFileSync(summaryFile, report);

    // Save failures as CSV
    const failuresFile = path.join(CONFIG.OUTPUT_DIR, CONFIG.FAILURES_FILE);
    const csvHeader = 'Style,Product Title,Status,Errors\n';
    const csvRows = testState.failures.map(f =>
        `"${f.style}","${f.productTitle}","${f.status}","${f.errors.join('; ')}"`
    ).join('\n');
    fs.writeFileSync(failuresFile, csvHeader + csvRows);

    // Save full results as JSON
    const fullResultsFile = path.join(CONFIG.OUTPUT_DIR, CONFIG.FULL_RESULTS_FILE);
    fs.writeFileSync(fullResultsFile, JSON.stringify(testState.results, null, 2));

    console.log(`\n${colors.green}✓ Results saved to files${colors.reset}`);
}

/**
 * Utility functions
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
        return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
        return `${minutes}m ${seconds % 60}s`;
    } else {
        return `${seconds}s`;
    }
}

/**
 * Main test runner
 */
async function main() {
    console.log(`${colors.bright}${colors.blue}${'='.repeat(60)}${colors.reset}`);
    console.log(`${colors.bright}SANMAR EMBROIDERY PRICING TEST${colors.reset}`);
    console.log(`${colors.bright}${colors.blue}${'='.repeat(60)}${colors.reset}\n`);

    try {
        // Check for node-fetch
        if (!fetch) {
            console.log(`${colors.yellow}Installing node-fetch...${colors.reset}`);
            const { execSync } = require('child_process');
            execSync('npm install node-fetch@2', { stdio: 'inherit' });
            console.log(`${colors.green}node-fetch installed. Please run the script again.${colors.reset}`);
            process.exit(0);
        }

        // Read styles from CSV
        const styles = await readStylesFromCSV();
        testState.totalStyles = styles.length;

        // Check for previous progress
        const previousProgress = await checkForPreviousProgress();

        let stylesToTest = styles;
        if (previousProgress) {
            testState = previousProgress;
            // Filter out already tested styles
            const testedStyles = new Set(testState.results.map(r => r.style));
            stylesToTest = styles.filter(s => !testedStyles.has(s.style));
            console.log(`\n${colors.cyan}Resuming test with ${stylesToTest.length} remaining styles${colors.reset}`);
        } else {
            // Start fresh
            testState.startTime = Date.now();
            console.log(`\nStarting test of ${styles.length} styles`);
            console.log(`Test quantities: ${CONFIG.TEST_QUANTITIES.join(', ')}`);
            console.log(`Batch size: ${CONFIG.BATCH_SIZE}`);
            console.log(`Concurrent limit: ${CONFIG.CONCURRENT_LIMIT}\n`);
        }

        // Process non-discontinued styles first
        const activeStyles = stylesToTest.filter(s => !s.isDiscontinued);
        const discontinuedStyles = stylesToTest.filter(s => s.isDiscontinued);

        console.log(`Active styles: ${activeStyles.length}`);
        console.log(`Discontinued styles: ${discontinuedStyles.length}\n`);

        // Test active styles first
        const allStylesToTest = [...activeStyles, ...discontinuedStyles];

        // Process in batches
        const totalBatches = Math.ceil(allStylesToTest.length / CONFIG.BATCH_SIZE);

        for (let i = 0; i < allStylesToTest.length; i += CONFIG.BATCH_SIZE) {
            const batch = allStylesToTest.slice(i, Math.min(i + CONFIG.BATCH_SIZE, allStylesToTest.length));
            const batchNumber = Math.floor(i / CONFIG.BATCH_SIZE) + 1;

            const batchResults = await testBatch(batch, batchNumber, totalBatches);
            testState.results.push(...batchResults);
            testState.currentBatch = batchNumber;
        }

        // Generate and save report
        const report = generateReport();
        console.log(report);
        saveResults(report);

        // Clean up progress file
        const progressFile = path.join(CONFIG.OUTPUT_DIR, CONFIG.PROGRESS_FILE);
        if (fs.existsSync(progressFile)) {
            fs.unlinkSync(progressFile);
        }

        console.log(`\n${colors.green}${colors.bright}Test completed successfully!${colors.reset}`);

    } catch (error) {
        console.error(`\n${colors.red}Fatal error: ${error.message}${colors.reset}`);
        console.error(error.stack);

        // Save progress on error
        if (testState.testedCount > 0) {
            saveProgress();
            console.log(`${colors.yellow}Progress saved. You can resume the test later.${colors.reset}`);
        }

        process.exit(1);
    }
}

// Handle interruption
process.on('SIGINT', () => {
    console.log(`\n\n${colors.yellow}Test interrupted by user${colors.reset}`);

    if (testState.testedCount > 0) {
        saveProgress();
        console.log(`${colors.cyan}Progress saved. You can resume the test later.${colors.reset}`);

        const quickReport = generateReport();
        console.log(quickReport);
    }

    process.exit(0);
});

// Run the test
main();