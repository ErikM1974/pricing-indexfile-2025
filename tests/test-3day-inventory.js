// Test script for 3-Day Tees ManageOrders inventory integration
// Run this in the browser console on the 3-Day Tees page

async function testManageOrdersInventory() {
    console.log('=== Testing 3-Day Tees ManageOrders Inventory Integration ===\n');

    const colors = [
        { catalog: 'JetBlack', display: 'Jet Black', expected: 104 },
        { catalog: 'White', display: 'White', expected: 140 },
        { catalog: 'Navy', display: 'Navy', expected: 28 },
        { catalog: 'AthHthr', display: 'Athletic Heather', expected: 32 },
        { catalog: 'DkHthrGrey', display: 'Dark Heather Grey', expected: 32 }
    ];

    console.log('Testing ManageOrders API for each color:\n');

    for (const color of colors) {
        try {
            const response = await fetch(
                `https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/manageorders/inventorylevels?PartNumber=PC54&Color=${encodeURIComponent(color.display)}`
            );

            if (!response.ok) {
                console.error(`❌ ${color.catalog}: API error - ${response.status}`);
                continue;
            }

            const data = await response.json();
            const inventory = Array.isArray(data) && data.length > 0 ? data[0] : null;

            if (!inventory) {
                console.warn(`⚠️ ${color.catalog}: No inventory data returned`);
                continue;
            }

            // Calculate total inventory
            const total = (inventory.Size01 || 0) + (inventory.Size02 || 0) +
                         (inventory.Size03 || 0) + (inventory.Size04 || 0) +
                         (inventory.Size05 || 0) + (inventory.Size06 || 0);

            // Size breakdown
            const sizeBreakdown = {
                S: inventory.Size01 || 0,
                M: inventory.Size02 || 0,
                L: inventory.Size03 || 0,
                XL: inventory.Size04 || 0,
                '2XL': inventory.Size05 || 0,
                '3XL': inventory.Size06 || 0
            };

            // Determine stock status based on local warehouse thresholds
            let status;
            if (total > 25) {
                status = '✅ In Stock';
            } else if (total > 10) {
                status = '⚠️ Low Stock';
            } else {
                status = '❌ Very Low Stock';
            }

            console.log(`${color.catalog} (${color.display}):`);
            console.log(`  Total: ${total} units ${status}`);
            console.log(`  Expected: ${color.expected} units ${total === color.expected ? '✅' : '❌ MISMATCH'}`);
            console.log(`  Size breakdown:`, sizeBreakdown);
            console.log('');

        } catch (error) {
            console.error(`❌ ${color.catalog}: Error - ${error.message}`);
        }
    }

    console.log('=== Testing Page UI Elements ===\n');

    // Check if color badges exist and have correct classes
    const colorOptions = document.querySelectorAll('.color-option');
    console.log(`Found ${colorOptions.length} color options on page`);

    colorOptions.forEach(option => {
        const colorName = option.querySelector('.color-name')?.textContent || 'Unknown';
        const badge = option.querySelector('.stock-badge');
        const badgeText = badge?.textContent || 'No badge';
        const badgeClass = badge?.className || 'No class';

        console.log(`  ${colorName}: "${badgeText}" [${badgeClass}]`);
    });

    console.log('\n=== Testing Size Grid ===\n');

    // Check size inventory display
    const sizeBoxes = document.querySelectorAll('.size-box');
    console.log(`Found ${sizeBoxes.length} size boxes`);

    sizeBoxes.forEach(box => {
        const sizeName = box.querySelector('.size-name')?.textContent || 'Unknown';
        const inventory = box.querySelector('.size-inventory')?.textContent || 'No inventory';
        console.log(`  Size ${sizeName}: ${inventory}`);
    });

    console.log('\n=== Test Complete ===');
    console.log('✅ All inventory should now show local warehouse stock (10-140 units)');
    console.log('❌ If you see thousands of units, Sanmar API is still being used');
}

// Run the test
testManageOrdersInventory();

// Also expose individual test functions
window.test3DayInventory = {
    testAll: testManageOrdersInventory,

    testSingleColor: async function(colorName) {
        const response = await fetch(
            `https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/manageorders/inventorylevels?PartNumber=PC54&Color=${encodeURIComponent(colorName)}`
        );
        const data = await response.json();
        console.log(`Inventory for ${colorName}:`, data);
        return data;
    },

    checkPageInventory: function() {
        document.querySelectorAll('.size-box').forEach(box => {
            const size = box.querySelector('.size-name')?.textContent;
            const inventory = box.querySelector('.size-inventory')?.textContent;
            console.log(`${size}: ${inventory}`);
        });
    }
};

console.log('Test script loaded. Functions available:');
console.log('- testManageOrdersInventory() - Run full test');
console.log('- test3DayInventory.testSingleColor("Jet Black") - Test single color');
console.log('- test3DayInventory.checkPageInventory() - Check current page display');