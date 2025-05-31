// DTG Price-Based Grouping V2 - Works with Caspio-generated tables
console.log("[DTG-PRICE-GROUPING-V2] Loading enhanced price-based grouping module...");

(function() {
    "use strict";

    let groupingApplied = false;
    let originalHeaders = [];
    let originalRows = [];

    /**
     * Analyzes the pricing table to find groups of sizes with matching prices
     */
    function analyzePriceGroups() {
        const pricingGrid = document.getElementById('custom-pricing-grid');
        if (!pricingGrid) {
            console.warn("[DTG-PRICE-GROUPING-V2] Pricing grid not found");
            return [];
        }

        const headerRow = pricingGrid.querySelector('thead tr');
        const tbody = pricingGrid.querySelector('tbody');
        
        if (!headerRow || !tbody) {
            console.warn("[DTG-PRICE-GROUPING-V2] Header row or tbody not found");
            return [];
        }

        // Get all size headers (skip the first "Quantity" header)
        const sizeHeaders = Array.from(headerRow.querySelectorAll('th')).slice(1);
        const sizes = sizeHeaders.map(th => th.textContent.trim());
        
        console.log("[DTG-PRICE-GROUPING-V2] Found sizes:", sizes);

        // Get all pricing rows
        const rows = Array.from(tbody.querySelectorAll('tr'));
        if (rows.length === 0) {
            console.warn("[DTG-PRICE-GROUPING-V2] No pricing rows found");
            return [];
        }

        // Build price data structure
        const priceData = {};
        sizes.forEach((size, index) => {
            priceData[size] = [];
        });

        rows.forEach(row => {
            const cells = Array.from(row.querySelectorAll('td')).slice(1); // Skip tier label
            cells.forEach((cell, index) => {
                if (index < sizes.length) {
                    const price = cell.textContent.trim();
                    priceData[sizes[index]].push(price);
                }
            });
        });

        console.log("[DTG-PRICE-GROUPING-V2] Price data:", priceData);

        // Group sizes with identical prices across all tiers
        const groups = [];
        const processed = new Set();

        sizes.forEach((size, index) => {
            if (processed.has(size)) return;

            const group = {
                sizes: [size],
                startIndex: index,
                endIndex: index,
                prices: priceData[size]
            };

            // Find other sizes with matching prices
            for (let i = index + 1; i < sizes.length; i++) {
                const compareSize = sizes[i];
                if (processed.has(compareSize)) continue;

                // Check if all prices match
                const pricesMatch = priceData[size].every((price, tierIndex) => 
                    price === priceData[compareSize][tierIndex]
                );

                if (pricesMatch) {
                    group.sizes.push(compareSize);
                    group.endIndex = i;
                    processed.add(compareSize);
                } else {
                    // Stop if we hit a non-matching price (non-consecutive group)
                    break;
                }
            }

            processed.add(size);

            // Create group label
            if (group.sizes.length > 1) {
                group.label = `${group.sizes[0]}-${group.sizes[group.sizes.length - 1]}`;
            } else {
                group.label = size;
            }

            groups.push(group);
        });

        console.log("[DTG-PRICE-GROUPING-V2] Created groups:", groups);
        return groups;
    }

    /**
     * Saves the original table structure for restoration
     */
    function saveOriginalTable() {
        const pricingGrid = document.getElementById('custom-pricing-grid');
        if (!pricingGrid) return;

        const headerRow = pricingGrid.querySelector('thead tr');
        const tbody = pricingGrid.querySelector('tbody');
        
        if (headerRow) {
            originalHeaders = Array.from(headerRow.children).map(th => ({
                html: th.outerHTML,
                text: th.textContent
            }));
        }

        if (tbody) {
            originalRows = Array.from(tbody.children).map(tr => tr.outerHTML);
        }
    }

    /**
     * Applies price-based grouping to the pricing table
     */
    function applyPriceGrouping() {
        if (groupingApplied) {
            console.log("[DTG-PRICE-GROUPING-V2] Grouping already applied");
            return;
        }

        const groups = analyzePriceGroups();
        if (groups.length === 0) {
            console.warn("[DTG-PRICE-GROUPING-V2] No groups to apply");
            return;
        }

        // Check if we have any multi-size groups
        const hasMultiSizeGroups = groups.some(g => g.sizes.length > 1);
        if (!hasMultiSizeGroups) {
            console.log("[DTG-PRICE-GROUPING-V2] No multi-size groups found, skipping grouping");
            return;
        }

        saveOriginalTable();

        const pricingGrid = document.getElementById('custom-pricing-grid');
        const headerRow = pricingGrid.querySelector('thead tr');
        const tbody = pricingGrid.querySelector('tbody');

        // Build new headers array
        const newHeaders = [];
        
        // Keep the first header (Quantity)
        const quantityHeader = headerRow.children[0].cloneNode(true);
        newHeaders.push(quantityHeader);
        
        // Add headers for each group
        groups.forEach(group => {
            const th = document.createElement('th');
            th.textContent = group.label;
            th.setAttribute('data-size-group', group.label);
            th.setAttribute('data-sizes', group.sizes.join(','));
            if (group.sizes.length > 1) {
                th.style.backgroundColor = '#f0f8ff';
                th.style.fontWeight = 'bold';
            }
            newHeaders.push(th);
        });

        // Clear and rebuild header
        headerRow.innerHTML = '';
        newHeaders.forEach(th => headerRow.appendChild(th));

        // Update body rows
        const rows = tbody.querySelectorAll('tr');
        rows.forEach(row => {
            // Save all original cell values
            const originalCells = Array.from(row.cells);
            const tierCell = originalCells[0].cloneNode(true); // Clone tier label cell
            
            const newCells = [tierCell]; // Keep tier label

            groups.forEach(group => {
                const cell = document.createElement('td');
                // Use the price from the first size in the group
                const originalCellIndex = group.startIndex + 1; // +1 for tier label
                if (originalCells[originalCellIndex]) {
                    cell.textContent = originalCells[originalCellIndex].textContent;
                    cell.setAttribute('data-size-group', group.label);
                    
                    // Copy any additional attributes or styles from original cell
                    if (originalCells[originalCellIndex].className) {
                        cell.className = originalCells[originalCellIndex].className;
                    }
                }
                newCells.push(cell);
            });

            // Clear and rebuild row
            row.innerHTML = '';
            newCells.forEach(cell => row.appendChild(cell));
        });

        // Also update the quantity matrix if it exists
        updateQuantityMatrixWithGroups(groups);

        groupingApplied = true;
        console.log("[DTG-PRICE-GROUPING-V2] Price grouping applied successfully");
    }

    /**
     * Updates the quantity matrix to match the grouped pricing table
     */
    function updateQuantityMatrixWithGroups(groups) {
        const quantityMatrix = document.querySelector('#quantity-matrix table.quantity-matrix');
        if (!quantityMatrix) {
            console.log("[DTG-PRICE-GROUPING-V2] Quantity matrix not found");
            return;
        }

        const headerRow = quantityMatrix.querySelector('tr:first-child');
        const quantityRow = quantityMatrix.querySelector('tr:nth-child(2)');
        const priceRow = quantityMatrix.querySelector('tr:nth-child(3)');

        if (!headerRow || !quantityRow) {
            console.warn("[DTG-PRICE-GROUPING-V2] Quantity matrix structure not as expected");
            return;
        }

        // Update headers
        const newHeaders = [headerRow.children[0]]; // Keep "Qty:" label
        groups.forEach(group => {
            const th = document.createElement('th');
            th.textContent = group.label;
            th.setAttribute('data-size-group', group.label);
            if (group.sizes.length > 1) {
                th.style.backgroundColor = '#f0f8ff';
                th.style.fontWeight = 'bold';
            }
            newHeaders.push(th);
        });

        headerRow.innerHTML = '';
        newHeaders.forEach(th => headerRow.appendChild(th));

        // Update quantity inputs row
        const qtyLabel = quantityRow.children[0];
        const newQtyCells = [qtyLabel];
        
        groups.forEach(group => {
            const td = document.createElement('td');
            // For grouped sizes, we'll need to handle quantity inputs differently
            // For now, just show a message
            if (group.sizes.length > 1) {
                td.innerHTML = `<div style="text-align: center; padding: 10px;">
                    <small>Select individual sizes<br>for ${group.label}</small>
                </div>`;
            } else {
                // For single sizes, keep the original input
                const originalIndex = group.startIndex + 1;
                if (quantityRow.children[originalIndex]) {
                    td.innerHTML = quantityRow.children[originalIndex].innerHTML;
                }
            }
            newQtyCells.push(td);
        });

        quantityRow.innerHTML = '';
        newQtyCells.forEach(cell => quantityRow.appendChild(cell));

        // Update price row if it exists
        if (priceRow) {
            const priceLabel = priceRow.children[0];
            const newPriceCells = [priceLabel];
            
            groups.forEach(group => {
                const td = document.createElement('td');
                const originalIndex = group.startIndex + 1;
                if (priceRow.children[originalIndex]) {
                    td.innerHTML = priceRow.children[originalIndex].innerHTML;
                }
                newPriceCells.push(td);
            });

            priceRow.innerHTML = '';
            newPriceCells.forEach(cell => priceRow.appendChild(cell));
        }
    }

    /**
     * Monitors for changes and applies grouping when appropriate
     */
    function monitorAndApplyGrouping() {
        // Check if pricing table has data
        const pricingGrid = document.getElementById('custom-pricing-grid');
        if (!pricingGrid) return;

        const tbody = pricingGrid.querySelector('tbody');
        if (!tbody || tbody.children.length === 0) return;

        // Check if it's not just a loading message
        const firstRow = tbody.querySelector('tr');
        if (firstRow && firstRow.textContent.includes('Loading')) return;

        // Check if we have actual price data
        const cells = tbody.querySelectorAll('td');
        const hasPriceData = Array.from(cells).some(cell => 
            cell.textContent.includes('$') && !cell.textContent.includes('Loading')
        );

        if (hasPriceData && !groupingApplied) {
            console.log("[DTG-PRICE-GROUPING-V2] Price data detected, applying grouping");
            applyPriceGrouping();
        }
    }

    /**
     * Initialize the price grouping system
     */
    function initialize() {
        console.log("[DTG-PRICE-GROUPING-V2] Initializing...");

        // Set up mutation observer to watch for table changes
        const observer = new MutationObserver(function(mutations) {
            monitorAndApplyGrouping();
        });

        const pricingGrid = document.getElementById('custom-pricing-grid');
        if (pricingGrid) {
            observer.observe(pricingGrid, {
                childList: true,
                subtree: true,
                characterData: true
            });
        }

        // Also check periodically
        let checkCount = 0;
        const checkInterval = setInterval(() => {
            checkCount++;
            monitorAndApplyGrouping();
            
            if (groupingApplied || checkCount >= 20) {
                clearInterval(checkInterval);
                if (checkCount >= 20) {
                    console.log("[DTG-PRICE-GROUPING-V2] Max checks reached");
                }
            }
        }, 500);

        // Listen for print location changes
        const locationDropdown = document.getElementById('parent-dtg-location-select');
        if (locationDropdown) {
            locationDropdown.addEventListener('change', function() {
                console.log("[DTG-PRICE-GROUPING-V2] Location changed, resetting grouping");
                groupingApplied = false;
                setTimeout(monitorAndApplyGrouping, 1000);
            });
        }
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }

    // Expose for debugging
    window.DTGPriceGroupingV2 = {
        analyzePriceGroups,
        applyPriceGrouping,
        monitorAndApplyGrouping
    };

})();