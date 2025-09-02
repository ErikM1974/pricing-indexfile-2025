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
                padding: 0.5in;
                background: white;
            }
            
            /* Header */
            .invoice-header {
                display: flex;
                justify-content: space-between;
                align-items: start;
                padding-bottom: 20px;
                border-bottom: 3px solid #4cb354;
                margin-bottom: 30px;
            }
            
            .company-info {
                flex: 1;
            }
            
            .company-logo {
                width: 200px;
                height: auto;
                margin-bottom: 10px;
            }
            
            .company-details {
                font-size: 12px;
                color: #666;
                line-height: 1.4;
            }
            
            .quote-info {
                text-align: right;
                flex: 0 0 250px;
            }
            
            .quote-title {
                font-size: 24px;
                font-weight: bold;
                color: #4cb354;
                margin-bottom: 10px;
            }
            
            .quote-details {
                font-size: 12px;
                color: #666;
            }
            
            .quote-details strong {
                color: #333;
            }
            
            /* Customer Section */
            .customer-section {
                display: flex;
                justify-content: space-between;
                margin-bottom: 30px;
                padding: 15px;
                background: #f8f9fa;
                border-radius: 5px;
            }
            
            .customer-info, .sales-rep-info {
                flex: 1;
            }
            
            .section-title {
                font-size: 14px;
                font-weight: bold;
                color: #4cb354;
                margin-bottom: 5px;
            }
            
            .info-line {
                font-size: 12px;
                color: #666;
                margin: 2px 0;
            }
            
            /* Products Table */
            .products-table {
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 30px;
            }
            
            .products-table thead {
                background: #4cb354;
                color: white;
            }
            
            .products-table th {
                padding: 10px 8px;
                text-align: left;
                font-size: 12px;
                font-weight: 600;
                border-right: 1px solid rgba(255,255,255,0.2);
            }
            
            .products-table th:last-child {
                border-right: none;
            }
            
            .products-table th:nth-child(6),
            .products-table th:nth-child(7),
            .products-table th:nth-child(8),
            .products-table td:nth-child(6),
            .products-table td:nth-child(7),
            .products-table td:nth-child(8) {
                text-align: right;
            }
            
            .products-table td {
                padding: 8px;
                border-bottom: 1px solid #e0e0e0;
                font-size: 11px;
            }
            
            .product-image {
                width: 40px;
                height: 40px;
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
                font-size: 10px;
                color: #666;
                display: block;
                margin-top: 2px;
            }
            
            .size-breakdown {
                font-family: 'Courier New', monospace;
                font-size: 11px;
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
     * Generate products table
     */
    generateProductsTable(pricingData) {
        let tableHTML = `
            <table class="products-table">
                <thead>
                    <tr>
                        <th style="width: 50px;">Image</th>
                        <th style="width: 60px;">Style #</th>
                        <th style="width: 80px;">Color</th>
                        <th>Description</th>
                        <th style="width: 120px;">Size</th>
                        <th style="width: 40px;">Qty</th>
                        <th style="width: 70px;">Unit Price</th>
                        <th style="width: 80px;">Line Total</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        // Add product rows
        pricingData.products.forEach(pp => {
            const primaryLogo = pricingData.logos.find(l => l.isPrimary !== false);
            const hasExtraStitches = primaryLogo && primaryLogo.stitchCount > 8000;
            
            pp.lineItems.forEach(item => {
                const displayPrice = item.unitPriceWithLTM || item.unitPrice;
                const imageUrl = pp.product.imageUrl || '';
                
                // Parse size breakdown
                let sizeDisplay = this.parseSizeDisplay(item);
                
                tableHTML += `
                    <tr>
                        <td>${imageUrl ? `<img src="${imageUrl}" class="product-image" alt="Product">` : ''}</td>
                        <td>${pp.product.style}</td>
                        <td>${pp.product.color}</td>
                        <td class="description-cell">
                            <div class="logo-position">${pp.product.title}</div>
                            <div>Primary Logo: ${primaryLogo ? primaryLogo.position : 'Left Chest'}</div>
                            ${hasExtraStitches ? `<span class="stitch-count">${primaryLogo.stitchCount.toLocaleString()} stitches</span>` : ''}
                        </td>
                        <td class="size-breakdown">${sizeDisplay}</td>
                        <td>${item.quantity}</td>
                        <td>$${displayPrice.toFixed(2)}</td>
                        <td>$${item.total.toFixed(2)}</td>
                    </tr>
                `;
            });
        });
        
        // Add additional services
        if (pricingData.additionalServices && pricingData.additionalServices.length > 0) {
            pricingData.additionalServices.forEach(service => {
                tableHTML += `
                    <tr class="additional-service-row">
                        <td></td>
                        <td>${service.partNumber}</td>
                        <td>N/A</td>
                        <td class="description-cell">
                            <div class="logo-position">${service.type === 'monogram' ? 'Personalized Names' : `Additional Logo #${service.logoNumber || ''}`}</div>
                            <div>${service.description}</div>
                        </td>
                        <td>${service.type === 'monogram' ? `${service.quantity} names` : `Applied to ${service.quantity} items`}</td>
                        <td>${service.quantity}</td>
                        <td>$${service.unitPrice.toFixed(2)}</td>
                        <td>$${service.total.toFixed(2)}</td>
                    </tr>
                `;
            });
        }
        
        tableHTML += `
                </tbody>
            </table>
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