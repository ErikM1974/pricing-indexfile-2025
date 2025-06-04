/**
 * Core JavaScript Bundle
 * Essential functionality needed for initial page render
 * Combines: namespace, constants, utils, pricing-calculator, matrix-api
 */

// ========================================
// NWCA NAMESPACE
// ========================================
window.NWCA = window.NWCA || {
    config: {},
    ui: {},
    utils: {},
    controllers: {},
    adapters: {},
    state: {
        currentProduct: null,
        pricingData: null,
        initialized: false
    }
};

// ========================================
// CONSTANTS
// ========================================
NWCA.constants = {
    API_ENDPOINTS: {
        PRICING_MATRIX: 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/nwca_pricing_matrix',
        PRODUCTS: 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/products',
        QUOTE_SESSIONS: 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/quote_sessions',
        QUOTE_ITEMS: 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/quote_items'
    },
    
    PRICING_TIERS: {
        LTM_THRESHOLD: 24,
        LTM_FEE: 50.00,
        STANDARD_TIERS: [
            { min: 1, max: 11 },
            { min: 12, max: 23 },
            { min: 24, max: 47 },
            { min: 48, max: 71 },
            { min: 72, max: 143 },
            { min: 144, max: 287 },
            { min: 288, max: 499 },
            { min: 500, max: 999 },
            { min: 1000, max: 9999 }
        ]
    },
    
    EVENTS: {
        PRODUCT_LOADED: 'productLoaded',
        PRICING_LOADED: 'pricingDataLoaded',
        QUANTITY_CHANGED: 'quantityChanged',
        COLOR_SELECTED: 'colorSelected',
        QUOTE_UPDATED: 'quoteUpdated'
    }
};

// ========================================
// UTILITIES
// ========================================
NWCA.utils = {
    formatCurrency(amount) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(amount);
    },
    
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },
    
    getUrlParameter(name) {
        name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
        const regex = new RegExp('[\\?&]' + name + '=([^&#]*)');
        const results = regex.exec(location.search);
        return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
    },
    
    dispatchEvent(eventName, detail = {}) {
        const event = new CustomEvent(eventName, { detail });
        document.dispatchEvent(event);
    },
    
    showError(message) {
        console.error('[NWCA Error]', message);
        // Could show user-friendly error UI here
    }
};

// ========================================
// PRICING CALCULATOR
// ========================================
NWCA.PricingCalculator = {
    calculatePrice(quantity, unitPrice, options = {}) {
        const baseTotal = quantity * unitPrice;
        let total = baseTotal;
        
        // Add LTM fee if applicable
        if (quantity < NWCA.constants.PRICING_TIERS.LTM_THRESHOLD) {
            total += NWCA.constants.PRICING_TIERS.LTM_FEE;
        }
        
        // Add any additional charges
        if (options.additionalCharges) {
            total += options.additionalCharges;
        }
        
        return {
            unitPrice,
            baseTotal,
            ltmFee: quantity < NWCA.constants.PRICING_TIERS.LTM_THRESHOLD ? NWCA.constants.PRICING_TIERS.LTM_FEE : 0,
            total
        };
    },
    
    findPricingTier(quantity) {
        const tiers = NWCA.constants.PRICING_TIERS.STANDARD_TIERS;
        return tiers.find(tier => quantity >= tier.min && quantity <= tier.max) || tiers[tiers.length - 1];
    },
    
    getNextTierBreak(quantity) {
        const currentTier = this.findPricingTier(quantity);
        const nextTier = NWCA.constants.PRICING_TIERS.STANDARD_TIERS.find(tier => tier.min > currentTier.max);
        
        if (nextTier) {
            return {
                quantity: nextTier.min,
                difference: nextTier.min - quantity
            };
        }
        
        return null;
    }
};

// ========================================
// PRICING MATRIX API
// ========================================
NWCA.PricingMatrixAPI = {
    cache: new Map(),
    
    async fetchPricingData(styleNumber, embellishmentType) {
        const cacheKey = `${styleNumber}-${embellishmentType}`;
        
        // Check cache first
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }
        
        try {
            const response = await fetch(
                `${NWCA.constants.API_ENDPOINTS.PRICING_MATRIX}?style=${styleNumber}&type=${embellishmentType}`
            );
            
            if (!response.ok) {
                throw new Error('Failed to fetch pricing data');
            }
            
            const data = await response.json();
            this.cache.set(cacheKey, data);
            
            return data;
        } catch (error) {
            NWCA.utils.showError('Error loading pricing data: ' + error.message);
            throw error;
        }
    },
    
    parsePricingMatrix(matrixData) {
        // Parse the pricing matrix data into a usable format
        const parsed = {};
        
        if (Array.isArray(matrixData)) {
            matrixData.forEach(row => {
                const tier = `${row.min_quantity}-${row.max_quantity}`;
                parsed[tier] = {
                    minQty: row.min_quantity,
                    maxQty: row.max_quantity,
                    prices: row.prices || {}
                };
            });
        }
        
        return parsed;
    }
};

// ========================================
// INITIALIZATION
// ========================================
NWCA.init = function() {
    if (NWCA.state.initialized) return;
    
    console.log('[NWCA] Initializing core system...');
    
    // Set up global error handler
    window.addEventListener('error', (event) => {
        console.error('[NWCA] Global error:', event.error);
    });
    
    // Mark as initialized
    NWCA.state.initialized = true;
    
    // Dispatch initialization event
    NWCA.utils.dispatchEvent('nwcaInitialized');
    
    console.log('[NWCA] Core system initialized');
};

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', NWCA.init);
} else {
    NWCA.init();
}