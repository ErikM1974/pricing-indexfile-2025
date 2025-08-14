// shared_components/js/base-adapter.js
/**
 * Base Adapter for Northwest Custom Apparel
 * Provides common adapter functionality for pricing and data processing
 * Part of Phase 5 - Base Class Creation & Code Consolidation
 */

class BaseAdapter {
    constructor(adapterType, config = {}) {
        this.adapterType = adapterType;
        this.APP_KEY = config.appKey || '';
        
        // Configuration
        this.config = {
            debug: config.debug || false,
            timeout: config.timeout || 15000, // 15 seconds
            retries: config.retries || 3,
            retryDelay: config.retryDelay || 1000,
            ...config
        };

        // State management
        this.state = {
            initialized: false,
            dataProcessed: false,
            processing: false,
            error: null,
            lastUpdate: null
        };

        // Master bundle storage
        this.masterBundle = null;
        this.pricingCache = new Map();
        
        // Timeout management
        this.timeoutId = null;
        this.messageListenerAdded = false;

        // Common DOM element IDs
        this.DOM_IDS = {
            errorMessage: config.errorMessageId || `caspio-${adapterType}-error-message`,
            fallbackUI: config.fallbackUIId || 'cart-fallback-ui',
            loadingSpinner: config.loadingSpinnerId || 'pricing-table-loading',
            initialState: config.initialStateId || 'pricing-initial-state',
            pricingGrid: config.pricingGridId || 'custom-pricing-grid',
            container: config.containerId || 'pricing-calculator'
        };

        // Expected Caspio origins
        this.EXPECTED_ORIGINS = [
            'https://c3eku948.caspio.com',
            'https://nwcustom.caspio.com',
            'https://www.teamnwca.com'
        ];

        // Event listeners
        this.eventListeners = {
            masterBundleReady: [],
            pricingDataLoaded: [],
            errorOccurred: [],
            dataProcessed: []
        };
    }

    // Initialization
    async init() {
        this.debugLog(`Initializing ${this.adapterType} adapter...`);
        
        try {
            this.clearMessages();
            this.resetState();
            
            // Setup message listener
            if (!this.messageListenerAdded) {
                this.setupMessageListener();
            }
            
            // Initialize UI
            this.initializeUI();
            
            // Start timeout
            this.resetTimeout();
            
            // Load data (to be implemented by subclasses)
            await this.loadData();
            
            this.state.initialized = true;
            this.debugLog(`${this.adapterType} adapter initialization complete`);
            
        } catch (error) {
            this.handleError('Initialization failed', error);
        }
    }

    // State Management
    resetState() {
        this.state.dataProcessed = false;
        this.state.processing = false;
        this.state.error = null;
        this.masterBundle = null;
    }

    // Message Handling
    setupMessageListener() {
        const eventType = `caspio${this.adapterType.charAt(0).toUpperCase() + this.adapterType.slice(1)}MasterBundleReady`;
        
        window.addEventListener('message', (event) => {
            this.handleCaspioMessage(event, eventType);
        }, false);
        
        this.messageListenerAdded = true;
        this.debugLog(`Added message listener for ${eventType}`);
    }

    handleCaspioMessage(event, expectedType) {
        if (!event.data || event.data.type !== expectedType) {
            return; // Ignore irrelevant messages
        }

        // Prevent duplicate processing
        if (this.state.processing) {
            this.debugLog('Already processing master bundle, ignoring duplicate message');
            return;
        }

        this.debugLog('Received master bundle message. Origin:', event.origin);
        
        const isExpectedOrigin = this.EXPECTED_ORIGINS.includes(event.origin) ||
                                event.origin === window.location.origin;
        const isDevelopmentEnv = window.location.hostname === 'localhost';

        if (isExpectedOrigin || isDevelopmentEnv) {
            if (!isExpectedOrigin && isDevelopmentEnv) {
                this.debugLog(`Master bundle from unexpected origin (${event.origin}) but allowing in dev.`);
            }
            
            this.state.processing = true;
            this.processMasterBundle(event.data.detail);
            
            // Reset processing flag after delay
            setTimeout(() => {
                this.state.processing = false;
            }, 1000);
        } else {
            this.debugError('Master bundle from UNEXPECTED origin. Ignoring. Origin:', event.origin);
        }
    }

    // Master Bundle Processing
    async processMasterBundle(masterBundle) {
        this.debugLog('Processing Master Bundle:', masterBundle);
        
        try {
            this.clearMessages();
            this.state.dataProcessed = true;
            
            if (this.timeoutId) {
                clearTimeout(this.timeoutId);
                this.debugLog('Cleared timeout after receiving master bundle');
            }

            // Validate master bundle
            if (!this.validateMasterBundle(masterBundle)) {
                return;
            }

            // Store master bundle
            this.masterBundle = masterBundle;
            this.state.lastUpdate = Date.now();

            // Process specific data (to be implemented by subclasses)
            await this.processSpecificData(masterBundle);

            // Cache pricing data
            this.cachePricingData(masterBundle);

            // Trigger events
            this.triggerEvent('masterBundleReady', masterBundle);
            this.triggerEvent('dataProcessed', { type: this.adapterType, bundle: masterBundle });

            this.debugLog('Master bundle processed successfully');
            
        } catch (error) {
            this.handleError('Master bundle processing failed', error);
        }
    }

    validateMasterBundle(masterBundle) {
        if (!masterBundle || typeof masterBundle !== 'object') {
            this.handleError('Invalid or empty master bundle received');
            return false;
        }

        if (masterBundle.hasError) {
            this.handleError(masterBundle.errorMessage || 'Error in master bundle from Caspio');
            this.displayFallbackUI(masterBundle.errorMessage || 'Error occurred while fetching pricing information');
            return false;
        }

        return true;
    }

    // Pricing Cache Management
    cachePricingData(masterBundle) {
        const cacheKey = this.generateCacheKey(masterBundle);
        this.pricingCache.set(cacheKey, {
            data: masterBundle,
            timestamp: Date.now(),
            type: this.adapterType
        });

        // Clean old cache entries (keep only last 10)
        if (this.pricingCache.size > 10) {
            const oldestKey = this.pricingCache.keys().next().value;
            this.pricingCache.delete(oldestKey);
        }
    }

    generateCacheKey(data) {
        const keyParts = [
            this.adapterType,
            data.styleNumber || 'unknown',
            data.color || 'unknown',
            Date.now().toString()
        ];
        return keyParts.join('_');
    }

    getCachedData(key) {
        const cached = this.pricingCache.get(key);
        if (cached && (Date.now() - cached.timestamp) < 300000) { // 5 minutes
            return cached.data;
        }
        return null;
    }

    // Event System
    addEventListener(eventType, callback) {
        if (this.eventListeners[eventType]) {
            this.eventListeners[eventType].push(callback);
        } else {
            this.debugError('Unknown event type:', eventType);
        }
    }

    removeEventListener(eventType, callback) {
        if (this.eventListeners[eventType]) {
            const index = this.eventListeners[eventType].indexOf(callback);
            if (index > -1) {
                this.eventListeners[eventType].splice(index, 1);
            }
        }
    }

    triggerEvent(eventType, data = null) {
        if (this.eventListeners[eventType]) {
            this.eventListeners[eventType].forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    this.debugError(`Error in event listener for ${eventType}:`, error);
                }
            });
        }

        // Also dispatch global window event
        const eventName = `${this.adapterType}${eventType.charAt(0).toUpperCase() + eventType.slice(1)}`;
        window.dispatchEvent(new CustomEvent(eventName, { detail: data }));
    }

    // UI Management
    initializeUI() {
        this.showInitialState();
    }

    showInitialState() {
        const initialState = document.getElementById(this.DOM_IDS.initialState);
        const loadingSpinner = document.getElementById(this.DOM_IDS.loadingSpinner);
        const pricingGrid = document.getElementById(this.DOM_IDS.pricingGrid);
        
        if (initialState) initialState.style.display = 'block';
        if (loadingSpinner) loadingSpinner.style.display = 'none';
        if (pricingGrid) pricingGrid.style.display = 'none';
    }

    showLoadingState() {
        this.debugLog('Showing loading state');
        
        const initialState = document.getElementById(this.DOM_IDS.initialState);
        const loadingSpinner = document.getElementById(this.DOM_IDS.loadingSpinner);
        const pricingGrid = document.getElementById(this.DOM_IDS.pricingGrid);
        
        if (initialState) initialState.style.display = 'none';
        if (loadingSpinner) loadingSpinner.style.display = 'block';
        if (pricingGrid) {
            pricingGrid.style.opacity = '0';
            pricingGrid.style.transform = 'translateY(20px)';
        }
    }

    // Message Display
    displayError(message) {
        const errorDiv = document.getElementById(this.DOM_IDS.errorMessage);
        if (errorDiv) {
            errorDiv.textContent = message;
            errorDiv.style.display = 'block';
        }
        
        const fallbackDiv = document.getElementById(this.DOM_IDS.fallbackUI);
        if (fallbackDiv) fallbackDiv.style.display = 'none';
        
        this.triggerEvent('errorOccurred', { message, type: 'error' });
    }

    displayFallbackUI(message) {
        const fallbackDiv = document.getElementById(this.DOM_IDS.fallbackUI);
        if (fallbackDiv) {
            fallbackDiv.innerHTML = `
                <p>${message}</p>
                <p>Please contact us or <a href="mailto:sales@nwcustomapparel.com?subject=Quote Request - ${this.adapterType.toUpperCase()}">email us for a quote</a>.</p>
            `;
            fallbackDiv.style.display = 'block';
        }
        
        const errorDiv = document.getElementById(this.DOM_IDS.errorMessage);
        if (errorDiv) errorDiv.style.display = 'none';
    }

    clearMessages() {
        const errorDiv = document.getElementById(this.DOM_IDS.errorMessage);
        if (errorDiv) errorDiv.style.display = 'none';
        
        const fallbackDiv = document.getElementById(this.DOM_IDS.fallbackUI);
        if (fallbackDiv) fallbackDiv.style.display = 'none';
    }

    // Timeout Management
    resetTimeout() {
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
        }
        
        this.state.dataProcessed = false;
        this.debugLog(`Setting timeout for ${this.config.timeout / 1000} seconds`);
        
        this.timeoutId = setTimeout(() => {
            if (!this.state.dataProcessed) {
                this.handleTimeout();
            }
        }, this.config.timeout);
    }

    handleTimeout() {
        this.debugError('Timeout: No master bundle message received');
        
        const pricingGrid = document.getElementById(this.DOM_IDS.pricingGrid);
        if (pricingGrid && pricingGrid.style.display !== 'none') {
            const tbody = pricingGrid.querySelector('tbody');
            if (tbody && tbody.innerHTML.trim() === '') {
                tbody.innerHTML = '<tr><td colspan="100%" style="text-align:center; padding:20px;">Please select options to view pricing.</td></tr>';
            }
        }
        
        this.triggerEvent('errorOccurred', { message: 'Timeout occurred', type: 'timeout' });
    }

    // Error Handling
    handleError(message, error = null) {
        this.state.error = message;
        this.debugError(message, error);
        this.displayError(message);
        this.triggerEvent('errorOccurred', { message, error, type: 'error' });
    }

    // Utility Methods
    formatPrice(price) {
        if (typeof price !== 'number' || isNaN(price)) {
            return '$0.00';
        }
        return '$' + price.toFixed(2);
    }

    formatPercentage(value) {
        if (typeof value !== 'number' || isNaN(value)) {
            return '0%';
        }
        return (value * 100).toFixed(1) + '%';
    }

    generateUniqueId() {
        return this.adapterType + '_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Methods to be implemented by subclasses
    async loadData() {
        // Subclasses should implement their specific data loading logic
        this.debugLog('loadData method should be implemented by subclass');
    }

    async processSpecificData(masterBundle) {
        // Subclasses should implement their specific data processing logic
        this.debugLog('processSpecificData method should be implemented by subclass');
    }

    // Pricing Utilities
    getPricingTier(quantity) {
        if (quantity <= 0) return "N/A";
        if (quantity >= 1 && quantity <= 23) return "1-23";
        if (quantity >= 24 && quantity <= 47) return "24-47";
        if (quantity >= 48 && quantity <= 71) return "48-71";
        if (quantity >= 72) return "72+";
        return "Unknown";
    }

    calculateLTMFee(quantity, threshold = 24, feeAmount = 50.00) {
        if (quantity < threshold) {
            return {
                shouldApply: true,
                totalFee: feeAmount,
                perItem: feeAmount / quantity,
                threshold: threshold
            };
        }
        return {
            shouldApply: false,
            totalFee: 0,
            perItem: 0,
            threshold: threshold
        };
    }

    // Debug Logging
    debugLog(...args) {
        if (this.config.debug) {
            console.log(`[${this.adapterType.toUpperCase()}:ADAPTER]`, ...args);
        }
    }

    debugError(...args) {
        if (this.config.debug) {
            console.error(`[${this.adapterType.toUpperCase()}:ADAPTER]`, ...args);
        }
    }

    debugWarn(...args) {
        if (this.config.debug) {
            console.warn(`[${this.adapterType.toUpperCase()}:ADAPTER]`, ...args);
        }
    }

    // Public API
    getMasterBundle() {
        return this.masterBundle;
    }

    getState() {
        return { ...this.state };
    }

    isInitialized() {
        return this.state.initialized;
    }

    hasData() {
        return this.state.dataProcessed && this.masterBundle !== null;
    }

    clearCache() {
        this.pricingCache.clear();
        this.debugLog('Pricing cache cleared');
    }
}

// Make BaseAdapter available globally
window.BaseAdapter = BaseAdapter;

console.log('[BaseAdapter] Base adapter class loaded');