// app.config.js - Central configuration for Northwest Custom Apparel Pricing System
// This file consolidates all hardcoded values into one location

window.APP_CONFIG = {
    // API Configuration
    API: {
        BASE_URL: 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com',
        TIMEOUT: 30000,
        RETRY_ATTEMPTS: 3,
        ENDPOINTS: {
            QUOTE_SESSIONS: '/api/quote_sessions',
            QUOTE_ITEMS: '/api/quote_items',
            PRODUCTS: '/api/products',
            HEALTH: '/api/health'
        }
    },

    // EmailJS Configuration
    EMAIL: {
        PUBLIC_KEY: '4qSbDO-SQs19TbP80',
        SERVICE_ID: 'service_1c4k67j',
        TEMPLATES: {
            DTG: 'template_dtg_quote',
            RICH: 'template_rich_quote',
            EMB: 'template_emb_quote',
            EMBC: 'template_embc_quote',
            LT: 'template_lt_quote',
            PATCH: 'template_patch_quote',
            SPC: 'template_spc_quote',
            SSC: 'template_ssc_quote',
            WEB: 'template_web_quote',
            ART: 'template_art_invoice'
        }
    },

    // Company Information
    COMPANY: {
        NAME: 'Northwest Custom Apparel',
        PHONE: '253-922-5793',
        EMAIL: 'sales@nwcustomapparel.com',
        FOUNDED: 1977,
        LOGO_URL: 'https://cdn.caspio.com/A0E15000/Safety%20Stripes/web%20northwest%20custom%20apparel%20logo.png',
        ADDRESS: {
            STREET: '1234 Main St',
            CITY: 'Tacoma',
            STATE: 'WA',
            ZIP: '98402'
        }
    },

    // Quote Configuration
    QUOTES: {
        PREFIXES: {
            DTG: 'Direct-to-Garment Contract',
            RICH: 'Richardson Caps',
            EMB: 'Embroidery Contract',
            EMBC: 'Customer Supplied Embroidery',
            LT: 'Laser Tumblers',
            PATCH: 'Embroidered Emblems',
            SPC: 'Customer Screen Print',
            SSC: 'Safety Stripe Creator',
            WEB: 'Webstore Setup',
            ART: 'Art Invoice'
        },
        ID_PATTERN: '[PREFIX][MMDD]-[sequence]',
        DEFAULT_TAX_RATE: 0.101,  // 10.1% Washington State
        MINIMUM_ORDER: 50.00
    },

    // Feature Flags
    FEATURES: {
        ENABLE_DEBUG: false,
        SHOW_PRICING_DEBUG: false,
        CACHE_DURATION: 300000, // 5 minutes in milliseconds
        MAX_CART_ITEMS: 50,
        ENABLE_MONITORING: false,
        AUTO_SAVE_QUOTES: true,
        SHOW_BETA_FEATURES: false
    },

    // Error Messages
    ERRORS: {
        API_DOWN: 'Service temporarily unavailable. Please call 253-922-5793 for assistance.',
        INVALID_INPUT: 'Please check your input and try again.',
        SESSION_EXPIRED: 'Your session has expired. Please refresh the page.',
        PRICING_UNAVAILABLE: 'Unable to load pricing. Please refresh or call 253-922-5793.',
        EMAIL_FAILED: 'Email could not be sent but your quote was saved.',
        CART_FULL: 'Cart is full. Maximum 50 items allowed.',
        INVALID_PRODUCT: 'Invalid product selection. Please try again.'
    },

    // Success Messages
    SUCCESS: {
        QUOTE_SAVED: 'Quote saved successfully! Quote ID: ',
        EMAIL_SENT: 'Quote emailed successfully!',
        ITEM_ADDED: 'Item added to cart',
        CART_CLEARED: 'Cart cleared successfully',
        DATA_LOADED: 'Data loaded successfully'
    },

    // Environment Detection
    ENV: {
        isDevelopment() {
            return window.location.hostname === 'localhost' ||
                   window.location.hostname === '127.0.0.1';
        },
        isStaging() {
            return window.location.hostname.includes('staging') ||
                   window.location.hostname.includes('test');
        },
        isProduction() {
            return !this.isDevelopment() && !this.isStaging();
        },
        getAPIUrl() {
            // Allow local override for development
            if (this.isDevelopment() && window.location.port === '3000') {
                return 'http://localhost:3000/api';
            }
            return window.APP_CONFIG.API.BASE_URL + '/api';
        }
    },

    // Validation Rules
    VALIDATION: {
        EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        PHONE_REGEX: /^\d{3}-?\d{3}-?\d{4}$/,
        ZIP_REGEX: /^\d{5}(-\d{4})?$/,
        MIN_QUANTITY: 1,
        MAX_QUANTITY: 10000,
        MAX_STITCH_COUNT: 50000,
        MIN_STITCH_COUNT: 1000
    },

    // UI Configuration
    UI: {
        DEBOUNCE_DELAY: 300, // milliseconds
        TOAST_DURATION: 3000, // milliseconds
        MODAL_ANIMATION_DURATION: 150, // milliseconds
        DEFAULT_PAGE_SIZE: 25,
        MAX_PAGE_SIZE: 100,
        SPINNER_DELAY: 200 // Show spinner after 200ms
    },

    // Cache Configuration
    CACHE: {
        PRICING_DATA: 'pricing_cache',
        PRODUCT_DATA: 'product_cache',
        USER_PREFERENCES: 'user_prefs',
        CART_DATA: 'cart_data',
        QUOTE_DRAFT: 'quote_draft',
        TTL: {
            PRICING: 5 * 60 * 1000, // 5 minutes
            PRODUCTS: 10 * 60 * 1000, // 10 minutes
            USER_PREFS: 30 * 24 * 60 * 60 * 1000 // 30 days
        }
    },

    // Development Helpers
    DEV: {
        logAPIRequests: false,
        logStateChanges: false,
        showPerformanceMetrics: false,
        enableMockData: false,
        bypassValidation: false
    }
};

// Freeze config to prevent accidental modifications
Object.freeze(window.APP_CONFIG);

// Export for module systems (if needed)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = window.APP_CONFIG;
}