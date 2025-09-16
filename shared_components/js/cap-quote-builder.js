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
            templateId: 'template_wlty7o8' // Cap Embroidery Quote template
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
            
            // Expose managers to window for onclick handlers
            window.capLogoManager = this.logoManager;
            window.capProductLineManager = this.productManager;  // Match the name used in onclick handlers
            
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
                <div class="product-summary" style="border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px; margin-bottom: 20px; background: #fff; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                    <div class="product-header" style="display: flex; gap: 15px; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid #f0f0f0;">
                        <img src="${product.imageUrl || 'https://via.placeholder.com/150x150/4cb354/white?text=' + encodeURIComponent(product.styleNumber)}"
                             alt="${product.styleNumber} - ${product.color}"
                             style="width: 85px; height: 85px; object-fit: contain; border: 1px solid #e0e0e0; border-radius: 4px; padding: 5px; background: #fff;"
                             onerror="this.src='https://via.placeholder.com/150x150/4cb354/white?text=' + encodeURIComponent('${product.styleNumber}')">
                        <div class="product-info" style="flex: 1;">
                            <strong style="font-size: 18px; color: #333;">${product.styleNumber} - ${product.color}</strong>
                            <p style="margin: 6px 0; color: #666; font-size: 14px;">${product.title}</p>
                            <p style="margin: 6px 0; color: #888; font-size: 14px;">${product.brand}</p>
                            <p style="margin: 6px 0; color: #4cb354; font-weight: 600; font-size: 15px;">
                                <i class="fas fa-box"></i> ${product.totalQuantity} pieces total
                            </p>
                        </div>
                    </div>
                    <div class="product-lines">
            `;
            
            // Show size breakdown with consolidated pricing including all embroidery
            product.sizePricedItems.forEach(item => {
                const upchargeNote = item.sizeUpcharge > 0 ? ` (+$${item.sizeUpcharge.toFixed(2)} upcharge)` : '';
                
                // Calculate components for consolidated price
                const ltmPerPiece = this.currentQuote.hasLTM ? this.currentQuote.ltmFeeTotal / this.currentQuote.totalQuantity : 0;
                
                // Get pricing components from product breakdown
                const capPrice = product.pricingBreakdown?.capPrice || 0;
                const frontEmbroideryPrice = product.pricingBreakdown?.frontEmbroideryPrice || 0;
                
                // Calculate additional logo cost per piece
                const additionalLogoPrices = product.pricingBreakdown?.additionalLogoPrices || [];
                const additionalLogoCostPerPiece = additionalLogoPrices.reduce((sum, logo) => sum + logo.pricePerPiece, 0);
                
                // Get front logo breakdown for extra stitch display
                const frontBreakdown = product.pricingBreakdown?.frontLogoBreakdown;
                const hasExtraStitches = frontBreakdown?.hasExtraStitches;
                const extraStitchCost = frontBreakdown?.extraStitchCost || 0;
                
                // Calculate base price (cap + base embroidery, rounded)
                const baseEmbroideryPrice = hasExtraStitches ? frontEmbroideryPrice - extraStitchCost : frontEmbroideryPrice;
                const basePrice = Math.ceil(capPrice + baseEmbroideryPrice);
                
                // Calculate total consolidated price per cap (includes all embroidery + LTM if applicable)
                const consolidatedPricePerCap = item.unitPrice + additionalLogoCostPerPiece;
                const consolidatedTotal = consolidatedPricePerCap * item.quantity;
                
                // Build breakdown text with separate lines for base and additional logos
                let baseComponents = [];
                baseComponents.push(`Base: $${basePrice.toFixed(2)}`);
                
                if (hasExtraStitches && extraStitchCost > 0) {
                    baseComponents.push(`Extra stitches: $${extraStitchCost.toFixed(2)}`);
                }
                
                if (this.currentQuote.hasLTM && ltmPerPiece > 0) {
                    baseComponents.push(`Small batch: $${ltmPerPiece.toFixed(2)}`);
                }
                
                // Build additional logos line if present
                let additionalLogosLine = '';
                if (additionalLogoPrices.length > 0) {
                    const logoDetails = additionalLogoPrices.map(logo => 
                        `${logo.position}: $${logo.pricePerPiece.toFixed(2)}`
                    ).join(' + ');
                    additionalLogosLine = `<br><span class="additional-logos-line">+ ${logoDetails}</span>`;
                }
                
                const baseLineTotal = baseComponents.join(' + ');
                const fullBreakdown = additionalLogosLine
                    ? `${baseLineTotal}${additionalLogosLine}`
                    : baseLineTotal;
                
                html += `
                    <div class="line-item" style="padding: 16px 0; ${product.sizePricedItems.indexOf(item) > 0 ? 'border-top: 1px solid #e0e0e0;' : ''}">
                        <div style="margin-bottom: 12px;">
                            <strong style="font-size: 15px;">${item.size}${upchargeNote} (${item.quantity} ${item.quantity === 1 ? 'piece' : 'pieces'})</strong>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                            <div style="flex: 1;">
                                <div style="margin-bottom: 8px;">
                                    <span style="font-size: 14px; color: #666; margin-right: 8px;">Price per piece:</span>
                                    <span style="font-size: 20px; font-weight: bold; color: #4cb354;">$${consolidatedPricePerCap.toFixed(2)}</span>
                                </div>
                                <div style="font-size: 11px; color: #999; line-height: 1.4; padding-left: 20px; border-left: 2px solid #e8e8e8; margin-top: -4px;">
                                    ${fullBreakdown}
                                </div>
                            </div>
                            <div style="text-align: right; min-width: 120px; align-self: center;">
                                <div style="font-size: 13px; color: #666; margin-bottom: 2px;">Line total:</div>
                                <div style="font-size: 18px; font-weight: bold; color: #333;">$${consolidatedTotal.toFixed(2)}</div>
                            </div>
                        </div>
                    </div>
                `;
            });
            
            html += `
                    </div>
                    <div class="product-subtotal" style="text-align: right; margin-top: 15px; padding-top: 12px; border-top: 2px solid #f0f0f0;">
                        ${(() => {
                            // Calculate updated subtotal including additional logos
                            const additionalLogoPrices = product.pricingBreakdown?.additionalLogoPrices || [];
                            const additionalLogoCostPerPiece = additionalLogoPrices.reduce((logoSum, logo) => logoSum + logo.pricePerPiece, 0);
                            const consolidatedSubtotal = product.sizePricedItems.reduce((sum, item) => {
                                const consolidatedPricePerCap = item.unitPrice + additionalLogoCostPerPiece;
                                return sum + (consolidatedPricePerCap * item.quantity);
                            }, 0);
                            return `<span style="font-size: 14px; color: #666; margin-right: 8px;">Product Subtotal:</span>
                                    <strong style="font-size: 20px; color: #4cb354;">$${consolidatedSubtotal.toFixed(2)}</strong>`;
                        })()}
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        
        // Additional logos are now included in the consolidated price per cap above
        
        // Totals section with detailed breakdown
        html += `
            <div class="summary-section totals-section">
                <h4><i class="fas fa-calculator"></i> Quote Totals</h4>
                <div class="totals-breakdown">
                    <div class="total-line">
                        <span>Decorated Caps Total${this.currentQuote.hasLTM ? ' (includes all embroidery & small batch)' : ' (includes all embroidery)'}:</span>
                        <span>$${(this.currentQuote.subtotal + (this.currentQuote.additionalEmbroideryTotal || 0)).toFixed(2)}</span>
                    </div>
        `;
        
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
            let saveSuccess = false;
            
            if (saveToDb) {
                const saveResult = await this.quoteService.saveQuote(this.currentQuote);
                
                if (saveResult.success) {
                    quoteID = saveResult.quoteID;
                    saveSuccess = true;
                    console.log('[CapQuoteBuilder] ✅ Quote saved to database:', quoteID);
                } else {
                    console.error('[CapQuoteBuilder] Database save failed:', saveResult.error);
                    
                    // Show visible error message
                    this.showErrorMessage(
                        'Database Save Failed',
                        `Quote could not be saved to database: ${saveResult.error}\nYou can still print or copy the quote.`
                    );
                    
                    // Generate quote ID anyway for display
                    quoteID = this.quoteService.generateQuoteID();
                }
            } else {
                // Generate quote ID for display even if not saving
                quoteID = this.quoteService.generateQuoteID();
                saveSuccess = true;
            }
            
            // Show appropriate notification
            if (saveSuccess) {
                this.showSuccessModal(quoteID, this.currentQuote);
            } else {
                // Still store data for print/copy functionality
                window.lastQuoteData = {
                    quoteId: quoteID,
                    customerName: this.currentQuote.customerInfo?.name || 'Customer',
                    customerEmail: this.currentQuote.customerInfo?.email || '',
                    customerPhone: this.currentQuote.customerInfo?.phone || '',
                    companyName: this.currentQuote.customerInfo?.company || '',
                    projectName: this.currentQuote.customerInfo?.project || '',
                    items: this.currentQuote.products || [],
                    grandTotal: this.currentQuote.grandTotal || 0
                };
            }
            
        } catch (error) {
            console.error('[CapQuoteBuilder] ❌ Save quote failed:', error);
            
            // Show detailed error message
            this.showErrorMessage(
                'Quote Save Failed',
                `An error occurred while saving the quote:\n${error.message}\n\nPlease try again or contact support if the problem persists.`
            );
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
        const customer = quoteData.customerInfo || {};
        
        // Calculate totals with tax
        const productSubtotal = (this.currentQuote.subtotal || 0) + (this.currentQuote.additionalEmbroideryTotal || 0);
        const subtotalBeforeTax = productSubtotal + (this.currentQuote.setupFees || 0);
        const salesTax = subtotalBeforeTax * 0.101; // 10.1% Milton, WA sales tax
        const grandTotalWithTax = subtotalBeforeTax + salesTax;
        
        // Debug log to see what we're sending
        const emailData = {
            // Email routing (these match EmailJS settings)
            customerEmail: customer.email || '',
            
            // Quote identification
            quoteID: quoteID || '',
            currentDate: new Date().toLocaleDateString('en-US'),
            
            // Customer information - ALWAYS provide these even if empty
            customerName: customer.name || '',
            customerCompany: customer.company || '',
            customerPhone: customer.phone || '',
            
            // Project details - ALWAYS provide these
            projectName: customer.project || '',
            salesRepName: customer.salesRepName || 'General Sales',
            totalQuantity: (this.currentQuote.totalQuantity || 0).toString(),
            pricingTier: this.currentQuote.tier || 'Standard',
            
            // Embroidery details HTML
            embroideryDetails: this.generateEmbroideryDetailsHTML() || '',
            
            // Products table HTML (just the rows, not the full table)
            productsTable: this.generateProductsTableHTML() || '',
            
            // Pricing (without $ sign - template adds it)
            subtotal: subtotalBeforeTax.toFixed(2),
            salesTax: salesTax.toFixed(2),
            grandTotal: grandTotalWithTax.toFixed(2),
            
            // Optional notes
            specialNotes: customer.notes || '',
            
            // Add the full HTML quote as a fallback
            quote_html: this.generateQuoteHTML(quoteID, quoteData) || ''
        };
        
        console.log('[CapQuoteBuilder] Email data being sent:', emailData);
        return emailData;
    }
    
    /**
     * Generate embroidery details HTML for email template
     */
    generateEmbroideryDetailsHTML() {
        if (!this.currentQuote || !this.currentQuote.logos) return '';
        
        let html = '';
        this.currentQuote.logos.forEach(logo => {
            const isPrimary = logo.position === 'Cap Front';
            html += `
                <div style="margin: 8px 0;">
                    <span style="color: #4cb354;">✓</span> 
                    <strong>${logo.position}</strong> (${logo.stitchCount.toLocaleString()} stitches)
                    <span style="color: #666; font-style: italic;">
                        - ${isPrimary ? 'INCLUDED IN BASE PRICE' : 'ADDITIONAL LOGO'}
                    </span>
                </div>
            `;
        });
        
        return html;
    }
    
    /**
     * Generate products table HTML rows for email template
     */
    generateProductsTableHTML() {
        if (!this.currentQuote || !this.currentQuote.products) return '';
        
        let html = '';
        this.currentQuote.products.forEach(product => {
            // Get consolidated price per cap
            const additionalLogoPrices = product.pricingBreakdown?.additionalLogoPrices || [];
            const additionalLogoCostPerPiece = additionalLogoPrices.reduce((sum, logo) => sum + logo.pricePerPiece, 0);
            const pricePerCap = product.sizePricedItems[0].unitPrice + additionalLogoCostPerPiece;
            const lineTotal = pricePerCap * product.totalQuantity;
            
            // Logo description
            let logoDesc = 'Includes front logo';
            const additionalLogos = this.currentQuote.logos.filter(l => l.position !== 'Cap Front');
            if (additionalLogos.length > 0) {
                logoDesc += ' + ' + additionalLogos.map(l => l.position.toLowerCase()).join(', ');
            }
            
            html += `
                <tr>
                    <td style="padding: 10px; border: 1px solid #ddd;">
                        <strong>${product.styleNumber} - ${product.color}</strong><br>
                        ${product.title}<br>
                        <span style="color: #666; font-size: 12px;">
                            Size: ${product.sizePricedItems.map(item => item.size).join(', ')}<br>
                            ${logoDesc}
                        </span>
                    </td>
                    <td style="padding: 10px; text-align: center; border: 1px solid #ddd;">${product.totalQuantity}</td>
                    <td style="padding: 10px; text-align: right; border: 1px solid #ddd;">$${pricePerCap.toFixed(2)}</td>
                    <td style="padding: 10px; text-align: right; border: 1px solid #ddd;">$${lineTotal.toFixed(2)}</td>
                </tr>
            `;
        });
        
        return html;
    }
    
    /**
     * Generate quote text for copying
     */
    generateQuoteText() {
        if (!this.currentQuote) return '';
        
        const quoteId = this.quoteService.generateQuoteID();
        const currentDate = new Date().toLocaleDateString('en-US');
        
        // Header with company info
        let text = `NORTHWEST CUSTOM APPAREL
`;
        text += `2025 Freeman Road East, Milton, WA 98354
`;
        text += `Phone: (253) 922-5793 | sales@nwcustomapparel.com
`;
        text += `${'='.repeat(60)}

`;
        
        // Quote section
        text += `QUOTE
`;
        text += `${quoteId}
`;
        text += `Date: ${currentDate}
`;
        text += `Valid for: 30 days

`;
        
        // Customer information
        const customerInfo = this.collectCustomerInfo();
        text += `CUSTOMER INFORMATION
`;
        text += `${customerInfo.name || 'Not provided'}
`;
        if (customerInfo.company) text += `${customerInfo.company}
`;
        text += `${customerInfo.email || 'Not provided'}
`;
        if (customerInfo.phone) text += `${customerInfo.phone}
`;
        text += `
`;
        
        // Project details
        text += `PROJECT DETAILS
`;
        text += `Type: Cap Embroidery
`;
        if (customerInfo.project) text += `Project: ${customerInfo.project}
`;
        text += `Total Pieces: ${this.currentQuote.totalQuantity}
`;
        text += `Pricing Tier: ${this.currentQuote.tier}
`;
        text += `Quote Prepared By: ${customerInfo.salesRepName || 'General Sales'}

`;
        
        // Embroidery package
        text += `EMBROIDERY PACKAGE FOR THIS ORDER:
`;
        this.currentQuote.logos.forEach(logo => {
            const isPrimary = logo.position === 'Cap Front';
            text += `✓ ${logo.position} (${logo.stitchCount.toLocaleString()} stitches)`;
            if (isPrimary) {
                text += ` - INCLUDED IN BASE PRICE`;
            } else {
                text += ` - ADDITIONAL LOGO`;
            }
            text += `
`;
        });
        text += `
`;
        
        // Products table header
        text += `${'='.repeat(60)}
`;
        text += `DESCRIPTION${' '.repeat(25)}QUANTITY    UNIT PRICE    TOTAL
`;
        text += `${'='.repeat(60)}
`;
        
        // Products
        let subtotal = 0;
        this.currentQuote.products.forEach(product => {
            // Main product line
            text += `${product.styleNumber} - ${product.color}
`;
            text += `${product.title}
`;
            
            // Size breakdown
            product.sizePricedItems.forEach(item => {
                text += `Size: ${item.size}
`;
            });
            
            // Logo description
            text += `Includes front logo`;
            const additionalLogos = this.currentQuote.logos.filter(l => l.position !== 'Cap Front');
            if (additionalLogos.length > 0) {
                text += ` + ${additionalLogos.map(l => l.position.toLowerCase()).join(', ')}`;
            }
            text += `
`;
            
            // Get consolidated price per cap (includes all logos and fees)
            const additionalLogoPrices = product.pricingBreakdown?.additionalLogoPrices || [];
            const additionalLogoCostPerPiece = additionalLogoPrices.reduce((sum, logo) => sum + logo.pricePerPiece, 0);
            const pricePerCap = product.sizePricedItems[0].unitPrice + additionalLogoCostPerPiece;
            const lineTotal = pricePerCap * product.totalQuantity;
            subtotal += lineTotal;
            
            // Quantity, price, total aligned
            const qtyStr = product.totalQuantity.toString();
            const priceStr = `$${pricePerCap.toFixed(2)}`;
            const totalStr = `$${lineTotal.toFixed(2)}`;
            
            text += `${' '.repeat(36)}${qtyStr.padEnd(12)}${priceStr.padEnd(14)}${totalStr}

`;
        });
        
        text += `${'='.repeat(60)}
`;
        
        // Subtotal
        const productSubtotal = this.currentQuote.subtotal + (this.currentQuote.additionalEmbroideryTotal || 0);
        const subtotalBeforeTax = productSubtotal + this.currentQuote.setupFees;
        text += `Subtotal (${this.currentQuote.totalQuantity} pieces):${' '.repeat(31)}$${subtotalBeforeTax.toFixed(2)}
`;
        
        // Sales tax
        const salesTax = subtotalBeforeTax * 0.101; // 10.1% Milton, WA sales tax
        text += `Milton, WA Sales Tax (10.1%):${' '.repeat(23)}$${salesTax.toFixed(2)}
`;
        
        // Grand total
        const grandTotalWithTax = subtotalBeforeTax + salesTax;
        text += `
GRAND TOTAL:${' '.repeat(40)}$${grandTotalWithTax.toFixed(2)}

`;
        
        // Special notes
        const notes = document.getElementById('quote-notes')?.value.trim() || document.getElementById('special-notes')?.value.trim();
        if (notes) {
            text += `Special Notes
`;
            text += `${notes}

`;
        }
        
        // Terms & Conditions
        text += `Terms & Conditions:
`;
        text += `• This quote is valid for 30 days from the date of issue
`;
        text += `• 50% deposit required to begin production
`;
        text += `• Production time: 14 business days after order and art approval
`;
        text += `• Rush production available (7 business days) - add 25%
`;
        text += `• Prices subject to change based on final artwork requirements

`;
        
        text += `Thank you for choosing Northwest Custom Apparel!
`;
        text += `Northwest Custom Apparel | Since 1977 | 2025 Freeman Road East, Milton, WA 98354 | (253) 922-5793
`;
        
        return text;
    }
    
    /**
     * Generate HTML for email template
     */
    generateQuoteHTML(quoteID, quoteData) {
        if (!this.currentQuote) return '';
        
        const currentDate = new Date().toLocaleDateString('en-US');
        const customerInfo = this.collectCustomerInfo();
        
        let html = `
        <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; color: #333;">
            <!-- Header with Company Info -->
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px 8px 0 0;">
                <div style="text-align: center;">
                    <img src="https://cdn.caspio.com/A0E15000/Safety%20Stripes/web%20northwest%20custom%20apparel%20logo.png?ver=1" 
                         alt="Northwest Custom Apparel" 
                         style="max-width: 200px; height: auto; margin-bottom: 10px;">
                    <div style="color: #666; font-size: 14px;">
                        <p style="margin: 5px 0;">2025 Freeman Road East, Milton, WA 98354</p>
                        <p style="margin: 5px 0;">Phone: (253) 922-5793 | sales@nwcustomapparel.com</p>
                    </div>
                </div>
            </div>
            
            <!-- Quote Header -->
            <div style="background: #4cb354; color: white; padding: 15px; text-align: center;">
                <h1 style="margin: 0; font-size: 24px;">QUOTE</h1>
                <p style="margin: 5px 0; font-size: 18px;">${quoteID}</p>
                <p style="margin: 5px 0;">Date: ${currentDate} | Valid for: 30 days</p>
            </div>
            
            <!-- Customer & Project Info -->
            <div style="display: flex; gap: 20px; padding: 20px; background: #f8f9fa;">
                <div style="flex: 1;">
                    <h3 style="color: #4cb354; margin: 0 0 10px 0; font-size: 14px; text-transform: uppercase;">Customer Information</h3>
                    <p style="margin: 5px 0; font-weight: bold;">${customerInfo.name || 'Not provided'}</p>
                    ${customerInfo.company ? `<p style="margin: 5px 0;">${customerInfo.company}</p>` : ''}
                    <p style="margin: 5px 0;">${customerInfo.email || 'Not provided'}</p>
                    ${customerInfo.phone ? `<p style="margin: 5px 0;">${customerInfo.phone}</p>` : ''}
                </div>
                <div style="flex: 1;">
                    <h3 style="color: #4cb354; margin: 0 0 10px 0; font-size: 14px; text-transform: uppercase;">Project Details</h3>
                    <p style="margin: 5px 0;"><strong>Type:</strong> Cap Embroidery</p>
                    ${customerInfo.project ? `<p style="margin: 5px 0;"><strong>Project:</strong> ${customerInfo.project}</p>` : ''}
                    <p style="margin: 5px 0;"><strong>Total Pieces:</strong> ${this.currentQuote.totalQuantity}</p>
                    <p style="margin: 5px 0;"><strong>Pricing Tier:</strong> ${this.currentQuote.tier}</p>
                    <p style="margin: 5px 0;"><strong>Quote Prepared By:</strong> ${customerInfo.salesRepName || 'General Sales'}</p>
                </div>
            </div>
            
            <!-- Embroidery Package -->
            <div style="padding: 20px; background: #e8f5e9; margin: 20px 0; border-radius: 8px;">
                <h3 style="color: #4cb354; margin: 0 0 15px 0;">EMBROIDERY PACKAGE FOR THIS ORDER:</h3>
        `;
        
        this.currentQuote.logos.forEach(logo => {
            const isPrimary = logo.position === 'Cap Front';
            html += `
                <div style="margin: 8px 0;">
                    <span style="color: #4cb354;">✓</span> 
                    <strong>${logo.position}</strong> (${logo.stitchCount.toLocaleString()} stitches)
                    <span style="color: #666; font-style: italic;">
                        - ${isPrimary ? 'INCLUDED IN BASE PRICE' : 'ADDITIONAL LOGO'}
                    </span>
                </div>
            `;
        });
        
        html += `</div>`;
        
        // Products Table
        html += `
            <div style="padding: 20px;">
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                    <thead>
                        <tr style="background: #4cb354; color: white;">
                            <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">DESCRIPTION</th>
                            <th style="padding: 10px; text-align: center; border: 1px solid #ddd;">QUANTITY</th>
                            <th style="padding: 10px; text-align: right; border: 1px solid #ddd;">UNIT PRICE</th>
                            <th style="padding: 10px; text-align: right; border: 1px solid #ddd;">TOTAL</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        // Add each product
        this.currentQuote.products.forEach(product => {
            // Get consolidated price per cap
            const additionalLogoPrices = product.pricingBreakdown?.additionalLogoPrices || [];
            const additionalLogoCostPerPiece = additionalLogoPrices.reduce((sum, logo) => sum + logo.pricePerPiece, 0);
            const pricePerCap = product.sizePricedItems[0].unitPrice + additionalLogoCostPerPiece;
            const lineTotal = pricePerCap * product.totalQuantity;
            
            // Logo description
            let logoDesc = 'Includes front logo';
            const additionalLogos = this.currentQuote.logos.filter(l => l.position !== 'Cap Front');
            if (additionalLogos.length > 0) {
                logoDesc += ' + ' + additionalLogos.map(l => l.position.toLowerCase()).join(', ');
            }
            
            html += `
                <tr>
                    <td style="padding: 10px; border: 1px solid #ddd;">
                        <strong>${product.styleNumber} - ${product.color}</strong><br>
                        ${product.title}<br>
                        <span style="color: #666; font-size: 12px;">
                            Size: ${product.sizePricedItems.map(item => item.size).join(', ')}<br>
                            ${logoDesc}
                        </span>
                    </td>
                    <td style="padding: 10px; text-align: center; border: 1px solid #ddd;">${product.totalQuantity}</td>
                    <td style="padding: 10px; text-align: right; border: 1px solid #ddd;">$${pricePerCap.toFixed(2)}</td>
                    <td style="padding: 10px; text-align: right; border: 1px solid #ddd;">$${lineTotal.toFixed(2)}</td>
                </tr>
            `;
        });
        
        // Calculate totals with tax
        const productSubtotal = this.currentQuote.subtotal + (this.currentQuote.additionalEmbroideryTotal || 0);
        const subtotalBeforeTax = productSubtotal + this.currentQuote.setupFees;
        const salesTax = subtotalBeforeTax * 0.101; // 10.1% Milton, WA sales tax
        const grandTotalWithTax = subtotalBeforeTax + salesTax;
        
        // Add totals rows
        html += `
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colspan="3" style="padding: 10px; text-align: right; border: 1px solid #ddd;">
                                <strong>Subtotal (${this.currentQuote.totalQuantity} pieces):</strong>
                            </td>
                            <td style="padding: 10px; text-align: right; border: 1px solid #ddd;">
                                <strong>$${subtotalBeforeTax.toFixed(2)}</strong>
                            </td>
                        </tr>
                        <tr>
                            <td colspan="3" style="padding: 10px; text-align: right; border: 1px solid #ddd;">
                                Milton, WA Sales Tax (10.1%):
                            </td>
                            <td style="padding: 10px; text-align: right; border: 1px solid #ddd;">
                                $${salesTax.toFixed(2)}
                            </td>
                        </tr>
                        <tr style="background: #f8f9fa;">
                            <td colspan="3" style="padding: 10px; text-align: right; border: 1px solid #ddd; font-size: 18px;">
                                <strong>GRAND TOTAL:</strong>
                            </td>
                            <td style="padding: 10px; text-align: right; border: 1px solid #ddd; font-size: 18px; color: #4cb354;">
                                <strong>$${grandTotalWithTax.toFixed(2)}</strong>
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        `;
        
        // Special Notes
        const notes = document.getElementById('quote-notes')?.value.trim() || document.getElementById('special-notes')?.value.trim();
        if (notes) {
            html += `
                <div style="padding: 20px; background: #fff9c4; margin: 20px; border-radius: 8px;">
                    <h3 style="color: #f9a825; margin: 0 0 10px 0;">Special Notes</h3>
                    <p style="margin: 0; color: #666;">${notes}</p>
                </div>
            `;
        }
        
        // Terms & Conditions
        html += `
            <div style="padding: 20px; background: #f8f9fa; border-radius: 0 0 8px 8px;">
                <h3 style="color: #4cb354; margin: 0 0 15px 0;">Terms & Conditions:</h3>
                <ul style="margin: 0; padding-left: 20px; color: #666; line-height: 1.6;">
                    <li>This quote is valid for 30 days from the date of issue</li>
                    <li>50% deposit required to begin production</li>
                    <li>Production time: 14 business days after order and art approval</li>
                    <li>Rush production available (7 business days) - add 25%</li>
                    <li>Prices subject to change based on final artwork requirements</li>
                </ul>
                
                <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
                    <p style="color: #4cb354; font-weight: bold; margin: 10px 0;">
                        Thank you for choosing Northwest Custom Apparel!
                    </p>
                    <p style="color: #666; font-size: 12px; margin: 5px 0;">
                        Northwest Custom Apparel | Since 1977 | 2025 Freeman Road East, Milton, WA 98354 | (253) 922-5793
                    </p>
                </div>
            </div>
        </div>
        `;
        
        return html;
    }
    
    /**
     * Generate print-friendly HTML
     */
    generatePrintHTML(quoteID, quoteData) {
        if (!this.currentQuote) return '';
        
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + 30);
        
        let html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Cap Embroidery Quote ${quoteID}</title>
                <style>
                    @page {
                        margin: 0.3in;
                        size: letter;
                    }
                    body {
                        font-family: Arial, sans-serif;
                        font-size: 10px;
                        line-height: 1.2;
                        color: #333;
                        margin: 0;
                    }
                    
                    /* Compact invoice header */
                    .invoice-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: flex-start;
                        margin-bottom: 12px;
                        padding-bottom: 8px;
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
                        gap: 10px;
                        margin-bottom: 10px;
                    }
                    .info-box {
                        flex: 1;
                        background: #f8f9fa;
                        padding: 6px;
                        border-radius: 4px;
                    }
                    .info-box h3 {
                        margin: 0 0 5px 0;
                        font-size: 12px;
                        color: #4cb354;
                        text-transform: uppercase;
                    }
                    .info-box p {
                        margin: 2px 0;
                        font-size: 11px;
                    }
                    
                    /* Compact table */
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-bottom: 12px;
                    }
                    th, td {
                        padding: 4px 6px;
                        text-align: left;
                        border: 1px solid #ddd;
                        font-size: 10px;
                    }
                    th {
                        background: #4cb354;
                        color: white;
                        font-weight: bold;
                        text-transform: uppercase;
                    }
                    td:last-child, th:last-child {
                        text-align: right;
                    }
                    .subtotal-row td {
                        border-top: 2px solid #ddd;
                        font-weight: bold;
                    }
                    .total-row td {
                        background: #f8f9fa;
                        font-weight: bold;
                        font-size: 13px;
                        border-top: 2px solid #4cb354;
                    }
                    
                    /* Terms section */
                    .terms {
                        margin-top: 20px;
                        padding: 15px;
                        background: #f8f9fa;
                        border-radius: 4px;
                    }
                    .terms h3 {
                        margin: 0 0 10px 0;
                        font-size: 12px;
                        color: #4cb354;
                    }
                    .terms ul {
                        margin: 0;
                        padding-left: 20px;
                        font-size: 11px;
                        color: #666;
                        line-height: 1.6;
                    }
                    .terms li {
                        margin: 3px 0;
                    }

                    /* Compact footer */
                    .footer {
                        text-align: center;
                        font-size: 10px;
                        color: #666;
                        border-top: 1px solid #ddd;
                        padding-top: 10px;
                    }
                    .footer p {
                        margin: 2px 0;
                    }
                    
                    @media print {
                        body { 
                            print-color-adjust: exact; 
                            -webkit-print-color-adjust: exact; 
                        }
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
                        <div class="quote-id">${quoteID}</div>
                        <p>Date: ${new Date().toLocaleDateString()}</p>
                        <p>Valid for: 30 days</p>
                    </div>
                </div>
                
                <!-- Customer and project info -->
                <div class="info-row">
                    <div class="info-box">
                        <h3>Customer Information</h3>
                        <p><strong>${quoteData.customerInfo?.name || 'Customer'}</strong></p>
                        ${quoteData.customerInfo?.company ? `<p>${quoteData.customerInfo.company}</p>` : ''}
                        <p>${quoteData.customerInfo?.email || ''}</p>
                        <p>${quoteData.customerInfo?.phone || ''}</p>
                    </div>
                    <div class="info-box">
                        <h3>Project Details</h3>
                        <p><strong>Type:</strong> Cap Embroidery</p>
                        ${quoteData.customerInfo?.project ? `<p><strong>Project:</strong> ${quoteData.customerInfo.project}</p>` : ''}
                        <p><strong>Total Pieces:</strong> ${this.currentQuote.totalQuantity}</p>
                        <p><strong>Pricing Tier:</strong> ${this.currentQuote.tier}</p>
                        ${quoteData.customerInfo?.salesRepName ? `<p><strong>Quote Prepared By:</strong> ${quoteData.customerInfo.salesRepName}</p>` : ''}
                    </div>
                </div>
                
                <!-- Embroidery Package Breakdown -->
                <div style="background: #f0f8f0; border: 1px solid #4cb354; padding: 10px; border-radius: 4px; margin-bottom: 20px;">
                    <h3 style="margin: 0 0 8px 0; font-size: 13px; color: #4cb354; text-transform: uppercase;">Embroidery Package for This Order:</h3>
        `;
        
        // Build the embroidery package details
        const frontLogo = this.currentQuote.logos.find(l => l.position === 'Cap Front');
        const additionalLogos = this.currentQuote.logos.filter(l => l.position !== 'Cap Front');
        const hasLTM = this.currentQuote.hasLTM;
        const ltmPerPiece = hasLTM ? (this.currentQuote.ltmFeeTotal / this.currentQuote.totalQuantity) : 0;
        
        // Show front logo
        if (frontLogo) {
            html += `<p style="margin: 3px 0; font-size: 11px;">✓ ${frontLogo.position} (${frontLogo.stitchCount.toLocaleString()} stitches) - <strong>INCLUDED IN BASE PRICE</strong></p>`;
        }
        
        // Show additional logos with individual pricing
        additionalLogos.forEach(logo => {
            // Get the actual price for this logo position
            const logoPrice = 6.00; // This should be calculated based on actual pricing
            html += `<p style="margin: 3px 0; font-size: 11px;">✓ ${logo.position} (${logo.stitchCount.toLocaleString()} stitches) - <strong>ADDITIONAL (+$${logoPrice.toFixed(2)})</strong></p>`;
        });
        
        // Show small batch fee if applicable
        if (hasLTM) {
            html += `<p style="margin: 3px 0; font-size: 11px;">✓ Small Batch Fee - <strong>ADDITIONAL (+$${ltmPerPiece.toFixed(2)} per piece for orders under 24)</strong></p>`;
        }
        
        html += `
                </div>
                
                <!-- Main Invoice Table -->
                <table>
                    <thead>
                        <tr>
                            <th width="50%">Description</th>
                            <th width="15%">Quantity</th>
                            <th width="15%">Unit Price</th>
                            <th width="20%">Total</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        // Don't need the header row anymore since we have the package breakdown above
        
        // Add each product with proper formatting
        this.currentQuote.products.forEach(product => {
            const additionalLogoPrices = product.pricingBreakdown?.additionalLogoPrices || [];
            const additionalLogoCostPerPiece = additionalLogoPrices.reduce((sum, logo) => sum + logo.pricePerPiece, 0);

            // Group line items by price (regular vs upsized)
            const priceGroups = {};
            product.sizePricedItems.forEach(item => {
                const consolidatedPricePerCap = item.unitPrice + additionalLogoCostPerPiece;
                const priceKey = consolidatedPricePerCap.toFixed(2);

                if (!priceGroups[priceKey]) {
                    priceGroups[priceKey] = {
                        price: consolidatedPricePerCap,
                        items: [],
                        totalQty: 0,
                        totalAmount: 0,
                        sizes: [],
                        hasUpcharge: false
                    };
                }

                priceGroups[priceKey].items.push(item);
                priceGroups[priceKey].totalQty += item.quantity;
                priceGroups[priceKey].totalAmount += consolidatedPricePerCap * item.quantity;
                priceGroups[priceKey].sizes.push(item.size);
                if (item.sizeUpcharge > 0) {
                    priceGroups[priceKey].hasUpcharge = true;
                }
            });

            // Display grouped items
            Object.values(priceGroups).forEach(group => {
                const sizeLabel = group.sizes.length > 1 ?
                    `Sizes: ${group.sizes.join(', ')}` :
                    `Size: ${group.sizes[0]}`;
                const upchargeNote = group.hasUpcharge ? ` (includes size upcharge)` : '';

                html += `
                        <tr>
                            <td>
                                <strong>${product.styleNumber} - ${product.color}</strong><br>
                                ${product.title} | ${product.brand}<br>
                                <span style="color: #666; font-size: 10px;">
                                    ${sizeLabel}${upchargeNote}<br>
                                    ${this.currentQuote.logos.length} logo position${this.currentQuote.logos.length !== 1 ? 's' : ''}
                                </span>
                            </td>
                            <td>${group.totalQty}</td>
                            <td>$${group.price.toFixed(2)}</td>
                            <td>$${group.totalAmount.toFixed(2)}</td>
                        </tr>
                `;
            });
        });
        
        // Add setup fees if any
        if (this.currentQuote.setupFees > 0) {
            const digitizingLogos = this.currentQuote.logos.filter(l => l.needsDigitizing).length;
            html += `
                        <tr>
                            <td>
                                <strong>Digitizing Setup Fees</strong><br>
                                <span style="font-size: 10px; color: #666;">
                                    ${digitizingLogos} logo${digitizingLogos > 1 ? 's' : ''} @ $100.00 each
                                </span>
                            </td>
                            <td>${digitizingLogos}</td>
                            <td>$100.00</td>
                            <td>$${this.currentQuote.setupFees.toFixed(2)}</td>
                        </tr>
            `;
        }
        
        // Add totals with sales tax
        const productSubtotal = this.currentQuote.subtotal + (this.currentQuote.additionalEmbroideryTotal || 0);
        const subtotalBeforeTax = productSubtotal + this.currentQuote.setupFees;
        const salesTax = subtotalBeforeTax * 0.101; // 10.1% Milton, WA sales tax
        const grandTotalWithTax = subtotalBeforeTax + salesTax;
        
        html += `
                    </tbody>
                    <tfoot>
                        <tr class="subtotal-row">
                            <td colspan="3" style="text-align: right; font-weight: bold;">Subtotal (${this.currentQuote.totalQuantity} pieces):</td>
                            <td style="text-align: right; font-weight: bold;">$${productSubtotal.toFixed(2)}</td>
                        </tr>
        `;
        
        if (this.currentQuote.setupFees > 0) {
            html += `
                        <tr>
                            <td colspan="3" style="text-align: right;">Setup Fees:</td>
                            <td style="text-align: right;">$${this.currentQuote.setupFees.toFixed(2)}</td>
                        </tr>
                        <tr>
                            <td colspan="3" style="text-align: right; font-weight: bold;">Subtotal before tax:</td>
                            <td style="text-align: right; font-weight: bold;">$${subtotalBeforeTax.toFixed(2)}</td>
                        </tr>
            `;
        }
        
        html += `
                        <tr>
                            <td colspan="3" style="text-align: right;">Milton, WA Sales Tax (10.1%):</td>
                            <td style="text-align: right;">$${salesTax.toFixed(2)}</td>
                        </tr>
                        <tr class="total-row">
                            <td colspan="3" style="text-align: right; font-size: 14px;"><strong>GRAND TOTAL:</strong></td>
                            <td style="text-align: right; font-size: 14px;"><strong>$${grandTotalWithTax.toFixed(2)}</strong></td>
                        </tr>
                    </tfoot>
                </table>
        `;

        // Always add special notes section (for consistency with embroidery)
        const notes = quoteData.customerInfo?.notes || '';
        html += `
            <div style="background: #fff9c4; border: 1px solid #f9a825; padding: 10px; border-radius: 4px; margin-bottom: 15px;">
                <h3 style="margin: 0 0 8px 0; color: #f9a825; font-size: 12px;">Special Notes</h3>
                <p style="margin: 0; font-size: 11px; color: #666;">${notes || '<em style="color: #999;">No special notes for this quote</em>'}</p>
            </div>
        `;

        // Add footer with terms - matching embroidery style
        html += `
                <div class="terms">
                    <h3>Terms & Conditions:</h3>
                    <ul>
                        <li>This quote is valid for 30 days from the date of issue</li>
                        <li>50% deposit required to begin production</li>
                        <li>Production time: 14 business days after order and art approval</li>
                        <li>Rush production available (7 business days) - add 25%</li>
                        <li>Prices subject to change based on final artwork requirements</li>
                    </ul>
                </div>

                <div class="footer" style="text-align: center; margin-top: 25px; padding-top: 15px; border-top: 1px solid #ddd;">
                    <p style="color: #4cb354; font-weight: bold; font-size: 14px; margin-bottom: 8px;">Thank you for choosing Northwest Custom Apparel!</p>
                    <p style="font-size: 10px; color: #666;">Northwest Custom Apparel | Since 1977 | 2025 Freeman Road East, Milton, WA 98354 | (253) 922-5793</p>
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
     * Show success notification (simplified from modal)
     */
    showSuccessModal(quoteID, quoteData) {
        // Store quote data globally for page buttons
        window.lastQuoteData = {
            quoteId: quoteID,
            customerName: quoteData.customerInfo?.name || 'Customer',
            customerEmail: quoteData.customerInfo?.email || '',
            customerPhone: quoteData.customerInfo?.phone || '',
            companyName: quoteData.customerInfo?.company || '',
            projectName: quoteData.customerInfo?.project || '',
            items: quoteData.products || [],
            grandTotal: quoteData.grandTotal || 0
        };
        
        // Show success message (non-modal)
        const successMessage = `
            <div style="display: flex; align-items: center; gap: 15px;">
                <i class="fas fa-check-circle" style="color: #28a745; font-size: 24px;"></i>
                <div>
                    <strong>Quote Saved Successfully!</strong><br>
                    Quote ID: ${quoteID}<br>
                    Customer: ${quoteData.customerInfo?.name || 'Customer'}<br>
                    Total: $${quoteData.grandTotal.toFixed(2)}
                </div>
            </div>
        `;
        
        // Create toast notification
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: white;
            color: #333;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 10000;
            min-width: 350px;
            border-left: 4px solid #28a745;
            animation: slideIn 0.3s ease-out;
        `;
        toast.innerHTML = successMessage;
        document.body.appendChild(toast);
        
        // Add animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideIn {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
        `;
        document.head.appendChild(style);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            toast.style.animation = 'slideIn 0.3s ease-out reverse';
            setTimeout(() => toast.remove(), 300);
        }, 5000);
        
        console.log('[CapQuoteBuilder] Success notification displayed:', quoteID);
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
     * Show error message with details
     */
    showErrorMessage(title, message) {
        // Create error notification
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: white;
            color: #333;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 10000;
            min-width: 400px;
            max-width: 500px;
            border-left: 4px solid #dc3545;
        `;
        
        errorDiv.innerHTML = `
            <div style="display: flex; align-items: flex-start; gap: 15px;">
                <i class="fas fa-exclamation-triangle" style="color: #dc3545; font-size: 24px; margin-top: 3px;"></i>
                <div style="flex: 1;">
                    <strong style="color: #dc3545; font-size: 16px;">${title}</strong>
                    <p style="margin: 10px 0 0 0; white-space: pre-line;">${message}</p>
                </div>
                <button onclick="this.parentElement.parentElement.remove()" 
                        style="background: none; border: none; color: #666; cursor: pointer; font-size: 20px; padding: 0; margin: -5px -5px 0 0;">
                    ×
                </button>
            </div>
        `;
        
        document.body.appendChild(errorDiv);
        
        // Auto-remove after 10 seconds
        setTimeout(() => {
            if (errorDiv.parentElement) {
                errorDiv.remove();
            }
        }, 10000);
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