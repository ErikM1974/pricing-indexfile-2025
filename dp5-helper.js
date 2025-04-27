/**
 * DP5 Helper - Enhanced UI functionality for embroidery pricing pages
 * Handles the interaction between the hidden Caspio matrix and the custom UI
 */

(function() {
    "use strict";
    
    console.log("[DP5-HELPER] Loading DP5 Helper for enhanced UI");
    
    // State variables
    let initialized = false;
    let inventoryData = null;
    
    // Initialize the helper
    function initialize() {
        if (initialized) return;
        console.log("[DP5-HELPER] Initializing DP5 Helper");
        
        // Define API base URL if not already defined
        window.API_PROXY_BASE_URL = window.API_PROXY_BASE_URL || 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
        
        // Listen for pricing data loaded event
        window.addEventListener('pricingDataLoaded', function(event) {
            console.log("[DP5-HELPER] Pricing data loaded event received", event.detail);
            
            // Force extract headers from Caspio table
            extractHeadersFromCaspioTable();
            
            // Update the custom pricing grid only if not already updated by DIRECT-FIX
            if (!window.directFixApplied) {
                console.log("[DP5-HELPER] Updating custom pricing grid after pricing data loaded");
                updateCustomPricingGrid();
            } else {
                console.log("[DP5-HELPER] Skipping custom pricing grid update as DIRECT-FIX already applied it");
            }
            
            // Load inventory data if we have color information
            if (event.detail && event.detail.color) {
                loadInventoryData(event.detail.styleNumber, event.detail.color);
            }
        });
        
        // Set up a MutationObserver to detect when Caspio content is added
        const observer = new MutationObserver(function(mutations) {
            const pricingCalculator = document.getElementById('pricing-calculator');
            if (pricingCalculator && (pricingCalculator.querySelector('.matrix-price-table') ||
                                      pricingCalculator.querySelector('.cbResultSetTable'))) {
                console.log("[DP5-HELPER] Caspio pricing table detected");
                
                // Force extract headers from Caspio table
                extractHeadersFromCaspioTable();
                
                // Update the custom pricing grid only if not already updated by DIRECT-FIX
                if (!window.directFixApplied) {
                    console.log("[DP5-HELPER] Updating custom pricing grid after Caspio table detected");
                    updateCustomPricingGrid();
                } else {
                    console.log("[DP5-HELPER] Skipping custom pricing grid update as DIRECT-FIX already applied it");
                }
                
                observer.disconnect();
            }
        });
        
        // Start observing the pricing calculator
        const pricingCalculator = document.getElementById('pricing-calculator');
        if (pricingCalculator) {
            observer.observe(pricingCalculator, { childList: true, subtree: true });
        }
        
        // Also check after a delay in case the observer misses it
        setTimeout(function() {
            // Force extract headers from Caspio table
            extractHeadersFromCaspioTable();
            
            if (window.dp5GroupedHeaders && window.dp5GroupedPrices && !window.directFixApplied) {
                console.log("[DP5-HELPER] Pricing data found after delay");
                updateCustomPricingGrid();
            }
        }, 3000);
        
        // Set up periodic checks to ensure headers are extracted, but limit grid updates
        const checkIntervals = [1000, 2000, 5000, 8000];
        let gridUpdated = false;
        
        checkIntervals.forEach(interval => {
            setTimeout(() => {
                extractHeadersFromCaspioTable();
                
                // Only update grid if not already updated and DIRECT-FIX hasn't done it
                if (!gridUpdated && !window.directFixApplied && window.dp5GroupedHeaders) {
                    console.log(`[DP5-HELPER] Updating grid at ${interval}ms interval`);
                    updateCustomPricingGrid();
                    gridUpdated = true;
                }
            }, interval);
        });
        
        // Initialize color swatches
        initColorSwatches();
        
        initialized = true;
    }
    
    // Function to extract headers directly from Caspio table
    function extractHeadersFromCaspioTable() {
        console.log("[DP5-HELPER] Attempting to extract headers directly from Caspio table");
        
        // Find the Caspio table
        const caspioTable = document.querySelector('.matrix-price-table') ||
                           document.querySelector('.cbResultSetTable');
        
        if (caspioTable) {
            console.log("[DP5-HELPER] Found Caspio table, extracting headers");
            
            // Extract headers from the table
            const headers = [];
            const headerRow = caspioTable.querySelector('tr');
            if (headerRow) {
                const headerCells = headerRow.querySelectorAll('th');
                headerCells.forEach((cell, index) => {
                    if (index > 0) { // Skip the first header (Quantity Tier)
                        headers.push(cell.textContent.trim());
                    }
                });
                
                console.log("[DP5-HELPER] Extracted headers from Caspio table:", headers);
                
                // Store the headers globally
                window.dp5GroupedHeaders = headers;
                
                // Extract unique sizes for Add to Cart
                const uniqueSizes = [...new Set(headers.filter(header =>
                    !header.includes('-') && !header.includes('/')))];
                window.dp5UniqueSizes = uniqueSizes;
                
                console.log("[DP5-HELPER] Set dp5GroupedHeaders to:", window.dp5GroupedHeaders);
                console.log("[DP5-HELPER] Set dp5UniqueSizes to:", window.dp5UniqueSizes);
                
                return true;
            }
        } else {
            console.log("[DP5-HELPER] Caspio table not found yet");
        }
        
        return false;
    }
    
    // Function to update the custom pricing grid
    function updateCustomPricingGrid() {
        console.log("[DP5-HELPER] Updating custom pricing grid");
        
        // Force extract headers if they're not available
        if (!window.dp5GroupedHeaders || !Array.isArray(window.dp5GroupedHeaders) || window.dp5GroupedHeaders.length === 0) {
            console.log("[DP5-HELPER] Headers not available, attempting to extract them");
            extractHeadersFromCaspioTable();
        }
        
        // Get pricing data from global variables
        if (window.dp5GroupedHeaders && window.dp5GroupedPrices && window.dp5ApiTierData) {
            const pricingData = {
                headers: window.dp5GroupedHeaders,
                prices: window.dp5GroupedPrices,
                tiers: window.dp5ApiTierData
            };
            
            console.log("[DP5-HELPER] Using headers for pricing grid:", pricingData.headers);
            console.log("[DP5-HELPER] Using prices for pricing grid:", pricingData.prices);
            
            // Update the custom pricing grid
            const pricingGrid = document.getElementById('custom-pricing-grid');
            if (!pricingGrid) {
                console.warn("[DP5-HELPER] Custom pricing grid not found");
                return;
            }
            
            // Update the header row
            const headerRow = document.getElementById('pricing-header-row') || pricingGrid.querySelector('thead tr');
            if (headerRow) {
                console.log("[DP5-HELPER] Updating header row with:", pricingData.headers);
                
                // Clear existing headers (keep the first "Quantity" header)
                while (headerRow.children.length > 1) {
                    headerRow.removeChild(headerRow.lastChild);
                }
                
                // Add the size headers
                pricingData.headers.forEach(sizeHeader => {
                    const th = document.createElement('th');
                    th.textContent = sizeHeader;
                    headerRow.appendChild(th);
                });
                
                console.log("[DP5-HELPER] Header row updated successfully");
            } else {
                console.warn("[DP5-HELPER] Header row not found");
            }
            
            // Get the tbody element
            const tbody = pricingGrid.querySelector('tbody');
            if (!tbody) {
                console.warn("[DP5-HELPER] Tbody element not found");
                return;
            }
            
            // Clear existing rows
            tbody.innerHTML = '';
            
            // Create rows for each tier
            const tierKeys = Object.keys(pricingData.tiers);
            
            // Sort tier keys by minimum quantity
            tierKeys.sort((a, b) => {
                const tierA = pricingData.tiers[a];
                const tierB = pricingData.tiers[b];
                return (tierA.MinQuantity || 0) - (tierB.MinQuantity || 0);
            });
            
            console.log("[DP5-HELPER] Creating rows for tiers:", tierKeys);
            
            // Create a row for each tier
            tierKeys.forEach(tierKey => {
                const tier = pricingData.tiers[tierKey];
                const row = document.createElement('tr');
                
                // Create tier label cell
                const tierCell = document.createElement('td');
                let tierLabel = '';
                if (tier.MaxQuantity && tier.MinQuantity) {
                    tierLabel = `${tier.MinQuantity}-${tier.MaxQuantity}`;
                } else if (tier.MinQuantity) {
                    tierLabel = `${tier.MinQuantity}+`;
                }
                tierCell.textContent = tierLabel;
                row.appendChild(tierCell);
                
                // Create price cells for each size group
                pricingData.headers.forEach(sizeGroup => {
                    const priceCell = document.createElement('td');
                    priceCell.className = 'price-cell';
                    
                    // Get price for this tier and size group
                    const price = pricingData.prices[sizeGroup] && pricingData.prices[sizeGroup][tierKey] !== undefined ?
                        pricingData.prices[sizeGroup][tierKey] : null;
                    
                    if (price !== null && price !== undefined) {
                        // Format price
                        const formattedPrice = `$${parseFloat(price).toFixed(2)}`;
                        priceCell.innerHTML = formattedPrice;
                        
                        // Add inventory indicator if available
                        if (inventoryData && inventoryData.sizes) {
                            addInventoryIndicator(priceCell, sizeGroup, inventoryData);
                        }
                    } else {
                        priceCell.textContent = 'N/A';
                    }
                    
                    row.appendChild(priceCell);
                });
                
                tbody.appendChild(row);
            });
            
            // Store unique sizes for the Add to Cart section
            const uniqueSizes = [...new Set(pricingData.headers.filter(header =>
                !header.includes('-') && !header.includes('/')))];
            window.dp5UniqueSizes = uniqueSizes;
            
            console.log("[DP5-HELPER] Custom pricing grid updated with sizes:", pricingData.headers);
            console.log("[DP5-HELPER] Unique sizes for Add to Cart:", uniqueSizes);
            
            // Update the Add to Cart section with the unique sizes
            updateAddToCartSection(uniqueSizes);
        } else {
            console.warn("[DP5-HELPER] Pricing data not available yet");
            console.log("[DP5-HELPER] dp5GroupedHeaders:", window.dp5GroupedHeaders);
            console.log("[DP5-HELPER] dp5GroupedPrices:", window.dp5GroupedPrices);
            console.log("[DP5-HELPER] dp5ApiTierData:", window.dp5ApiTierData);
            
            // Try to extract data from the Caspio table directly
            const caspioTable = document.querySelector('.matrix-price-table') ||
                               document.querySelector('.cbResultSetTable');
            
            if (caspioTable) {
                console.log("[DP5-HELPER] Found Caspio table, attempting to extract and display data directly");
                
                // Extract and display data directly from the Caspio table
                extractAndDisplayDataFromCaspioTable(caspioTable);
            }
        }
    }
    
    // Function to extract and display data directly from the Caspio table
    function extractAndDisplayDataFromCaspioTable(caspioTable) {
        try {
            console.log("[DP5-HELPER] Extracting and displaying data directly from Caspio table");
            
            // Get the custom pricing grid
            const pricingGrid = document.getElementById('custom-pricing-grid');
            if (!pricingGrid) {
                console.warn("[DP5-HELPER] Custom pricing grid not found");
                return;
            }
            
            // Extract headers
            const headers = [];
            const headerRow = caspioTable.querySelector('tr');
            if (headerRow) {
                const headerCells = headerRow.querySelectorAll('th');
                headerCells.forEach((cell, index) => {
                    if (index > 0) { // Skip the first header (Quantity Tier)
                        headers.push(cell.textContent.trim());
                    }
                });
            }
            
            console.log("[DP5-HELPER] Extracted headers from Caspio table:", headers);
            
            // Update the header row in the custom pricing grid
            const customHeaderRow = pricingGrid.querySelector('thead tr');
            if (customHeaderRow) {
                // Clear existing headers (keep the first "Quantity" header)
                while (customHeaderRow.children.length > 1) {
                    customHeaderRow.removeChild(customHeaderRow.lastChild);
                }
                
                // Add the headers
                headers.forEach(header => {
                    const th = document.createElement('th');
                    th.textContent = header;
                    customHeaderRow.appendChild(th);
                });
                
                console.log("[DP5-HELPER] Updated custom header row with headers:", headers);
            }
            
            // Get the tbody element
            const tbody = pricingGrid.querySelector('tbody');
            if (!tbody) {
                console.warn("[DP5-HELPER] Tbody element not found");
                return;
            }
            
            // Clear existing rows
            tbody.innerHTML = '';
            
            // Extract and create rows
            const dataRows = caspioTable.querySelectorAll('tr:not(:first-child)');
            console.log("[DP5-HELPER] Found", dataRows.length, "data rows in Caspio table");
            
            dataRows.forEach((row, rowIndex) => {
                const cells = row.querySelectorAll('td');
                if (cells.length > 0) {
                    const newRow = document.createElement('tr');
                    
                    // First cell is the quantity tier
                    const tierCell = document.createElement('td');
                    tierCell.innerHTML = cells[0].innerHTML;
                    tierCell.className = 'tier-cell';
                    newRow.appendChild(tierCell);
                    
                    console.log("[DP5-HELPER] Processing row for tier:", cells[0].textContent.trim());
                    
                    // Add price cells for each size header
                    for (let i = 1; i < cells.length && i <= headers.length; i++) {
                        const priceCell = document.createElement('td');
                        priceCell.innerHTML = cells[i].innerHTML;
                        priceCell.className = 'price-cell';
                        newRow.appendChild(priceCell);
                        
                        console.log("[DP5-HELPER] Added price cell for", headers[i-1], ":", cells[i].textContent.trim());
                    }
                    
                    tbody.appendChild(newRow);
                }
            });
            
            // Store unique sizes for the Add to Cart section
            const uniqueSizes = [...new Set(headers.filter(header =>
                !header.includes('-') && !header.includes('/')))];
            window.dp5UniqueSizes = uniqueSizes;
            
            console.log("[DP5-HELPER] Custom pricing grid updated directly from Caspio table");
            console.log("[DP5-HELPER] Unique sizes for Add to Cart:", uniqueSizes);
            
            // Update the Add to Cart section with the unique sizes
            updateAddToCartSection(uniqueSizes);
            
            return true;
        } catch (error) {
            console.error("[DP5-HELPER] Error extracting and displaying data from Caspio table:", error);
            return false;
        }
    }
    
    // Function to update the Add to Cart section with the unique sizes
    function updateAddToCartSection(sizes) {
        // Skip if DIRECT-FIX or ADD-TO-CART has already updated this section
        if (window.directFixApplied || window.addToCartInitialized) {
            console.log("[DP5-HELPER] Skipping Add to Cart section update as it's already been handled");
            return;
        }
        
        console.log("[DP5-HELPER] Updating Add to Cart section with sizes:", sizes);
        
        const sizeQuantityGrid = document.getElementById('size-quantity-grid');
        if (!sizeQuantityGrid) {
            console.warn("[DP5-HELPER] Size quantity grid not found");
            return;
        }
        
        // Clear existing content
        sizeQuantityGrid.innerHTML = '';
        
        // Create a row for each size
        sizes.forEach(size => {
            console.log("[DP5-HELPER] Adding size row for:", size);
            
            const row = document.createElement('div');
            row.className = 'size-quantity-row';
            
            const sizeLabel = document.createElement('div');
            sizeLabel.className = 'size-label';
            sizeLabel.textContent = size;
            
            const inputContainer = document.createElement('div');
            inputContainer.className = 'quantity-input-container';
            
            const decreaseBtn = document.createElement('button');
            decreaseBtn.className = 'quantity-btn decrease';
            decreaseBtn.textContent = '-';
            decreaseBtn.onclick = function() {
                const input = this.parentNode.querySelector('input');
                const currentValue = parseInt(input.value) || 0;
                if (currentValue > 0) {
                    input.value = currentValue - 1;
                    input.dispatchEvent(new Event('change'));
                }
            };
            
            const input = document.createElement('input');
            input.type = 'number';
            input.className = 'quantity-input';
            input.dataset.size = size;
            input.min = '0';
            input.value = '0';
            input.onchange = function() {
                if (window.updateCartTotal) {
                    window.updateCartTotal();
                }
            };
            
            const increaseBtn = document.createElement('button');
            increaseBtn.className = 'quantity-btn increase';
            increaseBtn.textContent = '+';
            increaseBtn.onclick = function() {
                const input = this.parentNode.querySelector('input');
                const currentValue = parseInt(input.value) || 0;
                input.value = currentValue + 1;
                input.dispatchEvent(new Event('change'));
            };
            
            inputContainer.appendChild(decreaseBtn);
            inputContainer.appendChild(input);
            inputContainer.appendChild(increaseBtn);
            
            const priceDisplay = document.createElement('div');
            priceDisplay.className = 'size-price';
            priceDisplay.dataset.size = size;
            priceDisplay.textContent = '$0.00';
            
            row.appendChild(sizeLabel);
            row.appendChild(inputContainer);
            row.appendChild(priceDisplay);
            
            sizeQuantityGrid.appendChild(row);
        });
        
        console.log("[DP5-HELPER] Add to Cart section updated");
    }
    
    // Function to add inventory indicator
    function addInventoryIndicator(priceCell, sizeGroup, inventoryData) {
        // Check if the cell already has an indicator
        if (priceCell.querySelector('.inventory-indicator')) {
            return; // Skip if already has an indicator to prevent duplicates
        }
        
        // Map size group to individual sizes
        let sizesToCheck = [];
        if (sizeGroup === 'S-XL') {
            sizesToCheck = ['S', 'M', 'L', 'XL'];
        } else if (sizeGroup === '2XL') {
            sizesToCheck = ['2XL'];
        } else if (sizeGroup === '3XL') {
            sizesToCheck = ['3XL'];
        } else {
            // For individual sizes or other groups
            sizesToCheck = [sizeGroup];
        }
        
        // Check inventory for these sizes
        let lowestInventory = Infinity;
        sizesToCheck.forEach(size => {
            const sizeIndex = inventoryData.sizes.indexOf(size);
            if (sizeIndex !== -1) {
                // Get total inventory for this size
                const sizeTotal = inventoryData.sizeTotals[sizeIndex];
                if (sizeTotal < lowestInventory) {
                    lowestInventory = sizeTotal;
                }
            }
        });
        
        // Create inventory indicator
        const indicator = document.createElement('span');
        indicator.className = 'inventory-indicator';
        
        if (lowestInventory === 0 || lowestInventory === Infinity) {
            indicator.classList.add('inventory-none');
            indicator.title = 'Out of stock';
        } else if (lowestInventory < 10) {
            indicator.classList.add('inventory-low');
            indicator.title = `Low stock: ${lowestInventory} available`;
        } else {
            indicator.classList.add('inventory-good');
            indicator.title = `In stock: ${lowestInventory} available`;
        }
        
        priceCell.appendChild(indicator);
    }
    
    // Function to load inventory data
    function loadInventoryData(styleNumber, colorCode) {
        if (!styleNumber || !colorCode) {
            console.warn("[DP5-HELPER] Missing style number or color code for inventory data");
            return;
        }
        
        console.log(`[DP5-HELPER] Loading inventory data for ${styleNumber}, ${colorCode}`);
        
        // Fetch inventory data from API
        fetch(`https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/inventory?styleNumber=${encodeURIComponent(styleNumber)}&color=${encodeURIComponent(colorCode)}`)
            .then(response => response.json())
            .then(data => {
                if (Array.isArray(data) && data.length > 0) {
                    console.log("[DP5-HELPER] Inventory data received:", data.length, "items");
                    
                    // Process inventory data
                    const sizes = [];
                    const sizeTotals = [];
                    
                    // Extract unique sizes and their totals
                    data.forEach(item => {
                        if (item.size && !sizes.includes(item.size)) {
                            sizes.push(item.size);
                            // Find total for this size
                            const total = data
                                .filter(i => i.size === item.size)
                                .reduce((sum, i) => sum + (parseInt(i.quantity) || 0), 0);
                            sizeTotals.push(total);
                        }
                    });
                    
                    // Store inventory data
                    inventoryData = {
                        styleNumber,
                        color: colorCode,
                        sizes,
                        sizeTotals,
                        timestamp: new Date().toISOString()
                    };
                    
                    // Store in window for other scripts
                    window.inventoryData = inventoryData;
                    
                    // Update pricing grid with inventory indicators
                    updateCustomPricingGrid();
                    
                    console.log("[DP5-HELPER] Inventory data processed:", sizes);
                } else {
                    console.warn("[DP5-HELPER] No inventory data found");
                }
            })
            .catch(error => {
                console.error("[DP5-HELPER] Error fetching inventory data:", error);
            });
    }
    
    // Function to initialize color swatches
    function initColorSwatches() {
        console.log("[DP5-HELPER] Initializing color swatches");
        
        // Get the color swatches container
        const swatchesContainer = document.getElementById('color-swatches');
        if (!swatchesContainer) {
            console.warn("[DP5-HELPER] Color swatches container not found");
            return;
        }
        
        // Get the style number from URL
        const urlParams = new URLSearchParams(window.location.search);
        const styleNumber = urlParams.get('StyleNumber');
        if (!styleNumber) {
            console.warn("[DP5-HELPER] Style number not found in URL");
            return;
        }
        
        // Show loading message
        swatchesContainer.innerHTML = '<div class="loading-swatches">Loading color options...</div>';
        
        // Define fallback colors in case the API fails
        const fallbackColors = [
            { COLOR_NAME: 'Black', CATALOG_COLOR: 'Black', HEX_CODE: '#000000' },
            { COLOR_NAME: 'White', CATALOG_COLOR: 'White', HEX_CODE: '#FFFFFF' },
            { COLOR_NAME: 'Navy', CATALOG_COLOR: 'Navy', HEX_CODE: '#000080' },
            { COLOR_NAME: 'Red', CATALOG_COLOR: 'Red', HEX_CODE: '#FF0000' },
            { COLOR_NAME: 'Royal Blue', CATALOG_COLOR: 'Royal', HEX_CODE: '#4169E1' },
            { COLOR_NAME: 'Carolina Blue', CATALOG_COLOR: 'Carolina Blue', HEX_CODE: '#99BADD' },
            { COLOR_NAME: 'Forest Green', CATALOG_COLOR: 'Forest', HEX_CODE: '#228B22' },
            { COLOR_NAME: 'Purple', CATALOG_COLOR: 'Purple', HEX_CODE: '#800080' }
        ];
        
        // Try to fetch from API first, but use fallback if it fails
        fetch(`${API_PROXY_BASE_URL || 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com'}/api/colors?styleNumber=${encodeURIComponent(styleNumber)}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error('API request failed');
                }
                return response.json();
            })
            .then(colors => {
                // Clear loading message
                swatchesContainer.innerHTML = '';
                
                if (Array.isArray(colors) && colors.length > 0) {
                    console.log("[DP5-HELPER] Found colors from API:", colors.length);
                    displayColorSwatches(colors);
                } else {
                    console.warn("[DP5-HELPER] No colors found from API, using fallback colors");
                    displayColorSwatches(fallbackColors);
                }
            })
            .catch(error => {
                console.error("[DP5-HELPER] Error fetching colors:", error);
                console.log("[DP5-HELPER] Using fallback colors");
                
                // Clear loading message
                swatchesContainer.innerHTML = '';
                
                // Use fallback colors
                displayColorSwatches(fallbackColors);
            });
            
        // Helper function to display color swatches
        function displayColorSwatches(colors) {
            // Get the current color from URL
            const currentColor = urlParams.get('COLOR');
            
            // Add color swatches
            colors.forEach(color => {
                // Create swatch element
                const swatch = document.createElement('div');
                swatch.className = 'color-swatch';
                swatch.style.backgroundColor = color.HEX_CODE || '#cccccc';
                swatch.dataset.colorName = color.COLOR_NAME;
                swatch.dataset.catalogColor = color.CATALOG_COLOR;
                
                // Add active class if this is the current color
                if (currentColor && (color.COLOR_NAME === currentColor || color.CATALOG_COLOR === currentColor)) {
                    swatch.classList.add('active');
                }
                
                // Add color name
                const colorName = document.createElement('span');
                colorName.className = 'color-name';
                colorName.textContent = color.COLOR_NAME;
                swatch.appendChild(colorName);
                
                // Add click event
                swatch.addEventListener('click', function() {
                    // Update URL with new color
                    const newUrl = new URL(window.location.href);
                    newUrl.searchParams.set('COLOR', color.CATALOG_COLOR || color.COLOR_NAME);
                    window.location.href = newUrl.toString();
                });
                
                swatchesContainer.appendChild(swatch);
            });
        }
    }
    
    // Function to handle mobile-specific adjustments
    function handleMobileAdjustments() {
        const isMobile = window.innerWidth <= 768;
        const isSmallMobile = window.innerWidth <= 480;
        
        // Adjust color swatches for mobile
        const colorSwatches = document.querySelectorAll('.color-swatch');
        colorSwatches.forEach(swatch => {
            if (isSmallMobile) {
                swatch.style.width = '45px';
                swatch.style.height = '45px';
            } else if (isMobile) {
                swatch.style.width = '50px';
                swatch.style.height = '50px';
            } else {
                swatch.style.width = '60px';
                swatch.style.height = '60px';
            }
        });
        
        // Adjust pricing grid for mobile
        const pricingGrid = document.getElementById('custom-pricing-grid');
        if (pricingGrid) {
            if (isMobile) {
                pricingGrid.classList.add('mobile-view');
            } else {
                pricingGrid.classList.remove('mobile-view');
            }
        }
    }
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        // DOM already loaded, initialize immediately
        initialize();
    }
    
    // Handle window resize for mobile adjustments
    window.addEventListener('resize', handleMobileAdjustments);
    
    // Initial mobile adjustments
    handleMobileAdjustments();
    
    // Expose public API
    window.DP5Helper = {
        updatePricingGrid: updateCustomPricingGrid,
        loadInventoryData: loadInventoryData,
        refreshColorSwatches: initColorSwatches
    };
})();