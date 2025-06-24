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

        // Format the data for the template
        const templateParams = {
            // Recipient
            to_email: quoteData.customerEmail,
            cc_email: quoteData.senderEmail,  // CC the sales rep
            
            // Sender
            from_name: quoteData.senderName,
            reply_to: quoteData.senderEmail || 'sales@nwcustomapparel.com',
            sender_email: quoteData.senderEmail || 'sales@nwcustomapparel.com',
            
            // Product details
            product_name: quoteData.productName,
            style_number: quoteData.styleNumber,
            product_image: quoteData.productImage,
            color_name: quoteData.colorName,
            sizes: quoteData.sizes,
            product_url: quoteData.productUrl,
            product_description: quoteData.description || '',
            brand_logo: quoteData.brandLogo || '',
            brand_name: quoteData.brandName || '',
            
            // Color swatches HTML
            color_swatches_html: this.generateColorSwatchesHTML(quoteData.allColors, quoteData.selectedColorIndex),
            
            // Quote details
            quantity: quoteData.quantity,
            decoration_method: quoteData.decorationMethod,
            price_per_item: this.formatPrice(quoteData.pricePerItem),
            setup_fee: this.formatPrice(quoteData.setupFee),
            total_price: this.formatPrice(quoteData.totalPrice),
            
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