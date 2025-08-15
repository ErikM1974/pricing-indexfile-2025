/**
 * Laser Tumbler Quote Service
 * Handles saving quotes to Caspio database
 * Extends BaseQuoteService for common functionality
 */

class LaserTumblerQuoteService extends BaseQuoteService {
    constructor() {
        super({
            prefix: 'LT',
            storagePrefix: 'lt',
            sessionPrefix: 'lt_sess'
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
            console.log('[LaserTumblerQuoteService] Fetching new Caspio token...');
            
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
            
            console.log('[LaserTumblerQuoteService] Token obtained successfully');
            return this.caspioToken;
        } catch (error) {
            console.error('[LaserTumblerQuoteService] Failed to get token:', error);
            throw error;
        }
    }

    /**
     * Get embellishment type for laser engraving
     */
    getEmbellishmentType() {
        return 'laser';
    }

    /**
     * Save quote to database
     */
    async saveQuote(quoteData) {
        try {
            const quoteID = this.generateQuoteID();
            const sessionID = this.generateSessionID();
            
            console.log('[LaserTumblerQuoteService] Saving quote with ID:', quoteID);

            // Step 1: Create quote session
            const expiresAtDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
            const formattedExpiresAt = expiresAtDate.toISOString().replace(/\.\d{3}Z$/, '');
            
            // Calculate total with all fees
            const subtotal = quoteData.subtotal;
            const setupFee = quoteData.setupFee;
            const secondLogoTotal = quoteData.secondLogoTotal || 0;
            const totalAmount = subtotal + setupFee + secondLogoTotal;
            
            const sessionData = {
                QuoteID: quoteID,
                SessionID: sessionID,
                CustomerEmail: quoteData.customerEmail || '',
                CustomerName: quoteData.customerName || 'Guest',
                CompanyName: quoteData.companyName || '',
                Phone: quoteData.customerPhone || '',
                TotalQuantity: quoteData.quantity,
                SubtotalAmount: parseFloat(subtotal.toFixed(2)),
                LTMFeeTotal: 0, // No LTM for laser tumblers
                TotalAmount: parseFloat(totalAmount.toFixed(2)),
                Status: 'Open',
                ExpiresAt: formattedExpiresAt,
                Notes: quoteData.notes || ''
            };

            console.log('[LaserTumblerQuoteService] Session data:', sessionData);

            const sessionResponse = await fetch(`${this.apiUrl}/api/quote_sessions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(sessionData)
            });

            const responseText = await sessionResponse.text();
            console.log('[LaserTumblerQuoteService] Session response:', sessionResponse.status, responseText);

            if (!sessionResponse.ok) {
                throw new Error(`Session creation failed: ${sessionResponse.status} - ${responseText}`);
            }

            // Step 2: Create quote item
            // Build color breakdown for storage
            const colorBreakdown = {};
            if (quoteData.colors && Array.isArray(quoteData.colors)) {
                quoteData.colors.forEach(color => {
                    colorBreakdown[color.name] = {
                        model: color.model,
                        quantity: color.quantity,
                        hex: color.hex
                    };
                });
            }
            
            const itemData = {
                QuoteID: quoteID,
                LineNumber: 1,
                StyleNumber: 'POLAR-CAMEL-16OZ',
                ProductName: 'Polar Camel 16 oz. Pint',
                Color: quoteData.colors ? quoteData.colors.map(c => c.name).join(', ') : 'Various',
                ColorCode: quoteData.colors ? quoteData.colors.map(c => c.model).join(', ') : '',
                EmbellishmentType: 'laser',
                PrintLocation: '1-Sided Laser Engraving',
                PrintLocationName: 'Front - approx. 2.5" x 3"',
                Quantity: quoteData.quantity,
                HasLTM: 'No',
                BaseUnitPrice: parseFloat(quoteData.unitPrice.toFixed(2)),
                LTMPerUnit: 0,
                FinalUnitPrice: parseFloat(quoteData.unitPrice.toFixed(2)),
                LineTotal: parseFloat(subtotal.toFixed(2)),
                SizeBreakdown: JSON.stringify(colorBreakdown),
                PricingTier: this.getPricingTier(quoteData.quantity),
                ImageURL: '',
                AddedAt: new Date().toISOString().replace(/\.\d{3}Z$/, '')
            };

            console.log('[LaserTumblerQuoteService] Item data:', itemData);

            const itemResponse = await fetch(`${this.apiUrl}/api/quote_items`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(itemData)
            });

            const itemResponseText = await itemResponse.text();
            console.log('[LaserTumblerQuoteService] Item response:', itemResponse.status, itemResponseText);

            if (!itemResponse.ok) {
                console.error('Failed to save quote item:', itemResponseText);
                // Don't throw - session was created successfully
            }

            console.log('[LaserTumblerQuoteService] Quote saved successfully:', quoteID);
            
            return {
                success: true,
                quoteID: quoteID,
                message: 'Quote saved successfully'
            };

        } catch (error) {
            console.error('[LaserTumblerQuoteService] Error saving quote:', error);
            
            // Return error but don't throw - allow email to still be sent
            return {
                success: false,
                error: error.message,
                message: 'Quote could not be saved to database, but email will still be sent'
            };
        }
    }
    
    /**
     * Get pricing tier for quantity
     */
    getPricingTier(quantity) {
        if (quantity < 24) return '1-23';
        if (quantity < 120) return '24-119';
        if (quantity < 240) return '120-239';
        return '240+';
    }

    /**
     * Update quote status
     */
    async updateQuoteStatus(quoteId, status) {
        try {
            const token = await this.getCaspioToken();
            
            const response = await fetch(`${this.apiUrl}/tables/laser_tumbler_quotes/records?q=Quote_ID=${quoteId}`, {
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

            console.log('[LaserTumblerQuoteService] Quote status updated:', quoteId, status);
            return { success: true };

        } catch (error) {
            console.error('[LaserTumblerQuoteService] Error updating quote status:', error);
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
                `${this.apiUrl}/tables/laser_tumbler_quotes/records?q=Customer_Name~${searchTerm}`,
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
            console.log('[LaserTumblerQuoteService] Search results:', data.Result.length);
            
            return {
                success: true,
                quotes: data.Result || []
            };

        } catch (error) {
            console.error('[LaserTumblerQuoteService] Search error:', error);
            return {
                success: false,
                error: error.message,
                quotes: []
            };
        }
    }
}

// Make available globally
window.LaserTumblerQuoteService = LaserTumblerQuoteService;