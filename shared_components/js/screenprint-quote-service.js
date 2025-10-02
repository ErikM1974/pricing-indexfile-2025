/**
 * Screen Print Quote Service
 * Handles database operations and quote management for screen print quotes
 */

class ScreenPrintQuoteService {
    constructor() {
        this.baseURL = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
        this.quotePrefix = 'SP';
        console.log('[ScreenPrintQuoteService] Initialized');
    }

    /**
     * Generate unique quote ID with date-based sequence
     */
    generateQuoteID() {
        const now = new Date();
        const month = (now.getMonth() + 1).toString().padStart(2, '0');
        const day = now.getDate().toString().padStart(2, '0');
        const dateKey = `${month}${day}`;
        
        // Daily sequence reset using sessionStorage
        const storageKey = `${this.quotePrefix}_quote_sequence_${dateKey}`;
        let sequence = parseInt(sessionStorage.getItem(storageKey) || '0') + 1;
        sessionStorage.setItem(storageKey, sequence.toString());
        
        // Clean up old sequences
        this.cleanupOldSequences(dateKey);
        
        return `${this.quotePrefix}${dateKey}-${sequence}`;
    }

    /**
     * Clean up old sequence keys from sessionStorage
     */
    cleanupOldSequences(currentDateKey) {
        const keysToRemove = [];
        for (let i = 0; i < sessionStorage.length; i++) {
            const key = sessionStorage.key(i);
            if (key && key.startsWith(`${this.quotePrefix}_quote_sequence_`) && !key.includes(currentDateKey)) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach(key => sessionStorage.removeItem(key));
    }

    /**
     * Generate session ID for quote tracking
     */
    generateSessionID() {
        return `sp_quote_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Save complete quote to database
     */
    async saveQuote(quoteData) {
        try {
            const quoteID = this.generateQuoteID();
            const sessionID = this.generateSessionID();
            
            console.log('[ScreenPrintQuoteService] Saving quote:', quoteID);
            
            // Format expiration date (30 days from now)
            const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                .toISOString()
                .replace(/\.\d{3}Z$/, '');
            
            // Calculate totals
            const subtotal = quoteData.subtotal || quoteData.items.reduce((sum, item) => sum + item.total, 0);
            const ltmFeeTotal = quoteData.totalQuantity < 36 ? 50 : 0;
            const setupFees = this.calculateSetupFees(quoteData);
            const totalAmount = quoteData.grandTotal || (subtotal + ltmFeeTotal + setupFees);
            
            // Prepare print setup details for Notes field
            const printSetup = {
                locations: quoteData.printLocations || [],
                primaryColors: quoteData.primaryColors || 1,
                additionalColors: quoteData.additionalColors || {}
            };
            
            // Create session record
            const sessionData = {
                QuoteID: quoteID,
                SessionID: sessionID,
                CustomerEmail: quoteData.customerEmail || '',
                CustomerName: quoteData.customerName || 'Guest',
                CompanyName: quoteData.companyName || '',
                Phone: quoteData.customerPhone || '',
                TotalQuantity: parseInt(quoteData.totalQuantity),
                SubtotalAmount: parseFloat(subtotal.toFixed(2)),
                LTMFeeTotal: parseFloat(ltmFeeTotal.toFixed(2)),
                TotalAmount: parseFloat(totalAmount.toFixed(2)),
                Status: 'Open',
                ExpiresAt: expiresAt,
                Notes: JSON.stringify(printSetup)
            };
            
            // Save session
            const sessionResponse = await fetch(`${this.baseURL}/api/quote_sessions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(sessionData)
            });
            
            if (!sessionResponse.ok) {
                const errorText = await sessionResponse.text();
                console.error('[ScreenPrintQuoteService] Session save failed:', errorText);
                throw new Error(`Failed to save quote session: ${errorText}`);
            }
            
            const sessionResult = await sessionResponse.json();
            console.log('[ScreenPrintQuoteService] Session saved:', sessionResult);
            
            // Save line items
            const itemPromises = quoteData.items.map(async (item, index) => {
                const itemData = {
                    QuoteID: quoteID,
                    LineNumber: index + 1,
                    StyleNumber: item.styleNumber || 'CUSTOM',
                    ProductName: item.productName || 'Screen Print Item',
                    Color: item.color || '',
                    ColorCode: item.colorCode || '',
                    EmbellishmentType: 'screenprint',
                    PrintLocation: item.locations ? item.locations.join(', ') : 'Primary',
                    PrintLocationName: this.formatLocationDisplay(item),
                    Quantity: parseInt(item.quantity),
                    HasLTM: quoteData.totalQuantity < 36 ? 'Yes' : 'No',
                    BaseUnitPrice: parseFloat(item.basePrice || 0),
                    LTMPerUnit: parseFloat(item.ltmPerUnit || 0),
                    FinalUnitPrice: parseFloat(item.unitPrice || 0),
                    LineTotal: parseFloat(item.lineTotal || 0),
                    SizeBreakdown: JSON.stringify(item.sizeBreakdown || {}),
                    PricingTier: this.getPricingTier(quoteData.totalQuantity),
                    ImageURL: item.imageUrl || '',
                    AddedAt: new Date().toISOString().replace(/\.\d{3}Z$/, '')
                };
                
                const itemResponse = await fetch(`${this.baseURL}/api/quote_items`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(itemData)
                });
                
                if (!itemResponse.ok) {
                    const errorText = await itemResponse.text();
                    console.error('[ScreenPrintQuoteService] Item save failed:', errorText);
                    // Don't throw - allow partial success
                }
                
                return itemResponse.ok;
            });
            
            await Promise.all(itemPromises);
            
            console.log('[ScreenPrintQuoteService] Quote saved successfully:', quoteID);
            
            return {
                success: true,
                quoteID: quoteID,
                sessionID: sessionID,
                totalAmount: totalAmount
            };
            
        } catch (error) {
            console.error('[ScreenPrintQuoteService] Error saving quote:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Calculate setup fees based on print setup
     */
    calculateSetupFees(quoteData) {
        const screenFeePerColor = 30; // $30 per screen/color

        // Get setup fees from quoteData if already calculated
        if (quoteData.setupFees !== undefined) {
            return quoteData.setupFees;
        }

        // Otherwise calculate from print setup
        let totalScreens = quoteData.printSetup?.frontColors || 1;

        // Add underbase if dark garments
        if (quoteData.printSetup?.isDarkGarment) {
            totalScreens += 1;
        }

        return totalScreens * screenFeePerColor;
    }

    /**
     * Format location display for quote items
     */
    formatLocationDisplay(item) {
        if (!item.locations || item.locations.length === 0) {
            return 'Primary Location';
        }
        
        const locationNames = item.locations.map(loc => {
            switch(loc) {
                case 'LC': return 'Left Chest';
                case 'RC': return 'Right Chest';
                case 'FF': return 'Full Front';
                case 'FB': return 'Full Back';
                case 'LS': return 'Left Sleeve';
                case 'RS': return 'Right Sleeve';
                default: return loc;
            }
        });
        
        return locationNames.join(' + ');
    }

    /**
     * Get pricing tier based on quantity
     * Must match screenprint-pricing-v2.js tiers
     */
    getPricingTier(quantity) {
        if (quantity >= 13 && quantity <= 36) return '13-36';
        if (quantity >= 37 && quantity <= 72) return '37-72';
        if (quantity >= 73 && quantity <= 144) return '73-144';
        if (quantity >= 145) return '145-576';
        return '13-36'; // Default to tier 1
    }

    /**
     * Load existing quote by ID
     */
    async loadQuote(quoteID) {
        try {
            // Get session data
            const sessionResponse = await fetch(`${this.baseURL}/api/quote_sessions?quoteID=${quoteID}`);
            if (!sessionResponse.ok) {
                throw new Error('Quote not found');
            }
            
            const sessions = await sessionResponse.json();
            if (!sessions || sessions.length === 0) {
                throw new Error('Quote not found');
            }
            
            const session = sessions[0];
            
            // Get items
            const itemsResponse = await fetch(`${this.baseURL}/api/quote_items?quoteID=${quoteID}`);
            const items = await itemsResponse.json();
            
            return {
                session: session,
                items: items || []
            };
            
        } catch (error) {
            console.error('[ScreenPrintQuoteService] Error loading quote:', error);
            throw error;
        }
    }

    /**
     * Update existing quote
     */
    async updateQuote(quoteID, updates) {
        try {
            const response = await fetch(`${this.baseURL}/api/quote_sessions/${quoteID}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(updates)
            });
            
            if (!response.ok) {
                throw new Error('Failed to update quote');
            }
            
            return { success: true };
            
        } catch (error) {
            console.error('[ScreenPrintQuoteService] Error updating quote:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get recent quotes
     */
    async getRecentQuotes(limit = 10) {
        try {
            const response = await fetch(`${this.baseURL}/api/quote_sessions?q.orderBy=CreatedAt DESC&q.limit=${limit}`);
            if (!response.ok) {
                throw new Error('Failed to fetch quotes');
            }
            
            const quotes = await response.json();
            return quotes.filter(q => q.QuoteID && q.QuoteID.startsWith('SP'));
            
        } catch (error) {
            console.error('[ScreenPrintQuoteService] Error fetching quotes:', error);
            return [];
        }
    }
}

// Make service globally available
window.ScreenPrintQuoteService = ScreenPrintQuoteService;