/**
 * Screen Print ShopWorks Data Entry Guide Generator
 * Extends the base ShopWorksGuideGenerator for screen print-specific features
 *
 * Key Features:
 * - Uses parent class multi-line sizing (oversize suffixes: _2X, _3X, _4X)
 * - Adds SPSU (Screen Print Setup) line items: $30.00 per setup
 * - Adds SPRESET (Screen Print Reset) line items: $25.00 per reset
 * - Enhances descriptions with print location details
 * - Includes 10.1% Milton, WA sales tax
 */

class ScreenPrintShopWorksGuideGenerator extends ShopWorksGuideGenerator {
    constructor() {
        super();
        console.log('[ScreenPrintShopWorksGuide] Generator initialized');
    }

    /**
     * Parse quote data into ShopWorks line items
     * Uses parent class for standard product parsing (handles oversize suffixes correctly)
     * Adds screen print specific line items (SPSU, SPRESET)
     */
    parseQuoteIntoLineItems(quoteData) {
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🏭 SHOPWORKS GENERATOR - PARSING QUOTE DATA');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('[ScreenPrintShopWorksGuide] Received quoteData:', quoteData);
        console.log('[ScreenPrintShopWorksGuide] TotalColors:', quoteData.TotalColors);
        console.log('[ScreenPrintShopWorksGuide] SetupBreakdown:', quoteData.SetupBreakdown);
        console.log('[ScreenPrintShopWorksGuide] Products count:', quoteData.products?.length);

        if (quoteData.products && quoteData.products.length > 0) {
            quoteData.products.forEach((product, index) => {
                console.log(`[ScreenPrintShopWorksGuide] Product [${index}]:`, {
                    StyleNumber: product.StyleNumber,
                    Color: product.Color,
                    SizeBreakdown: product.SizeBreakdown,
                    Quantity: product.Quantity,
                    BaseUnitPrice: product.BaseUnitPrice,
                    FinalUnitPrice: product.FinalUnitPrice,
                    LineTotal: product.LineTotal
                });
            });
        }

        // Initialize items array - SPSU must be FIRST
        const items = [];

        // FIX #1: Add SPSU (Screen Print Setup) line item FIRST
        console.log('[ScreenPrintShopWorksGuide] Checking for SPSU setup line item...');
        console.log('[ScreenPrintShopWorksGuide] quoteData.TotalColors:', quoteData.TotalColors);
        console.log('[ScreenPrintShopWorksGuide] Condition (TotalColors > 0):', quoteData.TotalColors && quoteData.TotalColors > 0);

        if (quoteData.TotalColors && quoteData.TotalColors > 0) {
            const setupCount = this.calculateSetupCount(quoteData);
            const setupTotal = setupCount * 30.00;

            console.log('✅ [ScreenPrintShopWorksGuide] Adding SPSU line item as FIRST line');
            console.log('[ScreenPrintShopWorksGuide] Setup count:', setupCount, 'setups');
            console.log('[ScreenPrintShopWorksGuide] Setup total: $', setupTotal);

            // FIX #2: Put quantity in S (Small) column, not lineQty
            const spsuItem = {
                lineQty: '',  // FIXED: Blank for setup items
                partNumber: 'SPSU',
                colorRange: '',
                color: '',
                description: this.formatSetupDescription(quoteData),
                sizes: {
                    S: setupCount,  // FIXED: Quantity goes in S column
                    M: '',
                    LG: '',
                    XL: '',
                    XXL: '',
                    XXXL: ''
                },
                manualPrice: 30.00,
                calcPrice: 'Off',
                lineTotal: setupTotal
            };

            console.log('[ScreenPrintShopWorksGuide] SPSU item object:', spsuItem);
            console.log('[ScreenPrintShopWorksGuide] SPSU quantity in S column:', spsuItem.sizes.S);
            items.push(spsuItem);  // Add as first item
        } else {
            console.error('❌ [ScreenPrintShopWorksGuide] SPSU line item NOT added - TotalColors is 0 or undefined');
        }

        // Get standard product lines from parent class (added AFTER SPSU)
        // This handles:
        // - Separating standard sizes (S/M/L/XL) on one line
        // - Creating separate lines for oversizes with suffixes (_2X, _3X, _4X)
        console.log('[ScreenPrintShopWorksGuide] Calling parent parseQuoteIntoLineItems...');
        const productItems = super.parseQuoteIntoLineItems(quoteData);

        console.log('[ScreenPrintShopWorksGuide] Parent class returned', productItems.length, 'product lines');
        productItems.forEach((item, index) => {
            console.log(`[ScreenPrintShopWorksGuide] Product Line [${index}]:`, {
                partNumber: item.partNumber,
                lineQty: item.lineQty,
                manualPrice: item.manualPrice,
                calcPrice: item.calcPrice,
                lineTotal: item.lineTotal
            });
        });

        // Enhance product descriptions with print location info
        // Example: "Port & Co Tee" → "Port & Co Tee + Full Front (3c) + Full Back (2c)"
        productItems.forEach(item => {
            if (item.partNumber &&
                item.partNumber !== 'SPSU' &&
                item.partNumber !== 'SPRESET') {
                const enhancedDesc = this.enhanceDescription(item.description, quoteData);
                if (enhancedDesc !== item.description) {
                    console.log('[ScreenPrintShopWorksGuide] Enhanced description:', item.description, '→', enhancedDesc);
                    item.description = enhancedDesc;
                }
            }
        });

        // Add product lines AFTER SPSU
        items.push(...productItems);

        // Add SPRESET (Screen Print Reset) line item if needed
        if (quoteData.ScreenResetCount && quoteData.ScreenResetCount > 0) {
            const resetTotal = quoteData.ScreenResetCount * 25.00;

            console.log('[ScreenPrintShopWorksGuide] Adding SPRESET:', quoteData.ScreenResetCount, 'resets @ $25.00 =', resetTotal);

            items.push({
                lineQty: quoteData.ScreenResetCount,
                partNumber: 'SPRESET',
                colorRange: '',
                color: '',
                description: 'Screen Reset Charge',
                sizes: { S: '', M: '', LG: '', XL: '', XXL: '', XXXL: '' },
                manualPrice: 25.00,
                calcPrice: 'Off',
                lineTotal: resetTotal
            });
        }

        console.log('[ScreenPrintShopWorksGuide] Final line items:', items.length, 'total lines');
        console.log('[ScreenPrintShopWorksGuide] Final items array:', items);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        return items;
    }

    /**
     * Calculate number of SPSU (Screen Print Setup) charges
     * Formula: Sum of screens per location (each location's colors = that many screens)
     *
     * Example: Front 4 colors (3 ink + 1 underbase) + Back 4 colors (3 ink + 1 underbase) = 8 SPSU
     * NOT: 6 total colors × 2 locations = 12 (WRONG!)
     */
    calculateSetupCount(quoteData) {
        let setupCount = 0;
        const locationBreakdown = [];

        // Sum up screens per location (each location's colors = that many screens)
        if (quoteData.SetupBreakdown) {
            Object.entries(quoteData.SetupBreakdown).forEach(([location, data]) => {
                const colors = typeof data === 'number' ? data : data.colors;
                setupCount += colors;
                locationBreakdown.push({location, screens: colors});
                console.log(`  ${location}: ${colors} screens`);
            });
        }

        console.log('[ScreenPrintShopWorksGuide] SPSU calculation:', {
            locationBreakdown,
            totalScreens: setupCount,
            setupFee: `${setupCount} × $30 = $${setupCount * 30}`,
            breakdown: quoteData.SetupBreakdown
        });

        return setupCount;
    }

    /**
     * Format SPSU description with color breakdown
     * Shows total colors and breakdown by location
     * NOTE: Safety stripes are NOT shown here (they're a design feature, not a setup charge)
     *
     * Example: "New Screen Set Up Charge: 8 colors (Front: 4c, back: 4c)"
     */
    formatSetupDescription(quoteData) {
        if (!quoteData.SetupBreakdown || !quoteData.TotalColors) {
            return 'New Screen Set Up Charge';
        }

        // Build location breakdown string (colors only, no design features)
        const breakdown = Object.entries(quoteData.SetupBreakdown)
            .map(([location, data]) => {
                // Handle both old format (just number) and new format (object with colors + hasSafetyStripes)
                const colors = typeof data === 'number' ? data : data.colors;

                // Just colors - safety stripes is a design feature, not a setup charge
                return `${location}: ${colors}c`;
            })
            .join(', ');

        return `New Screen Set Up Charge: ${quoteData.TotalColors} colors (${breakdown})`;
    }

    /**
     * Enhance product description with print location details and safety stripes
     *
     * Example transformations:
     * "Port & Co Tee" → "Port & Co Tee + Full Front (3c) + Full Back (2c)"
     * "Port & Co Tee" → "Port & Co Tee + Full Front (3c + Safety Stripes) + Full Back (2c)"
     * "PC450 Dark Heather" → "PC450 Dark Heather + Left Chest (1c)"
     */
    enhanceDescription(baseDescription, quoteData) {
        // If no setup breakdown, return base description unchanged
        if (!quoteData.SetupBreakdown || Object.keys(quoteData.SetupBreakdown).length === 0) {
            return baseDescription;
        }

        // Build location details string with safety stripes info
        // Example: "Full Front (3c + Safety Stripes) + Full Back (2c)"
        const locationDetails = Object.entries(quoteData.SetupBreakdown)
            .map(([location, data]) => {
                // Handle both old format (just number) and new format (object with colors + hasSafetyStripes)
                const colors = typeof data === 'number' ? data : data.colors;
                const hasSafetyStripes = typeof data === 'object' ? data.hasSafetyStripes : false;

                // Build location string with optional safety stripes marker
                return `${location} (${colors}c${hasSafetyStripes ? ' + Safety Stripes' : ''})`;
            })
            .join(' + ');

        // Combine base description with location details
        return `${baseDescription} + ${locationDetails}`;
    }
}

// Log when service loads
console.log('[ScreenPrintShopWorksGuide] Service loaded successfully');
