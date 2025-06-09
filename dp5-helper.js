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
        console.log("[DP5-HELPER] Initializing DP5 Helper");
        
        window.API_PROXY_BASE_URL = window.API_PROXY_BASE_URL || 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
        
        // Listen for pricing data loaded event - This is the primary trigger.
        window.addEventListener('pricingDataLoaded', function(event) {
            console.log("[DP5-HELPER] 'pricingDataLoaded' event received.", event.detail);
            
            if (event.detail && event.detail.headers && event.detail.prices && event.detail.tierData) {
                const pricingDataFromEvent = {
                    headers: event.detail.headers,
                    prices: event.detail.prices,
                    tiers: event.detail.tierData,
                    uniqueSizes: event.detail.uniqueSizes || [...new Set(event.detail.headers.filter(h => !h.includes('-') && !h.includes('/')))], // Ensure uniqueSizes
                    // Carry over other potential properties from event.detail
                    styleNumber: event.detail.styleNumber,
                    color: event.detail.color,
                    embellishmentType: event.detail.embellishmentType,
                    isFallback: event.detail.isFallback || false
                };

                if (!window.directFixApplied) {
                    console.log("[DP5-HELPER] Pricing data is available from event. Updating custom pricing grid.");
                    updateCustomPricingGrid(pricingDataFromEvent);
                } else {
                    console.log("[DP5-HELPER] Skipping custom pricing grid update (via 'pricingDataLoaded' event) as DIRECT-FIX already applied it.");
                }
            } else {
                console.warn("[DP5-HELPER] 'pricingDataLoaded' event received, but event.detail is missing required pricing data. Grid will not be updated by this event.");
            }
            
            if (event.detail && event.detail.styleNumber && event.detail.color) {
                loadInventoryData(event.detail.styleNumber, event.detail.color);
            } else {
                console.warn("[DP5-HELPER] Cannot load inventory data from 'pricingDataLoaded' event, missing styleNumber or color in event.detail.", event.detail);
            }
        });
        
        console.log("[DP5-HELPER] MutationObserver logic removed; relying on pricing-matrix-capture.js for table detection and 'pricingDataLoaded' event.");
        
        // Fallback check if 'pricingDataLoaded' is somehow missed or data is incomplete.
        setTimeout(function() {
            console.log("[DP5-HELPER] Performing delayed final check for pricing data (7s).");
            const customGridTbody = document.getElementById('custom-pricing-grid')?.querySelector('tbody');
            
            if (!window.directFixApplied && (!customGridTbody || !customGridTbody.hasChildNodes())) {
                if (window.nwcaPricingData && window.nwcaPricingData.headers && window.nwcaPricingData.prices && window.nwcaPricingData.tierData) {
                    console.warn("[DP5-HELPER] Final fallback: Grid empty, but nwcaPricingData found globally. Attempting updateCustomPricingGrid.");
                    updateCustomPricingGrid(window.nwcaPricingData); // Pass the global data
                } else {
                    // This is the absolute last resort: try to extract directly if Caspio table is visible
                    const caspioTable = document.querySelector('.matrix-price-table') || document.querySelector('.cbResultSetTable');
                    if (caspioTable) {
                        console.warn("[DP5-HELPER] Final fallback: Grid empty & global data missing/incomplete. Attempting direct extraction from Caspio table.");
                        const extractedData = extractDataFromCaspioTableForFallback(caspioTable); 
                        if (extractedData) {
                            console.log("[DP5-HELPER] Final fallback: Successfully extracted data directly. Updating grid.");
                            // Set global nwcaPricingData with this last resort data before updating grid
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
                console.log("[DP5-HELPER] Final fallback: Grid seems populated or directFixApplied, no action needed.");
            }
        }, 7000); 
        
        initColorSwatches();
        initialized = true;
    }
    
    function updateCustomPricingGrid(pricingDataInput) {
        console.log("[DP5-HELPER] updateCustomPricingGrid called with data:", pricingDataInput);
        let dataToUse = pricingDataInput;

        // Primary validation: Check if the passed data is usable
        if (!dataToUse || !dataToUse.headers || !dataToUse.prices || !dataToUse.tiers) {
            console.warn("[DP5-HELPER] updateCustomPricingGrid: Input pricingData is incomplete. Attempting to use global nwcaPricingData as fallback.");
            dataToUse = window.nwcaPricingData; // Try global data
        }

        // Second validation: After potentially switching to global data, check again
        if (!dataToUse || !dataToUse.headers || !dataToUse.prices || !dataToUse.tiers) {
            console.warn("[DP5-HELPER] updateCustomPricingGrid: Pricing data (passed or global) still not fully available or incomplete. Grid update deferred. This may resolve via 'pricingDataLoaded' event.");
            // DO NOT recursively call updateCustomPricingGrid here to prevent infinite loops.
            // The final setTimeout in initialize() is the last resort.
            return;
        }
        
        console.log("[DP5-HELPER] Using data for pricing grid. Headers:", dataToUse.headers);
        
        // Extract individual sizes from headers that contain "/" (like S/M, M/L, L/XL)
        if (!dataToUse.uniqueSizes || dataToUse.uniqueSizes.length === 0) {
            const extractedSizes = [];
            const sizeOrder = ['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL', '6XL'];
            
            dataToUse.headers.forEach(header => {
                if (header.includes('/')) {
                    // Split S/M into S and M
                    const sizes = header.split('/');
                    sizes.forEach(size => {
                        if (size && !extractedSizes.includes(size)) {
                            extractedSizes.push(size);
                        }
                    });
                } else if (!header.includes('-') && !extractedSizes.includes(header)) {
                    extractedSizes.push(header);
                }
            });
            
            // Sort sizes in logical order
            extractedSizes.sort((a, b) => {
                const aIndex = sizeOrder.indexOf(a);
                const bIndex = sizeOrder.indexOf(b);
                if (aIndex === -1 && bIndex === -1) return 0;
                if (aIndex === -1) return 1;
                if (bIndex === -1) return -1;
                return aIndex - bIndex;
            });
            
            dataToUse.uniqueSizes = extractedSizes;
            console.log("[DP5-HELPER] Extracted uniqueSizes from headers:", dataToUse.uniqueSizes);
        }

        // Look for both the old custom-pricing-grid ID and the new universal pricing grid table
        let pricingGrid = document.getElementById('custom-pricing-grid');
        if (!pricingGrid) {
            // Try to find universal pricing grid table - it should be 'pricing-grid-container-table'
            pricingGrid = document.getElementById('pricing-grid-container-table');
            if (!pricingGrid) {
                // Also try selector approach
                pricingGrid = document.querySelector('[id$="-table"].pricing-grid');
            }
            
            if (pricingGrid) {
                console.log("[DP5-HELPER] Using universal pricing grid table:", pricingGrid.id);
            } else {
                console.warn("[DP5-HELPER] No pricing grid element found (neither custom-pricing-grid nor universal grid).");
                return;
            }
        }
        
        // Try to find header row - universal grid uses containerId-header-row pattern
        let headerRow = document.getElementById('pricing-header-row');
        if (!headerRow) {
            headerRow = document.getElementById('pricing-grid-container-header-row');
        }
        if (!headerRow && pricingGrid) {
            headerRow = pricingGrid.querySelector('thead tr');
        }
        
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
                uniqueSizes: [...new Set(headers.filter(h => !h.includes('-') && !h.includes('/')))],
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
        if (window.directFixApplied || window.addToCartInitialized) {
            console.log("[DP5-HELPER] Skipping Add to Cart section update as it's already handled.");
            return;
        }
        if (!sizes || sizes.length === 0) {
            console.warn("[DP5-HELPER] No sizes provided to updateAddToCartSection. Add to Cart UI may not populate correctly.");
            // Potentially clear or hide the add to cart section if sizes are truly unavailable.
            // const sizeQuantityGrid = document.getElementById('size-quantity-grid');
            // if (sizeQuantityGrid) sizeQuantityGrid.innerHTML = '<p>Size selection unavailable.</p>';
            return;
        }
        console.log("[DP5-HELPER] Updating Add to Cart section with sizes:", sizes);
        const sizeQuantityGrid = document.getElementById('size-quantity-grid');
        if (!sizeQuantityGrid) {
            console.warn("[DP5-HELPER] Size quantity grid not found for Add to Cart.");
            return;
        }
        sizeQuantityGrid.innerHTML = '';
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
        console.log("[DP5-HELPER] Add to Cart section updated.");
    }
    
    function addInventoryIndicator(priceCell, sizeGroup, inventoryData) {
        if (priceCell.querySelector('.inventory-indicator')) return;
        let sizesToCheck = [];
        if (sizeGroup === 'S-XL') sizesToCheck = ['S', 'M', 'L', 'XL'];
        else if (sizeGroup === '2XL') sizesToCheck = ['2XL'];
        else if (sizeGroup === '3XL') sizesToCheck = ['3XL'];
        else if (sizeGroup.includes('/')) {
            // Handle S/M, M/L, L/XL format
            sizesToCheck = sizeGroup.split('/');
        }
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
    
    function initColorSwatches() {
        console.log("[DP5-HELPER] Initializing color swatches");
        const swatchesContainer = document.getElementById('color-swatches');
        if (!swatchesContainer) {
            console.warn("[DP5-HELPER] Color swatches container not found");
            return;
        }
        const urlParams = new URLSearchParams(window.location.search);
        const styleNumber = urlParams.get('StyleNumber');
        if (!styleNumber) {
            console.warn("[DP5-HELPER] Style number not found in URL for color swatches");
            return;
        }
        swatchesContainer.innerHTML = '<div class="loading-swatches">Loading color options...</div>';
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
                    displayColorSwatchesUI(uniqueColors, urlParams.get('COLOR'));
                } else {
                    tryFallbackColorFetchUI(styleNumber, swatchesContainer, urlParams.get('COLOR'));
                }
            })
            .catch(error => {
                console.error("[DP5-HELPER] Error fetching colors from primary endpoint:", error);
                tryFallbackColorFetchUI(styleNumber, swatchesContainer, urlParams.get('COLOR'));
            });
    }

    function tryFallbackColorFetchUI(styleNumber, container, currentUrlColor) {
        console.log("[DP5-HELPER] Trying fallback color fetch (legacy /api/colors) for style:", styleNumber);
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
        const hardcodedColors = [
            { COLOR_NAME: "Black", CATALOG_COLOR: "Black", HEX_CODE: "#000000", COLOR_SQUARE_IMAGE: null }, 
            { COLOR_NAME: "Navy", CATALOG_COLOR: "Navy", HEX_CODE: "#000080", COLOR_SQUARE_IMAGE: null },
            { COLOR_NAME: "Royal", CATALOG_COLOR: "Royal", HEX_CODE: "#4169E1", COLOR_SQUARE_IMAGE: null }, 
            { COLOR_NAME: "Red", CATALOG_COLOR: "Red", HEX_CODE: "#FF0000", COLOR_SQUARE_IMAGE: null },
            { COLOR_NAME: "Forest Green", CATALOG_COLOR: "ForestGreen", HEX_CODE: "#228B22", COLOR_SQUARE_IMAGE: null }, 
            { COLOR_NAME: "White", CATALOG_COLOR: "White", HEX_CODE: "#FFFFFF", COLOR_SQUARE_IMAGE: null },
            { COLOR_NAME: "Ash", CATALOG_COLOR: "Ash", HEX_CODE: "#B2BEB5", COLOR_SQUARE_IMAGE: null }, 
            { COLOR_NAME: "Charcoal", CATALOG_COLOR: "Charcoal", HEX_CODE: "#36454F", COLOR_SQUARE_IMAGE: null }
        ];
        if (hardcodedColors.length > 0) displayColorSwatchesUI(hardcodedColors, currentUrlColor);
        else if(container) container.innerHTML = '<div class="no-colors-message">No color options available for this style.</div>';
    }
            
    function displayColorSwatchesUI(colors, currentUrlColor) {
        const swatchesContainer = document.getElementById('color-swatches');
        if (!swatchesContainer) {
            console.error("[DP5-HELPER] displayColorSwatchesUI: Swatches container not found!");
            return;
        }
        swatchesContainer.innerHTML = ''; 

        const normalizedCurrentUrlColor = NWCAUtils.normalizeColorName(currentUrlColor || '');

        colors.forEach(color => {
            const wrapper = document.createElement('div');
            wrapper.className = 'swatch-wrapper';
            const swatch = document.createElement('div');
            swatch.className = 'color-swatch';
            if (color.COLOR_SQUARE_IMAGE) {
                swatch.style.backgroundImage = `url('${color.COLOR_SQUARE_IMAGE}')`;
            } else {
                swatch.style.backgroundColor = color.HEX_CODE || NWCAUtils.normalizeColorName(color.COLOR_NAME) || '#cccccc';
            }
            swatch.dataset.colorName = color.COLOR_NAME;
            swatch.dataset.catalogColor = color.CATALOG_COLOR || color.COLOR_NAME; 
            swatch.title = color.COLOR_NAME;
            
            const normalizedSwatchName = NWCAUtils.normalizeColorName(color.COLOR_NAME);
            const normalizedCatalogColor = NWCAUtils.normalizeColorName(color.CATALOG_COLOR || '');

            if (currentUrlColor && (normalizedSwatchName === normalizedCurrentUrlColor || normalizedCatalogColor === normalizedCurrentUrlColor)) {
                swatch.classList.add('active');
            }
            
            const colorNameEl = document.createElement('div');
            colorNameEl.className = 'color-name';
            colorNameEl.textContent = color.COLOR_NAME;
            
            wrapper.addEventListener('click', function() {
                if (window.PricingPageUI && typeof window.PricingPageUI.handleColorSwatchClick === 'function') {
                    window.PricingPageUI.handleColorSwatchClick(color); 
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
        refreshColorSwatches: initColorSwatches // Expose for potential external refresh
    };
})();
