/**
 * Mobile-Optimized Collapsible Menu Module
 * Provides accordion-style collapsible sections for better mobile UX
 * Part of Phase 2 Core Features
 * 
 * @namespace NWCA.ui.CollapsibleMenu
 * @requires NWCA
 */

(function() {
    'use strict';

    // Ensure NWCA namespace exists
    if (!window.NWCA || !window.NWCA.ui) {
        console.error('[COLLAPSIBLE-MENU] NWCA.ui namespace not found. Please include nwca-namespace.js and ui-components.js first.');
        return;
    }

    const logger = NWCA.utils.logger;
    const storage = NWCA.storage;

    logger.info('COLLAPSIBLE-MENU', 'Initializing Mobile Collapsible Menu Module');

    // Collapsible Menu Module
    NWCA.ui.CollapsibleMenu = {
        // Configuration
        config: {
            mobileBreakpoint: 768,
            animationDuration: 300,
            saveState: true,
            storageKey: 'nwca-collapsible-state',
            swipeThreshold: 50,
            sections: [
                { id: 'product-info', title: 'Product Information', icon: '📦', defaultOpen: true },
                { id: 'customization', title: 'Customization Options', icon: '🎨', defaultOpen: true },
                { id: 'pricing-details', title: 'Pricing Details', icon: '💰', defaultOpen: false },
                { id: 'quote-builder', title: 'Quote Builder', icon: '📋', defaultOpen: false }
            ]
        },

        // State
        state: {
            initialized: false,
            isMobile: false,
            sections: {},
            touchStartY: null,
            currentSection: null
        },

        /**
         * Initialize the collapsible menu system
         * @param {Object} options - Configuration options
         */
        initialize(options = {}) {
            logger.log('COLLAPSIBLE-MENU', 'Initializing with options:', options);

            // Merge options with config
            this.config = { ...this.config, ...options };

            // Check if mobile
            this.checkMobileStatus();

            // Initialize sections
            this.initializeSections();

            // Set up event listeners
            this.bindEventListeners();

            // Apply initial state
            this.applyInitialState();

            // Add progress indicators
            this.addProgressIndicators();

            this.state.initialized = true;
            logger.log('COLLAPSIBLE-MENU', 'Initialization complete');
        },

        /**
         * Check if device is mobile
         */
        checkMobileStatus() {
            this.state.isMobile = window.innerWidth <= this.config.mobileBreakpoint;
            logger.log('COLLAPSIBLE-MENU', `Mobile status: ${this.state.isMobile}`);
        },

        /**
         * Initialize collapsible sections
         */
        initializeSections() {
            // Only wrap sections if on mobile
            if (!this.state.isMobile) {
                logger.log('COLLAPSIBLE-MENU', 'Desktop mode - skipping section wrapping');
                return;
            }

            this.config.sections.forEach(sectionConfig => {
                const element = document.getElementById(sectionConfig.id);
                if (!element) {
                    logger.warn('COLLAPSIBLE-MENU', `Section not found: ${sectionConfig.id}`);
                    return;
                }

                // Wrap section if needed
                const wrapper = this.wrapSection(element, sectionConfig);
                
                // Add to state
                this.state.sections[sectionConfig.id] = {
                    config: sectionConfig,
                    element: element,
                    wrapper: wrapper,
                    isOpen: sectionConfig.defaultOpen,
                    isComplete: false
                };
            });
        },

        /**
         * Wrap section in collapsible container
         */
        wrapSection(element, config) {
            // Check if already wrapped
            if (element.closest('.collapsible-section')) {
                return element.closest('.collapsible-section');
            }

            // Create wrapper
            const wrapper = document.createElement('div');
            wrapper.className = 'collapsible-section';
            wrapper.id = `collapsible-${config.id}`;
            wrapper.setAttribute('data-section-id', config.id);

            // Create header
            const header = document.createElement('div');
            header.className = 'collapsible-header';
            header.innerHTML = `
                <span class="collapsible-icon">${config.icon}</span>
                <h2 class="collapsible-title">${config.title}</h2>
                <div class="collapsible-indicators">
                    <span class="progress-indicator" style="display: none;">✓</span>
                    <span class="collapse-indicator">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="6 9 12 15 18 9"></polyline>
                        </svg>
                    </span>
                </div>
            `;
            header.setAttribute('role', 'button');
            header.setAttribute('aria-expanded', config.defaultOpen ? 'true' : 'false');
            header.setAttribute('aria-controls', `${config.id}-content`);
            header.setAttribute('tabindex', '0');

            // Create content wrapper
            const content = document.createElement('div');
            content.className = 'collapsible-content';
            content.id = `${config.id}-content`;
            content.setAttribute('aria-hidden', config.defaultOpen ? 'false' : 'true');

            // Move original element into content
            element.parentNode.insertBefore(wrapper, element);
            content.appendChild(element);
            wrapper.appendChild(header);
            wrapper.appendChild(content);

            // Add initial state class
            if (config.defaultOpen) {
                wrapper.classList.add('open');
            }

            return wrapper;
        },

        /**
         * Bind event listeners
         */
        bindEventListeners() {
            // Window resize
            window.addEventListener('resize', NWCA.utils.debounce(() => {
                this.checkMobileStatus();
                this.updateDisplay();
            }, 250));

            // Section headers
            Object.values(this.state.sections).forEach(section => {
                const header = section.wrapper.querySelector('.collapsible-header');
                if (header) {
                    // Click event
                    header.addEventListener('click', () => {
                        this.toggleSection(section.config.id);
                    });

                    // Keyboard support
                    header.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            this.toggleSection(section.config.id);
                        }
                    });
                }

                // Touch events for swipe
                if (this.state.isMobile) {
                    this.addSwipeSupport(section);
                }
            });

            // Listen for form changes to update progress
            this.listenForFormChanges();
        },

        /**
         * Toggle section open/closed
         */
        toggleSection(sectionId) {
            const section = this.state.sections[sectionId];
            if (!section) return;

            const isOpening = !section.isOpen;
            
            // Update state
            section.isOpen = isOpening;

            // Update UI
            const wrapper = section.wrapper;
            const header = wrapper.querySelector('.collapsible-header');
            const content = wrapper.querySelector('.collapsible-content');

            if (isOpening) {
                // Opening
                wrapper.classList.add('opening');
                wrapper.classList.add('open');
                header.setAttribute('aria-expanded', 'true');
                content.setAttribute('aria-hidden', 'false');
                
                // Animate open
                const height = content.scrollHeight;
                content.style.height = '0px';
                content.offsetHeight; // Force reflow
                content.style.height = height + 'px';

                setTimeout(() => {
                    wrapper.classList.remove('opening');
                    content.style.height = '';
                }, this.config.animationDuration);
            } else {
                // Closing
                wrapper.classList.add('closing');
                header.setAttribute('aria-expanded', 'false');
                content.setAttribute('aria-hidden', 'true');
                
                // Animate close
                const height = content.scrollHeight;
                content.style.height = height + 'px';
                content.offsetHeight; // Force reflow
                content.style.height = '0px';

                setTimeout(() => {
                    wrapper.classList.remove('open', 'closing');
                    content.style.height = '';
                }, this.config.animationDuration);
            }

            // Save state
            if (this.config.saveState) {
                this.saveState();
            }

            // Emit event
            NWCA.events.emit('collapsibleSectionToggled', {
                sectionId: sectionId,
                isOpen: isOpening
            });

            logger.log('COLLAPSIBLE-MENU', `Section ${sectionId} ${isOpening ? 'opened' : 'closed'}`);
        },

        /**
         * Add swipe support for mobile
         */
        addSwipeSupport(section) {
            const wrapper = section.wrapper;
            let startY = 0;
            let startTime = 0;

            wrapper.addEventListener('touchstart', (e) => {
                startY = e.touches[0].clientY;
                startTime = Date.now();
            }, { passive: true });

            wrapper.addEventListener('touchend', (e) => {
                const endY = e.changedTouches[0].clientY;
                const endTime = Date.now();
                const distance = endY - startY;
                const duration = endTime - startTime;

                // Quick swipe detection
                if (duration < 300 && Math.abs(distance) > this.config.swipeThreshold) {
                    if (distance > 0 && !section.isOpen) {
                        // Swipe down - open
                        this.toggleSection(section.config.id);
                    } else if (distance < 0 && section.isOpen) {
                        // Swipe up - close
                        this.toggleSection(section.config.id);
                    }
                }
            }, { passive: true });
        },

        /**
         * Apply initial state from storage or defaults
         */
        applyInitialState() {
            if (this.config.saveState) {
                const savedState = storage.get(this.config.storageKey);
                if (savedState) {
                    Object.keys(savedState).forEach(sectionId => {
                        if (this.state.sections[sectionId]) {
                            const isOpen = savedState[sectionId];
                            if (this.state.sections[sectionId].isOpen !== isOpen) {
                                this.toggleSection(sectionId);
                            }
                        }
                    });
                }
            }
        },

        /**
         * Save current state to storage
         */
        saveState() {
            const stateToSave = {};
            Object.keys(this.state.sections).forEach(sectionId => {
                stateToSave[sectionId] = this.state.sections[sectionId].isOpen;
            });
            storage.set(this.config.storageKey, stateToSave);
        },

        /**
         * Add progress indicators
         */
        addProgressIndicators() {
            // This will be updated based on form completion
            logger.log('COLLAPSIBLE-MENU', 'Progress indicators ready');
        },

        /**
         * Listen for form changes to update progress
         */
        listenForFormChanges() {
            // Monitor quantity changes
            NWCA.events.on('quantityChanged', () => {
                this.updateSectionProgress('product-info', true);
            });

            // Monitor customization changes
            const stitchCountSelect = document.getElementById('client-stitch-count-select');
            if (stitchCountSelect) {
                stitchCountSelect.addEventListener('change', () => {
                    this.updateSectionProgress('customization', true);
                });
            }

            // Monitor back logo changes
            const backLogoCheckbox = document.getElementById('back-logo-checkbox');
            if (backLogoCheckbox) {
                backLogoCheckbox.addEventListener('change', () => {
                    this.updateSectionProgress('customization', true);
                });
            }
        },

        /**
         * Update section progress indicator
         */
        updateSectionProgress(sectionId, isComplete) {
            const section = this.state.sections[sectionId];
            if (!section) return;

            section.isComplete = isComplete;
            const indicator = section.wrapper.querySelector('.progress-indicator');
            if (indicator) {
                indicator.style.display = isComplete ? 'inline-block' : 'none';
            }

            // Update overall progress
            this.updateOverallProgress();
        },

        /**
         * Update overall progress
         */
        updateOverallProgress() {
            const total = Object.keys(this.state.sections).length;
            const completed = Object.values(this.state.sections).filter(s => s.isComplete).length;
            const progress = (completed / total) * 100;

            NWCA.events.emit('collapsibleProgressUpdated', {
                completed: completed,
                total: total,
                percentage: progress
            });
        },

        /**
         * Update display based on screen size
         */
        updateDisplay() {
            const wasMobile = document.body.classList.contains('collapsible-menu-active');
            
            if (this.state.isMobile) {
                document.body.classList.add('collapsible-menu-active');
                
                // If switching from desktop to mobile, reinitialize
                if (!wasMobile && Object.keys(this.state.sections).length === 0) {
                    this.initializeSections();
                    this.bindEventListeners();
                    this.applyInitialState();
                }
            } else {
                document.body.classList.remove('collapsible-menu-active');
                
                // If switching from mobile to desktop, unwrap sections
                if (wasMobile) {
                    this.unwrapSections();
                }
            }
        },

        /**
         * Unwrap sections for desktop mode
         */
        unwrapSections() {
            Object.values(this.state.sections).forEach(section => {
                if (section.wrapper && section.element) {
                    // Move element back to original position
                    if (section.wrapper.parentNode) {
                        section.wrapper.parentNode.insertBefore(section.element, section.wrapper);
                        section.wrapper.remove();
                    }
                }
            });
            
            // Clear state
            this.state.sections = {};
            logger.log('COLLAPSIBLE-MENU', 'Sections unwrapped for desktop mode');
        },

        /**
         * Destroy the collapsible menu
         */
        destroy() {
            // Remove event listeners and restore original structure
            Object.values(this.state.sections).forEach(section => {
                const wrapper = section.wrapper;
                const originalElement = section.element;
                
                if (wrapper && originalElement) {
                    wrapper.parentNode.insertBefore(originalElement, wrapper);
                    wrapper.remove();
                }
            });

            this.state.initialized = false;
            logger.log('COLLAPSIBLE-MENU', 'Destroyed');
        }
    };

    logger.log('COLLAPSIBLE-MENU', 'Module loaded');

})();