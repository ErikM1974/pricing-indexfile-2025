// shared_components/js/base-cart-manager.js
/**
 * Base Cart Manager for Northwest Custom Apparel
 * Provides common cart functionality that can be inherited by specific cart implementations
 * Part of Phase 5 - Base Class Creation & Code Consolidation
 */

class BaseCartManager {
    constructor(config = {}) {
        // API Configuration
        this.API_BASE_URL = config.apiBaseUrl || 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api';
        
        // API Endpoints
        this.ENDPOINTS = {
            cartSessions: {
                getAll: `${this.API_BASE_URL}/cart-sessions`,
                getById: (id) => `${this.API_BASE_URL}/cart-sessions?sessionID=${id}`,
                create: `${this.API_BASE_URL}/cart-sessions`,
                update: (id) => `${this.API_BASE_URL}/cart-sessions/${id}`,
                delete: (id) => `${this.API_BASE_URL}/cart-sessions/${id}`
            },
            cartItems: {
                getAll: `${this.API_BASE_URL}/cart-items`,
                getBySession: (sessionId) => `${this.API_BASE_URL}/cart-items?sessionID=${sessionId}`,
                create: `${this.API_BASE_URL}/cart-items`,
                update: (id) => `${this.API_BASE_URL}/cart-items/${id}`,
                delete: (id) => `${this.API_BASE_URL}/cart-items/${id}`
            },
            cartItemSizes: {
                getAll: `${this.API_BASE_URL}/cart-item-sizes`,
                getByCartItem: (cartItemId) => `${this.API_BASE_URL}/cart-item-sizes?cartItemID=${cartItemId}`,
                create: `${this.API_BASE_URL}/cart-item-sizes`,
                update: (id) => `${this.API_BASE_URL}/cart-item-sizes/${id}`,
                delete: (id) => `${this.API_BASE_URL}/cart-item-sizes/${id}`
            },
            inventory: {
                getByStyleAndColor: (styleNumber, color) =>
                    `${this.API_BASE_URL}/inventory?styleNumber=${encodeURIComponent(styleNumber)}&color=${encodeURIComponent(color)}`
            }
        };

        // Local Storage Keys
        this.STORAGE_KEYS = {
            sessionId: config.sessionIdKey || 'nwca_cart_session_id',
            cartItems: config.cartItemsKey || 'nwca_cart_items',
            lastSync: config.lastSyncKey || 'nwca_cart_last_sync'
        };

        // Cart State
        this.cartState = {
            sessionId: null,
            items: [],
            loading: true,
            error: null,
            lastSync: null
        };

        // Event Listeners
        this.eventListeners = {
            cartUpdated: [],
            itemAdded: [],
            itemRemoved: [],
            sessionCreated: []
        };

        // Configuration
        this.config = {
            debug: config.debug || false,
            autoSync: config.autoSync !== false, // Default to true
            syncInterval: config.syncInterval || 60000, // 60 seconds
            maxRetries: config.maxRetries || 3,
            retryDelay: config.retryDelay || 1000
        };

        // Initialize flag
        this.isInitialized = false;
    }

    // Session Management
    generateSessionId() {
        return 'sess_' + Math.random().toString(36).substring(2, 10) + '_' + Date.now();
    }

    generateLocalSessionId() {
        return 'local_' + Math.random().toString(36).substring(2, 15) +
               Math.random().toString(36).substring(2, 15);
    }

    // Local Storage Operations
    saveToLocalStorage() {
        try {
            localStorage.setItem(this.STORAGE_KEYS.cartItems, JSON.stringify(this.cartState.items));
            localStorage.setItem(this.STORAGE_KEYS.lastSync, Date.now().toString());
            this.cartState.lastSync = Date.now();
            this.debugLog('Saved cart to localStorage', this.cartState.items.length + ' items');
        } catch (error) {
            this.debugError('Error saving to localStorage:', error);
        }
    }

    loadFromLocalStorage() {
        try {
            const storedItems = localStorage.getItem(this.STORAGE_KEYS.cartItems);
            const lastSync = localStorage.getItem(this.STORAGE_KEYS.lastSync);

            if (storedItems) {
                this.cartState.items = JSON.parse(storedItems);
                this.debugLog('Loaded from localStorage', this.cartState.items.length + ' items');
            }

            if (lastSync) {
                this.cartState.lastSync = parseInt(lastSync, 10);
            }
        } catch (error) {
            this.debugError('Error loading from localStorage:', error);
            this.cartState.items = [];
        }
    }

    clearLocalStorage() {
        try {
            localStorage.removeItem(this.STORAGE_KEYS.sessionId);
            localStorage.removeItem(this.STORAGE_KEYS.cartItems);
            localStorage.removeItem(this.STORAGE_KEYS.lastSync);
            this.debugLog('Cleared localStorage');
        } catch (error) {
            this.debugError('Error clearing localStorage:', error);
        }
    }

    // API Operations with Retry Logic
    async apiRequest(url, options = {}, retries = 0) {
        try {
            const response = await fetch(url, {
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                ...options
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            // Handle empty responses
            const text = await response.text();
            if (!text) {
                return null;
            }

            try {
                return JSON.parse(text);
            } catch (parseError) {
                // If it's not JSON, return the text
                return text;
            }
        } catch (error) {
            this.debugError(`API request failed (attempt ${retries + 1}):`, error);

            if (retries < this.config.maxRetries) {
                this.debugLog(`Retrying in ${this.config.retryDelay}ms...`);
                await this.delay(this.config.retryDelay);
                return this.apiRequest(url, options, retries + 1);
            }

            throw error;
        }
    }

    // Session Operations
    async createLocalSession() {
        try {
            const sessionId = this.generateLocalSessionId();
            this.cartState.sessionId = sessionId;
            localStorage.setItem(this.STORAGE_KEYS.sessionId, sessionId);

            if (!this.cartState.items || !Array.isArray(this.cartState.items)) {
                this.cartState.items = [];
            }

            this.saveToLocalStorage();
            this.debugLog('Created local session:', sessionId);
            this.triggerEvent('sessionCreated', { sessionId, type: 'local' });
            return sessionId;
        } catch (error) {
            this.debugError('Error creating local session:', error);
            this.cartState.error = 'Unable to create a shopping cart session';
            throw error;
        }
    }

    async createNewSession() {
        try {
            const sessionId = this.generateSessionId();
            const sessionData = {
                SessionID: sessionId,
                CreateDate: new Date().toISOString(),
                IPAddress: await this.getClientIP(),
                UserAgent: navigator.userAgent,
                IsActive: true
            };

            this.debugLog('Creating new session with API:', sessionData);
            
            try {
                await this.apiRequest(this.ENDPOINTS.cartSessions.create, {
                    method: 'POST',
                    body: JSON.stringify(sessionData)
                });

                this.cartState.sessionId = sessionId;
                localStorage.setItem(this.STORAGE_KEYS.sessionId, sessionId);
                this.debugLog('Created new session:', sessionId);
                this.triggerEvent('sessionCreated', { sessionId, type: 'api' });
                return sessionId;
            } catch (apiError) {
                this.debugError('API session creation failed, falling back to local:', apiError);
                return this.createLocalSession();
            }
        } catch (error) {
            this.debugError('Error creating session:', error);
            throw error;
        }
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
    }

    // Utility Methods
    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async getClientIP() {
        try {
            // Try to get client IP (this may not work in all browsers/environments)
            return 'unknown';
        } catch (error) {
            return 'unknown';
        }
    }

    formatPrice(price) {
        if (typeof price !== 'number' || isNaN(price)) {
            return '$0.00';
        }
        return '$' + price.toFixed(2);
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

    calculateLTMFee(totalQuantity, embellishmentType = 'general') {
        const ltmConfig = this.getLTMConfig(embellishmentType);
        
        if (totalQuantity < ltmConfig.threshold) {
            return {
                shouldApply: true,
                totalFee: ltmConfig.feeAmount,
                perItem: ltmConfig.feeAmount / totalQuantity,
                threshold: ltmConfig.threshold
            };
        }
        
        return {
            shouldApply: false,
            totalFee: 0,
            perItem: 0,
            threshold: ltmConfig.threshold
        };
    }

    getLTMConfig(embellishmentType) {
        const feesConfig = window.NWCA_APP_CONFIG?.FEES || {};
        
        if (embellishmentType === 'cap-embroidery') {
            return {
                threshold: feesConfig.LTM_CAP_MINIMUM_QUANTITY || 24,
                feeAmount: feesConfig.LTM_CAP_FEE_AMOUNT || 50.00
            };
        }
        
        return {
            threshold: feesConfig.LTM_GENERAL_THRESHOLD || 24,
            feeAmount: feesConfig.LTM_GENERAL_FEE_AMOUNT || 50.00
        };
    }

    // Cart Operations (to be implemented by subclasses)
    async addItem(item) {
        throw new Error('addItem method must be implemented by subclass');
    }

    async removeItem(itemId) {
        throw new Error('removeItem method must be implemented by subclass');
    }

    async updateItem(itemId, updates) {
        throw new Error('updateItem method must be implemented by subclass');
    }

    async getItems() {
        return this.cartState.items;
    }

    async getItemCount() {
        return this.cartState.items.reduce((total, item) => total + (item.quantity || 0), 0);
    }

    async getTotalPrice() {
        return this.cartState.items.reduce((total, item) => {
            const itemTotal = (item.quantity || 0) * (item.unitPrice || 0);
            return total + itemTotal;
        }, 0);
    }

    // Synchronization (to be implemented by subclasses)
    async syncWithServer() {
        throw new Error('syncWithServer method must be implemented by subclass');
    }

    // Initialization
    async initialize() {
        try {
            this.debugLog('Initializing BaseCartManager...');
            this.cartState.loading = true;

            // Load from localStorage first
            this.loadFromLocalStorage();

            // Check for existing session
            const storedSessionId = localStorage.getItem(this.STORAGE_KEYS.sessionId);
            
            if (storedSessionId) {
                await this.validateSession(storedSessionId);
            } else {
                await this.createNewSession();
            }

            // Sync with server if auto-sync is enabled
            if (this.config.autoSync) {
                try {
                    await this.syncWithServer();
                } catch (syncError) {
                    this.debugError('Could not sync with server, using local storage only:', syncError);
                }
            }

            this.cartState.loading = false;
            this.isInitialized = true;
            this.triggerEvent('cartUpdated');
            
            this.debugLog('BaseCartManager initialization complete');
        } catch (error) {
            this.debugError('Error initializing BaseCartManager:', error);
            this.cartState.error = 'Failed to initialize cart';
            this.cartState.loading = false;
            this.triggerEvent('cartUpdated');
        }
    }

    async validateSession(sessionId) {
        try {
            const response = await this.apiRequest(this.ENDPOINTS.cartSessions.getById(sessionId));
            
            if (response && response.length > 0 && response[0].IsActive) {
                this.cartState.sessionId = sessionId;
                this.debugLog('Using existing active session:', sessionId);
                return true;
            } else {
                this.debugLog('Session invalid or inactive, creating new session');
                await this.createNewSession();
                return false;
            }
        } catch (error) {
            this.debugError('Error validating session:', error);
            await this.createNewSession();
            return false;
        }
    }

    // Debug Logging
    debugLog(...args) {
        if (this.config.debug) {
            console.log('[BaseCartManager]', ...args);
        }
    }

    debugError(...args) {
        if (this.config.debug) {
            console.error('[BaseCartManager]', ...args);
        }
    }
}

// Make BaseCartManager available globally
window.BaseCartManager = BaseCartManager;

console.log('[BaseCartManager] Base cart manager class loaded');