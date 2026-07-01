/**
 * Customer Screen Print Quote Service
 * Handles saving Customer Supplied Screen Print quotes to Caspio database
 * Extends BaseQuoteService for common functionality
 */

class CustomerScreenPrintQuoteService extends BaseQuoteService {
    constructor() {
        super({
            prefix: 'SPC',
            storagePrefix: 'customer_screenprint',
            sessionPrefix: 'spc_sess'
        });
    }

    /**
     * Get embellishment type for screen print
     */
    getEmbellishmentType() {
        return 'screenprint';
    }

    /**
     * Save Customer Screen Print quote
     */
    async saveQuote(quoteData) {
        try {
            // Use the ID the caller already generated and showed the customer
            // (handleQuoteSubmit) — calling generateQuoteID() again here produced
            // a SECOND, different sequential ID, so the quote saved to Caspio
            // never matched what the customer was told (2026-07-01 bug: customer
            // sees SPC0701-1, the saved row is SPC0701-2 — a rep searching by the
            // customer's ID finds nothing).
            if (!quoteData.quoteId) {
                throw new Error('saveQuote() requires quoteData.quoteId (the ID already shown to the customer).');
            }
            const quoteID = quoteData.quoteId;
            const sessionID = this.generateSessionID();
            
            console.log('[CustomerScreenPrintQuoteService] Saving quote with ID:', quoteID);

            // Step 1: Create quote session
            const expiresAtDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
            const formattedExpiresAt = expiresAtDate.toISOString().replace(/\\.\\d{3}Z$/, '');
            
            const sessionData = {
                QuoteID: quoteID,
                SessionID: sessionID,
                CustomerEmail: quoteData.customerEmail,
                CustomerName: quoteData.customerName || 'Guest',
                CompanyName: quoteData.companyName || 'Not Provided',
                Phone: quoteData.customerPhone || '',
                TotalQuantity: parseInt(quoteData.quantity || 0),
                SubtotalAmount: parseFloat((quoteData.orderSubtotal || 0).toFixed(2)),
                LTMFeeTotal: parseFloat((quoteData.ltmFeeTotal || 0).toFixed(2)),
                TotalAmount: parseFloat((quoteData.finalTotal || 0).toFixed(2)),
                Status: 'Open',
                ExpiresAt: formattedExpiresAt,
                Notes: quoteData.notes || ''
            };

            console.log('[CustomerScreenPrintQuoteService] Session data:', sessionData);

            const sessionResponse = await fetch(`${this.baseURL}/api/quote_sessions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(sessionData)
            });

            // Get response text first to see error details
            const responseText = await sessionResponse.text();
            console.log('[CustomerScreenPrintQuoteService] Session response status:', sessionResponse.status);
            console.log('[CustomerScreenPrintQuoteService] Session response text:', responseText);

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
                console.error('[CustomerScreenPrintQuoteService] Failed to parse success response:', e);
                sessionResult = { success: true, message: responseText };
            }
            
            console.log('[CustomerScreenPrintQuoteService] Session created:', sessionResult);

            // Step 2: Add item to quote
            const addedAt = new Date().toISOString().replace(/\\.\\d{3}Z$/, '');
            
            // Build product description
            let productName = 'Customer Supplied Screen Print';
            if (quoteData.isDarkGarment) {
                productName += ' (Dark Garment)';
            }
            if (quoteData.safetyStripes) {
                productName += ' [Safety Stripes]';
            }

            // Build print location description
            const locations = [];
            if (quoteData.frontColors > 0) {
                locations.push(`Front: ${quoteData.frontColors} color${quoteData.frontColors > 1 ? 's' : ''}`);
            }
            if (quoteData.backColors > 0) {
                locations.push(`Back: ${quoteData.backColors} color${quoteData.backColors > 1 ? 's' : ''}`);
            }
            const printLocation = locations.join(', ') || 'No Print';

            const itemData = {
                QuoteID: quoteID,
                LineNumber: 1,
                StyleNumber: 'CUSTOMER-SP',
                ProductName: productName,
                Color: 'Customer Supplied',
                ColorCode: '',
                EmbellishmentType: 'screenprint',
                PrintLocation: printLocation,
                PrintLocationName: printLocation,
                Quantity: parseInt(quoteData.quantity || 0),
                HasLTM: quoteData.ltmFeeTotal > 0 ? 'Yes' : 'No',
                BaseUnitPrice: parseFloat((quoteData.pricePerShirt || 0).toFixed(2)),
                LTMPerUnit: 0, // LTM is applied as a flat fee, not per unit
                FinalUnitPrice: parseFloat((quoteData.pricePerShirt || 0).toFixed(2)),
                LineTotal: parseFloat((quoteData.orderSubtotal || 0).toFixed(2)),
                SizeBreakdown: '{}',
                PricingTier: quoteData.tierLabel || '',
                ImageURL: '',
                AddedAt: addedAt
            };

            console.log('[CustomerScreenPrintQuoteService] Item data:', itemData);

            const itemResponse = await fetch(`${this.baseURL}/api/quote_items`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(itemData)
            });

            const itemResponseText = await itemResponse.text();
            console.log('[CustomerScreenPrintQuoteService] Item response status:', itemResponse.status);
            console.log('[CustomerScreenPrintQuoteService] Item response text:', itemResponseText);

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
            console.error('[CustomerScreenPrintQuoteService] Error saving quote:', error);
            // Still return the SAME quote ID the customer was already shown, even
            // though the database save failed — minting a NEW id here would be a
            // second id nobody can look anything up by.
            if (error.message.includes('Session creation failed') || error.message.includes('Item creation failed')) {
                return {
                    success: false,
                    quoteID: quoteData.quoteId,
                    error: error.message
                };
            }
            throw error;
        }
    }
}

// Make available globally
window.CustomerScreenPrintQuoteService = CustomerScreenPrintQuoteService;