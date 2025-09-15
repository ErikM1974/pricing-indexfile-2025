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
                <title>Embroidery Quote ${pricingData.quoteId || ''}</title>
                <style>
                    ${this.getInvoiceStyles()}
                </style>
            </head>
            <body>
                <div class="invoice-container">
                    ${this.generateHeader(pricingData.quoteId, today, expiryDate)}
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
        `;
    }
    
    /**
     * Generate invoice header
     */
    generateHeader(quoteId, today, expiryDate) {
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
                    <div class="quote-title">EMBROIDERY QUOTE</div>
                    <div class="quote-details">
                        <strong>Quote #:</strong> ${quoteId || 'EMB-DRAFT'}<br>
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
     * Generate embroidery specifications section
     */
    generateEmbroiderySpecs(pricingData) {
        if (!pricingData.logos || pricingData.logos.length === 0) {
            return '';
        }
        
        let specsHTML = `
            <div style="margin: 10px 0; padding: 10px; background: #e8f5e9; border: 1px solid #4cb354; border-radius: 5px;">
                <div style="font-size: 12px; font-weight: bold; color: #4cb354; margin-bottom: 8px;">EMBROIDERY PACKAGE FOR THIS ORDER:</div>
        `;
        
        // List primary logo
        pricingData.logos.forEach((logo, index) => {
            if (logo.isPrimary !== false) {
                specsHTML += `
                    <div style="font-size: 11px; color: #333; margin: 4px 0;">
                        ✓ <strong>Left Chest</strong> (${logo.stitchCount.toLocaleString()} stitches) - 
                        <span style="color: #4cb354;">INCLUDED IN BASE PRICE</span>
                    </div>
                `;
            }
        });
        
        // Add additional logos with clear pricing and digitizing info
        const additionalLogos = pricingData.logos.filter(l => l.isPrimary === false);
        additionalLogos.forEach((logo, index) => {
            const alCost = pricingData.alCost || 11.50;
            const needsDigitizing = logo.needsDigitizing || false;
            const digitizingText = needsDigitizing ? ' [+$100 Digitizing]' : '';
            
            specsHTML += `
                <div style="font-size: 11px; color: #333; margin: 4px 0;">
                    ✓ <strong>Right Chest</strong> (${logo.stitchCount.toLocaleString()} stitches) - 
                    <span style="color: #ff6b35;">ADDITIONAL (+$${alCost.toFixed(2)} per piece)</span>
                    <span style="color: #666;">${digitizingText}</span>
                </div>
            `;
        });
        
        // Add setup fees if present
        if (pricingData.setupFees > 0) {
            const digitizingCount = pricingData.logos.filter(l => l.needsDigitizing).length;
            if (digitizingCount > 0) {
                specsHTML += `
                    <div style="font-size: 10px; color: #666; margin-top: 5px;">
                        <strong>Setup Fees:</strong> ${digitizingCount} logo${digitizingCount > 1 ? 's' : ''} × $100 digitizing = $${pricingData.setupFees.toFixed(2)}
                    </div>
                `;
            }
        }
        
        // Add LTM notice if applicable
        if (pricingData.ltmFee > 0) {
            const ltmPerPiece = (pricingData.ltmFee / pricingData.totalQuantity).toFixed(2);
            specsHTML += `
                <div style="font-size: 9px; color: #dc3545; margin-top: 5px; font-style: italic;">
                    ⚠ Small Batch Fee: ADDITIONAL (+$${ltmPerPiece} per piece for orders under 24)
                </div>
            `;
        }
        
        specsHTML += `</div>`;
        
        return specsHTML;
    }
    
    /**
     * Generate products table matching screen layout
     */
    generateProductsTable(pricingData) {
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
            
            // Get AL cost from actual data
            const alCost = pricingData.alCost || (regularSizes[0] && regularSizes[0].alCost) || 0
            
            // Add regular sizes if exists
            if (regularSizes.length > 0) {
                const totalQty = regularSizes.reduce((sum, item) => sum + item.quantity, 0);
                const item = regularSizes[0];
                const basePrice = item.basePrice;
                const unitPrice = item.unitPriceWithLTM || item.unitPrice;
                const totalAmount = regularSizes.reduce((sum, item) => sum + item.total, 0);
                const sizeDesc = regularSizes.map(item => this.parseSizeDisplay(item)).join(' ');
                
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
                            Base (includes primary logo): $${basePrice.toFixed(2)} = $${basePrice.toFixed(2)} each<br>
                            + AL Right Chest: $${alCost.toFixed(2)}<br>
                            = $${unitPrice.toFixed(2)} each
                        </div>
                    </div>
                `;
            }
            
            // Add 2XL sizes
            if (size2XL.length > 0) {
                size2XL.forEach(item => {
                    const displayPrice = item.unitPriceWithLTM || item.unitPrice;
                    const basePrice = item.basePrice;
                    const sizeDesc = this.parseSizeDisplay(item);
                    
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
                                Base (includes primary logo): $${basePrice.toFixed(2)} = $${basePrice.toFixed(2)} each<br>
                                + AL Right Chest: $${alCost.toFixed(2)}<br>
                                = $${displayPrice.toFixed(2)} each
                            </div>
                        </div>
                    `;
                });
            }
            
            // Add 3XL sizes
            if (size3XL.length > 0) {
                size3XL.forEach(item => {
                    const displayPrice = item.unitPriceWithLTM || item.unitPrice;
                    const basePrice = item.basePrice;
                    const sizeDesc = this.parseSizeDisplay(item);
                    
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
                                Base (includes primary logo): $${basePrice.toFixed(2)} = $${basePrice.toFixed(2)} each<br>
                                + AL Right Chest: $${alCost.toFixed(2)}<br>
                                = $${displayPrice.toFixed(2)} each
                            </div>
                        </div>
                    `;
                });
            }
            
            // Add other larger sizes if any
            if (largerSizes.length > 0) {
                largerSizes.forEach(item => {
                    const displayPrice = item.unitPriceWithLTM || item.unitPrice;
                    const basePrice = item.basePrice;
                    const sizeDesc = this.parseSizeDisplay(item);
                    
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
                                Base (includes primary logo): $${basePrice.toFixed(2)} = $${basePrice.toFixed(2)} each<br>
                                + AL Right Chest: $${alCost.toFixed(2)}<br>
                                = $${displayPrice.toFixed(2)} each
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
                    
                    const description = service.type === 'monogram' 
                        ? 'Personalized Names/Monogramming'
                        : `Additional Logo: ${cleanDescription}`;
                    
                    const appliedTo = service.type === 'monogram'
                        ? `${service.quantity} names`
                        : service.products 
                            ? `${service.products.join(', ')}`
                            : `${service.quantity} pieces`;
                    
                    tableHTML += `
                        <tr class="additional-service-row">
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
     * Generate totals section
     */
    generateTotalsSection(pricingData, taxAmount, totalWithTax) {
        return `
            <div class="totals-section">
                <div class="total-row subtotal-row">
                    <span>Subtotal:</span>
                    <span>$${pricingData.subtotal.toFixed(2)}</span>
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
                <div class="total-row subtotal-row">
                    <span>Subtotal:</span>
                    <span>$${pricingData.grandTotal.toFixed(2)}</span>
                </div>
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