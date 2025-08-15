// Screen Print Live Check
// Paste this in the console on the actual screen print page

console.log('=== SCREEN PRINT LIVE CHECK ===');

// Check current calculator state
if (window.ScreenPrintCalculator) {
    const state = window.ScreenPrintCalculator.getState();
    console.log('\n📊 Calculator State:', state);
    
    // Check if pricing data is loaded
    if (state.pricingData) {
        console.log('✅ Pricing data loaded');
        console.log('   Tiers:', state.pricingData.tiers.length);
        
        // Show first tier as example
        if (state.pricingData.tiers[0]) {
            const firstTier = state.pricingData.tiers[0];
            console.log('   First tier:', firstTier.label, 'Base price:', firstTier.prices.S);
        }
    } else {
        console.log('❌ No pricing data in calculator state');
    }
    
    // Force a recalculation
    console.log('\n🔄 Forcing recalculation...');
    window.ScreenPrintCalculator.recalculatePricing();
    
    // Get current pricing
    const pricing = window.ScreenPrintCalculator.getCurrentPricing();
    console.log('\n💰 Current Pricing:', {
        quantity: pricing.quantity,
        colors: pricing.colors,
        basePrice: pricing.basePrice,
        setupFee: pricing.setupFee,
        grandTotal: pricing.grandTotal,
        tierInfo: pricing.tierInfo ? pricing.tierInfo.label : 'None'
    });
    
    // Check DOM elements
    console.log('\n🖥️ DOM Check:');
    const elements = {
        'Base Price Display': document.getElementById('sp-base-price-large'),
        'All-in Price': document.getElementById('sp-all-in-price'),
        'Grand Total': document.getElementById('sp-grand-total'),
        'Front Colors': document.getElementById('sp-front-colors'),
        'Quantity Input': document.getElementById('sp-quantity-input')
    };
    
    Object.entries(elements).forEach(([name, el]) => {
        if (el) {
            const value = el.value !== undefined ? el.value : el.textContent;
            console.log(`   ${name}: ${value}`);
        } else {
            console.log(`   ${name}: NOT FOUND`);
        }
    });
    
    // Try setting values manually
    console.log('\n🔧 Testing manual update...');
    const frontColors = document.getElementById('sp-front-colors');
    if (frontColors && frontColors.value === '0') {
        console.log('   Setting front colors to 3...');
        frontColors.value = '3';
        frontColors.dispatchEvent(new Event('change'));
        
        setTimeout(() => {
            const newPricing = window.ScreenPrintCalculator.getCurrentPricing();
            console.log('   New base price after update:', newPricing.basePrice);
            console.log('   New setup fee:', newPricing.setupFee);
        }, 500);
    }
} else {
    console.error('❌ ScreenPrintCalculator not found!');
}

console.log('\n=== CHECK COMPLETE ===');
console.log('If base price is 0, check:');
console.log('1. Is pricing data loaded in calculator state?');
console.log('2. Are front colors set to a value > 0?');
console.log('3. Is the correct tier being selected?');