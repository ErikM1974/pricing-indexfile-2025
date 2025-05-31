// DTG Display Helper - Simplifies size display to S-XL, 2XL, 3XL, 4XL
console.log("[DTG-DISPLAY-HELPER] Loading DTG display helper...");

(function() {
    "use strict";

    // Size grouping configuration
    const SIZE_GROUPS = {
        'S-XL': ['S', 'M', 'L', 'XL'],
        '2XL': ['2XL'],
        '3XL': ['3XL'],
        '4XL': ['4XL']
    };

    /**
     * Simplifies the pricing display by grouping sizes
     */
    function simplifyPricingDisplay() {
        console.log("[DTG-DISPLAY-HELPER] Simplifying pricing display...");
        
        const headerRow = document.getElementById('pricing-header-row');
        const pricingGrid = document.getElementById('custom-pricing-grid');
        
        if (!headerRow || !pricingGrid) {
            console.warn("[DTG-DISPLAY-HELPER] Pricing grid elements not found");
            return;
        }

        // Check if we have pricing data
        if (!window.nwcaPricingData || !window.nwcaPricingData.prices) {
            console.warn("[DTG-DISPLAY-HELPER] No pricing data available yet");
            return;
        }

        const tbody = pricingGrid.querySelector('tbody');
        if (!tbody) {
            console.warn("[DTG-DISPLAY-HELPER] Pricing grid tbody not found");
            return;
        }

        // Clear existing headers (except Quantity)
        while (headerRow.children.length > 1) {
            headerRow.removeChild(headerRow.lastChild);
        }

        // Add grouped headers
        Object.keys(SIZE_GROUPS).forEach(groupKey => {
            const th = document.createElement('th');
            th.textContent = groupKey;
            th.setAttribute('data-size-group', groupKey);
            headerRow.appendChild(th);
        });

        // Update pricing rows
        const rows = tbody.querySelectorAll('tr');
        rows.forEach(row => {
            // Get the tier from the first cell
            const tierCell = row.cells[0];
            if (!tierCell) return;
            
            const tierKey = tierCell.textContent.trim();
            
            // Remove all cells except the tier cell
            while (row.cells.length > 1) {
                row.removeChild(row.lastCell);
            }

            // Add grouped price cells
            Object.entries(SIZE_GROUPS).forEach(([groupKey, sizes]) => {
                const cell = row.insertCell();
                
                // Get price from first size in group (since S-XL are same price)
                const firstSize = sizes[0];
                let price = null;
                
                if (window.nwcaPricingData.prices[firstSize] && 
                    window.nwcaPricingData.prices[firstSize][tierKey] !== undefined) {
                    price = window.nwcaPricingData.prices[firstSize][tierKey];
                }
                
                if (price !== null && price !== undefined) {
                    cell.textContent = `$${parseFloat(price).toFixed(2)}`;
                } else {
                    cell.textContent = 'N/A';
                }
                
                cell.setAttribute('data-size-group', groupKey);
                cell.setAttribute('data-tier', tierKey);
            });
        });

        console.log("[DTG-DISPLAY-HELPER] Pricing display simplified");
    }

    /**
     * Updates the quantity matrix to use grouped sizes
     */
    function updateQuantityMatrix() {
        const quantityMatrix = document.getElementById('quantity-matrix');
        if (!quantityMatrix || !window.nwcaPricingData) return;

        // Check if matrix is already populated
        const existingTable = quantityMatrix.querySelector('table');
        if (!existingTable) return;

        const headerRow = existingTable.querySelector('thead tr');
        if (!headerRow) return;

        // Update headers to show grouped sizes
        const headers = headerRow.querySelectorAll('th');
        if (headers.length <= 1) return; // Only has quantity header

        // Clear existing size headers
        while (headerRow.children.length > 1) {
            headerRow.removeChild(headerRow.lastChild);
        }

        // Add grouped headers
        Object.keys(SIZE_GROUPS).forEach(groupKey => {
            const th = document.createElement('th');
            th.textContent = groupKey;
            headerRow.appendChild(th);
        });

        // Update quantity input rows
        const tbody = existingTable.querySelector('tbody');
        if (!tbody) return;

        const quantityRow = tbody.querySelector('tr');
        if (!quantityRow) return;

        // Clear existing cells except first
        while (quantityRow.cells.length > 1) {
            quantityRow.removeChild(quantityRow.lastCell);
        }

        // Add grouped quantity inputs
        Object.entries(SIZE_GROUPS).forEach(([groupKey, sizes]) => {
            const cell = quantityRow.insertCell();
            
            // Create a container for all sizes in the group
            const container = document.createElement('div');
            container.className = 'size-group-inputs';
            container.style.cssText = 'display: flex; flex-direction: column; gap: 5px;';
            
            sizes.forEach(size => {
                // Check if this size exists in the pricing data
                if (!window.nwcaPricingData.uniqueSizes || 
                    !window.nwcaPricingData.uniqueSizes.includes(size)) {
                    return; // Skip sizes that don't exist for this product
                }
                
                const inputContainer = document.createElement('div');
                inputContainer.className = 'quantity-input-container';
                inputContainer.innerHTML = `
                    <span style="font-size: 0.8em; margin-right: 5px;">${size}:</span>
                    <button class="quantity-btn decrease" data-size="${size}" aria-label="Decrease quantity">-</button>
                    <input type="number" class="quantity-input" value="0" min="0" data-size="${size}">
                    <button class="quantity-btn increase" data-size="${size}" aria-label="Increase quantity">+</button>
                `;
                container.appendChild(inputContainer);
            });
            
            cell.appendChild(container);
        });
    }

    /**
     * Initialize the display helper
     */
    function initialize() {
        console.log("[DTG-DISPLAY-HELPER] Initializing...");
        
        // Listen for pricing data loaded event
        window.addEventListener('pricingDataLoaded', function(event) {
            console.log("[DTG-DISPLAY-HELPER] Pricing data loaded, simplifying display...");
            setTimeout(() => {
                simplifyPricingDisplay();
                updateQuantityMatrix();
            }, 100); // Small delay to ensure DOM is updated
        });

        // Also check if data is already loaded
        if (window.nwcaPricingData && window.nwcaPricingData.prices) {
            setTimeout(() => {
                simplifyPricingDisplay();
                updateQuantityMatrix();
            }, 100);
        }
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }

    // Expose functions globally for debugging
    window.DTGDisplayHelper = {
        simplifyPricingDisplay: simplifyPricingDisplay,
        updateQuantityMatrix: updateQuantityMatrix,
        SIZE_GROUPS: SIZE_GROUPS
    };

})();