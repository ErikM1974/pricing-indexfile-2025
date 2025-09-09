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
        console.log('✅ PASSED: Safety stripe cost is $2.00');
    } else {
        console.error('❌ FAILED: Safety stripe cost not set correctly');
    }
}
console.groupEnd();

// Test 3: Test pricing calculation with safety stripes
console.group('Test 3: Pricing Calculation');
async function testSafetyPricing() {
    // Set up test scenario
    const testSetup = {
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
        // Calculate pricing with safety stripes
        const withSafety = await pricingCalculator.calculateQuotePricing(testProducts, testSetup);
        
        // Calculate without safety stripes
        testSetup.safetyStripes = false;
        const withoutSafety = await pricingCalculator.calculateQuotePricing(testProducts, testSetup);
        
        console.log('Pricing WITH safety stripes:');
        console.log('  Subtotal:', withSafety.subtotal);
        console.log('  Safety Stripes Total:', withSafety.safetyStripesTotal);
        console.log('  Grand Total:', withSafety.grandTotal);
        
        console.log('Pricing WITHOUT safety stripes:');
        console.log('  Subtotal:', withoutSafety.subtotal);
        console.log('  Safety Stripes Total:', withoutSafety.safetyStripesTotal);
        console.log('  Grand Total:', withoutSafety.grandTotal);
        
        const expectedDifference = 48 * 2.00; // 48 pieces × $2.00
        const actualDifference = withSafety.subtotal - withoutSafety.subtotal;
        
        console.log('Expected difference:', expectedDifference);
        console.log('Actual difference:', actualDifference);
        
        if (Math.abs(actualDifference - expectedDifference) < 0.01) {
            console.log('✅ PASSED: Safety stripe pricing adds $2.00 per unit');
        } else {
            console.error('❌ FAILED: Safety stripe pricing not calculating correctly');
        }
        
        if (withSafety.safetyStripesTotal === expectedDifference) {
            console.log('✅ PASSED: Safety stripe total calculated correctly');
        } else {
            console.error('❌ FAILED: Safety stripe total incorrect');
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