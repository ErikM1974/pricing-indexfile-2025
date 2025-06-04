// Quote Adapter Base Class
// Provides common functionality for embellishment-specific quote adapters
// For Northwest Custom Apparel - June 2025

(function() {
    'use strict';

    // Base configuration that can be overridden by specific adapters
    const DEFAULT_CONFIG = {
        apiBaseUrl: 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api',
        ltmThreshold: 24,
        ltmFee: 50.00,
        sessionKey: 'nwca_quote_session',
        quoteKey: 'nwca_current_quote',
        brandColor: '#2e5827' // NWCA Green
    };

    // Base Quote Adapter Class
    class QuoteAdapterBase {
        constructor(embellishmentType, config = {}) {
            this.embellishmentType = embellishmentType;
            this.config = { ...DEFAULT_CONFIG, ...config };
            this.currentQuote = this.initializeQuote();
            this.initialized = false;
        }

        // Initialize empty quote structure
        initializeQuote() {
            return {
                id: null,
                sessionId: null,
                items: [],
                totalQuantity: 0,
                subtotal: 0,
                ltmTotal: 0,
                grandTotal: 0,
                embellishmentType: this.embellishmentType
            };
        }

        // Initialize the quote system
        init() {
            // Only log in debug mode
            if (window.DEBUG_MODE) {
                console.log(`[QUOTE:${this.embellishmentType.toUpperCase()}] Initializing quote system`);
            }
            this.loadSession();
            this.setupUI();
            this.bindEvents();
            this.initialized = true;
        }

        // Load or create session
        loadSession() {
            let sessionId = localStorage.getItem(this.config.sessionKey);
            if (!sessionId) {
                sessionId = this.generateSessionId();
                localStorage.setItem(this.config.sessionKey, sessionId);
            }
            this.currentQuote.sessionId = sessionId;
            
            // Load existing quote if available
            const savedQuote = localStorage.getItem(this.config.quoteKey);
            if (savedQuote) {
                try {
                    const quoteData = JSON.parse(savedQuote);
                    // Only load if it matches our embellishment type
                    if (quoteData.embellishmentType === this.embellishmentType) {
                        Object.assign(this.currentQuote, quoteData);
                        this.updateQuoteSummary();
                    }
                } catch (e) {
                    console.error(`[QUOTE:${this.embellishmentType.toUpperCase()}] Error loading saved quote:`, e.message);
                }
            }
        }

        // Generate unique session ID
        generateSessionId() {
            return 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        }

        // Setup UI elements - to be overridden by specific adapters
        setupUI() {
            // Replace "Add to Cart" section with quote builder
            const cartSection = document.getElementById('add-to-cart-section');
            if (cartSection) {
                cartSection.innerHTML = this.getQuoteBuilderHTML();
            }

            // Add quote summary panel
            this.addQuoteSummaryPanel();
        }

        // Get quote builder HTML - to be overridden by specific adapters
        getQuoteBuilderHTML() {
            // Base implementation - specific adapters should override
            return `
                <div class="quote-builder-container">
                    <h3 class="section-title" style="color: ${this.config.brandColor};">Build Your Quote</h3>
                    <div class="quote-builder-content">
                        <!-- Specific adapter content goes here -->
                    </div>
                </div>
            `;
        }

        // Add quote summary panel
        addQuoteSummaryPanel() {
            // Check if panel already exists
            if (document.getElementById('quote-summary-panel')) {
                return;
            }

            const panel = document.createElement('div');
            panel.id = 'quote-summary-panel';
            panel.className = 'quote-summary-panel';
            
            panel.innerHTML = `
                <div class="quote-panel-header">
                    <h3>Your Quote</h3>
                    <button class="quote-close-btn" onclick="${this.embellishmentType}QuoteAdapter.toggleQuotePanel()">
                        ✕ Close
                    </button>
                </div>
                <div class="quote-panel-content">
                    <div id="quote-items-list" class="quote-items-list">
                        <p class="empty-quote-message">No items yet</p>
                    </div>
                    <div class="quote-totals">
                        <div class="total-row">
                            <span>Subtotal:</span>
                            <span id="quote-subtotal">$0.00</span>
                        </div>
                        <div class="total-row ltm-row" style="display: none;">
                            <span>LTM Fees:</span>
                            <span id="quote-ltm">$0.00</span>
                        </div>
                        <div class="total-row grand-total">
                            <span>Total:</span>
                            <span id="quote-total">$0.00</span>
                        </div>
                    </div>
                    <div class="quote-actions">
                        <button class="btn-secondary quote-action-btn" onclick="${this.embellishmentType}QuoteAdapter.saveQuote()">
                            💾 Save Quote
                        </button>
                        <button class="btn-secondary quote-action-btn" onclick="${this.embellishmentType}QuoteAdapter.loadQuotePrompt()">
                            📂 Load Quote
                        </button>
                        <button class="btn-secondary quote-action-btn" onclick="${this.embellishmentType}QuoteAdapter.exportPDF()">
                            📄 Download PDF
                        </button>
                        <button class="btn-secondary quote-action-btn" onclick="${this.embellishmentType}QuoteAdapter.emailQuote()">
                            ✉️ Email Quote
                        </button>
                        <button class="btn-link quote-clear-btn" onclick="${this.embellishmentType}QuoteAdapter.clearQuote()">
                            🗑️ Clear Quote
                        </button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(panel);
            
            // Add floating toggle button
            this.addFloatingToggleButton();
        }

        // Add floating toggle button
        addFloatingToggleButton() {
            // Check if button already exists
            if (document.getElementById('quote-panel-toggle')) {
                return;
            }

            const toggleBtn = document.createElement('button');
            toggleBtn.id = 'quote-panel-toggle';
            toggleBtn.className = 'quote-panel-toggle';
            toggleBtn.innerHTML = `💰 Quote (<span id="quote-item-count-btn">0</span>)`;
            toggleBtn.onclick = () => this.toggleQuotePanel();
            document.body.appendChild(toggleBtn);
        }

        // Bind events - to be extended by specific adapters
        bindEvents() {
            // Base event bindings
            console.log(`[QUOTE:${this.embellishmentType.toUpperCase()}] Base events bound`);
        }

        // Common validation methods
        validateQuantity(quantity) {
            const qty = parseInt(quantity);
            return !isNaN(qty) && qty > 0;
        }

        validateSizeDistribution(sizeInputs, totalQuantity) {
            let sum = 0;
            sizeInputs.forEach(input => {
                sum += parseInt(input.value) || 0;
            });
            return sum === totalQuantity;
        }

        // Calculate if LTM applies
        hasLTMFee(quantity) {
            return quantity < this.config.ltmThreshold;
        }

        // Calculate LTM per unit
        calculateLTMPerUnit(quantity) {
            return this.hasLTMFee(quantity) ? (this.config.ltmFee / quantity) : 0;
        }

        // Create base quote item structure
        createQuoteItem(itemData) {
            const baseItem = {
                id: 'item_' + Date.now(),
                lineNumber: this.currentQuote.items.length + 1,
                embellishmentType: this.embellishmentType,
                quantity: itemData.quantity,
                hasLTM: this.hasLTMFee(itemData.quantity),
                ltmPerUnit: this.calculateLTMPerUnit(itemData.quantity),
                addedAt: new Date().toISOString()
            };

            // Calculate final unit price and line total
            baseItem.finalUnitPrice = itemData.baseUnitPrice + baseItem.ltmPerUnit;
            baseItem.lineTotal = baseItem.finalUnitPrice * itemData.quantity;

            // Merge with provided item data
            return { ...baseItem, ...itemData };
        }

        // Add item to quote
        addItemToQuote(item) {
            this.currentQuote.items.push(item);
            this.updateQuoteTotals();
            this.saveQuoteToStorage();
            this.updateQuoteSummary();
            
            // Log analytics
            this.logAnalytics('item_added', {
                embellishmentType: this.embellishmentType,
                quantity: item.quantity,
                hasLTM: item.hasLTM,
                priceShown: item.finalUnitPrice
            });

            // Show success message
            this.showSuccessMessage();
        }

        // Update quote totals
        updateQuoteTotals() {
            let subtotal = 0;
            let ltmTotal = 0;
            let totalQuantity = 0;

            this.currentQuote.items.forEach(item => {
                subtotal += item.baseUnitPrice * item.quantity;
                ltmTotal += item.ltmPerUnit * item.quantity;
                totalQuantity += item.quantity;
            });

            this.currentQuote.subtotal = subtotal;
            this.currentQuote.ltmTotal = ltmTotal;
            this.currentQuote.grandTotal = this.currentQuote.items.reduce((sum, item) => sum + item.lineTotal, 0);
            this.currentQuote.totalQuantity = totalQuantity;
        }

        // Update quote summary display
        updateQuoteSummary() {
            const itemsList = document.getElementById('quote-items-list');
            const subtotalEl = document.getElementById('quote-subtotal');
            const ltmEl = document.getElementById('quote-ltm');
            const totalEl = document.getElementById('quote-total');
            const ltmRow = document.querySelector('.ltm-row');

            if (!itemsList) return;

            if (this.currentQuote.items.length === 0) {
                itemsList.innerHTML = '<p class="empty-quote-message">No items yet</p>';
            } else {
                itemsList.innerHTML = this.currentQuote.items.map(item => this.renderQuoteItem(item)).join('');
            }

            if (subtotalEl) subtotalEl.textContent = '$' + this.currentQuote.subtotal.toFixed(2);
            if (ltmEl) ltmEl.textContent = '$' + this.currentQuote.ltmTotal.toFixed(2);
            if (totalEl) totalEl.textContent = '$' + this.currentQuote.grandTotal.toFixed(2);

            if (ltmRow) {
                ltmRow.style.display = this.currentQuote.ltmTotal > 0 ? 'flex' : 'none';
            }
            
            // Update floating button count
            const btnCount = document.getElementById('quote-item-count-btn');
            if (btnCount) {
                btnCount.textContent = this.currentQuote.items.length;
            }
        }

        // Render individual quote item - can be overridden for custom display
        renderQuoteItem(item) {
            return `
                <div class="quote-item" data-item-id="${item.id}">
                    <div class="quote-item-header">
                        <strong>${item.styleNumber || 'Product'} - ${item.color || 'Color'}</strong>
                        <button class="quote-item-remove" onclick="${this.embellishmentType}QuoteAdapter.removeItem('${item.id}')">
                            ×
                        </button>
                    </div>
                    <div class="quote-item-details">
                        ${this.getItemDetailsHTML(item)}
                    </div>
                    <div class="quote-item-total">
                        $${item.lineTotal.toFixed(2)}
                    </div>
                </div>
            `;
        }

        // Get item details HTML - to be overridden by specific adapters
        getItemDetailsHTML(item) {
            return `
                <span>Qty: ${item.quantity}</span>
                <span>$${item.finalUnitPrice.toFixed(2)}/ea</span>
            `;
        }

        // Remove item from quote
        removeItem(itemId) {
            this.currentQuote.items = this.currentQuote.items.filter(item => item.id !== itemId);
            this.updateQuoteTotals();
            this.saveQuoteToStorage();
            this.updateQuoteSummary();
        }

        // Save quote to local storage
        saveQuoteToStorage() {
            localStorage.setItem(this.config.quoteKey, JSON.stringify(this.currentQuote));
        }

        // Save quote to database
        async saveQuote() {
            try {
                // Create quote ID if not exists
                if (!this.currentQuote.id) {
                    this.currentQuote.id = 'Q_' + new Date().toISOString().replace(/[-:T]/g, '').substr(0, 15);
                }

                // Prepare quote session data
                const quoteSessionData = {
                    QuoteID: this.currentQuote.id,
                    SessionID: this.currentQuote.sessionId,
                    CustomerEmail: '', // Can be populated later
                    CustomerName: '',
                    CompanyName: '',
                    Status: 'Active',
                    EmbellishmentType: this.embellishmentType,
                    Notes: `${this.embellishmentType.toUpperCase()} Quote - ${this.currentQuote.items.length} items, Total: $${this.currentQuote.grandTotal.toFixed(2)}`
                };

                console.log(`[QUOTE:${this.embellishmentType.toUpperCase()}] Saving quote session:`, quoteSessionData);
                
                const response = await fetch(`${this.config.apiBaseUrl}/quote_sessions`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(quoteSessionData)
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`Failed to save quote session: ${response.status} - ${errorText}`);
                }

                const savedQuoteSession = await response.json();
                console.log(`[QUOTE:${this.embellishmentType.toUpperCase()}] Quote session saved successfully:`, savedQuoteSession);
                
                // Save each quote item
                for (const item of this.currentQuote.items) {
                    await this.saveQuoteItem(item);
                }
                
                // Show success
                alert('Quote saved successfully! Quote ID: ' + this.currentQuote.id);
                
                // Log analytics
                this.logAnalytics('quote_saved');
                
            } catch (error) {
                console.error(`[QUOTE:${this.embellishmentType.toUpperCase()}] Error saving quote:`, error);
                alert('Error saving quote: ' + error.message);
            }
        }

        // Save individual quote item
        async saveQuoteItem(item) {
            try {
                const itemData = {
                    QuoteID: this.currentQuote.id,
                    LineNumber: item.lineNumber,
                    StyleNumber: item.styleNumber,
                    ProductName: item.productName,
                    Color: item.color,
                    ColorCode: item.color ? item.color.toUpperCase().replace(/\s+/g, '_') : '',
                    EmbellishmentType: item.embellishmentType,
                    Quantity: item.quantity,
                    HasLTM: item.hasLTM ? "Yes" : "No",
                    BaseUnitPrice: item.baseUnitPrice,
                    LTMPerUnit: item.ltmPerUnit,
                    FinalUnitPrice: item.finalUnitPrice,
                    LineTotal: item.lineTotal,
                    AddedAt: item.addedAt || new Date().toISOString(),
                    // Additional fields specific to embellishment type
                    ...this.getAdditionalItemData(item)
                };

                console.log(`[QUOTE:${this.embellishmentType.toUpperCase()}] Saving quote item:`, itemData);
                
                const response = await fetch(`${this.config.apiBaseUrl}/quote_items`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(itemData)
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`Failed to save item: ${response.status} - ${errorText}`);
                }

                const savedItem = await response.json();
                console.log(`[QUOTE:${this.embellishmentType.toUpperCase()}] Item saved successfully:`, savedItem);
                return savedItem;
                
            } catch (error) {
                console.error(`[QUOTE:${this.embellishmentType.toUpperCase()}] Error saving quote item:`, error);
                throw error;
            }
        }

        // Get additional item data specific to embellishment type - to be overridden
        getAdditionalItemData(item) {
            return {};
        }

        // Export quote as PDF
        exportPDF() {
            if (this.currentQuote.items.length === 0) {
                alert('No items in quote to export');
                return;
            }

            // Use existing order-form-pdf.js functionality
            if (window.generateQuotePDF) {
                window.generateQuotePDF(this.currentQuote);
            } else {
                console.error(`[QUOTE:${this.embellishmentType.toUpperCase()}] PDF generation not available`);
                alert('PDF export coming soon!');
            }
            
            this.logAnalytics('quote_exported');
        }

        // Load quote prompt
        loadQuotePrompt() {
            const quoteId = prompt('Enter Quote ID (e.g., Q_20250601123456):');
            if (quoteId) {
                this.loadQuoteById(quoteId);
            }
        }

        // Load quote by ID
        async loadQuoteById(quoteId) {
            try {
                this.showLoadingMessage('Loading quote...');

                await this.loadQuote(quoteId);
                
                this.hideLoadingMessage();
                alert(`Quote ${quoteId} loaded successfully!`);
                this.logAnalytics('quote_loaded', { quoteId });
                
            } catch (error) {
                this.hideLoadingMessage();
                alert('Failed to load quote: ' + error.message);
                console.error(`[QUOTE:${this.embellishmentType.toUpperCase()}] Load error:`, error);
            }
        }

        // Load quote from database
        async loadQuote(quoteId) {
            try {
                console.log(`[QUOTE:${this.embellishmentType.toUpperCase()}] Loading quote:`, quoteId);
                
                // Get quote session
                const sessionResponse = await fetch(`${this.config.apiBaseUrl}/quote_sessions?quoteID=${quoteId}`);
                
                if (!sessionResponse.ok) {
                    throw new Error(`Failed to load quote session: ${sessionResponse.status}`);
                }

                const sessionData = await sessionResponse.json();
                
                if (!sessionData || sessionData.length === 0) {
                    throw new Error('Quote not found');
                }
                
                const quoteSession = sessionData[0];
                
                // Get quote items
                const itemsResponse = await fetch(`${this.config.apiBaseUrl}/quote_items?quoteID=${quoteId}`);
                
                if (!itemsResponse.ok) {
                    throw new Error(`Failed to load quote items: ${itemsResponse.status}`);
                }

                const itemsData = await itemsResponse.json();
                
                // Update current quote with loaded data
                this.currentQuote.id = quoteSession.QuoteID;
                this.currentQuote.sessionId = quoteSession.SessionID;
                this.currentQuote.items = [];
                
                // Convert API items back to quote items
                if (itemsData && itemsData.length > 0) {
                    itemsData.forEach(apiItem => {
                        const quoteItem = this.convertApiItemToQuoteItem(apiItem);
                        this.currentQuote.items.push(quoteItem);
                    });
                }
                
                this.updateQuoteTotals();
                this.updateQuoteSummary();
                
                return {
                    session: quoteSession,
                    items: itemsData
                };
                
            } catch (error) {
                console.error(`[QUOTE:${this.embellishmentType.toUpperCase()}] Error loading quote:`, error);
                throw error;
            }
        }

        // Convert API item to quote item - can be overridden for custom conversion
        convertApiItemToQuoteItem(apiItem) {
            return {
                id: 'item_' + apiItem.PK_ID,
                lineNumber: apiItem.LineNumber || this.currentQuote.items.length + 1,
                styleNumber: apiItem.StyleNumber,
                productName: apiItem.ProductName,
                color: apiItem.Color,
                embellishmentType: apiItem.EmbellishmentType,
                quantity: apiItem.Quantity,
                hasLTM: apiItem.HasLTM === "Yes",
                baseUnitPrice: apiItem.BaseUnitPrice,
                ltmPerUnit: apiItem.LTMPerUnit,
                finalUnitPrice: apiItem.FinalUnitPrice,
                lineTotal: apiItem.LineTotal,
                addedAt: apiItem.AddedAt
            };
        }

        // Email quote
        emailQuote() {
            const email = prompt('Enter email address:');
            if (email) {
                console.log(`[QUOTE:${this.embellishmentType.toUpperCase()}] Emailing quote to:`, email);
                alert('Quote email functionality coming soon!');
                this.logAnalytics('quote_emailed', { email });
            }
        }

        // Clear quote
        clearQuote() {
            if (confirm('Are you sure you want to clear the current quote?')) {
                this.currentQuote = this.initializeQuote();
                this.currentQuote.sessionId = this.generateSessionId();
                localStorage.setItem(this.config.sessionKey, this.currentQuote.sessionId);
                this.saveQuoteToStorage();
                this.updateQuoteSummary();
                this.resetQuoteBuilder();
            }
        }

        // Reset quote builder form - to be overridden by specific adapters
        resetQuoteBuilder() {
            console.log(`[QUOTE:${this.embellishmentType.toUpperCase()}] Resetting quote builder`);
        }

        // Show success message
        showSuccessMessage() {
            const message = document.createElement('div');
            message.className = 'quote-success-message';
            message.innerHTML = `
                <div class="success-content">
                    <h4>✓ Item added to quote successfully!</h4>
                </div>
            `;
            
            // Find a suitable container or use body
            const container = document.querySelector('.quote-builder-container') || document.body;
            container.appendChild(message);
            
            setTimeout(() => {
                message.remove();
            }, 3000);
        }

        // Show loading message
        showLoadingMessage(text) {
            const loadingMsg = document.createElement('div');
            loadingMsg.id = 'quote-loading-message';
            loadingMsg.className = 'quote-loading-message';
            loadingMsg.innerHTML = `<p>${text}</p>`;
            document.body.appendChild(loadingMsg);
        }

        // Hide loading message
        hideLoadingMessage() {
            const loadingMsg = document.getElementById('quote-loading-message');
            if (loadingMsg) {
                loadingMsg.remove();
            }
        }

        // Toggle quote panel visibility
        toggleQuotePanel() {
            const panel = document.getElementById('quote-summary-panel');
            const toggleBtn = document.getElementById('quote-panel-toggle');
            
            if (!panel || !toggleBtn) return;
            
            const isOpen = panel.classList.contains('is-open');
            
            if (isOpen) {
                panel.classList.remove('is-open');
                toggleBtn.style.display = 'block';
            } else {
                panel.classList.add('is-open');
                toggleBtn.style.display = 'none';
            }
        }

        // Log analytics
        async logAnalytics(eventType, data = {}) {
            const analyticsData = {
                SessionID: this.currentQuote.sessionId,
                QuoteID: this.currentQuote.id,
                EventType: eventType,
                EmbellishmentType: this.embellishmentType,
                ...data
            };
            
            // Only log in debug mode
            if (window.DEBUG_MODE) {
                console.log(`[ANALYTICS:${this.embellishmentType.toUpperCase()}]`, eventType, analyticsData);
            }
            
            // Temporarily disable analytics API calls until backend is fixed
            // TODO: Re-enable when API endpoint is working
            return;
            
            try {
                const response = await fetch(`${this.config.apiBaseUrl}/quote_analytics`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(analyticsData)
                });
                
                if (response.ok && window.DEBUG_MODE) {
                    console.log(`[ANALYTICS:${this.embellishmentType.toUpperCase()}] Event logged successfully`);
                }
            } catch (error) {
                // Silently fail - analytics is not critical
                if (window.DEBUG_MODE) {
                    console.warn(`[ANALYTICS:${this.embellishmentType.toUpperCase()}] Failed to log event:`, error);
                }
            }
        }
    }

    // Export to global scope
    window.QuoteAdapterBase = QuoteAdapterBase;

})();