// Enhanced Cap Embroidery functionality with stitch count validation and back logo support
(function() {
    'use strict';

    console.log('[CAP-EMB-ENHANCED] Initializing enhanced cap embroidery features');

    // Constants for back logo pricing
    const BACK_LOGO_PRICE_PER_1000_STITCHES = 1.00;
    const BACK_LOGO_MINIMUM_STITCHES = 5000;
    const BACK_LOGO_MINIMUM_CHARGE = 5.00;

    // Initialize when DOM is ready
    function initialize() {
        console.log('[CAP-EMB-ENHANCED] DOM ready, attempting to initialize UI enhancements immediately...');
            
        try {
            // Add back logo UI - DISABLED: Using new independent back logo add-on system instead
            // addBackLogoOption();
        } catch (error) {
            console.error('[CAP-EMB-ENHANCED] Error adding back logo option:', error);
        }
        
        try {
            // Enhance stitch count selector
            enhanceStitchCountSelector();
        } catch (error) {
            console.error('[CAP-EMB-ENHANCED] Error enhancing stitch count selector:', error);
        }
        
        try {
            // Add validation hooks
            addValidationHooks();
        } catch (error) {
            console.error('[CAP-EMB-ENHANCED] Error adding validation hooks:', error);
        }
        
        try {
            // Listen for stitch count changes
            setupStitchCountListener();
        } catch (error) {
            console.error('[CAP-EMB-ENHANCED] Error setting up stitch count listener:', error);
        }
    }

    // Add back logo option UI
    function addBackLogoOption() {
        console.log('[CAP-EMB-ENHANCED] Attempting to add back logo option UI elements.');
        
        // Create back logo option container
        const backLogoContainer = document.createElement('div');
        backLogoContainer.className = 'back-logo-option';
        backLogoContainer.style.cssText = `
            display: flex;
            align-items: center;
            gap: 15px;
            padding: 12px 15px;
            background: #f0f8ff;
            border-radius: 8px;
            border: 2px solid #0066cc;
            margin-bottom: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        `;
        
        backLogoContainer.innerHTML = `
            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-weight: 600; color: #0066cc;">
                <input type="checkbox" id="back-logo-checkbox" style="width: 18px; height: 18px; cursor: pointer;">
                <span>Add Back Logo</span>
            </label>
            <div id="back-logo-details" style="display: none; flex: 1;">
                <label style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 0.9em; color: #666;">Stitch Count:</span>
                    <input type="number" id="back-logo-stitch-count" min="5000" value="5000" step="1000"
                           style="width: 80px; padding: 5px; border: 2px solid #ddd; border-radius: 4px; font-weight: bold;">
                    <span style="font-size: 0.85em; color: #666;">(Min: 5,000)</span>
                </label>
                <div id="back-logo-price" style="margin-top: 5px; font-size: 0.9em; color: #0066cc; font-weight: 600;">
                    Price: $5.00 per item
                </div>
            </div>
        `;
        
        // Also create a back logo pricing display for the pricing section
        const backLogoPricingDisplay = document.createElement('div');
        backLogoPricingDisplay.id = 'back-logo-pricing-display';
        backLogoPricingDisplay.className = 'back-logo-pricing-info';
        backLogoPricingDisplay.style.cssText = `
            display: none;
            margin-top: 15px;
            padding: 12px 15px;
            background: #f0f8ff;
            border-radius: 8px;
            border: 2px solid #0066cc;
            font-size: 0.95em;
        `;
        backLogoPricingDisplay.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                <span style="font-weight: 600; color: #0066cc;">Back Logo Embroidery:</span>
                <span id="back-logo-display-stitch-count" style="color: #666;">5,000 stitches</span>
            </div>
            <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-weight: 600; color: #0066cc;">Additional Cost:</span>
                <span id="back-logo-display-price" style="font-weight: bold; color: #28a745;">$5.00 per item</span>
            </div>
        `;
        
        // Find the best insertion point - look for the add to cart section
        const addToCartSection = document.querySelector('.add-to-cart-section');
        console.log('[CAP-EMB-ENHANCED] addToCartSection found:', !!addToCartSection);
        
        if (addToCartSection) {
            const sectionTitle = addToCartSection.querySelector('.section-title');
            console.log('[CAP-EMB-ENHANCED] sectionTitle within addToCartSection found:', !!sectionTitle);
            if (sectionTitle) {
                sectionTitle.insertAdjacentElement('afterend', backLogoContainer);
                console.log('[CAP-EMB-ENHANCED] Back logo option inserted after Add to Cart section title.');
            } else {
                addToCartSection.insertBefore(backLogoContainer, addToCartSection.firstChild);
                console.log('[CAP-EMB-ENHANCED] Back logo option inserted at beginning of add to cart section (no title found).');
            }
        } else {
            console.warn('[CAP-EMB-ENHANCED] .add-to-cart-section not found. Trying fallbacks for backLogoContainer.');
            const sizeGridContainer = document.getElementById('size-grid-container');
            console.log('[CAP-EMB-ENHANCED] sizeGridContainer found:', !!sizeGridContainer);
            const quantityMatrix = document.getElementById('quantity-matrix');
            console.log('[CAP-EMB-ENHANCED] quantityMatrix found:', !!quantityMatrix);
            
            if (sizeGridContainer) {
                sizeGridContainer.insertAdjacentElement('beforebegin', backLogoContainer);
                console.log('[CAP-EMB-ENHANCED] Back logo option inserted before size grid container.');
            } else if (quantityMatrix) {
                quantityMatrix.insertAdjacentElement('beforebegin', backLogoContainer);
                console.log('[CAP-EMB-ENHANCED] Back logo option inserted before quantity matrix.');
            } else {
                const pricingSectionFallback = document.querySelector('.pricing-section');
                console.log('[CAP-EMB-ENHANCED] pricingSectionFallback for backLogoContainer found:', !!pricingSectionFallback);
                if (pricingSectionFallback) {
                    pricingSectionFallback.appendChild(backLogoContainer);
                    console.log('[CAP-EMB-ENHANCED] Back logo option appended to pricing section (fallback).');
                } else {
                    document.body.appendChild(backLogoContainer);
                    console.error('[CAP-EMB-ENHANCED] CRITICAL FALLBACK: Back logo option appended to document.body.');
                }
            }
        }
        
        // Insert the back logo pricing display in the pricing section
        const pricingSectionForDisplay = document.querySelector('.pricing-section');
        console.log('[CAP-EMB-ENHANCED] pricingSectionForDisplay found:', !!pricingSectionForDisplay);
        if (pricingSectionForDisplay) {
            const pricingGrid = document.getElementById('custom-pricing-grid');
            console.log('[CAP-EMB-ENHANCED] pricingGrid for display insertion found:', !!pricingGrid);
            const sizeGridContainerForDisplay = document.getElementById('size-grid-container'); // Re-check, might be created by other scripts
            console.log('[CAP-EMB-ENHANCED] sizeGridContainerForDisplay found:', !!sizeGridContainerForDisplay);
             const quantityMatrixForDisplay = document.getElementById('quantity-matrix');
            console.log('[CAP-EMB-ENHANCED] quantityMatrixForDisplay found:', !!quantityMatrixForDisplay);

            if (pricingGrid && pricingGrid.parentNode === pricingSectionForDisplay) {
                pricingGrid.insertAdjacentElement('afterend', backLogoPricingDisplay);
                console.log('[CAP-EMB-ENHANCED] Back logo pricing display inserted after pricing grid.');
            } else if (sizeGridContainerForDisplay) { // Check if it exists before trying to insert after it
                sizeGridContainerForDisplay.insertAdjacentElement('afterend', backLogoPricingDisplay);
                console.log('[CAP-EMB-ENHANCED] Back logo pricing display inserted after size grid container.');
            } else if (quantityMatrixForDisplay) {
                 quantityMatrixForDisplay.insertAdjacentElement('afterend', backLogoPricingDisplay);
                console.log('[CAP-EMB-ENHANCED] Back logo pricing display inserted after quantity matrix.');
            } else {
                pricingSectionForDisplay.appendChild(backLogoPricingDisplay);
                console.log('[CAP-EMB-ENHANCED] Back logo pricing display appended to pricing section (fallback).');
            }
        } else {
            console.warn('[CAP-EMB-ENHANCED] .pricing-section not found for backLogoPricingDisplay.');
        }
        
        // Add event listeners
        const checkbox = document.getElementById('back-logo-checkbox');
        const details = document.getElementById('back-logo-details');
        const stitchInput = document.getElementById('back-logo-stitch-count');
        const priceDisplay = document.getElementById('back-logo-price');
        const pricingDisplaySection = document.getElementById('back-logo-pricing-display');
        
        checkbox.addEventListener('change', function() {
console.log('[CAP-EMB-ENHANCED] Back logo checkbox changed. Checked:', this.checked);
            if (!details) {
                console.error('[CAP-EMB-ENHANCED] Back logo details element (#back-logo-details) not found in checkbox listener!');
            }
            if (!pricingDisplaySection) {
                console.error('[CAP-EMB-ENHANCED] Back logo pricingDisplaySection element (#back-logo-pricing-display) not found in checkbox listener!');
            }
            // Original line will be: details.style.display = this.checked ? 'block' : 'none';
if (details) { // Check if details exists before logging its style
                console.log('[CAP-EMB-ENHANCED] Set details.style.display to:', details.style.display);
            }
            if (pricingDisplaySection) { // Check if pricingDisplaySection exists
                console.log('[CAP-EMB-ENHANCED] Set pricingDisplaySection.style.display to:', pricingDisplaySection.style.display);
            }
            // We'll add more logging after the style changes too.
            details.style.display = this.checked ? 'block' : 'none';
            pricingDisplaySection.style.display = this.checked ? 'block' : 'none';
            if (this.checked) {
                updateBackLogoPrice();
            }
            // Update pricing explanation
            updatePricingExplanation();
            // Trigger cart total update
            if (window.updateCartTotal) {
                window.updateCartTotal();
            }
            // Also trigger price display update for all sizes
            triggerPriceDisplayUpdate();
        });
        
        stitchInput.addEventListener('input', function() {
            console.log('[CAP-EMB-ENHANCED] Back logo stitchInput "input" EVENT LISTENER FIRED. Value:', this.value); // Made log more specific
            updateBackLogoPrice();
            // Update pricing explanation
            updatePricingExplanation();
            // Trigger cart total update
            if (window.updateCartTotal) {
                window.updateCartTotal();
            }
            // Also trigger price display update for all sizes
            triggerPriceDisplayUpdate();
        });
        
        function updateBackLogoPrice() {
            console.log('[CAP-EMB-ENHANCED] updateBackLogoPrice called.');
            if (!stitchInput) console.error('[CAP-EMB-ENHANCED] stitchInput is not defined in updateBackLogoPrice');
            if (!priceDisplay) console.error('[CAP-EMB-ENHANCED] priceDisplay is not defined in updateBackLogoPrice');

            const stitches = parseInt(stitchInput?.value) || BACK_LOGO_MINIMUM_STITCHES;
            console.log('[CAP-EMB-ENHANCED] updateBackLogoPrice - Stitches:', stitches, 'Raw input value:', stitchInput?.value);
            const price = Math.max(
                BACK_LOGO_MINIMUM_CHARGE,
                (stitches / 1000) * BACK_LOGO_PRICE_PER_1000_STITCHES
            );
            priceDisplay.textContent = `Price: $${price.toFixed(2)} per item`;
            console.log('[CAP-EMB-ENHANCED] updateBackLogoPrice - Updated #back-logo-price text to:', priceDisplay.textContent);
            
            // Update the pricing display section
            const displayStitchCount = document.getElementById('back-logo-display-stitch-count');
            const displayPrice = document.getElementById('back-logo-display-price');
            if (displayStitchCount) {
                displayStitchCount.textContent = `${stitches.toLocaleString()} stitches`;
                console.log('[CAP-EMB-ENHANCED] updateBackLogoPrice - Updated #back-logo-display-stitch-count text to:', displayStitchCount.textContent);
            } else {
                console.warn('[CAP-EMB-ENHANCED] updateBackLogoPrice - #back-logo-display-stitch-count not found.');
            }
            if (displayPrice) {
                displayPrice.textContent = `$${price.toFixed(2)} per item`;
                console.log('[CAP-EMB-ENHANCED] updateBackLogoPrice - Updated #back-logo-display-price text to:', displayPrice.textContent);
            } else {
                console.warn('[CAP-EMB-ENHANCED] updateBackLogoPrice - #back-logo-display-price not found.');
            }
        }
        
        function triggerPriceDisplayUpdate() {
            // Force update of all price displays by simulating a quantity change
            const quantityInputs = document.querySelectorAll('.quantity-input');
            quantityInputs.forEach(input => {
                // Trigger the input event to update price displays
                const event = new Event('input', { bubbles: true });
                input.dispatchEvent(event);
            });
        }
        
        // This function needs to be accessible by setupStitchCountListener, so move it to the IIFE's scope
        // function updatePricingExplanation() { ... } // Moved below
        
        // Trigger price display update for all sizes
        // This function also needs to be accessible by the event listeners, move to IIFE scope
        // function triggerPriceDisplayUpdate() { ... } // Moved below
    } // End of addBackLogoOption

    function updatePricingExplanation() { // Moved here
        const note = document.querySelector('.pricing-explanation p');
        if (!note) {
            console.warn('[CAP-EMB-ENHANCED] updatePricingExplanation: .pricing-explanation p not found.');
            return;
        }
        
            const stitchCountSelect = document.getElementById('client-stitch-count-select');
            const stitchCount = parseInt(stitchCountSelect?.value || '8000').toLocaleString();
            let explanationText = `<strong>Note:</strong> Prices shown are per item and include a ${stitchCount} stitch embroidered logo.`;
            
            // Add back logo information if enabled
            const backLogoCheckbox = document.getElementById('back-logo-checkbox');
            const backLogoStitchInput = document.getElementById('back-logo-stitch-count');
            
            if (backLogoCheckbox && backLogoCheckbox.checked) {
                const backLogoStitches = parseInt(backLogoStitchInput?.value) || BACK_LOGO_MINIMUM_STITCHES;
                const backLogoPrice = Math.max(
                    BACK_LOGO_MINIMUM_CHARGE,
                    (backLogoStitches / 1000) * BACK_LOGO_PRICE_PER_1000_STITCHES
                );
                const formattedBackStitchCount = backLogoStitches.toLocaleString();
                explanationText = `<strong>Note:</strong> Prices shown are per item and include a ${stitchCount} stitch embroidered logo. <span style="color: var(--primary-color); font-weight: bold;">Back logo (${formattedBackStitchCount} stitches) adds $${backLogoPrice.toFixed(2)} per item.</span>`;
            }
            
            note.innerHTML = explanationText;
        }
    // REMOVED EXTRA CLOSING BRACE HERE

    function triggerPriceDisplayUpdate() { // Moved here
        // Force update of all price displays by simulating a quantity change
        const quantityInputs = document.querySelectorAll('.quantity-input');
        quantityInputs.forEach(input => {
            // Trigger the input event to update price displays
            const event = new Event('input', { bubbles: true });
            input.dispatchEvent(event);
        });
        console.log('[CAP-EMB-ENHANCED] triggerPriceDisplayUpdate executed.');
    }
 
    // Enhance stitch count selector styling
    function enhanceStitchCountSelector() {
        console.log('[CAP-EMB-ENHANCED] Enhancing stitch count selector');
        
        // Find the actual stitch count selector div in the pricing header
        const pricingHeader = document.querySelector('.pricing-header');
        if (!pricingHeader) return;
        
        // Find the stitch count selector within the pricing header
        const stitchSelector = pricingHeader.querySelector('.stitch-count-selector');
        if (stitchSelector) {
            // Update styling to make it more prominent
            stitchSelector.style.cssText = `
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 12px 15px;
                background: linear-gradient(135deg, #fff3cd 0%, #ffeaa7 100%);
                border-radius: 8px;
                border: 2px solid #ffc107;
                box-shadow: 0 3px 6px rgba(0,0,0,0.1);
                position: relative;
            `;
            
            // Add importance indicator
            const importanceNote = document.createElement('div');
            importanceNote.style.cssText = `
                position: absolute;
                top: -10px;
                left: 15px;
                background: #ff6b6b;
                color: white;
                padding: 2px 8px;
                border-radius: 12px;
                font-size: 0.75em;
                font-weight: bold;
            `;
            importanceNote.textContent = 'IMPORTANT';
            stitchSelector.appendChild(importanceNote);
        }
        
        // Add restriction note
        const restrictionNote = document.createElement('div');
        restrictionNote.className = 'stitch-count-restriction-note';
        restrictionNote.style.cssText = `
            margin-top: 8px;
            padding: 8px 12px;
            background: #f8d7da;
            border: 1px solid #f5c6cb;
            border-radius: 4px;
            font-size: 0.85em;
            color: #721c24;
            display: flex;
            align-items: center;
            gap: 8px;
        `;
        restrictionNote.innerHTML = `
            <span style="font-size: 1.2em;">⚠️</span>
            <span><strong>Note:</strong> All caps in your order must have the same stitch count. You cannot mix different stitch counts in one order.</span>
        `;
        
        // Insert after the pricing header
        const pricingSection = document.querySelector('.pricing-section');
        if (pricingSection) {
            const pricingHeader = pricingSection.querySelector('.pricing-header');
            if (pricingHeader && pricingHeader.parentNode === pricingSection) {
                // Insert after the pricing header
                pricingHeader.insertAdjacentElement('afterend', restrictionNote);
                console.log('[CAP-EMB-ENHANCED] Restriction note inserted after pricing header');
            } else {
                // Insert at beginning of pricing section
                pricingSection.insertBefore(restrictionNote, pricingSection.firstChild);
                console.log('[CAP-EMB-ENHANCED] Restriction note inserted at beginning of pricing section');
            }
        }
    }

    // Add validation hooks
    function addValidationHooks() {
        console.log('[CAP-EMB-ENHANCED] Adding validation hooks');
        
        // Override or enhance the existing handleAddToCart function
        const originalHandleAddToCart = window.handleAddToCart;
        
        window.handleAddToCartWithValidation = async function() {
            console.log('[CAP-EMB-ENHANCED] Running enhanced add to cart validation');
            
            // 1. Validate product title
            const productTitle = document.getElementById('product-title-context')?.textContent || '';
            if (!validateProductTitle(productTitle)) {
                alert('This pricing is for caps only. The product title must contain "Cap", "Caps", or "Hat".');
                return;
            }
            
            // 2. Validate stitch count consistency
            const currentStitchCount = document.getElementById('client-stitch-count-select')?.value;
            if (!currentStitchCount) {
                alert('Please select a stitch count before adding to cart.');
                return;
            }
            
            // Check if cart has items with different stitch count
            if (window.NWCACart && typeof window.NWCACart.getCartItems === 'function') {
                const cartItems = window.NWCACart.getCartItems('Active');
                const capEmbItems = cartItems.filter(item => item.ImprintType === 'cap-embroidery');
                
                if (capEmbItems.length > 0) {
                    // Check if any existing items have different stitch count
                    const differentStitchCount = capEmbItems.find(item => 
                        item.embellishmentOptions && 
                        item.embellishmentOptions.stitchCount && 
                        item.embellishmentOptions.stitchCount !== currentStitchCount
                    );
                    
                    if (differentStitchCount) {
                        const existingStitchCount = differentStitchCount.embellishmentOptions.stitchCount;
                        alert(`Your cart contains caps with ${existingStitchCount} stitch embroidery. All caps must have the same stitch count.\n\nTo add caps with ${currentStitchCount} stitches, please clear your cart first.`);
                        
                        // Show clear cart button
                        if (confirm('Would you like to clear your cart and add this item?')) {
                            await window.NWCACart.clearCart();
                            // Continue with add to cart
                        } else {
                            return;
                        }
                    }
                }
            }
            
            // Call original function if validation passes
            if (originalHandleAddToCart) {
                return originalHandleAddToCart.call(this);
            }
        };
        
        // Replace the click handler on add to cart button
        setTimeout(() => {
            const addToCartBtn = document.getElementById('add-to-cart-button');
            if (addToCartBtn) {
                // Remove existing listeners
                const newBtn = addToCartBtn.cloneNode(true);
                addToCartBtn.parentNode.replaceChild(newBtn, addToCartBtn);
                
                // Add new listener
                newBtn.addEventListener('click', window.handleAddToCartWithValidation);
                console.log('[CAP-EMB-ENHANCED] Replaced add to cart handler with validation');
            }
        }, 1000);
    }

    // Validate product title
    function validateProductTitle(title) {
        const validTerms = ['cap', 'caps', 'hat', 'hats'];
        const titleLower = title.toLowerCase();
        
        return validTerms.some(term => {
            // Check for whole word match
            const regex = new RegExp(`\\b${term}\\b`, 'i');
            return regex.test(titleLower);
        });
    }

    // Setup stitch count change listener
    function setupStitchCountListener() {
        const stitchCountSelect = document.getElementById('client-stitch-count-select');
        if (!stitchCountSelect) return;
        
        stitchCountSelect.addEventListener('change', function() {
            console.log('[CAP-EMB-ENHANCED] Stitch count changed to:', this.value);
            
            // Update the pricing explanation
            if (typeof updatePricingExplanation === 'function') {
                updatePricingExplanation();
            } else {
                console.error('[CAP-EMB-ENHANCED] updatePricingExplanation is not defined in stitch count listener scope.');
            }
            // Also trigger price display update for all sizes, as stitch count affects base prices
            if (typeof triggerPriceDisplayUpdate === 'function') {
                triggerPriceDisplayUpdate();
            } else {
                console.error('[CAP-EMB-ENHANCED] triggerPriceDisplayUpdate is not defined in stitch count listener scope.');
            }
        });
    }

    // Export functions for cart integration
    window.CapEmbroideryEnhanced = {
        getBackLogoDetails: function() {
            const checkbox = document.getElementById('back-logo-checkbox');
            const stitchInput = document.getElementById('back-logo-stitch-count');
            
            if (!checkbox || !checkbox.checked) {
                return null;
            }
            
            const stitches = parseInt(stitchInput.value) || BACK_LOGO_MINIMUM_STITCHES;
            const price = Math.max(
                BACK_LOGO_MINIMUM_CHARGE,
                (stitches / 1000) * BACK_LOGO_PRICE_PER_1000_STITCHES
            );
            
            return {
                enabled: true,
                stitchCount: stitches,
                pricePerItem: price
            };
        },
        
        validateProductTitle: validateProductTitle
    };
    
    // Also expose as CapEmbroideryBackLogo for compatibility
    window.CapEmbroideryBackLogo = {
        isEnabled: function() {
            const checkbox = document.getElementById('back-logo-checkbox');
            return checkbox && checkbox.checked;
        },
        
        getPrice: function() {
            const details = window.CapEmbroideryEnhanced.getBackLogoDetails();
            return details ? details.pricePerItem : 0;
        },
        
        getStitchCount: function() {
            const details = window.CapEmbroideryEnhanced.getBackLogoDetails();
            return details ? details.stitchCount : 0;
        },
        
        getDetails: function() {
            return window.CapEmbroideryEnhanced.getBackLogoDetails();
        }
    };

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }
})();