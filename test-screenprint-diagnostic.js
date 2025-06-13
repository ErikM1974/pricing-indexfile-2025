// Screen Print Diagnostic Script
// Run this in the console on the screen print page to diagnose pricing issues

console.log('=== SCREEN PRINT PRICING DIAGNOSTIC ===');

// Check if adapter is loaded
if (window.ScreenPrintAdapter) {
    console.log('✅ ScreenPrintAdapter loaded');
    console.log('   Ready:', window.ScreenPrintAdapter.isReady());
} else {
    console.error('❌ ScreenPrintAdapter NOT loaded');
}

// Check if calculator is loaded
if (window.ScreenPrintCalculator) {
    console.log('✅ ScreenPrintCalculator loaded');
    const state = window.ScreenPrintCalculator.getState();
    console.log('   Current state:', state);
} else {
    console.error('❌ ScreenPrintCalculator NOT loaded');
}

// Check for master bundle in adapter
console.log('\n=== CHECKING FOR MASTER BUNDLE ===');
// Try to trigger a pricing update
if (window.ScreenPrintAdapter && window.ScreenPrintAdapter.processPricingData) {
    window.ScreenPrintAdapter.processPricingData();
}

// Check DOM elements
console.log('\n=== CHECKING DOM ELEMENTS ===');
const elements = {
    'sp-front-colors': document.getElementById('sp-front-colors'),
    'sp-quantity-input': document.getElementById('sp-quantity-input'),
    'sp-base-price-large': document.getElementById('sp-base-price-large'),
    'custom-pricing-grid': document.getElementById('custom-pricing-grid')
};

Object.entries(elements).forEach(([id, el]) => {
    if (el) {
        console.log(`✅ ${id} found`);
        if (el.value !== undefined) console.log(`   Value: ${el.value}`);
        if (el.textContent) console.log(`   Text: ${el.textContent}`);
    } else {
        console.error(`❌ ${id} NOT found`);
    }
});

// Test pricing calculation
console.log('\n=== TESTING PRICING CALCULATION ===');
if (window.ScreenPrintCalculator) {
    // Try different quantities
    const testCases = [
        { qty: 24, colors: 1 },
        { qty: 48, colors: 3 },
        { qty: 72, colors: 4 }
    ];
    
    testCases.forEach(test => {
        window.ScreenPrintCalculator.updateQuantity(test.qty);
        window.ScreenPrintCalculator.updateColors('front', test.colors);
        const pricing = window.ScreenPrintCalculator.getCurrentPricing();
        
        console.log(`\nTest: ${test.qty} qty, ${test.colors} colors`);
        console.log('Result:', {
            basePrice: pricing.basePrice,
            setupFee: pricing.setupFee,
            grandTotal: pricing.grandTotal,
            tierInfo: pricing.tierInfo
        });
    });
}

// Send test bundle
console.log('\n=== SENDING TEST BUNDLE ===');
const testBundle = {
    type: 'caspioScreenPrintMasterBundleReady',
    data: {
        sN: 'TEST-PC54',
        cN: 'Test Navy',
        pT: 'Test Product',
        uniqueSizes: ['S', 'M', 'L', 'XL'],
        tierData: {
            '24-47': {
                MinQuantity: 24,
                MaxQuantity: 47,
                S: 8.50,
                M: 8.50,
                L: 8.50,
                XL: 8.50
            },
            '48-71': {
                MinQuantity: 48,
                MaxQuantity: 71,
                S: 7.00,
                M: 7.00,
                L: 7.00,
                XL: 7.00
            }
        }
    }
};

window.postMessage(testBundle, '*');
console.log('Test bundle sent. Check for pricing updates...');

console.log('\n=== DIAGNOSTIC COMPLETE ===');
console.log('Look for any errors above and check if prices updated after sending test bundle.');