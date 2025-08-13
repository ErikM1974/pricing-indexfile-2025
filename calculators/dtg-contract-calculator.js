/**
 * DTG Contract Calculator
 * Handles pricing calculations and quote generation for DTG contract pricing
 */

class DTGContractCalculator {
    constructor() {
        this.initializeEmailJS();
        this.initializeElements();
        this.bindEvents();
        this.currentCalculation = null;
        this.quoteService = new DTGQuoteService();
    }

    initializeEmailJS() {
        emailjs.init('4qSbDO-SQs19TbP80');
    }

    initializeElements() {
        this.elements = {
            // Inputs
            quantity: document.getElementById('quantity'),
            tierBar: document.getElementById('tierBar'),
            locationCheckboxes: document.querySelectorAll('.location-checkbox[data-location]'),
            locationCards: document.querySelectorAll('.location-card[data-location]'),
            isHeavyweight: document.getElementById('isHeavyweight'),
            
            // Results
            resultsContent: document.getElementById('resultsContent'),
            tierBadge: document.getElementById('tierBadge'),
            
            // Email Modal
            emailModal: document.getElementById('emailModal'),
            emailForm: document.getElementById('emailForm'),
            customerName: document.getElementById('customerName'),
            customerEmail: document.getElementById('customerEmail'),
            companyName: document.getElementById('companyName'),
            phoneNumber: document.getElementById('phoneNumber'),
            projectName: document.getElementById('projectName'),
            salesRep: document.getElementById('salesRep'),
            customerNotes: document.getElementById('customerNotes'),
            emailQuotePreview: document.getElementById('emailQuotePreview'),
            
            // User Welcome
            userWelcome: document.getElementById('userWelcome')
        };
    }

    bindEvents() {
        // Quantity input
        this.elements.quantity.addEventListener('input', () => this.calculate());
        
        // Location checkboxes
        this.elements.locationCheckboxes.forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                this.updateLocationCard(e.target);
                this.calculate();
            });
        });

        // Heavyweight option
        this.elements.isHeavyweight.addEventListener('change', () => this.calculate());

        // Email form
        this.elements.emailForm.addEventListener('submit', (e) => this.handleEmailSubmit(e));
    }

    updateLocationCard(checkbox) {
        const card = checkbox.closest('.location-card');
        if (checkbox.checked) {
            card.classList.add('selected');
        } else {
            card.classList.remove('selected');
        }
    }

    calculate() {
        const quantity = parseInt(this.elements.quantity.value) || 0;
        
        if (quantity < 1) {
            this.showPlaceholder();
            return;
        }

        // Update tier progress bar
        this.updateTierProgress(quantity);

        // Get selected locations
        const selectedLocations = Array.from(this.elements.locationCheckboxes)
            .filter(cb => cb.checked)
            .map(cb => ({
                code: cb.dataset.location,
                name: cb.dataset.name
            }));

        if (selectedLocations.length === 0) {
            this.showPlaceholder();
            return;
        }

        // Calculate pricing
        const calculation = this.calculatePricing(quantity, selectedLocations);
        this.currentCalculation = calculation;
        this.displayResults(calculation);
    }

    updateTierProgress(quantity) {
        let progress = 0;
        if (quantity >= 72) progress = 100;
        else if (quantity >= 48) progress = 75;
        else if (quantity >= 24) progress = 50;
        else progress = (quantity / 24) * 50;
        
        this.elements.tierBar.style.width = `${progress}%`;
    }

    calculatePricing(quantity, locations) {
        // Pricing tiers
        const tiers = {
            '1-23': { price: 7.50, name: 'Small Order' },
            '24-47': { price: 6.75, name: 'Standard', popular: true },
            '48-71': { price: 6.00, name: 'Volume' },
            '72+': { price: 5.25, name: 'Best Value', best: true }
        };

        // Determine tier
        let tier;
        if (quantity < 24) tier = tiers['1-23'];
        else if (quantity < 48) tier = tiers['24-47'];
        else if (quantity < 72) tier = tiers['48-71'];
        else tier = tiers['72+'];

        // Calculate costs
        const basePrice = tier.price * locations.length;
        const heavyweightCharge = this.elements.isHeavyweight.checked ? 1.00 : 0;
        const unitPrice = basePrice + heavyweightCharge;
        
        // Less than minimum fee
        let ltmFee = 0;
        let ltmPerUnit = 0;
        if (quantity < 24) {
            ltmFee = 50;
            ltmPerUnit = ltmFee / quantity;
        }

        const finalUnitPrice = unitPrice + ltmPerUnit;
        const subtotal = unitPrice * quantity;
        const total = subtotal + ltmFee;

        return {
            quantity,
            locations,
            tier,
            basePrice,
            heavyweightCharge,
            unitPrice,
            ltmFee,
            ltmPerUnit,
            finalUnitPrice,
            subtotal,
            total
        };
    }

    displayResults(calc) {
        // Update tier badge
        if (calc.tier.popular) {
            this.elements.tierBadge.innerHTML = '<span class="tier-indicator tier-popular">POPULAR TIER</span>';
        } else if (calc.tier.best) {
            this.elements.tierBadge.innerHTML = '<span class="tier-indicator tier-best">BEST VALUE</span>';
        } else {
            this.elements.tierBadge.innerHTML = '';
        }

        // Build results HTML
        let html = `
            <div class="price-breakdown">
                <div class="price-line">
                    <span>Quantity:</span>
                    <strong>${calc.quantity} pieces</strong>
                </div>
                <div class="price-line">
                    <span>Print Locations:</span>
                    <strong>${calc.locations.length} location${calc.locations.length > 1 ? 's' : ''}</strong>
                </div>
                <div class="price-line">
                    <span>Price Tier:</span>
                    <strong>${calc.tier.name}</strong>
                </div>
                <div class="price-line">
                    <span>Base Price per Item:</span>
                    <span>$${calc.basePrice.toFixed(2)}</span>
                </div>`;

        if (calc.heavyweightCharge > 0) {
            html += `
                <div class="price-line">
                    <span>Heavyweight Charge:</span>
                    <span>+$${calc.heavyweightCharge.toFixed(2)}</span>
                </div>`;
        }

        if (calc.ltmFee > 0) {
            html += `
                <div class="price-line">
                    <span>Less Than Minimum Fee:</span>
                    <span>$${calc.ltmFee.toFixed(2)}</span>
                </div>
                <div class="price-line">
                    <span>LTM Impact per Item:</span>
                    <span>+$${calc.ltmPerUnit.toFixed(2)}</span>
                </div>`;
        }

        html += `
                <div class="price-line total">
                    <span>Total Cost:</span>
                    <strong>$${calc.total.toFixed(2)}</strong>
                </div>
            </div>

            <div class="order-summary">
                <div class="order-total-label">YOUR PRICE PER ITEM</div>
                <div class="order-total-amount">$${calc.finalUnitPrice.toFixed(2)}</div>
            </div>

            <div class="action-buttons">
                <button class="btn btn-primary" onclick="dtgCalculator.openEmailModal()">
                    <i class="fas fa-envelope"></i>
                    Email This Quote
                </button>
                <button class="btn btn-secondary" onclick="window.print()">
                    <i class="fas fa-print"></i>
                    Print
                </button>
            </div>`;

        this.elements.resultsContent.innerHTML = html;
    }

    showPlaceholder() {
        this.elements.tierBadge.innerHTML = '';
        this.elements.resultsContent.innerHTML = `
            <div style="text-align: center; padding: 3rem 1rem; color: var(--text-secondary);">
                <i class="fas fa-calculator" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.3;"></i>
                <p>Enter quantity and select locations to see pricing</p>
            </div>`;
    }

    openEmailModal() {
        if (!this.currentCalculation) return;
        
        // Update preview
        this.updateEmailPreview();
        
        // Show modal
        this.elements.emailModal.classList.add('active');
        this.elements.customerName.focus();
    }

    closeEmailModal() {
        this.elements.emailModal.classList.remove('active');
        this.elements.emailForm.reset();
    }

    updateEmailPreview() {
        const calc = this.currentCalculation;
        const locations = calc.locations.map(l => l.name).join(', ');
        
        this.elements.emailQuotePreview.innerHTML = `
            <div class="preview-line">
                <span>Quantity:</span>
                <span>${calc.quantity} pieces</span>
            </div>
            <div class="preview-line">
                <span>Locations:</span>
                <span>${locations}</span>
            </div>
            <div class="preview-line strong">
                <span>Total:</span>
                <span>$${calc.total.toFixed(2)}</span>
            </div>`;
    }

    async handleEmailSubmit(e) {
        e.preventDefault();
        
        if (!this.validateEmailForm()) return;

        const submitBtn = e.target.querySelector('button[type="submit"]');
        submitBtn.classList.add('loading');
        submitBtn.disabled = true;

        try {
            // Prepare quote data
            const quoteData = this.prepareQuoteData();
            
            // Save to database
            const saveResult = await this.quoteService.saveQuote(quoteData);
            const quoteId = saveResult.quoteID || this.quoteService.generateQuoteID();
            
            // Send email
            await this.sendEmail(quoteData, quoteId);
            
            // Show success message
            this.showSuccess(`Quote sent successfully! Quote ID: ${quoteId}`);
            this.closeEmailModal();
            
        } catch (error) {
            console.error('Error sending quote:', error);
            this.showError('Failed to send quote. Please try again.');
        } finally {
            submitBtn.classList.remove('loading');
            submitBtn.disabled = false;
        }
    }

    validateEmailForm() {
        let isValid = true;
        
        // Check name
        if (!this.elements.customerName.value.trim()) {
            this.showFieldError(this.elements.customerName);
            isValid = false;
        } else {
            this.clearFieldError(this.elements.customerName);
        }
        
        // Check email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(this.elements.customerEmail.value)) {
            this.showFieldError(this.elements.customerEmail);
            isValid = false;
        } else {
            this.clearFieldError(this.elements.customerEmail);
        }
        
        return isValid;
    }

    showFieldError(field) {
        field.classList.add('error');
        const errorMsg = field.parentElement.querySelector('.error-message');
        if (errorMsg) errorMsg.classList.add('show');
    }

    clearFieldError(field) {
        field.classList.remove('error');
        const errorMsg = field.parentElement.querySelector('.error-message');
        if (errorMsg) errorMsg.classList.remove('show');
    }

    prepareQuoteData() {
        const calc = this.currentCalculation;
        const locations = calc.locations.map(l => l.name).join(', ');
        
        return {
            // Customer info
            customerName: this.elements.customerName.value.trim(),
            customerEmail: this.elements.customerEmail.value.trim(),
            companyName: this.elements.companyName.value.trim(),
            phone: this.elements.phoneNumber.value.trim(),
            projectName: this.elements.projectName.value.trim(),
            
            // Quote details
            quantity: calc.quantity,
            locations: locations,
            isHeavyweight: this.elements.isHeavyweight.checked,
            
            // Pricing
            basePrice: calc.basePrice,
            unitPrice: calc.unitPrice,
            ltmFee: calc.ltmFee,
            subtotal: calc.subtotal,
            totalCost: calc.total,
            
            // Sales rep
            salesRepEmail: this.elements.salesRep.value,
            salesRepName: this.elements.salesRep.options[this.elements.salesRep.selectedIndex].text,
            
            // Notes
            notes: this.elements.customerNotes.value.trim()
        };
    }

    async sendEmail(quoteData, quoteId) {
        const locations = this.currentCalculation.locations.map(l => l.name).join(', ');
        
        const emailData = {
            to_email: quoteData.customerEmail,
            from_name: 'Northwest Custom Apparel',
            reply_to: quoteData.salesRepEmail,
            quote_type: 'Contract DTG',
            quote_id: quoteId,
            quote_date: new Date().toLocaleDateString(),
            customer_name: quoteData.customerName,
            customer_email: quoteData.customerEmail,
            company_name: quoteData.companyName || '',
            customer_phone: quoteData.phone || '',
            project_name: quoteData.projectName || '',
            quantity: quoteData.quantity,
            locations: locations,
            unit_price: `$${this.currentCalculation.finalUnitPrice.toFixed(2)}`,
            grand_total: `$${quoteData.totalCost.toFixed(2)}`,
            notes: quoteData.notes || 'No special notes for this order',
            sales_rep_name: quoteData.salesRepName.split(' (')[0],
            sales_rep_email: quoteData.salesRepEmail,
            sales_rep_phone: '253-922-5793',
            company_year: '1977'
        };

        return emailjs.send('service_1c4k67j', 'template_dtg_contract', emailData);
    }

    showSuccess(message) {
        const msgDiv = document.createElement('div');
        msgDiv.className = 'message success';
        msgDiv.innerHTML = `
            <i class="fas fa-check-circle"></i>
            <span>${message}</span>`;
        
        document.querySelector('.main-container').insertBefore(msgDiv, document.querySelector('.calculator-grid'));
        
        setTimeout(() => msgDiv.remove(), 5000);
    }

    showError(message) {
        const msgDiv = document.createElement('div');
        msgDiv.className = 'message error';
        msgDiv.innerHTML = `
            <i class="fas fa-exclamation-circle"></i>
            <span>${message}</span>`;
        
        document.querySelector('.main-container').insertBefore(msgDiv, document.querySelector('.calculator-grid'));
        
        setTimeout(() => msgDiv.remove(), 5000);
    }
}