// Modern Quote Widget
// Clean, unobtrusive quote management
// For Northwest Custom Apparel - January 2025

(function() {
    'use strict';

    class QuoteWidget {
        constructor() {
            this.isModalOpen = false;
            this.init();
        }

        init() {
            this.createWidget();
            this.bindEvents();
            this.updateBadge();
        }

        createWidget() {
            // Create widget container
            const widget = document.createElement('div');
            widget.className = 'quote-widget';
            widget.innerHTML = `
                <!-- Main Widget Button -->
                <button class="quote-widget-button" id="quote-widget-btn">
                    <span class="quote-widget-icon">🛒</span>
                    <span class="quote-widget-badge" id="quote-widget-badge" style="display: none;">0</span>
                </button>
                
                <!-- Mini Preview -->
                <div class="quote-mini-preview" id="quote-mini-preview">
                    <div class="mini-preview-header">
                        <h4 class="mini-preview-title">Quote Summary</h4>
                        <span id="mini-item-count">0 items</span>
                    </div>
                    <div class="mini-preview-content" id="mini-preview-items">
                        <!-- Items will be populated here -->
                    </div>
                    <div class="mini-preview-total">
                        <span>Total:</span>
                        <span id="mini-total">$0.00</span>
                    </div>
                    <div class="mini-preview-actions">
                        <button class="mini-preview-btn primary" onclick="quoteWidget.openModal()">
                            View Full Quote
                        </button>
                        <button class="mini-preview-btn secondary" onclick="quoteWidget.clearQuote()">
                            Clear
                        </button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(widget);
            
            // Create modal
            this.createModal();
            
            // Create backdrop
            const backdrop = document.createElement('div');
            backdrop.className = 'quote-backdrop';
            backdrop.id = 'quote-backdrop';
            document.body.appendChild(backdrop);
        }

        createModal() {
            const modal = document.createElement('div');
            modal.className = 'quote-modal';
            modal.id = 'quote-modal';
            modal.innerHTML = `
                <div class="quote-modal-header">
                    <h2>Your Quote</h2>
                    <button class="quote-modal-close" onclick="quoteWidget.closeModal()">×</button>
                </div>
                
                <div class="quote-modal-body">
                    <!-- Customer Info Section -->
                    <div class="modal-section">
                        <h3>Customer Information</h3>
                        <form id="widget-customer-form" class="compact-form">
                            <div class="form-row">
                                <input type="text" placeholder="Name *" id="widget-customer-name" required>
                                <input type="email" placeholder="Email *" id="widget-customer-email" required>
                            </div>
                            <div class="form-row">
                                <input type="tel" placeholder="Phone" id="widget-customer-phone">
                                <input type="text" placeholder="Company" id="widget-customer-company">
                            </div>
                        </form>
                    </div>
                    
                    <!-- Quote Items -->
                    <div class="modal-section">
                        <h3>Quote Items</h3>
                        <div id="modal-quote-items">
                            <!-- Items will be populated here -->
                        </div>
                    </div>
                    
                    <!-- Actions -->
                    <div class="modal-section">
                        <h3>Quick Actions</h3>
                        <div class="action-buttons">
                            <button class="action-btn" onclick="quoteWidget.saveQuote()">
                                💾 Save Quote
                            </button>
                            <button class="action-btn" onclick="quoteWidget.emailQuote()">
                                ✉️ Email Quote
                            </button>
                            <button class="action-btn" onclick="quoteWidget.downloadPDF()">
                                📄 Download PDF
                            </button>
                        </div>
                    </div>
                    
                    <!-- My Quotes -->
                    <div class="modal-section">
                        <h3>Find Previous Quotes</h3>
                        <div class="search-box">
                            <input type="email" placeholder="Enter email to search" id="widget-quote-search">
                            <button onclick="quoteWidget.searchQuotes()">Search</button>
                        </div>
                        <div id="widget-search-results"></div>
                    </div>
                </div>
                
                <div class="quote-modal-footer">
                    <div class="footer-total">
                        <strong>Total: <span id="modal-total">$0.00</span></strong>
                    </div>
                    <button class="btn-primary" onclick="quoteWidget.submitQuote()">
                        Submit Quote Request
                    </button>
                </div>
            `;
            
            document.body.appendChild(modal);
        }

        bindEvents() {
            // Widget button click - toggle modal
            document.getElementById('quote-widget-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                this.openModal();
            });
            
            // Backdrop click - close modal
            document.getElementById('quote-backdrop').addEventListener('click', () => {
                this.closeModal();
            });
            
            // Prevent mini preview from closing when clicking inside
            document.getElementById('quote-mini-preview').addEventListener('click', (e) => {
                e.stopPropagation();
            });
            
            // Listen for quote updates
            document.addEventListener('quoteItemAdded', () => {
                this.updateWidget();
                this.showToast('Item added to quote');
                this.pulseButton();
            });
            
            document.addEventListener('quoteItemUpdated', () => {
                this.updateWidget();
            });
            
            document.addEventListener('quoteItemRemoved', () => {
                this.updateWidget();
            });
            
            // Auto-save integration
            document.addEventListener('quoteSaved', () => {
                this.showToast('Quote saved automatically');
            });
        }

        updateWidget() {
            this.updateBadge();
            this.updateMiniPreview();
            if (this.isModalOpen) {
                this.updateModalContent();
            }
        }

        updateBadge() {
            const badge = document.getElementById('quote-widget-badge');
            const quoteAdapter = window.capEmbroideryQuoteAdapter || window.currentQuoteAdapter;
            
            if (!quoteAdapter) return;
            
            const items = quoteAdapter.getItems();
            const count = items.length;
            
            if (count > 0) {
                badge.textContent = count;
                badge.style.display = 'flex';
            } else {
                badge.style.display = 'none';
            }
        }

        updateMiniPreview() {
            const quoteAdapter = window.capEmbroideryQuoteAdapter || window.currentQuoteAdapter;
            if (!quoteAdapter) return;
            
            const items = quoteAdapter.getItems();
            const total = quoteAdapter.getTotal();
            
            // Update item count
            document.getElementById('mini-item-count').textContent = 
                items.length === 1 ? '1 item' : `${items.length} items`;
            
            // Update total
            document.getElementById('mini-total').textContent = `$${total.toFixed(2)}`;
            
            // Update items list
            const container = document.getElementById('mini-preview-items');
            if (items.length === 0) {
                container.innerHTML = '<p style="text-align: center; color: #999;">No items in quote</p>';
            } else {
                container.innerHTML = items.slice(0, 3).map(item => `
                    <div class="mini-preview-item">
                        <span>${item.productName} - ${item.color}</span>
                        <span>$${item.lineTotal.toFixed(2)}</span>
                    </div>
                `).join('');
                
                if (items.length > 3) {
                    container.innerHTML += `
                        <div class="mini-preview-item" style="text-align: center; color: #666;">
                            ... and ${items.length - 3} more items
                        </div>
                    `;
                }
            }
        }

        openModal() {
            this.isModalOpen = true;
            document.getElementById('quote-modal').classList.add('active');
            document.getElementById('quote-backdrop').classList.add('active');
            document.body.style.overflow = 'hidden';
            this.updateModalContent();
        }

        closeModal() {
            this.isModalOpen = false;
            document.getElementById('quote-modal').classList.remove('active');
            document.getElementById('quote-backdrop').classList.remove('active');
            document.body.style.overflow = '';
        }

        updateModalContent() {
            const quoteAdapter = window.capEmbroideryQuoteAdapter || window.currentQuoteAdapter;
            if (!quoteAdapter) return;
            
            const items = quoteAdapter.getItems();
            const total = quoteAdapter.getTotal();
            
            // Update total
            document.getElementById('modal-total').textContent = `$${total.toFixed(2)}`;
            
            // Update items
            const container = document.getElementById('modal-quote-items');
            if (items.length === 0) {
                container.innerHTML = '<p style="text-align: center; color: #999;">No items in quote</p>';
            } else {
                container.innerHTML = items.map((item, index) => `
                    <div class="quote-item-card">
                        <div class="item-header">
                            <strong>${item.productName}</strong>
                            <button onclick="quoteWidget.removeItem(${index})" class="remove-btn">×</button>
                        </div>
                        <div class="item-details">
                            <span>Color: ${item.color}</span>
                            <span>Qty: ${item.quantity}</span>
                            <span>$${item.finalUnitPrice.toFixed(2)} each</span>
                        </div>
                        <div class="item-total">
                            Total: $${item.lineTotal.toFixed(2)}
                        </div>
                    </div>
                `).join('');
            }
        }

        async saveQuote() {
            try {
                // Get customer info
                const customerData = {
                    name: document.getElementById('widget-customer-name').value,
                    email: document.getElementById('widget-customer-email').value,
                    phone: document.getElementById('widget-customer-phone').value,
                    company: document.getElementById('widget-customer-company').value
                };
                
                // Save via quote system manager
                if (window.quoteSystemManager) {
                    await window.quoteSystemManager.saveQuote();
                    this.showToast('Quote saved successfully!');
                }
            } catch (error) {
                this.showToast('Error saving quote', 'error');
            }
        }

        async searchQuotes() {
            const email = document.getElementById('widget-quote-search').value;
            if (!email) return;
            
            try {
                const quotes = await window.quoteAPIClient.getQuotesByCustomerEmail(email);
                const resultsDiv = document.getElementById('widget-search-results');
                
                if (quotes.length === 0) {
                    resultsDiv.innerHTML = '<p>No quotes found</p>';
                } else {
                    resultsDiv.innerHTML = quotes.map(quote => `
                        <div class="search-result-item">
                            <span>${quote.QuoteID}</span>
                            <span>$${quote.TotalAmount || 0}</span>
                            <button onclick="quoteWidget.loadQuote('${quote.QuoteID}')">Load</button>
                        </div>
                    `).join('');
                }
            } catch (error) {
                this.showToast('Error searching quotes', 'error');
            }
        }

        clearQuote() {
            if (confirm('Clear all items from quote?')) {
                const quoteAdapter = window.capEmbroideryQuoteAdapter || window.currentQuoteAdapter;
                if (quoteAdapter) {
                    quoteAdapter.clearItems();
                }
                this.updateWidget();
                this.showToast('Quote cleared');
            }
        }

        removeItem(index) {
            const quoteAdapter = window.capEmbroideryQuoteAdapter || window.currentQuoteAdapter;
            if (quoteAdapter) {
                const items = quoteAdapter.getItems();
                if (items[index]) {
                    quoteAdapter.removeItem(items[index].id);
                    this.updateWidget();
                }
            }
        }

        showToast(message, type = 'success') {
            const toast = document.createElement('div');
            toast.className = `quote-toast ${type}`;
            toast.innerHTML = `
                <span class="quote-toast-icon">${type === 'success' ? '✓' : '⚠️'}</span>
                <span class="quote-toast-message">${message}</span>
            `;
            
            document.body.appendChild(toast);
            
            setTimeout(() => toast.classList.add('show'), 10);
            
            setTimeout(() => {
                toast.classList.remove('show');
                setTimeout(() => toast.remove(), 300);
            }, 3000);
        }

        pulseButton() {
            const button = document.getElementById('quote-widget-btn');
            button.classList.add('pulse');
            setTimeout(() => button.classList.remove('pulse'), 2000);
        }
    }

    // Create singleton instance
    const quoteWidget = new QuoteWidget();

    // Export to global scope
    window.QuoteWidget = QuoteWidget;
    window.quoteWidget = quoteWidget;

    console.log('[QUOTE-WIDGET] Modern Quote Widget initialized');

})();