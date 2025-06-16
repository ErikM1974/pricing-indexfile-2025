/**
 * NWCA Constants
 * Centralized constants for all pricing pages
 * Part of the NWCA namespace
 * 
 * @namespace NWCA.CONSTANTS
 * @version 1.0.0
 */

(function(NWCA) {
    // Add this at the top of constants.js
    console.log('[CONSTANTS_DEBUG] Checking NWCA namespace:', typeof NWCA, NWCA);
    'use strict';

    // Ensure NWCA namespace exists
    if (!window.NWCA) {
        console.error('[CONSTANTS] NWCA namespace not found. Please include nwca-namespace.js first.');
        return;
    }

    /**
     * Global constants for the NWCA application
     * These replace magic numbers and strings throughout the codebase
     */
    NWCA.CONSTANTS = {
        
        // Stitch count related constants
        STITCH_COUNTS: {
            MIN: 5000,
            DEFAULT: 8000,
            MAX: 15000,
            INCREMENTS: [5000, 8000, 10000],
            BACK_LOGO: {
                DEFAULT: 5000,
                MIN: 5000,
                MAX: 15000,
                INCREMENT_STEP: 1000,
                BASE_PRICE: 5.00,
                PRICE_PER_THOUSAND: 1.00
            }
        },

        // Quantity related constants
        QUANTITIES: {
            MIN: 1,
            MAX: 10000,
            DEFAULT: 24,
            LTM_THRESHOLD: 24,
            LTM_FEE: 50.00,
            PRICE_BREAKS: {
                SMALL: 24,
                MEDIUM: 48,
                LARGE: 72
            },
            TIER_LABELS: {
                SMALL: '24-47',
                MEDIUM: '48-71',
                LARGE: '72+'
            }
        },

        // UI timing constants (in milliseconds)
        UI: {
            DEBOUNCE_DELAY: 300,
            THROTTLE_DELAY: 100,
            SUCCESS_MESSAGE_DURATION: 3000,
            ERROR_MESSAGE_DURATION: 5000,
            LOADING_TIMEOUT: 5000,
            ANIMATION_DURATION: 300,
            POLLING_INTERVAL: 100,
            MAX_POLLING_ATTEMPTS: 50,
            CASPIO_CHECK_DELAY: 2000
        },

        // CSS classes for state management
        CLASSES: {
            LOADING: 'is-loading',
            ERROR: 'has-error',
            SUCCESS: 'is-success',
            ACTIVE: 'is-active',
            DISABLED: 'is-disabled',
            HIDDEN: 'is-hidden',
            VISIBLE: 'is-visible',
            SELECTED: 'is-selected',
            OPEN: 'is-open',
            PROCESSING: 'is-processing'
        },

        // DOM element IDs (for consistency)
        ELEMENTS: {
            // Hero section
            HERO_QUANTITY_INPUT: 'hero-quantity-input',
            HERO_QUANTITY_INCREASE: 'hero-quantity-increase',
            HERO_QUANTITY_DECREASE: 'hero-quantity-decrease',
            HERO_TOTAL_PRICE: 'hero-total-price',
            HERO_UNIT_PRICE: 'hero-unit-price',
            
            // Stitch count
            STITCH_COUNT_SELECT: 'client-stitch-count-select',
            
            // Back logo
            BACK_LOGO_CHECKBOX: 'back-logo-checkbox',
            BACK_LOGO_INCREMENT: 'back-logo-increment',
            BACK_LOGO_DECREMENT: 'back-logo-decrement',
            BACK_LOGO_DISPLAY: 'back-logo-stitch-display',
            
            // Pricing grid
            PRICING_GRID: 'custom-pricing-grid',
            PRICING_CALCULATOR: 'pricing-calculator',
            
            // Quote builder
            QUOTE_BUILDER_SECTION: 'quote-builder-section',
            ADD_TO_CART_SECTION: 'add-to-cart-section',
            
            // Product info
            PRODUCT_IMAGE_MAIN: 'product-image-main',
            COLOR_SWATCHES: 'color-swatches'
        },

        // API endpoints (relative to base URL)
        API: {
            ENDPOINTS: {
                PRODUCT_COLORS: '/api/product-colors',
                STYLE_SEARCH: '/api/stylesearch',
                INVENTORY: '/api/inventory',
                PRICING_MATRIX: '/api/pricing-matrix',
                QUOTE_SESSIONS: '/api/quote_sessions',
                QUOTE_ITEMS: '/api/quote_items',
                QUOTE_ANALYTICS: '/api/quote_analytics'
            },
            TIMEOUT: 30000, // 30 seconds
            RETRY_ATTEMPTS: 3,
            RETRY_DELAY: 1000
        },

        // Embellishment types
        EMBELLISHMENT_TYPES: {
            CAP_EMBROIDERY: 'cap-embroidery',
            EMBROIDERY: 'embroidery',
            SCREEN_PRINT: 'screenprint',
            DTG: 'dtg',
            DTF: 'dtf'
        },

        // Responsive breakpoints
        BREAKPOINTS: {
            MOBILE: 480,
            TABLET: 768,
            DESKTOP: 1024,
            WIDE: 1440
        },

        // Accessibility
        ACCESSIBILITY: {
            MIN_TOUCH_TARGET: 44, // 44x44 pixels minimum
            FOCUS_VISIBLE_OUTLINE: '3px solid #0066cc',
            HIGH_CONTRAST_RATIO: 4.5,
            NORMAL_CONTRAST_RATIO: 3
        },

        // Storage keys
        STORAGE_KEYS: {
            DEBUG_MODE: 'NWCA_DEBUG',
            QUOTE_SESSION: 'nwca_quote_session',
            CURRENT_QUOTE: 'nwca_current_quote',
            RECENT_QUOTES: 'recentQuotes',
            USER_PREFERENCES: 'nwca_user_preferences'
        },

        // Messages and labels
        MESSAGES: {
            LOADING: 'Loading...',
            LOADING_PRICING: 'Loading pricing data...',
            LOADING_PRODUCTS: 'Loading product information...',
            ERROR_GENERIC: 'An error occurred. Please try again.',
            ERROR_NETWORK: 'Network error. Please check your connection.',
            ERROR_TIMEOUT: 'Request timed out. Please try again.',
            SUCCESS_QUOTE_ADDED: 'Item added to quote successfully!',
            SUCCESS_QUOTE_SAVED: 'Quote saved successfully!',
            CONFIRM_CLEAR_QUOTE: 'Are you sure you want to clear the current quote?'
        },

        // Validation
        VALIDATION: {
            EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
            PHONE_REGEX: /^\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})$/,
            STYLE_NUMBER_REGEX: /^[A-Z0-9-]+$/i,
            MIN_NAME_LENGTH: 2,
            MAX_NAME_LENGTH: 100,
            MAX_NOTES_LENGTH: 1000
        }
    };

    // Freeze the constants object to prevent modifications
    Object.freeze(NWCA.CONSTANTS);
    
    // Deep freeze nested objects
    Object.keys(NWCA.CONSTANTS).forEach(key => {
        if (typeof NWCA.CONSTANTS[key] === 'object') {
            Object.freeze(NWCA.CONSTANTS[key]);
            // Freeze nested objects within
            Object.keys(NWCA.CONSTANTS[key]).forEach(nestedKey => {
                if (typeof NWCA.CONSTANTS[key][nestedKey] === 'object') {
                    Object.freeze(NWCA.CONSTANTS[key][nestedKey]);
                }
            });
        }
    });

    console.log('[CONSTANTS] NWCA constants loaded and frozen');

})(window.NWCA);