// Simple Quote Dropdown
// Clean, header-integrated quote management
// For Northwest Custom Apparel - January 2025

(function() {
    'use strict';

    class SimpleQuoteDropdown {
        constructor() {
            this.isOpen = false;
            this.init();
        }

        init() {
            // Wait for header to be ready
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => this.setup());
            } else {
                this.setup();
            }
        }

        setup() {
            this.injectQuoteButton();
            this.bindEvents();
            this.updateBadge();
        }

        injectQuoteButton() {
            // Find header actions area
            const headerActions = document.querySelector('.header-actions');
            if (!headerActions) {
                console.warn('[QUOTE-DROPDOWN] Header actions area not found');
                return;
            }

            // Create quote button container
            const quoteContainer = document.createElement('div');
            quoteContainer.className = 'header-quote-container';
            quoteContainer.style.position = 'relative';
            quoteContainer.innerHTML = `
                <button class="header-action-btn" id="header-quote-btn" style="position: relative;">
                    <span>📋 Quote</span>
                    <span class="header-quote-count" id="header-quote-count" style="display: none;">0</span>
                </button>
                
                <div class="quote-dropdown" id="quote-dropdown">
                    <div class="dropdown-header">
                        Your Quote
                    </div>
                    
                    <div class="dropdown-items" id="dropdown-items">
                        <!-- Items will be populated here -->
                    </div>
                    
                    <div class="dropdown-footer">
                        <div class="dropdown-total">
                            <span>Total:</span>
                            <span id="dropdown-total">$0.00</span>
                        </div>
                        <div class="dropdown-actions">
                            <button class="dropdown-btn primary" onclick="simpleQuote.viewFullQuote()">
                                View Full Quote
                            </button>
                            <button class="dropdown-btn secondary" onclick="simpleQuote.clearQuote()">
                                Clear
                            </button>
                        </div>
                    </div>
                </div>
            `;

            // Insert before last button in header
            const lastButton = headerActions.lastElementChild;
            headerActions.insertBefore(quoteContainer, lastButton);
        }

        bindEvents() {
            // Toggle dropdown
            const quoteBtn = document.getElementById('header-quote-btn');
            if (quoteBtn) {
                quoteBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.toggleDropdown();
                });
            }

            // Close on outside click
            document.addEventListener('click', (e) => {
                if (!e.target.closest('.header-quote-container')) {
                    this.closeDropdown();
                }
            });

            // Listen for quote updates
            document.addEventListener('quoteItemAdded', () => {
                this.updateDropdown();
                this.showAddedNotification();
            });

            document.addEventListener('quoteItemUpdated', () => {
                this.updateDropdown();
            });

            document.addEventListener('quoteItemRemoved', () => {
                this.updateDropdown();
            });

            document.addEventListener('quoteUpdated', () => {
                this.updateDropdown();
            });
        }

        toggleDropdown() {
            const dropdown = document.getElementById('quote-dropdown');
            if (!dropdown) return;

            this.isOpen = !this.isOpen;
            if (this.isOpen) {
                dropdown.classList.add('show');
                this.updateDropdown();
            } else {
                dropdown.classList.remove('show');
            }
        }

        closeDropdown() {
            const dropdown = document.getElementById('quote-dropdown');
            if (dropdown) {
                dropdown.classList.remove('show');
                this.isOpen = false;
            }
        }

        updateDropdown() {
            this.updateBadge();
            if (this.isOpen) {
                this.updateItems();
            }
        }

        updateBadge() {
            const badge = document.getElementById('header-quote-count');
            if (!badge) return;

            const quoteAdapter = window.capEmbroideryQuoteAdapter || window.currentQuoteAdapter;
            if (!quoteAdapter) return;

            const items = quoteAdapter.getItems();
            const count = items.length;

            if (count > 0) {
                badge.textContent = count;
                badge.style.display = 'inline-flex';
            } else {
                badge.style.display = 'none';
            }
        }

        updateItems() {
            const quoteAdapter = window.capEmbroideryQuoteAdapter || window.currentQuoteAdapter;
            if (!quoteAdapter) return;

            const items = quoteAdapter.getItems();
            const total = quoteAdapter.getTotal();

            // Update total
            const totalElement = document.getElementById('dropdown-total');
            if (totalElement) {
                totalElement.textContent = `$${total.toFixed(2)}`;
            }

            // Update items list
            const container = document.getElementById('dropdown-items');
            if (!container) return;

            if (items.length === 0) {
                container.innerHTML = `
                    <div class="dropdown-empty">
                        <div class="dropdown-empty-icon">📋</div>
                        <div>No items in quote</div>
                    </div>
                `;
            } else {
                container.innerHTML = items.map((item, index) => `
                    <div class="dropdown-item">
                        <div class="item-info">
                            <div class="item-name">${item.productName}</div>
                            <div class="item-details">
                                ${item.color} • Qty: ${item.quantity}
                            </div>
                        </div>
                        <div class="item-price">$${item.lineTotal.toFixed(2)}</div>
                        <button class="item-remove" onclick="simpleQuote.removeItem('${item.id || index}')" title="Remove">×</button>
                    </div>
                `).join('');
            }
        }

        removeItem(itemId) {
            const quoteAdapter = window.capEmbroideryQuoteAdapter || window.currentQuoteAdapter;
            if (quoteAdapter) {
                quoteAdapter.removeItem(itemId);
                this.updateDropdown();
            }
        }

        clearQuote() {
            if (confirm('Remove all items from quote?')) {
                const quoteAdapter = window.capEmbroideryQuoteAdapter || window.currentQuoteAdapter;
                if (quoteAdapter) {
                    quoteAdapter.clearItems();
                    this.updateDropdown();
                    this.closeDropdown();
                }
            }
        }

        viewFullQuote() {
            this.closeDropdown();
            
            // Create a simple modal for full quote view
            this.createFullQuoteModal();
        }
        
        createFullQuoteModal() {
            // Remove existing modal if any
            const existingModal = document.getElementById('full-quote-modal');
            if (existingModal) existingModal.remove();
            
            const quoteAdapter = window.capEmbroideryQuoteAdapter || window.currentQuoteAdapter;
            if (!quoteAdapter) return;
            
            const items = quoteAdapter.getItems();
            const total = quoteAdapter.getTotal();
            
            const modal = document.createElement('div');
            modal.innerHTML = `
                <div id="full-quote-modal" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 1000; display: flex; align-items: center; justify-content: center;">
                    <div style="background: white; border-radius: 12px; width: 90%; max-width: 600px; max-height: 80vh; overflow: hidden; display: flex; flex-direction: column;">
                        <div style="background: #5ab738; color: white; padding: 20px; display: flex; justify-content: space-between; align-items: center;">
                            <h2 style="margin: 0;">Quote Details</h2>
                            <button onclick="document.getElementById('full-quote-modal').remove()" style="background: none; border: none; color: white; font-size: 24px; cursor: pointer;">×</button>
                        </div>
                        
                        <div style="flex: 1; overflow-y: auto; padding: 20px;">
                            <h3>Quote Items</h3>
                            ${items.length === 0 ? '<p>No items in quote</p>' : items.map(item => `
                                <div style="border: 1px solid #eee; border-radius: 8px; padding: 12px; margin-bottom: 12px;">
                                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                                        <strong>${item.productName}</strong>
                                        <strong>$${item.lineTotal.toFixed(2)}</strong>
                                    </div>
                                    <div style="color: #666; font-size: 14px;">
                                        Color: ${item.color} | Qty: ${item.quantity} | $${item.finalUnitPrice.toFixed(2)} each
                                    </div>
                                </div>
                            `).join('')}
                            
                            <div style="margin-top: 20px; padding-top: 20px; border-top: 2px solid #eee;">
                                <div style="display: flex; justify-content: space-between; font-size: 20px; font-weight: bold; color: #5ab738;">
                                    <span>Total:</span>
                                    <span>$${total.toFixed(2)}</span>
                                </div>
                            </div>
                        </div>
                        
                        <div style="padding: 20px; background: #f9f9f9; border-top: 1px solid #eee;">
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                                <button onclick="simpleQuote.downloadPDF()" style="padding: 12px; background: white; border: 1px solid #ddd; border-radius: 6px; cursor: pointer;">
                                    📄 Download PDF
                                </button>
                                <button onclick="simpleQuote.emailQuote()" style="padding: 12px; background: #5ab738; color: white; border: none; border-radius: 6px; cursor: pointer;">
                                    ✉️ Email Quote
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal.firstElementChild);
        }
        
        downloadPDF() {
            if (window.generateQuotePDF) {
                window.generateQuotePDF();
            } else {
                alert('PDF generation will be available soon');
            }
        }
        
        emailQuote() {
            const quoteAdapter = window.capEmbroideryQuoteAdapter || window.currentQuoteAdapter;
            if (!quoteAdapter) return;
            
            const items = quoteAdapter.getItems();
            const total = quoteAdapter.getTotal();
            
            let itemsList = items.map(item => 
                `- ${item.productName} (${item.color}) - Qty: ${item.quantity} - $${item.lineTotal.toFixed(2)}`
            ).join('\\n');
            
            const subject = 'Quote Request - Northwest Custom Apparel';
            const body = `I would like to request a quote for the following items:\\n\\n${itemsList}\\n\\nTotal: $${total.toFixed(2)}\\n\\nPlease contact me with pricing and availability.`;
            
            window.location.href = `mailto:sales@nwcustomapparel.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        }

        showAddedNotification() {
            const notification = document.createElement('div');
            notification.className = 'add-to-quote-success';
            notification.innerHTML = `
                <span>✓</span>
                <span>Item added to quote</span>
            `;
            
            document.body.appendChild(notification);
            
            // Animate in
            setTimeout(() => notification.classList.add('show'), 10);
            
            // Animate out
            setTimeout(() => {
                notification.classList.remove('show');
                setTimeout(() => notification.remove(), 300);
            }, 2500);
        }
    }

    // Create singleton instance
    const simpleQuote = new SimpleQuoteDropdown();

    // Export to global scope
    window.SimpleQuoteDropdown = SimpleQuoteDropdown;
    window.simpleQuote = simpleQuote;

    console.log('[QUOTE-DROPDOWN] Simple Quote Dropdown initialized');

})();