/**
 * Manual Cap Embroidery Quote Service
 * Handles saving quotes to Caspio database with hybrid API integration
 */

class CapEmbroideryManualQuoteService {
    constructor() {
        this.baseURL = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
    }

    /**
     * Generate unique quote ID with CAPM prefix
     */
    generateQuoteID() {
        const now = new Date();
        const month = (now.getMonth() + 1).toString().padStart(2, '0');
        const day = now.getDate().toString().padStart(2, '0');
        const dateKey = `${month}${day}`;
        
        // Daily sequence reset using sessionStorage
        const storageKey = `CAPM_quote_sequence_${dateKey}`;
        let sequence = parseInt(sessionStorage.getItem(storageKey) || '0') + 1;
        sessionStorage.setItem(storageKey, sequence.toString());
        
        // Clean up old sequences
        this.cleanupOldSequences(dateKey);
        
        return `CAPM${dateKey}-${sequence}`;
    }

    /**
     * Generate session ID
     */
    generateSessionID() {
        return `capm_sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Clean up sequence numbers from previous days
     */
    cleanupOldSequences(currentDateKey) {
        const keys = Object.keys(sessionStorage);
        keys.forEach(key => {
            if (key.startsWith('CAPM_quote_sequence_') && !key.endsWith(currentDateKey)) {
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
            
            console.log(`[CapManualQuoteService] Saving quote with ID:`, quoteID);

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

            console.log(`[CapManualQuoteService] Session data:`, sessionData);

            const sessionResponse = await fetch(`${this.baseURL}/api/quote_sessions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(sessionData)
            });

            const responseText = await sessionResponse.text();
            console.log(`[CapManualQuoteService] Session response:`, sessionResponse.status, responseText);

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
            console.error(`[CapManualQuoteService] Error saving quote:`, error);
            
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
        
        // Main item: Manual Cap + Front Logo Embroidery
        const frontItem = {
            QuoteID: quoteID,
            LineNumber: 1,
            StyleNumber: 'MANUAL-CAP',
            ProductName: `Manual Cap + Front Logo Embroidery (${quoteData.frontStitches.toLocaleString()} stitches)`,
            Color: 'As Specified',
            ColorCode: '',
            EmbellishmentType: 'embroidery',
            PrintLocation: 'CF',
            PrintLocationName: 'Cap Front',
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
        
        if (quoteData.backLogoEnabled) {
            const backItem = {
                QuoteID: quoteID,
                LineNumber: lineNumber++,
                StyleNumber: 'ADD-LOGO',
                ProductName: `Back Logo Embroidery (${quoteData.backStitches.toLocaleString()} stitches)`,
                Color: '',
                ColorCode: '',
                EmbellishmentType: 'embroidery',
                PrintLocation: 'CB',
                PrintLocationName: 'Cap Back',
                Quantity: parseInt(quoteData.quantity),
                HasLTM: 'No',
                BaseUnitPrice: 0, // Included in main item pricing
                LTMPerUnit: 0,
                FinalUnitPrice: 0, // Included in main item pricing
                LineTotal: 0,
                SizeBreakdown: JSON.stringify({
                    stitchCount: quoteData.backStitches,
                    location: 'back'
                }),
                PricingTier: quoteData.tier,
                ImageURL: '',
                AddedAt: addedAt
            };
            items.push(backItem);
        }

        if (quoteData.leftLogoEnabled) {
            const leftItem = {
                QuoteID: quoteID,
                LineNumber: lineNumber++,
                StyleNumber: 'ADD-LOGO',
                ProductName: `Left Side Logo Embroidery (${quoteData.leftStitches.toLocaleString()} stitches)`,
                Color: '',
                ColorCode: '',
                EmbellishmentType: 'embroidery',
                PrintLocation: 'CL',
                PrintLocationName: 'Left Side',
                Quantity: parseInt(quoteData.quantity),
                HasLTM: 'No',
                BaseUnitPrice: 0, // Included in main item pricing
                LTMPerUnit: 0,
                FinalUnitPrice: 0, // Included in main item pricing
                LineTotal: 0,
                SizeBreakdown: JSON.stringify({
                    stitchCount: quoteData.leftStitches,
                    location: 'left'
                }),
                PricingTier: quoteData.tier,
                ImageURL: '',
                AddedAt: addedAt
            };
            items.push(leftItem);
        }

        if (quoteData.rightLogoEnabled) {
            const rightItem = {
                QuoteID: quoteID,
                LineNumber: lineNumber++,
                StyleNumber: 'ADD-LOGO',
                ProductName: `Right Side Logo Embroidery (${quoteData.rightStitches.toLocaleString()} stitches)`,
                Color: '',
                ColorCode: '',
                EmbellishmentType: 'embroidery',
                PrintLocation: 'CR',
                PrintLocationName: 'Right Side',
                Quantity: parseInt(quoteData.quantity),
                HasLTM: 'No',
                BaseUnitPrice: 0, // Included in main item pricing
                LTMPerUnit: 0,
                FinalUnitPrice: 0, // Included in main item pricing
                LineTotal: 0,
                SizeBreakdown: JSON.stringify({
                    stitchCount: quoteData.rightStitches,
                    location: 'right'
                }),
                PricingTier: quoteData.tier,
                ImageURL: '',
                AddedAt: addedAt
            };
            items.push(rightItem);
        }

        // Save each item
        for (const item of items) {
            console.log(`[CapManualQuoteService] Saving item ${item.LineNumber}:`, item.ProductName);
            
            const itemResponse = await fetch(`${this.baseURL}/api/quote_items`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(item)
            });

            const itemResponseText = await itemResponse.text();
            console.log(`[CapManualQuoteService] Item ${item.LineNumber} response:`, itemResponse.status, itemResponseText);

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
     * Build comprehensive size breakdown data for reference
     */
    buildSizeBreakdown(quoteData) {
        return {
            // Manual input data
            manualBlankCost: quoteData.manualBlankCost,
            calculatorType: 'Manual Cap Embroidery',
            
            // Front logo configuration
            frontLogo: {
                stitches: quoteData.frontStitches,
                baseStitches: 8000,
                adjustment: quoteData.frontStitches - 8000,
                adjustmentCost: ((quoteData.frontStitches - 8000) / 1000) * 1.00
            },
            
            // Additional logos
            additionalLogos: {
                back: quoteData.backLogoEnabled ? {
                    enabled: true,
                    stitches: quoteData.backStitches,
                    baseStitches: 5000,
                    adjustment: quoteData.backStitches - 5000,
                    adjustmentCost: ((quoteData.backStitches - 5000) / 1000) * 1.00
                } : { enabled: false },
                left: quoteData.leftLogoEnabled ? {
                    enabled: true,
                    stitches: quoteData.leftStitches,
                    baseStitches: 5000,
                    adjustment: quoteData.leftStitches - 5000,
                    adjustmentCost: ((quoteData.leftStitches - 5000) / 1000) * 1.00
                } : { enabled: false },
                right: quoteData.rightLogoEnabled ? {
                    enabled: true,
                    stitches: quoteData.rightStitches,
                    baseStitches: 5000,
                    adjustment: quoteData.rightStitches - 5000,
                    adjustmentCost: ((quoteData.rightStitches - 5000) / 1000) * 1.00
                } : { enabled: false }
            },
            
            // API data reference (from live pricing system)
            apiDataUsed: {
                tierLabel: quoteData.tier,
                marginDenominator: quoteData.marginDenominator || 0.57, // 2026 margin fallback
                roundingMethod: 'CeilDollar', // Standard for cap embroidery
                baseCost8k: quoteData.apiBaseCost || this.getBaseCost8k(quoteData.tier),
                apiEndpoint: 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/pricing-bundle?method=CAP&styleNumber=MANUAL',
                dataFetchTime: new Date().toISOString()
            },
            
            // Pricing breakdown
            pricing: {
                baseUnitPrice: this.calculateBasePrice(quoteData),
                ltmFeePerUnit: quoteData.hasLTM ? (quoteData.ltmFee / quoteData.quantity) : 0,
                finalUnitPrice: quoteData.unitPrice,
                quantity: quoteData.quantity,
                totalCost: quoteData.totalCost
            },
            
            // Size information (caps typically uniform sizing)
            capSizes: {
                sizeType: 'Uniform Cap Sizing',
                availableSizes: ['S/M', 'M/L', 'L/XL'],
                pricingNote: 'Uniform pricing across all cap sizes'
            }
        };
    }

    /**
     * Fallback method for base cost if API data is not available
     * 2026-02 RESTRUCTURE: New 5-tier system
     */
    getBaseCost8k(tier) {
        // Fallback base costs if API data is not provided (2026 pricing)
        const defaultCosts = {
            '1-7': 12.00,    // LTM tier - $50 setup fee applies
            '8-23': 12.00,   // No LTM, but $4 surcharge baked in
            '24-47': 11.00,
            '48-71': 10.00,
            '72+': 8.50
        };
        return defaultCosts[tier] || 10.00;
    }
}

// Make available globally
window.CapEmbroideryManualQuoteService = CapEmbroideryManualQuoteService;