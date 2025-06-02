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
        backLogoPrice: 3.00,
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

            // Setup back logo checkbox
            this.setupBackLogoCheckbox();
        }

        // Get cap embroidery specific quote builder HTML
        getQuoteBuilderHTML() {
            return `
                <div class="quote-builder-container">
                    <h3 class="section-title" style="color: ${this.config.brandColor};">Build Your Quote</h3>
                    
                    <!-- Back Logo Option -->
                    <div class="back-logo-section" style="margin-bottom: 20px; padding: 15px; background-color: var(--background-light); border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
                        <label style="display: flex; align-items: center; cursor: pointer;">
                            <input type="checkbox" id="back-logo-checkbox" style="margin-right: 10px;">
                            <span style="font-weight: bold;">Add Back Logo (+$${this.config.backLogoPrice.toFixed(2)} per cap)</span>
                        </label>
                        <p style="margin: 5px 0 0 25px; font-size: 0.9em; color: #666;">
                            Add a second embroidered logo on the back of the cap
                        </p>
                    </div>

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

        // Setup back logo checkbox
        setupBackLogoCheckbox() {
            const backLogoCheckbox = document.getElementById('back-logo-checkbox');
            if (backLogoCheckbox) {
                backLogoCheckbox.addEventListener('change', (e) => {
                    this.backLogoEnabled = e.target.checked;
                    console.log('[CAP-EMB-QUOTE] Back logo enabled:', this.backLogoEnabled);
                    
                    // Update pricing display
                    if (this.currentPricingData) {
                        this.updatePricingDisplay();
                    }
                });
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
        }

        // Update pricing display based on current selections
        updatePricingDisplay() {
            if (!this.currentPricingData) return;

            // Update size quantity grid with current prices
            const sizeInputs = document.querySelectorAll('.quantity-input[data-size]');
            sizeInputs.forEach(input => {
                const size = input.getAttribute('data-size');
                const priceDisplay = input.closest('td').querySelector('.size-price-display');
                
                if (priceDisplay && this.currentPricingData.prices) {
                    const basePrice = this.getBasePriceForSize(size);
                    const totalPrice = basePrice + (this.backLogoEnabled ? this.config.backLogoPrice : 0);
                    priceDisplay.textContent = `$${totalPrice.toFixed(2)}`;
                }
            });
        }

        // Get base price for a specific size
        getBasePriceForSize(size) {
            if (!this.currentPricingData || !this.currentPricingData.prices) return 0;
            
            // Find the price for the current stitch count and size
            const priceKey = `${this.currentStitchCount}_${size}`;
            return this.currentPricingData.prices[priceKey] || 0;
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
            
            // Create quote item
            const quoteItem = this.createQuoteItem({
                styleNumber: styleNumber,
                productName: productTitle,
                color: selectedColor,
                quantity: totalQuantity,
                baseUnitPrice: pricing.baseUnitPrice,
                stitchCount: this.currentStitchCount,
                hasBackLogo: this.backLogoEnabled,
                backLogoPrice: this.backLogoEnabled ? this.config.backLogoPrice : 0,
                sizeBreakdown: sizeQuantities,
                sizePricing: pricing.sizePricing
            });

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
            let totalBasePrice = 0;
            let totalQuantity = 0;
            const sizePricing = {};
            
            Object.entries(sizeQuantities).forEach(([size, qty]) => {
                const basePrice = this.getBasePriceForSize(size);
                const unitPrice = basePrice + (this.backLogoEnabled ? this.config.backLogoPrice : 0);
                
                sizePricing[size] = {
                    quantity: qty,
                    basePrice: basePrice,
                    unitPrice: unitPrice,
                    lineTotal: unitPrice * qty
                };
                
                totalBasePrice += unitPrice * qty;
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
                        ${item.hasBackLogo ? '<div>✓ Back Logo Included</div>' : ''}
                        <div>Price: $${item.finalUnitPrice.toFixed(2)}/ea</div>
                    </div>
                    <div class="quote-item-total">
                        $${item.lineTotal.toFixed(2)}
                    </div>
                </div>
            `;
        }

        // Override getItemDetailsHTML for cap embroidery specific details
        getItemDetailsHTML(item) {
            return `
                <span>Qty: ${item.quantity}</span>
                <span>${item.stitchCount} stitches</span>
                ${item.hasBackLogo ? '<span>+ Back Logo</span>' : ''}
                <span>$${item.finalUnitPrice.toFixed(2)}/ea</span>
            `;
        }

        // Override getAdditionalItemData for cap embroidery specific fields
        getAdditionalItemData(item) {
            return {
                StitchCount: item.stitchCount,
                HasBackLogo: item.hasBackLogo ? "Yes" : "No",
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

            // Reset back logo checkbox
            const backLogoCheckbox = document.getElementById('back-logo-checkbox');
            if (backLogoCheckbox) {
                backLogoCheckbox.checked = false;
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