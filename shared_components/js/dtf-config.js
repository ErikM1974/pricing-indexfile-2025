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

    // Transfer location options
    transferLocations: [
        { value: 'front-center', label: 'Front Center', allowedSizes: ['small', 'medium', 'large'] },
        { value: 'back-center', label: 'Back Center', allowedSizes: ['medium', 'large'] },
        { value: 'left-chest', label: 'Left Chest', allowedSizes: ['small'] },
        { value: 'right-chest', label: 'Right Chest', allowedSizes: ['small'] },
        { value: 'left-sleeve', label: 'Left Sleeve', allowedSizes: ['small'] },
        { value: 'right-sleeve', label: 'Right Sleeve', allowedSizes: ['small'] },
        { value: 'neck-label', label: 'Neck Label', allowedSizes: ['small'] },
        { value: 'bottom-hem', label: 'Bottom Hem', allowedSizes: ['small', 'medium'] }
    ],

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
            { minQty: 10, maxQty: 49, costPerTransfer: 1.00 },
            { minQty: 50, maxQty: 99, costPerTransfer: 0.75 },
            { minQty: 100, maxQty: 199, costPerTransfer: 0.50 },
            { minQty: 200, maxQty: 999999, costPerTransfer: 0.35 }
        ],
        getFreightPerTransfer: function(quantity) {
            const tier = this.tiers.find(t => quantity >= t.minQty && quantity <= t.maxQty);
            return tier ? tier.costPerTransfer : 0.35; // Default to lowest tier
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
        garmentMargin: 0.6,  // 40% margin (divide by 0.6)
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
        
        getAllowedSizesForLocation: function(locationValue) {
            const location = DTFConfig.transferLocations.find(l => l.value === locationValue);
            return location ? location.allowedSizes : [];
        }
    }
};

// Make config available globally
window.DTFConfig = DTFConfig;