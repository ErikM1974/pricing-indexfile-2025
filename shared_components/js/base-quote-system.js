// Base Quote System - Flagship Architecture
// Handles cumulative quantity pricing for all embellishment types
// For Northwest Custom Apparel - June 2025

(function() {
    'use strict';

    class BaseQuoteSystem {
        constructor() {
            this.currentQuote = this.initializeQuote();
            this.apiClient = window.quoteAPIClient || null;
            this.cumulativePricing = true; // Enable cumulative pricing by default
            this.pricingCalculator = window.NWCAPricingCalculator || null;
            this.DEBUG_MODE = window.DEBUG_MODE || false;
        }

        // Initialize an empty quote
        initializeQuote() {
            return {
                id: null,
                sessionId: null,
                apiId: null,
                items: [],
                totalQuantity: 0,
                subtotal: 0,
                ltmTotal: 0,
                grandTotal: 0,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
        }

        // Check for existing active quote on page load
        async checkForActiveQuote() {
            if (!this.apiClient) return null;

            try {
                // Get session ID from storage or generate new one
                let sessionId = localStorage.getItem('nwca_quote_session_id');
                
                if (sessionId) {
                    // Try to get existing quote
                    const sessions = await this.apiClient.getQuoteSessions({ sessionID: sessionId });
                    
                    if (sessions && sessions.length > 0) {
                        const activeSession = sessions.find(s => s.Status === 'Active');
                        if (activeSession) {
                            // Load the quote
                            await this.loadQuoteFromAPI(activeSession);
                            return activeSession;
                        }
                    }
                }
                
                return null;
            } catch (error) {
                console.error('[BASE-QUOTE] Error checking for active quote:', error);
                return null;
            }
        }

        // Load quote from API session
        async loadQuoteFromAPI(session) {
            try {
                // Get quote items
                const items = await this.apiClient.getQuoteItems(session.QuoteID);
                
                // Reset current quote
                this.currentQuote = this.initializeQuote();
                this.currentQuote.id = session.QuoteID;
                this.currentQuote.sessionId = session.SessionID;
                this.currentQuote.apiId = session.PK_ID;
                
                // Convert and add items
                for (const apiItem of items) {
                    const localItem = this.convertApiItemToLocal(apiItem);
                    this.currentQuote.items.push(localItem);
                }
                
                // Recalculate all prices with cumulative logic
                await this.recalculateAllPrices();
                
                return this.currentQuote;
            } catch (error) {
                console.error('[BASE-QUOTE] Error loading quote from API:', error);
                throw error;
            }
        }

        // Calculate cumulative pricing for an item
        calculateCumulativePricing(item, existingTotalQuantity = 0) {
            const totalQtyWithItem = existingTotalQuantity + item.quantity;
            const totalQtyWithoutItem = existingTotalQuantity;
            
            // Get pricing tier for total quantity
            const tierWithItem = this.determinePricingTier(totalQtyWithItem);
            const tierWithoutItem = totalQtyWithoutItem > 0 ? this.determinePricingTier(totalQtyWithoutItem) : null;
            
            // Calculate prices
            const priceWithBundle = this.getTierPrice(item, tierWithItem);
            const priceAlone = this.getTierPrice(item, this.determinePricingTier(item.quantity));
            
            // Calculate savings
            const savings = (priceAlone - priceWithBundle) * item.quantity;
            
            return {
                priceAlone: priceAlone,
                priceWithBundle: priceWithBundle,
                savings: savings,
                tierAlone: this.determinePricingTier(item.quantity),
                tierBundle: tierWithItem,
                bundleQuantity: totalQtyWithItem
            };
        }

        // Recalculate all item prices based on cumulative quantity
        async recalculateAllPrices() {
            if (!this.cumulativePricing || this.currentQuote.items.length === 0) {
                this.updateQuoteTotals();
                return;
            }

            const totalQuantity = this.currentQuote.items.reduce((sum, item) => sum + item.quantity, 0);
            const cumulativeTier = this.determinePricingTier(totalQuantity);
            
            if (this.DEBUG_MODE) {
                console.log('[BASE-QUOTE] Recalculating prices for cumulative tier:', cumulativeTier, 'Total Qty:', totalQuantity);
            }

            // Update each item with new cumulative pricing
            for (const item of this.currentQuote.items) {
                const oldPrice = item.baseUnitPrice;
                const newPrice = this.getTierPrice(item, cumulativeTier);
                
                // Store original and cumulative prices
                item.originalUnitPrice = item.originalUnitPrice || oldPrice;
                item.baseUnitPrice = newPrice;
                item.cumulativeTier = cumulativeTier;
                
                // Recalculate totals
                const ltmFee = this.calculateLTMFee(totalQuantity, item.quantity);
                item.ltmPerUnit = ltmFee;
                item.hasLTM = ltmFee > 0;
                
                // Update final price (base + ltm + any add-ons)
                item.finalUnitPrice = item.baseUnitPrice + item.ltmPerUnit + (item.backLogoPrice || 0);
                item.lineTotal = item.finalUnitPrice * item.quantity;
                
                // Store pricing comparison
                item.pricingComparison = {
                    alonePrice: this.getTierPrice(item, this.determinePricingTier(item.quantity)),
                    bundlePrice: newPrice,
                    savings: (item.originalUnitPrice - newPrice) * item.quantity
                };
            }

            // Update quote totals
            this.updateQuoteTotals();
            
            // Update API if connected
            if (this.apiClient && this.currentQuote.apiId) {
                await this.updateQuoteSessionTotals();
            }
        }

        // Get tier price for an item
        getTierPrice(item, tier) {
            // This should be overridden by specific adapters
            // Default implementation uses pricing data if available
            if (window.nwcaPricingData && window.nwcaPricingData.prices) {
                const prices = window.nwcaPricingData.prices;
                // For cap embroidery, usually just "OS" or "One Size"
                const sizeKey = Object.keys(prices)[0];
                if (prices[sizeKey] && prices[sizeKey][tier]) {
                    return prices[sizeKey][tier];
                }
            }
            
            // Fallback pricing
            return this.getFallbackTierPrice(tier);
        }

        // Fallback tier pricing
        getFallbackTierPrice(tier) {
            const fallbackPrices = {
                '1-23': 22.99,
                '24-47': 20.99,
                '48-71': 19.99,
                '72+': 18.99
            };
            return fallbackPrices[tier] || 22.99;
        }

        // Determine pricing tier based on quantity
        determinePricingTier(quantity) {
            if (quantity >= 72) return '72+';
            if (quantity >= 48) return '48-71';
            if (quantity >= 24) return '24-47';
            return '1-23';
        }

        // Calculate LTM fee based on total quantity
        calculateLTMFee(totalQuantity, itemQuantity) {
            if (totalQuantity >= 24) return 0;
            
            // LTM fee is $50 total, distributed across items
            const ltmTotal = 50;
            return ltmTotal / totalQuantity;
        }

        // Update quote totals
        updateQuoteTotals() {
            let subtotal = 0;
            let totalQuantity = 0;
            let ltmTotal = 0;

            this.currentQuote.items.forEach(item => {
                subtotal += item.lineTotal;
                totalQuantity += item.quantity;
                if (item.hasLTM) {
                    ltmTotal += item.ltmPerUnit * item.quantity;
                }
            });

            this.currentQuote.subtotal = subtotal;
            this.currentQuote.totalQuantity = totalQuantity;
            this.currentQuote.ltmTotal = ltmTotal;
            this.currentQuote.grandTotal = subtotal; // LTM is already included in line totals
            this.currentQuote.updatedAt = new Date().toISOString();
        }

        // Show bundle savings display
        showBundleSavings(currentItem, currentItemPrice) {
            const existingQuantity = this.currentQuote.totalQuantity;
            const cumulativePricing = this.calculateCumulativePricing(currentItem, existingQuantity);
            
            if (cumulativePricing.savings > 0) {
                return {
                    showSavings: true,
                    alonePrice: cumulativePricing.priceAlone,
                    bundlePrice: cumulativePricing.priceWithBundle,
                    savings: cumulativePricing.savings,
                    bundleQuantity: cumulativePricing.bundleQuantity,
                    message: `Bundle with existing ${existingQuantity} items for better pricing!`
                };
            }
            
            return {
                showSavings: false,
                message: ''
            };
        }

        // Convert API item to local format (to be overridden by adapters)
        convertApiItemToLocal(apiItem) {
            // Basic conversion - adapters should override for specific fields
            return {
                id: 'item_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
                apiId: apiItem.PK_ID,
                lineNumber: apiItem.LineNumber,
                styleNumber: apiItem.StyleNumber,
                productName: apiItem.ProductName,
                color: apiItem.Color,
                colorCode: apiItem.ColorCode,
                quantity: apiItem.Quantity,
                baseUnitPrice: apiItem.BaseUnitPrice || 0,
                ltmPerUnit: apiItem.LTMPerUnit || 0,
                finalUnitPrice: apiItem.FinalUnitPrice || 0,
                lineTotal: apiItem.LineTotal || 0,
                hasLTM: apiItem.HasLTM === 'Yes',
                sizeBreakdown: apiItem.SizeBreakdown ? JSON.parse(apiItem.SizeBreakdown) : {},
                pricingTier: apiItem.PricingTier,
                imageURL: apiItem.ImageURL,
                addedAt: apiItem.AddedAt
            };
        }

        // Update quote session totals in API
        async updateQuoteSessionTotals() {
            if (!this.apiClient) return;
            
            // Check if we have a valid API ID
            if (!this.currentQuote.apiId || this.currentQuote.apiId === 'records' || !this.currentQuote.id || this.currentQuote.id.startsWith('LOCAL_')) {
                if (this.DEBUG_MODE) {
                    console.log('[BASE-QUOTE] Skipping API update - no valid session');
                }
                return;
            }
            
            try {
                const updates = {
                    TotalQuantity: this.currentQuote.totalQuantity,
                    SubtotalAmount: this.currentQuote.subtotal,
                    LTMFeeTotal: this.currentQuote.ltmTotal,
                    TotalAmount: this.currentQuote.grandTotal,
                    UpdatedAt: new Date().toISOString()
                };
                
                await this.apiClient.updateQuoteSession(this.currentQuote.apiId, updates);
                
                if (this.DEBUG_MODE) {
                    console.log('[BASE-QUOTE] Quote session totals updated');
                }
            } catch (error) {
                console.error('[BASE-QUOTE] Failed to update quote session totals:', error);
                // Don't throw, just log the error
            }
        }

        // Add item to quote with cumulative pricing
        async addItemToQuote(item) {
            console.log('[BASE-QUOTE] addItemToQuote called with:', item);
            
            // Calculate cumulative pricing before adding
            const cumulativePricing = this.calculateCumulativePricing(item, this.currentQuote.totalQuantity);
            
            console.log('[BASE-QUOTE] Cumulative pricing calculated:', cumulativePricing);
            
            // Store pricing comparison
            item.pricingComparison = {
                alonePrice: cumulativePricing.priceAlone,
                bundlePrice: cumulativePricing.priceWithBundle,
                savings: cumulativePricing.savings
            };
            
            // Add to quote
            this.currentQuote.items.push(item);
            
            console.log('[BASE-QUOTE] Item added. Total items:', this.currentQuote.items.length);
            console.log('[BASE-QUOTE] Current quote state:', this.currentQuote);
            
            // Recalculate all prices
            await this.recalculateAllPrices();
            
            return item;
        }

        // Remove item and recalculate prices
        async removeItem(itemId) {
            const index = this.currentQuote.items.findIndex(item => item.id === itemId);
            if (index > -1) {
                this.currentQuote.items.splice(index, 1);
                
                // Recalculate all prices
                await this.recalculateAllPrices();
            }
        }
    }

    // Export to global scope
    window.BaseQuoteSystem = BaseQuoteSystem;

})();