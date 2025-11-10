// Test script for 3-Day Tees Multi-SKU Inventory (PC54, PC54_2X, PC54_3X)
// Run this in the browser console on the 3-Day Tees page

async function testMultiSKUInventory() {
    console.log('=== Testing 3-Day Tees Multi-SKU Inventory Integration ===\n');

    const colors = [
        { catalog: 'JetBlack', display: 'Jet Black' },
        { catalog: 'White', display: 'White' },
        { catalog: 'Navy', display: 'Navy' },
        { catalog: 'AthHthr', display: 'Athletic Heather' },
        { catalog: 'DkHthrGrey', display: 'Dark Heather Grey' }
    ];

    console.log('Testing Multi-SKU ManageOrders API for each color:\n');

    for (const color of colors) {
        console.log(`\n========== ${color.display} ==========`);

        try {
            // Query all 3 SKUs in parallel
            const [standardRes, twoXLRes, threeXLRes] = await Promise.all([
                fetch(`https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/manageorders/inventorylevels?PartNumber=PC54&Color=${encodeURIComponent(color.display)}`),
                fetch(`https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/manageorders/inventorylevels?PartNumber=PC54_2X&Color=${encodeURIComponent(color.display)}`),
                fetch(`https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/manageorders/inventorylevels?PartNumber=PC54_3X&Color=${encodeURIComponent(color.display)}`)
            ]);

            // Parse responses
            const standardData = await standardRes.json();
            const twoXLData = await twoXLRes.json();
            const threeXLData = await threeXLRes.json();

            // Extract inventory
            const pc54 = standardData.result?.[0];
            const pc54_2x = twoXLData.result?.[0];
            const pc54_3x = threeXLData.result?.[0];

            // Build complete size inventory
            const sizeInventory = {
                'S': pc54?.Size01 || 0,
                'M': pc54?.Size02 || 0,
                'L': pc54?.Size03 || 0,
                'XL': pc54?.Size04 || 0,
                '2XL': pc54_2x?.Size05 || 0,  // 2XL is in Size05 field
                '3XL': pc54_3x?.Size06 || 0   // 3XL is in Size06 field
            };

            // Calculate totals
            const standardTotal = (pc54?.Size01 || 0) + (pc54?.Size02 || 0) +
                                (pc54?.Size03 || 0) + (pc54?.Size04 || 0);
            const twoXLTotal = pc54_2x?.Size05 || 0;  // 2XL is in Size05
            const threeXLTotal = pc54_3x?.Size06 || 0;  // 3XL is in Size06
            const grandTotal = standardTotal + twoXLTotal + threeXLTotal;

            // Display results
            console.log('\n📦 PC54 (Standard Sizes):');
            if (pc54) {
                console.log(`   S: ${pc54.Size01 || 0}, M: ${pc54.Size02 || 0}, L: ${pc54.Size03 || 0}, XL: ${pc54.Size04 || 0}`);
                console.log(`   Subtotal: ${standardTotal} units`);
            } else {
                console.log('   No data available');
            }

            console.log('\n📦 PC54_2X (2XL Size):');
            if (pc54_2x) {
                console.log(`   2XL: ${pc54_2x.Size05 || 0} units (Size05 field)`);
            } else {
                console.log('   No data available');
            }

            console.log('\n📦 PC54_3X (3XL Size):');
            if (pc54_3x) {
                console.log(`   3XL: ${pc54_3x.Size06 || 0} units (Size06 field)`);
            } else {
                console.log('   No data available');
            }

            console.log('\n✅ Complete Size Breakdown:');
            Object.entries(sizeInventory).forEach(([size, qty]) => {
                const status = qty === 0 ? '❌ Out of Stock' :
                              qty < 10 ? '⚠️ Low Stock' : '✅ Available';
                console.log(`   ${size}: ${qty} units ${status}`);
            });

            console.log(`\n📊 TOTAL for ${color.display}: ${grandTotal} units`);

        } catch (error) {
            console.error(`❌ Error testing ${color.display}:`, error.message);
        }
    }

    console.log('\n\n=== Testing Page UI Elements ===\n');

    // Check if color badges exist
    const colorOptions = document.querySelectorAll('.color-option');
    console.log(`Found ${colorOptions.length} color options on page`);

    // Check size inventory display
    console.log('\n=== Current Size Display ===');
    const sizeBoxes = document.querySelectorAll('.size-box');
    sizeBoxes.forEach(box => {
        const sizeName = box.querySelector('.size-name')?.textContent || 'Unknown';
        const inventory = box.querySelector('.size-inventory')?.textContent || 'No inventory';
        console.log(`  Size ${sizeName}: ${inventory}`);
    });

    console.log('\n=== Test Complete ===');
    console.log('✅ If 2XL and 3XL show inventory > 0, multi-SKU is working');
    console.log('❌ If 2XL and 3XL always show 0, check SKU queries');
}

// Quick test functions
window.testMultiSKU = {
    // Run full test
    runTest: testMultiSKUInventory,

    // Test single color with all 3 SKUs
    testColor: async function(colorName) {
        console.log(`\nTesting all SKUs for ${colorName}:`);

        const [std, xl2, xl3] = await Promise.all([
            fetch(`https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/manageorders/inventorylevels?PartNumber=PC54&Color=${encodeURIComponent(colorName)}`),
            fetch(`https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/manageorders/inventorylevels?PartNumber=PC54_2X&Color=${encodeURIComponent(colorName)}`),
            fetch(`https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/manageorders/inventorylevels?PartNumber=PC54_3X&Color=${encodeURIComponent(colorName)}`)
        ]);

        const stdData = await std.json();
        const xl2Data = await xl2.json();
        const xl3Data = await xl3.json();

        console.log('PC54:', stdData.result?.[0] || 'No data');
        console.log('PC54_2X:', xl2Data.result?.[0] || 'No data');
        console.log('PC54_3X:', xl3Data.result?.[0] || 'No data');

        return { PC54: stdData, PC54_2X: xl2Data, PC54_3X: xl3Data };
    },

    // Check current page inventory
    checkPage: function() {
        console.log('\nCurrent Page Inventory Display:');
        document.querySelectorAll('.size-box').forEach(box => {
            const size = box.querySelector('.size-name')?.textContent;
            const inventory = box.querySelector('.size-inventory')?.textContent;
            const input = box.querySelector('input');
            const disabled = input?.disabled ? '(disabled)' : '(enabled)';
            console.log(`${size}: ${inventory} ${disabled}`);
        });
    }
};

console.log('Multi-SKU Test Script Loaded!');
console.log('Commands:');
console.log('- testMultiSKU.runTest() - Run full multi-SKU test');
console.log('- testMultiSKU.testColor("Jet Black") - Test single color');
console.log('- testMultiSKU.checkPage() - Check current page display');