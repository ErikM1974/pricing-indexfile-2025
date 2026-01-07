/**
 * DTF Transfer Configuration (100% API-DRIVEN)
 *
 * Location mappings and configuration only - NO PRICING VALUES
 * All pricing data comes from API - no hardcoded fallbacks.
 *
 * ⚠️ If API fails, pricing is blocked entirely to prevent wrong quotes.
 */
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
        // NO pricing values - all come from API:
        // - garmentMargin (from Pricing_Tiers.MarginDenominator)
        // - ltmFeeThreshold (from Pricing_Tiers tier ranges)
        // - ltmFeeAmount (from Pricing_Tiers.LTM_Fee)
        // - laborCost (from DTF_Pricing.PressingLaborCost)
        // - freightCost (from Transfer_Freight)
        // - transferPrices (from DTF_Pricing.unit_price)
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
