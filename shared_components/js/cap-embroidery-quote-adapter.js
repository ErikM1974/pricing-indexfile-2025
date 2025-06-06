// Cap Embroidery Quote Adapter
// Extends QuoteAdapterBase for cap embroidery specific functionality
// For Northwest Custom Apparel - June 2025

(function() {
    'use strict';
    
    // Force debug logs to always show during development
    const forceDebug = true; // Set to false in production
    
    // Always log module start - with timestamp to verify fresh load
    console.log('[CAP-EMB-QUOTE] === MODULE START === ' + new Date().toISOString());
    console.log('[CAP-EMB-QUOTE] Cap embroidery quote adapter module loading...');
    console.log('[CAP-EMB-QUOTE] Current URL:', window.location.href);
    console.log('[CAP-EMB-QUOTE] DEBUG_MODE:', window.DEBUG_MODE);
    console.log('[CAP-EMB-QUOTE] Force debug:', forceDebug);
    console.log('[CAP-EMB-QUOTE] Script version: 2.1'); // Increment this to verify cache refresh

    // Cap embroidery specific configuration
    const CAP_EMBROIDERY_CONFIG = {
        embellishmentType: 'cap-embroidery',
        ltmThreshold: 24,
        ltmFee: 50.00,
        defaultStitchCount: '8000',
        backLogoPrice: 5.00, // Base price for 5000 stitches
        brandColor: '#2e5827'
    };

    class CapEmbroideryQuoteAdapter extends window.BaseQuoteSystem {
        constructor() {
            console.log('[CAP-EMB-QUOTE] Constructor called');
            console.log('[CAP-EMB-QUOTE] BaseQuoteSystem available:', !!window.BaseQuoteSystem);
            
            super();
            
            console.log('[CAP-EMB-QUOTE] Super constructor completed');
            this.embellishmentType = 'cap-embroidery';
            this.config = CAP_EMBROIDERY_CONFIG;
            this.currentStitchCount = CAP_EMBROIDERY_CONFIG.defaultStitchCount;
            this.backLogoEnabled = false;
            this.currentPricingData = null;
            this.apiClient = window.quoteAPIClient || null;
            this.cumulativePricing = true; // Enable cumulative pricing
            console.log('[CAP-EMB-QUOTE] Constructor completed successfully');
        }

        // Initialize the adapter
        init() {
            console.log('[CAP-EMB-QUOTE] === INIT METHOD CALLED ===');
            console.log('[CAP-EMB-QUOTE] this.embellishmentType:', this.embellishmentType);
            console.log('[CAP-EMB-QUOTE] this.cumulativePricing:', this.cumulativePricing);
            console.log('[CAP-EMB-QUOTE] Available methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(this)).filter(m => typeof this[m] === 'function').slice(0, 10) + '...'); // Show first 10 methods
            
            try {
                // Initialize API client if available
                console.log('[CAP-EMB-QUOTE] Checking for API client...');
                if (window.quoteAPIClient) {
                    this.apiClient = window.quoteAPIClient;
                    console.log('[CAP-EMB-QUOTE] API client set');
                } else {
                    console.log('[CAP-EMB-QUOTE] No API client available');
                }
                
                // Set up the UI
                console.log('[CAP-EMB-QUOTE] Calling setupUI()...');
                this.setupUI();
                console.log('[CAP-EMB-QUOTE] setupUI() completed');
                
                // Initialize event listeners
                console.log('[CAP-EMB-QUOTE] Calling bindEvents()...');
                this.bindEvents();
                console.log('[CAP-EMB-QUOTE] bindEvents() completed');
                
                // Check for existing quote
                console.log('[CAP-EMB-QUOTE] Checking for active quote...');
                this.checkForActiveQuote().then(activeQuote => {
                    console.log('[CAP-EMB-QUOTE] Active quote check completed:', !!activeQuote);
                    if (activeQuote) {
                        this.displayQuoteSummary(activeQuote);
                        this.updatePricingDisplay();
                    }
                }).catch(error => {
                    console.error('[CAP-EMB-QUOTE] Error checking for active quote:', error);
                });
                
                console.log('[CAP-EMB-QUOTE] === INIT METHOD COMPLETED ===');
            } catch (error) {
                console.error('[CAP-EMB-QUOTE] Error in init method:', error);
                console.error('[CAP-EMB-QUOTE] Init error stack:', error.stack);
                throw error; // Re-throw to be caught by outer handler
            }
        }

        // Override setupUI to include cap embroidery specific elements
        setupUI() {
            // Reduce logging to prevent memory issues
            if (window.DEBUG_MODE) {
                console.log('[CAP-EMB-QUOTE] Setting up cap embroidery quote UI');
            }
            
            // Replace "Add to Cart" section with quote builder
            const cartSection = document.getElementById('add-to-cart-section');
            if (cartSection) {
                cartSection.innerHTML = this.getQuoteBuilderHTML();
            }

            // Add quote summary panel
            this.addQuoteSummaryPanel();
            
            // Check for existing active quote
            this.checkForActiveQuote().then(activeQuote => {
                if (activeQuote) {
                    console.log('[CAP-EMB-QUOTE] Found active quote on page load');
                    this.displayQuoteSummary(activeQuote);
                    this.updatePricingDisplay();
                } else {
                    console.log('[CAP-EMB-QUOTE] No active quote found on page load');
                }
            }).catch(error => {
                console.error('[CAP-EMB-QUOTE] Error checking for active quote:', error);
            });

            // Setup stitch count selector
            this.setupStitchCountSelector();
            
            // Populate the size quantity grid
            this.populateSizeQuantityGrid();
            
            // Update pricing display after grid is populated
            setTimeout(() => {
                this.updatePricingDisplay();
            }, 100);
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
                        
                        <!-- Bundle Savings Display -->
                        <div id="bundle-savings-display" style="display: none; margin-top: 15px; padding: 15px; background-color: #e8f5e9; border: 1px solid #4caf50; border-radius: 4px;">
                            <div style="color: #2e7d32; font-weight: bold; margin-bottom: 10px;">💰 Bundle Savings Available!</div>
                            <div id="bundle-savings-details"></div>
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
                    // Reduce logging
                    
                    // Update pricing if we have current pricing data
                    if (this.currentPricingData) {
                        this.updatePricingDisplay();
                    }
                });
                
                // Set initial value
                this.currentStitchCount = stitchCountSelect.value || CAP_EMBROIDERY_CONFIG.defaultStitchCount;
                
            }
        }
        
        // Populate the size quantity grid
        populateSizeQuantityGrid() {
            const gridContainer = document.getElementById('size-quantity-grid');
            if (!gridContainer) return;
            
            // Cap embroidery typically uses OS (One Size) but let's check for available sizes
            const sizes = this.getAvailableSizes();
            
            // Create a simple table for size quantity inputs
            let html = '<table class="size-quantity-table" style="width: 100%; border-collapse: collapse;">';
            html += '<thead><tr>';
            html += '<th style="padding: 10px; text-align: left; border-bottom: 2px solid #ddd;">Size</th>';
            html += '<th style="padding: 10px; text-align: center; border-bottom: 2px solid #ddd;">Quantity</th>';
            html += '<th style="padding: 10px; text-align: right; border-bottom: 2px solid #ddd;">Unit Price</th>';
            html += '</tr></thead>';
            html += '<tbody>';
            
            sizes.forEach(size => {
                html += '<tr>';
                html += `<td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>${size}</strong></td>`;
                html += '<td style="padding: 10px; text-align: center; border-bottom: 1px solid #eee;">';
                html += `<input type="number" class="quantity-input" data-size="${size}" min="0" value="0" style="width: 80px; padding: 5px; text-align: center; border: 1px solid #ccc; border-radius: 4px;">`;
                html += '</td>';
                html += `<td style="padding: 10px; text-align: right; border-bottom: 1px solid #eee;">`;
                html += `<span class="size-price-display" data-size="${size}">$0.00</span>`;
                html += '</td>';
                html += '</tr>';
            });
            
            html += '</tbody></table>';
            
            // Add total row
            html += '<div style="margin-top: 15px; padding: 10px; background-color: #f8f9fa; border-radius: 4px;">';
            html += '<div style="display: flex; justify-content: space-between; align-items: center;">';
            html += '<span><strong>Total Quantity:</strong> <span class="total-quantity">0</span></span>';
            html += '<span><strong>Total Price:</strong> <span class="total-price">$0.00</span></span>';
            html += '</div>';
            html += '</div>';
            
            gridContainer.innerHTML = html;
            
            // Add event listeners to quantity inputs
            const quantityInputs = gridContainer.querySelectorAll('.quantity-input');
            quantityInputs.forEach(input => {
                input.addEventListener('input', () => this.updateQuantityTotals());
            });
        }
        
        // Get available sizes (for caps, typically just OS but some have S/M, M/L, L/XL)
        getAvailableSizes() {
            console.log('[CAP-EMB-QUOTE] Getting available sizes, currentPricingData:', this.currentPricingData);
            
            // Check if we have size data from the pricing system
            if (this.currentPricingData) {
                // Check for sizes in the pricing data (sent from cap-embroidery-controller-v2)
                if (this.currentPricingData.sizes && Array.isArray(this.currentPricingData.sizes)) {
                    console.log('[CAP-EMB-QUOTE] Using sizes from pricing data:', this.currentPricingData.sizes);
                    return this.currentPricingData.sizes;
                }
                
                // Also check availableSizes property
                if (this.currentPricingData.availableSizes && Array.isArray(this.currentPricingData.availableSizes)) {
                    console.log('[CAP-EMB-QUOTE] Using availableSizes from pricing data:', this.currentPricingData.availableSizes);
                    return this.currentPricingData.availableSizes;
                }
                
                // Check if prices object has size keys
                if (this.currentPricingData.prices) {
                    const priceKeys = Object.keys(this.currentPricingData.prices);
                    console.log('[CAP-EMB-QUOTE] Price keys:', priceKeys);
                    
                    // Extract unique sizes from price keys
                    // Price keys might be like "8000_S/M", "8000_M/L", etc.
                    const sizes = new Set();
                    
                    // First check if we have tier-based pricing (e.g., {"S/M": {"24-47": 25, "48-71": 23}})
                    for (const key of priceKeys) {
                        if (key.includes('/') && !key.includes('_')) {
                            // This looks like a size key (S/M, M/L, L/XL)
                            sizes.add(key);
                        }
                    }
                    
                    // If we found sizes this way, use them
                    if (sizes.size > 0) {
                        const sizeArray = Array.from(sizes);
                        console.log('[CAP-EMB-QUOTE] Extracted sizes from tier pricing:', sizeArray);
                        return sizeArray;
                    }
                    
                    // Otherwise try to extract from stitch_size format
                    priceKeys.forEach(key => {
                        const parts = key.split('_');
                        if (parts.length >= 2) {
                            const size = parts[parts.length - 1]; // Get last part
                            if (size && size !== key) { // Make sure we actually split something
                                sizes.add(size);
                            }
                        }
                    });
                    
                    if (sizes.size > 0) {
                        const sizeArray = Array.from(sizes);
                        console.log('[CAP-EMB-QUOTE] Extracted sizes from price keys:', sizeArray);
                        return sizeArray;
                    }
                }
            }
            
            // Default for cap embroidery - most caps are OS, but some have sized options
            console.log('[CAP-EMB-QUOTE] Using default size: OS');
            return ['OS']; // One Size
        }
        
        // Update quantity totals
        updateQuantityTotals() {
            console.log('[CAP-EMB-QUOTE] updateQuantityTotals called');
            let totalQuantity = 0;
            let totalPrice = 0;
            
            const quantityInputs = document.querySelectorAll('.quantity-input[data-size]');
            const sizeQuantities = {};
            
            quantityInputs.forEach(input => {
                const qty = parseInt(input.value) || 0;
                const size = input.getAttribute('data-size');
                totalQuantity += qty;
                
                if (qty > 0) {
                    sizeQuantities[size] = qty;
                    if (this.currentPricingData) {
                        const basePrice = this.getBasePriceForSize(size);
                        const backLogoPrice = this.backLogoEnabled ? this.getCurrentBackLogoPrice() : 0;
                        const unitPrice = basePrice + backLogoPrice;
                        totalPrice += unitPrice * qty;
                    }
                }
            });
            
            // Update displays
            const totalQtyEl = document.querySelector('.total-quantity');
            const totalPriceEl = document.querySelector('.total-price');
            
            if (totalQtyEl) totalQtyEl.textContent = totalQuantity;
            if (totalPriceEl) totalPriceEl.textContent = `$${totalPrice.toFixed(2)}`;
            
            // Check for bundle savings
            if (totalQuantity > 0 && this.currentQuote.totalQuantity > 0) {
                const mockItem = {
                    quantity: totalQuantity,
                    sizeBreakdown: sizeQuantities
                };
                const bundleSavings = this.showBundleSavings(mockItem);
                this.displayBundleSavings(bundleSavings);
            } else {
                this.hideBundleSavings();
            }
            
            // Update pricing display for tier pricing
            this.updatePricingDisplay();
        }

        // Override bindEvents to include cap embroidery specific events
        bindEvents() {
            // Only call parent bindEvents if it exists
            if (super.bindEvents) {
                super.bindEvents();
            }
            
            // Clean up any existing event listeners first
            if (this.boundHandleAddToQuote) {
                const oldBtn = document.getElementById('add-to-quote-btn');
                if (oldBtn) {
                    oldBtn.removeEventListener('click', this.boundHandleAddToQuote);
                }
            }
            
            // Add to quote button
            const addToQuoteBtn = document.getElementById('add-to-quote-btn');
            if (addToQuoteBtn) {
                this.boundHandleAddToQuote = () => this.handleAddToQuote();
                addToQuoteBtn.addEventListener('click', this.boundHandleAddToQuote);
            }

            // Store event listeners for cleanup
            this.eventHandlers = this.eventHandlers || {};
            
            // Remove existing listeners before adding new ones
            this.cleanupEventListeners();
            
            // Listen for pricing data updates
            this.eventHandlers.pricingDataUpdated = (e) => {
                console.log('[CAP-EMB-QUOTE] Pricing data updated event received');
                console.log('[CAP-EMB-QUOTE] Event detail:', JSON.stringify(e.detail));
                this.currentPricingData = e.detail;
                
                // Check if we need to update available sizes
                const currentSizes = this.getAvailableSizes();
                const gridContainer = document.getElementById('size-quantity-grid');
                
                if (gridContainer && currentSizes.length > 0) {
                    const existingInputs = gridContainer.querySelectorAll('.quantity-input[data-size]');
                    const existingSizes = Array.from(existingInputs).map(input => input.getAttribute('data-size'));
                    
                    // Check if sizes have changed
                    const sizesChanged = currentSizes.length !== existingSizes.length || 
                                       !currentSizes.every(size => existingSizes.includes(size));
                    
                    if (existingInputs.length === 0 || sizesChanged) {
                        console.log('[CAP-EMB-QUOTE] Sizes changed, repopulating grid. Old:', existingSizes, 'New:', currentSizes);
                        // Save current quantities before repopulating
                        const savedQuantities = {};
                        existingInputs.forEach(input => {
                            const size = input.getAttribute('data-size');
                            const qty = parseInt(input.value) || 0;
                            if (qty > 0) {
                                savedQuantities[size] = qty;
                            }
                        });
                        
                        // Repopulate grid
                        this.populateSizeQuantityGrid();
                        
                        // Restore quantities for matching sizes
                        Object.entries(savedQuantities).forEach(([size, qty]) => {
                            const newInput = gridContainer.querySelector(`.quantity-input[data-size="${size}"]`);
                            if (newInput) {
                                newInput.value = qty;
                            }
                        });
                    }
                }
                // Ensure pricing display is updated after grid is populated
                setTimeout(() => {
                    this.updatePricingDisplay();
                }, 100);
            };
            console.log('[CAP-EMB-QUOTE] Registering pricingDataUpdated event listener');
            document.addEventListener('pricingDataUpdated', this.eventHandlers.pricingDataUpdated);

            // Listen for color selection changes
            this.eventHandlers.colorSelected = (e) => {
                // Handle color selection if needed
            };
            document.addEventListener('colorSelected', this.eventHandlers.colorSelected);
            
            // Listen for back logo add-on changes
            this.eventHandlers.backLogoToggled = (e) => {
                this.backLogoEnabled = e.detail.enabled;
                this.updatePricingDisplay();
            };
            document.addEventListener('backLogoToggled', this.eventHandlers.backLogoToggled);
            
            this.eventHandlers.backLogoUpdated = (e) => {
                this.updatePricingDisplay();
            };
            document.addEventListener('backLogoUpdated', this.eventHandlers.backLogoUpdated);
        }


        // Get current back logo price from the independent add-on system
        // Cleanup event listeners to prevent memory leaks
        cleanupEventListeners() {
            if (this.eventHandlers) {
                Object.entries(this.eventHandlers).forEach(([event, handler]) => {
                    document.removeEventListener(event, handler);
                });
            }
        }
        
        // Get current quote items (for quote dropdown)
        getItems() {
            return this.currentQuote ? this.currentQuote.items : [];
        }

        getCurrentBackLogoPrice() {
            if (window.CapEmbroideryBackLogoAddon) {
                return window.CapEmbroideryBackLogoAddon.getPrice();
            }
            // Fallback calculation
            return 5.00;
        }

        // Update pricing display based on current selections
        updatePricingDisplay() {
            console.log('[CAP-EMB-QUOTE] updatePricingDisplay called, currentPricingData:', this.currentPricingData);
            if (!this.currentPricingData) return;

            // Check if back logo is enabled from the add-on system
            const backLogoEnabled = window.CapEmbroideryBackLogoAddon ? window.CapEmbroideryBackLogoAddon.isEnabled() : false;

            // Update size quantity grid with current prices
            const priceDisplays = document.querySelectorAll('.size-price-display[data-size]');
            console.log('[CAP-EMB-QUOTE] Found price displays:', priceDisplays.length);
            
            priceDisplays.forEach(display => {
                const size = display.getAttribute('data-size');
                
                if (this.currentPricingData.prices) {
                    const basePrice = this.getBasePriceForSize(size);
                    const currentBackLogoPrice = this.getCurrentBackLogoPrice();
                    const totalPrice = basePrice + (backLogoEnabled ? currentBackLogoPrice : 0);
                    console.log(`[CAP-EMB-QUOTE] Updating price for ${size}: base=${basePrice}, backLogo=${currentBackLogoPrice}, total=${totalPrice}`);
                    display.textContent = `$${totalPrice.toFixed(2)}`;
                }
            });
            
            // Update totals
            this.updateQuantityTotals();
        }

        // Get base price for a specific size
        getBasePriceForSize(size) {
            if (!this.currentPricingData || !this.currentPricingData.prices) {
                console.log('[CAP-EMB-QUOTE] No pricing data available');
                return 0;
            }
            
            const prices = this.currentPricingData.prices;
            console.log('[CAP-EMB-QUOTE] Getting base price for size:', size, 'from prices:', prices);
            
            // Check if we have direct size pricing structure (e.g., prices["S/M"]["24-47"])
            if (prices[size] && typeof prices[size] === 'object') {
                // We have tier-based pricing for this size
                const tierPrices = prices[size];
                const tierKeys = Object.keys(tierPrices).sort((a, b) => {
                    // Sort tiers by minimum quantity
                    const aMin = parseInt(a.split('-')[0]) || parseInt(a.replace('+', '')) || 0;
                    const bMin = parseInt(b.split('-')[0]) || parseInt(b.replace('+', '')) || 0;
                    return aMin - bMin;
                });
                
                if (tierKeys.length > 0) {
                    // Get current quantity to determine tier
                    const currentQty = this.getTotalQuantityFromInputs();
                    const existingQty = this.currentQuote ? this.currentQuote.totalQuantity : 0;
                    const totalQty = currentQty + existingQty;
                    
                    // Find appropriate tier
                    let selectedTier = tierKeys[0]; // Default to first tier
                    for (const tier of tierKeys) {
                        const [min, max] = tier.split('-').map(s => parseInt(s.replace('+', '')) || 999999);
                        if (totalQty >= min && (tier.includes('+') || totalQty <= max)) {
                            selectedTier = tier;
                            break;
                        }
                    }
                    
                    console.log('[CAP-EMB-QUOTE] Selected tier:', selectedTier, 'for quantity:', totalQty);
                    return parseFloat(tierPrices[selectedTier]) || 0;
                }
            }
            
            // Try stitch count + size format (e.g., "8000_S/M")
            const stitchSizeKey = `${this.currentStitchCount}_${size}`;
            if (prices[stitchSizeKey]) {
                console.log('[CAP-EMB-QUOTE] Found price with stitch+size key:', stitchSizeKey);
                return parseFloat(prices[stitchSizeKey]) || 0;
            }
            
            // Try just stitch count (for OS items)
            if (size === 'OS' && prices[this.currentStitchCount]) {
                console.log('[CAP-EMB-QUOTE] Found price with stitch count only:', this.currentStitchCount);
                return parseFloat(prices[this.currentStitchCount]) || 0;
            }
            
            console.log('[CAP-EMB-QUOTE] No price found for size:', size);
            return 0;
        }

        // Override getTierPrice for cap embroidery specific pricing
        getTierPrice(item, tier) {
            if (!this.currentPricingData || !this.currentPricingData.prices) {
                return super.getTierPrice(item, tier);
            }
            
            // For cap embroidery with current stitch count
            const prices = this.currentPricingData.prices;
            const sizeKey = Object.keys(prices)[0]; // Usually 'OS' or 'One Size'
            
            if (prices[sizeKey] && prices[sizeKey][tier]) {
                return prices[sizeKey][tier];
            }
            
            return super.getTierPrice(item, tier);
        }

        // Handle add to quote
        async handleAddToQuote() {
            
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
            
            // Only log in debug mode
            if (window.DEBUG_MODE) {
                console.log('[CAP-EMB-QUOTE] Back logo state:', {
                    backLogoEnabled,
                    backLogoStitchCount,
                    backLogoPrice
                });
            }

            // Capture product image with validation
            const productImage = await this.captureProductImage(selectedColor);

            // Create quote item
            const itemData = {
                styleNumber: styleNumber,
                productName: productTitle,
                color: selectedColor,
                colorCode: selectedColor.toUpperCase().replace(/\s+/g, '_'),
                quantity: totalQuantity,
                baseUnitPrice: pricing.baseUnitPrice,
                stitchCount: this.currentStitchCount,
                hasBackLogo: backLogoEnabled,
                backLogoStitchCount: backLogoStitchCount,
                backLogoPrice: backLogoPrice,
                sizeBreakdown: sizeQuantities,
                sizePricing: pricing.sizePricing,
                imageURL: productImage,
                pricingTier: this.determinePricingTier(totalQuantity)
            };
            
            // Show bundle savings if quote exists
            if (this.currentQuote.totalQuantity > 0) {
                const mockItem = {
                    quantity: totalQuantity,
                    baseUnitPrice: pricing.baseUnitPrice
                };
                const bundleSavings = this.showBundleSavings(mockItem, pricing.baseUnitPrice);
                this.displayBundleSavings(bundleSavings);
                
                // Wait for user to see savings
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            
            const quoteItem = this.createQuoteItem(itemData);

            // Create quote session if this is the first item
            if (!this.currentQuote.id && this.apiClient) {
                try {
                    const sessionData = {
                        QuoteID: this.apiClient.generateQuoteID(),
                        SessionID: this.apiClient.generateSessionID(),
                        Status: 'Active',
                        CustomerEmail: '', // Will be filled when saving/emailing
                        CustomerName: '',
                        CompanyName: '',
                        Phone: '',
                        TotalQuantity: totalQuantity,
                        SubtotalAmount: 0,
                        LTMFeeTotal: 0,
                        TotalAmount: 0,
                        CreatedAt: new Date().toISOString(),
                        UpdatedAt: new Date().toISOString(),
                        ExpiresAt: new Date(Date.now() + 30*24*60*60*1000).toISOString(),
                        Notes: JSON.stringify({
                            embellishmentType: 'cap-embroidery',
                            createdFrom: window.location.href
                        })
                    };

                    const response = await this.apiClient.createQuoteSession(sessionData);
                    
                    console.log('[CAP-EMB-QUOTE] Quote session response:', response);
                    console.log('[CAP-EMB-QUOTE] Response type:', typeof response);
                    console.log('[CAP-EMB-QUOTE] Response keys:', response ? Object.keys(response) : 'null');
                    
                    // Update local quote with API response
                    this.currentQuote.id = response.QuoteID || sessionData.QuoteID;
                    this.currentQuote.sessionId = response.SessionID || sessionData.SessionID;
                    this.currentQuote.apiId = response.PK_ID;
                    
                    // Extra validation and workaround for "records" issue
                    if (!this.currentQuote.apiId || this.currentQuote.apiId === 'records') {
                        console.error('[CAP-EMB-QUOTE] Invalid API ID received:', this.currentQuote.apiId);
                        
                        // Try to extract ID from location if available
                        if (response.location) {
                            const match = response.location.match(/\/(\d+)$/);
                            if (match) {
                                this.currentQuote.apiId = match[1];
                                console.log('[CAP-EMB-QUOTE] Extracted ID from location:', this.currentQuote.apiId);
                            }
                        }
                        
                        // If still no valid ID, generate temporary one
                        if (!this.currentQuote.apiId || this.currentQuote.apiId === 'records') {
                            this.currentQuote.apiId = 'TEMP_' + Date.now();
                            console.log('[CAP-EMB-QUOTE] Using temporary ID:', this.currentQuote.apiId);
                        }
                    }
                    
                    console.log('[CAP-EMB-QUOTE] Quote session created:', {
                        id: this.currentQuote.id,
                        sessionId: this.currentQuote.sessionId,
                        apiId: this.currentQuote.apiId
                    });
                } catch (error) {
                    console.error('[CAP-EMB-QUOTE] Failed to create quote session:', error);
                    // Generate local IDs as fallback
                    this.currentQuote.id = 'LOCAL_' + Date.now();
                    this.currentQuote.sessionId = 'LOCAL_SESS_' + Date.now();
                }
            }

            // Add to quote locally
            await this.addItemToQuote(quoteItem);

            // Save item to API if we have a quote ID
            if (this.apiClient && this.currentQuote.id && !this.currentQuote.id.startsWith('LOCAL_')) {
                try {
                    // Store cap-specific data in SizeBreakdown field along with sizes
                    const extendedData = {
                        sizes: quoteItem.sizeBreakdown || {},
                        capDetails: {
                            stitchCount: quoteItem.stitchCount,
                            hasBackLogo: quoteItem.hasBackLogo,
                            backLogoStitchCount: quoteItem.backLogoStitchCount || 0,
                            backLogoPrice: quoteItem.backLogoPrice || 0
                        }
                    };

                    const apiItemData = {
                        QuoteID: this.currentQuote.id,
                        LineNumber: quoteItem.lineNumber,
                        StyleNumber: quoteItem.styleNumber,
                        ProductName: quoteItem.productName,
                        Color: quoteItem.color,
                        ColorCode: quoteItem.colorCode,
                        EmbellishmentType: 'cap-embroidery',
                        PrintLocation: quoteItem.hasBackLogo ? 'CAP_FRONT_BACK' : 'CAP_FRONT',
                        PrintLocationName: quoteItem.hasBackLogo ? 'Cap Front & Back' : 'Cap Front',
                        Quantity: quoteItem.quantity,
                        HasLTM: quoteItem.hasLTM ? 'Yes' : 'No',
                        BaseUnitPrice: quoteItem.baseUnitPrice,
                        LTMPerUnit: quoteItem.ltmPerUnit,
                        FinalUnitPrice: quoteItem.finalUnitPrice,
                        LineTotal: quoteItem.lineTotal,
                        SizeBreakdown: JSON.stringify(extendedData), // Contains both sizes and cap details
                        PricingTier: quoteItem.pricingTier,
                        ImageURL: quoteItem.imageURL,
                        AddedAt: new Date().toISOString()
                    };

                    const savedItem = await this.apiClient.createQuoteItem(apiItemData);
                    quoteItem.apiId = savedItem.PK_ID;
                    
                    // Update quote session totals
                    await this.updateQuoteSessionTotals();
                    
                } catch (error) {
                    console.error('[CAP-EMB-QUOTE] Failed to save item to API:', error);
                    // Continue anyway - item is saved locally
                }
            }

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
            // Use the actual pricing calculator to get accurate pricing
            if (window.NWCAPricingCalculator && window.nwcaPricingData) {
                const existingCartQuantity = 0; // For quotes, we start fresh
                const calculatedPricing = window.NWCAPricingCalculator.calculatePricing(
                    sizeQuantities, 
                    existingCartQuantity, 
                    window.nwcaPricingData
                );
                
                // Extract the base unit price (without LTM, without back logo)
                let totalBasePrice = 0;
                let totalQuantity = 0;
                
                Object.entries(calculatedPricing.items || {}).forEach(([size, item]) => {
                    if (item.quantity > 0) {
                        // The item object from pricing calculator has these properties:
                        // - baseUnitPrice: the base tier price (what we want)
                        // - unitPrice: base + fees 
                        // - displayUnitPrice: base + fees + back logo (if added by enhanced adapter)
                        const basePrice = item.baseUnitPrice || 0;
                        totalBasePrice += basePrice * item.quantity;
                        totalQuantity += item.quantity;
                    }
                });
                
                const baseUnitPrice = totalQuantity > 0 ? totalBasePrice / totalQuantity : 0;
                
                return {
                    baseUnitPrice: baseUnitPrice,  // Front logo price only
                    sizePricing: calculatedPricing.items || {}
                };
            }
            
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

        // Create quote item from data
        createQuoteItem(itemData) {
            const lineNumber = this.currentQuote.items.length + 1;
            const ltmFee = this.calculateLTMFee(this.currentQuote.totalQuantity + itemData.quantity, itemData.quantity);
            const hasLTM = ltmFee > 0;
            
            // Calculate final unit price including all add-ons
            const finalUnitPrice = itemData.baseUnitPrice + ltmFee + (itemData.backLogoPrice || 0);
            
            const quoteItem = {
                id: 'item_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
                lineNumber: lineNumber,
                styleNumber: itemData.styleNumber,
                productName: itemData.productName,
                color: itemData.color,
                colorCode: itemData.colorCode,
                quantity: itemData.quantity,
                baseUnitPrice: itemData.baseUnitPrice,
                ltmPerUnit: ltmFee,
                finalUnitPrice: finalUnitPrice,
                lineTotal: finalUnitPrice * itemData.quantity,
                hasLTM: hasLTM,
                pricingTier: itemData.pricingTier || this.determinePricingTier(itemData.quantity),
                sizeBreakdown: itemData.sizeBreakdown || {},
                imageURL: itemData.imageURL || '',
                // Cap embroidery specific fields
                stitchCount: itemData.stitchCount,
                hasBackLogo: itemData.hasBackLogo || false,
                backLogoStitchCount: itemData.backLogoStitchCount || 0,
                backLogoPrice: itemData.backLogoPrice || 0,
                addedAt: new Date().toISOString()
            };
            
            return quoteItem;
        }

        // Override getAdditionalItemData for cap embroidery specific fields
        getAdditionalItemData(item) {
            // Store cap-specific data in SizeBreakdown field along with sizes
            const extendedData = {
                sizes: item.sizeBreakdown || {},
                capDetails: {
                    stitchCount: item.stitchCount,
                    hasBackLogo: item.hasBackLogo,
                    backLogoStitchCount: item.backLogoStitchCount || 0,
                    backLogoPrice: item.backLogoPrice || 0
                }
            };

            return {
                PrintLocation: item.hasBackLogo ? 'CAP_FRONT_BACK' : 'CAP_FRONT',
                PrintLocationName: item.hasBackLogo ? 'Cap Front & Back' : 'Cap Front',
                SizeBreakdown: JSON.stringify(extendedData),
                PricingTier: this.determinePricingTier(item.quantity)
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
            // Update quote summary display
            this.displayQuoteSummary();
            
            // Update cap-specific LTM display if validation module is available
            if (window.CapEmbroideryValidation && this.currentQuote.ltmTotal > 0) {
                window.CapEmbroideryValidation.updateCapLTMDisplay(
                    this.currentQuote.totalQuantity,
                    this.currentQuote.ltmTotal
                );
            }
        }

        // Update quote session totals in the API
        async updateQuoteSessionTotals() {
            if (!this.apiClient) return;
            
            // Check if we have a valid API ID (skip temporary IDs)
            if (!this.currentQuote.apiId || this.currentQuote.apiId === 'records' || this.currentQuote.apiId.startsWith('TEMP_')) {
                console.warn('[CAP-EMB-QUOTE] Invalid, missing, or temporary API ID, skipping update');
                return;
            }
            
            try {
                const updates = {
                    TotalQuantity: this.currentQuote.totalQuantity,
                    SubtotalAmount: this.currentQuote.subtotal,
                    LTMFeeTotal: this.currentQuote.ltmTotal,
                    TotalAmount: this.currentQuote.grandTotal,
                    UpdatedAt: new Date().toISOString()
                };
                
                console.log('[CAP-EMB-QUOTE] Updating quote session with ID:', this.currentQuote.apiId);
                await this.apiClient.updateQuoteSession(this.currentQuote.apiId, updates);
                console.log('[CAP-EMB-QUOTE] Quote session totals updated');
            } catch (error) {
                console.error('[CAP-EMB-QUOTE] Failed to update quote session totals:', error);
                // Don't throw, just log the error
            }
        }

        // Override convertApiItemToQuoteItem for cap embroidery specific conversion
        convertApiItemToQuoteItem(apiItem) {
            // Use base convertApiItemToLocal if available, otherwise do manual conversion
            const baseItem = this.convertApiItemToLocal ? this.convertApiItemToLocal(apiItem) : {
                id: 'item_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
                apiId: apiItem.PK_ID,
                lineNumber: apiItem.LineNumber,
                styleNumber: apiItem.StyleNumber,
                productName: apiItem.ProductName,
                color: apiItem.Color,
                colorCode: apiItem.ColorCode,
                quantity: apiItem.Quantity,
                baseUnitPrice: apiItem.BaseUnitPrice || 0,
                ltmPerUnit: apiItem.LTMPerUnit || 0,
                finalUnitPrice: apiItem.FinalUnitPrice || 0,
                lineTotal: apiItem.LineTotal || 0,
                hasLTM: apiItem.HasLTM === 'Yes',
                sizeBreakdown: {},
                pricingTier: apiItem.PricingTier,
                imageURL: apiItem.ImageURL,
                addedAt: apiItem.AddedAt
            };
            
            // Parse extended data from SizeBreakdown field
            let sizeBreakdown = {};
            let capDetails = {
                stitchCount: '8000',
                hasBackLogo: false,
                backLogoStitchCount: 0,
                backLogoPrice: 0
            };
            
            if (apiItem.SizeBreakdown) {
                try {
                    const extendedData = JSON.parse(apiItem.SizeBreakdown);
                    if (extendedData.sizes) {
                        sizeBreakdown = extendedData.sizes;
                    }
                    if (extendedData.capDetails) {
                        capDetails = extendedData.capDetails;
                    }
                } catch (e) {
                    // Fallback for old format (just sizes)
                    try {
                        sizeBreakdown = JSON.parse(apiItem.SizeBreakdown);
                    } catch (e2) {
                        console.error('[CAP-EMB-QUOTE] Error parsing SizeBreakdown:', e2);
                    }
                }
            }
            
            // Check PrintLocation for back logo indicator
            const hasBackLogo = capDetails.hasBackLogo || 
                               apiItem.PrintLocation === 'CAP_FRONT_BACK' ||
                               apiItem.PrintLocationName?.includes('Back');
            
            // Add cap embroidery specific fields
            return {
                ...baseItem,
                stitchCount: capDetails.stitchCount || '8000',
                hasBackLogo: hasBackLogo,
                backLogoStitchCount: capDetails.backLogoStitchCount || 0,
                backLogoPrice: capDetails.backLogoPrice || 0,
                sizeBreakdown: sizeBreakdown,
                sizePricing: apiItem.SizePricing ? JSON.parse(apiItem.SizePricing) : {}
            };
        }

        // Determine pricing tier based on quantity
        determinePricingTier(quantity) {
            if (quantity >= 72) return '72+';
            if (quantity >= 48) return '48-71';
            if (quantity >= 24) return '24-47';
            return '1-23';
        }

        // Save item to API
        async saveItemToAPI(item) {
            if (!this.apiClient) return;
            
            try {
                const apiItem = this.apiClient.formatQuoteItemForAPI(item, this.currentQuote.id, item.lineNumber);
                const savedItem = await this.apiClient.createQuoteItem(apiItem);
                
                // Update local item with API ID
                item.apiId = savedItem.PK_ID;
                // Item saved successfully
                
                // Track analytics
                await this.apiClient.trackEvent({
                    SessionID: this.currentQuote.sessionId,
                    QuoteID: this.currentQuote.id,
                    EventType: 'item_added',
                    StyleNumber: item.styleNumber,
                    Color: item.color,
                    Quantity: item.quantity,
                    PriceShown: item.finalUnitPrice
                });
                
            } catch (error) {
                console.error('[CAP-EMB-QUOTE] Failed to save item to API:', error);
                throw error;
            }
        }

        // Override saveQuote to ensure quote session exists
        async saveQuote() {
            try {
                if (!this.apiClient) {
                    console.warn('[CAP-EMB-QUOTE] API client not available, saving to local storage only');
                    this.saveQuoteToStorage();
                    return;
                }

                // Create or update quote session
                if (!this.currentQuote.id) {
                    this.currentQuote.id = this.apiClient.generateQuoteID();
                }

                let quoteSession;
                const existingSession = await this.apiClient.getQuoteSessionByQuoteID(this.currentQuote.id);
                
                if (existingSession) {
                    // Update existing session
                    quoteSession = await this.apiClient.updateQuoteSession(existingSession.PK_ID, {
                        Status: 'Active',
                        Notes: `Cap Embroidery Quote - ${this.currentQuote.items.length} items, Total: $${this.currentQuote.grandTotal.toFixed(2)}`
                    });
                } else {
                    // Create new session
                    const sessionData = {
                        QuoteID: this.currentQuote.id,
                        SessionID: this.currentQuote.sessionId,
                        Status: 'Active',
                        Notes: `Cap Embroidery Quote - ${this.currentQuote.items.length} items, Total: $${this.currentQuote.grandTotal.toFixed(2)}`
                    };
                    
                    quoteSession = await this.apiClient.createQuoteSession(sessionData);
                }

                // Quote session saved successfully

                // Save each item that doesn't have an API ID
                for (const item of this.currentQuote.items) {
                    if (!item.apiId) {
                        await this.saveItemToAPI(item);
                    }
                }

                // Show success with copy-able quote ID
                this.showQuoteSavedModal(this.currentQuote.id);

                // Track analytics
                await this.apiClient.trackEvent({
                    SessionID: this.currentQuote.sessionId,
                    QuoteID: this.currentQuote.id,
                    EventType: 'quote_saved',
                    Quantity: this.currentQuote.totalQuantity,
                    PriceShown: this.currentQuote.grandTotal
                });

            } catch (error) {
                console.error('[CAP-EMB-QUOTE] Error saving quote:', error);
                alert('Error saving quote: ' + error.message);
            }
        }

        // Show quote saved modal with copy functionality
        showQuoteSavedModal(quoteID) {
            const modal = document.createElement('div');
            modal.className = 'quote-saved-modal';
            modal.innerHTML = `
                <div class="modal-overlay" onclick="this.parentElement.remove()"></div>
                <div class="modal-content">
                    <h3>✅ Quote Saved Successfully!</h3>
                    <div class="quote-id-display">
                        <label>Quote ID:</label>
                        <div class="quote-id-copy">
                            <input type="text" value="${quoteID}" readonly id="quote-id-input">
                            <button onclick="navigator.clipboard.writeText('${quoteID}').then(() => {
                                this.textContent = '✅ Copied!';
                                setTimeout(() => this.textContent = '📋 Copy', 2000);
                            })">📋 Copy</button>
                        </div>
                    </div>
                    <p>Share this ID to retrieve your quote later</p>
                    <button class="modal-close-btn" onclick="this.closest('.quote-saved-modal').remove()">
                        Close
                    </button>
                </div>
            `;
            document.body.appendChild(modal);
        }

        // Override loadQuote to use API client
        async loadQuote(quoteId) {
            if (!this.apiClient) {
                console.warn('[CAP-EMB-QUOTE] API client not available, cannot load quote');
                return null;
            }

            try {
                
                // Get quote session
                const quoteSession = await this.apiClient.getQuoteSessionByQuoteID(quoteId);
                if (!quoteSession) {
                    throw new Error('Quote not found');
                }

                // Get quote items
                const apiItems = await this.apiClient.getQuoteItems(quoteId);
                
                // Reset current quote
                this.currentQuote = this.initializeQuote();
                this.currentQuote.id = quoteSession.QuoteID;
                this.currentQuote.sessionId = quoteSession.SessionID;

                // Convert and add items
                for (const apiItem of apiItems) {
                    const localItem = this.apiClient.convertAPIItemToLocal(apiItem);
                    this.currentQuote.items.push(localItem);
                }

                // Update totals and display
                this.updateQuoteTotals();
                this.updateQuoteSummary();
                this.saveQuoteToStorage();

                // Track analytics
                await this.apiClient.trackEvent({
                    SessionID: this.currentQuote.sessionId,
                    QuoteID: quoteId,
                    EventType: 'quote_loaded'
                });

                return {
                    session: quoteSession,
                    items: apiItems
                };

            } catch (error) {
                console.error('[CAP-EMB-QUOTE] Error loading quote:', error);
                throw error;
            }
        }

        // Override removeItem to also remove from API
        async removeItem(itemId) {
            const item = this.currentQuote.items.find(i => i.id === itemId);
            
            // Remove from API if it has an API ID
            if (item && item.apiId && this.apiClient) {
                try {
                    await this.apiClient.deleteQuoteItem(item.apiId);
                    // Item removed successfully
                } catch (error) {
                    console.error('[CAP-EMB-QUOTE] Failed to remove item from API:', error);
                }
            }

            // Remove locally
            super.removeItem(itemId);
        }

        // Display bundle savings comparison
        displayBundleSavings(savingsInfo) {
            const savingsDisplay = document.getElementById('bundle-savings-display');
            const savingsDetails = document.getElementById('bundle-savings-details');
            
            if (!savingsDisplay || !savingsDetails) return;
            
            if (savingsInfo.showSavings) {
                savingsDisplay.style.display = 'block';
                savingsDetails.innerHTML = `
                    <div style="margin-bottom: 10px;">
                        <strong>Price if ordered alone:</strong> $${savingsInfo.alonePrice.toFixed(2)} per cap
                    </div>
                    <div style="margin-bottom: 10px;">
                        <strong>Price with bundle (${savingsInfo.bundleQuantity} total):</strong> 
                        <span style="color: #2e7d32; font-weight: bold;">$${savingsInfo.bundlePrice.toFixed(2)} per cap</span>
                    </div>
                    <div style="background-color: #fff3cd; padding: 10px; border-radius: 4px; border: 1px solid #ffeaa7;">
                        <strong>You save: $${savingsInfo.savings.toFixed(2)} total!</strong>
                    </div>
                    <div style="margin-top: 10px; font-size: 0.9em; color: #666;">
                        ${savingsInfo.message}
                    </div>
                `;
            } else {
                savingsDisplay.style.display = 'none';
            }
        }

        // Hide bundle savings display
        hideBundleSavings() {
            const savingsDisplay = document.getElementById('bundle-savings-display');
            if (savingsDisplay) {
                savingsDisplay.style.display = 'none';
            }
        }

        // Add quote summary panel to page
        addQuoteSummaryPanel() {
            console.log('[CAP-EMB-QUOTE] addQuoteSummaryPanel called');
            
            // Check if panel already exists
            if (document.getElementById('cumulative-quote-summary')) {
                console.log('[CAP-EMB-QUOTE] Quote summary panel already exists');
                return;
            }
            
            console.log('[CAP-EMB-QUOTE] Creating quote summary panel');
            
            // Create summary panel
            const summaryPanel = document.createElement('div');
            summaryPanel.id = 'cumulative-quote-summary';
            summaryPanel.className = 'quote-summary-panel';
            summaryPanel.style.cssText = `
                position: fixed;
                bottom: 20px;
                right: 20px;
                background: white;
                border: 2px solid ${this.config.brandColor};
                border-radius: 8px;
                padding: 15px;
                box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                z-index: 1000;
                min-width: 250px;
                display: none;
            `;
            
            summaryPanel.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <h4 style="margin: 0; color: ${this.config.brandColor};">Quote Summary</h4>
                    <button onclick="window.capEmbroideryQuoteAdapter.hideSummaryPanel()" 
                            style="background: none; border: none; cursor: pointer; font-size: 20px;">×</button>
                </div>
                <div id="quote-summary-content">
                    <!-- Summary content will be populated here -->
                </div>
                <div style="margin-top: 10px; display: flex; gap: 10px;">
                    <button onclick="window.capEmbroideryQuoteAdapter.showQuoteDetails()" 
                            style="flex: 1; padding: 8px; background: ${this.config.brandColor}; color: white; border: none; border-radius: 4px; cursor: pointer;">
                        View Details
                    </button>
                    <button onclick="window.capEmbroideryQuoteAdapter.clearQuote()" 
                            style="flex: 1; padding: 8px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer;">
                        Clear Quote
                    </button>
                </div>
            `;
            
            document.body.appendChild(summaryPanel);
        }

        // Get tier price for a given quantity
        getTierPrice(quantity) {
            if (quantity >= 72) return 21;
            if (quantity >= 48) return 23;
            if (quantity >= 24) return 25;
            return 0; // Below minimum
        }
        
        // Get next tier info
        getNextTierInfo(currentQuantity) {
            if (currentQuantity < 48) {
                return { tier: '48-71', minQty: 48, price: 23 };
            } else if (currentQuantity < 72) {
                return { tier: '72+', minQty: 72, price: 21 };
            }
            return null; // Already at highest tier
        }
        
        // Display quote summary
        displayQuoteSummary(quote = null) {
            console.log('[CAP-EMB-QUOTE] displayQuoteSummary called');
            
            const summaryPanel = document.getElementById('cumulative-quote-summary');
            if (!summaryPanel) {
                console.log('[CAP-EMB-QUOTE] Summary panel not found, creating it');
                this.addQuoteSummaryPanel();
                return this.displayQuoteSummary(quote); // Retry after creating
            }
            
            const quoteData = quote || this.currentQuote;
            console.log('[CAP-EMB-QUOTE] Quote data:', quoteData);
            console.log('[CAP-EMB-QUOTE] Total quantity:', quoteData ? quoteData.totalQuantity : 0);
            
            if (quoteData && quoteData.totalQuantity > 0) {
                const summaryContent = document.getElementById('quote-summary-content');
                if (summaryContent) {
                    const currentTier = this.determinePricingTier(quoteData.totalQuantity);
                    const nextTier = this.getNextTierInfo(quoteData.totalQuantity);
                    
                    // Build detailed line items HTML
                    let lineItemsHTML = '';
                    console.log('[CAP-EMB-QUOTE] Quote items:', quoteData.items);
                    if (quoteData.items && quoteData.items.length > 0) {
                        lineItemsHTML = '<div style="margin: 15px 0; border-top: 1px solid #ddd; padding-top: 15px;">';
                        lineItemsHTML += '<h4 style="margin: 0 0 10px 0;">Quote Details:</h4>';
                        
                        quoteData.items.forEach((item, index) => {
                            const itemTotal = item.quantity * item.unitPrice;
                            lineItemsHTML += `
                                <div style="margin-bottom: 15px; padding: 10px; background: #f8f9fa; border-radius: 4px;">
                                    <div style="font-weight: bold; color: #333;">Item ${index + 1}: ${item.productName}</div>
                                    <div style="font-size: 0.9em; color: #666; margin: 5px 0;">
                                        Style: ${item.styleNumber} | Color: ${item.color}
                                    </div>
                                    <div style="font-size: 0.9em; margin: 5px 0;">
                                        Stitch Count: ${item.stitchCount || '8000'}
                                        ${item.hasBackLogo ? ' | <span style="color: #28a745;">✓ Back Logo</span>' : ''}
                                    </div>
                                    <div style="margin-top: 8px;">
                                        <table style="width: 100%; font-size: 0.9em;">
                                            <tr>
                                                <td>Quantity:</td>
                                                <td style="text-align: right;">${item.quantity} caps</td>
                                            </tr>
                                            <tr>
                                                <td>Unit Price:</td>
                                                <td style="text-align: right;">$${item.unitPrice.toFixed(2)}</td>
                                            </tr>
                                            <tr style="font-weight: bold;">
                                                <td>Line Total:</td>
                                                <td style="text-align: right;">$${itemTotal.toFixed(2)}</td>
                                            </tr>
                                        </table>
                                    </div>
                                    ${item.sizeBreakdown ? `
                                        <div style="margin-top: 8px; font-size: 0.85em; color: #666;">
                                            Size Breakdown: ${Object.entries(item.sizeBreakdown)
                                                .filter(([size, qty]) => qty > 0)
                                                .map(([size, qty]) => `${size}: ${qty}`)
                                                .join(', ')}
                                        </div>
                                    ` : ''}
                                </div>
                            `;
                        });
                        lineItemsHTML += '</div>';
                    }
                    
                    // Calculate savings info
                    let savingsHTML = '';
                    if (quoteData.totalQuantity >= 48) {
                        const basePrice = 25; // 24-47 tier price
                        const currentPrice = quoteData.totalQuantity >= 72 ? 21 : 23;
                        const totalSavings = (basePrice - currentPrice) * quoteData.totalQuantity;
                        const percentSavings = ((basePrice - currentPrice) / basePrice * 100).toFixed(0);
                        
                        savingsHTML = `
                            <div style="margin: 10px 0; padding: 10px; background: #d4edda; border: 1px solid #c3e6cb; border-radius: 4px;">
                                <div style="color: #155724; font-weight: bold;">
                                    💰 Volume Savings: $${totalSavings.toFixed(2)} (${percentSavings}% off)
                                </div>
                                <div style="font-size: 0.85em; color: #155724; margin-top: 5px;">
                                    Unit price: $${currentPrice} (vs $${basePrice} for smaller quantities)
                                </div>
                            </div>
                        `;
                    }
                    
                    // Next tier info
                    let nextTierHTML = '';
                    if (nextTier) {
                        const unitsToNext = nextTier.minQty - quoteData.totalQuantity;
                        const potentialSavings = (this.getTierPrice(quoteData.totalQuantity) - nextTier.price) * nextTier.minQty;
                        
                        nextTierHTML = `
                            <div style="margin: 10px 0; padding: 10px; background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 4px;">
                                <div style="color: #856404; font-size: 0.9em;">
                                    📈 Add ${unitsToNext} more caps to reach <strong>${nextTier.tier}</strong> pricing
                                </div>
                                <div style="color: #856404; font-size: 0.85em; margin-top: 5px;">
                                    Save an additional $${potentialSavings.toFixed(2)} at $${nextTier.price}/unit
                                </div>
                            </div>
                        `;
                    }
                    
                    console.log('[CAP-EMB-QUOTE] Setting enhanced summary content');
                    summaryContent.innerHTML = `
                        <div style="margin-bottom: 15px; padding-bottom: 15px; border-bottom: 1px solid #ddd;">
                            <h4 style="margin: 0 0 10px 0;">Pricing Summary</h4>
                            <div style="margin-bottom: 8px;">
                                <strong>Total Quantity:</strong> ${quoteData.totalQuantity} caps
                            </div>
                            <div style="margin-bottom: 8px;">
                                <strong>Current Price Tier:</strong> ${currentTier}
                                <span style="font-size: 0.85em; color: #666;">
                                    (${this.getTierPrice(quoteData.totalQuantity)}/unit)
                                </span>
                            </div>
                            ${savingsHTML}
                            ${nextTierHTML}
                        </div>
                        
                        ${lineItemsHTML}
                        
                        <div style="margin-top: 15px; padding-top: 15px; border-top: 2px solid #ddd;">
                            <div style="margin-bottom: 8px;">
                                <strong>Subtotal:</strong> 
                                <span style="float: right;">$${quoteData.subtotal.toFixed(2)}</span>
                            </div>
                            ${quoteData.ltmTotal > 0 ? `
                                <div style="margin-bottom: 8px; color: #dc3545;">
                                    <strong>LTM Fee:</strong> 
                                    <span style="float: right;">$${quoteData.ltmTotal.toFixed(2)}</span>
                                </div>
                            ` : ''}
                            <div style="font-size: 1.2em; font-weight: bold; color: ${this.config.brandColor}; margin-top: 10px;">
                                <strong>Total:</strong> 
                                <span style="float: right;">$${quoteData.grandTotal.toFixed(2)}</span>
                            </div>
                        </div>
                    `;
                }
                console.log('[CAP-EMB-QUOTE] Setting panel display to block');
                summaryPanel.style.display = 'block';
                
                // Force the sidebar to be visible by overriding any transform/positioning issues
                summaryPanel.style.setProperty('display', 'block', 'important');
                summaryPanel.style.setProperty('transform', 'translateX(0)', 'important');
                summaryPanel.style.setProperty('visibility', 'visible', 'important');
                summaryPanel.style.setProperty('opacity', '1', 'important');
                summaryPanel.style.setProperty('right', '20px', 'important');
                summaryPanel.style.setProperty('bottom', '20px', 'important');
                summaryPanel.style.setProperty('position', 'fixed', 'important');
                summaryPanel.style.setProperty('z-index', '10000', 'important');
                
                // Add the is-open class in case CSS uses it
                summaryPanel.classList.add('is-open');
                
                // Log computed styles for debugging
                const computed = window.getComputedStyle(summaryPanel);
                console.log('[CAP-EMB-QUOTE] Panel computed styles:', {
                    display: computed.display,
                    visibility: computed.visibility,
                    opacity: computed.opacity,
                    position: computed.position,
                    transform: computed.transform,
                    right: computed.right,
                    bottom: computed.bottom,
                    zIndex: computed.zIndex
                });
            } else {
                console.log('[CAP-EMB-QUOTE] No items in quote, hiding panel');
                summaryPanel.style.display = 'none';
            }
        }

        // Update pricing display based on cumulative quantity
        updatePricingDisplay() {
            if (!this.currentPricingData) return;
            
            const totalQuantity = this.currentQuote.totalQuantity;
            const currentPageQuantity = this.getTotalQuantityFromInputs();
            const combinedQuantity = totalQuantity + currentPageQuantity;
            
            // Update pricing table to show current tier
            const pricingCells = document.querySelectorAll('.price-cell');
            pricingCells.forEach(cell => {
                cell.classList.remove('active-tier');
            });
            
            // Highlight active tier
            const activeTier = this.determinePricingTier(combinedQuantity);
            const tierElement = document.querySelector(`[data-tier="${activeTier}"]`);
            if (tierElement) {
                tierElement.classList.add('active-tier');
            }
            
            // Update any tier indicators
            const tierIndicators = document.querySelectorAll('.current-tier-indicator');
            tierIndicators.forEach(indicator => {
                indicator.textContent = `Current Tier: ${activeTier} (${combinedQuantity} total)`;
            });
        }

        // Get total quantity from current page inputs
        getTotalQuantityFromInputs() {
            let total = 0;
            const quantityInputs = document.querySelectorAll('.quantity-input[data-size]');
            quantityInputs.forEach(input => {
                total += parseInt(input.value) || 0;
            });
            return total;
        }

        // Save quote to local storage
        saveQuoteToStorage() {
            try {
                const quoteData = {
                    quote: this.currentQuote,
                    timestamp: Date.now()
                };
                localStorage.setItem('nwca_cap_embroidery_quote', JSON.stringify(quoteData));
                if (this.currentQuote.sessionId) {
                    localStorage.setItem('nwca_quote_session_id', this.currentQuote.sessionId);
                }
            } catch (error) {
                console.error('[CAP-EMB-QUOTE] Failed to save quote to storage:', error);
            }
        }

        // Hide summary panel
        hideSummaryPanel() {
            const summaryPanel = document.getElementById('cumulative-quote-summary');
            if (summaryPanel) {
                summaryPanel.style.display = 'none';
            }
        }

        // Get total for quote dropdown
        getTotal() {
            return this.currentQuote ? this.currentQuote.grandTotal : 0;
        }

        // Get current quote
        getQuote() {
            return this.currentQuote;
        }

        // Clear quote
        clearQuote() {
            this.currentQuote = this.initializeQuote();
            this.updateQuoteTotals();
            this.updateQuoteSummary();
            this.saveQuoteToStorage();
            this.hideSummaryPanel();
        }
        
        // Update quick quote display (reset quantities)
        updateQuickQuoteDisplay() {
            console.log('[CAP-EMB-QUOTE] updateQuickQuoteDisplay called');
            
            // Reset quantity totals display
            const totalQtyEl = document.querySelector('.total-quantity');
            const totalPriceEl = document.querySelector('.total-price');
            
            if (totalQtyEl) totalQtyEl.textContent = '0';
            if (totalPriceEl) totalPriceEl.textContent = '$0.00';
            
            // Update quantity totals to reflect cleared inputs
            this.updateQuantityTotals();
            
            // Show quote was added successfully
            const addButton = document.getElementById('add-to-quote-btn');
            if (addButton) {
                const originalText = addButton.textContent;
                addButton.textContent = '✓ Added to Quote!';
                addButton.style.backgroundColor = '#4caf50';
                
                setTimeout(() => {
                    addButton.textContent = originalText;
                    addButton.style.backgroundColor = '';
                }, 2000);
            }
        }

        // Show quote details (opens quote modal)
        showQuoteDetails() {
            if (this.openQuoteModal) {
                this.openQuoteModal();
            }
        }

        // Capture product image with color validation
        async captureProductImage(selectedColor) {
            const imageElement = document.getElementById('product-image-main');
            if (!imageElement) return '';
            
            const imageSrc = imageElement.src;
            
            // Check if image URL contains color identifier
            const colorSlug = selectedColor.toLowerCase().replace(/\s+/g, '-');
            if (imageSrc.includes(colorSlug) || imageSrc.includes(selectedColor.toLowerCase())) {
                return imageSrc; // Confident it's correct
            }
            
            // If unsure, wait brief moment for image to settle
            await new Promise(resolve => setTimeout(resolve, 200));
            return imageElement.src;
        }

        // Override addItemToQuote to use cumulative pricing
        async addItemToQuote(item) {
            console.log('[CAP-EMB-QUOTE] addItemToQuote called in adapter');
            
            try {
                // Use cumulative pricing from base class
                const addedItem = await super.addItemToQuote(item);
                
                console.log('[CAP-EMB-QUOTE] Item added successfully, updating displays');
                
                // Update the display after adding
                this.displayQuoteSummary();
                this.updatePricingDisplay();
                
                // Clear the quantity inputs after successful add
                const quantityInputs = document.querySelectorAll('.quantity-input[data-size]');
                quantityInputs.forEach(input => {
                    input.value = 0;
                });
                
                // Update quick quote display
                this.updateQuickQuoteDisplay();
                
                // Hide bundle savings after add
                setTimeout(() => {
                    this.hideBundleSavings();
                }, 2000);
                
                return addedItem;
            } catch (error) {
                console.error('[CAP-EMB-QUOTE] Error in addItemToQuote:', error);
                throw error;
            }
        }
    }

    // Create and initialize the adapter
    let capEmbroideryQuoteAdapter;
    
    try {
        console.log('[CAP-EMB-QUOTE] Creating adapter instance...');
        console.log('[CAP-EMB-QUOTE] BaseQuoteSystem exists:', !!window.BaseQuoteSystem);
        console.log('[CAP-EMB-QUOTE] BaseQuoteSystem type:', typeof window.BaseQuoteSystem);
        
        if (!window.BaseQuoteSystem) {
            console.error('[CAP-EMB-QUOTE] ERROR: BaseQuoteSystem not found! Check script load order.');
            console.error('[CAP-EMB-QUOTE] Available globals:', Object.keys(window).filter(k => k.includes('Quote') || k.includes('Base')));
            return;
        }
        
        capEmbroideryQuoteAdapter = new CapEmbroideryQuoteAdapter();
        console.log('[CAP-EMB-QUOTE] Adapter instance created successfully');
        console.log('[CAP-EMB-QUOTE] Adapter embellishmentType:', capEmbroideryQuoteAdapter.embellishmentType);
        
        // Initialize when DOM is ready
        console.log('[CAP-EMB-QUOTE] Document readyState:', document.readyState);
        console.log('[CAP-EMB-QUOTE] Current URL:', window.location.href);
        
        const initAdapter = () => {
            try {
                console.log('[CAP-EMB-QUOTE] === INIT STARTED ===');
                console.log('[CAP-EMB-QUOTE] Checking for required DOM elements...');
                console.log('[CAP-EMB-QUOTE] add-to-cart-section exists:', !!document.getElementById('add-to-cart-section'));
                console.log('[CAP-EMB-QUOTE] product-title-context exists:', !!document.getElementById('product-title-context'));
                
                console.log('[CAP-EMB-QUOTE] Calling init()...');
                capEmbroideryQuoteAdapter.init();
                console.log('[CAP-EMB-QUOTE] === INIT COMPLETED ===');
            } catch (initError) {
                console.error('[CAP-EMB-QUOTE] Error during init():', initError);
                console.error('[CAP-EMB-QUOTE] Error stack:', initError.stack);
            }
        };
        
        if (document.readyState === 'loading') {
            console.log('[CAP-EMB-QUOTE] Waiting for DOMContentLoaded...');
            document.addEventListener('DOMContentLoaded', initAdapter);
        } else {
            console.log('[CAP-EMB-QUOTE] DOM already ready, waiting 100ms then calling init()...');
            // Small delay to ensure other scripts have initialized
            setTimeout(initAdapter, 100);
        }
    } catch (error) {
        console.error('[CAP-EMB-QUOTE] FATAL ERROR creating adapter:', error);
        console.error('[CAP-EMB-QUOTE] Stack trace:', error.stack);
    }

    // Cleanup on page unload to prevent memory leaks
    window.addEventListener('beforeunload', () => {
        if (capEmbroideryQuoteAdapter.cleanupEventListeners) {
            capEmbroideryQuoteAdapter.cleanupEventListeners();
        }
    });

    // Export to global scope
    window.capEmbroideryQuoteAdapter = capEmbroideryQuoteAdapter;
    window.CapEmbroideryQuoteAdapter = CapEmbroideryQuoteAdapter;

})();