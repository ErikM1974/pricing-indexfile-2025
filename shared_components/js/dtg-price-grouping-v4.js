// DTG Price-Based Grouping V4 - Enhanced detection and compatibility
console.log("[DTG-PRICE-GROUPING-V4] Loading enhanced DTG price-based grouping module...");

(function() {
    "use strict";

    let groupingApplied = false;
    let originalTableHTML = null;
    let detectionAttempts = 0;
    const MAX_DETECTION_ATTEMPTS = 30;

    /**
     * Find the pricing table using multiple strategies
     */
    function findPricingTable() {
        // Strategy 1: Look for specific IDs
        let table = document.getElementById('custom-pricing-grid');
        if (table) {
            console.log("[DTG-PRICE-GROUPING-V4] Found table by ID: custom-pricing-grid");
            return table;
        }

        // Strategy 2: Look for pricing grid class
        table = document.querySelector('.pricing-grid');
        if (table) {
            console.log("[DTG-PRICE-GROUPING-V4] Found table by class: pricing-grid");
            return table;
        }

        // Strategy 3: Look for table with pricing data inside pricing section
        const pricingSection = document.querySelector('.pricing-section');
        if (pricingSection) {
            table = pricingSection.querySelector('table');
            if (table && isPricingTable(table)) {
                console.log("[DTG-PRICE-GROUPING-V4] Found table in pricing section");
                return table;
            }
        }

        // Strategy 4: Look for any table with size headers and price data
        const allTables = document.querySelectorAll('table');
        for (let t of allTables) {
            if (isPricingTable(t)) {
                console.log("[DTG-PRICE-GROUPING-V4] Found pricing table by content analysis");
                return t;
            }
        }

        return null;
    }

    /**
     * Check if a table contains pricing data
     */
    function isPricingTable(table) {
        if (!table) return false;

        // Check for size headers
        const headers = table.querySelectorAll('th');
        const headerTexts = Array.from(headers).map(h => h.textContent.trim());
        const sizePattern = /^(XS|S|M|L|XL|2XL|3XL|4XL|5XL)$/;
        const hasSizeHeaders = headerTexts.some(h => sizePattern.test(h));

        // Check for price data
        const cells = table.querySelectorAll('td');
        const hasPriceData = Array.from(cells).some(cell => 
            cell.textContent.includes('$') && !cell.textContent.includes('Loading')
        );

        // Check for quantity tiers
        const hasQuantityTiers = headerTexts.some(h => h.toLowerCase().includes('quantity')) ||
                                Array.from(cells).some(cell => /^\d+-\d+/.test(cell.textContent.trim()));

        return hasSizeHeaders && hasPriceData && hasQuantityTiers;
    }

    /**
     * Analyzes the pricing table to find groups of sizes with matching prices
     */
    function analyzePriceGroups() {
        const pricingTable = findPricingTable();
        if (!pricingTable) {
            console.warn("[DTG-PRICE-GROUPING-V4] Pricing table not found");
            return [];
        }

        // Ensure the table has an ID for future reference
        if (!pricingTable.id) {
            pricingTable.id = 'dtg-pricing-table-' + Date.now();
        }

        const headerRow = pricingTable.querySelector('thead tr') || pricingTable.querySelector('tr');
        const tbody = pricingTable.querySelector('tbody') || pricingTable;
        
        if (!headerRow) {
            console.warn("[DTG-PRICE-GROUPING-V4] Header row not found");
            return [];
        }

        // Get all headers
        const allHeaders = Array.from(headerRow.querySelectorAll('th, td'));
        const sizePattern = /^(XS|S|M|L|XL|2XL|3XL|4XL|5XL)$/;
        
        // Find size headers and their indices
        const sizeInfo = [];
        allHeaders.forEach((header, index) => {
            const text = header.textContent.trim();
            if (sizePattern.test(text)) {
                sizeInfo.push({ size: text, index: index });
            }
        });

        if (sizeInfo.length === 0) {
            console.warn("[DTG-PRICE-GROUPING-V4] No size headers found");
            return [];
        }

        console.log("[DTG-PRICE-GROUPING-V4] Found sizes:", sizeInfo.map(s => s.size));

        // Get all pricing rows (skip header)
        const rows = Array.from(tbody.querySelectorAll('tr')).filter(row => 
            row !== headerRow && !row.querySelector('th') // Skip any header rows
        );

        if (rows.length === 0) {
            console.warn("[DTG-PRICE-GROUPING-V4] No pricing rows found");
            return [];
        }

        // Build price data structure
        const priceData = {};
        sizeInfo.forEach(({ size }) => {
            priceData[size] = [];
        });

        rows.forEach(row => {
            const cells = Array.from(row.querySelectorAll('td'));
            sizeInfo.forEach(({ size, index }) => {
                if (cells[index]) {
                    const price = cells[index].textContent.trim();
                    priceData[size].push(price);
                }
            });
        });

        console.log("[DTG-PRICE-GROUPING-V4] Price data:", priceData);

        // Group consecutive sizes with identical prices
        const groups = [];
        const processed = new Set();

        for (let i = 0; i < sizeInfo.length; i++) {
            const { size, index } = sizeInfo[i];
            if (processed.has(size)) continue;

            const group = {
                sizes: [size],
                startIndex: index,
                endIndex: index,
                prices: priceData[size]
            };

            // Look for consecutive sizes with matching prices
            for (let j = i + 1; j < sizeInfo.length; j++) {
                const nextSize = sizeInfo[j].size;
                const nextIndex = sizeInfo[j].index;
                
                // Check if consecutive in table
                if (nextIndex !== sizeInfo[j-1].index + 1) break;
                
                // Check if prices match
                const pricesMatch = priceData[size].every((price, tierIndex) => 
                    price === priceData[nextSize][tierIndex]
                );

                if (pricesMatch) {
                    group.sizes.push(nextSize);
                    group.endIndex = nextIndex;
                    processed.add(nextSize);
                } else {
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
        }

        console.log("[DTG-PRICE-GROUPING-V4] Created groups:", groups);
        return groups;
    }

    /**
     * Applies price-based grouping to the pricing table
     */
    function applyPriceGrouping() {
        if (groupingApplied) {
            console.log("[DTG-PRICE-GROUPING-V4] Grouping already applied");
            return;
        }

        const groups = analyzePriceGroups();
        if (groups.length === 0) {
            console.warn("[DTG-PRICE-GROUPING-V4] No groups to apply");
            return;
        }

        // Check if we have any multi-size groups
        const hasMultiSizeGroups = groups.some(g => g.sizes.length > 1);
        if (!hasMultiSizeGroups) {
            console.log("[DTG-PRICE-GROUPING-V4] No multi-size groups found, skipping grouping");
            return;
        }

        const pricingTable = findPricingTable();
        if (!pricingTable) return;

        // Hide the table temporarily to prevent flash
        pricingTable.style.opacity = '0';
        pricingTable.style.transition = 'opacity 0.3s ease';

        // Save original table HTML for restoration
        originalTableHTML = pricingTable.outerHTML;

        // Clone the table to work with
        const newTable = pricingTable.cloneNode(true);
        const headerRow = newTable.querySelector('thead tr') || newTable.querySelector('tr');
        const tbody = newTable.querySelector('tbody') || newTable;
        
        // Get all headers
        const allHeaders = Array.from(headerRow.querySelectorAll('th, td'));
        
        // Build new header row
        const newHeaders = [];
        let currentIndex = 0;
        
        // Add non-size headers before the first size
        const firstSizeIndex = groups[0].startIndex;
        for (let i = 0; i < firstSizeIndex; i++) {
            newHeaders.push(allHeaders[i].cloneNode(true));
        }
        
        // Add grouped size headers
        groups.forEach(group => {
            if (group.sizes.length > 1) {
                const th = document.createElement(allHeaders[group.startIndex].tagName);
                th.textContent = group.label;
                th.setAttribute('data-size-group', group.label);
                th.setAttribute('data-sizes', group.sizes.join(','));
                th.style.backgroundColor = '#e8f5e9';
                th.style.fontWeight = 'bold';
                th.style.border = '2px solid #2e5827';
                newHeaders.push(th);
            } else {
                newHeaders.push(allHeaders[group.startIndex].cloneNode(true));
            }
        });
        
        // Add any remaining headers after sizes
        const lastSizeIndex = groups[groups.length - 1].endIndex;
        for (let i = lastSizeIndex + 1; i < allHeaders.length; i++) {
            newHeaders.push(allHeaders[i].cloneNode(true));
        }
        
        // Replace header row
        headerRow.innerHTML = '';
        newHeaders.forEach(h => headerRow.appendChild(h));
        
        // Update body rows
        const rows = Array.from(tbody.querySelectorAll('tr')).filter(row => 
            row !== headerRow && !row.querySelector('th')
        );
        
        rows.forEach(row => {
            const cells = Array.from(row.querySelectorAll('td'));
            const newCells = [];
            
            // Add cells before sizes
            for (let i = 0; i < firstSizeIndex; i++) {
                if (cells[i]) newCells.push(cells[i].cloneNode(true));
            }
            
            // Add grouped price cells
            groups.forEach(group => {
                if (cells[group.startIndex]) {
                    const td = cells[group.startIndex].cloneNode(true);
                    if (group.sizes.length > 1) {
                        td.setAttribute('data-size-group', group.label);
                        td.style.backgroundColor = '#f1f8f4';
                    }
                    newCells.push(td);
                }
            });
            
            // Add any remaining cells
            for (let i = lastSizeIndex + 1; i < cells.length; i++) {
                if (cells[i]) newCells.push(cells[i].cloneNode(true));
            }
            
            // Replace row cells
            row.innerHTML = '';
            newCells.forEach(c => row.appendChild(c));
        });
        
        // Replace the original table with the new one
        pricingTable.parentNode.replaceChild(newTable, pricingTable);
        
        // Show the new table with fade-in effect
        setTimeout(() => {
            newTable.style.opacity = '1';
        }, 50);
        
        // Also update the quantity matrix if it exists
        updateQuantityMatrixWithGroups(groups);

        groupingApplied = true;
        console.log("[DTG-PRICE-GROUPING-V4] Price grouping applied successfully");
        
        // Dispatch event to notify other scripts
        document.dispatchEvent(new CustomEvent('dtgPriceGroupingApplied', {
            detail: { groups }
        }));
    }

    /**
     * Updates the quantity matrix to match the grouped pricing table
     */
    function updateQuantityMatrixWithGroups(groups) {
        // Look for quantity matrix in various locations
        const quantityMatrix = document.querySelector('#quantity-matrix table') ||
                              document.querySelector('.quantity-matrix') ||
                              document.querySelector('[class*="quantity"] table');
                              
        if (!quantityMatrix) {
            console.log("[DTG-PRICE-GROUPING-V4] Quantity matrix not found");
            return;
        }

        console.log("[DTG-PRICE-GROUPING-V4] Updating quantity matrix");
        
        // Implementation would be similar to V3 but with better detection
        // For now, we'll skip this as the main focus is the pricing table
    }

    /**
     * Monitors for changes and applies grouping when appropriate
     */
    function monitorAndApplyGrouping() {
        detectionAttempts++;
        
        if (detectionAttempts > MAX_DETECTION_ATTEMPTS) {
            console.log("[DTG-PRICE-GROUPING-V4] Max detection attempts reached");
            return;
        }

        const pricingTable = findPricingTable();
        if (!pricingTable) {
            console.log(`[DTG-PRICE-GROUPING-V4] Attempt ${detectionAttempts}: No pricing table found yet`);
            return;
        }

        // Check if table has actual price data
        const cells = pricingTable.querySelectorAll('td');
        const hasPriceData = Array.from(cells).some(cell => 
            cell.textContent.includes('$') && !cell.textContent.includes('Loading')
        );

        if (hasPriceData && !groupingApplied) {
            console.log("[DTG-PRICE-GROUPING-V4] Price data detected, applying grouping");
            setTimeout(() => {
                applyPriceGrouping();
            }, 500); // Small delay to ensure table is fully rendered
        }
    }

    /**
     * Initialize the price grouping system
     */
    function initialize() {
        console.log("[DTG-PRICE-GROUPING-V4] Initializing...");

        // Set up mutation observer to watch for table changes
        const observer = new MutationObserver(function(mutations) {
            if (!groupingApplied) {
                monitorAndApplyGrouping();
            }
        });

        // Observe the entire document body for changes
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true
        });

        // Also check periodically
        const checkInterval = setInterval(() => {
            monitorAndApplyGrouping();
            
            if (groupingApplied || detectionAttempts >= MAX_DETECTION_ATTEMPTS) {
                clearInterval(checkInterval);
            }
        }, 1000);

        // Listen for print location changes
        const locationDropdown = document.getElementById('parent-dtg-location-select');
        if (locationDropdown) {
            locationDropdown.addEventListener('change', function() {
                console.log("[DTG-PRICE-GROUPING-V4] Location changed, resetting grouping");
                groupingApplied = false;
                detectionAttempts = 0;
                if (originalTableHTML) {
                    const currentTable = findPricingTable();
                    if (currentTable && currentTable.parentNode) {
                        const tempDiv = document.createElement('div');
                        tempDiv.innerHTML = originalTableHTML;
                        const restoredTable = tempDiv.firstChild;
                        currentTable.parentNode.replaceChild(restoredTable, currentTable);
                    }
                }
                setTimeout(monitorAndApplyGrouping, 1000);
            });
        }
        
        // Listen for custom events that might indicate data is ready
        document.addEventListener('pricingDataLoaded', () => {
            console.log("[DTG-PRICE-GROUPING-V4] pricingDataLoaded event received");
            // Reset grouping state when new data loads
            groupingApplied = false;
            // Wait longer for first load to ensure table is fully rendered
            setTimeout(monitorAndApplyGrouping, 1500);
        });
        
        document.addEventListener('DataPageReady', () => {
            console.log("[DTG-PRICE-GROUPING-V4] DataPageReady event received");
            setTimeout(monitorAndApplyGrouping, 500);
        });
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }

    // Expose for debugging
    window.DTGPriceGroupingV4 = {
        findPricingTable,
        analyzePriceGroups,
        applyPriceGrouping,
        monitorAndApplyGrouping,
        reset: function() {
            groupingApplied = false;
            detectionAttempts = 0;
            originalTableHTML = null;
        }
    };

})();