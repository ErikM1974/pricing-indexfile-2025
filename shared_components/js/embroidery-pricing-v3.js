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
    let currentBackStitches = 5000;
    let currentLeftStitches = 5000;
    let currentRightStitches = 5000;
    let backLogoEnabled = false;
    let leftLogoEnabled = false;
    let rightLogoEnabled = false;
    let currentQuantity = MIN_QUANTITY;
    let pricingData = null;
    let frontAdjustment = 0;
    let backLogoPrice = LOGO_BASE_PRICE;
    let leftLogoPrice = LOGO_BASE_PRICE;
    let rightLogoPrice = LOGO_BASE_PRICE;
    
    // DOM element references
    const elements = {};

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
        
        // Initialize UI
        initializeUI();
        
        // Update initial quote
        updateQuote();
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
        
        // For embroidery, we need to extract prices from the tier data
        if (data.tierData && data.prices) {
            // Find the tier that contains our current quantity
            let currentTier = null;
            for (const tierKey in data.tierData) {
                const tier = data.tierData[tierKey];
                if (currentQuantity >= tier.MinQuantity && currentQuantity <= tier.MaxQuantity) {
                    currentTier = tierKey;
                    break;
                }
            }
            
            if (currentTier && data.prices) {
                // Extract prices for each size group in the current tier
                for (const sizeGroup in data.prices) {
                    if (data.prices[sizeGroup] && data.prices[sizeGroup][currentTier]) {
                        basePrices[sizeGroup] = parseFloat(data.prices[sizeGroup][currentTier]);
                    }
                }
            }
        }
        
        console.log('[EMBROIDERY-PRICING-V3] Base prices loaded:', basePrices);
        updateQuote();
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
                            Add Additional Logo Locations
                        </a>
                        
                        <div class="additional-logo-options" id="additional-logo-options">
                            <!-- Back Logo Option -->
                            <div class="control-group" style="margin-top: 15px;">
                                <div class="checkbox-group">
                                    <input type="checkbox" id="back-logo-checkbox">
                                    <label for="back-logo-checkbox">Add Back Logo Embroidery</label>
                                </div>
                                <div class="slider-container" id="back-logo-controls" style="display: none;">
                                    <div class="slider-header">
                                        <span>Stitch Count: <span class="stitch-display" id="back-stitch-display">${currentBackStitches.toLocaleString()} stitches</span></span>
                                        <span class="price-display positive" id="back-price-display">+$${LOGO_BASE_PRICE.toFixed(2)}</span>
                                    </div>
                                    <div class="slider-wrapper">
                                        <input type="range" id="back-stitch-slider" class="slider" min="5000" max="20000" step="1000" value="${currentBackStitches}">
                                        <div class="slider-tooltip dual-line" id="back-tooltip">
                                            <div>${currentBackStitches.toLocaleString()}</div>
                                            <div style="color: #f44336;">+$${LOGO_BASE_PRICE.toFixed(2)}</div>
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
                            
                            <!-- Left Side Logo -->
                            <div class="control-group">
                                <div class="checkbox-group">
                                    <input type="checkbox" id="left-logo-checkbox">
                                    <label for="left-logo-checkbox">Add Left Side Logo</label>
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
                            
                            <!-- Right Side Logo -->
                            <div class="control-group">
                                <div class="checkbox-group">
                                    <input type="checkbox" id="right-logo-checkbox">
                                    <label for="right-logo-checkbox">Add Right Side Logo</label>
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
                        
                        <!-- Back logo (conditional) -->
                        <div class="quote-line indent conditional" id="back-logo-line">
                            <span id="back-logo-label">+ Back Logo (5,000 stitches):</span>
                            <span id="back-logo-amount">$5.00</span>
                        </div>
                        
                        <!-- Left side logo (conditional) -->
                        <div class="quote-line indent conditional" id="left-logo-line">
                            <span id="left-logo-label">+ Left Side Logo (5,000 stitches):</span>
                            <span id="left-logo-amount">$5.00</span>
                        </div>
                        
                        <!-- Right side logo (conditional) -->
                        <div class="quote-line indent conditional" id="right-logo-line">
                            <span id="right-logo-label">+ Right Side Logo (5,000 stitches):</span>
                            <span id="right-logo-amount">$5.00</span>
                        </div>
                        
                        <!-- LTM fee (conditional) -->
                        <div class="quote-line indent conditional" id="ltm-line">
                            <span>+ Setup Fee (per piece):</span>
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

        // Step 3: Pricing Grid
        const pricingGridContainer = document.getElementById('pricing-grid-container');
        if (pricingGridContainer) {
            // Add step header before the grid
            const stepHeader = document.createElement('div');
            stepHeader.className = 'step-section';
            stepHeader.innerHTML = `
                <div class="step-header">
                    <div class="step-number">3</div>
                    <h2 class="step-title">Complete Price-Per-Unit Reference Grid</h2>
                </div>
            `;
            pricingGridContainer.parentNode.insertBefore(stepHeader, pricingGridContainer);
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
                updateQuote();
                
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
        
        // Back logo
        const backLine = document.getElementById('back-logo-line');
        const backLabel = document.getElementById('back-logo-label');
        const backAmount = document.getElementById('back-logo-amount');
        
        if (backLine && backLogoEnabled) {
            backLine.classList.add('show');
            if (backLabel) {
                backLabel.textContent = `+ Back Logo (${currentBackStitches.toLocaleString()} stitches):`;
            }
            if (backAmount) {
                backAmount.textContent = `$${backLogoPrice.toFixed(2)}`;
            }
        } else if (backLine) {
            backLine.classList.remove('show');
        }
        
        // Left logo
        const leftLine = document.getElementById('left-logo-line');
        const leftLabel = document.getElementById('left-logo-label');
        const leftAmount = document.getElementById('left-logo-amount');
        
        if (leftLine && leftLogoEnabled) {
            leftLine.classList.add('show');
            if (leftLabel) {
                leftLabel.textContent = `+ Left Side Logo (${currentLeftStitches.toLocaleString()} stitches):`;
            }
            if (leftAmount) {
                leftAmount.textContent = `$${leftLogoPrice.toFixed(2)}`;
            }
        } else if (leftLine) {
            leftLine.classList.remove('show');
        }
        
        // Right logo
        const rightLine = document.getElementById('right-logo-line');
        const rightLabel = document.getElementById('right-logo-label');
        const rightAmount = document.getElementById('right-logo-amount');
        
        if (rightLine && rightLogoEnabled) {
            rightLine.classList.add('show');
            if (rightLabel) {
                rightLabel.textContent = `+ Right Side Logo (${currentRightStitches.toLocaleString()} stitches):`;
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