// static/js/cap-embroidery-pricing-logic.js (Event-Driven for Option B)
document.addEventListener('DOMContentLoaded', () => {
    const stitchCountSelectExt = document.getElementById('cap-stitch-count-select');
    const pricingTableContainerExt = document.getElementById('cap-pricing-table-container');
    const quantityInputExt = document.getElementById('cap-quantity');
    const addToCartButtonExt = document.getElementById('add-to-cart-button'); // Changed ID here
    const selectedPriceDisplayExt = document.getElementById('cap-selected-price-display');

    // Stitch counts for our external dropdown - should match options in Caspio's internal dropdown
    // if you want their labels to be identical. The 'value' must match what Caspio expects.
    const STITCH_OPTIONS = [
        { label: "5,000 Stitches (Low)", value: "5000" },
        { label: "7,000 Stitches", value: "7000" }, 
        { label: "8,000 Stitches (Standard)", value: "8000" },
        { label: "10,000 Stitches (High)", value: "10000" },
        { label: "12,000 Stitches", value: "12000" } 
    ];
    // Filter STITCH_OPTIONS if not all are supported by Caspio's logic/APIs
    // For example, if Caspio's internal dropdown only has 5k, 8k, 10k:
    // const activeStitchOptions = STITCH_OPTIONS.filter(opt => ["5000", "8000", "10000"].includes(opt.value));
    const activeStitchOptions = STITCH_OPTIONS; // Assuming all are supported for now

    let currentExternalStitchValue = activeStitchOptions.find(opt => opt.value === "8000")?.value || (activeStitchOptions.length > 0 ? activeStitchOptions[0].value : "");

    // Store data received from Caspio event
    let caspioCalculatedData = {
        profiles: null,
        groupedHeaders: null,
        groupedPrices: null,
        tierInfo: null // We'll get this from window.dp7ApiTierData
    };

    function populateExternalStitchDropdown() {
        if (!stitchCountSelectExt) return;
        stitchCountSelectExt.innerHTML = '';
        activeStitchOptions.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt.value;
            option.textContent = opt.label;
            stitchCountSelectExt.appendChild(option);
        });
        if (currentExternalStitchValue) {
            stitchCountSelectExt.value = currentExternalStitchValue;
        } else if (activeStitchOptions.length > 0) {
            currentExternalStitchValue = activeStitchOptions[0].value; // Fallback to first if default not found
            stitchCountSelectExt.value = currentExternalStitchValue;
        }
    }

    function renderExternalPricingTable() {
        if (!pricingTableContainerExt) return;

        const { profiles, groupedHeaders, groupedPrices } = caspioCalculatedData;
        const tierInfo = window.dp7ApiTierData; // Get tier definitions

        // console.log("External Render: Profiles:", profiles, "Headers:", groupedHeaders, "Grouped Prices:", groupedPrices, "TierInfo:", tierInfo);

        if (!profiles || !groupedHeaders || !groupedPrices || !tierInfo || Object.keys(tierInfo).length === 0) {
            pricingTableContainerExt.innerHTML = '<p>Pricing data not yet fully available from Caspio engine.</p>';
            updateExternalSelectedPriceDisplay(null);
            return;
        }
        
        if (groupedHeaders.length === 0 && Object.keys(groupedPrices).length === 0) {
             pricingTableContainerExt.innerHTML = '<p>No pricing information available for this selection.</p>';
             updateExternalSelectedPriceDisplay(null);
             return;
        }

        const displayHeaders = groupedHeaders.length > 0 ? groupedHeaders : (Object.keys(groupedPrices).length > 0 ? Object.keys(groupedPrices) : ["Price"]);
        const sortedQuantityTiers = Object.keys(tierInfo).sort((a, b) => tierInfo[a].MinQuantity - tierInfo[b].MinQuantity);
            
        // Add .matrix-price-table class for compatibility with pricing-matrix-capture.js
        let tableHTML = '<table class="matrix-price-table pricing-matrix-table cap-pricing-matrix-table">';
        tableHTML += '<thead><tr><th>Quantity Tier</th>'; // Ensure thead is explicit
        displayHeaders.forEach(header => {
            tableHTML += `<th>${header}</th>`;
        });
        tableHTML += '</tr></thead><tbody>';

        if (sortedQuantityTiers.length === 0) {
             tableHTML += '<tr><td colspan="' + (displayHeaders.length + 1) + '">No quantity tiers defined.</td></tr>';
        } else {
            sortedQuantityTiers.forEach(tierLabel => {
                tableHTML += `<tr><td>${formatTierLabelWithLTM(tierInfo[tierLabel], tierLabel)}</td>`;
                displayHeaders.forEach(headerText => {
                    const priceProfileForHeader = groupedPrices[headerText];
                    let displayText = '-';
                    if (priceProfileForHeader && priceProfileForHeader[tierLabel] !== undefined && priceProfileForHeader[tierLabel] !== null) {
                        displayText = '$' + parseFloat(priceProfileForHeader[tierLabel]).toFixed(2);
                    }
                    tableHTML += `<td>${displayText}</td>`;
                });
                tableHTML += '</tr>';
            });
        }
        tableHTML += '</tbody></table>';
        pricingTableContainerExt.innerHTML = tableHTML;
        updateExternalSelectedPriceDisplay(); 
    }
    
    function formatTierLabelWithLTM(currentTierData, tierLabel) {
        if (currentTierData && currentTierData.LTM_Fee && currentTierData.LTM_Fee > 0) {
            const feeText = currentTierData.LTM_Fee.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
            return `${tierLabel}*<br><span style="font-size:0.8em; font-weight:normal; color:red;">(${feeText} LTM)</span>`;
        }
        return tierLabel;
    }

    function getExternalPriceForQuantity(stitchValueForLookup, quantity, capSizeHeader) {
        const { groupedHeaders, groupedPrices } = caspioCalculatedData;
        const tierInfo = window.dp7ApiTierData;

        if (!groupedHeaders || !groupedPrices || !tierInfo || Object.keys(tierInfo).length === 0) return null;
        if (quantity < 1) return null;

        const targetSizeHeaderKey = capSizeHeader || (groupedHeaders.length > 0 ? groupedHeaders[0] : null); 
        if (!targetSizeHeaderKey) return null;
        
        const priceProfileForSize = groupedPrices[targetSizeHeaderKey];
        if (!priceProfileForSize) return null;

        const sortedQuantityTiers = Object.keys(tierInfo).sort((a, b) => tierInfo[a].MinQuantity - tierInfo[b].MinQuantity);
        let matchedPrice = null;

        for (const tierLabel of sortedQuantityTiers) {
            const currentTierDef = tierInfo[tierLabel];
            let minQty = currentTierDef.MinQuantity;
            let maxQty = currentTierDef.MaxQuantity !== null ? currentTierDef.MaxQuantity : Infinity;

            if (quantity >= minQty && quantity <= maxQty) {
                if (priceProfileForSize[tierLabel] !== undefined && priceProfileForSize[tierLabel] !== null) {
                    matchedPrice = parseFloat(priceProfileForSize[tierLabel]);
                }
                break;
            }
        }
        return matchedPrice;
    }

    function updateExternalSelectedPriceDisplay() {
        if (!selectedPriceDisplayExt || !quantityInputExt || !currentExternalStitchValue) return;
        const quantity = parseInt(quantityInputExt.value, 10);

        if (isNaN(quantity) || quantity < 1) {
            selectedPriceDisplayExt.textContent = 'Please enter a valid quantity.';
            return;
        }
        const capSizeForPricing = caspioCalculatedData.groupedHeaders && caspioCalculatedData.groupedHeaders.length > 0 ? caspioCalculatedData.groupedHeaders[0] : "OSFA";
        const unitPrice = getExternalPriceForQuantity(currentExternalStitchValue, quantity, capSizeForPricing);

        if (unitPrice !== null) {
            const totalPrice = unitPrice * quantity;
            selectedPriceDisplayExt.textContent = 
                `Selected: ${quantity} x $${unitPrice.toFixed(2)}/cap = $${totalPrice.toFixed(2)}`;
        } else {
            selectedPriceDisplayExt.textContent = 'Price not available for this quantity.';
        }
    }
    
    // Listener for when Caspio finishes its calculations
    document.addEventListener('caspioCapPricingCalculated', (event) => {
        console.log("External JS: Received 'caspioCapPricingCalculated' event.", event.detail);
        if (event.detail && event.detail.success) {
            caspioCalculatedData.profiles = event.detail.profiles;
            caspioCalculatedData.groupedHeaders = event.detail.groupedHeaders;
            caspioCalculatedData.groupedPrices = event.detail.groupedPrices;
            // tierInfo is already global via window.dp7ApiTierData, confirmed by Caspio scripts
            
            // Ensure the currentExternalStitchValue matches what Caspio calculated for,
            // especially on initial load.
            if (event.detail.stitchCount && stitchCountSelectExt.value !== event.detail.stitchCount) {
                console.log(`External JS: Aligning external dropdown to Caspio's calculated stitch count: ${event.detail.stitchCount}`);
                currentExternalStitchValue = event.detail.stitchCount;
                stitchCountSelectExt.value = currentExternalStitchValue;
            }
            renderExternalPricingTable();
            updateExternalSelectedPriceDisplay();
        } else {
            console.error("External JS: Caspio calculation reported an error or no data.");
            if(pricingTableContainerExt) pricingTableContainerExt.innerHTML = "<p>Error loading pricing from Caspio engine.</p>";
        }
    });

    if (stitchCountSelectExt) {
        stitchCountSelectExt.addEventListener('change', (event) => {
            currentExternalStitchValue = event.target.value;
            console.log("External dropdown changed to:", currentExternalStitchValue);
            if (typeof window.updateCaspioCapPricingForStitchCount === 'function') {
                if(pricingTableContainerExt) pricingTableContainerExt.innerHTML = '<div class="loading-message">Updating prices for new stitch count...</div>';
                window.updateCaspioCapPricingForStitchCount(currentExternalStitchValue);
                // Now we wait for the 'caspioCapPricingCalculated' event
            } else {
                console.error("External JS: window.updateCaspioCapPricingForStitchCount is not defined by Caspio page.");
            }
        });
    }

    if (quantityInputExt) {
        quantityInputExt.addEventListener('input', updateExternalSelectedPriceDisplay);
    }

    if (addToCartButtonExt) {
        addToCartButtonExt.addEventListener('click', () => {
            const stitchOption = activeStitchOptions.find(opt => opt.value === currentExternalStitchValue);
            const selectedStitchLabel = stitchOption ? stitchOption.label : "N/A";
            const quantity = parseInt(quantityInputExt.value, 10);
            const capSizeForCart = caspioCalculatedData.groupedHeaders && caspioCalculatedData.groupedHeaders.length > 0 ? caspioCalculatedData.groupedHeaders[0] : "OSFA";
            const unitPrice = getExternalPriceForQuantity(currentExternalStitchValue, quantity, capSizeForCart);

            if (!currentExternalStitchValue) { alert('Please select a stitch count.'); return; }
            if (isNaN(quantity) || quantity < 1) { alert('Please enter a valid quantity.'); return; }
            if (unitPrice === null) { alert('Pricing is not available. Please check quantity.'); return; }

            const cartItem = {
                productId: document.getElementById('product-style')?.textContent.trim() || 'CAP_PRODUCT_ID_FALLBACK', 
                productName: document.getElementById('product-title')?.textContent.trim() || 'Custom Cap Fallback', 
                stitchCount: selectedStitchLabel,
                size: capSizeForCart, 
                quantity: quantity,
                unitPrice: unitPrice,
                totalPrice: unitPrice * quantity,
                embellishmentType: "cap-embroidery"
            };
            console.log('Adding to cart (External):', cartItem);
            
            if (typeof NWCACart !== 'undefined' && typeof NWCACart.addItem === 'function') {
                NWCACart.addItem(cartItem);
                 alert('Item added to your cart!');
            } else {
                console.error('NWCACart or NWCACart.addItem function is not available.');
                 alert('Cart system not available. Item not added. (Simulated add)');
            }
        });
    }

    // Initial setup
    populateExternalStitchDropdown();
    
    // The Caspio DataPage will dispatch 'caspioCapPricingCalculated' on its initial 'DataPageReady'
    // after its first calculation (for the default 8000 stitches).
    // So, no explicit initial call to render is needed here, we just wait for the event.
    if(pricingTableContainerExt) pricingTableContainerExt.innerHTML = '<div class="loading-message">Initializing pricing engine...</div>';
    console.log("External JS: Initialized. Waiting for Caspio's 'DataPageReady' and then 'caspioCapPricingCalculated' event.");

});