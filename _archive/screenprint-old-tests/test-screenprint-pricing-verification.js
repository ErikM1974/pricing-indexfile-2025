// Screen Print Pricing Verification Script
// Tests that pricing is calculating correctly for front and additional locations

(function() {
    'use strict';
    
    console.log('=== SCREEN PRINT PRICING VERIFICATION ===');
    
    // Wait for components to initialize
    setTimeout(() => {
        const calculator = window.ScreenPrintCalculator;
        const adapter = window.ScreenPrintAdapter;
        const integration = window.ScreenPrintIntegration;
        
        if (!calculator || !adapter || !integration) {
            console.error('❌ Required components not loaded');
            return;
        }
        
        console.log('✅ All components loaded');
        
        // Get current state
        const state = calculator.getState();
        console.log('Current State:', state);
        
        // Test pricing calculation
        console.log('\n--- Testing Pricing Calculation ---');
        
        // Set test values
        calculator.updateQuantity(96);
        calculator.updateColors('front', 2);
        
        // Add a back location with 1 color
        if (state.additionalLocations.length === 0) {
            console.log('Adding back location with 1 color...');
            integration.addLocationControl();
        }
        
        // Wait for DOM update
        setTimeout(() => {
            // Get current pricing
            const pricing = calculator.getCurrentPricing();
            console.log('\nPricing Calculation Results:');
            console.log('- Quantity:', pricing.quantity);
            console.log('- Front Colors:', pricing.colors.front);
            console.log('- Additional Locations:', pricing.additionalLocationBreakdown);
            console.log('- Base Price:', pricing.basePrice);
            console.log('- Additional Location Cost:', pricing.additionalLocationCost);
            console.log('- Total per shirt (base + additional):', pricing.basePriceWithAdditional);
            console.log('- Setup Fee:', pricing.setupFee);
            console.log('- Grand Total:', pricing.grandTotal);
            
            // Verify calculations
            console.log('\n--- Verification ---');
            
            if (pricing.basePrice > 0) {
                console.log('✅ Base price is calculating');
            } else {
                console.log('❌ Base price is zero - check Caspio data');
            }
            
            if (pricing.additionalLocationBreakdown.length > 0 && pricing.additionalLocationCost > 0) {
                console.log('✅ Additional location pricing is working');
            } else if (pricing.additionalLocationBreakdown.length > 0) {
                console.log('❌ Additional location exists but cost is zero');
            }
            
            if (pricing.setupFee > 0) {
                console.log('✅ Setup fees are calculating');
            } else {
                console.log('❌ Setup fees are zero');
            }
            
            // Check UI updates
            console.log('\n--- UI Update Check ---');
            const basePriceElement = document.getElementById('sp-base-price-large');
            const grandTotalElement = document.getElementById('sp-grand-total');
            
            if (basePriceElement) {
                console.log('Base price display:', basePriceElement.textContent);
                if (parseFloat(basePriceElement.textContent) > 0) {
                    console.log('✅ Base price UI is updating');
                } else {
                    console.log('❌ Base price UI shows zero');
                }
            }
            
            if (grandTotalElement) {
                console.log('Grand total display:', grandTotalElement.textContent);
                if (grandTotalElement.textContent.includes('$') && parseFloat(grandTotalElement.textContent.replace(/[^0-9.-]+/g,"")) > 0) {
                    console.log('✅ Grand total UI is updating');
                } else {
                    console.log('❌ Grand total UI shows zero or invalid');
                }
            }
            
            // Check for pricing-matrix-capture loading
            console.log('\n--- Checking for pricing-matrix-capture ---');
            const scripts = Array.from(document.scripts);
            const hasPricingMatrixCapture = scripts.some(s => s.src.includes('pricing-matrix-capture'));
            
            if (hasPricingMatrixCapture) {
                console.log('⚠️ pricing-matrix-capture.js is still loading - this may cause conflicts');
            } else {
                console.log('✅ pricing-matrix-capture.js is not loaded (good!)');
            }
            
            // Check master bundle
            console.log('\n--- Master Bundle Check ---');
            const adapterReady = adapter.isReady();
            if (adapterReady) {
                console.log('✅ Adapter has received master bundle data');
            } else {
                console.log('❌ Adapter has not received master bundle data from Caspio');
            }
            
        }, 1000);
        
    }, 2000);
    
})();