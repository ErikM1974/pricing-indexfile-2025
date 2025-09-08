/**
 * Cap Quote Builder - Main Controller
 * Orchestrates the complete cap embroidery quote workflow
 * NO FALLBACKS - Visible error handling throughout
 */

class CapQuoteBuilder {
    constructor() {
        this.currentPhase = 1;
        this.currentQuote = null;
        this.isInitialized = false;
        
        // Initialize EmailJS
        emailjs.init('4qSbDO-SQs19TbP80');
        
        this.emailConfig = {
            serviceId: 'service_1c4k67j',
            templateId: null // To be set when template is created
        };
        
        // Initialize components
        this.initializeComponents();
        this.bindEvents();
        
        console.log('[CapQuoteBuilder] Initialized');
    }
    
    /**
     * Initialize all components
     */
    async initializeComponents() {
        try {
            console.log('[CapQuoteBuilder] Initializing components...');
            
            // Initialize core managers
            this.logoManager = new CapLogoManager();
            this.productManager = new CapProductLineManager();
            this.pricingCalculator = new CapQuotePricingCalculator();
            this.quoteService = new CapQuoteService();
            
            // Wait for logo manager to load positions
            await this.waitForLogoManager();
            
            this.isInitialized = true;
            console.log('[CapQuoteBuilder] ✅ All components initialized');
            
        } catch (error) {
            console.error('[CapQuoteBuilder] ❌ Component initialization failed:', error);
            
            if (typeof window !== 'undefined' && window.showErrorBanner) {
                window.showErrorBanner('CAP QUOTE BUILDER INITIALIZATION FAILED - Please refresh the page');
            }
            
            throw error;
        }
    }
    
    /**
     * Wait for logo manager to finish loading
     */
    async waitForLogoManager() {
        let attempts = 0;
        const maxAttempts = 10;
        
        while (attempts < maxAttempts) {
            if (this.logoManager && this.logoManager.availablePositions.length > 0) {
                console.log('[CapQuoteBuilder] Logo manager ready');
                return;
            }
            
            await new Promise(resolve => setTimeout(resolve, 500));
            attempts++;
        }
        
        console.warn('[CapQuoteBuilder] Logo manager took longer than expected to load');
    }
    
    /**
     * Bind event handlers
     */
    bindEvents() {
        // Phase navigation
        document.getElementById('back-to-logos')?.addEventListener('click', () => {
            this.goToPhase(1);
        });
        
        document.getElementById('back-to-products')?.addEventListener('click', () => {
            this.goToPhase(2);
        });
        
        document.getElementById('continue-to-summary')?.addEventListener('click', () => {
            this.continueToSummaryPhase();
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
        
        // Listen for component events
        window.addEventListener('capLogosChanged', (e) => {
            this.handleLogosChanged(e.detail);
        });
        
        window.addEventListener('capProductsChanged', (e) => {
            this.handleProductsChanged(e.detail);
        });
    }
    
    /**
     * Navigate to specific phase
     */
    goToPhase(phase) {
        console.log('[CapQuoteBuilder] Navigating to phase:', phase);
        
        // Hide all phases
        document.querySelectorAll('.phase-section').forEach(section => {
            section.style.display = 'none';
        });
        
        // Remove active class from all nav steps
        document.querySelectorAll('.phase-step').forEach(step => {
            step.classList.remove('active');
        });
        
        // Show target phase
        const targetPhase = document.getElementById(`${this.getPhaseId(phase)}-phase`);
        if (targetPhase) {
            targetPhase.style.display = 'block';
        }
        
        // Activate nav step
        const navStep = document.getElementById(`phase-${phase}-nav`);
        if (navStep) {
            navStep.classList.add('active');
        }
        
        this.currentPhase = phase;
    }
    
    /**
     * Get phase ID from phase number
     */
    getPhaseId(phase) {
        const phaseIds = { 1: 'logo', 2: 'product', 3: 'summary' };
        return phaseIds[phase] || 'logo';
    }
    
    /**
     * Continue to products phase (called from logo manager)
     */
    continueToProductsPhase() {
        if (!this.logoManager) {
            console.error('[CapQuoteBuilder] Logo manager not available');
            return;
        }
        
        const logos = this.logoManager.getLogos();
        if (logos.length === 0) {
            alert('Please define at least the front logo before continuing');
            return;
        }
        
        console.log('[CapQuoteBuilder] Continuing to products with logos:', logos.length);
        this.goToPhase(2);
    }
    
    /**
     * Continue to summary phase
     */
    async continueToSummaryPhase() {
        console.log('[CapQuoteBuilder] Preparing summary phase...');
        
        if (!this.productManager) {
            console.error('[CapQuoteBuilder] Product manager not available');
            return;
        }
        
        const products = this.productManager.getProducts();
        if (products.length === 0) {
            alert('Please add at least one cap before continuing');
            return;
        }
        
        try {
            // Calculate pricing
            await this.calculateAndDisplayQuote();
            this.goToPhase(3);
            
        } catch (error) {
            console.error('[CapQuoteBuilder] ❌ Failed to prepare summary:', error);
            
            if (typeof window !== 'undefined' && window.showErrorBanner) {
                window.showErrorBanner(`QUOTE CALCULATION FAILED: ${error.message}`);
            }
            
            alert(`Failed to calculate quote: ${error.message}`);
        }
    }
    
    /**
     * Calculate pricing and display quote summary
     */
    async calculateAndDisplayQuote() {
        console.log('[CapQuoteBuilder] Calculating quote pricing...');
        
        if (!this.logoManager || !this.productManager || !this.pricingCalculator) {
            throw new Error('Required components not initialized');
        }
        
        try {
            const logos = this.logoManager.getLogos();
            const products = this.productManager.getProducts();
            
            if (logos.length === 0) {
                throw new Error('No logos defined');
            }
            
            if (products.length === 0) {
                throw new Error('No products added');
            }
            
            console.log('[CapQuoteBuilder] Calculating pricing for:', products.length, 'caps,', logos.length, 'logos');
            
            // Calculate complete pricing
            this.currentQuote = await this.pricingCalculator.calculateCapQuotePricing(products, logos);
            
            // Add logo and customer info
            this.currentQuote.logos = logos;
            this.currentQuote.customerInfo = {}; // Will be filled from form
            
            console.log('[CapQuoteBuilder] ✅ Quote calculated successfully');
            console.log('[CapQuoteBuilder] Total:', '$' + this.currentQuote.grandTotal.toFixed(2));
            
            // Generate and display quote summary
            this.renderQuoteSummary();
            
        } catch (error) {
            console.error('[CapQuoteBuilder] Quote calculation error:', error);
            throw error;
        }
    }
    
    /**
     * Render quote summary in phase 3
     */
    renderQuoteSummary() {
        const summaryContainer = document.getElementById('quote-summary');
        if (!summaryContainer || !this.currentQuote) return;
        
        console.log('[CapQuoteBuilder] Rendering quote summary...');
        
        let html = '<div class="quote-summary-content">';
        
        // Header
        html += `
            <div class="summary-header">
                <h3>Cap Embroidery Quote Summary</h3>
                <div class="quote-meta">
                    <span>Total Pieces: <strong>${this.currentQuote.totalQuantity}</strong></span>
                    <span>Tier: <strong>${this.currentQuote.tier}</strong></span>
                </div>
            </div>
        `;
        
        // Logos section with PRIMARY/ADDITIONAL badges
        html += '<div class="summary-section">';
        html += '<h4><i class="fas fa-thread"></i> Embroidery Specifications</h4>';
        this.currentQuote.logos.forEach((logo, idx) => {
            const isPrimary = logo.isRequired || idx === 0; // Front logo is primary
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
        
        if (this.currentQuote.hasLTM) {
            html += '<p class="ltm-notice"><i class="fas fa-info-circle"></i> Includes small batch pricing for orders under 24 pieces</p>';
        }
        
        html += '</div>';
        
        // Products section with images
        html += '<div class="summary-section">';
        html += '<h4><i class="fas fa-hat-cowboy"></i> Caps</h4>';
        
        this.currentQuote.products.forEach(product => {
            html += `
                <div class="product-summary">
                    <div class="product-header">
                        <img src="${product.imageUrl || 'https://via.placeholder.com/150x150/4cb354/white?text=' + encodeURIComponent(product.styleNumber)}" 
                             alt="${product.styleNumber} - ${product.color}"
                             onerror="this.src='https://via.placeholder.com/150x150/4cb354/white?text=' + encodeURIComponent('${product.styleNumber}')">
                        <div class="product-info">
                            <strong>${product.styleNumber} - ${product.color}</strong>
                            <span>${product.title}</span>
                            <span>${product.brand}</span>
                            <span>${product.totalQuantity} pieces total</span>
                        </div>
                    </div>
                    <div class="product-lines">
            `;
            
            // Show size breakdown with upcharges and detailed cap/embroidery/extra stitches breakdown
            product.sizePricedItems.forEach(item => {
                const upchargeNote = item.sizeUpcharge > 0 ? ` (+$${item.sizeUpcharge.toFixed(2)} upcharge)` : '';
                
                // Calculate LTM breakdown for display (item.unitPrice already includes LTM)
                const ltmPerPiece = this.currentQuote.hasLTM ? this.currentQuote.ltmFeeTotal / this.currentQuote.totalQuantity : 0;
                const totalPerPiece = item.unitPrice; // Already includes LTM from pricing calculation
                const adjustedTotal = item.total; // Use the correct calculated total
                
                // Get cap price and embroidery breakdown from product pricingBreakdown
                const capPrice = product.pricingBreakdown?.capPrice || 0;
                const frontEmbroideryPrice = product.pricingBreakdown?.frontEmbroideryPrice || 0;
                
                // Get front logo breakdown for extra stitch display
                const frontBreakdown = product.pricingBreakdown?.frontLogoBreakdown;
                const hasExtraStitches = frontBreakdown?.hasExtraStitches;
                const extraStitchCost = frontBreakdown?.extraStitchCost || 0;
                
                // Calculate base price (cap + base embroidery, rounded)
                const baseEmbroideryPrice = hasExtraStitches ? frontEmbroideryPrice - extraStitchCost : frontEmbroideryPrice;
                const basePrice = Math.ceil(capPrice + baseEmbroideryPrice);
                
                if (this.currentQuote.hasLTM && ltmPerPiece > 0) {
                    // Show simplified breakdown when LTM applies
                    let breakdownText = '';
                    
                    if (hasExtraStitches && extraStitchCost > 0) {
                        breakdownText = `Base: $${basePrice.toFixed(2)} + Extra stitches: $${extraStitchCost.toFixed(2)} + Small batch: $${ltmPerPiece.toFixed(2)} = $${totalPerPiece.toFixed(2)} each`;
                    } else {
                        breakdownText = `Base: $${basePrice.toFixed(2)} + Small batch: $${ltmPerPiece.toFixed(2)} = $${totalPerPiece.toFixed(2)} each`;
                    }
                    
                    html += `
                        <div class="line-item">
                            <span>${item.size}${upchargeNote} (${item.quantity} pieces)</span>
                            <span class="ltm-breakdown">
                                ${breakdownText}
                            </span>
                            <span class="line-total">$${adjustedTotal.toFixed(2)}</span>
                        </div>
                    `;
                } else {
                    // Show breakdown for 24+ pieces (no LTM) with extra stitches if applicable
                    if (hasExtraStitches && extraStitchCost > 0) {
                        const breakdownText = `Base: $${basePrice.toFixed(2)} + Extra stitches: $${extraStitchCost.toFixed(2)} = $${item.unitPrice.toFixed(2)} each`;
                        
                        html += `
                            <div class="line-item">
                                <span>${item.size}${upchargeNote} (${item.quantity} pieces)</span>
                                <span class="ltm-breakdown">
                                    ${breakdownText}
                                </span>
                                <span class="line-total">$${item.total.toFixed(2)}</span>
                            </div>
                        `;
                    } else {
                        // Standard display for 24+ pieces with no extra stitches
                        html += `
                            <div class="line-item">
                                <span>${item.size}${upchargeNote} (${item.quantity} pieces)</span>
                                <span>@ $${item.unitPrice.toFixed(2)} each</span>
                                <span class="line-total">$${item.total.toFixed(2)}</span>
                            </div>
                        `;
                    }
                }
            });
            
            html += `
                    </div>
                    <div class="product-subtotal">
                        Subtotal: <strong>$${product.lineTotal.toFixed(2)}</strong>
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        
        // Additional Logo Embroidery section (if applicable)
        if (this.currentQuote.additionalEmbroideryTotal && this.currentQuote.additionalEmbroideryTotal > 0) {
            html += '<div class="summary-section">';
            html += '<h4><i class="fas fa-plus-circle"></i> Additional Logo Embroidery</h4>';
            
            // Show additional logos with their individual costs
            const additionalLogos = this.currentQuote.logos.filter((logo, idx) => 
                !logo.isRequired && idx > 0
            );
            
            if (additionalLogos.length > 0) {
                // Get individual logo pricing from the first product's breakdown
                const individualLogoPrices = this.currentQuote.products[0]?.pricingBreakdown?.additionalLogoPrices || [];
                
                additionalLogos.forEach((logo, index) => {
                    // Find the matching individual logo price or fallback to equal division
                    const logoData = individualLogoPrices.find(lp => lp.position === logo.position) || 
                                   { pricePerPiece: (this.currentQuote.products[0]?.pricingBreakdown?.additionalEmbroideryPrice || 0) / additionalLogos.length };
                    
                    const additionalCostPerPiece = logoData.pricePerPiece;
                    html += `
                        <div class="additional-service-item">
                            <div class="service-header">
                                <span class="service-name">${logo.position} - ${logo.stitchCount.toLocaleString()} stitches</span>
                                <span class="badge badge-additional">ADDITIONAL</span>
                            </div>
                            <div class="service-details">
                                <span>${this.currentQuote.totalQuantity} pieces</span>
                                <span>@ $${additionalCostPerPiece.toFixed(2)} each</span>
                                <span class="service-total">$${(additionalCostPerPiece * this.currentQuote.totalQuantity).toFixed(2)}</span>
                            </div>
                        </div>
                    `;
                });
                
                // Add subtotal for additional logo embroidery
                html += `
                    <div style="text-align: right; margin-top: 15px; padding-top: 10px; border-top: 1px solid var(--border-color);">
                        <strong>Additional Logo Subtotal: $${this.currentQuote.additionalEmbroideryTotal.toFixed(2)}</strong>
                    </div>
                `;
            }
            
            html += '</div>';
        }
        
        // Totals section with detailed breakdown
        html += `
            <div class="summary-section totals-section">
                <h4><i class="fas fa-calculator"></i> Quote Totals</h4>
                <div class="totals-breakdown">
                    <div class="total-line">
                        <span>Caps & Front Embroidery${this.currentQuote.hasLTM ? ' (includes small batch)' : ''}:</span>
                        <span>$${this.currentQuote.subtotal.toFixed(2)}</span>
                    </div>
        `;
        
        // Additional embroidery total (if any)
        if (this.currentQuote.additionalEmbroideryTotal && this.currentQuote.additionalEmbroideryTotal > 0) {
            html += `
                <div class="total-line">
                    <span>Additional Logo Embroidery:</span>
                    <span>$${this.currentQuote.additionalEmbroideryTotal.toFixed(2)}</span>
                </div>
            `;
        }
        
        if (this.currentQuote.setupFees > 0) {
            const digitizingLogos = this.currentQuote.logos.filter(l => l.needsDigitizing).length;
            html += `
                <div class="total-line">
                    <span>Setup Fees (${digitizingLogos} logos):</span>
                    <span>$${this.currentQuote.setupFees.toFixed(2)}</span>
                </div>
            `;
        }
        
        // Small Batch Fee is now included in the per-piece pricing above, so no separate line needed
        
        html += `
                    <div class="total-line grand-total">
                        <span><strong>GRAND TOTAL:</strong></span>
                        <span><strong>$${this.currentQuote.grandTotal.toFixed(2)}</strong></span>
                    </div>
                </div>
            </div>
        `;
        
        html += '</div>'; // Close quote-summary-content
        
        summaryContainer.innerHTML = html;
        
        console.log('[CapQuoteBuilder] Quote summary rendered with images and badges');
    }
    
    /**
     * Handle save quote button
     */
    async handleSaveQuote() {
        console.log('[CapQuoteBuilder] Handling save quote...');
        
        if (!this.validateCustomerInfo()) return;
        
        try {
            this.showLoading(true, 'Saving quote...');
            
            // Collect customer information
            this.currentQuote.customerInfo = this.collectCustomerInfo();
            
            // Save to database if requested
            const saveToDb = document.getElementById('save-to-database')?.checked;
            let quoteID = null;
            
            if (saveToDb) {
                const saveResult = await this.quoteService.saveQuote(this.currentQuote);
                
                if (saveResult.success) {
                    quoteID = saveResult.quoteID;
                    console.log('[CapQuoteBuilder] ✅ Quote saved to database:', quoteID);
                } else {
                    console.error('[CapQuoteBuilder] Database save failed:', saveResult.error);
                    // Continue without failing - user still gets quote
                }
            } else {
                // Generate quote ID for display even if not saving
                quoteID = this.quoteService.generateQuoteID();
            }
            
            this.showSuccessModal(quoteID, this.currentQuote);
            
        } catch (error) {
            console.error('[CapQuoteBuilder] ❌ Save quote failed:', error);
            alert(`Failed to save quote: ${error.message}`);
        } finally {
            this.showLoading(false);
        }
    }
    
    /**
     * Handle email quote button
     */
    async handleEmailQuote() {
        console.log('[CapQuoteBuilder] Handling email quote...');
        
        if (!this.emailConfig.templateId) {
            alert('Email template not configured yet. Please save the quote for now.');
            return;
        }
        
        if (!this.validateCustomerInfo()) return;
        
        try {
            this.showLoading(true, 'Sending email...');
            
            // Collect customer information
            this.currentQuote.customerInfo = this.collectCustomerInfo();
            
            // Generate quote ID
            const quoteID = this.quoteService.generateQuoteID();
            
            // Build email data
            const emailData = this.buildEmailData(quoteID, this.currentQuote);
            
            // Send email
            await emailjs.send(
                this.emailConfig.serviceId,
                this.emailConfig.templateId,
                emailData
            );
            
            console.log('[CapQuoteBuilder] ✅ Quote email sent successfully');
            this.showSuccessModal(quoteID, this.currentQuote);
            
        } catch (error) {
            console.error('[CapQuoteBuilder] ❌ Email send failed:', error);
            alert(`Failed to send quote: ${error.message}`);
        } finally {
            this.showLoading(false);
        }
    }
    
    /**
     * Handle copy quote to clipboard
     */
    handleCopyQuote() {
        if (!this.currentQuote) return;
        
        const quoteText = this.generateQuoteText();
        
        navigator.clipboard.writeText(quoteText).then(() => {
            console.log('[CapQuoteBuilder] Quote copied to clipboard');
            
            // Show temporary feedback
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
            
        }).catch(error => {
            console.error('[CapQuoteBuilder] Copy failed:', error);
            alert('Failed to copy quote to clipboard');
        });
    }
    
    /**
     * Handle print quote
     */
    handlePrintQuote() {
        if (!this.currentQuote) return;
        
        const quoteId = this.quoteService.generateQuoteID();
        const printContent = this.generatePrintHTML(quoteId, this.currentQuote);
        
        const printWindow = window.open('', '_blank');
        printWindow.document.write(printContent);
        printWindow.document.close();
        
        printWindow.onload = () => {
            printWindow.print();
            setTimeout(() => printWindow.close(), 500);
        };
    }
    
    /**
     * Validate customer information
     */
    validateCustomerInfo() {
        const customerName = document.getElementById('customer-name')?.value.trim();
        const customerEmail = document.getElementById('customer-email')?.value.trim();
        const salesRep = document.getElementById('sales-rep')?.value;
        
        if (!customerName) {
            alert('Customer name is required');
            return false;
        }
        
        if (!customerEmail || !this.isValidEmail(customerEmail)) {
            alert('Valid customer email is required');
            return false;
        }
        
        if (!salesRep) {
            alert('Sales representative selection is required');
            return false;
        }
        
        return true;
    }
    
    /**
     * Collect customer information from form
     */
    collectCustomerInfo() {
        return {
            name: document.getElementById('customer-name')?.value.trim(),
            email: document.getElementById('customer-email')?.value.trim(),
            phone: document.getElementById('customer-phone')?.value.trim(),
            company: document.getElementById('company-name')?.value.trim(),
            project: document.getElementById('project-name')?.value.trim(),
            salesRepEmail: document.getElementById('sales-rep')?.value,
            salesRepName: this.getSalesRepName(document.getElementById('sales-rep')?.value),
            notes: document.getElementById('special-notes')?.value.trim()
        };
    }
    
    /**
     * Get sales rep name from email
     */
    getSalesRepName(email) {
        const salesReps = {
            'sales@nwcustomapparel.com': 'Northwest Custom Apparel Sales Team',
            'taneisha@nwcustomapparel.com': 'Taneisha Clark',
            'adriyella@nwcustomapparel.com': 'Adriyella',
            'nika@nwcustomapparel.com': 'Nika Lao',
            'jim@nwcustomapparel.com': 'Jim Mickelson',
            'erik@nwcustomapparel.com': 'Erik Mickelson',
            'ruth@nwcustomapparel.com': 'Ruth Nhong'
        };
        
        return salesReps[email] || 'Sales Representative';
    }
    
    /**
     * Build email data for EmailJS
     */
    buildEmailData(quoteID, quoteData) {
        const customer = quoteData.customerInfo;
        
        return {
            // Email routing
            to_email: customer.email,
            from_name: 'Northwest Custom Apparel',
            reply_to: customer.salesRepEmail,
            
            // Quote identification
            quote_type: 'Cap Embroidery',
            quote_id: quoteID,
            quote_date: new Date().toLocaleDateString(),
            
            // Customer info
            customer_name: customer.name,
            customer_email: customer.email,
            customer_phone: customer.phone || '',
            company_name: customer.company || '',
            project_name: customer.project || '',
            
            // Pricing
            grand_total: `$${quoteData.grandTotal.toFixed(2)}`,
            
            // Sales rep
            sales_rep_name: customer.salesRepName,
            sales_rep_email: customer.salesRepEmail,
            sales_rep_phone: '253-922-5793',
            
            // Company
            company_year: '1977',
            
            // Quote content (HTML)
            quote_html: this.generateQuoteHTML(quoteID, quoteData),
            
            // Notes
            special_notes: customer.notes || 'No special notes for this order'
        };
    }
    
    /**
     * Generate quote text for copying
     */
    generateQuoteText() {
        if (!this.currentQuote) return '';
        
        const quoteId = this.quoteService.generateQuoteID();
        
        let text = `CAP EMBROIDERY QUOTE #${quoteId}\n`;
        text += `Valid for 30 days\n`;
        text += `${'='.repeat(50)}\n\n`;
        
        // Logo specifications
        text += `EMBROIDERY SPECIFICATIONS:\n`;
        this.currentQuote.logos.forEach(logo => {
            text += `• ${logo.position} - ${logo.stitchCount.toLocaleString()} stitches`;
            if (logo.needsDigitizing) text += ` ✓ Digitizing: $100`;
            text += `\n`;
        });
        
        if (this.currentQuote.hasLTM) {
            text += `*Includes small batch pricing for orders under 24 pieces\n`;
        }
        
        text += `\n${'='.repeat(50)}\n\n`;
        
        // Products
        text += `PRODUCTS:\n\n`;
        this.currentQuote.products.forEach(product => {
            text += `${product.styleNumber} - ${product.color} - ${product.totalQuantity} caps\n`;
            text += `${product.title}\n`;
            
            product.sizePricedItems.forEach(item => {
                const upcharge = item.sizeUpcharge > 0 ? ` (+$${item.sizeUpcharge.toFixed(2)})` : '';
                
                // Calculate LTM breakdown for display (item.unitPrice already includes LTM)
                const ltmPerPiece = this.currentQuote.hasLTM ? this.currentQuote.ltmFeeTotal / this.currentQuote.totalQuantity : 0;
                
                // Get front logo breakdown for extra stitch display
                const frontBreakdown = product.pricingBreakdown?.frontLogoBreakdown;
                const hasExtraStitches = frontBreakdown?.hasExtraStitches;
                const extraStitchCost = frontBreakdown?.extraStitchCost || 0;
                
                // Get cap price and embroidery breakdown from product pricingBreakdown
                const capPrice = product.pricingBreakdown?.capPrice || 0;
                const frontEmbroideryPrice = product.pricingBreakdown?.frontEmbroideryPrice || 0;
                
                // Calculate base price (cap + base embroidery, rounded) - declare once
                const baseEmbroideryPrice = hasExtraStitches ? frontEmbroideryPrice - extraStitchCost : frontEmbroideryPrice;
                const basePrice = Math.ceil(capPrice + baseEmbroideryPrice);
                
                if (this.currentQuote.hasLTM && ltmPerPiece > 0) {
                    const totalPerPiece = item.unitPrice; // Already includes LTM
                    const adjustedTotal = item.total; // Use the correct calculated total
                    text += `${item.size}${upcharge}(${item.quantity})\n`;
                    
                    // Show simplified breakdown with Base + extra stitches + LTM
                    if (hasExtraStitches && extraStitchCost > 0) {
                        text += `  Base: $${basePrice.toFixed(2)} + Extra stitches: $${extraStitchCost.toFixed(2)} + Small batch: $${ltmPerPiece.toFixed(2)} = $${totalPerPiece.toFixed(2)} each = $${adjustedTotal.toFixed(2)}\n`;
                    } else {
                        text += `  Base: $${basePrice.toFixed(2)} + Small batch: $${ltmPerPiece.toFixed(2)} = $${totalPerPiece.toFixed(2)} each = $${adjustedTotal.toFixed(2)}\n`;
                    }
                } else {
                    // Show breakdown with extra stitches if applicable (no LTM)
                    if (hasExtraStitches && extraStitchCost > 0) {
                        text += `${item.size}${upcharge}(${item.quantity})\n`;
                        text += `  Base: $${basePrice.toFixed(2)} + Extra stitches: $${extraStitchCost.toFixed(2)} = $${item.unitPrice.toFixed(2)} each = $${item.total.toFixed(2)}\n`;
                    } else {
                        text += `${item.size}${upcharge}(${item.quantity}) @ $${item.unitPrice.toFixed(2)} = $${item.total.toFixed(2)}\n`;
                    }
                }
            });
            
            text += `Subtotal: $${product.lineTotal.toFixed(2)}\n\n`;
        });
        
        text += `${'='.repeat(50)}\n\n`;
        
        // Additional Logo Embroidery section (if applicable)  
        if (this.currentQuote.additionalEmbroideryTotal && this.currentQuote.additionalEmbroideryTotal > 0) {
            text += `\n${'='.repeat(50)}\n\n`;
            text += `ADDITIONAL LOGO EMBROIDERY:\n\n`;
            
            const additionalLogos = this.currentQuote.logos.filter((logo, idx) => 
                !logo.isRequired && idx > 0
            );
            
            if (additionalLogos.length > 0) {
                // Get individual logo pricing from the first product's breakdown
                const individualLogoPrices = this.currentQuote.products[0]?.pricingBreakdown?.additionalLogoPrices || [];
                
                additionalLogos.forEach(logo => {
                    // Find the matching individual logo price or fallback to equal division
                    const logoData = individualLogoPrices.find(lp => lp.position === logo.position) || 
                                   { pricePerPiece: (this.currentQuote.products[0]?.pricingBreakdown?.additionalEmbroideryPrice || 0) / additionalLogos.length };
                    
                    const additionalCostPerPiece = logoData.pricePerPiece;
                    const breakdown = logoData.breakdown;
                    
                    text += `${logo.position} - ${logo.stitchCount.toLocaleString()} stitches [ADDITIONAL]\n`;
                    
                    // Show extra stitch breakdown for additional logos if applicable
                    if (breakdown?.hasExtraStitches && breakdown?.extraStitchCost > 0) {
                        const basePrice = breakdown.basePrice;
                        const extraStitchCost = breakdown.extraStitchCost;
                        text += `  Base: $${basePrice.toFixed(2)} + Extra stitches: $${extraStitchCost.toFixed(2)} = $${additionalCostPerPiece.toFixed(2)} each\n`;
                    }
                    
                    text += `${this.currentQuote.totalQuantity} pieces @ $${additionalCostPerPiece.toFixed(2)} each = $${(additionalCostPerPiece * this.currentQuote.totalQuantity).toFixed(2)}\n\n`;
                });
                
                // Add subtotal for additional logo embroidery
                text += `Additional Logo Subtotal: $${this.currentQuote.additionalEmbroideryTotal.toFixed(2)}\n\n`;
            }
        }
        
        // Totals
        text += `${'='.repeat(50)}\n\n`;
        text += `Total Quantity: ${this.currentQuote.totalQuantity} caps\n`;
        text += `Caps & Front Embroidery${this.currentQuote.hasLTM ? ' (includes small batch)' : ''}: $${this.currentQuote.subtotal.toFixed(2)}\n`;
        
        if (this.currentQuote.additionalEmbroideryTotal && this.currentQuote.additionalEmbroideryTotal > 0) {
            text += `Additional Logo Embroidery: $${this.currentQuote.additionalEmbroideryTotal.toFixed(2)}\n`;
        }
        
        if (this.currentQuote.setupFees > 0) {
            text += `Setup Fees: $${this.currentQuote.setupFees.toFixed(2)}\n`;
        }
        
        // Small Batch Fee is now included in the per-piece pricing above
        
        text += `\nGRAND TOTAL: $${this.currentQuote.grandTotal.toFixed(2)}\n\n`;
        
        text += `Contact: Northwest Custom Apparel\n`;
        text += `Phone: 253-922-5793\n`;
        text += `Email: sales@nwcustomapparel.com\n`;
        
        return text;
    }
    
    /**
     * Generate HTML for email template
     */
    generateQuoteHTML(quoteID, quoteData) {
        if (!this.currentQuote) return '';
        
        let html = '<div style="font-family: Arial, sans-serif; color: #333; line-height: 1.4;">';
        
        // Header
        html += `
            <div style="text-align: center; border-bottom: 2px solid #4cb354; padding-bottom: 10px; margin-bottom: 20px;">
                <h2 style="color: #4cb354; margin: 0;">Cap Embroidery Quote #${quoteID}</h2>
                <p style="margin: 5px 0;">Valid for 30 days</p>
            </div>
        `;
        
        // Embroidery Specifications
        html += '<div style="margin: 20px 0;">';
        html += '<h3 style="color: #4cb354; border-bottom: 1px solid #eee; padding-bottom: 5px;">Embroidery Specifications:</h3>';
        this.currentQuote.logos.forEach((logo, idx) => {
            const isPrimary = logo.isRequired || idx === 0;
            const badgeStyle = isPrimary ? 
                'background: #4cb354; color: white; padding: 2px 6px; border-radius: 3px; font-size: 12px;' :
                'background: #6c757d; color: white; padding: 2px 6px; border-radius: 3px; font-size: 12px;';
            
            html += `<div style="margin: 10px 0;">`;
            html += `${idx + 1}. ${logo.position} - ${logo.stitchCount.toLocaleString()} stitches `;
            html += `<span style="${badgeStyle}">${isPrimary ? 'PRIMARY' : 'ADDITIONAL'}</span>`;
            if (logo.needsDigitizing) html += ' ✓ Digitizing: $100';
            html += '</div>';
        });
        
        if (this.currentQuote.hasLTM) {
            html += '<p style="font-style: italic; color: #666;">*Includes small batch pricing for orders under 24 pieces</p>';
        }
        html += '</div>';
        
        // Products
        html += '<div style="margin: 20px 0;">';
        html += '<h3 style="color: #4cb354; border-bottom: 1px solid #eee; padding-bottom: 5px;">Caps:</h3>';
        
        this.currentQuote.products.forEach(product => {
            html += `<div style="border: 1px solid #eee; padding: 15px; margin: 10px 0; border-radius: 5px;">`;
            html += `<h4 style="margin: 0 0 10px 0; color: #2c5530;">${product.styleNumber} - ${product.color}</h4>`;
            html += `<p style="margin: 0 0 10px 0; color: #666;">${product.title} | ${product.brand} | ${product.totalQuantity} pieces total</p>`;
            
            product.sizePricedItems.forEach(item => {
                const upchargeNote = item.sizeUpcharge > 0 ? ` (+$${item.sizeUpcharge.toFixed(2)} upcharge)` : '';
                
                // Get front logo breakdown for extra stitch display
                const frontBreakdown = product.pricingBreakdown?.frontLogoBreakdown;
                const hasExtraStitches = frontBreakdown?.hasExtraStitches;
                const extraStitchCost = frontBreakdown?.extraStitchCost || 0;
                
                // Get cap price and embroidery breakdown from product pricingBreakdown - declare once
                const capPrice = product.pricingBreakdown?.capPrice || 0;
                const frontEmbroideryPrice = product.pricingBreakdown?.frontEmbroideryPrice || 0;
                
                // Calculate base price (cap + base embroidery, rounded) - declare once
                const baseEmbroideryPrice = hasExtraStitches ? frontEmbroideryPrice - extraStitchCost : frontEmbroideryPrice;
                const combinedBasePrice = Math.ceil(capPrice + baseEmbroideryPrice);
                
                // Check if this is an LTM order and show breakdown
                if (this.currentQuote.hasLTM) {
                    const ltmPerPiece = this.currentQuote.ltmFeeTotal / this.currentQuote.totalQuantity;
                    const totalPerPiece = item.unitPrice;
                    
                    html += `<div style="margin: 5px 0; padding: 2px 0;">`;
                    html += `<div style="display: flex; justify-content: space-between;">`;
                    html += `<span>${item.size}${upchargeNote} (${item.quantity} pieces)</span>`;
                    html += `<span>$${item.total.toFixed(2)}</span>`;
                    html += `</div>`;
                    html += `<div style="font-size: 0.9em; color: #666; margin-left: 20px;">`;
                    
                    // Show simplified breakdown with Base + extra stitches + LTM
                    if (hasExtraStitches && extraStitchCost > 0) {
                        html += `Base: $${combinedBasePrice.toFixed(2)} + Extra stitches: $${extraStitchCost.toFixed(2)} + Small batch: $${ltmPerPiece.toFixed(2)} = $${totalPerPiece.toFixed(2)} each`;
                    } else {
                        html += `Base: $${combinedBasePrice.toFixed(2)} + Small batch: $${ltmPerPiece.toFixed(2)} = $${totalPerPiece.toFixed(2)} each`;
                    }
                    
                    html += `</div>`;
                    html += `</div>`;
                } else {
                    // Show breakdown with extra stitches if applicable (no LTM)
                    if (hasExtraStitches && extraStitchCost > 0) {
                        html += `<div style="margin: 5px 0; padding: 2px 0;">`;
                        html += `<div style="display: flex; justify-content: space-between;">`;
                        html += `<span>${item.size}${upchargeNote} (${item.quantity} pieces)</span>`;
                        html += `<span>$${item.total.toFixed(2)}</span>`;
                        html += `</div>`;
                        html += `<div style="font-size: 0.9em; color: #666; margin-left: 20px;">`;
                        html += `Base: $${combinedBasePrice.toFixed(2)} + Extra stitches: $${extraStitchCost.toFixed(2)} = $${item.unitPrice.toFixed(2)} each`;
                        html += `</div>`;
                        html += `</div>`;
                    } else {
                        html += `<div style="display: flex; justify-content: space-between; margin: 5px 0; padding: 2px 0;">`;
                        html += `<span>${item.size}${upchargeNote} (${item.quantity} pieces)</span>`;
                        html += `<span>@ $${item.unitPrice.toFixed(2)} each = $${item.total.toFixed(2)}</span>`;
                        html += `</div>`;
                    }
                }
            });
            
            html += `<p style="font-weight: bold; text-align: right; margin: 10px 0 0 0;">Subtotal: $${product.lineTotal.toFixed(2)}</p>`;
            html += `</div>`;
        });
        
        html += '</div>';
        
        // Additional Logo Embroidery section (if applicable)
        if (this.currentQuote.additionalEmbroideryTotal && this.currentQuote.additionalEmbroideryTotal > 0) {
            html += '<div style="margin: 20px 0;">';
            html += '<h3 style="color: #4cb354; border-bottom: 1px solid #eee; padding-bottom: 5px;">Additional Logo Embroidery:</h3>';
            
            const additionalLogos = this.currentQuote.logos.filter((logo, idx) => 
                !logo.isRequired && idx > 0
            );
            
            if (additionalLogos.length > 0) {
                // Get individual logo pricing from the first product's breakdown
                const individualLogoPrices = this.currentQuote.products[0]?.pricingBreakdown?.additionalLogoPrices || [];
                
                additionalLogos.forEach(logo => {
                    // Find the matching individual logo price or fallback to equal division
                    const logoData = individualLogoPrices.find(lp => lp.position === logo.position) || 
                                   { pricePerPiece: (this.currentQuote.products[0]?.pricingBreakdown?.additionalEmbroideryPrice || 0) / additionalLogos.length };
                    
                    const additionalCostPerPiece = logoData.pricePerPiece;
                    html += `<div style="border: 1px solid #eee; padding: 10px; margin: 5px 0; border-radius: 5px;">`;
                    html += `<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">`;
                    html += `<span style="font-weight: bold;">${logo.position} - ${logo.stitchCount.toLocaleString()} stitches</span>`;
                    html += `<span style="background: #6c757d; color: white; padding: 2px 6px; border-radius: 3px; font-size: 12px;">ADDITIONAL</span>`;
                    html += `</div>`;
                    html += `<div style="display: flex; justify-content: space-between;">`;
                    html += `<span>${this.currentQuote.totalQuantity} pieces @ $${additionalCostPerPiece.toFixed(2)} each</span>`;
                    html += `<span style="font-weight: bold;">$${(additionalCostPerPiece * this.currentQuote.totalQuantity).toFixed(2)}</span>`;
                    html += `</div>`;
                    html += `</div>`;
                });
                
                // Add subtotal for additional logo embroidery
                html += `<div style="text-align: right; margin-top: 15px; padding-top: 10px; border-top: 1px solid #eee;">`;
                html += `<strong>Additional Logo Subtotal: $${this.currentQuote.additionalEmbroideryTotal.toFixed(2)}</strong>`;
                html += `</div>`;
            }
            
            html += '</div>';
        }
        
        // Totals
        html += '<div style="border-top: 2px solid #4cb354; padding-top: 15px; margin-top: 20px;">';
        html += '<h3 style="color: #4cb354; margin-bottom: 15px;">Quote Totals:</h3>';
        
        html += `<div style="display: flex; justify-content: space-between; margin: 5px 0;"><span>Total Quantity:</span><span>${this.currentQuote.totalQuantity} pieces</span></div>`;
        
        // Show caps & front embroidery with LTM indicator if applicable
        const capsLabel = this.currentQuote.hasLTM ? 
            "Caps & Front Embroidery (includes small batch):" : 
            "Caps & Front Embroidery:";
        html += `<div style="display: flex; justify-content: space-between; margin: 5px 0;"><span>${capsLabel}</span><span>$${this.currentQuote.subtotal.toFixed(2)}</span></div>`;
        
        if (this.currentQuote.additionalEmbroideryTotal && this.currentQuote.additionalEmbroideryTotal > 0) {
            html += `<div style="display: flex; justify-content: space-between; margin: 5px 0;"><span>Additional Logo Embroidery:</span><span>$${this.currentQuote.additionalEmbroideryTotal.toFixed(2)}</span></div>`;
        }
        
        if (this.currentQuote.setupFees > 0) {
            const digitizingLogos = this.currentQuote.logos.filter(l => l.needsDigitizing).length;
            html += `<div style="display: flex; justify-content: space-between; margin: 5px 0;"><span>Setup Fees (${digitizingLogos} logos):</span><span>$${this.currentQuote.setupFees.toFixed(2)}</span></div>`;
        }
        
        html += `<div style="display: flex; justify-content: space-between; margin: 10px 0; padding-top: 10px; border-top: 1px solid #ccc; font-weight: bold; font-size: 1.1em;"><span>GRAND TOTAL:</span><span>$${this.currentQuote.grandTotal.toFixed(2)}</span></div>`;
        html += '</div>';
        
        html += '</div>';
        
        return html;
    }
    
    /**
     * Generate print-friendly HTML
     */
    generatePrintHTML(quoteID, quoteData) {
        if (!this.currentQuote) return '';
        
        let html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Cap Quote ${quoteID}</title>
                <style>
                    body { 
                        font-family: Arial, sans-serif; 
                        margin: 20px; 
                        line-height: 1.4;
                        color: #333;
                    }
                    .header { 
                        text-align: center; 
                        border-bottom: 2px solid #4cb354; 
                        padding-bottom: 15px; 
                        margin-bottom: 20px;
                    }
                    .quote-content { margin: 20px 0; }
                    .section { margin: 20px 0; }
                    .section h3 { 
                        color: #4cb354; 
                        border-bottom: 1px solid #eee; 
                        padding-bottom: 5px;
                        margin-bottom: 15px;
                    }
                    .logo-spec { 
                        margin: 10px 0; 
                        padding: 5px 0;
                    }
                    .product-summary { 
                        margin: 15px 0; 
                        padding: 10px; 
                        border: 1px solid #eee;
                    }
                    .product-summary h4 { 
                        margin: 0 0 10px 0; 
                        color: #2c5530;
                    }
                    .line-item { 
                        display: flex; 
                        justify-content: space-between; 
                        margin: 5px 0;
                        padding: 2px 0;
                    }
                    .totals { 
                        border-top: 2px solid #4cb354; 
                        padding-top: 15px; 
                        margin-top: 20px; 
                    }
                    .total-line { 
                        display: flex; 
                        justify-content: space-between; 
                        margin: 5px 0;
                        padding: 2px 0;
                    }
                    .grand-total { 
                        font-weight: bold; 
                        font-size: 1.1em; 
                        border-top: 1px solid #ccc; 
                        padding-top: 10px;
                        margin-top: 10px;
                    }
                    .badge { 
                        padding: 2px 6px; 
                        border-radius: 3px; 
                        font-size: 0.8em; 
                        font-weight: bold;
                    }
                    .badge-primary { 
                        background: #4cb354; 
                        color: white;
                    }
                    .badge-additional { 
                        background: #6c757d; 
                        color: white;
                    }
                    @media print { 
                        body { margin: 0; }
                        .no-print { display: none; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>Northwest Custom Apparel</h1>
                    <h2>Cap Embroidery Quote #${quoteID}</h2>
                    <p>Valid for 30 days | Phone: (253) 922-5793</p>
                </div>
                <div class="quote-content">
        `;
        
        // Embroidery Specifications
        html += '<div class="section">';
        html += '<h3>Embroidery Specifications:</h3>';
        this.currentQuote.logos.forEach((logo, idx) => {
            const isPrimary = logo.isRequired || idx === 0;
            html += `<div class="logo-spec">`;
            html += `${idx + 1}. ${logo.position} - ${logo.stitchCount.toLocaleString()} stitches `;
            html += isPrimary ? '<span class="badge badge-primary">PRIMARY</span>' : '<span class="badge badge-additional">ADDITIONAL</span>';
            if (logo.needsDigitizing) html += ' ✓ Digitizing: $100';
            html += '</div>';
        });
        
        if (this.currentQuote.hasLTM) {
            html += '<p><em>*Includes small batch pricing for orders under 24 pieces</em></p>';
        }
        html += '</div>';
        
        // Products
        html += '<div class="section">';
        html += '<h3>Caps:</h3>';
        this.currentQuote.products.forEach(product => {
            html += `<div class="product-summary">`;
            html += `<h4>${product.styleNumber} - ${product.color} - ${product.totalQuantity} pieces</h4>`;
            html += `<p>${product.title} | ${product.brand}</p>`;
            
            product.sizePricedItems.forEach(item => {
                const upchargeNote = item.sizeUpcharge > 0 ? ` (+$${item.sizeUpcharge.toFixed(2)} upcharge)` : '';
                
                // Get front logo breakdown for extra stitch display
                const frontBreakdown = product.pricingBreakdown?.frontLogoBreakdown;
                const hasExtraStitches = frontBreakdown?.hasExtraStitches;
                const extraStitchCost = frontBreakdown?.extraStitchCost || 0;
                
                // Get cap price and embroidery breakdown from product pricingBreakdown - declare once
                const capPrice = product.pricingBreakdown?.capPrice || 0;
                const frontEmbroideryPrice = product.pricingBreakdown?.frontEmbroideryPrice || 0;
                
                // Calculate base price (cap + base embroidery, rounded) - declare once
                const baseEmbroideryPrice = hasExtraStitches ? frontEmbroideryPrice - extraStitchCost : frontEmbroideryPrice;
                const combinedBasePrice = Math.ceil(capPrice + baseEmbroideryPrice);
                
                // Check if this is an LTM order and show breakdown
                if (this.currentQuote.hasLTM) {
                    const ltmPerPiece = this.currentQuote.ltmFeeTotal / this.currentQuote.totalQuantity;
                    const totalPerPiece = item.unitPrice;
                    
                    html += `<div class="line-item">`;
                    html += `<span>${item.size}${upchargeNote} (${item.quantity} pieces)</span>`;
                    html += `<span>$${item.total.toFixed(2)}</span>`;
                    html += `</div>`;
                    html += `<div style="font-size: 0.9em; color: #666; margin-left: 20px; margin-bottom: 5px;">`;
                    
                    // Show simplified breakdown with Base + extra stitches + LTM
                    if (hasExtraStitches && extraStitchCost > 0) {
                        html += `Base: $${combinedBasePrice.toFixed(2)} + Extra stitches: $${extraStitchCost.toFixed(2)} + Small batch: $${ltmPerPiece.toFixed(2)} = $${totalPerPiece.toFixed(2)} each`;
                    } else {
                        html += `Base: $${combinedBasePrice.toFixed(2)} + Small batch: $${ltmPerPiece.toFixed(2)} = $${totalPerPiece.toFixed(2)} each`;
                    }
                    
                    html += `</div>`;
                } else {
                    // Show breakdown with extra stitches if applicable (no LTM)
                    if (hasExtraStitches && extraStitchCost > 0) {
                        html += `<div class="line-item">`;
                        html += `<span>${item.size}${upchargeNote} (${item.quantity} pieces)</span>`;
                        html += `<span>$${item.total.toFixed(2)}</span>`;
                        html += `</div>`;
                        html += `<div style="font-size: 0.9em; color: #666; margin-left: 20px; margin-bottom: 5px;">`;
                        html += `Base: $${combinedBasePrice.toFixed(2)} + Extra stitches: $${extraStitchCost.toFixed(2)} = $${item.unitPrice.toFixed(2)} each`;
                        html += `</div>`;
                    } else {
                        html += `<div class="line-item">`;
                        html += `<span>${item.size}${upchargeNote} (${item.quantity} pieces)</span>`;
                        html += `<span>@ $${item.unitPrice.toFixed(2)} each = $${item.total.toFixed(2)}</span>`;
                        html += `</div>`;
                    }
                }
            });
            
            html += `<p><strong>Subtotal: $${product.lineTotal.toFixed(2)}</strong></p>`;
            html += `</div>`;
        });
        html += '</div>';
        
        // Totals
        html += '<div class="totals">';
        html += `<div class="total-line"><span>Total Quantity:</span><span>${this.currentQuote.totalQuantity} pieces</span></div>`;
        
        // Show caps & embroidery with LTM indicator if applicable
        const capsLabel = this.currentQuote.hasLTM ? 
            "Caps & Embroidery (includes small batch):" : 
            "Caps & Embroidery:";
        html += `<div class="total-line"><span>${capsLabel}</span><span>$${this.currentQuote.subtotal.toFixed(2)}</span></div>`;
        
        if (this.currentQuote.additionalEmbroideryTotal && this.currentQuote.additionalEmbroideryTotal > 0) {
            html += `<div class="total-line"><span>Additional Logo Embroidery:</span><span>$${this.currentQuote.additionalEmbroideryTotal.toFixed(2)}</span></div>`;
        }
        
        if (this.currentQuote.setupFees > 0) {
            const digitizingLogos = this.currentQuote.logos.filter(l => l.needsDigitizing).length;
            html += `<div class="total-line"><span>Setup Fees (${digitizingLogos} logos):</span><span>$${this.currentQuote.setupFees.toFixed(2)}</span></div>`;
        }
        
        html += `<div class="total-line grand-total"><span>GRAND TOTAL:</span><span>$${this.currentQuote.grandTotal.toFixed(2)}</span></div>`;
        html += '</div>';
        
        html += `
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
        
        return html;
    }
    
    /**
     * Show success modal
     */
    showSuccessModal(quoteID, quoteData) {
        const modal = document.getElementById('success-modal');
        const quoteIdSpan = document.getElementById('modal-quote-id');
        const customerSpan = document.getElementById('modal-customer');
        const totalSpan = document.getElementById('modal-total');
        
        if (modal && quoteIdSpan && customerSpan && totalSpan) {
            quoteIdSpan.textContent = quoteID;
            customerSpan.textContent = quoteData.customerInfo?.name || 'Customer';
            totalSpan.textContent = `$${quoteData.grandTotal.toFixed(2)}`;
            
            modal.style.display = 'flex';
            
            console.log('[CapQuoteBuilder] Success modal displayed:', quoteID);
        }
    }
    
    /**
     * Show/hide loading overlay
     */
    showLoading(show, message = 'Loading...') {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            const messageP = overlay.querySelector('p');
            if (messageP) messageP.textContent = message;
            overlay.style.display = show ? 'flex' : 'none';
        }
    }
    
    /**
     * Email validation
     */
    isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }
    
    /**
     * Handle logo changes event
     */
    handleLogosChanged(detail) {
        console.log('[CapQuoteBuilder] Logos changed:', detail.logos?.length || 0);
        // Trigger any necessary updates when logos change
    }
    
    /**
     * Handle products changes event
     */
    handleProductsChanged(detail) {
        console.log('[CapQuoteBuilder] Products changed:', detail.totalQuantity || 0);
        // Trigger any necessary updates when products change
    }
}

// Initialize debugging tools
window.CAP_DEBUG = {
    /**
     * Test pricing calculations
     */
    testPricing: async function(quantity, frontStitches, additionalLogos = []) {
        if (!window.capQuoteBuilder?.pricingCalculator) {
            console.error('❌ Pricing calculator not available');
            return;
        }
        
        try {
            const result = await window.capQuoteBuilder.pricingCalculator.testPricing(quantity, frontStitches, additionalLogos);
            return result;
        } catch (error) {
            console.error('❌ Pricing test failed:', error);
            return null;
        }
    },
    
    /**
     * Test API endpoints
     */
    testAPI: async function(endpoint = 'CAP') {
        const baseURL = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
        const url = `${baseURL}/api/pricing-bundle?method=${endpoint}`;
        
        try {
            console.log('🧪 Testing API:', url);
            const response = await fetch(url);
            const data = await response.json();
            
            console.log('✅ API Response:', {
                status: response.status,
                tiers: data.tiersR?.length || 0,
                costs: data.allEmbroideryCostsR?.length || 0,
                locations: data.locations?.length || 0
            });
            
            return data;
        } catch (error) {
            console.error('❌ API test failed:', error);
            return null;
        }
    },
    
    /**
     * Get current state
     */
    getCurrentState: function() {
        if (!window.capQuoteBuilder) {
            console.log('❌ Cap quote builder not initialized');
            return null;
        }
        
        const state = {
            phase: window.capQuoteBuilder.currentPhase,
            logos: window.capQuoteBuilder.logoManager?.getLogos() || [],
            products: window.capQuoteBuilder.productManager?.getProducts() || [],
            quote: window.capQuoteBuilder.currentQuote
        };
        
        console.log('📊 Current State:', state);
        return state;
    },
    
    /**
     * Clear all data and reset
     */
    reset: function() {
        if (confirm('Reset all quote data? This cannot be undone.')) {
            location.reload();
        }
    },
    
    /**
     * Compare pricing scenarios
     */
    compareScenarios: async function() {
        console.log('🔄 Comparing pricing scenarios...');
        
        const scenarios = [
            { qty: 12, front: 8000, additional: [] },
            { qty: 24, front: 8000, additional: [] },
            { qty: 48, front: 8000, additional: [{ position: 'Cap Back', stitches: 5000 }] },
            { qty: 72, front: 10000, additional: [{ position: 'Cap Back', stitches: 3000 }] }
        ];
        
        const results = [];
        
        for (const scenario of scenarios) {
            try {
                const result = await this.testPricing(scenario.qty, scenario.front, scenario.additional);
                if (result) {
                    results.push({
                        scenario: scenario,
                        total: result.grandTotal,
                        tier: result.tier,
                        hasLTM: result.hasLTM
                    });
                }
            } catch (error) {
                console.error('Scenario failed:', scenario, error);
            }
        }
        
        console.table(results);
        return results;
    }
};

// Export for global access
if (typeof window !== 'undefined') {
    window.CapQuoteBuilder = CapQuoteBuilder;
}

// Debug message
console.log('🔧 Debug tools available:');
console.log('  CAP_DEBUG.testPricing(qty, frontStitches, additionalLogos)');
console.log('  CAP_DEBUG.testAPI(endpoint)');
console.log('  CAP_DEBUG.getCurrentState()');
console.log('  CAP_DEBUG.compareScenarios()');
console.log('  CAP_DEBUG.reset()');