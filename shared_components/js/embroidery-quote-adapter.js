// Embroidery Quote Adapter
// Extends QuoteAdapterBase for embroidery-specific functionality
// For Northwest Custom Apparel - June 2025

(function() {
    'use strict';

    // Embroidery-specific configuration
    const EMBROIDERY_CONFIG = {
        defaultStitchCount: 8000,
        ltmThreshold: 24,
        ltmFee: 50.00,
        embellishmentType: 'embroidery'
    };

    class EmbroideryQuoteAdapter extends window.QuoteAdapterBase {
        constructor() {
            super('embroidery', EMBROIDERY_CONFIG);
            this.stitchCount = EMBROIDERY_CONFIG.defaultStitchCount;
        }

        // Override setupUI for embroidery-specific UI
        setupUI() {
            console.log('[QUOTE:EMBROIDERY] Setting up embroidery quote UI');
            
            // Replace "Add to Cart" section with quote builder
            const cartSection = document.getElementById('add-to-cart-section');
            if (cartSection) {
                cartSection.innerHTML = this.getQuoteBuilderHTML();
            }

            // Add quote summary panel
            this.addQuoteSummaryPanel();
            
            // Initialize size quantity grid
            this.initializeSizeQuantityGrid();
        }

        // Override getQuoteBuilderHTML for embroidery-specific content
        getQuoteBuilderHTML() {
            return `
                <div class="quote-builder-container">
                    <h3 class="section-title" style="color: ${this.config.brandColor};">Build Your Embroidery Quote</h3>
                    
                    <!-- Stitch Count Display -->
                    <div class="stitch-count-info" style="background-color: var(--primary-light); padding: 15px; border-radius: var(--radius-sm); margin-bottom: 20px; border-left: 3px solid var(--primary-color);">
                        <p style="margin: 0; font-weight: bold; color: var(--primary-color);">
                            <span style="font-size: 1.2em;">📍</span> 
                            Pricing includes ${this.stitchCount.toLocaleString()} stitch embroidered logo
                        </p>
                    </div>
                    
                    <!-- Size Quantity Grid -->
                    <div id="size-quantity-grid-container" style="margin: 20px 0; padding: 15px; background-color: var(--background-light); border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
                        <h4 style="margin-top: 0; color: var(--primary-color);">Enter Quantities by Size</h4>
                        <div id="size-quantity-grid">
                            <!-- Will be populated by initializeSizeQuantityGrid -->
                        </div>
                        
                        <!-- Total Quantity Display -->
                        <div class="total-quantity-display" style="margin-top: 15px; padding: 10px; background-color: white; border-radius: var(--radius-sm); text-align: center;">
                            <span style="font-weight: bold;">Total Quantity:</span>
                            <span id="total-quantity-value" style="font-size: 1.2em; color: var(--primary-color); font-weight: bold;">0</span>
                        </div>
                    </div>
                    
                    <!-- Add to Quote Button -->
                    <div class="quote-actions" style="margin-top: 20px;">
                        <button id="add-to-quote-btn" class="btn-primary" style="width: 100%; padding: 15px; font-size: 1.1em; background-color: var(--primary-color); color: white; border: none; border-radius: var(--radius-sm); cursor: pointer; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;">
                            <span style="margin-right: 8px;">➕</span> Add to Quote
                        </button>
                    </div>
                    
                    <!-- Quote Summary Section -->
                    <div id="quote-container" class="quote-section" style="margin-top: 20px;">
                        <div id="quote-summary-header" style="background-color: var(--primary-light); padding: 15px; border-radius: var(--radius-sm); margin-bottom: 15px;">
                            <h3 style="margin: 0; color: var(--primary-color);">Quote Summary</h3>
                        </div>
                        <div id="quote-items-preview" style="margin-bottom: 15px; min-height: 50px;">
                            <p style="text-align: center; color: #666;">No items in quote yet</p>
                        </div>
                        <div id="quote-subtotal" style="padding: 10px; border-bottom: 1px solid var(--border-color); display: none;">
                            <!-- Subtotal will be shown here -->
                        </div>
                        <div id="quote-ltm" class="ltm-row" style="padding: 10px; border-bottom: 1px solid var(--border-color); display: none;">
                            <!-- LTM fees will be shown here -->
                        </div>
                        <div id="quote-total" style="padding: 15px; font-weight: bold; font-size: 1.2em; background-color: var(--primary-light); border-radius: var(--radius-sm); display: none;">
                            <!-- Total will be shown here -->
                        </div>
                    </div>
                </div>
            `;
        }

        // Initialize size quantity grid
        initializeSizeQuantityGrid() {
            const gridContainer = document.getElementById('size-quantity-grid');
            if (!gridContainer) return;

            // Get available sizes from the page
            const sizes = this.getAvailableSizes();
            
            // Create grid HTML
            let gridHTML = '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); gap: 10px;">';
            
            sizes.forEach(size => {
                gridHTML += `
                    <div class="size-quantity-cell" style="text-align: center; padding: 10px; background-color: white; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
                        <label style="display: block; font-weight: bold; margin-bottom: 5px; color: var(--primary-color);">${size}</label>
                        <input type="number" 
                               class="size-quantity-input" 
                               data-size="${size}" 
                               min="0" 
                               value="0" 
                               style="width: 60px; padding: 5px; text-align: center; border: 1px solid var(--border-color); border-radius: 4px;">
                    </div>
                `;
            });
            
            gridHTML += '</div>';
            gridContainer.innerHTML = gridHTML;
        }

        // Get available sizes from the pricing grid
        getAvailableSizes() {
            const sizes = [];
            const headerRow = document.querySelector('#custom-pricing-grid thead tr');
            if (headerRow) {
                const headers = headerRow.querySelectorAll('th');
                headers.forEach((th, index) => {
                    if (index > 0) { // Skip the first "Quantity" header
                        sizes.push(th.textContent.trim());
                    }
                });
            }
            return sizes.length > 0 ? sizes : ['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL']; // Default sizes
        }

        // Override addQuoteSummaryPanel to fix onclick handlers
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
                    <button class="quote-close-btn" onclick="embroideryQuoteAdapter.toggleQuotePanel()">
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
                        <button class="btn-secondary quote-action-btn" onclick="embroideryQuoteAdapter.saveQuote()">
                            💾 Save Quote
                        </button>
                        <button class="btn-secondary quote-action-btn" onclick="embroideryQuoteAdapter.loadQuotePrompt()">
                            📂 Load Quote
                        </button>
                        <button class="btn-secondary quote-action-btn" onclick="embroideryQuoteAdapter.exportPDF()">
                            📄 Download PDF
                        </button>
                        <button class="btn-secondary quote-action-btn" onclick="embroideryQuoteAdapter.emailQuote()">
                            ✉️ Email Quote
                        </button>
                        <button class="btn-link quote-clear-btn" onclick="embroideryQuoteAdapter.clearQuote()">
                            🗑️ Clear Quote
                        </button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(panel);
            
            // Add floating toggle button
            this.addFloatingToggleButton();
        }

        // Override renderQuoteItem to fix onclick handler
        renderQuoteItem(item) {
            return `
                <div class="quote-item" data-item-id="${item.id}">
                    <div class="quote-item-header">
                        <strong>${item.styleNumber || 'Product'} - ${item.color || 'Color'}</strong>
                        <button class="quote-item-remove" onclick="embroideryQuoteAdapter.removeItem('${item.id}')">
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

        // Override bindEvents for embroidery-specific events
        bindEvents() {
            super.bindEvents();
            
            // Bind quantity input events
            document.addEventListener('input', (e) => {
                if (e.target.classList.contains('size-quantity-input')) {
                    this.updateTotalQuantity();
                }
            });

            // Bind add to quote button
            const addToQuoteBtn = document.getElementById('add-to-quote-btn');
            if (addToQuoteBtn) {
                addToQuoteBtn.addEventListener('click', () => this.handleAddToQuote());
            }
        }

        // Update total quantity display
        updateTotalQuantity() {
            const inputs = document.querySelectorAll('.size-quantity-input');
            let total = 0;
            
            inputs.forEach(input => {
                const value = parseInt(input.value) || 0;
                total += value;
            });
            
            const totalDisplay = document.getElementById('total-quantity-value');
            if (totalDisplay) {
                totalDisplay.textContent = total;
            }
            
            return total;
        }

        // Handle add to quote
        handleAddToQuote() {
            const totalQuantity = this.updateTotalQuantity();
            
            if (totalQuantity === 0) {
                alert('Please enter quantities for at least one size');
                return;
            }

            // Get product details
            const styleNumber = document.getElementById('product-style-context')?.textContent || 'Unknown';
            const productName = document.getElementById('product-title-context')?.textContent || 'Product';
            const selectedColor = document.getElementById('pricing-color-name')?.textContent || 'Color';
            
            // Get size breakdown
            const sizeBreakdown = {};
            const inputs = document.querySelectorAll('.size-quantity-input');
            inputs.forEach(input => {
                const size = input.dataset.size;
                const quantity = parseInt(input.value) || 0;
                if (quantity > 0) {
                    sizeBreakdown[size] = quantity;
                }
            });

            // Calculate pricing
            const unitPrice = this.calculateUnitPrice(totalQuantity);
            
            // Create quote item
            const itemData = {
                styleNumber: styleNumber,
                productName: productName,
                color: selectedColor,
                quantity: totalQuantity,
                baseUnitPrice: unitPrice,
                sizeBreakdown: sizeBreakdown,
                stitchCount: this.stitchCount,
                location: 'Front' // Default location for embroidery
            };

            const quoteItem = this.createQuoteItem(itemData);
            
            // Add to quote
            this.addItemToQuote(quoteItem);
            
            // Reset form
            this.resetQuoteBuilder();
            
            // Update preview
            this.updateQuotePreview();
        }

        // Calculate unit price based on quantity
        calculateUnitPrice(quantity) {
            // Get pricing from the current pricing grid
            const pricingGrid = document.getElementById('custom-pricing-grid');
            if (!pricingGrid) return 0;

            const rows = pricingGrid.querySelectorAll('tbody tr');
            let unitPrice = 0;

            // Find the appropriate tier row
            rows.forEach(row => {
                const tierLabel = row.querySelector('td:first-child')?.textContent;
                if (tierLabel) {
                    const tierRange = this.parseTierRange(tierLabel);
                    if (quantity >= tierRange.min && quantity <= tierRange.max) {
                        // Get the first non-quantity cell (assuming S-XL pricing)
                        const priceCell = row.querySelector('td:nth-child(2)');
                        if (priceCell) {
                            const priceText = priceCell.textContent.replace('$', '').trim();
                            unitPrice = parseFloat(priceText) || 0;
                        }
                    }
                }
            });

            return unitPrice;
        }

        // Parse tier range from label
        parseTierRange(tierLabel) {
            const parts = tierLabel.split('-');
            if (parts.length === 2) {
                return {
                    min: parseInt(parts[0]) || 0,
                    max: parts[1].includes('+') ? 99999 : parseInt(parts[1]) || 0
                };
            } else if (tierLabel.includes('+')) {
                const min = parseInt(tierLabel.replace('+', '')) || 0;
                return { min: min, max: 99999 };
            }
            return { min: 0, max: 0 };
        }

        // Override getItemDetailsHTML for embroidery-specific display
        getItemDetailsHTML(item) {
            let sizeDetails = '';
            if (item.sizeBreakdown) {
                const sizes = Object.entries(item.sizeBreakdown)
                    .map(([size, qty]) => `${size}: ${qty}`)
                    .join(', ');
                sizeDetails = `<div style="font-size: 0.85em; color: #666; margin-top: 5px;">${sizes}</div>`;
            }

            return `
                <div>
                    <span>Qty: ${item.quantity}</span>
                    <span style="margin-left: 10px;">@ $${item.finalUnitPrice.toFixed(2)}/ea</span>
                    ${item.hasLTM ? '<span style="margin-left: 10px; color: #dc3545;">(LTM applies)</span>' : ''}
                </div>
                ${sizeDetails}
                <div style="font-size: 0.85em; color: #666;">
                    ${item.stitchCount.toLocaleString()} stitches • ${item.location}
                </div>
            `;
        }

        // Override getAdditionalItemData for embroidery-specific fields
        getAdditionalItemData(item) {
            return {
                StitchCount: item.stitchCount,
                Location: item.location,
                SizeBreakdown: JSON.stringify(item.sizeBreakdown)
            };
        }

        // Override resetQuoteBuilder
        resetQuoteBuilder() {
            const inputs = document.querySelectorAll('.size-quantity-input');
            inputs.forEach(input => {
                input.value = '0';
            });
            this.updateTotalQuantity();
        }

        // Update quote preview in the main section
        updateQuotePreview() {
            const previewContainer = document.getElementById('quote-items-preview');
            const subtotalEl = document.getElementById('quote-subtotal');
            const ltmEl = document.getElementById('quote-ltm');
            const totalEl = document.getElementById('quote-total');

            if (!previewContainer) return;

            if (this.currentQuote.items.length === 0) {
                previewContainer.innerHTML = '<p style="text-align: center; color: #666;">No items in quote yet</p>';
                if (subtotalEl) subtotalEl.style.display = 'none';
                if (ltmEl) ltmEl.style.display = 'none';
                if (totalEl) totalEl.style.display = 'none';
            } else {
                // Show summary of items
                let summaryHTML = '<div style="max-height: 200px; overflow-y: auto;">';
                this.currentQuote.items.forEach((item, index) => {
                    summaryHTML += `
                        <div style="padding: 10px; border-bottom: 1px solid var(--border-color); ${index === 0 ? '' : 'margin-top: 5px;'}">
                            <strong>${item.styleNumber} - ${item.color}</strong>
                            <span style="float: right;">$${item.lineTotal.toFixed(2)}</span>
                            <div style="font-size: 0.85em; color: #666;">Qty: ${item.quantity}</div>
                        </div>
                    `;
                });
                summaryHTML += '</div>';
                previewContainer.innerHTML = summaryHTML;

                // Show totals
                if (subtotalEl) {
                    subtotalEl.innerHTML = `<span>Subtotal:</span> <span style="float: right;">$${this.currentQuote.subtotal.toFixed(2)}</span>`;
                    subtotalEl.style.display = 'block';
                }
                
                if (ltmEl && this.currentQuote.ltmTotal > 0) {
                    ltmEl.innerHTML = `<span>LTM Fees:</span> <span style="float: right;">$${this.currentQuote.ltmTotal.toFixed(2)}</span>`;
                    ltmEl.style.display = 'block';
                } else if (ltmEl) {
                    ltmEl.style.display = 'none';
                }
                
                if (totalEl) {
                    totalEl.innerHTML = `<span>Total:</span> <span style="float: right;">$${this.currentQuote.grandTotal.toFixed(2)}</span>`;
                    totalEl.style.display = 'block';
                }
            }
        }
    }

    // Initialize when DOM is ready
    function initEmbroideryQuoteAdapter() {
        console.log('[QUOTE:EMBROIDERY] Initializing embroidery quote adapter');
        
        // Check if QuoteAdapterBase is available
        if (!window.QuoteAdapterBase) {
            console.error('[QUOTE:EMBROIDERY] QuoteAdapterBase not found. Make sure quote-adapter-base.js is loaded first.');
            return;
        }

        // Create and initialize the adapter
        window.embroideryQuoteAdapter = new EmbroideryQuoteAdapter();
        window.embroideryQuoteAdapter.init();
        
        // Make it globally accessible for onclick handlers with the correct name
        window.embroideryQuoteAdapter = window.embroideryQuoteAdapter;
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initEmbroideryQuoteAdapter);
    } else {
        initEmbroideryQuoteAdapter();
    }

})();