/**
 * Leatherette Patch Quote Service
 * Handles saving leatherette patch quotes to Caspio database
 * Extends BaseQuoteService for common functionality
 */

class LeatherettePatchQuoteService extends BaseQuoteService {
    constructor() {
        super({
            prefix: 'LP',
            storagePrefix: 'lp',
            sessionPrefix: 'lp_sess'
        });
        this.apiUrl = this.baseURL; // Use baseURL from parent
        this.caspioToken = null;
        this.tokenExpiry = null;
    }

    /**
     * Get Caspio authentication token
     */
    async getCaspioToken() {
        // Check if we have a valid token
        if (this.caspioToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
            return this.caspioToken;
        }

        try {
            console.log('[LeatherettePatchQuoteService] Fetching new Caspio token...');
            
            const response = await fetch(`${this.apiUrl}/auth/token`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`Token fetch failed: ${response.status}`);
            }

            const data = await response.json();
            this.caspioToken = data.access_token;
            // Token expires in 86400 seconds (24 hours), but we'll refresh after 23 hours
            this.tokenExpiry = new Date(Date.now() + (23 * 60 * 60 * 1000));
            
            console.log('[LeatherettePatchQuoteService] Token obtained successfully');
            return this.caspioToken;
        } catch (error) {
            console.error('[LeatherettePatchQuoteService] Failed to get token:', error);
            throw error;
        }
    }

    /**
     * Get embellishment type for leatherette patches
     */
    getEmbellishmentType() {
        return 'patch';
    }

    /**
     * Get pricing tier for leatherette patches
     * Override base class with patch-specific tiers
     */
    getPricingTier(quantity) {
        if (quantity < 24) return '6-23';
        if (quantity < 72) return '24-71';
        if (quantity < 144) return '72-143';
        if (quantity < 288) return '144-288';
        return '288+';
    }

    /**
     * Save quote to database
     */
    async saveQuote(quoteData) {
        try {
            const quoteID = this.generateQuoteID();
            const sessionID = this.generateSessionID();
            
            console.log('[LeatherettePatchQuoteService] Saving quote with ID:', quoteID);

            // Step 1: Create quote session
            const expiresAtDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
            const formattedExpiresAt = expiresAtDate.toISOString().replace(/\.\d{3}Z$/, '');
            
            // Calculate total with all fees
            const subtotal = quoteData.subtotal;
            const ltmFee = quoteData.ltmFee || 0;
            const totalAmount = subtotal + ltmFee;
            
            const sessionData = {
                QuoteID: quoteID,
                SessionID: sessionID,
                CustomerEmail: quoteData.customerEmail || '',
                CustomerName: quoteData.customerName || 'Guest',
                CompanyName: quoteData.companyName || '',
                Phone: quoteData.customerPhone || '',
                TotalQuantity: quoteData.quantity,
                SubtotalAmount: parseFloat(subtotal.toFixed(2)),
                LTMFeeTotal: parseFloat(ltmFee.toFixed(2)),
                TotalAmount: parseFloat(totalAmount.toFixed(2)),
                Status: 'Open',
                ExpiresAt: formattedExpiresAt,
                Notes: quoteData.notes || ''
            };

            console.log('[LeatherettePatchQuoteService] Session data:', sessionData);

            const sessionResponse = await fetch(`${this.apiUrl}/api/quote_sessions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(sessionData)
            });

            const responseText = await sessionResponse.text();
            console.log('[LeatherettePatchQuoteService] Session response:', sessionResponse.status, responseText);

            if (!sessionResponse.ok) {
                throw new Error(`Session creation failed: ${sessionResponse.status} - ${responseText}`);
            }

            // Step 2: Create quote items for each cap style
            let lineNumber = 1;
            
            for (const item of quoteData.items) {
                const itemData = {
                    QuoteID: quoteID,
                    LineNumber: lineNumber++,
                    StyleNumber: item.styleNumber,
                    ProductName: item.productName,
                    Color: item.color || 'Various',
                    ColorCode: '',
                    EmbellishmentType: 'leatherette patch',
                    PrintLocation: 'Front Panel',
                    PrintLocationName: 'Front - Laser Patch approx. 2.5" x 1.5"',
                    Quantity: item.quantity,
                    HasLTM: item.quantity < 24 ? 'Yes' : 'No',
                    BaseUnitPrice: parseFloat(item.baseUnitPrice.toFixed(2)),
                    LTMPerUnit: parseFloat((item.ltmPerUnit || 0).toFixed(2)),
                    FinalUnitPrice: parseFloat(item.finalUnitPrice.toFixed(2)),
                    LineTotal: parseFloat(item.lineTotal.toFixed(2)),
                    SizeBreakdown: '{}',
                    PricingTier: this.getPricingTier(item.quantity),
                    ImageURL: item.imageUrl || '',
                    AddedAt: new Date().toISOString().replace(/\.\d{3}Z$/, '')
                };

                console.log('[LeatherettePatchQuoteService] Item data:', itemData);

                const itemResponse = await fetch(`${this.apiUrl}/api/quote_items`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(itemData)
                });

                const itemResponseText = await itemResponse.text();
                console.log('[LeatherettePatchQuoteService] Item response:', itemResponse.status, itemResponseText);

                if (!itemResponse.ok) {
                    console.error('Failed to save quote item:', itemResponseText);
                    // Continue with other items
                }
            }

            console.log('[LeatherettePatchQuoteService] Quote saved successfully:', quoteID);
            
            return {
                success: true,
                quoteID: quoteID,
                message: 'Quote saved successfully'
            };

        } catch (error) {
            console.error('[LeatherettePatchQuoteService] Error saving quote:', error);
            
            // Return error but don't throw - allow email to still be sent
            return {
                success: false,
                error: error.message,
                message: 'Quote could not be saved to database, but email will still be sent'
            };
        }
    }

    /**
     * Update quote status
     */
    async updateQuoteStatus(quoteId, status) {
        try {
            const token = await this.getCaspioToken();
            
            const response = await fetch(`${this.apiUrl}/tables/quote_sessions/records?q=QuoteID=${quoteId}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    Status: status,
                    Last_Updated: new Date().toISOString()
                })
            });

            if (!response.ok) {
                throw new Error(`Failed to update quote status: ${response.status}`);
            }

            console.log('[LeatherettePatchQuoteService] Quote status updated:', quoteId, status);
            return { success: true };

        } catch (error) {
            console.error('[LeatherettePatchQuoteService] Error updating quote status:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Search quotes
     */
    async searchQuotes(searchTerm) {
        try {
            const token = await this.getCaspioToken();
            
            const response = await fetch(
                `${this.apiUrl}/tables/quote_sessions/records?q=CustomerName~${searchTerm}`,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                }
            );

            if (!response.ok) {
                throw new Error(`Search failed: ${response.status}`);
            }

            const data = await response.json();
            console.log('[LeatherettePatchQuoteService] Search results:', data.Result.length);
            
            return {
                success: true,
                quotes: data.Result || []
            };

        } catch (error) {
            console.error('[LeatherettePatchQuoteService] Search error:', error);
            return {
                success: false,
                error: error.message,
                quotes: []
            };
        }
    }
}

// Make available globally
window.LeatherettePatchQuoteService = LeatherettePatchQuoteService;