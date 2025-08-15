/**
 * Base Quote Service
 * Provides common functionality for all quote services
 * All calculator-specific quote services should extend this class
 */

class BaseQuoteService {
    constructor(config = {}) {
        // Common configuration
        this.baseURL = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
        
        // Calculator-specific configuration
        this.prefix = config.prefix || 'QUOTE';  // e.g., 'DTG', 'EMB', 'RICH'
        this.storagePrefix = config.storagePrefix || 'quote';  // e.g., 'dtg', 'embroidery'
        this.sessionPrefix = config.sessionPrefix || 'sess';  // e.g., 'dtg_sess', 'emb_sess'
    }

    /**
     * Generate unique quote ID
     * Format: PREFIX{MMDD}-{sequence}
     */
    generateQuoteID() {
        const now = new Date();
        const month = (now.getMonth() + 1).toString().padStart(2, '0');
        const day = now.getDate().toString().padStart(2, '0');
        const dateKey = `${month}${day}`;
        
        // Get or initialize daily sequence from sessionStorage
        const storageKey = `${this.storagePrefix}_quote_sequence_${dateKey}`;
        let sequence = parseInt(sessionStorage.getItem(storageKey) || '0') + 1;
        
        // Store the updated sequence
        sessionStorage.setItem(storageKey, sequence.toString());
        
        // Clean up old date keys
        this.cleanupOldSequences(dateKey);
        
        // Return formatted quote ID
        return `${this.prefix}${dateKey}-${sequence}`;
    }
    
    /**
     * Clean up sequence numbers from previous days
     */
    cleanupOldSequences(currentDateKey) {
        const keys = Object.keys(sessionStorage);
        const prefix = `${this.storagePrefix}_quote_sequence_`;
        
        keys.forEach(key => {
            if (key.startsWith(prefix) && !key.endsWith(currentDateKey)) {
                sessionStorage.removeItem(key);
            }
        });
    }

    /**
     * Generate session ID
     */
    generateSessionID() {
        return `${this.sessionPrefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Get pricing tier based on quantity
     * Can be overridden by specific calculators
     */
    getPricingTier(quantity) {
        if (quantity < 24) return '1-23';
        if (quantity < 48) return '24-47';
        if (quantity < 72) return '48-71';
        return '72+';
    }

    /**
     * Save quote to database (common pattern)
     */
    async saveQuote(quoteData) {
        try {
            const quoteID = this.generateQuoteID();
            const sessionID = this.generateSessionID();
            
            console.log(`[${this.constructor.name}] Saving quote with ID:`, quoteID);

            // Step 1: Create quote session
            const expiresAtDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
            const formattedExpiresAt = expiresAtDate.toISOString().replace(/\.\d{3}Z$/, '');
            
            const sessionData = {
                QuoteID: quoteID,
                SessionID: sessionID,
                CustomerEmail: quoteData.customerEmail || '',
                CustomerName: quoteData.customerName || 'Guest',
                CompanyName: quoteData.companyName || 'Not Provided',
                Phone: quoteData.customerPhone || '',
                TotalQuantity: parseInt(quoteData.totalQuantity || 0),
                SubtotalAmount: parseFloat((quoteData.subtotal || 0).toFixed(2)),
                LTMFeeTotal: parseFloat((quoteData.ltmFeeTotal || 0).toFixed(2)),
                TotalAmount: parseFloat((quoteData.totalCost || 0).toFixed(2)),
                Status: 'Open',
                ExpiresAt: formattedExpiresAt,
                Notes: quoteData.notes || ''
            };

            console.log(`[${this.constructor.name}] Session data:`, sessionData);

            const sessionResponse = await fetch(`${this.baseURL}/api/quote_sessions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(sessionData)
            });

            const responseText = await sessionResponse.text();
            console.log(`[${this.constructor.name}] Session response:`, sessionResponse.status, responseText);

            if (!sessionResponse.ok) {
                throw new Error(`Failed to create quote session: ${responseText}`);
            }

            // Step 2: Save quote items (if provided)
            if (quoteData.items && quoteData.items.length > 0) {
                await this.saveQuoteItems(quoteID, quoteData.items);
            }

            return {
                success: true,
                quoteID: quoteID,
                sessionID: sessionID
            };

        } catch (error) {
            console.error(`[${this.constructor.name}] Error saving quote:`, error);
            
            // Still return a quote ID even if save fails
            // This ensures the customer gets their quote
            return {
                success: false,
                quoteID: this.generateQuoteID(),
                error: error.message
            };
        }
    }

    /**
     * Save quote items to database
     */
    async saveQuoteItems(quoteID, items) {
        const addedAt = new Date().toISOString().replace(/\.\d{3}Z$/, '');
        
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const itemData = {
                QuoteID: quoteID,
                LineNumber: i + 1,
                StyleNumber: item.styleNumber || 'CUSTOM',
                ProductName: item.productName || '',
                Color: item.color || '',
                ColorCode: item.colorCode || '',
                EmbellishmentType: item.embellishmentType || this.getEmbellishmentType(),
                PrintLocation: item.printLocation || '',
                PrintLocationName: item.printLocationName || '',
                Quantity: parseInt(item.quantity || 0),
                HasLTM: item.hasLTM || 'No',
                BaseUnitPrice: parseFloat((item.baseUnitPrice || 0).toFixed(2)),
                LTMPerUnit: parseFloat((item.ltmPerUnit || 0).toFixed(2)),
                FinalUnitPrice: parseFloat((item.finalUnitPrice || 0).toFixed(2)),
                LineTotal: parseFloat((item.lineTotal || 0).toFixed(2)),
                SizeBreakdown: item.sizeBreakdown || '{}',
                PricingTier: item.pricingTier || this.getPricingTier(item.quantity),
                ImageURL: item.imageURL || '',
                AddedAt: addedAt
            };

            console.log(`[${this.constructor.name}] Saving item ${i + 1}:`, itemData);

            try {
                const itemResponse = await fetch(`${this.baseURL}/api/quote_items`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(itemData)
                });

                const itemResponseText = await itemResponse.text();
                console.log(`[${this.constructor.name}] Item response:`, itemResponse.status, itemResponseText);

                if (!itemResponse.ok) {
                    console.error(`Failed to save item ${i + 1}:`, itemResponseText);
                }
            } catch (error) {
                console.error(`[${this.constructor.name}] Error saving item ${i + 1}:`, error);
            }
        }
    }

    /**
     * Get embellishment type for this calculator
     * Should be overridden by specific calculators
     */
    getEmbellishmentType() {
        return 'custom';
    }

    /**
     * Format currency value
     */
    formatCurrency(amount) {
        return `$${parseFloat(amount).toFixed(2)}`;
    }

    /**
     * Validate email address
     */
    validateEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }

    /**
     * Get current date formatted
     */
    getCurrentDate() {
        return new Date().toLocaleDateString();
    }

    /**
     * Get expiration date (30 days from now)
     */
    getExpirationDate() {
        const date = new Date();
        date.setDate(date.getDate() + 30);
        return date.toLocaleDateString();
    }
}

// Make available globally if needed
if (typeof window !== 'undefined') {
    window.BaseQuoteService = BaseQuoteService;
}