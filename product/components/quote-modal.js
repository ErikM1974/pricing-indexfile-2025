/**
 * Quote Modal Component
 * Handles the product quote form and modal interactions
 */

import { EmailService } from '../services/email-service.js';

export class QuoteModal {
    constructor() {
        this.emailService = new EmailService();
        this.modal = null;
        this.productData = null;
        
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
                                    <label for="customer-email">Customer Email *</label>
                                    <input type="email" id="customer-email" name="customerEmail" required>
                                </div>
                                <div class="form-group">
                                    <label for="sales-rep">Sales Representative *</label>
                                    <select id="sales-rep" name="salesRep" required>
                                        <option value="">Select Sales Rep</option>
                                        <option value="Nika|nika@nwcustomapparel.com">Nika</option>
                                        <option value="Taylar|taylar@nwcustomapparel.com">Taylar</option>
                                        <option value="Adriyella|adriyella@nwcustomapparel.com">Adriyella</option>
                                        <option value="Erik|erik@nwcustomapparel.com">Erik</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                        
                        <div class="form-section">
                            <h3>Quote Details</h3>
                            <div class="form-row">
                                <div class="form-group">
                                    <label for="quantity">Quantity *</label>
                                    <input type="number" id="quantity" name="quantity" min="1" required>
                                </div>
                                <div class="form-group">
                                    <label>Decoration Method *</label>
                                    <div class="radio-group">
                                        <label>
                                            <input type="radio" name="decorationMethod" value="Embroidery" required>
                                            Embroidery
                                        </label>
                                        <label>
                                            <input type="radio" name="decorationMethod" value="Screen Print" required>
                                            Screen Print
                                        </label>
                                        <label>
                                            <input type="radio" name="decorationMethod" value="DTG" required>
                                            DTG
                                        </label>
                                        <label>
                                            <input type="radio" name="decorationMethod" value="DTF" required>
                                            DTF
                                        </label>
                                        <label>
                                            <input type="radio" name="decorationMethod" value="Other" required>
                                            Other
                                        </label>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="form-row">
                                <div class="form-group">
                                    <label for="price-per-item">Price per Item ($) *</label>
                                    <input type="number" id="price-per-item" name="pricePerItem" step="0.01" min="0" required>
                                </div>
                                <div class="form-group">
                                    <label for="setup-fee">Setup Fee ($)</label>
                                    <input type="number" id="setup-fee" name="setupFee" step="0.01" min="0" value="0">
                                </div>
                            </div>
                            
                            <div class="total-display">
                                <strong>Total:</strong> <span id="total-price">$0.00</span>
                            </div>
                        </div>
                        
                        <div class="form-section">
                            <label for="notes">Additional Notes</label>
                            <textarea id="notes" name="notes" rows="4" placeholder="Add details about decoration placement, colors, timeline, etc."></textarea>
                        </div>
                        
                        <div class="form-actions">
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
        
        // Calculate total on input change
        ['quantity', 'price-per-item', 'setup-fee'].forEach(id => {
            document.getElementById(id).addEventListener('input', () => this.calculateTotal());
        });
        
        // Success/Error close buttons
        document.getElementById('close-success').addEventListener('click', () => this.close());
        document.getElementById('retry-send').addEventListener('click', () => this.showForm());
        
        // Preview quote (future feature)
        document.getElementById('preview-quote').addEventListener('click', () => {
            alert('Quote preview coming soon!');
        });
    }

    open(productData) {
        this.productData = productData;
        this.modal.classList.remove('hidden');
        this.showForm();
        
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

    showSuccess(email) {
        document.getElementById('quote-loading').classList.add('hidden');
        document.getElementById('quote-success').classList.remove('hidden');
        document.getElementById('success-email').textContent = email;
    }

    showError(message) {
        document.getElementById('quote-loading').classList.add('hidden');
        document.getElementById('quote-error').classList.remove('hidden');
        document.getElementById('error-message').textContent = message;
    }

    calculateTotal() {
        const quantity = parseFloat(document.getElementById('quantity').value) || 0;
        const pricePerItem = parseFloat(document.getElementById('price-per-item').value) || 0;
        const setupFee = parseFloat(document.getElementById('setup-fee').value) || 0;
        
        const total = (quantity * pricePerItem) + setupFee;
        document.getElementById('total-price').textContent = `$${total.toFixed(2)}`;
        
        return total;
    }

    async sendQuote() {
        const formData = new FormData(document.getElementById('quote-form'));
        const customerEmail = formData.get('customerEmail');
        const salesRepData = formData.get('salesRep');
        
        // Validate email
        if (!this.emailService.isValidEmail(customerEmail)) {
            alert('Please enter a valid email address');
            return;
        }
        
        // Parse sales rep data
        const [senderName, senderEmail] = salesRepData ? salesRepData.split('|') : ['', ''];
        
        // Calculate total
        const total = this.calculateTotal();
        
        // Prepare quote data
        const quoteData = {
            // Contact info
            customerEmail: customerEmail,
            senderName: senderName,
            senderEmail: senderEmail,
            
            // Product info from current page
            productName: this.productData.productName,
            styleNumber: this.productData.styleNumber,
            productImage: this.productData.productImage,
            colorName: this.productData.colorName,
            sizes: this.productData.sizes,
            productUrl: window.location.href,
            description: this.productData.description,
            brandLogo: this.productData.brandLogo,
            brandName: this.productData.brandName,
            allColors: this.productData.allColors,
            selectedColorIndex: this.productData.selectedColorIndex,
            
            // Quote details
            quantity: formData.get('quantity'),
            decorationMethod: formData.get('decorationMethod'),
            pricePerItem: formData.get('pricePerItem'),
            setupFee: formData.get('setupFee'),
            totalPrice: total,
            notes: formData.get('notes')
        };
        
        // Show loading
        this.showLoading();
        
        try {
            await this.emailService.sendQuote(quoteData);
            // Save selected sales rep
            if (salesRepData) {
                localStorage.setItem('nwca_sales_rep', salesRepData);
            }
            this.showSuccess(customerEmail);
        } catch (error) {
            console.error('Failed to send quote:', error);
            this.showError('Failed to send quote. Please try again or contact support.');
        }
    }

    resetForm() {
        document.getElementById('quote-form').reset();
        
        // Re-select saved sales rep
        const savedRep = localStorage.getItem('nwca_sales_rep');
        if (savedRep) {
            document.getElementById('sales-rep').value = savedRep;
        }
        
        // Reset total
        document.getElementById('total-price').textContent = '$0.00';
    }
}