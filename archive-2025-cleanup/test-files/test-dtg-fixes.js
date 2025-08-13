// Test script to verify DTG pricing fixes
(function() {
    console.log('=== Testing DTG Pricing Fixes ===');
    
    // Test 1: Check if pricing grid elements can be found
    console.log('\nTest 1: Checking pricing grid element discovery...');
    const gridIds = ['custom-pricing-grid', 'pricing-grid-container-table'];
    gridIds.forEach(id => {
        const element = document.getElementById(id);
        console.log(`- ${id}: ${element ? 'FOUND' : 'NOT FOUND'}`);
    });
    
    const gridClass = document.querySelector('.pricing-grid');
    console.log(`- .pricing-grid class: ${gridClass ? 'FOUND' : 'NOT FOUND'}`);
    
    // Test 2: Check event listener setup
    console.log('\nTest 2: Checking event listeners...');
    let eventCount = 0;
    const testHandler = (e) => {
        eventCount++;
        console.log(`- pricingDataLoaded event #${eventCount} received`);
        if (e.detail._dp5Processed) {
            console.log('  └─ Event marked as processed by dp5-helper');
        }
        if (e.detail._dtgProcessed) {
            console.log('  └─ Event marked as processed by dtg-integration');
        }
    };
    
    window.addEventListener('pricingDataLoaded', testHandler);
    
    // Test 3: Simulate pricing data event
    console.log('\nTest 3: Simulating pricing data event...');
    const testData = {
        headers: ['S-XL', '2XL', '3XL', '4XL+'],
        prices: {
            'S-XL': {'24-47': 22, '48-71': 20.5, '72+': 20},
            '2XL': {'24-47': 24, '48-71': 22.5, '72+': 22}
        },
        tierData: {
            '24-47': {PK_ID: 6, TierID: 6, MinQuantity: 24, MaxQuantity: 47},
            '48-71': {PK_ID: 7, TierID: 7, MinQuantity: 48, MaxQuantity: 71}
        },
        styleNumber: 'TEST123',
        color: 'Test Color',
        embellishmentType: 'dtg'
    };
    
    // Dispatch test event
    window.dispatchEvent(new CustomEvent('pricingDataLoaded', { detail: testData }));
    
    // Wait a bit then check results
    setTimeout(() => {
        console.log('\nTest Results:');
        console.log(`- Total events received: ${eventCount}`);
        console.log(`- Expected: 2 or less (original + normalized)`);
        console.log(`- Status: ${eventCount <= 2 ? 'PASS ✓' : 'FAIL ✗'}`);
        
        // Cleanup
        window.removeEventListener('pricingDataLoaded', testHandler);
        console.log('\n=== Tests Complete ===');
    }, 1000);
})();