/**
 * Quote Service
 * Handles saving quotes to Caspio database
 */

export class QuoteService {
    constructor() {
        this.baseURL = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
    }

    /**
     * Generate unique quote ID
     */
    generateQuoteID() {
        const now = new Date();
        const month = (now.getMonth() + 1).toString().padStart(2, '0');
        const day = now.getDate().toString().padStart(2, '0');
        const dateKey = `${month}${day}`;
        
        // Get or initialize daily sequence from sessionStorage
        const storageKey = `quote_sequence_${dateKey}`;
        let sequence = parseInt(sessionStorage.getItem(storageKey) || '0') + 1;
        
        // Store the updated sequence
        sessionStorage.setItem(storageKey, sequence.toString());
        
        // Clean up old date keys (optional - keeps storage clean)
        this.cleanupOldSequences(dateKey);
        
        return `Q${dateKey}-${sequence}`;
    }
    
    /**
     * Clean up sequence numbers from previous days
     */
    cleanupOldSequences(currentDateKey) {
        const keys = Object.keys(sessionStorage);
        keys.forEach(key => {
            if (key.startsWith('quote_sequence_') && !key.endsWith(currentDateKey)) {
                sessionStorage.removeItem(key);
            }
        });
    }

    /**
     * Generate session ID
     */
    generateSessionID() {
        return `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Map decoration method to API format
     */
    mapEmbellishmentType(decorationMethod) {
        const mapping = {
            'Embroidery': 'embroidery',
            'Screen Print': 'screenprint',
            'DTG': 'dtg',
            'DTF': 'dtf',
            'Other': 'other'
        };
        return mapping[decorationMethod] || 'screenprint';
    }

    /**
     * Determine pricing tier based on quantity
     */
    getPricingTier(quantity) {
        if (quantity < 24) return '1-23';
        if (quantity < 48) return '24-47';
        if (quantity < 72) return '48-71';
        if (quantity < 144) return '72-143';
        if (quantity < 288) return '144-287';
        return '288+';
    }

    /**
     * Save complete quote (session + items)
     */
    async saveQuote(quoteData) {
        try {
            const quoteID = this.generateQuoteID();
            const sessionID = sessionStorage.getItem('quoteSessionID') || this.generateSessionID();
            
            // Store session ID for future use
            sessionStorage.setItem('quoteSessionID', sessionID);

            console.log('[QuoteService] Saving quote with ID:', quoteID);

            // Step 1: Create quote session
            // Format date as ISO for Caspio (YYYY-MM-DDTHH:MM:SS)
            const expiresAtDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
            const formattedExpiresAt = expiresAtDate.toISOString().replace(/\.\d{3}Z$/, '');
            
            // Calculate total quantity from all products
            const totalQuantity = quoteData.products.reduce((sum, product) => sum + parseInt(product.quantity), 0);
            
            // Calculate LTM fee total
            const ltmFeeTotal = quoteData.products.reduce((sum, product) => {
                const ltmFee = product.quantity < 12 ? 2.00 * product.quantity : 0;
                return sum + ltmFee;
            }, 0);
            
            const sessionData = {
                QuoteID: quoteID,
                SessionID: sessionID,
                CustomerEmail: quoteData.customerEmail,
                CustomerName: quoteData.customerName || 'Guest',
                CompanyName: quoteData.companyName || 'Not Provided',
                Phone: quoteData.customerPhone || '',
                TotalQuantity: totalQuantity,
                SubtotalAmount: parseFloat(quoteData.grandTotal.toFixed(2)),
                LTMFeeTotal: parseFloat(ltmFeeTotal.toFixed(2)),
                TotalAmount: parseFloat(quoteData.grandTotal.toFixed(2)),
                Status: 'Open',
                ExpiresAt: formattedExpiresAt,
                Notes: quoteData.notes || ''
            };

            console.log('[QuoteService] Session data:', sessionData);

            const sessionResponse = await fetch(`${this.baseURL}/api/quote_sessions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(sessionData)
            });

            // Get response text first to see error details
            const responseText = await sessionResponse.text();
            console.log('[QuoteService] Session response status:', sessionResponse.status);
            console.log('[QuoteService] Session response text:', responseText);

            if (!sessionResponse.ok) {
                // Try to parse error message
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
                console.error('[QuoteService] Failed to parse success response:', e);
                sessionResult = { success: true, message: responseText };
            }
            
            console.log('[QuoteService] Session created:', sessionResult);

            // Step 2: Add items to quote
            const itemPromises = quoteData.products.map(async (product, index) => {
                // Format current timestamp for AddedAt
                const addedAt = new Date().toISOString().replace(/\.\d{3}Z$/, '');
                
                const itemData = {
                    QuoteID: quoteID,
                    LineNumber: index + 1, // Sequential line numbers
                    StyleNumber: product.styleNumber,
                    ProductName: product.productName,
                    Color: product.colorName,
                    ColorCode: '', // Empty for now
                    EmbellishmentType: this.mapEmbellishmentType(product.decorationMethod),
                    PrintLocation: 'Front Center', // Full name instead of code
                    PrintLocationName: 'Front Center',
                    Quantity: parseInt(product.quantity),
                    HasLTM: product.quantity < 12 ? 'Yes' : 'No',
                    BaseUnitPrice: parseFloat(product.pricePerItem),
                    LTMPerUnit: product.quantity < 12 ? 2.00 : 0,
                    FinalUnitPrice: parseFloat(product.pricePerItem),
                    LineTotal: parseFloat(product.subtotal),
                    SizeBreakdown: '{}', // Empty JSON for now
                    PricingTier: this.getPricingTier(product.quantity),
                    ImageURL: product.productImage || '',
                    AddedAt: addedAt
                };

                console.log('[QuoteService] Item data:', itemData);

                const itemResponse = await fetch(`${this.baseURL}/api/quote_items`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(itemData)
                });

                const itemResponseText = await itemResponse.text();
                console.log('[QuoteService] Item response status:', itemResponse.status);
                console.log('[QuoteService] Item response text:', itemResponseText);

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

                try {
                    return JSON.parse(itemResponseText);
                } catch (e) {
                    return { success: true, message: itemResponseText };
                }
            });

            const itemResults = await Promise.all(itemPromises);
            console.log('[QuoteService] Items created:', itemResults);

            return {
                success: true,
                quoteID: quoteID,
                sessionData: sessionResult,
                itemsData: itemResults
            };

        } catch (error) {
            console.error('[QuoteService] Error saving quote:', error);
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
            console.error('[QuoteService] Error getting quote:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}