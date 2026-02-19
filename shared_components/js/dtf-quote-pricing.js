/**
 * DTF Quote Pricing - CONSOLIDATED MODULE (100% API-DRIVEN)
 *
 * This file combines:
 * - DTFConfig (location configuration ONLY - no pricing)
 * - DTFPricingService (API fetching - NO FALLBACKS)
 * - DTFQuotePricing (calculation logic)
 *
 * ⚠️ SHARED COMPONENT - USED BY DTF QUOTE BUILDER
 * ⚠️ ALL PRICING DATA COMES FROM API - NO HARDCODED VALUES
 *
 * If API fails, pricing is blocked entirely to prevent wrong quotes.
 *
 * Pricing Formula:
 * Price Per Piece = ROUND_UP_HALF_DOLLAR(
 *     (GarmentCost / MarginDenominator)     // From Pricing_Tiers API
 *     + SUM(TransferCosts per location)     // From DTF_Pricing API
 *     + (PressingLaborCost × LocationCount) // From DTF_Pricing API
 *     + (FreightPerTransfer × LocationCount)// From Transfer_Freight API
 *     + (LTM_Fee / Quantity)                // From Pricing_Tiers API
 * )
 */

// ============================================================================
// CONFIGURATION (Location mappings only - NO PRICING VALUES)
// ============================================================================

const DTFConfig = {
    // Transfer size definitions (dimensions only - pricing comes from API)
    transferSizes: {
        'small': {
            name: 'Up to 5" x 5"',
            displayName: 'Small (Up to 5" x 5")',
            maxWidth: 5,
            maxHeight: 5
            // NO pricingTiers - comes from API
        },
        'medium': {
            name: 'Up to 9" x 12"',
            displayName: 'Medium (Up to 9" x 12")',
            maxWidth: 9,
            maxHeight: 12
            // NO pricingTiers - comes from API
        },
        'large': {
            name: 'Up to 12" x 16.5"',
            displayName: 'Large (Up to 12" x 16.5")',
            maxWidth: 12,
            maxHeight: 16.5
            // NO pricingTiers - comes from API
        }
    },

    // Transfer location options - Location = Size model (each location locked to one size)
    transferLocations: [
        // Small locations (5" x 5")
        { value: 'left-chest', label: 'Left Chest', size: 'small', zone: 'front' },
        { value: 'right-chest', label: 'Right Chest', size: 'small', zone: 'front' },
        { value: 'left-sleeve', label: 'Left Sleeve', size: 'small', zone: 'sleeve-left' },
        { value: 'right-sleeve', label: 'Right Sleeve', size: 'small', zone: 'sleeve-right' },
        { value: 'back-of-neck', label: 'Back of Neck', size: 'small', zone: 'back' },

        // Medium locations (9" x 12")
        { value: 'center-front', label: 'Center Front', size: 'medium', zone: 'front' },
        { value: 'center-back', label: 'Center Back', size: 'medium', zone: 'back' },

        // Large locations (12" x 16.5")
        { value: 'full-front', label: 'Full Front', size: 'large', zone: 'front' },
        { value: 'full-back', label: 'Full Back', size: 'large', zone: 'back' }
    ],

    // Conflict zones for mutually exclusive locations
    conflictZones: {
        front: ['left-chest', 'right-chest', 'center-front', 'full-front'],
        back: ['back-of-neck', 'center-back', 'full-back']
        // Sleeves are independent - no conflicts
    },

    // System settings (non-pricing only)
    settings: {
        maxTransferLocations: 8,
        minQuantity: 10,
        defaultQuantity: 24
        // NO pricing values - all come from API
    },

    // Helper functions (location lookups only - no pricing)
    helpers: {
        getSizeForLocation: function(locationValue) {
            const location = DTFConfig.transferLocations.find(l => l.value === locationValue);
            return location ? location.size : null;
        },

        getConflictingLocations: function(locationValue) {
            const location = DTFConfig.transferLocations.find(l => l.value === locationValue);
            if (!location || !location.zone) return [];
            const zone = location.zone;
            if (!DTFConfig.conflictZones[zone]) return [];
            return DTFConfig.conflictZones[zone].filter(loc => loc !== locationValue);
        },

        getLocationsBySize: function(sizeKey) {
            return DTFConfig.transferLocations.filter(l => l.size === sizeKey);
        }
    }
};

// Make config available globally
window.DTFConfig = DTFConfig;


// ============================================================================
// QUOTE PRICING CALCULATOR
// (DTFPricingService is now loaded from /shared_components/js/dtf-pricing-service.js
//  via a <script> tag in dtf-quote-builder.html before this file)
// ============================================================================

class DTFQuotePricing {
    constructor() {
        this.pricingService = new DTFPricingService();
        this.pricingData = null;
        this.isLoaded = false;
        this.productCache = new Map();
        console.log('[DTFQuotePricing] Pricing calculator initialized');
    }

    async loadPricingData(styleNumber = null) {
        try {
            console.log('[DTFQuotePricing] Loading pricing data from API...');
            this.pricingData = await this.pricingService.fetchPricingData(styleNumber);
            this.isLoaded = true;
            console.log('[DTFQuotePricing] Pricing data loaded');
            return this.pricingData;
        } catch (error) {
            console.error('[DTFQuotePricing] Failed to load pricing data:', error);
            throw new Error('Unable to load DTF pricing data. Please refresh and try again.');
        }
    }

    async ensureLoaded() {
        if (!this.isLoaded) {
            await this.loadPricingData();
        }
        return this.pricingData;
    }

    /**
     * Get tier label for quantity - REQUIRES API DATA
     * @throws {Error} if API data not loaded
     */
    getTierForQuantity(quantity) {
        if (!this.pricingData?.pricingTiers) {
            throw new Error('Pricing data not loaded - cannot determine tier');
        }
        const tier = this.pricingData.pricingTiers.find(
            t => quantity >= t.minQuantity && quantity <= t.maxQuantity
        );
        if (!tier) {
            throw new Error(`No pricing tier found for quantity ${quantity}`);
        }
        return tier.tierLabel;
    }

    /**
     * Get full tier data for quantity - REQUIRES API DATA
     * @throws {Error} if API data not loaded
     */
    getTierData(quantity) {
        if (!this.pricingData?.pricingTiers) {
            throw new Error('Pricing data not loaded - cannot get tier data');
        }
        const tier = this.pricingData.pricingTiers.find(
            t => quantity >= t.minQuantity && quantity <= t.maxQuantity
        );
        if (!tier) {
            throw new Error(`No pricing tier found for quantity ${quantity}`);
        }
        return tier;
    }

    calculateLTMPerUnit(aggregateQuantity) {
        const tierData = this.getTierData(aggregateQuantity);
        const ltmFee = tierData.ltmFee || 0;
        if (ltmFee > 0 && aggregateQuantity > 0) {
            return Math.floor((ltmFee / aggregateQuantity) * 100) / 100;
        }
        return 0;
    }

    getTransferCostForLocation(locationCode, quantity) {
        const sizeKey = DTFConfig.helpers.getSizeForLocation(locationCode);
        if (!sizeKey) {
            console.warn(`[DTFQuotePricing] Unknown location: ${locationCode}`);
            return 0;
        }
        return this.pricingService.getTransferPrice(sizeKey, quantity);
    }

    calculateTransferCosts(selectedLocations, quantity) {
        const breakdown = [];
        let total = 0;

        selectedLocations.forEach(locationCode => {
            const sizeKey = DTFConfig.helpers.getSizeForLocation(locationCode);
            const locationInfo = DTFConfig.transferLocations.find(l => l.value === locationCode);
            const transferCost = this.getTransferCostForLocation(locationCode, quantity);

            breakdown.push({
                location: locationCode,
                locationName: locationInfo?.label || locationCode,
                size: sizeKey,
                sizeName: DTFConfig.transferSizes[sizeKey]?.displayName || sizeKey,
                unitCost: transferCost
            });

            total += transferCost;
        });

        return { breakdown, total };
    }

    getLaborCostPerLocation() {
        return this.pricingService.getLaborCostPerLocation();
    }

    getFreightPerTransfer(quantity) {
        return this.pricingService.getFreightPerTransfer(quantity);
    }

    getMarginDenominator(quantity) {
        return this.pricingService.getMarginDenominator(quantity);
    }

    applyRounding(price) {
        return this.pricingService.applyRounding(price);
    }

    /**
     * Calculate unit price for a garment - REQUIRES API DATA
     * @throws {Error} if API data not loaded
     */
    calculateUnitPrice(garmentCost, selectedLocations, aggregateQuantity) {
        const tierData = this.getTierData(aggregateQuantity);
        const tierLabel = this.getTierForQuantity(aggregateQuantity);
        const locationCount = selectedLocations.length;

        // marginDenominator comes from API - no fallback
        const marginDenominator = tierData.marginDenominator;
        const garmentWithMargin = garmentCost / marginDenominator;

        const transferBreakdown = this.calculateTransferCosts(selectedLocations, aggregateQuantity);
        const totalTransferCost = transferBreakdown.total;

        const laborCostPerLoc = this.getLaborCostPerLocation();
        const totalLaborCost = laborCostPerLoc * locationCount;

        const freightPerTransfer = this.getFreightPerTransfer(aggregateQuantity);
        const totalFreightCost = freightPerTransfer * locationCount;

        const ltmPerUnit = this.calculateLTMPerUnit(aggregateQuantity);

        const subtotalBeforeRounding =
            garmentWithMargin +
            totalTransferCost +
            totalLaborCost +
            totalFreightCost +
            ltmPerUnit;

        const finalUnitPrice = this.applyRounding(subtotalBeforeRounding);

        return {
            garmentCost,
            garmentWithMargin,
            marginDenominator,
            transferBreakdown,
            totalTransferCost,
            laborCostPerLocation: laborCostPerLoc,
            totalLaborCost,
            freightPerTransfer,
            totalFreightCost,
            ltmFee: tierData.ltmFee || 0,
            ltmPerUnit,
            subtotalBeforeRounding,
            finalUnitPrice,
            tierLabel,
            locationCount,
            hasLTM: ltmPerUnit > 0
        };
    }

    calculateProductPricing(product, selectedLocations, aggregateQuantity) {
        const sizeGroups = [];
        let productSubtotal = 0;
        let productQuantity = 0;

        const tierLabel = this.getTierForQuantity(aggregateQuantity);
        const ltmPerUnit = this.calculateLTMPerUnit(aggregateQuantity);

        const sizesByUpcharge = new Map();

        Object.entries(product.sizeQuantities || {}).forEach(([size, quantity]) => {
            if (quantity > 0) {
                const upcharge = product.sizeUpcharges?.[size] || 0;
                const key = upcharge.toFixed(2);

                if (!sizesByUpcharge.has(key)) {
                    sizesByUpcharge.set(key, { sizes: {}, quantity: 0, upcharge: upcharge });
                }

                const group = sizesByUpcharge.get(key);
                group.sizes[size] = quantity;
                group.quantity += quantity;
            }
        });

        sizesByUpcharge.forEach((group) => {
            const effectiveCost = product.baseCost + group.upcharge;
            const pricing = this.calculateUnitPrice(effectiveCost, selectedLocations, aggregateQuantity);
            const groupTotal = pricing.finalUnitPrice * group.quantity;

            sizeGroups.push({
                sizes: group.sizes,
                quantity: group.quantity,
                baseCost: product.baseCost,
                sizeUpcharge: group.upcharge,
                effectiveCost: effectiveCost,
                unitPrice: pricing.finalUnitPrice,
                total: groupTotal,
                pricing: pricing,
                sizeRange: this.determineSizeRange(Object.keys(group.sizes)[0])
            });

            productSubtotal += groupTotal;
            productQuantity += group.quantity;
        });

        sizeGroups.sort((a, b) => {
            if (a.sizeRange === 'standard' && b.sizeRange !== 'standard') return -1;
            if (a.sizeRange !== 'standard' && b.sizeRange === 'standard') return 1;
            return a.effectiveCost - b.effectiveCost;
        });

        return {
            sizeGroups,
            subtotal: productSubtotal,
            totalQuantity: productQuantity,
            tierLabel,
            ltmPerUnit,
            hasLTM: ltmPerUnit > 0,
            selectedLocations
        };
    }

    calculateQuoteTotals(products, selectedLocations) {
        let aggregateQuantity = 0;
        products.forEach(product => {
            Object.values(product.sizeQuantities || {}).forEach(qty => {
                aggregateQuantity += qty || 0;
            });
        });

        const tierLabel = this.getTierForQuantity(aggregateQuantity);
        const tierData = this.getTierData(aggregateQuantity);
        const ltmPerUnit = this.calculateLTMPerUnit(aggregateQuantity);
        const totalLtmFee = tierData.ltmFee || 0;

        let quoteSubtotal = 0;
        const processedProducts = products.map((product) => {
            const pricing = this.calculateProductPricing(product, selectedLocations, aggregateQuantity);
            quoteSubtotal += pricing.subtotal;
            return {
                ...product,
                pricing,
                subtotal: pricing.subtotal,
                quantity: pricing.totalQuantity,
                sizeGroups: pricing.sizeGroups.map(g => this.formatSizeGroup(g))
            };
        });

        const transferBreakdown = this.calculateTransferCosts(selectedLocations, aggregateQuantity);

        return {
            products: processedProducts,
            subtotal: quoteSubtotal,
            total: quoteSubtotal,
            totalQuantity: aggregateQuantity,
            tierLabel,
            hasLTM: totalLtmFee > 0,
            ltmFee: totalLtmFee,
            ltmPerUnit,
            selectedLocations,
            locationCount: selectedLocations.length,
            transferBreakdown,
            laborCostPerLocation: this.getLaborCostPerLocation(),
            freightPerTransfer: this.getFreightPerTransfer(aggregateQuantity),
            marginDenominator: tierData.marginDenominator
        };
    }

    formatSizeGroup(group) {
        const sizeList = Object.entries(group.sizes)
            .map(([size, qty]) => `${size}(${qty})`)
            .join(' ');

        const sizes = Object.keys(group.sizes);
        let label = '';

        if (group.sizeRange === 'standard') {
            const standardOrder = ['XS', 'S', 'M', 'L', 'XL'];
            const includedSizes = sizes.filter(s => standardOrder.includes(s));

            if (includedSizes.length === 1) {
                label = includedSizes[0];
            } else if (includedSizes.length > 0) {
                const minIndex = Math.min(...includedSizes.map(s => standardOrder.indexOf(s)));
                const maxIndex = Math.max(...includedSizes.map(s => standardOrder.indexOf(s)));
                label = `${standardOrder[minIndex]}-${standardOrder[maxIndex]}`;
            } else {
                label = sizeList;
            }
        } else {
            label = sizes.join(', ');
        }

        return {
            label,
            details: sizeList,
            sizes: group.sizes,
            quantity: group.quantity,
            baseCost: group.baseCost,
            sizeUpcharge: group.sizeUpcharge,
            effectiveCost: group.effectiveCost,
            unitPrice: group.unitPrice,
            total: group.total
        };
    }

    determineSizeRange(size) {
        const standardSizes = ['XS', 'S', 'M', 'L', 'XL'];
        const extendedSizes = ['2XL', 'XXL', '3XL', '4XL', '5XL', '6XL', '2XLT', '3XLT', '4XLT', 'LT', 'XLT'];
        if (standardSizes.includes(size)) return 'standard';
        if (extendedSizes.includes(size)) return 'extended';
        return 'other';
    }

    getLocationName(locationCode) {
        const location = DTFConfig.transferLocations.find(l => l.value === locationCode);
        return location?.label || locationCode;
    }

    clearCache() {
        this.productCache.clear();
        this.pricingService.clearCache();
        this.pricingData = null;
        this.isLoaded = false;
    }

    getStatus() {
        return {
            service: 'DTFQuotePricing',
            isLoaded: this.isLoaded,
            hasPricingData: !!this.pricingData,
            pricingServiceStatus: this.pricingService.getStatus()
        };
    }
}

// Make available globally
window.DTFQuotePricing = DTFQuotePricing;
