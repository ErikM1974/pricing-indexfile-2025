/**
 * Cap Embroidery Controller V2
 * Migrated to use NWCA namespace
 * 
 * @namespace NWCA.controllers.capEmbroidery
 * @requires NWCA
 */

(function() {
    'use strict';

    // Ensure NWCA namespace exists
    if (!window.NWCA) {
        console.error('[CAP-CONTROLLER] NWCA namespace not found. Please include nwca-namespace.js first.');
        return;
    }

    const logger = NWCA.utils.logger;
    const config = NWCA.config.pricing.capEmbroidery;
    const formatters = NWCA.utils.formatters;

    logger.info('CAP-CONTROLLER', 'Initializing Cap Embroidery Controller V2');

    // Main Controller Object
    NWCA.controllers.capEmbroidery = {
        // State management
        state: {
            initialized: false,
            masterData: null,
            currentStitchCount: config.defaultStitchCount,
            backLogo: {
                enabled: false,
                stitchCount: config.backLogo.defaultStitchCount,
                pricePerItem: config.backLogo.priceBase
            },
            ui: {
                stitchCountSelector: null,
                pricingGrid: null,
                addToCartButton: null
            }
        },

        // Data Management Module
        DataManager: {
            /**
             * Formats a numeric price into a string like $X.XX
             */
            formatPrice(price) {
                return formatters.currency(price);
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
                        logger.log('CAP-CONTROLLER', 'Found "72-9999" label, changing to "72+"');
                        element.textContent = '72+';
                        found = true;
                    }
                });
                
                return found;
            },

            /**
             * Updates the custom pricing grid display based on selected stitch count
             */
            async updateCapPricingDisplay() {
                logger.log('CAP-CONTROLLER', 'updateCapPricingDisplay called');
                
                // Use error boundary if available
                if (NWCA.ui && NWCA.ui.errorBoundary) {
                    const pricingGrid = document.getElementById(NWCA.CONSTANTS?.ELEMENTS?.PRICING_GRID || 'custom-pricing-grid');
                    const gridContainer = pricingGrid ? (pricingGrid.closest('.pricing-table-container') || pricingGrid.parentElement) : null;
                    
                    await NWCA.ui.errorBoundary(
                        () => this._updateCapPricingDisplayCore(),
                        {
                            loadingContainer: gridContainer,
                            loadingMessage: NWCA.CONSTANTS?.MESSAGES?.LOADING_PRICING || 'Updating pricing...',
                            errorContainer: gridContainer,
                            errorMessage: 'Unable to update pricing. Please try again.',
                            showLoading: true
                        }
                    );
                } else {
                    // Fallback to original method
                    this._updateCapPricingDisplayCore();
                }
            },

            /**
             * Core pricing update logic
             */
            _updateCapPricingDisplayCore() {
                // Show loading indicator
                NWCA.controllers.capEmbroidery.UIManager.showLoadingIndicator();
                
                const stitchCountSelect = document.getElementById('client-stitch-count-select');
                if (!stitchCountSelect) {
                    logger.error('CAP-CONTROLLER', 'Stitch count select dropdown not found');
                    NWCA.controllers.capEmbroidery.UIManager.hideLoadingIndicator();
                    return;
                }
                
                const selectedStitchCount = stitchCountSelect.value;
                NWCA.controllers.capEmbroidery.state.currentStitchCount = selectedStitchCount;

                const masterData = NWCA.controllers.capEmbroidery.state.masterData;
                if (!masterData || !masterData.allPriceProfiles || !masterData.groupedHeaders || !masterData.tierDefinitions) {
                    logger.error('CAP-CONTROLLER', 'Master data validation failed');
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
                    logger.error('CAP-CONTROLLER', 'Pricing grid elements not found');
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

                            priceCell.textContent = (price !== undefined && price !== null) ? 
                                NWCA.controllers.capEmbroidery.DataManager.formatPrice(price) : 'N/A';
                        });
                    });
                }

                // Update pricing explanation
                NWCA.controllers.capEmbroidery.UIManager.updatePricingExplanation();
                
                // Update window.nwcaPricingData for compatibility
                if (window.nwcaPricingData && pricingDataForStitchCount) {
                    logger.log('CAP-CONTROLLER', 'Updating window.nwcaPricingData for compatibility');
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
                    NWCA.events.emit('pricingDataUpdated', { stitchCount: selectedStitchCount, prices: prices });
                    window.dispatchEvent(new CustomEvent('pricingDataUpdated', {
                        detail: { stitchCount: selectedStitchCount, prices: prices }
                    }));
                }

                // Hide loading and show success
                NWCA.controllers.capEmbroidery.UIManager.hideLoadingIndicator();
                NWCA.controllers.capEmbroidery.UIManager.showSuccessIndicator(selectedStitchCount);
                
                // Trigger cart total update
                if (window.updateCartTotal && typeof window.updateCartTotal === 'function') {
                    logger.log('CAP-CONTROLLER', 'Triggering cart total update');
                    window.updateCartTotal();
                }

                logger.log('CAP-CONTROLLER', 'Pricing display updated for stitch count:', selectedStitchCount);
            },

            /**
             * Handle Caspio pricing data event
             */
            handleCaspioPricingData(event) {
                if (event.detail && event.detail.success) {
                    logger.log('CAP-CONTROLLER', 'Received pricing data:', event.detail);
                    NWCA.controllers.capEmbroidery.state.masterData = event.detail;
                    
                    // Store in NWCA state
                    NWCA.state.pageState.pricingData = event.detail;
                    
                    // Maintain compatibility
                    window.capEmbroideryMasterData = event.detail;
                    
                    // Initial display update
                    NWCA.controllers.capEmbroidery.DataManager.updateCapPricingDisplay();
                    
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
                                    logger.log('CAP-CONTROLLER', 'Forcing pricing-matrix-capture integration');
                                    capturePricingMatrix(pricingTable, styleNumber, colorCode, embType);
                                }, 100);
                            }
                        }
                    }
                } else {
                    const errorMessage = event.detail ? event.detail.message : "Unknown error";
                    logger.error('CAP-CONTROLLER', 'Pricing data load failed:', errorMessage);
                }
            }
        },

        // Unified Quantity Manager - Single source of truth for all quantities
        QuantityManager: {
            // Current quantity state
            state: {
                selectedQuantity: NWCA.CONSTANTS ? NWCA.CONSTANTS.QUANTITIES.DEFAULT : 24,
                sizeDistribution: {},
                totalQuantity: 0
            },

            /**
             * Initialize quantity manager
             */
            initialize() {
                logger.log('CAP-CONTROLLER', 'Initializing Quantity Manager');
                this.bindQuantityListeners();
                this.syncAllQuantityDisplays();
            },

            /**
             * Update selected quantity from any source
             * @param {number} quantity - New quantity
             * @param {string} source - Source of update (hero, grid, quote, etc.)
             */
            updateQuantity(quantity, source = 'unknown') {
                const newQty = parseInt(quantity);
                const CONSTANTS = NWCA.CONSTANTS || {};
                const minQty = CONSTANTS.QUANTITIES?.MIN || 1;
                const maxQty = CONSTANTS.QUANTITIES?.MAX || 10000;
                
                if (isNaN(newQty) || newQty < minQty || newQty > maxQty) {
                    logger.warn('CAP-CONTROLLER', `Invalid quantity: ${quantity} from ${source}`);
                    return false;
                }

                logger.log('CAP-CONTROLLER', `Quantity updated to ${newQty} from ${source}`);
                this.state.selectedQuantity = newQty;
                
                // Emit quantity change event
                NWCA.events.emit('quantityChanged', {
                    quantity: newQty,
                    source: source,
                    hasLTM: this.hasLTMFee(newQty)
                });

                // Sync all displays
                this.syncAllQuantityDisplays();
                
                return true;
            },

            /**
             * Check if quantity has LTM fee
             */
            hasLTMFee(quantity) {
                const ltmThreshold = NWCA.CONSTANTS?.QUANTITIES?.LTM_THRESHOLD || 24;
                return quantity < ltmThreshold;
            },

            /**
             * Get current quantity
             */
            getCurrentQuantity() {
                return this.state.selectedQuantity;
            },

            /**
             * Sync all quantity displays
             */
            syncAllQuantityDisplays() {
                const quantity = this.state.selectedQuantity;
                
                // Update hero quantity input
                const heroInput = document.getElementById(NWCA.CONSTANTS?.ELEMENTS?.HERO_QUANTITY_INPUT || 'hero-quantity-input');
                if (heroInput && heroInput.value != quantity) {
                    heroInput.value = quantity;
                }

                // Update any other quantity displays
                document.querySelectorAll('[data-quantity-display]').forEach(el => {
                    el.textContent = quantity;
                });

                logger.log('CAP-CONTROLLER', `All quantity displays synced to ${quantity}`);
            },

            /**
             * Bind listeners to quantity inputs
             */
            bindQuantityListeners() {
                // Hero quantity input
                const heroInput = document.getElementById(NWCA.CONSTANTS?.ELEMENTS?.HERO_QUANTITY_INPUT || 'hero-quantity-input');
                if (heroInput) {
                    heroInput.addEventListener('change', (e) => {
                        this.updateQuantity(e.target.value, 'hero-input');
                    });
                }

                // Listen for quantity change events from other sources
                NWCA.events.on('externalQuantityUpdate', (data) => {
                    this.updateQuantity(data.quantity, data.source || 'external');
                });
            }
        },

        // UI Management Module
        UIManager: {
            /**
             * Show loading indicator for pricing updates
             */
            showLoadingIndicator() {
                const pricingGrid = document.getElementById(NWCA.CONSTANTS?.ELEMENTS?.PRICING_GRID || 'custom-pricing-grid');
                if (!pricingGrid) return;
                
                // Use new UI component if available
                if (NWCA.ui && NWCA.ui.LoadingOverlay) {
                    const gridContainer = pricingGrid.closest('.pricing-table-container') || pricingGrid.parentElement;
                    NWCA.ui.LoadingOverlay.show(gridContainer, NWCA.CONSTANTS?.MESSAGES?.LOADING_PRICING || 'Updating pricing...', { blur: true });
                } else {
                    // Fallback to old method
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
                        
                        const gridContainer = pricingGrid.closest('.pricing-table-container') || pricingGrid.parentElement;
                        if (gridContainer) {
                            gridContainer.style.position = 'relative';
                            gridContainer.appendChild(loadingOverlay);
                        }
                    }
                    loadingOverlay.style.display = 'flex';
                }
            },

            /**
             * Hide loading indicator
             */
            hideLoadingIndicator() {
                // Use new UI component if available
                if (NWCA.ui && NWCA.ui.LoadingOverlay) {
                    const pricingGrid = document.getElementById(NWCA.CONSTANTS?.ELEMENTS?.PRICING_GRID || 'custom-pricing-grid');
                    if (pricingGrid) {
                        const gridContainer = pricingGrid.closest('.pricing-table-container') || pricingGrid.parentElement;
                        NWCA.ui.LoadingOverlay.hide(gridContainer);
                    }
                } else {
                    // Fallback to old method
                    const loadingOverlay = document.getElementById('pricing-loading-overlay');
                    if (loadingOverlay) {
                        loadingOverlay.style.display = 'none';
                    }
                }
            },

            /**
             * Show success indicator
             */
            showSuccessIndicator(stitchCount) {
                const formattedStitchCount = formatters.number(parseInt(stitchCount, 10));
                
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
                }, NWCA.config.ui.successDisplayDuration);
            },

            /**
             * Update pricing explanation text
             */
            updatePricingExplanation() {
                const pricingExplanationP = document.querySelector('.pricing-explanation p');
                if (pricingExplanationP) {
                    const formattedStitchCount = formatters.number(parseInt(NWCA.controllers.capEmbroidery.state.currentStitchCount, 10));
                    let explanationText = `<strong>Note:</strong> Prices shown are per item and include a ${formattedStitchCount} stitch embroidered logo.`;
                    
                    // Add back logo information if enabled
                    if (NWCA.controllers.capEmbroidery.state.backLogo.enabled) {
                        const backLogoStitchCount = NWCA.controllers.capEmbroidery.state.backLogo.stitchCount;
                        const backLogoPrice = NWCA.controllers.capEmbroidery.state.backLogo.pricePerItem;
                        const formattedBackStitchCount = formatters.number(backLogoStitchCount);
                        explanationText = `<strong>Note:</strong> Prices shown are per item and include a ${formattedStitchCount} stitch embroidered logo. <span style="color: var(--primary-color); font-weight: bold;">Back logo (${formattedBackStitchCount} stitches) adds ${formatters.currency(backLogoPrice)} per item.</span>`;
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
                    logger.log('CAP-CONTROLLER', 'Enhancing stitch count selector');
                    
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
                    
                    NWCA.controllers.capEmbroidery.state.ui.stitchCountSelector = stitchCountSelect;
                    logger.log('CAP-CONTROLLER', 'Stitch count selector enhanced');
                }
            }
        },

        // Back Logo Management Module
        BackLogoManager: {
            /**
             * Check if back logo is enabled
             */
            isEnabled() {
                return NWCA.controllers.capEmbroidery.state.backLogo.enabled;
            },

            /**
             * Set back logo enabled state
             */
            setEnabled(enabled) {
                NWCA.controllers.capEmbroidery.state.backLogo.enabled = !!enabled;
                logger.log('CAP-CONTROLLER', `Back logo ${enabled ? 'enabled' : 'disabled'}`);
                
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
                NWCA.controllers.capEmbroidery.UIManager.updatePricingExplanation();
                
                // Emit event
                NWCA.events.emit('backLogoStateChanged', { enabled });
                
                // Trigger cart total update
                if (window.updateCartTotal) {
                    window.updateCartTotal();
                }
            },

            /**
             * Get back logo price per item
             */
            getPricePerItem() {
                return NWCA.controllers.capEmbroidery.state.backLogo.pricePerItem;
            },

            /**
             * Increment back logo stitch count by step amount
             */
            incrementStitchCount() {
                const currentCount = NWCA.controllers.capEmbroidery.state.backLogo.stitchCount;
                const newCount = currentCount + config.backLogo.incrementStep;
                if (newCount <= config.backLogo.maxStitchCount) {
                    NWCA.controllers.capEmbroidery.BackLogoManager.setStitchCount(newCount);
                    return true;
                }
                return false;
            },

            /**
             * Decrement back logo stitch count by step amount
             */
            decrementStitchCount() {
                const currentCount = NWCA.controllers.capEmbroidery.state.backLogo.stitchCount;
                const newCount = currentCount - config.backLogo.incrementStep;
                if (newCount >= config.backLogo.minStitchCount) {
                    NWCA.controllers.capEmbroidery.BackLogoManager.setStitchCount(newCount);
                    return true;
                }
                return false;
            },

            /**
             * Set back logo stitch count and update price
             */
            setStitchCount(count) {
                const numCount = parseInt(count);
                if (!isNaN(numCount) && numCount >= config.backLogo.minStitchCount && numCount <= config.backLogo.maxStitchCount) {
                    NWCA.controllers.capEmbroidery.state.backLogo.stitchCount = numCount;
                    
                    // Calculate price
                    const additionalThousands = Math.max(0, (numCount - config.backLogo.minStitchCount) / 1000);
                    NWCA.controllers.capEmbroidery.state.backLogo.pricePerItem = 
                        config.backLogo.priceBase + (additionalThousands * config.backLogo.pricePerThousand);
                    
                    logger.log('CAP-CONTROLLER', 
                        `Back logo stitch count set to ${numCount}, price: ${formatters.currency(NWCA.controllers.capEmbroidery.state.backLogo.pricePerItem)}`);
                    
                    // Update UI elements
                    NWCA.controllers.capEmbroidery.BackLogoManager.updateUI();
                    
                    // Update pricing explanation
                    NWCA.controllers.capEmbroidery.UIManager.updatePricingExplanation();
                    
                    // Emit event
                    NWCA.events.emit('backLogoStitchCountChanged', {
                        stitchCount: numCount,
                        price: NWCA.controllers.capEmbroidery.state.backLogo.pricePerItem
                    });
                    
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
                const stitchDisplayElement = document.getElementById('back-logo-stitch-display');
                
                const price = NWCA.controllers.capEmbroidery.state.backLogo.pricePerItem;
                const stitchCount = NWCA.controllers.capEmbroidery.state.backLogo.stitchCount;
                
                // Update old elements for backward compatibility
                if (priceDisplayElement) {
                    priceDisplayElement.textContent = `Price: ${formatters.currency(price)} per item`;
                }
                
                if (displayStitchCountElement) {
                    displayStitchCountElement.textContent = `${formatters.number(stitchCount)} stitches`;
                }
                
                if (displayPriceElement) {
                    displayPriceElement.textContent = `${formatters.currency(price)} per item`;
                }
                
                // Update new increment arrow display
                if (stitchDisplayElement) {
                    stitchDisplayElement.textContent = formatters.number(stitchCount);
                }
            },

            /**
             * Initialize back logo UI
             */
            initializeUI() {
                logger.log('CAP-CONTROLLER', 'Initializing back logo UI');
                
                // Find and set up checkbox
                const checkbox = document.getElementById('back-logo-checkbox');
                if (checkbox) {
                    logger.log('CAP-CONTROLLER', 'Found back logo checkbox, attaching listener');
                    
                    // Remove existing listeners by cloning
                    const newCheckbox = checkbox.cloneNode(true);
                    checkbox.parentNode.replaceChild(newCheckbox, checkbox);
                    
                    // Add our event listener
                    newCheckbox.addEventListener('change', function() {
                        NWCA.controllers.capEmbroidery.BackLogoManager.setEnabled(this.checked);
                    });
                    
                    // Set initial state
                    newCheckbox.checked = NWCA.controllers.capEmbroidery.state.backLogo.enabled;
                } else {
                    logger.warn('CAP-CONTROLLER', 'No back logo checkbox found');
                }
                
                // Find and set up increment arrows
                const incrementBtn = document.getElementById('back-logo-increment');
                const decrementBtn = document.getElementById('back-logo-decrement');
                
                if (incrementBtn && decrementBtn) {
                    logger.log('CAP-CONTROLLER', 'Found increment arrows, attaching listeners');
                    
                    // Remove existing listeners by cloning
                    const newIncrementBtn = incrementBtn.cloneNode(true);
                    const newDecrementBtn = decrementBtn.cloneNode(true);
                    incrementBtn.parentNode.replaceChild(newIncrementBtn, incrementBtn);
                    decrementBtn.parentNode.replaceChild(newDecrementBtn, decrementBtn);
                    
                    // Add increment listener
                    newIncrementBtn.addEventListener('click', function() {
                        NWCA.controllers.capEmbroidery.BackLogoManager.incrementStitchCount();
                    });
                    
                    // Add decrement listener
                    newDecrementBtn.addEventListener('click', function() {
                        NWCA.controllers.capEmbroidery.BackLogoManager.decrementStitchCount();
                    });
                } else {
                    logger.warn('CAP-CONTROLLER', 'Increment arrow buttons not found');
                }
                
                // Set initial stitch count
                NWCA.controllers.capEmbroidery.BackLogoManager.setStitchCount(config.backLogo.defaultStitchCount);

                logger.log('CAP-CONTROLLER', 'Back logo UI initialization complete');
            }
        },

        // Validation Module
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
                logger.log('CAP-CONTROLLER', 'Showing non-cap product warning');
                alert(`Warning: "${productTitle}" may not be a cap product. Cap embroidery pricing may not be appropriate for this item.`);
            },

            /**
             * Validate product before add to cart
             */
            validateBeforeAddToCart() {
                const productTitle = document.querySelector('#product-title, #product-title-context, .product-title')?.textContent.trim() || '';
                
                if (!NWCA.controllers.capEmbroidery.ValidationManager.isValidCapProduct(productTitle)) {
                    NWCA.controllers.capEmbroidery.ValidationManager.showNonCapWarning(productTitle);
                    return false;
                }
                
                return true;
            }
        },

        // Cart Integration Module (Quote-only workflow)
        CartManager: {
            /**
             * Enhanced pricing calculation with back logo support
             */
            calculatePricingWithBackLogo(sizeQuantities, existingCartQuantity, pricingData) {
                logger.log('CAP-CONTROLLER', 'Calculating pricing with back logo support');
                
                // Get base pricing calculation
                const originalCalculatePricing = window.NWCAPricingCalculator ? window.NWCAPricingCalculator.calculatePricing : null;
                if (!originalCalculatePricing) {
                    logger.error('CAP-CONTROLLER', 'Original pricing calculator not found');
                    return null;
                }
                
                const basePricing = originalCalculatePricing.call(window.NWCAPricingCalculator, sizeQuantities, existingCartQuantity, pricingData);
                
                // Check if back logo is enabled
                if (!NWCA.controllers.capEmbroidery.state.backLogo.enabled) {
                    return basePricing;
                }
                
                const backLogoDetails = {
                    enabled: true,
                    stitchCount: NWCA.controllers.capEmbroidery.state.backLogo.stitchCount,
                    pricePerItem: NWCA.controllers.capEmbroidery.state.backLogo.pricePerItem
                };
                
                logger.log('CAP-CONTROLLER', 'Adding back logo pricing:', backLogoDetails);
                
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
                
                logger.log('CAP-CONTROLLER', 'Enhanced pricing with back logo:', enhancedPricing);
                return enhancedPricing;
            },

            /**
             * Enhanced quote request handler
             */
            handleAddToCartEnhanced() {
                logger.log('CAP-CONTROLLER', 'Quote request initiated');
                
                // Validate product first
                if (!NWCA.controllers.capEmbroidery.ValidationManager.validateBeforeAddToCart()) {
                    return false;
                }
                
                // Prepare quote details with back logo support
                const quoteDetails = {
                    productTitle: document.querySelector('#product-title-context, #product-title, .product-title')?.textContent?.trim() || 'Cap Product',
                    styleNumber: window.selectedStyleNumber || 'Unknown',
                    colorName: window.selectedColorName || 'Unknown',
                    stitchCount: NWCA.controllers.capEmbroidery.state.currentStitchCount,
                    backLogo: null
                };
                
                // Include back logo details if enabled
                if (NWCA.controllers.capEmbroidery.state.backLogo.enabled) {
                    quoteDetails.backLogo = {
                        enabled: true,
                        stitchCount: NWCA.controllers.capEmbroidery.state.backLogo.stitchCount,
                        pricePerItem: NWCA.controllers.capEmbroidery.state.backLogo.pricePerItem
                    };
                }
                
                // Trigger quote request
                return NWCA.controllers.capEmbroidery.QuoteManager.requestQuote(quoteDetails);
            },

            /**
             * Override pricing calculator for quote workflow
             */
            overridePricingCalculator() {
                if (window.NWCAPricingCalculator) {
                    // Store original function
                    if (!window.NWCAPricingCalculator.originalCalculatePricing) {
                        window.NWCAPricingCalculator.originalCalculatePricing = window.NWCAPricingCalculator.calculatePricing;
                    }
                    
                    // Override with our enhanced version
                    window.NWCAPricingCalculator.calculatePricing = NWCA.controllers.capEmbroidery.CartManager.calculatePricingWithBackLogo;
                    logger.log('CAP-CONTROLLER', 'Pricing calculator overridden for quote workflow with back logo support');
                }
            }
        },

        // Quote Management Module
        QuoteManager: {
            /**
             * Request quote with product and customization details
             */
            requestQuote(quoteDetails) {
                logger.log('CAP-CONTROLLER', 'Processing quote request with details:', quoteDetails);
                
                try {
                    // Build comprehensive quote information
                    const quoteInfo = NWCA.controllers.capEmbroidery.QuoteManager.buildQuoteInfo(quoteDetails);
                    
                    // Display quote request modal
                    NWCA.controllers.capEmbroidery.QuoteManager.showQuoteRequestModal(quoteInfo);
                    
                    // Emit quote request event
                    NWCA.events.emit('quoteRequested', quoteInfo);
                    
                    return true;
                } catch (error) {
                    logger.error('CAP-CONTROLLER', 'Quote request failed:', error);
                    alert('Unable to process quote request. Please contact us directly.');
                    return false;
                }
            },

            /**
             * Build comprehensive quote information
             */
            buildQuoteInfo(quoteDetails) {
                const quoteInfo = {
                    timestamp: new Date().toISOString(),
                    quoteId: NWCA.utils.generateId('quote'),
                    productInfo: {
                        title: quoteDetails.productTitle,
                        styleNumber: quoteDetails.styleNumber,
                        colorName: quoteDetails.colorName
                    },
                    embroideryDetails: {
                        frontStitchCount: quoteDetails.stitchCount,
                        backLogo: quoteDetails.backLogo
                    },
                    pageUrl: window.location.href,
                    contactInfo: NWCA.config.api.contactInfo || {
                        phone: '253-922-5793',
                        email: 'sales@nwcustomapparel.com'
                    }
                };

                logger.log('CAP-CONTROLLER', 'Built quote info:', quoteInfo);
                return quoteInfo;
            },

            /**
             * Show quote request modal with pre-filled information
             */
            showQuoteRequestModal(quoteInfo) {
                const modal = document.createElement('div');
                modal.style.cssText = `
                    position: fixed; top: 0; left: 0; right: 0; bottom: 0;
                    background: rgba(0,0,0,0.6); z-index: 10000;
                    display: flex; align-items: center; justify-content: center;
                    padding: 20px;
                `;
                
                // Build embroidery details description
                let embroideryDescription = `${formatters.number(quoteInfo.embroideryDetails.frontStitchCount)} stitch front embroidery`;
                if (quoteInfo.embroideryDetails.backLogo && quoteInfo.embroideryDetails.backLogo.enabled) {
                    embroideryDescription += ` + ${formatters.number(quoteInfo.embroideryDetails.backLogo.stitchCount)} stitch back logo`;
                }

                // Build email subject and body
                const emailSubject = `Cap Embroidery Quote Request - ${quoteInfo.productInfo.styleNumber}`;
                const emailBody = `Hi! I would like to request a quote for cap embroidery.

Product Details:
- Style: ${quoteInfo.productInfo.styleNumber}
- Product: ${quoteInfo.productInfo.title}
- Color: ${quoteInfo.productInfo.colorName}

Embroidery Details:
- ${embroideryDescription}

Please provide pricing for:
- Quantity: [Please specify quantity needed]
- Timeline: [Please specify when needed]

Additional notes:
[Any special requirements or questions]

Thank you!

---
Quote ID: ${quoteInfo.quoteId}
Quote requested from: ${quoteInfo.pageUrl}
Date: ${new Date(quoteInfo.timestamp).toLocaleString()}`;

                modal.innerHTML = `
                    <div style="
                        background: white; border-radius: 12px; padding: 30px;
                        max-width: 500px; width: 100%; max-height: 90vh; overflow-y: auto;
                        box-shadow: 0 8px 32px rgba(0,0,0,0.3);
                    ">
                        <h3 style="margin: 0 0 20px 0; color: #2e5827; font-size: 1.5em; text-align: center;">🧵 Request Cap Embroidery Quote</h3>
                        
                        <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #2e5827;">
                            <h4 style="margin: 0 0 10px 0; color: #2e5827;">Product Details:</h4>
                            <p style="margin: 0 0 5px 0;"><strong>Style:</strong> ${quoteInfo.productInfo.styleNumber}</p>
                            <p style="margin: 0 0 5px 0;"><strong>Product:</strong> ${quoteInfo.productInfo.title}</p>
                            <p style="margin: 0 0 5px 0;"><strong>Color:</strong> ${quoteInfo.productInfo.colorName}</p>
                            <p style="margin: 0;"><strong>Embroidery:</strong> ${embroideryDescription}</p>
                        </div>

                        <div style="margin-bottom: 20px;">
                            <h4 style="margin: 0 0 10px 0; color: #333;">Choose how to request your quote:</h4>
                        </div>

                        <div style="display: flex; flex-direction: column; gap: 12px;">
                            <button onclick="window.location.href='mailto:${quoteInfo.contactInfo.email}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}'; this.closest('div[style*=\\"position: fixed\\"]').remove();" style="
                                background: #2e5827; color: white; border: none;
                                padding: 15px 20px; border-radius: 8px; cursor: pointer;
                                font-weight: bold; font-size: 1.1em;
                                transition: background 0.2s ease;
                            " onmouseover="this.style.background='#1e3a1b'" onmouseout="this.style.background='#2e5827'">
                                ✉️ Email Quote Request
                            </button>
                            
                            <button onclick="window.location.href='tel:${quoteInfo.contactInfo.phone}'; this.closest('div[style*=\\"position: fixed\\"]').remove();" style="
                                background: #007bff; color: white; border: none;
                                padding: 15px 20px; border-radius: 8px; cursor: pointer;
                                font-weight: bold; font-size: 1.1em;
                                transition: background 0.2s ease;
                            " onmouseover="this.style.background='#0056b3'" onmouseout="this.style.background='#007bff'">
                                📞 Call ${quoteInfo.contactInfo.phone}
                            </button>
                            
                            <button onclick="navigator.clipboard.writeText(\`${emailBody.replace(/`/g, '\\`')}\`).then(() => alert('Quote details copied to clipboard!')); this.closest('div[style*=\\"position: fixed\\"]').remove();" style="
                                background: #6c757d; color: white; border: none;
                                padding: 12px 20px; border-radius: 8px; cursor: pointer;
                                font-weight: bold; transition: background 0.2s ease;
                            " onmouseover="this.style.background='#545b62'" onmouseout="this.style.background='#6c757d'">
                                📋 Copy Quote Details
                            </button>
                        </div>

                        <div style="margin-top: 20px; text-align: center;">
                            <button onclick="this.closest('div[style*=\\"position: fixed\\"]').remove()" style="
                                background: none; border: 1px solid #ccc; color: #666;
                                padding: 8px 16px; border-radius: 6px; cursor: pointer;
                            ">Cancel</button>
                        </div>

                        <div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #eee; font-size: 0.9em; color: #666; text-align: center;">
                            <p style="margin: 0;">Northwest Custom Apparel • Family Owned Since 1977</p>
                            <p style="margin: 5px 0 0 0;">📍 Milton, WA • Hours: 9AM-5PM</p>
                        </div>
                    </div>
                `;
                
                document.body.appendChild(modal);
                
                // Store quote info
                if (NWCA.config.features.localStorage) {
                    const recentQuotes = NWCA.storage.get('recentQuotes', []);
                    recentQuotes.unshift(quoteInfo);
                    // Keep only last 10 quotes
                    if (recentQuotes.length > 10) {
                        recentQuotes.length = 10;
                    }
                    NWCA.storage.set('recentQuotes', recentQuotes);
                }
                
                // Close on background click
                modal.addEventListener('click', (e) => {
                    if (e.target === modal) {
                        document.body.removeChild(modal);
                    }
                });

                logger.log('CAP-CONTROLLER', 'Quote request modal displayed');
            }
        },

        // Main initialization
        async initialize() {
            if (NWCA.controllers.capEmbroidery.state.initialized) {
                logger.log('CAP-CONTROLLER', 'Already initialized');
                return;
            }

            logger.log('CAP-CONTROLLER', 'Starting initialization...');

            // Only initialize on cap embroidery pages
            const isCapEmbroidery = window.location.href.toLowerCase().includes('cap-embroidery') || 
                                   document.title.toLowerCase().includes('cap embroidery');
            
            if (!isCapEmbroidery) {
                logger.log('CAP-CONTROLLER', 'Not a cap embroidery page, skipping initialization');
                return;
            }

            // Set page type
            NWCA.state.pageType = 'cap-embroidery';

            try {
                // Wait for dependencies
                await NWCA.controllers.capEmbroidery.waitForDependencies();
                
                // Set up event listeners
                NWCA.controllers.capEmbroidery.setupEventListeners();
                
                // Initialize UI enhancements
                NWCA.controllers.capEmbroidery.UIManager.enhanceStitchCountSelector();
                
                // Initialize Quantity Manager
                NWCA.controllers.capEmbroidery.QuantityManager.initialize();
                
                // Initialize back logo UI
                NWCA.controllers.capEmbroidery.BackLogoManager.initializeUI();
                
                // Override pricing calculator
                NWCA.controllers.capEmbroidery.CartManager.overridePricingCalculator();
                
                // Set up add to cart handler
                NWCA.controllers.capEmbroidery.setupAddToCartHandler();
                
                // Start tier label checker
                NWCA.controllers.capEmbroidery.startLabelChecker();
                
                NWCA.controllers.capEmbroidery.state.initialized = true;
                logger.log('CAP-CONTROLLER', 'Initialization complete');
                
                // Emit initialization complete event
                NWCA.events.emit('capEmbroideryInitialized', {
                    state: NWCA.controllers.capEmbroidery.state
                });
                
            } catch (error) {
                logger.error('CAP-CONTROLLER', 'Initialization failed:', error);
            }
        },

        /**
         * Wait for required dependencies
         */
        async waitForDependencies() {
            return new Promise((resolve) => {
                let checkCount = 0;
                const maxChecks = NWCA.CONSTANTS?.UI?.MAX_POLLING_ATTEMPTS || 50;
                
                const checkInterval = setInterval(() => {
                    checkCount++;
                    
                    // Check for required globals
                    const stitchCountId = NWCA.CONSTANTS?.ELEMENTS?.STITCH_COUNT_SELECT || 'client-stitch-count-select';
                    const hasRequiredGlobals = window.NWCAPricingCalculator && 
                                             document.getElementById(stitchCountId);
                    
                    if (hasRequiredGlobals || checkCount >= maxChecks) {
                        clearInterval(checkInterval);
                        logger.log('CAP-CONTROLLER', 'Dependencies ready');
                        resolve();
                    }
                }, 100);
            });
        },

        /**
         * Set up event listeners
         */
        setupEventListeners() {
            logger.log('CAP-CONTROLLER', 'Setting up event listeners');

            // Listen for Caspio pricing data
            document.addEventListener('caspioCapPricingCalculated', NWCA.controllers.capEmbroidery.DataManager.handleCaspioPricingData);

            // Listen for stitch count changes
            const stitchCountSelect = document.getElementById('client-stitch-count-select');
            if (stitchCountSelect) {
                stitchCountSelect.addEventListener('change', function() {
                    logger.log('CAP-CONTROLLER', 'Stitch count changed to:', this.value);
                    NWCA.controllers.capEmbroidery.DataManager.updateCapPricingDisplay();
                });
                logger.log('CAP-CONTROLLER', 'Stitch count listener attached');
            }

            // If master data is already available, trigger initial update
            if (NWCA.controllers.capEmbroidery.state.masterData) {
                logger.log('CAP-CONTROLLER', 'Master data already available, triggering display update');
                NWCA.controllers.capEmbroidery.DataManager.updateCapPricingDisplay();
            }
        },

        /**
         * Set up quote request handler
         */
        setupAddToCartHandler() {
            setTimeout(() => {
                // Look for various button IDs that might be used
                const buttonSelectors = [
                    '#add-to-cart-button',
                    '#request-quote-button', 
                    '.add-to-cart-btn',
                    '.request-quote-btn',
                    'button[onclick*="addToCart"]',
                    'button[onclick*="handleAddToCart"]'
                ];
                
                let targetButton = null;
                for (const selector of buttonSelectors) {
                    targetButton = document.querySelector(selector);
                    if (targetButton) break;
                }
                
                if (targetButton) {
                    // Update button text to reflect quote workflow
                    const currentText = targetButton.textContent.trim();
                    if (currentText.toLowerCase().includes('cart')) {
                        targetButton.textContent = currentText.replace(/add to cart/i, 'Request Quote')
                                                                .replace(/cart/i, 'Quote');
                    } else if (!currentText.toLowerCase().includes('quote')) {
                        targetButton.textContent = 'Request Quote';
                    }
                    
                    // Remove existing listeners by cloning
                    const newBtn = targetButton.cloneNode(true);
                    targetButton.parentNode.replaceChild(newBtn, targetButton);
                    
                    // Add our enhanced quote listener
                    newBtn.addEventListener('click', NWCA.controllers.capEmbroidery.CartManager.handleAddToCartEnhanced);
                    logger.log('CAP-CONTROLLER', 'Quote request handler installed on button:', newBtn.textContent);
                    
                    NWCA.controllers.capEmbroidery.state.ui.addToCartButton = newBtn;
                } else {
                    logger.log('CAP-CONTROLLER', 'No cart/quote button found to convert');
                }
            }, 2000); // Wait for other scripts to load
        },

        /**
         * Start tier label checker with polling
         */
        startLabelChecker() {
            logger.log('CAP-CONTROLLER', 'Starting tier label checker');
            
            let checkCount = 0;
            const maxChecks = NWCA.CONSTANTS?.UI?.MAX_POLLING_ATTEMPTS || NWCA.config.ui.maxPollingAttempts;
            
            // Check immediately
            NWCA.controllers.capEmbroidery.DataManager.fixTierLabels();
            
            // Then set up interval
            const pollingInterval = NWCA.CONSTANTS?.UI?.POLLING_INTERVAL || NWCA.config.ui.pollingInterval;
            const checkInterval = setInterval(() => {
                checkCount++;
                
                // Try to fix labels
                NWCA.controllers.capEmbroidery.DataManager.fixTierLabels();
                
                // Stop after max checks
                if (checkCount >= maxChecks) {
                    logger.log('CAP-CONTROLLER', 'Max label checks reached, stopping');
                    clearInterval(checkInterval);
                }
            }, pollingInterval);
        }
    };

    // Create compatibility layer for legacy code
    window.capEmbroideryBackLogo = {
        isEnabled: () => NWCA.controllers.capEmbroidery.BackLogoManager.isEnabled(),
        setEnabled: (enabled) => NWCA.controllers.capEmbroidery.BackLogoManager.setEnabled(enabled),
        getPricePerItem: () => NWCA.controllers.capEmbroidery.BackLogoManager.getPricePerItem(),
        setStitchCount: (count) => NWCA.controllers.capEmbroidery.BackLogoManager.setStitchCount(count),
        getStitchCount: () => NWCA.controllers.capEmbroidery.state.backLogo.stitchCount,
        initializeUI: () => NWCA.controllers.capEmbroidery.BackLogoManager.initializeUI(),
        incrementStitchCount: () => NWCA.controllers.capEmbroidery.BackLogoManager.incrementStitchCount(),
        decrementStitchCount: () => NWCA.controllers.capEmbroidery.BackLogoManager.decrementStitchCount()
    };

    // Expose main controller for legacy compatibility
    window.CapEmbroideryController = NWCA.controllers.capEmbroidery;

    // Legacy adapter
    window.CapEmbroideryAdapter = {
        APP_KEY: config.appKey,
        init: NWCA.controllers.capEmbroidery.initialize,
        updateDisplay: NWCA.controllers.capEmbroidery.DataManager.updateCapPricingDisplay
    };

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => NWCA.controllers.capEmbroidery.initialize());
    } else {
        // DOM is already loaded
        setTimeout(() => NWCA.controllers.capEmbroidery.initialize(), 100);
    }

})();