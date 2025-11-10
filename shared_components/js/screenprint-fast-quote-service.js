/**
 * Screen Print Fast Quote Service
 * Handles simplified quote submissions
 */
class ScreenPrintFastQuoteService {
    constructor() {
        this.baseURL = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
        this.quotePrefix = 'SPC';  // Screen Print Contract
        this.emailjsServiceId = 'service_1c4k67j';
        this.emailjsPublicKey = '4qSbDO-SQs19TbP80';

        // Initialize EmailJS if not already done
        if (typeof emailjs !== 'undefined') {
            emailjs.init(this.emailjsPublicKey);
        }

        console.log('[FastQuoteService] Initialized');
    }

    /**
     * Generate unique quote ID
     * Format: SPC[MMDD]-[sequence]
     */
    generateQuoteID() {
        const now = new Date();
        const month = (now.getMonth() + 1).toString().padStart(2, '0');
        const day = now.getDate().toString().padStart(2, '0');
        const dateKey = `${month}${day}`;

        // Daily sequence using sessionStorage
        const storageKey = `spc_fast_quote_sequence_${dateKey}`;
        let sequence = parseInt(sessionStorage.getItem(storageKey) || '0') + 1;
        sessionStorage.setItem(storageKey, sequence.toString());

        // Clean up old sequences (older than today)
        this.cleanupOldSequences(dateKey);

        return `${this.quotePrefix}${dateKey}-${sequence}`;
    }

    /**
     * Clean up old sequence keys from sessionStorage
     */
    cleanupOldSequences(currentDateKey) {
        try {
            const keysToRemove = [];
            for (let i = 0; i < sessionStorage.length; i++) {
                const key = sessionStorage.key(i);
                if (key && key.startsWith('spc_fast_quote_sequence_') && !key.includes(currentDateKey)) {
                    keysToRemove.push(key);
                }
            }
            keysToRemove.forEach(key => sessionStorage.removeItem(key));
        } catch (error) {
            console.error('[FastQuoteService] Cleanup error:', error);
        }
    }

    /**
     * Submit quote to database and send emails
     */
    async submitQuote(formData) {
        try {
            const quoteId = this.generateQuoteID();
            console.log('[FastQuoteService] Submitting quote:', quoteId);

            // Save to database
            const dbResult = await this.saveToDatabase(quoteId, formData);

            // Send emails (don't fail if email fails)
            try {
                await this.sendCustomerEmail(quoteId, formData);
                await this.sendSalesTeamEmail(quoteId, formData);
            } catch (emailError) {
                console.error('[FastQuoteService] Email error (non-fatal):', emailError);
            }

            return {
                success: true,
                quoteId: quoteId,
                message: 'Quote submitted successfully'
            };

        } catch (error) {
            console.error('[FastQuoteService] Submit error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Save quote to Caspio database
     */
    async saveToDatabase(quoteId, formData) {
        try {
            // Format expiration date (30 days)
            const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                .toISOString()
                .replace(/\.\d{3}Z$/, '');

            // Create session data
            const sessionData = {
                QuoteID: quoteId,
                SessionID: `spc_fast_${Date.now()}`,
                CustomerEmail: formData.customerEmail,
                CustomerName: formData.customerName,
                CompanyName: formData.companyName || 'Not Provided',
                Phone: formData.customerPhone,
                TotalQuantity: this.parseQuantityRange(formData.quantity),
                SubtotalAmount: 0,  // Will be determined by sales team
                TotalAmount: 0,     // Will be determined by sales team
                Status: 'Fast Quote Request',
                ExpiresAt: expiresAt,
                Notes: this.formatNotes(formData)
            };

            console.log('[FastQuoteService] Saving to database:', sessionData);

            const response = await fetch(`${this.baseURL}/api/quote_sessions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(sessionData)
            });

            const responseText = await response.text();
            console.log('[FastQuoteService] Database response:', response.status, responseText);

            if (!response.ok) {
                throw new Error(`Database save failed: ${responseText}`);
            }

            return { success: true };

        } catch (error) {
            console.error('[FastQuoteService] Database error:', error);
            // Don't throw - allow quote to succeed even if DB fails
            return { success: false, error: error.message };
        }
    }

    /**
     * Parse quantity range to get minimum value
     */
    parseQuantityRange(quantityRange) {
        const match = quantityRange.match(/\d+/);
        return match ? parseInt(match[0]) : 24;
    }

    /**
     * Format notes with all project details
     */
    formatNotes(formData) {
        const parts = [
            `FAST QUOTE REQUEST`,
            `Quantity: ${formData.quantity}`,
            `Print Locations: ${formData.locations}`,
            `Colors Per Location: ${formData.colors}`
        ];

        if (formData.deadline) {
            parts.push(`Target Deadline: ${formData.deadline}`);
        }

        if (formData.notes) {
            parts.push(`Customer Notes: ${formData.notes}`);
        }

        return parts.join('\n');
    }

    /**
     * Send confirmation email to customer
     */
    async sendCustomerEmail(quoteId, formData) {
        try {
            const emailData = {
                to_email: formData.customerEmail,
                to_name: formData.customerName,
                quote_id: quoteId,
                customer_name: formData.customerName,
                company_name: formData.companyName || 'Your organization',
                quantity: formData.quantity,
                locations: formData.locations,
                colors: formData.colors,
                deadline: formData.deadline || 'Not specified',
                notes: formData.notes || 'None',
                company_phone: '253-922-5793',
                company_email: 'sales@nwcustomapparel.com'
            };

            console.log('[FastQuoteService] Sending customer email');

            await emailjs.send(
                this.emailjsServiceId,
                'template_fastquote_customer',  // Need to create this template
                emailData
            );

            console.log('[FastQuoteService] Customer email sent');
            return { success: true };

        } catch (error) {
            console.error('[FastQuoteService] Customer email error:', error);
            throw error;
        }
    }

    /**
     * Send notification email to sales team
     */
    async sendSalesTeamEmail(quoteId, formData) {
        try {
            const emailData = {
                to_email: 'sales@nwcustomapparel.com',
                quote_id: quoteId,
                customer_name: formData.customerName,
                customer_email: formData.customerEmail,
                customer_phone: formData.customerPhone,
                company_name: formData.companyName || 'Not provided',
                quantity: formData.quantity,
                locations: formData.locations,
                colors: formData.colors,
                deadline: formData.deadline || 'Not specified',
                notes: formData.notes || 'None',
                submitted_date: new Date().toLocaleString()
            };

            console.log('[FastQuoteService] Sending sales team email');

            await emailjs.send(
                this.emailjsServiceId,
                'template_fastquote_sales',  // Need to create this template
                emailData
            );

            console.log('[FastQuoteService] Sales team email sent');
            return { success: true };

        } catch (error) {
            console.error('[FastQuoteService] Sales team email error:', error);
            throw error;
        }
    }
}

// Make service available globally
window.ScreenPrintFastQuoteService = ScreenPrintFastQuoteService;

console.log('[FastQuoteService] Loaded successfully');