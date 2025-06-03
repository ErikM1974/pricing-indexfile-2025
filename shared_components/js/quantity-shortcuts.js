/**
 * Quantity Shortcuts Module
 * Provides quick preset quantity buttons for common order sizes
 * Part of Phase 2 Core Features
 * 
 * @namespace NWCA.ui.QuantityShortcuts
 * @requires NWCA
 */

(function() {
    'use strict';

    // Ensure NWCA namespace exists
    if (!window.NWCA || !window.NWCA.ui) {
        console.error('[QUANTITY-SHORTCUTS] NWCA.ui namespace not found. Please include nwca-namespace.js and ui-components.js first.');
        return;
    }

    const logger = NWCA.utils.logger;
    const formatters = NWCA.utils.formatters;

    logger.info('QUANTITY-SHORTCUTS', 'Initializing Quantity Shortcuts Module');

    // Quantity Shortcuts Module
    NWCA.ui.QuantityShortcuts = {
        // Configuration
        config: {
            presets: [
                { label: 'Dozen', value: 12, highlight: false },
                { label: '2 Dozen', value: 24, highlight: true, note: 'Most Popular' },
                { label: '4 Dozen', value: 48, highlight: false },
                { label: '6 Dozen', value: 72, highlight: true, note: 'Best Value' },
                { label: 'Gross', value: 144, highlight: false },
                { label: 'Custom', value: 'custom', highlight: false }
            ],
            animations: {
                duration: 300,
                easing: 'cubic-bezier(0.4, 0, 0.2, 1)'
            },
            savingsThreshold: 0.05 // Show savings if > 5% difference
        },

        // State
        state: {
            currentPreset: null,
            customMode: false,
            container: null,
            initialized: false
        },

        /**
         * Initialize the quantity shortcuts
         * @param {string|HTMLElement} container - Container selector or element
         * @param {Object} options - Configuration options
         */
        initialize(container, options = {}) {
            logger.log('QUANTITY-SHORTCUTS', 'Initializing with options:', options);

            // Merge options with config
            this.config = { ...this.config, ...options };

            // Find container
            this.state.container = typeof container === 'string' 
                ? document.querySelector(container) 
                : container;

            if (!this.state.container) {
                logger.error('QUANTITY-SHORTCUTS', 'Container not found:', container);
                return false;
            }

            // Create shortcuts UI
            this.createShortcutsUI();

            // Bind event listeners
            this.bindEventListeners();

            // Set initial state
            this.updateActiveState();

            this.state.initialized = true;
            logger.log('QUANTITY-SHORTCUTS', 'Initialization complete');

            return true;
        },

        /**
         * Create the shortcuts UI
         */
        createShortcutsUI() {
            // Create shortcuts wrapper
            const wrapper = document.createElement('div');
            wrapper.className = 'quantity-shortcuts';
            wrapper.setAttribute('role', 'group');
            wrapper.setAttribute('aria-label', 'Quick quantity selection');

            // Add title
            const title = document.createElement('div');
            title.className = 'quantity-shortcuts-title';
            title.textContent = 'Quick Select:';
            wrapper.appendChild(title);

            // Create buttons container
            const buttonsContainer = document.createElement('div');
            buttonsContainer.className = 'quantity-shortcuts-buttons';

            // Create preset buttons
            this.config.presets.forEach((preset, index) => {
                const button = this.createPresetButton(preset, index);
                buttonsContainer.appendChild(button);
            });

            wrapper.appendChild(buttonsContainer);

            // Add savings indicator
            const savingsIndicator = document.createElement('div');
            savingsIndicator.className = 'quantity-shortcuts-savings';
            savingsIndicator.id = 'quantity-shortcuts-savings';
            savingsIndicator.setAttribute('role', 'status');
            savingsIndicator.setAttribute('aria-live', 'polite');
            wrapper.appendChild(savingsIndicator);

            // Insert into container
            this.state.container.appendChild(wrapper);

            logger.log('QUANTITY-SHORTCUTS', 'UI created successfully');
        },

        /**
         * Create a preset button
         */
        createPresetButton(preset, index) {
            const button = document.createElement('button');
            button.className = 'quantity-shortcut-btn';
            if (preset.highlight) {
                button.classList.add('highlighted');
            }
            
            button.setAttribute('data-quantity', preset.value);
            button.setAttribute('data-preset-index', index);
            button.setAttribute('type', 'button');
            button.setAttribute('aria-label', `Select ${preset.label} quantity`);

            // Create button content
            const labelSpan = document.createElement('span');
            labelSpan.className = 'shortcut-label';
            labelSpan.textContent = preset.label;

            const valueSpan = document.createElement('span');
            valueSpan.className = 'shortcut-value';
            if (preset.value !== 'custom') {
                valueSpan.textContent = `(${preset.value})`;
            }

            button.appendChild(labelSpan);
            button.appendChild(valueSpan);

            // Add note if present
            if (preset.note) {
                const noteSpan = document.createElement('span');
                noteSpan.className = 'shortcut-note';
                noteSpan.textContent = preset.note;
                button.appendChild(noteSpan);
            }

            return button;
        },

        /**
         * Bind event listeners
         */
        bindEventListeners() {
            // Button click handlers
            const buttons = this.state.container.querySelectorAll('.quantity-shortcut-btn');
            buttons.forEach(button => {
                button.addEventListener('click', (e) => this.handlePresetClick(e));
            });

            // Listen for external quantity changes
            NWCA.events.on('quantityChanged', (data) => {
                this.handleExternalQuantityChange(data.quantity);
            });

            // Listen for pricing updates to calculate savings
            NWCA.events.on('pricingDataUpdated', () => {
                this.updateSavingsDisplay();
            });
        },

        /**
         * Handle preset button click
         */
        handlePresetClick(event) {
            const button = event.currentTarget;
            const value = button.getAttribute('data-quantity');
            const presetIndex = parseInt(button.getAttribute('data-preset-index'));

            logger.log('QUANTITY-SHORTCUTS', `Preset clicked: ${value}`);

            if (value === 'custom') {
                this.enterCustomMode();
            } else {
                const quantity = parseInt(value);
                this.selectQuantity(quantity, presetIndex);
            }
        },

        /**
         * Select a quantity
         */
        selectQuantity(quantity, presetIndex = null) {
            // Update active state
            this.state.currentPreset = presetIndex;
            this.state.customMode = false;

            // Try multiple methods to update quantity
            let updated = false;

            // Method 1: Use QuantityManager if available
            if (NWCA.controllers.capEmbroidery && NWCA.controllers.capEmbroidery.QuantityManager && NWCA.controllers.capEmbroidery.QuantityManager.updateQuantity) {
                NWCA.controllers.capEmbroidery.QuantityManager.updateQuantity(quantity, 'quantity-shortcuts');
                updated = true;
            }

            // Method 2: Use HeroQuantityCalculator if available
            if (window.HeroQuantityCalculator && typeof window.HeroQuantityCalculator.setQuantity === 'function') {
                logger.log('QUANTITY-SHORTCUTS', 'Using HeroQuantityCalculator.setQuantity');
                window.HeroQuantityCalculator.setQuantity(quantity);
                updated = true;
            }

            // Method 3: Fallback to direct input update
            const heroInput = document.getElementById('hero-quantity-input');
            if (heroInput && !updated) {
                logger.log('QUANTITY-SHORTCUTS', 'Using fallback input update');
                heroInput.value = quantity;
                // Try to trigger the event in a way that mimics real user input
                try {
                    // Try InputEvent first (more realistic)
                    if (window.InputEvent) {
                        const inputEvent = new InputEvent('input', { 
                            bubbles: true, 
                            cancelable: true,
                            inputType: 'insertText',
                            data: quantity.toString()
                        });
                        heroInput.dispatchEvent(inputEvent);
                    } else {
                        // Fallback to regular Event
                        const inputEvent = new Event('input', { bubbles: true, cancelable: true });
                        heroInput.dispatchEvent(inputEvent);
                    }
                } catch (e) {
                    // Final fallback
                    logger.warn('QUANTITY-SHORTCUTS', 'Error dispatching input event:', e);
                    heroInput.dispatchEvent(new Event('input', { bubbles: true }));
                }
                heroInput.dispatchEvent(new Event('change', { bubbles: true }));
            }

            // Method 4: Try to call the hero calculator's event handler directly
            if (heroInput && window.HeroQuantityCalculator) {
                logger.log('QUANTITY-SHORTCUTS', 'Attempting direct hero calculator update');
                // Simulate the input event handler behavior
                const parsedQty = parseInt(quantity) || 24;
                const clampedQty = Math.max(1, Math.min(10000, parsedQty));
                if (window.HeroQuantityCalculator.setQuantity) {
                    window.HeroQuantityCalculator.setQuantity(clampedQty);
                }
            }
            
            // Always emit the event for other components
            NWCA.events.emit('quantityChanged', {
                quantity: quantity,
                source: 'quantity-shortcuts'
            });

            // Update UI
            this.updateActiveState();
            this.animateSelection(quantity);
            this.updateSavingsDisplay();

            // Announce to screen readers
            this.announceSelection(quantity);
        },

        /**
         * Enter custom quantity mode
         */
        enterCustomMode() {
            logger.log('QUANTITY-SHORTCUTS', 'Entering custom mode');

            this.state.customMode = true;
            this.state.currentPreset = null;

            // Focus the quantity input
            const quantityInput = document.getElementById('hero-quantity-input');
            if (quantityInput) {
                quantityInput.focus();
                quantityInput.select();
            }

            // Update UI
            this.updateActiveState();

            // Show custom mode indicator
            const savingsIndicator = document.getElementById('quantity-shortcuts-savings');
            if (savingsIndicator) {
                savingsIndicator.innerHTML = '<span class="custom-mode-indicator">Enter your custom quantity above</span>';
            }
        },

        /**
         * Handle external quantity change
         */
        handleExternalQuantityChange(quantity) {
            logger.log('QUANTITY-SHORTCUTS', `External quantity change: ${quantity}`);

            // Check if it matches a preset
            const presetIndex = this.config.presets.findIndex(p => p.value === quantity);
            
            if (presetIndex !== -1) {
                this.state.currentPreset = presetIndex;
                this.state.customMode = false;
            } else {
                this.state.currentPreset = null;
                this.state.customMode = true;
            }

            this.updateActiveState();
        },

        /**
         * Update active button state
         */
        updateActiveState() {
            const buttons = this.state.container.querySelectorAll('.quantity-shortcut-btn');
            
            buttons.forEach((button, index) => {
                const isActive = (!this.state.customMode && this.state.currentPreset === index) ||
                               (this.state.customMode && button.getAttribute('data-quantity') === 'custom');
                
                button.classList.toggle('active', isActive);
                button.setAttribute('aria-pressed', isActive.toString());
            });
        },

        /**
         * Animate quantity selection
         */
        animateSelection(quantity) {
            // Get hero pricing display
            const heroPrice = document.getElementById('hero-total-price');
            const heroUnit = document.getElementById('hero-unit-price');

            if (heroPrice) {
                heroPrice.classList.add('price-updating');
                setTimeout(() => {
                    heroPrice.classList.remove('price-updating');
                }, this.config.animations.duration);
            }

            if (heroUnit) {
                heroUnit.classList.add('price-updating');
                setTimeout(() => {
                    heroUnit.classList.remove('price-updating');
                }, this.config.animations.duration);
            }
        },

        /**
         * Update savings display
         */
        updateSavingsDisplay() {
            const savingsIndicator = document.getElementById('quantity-shortcuts-savings');
            if (!savingsIndicator || this.state.customMode) return;

            // Get current quantity from various sources
            let currentQty = 24; // default
            
            // Try to get from QuantityManager first
            if (NWCA.controllers.capEmbroidery?.QuantityManager?.getCurrentQuantity) {
                currentQty = NWCA.controllers.capEmbroidery.QuantityManager.getCurrentQuantity();
            } else {
                // Fallback to hero input
                const heroInput = document.getElementById('hero-quantity-input');
                if (heroInput && heroInput.value) {
                    currentQty = parseInt(heroInput.value) || 24;
                }
            }

            // Find next tier break point
            const tierBreaks = [24, 48, 72, 144];
            const nextTier = tierBreaks.find(t => t > currentQty);

            if (nextTier) {
                // Calculate potential savings
                const savings = this.calculateSavings(currentQty, nextTier);
                
                if (savings && savings.percentSaved > this.config.savingsThreshold) {
                    // Format the savings message with both percentage and dollar amount
                    const percentText = formatters.percentage(savings.percentSaved);
                    const amountText = savings.amountSaved ? ` ($${savings.amountSaved.toFixed(2)} per item)` : '';
                    
                    savingsIndicator.innerHTML = `
                        <span class="savings-message">
                            <span class="savings-icon">💰</span>
                            Add ${nextTier - currentQty} more for ${percentText} savings${amountText}!
                        </span>
                    `;
                    savingsIndicator.classList.add('has-savings');
                } else {
                    savingsIndicator.innerHTML = '';
                    savingsIndicator.classList.remove('has-savings');
                }
            } else {
                // At maximum tier
                savingsIndicator.innerHTML = `
                    <span class="max-savings-message">
                        <span class="savings-icon">⭐</span>
                        Maximum volume discount applied!
                    </span>
                `;
                savingsIndicator.classList.add('max-savings');
            }
        },

        /**
         * Calculate potential savings
         */
        calculateSavings(currentQty, nextQty) {
            // Try to get actual pricing data
            let currentPrice = null;
            let nextPrice = null;

            // Method 1: Try to get from hero calculator state
            if (window.HeroQuantityCalculator && window.HeroQuantityCalculator.getUnitPrice) {
                // This method might not exist, but we'll try
                currentPrice = window.HeroQuantityCalculator.getUnitPrice(currentQty);
                nextPrice = window.HeroQuantityCalculator.getUnitPrice(nextQty);
            }

            // Method 2: Try to calculate from pricing data
            if (!currentPrice && window.nwcaPricingData && window.nwcaPricingData.prices) {
                const prices = window.nwcaPricingData.prices;
                const tierData = window.nwcaPricingData.tierData || {};
                
                // Find which tier each quantity falls into
                const findTierPrice = (qty) => {
                    for (const [tierKey, tierInfo] of Object.entries(tierData)) {
                        if (tierInfo.MinQuantity <= qty && qty <= tierInfo.MaxQuantity) {
                            // Get price for first size (usually OSFA for caps)
                            const firstSize = Object.keys(prices)[0];
                            return prices[firstSize]?.[tierKey];
                        }
                    }
                    return null;
                };

                currentPrice = findTierPrice(currentQty);
                nextPrice = findTierPrice(nextQty);
            }

            // Method 3: Try to read from displayed price
            if (!currentPrice) {
                const unitPriceElement = document.getElementById('hero-unit-price');
                if (unitPriceElement) {
                    const match = unitPriceElement.textContent.match(/\$(\d+\.?\d*)/);
                    if (match) {
                        currentPrice = parseFloat(match[1]);
                    }
                }
            }

            // Calculate actual savings if we have both prices
            if (currentPrice && nextPrice && currentPrice > nextPrice) {
                const percentSaved = (currentPrice - nextPrice) / currentPrice;
                const amountSaved = currentPrice - nextPrice;
                
                logger.log('QUANTITY-SHORTCUTS', 
                    `Actual savings: ${currentQty} @ $${currentPrice} → ${nextQty} @ $${nextPrice} = ${(percentSaved * 100).toFixed(1)}%`);
                
                return {
                    percentSaved: percentSaved,
                    amountSaved: amountSaved
                };
            }

            // Fallback to estimated savings if we can't calculate actual
            logger.log('QUANTITY-SHORTCUTS', 'Using estimated savings - actual pricing data not available');
            const estimatedSavings = {
                '24': { '48': 0.08, '72': 0.12 },
                '48': { '72': 0.06, '144': 0.10 },
                '72': { '144': 0.05 }
            };

            const tierBreaks = [24, 48, 72, 144];
            const currentTier = tierBreaks.slice().reverse().find(t => t <= currentQty) || 1;
            const savings = estimatedSavings[currentTier]?.[nextQty];

            if (savings) {
                return {
                    percentSaved: savings,
                    amountSaved: savings * currentPrice // Better estimate using current price
                };
            }

            return null;
        },

        /**
         * Announce selection to screen readers
         */
        announceSelection(quantity) {
            const announcement = document.createElement('div');
            announcement.className = 'sr-only';
            announcement.setAttribute('role', 'status');
            announcement.setAttribute('aria-live', 'polite');
            announcement.textContent = `Quantity updated to ${quantity} items`;

            document.body.appendChild(announcement);
            setTimeout(() => {
                document.body.removeChild(announcement);
            }, 1000);
        },

        /**
         * Destroy the shortcuts
         */
        destroy() {
            if (this.state.container) {
                const shortcuts = this.state.container.querySelector('.quantity-shortcuts');
                if (shortcuts) {
                    shortcuts.remove();
                }
            }

            this.state.initialized = false;
            logger.log('QUANTITY-SHORTCUTS', 'Destroyed');
        }
    };

    logger.log('QUANTITY-SHORTCUTS', 'Module loaded');

})();