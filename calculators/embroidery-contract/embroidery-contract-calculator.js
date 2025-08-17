// Configuration
const CALCULATOR_CONFIG = {
    name: 'Contract Embroidery',
    quotePrefix: 'EMB',
    emailTemplateId: 'Embroidery_Template',
    emailServiceId: 'service_1c4k67j',
    emailPublicKey: '4qSbDO-SQs19TbP80'
};

// Pricing Matrix (extracted from provided HTML)
const PRICING_MATRIX = {
    '6,000': { '1-15': 10.50, '16-31': 7.50, '32-63': 6.25, '64-127': 5.75, '128+': 5.00 },
    '7,000': { '1-15': 10.75, '16-31': 7.75, '32-63': 6.50, '64-127': 6.00, '128+': 5.25 },
    '8,000': { '1-15': 11.00, '16-31': 8.00, '32-63': 6.75, '64-127': 6.25, '128+': 5.50 },
    '9,000': { '1-15': 11.25, '16-31': 8.25, '32-63': 7.00, '64-127': 6.50, '128+': 5.75 },
    '10,000': { '1-15': 11.50, '16-31': 8.50, '32-63': 7.25, '64-127': 6.75, '128+': 6.00 },
    '11,000': { '1-15': 11.75, '16-31': 8.75, '32-63': 7.50, '64-127': 7.00, '128+': 6.25 },
    '12,000': { '1-15': 12.00, '16-31': 9.00, '32-63': 7.75, '64-127': 7.25, '128+': 6.50 },
    '13,000': { '1-15': 12.25, '16-31': 9.25, '32-63': 8.00, '64-127': 7.50, '128+': 6.75 },
    '14,000': { '1-15': 12.50, '16-31': 9.50, '32-63': 8.25, '64-127': 7.75, '128+': 7.00 },
    '15,000': { '1-15': 12.75, '16-31': 9.75, '32-63': 8.50, '64-127': 8.00, '128+': 7.25 },
    '16,000': { '1-15': 13.00, '16-31': 10.00, '32-63': 8.75, '64-127': 8.25, '128+': 7.50 },
    '17,000': { '1-15': 13.25, '16-31': 10.25, '32-63': 9.00, '64-127': 8.50, '128+': 7.75 },
    '18,000': { '1-15': 13.50, '16-31': 10.50, '32-63': 9.25, '64-127': 8.75, '128+': 8.00 },
    '19,000': { '1-15': 13.75, '16-31': 10.75, '32-63': 9.50, '64-127': 9.00, '128+': 8.25 },
    '20,000': { '1-15': 14.00, '16-31': 11.00, '32-63': 9.75, '64-127': 9.25, '128+': 8.50 },
    '21,000': { '1-15': 14.25, '16-31': 11.25, '32-63': 10.00, '64-127': 9.50, '128+': 8.75 },
    '22,000': { '1-15': 14.50, '16-31': 11.50, '32-63': 10.25, '64-127': 9.75, '128+': 9.00 },
    '23,000': { '1-15': 14.75, '16-31': 11.75, '32-63': 10.50, '64-127': 10.00, '128+': 9.25 },
    '24,000': { '1-15': 15.00, '16-31': 12.00, '32-63': 10.75, '64-127': 10.25, '128+': 9.50 },
    '25,000': { '1-15': 15.25, '16-31': 12.25, '32-63': 11.00, '64-127': 10.50, '128+': 9.75 }
};

class EmbroideryCalculator {
    constructor() {
        this.currentQuote = null;
        this.quoteService = new EmbroideryQuoteService();
        
        // Initialize EmailJS
        emailjs.init(CALCULATOR_CONFIG.emailPublicKey);
        
        this.initializeElements();
        this.bindEvents();
    }

    initializeElements() {
        // Form elements
        this.form = document.getElementById('calculatorForm');
        this.customerNameInput = document.getElementById('customerName');
        this.projectNameInput = document.getElementById('projectName');
        this.productTypeSelect = document.getElementById('productType');
        this.stitchCountSelect = document.getElementById('stitchCount');
        this.quantityInput = document.getElementById('quantity');
        this.threadColorsInput = document.getElementById('threadColors');
        
        // Results elements
        this.emptyState = document.getElementById('emptyState');
        this.resultsDisplay = document.getElementById('resultsDisplay');
        
        // Modal elements
        this.modal = document.getElementById('quoteModal');
        this.modalClose = document.getElementById('modalClose');
        this.quoteForm = document.getElementById('quoteForm');
        this.quoteCustomerName = document.getElementById('quoteCustomerName');
        this.customerEmail = document.getElementById('customerEmail');
        this.customerPhone = document.getElementById('customerPhone');
        this.companyName = document.getElementById('companyName');
        this.salesRep = document.getElementById('salesRep');
        this.saveToDatabase = document.getElementById('saveToDatabase');
        this.quotePreview = document.getElementById('quotePreview');
        this.successMessage = document.getElementById('successMessage');
        this.errorMessage = document.getElementById('errorMessage');
        this.errorText = document.getElementById('errorText');
    }

    bindEvents() {
        this.form.addEventListener('submit', (e) => this.handleCalculate(e));
        this.modalClose.addEventListener('click', () => this.closeModal());
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) this.closeModal();
        });
        this.quoteForm.addEventListener('submit', (e) => this.handleQuoteSubmit(e));
        
        // Sync customer name between forms
        this.customerNameInput.addEventListener('input', () => {
            this.quoteCustomerName.value = this.customerNameInput.value;
        });
    }

    getPricingTier(quantity) {
        if (quantity <= 15) return '1-15';
        if (quantity <= 31) return '16-31';
        if (quantity <= 63) return '32-63';
        if (quantity <= 127) return '64-127';
        return '128+';
    }

    calculatePrice(stitchCount, quantity) {
        const tier = this.getPricingTier(quantity);
        return PRICING_MATRIX[stitchCount][tier] || 0;
    }

    handleCalculate(e) {
        e.preventDefault();
        
        // Clear previous results
        this.currentQuote = null;
        
        // Get form values
        const customerName = this.customerNameInput.value.trim();
        const projectName = this.projectNameInput.value.trim();
        const productType = this.productTypeSelect.value;
        const stitchCount = this.stitchCountSelect.value;
        const quantity = parseInt(this.quantityInput.value);
        const threadColors = parseInt(this.threadColorsInput.value);
        
        // Validate
        if (!productType || !stitchCount || !quantity || !threadColors) {
            alert('Please fill in all required fields');
            return;
        }
        
        // Calculate pricing
        const unitPrice = this.calculatePrice(stitchCount, quantity);
        const baseTotal = unitPrice * quantity;
        
        // Calculate extra color charges ($1 per color over 4, per item)
        const extraColors = Math.max(0, threadColors - 4);
        const extraColorCharge = extraColors * quantity * 1.00;
        
        // Apply LTM fee if quantity < 16
        const hasLTM = quantity < 16;
        const ltmFee = hasLTM ? 50 : 0;
        
        // Calculate grand total
        const grandTotal = baseTotal + extraColorCharge + ltmFee;
        
        // Store quote data
        this.currentQuote = {
            customerName,
            projectName,
            productType,
            stitchCount,
            quantity,
            threadColors,
            extraColors,
            unitPrice,
            baseTotal,
            extraColorCharge,
            hasLTM,
            ltmFee,
            ltmPerPiece: ltmFee / quantity,
            grandTotal,
            finalUnitPrice: grandTotal / quantity
        };
        
        // Display results
        this.displayResults();
    }

    displayResults() {
        if (!this.currentQuote) return;
        
        let resultsHtml = `
            <h2 class="section-title">
                <i class="fas fa-file-invoice-dollar"></i>
                Quote Summary
            </h2>
            
            <div class="quote-summary">
                <div class="summary-row">
                    <span class="summary-label">Product Type:</span>
                    <span class="summary-value">${this.currentQuote.productType}</span>
                </div>
                <div class="summary-row">
                    <span class="summary-label">Stitch Count:</span>
                    <span class="summary-value">${this.currentQuote.stitchCount}</span>
                </div>
                <div class="summary-row">
                    <span class="summary-label">Quantity:</span>
                    <span class="summary-value">${this.currentQuote.quantity} items</span>
                </div>
                <div class="summary-row">
                    <span class="summary-label">Thread Colors:</span>
                    <span class="summary-value">${this.currentQuote.threadColors} colors</span>
                </div>
            </div>
            
            <table class="quote-table">
                <thead>
                    <tr>
                        <th>Description</th>
                        <th class="text-center">Qty</th>
                        <th class="text-right">Unit Price</th>
                        <th class="text-right">Total</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>${this.currentQuote.productType} - ${this.currentQuote.stitchCount} stitches</td>
                        <td class="text-center">${this.currentQuote.quantity}</td>
                        <td class="text-right">$${this.currentQuote.unitPrice.toFixed(2)}</td>
                        <td class="text-right">$${this.currentQuote.baseTotal.toFixed(2)}</td>
                    </tr>
        `;
        
        // Add extra color charges if applicable
        if (this.currentQuote.extraColors > 0) {
            const colorText = this.currentQuote.extraColors === 1 ? 'color' : 'colors';
            resultsHtml += `
                    <tr>
                        <td>Extra Thread Color${this.currentQuote.extraColors > 1 ? 's' : ''} (${this.currentQuote.extraColors} ${colorText} beyond 4 included)</td>
                        <td class="text-center">${this.currentQuote.quantity}</td>
                        <td class="text-right">$${this.currentQuote.extraColors.toFixed(2)}</td>
                        <td class="text-right">$${this.currentQuote.extraColorCharge.toFixed(2)}</td>
                    </tr>
            `;
        }
        
        // Add subtotal row
        const subtotal = this.currentQuote.baseTotal + this.currentQuote.extraColorCharge;
        resultsHtml += `
                    <tr style="border-top: 2px solid var(--border-color);">
                        <td colspan="3" class="text-right" style="font-weight: 600;">Subtotal:</td>
                        <td class="text-right" style="font-weight: 600;">$${subtotal.toFixed(2)}</td>
                    </tr>
        `;
        
        // Add LTM fee as line item if applicable
        if (this.currentQuote.hasLTM) {
            resultsHtml += `
                    <tr>
                        <td colspan="3" class="text-right">Less Than Minimum Fee:</td>
                        <td class="text-right">$${this.currentQuote.ltmFee.toFixed(2)}</td>
                    </tr>
            `;
        }
        
        resultsHtml += `
                </tbody>
            </table>
        `;
        
        // Add LTM note and pricing comparison if applicable
        if (this.currentQuote.hasLTM) {
            const regularPerPiece = (this.currentQuote.baseTotal + this.currentQuote.extraColorCharge) / this.currentQuote.quantity;
            const ltmPerPiece = this.currentQuote.grandTotal / this.currentQuote.quantity;
            
            const extraColorPerItem = this.currentQuote.extraColorCharge / this.currentQuote.quantity;
            
            resultsHtml += `
                <div class="pricing-comparison" style="background: #e3f2fd; padding: 1rem; border-radius: 8px; margin-top: 1rem;">
                    <h4 style="margin: 0 0 0.75rem 0; color: #1976d2; font-size: 1rem;">Price Per Item Breakdown:</h4>
                    <div style="font-family: monospace; font-size: 0.875rem;">
                        <div class="summary-row">
                            <span class="summary-label">Base Embroidery:</span>
                            <span class="summary-value" style="text-align: right; min-width: 80px; display: inline-block;">$${this.currentQuote.unitPrice.toFixed(2)}</span>
                        </div>
            `;
            
            if (this.currentQuote.extraColors > 0) {
                resultsHtml += `
                        <div class="summary-row">
                            <span class="summary-label">Extra Color Charge:</span>
                            <span class="summary-value" style="text-align: right; min-width: 80px; display: inline-block;">+ $${extraColorPerItem.toFixed(2)}</span>
                        </div>
                `;
            }
            
            resultsHtml += `
                        <div class="summary-row" style="border-top: 1px solid #90caf9; padding-top: 0.5rem; margin-top: 0.5rem;">
                            <span class="summary-label">Regular Price:</span>
                            <span class="summary-value" style="text-align: right; min-width: 80px; display: inline-block;">$${regularPerPiece.toFixed(2)}</span>
                        </div>
                        <div class="summary-row">
                            <span class="summary-label">LTM Impact:</span>
                            <span class="summary-value" style="text-align: right; min-width: 80px; display: inline-block;">+ $${this.currentQuote.ltmPerPiece.toFixed(2)}</span>
                        </div>
                        <div class="summary-row" style="border-top: 2px solid #1976d2; padding-top: 0.5rem; margin-top: 0.5rem; font-weight: bold;">
                            <span class="summary-label">Your Price Per Item:</span>
                            <span class="summary-value" style="text-align: right; min-width: 80px; display: inline-block; color: #1976d2;">$${ltmPerPiece.toFixed(2)}</span>
                        </div>
                    </div>
                </div>
            `;
        }
        
        resultsHtml += `
            <div class="total-section">
                <div class="total-row">
                    <span class="total-label">Total:</span>
                    <span class="total-amount">$${this.currentQuote.grandTotal.toFixed(2)}</span>
                </div>
                
                <div class="button-container" style="display: flex; gap: 1rem; margin-top: 1rem;">
                    <button type="button" class="btn btn-secondary" onclick="window.print()">
                        <i class="fas fa-print"></i>
                        Print Quote
                    </button>
                    <button type="button" class="btn btn-success" onclick="embroideryCalculator.openModal()">
                        <i class="fas fa-paper-plane"></i>
                        Send Quote
                    </button>
                </div>
            </div>
        `;
        
        // Update display
        this.resultsDisplay.innerHTML = resultsHtml;
        this.resultsDisplay.classList.remove('hidden');
        this.emptyState.classList.add('hidden');
    }

    openModal() {
        // Pre-fill customer name
        this.quoteCustomerName.value = this.customerNameInput.value;
        
        // Show quote preview
        this.updateQuotePreview();
        
        // Reset messages
        this.successMessage.classList.add('hidden');
        this.errorMessage.classList.add('hidden');
        
        // Show modal
        this.modal.classList.add('active');
        
        // Focus appropriate field
        if (this.quoteCustomerName.value) {
            this.customerEmail.focus();
        } else {
            this.quoteCustomerName.focus();
        }
    }

    closeModal() {
        this.modal.classList.remove('active');
    }

    updateQuotePreview() {
        if (!this.currentQuote) return;
        
        let previewHtml = `
            <div class="summary-row">
                <span class="summary-label">Product:</span>
                <span class="summary-value">${this.currentQuote.productType}</span>
            </div>
            <div class="summary-row">
                <span class="summary-label">Stitch Count:</span>
                <span class="summary-value">${this.currentQuote.stitchCount}</span>
            </div>
            <div class="summary-row">
                <span class="summary-label">Quantity:</span>
                <span class="summary-value">${this.currentQuote.quantity} items</span>
            </div>
        `;
        
        if (this.currentQuote.extraColorCharge > 0) {
            previewHtml += `
                <div class="summary-row">
                    <span class="summary-label">Color Charges:</span>
                    <span class="summary-value">$${this.currentQuote.extraColorCharge.toFixed(2)}</span>
                </div>
            `;
        }
        
        if (this.currentQuote.hasLTM) {
            previewHtml += `
                <div class="summary-row">
                    <span class="summary-label">LTM Fee:</span>
                    <span class="summary-value">$${this.currentQuote.ltmFee.toFixed(2)}</span>
                </div>
            `;
        }
        
        previewHtml += `
            <div class="summary-row" style="font-weight: bold; margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid var(--border-color);">
                <span class="summary-label">Total:</span>
                <span class="summary-value">$${this.currentQuote.grandTotal.toFixed(2)}</span>
            </div>
        `;
        
        this.quotePreview.innerHTML = previewHtml;
    }

    async handleQuoteSubmit(e) {
        e.preventDefault();
        
        if (!this.currentQuote) return;
        
        // Ensure all messages are hidden at start - clear any existing states
        this.successMessage.classList.add('hidden');
        this.errorMessage.classList.add('hidden');
        
        // Double-check by removing success/error states
        this.successMessage.style.display = 'none';
        this.errorMessage.style.display = 'none';
        
        // Show loading state
        const submitBtn = this.quoteForm.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<span class="spinner"></span> Sending...';
        submitBtn.disabled = true;
        
        try {
            // Get selected sales rep
            const selectedRep = this.salesRep.value;
            if (!selectedRep) {
                throw new Error('Please select a sales representative');
            }
            
            // Map sales rep emails to names
            const salesRepNames = {
                'ruth@nwcustomapparel.com': 'Ruth',
                'taylar@nwcustomapparel.com': 'Taylar',
                'nika@nwcustomapparel.com': 'Nika',
                'erik@nwcustomapparel.com': 'Erik',
                'adriyella@nwcustomapparel.com': 'Adriyella',
                'sales@nwcustomapparel.com': 'Northwest Custom Apparel Sales Team'
            };
            
            // Prepare quote data
            const quoteData = {
                ...this.currentQuote,
                customerEmail: this.customerEmail.value,
                customerName: this.quoteCustomerName.value,
                customerPhone: this.customerPhone.value,
                companyName: this.companyName.value,
                salesRepEmail: selectedRep,
                salesRepName: salesRepNames[selectedRep]
            };
            
            // Save to database if checked (but don't show success yet)
            let saveResult = null;
            if (this.saveToDatabase.checked) {
                saveResult = await this.quoteService.saveQuote(quoteData);
                if (!saveResult.success) {
                    console.error('Database save failed:', saveResult.error);
                    // Don't throw here - continue with email
                }
            }
            
            // Build color charge row for email
            let colorChargeRow = '';
            if (this.currentQuote.extraColors > 0) {
                const colorText = this.currentQuote.extraColors === 1 ? 'color' : 'colors';
                colorChargeRow = `
                    <tr style="border-bottom: 1px solid #ddd;">
                        <td style="padding: 12px;">Extra Thread Color${this.currentQuote.extraColors > 1 ? 's' : ''} (${this.currentQuote.extraColors} ${colorText} beyond 4 included)</td>
                        <td style="padding: 12px; text-align: center;">${this.currentQuote.quantity}</td>
                        <td style="padding: 12px; text-align: right;">$${this.currentQuote.extraColors.toFixed(2)}</td>
                        <td style="padding: 12px; text-align: right;">$${this.currentQuote.extraColorCharge.toFixed(2)}</td>
                    </tr>
                `;
            }
            
            // Build LTM row for email
            let ltmRow = '';
            if (this.currentQuote.hasLTM) {
                ltmRow = `
                    <tr style="border-top: 2px solid #4cb354;">
                        <td colspan="3" style="padding: 12px; text-align: right;">Less Than Minimum Fee:</td>
                        <td style="padding: 12px; text-align: right;">$${this.currentQuote.ltmFee.toFixed(2)}</td>
                    </tr>
                `;
            }
            
            // Build price breakdown HTML
            let priceBreakdownHtml = '';
            if (this.currentQuote.hasLTM) {
                const regularPerPiece = (this.currentQuote.baseTotal + this.currentQuote.extraColorCharge) / this.currentQuote.quantity;
                const ltmPerPiece = this.currentQuote.grandTotal / this.currentQuote.quantity;
                const extraColorPerItem = this.currentQuote.extraColorCharge / this.currentQuote.quantity;
                
                priceBreakdownHtml = `
                    <div style="background: #e3f2fd; padding: 15px; border-radius: 6px; margin: 20px 0;">
                        <h3 style="margin: 0 0 10px 0; color: #1976d2;">Price Per Item Breakdown:</h3>
                        <div style="font-family: monospace; font-size: 14px;">
                            <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                                <span>Base Embroidery:</span>
                                <span>$${this.currentQuote.unitPrice.toFixed(2)}</span>
                            </div>
                            ${this.currentQuote.extraColors > 0 ? `
                            <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                                <span>Extra Color Charge:</span>
                                <span>+ $${extraColorPerItem.toFixed(2)}</span>
                            </div>
                            ` : ''}
                            <div style="display: flex; justify-content: space-between; margin-bottom: 5px; padding-top: 5px; border-top: 1px solid #90caf9;">
                                <span>Regular Price:</span>
                                <span>$${regularPerPiece.toFixed(2)}</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                                <span>LTM Impact:</span>
                                <span>+ $${this.currentQuote.ltmPerPiece.toFixed(2)}</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; padding-top: 5px; border-top: 2px solid #1976d2; font-weight: bold;">
                                <span>Your Price Per Item:</span>
                                <span style="color: #1976d2;">$${ltmPerPiece.toFixed(2)}</span>
                            </div>
                        </div>
                    </div>
                `;
            }
            
            const subtotal = this.currentQuote.baseTotal + this.currentQuote.extraColorCharge;
            
            // Prepare email data with comprehensive debugging
            const emailData = {
                // Core template variables
                to_email: this.customerEmail.value.trim(),
                reply_to: quoteData.salesRepEmail,
                from_name: 'Northwest Custom Apparel',
                
                // Customer info
                customer_name: this.quoteCustomerName.value.trim(),
                company_name: this.companyName.value.trim() || 'Not Provided',
                customer_email: this.customerEmail.value.trim(),
                customer_phone: this.customerPhone.value.trim() || 'Not Provided',
                project_name: this.currentQuote.projectName || 'Contract Embroidery Quote',
                
                // Quote details
                quote_id: saveResult?.quoteID || `TEMP-${Date.now()}`,
                quote_date: new Date().toLocaleDateString(),
                quote_type: 'Contract Embroidery',
                
                // Product details
                product_type: this.currentQuote.productType,
                stitch_count: this.currentQuote.stitchCount,
                quantity: this.currentQuote.quantity.toString(),
                thread_colors: `${this.currentQuote.threadColors} colors`,
                
                // Pricing
                unit_price: this.currentQuote.unitPrice.toFixed(2),
                base_total: this.currentQuote.baseTotal.toFixed(2),
                subtotal: subtotal.toFixed(2),
                grand_total: this.currentQuote.grandTotal.toFixed(2),
                
                // HTML content (for template rendering)
                color_charge_desc: colorChargeRow,
                ltm_fee: ltmRow,
                price_breakdown_html: priceBreakdownHtml,
                
                // Sales rep info
                sales_rep_name: quoteData.salesRepName,
                sales_rep_email: quoteData.salesRepEmail,
                sales_rep_phone: '253-922-5793',
                
                // Company info
                company_year: '1977',
                
                // Additional fields with defaults to prevent corruption
                notes: this.currentQuote.notes || 'No special notes for this order',
                special_note: ''
            };
            
            // Debug logging
            console.log('EmailJS send attempt:');
            console.log('Service ID:', CALCULATOR_CONFIG.emailServiceId);
            console.log('Template ID:', CALCULATOR_CONFIG.emailTemplateId);
            console.log('Email data:', emailData);
            
            // Validate all required fields are present
            const requiredFields = ['to_email', 'customer_name', 'quote_id', 'grand_total'];
            const missingFields = requiredFields.filter(field => !emailData[field]);
            if (missingFields.length > 0) {
                throw new Error(`Missing required email fields: ${missingFields.join(', ')}`);
            }
            
            // Send email - this is the critical step
            const emailResult = await emailjs.send(
                CALCULATOR_CONFIG.emailServiceId,
                CALCULATOR_CONFIG.emailTemplateId,
                emailData
            );
            
            console.log('EmailJS success:', emailResult);
            
            // Email sent successfully - ensure error is hidden and success is shown
            this.errorMessage.classList.add('hidden');
            this.errorMessage.style.display = 'none';
            this.successMessage.classList.remove('hidden');
            this.successMessage.style.display = 'flex';
            
            // Reset form after delay
            setTimeout(() => {
                this.closeModal();
                this.quoteForm.reset();
                this.saveToDatabase.checked = true;
                this.salesRep.value = 'ruth@nwcustomapparel.com';
            }, 2000);
            
        } catch (error) {
            console.error('Quote submission error:', error);
            console.error('Error details:', error.text || error.message);
            
            let errorMessage = 'Failed to send quote. Please try again.';
            
            // Provide specific error messages for common issues
            if (error.text?.includes('template')) {
                errorMessage = 'Email template error. Please contact support.';
            } else if (error.text?.includes('service')) {
                errorMessage = 'Email service error. Please contact support.';
            } else if (error.text?.includes('corrupted')) {
                errorMessage = 'Email configuration error. Please contact support.';
            }
            
            // Only show error if email actually failed
            this.successMessage.classList.add('hidden');
            this.successMessage.style.display = 'none';
            this.errorText.textContent = errorMessage;
            this.errorMessage.classList.remove('hidden');
            this.errorMessage.style.display = 'flex';
            
        } finally {
            // Restore button
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    }
}

// Initialize calculator when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Initialize EmailJS globally (for both calculator and email guide)
    emailjs.init(CALCULATOR_CONFIG.emailPublicKey);
    
    window.embroideryCalculator = new EmbroideryCalculator();
    
    // Setup modal event listeners
    setupBuyersGuideEventListeners();
    setupEmailGuideEventListeners();
    setupEmailFormEventListener();
});

// Print functionality
window.addEventListener('beforeprint', () => {
    if (!window.embroideryCalculator?.currentQuote) return;
    
    const quote = window.embroideryCalculator.currentQuote;
    const printContent = document.getElementById('printContent');
    
    let colorChargeRow = '';
    if (quote.extraColors > 0) {
        const colorText = quote.extraColors === 1 ? 'color' : 'colors';
        colorChargeRow = `
            <tr>
                <td style="padding: 8px; border-bottom: 1px solid #ddd;">Extra Thread Color${quote.extraColors > 1 ? 's' : ''} (${quote.extraColors} ${colorText} beyond 4 included)</td>
                <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: center;">${quote.quantity}</td>
                <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">$${quote.extraColors.toFixed(2)}</td>
                <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">$${quote.extraColorCharge.toFixed(2)}</td>
            </tr>
        `;
    }
    
    const subtotal = quote.baseTotal + quote.extraColorCharge;
    let subtotalRow = `
        <tr style="border-top: 2px solid #333;">
            <td colspan="3" style="padding: 8px; text-align: right; font-weight: bold;">Subtotal:</td>
            <td style="padding: 8px; text-align: right; font-weight: bold;">$${subtotal.toFixed(2)}</td>
        </tr>
    `;
    
    let ltmRow = '';
    if (quote.hasLTM) {
        ltmRow = `
            <tr>
                <td colspan="3" style="padding: 8px; text-align: right;">Less Than Minimum Fee:</td>
                <td style="padding: 8px; text-align: right;">$${quote.ltmFee.toFixed(2)}</td>
            </tr>
        `;
    }
    
    let ltmNote = '';
    if (quote.hasLTM) {
        const regularPerPiece = (quote.baseTotal + quote.extraColorCharge) / quote.quantity;
        const ltmPerPiece = quote.grandTotal / quote.quantity;
        
        const extraColorPerItem = quote.extraColorCharge / quote.quantity;
        
        ltmNote = `
            <div style="background: #e3f2fd; padding: 15px; border-radius: 4px; margin: 20px 0;">
                <h4 style="margin: 0 0 10px 0; color: #1976d2;">Price Per Item Breakdown:</h4>
                <div style="font-family: monospace; font-size: 14px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                        <span>Base Embroidery:</span>
                        <span>$${quote.unitPrice.toFixed(2)}</span>
                    </div>
                    ${quote.extraColors > 0 ? `
                    <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                        <span>Extra Color Charge:</span>
                        <span>+ $${extraColorPerItem.toFixed(2)}</span>
                    </div>
                    ` : ''}
                    <div style="display: flex; justify-content: space-between; margin-bottom: 5px; padding-top: 5px; border-top: 1px solid #90caf9;">
                        <span>Regular Price:</span>
                        <span>$${regularPerPiece.toFixed(2)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                        <span>LTM Impact:</span>
                        <span>+ $${quote.ltmPerPiece.toFixed(2)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; padding-top: 5px; border-top: 2px solid #1976d2; font-weight: bold;">
                        <span>Your Price Per Item:</span>
                        <span style="color: #1976d2;">$${ltmPerPiece.toFixed(2)}</span>
                    </div>
                </div>
            </div>
        `;
    }
    
    printContent.innerHTML = `
        <div style="max-width: 800px; margin: 0 auto; padding: 20px; font-family: Arial, sans-serif;">
            <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="margin: 0; color: #4A5568;">Northwest Custom Apparel</h1>
                <p style="margin: 5px 0;">Contract Embroidery Quote</p>
                <p style="margin: 5px 0;">Date: ${new Date().toLocaleDateString()}</p>
            </div>
            
            <div style="margin-bottom: 30px;">
                <h3>Customer Information</h3>
                <p><strong>Customer:</strong> ${quote.customerName || 'Not Provided'}</p>
                <p><strong>Project:</strong> ${quote.projectName || 'Contract Embroidery'}</p>
            </div>
            
            <div style="margin-bottom: 30px;">
                <h3>Quote Details</h3>
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="background: #f3f4f6;">
                            <th style="padding: 8px; text-align: left; border-bottom: 2px solid #ddd;">Description</th>
                            <th style="padding: 8px; text-align: center; border-bottom: 2px solid #ddd;">Qty</th>
                            <th style="padding: 8px; text-align: right; border-bottom: 2px solid #ddd;">Unit Price</th>
                            <th style="padding: 8px; text-align: right; border-bottom: 2px solid #ddd;">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td style="padding: 8px; border-bottom: 1px solid #ddd;">${quote.productType} - ${quote.stitchCount} stitches</td>
                            <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: center;">${quote.quantity}</td>
                            <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">$${quote.unitPrice.toFixed(2)}</td>
                            <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">$${quote.baseTotal.toFixed(2)}</td>
                        </tr>
                        ${colorChargeRow}
                        ${subtotalRow}
                        ${ltmRow}
                    </tbody>
                </table>
            </div>
            
            ${ltmNote}
            
            <div style="text-align: right; margin-top: 30px; padding-top: 20px; border-top: 2px solid #ddd;">
                <h2 style="color: #4A5568;">Total: $${quote.grandTotal.toFixed(2)}</h2>
            </div>
            
            <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666;">
                <p><strong>Northwest Custom Apparel</strong></p>
                <p>Phone: 253-922-5793 | Email: sales@nwcustomapparel.com</p>
                <p>Proudly serving since 1977</p>
            </div>
        </div>
    `;
    
    printContent.style.display = 'block';
});

window.addEventListener('afterprint', () => {
    document.getElementById('printContent').style.display = 'none';
});

// Buyer's Guide Functions
function openBuyersGuide() {
    document.getElementById('buyersGuideModal').classList.add('active');
}

function closeBuyersGuide() {
    document.getElementById('buyersGuideModal').classList.remove('active');
}

// Close modal when clicking outside - with safety check
function setupBuyersGuideEventListeners() {
    const modal = document.getElementById('buyersGuideModal');
    if (modal) {
        modal.addEventListener('click', function(e) {
            if (e.target === this) {
                closeBuyersGuide();
            }
        });
    }
}

function showGuideSection(section) {
    // Update tabs
    document.querySelectorAll('.guide-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    event.target.classList.add('active');

    // Update content
    document.querySelectorAll('.guide-section').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(section).classList.add('active');
}

// Email Guide Functions
function openEmailGuideModal() {
    document.getElementById('emailGuideModal').classList.add('active');
    // Reset form
    document.getElementById('emailGuideForm').reset();
    document.getElementById('guideSuccessMessage').classList.add('hidden');
    document.getElementById('guideErrorMessage').classList.add('hidden');
}

function closeEmailGuideModal() {
    document.getElementById('emailGuideModal').classList.remove('active');
}

// Close modal on outside click - with safety check
function setupEmailGuideEventListeners() {
    const modal = document.getElementById('emailGuideModal');
    if (modal) {
        modal.addEventListener('click', function(e) {
            if (e.target === this) {
                closeEmailGuideModal();
            }
        });
    }
}

// Handle email guide form submission - with safety check
function setupEmailFormEventListener() {
    const form = document.getElementById('emailGuideForm');
    if (form) {
        form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Get form values
    const recipientEmail = document.getElementById('guideRecipientEmail').value;
    const recipientName = document.getElementById('guideRecipientName').value;
    const personalMessage = document.getElementById('guidePersonalMessage').value;
    const salesRepEmail = document.getElementById('guideSalesRep').value;
    
    // Map sales rep emails to names
    const salesRepNames = {
        'ruth@nwcustomapparel.com': 'Ruth Nhong',
        'taylar@nwcustomapparel.com': 'Taylar',
        'nika@nwcustomapparel.com': 'Nika',
        'erik@nwcustomapparel.com': 'Erik',
        'adriyella@nwcustomapparel.com': 'Adriyella'
    };
    
    // Prepare email data
    const emailData = {
        to_email: recipientEmail,
        recipient_name: recipientName,
        personal_message: personalMessage || '',  // Ensure it's never undefined
        sales_rep_name: salesRepNames[salesRepEmail],
        sales_rep_email: salesRepEmail,
        sales_rep_phone: '253-922-5793'
    };
    
    // Log the data being sent for debugging
    console.log('Sending email with data:', emailData);
    
    // Show loading state
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<span class="spinner"></span> Sending...';
    submitBtn.disabled = true;
    
    try {
        // Send email via EmailJS
        await emailjs.send(
            'service_1c4k67j',  // Standard NWCA service
            'template_wna04vr',  // Template ID
            emailData
        );
        
        // Show success
        document.getElementById('guideSuccessMessage').classList.remove('hidden');
        document.getElementById('guideErrorMessage').classList.add('hidden');
        
        // Close modal after delay
        setTimeout(() => {
            closeEmailGuideModal();
        }, 2000);
        
    } catch (error) {
        console.error('Error sending guide:', error);
        console.error('Template ID used:', 'template_wna04vr');
        console.error('Service ID used:', 'service_1c4k67j');
        
        let errorMessage = 'Failed to send guide. Please try again.';
        if (error.status === 400 && error.text.includes('template ID not found')) {
            errorMessage = 'Template configuration error. Please contact support.';
            console.error('Please check your EmailJS dashboard for the correct template ID at: https://dashboard.emailjs.com/admin/templates');
        }
        
        document.getElementById('guideErrorText').textContent = errorMessage;
        document.getElementById('guideErrorMessage').classList.remove('hidden');
        document.getElementById('guideSuccessMessage').classList.add('hidden');
    } finally {
        // Restore button
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
        });
    }
}

// Make functions available globally for HTML onclick events
window.openBuyersGuide = openBuyersGuide;
window.closeBuyersGuide = closeBuyersGuide;
window.showGuideSection = showGuideSection;
window.openEmailGuideModal = openEmailGuideModal;
window.closeEmailGuideModal = closeEmailGuideModal;