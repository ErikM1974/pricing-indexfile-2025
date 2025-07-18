/**
 * Richardson Quote Service
 * Handles saving Richardson cap quotes to Caspio database
 */

class RichardsonQuoteService {
    constructor() {
        this.baseURL = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
    }

    /**
     * Generate unique quote ID for Richardson quotes
     */
    generateQuoteID() {
        const now = new Date();
        const month = (now.getMonth() + 1).toString().padStart(2, '0');
        const day = now.getDate().toString().padStart(2, '0');
        const dateKey = `${month}${day}`;
        
        // Get or initialize daily sequence from sessionStorage
        const storageKey = `richardson_quote_sequence_${dateKey}`;
        let sequence = parseInt(sessionStorage.getItem(storageKey) || '0') + 1;
        
        // Store the updated sequence
        sessionStorage.setItem(storageKey, sequence.toString());
        
        // Clean up old date keys
        this.cleanupOldSequences(dateKey);
        
        // Use RICH prefix for Richardson quotes
        return `RICH${dateKey}-${sequence}`;
    }
    
    /**
     * Clean up sequence numbers from previous days
     */
    cleanupOldSequences(currentDateKey) {
        const keys = Object.keys(sessionStorage);
        keys.forEach(key => {
            if (key.startsWith('richardson_quote_sequence_') && !key.endsWith(currentDateKey)) {
                sessionStorage.removeItem(key);
            }
        });
    }

    /**
     * Generate session ID
     */
    generateSessionID() {
        return `rich_sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Get pricing tier for embroidery
     */
    getPricingTier(quantity) {
        if (quantity < 24) return '1-23';
        if (quantity < 48) return '24-47';
        if (quantity < 72) return '48-71';
        return '72+';
    }

    /**
     * Build setup fees note for database storage
     */
    buildSetupFeesNote(setupFees) {
        if (!setupFees || setupFees.total === 0) return '';
        
        let note = 'SETUP FEES:\n';
        
        if (setupFees.digitizing > 0) {
            note += `- Digitizing Fee: $${setupFees.digitizing.toFixed(2)}\n`;
        }
        
        if (setupFees.graphicDesign > 0) {
            note += `- Graphic Design Fee: $${setupFees.graphicDesign.toFixed(2)}\n`;
        }
        
        if (setupFees.additional && setupFees.additional.length > 0) {
            setupFees.additional.forEach(fee => {
                note += `- ${fee.name}: $${fee.amount.toFixed(2)}\n`;
            });
        }
        
        note += `Setup Fees Total: $${setupFees.total.toFixed(2)}`;
        
        return note;
    }

    /**
     * Save Richardson quote (session + multiple items)
     */
    async saveQuote(quoteData) {
        try {
            const quoteID = this.generateQuoteID();
            const sessionID = this.generateSessionID();
            
            console.log('[RichardsonQuoteService] Saving quote with ID:', quoteID);

            // Step 1: Create quote session
            const expiresAtDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
            const formattedExpiresAt = expiresAtDate.toISOString().replace(/\.\d{3}Z$/, '');
            
            // Calculate total quantity across all items
            const totalQuantity = quoteData.items.reduce((sum, item) => sum + item.quantity, 0);
            
            // Calculate total amount including setup fees
            const totalAmount = quoteData.grandTotal || quoteData.items.reduce((sum, item) => sum + item.lineTotal, 0);
            const subtotalAmount = quoteData.subtotal || quoteData.items.reduce((sum, item) => sum + item.lineTotal, 0);
            
            // Build notes with setup fees if present
            let notesContent = quoteData.notes || '';
            if (quoteData.setupFees && quoteData.setupFees.total > 0) {
                const setupFeesNote = this.buildSetupFeesNote(quoteData.setupFees);
                notesContent = notesContent ? `${notesContent}\n\n${setupFeesNote}` : setupFeesNote;
            }
            
            const sessionData = {
                QuoteID: quoteID,
                SessionID: sessionID,
                CustomerEmail: quoteData.customerEmail,
                CustomerName: quoteData.customerName || 'Guest',
                CompanyName: quoteData.companyName || 'Not Provided',
                Phone: quoteData.customerPhone || '',
                TotalQuantity: totalQuantity,
                SubtotalAmount: parseFloat(subtotalAmount.toFixed(2)),
                LTMFeeTotal: quoteData.ltmFeeTotal || 0,
                TotalAmount: parseFloat(totalAmount.toFixed(2)),
                Status: 'Open',
                ExpiresAt: formattedExpiresAt,
                Notes: notesContent,
                SalesRepEmail: quoteData.salesRepEmail || 'sales@nwcustomapparel.com',
                SalesRepName: quoteData.salesRepName || 'General Sales',
                ProjectName: quoteData.projectName || ''
            };

            console.log('[RichardsonQuoteService] Session data:', sessionData);

            const sessionResponse = await fetch(`${this.baseURL}/api/quote_sessions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(sessionData)
            });

            // Get response text first to see error details
            const responseText = await sessionResponse.text();
            console.log('[RichardsonQuoteService] Session response status:', sessionResponse.status);
            console.log('[RichardsonQuoteService] Session response text:', responseText);

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
                console.error('[RichardsonQuoteService] Failed to parse success response:', e);
                sessionResult = { success: true, message: responseText };
            }
            
            console.log('[RichardsonQuoteService] Session created:', sessionResult);

            // Step 2: Add items to quote
            const itemPromises = quoteData.items.map(async (item, index) => {
                const addedAt = new Date().toISOString().replace(/\.\d{3}Z$/, '');
                
                const itemData = {
                    QuoteID: quoteID,
                    LineNumber: index + 1,
                    StyleNumber: item.styleNumber,
                    ProductName: item.description,
                    Color: '', // Richardson doesn't specify colors in this calculator
                    ColorCode: '',
                    EmbellishmentType: quoteData.embellishmentType || 'embroidery',
                    PrintLocation: 'Cap Front',
                    PrintLocationName: 'Cap Front',
                    Quantity: parseInt(item.quantity),
                    HasLTM: totalQuantity < 24 ? 'Yes' : 'No',
                    BaseUnitPrice: parseFloat(item.pricePerPiece),
                    LTMPerUnit: item.ltmPerUnit || 0,
                    FinalUnitPrice: parseFloat(item.pricePerPiece),
                    LineTotal: parseFloat(item.lineTotal),
                    SizeBreakdown: JSON.stringify({
                        sizes: { "OS": item.quantity }, // One Size for caps
                        capDetails: {
                            stitchCount: quoteData.stitchCount,
                            capBasePrice: item.capPrice,
                            embellishmentPrice: item.embellishmentPrice,
                            embellishmentType: quoteData.embellishmentType
                        },
                        setupFees: quoteData.setupFees || null
                    }),
                    PricingTier: this.getPricingTier(totalQuantity),
                    ImageURL: '',
                    AddedAt: addedAt
                };

                console.log('[RichardsonQuoteService] Item data:', itemData);

                const itemResponse = await fetch(`${this.baseURL}/api/quote_items`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(itemData)
                });

                const itemResponseText = await itemResponse.text();
                console.log('[RichardsonQuoteService] Item response status:', itemResponse.status);
                console.log('[RichardsonQuoteService] Item response text:', itemResponseText);

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

                return itemResult;
            });

            const itemResults = await Promise.all(itemPromises);
            console.log('[RichardsonQuoteService] Items created:', itemResults);

            return {
                success: true,
                quoteID: quoteID,
                sessionData: sessionResult,
                itemsData: itemResults
            };

        } catch (error) {
            console.error('[RichardsonQuoteService] Error saving quote:', error);
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
            console.error('[RichardsonQuoteService] Error getting quote:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

// Export for use in Richardson calculator
window.RichardsonQuoteService = RichardsonQuoteService;