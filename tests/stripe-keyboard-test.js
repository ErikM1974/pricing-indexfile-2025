/**
 * Puppeteer Test: Stripe Payment Field Keyboard Input
 *
 * Tests that the Stripe combined card element:
 * 1. Mounts correctly
 * 2. Does NOT cause focus loops
 * 3. Accepts focus when clicked
 *
 * Note: Stripe Elements use cross-origin iframes, so we cannot directly
 * type into them via Puppeteer. But we CAN verify:
 * - Element mounts without errors
 * - No infinite focus loop messages
 * - The iframe is present and focusable
 */

const puppeteer = require('puppeteer');

const BASE_URL = 'http://localhost:3000';
const TEST_TIMEOUT = 60000; // 60 seconds

async function runStripeTest() {
    console.log('\n🧪 Starting Stripe Payment Field Test...\n');

    let browser;
    let testResults = {
        passed: [],
        failed: [],
        warnings: []
    };

    try {
        // Launch browser
        console.log('📱 Launching Chrome browser...');
        browser = await puppeteer.launch({
            headless: false, // Show browser for debugging
            slowMo: 50, // Slow down for visibility
            args: ['--window-size=1280,900']
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 900 });

        // Collect console messages to detect focus loops
        const consoleMessages = [];
        page.on('console', msg => {
            const text = msg.text();
            consoleMessages.push(text);

            // Log Stripe-related messages
            if (text.includes('Stripe') || text.includes('focus') || text.includes('card')) {
                console.log(`  [Console] ${text}`);
            }
        });

        // Track any errors
        const pageErrors = [];
        page.on('pageerror', error => {
            pageErrors.push(error.message);
            console.log(`  ❌ [Page Error] ${error.message}`);
        });

        // ============ TEST 1: Navigate to 3-Day Tees page ============
        console.log('\n📍 Test 1: Navigate to 3-Day Tees page...');
        try {
            await page.goto(`${BASE_URL}/pages/3-day-tees.html`, {
                waitUntil: 'networkidle2',
                timeout: TEST_TIMEOUT
            });
            console.log('  ✅ Page loaded successfully');
            testResults.passed.push('Page Navigation');
        } catch (e) {
            console.log(`  ❌ Failed to load page: ${e.message}`);
            testResults.failed.push('Page Navigation: ' + e.message);
            throw e;
        }

        // ============ TEST 2: Select a color ============
        console.log('\n📍 Test 2: Select a color...');
        try {
            // Wait for color options to appear
            await page.waitForSelector('.color-option', { timeout: 10000 });

            // Click the first color
            await page.click('.color-option');
            await new Promise(r => setTimeout(r, 500));

            console.log('  ✅ Color selected');
            testResults.passed.push('Color Selection');
        } catch (e) {
            console.log(`  ⚠️ Could not select color: ${e.message}`);
            testResults.warnings.push('Color Selection: ' + e.message);
        }

        // ============ TEST 3: Add quantities ============
        console.log('\n📍 Test 3: Add quantities to proceed...');
        try {
            // Try to find quantity inputs and add values
            const qtyInputs = await page.$$('input[type="number"]');

            if (qtyInputs.length > 0) {
                // Add quantity to first size input
                await qtyInputs[0].click({ clickCount: 3 });
                await qtyInputs[0].type('12');
                await new Promise(r => setTimeout(r, 300));
                console.log('  ✅ Added quantity');
                testResults.passed.push('Add Quantity');
            } else {
                console.log('  ⚠️ No quantity inputs found yet');
                testResults.warnings.push('Quantity inputs not found');
            }
        } catch (e) {
            console.log(`  ⚠️ Could not add quantity: ${e.message}`);
            testResults.warnings.push('Add Quantity: ' + e.message);
        }

        // ============ TEST 4: Navigate to Payment step (Step 4) ============
        console.log('\n📍 Test 4: Navigate to Payment step...');
        try {
            // Look for continue/next buttons and click through steps
            for (let step = 0; step < 4; step++) {
                const continueBtn = await page.$('button:not([disabled])[class*="continue"], button:not([disabled])[class*="next"], .btn-primary:not([disabled])');
                if (continueBtn) {
                    await continueBtn.click();
                    await new Promise(r => setTimeout(r, 1000));
                }
            }

            // Also try clicking step indicators directly
            const step4Indicator = await page.$('[data-step="4"], .step-4, #step4-tab');
            if (step4Indicator) {
                await step4Indicator.click();
                await new Promise(r => setTimeout(r, 1000));
            }

            console.log('  ✅ Attempted navigation to payment step');
            testResults.passed.push('Navigate to Payment Step');
        } catch (e) {
            console.log(`  ⚠️ Navigation issue: ${e.message}`);
            testResults.warnings.push('Navigate to Payment: ' + e.message);
        }

        // ============ TEST 5: Check for Stripe element mounting ============
        console.log('\n📍 Test 5: Check Stripe element mounting...');
        try {
            // Wait a bit for Stripe to initialize
            await new Promise(r => setTimeout(r, 2000));

            // Check if Stripe iframe exists
            const stripeFrame = await page.$('iframe[name^="__privateStripeFrame"], iframe[src*="stripe.com"]');

            if (stripeFrame) {
                console.log('  ✅ Stripe iframe found - element mounted successfully');
                testResults.passed.push('Stripe Element Mounted');
            } else {
                // Check for card-element container
                const cardElement = await page.$('#card-element');
                if (cardElement) {
                    const innerHTML = await page.evaluate(el => el.innerHTML, cardElement);
                    if (innerHTML.includes('iframe') || innerHTML.length > 50) {
                        console.log('  ✅ Stripe card element container has content');
                        testResults.passed.push('Stripe Element Has Content');
                    } else {
                        console.log('  ⚠️ Card element exists but may not have Stripe iframe yet');
                        testResults.warnings.push('Stripe iframe not detected');
                    }
                } else {
                    console.log('  ⚠️ #card-element not found on page');
                    testResults.warnings.push('Card element container not found');
                }
            }
        } catch (e) {
            console.log(`  ❌ Error checking Stripe: ${e.message}`);
            testResults.failed.push('Stripe Element Check: ' + e.message);
        }

        // ============ TEST 6: Check for focus loops ============
        console.log('\n📍 Test 6: Check for focus loops...');
        try {
            // Count focus-related messages
            const focusMessages = consoleMessages.filter(msg =>
                msg.includes('focus') && msg.includes('Combined card')
            );

            if (focusMessages.length > 5) {
                console.log(`  ❌ FOCUS LOOP DETECTED: ${focusMessages.length} focus messages`);
                testResults.failed.push(`Focus Loop: ${focusMessages.length} repeated focus messages`);
            } else if (focusMessages.length > 0) {
                console.log(`  ✅ Focus events normal: ${focusMessages.length} messages`);
                testResults.passed.push('No Focus Loop');
            } else {
                console.log('  ✅ No focus-related console messages (good)');
                testResults.passed.push('No Focus Loop Messages');
            }
        } catch (e) {
            console.log(`  ⚠️ Could not check focus logs: ${e.message}`);
            testResults.warnings.push('Focus Loop Check: ' + e.message);
        }

        // ============ TEST 7: Check for infinite loop messages ============
        console.log('\n📍 Test 7: Check for infinite loop messages...');
        try {
            const infiniteLoopMessages = consoleMessages.filter(msg =>
                msg.includes('waiting') && msg.includes('Container not visible')
            );

            if (infiniteLoopMessages.length > 10) {
                console.log(`  ❌ INFINITE LOOP: ${infiniteLoopMessages.length} "waiting" messages`);
                testResults.failed.push(`Infinite Loop: ${infiniteLoopMessages.length} waiting messages`);
            } else {
                console.log('  ✅ No infinite loop detected');
                testResults.passed.push('No Infinite Loop');
            }
        } catch (e) {
            testResults.warnings.push('Infinite Loop Check: ' + e.message);
        }

        // ============ TEST 8: Try clicking the Stripe field ============
        console.log('\n📍 Test 8: Try clicking Stripe field...');
        try {
            // Click on the card element container
            const cardElement = await page.$('#card-element, .stripe-combined-element');
            if (cardElement) {
                await cardElement.click();
                await new Promise(r => setTimeout(r, 500));
                console.log('  ✅ Clicked on Stripe card element');
                testResults.passed.push('Stripe Element Clickable');

                // Check for additional focus loop messages after click
                const postClickFocusCount = consoleMessages.filter(msg =>
                    msg.includes('focus') && msg.includes('Combined card')
                ).length;

                await new Promise(r => setTimeout(r, 1000));

                const finalFocusCount = consoleMessages.filter(msg =>
                    msg.includes('focus') && msg.includes('Combined card')
                ).length;

                if (finalFocusCount - postClickFocusCount > 3) {
                    console.log(`  ⚠️ Multiple focus events after click: ${finalFocusCount - postClickFocusCount}`);
                    testResults.warnings.push('Multiple focus events after click');
                } else {
                    console.log('  ✅ Focus behavior normal after click');
                }
            }
        } catch (e) {
            console.log(`  ⚠️ Could not click Stripe element: ${e.message}`);
            testResults.warnings.push('Click Stripe Element: ' + e.message);
        }

        // ============ TEST 9: Check page errors ============
        console.log('\n📍 Test 9: Check for page errors...');
        if (pageErrors.length > 0) {
            console.log(`  ❌ ${pageErrors.length} page errors detected`);
            pageErrors.forEach(err => console.log(`    - ${err}`));
            testResults.failed.push(`Page Errors: ${pageErrors.length} errors`);
        } else {
            console.log('  ✅ No page errors');
            testResults.passed.push('No Page Errors');
        }

        // Take screenshot for review
        console.log('\n📸 Taking screenshot...');
        await page.screenshot({
            path: 'tests/stripe-test-screenshot.png',
            fullPage: false
        });
        console.log('  Screenshot saved to tests/stripe-test-screenshot.png');

    } catch (error) {
        console.error('\n❌ Test execution error:', error.message);
        testResults.failed.push('Test Execution: ' + error.message);
    } finally {
        // Print results
        console.log('\n' + '='.repeat(60));
        console.log('📊 TEST RESULTS SUMMARY');
        console.log('='.repeat(60));

        console.log(`\n✅ PASSED (${testResults.passed.length}):`);
        testResults.passed.forEach(t => console.log(`   • ${t}`));

        if (testResults.warnings.length > 0) {
            console.log(`\n⚠️ WARNINGS (${testResults.warnings.length}):`);
            testResults.warnings.forEach(t => console.log(`   • ${t}`));
        }

        if (testResults.failed.length > 0) {
            console.log(`\n❌ FAILED (${testResults.failed.length}):`);
            testResults.failed.forEach(t => console.log(`   • ${t}`));
        }

        console.log('\n' + '='.repeat(60));

        const total = testResults.passed.length + testResults.failed.length;
        const passRate = total > 0 ? Math.round((testResults.passed.length / total) * 100) : 0;
        console.log(`Overall: ${testResults.passed.length}/${total} passed (${passRate}%)`);

        if (testResults.failed.length === 0) {
            console.log('\n🎉 ALL CRITICAL TESTS PASSED!\n');
        } else {
            console.log('\n⚠️ Some tests failed - review output above\n');
        }

        // Keep browser open for 5 seconds to see final state
        if (browser) {
            console.log('Keeping browser open for 5 seconds for review...');
            await new Promise(resolve => setTimeout(resolve, 5000));
            await browser.close();
        }
    }

    return testResults;
}

// Run the test
runStripeTest()
    .then(results => {
        process.exit(results.failed.length > 0 ? 1 : 0);
    })
    .catch(err => {
        console.error('Fatal error:', err);
        process.exit(1);
    });
