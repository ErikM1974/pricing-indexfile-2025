/**
 * DP5 Helper - Enhanced UI functionality for embroidery pricing pages
 * Handles the interaction between the hidden Caspio matrix and the custom UI
 */

(function() {
    "use strict";
    
    console.log("[DP5-HELPER] Loading DP5 Helper for enhanced UI (v5 - Refined Fallbacks)");
    
    // State variables
    let initialized = false;
    let inventoryData = null;
    
    // Initialize the helper
    function initialize() {
        if (initialized) return;
        console.log("[DP5-HELPER] Initializing DP5 Helper (v5.1 - Event-driven swatches)");
        
        window.API_PROXY_BASE_URL = window.API_PROXY_BASE_URL || 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
        
        // Listen for pricing data loaded event - This is the primary trigger for the pricing grid.
        window.addEventListener('pricingDataLoaded', function(event) {
            console.log("********************************************************************************");
            console.log("[DP5-HELPER] RAW 'pricingDataLoaded' EVENT DETECTED. Timestamp:", new Date().toISOString());
            console.log("[DP5-HELPER] Event object:", event);
            console.log("[DP5-HELPER] Event detail stringified:", JSON.stringify(event.detail));
            console.log("********************************************************************************");
            
            if (event.detail && event.detail.headers && event.detail.prices && (event.detail.tierData || event.detail.tiers)) {
                console.log("[DP5-HELPER] Event passed primary validation (headers, prices, tierData/tiers exist). Event source might be:", event.detail.selectedLocationValue ? "dtg-adapter" : "pricing-matrix-capture/other");
                const pricingDataFromEvent = {
                    headers: event.detail.headers,
                    prices: event.detail.prices,
                    tiers: event.detail.tierData || event.detail.tiers, // Normalize here
                    uniqueSizes: event.detail.uniqueSizes || (
                        event.detail.embellishmentType === 'cap-embroidery'
                            ? [...new Set(event.detail.headers)]
                            : [...new Set(event.detail.headers.filter(h => !h.includes('-') && !h.includes('/')))]
                    ),
                    styleNumber: event.detail.styleNumber,
                    color: event.detail.color,
                    embellishmentType: event.detail.embellishmentType,
                    isFallback: event.detail.isFallback || false
                };
        
                // **** ADD DEBUG LOG ****
                console.log("[DP5-HELPER] Constructed pricingDataFromEvent:", JSON.stringify(pricingDataFromEvent));
                // **** END DEBUG LOG ****
        
                // if (!window.directFixApplied) { // Temporarily remove this check to ensure adapter-driven updates are processed
                    console.log("[DP5-HELPER] Pricing data is available from event. Updating custom pricing grid (directFixApplied check bypassed for testing).");
                    updateCustomPricingGrid(pricingDataFromEvent);
                // } else {
                //     console.log("[DP5-HELPER] Skipping custom pricing grid update (via 'pricingDataLoaded' event) as DIRECT-FIX already applied it.");
                // }
            } else {
                console.warn("[DP5-HELPER] 'pricingDataLoaded' event FAILED primary validation (missing headers, prices, or tierData/tiers). Event Detail:", JSON.stringify(event.detail));
            }
                    
            // Inventory data loading is still relevant here if style/color are present
            if (event.detail && event.detail.styleNumber && event.detail.color) {
                loadInventoryData(event.detail.styleNumber, event.detail.color);
            } else {
                console.warn("[DP5-HELPER] Cannot load inventory data from 'pricingDataLoaded' event, missing styleNumber or color in event.detail.", event.detail);
            }
        });

        // Listen for product colors ready event from pricing-pages.js
        window.addEventListener('productColorsReady', function(event) {
            console.log("[DP5-HELPER] 'productColorsReady' event received.", event.detail);
            if (event.detail && event.detail.colors && event.detail.selectedColor) {
                initColorSwatches(event.detail.colors, event.detail.selectedColor);
            } else {
                console.warn("[DP5-HELPER] 'productColorsReady' event received, but missing colors or selectedColor in detail. Swatches might not initialize correctly.");
                // Fallback to old method if data is missing, or show error
                const styleNumber = NWCAUtils.getUrlParameter('StyleNumber');
                 if (styleNumber) {
                    console.warn("[DP5-HELPER] Falling back to legacy swatch init due to incomplete 'productColorsReady' event data.");
                    initColorSwatchesLegacy(styleNumber);
                } else {
                    console.error("[DP5-HELPER] Cannot initialize swatches: 'productColorsReady' event data incomplete and no StyleNumber in URL for fallback.");
                }
            }
        });
         window.addEventListener('productColorsError', function(event) {
            console.error("[DP5-HELPER] 'productColorsError' event received:", event.detail?.error);
            const swatchesContainer = document.getElementById('color-swatches');
            if (swatchesContainer) {
                swatchesContainer.innerHTML = '<div class="error-message">Error loading color options.</div>';
            }
        });

        
        console.log("[DP5-HELPER] MutationObserver logic removed; relying on pricing-matrix-capture.js for table detection and 'pricingDataLoaded' event.");
        
        // Fallback check for pricing grid (not swatches)
        setTimeout(function() {
            console.log("[DP5-HELPER] Performing delayed final check for pricing data (7s).");
            const customGridTbody = document.getElementById('custom-pricing-grid')?.querySelector('tbody');
            
            if (!window.directFixApplied && (!customGridTbody || !customGridTbody.hasChildNodes())) {
                if (window.nwcaPricingData && window.nwcaPricingData.headers && window.nwcaPricingData.prices && window.nwcaPricingData.tierData) {
                    console.warn("[DP5-HELPER] Final fallback: Grid empty, but nwcaPricingData found globally. Attempting updateCustomPricingGrid.");
                    updateCustomPricingGrid(window.nwcaPricingData);
                } else {
                    const caspioTable = document.querySelector('.matrix-price-table') || document.querySelector('.cbResultSetTable');
                    if (caspioTable) {
                        console.warn("[DP5-HELPER] Final fallback: Grid empty & global data missing/incomplete. Attempting direct extraction from Caspio table.");
                        const extractedData = extractDataFromCaspioTableForFallback(caspioTable);
                        if (extractedData) {
                            console.log("[DP5-HELPER] Final fallback: Successfully extracted data directly. Updating grid.");
                            window.nwcaPricingData = extractedData;
                            updateCustomPricingGrid(extractedData);
                        } else {
                            console.error("[DP5-HELPER] Final fallback: Direct extraction failed or returned no data.");
                        }
                    } else {
                        console.error("[DP5-HELPER] Final fallback: Pricing data still not available, grid empty, and Caspio table not found after 7s.");
                    }
                }
            } else {
                console.log("[DP5-HELPER] Final fallback: Grid seems populated or directFixApplied, no action needed for pricing grid.");
            }
        }, 7000);
        
        // initColorSwatches(); // This will now be triggered by the 'productColorsReady' event
        initialized = true;
    }
    
    function updateCustomPricingGrid(pricingDataInput) {
        console.log("[DP5-HELPER] updateCustomPricingGrid called with data:", pricingDataInput);
        let dataToUse = pricingDataInput;

        // **** ADD DEBUG LOG ****
        console.log("[DP5-HELPER] updateCustomPricingGrid - Initial pricingDataInput:", JSON.stringify(pricingDataInput));
        console.log("[DP5-HELPER] updateCustomPricingGrid - Initial window.nwcaPricingData:", JSON.stringify(window.nwcaPricingData));
        // **** END DEBUG LOG ****

        // Primary validation: Check if the passed data is usable
        // Normalize tierData to tiers if present
        if (dataToUse && dataToUse.tierData && !dataToUse.tiers) {
            dataToUse.tiers = dataToUse.tierData;
            // delete dataToUse.tierData; // Optionally remove the old key
        }

        if (!dataToUse || !dataToUse.headers || !dataToUse.prices || !dataToUse.tiers) {
            console.warn("[DP5-HELPER] updateCustomPricingGrid: Input pricingData is incomplete (checked for .headers, .prices, .tiers). Attempting to use global nwcaPricingData as fallback.");
            dataToUse = window.nwcaPricingData; // Try global data
            if (dataToUse && dataToUse.tierData && !dataToUse.tiers) { // Normalize global data too
                dataToUse.tiers = dataToUse.tierData;
                // delete dataToUse.tierData;
            }
        }

        // Second validation: After potentially switching to global data, check again
        if (!dataToUse || !dataToUse.headers || !dataToUse.prices || !dataToUse.tiers) {
            console.warn("[DP5-HELPER] updateCustomPricingGrid: Pricing data (passed or global) still not fully available or incomplete (checked for .headers, .prices, .tiers). Grid update deferred.");
            return;
        }
        
        console.log("[DP5-HELPER] Using data for pricing grid. Headers:", dataToUse.headers, "Tiers:", dataToUse.tiers); // Added Tiers to log
        
        if (!dataToUse.uniqueSizes || dataToUse.uniqueSizes.length === 0) {
            if (dataToUse.headers && Array.isArray(dataToUse.headers)) {
                if (dataToUse.embellishmentType === 'cap-embroidery') {
                    // For cap embroidery, use the headers directly without filtering slashes
                    dataToUse.uniqueSizes = [...new Set(dataToUse.headers)];
                    console.log("[DP5-HELPER] Cap embroidery detected: Using headers directly for uniqueSizes:", dataToUse.uniqueSizes);
                } else {
                    // Original logic for other embellishment types
                    dataToUse.uniqueSizes = [...new Set(dataToUse.headers.filter(h => h && typeof h === 'string' && !h.includes('-') && !h.includes('/')))];
                    console.log("[DP5-HELPER] Derived uniqueSizes for grid update:", dataToUse.uniqueSizes);
                }
            } else {
                console.warn("[DP5-HELPER] Cannot derive uniqueSizes, headers are missing or not an array.");
                dataToUse.uniqueSizes = [];
            }
        }

        const pricingGrid = document.getElementById('custom-pricing-grid');
        if (!pricingGrid) {
            console.warn("[DP5-HELPER] Custom pricing grid element not found.");
            return;
        }
        
        const headerRow = document.getElementById('pricing-header-row') || pricingGrid.querySelector('thead tr');
        if (headerRow) {
            while (headerRow.children.length > 1) {
                headerRow.removeChild(headerRow.lastChild);
            }
            dataToUse.headers.forEach(sizeHeader => {
                const th = document.createElement('th');
                th.textContent = sizeHeader;
                headerRow.appendChild(th);
            });
        } else {
            console.warn("[DP5-HELPER] Header row not found in custom pricing grid.");
        }
        
        const tbody = pricingGrid.querySelector('tbody');
        if (!tbody) {
            console.warn("[DP5-HELPER] Tbody element not found in custom pricing grid.");
            return;
        }
        tbody.innerHTML = '';
        
        const tierKeys = Object.keys(dataToUse.tiers);
        tierKeys.sort((a, b) => {
            const tierA = dataToUse.tiers[a];
            const tierB = dataToUse.tiers[b];
            return (tierA.MinQuantity || 0) - (tierB.MinQuantity || 0);
        });
        
        tierKeys.forEach(tierKey => {
            const tier = dataToUse.tiers[tierKey];
            const row = document.createElement('tr');
            const tierCell = document.createElement('td');
            let tierLabel = '';
            if (tier.MaxQuantity && tier.MinQuantity) {
                tierLabel = `${tier.MinQuantity}-${tier.MaxQuantity}`;
            } else if (tier.MinQuantity) {
                tierLabel = `${tier.MinQuantity}+`;
            }
            tierCell.textContent = tierLabel;
            row.appendChild(tierCell);
            
            dataToUse.headers.forEach(sizeGroup => {
                const priceCell = document.createElement('td');
                priceCell.className = 'price-cell';
                const price = dataToUse.prices[sizeGroup] && dataToUse.prices[sizeGroup][tierKey] !== undefined ?
                    dataToUse.prices[sizeGroup][tierKey] : null;
                
                if (price !== null && price !== undefined) {
                    const priceNum = parseFloat(price);
                    let formattedPrice;
                    if (!isNaN(priceNum)) {
                        formattedPrice = priceNum % 1 === 0 ? `$${priceNum}` : `$${priceNum.toFixed(2)}`;
                    } else {
                         formattedPrice = 'N/A';
                    }
                    priceCell.innerHTML = formattedPrice;
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
        
        window.dp5UniqueSizes = dataToUse.uniqueSizes; 
        console.log("[DP5-HELPER] Custom pricing grid updated. Unique sizes for Add to Cart:", window.dp5UniqueSizes);
        updateAddToCartSection(dataToUse.uniqueSizes);
    }
    
    // This function is a last-resort parser if pricing-matrix-capture.js fails completely.
    function extractDataFromCaspioTableForFallback(caspioTable) {
        try {
            console.warn("[DP5-HELPER] Fallback: Attempting to extract data directly from Caspio table.");
            const headers = [];
            const headerRow = caspioTable.querySelector('tr');
            if (!headerRow) return null;
            headerRow.querySelectorAll('th').forEach((cell, index) => { if (index > 0) headers.push(cell.textContent.trim()); });
            if (headers.length === 0) return null;

            const priceMatrix = {};
            const tierData = {};
            const dataRows = caspioTable.querySelectorAll('tr:not(:first-child)');
            if (dataRows.length === 0) return null;

            dataRows.forEach(row => {
                const cells = row.querySelectorAll('td');
                if (cells.length > 1) {
                    const tierText = cells[0].textContent.trim();
                    if (!tierText) return;
                    // Basic tier parsing for fallback
                    const tierRange = tierText.split('-');
                    const minQty = parseInt(tierRange[0], 10);
                    const maxQty = tierRange[1] ? parseInt(tierRange[1].replace('+', ''), 10) : undefined;
                    tierData[tierText] = { MinQuantity: minQty, MaxQuantity: maxQty };

                    for (let i = 1; i < cells.length && i - 1 < headers.length; i++) {
                        const size = headers[i - 1];
                        const price = parseFloat(cells[i].textContent.trim().replace(/[$,]/g, ''));
                        if (!isNaN(price)) {
                            if (!priceMatrix[size]) priceMatrix[size] = {};
                            priceMatrix[size][tierText] = price;
                        }
                    }
                }
            });

            if (Object.keys(priceMatrix).length === 0 || Object.keys(tierData).length === 0) return null;
            
            return {
                headers,
                prices: priceMatrix,
                tiers: tierData,
                uniqueSizes: (typeof getEmbellishmentTypeFromUrl === 'function' && getEmbellishmentTypeFromUrl() === 'cap-embroidery')
                    ? [...new Set(headers)] // For cap embroidery, use headers directly without filtering slashes
                    : [...new Set(headers.filter(h => !h.includes('-') && !h.includes('/')))],
                styleNumber: window.selectedStyleNumber || 'FALLBACK_STYLE',
                color: window.selectedColorName || 'FALLBACK_COLOR',
                embellishmentType: (typeof getEmbellishmentTypeFromUrl === 'function' ? getEmbellishmentTypeFromUrl() : 'unknown'),
                isFallback: true,
                capturedAt: new Date().toISOString()
            };
        } catch (error) {
            console.error("[DP5-HELPER] Fallback: Error during direct Caspio table extraction:", error);
            return null;
        }
    }
    
    function updateAddToCartSection(sizes) {
        // Only skip if the add to cart UI itself has ALREADY been initialized by this function or add-to-cart.js
        // The directFixApplied flag is more about whether the pricing grid was from direct scrape vs. event.
        if (window.addToCartInitialized) {
            console.log("[DP5-HELPER] Skipping Add to Cart section update as it's already initialized (window.addToCartInitialized is true).");
            return;
        }
        
        const sizeQuantityGrid = document.getElementById('size-quantity-grid'); // Get it once

        // We should also check if the elements it tries to create already exist, to prevent duplication if add-to-cart.js runs first.
        if (sizeQuantityGrid && sizeQuantityGrid.querySelector('.size-quantity-row')) {
            console.log("[DP5-HELPER] Skipping Add to Cart section update as UI elements seem to already exist.");
            window.addToCartInitialized = true; // Mark as initialized if elements are found
            return;
        }

        if (!sizes || sizes.length === 0) {
            console.warn("[DP5-HELPER] No sizes provided to updateAddToCartSection. Add to Cart UI may not populate correctly.");
            if (sizeQuantityGrid) sizeQuantityGrid.innerHTML = '<p>Size selection unavailable.</p>'; // Use the existing variable
            return;
        }
        console.log("[DP5-HELPER] Updating Add to Cart section with sizes:", sizes);
        
        let sizeQuantityGridContainer = document.getElementById('size-quantity-grid-container');
        if (!sizeQuantityGridContainer) {
            console.warn("[DP5-HELPER] #size-quantity-grid-container not found. This is unexpected if add-to-cart.js or ProductQuantityUI is supposed to create it. Bailing from AddToCart UI update by dp5-helper.");
            // If the main container isn't there, dp5-helper cannot reliably place its grid.
            return;
        }
        sizeQuantityGridContainer.style.display = 'block'; // Or 'flex', ensure it's visible
        console.log("[DP5-HELPER] Ensured #size-quantity-grid-container is visible.");

        // Now ensure #size-quantity-grid exists within the container, or create it.
        let currentSizeQuantityGrid = document.getElementById('size-quantity-grid'); // Renamed to avoid conflict with the parameter 'sizeQuantityGrid' from outer scope
        if (!currentSizeQuantityGrid) {
            console.warn("[DP5-HELPER] #size-quantity-grid not found within #size-quantity-grid-container. Creating it now.");
            currentSizeQuantityGrid = document.createElement('div');
            currentSizeQuantityGrid.id = 'size-quantity-grid';
            sizeQuantityGridContainer.appendChild(currentSizeQuantityGrid);
        }
        
        if (!currentSizeQuantityGrid) { // Should not happen if creation above worked
            console.error("[DP5-HELPER] Critical error: #size-quantity-grid still not found after attempting creation. Cannot populate.");
            return;
        }

        currentSizeQuantityGrid.innerHTML = ''; // Clear previous content
        sizes.forEach(size => {
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
                // This function is expected to be globally available from product-quantity-ui.js or add-to-cart.js
                if (typeof window.updateCartSummaryAndTierDisplay === 'function') {
                    window.updateCartSummaryAndTierDisplay();
                } else if (window.updateCartTotal) { // Older fallback
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
        console.log("[DP5-HELPER] Add to Cart section updated by dp5-helper.");
        window.addToCartInitialized = true; // Mark that dp5-helper has done its job for add-to-cart UI
    }
    
    function addInventoryIndicator(priceCell, sizeGroup, inventoryData) {
        if (priceCell.querySelector('.inventory-indicator')) return;
        let sizesToCheck = [];
        if (sizeGroup === 'S-XL') sizesToCheck = ['S', 'M', 'L', 'XL'];
        else if (sizeGroup === '2XL') sizesToCheck = ['2XL'];
        else if (sizeGroup === '3XL') sizesToCheck = ['3XL'];
        else sizesToCheck = [sizeGroup];
        
        let lowestInventory = Infinity;
        sizesToCheck.forEach(size => {
            const sizeIndex = inventoryData.sizes.indexOf(size);
            if (sizeIndex !== -1) {
                const sizeTotal = inventoryData.sizeTotals[sizeIndex];
                if (sizeTotal < lowestInventory) lowestInventory = sizeTotal;
            }
        });
        
        if (lowestInventory === 0 || lowestInventory === Infinity || lowestInventory < 10) {
            const indicator = document.createElement('span');
            indicator.className = 'inventory-indicator';
            if (lowestInventory === 0 || lowestInventory === Infinity) {
                indicator.classList.add('inventory-none');
                indicator.title = 'Out of stock';
            } else if (lowestInventory < 10) {
                indicator.classList.add('inventory-low');
                indicator.title = `Low stock: ${lowestInventory} available`;
            }
            priceCell.appendChild(indicator);
        }
    }
    
    function loadInventoryData(styleNumber, colorCode) {
        if (!styleNumber || !colorCode) {
            console.warn("[DP5-HELPER] Missing style number or color code for inventory data");
            return;
        }
        console.log(`[DP5-HELPER] Loading inventory data for ${styleNumber}, ${colorCode}`);
        fetch(`${window.API_PROXY_BASE_URL}/api/inventory?styleNumber=${encodeURIComponent(styleNumber)}&color=${encodeURIComponent(colorCode)}`)
            .then(response => response.json())
            .then(data => {
                if (Array.isArray(data) && data.length > 0) {
                    const sizes = [];
                    const sizeTotals = [];
                    data.forEach(item => {
                        if (item.size && !sizes.includes(item.size)) {
                            sizes.push(item.size);
                            const total = data.filter(i => i.size === item.size).reduce((sum, i) => sum + (parseInt(i.quantity) || 0), 0);
                            sizeTotals.push(total);
                        }
                    });
                    inventoryData = { styleNumber, color: colorCode, sizes, sizeTotals, timestamp: new Date().toISOString() };
                    window.inventoryData = inventoryData;
                    if (window.nwcaPricingData) { // If pricing data already exists, refresh grid for indicators
                        console.log("[DP5-HELPER] Inventory loaded, refreshing pricing grid for indicators.");
                        updateCustomPricingGrid(window.nwcaPricingData); 
                    }
                    console.log("[DP5-HELPER] Inventory data processed:", sizes);
                } else {
                    console.warn("[DP5-HELPER] No inventory data found for style/color.");
                    window.inventoryData = { styleNumber, color: colorCode, sizes: [], sizeTotals: [], timestamp: new Date().toISOString(), noData: true }; // Mark as no data
                     if (window.nwcaPricingData) { // Refresh grid to remove old indicators if any
                        console.log("[DP5-HELPER] No inventory data, refreshing pricing grid to clear indicators.");
                        updateCustomPricingGrid(window.nwcaPricingData);
                    }
                }
            })
            .catch(error => {
                console.error("[DP5-HELPER] Error fetching inventory data:", error);
                window.inventoryData = { styleNumber, color: colorCode, sizes: [], sizeTotals: [], timestamp: new Date().toISOString(), error: true }; // Mark error
                 if (window.nwcaPricingData) { // Refresh grid to remove old indicators
                    console.log("[DP5-HELPER] Inventory fetch error, refreshing pricing grid.");
                    updateCustomPricingGrid(window.nwcaPricingData);
                }
            });
    }
    
    // New initColorSwatches that accepts data
    function initColorSwatches(colorsData, initiallySelectedColor) {
        console.log("[DP5-HELPER] Initializing color swatches with provided data.");
        const swatchesContainer = document.getElementById('color-swatches');
        if (!swatchesContainer) {
            console.warn("[DP5-HELPER] Color swatches container not found.");
            return;
        }

        if (!colorsData || colorsData.length === 0) {
            console.warn("[DP5-HELPER] No colors data provided to initColorSwatches. Displaying 'no colors' message.");
            swatchesContainer.innerHTML = '<div class="no-colors-message">No color options available for this style.</div>';
            return;
        }
        
        // Use the COLOR_NAME from the initiallySelectedColor object for marking active
        const currentSelectedColorName = initiallySelectedColor ? initiallySelectedColor.COLOR_NAME : null;
        displayColorSwatchesUI(colorsData, currentSelectedColorName);
    }

    // Legacy function for fallback if 'productColorsReady' event fails or provides incomplete data
    function initColorSwatchesLegacy(styleNumber) {
        console.warn(`[DP5-HELPER] Using LEGACY initColorSwatches for Style: ${styleNumber}`);
        const swatchesContainer = document.getElementById('color-swatches');
        if (!swatchesContainer) {
            console.warn("[DP5-HELPER] Color swatches container not found (legacy init).");
            return;
        }
        if (!styleNumber) {
            console.warn("[DP5-HELPER] Style number not found in URL for color swatches (legacy init).");
            swatchesContainer.innerHTML = '<div class="no-colors-message">Style number missing.</div>';
            return;
        }
        swatchesContainer.innerHTML = '<div class="loading-swatches">Loading color options...</div>';
        
        // This part remains similar to the old initColorSwatches, fetching from /api/color-swatches
        fetch(`${window.API_PROXY_BASE_URL}/api/color-swatches?styleNumber=${encodeURIComponent(styleNumber)}`)
            .then(response => {
                if (!response.ok) throw new Error(`API request failed for color swatches: ${response.status}`);
                return response.json();
            })
            .then(colors => {
                swatchesContainer.innerHTML = '';
                if (Array.isArray(colors) && colors.length > 0) {
                    const uniqueColorsMap = new Map();
                    colors.filter(c => c.COLOR_NAME).forEach(color => {
                        if (!uniqueColorsMap.has(color.COLOR_NAME)) uniqueColorsMap.set(color.COLOR_NAME, color);
                    });
                    const uniqueColors = Array.from(uniqueColorsMap.values()).sort((a, b) => a.COLOR_NAME.localeCompare(b.COLOR_NAME));
                    // Get current URL color for active state
                    const urlColorParam = NWCAUtils.getUrlParameter('COLOR');
                    const currentUrlColorForActive = urlColorParam ? decodeURIComponent(urlColorParam.replace(/\+/g, ' ')) : null;
                    displayColorSwatchesUI(uniqueColors, currentUrlColorForActive);
                } else {
                    tryFallbackColorFetchUI(styleNumber, swatchesContainer, NWCAUtils.getUrlParameter('COLOR'));
                }
            })
            .catch(error => {
                console.error("[DP5-HELPER] Error fetching colors from primary endpoint (legacy init):", error);
                tryFallbackColorFetchUI(styleNumber, swatchesContainer, NWCAUtils.getUrlParameter('COLOR'));
            });
    }


    function tryFallbackColorFetchUI(styleNumber, container, currentUrlColor) {
        console.log("[DP5-HELPER] Trying fallback color fetch (legacy /api/colors) for style:", styleNumber);
        // This function remains largely the same as it's already a fallback.
        // It will call displayColorSwatchesUI with the currentUrlColor from its parameters.
        fetch(`${window.API_PROXY_BASE_URL}/api/colors?styleNumber=${encodeURIComponent(styleNumber)}`)
            .then(response => {
                if (!response.ok) throw new Error('Fallback API /colors request failed');
                return response.json();
            })
            .then(colors => {
                if (Array.isArray(colors) && colors.length > 0) {
                    const uniqueColorsMap = new Map();
                    colors.filter(c => c.COLOR_NAME).forEach(color => {
                        if (!uniqueColorsMap.has(color.COLOR_NAME)) uniqueColorsMap.set(color.COLOR_NAME, color);
                    });
                    const uniqueColors = Array.from(uniqueColorsMap.values()).sort((a, b) => a.COLOR_NAME.localeCompare(b.COLOR_NAME));
                    displayColorSwatchesUI(uniqueColors, currentUrlColor);
                } else {
                    useHardcodedColorsUI(container, currentUrlColor);
                }
            })
            .catch(error => {
                console.error("[DP5-HELPER] Error fetching colors from fallback /colors endpoint:", error);
                useHardcodedColorsUI(container, currentUrlColor);
            });
    }

    function useHardcodedColorsUI(container, currentUrlColor) {
        console.warn("[DP5-HELPER] Using hardcoded colors as last resort for UI.");
        // This function also remains largely the same.
        const hardcodedColors = [
            { COLOR_NAME: "Black", CATALOG_COLOR: "Black", HEX_CODE: "#000000", COLOR_SQUARE_IMAGE: null },
            { COLOR_NAME: "Navy", CATALOG_COLOR: "Navy", HEX_CODE: "#000080", COLOR_SQUARE_IMAGE: null },
            // ... (other hardcoded colors)
            { COLOR_NAME: "Charcoal", CATALOG_COLOR: "Charcoal", HEX_CODE: "#36454F", COLOR_SQUARE_IMAGE: null }
        ];
        if (hardcodedColors.length > 0) displayColorSwatchesUI(hardcodedColors, currentUrlColor);
        else if(container) container.innerHTML = '<div class="no-colors-message">No color options available for this style.</div>';
    }
            
    // displayColorSwatchesUI now takes the initially selected color name (or catalog color name)
    // to determine the active swatch.
    function displayColorSwatchesUI(colors, activeColorName) {
        const swatchesContainer = document.getElementById('color-swatches');
        if (!swatchesContainer) {
            console.error("[DP5-HELPER] displayColorSwatchesUI: Swatches container not found!");
            return;
        }
        swatchesContainer.innerHTML = ''; 

        const normalizedActiveColorName = NWCAUtils.normalizeColorName(activeColorName || '');

        colors.forEach(color => {
            const wrapper = document.createElement('div');
            wrapper.className = 'swatch-wrapper';
            const swatch = document.createElement('div');
            swatch.className = 'color-swatch';

            // Use COLOR_SQUARE_IMAGE, then COLOR_SWATCH_IMAGE_URL, then HEX_CODE for display
            const swatchImage = color.COLOR_SQUARE_IMAGE || color.COLOR_SWATCH_IMAGE_URL;
            if (swatchImage) {
                swatch.style.backgroundImage = `url('${swatchImage}')`;
                swatch.style.backgroundColor = ''; // Clear background if image is used
            } else if (color.HEX_CODE) {
                swatch.style.backgroundImage = '';
                swatch.style.backgroundColor = color.HEX_CODE;
            } else { // Fallback
                swatch.style.backgroundImage = '';
                swatch.style.backgroundColor = NWCAUtils.normalizeColorName(color.COLOR_NAME || 'grey');
            }

            swatch.dataset.colorName = color.COLOR_NAME;
            swatch.dataset.catalogColor = color.CATALOG_COLOR || color.COLOR_NAME;
            // Store all relevant image URLs on the swatch dataset for handleColorSwatchClick
            if(color.MAIN_IMAGE_URL) swatch.dataset.mainImageUrl = color.MAIN_IMAGE_URL;
            if(color.FRONT_MODEL) swatch.dataset.frontModelUrl = color.FRONT_MODEL;
            if(color.COLOR_SQUARE_IMAGE) swatch.dataset.colorSquareImage = color.COLOR_SQUARE_IMAGE;
            if(color.COLOR_SWATCH_IMAGE_URL) swatch.dataset.colorSwatchImageUrl = color.COLOR_SWATCH_IMAGE_URL;
            if(color.HEX_CODE) swatch.dataset.hexCode = color.HEX_CODE;


            swatch.title = color.COLOR_NAME;
            
            const normalizedSwatchName = NWCAUtils.normalizeColorName(color.COLOR_NAME);
            const normalizedCatalogColor = NWCAUtils.normalizeColorName(color.CATALOG_COLOR || '');

            // Check active state based on the passed activeColorName
            if (activeColorName && (normalizedSwatchName === normalizedActiveColorName || normalizedCatalogColor === normalizedActiveColorName)) {
                swatch.classList.add('active');
            }
            
            const colorNameEl = document.createElement('div');
            colorNameEl.className = 'color-name';
            colorNameEl.textContent = color.COLOR_NAME;
            
            wrapper.addEventListener('click', function() {
                // Pass the full color object to handleColorSwatchClick
                // pricing-pages.js will now handle updating the main image and other details
                if (window.PricingPageUI && typeof window.PricingPageUI.handleColorSwatchClick === 'function') {
                    // Construct a colorData object similar to what the new API endpoint would provide for a single color
                    const clickedColorData = {
                        COLOR_NAME: color.COLOR_NAME,
                        CATALOG_COLOR: color.CATALOG_COLOR,
                        MAIN_IMAGE_URL: color.MAIN_IMAGE_URL,
                        FRONT_MODEL: color.FRONT_MODEL,
                        COLOR_SQUARE_IMAGE: color.COLOR_SQUARE_IMAGE,
                        COLOR_SWATCH_IMAGE_URL: color.COLOR_SWATCH_IMAGE_URL,
                        HEX_CODE: color.HEX_CODE
                        // Add any other properties from the 'color' object that handleColorSwatchClick might need
                    };
                    window.PricingPageUI.handleColorSwatchClick(clickedColorData);
                } else {
                    console.error("[DP5-HELPER] PricingPageUI.handleColorSwatchClick function not found! Reloading as fallback.");
                    const newUrl = new URL(window.location.href);
                    newUrl.searchParams.set('COLOR', color.CATALOG_COLOR || color.COLOR_NAME);
                    window.location.href = newUrl.toString();
                }
            });
            wrapper.appendChild(swatch);
            wrapper.appendChild(colorNameEl);
            swatchesContainer.appendChild(wrapper);
        });
        // After populating, ensure the "Show More" button logic is applied
        if (typeof setupShowMoreColorsButton === "function") setupShowMoreColorsButton();
    }
    
    function handleMobileAdjustments() {
        const isMobile = window.innerWidth <= 768;
        const isSmallMobile = window.innerWidth <= 480;
        const colorSwatches = document.querySelectorAll('.color-swatch');
        colorSwatches.forEach(swatch => {
            const size = isSmallMobile ? '45px' : (isMobile ? '50px' : '60px');
            swatch.style.width = size;
            swatch.style.height = size;
        });
        const pricingGrid = document.getElementById('custom-pricing-grid');
        if (pricingGrid) {
            pricingGrid.classList.toggle('mobile-view', isMobile);
        }
         // Ensure "Show More Colors" button visibility is updated on resize
        if (typeof setupShowMoreColorsButton === "function") setupShowMoreColorsButton();
    }
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }
    window.addEventListener('resize', handleMobileAdjustments);
    // Initial call after DOM is ready and initialize has run
    if (document.readyState === 'complete') {
        handleMobileAdjustments();
    } else {
        document.addEventListener('DOMContentLoaded', handleMobileAdjustments);
    }
    
    window.DP5Helper = {
        updatePricingGrid: updateCustomPricingGrid,
        loadInventoryData: loadInventoryData,
        // Expose the new initColorSwatches that takes data
        initializeWithColorData: initColorSwatches,
        // Keep legacy for any direct calls if necessary, or for the fallback path
        refreshColorSwatchesLegacy: initColorSwatchesLegacy,
        testListenerReach: function(source, data) {
            console.log(`[DP5-HELPER] testListenerReach CALLED BY: ${source}`, data);
        }
    };
})();