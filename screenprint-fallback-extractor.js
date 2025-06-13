// Screen Print Fallback Pricing Extractor
// Extracts pricing directly from Caspio table when master bundle isn't sent

(function() {
    'use strict';
    
    console.log('[ScreenPrint Fallback] Initializing fallback extractor...');
    
    let extractionAttempts = 0;
    const MAX_ATTEMPTS = 10;
    
    function extractPricingFromCaspioTable() {
        extractionAttempts++;
        
        // Look for Caspio pricing table
        const tables = document.querySelectorAll('table');
        let pricingTable = null;
        
        // Find table with pricing data (look for price patterns like $X.XX)
        tables.forEach(table => {
            const text = table.textContent;
            if (text && text.match(/\$\d+\.\d{2}/) && text.match(/\d+-\d+/)) {
                // This looks like a pricing table
                pricingTable = table;
                console.log('[ScreenPrint Fallback] Found potential pricing table');
            }
        });
        
        if (!pricingTable) {
            console.log(`[ScreenPrint Fallback] No pricing table found (attempt ${extractionAttempts}/${MAX_ATTEMPTS})`);
            if (extractionAttempts < MAX_ATTEMPTS) {
                setTimeout(extractPricingFromCaspioTable, 1000);
            }
            return;
        }
        
        // Extract data from table
        const headers = Array.from(pricingTable.querySelectorAll('th')).map(th => th.textContent.trim());
        const rows = pricingTable.querySelectorAll('tbody tr');
        
        console.log('[ScreenPrint Fallback] Table structure:', {
            headers: headers,
            rowCount: rows.length
        });
        
        // Build tier data
        const tierData = {};
        const uniqueSizes = [];
        
        // Find size columns (exclude first column which is usually quantity)
        headers.forEach((header, index) => {
            if (index > 0 && !header.match(/quantity|qty/i)) {
                uniqueSizes.push(header);
            }
        });
        
        // Extract pricing from rows
        rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length > 1) {
                const qtyText = cells[0].textContent.trim();
                const qtyMatch = qtyText.match(/(\d+)-(\d+)/);
                
                if (qtyMatch) {
                    const tierKey = qtyText;
                    const minQty = parseInt(qtyMatch[1]);
                    const maxQty = qtyMatch[2] === '+' ? null : parseInt(qtyMatch[2]);
                    
                    tierData[tierKey] = {
                        MinQuantity: minQty,
                        MaxQuantity: maxQty
                    };
                    
                    // Extract prices for each size
                    cells.forEach((cell, index) => {
                        if (index > 0 && index - 1 < uniqueSizes.length) {
                            const priceText = cell.textContent.trim();
                            const priceMatch = priceText.match(/\$?(\d+\.?\d*)/);
                            if (priceMatch) {
                                const size = uniqueSizes[index - 1];
                                tierData[tierKey][size] = parseFloat(priceMatch[1]);
                            }
                        }
                    });
                }
            }
        });
        
        if (Object.keys(tierData).length === 0) {
            console.error('[ScreenPrint Fallback] Failed to extract tier data');
            return;
        }
        
        // Get product info from URL
        const urlParams = new URLSearchParams(window.location.search);
        const styleNumber = urlParams.get('StyleNumber') || '2007W';
        const color = urlParams.get('COLOR') || urlParams.get('color') || 'Unknown';
        
        // Build master bundle
        const masterBundle = {
            sN: styleNumber,
            cN: color,
            pT: `${styleNumber} - ${color}`,
            uniqueSizes: uniqueSizes,
            tierData: tierData
        };
        
        console.log('[ScreenPrint Fallback] Extracted master bundle:', masterBundle);
        
        // Send as if it came from Caspio
        window.postMessage({
            type: 'caspioScreenPrintMasterBundleReady',
            data: masterBundle,
            source: 'fallback-extractor'
        }, '*');
        
        console.log('[ScreenPrint Fallback] Sent fallback pricing data');
    }
    
    // Start extraction after a delay
    setTimeout(extractPricingFromCaspioTable, 2000);
    
    // Also listen for manual trigger
    window.extractScreenPrintPricing = extractPricingFromCaspioTable;
})();