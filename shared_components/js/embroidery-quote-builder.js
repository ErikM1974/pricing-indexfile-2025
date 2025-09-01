/**
 * Main Embroidery Quote Builder Controller
 * Orchestrates all modules and handles UI flow
 */

class EmbroideryQuoteBuilder {
    constructor() {
        // Initialize all modules
        this.logoManager = new LogoManager();
        this.productLineManager = new ProductLineManager();
        this.pricingCalculator = new EmbroideryPricingCalculator();
        this.quoteService = new EmbroideryQuoteService();
        
        // Make product manager globally accessible for UI callbacks
        window.productLineManager = this.productLineManager;
        
        // Current state
        this.currentPhase = 'logo';
        this.currentPricing = null;
        
        this.initializeUI();
        this.bindEvents();
        
        console.log('[EmbroideryQuoteBuilder] Initialized successfully');
    }
    
    /**
     * Initialize UI components
     */
    initializeUI() {
        this.showPhase('logo');
        this.logoManager.addLogo(); // Start with one logo
    }
    
    /**
     * Bind global events
     */
    bindEvents() {
        // Phase navigation
        document.getElementById('continue-to-products')?.addEventListener('click', () => {
            this.showPhase('product');
        });
        
        document.getElementById('continue-to-summary')?.addEventListener('click', () => {
            this.showPhase('summary');
            this.generateSummary();
        });
        
        document.getElementById('back-to-logos')?.addEventListener('click', () => {
            this.showPhase('logo');
        });
        
        document.getElementById('back-to-products')?.addEventListener('click', () => {
            this.showPhase('product');
        });
        
        // Quote actions
        document.getElementById('save-quote-btn')?.addEventListener('click', () => {
            this.handleSaveQuote();
        });
        
        document.getElementById('email-quote-btn')?.addEventListener('click', () => {
            this.handleEmailQuote();
        });
        
        document.getElementById('print-quote-btn')?.addEventListener('click', () => {
            this.handlePrintQuote();
        });
        
        // Hide suggestions when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('#style-search') && !e.target.closest('#style-suggestions')) {
                const suggestions = document.getElementById('style-suggestions');
                if (suggestions) suggestions.style.display = 'none';
            }
        });
    }
    
    /**
     * Show specific phase
     */
    showPhase(phase) {
        // Hide all phases
        document.querySelectorAll('.phase-section').forEach(section => {
            section.style.display = 'none';
            section.classList.remove('active');
        });
        
        // Show selected phase
        const phaseElement = document.getElementById(`${phase}-phase`);
        if (phaseElement) {
            phaseElement.style.display = 'block';
            phaseElement.classList.add('active');
        }
        
        // Update navigation indicators
        this.updatePhaseNavigation(phase);
        
        this.currentPhase = phase;
        
        // Update pricing if showing summary
        if (phase === 'summary') {
            this.updatePricing();
        }
    }
    
    /**
     * Update phase navigation indicators
     */
    updatePhaseNavigation(currentPhase) {
        const phases = ['logo', 'product', 'summary'];
        const currentIndex = phases.indexOf(currentPhase);
        
        phases.forEach((phase, index) => {
            const navItem = document.getElementById(`phase-${index + 1}-nav`);
            const connector = document.getElementById(`connector-${index + 1}`);
            
            if (navItem) {
                navItem.classList.remove('active', 'completed');
                
                if (index < currentIndex) {
                    navItem.classList.add('completed');
                } else if (index === currentIndex) {
                    navItem.classList.add('active');
                }
            }
            
            if (connector) {
                connector.classList.remove('active', 'completed');
                
                if (index < currentIndex) {
                    connector.classList.add('completed');
                } else if (index === currentIndex) {
                    connector.classList.add('active');
                }
            }
        });
    }
    
    /**
     * Update pricing calculations
     */
    async updatePricing() {
        try {
            const products = this.productLineManager.exportProducts();
            const logosData = this.logoManager.exportLogos();
            
            if (products.length === 0 || logosData.logos.length === 0) {
                this.currentPricing = null;
                return;
            }
            
            this.currentPricing = await this.pricingCalculator.calculateQuote(
                products, 
                logosData.logos
            );
            
            // Update aggregate display in product phase
            if (this.currentPhase === 'product') {
                this.updateProductPhaseDisplay();
            }
            
            // Update summary if we're on that phase
            if (this.currentPhase === 'summary') {
                this.renderSummary();
            }
            
        } catch (error) {
            console.error('[EmbroideryQuoteBuilder] Pricing error:', error);
        }
    }
    
    /**
     * Update product phase displays
     */
    updateProductPhaseDisplay() {
        // This is called by ProductLineManager when products change
        if (this.currentPricing) {
            // Could add pricing previews in product phase here
        }
    }
    
    /**
     * Generate and show summary
     */
    async generateSummary() {
        const products = this.productLineManager.exportProducts();
        const logosData = this.logoManager.exportLogos();
        
        if (products.length === 0) {
            alert('Please add at least one product');
            this.showPhase('product');
            return;
        }
        
        if (logosData.logos.length === 0) {
            alert('Please add at least one logo');
            this.showPhase('logo');
            return;
        }
        
        await this.updatePricing();
        this.renderSummary();
        this.populateSalesRepDropdown();
    }
    
    /**
     * Render summary display
     */
    renderSummary() {
        const container = document.getElementById('quote-summary');
        if (!container || !this.currentPricing) return;
        
        let html = '<div class="quote-summary-content">';
        
        // Header
        html += `
            <div class="summary-header">
                <h3>Embroidery Quote Summary</h3>
                <div class="quote-meta">
                    <span>Total Pieces: <strong>${this.currentPricing.totalQuantity}</strong></span>
                    <span>Tier: <strong>${this.currentPricing.tier}</strong></span>
                </div>
            </div>
        `;
        
        // Logos section
        html += '<div class="summary-section">';
        html += '<h4><i class="fas fa-thread"></i> Embroidery Specifications</h4>';
        this.currentPricing.logos.forEach((logo, idx) => {
            const isPrimary = idx === 0; // First logo is always primary
            html += `
                <div class="logo-spec">
                    <span class="logo-number">${idx + 1}.</span>
                    <span class="logo-details">
                        ${logo.position} - ${logo.stitchCount.toLocaleString()} stitches
                        ${isPrimary ? '<span class="badge badge-primary">PRIMARY</span>' : '<span class="badge badge-additional">ADDITIONAL</span>'}
                        ${logo.needsDigitizing ? '<span class="digitizing-badge">+Digitizing $100</span>' : ''}
                    </span>
                </div>
            `;
        });
        
        if (this.currentPricing.ltmFee > 0) {
            html += '<p class="ltm-notice"><i class="fas fa-info-circle"></i> Includes small batch pricing for orders under 24 pieces</p>';
        }
        
        html += '</div>';
        
        // Products section
        html += '<div class="summary-section">';
        html += '<h4><i class="fas fa-tshirt"></i> Products</h4>';
        
        this.currentPricing.products.forEach(pp => {
            html += `
                <div class="product-summary">
                    <div class="product-header">
                        <img src="${pp.product.imageUrl || 'https://via.placeholder.com/150x150/f0f0f0/666?text=' + encodeURIComponent(pp.product.style)}" 
                             alt="${pp.product.style} - ${pp.product.color}"
                             onerror="this.src='https://via.placeholder.com/150x150/f0f0f0/666?text=' + encodeURIComponent('${pp.product.style}')">
                        <div class="product-info">
                            <strong>${pp.product.style} - ${pp.product.color}</strong>
                            <span>${pp.product.title}</span>
                            <span>${pp.product.totalQuantity} pieces total</span>
                        </div>
                    </div>
                    <div class="product-lines">
            `;
            
            pp.lineItems.forEach(item => {
                const displayPrice = item.unitPriceWithLTM || item.unitPrice;
                html += `
                    <div class="line-item">
                        <span>${item.description}</span>
                        <span>@ $${displayPrice.toFixed(2)} each</span>
                        <span class="line-total">$${item.total.toFixed(2)}</span>
                    </div>
                `;
            });
            
            html += `
                    </div>
                    <div class="product-subtotal">
                        Subtotal: <strong>$${pp.subtotal.toFixed(2)}</strong>
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        
        // Additional Services section (if any)
        if (this.currentPricing.additionalServices && this.currentPricing.additionalServices.length > 0) {
            html += '<div class="summary-section additional-services-section">';
            html += '<h4><i class="fas fa-plus-circle"></i> Additional Services</h4>';
            
            this.currentPricing.additionalServices.forEach(service => {
                html += `
                    <div class="additional-service-item">
                        <div class="service-header">
                            <span class="service-name">${service.description}</span>
                            <span class="service-part-number">${service.partNumber}</span>
                        </div>
                        <div class="service-details">
                            <span>${service.quantity} pieces</span>
                            <span>@ $${service.unitPrice.toFixed(2)} each</span>
                            <span class="service-total">$${service.total.toFixed(2)}</span>
                        </div>
                        ${service.hasSubsetUpcharge ? '<span class="subset-note">*Includes $3.00 subset upcharge</span>' : ''}
                    </div>
                `;
            });
            
            html += '</div>';
        }
        
        // Totals section
        html += `
            <div class="summary-section totals-section">
                <h4><i class="fas fa-calculator"></i> Quote Totals</h4>
                <div class="totals-breakdown">
                    <div class="total-line">
                        <span>Products & Primary Embroidery:</span>
                        <span>$${this.currentPricing.subtotal.toFixed(2)}</span>
                    </div>
        `;
        
        if (this.currentPricing.additionalServicesTotal && this.currentPricing.additionalServicesTotal > 0) {
            html += `
                <div class="total-line">
                    <span>Additional Services:</span>
                    <span>$${this.currentPricing.additionalServicesTotal.toFixed(2)}</span>
                </div>
            `;
        }
        
        if (this.currentPricing.setupFees > 0) {
            html += `
                <div class="total-line">
                    <span>Setup Fees (${this.currentPricing.logos.filter(l => l.needsDigitizing).length} logos):</span>
                    <span>$${this.currentPricing.setupFees.toFixed(2)}</span>
                </div>
            `;
        }
        
        if (this.currentPricing.ltmFee > 0) {
            html += `
                <div class="total-line ltm-line">
                    <span>Small Batch Fee:</span>
                    <span>$${this.currentPricing.ltmFee.toFixed(2)}</span>
                </div>
            `;
        }
        
        html += `
                    <div class="total-line grand-total">
                        <span>GRAND TOTAL:</span>
                        <span>$${this.currentPricing.grandTotal.toFixed(2)}</span>
                    </div>
                </div>
            </div>
        `;
        
        html += '</div>';
        container.innerHTML = html;
    }
    
    /**
     * Populate sales rep dropdown
     */
    populateSalesRepDropdown() {
        // Add sales rep dropdown to customer form if not exists
        const customerSection = document.querySelector('.customer-info-section .form-row:last-child');
        if (customerSection && !document.getElementById('sales-rep-select')) {
            const salesRepGroup = document.createElement('div');
            salesRepGroup.className = 'form-group';
            salesRepGroup.innerHTML = `
                <label for="sales-rep-select">Sales Representative</label>
                <select id="sales-rep-select">
                    ${this.quoteService.getSalesReps().map(rep => `
                        <option value="${rep.email}" ${rep.default ? 'selected' : ''}>
                            ${rep.name}
                        </option>
                    `).join('')}
                </select>
            `;
            customerSection.appendChild(salesRepGroup);
        }
    }
    
    /**
     * Handle save quote
     */
    async handleSaveQuote() {
        if (!this.validateCustomerInfo()) return;
        
        try {
            this.showLoading(true);
            
            const customerData = this.getCustomerData();
            const result = await this.quoteService.saveQuote(
                { quoteId: 'temp' }, // Will be generated in service
                customerData,
                this.currentPricing
            );
            
            if (result.success) {
                this.showSuccessModal(result.quoteID, customerData, this.currentPricing);
            } else {
                alert('Failed to save quote: ' + result.error);
            }
        } catch (error) {
            console.error('Save error:', error);
            alert('Failed to save quote');
        } finally {
            this.showLoading(false);
        }
    }
    
    /**
     * Handle email quote
     */
    async handleEmailQuote() {
        if (!this.validateCustomerInfo()) return;
        
        try {
            this.showLoading(true);
            
            const customerData = this.getCustomerData();
            const salesRepEmail = document.getElementById('sales-rep-select')?.value || 'sales@nwcustomapparel.com';
            
            // Generate quote ID for email
            const quoteId = this.quoteService.generateQuoteID();
            
            // Send email
            const result = await this.quoteService.sendQuoteEmail(
                { quoteId },
                customerData,
                this.currentPricing,
                salesRepEmail
            );
            
            if (result.success) {
                // Also save to database
                await this.quoteService.saveQuote(
                    { quoteId },
                    customerData,
                    this.currentPricing
                );
                
                this.showSuccessModal(quoteId, customerData, this.currentPricing);
            } else {
                alert('Failed to send email: ' + result.error);
            }
        } catch (error) {
            console.error('Email error:', error);
            alert('Failed to send quote');
        } finally {
            this.showLoading(false);
        }
    }
    
    /**
     * Handle print quote
     */
    handlePrintQuote() {
        if (!this.currentPricing) return;
        
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Embroidery Quote</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 40px; }
                    .header { text-align: center; margin-bottom: 30px; }
                    .logo-spec, .product-summary { margin-bottom: 20px; }
                    .totals { border-top: 2px solid #333; padding-top: 20px; }
                    .grand-total { font-size: 18px; font-weight: bold; }
                    @media print { body { margin: 0; } }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>Northwest Custom Apparel</h1>
                    <h2>Embroidery Quote</h2>
                    <p>Valid for 30 days</p>
                </div>
                ${this.generatePrintHTML()}
            </body>
            </html>
        `);
        
        printWindow.document.close();
        printWindow.print();
    }
    
    /**
     * Generate print HTML
     */
    generatePrintHTML() {
        if (!this.currentPricing) return '';
        
        let html = '<div class="quote-content">';
        
        // Logos
        html += '<h3>Embroidery Specifications:</h3>';
        this.currentPricing.logos.forEach((logo, idx) => {
            html += `<p>${idx + 1}. ${logo.position} - ${logo.stitchCount.toLocaleString()} stitches`;
            if (logo.needsDigitizing) html += ' ✓ Digitizing: $100';
            html += '</p>';
        });
        
        // Products
        html += '<h3>Products:</h3>';
        this.currentPricing.products.forEach(pp => {
            html += `<div class="product-summary">`;
            html += `<h4>${pp.product.style} - ${pp.product.color} - ${pp.product.totalQuantity} pieces</h4>`;
            
            pp.lineItems.forEach(item => {
                const displayPrice = item.unitPriceWithLTM || item.unitPrice;
                html += `<p>${item.description} @ $${displayPrice.toFixed(2)} each = $${item.total.toFixed(2)}</p>`;
            });
            
            html += `<p><strong>Subtotal: $${pp.subtotal.toFixed(2)}</strong></p></div>`;
        });
        
        // Additional Services
        if (this.currentPricing.additionalServices && this.currentPricing.additionalServices.length > 0) {
            html += '<h3>Additional Services:</h3>';
            this.currentPricing.additionalServices.forEach(service => {
                html += `<p>${service.description} (${service.quantity} pieces) @ $${service.unitPrice.toFixed(2)} = $${service.total.toFixed(2)}</p>`;
            });
        }
        
        // Totals
        html += '<div class="totals">';
        html += `<p>Total Quantity: ${this.currentPricing.totalQuantity} pieces</p>`;
        html += `<p>Products & Primary Embroidery: $${this.currentPricing.subtotal.toFixed(2)}</p>`;
        if (this.currentPricing.additionalServicesTotal > 0) {
            html += `<p>Additional Services: $${this.currentPricing.additionalServicesTotal.toFixed(2)}</p>`;
        }
        if (this.currentPricing.setupFees > 0) {
            html += `<p>Setup Fees: $${this.currentPricing.setupFees.toFixed(2)}</p>`;
        }
        html += `<p class="grand-total">GRAND TOTAL: $${this.currentPricing.grandTotal.toFixed(2)}</p>`;
        html += '</div>';
        
        html += '</div>';
        return html;
    }
    
    /**
     * Validate customer information
     */
    validateCustomerInfo() {
        const name = document.getElementById('customer-name')?.value.trim();
        const email = document.getElementById('customer-email')?.value.trim();
        
        if (!name) {
            alert('Customer name is required');
            return false;
        }
        
        if (!email || !email.includes('@')) {
            alert('Valid email address is required');
            return false;
        }
        
        return true;
    }
    
    /**
     * Get customer data from form
     */
    getCustomerData() {
        return {
            name: document.getElementById('customer-name')?.value.trim(),
            email: document.getElementById('customer-email')?.value.trim(),
            phone: document.getElementById('customer-phone')?.value.trim(),
            company: document.getElementById('company-name')?.value.trim(),
            project: document.getElementById('project-name')?.value.trim(),
            notes: document.getElementById('special-notes')?.value.trim()
        };
    }
    
    /**
     * Show success modal
     */
    showSuccessModal(quoteId, customerData, pricing) {
        document.getElementById('modal-quote-id').textContent = quoteId;
        document.getElementById('modal-customer').textContent = customerData.name;
        document.getElementById('modal-total').textContent = `$${pricing.grandTotal.toFixed(2)}`;
        document.getElementById('success-modal').style.display = 'flex';
    }
    
    /**
     * Show/hide loading
     */
    showLoading(show) {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.style.display = show ? 'flex' : 'none';
        }
    }
}

// Global functions for UI callbacks
function closeSuccessModal() {
    document.getElementById('success-modal').style.display = 'none';
}

// Make available globally
window.EmbroideryQuoteBuilder = EmbroideryQuoteBuilder;