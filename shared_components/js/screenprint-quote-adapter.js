// Screen Print Quote Adapter
// Extends QuoteAdapterBase for screen print specific functionality
// For Northwest Custom Apparel - June 2025

(function() {
    'use strict';

    class ScreenPrintQuoteAdapter extends window.QuoteAdapterBase {
        constructor() {
            super('screenprint', {
                ltmThreshold: 24,
                ltmFee: 50.00
            });
            
            this.colorCounts = ['1', '2', '3', '4', '5', '6'];
            this.currentPricingData = null;
        }

        // Override setupUI to create screen print specific interface
        setupUI() {
            const cartSection = document.getElementById('add-to-cart-section');
            if (!cartSection) {
                console.error('[QUOTE:SCREENPRINT] Add to cart section not found');
                return;
            }

            cartSection.innerHTML = this.getQuoteBuilderHTML();
            this.addQuoteSummaryPanel();
            
            // Initialize size quantity grid after DOM update
            setTimeout(() => {
                this.initializeSizeQuantityGrid();
            }, 100);
        }

        // Override to provide screen print specific quote builder
        getQuoteBuilderHTML() {
            return `
                <div class="quote-builder-container">
                    <h3 class="section-title" style="color: ${this.config.brandColor}; margin-bottom: 20px;">Build Your Quote</h3>
                    
                    <!-- Quick Add Section -->
                    <div class="quote-quick-add-section" style="background-color: var(--background-light); padding: 20px; border-radius: var(--radius-sm); margin-bottom: 20px;">
                        <h4 style="margin-top: 0; color: var(--primary-color);">Quick Add to Quote</h4>
                        
                        <!-- Total Quantity Input -->
                        <div class="quantity-input-group" style="margin-bottom: 15px;">
                            <label for="sp-total-quantity" style="display: block; margin-bottom: 5px; font-weight: bold;">
                                Total Quantity:
                            </label>
                            <input type="number" 
                                   id="sp-total-quantity" 
                                   min="1" 
                                   placeholder="Enter total quantity"
                                   style="width: 200px; padding: 8px; border: 1px solid var(--border-color); border-radius: var(--radius-sm);">
                            <span class="ltm-indicator" id="sp-ltm-indicator" style="margin-left: 10px; color: #ff6b6b; display: none;">
                                ⚠️ Less than minimum (24) - $50 fee applies
                            </span>
                        </div>
                        
                        <!-- Size Distribution Grid -->
                        <div id="sp-size-quantity-grid" class="size-quantity-grid" style="margin-bottom: 15px;">
                            <!-- Will be populated dynamically based on available sizes -->
                        </div>
                        
                        <!-- Add to Quote Button -->
                        <button id="sp-add-to-quote-btn" 
                                class="btn-primary add-to-quote-button" 
                                style="width: 100%; padding: 12px; font-size: 1.1em; background-color: ${this.config.brandColor}; color: white; border: none; border-radius: var(--radius-sm); cursor: pointer;">
                            Add to Quote
                        </button>
                    </div>
                    
                    <!-- Quote Summary Section -->
                    <div class="quote-summary-inline" style="background-color: var(--primary-light); padding: 15px; border-radius: var(--radius-sm);">
                        <h4 style="margin-top: 0; color: var(--primary-color);">Current Quote Summary</h4>
                        <div id="sp-quote-summary-content">
                            <p style="color: #666; font-style: italic;">No items in quote yet</p>
                        </div>
                    </div>
                </div>
            `;
        }

        // Initialize size quantity grid
        initializeSizeQuantityGrid() {
            const gridContainer = document.getElementById('sp-size-quantity-grid');
            if (!gridContainer) return;

            // Wait for pricing data to be available
            const checkForSizes = setInterval(() => {
                if (this.currentPricingData && this.currentPricingData.uniqueSizes) {
                    clearInterval(checkForSizes);
                    this.renderSizeGrid(this.currentPricingData.uniqueSizes);
                }
            }, 500);
        }

        // Render size distribution grid
        renderSizeGrid(sizes) {
            const gridContainer = document.getElementById('sp-size-quantity-grid');
            if (!gridContainer || !sizes || sizes.length === 0) return;

            let gridHTML = `
                <div style="margin-bottom: 10px;">
                    <strong>Size Distribution:</strong>
                    <span style="font-size: 0.9em; color: #666; margin-left: 10px;">
                        (Must equal total quantity)
                    </span>
                </div>
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 10px;">
            `;

            sizes.forEach(size => {
                gridHTML += `
                    <div class="size-input-group">
                        <label style="display: block; font-size: 0.9em; margin-bottom: 3px;">${size}</label>
                        <input type="number" 
                               class="sp-size-quantity" 
                               data-size="${size}" 
                               min="0" 
                               value="0"
                               style="width: 100%; padding: 5px; border: 1px solid var(--border-color); border-radius: var(--radius-sm);">
                    </div>
                `;
            });

            gridHTML += '</div>';
            gridContainer.innerHTML = gridHTML;
        }

        // Override bindEvents to add screen print specific handlers
        bindEvents() {
            super.bindEvents();

            // Listen for pricing data updates from screenprint-adapter
            document.addEventListener('pricingDataLoaded', (event) => {
                if (event.detail && event.detail.embellishmentType === 'screen-print') {
                    this.currentPricingData = event.detail;
                    console.log('[QUOTE:SCREENPRINT] Pricing data received:', this.currentPricingData);
                    
                    // Update size grid if needed
                    if (this.currentPricingData.uniqueSizes) {
                        this.renderSizeGrid(this.currentPricingData.uniqueSizes);
                    }
                }
            });

            // Total quantity change handler
            document.addEventListener('input', (e) => {
                if (e.target.id === 'sp-total-quantity') {
                    this.handleTotalQuantityChange(e.target.value);
                }
            });

            // Size quantity change handler
            document.addEventListener('input', (e) => {
                if (e.target.classList.contains('sp-size-quantity')) {
                    this.validateSizeDistribution();
                }
            });

            // Add to quote button handler
            document.addEventListener('click', (e) => {
                if (e.target.id === 'sp-add-to-quote-btn') {
                    this.handleAddToQuote();
                }
            });
        }

        // Handle total quantity change
        handleTotalQuantityChange(value) {
            const quantity = parseInt(value) || 0;
            const ltmIndicator = document.getElementById('sp-ltm-indicator');
            
            if (ltmIndicator) {
                ltmIndicator.style.display = this.hasLTMFee(quantity) ? 'inline' : 'none';
            }
            
            this.validateSizeDistribution();
        }

        // Validate size distribution matches total
        validateSizeDistribution() {
            const totalInput = document.getElementById('sp-total-quantity');
            const sizeInputs = document.querySelectorAll('.sp-size-quantity');
            const addButton = document.getElementById('sp-add-to-quote-btn');
            
            if (!totalInput || !addButton) return;
            
            const totalQuantity = parseInt(totalInput.value) || 0;
            let sizeSum = 0;
            
            sizeInputs.forEach(input => {
                sizeSum += parseInt(input.value) || 0;
            });
            
            const isValid = totalQuantity > 0 && totalQuantity === sizeSum;
            addButton.disabled = !isValid;
            
            // Visual feedback
            if (totalQuantity > 0) {
                if (sizeSum === totalQuantity) {
                    totalInput.style.borderColor = '#4caf50';
                    sizeInputs.forEach(input => input.style.borderColor = '#4caf50');
                } else {
                    totalInput.style.borderColor = '#ff6b6b';
                    sizeInputs.forEach(input => input.style.borderColor = '#ff6b6b');
                }
            } else {
                totalInput.style.borderColor = '';
                sizeInputs.forEach(input => input.style.borderColor = '');
            }
        }

        // Handle add to quote
        handleAddToQuote() {
            const totalInput = document.getElementById('sp-total-quantity');
            const sizeInputs = document.querySelectorAll('.sp-size-quantity');
            
            if (!totalInput || !this.currentPricingData) {
                alert('Please wait for pricing data to load');
                return;
            }
            
            const totalQuantity = parseInt(totalInput.value) || 0;
            
            // Validate quantity
            if (!this.validateQuantity(totalQuantity)) {
                alert('Please enter a valid quantity');
                return;
            }
            
            // Validate size distribution
            if (!this.validateSizeDistribution(sizeInputs, totalQuantity)) {
                alert('Size distribution must equal total quantity');
                return;
            }
            
            // Get configuration from screenprint-adapter
            const config = window.screenPrintAdapter ? window.screenPrintAdapter.getSelectedConfiguration() : null;
            if (!config || !config.selectedColorCount) {
                alert('Please select the number of print colors');
                return;
            }
            
            // Calculate pricing using screenprint-adapter's cached price function
            const priceDetails = window.screenPrintAdapter ? 
                window.screenPrintAdapter.getCachedPrice(config.selectedColorCount, totalQuantity, config.isAdditionalLocation) : 
                null;
                
            if (!priceDetails) {
                alert('Unable to calculate pricing. Please try again.');
                return;
            }
            
            // Build size breakdown
            const sizeBreakdown = {};
            sizeInputs.forEach(input => {
                const size = input.dataset.size;
                const qty = parseInt(input.value) || 0;
                if (qty > 0) {
                    sizeBreakdown[size] = qty;
                }
            });
            
            // Create quote item
            const quoteItem = this.createQuoteItem({
                // Base fields
                styleNumber: this.currentPricingData.styleNumber || 'Unknown',
                productName: this.currentPricingData.productTitle || 'Screen Print Item',
                color: this.currentPricingData.color || 'Unknown',
                quantity: totalQuantity,
                baseUnitPrice: priceDetails.unitPrice || 0,
                
                // Screen print specific fields
                colorCount: config.selectedColorCount,
                hasAdditionalLocation: config.isAdditionalLocation,
                sizeBreakdown: sizeBreakdown,
                setupFee: priceDetails.setupFee || 0,
                flashCharge: priceDetails.flashCharge || 0,
                additionalLocationCost: priceDetails.additionalLocationCost || 0
            });
            
            // Add to quote
            this.addItemToQuote(quoteItem);
            
            // Reset form
            this.resetQuoteBuilder();
            
            // Update inline summary
            this.updateInlineSummary();
        }

        // Override getItemDetailsHTML for screen print specific display
        getItemDetailsHTML(item) {
            let details = `
                <div style="font-size: 0.9em; color: #666;">
                    <div>Qty: ${item.quantity} | ${item.colorCount} Color${item.colorCount > 1 ? 's' : ''}</div>
                    <div>$${item.finalUnitPrice.toFixed(2)}/ea`;
            
            if (item.hasLTM) {
                details += ` <span style="color: #ff6b6b;">(includes LTM)</span>`;
            }
            
            details += `</div>`;
            
            if (item.hasAdditionalLocation) {
                details += `<div style="color: #0056b3;">+ Additional Location</div>`;
            }
            
            // Show size breakdown
            if (item.sizeBreakdown) {
                const sizes = Object.entries(item.sizeBreakdown)
                    .filter(([size, qty]) => qty > 0)
                    .map(([size, qty]) => `${size}:${qty}`)
                    .join(', ');
                details += `<div style="font-size: 0.85em;">Sizes: ${sizes}</div>`;
            }
            
            details += `</div>`;
            return details;
        }

        // Override getAdditionalItemData for screen print specific fields
        getAdditionalItemData(item) {
            return {
                ColorCount: item.colorCount || 1,
                HasAdditionalLocation: item.hasAdditionalLocation ? "Yes" : "No",
                SetupFee: item.setupFee || 0,
                FlashCharge: item.flashCharge || 0,
                AdditionalLocationCost: item.additionalLocationCost || 0,
                SizeBreakdown: JSON.stringify(item.sizeBreakdown || {})
            };
        }

        // Update inline quote summary
        updateInlineSummary() {
            const summaryContent = document.getElementById('sp-quote-summary-content');
            if (!summaryContent) return;
            
            if (this.currentQuote.items.length === 0) {
                summaryContent.innerHTML = '<p style="color: #666; font-style: italic;">No items in quote yet</p>';
            } else {
                let summaryHTML = `
                    <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                        <span>Items: ${this.currentQuote.items.length}</span>
                        <span>Total Qty: ${this.currentQuote.totalQuantity}</span>
                    </div>
                `;
                
                if (this.currentQuote.ltmTotal > 0) {
                    summaryHTML += `
                        <div style="display: flex; justify-content: space-between; color: #ff6b6b;">
                            <span>LTM Fees:</span>
                            <span>$${this.currentQuote.ltmTotal.toFixed(2)}</span>
                        </div>
                    `;
                }
                
                summaryHTML += `
                    <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 1.1em; margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--border-color);">
                        <span>Total:</span>
                        <span>$${this.currentQuote.grandTotal.toFixed(2)}</span>
                    </div>
                `;
                
                summaryContent.innerHTML = summaryHTML;
            }
        }

        // Override resetQuoteBuilder
        resetQuoteBuilder() {
            const totalInput = document.getElementById('sp-total-quantity');
            const sizeInputs = document.querySelectorAll('.sp-size-quantity');
            
            if (totalInput) {
                totalInput.value = '';
                totalInput.style.borderColor = '';
            }
            
            sizeInputs.forEach(input => {
                input.value = '0';
                input.style.borderColor = '';
            });
            
            const ltmIndicator = document.getElementById('sp-ltm-indicator');
            if (ltmIndicator) {
                ltmIndicator.style.display = 'none';
            }
        }

        // Override convertApiItemToQuoteItem for screen print specific conversion
        convertApiItemToQuoteItem(apiItem) {
            const baseItem = super.convertApiItemToQuoteItem(apiItem);
            
            // Add screen print specific fields
            baseItem.colorCount = apiItem.ColorCount || 1;
            baseItem.hasAdditionalLocation = apiItem.HasAdditionalLocation === "Yes";
            baseItem.setupFee = apiItem.SetupFee || 0;
            baseItem.flashCharge = apiItem.FlashCharge || 0;
            baseItem.additionalLocationCost = apiItem.AdditionalLocationCost || 0;
            
            // Parse size breakdown
            try {
                baseItem.sizeBreakdown = JSON.parse(apiItem.SizeBreakdown || '{}');
            } catch (e) {
                baseItem.sizeBreakdown = {};
            }
            
            return baseItem;
        }
    }

    // Initialize when DOM is ready
    function initScreenPrintQuoteAdapter() {
        console.log('[QUOTE:SCREENPRINT] Initializing Screen Print Quote Adapter');
        
        // Create global instance
        window.screenprintQuoteAdapter = new ScreenPrintQuoteAdapter();
        
        // Wait for both pricing adapter and DOM to be ready
        const checkReady = setInterval(() => {
            if (window.screenPrintAdapter && document.getElementById('add-to-cart-section')) {
                clearInterval(checkReady);
                window.screenprintQuoteAdapter.init();
                console.log('[QUOTE:SCREENPRINT] Screen Print Quote Adapter initialized');
            }
        }, 100);
    }

    // Initialize based on DOM state
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initScreenPrintQuoteAdapter);
    } else {
        initScreenPrintQuoteAdapter();
    }

})();