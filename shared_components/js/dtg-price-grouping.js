// DTG Price-Based Grouping - Groups sizes by matching prices
console.log("[DTG-PRICE-GROUPING] Loading price-based grouping module...");

(function() {
    "use strict";

    /**
     * Groups sizes based on matching prices across all tiers
     * @param {Object} pricingData - The pricing data object
     * @returns {Array} Array of size groups with their labels
     */
    function groupSizesByPrice(pricingData) {
        if (!pricingData || !pricingData.prices) {
            console.warn("[DTG-PRICE-GROUPING] Invalid pricing data");
            return [];
        }

        // For DTG, sizes might be in headers or uniqueSizes
        const sizes = pricingData.uniqueSizes || pricingData.headers || [];
        if (sizes.length === 0) {
            console.warn("[DTG-PRICE-GROUPING] No sizes found in pricing data");
            return [];
        }

        const prices = pricingData.prices;
        const groups = [];
        const processed = new Set();

        // Get all tier keys
        const tierKeys = Object.keys(pricingData.tierData || {});
        
        console.log("[DTG-PRICE-GROUPING] Processing sizes:", sizes);
        console.log("[DTG-PRICE-GROUPING] Tier keys:", tierKeys);
        
        sizes.forEach((size, index) => {
            if (processed.has(size)) return;

            // Find all sizes with matching prices across all tiers
            const matchingSizes = [size];
            const sizePrices = prices[size];
            
            if (!sizePrices) {
                processed.add(size);
                groups.push({
                    sizes: [size],
                    label: size,
                    startIndex: index,
                    endIndex: index
                });
                return;
            }

            // Check subsequent sizes for matching prices
            for (let i = index + 1; i < sizes.length; i++) {
                const compareSize = sizes[i];
                const comparePrices = prices[compareSize];
                
                if (!comparePrices) continue;
                
                // Check if all tier prices match
                let allMatch = true;
                for (const tier of tierKeys) {
                    if (sizePrices[tier] !== comparePrices[tier]) {
                        allMatch = false;
                        break;
                    }
                }
                
                if (allMatch) {
                    matchingSizes.push(compareSize);
                    processed.add(compareSize);
                } else {
                    // Stop if we hit a non-matching price (non-consecutive group)
                    break;
                }
            }
            
            processed.add(size);
            
            // Create group label
            let label;
            if (matchingSizes.length === 1) {
                label = size;
            } else {
                label = `${matchingSizes[0]}-${matchingSizes[matchingSizes.length - 1]}`;
            }
            
            groups.push({
                sizes: matchingSizes,
                label: label,
                startIndex: index,
                endIndex: index + matchingSizes.length - 1,
                prices: sizePrices // Store the prices for this group
            });
        });

        console.log("[DTG-PRICE-GROUPING] Created groups:", groups);
        return groups;
    }

    /**
     * Builds the DTG pricing table from scratch if it doesn't exist
     */
    function buildDTGPricingTable(pricingData) {
        console.log("[DTG-PRICE-GROUPING] Building DTG pricing table...");
        
        const pricingGrid = document.getElementById('custom-pricing-grid');
        if (!pricingGrid) {
            console.warn("[DTG-PRICE-GROUPING] Pricing grid element not found");
            return false;
        }

        // Clear existing content
        pricingGrid.innerHTML = '';

        // Create thead if it doesn't exist
        let thead = pricingGrid.querySelector('thead');
        if (!thead) {
            thead = document.createElement('thead');
            pricingGrid.appendChild(thead);
        }

        // Create tbody if it doesn't exist
        let tbody = pricingGrid.querySelector('tbody');
        if (!tbody) {
            tbody = document.createElement('tbody');
            pricingGrid.appendChild(tbody);
        }

        // Create header row
        const headerRow = document.createElement('tr');
        headerRow.id = 'pricing-header-row';
        
        // Add Quantity header
        const qtyHeader = document.createElement('th');
        qtyHeader.textContent = 'Quantity';
        headerRow.appendChild(qtyHeader);

        // Add size headers (will be grouped later)
        const sizes = pricingData.uniqueSizes || pricingData.headers || [];
        sizes.forEach(size => {
            const sizeHeader = document.createElement('th');
            sizeHeader.textContent = size;
            sizeHeader.setAttribute('data-size', size);
            headerRow.appendChild(sizeHeader);
        });

        thead.innerHTML = '';
        thead.appendChild(headerRow);

        // Build body rows
        tbody.innerHTML = '';
        const tierData = pricingData.tierData || {};
        const prices = pricingData.prices || {};

        Object.keys(tierData).forEach(tierKey => {
            const row = document.createElement('tr');
            
            // Tier label cell
            const tierCell = document.createElement('td');
            tierCell.textContent = tierKey;
            row.appendChild(tierCell);

            // Price cells for each size
            sizes.forEach(size => {
                const priceCell = document.createElement('td');
                if (prices[size] && prices[size][tierKey] !== undefined) {
                    const price = prices[size][tierKey];
                    priceCell.textContent = `$${parseFloat(price).toFixed(2)}`;
                } else {
                    priceCell.textContent = 'N/A';
                }
                priceCell.setAttribute('data-size', size);
                priceCell.setAttribute('data-tier', tierKey);
                row.appendChild(priceCell);
            });

            tbody.appendChild(row);
        });

        console.log("[DTG-PRICE-GROUPING] DTG pricing table built successfully");
        return true;
    }

    /**
     * Updates the pricing grid with grouped columns
     */
    function updatePricingGridWithGroups() {
        console.log("[DTG-PRICE-GROUPING] Updating pricing grid with price-based groups...");
        
        const pricingGrid = document.getElementById('custom-pricing-grid');
        
        if (!pricingGrid) {
            console.warn("[DTG-PRICE-GROUPING] Pricing grid element not found");
            return false;
        }
        
        if (!window.nwcaPricingData) {
            console.warn("[DTG-PRICE-GROUPING] Pricing data not available yet");
            return false;
        }

        console.log("[DTG-PRICE-GROUPING] Current pricing data:", window.nwcaPricingData);

        // Build the table if it doesn't have proper structure
        let headerRow = document.getElementById('pricing-header-row');
        if (!headerRow) {
            // Try to find the header row in the existing table
            headerRow = pricingGrid.querySelector('thead tr');
            if (headerRow) {
                console.log("[DTG-PRICE-GROUPING] Found existing header row in thead");
            } else {
                console.log("[DTG-PRICE-GROUPING] Header row not found, building DTG table first...");
                buildDTGPricingTable(window.nwcaPricingData);
                headerRow = document.getElementById('pricing-header-row');
            }
        }

        if (!headerRow) {
            console.warn("[DTG-PRICE-GROUPING] Failed to find or create header row");
            return false;
        }

        const groups = groupSizesByPrice(window.nwcaPricingData);
        if (groups.length === 0) {
            console.warn("[DTG-PRICE-GROUPING] No groups created from pricing data");
            return false;
        }

        console.log("[DTG-PRICE-GROUPING] Groups created:", groups);

        const tbody = pricingGrid.querySelector('tbody');
        if (!tbody) {
            console.warn("[DTG-PRICE-GROUPING] Tbody not found in pricing grid");
            return false;
        }

        // Check if we should actually group (only if we have groups with multiple sizes)
        const hasMultiSizeGroups = groups.some(g => g.sizes.length > 1);
        if (!hasMultiSizeGroups) {
            console.log("[DTG-PRICE-GROUPING] No multi-size groups found, skipping grouping");
            return false;
        }

        console.log("[DTG-PRICE-GROUPING] Updating headers with groups...");
        
        // Clear existing headers (except Quantity)
        while (headerRow.children.length > 1) {
            headerRow.removeChild(headerRow.lastChild);
        }

        // Add grouped headers
        groups.forEach(group => {
            const th = document.createElement('th');
            th.textContent = group.label;
            th.setAttribute('data-size-group', group.label);
            th.setAttribute('data-sizes', group.sizes.join(','));
            headerRow.appendChild(th);
            console.log(`[DTG-PRICE-GROUPING] Added header: ${group.label} for sizes: ${group.sizes.join(',')}`);
        });

        // Update pricing rows
        const rows = tbody.querySelectorAll('tr');
        rows.forEach(row => {
            const tierCell = row.cells[0];
            if (!tierCell) return;
            
            const tierKey = tierCell.textContent.trim();
            
            // Remove all cells except the tier cell
            while (row.cells.length > 1) {
                row.removeChild(row.lastCell);
            }

            // Add grouped price cells
            groups.forEach(group => {
                const cell = row.insertCell();
                const price = group.prices[tierKey];
                
                if (price !== null && price !== undefined) {
                    cell.textContent = `$${parseFloat(price).toFixed(2)}`;
                } else {
                    cell.textContent = 'N/A';
                }
                
                cell.setAttribute('data-size-group', group.label);
                cell.setAttribute('data-tier', tierKey);
            });
        });

        console.log("[DTG-PRICE-GROUPING] Pricing grid updated with grouped columns");
        return true;
    }

    /**
     * Updates the quantity matrix to use grouped sizes
     */
    function updateQuantityMatrixWithGroups() {
        console.log("[DTG-PRICE-GROUPING] Looking for quantity matrix to update...");
        
        // Look for the quantity matrix table
        const quantityMatrix = document.getElementById('quantity-matrix');
        let matrixTable = null;
        
        if (quantityMatrix) {
            matrixTable = quantityMatrix.querySelector('table.quantity-matrix');
        }
        
        // If not found, look for it in the alternative location
        if (!matrixTable) {
            const container = document.querySelector('.single-row-quantity-container');
            if (container) {
                matrixTable = container.querySelector('table.quantity-matrix');
            }
        }
        
        if (!matrixTable || !window.nwcaPricingData) {
            console.warn("[DTG-PRICE-GROUPING] Quantity matrix table or pricing data not found");
            return false;
        }

        console.log("[DTG-PRICE-GROUPING] Found quantity matrix table");

        const groups = groupSizesByPrice(window.nwcaPricingData);
        if (groups.length === 0) {
            console.warn("[DTG-PRICE-GROUPING] No groups created");
            return false;
        }

        // Find all rows in the table
        const rows = matrixTable.querySelectorAll('tr');
        if (rows.length < 2) {
            console.warn("[DTG-PRICE-GROUPING] Not enough rows in quantity matrix");
            return false;
        }

        // First row should be headers
        const headerRow = rows[0];
        const headerCells = Array.from(headerRow.querySelectorAll('th, td'));
        
        // Skip the first cell (usually empty or "Qty:")
        const sizeHeaders = headerCells.slice(1);
        
        // Create a map of column indices to groups
        const columnToGroup = new Map();
        const processedGroups = new Set();
        
        sizeHeaders.forEach((header, index) => {
            const size = header.textContent.trim();
            const group = groups.find(g => g.sizes.includes(size));
            if (group) {
                columnToGroup.set(index, group);
            }
        });

        // Update headers with grouped labels
        let currentGroupLabel = null;
        let groupStartIndex = -1;
        let colspan = 0;
        
        for (let i = 0; i < sizeHeaders.length; i++) {
            const group = columnToGroup.get(i);
            
            if (group && group.label !== currentGroupLabel) {
                // Start of a new group
                if (currentGroupLabel && groupStartIndex >= 0) {
                    // Finish the previous group
                    sizeHeaders[groupStartIndex].colSpan = colspan;
                    // Hide the cells that are part of the colspan
                    for (let j = 1; j < colspan; j++) {
                        if (sizeHeaders[groupStartIndex + j]) {
                            sizeHeaders[groupStartIndex + j].style.display = 'none';
                        }
                    }
                }
                
                currentGroupLabel = group.label;
                groupStartIndex = i;
                colspan = 1;
                sizeHeaders[i].textContent = group.label;
                sizeHeaders[i].style.backgroundColor = '#f0f0f0';
                sizeHeaders[i].style.fontWeight = 'bold';
            } else if (group && group.label === currentGroupLabel) {
                // Continue the current group
                colspan++;
            } else {
                // End of group or no group
                if (currentGroupLabel && groupStartIndex >= 0) {
                    sizeHeaders[groupStartIndex].colSpan = colspan;
                    for (let j = 1; j < colspan; j++) {
                        if (sizeHeaders[groupStartIndex + j]) {
                            sizeHeaders[groupStartIndex + j].style.display = 'none';
                        }
                    }
                }
                currentGroupLabel = null;
                groupStartIndex = -1;
                colspan = 0;
            }
        }
        
        // Handle the last group
        if (currentGroupLabel && groupStartIndex >= 0) {
            sizeHeaders[groupStartIndex].colSpan = colspan;
            for (let j = 1; j < colspan; j++) {
                if (sizeHeaders[groupStartIndex + j]) {
                    sizeHeaders[groupStartIndex + j].style.display = 'none';
                }
            }
        }

        // Update the price row (usually the third row)
        if (rows.length >= 3) {
            const priceRow = rows[2];
            const priceCells = Array.from(priceRow.querySelectorAll('td')).slice(1);
            
            // Apply the same grouping to price cells
            currentGroupLabel = null;
            groupStartIndex = -1;
            colspan = 0;
            
            for (let i = 0; i < priceCells.length; i++) {
                const group = columnToGroup.get(i);
                
                if (group && group.label !== currentGroupLabel) {
                    if (currentGroupLabel && groupStartIndex >= 0) {
                        priceCells[groupStartIndex].colSpan = colspan;
                        for (let j = 1; j < colspan; j++) {
                            if (priceCells[groupStartIndex + j]) {
                                priceCells[groupStartIndex + j].style.display = 'none';
                            }
                        }
                    }
                    
                    currentGroupLabel = group.label;
                    groupStartIndex = i;
                    colspan = 1;
                } else if (group && group.label === currentGroupLabel) {
                    colspan++;
                } else {
                    if (currentGroupLabel && groupStartIndex >= 0) {
                        priceCells[groupStartIndex].colSpan = colspan;
                        for (let j = 1; j < colspan; j++) {
                            if (priceCells[groupStartIndex + j]) {
                                priceCells[groupStartIndex + j].style.display = 'none';
                            }
                        }
                    }
                    currentGroupLabel = null;
                    groupStartIndex = -1;
                    colspan = 0;
                }
            }
            
            if (currentGroupLabel && groupStartIndex >= 0) {
                priceCells[groupStartIndex].colSpan = colspan;
                for (let j = 1; j < colspan; j++) {
                    if (priceCells[groupStartIndex + j]) {
                        priceCells[groupStartIndex + j].style.display = 'none';
                    }
                }
            }
        }

        console.log("[DTG-PRICE-GROUPING] Quantity matrix updated with grouped columns");
        return true;
    }

    /**
     * Initialize the price-based grouping
     */
    function initialize() {
        console.log("[DTG-PRICE-GROUPING] Initializing...");
        
        // Function to check and apply grouping
        function checkAndApplyGrouping() {
            console.log("[DTG-PRICE-GROUPING] Checking for pricing data and grid...");
            
            // Check if we have pricing data
            if (!window.nwcaPricingData || !window.nwcaPricingData.prices) {
                console.log("[DTG-PRICE-GROUPING] No pricing data available yet");
                return false;
            }
            
            // Check if the pricing grid exists
            const pricingGrid = document.getElementById('custom-pricing-grid');
            if (!pricingGrid) {
                console.log("[DTG-PRICE-GROUPING] Pricing grid not found");
                return false;
            }
            
            // Check if the grid has been populated
            const tbody = pricingGrid.querySelector('tbody');
            if (!tbody || tbody.children.length === 0) {
                console.log("[DTG-PRICE-GROUPING] Pricing grid not populated yet");
                return false;
            }
            
            console.log("[DTG-PRICE-GROUPING] Applying price grouping...");
            const gridUpdated = updatePricingGridWithGroups();
            const matrixUpdated = updateQuantityMatrixWithGroups();
            
            console.log("[DTG-PRICE-GROUPING] Grid updated:", gridUpdated, "Matrix updated:", matrixUpdated);
            return gridUpdated || matrixUpdated;
        }
        
        // Listen for pricing data loaded event
        window.addEventListener('pricingDataLoaded', function(event) {
            console.log("[DTG-PRICE-GROUPING] Pricing data loaded event received");
            console.log("[DTG-PRICE-GROUPING] Event detail:", event.detail);
            
            // Wait a bit for the UI to render
            setTimeout(() => {
                if (!checkAndApplyGrouping()) {
                    // If it failed, try again after a longer delay
                    setTimeout(checkAndApplyGrouping, 1000);
                }
            }, 300);
        });

        // Also listen for when the pricing UI is ready
        window.addEventListener('nwcaProductPricingUIReady', function() {
            console.log("[DTG-PRICE-GROUPING] Product pricing UI ready");
            setTimeout(checkAndApplyGrouping, 200);
        });

        // Monitor for changes to the pricing grid
        const observer = new MutationObserver(function(mutations) {
            // Check if tbody was added or modified
            for (const mutation of mutations) {
                if (mutation.type === 'childList') {
                    // Check if it's the tbody or if tbody has new content
                    const tbody = document.querySelector('#custom-pricing-grid tbody');
                    if (tbody && tbody.children.length > 0) {
                        // Check if it has actual pricing rows (not just loading message)
                        const firstRow = tbody.querySelector('tr');
                        if (firstRow && !firstRow.textContent.includes('Loading')) {
                            console.log("[DTG-PRICE-GROUPING] Pricing grid tbody populated with data");
                            observer.disconnect(); // Stop observing once we process
                            setTimeout(checkAndApplyGrouping, 500); // Give a bit more time for data to settle
                            break;
                        }
                    }
                }
            }
        });
        
        // Start observing the pricing grid if it exists
        const pricingGrid = document.getElementById('custom-pricing-grid');
        if (pricingGrid) {
            observer.observe(pricingGrid, {
                childList: true,
                subtree: true
            });
        }
        
        // Also monitor the quantity matrix for changes
        const quantityObserver = new MutationObserver(function(mutations) {
            for (const mutation of mutations) {
                if (mutation.type === 'childList') {
                    const matrix = document.querySelector('#quantity-matrix table');
                    if (matrix && matrix.querySelector('tbody tr')) {
                        console.log("[DTG-PRICE-GROUPING] Quantity matrix populated");
                        quantityObserver.disconnect();
                        setTimeout(checkAndApplyGrouping, 500);
                        break;
                    }
                }
            }
        });
        
        const quantityMatrix = document.getElementById('quantity-matrix');
        if (quantityMatrix) {
            quantityObserver.observe(quantityMatrix, {
                childList: true,
                subtree: true
            });
        }

        // Also check periodically in case events are missed
        let checkCount = 0;
        const checkInterval = setInterval(() => {
            checkCount++;
            console.log(`[DTG-PRICE-GROUPING] Periodic check #${checkCount}`);
            
            if (checkAndApplyGrouping() || checkCount >= 10) {
                clearInterval(checkInterval);
                if (checkCount >= 10) {
                    console.log("[DTG-PRICE-GROUPING] Max checks reached, stopping");
                }
            }
        }, 1000);
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }

    // Expose functions globally for debugging
    window.DTGPriceGrouping = {
        groupSizesByPrice: groupSizesByPrice,
        updatePricingGridWithGroups: updatePricingGridWithGroups,
        updateQuantityMatrixWithGroups: updateQuantityMatrixWithGroups
    };

})();