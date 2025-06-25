/**
 * Email Service
 * Handles EmailJS integration for sending product quotes
 */

export class EmailService {
    constructor() {
        this.publicKey = '4qSbDO-SQs19TbP80';
        this.serviceId = 'service_1c4k67j';
        this.templateId = 'template_2fnnd49';
        this.initialized = false;
        
        this.init();
    }

    init() {
        if (window.emailjs) {
            window.emailjs.init(this.publicKey);
            this.initialized = true;
            console.log('[EmailService] Initialized successfully');
        } else {
            console.error('[EmailService] EmailJS SDK not loaded');
        }
    }

    /**
     * Send product quote email
     * @param {Object} quoteData - Quote details
     * @returns {Promise}
     */
    async sendQuote(quoteData) {
        if (!this.initialized) {
            throw new Error('EmailJS not initialized');
        }

        // Check if this is a multi-product quote (more than 1 product)
        const isMultiProduct = quoteData.products && quoteData.products.length > 1;

        // Format the data for the template
        const templateParams = {
            // Recipient
            to_email: quoteData.customerEmail,
            cc_email: quoteData.senderEmail,  // CC the sales rep
            
            // Customer info
            customer_name: quoteData.customerName || 'Customer',
            customer_phone: quoteData.customerPhone || 'Not provided',
            company_name: quoteData.companyName || 'Not provided',
            quote_id: quoteData.quoteID || '',
            
            // Sender
            from_name: quoteData.senderName,
            reply_to: quoteData.senderEmail || 'sales@nwcustomapparel.com',
            sender_email: quoteData.senderEmail || 'sales@nwcustomapparel.com',
            
            // For single product quotes (when products array has 1 item, use that data)
            product_name: !isMultiProduct && quoteData.products?.length === 1 ? quoteData.products[0].productName : (isMultiProduct ? 'Multiple Products' : quoteData.productName),
            style_number: !isMultiProduct && quoteData.products?.length === 1 ? quoteData.products[0].styleNumber : (isMultiProduct ? 'See details below' : quoteData.styleNumber),
            product_image: !isMultiProduct && quoteData.products?.length === 1 ? quoteData.products[0].productImage : (isMultiProduct ? '' : quoteData.productImage),
            color_name: !isMultiProduct && quoteData.products?.length === 1 ? quoteData.products[0].colorName : (isMultiProduct ? 'Various' : quoteData.colorName),
            sizes: !isMultiProduct && quoteData.products?.length === 1 ? quoteData.products[0].sizes : (isMultiProduct ? 'See individual products' : quoteData.sizes),
            product_url: quoteData.productUrl,
            product_description: !isMultiProduct && quoteData.products?.length === 1 ? (quoteData.products[0].description || '') : (isMultiProduct ? '' : (quoteData.description || '')),
            brand_logo: !isMultiProduct && quoteData.products?.length === 1 ? (quoteData.products[0].brandLogo || '') : (isMultiProduct ? (quoteData.products?.[0]?.brandLogo || '') : (quoteData.brandLogo || '')),
            brand_name: !isMultiProduct && quoteData.products?.length === 1 ? quoteData.products[0].brandName : (isMultiProduct ? 'Multiple Brands' : (quoteData.brandName || '')),
            
            // Product HTML (used for both single and multiple products)
            products_html: quoteData.products && quoteData.products.length > 0 ? this.generateMultiProductHTML(quoteData.products) : '',
            
            // Quote details (single product fields for backwards compatibility)
            quantity: !isMultiProduct && quoteData.products?.length === 1 ? quoteData.products[0].quantity : (isMultiProduct ? 'See breakdown' : quoteData.quantity),
            decoration_method: !isMultiProduct && quoteData.products?.length === 1 ? quoteData.products[0].decorationMethod : (isMultiProduct ? 'Various' : quoteData.decorationMethod),
            price_per_item: !isMultiProduct && quoteData.products?.length === 1 ? this.formatPrice(quoteData.products[0].pricePerItem) : (isMultiProduct ? 'See breakdown' : this.formatPrice(quoteData.pricePerItem)),
            setup_fee: !isMultiProduct && quoteData.products?.length === 1 ? this.formatPrice(quoteData.products[0].setupFee) : (isMultiProduct ? 'See breakdown' : this.formatPrice(quoteData.setupFee)),
            total_price: this.formatPrice(quoteData.grandTotal || quoteData.totalPrice),
            
            // Additional info
            notes: quoteData.notes || '',
            quote_date: this.formatDate(new Date()),
            
            // Pricing disclaimer HTML
            pricing_disclaimer_html: `
                <p style="margin-top: 20px; color: #666; font-size: 13px; text-align: center;">
                    *Pricing subject to final artwork and specifications
                </p>
            `
        };

        try {
            const response = await window.emailjs.send(
                this.serviceId,
                this.templateId,
                templateParams
            );
            
            console.log('[EmailService] Quote sent successfully:', response);
            
            // Save sender name for next time
            if (quoteData.senderName) {
                localStorage.setItem('nwca_sender_name', quoteData.senderName);
            }
            
            return response;
        } catch (error) {
            console.error('[EmailService] Failed to send quote:', error);
            throw error;
        }
    }

    /**
     * Format price to 2 decimal places
     */
    formatPrice(price) {
        return parseFloat(price || 0).toFixed(2);
    }

    /**
     * Format date as MM/DD/YYYY
     */
    formatDate(date) {
        return date.toLocaleDateString('en-US', {
            month: '2-digit',
            day: '2-digit',
            year: 'numeric'
        });
    }

    /**
     * Get saved sender name
     */
    getSavedSenderName() {
        return localStorage.getItem('nwca_sender_name') || '';
    }

    /**
     * Validate email address
     */
    isValidEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }

    /**
     * Generate HTML for multiple products
     */
    generateMultiProductHTML(products) {
        if (!products || products.length === 0) return '';
        
        let html = '<div style="margin: 20px 0;">';
        html += '<h2 style="color: #2f661e; margin-bottom: 20px;">Product Quote Details</h2>';
        
        // Simple products table
        html += `
            <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden;">
                <thead>
                    <tr style="background: #f5f5f5; border-bottom: 2px solid #e0e0e0;">
                        <th style="padding: 12px; text-align: left;">Product</th>
                        <th style="padding: 12px; text-align: left;">Color</th>
                        <th style="padding: 12px; text-align: center;">Qty</th>
                        <th style="padding: 12px; text-align: right;">Price</th>
                        <th style="padding: 12px; text-align: right;">Subtotal</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        products.forEach((product, index) => {
            html += `
                <tr style="border-bottom: 1px solid #e0e0e0;">
                    <td style="padding: 12px;">
                        <div style="display: flex; align-items: center;">
                            ${product.productImage ? `<img src="${product.productImage}" alt="${product.productName}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 4px; margin-right: 12px;">` : ''}
                            <div>
                                <div style="font-weight: bold;">${product.productName}</div>
                                <div style="color: #666; font-size: 14px;">Style: ${product.styleNumber}</div>
                            </div>
                        </div>
                    </td>
                    <td style="padding: 12px;">${product.colorName}</td>
                    <td style="padding: 12px; text-align: center;">${product.quantity}</td>
                    <td style="padding: 12px; text-align: right;">$${this.formatPrice(product.pricePerItem)}</td>
                    <td style="padding: 12px; text-align: right; font-weight: bold;">$${this.formatPrice(product.subtotal)}</td>
                </tr>
            `;
        });
        
        html += `
                </tbody>
            </table>
        `;
        
        // Grand total
        const grandTotal = products.reduce((sum, p) => sum + p.subtotal, 0);
        html += `
            <div style="background: #f9f9f9; border: 2px solid #2f661e; border-radius: 8px; padding: 20px; margin-top: 30px;">
                <table style="width: 100%; font-size: 18px;">
                    <tr>
                        <td><strong>GRAND TOTAL:</strong></td>
                        <td style="text-align: right;"><strong>$${this.formatPrice(grandTotal)}</strong></td>
                    </tr>
                </table>
            </div>
            
            <p style="margin-top: 20px; color: #666; font-size: 13px; text-align: center;">
                *Pricing subject to final artwork and specifications
            </p>
        `;
        
        html += '</div>';
        return html;
    }

    /**
     * Generate HTML for color swatches
     */
    generateColorSwatchesHTML(colors, selectedIndex) {
        if (!colors || colors.length === 0) return '';
        
        let html = '<table style="width: 100%; margin-top: 20px;"><tr><td style="text-align: center;">';
        html += '<p style="margin-bottom: 10px; font-weight: bold;">Available Colors:</p>';
        html += '<div style="display: inline-block;">';
        
        colors.forEach((color, index) => {
            const colorName = color.COLOR_NAME || color.colorName || 'Color';
            const isSelected = index === selectedIndex;
            const border = isSelected ? '3px solid #2f661e' : '1px solid #ddd';
            
            html += `
                <div style="display: inline-block; margin: 5px; text-align: center;">
                    <div style="width: 40px; height: 40px; border: ${border}; border-radius: 4px; margin: 0 auto;">
                        <img src="${color.COLOR_SQUARE_IMAGE}" alt="${colorName}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 3px;">
                    </div>
                    <div style="font-size: 11px; margin-top: 2px; ${isSelected ? 'font-weight: bold; color: #2f661e;' : ''}">${colorName}</div>
                </div>
            `;
            
            // Add line break after every 8 colors
            if ((index + 1) % 8 === 0 && index < colors.length - 1) {
                html += '</div><div style="display: inline-block;">';
            }
        });
        
        html += '</div></td></tr></table>';
        return html;
    }
}