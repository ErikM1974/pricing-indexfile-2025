// app.config.js — Central configuration + tenant compatibility shim (roadmap 0.3)
//
// This file now does two things:
//
//   1. Seeds `window.TENANT` with the default (NWCA) tenant when no tenant has
//      been resolved yet. config/ is the ONLY place the proxy host and EmailJS
//      IDs may appear as literals — everywhere else reads APP_CONFIG/TENANT
//      (CLAUDE.md Rule 6; CI guard lands with roadmap task 0.6).
//   2. Defines `window.APP_CONFIG` as a compatibility shim: the 30+ existing
//      call sites keep reading APP_CONFIG.API/EMAIL/COMPANY, but those values
//      now DELEGATE to window.TENANT via getters — so when config/tenant.js
//      hydrates a different tenant at runtime, every APP_CONFIG read follows
//      automatically. Values are byte-identical to the pre-shim config for the
//      default tenant.
//
// Load order on a page: app.config.js first, then (optionally) tenant.js.
// Pages that never load tenant.js behave exactly as before — NWCA defaults.

(function () {
    'use strict';
    if (typeof window === 'undefined') return; // browser-only file

    // ------------------------------------------------------------------
    // Default tenant — Northwest Custom Apparel. The shape here is the
    // TENANT contract every later phase builds on (branding/api/email/tax/
    // methods/currency/units/features). config/tenants/<id>.json overlays
    // this via config/tenant.js at runtime.
    // ------------------------------------------------------------------
    var DEFAULT_TENANT = {
        id: 'nwca',
        branding: {
            name: 'Northwest Custom Apparel',
            phone: '253-922-5793',
            phoneDisplay: '(253) 922-5793',
            email: 'sales@nwcustomapparel.com',
            website: 'www.nwcustomapparel.com',
            logoUrl: 'https://cdn.caspio.com/A0E15000/Safety%20Stripes/web%20northwest%20custom%20apparel%20logo.png',
            founded: 1977,
            // Real shop address (the old placeholder "1234 Main St, Tacoma"
            // never matched the invoice header — source of truth is the
            // printed quote, 2025 Freeman Road East).
            address: {
                street: '2025 Freeman Road East',
                city: 'Milton',
                state: 'WA',
                zip: '98354'
            },
            palette: {} // per-tenant theme tokens land with roadmap 2.5
        },
        api: {
            baseUrl: 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com'
        },
        email: {
            provider: 'emailjs',
            publicKey: '4qSbDO-SQs19TbP80',
            serviceId: 'service_jgrave3',
            templates: {
                DTG: 'template_dtg_quote',
                RICH: 'template_rich_quote',
                EMB: 'template_emb_quote',
                EMBC: 'template_embc_quote',
                LT: 'template_lt_quote',
                PATCH: 'template_patch_quote',
                SPC: 'template_spc_quote',
                SSC: 'template_ssc_quote',
                WEB: 'template_web_quote',
                ART: 'template_art_invoice',
                QUOTE_SHARE: 'template_quote_email'
            }
        },
        tax: {
            mode: 'lookup', // POST /api/tax-rates/lookup (WA DOR) — display default below
            defaultRateDisplay: 0.102 // 10.2% Milton WA (DOR, updated 2026-07-06) — display ONLY
        },
        methods: { emb: true, dtf: true, scp: true, dtg: true },
        currency: { code: 'USD', symbol: '$', decimals: 2 },
        units: 'imperial',
        features: {}
    };

    if (!window.TENANT) {
        window.TENANT = DEFAULT_TENANT;
    }

    // ------------------------------------------------------------------
    // APP_CONFIG — same surface as always; tenant-scoped fields delegate.
    // ------------------------------------------------------------------
    window.APP_CONFIG = {
        // API Configuration
        API: {
            get BASE_URL() { return window.TENANT.api.baseUrl; },
            TIMEOUT: 30000,
            RETRY_ATTEMPTS: 3,
            ENDPOINTS: {
                QUOTE_SESSIONS: '/api/quote_sessions',
                QUOTE_ITEMS: '/api/quote_items',
                PRODUCTS: '/api/products',
                HEALTH: '/api/health'
            }
        },

        // EmailJS Configuration (per-tenant)
        EMAIL: {
            get PUBLIC_KEY() { return window.TENANT.email.publicKey; },
            get SERVICE_ID() { return window.TENANT.email.serviceId; },
            get TEMPLATES() { return window.TENANT.email.templates; }
        },

        // Company Information (per-tenant branding)
        COMPANY: {
            get NAME() { return window.TENANT.branding.name; },
            get PHONE() { return window.TENANT.branding.phone; },
            get PHONE_DISPLAY() { return window.TENANT.branding.phoneDisplay || window.TENANT.branding.phone; },
            get EMAIL() { return window.TENANT.branding.email; },
            get WEBSITE() { return window.TENANT.branding.website || ''; },
            get FOUNDED() { return window.TENANT.branding.founded; },
            get LOGO_URL() { return window.TENANT.branding.logoUrl; },
            get ADDRESS() {
                var a = window.TENANT.branding.address || {};
                return { STREET: a.street, CITY: a.city, STATE: a.state, ZIP: a.zip };
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
            get DEFAULT_TAX_RATE() { return window.TENANT.tax.defaultRateDisplay; }, // display default ONLY; real rates via POST /api/tax-rates/lookup
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

        // Error Messages (phone comes from tenant branding)
        ERRORS: {
            get API_DOWN() { return 'Service temporarily unavailable. Please call ' + window.TENANT.branding.phone + ' for assistance.'; },
            INVALID_INPUT: 'Please check your input and try again.',
            SESSION_EXPIRED: 'Your session has expired. Please refresh the page.',
            get PRICING_UNAVAILABLE() { return 'Unable to load pricing. Please refresh or call ' + window.TENANT.branding.phone + '.'; },
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

    // Freeze config to prevent accidental modifications (shallow, as before —
    // the getters above stay live because freeze doesn't sever delegation).
    Object.freeze(window.APP_CONFIG);
})();

// Export for module systems (if needed)
if (typeof module !== 'undefined' && module.exports && typeof window !== 'undefined') {
    module.exports = window.APP_CONFIG;
}
