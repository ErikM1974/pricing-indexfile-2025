/**
 * Professional Invoice Generation for Embroidery Quote Builder
 * Generates clean, professional PDF-ready invoices with complete pricing details
 */

class EmbroideryInvoiceGenerator {
    constructor() {
        this.taxRate = 0.101; // 10.1% WA Sales Tax
        
        this.salesRepMap = {
            'taneisha@nwcustomapparel.com': 'Taneisha Clark',
            'adriyella@nwcustomapparel.com': 'Adriyella',
            'nika@nwcustomapparel.com': 'Nika Lao',
            'jim@nwcustomapparel.com': 'Jim Mickelson',
            'erik@nwcustomapparel.com': 'Erik Mickelson',
            'ruth@nwcustomapparel.com': 'Ruth Nhong'
        };
    }

    /**
     * Get quote type info for dynamic title and filename
     * Detects quote type from pricingData flags
     */
    getQuoteTypeInfo(pricingData) {
        if (pricingData.isDTG) {
            return { title: 'DTG QUOTE', prefix: 'DTG Quote' };
        } else if (pricingData.isScreenprint) {
            return { title: 'SCREEN PRINT QUOTE', prefix: 'Screen Print Quote' };
        } else if (pricingData.isDTF) {
            return { title: 'DTF QUOTE', prefix: 'DTF Quote' };
        } else {
            return { title: 'EMBROIDERY QUOTE', prefix: 'Embroidery Quote' };
        }
    }

    /**
     * Generate complete invoice HTML
     */
    generateInvoiceHTML(pricingData, customerData) {
        const today = new Date();
        const expiryDate = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
        
        // Get sales rep name
        const salesRepName = this.salesRepMap[customerData.salesRepEmail] || 'Sales Team';
        
        // Calculate tax
        const taxAmount = pricingData.grandTotal * this.taxRate;
        const totalWithTax = pricingData.grandTotal + taxAmount;
        
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>${this.getQuoteTypeInfo(pricingData).prefix} ${pricingData.quoteId || ''}</title>
                <style>
                    ${this.getInvoiceStyles()}
                </style>
            </head>
            <body>
                <div class="invoice-container">
                    ${this.generateHeader(pricingData, today, expiryDate)}
                    ${this.generateCustomerSection(customerData, salesRepName)}
                    ${this.generateEmbroiderySpecs(pricingData)}
                    ${this.generateProductsTable(pricingData)}
                    ${this.generateTotalsSection(pricingData, taxAmount, totalWithTax)}
                    ${this.generateFooter(customerData)}
                </div>
            </body>
            </html>
        `;
    }
    
    /**
     * Get invoice CSS styles
     */
    getInvoiceStyles() {
        return `
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            
            body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                color: #333;
                line-height: 1.6;
            }
            
            .invoice-container {
                max-width: 8.5in;
                margin: 0 auto;
                padding: 0.15in;
                background: white;
            }
            
            @page {
                size: letter portrait;
                margin: 0.3in;
            }
            
            @media print {
                body { margin: 0; }
                .invoice-container { padding: 0; }
                .invoice-header { page-break-inside: avoid; }
                .products-table { page-break-inside: avoid; }
            }
            
            /* Header */
            .invoice-header {
                display: flex;
                justify-content: space-between;
                align-items: start;
                padding-bottom: 8px;
                border-bottom: 2px solid #4cb354;
                margin-bottom: 10px;
            }
            
            .company-info {
                flex: 1;
            }
            
            .company-logo {
                width: 120px;
                height: auto;
                margin-bottom: 3px;
            }
            
            .company-details {
                font-size: 10px;
                color: #666;
                line-height: 1.2;
            }
            
            .quote-info {
                text-align: right;
                flex: 0 0 200px;
            }
            
            .quote-title {
                font-size: 18px;
                font-weight: bold;
                color: #4cb354;
                margin-bottom: 5px;
            }
            
            .quote-details {
                font-size: 10px;
                color: #666;
            }
            
            .quote-details strong {
                color: #333;
            }
            
            /* Customer Section */
            .customer-section {
                display: flex;
                justify-content: space-between;
                margin-bottom: 8px;
                padding: 6px;
                background: #f8f9fa;
                border-radius: 3px;
            }
            
            .customer-info, .sales-rep-info {
                flex: 1;
            }
            
            .section-title {
                font-size: 11px;
                font-weight: bold;
                color: #4cb354;
                margin-bottom: 3px;
            }
            
            .info-line {
                font-size: 10px;
                color: #666;
                margin: 1px 0;
            }
            
            /* Products Table */
            .products-table {
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 15px;
            }
            
            .products-table thead {
                background: #4cb354;
                color: white;
            }
            
            .products-table th {
                padding: 5px 4px;
                text-align: left;
                font-size: 10px;
                font-weight: 600;
                border-right: 1px solid rgba(255,255,255,0.2);
            }
            
            .products-table th:last-child {
                border-right: none;
            }
            
            .products-table th:nth-child(6) {
                text-align: center;
            }
            
            .products-table th:nth-child(7),
            .products-table th:nth-child(8) {
                text-align: right;
            }
            
            .products-table td {
                padding: 3px;
                border-bottom: 1px solid #e0e0e0;
                font-size: 9px;
                vertical-align: top;
            }
            
            .price-breakdown {
                font-size: 8px;
                line-height: 1.3;
                color: #666;
            }
            
            .price-total {
                font-weight: bold;
                color: #000;
                border-top: 1px solid #ddd;
                margin-top: 2px;
                padding-top: 2px;
            }
            
            .product-image {
                width: 20px;
                height: 20px;
                object-fit: contain;
                display: block;
            }
            
            .description-cell {
                line-height: 1.3;
            }
            
            .logo-position {
                font-weight: 600;
                color: #333;
            }
            
            .stitch-count {
                font-size: 8px;
                color: #666;
                display: inline;
                margin-left: 3px;
            }
            
            .size-breakdown {
                font-family: 'Courier New', monospace;
                font-size: 9px;
                word-break: break-word;
                line-height: 1.2;
            }
            
            /* Additional Services */
            .additional-service-row {
                background: #f8f9fa;
            }
            
            /* Totals Section */
            .totals-section {
                margin-left: auto;
                width: 300px;
                margin-top: 20px;
            }
            
            .total-row {
                display: flex;
                justify-content: space-between;
                padding: 5px 0;
                font-size: 13px;
            }
            
            .total-row.subtotal-row {
                border-top: 1px solid #e0e0e0;
                padding-top: 10px;
            }
            
            .total-row.tax-row {
                color: #666;
            }
            
            .total-row.grand-total {
                border-top: 2px solid #4cb354;
                padding-top: 10px;
                margin-top: 5px;
                font-size: 16px;
                font-weight: bold;
                color: #4cb354;
            }
            
            /* Footer */
            .invoice-footer {
                margin-top: 40px;
                padding-top: 20px;
                border-top: 1px solid #e0e0e0;
            }
            
            .footer-section {
                margin-bottom: 15px;
            }
            
            .footer-title {
                font-size: 12px;
                font-weight: bold;
                color: #4cb354;
                margin-bottom: 5px;
            }
            
            .footer-text {
                font-size: 11px;
                color: #666;
                line-height: 1.4;
            }
            
            .tagline {
                text-align: center;
                font-style: italic;
                color: #999;
                margin-top: 20px;
                font-size: 11px;
            }
            
            @media print {
                body {
                    margin: 0;
                }
                .invoice-container {
                    padding: 0;
                }
                .products-table {
                    page-break-inside: avoid;
                }
                .no-print {
                    display: none;
                }
            }

            /* Size Matrix Table */
            .size-matrix {
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 10px;
            }
            .size-matrix th {
                background: #4cb354;
                color: white;
                padding: 5px 3px;
                font-size: 9px;
                text-align: center;
                font-weight: 600;
            }
            .size-matrix th.part-col,
            .size-matrix th.color-col {
                text-align: left;
                padding-left: 6px;
            }
            .size-matrix th.size-col {
                min-width: 26px;
                max-width: 34px;
            }
            .size-matrix td {
                padding: 5px 3px;
                border-bottom: 1px solid #e0e0e0;
                font-size: 9px;
                vertical-align: middle;
            }
            .size-matrix td.part-cell,
            .size-matrix td.desc-cell,
            .size-matrix td.color-cell {
                text-align: left;
                padding-left: 6px;
            }
            .size-matrix td.desc-cell {
                font-size: 8px;
                max-width: 180px;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            .size-matrix td.size-cell {
                text-align: center;
                font-weight: 500;
            }
            .size-matrix td.pcs-cell,
            .size-matrix td.total-cell {
                text-align: right;
                font-weight: 600;
                padding-right: 6px;
            }
            .size-matrix tr.product-row:nth-child(even) {
                background: #fafafa;
            }
            .size-matrix tr.totals-row {
                background: #f0f0f0;
                font-weight: 600;
                border-top: 2px solid #4cb354;
            }
            .size-matrix tr.totals-row td {
                padding-top: 8px;
                padding-bottom: 8px;
            }
            .size-matrix tr.extended-size-row {
                background: #f9f9f9;
            }
            .size-matrix tr.extended-size-row td {
                border-top: none;
                padding-top: 2px;
            }
            .size-matrix .unit-cell {
                font-weight: 500;
                color: #333;
            }
            .price-legend {
                font-size: 9px;
                color: #666;
                margin: 8px 0 15px 0;
                padding: 6px 10px;
                background: #f8f9fa;
                border-radius: 3px;
                border-left: 3px solid #4cb354;
            }
            @media print {
                .size-matrix tr {
                    page-break-inside: avoid;
                }
            }
        `;
    }
    
    /**
     * Generate invoice header
     */
    generateHeader(pricingData, today, expiryDate) {
        const quoteTypeInfo = this.getQuoteTypeInfo(pricingData);
        const quoteId = pricingData.quoteId;

        return `
            <div class="invoice-header">
                <div class="company-info">
                    <img src="https://cdn.caspio.com/A0E15000/Safety%20Stripes/web%20northwest%20custom%20apparel%20logo.png?ver=1"
                         alt="Northwest Custom Apparel" class="company-logo">
                    <div class="company-details">
                        2025 Freeman Road East<br>
                        Milton, WA 98354<br>
                        Phone: (253) 922-5793<br>
                        www.nwcustomapparel.com
                    </div>
                </div>
                <div class="quote-info">
                    <div class="quote-title">${quoteTypeInfo.title}</div>
                    <div class="quote-details">
                        <strong>Quote #:</strong> ${quoteId || 'DRAFT'}<br>
                        <strong>Date:</strong> ${today.toLocaleDateString()}<br>
                        <strong>Valid Until:</strong> ${expiryDate.toLocaleDateString()}
                    </div>
                </div>
            </div>
        `;
    }
    
    /**
     * Generate customer section
     */
    generateCustomerSection(customerData, salesRepName) {
        return `
            <div class="customer-section">
                <div class="customer-info">
                    <div class="section-title">BILL TO:</div>
                    <div class="info-line"><strong>${customerData.name || 'Customer'}</strong></div>
                    ${customerData.company ? `<div class="info-line">${customerData.company}</div>` : ''}
                    <div class="info-line">${customerData.email}</div>
                    ${customerData.phone ? `<div class="info-line">${customerData.phone}</div>` : ''}
                </div>
                <div class="sales-rep-info">
                    <div class="section-title">SALES REPRESENTATIVE:</div>
                    <div class="info-line"><strong>${salesRepName}</strong></div>
                    <div class="info-line">${customerData.salesRepEmail}</div>
                    <div class="info-line">(253) 922-5793</div>
                </div>
            </div>
        `;
    }
    
    /**
     * Generate service specifications section based on quote type
     * Dispatches to the appropriate method based on isDTG, isScreenprint, isDTF flags
     */
    generateEmbroiderySpecs(pricingData) {
        // Dispatch based on quote type
        if (pricingData.isDTG) {
            return this.generateDTGSpecs(pricingData);
        } else if (pricingData.isScreenprint) {
            return this.generateScreenprintSpecs(pricingData);
        } else if (pricingData.isDTF) {
            return this.generateDTFSpecs(pricingData);
        }

        // Default: Embroidery specs
        return this.generateEmbroideryLogoSpecs(pricingData);
    }

    /**
     * Generate DTG print location specifications
     */
    generateDTGSpecs(pricingData) {
        const printLocation = pricingData.printLocation;
        if (!printLocation) return '';

        // DTG location display names
        const LOCATION_NAMES = {
            'LC': 'Left Chest',
            'FF': 'Full Front',
            'JF': 'Jumbo Front',
            'FB': 'Full Back',
            'JB': 'Jumbo Back',
            'LC_FB': 'Left Chest + Full Back',
            'LC_JB': 'Left Chest + Jumbo Back',
            'FF_FB': 'Full Front + Full Back',
            'FF_JB': 'Full Front + Jumbo Back',
            'JF_FB': 'Jumbo Front + Full Back',
            'JF_JB': 'Jumbo Front + Jumbo Back'
        };

        let specsHTML = `
            <div style="margin: 10px 0; padding: 10px; background: #e3f2fd; border: 1px solid #2196f3; border-radius: 5px;">
                <div style="font-size: 12px; font-weight: bold; color: #1976d2; margin-bottom: 8px;">
                    <i class="fas fa-tshirt" style="margin-right: 5px;"></i>DTG PRINT LOCATIONS:
                </div>
        `;

        // Show front location
        if (printLocation.front) {
            const frontName = LOCATION_NAMES[printLocation.front] || printLocation.front;
            specsHTML += `
                <div style="font-size: 11px; color: #333; margin: 4px 0;">
                    <strong>Front:</strong> ${frontName}
                </div>
            `;
        }

        // Show back location if present
        if (printLocation.back) {
            const backName = LOCATION_NAMES[printLocation.back] || printLocation.back;
            specsHTML += `
                <div style="font-size: 11px; color: #333; margin: 4px 0;">
                    <strong>Back:</strong> ${backName}
                </div>
            `;
        }

        specsHTML += `</div>`;
        return specsHTML;
    }

    /**
     * Generate Screen Print configuration specifications
     */
    generateScreenprintSpecs(pricingData) {
        const printConfig = pricingData.printConfig;
        if (!printConfig) return '';

        let specsHTML = `
            <div style="margin: 10px 0; padding: 10px; background: #fff3e0; border: 1px solid #ff9800; border-radius: 5px;">
                <div style="font-size: 12px; font-weight: bold; color: #e65100; margin-bottom: 8px;">
                    <i class="fas fa-palette" style="margin-right: 5px;"></i>SCREEN PRINT CONFIGURATION:
                </div>
        `;

        // Front location with colors
        if (printConfig.front) {
            specsHTML += `
                <div style="font-size: 11px; color: #333; margin: 4px 0;">
                    <strong>Front:</strong> ${printConfig.front}
                </div>
            `;
        }

        // Back location with colors (if present)
        if (printConfig.back) {
            specsHTML += `
                <div style="font-size: 11px; color: #333; margin: 4px 0;">
                    <strong>Back:</strong> ${printConfig.back}
                </div>
            `;
        }

        // Dark garment indicator
        if (printConfig.isDarkGarment) {
            specsHTML += `
                <div style="font-size: 11px; color: #333; margin: 4px 0;">
                    <strong>Dark Garment:</strong> Yes <span style="color: #666;">(+white underbase)</span>
                </div>
            `;
        }

        // Safety stripes indicator
        if (printConfig.hasSafetyStripes) {
            specsHTML += `
                <div style="font-size: 11px; color: #333; margin: 4px 0;">
                    <strong>Safety Stripes:</strong> Yes <span style="color: #666;">(+$2/piece/location)</span>
                </div>
            `;
        }

        // Screen count and setup fee
        if (printConfig.totalScreens && pricingData.setupFees > 0) {
            specsHTML += `
                <div style="font-size: 10px; color: #666; margin-top: 8px; padding-top: 5px; border-top: 1px solid #ffcc80;">
                    <strong>Setup:</strong> ${printConfig.totalScreens} screen${printConfig.totalScreens > 1 ? 's' : ''} × $30 = $${pricingData.setupFees.toFixed(2)}
                </div>
            `;
        }

        specsHTML += `</div>`;
        return specsHTML;
    }

    /**
     * Generate DTF transfer location specifications
     */
    generateDTFSpecs(pricingData) {
        const selectedLocations = pricingData.selectedLocations;
        if (!selectedLocations || selectedLocations.length === 0) return '';

        // DTF location configuration
        const locationConfig = {
            'left-chest': { label: 'Left Chest', size: 'Small' },
            'right-chest': { label: 'Right Chest', size: 'Small' },
            'left-sleeve': { label: 'Left Sleeve', size: 'Small' },
            'right-sleeve': { label: 'Right Sleeve', size: 'Small' },
            'back-of-neck': { label: 'Back of Neck', size: 'Small' },
            'center-front': { label: 'Center Front', size: 'Medium' },
            'center-back': { label: 'Center Back', size: 'Medium' },
            'full-front': { label: 'Full Front', size: 'Large' },
            'full-back': { label: 'Full Back', size: 'Large' }
        };

        let specsHTML = `
            <div style="margin: 10px 0; padding: 10px; background: #f3e5f5; border: 1px solid #9c27b0; border-radius: 5px;">
                <div style="font-size: 12px; font-weight: bold; color: #7b1fa2; margin-bottom: 8px;">
                    <i class="fas fa-layer-group" style="margin-right: 5px;"></i>DTF TRANSFER LOCATIONS:
                </div>
        `;

        // List each selected location
        selectedLocations.forEach(loc => {
            const config = locationConfig[loc] || { label: loc, size: '' };
            specsHTML += `
                <div style="font-size: 11px; color: #333; margin: 4px 0;">
                    • ${config.label} <span style="color: #666;">(${config.size})</span>
                </div>
            `;
        });

        specsHTML += `</div>`;
        return specsHTML;
    }

    /**
     * Generate embroidery logo specifications (original embroidery specs)
     * Supports separate garment and cap logo configurations
     */
    generateEmbroideryLogoSpecs(pricingData) {
        // Check if we have the new logoConfigs structure
        const hasLogoConfigs = pricingData.logoConfigs &&
            (pricingData.garmentLogos?.length > 0 || pricingData.capLogos?.length > 0);

        // If no logoConfigs and no legacy logos, return empty
        if (!hasLogoConfigs && (!pricingData.logos || pricingData.logos.length === 0)) {
            return '';
        }

        let specsHTML = `
            <div style="margin: 10px 0; padding: 10px; background: #e8f5e9; border: 1px solid #4cb354; border-radius: 5px;">
        `;

        // Determine AL base rate from tier
        const tier = pricingData.tier || '1-7';
        let alBaseRate = 13.50; // 2026-02 base rate
        if (tier.includes('72')) alBaseRate = 8.50;
        else if (tier.includes('48')) alBaseRate = 9.50;
        else if (tier.includes('24')) alBaseRate = 11.50;
        else if (tier === '8-23') alBaseRate = 13.50;

        // Handle new separate logo configs
        if (hasLogoConfigs) {
            // GARMENT EMBROIDERY SECTION
            if (pricingData.garmentLogos && pricingData.garmentLogos.length > 0 && pricingData.hasGarments) {
                specsHTML += `<div style="font-size: 12px; font-weight: bold; color: #4cb354; margin-bottom: 8px;">GARMENT EMBROIDERY:</div>`;
                specsHTML += this.generateLogoListHTML(pricingData.garmentLogos, alBaseRate, 'garment');
            }

            // CAP EMBELLISHMENT SECTION
            if (pricingData.capLogos && pricingData.capLogos.length > 0 && pricingData.hasCaps) {
                // Determine embellishment type label
                const capEmbType = pricingData.capEmbellishmentType || 'embroidery';
                const capEmbLabel = {
                    'embroidery': 'CAP EMBROIDERY:',
                    '3d-puff': 'CAP 3D PUFF EMBROIDERY:',
                    'laser-patch': 'CAP LASER LEATHERETTE PATCH:'
                }[capEmbType] || 'CAP EMBELLISHMENT:';

                specsHTML += `<div style="font-size: 12px; font-weight: bold; color: #2196F3; margin-bottom: 8px; margin-top: ${pricingData.hasGarments ? '12px' : '0'};">${capEmbLabel}</div>`;

                if (capEmbType === 'laser-patch') {
                    // Patch-specific display (no stitch count)
                    specsHTML += `
                        <div style="font-size: 11px; margin-left: 10px; margin-bottom: 3px;">
                            <strong>Position:</strong> Cap Front | <strong>Type:</strong> Laser Leatherette Patch
                        </div>
                    `;
                    // Show patch setup fee if applicable
                    if (pricingData.capPatchSetupFee > 0) {
                        specsHTML += `
                            <div style="font-size: 10px; color: #666; margin-left: 10px;">
                                Design Setup Fee: $${pricingData.capPatchSetupFee.toFixed(2)}
                            </div>
                        `;
                    }
                } else {
                    // Embroidery display (flat or 3D puff)
                    specsHTML += this.generateLogoListHTML(pricingData.capLogos, alBaseRate, 'cap');
                    // Show 3D puff upcharge if applicable
                    if (capEmbType === '3d-puff' && pricingData.puffUpchargePerCap > 0) {
                        specsHTML += `
                            <div style="font-size: 10px; color: #2196F3; margin-left: 10px; margin-top: 3px;">
                                3D Puff Upcharge: +$${pricingData.puffUpchargePerCap.toFixed(2)} per cap
                            </div>
                        `;
                    }
                }
            }
        } else {
            // Legacy: All logos are garment logos
            specsHTML += `<div style="font-size: 12px; font-weight: bold; color: #4cb354; margin-bottom: 8px;">EMBROIDERY PACKAGE FOR THIS ORDER:</div>`;
            specsHTML += this.generateLogoListHTML(pricingData.logos, alBaseRate, 'garment');
        }

        // Add setup fees if present
        if (pricingData.setupFees > 0) {
            const digitizingCount = pricingData.setupFeesCount ||
                (pricingData.logos ? pricingData.logos.filter(l => l.needsDigitizing).length : 0);
            if (digitizingCount > 0) {
                specsHTML += `
                    <div style="font-size: 10px; color: #666; margin-top: 5px;">
                        <strong>Setup Fees:</strong> ${digitizingCount} logo${digitizingCount > 1 ? 's' : ''} × $100 digitizing = $${pricingData.setupFees.toFixed(2)}
                    </div>
                `;
            }
        }

        // Add LTM notice if applicable (only when NOT distributed into unit prices)
        if (pricingData.ltmFee > 0 && !pricingData.ltmDistributed) {
            const ltmPerPiece = (pricingData.ltmFee / pricingData.totalQuantity).toFixed(2);
            specsHTML += `
                <div style="font-size: 9px; color: #dc3545; margin-top: 5px; font-style: italic;">
                    ⚠ Small Batch Fee: +$${ltmPerPiece} per piece (orders under 24)
                </div>
            `;
        }

        specsHTML += `</div>`;

        return specsHTML;
    }

    /**
     * Generate HTML for a list of logos (used by generateEmbroiderySpecs)
     */
    generateLogoListHTML(logos, alBaseRate, type = 'garment') {
        if (!logos || logos.length === 0) return '';

        let html = '';

        // Cap position display names
        const capPositionNames = {
            'CF': 'Cap Front',
            'CB': 'Cap Back',
            'CL': 'Left Side',
            'CR': 'Right Side'
        };

        // Find primary logo
        const primaryLogo = logos.find(l => l.isPrimary !== false) || logos[0];
        if (primaryLogo) {
            let position = primaryLogo.position || (type === 'cap' ? 'Cap Front' : 'Left Chest');
            // Convert cap position codes to readable names
            if (type === 'cap' && capPositionNames[position]) {
                position = capPositionNames[position];
            }
            const stitchCount = primaryLogo.stitchCount || 8000;
            const extraStitches = stitchCount - 8000;

            // Primary logo (base 8K included)
            html += `
                <div style="font-size: 11px; color: #333; margin: 4px 0;">
                    ✓ <strong>${position}</strong> (${stitchCount.toLocaleString()} stitches) -
                    <span style="color: #4cb354;">BASE (8K INCLUDED)</span>
                </div>
            `;

            // Additional stitches line item (when primary > 8K) - GARMENTS ONLY
            if (extraStitches > 0 && type === 'garment') {
                const extraK = extraStitches / 1000;
                const asCostPerUnit = extraK * 1.25;
                html += `
                    <div style="font-size: 11px; color: #333; margin: 4px 0; margin-left: 15px;">
                        + <strong>Additional Stitches</strong> (+${extraK}K) -
                        <span style="color: #ff6b35;">+$${asCostPerUnit.toFixed(2)} per piece</span>
                    </div>
                `;
            }

            // Primary digitizing if needed
            if (primaryLogo.needsDigitizing) {
                html += `
                    <div style="font-size: 10px; color: #666; margin: 2px 0; margin-left: 15px;">
                        + Digitizing: $100
                    </div>
                `;
            }
        }

        // Add additional logos with clear pricing and digitizing info
        const additionalLogos = logos.filter(l => l.isPrimary === false);
        if (additionalLogos.length > 0) {
            additionalLogos.forEach((logo) => {
                let position = logo.position || 'Additional Logo';
                // Convert cap position codes to readable names
                if (type === 'cap' && capPositionNames[position]) {
                    position = capPositionNames[position];
                }
                const stitchCount = logo.stitchCount || (type === 'cap' ? 5000 : 8000);
                const extraStitches = Math.max(0, stitchCount - 8000);
                const extraK = extraStitches / 1000;
                const stitchCost = extraK * 1.25;
                const alUnitPrice = alBaseRate + stitchCost;
                const needsDigitizing = logo.needsDigitizing || false;

                const stitchNote = extraStitches > 0 ? ` (+${extraK}K stitches)` : '';
                const digitizingText = needsDigitizing ? ' [+$100 Digitizing]' : '';

                html += `
                    <div style="font-size: 11px; color: #333; margin: 4px 0;">
                        ✓ <strong>${position}</strong> (${stitchCount.toLocaleString()} stitches)${stitchNote} -
                        <span style="color: #ff6b35;">+$${alUnitPrice.toFixed(2)} per piece</span>
                        <span style="color: #666; font-size: 10px;">${digitizingText}</span>
                    </div>
                `;
            });
        }

        return html;
    }
    
    /**
     * Generate products table using size matrix layout
     * Shows products in a grid with individual columns for each size
     */
    generateProductsTable(pricingData) {
        // Use the new size matrix table format
        return this.generateSizeMatrixTable(pricingData);
    }

    /**
     * Legacy: Generate products table matching screen layout (card-based)
     * Kept for backward compatibility if needed
     */
    generateProductsTableLegacy(pricingData) {
        // Calculate total pieces across all products
        const totalPieces = pricingData.products.reduce((sum, pp) => {
            return sum + pp.lineItems.reduce((s, item) => s + item.quantity, 0);
        }, 0);

        // Start with Products header section
        let tableHTML = `
            <div style="margin: 15px 0;">
                <div style="font-size: 14px; font-weight: bold; color: #4cb354; margin-bottom: 10px;">
                    👕 Products
                </div>
        `;

        // Process each product
        pricingData.products.forEach(pp => {
            const imageUrl = pp.product.imageUrl || '';
            const productPieces = pp.lineItems.reduce((sum, item) => sum + item.quantity, 0);

            // Product header box
            tableHTML += `
                <div style="border: 1px solid #e0e0e0; border-radius: 5px; padding: 10px; margin-bottom: 10px; background: #fafafa;">
                    <div style="display: flex; align-items: center; margin-bottom: 10px;">
                        ${imageUrl ? `<img src="${imageUrl}" style="width: 40px; height: 40px; margin-right: 10px; object-fit: contain;">` : ''}
                        <div style="flex: 1;">
                            <strong style="font-size: 12px;">${pp.product.style} - ${pp.product.color}</strong>
                            <span style="font-size: 11px; color: #666; margin-left: 10px;">${pp.product.title}</span>
                            <span style="font-size: 11px; color: #4cb354; font-weight: bold; float: right;">${productPieces} pieces total</span>
                        </div>
                    </div>
            `;

            // Group line items by size category
            const regularSizes = pp.lineItems.filter(item => {
                const desc = item.description || '';
                return !desc.includes('2XL') && !desc.includes('3XL') && !desc.includes('4XL') &&
                       !desc.includes('5XL') && !desc.includes('6XL');
            });
            
            const size2XL = pp.lineItems.filter(item => item.description && item.description.includes('2XL'));
            const size3XL = pp.lineItems.filter(item => item.description && item.description.includes('3XL'));
            const largerSizes = pp.lineItems.filter(item => {
                const desc = item.description || '';
                return desc.includes('4XL') || desc.includes('5XL') || desc.includes('6XL');
            });
            
            // Build dynamic AL breakdown from logos
            const additionalLogos = (pricingData.logos || []).filter(l => l.isPrimary === false);
            const tier = pricingData.tier || '1-7';
            let alBaseRate = 13.50; // 2026-02 base rate
            if (tier.includes('72')) alBaseRate = 8.50;
            else if (tier.includes('48')) alBaseRate = 9.50;
            else if (tier.includes('24')) alBaseRate = 11.50;
            else if (tier === '8-23') alBaseRate = 13.50;

            // Calculate primary logo additional stitches cost
            const primaryLogo = (pricingData.logos || []).find(l => l.isPrimary !== false);
            const primaryExtraStitches = primaryLogo ? Math.max(0, (primaryLogo.stitchCount || 8000) - 8000) : 0;
            const primaryASCost = (primaryExtraStitches / 1000) * 1.25;

            // Build AL cost lines
            let alBreakdownLines = '';
            let totalALCost = 0;
            additionalLogos.forEach(logo => {
                const extraStitches = Math.max(0, (logo.stitchCount || 8000) - 8000);
                const stitchCost = (extraStitches / 1000) * 1.25;
                const alUnitPrice = alBaseRate + stitchCost;
                totalALCost += alUnitPrice;
                const stitchNote = extraStitches > 0 ? ` (+${extraStitches/1000}K)` : '';
                alBreakdownLines += `+ AL ${logo.position || 'Additional'}${stitchNote}: $${alUnitPrice.toFixed(2)}<br>`;
            });

            // Add additional stitches line if primary > 8K
            let asBreakdownLine = '';
            if (primaryASCost > 0) {
                asBreakdownLine = `+ Additional Stitches (+${primaryExtraStitches/1000}K): $${primaryASCost.toFixed(2)}<br>`;
            }

            // Add regular sizes if exists
            if (regularSizes.length > 0) {
                const totalQty = regularSizes.reduce((sum, item) => sum + item.quantity, 0);
                const item = regularSizes[0];
                const basePrice = item.basePrice;
                // Use distributed price only when LTM is distributed
                const unitPrice = pricingData.ltmDistributed && item.unitPriceWithLTM ? item.unitPriceWithLTM : item.unitPrice;
                const totalAmount = regularSizes.reduce((sum, item) => sum + item.total, 0);
                const sizeDesc = regularSizes.map(item => this.parseSizeDisplay(item)).join(' ');

                // Build pricing breakdown - only show extras if they exist
                let priceBreakdown = `Base (includes primary logo): $${basePrice.toFixed(2)}<br>`;
                if (asBreakdownLine) priceBreakdown += asBreakdownLine;
                if (alBreakdownLines) priceBreakdown += alBreakdownLines;
                priceBreakdown += `= $${unitPrice.toFixed(2)} each`;

                // Format the pricing breakdown like the screen
                tableHTML += `
                    <div style="padding: 8px 10px; border-bottom: 1px solid #e0e0e0;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                            <div style="flex: 1;">
                                <strong style="font-size: 11px;">${sizeDesc} (${totalQty} pieces)</strong>
                            </div>
                            <div style="text-align: right; font-size: 12px; font-weight: bold;">
                                $${totalAmount.toFixed(2)}
                            </div>
                        </div>
                        <div style="margin-left: 15px; font-size: 10px; color: #666; line-height: 1.4;">
                            ${priceBreakdown}
                        </div>
                    </div>
                `;
            }
            
            // Add 2XL sizes
            if (size2XL.length > 0) {
                size2XL.forEach(item => {
                    // Use distributed price only when LTM is distributed
                    const displayPrice = pricingData.ltmDistributed && item.unitPriceWithLTM ? item.unitPriceWithLTM : item.unitPrice;
                    const basePrice = item.basePrice;
                    const sizeDesc = this.parseSizeDisplay(item);

                    // Build pricing breakdown dynamically
                    let priceBreakdown = `Base (includes primary logo): $${basePrice.toFixed(2)}<br>`;
                    if (asBreakdownLine) priceBreakdown += asBreakdownLine;
                    if (alBreakdownLines) priceBreakdown += alBreakdownLines;
                    priceBreakdown += `= $${displayPrice.toFixed(2)} each`;

                    tableHTML += `
                        <div style="padding: 8px 10px; border-bottom: 1px solid #e0e0e0;">
                            <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                                <div style="flex: 1;">
                                    <strong style="font-size: 11px;">${sizeDesc} (${item.quantity} piece${item.quantity > 1 ? 's' : ''})</strong>
                                </div>
                                <div style="text-align: right; font-size: 12px; font-weight: bold;">
                                    $${item.total.toFixed(2)}
                                </div>
                            </div>
                            <div style="margin-left: 15px; font-size: 10px; color: #666; line-height: 1.4;">
                                ${priceBreakdown}
                            </div>
                        </div>
                    `;
                });
            }

            // Add 3XL sizes
            if (size3XL.length > 0) {
                size3XL.forEach(item => {
                    // Use distributed price only when LTM is distributed
                    const displayPrice = pricingData.ltmDistributed && item.unitPriceWithLTM ? item.unitPriceWithLTM : item.unitPrice;
                    const basePrice = item.basePrice;
                    const sizeDesc = this.parseSizeDisplay(item);

                    // Build pricing breakdown dynamically
                    let priceBreakdown = `Base (includes primary logo): $${basePrice.toFixed(2)}<br>`;
                    if (asBreakdownLine) priceBreakdown += asBreakdownLine;
                    if (alBreakdownLines) priceBreakdown += alBreakdownLines;
                    priceBreakdown += `= $${displayPrice.toFixed(2)} each`;

                    tableHTML += `
                        <div style="padding: 8px 10px; border-bottom: 1px solid #e0e0e0;">
                            <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                                <div style="flex: 1;">
                                    <strong style="font-size: 11px;">${sizeDesc} (${item.quantity} piece${item.quantity > 1 ? 's' : ''})</strong>
                                </div>
                                <div style="text-align: right; font-size: 12px; font-weight: bold;">
                                    $${item.total.toFixed(2)}
                                </div>
                            </div>
                            <div style="margin-left: 15px; font-size: 10px; color: #666; line-height: 1.4;">
                                ${priceBreakdown}
                            </div>
                        </div>
                    `;
                });
            }

            // Add other larger sizes if any
            if (largerSizes.length > 0) {
                largerSizes.forEach(item => {
                    // Use distributed price only when LTM is distributed
                    const displayPrice = pricingData.ltmDistributed && item.unitPriceWithLTM ? item.unitPriceWithLTM : item.unitPrice;
                    const basePrice = item.basePrice;
                    const sizeDesc = this.parseSizeDisplay(item);

                    // Build pricing breakdown dynamically
                    let priceBreakdown = `Base (includes primary logo): $${basePrice.toFixed(2)}<br>`;
                    if (asBreakdownLine) priceBreakdown += asBreakdownLine;
                    if (alBreakdownLines) priceBreakdown += alBreakdownLines;
                    priceBreakdown += `= $${displayPrice.toFixed(2)} each`;

                    tableHTML += `
                        <div style="padding: 8px 10px; border-bottom: 1px solid #e0e0e0;">
                            <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                                <div style="flex: 1;">
                                    <strong style="font-size: 11px;">${sizeDesc} (${item.quantity} piece${item.quantity > 1 ? 's' : ''})</strong>
                                </div>
                                <div style="text-align: right; font-size: 12px; font-weight: bold;">
                                    $${item.total.toFixed(2)}
                                </div>
                            </div>
                            <div style="margin-left: 15px; font-size: 10px; color: #666; line-height: 1.4;">
                                ${priceBreakdown}
                            </div>
                        </div>
                    `;
                });
            }
            
            // Close product box
            tableHTML += `</div>`;
        });
        
        // Add additional services with better formatting
        if (pricingData.additionalServices && pricingData.additionalServices.length > 0) {
            // Group services by logo
            const servicesByLogo = {};
            pricingData.additionalServices.forEach(service => {
                const key = service.logoNumber || 'monogram';
                if (!servicesByLogo[key]) {
                    servicesByLogo[key] = [];
                }
                servicesByLogo[key].push(service);
            });
            
            // Add each service group
            Object.entries(servicesByLogo).forEach(([logoKey, services]) => {
                services.forEach(service => {
                    // Extract clean description without part numbers
                    let cleanDescription = service.description || service.location || '';
                    // Remove AL-10000 or similar part numbers from description
                    cleanDescription = cleanDescription.replace(/AL-\d+\s*/g, '').trim();
                    
                    const description = `Additional Logo: ${cleanDescription}`;

                    const appliedTo = service.products
                        ? `${service.products.join(", ")}`
                        : `${service.quantity} pieces`;

                    tableHTML += `
                            <td>Service</td>
                            <td></td>
                            <td class="description-cell">
                                <div class="logo-position">${description}</div>
                                <div style="font-size: 9px; color: #666;">${appliedTo}</div>
                            </td>
                            <td></td>
                            <td style="text-align: center; font-size: 9px;">Service charge</td>
                            <td style="text-align: center;">${service.quantity}</td>
                            <td style="text-align: right;">$${service.unitPrice.toFixed(2)}</td>
                            <td style="text-align: right;">$${service.total.toFixed(2)}</td>
                        </tr>
                    `;
                });
            });
        }
        
        // Calculate and add subtotal
        const subtotal = pricingData.products.reduce((sum, pp) => {
            return sum + pp.lineItems.reduce((s, item) => s + item.total, 0);
        }, 0);
        
        tableHTML += `
            <div style="text-align: right; margin-top: 10px; padding-right: 10px;">
                <strong style="font-size: 12px;">Subtotal: <span style="color: #4cb354;">$${subtotal.toFixed(2)}</span></strong>
            </div>
        </div>
        `;
        
        return tableHTML;
    }
    
    /**
     * Parse size display from item description
     */
    parseSizeDisplay(item) {
        // The description field already contains the properly formatted size breakdown
        // like "S(1) M(2) L(2) XL(1)" or "2XL(3)"
        if (item.description && item.description.includes('(')) {
            return item.description;
        }

        // Fallback if no size information in description
        return item.quantity.toString();
    }

    /**
     * Generate products table for per-size line items (ShopWorks format)
     * Each line item represents one size for one product/color
     *
     * @param {Object} pricingData - Pricing data with perSizeLineItems array
     * @returns {string} HTML table
     */
    generatePerSizeProductsTable(pricingData) {
        if (!pricingData.perSizeLineItems || pricingData.perSizeLineItems.length === 0) {
            return this.generateProductsTable(pricingData);
        }

        const lineItems = pricingData.perSizeLineItems;
        const totalPieces = lineItems.reduce((sum, item) => sum + item.quantity, 0);

        let tableHTML = `
            <div style="margin: 15px 0;">
                <div style="font-size: 14px; font-weight: bold; color: #4cb354; margin-bottom: 10px;">
                    👕 Products (${totalPieces} pieces total)
                </div>
                <table class="products-table">
                    <thead>
                        <tr>
                            <th style="width: 70px;">Part #</th>
                            <th style="width: 180px;">Description</th>
                            <th style="width: 80px;">Color</th>
                            <th style="width: 50px; text-align: center;">Size</th>
                            <th style="width: 40px; text-align: center;">Qty</th>
                            <th style="width: 60px; text-align: right;">Unit</th>
                            <th style="width: 70px; text-align: right;">Total</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        // Group line items by product (partNumber + color)
        const productGroups = this.groupLineItemsByProduct(lineItems);

        for (const [groupKey, items] of Object.entries(productGroups)) {
            // Sort items by size order
            const sizeOrder = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL', '6XL',
                              'LT', 'XLT', '2XLT', '3XLT', 'OSFA', 'S/M', 'M/L', 'L/XL'];
            items.sort((a, b) => {
                const aIdx = sizeOrder.indexOf(a.size) !== -1 ? sizeOrder.indexOf(a.size) : 99;
                const bIdx = sizeOrder.indexOf(b.size) !== -1 ? sizeOrder.indexOf(b.size) : 99;
                return aIdx - bIdx;
            });

            items.forEach((item, index) => {
                const isFirstRow = index === 0;
                const isChildRow = !isFirstRow;
                const rowClass = isChildRow ? 'child-size-row' : 'parent-size-row';

                tableHTML += `
                    <tr class="${rowClass}">
                        <td>${item.partNumber}${item.hasUpcharge ? '' : ''}</td>
                        <td>${isFirstRow ? item.description : ''}</td>
                        <td>${isFirstRow ? item.displayColor : ''}</td>
                        <td style="text-align: center;">
                            ${item.size}
                            ${item.hasUpcharge ? '<span style="color:#f59e0b;font-size:9px;"> +$' + item.upchargeAmount.toFixed(0) + '</span>' : ''}
                        </td>
                        <td style="text-align: center;">${item.quantity}</td>
                        <td style="text-align: right;">$${item.unitPrice.toFixed(2)}</td>
                        <td style="text-align: right;">$${item.total.toFixed(2)}</td>
                    </tr>
                `;
            });

            // Add subtotal row for this product group
            const groupTotal = items.reduce((sum, item) => sum + item.total, 0);
            const groupQty = items.reduce((sum, item) => sum + item.quantity, 0);
            tableHTML += `
                <tr class="product-group-subtotal" style="background: #f8f9fa; font-weight: 600;">
                    <td colspan="4" style="text-align: right; font-size: 10px;">
                        ${items[0].partNumber} ${items[0].displayColor} Subtotal:
                    </td>
                    <td style="text-align: center;">${groupQty}</td>
                    <td></td>
                    <td style="text-align: right;">$${groupTotal.toFixed(2)}</td>
                </tr>
            `;
        }

        tableHTML += `
                    </tbody>
                </table>
            </div>
        `;

        return tableHTML;
    }

    /**
     * Group line items by product (partNumber + catalogColor)
     *
     * @param {Array} lineItems - Array of line items
     * @returns {Object} Grouped line items
     */
    groupLineItemsByProduct(lineItems) {
        const groups = {};

        lineItems.forEach(item => {
            const key = `${item.partNumber}:${item.color}`;
            if (!groups[key]) {
                groups[key] = [];
            }
            groups[key].push(item);
        });

        return groups;
    }

    /**
     * Parse size breakdown from description string
     * Converts "S(1) M(2) L(3) XL(1)" into {S: 1, M: 2, L: 3, XL: 1}
     * @param {string} description - Description with size(qty) format
     * @returns {Object} Size to quantity mapping
     */
    parseSizeBreakdown(description) {
        const sizes = {};
        if (!description) return sizes;

        const regex = /(\w+)\((\d+)\)/g;
        let match;
        while ((match = regex.exec(description)) !== null) {
            sizes[match[1]] = parseInt(match[2]);
        }
        return sizes;
    }

    /**
     * Aggregate sizes from all line items for a product
     * Combines base sizes (S, M, L, XL) with extended sizes (2XL, 3XL)
     * @param {Array} lineItems - Array of line items for a product
     * @returns {Object} { sizes: {S: 1, M: 2, ...}, pricing: {S: 20.50, 2XL: 22.50, ...}, totalQty, totalAmount }
     */
    aggregateSizesForProduct(lineItems) {
        const sizes = {};
        const pricing = {};
        let totalQty = 0;
        let totalAmount = 0;

        lineItems.forEach(item => {
            const parsed = this.parseSizeBreakdown(item.description);
            Object.entries(parsed).forEach(([size, qty]) => {
                sizes[size] = (sizes[size] || 0) + qty;
                pricing[size] = item.unitPrice; // Track price per size
                totalQty += qty;
            });
            totalAmount += item.total;
        });

        return { sizes, pricing, totalQty, totalAmount };
    }

    /**
     * Determine which size columns to show based on all products
     * Only shows columns that have quantities
     * @param {Array} allProducts - Array of product pricing data
     * @returns {Array} Ordered array of size column names to display
     */
    determineSizeColumns(allProducts) {
        const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL', '6XL', 'LT', 'XLT', '2XLT', '3XLT', 'OSFA'];
        const usedSizes = new Set();

        allProducts.forEach(pp => {
            pp.lineItems.forEach(item => {
                const parsed = this.parseSizeBreakdown(item.description);
                Object.keys(parsed).forEach(size => usedSizes.add(size));
            });
        });

        // Return only used sizes in standard order
        return SIZE_ORDER.filter(size => usedSizes.has(size));
    }

    /**
     * Build price legend showing different unit prices for sizes
     * @param {Object} pricing - Size to price mapping
     * @returns {string} HTML for price legend
     */
    buildPriceLegend(pricing) {
        const prices = Object.entries(pricing);
        if (prices.length === 0) return '';

        // Group sizes by price
        const priceGroups = {};
        prices.forEach(([size, price]) => {
            const priceKey = price.toFixed(2);
            if (!priceGroups[priceKey]) {
                priceGroups[priceKey] = [];
            }
            priceGroups[priceKey].push(size);
        });

        // If all same price, no legend needed
        if (Object.keys(priceGroups).length <= 1) return '';

        // Sort by price ascending
        const sortedPrices = Object.keys(priceGroups).sort((a, b) => parseFloat(a) - parseFloat(b));
        const basePrice = parseFloat(sortedPrices[0]);

        const legendParts = sortedPrices.map(priceKey => {
            const sizes = priceGroups[priceKey];
            const price = parseFloat(priceKey);
            const upcharge = price - basePrice;

            if (upcharge === 0) {
                return `<strong>${sizes.join('-')}</strong>: $${priceKey}`;
            } else {
                return `<strong>${sizes.join(', ')}</strong>: $${priceKey} (+$${upcharge.toFixed(0)})`;
            }
        });

        return `<div class="price-legend">Unit Pricing: ${legendParts.join(' | ')}</div>`;
    }

    /**
     * Generate size matrix table HTML matching on-screen quote builder format
     * Columns: Style | Description | Color | S | M | LG | XL | XXL | XXXL(Other) | Qty | Unit $
     * Each row shows its own values (no rowspan)
     * Extended sizes show qty in XXXL(Other) column
     * @param {Object} pricingData - Full pricing data object
     * @returns {string} HTML table
     */
    generateSizeMatrixTable(pricingData) {
        if (!pricingData.products || pricingData.products.length === 0) {
            return '<div style="color: #666; font-style: italic;">No products added</div>';
        }

        // Fixed size columns matching quote builder (standardized labels)
        const sizeColumns = ['S', 'M', 'L', 'XL', '2XL', '3XL+'];
        // Extended sizes that go into 3XL+ (Other) column
        // Must include ALL non-standard sizes: tall, youth, toddler, big, combos, one-size
        const extendedSizes = [
            // Extended large
            'XS', '3XL', '4XL', '5XL', '6XL', '7XL', '8XL', '9XL', '10XL', 'XXXL',
            // Tall sizes (CRITICAL for tall-only products like TLCS410)
            'LT', 'XLT', '2XLT', '3XLT', '4XLT', '5XLT', '6XLT', 'ST', 'MT', 'XST',
            // One-size
            'OSFA', 'OSFM',
            // Combos (for fitted caps)
            'S/M', 'M/L', 'L/XL', 'XS/S', 'X/2X', 'S/XL',
            // Youth
            'YXS', 'YS', 'YM', 'YL', 'YXL',
            // Toddler
            '2T', '3T', '4T', '5T', '5/6T', '6T',
            // Big
            'LB', 'XLB', '2XLB',
            // Extra small
            'XXS', '2XS', 'XXL'
        ];

        // Track totals
        let grandTotalQty = 0;
        let grandTotalAmount = 0;

        // Build header
        let tableHTML = `
            <div style="margin: 15px 0;">
                <div style="font-size: 14px; font-weight: bold; color: #4cb354; margin-bottom: 10px;">
                    Products
                </div>
                <table class="size-matrix">
                    <thead>
                        <tr>
                            <th class="part-col" style="width: 55px;">Style</th>
                            <th class="desc-col" style="width: 180px;">Description</th>
                            <th class="color-col" style="width: 90px;">Color</th>
                            <th class="size-col" style="width: 28px;">S</th>
                            <th class="size-col" style="width: 28px;">M</th>
                            <th class="size-col" style="width: 28px;">L</th>
                            <th class="size-col" style="width: 28px;">XL</th>
                            <th class="size-col" style="width: 28px;">2XL</th>
                            <th class="size-col" style="width: 40px;">3XL+<br><span style="font-size: 7px; font-weight: normal;">(Other)</span></th>
                            <th style="width: 32px; text-align: center;">Qty</th>
                            <th style="width: 55px; text-align: right;">Unit $</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        // Build rows - ONE ROW PER LINE ITEM (includes service products)
        pricingData.products.forEach(pp => {
            // Handle SERVICE PRODUCTS (DECG, DECC, AL, MONOGRAM, etc.) - 2026-02 refactor
            if (pp.product?.isService || pp.isService) {
                const serviceType = pp.product?.style || pp.style || 'SERVICE';
                const description = pp.product?.title || pp.title || serviceType;
                const position = pp.product?.position || pp.position || '';
                const isCap = pp.product?.isCap || pp.isCap || false;
                const quantity = pp.product?.totalQuantity || pp.totalQuantity || 0;
                const unitPrice = pp.lineItems?.[0]?.unitPrice || pp.unitPrice || 0;
                const total = pp.lineItems?.[0]?.total || (quantity * unitPrice) || 0;

                grandTotalQty += quantity;
                grandTotalAmount += total;

                // Service row - spans size columns with description
                tableHTML += `
                    <tr class="product-row service-row" style="background: ${isCap ? '#eff6ff' : '#fffbeb'};">
                        <td class="part-cell" style="font-weight: 600; color: ${isCap ? '#1e40af' : '#92400e'};">${serviceType}</td>
                        <td class="desc-cell" colspan="2">${description}${position ? ' - ' + position : ''}</td>
                        <td colspan="6" style="text-align: center; color: #94a3b8; font-size: 8px; font-style: italic;">
                            Service item
                        </td>
                        <td class="qty-cell" style="text-align: center;">${quantity}</td>
                        <td class="unit-cell" style="text-align: right;">$${unitPrice.toFixed(2)}</td>
                    </tr>
                `;
                return; // Skip regular product processing
            }

            const numLineItems = pp.lineItems.length;
            const hasExtendedSizes = numLineItems > 1;

            pp.lineItems.forEach((item, index) => {
                const isFirstRow = index === 0;
                // Parse size from description (e.g., "2XLT(2)" → {2XLT: 2})
                const sizes = this.parseSizeBreakdown(item.description);

                grandTotalQty += item.quantity;
                grandTotalAmount += item.total;

                // Determine style/description for this row
                let rowStyle = pp.product.style || '';
                let rowDescription = pp.product.title || '';
                let rowColor = pp.product.color || '';

                // For extended size rows, modify the style and description
                if (!isFirstRow) {
                    // Extended size row - find which size this is
                    const extSize = Object.keys(sizes)[0]; // e.g., "2XL", "3XL", "2XLT"
                    if (extSize) {
                        // Update style to include suffix (e.g., PC61_2X)
                        rowStyle = this.getExtendedSizeStyle(rowStyle, extSize);
                        // Update description to include size
                        rowDescription = `${rowDescription} - ${extSize}`;
                    }
                }

                // Build size cells - base sizes in their columns, extended in XXXL(Other)
                let sizeCells = '';

                // Check if this line item has extended sizes
                const hasExtInThisRow = Object.keys(sizes).some(s => extendedSizes.includes(s));

                if (isFirstRow && hasExtendedSizes) {
                    // Base row with extended sizes below - show checkmark in 3XL+
                    sizeColumns.forEach(col => {
                        if (col === '3XL+') {
                            sizeCells += `<td class="size-cell" style="color: #4cb354; font-weight: bold;">✓</td>`;
                        } else {
                            // Map legacy formats: LG -> L, XXL -> 2XL
                            let qty = sizes[col];
                            if (!qty && col === 'L') qty = sizes['LG'];
                            if (!qty && col === '2XL') qty = sizes['XXL'];
                            sizeCells += `<td class="size-cell">${qty ? qty : ''}</td>`;
                        }
                    });
                } else if (hasExtInThisRow) {
                    // Extended size row - show qty in 3XL+ (Other) column
                    const extQty = item.quantity;
                    sizeColumns.forEach(col => {
                        if (col === '3XL+') {
                            sizeCells += `<td class="size-cell">${extQty}</td>`;
                        } else {
                            sizeCells += `<td class="size-cell"></td>`;
                        }
                    });
                } else {
                    // Regular row - show sizes in their columns
                    sizeColumns.forEach(col => {
                        // Map legacy formats: LG -> L, XXL -> 2XL
                        let qty = sizes[col];
                        if (!qty && col === 'L') qty = sizes['LG'];
                        if (!qty && col === '2XL') qty = sizes['XXL'];
                        sizeCells += `<td class="size-cell">${qty ? qty : ''}</td>`;
                    });
                }

                tableHTML += `
                    <tr class="product-row${!isFirstRow ? ' extended-size-row' : ''}">
                        <td class="part-cell">${rowStyle}</td>
                        <td class="desc-cell">${rowDescription}</td>
                        <td class="color-cell">${rowColor}</td>
                        ${sizeCells}
                        <td class="qty-cell" style="text-align: center;">${item.quantity}</td>
                        <td class="unit-cell" style="text-align: right;">$${item.unitPrice.toFixed(2)}</td>
                    </tr>
                `;
            });
        });

        // Build totals row
        tableHTML += `
                <tr class="totals-row">
                    <td colspan="3" style="text-align: right; padding-right: 10px;"><strong>TOTAL:</strong></td>
                    <td colspan="6"></td>
                    <td class="qty-cell" style="text-align: center;"><strong>${grandTotalQty}</strong></td>
                    <td class="unit-cell" style="text-align: right;"><strong>$${grandTotalAmount.toFixed(2)}</strong></td>
                </tr>
                    </tbody>
                </table>
            </div>
        `;

        return tableHTML;
    }

    /**
     * Convert base style to extended size style
     * e.g., "PC61" + "2XL" -> "PC61_2X"
     */
    getExtendedSizeStyle(baseStyle, size) {
        if (!baseStyle || !size) return baseStyle;

        // Map size names to style suffixes
        const suffixMap = {
            '2XL': '_2X',
            '3XL': '_3X',
            '4XL': '_4X',
            '5XL': '_5X',
            '6XL': '_6X',
            'XXXL': '_3X',
            'XS': '' // XS typically doesn't have suffix
        };

        const suffix = suffixMap[size] || '';
        return suffix ? `${baseStyle}${suffix}` : baseStyle;
    }

    /**
     * Generate totals section
     */
    generateTotalsSection(pricingData, taxAmount, totalWithTax) {
        return `
            <div class="totals-section">
                <div class="total-row subtotal-row">
                    <span>Subtotal:</span>
                    <span>$${pricingData.grandTotal.toFixed(2)}</span>
                </div>
                ${pricingData.additionalServicesTotal > 0 ? `
                <div class="total-row">
                    <span>Additional Services:</span>
                    <span>$${pricingData.additionalServicesTotal.toFixed(2)}</span>
                </div>` : ''}
                ${pricingData.setupFees > 0 ? `
                <div class="total-row">
                    <span>Setup Fees:</span>
                    <span>$${pricingData.setupFees.toFixed(2)}</span>
                </div>` : ''}
                ${pricingData.safetyStripesTotal > 0 ? `
                <div class="total-row">
                    <span>Safety Stripes Surcharge:</span>
                    <span>$${pricingData.safetyStripesTotal.toFixed(2)}</span>
                </div>` : ''}
                ${(pricingData.garmentLtmFee || 0) > 0 && !pricingData.ltmDistributed ? `
                <div class="total-row">
                    <span>Less Than Minimum Fee - Garments:</span>
                    <span>$${pricingData.garmentLtmFee.toFixed(2)}</span>
                </div>` : ''}
                ${(pricingData.capLtmFee || 0) > 0 && !pricingData.ltmDistributed ? `
                <div class="total-row">
                    <span>Less Than Minimum Fee - Caps:</span>
                    <span>$${pricingData.capLtmFee.toFixed(2)}</span>
                </div>` : ''}
                ${(pricingData.artCharge || 0) > 0 ? `
                <div class="total-row">
                    <span>Logo Mockup & Review:</span>
                    <span>$${pricingData.artCharge.toFixed(2)}</span>
                </div>` : ''}
                ${(pricingData.graphicDesignFee || pricingData.graphicDesignCharge || 0) > 0 ? `
                <div class="total-row">
                    <span>Graphic Design (${pricingData.graphicDesignHours || 0} hrs × $75):</span>
                    <span>$${(pricingData.graphicDesignFee || pricingData.graphicDesignCharge).toFixed(2)}</span>
                </div>` : ''}
                ${(pricingData.rushFee || 0) > 0 ? `
                <div class="total-row">
                    <span>Rush Fee:</span>
                    <span>$${pricingData.rushFee.toFixed(2)}</span>
                </div>` : ''}
                ${(pricingData.discount || 0) > 0 ? `
                <div class="total-row discount-row">
                    <span>Discount${pricingData.discountReason ? ` (${pricingData.discountReason})` : ''}:</span>
                    <span>-$${pricingData.discount.toFixed(2)}</span>
                </div>` : ''}
                ${(pricingData.additionalServicesTotal > 0 || pricingData.setupFees > 0 || (((pricingData.garmentLtmFee || 0) > 0 || (pricingData.capLtmFee || 0) > 0) && !pricingData.ltmDistributed) || pricingData.safetyStripesTotal > 0 || (pricingData.artCharge || 0) > 0 || (pricingData.graphicDesignFee || pricingData.graphicDesignCharge || 0) > 0 || (pricingData.rushFee || 0) > 0 || (pricingData.discount || 0) > 0) ? `
                <div class="total-row subtotal-row">
                    <span>Subtotal:</span>
                    <span>$${pricingData.grandTotal.toFixed(2)}</span>
                </div>` : ''}
                <div class="total-row tax-row">
                    <span>WA Sales Tax (10.1%):</span>
                    <span>$${taxAmount.toFixed(2)}</span>
                </div>
                <div class="total-row grand-total">
                    <span>GRAND TOTAL:</span>
                    <span>$${totalWithTax.toFixed(2)}</span>
                </div>
            </div>
        `;
    }
    
    /**
     * Generate footer
     */
    generateFooter(customerData) {
        return `
            <div class="invoice-footer">
                <div class="footer-section">
                    <div class="footer-title">PAYMENT TERMS:</div>
                    <div class="footer-text">50% deposit required to begin production. Balance due at pickup.</div>
                </div>
                <div class="footer-section">
                    <div class="footer-title">QUOTE VALIDITY:</div>
                    <div class="footer-text">This quote is valid for 30 days from the date of issue. Prices subject to change after expiration.</div>
                </div>
                ${customerData.notes ? `
                <div class="footer-section">
                    <div class="footer-title">SPECIAL NOTES:</div>
                    <div class="footer-text">${customerData.notes}</div>
                </div>` : ''}
                <div class="tagline">Family Owned & Operated Since 1977</div>
            </div>
        `;
    }
}

// Make available globally
window.EmbroideryInvoiceGenerator = EmbroideryInvoiceGenerator;