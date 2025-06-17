// Cap Embroidery Pricing V3 - Production Implementation
// Includes all enhancements from the V3 mockup with live data integration

(function() {
    'use strict';

    // Constants
    const BASE_STITCHES = 8000;
    const PRICE_PER_THOUSAND = 1.00;
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
        console.log('[CAP-PRICING-V3] Initializing...');
        
        // Make updateHeaderPricing globally available
        window.updateHeaderPricing = function(quantity, unitPrice) {
            const headerQty = document.getElementById('header-quantity');
            const headerPrice = document.getElementById('header-unit-price');
            
            if (headerQty) headerQty.textContent = quantity;
            if (headerPrice) headerPrice.textContent = typeof unitPrice === 'number' ? `$${unitPrice.toFixed(2)}` : unitPrice;
        };
        
        // Listen for Caspio data
        document.addEventListener('caspioCapPricingCalculated', handleCaspioData);
        
        // Initialize UI
        initializeUI();
        
        // Load product data for gallery and swatches
        loadProductData();
        
        // Fetch pricing data directly and update quote when loaded
        fetchPricingData().then(() => {
            console.log('[CAP-PRICING-V3] Initial pricing fetch completed');
        }).catch(error => {
            console.error('[CAP-PRICING-V3] Initial pricing fetch failed:', error);
        });
    });

    // Handle Caspio pricing data
    function handleCaspioData(event) {
        console.log('[CAP-PRICING-V3] Received Caspio data:', event.detail);
        
        if (!event.detail || !event.detail.success) {
            displayPricingError();
            return;
        }

        processPricingData(event.detail);
    }

    // Process pricing data
    function processPricingData(data) {
        // Extract base prices at 8000 stitches
        if (data.allPriceProfiles && data.allPriceProfiles['8000']) {
            basePrices = data.allPriceProfiles['8000'];
            pricingData = data;
            
            console.log('[CAP-PRICING-V3] Base prices loaded:', basePrices);
            console.log('[CAP-PRICING-V3] Available sizes:', Object.keys(basePrices));
            
            // Build table structure once, then update prices
            createTableStructure(data);
            updatePricingTable();
            updateQuote();
        } else {
            console.error('[CAP-PRICING-V3] No pricing data found for 8000 stitches');
        }
    }

    // Initialize UI components
    function initializeUI() {
        // Step 1: Configuration section
        const customizationContainer = document.getElementById('embroidery-customization-container');
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
                                <input type="range" id="front-stitch-slider" class="slider" min="5000" max="20000" step="1000" value="${currentFrontStitches}">
                                <div class="slider-tooltip dual-line" id="front-tooltip">
                                    <div>${currentFrontStitches.toLocaleString()}</div>
                                    <div style="color: #4caf50;">Base</div>
                                </div>
                            </div>
                            <div class="slider-labels">
                                <span>5,000</span>
                                <span>8,000 (base)</span>
                                <span>20,000</span>
                            </div>
                            <p class="pricing-info">Base price includes 8,000 stitches. $1.00 per 1,000 stitches above/below base.</p>
                        </div>
                    </div>
                    
                    <!-- Back Logo Option -->
                    <div class="control-group">
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
                    
                    <!-- Additional Logos Section -->
                    <div class="additional-logos">
                        <a href="#" class="expand-link" id="additional-logos-toggle">
                            <i class="fas fa-chevron-right"></i>
                            Add Side Logo Embroidery
                        </a>
                        
                        <div class="additional-logo-options" id="additional-logo-options">
                            <!-- Left Side Logo -->
                            <div class="control-group" style="margin-top: 15px;">
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
    function initializeSlider(slider, tooltip, display, priceDisplay, type, isBase8000) {
        slider.addEventListener('input', function() {
            const value = parseInt(this.value);
            const formattedValue = value.toLocaleString();
            
            // Update display
            display.textContent = formattedValue + ' stitches';
            
            // Calculate price
            let price, priceText, priceClass, tooltipColor;
            
            if (isBase8000) {
                // Front logo with 8,000 base
                const diff = value - BASE_STITCHES;
                price = (diff / 1000) * PRICE_PER_THOUSAND;
                
                if (type === 'front') {
                    currentFrontStitches = value;
                    frontAdjustment = price;
                }
                
                if (diff > 0) {
                    priceText = `+$${Math.abs(price).toFixed(2)}`;
                    priceClass = 'positive';
                    tooltipColor = '#f44336';
                } else if (diff < 0) {
                    priceText = `-$${Math.abs(price).toFixed(2)}`;
                    priceClass = 'negative';
                    tooltipColor = '#4caf50';
                } else {
                    priceText = 'Base Price';
                    priceClass = 'neutral';
                    tooltipColor = '#4caf50';
                }
            } else {
                // Other logos
                const additional = Math.max(0, value - LOGO_BASE_STITCHES);
                price = LOGO_BASE_PRICE + (additional / 1000) * PRICE_PER_THOUSAND;
                priceText = `+$${price.toFixed(2)}`;
                priceClass = 'positive';
                tooltipColor = '#f44336';
                
                // Store price based on type
                if (type === 'back') {
                    currentBackStitches = value;
                    backLogoPrice = price;
                } else if (type === 'left') {
                    currentLeftStitches = value;
                    leftLogoPrice = price;
                } else if (type === 'right') {
                    currentRightStitches = value;
                    rightLogoPrice = price;
                }
            }
            
            // Update price display
            priceDisplay.textContent = priceText;
            priceDisplay.className = 'price-display ' + priceClass;
            
            // Update tooltip
            tooltip.innerHTML = `
                <div>${formattedValue}</div>
                <div style="color: ${tooltipColor}">${priceText}</div>
            `;
            
            // Update tooltip position
            const percent = (this.value - this.min) / (this.max - this.min);
            const offset = percent * (this.offsetWidth - 20);
            tooltip.style.left = offset + 10 + 'px';
            
            // Update pricing
            updatePricingTable();
            updateQuote();
        });
        
        // Show tooltip on hover
        slider.addEventListener('mouseenter', () => tooltip.style.opacity = '1');
        slider.addEventListener('mouseleave', () => tooltip.style.opacity = '0');
        slider.addEventListener('mousedown', () => tooltip.style.opacity = '1');
        slider.addEventListener('mouseup', () => tooltip.style.opacity = '0');
        
        // Initialize
        slider.dispatchEvent(new Event('input'));
    }

    // Attach all event listeners
    function attachEventListeners() {
        // Logo checkboxes
        if (elements.backCheckbox) {
            elements.backCheckbox.addEventListener('change', function() {
                backLogoEnabled = this.checked;
                elements.backControls.style.display = backLogoEnabled ? 'block' : 'none';
                document.getElementById('back-logo-line').classList.toggle('show', backLogoEnabled);
                updateQuote();
            });
        }
        
        if (elements.leftCheckbox) {
            elements.leftCheckbox.addEventListener('change', function() {
                leftLogoEnabled = this.checked;
                elements.leftControls.style.display = leftLogoEnabled ? 'block' : 'none';
                document.getElementById('left-logo-line').classList.toggle('show', leftLogoEnabled);
                updateQuote();
            });
        }
        
        if (elements.rightCheckbox) {
            elements.rightCheckbox.addEventListener('change', function() {
                rightLogoEnabled = this.checked;
                elements.rightControls.style.display = rightLogoEnabled ? 'block' : 'none';
                document.getElementById('right-logo-line').classList.toggle('show', rightLogoEnabled);
                updateQuote();
            });
        }

        // Quantity input
        if (elements.quantityInput) {
            elements.quantityInput.addEventListener('input', function() {
                currentQuantity = parseInt(this.value) || MIN_QUANTITY;
                updatePricingTable();
                updateQuote();
            });
        }
        
        // Additional logos toggle
        if (elements.additionalLogosToggle) {
            elements.additionalLogosToggle.addEventListener('click', function(e) {
                e.preventDefault();
                const isExpanded = elements.additionalLogoOptions.classList.contains('show');
                
                elements.additionalLogoOptions.classList.toggle('show');
                this.classList.toggle('expanded');
                
                if (!isExpanded) {
                    this.innerHTML = '<i class="fas fa-chevron-down"></i> Hide Side Logo Options';
                } else {
                    this.innerHTML = '<i class="fas fa-chevron-right"></i> Add Side Logo Embroidery';
                }
            });
        }
    }

    // Create table structure
    function createTableStructure(data) {
        const gridContainer = document.getElementById('pricing-grid-container');
        if (!gridContainer) return;

        const headers = data.groupedHeaders || [];
        const displayTiers = ['24-47', '48-71', '72+'];
        
        let tableHTML = `
            <div class="step-section">
                <div class="step-header">
                    <div class="step-number">3</div>
                    <h2 class="step-title">Complete Price-Per-Unit Reference Grid</h2>
                </div>
                
                <div class="pricing-note-box">
                    <p><strong>Note:</strong> These are complete prices including cap + front logo embroidery</p>
                </div>
                
                <table class="pricing-table">
                    <thead>
                        <tr>
                            <th>Quantity</th>
                            <th colspan="3" style="text-align: center;">Price Per Cap (with Front Logo)</th>
                        </tr>
                        <tr style="background: #f0f0f0;">
                            <th></th>
        `;
        
        // Add size headers
        headers.forEach(size => {
            tableHTML += `<th>${size}</th>`;
        });
        
        tableHTML += `
                        </tr>
                    </thead>
                    <tbody id="pricing-tbody">
        `;
        
        // Add rows for each tier
        displayTiers.forEach(tierKey => {
            tableHTML += `<tr><td class="tier-label">${tierKey}</td>`;
            
            headers.forEach(size => {
                tableHTML += `<td class="price-cell" data-size="${size}" data-tier="${tierKey}"></td>`;
            });
            
            tableHTML += `</tr>`;
        });
        
        tableHTML += `
                    </tbody>
                </table>
                <p class="pricing-note" id="pricing-note">
                    <i class="fas fa-info-circle" style="color: #3a7c52;"></i>
                    Prices shown are complete cap prices including ${currentFrontStitches.toLocaleString()} stitch embroidered logo on front
                </p>
            </div>
        `;
        
        gridContainer.innerHTML = tableHTML;
    }

    // Update pricing table
    function updatePricingTable() {
        if (!basePrices) {
            console.warn('[CAP-PRICING-V3] No base prices available for table update');
            return;
        }
        
        const priceCells = document.querySelectorAll('.price-cell[data-size][data-tier]');
        const adjustment = frontAdjustment;
        
        console.log('[CAP-PRICING-V3] Updating pricing table with adjustment:', adjustment);
        
        priceCells.forEach(cell => {
            const size = cell.dataset.size;
            const tier = cell.dataset.tier;
            
            if (basePrices[size] && basePrices[size][tier] !== undefined) {
                const basePrice = basePrices[size][tier];
                const adjustedPrice = basePrice + adjustment;
                cell.textContent = `$${adjustedPrice.toFixed(2)}`;
                cell.dataset.basePrice = basePrice;
            } else {
                console.warn('[CAP-PRICING-V3] No price found for size:', size, 'tier:', tier);
                cell.textContent = '-';
            }
        });
        
        // Update note
        const note = document.getElementById('pricing-note');
        if (note) {
            note.innerHTML = `
                <i class="fas fa-info-circle" style="color: #3a7c52;"></i>
                Prices shown are complete cap prices including ${currentFrontStitches.toLocaleString()} stitch embroidered logo on front
            `;
        }
    }

    // Update quote calculator with proper rounding
    function updateQuote() {
        // For caps, look for cap-specific sizes or use the first available size
        let quoteSize = null;
        const possibleCapSizes = ['OSFA', 'OS', 'One Size', 'ONE SIZE', 'S/M', 'M/L', 'L/XL'];
        
        // Try to find a cap-specific size
        for (const size of possibleCapSizes) {
            if (basePrices[size]) {
                quoteSize = size;
                break;
            }
        }
        
        // If no cap size found, use the first available size
        if (!quoteSize) {
            quoteSize = Object.keys(basePrices)[0];
        }
        
        if (!quoteSize) {
            console.error('[CAP-PRICING-V3] No size found in basePrices');
            document.getElementById('base-price').textContent = 'Loading...';
            // Try to fetch pricing data again
            fetchPricingData();
            return;
        }
        
        console.log('[CAP-PRICING-V3] Using size for quote:', quoteSize);
        
        // Get base price
        const tier = getPriceTier(currentQuantity);
        let basePrice = 0;
        if (tier && basePrices[quoteSize] && basePrices[quoteSize][tier]) {
            basePrice = basePrices[quoteSize][tier];
        } else if (basePrices[quoteSize] && basePrices[quoteSize]['24-47']) {
            // Fallback to lowest tier if specific tier not found
            basePrice = basePrices[quoteSize]['24-47'];
            console.log('[CAP-PRICING-V3] Using fallback tier 24-47 for quantity:', currentQuantity);
        } else {
            console.error('[CAP-PRICING-V3] No price found for tier:', tier, 'size:', quoteSize);
            console.log('[CAP-PRICING-V3] Available tiers for size', quoteSize + ':', basePrices[quoteSize] ? Object.keys(basePrices[quoteSize]) : 'none');
            document.getElementById('base-price').textContent = 'Loading...';
            return;
        }
        
        // Update base price display
        const basePriceEl = document.getElementById('base-price');
        if (basePriceEl) {
            basePriceEl.textContent = `$${basePrice.toFixed(2)}`;
        }
        
        // Front logo adjustment
        const frontLine = document.getElementById('front-adjust-line');
        const frontLabel = document.getElementById('front-adjust-label');
        const frontAmount = document.getElementById('front-adjust-amount');
        
        if (frontAdjustment !== 0) {
            frontLine.classList.add('show');
            if (frontAdjustment > 0) {
                frontLabel.textContent = '+ Front Logo Adjustment:';
                frontAmount.textContent = `$${frontAdjustment.toFixed(2)}`;
            } else {
                frontLabel.textContent = '- Front Logo Discount:';
                frontAmount.textContent = `-$${Math.abs(frontAdjustment).toFixed(2)}`;
            }
        } else {
            frontLine.classList.remove('show');
        }
        
        // Back logo
        const backLine = document.getElementById('back-logo-line');
        if (backLine) {
            if (backLogoEnabled) {
                backLine.classList.add('show');
                const backStitches = currentBackStitches.toLocaleString();
                document.getElementById('back-logo-label').textContent = `+ Back Logo (${backStitches} stitches):`;
                document.getElementById('back-logo-amount').textContent = `$${backLogoPrice.toFixed(2)}`;
            } else {
                backLine.classList.remove('show');
            }
        }
        
        // Side logos
        const leftLine = document.getElementById('left-logo-line');
        if (leftLine) {
            if (leftLogoEnabled) {
                leftLine.classList.add('show');
                const leftStitches = currentLeftStitches.toLocaleString();
                document.getElementById('left-logo-label').textContent = `+ Left Side Logo (${leftStitches} stitches):`;
                document.getElementById('left-logo-amount').textContent = `$${leftLogoPrice.toFixed(2)}`;
            } else {
                leftLine.classList.remove('show');
            }
        }
        
        const rightLine = document.getElementById('right-logo-line');
        if (rightLine) {
            if (rightLogoEnabled) {
                rightLine.classList.add('show');
                const rightStitches = currentRightStitches.toLocaleString();
                document.getElementById('right-logo-label').textContent = `+ Right Side Logo (${rightStitches} stitches):`;
                document.getElementById('right-logo-amount').textContent = `$${rightLogoPrice.toFixed(2)}`;
            } else {
                rightLine.classList.remove('show');
            }
        }
        
        // LTM fee
        const ltmLine = document.getElementById('ltm-line');
        let ltmPerPiece = 0;
        
        if (currentQuantity < MIN_QUANTITY && currentQuantity > 0) {
            ltmPerPiece = Math.round((LTM_FEE / currentQuantity) * 100) / 100;
            ltmLine.classList.add('show');
            document.getElementById('ltm-amount').textContent = `$${ltmPerPiece.toFixed(2)}`;
        } else {
            ltmLine.classList.remove('show');
        }
        
        // Calculate totals with proper rounding
        let pieceTotal = basePrice + frontAdjustment;
        if (backLogoEnabled) pieceTotal += backLogoPrice;
        if (leftLogoEnabled) pieceTotal += leftLogoPrice;
        if (rightLogoEnabled) pieceTotal += rightLogoPrice;
        
        if (ltmPerPiece > 0) {
            pieceTotal = Math.round((pieceTotal + ltmPerPiece) * 100) / 100;
        }
        
        const orderTotal = Math.round(pieceTotal * currentQuantity * 100) / 100;
        
        // Update display
        const quotePieceTotal = document.getElementById('piece-total');
        const quoteOrderTotal = document.getElementById('order-total');
        const quoteQuantityEl = document.getElementById('quote-quantity');
        
        if (quoteQuantityEl) quoteQuantityEl.textContent = currentQuantity;
        if (quotePieceTotal) quotePieceTotal.textContent = `$${pieceTotal.toFixed(2)}`;
        if (quoteOrderTotal) quoteOrderTotal.textContent = `$${orderTotal.toFixed(2)}`;
        
        // Update header pricing dynamically
        updateHeaderPricing(currentQuantity, pieceTotal);
        
        // Dispatch event for other components
        document.dispatchEvent(new CustomEvent('pricingUpdated', {
            detail: {
                quantity: currentQuantity,
                unitPrice: pieceTotal,
                totalPrice: orderTotal
            }
        }));
    }

    // Show call for quote message
    function showCallForQuote() {
        const quoteContainer = document.getElementById('quick-quote-container');
        if (quoteContainer) {
            quoteContainer.innerHTML = `
                <div class="step-section">
                    <div class="step-header">
                        <div class="step-number">2</div>
                        <h2 class="step-title">Get Your Quote</h2>
                    </div>
                    
                    <div class="call-for-quote-box">
                        <i class="fas fa-phone-alt"></i>
                        <h3>Call for Quote</h3>
                        <p>Please contact us for pricing on this item.</p>
                        <a href="tel:253-922-5793" class="quote-phone-link">
                            <i class="fas fa-phone"></i> (253) 922-5793
                        </a>
                    </div>
                </div>
            `;
        }
        
        // Hide pricing grid as well
        const gridContainer = document.getElementById('pricing-grid-container');
        if (gridContainer) {
            gridContainer.innerHTML = '';
        }
        
        // Update header to show "Call for Quote"
        updateHeaderPricing(currentQuantity, 'Call for Quote');
    }

    // Get price tier based on quantity
    function getPriceTier(quantity) {
        // For quantities less than 24, use the 24-47 tier pricing
        if (quantity < 24) return '24-47';
        if (quantity <= 47) return '24-47';
        if (quantity <= 71) return '48-71';
        return '72+';
    }

    // Fetch pricing data directly
    async function fetchPricingData() {
        console.log('[CAP-PRICING-V3] Starting pricing data fetch...');
        
        const API_BASE_URL = window.API_PROXY_BASE_URL || 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
        const STITCH_COUNT = "8000";
        const urlParams = new URLSearchParams(window.location.search);
        const styleNumber = urlParams.get('StyleNumber');
        const color = urlParams.get('COLOR') || 'Black';
        
        if (!styleNumber) {
            console.log('[CAP-PRICING-V3] No StyleNumber, skipping pricing fetch');
            return;
        }
        
        try {
            // First, try to get cap base price using size-pricing endpoint
            const sizePricingUrl = `${API_BASE_URL}/api/size-pricing?styleNumber=${encodeURIComponent(styleNumber)}&color=${encodeURIComponent(color)}`;
            const sizePricingRes = await fetch(sizePricingUrl);
            
            let capBasePrice = null;
            let sizeDataResult = null;
            
            if (sizePricingRes.ok) {
                const sizePricingData = await sizePricingRes.json();
                console.log('[CAP-PRICING-V3] Size pricing data:', sizePricingData);
                
                // For caps, usually there's only one size (OSFA)
                if (sizePricingData.baseSizePrice) {
                    capBasePrice = sizePricingData.baseSizePrice;
                }
            }
            
            // Fetch other required data
            const tierApiUrl = `${API_BASE_URL}/api/pricing-tiers?method=EmbroideryCaps`;
            const ruleApiUrl = `${API_BASE_URL}/api/pricing-rules?method=EmbroideryCaps`;
            const costApiUrl = `${API_BASE_URL}/api/embroidery-costs?itemType=Cap&stitchCount=${STITCH_COUNT}`;
            
            // If size-pricing didn't work, try max-prices-by-style as fallback
            if (!capBasePrice) {
                const sizeDataApiUrl = `${API_BASE_URL}/api/max-prices-by-style?styleNumber=${encodeURIComponent(styleNumber)}`;
                const sizeDataRes = await fetch(sizeDataApiUrl);
                if (sizeDataRes.ok) {
                    sizeDataResult = await sizeDataRes.json();
                }
            }
            
            const [tierRes, ruleRes, costRes] = await Promise.all([
                fetch(tierApiUrl),
                fetch(ruleApiUrl),
                fetch(costApiUrl)
            ]);
            
            if (!tierRes.ok || !ruleRes.ok || !costRes.ok) {
                throw new Error(`API fetch failed`);
            }
            
            const tiersResult = await tierRes.json();
            const rulesResult = await ruleRes.json();
            const costsResult = await costRes.json();
            
            // Process data
            const tierDefinitions = {};
            tiersResult.forEach(tier => {
                tierDefinitions[tier.TierLabel] = tier;
            });
            
            let priceProfile = {};
            const baseItemCosts = {};
            
            // Use cap base price if we got it from size-pricing
            if (capBasePrice !== null) {
                baseItemCosts['OSFA'] = capBasePrice;
            } else if (sizeDataResult && sizeDataResult.sizes) {
                // Fallback to max-prices data
                sizeDataResult.sizes.forEach(item => {
                    if (item && item.size && baseItemCosts[item.size] === undefined && !isNaN(parseFloat(item.price))) {
                        baseItemCosts[item.size] = parseFloat(item.price);
                    }
                });
            }
            
            // For caps, we typically have OSFA
            const uniqueSizes = Object.keys(baseItemCosts).length > 0 ? Object.keys(baseItemCosts) : ['OSFA'];
            
            uniqueSizes.forEach(size => {
                const maxCasePrice = baseItemCosts[size] || capBasePrice || 0;
                if (maxCasePrice > 0) {
                    priceProfile[size] = {};
                    for (const tierLabel in tierDefinitions) {
                        const tierInfo = tierDefinitions[tierLabel];
                        const embCost = costsResult[tierLabel];
                        if (embCost !== undefined && tierInfo.MarginDenominator) {
                            const itemPortion = maxCasePrice / parseFloat(tierInfo.MarginDenominator);
                            const unroundedFinalPrice = itemPortion + parseFloat(embCost);
                            priceProfile[size][tierLabel] = applyDynamicRounding(unroundedFinalPrice, rulesResult.RoundingMethod);
                        } else {
                            priceProfile[size][tierLabel] = null;
                        }
                    }
                }
            });
            
            const masterBundle = {
                success: true,
                allPriceProfiles: { [STITCH_COUNT]: priceProfile },
                groupedHeaders: uniqueSizes,
                tierDefinitions: tierDefinitions,
                pricingRules: rulesResult,
                timestamp: new Date().toISOString()
            };
            
            console.log('[CAP-PRICING-V3] Pricing data loaded:', masterBundle);
            console.log('[CAP-PRICING-V3] Price profile structure:', priceProfile);
            processPricingData(masterBundle);
            
        } catch (error) {
            console.error('[CAP-PRICING-V3] Failed to fetch pricing data:', error);
            displayPricingError();
        }
    }

    // Helper function for rounding
    function applyDynamicRounding(amount, ruleName) {
        if (isNaN(amount) || amount === null || typeof amount !== 'number') {
            return 0;
        }
        switch (ruleName) {
            case 'CeilDollar':
                return Math.ceil(amount);
            case 'HalfDollarUp_Final':
                return Math.ceil(amount * 2) / 2;
            case 'RoundToNearestHalfDollar':
                return Math.round(amount * 2) / 2;
            case 'RoundToNearestDollar':
                return Math.round(amount);
            default:
                return parseFloat(amount.toFixed(2));
        }
    }

    // Display error message
    function displayPricingError() {
        console.error('[CAP-PRICING-V3] Displaying pricing error');
        const basePrice = document.getElementById('base-price');
        if (basePrice) {
            basePrice.textContent = 'Error loading price';
        }
        
        const gridContainer = document.getElementById('pricing-grid-container');
        if (gridContainer) {
            gridContainer.innerHTML = `
                <div class="pricing-error">
                    <p>Sorry, pricing is currently unavailable. Please try refreshing the page.</p>
                    <p>If the problem persists, call: <a href="tel:253-922-5793">253-922-5793</a></p>
                </div>
            `;
        }
    }

    // Load product data for visual components
    async function loadProductData() {
        const urlParams = new URLSearchParams(window.location.search);
        const styleNumber = urlParams.get('StyleNumber');
        const color = urlParams.get('COLOR');
        
        if (!styleNumber) {
            console.log('[CAP-PRICING-V3] No StyleNumber in URL, skipping product data load');
            return;
        }
        
        try {
            const apiBase = window.API_PROXY_BASE_URL || 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
            const response = await fetch(`${apiBase}/api/product-colors?styleNumber=${encodeURIComponent(styleNumber)}`);
            
            if (!response.ok) {
                throw new Error(`Failed to fetch product data: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('[CAP-PRICING-V3] Product data loaded:', data);
            
            // Set globals for compatibility
            window.productTitle = data.productTitle || `Style ${styleNumber}`;
            window.selectedStyleNumber = styleNumber;
            window.productColors = data.colors || [];
            
            // Find and set selected color
            if (data.colors && data.colors.length > 0) {
                const selectedColor = color ? 
                    data.colors.find(c => 
                        c.COLOR_NAME === color || 
                        c.CATALOG_COLOR === color ||
                        (c.COLOR_NAME && c.COLOR_NAME.toLowerCase().replace(/\s+/g, '') === color.toLowerCase().replace(/\s+/g, '')) ||
                        (c.CATALOG_COLOR && c.CATALOG_COLOR.toLowerCase().replace(/\s+/g, '') === color.toLowerCase().replace(/\s+/g, ''))
                    ) || data.colors[0] : 
                    data.colors[0];
                    
                window.selectedColorName = selectedColor.COLOR_NAME;
                window.selectedColorData = selectedColor;
                window.productMainImage = selectedColor.MAIN_IMAGE_URL || '';
                
                // Update product display
                const productNameEl = document.getElementById('product-name');
                const productStyleEl = document.getElementById('product-style');
                
                if (productNameEl) productNameEl.textContent = data.productTitle || `Style ${styleNumber}`;
                if (productStyleEl) productStyleEl.textContent = `Style: ${styleNumber}`;
                
                // Initialize Universal Product Display
                if (window.UniversalProductDisplay) {
                    console.log('[CAP-PRICING-V3] Initializing UniversalProductDisplay');
                    new window.UniversalProductDisplay({
                        containerId: 'product-display',
                        pageType: 'cap-embroidery',
                        showBackButton: true,
                        enableGallery: true,
                        enableSwatches: true
                    });
                }
                
                // Dispatch event
                window.dispatchEvent(new CustomEvent('productColorsReady', {
                    detail: {
                        colors: data.colors,
                        selectedColor: selectedColor,
                        productTitle: data.productTitle
                    }
                }));
            }
        } catch (error) {
            console.error('[CAP-PRICING-V3] Failed to load product data:', error);
        }
    }

})();