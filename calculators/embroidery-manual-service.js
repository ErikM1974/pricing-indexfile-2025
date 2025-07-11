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
     */
    getPricingTier(quantity) {
        // This should match the live tier data from the API
        if (quantity < 24) return '1-23';
        if (quantity < 48) return '24-47';
        if (quantity < 72) return '48-71';
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
     * Build comprehensive size breakdown data for reference
     */
    buildSizeBreakdown(quoteData) {
        return {
            // Manual input data
            manualBlankCost: quoteData.manualBlankCost,
            calculatorType: 'Manual Embroidery (Flat Items)',
            
            // Front logo configuration (8K base with ±$1.25 per thousand)
            frontLogo: {
                stitches: quoteData.frontStitches,
                roundedStitches: Math.ceil(quoteData.frontStitches / 1000) * 1000,
                baseStitches: 8000,
                adjustment: Math.ceil(quoteData.frontStitches / 1000) * 1000 - 8000,
                adjustmentCost: ((Math.ceil(quoteData.frontStitches / 1000) * 1000 - 8000) / 1000) * 1.25,
                pricingMethod: 'base_plus_adjustment' // 8K included, adjust up/down
            },
            
            // Additional logos (matches live page pricing: stitches / 1000 * $1.25)
            additionalLogos: {
                logo1: quoteData.logo1Enabled ? {
                    enabled: true,
                    stitches: quoteData.logo1Stitches,
                    roundedStitches: Math.ceil(quoteData.logo1Stitches / 1000) * 1000,
                    pricePerThousand: 1.25,
                    totalCost: (Math.ceil(quoteData.logo1Stitches / 1000) * 1.25),
                    pricingMethod: 'straight_per_thousand' // No base fee
                } : { enabled: false },
                logo2: quoteData.logo2Enabled ? {
                    enabled: true,
                    stitches: quoteData.logo2Stitches,
                    roundedStitches: Math.ceil(quoteData.logo2Stitches / 1000) * 1000,
                    pricePerThousand: 1.25,
                    totalCost: (Math.ceil(quoteData.logo2Stitches / 1000) * 1.25),
                    pricingMethod: 'straight_per_thousand' // No base fee
                } : { enabled: false },
                logo3: quoteData.logo3Enabled ? {
                    enabled: true,
                    stitches: quoteData.logo3Stitches,
                    roundedStitches: Math.ceil(quoteData.logo3Stitches / 1000) * 1000,
                    pricePerThousand: 1.25,
                    totalCost: (Math.ceil(quoteData.logo3Stitches / 1000) * 1.25),
                    pricingMethod: 'straight_per_thousand' // No base fee
                } : { enabled: false }
            },
            
            // API data reference (from live pricing system)
            apiDataUsed: {
                tierLabel: quoteData.tier,
                marginDenominator: quoteData.marginDenominator || 0.6,
                roundingMethod: 'CeilDollar', // Standard for embroidery
                baseCost8k: quoteData.apiBaseCost || this.getBaseCost8k(quoteData.tier),
                apiEndpoint: 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/pricing-bundle?method=EMB&styleNumber=MANUAL',
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
            
            // Size information (garments have various sizes)
            garmentSizes: {
                sizeType: 'Standard Garment Sizing',
                availableSizes: ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL', '6XL'],
                pricingNote: 'Uniform pricing across all garment sizes'
            }
        };
    }

    /**
     * Fallback method for base cost if API data is not available
     */
    getBaseCost8k(tier) {
        // Fallback base costs if API data is not provided
        const defaultCosts = {
            '1-23': 10.50,
            '24-47': 9.50,
            '48-71': 8.75,
            '72+': 8.00
        };
        return defaultCosts[tier] || 9.50;
    }
}

// Make available globally
window.EmbroideryManualQuoteService = EmbroideryManualQuoteService;