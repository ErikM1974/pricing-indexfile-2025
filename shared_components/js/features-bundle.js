/**
 * Features Bundle
 * All Phase 2 features combined with lazy loading support
 * Features: Quantity Shortcuts, Mobile Collapsible, Loading Animations, Auto-Save
 */

(function() {
    'use strict';

    // Ensure NWCA namespace
    window.NWCA = window.NWCA || {};
    NWCA.features = NWCA.features || {};

    // ========================================
    // QUANTITY SHORTCUTS
    // ========================================
    NWCA.features.QuantityShortcuts = {
        presets: [12, 24, 48, 144, 500, '1000+'],
        
        init() {
            const container = document.getElementById('quantity-shortcuts-container');
            if (!container) return;
            
            this.render(container);
            this.bindEvents();
        },
        
        render(container) {
            const html = this.presets.map(qty => 
                `<button class="quantity-shortcut" data-quantity="${qty}">${qty}</button>`
            ).join('');
            
            container.innerHTML = html;
        },
        
        bindEvents() {
            document.addEventListener('click', (e) => {
                if (e.target.classList.contains('quantity-shortcut')) {
                    this.handleShortcutClick(e.target);
                }
            });
        },
        
        handleShortcutClick(button) {
            const quantity = button.dataset.quantity;
            
            if (quantity === '1000+') {
                this.showCustomQuantityModal();
            } else {
                this.setQuantity(parseInt(quantity));
            }
            
            // Update active state
            document.querySelectorAll('.quantity-shortcut').forEach(btn => {
                btn.classList.remove('active');
            });
            button.classList.add('active');
        },
        
        setQuantity(value) {
            const input = document.getElementById('hero-quantity-input');
            if (input) {
                input.value = value;
                input.dispatchEvent(new Event('input'));
            }
        },
        
        showCustomQuantityModal() {
            const quantity = prompt('Enter custom quantity (1000+):', '1000');
            if (quantity && parseInt(quantity) >= 1000) {
                this.setQuantity(parseInt(quantity));
            }
        }
    };

    // ========================================
    // MOBILE COLLAPSIBLE MENU
    // ========================================
    NWCA.features.MobileCollapsible = {
        sections: [
            { id: 'product-info', title: 'Product Information', icon: '🧢', defaultOpen: true },
            { id: 'customization', title: 'Customization Options', icon: '🎨', defaultOpen: true },
            { id: 'pricing-details', title: 'Pricing Details', icon: '💰', defaultOpen: false },
            { id: 'quote-builder', title: 'Quote Builder', icon: '📋', defaultOpen: false }
        ],
        
        init() {
            if (window.innerWidth > 768) return;
            
            this.setupCollapsibles();
        },
        
        setupCollapsibles() {
            this.sections.forEach(section => {
                const element = document.getElementById(section.id);
                if (!element) return;
                
                this.wrapSection(element, section);
            });
        },
        
        wrapSection(element, config) {
            const wrapper = document.createElement('div');
            wrapper.className = 'collapsible-section';
            
            const header = document.createElement('div');
            header.className = 'collapsible-header' + (config.defaultOpen ? ' active' : '');
            header.innerHTML = `
                <span>${config.icon} ${config.title}</span>
                <span class="collapsible-toggle">+</span>
            `;
            
            const content = document.createElement('div');
            content.className = 'collapsible-content' + (config.defaultOpen ? ' show' : '');
            
            // Move original content
            element.parentNode.insertBefore(wrapper, element);
            content.appendChild(element);
            wrapper.appendChild(header);
            wrapper.appendChild(content);
            
            // Add click handler
            header.addEventListener('click', () => this.toggleSection(header, content));
        },
        
        toggleSection(header, content) {
            header.classList.toggle('active');
            content.classList.toggle('show');
        }
    };

    // ========================================
    // ENHANCED LOADING ANIMATIONS
    // ========================================
    NWCA.features.LoadingAnimations = {
        init() {
            this.addSkeletonScreens();
            this.enhancePricingTable();
        },
        
        addSkeletonScreens() {
            // Add skeleton for product image
            const imageContainer = document.getElementById('main-image-container');
            if (imageContainer && !imageContainer.querySelector('img[src]')) {
                const skeleton = document.createElement('div');
                skeleton.className = 'skeleton';
                skeleton.style.width = '100%';
                skeleton.style.height = '400px';
                imageContainer.appendChild(skeleton);
            }
        },
        
        enhancePricingTable() {
            const table = document.getElementById('custom-pricing-grid');
            if (!table) return;
            
            // Add price cell formatting
            const cells = table.querySelectorAll('td:not(:first-child)');
            cells.forEach(cell => {
                if (cell.textContent.match(/^\$?\d+(\.\d+)?$/)) {
                    cell.classList.add('price-cell');
                }
            });
        },
        
        removeSkeletons() {
            document.querySelectorAll('.skeleton').forEach(el => {
                el.style.opacity = '0';
                setTimeout(() => el.remove(), 300);
            });
        }
    };

    // ========================================
    // AUTO-SAVE QUOTE
    // ========================================
    NWCA.features.AutoSave = {
        config: {
            interval: 30000, // 30 seconds
            debounceDelay: 2000,
            storageKey: 'nwca_quote_draft'
        },
        
        state: {
            isDirty: false,
            lastSaved: null,
            saveTimer: null
        },
        
        init() {
            this.createIndicator();
            this.setupListeners();
            this.checkForDraft();
            this.startAutoSave();
        },
        
        createIndicator() {
            const indicator = document.createElement('div');
            indicator.id = 'auto-save-indicator';
            indicator.className = 'auto-save-indicator';
            indicator.innerHTML = `
                <div class="auto-save-icon">
                    <div class="auto-save-spinner"></div>
                </div>
                <span class="auto-save-text">Saving...</span>
            `;
            document.body.appendChild(indicator);
        },
        
        setupListeners() {
            // Listen for changes
            document.addEventListener('quoteUpdated', () => this.markDirty());
            document.addEventListener('quantityChanged', () => this.markDirty());
            
            // Save on page hide
            document.addEventListener('visibilitychange', () => {
                if (document.hidden && this.state.isDirty) {
                    this.save();
                }
            });
        },
        
        markDirty() {
            this.state.isDirty = true;
            this.debouncedSave();
        },
        
        debouncedSave: NWCA.utils.debounce(function() {
            this.save();
        }, 2000),
        
        save() {
            if (!this.state.isDirty) return;
            
            const data = this.collectData();
            localStorage.setItem(this.config.storageKey, JSON.stringify(data));
            
            this.state.isDirty = false;
            this.state.lastSaved = new Date();
            
            this.showIndicator('saved');
        },
        
        collectData() {
            return {
                timestamp: new Date().toISOString(),
                quantity: document.getElementById('hero-quantity-input')?.value || 0,
                // Add other relevant data
            };
        },
        
        checkForDraft() {
            const saved = localStorage.getItem(this.config.storageKey);
            if (saved) {
                try {
                    const draft = JSON.parse(saved);
                    // Show recovery option if draft is recent
                    const age = Date.now() - new Date(draft.timestamp).getTime();
                    if (age < 7 * 24 * 60 * 60 * 1000) { // 7 days
                        this.showRecoveryOption(draft);
                    }
                } catch (e) {
                    console.error('Error parsing draft:', e);
                }
            }
        },
        
        showIndicator(status) {
            const indicator = document.getElementById('auto-save-indicator');
            if (!indicator) return;
            
            indicator.className = 'auto-save-indicator show ' + status;
            
            if (status === 'saved') {
                setTimeout(() => {
                    indicator.classList.remove('show');
                }, 3000);
            }
        },
        
        startAutoSave() {
            this.state.saveTimer = setInterval(() => {
                if (this.state.isDirty) {
                    this.save();
                }
            }, this.config.interval);
        },
        
        showRecoveryOption(draft) {
            // Simple recovery prompt
            if (confirm('Found a saved draft. Would you like to restore it?')) {
                // Restore draft data
                const input = document.getElementById('hero-quantity-input');
                if (input && draft.quantity) {
                    input.value = draft.quantity;
                    input.dispatchEvent(new Event('input'));
                }
            }
        }
    };

    // ========================================
    // LAZY LOADING MANAGER
    // ========================================
    NWCA.features.LazyLoader = {
        features: {
            quantityShortcuts: {
                selector: '#quantity-shortcuts-container',
                module: NWCA.features.QuantityShortcuts,
                priority: 1
            },
            mobileCollapsible: {
                condition: () => window.innerWidth <= 768,
                module: NWCA.features.MobileCollapsible,
                priority: 1
            },
            loadingAnimations: {
                immediate: true,
                module: NWCA.features.LoadingAnimations,
                priority: 1
            },
            autoSave: {
                delay: 2000,
                module: NWCA.features.AutoSave,
                priority: 2
            }
        },
        
        init() {
            console.log('[FEATURES] Initializing feature bundle...');
            
            // Initialize features based on priority and conditions
            Object.entries(this.features).forEach(([name, config]) => {
                this.loadFeature(name, config);
            });
        },
        
        loadFeature(name, config) {
            // Immediate load
            if (config.immediate) {
                config.module.init();
                return;
            }
            
            // Conditional load
            if (config.condition && !config.condition()) {
                return;
            }
            
            // Element-based load
            if (config.selector && !document.querySelector(config.selector)) {
                return;
            }
            
            // Delayed load
            if (config.delay) {
                setTimeout(() => config.module.init(), config.delay);
                return;
            }
            
            // Default: load immediately
            config.module.init();
        }
    };

    // Initialize when ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            NWCA.features.LazyLoader.init();
        });
    } else {
        // Small delay to ensure core is loaded
        setTimeout(() => NWCA.features.LazyLoader.init(), 100);
    }

})();