// product-quantity-ui.js - Creates the quantity input UI (Matrix or Grid)

console.log("[QUANTITY-UI:LOAD] Product quantity UI creation module loaded.");

(function() {
    "use strict";

    // Function to create the quantity input fields (matrix layout)
    function createQuantityMatrix(sizes) {
        console.log("[QUANTITY-UI] Creating quantity matrix with sizes:", sizes);
        const matrixContainer = document.getElementById('quantity-matrix'); // Target the specific container
        if (!matrixContainer) {
            console.error("[QUANTITY-UI] Quantity matrix container (#quantity-matrix) not found.");
            return false; // Indicate failure
        }

        matrixContainer.innerHTML = ''; // Clear existing content first
        matrixContainer.style.display = 'block'; // Ensure container is visible

        if (!sizes || sizes.length === 0) {
            console.warn('[QUANTITY-UI] No sizes provided to createQuantityMatrix.');
            matrixContainer.innerHTML = '<p>No sizes available.</p>';
            return false; // Indicate failure
        }

        // Create table structure
        const table = document.createElement('table');
        table.className = 'quantity-input-table'; // Add class for styling
        table.style.width = '100%';
        table.style.borderCollapse = 'collapse';
        table.setAttribute('aria-label', 'Product Quantity Input Matrix'); // Accessibility

        const thead = table.createTHead();
        const tbody = table.createTBody();
        const headerRow = thead.insertRow();
        const inputRow = tbody.insertRow(); // Row for inputs
        inputRow.id = 'quantity-input-row'; // Keep ID if needed elsewhere
        const priceRow = tbody.insertRow(); // Row for prices
        priceRow.id = 'price-display-row'; // Keep ID if needed elsewhere

        // Add header cell for the price row label
        const priceHeaderCell = priceRow.insertCell();
        priceHeaderCell.textContent = 'Price:';
        priceHeaderCell.style.fontWeight = 'bold';
        priceHeaderCell.style.textAlign = 'right';
        priceHeaderCell.style.paddingRight = '10px';
        priceHeaderCell.style.border = '1px solid #ddd'; // Style consistency
        priceHeaderCell.style.verticalAlign = 'top';

        // Add header cell for the input row label (optional, could be empty)
        const inputHeaderCell = inputRow.insertCell();
        inputHeaderCell.textContent = 'Qty:'; // Or leave empty: ''
        inputHeaderCell.style.fontWeight = 'bold';
        inputHeaderCell.style.textAlign = 'right';
        inputHeaderCell.style.paddingRight = '10px';
        inputHeaderCell.style.border = '1px solid #ddd'; // Style consistency

        // Add empty header cell for the main header row (aligns with Qty/Price labels)
        const mainHeaderSpacer = document.createElement('th');
        mainHeaderSpacer.setAttribute('scope', 'col'); // Accessibility
        mainHeaderSpacer.style.border = '1px solid #ddd'; // Style consistency
        headerRow.appendChild(mainHeaderSpacer);


        // Populate header, input, and price rows for each size
        sizes.forEach(size => {
            // Header cell
            const th = document.createElement('th');
            th.textContent = size;
            th.setAttribute('scope', 'col'); // Accessibility
            th.style.border = '1px solid #ddd';
            th.style.padding = '8px';
            th.style.textAlign = 'center';
            th.style.backgroundColor = '#f2f2f2';
            headerRow.appendChild(th);

            // Input cell
            const tdInput = inputRow.insertCell();
            tdInput.style.border = '1px solid #ddd';
            tdInput.style.padding = '5px';
            tdInput.style.textAlign = 'center';

            const input = document.createElement('input');
            input.type = 'number';
            input.className = 'quantity-input';
            input.dataset.size = size;
            input.min = '0';
            input.placeholder = '0';
            input.value = ''; // Start empty
            input.setAttribute('aria-label', `Quantity for size ${size}`);
            input.style.width = '50px'; // Adjust width as needed
            input.style.textAlign = 'center';
            tdInput.appendChild(input);

             // Price display cell
             const tdPrice = priceRow.insertCell();
             tdPrice.style.border = '1px solid #ddd';
             tdPrice.style.padding = '5px';
             tdPrice.style.textAlign = 'center';
             tdPrice.style.verticalAlign = 'top'; // Align price info top

             const priceDisplay = document.createElement('div');
             priceDisplay.className = 'price-display'; // Use this class for updates
             priceDisplay.dataset.size = size;
             priceDisplay.textContent = '$0.00'; // Initial placeholder
             priceDisplay.style.fontSize = '0.9em';
             priceDisplay.style.minHeight = '40px'; // Ensure space for price breakdown
             tdPrice.appendChild(priceDisplay);
        });

        matrixContainer.appendChild(table);
        console.log("[QUANTITY-UI] Quantity matrix created successfully.");
        return true; // Indicate success
    }

    // Function to create the quantity input fields (grid layout)
    function createSizeQuantityGrid(sizes) {
         console.log("[QUANTITY-UI] Creating size quantity grid with sizes:", sizes);
        const gridContainer = document.getElementById('size-quantity-grid-container'); // Target the specific container
        if (!gridContainer) {
            console.error("[QUANTITY-UI] Size quantity grid container (#size-quantity-grid-container) not found.");
            return false; // Indicate failure
        }

        gridContainer.innerHTML = ''; // Clear existing content first
        gridContainer.style.display = 'grid'; // Use grid layout
        // Responsive columns: Adjust minmax for desired minimum item width
        gridContainer.style.gridTemplateColumns = 'repeat(auto-fit, minmax(200px, 1fr))';
        gridContainer.style.gap = '15px'; // Space between items

        if (!sizes || sizes.length === 0) {
            console.warn('[QUANTITY-UI] No sizes provided to createSizeQuantityGrid.');
            gridContainer.innerHTML = '<p>No sizes available.</p>';
            return false; // Indicate failure
        }

        sizes.forEach(size => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'size-quantity-item'; // Class for styling individual items
            itemDiv.style.display = 'grid'; // Use grid for item layout
            itemDiv.style.gridTemplateColumns = 'auto 1fr auto'; // Label | Input Control | Price
            itemDiv.style.gap = '10px'; // Space within item
            itemDiv.style.alignItems = 'center';
            itemDiv.style.padding = '10px';
            itemDiv.style.border = '1px solid #eee';
            itemDiv.style.borderRadius = '4px';
            itemDiv.style.backgroundColor = '#f9f9f9';

            // Label
            const label = document.createElement('label');
            const safeSizeIdPart = size.replace(/\W/g, '-'); // Make ID safe for 'for' attribute
            label.textContent = size;
            label.htmlFor = `qty-${safeSizeIdPart}`;
            label.style.fontWeight = 'bold';
            label.style.gridColumn = '1 / 2'; // Place in first column

            // Quantity Control (Input with +/- buttons)
            const quantityControl = document.createElement('div');
            quantityControl.className = 'quantity-control';
            quantityControl.style.display = 'flex';
            quantityControl.style.alignItems = 'center';
            quantityControl.style.justifyContent = 'center'; // Center buttons/input
            quantityControl.style.gridColumn = '2 / 3'; // Place in second column

            const decreaseBtn = document.createElement('button');
            decreaseBtn.type = 'button';
            decreaseBtn.className = 'quantity-btn decrease-btn';
            decreaseBtn.textContent = '-';
            decreaseBtn.setAttribute('aria-label', `Decrease quantity for size ${size}`);
            // Styles applied externally or via CSS

            const input = document.createElement('input');
            input.type = 'number';
            input.id = `qty-${safeSizeIdPart}`;
            input.className = 'quantity-input';
            input.dataset.size = size;
            input.min = '0';
            input.placeholder = '0';
            input.value = ''; // Start empty
            input.setAttribute('aria-label', `Quantity for size ${size}`);
            input.style.margin = '0 5px'; // Space around input
            // Styles applied externally or via CSS

            const increaseBtn = document.createElement('button');
            increaseBtn.type = 'button';
            increaseBtn.className = 'quantity-btn increase-btn';
            increaseBtn.textContent = '+';
            increaseBtn.setAttribute('aria-label', `Increase quantity for size ${size}`);
            // Styles applied externally or via CSS

            quantityControl.appendChild(decreaseBtn);
            quantityControl.appendChild(input);
            quantityControl.appendChild(increaseBtn);

            // Price Display
            const priceDisplay = document.createElement('div');
            priceDisplay.className = 'size-price'; // Use this class for updates
            priceDisplay.dataset.size = size;
            priceDisplay.textContent = '$0.00'; // Initial placeholder
            priceDisplay.style.fontWeight = 'bold';
            priceDisplay.style.textAlign = 'right';
            priceDisplay.style.gridColumn = '3 / 4'; // Place in third column
            priceDisplay.style.minWidth = '60px'; // Ensure some space for price

            // Append elements to itemDiv
            itemDiv.appendChild(label);
            itemDiv.appendChild(quantityControl);
            itemDiv.appendChild(priceDisplay);

            gridContainer.appendChild(itemDiv);
        });

        console.log("[QUANTITY-UI] Size quantity grid created successfully.");
        return true; // Indicate success
    }

    // --- START Cap Embroidery Specific Price Update Logic ---

    /**
     * Finds the relevant price tier from masterData.headers or masterData.tierDefs
     * based on the total quantity.
     * @param {number} totalQuantity - The total quantity of items.
     * @param {Array<string|Object>} headers - The tier headers (e.g., ["1-11", "12-23", "24+"] or [{label: "1-11", min:1, max:11}, ...]).
     * @returns {string|null} The key/label of the correct price tier, or null if not found.
     */
    function getPriceTierForQuantity(totalQuantity, headers) {
        if (!headers || headers.length === 0) return null;

        for (const header of headers) {
            let tierLabel;
            let minQty, maxQty;

            if (typeof header === 'string') {
                tierLabel = header;
                const parts = header.split('-');
                minQty = parseInt(parts[0], 10);
                if (parts.length > 1) {
                    maxQty = parseInt(parts[1], 10);
                } else if (header.endsWith('+')) {
                    maxQty = Infinity;
                } else { // Single number tier
                    maxQty = minQty;
                }
            } else if (typeof header === 'object' && header.label) { // For tierDefs like {label: "1-11", priceField: "Tier1", min: 1, max: 11}
                tierLabel = header.priceField || header.label; // Prefer priceField if available, fallback to label
                minQty = header.min !== undefined ? parseInt(header.min, 10) : parseInt(header.label.split('-')[0], 10);
                maxQty = header.max !== undefined ? parseInt(header.max, 10) : (header.label.includes('-') ? parseInt(header.label.split('-')[1], 10) : (header.label.endsWith('+') ? Infinity : minQty));
            } else {
                continue; // Skip malformed header
            }

            if (isNaN(minQty)) continue;
            if (isNaN(maxQty)) maxQty = Infinity; // If maxQty is not parsed, assume it's an open-ended tier like "24+"

            if (totalQuantity >= minQty && totalQuantity <= maxQty) {
                return tierLabel;
            }
        }
        // If no tier matched exactly, try to find the closest one (e.g. if qty is 0, it might not match "1-11")
        // For simplicity, if totalQuantity is less than the first tier's min, use the first tier.
        // Or, if it's greater than the last tier's max, use the last tier.
        // This part might need refinement based on exact business rules for quantities outside defined tiers.
        if (totalQuantity > 0 && headers.length > 0) {
            let firstTierLabel, firstTierMin;
            const firstHeader = headers[0];
            if (typeof firstHeader === 'string') {
                firstTierLabel = firstHeader;
                firstTierMin = parseInt(firstHeader.split('-')[0], 10);
            } else if (typeof firstHeader === 'object' && firstHeader.label) {
                firstTierLabel = firstHeader.priceField || firstHeader.label;
                firstTierMin = firstHeader.min !== undefined ? parseInt(firstHeader.min, 10) : parseInt(firstHeader.label.split('-')[0], 10);
            }
            if (totalQuantity < firstTierMin) return firstTierLabel;


            let lastTierLabel, lastTierMax;
            const lastHeader = headers[headers.length - 1];
             if (typeof lastHeader === 'string') {
                lastTierLabel = lastHeader;
                const parts = lastHeader.split('-');
                if (parts.length > 1) lastTierMax = parseInt(parts[1], 10);
                else if (lastHeader.endsWith('+')) lastTierMax = Infinity;
                else lastTierMax = parseInt(parts[0], 10);
            } else if (typeof lastHeader === 'object' && lastHeader.label) {
                lastTierLabel = lastHeader.priceField || lastHeader.label;
                const parts = lastHeader.label.split('-');
                if (lastHeader.max !== undefined) lastTierMax = parseInt(lastHeader.max, 10);
                else if (parts.length > 1) lastTierMax = parseInt(parts[1], 10);
                else if (lastHeader.label.endsWith('+')) lastTierMax = Infinity;
                else lastTierMax = parseInt(parts[0], 10);
            }
            if (totalQuantity > lastTierMax && lastTierMax !== Infinity) return lastTierLabel;
        }


        return null; // No matching tier found
    }

    /**
     * Formats a numeric price into a string like $X.XX.
     * @param {string|number} price - The price to format.
     * @returns {string} Formatted price string or 'N/A'.
     */
    function formatPrice(price) {
        const num = parseFloat(price);
        if (isNaN(num)) {
            return 'N/A';
        }
        return '$' + num.toFixed(2);
    }


    /**
     * Updates the unit price display for cap embroidery items in the quantity UI.
     * This is typically called when stitch count or quantity changes.
     */
    function updateCapEmbroideryItemUnitPrices() {
        const stitchCountSelect = document.getElementById('client-stitch-count-select');
        // Only run if stitch count select exists (i.e., on cap embroidery page)
        // and master data is loaded.
        if (!stitchCountSelect || !window.capEmbroideryMasterData || !window.capEmbroideryMasterData.profile || !window.capEmbroideryMasterData.profile.pricing) {
            // console.log("[QUANTITY-UI:CAP-EMB] Stitch count select or master data not ready. Skipping unit price update.");
            return;
        }

        const selectedStitchCount = stitchCountSelect.value;
        const masterData = window.capEmbroideryMasterData;

        // Find the pricing data for the selected stitch count
        const stitchCountFieldNames = ['Stitch_Count', 'Stitches', 'stitch_count', 'Embroidery_Stitch_Count'];
        let pricingDataForStitchCount = null;
        for (const record of masterData.profile.pricing) {
            for (const fieldName of stitchCountFieldNames) {
                if (record[fieldName] && record[fieldName].toString() === selectedStitchCount) {
                    pricingDataForStitchCount = record;
                    break;
                }
            }
            if (pricingDataForStitchCount) break;
        }

        if (!pricingDataForStitchCount) {
            console.warn(`[QUANTITY-UI:CAP-EMB] No pricing data found for stitch count: ${selectedStitchCount}. Unit prices will not be updated.`);
            // Clear or set prices to N/A
            document.querySelectorAll('.price-display, .size-price, .dynamic-unit-price').forEach(el => el.textContent = 'N/A');
            return;
        }

        // Calculate total quantity
        let totalQuantity = 0;
        document.querySelectorAll('.quantity-input').forEach(input => {
            const qty = parseInt(input.value, 10);
            if (!isNaN(qty) && qty > 0) {
                totalQuantity += qty;
            }
        });

        // Determine the correct price tier based on total quantity
        const headers = masterData.headers || (masterData.tierDefs ? masterData.tierDefs : []); // Use tierDefs directly if headers is not primary
        const priceTierKey = getPriceTierForQuantity(totalQuantity, headers);

        let unitPrice = 'N/A';
        if (priceTierKey && pricingDataForStitchCount[priceTierKey]) {
            unitPrice = formatPrice(pricingDataForStitchCount[priceTierKey]);
        } else if (totalQuantity === 0) {
            unitPrice = formatPrice(0); // Or keep as N/A, or show first tier price
        } else {
            console.warn(`[QUANTITY-UI:CAP-EMB] Could not determine price tier for total quantity: ${totalQuantity} with key: ${priceTierKey}. Using N/A.`);
        }

        // Update all unit price displays
        // These selectors target price displays in both matrix and grid layouts, and the add-to-cart section
        document.querySelectorAll('.price-display, .size-price, .dynamic-unit-price').forEach(priceEl => {
            // For cap embroidery, all sizes get the same unit price based on total quantity and selected stitch count.
            // The `size` dataset on priceEl is not used here to differentiate price, as it's uniform.
            priceEl.textContent = unitPrice;
        });
        // console.log(`[QUANTITY-UI:CAP-EMB] Unit prices updated to ${unitPrice} for stitch count ${selectedStitchCount} and total qty ${totalQuantity}. Tier key: ${priceTierKey}`);
    }


    function setupCapEmbroideryEventListeners() {
        const stitchCountSelect = document.getElementById('client-stitch-count-select');
        if (stitchCountSelect) {
            stitchCountSelect.addEventListener('change', updateCapEmbroideryItemUnitPrices);
            // console.log("[QUANTITY-UI:CAP-EMB] Event listener for stitch count dropdown attached for unit price updates.");

            // Also listen to quantity changes
            document.querySelectorAll('.quantity-input').forEach(input => {
                input.addEventListener('input', updateCapEmbroideryItemUnitPrices);
                input.addEventListener('change', updateCapEmbroideryItemUnitPrices); // For spinners or direct entry
            });
            // console.log("[QUANTITY-UI:CAP-EMB] Event listeners for quantity inputs attached for unit price updates.");

            // Initial call in case data is already loaded and quantities pre-filled
            // Ensure master data is available before calling
            if (window.capEmbroideryMasterData) {
                 updateCapEmbroideryItemUnitPrices();
            }
        }
    }

    // Listen for the event that signals cap embroidery master data is ready
    document.addEventListener('caspioCapPricingCalculated', function(event) {
        if (event.detail && event.detail.success && window.capEmbroideryMasterData) {
            // console.log("[QUANTITY-UI:CAP-EMB] Received 'caspioCapPricingCalculated', attempting to update unit prices.");
            updateCapEmbroideryItemUnitPrices(); // Update prices now that data is confirmed
        }
    });


    // Call setup when the DOM is ready, specifically for cap embroidery enhancements
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupCapEmbroideryEventListeners);
    } else {
        // DOMContentLoaded has already fired
        setupCapEmbroideryEventListeners();
    }

    // --- END Cap Embroidery Specific Price Update Logic ---


    // Expose public API
    window.ProductQuantityUI = {
        createQuantityMatrix: createQuantityMatrix,
        createSizeQuantityGrid: createSizeQuantityGrid,
        updateCapEmbroideryItemUnitPrices: updateCapEmbroideryItemUnitPrices // Expose if needed externally
    };

})();