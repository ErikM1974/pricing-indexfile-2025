/**
 * Screen Print Quote Pricing Calculator
 * Handles all pricing calculations for screen print quotes
 */

class ScreenPrintPricingCalculator {
    constructor() {
        this.pricingService = null;
        this.cachedPricingData = null;
        this.currentStyleNumber = null;
        this.SAFETY_STRIPE_COST = 2.00; // $2.00 per location per unit for safety stripes
        console.log('[ScreenPrintPricingCalculator] Initialized');
        
        // Initialize pricing service if available
        if (window.ScreenPrintPricingService) {
            this.pricingService = new ScreenPrintPricingService();
        }
    }

    /**
     * Load pricing data for a specific style
     */
    async loadPricingData(styleNumber) {
        try {
            if (!this.pricingService) {
                console.error('[ScreenPrintPricingCalculator] Pricing service not available');
                return false;
            }
            
            // Only reload if style changed
            if (this.currentStyleNumber === styleNumber && this.cachedPricingData) {
                console.log('[ScreenPrintPricingCalculator] Using cached pricing data');
                return true;
            }
            
            console.log(`[ScreenPrintPricingCalculator] Loading pricing data for ${styleNumber}`);
            
            // Fetch pricing data
            this.cachedPricingData = await this.pricingService.fetchPricingData(styleNumber);
            this.currentStyleNumber = styleNumber;
            
            if (!this.cachedPricingData) {
                throw new Error('Failed to load pricing data');
            }
            
            // Validate the pricing data structure
            if (!this.cachedPricingData.finalPrices) {
                console.error('[ScreenPrintPricingCalculator] Pricing data missing finalPrices structure');
                throw new Error('Invalid pricing data structure - missing finalPrices');
            }
            
            if (!this.cachedPricingData.tierData) {
                console.warn('[ScreenPrintPricingCalculator] Pricing data missing tierData');
            }
            
            console.log('[ScreenPrintPricingCalculator] Pricing data loaded successfully');
            console.log('[ScreenPrintPricingCalculator] Available tiers:', Object.keys(this.cachedPricingData.tierData || {}));
            
            return true;
            
        } catch (error) {
            console.error('[ScreenPrintPricingCalculator] Error loading pricing data:', error);
            return false;
        }
    }

    /**
     * Calculate pricing for all products in quote
     */
    async calculateQuotePricing(products, printSetup) {
        try {
            const totalQuantity = products.reduce((sum, p) => sum + p.quantity, 0);
            
            console.log(`[ScreenPrintPricingCalculator] Calculating for ${products.length} products, total qty: ${totalQuantity}`);
            
            // Load pricing data for the first product to get tier information
            if (products.length > 0) {
                await this.loadPricingData(products[0].styleNumber);
            }
            
            // Now get the pricing tier after data is loaded
            const pricingTier = this.getPricingTier(totalQuantity);
            
            // Get tier data from API to determine LTM fee
            let currentTierData = null;
            let ltmFeeFromAPI = 0;
            
            if (this.cachedPricingData && this.cachedPricingData.tierData) {
                // Find the current tier based on quantity
                const tierData = this.cachedPricingData.tierData[pricingTier];
                if (tierData) {
                    currentTierData = tierData;
                    ltmFeeFromAPI = parseFloat(tierData.LTM_Fee || 0);
                    console.log(`[ScreenPrintPricingCalculator] Using tier: ${pricingTier}, LTM Fee: $${ltmFeeFromAPI}`);
                } else {
                    console.warn(`[ScreenPrintPricingCalculator] Tier ${pricingTier} not found in tier data`);
                }
            } else {
                console.warn('[ScreenPrintPricingCalculator] No tier data available for LTM fee calculation');
            }
            
            // Calculate pricing for each product
            const pricedProducts = [];
            
            for (const product of products) {
                // Load pricing data for this style
                const dataLoaded = await this.loadPricingData(product.styleNumber);
                
                if (!dataLoaded || !this.cachedPricingData) {
                    console.error(`[ScreenPrintPricingCalculator] No pricing data for ${product.styleNumber}`);
                    // Add product with zero pricing to maintain list integrity
                    pricedProducts.push({
                        ...product,
                        pricedSizes: {},
                        ltmPerUnit: 0,
                        lineTotal: 0,
                        pricingTier: pricingTier,
                        error: 'No pricing data available'
                    });
                    continue;
                }
                
                // Recalculate tier for this specific product's pricing data
                const productTier = this.getPricingTier(totalQuantity);
                console.log(`[ScreenPrintPricingCalculator] Product ${product.styleNumber} using tier: ${productTier}`);
                
                // Calculate prices for each size
                const pricedSizes = {};
                let productTotal = 0;
                
                Object.entries(product.sizeBreakdown).forEach(([size, quantity]) => {
                    if (quantity > 0) {
                        // Get the maximum color count from any location (primary pricing)
                        let maxColorCount = 1;
                        if (printSetup.colorsByLocation && printSetup.locations && printSetup.locations.length > 0) {
                            // Get color count for first location (primary)
                            const primaryLocation = printSetup.locations[0];
                            maxColorCount = printSetup.colorsByLocation[primaryLocation] || 1;
                            
                            // If dark garments, add white underbase
                            if (printSetup.darkGarments && maxColorCount > 0) {
                                maxColorCount += 1;
                            }
                        }
                        
                        let unitPrice = this.calculateUnitPrice(
                            size,
                            productTier,
                            maxColorCount,
                            printSetup.locations || [],
                            printSetup.colorsByLocation || {},
                            printSetup.darkGarments || false
                        );
                        
                        // Add safety stripe cost for each location that has it enabled ($2.00 per location)
                        if (printSetup.safetyStripesByLocation) {
                            let safetyStripeCount = 0;
                            if (printSetup.locations) {
                                printSetup.locations.forEach(location => {
                                    if (printSetup.safetyStripesByLocation[location]) {
                                        safetyStripeCount++;
                                        console.log(`[calculateUnitPrice] Safety stripe enabled for ${location}`);
                                    }
                                });
                            }
                            const safetyStripeCharge = this.SAFETY_STRIPE_COST * safetyStripeCount;
                            unitPrice += safetyStripeCharge;
                            if (safetyStripeCharge > 0) {
                                console.log(`[calculateUnitPrice] Added $${safetyStripeCharge} safety stripe charge (${safetyStripeCount} locations @ $${this.SAFETY_STRIPE_COST} each)`);
                            }
                        } else if (printSetup.safetyStripes) {
                            // Fallback for old global safety stripe setting
                            const numLocations = printSetup.locations ? printSetup.locations.length : 1;
                            unitPrice += this.SAFETY_STRIPE_COST * numLocations;
                        }
                        
                        const lineTotal = unitPrice * quantity;
                        productTotal += lineTotal;
                        
                        pricedSizes[size] = {
                            quantity: quantity,
                            unitPrice: unitPrice,  // Base price without LTM (will be added later)
                            lineTotal: lineTotal
                        };
                    }
                });
                
                // Apply LTM fee if needed (distributed per unit)
                let ltmPerUnit = 0;
                if (ltmFeeFromAPI > 0 && totalQuantity > 0) {
                    ltmPerUnit = ltmFeeFromAPI / totalQuantity;
                    productTotal += ltmPerUnit * product.quantity;
                    
                    // Update pricedSizes to include LTM in unit prices
                    Object.keys(pricedSizes).forEach(size => {
                        if (pricedSizes[size].quantity > 0) {
                            pricedSizes[size].unitPrice += ltmPerUnit;
                            pricedSizes[size].lineTotal = pricedSizes[size].unitPrice * pricedSizes[size].quantity;
                        }
                    });
                }
                
                pricedProducts.push({
                    ...product,
                    pricedSizes: pricedSizes,
                    ltmPerUnit: ltmPerUnit,
                    lineTotal: productTotal,  // Includes LTM fee
                    pricingTier: productTier
                });
            }
            
            // Calculate totals
            const subtotal = pricedProducts.reduce((sum, p) => sum + p.lineTotal, 0);
            
            // Use LTM fee from API tier data
            const ltmFeeTotal = ltmFeeFromAPI;
            
            const setupFeesData = this.calculateSetupFees(printSetup);
            
            // Calculate safety stripe total (already included in subtotal through unit prices)
            let safetyStripeLocationCount = 0;
            if (printSetup.safetyStripesByLocation && printSetup.locations) {
                printSetup.locations.forEach(location => {
                    if (printSetup.safetyStripesByLocation[location]) {
                        safetyStripeLocationCount++;
                    }
                });
            } else if (printSetup.safetyStripes) {
                // Fallback for old global safety stripe setting
                safetyStripeLocationCount = printSetup.locations ? printSetup.locations.length : 1;
            }
            const safetyStripesTotal = safetyStripeLocationCount > 0 ? 
                totalQuantity * this.SAFETY_STRIPE_COST * safetyStripeLocationCount : 0;
            
            // Note: Safety stripe cost is already included in the subtotal 
            // because it was added to unit prices
            // LTM fee is also already included in the subtotal through unit prices
            const grandTotal = subtotal + setupFeesData.total;
            
            console.log('[calculateQuotePricing] Pricing breakdown:', {
                totalQuantity,
                pricingTier: this.getPricingTier(totalQuantity),
                subtotal,
                ltmFeeTotal,
                setupFeesData: setupFeesData,
                safetyStripesTotal,
                grandTotal
            });
            
            return {
                products: pricedProducts,
                totalQuantity: totalQuantity,
                pricingTier: pricingTier,
                subtotal: subtotal,
                ltmFeeTotal: ltmFeeTotal,
                setupFees: setupFeesData.total,
                setupFeesBreakdown: setupFeesData.breakdown,
                setupFeesData: setupFeesData, // Full object for reference
                safetyStripes: safetyStripeLocationCount > 0,
                safetyStripesByLocation: printSetup.safetyStripesByLocation || {},
                safetyStripesTotal: safetyStripesTotal,
                grandTotal: grandTotal
            };
            
        } catch (error) {
            console.error('[ScreenPrintPricingCalculator] Error calculating quote pricing:', error);
            throw error;
        }
    }

    /**
     * Calculate unit price for a specific size
     */
    calculateUnitPrice(size, tier, primaryColorCount, locations, colorsByLocation, darkGarments) {
        if (!this.cachedPricingData || !this.cachedPricingData.finalPrices) {
            console.error('[ScreenPrintPricingCalculator] No cached pricing data available');
            return 0;
        }
        
        const finalPrices = this.cachedPricingData.finalPrices;
        
        // Get primary location price
        let unitPrice = 0;
        
        console.log(`[calculateUnitPrice] Looking for price: tier=${tier}, colors=${primaryColorCount}, size=${size}`);
        
        // Try to find the price with exact size match
        if (finalPrices.PrimaryLocation && 
            finalPrices.PrimaryLocation[tier] && 
            finalPrices.PrimaryLocation[tier][primaryColorCount]) {
            
            // Check if size exists in the data
            if (finalPrices.PrimaryLocation[tier][primaryColorCount][size]) {
                unitPrice = finalPrices.PrimaryLocation[tier][primaryColorCount][size];
                console.log(`[calculateUnitPrice] Found primary location price: $${unitPrice}`);
            } else {
                // Try uppercase version of size
                const upperSize = size.toUpperCase();
                if (finalPrices.PrimaryLocation[tier][primaryColorCount][upperSize]) {
                    unitPrice = finalPrices.PrimaryLocation[tier][primaryColorCount][upperSize];
                    console.log(`[calculateUnitPrice] Found primary location price (uppercase): $${unitPrice}`);
                } else {
                    console.warn(`[calculateUnitPrice] No price found for size ${size}`);
                    console.log('[calculateUnitPrice] Available sizes:', Object.keys(finalPrices.PrimaryLocation[tier][primaryColorCount]));
                }
            }
        } else {
            console.warn(`[calculateUnitPrice] No price structure found for primary location`);
            console.log('[calculateUnitPrice] Available tiers:', Object.keys(finalPrices.PrimaryLocation || {}));
            if (finalPrices.PrimaryLocation && finalPrices.PrimaryLocation[tier]) {
                console.log('[calculateUnitPrice] Available color counts for tier:', Object.keys(finalPrices.PrimaryLocation[tier] || {}));
            }
        }
        
        // Add additional location costs
        if (locations && locations.length > 1) {
            // First location is included in primary price
            for (let i = 1; i < locations.length; i++) {
                const location = locations[i];
                let locationColorCount = colorsByLocation[location] || 1;

                // Add white underbase for dark garments
                if (darkGarments && locationColorCount > 0) {
                    locationColorCount += 1;
                }

                // Use additionalLocationPricing structure (matches calculator)
                // Additional locations use pricePerPiece (no size variation)
                if (this.cachedPricingData.additionalLocationPricing &&
                    this.cachedPricingData.additionalLocationPricing[locationColorCount.toString()]) {

                    const addlPricingData = this.cachedPricingData.additionalLocationPricing[locationColorCount.toString()];
                    if (addlPricingData.tiers) {
                        const tierObj = addlPricingData.tiers.find(t =>
                            quantity >= t.minQty && (!t.maxQty || quantity <= t.maxQty)
                        );
                        if (tierObj && tierObj.pricePerPiece !== undefined) {
                            const additionalPrice = parseFloat(tierObj.pricePerPiece) || 0;
                            if (additionalPrice > 0) {
                                unitPrice += additionalPrice;
                                console.log(`[calculateUnitPrice] Added location ${location} price: $${additionalPrice}`);
                            }
                        }
                    }
                }
            }
        }
        
        console.log(`[calculateUnitPrice] Final unit price: $${unitPrice}`);
        return unitPrice;
    }

    /**
     * Calculate setup fees (screen charges) with detailed breakdown
     */
    calculateSetupFees(printSetup) {
        const screenFeePerColor = 30; // $30 per screen/color (matching existing calculator)
        let totalScreens = 0;
        const breakdown = [];
        
        console.log('[calculateSetupFees] Calculating screens for:', {
            locations: printSetup.locations,
            colorsByLocation: printSetup.colorsByLocation,
            darkGarments: printSetup.darkGarments
        });
        
        // Count total colors across all locations
        if (printSetup.locations && printSetup.locations.length > 0) {
            printSetup.locations.forEach(location => {
                const colors = printSetup.colorsByLocation ? 
                    printSetup.colorsByLocation[location] : 1;
                const colorCount = parseInt(colors || 0);
                let locationScreens = colorCount;
                let underbaseCount = 0;
                
                console.log(`[calculateSetupFees] Location ${location}: ${colorCount} colors`);
                
                // Add white underbase screen if dark garments AND this location has colors
                if (printSetup.darkGarments && colorCount > 0) {
                    locationScreens += 1;
                    underbaseCount = 1;
                    console.log(`[calculateSetupFees] Added underbase for ${location}: colors=${colorCount}, +1 underbase`);
                }
                
                totalScreens += locationScreens;
                
                // Add to breakdown
                const locationSubtotal = locationScreens * screenFeePerColor;
                breakdown.push({
                    location: this.getLocationDisplayName(location),
                    colors: colorCount,
                    underbase: underbaseCount,
                    totalScreens: locationScreens,
                    subtotal: locationSubtotal
                });
                
                console.log(`[calculateSetupFees] ${location} breakdown: ${colorCount} colors + ${underbaseCount} underbase = ${locationScreens} screens × $${screenFeePerColor} = $${locationSubtotal}`);
            });
        } else if (printSetup.primaryColors) {
            // Fallback to primary colors if locations not properly set
            totalScreens = parseInt(printSetup.primaryColors);
            if (printSetup.darkGarments) {
                totalScreens += printSetup.locations ? printSetup.locations.length : 1;
            }
            
            breakdown.push({
                location: 'Total',
                colors: parseInt(printSetup.primaryColors || 1),
                underbase: printSetup.darkGarments ? 1 : 0,
                totalScreens: totalScreens,
                subtotal: totalScreens * screenFeePerColor
            });
        }
        
        const totalFee = totalScreens * screenFeePerColor;
        console.log('[calculateSetupFees] Total screens:', totalScreens, 'Setup fee:', totalFee);
        
        return {
            total: totalFee,
            breakdown: breakdown,
            pricePerScreen: screenFeePerColor,
            totalScreens: totalScreens
        };
    }
    
    /**
     * Get display name for location
     */
    getLocationDisplayName(location) {
        const locationNames = {
            'LC': 'Left Chest',
            'FF': 'Full Front',
            'FB': 'Full Back',
            'JF': 'Jumbo Front',
            'JB': 'Jumbo Back'
        };
        return locationNames[location] || location;
    }

    /**
     * Get pricing tier based on quantity
     */
    getPricingTier(quantity) {
        // Use tier data from API if available
        if (this.cachedPricingData && this.cachedPricingData.tierData) {
            for (const tierLabel in this.cachedPricingData.tierData) {
                const tier = this.cachedPricingData.tierData[tierLabel];
                const minQty = parseInt(tier.MinQuantity);
                const maxQty = tier.MaxQuantity ? parseInt(tier.MaxQuantity) : Infinity;
                
                if (quantity >= minQty && quantity <= maxQty) {
                    console.log(`[getPricingTier] Quantity ${quantity} matches tier: ${tierLabel}`);
                    return tierLabel;
                }
            }
        }
        
        // Fallback to standard tiers if no API data (should not happen)
        console.warn('[getPricingTier] No tier data available, using fallback');
        if (quantity < 24) return '1-23';
        if (quantity < 48) return '24-47';
        if (quantity < 72) return '48-71';
        return '72+';
    }

    /**
     * Format price for display
     */
    formatPrice(price) {
        return `$${price.toFixed(2)}`;
    }

    /**
     * Calculate per-piece savings at current quantity
     */
    calculateSavings(totalQuantity) {
        const currentTier = this.getPricingTier(totalQuantity);
        const nextTierQty = this.getNextTierQuantity(totalQuantity);
        
        if (!nextTierQty) {
            return null; // Already at best tier
        }
        
        // Calculate sample pricing for comparison
        const currentPrice = this.calculateUnitPrice('M', currentTier, 1, []);
        const nextPrice = this.calculateUnitPrice('M', this.getPricingTier(nextTierQty), 1, []);
        
        const savings = currentPrice - nextPrice;
        
        if (savings > 0) {
            return {
                currentTier: currentTier,
                nextTier: this.getPricingTier(nextTierQty),
                quantityNeeded: nextTierQty - totalQuantity,
                savingsPerPiece: savings
            };
        }
        
        return null;
    }

    /**
     * Get next tier quantity threshold
     */
    getNextTierQuantity(currentQuantity) {
        if (currentQuantity < 24) return 24;
        if (currentQuantity < 48) return 48;
        if (currentQuantity < 72) return 72;
        return null; // Already at best tier
    }

    /**
     * Generate pricing breakdown for display
     */
    generatePricingBreakdown(pricingResult) {
        const breakdown = [];
        
        // Products section
        pricingResult.products.forEach(product => {
            const lines = [];
            
            // Group sizes by price
            const priceGroups = {};
            Object.entries(product.pricedSizes).forEach(([size, data]) => {
                const price = data.unitPrice.toFixed(2);
                if (!priceGroups[price]) {
                    priceGroups[price] = [];
                }
                priceGroups[price].push(`${size}(${data.quantity})`);
            });
            
            // Create display lines
            Object.entries(priceGroups).forEach(([price, sizes]) => {
                const totalQty = sizes.reduce((sum, sizeStr) => {
                    const qty = parseInt(sizeStr.match(/\((\d+)\)/)[1]);
                    return sum + qty;
                }, 0);
                
                lines.push({
                    description: sizes.join(' '),
                    unitPrice: parseFloat(price),
                    quantity: totalQty,
                    lineTotal: parseFloat(price) * totalQty
                });
            });
            
            breakdown.push({
                styleNumber: product.styleNumber,
                productName: product.productName,
                color: product.color,
                lines: lines,
                subtotal: product.lineTotal
            });
        });
        
        return breakdown;
    }

    /**
     * Validate pricing data
     */
    validatePricingData() {
        if (!this.cachedPricingData) {
            return { isValid: false, error: 'No pricing data loaded' };
        }
        
        if (!this.cachedPricingData.finalPrices) {
            return { isValid: false, error: 'Invalid pricing data structure' };
        }
        
        return { isValid: true };
    }

    /**
     * Clear cached data
     */
    clearCache() {
        this.cachedPricingData = null;
        this.currentStyleNumber = null;
        console.log('[ScreenPrintPricingCalculator] Cache cleared');
    }

    /**
     * Export pricing summary for email
     */
    exportForEmail(pricingResult) {
        let html = '<div style="font-family: Arial, sans-serif;">';
        
        // Header
        html += '<h3 style="color: #4cb354;">Screen Print Quote Summary</h3>';
        html += `<p>Total Quantity: ${pricingResult.totalQuantity} pieces (${pricingResult.pricingTier} tier)</p>`;
        
        // Products
        html += '<h4>Products:</h4>';
        pricingResult.products.forEach(product => {
            html += `<div style="margin-bottom: 15px;">`;
            html += `<strong>${product.styleNumber} - ${product.productName}</strong><br>`;
            html += `Color: ${product.color}<br>`;
            
            Object.entries(product.pricedSizes).forEach(([size, data]) => {
                html += `${size}: ${data.quantity} @ ${this.formatPrice(data.unitPrice)} = ${this.formatPrice(data.lineTotal)}<br>`;
            });
            
            html += `<strong>Subtotal: ${this.formatPrice(product.lineTotal)}</strong>`;
            html += `</div>`;
        });
        
        // Totals
        html += '<hr style="border: 1px solid #e5e7eb;">';
        html += `<p>Products Subtotal: ${this.formatPrice(pricingResult.subtotal)}</p>`;
        
        if (pricingResult.ltmFeeTotal > 0) {
            html += `<p>Small Batch Fee: ${this.formatPrice(pricingResult.ltmFeeTotal)}</p>`;
        }
        
        if (pricingResult.setupFees > 0) {
            html += `<p>Setup Fees (Screens): ${this.formatPrice(pricingResult.setupFees)}</p>`;
        }
        
        html += `<h3 style="color: #4cb354;">Grand Total: ${this.formatPrice(pricingResult.grandTotal)}</h3>`;
        html += '</div>';
        
        return html;
    }
}

// Make calculator globally available
window.ScreenPrintPricingCalculator = ScreenPrintPricingCalculator;