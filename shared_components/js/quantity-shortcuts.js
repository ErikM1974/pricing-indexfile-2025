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

            // Update quantity through controller
            if (NWCA.controllers.capEmbroidery && NWCA.controllers.capEmbroidery.QuantityManager) {
                NWCA.controllers.capEmbroidery.QuantityManager.updateQuantity(quantity, 'quantity-shortcuts');
            } else {
                // Fallback: update hero input directly
                const heroInput = document.getElementById('hero-quantity-input');
                if (heroInput) {
                    heroInput.value = quantity;
                    heroInput.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }

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

            const currentQty = NWCA.controllers.capEmbroidery?.QuantityManager?.getCurrentQuantity() || 24;

            // Find next tier break point
            const tierBreaks = [24, 48, 72, 144];
            const nextTier = tierBreaks.find(t => t > currentQty);

            if (nextTier) {
                // Calculate potential savings
                const savings = this.calculateSavings(currentQty, nextTier);
                
                if (savings && savings.percentSaved > this.config.savingsThreshold) {
                    savingsIndicator.innerHTML = `
                        <span class="savings-message">
                            <span class="savings-icon">💰</span>
                            Add ${nextTier - currentQty} more for ${formatters.percent(savings.percentSaved)} savings!
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
            // This would normally pull from actual pricing data
            // For now, using estimated savings based on typical tier structures
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
                    amountSaved: savings * 100 // Placeholder calculation
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