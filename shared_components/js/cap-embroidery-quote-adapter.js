// Cap Embroidery Quote Adapter
// Extends QuoteAdapterBase for cap embroidery specific functionality
// For Northwest Custom Apparel - June 2025

(function() {
    'use strict';

    // Cap embroidery specific configuration
    const CAP_EMBROIDERY_CONFIG = {
        embellishmentType: 'cap-embroidery',
        ltmThreshold: 24,
        ltmFee: 50.00,
        defaultStitchCount: '8000',
        backLogoPrice: 5.00, // Base price for 5000 stitches
        brandColor: '#2e5827'
    };

    class CapEmbroideryQuoteAdapter extends window.QuoteAdapterBase {
        constructor() {
            super('cap-embroidery', CAP_EMBROIDERY_CONFIG);
            this.currentStitchCount = CAP_EMBROIDERY_CONFIG.defaultStitchCount;
            this.backLogoEnabled = false;
            this.currentPricingData = null;
        }

        // Override setupUI to include cap embroidery specific elements
        setupUI() {
            console.log('[CAP-EMB-QUOTE] Setting up cap embroidery quote UI');
            
            // Replace "Add to Cart" section with quote builder
            const cartSection = document.getElementById('add-to-cart-section');
            if (cartSection) {
                cartSection.innerHTML = this.getQuoteBuilderHTML();
            }

            // Add quote summary panel
            this.addQuoteSummaryPanel();

            // Setup stitch count selector
            this.setupStitchCountSelector();
        }

        // Get cap embroidery specific quote builder HTML
        getQuoteBuilderHTML() {
            return `
                <div class="quote-builder-container">
                    <h3 class="section-title" style="color: ${this.config.brandColor};">Build Your Quote</h3>
                    

                    <!-- Size Quantity Grid -->
                    <div id="size-quantity-grid-container" style="margin: 20px 0; padding: 15px; background-color: var(--background-light); border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
                        <h4 style="margin-top: 0; color: var(--primary-color);">Enter Quantities by Size</h4>
                        <div id="size-quantity-grid">
                            <!-- Size quantity grid will be populated here -->
                        </div>
                    </div>

                    <!-- Quote Actions -->
                    <div class="quote-actions" style="margin-top: 20px;">
                        <button id="add-to-quote-btn" class="add-to-cart-button" style="width: 100%;">
                            Add to Quote
                        </button>
                    </div>

                    <!-- Quote Summary Section -->
                    <div id="quote-container" class="quote-section" style="margin-top: 20px;">
                        <div id="quote-summary-header" style="background-color: var(--primary-light); padding: 15px; border-radius: var(--radius-sm); margin-bottom: 15px;">
                            <h3 style="margin: 0; color: var(--primary-color);">Quote Summary</h3>
                        </div>
                        <div id="quote-items-list" style="margin-bottom: 15px;">
                            <!-- Quote items will be populated here -->
                        </div>
                        <div id="quote-subtotal" style="padding: 10px; border-bottom: 1px solid var(--border-color);">
                            <!-- Subtotal will be shown here -->
                        </div>
                        <div id="quote-ltm" class="ltm-row" style="padding: 10px; border-bottom: 1px solid var(--border-color); display: none;">
                            <!-- LTM fees will be shown here -->
                        </div>
                        <div id="quote-total" style="padding: 15px; font-weight: bold; font-size: 1.2em; background-color: var(--primary-light); border-radius: var(--radius-sm);">
                            <!-- Total will be shown here -->
                        </div>
                    </div>
                </div>
            `;
        }

        // Setup stitch count selector
        setupStitchCountSelector() {
            const stitchCountSelect = document.getElementById('client-stitch-count-select');
            if (stitchCountSelect) {
                stitchCountSelect.addEventListener('change', (e) => {
                    this.currentStitchCount = e.target.value;
                    console.log('[CAP-EMB-QUOTE] Stitch count changed to:', this.currentStitchCount);
                    
                    // Update pricing if we have current pricing data
                    if (this.currentPricingData) {
                        this.updatePricingDisplay();
                    }
                });
                
                // Set initial value
                this.currentStitchCount = stitchCountSelect.value || CAP_EMBROIDERY_CONFIG.defaultStitchCount;
                
            }
        }

        // Override bindEvents to include cap embroidery specific events
        bindEvents() {
            super.bindEvents();
            
            // Add to quote button
            const addToQuoteBtn = document.getElementById('add-to-quote-btn');
            if (addToQuoteBtn) {
                addToQuoteBtn.addEventListener('click', () => this.handleAddToQuote());
            }

            // Listen for pricing data updates
            document.addEventListener('pricingDataUpdated', (e) => {
                console.log('[CAP-EMB-QUOTE] Pricing data updated:', e.detail);
                this.currentPricingData = e.detail;
                this.updatePricingDisplay();
            });

            // Listen for color selection changes
            document.addEventListener('colorSelected', (e) => {
                console.log('[CAP-EMB-QUOTE] Color selected:', e.detail);
            });
            
            // Listen for back logo add-on changes
            document.addEventListener('backLogoToggled', (e) => {
                console.log('[CAP-EMB-QUOTE] Back logo toggled:', e.detail);
                this.backLogoEnabled = e.detail.enabled;
                this.updatePricingDisplay();
            });
            
            document.addEventListener('backLogoUpdated', (e) => {
                console.log('[CAP-EMB-QUOTE] Back logo updated:', e.detail);
                this.updatePricingDisplay();
            });
        }


        // Get current back logo price from the independent add-on system
        getCurrentBackLogoPrice() {
            console.log('[CAP-EMB-QUOTE] getCurrentBackLogoPrice called');
            console.log('[CAP-EMB-QUOTE] CapEmbroideryBackLogoAddon available:', !!window.CapEmbroideryBackLogoAddon);
            
            if (window.CapEmbroideryBackLogoAddon) {
                console.log('[CAP-EMB-QUOTE] Addon state:', window.CapEmbroideryBackLogoAddon.getState());
                const price = window.CapEmbroideryBackLogoAddon.getPrice();
                console.log('[CAP-EMB-QUOTE] Getting back logo price from addon system:', price);
                return price;
            }
            // Fallback calculation
            console.log('[CAP-EMB-QUOTE] Using fallback back logo price: 5.00');
            return 5.00;
        }

        // Update pricing display based on current selections
        updatePricingDisplay() {
            if (!this.currentPricingData) return;

            // Check if back logo is enabled from the add-on system
            const backLogoEnabled = window.CapEmbroideryBackLogoAddon ? window.CapEmbroideryBackLogoAddon.isEnabled() : false;

            // Update size quantity grid with current prices
            const sizeInputs = document.querySelectorAll('.quantity-input[data-size]');
            sizeInputs.forEach(input => {
                const size = input.getAttribute('data-size');
                const priceDisplay = input.closest('td').querySelector('.size-price-display');
                
                if (priceDisplay && this.currentPricingData.prices) {
                    const basePrice = this.getBasePriceForSize(size);
                    const currentBackLogoPrice = this.getCurrentBackLogoPrice();
                    const totalPrice = basePrice + (backLogoEnabled ? currentBackLogoPrice : 0);
                    priceDisplay.textContent = `$${totalPrice.toFixed(2)}`;
                }
            });
        }

        // Get base price for a specific size
        getBasePriceForSize(size) {
            console.log('[CAP-EMB-QUOTE] getBasePriceForSize called for size:', size);
            console.log('[CAP-EMB-QUOTE] Current stitch count:', this.currentStitchCount);
            console.log('[CAP-EMB-QUOTE] Current pricing data:', this.currentPricingData);
            
            if (!this.currentPricingData || !this.currentPricingData.prices) {
                console.log('[CAP-EMB-QUOTE] No pricing data available');
                return 0;
            }
            
            // Check if we have direct size pricing structure
            if (this.currentPricingData.prices[size]) {
                console.log('[CAP-EMB-QUOTE] Found size pricing structure:', this.currentPricingData.prices[size]);
                
                // We need to determine which tier to use for a single item (should be lowest tier)
                const tierPrices = this.currentPricingData.prices[size];
                const tierKeys = Object.keys(tierPrices);
                
                if (tierKeys.length > 0) {
                    // Use the first tier (lowest quantity tier) for base pricing
                    const firstTier = tierKeys[0];
                    const price = tierPrices[firstTier];
                    console.log('[CAP-EMB-QUOTE] Using tier', firstTier, 'price:', price);
                    return price;
                }
            }
            
            // Fallback: try the old key format
            const priceKey = `${this.currentStitchCount}_${size}`;
            const fallbackPrice = this.currentPricingData.prices[priceKey] || 0;
            console.log('[CAP-EMB-QUOTE] Using fallback price key', priceKey, ':', fallbackPrice);
            return fallbackPrice;
        }

        // Handle add to quote
        async handleAddToQuote() {
            console.log('[CAP-EMB-QUOTE] Adding to quote...');
            
            // Validate product selection
            const productTitle = document.getElementById('product-title-context')?.textContent;
            const styleNumber = document.getElementById('product-style-context')?.textContent;
            const selectedColor = document.getElementById('pricing-color-name')?.textContent;
            
            if (!productTitle || !styleNumber || !selectedColor) {
                alert('Please ensure a product and color are selected');
                return;
            }

            // Validate cap product
            if (window.CapEmbroideryValidation && !window.CapEmbroideryValidation.isValidCapProduct(productTitle)) {
                const proceed = await window.CapEmbroideryValidation.showNonCapWarning(productTitle);
                if (!proceed) return;
            }

            // Get quantities by size
            const sizeQuantities = this.getSizeQuantities();
            const totalQuantity = Object.values(sizeQuantities).reduce((sum, qty) => sum + qty, 0);
            
            if (totalQuantity === 0) {
                alert('Please enter at least one quantity');
                return;
            }

            // Calculate pricing
            const pricing = this.calculatePricing(sizeQuantities);
            
            // Get back logo state from the add-on system
            const backLogoEnabled = window.CapEmbroideryBackLogoAddon ? window.CapEmbroideryBackLogoAddon.isEnabled() : false;
            const backLogoStitchCount = window.CapEmbroideryBackLogoAddon ? window.CapEmbroideryBackLogoAddon.getStitchCount() : 0;
            const backLogoPrice = backLogoEnabled ? this.getCurrentBackLogoPrice() : 0;
            
            console.log('[CAP-EMB-QUOTE] Back logo state before creating quote item:', {
                backLogoEnabled,
                backLogoStitchCount,
                backLogoPrice
            });

            // Create quote item
            const itemData = {
                styleNumber: styleNumber,
                productName: productTitle,
                color: selectedColor,
                quantity: totalQuantity,
                baseUnitPrice: pricing.baseUnitPrice,
                stitchCount: this.currentStitchCount,
                hasBackLogo: backLogoEnabled,
                backLogoStitchCount: backLogoStitchCount,
                backLogoPrice: backLogoPrice,
                sizeBreakdown: sizeQuantities,
                sizePricing: pricing.sizePricing
            };
            
            console.log('[CAP-EMB-QUOTE] Item data being passed to createQuoteItem:', itemData);
            const quoteItem = this.createQuoteItem(itemData);

            // Add to quote
            this.addItemToQuote(quoteItem);

            // Reset form
            this.resetQuoteBuilder();
        }

        // Get size quantities from the form
        getSizeQuantities() {
            const quantities = {};
            const sizeInputs = document.querySelectorAll('.quantity-input[data-size]');
            
            sizeInputs.forEach(input => {
                const size = input.getAttribute('data-size');
                const qty = parseInt(input.value) || 0;
                if (qty > 0) {
                    quantities[size] = qty;
                }
            });
            
            return quantities;
        }

        // Calculate pricing for the current selection
        calculatePricing(sizeQuantities) {
            console.log('[CAP-EMB-QUOTE] calculatePricing called with sizeQuantities:', sizeQuantities);
            
            // Use the actual pricing calculator to get accurate pricing
            if (window.NWCAPricingCalculator && window.nwcaPricingData) {
                console.log('[CAP-EMB-QUOTE] Using NWCAPricingCalculator for accurate pricing');
                
                const existingCartQuantity = 0; // For quotes, we start fresh
                const calculatedPricing = window.NWCAPricingCalculator.calculatePricing(
                    sizeQuantities, 
                    existingCartQuantity, 
                    window.nwcaPricingData
                );
                
                console.log('[CAP-EMB-QUOTE] Calculated pricing from calculator:', calculatedPricing);
                
                // Extract the base unit price (without LTM, without back logo)
                let totalBasePrice = 0;
                let totalQuantity = 0;
                
                console.log('[CAP-EMB-QUOTE] Calculated pricing items:', calculatedPricing.items);
                
                Object.entries(calculatedPricing.items || {}).forEach(([size, item]) => {
                    console.log('[CAP-EMB-QUOTE] Processing item for size:', size, item);
                    if (item.quantity > 0) {
                        // The item object from pricing calculator has these properties:
                        // - baseUnitPrice: the base tier price (what we want)
                        // - unitPrice: base + fees 
                        // - displayUnitPrice: base + fees + back logo (if added by enhanced adapter)
                        const basePrice = item.baseUnitPrice || 0;
                        console.log('[CAP-EMB-QUOTE] Using base price:', basePrice, 'for quantity:', item.quantity);
                        totalBasePrice += basePrice * item.quantity;
                        totalQuantity += item.quantity;
                    }
                });
                
                const baseUnitPrice = totalQuantity > 0 ? totalBasePrice / totalQuantity : 0;
                
                console.log('[CAP-EMB-QUOTE] Extracted base unit price:', baseUnitPrice);
                
                return {
                    baseUnitPrice: baseUnitPrice,  // Front logo price only
                    sizePricing: calculatedPricing.items || {}
                };
            }
            
            // Fallback to original method if calculator not available
            console.log('[CAP-EMB-QUOTE] Falling back to manual calculation');
            
            let totalBasePrice = 0;
            let totalQuantity = 0;
            const sizePricing = {};
            
            Object.entries(sizeQuantities).forEach(([size, qty]) => {
                const basePrice = this.getBasePriceForSize(size);
                
                sizePricing[size] = {
                    quantity: qty,
                    basePrice: basePrice,
                    unitPrice: basePrice,
                    lineTotal: basePrice * qty
                };
                
                totalBasePrice += basePrice * qty;
                totalQuantity += qty;
            });
            
            const baseUnitPrice = totalQuantity > 0 ? totalBasePrice / totalQuantity : 0;
            
            return {
                baseUnitPrice: baseUnitPrice,
                sizePricing: sizePricing
            };
        }

        // Override renderQuoteItem for cap embroidery specific display
        renderQuoteItem(item) {
            const sizeBreakdownHtml = Object.entries(item.sizeBreakdown || {})
                .map(([size, qty]) => `${size}: ${qty}`)
                .join(', ');

            return `
                <div class="quote-item" data-item-id="${item.id}">
                    <div class="quote-item-header">
                        <strong>${item.styleNumber} - ${item.color}</strong>
                        <button class="quote-item-remove" onclick="capEmbroideryQuoteAdapter.removeItem('${item.id}')">
                            ×
                        </button>
                    </div>
                    <div class="quote-item-details">
                        <div>Stitch Count: ${item.stitchCount}</div>
                        <div>Sizes: ${sizeBreakdownHtml}</div>
                        <div>Total Qty: ${item.quantity}</div>
                        ${this.getItemDetailsHTML(item)}
                    </div>
                    <div class="quote-item-total">
                        $${item.lineTotal.toFixed(2)}
                    </div>
                </div>
            `;
        }

        // Override getItemDetailsHTML for cap embroidery specific details with front/back logo breakdown
        getItemDetailsHTML(item) {
            console.log('[CAP-EMB-QUOTE] getItemDetailsHTML called with item:', item);
            console.log('[CAP-EMB-QUOTE] Back logo check:', {
                hasBackLogo: item.hasBackLogo,
                backLogoStitchCount: item.backLogoStitchCount,
                backLogoPrice: item.backLogoPrice
            });
            
            let detailsHTML = `<div class="quote-item-breakdown">`;
            
            if (item.hasBackLogo && item.backLogoStitchCount && item.backLogoPrice > 0) {
                // When back logo is present, show detailed breakdown
                const frontPrice = item.baseUnitPrice;
                const backPrice = item.backLogoPrice;
                const formattedFrontStitches = parseInt(item.stitchCount).toLocaleString();
                const formattedBackStitches = parseInt(item.backLogoStitchCount).toLocaleString();
                
                detailsHTML += `
                    <div class="embellishment-breakdown">
                        <div>Front Logo (${formattedFrontStitches} st): $${frontPrice.toFixed(2)}</div>
                        <div>Back Logo (${formattedBackStitches} st): $${backPrice.toFixed(2)}</div>
                `;
                
                // Add LTM fee if applicable
                if (item.hasLTM && item.ltmPerUnit > 0) {
                    detailsHTML += `<div>LTM Fee: <strong style="color:#663c00">$${(item.ltmPerUnit * item.quantity).toFixed(2)}</strong></div>`;
                }
                
                detailsHTML += `</div>`;
            } else {
                // Standard display when no back logo
                const formattedStitches = parseInt(item.stitchCount).toLocaleString();
                detailsHTML += `<div>Base (${formattedStitches} st): $${item.baseUnitPrice.toFixed(2)}`;
                
                // Add LTM fee if applicable
                if (item.hasLTM && item.ltmPerUnit > 0) {
                    detailsHTML += ` + <strong style="color:#663c00">$${(item.ltmPerUnit * item.quantity).toFixed(2)}</strong> LTM`;
                }
                
                detailsHTML += `</div>`;
            }
            
            // Show per-unit price
            detailsHTML += `<div class="unit-price">$${item.finalUnitPrice.toFixed(2)}/ea</div>`;
            detailsHTML += `</div>`;
            
            return detailsHTML;
        }

        // Override createQuoteItem to include back logo price in final calculations
        createQuoteItem(itemData) {
            console.log('[CAP-EMB-QUOTE] Creating quote item with data:', itemData);
            
            // Create base item using parent method
            const baseItem = super.createQuoteItem(itemData);
            
            // Add back logo price to final unit price if back logo is enabled
            if (itemData.hasBackLogo && itemData.backLogoPrice > 0) {
                console.log('[CAP-EMB-QUOTE] Adding back logo price to final calculation:', {
                    baseUnitPrice: itemData.baseUnitPrice,
                    ltmPerUnit: baseItem.ltmPerUnit,
                    backLogoPrice: itemData.backLogoPrice,
                    newFinalUnitPrice: itemData.baseUnitPrice + baseItem.ltmPerUnit + itemData.backLogoPrice
                });
                baseItem.finalUnitPrice = itemData.baseUnitPrice + baseItem.ltmPerUnit + itemData.backLogoPrice;
                baseItem.lineTotal = baseItem.finalUnitPrice * itemData.quantity;
            }
            
            console.log('[CAP-EMB-QUOTE] Final quote item:', baseItem);
            return baseItem;
        }

        // Override getAdditionalItemData for cap embroidery specific fields
        getAdditionalItemData(item) {
            return {
                StitchCount: item.stitchCount,
                HasBackLogo: item.hasBackLogo ? "Yes" : "No",
                BackLogoStitchCount: item.backLogoStitchCount || 0,
                BackLogoPrice: item.backLogoPrice || 0,
                SizeBreakdown: JSON.stringify(item.sizeBreakdown || {}),
                SizePricing: JSON.stringify(item.sizePricing || {})
            };
        }

        // Override resetQuoteBuilder
        resetQuoteBuilder() {
            // Reset quantities
            const sizeInputs = document.querySelectorAll('.quantity-input[data-size]');
            sizeInputs.forEach(input => {
                input.value = '0';
            });

            // Reset back logo checkbox (using addon system)
            const backLogoCheckbox = document.getElementById('back-logo-addon-checkbox');
            if (backLogoCheckbox) {
                backLogoCheckbox.checked = false;
                backLogoCheckbox.dispatchEvent(new Event('change')); // Trigger the addon system to update
                this.backLogoEnabled = false;
            }

            // Update total quantity display
            const totalQuantityEl = document.querySelector('.total-quantity');
            if (totalQuantityEl) {
                totalQuantityEl.textContent = '0';
            }

            // Update total price display
            const totalPriceEl = document.querySelector('.total-price');
            if (totalPriceEl) {
                totalPriceEl.textContent = '$0.00';
            }
        }

        // Override updateQuoteSummary to include cap embroidery specific LTM display
        updateQuoteSummary() {
            super.updateQuoteSummary();
            
            // Update cap-specific LTM display if validation module is available
            if (window.CapEmbroideryValidation && this.currentQuote.ltmTotal > 0) {
                window.CapEmbroideryValidation.updateCapLTMDisplay(
                    this.currentQuote.totalQuantity,
                    this.currentQuote.ltmTotal
                );
            }
        }

        // Override convertApiItemToQuoteItem for cap embroidery specific conversion
        convertApiItemToQuoteItem(apiItem) {
            const baseItem = super.convertApiItemToQuoteItem(apiItem);
            
            // Add cap embroidery specific fields
            return {
                ...baseItem,
                stitchCount: apiItem.StitchCount || '8000',
                hasBackLogo: apiItem.HasBackLogo === "Yes",
                backLogoPrice: parseFloat(apiItem.BackLogoPrice) || 0,
                sizeBreakdown: apiItem.SizeBreakdown ? JSON.parse(apiItem.SizeBreakdown) : {},
                sizePricing: apiItem.SizePricing ? JSON.parse(apiItem.SizePricing) : {}
            };
        }
    }

    // Create and initialize the adapter
    const capEmbroideryQuoteAdapter = new CapEmbroideryQuoteAdapter();
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            capEmbroideryQuoteAdapter.init();
        });
    } else {
        capEmbroideryQuoteAdapter.init();
    }

    // Export to global scope
    window.capEmbroideryQuoteAdapter = capEmbroideryQuoteAdapter;
    window.CapEmbroideryQuoteAdapter = CapEmbroideryQuoteAdapter;

})();