/**
 * Webstore Quote Service
 * Handles saving webstore setup quotes to Caspio database
 * Extends BaseQuoteService for common functionality
 */

class WebstoreQuoteService extends BaseQuoteService {
    constructor() {
        super({
            prefix: 'WEB',
            storagePrefix: 'webstore',
            sessionPrefix: 'web_sess'
        });
        this.quotePrefix = 'WEB'; // Keep for backward compatibility
    }

    /**
     * Get embellishment type for webstores
     */
    getEmbellishmentType() {
        return 'service';
    }

    /**
     * Save webstore quote to database
     */
    async saveQuote(quoteData) {
        try {
            const quoteID = this.generateQuoteID();
            const sessionID = this.generateSessionID();
            
            console.log('[WebstoreQuoteService] Saving quote with ID:', quoteID);

            // Step 1: Create quote session
            const expiresAtDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
            const formattedExpiresAt = expiresAtDate.toISOString().replace(/\.\d{3}Z$/, '');
            
            const sessionData = {
                QuoteID: quoteID,
                SessionID: sessionID,
                CustomerEmail: quoteData.customerEmail || '',
                CustomerName: quoteData.customerName || 'Guest',
                CompanyName: quoteData.companyName || '',
                Phone: quoteData.customerPhone || '',
                TotalQuantity: 0, // Not applicable for webstores
                SubtotalAmount: parseFloat(quoteData.totalCost.toFixed(2)),
                LTMFeeTotal: 0,
                TotalAmount: parseFloat(quoteData.totalCost.toFixed(2)),
                Status: 'Open',
                ExpiresAt: formattedExpiresAt,
                Notes: `Store Type: ${quoteData.storeType}, Expected Volume: ${quoteData.expectedVolume || 'Not specified'} items/year, Annual Minimum: $2,000 in sales required`
            };

            console.log('[WebstoreQuoteService] Session data:', sessionData);

            const sessionResponse = await fetch(`${this.baseURL}/api/quote_sessions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(sessionData)
            });

            const responseText = await sessionResponse.text();
            console.log('[WebstoreQuoteService] Session response:', sessionResponse.status, responseText);

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

            // Step 2: Add quote items
            const addedAt = new Date().toISOString().replace(/\.\d{3}Z$/, '');
            
            // Item 1: Store Setup Fee
            const setupItem = {
                QuoteID: quoteID,
                LineNumber: 1,
                StyleNumber: 'WEBSTORE-SETUP',
                ProductName: 'Web Store Setup Fee',
                Color: '',
                ColorCode: '',
                EmbellishmentType: 'service',
                PrintLocation: '',
                PrintLocationName: '',
                Quantity: 1,
                HasLTM: 'No',
                BaseUnitPrice: 300.00,
                LTMPerUnit: 0,
                FinalUnitPrice: 300.00,
                LineTotal: 300.00,
                SizeBreakdown: '{}',
                PricingTier: 'Standard',
                ImageURL: '',
                AddedAt: addedAt
            };

            await fetch(`${this.baseURL}/api/quote_items`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(setupItem)
            });

            // Item 2: Logo Digitization (if applicable)
            if (quoteData.logoCount > 0) {
                const logoItem = {
                    QuoteID: quoteID,
                    LineNumber: 2,
                    StyleNumber: 'LOGO-DIGIT',
                    ProductName: `Logo Digitization (${quoteData.logoCount} logo${quoteData.logoCount > 1 ? 's' : ''})`,
                    Color: '',
                    ColorCode: '',
                    EmbellishmentType: 'service',
                    PrintLocation: '',
                    PrintLocationName: '',
                    Quantity: quoteData.logoCount,
                    HasLTM: 'No',
                    BaseUnitPrice: 100.00,
                    LTMPerUnit: 0,
                    FinalUnitPrice: 100.00,
                    LineTotal: 100.00 * quoteData.logoCount,
                    SizeBreakdown: '{}',
                    PricingTier: 'Per Logo',
                    ImageURL: '',
                    AddedAt: addedAt
                };

                await fetch(`${this.baseURL}/api/quote_items`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(logoItem)
                });
            }

            // Store the store configuration in the last item's SizeBreakdown
            if (quoteData.logoCount > 0) {
                // Update the logo item to include store configuration
                const lastItemResponse = await fetch(`${this.baseURL}/api/quote_items?QuoteID=${quoteID}&LineNumber=2`);
                if (lastItemResponse.ok) {
                    const items = await lastItemResponse.json();
                    if (items.length > 0) {
                        // Update SizeBreakdown with store configuration
                        const itemId = items[0].id;
                        await fetch(`${this.baseURL}/api/quote_items/${itemId}`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                SizeBreakdown: JSON.stringify({
                                    storeType: quoteData.storeType,
                                    surchargePerItem: quoteData.storeType === 'Open/Close' ? 2.00 : 10.00,
                                    expectedVolume: quoteData.expectedVolume || 0,
                                    minimumGuarantee: 2000
                                })
                            })
                        });
                    }
                }
            } else {
                // Update the setup item to include store configuration
                const lastItemResponse = await fetch(`${this.baseURL}/api/quote_items?QuoteID=${quoteID}&LineNumber=1`);
                if (lastItemResponse.ok) {
                    const items = await lastItemResponse.json();
                    if (items.length > 0) {
                        const itemId = items[0].id;
                        await fetch(`${this.baseURL}/api/quote_items/${itemId}`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                SizeBreakdown: JSON.stringify({
                                    storeType: quoteData.storeType,
                                    surchargePerItem: quoteData.storeType === 'Open/Close' ? 2.00 : 10.00,
                                    expectedVolume: quoteData.expectedVolume || 0,
                                    minimumGuarantee: 2000
                                })
                            })
                        });
                    }
                }
            }

            return {
                success: true,
                quoteID: quoteID,
                message: 'Quote saved successfully'
            };

        } catch (error) {
            console.error('[WebstoreQuoteService] Error saving quote:', error);
            // Still return a quote ID even if database save failed
            return {
                success: false,
                quoteID: this.generateQuoteID(),
                error: error.message
            };
        }
    }
}

// Make available globally
window.WebstoreQuoteService = WebstoreQuoteService;