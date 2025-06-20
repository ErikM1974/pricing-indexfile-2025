// Embroidery Pricing V3 - Production Implementation
// Provides 3-step structure matching cap embroidery page

(function() {
    'use strict';

    // Constants
    const BASE_STITCHES = 8000;
    const PRICE_PER_THOUSAND = 1.25;
    const LOGO_BASE_PRICE = 5.00;
    const LOGO_BASE_STITCHES = 5000;
    const LTM_FEE = 50.00;
    const MIN_QUANTITY = 24;

    // State
    let basePrices = {};
    let currentFrontStitches = BASE_STITCHES;
    let currentBackStitches = 8000;
    let currentLeftStitches = 8000;
    let currentRightStitches = 8000;
    let backLogoEnabled = false;
    let leftLogoEnabled = false;
    let rightLogoEnabled = false;
    let currentQuantity = 19; // Default to 19 to match user's example
    let pricingData = null;
    let frontAdjustment = 0;
    let backLogoPrice = 8.75; // 8000 stitches = $5 base + $3.75 for 3000 extra stitches
    let leftLogoPrice = 8.75;
    let rightLogoPrice = 8.75;
    
    // DOM element references
    const elements = {};
    
    // Calculate additional logo price
    function calculateAdditionalLogoPrice(stitches) {
        const base = LOGO_BASE_PRICE;
        const extraStitches = Math.max(0, stitches - LOGO_BASE_STITCHES);
        return base + (extraStitches / 1000) * PRICE_PER_THOUSAND;
    }

    // Initialize on DOM ready
    document.addEventListener('DOMContentLoaded', function() {
        console.log('[EMBROIDERY-PRICING-V3] Initializing...');
        
        // Make updateHeaderPricing globally available
        window.updateHeaderPricing = function(quantity, unitPrice) {
            const headerQty = document.getElementById('header-quantity');
            const headerPrice = document.getElementById('header-unit-price');
            
            if (headerQty) headerQty.textContent = quantity;
            if (headerPrice) headerPrice.textContent = typeof unitPrice === 'number' ? `$${unitPrice.toFixed(2)}` : unitPrice;
        };
        
        // Listen for pricing data
        document.addEventListener('pricingDataLoaded', handlePricingData);
        
        // Listen for master bundle data specifically
        document.addEventListener('masterBundleLoaded', function(event) {
            console.log('[EMBROIDERY-PRICING-V3] Master bundle loaded event received');
            if (event.detail && event.detail.raw) {
                window.nwcaMasterBundleData = event.detail.raw;
                // Render the pricing table with the new data
                renderPricingTable();
            }
        });
        
        // Initialize UI
        initializeUI();
        
        // Update initial quote
        updateQuote();
        
        // Try to get existing pricing data if available
        setTimeout(() => {
            if (window.nwcaMasterBundleData) {
                console.log('[EMBROIDERY-PRICING-V3] Found existing master bundle data');
                renderPricingTable();
            } else if (window.nwcaPricingData) {
                console.log('[EMBROIDERY-PRICING-V3] Found existing pricing data');
                handlePricingData({ detail: window.nwcaPricingData });
            } else {
                // Try to extract from table directly
                extractPricingFromTable();
                updateQuote();
            }
        }, 1000);
        
        // Also try after a longer delay in case table loads slowly
        setTimeout(() => {
            if (Object.keys(basePrices).length === 0) {
                console.log('[EMBROIDERY-PRICING-V3] No pricing data yet, trying to extract from table');
                extractPricingFromTable();
                updateQuote();
            }
        }, 2000);
        
        // Observe pricing table for changes
        observePricingTable();
        
        // Listen for color changes
        window.addEventListener('colorChanged', handleColorChange);
        
        // Listen for render pricing table events
        document.addEventListener('renderPricingTable', function() {
            if (window.nwcaMasterBundleData) {
                renderPricingTable();
            }
        });
        
        // Initialize color display from current product
        setTimeout(() => {
            initializeColorDisplay();
        }, 500);
    });

    // Handle pricing data
    function handlePricingData(event) {
        console.log('[EMBROIDERY-PRICING-V3] Received pricing data:', event.detail);
        
        if (!event.detail || !event.detail.prices) {
            console.error('[EMBROIDERY-PRICING-V3] Invalid pricing data');
            return;
        }

        processPricingData(event.detail);
    }

    // Process pricing data
    function processPricingData(data) {
        // Extract base prices
        basePrices = {};
        pricingData = data;
        
        // Handle master bundle format
        if (data.prices && data.headers) {
            // This is the transformed master bundle data
            // Store all pricing data for tier switching
            pricingData = data;
            
            // Find the appropriate tier for current quantity
            let selectedTier = null;
            if (data.tierData) {
                // tierData could be an array or object
                const tiers = Array.isArray(data.tierData) ? data.tierData : Object.values(data.tierData);
                
                for (const tier of tiers) {
                    const minQty = tier.MinQuantity || tier.min || 0;
                    const maxQty = tier.MaxQuantity || tier.max || 99999;
                    
                    if (currentQuantity >= minQty && currentQuantity <= maxQty) {
                        selectedTier = tier.TierLabel || tier.label || `${minQty}-${maxQty}`;
                        break;
                    }
                }
            }
            
            // If no tier found, use the first available tier
            if (!selectedTier && data.prices) {
                // Try to find the first tier from the price structure
                for (const sizeGroup in data.prices) {
                    if (data.prices[sizeGroup]) {
                        const tierKeys = Object.keys(data.prices[sizeGroup]);
                        if (tierKeys.length > 0) {
                            selectedTier = tierKeys[0];
                            break;
                        }
                    }
                }
            }
            
            console.log('[EMBROIDERY-PRICING-V3] Selected tier:', selectedTier, 'for quantity:', currentQuantity);
            
            if (selectedTier) {
                // Extract prices for each size group in the selected tier
                Object.keys(data.prices).forEach(sizeGroup => {
                    if (data.prices[sizeGroup] && data.prices[sizeGroup][selectedTier] !== null && data.prices[sizeGroup][selectedTier] !== undefined) {
                        basePrices[sizeGroup] = parseFloat(data.prices[sizeGroup][selectedTier]);
                    }
                });
            }
            
            // Render the pricing table
            renderPricingTable();
        }
        
        console.log('[EMBROIDERY-PRICING-V3] Base prices loaded:', basePrices);
        console.log('[EMBROIDERY-PRICING-V3] Available size groups:', Object.keys(basePrices));
        updateQuote();
    }
    
    // Render pricing table
    function renderPricingTable() {
        const container = document.getElementById('embroidery-pricing-table-container');
        if (!container) {
            console.log('[EMBROIDERY-PRICING-V3] Pricing table container not found');
            return;
        }
        
        // Get the raw master bundle data if available
        const masterBundle = window.nwcaMasterBundleData;
        
        // Check if we have master bundle data with pricing
        if (!masterBundle || !masterBundle.pricing || !masterBundle.tierData) {
            console.log('[EMBROIDERY-PRICING-V3] No master bundle data available for pricing table');
            container.innerHTML = '<p>Loading pricing data...</p>';
            return;
        }
        
        console.log('[EMBROIDERY-PRICING-V3] Rendering pricing table with master bundle data');
        
        // Get all unique sizes from the master bundle
        const sizesToShow = masterBundle.uniqueSizes || ['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL', '6XL'];
        
        // Build the complete Step 3 section with header and table
        let html = `
            <div class="step-section">
                <div class="step-header">
                    <div class="step-number">3</div>
                    <h2 class="step-title">Pricing Grid</h2>
                </div>
                <div class="pricing-table-wrapper">
                    <div class="pricing-table-scroll">
                        <table class="pricing-grid">
                            <thead>
                                <tr>
                                    <th>Quantity</th>
        `;
        
        // Add headers for each size
        sizesToShow.forEach(size => {
            html += `<th>${size}</th>`;
        });
        
        html += `
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        // Get tiers from master bundle
        const tierData = Array.isArray(masterBundle.tierData) ? masterBundle.tierData : Object.values(masterBundle.tierData);
        
        tierData.forEach(tier => {
            const tierLabel = tier.TierLabel || `${tier.MinQuantity}-${tier.MaxQuantity}`;
            const isActiveTier = currentQuantity >= tier.MinQuantity && currentQuantity <= (tier.MaxQuantity || 99999);
            
            html += `
                        <tr${isActiveTier ? ' class="active-tier"' : ''}>
                            <td>${tierLabel}</td>`;
            
            // Add prices for each size from master bundle
            sizesToShow.forEach(size => {
                let price = null;
                
                // Try to get price from master bundle pricing structure
                if (masterBundle.pricing && masterBundle.pricing[tierLabel] && masterBundle.pricing[tierLabel][size] !== undefined) {
                    price = masterBundle.pricing[tierLabel][size];
                }
                
                // Format and display the price
                if (price !== null && price !== undefined) {
                    html += `<td class="price-cell" data-size="${size}">$${parseFloat(price).toFixed(2)}</td>`;
                } else {
                    html += `<td class="price-cell" data-size="${size}">N/A</td>`;
                }
            });
            
            html += `</tr>`;
        });
        
        html += `
                            </tbody>
                        </table>
                    </div>
                </div>
                <div class="pricing-note">
                    <strong>Volume Pricing:</strong> Save more when you order in bulk. Prices shown include an 8,000 stitch embroidered logo.
                </div>
            </div>
        `;
        
        container.innerHTML = html;
        console.log('[EMBROIDERY-PRICING-V3] Pricing table rendered successfully');
        
        // Add scroll event listener for tablet shadow effect
        const scrollContainer = container.querySelector('.pricing-table-scroll');
        if (scrollContainer) {
            scrollContainer.addEventListener('scroll', function() {
                const maxScroll = this.scrollWidth - this.clientWidth;
                if (this.scrollLeft >= maxScroll - 5) {
                    this.classList.add('scrolled-end');
                } else {
                    this.classList.remove('scrolled-end');
                }
            });
        }
    }

    // Initialize UI components
    function initializeUI() {
        // Step 1: Configuration section
        const customizationContainer = document.getElementById('customization-options-container');
        if (customizationContainer) {
            customizationContainer.innerHTML = `
                <div class="step-section">
                    <div class="step-header">
                        <div class="step-number">1</div>
                        <h2 class="step-title">Configure Your Order</h2>
                    </div>
                    
                    <!-- Quantity Input -->
                    <div class="control-group">
                        <label class="control-label" for="quantity">Order Quantity</label>
                        <input type="number" id="quantity" class="quantity-input" value="${currentQuantity}" min="1">
                    </div>
                    
                    <!-- Front Logo Embroidery -->
                    <div class="control-group">
                        <label class="control-label">Front Logo Embroidery</label>
                        <div class="slider-container">
                            <div class="slider-header">
                                <span>Stitch Count: <span class="stitch-display" id="front-stitch-display">${currentFrontStitches.toLocaleString()} stitches</span></span>
                                <span class="price-display neutral" id="front-price-display">Base Price</span>
                            </div>
                            <div class="slider-wrapper">
                                <input type="range" id="front-stitch-slider" class="slider" min="5000" max="25000" step="1000" value="${currentFrontStitches}">
                                <div class="slider-tooltip dual-line" id="front-tooltip">
                                    <div>${currentFrontStitches.toLocaleString()}</div>
                                    <div style="color: #4caf50;">Base</div>
                                </div>
                            </div>
                            <div class="slider-labels">
                                <span>5,000</span>
                                <span>8,000 (base)</span>
                                <span>25,000</span>
                            </div>
                            <p class="pricing-info">Base price includes 8,000 stitches. $1.25 per 1,000 stitches above/below base.</p>
                        </div>
                    </div>
                    
                    <!-- Additional Logos Section -->
                    <div class="additional-logos">
                        <a href="#" class="expand-link" id="additional-logos-toggle">
                            <i class="fas fa-chevron-right"></i>
                            Add Additional Logos
                        </a>
                        
                        <div class="additional-logo-options" id="additional-logo-options">
                            <!-- Additional Logo 1 -->
                            <div class="control-group" style="margin-top: 15px;">
                                <div class="checkbox-group">
                                    <input type="checkbox" id="back-logo-checkbox">
                                    <label for="back-logo-checkbox">Add Additional Logo 1</label>
                                </div>
                                <div class="slider-container" id="back-logo-controls" style="display: none;">
                                    <div class="slider-header">
                                        <span>Stitch Count: <span class="stitch-display" id="back-stitch-display">${currentBackStitches.toLocaleString()} stitches</span></span>
                                        <span class="price-display positive" id="back-price-display">+$${calculateAdditionalLogoPrice(currentBackStitches).toFixed(2)}</span>
                                    </div>
                                    <div class="slider-wrapper">
                                        <input type="range" id="back-stitch-slider" class="slider" min="5000" max="20000" step="1000" value="${currentBackStitches}">
                                        <div class="slider-tooltip dual-line" id="back-tooltip">
                                            <div>${currentBackStitches.toLocaleString()}</div>
                                            <div style="color: #f44336;">+$${calculateAdditionalLogoPrice(currentBackStitches).toFixed(2)}</div>
                                        </div>
                                    </div>
                                    <div class="slider-labels">
                                        <span>5,000</span>
                                        <span>12,500</span>
                                        <span>20,000</span>
                                    </div>
                                    <p class="pricing-info">Base price: $${LOGO_BASE_PRICE.toFixed(2)} for up to ${LOGO_BASE_STITCHES.toLocaleString()} stitches. +$${PRICE_PER_THOUSAND.toFixed(2)} per additional 1,000 stitches.</p>
                                </div>
                            </div>
                            
                            <!-- Additional Logo 2 -->
                            <div class="control-group">
                                <div class="checkbox-group">
                                    <input type="checkbox" id="left-logo-checkbox">
                                    <label for="left-logo-checkbox">Add Additional Logo 2</label>
                                </div>
                                <div class="slider-container" id="left-logo-controls" style="display: none;">
                                    <div class="slider-header">
                                        <span>Stitch Count: <span class="stitch-display" id="left-stitch-display">${currentLeftStitches.toLocaleString()} stitches</span></span>
                                        <span class="price-display positive" id="left-price-display">+$${LOGO_BASE_PRICE.toFixed(2)}</span>
                                    </div>
                                    <div class="slider-wrapper">
                                        <input type="range" id="left-stitch-slider" class="slider" min="5000" max="20000" step="1000" value="${currentLeftStitches}">
                                        <div class="slider-tooltip dual-line" id="left-tooltip">
                                            <div>${currentLeftStitches.toLocaleString()}</div>
                                            <div style="color: #f44336;">+$${LOGO_BASE_PRICE.toFixed(2)}</div>
                                        </div>
                                    </div>
                                    <div class="slider-labels">
                                        <span>5,000</span>
                                        <span>12,500</span>
                                        <span>20,000</span>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Additional Logo 3 -->
                            <div class="control-group">
                                <div class="checkbox-group">
                                    <input type="checkbox" id="right-logo-checkbox">
                                    <label for="right-logo-checkbox">Add Additional Logo 3</label>
                                </div>
                                <div class="slider-container" id="right-logo-controls" style="display: none;">
                                    <div class="slider-header">
                                        <span>Stitch Count: <span class="stitch-display" id="right-stitch-display">${currentRightStitches.toLocaleString()} stitches</span></span>
                                        <span class="price-display positive" id="right-price-display">+$${LOGO_BASE_PRICE.toFixed(2)}</span>
                                    </div>
                                    <div class="slider-wrapper">
                                        <input type="range" id="right-stitch-slider" class="slider" min="5000" max="20000" step="1000" value="${currentRightStitches}">
                                        <div class="slider-tooltip dual-line" id="right-tooltip">
                                            <div>${currentRightStitches.toLocaleString()}</div>
                                            <div style="color: #f44336;">+$${LOGO_BASE_PRICE.toFixed(2)}</div>
                                        </div>
                                    </div>
                                    <div class="slider-labels">
                                        <span>5,000</span>
                                        <span>12,500</span>
                                        <span>20,000</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }

        // Step 2: Quote calculator with itemized breakdown
        const quoteContainer = document.getElementById('quick-quote-container');
        if (quoteContainer) {
            quoteContainer.innerHTML = `
                <div class="step-section">
                    <div class="step-header">
                        <div class="step-number">2</div>
                        <h2 class="step-title">Your Instant Quote</h2>
                    </div>
                    
                    <div class="quote-box">
                        <!-- Base price -->
                        <div class="quote-line">
                            <span>Base Unit Price (8,000 stitches):</span>
                            <span id="base-price" class="loading-price">$0.00</span>
                        </div>
                        
                        <!-- Front logo adjustment (conditional) -->
                        <div class="quote-line indent conditional" id="front-adjust-line">
                            <span id="front-adjust-label">Front Logo Adjustment:</span>
                            <span id="front-adjust-amount">$0.00</span>
                        </div>
                        
                        <!-- Additional Logo 1 (conditional) -->
                        <div class="quote-line indent conditional" id="back-logo-line">
                            <span id="back-logo-label">+ Additional Logo 1 (5,000 stitches):</span>
                            <span id="back-logo-amount">$5.00</span>
                        </div>
                        
                        <!-- Additional Logo 2 (conditional) -->
                        <div class="quote-line indent conditional" id="left-logo-line">
                            <span id="left-logo-label">+ Additional Logo 2 (5,000 stitches):</span>
                            <span id="left-logo-amount">$5.00</span>
                        </div>
                        
                        <!-- Additional Logo 3 (conditional) -->
                        <div class="quote-line indent conditional" id="right-logo-line">
                            <span id="right-logo-label">+ Additional Logo 3 (5,000 stitches):</span>
                            <span id="right-logo-amount">$5.00</span>
                        </div>
                        
                        <!-- LTM fee (conditional) -->
                        <div class="quote-line indent conditional" id="ltm-line">
                            <span>+ LTM Fee (per piece):</span>
                            <span id="ltm-amount">$0.00</span>
                        </div>
                        
                        <!-- Subtotal per piece -->
                        <div class="quote-line subtotal">
                            <span>= Total Price Per Piece:</span>
                            <span id="piece-total">$0.00</span>
                        </div>
                        
                        <!-- Separator -->
                        <div class="quote-separator"></div>
                        
                        <!-- Quantity -->
                        <div class="quote-line">
                            <span>× Quantity:</span>
                            <span id="quote-quantity">${currentQuantity}</span>
                        </div>
                        
                        <!-- Final total -->
                        <div class="quote-line total">
                            <span>Estimated Total:</span>
                            <span id="order-total">$0.00</span>
                        </div>
                    </div>
                </div>
            `;
        }

        // Step 3: Pricing Grid - Simple direct implementation
        const pricingGridContainer = document.getElementById('pricing-grid-container');
        if (pricingGridContainer) {
            pricingGridContainer.innerHTML = `
                <div class="step-section">
                    <div class="step-header">
                        <div class="step-number">3</div>
                        <h2 class="step-title">Complete Price-Per-Unit Reference Grid</h2>
                    </div>
                    <div class="pricing-content">
                        <div class="pricing-header">
                            <h3 class="pricing-subtitle">Embroidery Base Prices</h3>
                            <div class="selected-color-indicator">
                                <span>Selected Color:</span>
                                <div class="mini-color-swatch" id="pricing-color-swatch"></div>
                                <strong id="pricing-color-name">Loading...</strong>
                            </div>
                        </div>
                        <div id="embroidery-pricing-table-container">
                            <!-- Table will be rendered here -->
                        </div>
                        <div class="pricing-note">
                            <strong>Note:</strong> Prices shown are per unit and include an 8,000 stitch embroidered logo.
                        </div>
                    </div>
                </div>
            `;
        }

        // Store element references
        storeElementReferences();
        
        // Attach event listeners
        attachEventListeners();
        
        // Initialize sliders
        initializeSliders();
    }

    // Store DOM element references
    function storeElementReferences() {
        // Sliders
        elements.frontSlider = document.getElementById('front-stitch-slider');
        elements.backSlider = document.getElementById('back-stitch-slider');
        elements.leftSlider = document.getElementById('left-stitch-slider');
        elements.rightSlider = document.getElementById('right-stitch-slider');
        
        // Displays
        elements.frontDisplay = document.getElementById('front-stitch-display');
        elements.backDisplay = document.getElementById('back-stitch-display');
        elements.leftDisplay = document.getElementById('left-stitch-display');
        elements.rightDisplay = document.getElementById('right-stitch-display');
        
        // Price displays
        elements.frontPriceDisplay = document.getElementById('front-price-display');
        elements.backPriceDisplay = document.getElementById('back-price-display');
        elements.leftPriceDisplay = document.getElementById('left-price-display');
        elements.rightPriceDisplay = document.getElementById('right-price-display');
        
        // Tooltips
        elements.frontTooltip = document.getElementById('front-tooltip');
        elements.backTooltip = document.getElementById('back-tooltip');
        elements.leftTooltip = document.getElementById('left-tooltip');
        elements.rightTooltip = document.getElementById('right-tooltip');
        
        // Checkboxes
        elements.backCheckbox = document.getElementById('back-logo-checkbox');
        elements.leftCheckbox = document.getElementById('left-logo-checkbox');
        elements.rightCheckbox = document.getElementById('right-logo-checkbox');
        
        // Controls
        elements.backControls = document.getElementById('back-logo-controls');
        elements.leftControls = document.getElementById('left-logo-controls');
        elements.rightControls = document.getElementById('right-logo-controls');
        
        // Other
        elements.quantityInput = document.getElementById('quantity');
        elements.additionalLogosToggle = document.getElementById('additional-logos-toggle');
        elements.additionalLogoOptions = document.getElementById('additional-logo-options');
    }

    // Initialize all sliders
    function initializeSliders() {
        // Front slider (special case with base at 8000)
        if (elements.frontSlider) {
            initializeSlider(
                elements.frontSlider,
                elements.frontTooltip,
                elements.frontDisplay,
                elements.frontPriceDisplay,
                'front',
                true
            );
        }
        
        // Other logo sliders
        if (elements.backSlider) {
            initializeSlider(
                elements.backSlider,
                elements.backTooltip,
                elements.backDisplay,
                elements.backPriceDisplay,
                'back',
                false
            );
        }
        
        if (elements.leftSlider) {
            initializeSlider(
                elements.leftSlider,
                elements.leftTooltip,
                elements.leftDisplay,
                elements.leftPriceDisplay,
                'left',
                false
            );
        }
        
        if (elements.rightSlider) {
            initializeSlider(
                elements.rightSlider,
                elements.rightTooltip,
                elements.rightDisplay,
                elements.rightPriceDisplay,
                'right',
                false
            );
        }
    }

    // Initialize individual slider
    function initializeSlider(slider, tooltip, display, priceDisplay, type, isFront) {
        if (!slider || !tooltip) return;
        
        // Update function
        const updateSlider = () => {
            const value = parseInt(slider.value);
            const percent = (value - slider.min) / (slider.max - slider.min);
            
            // Update tooltip position
            tooltip.style.left = `${percent * 100}%`;
            
            // Update tooltip content
            if (isFront) {
                const adjustment = calculateFrontAdjustment(value);
                tooltip.innerHTML = `
                    <div>${value.toLocaleString()}</div>
                    <div style="color: ${adjustment === 0 ? '#4caf50' : (adjustment > 0 ? '#f44336' : '#2196f3')};">
                        ${adjustment === 0 ? 'Base' : (adjustment > 0 ? '+' : '')}$${Math.abs(adjustment).toFixed(2)}
                    </div>
                `;
                
                // Update price display
                if (adjustment === 0) {
                    priceDisplay.textContent = 'Base Price';
                    priceDisplay.className = 'price-display neutral';
                } else if (adjustment > 0) {
                    priceDisplay.textContent = `+$${adjustment.toFixed(2)}`;
                    priceDisplay.className = 'price-display positive';
                } else {
                    priceDisplay.textContent = `-$${Math.abs(adjustment).toFixed(2)}`;
                    priceDisplay.className = 'price-display negative';
                }
            } else {
                const price = calculateAdditionalLogoPrice(value);
                tooltip.innerHTML = `
                    <div>${value.toLocaleString()}</div>
                    <div style="color: #f44336;">+$${price.toFixed(2)}</div>
                `;
                
                // Update price display
                priceDisplay.textContent = `+$${price.toFixed(2)}`;
            }
            
            // Update stitch display
            display.textContent = `${value.toLocaleString()} stitches`;
        };
        
        // Event listeners
        slider.addEventListener('input', updateSlider);
        slider.addEventListener('change', () => {
            updateState(type, parseInt(slider.value));
            updateQuote();
        });
        
        // Initial update
        updateSlider();
    }

    // Attach event listeners
    function attachEventListeners() {
        // Quantity input
        if (elements.quantityInput) {
            elements.quantityInput.addEventListener('change', function() {
                currentQuantity = Math.max(1, parseInt(this.value) || 1);
                
                // Re-process pricing data if we have master bundle data
                if (pricingData && pricingData.prices) {
                    processPricingData(pricingData);
                } else {
                    // Otherwise try to extract from table
                    basePrices = {};
                    extractPricingFromTable();
                    updateQuote();
                }
                
                // Trigger quantity changed event
                window.dispatchEvent(new CustomEvent('quantityChanged', {
                    detail: { totalQuantity: currentQuantity }
                }));
                
                // Update progress
                window.updateProgressBar && window.updateProgressBar(2);
            });
        }
        
        // Checkboxes
        if (elements.backCheckbox) {
            elements.backCheckbox.addEventListener('change', function() {
                backLogoEnabled = this.checked;
                elements.backControls.style.display = this.checked ? 'block' : 'none';
                updateQuote();
            });
        }
        
        if (elements.leftCheckbox) {
            elements.leftCheckbox.addEventListener('change', function() {
                leftLogoEnabled = this.checked;
                elements.leftControls.style.display = this.checked ? 'block' : 'none';
                updateQuote();
            });
        }
        
        if (elements.rightCheckbox) {
            elements.rightCheckbox.addEventListener('change', function() {
                rightLogoEnabled = this.checked;
                elements.rightControls.style.display = this.checked ? 'block' : 'none';
                updateQuote();
            });
        }
        
        // Additional logos toggle
        if (elements.additionalLogosToggle) {
            elements.additionalLogosToggle.addEventListener('click', function(e) {
                e.preventDefault();
                const options = elements.additionalLogoOptions;
                const icon = this.querySelector('i');
                
                if (options.classList.contains('expanded')) {
                    options.classList.remove('expanded');
                    icon.className = 'fas fa-chevron-right';
                } else {
                    options.classList.add('expanded');
                    icon.className = 'fas fa-chevron-down';
                }
            });
        }
    }

    // Calculate front logo adjustment
    function calculateFrontAdjustment(stitches) {
        const diff = stitches - BASE_STITCHES;
        return (diff / 1000) * PRICE_PER_THOUSAND;
    }

    // Calculate additional logo price
    function calculateAdditionalLogoPrice(stitches) {
        const base = LOGO_BASE_PRICE;
        const extraStitches = Math.max(0, stitches - LOGO_BASE_STITCHES);
        return base + (extraStitches / 1000) * PRICE_PER_THOUSAND;
    }

    // Update state
    function updateState(type, value) {
        switch(type) {
            case 'front':
                currentFrontStitches = value;
                frontAdjustment = calculateFrontAdjustment(value);
                break;
            case 'back':
                currentBackStitches = value;
                backLogoPrice = calculateAdditionalLogoPrice(value);
                break;
            case 'left':
                currentLeftStitches = value;
                leftLogoPrice = calculateAdditionalLogoPrice(value);
                break;
            case 'right':
                currentRightStitches = value;
                rightLogoPrice = calculateAdditionalLogoPrice(value);
                break;
        }
    }

    // Update quote
    function updateQuote() {
        // Get base price (use minimum of all sizes as base)
        let baseUnitPrice = 0;
        if (Object.keys(basePrices).length > 0) {
            baseUnitPrice = Math.min(...Object.values(basePrices));
        } else {
            // Try to extract from pricing table if no data yet
            extractPricingFromTable();
            if (Object.keys(basePrices).length > 0) {
                baseUnitPrice = Math.min(...Object.values(basePrices));
            }
        }
        
        // Calculate adjustments
        let totalAdjustments = frontAdjustment;
        
        // Add additional logos if enabled
        if (backLogoEnabled) totalAdjustments += backLogoPrice;
        if (leftLogoEnabled) totalAdjustments += leftLogoPrice;
        if (rightLogoEnabled) totalAdjustments += rightLogoPrice;
        
        // LTM fee
        let ltmPerUnit = 0;
        if (currentQuantity < MIN_QUANTITY) {
            ltmPerUnit = LTM_FEE / currentQuantity;
        }
        
        // Calculate totals
        const unitPrice = baseUnitPrice + totalAdjustments + ltmPerUnit;
        const orderTotal = unitPrice * currentQuantity;
        
        // Update display
        updateQuoteDisplay(baseUnitPrice, unitPrice, orderTotal, ltmPerUnit);
        
        // Update header
        if (window.updateHeaderPricing) {
            window.updateHeaderPricing(currentQuantity, unitPrice);
        }
        
        // Dispatch pricing updated event
        document.dispatchEvent(new CustomEvent('pricingUpdated', {
            detail: {
                quantity: currentQuantity,
                unitPrice: unitPrice,
                totalPrice: orderTotal
            }
        }));
    }
    
    // Extract pricing from table
    function extractPricingFromTable() {
        // If we already have pricing data from master bundle, don't extract from table
        if (pricingData && pricingData.prices && Object.keys(basePrices).length > 0) {
            console.log('[EMBROIDERY-PRICING-V3] Already have pricing data, skipping table extraction');
            return;
        }
        
        // Try multiple selectors to find the pricing table
        const table = document.querySelector('.pricing-grid table, #pricing-grid-container table, .universal-pricing-grid table, #pricing-grid-container-table');
        if (!table) {
            console.log('[EMBROIDERY-PRICING-V3] No pricing table found');
            return;
        }
        
        const tbody = table.querySelector('tbody');
        if (!tbody) {
            console.log('[EMBROIDERY-PRICING-V3] No tbody found in pricing table');
            return;
        }
        
        // Get headers (sizes) - skip the first column which is quantity
        const headerRow = table.querySelector('thead tr') || table.querySelector('tr:first-child');
        if (!headerRow) {
            console.log('[EMBROIDERY-PRICING-V3] No header row found');
            return;
        }
        
        const headers = [];
        const headerCells = headerRow.querySelectorAll('th, td');
        headerCells.forEach((cell, index) => {
            if (index > 0) { // Skip first column (Quantity)
                const headerText = cell.textContent.trim();
                if (headerText) {
                    headers.push(headerText);
                }
            }
        });
        
        console.log('[EMBROIDERY-PRICING-V3] Found headers:', headers);
        
        // Find the tier for current quantity
        const rows = tbody.querySelectorAll('tr');
        let tierFound = false;
        
        // If quantity is less than 24, use the first tier (24-47)
        if (currentQuantity < 24) {
            const firstRow = rows[0];
            if (firstRow) {
                const cells = firstRow.querySelectorAll('td');
                for (let i = 1; i < cells.length && i - 1 < headers.length; i++) {
                    const size = headers[i - 1];
                    const priceText = cells[i].textContent.trim();
                    const price = parseFloat(priceText.replace(/[$,]/g, ''));
                    if (!isNaN(price)) {
                        basePrices[size] = price;
                        tierFound = true;
                    }
                }
            }
        } else {
            // Normal tier finding for quantities >= 24
            for (const row of rows) {
                const cells = row.querySelectorAll('td');
                if (cells.length < 2) continue;
                
                const tierText = cells[0].textContent.trim();
                const rangeMatch = tierText.match(/(\d+)(?:-(\d+)|(\+))?/);
                if (rangeMatch) {
                    const min = parseInt(rangeMatch[1]);
                    const max = rangeMatch[2] ? parseInt(rangeMatch[2]) : (rangeMatch[3] ? 99999 : min);
                    
                    if (currentQuantity >= min && currentQuantity <= max) {
                        // This is our tier
                        for (let i = 1; i < cells.length && i - 1 < headers.length; i++) {
                            const size = headers[i - 1];
                            const priceText = cells[i].textContent.trim();
                            const price = parseFloat(priceText.replace(/[$,]/g, ''));
                            if (!isNaN(price)) {
                                basePrices[size] = price;
                                tierFound = true;
                            }
                        }
                        break;
                    }
                }
            }
        }
        
        console.log('[EMBROIDERY-PRICING-V3] Extracted prices from table:', basePrices, 'Tier found:', tierFound);
    }
    
    // Observe pricing table for updates
    function observePricingTable() {
        const container = document.getElementById('pricing-grid-container');
        if (!container) return;
        
        // Don't observe if we already have pricing data from master bundle
        if (pricingData && pricingData.prices && Object.keys(basePrices).length > 0) {
            console.log('[EMBROIDERY-PRICING-V3] Already have pricing data from master bundle, skipping table observation');
            return;
        }
        
        const observer = new MutationObserver((mutations) => {
            // Stop observing if we now have pricing data
            if (pricingData && pricingData.prices && Object.keys(basePrices).length > 0) {
                observer.disconnect();
                return;
            }
            
            // Check if table was added or updated
            const table = container.querySelector('table');
            if (table && table.querySelector('tbody tr')) {
                console.log('[EMBROIDERY-PRICING-V3] Pricing table updated, extracting data');
                extractPricingFromTable();
                updateQuote();
            }
        });
        
        observer.observe(container, { 
            childList: true, 
            subtree: true,
            attributes: true
        });
    }
    
    // Handle color change events
    function handleColorChange(event) {
        console.log('[EMBROIDERY-PRICING-V3] Color changed:', event.detail);
        
        if (!event.detail) return;
        
        const colorData = event.detail.color || event.detail;
        updateColorDisplay(colorData);
    }
    
    // Initialize color display from current selection
    function initializeColorDisplay() {
        // Try to get color from various sources
        const productDisplay = document.querySelector('#product-display');
        if (productDisplay) {
            // Check for active color swatch
            const activeSwatch = productDisplay.querySelector('.color-swatch.active, .enhanced-color-swatch.active');
            if (activeSwatch) {
                const colorName = activeSwatch.querySelector('.color-name, .enhanced-color-name')?.textContent || 
                                activeSwatch.getAttribute('title') || 
                                activeSwatch.getAttribute('data-color-name');
                const imageUrl = activeSwatch.style.backgroundImage?.match(/url\(['"]?(.+?)['"]?\)/)?.[1] || '';
                
                if (colorName || imageUrl) {
                    updateColorDisplay({
                        COLOR_NAME: colorName,
                        MAIN_IMAGE_URL: imageUrl
                    });
                }
            }
        }
        
        // Also check window.selectedColorName
        const colorNameEl = document.querySelector('#pricing-color-name');
        if (window.selectedColorName && colorNameEl && 
            (!colorNameEl.textContent || colorNameEl.textContent === 'Loading...')) {
            updateColorDisplay({
                COLOR_NAME: window.selectedColorName
            });
        }
    }
    
    // Update color display elements
    function updateColorDisplay(colorData) {
        const colorName = colorData.COLOR_NAME || colorData.name || 'Unknown';
        const imageUrl = colorData.MAIN_IMAGE_URL || colorData.mainImage || colorData.ImageURL || '';
        
        // Update the mini color swatch in Step 3
        const miniSwatch = document.getElementById('pricing-color-swatch');
        if (miniSwatch && imageUrl) {
            miniSwatch.style.backgroundImage = `url('${imageUrl}')`;
            miniSwatch.title = colorName;
        }
        
        // Update the selected color text in Step 3
        const colorText = document.getElementById('pricing-color-name');
        if (colorText) {
            colorText.textContent = colorName;
        }
        
        // Also update any other color indicators
        const allColorTexts = document.querySelectorAll('.selected-color-indicator strong');
        allColorTexts.forEach(text => {
            text.textContent = colorName;
        });
    }

    // Update quote display
    function updateQuoteDisplay(basePrice, unitPrice, orderTotal, ltmPerUnit) {
        // Base price
        const basePriceEl = document.getElementById('base-price');
        if (basePriceEl) {
            basePriceEl.textContent = `$${basePrice.toFixed(2)}`;
            basePriceEl.classList.remove('loading-price');
        }
        
        // Front adjustment
        const frontLine = document.getElementById('front-adjust-line');
        const frontLabel = document.getElementById('front-adjust-label');
        const frontAmount = document.getElementById('front-adjust-amount');
        
        if (frontLine && frontAdjustment !== 0) {
            frontLine.classList.add('show');
            if (frontLabel) {
                frontLabel.textContent = `Front Logo (${currentFrontStitches.toLocaleString()} stitches):`;
            }
            if (frontAmount) {
                frontAmount.textContent = frontAdjustment >= 0 ? `+$${frontAdjustment.toFixed(2)}` : `-$${Math.abs(frontAdjustment).toFixed(2)}`;
            }
        } else if (frontLine) {
            frontLine.classList.remove('show');
        }
        
        // Additional Logo 1
        const backLine = document.getElementById('back-logo-line');
        const backLabel = document.getElementById('back-logo-label');
        const backAmount = document.getElementById('back-logo-amount');
        
        if (backLine && backLogoEnabled) {
            backLine.classList.add('show');
            if (backLabel) {
                backLabel.textContent = `+ Additional Logo 1 (${currentBackStitches.toLocaleString()} stitches):`;
            }
            if (backAmount) {
                backAmount.textContent = `$${backLogoPrice.toFixed(2)}`;
            }
        } else if (backLine) {
            backLine.classList.remove('show');
        }
        
        // Additional Logo 2
        const leftLine = document.getElementById('left-logo-line');
        const leftLabel = document.getElementById('left-logo-label');
        const leftAmount = document.getElementById('left-logo-amount');
        
        if (leftLine && leftLogoEnabled) {
            leftLine.classList.add('show');
            if (leftLabel) {
                leftLabel.textContent = `+ Additional Logo 2 (${currentLeftStitches.toLocaleString()} stitches):`;
            }
            if (leftAmount) {
                leftAmount.textContent = `$${leftLogoPrice.toFixed(2)}`;
            }
        } else if (leftLine) {
            leftLine.classList.remove('show');
        }
        
        // Additional Logo 3
        const rightLine = document.getElementById('right-logo-line');
        const rightLabel = document.getElementById('right-logo-label');
        const rightAmount = document.getElementById('right-logo-amount');
        
        if (rightLine && rightLogoEnabled) {
            rightLine.classList.add('show');
            if (rightLabel) {
                rightLabel.textContent = `+ Additional Logo 3 (${currentRightStitches.toLocaleString()} stitches):`;
            }
            if (rightAmount) {
                rightAmount.textContent = `$${rightLogoPrice.toFixed(2)}`;
            }
        } else if (rightLine) {
            rightLine.classList.remove('show');
        }
        
        // LTM fee
        const ltmLine = document.getElementById('ltm-line');
        const ltmAmount = document.getElementById('ltm-amount');
        
        if (ltmLine && ltmPerUnit > 0) {
            ltmLine.classList.add('show');
            if (ltmAmount) {
                ltmAmount.textContent = `$${ltmPerUnit.toFixed(2)}`;
            }
        } else if (ltmLine) {
            ltmLine.classList.remove('show');
        }
        
        // Totals
        const pieceTotalEl = document.getElementById('piece-total');
        const quoteQuantityEl = document.getElementById('quote-quantity');
        const orderTotalEl = document.getElementById('order-total');
        
        if (pieceTotalEl) pieceTotalEl.textContent = `$${unitPrice.toFixed(2)}`;
        if (quoteQuantityEl) quoteQuantityEl.textContent = currentQuantity;
        if (orderTotalEl) orderTotalEl.textContent = `$${orderTotal.toFixed(2)}`;
    }

})();