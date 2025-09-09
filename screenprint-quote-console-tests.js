/**
 * Screen Print Quote Builder Console Test Suite
 * Run these tests directly in the browser console on screenprint-quote-builder.html
 */

console.log('%c🧪 SCREEN PRINT QUOTE BUILDER TEST SUITE', 'color: #4cb354; font-size: 20px; font-weight: bold;');
console.log('=' .repeat(60));

// Test results tracker
const testResults = {
    passed: [],
    failed: [],
    warnings: []
};

function logTest(testName, condition, details = '') {
    if (condition) {
        console.log(`✅ ${testName}`, details);
        testResults.passed.push(testName);
    } else {
        console.error(`❌ ${testName}`, details);
        testResults.failed.push(testName);
    }
}

function logWarning(message) {
    console.warn(`⚠️ ${message}`);
    testResults.warnings.push(message);
}

// Start Testing
console.group('1️⃣ Service Initialization Tests');

// Test 1: Check if main builder instance exists
logTest('Main Builder Instance', 
    typeof screenPrintQuoteBuilder !== 'undefined',
    screenPrintQuoteBuilder ? 'ScreenPrintQuoteBuilder initialized' : 'Not found');

// Test 2: Check services
if (screenPrintQuoteBuilder) {
    logTest('Quote Service', 
        screenPrintQuoteBuilder.quoteService instanceof ScreenPrintQuoteService,
        'ScreenPrintQuoteService');
    
    logTest('Product Service', 
        screenPrintQuoteBuilder.productService instanceof ScreenPrintProductManager,
        'ScreenPrintProductManager');
    
    logTest('Pricing Service', 
        screenPrintQuoteBuilder.pricingService instanceof ScreenPrintPricingCalculator,
        'ScreenPrintPricingCalculator');
}

console.groupEnd();

console.group('2️⃣ UI Element Tests');

// Test UI elements exist
const uiElements = [
    'phase-1', 'phase-2', 'phase-3',
    'dark-garment-toggle', 'safety-stripes-toggle',
    'style-search', 'style-suggestions',
    'color-select', 'load-product-btn',
    'product-display', 'size-inputs',
    'add-to-quote-btn', 'products-container',
    'quote-summary', 'generate-quote-btn'
];

uiElements.forEach(id => {
    const element = document.getElementById(id);
    logTest(`UI Element: ${id}`, !!element, element ? 'Found' : 'Missing');
});

console.groupEnd();

console.group('3️⃣ Feature Tests');

// Test dark garments toggle
const darkToggle = document.getElementById('dark-garment-toggle');
if (darkToggle) {
    darkToggle.checked = true;
    darkToggle.dispatchEvent(new Event('change'));
    logTest('Dark Garments Toggle', 
        screenPrintQuoteBuilder.printSetup.darkGarments === true,
        'Toggle updates state');
    darkToggle.checked = false;
    darkToggle.dispatchEvent(new Event('change'));
}

// Test safety stripes toggle
const safetyToggle = document.getElementById('safety-stripes-toggle');
if (safetyToggle) {
    safetyToggle.checked = true;
    safetyToggle.dispatchEvent(new Event('change'));
    logTest('Safety Stripes Toggle', 
        screenPrintQuoteBuilder.printSetup.safetyStripes === true,
        'Toggle updates state');
    safetyToggle.checked = false;
    safetyToggle.dispatchEvent(new Event('change'));
}

// Test location selection
const locationCards = document.querySelectorAll('.location-card');
logTest('Location Cards', locationCards.length > 0, `Found ${locationCards.length} locations`);

if (locationCards.length > 0) {
    // Click first location
    locationCards[0].click();
    logTest('Location Selection', 
        screenPrintQuoteBuilder.printSetup.locations.length > 0,
        `Selected: ${screenPrintQuoteBuilder.printSetup.locations.join(', ')}`);
}

console.groupEnd();

console.group('4️⃣ Quote ID Generation Test');

if (screenPrintQuoteBuilder && screenPrintQuoteBuilder.quoteService) {
    const quoteId = screenPrintQuoteBuilder.quoteService.generateQuoteID();
    const validFormat = /^SP\d{4}-\d+$/.test(quoteId);
    logTest('Quote ID Format', validFormat, `Generated: ${quoteId}`);
    
    // Test sequential generation
    const quoteId2 = screenPrintQuoteBuilder.quoteService.generateQuoteID();
    const sequence1 = parseInt(quoteId.split('-')[1]);
    const sequence2 = parseInt(quoteId2.split('-')[1]);
    logTest('Sequential Quote IDs', sequence2 === sequence1 + 1, 
        `${quoteId} → ${quoteId2}`);
}

console.groupEnd();

console.group('5️⃣ Product Search Test');

// Test search functionality
async function testProductSearch() {
    if (!screenPrintQuoteBuilder) {
        logWarning('Builder not initialized, skipping search test');
        return;
    }
    
    try {
        const searchResults = await screenPrintQuoteBuilder.productService.searchProducts('PC');
        logTest('Product Search API', 
            Array.isArray(searchResults) && searchResults.length > 0,
            `Found ${searchResults.length} products`);
        
        // Test search display
        const searchInput = document.getElementById('style-search');
        if (searchInput) {
            searchInput.value = 'PC54';
            searchInput.dispatchEvent(new Event('input'));
            
            setTimeout(() => {
                const suggestions = document.getElementById('style-suggestions');
                const isVisible = suggestions && suggestions.style.display !== 'none';
                logTest('Search Suggestions Display', isVisible, 
                    'Dropdown appears on search');
            }, 500);
        }
    } catch (error) {
        logTest('Product Search', false, error.message);
    }
}

testProductSearch();

console.groupEnd();

console.group('6️⃣ Pricing Calculation Test');

async function testPricing() {
    if (!screenPrintQuoteBuilder) {
        logWarning('Builder not initialized, skipping pricing test');
        return;
    }
    
    // Set up test data
    const testSetup = {
        locations: ['FF', 'FB'],
        colorsByLocation: {'FF': 2, 'FB': 1},
        darkGarments: true,
        safetyStripes: true
    };
    
    const testProducts = [{
        styleNumber: 'PC54',
        productName: 'Test Shirt',
        quantity: 48,
        sizeBreakdown: {'M': 24, 'L': 24},
        color: 'Black'
    }];
    
    try {
        const pricing = await screenPrintQuoteBuilder.pricingService.calculateQuotePricing(testSetup, testProducts);
        logTest('Pricing Calculation', 
            pricing && pricing.totalAmount > 0,
            `Total: $${pricing.totalAmount.toFixed(2)}`);
        
        // Check components
        if (pricing) {
            console.log('Pricing Breakdown:', {
                subtotal: pricing.subtotal,
                safetyStripesTotal: pricing.safetyStripesTotal,
                totalAmount: pricing.totalAmount,
                totalQuantity: pricing.totalQuantity
            });
        }
    } catch (error) {
        logTest('Pricing Calculation', false, error.message);
    }
}

testPricing();

console.groupEnd();

console.group('7️⃣ Phase Navigation Test');

// Test phase navigation
if (screenPrintQuoteBuilder) {
    const initialPhase = screenPrintQuoteBuilder.currentPhase;
    logTest('Initial Phase', initialPhase === 1, `Phase ${initialPhase}`);
    
    // Try to navigate to phase 2
    const phase2Step = document.querySelector('[data-phase="2"]');
    if (phase2Step) {
        // First need to select a location
        const firstLocation = document.querySelector('.location-card');
        if (firstLocation) {
            firstLocation.click();
            const continueBtn = document.getElementById('continue-to-products');
            if (continueBtn && !continueBtn.disabled) {
                continueBtn.click();
                setTimeout(() => {
                    logTest('Phase Navigation', 
                        screenPrintQuoteBuilder.currentPhase === 2,
                        `Navigated to Phase ${screenPrintQuoteBuilder.currentPhase}`);
                }, 100);
            }
        }
    }
}

console.groupEnd();

// Summary
console.group('📊 TEST SUMMARY');
console.log(`✅ Passed: ${testResults.passed.length}`);
console.log(`❌ Failed: ${testResults.failed.length}`);
console.log(`⚠️ Warnings: ${testResults.warnings.length}`);

if (testResults.failed.length > 0) {
    console.error('Failed tests:', testResults.failed);
}

if (testResults.warnings.length > 0) {
    console.warn('Warnings:', testResults.warnings);
}

const successRate = (testResults.passed.length / (testResults.passed.length + testResults.failed.length) * 100).toFixed(1);
console.log(`Success Rate: ${successRate}%`);

if (successRate === '100.0') {
    console.log('%c✨ ALL TESTS PASSED! ✨', 'color: green; font-size: 16px; font-weight: bold;');
} else if (successRate >= 80) {
    console.log('%c⚡ Most tests passed, minor issues to fix', 'color: orange; font-size: 14px;');
} else {
    console.log('%c⛔ Critical issues detected, needs attention', 'color: red; font-size: 14px;');
}

console.groupEnd();

// Export test function for manual use
window.SCREENPRINT_TESTS = {
    runAll: () => location.reload(),
    testSearch: testProductSearch,
    testPricing: testPricing,
    getResults: () => testResults,
    
    // Manual test helpers
    selectLocation: (code) => {
        const card = document.querySelector(`[data-location="${code}"]`);
        if (card) card.click();
    },
    
    setDarkGarments: (enabled) => {
        const toggle = document.getElementById('dark-garment-toggle');
        if (toggle) {
            toggle.checked = enabled;
            toggle.dispatchEvent(new Event('change'));
        }
    },
    
    setSafetyStripes: (enabled) => {
        const toggle = document.getElementById('safety-stripes-toggle');
        if (toggle) {
            toggle.checked = enabled;
            toggle.dispatchEvent(new Event('change'));
        }
    },
    
    searchProduct: (term) => {
        const input = document.getElementById('style-search');
        if (input) {
            input.value = term;
            input.dispatchEvent(new Event('input'));
        }
    },
    
    checkState: () => {
        return {
            phase: screenPrintQuoteBuilder.currentPhase,
            locations: screenPrintQuoteBuilder.printSetup.locations,
            colorsByLocation: screenPrintQuoteBuilder.printSetup.colorsByLocation,
            darkGarments: screenPrintQuoteBuilder.printSetup.darkGarments,
            safetyStripes: screenPrintQuoteBuilder.printSetup.safetyStripes,
            products: screenPrintQuoteBuilder.products
        };
    }
};

console.log('%c🎮 Test helpers available at window.SCREENPRINT_TESTS', 'color: #4cb354; font-style: italic;');
console.log('Try: SCREENPRINT_TESTS.checkState() or SCREENPRINT_TESTS.testSearch()');