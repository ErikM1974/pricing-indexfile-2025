/**
 * Manual Embroidery Quote Service (for flat items - shirts, bags, etc.)
 * Handles saving quotes to Caspio database with hybrid API integration
 */

class EmbroideryManualQuoteService {
    constructor() {
        this.baseURL = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
    }

    /**
     * Generate unique quote ID with EMBM prefix
     */
    generateQuoteID() {
        const now = new Date();
        const month = (now.getMonth() + 1).toString().padStart(2, '0');
        const day = now.getDate().toString().padStart(2, '0');
        const dateKey = `${month}${day}`;
        
        // Daily sequence reset using sessionStorage
        const storageKey = `EMBM_quote_sequence_${dateKey}`;
        let sequence = parseInt(sessionStorage.getItem(storageKey) || '0') + 1;
        sessionStorage.setItem(storageKey, sequence.toString());
        
        // Clean up old sequences
        this.cleanupOldSequences(dateKey);
        
        return `EMBM${dateKey}-${sequence}`;
    }

    /**
     * Generate session ID
     */
    generateSessionID() {
        return `embm_sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Clean up sequence numbers from previous days
     */
    cleanupOldSequences(currentDateKey) {
        const keys = Object.keys(sessionStorage);
        keys.forEach(key => {
            if (key.startsWith('EMBM_quote_sequence_') && !key.endsWith(currentDateKey)) {
                sessionStorage.removeItem(key);
            }
        });
    }

    /**
     * Get pricing tier based on quantity (using live API data)
     * 2026-02 RESTRUCTURE: New 5-tier system with 1-7 (LTM) and 8-23 (no LTM)
     */
    getPricingTier(quantity) {
        // This matches the live tier data from the API (2026 restructure)
        if (quantity <= 7) return '1-7';
        if (quantity <= 23) return '8-23';
        if (quantity <= 47) return '24-47';
        if (quantity <= 71) return '48-71';
        return '72+';
    }

    /**
     * Save quote to database using two-table structure
     */
    async saveQuote(quoteData) {
        try {
            const quoteID = this.generateQuoteID();
            const sessionID = this.generateSessionID();
            
            console.log(`[EmbManualQuoteService] Saving quote with ID:`, quoteID);

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
                TotalQuantity: parseInt(quoteData.quantity),
                SubtotalAmount: parseFloat(this.calculateSubtotal(quoteData).toFixed(2)),
                LTMFeeTotal: parseFloat((quoteData.ltmFee || 0).toFixed(2)),
                TotalAmount: parseFloat(quoteData.totalCost.toFixed(2)),
                Status: 'Open',
                ExpiresAt: formattedExpiresAt,
                Notes: quoteData.notes || ''
            };

            console.log(`[EmbManualQuoteService] Session data:`, sessionData);

            const sessionResponse = await fetch(`${this.baseURL}/api/quote_sessions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(sessionData)
            });

            const responseText = await sessionResponse.text();
            console.log(`[EmbManualQuoteService] Session response:`, sessionResponse.status, responseText);

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

            // Step 2: Create quote items
            await this.saveQuoteItems(quoteID, quoteData);

            return {
                success: true,
                quoteID: quoteID,
                sessionData: sessionData
            };

        } catch (error) {
            console.error(`[EmbManualQuoteService] Error saving quote:`, error);
            
            // Still return the quote ID if we have one
            // This ensures the customer gets their quote
            return {
                success: false,
                quoteID: this.generateQuoteID(),
                error: error.message
            };
        }
    }

    /**
     * Calculate subtotal without LTM fee
     */
    calculateSubtotal(quoteData) {
        return quoteData.totalCost - (quoteData.ltmFee || 0);
    }

    /**
     * Save quote items with detailed embroidery information
     */
    async saveQuoteItems(quoteID, quoteData) {
        const items = [];
        const addedAt = new Date().toISOString().replace(/\.\d{3}Z$/, '');
        
        // Main item: Manual Garment + Front Logo Embroidery
        const frontItem = {
            QuoteID: quoteID,
            LineNumber: 1,
            StyleNumber: 'MANUAL-GARMENT',
            ProductName: `Manual Garment + Front Logo Embroidery (${quoteData.frontStitches.toLocaleString()} stitches)`,
            Color: 'As Specified',
            ColorCode: '',
            EmbellishmentType: 'embroidery',
            PrintLocation: 'CF',
            PrintLocationName: 'Center Front',
            Quantity: parseInt(quoteData.quantity),
            HasLTM: quoteData.hasLTM ? 'Yes' : 'No',
            BaseUnitPrice: parseFloat(this.calculateBasePrice(quoteData).toFixed(2)),
            LTMPerUnit: quoteData.hasLTM ? parseFloat((quoteData.ltmFee / quoteData.quantity).toFixed(2)) : 0,
            FinalUnitPrice: parseFloat(quoteData.unitPrice.toFixed(2)),
            LineTotal: parseFloat(quoteData.totalCost.toFixed(2)),
            SizeBreakdown: JSON.stringify(this.buildSizeBreakdown(quoteData)),
            PricingTier: quoteData.tier,
            ImageURL: '',
            AddedAt: addedAt
        };
        
        items.push(frontItem);

        // Additional logo items
        let lineNumber = 2;
        
        if (quoteData.logo1Enabled) {
            const logo1Item = {
                QuoteID: quoteID,
                LineNumber: lineNumber++,
                StyleNumber: 'ADD-LOGO',
                ProductName: `Additional Logo 1 (${quoteData.logo1Stitches.toLocaleString()} stitches)`,
                Color: '',
                ColorCode: '',
                EmbellishmentType: 'embroidery',
                PrintLocation: 'OTHER',
                PrintLocationName: 'Additional Location 1',
                Quantity: parseInt(quoteData.quantity),
                HasLTM: 'No',
                BaseUnitPrice: 0, // Included in main item pricing
                LTMPerUnit: 0,
                FinalUnitPrice: 0, // Included in main item pricing
                LineTotal: 0,
                SizeBreakdown: JSON.stringify({
                    stitchCount: quoteData.logo1Stitches,
                    location: 'additional-1'
                }),
                PricingTier: quoteData.tier,
                ImageURL: '',
                AddedAt: addedAt
            };
            items.push(logo1Item);
        }

        if (quoteData.logo2Enabled) {
            const logo2Item = {
                QuoteID: quoteID,
                LineNumber: lineNumber++,
                StyleNumber: 'ADD-LOGO',
                ProductName: `Additional Logo 2 (${quoteData.logo2Stitches.toLocaleString()} stitches)`,
                Color: '',
                ColorCode: '',
                EmbellishmentType: 'embroidery',
                PrintLocation: 'OTHER',
                PrintLocationName: 'Additional Location 2',
                Quantity: parseInt(quoteData.quantity),
                HasLTM: 'No',
                BaseUnitPrice: 0, // Included in main item pricing
                LTMPerUnit: 0,
                FinalUnitPrice: 0, // Included in main item pricing
                LineTotal: 0,
                SizeBreakdown: JSON.stringify({
                    stitchCount: quoteData.logo2Stitches,
                    location: 'additional-2'
                }),
                PricingTier: quoteData.tier,
                ImageURL: '',
                AddedAt: addedAt
            };
            items.push(logo2Item);
        }

        if (quoteData.logo3Enabled) {
            const logo3Item = {
                QuoteID: quoteID,
                LineNumber: lineNumber++,
                StyleNumber: 'ADD-LOGO',
                ProductName: `Additional Logo 3 (${quoteData.logo3Stitches.toLocaleString()} stitches)`,
                Color: '',
                ColorCode: '',
                EmbellishmentType: 'embroidery',
                PrintLocation: 'OTHER',
                PrintLocationName: 'Additional Location 3',
                Quantity: parseInt(quoteData.quantity),
                HasLTM: 'No',
                BaseUnitPrice: 0, // Included in main item pricing
                LTMPerUnit: 0,
                FinalUnitPrice: 0, // Included in main item pricing
                LineTotal: 0,
                SizeBreakdown: JSON.stringify({
                    stitchCount: quoteData.logo3Stitches,
                    location: 'additional-3'
                }),
                PricingTier: quoteData.tier,
                ImageURL: '',
                AddedAt: addedAt
            };
            items.push(logo3Item);
        }

        // Save each item
        for (const item of items) {
            console.log(`[EmbManualQuoteService] Saving item ${item.LineNumber}:`, item.ProductName);
            
            const itemResponse = await fetch(`${this.baseURL}/api/quote_items`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(item)
            });

            const itemResponseText = await itemResponse.text();
            console.log(`[EmbManualQuoteService] Item ${item.LineNumber} response:`, itemResponse.status, itemResponseText);

            if (!itemResponse.ok) {
                console.error(`Failed to save item ${item.LineNumber}:`, itemResponseText);
                // Continue with other items
            }
        }
    }

    /**
     * Calculate base price without additional logos and LTM
     */
    calculateBasePrice(quoteData) {
        let basePrice = quoteData.unitPrice;
        
        // Subtract LTM fee if applicable
        if (quoteData.hasLTM) {
            basePrice -= (quoteData.ltmFee / quoteData.quantity);
        }
        
        return basePrice;
    }

    /**
     * Build simplified size breakdown data for database storage
     * Matches working calculator patterns (Richardson, Emblem)
     */
    buildSizeBreakdown(quoteData) {
        return {
            // Basic embroidery details
            stitchCount: quoteData.frontStitches,
            quantity: quoteData.quantity,
            calculatorType: 'Manual Embroidery',
            
            // Pricing summary
            basePrice: this.calculateBasePrice(quoteData),
            finalPrice: quoteData.unitPrice,
            
            // LTM information
            hasLTM: quoteData.hasLTM,
            ltmFeeTotal: quoteData.ltmFee || 0,
            
            // Additional logos
            additionalLogos: quoteData.logo1Enabled || quoteData.logo2Enabled || quoteData.logo3Enabled,
            
            // Order flags
            isAddon: quoteData.isAddon || false,
            isProgramAccount: quoteData.isProgramAccount || false
        };
    }

    /**
     * Fallback method for base cost if API data is not available
     * 2026-02 RESTRUCTURE: New 5-tier system
     */
    getBaseCost8k(tier) {
        // Fallback base costs if API data is not provided (2026 pricing)
        const defaultCosts = {
            '1-7': 10.50,    // LTM tier - $50 setup fee applies
            '8-23': 10.50,   // No LTM, but $4 surcharge baked in
            '24-47': 9.50,
            '48-71': 8.75,
            '72+': 8.00
        };
        return defaultCosts[tier] || 9.50;
    }
}

// Make available globally
window.EmbroideryManualQuoteService = EmbroideryManualQuoteService;