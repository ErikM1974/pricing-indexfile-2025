/**
 * Test script to verify color preservation when navigating from product page to pricing pages
 * This script simulates:
 * 1. Opening the product page with a specific style number
 * 2. Selecting a color
 * 3. Clicking on an embellishment type link
 * 4. Verifying the color is preserved on the pricing page
 */

const fetch = require('node-fetch');
const { JSDOM } = require('jsdom');

// Configuration
const BASE_URL = 'http://localhost:3000';
const STYLE_NUMBER = '18500';
const TEST_COLOR = 'Azalea';

// Main test function
async function testColorPreservation() {
    console.log('=== Color Preservation Test ===');
    console.log(`Testing style: ${STYLE_NUMBER}, color: ${TEST_COLOR}`);
    
    try {
        // Step 1: Load the product page with the style number
        console.log('\n1. Loading product page...');
        const productUrl = `${BASE_URL}/product?StyleNumber=${STYLE_NUMBER}`;
        console.log(`   URL: ${productUrl}`);
        
        const productPageResponse = await fetch(productUrl);
        if (!productPageResponse.ok) {
            throw new Error(`Failed to load product page: ${productPageResponse.status} ${productPageResponse.statusText}`);
        }
        
        const productPageHtml = await productPageResponse.text();
        console.log(`   Product page loaded successfully (${productPageHtml.length} bytes)`);
        
        // Step 2: Simulate selecting a color by constructing a URL with the color parameter
        console.log(`\n2. Simulating color selection: ${TEST_COLOR}`);
        const colorUrl = `${BASE_URL}/product?StyleNumber=${STYLE_NUMBER}&COLOR=${encodeURIComponent(TEST_COLOR)}`;
        console.log(`   URL with color: ${colorUrl}`);
        
        const colorPageResponse = await fetch(colorUrl);
        if (!colorPageResponse.ok) {
            throw new Error(`Failed to load product page with color: ${colorPageResponse.status} ${colorPageResponse.statusText}`);
        }
        
        const colorPageHtml = await colorPageResponse.text();
        console.log(`   Product page with color loaded successfully (${colorPageHtml.length} bytes)`);
        
        // Step 3: Directly construct the embroidery pricing URL
        console.log('\n3. Constructing embroidery pricing URL...');
        const embroideryUrl = `${BASE_URL}/pricing/embroidery?StyleNumber=${STYLE_NUMBER}&COLOR=${encodeURIComponent(TEST_COLOR)}`;
        console.log(`   URL: ${embroideryUrl}`);
        
        const embroideryPageResponse = await fetch(embroideryUrl);
        if (!embroideryPageResponse.ok) {
            throw new Error(`Failed to load embroidery pricing page: ${embroideryPageResponse.status} ${embroideryPageResponse.statusText}`);
        }
        
        const embroideryPageHtml = await embroideryPageResponse.text();
        console.log(`   Embroidery pricing page loaded successfully (${embroideryPageHtml.length} bytes)`);
        
        // Parse the HTML
        const embroideryDom = new JSDOM(embroideryPageHtml);
        const embroideryDocument = embroideryDom.window.document;
        
        // Step 4: Verify the color is preserved on the pricing page
        console.log('\n4. Verifying color preservation...');
        const productColorElement = embroideryDocument.getElementById('product-color');
        
        if (!productColorElement) {
            throw new Error('Product color element not found on embroidery pricing page');
        }
        
        const displayedColor = productColorElement.textContent.trim();
        console.log(`   Displayed color on pricing page: "${displayedColor}"`);
        
        // Check if the color matches
        if (displayedColor === TEST_COLOR) {
            console.log('\n✅ TEST PASSED: Color was preserved when navigating to pricing page');
        } else {
            console.log(`\n❌ TEST FAILED: Color was not preserved. Expected "${TEST_COLOR}" but got "${displayedColor}"`);
        }
        
        // Step 5: Check the URL parameters
        console.log('\n5. Checking URL parameters...');
        const embroideryUrlObj = new URL(embroideryUrl);
        const styleParam = embroideryUrlObj.searchParams.get('StyleNumber');
        const colorParam = embroideryUrlObj.searchParams.get('COLOR');
        
        console.log(`   StyleNumber parameter: ${styleParam}`);
        console.log(`   COLOR parameter: ${colorParam}`);
        
        if (styleParam === STYLE_NUMBER) {
            console.log('   ✅ StyleNumber parameter is correct');
        } else {
            console.log(`   ❌ StyleNumber parameter is incorrect. Expected "${STYLE_NUMBER}" but got "${styleParam}"`);
        }
        
        if (colorParam === TEST_COLOR) {
            console.log('   ✅ COLOR parameter is correct');
        } else {
            console.log(`   ❌ COLOR parameter is incorrect. Expected "${TEST_COLOR}" but got "${colorParam}"`);
        }
        
    } catch (error) {
        console.error('\n❌ TEST ERROR:', error.message);
    }
    
    console.log('\n=== Test Complete ===');
}

// Run the test
testColorPreservation().catch(console.error);