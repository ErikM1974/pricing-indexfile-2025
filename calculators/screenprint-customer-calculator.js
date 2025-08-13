/**
 * Customer Supplied Screen Print Calculator
 * Handles pricing calculations and quote generation for customer supplied screen printing
 */

class CustomerScreenPrintCalculator {
    constructor() {
        // Configuration
        this.SCREEN_FEE_PER_COLOR = 30.00;
        this.LTM_FEE = 100.00;
        this.MINIMUM_QUANTITY = 24;
        
        // Retail pricing tiers
        this.RETAIL_PRINT_PRICING = {
            "24-71":   [null, 6.25, 8.00, 10.00, 11.75, 13.75, 15.50],
            "72-143":  [null, 3.25, 4.00, 4.75, 5.50, 6.25, 7.00],
            "144-287": [null, 2.50, 3.00, 3.75, 4.25, 5.00, 5.50],
            "288-499": [null, 2.00, 2.50, 2.75, 3.25, 3.50, 4.00],
            "500+":    [null, 1.75, 2.00, 2.25, 2.50, 2.75, 3.00],
        };

        // Initialize elements
        this.initializeElements();
        
        // Initialize EmailJS
        emailjs.init('4qSbDO-SQs19TbP80');
        this.emailConfig = {
            serviceId: 'service_1c4k67j',
            templateId: 'template_igd6jtm'
        };
        
        // Initialize quote service
        this.quoteService = new CustomerScreenPrintQuoteService();
        
        // Store current calculation
        this.currentCalculation = null;
        this.lastQuoteData = null;
        
        // Attach event listeners
        this.attachEventListeners();
        
        // Initial display
        this.resetDisplay("Enter Details");
    }

    initializeElements() {
        // Calculator inputs
        this.quantity = document.getElementById('quantity');
        this.frontColors = document.getElementById('frontColors');
        this.backColors = document.getElementById('backColors');
        this.darkShirtToggle = document.getElementById('darkShirtToggle');
        this.safetyStripesToggle = document.getElementById('safetyStripesToggle');
        this.safetyStripesNotice = document.getElementById('safetyStripesNotice');
        
        // Display elements
        this.priceDisplay = document.getElementById('priceDisplay');
        this.orderSummary = document.getElementById('orderSummary');
        this.quoteActions = document.getElementById('quoteActions');
        
        // Quote form elements
        this.quoteForm = document.getElementById('quoteForm');
        this.customerName = document.getElementById('customerName');
        this.customerEmail = document.getElementById('customerEmail');
        this.customerPhone = document.getElementById('customerPhone');
        this.companyName = document.getElementById('companyName');
        this.projectName = document.getElementById('projectName');
        this.salesRep = document.getElementById('salesRep');
        this.notes = document.getElementById('notes');
        this.saveToDatabase = document.getElementById('saveToDatabase');
        this.quotePreview = document.getElementById('quotePreview');
        
        // Buttons
        this.sendQuoteBtn = document.getElementById('sendQuoteBtn');
        this.submitQuoteBtn = document.getElementById('submitQuoteBtn');
    }

    attachEventListeners() {
        // Calculator inputs
        this.quantity.addEventListener('input', () => this.calculatePrice());
        this.frontColors.addEventListener('change', () => this.calculatePrice());
        this.backColors.addEventListener('change', () => this.calculatePrice());
        this.darkShirtToggle.addEventListener('change', () => this.calculatePrice());
        this.safetyStripesToggle.addEventListener('change', () => {
            this.safetyStripesNotice.style.display = this.safetyStripesToggle.checked ? 'block' : 'none';
            this.calculatePrice();
        });
        
        // Quote form
        this.sendQuoteBtn.addEventListener('click', () => this.openQuoteModal());
        this.quoteForm.addEventListener('submit', (e) => this.handleQuoteSubmit(e));
    }

    getPriceTier(quantity) {
        if (quantity >= 500) return "500+";
        if (quantity >= 288) return "288-499";
        if (quantity >= 144) return "144-287";
        if (quantity >= 72) return "72-143";
        if (quantity >= 24) return "24-71";
        return null;
    }

    calculatePrice() {
        const quantity = parseInt(this.quantity.value) || 0;
        const frontColors = parseInt(this.frontColors.value);
        const backColors = parseInt(this.backColors.value);
        const isDarkShirt = this.darkShirtToggle.checked;
        const hasSafetyStripes = this.safetyStripesToggle.checked;

        if (quantity === 0) {
            this.resetDisplay("Enter Quantity");
            return;
        }
        if (quantity < this.MINIMUM_QUANTITY) {
            this.resetDisplay(`Min ${this.MINIMUM_QUANTITY} pieces`);
            return;
        }
        if (frontColors === 0 && backColors === 0) {
            this.resetDisplay("Select Colors");
            return;
        }

        const priceTier = this.getPriceTier(quantity);
        if (!priceTier) {
            this.resetDisplay("Invalid quantity");
            return;
        }

        let ltmFeeTotal = 0;
        if (quantity >= 24 && quantity < 72) {
            ltmFeeTotal = this.LTM_FEE;
        }
        
        let effectiveFrontColors = frontColors;
        if (isDarkShirt && frontColors > 0) {
            effectiveFrontColors++;
        }

        const frontPrintCost = (frontColors > 0) ? (this.RETAIL_PRINT_PRICING[priceTier][effectiveFrontColors] || 0) : 0;
        const backPrintCost = (backColors > 0) ? (this.RETAIL_PRINT_PRICING[priceTier][backColors] || 0) : 0;
        
        let pricePerShirt = frontPrintCost + backPrintCost;

        // Add safety stripes cost if selected
        let safetyStripesCost = 0;
        if (hasSafetyStripes) {
            safetyStripesCost = 2.00; // $2 per shirt for safety stripes
            pricePerShirt += safetyStripesCost;
        }

        // Round the final price per shirt UP to the nearest dollar
        pricePerShirt = Math.ceil(pricePerShirt);
        
        const totalScreenColors = effectiveFrontColors + backColors;
        const totalSetupFee = totalScreenColors * this.SCREEN_FEE_PER_COLOR;
        
        const orderSubtotal = pricePerShirt * quantity;
        const finalTotal = orderSubtotal + totalSetupFee + ltmFeeTotal;

        // Store current calculation
        this.currentCalculation = {
            quantity,
            frontColors,
            backColors,
            effectiveFrontColors,
            isDarkShirt,
            hasSafetyStripes,
            pricePerShirt,
            totalScreenColors,
            totalSetupFee,
            ltmFeeTotal,
            orderSubtotal,
            finalTotal,
            priceTier
        };

        // Update display
        this.priceDisplay.classList.remove('prompt');
        this.priceDisplay.textContent = `$${pricePerShirt.toFixed(2)}`;
        
        let summaryHtml = `
            <div class="summary-item">
                <span>Subtotal (${quantity} prints)</span>
                <strong>$${orderSubtotal.toFixed(2)}</strong>
            </div>`;
        
        if (ltmFeeTotal > 0) {
            summaryHtml += `
            <div class="summary-item">
                <span>LTM Fee</span>
                <strong>$${ltmFeeTotal.toFixed(2)}</strong>
            </div>`;
        }
        
        summaryHtml += `
            <div class="summary-item">
                <span>Setup Fee (${totalScreenColors} screens)</span>
                <strong>$${totalSetupFee.toFixed(2)}</strong>
            </div>
            <div class="summary-item total">
                <span>Total Order Cost</span>
                <strong>$${finalTotal.toFixed(2)}</strong>
            </div>`;
        
        this.orderSummary.innerHTML = summaryHtml;
        this.quoteActions.style.display = 'flex';
    }

    resetDisplay(promptText) {
        this.priceDisplay.textContent = promptText;
        this.priceDisplay.classList.add('prompt');
        this.orderSummary.innerHTML = '';
        this.quoteActions.style.display = 'none';
        this.currentCalculation = null;
    }

    openQuoteModal() {
        if (!this.currentCalculation) return;
        
        // Update quote preview
        this.updateQuotePreview();
        
        // Show modal
        document.getElementById('quoteModal').classList.add('active');
    }

    updateQuotePreview() {
        if (!this.currentCalculation) return;
        
        const calc = this.currentCalculation;
        let previewHtml = `
            <h4 style="margin-top: 0;">Quote Summary</h4>
            <table style="width: 100%;">
                <tr>
                    <th style="background: var(--primary-color); color: white; padding: 8px;">Description</th>
                    <th style="background: var(--primary-color); color: white; padding: 8px; text-align: center;">Qty</th>
                    <th style="background: var(--primary-color); color: white; padding: 8px; text-align: right;">Price</th>
                    <th style="background: var(--primary-color); color: white; padding: 8px; text-align: right;">Total</th>
                </tr>`;
        
        // Show front print if applicable
        if (calc.frontColors > 0) {
            const frontCost = this.RETAIL_PRINT_PRICING[calc.priceTier][calc.effectiveFrontColors] || 0;
            previewHtml += `
                <tr>
                    <td style="padding: 8px;">Front Print - ${calc.effectiveFrontColors} color${calc.effectiveFrontColors > 1 ? 's' : ''}${calc.isDarkShirt && calc.frontColors > 0 ? ' (includes white base)' : ''}</td>
                    <td style="padding: 8px; text-align: center;">${calc.quantity}</td>
                    <td style="padding: 8px; text-align: right;">$${frontCost.toFixed(2)}</td>
                    <td style="padding: 8px; text-align: right;">$${(frontCost * calc.quantity).toFixed(2)}</td>
                </tr>`;
        }
        
        // Show back print if applicable
        if (calc.backColors > 0) {
            const backCost = this.RETAIL_PRINT_PRICING[calc.priceTier][calc.backColors] || 0;
            previewHtml += `
                <tr>
                    <td style="padding: 8px;">Back Print - ${calc.backColors} color${calc.backColors > 1 ? 's' : ''}</td>
                    <td style="padding: 8px; text-align: center;">${calc.quantity}</td>
                    <td style="padding: 8px; text-align: right;">$${backCost.toFixed(2)}</td>
                    <td style="padding: 8px; text-align: right;">$${(backCost * calc.quantity).toFixed(2)}</td>
                </tr>`;
        }
        
        // Show safety stripes if applicable
        if (calc.hasSafetyStripes) {
            previewHtml += `
                <tr>
                    <td style="padding: 8px;">Safety Stripes</td>
                    <td style="padding: 8px; text-align: center;">${calc.quantity}</td>
                    <td style="padding: 8px; text-align: right;">$2.00</td>
                    <td style="padding: 8px; text-align: right;">$${(2.00 * calc.quantity).toFixed(2)}</td>
                </tr>`;
        }
        
        if (calc.ltmFeeTotal > 0) {
            previewHtml += `
                <tr>
                    <td style="padding: 8px;" colspan="3">Less Than Minimum Fee</td>
                    <td style="padding: 8px; text-align: right;">$${calc.ltmFeeTotal.toFixed(2)}</td>
                </tr>`;
        }
        
        previewHtml += `
                <tr>
                    <td style="padding: 8px;" colspan="3">Setup Fee (${calc.totalScreenColors} screens @ $${this.SCREEN_FEE_PER_COLOR})</td>
                    <td style="padding: 8px; text-align: right;">$${calc.totalSetupFee.toFixed(2)}</td>
                </tr>
                <tr style="font-weight: bold; border-top: 2px solid var(--primary-color);">
                    <td style="padding: 8px;" colspan="3">Total</td>
                    <td style="padding: 8px; text-align: right;">$${calc.finalTotal.toFixed(2)}</td>
                </tr>
            </table>`;
        
        this.quotePreview.innerHTML = previewHtml;
    }

    async handleQuoteSubmit(e) {
        e.preventDefault();
        
        if (!this.validateQuoteForm()) return;
        if (!this.currentCalculation) return;
        
        try {
            this.showLoading();
            
            // Build quote data
            const quoteData = {
                // Customer info
                customerName: this.customerName.value.trim(),
                customerEmail: this.customerEmail.value.trim(),
                customerPhone: this.customerPhone.value.trim(),
                companyName: this.companyName.value.trim(),
                projectName: this.projectName.value.trim(),
                
                // Order details
                quantity: this.currentCalculation.quantity,
                frontColors: this.currentCalculation.frontColors,
                backColors: this.currentCalculation.backColors,
                isDarkGarment: this.currentCalculation.isDarkShirt,
                safetyStripes: this.currentCalculation.hasSafetyStripes,
                
                // Pricing
                pricePerShirt: this.currentCalculation.pricePerShirt,
                orderSubtotal: this.currentCalculation.orderSubtotal,
                ltmFeeTotal: this.currentCalculation.ltmFeeTotal,
                setupFee: this.currentCalculation.totalSetupFee,
                finalTotal: this.currentCalculation.finalTotal,
                
                // Options
                notes: this.notes.value.trim(),
                
                // Sales rep
                salesRepEmail: this.salesRep.value,
                salesRepName: this.getSalesRepName(this.salesRep.value)
            };
            
            // Generate quote ID
            const quoteId = this.quoteService.generateQuoteID();
            quoteData.quoteId = quoteId;
            
            // Save to database if enabled
            if (this.saveToDatabase.checked) {
                const saveResult = await this.quoteService.saveQuote(quoteData);
                if (!saveResult.success) {
                    console.error('Database save failed:', saveResult.error);
                }
            }
            
            // Send email
            const emailData = this.buildEmailData(quoteData);
            
            
            await emailjs.send(
                this.emailConfig.serviceId,
                this.emailConfig.templateId,
                emailData
            );
            
            // Show success
            this.showSuccessModal(quoteId, quoteData);
            
            // Close quote modal
            this.closeQuoteModal();
            
            // Reset form
            this.quoteForm.reset();
            
        } catch (error) {
            console.error('Quote submission error:', error);
            alert('Failed to send quote. Please try again.');
        } finally {
            this.hideLoading();
        }
    }

    buildEmailData(quoteData) {
        return {
            // Email routing
            to_email: quoteData.customerEmail,
            from_name: 'Northwest Custom Apparel',
            reply_to: quoteData.salesRepEmail,
            
            // Quote identification
            quote_type: 'Customer Supplied Screen Print',
            quote_id: quoteData.quoteId,
            quote_date: new Date().toLocaleDateString(),
            
            // Customer info
            customer_name: quoteData.customerName,
            customer_email: quoteData.customerEmail,
            company_name: quoteData.companyName || '',
            customer_phone: quoteData.customerPhone || '',
            project_name: quoteData.projectName || '',
            
            // Pricing
            grand_total: quoteData.finalTotal.toFixed(2),
            
            // Content
            products_html: this.generateQuoteHTML(quoteData),
            notes: quoteData.notes || 'No special notes for this order',
            
            // Sales rep
            sales_rep_name: quoteData.salesRepName,
            sales_rep_email: quoteData.salesRepEmail,
            sales_rep_phone: '253-922-5793',
            
            // Company
            company_year: '1977'
        };
    }

    generateQuoteHTML(quoteData) {
        const calc = this.currentCalculation;
        
        let html = `
            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                <thead>
                    <tr style="background: #4cb354; color: white;">
                        <th style="padding: 12px; text-align: left;">Description</th>
                        <th style="padding: 12px; text-align: center;">Quantity</th>
                        <th style="padding: 12px; text-align: right;">Price</th>
                        <th style="padding: 12px; text-align: right;">Total</th>
                    </tr>
                </thead>
                <tbody>`;
        
        // Show front print if applicable
        if (calc.frontColors > 0) {
            const frontCost = this.RETAIL_PRINT_PRICING[calc.priceTier][calc.effectiveFrontColors] || 0;
            html += `
                    <tr>
                        <td style="padding: 12px; border-bottom: 1px solid #ddd;">
                            Front Print - ${calc.effectiveFrontColors} color${calc.effectiveFrontColors > 1 ? 's' : ''}
                            ${calc.isDarkShirt && calc.frontColors > 0 ? '<br><small style="color: #666;">(includes white base)</small>' : ''}
                        </td>
                        <td style="padding: 12px; text-align: center; border-bottom: 1px solid #ddd;">${calc.quantity}</td>
                        <td style="padding: 12px; text-align: right; border-bottom: 1px solid #ddd;">$${frontCost.toFixed(2)}</td>
                        <td style="padding: 12px; text-align: right; border-bottom: 1px solid #ddd;">$${(frontCost * calc.quantity).toFixed(2)}</td>
                    </tr>`;
        }
        
        // Show back print if applicable
        if (calc.backColors > 0) {
            const backCost = this.RETAIL_PRINT_PRICING[calc.priceTier][calc.backColors] || 0;
            html += `
                    <tr>
                        <td style="padding: 12px; border-bottom: 1px solid #ddd;">Back Print - ${calc.backColors} color${calc.backColors > 1 ? 's' : ''}</td>
                        <td style="padding: 12px; text-align: center; border-bottom: 1px solid #ddd;">${calc.quantity}</td>
                        <td style="padding: 12px; text-align: right; border-bottom: 1px solid #ddd;">$${backCost.toFixed(2)}</td>
                        <td style="padding: 12px; text-align: right; border-bottom: 1px solid #ddd;">$${(backCost * calc.quantity).toFixed(2)}</td>
                    </tr>`;
        }
        
        // Show safety stripes if applicable
        if (calc.hasSafetyStripes) {
            html += `
                    <tr>
                        <td style="padding: 12px; border-bottom: 1px solid #ddd;">Safety Stripes (Pocket/Shoulder)</td>
                        <td style="padding: 12px; text-align: center; border-bottom: 1px solid #ddd;">${calc.quantity}</td>
                        <td style="padding: 12px; text-align: right; border-bottom: 1px solid #ddd;">$2.00</td>
                        <td style="padding: 12px; text-align: right; border-bottom: 1px solid #ddd;">$${(2.00 * calc.quantity).toFixed(2)}</td>
                    </tr>`;
        }
        
        if (calc.ltmFeeTotal > 0) {
            html += `
                    <tr>
                        <td style="padding: 12px; border-bottom: 1px solid #ddd;" colspan="3">Less Than Minimum Fee</td>
                        <td style="padding: 12px; text-align: right; border-bottom: 1px solid #ddd;">$${calc.ltmFeeTotal.toFixed(2)}</td>
                    </tr>`;
        }
        
        html += `
                    <tr>
                        <td style="padding: 12px; border-bottom: 1px solid #ddd;" colspan="3">Setup Fee (${calc.totalScreenColors} screens @ $${this.SCREEN_FEE_PER_COLOR})</td>
                        <td style="padding: 12px; text-align: right; border-bottom: 1px solid #ddd;">$${calc.totalSetupFee.toFixed(2)}</td>
                    </tr>
                </tbody>
                <tfoot>
                    <tr style="font-weight: bold;">
                        <td style="padding: 12px; border-top: 2px solid #4cb354;" colspan="3">Total</td>
                        <td style="padding: 12px; text-align: right; border-top: 2px solid #4cb354;">$${calc.finalTotal.toFixed(2)}</td>
                    </tr>
                </tfoot>
            </table>`;
        
        return html;
    }

    validateQuoteForm() {
        const errors = [];
        
        if (!this.customerName.value.trim()) {
            errors.push('Customer name is required');
        }
        
        if (!this.validateEmail(this.customerEmail.value)) {
            errors.push('Valid email is required');
        }
        
        if (errors.length > 0) {
            alert(errors.join('\n'));
            return false;
        }
        
        return true;
    }

    validateEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    getSalesRepName(email) {
        const reps = {
            'ruth@nwcustomapparel.com': 'Ruth Nhong',
            'taylar@nwcustomapparel.com': 'Taylar',
            'nika@nwcustomapparel.com': 'Nika',
            'erik@nwcustomapparel.com': 'Erik',
            'adriyella@nwcustomapparel.com': 'Adriyella',
            'bradley@nwcustomapparel.com': 'Bradley',
            'jim@nwcustomapparel.com': 'Jim',
            'art@nwcustomapparel.com': 'Steve (Artist)',
            'sales@nwcustomapparel.com': 'Northwest Custom Apparel Sales Team'
        };
        return reps[email] || 'Sales Team';
    }

    showSuccessModal(quoteId, quoteData) {
        document.getElementById('modalQuoteId').textContent = quoteId;
        document.getElementById('modalCustomerName').textContent = quoteData.customerName;
        document.getElementById('modalCustomerEmail').textContent = quoteData.customerEmail;
        document.getElementById('modalTotalAmount').textContent = `$${quoteData.finalTotal.toFixed(2)}`;
        
        this.lastQuoteData = quoteData;
        
        document.getElementById('successModal').classList.add('active');
    }

    closeQuoteModal() {
        document.getElementById('quoteModal').classList.remove('active');
    }

    showLoading() {
        this.submitQuoteBtn.disabled = true;
        this.submitQuoteBtn.innerHTML = '<span class="loading"></span> Sending...';
    }

    hideLoading() {
        this.submitQuoteBtn.disabled = false;
        this.submitQuoteBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Send Quote';
    }
}

// Modal functions
function closeQuoteModal() {
    document.getElementById('quoteModal').classList.remove('active');
}

function closeSuccessModal() {
    document.getElementById('successModal').classList.remove('active');
}

function copyQuoteId() {
    const quoteId = document.getElementById('modalQuoteId').textContent;
    navigator.clipboard.writeText(quoteId).then(() => {
        alert('Quote ID copied to clipboard!');
    }).catch(err => {
        console.error('Failed to copy:', err);
        alert('Failed to copy Quote ID');
    });
}

function printQuote() {
    const calculator = window.calculator;
    if (!calculator.lastQuoteData) return;
    
    const data = calculator.lastQuoteData;
    const calc = calculator.currentCalculation;
    const printWindow = window.open('', '_blank');
    
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Quote ${data.quoteId}</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    max-width: 800px;
                    margin: 0 auto;
                    padding: 20px;
                }
                .header {
                    text-align: center;
                    margin-bottom: 30px;
                }
                .logo {
                    max-width: 300px;
                    margin-bottom: 20px;
                }
                .quote-info {
                    margin-bottom: 30px;
                }
                .info-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 20px;
                    margin-bottom: 30px;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 30px;
                }
                th, td {
                    padding: 10px;
                    text-align: left;
                    border-bottom: 1px solid #ddd;
                }
                th {
                    background-color: #f5f5f5;
                    font-weight: bold;
                }
                .total {
                    font-size: 1.2em;
                    font-weight: bold;
                    text-align: right;
                    margin-top: 20px;
                }
                .notice {
                    background: #fffbeb;
                    border: 1px solid #fde68a;
                    padding: 15px;
                    margin-top: 30px;
                    color: #92400e;
                }
                @media print {
                    body { margin: 0; }
                }
            </style>
        </head>
        <body>
            <div class="header">
                <img src="https://cdn.caspio.com/A0E15000/Safety%20Stripes/web%20northwest%20custom%20apparel%20logo.png?ver=1" 
                     alt="Northwest Custom Apparel" class="logo">
                <h2>Customer Supplied Screen Print Quote</h2>
            </div>
            
            <div class="quote-info">
                <p><strong>Quote ID:</strong> ${data.quoteId}</p>
                <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
            </div>
            
            <div class="info-grid">
                <div>
                    <h3>Customer Information</h3>
                    <p><strong>Name:</strong> ${data.customerName}</p>
                    <p><strong>Email:</strong> ${data.customerEmail}</p>
                    ${data.customerPhone ? `<p><strong>Phone:</strong> ${data.customerPhone}</p>` : ''}
                    ${data.companyName ? `<p><strong>Company:</strong> ${data.companyName}</p>` : ''}
                </div>
                <div>
                    <h3>Order Details</h3>
                    <p><strong>Quantity:</strong> ${data.quantity}</p>
                    <p><strong>Front Colors:</strong> ${data.frontColors}</p>
                    <p><strong>Back Colors:</strong> ${data.backColors}</p>
                    ${data.isDarkGarment ? '<p><strong>Dark Garment:</strong> Yes (white base added)</p>' : ''}
                    ${data.safetyStripes ? '<p><strong>Safety Stripes:</strong> Yes</p>' : ''}
                    ${data.projectName ? `<p><strong>Project:</strong> ${data.projectName}</p>` : ''}
                </div>
            </div>
            
            ${calculator.generateQuoteHTML(data)}
            
            ${data.notes ? `
                <div style="background: #f5f5f5; padding: 15px; margin-top: 30px;">
                    <h3>Notes</h3>
                    <p>${data.notes}</p>
                </div>
            ` : ''}
            
            <div class="notice">
                <h3>Important Notice: Customer Supplied Garments</h3>
                <p>Northwest Custom Apparel is not responsible for the damage of ANY customer supplied garments. Should items be damaged while in our facility, we will NOT reimburse you for their value or replace them.</p>
            </div>
            
            <div style="margin-top: 50px; text-align: center; color: #666;">
                <p>Family Owned & Operated Since 1977</p>
                <p>253-922-5793 | sales@nwcustomapparel.com</p>
            </div>
            
            <script>
                window.onload = () => {
                    window.print();
                    setTimeout(() => window.close(), 500);
                };
            <\/script>
        </body>
        </html>
    `);
}