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
            
            console.log('[ScreenPrintPricingCalculator] Pricing data loaded successfully');
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
            const pricingTier = this.getPricingTier(totalQuantity);
            
            console.log(`[ScreenPrintPricingCalculator] Calculating for ${products.length} products, total qty: ${totalQuantity}`);
            
            // Calculate pricing for each product
            const pricedProducts = [];
            
            for (const product of products) {
                // Load pricing data for this style
                await this.loadPricingData(product.styleNumber);
                
                if (!this.cachedPricingData) {
                    console.error(`[ScreenPrintPricingCalculator] No pricing data for ${product.styleNumber}`);
                    continue;
                }
                
                // Calculate prices for each size
                const pricedSizes = {};
                let productTotal = 0;
                
                Object.entries(product.sizeBreakdown).forEach(([size, quantity]) => {
                    if (quantity > 0) {
                        let unitPrice = this.calculateUnitPrice(
                            size,
                            pricingTier,
                            printSetup.primaryColors || 1,
                            printSetup.locations || []
                        );
                        
                        // Add safety stripe cost if enabled ($2.00 per location)
                        if (printSetup.safetyStripes) {
                            const numLocations = printSetup.locations ? printSetup.locations.length : 1;
                            unitPrice += this.SAFETY_STRIPE_COST * numLocations;
                        }
                        
                        const lineTotal = unitPrice * quantity;
                        productTotal += lineTotal;
                        
                        pricedSizes[size] = {
                            quantity: quantity,
                            unitPrice: unitPrice,
                            lineTotal: lineTotal
                        };
                    }
                });
                
                // Apply LTM fee if needed
                let ltmPerUnit = 0;
                if (totalQuantity < 24) {
                    ltmPerUnit = 50 / totalQuantity;
                    productTotal += ltmPerUnit * product.quantity;
                }
                
                pricedProducts.push({
                    ...product,
                    pricedSizes: pricedSizes,
                    ltmPerUnit: ltmPerUnit,
                    lineTotal: productTotal,
                    pricingTier: pricingTier
                });
            }
            
            // Calculate totals
            const subtotal = pricedProducts.reduce((sum, p) => sum + p.lineTotal, 0);
            const ltmFeeTotal = totalQuantity < 24 ? 50 : 0;
            const setupFees = this.calculateSetupFees(printSetup);
            
            // Calculate safety stripe total (already included in subtotal through unit prices)
            const numLocations = printSetup.locations ? printSetup.locations.length : 1;
            const safetyStripesTotal = printSetup.safetyStripes ? 
                totalQuantity * this.SAFETY_STRIPE_COST * numLocations : 0;
            
            // Note: Safety stripe cost is already included in the subtotal 
            // because it was added to unit prices
            const grandTotal = subtotal + setupFees;
            
            return {
                products: pricedProducts,
                totalQuantity: totalQuantity,
                pricingTier: pricingTier,
                subtotal: subtotal,
                ltmFeeTotal: ltmFeeTotal,
                setupFees: setupFees,
                safetyStripes: printSetup.safetyStripes || false,
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
    calculateUnitPrice(size, tier, colorCount, locations) {
        if (!this.cachedPricingData || !this.cachedPricingData.finalPrices) {
            console.error('[ScreenPrintPricingCalculator] No cached pricing data available');
            return 0;
        }
        
        const finalPrices = this.cachedPricingData.finalPrices;
        
        // Get primary location price
        let unitPrice = 0;
        
        if (finalPrices.PrimaryLocation && 
            finalPrices.PrimaryLocation[tier] && 
            finalPrices.PrimaryLocation[tier][colorCount] &&
            finalPrices.PrimaryLocation[tier][colorCount][size]) {
            
            unitPrice = finalPrices.PrimaryLocation[tier][colorCount][size];
        }
        
        // Add additional location costs
        if (locations && locations.length > 1) {
            // First location is included in primary price
            for (let i = 1; i < locations.length; i++) {
                const locationColorCount = locations[i].colors || colorCount;
                
                if (finalPrices.AdditionalLocation &&
                    finalPrices.AdditionalLocation[tier] &&
                    finalPrices.AdditionalLocation[tier][locationColorCount] &&
                    finalPrices.AdditionalLocation[tier][locationColorCount][size]) {
                    
                    unitPrice += finalPrices.AdditionalLocation[tier][locationColorCount][size];
                }
            }
        }
        
        return unitPrice;
    }

    /**
     * Calculate setup fees (screen charges)
     */
    calculateSetupFees(printSetup) {
        const screenFeePerColor = 25; // $25 per screen/color
        let totalScreens = 0;
        
        // Count screens for primary location
        if (printSetup.primaryColors) {
            totalScreens += parseInt(printSetup.primaryColors);
        }
        
        // Count screens for additional locations
        if (printSetup.locations && printSetup.locations.length > 1) {
            printSetup.locations.slice(1).forEach(location => {
                totalScreens += parseInt(location.colors || printSetup.primaryColors);
            });
        }
        
        return totalScreens * screenFeePerColor;
    }

    /**
     * Get pricing tier based on quantity
     */
    getPricingTier(quantity) {
        // Standard screen print tiers
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