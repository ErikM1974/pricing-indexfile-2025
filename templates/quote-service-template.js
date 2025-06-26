/**
 * {{CALCULATOR_TYPE}} Quote Service
 * Handles saving {{CALCULATOR_NAME}} quotes to Caspio database
 * 
 * SETUP INSTRUCTIONS:
 * 1. Replace all {{PLACEHOLDER}} values with your calculator-specific values
 * 2. Update the pricing tier logic if needed
 * 3. Customize the item data structure for your calculator type
 * 4. Save as: {{calculator-name}}-quote-service.js
 */

class {{CALCULATOR_CLASS}}QuoteService {
    constructor() {
        this.baseURL = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
    }

    /**
     * Generate unique quote ID for {{CALCULATOR_TYPE}} quotes
     */
    generateQuoteID() {
        const now = new Date();
        const month = (now.getMonth() + 1).toString().padStart(2, '0');
        const day = now.getDate().toString().padStart(2, '0');
        const dateKey = `${month}${day}`;
        
        // Get or initialize daily sequence from sessionStorage
        const storageKey = `{{STORAGE_KEY}}_quote_sequence_${dateKey}`;
        let sequence = parseInt(sessionStorage.getItem(storageKey) || '0') + 1;
        
        // Store the updated sequence
        sessionStorage.setItem(storageKey, sequence.toString());
        
        // Clean up old date keys
        this.cleanupOldSequences(dateKey);
        
        // Use {{PREFIX}} prefix for quotes (e.g., 'DTG', 'RICH', 'EMB')
        return `{{QUOTE_PREFIX}}${dateKey}-${sequence}`;
    }
    
    /**
     * Clean up sequence numbers from previous days
     */
    cleanupOldSequences(currentDateKey) {
        const keys = Object.keys(sessionStorage);
        keys.forEach(key => {
            if (key.startsWith('{{STORAGE_KEY}}_quote_sequence_') && !key.endsWith(currentDateKey)) {
                sessionStorage.removeItem(key);
            }
        });
    }

    /**
     * Generate session ID
     */
    generateSessionID() {
        return `{{SESSION_PREFIX}}_sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Get pricing tier
     * CUSTOMIZE: Update these tiers based on your calculator's pricing structure
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
     * Save {{CALCULATOR_TYPE}} quote
     * CUSTOMIZE: Update the data structure based on your calculator's needs
     */
    async saveQuote(quoteData) {
        try {
            const quoteID = this.generateQuoteID();
            const sessionID = this.generateSessionID();
            
            console.log('[{{CALCULATOR_CLASS}}QuoteService] Saving quote with ID:', quoteID);

            // Step 1: Create quote session
            const expiresAtDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
            const formattedExpiresAt = expiresAtDate.toISOString().replace(/\.\d{3}Z$/, '');
            
            /* ==================================
               SESSION DATA STRUCTURE
               
               Standard fields (keep these):
               - QuoteID, SessionID, CustomerEmail, CustomerName
               - CompanyName, Phone, Status, ExpiresAt
               
               Calculator-specific fields (customize):
               - TotalQuantity: How you calculate total quantity
               - SubtotalAmount, TotalAmount: Your pricing calculations
               - LTMFeeTotal: If applicable
               - Notes: Store any calculator-specific data as JSON
               ================================== */
            
            const sessionData = {
                QuoteID: quoteID,
                SessionID: sessionID,
                CustomerEmail: quoteData.customerEmail,
                CustomerName: quoteData.customerName || 'Guest',
                CompanyName: quoteData.companyName || 'Not Provided',
                Phone: quoteData.customerPhone || '',
                TotalQuantity: quoteData.totalQuantity || 0,
                SubtotalAmount: parseFloat((quoteData.subtotal || quoteData.grandTotal || 0).toFixed(2)),
                LTMFeeTotal: quoteData.ltmFeeTotal || 0,
                TotalAmount: parseFloat((quoteData.grandTotal || 0).toFixed(2)),
                Status: 'Open',
                ExpiresAt: formattedExpiresAt,
                Notes: JSON.stringify({
                    projectName: quoteData.projectName || '',
                    calculatorType: '{{CALCULATOR_TYPE}}',
                    // Add any calculator-specific data here
                })
            };

            console.log('[{{CALCULATOR_CLASS}}QuoteService] Session data:', sessionData);

            const sessionResponse = await fetch(`${this.baseURL}/api/quote_sessions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(sessionData)
            });

            // Get response text first to see error details
            const responseText = await sessionResponse.text();
            console.log('[{{CALCULATOR_CLASS}}QuoteService] Session response status:', sessionResponse.status);
            console.log('[{{CALCULATOR_CLASS}}QuoteService] Session response text:', responseText);

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
                console.error('[{{CALCULATOR_CLASS}}QuoteService] Failed to parse success response:', e);
                sessionResult = { success: true, message: responseText };
            }
            
            console.log('[{{CALCULATOR_CLASS}}QuoteService] Session created:', sessionResult);

            // Step 2: Add items to quote
            /* ==================================
               ITEM SAVING LOGIC
               
               Choose one approach based on your calculator:
               
               A) Single item (like DTG):
               - Create one quote_items record with all details
               
               B) Multiple items (like Richardson):
               - Loop through items array
               - Create one quote_items record per item
               ================================== */
            
            // OPTION A: Single Item Example
            if (!quoteData.items) {
                const addedAt = new Date().toISOString().replace(/\.\d{3}Z$/, '');
                
                const itemData = {
                    QuoteID: quoteID,
                    LineNumber: 1,
                    StyleNumber: quoteData.styleNumber || 'CUSTOM',
                    ProductName: quoteData.productName || '{{CALCULATOR_TYPE}} Service',
                    Color: quoteData.color || '',
                    ColorCode: '',
                    EmbellishmentType: '{{EMBELLISHMENT_TYPE}}', // e.g., 'embroidery', 'screenprint', 'dtg'
                    PrintLocation: quoteData.location || '',
                    PrintLocationName: quoteData.locationName || '',
                    Quantity: parseInt(quoteData.quantity || quoteData.totalQuantity || 0),
                    HasLTM: quoteData.hasLTM || 'No',
                    BaseUnitPrice: parseFloat((quoteData.unitPrice || 0).toFixed(2)),
                    LTMPerUnit: quoteData.ltmPerUnit || 0,
                    FinalUnitPrice: parseFloat((quoteData.finalUnitPrice || quoteData.unitPrice || 0).toFixed(2)),
                    LineTotal: parseFloat((quoteData.lineTotal || quoteData.grandTotal || 0).toFixed(2)),
                    SizeBreakdown: JSON.stringify(quoteData.sizeBreakdown || {}),
                    PricingTier: this.getPricingTier(quoteData.quantity || quoteData.totalQuantity || 0),
                    ImageURL: quoteData.imageURL || '',
                    AddedAt: addedAt
                };

                console.log('[{{CALCULATOR_CLASS}}QuoteService] Item data:', itemData);

                const itemResponse = await fetch(`${this.baseURL}/api/quote_items`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(itemData)
                });

                const itemResponseText = await itemResponse.text();
                console.log('[{{CALCULATOR_CLASS}}QuoteService] Item response status:', itemResponse.status);
                console.log('[{{CALCULATOR_CLASS}}QuoteService] Item response text:', itemResponseText);

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
            }
            
            // OPTION B: Multiple Items Example (uncomment if needed)
            /*
            if (quoteData.items && quoteData.items.length > 0) {
                const itemPromises = quoteData.items.map(async (item, index) => {
                    const addedAt = new Date().toISOString().replace(/\.\d{3}Z$/, '');
                    
                    const itemData = {
                        QuoteID: quoteID,
                        LineNumber: index + 1,
                        StyleNumber: item.styleNumber,
                        ProductName: item.productName || item.description,
                        // ... map your item fields here
                        AddedAt: addedAt
                    };

                    const itemResponse = await fetch(`${this.baseURL}/api/quote_items`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(itemData)
                    });

                    // Handle response...
                    return itemResponse;
                });

                await Promise.all(itemPromises);
            }
            */

            return {
                success: true,
                quoteID: quoteID,
                sessionData: sessionResult
            };

        } catch (error) {
            console.error('[{{CALCULATOR_CLASS}}QuoteService] Error saving quote:', error);
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
            console.error('[{{CALCULATOR_CLASS}}QuoteService] Error getting quote:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

// Export for use in calculator
window.{{CALCULATOR_CLASS}}QuoteService = {{CALCULATOR_CLASS}}QuoteService;