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
        
        document.getElementById('new-quote-btn')?.addEventListener('click', () => {
            this.handleNewQuote();
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
     * Render summary display - matching Cap Embroidery style
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
        
        // EMBROIDERY PACKAGE BREAKDOWN - Like Cap Embroidery
        html += `
            <div style="background: #f0f8f0; border: 1px solid #4cb354; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <h4 style="margin: 0 0 12px 0; color: #4cb354; text-transform: uppercase; font-size: 14px;">
                    <i class="fas fa-thread"></i> EMBROIDERY PACKAGE FOR THIS ORDER:
                </h4>
        `;
        
        // Show primary logo first
        const primaryLogos = this.currentPricing.logos.filter((l, idx) => idx === 0);
        const additionalLogos = this.currentPricing.logos.filter((l, idx) => idx > 0);
        
        primaryLogos.forEach(logo => {
            html += `
                <p style="margin: 5px 0; font-size: 14px;">
                    <span style="color: #4cb354;">✓</span> 
                    <strong>${logo.position}</strong> (${logo.stitchCount.toLocaleString()} stitches) - 
                    <strong style="color: #4cb354;">INCLUDED IN BASE PRICE</strong>
                    ${logo.needsDigitizing ? '<span style="color: #ff6b6b;"> [+$100 Digitizing]</span>' : ''}
                </p>
            `;
        });
        
        // Show additional logos with pricing from API
        additionalLogos.forEach(logo => {
            // Find matching additional service for this logo position
            let matchedService = null;
            let alPrice = 0;
            
            if (this.currentPricing.additionalServices) {
                // Try to match by position name in service description
                matchedService = this.currentPricing.additionalServices.find(service => {
                    const serviceDesc = service.description.toLowerCase();
                    const logoPos = logo.position.toLowerCase();
                    // Match if service description contains the logo position
                    return serviceDesc.includes(logoPos.replace(' ', '')) || 
                           serviceDesc.includes(logoPos) ||
                           (logoPos.includes('chest') && serviceDesc.includes('chest')) ||
                           (logoPos.includes('back') && serviceDesc.includes('back')) ||
                           (logoPos.includes('sleeve') && serviceDesc.includes('sleeve'));
                });
                
                if (matchedService) {
                    alPrice = matchedService.unitPrice;
                }
            }
            
            html += `
                <p style="margin: 5px 0; font-size: 14px;">
                    <span style="color: #4cb354;">✓</span> 
                    <strong>${logo.position}</strong> (${logo.stitchCount.toLocaleString()} stitches) - 
                    <strong style="color: #ff9800;">ADDITIONAL ${alPrice > 0 ? `(+$${alPrice.toFixed(2)} per piece)` : '(see additional services)'}</strong>
                    ${logo.needsDigitizing ? '<span style="color: #ff6b6b;"> [+$100 Digitizing]</span>' : ''}
                </p>
            `;
        });
        
        // Show small batch fee if applicable
        if (this.currentPricing.ltmFee > 0) {
            const ltmPerPiece = (this.currentPricing.ltmFee / this.currentPricing.totalQuantity).toFixed(2);
            html += `
                <p style="margin: 5px 0; font-size: 14px; color: #ff6b6b;">
                    <span>⚠</span> 
                    <strong>Small Batch Fee</strong> - 
                    <strong>ADDITIONAL (+$${ltmPerPiece} per piece for orders under 24)</strong>
                </p>
            `;
        }
        
        html += '</div>';
        
        // Products section - Enhanced like Cap Embroidery
        html += '<div class="summary-section">';
        html += '<h4><i class="fas fa-tshirt"></i> Products</h4>';
        
        // Track corrected overall subtotal for grand total calculation
        let correctedOverallSubtotal = 0;
        
        this.currentPricing.products.forEach(pp => {
            // Calculate total additional logo cost from API data
            let totalAdditionalLogoCost = 0;
            if (this.currentPricing.additionalServices) {
                totalAdditionalLogoCost = this.currentPricing.additionalServices
                    .reduce((sum, service) => sum + service.unitPrice, 0);
            }
            
            html += `
                <div class="product-summary" style="border: 1px solid #e0e0e0; border-radius: 8px; padding: 15px; margin-bottom: 15px;">
                    <div class="product-header" style="display: flex; gap: 15px; margin-bottom: 15px;">
                        <img src="${pp.product.imageUrl || 'https://via.placeholder.com/80x80/f0f0f0/666?text=' + encodeURIComponent(pp.product.style)}" 
                             alt="${pp.product.style} - ${pp.product.color}"
                             style="width: 80px; height: 80px; object-fit: contain; border: 1px solid #e0e0e0; border-radius: 4px;"
                             onerror="this.src='https://via.placeholder.com/80x80/f0f0f0/666?text=' + encodeURIComponent('${pp.product.style}')">
                        <div class="product-info" style="flex: 1;">
                            <strong style="font-size: 16px; color: #333;">${pp.product.style} - ${pp.product.color}</strong>
                            <p style="margin: 5px 0; color: #666; font-size: 14px;">${pp.product.title}</p>
                            <p style="margin: 5px 0; color: #4cb354; font-weight: bold;">${pp.product.totalQuantity} pieces total</p>
                        </div>
                    </div>
                    <div class="product-lines" style="background: #f8f9fa; padding: 10px; border-radius: 4px;">
            `;
            
            // Calculate corrected product subtotal based on corrected line items
            let correctedProductSubtotal = 0;
            
            pp.lineItems.forEach((item, index) => {
                // Calculate pricing components
                const ltmPerPiece = this.currentPricing.ltmFee > 0 ? this.currentPricing.ltmFee / this.currentPricing.totalQuantity : 0;
                const extraStitchCharge = this.currentPricing.additionalStitchCost || 0; // Extra stitch charge for primary logo over 7500
                
                // The basePrice already includes the base embroidery AND extra stitch charge
                const basePrice = item.unitPrice;
                const displayPrice = item.unitPriceWithLTM || item.unitPrice;
                const consolidatedPrice = displayPrice + totalAdditionalLogoCost;
                const correctedTotal = consolidatedPrice * item.quantity;
                correctedProductSubtotal += correctedTotal;
                
                // Build the pricing breakdown like cap quote
                let baseLine = '';
                if (extraStitchCharge > 0) {
                    // Show base price with extra stitch charge separately
                    const baseWithoutExtraStitch = basePrice - extraStitchCharge;
                    baseLine = `Base (includes primary logo): $${baseWithoutExtraStitch.toFixed(2)} + Extra stitches: $${extraStitchCharge.toFixed(2)}`;
                    if (ltmPerPiece > 0) {
                        baseLine += ` + Small batch: $${ltmPerPiece.toFixed(2)} = $${displayPrice.toFixed(2)} each`;
                    } else {
                        baseLine += ` = $${displayPrice.toFixed(2)} each`;
                    }
                } else {
                    // No extra stitches, show normal breakdown
                    baseLine = `Base (includes primary logo): $${basePrice.toFixed(2)}`;
                    if (ltmPerPiece > 0) {
                        baseLine += ` + Small batch: $${ltmPerPiece.toFixed(2)} = $${displayPrice.toFixed(2)} each`;
                    } else {
                        baseLine += ` = $${displayPrice.toFixed(2)} each`;
                    }
                }
                
                // Build additional logos lines if present
                let additionalLogosLines = '';
                if (this.currentPricing.additionalServices && this.currentPricing.additionalServices.length > 0) {
                    this.currentPricing.additionalServices.forEach(service => {
                        additionalLogosLines += `<br>+ ${service.description}: $${service.unitPrice.toFixed(2)}`;
                    });
                    additionalLogosLines += `<br>= $${consolidatedPrice.toFixed(2)} each`;
                }
                
                html += `
                    <div class="line-item" style="padding: 12px 0; ${index > 0 ? 'border-top: 1px solid #e0e0e0;' : ''}">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                            <div style="flex: 1;">
                                <strong>${item.description} (${item.quantity} ${item.quantity === 1 ? 'piece' : 'pieces'})</strong>
                                <div style="font-size: 13px; color: #666; margin-top: 4px; line-height: 1.5;">
                                    ${baseLine}
                                    ${additionalLogosLines}
                                </div>
                            </div>
                            <div style="text-align: right; min-width: 100px; font-weight: bold; align-self: center;">
                                $${correctedTotal.toFixed(2)}
                            </div>
                        </div>
                    </div>
                `;
            });
            
            // Add to overall corrected subtotal
            correctedOverallSubtotal += correctedProductSubtotal;
            
            html += `
                    </div>
                    <div class="product-subtotal" style="text-align: right; margin-top: 10px; padding-top: 10px; border-top: 2px solid #4cb354;">
                        <strong style="font-size: 16px;">Subtotal: <span style="color: #4cb354;">$${correctedProductSubtotal.toFixed(2)}</span></strong>
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        
        // Additional Services section removed from display since costs are already included in line item prices
        // The additional services data is still maintained in this.currentPricing.additionalServices for database/email purposes
        
        // Totals section - No tax in summary (tax only in PDF like cap quote)
        // Note: LTM fee is already included in correctedOverallSubtotal via unitPriceWithLTM
        // Since additional services are already included in our corrected line items, we don't double-add them
        const grandTotal = correctedOverallSubtotal + this.currentPricing.setupFees;
        
        // Calculate tax separately for PDF use (not shown in summary)
        const salesTax = grandTotal * 0.101; // 10.1% Milton, WA sales tax
        const grandTotalWithTax = grandTotal + salesTax;
        
        html += `
            <div class="summary-section totals-section" style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-top: 20px;">
                <h4 style="color: #4cb354; margin-bottom: 15px;"><i class="fas fa-calculator"></i> Quote Totals</h4>
                <div class="totals-breakdown">
                    <div class="total-line" style="display: flex; justify-content: space-between; padding: 8px 0;">
                        <span>Products & Primary Embroidery${this.currentPricing.ltmFee > 0 ? ' (includes small batch fee)' : ''}:</span>
                        <span style="font-weight: bold;">$${correctedOverallSubtotal.toFixed(2)}</span>
                    </div>
        `;
        
        // Additional services are already included in corrected line item calculations
        // So we don't show them as a separate line in the totals
        
        if (this.currentPricing.setupFees > 0) {
            html += `
                <div class="total-line" style="display: flex; justify-content: space-between; padding: 8px 0;">
                    <span>Setup Fees (${this.currentPricing.logos.filter(l => l.needsDigitizing).length} logo${this.currentPricing.logos.filter(l => l.needsDigitizing).length > 1 ? 's' : ''}):</span>
                    <span style="font-weight: bold;">$${this.currentPricing.setupFees.toFixed(2)}</span>
                </div>
            `;
        }
        
        // Small batch fee is already included in product pricing, so we don't add it as a separate line
        // No subtotal or sales tax lines in summary (like cap quote) - tax only appears in PDF
        
        html += `
                    <div class="total-line grand-total" style="display: flex; justify-content: space-between; padding: 12px 0; border-top: 2px solid #4cb354; margin-top: 10px; font-size: 18px;">
                        <span style="font-weight: bold; color: #333;">GRAND TOTAL:</span>
                        <span style="font-weight: bold; color: #333;">$${grandTotal.toFixed(2)}</span>
                    </div>
                </div>
            </div>
        `;
        
        // Store both totals for later use (summary shows pre-tax, PDF shows with tax)
        this.currentPricing.grandTotal = grandTotal;
        this.currentPricing.grandTotalWithTax = grandTotalWithTax;
        
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
     * Handle save quote - Updated to match Cap Embroidery style
     */
    async handleSaveQuote() {
        console.log('[EmbroideryQuoteBuilder] Handling save quote...');
        
        if (!this.validateCustomerInfo()) return;
        
        try {
            this.showLoading(true, 'Saving quote...');
            
            // Collect customer information
            const customerData = this.getCustomerData();
            
            // Save to database if requested
            const saveToDb = document.getElementById('save-to-database')?.checked;
            let quoteID = null;
            let saveSuccess = false;
            
            if (saveToDb) {
                const result = await this.quoteService.saveQuote(
                    { quoteId: 'temp' }, // Will be generated in service
                    customerData,
                    this.currentPricing
                );
                
                if (result.success) {
                    quoteID = result.quoteID;
                    saveSuccess = true;
                    console.log('[EmbroideryQuoteBuilder] ✓ Quote saved to database:', quoteID);
                    
                    // Store the quote ID in currentPricing for other functions
                    if (this.currentPricing) {
                        this.currentPricing.quoteId = quoteID;
                    }
                } else {
                    console.error('[EmbroideryQuoteBuilder] Database save failed:', result.error);
                    this.showErrorNotification(
                        'Database Save Failed',
                        `Quote could not be saved to database: ${result.error}\nYou can still print or copy the quote.`
                    );
                    quoteID = this.quoteService.generateQuoteId();
                }
            } else {
                // Generate quote ID for display even if not saving
                quoteID = this.quoteService.generateQuoteId();
                saveSuccess = true;
            }
            
            // Show success notification with quote ID
            if (saveSuccess) {
                const grandTotal = this.currentPricing.grandTotalWithTax || this.currentPricing.grandTotal;
                this.showSuccessNotification(
                    `Quote ${quoteID} saved successfully!`,
                    `Customer: ${customerData.name} | Total: $${grandTotal.toFixed(2)}`
                );
            }
            
        } catch (error) {
            console.error('[EmbroideryQuoteBuilder] ✗ Save quote failed:', error);
            this.showErrorNotification(
                'Quote Save Failed',
                `An error occurred while saving the quote:\n${error.message}\n\nPlease try again or contact support.`
            );
        } finally {
            this.showLoading(false);
        }
    }
    
    /**
     * Handle email quote - Updated to use EmailJS
     */
    async handleEmailQuote() {
        console.log('[EmbroideryQuoteBuilder] Handling email quote...');
        
        if (!this.validateCustomerInfo()) return;
        
        try {
            this.showLoading(true, 'Sending email...');
            
            // Collect customer information
            const customerData = this.getCustomerData();
            
            // Generate quote ID
            const quoteID = this.quoteService.generateQuoteId();
            
            // Store the quote ID for other functions
            if (this.currentPricing) {
                this.currentPricing.quoteId = quoteID;
            }
            
            // Send email using the updated service method
            const result = await this.quoteService.sendQuoteEmail(
                { quoteId: quoteID },
                customerData,
                this.currentPricing,
                customerData.salesRepEmail
            );
            
            if (result.success) {
                console.log('[EmbroideryQuoteBuilder] ✓ Quote email sent successfully');
                const grandTotal = this.currentPricing.grandTotalWithTax || this.currentPricing.grandTotal;
                this.showSuccessNotification(
                    `Quote ${quoteID} emailed successfully!`,
                    `Sent to: ${customerData.email} | Total: $${grandTotal.toFixed(2)}`
                );
            } else {
                throw new Error(result.error || 'Unknown error');
            }
            
        } catch (error) {
            console.error('[EmbroideryQuoteBuilder] ✗ Email send failed:', error);
            this.showErrorNotification(
                'Email Send Failed',
                `Failed to send quote: ${error.message}`
            );
        } finally {
            this.showLoading(false);
        }
    }
    
    /**
     * Handle copy quote to clipboard
     */
    handleCopyQuote() {
        if (!this.currentPricing) {
            this.showErrorNotification('No Quote Data', 'Please complete your quote first.');
            return;
        }
        
        console.log('[EmbroideryQuoteBuilder] Handling copy quote...');
        
        const quoteText = this.generateQuoteText();
        
        navigator.clipboard.writeText(quoteText).then(() => {
            console.log('[EmbroideryQuoteBuilder] Quote copied to clipboard');
            
            // Show temporary feedback on button
            const copyBtn = document.getElementById('copy-quote-btn');
            if (copyBtn) {
                const originalText = copyBtn.innerHTML;
                copyBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';
                copyBtn.classList.add('success');
                
                setTimeout(() => {
                    copyBtn.innerHTML = originalText;
                    copyBtn.classList.remove('success');
                }, 2000);
            }
            
            this.showSuccessNotification('Quote Copied!', 'Quote text copied to clipboard successfully.');
            
        }).catch(error => {
            console.error('[EmbroideryQuoteBuilder] Copy failed:', error);
            this.showErrorNotification('Copy Failed', 'Failed to copy quote to clipboard.');
        });
    }
    
    /**
     * Handle print quote
     */
    handlePrintQuote() {
        if (!this.currentPricing) {
            this.showErrorNotification('No Quote Data', 'Please complete your quote first.');
            return;
        }
        
        console.log('[EmbroideryQuoteBuilder] Handling print quote...');
        
        const quoteId = this.currentPricing.quoteId || this.quoteService.generateQuoteId();
        const customerData = this.getCustomerData();
        const printContent = this.generatePrintHTML(quoteId, customerData, this.currentPricing);
        
        const printWindow = window.open('', '_blank');
        printWindow.document.write(printContent);
        printWindow.document.close();
        
        printWindow.onload = () => {
            printWindow.print();
            setTimeout(() => printWindow.close(), 500);
        };
    }
    
    /**
     * Generate quote text for copying - Professional format
     */
    generateQuoteText() {
        if (!this.currentPricing) return '';
        
        const quoteId = this.currentPricing.quoteId || this.quoteService.generateQuoteId();
        const customerData = this.getCustomerData();
        const currentDate = new Date().toLocaleDateString('en-US');
        
        let text = '';
        
        // Header
        text += `NORTHWEST CUSTOM APPAREL\n`;
        text += `2025 Freeman Road East, Milton, WA 98354\n`;
        text += `Phone: (253) 922-5793 | Email: sales@nwcustomapparel.com\n`;
        text += `\n`;
        
        // Quote Header
        text += `EMBROIDERY QUOTE\n`;
        text += `Quote ID: ${quoteId}\n`;
        text += `Date: ${currentDate}\n`;
        text += `Valid for: 30 days\n`;
        text += `\n`;
        
        // Customer Info
        text += `CUSTOMER INFORMATION:\n`;
        text += `Name: ${customerData.name}\n`;
        if (customerData.company) text += `Company: ${customerData.company}\n`;
        text += `Email: ${customerData.email}\n`;
        if (customerData.phone) text += `Phone: ${customerData.phone}\n`;
        if (customerData.project) text += `Project: ${customerData.project}\n`;
        text += `\n`;
        
        // Embroidery Specifications
        text += `EMBROIDERY SPECIFICATIONS:\n`;
        this.currentPricing.logos.forEach((logo, idx) => {
            const isPrimary = idx === 0;
            text += `• ${logo.position} (${logo.stitchCount.toLocaleString()} stitches)`;
            text += isPrimary ? ' - INCLUDED IN BASE PRICE' : ' - ADDITIONAL LOGO';
            if (logo.needsDigitizing) text += ' [+$100 Digitizing]';
            text += `\n`;
        });
        if (this.currentPricing.ltmFee > 0) {
            const ltmPerPiece = (this.currentPricing.ltmFee / this.currentPricing.totalQuantity).toFixed(2);
            text += `• Small Batch Fee - ADDITIONAL (+$${ltmPerPiece} per piece)\n`;
        }
        text += `\n`;
        
        // Products
        text += `PRODUCTS:\n`;
        this.currentPricing.products.forEach(pp => {
            text += `${pp.product.style} - ${pp.product.color} (${pp.product.totalQuantity} pieces)\n`;
            text += `  ${pp.product.title}\n`;
            pp.lineItems.forEach(item => {
                const displayPrice = item.unitPriceWithLTM || item.unitPrice;
                text += `  ${item.description}: ${item.quantity} @ $${displayPrice.toFixed(2)} = $${item.total.toFixed(2)}\n`;
            });
            text += `  Subtotal: $${pp.subtotal.toFixed(2)}\n\n`;
        });
        
        // Additional Services
        if (this.currentPricing.additionalServices && this.currentPricing.additionalServices.length > 0) {
            text += `ADDITIONAL SERVICES:\n`;
            this.currentPricing.additionalServices.forEach(service => {
                text += `${service.description}: ${service.quantity} @ $${service.unitPrice.toFixed(2)} = $${service.total.toFixed(2)}\n`;
            });
            text += `\n`;
        }
        
        // Totals
        const subtotalBeforeTax = this.currentPricing.subtotal + 
                                  (this.currentPricing.additionalServicesTotal || 0) + 
                                  this.currentPricing.setupFees + 
                                  (this.currentPricing.ltmFee || 0);
        const salesTax = subtotalBeforeTax * 0.101;
        const grandTotalWithTax = subtotalBeforeTax + salesTax;
        
        text += `TOTALS:\n`;
        text += `Products & Primary Embroidery: $${this.currentPricing.subtotal.toFixed(2)}\n`;
        if (this.currentPricing.additionalServicesTotal > 0) {
            text += `Additional Services: $${this.currentPricing.additionalServicesTotal.toFixed(2)}\n`;
        }
        if (this.currentPricing.setupFees > 0) {
            text += `Setup Fees: $${this.currentPricing.setupFees.toFixed(2)}\n`;
        }
        if (this.currentPricing.ltmFee > 0) {
            text += `Small Batch Fee: $${this.currentPricing.ltmFee.toFixed(2)}\n`;
        }
        text += `Subtotal: $${subtotalBeforeTax.toFixed(2)}\n`;
        text += `Milton, WA Sales Tax (10.1%): $${salesTax.toFixed(2)}\n`;
        text += `GRAND TOTAL: $${grandTotalWithTax.toFixed(2)}\n`;
        text += `\n`;
        
        // Terms
        text += `TERMS & CONDITIONS:\n`;
        text += `• This quote is valid for 30 days\n`;
        text += `• 50% deposit required to begin production\n`;
        text += `• Production time: 14 business days after order and art approval\n`;
        text += `• Rush production available (7 business days) - add 25%\n`;
        text += `• Prices subject to change based on final artwork requirements\n`;
        text += `\n`;
        text += `Thank you for choosing Northwest Custom Apparel!\n`;
        
        return text;
    }
    
    /**
     * Handle new quote
     */
    handleNewQuote() {
        if (confirm('Start a new quote? Any unsaved changes will be lost.')) {
            localStorage.removeItem('EMB_draft');
            location.reload();
        }
    }
    
    /**
     * Generate professional print HTML
     */
    generatePrintHTML(quoteId, customerData, pricing) {
        if (!pricing) return '';
        
        const currentDate = new Date().toLocaleDateString();
        
        let html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Embroidery Quote ${quoteId}</title>
                <style>
                    @page { 
                        margin: 0.5in;
                        size: letter;
                    }
                    body { 
                        font-family: Arial, sans-serif; 
                        font-size: 12px;
                        line-height: 1.4; 
                        color: #333;
                        margin: 0;
                    }
                    
                    /* Compact invoice header */
                    .invoice-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: flex-start;
                        margin-bottom: 20px;
                        padding-bottom: 10px;
                        border-bottom: 2px solid #4cb354;
                    }
                    .company-info {
                        flex: 1;
                    }
                    .logo {
                        max-width: 150px;
                        height: auto;
                        margin-bottom: 5px;
                    }
                    .company-info p {
                        margin: 2px 0;
                        font-size: 11px;
                        color: #555;
                    }
                    .invoice-title {
                        text-align: right;
                        flex: 1;
                    }
                    .invoice-title h1 {
                        margin: 0;
                        font-size: 24px;
                        color: #333;
                    }
                    .invoice-title .quote-id {
                        font-size: 16px;
                        color: #4cb354;
                        margin: 5px 0;
                    }
                    .invoice-title p {
                        margin: 2px 0;
                        font-size: 11px;
                        color: #555;
                    }
                    
                    /* Customer info box */
                    .info-row {
                        display: flex;
                        gap: 20px;
                        margin-bottom: 20px;
                    }
                    .info-box {
                        flex: 1;
                        background: #f8f9fa;
                        padding: 10px;
                        border: 1px solid #ddd;
                        border-radius: 4px;
                    }
                    .info-box h3 {
                        margin: 0 0 8px 0;
                        font-size: 11px;
                        color: #4cb354;
                        text-transform: uppercase;
                        border-bottom: 1px solid #eee;
                        padding-bottom: 3px;
                    }
                    .info-box p {
                        margin: 2px 0;
                        font-size: 11px;
                    }
                    
                    /* Package breakdown */
                    .package-breakdown {
                        background: #f0f8f0;
                        border: 1px solid #4cb354;
                        padding: 10px;
                        border-radius: 4px;
                        margin-bottom: 20px;
                    }
                    .package-breakdown h3 {
                        margin: 0 0 8px 0;
                        font-size: 13px;
                        color: #4cb354;
                        text-transform: uppercase;
                    }
                    .package-breakdown p {
                        margin: 3px 0;
                        font-size: 11px;
                    }
                    
                    /* Products table */
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-bottom: 15px;
                        font-size: 11px;
                    }
                    th {
                        background: #4cb354;
                        color: white;
                        padding: 6px 8px;
                        text-align: left;
                        font-size: 10px;
                        text-transform: uppercase;
                        border: 1px solid #ddd;
                    }
                    td {
                        padding: 6px 8px;
                        border: 1px solid #ddd;
                        vertical-align: top;
                    }
                    tr:nth-child(even) {
                        background-color: #f9f9f9;
                    }
                    .total-row {
                        background: #f8f9fa !important;
                        font-weight: bold;
                    }
                    .grand-total-row {
                        background: #e8f5e9 !important;
                        font-weight: bold;
                        font-size: 12px;
                    }
                    
                    /* Terms section */
                    .terms {
                        background: #f8f9fa;
                        padding: 10px;
                        border-radius: 4px;
                        margin-top: 15px;
                    }
                    .terms h3 {
                        margin: 0 0 8px 0;
                        font-size: 12px;
                        color: #4cb354;
                    }
                    .terms ul {
                        margin: 0;
                        padding-left: 15px;
                        font-size: 10px;
                        line-height: 1.5;
                    }
                    .terms li {
                        margin-bottom: 3px;
                    }
                    
                    /* Footer */
                    .footer {
                        text-align: center;
                        margin-top: 20px;
                        padding-top: 10px;
                        border-top: 1px solid #ddd;
                    }
                    .footer p {
                        margin: 3px 0;
                        font-size: 10px;
                        color: #666;
                    }
                    .footer .thank-you {
                        color: #4cb354;
                        font-weight: bold;
                        font-size: 11px;
                    }
                    
                    @media print {
                        .invoice-header {
                            break-after: avoid;
                        }
                        table {
                            break-inside: avoid;
                        }
                    }
                </style>
            </head>
            <body>
                <!-- Compact header with logo and invoice info side by side -->
                <div class="invoice-header">
                    <div class="company-info">
                        <img src="https://cdn.caspio.com/A0E15000/Safety%20Stripes/web%20northwest%20custom%20apparel%20logo.png?ver=1" 
                             alt="Northwest Custom Apparel" class="logo">
                        <p>2025 Freeman Road East, Milton, WA 98354</p>
                        <p>Phone: (253) 922-5793 | sales@nwcustomapparel.com</p>
                    </div>
                    <div class="invoice-title">
                        <h1>QUOTE</h1>
                        <div class="quote-id">${quoteId}</div>
                        <p>Date: ${currentDate}</p>
                        <p>Valid for: 30 days</p>
                    </div>
                </div>
                
                <!-- Customer and project info -->
                <div class="info-row">
                    <div class="info-box">
                        <h3>Customer Information</h3>
                        <p><strong>${customerData.name || 'Customer'}</strong></p>
                        ${customerData.company ? `<p>${customerData.company}</p>` : ''}
                        <p>${customerData.email || ''}</p>
                        <p>${customerData.phone || ''}</p>
                    </div>
                    <div class="info-box">
                        <h3>Project Details</h3>
                        <p><strong>Type:</strong> Embroidery Contract</p>
                        ${customerData.project ? `<p><strong>Project:</strong> ${customerData.project}</p>` : ''}
                        <p><strong>Total Pieces:</strong> ${pricing.totalQuantity || 0}</p>
                        <p><strong>Total Stitches:</strong> ${pricing.totalStitches?.toLocaleString() || 0}</p>
                        <p><strong>Quote Prepared By:</strong> General Sales</p>
                    </div>
                </div>
                
                <!-- Embroidery Package Breakdown -->
                <div class="package-breakdown">
                    <h3>Embroidery Package for This Order:</h3>
        `;
        
        // Build the embroidery package details
        if (pricing.logos && pricing.logos.length > 0) {
            pricing.logos.forEach((logo, index) => {
                const isPrimary = logo.isPrimary !== false;
                const logoType = isPrimary ? 'PRIMARY LOGO - INCLUDED IN BASE PRICE' : `ADDITIONAL LOGO ${index}`;
                
                html += `<p>✓ <strong>${logo.position}</strong> (${logo.stitchCount.toLocaleString()} stitches) - <em>${logoType}</em></p>`;
                
                if (logo.needsDigitizing) {
                    html += `<p style="margin-left: 15px; color: #666;">• Digitizing Fee: $100.00</p>`;
                }
            });
        }
        
        html += `</div>`;
        
        // Products Table
        html += `
                <table>
                    <thead>
                        <tr>
                            <th style="width: 45%;">DESCRIPTION</th>
                            <th style="width: 15%; text-align: center;">QUANTITY</th>
                            <th style="width: 20%; text-align: right;">UNIT PRICE</th>
                            <th style="width: 20%; text-align: right;">TOTAL</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        // Add each product
        if (pricing.products && pricing.products.length > 0) {
            pricing.products.forEach(productPricing => {
                const product = productPricing.product;
                
                // Group regular sizes
                const regularSizes = productPricing.lineItems.filter(item => {
                    const desc = item.description || '';
                    return !desc.includes('2XL') && !desc.includes('3XL') && 
                           !desc.includes('4XL') && !desc.includes('5XL') && !desc.includes('6XL');
                });
                
                if (regularSizes.length > 0) {
                    const totalQty = regularSizes.reduce((sum, item) => sum + item.quantity, 0);
                    const totalAmount = regularSizes.reduce((sum, item) => sum + item.total, 0);
                    const unitPrice = regularSizes[0].unitPriceWithLTM || regularSizes[0].unitPrice;
                    
                    html += `
                        <tr>
                            <td>
                                <strong>${product.style} - ${product.color}</strong><br>
                                ${product.title}<br>
                                <span style="color: #666; font-size: 10px;">
                                    Regular sizes (S-XL)<br>
                                    ${pricing.logos ? pricing.logos.length + ' logo position(s)' : ''}
                                </span>
                            </td>
                            <td style="text-align: center;">${totalQty}</td>
                            <td style="text-align: right;">$${unitPrice.toFixed(2)}</td>
                            <td style="text-align: right;">$${totalAmount.toFixed(2)}</td>
                        </tr>
                    `;
                }
                
                // Show each extended size separately
                const extendedSizes = productPricing.lineItems.filter(item => {
                    const desc = item.description || '';
                    return desc.includes('2XL') || desc.includes('3XL') || 
                           desc.includes('4XL') || desc.includes('5XL') || desc.includes('6XL');
                });
                
                extendedSizes.forEach(item => {
                    const displayPrice = item.unitPriceWithLTM || item.unitPrice;
                    html += `
                        <tr>
                            <td>
                                <strong>${product.style} - ${product.color}</strong><br>
                                ${product.title}<br>
                                <span style="color: #666; font-size: 10px;">
                                    Size: ${item.description}<br>
                                    ${pricing.logos ? pricing.logos.length + ' logo position(s)' : ''}
                                </span>
                            </td>
                            <td style="text-align: center;">${item.quantity}</td>
                            <td style="text-align: right;">$${displayPrice.toFixed(2)}</td>
                            <td style="text-align: right;">$${item.total.toFixed(2)}</td>
                        </tr>
                    `;
                });
            });
        }
        
        // Add additional services if any
        if (pricing.additionalServices && pricing.additionalServices.length > 0) {
            pricing.additionalServices.forEach(service => {
                const desc = service.type === 'monogram' 
                    ? 'Personalized Names/Monogramming'
                    : service.description.replace(/AL-\d+\s*/g, '');
                
                html += `
                    <tr>
                        <td>
                            <strong>${desc}</strong><br>
                            <span style="color: #666; font-size: 10px;">Additional service</span>
                        </td>
                        <td style="text-align: center;">${service.quantity}</td>
                        <td style="text-align: right;">$${service.unitPrice.toFixed(2)}</td>
                        <td style="text-align: right;">$${service.total.toFixed(2)}</td>
                    </tr>
                `;
            });
        }
        
        // Calculate totals - LTM fee is already included in pricing.subtotal
        const subtotal = pricing.subtotal + (pricing.additionalServicesTotal || 0) + pricing.setupFees;
        const salesTax = subtotal * 0.101; // 10.1% Milton, WA sales tax
        const finalTotal = subtotal + salesTax;
        
        // Add totals rows
        html += `
                    </tbody>
                    <tfoot>
                        <tr class="total-row">
                            <td colspan="3" style="text-align: right; font-size: 12px;">
                                <strong>Subtotal (${pricing.totalQuantity || 0} pieces):</strong>
                            </td>
                            <td style="text-align: right; font-size: 12px;">
                                <strong>$${subtotal.toFixed(2)}</strong>
                            </td>
                        </tr>
                        <tr>
                            <td colspan="3" style="text-align: right;">
                                Milton, WA Sales Tax (10.1%):
                            </td>
                            <td style="text-align: right;">
                                $${salesTax.toFixed(2)}
                            </td>
                        </tr>
                        <tr class="grand-total-row">
                            <td colspan="3" style="text-align: right; font-size: 14px;">
                                <strong>GRAND TOTAL:</strong>
                            </td>
                            <td style="text-align: right; font-size: 14px; color: #4cb354;">
                                <strong>$${finalTotal.toFixed(2)}</strong>
                            </td>
                        </tr>
                    </tfoot>
                </table>
                
                <!-- Special Notes -->
        `;
        
        const notes = customerData.notes || document.getElementById('quote-notes')?.value?.trim();
        if (notes) {
            html += `
                <div style="background: #fff9c4; border: 1px solid #f9a825; padding: 10px; border-radius: 4px; margin-bottom: 15px;">
                    <h3 style="margin: 0 0 8px 0; color: #f9a825; font-size: 12px;">Special Notes</h3>
                    <p style="margin: 0; font-size: 11px; color: #666;">${notes}</p>
                </div>
            `;
        }
        
        // Terms & Conditions
        html += `
                <div class="terms">
                    <h3>Terms & Conditions:</h3>
                    <ul>
                        <li>This quote is valid for 30 days from the date of issue</li>
                        <li>50% deposit required to begin production</li>
                        <li>Production time: 14 business days after order and art approval</li>
                        <li>Rush production available (7 business days) - add 25%</li>
                        <li>Prices subject to change based on final artwork requirements</li>
                        <li>Digitizing fees are one-time charges for new artwork</li>
                    </ul>
                </div>
                
                <div class="footer">
                    <p class="thank-you">Thank you for choosing Northwest Custom Apparel!</p>
                    <p>Northwest Custom Apparel | Since 1977 | 2025 Freeman Road East, Milton, WA 98354 | (253) 922-5793</p>
                </div>
            </body>
            </html>
        `;
        
        return html;
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
        if (!this.currentPricing) {
            this.showErrorNotification('No Quote Data', 'Please complete your quote first.');
            return;
        }
        
        console.log('[EmbroideryQuoteBuilder] Handling print quote...');
        
        const quoteId = this.currentPricing.quoteId || this.quoteService.generateQuoteId();
        const customerData = this.getCustomerData();
        const printContent = this.generatePrintHTML(quoteId, customerData, this.currentPricing);
        
        const printWindow = window.open('', '_blank');
        printWindow.document.write(printContent);
        printWindow.document.close();
        
        printWindow.onload = () => {
            printWindow.print();
            setTimeout(() => printWindow.close(), 500);
        };
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
     * Show success notification (replacing modal)
     */
    showSuccessNotification(title, message) {
        this.showToast('success', title, message);
    }
    
    /**
     * Show error notification
     */
    showErrorNotification(title, message) {
        this.showToast('error', title, message);
    }
    
    /**
     * Show toast notification
     */
    showToast(type, title, message) {
        const container = document.getElementById('toast-container');
        if (!container) return;
        
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <div class="toast-header">
                <i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i>
                <strong>${title}</strong>
                <button class="toast-close" onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
            <div class="toast-body">${message}</div>
        `;
        
        // Add styles
        toast.style.cssText = `
            background: ${type === 'success' ? '#d4edda' : '#f8d7da'};
            border: 1px solid ${type === 'success' ? '#c3e6cb' : '#f5c6cb'};
            color: ${type === 'success' ? '#155724' : '#721c24'};
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 10px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            min-width: 300px;
            animation: slideIn 0.3s ease-out;
        `;
        
        // Add animation styles
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            .toast-header {
                display: flex;
                align-items: center;
                gap: 8px;
                margin-bottom: 5px;
            }
            .toast-close {
                margin-left: auto;
                background: none;
                border: none;
                font-size: 18px;
                cursor: pointer;
            }
        `;
        document.head.appendChild(style);
        
        container.appendChild(toast);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (toast.parentElement) {
                toast.remove();
            }
        }, 5000);
    }
    
    /**
     * Show/hide loading with message
     */
    showLoading(show, message = 'Loading...') {
        let overlay = document.getElementById('loading-overlay');
        
        if (show && !overlay) {
            // Create loading overlay if it doesn't exist
            overlay = document.createElement('div');
            overlay.id = 'loading-overlay';
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 9999;
                color: white;
                font-size: 18px;
            `;
            overlay.innerHTML = `
                <div style="text-align: center;">
                    <div style="border: 4px solid #f3f3f3; border-top: 4px solid #4cb354; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 0 auto 10px;"></div>
                    <div id="loading-message">${message}</div>
                </div>
            `;
            
            // Add spin animation
            const style = document.createElement('style');
            style.textContent = '@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }';
            document.head.appendChild(style);
            
            document.body.appendChild(overlay);
        }
        
        if (overlay) {
            if (show) {
                const messageEl = overlay.querySelector('#loading-message');
                if (messageEl) messageEl.textContent = message;
                overlay.style.display = 'flex';
            } else {
                overlay.style.display = 'none';
            }
        }
    }
}

// Global functions for UI callbacks
function closeSuccessModal() {
    document.getElementById('success-modal').style.display = 'none';
}

// Make available globally
window.EmbroideryQuoteBuilder = EmbroideryQuoteBuilder;