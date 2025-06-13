// Diagnose why Caspio isn't sending pricing data

console.log('=== DIAGNOSING CASPIO ISSUE ===');

// Check if the iframe exists
const iframe = document.getElementById('screenprint-caspio-iframe');
if (iframe) {
    console.log('✅ Caspio iframe found');
    console.log('   URL:', iframe.src);
} else {
    console.error('❌ No Caspio iframe found!');
}

// Check what Caspio iframe is loaded
const caspioContainer = document.querySelector('[id*="caspio"]');
if (caspioContainer) {
    console.log('✅ Caspio container found:', caspioContainer.id);
}

// Check what pricing table exists
const pricingTable = document.querySelector('#custom-pricing-grid');
if (pricingTable) {
    console.log('✅ Pricing table found');
    const rows = pricingTable.querySelectorAll('tbody tr');
    console.log('   Rows in table:', rows.length);
} else {
    console.error('❌ No pricing table found');
}

// Look for Caspio's pricing data in the DOM
console.log('\n🔍 Searching for Caspio data in DOM...');

// Check for any Caspio tables
const caspioTables = document.querySelectorAll('table[id*="cbTable"]');
console.log('Caspio tables found:', caspioTables.length);
caspioTables.forEach((table, index) => {
    console.log(`  Table ${index + 1}:`, table.id);
    const headers = table.querySelectorAll('th');
    if (headers.length > 0) {
        console.log('    Headers:', Array.from(headers).map(h => h.textContent.trim()).join(', '));
    }
});

// Check global variables
console.log('\n🌐 Checking global variables...');
if (window.dp8State) {
    console.log('✅ dp8State exists:', window.dp8State);
}
if (window.dp8Block1Logic) {
    console.log('✅ dp8Block1Logic exists');
} else {
    console.error('❌ dp8Block1Logic NOT FOUND - This is why pricing isn\'t working!');
}

// Try to find pricing data manually
console.log('\n📊 Looking for pricing data manually...');
const allScripts = document.querySelectorAll('script');
let foundPricingScript = false;
allScripts.forEach(script => {
    if (script.textContent && script.textContent.includes('tierData')) {
        console.log('Found script with tierData!');
        foundPricingScript = true;
        // Extract a snippet
        const match = script.textContent.match(/tierData[^}]+}/);
        if (match) {
            console.log('Snippet:', match[0].substring(0, 100) + '...');
        }
    }
});

if (!foundPricingScript) {
    console.log('No script with tierData found');
}

// Listen for any postMessage
console.log('\n👂 Setting up universal message listener...');
window.addEventListener('message', function(event) {
    console.log('📨 Message received:', {
        origin: event.origin,
        type: event.data?.type,
        hasData: !!event.data,
        data: event.data
    });
}, false);

console.log('\n💡 DIAGNOSIS:');
console.log('The issue is that dp8Block1Logic is not defined.');
console.log('This means the Caspio datapage is not set up correctly for screen print.');
console.log('The pricing data might be in a different format than expected.');
console.log('\nPossible solutions:');
console.log('1. Check if screen print uses a different Caspio app key');
console.log('2. The Caspio datapage might need to be updated to include the dp8Block1Logic');
console.log('3. Screen print might use a different data structure than DTG/embroidery');