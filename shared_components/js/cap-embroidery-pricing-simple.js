// Cap Embroidery Pricing - Simplified Implementation
// Handles dynamic stitch pricing for front and back logos with live quote calculator

(function() {
    'use strict';

    // Constants
    const BASE_STITCHES = 8000;
    const PRICE_PER_THOUSAND = 1.00;
    const BACK_LOGO_BASE = 5.00;
    const BACK_LOGO_BASE_STITCHES = 5000;
    const LTM_FEE = 50.00;
    const MIN_QUANTITY = 24;

    // State
    let basePrices = {};
    let currentFrontStitches = BASE_STITCHES;
    let currentBackStitches = 5000;
    let backLogoEnabled = false;
    let currentQuantity = MIN_QUANTITY;
    let pricingData = null;
    
    // DOM element references
    const elements = {};

    // Initialize on DOM ready
    document.addEventListener('DOMContentLoaded', function() {
        console.log('[CAP-PRICING-SIMPLE] Initializing...');
        
        // Listen for Caspio data
        document.addEventListener('caspioCapPricingCalculated', handleCaspioData);
        
        // Initialize UI
        initializeUI();
        
        // Load product data for gallery and swatches
        loadProductData();
        
        // Embed Caspio engine
        embedCaspioEngine();
    });

    // Handle Caspio pricing data
    function handleCaspioData(event) {
        console.log('[CAP-PRICING-SIMPLE] Received Caspio data:', event.detail);
        
        if (!event.detail || !event.detail.success) {
            displayPricingError();
            return;
        }

        const data = event.detail;
        
        // Extract base prices at 8000 stitches
        if (data.allPriceProfiles && data.allPriceProfiles['8000']) {
            basePrices = data.allPriceProfiles['8000'];
            pricingData = data;
            
            // Build table structure once, then update prices
            createTableStructure(data);
            updatePricingTable();
            updateQuote();
        }
    }

    // Initialize UI components
    function initializeUI() {
        // Add front stitch slider section
        const customizationContainer = document.getElementById('embroidery-customization-container');
        if (customizationContainer) {
            customizationContainer.innerHTML = `
                <div class="customization-section">
                    <h3 class="section-title">Front Logo Embroidery</h3>
                    <div class="stitch-control">
                        <label>Stitch Count: <span id="front-stitch-display">${currentFrontStitches.toLocaleString()}</span></label>
                        <input type="range" id="front-stitch-slider" 
                               min="5000" max="20000" step="1000" 
                               value="${currentFrontStitches}" 
                               class="stitch-slider">
                        <div class="slider-labels">
                            <span>5,000</span>
                            <span>20,000</span>
                        </div>
                    </div>
                    
                    <div class="back-logo-section">
                        <h3 class="section-title">
                            <label>
                                <input type="checkbox" id="back-logo-checkbox"> 
                                Add Back Logo Embroidery
                            </label>
                        </h3>
                        <div id="back-logo-controls" style="display: none;">
                            <div class="stitch-control">
                                <label>Stitch Count: <span id="back-stitch-display">${currentBackStitches.toLocaleString()}</span></label>
                                <input type="range" id="back-stitch-slider" 
                                       min="5000" max="20000" step="1000" 
                                       value="${currentBackStitches}" 
                                       class="stitch-slider">
                                <div class="slider-labels">
                                    <span>5,000</span>
                                    <span>20,000</span>
                                </div>
                                <p class="back-logo-price">Back Logo Price: $<span id="back-logo-price">${calculateBackLogoPrice(currentBackStitches).toFixed(2)}</span> each</p>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }

        // Add quick quote calculator
        const quoteContainer = document.getElementById('quick-quote-container');
        if (quoteContainer) {
            quoteContainer.innerHTML = `
                <div class="universal-quick-quote">
                    <h3 class="quote-title">Quick Quote Calculator</h3>
                    <div class="quote-form">
                        <div class="form-group">
                            <label for="quantity">Quantity:</label>
                            <input type="number" id="quantity" min="1" value="${currentQuantity}" class="quantity-input">
                        </div>
                        
                        <div class="quote-breakdown">
                            <div class="quote-line">
                                <span>Unit Price:</span>
                                <span id="unit-price">$0.00</span>
                            </div>
                            <div class="quote-line">
                                <span>× Quantity:</span>
                                <span id="quantity-display">${currentQuantity}</span>
                            </div>
                            <div class="quote-line subtotal">
                                <span>Subtotal:</span>
                                <span id="subtotal">$0.00</span>
                            </div>
                            <div class="quote-line back-logo-line" style="display: none;">
                                <span>Back Logo:</span>
                                <span id="back-logo-total">$0.00</span>
                            </div>
                            <div class="quote-line ltm-line" style="display: none;">
                                <span>LTM Fee (< 24 units):</span>
                                <span id="ltm-fee">$50.00</span>
                            </div>
                            <div class="quote-line total">
                                <span>Total:</span>
                                <span id="total">$0.00</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }

        // Store element references
        elements.frontSlider = document.getElementById('front-stitch-slider');
        elements.frontDisplay = document.getElementById('front-stitch-display');
        elements.backCheckbox = document.getElementById('back-logo-checkbox');
        elements.backControls = document.getElementById('back-logo-controls');
        elements.backSlider = document.getElementById('back-stitch-slider');
        elements.backDisplay = document.getElementById('back-stitch-display');
        elements.backPriceDisplay = document.getElementById('back-logo-price');
        elements.quantityInput = document.getElementById('quantity');
        elements.quantityDisplay = document.getElementById('quantity-display');
        elements.backLogoLine = document.querySelector('.back-logo-line');
        
        // Attach event listeners
        attachEventListeners();
    }

    // Attach all event listeners
    function attachEventListeners() {
        // Front stitch slider
        if (elements.frontSlider) {
            elements.frontSlider.addEventListener('input', function() {
                currentFrontStitches = parseInt(this.value);
                if (elements.frontDisplay) {
                    elements.frontDisplay.textContent = currentFrontStitches.toLocaleString();
                }
                updatePricingTable();
                updateQuote();
            });
        }

        // Back logo checkbox
        if (elements.backCheckbox) {
            elements.backCheckbox.addEventListener('change', function() {
                backLogoEnabled = this.checked;
                if (elements.backControls) {
                    elements.backControls.style.display = backLogoEnabled ? 'block' : 'none';
                }
                if (elements.backLogoLine) {
                    elements.backLogoLine.style.display = backLogoEnabled ? 'flex' : 'none';
                }
                updateQuote();
            });
        }

        // Back stitch slider
        if (elements.backSlider) {
            elements.backSlider.addEventListener('input', function() {
                currentBackStitches = parseInt(this.value);
                if (elements.backDisplay) {
                    elements.backDisplay.textContent = currentBackStitches.toLocaleString();
                }
                const price = calculateBackLogoPrice(currentBackStitches);
                if (elements.backPriceDisplay) {
                    elements.backPriceDisplay.textContent = price.toFixed(2);
                }
                updateQuote();
            });
        }

        // Quantity input
        if (elements.quantityInput) {
            elements.quantityInput.addEventListener('input', function() {
                currentQuantity = parseInt(this.value) || 0;
                if (elements.quantityDisplay) {
                    elements.quantityDisplay.textContent = currentQuantity;
                }
                updateQuote();
            });
        }
    }

    // Create table structure (called once)
    function createTableStructure(data) {
        const gridContainer = document.getElementById('pricing-grid-container');
        if (!gridContainer) return;

        const headers = data.groupedHeaders || [];
        const tiers = data.tierDefinitions || {};
        
        // Filter for our 3 tiers
        const displayTiers = ['24-47', '48-71', '72+'];
        
        let tableHTML = `
            <div class="universal-pricing-grid">
                <h3 class="grid-title">Cap Embroidery Pricing (Per Unit)</h3>
                <div class="table-wrapper">
                    <table class="pricing-table">
                        <thead>
                            <tr>
                                <th>Quantity</th>
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
                // Just create empty cells with data attributes
                tableHTML += `<td class="price-cell" data-size="${size}" data-tier="${tierKey}"></td>`;
            });
            
            tableHTML += `</tr>`;
        });
        
        tableHTML += `
                        </tbody>
                    </table>
                </div>
                <p class="pricing-note">Prices shown include ${currentFrontStitches.toLocaleString()} stitch embroidery</p>
            </div>
        `;
        
        gridContainer.innerHTML = tableHTML;
    }

    // Update pricing table (can be called multiple times)
    function updatePricingTable() {
        if (!basePrices) return;
        
        const priceCells = document.querySelectorAll('.price-cell[data-size][data-tier]');
        const adjustment = calculateFrontAdjustment(currentFrontStitches);
        
        priceCells.forEach(cell => {
            const size = cell.dataset.size;
            const tier = cell.dataset.tier;
            
            if (basePrices[size] && basePrices[size][tier] !== undefined) {
                const basePrice = basePrices[size][tier];
                const adjustedPrice = basePrice + adjustment;
                cell.textContent = `$${adjustedPrice.toFixed(2)}`;
                cell.dataset.basePrice = basePrice; // Store for reference
                
                // Add visual feedback only if content changed
                if (cell.textContent !== cell.dataset.lastContent) {
                    cell.style.transition = 'background-color 0.3s';
                    cell.style.backgroundColor = '#e8f5e9';
                    setTimeout(() => {
                        cell.style.backgroundColor = '';
                    }, 300);
                    cell.dataset.lastContent = cell.textContent;
                }
            } else {
                cell.textContent = '-';
            }
        });
        
        // Update note
        const note = document.querySelector('.pricing-note');
        if (note) {
            note.textContent = `Prices shown include ${currentFrontStitches.toLocaleString()} stitch embroidery`;
        }
    }

    // Calculate front logo price adjustment
    function calculateFrontAdjustment(stitchCount) {
        const difference = stitchCount - BASE_STITCHES;
        return (difference / 1000) * PRICE_PER_THOUSAND;
    }

    // Calculate back logo price
    function calculateBackLogoPrice(stitchCount) {
        if (stitchCount <= BACK_LOGO_BASE_STITCHES) {
            return BACK_LOGO_BASE;
        }
        const additional = stitchCount - BACK_LOGO_BASE_STITCHES;
        return BACK_LOGO_BASE + (additional / 1000) * PRICE_PER_THOUSAND;
    }

    // Get price tier based on quantity
    function getPriceTier(quantity) {
        if (quantity < 24) return null;
        if (quantity <= 47) return '24-47';
        if (quantity <= 71) return '48-71';
        return '72+';
    }

    // Get unit price for quantity and size
    function getUnitPrice(quantity, size) {
        const tier = getPriceTier(quantity);
        if (!tier || !basePrices[size] || basePrices[size][tier] === undefined) {
            return 0;
        }
        const basePrice = basePrices[size][tier];
        const adjustment = calculateFrontAdjustment(currentFrontStitches);
        return basePrice + adjustment;
    }

    // Update quote calculator
    function updateQuote() {
        // Determine which size to use for the quote (the first one available)
        const quoteSize = Object.keys(basePrices)[0]; 
        if (!quoteSize) {
            // We don't have prices yet, do nothing.
            return;
        }
        
        if (!currentQuantity || currentQuantity === 0) {
            updateQuoteDisplay(0, 0, 0, 0, 0);
            return;
        }
        
        const unitPrice = getUnitPrice(currentQuantity, quoteSize);
        const subtotal = unitPrice * currentQuantity;
        
        let backLogoTotal = 0;
        if (backLogoEnabled) {
            const backLogoPrice = calculateBackLogoPrice(currentBackStitches);
            backLogoTotal = backLogoPrice * currentQuantity;
        }
        
        const ltmFee = currentQuantity < MIN_QUANTITY ? LTM_FEE : 0;
        const total = subtotal + backLogoTotal + ltmFee;
        
        updateQuoteDisplay(unitPrice, subtotal, backLogoTotal, ltmFee, total);
    }

    // Update quote display
    function updateQuoteDisplay(unitPrice, subtotal, backLogoTotal, ltmFee, total) {
        document.getElementById('unit-price').textContent = `$${unitPrice.toFixed(2)}`;
        document.getElementById('subtotal').textContent = `$${subtotal.toFixed(2)}`;
        document.getElementById('back-logo-total').textContent = `$${backLogoTotal.toFixed(2)}`;
        document.getElementById('total').textContent = `$${total.toFixed(2)}`;
        
        // Show/hide LTM line
        const ltmLine = document.querySelector('.ltm-line');
        if (ltmLine) {
            ltmLine.style.display = ltmFee > 0 ? 'flex' : 'none';
        }
    }

    // Embed Caspio data engine
    function embedCaspioEngine() {
        // Add hidden container if it doesn't exist
        let container = document.getElementById('caspio-dp-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'caspio-dp-container';
            container.style.display = 'none';
            document.body.appendChild(container);
        }

        // This is the official Caspio embed library script
        const caspioLibrary = document.createElement('script');
        caspioLibrary.src = 'https://c3eku948.caspio.com/scripts/embed.js';
        caspioLibrary.type = 'text/javascript';
        
        // This function runs AFTER the library has loaded
        caspioLibrary.onload = () => {
            try {
                // Get style number from the main page's URL
                const urlParams = new URLSearchParams(window.location.search);
                const styleNumber = urlParams.get('StyleNumber');

                // Use the CaspioDeployment object to deploy the datapage
                // This object is created by the embed.js library
                new CaspioDeployment({
                    "authType": "Public", 
                    "appKey": "a0e150004ecd0739f853449c8d7f", 
                    "id": "caspio-dp-container", 
                    "endpoint": "emb",
                    "passParameters": true // This ensures our URL params get passed to the iFrame
                }).deploy();

            } catch (e) {
                console.error('[CAP-PRICING-SIMPLE] Caspio embed failed:', e);
            }
        };
        
        document.body.appendChild(caspioLibrary);
        console.log('[CAP-PRICING-SIMPLE] Caspio engine embedding...');
    }

    // Display error message
    function displayPricingError() {
        const gridContainer = document.getElementById('pricing-grid-container');
        if (gridContainer) {
            gridContainer.innerHTML = `
                <div class="pricing-error">
                    <p>Sorry, pricing is currently unavailable. Please contact us for a quote.</p>
                    <p>Call: <a href="tel:253-922-5793">253-922-5793</a></p>
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
            console.log('[CAP-PRICING-SIMPLE] No StyleNumber in URL, skipping product data load');
            return;
        }
        
        try {
            // Use the API proxy base URL
            const apiBase = window.API_PROXY_BASE_URL || 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
            const response = await fetch(`${apiBase}/api/product-colors?styleNumber=${encodeURIComponent(styleNumber)}`);
            
            if (!response.ok) {
                throw new Error(`Failed to fetch product data: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('[CAP-PRICING-SIMPLE] Product data loaded:', data);
            
            // Set globals for compatibility with existing components
            window.productTitle = data.productTitle || `Style ${styleNumber}`;
            window.selectedStyleNumber = styleNumber;
            
            // Find and set selected color
            if (data.colors && data.colors.length > 0) {
                const selectedColor = color ? 
                    data.colors.find(c => c.COLOR_NAME === color) || data.colors[0] : 
                    data.colors[0];
                    
                window.selectedColorName = selectedColor.COLOR_NAME;
                window.selectedColorData = selectedColor;
                window.productMainImage = selectedColor.ImageURL || '';
                
                // Update product display elements directly
                const productNameEl = document.getElementById('product-name');
                const productStyleEl = document.getElementById('product-style');
                
                if (productNameEl) productNameEl.textContent = data.productTitle || `Style ${styleNumber}`;
                if (productStyleEl) productStyleEl.textContent = `Style: ${styleNumber}`;
                
                // Initialize Universal Product Display if available
                if (window.UniversalProductDisplay) {
                    console.log('[CAP-PRICING-SIMPLE] Initializing UniversalProductDisplay');
                    new window.UniversalProductDisplay({
                        containerId: 'product-display',
                        pageType: 'cap-embroidery',
                        showBackButton: true,
                        enableGallery: true,
                        enableSwatches: true
                    });
                }
                
                // Dispatch event for any other components listening
                window.dispatchEvent(new CustomEvent('productColorsReady', {
                    detail: {
                        colors: data.colors,
                        selectedColor: selectedColor,
                        productTitle: data.productTitle
                    }
                }));
            }
        } catch (error) {
            console.error('[CAP-PRICING-SIMPLE] Failed to load product data:', error);
            // Continue anyway - pricing can still work without product images
        }
    }

})();