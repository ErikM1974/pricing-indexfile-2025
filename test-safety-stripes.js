/**
 * Test script to verify safety stripe pricing functionality
 * Run this in the console on screenprint-quote-builder.html
 */

console.log('%c🦺 Testing Safety Stripe Pricing', 'color: #ff6b35; font-size: 16px; font-weight: bold;');
console.log('=' .repeat(50));

// Test 1: Check if safety stripe toggle updates state
console.group('Test 1: Safety Stripe Toggle');
const safetyToggle = document.getElementById('safety-stripes-toggle');
if (safetyToggle) {
    // Turn off first
    safetyToggle.checked = false;
    safetyToggle.dispatchEvent(new Event('change'));
    const offState = screenPrintQuoteBuilder.printSetup.safetyStripes;
    
    // Turn on
    safetyToggle.checked = true;
    safetyToggle.dispatchEvent(new Event('change'));
    const onState = screenPrintQuoteBuilder.printSetup.safetyStripes;
    
    console.log('Safety Stripe OFF state:', offState);
    console.log('Safety Stripe ON state:', onState);
    
    if (!offState && onState) {
        console.log('✅ PASSED: Toggle correctly updates state');
    } else {
        console.error('❌ FAILED: Toggle not working properly');
    }
}
console.groupEnd();

// Test 2: Check pricing calculator has safety stripe cost
console.group('Test 2: Pricing Calculator Constants');
const pricingCalculator = screenPrintQuoteBuilder.pricingService;
if (pricingCalculator) {
    console.log('Safety Stripe Cost Constant:', pricingCalculator.SAFETY_STRIPE_COST);
    
    if (pricingCalculator.SAFETY_STRIPE_COST === 2.00) {
        console.log('✅ PASSED: Safety stripe cost is $2.00 per location per unit');
    } else {
        console.error('❌ FAILED: Safety stripe cost not set correctly');
    }
}
console.groupEnd();

// Test 3: Test pricing calculation with safety stripes
console.group('Test 3: Pricing Calculation');
async function testSafetyPricing() {
    // Test with 1 location
    console.log('Testing with 1 location (Front only):');
    let testSetup = {
        locations: ['FF'],
        colorsByLocation: {'FF': 2},
        darkGarments: false,
        safetyStripes: true  // Enable safety stripes
    };
    
    const testProducts = [{
        styleNumber: 'PC54',
        productName: 'Test Shirt',
        quantity: 48,
        sizeBreakdown: {'M': 24, 'L': 24},
        color: 'Black'
    }];
    
    try {
        // Test with 1 location
        const withSafety1 = await pricingCalculator.calculateQuotePricing(testProducts, testSetup);
        testSetup.safetyStripes = false;
        const withoutSafety1 = await pricingCalculator.calculateQuotePricing(testProducts, testSetup);
        
        const difference1 = withSafety1.subtotal - withoutSafety1.subtotal;
        const expected1 = 48 * 2.00 * 1; // 48 pieces × $2.00 × 1 location
        
        console.log('  Expected cost (1 location):', expected1);
        console.log('  Actual difference:', difference1);
        console.log('  Safety total:', withSafety1.safetyStripesTotal);
        
        if (Math.abs(difference1 - expected1) < 0.01) {
            console.log('  ✅ PASSED: $2.00 per location pricing correct');
        } else {
            console.error('  ❌ FAILED: Pricing not calculating correctly');
        }
        
        // Test with 2 locations
        console.log('\nTesting with 2 locations (Front + Back):');
        testSetup = {
            locations: ['FF', 'FB'],
            colorsByLocation: {'FF': 2, 'FB': 2},
            darkGarments: false,
            safetyStripes: true
        };
        
        const withSafety2 = await pricingCalculator.calculateQuotePricing(testProducts, testSetup);
        testSetup.safetyStripes = false;
        const withoutSafety2 = await pricingCalculator.calculateQuotePricing(testProducts, testSetup);
        
        const difference2 = withSafety2.subtotal - withoutSafety2.subtotal;
        const expected2 = 48 * 2.00 * 2; // 48 pieces × $2.00 × 2 locations
        
        console.log('  Expected cost (2 locations):', expected2);
        console.log('  Actual difference:', difference2);
        console.log('  Safety total:', withSafety2.safetyStripesTotal);
        
        if (Math.abs(difference2 - expected2) < 0.01) {
            console.log('  ✅ PASSED: $2.00 per location pricing correct');
        } else {
            console.error('  ❌ FAILED: Pricing not calculating correctly');
        }
        
    } catch (error) {
        console.error('Test failed:', error);
    }
}

testSafetyPricing();
console.groupEnd();

// Test 4: Check if safety stripe shows in summary
console.group('Test 4: Summary Display');
function testSummaryDisplay() {
    // Enable safety stripes
    safetyToggle.checked = true;
    safetyToggle.dispatchEvent(new Event('change'));
    
    // Select a location and navigate to products
    const ffCard = document.querySelector('[data-location="FF"]');
    if (ffCard && !ffCard.classList.contains('selected')) {
        ffCard.click();
    }
    
    console.log('Setup state:', {
        safetyStripes: screenPrintQuoteBuilder.printSetup.safetyStripes,
        locations: screenPrintQuoteBuilder.printSetup.locations
    });
    
    console.log('To complete test:');
    console.log('1. Click "Continue to Products"');
    console.log('2. Add a product (e.g., PC54)');
    console.log('3. Click "Continue to Summary"');
    console.log('4. Check if "Safety Stripes" line appears with cost');
}

testSummaryDisplay();
console.groupEnd();

// Summary
console.log('');
console.log('%c📊 Safety Stripe Test Summary', 'color: #ff6b35; font-size: 14px; font-weight: bold;');
console.log('The safety stripe feature should:');
console.log('✓ Toggle on/off correctly');
console.log('✓ Add $2.00 per unit to pricing');
console.log('✓ Show separate line item in quote summary');
console.log('✓ Include cost in grand total');
console.log('');
console.log('Manual verification needed: Navigate through all phases to verify display.');