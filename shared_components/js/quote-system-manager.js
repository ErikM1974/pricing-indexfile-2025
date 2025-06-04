// Quote System Manager
// Handles all quote management features including My Quotes, customer management, and auto-save
// For Northwest Custom Apparel - January 2025

(function() {
    'use strict';

    class QuoteSystemManager {
        constructor() {
            this.currentQuote = null;
            this.currentCustomer = null;
            this.autoSaveInterval = null;
            this.autoSaveDelay = 5000; // 5 seconds
            this.lastSaveTime = null;
            this.pendingChanges = false;
            this.quotePanelVisible = false;
            
            // Initialize on DOM ready
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => this.init());
            } else {
                this.init();
            }
        }

        init() {
            console.log('[QUOTE-SYSTEM] Initializing Quote System Manager');
            this.createQuotePanel();
            this.bindEvents();
            this.loadSavedQuote();
            this.startAutoSave();
        }

        // Create the slide-out quote panel
        createQuotePanel() {
            const panel = document.createElement('div');
            panel.id = 'quote-panel';
            panel.className = 'quote-panel-enhanced';
            panel.innerHTML = `
                <div class="quote-panel-header">
                    <h2>Quote Management</h2>
                    <button class="quote-panel-close" id="close-quote-panel">×</button>
                </div>
                
                <div class="quote-panel-tabs">
                    <button class="quote-tab active" data-tab="current">Current Quote</button>
                    <button class="quote-tab" data-tab="myquotes">My Quotes</button>
                    <button class="quote-tab" data-tab="customer">Customer Info</button>
                </div>
                
                <div class="quote-panel-content">
                    <!-- Current Quote Tab -->
                    <div class="quote-tab-content active" id="current-quote-tab">
                        <div class="quote-info">
                            <h3>Quote Details</h3>
                            <div class="quote-id-display">
                                <span>Quote ID:</span>
                                <span id="current-quote-id">Not saved yet</span>
                                <button class="copy-btn" onclick="quoteSystemManager.copyQuoteID()">📋</button>
                            </div>
                            <div class="auto-save-status">
                                <span id="auto-save-indicator">✓ Auto-save enabled</span>
                                <span id="last-save-time"></span>
                            </div>
                        </div>
                        
                        <div class="quote-actions">
                            <button class="btn-primary" onclick="quoteSystemManager.saveQuote()">Save Quote</button>
                            <button class="btn-secondary" onclick="quoteSystemManager.duplicateQuote()">Duplicate Quote</button>
                            <button class="btn-secondary" onclick="quoteSystemManager.shareQuote()">Share Quote</button>
                            <button class="btn-danger" onclick="quoteSystemManager.clearQuote()">Clear Quote</button>
                        </div>
                        
                        <div class="quote-items-summary" id="quote-items-summary">
                            <!-- Quote items will be displayed here -->
                        </div>
                    </div>
                    
                    <!-- My Quotes Tab -->
                    <div class="quote-tab-content" id="myquotes-tab">
                        <div class="quotes-search">
                            <input type="email" id="email-search" placeholder="Enter email to find quotes" class="quote-search-input">
                            <button onclick="quoteSystemManager.searchQuotes()" class="btn-primary">Search</button>
                        </div>
                        
                        <div class="quotes-list" id="quotes-list">
                            <!-- Quote list will be populated here -->
                        </div>
                    </div>
                    
                    <!-- Customer Info Tab -->
                    <div class="quote-tab-content" id="customer-tab">
                        <form id="customer-form" class="customer-form">
                            <h3>Customer Information</h3>
                            
                            <div class="form-group">
                                <label for="customer-name">Name *</label>
                                <input type="text" id="customer-name" required>
                            </div>
                            
                            <div class="form-group">
                                <label for="customer-email">Email *</label>
                                <input type="email" id="customer-email" required>
                            </div>
                            
                            <div class="form-group">
                                <label for="customer-phone">Phone</label>
                                <input type="tel" id="customer-phone">
                            </div>
                            
                            <div class="form-group">
                                <label for="customer-company">Company</label>
                                <input type="text" id="customer-company">
                            </div>
                            
                            <div class="form-row">
                                <div class="form-group">
                                    <label for="customer-address1">Address Line 1</label>
                                    <input type="text" id="customer-address1">
                                </div>
                                
                                <div class="form-group">
                                    <label for="customer-address2">Address Line 2</label>
                                    <input type="text" id="customer-address2">
                                </div>
                            </div>
                            
                            <div class="form-row">
                                <div class="form-group">
                                    <label for="customer-city">City</label>
                                    <input type="text" id="customer-city">
                                </div>
                                
                                <div class="form-group">
                                    <label for="customer-state">State</label>
                                    <input type="text" id="customer-state" maxlength="2">
                                </div>
                                
                                <div class="form-group">
                                    <label for="customer-zip">Zip Code</label>
                                    <input type="text" id="customer-zip">
                                </div>
                            </div>
                            
                            <div class="form-group">
                                <label for="customer-notes">Notes</label>
                                <textarea id="customer-notes" rows="3"></textarea>
                            </div>
                            
                            <div class="form-actions">
                                <button type="submit" class="btn-primary">Save Customer</button>
                                <button type="button" onclick="quoteSystemManager.clearCustomerForm()" class="btn-secondary">Clear</button>
                            </div>
                        </form>
                    </div>
                </div>
            `;
            
            document.body.appendChild(panel);
            
            // Create overlay
            const overlay = document.createElement('div');
            overlay.id = 'quote-panel-overlay';
            overlay.className = 'quote-panel-overlay';
            document.body.appendChild(overlay);
        }

        // Bind all events
        bindEvents() {
            // Tab switching
            document.querySelectorAll('.quote-tab').forEach(tab => {
                tab.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
            });
            
            // Close panel
            document.getElementById('close-quote-panel').addEventListener('click', () => this.closePanel());
            document.getElementById('quote-panel-overlay').addEventListener('click', () => this.closePanel());
            
            // Customer form
            document.getElementById('customer-form').addEventListener('submit', (e) => this.saveCustomer(e));
            
            // Email search on enter
            document.getElementById('email-search').addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.searchQuotes();
            });
            
            // Auto-save triggers
            document.addEventListener('quoteItemAdded', () => {
                this.markForAutoSave();
                this.updateQuoteBadge();
            });
            document.addEventListener('quoteItemUpdated', () => {
                this.markForAutoSave();
                this.updateQuoteBadge();
            });
            document.addEventListener('quoteItemRemoved', () => {
                this.markForAutoSave();
                this.updateQuoteBadge();
            });
            
            // Quote updated event
            document.addEventListener('quoteUpdated', () => {
                this.updateQuoteBadge();
                this.markForAutoSave();
            });
        }

        // Switch between tabs
        switchTab(tabName) {
            // Update tab buttons
            document.querySelectorAll('.quote-tab').forEach(tab => {
                tab.classList.toggle('active', tab.dataset.tab === tabName);
            });
            
            // Update tab content
            document.querySelectorAll('.quote-tab-content').forEach(content => {
                content.classList.toggle('active', content.id === `${tabName}-tab`);
            });
            
            // Load data for specific tabs
            if (tabName === 'myquotes') {
                this.loadRecentQuotes();
            }
        }

        // Open/Close panel
        openPanel(tab = 'current') {
            document.getElementById('quote-panel').classList.add('is-open');
            document.getElementById('quote-panel-overlay').classList.add('visible');
            this.quotePanelVisible = true;
            this.switchTab(tab);
            
            // Update current quote display
            if (tab === 'current') {
                this.updateQuoteDisplay();
            }
        }

        closePanel() {
            document.getElementById('quote-panel').classList.remove('is-open');
            document.getElementById('quote-panel-overlay').classList.remove('visible');
            this.quotePanelVisible = false;
        }

        // Customer CRUD operations
        async saveCustomer(e) {
            e.preventDefault();
            
            const customerData = {
                Name: document.getElementById('customer-name').value,
                Email: document.getElementById('customer-email').value,
                Phone: document.getElementById('customer-phone').value,
                Company: document.getElementById('customer-company').value,
                Address1: document.getElementById('customer-address1').value,
                Address2: document.getElementById('customer-address2').value,
                City: document.getElementById('customer-city').value,
                State: document.getElementById('customer-state').value,
                ZipCode: document.getElementById('customer-zip').value,
                Notes: document.getElementById('customer-notes').value,
                DateCreated: new Date().toISOString()
            };
            
            try {
                let customer;
                if (this.currentCustomer && this.currentCustomer.CustomerID) {
                    // Update existing customer
                    customer = await window.quoteAPIClient.updateCustomer(
                        this.currentCustomer.CustomerID, 
                        customerData
                    );
                } else {
                    // Create new customer
                    customer = await window.quoteAPIClient.createCustomer(customerData);
                }
                
                this.currentCustomer = customer;
                this.showNotification('Customer saved successfully!', 'success');
                
                // Update quote with customer info
                if (this.currentQuote) {
                    this.currentQuote.customerEmail = customer.Email;
                    this.currentQuote.customerName = customer.Name;
                    this.markForAutoSave();
                }
                
            } catch (error) {
                console.error('[QUOTE-SYSTEM] Error saving customer:', error);
                this.showNotification('Error saving customer', 'error');
            }
        }

        clearCustomerForm() {
            document.getElementById('customer-form').reset();
            this.currentCustomer = null;
        }

        // Quote search functionality
        async searchQuotes() {
            const email = document.getElementById('email-search').value.trim();
            if (!email) {
                this.showNotification('Please enter an email address', 'warning');
                return;
            }
            
            try {
                const quotes = await window.quoteAPIClient.getQuotesByCustomerEmail(email);
                this.displayQuotesList(quotes);
                
                // Also load customer info
                const customer = await window.quoteAPIClient.getCustomerByEmail(email);
                if (customer) {
                    this.loadCustomerIntoForm(customer);
                }
                
            } catch (error) {
                console.error('[QUOTE-SYSTEM] Error searching quotes:', error);
                this.showNotification('Error searching quotes', 'error');
            }
        }

        displayQuotesList(quotes) {
            const container = document.getElementById('quotes-list');
            
            if (!quotes || quotes.length === 0) {
                container.innerHTML = '<p class="no-quotes">No quotes found for this email</p>';
                return;
            }
            
            // Filter out expired quotes
            const validQuotes = quotes.filter(quote => {
                const expiration = new Date(quote.ExpiresAt);
                return expiration > new Date();
            });
            
            container.innerHTML = validQuotes.map(quote => `
                <div class="quote-list-item">
                    <div class="quote-list-header">
                        <h4>${quote.QuoteID}</h4>
                        <span class="quote-date">${new Date(quote.CreatedAt).toLocaleDateString()}</span>
                    </div>
                    <div class="quote-list-details">
                        <p><strong>Total:</strong> $${quote.TotalAmount || 0}</p>
                        <p><strong>Items:</strong> ${quote.ItemCount || 0}</p>
                        <p><strong>Expires:</strong> ${new Date(quote.ExpiresAt).toLocaleDateString()}</p>
                    </div>
                    <div class="quote-list-actions">
                        <button class="btn-primary" onclick="quoteSystemManager.loadQuote('${quote.QuoteID}')">Load</button>
                        <button class="btn-secondary" onclick="quoteSystemManager.duplicateQuote('${quote.QuoteID}')">Duplicate</button>
                        <button class="btn-secondary" onclick="quoteSystemManager.viewQuotePDF('${quote.QuoteID}')">PDF</button>
                    </div>
                </div>
            `).join('');
        }

        // Load customer into form
        loadCustomerIntoForm(customer) {
            this.currentCustomer = customer;
            document.getElementById('customer-name').value = customer.Name || '';
            document.getElementById('customer-email').value = customer.Email || '';
            document.getElementById('customer-phone').value = customer.Phone || '';
            document.getElementById('customer-company').value = customer.Company || '';
            document.getElementById('customer-address1').value = customer.Address1 || '';
            document.getElementById('customer-address2').value = customer.Address2 || '';
            document.getElementById('customer-city').value = customer.City || '';
            document.getElementById('customer-state').value = customer.State || '';
            document.getElementById('customer-zip').value = customer.ZipCode || '';
            document.getElementById('customer-notes').value = customer.Notes || '';
            
            this.switchTab('customer');
        }

        // Auto-save functionality
        startAutoSave() {
            // Check for changes every second
            setInterval(() => {
                if (this.pendingChanges && this.lastSaveTime && 
                    (Date.now() - this.lastSaveTime) > this.autoSaveDelay) {
                    this.autoSaveQuote();
                }
            }, 1000);
        }

        markForAutoSave() {
            this.pendingChanges = true;
            document.getElementById('auto-save-indicator').textContent = '⏳ Saving...';
        }

        async autoSaveQuote() {
            if (!this.pendingChanges) return;
            
            try {
                await this.saveQuote(true); // true = auto-save
                this.pendingChanges = false;
                this.lastSaveTime = Date.now();
                
                document.getElementById('auto-save-indicator').textContent = '✓ Auto-saved';
                document.getElementById('last-save-time').textContent = 
                    `Last saved: ${new Date().toLocaleTimeString()}`;
                    
            } catch (error) {
                console.error('[QUOTE-SYSTEM] Auto-save error:', error);
                document.getElementById('auto-save-indicator').textContent = '⚠️ Auto-save failed';
            }
        }

        // Save quote
        async saveQuote(isAutoSave = false) {
            try {
                // Get current quote items from the quote adapter
                const quoteAdapter = window.capEmbroideryQuoteAdapter || window.currentQuoteAdapter;
                if (!quoteAdapter) {
                    throw new Error('Quote adapter not found');
                }
                
                const items = quoteAdapter.getItems();
                if (items.length === 0 && !isAutoSave) {
                    this.showNotification('No items in quote', 'warning');
                    return;
                }
                
                // Create or update quote session
                if (!this.currentQuote || !this.currentQuote.quoteID) {
                    // Create new quote
                    const quoteID = window.quoteAPIClient.generateQuoteID();
                    const sessionID = window.quoteAPIClient.generateSessionID();
                    
                    const sessionData = {
                        SessionID: sessionID,
                        QuoteID: quoteID,
                        CustomerEmail: this.currentCustomer?.Email || '',
                        CustomerName: this.currentCustomer?.Name || '',
                        EmbellishmentType: 'Cap Embroidery',
                        TotalAmount: quoteAdapter.getTotal(),
                        ItemCount: items.length,
                        Status: 'Draft',
                        CreatedAt: new Date().toISOString(),
                        LastUpdated: new Date().toISOString()
                    };
                    
                    const session = await window.quoteAPIClient.createQuoteSession(sessionData);
                    this.currentQuote = session;
                    
                } else {
                    // Update existing quote
                    const updates = {
                        TotalAmount: quoteAdapter.getTotal(),
                        ItemCount: items.length,
                        LastUpdated: new Date().toISOString()
                    };
                    
                    await window.quoteAPIClient.updateQuoteSession(
                        this.currentQuote.PK_ID, 
                        updates
                    );
                }
                
                // Save quote items
                for (let i = 0; i < items.length; i++) {
                    const item = items[i];
                    const apiItem = window.quoteAPIClient.formatQuoteItemForAPI(
                        item, 
                        this.currentQuote.QuoteID, 
                        i + 1
                    );
                    
                    if (item.apiId) {
                        // Update existing item
                        await window.quoteAPIClient.updateQuoteItem(item.apiId, apiItem);
                    } else {
                        // Create new item
                        const savedItem = await window.quoteAPIClient.createQuoteItem(apiItem);
                        item.apiId = savedItem.PK_ID;
                    }
                }
                
                // Update display
                document.getElementById('current-quote-id').textContent = this.currentQuote.QuoteID;
                
                if (!isAutoSave) {
                    this.showNotification('Quote saved successfully!', 'success');
                }
                
                // Store quote ID in localStorage
                localStorage.setItem('currentQuoteID', this.currentQuote.QuoteID);
                
            } catch (error) {
                console.error('[QUOTE-SYSTEM] Error saving quote:', error);
                if (!isAutoSave) {
                    this.showNotification('Error saving quote', 'error');
                }
            }
        }

        // Load saved quote
        async loadSavedQuote() {
            const savedQuoteID = localStorage.getItem('currentQuoteID');
            if (savedQuoteID) {
                try {
                    await this.loadQuote(savedQuoteID);
                } catch (error) {
                    console.error('[QUOTE-SYSTEM] Error loading saved quote:', error);
                    localStorage.removeItem('currentQuoteID');
                }
            }
        }

        // Load quote by ID
        async loadQuote(quoteID) {
            try {
                // Get quote session
                const session = await window.quoteAPIClient.getQuoteSessionByQuoteID(quoteID);
                if (!session) {
                    throw new Error('Quote not found');
                }
                
                this.currentQuote = session;
                
                // Get quote items
                const items = await window.quoteAPIClient.getQuoteItems(quoteID);
                
                // Load items into quote adapter
                const quoteAdapter = window.capEmbroideryQuoteAdapter || window.currentQuoteAdapter;
                if (quoteAdapter) {
                    quoteAdapter.clearItems();
                    items.forEach(apiItem => {
                        const localItem = window.quoteAPIClient.convertAPIItemToLocal(apiItem);
                        quoteAdapter.addItem(localItem);
                    });
                }
                
                // Load customer info if available
                if (session.CustomerEmail) {
                    const customer = await window.quoteAPIClient.getCustomerByEmail(session.CustomerEmail);
                    if (customer) {
                        this.loadCustomerIntoForm(customer);
                    }
                }
                
                // Update display
                document.getElementById('current-quote-id').textContent = quoteID;
                this.updateQuoteDisplay();
                this.closePanel();
                
                this.showNotification('Quote loaded successfully!', 'success');
                
            } catch (error) {
                console.error('[QUOTE-SYSTEM] Error loading quote:', error);
                this.showNotification('Error loading quote', 'error');
            }
        }

        // Duplicate quote
        async duplicateQuote(quoteID = null) {
            try {
                const sourceQuoteID = quoteID || this.currentQuote?.QuoteID;
                if (!sourceQuoteID) {
                    this.showNotification('No quote to duplicate', 'warning');
                    return;
                }
                
                // Get source quote
                const sourceSession = await window.quoteAPIClient.getQuoteSessionByQuoteID(sourceQuoteID);
                const sourceItems = await window.quoteAPIClient.getQuoteItems(sourceQuoteID);
                
                // Create new quote
                const newQuoteID = window.quoteAPIClient.generateQuoteID();
                const newSessionID = window.quoteAPIClient.generateSessionID();
                
                const newSessionData = {
                    ...sourceSession,
                    SessionID: newSessionID,
                    QuoteID: newQuoteID,
                    Status: 'Draft',
                    CreatedAt: new Date().toISOString(),
                    LastUpdated: new Date().toISOString()
                };
                
                delete newSessionData.PK_ID; // Remove ID so new one is created
                
                const newSession = await window.quoteAPIClient.createQuoteSession(newSessionData);
                
                // Copy items
                for (const item of sourceItems) {
                    const newItem = { ...item, QuoteID: newQuoteID };
                    delete newItem.PK_ID;
                    await window.quoteAPIClient.createQuoteItem(newItem);
                }
                
                // Load the new quote
                await this.loadQuote(newQuoteID);
                
                this.showNotification('Quote duplicated successfully!', 'success');
                
            } catch (error) {
                console.error('[QUOTE-SYSTEM] Error duplicating quote:', error);
                this.showNotification('Error duplicating quote', 'error');
            }
        }

        // Clear current quote
        clearQuote() {
            if (confirm('Are you sure you want to clear the current quote?')) {
                this.currentQuote = null;
                localStorage.removeItem('currentQuoteID');
                
                const quoteAdapter = window.capEmbroideryQuoteAdapter || window.currentQuoteAdapter;
                if (quoteAdapter) {
                    quoteAdapter.clearItems();
                }
                
                document.getElementById('current-quote-id').textContent = 'Not saved yet';
                this.updateQuoteDisplay();
                this.showNotification('Quote cleared', 'info');
            }
        }

        // Update quote display
        updateQuoteDisplay() {
            const quoteAdapter = window.capEmbroideryQuoteAdapter || window.currentQuoteAdapter;
            if (!quoteAdapter) return;
            
            const items = quoteAdapter.getItems();
            const container = document.getElementById('quote-items-summary');
            
            if (items.length === 0) {
                container.innerHTML = '<p class="no-items">No items in quote</p>';
                return;
            }
            
            container.innerHTML = `
                <h4>Quote Summary</h4>
                <div class="quote-summary-items">
                    ${items.map((item, index) => `
                        <div class="quote-summary-item">
                            <span class="item-number">${index + 1}.</span>
                            <span class="item-details">
                                ${item.productName} - ${item.color} 
                                (Qty: ${item.quantity})
                            </span>
                            <span class="item-price">$${item.lineTotal.toFixed(2)}</span>
                        </div>
                    `).join('')}
                </div>
                <div class="quote-summary-total">
                    <strong>Total:</strong> 
                    <span>$${quoteAdapter.getTotal().toFixed(2)}</span>
                </div>
            `;
        }

        // Copy quote ID to clipboard
        copyQuoteID() {
            const quoteID = this.currentQuote?.QuoteID;
            if (!quoteID) {
                this.showNotification('No quote ID to copy', 'warning');
                return;
            }
            
            navigator.clipboard.writeText(quoteID).then(() => {
                this.showNotification('Quote ID copied!', 'success');
            }).catch(() => {
                this.showNotification('Failed to copy quote ID', 'error');
            });
        }

        // Share quote
        shareQuote() {
            const quoteID = this.currentQuote?.QuoteID;
            if (!quoteID) {
                this.showNotification('Please save the quote first', 'warning');
                return;
            }
            
            const shareUrl = `${window.location.origin}/quote/${quoteID}`;
            
            if (navigator.share) {
                navigator.share({
                    title: 'Northwest Custom Apparel Quote',
                    text: `Quote ID: ${quoteID}`,
                    url: shareUrl
                }).catch(() => {
                    // User cancelled or error
                });
            } else {
                // Fallback - copy link
                navigator.clipboard.writeText(shareUrl).then(() => {
                    this.showNotification('Quote link copied!', 'success');
                });
            }
        }

        // View quote as PDF
        viewQuotePDF(quoteID) {
            // This will trigger the existing PDF generation
            if (window.generateQuotePDF) {
                window.generateQuotePDF(quoteID);
            }
        }

        // Load recent quotes
        async loadRecentQuotes() {
            // Check if we have a customer email from form or saved
            const email = document.getElementById('customer-email').value || 
                         this.currentCustomer?.Email;
                         
            if (email) {
                document.getElementById('email-search').value = email;
                await this.searchQuotes();
            }
        }

        // Show notification
        showNotification(message, type = 'info') {
            const notification = document.createElement('div');
            notification.className = `notification notification-${type}`;
            notification.textContent = message;
            
            document.body.appendChild(notification);
            
            setTimeout(() => {
                notification.classList.add('show');
            }, 10);
            
            setTimeout(() => {
                notification.classList.remove('show');
                setTimeout(() => notification.remove(), 300);
            }, 3000);
        }
        
        // Update quote badge with item count
        updateQuoteBadge() {
            const badge = document.getElementById('quote-item-count');
            if (!badge) return;
            
            const quoteAdapter = window.capEmbroideryQuoteAdapter || window.currentQuoteAdapter;
            if (!quoteAdapter) return;
            
            const items = quoteAdapter.getItems();
            badge.textContent = items.length;
            
            // Show/hide badge based on count
            if (items.length > 0) {
                badge.style.display = 'flex';
            } else {
                badge.style.display = 'none';
            }
        }
    }

    // Create singleton instance
    const quoteSystemManager = new QuoteSystemManager();

    // Export to global scope
    window.QuoteSystemManager = QuoteSystemManager;
    window.quoteSystemManager = quoteSystemManager;

    // Add global function for opening quote panel
    window.toggleQuickQuote = function() {
        if (quoteSystemManager.quotePanelVisible) {
            quoteSystemManager.closePanel();
        } else {
            quoteSystemManager.openPanel();
        }
    };

    console.log('[QUOTE-SYSTEM] Quote System Manager initialized');

})();