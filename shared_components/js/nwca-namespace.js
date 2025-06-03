/**
 * NWCA Global Namespace
 * Northwest Custom Apparel unified namespace for all pricing pages
 * This replaces multiple global variables with a single, organized structure
 * 
 * @namespace NWCA
 * @version 1.0.0
 */

(function(window) {
    'use strict';

    // Create the main namespace
    window.NWCA = window.NWCA || {};

    // Configuration settings
    NWCA.config = {
        // Debug mode - controls console logging
        debug: localStorage.getItem('NWCA_DEBUG') === 'true' || false,
        
        // API endpoints
        api: {
            base: 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com',
            productColors: '/api/product-colors',
            stylesearch: '/api/stylesearch',
            inventory: '/api/inventory',
            pricingMatrix: '/api/pricing-matrix',
            cartSessions: '/api/cart-sessions',
            cartItems: '/api/cart-items'
        },
        
        // Pricing configuration
        pricing: {
            capEmbroidery: {
                appKey: 'a0e150004ecd0739f853449c8d7f',
                defaultStitchCount: 8000,
                availableStitchCounts: [5000, 8000, 10000],
                ltmMinimum: 24,
                ltmFee: 50.00,
                backLogo: {
                    defaultStitchCount: 5000,
                    minStitchCount: 5000,
                    maxStitchCount: 15000,
                    priceBase: 5.00,
                    pricePerThousand: 1.00,
                    incrementStep: 1000
                }
            }
        },
        
        // UI configuration
        ui: {
            animations: {
                duration: 300,
                easing: 'ease-out'
            },
            loadingTimeout: 5000,
            successDisplayDuration: 3000,
            pollingInterval: 100,
            maxPollingAttempts: 50,
            debounceDelay: 300
        },
        
        // Feature flags
        features: {
            animations: true,
            localStorage: true,
            analytics: false,
            cartEnabled: false // Disabled for quote-only workflow
        }
    };

    // Controllers namespace for page-specific logic
    NWCA.controllers = {};

    // Utilities namespace
    NWCA.utils = {
        /**
         * Logger utility with debug mode support
         */
        logger: {
            _formatMessage: function(level, module, message, data) {
                const timestamp = new Date().toISOString();
                const prefix = `[${module}]`;
                return { timestamp, level, prefix, message, data };
            },

            log: function(module, message, data) {
                if (!NWCA.config.debug) return;
                const formatted = this._formatMessage('LOG', module, message, data);
                console.log(formatted.prefix, formatted.message, data || '');
            },

            info: function(module, message, data) {
                if (!NWCA.config.debug) return;
                const formatted = this._formatMessage('INFO', module, message, data);
                console.info(formatted.prefix, formatted.message, data || '');
            },

            warn: function(module, message, data) {
                // Warnings always show
                const formatted = this._formatMessage('WARN', module, message, data);
                console.warn(formatted.prefix, formatted.message, data || '');
            },

            error: function(module, message, data) {
                // Errors always show
                const formatted = this._formatMessage('ERROR', module, message, data);
                console.error(formatted.prefix, formatted.message, data || '');
            },

            group: function(label) {
                if (!NWCA.config.debug) return;
                console.group(label);
            },

            groupEnd: function() {
                if (!NWCA.config.debug) return;
                console.groupEnd();
            },

            table: function(data) {
                if (!NWCA.config.debug) return;
                console.table(data);
            }
        },

        /**
         * Common formatters
         */
        formatters: {
            /**
             * Format price to currency string
             * @param {number} price - The price to format
             * @param {boolean} includeCents - Whether to include cents (default: true)
             * @returns {string} Formatted price like "$12.50" or "$12"
             */
            currency: function(price, includeCents = true) {
                const num = parseFloat(price);
                if (isNaN(num)) return '$0.00';
                
                if (includeCents) {
                    return '$' + num.toFixed(2);
                } else {
                    return '$' + Math.round(num).toString();
                }
            },

            /**
             * Format number with commas
             * @param {number} num - The number to format
             * @returns {string} Formatted number like "1,234"
             */
            number: function(num) {
                return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
            },

            /**
             * Format percentage
             * @param {number} value - The decimal value (0.15 = 15%)
             * @param {number} decimals - Number of decimal places
             * @returns {string} Formatted percentage like "15%"
             */
            percentage: function(value, decimals = 0) {
                return (value * 100).toFixed(decimals) + '%';
            }
        },

        /**
         * Debounce utility
         * @param {Function} func - Function to debounce
         * @param {number} wait - Wait time in milliseconds
         * @returns {Function} Debounced function
         */
        debounce: function(func, wait) {
            let timeout;
            return function executedFunction(...args) {
                const later = () => {
                    clearTimeout(timeout);
                    func(...args);
                };
                clearTimeout(timeout);
                timeout = setTimeout(later, wait || NWCA.config.ui.debounceDelay);
            };
        },

        /**
         * Throttle utility
         * @param {Function} func - Function to throttle
         * @param {number} limit - Time limit in milliseconds
         * @returns {Function} Throttled function
         */
        throttle: function(func, limit) {
            let inThrottle;
            return function(...args) {
                if (!inThrottle) {
                    func.apply(this, args);
                    inThrottle = true;
                    setTimeout(() => inThrottle = false, limit);
                }
            };
        },

        /**
         * Deep merge objects
         * @param {Object} target - Target object
         * @param {Object} source - Source object
         * @returns {Object} Merged object
         */
        deepMerge: function(target, source) {
            const output = Object.assign({}, target);
            if (this.isObject(target) && this.isObject(source)) {
                Object.keys(source).forEach(key => {
                    if (this.isObject(source[key])) {
                        if (!(key in target))
                            Object.assign(output, { [key]: source[key] });
                        else
                            output[key] = this.deepMerge(target[key], source[key]);
                    } else {
                        Object.assign(output, { [key]: source[key] });
                    }
                });
            }
            return output;
        },

        /**
         * Check if value is plain object
         */
        isObject: function(item) {
            return item && typeof item === 'object' && !Array.isArray(item);
        },

        /**
         * Generate unique ID
         * @param {string} prefix - Optional prefix
         * @returns {string} Unique ID
         */
        generateId: function(prefix = 'nwca') {
            return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        }
    };

    // State management
    NWCA.state = {
        // Current page type
        pageType: null,
        
        // Current product
        currentProduct: {
            styleNumber: null,
            colorCode: null,
            colorName: null,
            productTitle: null
        },
        
        // Page-specific state (will be populated by controllers)
        pageState: {}
    };

    // Event system
    NWCA.events = {
        _listeners: {},

        /**
         * Subscribe to an event
         * @param {string} event - Event name
         * @param {Function} callback - Callback function
         * @returns {Function} Unsubscribe function
         */
        on: function(event, callback) {
            if (!this._listeners[event]) {
                this._listeners[event] = [];
            }
            this._listeners[event].push(callback);
            
            // Return unsubscribe function
            return () => {
                this._listeners[event] = this._listeners[event].filter(cb => cb !== callback);
            };
        },

        /**
         * Emit an event
         * @param {string} event - Event name
         * @param {*} data - Event data
         */
        emit: function(event, data) {
            if (!this._listeners[event]) return;
            
            this._listeners[event].forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    NWCA.utils.logger.error('EVENTS', `Error in event listener for ${event}:`, error);
                }
            });
        },

        /**
         * Remove all listeners for an event
         * @param {string} event - Event name
         */
        off: function(event) {
            delete this._listeners[event];
        }
    };

    // API utilities
    NWCA.api = {
        /**
         * Make API request
         * @param {string} endpoint - API endpoint
         * @param {Object} options - Fetch options
         * @returns {Promise} API response
         */
        request: async function(endpoint, options = {}) {
            const url = endpoint.startsWith('http') ? endpoint : NWCA.config.api.base + endpoint;
            
            try {
                NWCA.utils.logger.log('API', `Request to ${url}`, options);
                const response = await fetch(url, options);
                
                if (!response.ok) {
                    throw new Error(`API Error ${response.status}: ${response.statusText}`);
                }
                
                const data = await response.json();
                NWCA.utils.logger.log('API', `Response from ${url}`, data);
                return data;
                
            } catch (error) {
                NWCA.utils.logger.error('API', `Request failed for ${url}`, error);
                throw error;
            }
        },

        /**
         * GET request helper
         */
        get: function(endpoint, params = {}) {
            const url = new URL(endpoint.startsWith('http') ? endpoint : NWCA.config.api.base + endpoint);
            Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));
            return this.request(url.toString());
        },

        /**
         * POST request helper
         */
        post: function(endpoint, data = {}) {
            return this.request(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
        }
    };

    // Storage utilities
    NWCA.storage = {
        /**
         * Get item from localStorage with fallback
         */
        get: function(key, defaultValue = null) {
            if (!NWCA.config.features.localStorage) return defaultValue;
            
            try {
                const item = localStorage.getItem(`NWCA_${key}`);
                return item ? JSON.parse(item) : defaultValue;
            } catch (error) {
                NWCA.utils.logger.error('STORAGE', `Error getting ${key}`, error);
                return defaultValue;
            }
        },

        /**
         * Set item in localStorage
         */
        set: function(key, value) {
            if (!NWCA.config.features.localStorage) return;
            
            try {
                localStorage.setItem(`NWCA_${key}`, JSON.stringify(value));
            } catch (error) {
                NWCA.utils.logger.error('STORAGE', `Error setting ${key}`, error);
            }
        },

        /**
         * Remove item from localStorage
         */
        remove: function(key) {
            if (!NWCA.config.features.localStorage) return;
            
            try {
                localStorage.removeItem(`NWCA_${key}`);
            } catch (error) {
                NWCA.utils.logger.error('STORAGE', `Error removing ${key}`, error);
            }
        }
    };

    // Initialize debug mode from URL parameter
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('debug')) {
        NWCA.config.debug = urlParams.get('debug') === 'true';
        NWCA.storage.set('DEBUG', NWCA.config.debug);
    }

    // Log initialization
    NWCA.utils.logger.info('NWCA', 'Northwest Custom Apparel namespace initialized', {
        version: '1.0.0',
        debug: NWCA.config.debug,
        features: NWCA.config.features
    });

})(window);