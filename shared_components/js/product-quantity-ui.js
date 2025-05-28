// product-quantity-ui.js - Creates the quantity input UI (Matrix or Grid)

console.log("[QUANTITY-UI:LOAD] Product quantity UI creation module loaded.");

(function() {
    "use strict";

    // Function to create the quantity input fields (matrix layout)
    function createQuantityMatrix(sizes) {
        console.log("[QUANTITY-UI] Creating quantity matrix with sizes:", sizes);
        const matrixContainer = document.getElementById('quantity-matrix');
        if (!matrixContainer) {
            console.error("[QUANTITY-UI] Quantity matrix container (#quantity-matrix) not found.");
            return false;
        }

        matrixContainer.innerHTML = '';
        matrixContainer.style.display = 'block';

        if (!sizes || sizes.length === 0) {
            console.warn('[QUANTITY-UI] No sizes provided to createQuantityMatrix.');
            matrixContainer.innerHTML = '<p>No sizes available.</p>';
            return false;
        }

        // Create table structure matching the mockup exactly
        const table = document.createElement('table');
        table.className = 'quantity-input-table';
        table.style.width = '100%';
        table.style.borderCollapse = 'collapse';
        table.style.tableLayout = 'fixed';
        table.setAttribute('aria-label', 'Product Quantity Input Matrix');

        const tbody = table.createTBody();
        
        // Row 1: Size headers (S/M, M/L, L/XL)
        const headerRow = tbody.insertRow();
        headerRow.className = 'size-header-row';
        
        // Empty cell for label column
        const headerLabelCell = headerRow.insertCell();
        headerLabelCell.style.border = '1px solid #ddd';
        headerLabelCell.style.width = '80px';
        headerLabelCell.style.maxWidth = '80px';
        headerLabelCell.style.backgroundColor = '#f2f2f2';
        
        // Size header cells
        sizes.forEach(size => {
            const th = headerRow.insertCell();
            th.textContent = size;
            th.style.border = '1px solid #ddd';
            th.style.padding = '8px';
            th.style.textAlign = 'center';
            th.style.backgroundColor = '#f2f2f2';
            th.style.fontWeight = 'bold';
            th.style.width = '120px';
            th.style.maxWidth = '120px';
        });

        // Row 2: "Qty:" label + quantity inputs (1, 1, 1) under each size
        const quantityRow = tbody.insertRow();
        quantityRow.className = 'quantity-input-row';
        quantityRow.id = 'quantity-input-row';
        
        // Qty label cell
        const qtyLabelCell = quantityRow.insertCell();
        qtyLabelCell.textContent = 'Qty:';
        qtyLabelCell.style.fontWeight = 'bold';
        qtyLabelCell.style.textAlign = 'right';
        qtyLabelCell.style.paddingRight = '10px';
        qtyLabelCell.style.border = '1px solid #ddd';
        qtyLabelCell.style.backgroundColor = '#f8f9fa';
        qtyLabelCell.style.verticalAlign = 'middle';
        
        // Quantity input cells
        sizes.forEach(size => {
            const tdInput = quantityRow.insertCell();
            tdInput.style.border = '1px solid #ddd';
            tdInput.style.padding = '5px';
            tdInput.style.textAlign = 'center';
            tdInput.style.backgroundColor = '#fff';

            const input = document.createElement('input');
            input.type = 'number';
            input.className = 'quantity-input';
            input.dataset.size = size;
            input.min = '0';
            input.placeholder = '1';
            input.value = '1'; // Default to 1 as shown in mockup
            input.setAttribute('aria-label', `Quantity for size ${size}`);
            input.style.width = '50px';
            input.style.textAlign = 'center';
            input.style.border = '1px solid #ccc';
            input.style.borderRadius = '4px';
            input.style.padding = '4px';
            tdInput.appendChild(input);
        });

        // Row 3: "Price:" label + pricing boxes under each size
        const priceRow = tbody.insertRow();
        priceRow.className = 'price-display-row';
        priceRow.id = 'price-box-row';
        
        // Price label cell
        const priceLabelCell = priceRow.insertCell();
        priceLabelCell.textContent = 'Price:';
        priceLabelCell.style.fontWeight = 'bold';
        priceLabelCell.style.textAlign = 'right';
        priceLabelCell.style.paddingRight = '10px';
        priceLabelCell.style.border = '1px solid #ddd';
        priceLabelCell.style.backgroundColor = '#f8f9fa';
        priceLabelCell.style.verticalAlign = 'top';
        
        // Pricing box cells
        sizes.forEach(size => {
            const tdPriceBox = priceRow.insertCell();
            tdPriceBox.style.border = '1px solid #ddd';
            tdPriceBox.style.padding = '4px';
            tdPriceBox.style.textAlign = 'center';
            tdPriceBox.style.verticalAlign = 'top';
            tdPriceBox.style.width = '120px';
            tdPriceBox.style.maxWidth = '120px';
            tdPriceBox.className = 'price-display has-breakdown';
            tdPriceBox.dataset.size = size;

            // Create the pricing box matching the mockup
            const pricingBox = document.createElement('div');
            pricingBox.className = 'price-breakdown-card ltm-active';
            pricingBox.dataset.size = size;
            pricingBox.style.width = '100%';
            pricingBox.style.maxWidth = '110px';
            pricingBox.style.margin = '0 auto';
            pricingBox.style.fontSize = '0.75em';
            pricingBox.style.border = '1px solid #ddd';
            pricingBox.style.borderRadius = '4px';
            pricingBox.style.overflow = 'hidden';

            // Header: "LTM Fee Applied" (blue background)
            const header = document.createElement('div');
            header.className = 'price-breakdown-header';
            header.textContent = 'LTM Fee Applied';
            header.style.backgroundColor = '#17a2b8';
            header.style.color = 'white';
            header.style.fontWeight = 'bold';
            header.style.padding = '4px';
            header.style.textAlign = 'center';
            header.style.fontSize = '0.8em';
            pricingBox.appendChild(header);

            // Base price row
            const baseRow = document.createElement('div');
            baseRow.className = 'price-breakdown-row';
            baseRow.innerHTML = '<span>Base:</span><span>$24.00</span>';
            baseRow.style.display = 'flex';
            baseRow.style.justifyContent = 'space-between';
            baseRow.style.padding = '2px 4px';
            baseRow.style.borderBottom = '1px solid #f0f0f0';
            baseRow.style.backgroundColor = '#e8f4ff';
            pricingBox.appendChild(baseRow);

            // LTM fee row
            const ltmRow = document.createElement('div');
            ltmRow.className = 'price-breakdown-row';
            ltmRow.innerHTML = '<span>LTM:</span><span>+$16.67</span>';
            ltmRow.style.display = 'flex';
            ltmRow.style.justifyContent = 'space-between';
            ltmRow.style.padding = '2px 4px';
            ltmRow.style.borderBottom = '1px solid #f0f0f0';
            ltmRow.style.backgroundColor = '#e8f4ff';
            pricingBox.appendChild(ltmRow);

            // Unit price row
            const unitRow = document.createElement('div');
            unitRow.className = 'price-breakdown-row unit-price';
            unitRow.innerHTML = '<span>Unit:</span><span>$40.67</span>';
            unitRow.style.display = 'flex';
            unitRow.style.justifyContent = 'space-between';
            unitRow.style.padding = '2px 4px';
            unitRow.style.borderBottom = '1px solid #f0f0f0';
            unitRow.style.backgroundColor = '#e8f4ff';
            unitRow.style.fontWeight = 'bold';
            pricingBox.appendChild(unitRow);

            // Total row
            const totalRow = document.createElement('div');
            totalRow.className = 'price-breakdown-row total-price';
            totalRow.innerHTML = '<span>Total (1):</span><span>$40.67</span>';
            totalRow.style.display = 'flex';
            totalRow.style.justifyContent = 'space-between';
            totalRow.style.padding = '2px 4px';
            totalRow.style.backgroundColor = 'rgba(0,0,0,0.03)';
            totalRow.style.fontWeight = 'bold';
            totalRow.style.fontSize = '1.05em';
            pricingBox.appendChild(totalRow);

            // Add the pricing box to the cell
            tdPriceBox.appendChild(pricingBox);
            
            console.log(`[ProductQuantityUI] Created pricing box for size: ${size}, data-size: ${pricingBox.dataset.size}`);
        });

        matrixContainer.appendChild(table);
        console.log("[QUANTITY-UI] Quantity matrix created successfully with mockup layout.");
        return true;
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
            // Clear or set prices to N/A for the new pricing box structure
            document.querySelectorAll('.price-breakdown-card').forEach(card => {
                const baseSpan = card.querySelector('.price-breakdown-row:nth-child(2) span:last-child');
                const ltmSpan = card.querySelector('.price-breakdown-row:nth-child(3) span:last-child');
                const unitSpan = card.querySelector('.price-breakdown-row:nth-child(4) span:last-child');
                const totalSpan = card.querySelector('.price-breakdown-row:nth-child(5) span:last-child');
                if (baseSpan) baseSpan.textContent = 'N/A';
                if (ltmSpan) ltmSpan.textContent = 'N/A';
                if (unitSpan) unitSpan.textContent = 'N/A';
                if (totalSpan) totalSpan.textContent = 'N/A';
            });
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

        let basePrice = 0;
        let ltmFee = 0;
        let unitPrice = 0;
        
        if (priceTierKey && pricingDataForStitchCount[priceTierKey]) {
            basePrice = parseFloat(pricingDataForStitchCount[priceTierKey]) || 0;
            // Check if LTM fee applies (typically for small quantities)
            if (totalQuantity > 0 && totalQuantity < 12) { // Assuming LTM applies for quantities under 12
                ltmFee = 16.67; // Example LTM fee
                unitPrice = basePrice + ltmFee;
            } else {
                ltmFee = 0;
                unitPrice = basePrice;
            }
        } else if (totalQuantity === 0) {
            // Show default pricing for first tier when no quantity is selected
            const firstTierKey = headers.length > 0 ? (typeof headers[0] === 'string' ? headers[0] : headers[0].label || headers[0].priceField) : null;
            if (firstTierKey && pricingDataForStitchCount[firstTierKey]) {
                basePrice = parseFloat(pricingDataForStitchCount[firstTierKey]) || 0;
                ltmFee = 16.67; // Assume LTM for display purposes
                unitPrice = basePrice + ltmFee;
            }
        } else {
            console.warn(`[QUANTITY-UI:CAP-EMB] Could not determine price tier for total quantity: ${totalQuantity} with key: ${priceTierKey}. Using default values.`);
            basePrice = 24.00; // Default fallback
            ltmFee = 16.67;
            unitPrice = basePrice + ltmFee;
        }

        // Update each pricing box with the calculated values
        document.querySelectorAll('.price-breakdown-card').forEach(card => {
            const size = card.dataset.size;
            if (!size) return;

            // Get the quantity for this specific size
            const sizeInput = document.querySelector(`.quantity-input[data-size="${size}"]`);
            const sizeQuantity = sizeInput ? parseInt(sizeInput.value, 10) || 1 : 1;

            // Update header based on LTM status
            const header = card.querySelector('.price-breakdown-header');
            if (header) {
                if (ltmFee > 0) {
                    header.textContent = 'LTM Fee Applied';
                    header.style.backgroundColor = '#17a2b8'; // Blue for LTM
                    card.className = 'price-breakdown-card ltm-active';
                } else {
                    header.textContent = 'Standard Pricing';
                    header.style.backgroundColor = '#6c757d'; // Gray for standard
                    card.className = 'price-breakdown-card standard';
                }
            }

            // Update base price
            const baseSpan = card.querySelector('.price-breakdown-row:nth-child(2) span:last-child');
            if (baseSpan) baseSpan.textContent = formatPrice(basePrice);

            // Update LTM fee
            const ltmSpan = card.querySelector('.price-breakdown-row:nth-child(3) span:last-child');
            if (ltmSpan) {
                if (ltmFee > 0) {
                    ltmSpan.textContent = `+${formatPrice(ltmFee)}`;
                } else {
                    ltmSpan.textContent = '$0.00';
                }
            }

            // Update unit price
            const unitSpan = card.querySelector('.price-breakdown-row:nth-child(4) span:last-child');
            if (unitSpan) unitSpan.textContent = formatPrice(unitPrice);

            // Update total price (unit price × quantity for this size)
            const totalSpan = card.querySelector('.price-breakdown-row:nth-child(5) span:last-child');
            const totalRow = card.querySelector('.price-breakdown-row:nth-child(5)');
            if (totalSpan && totalRow) {
                const sizeTotal = unitPrice * sizeQuantity;
                totalSpan.textContent = formatPrice(sizeTotal);
                // Update the label to show the quantity
                const totalLabel = totalRow.querySelector('span:first-child');
                if (totalLabel) totalLabel.textContent = `Total (${sizeQuantity}):`;
            }
        });
        
        // Also update other price displays (grid layout and add-to-cart section) for compatibility
        document.querySelectorAll('.size-price:not(.price-breakdown-card), .dynamic-unit-price').forEach(priceEl => {
            priceEl.textContent = formatPrice(unitPrice);
        });
        
        console.log(`[QUANTITY-UI:CAP-EMB] Pricing boxes updated - Base: ${formatPrice(basePrice)}, LTM: ${formatPrice(ltmFee)}, Unit: ${formatPrice(unitPrice)} for stitch count ${selectedStitchCount} and total qty ${totalQuantity}. Tier key: ${priceTierKey}`);
    }


    function setupCapEmbroideryEventListeners() {
        const stitchCountSelect = document.getElementById('client-stitch-count-select');
        if (stitchCountSelect) {
            stitchCountSelect.addEventListener('change', updateCapEmbroideryItemUnitPrices);
            // console.log("[QUANTITY-UI:CAP-EMB] Event listener for stitch count dropdown attached for unit price updates.");

            // Also listen to quantity changes - use event delegation for dynamically created inputs
            document.addEventListener('input', function(event) {
                if (event.target.classList.contains('quantity-input')) {
                    updateCapEmbroideryItemUnitPrices();
                }
            });
            
            document.addEventListener('change', function(event) {
                if (event.target.classList.contains('quantity-input')) {
                    updateCapEmbroideryItemUnitPrices();
                }
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