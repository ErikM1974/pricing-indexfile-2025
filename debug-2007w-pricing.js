// Debug script for 2007W pricing issue
// Run this in console on the page showing wrong pricing

console.log('=== DEBUGGING 2007W PRICING ===');

// Check what master bundle data we have
if (window.ScreenPrintAdapter) {
    // Trigger console to show current state
    if (window.ScreenPrintAdapter.processPricingData) {
        window.ScreenPrintAdapter.processPricingData();
    }
}

// Check calculator state
if (window.ScreenPrintCalculator) {
    const state = window.ScreenPrintCalculator.getState();
    console.log('\n📊 Current Calculator State:');
    console.log('Quantity:', state.quantity);
    console.log('Front Colors:', state.frontColors);
    console.log('Back Colors:', state.backColors);
    console.log('Dark Garment:', state.isDarkGarment);
    
    if (state.pricingData) {
        console.log('\n💰 Pricing Data:');
        console.log('Product:', state.pricingData.styleNumber, state.pricingData.color);
        console.log('Tiers available:', state.pricingData.tiers.length);
        
        // Show all tiers
        console.log('\n📋 All Pricing Tiers:');
        state.pricingData.tiers.forEach(tier => {
            console.log(`\nTier: ${tier.label}`);
            console.log(`Range: ${tier.minQty}-${tier.maxQty || '∞'}`);
            console.log('Prices:', tier.prices);
        });
        
        // Current calculation
        const pricing = window.ScreenPrintCalculator.getCurrentPricing();
        console.log('\n🧮 Current Calculation:');
        console.log('Selected Tier:', pricing.tierInfo ? pricing.tierInfo.label : 'NONE');
        console.log('Base Price:', pricing.basePrice);
        console.log('Total Colors:', pricing.colors.total, '(Front:', pricing.colors.front, 'Back:', pricing.colors.back + ')');
        console.log('Setup Fee:', pricing.setupFee);
        console.log('Grand Total:', pricing.grandTotal);
    } else {
        console.error('❌ No pricing data loaded!');
    }
}

// Check DOM to see actual product
console.log('\n📄 Page Info:');
console.log('URL:', window.location.href);
console.log('Product Title:', document.querySelector('h1, h2, .product-title')?.textContent);

// Listen for next pricing message
console.log('\n👂 Listening for next Caspio message...');
const originalListener = window.addEventListener;
window.addEventListener('message', function(event) {
    if (event.data && event.data.type === 'caspioScreenPrintMasterBundleReady') {
        console.log('\n📨 NEW MASTER BUNDLE RECEIVED:');
        console.log('Product:', event.data.data.sN, event.data.data.cN);
        console.log('Full bundle:', event.data.data);
    }
});

console.log('\n❓ POSSIBLE ISSUES:');
console.log('1. The pricing shown ($7.00) might be from PC54 test data');
console.log('2. The actual 2007W pricing might not be loading');
console.log('3. Check if tierData exists and has proper structure');
console.log('\nTry refreshing the page and watch for the master bundle message.');