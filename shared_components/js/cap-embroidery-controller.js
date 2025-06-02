// Cap Embroidery Controller - Consolidated from 6 separate files
// Consolidates: adapter.js, enhanced.js, adapter-enhanced.js, validation.js, cart-integration.js, back-logo.js
(function() {
    'use strict';

    console.log('[CAP-CONTROLLER] Initializing Cap Embroidery Controller (Consolidated v1.0)');

    // Configuration constants
    const CAP_CONFIG = {
        APP_KEY: 'a0e150004ecd0739f853449c8d7f',
        defaultStitchCount: 8000,
        availableStitchCounts: [5000, 8000, 10000],
        ltmMinimum: 24,
        ltmFee: 50.00,
        backLogo: {
            defaultStitchCount: 5000,
            minStitchCount: 5000,
            priceBase: 5.00,
            pricePerThousand: 1.00
        },
        ui: {
            loadingTimeout: 5000,
            successDisplayDuration: 3000,
            pollingInterval: 100,
            maxPollingAttempts: 50
        },
        tierLabels: {
            '72-9999': '72+',
            '72-99999': '72+'
        }
    };

    // Main Controller Object
    const CapEmbroideryController = {
        // State management
        state: {
            initialized: false,
            masterData: null,
            currentStitchCount: CAP_CONFIG.defaultStitchCount,
            backLogo: {
                enabled: false,
                stitchCount: CAP_CONFIG.backLogo.defaultStitchCount,
                pricePerItem: CAP_CONFIG.backLogo.priceBase
            },
            ui: {
                stitchCountSelector: null,
                pricingGrid: null,
                addToCartButton: null
            }
        },

        // Data Management Module (from cap-embroidery-adapter.js)
        DataManager: {
            /**
             * Formats a numeric price into a string like $X.XX
             */
            formatPrice(price) {
                const num = parseFloat(price);
                if (isNaN(num)) {
                    return 'N/A';
                }
                return '$' + num.toFixed(2);
            },

            /**
             * Fixes tier labels (72-9999 → 72+)
             */
            fixTierLabels() {
                const elements = document.querySelectorAll('td, th');
                let found = false;
                
                elements.forEach(function(element) {
                    if (element.textContent.trim() === '72-9999' ||
                        element.textContent.trim() === '72-99999' ||
                        element.textContent.includes('72-9999')) {
                        console.log('[CAP-CONTROLLER] Found "72-9999" label, changing to "72+"');
                        element.textContent = '72+';
                        found = true;
                    }
                });
                
                return found;
            },

            /**
             * Updates the custom pricing grid display based on selected stitch count
             */
            updateCapPricingDisplay() {
                console.log('[CAP-CONTROLLER] updateCapPricingDisplay called');
                
                // Show loading indicator
                CapEmbroideryController.UIManager.showLoadingIndicator();
                
                const stitchCountSelect = document.getElementById('client-stitch-count-select');
                if (!stitchCountSelect) {
                    console.error('[CAP-CONTROLLER] Stitch count select dropdown not found');
                    CapEmbroideryController.UIManager.hideLoadingIndicator();
                    return;
                }
                
                const selectedStitchCount = stitchCountSelect.value;
                CapEmbroideryController.state.currentStitchCount = selectedStitchCount;

                const masterData = CapEmbroideryController.state.masterData;
                if (!masterData || !masterData.allPriceProfiles || !masterData.groupedHeaders || !masterData.tierDefinitions) {
                    console.error('[CAP-CONTROLLER] Master data validation failed');
                    return;
                }

                const pricingDataForStitchCount = masterData.allPriceProfiles[selectedStitchCount];
                const tierDefinitions = masterData.tierDefinitions;
                const sizeHeadersToDisplay = masterData.groupedHeaders;

                // Sort tier keys
                const actualTierKeys = Object.keys(tierDefinitions).sort((a, b) => {
                    const tierA = tierDefinitions[a];
                    const tierB = tierDefinitions[b];
                    if (tierA && typeof tierA.TierOrder !== 'undefined' && tierB && typeof tierB.TierOrder !== 'undefined') {
                        const orderA = parseFloat(tierA.TierOrder);
                        const orderB = parseFloat(tierB.TierOrder);
                        if (!isNaN(orderA) && !isNaN(orderB)) {
                            if (orderA !== orderB) return orderA - orderB;
                        }
                    }
                    const numA = parseInt(String(a).split('-')[0], 10);
                    const numB = parseInt(String(b).split('-')[0], 10);
                    if (!isNaN(numA) && !isNaN(numB) && numA !== numB) {
                        return numA - numB;
                    }
                    return String(a).localeCompare(String(b));
                });

                const pricingGrid = document.getElementById('custom-pricing-grid');
                const pricingGridBody = pricingGrid?.getElementsByTagName('tbody')[0];
                const pricingHeaderRow = document.getElementById('pricing-header-row');

                if (!pricingGridBody || !pricingHeaderRow) {
                    console.error('[CAP-CONTROLLER] Pricing grid elements not found');
                    return;
                }

                // Clear and rebuild header
                pricingHeaderRow.innerHTML = '';
                const thTierHeader = document.createElement('th');
                thTierHeader.textContent = 'Tier';
                pricingHeaderRow.appendChild(thTierHeader);

                sizeHeadersToDisplay.forEach(sizeHeader => {
                    const th = document.createElement('th');
                    th.textContent = sizeHeader;
                    pricingHeaderRow.appendChild(th);
                });

                // Clear and rebuild body
                pricingGridBody.innerHTML = '';
                if (pricingDataForStitchCount && actualTierKeys.length > 0 && sizeHeadersToDisplay.length > 0) {
                    actualTierKeys.forEach(currentTierKey => {
                        const tr = pricingGridBody.insertRow();

                        // Tier label cell
                        const tdTierLabel = tr.insertCell();
                        const tierDefinition = tierDefinitions[currentTierKey];
                        
                        // Fix for 72+ tier label
                        if (tierDefinition && tierDefinition.MinQuantity === 72 &&
                            (tierDefinition.MaxQuantity === 99999 || tierDefinition.MaxQuantity === undefined)) {
                            tdTierLabel.textContent = "72+";
                        } else {
                            tdTierLabel.textContent = (tierDefinition && tierDefinition.TierLabel) ? tierDefinition.TierLabel : currentTierKey;
                        }

                        // Price cells
                        sizeHeadersToDisplay.forEach(currentSizeKey => {
                            const priceCell = tr.insertCell();
                            let price = undefined;

                            if (pricingDataForStitchCount[currentSizeKey]) {
                                price = pricingDataForStitchCount[currentSizeKey][currentTierKey];
                            }

                            priceCell.textContent = (price !== undefined && price !== null) ? CapEmbroideryController.DataManager.formatPrice(price) : 'N/A';
                        });
                    });
                }

                // Update pricing explanation
                CapEmbroideryController.UIManager.updatePricingExplanation();
                
                // Update window.nwcaPricingData for compatibility
                if (window.nwcaPricingData && pricingDataForStitchCount) {
                    console.log('[CAP-CONTROLLER] Updating window.nwcaPricingData for compatibility');
                    const prices = {};
                    sizeHeadersToDisplay.forEach(sizeHeader => {
                        prices[sizeHeader] = {};
                        Object.keys(tierDefinitions).forEach(tierKey => {
                            if (pricingDataForStitchCount[sizeHeader] && pricingDataForStitchCount[sizeHeader][tierKey] !== undefined) {
                                prices[sizeHeader][tierKey] = pricingDataForStitchCount[sizeHeader][tierKey];
                            }
                        });
                    });
                    
                    window.nwcaPricingData.prices = prices;
                    window.nwcaPricingData.currentStitchCount = selectedStitchCount;
                    
                    // Dispatch event for other components
                    window.dispatchEvent(new CustomEvent('pricingDataUpdated', {
                        detail: { stitchCount: selectedStitchCount, prices: prices }
                    }));
                }

                // Hide loading and show success
                CapEmbroideryController.UIManager.hideLoadingIndicator();
                CapEmbroideryController.UIManager.showSuccessIndicator(selectedStitchCount);
                
                // Trigger cart total update
                if (window.updateCartTotal && typeof window.updateCartTotal === 'function') {
                    console.log('[CAP-CONTROLLER] Triggering cart total update');
                    window.updateCartTotal();
                }

                console.log('[CAP-CONTROLLER] Pricing display updated for stitch count:', selectedStitchCount);
            },

            /**
             * Handle Caspio pricing data event
             */
            handleCaspioPricingData(event) {
                if (event.detail && event.detail.success) {
                    console.log('[CAP-CONTROLLER] Received pricing data:', event.detail);
                    CapEmbroideryController.state.masterData = event.detail;
                    window.capEmbroideryMasterData = event.detail; // Maintain compatibility
                    
                    // Initial display update
                    CapEmbroideryController.DataManager.updateCapPricingDisplay();
                    
                    // Force pricing-matrix-capture to use our data
                    if (typeof capturePricingMatrix === 'function') {
                        const pricingTable = document.querySelector('.matrix-price-table') || document.querySelector('.cbResultSetTable');
                        if (pricingTable) {
                            const urlParams = new URLSearchParams(window.location.search);
                            const styleNumber = urlParams.get('StyleNumber');
                            const colorCode = urlParams.get('COLOR');
                            const embType = 'cap-embroidery';
                            if (styleNumber && colorCode) {
                                setTimeout(() => {
                                    console.log('[CAP-CONTROLLER] Forcing pricing-matrix-capture integration');
                                    capturePricingMatrix(pricingTable, styleNumber, colorCode, embType);
                                }, 100);
                            }
                        }
                    }
                } else {
                    const errorMessage = event.detail ? event.detail.message : "Unknown error";
                    console.error('[CAP-CONTROLLER] Pricing data load failed:', errorMessage);
                }
            }
        },

        // UI Management Module (from cap-embroidery-enhanced.js)
        UIManager: {
            /**
             * Show loading indicator for pricing updates
             */
            showLoadingIndicator() {
                const pricingGrid = document.getElementById('custom-pricing-grid');
                if (!pricingGrid) return;
                
                let loadingOverlay = document.getElementById('pricing-loading-overlay');
                if (!loadingOverlay) {
                    loadingOverlay = document.createElement('div');
                    loadingOverlay.id = 'pricing-loading-overlay';
                    loadingOverlay.style.cssText = `
                        position: absolute;
                        top: 0;
                        left: 0;
                        right: 0;
                        bottom: 0;
                        background: rgba(255, 255, 255, 0.9);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        z-index: 1000;
                        border-radius: var(--radius-sm);
                        font-weight: bold;
                        color: var(--primary-color);
                        font-size: 1.1em;
                        backdrop-filter: blur(2px);
                    `;
                    loadingOverlay.innerHTML = `
                        <div style="text-align: center;">
                            <div style="margin-bottom: 8px;">🔄</div>
                            <div>Updating pricing...</div>
                        </div>
                    `;
                    
                    const gridContainer = pricingGrid.closest('.pricing-grid-container') || pricingGrid.parentElement;
                    if (gridContainer) {
                        gridContainer.style.position = 'relative';
                        gridContainer.appendChild(loadingOverlay);
                    }
                }
                loadingOverlay.style.display = 'flex';
            },

            /**
             * Hide loading indicator
             */
            hideLoadingIndicator() {
                const loadingOverlay = document.getElementById('pricing-loading-overlay');
                if (loadingOverlay) {
                    loadingOverlay.style.display = 'none';
                }
            },

            /**
             * Show success indicator
             */
            showSuccessIndicator(stitchCount) {
                const formattedStitchCount = parseInt(stitchCount, 10).toLocaleString();
                
                let successIndicator = document.getElementById('pricing-update-success');
                if (!successIndicator) {
                    successIndicator = document.createElement('div');
                    successIndicator.id = 'pricing-update-success';
                    successIndicator.style.cssText = `
                        position: fixed;
                        top: 20px;
                        right: 20px;
                        background: #28a745;
                        color: white;
                        padding: 12px 20px;
                        border-radius: var(--radius-sm);
                        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                        z-index: 10000;
                        font-weight: bold;
                        transform: translateX(100%);
                        transition: transform 0.3s ease;
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                        border-left: 4px solid #1e7e34;
                    `;
                    document.body.appendChild(successIndicator);
                }
                
                successIndicator.innerHTML = `✅ Pricing updated for ${formattedStitchCount} stitches`;
                successIndicator.style.transform = 'translateX(0)';
                
                setTimeout(() => {
                    successIndicator.style.transform = 'translateX(100%)';
                }, CAP_CONFIG.ui.successDisplayDuration);
            },

            /**
             * Update pricing explanation text
             */
            updatePricingExplanation() {
                const pricingExplanationP = document.querySelector('.pricing-explanation p');
                if (pricingExplanationP) {
                    const formattedStitchCount = parseInt(CapEmbroideryController.state.currentStitchCount, 10).toLocaleString();
                    let explanationText = `<strong>Note:</strong> Prices shown are per item and include a ${formattedStitchCount} stitch embroidered logo.`;
                    
                    // Add back logo information if enabled
                    if (CapEmbroideryController.state.backLogo.enabled) {
                        const backLogoStitchCount = CapEmbroideryController.state.backLogo.stitchCount;
                        const backLogoPrice = CapEmbroideryController.state.backLogo.pricePerItem;
                        const formattedBackStitchCount = backLogoStitchCount.toLocaleString();
                        explanationText = `<strong>Note:</strong> Prices shown are per item and include a ${formattedStitchCount} stitch embroidered logo. <span style="color: var(--primary-color); font-weight: bold;">Back logo (${formattedBackStitchCount} stitches) adds $${backLogoPrice.toFixed(2)} per item.</span>`;
                    }
                    
                    pricingExplanationP.innerHTML = explanationText;
                }
            },

            /**
             * Enhance stitch count selector with visual feedback
             */
            enhanceStitchCountSelector() {
                const stitchCountSelect = document.getElementById('client-stitch-count-select');
                if (stitchCountSelect) {
                    console.log('[CAP-CONTROLLER] Enhancing stitch count selector');
                    
                    // Add visual feedback on change
                    stitchCountSelect.addEventListener('change', function() {
                        const indicator = document.getElementById('stitch-count-indicator');
                        if (indicator) {
                            indicator.style.opacity = '1';
                            setTimeout(() => {
                                indicator.style.opacity = '0';
                            }, 2000);
                        }
                        
                        // Visual feedback on dropdown
                        stitchCountSelect.style.borderColor = 'var(--primary-color)';
                        stitchCountSelect.style.boxShadow = '0 0 0 3px var(--primary-light)';
                        
                        setTimeout(() => {
                            stitchCountSelect.style.borderColor = '#ddd';
                            stitchCountSelect.style.boxShadow = 'none';
                        }, 1000);
                    });
                    
                    CapEmbroideryController.state.ui.stitchCountSelector = stitchCountSelect;
                    console.log('[CAP-CONTROLLER] Stitch count selector enhanced');
                }
            }
        },

        // Validation Module (from cap-embroidery-validation.js)
        ValidationManager: {
            /**
             * Validate if product is a cap
             */
            isValidCapProduct(productTitle = '') {
                if (!productTitle) {
                    const titleElement = document.querySelector('#product-title, #product-title-context, .product-title');
                    productTitle = titleElement ? titleElement.textContent.trim() : '';
                }
                
                const capKeywords = ['cap', 'hat', 'beanie', 'visor', 'snapback', 'trucker', 'fitted'];
                const productLower = productTitle.toLowerCase();
                
                return capKeywords.some(keyword => productLower.includes(keyword));
            },

            /**
             * Show warning for non-cap products
             */
            showNonCapWarning(productTitle) {
                console.log('[CAP-CONTROLLER] Showing non-cap product warning');
                alert(`Warning: "${productTitle}" may not be a cap product. Cap embroidery pricing may not be appropriate for this item.`);
            },

            /**
             * Validate product before add to cart
             */
            validateBeforeAddToCart() {
                const productTitle = document.querySelector('#product-title, #product-title-context, .product-title')?.textContent.trim() || '';
                
                if (!CapEmbroideryController.ValidationManager.isValidCapProduct(productTitle)) {
                    CapEmbroideryController.ValidationManager.showNonCapWarning(productTitle);
                    return false;
                }
                
                return true;
            }
        },

        // Cart Integration Module (from cap-embroidery-cart-integration.js + adapter-enhanced.js)
        CartManager: {
            /**
             * Enhanced pricing calculation with back logo support
             */
            calculatePricingWithBackLogo(sizeQuantities, existingCartQuantity, pricingData) {
                console.log('[CAP-CONTROLLER] Calculating pricing with back logo support');
                
                // Get base pricing calculation
                const originalCalculatePricing = window.NWCAPricingCalculator ? window.NWCAPricingCalculator.calculatePricing : null;
                if (!originalCalculatePricing) {
                    console.error('[CAP-CONTROLLER] Original pricing calculator not found');
                    return null;
                }
                
                const basePricing = originalCalculatePricing.call(window.NWCAPricingCalculator, sizeQuantities, existingCartQuantity, pricingData);
                
                // Check if back logo is enabled
                if (!CapEmbroideryController.state.backLogo.enabled) {
                    return basePricing;
                }
                
                const backLogoDetails = {
                    enabled: true,
                    stitchCount: CapEmbroideryController.state.backLogo.stitchCount,
                    pricePerItem: CapEmbroideryController.state.backLogo.pricePerItem
                };
                
                console.log('[CAP-CONTROLLER] Adding back logo pricing:', backLogoDetails);
                
                // Add back logo price to each item
                const enhancedPricing = { ...basePricing };
                enhancedPricing.backLogoDetails = backLogoDetails;
                
                // Update items with back logo pricing
                if (enhancedPricing.items) {
                    Object.keys(enhancedPricing.items).forEach(size => {
                        const item = enhancedPricing.items[size];
                        if (item.quantity > 0) {
                            item.backLogoPrice = backLogoDetails.pricePerItem;
                            item.displayUnitPrice += backLogoDetails.pricePerItem;
                            item.itemTotal = item.displayUnitPrice * item.quantity;
                        }
                    });
                }
                
                // Calculate back logo total
                const totalQuantity = Object.values(enhancedPricing.items || {}).reduce((sum, item) => sum + (item.quantity || 0), 0);
                enhancedPricing.backLogoTotal = backLogoDetails.pricePerItem * totalQuantity;
                
                // Recalculate total price
                let newTotalPrice = 0;
                Object.values(enhancedPricing.items || {}).forEach(item => {
                    newTotalPrice += item.itemTotal || 0;
                });
                
                newTotalPrice += enhancedPricing.setupFee || 0;
                enhancedPricing.totalPrice = newTotalPrice;
                enhancedPricing.totalQuantity = totalQuantity;
                
                console.log('[CAP-CONTROLLER] Enhanced pricing with back logo:', enhancedPricing);
                return enhancedPricing;
            },

            /**
             * Enhanced add to cart handler
             */
            handleAddToCartEnhanced() {
                console.log('[CAP-CONTROLLER] Enhanced add to cart called');
                
                // Validate product first
                if (!CapEmbroideryController.ValidationManager.validateBeforeAddToCart()) {
                    return false;
                }
                
                // Store back logo details for cart
                if (CapEmbroideryController.state.backLogo.enabled) {
                    window.capEmbroideryBackLogoDetails = {
                        enabled: true,
                        stitchCount: CapEmbroideryController.state.backLogo.stitchCount,
                        pricePerItem: CapEmbroideryController.state.backLogo.pricePerItem
                    };
                }
                
                // Call original add to cart
                if (window.handleAddToCartWithValidation) {
                    return window.handleAddToCartWithValidation.call(this);
                } else if (window.handleAddToCart) {
                    return window.handleAddToCart.call(this);
                }
                
                return false;
            },

            /**
             * Override pricing calculator
             */
            overridePricingCalculator() {
                if (window.NWCAPricingCalculator) {
                    // Store original function
                    if (!window.NWCAPricingCalculator.originalCalculatePricing) {
                        window.NWCAPricingCalculator.originalCalculatePricing = window.NWCAPricingCalculator.calculatePricing;
                    }
                    
                    // Override with our enhanced version
                    window.NWCAPricingCalculator.calculatePricing = CapEmbroideryController.CartManager.calculatePricingWithBackLogo;
                    console.log('[CAP-CONTROLLER] Pricing calculator overridden with back logo support');
                }
            }
        },

        // Back Logo Management Module (from cap-embroidery-back-logo.js)
        BackLogoManager: {
            /**
             * Check if back logo is enabled
             */
            isEnabled() {
                return CapEmbroideryController.state.backLogo.enabled;
            },

            /**
             * Set back logo enabled state
             */
            setEnabled(enabled) {
                CapEmbroideryController.state.backLogo.enabled = !!enabled;
                console.log(`[CAP-CONTROLLER] Back logo ${enabled ? 'enabled' : 'disabled'}`);
                
                // Update UI visibility
                const detailsDiv = document.getElementById('back-logo-details');
                const pricingDisplayDiv = document.getElementById('back-logo-pricing-display');
                
                if (detailsDiv) {
                    detailsDiv.style.setProperty('display', enabled ? 'block' : 'none', 'important');
                }
                if (pricingDisplayDiv) {
                    pricingDisplayDiv.style.setProperty('display', enabled ? 'block' : 'none', 'important');
                }
                
                // Update pricing explanation
                CapEmbroideryController.UIManager.updatePricingExplanation();
                
                // Trigger cart total update
                if (window.updateCartTotal) {
                    window.updateCartTotal();
                }
            },

            /**
             * Get back logo price per item
             */
            getPricePerItem() {
                return CapEmbroideryController.state.backLogo.pricePerItem;
            },

            /**
             * Set back logo stitch count and update price
             */
            setStitchCount(count) {
                const numCount = parseInt(count);
                if (!isNaN(numCount) && numCount >= CAP_CONFIG.backLogo.minStitchCount) {
                    CapEmbroideryController.state.backLogo.stitchCount = numCount;
                    
                    // Calculate price: $5 base + $1 per thousand above 5000
                    const additionalThousands = Math.max(0, (numCount - CAP_CONFIG.backLogo.minStitchCount) / 1000);
                    CapEmbroideryController.state.backLogo.pricePerItem = CAP_CONFIG.backLogo.priceBase + (additionalThousands * CAP_CONFIG.backLogo.pricePerThousand);
                    
                    console.log(`[CAP-CONTROLLER] Back logo stitch count set to ${numCount}, price: $${CapEmbroideryController.state.backLogo.pricePerItem.toFixed(2)}`);
                    
                    // Update UI elements
                    CapEmbroideryController.BackLogoManager.updateUI();
                    
                    // Update pricing explanation
                    CapEmbroideryController.UIManager.updatePricingExplanation();
                    
                    // Trigger cart total update
                    if (window.updateCartTotal) {
                        window.updateCartTotal();
                    }
                }
            },

            /**
             * Update back logo UI elements
             */
            updateUI() {
                const priceDisplayElement = document.getElementById('back-logo-price');
                const displayStitchCountElement = document.getElementById('back-logo-display-stitch-count');
                const displayPriceElement = document.getElementById('back-logo-display-price');
                
                if (priceDisplayElement) {
                    priceDisplayElement.textContent = `Price: $${CapEmbroideryController.state.backLogo.pricePerItem.toFixed(2)} per item`;
                }
                
                if (displayStitchCountElement) {
                    displayStitchCountElement.textContent = `${CapEmbroideryController.state.backLogo.stitchCount.toLocaleString()} stitches`;
                }
                
                if (displayPriceElement) {
                    displayPriceElement.textContent = `$${CapEmbroideryController.state.backLogo.pricePerItem.toFixed(2)} per item`;
                }
            },

            /**
             * Initialize back logo UI
             */
            initializeUI() {
                console.log('[CAP-CONTROLLER] Initializing back logo UI');
                
                // Find and set up checkbox
                const checkbox = document.getElementById('back-logo-checkbox');
                if (checkbox) {
                    console.log('[CAP-CONTROLLER] Found back logo checkbox, attaching listener');
                    
                    // Remove existing listeners by cloning
                    const newCheckbox = checkbox.cloneNode(true);
                    checkbox.parentNode.replaceChild(newCheckbox, checkbox);
                    
                    // Add our event listener
                    newCheckbox.addEventListener('change', function() {
                        CapEmbroideryController.BackLogoManager.setEnabled(this.checked);
                    });
                    
                    // Set initial state
                    newCheckbox.checked = CapEmbroideryController.state.backLogo.enabled;
                } else {
                    console.warn('[CAP-CONTROLLER] No back logo checkbox found');
                }
                
                // Find and set up stitch count selector
                const backLogoStitchSelect = document.getElementById('back-logo-stitch-count');
                if (backLogoStitchSelect) {
                    // Remove existing listeners by cloning
                    const newSelect = backLogoStitchSelect.cloneNode(true);
                    backLogoStitchSelect.parentNode.replaceChild(newSelect, backLogoStitchSelect);
                    
                    newSelect.addEventListener('input', function() {
                        const stitchCount = parseInt(this.value);
                        console.log('[CAP-CONTROLLER] Back logo stitch count changed to:', stitchCount);
                        
                        if (!isNaN(stitchCount) && stitchCount > 0) {
                            CapEmbroideryController.BackLogoManager.setStitchCount(stitchCount);
                        }
                    });
                    
                    // Set initial value
                    const initialCount = parseInt(newSelect.value);
                    if (!isNaN(initialCount)) {
                        CapEmbroideryController.BackLogoManager.setStitchCount(initialCount);
                    }
                }

                console.log('[CAP-CONTROLLER] Back logo UI initialization complete');
            }
        },

        // Main initialization
        async initialize() {
            if (CapEmbroideryController.state.initialized) {
                console.log('[CAP-CONTROLLER] Already initialized');
                return;
            }

            console.log('[CAP-CONTROLLER] Starting initialization...');

            // Only initialize on cap embroidery pages
            const isCapEmbroidery = window.location.href.toLowerCase().includes('cap-embroidery') || 
                                   document.title.toLowerCase().includes('cap embroidery');
            
            if (!isCapEmbroidery) {
                console.log('[CAP-CONTROLLER] Not a cap embroidery page, skipping initialization');
                return;
            }

            try {
                // Wait for dependencies
                await CapEmbroideryController.waitForDependencies();
                
                // Set up event listeners
                CapEmbroideryController.setupEventListeners();
                
                // Initialize UI enhancements
                CapEmbroideryController.UIManager.enhanceStitchCountSelector();
                
                // Initialize back logo UI
                CapEmbroideryController.BackLogoManager.initializeUI();
                
                // Override pricing calculator
                CapEmbroideryController.CartManager.overridePricingCalculator();
                
                // Set up add to cart handler
                CapEmbroideryController.setupAddToCartHandler();
                
                // Start tier label checker
                CapEmbroideryController.startLabelChecker();
                
                CapEmbroideryController.state.initialized = true;
                console.log('[CAP-CONTROLLER] Initialization complete');
                
            } catch (error) {
                console.error('[CAP-CONTROLLER] Initialization failed:', error);
            }
        },

        /**
         * Wait for required dependencies
         */
        async waitForDependencies() {
            return new Promise((resolve) => {
                let checkCount = 0;
                const maxChecks = 50; // 5 seconds max
                
                const checkInterval = setInterval(() => {
                    checkCount++;
                    
                    // Check for required globals
                    const hasRequiredGlobals = window.NWCAPricingCalculator && 
                                             document.getElementById('client-stitch-count-select');
                    
                    if (hasRequiredGlobals || checkCount >= maxChecks) {
                        clearInterval(checkInterval);
                        console.log('[CAP-CONTROLLER] Dependencies ready');
                        resolve();
                    }
                }, 100);
            });
        },

        /**
         * Set up event listeners
         */
        setupEventListeners() {
            console.log('[CAP-CONTROLLER] Setting up event listeners');

            // Listen for Caspio pricing data
            document.addEventListener('caspioCapPricingCalculated', CapEmbroideryController.DataManager.handleCaspioPricingData);

            // Listen for stitch count changes
            const stitchCountSelect = document.getElementById('client-stitch-count-select');
            if (stitchCountSelect) {
                stitchCountSelect.addEventListener('change', function() {
                    console.log('[CAP-CONTROLLER] Stitch count changed to:', this.value);
                    CapEmbroideryController.DataManager.updateCapPricingDisplay();
                });
                console.log('[CAP-CONTROLLER] Stitch count listener attached');
            }

            // If master data is already available, trigger initial update
            if (CapEmbroideryController.state.masterData) {
                console.log('[CAP-CONTROLLER] Master data already available, triggering display update');
                CapEmbroideryController.DataManager.updateCapPricingDisplay();
            }
        },

        /**
         * Set up add to cart handler with delay to ensure other scripts have loaded
         */
        setupAddToCartHandler() {
            setTimeout(() => {
                const addToCartBtn = document.getElementById('add-to-cart-button');
                if (addToCartBtn) {
                    // Remove existing listeners by cloning
                    const newBtn = addToCartBtn.cloneNode(true);
                    addToCartBtn.parentNode.replaceChild(newBtn, addToCartBtn);
                    
                    // Add our enhanced listener
                    newBtn.addEventListener('click', CapEmbroideryController.CartManager.handleAddToCartEnhanced);
                    console.log('[CAP-CONTROLLER] Enhanced add to cart handler installed');
                    
                    CapEmbroideryController.state.ui.addToCartButton = newBtn;
                }
            }, 2000); // Wait for other scripts to load
        },

        /**
         * Start tier label checker with polling
         */
        startLabelChecker() {
            console.log('[CAP-CONTROLLER] Starting tier label checker');
            
            let checkCount = 0;
            const maxChecks = CAP_CONFIG.ui.maxPollingAttempts;
            
            // Check immediately
            CapEmbroideryController.DataManager.fixTierLabels();
            
            // Then set up interval
            const checkInterval = setInterval(() => {
                checkCount++;
                
                // Try to fix labels
                CapEmbroideryController.DataManager.fixTierLabels();
                
                // Stop after max checks
                if (checkCount >= maxChecks) {
                    console.log('[CAP-CONTROLLER] Max label checks reached, stopping');
                    clearInterval(checkInterval);
                }
            }, CAP_CONFIG.ui.pollingInterval);
        }
    };

    // Create compatibility globals for backward compatibility
    window.capEmbroideryBackLogo = {
        isEnabled: () => CapEmbroideryController.BackLogoManager.isEnabled(),
        setEnabled: (enabled) => CapEmbroideryController.BackLogoManager.setEnabled(enabled),
        getPricePerItem: () => CapEmbroideryController.BackLogoManager.getPricePerItem(),
        setStitchCount: (count) => CapEmbroideryController.BackLogoManager.setStitchCount(count),
        getStitchCount: () => CapEmbroideryController.state.backLogo.stitchCount,
        initializeUI: () => CapEmbroideryController.BackLogoManager.initializeUI()
    };

    // Expose main controller
    window.CapEmbroideryController = CapEmbroideryController;

    // Expose legacy adapter for compatibility
    window.CapEmbroideryAdapter = {
        APP_KEY: CAP_CONFIG.APP_KEY,
        init: CapEmbroideryController.initialize,
        updateDisplay: CapEmbroideryController.DataManager.updateCapPricingDisplay
    };

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', CapEmbroideryController.initialize);
    } else {
        // DOM is already loaded
        setTimeout(CapEmbroideryController.initialize, 100);
    }

})();