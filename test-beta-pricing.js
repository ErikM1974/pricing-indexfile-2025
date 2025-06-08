const puppeteer = require('puppeteer');

(async () => {
    console.log('Starting beta page pricing test...');
    
    const browser = await puppeteer.launch({ 
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    try {
        const page = await browser.newPage();
        
        // Enable console logging
        page.on('console', msg => {
            if (msg.text().includes('Beta Page') || msg.text().includes('Pricing')) {
                console.log('PAGE LOG:', msg.text());
            }
        });
        
        // Navigate to the beta page
        console.log('Navigating to beta page...');
        await page.goto('http://localhost:3000/cap-embroidery-pricing-integrated.html?StyleNumber=C112&COLOR=Black', {
            waitUntil: 'networkidle0',
            timeout: 30000
        });
        
        // Wait for pricing to load
        await page.waitForTimeout(3000);
        
        // Check the initial pricing display
        const unitPrice = await page.$eval('#unit-price', el => el.textContent);
        const quantity = await page.$eval('#quantity-input', el => el.value);
        console.log(`\nInitial state - Quantity: ${quantity}, Unit Price: ${unitPrice}`);
        
        // Check if pricing table has been populated
        const pricingTableExists = await page.$('#custom-pricing-grid tbody tr');
        if (pricingTableExists) {
            const pricingTiers = await page.$$eval('#custom-pricing-grid tbody tr', rows => {
                return rows.map(row => {
                    const cells = row.querySelectorAll('td');
                    return {
                        tier: cells[0]?.textContent?.trim() || '',
                        price: cells[1]?.textContent?.trim() || ''
                    };
                });
            });
            console.log('\nPricing Table Tiers:');
            pricingTiers.forEach(tier => {
                console.log(`  ${tier.tier}: ${tier.price}`);
            });
        } else {
            console.log('\nPricing table not populated yet');
        }
        
        // Test quantity 24 (should be $24)
        await page.evaluate(() => {
            document.getElementById('quantity-input').value = 24;
            handleQuantityChange();
        });
        await page.waitForTimeout(500);
        const price24 = await page.$eval('#unit-price', el => el.textContent);
        console.log(`\nQuantity 24: ${price24}`);
        
        // Test quantity 31 (should be $24)
        await page.evaluate(() => {
            document.getElementById('quantity-input').value = 31;
            handleQuantityChange();
        });
        await page.waitForTimeout(500);
        const price31 = await page.$eval('#unit-price', el => el.textContent);
        console.log(`Quantity 31: ${price31}`);
        
        // Test quantity 48 (should be $23)
        await page.evaluate(() => {
            document.getElementById('quantity-input').value = 48;
            handleQuantityChange();
        });
        await page.waitForTimeout(500);
        const price48 = await page.$eval('#unit-price', el => el.textContent);
        console.log(`Quantity 48: ${price48}`);
        
        // Test stitch count dropdown
        const stitchOptions = await page.$$eval('#stitch-count option', options => {
            return options.map(opt => ({
                value: opt.value,
                text: opt.textContent
            }));
        });
        console.log('\nStitch Count Options:');
        stitchOptions.forEach(opt => {
            console.log(`  ${opt.value}: ${opt.text}`);
        });
        
        // Test back logo
        await page.click('#back-logo-checkbox');
        await page.waitForTimeout(500);
        const backLogoVisible = await page.$eval('#back-logo-details', el => {
            return window.getComputedStyle(el).display !== 'none';
        });
        console.log(`\nBack logo details visible: ${backLogoVisible}`);
        
        if (backLogoVisible) {
            const backLogoStitches = await page.$eval('#back-logo-stitches', el => el.textContent);
            const backLogoPrice = await page.$eval('#back-logo-price-display', el => el.textContent);
            console.log(`Back logo stitches: ${backLogoStitches}`);
            console.log(`Back logo price: ${backLogoPrice}`);
        }
        
        // Check for JavaScript errors
        const errors = await page.evaluate(() => {
            return window.consoleErrors || [];
        });
        if (errors.length > 0) {
            console.log('\nJavaScript Errors:');
            errors.forEach(err => console.log(`  ${err}`));
        }
        
    } catch (error) {
        console.error('Test failed:', error);
    } finally {
        await browser.close();
    }
})();