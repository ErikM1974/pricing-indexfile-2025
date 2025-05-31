// DTG Price-Based Grouping V3 - Fixed version with proper DOM handling
console.log("[DTG-PRICE-GROUPING-V3] Loading DTG price-based grouping module...");

(function() {
    "use strict";

    let groupingApplied = false;
    let originalTableHTML = null;

    /**
     * Analyzes the pricing table to find groups of sizes with matching prices
     */
    function analyzePriceGroups() {
        const pricingGrid = document.getElementById('custom-pricing-grid');
        if (!pricingGrid) {
            console.warn("[DTG-PRICE-GROUPING-V3] Pricing grid not found");
            return [];
        }

        const headerRow = pricingGrid.querySelector('thead tr');
        const tbody = pricingGrid.querySelector('tbody');
        
        if (!headerRow || !tbody) {
            console.warn("[DTG-PRICE-GROUPING-V3] Header row or tbody not found");
            return [];
        }

        // Get all size headers (skip the first "Quantity" header)
        const sizeHeaders = Array.from(headerRow.querySelectorAll('th')).slice(1);
        const sizes = sizeHeaders.map(th => th.textContent.trim());
        
        console.log("[DTG-PRICE-GROUPING-V3] Found sizes:", sizes);

        // Get all pricing rows
        const rows = Array.from(tbody.querySelectorAll('tr'));
        if (rows.length === 0) {
            console.warn("[DTG-PRICE-GROUPING-V3] No pricing rows found");
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

        console.log("[DTG-PRICE-GROUPING-V3] Price data:", priceData);

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

        console.log("[DTG-PRICE-GROUPING-V3] Created groups:", groups);
        return groups;
    }

    /**
     * Applies price-based grouping to the pricing table
     */
    function applyPriceGrouping() {
        if (groupingApplied) {
            console.log("[DTG-PRICE-GROUPING-V3] Grouping already applied");
            return;
        }

        const groups = analyzePriceGroups();
        if (groups.length === 0) {
            console.warn("[DTG-PRICE-GROUPING-V3] No groups to apply");
            return;
        }

        // Check if we have any multi-size groups
        const hasMultiSizeGroups = groups.some(g => g.sizes.length > 1);
        if (!hasMultiSizeGroups) {
            console.log("[DTG-PRICE-GROUPING-V3] No multi-size groups found, skipping grouping");
            return;
        }

        const pricingGrid = document.getElementById('custom-pricing-grid');
        if (!pricingGrid) return;

        // Save original table HTML for restoration
        originalTableHTML = pricingGrid.innerHTML;

        const thead = pricingGrid.querySelector('thead');
        const tbody = pricingGrid.querySelector('tbody');
        
        // Create new table structure
        const newThead = document.createElement('thead');
        const newHeaderRow = document.createElement('tr');
        newHeaderRow.id = 'pricing-header-row';
        
        // Add Quantity header
        const qtyHeader = document.createElement('th');
        qtyHeader.textContent = 'Quantity';
        newHeaderRow.appendChild(qtyHeader);
        
        // Add group headers
        groups.forEach(group => {
            const th = document.createElement('th');
            th.textContent = group.label;
            th.setAttribute('data-size-group', group.label);
            th.setAttribute('data-sizes', group.sizes.join(','));
            if (group.sizes.length > 1) {
                th.style.backgroundColor = '#e8f5e9'; // Light green for grouped columns
                th.style.fontWeight = 'bold';
                th.style.border = '2px solid #2e5827';
            }
            newHeaderRow.appendChild(th);
        });
        
        newThead.appendChild(newHeaderRow);
        
        // Create new tbody
        const newTbody = document.createElement('tbody');
        const originalRows = tbody.querySelectorAll('tr');
        
        originalRows.forEach(originalRow => {
            const newRow = document.createElement('tr');
            const cells = Array.from(originalRow.cells);
            
            // Add tier label
            const tierCell = cells[0].cloneNode(true);
            newRow.appendChild(tierCell);
            
            // Add grouped price cells
            groups.forEach(group => {
                const td = document.createElement('td');
                const priceIndex = group.startIndex + 1; // +1 for tier label
                if (cells[priceIndex]) {
                    td.textContent = cells[priceIndex].textContent;
                    td.setAttribute('data-size-group', group.label);
                    if (group.sizes.length > 1) {
                        td.style.backgroundColor = '#f1f8f4'; // Very light green for grouped data cells
                    }
                }
                newRow.appendChild(td);
            });
            
            newTbody.appendChild(newRow);
        });
        
        // Replace the table content
        pricingGrid.innerHTML = '';
        pricingGrid.appendChild(newThead);
        pricingGrid.appendChild(newTbody);

        // Also update the quantity matrix if it exists
        updateQuantityMatrixWithGroups(groups);

        groupingApplied = true;
        console.log("[DTG-PRICE-GROUPING-V3] Price grouping applied successfully");
    }

    /**
     * Restores the original table structure
     */
    function restoreOriginalTable() {
        if (!originalTableHTML) {
            console.warn("[DTG-PRICE-GROUPING-V3] No original table HTML to restore");
            return;
        }

        const pricingGrid = document.getElementById('custom-pricing-grid');
        if (pricingGrid) {
            pricingGrid.innerHTML = originalTableHTML;
            groupingApplied = false;
            console.log("[DTG-PRICE-GROUPING-V3] Original table restored");
        }
    }

    /**
     * Updates the quantity matrix to match the grouped pricing table
     */
    function updateQuantityMatrixWithGroups(groups) {
        const quantityMatrix = document.querySelector('#quantity-matrix table.quantity-matrix');
        if (!quantityMatrix) {
            console.log("[DTG-PRICE-GROUPING-V3] Quantity matrix not found");
            return;
        }

        const headerRow = quantityMatrix.querySelector('tr:first-child');
        const quantityRow = quantityMatrix.querySelector('tr:nth-child(2)');
        const priceRow = quantityMatrix.querySelector('tr:nth-child(3)');

        if (!headerRow || !quantityRow) {
            console.warn("[DTG-PRICE-GROUPING-V3] Quantity matrix structure not as expected");
            return;
        }

        // Save original cells
        const originalHeaderCells = Array.from(headerRow.cells);
        const originalQtyCells = Array.from(quantityRow.cells);
        const originalPriceCells = priceRow ? Array.from(priceRow.cells) : [];

        // Clear rows
        headerRow.innerHTML = '';
        quantityRow.innerHTML = '';
        if (priceRow) priceRow.innerHTML = '';

        // Add first cells back
        headerRow.appendChild(originalHeaderCells[0]);
        quantityRow.appendChild(originalQtyCells[0]);
        if (priceRow) priceRow.appendChild(originalPriceCells[0]);

        // Add grouped columns
        groups.forEach(group => {
            // Header
            const th = document.createElement('th');
            th.textContent = group.label;
            th.setAttribute('data-size-group', group.label);
            if (group.sizes.length > 1) {
                th.style.backgroundColor = '#e8f5e9';
                th.style.fontWeight = 'bold';
            }
            headerRow.appendChild(th);

            // Quantity cell
            const qtyTd = document.createElement('td');
            if (group.sizes.length > 1) {
                qtyTd.innerHTML = `<div style="text-align: center; padding: 10px;">
                    <small style="color: #666;">Select individual sizes<br>for ${group.label}</small>
                </div>`;
                qtyTd.style.backgroundColor = '#f1f8f4';
            } else {
                const originalIndex = group.startIndex + 1;
                if (originalQtyCells[originalIndex]) {
                    qtyTd.innerHTML = originalQtyCells[originalIndex].innerHTML;
                }
            }
            quantityRow.appendChild(qtyTd);

            // Price cell
            if (priceRow) {
                const priceTd = document.createElement('td');
                const originalIndex = group.startIndex + 1;
                if (originalPriceCells[originalIndex]) {
                    priceTd.innerHTML = originalPriceCells[originalIndex].innerHTML;
                }
                if (group.sizes.length > 1) {
                    priceTd.style.backgroundColor = '#f1f8f4';
                }
                priceRow.appendChild(priceTd);
            }
        });
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
            console.log("[DTG-PRICE-GROUPING-V3] Price data detected, applying grouping");
            applyPriceGrouping();
        }
    }

    /**
     * Initialize the price grouping system
     */
    function initialize() {
        console.log("[DTG-PRICE-GROUPING-V3] Initializing...");

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
                    console.log("[DTG-PRICE-GROUPING-V3] Max checks reached");
                }
            }
        }, 500);

        // Listen for print location changes
        const locationDropdown = document.getElementById('parent-dtg-location-select');
        if (locationDropdown) {
            locationDropdown.addEventListener('change', function() {
                console.log("[DTG-PRICE-GROUPING-V3] Location changed, resetting grouping");
                if (groupingApplied) {
                    restoreOriginalTable();
                }
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
    window.DTGPriceGroupingV3 = {
        analyzePriceGroups,
        applyPriceGrouping,
        restoreOriginalTable,
        monitorAndApplyGrouping
    };

})();