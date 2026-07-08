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

    /**
     * Smallest orderable quantity = the lowest tier's minQuantity from the API
     * (10 today; Erik can change it in Caspio with no deploy). Hardcoded 10 is
     * the documented fallback for the not-yet-loaded window only — money gates
     * run after ensureLoaded(). (expert audit 2026-07-07: the literal 10 was
     * hardcoded 3× in the builder)
     */
    getMinimumQuantity() {
        const tiers = this.pricingData?.pricingTiers;
        if (!tiers || !tiers.length) return 10;
        return Math.min(...tiers.map(t => Number(t.minQuantity) || 10));
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

    // calculateUnitPrice() / calculateProductPricing() / calculateQuoteTotals() /
    // formatSizeGroup() / determineSizeRange() DELETED 2026-07-07 (expert audit).
    // They margined the size upcharge — effectiveCost = (baseCost + upcharge) /
    // marginDenominator — while every billed path adds the upcharge AFTER margin
    // (dtf-quote-builder.js updatePricing()/calculateFromState(); the engine comment
    // at quote-cart-engine.js ~:804 explicitly forbids this path: it overcharges
    // 2XL+ by ~$1.70–$6/pc). Zero live callers; the tempting name
    // calculateQuoteTotals was a standing foot-gun for the next integration.
    // Compose per-unit DTF pricing from getTierData()/calculateTransferCosts()/
    // getLaborCostPerLocation()/getFreightPerTransfer()/calculateLTMPerUnit()
    // with the size upcharge added AFTER margin, like the builder does.

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
