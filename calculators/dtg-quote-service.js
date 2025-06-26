/**
 * DTG Quote Service
 * Handles saving DTG contract quotes to Caspio database
 */

class DTGQuoteService {
    constructor() {
        this.baseURL = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
    }

    /**
     * Generate unique quote ID for DTG quotes
     */
    generateQuoteID() {
        const now = new Date();
        const month = (now.getMonth() + 1).toString().padStart(2, '0');
        const day = now.getDate().toString().padStart(2, '0');
        const dateKey = `${month}${day}`;
        
        // Get or initialize daily sequence from sessionStorage
        const storageKey = `dtg_quote_sequence_${dateKey}`;
        let sequence = parseInt(sessionStorage.getItem(storageKey) || '0') + 1;
        
        // Store the updated sequence
        sessionStorage.setItem(storageKey, sequence.toString());
        
        // Clean up old date keys
        this.cleanupOldSequences(dateKey);
        
        // Use DTG prefix for contract DTG quotes
        return `DTG${dateKey}-${sequence}`;
    }
    
    /**
     * Clean up sequence numbers from previous days
     */
    cleanupOldSequences(currentDateKey) {
        const keys = Object.keys(sessionStorage);
        keys.forEach(key => {
            if (key.startsWith('dtg_quote_sequence_') && !key.endsWith(currentDateKey)) {
                sessionStorage.removeItem(key);
            }
        });
    }

    /**
     * Generate session ID
     */
    generateSessionID() {
        return `dtg_sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Get pricing tier for DTG
     */
    getPricingTier(quantity) {
        if (quantity < 24) return '1-23';
        if (quantity < 48) return '24-47';
        if (quantity < 72) return '48-71';
        return '72+';
    }

    /**
     * Save DTG quote (session + single item for all locations)
     */
    async saveQuote(quoteData) {
        try {
            const quoteID = this.generateQuoteID();
            const sessionID = this.generateSessionID();
            
            console.log('[DTGQuoteService] Saving quote with ID:', quoteID);

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
                TotalQuantity: quoteData.quantity,
                SubtotalAmount: parseFloat(quoteData.totalCost.toFixed(2)),
                LTMFeeTotal: quoteData.ltmFeeTotal || 0,
                TotalAmount: parseFloat(quoteData.totalCost.toFixed(2)),
                Status: 'Open',
                ExpiresAt: formattedExpiresAt,
                Notes: quoteData.notes || ''
            };

            console.log('[DTGQuoteService] Session data:', sessionData);

            const sessionResponse = await fetch(`${this.baseURL}/api/quote_sessions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(sessionData)
            });

            // Get response text first to see error details
            const responseText = await sessionResponse.text();
            console.log('[DTGQuoteService] Session response status:', sessionResponse.status);
            console.log('[DTGQuoteService] Session response text:', responseText);

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
                console.error('[DTGQuoteService] Failed to parse success response:', e);
                sessionResult = { success: true, message: responseText };
            }
            
            console.log('[DTGQuoteService] Session created:', sessionResult);

            // Step 2: Add single item for DTG service
            const addedAt = new Date().toISOString().replace(/\.\d{3}Z$/, '');
            
            // Combine all print locations into one string
            const printLocations = quoteData.locations.join(', ');
            
            const itemData = {
                QuoteID: quoteID,
                LineNumber: 1,
                StyleNumber: 'CUSTOMER-SUPPLIED',
                ProductName: 'Contract DTG Printing',
                Color: quoteData.isHeavyweight ? 'Heavyweight' : 'Standard Weight',
                ColorCode: '',
                EmbellishmentType: 'dtg',
                PrintLocation: printLocations,
                PrintLocationName: printLocations,
                Quantity: parseInt(quoteData.quantity),
                HasLTM: quoteData.quantity < 24 ? 'Yes' : 'No',
                BaseUnitPrice: parseFloat(quoteData.pricePerPiece),
                LTMPerUnit: quoteData.ltmFeePerPiece || 0,
                FinalUnitPrice: parseFloat(quoteData.pricePerPiece),
                LineTotal: parseFloat(quoteData.totalCost),
                SizeBreakdown: '{}',
                PricingTier: this.getPricingTier(quoteData.quantity),
                ImageURL: '',
                AddedAt: addedAt
            };

            console.log('[DTGQuoteService] Item data:', itemData);

            const itemResponse = await fetch(`${this.baseURL}/api/quote_items`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(itemData)
            });

            const itemResponseText = await itemResponse.text();
            console.log('[DTGQuoteService] Item response status:', itemResponse.status);
            console.log('[DTGQuoteService] Item response text:', itemResponseText);

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

            let itemResult;
            try {
                itemResult = JSON.parse(itemResponseText);
            } catch (e) {
                itemResult = { success: true, message: itemResponseText };
            }

            console.log('[DTGQuoteService] Item created:', itemResult);

            return {
                success: true,
                quoteID: quoteID,
                sessionData: sessionResult,
                itemData: itemResult
            };

        } catch (error) {
            console.error('[DTGQuoteService] Error saving quote:', error);
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
            console.error('[DTGQuoteService] Error getting quote:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

// Export for use in DTG calculator
window.DTGQuoteService = DTGQuoteService;