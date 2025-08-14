/**
 * Emblem Calculator Class
 * Handles pricing calculations and quote generation for embroidered emblems
 */

class EmblemCalculator {
    constructor() {
        // Initialize EmailJS
        emailjs.init('4qSbDO-SQs19TbP80');
        
        // Initialize quote service
        this.quoteService = new EmblemQuoteService();
        
        // Current quote data
        this.currentQuote = null;
        
        // Constants
        this.LTM_FEE = 50.00;
        this.DIGITIZING_FEE = 100.00;
        this.PRICING_GRID = {
            "1.00":[2.2,1.91,1.41,1.01,0.86,0.74,0.65,0.59,0.54,0.49],
            "1.50":[2.77,2.41,1.78,1.27,1.09,0.93,0.82,0.74,0.68,0.61],
            "2.00":[3.87,3.37,2.49,1.78,1.52,1.3,1.14,1.03,0.95,0.86],
            "2.50":[4.97,4.32,3.19,2.29,1.95,1.67,1.47,1.33,1.21,1.1],
            "3.00":[6.07,5.28,3.9,2.79,2.38,2.03,1.79,1.62,1.48,1.34],
            "3.50":[7.17,6.23,4.6,3.3,2.81,2.4,2.12,1.91,1.75,1.59],
            "4.00":[8.28,7.19,5.31,3.81,3.24,2.77,2.44,2.21,2.02,1.83],
            "4.50":[9.38,8.15,6.02,4.31,3.67,3.14,2.77,2.5,2.29,2.08],
            "5.00":[10.48,9.1,6.72,4.82,4.1,3.51,3.09,2.8,2.56,2.32],
            "6.00":[12.13,10.54,7.78,5.58,4.75,4.06,3.58,3.24,2.96,2.69],
            "7.00":[14.33,12.45,9.19,6.59,5.61,4.8,4.23,3.82,3.5,3.17],
            "8.00":[16.53,14.36,10.61,7.6,6.48,5.54,4.88,4.41,4.04,3.66],
            "9.00":[18.73,16.27,12.02,8.62,7.34,6.28,5.53,5,4.57,4.15],
            "10.00":[20.93,18.19,13.43,9.63,8.2,7.01,6.18,5.59,5.11,4.64],
            "11.00":[23.13,20.1,14.84,10.64,9.06,7.75,6.83,6.17,5.65,5.12],
            "12.00":[25.34,22.01,16.26,11.65,9.93,8.49,7.48,6.76,6.19,5.61]
        };
        
        // Sales rep mapping
        this.salesRepNames = {
            'jim@nwcustomapparel.com': 'Jim Mickelson',
            'erik@nwcustomapparel.com': 'Erik',
            'nika@nwcustomapparel.com': 'Nika',
            'taylar@nwcustomapparel.com': 'Taylar',
            'adriyella@nwcustomapparel.com': 'Adriyella',
            'ruth@nwcustomapparel.com': 'Ruth Nhong',
            'bradley@nwcustomapparel.com': 'Bradley',
            'art@nwcustomapparel.com': 'Steve (Artist)',
            'sales@nwcustomapparel.com': 'Northwest Custom Apparel Sales Team'
        };
        
        // Initialize elements
        this.initializeElements();
        
        // Bind events
        this.bindEvents();
    }
    
    initializeElements() {
        this.elements = {
            // Inputs
            width: document.getElementById('emblemWidth'),
            height: document.getElementById('emblemHeight'),
            quantity: document.getElementById('quantity'),
            metallicThread: document.getElementById('metallicThread'),
            velcroBacking: document.getElementById('velcroBacking'),
            extraColors: document.getElementById('extraColors'),
            digitizingFee: document.getElementById('digitizingFee'),
            
            // Display elements
            priceDisplay: document.getElementById('priceDisplay'),
            subtotalDisplay: document.getElementById('subtotalDisplay'),
            feesDisplay: document.getElementById('feesDisplay'),
            totalDisplay: document.getElementById('totalDisplay'),
            breakdownIcon: document.getElementById('price-breakdown-icon'),
            emailQuoteBtn: document.getElementById('emailQuoteBtn'),
            
            // Modal elements
            modal: document.getElementById('quoteModal'),
            quoteForm: document.getElementById('quoteForm'),
            quotePreview: document.getElementById('quotePreview'),
            sendQuoteBtn: document.getElementById('sendQuoteBtn'),
            
            // Message elements
            successMessage: document.getElementById('successMessage'),
            errorMessage: document.getElementById('errorMessage'),
            errorText: document.getElementById('errorText'),
            quoteIdDisplay: document.getElementById('quoteIdDisplay')
        };
        
        // Get all inputs for event binding
        this.inputs = [
            this.elements.width,
            this.elements.height,
            this.elements.quantity,
            this.elements.metallicThread,
            this.elements.velcroBacking,
            this.elements.extraColors,
            this.elements.digitizingFee
        ];
    }
    
    bindEvents() {
        // Bind input events
        this.inputs.forEach(input => {
            input.addEventListener('input', () => this.calculatePrice());
            input.addEventListener('change', () => this.calculatePrice());
        });
        
        // Email quote button
        this.elements.emailQuoteBtn.addEventListener('click', () => this.openModal());
        
        // Form submission
        this.elements.quoteForm.addEventListener('submit', (e) => this.handleQuoteSubmit(e));
        
        // Close modal on backdrop click
        this.elements.modal.addEventListener('click', (e) => {
            if (e.target === this.elements.modal) {
                this.closeModal();
            }
        });
    }
    
    clearHighlight() {
        const highlighted = document.querySelector('.highlighted-cell');
        if (highlighted) {
            highlighted.classList.remove('highlighted-cell');
        }
    }
    
    highlightCell(sizeKey, qtyIndex) {
        this.clearHighlight();
        const selector = `tr[data-size-tier="${sizeKey}"] td[data-qty-index="${qtyIndex}"]`;
        const cell = document.querySelector(selector);
        if (cell) {
            cell.classList.add('highlighted-cell');
        }
    }
    
    calculatePrice() {
        const width = parseFloat(this.elements.width.value) || 0;
        const height = parseFloat(this.elements.height.value) || 0;
        const quantity = parseInt(this.elements.quantity.value) || 0;
        const isNewDesign = this.elements.digitizingFee.checked;
        
        if (width <= 0 || height <= 0) {
            this.resetDisplay("Enter dimensions");
            return;
        }
        if (quantity < 25) {
            this.resetDisplay(quantity === 0 ? "Enter quantity" : "Min quantity is 25");
            return;
        }
        
        // Enable email button
        this.elements.emailQuoteBtn.disabled = false;
        this.elements.priceDisplay.classList.remove('prompt');
        
        // Calculate size tier
        const size = (width + height) / 2;
        const sizeKeys = Object.keys(this.PRICING_GRID).map(parseFloat).sort((a,b) => a-b);
        const sizeTier = sizeKeys.find(key => size <= key) || sizeKeys[sizeKeys.length - 1];
        
        // Calculate quantity tier
        let qtyIndex = -1;
        if (quantity >= 10000) qtyIndex = 9;
        else if (quantity >= 5000) qtyIndex = 8;
        else if (quantity >= 2000) qtyIndex = 7;
        else if (quantity >= 1000) qtyIndex = 6;
        else if (quantity >= 500) qtyIndex = 5;
        else if (quantity >= 300) qtyIndex = 4;
        else if (quantity >= 200) qtyIndex = 3;
        else if (quantity >= 100) qtyIndex = 2;
        else if (quantity >= 50) qtyIndex = 1;
        else if (quantity >= 25) qtyIndex = 0;
        
        if (qtyIndex === -1) return;
        
        // Get base price
        let basePrice = this.PRICING_GRID[sizeTier.toFixed(2)][qtyIndex];
        
        // Calculate add-ons
        let addOnCost = 0;
        let addOnPercentage = 0;
        if (this.elements.metallicThread.checked) addOnPercentage += 0.25;
        if (this.elements.velcroBacking.checked) addOnPercentage += 0.25;
        const extraColors = parseInt(this.elements.extraColors.value) || 0;
        if (extraColors > 0) addOnPercentage += (extraColors * 0.10);
        
        if (addOnPercentage > 0) {
            addOnCost = basePrice * addOnPercentage;
        }
        
        // LTM fee is part of per-emblem price
        const ltmChargePerPatch = (quantity < 200) ? (this.LTM_FEE / quantity) : 0;
        const pricePerPatch = basePrice + addOnCost + ltmChargePerPatch;
        const totalOneTimeFees = isNewDesign ? this.DIGITIZING_FEE : 0;
        const orderSubtotal = pricePerPatch * quantity;
        const estimatedTotal = orderSubtotal + totalOneTimeFees;
        
        // Update display
        this.elements.priceDisplay.textContent = `$${pricePerPatch.toFixed(2)}`;
        this.elements.subtotalDisplay.textContent = `$${orderSubtotal.toFixed(2)}`;
        this.elements.feesDisplay.textContent = `$${totalOneTimeFees.toFixed(2)}`;
        this.elements.totalDisplay.textContent = `$${estimatedTotal.toFixed(2)}`;
        
        // Update breakdown tooltip
        let breakdownText = `Base Price: $${basePrice.toFixed(2)}`;
        if (addOnCost > 0) breakdownText += `\nAdd-ons: +$${addOnCost.toFixed(2)}`;
        if (ltmChargePerPatch > 0) breakdownText += `\nLTM Fee: +$${ltmChargePerPatch.toFixed(2)}`;
        this.elements.breakdownIcon.setAttribute('data-tooltip', breakdownText);
        
        // Highlight cell
        this.highlightCell(sizeTier.toFixed(2), qtyIndex);
        
        // Store current quote data
        this.currentQuote = {
            width,
            height,
            size,
            sizeTier,
            quantity,
            qtyIndex,
            basePrice,
            addOnCost,
            addOnPercentage,
            metallicThread: this.elements.metallicThread.checked,
            velcroBacking: this.elements.velcroBacking.checked,
            extraColors,
            ltmChargePerPatch,
            pricePerPatch,
            isNewDesign,
            totalOneTimeFees,
            orderSubtotal,
            estimatedTotal
        };
    }
    
    resetDisplay(promptText) {
        this.elements.priceDisplay.textContent = promptText;
        this.elements.priceDisplay.classList.add('prompt');
        this.elements.subtotalDisplay.textContent = "$0.00";
        this.elements.feesDisplay.textContent = "$0.00";
        this.elements.totalDisplay.textContent = "$0.00";
        this.elements.breakdownIcon.setAttribute('data-tooltip', 'Fill out the form to see the cost breakdown.');
        this.elements.emailQuoteBtn.disabled = true;
        this.clearHighlight();
        this.currentQuote = null;
    }
    
    openModal() {
        console.log('[EmblemCalculator] Opening modal, currentQuote:', this.currentQuote);
        if (!this.currentQuote) {
            console.error('[EmblemCalculator] No current quote - modal not opening');
            alert('Please enter emblem dimensions and quantity first');
            return;
        }
        
        // Update preview
        this.updateQuotePreview();
        
        // Show modal - use 'active' class to match calculator-base.css
        this.elements.modal.classList.add('active');
        console.log('[EmblemCalculator] Modal should now be visible');
        
        // Focus first input
        setTimeout(() => {
            const customerNameInput = document.getElementById('customerName');
            if (customerNameInput) {
                customerNameInput.focus();
            }
        }, 100);
    }
    
    closeModal() {
        this.elements.modal.classList.remove('active');
        this.elements.quoteForm.reset();
        // Keep Jim as default
        document.getElementById('salesRep').value = 'jim@nwcustomapparel.com';
    }
    
    updateQuotePreview() {
        if (!this.currentQuote) return;
        
        const { width, height, quantity, pricePerPatch, orderSubtotal, totalOneTimeFees, estimatedTotal } = this.currentQuote;
        
        let optionsText = [];
        if (this.currentQuote.metallicThread) optionsText.push('Metallic Thread');
        if (this.currentQuote.velcroBacking) optionsText.push('Velcro Backing');
        if (this.currentQuote.extraColors > 0) optionsText.push(`${this.currentQuote.extraColors} Extra Color${this.currentQuote.extraColors > 1 ? 's' : ''}`);
        
        let html = `
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
                        <td>
                            Embroidered Emblem (${width}" × ${height}")
                            ${optionsText.length > 0 ? '<br><small>' + optionsText.join(', ') + '</small>' : ''}
                        </td>
                        <td class="text-center">${quantity}</td>
                        <td class="text-right">$${pricePerPatch.toFixed(2)}</td>
                        <td class="text-right">$${orderSubtotal.toFixed(2)}</td>
                    </tr>
        `;
        
        if (totalOneTimeFees > 0) {
            html += `
                    <tr>
                        <td colspan="3">Digitizing Fee (one-time)</td>
                        <td class="text-right">$${totalOneTimeFees.toFixed(2)}</td>
                    </tr>
            `;
        }
        
        html += `
                    <tr style="font-weight: 600;">
                        <td colspan="3">Total</td>
                        <td class="text-right">$${estimatedTotal.toFixed(2)}</td>
                    </tr>
                </tbody>
            </table>
        `;
        
        if (quantity < 200) {
            html += `<p style="margin-top: 1rem; font-size: 0.875rem; color: var(--muted-text-color);">
                Note: LTM fee of $${this.LTM_FEE.toFixed(2)} is included in the per-emblem price.
            </p>`;
        }
        
        this.elements.quotePreview.innerHTML = html;
    }
    
    async handleQuoteSubmit(e) {
        e.preventDefault();
        console.log('[EmblemCalculator] Form submitted');
        
        if (!this.currentQuote) {
            console.error('[EmblemCalculator] No current quote data');
            alert('Please calculate a quote first');
            return;
        }
        
        // Show loading state
        this.setLoadingState(true);
        
        try {
            // Get form data
            const customerName = document.getElementById('customerName').value.trim();
            const companyName = document.getElementById('companyName').value.trim();
            const customerEmail = document.getElementById('customerEmail').value.trim();
            const customerPhone = document.getElementById('customerPhone').value.trim();
            const projectName = document.getElementById('projectName').value.trim();
            const salesRepEmail = document.getElementById('salesRep').value;
            const notes = document.getElementById('notes').value.trim();
            const saveToDatabase = document.getElementById('saveToDatabase') ? document.getElementById('saveToDatabase').checked : false;
            
            const salesRepName = this.salesRepNames[salesRepEmail] || 'Sales Team';
            
            // Generate quote ID
            const quoteId = this.quoteService.generateQuoteID();
            
            // Save to database if requested
            let saveResult = { success: false };
            if (saveToDatabase) {
                const quoteData = {
                    ...this.currentQuote,
                    quoteId,
                    customerName,
                    companyName,
                    customerEmail,
                    customerPhone,
                    projectName,
                    notes,
                    salesRepEmail,
                    salesRepName
                };
                
                saveResult = await this.quoteService.saveQuote(quoteData);
                if (!saveResult.success) {
                    console.error('Failed to save quote:', saveResult.error);
                }
            }
            
            // Prepare email data
            const emailData = {
                // System fields
                to_email: customerEmail,
                reply_to: salesRepEmail,
                from_name: 'Northwest Custom Apparel',
                
                // Quote identification
                quote_type: 'Embroidered Emblem',
                quote_id: quoteId,
                quote_date: new Date().toLocaleDateString(),
                
                // Customer info
                customer_name: customerName,
                company_name: companyName || '',
                project_name: projectName || '',
                
                // Quote details
                emblem_size: `${this.currentQuote.width}" × ${this.currentQuote.height}"`,
                quantity: this.currentQuote.quantity.toString(),
                unit_price: `$${this.currentQuote.pricePerPatch.toFixed(2)}`,
                subtotal: `$${this.currentQuote.orderSubtotal.toFixed(2)}`,
                setup_fee: this.currentQuote.totalOneTimeFees > 0 ? `$${this.currentQuote.totalOneTimeFees.toFixed(2)}` : '$0.00',
                grand_total: `$${this.currentQuote.estimatedTotal.toFixed(2)}`,
                
                // Options
                options_text: this.buildOptionsText(),
                special_note: this.currentQuote.quantity < 200 ? `LTM fee of $${this.LTM_FEE.toFixed(2)} is included in the per-emblem price` : '',
                
                // Sales rep info
                sales_rep_name: salesRepName,
                sales_rep_email: salesRepEmail,
                sales_rep_phone: '253-922-5793',
                
                // Company info
                company_year: '1977',
                
                // Notes
                notes: notes || 'No special notes for this order'
            };
            
            console.log('Sending email with data:', emailData);
            
            // Send email
            const emailResult = await emailjs.send(
                'service_1c4k67j',
                'template_vpou6va',
                emailData
            );
            
            console.log('Email sent successfully:', emailResult);
            
            // Show success message
            this.showSuccess(quoteId);
            this.closeModal();
            
        } catch (error) {
            console.error('Error sending quote:', error);
            this.showError('Failed to send quote. Please try again.');
        } finally {
            this.setLoadingState(false);
        }
    }
    
    buildOptionsText() {
        let options = [];
        if (this.currentQuote.metallicThread) options.push('Metallic Thread (+25%)');
        if (this.currentQuote.velcroBacking) options.push('Velcro Backing (+25%)');
        if (this.currentQuote.extraColors > 0) {
            options.push(`${this.currentQuote.extraColors} Extra Color${this.currentQuote.extraColors > 1 ? 's' : ''} (+${this.currentQuote.extraColors * 10}%)`);
        }
        return options.length > 0 ? options.join(', ') : 'Standard embroidery';
    }
    
    setLoadingState(loading) {
        this.elements.sendQuoteBtn.disabled = loading;
        if (loading) {
            this.elements.sendQuoteBtn.innerHTML = '<i class="spinner"></i> Sending...';
        } else {
            this.elements.sendQuoteBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Send Quote';
        }
    }
    
    showSuccess(quoteId) {
        this.elements.quoteIdDisplay.textContent = `Quote ID: ${quoteId}`;
        
        // Also update print quote ID
        const printQuoteId = document.getElementById('printQuoteId');
        if (printQuoteId) {
            printQuoteId.textContent = quoteId;
        }
        this.elements.successMessage.classList.add('show');
        this.elements.errorMessage.classList.remove('show');
        
        // Hide after 10 seconds
        setTimeout(() => {
            this.elements.successMessage.classList.remove('show');
        }, 10000);
    }
    
    showError(message) {
        this.elements.errorText.textContent = message;
        this.elements.errorMessage.classList.add('show');
        this.elements.successMessage.classList.remove('show');
        
        // Hide after 5 seconds
        setTimeout(() => {
            this.elements.errorMessage.classList.remove('show');
        }, 5000);
    }
}

// Helper function to close modal
window.closeModal = function() {
    const calculator = window.emblemCalculator;
    if (calculator) {
        calculator.closeModal();
    }
};

// ShopWorks Guide Functions
function toggleGuide() {
    const guideContent = document.getElementById('guideContent');
    const guideToggle = document.getElementById('guideToggle');
    
    guideContent.classList.toggle('show');
    guideToggle.classList.toggle('expanded');
}

// Pricing Grid Toggle Function
function togglePricingGrid() {
    const pricingContent = document.getElementById('pricingContent');
    const pricingToggle = document.getElementById('pricingToggle');
    
    pricingContent.classList.toggle('show');
    pricingToggle.classList.toggle('expanded');
}

function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
            // Show feedback
            event.target.innerHTML = '<i class="fas fa-check"></i>';
            setTimeout(() => {
                event.target.innerHTML = '<i class="fas fa-copy"></i>';
            }, 1500);
        }).catch(err => {
            console.error('Failed to copy:', err);
            fallbackCopy(text);
        });
    } else {
        fallbackCopy(text);
    }
}

function fallbackCopy(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
        document.execCommand('copy');
        event.target.innerHTML = '<i class="fas fa-check"></i>';
        setTimeout(() => {
            event.target.innerHTML = '<i class="fas fa-copy"></i>';
        }, 1500);
    } catch (err) {
        console.error('Fallback copy failed:', err);
    }
    
    document.body.removeChild(textArea);
}

// FAQ Toggle Functions
function initializeFAQ() {
    const faqQuestions = document.querySelectorAll('.faq-question');
    
    faqQuestions.forEach(question => {
        question.addEventListener('click', function() {
            const faqItem = this.closest('.faq-item');
            const answer = faqItem.querySelector('.faq-answer');
            const isExpanded = faqItem.classList.contains('expanded');
            
            // Toggle current item
            if (isExpanded) {
                faqItem.classList.remove('expanded');
                answer.style.maxHeight = '0';
            } else {
                faqItem.classList.add('expanded');
                // Calculate actual height needed
                answer.style.maxHeight = answer.scrollHeight + 'px';
            }
        });
    });
}

// Print Quote Function - Added to fix undefined printQuote() error
function printQuote() {
    const calc = window.emblemCalculator;
    if (!calc?.currentQuote) {
        alert('Please calculate a quote first');
        return;
    }
    
    const quote = calc.currentQuote;
    const printWindow = window.open('', '_blank');
    
    // Build options text for display
    let optionsText = [];
    if (quote.metallicThread) optionsText.push('Metallic Thread (+25%)');
    if (quote.velcroBacking) optionsText.push('Velcro Backing (+25%)');
    if (quote.extraColors > 0) {
        optionsText.push(`${quote.extraColors} Extra Color${quote.extraColors > 1 ? 's' : ''} (+${quote.extraColors * 10}%)`);
    }
    const optionsDisplay = optionsText.length > 0 ? optionsText.join(', ') : 'Standard embroidery';
    
    // Check if LTM fee applies
    const hasLTMFee = quote.quantity < 200;
    const ltmFeeMessage = hasLTMFee ? `Note: Less Than Minimum fee of $50.00 is included in the per-emblem price` : '';
    
    const printHTML = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Embroidered Emblem Quote - Northwest Custom Apparel</title>
            <style>
                @page { margin: 0.5in; }
                body {
                    font-family: Arial, sans-serif;
                    line-height: 1.4;
                    color: #333;
                    margin: 0;
                    padding: 20px;
                }
                .invoice-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: start;
                    margin-bottom: 30px;
                    padding-bottom: 20px;
                    border-bottom: 2px solid #333;
                }
                .logo-section h1 {
                    margin: 0;
                    font-size: 24px;
                    color: #333;
                }
                .logo-section p {
                    margin: 2px 0;
                    color: #666;
                    font-size: 12px;
                }
                .invoice-meta {
                    text-align: right;
                }
                .invoice-meta h2 {
                    margin: 0 0 10px 0;
                    font-size: 20px;
                    color: #333;
                }
                .invoice-meta p {
                    margin: 2px 0;
                    color: #666;
                    font-size: 12px;
                }
                .section {
                    margin-bottom: 25px;
                }
                .section-title {
                    font-size: 14px;
                    font-weight: bold;
                    color: #333;
                    border-bottom: 1px solid #ddd;
                    padding-bottom: 5px;
                    margin-bottom: 10px;
                }
                .details-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 20px;
                }
                .detail-item {
                    margin-bottom: 8px;
                }
                .detail-label {
                    font-weight: bold;
                    color: #666;
                    font-size: 12px;
                }
                .detail-value {
                    color: #333;
                    font-size: 14px;
                    margin-top: 2px;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 10px;
                }
                th {
                    background: #f5f5f5;
                    padding: 10px;
                    text-align: left;
                    font-size: 12px;
                    font-weight: bold;
                    border: 1px solid #ddd;
                }
                td {
                    padding: 10px;
                    border: 1px solid #ddd;
                    font-size: 12px;
                }
                .text-right {
                    text-align: right;
                }
                .text-center {
                    text-align: center;
                }
                .total-section {
                    margin-top: 20px;
                    padding-top: 15px;
                    border-top: 2px solid #333;
                }
                .total-row {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 5px;
                    font-size: 14px;
                }
                .total-row.grand-total {
                    font-size: 18px;
                    font-weight: bold;
                    color: #333;
                    margin-top: 10px;
                    padding-top: 10px;
                    border-top: 1px solid #ddd;
                }
                .note-box {
                    background: #fff9e6;
                    border: 1px solid #ffcc00;
                    padding: 10px;
                    margin-top: 15px;
                    font-size: 12px;
                    color: #666;
                }
                .footer {
                    margin-top: 40px;
                    padding-top: 20px;
                    border-top: 1px solid #ddd;
                    text-align: center;
                    font-size: 11px;
                    color: #666;
                }
                @media print {
                    body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
                }
            </style>
        </head>
        <body>
            <div class="invoice-header">
                <div class="logo-section">
                    <h1>NORTHWEST CUSTOM APPAREL</h1>
                    <p>Professional Embroidery & Custom Apparel Since 1977</p>
                    <p>2025 Freeman Road East, Milton, WA 98354</p>
                    <p>Phone: 253-922-5793 | Fax: 253-922-5883</p>
                    <p>sales@nwcustomapparel.com</p>
                </div>
                <div class="invoice-meta">
                    <h2>EMBLEM QUOTE</h2>
                    <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
                    <p><strong>Valid For:</strong> 30 Days</p>
                    <p><strong>Contact:</strong> Jim Mickelson</p>
                </div>
            </div>

            <div class="section">
                <div class="section-title">EMBLEM SPECIFICATIONS</div>
                <div class="details-grid">
                    <div>
                        <div class="detail-item">
                            <div class="detail-label">Emblem Size</div>
                            <div class="detail-value">${quote.width}" × ${quote.height}"</div>
                        </div>
                        <div class="detail-item">
                            <div class="detail-label">Quantity</div>
                            <div class="detail-value">${quote.quantity} pieces</div>
                        </div>
                    </div>
                    <div>
                        <div class="detail-item">
                            <div class="detail-label">Options</div>
                            <div class="detail-value">${optionsDisplay}</div>
                        </div>
                        <div class="detail-item">
                            <div class="detail-label">Production Time</div>
                            <div class="detail-value">30-45 days from approval</div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="section">
                <div class="section-title">PRICING BREAKDOWN</div>
                <table>
                    <thead>
                        <tr>
                            <th>Item</th>
                            <th class="text-center">Quantity</th>
                            <th class="text-right">Unit Price</th>
                            <th class="text-right">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>Embroidered Emblem (${quote.width}" × ${quote.height}")</td>
                            <td class="text-center">${quote.quantity}</td>
                            <td class="text-right">$${quote.pricePerPatch.toFixed(2)}</td>
                            <td class="text-right">$${quote.orderSubtotal.toFixed(2)}</td>
                        </tr>
                        ${quote.totalOneTimeFees > 0 ? `
                        <tr>
                            <td>Digitizing & Setup Fee</td>
                            <td class="text-center">1</td>
                            <td class="text-right">$${quote.totalOneTimeFees.toFixed(2)}</td>
                            <td class="text-right">$${quote.totalOneTimeFees.toFixed(2)}</td>
                        </tr>
                        ` : ''}
                    </tbody>
                </table>
            </div>

            <div class="total-section">
                <div class="total-row">
                    <span>Order Subtotal:</span>
                    <span>$${quote.orderSubtotal.toFixed(2)}</span>
                </div>
                ${quote.totalOneTimeFees > 0 ? `
                <div class="total-row">
                    <span>One-Time Fees:</span>
                    <span>$${quote.totalOneTimeFees.toFixed(2)}</span>
                </div>
                ` : ''}
                <div class="total-row grand-total">
                    <span>ESTIMATED TOTAL:</span>
                    <span>$${quote.estimatedTotal.toFixed(2)}</span>
                </div>
            </div>

            ${ltmFeeMessage ? `
            <div class="note-box">
                <strong>Note:</strong> ${ltmFeeMessage}
            </div>
            ` : ''}

            <div class="footer">
                <p><strong>Thank you for choosing Northwest Custom Apparel!</strong></p>
                <p>All emblems are produced by Yung Ming-UMDesign Technology (Vendor #1503)</p>
                <p>This quote is valid for 30 days from the date shown above.</p>
                <p>Prices subject to change after expiration date.</p>
            </div>

            <script>
                window.onload = () => {
                    window.print();
                    setTimeout(() => window.close(), 500);
                };
            <\/script>
        </body>
        </html>
    `;
    
    printWindow.document.write(printHTML);
    printWindow.document.close();
}