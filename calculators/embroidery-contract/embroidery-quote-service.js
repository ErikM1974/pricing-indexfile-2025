/**
 * Embroidery Quote Service
 * Handles saving Contract Embroidery quotes to Caspio database
 * Extends BaseQuoteService for common functionality
 */

class EmbroideryQuoteService extends BaseQuoteService {
    constructor() {
        super({
            prefix: 'EMB',
            storagePrefix: 'embroidery',
            sessionPrefix: 'emb_sess'
        });
    }

    /**
     * Get embellishment type for Embroidery
     */
    getEmbellishmentType() {
        return 'embroidery';
    }

    /**
     * Get pricing tier based on quantity
     * Override base class with Embroidery-specific tiers
     */
    getPricingTier(quantity) {
        if (quantity <= 15) return '1-15';
        if (quantity <= 31) return '16-31';
        if (quantity <= 63) return '32-63';
        if (quantity <= 127) return '64-127';
        return '128+';
    }

    /**
     * Save Embroidery quote
     */
    async saveQuote(quoteData) {
        try {
            const quoteID = this.generateQuoteID();
            const sessionID = this.generateSessionID();
            
            console.log('[EmbroideryQuoteService] Saving quote with ID:', quoteID);

            // Step 1: Create quote session
            const expiresAtDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
            const formattedExpiresAt = expiresAtDate.toISOString().replace(/\.\\d{3}Z$/, '');
            
            const sessionData = {
                QuoteID: quoteID,
                SessionID: sessionID,
                CustomerEmail: quoteData.customerEmail,
                CustomerName: quoteData.customerName || 'Guest',
                CompanyName: quoteData.companyName || 'Not Provided',
                Phone: quoteData.customerPhone || '',
                TotalQuantity: parseInt(quoteData.quantity || 0),
                SubtotalAmount: parseFloat((quoteData.baseTotal || 0).toFixed(2)),
                LTMFeeTotal: quoteData.ltmFee || 0,
                TotalAmount: parseFloat((quoteData.grandTotal || 0).toFixed(2)),
                Status: 'Open',
                ExpiresAt: formattedExpiresAt,
                Notes: JSON.stringify({
                    projectName: quoteData.projectName || '',
                    calculatorType: 'Contract Embroidery',
                    productType: quoteData.productType,
                    stitchCount: quoteData.stitchCount,
                    threadColors: quoteData.threadColors,
                    extraColorCharge: quoteData.extraColorCharge || 0,
                    salesRep: quoteData.salesRepName || 'Ruthie'
                })
            };

            console.log('[EmbroideryQuoteService] Session data:', sessionData);

            const sessionResponse = await fetch(`${this.baseURL}/api/quote_sessions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(sessionData)
            });

            // Get response text first to see error details
            const responseText = await sessionResponse.text();
            console.log('[EmbroideryQuoteService] Session response status:', sessionResponse.status);
            console.log('[EmbroideryQuoteService] Session response text:', responseText);

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
                console.error('[EmbroideryQuoteService] Failed to parse success response:', e);
                sessionResult = { success: true, message: responseText };
            }
            
            console.log('[EmbroideryQuoteService] Session created:', sessionResult);

            // Step 2: Add item to quote
            const addedAt = new Date().toISOString().replace(/\.\\d{3}Z$/, '');
            
            const itemData = {
                QuoteID: quoteID,
                LineNumber: 1,
                StyleNumber: 'EMBROIDERY',
                ProductName: `${quoteData.productType} - ${quoteData.stitchCount} Stitches`,
                Color: quoteData.threadColors + ' colors',
                ColorCode: '',
                EmbellishmentType: 'embroidery',
                PrintLocation: quoteData.productType,
                PrintLocationName: quoteData.productType,
                Quantity: parseInt(quoteData.quantity || 0),
                HasLTM: quoteData.hasLTM ? 'Yes' : 'No',
                BaseUnitPrice: parseFloat((quoteData.unitPrice || 0).toFixed(2)),
                LTMPerUnit: 0,
                FinalUnitPrice: parseFloat((quoteData.finalUnitPrice || 0).toFixed(2)),
                LineTotal: parseFloat((quoteData.grandTotal || 0).toFixed(2)),
                SizeBreakdown: JSON.stringify({
                    stitchCount: quoteData.stitchCount,
                    threadColors: quoteData.threadColors,
                    extraColors: Math.max(0, quoteData.threadColors - 4),
                    colorCharge: quoteData.extraColorCharge || 0
                }),
                PricingTier: this.getPricingTier(quoteData.quantity || 0),
                ImageURL: '',
                AddedAt: addedAt
            };

            console.log('[EmbroideryQuoteService] Item data:', itemData);

            const itemResponse = await fetch(`${this.baseURL}/api/quote_items`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(itemData)
            });

            const itemResponseText = await itemResponse.text();
            console.log('[EmbroideryQuoteService] Item response status:', itemResponse.status);
            console.log('[EmbroideryQuoteService] Item response text:', itemResponseText);

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
            console.error('[EmbroideryQuoteService] Error saving quote:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get quote by ID
     */
    async getQuote(quoteID) {
        try {
            // Get session
            const sessionResponse = await fetch(`${this.baseURL}/api/quote_sessions?quoteID=${quoteID}`);
            const sessions = await sessionResponse.json();

            // Get items
            const itemsResponse = await fetch(`${this.baseURL}/api/quote_items?quoteID=${quoteID}`);
            const items = await itemsResponse.json();

            return {
                success: true,
                session: sessions.data?.[0],
                items: items.data
            };
        } catch (error) {
            console.error('[EmbroideryQuoteService] Error getting quote:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

// Export for use in calculator
window.EmbroideryQuoteService = EmbroideryQuoteService;