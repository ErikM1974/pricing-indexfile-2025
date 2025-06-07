# Phase 5: API Consolidation Migration Guide

## Overview
This guide provides instructions for migrating existing API calls to use the new unified API client introduced in Phase 5 of the refactoring project.

## Benefits of Migration
- **Unified error handling**: Automatic retry logic and consistent error messages
- **Smart caching**: LRU cache with TTL support and cache strategies
- **Offline support**: Request queuing when offline with automatic sync
- **Request interceptors**: Add auth headers, logging, and transformations
- **Performance tracking**: Built-in latency monitoring and statistics
- **Type safety**: JSDoc annotations for better IDE support

## Migration Steps

### 1. Import the Unified API Client

**Before:**
```javascript
// Direct fetch calls
fetch('/api/endpoint', { 
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
});
```

**After:**
```javascript
import { getAPIClient, API_ENDPOINTS } from '../shared/api';

const api = getAPIClient();
```

### 2. Replace Fetch Calls

#### GET Requests

**Before:**
```javascript
async function getPricingMatrix(matrixId) {
    try {
        const response = await fetch(`/api/pricing-matrix/${matrixId}`);
        if (!response.ok) throw new Error('Failed to fetch');
        return await response.json();
    } catch (error) {
        console.error('Error:', error);
        return null;
    }
}
```

**After:**
```javascript
async function getPricingMatrix(matrixId) {
    const response = await api.get(
        API_ENDPOINTS.PRICING.MATRIX.replace(':id', matrixId),
        {
            cache: true,
            cacheTime: 3600000 // 1 hour
        }
    );
    return response;
}
```

#### POST Requests

**Before:**
```javascript
async function saveQuote(quoteData) {
    try {
        const response = await fetch('/api/quotes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(quoteData)
        });
        if (!response.ok) throw new Error('Failed to save');
        return await response.json();
    } catch (error) {
        console.error('Error:', error);
        throw error;
    }
}
```

**After:**
```javascript
async function saveQuote(quoteData) {
    const response = await api.post(
        API_ENDPOINTS.QUOTES.CREATE,
        quoteData,
        {
            queueOffline: true,
            priority: 'high'
        }
    );
    return response;
}
```

### 3. Implement Caching Strategies

```javascript
// Network-first (default)
await api.get(url, { cache: true });

// Cache-first
await api.get(url, { 
    cache: true,
    cacheStrategy: 'CACHE_FIRST' 
});

// Cache-only
await api.get(url, { 
    cache: true,
    cacheStrategy: 'CACHE_ONLY' 
});

// Custom TTL
await api.get(url, { 
    cache: true,
    cacheTime: 300000 // 5 minutes
});
```

### 4. Handle Offline Scenarios

```javascript
// Queue requests when offline
const response = await api.post(url, data, {
    queueOffline: true,
    priority: 'high' // 'low', 'normal', 'high'
});

// Check if request was queued
if (response.queued) {
    console.log('Request queued for later');
}
```

### 5. Add Custom Interceptors

```javascript
// Add authentication header
const authInterceptor = api.interceptors.useRequest((config) => {
    config.headers.Authorization = `Bearer ${getToken()}`;
    return config;
});

// Transform response data
const transformInterceptor = api.interceptors.useResponse((response) => {
    if (response.data.prices) {
        response.data.formattedPrices = formatPrices(response.data.prices);
    }
    return response;
});

// Handle specific errors
const errorInterceptor = api.interceptors.useError((error) => {
    if (error.status === 401) {
        redirectToLogin();
    }
    return Promise.reject(error);
});
```

## File-Specific Migration Examples

### 1. quote-api-client.js Migration

**Key changes:**
- Replace all `fetch()` calls with `api` methods
- Remove manual retry logic (handled by unified client)
- Use built-in error handling

```javascript
// Before
async createQuoteSession(sessionData) {
    const response = await this._makeRequest('/quote_sessions', {
        method: 'POST',
        body: JSON.stringify(sessionData)
    });
    return response;
}

// After
async createQuoteSession(sessionData) {
    return await api.post(API_ENDPOINTS.QUOTES.CREATE, sessionData, {
        queueOffline: true
    });
}
```

### 2. pricing-matrix-api.js Migration

**Key changes:**
- Use built-in caching instead of localStorage
- Remove fallback logic (handled by cache)

```javascript
// Before
async function fetchPricingMatrix(matrixId) {
    const cached = localStorage.getItem(`matrix-${matrixId}`);
    if (cached) return JSON.parse(cached);
    
    const response = await fetch(`/api/pricing-matrix/${matrixId}`);
    const data = await response.json();
    
    localStorage.setItem(`matrix-${matrixId}`, JSON.stringify(data));
    return data;
}

// After
async function fetchPricingMatrix(matrixId) {
    return await api.get(
        buildUrl(API_ENDPOINTS.PRICING.MATRIX_BY_ID, { matrixId }),
        {
            cache: true,
            cacheTime: 3600000, // 1 hour
            cacheStrategy: 'NETWORK_FIRST'
        }
    );
}
```

### 3. cart.js Migration

**Key changes:**
- Consolidate multiple fetch calls
- Use request queuing for cart updates

```javascript
// Before
async updateCartItem(itemId, updates) {
    try {
        const response = await fetch(`/cart-items/${itemId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates)
        });
        return await response.json();
    } catch (error) {
        console.error('Failed to update cart:', error);
    }
}

// After
async updateCartItem(itemId, updates) {
    return await api.patch(
        buildUrl(API_ENDPOINTS.CART.UPDATE_ITEM, { itemId }),
        updates,
        {
            queueOffline: true,
            priority: 'high',
            retry: true
        }
    );
}
```

## Testing Your Migration

1. **Unit Tests**: Update tests to mock the unified API client
```javascript
import { getAPIClient } from '../shared/api';
jest.mock('../shared/api');

const mockApi = {
    get: jest.fn(),
    post: jest.fn()
};
getAPIClient.mockReturnValue(mockApi);
```

2. **Integration Tests**: Use the test file provided
```bash
open test-files/test-api-phase5-integration.html
```

3. **Network Testing**: Test offline behavior
- Disable network in DevTools
- Make API calls
- Re-enable network
- Verify queued requests are sent

## Common Pitfalls and Solutions

### 1. Forgetting to Handle Queued Responses
```javascript
// Always check if response was queued
const response = await api.post(url, data, { queueOffline: true });
if (response.queued) {
    // Handle queued state in UI
    showMessage('Your changes will be saved when you're back online');
}
```

### 2. Not Cleaning Up Interceptors
```javascript
// Store interceptor IDs
const interceptorId = api.interceptors.useRequest(config => config);

// Clean up when done
api.interceptors.ejectRequest(interceptorId);
```

### 3. Incorrect Cache Configuration
```javascript
// Don't cache user-specific data globally
await api.get('/api/user/profile', {
    cache: true,
    cacheKey: `user-profile-${userId}` // User-specific cache key
});
```

## Rollback Plan

If issues arise during migration:

1. **Feature Flag**: Use environment variable to toggle between old and new API
```javascript
const useUnifiedAPI = process.env.USE_UNIFIED_API === 'true';

if (useUnifiedAPI) {
    // New unified API
    return await api.get(url);
} else {
    // Legacy fetch
    return await fetch(url).then(r => r.json());
}
```

2. **Gradual Migration**: Migrate one file at a time
3. **A/B Testing**: Run both implementations and compare results

## Next Steps

After completing the migration:

1. Remove legacy API code
2. Update documentation
3. Train team on new API patterns
4. Monitor performance metrics
5. Collect feedback and iterate

## Support

For questions or issues during migration:
- Check the API documentation in `/src/shared/api/README.md`
- Review test examples in `/test-files/test-api-phase5-integration.html`
- Contact the technical lead for assistance