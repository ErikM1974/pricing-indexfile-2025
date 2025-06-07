// API Endpoints Configuration
// Phase 5: API Consolidation

/**
 * API endpoint definitions
 */
export const API_ENDPOINTS = {
  // Base URLs
  BASE_URL: process.env.API_URL || '',
  
  // Pricing endpoints
  PRICING: {
    MATRIX: '/api/pricing/matrix',
    CALCULATE: '/api/pricing/calculate',
    BULK_CALCULATE: '/api/pricing/bulk-calculate',
    TIERS: '/api/pricing/tiers',
    DISCOUNTS: '/api/pricing/discounts'
  },
  
  // Product endpoints
  PRODUCTS: {
    LIST: '/api/products',
    DETAIL: '/api/products/:id',
    SEARCH: '/api/products/search',
    CATEGORIES: '/api/products/categories',
    INVENTORY: '/api/products/:id/inventory',
    COLORS: '/api/products/:id/colors',
    SIZES: '/api/products/:id/sizes'
  },
  
  // Quote endpoints
  QUOTES: {
    LIST: '/api/quotes',
    CREATE: '/api/quotes',
    DETAIL: '/api/quotes/:id',
    UPDATE: '/api/quotes/:id',
    DELETE: '/api/quotes/:id',
    ITEMS: '/api/quotes/:id/items',
    ADD_ITEM: '/api/quotes/:id/items',
    UPDATE_ITEM: '/api/quotes/:id/items/:itemId',
    DELETE_ITEM: '/api/quotes/:id/items/:itemId',
    DUPLICATE: '/api/quotes/:id/duplicate',
    CONVERT_TO_ORDER: '/api/quotes/:id/convert'
  },
  
  // Order endpoints
  ORDERS: {
    LIST: '/api/orders',
    CREATE: '/api/orders',
    DETAIL: '/api/orders/:id',
    UPDATE: '/api/orders/:id',
    CANCEL: '/api/orders/:id/cancel',
    TRACKING: '/api/orders/:id/tracking'
  },
  
  // Cart endpoints
  CART: {
    GET: '/api/cart',
    ADD_ITEM: '/api/cart/items',
    UPDATE_ITEM: '/api/cart/items/:itemId',
    REMOVE_ITEM: '/api/cart/items/:itemId',
    CLEAR: '/api/cart/clear',
    CHECKOUT: '/api/cart/checkout'
  },
  
  // Embellishment endpoints
  EMBELLISHMENTS: {
    EMBROIDERY: {
      CALCULATE: '/api/embellishments/embroidery/calculate',
      VALIDATE: '/api/embellishments/embroidery/validate',
      ESTIMATE_STITCHES: '/api/embellishments/embroidery/estimate-stitches'
    },
    SCREEN_PRINT: {
      CALCULATE: '/api/embellishments/screen-print/calculate',
      VALIDATE: '/api/embellishments/screen-print/validate'
    },
    DTG: {
      CALCULATE: '/api/embellishments/dtg/calculate',
      VALIDATE: '/api/embellishments/dtg/validate',
      CHECK_COMPATIBILITY: '/api/embellishments/dtg/check-compatibility'
    },
    DTF: {
      CALCULATE: '/api/embellishments/dtf/calculate',
      VALIDATE: '/api/embellishments/dtf/validate'
    }
  },
  
  // User endpoints
  USER: {
    PROFILE: '/api/user/profile',
    PREFERENCES: '/api/user/preferences',
    ADDRESSES: '/api/user/addresses',
    SAVED_QUOTES: '/api/user/quotes',
    ORDER_HISTORY: '/api/user/orders'
  },
  
  // Auth endpoints
  AUTH: {
    LOGIN: '/api/auth/login',
    LOGOUT: '/api/auth/logout',
    REFRESH: '/api/auth/refresh',
    REGISTER: '/api/auth/register',
    FORGOT_PASSWORD: '/api/auth/forgot-password',
    RESET_PASSWORD: '/api/auth/reset-password'
  },
  
  // Utility endpoints
  UTILS: {
    UPLOAD: '/api/utils/upload',
    SEARCH: '/api/utils/search',
    AUTOCOMPLETE: '/api/utils/autocomplete',
    VALIDATE_ADDRESS: '/api/utils/validate-address',
    CALCULATE_SHIPPING: '/api/utils/calculate-shipping'
  }
};

/**
 * Build URL with path parameters
 * @param {string} endpoint - Endpoint template
 * @param {Object} params - Path parameters
 * @returns {string} Built URL
 */
export function buildUrl(endpoint, params = {}) {
  let url = endpoint;
  
  // Replace path parameters
  Object.entries(params).forEach(([key, value]) => {
    url = url.replace(`:${key}`, encodeURIComponent(value));
  });
  
  return url;
}

/**
 * Get endpoint by key path
 * @param {string} path - Dot-separated path (e.g., 'QUOTES.CREATE')
 * @returns {string} Endpoint URL
 */
export function getEndpoint(path) {
  const keys = path.split('.');
  let current = API_ENDPOINTS;
  
  for (const key of keys) {
    if (current[key] === undefined) {
      throw new Error(`Invalid endpoint path: ${path}`);
    }
    current = current[key];
  }
  
  if (typeof current !== 'string') {
    throw new Error(`Invalid endpoint path: ${path}`);
  }
  
  return current;
}

/**
 * Endpoint configuration with caching and retry policies
 */
export const ENDPOINT_CONFIG = {
  // Pricing matrix - cache aggressively
  [API_ENDPOINTS.PRICING.MATRIX]: {
    cache: true,
    cacheTime: 3600000, // 1 hour
    retry: true,
    maxRetries: 3
  },
  
  // Product list - cache with shorter TTL
  [API_ENDPOINTS.PRODUCTS.LIST]: {
    cache: true,
    cacheTime: 300000, // 5 minutes
    retry: true
  },
  
  // Quote operations - no caching
  [API_ENDPOINTS.QUOTES.CREATE]: {
    cache: false,
    retry: false,
    queueOffline: true
  },
  
  // Order operations - critical, queue if offline
  [API_ENDPOINTS.ORDERS.CREATE]: {
    cache: false,
    retry: true,
    maxRetries: 5,
    queueOffline: true,
    priority: 'high'
  },
  
  // Auth operations - no caching, no queuing
  [API_ENDPOINTS.AUTH.LOGIN]: {
    cache: false,
    retry: false,
    queueOffline: false
  }
};

/**
 * Get configuration for endpoint
 * @param {string} endpoint - Endpoint URL
 * @returns {Object} Endpoint configuration
 */
export function getEndpointConfig(endpoint) {
  // Direct match
  if (ENDPOINT_CONFIG[endpoint]) {
    return ENDPOINT_CONFIG[endpoint];
  }
  
  // Pattern matching
  for (const [pattern, config] of Object.entries(ENDPOINT_CONFIG)) {
    if (pattern.includes(':') && matchEndpointPattern(endpoint, pattern)) {
      return config;
    }
  }
  
  // Default configuration
  return {
    cache: true,
    cacheTime: 60000, // 1 minute
    retry: true,
    maxRetries: 3,
    queueOffline: true
  };
}

/**
 * Match endpoint against pattern
 * @private
 */
function matchEndpointPattern(endpoint, pattern) {
  const regex = pattern
    .replace(/:[^/]+/g, '[^/]+')
    .replace(/\//g, '\\/');
  
  return new RegExp(`^${regex}$`).test(endpoint);
}

/**
 * API versioning helper
 */
export const API_VERSIONS = {
  V1: '/v1',
  V2: '/v2',
  CURRENT: '/v1'
};

/**
 * Build versioned endpoint
 * @param {string} endpoint - Endpoint path
 * @param {string} version - API version
 * @returns {string} Versioned endpoint
 */
export function versionedEndpoint(endpoint, version = API_VERSIONS.CURRENT) {
  return `${version}${endpoint}`;
}