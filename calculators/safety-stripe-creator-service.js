/**
 * Safety Stripe Creator Quote Service
 * Handles saving safety stripe designs to Caspio database
 */

class SafetyStripeQuoteService {
    constructor() {
        this.baseURL = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
        this.quotePrefix = 'SSC'; // Safety Stripe Creator
    }

    /**
     * Generate unique quote ID for safety stripe designs
     */
    generateQuoteID() {
        const now = new Date();
        const month = (now.getMonth() + 1).toString().padStart(2, '0');
        const day = now.getDate().toString().padStart(2, '0');
        const dateKey = `${month}${day}`;
        
        // Get or initialize daily sequence from sessionStorage
        const storageKey = `safety_stripe_sequence_${dateKey}`;
        let sequence = parseInt(sessionStorage.getItem(storageKey) || '0') + 1;
        
        // Store the updated sequence
        sessionStorage.setItem(storageKey, sequence.toString());
        
        // Clean up old date keys
        this.cleanupOldSequences(dateKey);
        
        return `SSC${dateKey}-${sequence}`;
    }
    
    /**
     * Clean up sequence numbers from previous days
     */
    cleanupOldSequences(currentDateKey) {
        const keys = Object.keys(sessionStorage);
        keys.forEach(key => {
            if (key.startsWith('safety_stripe_sequence_') && !key.endsWith(currentDateKey)) {
                sessionStorage.removeItem(key);
            }
        });
    }

    /**
     * Generate session ID
     */
    generateSessionID() {
        return `ssc_sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Save safety stripe design to database
     */
    async saveDesign(designData) {
        try {
            const quoteID = this.generateQuoteID();
            const sessionID = this.generateSessionID();
            
            console.log('[SafetyStripeQuoteService] Saving design with ID:', quoteID);

            // Step 1: Create quote session
            const expiresAtDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
            const formattedExpiresAt = expiresAtDate.toISOString().replace(/\.\d{3}Z$/, '');
            
            const sessionData = {
                QuoteID: quoteID,
                SessionID: sessionID,
                CustomerEmail: designData.customerEmail,
                CustomerName: designData.customerName || 'Guest',
                CompanyName: designData.companyName || 'Not Provided',
                Phone: designData.customerPhone || '',
                TotalQuantity: 0, // No quantity for designs
                SubtotalAmount: 0,
                LTMFeeTotal: 0,
                TotalAmount: 0,
                Status: 'Design Sent',
                ExpiresAt: formattedExpiresAt,
                Notes: `Safety Stripe Design - ${designData.stripeStyle}\nFront: ${designData.frontOption}, Back: ${designData.backOption}`
            };

            console.log('[SafetyStripeQuoteService] Session data:', sessionData);

            const sessionResponse = await fetch(`${this.baseURL}/api/quote_sessions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(sessionData)
            });

            const responseText = await sessionResponse.text();
            console.log('[SafetyStripeQuoteService] Session response:', sessionResponse.status, responseText);

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

            // Step 2: Add design details to quote_items
            const addedAt = new Date().toISOString().replace(/\.\d{3}Z$/, '');
            
            // Format option names for display
            const formatOption = (opt) => opt.replace(/([A-Z])/g, ' $1').trim();
            
            const itemData = {
                QuoteID: quoteID,
                LineNumber: 1,
                StyleNumber: 'SAFETY-STRIPE',
                ProductName: `Safety Stripe Design - ${designData.stripeStyle}`,
                Color: 'Safety Orange',
                ColorCode: '#FF6B35',
                EmbellishmentType: 'safety-stripes',
                PrintLocation: `Front: ${formatOption(designData.frontOption)}, Back: ${formatOption(designData.backOption)}`,
                PrintLocationName: designData.stripeStyle,
                Quantity: 0,
                HasLTM: 'No',
                BaseUnitPrice: 0,
                LTMPerUnit: 0,
                FinalUnitPrice: 0,
                LineTotal: 0,
                // Store design configuration as JSON
                SizeBreakdown: JSON.stringify({
                    stripeStyle: designData.stripeStyle,
                    frontOption: designData.frontOption,
                    backOption: designData.backOption,
                    frontImage: designData.frontImage,
                    backImage: designData.backImage,
                    sentBy: designData.salesRepEmail,
                    sentAt: new Date().toISOString()
                }),
                PricingTier: 'Design Only',
                ImageURL: designData.frontImage || '',
                AddedAt: addedAt
            };

            console.log('[SafetyStripeQuoteService] Item data:', itemData);

            const itemResponse = await fetch(`${this.baseURL}/api/quote_items`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(itemData)
            });

            const itemResponseText = await itemResponse.text();
            console.log('[SafetyStripeQuoteService] Item response:', itemResponse.status, itemResponseText);

            if (!itemResponse.ok) {
                console.error('Failed to save design details:', itemResponseText);
                // Don't throw - session was created successfully
            }

            return {
                success: true,
                quoteID: quoteID,
                message: 'Design saved successfully'
            };

        } catch (error) {
            console.error('[SafetyStripeQuoteService] Error saving design:', error);
            // Still return a quote ID even if database save failed
            // This ensures the customer gets their design
            return {
                success: false,
                quoteID: this.generateQuoteID(),
                error: error.message
            };
        }
    }

    /**
     * Retrieve a saved design by Quote ID
     */
    async getDesign(quoteID) {
        try {
            // First get the quote session
            const sessionResponse = await fetch(`${this.baseURL}/api/quote_sessions?QuoteID=${quoteID}`);
            if (!sessionResponse.ok) {
                throw new Error('Design not found');
            }
            
            const sessions = await sessionResponse.json();
            if (!sessions.length) {
                throw new Error('Design not found');
            }

            // Then get the quote items
            const itemsResponse = await fetch(`${this.baseURL}/api/quote_items?QuoteID=${quoteID}`);
            if (!itemsResponse.ok) {
                throw new Error('Design details not found');
            }

            const items = await itemsResponse.json();
            if (!items.length) {
                throw new Error('Design details not found');
            }

            // Parse the design configuration
            const designConfig = JSON.parse(items[0].SizeBreakdown || '{}');
            
            return {
                success: true,
                session: sessions[0],
                design: designConfig
            };

        } catch (error) {
            console.error('[SafetyStripeQuoteService] Error retrieving design:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

// Make available globally
window.SafetyStripeQuoteService = SafetyStripeQuoteService;