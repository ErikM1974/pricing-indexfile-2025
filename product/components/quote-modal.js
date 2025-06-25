/**
 * Quote Modal Component
 * Handles the product quote form and modal interactions
 */

import { EmailService } from '../services/email-service.js';
import { API } from '../services/api.js';
import { QuoteService } from '../services/quote-service.js';

export class QuoteModal {
    constructor() {
        this.emailService = new EmailService();
        this.quoteService = new QuoteService();
        this.modal = null;
        this.products = [];
        this.nextProductId = 1;
        this.api = new API();
        
        this.createModal();
        this.attachEventListeners();
    }

    createModal() {
        const modalHTML = `
            <div id="quote-modal" class="quote-modal hidden">
                <div class="quote-modal-overlay"></div>
                <div class="quote-modal-content">
                    <div class="quote-modal-header">
                        <h2>Send Product Quote</h2>
                        <button class="quote-modal-close">&times;</button>
                    </div>
                    
                    <form id="quote-form" class="quote-form">
                        <div class="form-section">
                            <h3>Contact Information</h3>
                            <div class="form-row">
                                <div class="form-group">
                                    <label for="customer-name">Customer Name *</label>
                                    <input type="text" id="customer-name" name="customerName" placeholder="John Smith" required>
                                </div>
                                <div class="form-group">
                                    <label for="customer-email">Customer Email *</label>
                                    <input type="email" id="customer-email" name="customerEmail" placeholder="john@company.com" required>
                                </div>
                            </div>
                            <div class="form-row">
                                <div class="form-group">
                                    <label for="customer-phone">Phone Number</label>
                                    <input type="tel" id="customer-phone" name="customerPhone" placeholder="(555) 123-4567">
                                </div>
                                <div class="form-group">
                                    <label for="company-name">Company Name</label>
                                    <input type="text" id="company-name" name="companyName" placeholder="ABC Company">
                                </div>
                            </div>
                            <div class="form-row">
                                <div class="form-group" style="grid-column: 1 / -1;">
                                    <label for="sales-rep">Sales Representative *</label>
                                    <select id="sales-rep" name="salesRep" required>
                                        <option value="">Select Sales Rep</option>
                                        <option value="Sales Team|sales@nwcustomapparel.com">Sales Team</option>
                                        <option value="Nika|nika@nwcustomapparel.com">Nika</option>
                                        <option value="Taylar|taylar@nwcustomapparel.com">Taylar</option>
                                        <option value="Adriyella|adriyella@nwcustomapparel.com">Adriyella</option>
                                        <option value="Erik|erik@nwcustomapparel.com">Erik</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                        
                        <div class="form-section">
                            <h3>Decoration Details</h3>
                            <div class="form-row">
                                <div class="form-group">
                                    <label for="decoration-method">Decoration Method *</label>
                                    <select id="decoration-method" name="decorationMethod" required>
                                        <option value="">Select Method</option>
                                        <option value="Embroidery">Embroidery</option>
                                        <option value="Screen Print">Screen Print</option>
                                        <option value="DTG">DTG (Direct to Garment)</option>
                                        <option value="DTF">DTF (Direct to Film)</option>
                                        <option value="Heat Transfer">Heat Transfer</option>
                                        <option value="Sublimation">Sublimation</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label for="setup-fee">Setup Fee ($)</label>
                                    <input type="number" id="setup-fee" name="setupFee" value="0" min="0" step="0.01">
                                    <small style="color: #666;">One-time fee for artwork/screen setup</small>
                                </div>
                            </div>
                        </div>
                        
                        <div class="form-section">
                            <h3>Products</h3>
                            <div id="products-container" class="products-container">
                                <!-- Product lines will be added here dynamically -->
                            </div>
                            <button type="button" class="btn-add-product" id="add-product-btn">
                                <i class="fas fa-plus"></i> Add Another Product
                            </button>
                        </div>
                        
                        <div class="form-section">
                            <h3>Quote Summary</h3>
                            <div class="quote-summary">
                                <table class="summary-table">
                                    <tbody id="summary-tbody">
                                        <!-- Summary rows will be added dynamically -->
                                    </tbody>
                                    <tfoot>
                                        <tr class="grand-total-row">
                                            <td colspan="2"><strong>Grand Total:</strong></td>
                                            <td class="text-right"><strong id="grand-total">$0.00</strong></td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>
                        
                        <div class="form-section">
                            <label for="notes">Additional Notes</label>
                            <textarea id="notes" name="notes" rows="4" placeholder="Add details about decoration placement, colors, timeline, etc."></textarea>
                        </div>
                        
                        <div class="form-actions">
                            <button type="button" class="btn-secondary" id="close-modal">Cancel</button>
                            <button type="button" class="btn-secondary" id="preview-quote">Preview Quote</button>
                            <button type="submit" class="btn-primary">Send Quote</button>
                        </div>
                    </form>
                    
                    <div id="quote-loading" class="quote-loading hidden">
                        <div class="spinner"></div>
                        <p>Sending quote...</p>
                    </div>
                    
                    <div id="quote-success" class="quote-success hidden">
                        <div class="success-icon">✓</div>
                        <h3>Quote Sent Successfully!</h3>
                        <p>The quote has been emailed to <span id="success-email"></span></p>
                        <button class="btn-primary" id="close-success">Close</button>
                    </div>
                    
                    <div id="quote-error" class="quote-error hidden">
                        <div class="error-icon">✗</div>
                        <h3>Failed to Send Quote</h3>
                        <p id="error-message"></p>
                        <button class="btn-primary" id="retry-send">Try Again</button>
                    </div>
                </div>
            </div>
        `;
        
        // Add modal to body
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        this.modal = document.getElementById('quote-modal');
        
        // Add preview modal
        const previewModalHTML = `
            <div id="quote-preview-modal" class="quote-modal hidden">
                <div class="quote-modal-overlay"></div>
                <div class="quote-preview-content">
                    <div class="quote-preview-header">
                        <h2>Quote Preview</h2>
                        <button class="quote-modal-close" id="close-preview">&times;</button>
                    </div>
                    <div class="quote-preview-body">
                        <div id="preview-content">
                            <!-- Preview will be inserted here -->
                        </div>
                    </div>
                    <div class="quote-preview-footer">
                        <button class="btn-secondary" id="edit-quote">Edit Quote</button>
                        <button class="btn-primary" id="send-from-preview">Send Quote</button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', previewModalHTML);
        
        // Pre-select sales rep if saved
        const savedRep = localStorage.getItem('nwca_sales_rep');
        if (savedRep) {
            document.getElementById('sales-rep').value = savedRep;
        }
    }

    attachEventListeners() {
        // Close modal
        document.querySelector('.quote-modal-close').addEventListener('click', () => this.close());
        document.querySelector('.quote-modal-overlay').addEventListener('click', () => this.close());
        
        // Form submission
        document.getElementById('quote-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.sendQuote();
        });
        
        // Add product button
        document.getElementById('add-product-btn').addEventListener('click', () => {
            this.addProduct();
        });
        
        // Success/Error close buttons
        document.getElementById('close-success').addEventListener('click', () => this.close());
        document.getElementById('retry-send').addEventListener('click', () => this.showForm());
        
        // Preview quote
        document.getElementById('preview-quote').addEventListener('click', () => {
            this.showPreview();
        });
        
        // Preview modal controls
        document.getElementById('close-preview').addEventListener('click', () => this.closePreview());
        document.getElementById('edit-quote').addEventListener('click', () => this.closePreview());
        document.getElementById('send-from-preview').addEventListener('click', () => {
            this.closePreview();
            this.sendQuote();
        });
        
    }

    open(productData) {
        // Clear any existing products
        this.products = [];
        this.nextProductId = 1;
        
        // Add the primary product from the current page
        const primaryProduct = {
            id: this.nextProductId++,
            isPrimary: true,
            styleNumber: productData.styleNumber,
            productName: productData.productName,
            productImage: productData.productImage,
            colorName: productData.colorName,
            colorData: productData.selectedColor || productData.allColors?.[0],
            allColors: productData.allColors || [],
            sizes: productData.sizes,
            description: productData.description,
            brandLogo: productData.brandLogo,
            brandName: productData.brandName,
            quantity: '',
            pricePerItem: '',
            subtotal: 0
        };
        
        this.products.push(primaryProduct);
        this.modal.classList.remove('hidden');
        this.showForm();
        
        // Render the primary product
        this.renderAllProducts();
        
        // Focus first input
        setTimeout(() => {
            document.getElementById('customer-email').focus();
        }, 100);
    }

    close() {
        this.modal.classList.add('hidden');
        this.resetForm();
    }

    showForm() {
        document.getElementById('quote-form').classList.remove('hidden');
        document.getElementById('quote-loading').classList.add('hidden');
        document.getElementById('quote-success').classList.add('hidden');
        document.getElementById('quote-error').classList.add('hidden');
    }

    showLoading() {
        document.getElementById('quote-form').classList.add('hidden');
        document.getElementById('quote-loading').classList.remove('hidden');
    }

    showSuccess(email, quoteID = null, emailSent = true) {
        document.getElementById('quote-loading').classList.add('hidden');
        document.getElementById('quote-success').classList.remove('hidden');
        
        const successDiv = document.getElementById('quote-success');
        const h3 = successDiv.querySelector('h3');
        const p = successDiv.querySelector('p');
        
        if (emailSent) {
            h3.innerHTML = `Quote Sent Successfully!<br><small style="font-size: 16px; color: #666;">Quote ID: ${quoteID}</small>`;
            p.innerHTML = `The quote has been emailed to <span id="success-email">${email}</span>`;
        } else {
            h3.innerHTML = `Quote Saved Successfully!<br><small style="font-size: 16px; color: #666;">Quote ID: ${quoteID}</small>`;
            p.innerHTML = `Quote ID: <strong>${quoteID}</strong><br><span style="color: #ff6b6b;">Note: Email could not be sent. Please contact the customer directly.</span>`;
        }
    }

    showError(message) {
        document.getElementById('quote-loading').classList.add('hidden');
        document.getElementById('quote-error').classList.remove('hidden');
        document.getElementById('error-message').textContent = message;
    }

    validateProducts() {
        const validProducts = this.products.filter(p => p.styleNumber && p.quantity && p.pricePerItem);
        
        if (validProducts.length === 0) {
            alert('Please add at least one product with quantity and pricing');
            return false;
        }
        
        return true;
    }

    async sendQuote() {
        const formData = new FormData(document.getElementById('quote-form'));
        const customerName = formData.get('customerName');
        const customerEmail = formData.get('customerEmail');
        const customerPhone = formData.get('customerPhone');
        const companyName = formData.get('companyName');
        const salesRepData = formData.get('salesRep');
        
        // Validate email
        if (!this.emailService.isValidEmail(customerEmail)) {
            alert('Please enter a valid email address');
            return;
        }
        
        // Validate products
        if (!this.validateProducts()) {
            return;
        }
        
        // Parse sales rep data
        const [senderName, senderEmail] = salesRepData ? salesRepData.split('|') : ['', ''];
        
        // Get valid products with complete data
        const validProducts = this.products.filter(p => p.styleNumber && p.quantity && p.pricePerItem);
        
        // Get quote-level details
        const decorationMethod = formData.get('decorationMethod');
        const setupFee = parseFloat(formData.get('setupFee') || 0);
        
        // Calculate grand total
        const grandTotal = validProducts.reduce((sum, p) => sum + p.subtotal, 0) + setupFee;
        
        // Prepare quote data with multiple products
        const quoteData = {
            // Contact info
            customerName: customerName,
            customerEmail: customerEmail,
            customerPhone: customerPhone,
            companyName: companyName,
            senderName: senderName,
            senderEmail: senderEmail,
            
            // Quote-level details
            decorationMethod: decorationMethod,
            setupFee: setupFee,
            
            // Multiple products
            products: validProducts.map(p => ({
                styleNumber: p.styleNumber,
                productName: p.productName,
                productImage: p.productImage,
                colorName: p.colorName,
                sizes: p.sizes,
                description: p.description,
                brandLogo: p.brandLogo,
                brandName: p.brandName,
                quantity: p.quantity,
                pricePerItem: p.pricePerItem,
                subtotal: p.subtotal
            })),
            
            // Quote totals
            grandTotal: grandTotal,
            productUrl: window.location.href,
            notes: formData.get('notes')
        };
        
        // Show loading
        this.showLoading();
        
        try {
            // First save to database
            const saveResult = await this.quoteService.saveQuote(quoteData);
            
            if (saveResult.success) {
                // Add quote ID to the data before sending email
                quoteData.quoteID = saveResult.quoteID;
                
                // Save selected sales rep
                if (salesRepData) {
                    localStorage.setItem('nwca_sales_rep', salesRepData);
                }
                
                let emailSent = false;
                try {
                    // Try to send email
                    await this.emailService.sendQuote(quoteData);
                    emailSent = true;
                } catch (emailError) {
                    console.error('Failed to send email:', emailError);
                    // Continue anyway - quote is saved
                }
                
                // Show success with Quote ID and email status
                this.showSuccess(customerEmail, saveResult.quoteID, emailSent);
            } else {
                throw new Error('Failed to save quote to database');
            }
        } catch (error) {
            console.error('Failed to save quote:', error);
            this.showError('Failed to save quote. Please try again or contact support.');
        }
    }

    resetForm() {
        document.getElementById('quote-form').reset();
        
        // Re-select saved sales rep
        const savedRep = localStorage.getItem('nwca_sales_rep');
        if (savedRep) {
            document.getElementById('sales-rep').value = savedRep;
        }
        
        // Clear products
        this.products = [];
        this.nextProductId = 1;
        document.getElementById('products-container').innerHTML = '';
        this.updateSummary();
    }
    
    renderAllProducts() {
        const container = document.getElementById('products-container');
        container.innerHTML = '';
        
        this.products.forEach((product, index) => {
            this.renderProductLine(product, index);
        });
        
        this.updateSummary();
    }
    
    renderProductLine(product, index) {
        const container = document.getElementById('products-container');
        const productHTML = this.createProductLineHTML(product, index);
        
        const productDiv = document.createElement('div');
        productDiv.className = 'product-line';
        productDiv.id = `product-line-${product.id}`;
        productDiv.innerHTML = productHTML;
        
        container.appendChild(productDiv);
        
        // Attach event listeners for this product line
        this.attachProductLineListeners(product);
        
        // Initialize search for additional products
        if (!product.isPrimary && !product.styleNumber) {
            this.initializeProductSearch(product.id);
        }
    }
    
    createProductLineHTML(product, index) {
        const isPrimary = product.isPrimary;
        const hasProduct = !!product.styleNumber;
        
        return `
            <div class="product-line-header">
                <h4>${isPrimary ? 'Primary Product' : `Product ${index + 1}`}</h4>
                ${!isPrimary ? `<button type="button" class="btn-remove-product" data-product-id="${product.id}">
                    <i class="fas fa-times"></i>
                </button>` : ''}
            </div>
            
            <div class="product-line-content">
                ${!isPrimary ? `
                    <div class="product-search-container">
                        <input type="text" 
                               id="product-search-${product.id}" 
                               class="product-search-input" 
                               placeholder="Search by style number..."
                               value="${product.styleNumber || ''}"
                               ${hasProduct ? 'readonly' : ''}>
                        <div id="search-results-${product.id}" class="search-results hidden"></div>
                    </div>
                ` : ''}
                
                ${hasProduct ? `
                    <div class="product-info-row">
                        ${product.productImage ? `<img src="${product.productImage}" alt="${product.productName}" class="product-thumb">` : ''}
                        <div class="product-details">
                            <strong>${product.productName}</strong><br>
                            Style: ${product.styleNumber}<br>
                            ${product.colorName ? `Color: ${product.colorName}` : ''}
                            ${!isPrimary ? `<br><button type="button" class="btn-change-product" data-product-id="${product.id}" style="font-size: 0.85rem; padding: 4px 8px; margin-top: 8px;">Change Product</button>` : ''}
                        </div>
                    </div>
                    
                    ${!isPrimary && product.allColors && product.allColors.length > 1 ? `
                        <div class="form-group">
                            <label>Select Color</label>
                            <select id="color-select-${product.id}" class="color-select" data-product-id="${product.id}">
                                ${product.allColors.map((color, idx) => `
                                    <option value="${idx}" ${color === product.colorData ? 'selected' : ''}>
                                        ${color.COLOR_NAME || color.colorName || 'Color ' + (idx + 1)}
                                    </option>
                                `).join('')}
                            </select>
                        </div>
                    ` : ''}
                    
                    <div class="form-row">
                        <div class="form-group">
                            <label>Quantity *</label>
                            <input type="number" 
                                   id="quantity-${product.id}" 
                                   class="product-quantity" 
                                   data-product-id="${product.id}"
                                   value="${product.quantity || ''}"
                                   min="1" 
                                   required>
                        </div>
                        <div class="form-group">
                            <label>Price per Item ($) *</label>
                            <input type="number" 
                                   id="price-${product.id}" 
                                   class="product-price" 
                                   data-product-id="${product.id}"
                                   value="${product.pricePerItem || ''}"
                                   step="0.01" 
                                   min="0" 
                                   required>
                        </div>
                    </div>
                    
                    
                    <div class="product-subtotal">
                        Subtotal: <span id="subtotal-${product.id}">$0.00</span>
                    </div>
                ` : ''}
            </div>
        `;
    }
    
    attachProductLineListeners(product) {
        // Remove button
        const removeBtn = document.querySelector(`#product-line-${product.id} .btn-remove-product`);
        if (removeBtn) {
            removeBtn.addEventListener('click', () => this.removeProduct(product.id));
        }
        
        // Change product button
        const changeBtn = document.querySelector(`#product-line-${product.id} .btn-change-product`);
        if (changeBtn) {
            changeBtn.addEventListener('click', () => this.resetProduct(product.id));
        }
        
        // Input listeners for calculations
        const inputs = ['quantity', 'price'].map(type => 
            document.getElementById(`${type}-${product.id}`)
        );
        
        inputs.forEach(input => {
            if (input) {
                input.addEventListener('input', () => {
                    this.updateProductCalculations(product.id);
                });
            }
        });
        
        
        // Color select
        const colorSelect = document.getElementById(`color-select-${product.id}`);
        if (colorSelect) {
            colorSelect.addEventListener('change', (e) => {
                const colorIndex = parseInt(e.target.value);
                const selectedColor = product.allColors[colorIndex];
                this.updateProduct(product.id, { 
                    colorData: selectedColor,
                    colorName: selectedColor.COLOR_NAME || selectedColor.colorName,
                    productImage: selectedColor.MAIN_IMAGE_URL || selectedColor.FRONT_MODEL_IMAGE_URL
                });
                this.renderAllProducts();
            });
        }
    }
    
    addProduct() {
        const newProduct = {
            id: this.nextProductId++,
            isPrimary: false,
            styleNumber: '',
            productName: '',
            productImage: '',
            colorName: '',
            colorData: null,
            allColors: [],
            sizes: '',
            description: '',
            brandLogo: '',
            brandName: '',
            quantity: '',
            pricePerItem: '',
            subtotal: 0
        };
        
        this.products.push(newProduct);
        this.renderProductLine(newProduct, this.products.length - 1);
        
        // Focus the search input
        setTimeout(() => {
            const searchInput = document.getElementById(`product-search-${newProduct.id}`);
            if (searchInput) searchInput.focus();
        }, 100);
    }
    
    removeProduct(productId) {
        this.products = this.products.filter(p => p.id !== productId);
        document.getElementById(`product-line-${productId}`).remove();
        this.updateSummary();
    }
    
    resetProduct(productId) {
        const product = this.products.find(p => p.id === productId);
        if (!product) return;
        
        // Reset product data but keep the ID
        product.styleNumber = '';
        product.productName = '';
        product.productImage = '';
        product.colorName = '';
        product.colorData = null;
        product.allColors = [];
        product.sizes = '';
        product.description = '';
        product.brandLogo = '';
        product.brandName = '';
        product.quantity = 1;
        product.pricePerItem = 0;
        product.subtotal = 0;
        
        // Re-render all products to update the UI
        this.renderAllProducts();
        
        // Focus the search input after re-rendering
        setTimeout(() => {
            const searchInput = document.getElementById(`product-search-${productId}`);
            if (searchInput) {
                searchInput.focus();
            }
        }, 100);
    }
    
    updateProduct(productId, updates) {
        const product = this.products.find(p => p.id === productId);
        if (product) {
            Object.assign(product, updates);
        }
    }
    
    updateProductCalculations(productId) {
        const product = this.products.find(p => p.id === productId);
        if (!product) return;
        
        const quantity = parseFloat(document.getElementById(`quantity-${productId}`)?.value) || 0;
        const pricePerItem = parseFloat(document.getElementById(`price-${productId}`)?.value) || 0;
        
        product.quantity = quantity;
        product.pricePerItem = pricePerItem;
        product.subtotal = quantity * pricePerItem;
        
        // Update subtotal display
        const subtotalEl = document.getElementById(`subtotal-${productId}`);
        if (subtotalEl) {
            subtotalEl.textContent = `$${product.subtotal.toFixed(2)}`;
        }
        
        this.updateSummary();
    }
    
    updateSummary() {
        const tbody = document.getElementById('summary-tbody');
        tbody.innerHTML = '';
        
        let grandTotal = 0;
        
        this.products.forEach((product, index) => {
            if (product.styleNumber && product.subtotal > 0) {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${product.productName || 'Product ' + (index + 1)}</td>
                    <td class="text-center">${product.quantity || 0} × $${(product.pricePerItem || 0).toFixed(2)}</td>
                    <td class="text-right">$${product.subtotal.toFixed(2)}</td>
                `;
                tbody.appendChild(row);
                grandTotal += product.subtotal;
            }
        });
        
        document.getElementById('grand-total').textContent = `$${grandTotal.toFixed(2)}`;
    }
    
    initializeProductSearch(productId) {
        console.log('[QuoteModal] Initializing product search for product:', productId);
        
        const searchInput = document.getElementById(`product-search-${productId}`);
        const resultsContainer = document.getElementById(`search-results-${productId}`);
        
        if (!searchInput || !resultsContainer) {
            console.error('[QuoteModal] Search elements not found for product:', productId);
            return;
        }
        
        let searchTimeout = null;
        
        // Handle search input
        searchInput.addEventListener('input', (e) => {
            const value = e.target.value.trim();
            
            clearTimeout(searchTimeout);
            
            if (value.length < 2) {
                resultsContainer.classList.add('hidden');
                return;
            }
            
            // Show loading
            resultsContainer.innerHTML = `
                <div class="search-loading">
                    <div class="mini-spinner"></div>
                    <span>Searching...</span>
                </div>
            `;
            resultsContainer.classList.remove('hidden');
            
            // Debounce search
            searchTimeout = setTimeout(async () => {
                await this.searchProducts(productId, value);
            }, 300);
        });
        
        // Handle click outside
        document.addEventListener('click', (e) => {
            if (!searchInput.contains(e.target) && !resultsContainer.contains(e.target)) {
                resultsContainer.classList.add('hidden');
            }
        });
        
        // Handle keyboard navigation
        searchInput.addEventListener('keydown', (e) => {
            const items = resultsContainer.querySelectorAll('.search-result-item');
            const selected = resultsContainer.querySelector('.search-result-item.selected');
            let currentIndex = -1;
            
            if (selected) {
                currentIndex = Array.from(items).indexOf(selected);
            }
            
            switch (e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    currentIndex = (currentIndex + 1) % items.length;
                    this.selectSearchItem(items, currentIndex);
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    currentIndex = currentIndex <= 0 ? items.length - 1 : currentIndex - 1;
                    this.selectSearchItem(items, currentIndex);
                    break;
                case 'Enter':
                    e.preventDefault();
                    if (selected) {
                        selected.click();
                    }
                    break;
                case 'Escape':
                    resultsContainer.classList.add('hidden');
                    break;
            }
        });
    }
    
    selectSearchItem(items, index) {
        items.forEach((item, i) => {
            item.classList.toggle('selected', i === index);
        });
    }
    
    async searchProducts(productId, searchTerm) {
        const resultsContainer = document.getElementById(`search-results-${productId}`);
        console.log('[QuoteModal] Searching products for:', searchTerm, 'Product ID:', productId);
        
        try {
            const results = await this.api.searchProducts(searchTerm);
            console.log('[QuoteModal] Search results:', results.length, 'items found');
            
            if (results.length > 0) {
                let html = '<div class="search-results-list">';
                
                results.forEach((result, index) => {
                    html += `
                        <div class="search-result-item" data-style="${result.value}">
                            <div class="result-style">${result.value}</div>
                            <div class="result-name">${result.label}</div>
                        </div>
                    `;
                });
                
                html += '</div>';
                resultsContainer.innerHTML = html;
                resultsContainer.classList.remove('hidden');
                
                // Add click handlers
                resultsContainer.querySelectorAll('.search-result-item').forEach(item => {
                    item.addEventListener('click', async () => {
                        const styleNumber = item.dataset.style;
                        resultsContainer.classList.add('hidden');
                        await this.loadProductData(productId, styleNumber);
                    });
                    
                    item.addEventListener('mouseenter', () => {
                        resultsContainer.querySelectorAll('.search-result-item').forEach(i => {
                            i.classList.remove('selected');
                        });
                        item.classList.add('selected');
                    });
                });
            } else {
                resultsContainer.innerHTML = `
                    <div class="search-no-results">
                        No products found
                    </div>
                `;
            }
        } catch (error) {
            console.error('Search failed:', error);
            resultsContainer.innerHTML = `
                <div class="search-error">
                    Search failed. Please try again.
                </div>
            `;
        }
    }
    
    async loadProductData(productId, styleNumber) {
        try {
            const searchInput = document.getElementById(`product-search-${productId}`);
            if (searchInput) {
                searchInput.value = 'Loading...';
                searchInput.disabled = true;
            }
            
            const productData = await this.api.getProduct(styleNumber);
            
            if (productData && productData.colors && productData.colors.length > 0) {
                const firstColor = productData.colors[0];
                
                this.updateProduct(productId, {
                    styleNumber: productData.styleNumber,
                    productName: productData.title || productData.productTitle || productData.styleNumber,
                    productImage: firstColor.MAIN_IMAGE_URL || firstColor.FRONT_MODEL_IMAGE_URL || '',
                    colorName: firstColor.COLOR_NAME || firstColor.colorName || 'N/A',
                    colorData: firstColor,
                    allColors: productData.colors,
                    sizes: productData.AVAILABLE_SIZES || 'Contact for sizes',
                    description: productData.description || productData.PRODUCT_DESCRIPTION || '',
                    brandLogo: firstColor.BRAND_LOGO_IMAGE || '',
                    brandName: productData.BRAND_NAME || ''
                });
                
                this.renderAllProducts();
            }
        } catch (error) {
            console.error('Failed to load product data:', error);
            alert('Failed to load product. Please try again.');
            
            const searchInput = document.getElementById(`product-search-${productId}`);
            if (searchInput) {
                searchInput.value = '';
                searchInput.disabled = false;
                searchInput.focus();
            }
        }
    }
    
    showPreview() {
        const formData = new FormData(document.getElementById('quote-form'));
        const salesRepData = formData.get('salesRep');
        
        // Validate form first
        if (!document.getElementById('quote-form').checkValidity()) {
            document.getElementById('quote-form').reportValidity();
            return;
        }
        
        // Validate products
        if (!this.validateProducts()) {
            return;
        }
        
        // Parse sales rep data
        const [senderName, senderEmail] = salesRepData ? salesRepData.split('|') : ['', ''];
        
        // Get valid products
        const validProducts = this.products.filter(p => p.styleNumber && p.quantity && p.pricePerItem);
        
        // Get quote level details
        const decorationMethod = formData.get('decorationMethod');
        const setupFee = parseFloat(formData.get('setupFee') || 0);
        const customerName = formData.get('customerName');
        const companyName = formData.get('companyName');
        const customerPhone = formData.get('customerPhone');
        const quoteID = this.quoteService.generateQuoteID();
        
        const grandTotal = validProducts.reduce((sum, p) => sum + p.subtotal, 0) + setupFee;
        
        // Generate preview HTML
        const previewHTML = `
            <div class="email-preview-container">
                <div class="email-header">
                    <h1>NORTHWEST CUSTOM APPAREL</h1>
                    <p>Custom Product Quote - ${quoteID}</p>
                </div>
                
                <div class="email-content">
                    <!-- Customer Information -->
                    <div class="customer-info-preview">
                        <h3>Customer Information</h3>
                        <p><strong>Name:</strong> ${customerName}</p>
                        ${companyName ? `<p><strong>Company:</strong> ${companyName}</p>` : ''}
                        ${customerPhone ? `<p><strong>Phone:</strong> ${customerPhone}</p>` : ''}
                        <p><strong>Decoration Method:</strong> ${decorationMethod}</p>
                    </div>
                    
                    <h2 style="color: var(--primary-color); margin-bottom: 20px;">Product Quote Summary</h2>
                    
                    <!-- Products -->
                    ${validProducts.map((product, index) => `
                        <div class="preview-card">
                            <h3>Product ${index + 1}: ${product.productName}</h3>
                            <div style="display: flex; gap: 20px;">
                                ${product.productImage ? `<img src="${product.productImage}" alt="${product.productName}" style="width: 150px; height: auto; border-radius: 4px;">` : ''}
                                <div style="flex: 1;">
                                    <p><strong>Style:</strong> ${product.styleNumber}</p>
                                    ${product.brandName ? `<p><strong>Brand:</strong> ${product.brandName}</p>` : ''}
                                    <p><strong>Color:</strong> ${product.colorName}</p>
                                    ${product.sizes ? `<p><strong>Available Sizes:</strong> ${product.sizes}</p>` : ''}
                                </div>
                            </div>
                            
                            <table class="preview-table" style="margin-top: 15px;">
                                <tr>
                                    <td><strong>Quantity:</strong></td>
                                    <td style="text-align: right;">${product.quantity} pieces</td>
                                </tr>
                                <tr>
                                    <td><strong>Price per Item:</strong></td>
                                    <td style="text-align: right;">$${product.pricePerItem.toFixed(2)}</td>
                                </tr>
                                <tr style="background: var(--primary-light);">
                                    <td><strong>Subtotal:</strong></td>
                                    <td style="text-align: right;"><strong>$${product.subtotal.toFixed(2)}</strong></td>
                                </tr>
                            </table>
                        </div>
                    `).join('')}
                    
                    <!-- Grand Total -->
                    <div class="preview-card" style="background: #f9f9f9;">
                        <h3>Quote Summary</h3>
                        <table class="preview-table">
                            <tr>
                                <td><strong>Products Subtotal:</strong></td>
                                <td style="text-align: right;">$${validProducts.reduce((sum, p) => sum + p.subtotal, 0).toFixed(2)}</td>
                            </tr>
                            ${setupFee > 0 ? `
                            <tr>
                                <td><strong>Setup Fee (one-time):</strong></td>
                                <td style="text-align: right;">$${setupFee.toFixed(2)}</td>
                            </tr>
                            ` : ''}
                            <tr class="preview-total-row" style="font-size: 1.2em;">
                                <td><strong>GRAND TOTAL:</strong></td>
                                <td style="text-align: right;"><strong>$${grandTotal.toFixed(2)}</strong></td>
                            </tr>
                        </table>
                    </div>
                    
                    <!-- Notes Section -->
                    ${formData.get('notes') ? `
                        <div class="preview-card notes-preview">
                            <h3>Notes from your sales representative:</h3>
                            <p>${formData.get('notes').replace(/\n/g, '<br>')}</p>
                        </div>
                    ` : ''}
                    
                    <!-- Footer -->
                    <div class="preview-footer">
                        <p>This quote is valid for 30 days</p>
                        <p>Questions? Reply to this email or call (253) 922-5793</p>
                        <hr>
                        <p><strong>${senderName}</strong></p>
                        <p>${senderEmail}</p>
                        <p>Northwest Custom Apparel</p>
                    </div>
                </div>
            </div>
        `;
        
        // Show preview
        document.getElementById('preview-content').innerHTML = previewHTML;
        document.getElementById('quote-preview-modal').classList.remove('hidden');
    }
    
    closePreview() {
        document.getElementById('quote-preview-modal').classList.add('hidden');
    }
}