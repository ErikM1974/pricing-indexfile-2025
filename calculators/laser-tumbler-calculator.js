/**
 * Laser Tumbler Calculator
 * Handles pricing calculations and quote generation for Polar Camel laser engraved tumblers
 */

// Tumbler color data
const tumblerColors = [
    { name: 'Stainless Steel', model: 'LTM751', hex: '#C0C0C0' },
    { name: 'Black', model: 'LTM752', hex: '#000000' },
    { name: 'Red', model: 'LTM753', hex: '#D32F2F' },
    { name: 'Royal Blue', model: 'LTM754', hex: '#1976D2' },
    { name: 'Pink', model: 'LTM755', hex: '#F06292' },
    { name: 'Teal', model: 'LTM756', hex: '#009688' },
    { name: 'Light Blue', model: 'LTM757', hex: '#90CAF9' },
    { name: 'Light Purple', model: 'LTM758', hex: '#CE93D8' },
    { name: 'Purple', model: 'LTM759', hex: '#7B1FA2' },
    { name: 'Dark Gray', model: 'LTM760', hex: '#616161' },
    { name: 'Navy Blue', model: 'LTM761', hex: '#0D47A1' },
    { name: 'Orange', model: 'LTM762', hex: '#FF9800' },
    { name: 'Maroon', model: 'LTM763', hex: '#880E4F' },
    { name: 'White', model: 'LTM764', hex: '#FFFFFF' },
    { name: 'Green', model: 'LTM765', hex: '#2E7D32' },
    { name: 'Yellow', model: 'LTM766', hex: '#FFEB3B' },
    { name: 'Coral', model: 'LTM767', hex: '#FF7043' },
    { name: 'Olive Green', model: 'LTM768', hex: '#556B2F' }
];

// Pricing tiers
const pricingTiers = {
    '1-23': 16.68,
    '24-119': 16.68,
    '120-239': 16.10,
    '240+': 15.53
};

// Laser Tumbler Calculator Class
class LaserTumblerCalculator {
    constructor() {
        this.currentQuote = null;
        this.setupFee = 75.00;
        this.secondLogoPrice = 3.16;
        
        // Initialize EmailJS
        emailjs.init('4qSbDO-SQs19TbP80');
        
        // Initialize Quote Service
        this.quoteService = new LaserTumblerQuoteService();
        
        this.initializeElements();
        this.bindEvents();
        this.renderColors();
    }

    initializeElements() {
        // Form elements
        this.form = document.getElementById('quoteForm');
        this.customerNameInput = document.getElementById('customerName');
        this.projectNameInput = document.getElementById('projectName');
        this.casesContainer = document.getElementById('casesContainer');
        this.addCaseBtn = document.getElementById('addCaseBtn');
        this.caseCount = document.getElementById('caseCount');
        this.totalQuantityDisplay = document.getElementById('totalQuantity');
        this.secondLogoCheckbox = document.getElementById('secondLogo');
        
        // Track cases
        this.cases = [];
        this.caseIdCounter = 0;
        
        // Quote display elements
        this.quoteDisplay = document.getElementById('quoteDisplay');
        this.displayQuantity = document.getElementById('displayQuantity');
        this.displayUnitPrice = document.getElementById('displayUnitPrice');
        this.displaySubtotal = document.getElementById('displaySubtotal');
        this.displaySecondLogo = document.getElementById('displaySecondLogo');
        this.displayTotal = document.getElementById('displayTotal');
        this.secondLogoRow = document.getElementById('secondLogoRow');
        this.emailQuoteBtn = document.getElementById('emailQuoteBtn');
        
        // Modal elements
        this.modal = document.getElementById('emailModal');
        this.modalClose = document.getElementById('modalClose');
        this.emailForm = document.getElementById('emailForm');
        this.emailCustomerName = document.getElementById('emailCustomerName');
        this.customerEmail = document.getElementById('customerEmail');
        this.customerPhone = document.getElementById('customerPhone');
        this.companyName = document.getElementById('companyName');
        this.emailNotes = document.getElementById('emailNotes');
        this.salesRep = document.getElementById('salesRep');
        this.saveToDatabase = document.getElementById('saveToDatabase');
        this.successMessage = document.getElementById('successMessage');
        this.errorMessage = document.getElementById('errorMessage');
        this.errorText = document.getElementById('errorText');
    }

    bindEvents() {
        // Form submission
        this.form.addEventListener('submit', (e) => this.handleCalculate(e));
        
        // Add case button
        this.addCaseBtn.addEventListener('click', () => this.addCase());
        
        // Email quote button
        this.emailQuoteBtn.addEventListener('click', () => this.openModal());
        
        // Modal events
        this.modalClose.addEventListener('click', () => this.closeModal());
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) this.closeModal();
        });
        this.emailForm.addEventListener('submit', (e) => this.handleEmailSubmit(e));
        
        // Update email form customer name when main form changes
        this.customerNameInput.addEventListener('input', () => {
            this.emailCustomerName.value = this.customerNameInput.value;
        });
    }

    renderColors() {
        const colorGrid = document.getElementById('colorGrid');
        
        tumblerColors.forEach(color => {
            const colorItem = document.createElement('div');
            colorItem.className = 'color-item';
            
            const swatch = document.createElement('div');
            swatch.className = 'color-swatch';
            swatch.style.backgroundColor = color.hex;
            if (color.hex === '#FFFFFF' || color.hex === '#FFEB3B') {
                swatch.style.border = '2px solid #e5e7eb';
            }
            
            const name = document.createElement('div');
            name.className = 'color-name';
            name.textContent = color.name;
            
            const code = document.createElement('div');
            code.className = 'color-code';
            code.textContent = color.model;
            
            colorItem.appendChild(swatch);
            colorItem.appendChild(name);
            colorItem.appendChild(code);
            colorGrid.appendChild(colorItem);
        });
        
        // Add initial case
        this.addCase();
    }
    
    addCase() {
        const caseId = this.caseIdCounter++;
        const caseNumber = this.cases.length + 1;
        
        const caseRow = document.createElement('div');
        caseRow.className = 'case-row';
        caseRow.id = `case-${caseId}`;
        
        caseRow.innerHTML = `
            <div class="case-number">Case ${caseNumber}:</div>
            <div class="color-select-wrapper">
                <div class="selected-color-swatch" id="swatch-${caseId}" style="background: #ccc;"></div>
                <select class="color-select" id="color-${caseId}" required>
                    <option value="">Select a color...</option>
                    ${tumblerColors.map(color => 
                        `<option value="${color.model}" data-hex="${color.hex}">${color.name} (${color.model})</option>`
                    ).join('')}
                </select>
            </div>
            <button type="button" class="case-remove" onclick="window.laserTumblerCalculator.removeCase(${caseId})">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        this.casesContainer.appendChild(caseRow);
        
        // Add color change listener
        const colorSelect = document.getElementById(`color-${caseId}`);
        const colorSwatch = document.getElementById(`swatch-${caseId}`);
        
        colorSelect.addEventListener('change', (e) => {
            const selectedOption = e.target.options[e.target.selectedIndex];
            const hex = selectedOption.dataset.hex;
            if (hex) {
                colorSwatch.style.backgroundColor = hex;
                if (hex === '#FFFFFF' || hex === '#FFEB3B') {
                    colorSwatch.style.border = '2px solid #e5e7eb';
                } else {
                    colorSwatch.style.border = 'none';
                }
            }
            this.updateTotals();
        });
        
        // Track case
        this.cases.push({
            id: caseId,
            colorSelect: colorSelect
        });
        
        this.updateTotals();
        
        // Focus on new color select
        colorSelect.focus();
    }
    
    removeCase(caseId) {
        if (this.cases.length <= 1) {
            alert('You must have at least one case.');
            return;
        }
        
        // Remove from DOM
        const caseRow = document.getElementById(`case-${caseId}`);
        if (caseRow) {
            caseRow.remove();
        }
        
        // Remove from tracking
        this.cases = this.cases.filter(c => c.id !== caseId);
        
        // Renumber remaining cases
        this.renumberCases();
        this.updateTotals();
    }
    
    renumberCases() {
        const caseRows = this.casesContainer.querySelectorAll('.case-row');
        caseRows.forEach((row, index) => {
            const caseNumber = row.querySelector('.case-number');
            if (caseNumber) {
                caseNumber.textContent = `Case ${index + 1}:`;
            }
        });
    }
    
    updateTotals() {
        const caseCount = this.cases.length;
        const totalQuantity = caseCount * 24;
        
        this.caseCount.textContent = caseCount;
        this.totalQuantityDisplay.textContent = totalQuantity;
    }

    getUnitPrice(quantity) {
        if (quantity < 24) return pricingTiers['1-23'];
        if (quantity < 120) return pricingTiers['24-119'];
        if (quantity < 240) return pricingTiers['120-239'];
        return pricingTiers['240+'];
    }

    handleCalculate(e) {
        e.preventDefault();
        
        // Validate colors selected
        const selectedColors = [];
        let hasError = false;
        
        this.cases.forEach((caseData, index) => {
            const colorValue = caseData.colorSelect.value;
            if (!colorValue) {
                alert(`Please select a color for Case ${index + 1}`);
                hasError = true;
                return;
            }
            
            const selectedOption = caseData.colorSelect.options[caseData.colorSelect.selectedIndex];
            const colorInfo = tumblerColors.find(c => c.model === colorValue);
            
            selectedColors.push({
                model: colorValue,
                name: colorInfo.name,
                hex: colorInfo.hex,
                quantity: 24
            });
        });
        
        if (hasError) return;
        
        // Get total quantity
        const quantity = this.cases.length * 24;
        
        // Calculate pricing
        const unitPrice = this.getUnitPrice(quantity);
        const subtotal = unitPrice * quantity;
        const secondLogoTotal = this.secondLogoCheckbox.checked ? (this.secondLogoPrice * quantity) : 0;
        const total = subtotal + this.setupFee + secondLogoTotal;
        
        // Store quote data
        this.currentQuote = {
            customerName: this.customerNameInput.value,
            projectName: this.projectNameInput.value,
            quantity: quantity,
            caseCount: this.cases.length,
            colors: selectedColors,
            unitPrice: unitPrice,
            subtotal: subtotal,
            setupFee: this.setupFee,
            hasSecondLogo: this.secondLogoCheckbox.checked,
            secondLogoTotal: secondLogoTotal,
            total: total
        };
        
        // Display quote
        this.displayQuote();
    }

    displayQuote() {
        if (!this.currentQuote) return;
        
        const quote = this.currentQuote;
        
        // Update display values
        this.displayQuantity.textContent = `${quote.quantity} tumblers (${quote.caseCount} ${quote.caseCount === 1 ? 'case' : 'cases'})`;
        this.displayUnitPrice.textContent = `$${quote.unitPrice.toFixed(2)}`;
        this.displaySubtotal.textContent = `$${quote.subtotal.toFixed(2)}`;
        this.displayTotal.textContent = `$${quote.total.toFixed(2)}`;
        
        // Display color breakdown
        const colorBreakdown = document.getElementById('colorBreakdown');
        let colorHtml = '<div style="font-size: 0.875rem; color: var(--text-secondary); margin-bottom: 0.5rem;">Color Breakdown:</div>';
        quote.colors.forEach(color => {
            colorHtml += `
                <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem;">
                    <div style="width: 20px; height: 20px; border-radius: 50%; background: ${color.hex}; box-shadow: 0 2px 4px rgba(0,0,0,0.2); ${color.hex === '#FFFFFF' || color.hex === '#FFEB3B' ? 'border: 1px solid #e5e7eb;' : ''}"></div>
                    <span style="font-size: 0.875rem;">${color.name} (${color.model}) - ${color.quantity} units</span>
                </div>
            `;
        });
        colorBreakdown.innerHTML = colorHtml;
        
        // Handle second logo display
        if (quote.hasSecondLogo) {
            this.secondLogoRow.classList.remove('hidden');
            this.displaySecondLogo.textContent = `$${quote.secondLogoTotal.toFixed(2)}`;
        } else {
            this.secondLogoRow.classList.add('hidden');
        }
        
        // Show quote display
        this.quoteDisplay.classList.remove('hidden');
        
        // Scroll to quote
        this.quoteDisplay.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    openModal() {
        if (!this.currentQuote) return;
        
        // Pre-fill customer name
        this.emailCustomerName.value = this.customerNameInput.value;
        
        // Reset messages
        this.successMessage.classList.add('hidden');
        this.errorMessage.classList.add('hidden');
        
        // Show modal
        this.modal.classList.add('active');
        
        // Focus on appropriate field
        if (this.emailCustomerName.value) {
            this.customerEmail.focus();
        } else {
            this.emailCustomerName.focus();
        }
    }

    closeModal() {
        this.modal.classList.remove('active');
    }

    async handleEmailSubmit(e) {
        e.preventDefault();
        
        if (!this.currentQuote) return;
        
        // Show loading state
        const submitBtn = this.emailForm.querySelector('button[type="submit"]');
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
                'erik@nwcustomapparel.com': 'Erik',
                'nika@nwcustomapparel.com': 'Nika',
                'taylar@nwcustomapparel.com': 'Taylar',
                'adriyella@nwcustomapparel.com': 'Adriyella',
                'ruth@nwcustomapparel.com': 'Ruth Nhong',
                'bradley@nwcustomapparel.com': 'Bradley',
                'jim@nwcustomapparel.com': 'Jim',
                'art@nwcustomapparel.com': 'Steve',
                'sales@nwcustomapparel.com': 'Northwest Custom Apparel Sales Team'
            };
            
            const quote = this.currentQuote;
            
            // Build color breakdown for email
            let colorBreakdownText = quote.colors.map(color => 
                `${color.name} (${color.model}) - ${color.quantity} units`
            ).join(', ');
            
            // Prepare email data
            const emailData = {
                to_email: this.customerEmail.value,
                reply_to: selectedRep,
                from_name: 'Northwest Custom Apparel',
                customer_name: this.emailCustomerName.value,
                project_name: quote.projectName || 'Polar Camel Tumbler Quote',
                quote_id: `LT${new Date().toISOString().slice(2,10).replace(/-/g,'')}-${Math.floor(Math.random() * 100)}`,
                quote_date: new Date().toLocaleDateString(),
                quote_type: 'Laser Tumbler',  // REQUIRED - was missing!
                service_type: 'Polar Camel 16 oz. Pint - Laser Engraved',
                quantity: quote.quantity.toString(),
                locations: `1-Sided Laser Engraving | Colors: ${colorBreakdownText}`,
                price_per_piece: `$${quote.unitPrice.toFixed(2)}`,
                subtotal: `$${quote.subtotal.toFixed(2)}`,
                special_note: quote.hasSecondLogo ? 
                    `Includes second logo (+$${quote.secondLogoTotal.toFixed(2)}) and one-time setup fee ($${quote.setupFee.toFixed(2)})` :
                    `Includes one-time setup fee ($${quote.setupFee.toFixed(2)})`,
                grand_total: `$${quote.total.toFixed(2)}`,
                notes: this.emailNotes.value || 'No special notes for this order',
                quote_summary: `${quote.quantity} Polar Camel tumblers with laser engraving`,
                sales_rep_name: salesRepNames[selectedRep],
                sales_rep_email: selectedRep,
                sales_rep_phone: '253-922-5793',
                company_year: '1977'
            };
            
            // Save to database if checkbox is checked
            let quoteId = emailData.quote_id;
            if (this.saveToDatabase.checked) {
                try {
                    const dbData = {
                        customerName: this.emailCustomerName.value,
                        customerEmail: this.customerEmail.value,
                        customerPhone: this.customerPhone.value || '',
                        companyName: this.companyName.value || '',
                        projectName: quote.projectName || 'Polar Camel Tumbler Quote',
                        quantity: quote.quantity,
                        unitPrice: quote.unitPrice,
                        subtotal: quote.subtotal,
                        setupFee: quote.setupFee,
                        hasSecondLogo: quote.hasSecondLogo,
                        secondLogoTotal: quote.secondLogoTotal || 0,
                        total: quote.total,
                        salesRepName: salesRepNames[selectedRep],
                        salesRepEmail: selectedRep,
                        notes: this.emailNotes.value || '',
                        colors: quote.colors // Pass color data
                    };
                    
                    const saveResult = await this.quoteService.saveQuote(dbData);
                    if (saveResult.success) {
                        quoteId = saveResult.quoteID;
                        emailData.quote_id = quoteId; // Update email with DB quote ID
                        console.log('Quote saved to database:', quoteId);
                    } else {
                        console.error('Failed to save to database:', saveResult.error);
                    }
                } catch (dbError) {
                    console.error('Database save error:', dbError);
                    // Continue with email even if DB save fails
                }
            }
            
            // Send email
            await emailjs.send(
                'service_1c4k67j',
                'template_6bie1il',
                emailData
            );
            
            // Show success with quote ID
            this.successMessage.classList.remove('hidden');
            this.errorMessage.classList.add('hidden');
            
            // Display quote ID
            const quoteIdDisplay = document.getElementById('quoteIdDisplay');
            if (quoteIdDisplay) {
                quoteIdDisplay.textContent = `Quote ID: ${quoteId}`;
            }
            
            // Reset form after delay
            setTimeout(() => {
                this.closeModal();
                this.emailForm.reset();
                this.saveToDatabase.checked = true; // Reset to checked
            }, 3000); // Increased to 3 seconds to give more time to see quote ID
            
        } catch (error) {
            console.error('Error sending quote:', error);
            this.errorText.textContent = error.message || 'Failed to send quote. Please try again.';
            this.errorMessage.classList.remove('hidden');
            this.successMessage.classList.add('hidden');
        } finally {
            // Restore button
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    }
}

// Print Quote function - clean invoice style
function printQuote() {
    const calc = window.laserTumblerCalculator;
    if (!calc?.currentQuote) {
        alert('Please calculate a quote first');
        return;
    }
    
    const quote = calc.currentQuote;
    const printWindow = window.open('', '_blank');
    
    const printHTML = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Quote - Northwest Custom Apparel</title>
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
                .invoice-info {
                    text-align: right;
                }
                .invoice-info h2 {
                    margin: 0 0 10px 0;
                    font-size: 28px;
                    color: #333;
                }
                .invoice-info p {
                    margin: 2px 0;
                    font-size: 14px;
                }
                .bill-to {
                    margin: 20px 0;
                    padding: 15px;
                    background: #f5f5f5;
                    border-left: 4px solid #4cb354;
                }
                .bill-to h3 {
                    margin: 0 0 10px 0;
                    font-size: 14px;
                    text-transform: uppercase;
                    color: #666;
                }
                .bill-to p {
                    margin: 3px 0;
                    font-size: 14px;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin: 20px 0;
                }
                th {
                    background: #f5f5f5;
                    padding: 10px;
                    text-align: left;
                    font-size: 12px;
                    text-transform: uppercase;
                    color: #666;
                    border-bottom: 2px solid #ddd;
                }
                td {
                    padding: 12px 10px;
                    border-bottom: 1px solid #eee;
                    font-size: 14px;
                }
                .text-right { text-align: right; }
                .total-section {
                    margin-top: 20px;
                }
                .total-row {
                    display: flex;
                    justify-content: space-between;
                    padding: 8px 0;
                    font-size: 14px;
                }
                .total-row.subtotal {
                    border-top: 1px solid #ddd;
                    padding-top: 15px;
                }
                .total-row.grand-total {
                    border-top: 2px solid #333;
                    padding-top: 10px;
                    font-size: 18px;
                    font-weight: bold;
                    color: #333;
                }
                .color-breakdown {
                    margin: 15px 0;
                    padding: 10px;
                    background: #f9f9f9;
                }
                .color-item {
                    margin: 5px 0;
                    font-size: 13px;
                }
                .terms {
                    margin-top: 40px;
                    padding-top: 20px;
                    border-top: 1px solid #ddd;
                    font-size: 11px;
                    color: #666;
                }
                .footer {
                    margin-top: 30px;
                    text-align: center;
                    font-size: 12px;
                    color: #888;
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
                    <p>2025 Freeman Road East, Milton, WA 98354</p>
                    <p>Phone: 253-922-5793 | Fax: 253-922-5735</p>
                    <p>sales@nwcustomapparel.com</p>
                </div>
                <div class="invoice-info">
                    <h2>QUOTE</h2>
                    <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
                    <p><strong>Valid For:</strong> 30 Days</p>
                </div>
            </div>

            <div class="bill-to">
                <h3>Quote For</h3>
                <p><strong>${quote.customerName || 'Customer'}</strong></p>
                ${quote.projectName ? `<p>Project: ${quote.projectName}</p>` : ''}
            </div>

            <table>
                <thead>
                    <tr>
                        <th>Item Description</th>
                        <th class="text-right">Quantity</th>
                        <th class="text-right">Unit Price</th>
                        <th class="text-right">Total</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>
                            <strong>Polar Camel 16 oz. Pint</strong><br>
                            <span style="font-size: 12px; color: #666;">Laser Engraved - Premium Stainless Steel Tumbler</span>
                        </td>
                        <td class="text-right">${quote.quantity}</td>
                        <td class="text-right">$${quote.unitPrice.toFixed(2)}</td>
                        <td class="text-right">$${quote.subtotal.toFixed(2)}</td>
                    </tr>
                    <tr>
                        <td>
                            <strong>One-Time Setup Fee</strong><br>
                            <span style="font-size: 12px; color: #666;">Includes professional mockup for approval</span>
                        </td>
                        <td class="text-right">1</td>
                        <td class="text-right">$${quote.setupFee.toFixed(2)}</td>
                        <td class="text-right">$${quote.setupFee.toFixed(2)}</td>
                    </tr>
                    ${quote.hasSecondLogo ? `
                    <tr>
                        <td>
                            <strong>Second Logo Engraving</strong><br>
                            <span style="font-size: 12px; color: #666;">Additional engraving location</span>
                        </td>
                        <td class="text-right">${quote.quantity}</td>
                        <td class="text-right">$3.16</td>
                        <td class="text-right">$${quote.secondLogoTotal.toFixed(2)}</td>
                    </tr>
                    ` : ''}
                </tbody>
            </table>

            <div class="color-breakdown">
                <strong>Color Selection (${quote.caseCount} ${quote.caseCount === 1 ? 'case' : 'cases'}):</strong>
                ${quote.colors.map(color => 
                    `<div class="color-item">• ${color.name} (${color.model}) - ${color.quantity} units</div>`
                ).join('')}
            </div>

            <div class="total-section">
                <div class="total-row subtotal">
                    <span>Subtotal:</span>
                    <span>$${quote.subtotal.toFixed(2)}</span>
                </div>
                <div class="total-row">
                    <span>Setup Fee:</span>
                    <span>$${quote.setupFee.toFixed(2)}</span>
                </div>
                ${quote.hasSecondLogo ? `
                <div class="total-row">
                    <span>Second Logo:</span>
                    <span>$${quote.secondLogoTotal.toFixed(2)}</span>
                </div>
                ` : ''}
                <div class="total-row grand-total">
                    <span>TOTAL:</span>
                    <span>$${quote.total.toFixed(2)}</span>
                </div>
            </div>

            <div class="terms">
                <p><strong>Terms & Conditions:</strong></p>
                <p>• This quote is valid for 30 days from the date issued.</p>
                <p>• 50% deposit required to begin production.</p>
                <p>• Production time is typically 10-14 business days after artwork approval.</p>
                <p>• Prices subject to change without notice after expiration date.</p>
                <p>• Minimum order quantity: 24 tumblers (1 case)</p>
            </div>

            <div class="footer">
                <p>Thank you for choosing Northwest Custom Apparel!</p>
                <p>Family Owned & Operated Since 1977</p>
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

// Make printQuote available globally
window.printQuote = printQuote;

// Print Promotional Flyer function - Full-color 8.5x11 marketing flyer
function printFlyer() {
    const calc = window.laserTumblerCalculator;
    if (!calc?.currentQuote) {
        alert('Please calculate a quote first');
        return;
    }
    
    const quote = calc.currentQuote;
    const printWindow = window.open('', '_blank');
    
    // Generate color swatches HTML
    const colorSwatchesHTML = tumblerColors.map(color => `
        <div style="text-align: center; margin: 5px;">
            <div style="width: 30px; height: 30px; background: ${color.hex}; border: 2px solid #e5e7eb; border-radius: 50%; margin: 0 auto 2px;"></div>
            <div style="font-size: 7pt; line-height: 1;">${color.name}</div>
        </div>
    `).join('');
    
    const flyerHTML = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Polar Camel Tumblers - Northwest Custom Apparel</title>
            <style>
                @page { 
                    size: letter;
                    margin: 0;
                }
                * {
                    print-color-adjust: exact;
                    -webkit-print-color-adjust: exact;
                }
                body {
                    font-family: 'Segoe UI', Arial, sans-serif;
                    margin: 0;
                    padding: 0;
                    background: white;
                    color: #1f2937;
                }
                
                /* Header Section */
                .header {
                    background: linear-gradient(135deg, #4cb354 0%, #5bc85f 100%);
                    color: white;
                    padding: 30px;
                    text-align: center;
                    position: relative;
                    overflow: hidden;
                }
                .header::before {
                    content: '';
                    position: absolute;
                    top: -50%;
                    right: -50%;
                    width: 200%;
                    height: 200%;
                    background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%);
                    animation: none;
                }
                .header h1 {
                    font-size: 32pt;
                    margin: 0 0 10px 0;
                    font-weight: 800;
                    text-shadow: 2px 2px 4px rgba(0,0,0,0.2);
                }
                .header p {
                    font-size: 14pt;
                    margin: 0;
                    opacity: 0.95;
                }
                
                /* Content Layout */
                .content {
                    padding: 20px 30px;
                }
                
                .two-column {
                    display: flex;
                    gap: 30px;
                    margin: 20px 0;
                }
                
                .column {
                    flex: 1;
                }
                
                /* Product Showcase */
                .product-showcase {
                    text-align: center;
                    padding: 20px;
                    background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
                    border-radius: 12px;
                    border: 2px solid #4cb354;
                }
                
                .product-image {
                    width: 250px;
                    height: auto;
                    border-radius: 8px;
                    box-shadow: 0 8px 16px rgba(0,0,0,0.15);
                    margin-bottom: 15px;
                }
                
                /* Features */
                .features {
                    display: flex;
                    gap: 15px;
                    margin: 20px 0;
                }
                
                .feature-box {
                    flex: 1;
                    background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
                    border: 2px solid #4cb354;
                    border-radius: 8px;
                    padding: 15px;
                    text-align: center;
                }
                
                .feature-icon {
                    font-size: 24pt;
                    margin-bottom: 5px;
                }
                
                .feature-text {
                    font-weight: 600;
                    font-size: 11pt;
                    color: #1f2937;
                }
                
                /* Pricing Table */
                .pricing-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin: 20px 0;
                    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                    border-radius: 8px;
                    overflow: hidden;
                }
                
                .pricing-table th {
                    background: linear-gradient(135deg, #4cb354 0%, #5bc85f 100%);
                    color: white;
                    padding: 12px;
                    font-size: 11pt;
                    font-weight: 600;
                }
                
                .pricing-table td {
                    padding: 10px 12px;
                    border-bottom: 1px solid #e5e7eb;
                    font-size: 10pt;
                    background: white;
                }
                
                .pricing-table tr.highlight {
                    background: linear-gradient(90deg, rgba(76,179,84,0.1) 0%, rgba(76,179,84,0.05) 100%);
                }
                
                .price-big {
                    font-size: 16pt;
                    font-weight: 700;
                    color: #4cb354;
                }
                
                /* Quote Box */
                .quote-box {
                    background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
                    border: 2px solid #f59e0b;
                    border-radius: 12px;
                    padding: 20px;
                    margin: 20px 0;
                }
                
                .quote-box h3 {
                    color: #92400e;
                    margin: 0 0 10px 0;
                    font-size: 14pt;
                }
                
                .quote-detail {
                    display: flex;
                    justify-content: space-between;
                    padding: 5px 0;
                    font-size: 11pt;
                }
                
                .quote-total {
                    border-top: 2px solid #f59e0b;
                    padding-top: 10px;
                    margin-top: 10px;
                    font-size: 16pt;
                    font-weight: 700;
                    color: #92400e;
                }
                
                /* Specifications */
                .specs-grid {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 15px;
                    margin: 20px 0;
                }
                
                .spec-card {
                    background: #f5f7fa;
                    border-radius: 8px;
                    padding: 12px;
                    border: 1px solid #e5e7eb;
                }
                
                .spec-card h4 {
                    color: #4cb354;
                    margin: 0 0 8px 0;
                    font-size: 10pt;
                    font-weight: 600;
                }
                
                .spec-card ul {
                    margin: 0;
                    padding-left: 15px;
                    font-size: 8pt;
                    color: #6b7280;
                }
                
                /* Color Grid */
                .colors-section {
                    margin: 20px 0;
                    padding: 15px;
                    background: #fafafa;
                    border-radius: 8px;
                }
                
                .colors-section h3 {
                    color: #4cb354;
                    margin: 0 0 10px 0;
                    font-size: 12pt;
                }
                
                .color-grid {
                    display: grid;
                    grid-template-columns: repeat(9, 1fr);
                    gap: 5px;
                }
                
                /* CTA Section */
                .cta {
                    background: linear-gradient(135deg, #4cb354 0%, #5bc85f 100%);
                    color: white;
                    padding: 25px;
                    border-radius: 12px;
                    text-align: center;
                    margin: 20px 0;
                    box-shadow: 0 8px 16px rgba(76,179,84,0.3);
                }
                
                .cta h2 {
                    margin: 0 0 10px 0;
                    font-size: 18pt;
                }
                
                .cta p {
                    margin: 5px 0;
                    font-size: 12pt;
                }
                
                .phone-big {
                    font-size: 20pt;
                    font-weight: 700;
                    margin: 10px 0;
                }
                
                /* Footer */
                .footer {
                    background: #f5f7fa;
                    padding: 15px;
                    text-align: center;
                    border-top: 2px solid #4cb354;
                    margin-top: 30px;
                }
                
                .footer p {
                    margin: 3px 0;
                    font-size: 9pt;
                    color: #6b7280;
                }
                
                .badge {
                    display: inline-block;
                    background: #4cb354;
                    color: white;
                    padding: 2px 8px;
                    border-radius: 4px;
                    font-size: 8pt;
                    font-weight: 600;
                    margin: 0 5px;
                }
            </style>
        </head>
        <body>
            <!-- Header -->
            <div class="header">
                <h1>LASER ENGRAVED POLAR CAMEL TUMBLERS</h1>
                <p>Premium Quality • Custom Designs • Fast Turnaround</p>
            </div>
            
            <!-- Main Content -->
            <div class="content">
                <!-- Product and Features Row -->
                <div class="two-column">
                    <div class="column">
                        <div class="product-showcase">
                            <img src="https://cdn.caspio.com/A0E15000/Safety%20Stripes/Tumbler%20from%20JDS%20Mountain%20Top%20Propane.JPG?ver=1" 
                                 class="product-image" alt="Polar Camel Tumbler">
                            <h2 style="color: #4cb354; margin: 10px 0;">Polar Camel 16 oz. Pint</h2>
                            <p style="font-size: 10pt; color: #6b7280;">Premium Stainless Steel • Double-Wall Vacuum Insulated</p>
                        </div>
                    </div>
                    
                    <div class="column">
                        <h2 style="color: #1f2937; margin-top: 0;">Why Choose Polar Camel?</h2>
                        
                        <div class="features">
                            <div class="feature-box">
                                <div class="feature-icon">🔥</div>
                                <div class="feature-text">Keeps Hot<br>8+ Hours</div>
                            </div>
                            <div class="feature-box">
                                <div class="feature-icon">❄️</div>
                                <div class="feature-text">Keeps Cold<br>24+ Hours</div>
                            </div>
                        </div>
                        
                        <!-- Pricing Table -->
                        <table class="pricing-table">
                            <thead>
                                <tr>
                                    <th>Quantity</th>
                                    <th style="text-align: right;">Price per Unit</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td><strong>24 Tumblers</strong> (1 Case)</td>
                                    <td style="text-align: right;"><span class="price-big">$16.68</span></td>
                                </tr>
                                <tr class="highlight">
                                    <td><strong>120 Tumblers</strong> (5 Cases)</td>
                                    <td style="text-align: right;"><span class="price-big">$16.10</span></td>
                                </tr>
                                <tr>
                                    <td><strong>240 Tumblers</strong> (10 Cases)</td>
                                    <td style="text-align: right;"><span class="price-big">$15.53</span></td>
                                </tr>
                            </tbody>
                        </table>
                        
                        <p style="background: #d1fae5; padding: 10px; border-radius: 6px; font-size: 10pt; color: #065f46; margin-top: 10px;">
                            ✨ <strong>All prices include 1-Sided Laser Engraving (approx. 2.5" x 3")</strong>
                        </p>
                    </div>
                </div>
                
                <!-- Your Custom Quote -->
                <div class="quote-box">
                    <h3>Your Custom Quote</h3>
                    <div class="quote-detail">
                        <span>Customer: ${quote.customerName || 'Valued Customer'}</span>
                        <span>Date: ${new Date().toLocaleDateString()}</span>
                    </div>
                    ${quote.projectName ? `<div class="quote-detail"><span>Project: ${quote.projectName}</span></div>` : ''}
                    <div class="quote-detail">
                        <span>Quantity: ${quote.quantity} tumblers (${quote.caseCount} ${quote.caseCount === 1 ? 'case' : 'cases'})</span>
                        <span>$${quote.unitPrice.toFixed(2)}/unit</span>
                    </div>
                    <div class="quote-detail">
                        <span>Colors: ${quote.colors.map(c => c.name).join(', ')}</span>
                    </div>
                    <div class="quote-detail">
                        <span>Subtotal:</span>
                        <span>$${quote.subtotal.toFixed(2)}</span>
                    </div>
                    <div class="quote-detail">
                        <span>One-Time Setup Fee:</span>
                        <span>$${quote.setupFee.toFixed(2)}</span>
                    </div>
                    ${quote.hasSecondLogo ? `
                    <div class="quote-detail">
                        <span>Second Logo Engraving:</span>
                        <span>$${quote.secondLogoTotal.toFixed(2)}</span>
                    </div>
                    ` : ''}
                    <div class="quote-detail quote-total">
                        <span>TOTAL:</span>
                        <span>$${quote.total.toFixed(2)}</span>
                    </div>
                </div>
                
                <!-- Specifications -->
                <div class="specs-grid">
                    <div class="spec-card">
                        <h4>Product Specs</h4>
                        <ul>
                            <li>Capacity: 16 oz.</li>
                            <li>18/8 stainless steel</li>
                            <li>Double-wall vacuum</li>
                            <li>Clear slider lid included</li>
                            <li>Gift box included</li>
                        </ul>
                    </div>
                    <div class="spec-card">
                        <h4>Dimensions</h4>
                        <ul>
                            <li>Size: 3 3/8" x 6"</li>
                            <li>Base: 2 5/8" diameter</li>
                            <li>Circumference: 10.25"</li>
                            <li>Engraving: 2.5" x 3"</li>
                        </ul>
                    </div>
                    <div class="spec-card">
                        <h4>Care & Info</h4>
                        <ul>
                            <li>Hand wash only</li>
                            <li>Not dishwasher safe</li>
                            <li>BPA-free lid</li>
                            <li>Indoor/outdoor use</li>
                        </ul>
                    </div>
                </div>
                
                <!-- Colors -->
                <div class="colors-section">
                    <h3>Available Colors (18 Options)</h3>
                    <div class="color-grid">
                        ${colorSwatchesHTML}
                    </div>
                </div>
                
                <!-- Call to Action -->
                <div class="cta">
                    <h2>Ready to Order Your Custom Tumblers?</h2>
                    <p>Contact our sales team today for a personalized quote!</p>
                    <div class="phone-big">📞 253-922-5793</div>
                    <p>✉️ sales@nwcustomapparel.com</p>
                    <p>🌐 www.nwcustomapparel.com</p>
                </div>
            </div>
            
            <!-- Footer -->
            <div class="footer">
                <p><strong>NORTHWEST CUSTOM APPAREL</strong></p>
                <p>2025 Freeman Road East, Milton, WA 98354</p>
                <p>
                    <span class="badge">Family Owned Since 1977</span>
                    <span class="badge">Fast Turnaround</span>
                    <span class="badge">No Hidden Fees</span>
                </p>
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
    
    printWindow.document.write(flyerHTML);
    printWindow.document.close();
}

// Make printFlyer available globally
window.printFlyer = printFlyer;