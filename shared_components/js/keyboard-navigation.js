/**
 * Keyboard Navigation Support
 * Phase 2 Feature 5: Full keyboard accessibility for power users
 */

(function() {
    'use strict';

    console.log('[KEYBOARD-NAV] Initializing keyboard navigation support...');

    // Ensure NWCA namespace
    window.NWCA = window.NWCA || {};
    NWCA.accessibility = NWCA.accessibility || {};

    NWCA.accessibility.KeyboardNavigation = {
        config: {
            shortcuts: {
                // Navigation
                'Alt+Q': { action: 'focusQuantity', description: 'Focus quantity input' },
                'Alt+S': { action: 'focusStitchCount', description: 'Change stitch count' },
                'Alt+B': { action: 'toggleBackLogo', description: 'Toggle back logo' },
                'Alt+C': { action: 'focusColors', description: 'Browse colors' },
                'Alt+R': { action: 'requestQuote', description: 'Request quote' },
                'Alt+P': { action: 'focusPricing', description: 'View pricing table' },
                
                // Quick actions
                'Alt+1': { action: 'setQuantity12', description: 'Set quantity to 12' },
                'Alt+2': { action: 'setQuantity24', description: 'Set quantity to 24' },
                'Alt+4': { action: 'setQuantity48', description: 'Set quantity to 48' },
                'Alt+7': { action: 'setQuantity72', description: 'Set quantity to 72' },
                'Alt+G': { action: 'setQuantity144', description: 'Set quantity to gross (144)' },
                
                // Utility
                'Alt+H': { action: 'showHelp', description: 'Show keyboard shortcuts' },
                'Alt+/': { action: 'showHelp', description: 'Show keyboard shortcuts' },
                'Escape': { action: 'escape', description: 'Close dialogs/Cancel' }
            }
        },

        state: {
            isActive: false,
            currentFocus: null,
            helpPanelOpen: false,
            tabOrder: []
        },

        /**
         * Initialize keyboard navigation
         */
        initialize() {
            console.log('[KEYBOARD-NAV] Setting up keyboard navigation...');
            
            // Add skip to content link
            this.addSkipLink();
            
            // Set up keyboard event listeners
            this.setupKeyboardListeners();
            
            // Set up roving tabindex for color swatches
            this.setupRovingTabindex();
            
            // Create help panel
            this.createHelpPanel();
            
            // Enhance tab order
            this.enhanceTabOrder();
            
            // Add ARIA labels
            this.addAriaLabels();
            
            // Focus visible polyfill
            this.initFocusVisible();
        },

        /**
         * Add skip to content link
         */
        addSkipLink() {
            const skipLink = document.createElement('a');
            skipLink.href = '#main-content';
            skipLink.className = 'skip-to-content';
            skipLink.textContent = 'Skip to main content';
            document.body.insertBefore(skipLink, document.body.firstChild);
            
            // Add main content ID if not exists
            const mainContent = document.querySelector('.container');
            if (mainContent && !mainContent.id) {
                mainContent.id = 'main-content';
            }
        },

        /**
         * Set up keyboard event listeners
         */
        setupKeyboardListeners() {
            document.addEventListener('keydown', (e) => {
                // Build key combination string
                const key = this.getKeyString(e);
                
                // Check if it's a registered shortcut
                if (this.config.shortcuts[key]) {
                    e.preventDefault();
                    this.handleShortcut(this.config.shortcuts[key].action);
                }
                
                // Handle arrow key navigation
                if (this.state.currentFocus) {
                    this.handleArrowNavigation(e);
                }
            });
        },

        /**
         * Get key string from event
         */
        getKeyString(event) {
            const keys = [];
            if (event.altKey) keys.push('Alt');
            if (event.ctrlKey) keys.push('Ctrl');
            if (event.shiftKey) keys.push('Shift');
            if (event.metaKey) keys.push('Meta');
            
            // Add the actual key
            if (event.key === ' ') {
                keys.push('Space');
            } else if (event.key === '/') {
                keys.push('/');
            } else if (event.key.length === 1) {
                keys.push(event.key.toUpperCase());
            } else {
                keys.push(event.key);
            }
            
            return keys.join('+');
        },

        /**
         * Handle keyboard shortcuts
         */
        handleShortcut(action) {
            console.log('[KEYBOARD-NAV] Handling shortcut:', action);
            
            switch (action) {
                // Navigation shortcuts
                case 'focusQuantity':
                    this.focusElement('.hero-quantity-input');
                    break;
                    
                case 'focusStitchCount':
                    this.focusElement('#client-stitch-count-select');
                    break;
                    
                case 'toggleBackLogo':
                    const checkbox = document.getElementById('back-logo-checkbox');
                    if (checkbox) {
                        checkbox.click();
                        checkbox.focus();
                    }
                    break;
                    
                case 'focusColors':
                    this.focusColorSection();
                    break;
                    
                case 'requestQuote':
                    const quoteBtn = document.querySelector('.cta-btn-primary');
                    if (quoteBtn) {
                        quoteBtn.click();
                        quoteBtn.focus();
                    }
                    break;
                    
                case 'focusPricing':
                    const pricingSection = document.getElementById('pricing-details');
                    if (pricingSection) {
                        pricingSection.scrollIntoView({ behavior: 'smooth' });
                        const firstCell = pricingSection.querySelector('td');
                        if (firstCell) firstCell.focus();
                    }
                    break;
                
                // Quick quantity shortcuts
                case 'setQuantity12':
                    this.setQuantity(12);
                    break;
                case 'setQuantity24':
                    this.setQuantity(24);
                    break;
                case 'setQuantity48':
                    this.setQuantity(48);
                    break;
                case 'setQuantity72':
                    this.setQuantity(72);
                    break;
                case 'setQuantity144':
                    this.setQuantity(144);
                    break;
                
                // Utility shortcuts
                case 'showHelp':
                    this.toggleHelpPanel();
                    break;
                    
                case 'escape':
                    this.handleEscape();
                    break;
            }
        },

        /**
         * Focus element helper
         */
        focusElement(selector) {
            const element = document.querySelector(selector);
            if (element) {
                element.focus();
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        },

        /**
         * Focus color section with roving tabindex
         */
        focusColorSection() {
            const colorGrid = document.querySelector('.clean-color-grid');
            if (colorGrid) {
                colorGrid.scrollIntoView({ behavior: 'smooth', block: 'center' });
                
                // Focus first or selected swatch
                const selectedSwatch = colorGrid.querySelector('.selected');
                const targetSwatch = selectedSwatch || colorGrid.querySelector('.clean-swatch-item');
                
                if (targetSwatch) {
                    targetSwatch.setAttribute('tabindex', '0');
                    targetSwatch.focus();
                    this.state.currentFocus = 'colorGrid';
                }
            }
        },

        /**
         * Set quantity quickly
         */
        setQuantity(value) {
            const input = document.querySelector('.hero-quantity-input');
            if (input) {
                input.value = value;
                input.dispatchEvent(new Event('input'));
                input.dispatchEvent(new Event('change'));
                input.focus();
                
                // Show confirmation
                this.showQuickConfirmation(`Quantity set to ${value}`);
            }
        },

        /**
         * Handle escape key
         */
        handleEscape() {
            // Close help panel if open
            if (this.state.helpPanelOpen) {
                this.toggleHelpPanel();
                return;
            }
            
            // Clear focus
            if (document.activeElement) {
                document.activeElement.blur();
            }
        },

        /**
         * Set up roving tabindex for color swatches
         */
        setupRovingTabindex() {
            const colorGrid = document.querySelector('.clean-color-grid');
            if (!colorGrid) {
                setTimeout(() => this.setupRovingTabindex(), 1000);
                return;
            }

            // Set up grid as listbox
            colorGrid.setAttribute('role', 'listbox');
            colorGrid.setAttribute('aria-label', 'Color selection');

            // Set up mutation observer for dynamically added swatches
            const observer = new MutationObserver(() => {
                this.updateColorSwatchesTabindex();
            });

            observer.observe(colorGrid, { childList: true });
            
            // Initial setup
            this.updateColorSwatchesTabindex();
        },

        /**
         * Update color swatches tabindex
         */
        updateColorSwatchesTabindex() {
            const swatches = document.querySelectorAll('.clean-swatch-item');
            swatches.forEach((swatch, index) => {
                swatch.setAttribute('role', 'option');
                swatch.setAttribute('tabindex', index === 0 ? '0' : '-1');
                
                // Add keyboard listener
                swatch.addEventListener('keydown', (e) => this.handleColorSwatchKeydown(e));
            });
        },

        /**
         * Handle arrow navigation in color grid
         */
        handleColorSwatchKeydown(event) {
            const swatches = Array.from(document.querySelectorAll('.clean-swatch-item'));
            const currentIndex = swatches.indexOf(event.target);
            let newIndex = currentIndex;

            switch (event.key) {
                case 'ArrowRight':
                    newIndex = Math.min(currentIndex + 1, swatches.length - 1);
                    break;
                case 'ArrowLeft':
                    newIndex = Math.max(currentIndex - 1, 0);
                    break;
                case 'ArrowDown':
                    newIndex = Math.min(currentIndex + 4, swatches.length - 1); // 4 columns
                    break;
                case 'ArrowUp':
                    newIndex = Math.max(currentIndex - 4, 0);
                    break;
                case 'Enter':
                case ' ':
                    event.target.click();
                    return;
                default:
                    return;
            }

            if (newIndex !== currentIndex) {
                event.preventDefault();
                // Update tabindex
                swatches[currentIndex].setAttribute('tabindex', '-1');
                swatches[newIndex].setAttribute('tabindex', '0');
                swatches[newIndex].focus();
            }
        },

        /**
         * Handle arrow navigation
         */
        handleArrowNavigation(event) {
            if (this.state.currentFocus === 'colorGrid') {
                // Handled by handleColorSwatchKeydown
                return;
            }
            
            // Handle quantity input arrow keys
            if (document.activeElement.classList.contains('hero-quantity-input')) {
                if (event.key === 'ArrowUp') {
                    event.preventDefault();
                    this.adjustQuantity(1);
                } else if (event.key === 'ArrowDown') {
                    event.preventDefault();
                    this.adjustQuantity(-1);
                }
            }
        },

        /**
         * Adjust quantity with arrow keys
         */
        adjustQuantity(delta) {
            const input = document.querySelector('.hero-quantity-input');
            if (input) {
                const current = parseInt(input.value) || 0;
                const newValue = Math.max(0, current + delta);
                input.value = newValue;
                input.dispatchEvent(new Event('input'));
            }
        },

        /**
         * Create help panel
         */
        createHelpPanel() {
            // Create overlay
            const overlay = document.createElement('div');
            overlay.className = 'keyboard-shortcuts-overlay';
            overlay.addEventListener('click', () => this.toggleHelpPanel());
            
            // Create panel
            const panel = document.createElement('div');
            panel.className = 'keyboard-shortcuts-panel';
            panel.setAttribute('role', 'dialog');
            panel.setAttribute('aria-label', 'Keyboard shortcuts');
            
            // Build content
            panel.innerHTML = `
                <div class="shortcuts-header">
                    <h2 class="shortcuts-title">Keyboard Shortcuts</h2>
                    <button class="shortcuts-close" aria-label="Close">&times;</button>
                </div>
                <div class="shortcuts-content">
                    ${this.buildShortcutsList()}
                </div>
            `;
            
            // Add to page
            document.body.appendChild(overlay);
            document.body.appendChild(panel);
            
            // Set up close button
            panel.querySelector('.shortcuts-close').addEventListener('click', () => {
                this.toggleHelpPanel();
            });
            
            // Store references
            this.helpOverlay = overlay;
            this.helpPanel = panel;
        },

        /**
         * Build shortcuts list HTML
         */
        buildShortcutsList() {
            const categories = {
                'Navigation': ['Alt+Q', 'Alt+S', 'Alt+B', 'Alt+C', 'Alt+R', 'Alt+P'],
                'Quick Quantities': ['Alt+1', 'Alt+2', 'Alt+4', 'Alt+7', 'Alt+G'],
                'Utility': ['Alt+H', 'Alt+/', 'Escape']
            };
            
            let html = '<ul class="shortcuts-list">';
            
            for (const [category, shortcuts] of Object.entries(categories)) {
                html += `
                    <li class="shortcut-category">
                        <div class="shortcut-category-title">${category}</div>
                        <ul class="shortcuts-list">
                `;
                
                for (const shortcut of shortcuts) {
                    const info = this.config.shortcuts[shortcut];
                    const keys = shortcut.split('+').map(key => `<kbd class="key">${key}</kbd>`).join('');
                    
                    html += `
                        <li class="shortcut-item">
                            <span class="shortcut-description">${info.description}</span>
                            <span class="shortcut-keys">${keys}</span>
                        </li>
                    `;
                }
                
                html += '</ul></li>';
            }
            
            html += '</ul>';
            return html;
        },

        /**
         * Toggle help panel
         */
        toggleHelpPanel() {
            this.state.helpPanelOpen = !this.state.helpPanelOpen;
            
            if (this.state.helpPanelOpen) {
                this.helpOverlay.classList.add('show');
                this.helpPanel.classList.add('show');
                
                // Focus close button
                this.helpPanel.querySelector('.shortcuts-close').focus();
                
                // Trap focus
                this.trapFocus(this.helpPanel);
            } else {
                this.helpOverlay.classList.remove('show');
                this.helpPanel.classList.remove('show');
                
                // Release focus trap
                this.releaseFocusTrap();
            }
        },

        /**
         * Trap focus within element
         */
        trapFocus(element) {
            const focusableElements = element.querySelectorAll(
                'a[href], button, textarea, input, select, [tabindex]:not([tabindex="-1"])'
            );
            
            const firstFocusable = focusableElements[0];
            const lastFocusable = focusableElements[focusableElements.length - 1];
            
            this.focusTrapHandler = (e) => {
                if (e.key === 'Tab') {
                    if (e.shiftKey) {
                        if (document.activeElement === firstFocusable) {
                            e.preventDefault();
                            lastFocusable.focus();
                        }
                    } else {
                        if (document.activeElement === lastFocusable) {
                            e.preventDefault();
                            firstFocusable.focus();
                        }
                    }
                }
            };
            
            element.addEventListener('keydown', this.focusTrapHandler);
            element.classList.add('focus-trap-active');
        },

        /**
         * Release focus trap
         */
        releaseFocusTrap() {
            const trapped = document.querySelector('.focus-trap-active');
            if (trapped && this.focusTrapHandler) {
                trapped.removeEventListener('keydown', this.focusTrapHandler);
                trapped.classList.remove('focus-trap-active');
            }
        },

        /**
         * Show quick confirmation
         */
        showQuickConfirmation(message) {
            const confirmation = document.createElement('div');
            confirmation.className = 'keyboard-breadcrumbs';
            confirmation.textContent = message;
            document.body.appendChild(confirmation);
            
            setTimeout(() => {
                confirmation.style.opacity = '0';
                setTimeout(() => confirmation.remove(), 300);
            }, 2000);
        },

        /**
         * Enhance tab order
         */
        enhanceTabOrder() {
            // Define logical tab order
            const tabOrder = [
                '.hero-quantity-input',
                '.quantity-shortcut',
                '#client-stitch-count-select',
                '#back-logo-checkbox',
                '.clean-swatch-item',
                '.cta-btn-primary'
            ];
            
            // Add tab order indicators (for development)
            if (window.location.search.includes('debug=keyboard')) {
                tabOrder.forEach((selector, index) => {
                    const elements = document.querySelectorAll(selector);
                    elements.forEach(el => {
                        const indicator = document.createElement('span');
                        indicator.className = 'tab-order-indicator';
                        indicator.textContent = index + 1;
                        el.style.position = 'relative';
                        el.appendChild(indicator);
                    });
                });
                
                document.body.classList.add('show-tab-order');
            }
        },

        /**
         * Add ARIA labels
         */
        addAriaLabels() {
            // Quantity input
            const quantityInput = document.querySelector('.hero-quantity-input');
            if (quantityInput) {
                quantityInput.setAttribute('aria-label', 'Order quantity');
                quantityInput.setAttribute('aria-describedby', 'quantity-help');
            }
            
            // Stitch count
            const stitchSelect = document.getElementById('client-stitch-count-select');
            if (stitchSelect) {
                stitchSelect.setAttribute('aria-label', 'Front logo stitch count');
            }
            
            // Back logo
            const backLogoCheckbox = document.getElementById('back-logo-checkbox');
            if (backLogoCheckbox) {
                backLogoCheckbox.setAttribute('aria-describedby', 'back-logo-help');
            }
            
            // Pricing table
            const pricingTable = document.getElementById('custom-pricing-grid');
            if (pricingTable) {
                pricingTable.setAttribute('aria-label', 'Quantity pricing tiers');
            }
        },

        /**
         * Initialize focus visible polyfill
         */
        initFocusVisible() {
            // Simple focus-visible polyfill
            document.addEventListener('keydown', () => {
                document.body.classList.add('keyboard-mode-active');
            });
            
            document.addEventListener('mousedown', () => {
                document.body.classList.remove('keyboard-mode-active');
            });
        }
    };

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            NWCA.accessibility.KeyboardNavigation.initialize();
        });
    } else {
        setTimeout(() => NWCA.accessibility.KeyboardNavigation.initialize(), 100);
    }

    console.log('[KEYBOARD-NAV] Module loaded');

})();