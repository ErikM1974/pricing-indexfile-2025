// Unified Cart Adapter for All Embellishment Types
// Handles multi-color selection, cart constraints, and LTM calculations
// For Northwest Custom Apparel - May 2025

(function() {
    'use strict';

    // Configuration
    const config = {
        apiBaseUrl: 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api',
        ltmThreshold: 24,
        ltmFee: 50.00,
        sessionKey: 'nwca_cart_session',
        cartKey: 'nwca_current_cart',
        brandColor: '#2e5827'
    };

    // Cart state management
    window.UnifiedCartManager = {
        currentCart: {
            sessionId: null,
            items: [],
            constraints: {
                embellishmentType: null,  // Once set, all items must match
                printLocation: null       // Once set, all items must match
            },
            totals: {
                subtotal: 0,
                ltmTotal: 0,
                grandTotal: 0,
                totalQuantity: 0
            }
        },

        // Initialize cart system
        init: function() {
            console.log('[CART] Initializing Unified Cart System');
            this.loadSession();
            this.setupUI();
            this.bindEvents();
            this.updateCartDisplay();
        },

        // Load or create session
        loadSession: function() {
            let sessionId = localStorage.getItem(config.sessionKey);
            if (!sessionId) {
                sessionId = 'cart_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
                localStorage.setItem(config.sessionKey, sessionId);
            }
            this.currentCart.sessionId = sessionId;
            
            // Load existing cart if available
            const savedCart = localStorage.getItem(config.cartKey);
            if (savedCart) {
                try {
                    const cartData = JSON.parse(savedCart);
                    Object.assign(this.currentCart, cartData);
                    this.calculateTotals();
                    this.updateCartDisplay();
                } catch (e) {
                    console.error('[CART] Error loading saved cart:', e);
                }
            }
        },

        // Setup cart UI
        setupUI: function() {
            this.createCartSummaryPanel();
            this.createMultiColorSelector();
            this.setupPricingTable();
        },

        // Create floating cart summary panel
        createCartSummaryPanel: function() {
            const panel = document.createElement('div');
            panel.id = 'cart-summary-panel';
            panel.className = 'cart-summary-panel';
            panel.style.cssText = `
                position: fixed;
                right: 20px;
                top: 100px;
                width: 320px;
                background: white;
                border: 2px solid ${config.brandColor};
                border-radius: 8px;
                padding: 20px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                z-index: 1000;
                max-height: 80vh;
                overflow-y: auto;
            `;
            
            panel.innerHTML = `
                <h3 style="color: ${config.brandColor}; margin-top: 0; display: flex; align-items: center;">
                    🛒 Your Cart
                    <span id="cart-item-count" style="background: ${config.brandColor}; color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-size: 0.8em; margin-left: 10px;">0</span>
                </h3>
                
                <div id="cart-constraints-display" style="background: #f8f9fa; padding: 10px; border-radius: 5px; margin-bottom: 15px; font-size: 0.9em;">
                    <div><strong>Print Location:</strong> <span id="constraint-location">Not selected</span></div>
                    <div><strong>Embellishment:</strong> <span id="constraint-embellishment">Not selected</span></div>
                </div>
                
                <div id="cart-items-list">
                    <p style="color: #666; text-align: center; font-style: italic;">Cart is empty</p>
                </div>
                
                <div id="cart-totals" style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #ddd;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                        <span>Subtotal:</span>
                        <span id="cart-subtotal">$0.00</span>
                    </div>
                    <div id="ltm-fee-row" style="display: none; color: #dc3545; margin-bottom: 5px;">
                        <div style="display: flex; justify-content: space-between;">
                            <span>LTM Fee:</span>
                            <span id="cart-ltm-fee">$0.00</span>
                        </div>
                        <div style="font-size: 0.8em; color: #666; margin-top: 2px;">
                            ($${config.ltmFee} ÷ <span id="ltm-quantity">0</span> pieces)
                        </div>
                    </div>
                    <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 1.2em; margin-top: 10px; padding-top: 10px; border-top: 1px solid #ddd;">
                        <span>Total:</span>
                        <span id="cart-total" style="color: ${config.brandColor};">$0.00</span>
                    </div>
                </div>
                
                <div style="margin-top: 20px;">
                    <button onclick="UnifiedCartManager.viewCart()" class="btn-secondary" style="width: 100%; margin-bottom: 10px;">📋 View Full Cart</button>
                    <button onclick="UnifiedCartManager.requestQuote()" class="btn-primary" style="width: 100%; background: ${config.brandColor};">💰 Request Quote</button>
                </div>
            `;
            
            document.body.appendChild(panel);
        },

        // Create multi-color selector interface
        createMultiColorSelector: function() {
            const colorSection = document.querySelector('.color-swatches-container');
            if (!colorSection) return;

            // Add multi-select controls
            const multiSelectControls = document.createElement('div');
            multiSelectControls.className = 'multi-color-controls';
            multiSelectControls.style.cssText = `
                background: #e8f5e9;
                padding: 15px;
                border-radius: 8px;
                margin-bottom: 15px;
                border: 1px solid ${config.brandColor};
            `;
            
            multiSelectControls.innerHTML = `
                <h4 style="margin: 0 0 10px 0; color: ${config.brandColor};">Multi-Color Selection</h4>
                <div style="display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 10px;">
                    <label style="display: flex; align-items: center;">
                        <input type="checkbox" id="multi-color-mode" style="margin-right: 5px;">
                        Enable multi-color selection
                    </label>
                </div>
                <div id="selected-colors-display" style="display: none;">
                    <strong>Selected Colors:</strong>
                    <div id="selected-colors-list" style="display: flex; flex-wrap: wrap; gap: 5px; margin-top: 5px;"></div>
                    <button id="add-selected-colors" class="btn-primary" style="margin-top: 10px; background: ${config.brandColor};">
                        Add Selected Colors to Cart
                    </button>
                </div>
            `;
            
            colorSection.insertBefore(multiSelectControls, colorSection.firstChild);
        },

        // Setup pricing table with cart integration
        setupPricingTable: function() {
            const pricingContainer = document.getElementById('custom-pricing-grid');
            if (!pricingContainer) return;

            // Add cart integration to pricing table
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    if (mutation.type === 'childList') {
                        this.enhancePricingTable();
                    }
                });
            });

            observer.observe(pricingContainer, { childList: true, subtree: true });
        },

        // Enhance pricing table with cart quantities
        enhancePricingTable: function() {
            const table = document.getElementById('custom-pricing-grid');
            if (!table || !table.querySelector('tbody tr')) return;

            // Add cart quantity column if not exists
            const headerRow = table.querySelector('thead tr');
            if (headerRow && !headerRow.querySelector('.cart-qty-header')) {
                const cartHeader = document.createElement('th');
                cartHeader.className = 'cart-qty-header';
                cartHeader.textContent = 'In Cart';
                cartHeader.style.cssText = `
                    background: ${config.brandColor};
                    color: white;
                    text-align: center;
                    width: 80px;
                `;
                headerRow.appendChild(cartHeader);
            }

            // Add cart quantity cells
            const bodyRows = table.querySelectorAll('tbody tr');
            bodyRows.forEach((row, index) => {
                if (!row.querySelector('.cart-qty-cell')) {
                    const cartCell = document.createElement('td');
                    cartCell.className = 'cart-qty-cell';
                    cartCell.style.cssText = `
                        text-align: center;
                        vertical-align: middle;
                        background: #f8f9fa;
                        font-weight: bold;
                        color: ${config.brandColor};
                    `;
                    
                    const tierQuantity = this.getCartQuantityForTier(index);
                    cartCell.textContent = tierQuantity > 0 ? tierQuantity : '—';
                    
                    row.appendChild(cartCell);
                }
            });

            this.highlightActiveTier();
        },

        // Get cart quantity for pricing tier
        getCartQuantityForTier: function(tierIndex) {
            const tiers = ['24-47', '48-71', '72+'];
            const tier = tiers[tierIndex];
            if (!tier) return 0;

            return this.currentCart.items
                .filter(item => this.getPricingTier(item.quantity) === tier)
                .reduce((sum, item) => sum + item.quantity, 0);
        },

        // Highlight active pricing tier
        highlightActiveTier: function() {
            const table = document.getElementById('custom-pricing-grid');
            if (!table) return;

            const totalQuantity = this.currentCart.totals.totalQuantity;
            const activeTier = this.getPricingTier(totalQuantity);
            
            // Remove existing highlights
            table.querySelectorAll('.current-pricing-level-highlight').forEach(row => {
                row.classList.remove('current-pricing-level-highlight');
            });

            // Add highlight to active tier
            const tierIndex = ['24-47', '48-71', '72+'].indexOf(activeTier);
            if (tierIndex >= 0) {
                const targetRow = table.querySelector(`tbody tr:nth-child(${tierIndex + 1})`);
                if (targetRow) {
                    targetRow.classList.add('current-pricing-level-highlight');
                }
            }
        },

        // Get pricing tier based on quantity
        getPricingTier: function(quantity) {
            if (quantity >= 72) return '72+';
            if (quantity >= 48) return '48-71';
            return '24-47';
        },

        // Add item to cart with validation
        addToCart: function(itemData) {
            console.log('[CART] Adding item to cart:', itemData);

            // Validate constraints
            if (!this.validateConstraints(itemData)) {
                return false;
            }

            // Set constraints if this is first item
            if (this.currentCart.items.length === 0) {
                this.currentCart.constraints.embellishmentType = itemData.embellishmentType;
                this.currentCart.constraints.printLocation = itemData.printLocation;
            }

            // Check if item already exists (same style, color, location)
            const existingItemIndex = this.currentCart.items.findIndex(item => 
                item.styleNumber === itemData.styleNumber &&
                item.color === itemData.color &&
                item.printLocation === itemData.printLocation
            );

            if (existingItemIndex >= 0) {
                // Update existing item
                this.currentCart.items[existingItemIndex].quantity += itemData.quantity;
                this.currentCart.items[existingItemIndex].sizeBreakdown = this.mergeSizeBreakdowns(
                    this.currentCart.items[existingItemIndex].sizeBreakdown,
                    itemData.sizeBreakdown
                );
            } else {
                // Add new item
                const cartItem = {
                    id: 'item_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
                    ...itemData,
                    addedAt: new Date().toISOString()
                };
                this.currentCart.items.push(cartItem);
            }

            this.calculateTotals();
            this.updateCartDisplay();
            this.saveCartToStorage();
            this.showAddToCartSuccess(itemData);

            return true;
        },

        // Validate cart constraints
        validateConstraints: function(itemData) {
            const constraints = this.currentCart.constraints;

            // Check embellishment type
            if (constraints.embellishmentType && constraints.embellishmentType !== itemData.embellishmentType) {
                // Allow mixing embroidery types with other types
                const embroideryTypes = ['embroidery', 'cap-embroidery'];
                const isCurrentEmbroidery = embroideryTypes.includes(constraints.embellishmentType);
                const isNewEmbroidery = embroideryTypes.includes(itemData.embellishmentType);
                
                // Allow embroidery + cap-embroidery mixing, but not with DTG/screen-print/etc
                if (!(isCurrentEmbroidery && isNewEmbroidery)) {
                    this.showConstraintError('embellishment', constraints.embellishmentType, itemData.embellishmentType);
                    return false;
                }
            }

            // Check print location
            if (constraints.printLocation && constraints.printLocation !== itemData.printLocation) {
                this.showConstraintError('location', constraints.printLocation, itemData.printLocation);
                return false;
            }

            return true;
        },

        // Show constraint violation error
        showConstraintError: function(type, current, attempted) {
            const messages = {
                embellishment: `All items must use the same embellishment type. Current cart uses "${current}", but you're trying to add "${attempted}".`,
                location: `All items must use the same print location. Current cart uses "${current}", but you're trying to add "${attempted}".`
            };

            const errorDiv = document.createElement('div');
            errorDiv.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: white;
                border: 2px solid #dc3545;
                border-radius: 8px;
                padding: 20px;
                max-width: 400px;
                z-index: 10000;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            `;

            errorDiv.innerHTML = `
                <h4 style="color: #dc3545; margin-top: 0;">⚠️ Cart Constraint Violation</h4>
                <p>${messages[type]}</p>
                <div style="text-align: center; margin-top: 15px;">
                    <button onclick="this.parentElement.parentElement.remove()" 
                            style="background: #dc3545; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">
                        OK
                    </button>
                </div>
            `;

            document.body.appendChild(errorDiv);

            // Auto-remove after 5 seconds
            setTimeout(() => {
                if (errorDiv.parentElement) {
                    errorDiv.remove();
                }
            }, 5000);
        },

        // Merge size breakdowns
        mergeSizeBreakdowns: function(existing, additional) {
            const merged = { ...existing };
            Object.keys(additional).forEach(size => {
                merged[size] = (merged[size] || 0) + additional[size];
            });
            return merged;
        },

        // Calculate cart totals with LTM logic
        calculateTotals: function() {
            let subtotal = 0;
            let totalQuantity = 0;

            // Calculate base totals
            this.currentCart.items.forEach(item => {
                const itemSubtotal = item.baseUnitPrice * item.quantity;
                subtotal += itemSubtotal;
                totalQuantity += item.quantity;
                
                // Update item pricing based on current cart total
                const currentTier = this.getPricingTier(totalQuantity);
                item.currentUnitPrice = this.getBasePriceForTier(currentTier, item.styleNumber, item.embellishmentType);
            });

            // Calculate LTM fee (divide $50 across all pieces if under 24 total)
            let ltmTotal = 0;
            if (totalQuantity > 0 && totalQuantity < config.ltmThreshold) {
                ltmTotal = config.ltmFee;
                
                // Distribute LTM fee proportionally across items
                this.currentCart.items.forEach(item => {
                    item.ltmPerUnit = (config.ltmFee / totalQuantity);
                    item.finalUnitPrice = item.currentUnitPrice + item.ltmPerUnit;
                    item.lineTotal = item.finalUnitPrice * item.quantity;
                });
            } else {
                // No LTM fee
                this.currentCart.items.forEach(item => {
                    item.ltmPerUnit = 0;
                    item.finalUnitPrice = item.currentUnitPrice;
                    item.lineTotal = item.finalUnitPrice * item.quantity;
                });
            }

            // Recalculate final totals
            subtotal = this.currentCart.items.reduce((sum, item) => sum + (item.currentUnitPrice * item.quantity), 0);
            const grandTotal = subtotal + ltmTotal;

            this.currentCart.totals = {
                subtotal,
                ltmTotal,
                grandTotal,
                totalQuantity
            };
        },

        // Get base price for tier (integrates with existing pricing data)
        getBasePriceForTier: function(tier, styleNumber, embellishmentType) {
            // Try to get from window pricing data
            if (window.nwcaPricingData && window.nwcaPricingData.prices) {
                const prices = window.nwcaPricingData.prices;
                const firstSize = Object.keys(prices)[0];
                if (firstSize && prices[firstSize] && prices[firstSize][tier]) {
                    return parseFloat(prices[firstSize][tier]);
                }
            }

            // Fallback prices by embellishment type
            const fallbackPrices = {
                'dtg': { '24-47': 15.99, '48-71': 14.99, '72+': 13.99 },
                'embroidery': { '24-47': 8.99, '48-71': 7.99, '72+': 6.99 },
                'cap-embroidery': { '24-47': 12.99, '48-71': 11.99, '72+': 10.99 },
                'screen-print': { '24-47': 12.99, '48-71': 11.99, '72+': 10.99 },
                'dtf': { '24-47': 13.99, '48-71': 12.99, '72+': 11.99 }
            };

            const embellishmentPrices = fallbackPrices[embellishmentType] || fallbackPrices['dtg'];
            return embellishmentPrices[tier] || 15.99;
        },

        // Update cart display
        updateCartDisplay: function() {
            this.updateCartSummary();
            this.updateConstraintsDisplay();
            this.updateCartCount();
            this.enhancePricingTable();
        },

        // Update cart summary panel
        updateCartSummary: function() {
            const itemsList = document.getElementById('cart-items-list');
            const subtotalEl = document.getElementById('cart-subtotal');
            const ltmFeeEl = document.getElementById('cart-ltm-fee');
            const ltmQuantityEl = document.getElementById('ltm-quantity');
            const totalEl = document.getElementById('cart-total');
            const ltmRow = document.getElementById('ltm-fee-row');

            if (!itemsList) return;

            if (this.currentCart.items.length === 0) {
                itemsList.innerHTML = '<p style="color: #666; text-align: center; font-style: italic;">Cart is empty</p>';
            } else {
                itemsList.innerHTML = this.currentCart.items.map(item => `
                    <div style="border-bottom: 1px solid #eee; padding: 10px 0;">
                        <div style="display: flex; justify-content: space-between; align-items: start;">
                            <div style="flex: 1;">
                                <strong>${item.styleNumber} - ${item.color}</strong><br>
                                <small style="color: #666;">${item.printLocationName} | Qty: ${item.quantity}</small><br>
                                <small style="color: ${config.brandColor};">$${item.finalUnitPrice.toFixed(2)}/ea</small>
                            </div>
                            <div style="text-align: right;">
                                <strong>$${item.lineTotal.toFixed(2)}</strong><br>
                                <button onclick="UnifiedCartManager.removeItem('${item.id}')" 
                                        style="color: #dc3545; background: none; border: none; cursor: pointer; font-size: 0.8em;">
                                    Remove
                                </button>
                            </div>
                        </div>
                    </div>
                `).join('');
            }

            if (subtotalEl) subtotalEl.textContent = '$' + this.currentCart.totals.subtotal.toFixed(2);
            if (ltmFeeEl) ltmFeeEl.textContent = '$' + this.currentCart.totals.ltmTotal.toFixed(2);
            if (ltmQuantityEl) ltmQuantityEl.textContent = this.currentCart.totals.totalQuantity;
            if (totalEl) totalEl.textContent = '$' + this.currentCart.totals.grandTotal.toFixed(2);

            if (ltmRow) {
                ltmRow.style.display = this.currentCart.totals.ltmTotal > 0 ? 'block' : 'none';
            }
        },

        // Update constraints display
        updateConstraintsDisplay: function() {
            const locationEl = document.getElementById('constraint-location');
            const embellishmentEl = document.getElementById('constraint-embellishment');

            if (locationEl) {
                locationEl.textContent = this.currentCart.constraints.printLocation || 'Not selected';
            }
            if (embellishmentEl) {
                embellishmentEl.textContent = this.currentCart.constraints.embellishmentType || 'Not selected';
            }
        },

        // Update cart item count badge
        updateCartCount: function() {
            const countEl = document.getElementById('cart-item-count');
            if (countEl) {
                const uniqueItems = this.currentCart.items.length;
                countEl.textContent = uniqueItems;
                countEl.style.display = uniqueItems > 0 ? 'flex' : 'none';
            }
        },

        // Remove item from cart
        removeItem: function(itemId) {
            this.currentCart.items = this.currentCart.items.filter(item => item.id !== itemId);
            
            // Reset constraints if cart is empty
            if (this.currentCart.items.length === 0) {
                this.currentCart.constraints.embellishmentType = null;
                this.currentCart.constraints.printLocation = null;
            }

            this.calculateTotals();
            this.updateCartDisplay();
            this.saveCartToStorage();
        },

        // Save cart to localStorage
        saveCartToStorage: function() {
            localStorage.setItem(config.cartKey, JSON.stringify(this.currentCart));
        },

        // Show add to cart success message
        showAddToCartSuccess: function(itemData) {
            const successMsg = document.createElement('div');
            successMsg.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: #d4edda;
                color: #155724;
                border: 1px solid #c3e6cb;
                border-radius: 5px;
                padding: 15px;
                z-index: 10001;
                max-width: 300px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            `;

            successMsg.innerHTML = `
                <strong>✓ Added to Cart!</strong><br>
                ${itemData.styleNumber} - ${itemData.color}<br>
                Quantity: ${itemData.quantity}
            `;

            document.body.appendChild(successMsg);

            setTimeout(() => {
                successMsg.remove();
            }, 3000);
        },

        // View full cart
        viewCart: function() {
            window.location.href = '/cart';
        },

        // Request quote
        requestQuote: function() {
            if (this.currentCart.items.length === 0) {
                alert('Please add items to your cart before requesting a quote.');
                return;
            }

            // Convert cart to quote format and redirect
            const quoteData = {
                items: this.currentCart.items,
                totals: this.currentCart.totals,
                constraints: this.currentCart.constraints
            };

            localStorage.setItem('quote_request_data', JSON.stringify(quoteData));
            window.location.href = '/cart?mode=quote';
        },

        // Bind events
        bindEvents: function() {
            // Multi-color selection
            const multiColorCheckbox = document.getElementById('multi-color-mode');
            if (multiColorCheckbox) {
                multiColorCheckbox.addEventListener('change', (e) => {
                    this.toggleMultiColorMode(e.target.checked);
                });
            }

            // Add selected colors button
            const addColorsBtn = document.getElementById('add-selected-colors');
            if (addColorsBtn) {
                addColorsBtn.addEventListener('click', () => {
                    this.addSelectedColorsToCart();
                });
            }
        },

        // Toggle multi-color selection mode
        toggleMultiColorMode: function(enabled) {
            const display = document.getElementById('selected-colors-display');
            const swatches = document.querySelectorAll('.color-swatch');

            if (enabled) {
                display.style.display = 'block';
                swatches.forEach(swatch => {
                    swatch.style.cursor = 'pointer';
                    swatch.addEventListener('click', this.handleMultiColorSelection.bind(this));
                });
            } else {
                display.style.display = 'none';
                this.clearSelectedColors();
                swatches.forEach(swatch => {
                    swatch.removeEventListener('click', this.handleMultiColorSelection.bind(this));
                });
            }
        },

        // Handle multi-color selection
        handleMultiColorSelection: function(event) {
            const swatch = event.currentTarget;
            const colorName = swatch.getAttribute('data-color') || swatch.getAttribute('title');
            
            if (swatch.classList.contains('selected-for-cart')) {
                swatch.classList.remove('selected-for-cart');
                this.removeFromSelectedColors(colorName);
            } else {
                swatch.classList.add('selected-for-cart');
                this.addToSelectedColors(colorName, swatch);
            }

            this.updateSelectedColorsDisplay();
        },

        // Add to selected colors
        addToSelectedColors: function(colorName, swatch) {
            if (!this.selectedColors) this.selectedColors = [];
            
            if (!this.selectedColors.find(c => c.name === colorName)) {
                this.selectedColors.push({
                    name: colorName,
                    element: swatch
                });
            }
        },

        // Remove from selected colors
        removeFromSelectedColors: function(colorName) {
            if (!this.selectedColors) return;
            this.selectedColors = this.selectedColors.filter(c => c.name !== colorName);
        },

        // Update selected colors display
        updateSelectedColorsDisplay: function() {
            const list = document.getElementById('selected-colors-list');
            if (!list || !this.selectedColors) return;

            list.innerHTML = this.selectedColors.map(color => `
                <span style="background: #e9ecef; padding: 5px 10px; border-radius: 15px; font-size: 0.9em; margin: 2px;">
                    ${color.name}
                    <button onclick="UnifiedCartManager.removeSelectedColor('${color.name}')" 
                            style="background: none; border: none; color: #dc3545; margin-left: 5px; cursor: pointer;">×</button>
                </span>
            `).join('');
        },

        // Remove selected color
        removeSelectedColor: function(colorName) {
            const swatch = document.querySelector(`[data-color="${colorName}"], [title="${colorName}"]`);
            if (swatch) {
                swatch.classList.remove('selected-for-cart');
            }
            this.removeFromSelectedColors(colorName);
            this.updateSelectedColorsDisplay();
        },

        // Clear selected colors
        clearSelectedColors: function() {
            if (this.selectedColors) {
                this.selectedColors.forEach(color => {
                    if (color.element) {
                        color.element.classList.remove('selected-for-cart');
                    }
                });
            }
            this.selectedColors = [];
            this.updateSelectedColorsDisplay();
        },

        // Add selected colors to cart
        addSelectedColorsToCart: function() {
            if (!this.selectedColors || this.selectedColors.length === 0) {
                alert('Please select at least one color.');
                return;
            }

            // Get current product data
            const styleNumber = window.nwcaPricingData?.styleNumber || 'UNKNOWN';
            const embellishmentType = this.getCurrentEmbellishmentType();
            const printLocation = this.getCurrentPrintLocation();

            if (!printLocation) {
                alert('Please select a print location first.');
                return;
            }

            // Open quantity modal for selected colors
            this.openQuantityModal(this.selectedColors, styleNumber, embellishmentType, printLocation);
        },

        // Get current embellishment type from page
        getCurrentEmbellishmentType: function() {
            const pathname = window.location.pathname;
            if (pathname.includes('dtg')) return 'dtg';
            if (pathname.includes('embroidery')) return pathname.includes('cap') ? 'cap-embroidery' : 'embroidery';
            if (pathname.includes('screen-print')) return 'screen-print';
            if (pathname.includes('dtf')) return 'dtf';
            return 'dtg'; // fallback
        },

        // Get current print location
        getCurrentPrintLocation: function() {
            const locationSelect = document.getElementById('parent-dtg-location-select') || 
                                  document.getElementById('parent-location-select');
            return locationSelect ? locationSelect.value : null;
        },

        // Open quantity modal for multiple colors
        openQuantityModal: function(colors, styleNumber, embellishmentType, printLocation) {
            const modal = document.createElement('div');
            modal.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.5);
                z-index: 10000;
                display: flex;
                align-items: center;
                justify-content: center;
            `;

            const modalContent = document.createElement('div');
            modalContent.style.cssText = `
                background: white;
                border-radius: 8px;
                padding: 30px;
                max-width: 600px;
                max-height: 80vh;
                overflow-y: auto;
                position: relative;
            `;

            modalContent.innerHTML = `
                <h3 style="margin-top: 0; color: ${config.brandColor};">Add Multiple Colors to Cart</h3>
                <p>Set quantities for each selected color:</p>
                
                <div id="color-quantity-grid" style="display: grid; grid-template-columns: 1fr 150px; gap: 15px; margin: 20px 0;">
                    ${colors.map(color => `
                        <div style="display: contents;">
                            <div style="display: flex; align-items: center;">
                                <div style="width: 30px; height: 30px; border-radius: 50%; background: ${this.getColorHex(color.name)}; border: 2px solid #ddd; margin-right: 10px;"></div>
                                <span>${color.name}</span>
                            </div>
                            <div style="display: flex; align-items: center; gap: 5px;">
                                <button onclick="this.nextElementSibling.stepDown()" style="width: 30px; height: 30px; border: 1px solid #ddd; background: #f8f9fa; cursor: pointer;">-</button>
                                <input type="number" min="0" value="0" data-color="${color.name}" class="color-quantity-input" style="width: 60px; text-align: center; padding: 5px;">
                                <button onclick="this.previousElementSibling.stepUp()" style="width: 30px; height: 30px; border: 1px solid #ddd; background: #f8f9fa; cursor: pointer;">+</button>
                            </div>
                        </div>
                    `).join('')}
                </div>
                
                <div style="text-align: center; margin-top: 20px;">
                    <button onclick="this.parentElement.parentElement.parentElement.remove()" 
                            style="background: #6c757d; color: white; border: none; padding: 10px 20px; border-radius: 5px; margin-right: 10px; cursor: pointer;">
                        Cancel
                    </button>
                    <button onclick="UnifiedCartManager.submitMultiColorQuantities()" 
                            style="background: ${config.brandColor}; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer;">
                        Add to Cart
                    </button>
                </div>
            `;

            modal.appendChild(modalContent);
            document.body.appendChild(modal);

            // Store data for submission
            this.multiColorModalData = {
                colors,
                styleNumber,
                embellishmentType,
                printLocation,
                modal
            };
        },

        // Get color hex (simplified - could be enhanced with actual color mapping)
        getColorHex: function(colorName) {
            const colorMap = {
                'White': '#FFFFFF',
                'Black': '#000000',
                'Navy': '#001f3f',
                'Red': '#FF4136',
                'Blue': '#0074D9',
                'Green': '#2ECC40',
                'Yellow': '#FFDC00',
                'Gray': '#AAAAAA',
                'Purple': '#B10DC9',
                'Orange': '#FF851B'
            };
            return colorMap[colorName] || '#DDDDDD';
        },

        // Submit multi-color quantities
        submitMultiColorQuantities: function() {
            if (!this.multiColorModalData) return;

            const inputs = document.querySelectorAll('.color-quantity-input');
            const items = [];

            inputs.forEach(input => {
                const quantity = parseInt(input.value);
                if (quantity > 0) {
                    const colorName = input.getAttribute('data-color');
                    
                    // Create cart item
                    const itemData = {
                        styleNumber: this.multiColorModalData.styleNumber,
                        productName: `${this.multiColorModalData.styleNumber} - ${colorName}`,
                        color: colorName,
                        embellishmentType: this.multiColorModalData.embellishmentType,
                        printLocation: this.multiColorModalData.printLocation,
                        printLocationName: this.getLocationName(this.multiColorModalData.printLocation),
                        quantity: quantity,
                        baseUnitPrice: this.getBasePriceForTier('24-47', this.multiColorModalData.styleNumber, this.multiColorModalData.embellishmentType),
                        sizeBreakdown: this.createDefaultSizeBreakdown(quantity)
                    };

                    items.push(itemData);
                }
            });

            if (items.length === 0) {
                alert('Please enter quantities for at least one color.');
                return;
            }

            // Add all items to cart
            let successCount = 0;
            items.forEach(item => {
                if (this.addToCart(item)) {
                    successCount++;
                }
            });

            // Close modal and clear selections
            this.multiColorModalData.modal.remove();
            this.clearSelectedColors();
            
            if (successCount > 0) {
                this.showMultiColorSuccess(successCount);
            }
        },

        // Create default size breakdown
        createDefaultSizeBreakdown: function(totalQuantity) {
            const sizes = ['S', 'M', 'L', 'XL'];
            const perSize = Math.floor(totalQuantity / sizes.length);
            const remainder = totalQuantity % sizes.length;
            
            const breakdown = {};
            sizes.forEach((size, index) => {
                breakdown[size] = perSize + (index < remainder ? 1 : 0);
            });
            
            return breakdown;
        },

        // Get location name
        getLocationName: function(code) {
            const locations = {
                'FF': 'Full Front',
                'FB': 'Full Back',
                'LC': 'Left Chest',
                'RC': 'Right Chest',
                'JF': 'Jumbo Front',
                'JB': 'Jumbo Back'
            };
            return locations[code] || code;
        },

        // Show multi-color success message
        showMultiColorSuccess: function(count) {
            const successMsg = document.createElement('div');
            successMsg.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: #d4edda;
                color: #155724;
                border: 1px solid #c3e6cb;
                border-radius: 5px;
                padding: 15px;
                z-index: 10001;
                max-width: 300px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            `;

            successMsg.innerHTML = `
                <strong>✓ Multi-Color Success!</strong><br>
                Added ${count} color variant${count > 1 ? 's' : ''} to cart
            `;

            document.body.appendChild(successMsg);

            setTimeout(() => {
                successMsg.remove();
            }, 4000);
        },

        // Additional methods for cart UI integration
        
        // Adjust quantity with +/- buttons
        adjustQuantity: function(delta) {
            const input = document.getElementById('cart-quantity-input');
            if (!input) return;
            
            const currentValue = parseInt(input.value) || 0;
            const newValue = Math.max(1, currentValue + delta);
            input.value = newValue;
            
            // Update pricing if available
            this.calculateCurrentPricing();
        },

        // Calculate pricing for current quantity
        calculateCurrentPricing: function() {
            const quantityInput = document.getElementById('cart-quantity-input');
            const display = document.getElementById('current-pricing-display');
            const sizeSection = document.getElementById('size-distribution-section');
            
            if (!quantityInput || !display) return;
            
            const quantity = parseInt(quantityInput.value);
            if (!quantity || quantity < 1) {
                display.style.display = 'none';
                sizeSection.style.display = 'none';
                return;
            }

            const printLocation = this.getCurrentPrintLocation();
            if (!printLocation) {
                alert('Please select a print location first.');
                return;
            }

            // Calculate pricing
            const tier = this.getPricingTier(quantity);
            const basePrice = this.getBasePriceForTier(tier, this.getCurrentStyleNumber(), 'dtg');
            const hasLTM = quantity < config.ltmThreshold;
            const ltmPerUnit = hasLTM ? (config.ltmFee / quantity) : 0;
            const finalPrice = basePrice + ltmPerUnit;
            const lineTotal = finalPrice * quantity;

            // Update display
            display.innerHTML = `
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                    <div>
                        <strong>Pricing Tier:</strong> ${tier}<br>
                        <strong>Base Price:</strong> $${basePrice.toFixed(2)}/ea<br>
                        ${hasLTM ? `<strong style="color: #dc3545;">LTM Fee:</strong> $${ltmPerUnit.toFixed(2)}/ea<br>` : ''}
                        <strong>Your Price:</strong> $${finalPrice.toFixed(2)}/ea
                    </div>
                    <div style="text-align: right;">
                        <strong>Quantity:</strong> ${quantity} pieces<br>
                        <strong style="font-size: 1.2em; color: var(--primary-color);">Total: $${lineTotal.toFixed(2)}</strong>
                        ${hasLTM ? `<br><small style="color: #dc3545;">Includes $${config.ltmFee} LTM fee</small>` : ''}
                    </div>
                </div>
            `;
            display.style.display = 'block';

            // Show size distribution
            this.showSizeDistribution(quantity);
            sizeSection.style.display = 'block';
            
            this.enableAddToCartButton();
        },

        // Show size distribution for current item
        showSizeDistribution: function(totalQuantity) {
            const grid = document.getElementById('size-distribution-grid');
            const targetDisplay = document.getElementById('size-target-display');
            
            if (!grid) return;
            
            // Get available sizes
            const sizes = this.getAvailableSizes();
            
            // Create size inputs
            grid.innerHTML = `
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); gap: 10px;">
                    ${sizes.map(size => `
                        <div style="text-align: center; padding: 10px; border: 1px solid #ddd; border-radius: 5px; background: white;">
                            <label style="font-weight: bold; display: block; margin-bottom: 5px;">${size}</label>
                            <input type="number" class="size-qty-input" data-size="${size}" 
                                   min="0" value="0" style="width: 60px; text-align: center; padding: 5px; border: 1px solid #ccc; border-radius: 3px;"
                                   onchange="UnifiedCartManager.validateSizeDistribution()">
                        </div>
                    `).join('')}
                </div>
            `;
            
            if (targetDisplay) {
                targetDisplay.textContent = totalQuantity;
            }
            
            this.validateSizeDistribution();
        },

        // Validate size distribution
        validateSizeDistribution: function() {
            const inputs = document.querySelectorAll('.size-qty-input');
            const totalDisplay = document.getElementById('size-total-display');
            const targetDisplay = document.getElementById('size-target-display');
            const validationMsg = document.getElementById('size-validation-message');
            const addBtn = document.getElementById('main-add-to-cart-btn');
            
            let sum = 0;
            inputs.forEach(input => {
                sum += parseInt(input.value) || 0;
            });
            
            const target = parseInt(targetDisplay?.textContent) || 0;
            const isValid = sum === target && sum > 0;
            
            if (totalDisplay) totalDisplay.textContent = sum;
            
            if (validationMsg) {
                validationMsg.style.display = isValid ? 'none' : 'block';
                validationMsg.textContent = sum === 0 ? 'Please enter size quantities' : 
                                          sum !== target ? 'Sizes must add up to total quantity' : '';
            }
            
            if (addBtn) {
                addBtn.disabled = !isValid;
                addBtn.style.background = isValid ? 'var(--primary-color)' : '#6c757d';
                addBtn.style.cursor = isValid ? 'pointer' : 'not-allowed';
                addBtn.style.opacity = isValid ? '1' : '0.6';
            }
            
            return isValid;
        },

        // Enable add to cart button
        enableAddToCartButton: function() {
            const btn = document.getElementById('main-add-to-cart-btn');
            if (btn) {
                btn.disabled = false;
                btn.style.background = 'var(--primary-color)';
                btn.style.cursor = 'pointer';
                btn.style.opacity = '1';
            }
        },

        // Add current item to cart
        addCurrentItemToCart: function() {
            const quantityInput = document.getElementById('cart-quantity-input');
            const quantity = parseInt(quantityInput?.value);
            
            if (!quantity || quantity < 1) {
                alert('Please enter a valid quantity.');
                return;
            }

            if (!this.validateSizeDistribution()) {
                alert('Please ensure sizes add up to total quantity.');
                return;
            }

            const printLocation = this.getCurrentPrintLocation();
            if (!printLocation) {
                alert('Please select a print location.');
                return;
            }

            // Get size breakdown
            const sizeBreakdown = {};
            document.querySelectorAll('.size-qty-input').forEach(input => {
                const qty = parseInt(input.value) || 0;
                if (qty > 0) {
                    sizeBreakdown[input.dataset.size] = qty;
                }
            });

            // Get current product info
            const styleNumber = this.getCurrentStyleNumber();
            const color = this.getCurrentColor();
            const tier = this.getPricingTier(quantity);
            const basePrice = this.getBasePriceForTier(tier, styleNumber, 'dtg');

            const itemData = {
                styleNumber: styleNumber,
                productName: `${styleNumber} - ${color}`,
                color: color,
                embellishmentType: 'dtg',
                printLocation: printLocation,
                printLocationName: this.getLocationName(printLocation),
                quantity: quantity,
                baseUnitPrice: basePrice,
                sizeBreakdown: sizeBreakdown
            };

            if (this.addToCart(itemData)) {
                // Reset form
                this.resetCartForm();
            }
        },

        // Get current style number
        getCurrentStyleNumber: function() {
            return window.nwcaPricingData?.styleNumber || 
                   document.getElementById('product-style-context')?.textContent ||
                   new URLSearchParams(window.location.search).get('StyleNumber') ||
                   'UNKNOWN';
        },

        // Get current color
        getCurrentColor: function() {
            return window.nwcaPricingData?.color ||
                   document.getElementById('pricing-color-name')?.textContent ||
                   new URLSearchParams(window.location.search).get('COLOR') ||
                   'Unknown';
        },

        // Get available sizes
        getAvailableSizes: function() {
            return window.nwcaPricingData?.uniqueSizes || 
                   window.currentCaspioPricing?.uniqueSizes || 
                   ['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'];
        },

        // Reset cart form
        resetCartForm: function() {
            const quantityInput = document.getElementById('cart-quantity-input');
            const display = document.getElementById('current-pricing-display');
            const sizeSection = document.getElementById('size-distribution-section');
            const addBtn = document.getElementById('main-add-to-cart-btn');
            
            if (quantityInput) quantityInput.value = '24';
            if (display) display.style.display = 'none';
            if (sizeSection) sizeSection.style.display = 'none';
            
            if (addBtn) {
                addBtn.disabled = true;
                addBtn.style.background = '#6c757d';
                addBtn.style.cursor = 'not-allowed';
                addBtn.style.opacity = '0.6';
            }
        }
    };

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => UnifiedCartManager.init());
    } else {
        UnifiedCartManager.init();
    }

    // CSS for multi-color selection
    const style = document.createElement('style');
    style.textContent = `
        .color-swatch.selected-for-cart {
            border-color: ${config.brandColor} !important;
            box-shadow: 0 0 0 3px rgba(46, 88, 39, 0.3) !important;
            transform: scale(1.1);
        }
        
        .cart-summary-panel {
            font-family: Arial, sans-serif;
        }
        
        .cart-summary-panel .btn-primary {
            background: ${config.brandColor};
            color: white;
            border: none;
            padding: 10px 15px;
            border-radius: 5px;
            cursor: pointer;
            font-weight: bold;
        }
        
        .cart-summary-panel .btn-secondary {
            background: #6c757d;
            color: white;
            border: none;
            padding: 10px 15px;
            border-radius: 5px;
            cursor: pointer;
        }
        
        .cart-summary-panel .btn-primary:hover {
            background: #1a3316;
        }
        
        .cart-summary-panel .btn-secondary:hover {
            background: #545b62;
        }
    `;
    document.head.appendChild(style);

})();