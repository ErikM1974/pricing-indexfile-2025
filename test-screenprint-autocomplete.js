/**
 * Test script to verify Screen Print Quote Builder autocomplete functionality
 * Run this in the console on screenprint-quote-builder.html
 */

console.log('%c🔍 Testing Screen Print Autocomplete Search', 'color: #4cb354; font-size: 16px; font-weight: bold;');
console.log('=' .repeat(50));

// Test 1: Check if product service is initialized
console.group('Test 1: Service Initialization');
const productService = window.screenPrintQuoteBuilder?.productService;
if (productService) {
    console.log('✅ PASSED: Product service is initialized');
    console.log('Service:', productService);
} else {
    console.error('❌ FAILED: Product service not found');
}
console.groupEnd();

// Test 2: Test search function directly
console.group('Test 2: Direct Search Test');
async function testDirectSearch() {
    if (!productService) {
        console.error('Cannot test - service not available');
        return;
    }
    
    const testQueries = ['PC54', 'PC', 'J7', 'PORT'];
    
    for (const query of testQueries) {
        console.log(`Testing search for: "${query}"`);
        try {
            const results = await productService.searchProducts(query);
            console.log(`  Found ${results.length} results`);
            if (results.length > 0) {
                console.log(`  First 3 results:`, results.slice(0, 3).map(r => ({
                    style: r.style,
                    title: r.title
                })));
            }
        } catch (error) {
            console.error(`  Error searching for "${query}":`, error);
        }
    }
}

testDirectSearch();
console.groupEnd();

// Test 3: Test UI autocomplete
console.group('Test 3: UI Autocomplete Test');
function testUIAutocomplete() {
    console.log('Simulating user typing "PC54" in search field...');
    
    // Navigate to Phase 2 if not already there
    if (window.screenPrintQuoteBuilder.currentPhase !== 2) {
        console.log('Navigating to Phase 2...');
        // Select a location first
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
    
    // Clear and type in search field
    const searchInput = document.getElementById('style-search');
    const suggestionsDiv = document.getElementById('style-suggestions');
    
    if (searchInput) {
        searchInput.value = '';
        searchInput.focus();
        
        // Simulate typing "PC54"
        const testString = 'PC54';
        for (let i = 0; i < testString.length; i++) {
            setTimeout(() => {
                searchInput.value = testString.substring(0, i + 1);
                searchInput.dispatchEvent(new Event('input', { bubbles: true }));
                
                if (i === testString.length - 1) {
                    // Check after last character
                    setTimeout(() => {
                        if (suggestionsDiv && suggestionsDiv.style.display !== 'none') {
                            const suggestions = suggestionsDiv.querySelectorAll('.suggestion-item');
                            console.log(`✅ PASSED: Dropdown showing with ${suggestions.length} suggestions`);
                            
                            // Log first few suggestions
                            const firstThree = Array.from(suggestions).slice(0, 3).map(s => 
                                s.querySelector('.suggestion-style')?.textContent
                            );
                            console.log('First suggestions:', firstThree);
                        } else {
                            console.error('❌ FAILED: Dropdown not visible');
                        }
                    }, 500);
                }
            }, i * 100);
        }
    } else {
        console.error('Search input not found - navigate to Phase 2 first');
    }
}

console.log('To test UI autocomplete, run: testUIAutocomplete()');
window.testUIAutocomplete = testUIAutocomplete;
console.groupEnd();

// Test 4: Compare with DTG
console.group('Test 4: Endpoint Comparison');
async function compareEndpoints() {
    const term = 'PC54';
    console.log(`Comparing search results for "${term}"...`);
    
    try {
        // Test new endpoint (stylesearch)
        const styleResponse = await fetch(`https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/stylesearch?term=${term}`);
        const styleData = await styleResponse.json();
        console.log('✅ StyleSearch endpoint (NEW):', styleData.slice(0, 3));
        
        // Test old endpoint (products/search) 
        const productResponse = await fetch(`https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/products/search?q=${term}&limit=10`);
        const productData = await productResponse.json();
        console.log('❌ Products/search endpoint (OLD):', productData.products?.slice(0, 3) || 'No products');
        
        console.log('\nThe stylesearch endpoint provides simpler, autocomplete-friendly format');
        
    } catch (error) {
        console.error('Error comparing endpoints:', error);
    }
}

compareEndpoints();
console.groupEnd();

// Summary
console.log('');
console.log('%c📊 Autocomplete Test Summary', 'color: #4cb354; font-size: 14px; font-weight: bold;');
console.log('The autocomplete should now:');
console.log('✓ Use the /api/stylesearch endpoint');
console.log('✓ Show dropdown suggestions as you type');
console.log('✓ Sort by relevance (exact match first)');
console.log('✓ Work like the DTG Quote Builder');
console.log('');
console.log('Manual test: Type "PC54" in the style search field and verify dropdown appears.');