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

        // Check if this is a multi-product quote
        const isMultiProduct = quoteData.products && quoteData.products.length > 0;

        // Format the data for the template
        const templateParams = {
            // Recipient
            to_email: quoteData.customerEmail,
            cc_email: quoteData.senderEmail,  // CC the sales rep
            
            // Sender
            from_name: quoteData.senderName,
            reply_to: quoteData.senderEmail || 'sales@nwcustomapparel.com',
            sender_email: quoteData.senderEmail || 'sales@nwcustomapparel.com',
            
            // For backwards compatibility with single product quotes
            product_name: isMultiProduct ? 'Multiple Products' : quoteData.productName,
            style_number: isMultiProduct ? 'See details below' : quoteData.styleNumber,
            product_image: isMultiProduct ? (quoteData.products[0]?.productImage || '') : quoteData.productImage,
            color_name: isMultiProduct ? 'Various' : quoteData.colorName,
            sizes: isMultiProduct ? 'See individual products' : quoteData.sizes,
            product_url: quoteData.productUrl,
            product_description: isMultiProduct ? '' : (quoteData.description || ''),
            brand_logo: isMultiProduct ? '' : (quoteData.brandLogo || ''),
            brand_name: isMultiProduct ? 'Multiple Brands' : (quoteData.brandName || ''),
            
            // Multi-product HTML
            products_html: isMultiProduct ? this.generateMultiProductHTML(quoteData.products) : '',
            
            // Color swatches HTML (empty for multi-product)
            color_swatches_html: isMultiProduct ? '' : this.generateColorSwatchesHTML(quoteData.allColors, quoteData.selectedColorIndex),
            
            // Quote details (single product fields for backwards compatibility)
            quantity: isMultiProduct ? 'See breakdown' : quoteData.quantity,
            decoration_method: isMultiProduct ? 'Various' : quoteData.decorationMethod,
            price_per_item: isMultiProduct ? 'See breakdown' : this.formatPrice(quoteData.pricePerItem),
            setup_fee: isMultiProduct ? 'See breakdown' : this.formatPrice(quoteData.setupFee),
            total_price: this.formatPrice(isMultiProduct ? quoteData.grandTotal : quoteData.totalPrice),
            
            // Additional info
            notes: quoteData.notes || '',
            quote_date: this.formatDate(new Date())
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
        
        // Product cards
        products.forEach((product, index) => {
            html += `
                <div style="border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px; margin-bottom: 20px; background: #ffffff;">
                    <h3 style="color: #2f661e; margin-top: 0;">Product ${index + 1}: ${product.productName}</h3>
                    
                    <table style="width: 100%;">
                        <tr>
                            <td style="width: 150px; vertical-align: top;">
                                ${product.productImage ? `<img src="${product.productImage}" alt="${product.productName}" style="width: 140px; height: auto; border-radius: 4px;">` : ''}
                            </td>
                            <td style="padding-left: 20px; vertical-align: top;">
                                <p style="margin: 5px 0;"><strong>Style:</strong> ${product.styleNumber}</p>
                                ${product.brandName ? `<p style="margin: 5px 0;"><strong>Brand:</strong> ${product.brandName}</p>` : ''}
                                <p style="margin: 5px 0;"><strong>Color:</strong> ${product.colorName}</p>
                                ${product.sizes ? `<p style="margin: 5px 0;"><strong>Available Sizes:</strong> ${product.sizes}</p>` : ''}
                            </td>
                        </tr>
                    </table>
                    
                    <table style="width: 100%; margin-top: 15px; border-top: 1px solid #e0e0e0; padding-top: 15px;">
                        <tr>
                            <td style="width: 50%;"><strong>Quantity:</strong></td>
                            <td style="text-align: right;">${product.quantity} pieces</td>
                        </tr>
                        <tr>
                            <td><strong>Decoration Method:</strong></td>
                            <td style="text-align: right;">${product.decorationMethod}</td>
                        </tr>
                        <tr>
                            <td><strong>Price per Item:</strong></td>
                            <td style="text-align: right;">$${this.formatPrice(product.pricePerItem)}</td>
                        </tr>
                        ${product.setupFee > 0 ? `
                        <tr>
                            <td><strong>Setup Fee:</strong></td>
                            <td style="text-align: right;">$${this.formatPrice(product.setupFee)}</td>
                        </tr>
                        ` : ''}
                        <tr style="background: #f5f5f5; font-weight: bold;">
                            <td style="padding: 8px;"><strong>Subtotal:</strong></td>
                            <td style="text-align: right; padding: 8px;">$${this.formatPrice(product.subtotal)}</td>
                        </tr>
                    </table>
                </div>
            `;
        });
        
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