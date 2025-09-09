/**
 * Test script to verify duplicate location issue is fixed
 * Run this in the console on screenprint-quote-builder.html
 */

console.log('%c🔍 Testing Duplicate Location Fix', 'color: #4cb354; font-size: 16px; font-weight: bold;');
console.log('=' .repeat(50));

// Test 1: Click a location multiple times rapidly
console.group('Test 1: Rapid Clicks on Same Location');
const lcCard = document.querySelector('[data-location="LC"]');
if (lcCard) {
    // Clear any existing selections
    screenPrintQuoteBuilder.printSetup.locations = [];
    screenPrintQuoteBuilder.printSetup.colorsByLocation = {};
    screenPrintQuoteBuilder.updateColorSelections();
    
    // Click the same card 5 times rapidly
    for (let i = 0; i < 5; i++) {
        lcCard.click();
    }
    
    // Check if location appears only once
    const lcCount = screenPrintQuoteBuilder.printSetup.locations.filter(l => l === 'LC').length;
    const colorRows = document.querySelectorAll('#color-selections > div').length;
    
    console.log('Locations array:', screenPrintQuoteBuilder.printSetup.locations);
    console.log('LC appears in array:', lcCount, 'times');
    console.log('Color selection rows displayed:', colorRows);
    
    if (lcCount === 1 && colorRows === 1) {
        console.log('✅ PASSED: Location appears only once despite multiple clicks');
    } else {
        console.error('❌ FAILED: Duplicate issue still exists');
    }
}
console.groupEnd();

// Test 2: Click multiple locations
console.group('Test 2: Multiple Different Locations');
// Clear selections
document.querySelectorAll('.location-card.selected').forEach(card => {
    card.click();
});

// Select FF and FB
const ffCard = document.querySelector('[data-location="FF"]');
const fbCard = document.querySelector('[data-location="FB"]');

if (ffCard && fbCard) {
    ffCard.click();
    fbCard.click();
    
    const locations = screenPrintQuoteBuilder.printSetup.locations;
    const colorRows = document.querySelectorAll('#color-selections > div').length;
    
    console.log('Selected locations:', locations);
    console.log('Color selection rows:', colorRows);
    
    if (locations.length === 2 && colorRows === 2) {
        console.log('✅ PASSED: Correct number of locations displayed');
    } else {
        console.error('❌ FAILED: Incorrect number of locations');
    }
}
console.groupEnd();

// Test 3: Toggle same location on/off/on
console.group('Test 3: Toggle Location On/Off/On');
// Clear all
document.querySelectorAll('.location-card.selected').forEach(card => {
    card.click();
});

const rcCard = document.querySelector('[data-location="RC"]');
if (rcCard) {
    // Turn on
    rcCard.click();
    const afterOn = screenPrintQuoteBuilder.printSetup.locations.slice();
    
    // Turn off
    rcCard.click();
    const afterOff = screenPrintQuoteBuilder.printSetup.locations.slice();
    
    // Turn on again
    rcCard.click();
    const afterOnAgain = screenPrintQuoteBuilder.printSetup.locations.slice();
    
    console.log('After ON:', afterOn);
    console.log('After OFF:', afterOff);
    console.log('After ON again:', afterOnAgain);
    
    const rcCount = afterOnAgain.filter(l => l === 'RC').length;
    const colorRows = document.querySelectorAll('#color-selections > div').length;
    
    if (rcCount === 1 && colorRows === 1) {
        console.log('✅ PASSED: Toggle works correctly without duplicates');
    } else {
        console.error('❌ FAILED: Toggle creates duplicates');
    }
}
console.groupEnd();

// Test 4: Check deduplication safety
console.group('Test 4: Deduplication Safety Check');
// Manually force duplicates to test safety check
screenPrintQuoteBuilder.printSetup.locations = ['LC', 'LC', 'FF', 'FF', 'FF'];
screenPrintQuoteBuilder.updateColorSelections();

const dedupedLocations = screenPrintQuoteBuilder.printSetup.locations;
const uniqueCount = [...new Set(dedupedLocations)].length;
const displayedRows = document.querySelectorAll('#color-selections > div').length;

console.log('Forced duplicate array:', ['LC', 'LC', 'FF', 'FF', 'FF']);
console.log('After updateColorSelections:', dedupedLocations);
console.log('Unique locations:', uniqueCount);
console.log('Displayed rows:', displayedRows);

if (dedupedLocations.length === 2 && displayedRows === 2) {
    console.log('✅ PASSED: Deduplication safety check works');
} else {
    console.error('❌ FAILED: Deduplication not working');
}
console.groupEnd();

// Summary
console.log('');
console.log('%c📊 Test Complete!', 'color: #4cb354; font-size: 14px; font-weight: bold;');
console.log('The duplicate location issue should now be fixed.');
console.log('Each location will appear only once in the color selection area.');

// Clean up
document.querySelectorAll('.location-card.selected').forEach(card => {
    card.click();
});

console.log('');
console.log('Test cleanup complete - all locations deselected.');