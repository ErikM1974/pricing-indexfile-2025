const puppeteer = require('puppeteer');

(async () => {
  console.log('🚀 Starting Browser Test for 3-Day Tees...');
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox']
  });
  const page = await browser.newPage();
  
  // Enable console logging
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));

  try {
    // 1. Navigate to page
    console.log('1. Navigating to page...');
    await page.goto('http://localhost:3000/pages/3-day-tees.html', { waitUntil: 'networkidle0' });
    
    // 2. Phase 1: Location Selection
    console.log('2. Selecting Left Chest...');
    await page.click('#toggle-LC');
    await new Promise(r => setTimeout(r, 500)); // Wait for UI update
    
    console.log('   Clicking Continue to Products...');
    await page.click('#continue-to-products');
    
    // 3. Phase 2: Colors & Quantities
    console.log('3. waiting for color selection...');
    await page.waitForSelector('.color-swatch-option', { visible: true });
    
    // Select "Jet Black" (assuming it's the first one or finding it)
    console.log('   Selecting Jet Black...');
    // Evaluate to find the element with correct text
    await page.evaluate(() => {
        const swatches = Array.from(document.querySelectorAll('.color-swatch-option'));
        const black = swatches.find(s => s.textContent.includes('Jet Black'));
        if (black) black.click();
    });
    await new Promise(r => setTimeout(r, 500));

    // Enter Quantity
    console.log('   Entering Quantity (12)...');
    // Wait for the row to appear after async rendering
    const qtySelector = 'input[id="qty-Jet Black-M"]';
    await page.waitForSelector(qtySelector, { visible: true, timeout: 5000 });
    
    await page.type(qtySelector, '12');
    await page.evaluate((sel) => {
        // Force change event
        const input = document.querySelector(sel);
        input.dispatchEvent(new Event('change', { bubbles: true }));
    }, qtySelector);

    // Simulate File Upload
    console.log('   Simulating File Upload...');
    await page.evaluate(() => {
        // Direct state manipulation to bypass drag-drop
        const mockFile = {
            name: 'logo.ai',
            size: 1024 * 500, // 500KB
            type: 'application/pdf',
            position: 'front'
        };
        
        // Update state
        if (typeof state !== 'undefined') {
            state.frontLogo = mockFile;
            state.uploadedFiles.push(mockFile);
            
            // Trigger UI update
            if (typeof renderFileList === 'function') {
                renderFileList('front');
            }
            console.log('   File upload state updated');
        } else {
            console.error('   State object not found!');
        }
    });
    await new Promise(r => setTimeout(r, 500));

    // Click Continue
    console.log('   Clicking Continue to Checkout...');
    await page.click('#continueToCheckout');

    // 4. Phase 3: Contact & Shipping
    console.log('4. Filling Contact Info...');
    await page.waitForSelector('#firstName', { visible: true });
    
    await page.type('#firstName', 'Test');
    await page.type('#lastName', 'User');
    await page.type('#email', 'test@example.com');
    await page.type('#phone', '555-123-4567');
    await page.type('#address1', '123 Test St');
    await page.type('#city', 'Seattle');
    await page.type('#state', 'WA');
    await page.type('#zip', '98101');
    
    // Click Same as Shipping if exists (it might default or need clicking)
    // Actually code checks #sameAsShipping
    
    console.log('   Clicking Continue to Review...');
    await page.click('#continueToReview');

    // 5. Phase 4: Review & Submit
    console.log('5. Waiting for Review...');
    await page.waitForSelector('#submitOrder', { visible: true });
    
    console.log('   Clicking Submit Order...');
    await page.click('#submitOrder');

    // 6. Check for Payment Modal
    console.log('6. Checking for Payment Modal...');
    try {
        await page.waitForSelector('#paymentModal', { visible: true, timeout: 5000 });
        console.log('✅ SUCCESS: Payment Modal appeared!');
        
        // Verify totals
        const total = await page.$eval('#paymentTotal', el => el.textContent);
        console.log('   Order Total:', total);
        
    } catch (e) {
        console.error('❌ FAILURE: Payment Modal did not appear within timeout');
        // Take screenshot? No, just log body text maybe or visible error
        const toast = await page.$eval('.toast-message', el => el.textContent).catch(() => null);
        if (toast) console.log('   Last Toast Message:', toast);
    }

  } catch (error) {
    console.error('❌ TEST FAILED:', error);
  } finally {
    await browser.close();
    console.log('🏁 Browser closed');
  }
})();
