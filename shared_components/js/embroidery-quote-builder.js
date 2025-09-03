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
        
        document.getElementById('copy-quote-btn')?.addEventListener('click', () => {
            this.handleCopyQuote();
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
                // Store the quote ID in currentPricing for print
                if (this.currentPricing) {
                    this.currentPricing.quoteId = result.quoteID;
                }
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
            const customerData = this.getCustomerData();
            const salesRepEmail = document.getElementById('sales-rep-select')?.value || 'sales@nwcustomapparel.com';
            
            // Generate quote ID for email
            const quoteId = this.quoteService.generateQuoteID();
            
            // Store the quote ID in currentPricing for print
            if (this.currentPricing) {
                this.currentPricing.quoteId = quoteId;
            }
            
            // Generate plain text quote
            const quoteText = this.generatePlainTextQuote(quoteId, customerData, this.currentPricing);
            
            // Create mailto link
            const subject = `Embroidery Quote #${quoteId} - Northwest Custom Apparel`;
            const to = customerData.email;
            const cc = salesRepEmail;
            
            // URL encode the components
            const mailtoUrl = `mailto:${encodeURIComponent(to)}?cc=${encodeURIComponent(cc)}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(quoteText)}`;
            
            // Open email client
            window.location.href = mailtoUrl;
            
            // Also save to database
            try {
                await this.quoteService.saveQuote(
                    { quoteId },
                    customerData,
                    this.currentPricing
                );
                
                // Show simple success message after a delay (to allow email client to open)
                setTimeout(() => {
                    alert(`Quote #${quoteId} has been prepared in your email client.\n\nPlease review and send the email.`);
                }, 500);
            } catch (error) {
                console.error('Database save error:', error);
                // Don't block the email from opening if database save fails
            }
        } catch (error) {
            console.error('Email error:', error);
            alert('Failed to open email client');
        }
    }
    
    /**
     * Generate plain text version of quote for email
     */
    generatePlainTextQuote(quoteId, customerData, pricingData) {
        let text = '';
        
        // Header
        text += `EMBROIDERY QUOTE #${quoteId}\n`;
        text += `Northwest Custom Apparel\n`;
        text += `${'='.repeat(40)}\n\n`;
        
        // Customer info
        text += `CUSTOMER: ${customerData.name || 'N/A'}\n`;
        if (customerData.company) text += `COMPANY: ${customerData.company}\n`;
        text += `EMAIL: ${customerData.email}\n`;
        if (customerData.phone) text += `PHONE: ${customerData.phone}\n`;
        text += '\n';
        
        // Embroidery specifications
        text += `EMBROIDERY SPECIFICATIONS:\n`;
        text += `${'-'.repeat(40)}\n`;
        pricingData.logos.forEach((logo, idx) => {
            const isPrimary = logo.isPrimary !== false;
            const logoType = isPrimary ? 'Primary Logo' : `Additional Logo ${idx}`;
            text += `${logoType}: ${logo.position}\n`;
            text += `  ${logo.stitchCount.toLocaleString()} stitches`;
            if (logo.needsDigitizing) text += ' (Digitizing: $100)';
            text += '\n';
        });
        text += '\n';
        
        // Products
        text += `PRODUCTS:\n`;
        text += `${'-'.repeat(40)}\n`;
        pricingData.products.forEach(pp => {
            text += `${pp.product.style} - ${pp.product.color}\n`;
            text += `${pp.product.title}\n`;
            
            // Group regular sizes
            const regularSizes = pp.lineItems.filter(item => {
                const desc = item.description || '';
                return !desc.includes('2XL') && !desc.includes('3XL') && !desc.includes('4XL') && 
                       !desc.includes('5XL') && !desc.includes('6XL');
            });
            
            if (regularSizes.length > 0) {
                const totalQty = regularSizes.reduce((sum, item) => sum + item.quantity, 0);
                const totalAmount = regularSizes.reduce((sum, item) => sum + item.total, 0);
                const unitPrice = regularSizes[0].unitPriceWithLTM || regularSizes[0].unitPrice;
                text += `- Regular sizes (${totalQty} pcs) @ $${unitPrice.toFixed(2)} = $${totalAmount.toFixed(2)}\n`;
            }
            
            // Show each extended size separately
            const extendedSizes = pp.lineItems.filter(item => {
                const desc = item.description || '';
                return desc.includes('2XL') || desc.includes('3XL') || desc.includes('4XL') || 
                       desc.includes('5XL') || desc.includes('6XL');
            });
            
            extendedSizes.forEach(item => {
                const displayPrice = item.unitPriceWithLTM || item.unitPrice;
                text += `- ${item.description} @ $${displayPrice.toFixed(2)} = $${item.total.toFixed(2)}\n`;
            });
            
            text += '\n';
        });
        
        // Additional services
        if (pricingData.additionalServices && pricingData.additionalServices.length > 0) {
            text += `ADDITIONAL SERVICES:\n`;
            text += `${'-'.repeat(40)}\n`;
            pricingData.additionalServices.forEach(service => {
                const desc = service.type === 'monogram' 
                    ? 'Personalized Names/Monogramming'
                    : service.description.replace(/AL-\d+\s*/g, '');
                text += `${desc}\n`;
                text += `${service.quantity} pieces @ $${service.unitPrice.toFixed(2)} = $${service.total.toFixed(2)}\n`;
            });
            text += '\n';
        }
        
        // Totals
        text += `${'-'.repeat(40)}\n`;
        text += `Subtotal: $${pricingData.subtotal.toFixed(2)}\n`;
        if (pricingData.additionalServicesTotal > 0) {
            text += `Additional Services: $${pricingData.additionalServicesTotal.toFixed(2)}\n`;
        }
        if (pricingData.setupFees > 0) {
            text += `Setup Fees: $${pricingData.setupFees.toFixed(2)}\n`;
        }
        text += '\n';
        text += `Subtotal: $${pricingData.grandTotal.toFixed(2)}\n`;
        
        // Tax calculation
        const taxAmount = pricingData.grandTotal * 0.101;
        text += `WA Sales Tax (10.1%): $${taxAmount.toFixed(2)}\n`;
        text += `${'='.repeat(40)}\n`;
        text += `GRAND TOTAL: $${(pricingData.grandTotal + taxAmount).toFixed(2)}\n`;
        text += `${'='.repeat(40)}\n\n`;
        
        // Footer
        const today = new Date();
        const expiryDate = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
        text += `Valid Until: ${expiryDate.toLocaleDateString()}\n`;
        text += `\nPayment Terms: 50% deposit required\n`;
        text += `\n${customerData.notes ? `Notes: ${customerData.notes}\n` : ''}`;
        text += `\nThank you for your business!\n`;
        text += `Northwest Custom Apparel\n`;
        text += `(253) 922-5793\n`;
        text += `www.nwcustomapparel.com\n`;
        
        return text;
    }
    
    /**
     * Handle copy quote to clipboard
     */
    async handleCopyQuote() {
        if (!this.validateCustomerInfo()) return;
        
        try {
            const customerData = this.getCustomerData();
            
            // Generate quote ID
            const quoteId = this.quoteService.generateQuoteID();
            
            // Store the quote ID in currentPricing for consistency
            if (this.currentPricing) {
                this.currentPricing.quoteId = quoteId;
            }
            
            // Generate plain text quote
            const quoteText = this.generatePlainTextQuote(quoteId, customerData, this.currentPricing);
            
            // Copy to clipboard
            if (navigator.clipboard && navigator.clipboard.writeText) {
                // Modern API
                await navigator.clipboard.writeText(quoteText);
            } else {
                // Fallback for older browsers
                const textArea = document.createElement('textarea');
                textArea.value = quoteText;
                textArea.style.position = 'fixed';
                textArea.style.top = '-9999px';
                textArea.style.left = '-9999px';
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
            }
            
            // Save to database
            try {
                await this.quoteService.saveQuote(
                    { quoteId },
                    customerData,
                    this.currentPricing
                );
            } catch (error) {
                console.error('Database save error:', error);
            }
            
            // Show success message
            const copyBtn = document.getElementById('copy-quote-btn');
            const originalText = copyBtn.innerHTML;
            copyBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';
            copyBtn.classList.add('btn-success');
            copyBtn.classList.remove('btn-secondary');
            
            // Revert button after 2 seconds
            setTimeout(() => {
                copyBtn.innerHTML = originalText;
                copyBtn.classList.remove('btn-success');
                copyBtn.classList.add('btn-secondary');
            }, 2000);
            
            // Also show alert
            alert(`Quote #${quoteId} has been copied to your clipboard.\n\nYou can now paste it into any email client or document.`);
            
        } catch (error) {
            console.error('Copy error:', error);
            alert('Failed to copy quote to clipboard');
        }
    }
    
    /**
     * Handle print quote
     */
    handlePrintQuote() {
        if (!this.currentPricing) return;
        
        // Get customer data
        const customerData = this.getCustomerData();
        
        // Create invoice generator
        const invoiceGenerator = new EmbroideryInvoiceGenerator();
        
        // Generate professional invoice HTML
        const invoiceHTML = invoiceGenerator.generateInvoiceHTML(this.currentPricing, customerData);
        
        // Open print window
        const printWindow = window.open('', '_blank');
        printWindow.document.write(invoiceHTML);
        printWindow.document.close();
        
        // Auto-print after a short delay
        setTimeout(() => {
            printWindow.print();
        }, 250);
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
        const salesRep = document.getElementById('sales-rep')?.value;
        
        if (!name) {
            alert('Customer name is required');
            return false;
        }
        
        if (!email || !email.includes('@')) {
            alert('Valid email address is required');
            return false;
        }
        
        if (!salesRep) {
            alert('Please select a sales representative');
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
            notes: document.getElementById('special-notes')?.value.trim(),
            salesRepEmail: document.getElementById('sales-rep')?.value || 'sales@nwcustomapparel.com'
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