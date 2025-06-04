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
            this.apiClient = window.quoteAPIClient || null;
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

            // Setup stitch count selector
            this.setupStitchCountSelector();
            
            // Populate the size quantity grid
            this.populateSizeQuantityGrid();
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
        
        // Get available sizes (for caps, typically just OS)
        getAvailableSizes() {
            // Check if we have size data from the pricing system
            if (this.currentPricingData && this.currentPricingData.sizes) {
                return this.currentPricingData.sizes;
            }
            
            // Default for cap embroidery
            return ['OS']; // One Size
        }
        
        // Update quantity totals
        updateQuantityTotals() {
            let totalQuantity = 0;
            let totalPrice = 0;
            
            const quantityInputs = document.querySelectorAll('.quantity-input[data-size]');
            quantityInputs.forEach(input => {
                const qty = parseInt(input.value) || 0;
                const size = input.getAttribute('data-size');
                totalQuantity += qty;
                
                if (qty > 0 && this.currentPricingData) {
                    const basePrice = this.getBasePriceForSize(size);
                    const backLogoPrice = this.backLogoEnabled ? this.getCurrentBackLogoPrice() : 0;
                    const unitPrice = basePrice + backLogoPrice;
                    totalPrice += unitPrice * qty;
                }
            });
            
            // Update displays
            const totalQtyEl = document.querySelector('.total-quantity');
            const totalPriceEl = document.querySelector('.total-price');
            
            if (totalQtyEl) totalQtyEl.textContent = totalQuantity;
            if (totalPriceEl) totalPriceEl.textContent = `$${totalPrice.toFixed(2)}`;
            
            // Update pricing display for tier pricing
            this.updatePricingDisplay();
        }

        // Override bindEvents to include cap embroidery specific events
        bindEvents() {
            super.bindEvents();
            
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
                this.currentPricingData = e.detail;
                // Check if we need to update available sizes
                const currentSizes = this.getAvailableSizes();
                const gridContainer = document.getElementById('size-quantity-grid');
                if (gridContainer && currentSizes.length > 0) {
                    const existingInputs = gridContainer.querySelectorAll('.quantity-input[data-size]');
                    // If no inputs exist or sizes changed, repopulate
                    if (existingInputs.length === 0) {
                        this.populateSizeQuantityGrid();
                    }
                }
                this.updatePricingDisplay();
            };
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
            if (!this.currentPricingData) return;

            // Check if back logo is enabled from the add-on system
            const backLogoEnabled = window.CapEmbroideryBackLogoAddon ? window.CapEmbroideryBackLogoAddon.isEnabled() : false;

            // Update size quantity grid with current prices
            const priceDisplays = document.querySelectorAll('.size-price-display[data-size]');
            priceDisplays.forEach(display => {
                const size = display.getAttribute('data-size');
                
                if (this.currentPricingData.prices) {
                    const basePrice = this.getBasePriceForSize(size);
                    const currentBackLogoPrice = this.getCurrentBackLogoPrice();
                    const totalPrice = basePrice + (backLogoEnabled ? currentBackLogoPrice : 0);
                    display.textContent = `$${totalPrice.toFixed(2)}`;
                }
            });
            
            // Update totals
            this.updateQuantityTotals();
        }

        // Get base price for a specific size
        getBasePriceForSize(size) {
            if (!this.currentPricingData || !this.currentPricingData.prices) {
                return 0;
            }
            
            // Check if we have direct size pricing structure
            if (this.currentPricingData.prices[size]) {
                // We need to determine which tier to use for a single item (should be lowest tier)
                const tierPrices = this.currentPricingData.prices[size];
                const tierKeys = Object.keys(tierPrices).sort((a, b) => {
                    // Sort tiers by minimum quantity
                    const aMin = parseInt(a.split('-')[0]) || 0;
                    const bMin = parseInt(b.split('-')[0]) || 0;
                    return aMin - bMin;
                });
                
                if (tierKeys.length > 0) {
                    // Use the first tier (lowest quantity tier) for base pricing
                    const firstTier = tierKeys[0];
                    return tierPrices[firstTier];
                }
            }
            
            // Fallback: try the old key format
            const priceKey = `${this.currentStitchCount}_${size}`;
            return this.currentPricingData.prices[priceKey] || 0;
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

            // Get product image
            const productImage = document.getElementById('product-image-main')?.src || '';

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
                    
                    // Update local quote with API response
                    this.currentQuote.id = response.QuoteID || sessionData.QuoteID;
                    this.currentQuote.sessionId = response.SessionID || sessionData.SessionID;
                    this.currentQuote.apiId = response.PK_ID;
                    
                    console.log('[CAP-EMB-QUOTE] Quote session created:', this.currentQuote.id);
                } catch (error) {
                    console.error('[CAP-EMB-QUOTE] Failed to create quote session:', error);
                    // Generate local IDs as fallback
                    this.currentQuote.id = 'LOCAL_' + Date.now();
                    this.currentQuote.sessionId = 'LOCAL_SESS_' + Date.now();
                }
            }

            // Add to quote locally
            this.addItemToQuote(quoteItem);

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

        // Override createQuoteItem to include back logo price in final calculations
        createQuoteItem(itemData) {
            // Create base item using parent method
            const baseItem = super.createQuoteItem(itemData);
            
            // Add back logo price to final unit price if back logo is enabled
            if (itemData.hasBackLogo && itemData.backLogoPrice > 0) {
                baseItem.finalUnitPrice = itemData.baseUnitPrice + baseItem.ltmPerUnit + itemData.backLogoPrice;
                baseItem.lineTotal = baseItem.finalUnitPrice * itemData.quantity;
            }
            
            return baseItem;
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
            super.updateQuoteSummary();
            
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
            if (!this.apiClient || !this.currentQuote.apiId) return;
            
            try {
                const updates = {
                    TotalQuantity: this.currentQuote.totalQuantity,
                    SubtotalAmount: this.currentQuote.subtotal,
                    LTMFeeTotal: this.currentQuote.ltmTotal,
                    TotalAmount: this.currentQuote.grandTotal,
                    UpdatedAt: new Date().toISOString()
                };
                
                await this.apiClient.updateQuoteSession(this.currentQuote.apiId, updates);
                console.log('[CAP-EMB-QUOTE] Quote session totals updated');
            } catch (error) {
                console.error('[CAP-EMB-QUOTE] Failed to update quote session totals:', error);
            }
        }

        // Override convertApiItemToQuoteItem for cap embroidery specific conversion
        convertApiItemToQuoteItem(apiItem) {
            const baseItem = super.convertApiItemToQuoteItem(apiItem);
            
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
                    console.warn('[CAP-EMB-QUOTE] API client not available, falling back to base save');
                    return super.saveQuote();
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
                return super.loadQuote(quoteId);
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