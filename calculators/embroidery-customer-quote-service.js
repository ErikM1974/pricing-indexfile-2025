/**
 * Customer Embroidery Quote Service
 * Handles saving Customer Supplied Embroidery quotes to Caspio database
 * Extends BaseQuoteService for common functionality
 */

class CustomerEmbroideryQuoteService extends BaseQuoteService {
    constructor() {
        super({
            prefix: 'EMBC',
            storagePrefix: 'customer_embroidery',
            sessionPrefix: 'embc_sess'
        });
    }

    /**
     * Generate unique quote ID for Customer Embroidery quotes
     * Override to handle add-on and program account prefixes
     */
    generateQuoteID() {
        // Get base quote ID from parent
        const baseQuoteId = super.generateQuoteID();
        
        // Modify prefix based on order type
        if (this.isProgramAccount) {
            return baseQuoteId.replace('EMBC', 'EMBC-PA');
        } else if (this.isAddonOrder) {
            return baseQuoteId.replace('EMBC', 'EMBC-AO');
        }
        return baseQuoteId;
    }
    
    /**
     * Get embellishment type for customer embroidery
     */
    getEmbellishmentType() {
        return 'embroidery';
    }

    /**
     * Generate session ID
     */
    generateSessionID() {
        return `embc_sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Get pricing tier based on quantity
     */
    getPricingTier(quantity) {
        if (quantity <= 2) return '1-2';
        if (quantity <= 5) return '3-5';
        if (quantity <= 11) return '6-11';
        if (quantity <= 23) return '12-23';
        if (quantity <= 71) return '24-71';
        if (quantity <= 143) return '72-143';
        return '144+';
    }

    /**
     * Save Customer Embroidery quote
     */
    async saveQuote(quoteData) {
        try {
            // Set flags for quote ID generation
            this.isAddonOrder = quoteData.isAddon || false;
            this.isProgramAccount = quoteData.isProgramAccount || false;
            const quoteID = this.generateQuoteID();
            const sessionID = this.generateSessionID();
            
            console.log('[CustomerEmbroideryQuoteService] Saving quote with ID:', quoteID);

            // Step 1: Create quote session
            const expiresAtDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
            const formattedExpiresAt = expiresAtDate.toISOString().replace(/\.\d{3}Z$/, '');
            
            const sessionData = {
                QuoteID: quoteID,
                SessionID: sessionID,
                CustomerEmail: quoteData.customerEmail,
                CustomerName: quoteData.customerName || 'Guest',
                CompanyName: quoteData.companyName || 'Not Provided',
                Phone: quoteData.customerPhone || '',
                TotalQuantity: parseInt(quoteData.quantity || 0),
                SubtotalAmount: parseFloat((quoteData.priceAfterDiscount * quoteData.quantity).toFixed(2)),
                LTMFeeTotal: quoteData.ltmFeeTotal || 0,
                TotalAmount: parseFloat((quoteData.totalCost || 0).toFixed(2)),
                Status: 'Open',
                ExpiresAt: formattedExpiresAt,
                Notes: quoteData.notes || ''
            };

            console.log('[CustomerEmbroideryQuoteService] Session data:', sessionData);

            const sessionResponse = await fetch(`${this.baseURL}/api/quote_sessions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(sessionData)
            });

            // Get response text first to see error details
            const responseText = await sessionResponse.text();
            console.log('[CustomerEmbroideryQuoteService] Session response status:', sessionResponse.status);
            console.log('[CustomerEmbroideryQuoteService] Session response text:', responseText);

            if (!sessionResponse.ok) {
                let errorMessage = `Session creation failed: ${sessionResponse.status}`;
                try {
                    const errorData = JSON.parse(responseText);
                    errorMessage = errorData.message || errorData.error || errorMessage;
                } catch (e) {
                    errorMessage += ` - ${responseText}`;
                }
                throw new Error(errorMessage);
            }

            // Parse successful response
            let sessionResult;
            try {
                sessionResult = JSON.parse(responseText);
            } catch (e) {
                console.error('[CustomerEmbroideryQuoteService] Failed to parse success response:', e);
                sessionResult = { success: true, message: responseText };
            }
            
            console.log('[CustomerEmbroideryQuoteService] Session created:', sessionResult);

            // Step 2: Add item to quote
            const addedAt = new Date().toISOString().replace(/\.\d{3}Z$/, '');
            
            // Build product description
            let productName = quoteData.itemType === 'caps' ? 'Caps' : 'Flats';
            if (quoteData.isHeavyweight && quoteData.itemType === 'flats') {
                productName += ' (Heavyweight)';
            }
            productName += ' - Customer Supplied';
            if (quoteData.isAddon) {
                productName += ' [ADD-ON]';
            }
            if (quoteData.isProgramAccount) {
                productName += ' [PROGRAM]';
            }

            const itemData = {
                QuoteID: quoteID,
                LineNumber: 1,
                StyleNumber: 'CUSTOMER-EMB',
                ProductName: productName,
                Color: 'Customer Supplied',
                ColorCode: '',
                EmbellishmentType: 'embroidery',
                PrintLocation: 'Customer Specified',
                PrintLocationName: 'Customer Specified',
                Quantity: parseInt(quoteData.quantity || 0),
                HasLTM: quoteData.ltmFeeTotal > 0 ? 'Yes' : 'No',
                BaseUnitPrice: parseFloat((quoteData.basePrice || 0).toFixed(2)),
                LTMPerUnit: parseFloat((quoteData.ltmPerUnit || 0).toFixed(2)),
                FinalUnitPrice: parseFloat((quoteData.unitPrice || 0).toFixed(2)),
                LineTotal: parseFloat((quoteData.totalCost || 0).toFixed(2)),
                SizeBreakdown: '{}',
                PricingTier: this.getPricingTier(quoteData.quantity || 0),
                ImageURL: '',
                AddedAt: addedAt
            };

            console.log('[CustomerEmbroideryQuoteService] Item data:', itemData);

            const itemResponse = await fetch(`${this.baseURL}/api/quote_items`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(itemData)
            });

            const itemResponseText = await itemResponse.text();
            console.log('[CustomerEmbroideryQuoteService] Item response status:', itemResponse.status);
            console.log('[CustomerEmbroideryQuoteService] Item response text:', itemResponseText);

            if (!itemResponse.ok) {
                let errorMessage = `Item creation failed: ${itemResponse.status}`;
                try {
                    const errorData = JSON.parse(itemResponseText);
                    errorMessage = errorData.message || errorData.error || errorMessage;
                } catch (e) {
                    errorMessage += ` - ${itemResponseText}`;
                }
                throw new Error(errorMessage);
            }

            return {
                success: true,
                quoteID: quoteID,
                sessionData: sessionResult
            };

        } catch (error) {
            console.error('[CustomerEmbroideryQuoteService] Error saving quote:', error);
            // Still return the quote ID if we have one, even if database save failed
            // This ensures the customer gets their quote
            if (error.message.includes('Session created') || error.message.includes('Item creation failed')) {
                return {
                    success: false,
                    quoteID: this.generateQuoteID(),
                    error: error.message
                };
            }
            throw error;
        }
    }
}

// Make available globally
window.CustomerEmbroideryQuoteService = CustomerEmbroideryQuoteService;