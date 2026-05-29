/**
 * Emblem Quote Service
 * Handles saving embroidered emblem quotes to Caspio database
 * Extends BaseQuoteService for common functionality
 */

class EmblemQuoteService extends BaseQuoteService {
    constructor() {
        super({
            prefix: 'PATCH',
            storagePrefix: 'emblem',
            sessionPrefix: 'emblem_sess'
        });
    }

    /**
     * Get embellishment type for emblems
     */
    getEmbellishmentType() {
        return 'emblem';
    }

    /**
     * Get pricing tier based on quantity
     */
    getPricingTier(quantity) {
        if (quantity < 50) return '25-49';
        if (quantity < 100) return '50-99';
        if (quantity < 200) return '100-199';
        if (quantity < 300) return '200-299';
        if (quantity < 500) return '300-499';
        if (quantity < 1000) return '500-999';
        if (quantity < 2000) return '1000-1999';
        if (quantity < 5000) return '2000-4999';
        if (quantity < 10000) return '5000-9999';
        return '10000+';
    }

    /**
     * Get size tier name
     */
    getSizeTierName(sizeTier) {
        const tier = parseFloat(sizeTier);
        if (tier <= 1.0) return 'Up to 1"';
        if (tier <= 1.5) return '1.01-1.50"';
        if (tier <= 2.0) return '1.51-2.00"';
        if (tier <= 2.5) return '2.01-2.50"';
        if (tier <= 3.0) return '2.51-3.00"';
        if (tier <= 3.5) return '3.01-3.50"';
        if (tier <= 4.0) return '3.51-4.00"';
        if (tier <= 4.5) return '4.01-4.50"';
        if (tier <= 5.0) return '4.51-5.00"';
        if (tier <= 6.0) return '5.01-6.00"';
        if (tier <= 7.0) return '6.01-7.00"';
        if (tier <= 8.0) return '7.01-8.00"';
        if (tier <= 9.0) return '8.01-9.00"';
        if (tier <= 10.0) return '9.01-10.00"';
        if (tier <= 11.0) return '10.01-11.00"';
        return '11.01-12.00"';
    }

    /**
     * Save emblem quote to database
     */
    async saveQuote(quoteData) {
        try {
            const quoteID = quoteData.quoteId;
            const sessionID = this.generateSessionID();
            
            console.log('[EmblemQuoteService] Saving quote with ID:', quoteID);

            // Step 1: Create quote session
            const expiresAtDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
            const formattedExpiresAt = expiresAtDate.toISOString().replace(/\.\d{3}Z$/, '');
            
            // Determine if LTM fee applies
            const hasLTM = quoteData.quantity < 200;
            const ltmFeeTotal = hasLTM ? 50.00 : 0;
            
            const sessionData = {
                QuoteID: quoteID,
                SessionID: sessionID,
                CustomerEmail: quoteData.customerEmail,
                CustomerName: quoteData.customerName || 'Guest',
                CompanyName: quoteData.companyName || '',
                Phone: quoteData.customerPhone || '',
                TotalQuantity: quoteData.quantity,
                SubtotalAmount: parseFloat(quoteData.orderSubtotal.toFixed(2)),
                LTMFeeTotal: ltmFeeTotal,
                TotalAmount: parseFloat(quoteData.estimatedTotal.toFixed(2)),
                Status: 'Open',
                ExpiresAt: formattedExpiresAt,
                Notes: quoteData.notes || ''
            };

            console.log('[EmblemQuoteService] Session data:', sessionData);

            const sessionResponse = await fetch(`${this.baseURL}/api/quote_sessions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(sessionData)
            });

            const responseText = await sessionResponse.text();
            console.log('[EmblemQuoteService] Session response:', sessionResponse.status, responseText);

            if (!sessionResponse.ok) {
                throw new Error(`Session creation failed: ${sessionResponse.status} - ${responseText}`);
            }

            // Step 2: Create quote item
            const addedAt = new Date().toISOString().replace(/\.\d{3}Z$/, '');
            
            // Build description
            let description = `Embroidered Emblem - ${quoteData.width}" × ${quoteData.height}"`;
            
            // Build options array
            let options = [];
            if (quoteData.metallicThread) options.push('Metallic Thread');
            if (quoteData.velcroBacking) options.push('Velcro Backing');
            if (quoteData.extraColors > 0) {
                options.push(`${quoteData.extraColors} Extra Color${quoteData.extraColors > 1 ? 's' : ''}`);
            }
            
            const itemData = {
                QuoteID: quoteID,
                LineNumber: 1,
                StyleNumber: 'EMBLEM-CUSTOM',
                ProductName: description,
                Color: options.length > 0 ? options.join(', ') : 'Standard',
                ColorCode: '',
                EmbellishmentType: 'embroidery',
                PrintLocation: 'N/A',
                PrintLocationName: 'Custom Emblem',
                Quantity: parseInt(quoteData.quantity),
                HasLTM: hasLTM ? 'Yes' : 'No',
                BaseUnitPrice: parseFloat(quoteData.basePrice.toFixed(2)),
                LTMPerUnit: parseFloat((quoteData.ltmChargePerPatch || 0).toFixed(2)),
                FinalUnitPrice: parseFloat(quoteData.pricePerPatch.toFixed(2)),
                LineTotal: parseFloat(quoteData.orderSubtotal.toFixed(2)),
                SizeBreakdown: JSON.stringify({
                    dimensions: {
                        width: quoteData.width,
                        height: quoteData.height,
                        averageSize: quoteData.size
                    },
                    sizeTier: this.getSizeTierName(quoteData.sizeTier),
                    pricingTier: this.getPricingTier(quoteData.quantity),
                    options: {
                        metallicThread: quoteData.metallicThread,
                        velcroBacking: quoteData.velcroBacking,
                        extraColors: quoteData.extraColors,
                        digitizingFee: quoteData.isNewDesign
                    },
                    addOnPercentage: quoteData.addOnPercentage
                }),
                PricingTier: this.getPricingTier(quoteData.quantity),
                ImageURL: '',
                AddedAt: addedAt
            };

            console.log('[EmblemQuoteService] Item data:', itemData);

            const itemResponse = await fetch(`${this.baseURL}/api/quote_items`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(itemData)
            });

            const itemResponseText = await itemResponse.text();
            console.log('[EmblemQuoteService] Item response:', itemResponse.status, itemResponseText);

            if (!itemResponse.ok) {
                console.error('Failed to save quote item:', itemResponseText);
                // Don't throw - session was created successfully
            }

            console.log('[EmblemQuoteService] Quote saved successfully:', quoteID);
            
            return {
                success: true,
                quoteID: quoteID,
                message: 'Quote saved successfully'
            };

        } catch (error) {
            console.error('[EmblemQuoteService] Error saving quote:', error);
            
            // Return error but don't throw - allow email to still be sent
            return {
                success: false,
                error: error.message,
                message: 'Quote could not be saved to database, but email will still be sent'
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
            console.error('[EmblemQuoteService] Error getting quote:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

// Export for use in emblem calculator
window.EmblemQuoteService = EmblemQuoteService;