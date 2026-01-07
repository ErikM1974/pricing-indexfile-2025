/**
 * DTF Transfer Pricing Configuration
 * Contains all hardcoded pricing data and configuration for DTF transfers
 */
const DTFConfig = {
    // Transfer size options with simplified customer-facing pricing tiers
    transferSizes: {
        'small': {
            name: 'Up to 5" x 5"',
            displayName: 'Small (Up to 5" x 5")',
            maxWidth: 5,
            maxHeight: 5,
            pricingTiers: [
                { minQty: 10, maxQty: 23, unitPrice: 6.00, range: '10-23' },
                { minQty: 24, maxQty: 47, unitPrice: 5.25, range: '24-47' },
                { minQty: 48, maxQty: 71, unitPrice: 4.00, range: '48-71' },
                { minQty: 72, maxQty: 999999, unitPrice: 3.25, range: '72+' }
            ]
        },
        'medium': {
            name: 'Up to 9" x 12"',
            displayName: 'Medium (Up to 9" x 12")',
            maxWidth: 9,
            maxHeight: 12,
            pricingTiers: [
                { minQty: 10, maxQty: 23, unitPrice: 9.50, range: '10-23' },
                { minQty: 24, maxQty: 47, unitPrice: 8.25, range: '24-47' },
                { minQty: 48, maxQty: 71, unitPrice: 6.50, range: '48-71' },
                { minQty: 72, maxQty: 999999, unitPrice: 5.00, range: '72+' }
            ]
        },
        'large': {
            name: 'Up to 12" x 16.5"',
            displayName: 'Large (Up to 12" x 16.5")',
            maxWidth: 12,
            maxHeight: 16.5,
            pricingTiers: [
                { minQty: 10, maxQty: 23, unitPrice: 14.50, range: '10-23' },
                { minQty: 24, maxQty: 47, unitPrice: 12.50, range: '24-47' },
                { minQty: 48, maxQty: 71, unitPrice: 10.00, range: '48-71' },
                { minQty: 72, maxQty: 999999, unitPrice: 8.00, range: '72+' }
            ]
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
        back: ['back-of-neck', 'center-back', 'full-back'],
        // Sleeves are independent - no conflicts
    },

    // Labor costs
    laborCost: {
        costPerLocation: 2.00,  // $2 per location
        getTotalLaborCost: function(locationCount) {
            return this.costPerLocation * locationCount;
        }
    },

    // Freight costs (tiered structure based on quantity)
    freightCost: {
        tiers: [
            { minQty: 10, maxQty: 49, costPerTransfer: 0.50 },
            { minQty: 50, maxQty: 99, costPerTransfer: 0.35 },
            { minQty: 100, maxQty: 199, costPerTransfer: 0.25 },
            { minQty: 200, maxQty: 999999, costPerTransfer: 0.15 }
        ],
        getFreightPerTransfer: function(quantity) {
            const tier = this.tiers.find(t => quantity >= t.minQty && quantity <= t.maxQty);
            return tier ? tier.costPerTransfer : 0.15; // Default to lowest tier
        },
        getTotalFreight: function(quantity, locationCount) {
            return this.getFreightPerTransfer(quantity) * locationCount;
        }
    },

    // System settings
    settings: {
        maxTransferLocations: 8,
        minQuantity: 10,  // Firm minimum - cannot order less than 10
        defaultQuantity: 24,
        garmentMargin: 0.57,  // 43% margin (2026) - synced with API Pricing_Tiers.MarginDenominator
        showFreight: true,
        showLTMFee: true,
        includeFreightInTransfers: true,  // Include freight calculation based on transfers
        ltmFeeThreshold: 24,  // Orders under 24 pieces get LTM fee
        ltmFeeAmount: 50.00  // $50 LTM fee
    },

    // Helper functions
    helpers: {
        getTransferPrice: function(sizeKey, quantity) {
            const size = DTFConfig.transferSizes[sizeKey];
            if (!size) return 0;

            const tier = size.pricingTiers.find(t => quantity >= t.minQty && quantity <= t.maxQty);
            return tier ? tier.unitPrice : 0;
        },

        getSizeForLocation: function(locationValue) {
            const location = DTFConfig.transferLocations.find(l => l.value === locationValue);
            return location ? location.size : null;
        },

        getConflictingLocations: function(locationValue) {
            const location = DTFConfig.transferLocations.find(l => l.value === locationValue);
            if (!location || !location.zone) return [];

            // Get all locations in the same conflict zone
            const zone = location.zone;
            if (!DTFConfig.conflictZones[zone]) return [];

            // Return all locations in that zone except the clicked one
            return DTFConfig.conflictZones[zone].filter(loc => loc !== locationValue);
        },

        getLocationsBySize: function(sizeKey) {
            return DTFConfig.transferLocations.filter(l => l.size === sizeKey);
        }
    }
};

// Make config available globally
window.DTFConfig = DTFConfig;