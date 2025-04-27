// pricing-matrix-capture.js - Captures pricing matrix data from Caspio tables
console.log("[PRICING-MATRIX:LOAD] Pricing matrix capture system loaded");

(function() {
    "use strict";
    
    // Configuration
    const API_BASE_URL = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api';
    const ENDPOINTS = {
        pricingMatrix: {
            get: (styleNumber, color, embType) => 
                `/pricing-matrix?styleNumber=${encodeURIComponent(styleNumber)}&color=${encodeURIComponent(color)}&embType=${encodeURIComponent(embType)}`,
            create: `/pricing-matrix`,
            update: (id) => `/pricing-matrix/${id}`
        }
    };
    
    // State
    let initialized = false;
    let pricingData = null;
    
    // Initialize the pricing matrix capture system
    function initialize() {
        if (initialized) return;
        console.log("[PRICING-MATRIX:INIT] Initializing pricing matrix capture system");
        
        // Set up interval to check for pricing data
        setInterval(checkForPricingData, 2000);
        
        initialized = true;
    }
    
    // Check for pricing data in the DOM
    function checkForPricingData() {
        // Check if we have a pricing table
        const pricingTable = document.querySelector('.matrix-price-table') || 
                            document.querySelector('.cbResultSetTable');
        
        if (pricingTable) {
            // Get product info from URL
            const urlParams = new URLSearchParams(window.location.search);
            const styleNumber = urlParams.get('StyleNumber');
            const colorCode = urlParams.get('COLOR');
            const embType = detectEmbellishmentType();
            
            if (styleNumber && colorCode && embType) {
                console.log("[PRICING-MATRIX:CHECK] Pricing data found during interval check");
                capturePricingMatrix(styleNumber, colorCode, embType);
            }
        }
    }
    
    // Detect embellishment type based on URL or page content
    function detectEmbellishmentType() {
        // Try to detect from URL or page title
        const url = window.location.href.toLowerCase();
        const title = document.title.toLowerCase();
        
        if (url.includes('cap-embroidery') || title.includes('cap embroidery')) {
            return 'cap-embroidery';
        }
        if (url.includes('embroidery') || title.includes('embroidery')) {
            return 'embroidery';
        }
        if (url.includes('dtg') || title.includes('dtg')) {
            return 'dtg';
        }
        if (url.includes('screen-print') || url.includes('screenprint') || title.includes('screen print')) {
            return 'screen-print';
        }
        if (url.includes('dtf') || title.includes('dtf')) {
            return 'dtf';
        }
        
        // Default if we can't detect
        return 'embroidery';
    }
    
    // Capture pricing matrix data from the DOM
    function capturePricingMatrix(styleNumber, colorCode, embType) {
        console.log("[PRICING-MATRIX:CAPTURE] Starting enhanced capture for " + styleNumber + ", " + colorCode + ", " + embType);
        
        try {
            // Get the pricing table
            const pricingTable = document.querySelector('.matrix-price-table') ||
                                document.querySelector('.cbResultSetTable');
            
            if (!pricingTable) {
                console.error("[PRICING-MATRIX:CAPTURE-ERROR] No pricing table found");
                return;
            }
            
            // Extract headers (sizes)
            const headers = [];
            const headerRow = pricingTable.querySelector('tr');
            if (headerRow) {
                const headerCells = headerRow.querySelectorAll('th');
                headerCells.forEach((cell, index) => {
                    if (index > 0) { // Skip the first header (Quantity Tier)
                        headers.push(cell.textContent.trim());
                    }
                });
            }
            
            // Extract pricing data
            const pricingRows = [];
            const dataRows = pricingTable.querySelectorAll('tr:not(:first-child)');
            dataRows.forEach(row => {
                const cells = row.querySelectorAll('td');
                if (cells.length > 0) {
                    const tierCell = cells[0];
                    const tier = tierCell.textContent.trim();
                    
                    const prices = {};
                    for (let i = 1; i < cells.length; i++) {
                        if (i - 1 < headers.length) {
                            const size = headers[i - 1];
                            const priceText = cells[i].textContent.trim();
                            const price = parseFloat(priceText.replace(/[^0-9.]/g, ''));
                            if (!isNaN(price)) {
                                prices[size] = price;
                            }
                        }
                    }
                    
                    pricingRows.push({
                        tier: tier,
                        prices: prices
                    });
                }
            });
            
            // Use a more structured approach to store the data
            const pricingData = {
                styleNumber,
                color: colorCode,
                embellishmentType: embType,
                headers,
                rows: pricingRows,
                capturedAt: new Date().toISOString()
            };
            
            console.log("[PRICING-MATRIX:CAPTURE] Pricing data found:", pricingData);
            
            // Store the data and dispatch an event
            window.dp5GroupedHeaders = headers;
            window.dp5GroupedPrices = formatPriceMatrix(headers, pricingRows);
            window.dp5ApiTierData = extractTierData(pricingRows);
            
            // Extract unique sizes for Add to Cart
            const uniqueSizes = [...new Set(headers.filter(header =>
                !header.includes('-') && !header.includes('/')))];
            window.dp5UniqueSizes = uniqueSizes;
            
            // Dispatch event for other components to react
            const event = new CustomEvent('pricingDataLoaded', {
                detail: pricingData
            });
            window.dispatchEvent(event);
            
            // Store the pricing data in the API
            storePricingData(pricingData);
            
            return pricingData;
        } catch (error) {
            console.error("[PRICING-MATRIX:CAPTURE-ERROR] Error capturing pricing matrix:", error);
            return null;
        }
    }
    
    // Helper function to extract tier data
    function extractTierData(pricingRows) {
        const tiers = {};
        
        pricingRows.forEach(row => {
            const tierText = row.tier;
            let minQuantity = 0;
            let maxQuantity = null;
            let ltmFee = 0;
            
            // Parse tier text (e.g., "1-23", "24-47", "48-71", "72+")
            if (tierText.includes('-')) {
                const [min, max] = tierText.split('-').map(t => parseInt(t.trim()));
                minQuantity = min;
                maxQuantity = max;
                
                // Add LTM fee for lower tiers
                if (minQuantity === 1 && maxQuantity <= 11) {
                    ltmFee = 50.00;
                } else if (minQuantity <= 12 && maxQuantity <= 23) {
                    ltmFee = 25.00;
                }
            } else if (tierText.includes('+')) {
                minQuantity = parseInt(tierText.replace('+', '').trim());
            } else {
                // Try to parse as a single number
                minQuantity = parseInt(tierText.trim());
            }
            
            tiers[tierText] = {
                MinQuantity: minQuantity,
                MaxQuantity: maxQuantity,
                LTM_Fee: ltmFee > 0 ? ltmFee : undefined
            };
        });
        
        return tiers;
    }
    
    // Helper function to format price matrix for API
    function formatPriceMatrix(headers, rows) {
        const result = {};
        
        // Create an object with size groups as keys
        headers.forEach(header => {
            result[header] = {};
        });
        
        // Add prices for each tier
        rows.forEach(row => {
            const tier = row.tier;
            
            // For each size group, add the price for this tier
            Object.keys(row.prices).forEach(size => {
                if (result[size]) {
                    result[size][tier] = row.prices[size];
                }
            });
        });
        
        return result;
    }
    
    // Store pricing data in the API
    async function storePricingData(data) {
        try {
            console.log("[PRICING-MATRIX:CAPTURE] Sending data to API:", data);
            
            // Format the data for the API
            const apiData = {
                StyleNumber: data.styleNumber,
                Color: data.color,
                EmbellishmentType: data.embellishmentType,
                CaptureDate: new Date().toISOString(),
                SessionID: localStorage.getItem('nwca_cart_session_id') || 'sess_' + Math.random().toString(36).substring(2, 10),
                SizeGroups: JSON.stringify(data.headers),
                PriceMatrix: JSON.stringify(formatPriceMatrix(data.headers, data.rows))
            };
            
            console.log("[PRICING-MATRIX:CAPTURE] Formatted API data:", apiData);
            
            // Use the specific endpoint that we know works
            try {
                // Update existing pricing data at ID 5
                const updateResponse = await fetch(`${API_BASE_URL}/pricing-matrix/5`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(apiData)
                });
                
                if (updateResponse.ok) {
                    console.log("[PRICING-MATRIX:CAPTURE-SUCCESS] Pricing matrix updated successfully", await updateResponse.json());
                } else {
                    console.error("[PRICING-MATRIX:CAPTURE-ERROR] Failed to update pricing matrix:", await updateResponse.text());
                    
                    // Try to create new pricing data as fallback
                    const createResponse = await fetch(`${API_BASE_URL}/pricing-matrix`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(apiData)
                    });
                    
                    if (createResponse.ok) {
                        console.log("[PRICING-MATRIX:CAPTURE-SUCCESS] Pricing matrix captured and stored successfully", await createResponse.json());
                    } else {
                        console.error("[PRICING-MATRIX:CAPTURE-ERROR] Failed to store pricing matrix:", await createResponse.text());
                    }
                }
            } catch (error) {
                console.error("[PRICING-MATRIX:CAPTURE-ERROR] Error updating pricing matrix:", error);
            }
            
            // Store the pricing data in localStorage as a backup
            localStorage.setItem('nwca_pricing_matrix_' + data.styleNumber + '_' + data.color + '_' + data.embellishmentType,
                JSON.stringify({
                    styleNumber: data.styleNumber,
                    color: data.color,
                    embellishmentType: data.embellishmentType,
                    headers: data.headers,
                    rows: data.rows,
                    capturedAt: new Date().toISOString()
                })
            );
            console.log("[PRICING-MATRIX:CAPTURE] Pricing matrix stored in localStorage as backup");
        } catch (error) {
            console.error("[PRICING-MATRIX:CAPTURE-ERROR] Error storing pricing matrix:", error);
        }
    }
    
    // Get pricing data from the API
    async function getPricingData(styleNumber, color, embType) {
        try {
            // First try to get from the specific endpoint we know works
            const response = await fetch(`${API_BASE_URL}/pricing-matrix/5`);
            
            if (response.ok) {
                const data = await response.json();
                
                // Check if this data matches our style/color/embType
                if (data &&
                    data.StyleNumber === styleNumber &&
                    data.Color === color &&
                    data.EmbellishmentType === embType) {
                    
                    // Convert the API data format to our internal format
                    const priceMatrix = JSON.parse(data.PriceMatrix);
                    const sizeGroups = JSON.parse(data.SizeGroups);
                    
                    // Convert to our internal format
                    const rows = [];
                    
                    // Get all tier keys from the first size group
                    const firstSizeGroup = Object.keys(priceMatrix)[0];
                    const tiers = Object.keys(priceMatrix[firstSizeGroup]);
                    
                    // For each tier, create a row
                    tiers.forEach(tier => {
                        const prices = {};
                        
                        // For each size group, get the price for this tier
                        sizeGroups.forEach(sizeGroup => {
                            prices[sizeGroup] = priceMatrix[sizeGroup][tier];
                        });
                        
                        rows.push({
                            tier: tier,
                            prices: prices
                        });
                    });
                    
                    return {
                        styleNumber: data.StyleNumber,
                        color: data.Color,
                        embellishmentType: data.EmbellishmentType,
                        headers: sizeGroups,
                        rows: rows,
                        capturedAt: data.CaptureDate
                    };
                }
            }
            
            // If not found or doesn't match, try to get from localStorage
            const localData = localStorage.getItem('nwca_pricing_matrix_' + styleNumber + '_' + color + '_' + embType);
            if (localData) {
                return JSON.parse(localData);
            }
            
            return null;
        } catch (error) {
            console.error("[PRICING-MATRIX:GET-ERROR] Error getting pricing matrix:", error);
            
            // Try to get from localStorage as fallback
            try {
                const localData = localStorage.getItem('nwca_pricing_matrix_' + styleNumber + '_' + color + '_' + embType);
                if (localData) {
                    return JSON.parse(localData);
                }
            } catch (e) {
                console.error("[PRICING-MATRIX:GET-ERROR] Error getting pricing matrix from localStorage:", e);
            }
            
            return null;
        }
    }
    
    // Get price for a specific size and quantity
    function getPrice(styleNumber, color, embType, size, quantity) {
        return new Promise(async (resolve, reject) => {
            try {
                console.log(`[PRICING-MATRIX:PRICE] Getting price for ${styleNumber}, ${color}, ${embType}, ${size}, ${quantity}`);
                
                // Try to get pricing data from the API
                const data = await getPricingData(styleNumber, color, embType);
                
                if (data) {
                    console.log(`[PRICING-MATRIX:PRICE] Found pricing data:`, data);
                    
                    // Find the appropriate quantity tier
                    let tier = null;
                    
                    for (const row of data.rows) {
                        const tierText = row.tier;
                        
                        // Parse tier ranges
                        if (tierText.includes('-')) {
                            const [min, max] = tierText.split('-').map(t => parseInt(t.trim()));
                            
                            if (quantity >= min && quantity <= max) {
                                tier = row;
                                break;
                            }
                        } else if (tierText.includes('+')) {
                            const min = parseInt(tierText.replace('+', '').trim());
                            
                            if (quantity >= min) {
                                tier = row;
                                break;
                            }
                        } else {
                            // Single number or other format
                            const min = parseInt(tierText.trim());
                            
                            if (!isNaN(min) && quantity >= min) {
                                tier = row;
                                break;
                            }
                        }
                    }
                    
                    if (tier) {
                        console.log(`[PRICING-MATRIX:PRICE] Found tier:`, tier);
                        
                        // Find the price for this size
                        let sizeKey = size;
                        
                        // Handle size ranges (e.g., XS-XL)
                        if (!tier.prices[size]) {
                            // Define size order for comparison
                            const sizeOrder = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL', '6XL'];
                            const sizeIdx = sizeOrder.indexOf(size.toUpperCase());
                            
                            if (sizeIdx !== -1) {
                                for (const key in tier.prices) {
                                    if (key.includes('-')) {
                                        const [start, end] = key.split('-').map(s => s.trim().toUpperCase());
                                        const startIdx = sizeOrder.indexOf(start);
                                        const endIdx = sizeOrder.indexOf(end);
                                        
                                        if (startIdx !== -1 && endIdx !== -1 &&
                                            sizeIdx >= startIdx && sizeIdx <= endIdx) {
                                            sizeKey = key;
                                            console.log(`[PRICING-MATRIX:PRICE] Size ${size} matches range ${key}`);
                                            break;
                                        }
                                    }
                                }
                            }
                        }
                        
                        const price = tier.prices[sizeKey];
                        
                        if (price) {
                            console.log(`[PRICING-MATRIX:PRICE] Found price for ${size} (using key ${sizeKey}): $${price}`);
                            resolve(price);
                            return;
                        } else {
                            console.log(`[PRICING-MATRIX:PRICE] No price found for ${size} (tried key ${sizeKey})`);
                        }
                    } else {
                        console.log(`[PRICING-MATRIX:PRICE] No tier found for quantity ${quantity}`);
                    }
                } else {
                    console.log(`[PRICING-MATRIX:PRICE] No pricing data found for ${styleNumber}, ${color}, ${embType}`);
                }
                
                // Fallback to default pricing
                const defaultPrice = getDefaultPrice(size, quantity, embType);
                console.log(`[PRICING-MATRIX:PRICE] Using default price: $${defaultPrice}`);
                resolve(defaultPrice);
            } catch (error) {
                console.error("[PRICING-MATRIX:PRICE-ERROR] Error getting price:", error);
                const defaultPrice = getDefaultPrice(size, quantity, embType);
                console.log(`[PRICING-MATRIX:PRICE] Using default price after error: $${defaultPrice}`);
                resolve(defaultPrice);
            }
        });
    }
    
    // Get default price when pricing data is not available
    function getDefaultPrice(size, quantity, embType) {
        // Base price by size
        let basePrice = 18.00; // Default for S-XL
        const upperSize = size.toUpperCase();
        
        if (upperSize === '2XL' || upperSize === 'XXL') {
            basePrice = 22.00;
        } else if (upperSize === '3XL') {
            basePrice = 23.00;
        } else if (upperSize === '4XL') {
            basePrice = 25.00;
        }
        
        // Apply quantity discount
        if (quantity >= 72) {
            basePrice -= 2.00;
        } else if (quantity >= 48) {
            basePrice -= 1.00;
        }
        
        // Add embellishment cost
        let embCost = 0;
        
        if (embType === 'embroidery' || embType === 'cap-embroidery') {
            embCost = 3.50;
        } else if (embType === 'dtg' || embType === 'dtf') {
            embCost = 4.00;
        } else if (embType === 'screen-print') {
            embCost = 2.50;
        }
        
        return basePrice + embCost;
    }
    
    // Initialize the system
    initialize();
    
    // Expose public API
    window.PricingMatrix = {
        getPrice: getPrice,
        getPricingData: getPricingData,
        capturePricingMatrix: capturePricingMatrix
    };
})();