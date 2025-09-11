/**
 * Quote Formatter Class
 * Formats quotes for professional print, copy, and email output
 * Includes NWCA branding and consistent formatting
 */

class QuoteFormatter {
    constructor() {
        this.companyInfo = {
            name: 'Northwest Custom Apparel',
            phone: '(253) 922-5793',
            email: 'sales@nwcustomapparel.com',
            logo: 'https://cdn.caspio.com/A0E15000/Safety%20Stripes/web%20northwest%20custom%20apparel%20logo.png?ver=1',
            hours: 'Monday - Friday: 8:30 AM - 5:00 PM PST',
            since: '1977',
            address: 'Tacoma, WA'
        };

        // Sales rep mapping
        this.salesReps = {
            'sales@nwcustomapparel.com': 'General Sales',
            'adriyella@nwcustomapparel.com': 'Adriyella',
            'bradley@nwcustomapparel.com': 'Bradley Wright',
            'erik@nwcustomapparel.com': 'Erik Mickelson',
            'jim@nwcustomapparel.com': 'Jim Mickelson',
            'nika@nwcustomapparel.com': 'Nika Lao',
            'ruth@nwcustomapparel.com': 'Ruth Nhong',
            'art@nwcustomapparel.com': 'Steve Deland',
            'taneisha@nwcustomapparel.com': 'Taneisha Clark'
        };
    }

    // ============================================
    // PRINT FORMATTING
    // ============================================

    /**
     * Format quote for printing - generates complete HTML document
     */
    formatQuoteForPrint(quoteData) {
        const currentDate = new Date().toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        const validUntil = new Date();
        validUntil.setDate(validUntil.getDate() + 30);
        const validUntilDate = validUntil.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Quote ${quoteData.quoteId || 'Draft'}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            background: white;
        }
        
        .quote-container {
            max-width: 8.5in;
            margin: 0 auto;
            padding: 0.5in;
            background: white;
        }
        
        /* Header */
        .quote-header {
            display: flex;
            justify-content: space-between;
            align-items: start;
            border-bottom: 3px solid #003f7f;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        
        .company-logo {
            max-width: 200px;
            height: auto;
        }
        
        .company-info {
            text-align: right;
            flex: 1;
            margin-left: 20px;
        }
        
        .company-info h1 {
            color: #003f7f;
            font-size: 28px;
            margin-bottom: 5px;
        }
        
        .company-info .tagline {
            color: #666;
            font-style: italic;
            font-size: 14px;
        }
        
        .company-info .contact {
            margin-top: 10px;
            font-size: 14px;
        }
        
        /* Quote Meta */
        .quote-meta {
            display: flex;
            justify-content: space-between;
            margin-bottom: 30px;
            gap: 30px;
        }
        
        .quote-number {
            flex: 1;
        }
        
        .quote-number h2 {
            color: #003f7f;
            font-size: 22px;
            margin-bottom: 10px;
        }
        
        .quote-number p {
            font-size: 14px;
            color: #666;
            margin: 3px 0;
        }
        
        .customer-info {
            flex: 1;
            background: #f8f9fa;
            padding: 15px;
            border-radius: 5px;
        }
        
        .customer-info h3 {
            color: #003f7f;
            font-size: 16px;
            margin-bottom: 10px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        
        .customer-info p {
            font-size: 14px;
            margin: 5px 0;
        }
        
        .customer-info strong {
            color: #000;
        }
        
        /* Quote Items */
        .quote-items {
            margin: 30px 0;
        }
        
        .quote-items h3 {
            color: #003f7f;
            font-size: 18px;
            margin-bottom: 15px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        
        .items-table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
        }
        
        .items-table th {
            background: #003f7f;
            color: white;
            padding: 12px;
            text-align: left;
            font-size: 14px;
            font-weight: 600;
        }
        
        .items-table th:last-child,
        .items-table td:last-child {
            text-align: right;
        }
        
        .items-table td {
            padding: 12px;
            border-bottom: 1px solid #e0e0e0;
            font-size: 14px;
        }
        
        .items-table tbody tr:hover {
            background: #f8f9fa;
        }
        
        .item-details {
            line-height: 1.4;
        }
        
        .item-details strong {
            color: #000;
            display: block;
            margin-bottom: 3px;
        }
        
        .item-details small {
            color: #666;
            display: block;
            margin: 2px 0;
        }
        
        /* Totals */
        .items-table tfoot td {
            font-weight: bold;
            padding: 12px;
            border-top: 2px solid #003f7f;
            border-bottom: none;
        }
        
        .subtotal-row td {
            padding-top: 20px !important;
            border-top: 2px solid #003f7f !important;
        }
        
        .grand-total td {
            font-size: 18px;
            color: #003f7f;
            padding: 15px 12px !important;
            background: #f8f9fa;
            border-top: 3px solid #003f7f !important;
        }
        
        /* Footer */
        .quote-footer {
            margin-top: 50px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
        }
        
        .footer-grid {
            display: flex;
            justify-content: space-between;
            margin-bottom: 20px;
        }
        
        .footer-section {
            flex: 1;
        }
        
        .footer-section h4 {
            color: #003f7f;
            font-size: 14px;
            margin-bottom: 8px;
            text-transform: uppercase;
        }
        
        .footer-section p {
            font-size: 13px;
            color: #666;
            margin: 3px 0;
        }
        
        .terms {
            background: #fff3cd;
            border: 1px solid #ffc107;
            padding: 12px;
            border-radius: 5px;
            margin: 20px 0;
        }
        
        .terms h4 {
            color: #856404;
            font-size: 14px;
            margin-bottom: 8px;
        }
        
        .terms p {
            font-size: 12px;
            color: #856404;
            margin: 5px 0;
        }
        
        .thank-you {
            text-align: center;
            font-size: 18px;
            font-weight: bold;
            color: #003f7f;
            margin: 30px 0 10px;
        }
        
        .footer-logo {
            text-align: center;
            margin-top: 20px;
            padding-top: 20px;
            border-top: 1px solid #e0e0e0;
        }
        
        /* Print specific */
        @media print {
            body {
                print-color-adjust: exact;
                -webkit-print-color-adjust: exact;
            }
            
            .quote-container {
                padding: 0;
            }
            
            .items-table tbody tr:hover {
                background: transparent;
            }
            
            @page {
                margin: 0.5in;
                size: letter;
            }
        }
    </style>
</head>
<body>
    <div class="quote-container">
        <!-- Header -->
        <header class="quote-header">
            <div>
                <img src="${this.companyInfo.logo}" alt="Northwest Custom Apparel" class="company-logo">
            </div>
            <div class="company-info">
                <h1>${this.companyInfo.name}</h1>
                <p class="tagline">Serving the Pacific Northwest Since ${this.companyInfo.since}</p>
                <div class="contact">
                    <p>${this.companyInfo.phone}</p>
                    <p>${this.companyInfo.email}</p>
                    <p>${this.companyInfo.hours}</p>
                </div>
            </div>
        </header>
        
        <!-- Quote Meta -->
        <div class="quote-meta">
            <div class="quote-number">
                <h2>Quote #${quoteData.quoteId || 'DRAFT'}</h2>
                <p><strong>Date Issued:</strong> ${currentDate}</p>
                <p><strong>Valid Until:</strong> ${validUntilDate}</p>
                <p><strong>Quote Type:</strong> ${this.getQuoteType(quoteData.quoteId)}</p>
            </div>
            <div class="customer-info">
                <h3>Customer Information</h3>
                <p><strong>${this.sanitize(quoteData.customerName || 'N/A')}</strong></p>
                ${quoteData.companyName ? `<p>${this.sanitize(quoteData.companyName)}</p>` : ''}
                <p>${this.sanitize(quoteData.customerEmail || 'N/A')}</p>
                <p>${this.formatPhone(quoteData.customerPhone) || 'N/A'}</p>
                ${quoteData.projectName ? `<p><strong>Project:</strong> ${this.sanitize(quoteData.projectName)}</p>` : ''}
            </div>
        </div>

        <!-- Quote Items -->
        <div class="quote-items">
            <h3>Quote Details</h3>
            <table class="items-table">
                <thead>
                    <tr>
                        <th width="5%">#</th>
                        <th width="35%">Product Details</th>
                        <th width="15%">Quantity</th>
                        <th width="15%">Setup</th>
                        <th width="15%">Unit Price</th>
                        <th width="15%">Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${this.formatItemsForPrint(quoteData.items || [])}
                </tbody>
                <tfoot>
                    ${this.formatTotalsForPrint(quoteData)}
                </tfoot>
            </table>
        </div>

        <!-- Footer -->
        <footer class="quote-footer">
            <div class="footer-grid">
                <div class="footer-section">
                    <h4>Sales Representative</h4>
                    <p>${this.getSalesRepName(quoteData.salesRepEmail) || 'General Sales'}</p>
                    <p>${quoteData.salesRepEmail || this.companyInfo.email}</p>
                </div>
                <div class="footer-section">
                    <h4>Contact Us</h4>
                    <p>Phone: ${this.companyInfo.phone}</p>
                    <p>Email: ${this.companyInfo.email}</p>
                </div>
                <div class="footer-section">
                    <h4>Business Hours</h4>
                    <p>${this.companyInfo.hours}</p>
                    <p>${this.companyInfo.address}</p>
                </div>
            </div>
            
            <div class="terms">
                <h4>Terms & Conditions</h4>
                <p>• This quote is valid for 30 days from the date issued</p>
                <p>• Prices are subject to change after expiration</p>
                <p>• 50% deposit required to begin production</p>
                <p>• Production time begins after art approval and deposit</p>
                <p>• Minimum order requirements may apply</p>
            </div>
            
            <p class="thank-you">Thank you for your business!</p>
            
            <div class="footer-logo">
                <small>© ${new Date().getFullYear()} Northwest Custom Apparel - All Rights Reserved</small>
            </div>
        </footer>
    </div>
</body>
</html>`;
    }

    /**
     * Format items for print table
     */
    formatItemsForPrint(items) {
        if (!items || items.length === 0) {
            return '<tr><td colspan="6" style="text-align: center; padding: 20px;">No items added to quote</td></tr>';
        }

        return items.map((item, index) => {
            const itemTotal = (item.quantity || 0) * (item.unitPrice || 0) + (item.setupFee || 0);
            
            return `
                <tr>
                    <td>${index + 1}</td>
                    <td class="item-details">
                        <strong>${this.sanitize(item.style || 'Product')}</strong>
                        ${item.description ? `<small>${this.sanitize(item.description)}</small>` : ''}
                        ${item.color ? `<small>Color: ${this.sanitize(item.color)}</small>` : ''}
                        ${item.sizes ? `<small>Sizes: ${this.formatSizes(item.sizes)}</small>` : ''}
                        ${item.locations ? `<small>Locations: ${this.sanitize(item.locations)}</small>` : ''}
                        ${item.colors ? `<small>Colors: ${this.sanitize(item.colors)}</small>` : ''}
                    </td>
                    <td>${item.quantity || 0}</td>
                    <td>$${this.formatNumber(item.setupFee || 0)}</td>
                    <td>$${this.formatNumber(item.unitPrice || 0)}</td>
                    <td>$${this.formatNumber(itemTotal)}</td>
                </tr>
            `;
        }).join('');
    }

    /**
     * Format totals section for print
     */
    formatTotalsForPrint(quoteData) {
        const subtotal = quoteData.subtotal || this.calculateSubtotal(quoteData.items);
        const setupTotal = quoteData.setupTotal || this.calculateSetupTotal(quoteData.items);
        const grandTotal = quoteData.grandTotal || (subtotal + setupTotal);

        let totalsHTML = `
            <tr class="subtotal-row">
                <td colspan="5">Subtotal:</td>
                <td>$${this.formatNumber(subtotal)}</td>
            </tr>
        `;

        if (setupTotal > 0) {
            totalsHTML += `
                <tr>
                    <td colspan="5">Total Setup Fees:</td>
                    <td>$${this.formatNumber(setupTotal)}</td>
                </tr>
            `;
        }

        totalsHTML += `
            <tr class="grand-total">
                <td colspan="5"><strong>TOTAL:</strong></td>
                <td><strong>$${this.formatNumber(grandTotal)}</strong></td>
            </tr>
        `;

        return totalsHTML;
    }

    // ============================================
    // COPY TO CLIPBOARD FORMATTING
    // ============================================

    /**
     * Format quote for copy to clipboard (plain text)
     */
    formatQuoteForCopy(quoteData) {
        const currentDate = new Date().toLocaleDateString();
        const validUntil = new Date();
        validUntil.setDate(validUntil.getDate() + 30);

        let text = `${this.companyInfo.name.toUpperCase()}\n`;
        text += `${this.companyInfo.phone} | ${this.companyInfo.email}\n`;
        text += `${'='.repeat(60)}\n\n`;

        text += `QUOTE #${quoteData.quoteId || 'DRAFT'}\n`;
        text += `Date: ${currentDate}\n`;
        text += `Valid Until: ${validUntil.toLocaleDateString()}\n\n`;

        text += `CUSTOMER INFORMATION:\n`;
        text += `${'-'.repeat(40)}\n`;
        text += `Name: ${quoteData.customerName || 'N/A'}\n`;
        if (quoteData.companyName) text += `Company: ${quoteData.companyName}\n`;
        text += `Email: ${quoteData.customerEmail || 'N/A'}\n`;
        text += `Phone: ${this.formatPhone(quoteData.customerPhone) || 'N/A'}\n`;
        if (quoteData.projectName) text += `Project: ${quoteData.projectName}\n`;
        text += '\n';

        text += `QUOTE DETAILS:\n`;
        text += `${'-'.repeat(40)}\n`;

        if (quoteData.items && quoteData.items.length > 0) {
            quoteData.items.forEach((item, index) => {
                const itemTotal = (item.quantity || 0) * (item.unitPrice || 0) + (item.setupFee || 0);
                
                text += `\nItem ${index + 1}: ${item.style || 'Product'}\n`;
                if (item.description) text += `  Description: ${item.description}\n`;
                if (item.color) text += `  Color: ${item.color}\n`;
                if (item.sizes) text += `  Sizes: ${this.formatSizes(item.sizes)}\n`;
                if (item.locations) text += `  Locations: ${item.locations}\n`;
                if (item.colors) text += `  Colors: ${item.colors}\n`;
                text += `  Quantity: ${item.quantity || 0}\n`;
                text += `  Setup Fee: $${this.formatNumber(item.setupFee || 0)}\n`;
                text += `  Unit Price: $${this.formatNumber(item.unitPrice || 0)}\n`;
                text += `  Line Total: $${this.formatNumber(itemTotal)}\n`;
            });
        } else {
            text += 'No items added to quote\n';
        }

        text += `\nPRICING SUMMARY:\n`;
        text += `${'-'.repeat(40)}\n`;

        const subtotal = quoteData.subtotal || this.calculateSubtotal(quoteData.items);
        const setupTotal = quoteData.setupTotal || this.calculateSetupTotal(quoteData.items);
        const grandTotal = quoteData.grandTotal || (subtotal + setupTotal);

        text += `Subtotal: $${this.formatNumber(subtotal)}\n`;
        if (setupTotal > 0) {
            text += `Setup Fees: $${this.formatNumber(setupTotal)}\n`;
        }
        text += `TOTAL: $${this.formatNumber(grandTotal)}\n\n`;

        text += `Sales Representative: ${this.getSalesRepName(quoteData.salesRepEmail) || 'General Sales'}\n`;
        text += `Contact: ${this.companyInfo.phone}\n`;
        text += `Email: ${this.companyInfo.email}\n\n`;

        text += `${'='.repeat(60)}\n`;
        text += `This quote is valid for 30 days from the date issued.\n`;
        text += `Prices are subject to change after expiration.\n`;
        text += `Thank you for your business!\n`;

        return text;
    }

    // ============================================
    // EMAIL FORMATTING
    // ============================================

    /**
     * Format quote for email (URL encoded for mailto)
     */
    formatQuoteForEmail(quoteData) {
        // Get the plain text version
        const plainText = this.formatQuoteForCopy(quoteData);
        
        // URL encode for mailto link
        // Replace line breaks with %0D%0A for proper email formatting
        return plainText.replace(/\n/g, '%0D%0A');
    }

    /**
     * Generate mailto link
     */
    generateMailtoLink(quoteData) {
        const subject = `Quote ${quoteData.quoteId || 'Draft'} - ${quoteData.projectName || this.companyInfo.name}`;
        const body = this.formatQuoteForEmail(quoteData);
        
        // Build mailto link
        const mailto = `mailto:${quoteData.customerEmail || ''}?subject=${encodeURIComponent(subject)}&body=${body}`;
        
        // Check length (some browsers have limits)
        if (mailto.length > 2000) {
            // Return shortened version
            const shortBody = `Please find attached Quote #${quoteData.quoteId || 'DRAFT'} for your review.%0D%0A%0D%0ATotal: $${this.formatNumber(quoteData.grandTotal || 0)}%0D%0A%0D%0AThank you for your business!`;
            return `mailto:${quoteData.customerEmail || ''}?subject=${encodeURIComponent(subject)}&body=${shortBody}`;
        }
        
        return mailto;
    }

    // ============================================
    // HELPER METHODS
    // ============================================

    /**
     * Get quote type from ID prefix
     */
    getQuoteType(quoteId) {
        if (!quoteId) return 'Draft Quote';
        
        const types = {
            'DTG': 'DTG Contract',
            'RICH': 'Richardson Caps',
            'EMB': 'Embroidery Contract',
            'EMBC': 'Customer Supplied Embroidery',
            'LT': 'Laser Tumblers',
            'PATCH': 'Embroidered Emblems',
            'SPC': 'Customer Screen Print',
            'SSC': 'Safety Stripe Creator',
            'WEB': 'Webstore Setup',
            'SP': 'Screen Print'
        };

        const prefix = quoteId.split(/[\d-]/)[0];
        return types[prefix] || 'Custom Quote';
    }

    /**
     * Get sales rep name from email
     */
    getSalesRepName(email) {
        return this.salesReps[email] || 'Sales Team';
    }

    /**
     * Format phone number
     */
    formatPhone(phone) {
        if (!phone) return '';
        
        const cleaned = ('' + phone).replace(/\D/g, '');
        if (cleaned.length === 10) {
            return `(${cleaned.substr(0,3)}) ${cleaned.substr(3,3)}-${cleaned.substr(6)}`;
        }
        return phone;
    }

    /**
     * Format sizes array
     */
    formatSizes(sizes) {
        if (!sizes || sizes.length === 0) return 'N/A';
        
        if (typeof sizes === 'string') return sizes;
        
        if (Array.isArray(sizes)) {
            return sizes.map(s => {
                if (typeof s === 'object') {
                    return `${s.size}: ${s.quantity}`;
                }
                return s;
            }).join(', ');
        }
        
        return 'N/A';
    }

    /**
     * Format number with commas
     */
    formatNumber(num) {
        return parseFloat(num || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }

    /**
     * Calculate subtotal from items
     */
    calculateSubtotal(items) {
        if (!items || items.length === 0) return 0;
        
        return items.reduce((total, item) => {
            return total + ((item.quantity || 0) * (item.unitPrice || 0));
        }, 0);
    }

    /**
     * Calculate total setup fees
     */
    calculateSetupTotal(items) {
        if (!items || items.length === 0) return 0;
        
        return items.reduce((total, item) => {
            return total + (item.setupFee || 0);
        }, 0);
    }

    /**
     * Sanitize text for HTML output
     */
    sanitize(text) {
        if (!text) return '';
        
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Open print dialog with formatted quote
     */
    openPrintDialog(quoteData) {
        const printContent = this.formatQuoteForPrint(quoteData);
        const printWindow = window.open('', '_blank');
        
        if (printWindow) {
            printWindow.document.write(printContent);
            printWindow.document.close();
            
            // Wait for content and images to load
            printWindow.onload = function() {
                setTimeout(() => {
                    printWindow.print();
                    // Don't auto-close - let user close after printing
                }, 100);
            };
        } else {
            // Popup blocked
            alert('Please allow popups to print the quote');
        }
    }

    /**
     * Copy quote to clipboard
     */
    async copyToClipboard(quoteData) {
        const text = this.formatQuoteForCopy(quoteData);
        
        try {
            // Try modern clipboard API first
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(text);
                return true;
            }
            
            // Fallback for older browsers
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            textarea.style.pointerEvents = 'none';
            document.body.appendChild(textarea);
            textarea.select();
            const success = document.execCommand('copy');
            document.body.removeChild(textarea);
            
            return success;
        } catch (err) {
            console.error('Failed to copy to clipboard:', err);
            return false;
        }
    }

    /**
     * Open email client with quote
     */
    openEmailClient(quoteData) {
        const mailtoLink = this.generateMailtoLink(quoteData);
        
        // Check if link is too long
        if (mailtoLink.length > 2000) {
            // Copy to clipboard instead
            this.copyToClipboard(quoteData).then(success => {
                if (success) {
                    alert('Quote copied to clipboard! Please paste it into your email.');
                    // Still try to open email client
                    const shortMailto = `mailto:${quoteData.customerEmail || ''}?subject=Quote ${quoteData.quoteId || 'Draft'}`;
                    window.location.href = shortMailto;
                }
            });
        } else {
            window.location.href = mailtoLink;
        }
    }
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = QuoteFormatter;
}