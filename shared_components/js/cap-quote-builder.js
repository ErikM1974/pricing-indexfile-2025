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

        // Remove active class from all phases (CSS will handle hiding)
        document.querySelectorAll('.phase-section').forEach(section => {
            section.classList.remove('active');
        });

        // Remove active class from all nav steps
        document.querySelectorAll('.phase-step').forEach(step => {
            step.classList.remove('active');
        });

        // Add active class to target phase (CSS will handle showing)
        const targetPhase = document.getElementById(`${this.getPhaseId(phase)}-phase`);
        if (targetPhase) {
            targetPhase.classList.add('active');
        }

        // Activate nav step
        const navStep = document.getElementById(`phase-${phase}-nav`);
        if (navStep) {
            navStep.classList.add('active');
        }

        this.currentPhase = phase;

        // Dispatch phase change event for the quote indicator
        // CRITICAL: Include both numeric phase and the actual phase ID for proper widget handling
        const phaseId = this.getPhaseId(phase);
        document.dispatchEvent(new CustomEvent('phaseChanged', {
            detail: {
                phase: phase,
                phaseId: phaseId,
                phaseName: phaseId + '-phase',  // e.g., 'summary-phase'
                source: 'CapQuoteBuilder'
            }
        }));

        // Also directly hide the widget if we're on step 3 (Summary)
        if (phase === 3 && window.quoteIndicator && window.quoteIndicator.widget) {
            console.log('[CapQuoteBuilder] Hiding quote widget for Step 3');
            window.quoteIndicator.widget.style.display = 'none';
            window.quoteIndicator.widget.style.visibility = 'hidden';
        }
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

        // NEW UNIFIED DESIGN - Two-column layout (content + sidebar)
        let html = '<div class="phase3-unified-container">';

        // Header with key info (spans full width)
        html += `
            <div class="phase3-header">
                <div class="phase3-title">
                    <h3>Cap Embroidery Quote Summary</h3>
                    <div class="phase3-meta">
                        <span class="meta-item"><i class="fas fa-box"></i> ${this.currentQuote.totalQuantity} pieces</span>
                        <span class="meta-item"><i class="fas fa-layer-group"></i> ${this.currentQuote.tier}</span>
                    </div>
                </div>
            </div>
        `;

        // LEFT COLUMN: Content wrapper (scrollable)
        html += '<div class="phase3-content-wrapper">';

        // Embroidery specifications - compact list
        html += `
            <div class="phase3-section embroidery-specs">
                <h4 class="section-title"><i class="fas fa-thread"></i> Embroidery Details</h4>
                <div class="logo-list">
        `;

        this.currentQuote.logos.forEach((logo, idx) => {
            const isPrimary = logo.isRequired || idx === 0;
            html += `
                <div class="logo-item">
                    <span class="logo-icon">${isPrimary ? '⭐' : '➕'}</span>
                    <div class="logo-info">
                        <strong>${logo.position}</strong>
                        <span class="logo-detail">${logo.stitchCount.toLocaleString()} stitches</span>
                    </div>
                    ${isPrimary ? '<span class="badge-primary">INCLUDED</span>' : '<span class="badge-additional">ADDITIONAL</span>'}
                    ${logo.needsDigitizing ? '<span class="badge-setup">+$100 Setup</span>' : ''}
                </div>
            `;
        });

        if (this.currentQuote.hasLTM) {
            html += '<div class="ltm-alert"><i class="fas fa-info-circle"></i> Small batch fee included for orders under 24 pieces</div>';
        }

        html += '</div></div>';

        // Products section - cleaner cards
        html += '<div class="phase3-section products-list">';
        html += '<h4 class="section-title"><i class="fas fa-hat-cowboy"></i> Cap Products</h4>';
        
        this.currentQuote.products.forEach(product => {
            html += `
                <div class="product-card">
                    <div class="product-card-header-wrapper">
                        <div class="product-card-image-section">
                            <img src="${product.imageUrl || 'https://via.placeholder.com/200x200/4cb354/white?text=' + encodeURIComponent(product.styleNumber)}"
                                 alt="${product.styleNumber}"
                                 class="product-card-img"
                                 onerror="this.src='https://via.placeholder.com/200x200/4cb354/white?text=' + encodeURIComponent('${product.styleNumber}')">
                        </div>
                        <div class="product-card-info-section">
                            <h5 class="product-name">${product.styleNumber} - ${product.color}</h5>
                            <p class="product-desc">${product.title}</p>
                            <div class="product-meta">
                                <span class="meta-badge"><i class="fas fa-box"></i> ${product.totalQuantity} pieces</span>
                                <span class="meta-badge"><i class="fas fa-tag"></i> ${product.brand}</span>
                            </div>
                        </div>
                    </div>
                    <div class="product-divider"></div>
                    <div class="product-card-body">
            `;
            
            // Modern horizontal pricing breakdown (e-commerce style)
            product.sizePricedItems.forEach(item => {
                const additionalLogoPrices = product.pricingBreakdown?.additionalLogoPrices || [];
                const additionalLogoCostPerPiece = additionalLogoPrices.reduce((sum, logo) => sum + logo.pricePerPiece, 0);

                // Extract extra stitch data from front logo breakdown (2025-12-19)
                const frontLogoBreakdown = product.pricingBreakdown?.frontLogoBreakdown || {};
                const extraStitchCost = frontLogoBreakdown.extraStitchCost || 0;

                // Extract pricing components (including extra stitches from API)
                const basePrice = item.unitPrice - (item.sizeUpcharge || 0) - extraStitchCost; // Base without upcharge or extra stitches
                const sizeUpcharge = item.sizeUpcharge || 0;
                const ltmFee = item.ltmPerUnit || 0;
                const alCost = additionalLogoCostPerPiece || 0;

                const consolidatedPricePerCap = item.unitPrice + additionalLogoCostPerPiece;
                const lineTotal = consolidatedPricePerCap * item.quantity;

                // Build two-line compact pricing breakdown (2025-12-19)
                // First line: Unit price and line total
                // Second line: Component breakdown with bullets
                let components = [];
                components.push(`<span class="price-component"><span class="component-label">Base</span> <span class="component-value">$${basePrice.toFixed(2)}</span></span>`);

                if (sizeUpcharge > 0) {
                    components.push(`<span class="price-component"><span class="component-label">Oversize</span> <span class="component-value">$${sizeUpcharge.toFixed(2)}</span></span>`);
                }

                // NEW: Show extra stitches from API if present
                if (extraStitchCost > 0) {
                    components.push(`<span class="price-component"><span class="component-label">Extra Stitches</span> <span class="component-value">$${extraStitchCost.toFixed(2)}</span></span>`);
                }

                if (ltmFee > 0) {
                    components.push(`<span class="price-component"><span class="component-label">Small Batch</span> <span class="component-value">$${ltmFee.toFixed(2)}</span></span>`);
                }

                if (alCost > 0) {
                    components.push(`<span class="price-component"><span class="component-label">Add'l Logo</span> <span class="component-value">$${alCost.toFixed(2)}</span></span>`);
                }

                html += `
                    <div class="size-line">
                        <div class="size-line-header">
                            <span class="size-badge">${item.size}</span>
                            <span class="size-qty">${item.quantity} pieces</span>
                        </div>
                        <span class="unit-price-display">$${consolidatedPricePerCap.toFixed(2)} /ea</span>
                        <span class="line-total">$${lineTotal.toFixed(2)}</span>
                        <div class="price-components">
                            ${components.join('')}
                        </div>
                    </div>
                `;
            });
            
            // Product card footer with subtotal
            const additionalLogoPrices = product.pricingBreakdown?.additionalLogoPrices || [];
            const additionalLogoCostPerPiece = additionalLogoPrices.reduce((sum, logo) => sum + logo.pricePerPiece, 0);
            const productTotal = product.sizePricedItems.reduce((sum, item) => {
                const consolidatedPricePerCap = item.unitPrice + additionalLogoCostPerPiece;
                return sum + (consolidatedPricePerCap * item.quantity);
            }, 0);

            html += `
                    <div class="product-card-footer">
                        <span class="footer-label">Product Total:</span>
                        <span class="footer-amount">$${productTotal.toFixed(2)}</span>
                    </div>
                </div>
            `;
        });

        html += '</div>'; // Close products-list

        html += '</div>'; // Close phase3-content-wrapper (LEFT COLUMN)

        // RIGHT COLUMN: Sticky sidebar with totals
        html += '<div class="phase3-sidebar">';

        // Invoice-style totals section
        html += `
            <div class="phase3-section totals-section">
                <h4 class="section-title"><i class="fas fa-calculator"></i> Quote Total</h4>
                <div class="totals-table">
                    <div class="total-row">
                        <span class="total-label">Caps & Embroidery${this.currentQuote.hasLTM ? ' (includes small batch fee)' : ''}:</span>
                        <span class="total-value">$${(this.currentQuote.subtotal + (this.currentQuote.additionalEmbroideryTotal || 0)).toFixed(2)}</span>
                    </div>
        `;

        if (this.currentQuote.setupFees > 0) {
            const digitizingLogos = this.currentQuote.logos.filter(l => l.needsDigitizing).length;
            html += `
                    <div class="total-row">
                        <span class="total-label">Digitizing Setup (${digitizingLogos} logo${digitizingLogos > 1 ? 's' : ''}):</span>
                        <span class="total-value">$${this.currentQuote.setupFees.toFixed(2)}</span>
                    </div>
            `;
        }

        html += `
                    <div class="total-row grand-total-row">
                        <span class="total-label"><strong>GRAND TOTAL:</strong></span>
                        <span class="total-value"><strong>$${this.currentQuote.grandTotal.toFixed(2)}</strong></span>
                    </div>
                </div>
            </div>
        `;

        html += '</div>'; // Close phase3-sidebar (RIGHT COLUMN)

        html += '</div>'; // Close phase3-unified-container (GRID WRAPPER)

        summaryContainer.innerHTML = html;

        console.log('[CapQuoteBuilder] Quote summary rendered with modern unified design');
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

        // Pass false to use generic customer data for quick copy
        const quoteText = this.generateQuoteText(false);

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
    generateQuoteText(useCustomerData = false) {
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

        // Customer information - use form data only when requested
        const customerInfo = useCustomerData ? this.collectCustomerInfo() : {
            name: 'Customer',
            email: 'Not Provided',
            phone: '',
            company: '',
            project: '',
            notes: '',
            salesRepName: 'General Sales'
        };
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

        // Add LTM fee notice if applicable
        if (this.currentQuote.hasLTM) {
            const ltmPerPiece = this.currentQuote.ltmFeeTotal / this.currentQuote.totalQuantity;
            text += `⚠ Small Batch Fee - ADDITIONAL (+$${ltmPerPiece.toFixed(2)} per piece for orders under 24)
`;
        }

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
            const logoCount = this.currentQuote.logos ? this.currentQuote.logos.length : 0;
            text += `${logoCount} logo position${logoCount !== 1 ? 's' : ''}
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
        const notes = document.getElementById('quote-notes')?.value.trim() || document.getElementById('special-notes')?.value.trim() || customerInfo.notes;
        if (notes) {
            text += `Special Notes:
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