/**
 * Test script to debug Screen Print Quote Builder color dropdown issue
 * Run this in the console on screenprint-quote-builder.html
 */

console.log('%c🎨 Testing Color Dropdown Population', 'color: #4cb354; font-size: 16px; font-weight: bold;');
console.log('=' .repeat(50));

// Test 1: Test API endpoints directly
console.group('Test 1: Direct API Endpoint Test');
async function testColorEndpoint() {
    const styleNumber = 'PC54';
    console.log(`Testing colors for style: ${styleNumber}`);
    
    try {
        // Test product-details endpoint
        const detailsResponse = await fetch(`https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/product-details?styleNumber=${styleNumber}`);
        const details = await detailsResponse.json();
        console.log('Product details response:', details);
        
        // Test product-colors endpoint
        const colorsResponse = await fetch(`https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/product-colors?styleNumber=${styleNumber}`);
        const colors = await colorsResponse.json();
        console.log('Product colors response:', colors);
        console.log('Colors data field:', colors.data);
        
        if (colors.data && colors.data.length > 0) {
            console.log(`✅ PASSED: Found ${colors.data.length} colors`);
            console.log('First 5 colors:', colors.data.slice(0, 5));
        } else {
            console.error('❌ FAILED: No colors returned from API');
        }
        
    } catch (error) {
        console.error('API test failed:', error);
    }
}

testColorEndpoint();
console.groupEnd();

// Test 2: Test the product service
console.group('Test 2: Product Service Test');
async function testProductService() {
    const productService = window.screenPrintQuoteBuilder?.productService;
    
    if (!productService) {
        console.error('Product service not found');
        return;
    }
    
    console.log('Testing getProductDetails for PC54...');
    const productData = await productService.getProductDetails('PC54');
    
    console.log('Product data:', productData);
    console.log('Available colors:', productData?.availableColors);
    
    if (productData?.availableColors?.length > 0) {
        console.log(`✅ PASSED: Service returned ${productData.availableColors.length} colors`);
    } else {
        console.error('❌ FAILED: No colors in product data');
    }
}

testProductService();
console.groupEnd();

// Test 3: Simulate selecting a style
console.group('Test 3: UI Selection Test');
function testStyleSelection() {
    console.log('Navigate to Phase 2 first...');
    
    // Navigate to Phase 2 if not already there
    if (window.screenPrintQuoteBuilder.currentPhase !== 2) {
        // Select a location
        const ffCard = document.querySelector('[data-location="FF"]');
        if (ffCard) ffCard.click();
        
        // Set colors
        const colorInputs = document.querySelectorAll('.color-count');
        if (colorInputs.length > 0) {
            colorInputs[0].value = '2';
            colorInputs[0].dispatchEvent(new Event('input'));
        }
        
        // Continue to products
        document.getElementById('continue-to-products')?.click();
    }
    
    // Now test style selection
    console.log('Calling selectProductStyle directly...');
    window.screenPrintQuoteBuilder.selectProductStyle('PC54').then(() => {
        const colorSelect = document.getElementById('color-select');
        const options = colorSelect.querySelectorAll('option');
        
        console.log('Color dropdown state:');
        console.log('  Disabled:', colorSelect.disabled);
        console.log('  Options count:', options.length);
        
        if (options.length > 1) {
            console.log('✅ PASSED: Color dropdown populated with', options.length - 1, 'colors');
            console.log('First 5 colors:', Array.from(options).slice(1, 6).map(o => o.textContent));
        } else {
            console.error('❌ FAILED: Color dropdown not populated');
            console.log('Dropdown HTML:', colorSelect.innerHTML);
        }
    });
}

console.log('To test UI selection, run: testStyleSelection()');
window.testStyleSelection = testStyleSelection;
console.groupEnd();

// Summary
console.log('');
console.log('%c📊 Color Dropdown Debug Summary', 'color: #4cb354; font-size: 14px; font-weight: bold;');
console.log('Check the console output above to identify where the issue is:');
console.log('1. API endpoint returning colors?');
console.log('2. Product service processing colors correctly?');
console.log('3. UI populating dropdown correctly?');
console.log('');
console.log('Look for the red ❌ FAILED messages to identify the problem.');