// DTF Quote Adapter
// Extends QuoteAdapterBase to handle DTF-specific quote functionality
// For Northwest Custom Apparel - June 2025

(function() {
    'use strict';

    // DTF-specific configuration
    const DTF_CONFIG = {
        embellishmentType: 'dtf',
        displayName: 'DTF Transfer',
        ltmThreshold: 24,
        ltmFee: 50.00,
        freight: 15.00,
        laborPerTransfer: 2.00,
        targetMargin: 0.43,        // 2026 margin - synced with API
        marginDivisor: 0.57,       // 2026 margin (43%) - synced with API Pricing_Tiers.MarginDenominator
        defaultGarmentCost: 5.50
    };

    // DTF pricing tiers
    const PRICING_TIERS = [
        { min: 1, max: 23, label: "Under 24", isLTM: true },
        { min: 24, max: 47, label: "24-47", baseQty: 24 },
        { min: 48, max: 71, label: "48-71", baseQty: 48 },
        { min: 72, max: 100, label: "72-100", baseQty: 72 },
        { min: 101, max: 250, label: "101-250", baseQty: 101 },
        { min: 251, max: 999999, label: "251+", baseQty: 251 }
    ];

    // DTF Transfer pricing data
    const DTF_PRICING_DATA = {
        small: {
            sizes: [
                '1.5" x 1.5"',
                '2.5" x 2.5"',
                '4" x 4" (Left Chest)',
                '5.8" x 8.3"'
            ],
            prices: {
                '1.5" x 1.5"': [
                    {min: 10, max: 19, price: 5.25},
                    {min: 20, max: 49, price: 4.25},
                    {min: 50, max: 99, price: 2.50},
                    {min: 100, max: 199, price: 1.75},
                    {min: 200, max: 299, price: 1.50},
                    {min: 300, max: 499, price: 1.25},
                    {min: 500, max: 999, price: 1.00},
                    {min: 1000, max: 999999, price: 1.00}
                ],
                '2.5" x 2.5"': [
                    {min: 10, max: 19, price: 5.75},
                    {min: 20, max: 49, price: 4.75},
                    {min: 50, max: 99, price: 3.25},
                    {min: 100, max: 199, price: 2.25},
                    {min: 200, max: 299, price: 2.00},
                    {min: 300, max: 499, price: 1.50},
                    {min: 500, max: 999, price: 1.50},
                    {min: 1000, max: 999999, price: 1.25}
                ],
                '4" x 4" (Left Chest)': [
                    {min: 10, max: 19, price: 6.25},
                    {min: 20, max: 49, price: 5.25},
                    {min: 50, max: 99, price: 4.00},
                    {min: 100, max: 199, price: 3.00},
                    {min: 200, max: 299, price: 2.50},
                    {min: 300, max: 499, price: 2.25},
                    {min: 500, max: 999, price: 2.25},
                    {min: 1000, max: 999999, price: 2.00}
                ],
                '5.8" x 8.3"': [
                    {min: 10, max: 19, price: 8.25},
                    {min: 20, max: 49, price: 7.00},
                    {min: 50, max: 99, price: 5.00},
                    {min: 100, max: 199, price: 3.50},
                    {min: 200, max: 299, price: 3.00},
                    {min: 300, max: 499, price: 2.75},
                    {min: 500, max: 999, price: 2.50},
                    {min: 1000, max: 999999, price: 2.00}
                ]
            }
        },
        large: {
            sizes: [
                '8.3" x 11.7" (Safety Shirt FB)',
                '11.7" x 4.25"',
                '11.7" x 11.7" (FF or FB)',
                '16.5" x 5.85"',
                '11.7" x 16.5"'
            ],
            prices: {
                '8.3" x 11.7" (Safety Shirt FB)': [
                    {min: 10, max: 19, price: 10.00},
                    {min: 20, max: 49, price: 8.25},
                    {min: 50, max: 99, price: 6.50},
                    {min: 100, max: 199, price: 4.50},
                    {min: 200, max: 299, price: 3.75},
                    {min: 300, max: 499, price: 3.50},
                    {min: 500, max: 999, price: 3.25},
                    {min: 1000, max: 999999, price: 2.75}
                ],
                '11.7" x 4.25"': [
                    {min: 10, max: 19, price: 8.25},
                    {min: 20, max: 49, price: 7.00},
                    {min: 50, max: 99, price: 5.00},
                    {min: 100, max: 199, price: 3.50},
                    {min: 200, max: 299, price: 3.00},
                    {min: 300, max: 499, price: 2.75},
                    {min: 500, max: 999, price: 2.50},
                    {min: 1000, max: 999999, price: 2.00}
                ],
                '11.7" x 11.7" (FF or FB)': [
                    {min: 10, max: 19, price: 12.50},
                    {min: 20, max: 49, price: 10.50},
                    {min: 50, max: 99, price: 8.25},
                    {min: 100, max: 199, price: 5.75},
                    {min: 200, max: 299, price: 4.75},
                    {min: 300, max: 499, price: 4.50},
                    {min: 500, max: 999, price: 4.25},
                    {min: 1000, max: 999999, price: 3.75}
                ],
                '16.5" x 5.85"': [
                    {min: 10, max: 19, price: 10.00},
                    {min: 20, max: 49, price: 8.25},
                    {min: 50, max: 99, price: 6.50},
                    {min: 100, max: 199, price: 4.50},
                    {min: 200, max: 299, price: 3.75},
                    {min: 300, max: 499, price: 3.50},
                    {min: 500, max: 999, price: 3.25},
                    {min: 1000, max: 999999, price: 2.75}
                ],
                '11.7" x 16.5"': [
                    {min: 10, max: 19, price: 15.00},
                    {min: 20, max: 49, price: 12.50},
                    {min: 50, max: 99, price: 10.00},
                    {min: 100, max: 199, price: 7.00},
                    {min: 200, max: 299, price: 6.00},
                    {min: 300, max: 499, price: 5.50},
                    {min: 500, max: 999, price: 5.25},
                    {min: 1000, max: 999999, price: 4.75}
                ]
            }
        }
    };

    class DTFQuoteAdapter extends window.QuoteAdapterBase {
        constructor() {
            super('dtf', DTF_CONFIG);
            this.garmentCost = DTF_CONFIG.defaultGarmentCost;
            this.currentStyleNumber = '';
            this.hasSecondLocation = false;
        }

        // Override setupUI to create DTF-specific interface
        setupUI() {
            const cartSection = document.getElementById('add-to-cart-section');
            if (cartSection) {
                cartSection.innerHTML = this.getQuoteBuilderHTML();
            }
            this.addQuoteSummaryPanel();
            this.setupTransferSizeSelectors();
        }

        // Get DTF-specific quote builder HTML
        getQuoteBuilderHTML() {
            return `
                <div class="quote-builder-container">
                    <h3 class="section-title" style="color: ${this.config.brandColor};">Build Your DTF Quote</h3>
                    
                    <!-- Product Info Display -->
                    <div class="quote-product-info" style="background-color: var(--background-light); padding: 15px; border-radius: var(--radius-sm); margin-bottom: 20px;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <strong>Product:</strong> <span id="quote-product-name">Loading...</span><br>
                                <strong>Style:</strong> <span id="quote-style-number">Loading...</span>
                            </div>
                            <div>
                                <strong>Selected Color:</strong> <span id="quote-selected-color">None</span>
                            </div>
                        </div>
                    </div>

                    <!-- Transfer Configuration -->
                    <div class="dtf-transfer-config" style="background-color: var(--white); padding: 20px; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
                        <h4 style="margin-top: 0; color: var(--primary-color);">Configure Your DTF Transfers</h4>
                        
                        <div id="quote-locations-container">
                            <!-- Location 1 (Primary) -->
                            <div class="transfer-location" id="quote-location1" style="margin-bottom: 20px; padding: 15px; background-color: var(--background-light); border-radius: var(--radius-sm);">
                                <div class="location-header" style="margin-bottom: 15px;">
                                    <strong style="color: var(--primary-color);">Location 1: Primary Transfer</strong>
                                </div>
                                
                                <div class="transfer-size-selector" style="margin-bottom: 15px;">
                                    <label for="quote-category1" style="display: block; margin-bottom: 5px; font-weight: 600;">Transfer Category</label>
                                    <select id="quote-category1" class="form-control" style="width: 100%; padding: 8px; border: 1px solid var(--border-color); border-radius: var(--radius-sm);">
                                        <option value="small">Small Transfers (1.5" - 5.8")</option>
                                        <option value="large">Large Transfers (8.3" - 16.5")</option>
                                    </select>
                                </div>

                                <div class="transfer-size-selector">
                                    <label for="quote-size1" style="display: block; margin-bottom: 5px; font-weight: 600;">Transfer Size</label>
                                    <select id="quote-size1" class="form-control" style="width: 100%; padding: 8px; border: 1px solid var(--border-color); border-radius: var(--radius-sm);">
                                        <!-- Options populated dynamically -->
                                    </select>
                                </div>
                            </div>
                        </div>

                        <button id="quote-add-location-btn" class="btn-secondary" style="width: 100%; padding: 10px; margin-bottom: 20px;">
                            + Add Second Location
                        </button>

                        <!-- Quantity Input -->
                        <div class="quantity-section" style="margin-bottom: 20px;">
                            <label for="quote-total-quantity" style="display: block; margin-bottom: 5px; font-weight: 600;">Total Quantity</label>
                            <input type="number" id="quote-total-quantity" min="1" placeholder="Enter quantity" 
                                   style="width: 100%; padding: 8px; border: 1px solid var(--border-color); border-radius: var(--radius-sm);">
                            <div class="info-text" style="font-size: 0.85em; color: #777; margin-top: 5px;">
                                Orders under 24 pieces: $50 minimum charge
                            </div>
                        </div>

                        <!-- Size Distribution -->
                        <div id="quote-size-distribution" style="display: none; margin-bottom: 20px; padding: 15px; background-color: var(--background-light); border-radius: var(--radius-sm);">
                            <h5 style="margin-top: 0;">Size Distribution</h5>
                            <div id="quote-size-inputs">
                                <!-- Size inputs will be populated here -->
                            </div>
                        </div>

                        <!-- Add to Quote Button -->
                        <button id="add-to-quote-btn" class="btn-primary" style="width: 100%; padding: 15px; font-size: 1.1em; font-weight: 600;">
                            Add to Quote
                        </button>
                    </div>

                    <!-- Price Preview -->
                    <div id="quote-price-preview" style="display: none; margin-top: 20px; padding: 20px; background-color: #f0f7ed; border-radius: var(--radius-md); border: 2px solid var(--primary-color);">
                        <h4 style="margin-top: 0; color: var(--primary-color);">Price Preview</h4>
                        <div id="quote-preview-content">
                            <!-- Preview content will be populated here -->
                        </div>
                    </div>
                </div>
            `;
        }

        // Setup transfer size selectors
        setupTransferSizeSelectors() {
            const category1 = document.getElementById('quote-category1');
            if (category1) {
                category1.addEventListener('change', () => this.updateTransferSizes(1));
                this.updateTransferSizes(1);
            }
        }

        // Update transfer sizes based on category
        updateTransferSizes(locationNum) {
            const category = document.getElementById(`quote-category${locationNum}`).value;
            const sizeSelect = document.getElementById(`quote-size${locationNum}`);
            
            if (!sizeSelect) return;
            
            sizeSelect.innerHTML = '';
            
            DTF_PRICING_DATA[category].sizes.forEach(size => {
                const option = document.createElement('option');
                option.value = size;
                option.textContent = size;
                sizeSelect.appendChild(option);
            });
            
            // Set default selections
            if (locationNum === 1 && category === 'small') {
                sizeSelect.value = '4" x 4" (Left Chest)';
            } else if (category === 'large') {
                sizeSelect.value = '11.7" x 11.7" (FF or FB)';
            }
        }

        // Override bindEvents to add DTF-specific event handlers
        bindEvents() {
            super.bindEvents();

            // Add location button
            const addLocationBtn = document.getElementById('quote-add-location-btn');
            if (addLocationBtn) {
                addLocationBtn.addEventListener('click', () => this.toggleSecondLocation());
            }

            // Total quantity input
            const totalQtyInput = document.getElementById('quote-total-quantity');
            if (totalQtyInput) {
                totalQtyInput.addEventListener('input', () => this.updateSizeDistribution());
            }

            // Add to quote button
            const addToQuoteBtn = document.getElementById('add-to-quote-btn');
            if (addToQuoteBtn) {
                addToQuoteBtn.addEventListener('click', () => this.handleAddToQuote());
            }

            // Listen for product data events
            document.addEventListener('productColorsReady', (event) => this.handleProductData(event));
            document.addEventListener('colorSelected', (event) => this.handleColorSelection(event));
        }

        // Toggle second location
        toggleSecondLocation() {
            const container = document.getElementById('quote-locations-container');
            const btn = document.getElementById('quote-add-location-btn');
            
            if (!this.hasSecondLocation) {
                // Add second location
                const location2HTML = `
                    <div class="transfer-location" id="quote-location2" style="margin-bottom: 20px; padding: 15px; background-color: var(--background-light); border-radius: var(--radius-sm);">
                        <div class="location-header" style="margin-bottom: 15px; display: flex; justify-content: space-between; align-items: center;">
                            <strong style="color: var(--primary-color);">Location 2: Second Transfer</strong>
                            <button class="btn-link" onclick="dtfQuoteAdapter.toggleSecondLocation()" style="color: #dc3545;">Remove</button>
                        </div>
                        
                        <div class="transfer-size-selector" style="margin-bottom: 15px;">
                            <label for="quote-category2" style="display: block; margin-bottom: 5px; font-weight: 600;">Transfer Category</label>
                            <select id="quote-category2" class="form-control" style="width: 100%; padding: 8px; border: 1px solid var(--border-color); border-radius: var(--radius-sm);">
                                <option value="small">Small Transfers (1.5" - 5.8")</option>
                                <option value="large" selected>Large Transfers (8.3" - 16.5")</option>
                            </select>
                        </div>

                        <div class="transfer-size-selector">
                            <label for="quote-size2" style="display: block; margin-bottom: 5px; font-weight: 600;">Transfer Size</label>
                            <select id="quote-size2" class="form-control" style="width: 100%; padding: 8px; border: 1px solid var(--border-color); border-radius: var(--radius-sm);">
                                <!-- Options populated dynamically -->
                            </select>
                        </div>
                    </div>
                `;
                
                container.insertAdjacentHTML('beforeend', location2HTML);
                btn.textContent = '- Remove Second Location';
                this.hasSecondLocation = true;
                
                // Setup event listener for category change
                const category2 = document.getElementById('quote-category2');
                if (category2) {
                    category2.addEventListener('change', () => this.updateTransferSizes(2));
                    this.updateTransferSizes(2);
                }
            } else {
                // Remove second location
                const location2 = document.getElementById('quote-location2');
                if (location2) {
                    location2.remove();
                }
                btn.textContent = '+ Add Second Location';
                this.hasSecondLocation = false;
            }
        }

        // Update size distribution inputs
        updateSizeDistribution() {
            const totalQty = parseInt(document.getElementById('quote-total-quantity').value) || 0;
            const sizeDistDiv = document.getElementById('quote-size-distribution');
            const sizeInputsDiv = document.getElementById('quote-size-inputs');
            
            if (totalQty > 0) {
                sizeDistDiv.style.display = 'block';
                
                // Get available sizes from product data or use defaults
                const sizes = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'];
                
                sizeInputsDiv.innerHTML = `
                    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(80px, 1fr)); gap: 10px;">
                        ${sizes.map(size => `
                            <div style="text-align: center;">
                                <label style="display: block; font-size: 0.9em; margin-bottom: 3px;">${size}</label>
                                <input type="number" class="size-qty-input" data-size="${size}" min="0" 
                                       style="width: 100%; padding: 5px; border: 1px solid var(--border-color); border-radius: var(--radius-sm);">
                            </div>
                        `).join('')}
                    </div>
                    <div style="margin-top: 10px; text-align: right;">
                        <span style="font-size: 0.9em;">Total: <strong id="size-dist-total">0</strong> / ${totalQty}</span>
                    </div>
                `;
                
                // Add event listeners to size inputs
                const sizeInputs = sizeInputsDiv.querySelectorAll('.size-qty-input');
                sizeInputs.forEach(input => {
                    input.addEventListener('input', () => this.updateSizeDistributionTotal());
                });
            } else {
                sizeDistDiv.style.display = 'none';
            }
        }

        // Update size distribution total
        updateSizeDistributionTotal() {
            const sizeInputs = document.querySelectorAll('.size-qty-input');
            let total = 0;
            sizeInputs.forEach(input => {
                total += parseInt(input.value) || 0;
            });
            
            const totalSpan = document.getElementById('size-dist-total');
            if (totalSpan) {
                totalSpan.textContent = total;
                
                const expectedTotal = parseInt(document.getElementById('quote-total-quantity').value) || 0;
                totalSpan.style.color = total === expectedTotal ? 'green' : 'red';
            }
        }

        // Handle product data
        handleProductData(event) {
            console.log('[DTF Quote] Product data received:', event.detail);
            
            const styleNumber = event.detail?.styleNumber || 'Unknown';
            const productName = event.detail?.productName || 'Product';
            
            this.currentStyleNumber = styleNumber;
            
            // Update display
            const styleEl = document.getElementById('quote-style-number');
            const nameEl = document.getElementById('quote-product-name');
            
            if (styleEl) styleEl.textContent = styleNumber;
            if (nameEl) nameEl.textContent = productName;
            
            // Fetch garment cost
            this.fetchGarmentCost(styleNumber);
        }

        // Handle color selection
        handleColorSelection(event) {
            const color = event.detail?.colorName || 'None';
            const colorEl = document.getElementById('quote-selected-color');
            if (colorEl) {
                colorEl.textContent = color;
            }
        }

        // Fetch garment cost from API
        async fetchGarmentCost(styleNumber) {
            try {
                const response = await fetch(`${this.config.apiBaseUrl}/max-prices-by-style?styleNumber=${styleNumber}`);
                if (response.ok) {
                    const data = await response.json();
                    if (data && data.sizes && data.sizes.length > 0) {
                        // Find the lowest price (base garment cost)
                        this.garmentCost = Math.min(...data.sizes.map(size => size.price));
                        console.log('[DTF Quote] Garment cost updated:', this.garmentCost);
                    }
                }
            } catch (error) {
                console.error('[DTF Quote] Error fetching garment cost:', error);
                this.garmentCost = DTF_CONFIG.defaultGarmentCost;
            }
        }

        // Find transfer price based on size and quantity
        findTransferPrice(category, size, quantity) {
            const priceTable = DTF_PRICING_DATA[category].prices[size];
            
            for (let tier of priceTable) {
                if (quantity >= tier.min && quantity <= tier.max) {
                    return tier.price;
                }
            }
            
            return null;
        }

        // Get current pricing tier
        getCurrentTier(quantity) {
            for (let tier of PRICING_TIERS) {
                if (quantity >= tier.min && quantity <= tier.max) {
                    return tier;
                }
            }
            return PRICING_TIERS[PRICING_TIERS.length - 1];
        }

        // Calculate DTF price
        calculateDTFPrice(transfers, quantity) {
            const currentTier = this.getCurrentTier(quantity);
            
            // Calculate total transfer cost
            let totalTransferCost = 0;
            transfers.forEach(transfer => {
                const transferPrice = this.findTransferPrice(transfer.category, transfer.size, quantity);
                if (transferPrice) {
                    totalTransferCost += transferPrice;
                }
            });
            
            // Calculate pricing components
            const freightPerPiece = DTF_CONFIG.freight / (currentTier.baseQty || quantity);
            const garmentPriceWithMargin = this.garmentCost / DTF_CONFIG.marginDivisor;
            const laborCost = DTF_CONFIG.laborPerTransfer * transfers.length;
            
            // Calculate base unit price
            let baseUnitPrice = garmentPriceWithMargin + totalTransferCost + freightPerPiece + laborCost;
            
            // Apply LTM if needed
            let ltmPerUnit = 0;
            if (currentTier.isLTM) {
                ltmPerUnit = DTF_CONFIG.ltmFee / quantity;
            }
            
            return {
                baseUnitPrice,
                ltmPerUnit,
                finalUnitPrice: baseUnitPrice + ltmPerUnit,
                totalTransferCost,
                freightPerPiece,
                laborCost,
                garmentPriceWithMargin,
                currentTier
            };
        }

        // Handle add to quote
        handleAddToQuote() {
            // Validate inputs
            const totalQty = parseInt(document.getElementById('quote-total-quantity').value) || 0;
            if (!this.validateQuantity(totalQty)) {
                alert('Please enter a valid quantity');
                return;
            }
            
            // Validate size distribution
            const sizeInputs = document.querySelectorAll('.size-qty-input');
            if (sizeInputs.length > 0 && !this.validateSizeDistribution(sizeInputs, totalQty)) {
                alert('Size distribution must equal total quantity');
                return;
            }
            
            // Get transfer configurations
            const transfers = [];
            
            // Location 1
            const category1 = document.getElementById('quote-category1').value;
            const size1 = document.getElementById('quote-size1').value;
            transfers.push({ category: category1, size: size1, location: 1 });
            
            // Location 2 (if exists)
            if (this.hasSecondLocation) {
                const category2 = document.getElementById('quote-category2').value;
                const size2 = document.getElementById('quote-size2').value;
                transfers.push({ category: category2, size: size2, location: 2 });
            }
            
            // Calculate pricing
            const pricing = this.calculateDTFPrice(transfers, totalQty);
            
            // Get size breakdown
            const sizeBreakdown = {};
            sizeInputs.forEach(input => {
                const size = input.dataset.size;
                const qty = parseInt(input.value) || 0;
                if (qty > 0) {
                    sizeBreakdown[size] = qty;
                }
            });
            
            // Create quote item
            const itemData = {
                styleNumber: this.currentStyleNumber,
                productName: document.getElementById('quote-product-name')?.textContent || 'Product',
                color: document.getElementById('quote-selected-color')?.textContent || 'None',
                quantity: totalQty,
                baseUnitPrice: pricing.baseUnitPrice,
                transfers: transfers,
                sizeBreakdown: sizeBreakdown,
                garmentCost: this.garmentCost,
                transferDetails: transfers.map(t => ({
                    location: t.location,
                    category: t.category,
                    size: t.size,
                    price: this.findTransferPrice(t.category, t.size, totalQty)
                }))
            };
            
            const quoteItem = this.createQuoteItem(itemData);
            this.addItemToQuote(quoteItem);
            
            // Reset form
            this.resetQuoteBuilder();
            
            // Show price preview
            this.showPricePreview(pricing, totalQty);
        }

        // Show price preview
        showPricePreview(pricing, quantity) {
            const previewDiv = document.getElementById('quote-price-preview');
            const contentDiv = document.getElementById('quote-preview-content');
            
            if (!previewDiv || !contentDiv) return;
            
            previewDiv.style.display = 'block';
            
            contentDiv.innerHTML = `
                <div style="display: grid; gap: 10px;">
                    <div style="display: flex; justify-content: space-between;">
                        <span>Garment (with margin):</span>
                        <strong>$${pricing.garmentPriceWithMargin.toFixed(2)}</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span>Transfer Cost:</span>
                        <strong>$${pricing.totalTransferCost.toFixed(2)}</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span>Freight:</span>
                        <strong>$${pricing.freightPerPiece.toFixed(2)}</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span>Labor:</span>
                        <strong>$${pricing.laborCost.toFixed(2)}</strong>
                    </div>
                    ${pricing.ltmPerUnit > 0 ? `
                        <div style="display: flex; justify-content: space-between; color: #dc3545;">
                            <span>LTM Fee:</span>
                            <strong>$${pricing.ltmPerUnit.toFixed(2)}</strong>
                        </div>
                    ` : ''}
                    <div style="display: flex; justify-content: space-between; border-top: 2px solid var(--primary-color); padding-top: 10px; margin-top: 10px; font-size: 1.2em;">
                        <span><strong>Price per Piece:</strong></span>
                        <strong style="color: var(--primary-color);">$${pricing.finalUnitPrice.toFixed(2)}</strong>
                    </div>
                    <div style="text-align: center; margin-top: 15px; padding: 10px; background-color: var(--primary-light); border-radius: var(--radius-sm);">
                        <strong>Total: $${(pricing.finalUnitPrice * quantity).toFixed(2)}</strong> for ${quantity} pieces
                    </div>
                </div>
            `;
        }

        // Override reset quote builder
        resetQuoteBuilder() {
            // Reset quantity
            const qtyInput = document.getElementById('quote-total-quantity');
            if (qtyInput) qtyInput.value = '';
            
            // Reset size distribution
            const sizeDistDiv = document.getElementById('quote-size-distribution');
            if (sizeDistDiv) sizeDistDiv.style.display = 'none';
            
            // Reset to single location
            if (this.hasSecondLocation) {
                this.toggleSecondLocation();
            }
            
            // Reset selectors to defaults
            const category1 = document.getElementById('quote-category1');
            if (category1) {
                category1.value = 'small';
                this.updateTransferSizes(1);
            }
            
            // Hide price preview
            const previewDiv = document.getElementById('quote-price-preview');
            if (previewDiv) previewDiv.style.display = 'none';
        }

        // Override getItemDetailsHTML for DTF-specific display
        getItemDetailsHTML(item) {
            const transfersText = item.transfers.map(t => t.size).join(' + ');
            return `
                <div style="font-size: 0.9em;">
                    <div>Transfers: ${transfersText}</div>
                    <div>Qty: ${item.quantity} @ $${item.finalUnitPrice.toFixed(2)}/ea</div>
                    ${item.hasLTM ? '<div style="color: #dc3545;">Includes LTM fee</div>' : ''}
                </div>
            `;
        }

        // Override getAdditionalItemData for DTF-specific fields
        getAdditionalItemData(item) {
            return {
                TransferCount: item.transfers.length,
                Transfer1Category: item.transfers[0]?.category || '',
                Transfer1Size: item.transfers[0]?.size || '',
                Transfer2Category: item.transfers[1]?.category || '',
                Transfer2Size: item.transfers[1]?.size || '',
                GarmentCost: item.garmentCost,
                SizeBreakdown: JSON.stringify(item.sizeBreakdown || {})
            };
        }

        // Override convertApiItemToQuoteItem for DTF-specific conversion
        convertApiItemToQuoteItem(apiItem) {
            const baseItem = super.convertApiItemToQuoteItem(apiItem);
            
            // Add DTF-specific fields
            const transfers = [];
            if (apiItem.Transfer1Size) {
                transfers.push({
                    location: 1,
                    category: apiItem.Transfer1Category,
                    size: apiItem.Transfer1Size
                });
            }
            if (apiItem.Transfer2Size) {
                transfers.push({
                    location: 2,
                    category: apiItem.Transfer2Category,
                    size: apiItem.Transfer2Size
                });
            }
            
            return {
                ...baseItem,
                transfers: transfers,
                garmentCost: apiItem.GarmentCost,
                sizeBreakdown: apiItem.SizeBreakdown ? JSON.parse(apiItem.SizeBreakdown) : {}
            };
        }
    }

    // Initialize DTF Quote Adapter when DOM is ready
    function initializeDTFQuoteAdapter() {
        console.log('[DTF Quote] Initializing DTF Quote Adapter');
        
        // Create global instance
        window.dtfQuoteAdapter = new DTFQuoteAdapter();
        
        // Initialize the adapter
        window.dtfQuoteAdapter.init();
        
        // Dispatch ready event
        window.dispatchEvent(new CustomEvent('dtfQuoteAdapterReady', {
            detail: { adapter: window.dtfQuoteAdapter }
        }));
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeDTFQuoteAdapter);
    } else {
        initializeDTFQuoteAdapter();
    }

})();