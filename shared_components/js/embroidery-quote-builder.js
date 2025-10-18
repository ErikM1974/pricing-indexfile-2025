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
     * Initialize async components (call after constructor)
     */
    async init() {
        console.log('[EmbroideryQuoteBuilder] Starting async initialization...');

        // Initialize logo manager (fetches API configuration)
        await this.logoManager.init();

        console.log('[EmbroideryQuoteBuilder] Async initialization complete');
        return this;
    }
    
    /**
     * Initialize UI components
     */
    initializeUI() {
        this.showPhase('logo');
        // Primary logo is initialized by LogoManager constructor
        // Additional logos are added by user via "Add Additional Position" button
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

        // Quick Actions (no customer info required)
        document.getElementById('copy-quote-btn')?.addEventListener('click', () => {
            this.handleCopyQuote();
        });

        document.getElementById('print-quote-btn')?.addEventListener('click', () => {
            this.handlePrintQuote();
        });

        document.getElementById('download-quote-btn')?.addEventListener('click', () => {
            this.handleDownloadQuote();
        });

        // Save & Send Actions (require customer info)
        document.getElementById('save-quote-btn')?.addEventListener('click', () => {
            this.handleSaveQuote();
        });

        document.getElementById('email-quote-btn')?.addEventListener('click', () => {
            this.handleEmailQuote();
        });

        document.getElementById('new-quote-btn')?.addEventListener('click', () => {
            this.handleNewQuote();
        });

        // Collapsible Save & Send section (Industry standard pattern)
        const saveSendHeader = document.getElementById('save-send-header');
        if (saveSendHeader) {
            saveSendHeader.addEventListener('click', () => {
                this.toggleSaveSendSection();
            });
        }
        
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

        // Trigger phase change event for quote indicator
        document.dispatchEvent(new CustomEvent('phaseChanged', {
            detail: phase === 'product' ? 'product-phase' : phase
        }));
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
     * Render summary display - Modern Phase 3 redesign (matches Cap Embroidery)
     */
    renderSummary() {
        const container = document.getElementById('quote-summary');
        if (!container || !this.currentPricing) return;

        // NEW UNIFIED DESIGN - Single professional container
        let html = '<div class="phase3-unified-container">';

        // Modern header with gradient and key info
        html += `
            <div class="phase3-header">
                <div class="phase3-title">
                    <h3>Embroidery Quote Summary</h3>
                    <div class="phase3-meta">
                        <span class="meta-item"><i class="fas fa-box"></i> ${this.currentPricing.totalQuantity} pieces</span>
                        <span class="meta-item"><i class="fas fa-layer-group"></i> ${this.currentPricing.tier}</span>
                    </div>
                </div>
            </div>
        `;

        // LEFT COLUMN: Scrollable content wrapper
        html += '<div class="phase3-content-wrapper">';

        // Embroidery specifications - compact list
        html += `
            <div class="phase3-section embroidery-specs">
                <h4 class="section-title"><i class="fas fa-thread"></i> Embroidery Details</h4>
                <div class="logo-list">
        `;

        // Show primary logo first
        const primaryLogos = this.currentPricing.logos.filter((l, idx) => idx === 0);
        const additionalLogos = this.currentPricing.logos.filter((l, idx) => idx > 0);

        primaryLogos.forEach(logo => {
            html += `
                <div class="logo-item">
                    <span class="logo-icon">✓</span>
                    <div class="logo-info">
                        <strong>${logo.position}</strong>
                        <div class="logo-detail">${logo.stitchCount.toLocaleString()} stitches</div>
                    </div>
                    <span class="badge-primary">Primary Logo</span>
                    ${logo.needsDigitizing ? '<span class="badge-setup" style="margin-left: 8px;">+$100 Setup</span>' : ''}
                </div>
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
                <div class="logo-item">
                    <span class="logo-icon">✓</span>
                    <div class="logo-info">
                        <strong>${logo.position}</strong>
                        <div class="logo-detail">${logo.stitchCount.toLocaleString()} stitches${alPrice > 0 ? ` • +$${alPrice.toFixed(2)}/piece` : ''}</div>
                    </div>
                    <span class="badge-additional">Additional</span>
                    ${logo.needsDigitizing ? '<span class="badge-setup" style="margin-left: 8px;">+$100 Setup</span>' : ''}
                </div>
            `;
        });

        // Show small batch fee if applicable
        if (this.currentPricing.ltmFee > 0) {
            const ltmPerPiece = (this.currentPricing.ltmFee / this.currentPricing.totalQuantity).toFixed(2);
            html += `
                <div class="ltm-alert">
                    <i class="fas fa-info-circle"></i>
                    <strong>Small Batch Fee:</strong> +$${ltmPerPiece} per piece (orders under 24)
                </div>
            `;
        }

        html += '</div></div>'; // Close logo-list and embroidery-specs

        // Products section - Modern card design
        html += `
            <div class="phase3-section products-section">
                <h4 class="section-title"><i class="fas fa-tshirt"></i> Products</h4>
        `;

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
                <div class="product-card">
                    <div class="product-card-header">
                        <img src="${pp.product.imageUrl || 'https://via.placeholder.com/100x100/4cb354/white?text=' + encodeURIComponent(pp.product.style)}"
                             alt="${pp.product.style} - ${pp.product.color}"
                             class="product-card-img"
                             onerror="this.src='https://via.placeholder.com/100x100/4cb354/white?text=' + encodeURIComponent('${pp.product.style}')">
                        <div class="product-card-info">
                            <h5 class="product-name">${pp.product.style} - ${pp.product.color}</h5>
                            <p class="product-desc">${pp.product.title}</p>
                            <div class="product-meta">
                                <span class="meta-badge"><i class="fas fa-box"></i> ${pp.product.totalQuantity} pieces</span>
                            </div>
                        </div>
                    </div>
                    <div class="product-card-body">
            `;
            
            // Calculate corrected product subtotal based on corrected line items
            let correctedProductSubtotal = 0;

            // Simplified size breakdown with cleaner pricing
            pp.lineItems.forEach((item, index) => {
                const displayPrice = item.unitPriceWithLTM || item.unitPrice;
                const consolidatedPrice = displayPrice + totalAdditionalLogoCost;
                const lineTotal = consolidatedPrice * item.quantity;
                correctedProductSubtotal += lineTotal;

                html += `
                    <div class="size-line">
                        <div class="size-line-header">
                            <span class="size-qty">${item.description} • ${item.quantity} ${item.quantity === 1 ? 'piece' : 'pieces'}</span>
                        </div>
                        <div class="size-line-pricing">
                            <span class="unit-price">$${consolidatedPrice.toFixed(2)} each</span>
                            <span class="line-total">$${lineTotal.toFixed(2)}</span>
                        </div>
                    </div>
                `;
            });
            
            // Add to overall corrected subtotal
            correctedOverallSubtotal += correctedProductSubtotal;

            html += `
                    </div>
                    <div class="product-card-footer">
                        <span class="footer-label">Product Total:</span>
                        <span class="footer-amount">$${correctedProductSubtotal.toFixed(2)}</span>
                    </div>
                </div>
            `;
        });

        html += '</div>'; // Close products-section

        html += '</div>'; // Close phase3-content-wrapper (LEFT COLUMN)

        // RIGHT COLUMN: Sticky sidebar with totals
        html += '<div class="phase3-sidebar">';

        // Additional Services section removed from display since costs are already included in line item prices
        // The additional services data is still maintained in this.currentPricing.additionalServices for database/email purposes

        // Invoice-style totals section
        // Note: LTM fee is already included in correctedOverallSubtotal via unitPriceWithLTM
        // Since additional services are already included in our corrected line items, we don't double-add them
        const grandTotal = correctedOverallSubtotal + this.currentPricing.setupFees;

        // Calculate tax separately for PDF use (not shown in summary)
        const salesTax = grandTotal * 0.101; // 10.1% Milton, WA sales tax
        const grandTotalWithTax = grandTotal + salesTax;

        html += `
            <div class="phase3-section totals-section">
                <h4 class="section-title"><i class="fas fa-calculator"></i> Quote Total</h4>
                <div class="totals-table">
                    <div class="total-row">
                        <span class="total-label">Products & Embroidery${this.currentPricing.ltmFee > 0 ? ' (includes small batch fee)' : ''}:</span>
                        <span class="total-value">$${correctedOverallSubtotal.toFixed(2)}</span>
                    </div>
        `;

        // Additional services are already included in corrected line item calculations
        // So we don't show them as a separate line in the totals

        if (this.currentPricing.setupFees > 0) {
            html += `
                <div class="total-row">
                    <span class="total-label">Setup Fees (${this.currentPricing.logos.filter(l => l.needsDigitizing).length} logo${this.currentPricing.logos.filter(l => l.needsDigitizing).length > 1 ? 's' : ''}):</span>
                    <span class="total-value">$${this.currentPricing.setupFees.toFixed(2)}</span>
                </div>
            `;
        }

        // Small batch fee is already included in product pricing, so we don't add it as a separate line
        // No subtotal or sales tax lines in summary (like cap quote) - tax only appears in PDF

        html += `
                    <div class="total-row grand-total-row">
                        <span class="total-label">GRAND TOTAL:</span>
                        <span class="total-value">$${grandTotal.toFixed(2)}</span>
                    </div>
                </div>
            </div>
        `;

        html += '</div>'; // Close phase3-sidebar (RIGHT COLUMN)

        html += '</div>'; // Close phase3-unified-container (GRID WRAPPER)

        // Store both totals for later use (summary shows pre-tax, PDF shows with tax)
        this.currentPricing.grandTotal = grandTotal;
        this.currentPricing.grandTotalWithTax = grandTotalWithTax;

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
                    quoteID = this.quoteService.generateQuoteID();
                }
            } else {
                // Generate quote ID for display even if not saving
                quoteID = this.quoteService.generateQuoteID();
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
            const quoteID = this.quoteService.generateQuoteID();
            
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
     * Toggle Save & Send section (collapsible)
     */
    toggleSaveSendSection() {
        const content = document.getElementById('save-send-content');
        const icon = document.getElementById('save-send-icon');
        const status = document.getElementById('save-send-status');

        if (!content) return;

        const isExpanded = content.style.display === 'block';

        if (isExpanded) {
            // Collapse
            content.style.display = 'none';
            icon.style.transform = 'rotate(0deg)';
            status.textContent = 'Click to expand';
        } else {
            // Expand
            content.style.display = 'block';
            icon.style.transform = 'rotate(180deg)';
            status.textContent = 'Click to collapse';
        }
    }

    /**
     * Handle download quote (Quick Action - no customer info required)
     */
    handleDownloadQuote() {
        if (!this.currentPricing) {
            this.showErrorNotification('No Quote Data', 'Please complete your quote first.');
            return;
        }

        console.log('[EmbroideryQuoteBuilder] Handling download quote...');

        // Generate a temporary quote ID for the filename
        const quoteId = this.currentPricing.quoteId || this.quoteService.generateQuoteID();

        // Use generic customer data for quick download
        const customerData = {
            name: 'Customer',
            email: 'Not Provided',
            phone: '',
            company: '',
            project: '',
            notes: '',
            salesRepEmail: 'sales@nwcustomapparel.com'
        };

        // Generate HTML content
        const htmlContent = this.generatePrintHTML(quoteId, customerData, this.currentPricing);

        // Create blob and download
        const blob = new Blob([htmlContent], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Quote_${quoteId}.html`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        this.showSuccessNotification('Quote Downloaded', `Quote saved as Quote_${quoteId}.html`);
    }

    /**
     * Handle copy quote to clipboard (Quick Action - no customer info required)
     */
    handleCopyQuote() {
        if (!this.currentPricing) {
            this.showErrorNotification('No Quote Data', 'Please complete your quote first.');
            return;
        }

        console.log('[EmbroideryQuoteBuilder] Handling copy quote...');

        // Pass false to use generic customer data for quick copy
        const quoteText = this.generateQuoteText(false);
        
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
     * Handle print quote (Quick Action - no customer info required)
     */
    handlePrintQuote() {
        if (!this.currentPricing) {
            this.showErrorNotification('No Quote Data', 'Please complete your quote first.');
            return;
        }

        console.log('[EmbroideryQuoteBuilder] Handling print quote...');

        const quoteId = this.currentPricing.quoteId || this.quoteService.generateQuoteID();

        // Use generic customer data for quick print
        const customerData = {
            name: 'Customer',
            email: 'Not Provided',
            phone: '',
            company: '',
            project: '',
            notes: '',
            salesRepEmail: 'sales@nwcustomapparel.com'
        };

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
    generateQuoteText(useCustomerData = false) {
        if (!this.currentPricing) return '';

        const quoteId = this.currentPricing.quoteId || this.quoteService.generateQuoteID();

        // Use generic data for Quick Actions, form data for Save/Email actions
        const customerData = useCustomerData ? this.getCustomerData() : {
            name: 'Customer',
            email: 'Not Provided',
            phone: '',
            company: '',
            project: '',
            notes: '',
            salesRepEmail: 'sales@nwcustomapparel.com'
        };

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
            text += isPrimary ? ' - INCLUDED IN BASE PRICE' : ` - ADDITIONAL LOGO (+$${logo.additionalLogoCost?.toFixed(2) || '0.00'} per piece)`;
            if (logo.needsDigitizing) text += ' [+$100 Digitizing]';
            text += `\n`;
        });
        if (this.currentPricing.ltmFee > 0) {
            const ltmPerPiece = (this.currentPricing.ltmFee / this.currentPricing.totalQuantity).toFixed(2);
            text += `• Small Batch Fee - ADDITIONAL (+$${ltmPerPiece} per piece)\n`;
        }
        text += `\n`;
        
        // Calculate total additional logo cost per piece
        let totalAdditionalLogoCost = 0;
        if (this.currentPricing.additionalServices) {
            totalAdditionalLogoCost = this.currentPricing.additionalServices
                .reduce((sum, service) => sum + service.unitPrice, 0);
        }
        
        // Products with consolidated pricing
        text += `PRODUCTS:\n`;
        let overallTotal = 0;
        
        this.currentPricing.products.forEach(pp => {
            text += `${pp.product.style} - ${pp.product.color} (${pp.product.totalQuantity} pieces)\n`;
            text += `  ${pp.product.title}\n`;
            
            let productSubtotal = 0;
            pp.lineItems.forEach(item => {
                // Calculate consolidated price (base + LTM + additional logos)
                const basePrice = item.unitPriceWithLTM || item.unitPrice;
                const consolidatedPrice = basePrice + totalAdditionalLogoCost;
                const lineTotal = consolidatedPrice * item.quantity;
                
                text += `  ${item.description}: ${item.quantity} @ $${consolidatedPrice.toFixed(2)} = $${lineTotal.toFixed(2)}\n`;
                productSubtotal += lineTotal;
            });
            
            text += `  Subtotal: $${productSubtotal.toFixed(2)}\n\n`;
            overallTotal += productSubtotal;
        });
        
        // Setup fees (digitizing)
        if (this.currentPricing.setupFees > 0) {
            text += `SETUP FEES:\n`;
            text += `Digitizing: $${this.currentPricing.setupFees.toFixed(2)}\n\n`;
            overallTotal += this.currentPricing.setupFees;
        }
        
        // Totals - using corrected overall total
        const salesTax = overallTotal * 0.101;
        const grandTotalWithTax = overallTotal + salesTax;
        
        text += `TOTALS:\n`;
        text += `Subtotal: $${overallTotal.toFixed(2)}\n`;
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
                const isPrimary = index === 0; // First logo is always primary
                const logoType = isPrimary ? 'PRIMARY LOGO - INCLUDED IN BASE PRICE' : `ADDITIONAL LOGO`;
                
                html += `<p>✓ <strong>${logo.position}</strong> (${logo.stitchCount.toLocaleString()} stitches) - <em>${logoType}</em></p>`;
                
                if (logo.needsDigitizing) {
                    html += `<p style="margin-left: 15px; color: #666;">• Digitizing Fee: $100.00</p>`;
                }
            });
        }
        
        // Add LTM fee notice if applicable
        if (pricing.ltmFee && pricing.ltmFee > 0) {
            const ltmPerPiece = (pricing.ltmFee / pricing.totalQuantity).toFixed(2);
            html += `<p style="color: #ff6b6b; margin-top: 5px;">⚠ Small Batch Fee: $${ltmPerPiece} per piece (orders under 24)</p>`;
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
        
        // Add each product with consolidated pricing
        if (pricing.products && pricing.products.length > 0) {
            // Calculate total additional logo cost from API data
            let totalAdditionalLogoCost = 0;
            if (pricing.additionalServices) {
                totalAdditionalLogoCost = pricing.additionalServices
                    .reduce((sum, service) => sum + service.unitPrice, 0);
            }

            pricing.products.forEach(productPricing => {
                const product = productPricing.product;

                // Group line items by price (regular vs extended sizes)
                const priceGroups = {};
                productPricing.lineItems.forEach(item => {
                    const displayPrice = item.unitPriceWithLTM || item.unitPrice;
                    const consolidatedPrice = displayPrice + totalAdditionalLogoCost;
                    const priceKey = consolidatedPrice.toFixed(2);

                    if (!priceGroups[priceKey]) {
                        priceGroups[priceKey] = {
                            price: consolidatedPrice,
                            items: [],
                            totalQty: 0,
                            totalAmount: 0,
                            sizes: []
                        };
                    }

                    priceGroups[priceKey].items.push(item);
                    priceGroups[priceKey].totalQty += item.quantity;
                    priceGroups[priceKey].totalAmount += consolidatedPrice * item.quantity;
                    priceGroups[priceKey].sizes.push(item.description);
                });

                // Display grouped items
                Object.values(priceGroups).forEach(group => {
                    const sizeLabel = group.sizes.length > 1 ?
                        `Sizes: ${group.sizes.join(', ')}` :
                        `Size: ${group.sizes[0]}`;

                    html += `
                        <tr>
                            <td>
                                <strong>${product.style} - ${product.color}</strong><br>
                                ${product.title}<br>
                                <span style="color: #666; font-size: 10px;">
                                    ${sizeLabel}<br>
                                    ${pricing.logos ? pricing.logos.length + ' logo position' + (pricing.logos.length !== 1 ? 's' : '') : ''}
                                </span>
                            </td>
                            <td style="text-align: center;">${group.totalQty}</td>
                            <td style="text-align: right;">$${group.price.toFixed(2)}</td>
                            <td style="text-align: right;">$${group.totalAmount.toFixed(2)}</td>
                        </tr>
                    `;
                });
            });
        }
        
        // Additional services are already included in consolidated pricing, so we don't show them separately
        
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
                            <td style="text-align: right; font-size: 14px; color: #333;">
                                <strong>$${finalTotal.toFixed(2)}</strong>
                            </td>
                        </tr>
                    </tfoot>
                </table>
                
                <!-- Special Notes -->
        `;
        
        // Always show special notes section for consistency
        const notes = customerData.notes || document.getElementById('quote-notes')?.value?.trim() || '';
        html += `
            <div style="background: #fff9c4; border: 1px solid #f9a825; padding: 10px; border-radius: 4px; margin-bottom: 15px;">
                <h3 style="margin: 0 0 8px 0; color: #f9a825; font-size: 12px;">Special Notes</h3>
                <p style="margin: 0; font-size: 11px; color: #666;">${notes || '<em style="color: #999;">No special notes for this quote</em>'}</p>
            </div>
        `;
        
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
                
                <div class="footer" style="text-align: center; margin-top: 25px; padding-top: 15px; border-top: 1px solid #ddd;">
                    <p style="color: #4cb354; font-weight: bold; font-size: 14px; margin-bottom: 8px;">Thank you for choosing Northwest Custom Apparel!</p>
                    <p style="font-size: 10px; color: #666;">Northwest Custom Apparel | Since 1977 | 2025 Freeman Road East, Milton, WA 98354 | (253) 922-5793</p>
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

        // Header with company info
        text += `NORTHWEST CUSTOM APPAREL\n`;
        text += `2025 Freeman Road East, Milton, WA 98354\n`;
        text += `Phone: (253) 922-5793 | sales@nwcustomapparel.com\n`;
        text += `${'='.repeat(60)}\n\n`;

        // Quote section
        text += `QUOTE\n`;
        text += `${quoteId}\n`;
        text += `Date: ${new Date().toLocaleDateString('en-US')}\n`;
        text += `Valid for: 30 days\n\n`;

        // Customer information
        text += `CUSTOMER INFORMATION\n`;
        text += `${customerData.name || 'Customer'}\n`;
        if (customerData.company) text += `${customerData.company}\n`;
        text += `${customerData.email || 'Not provided'}\n`;
        if (customerData.phone) text += `${customerData.phone}\n`;
        text += '\n';

        // Project details
        text += `PROJECT DETAILS\n`;
        text += `Type: Embroidery Contract\n`;
        if (customerData.project) text += `Project: ${customerData.project}\n`;
        text += `Total Pieces: ${pricingData.totalQuantity || 0}\n`;

        // Get sales rep name from the email
        const salesRepEmail = customerData.salesRepEmail || 'sales@nwcustomapparel.com';
        const salesReps = this.quoteService.getSalesReps();
        const salesRep = salesReps.find(rep => rep.email === salesRepEmail);
        const salesRepName = salesRep ? salesRep.name : 'General Sales';
        text += `Quote Prepared By: ${salesRepName}\n\n`;

        // Embroidery package
        text += `EMBROIDERY PACKAGE FOR THIS ORDER:\n`;
        pricingData.logos.forEach((logo, idx) => {
            const isPrimary = logo.isPrimary !== false;
            text += `✓ ${logo.position} (${logo.stitchCount.toLocaleString()} stitches) - `;
            if (isPrimary) {
                text += `PRIMARY LOGO - INCLUDED IN BASE PRICE`;
            } else {
                text += `ADDITIONAL LOGO`;
            }
            if (logo.needsDigitizing) text += ` (Digitizing: $100)`;
            text += '\n';
        });

        // Add LTM fee notice if applicable
        if (pricingData.ltmFee && pricingData.ltmFee > 0) {
            const ltmPerPiece = (pricingData.ltmFee / pricingData.totalQuantity).toFixed(2);
            text += `⚠ Small Batch Fee - ADDITIONAL (+$${ltmPerPiece} per piece for orders under 24)\n`;
        }
        text += '\n';

        // Products table header
        text += `${'='.repeat(60)}\n`;
        text += `DESCRIPTION${' '.repeat(25)}QUANTITY    UNIT PRICE    TOTAL\n`;
        text += `${'='.repeat(60)}\n`;

        // Calculate total additional logo cost
        let totalAdditionalLogoCost = 0;
        if (pricingData.additionalServices) {
            totalAdditionalLogoCost = pricingData.additionalServices
                .reduce((sum, service) => sum + service.unitPrice, 0);
        }

        // Products with consolidated pricing
        pricingData.products.forEach(pp => {
            const product = pp.product;

            // Product header
            text += `${product.style} - ${product.color}\n`;
            text += `${product.title}\n`;

            // Group line items by price
            const priceGroups = {};
            pp.lineItems.forEach(item => {
                const displayPrice = item.unitPriceWithLTM || item.unitPrice;
                const consolidatedPrice = displayPrice + totalAdditionalLogoCost;
                const priceKey = consolidatedPrice.toFixed(2);

                if (!priceGroups[priceKey]) {
                    priceGroups[priceKey] = {
                        price: consolidatedPrice,
                        sizes: [],
                        totalQty: 0,
                        totalAmount: 0
                    };
                }

                priceGroups[priceKey].sizes.push(item.description);
                priceGroups[priceKey].totalQty += item.quantity;
                priceGroups[priceKey].totalAmount += consolidatedPrice * item.quantity;
            });

            // Display grouped sizes
            Object.values(priceGroups).forEach(group => {
                group.sizes.forEach(size => {
                    text += `Size: ${size}\n`;
                });
            });

            // Logo description
            const logoCount = pricingData.logos ? pricingData.logos.length : 0;
            text += `${logoCount} logo position${logoCount !== 1 ? 's' : ''}\n`;

            // Pricing line - align columns properly
            const totalQty = pp.lineItems.reduce((sum, item) => sum + item.quantity, 0);
            const firstItem = pp.lineItems[0];
            const unitPrice = (firstItem.unitPriceWithLTM || firstItem.unitPrice) + totalAdditionalLogoCost;
            const lineTotal = pp.lineItems.reduce((sum, item) => {
                const itemPrice = (item.unitPriceWithLTM || item.unitPrice) + totalAdditionalLogoCost;
                return sum + (itemPrice * item.quantity);
            }, 0);

            // Format the pricing line with proper spacing
            const qtyStr = totalQty.toString().padEnd(12);
            const priceStr = `$${unitPrice.toFixed(2)}`.padEnd(14);
            const totalStr = `$${lineTotal.toFixed(2)}`;
            text += `${' '.repeat(36)}${qtyStr}${priceStr}${totalStr}\n\n`;
        });

        // Setup fees if any
        if (pricingData.setupFees > 0) {
            const digitizingLogos = pricingData.logos.filter(l => l.needsDigitizing).length;
            text += `Digitizing Setup Fees\n`;
            text += `${digitizingLogos} logo${digitizingLogos > 1 ? 's' : ''} @ $100.00 each\n`;
            const qtyStr = digitizingLogos.toString().padEnd(12);
            const priceStr = '$100.00'.padEnd(14);
            const totalStr = `$${pricingData.setupFees.toFixed(2)}`;
            text += `${' '.repeat(36)}${qtyStr}${priceStr}${totalStr}\n\n`;
        }

        // Totals section
        text += `${'='.repeat(60)}\n`;
        const subtotal = pricingData.subtotal + (pricingData.additionalServicesTotal || 0) + pricingData.setupFees;
        text += `Subtotal (${pricingData.totalQuantity} pieces):${' '.repeat(28)}$${subtotal.toFixed(2)}\n`;

        // Tax calculation
        const taxAmount = subtotal * 0.101;
        text += `Milton, WA Sales Tax (10.1%):${' '.repeat(23)}$${taxAmount.toFixed(2)}\n\n`;

        const grandTotal = subtotal + taxAmount;
        text += `GRAND TOTAL:${' '.repeat(40)}$${grandTotal.toFixed(2)}\n\n`;

        // Special notes if present
        if (customerData.notes) {
            text += `Special Notes:\n`;
            text += `${customerData.notes}\n\n`;
        }

        // Terms & Conditions
        text += `Terms & Conditions:\n`;
        text += `• This quote is valid for 30 days from the date of issue\n`;
        text += `• 50% deposit required to begin production\n`;
        text += `• Production time: 14 business days after order and art approval\n`;
        text += `• Rush production available (7 business days) - add 25%\n`;
        text += `• Prices subject to change based on final artwork requirements\n\n`;

        // Footer
        text += `Thank you for choosing Northwest Custom Apparel!\n`;
        text += `Northwest Custom Apparel | Since 1977 | 2025 Freeman Road East, Milton, WA 98354 | (253) 922-5793\n`;
        
        return text;
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