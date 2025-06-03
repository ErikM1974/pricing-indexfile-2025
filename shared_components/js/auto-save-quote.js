/**
 * Auto-Save Quote Draft
 * Phase 2 Feature 7: Automatic quote saving with recovery
 */

(function() {
    'use strict';

    console.log('[AUTO-SAVE] Initializing auto-save quote feature...');

    // Ensure NWCA namespace
    window.NWCA = window.NWCA || {};
    NWCA.ui = NWCA.ui || {};

    NWCA.ui.AutoSaveQuote = {
        // Configuration
        config: {
            autoSaveInterval: 30000, // 30 seconds
            debounceDelay: 2000,     // 2 seconds
            apiBaseUrl: 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api',
            localStorageKey: 'nwca_quote_draft',
            sessionKey: 'nwca_session_id'
        },

        // State
        state: {
            quoteID: null,
            sessionID: null,
            lastSaved: null,
            isDirty: false,
            isSaving: false,
            autoSaveTimer: null,
            debounceTimer: null,
            currentQuoteData: null
        },

        /**
         * Initialize auto-save functionality
         */
        initialize() {
            console.log('[AUTO-SAVE] Setting up auto-save functionality...');
            
            // Generate or retrieve session ID
            this.initializeSession();
            
            // Create UI elements
            this.createUI();
            
            // Check for existing drafts
            this.checkForExistingDraft();
            
            // Set up event listeners
            this.setupEventListeners();
            
            // Start auto-save timer
            this.startAutoSave();
        },

        /**
         * Initialize session
         */
        initializeSession() {
            // Check for existing session
            let sessionID = localStorage.getItem(this.config.sessionKey);
            
            if (!sessionID) {
                // Generate new session ID
                sessionID = 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
                localStorage.setItem(this.config.sessionKey, sessionID);
            }
            
            this.state.sessionID = sessionID;
            console.log('[AUTO-SAVE] Session ID:', sessionID);
        },

        /**
         * Create UI elements
         */
        createUI() {
            // Create auto-save indicator
            this.createAutoSaveIndicator();
            
            // Create save modal
            this.createSaveModal();
            
            // Create recovery notification
            this.createRecoveryNotification();
            
            // Add save button to quote section
            this.addSaveButton();
        },

        /**
         * Create auto-save indicator
         */
        createAutoSaveIndicator() {
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

        /**
         * Create save quote modal
         */
        createSaveModal() {
            const modal = document.createElement('div');
            modal.id = 'save-quote-modal';
            modal.className = 'save-quote-modal';
            modal.innerHTML = `
                <div class="save-quote-dialog" role="dialog" aria-labelledby="save-quote-title">
                    <div class="save-quote-header">
                        <h3 id="save-quote-title" class="save-quote-title">Save Quote</h3>
                    </div>
                    <div class="save-quote-body">
                        <form id="save-quote-form" class="save-quote-form">
                            <div class="form-group">
                                <label for="customer-name" class="form-label">Your Name</label>
                                <input type="text" id="customer-name" name="customerName" 
                                       class="form-input" required 
                                       placeholder="John Smith">
                            </div>
                            <div class="form-group">
                                <label for="customer-email" class="form-label">Email Address</label>
                                <input type="email" id="customer-email" name="customerEmail" 
                                       class="form-input" required 
                                       placeholder="john@example.com">
                            </div>
                            <div class="form-group">
                                <label for="company-name" class="form-label">Company Name (Optional)</label>
                                <input type="text" id="company-name" name="companyName" 
                                       class="form-input" 
                                       placeholder="Smith Industries">
                            </div>
                            <div class="form-group">
                                <label for="quote-notes" class="form-label">Notes (Optional)</label>
                                <textarea id="quote-notes" name="notes" 
                                          class="form-input form-textarea" 
                                          placeholder="Add any special requirements or notes..."></textarea>
                            </div>
                        </form>
                    </div>
                    <div class="save-quote-footer">
                        <button type="button" class="modal-btn modal-btn-cancel" onclick="NWCA.ui.AutoSaveQuote.closeSaveModal()">
                            Cancel
                        </button>
                        <button type="submit" form="save-quote-form" class="modal-btn modal-btn-save">
                            Save Quote
                        </button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        },

        /**
         * Create recovery notification
         */
        createRecoveryNotification() {
            const notification = document.createElement('div');
            notification.id = 'quote-recovery-notification';
            notification.className = 'quote-recovery-notification';
            notification.innerHTML = `
                <div class="recovery-icon">🔄</div>
                <div class="recovery-content">
                    <h4 class="recovery-title">Previous Quote Found</h4>
                    <p class="recovery-subtitle">Would you like to restore your previous quote?</p>
                </div>
                <div class="recovery-actions">
                    <button class="recovery-btn recovery-btn-restore" onclick="NWCA.ui.AutoSaveQuote.restoreDraft()">
                        Restore Quote
                    </button>
                    <button class="recovery-btn recovery-btn-dismiss" onclick="NWCA.ui.AutoSaveQuote.dismissRecovery()">
                        Start Fresh
                    </button>
                </div>
            `;
            document.body.appendChild(notification);
        },

        /**
         * Add save button to quote section
         */
        addSaveButton() {
            const quoteSection = document.getElementById('quote-builder');
            if (quoteSection) {
                const saveBtn = document.createElement('button');
                saveBtn.id = 'manual-save-quote';
                saveBtn.className = 'quote-draft-btn';
                saveBtn.innerHTML = '💾 Save Quote';
                saveBtn.onclick = () => this.showSaveModal();
                
                // Find a good place to insert it
                const cardHeader = quoteSection.querySelector('.card-header');
                if (cardHeader) {
                    saveBtn.style.float = 'right';
                    cardHeader.appendChild(saveBtn);
                }
            }
        },

        /**
         * Setup event listeners
         */
        setupEventListeners() {
            // Listen for quote changes
            document.addEventListener('quoteUpdated', (e) => {
                this.markAsDirty();
                this.debounceSave();
            });

            // Listen for form submission
            const form = document.getElementById('save-quote-form');
            if (form) {
                form.addEventListener('submit', (e) => {
                    e.preventDefault();
                    this.saveQuote();
                });
            }

            // Listen for visibility change (save when leaving page)
            document.addEventListener('visibilitychange', () => {
                if (document.hidden && this.state.isDirty) {
                    this.saveQuoteDraft();
                }
            });

            // Listen for beforeunload
            window.addEventListener('beforeunload', (e) => {
                if (this.state.isDirty) {
                    this.saveQuoteDraft();
                    e.preventDefault();
                    e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
                }
            });

            // Listen for specific quote events
            this.listenForQuoteEvents();
        },

        /**
         * Listen for quote-specific events
         */
        listenForQuoteEvents() {
            // Quantity changes
            const quantityInput = document.getElementById('hero-quantity-input');
            if (quantityInput) {
                quantityInput.addEventListener('input', () => this.markAsDirty());
            }

            // Stitch count changes
            const stitchSelect = document.getElementById('client-stitch-count-select');
            if (stitchSelect) {
                stitchSelect.addEventListener('change', () => this.markAsDirty());
            }

            // Back logo checkbox
            const backLogoCheckbox = document.getElementById('back-logo-checkbox');
            if (backLogoCheckbox) {
                backLogoCheckbox.addEventListener('change', () => this.markAsDirty());
            }

            // Color selection
            document.addEventListener('colorSelected', () => this.markAsDirty());
        },

        /**
         * Mark quote as dirty (needs saving)
         */
        markAsDirty() {
            this.state.isDirty = true;
        },

        /**
         * Debounce save operation
         */
        debounceSave() {
            clearTimeout(this.state.debounceTimer);
            this.state.debounceTimer = setTimeout(() => {
                this.saveQuoteDraft();
            }, this.config.debounceDelay);
        },

        /**
         * Start auto-save timer
         */
        startAutoSave() {
            this.state.autoSaveTimer = setInterval(() => {
                if (this.state.isDirty && !this.state.isSaving) {
                    this.saveQuoteDraft();
                }
            }, this.config.autoSaveInterval);
        },

        /**
         * Collect current quote data
         */
        collectQuoteData() {
            const data = {
                // Basic info
                sessionID: this.state.sessionID,
                quoteID: this.state.quoteID || this.generateQuoteID(),
                timestamp: new Date().toISOString(),
                
                // Product info
                productName: document.getElementById('product-title-context')?.textContent || '',
                styleNumber: document.getElementById('product-style-context')?.textContent || '',
                
                // Configuration
                quantity: parseInt(document.getElementById('hero-quantity-input')?.value) || 0,
                stitchCount: parseInt(document.getElementById('client-stitch-count-select')?.value) || 8000,
                hasBackLogo: document.getElementById('back-logo-checkbox')?.checked || false,
                backLogoStitchCount: document.getElementById('back-logo-stitch-display')?.textContent || '5,000',
                
                // Color
                selectedColor: document.getElementById('pricing-color-name')?.textContent || '',
                
                // Pricing
                unitPrice: this.extractPrice(document.getElementById('hero-unit-price')?.textContent),
                totalPrice: this.extractPrice(document.getElementById('hero-total-price')?.textContent),
                
                // Page URL for restoration
                pageURL: window.location.href
            };

            return data;
        },

        /**
         * Generate quote ID
         */
        generateQuoteID() {
            const date = new Date();
            const dateStr = date.getFullYear() + 
                          String(date.getMonth() + 1).padStart(2, '0') +
                          String(date.getDate()).padStart(2, '0');
            const timeStr = String(date.getHours()).padStart(2, '0') +
                          String(date.getMinutes()).padStart(2, '0') +
                          String(date.getSeconds()).padStart(2, '0');
            return `Q_${dateStr}${timeStr}`;
        },

        /**
         * Extract price from text
         */
        extractPrice(text) {
            if (!text) return 0;
            const match = text.match(/\$?([\d,]+\.?\d*)/);
            return match ? parseFloat(match[1].replace(/,/g, '')) : 0;
        },

        /**
         * Save quote draft to local storage
         */
        async saveQuoteDraft() {
            if (this.state.isSaving) return;
            
            this.state.isSaving = true;
            this.showSaveIndicator('saving');

            try {
                const quoteData = this.collectQuoteData();
                this.state.currentQuoteData = quoteData;
                
                // Save to local storage
                localStorage.setItem(this.config.localStorageKey, JSON.stringify(quoteData));
                
                // Update state
                this.state.lastSaved = new Date();
                this.state.isDirty = false;
                
                // Show success
                this.showSaveIndicator('saved');
                
                console.log('[AUTO-SAVE] Quote draft saved successfully');
            } catch (error) {
                console.error('[AUTO-SAVE] Error saving draft:', error);
                this.showSaveIndicator('error');
            } finally {
                this.state.isSaving = false;
            }
        },

        /**
         * Show save indicator with status
         */
        showSaveIndicator(status) {
            const indicator = document.getElementById('auto-save-indicator');
            if (!indicator) return;

            // Reset classes
            indicator.className = 'auto-save-indicator show';
            indicator.classList.add(status);

            // Update content based on status
            const icon = indicator.querySelector('.auto-save-icon');
            const text = indicator.querySelector('.auto-save-text');

            switch (status) {
                case 'saving':
                    icon.innerHTML = '<div class="auto-save-spinner"></div>';
                    text.textContent = 'Saving draft...';
                    break;
                case 'saved':
                    icon.innerHTML = '<div class="auto-save-checkmark"></div>';
                    text.textContent = 'Draft saved';
                    setTimeout(() => {
                        indicator.classList.remove('show');
                    }, 3000);
                    break;
                case 'error':
                    icon.innerHTML = '⚠️';
                    text.textContent = 'Save failed';
                    setTimeout(() => {
                        indicator.classList.remove('show');
                    }, 5000);
                    break;
            }
        },

        /**
         * Check for existing draft
         */
        checkForExistingDraft() {
            const savedDraft = localStorage.getItem(this.config.localStorageKey);
            if (savedDraft) {
                try {
                    const draft = JSON.parse(savedDraft);
                    // Check if draft is recent (less than 7 days old)
                    const draftAge = Date.now() - new Date(draft.timestamp).getTime();
                    const sevenDays = 7 * 24 * 60 * 60 * 1000;
                    
                    if (draftAge < sevenDays) {
                        this.showRecoveryNotification(draft);
                    } else {
                        // Clear old draft
                        localStorage.removeItem(this.config.localStorageKey);
                    }
                } catch (error) {
                    console.error('[AUTO-SAVE] Error parsing saved draft:', error);
                    localStorage.removeItem(this.config.localStorageKey);
                }
            }
        },

        /**
         * Show recovery notification
         */
        showRecoveryNotification(draft) {
            const notification = document.getElementById('quote-recovery-notification');
            if (notification) {
                // Update subtitle with draft info
                const subtitle = notification.querySelector('.recovery-subtitle');
                const date = new Date(draft.timestamp);
                const timeAgo = this.getTimeAgo(date);
                subtitle.textContent = `Found a quote from ${timeAgo} with ${draft.quantity} items`;
                
                // Store draft for restoration
                this.state.recoveryDraft = draft;
                
                // Show notification
                setTimeout(() => {
                    notification.classList.add('show');
                }, 1000);
            }
        },

        /**
         * Get human-readable time ago
         */
        getTimeAgo(date) {
            const seconds = Math.floor((Date.now() - date) / 1000);
            
            if (seconds < 60) return 'just now';
            if (seconds < 3600) return Math.floor(seconds / 60) + ' minutes ago';
            if (seconds < 86400) return Math.floor(seconds / 3600) + ' hours ago';
            return Math.floor(seconds / 86400) + ' days ago';
        },

        /**
         * Restore draft
         */
        restoreDraft() {
            if (!this.state.recoveryDraft) return;

            const draft = this.state.recoveryDraft;
            
            // Restore values
            if (draft.quantity) {
                const quantityInput = document.getElementById('hero-quantity-input');
                if (quantityInput) {
                    quantityInput.value = draft.quantity;
                    quantityInput.dispatchEvent(new Event('input'));
                }
            }

            if (draft.stitchCount) {
                const stitchSelect = document.getElementById('client-stitch-count-select');
                if (stitchSelect) {
                    stitchSelect.value = draft.stitchCount;
                    stitchSelect.dispatchEvent(new Event('change'));
                }
            }

            if (draft.hasBackLogo) {
                const backLogoCheckbox = document.getElementById('back-logo-checkbox');
                if (backLogoCheckbox) {
                    backLogoCheckbox.checked = draft.hasBackLogo;
                    backLogoCheckbox.dispatchEvent(new Event('change'));
                }
            }

            // Restore quote ID
            this.state.quoteID = draft.quoteID;

            // Hide notification
            this.dismissRecovery();

            // Show success message
            this.showSaveIndicator('saved');
            const text = document.querySelector('.auto-save-text');
            if (text) text.textContent = 'Quote restored';

            console.log('[AUTO-SAVE] Draft restored successfully');
        },

        /**
         * Dismiss recovery notification
         */
        dismissRecovery() {
            const notification = document.getElementById('quote-recovery-notification');
            if (notification) {
                notification.classList.remove('show');
                setTimeout(() => {
                    notification.remove();
                }, 300);
            }
            
            // Clear saved draft
            localStorage.removeItem(this.config.localStorageKey);
            this.state.recoveryDraft = null;
        },

        /**
         * Show save modal
         */
        showSaveModal() {
            const modal = document.getElementById('save-quote-modal');
            if (modal) {
                modal.classList.add('show');
                // Focus first input
                setTimeout(() => {
                    document.getElementById('customer-name')?.focus();
                }, 100);
            }
        },

        /**
         * Close save modal
         */
        closeSaveModal() {
            const modal = document.getElementById('save-quote-modal');
            if (modal) {
                modal.classList.remove('show');
            }
        },

        /**
         * Save quote to API
         */
        async saveQuote() {
            const form = document.getElementById('save-quote-form');
            if (!form) return;

            const formData = new FormData(form);
            const customerData = Object.fromEntries(formData);
            
            // Disable save button
            const saveBtn = form.querySelector('.modal-btn-save');
            if (saveBtn) {
                saveBtn.disabled = true;
                saveBtn.textContent = 'Saving...';
            }

            try {
                // Collect current quote data
                const quoteData = this.collectQuoteData();
                
                // Create quote session
                const sessionData = {
                    QuoteID: quoteData.quoteID,
                    SessionID: this.state.sessionID,
                    CustomerEmail: customerData.customerEmail,
                    CustomerName: customerData.customerName,
                    CompanyName: customerData.companyName || '',
                    Status: 'Active',
                    Notes: customerData.notes || ''
                };

                // Save to API
                const response = await fetch(`${this.config.apiBaseUrl}/quote_sessions`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(sessionData)
                });

                if (!response.ok) {
                    throw new Error('Failed to save quote');
                }

                const savedSession = await response.json();
                console.log('[AUTO-SAVE] Quote saved to API:', savedSession);

                // Create quote item
                const itemData = {
                    QuoteID: quoteData.quoteID,
                    LineNumber: 1,
                    StyleNumber: quoteData.styleNumber,
                    ProductName: quoteData.productName,
                    Color: quoteData.selectedColor,
                    EmbellishmentType: 'cap-embroidery',
                    Quantity: quoteData.quantity,
                    BaseUnitPrice: quoteData.unitPrice,
                    FinalUnitPrice: quoteData.unitPrice,
                    LineTotal: quoteData.totalPrice,
                    CustomOptions: JSON.stringify({
                        stitchCount: quoteData.stitchCount,
                        hasBackLogo: quoteData.hasBackLogo,
                        backLogoStitchCount: quoteData.backLogoStitchCount
                    })
                };

                await fetch(`${this.config.apiBaseUrl}/quote_items`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(itemData)
                });

                // Clear local draft
                localStorage.removeItem(this.config.localStorageKey);
                this.state.isDirty = false;

                // Show success and close modal
                this.closeSaveModal();
                this.showQuoteSavedBanner(quoteData.quoteID);

                // Track event
                if (window.gtag) {
                    gtag('event', 'save_quote', {
                        'event_category': 'engagement',
                        'event_label': 'cap_embroidery',
                        'value': quoteData.totalPrice
                    });
                }

            } catch (error) {
                console.error('[AUTO-SAVE] Error saving quote:', error);
                alert('Failed to save quote. Please try again.');
            } finally {
                // Re-enable save button
                if (saveBtn) {
                    saveBtn.disabled = false;
                    saveBtn.textContent = 'Save Quote';
                }
            }
        },

        /**
         * Show quote saved banner
         */
        showQuoteSavedBanner(quoteID) {
            const banner = document.createElement('div');
            banner.className = 'quote-draft-banner';
            banner.innerHTML = `
                <div class="quote-draft-info">
                    <div class="quote-draft-icon">✅</div>
                    <div class="quote-draft-text">
                        <h3 class="quote-draft-title">Quote Saved Successfully!</h3>
                        <p class="quote-draft-subtitle">
                            Quote ID: <strong>${quoteID}</strong>
                            <span class="quote-id-display">
                                ${quoteID}
                                <button class="copy-btn" onclick="NWCA.ui.AutoSaveQuote.copyQuoteID('${quoteID}')">
                                    📋
                                </button>
                            </span>
                        </p>
                    </div>
                </div>
                <div class="quote-draft-actions">
                    <button class="quote-draft-btn" onclick="window.print()">
                        🖨️ Print Quote
                    </button>
                    <button class="quote-draft-btn" onclick="NWCA.ui.AutoSaveQuote.shareQuote('${quoteID}')">
                        📤 Share Quote
                    </button>
                </div>
            `;

            // Insert at top of main content
            const container = document.querySelector('.container');
            if (container) {
                container.insertBefore(banner, container.firstChild);
                
                // Scroll to top
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        },

        /**
         * Copy quote ID to clipboard
         */
        async copyQuoteID(quoteID) {
            try {
                await navigator.clipboard.writeText(quoteID);
                // Show feedback
                const btn = event.target;
                const originalText = btn.textContent;
                btn.textContent = '✓';
                setTimeout(() => {
                    btn.textContent = originalText;
                }, 2000);
            } catch (error) {
                console.error('[AUTO-SAVE] Failed to copy quote ID:', error);
            }
        },

        /**
         * Share quote
         */
        shareQuote(quoteID) {
            const shareData = {
                title: 'Northwest Custom Apparel Quote',
                text: `Check out my custom cap embroidery quote #${quoteID}`,
                url: window.location.href
            };

            if (navigator.share) {
                navigator.share(shareData).catch(console.error);
            } else {
                // Fallback to copy URL
                this.copyQuoteID(window.location.href);
                alert('Quote link copied to clipboard!');
            }
        }
    };

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            NWCA.ui.AutoSaveQuote.initialize();
        });
    } else {
        setTimeout(() => NWCA.ui.AutoSaveQuote.initialize(), 100);
    }

    console.log('[AUTO-SAVE] Module loaded');

})();