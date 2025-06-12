/**
 * DTG Configuration Module
 * Centralized configuration for all DTG-specific settings
 */

const DTGConfig = {
    // Page type identifier
    pageType: 'dtg',
    
    // Product settings
    unitLabel: 'shirts',
    productType: 'Direct to Garment Printing',
    
    // Print location configurations
    locations: {
        'LC': {
            name: 'Left Chest Only',
            displayName: 'Left Chest',
            description: 'Standard left chest placement (4" x 4" max)',
            maxSize: '4" x 4"',
            basePrice: true
        },
        'FF': {
            name: 'Full Front Only',
            displayName: 'Full Front',
            description: 'Large front print area (12" x 12" max)',
            maxSize: '12" x 12"',
            upcharge: 2.00
        },
        'FB': {
            name: 'Full Back Only',
            displayName: 'Full Back',
            description: 'Large back print area (12" x 12" max)',
            maxSize: '12" x 12"',
            upcharge: 2.00
        },
        'JF': {
            name: 'Jumbo Front Only',
            displayName: 'Jumbo Front',
            description: 'Extra large front print (14" x 16" max)',
            maxSize: '14" x 16"',
            upcharge: 4.00
        },
        'JB': {
            name: 'Jumbo Back Only',
            displayName: 'Jumbo Back',
            description: 'Extra large back print (14" x 16" max)',
            maxSize: '14" x 16"',
            upcharge: 4.00
        },
        'LC_FB': {
            name: 'Left Chest + Full Back',
            displayName: 'Left Chest + Full Back',
            description: 'Combination front and back prints',
            combo: true,
            upcharge: 4.00
        },
        'FF_FB': {
            name: 'Full Front + Full Back',
            displayName: 'Full Front + Full Back',
            description: 'Large prints on both sides',
            combo: true,
            upcharge: 6.00
        },
        'JF_JB': {
            name: 'Jumbo Front + Jumbo Back',
            displayName: 'Jumbo Front + Jumbo Back',
            description: 'Maximum coverage both sides',
            combo: true,
            upcharge: 10.00
        }
    },
    
    // Pricing configurations
    pricing: {
        ltmThreshold: 24,
        ltmFee: 50,
        ltmMessage: 'Orders under 24 shirts include a $50 setup fee',
        
        // Size group upcharges
        sizeUpcharges: {
            'S-XL': 0,
            '2XL': 2.00,
            '3XL': 3.00,
            '4XL': 4.00,
            '5XL': 5.00,
            '6XL': 6.00
        },
        
        // Default quantity tiers for quick quote
        defaultTiers: [
            { min: 1, max: 11, label: '1-11' },
            { min: 12, max: 23, label: '12-23' },
            { min: 24, max: 47, label: '24-47' },
            { min: 48, max: 71, label: '48-71' },
            { min: 72, max: 143, label: '72-143' },
            { min: 144, max: 287, label: '144-287' },
            { min: 288, max: 499, label: '288-499' },
            { min: 500, max: 999, label: '500+' }
        ]
    },
    
    // Quick Quote Calculator settings
    quickQuote: {
        enabled: true,
        defaultQuantity: 24,
        showLocationSelector: true, // Location selector integrated in quick quote
        defaultLocation: 'LC', // Default to Left Chest
        quickSelectButtons: [
            { label: '1 Dozen', quantity: 12 },
            { label: '2 Dozen', quantity: 24 },
            { label: '3 Dozen', quantity: 36 },
            { label: '4 Dozen', quantity: 48 },
            { label: '6 Dozen', quantity: 72 },
            { label: '12 Dozen', quantity: 144 }
        ]
    },
    
    // Universal Pricing Grid settings
    pricingGrid: {
        showInventory: true,
        inventoryThreshold: 10,
        loadingAnimation: true,
        showColorIndicator: true,
        showBestValueBadges: true,
        highlightCurrentTier: true
    },
    
    // Loading states configuration
    loadingStates: {
        steps: [
            { progress: 20, status: 'Connecting to pricing server...', duration: 400 },
            { progress: 40, status: 'Loading print location data...', duration: 600 },
            { progress: 60, status: 'Calculating quantity discounts...', duration: 800 },
            { progress: 80, status: 'Preparing your pricing...', duration: 600 },
            { progress: 100, status: 'Complete!', duration: 300 }
        ]
    },
    
    // API configuration
    api: {
        baseUrl: window.API_PROXY_BASE_URL || 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com',
        endpoints: {
            pricing: '/api/proxy',
            inventory: '/api/inventory'
        }
    },
    
    // Feature flags
    features: {
        showPricingTiers: true,
        showQuickQuote: true,
        showInventoryStatus: true,
        showSavingsCalculator: true,
        enablePDFExport: true,
        enableEmailQuote: true
    },
    
    // Helper methods
    helpers: {
        /**
         * Get location display info
         */
        getLocationInfo(locationCode) {
            return DTGConfig.locations[locationCode] || null;
        },
        
        /**
         * Calculate total upcharge for a location
         */
        getLocationUpcharge(locationCode) {
            const location = DTGConfig.locations[locationCode];
            return location ? (location.upcharge || 0) : 0;
        },
        
        /**
         * Format price display
         */
        formatPrice(price) {
            return `$${parseFloat(price).toFixed(2)}`;
        },
        
        /**
         * Check if quantity qualifies for LTM
         */
        isLTM(quantity) {
            return quantity < DTGConfig.pricing.ltmThreshold;
        },
        
        /**
         * Get tier for quantity
         */
        getTierForQuantity(quantity) {
            return DTGConfig.pricing.defaultTiers.find(
                tier => quantity >= tier.min && quantity <= tier.max
            );
        }
    }
};

// Make available globally
window.DTGConfig = DTGConfig;

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DTGConfig;
}