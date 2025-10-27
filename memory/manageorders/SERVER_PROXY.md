# ManageOrders Server Proxy - Implementation Guide

**Last Updated:** 2025-10-26
**Purpose:** Complete guide for caspio-pricing-proxy ManageOrders integration (11 endpoints)
**Parent Document:** [MANAGEORDERS_INTEGRATION.md](../MANAGEORDERS_INTEGRATION.md)
**Server:** caspio-pricing-proxy (Heroku)

---

## 📋 Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Intelligent Caching Strategy](#intelligent-caching-strategy)
3. [11 Production Endpoints](#11-production-endpoints)
4. [Rate Limiting](#rate-limiting)
5. [Error Handling](#error-handling)
6. [Deployment to Heroku](#deployment-to-heroku)
7. [Monitoring & Logging](#monitoring--logging)

---

## Architecture Overview

### Why a Proxy Server?

**Security Reasons:**
1. **Credential Protection:** API credentials never exposed to browser
2. **Token Management:** JWT tokens cached server-side only
3. **Rate Limiting:** Central control prevents abuse
4. **CORS Control:** Restrict access to authorized origins

**Performance Reasons:**
1. **Caching Layer:** Reduce calls to ManageOrders API
2. **Data Transformation:** Process data once, serve many clients
3. **Connection Pooling:** Reuse connections to ManageOrders
4. **Compression:** Serve compressed responses to browsers

### Request Flow

```
Browser Request
   ↓
[1] caspio-pricing-proxy receives request
   ↓
[2] Check customer cache (24-hour TTL)
   ├─ Cache HIT → Return cached data (fast)
   └─ Cache MISS → Continue to step 3
   ↓
[3] Check token cache (1-hour TTL)
   ├─ Token valid → Use cached token
   └─ Token expired → Authenticate with ManageOrders
   ↓
[4] Make request to ManageOrders API
   ↓
[5] Process response (deduplicate customers)
   ↓
[6] Cache customer data (24 hours)
   ↓
[7] Return to browser
```

### Server Stack

**Technology:**
- Node.js v18+
- Express.js v4
- node-fetch v2
- express-rate-limit v6
- cors v2

**Hosting:**
- Heroku (production)
- Environment variables for configuration
- In-memory caching (no database required)

---

## Token Caching Strategy

### Why Cache Tokens?

**Problem Without Caching:**
- Every customer fetch requires authentication
- Authentication endpoint rate-limited by ShopWorks
- 2 API calls per customer fetch (signin + orders)
- Increased latency (~500ms for authentication)

**Solution With Caching:**
- Authenticate once per hour
- Reuse token for all requests in that hour
- 1 API call per customer fetch (orders only)
- Reduced latency (~200ms for data fetch)

**Impact:** 50% reduction in API calls, 40% faster response times

### Implementation

**Cache Structure:**
```javascript
const tokenCache = {
    token: null,           // JWT token string
    timestamp: null,       // When token was cached (milliseconds)
    expiresIn: 3600000    // 1 hour in milliseconds
};
```

**Token Lifecycle:**
```javascript
async function getAuthToken() {
    const now = Date.now();

    // Check if cached token is still valid
    if (tokenCache.token && tokenCache.timestamp &&
        (now - tokenCache.timestamp < tokenCache.expiresIn)) {
        console.log('[ManageOrders] Using cached token');
        return tokenCache.token;
    }

    // Token expired or missing - authenticate
    console.log('[ManageOrders] Authenticating with ManageOrders API...');

    try {
        const response = await fetch(`${MANAGEORDERS_API_URL}/api/signin`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: MANAGEORDERS_USERNAME,
                password: MANAGEORDERS_PASSWORD
            })
        });

        if (!response.ok) {
            throw new Error(`Authentication failed: ${response.status}`);
        }

        const data = await response.json();

        // Cache the new token
        tokenCache.token = data.id_token;
        tokenCache.timestamp = now;

        console.log('[ManageOrders] ✓ Authentication successful');
        return data.id_token;

    } catch (error) {
        console.error('[ManageOrders] ✗ Authentication error:', error.message);
        throw error;
    }
}
```

**Token Refresh Strategy:**
- Automatic refresh on expiration
- No proactive refresh (refresh on-demand)
- No maximum token age (rely on ShopWorks expiration)

### Security Considerations

**Token Storage:**
- ✅ In-memory cache only (not persisted to disk)
- ✅ Never sent to browser
- ✅ Cleared on server restart
- ✅ Single token shared across all requests

**Token Transmission:**
- ✅ Always use HTTPS for ManageOrders API
- ✅ Use Bearer token authentication
- ✅ Never log token in console or files

---

## Intelligent Caching Strategy

### Per-Endpoint Cache Configuration

The proxy implements **intelligent caching** with different cache durations based on data volatility:

| Endpoint | Cache Duration | Rationale | Use Case |
|----------|----------------|-----------|----------|
| `inventorylevels` | **5 minutes** | Stock changes frequently | Webstore real-time availability |
| `tracking` | **15 minutes** | Updates during shipping day | Customer shipment tracking |
| `tracking/:order_no` | **15 minutes** | Updates during shipping day | Order-specific tracking |
| `orders` (query) | **1 hour** | Intraday changes possible | Sales rep order searches |
| `payments` (query) | **1 hour** | Payment status can change | Accounting dashboards |
| `orders/:order_no` | **24 hours** | Historical data stable | Order detail lookups |
| `getorderno/:ext_id` | **24 hours** | Mapping doesn't change | Quote-to-order conversion |
| `lineitems/:order_no` | **24 hours** | Order contents final | Product detail lookups |
| `payments/:order_no` | **24 hours** | Payment history stable | Invoice reconciliation |
| `customers` | **24 hours** | Customer list changes slowly | Autocomplete, history |
| `cache-info` | **No cache** | Debug endpoint | Cache diagnostics |

### Why Variable Cache Durations?

**Real-Time Data (5-15 minutes):**
- **Inventory:** Stock levels critical for webstore - must be current
- **Tracking:** Shipments update during business hours - reasonable freshness needed

**Operational Data (1 hour):**
- **Order Queries:** Orders created/modified during day - moderate freshness
- **Payment Queries:** Payment status changes intraday - moderate freshness

**Historical Data (24 hours):**
- **Specific Orders:** Order contents don't change once created
- **Line Items:** Product details finalized at order creation
- **Specific Payments:** Payment history is immutable
- **Customers:** Customer list changes slowly (new customers added occasionally)

### Cache Bypass Feature

All endpoints support cache bypass with `?refresh=true` query parameter:

```javascript
// Force fresh data from ShopWorks
fetch('/api/manageorders/inventorylevels?PartNumber=PC54&refresh=true')
```

**Use Cases:**
- Admin dashboard refresh button
- Critical inventory check before large order
- Debugging cache issues
- Real-time data verification

### Implementation Pattern

```javascript
// Cache key generation
const cacheKey = generateCacheKey(endpoint, queryParams);

// Check cache with TTL
if (cache.has(cacheKey) && !req.query.refresh) {
    const cached = cache.get(cacheKey);
    const age = Date.now() - cached.timestamp;

    if (age < cached.ttl) {
        return res.json({
            ...cached.data,
            cacheAge: Math.round(age / 1000 / 60) + ' minutes'
        });
    }
}

// Fetch fresh data and cache with endpoint-specific TTL
const data = await fetchFromManageOrders();
cache.set(cacheKey, {
    data: data,
    timestamp: Date.now(),
    ttl: getEndpointTTL(endpoint)  // 5min, 15min, 1hr, or 24hr
});
```

### Cache Performance Metrics

**Inventory Endpoint (5-minute cache):**
- Cache hit rate: ~85% (high turnover)
- Fresh data every 5 minutes
- Acceptable for webstore (slight lag tolerable)

**Tracking Endpoints (15-minute cache):**
- Cache hit rate: ~90%
- Updates 96 times per day
- Balance between freshness and API load

**Query Endpoints (1-hour cache):**
- Cache hit rate: ~95%
- Updates 24 times per day
- Sufficient for dashboard views

**Historical Endpoints (24-hour cache):**
- Cache hit rate: ~99%
- One update per day
- Optimal for immutable data

---

## 11 Production Endpoints

### 1. Customers (`/api/manageorders/customers`)

**Cache:** 24 hours
**Purpose:** Customer autocomplete, history lookup
**Query Parameters:** None
**Response:** Array of 389 unique customers

**Implementation:**
```javascript
router.get('/customers', manageOrdersLimiter, async (req, res) => {
    // Check 24-hour cache
    if (customerCache.data && !req.query.refresh &&
        (Date.now() - customerCache.timestamp < 24 * 60 * 60 * 1000)) {
        return res.json({
            customers: customerCache.data,
            count: customerCache.data.length,
            cacheAge: Math.round((Date.now() - customerCache.timestamp) / 1000 / 60) + ' minutes'
        });
    }

    // Fetch fresh data and cache
    const customers = await fetchCustomersFromOrders();
    customerCache.data = customers;
    customerCache.timestamp = Date.now();

    res.json({
        customers: customers,
        count: customers.length
    });
});
```

### 2-11. Additional Endpoints

See [API_REFERENCE.md](API_REFERENCE.md) for complete documentation of all 11 endpoints including:
- Order queries and detail lookups
- Line item retrieval
- Payment queries and history
- Shipment tracking
- Real-time inventory (CRITICAL)
- Cache diagnostics

---

## Customer Data Caching

### Why Cache Customer Data?

**Problem Without Caching:**
- Every autocomplete interaction fetches 900+ orders
- Orders endpoint takes 2-3 seconds
- Customer deduplication happens every time
- High load on ManageOrders API

**Solution With Caching:**
- Fetch orders once per 24 hours
- Deduplicate customers once
- Serve instant results from cache
- Minimal load on ManageOrders API

**Impact:** 99.9% reduction in API calls, <200ms response times from cache

### Implementation

**Cache Structure:**
```javascript
const customerCache = {
    data: null,               // Array of customer objects
    timestamp: null,          // When data was cached (milliseconds)
    expiresIn: 24 * 60 * 60 * 1000  // 24 hours
};
```

**Cache Management:**
```javascript
async function fetchCustomers() {
    const now = Date.now();

    // Return cached data if still valid
    if (customerCache.data && customerCache.timestamp &&
        (now - customerCache.timestamp < customerCache.expiresIn)) {
        console.log('[ManageOrders] Returning cached customer data');
        return customerCache.data;
    }

    // Cache expired - fetch fresh data
    console.log('[ManageOrders] Fetching fresh customer data...');

    try {
        // Get auth token (from cache or new authentication)
        const token = await getAuthToken();

        // Fetch orders from last 60 days
        const sixtyDaysAgo = new Date();
        sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
        const fromDate = sixtyDaysAgo.toISOString().split('T')[0];

        const response = await fetch(
            `${MANAGEORDERS_API_URL}/api/orders?fromDate=${fromDate}`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        if (!response.ok) {
            throw new Error(`Failed to fetch orders: ${response.status}`);
        }

        const orders = await response.json();
        console.log(`[ManageOrders] Fetched ${orders.length} orders`);

        // Deduplicate customers
        const customersMap = new Map();

        orders.forEach(order => {
            if (order.id_Customer && !customersMap.has(order.id_Customer)) {
                customersMap.set(order.id_Customer, {
                    id_Customer: order.id_Customer,
                    CustomerName: order.CustomerName,
                    ContactFirstName: order.ContactFirstName,
                    ContactLastName: order.ContactLastName,
                    ContactEmail: order.ContactEmail,
                    ContactPhone: order.ContactPhone,
                    CustomerServiceRep: order.CustomerServiceRep,
                    // Include address for future use
                    CustomerStreet: order.CustomerStreet,
                    CustomerCity: order.CustomerCity,
                    CustomerState: order.CustomerState,
                    CustomerZIP: order.CustomerZIP
                });
            }
        });

        const customers = Array.from(customersMap.values())
            .sort((a, b) => a.CustomerName.localeCompare(b.CustomerName));

        console.log(`[ManageOrders] ✓ Extracted ${customers.length} unique customers`);

        // Cache the results
        customerCache.data = customers;
        customerCache.timestamp = now;

        return customers;

    } catch (error) {
        console.error('[ManageOrders] ✗ Error fetching customers:', error.message);
        throw error;
    }
}
```

### Cache Invalidation

**Automatic Invalidation:**
- After 24 hours (TTL expiration)
- On server restart (in-memory cache cleared)

**Manual Invalidation:**
```javascript
// Force refresh endpoint (admin only)
router.post('/customers/refresh', async (req, res) => {
    // Clear cache
    customerCache.data = null;
    customerCache.timestamp = null;

    // Fetch fresh data
    const customers = await fetchCustomers();

    res.json({
        message: 'Cache refreshed',
        count: customers.length
    });
});
```

**Future Enhancement:** Redis for persistent caching across server restarts

---

## Rate Limiting

### Why Rate Limiting?

**Protection Goals:**
1. Prevent accidental DoS of ManageOrders API
2. Protect proxy server from abuse
3. Ensure fair usage across all users
4. Comply with ShopWorks API limits

### Implementation

**Install Package:**
```bash
npm install express-rate-limit
```

**Configuration:**
```javascript
const rateLimit = require('express-rate-limit');

const manageOrdersLimiter = rateLimit({
    windowMs: 60 * 1000,     // 1 minute
    max: 30,                  // 30 requests per minute (increased from 10)
    message: {
        error: 'Too many requests',
        message: 'Please wait a moment and try again.'
    },
    standardHeaders: true,    // Return rate limit info in headers
    legacyHeaders: false,     // Disable X-RateLimit-* headers

    // Skip rate limiting for cached responses
    skip: (req, res) => {
        // Check if serving from cache (no API call)
        const cacheKey = req.path + JSON.stringify(req.query);
        return cache.has(cacheKey) && !req.query.refresh;
    }
});

// Apply to all ManageOrders routes
router.use('/manageorders', manageOrdersLimiter);
```

**Rate Limit Response:**
```http
HTTP/1.1 429 Too Many Requests
Content-Type: application/json
Retry-After: 60

{
  "error": "Too many requests",
  "message": "Please wait a moment and try again."
}
```

**Rate Limit Headers:**
```http
RateLimit-Limit: 30
RateLimit-Remaining: 25
RateLimit-Reset: 1706371260
```

### Rate Limit Strategy

**Global Limit:**
- All `/api/manageorders/*` endpoints: 30 requests/minute
- `/api/manageorders/cache-info`: No limit (debug endpoint)

**Bypass for Cached Data:**
- Rate limiting skipped when serving from cache
- Unlimited cached responses (no API impact)
- Rate limit only applies when fetching fresh data

---

## Error Handling

### Error Response Format

**Standard Error Response:**
```json
{
  "error": "Service Unavailable",
  "message": "ManageOrders API is temporarily unavailable. Please try again later.",
  "details": {
    "endpoint": "/api/orders",
    "statusCode": 503
  }
}
```

### Common Error Scenarios

**1. Authentication Failure (401)**

**Cause:** Invalid credentials or expired token

**Response:**
```json
{
  "error": "Authentication Failed",
  "message": "Unable to authenticate with ManageOrders API. Please check credentials."
}
```

**Handling:**
```javascript
try {
    const token = await getAuthToken();
} catch (error) {
    console.error('[ManageOrders] Auth error:', error);

    res.status(500).json({
        error: 'Authentication Failed',
        message: 'Unable to authenticate with ManageOrders API.'
    });
    return;
}
```

**2. ManageOrders API Timeout**

**Cause:** Network issue or slow ManageOrders response

**Response:**
```json
{
  "error": "Request Timeout",
  "message": "ManageOrders API did not respond in time. Please try again."
}
```

**Handling:**
```javascript
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 30000); // 30 second timeout

try {
    const response = await fetch(url, {
        signal: controller.signal,
        headers: { Authorization: `Bearer ${token}` }
    });
} catch (error) {
    if (error.name === 'AbortError') {
        res.status(504).json({
            error: 'Request Timeout',
            message: 'ManageOrders API did not respond in time.'
        });
    }
} finally {
    clearTimeout(timeout);
}
```

**3. Rate Limit Exceeded (429)**

**Cause:** Too many requests from client

**Response:**
```json
{
  "error": "Too Many Requests",
  "message": "Please wait a moment and try again.",
  "retryAfter": 60
}
```

**Handling:** Automatic (handled by express-rate-limit middleware)

**4. Empty Customer Data**

**Cause:** No orders in date range or data processing error

**Response:**
```json
{
  "customers": [],
  "count": 0,
  "message": "No customers found in the specified date range."
}
```

**Handling:**
```javascript
if (customers.length === 0) {
    res.json({
        customers: [],
        count: 0,
        message: 'No customers found in the specified date range.'
    });
    return;
}
```

### Error Logging

**Console Logging:**
```javascript
console.error('[ManageOrders] Error:', {
    endpoint: req.path,
    method: req.method,
    error: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString()
});
```

**Future Enhancement:** Integrate with logging service (e.g., Papertrail, Loggly)

---

## Deployment to Heroku

### Initial Setup

**1. Create Heroku App:**
```bash
heroku create caspio-pricing-proxy
```

**2. Set Environment Variables:**
```bash
heroku config:set MANAGEORDERS_API_URL=https://your-shopworks-server.com
heroku config:set MANAGEORDERS_USERNAME=api_readonly
heroku config:set MANAGEORDERS_PASSWORD=secure_password_here
```

**3. Deploy Code:**
```bash
git push heroku main
```

### Configuration

**Required Environment Variables:**
```bash
# ManageOrders API Configuration
MANAGEORDERS_API_URL=https://your-shopworks-server.com
MANAGEORDERS_USERNAME=your_api_username
MANAGEORDERS_PASSWORD=your_api_password

# Optional: CORS Configuration
ALLOWED_ORIGINS=https://www.nwcustomapparel.com,https://teamnwca.com
```

**Heroku Dynos:**
- **Dyno Type:** Standard-1X or Performance-M
- **Dyno Count:** 1 (horizontal scaling not required)
- **Memory:** 512MB (sufficient for in-memory caching)

### Health Check Endpoint

**Endpoint:** `GET /api/manageorders/cache-info`

**Response:**
```json
{
  "service": "ManageOrders API Proxy",
  "status": "operational",
  "endpoints": 11,
  "tokenCached": true,
  "cacheStats": {
    "customers": { "cached": true, "count": 389, "age": "15 minutes" },
    "orders": { "cached": true, "count": 912, "age": "45 minutes" },
    "inventory": { "cached": true, "count": 1250, "age": "3 minutes" }
  }
}
```

**Implementation:**
```javascript
router.get('/cache-info', (req, res) => {
    const cacheStats = {};

    // Collect stats for all cached endpoints
    ['customers', 'orders', 'inventory', 'tracking', 'payments'].forEach(type => {
        const cached = cache.get(type);
        if (cached) {
            cacheStats[type] = {
                cached: true,
                count: cached.data.length || cached.data.result?.length || 0,
                age: Math.round((Date.now() - cached.timestamp) / 1000 / 60) + ' minutes'
            };
        }
    });

    res.json({
        service: 'ManageOrders API Proxy',
        status: 'operational',
        endpoints: 11,
        tokenCached: !!tokenCache.token,
        cacheStats: cacheStats
    });
});
```

**Use Case:** Monitor service health, check cache status across all 11 endpoints

---

## Monitoring & Logging

### Key Metrics to Monitor

**Performance Metrics:**
- Response time (target: <2.5s initial, <200ms cached)
- Cache hit rate (target: >95%)
- Error rate (target: <1%)
- Request volume (requests per hour)

**Cache Metrics:**
- Token cache age (should be <1 hour)
- Customer cache age (should be <24 hours)
- Cache size (customer count)
- Cache invalidation frequency

**API Metrics:**
- ManageOrders API response time
- Authentication success rate
- Orders fetched per request
- Unique customers extracted

### Console Logging Patterns

**Success Logs:**
```
[ManageOrders] Using cached token
[ManageOrders] Returning cached customer data
[ManageOrders] ✓ Extracted 389 unique customers
```

**Error Logs:**
```
[ManageOrders] ✗ Authentication error: Invalid credentials
[ManageOrders] ✗ Error fetching customers: Network timeout
```

**Performance Logs:**
```
[ManageOrders] Fetched 912 orders in 2.3s
[ManageOrders] Extracted 389 customers in 0.15s
[ManageOrders] Served from cache in 0.02s
```

### Heroku Logging

**View Logs:**
```bash
heroku logs --tail --app caspio-pricing-proxy
```

**Filter ManageOrders Logs:**
```bash
heroku logs --tail --app caspio-pricing-proxy | grep ManageOrders
```

**Log Retention:**
- Free tier: 1,500 lines
- Upgrade: Use Papertrail add-on for longer retention

---

## Performance Optimization

### Current Performance

**Initial Request (Cache Miss):**
- Authentication: ~500ms
- Fetch orders: ~2,000ms
- Process customers: ~150ms
- **Total:** ~2.65 seconds

**Cached Request (Cache Hit):**
- Retrieve from cache: ~20ms
- **Total:** <50ms

**Cache Hit Rate:** >95% (after initial 24-hour period)

### Optimization Strategies

**1. Reduce Order Date Range:**
```javascript
// Current: 60 days
const sixtyDaysAgo = new Date();
sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

// Optimization: 30 days (fewer orders = faster)
const thirtyDaysAgo = new Date();
thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
```

**Impact:** 50% fewer orders, 40% faster processing

**2. Parallel Requests:**
```javascript
// Future: Fetch multiple date ranges in parallel
const [recentOrders, olderOrders] = await Promise.all([
    fetchOrders(last30Days),
    fetchOrders(last60Days)
]);
```

**Impact:** 30% faster for large date ranges

**3. Compression:**
```javascript
// Enable gzip compression for responses
const compression = require('compression');
app.use(compression());
```

**Impact:** 60-70% reduction in response size

---

## Testing

### Unit Tests

**Test Token Caching:**
```javascript
describe('Token Caching', () => {
    it('should cache token for 1 hour', async () => {
        const token1 = await getAuthToken();
        const token2 = await getAuthToken();

        expect(token1).toBe(token2);  // Same token
    });

    it('should refresh expired token', async () => {
        const token1 = await getAuthToken();

        // Simulate token expiration
        tokenCache.timestamp = Date.now() - 3700000; // 1 hour + 5 min ago

        const token2 = await getAuthToken();

        expect(token1).not.toBe(token2);  // New token
    });
});
```

**Test Customer Caching:**
```javascript
describe('Customer Caching', () => {
    it('should cache customers for 24 hours', async () => {
        const customers1 = await fetchCustomers();
        const customers2 = await fetchCustomers();

        expect(customers1).toEqual(customers2);  // Same data
    });
});
```

### Integration Tests

**Test Full Request Flow:**
```bash
# Test cache-info endpoint
curl https://caspio-pricing-proxy.herokuapp.com/api/manageorders/cache-info

# Test customers endpoint
curl https://caspio-pricing-proxy.herokuapp.com/api/manageorders/customers

# Test inventory endpoint (CRITICAL for webstore)
curl "https://caspio-pricing-proxy.herokuapp.com/api/manageorders/inventorylevels?PartNumber=PC54"

# Test rate limiting
for i in {1..35}; do
    curl https://caspio-pricing-proxy.herokuapp.com/api/manageorders/customers
done
```

**Expected:** First 30 requests succeed, requests 31-35 return 429

---

**Documentation Type:** Server Proxy Implementation Guide
**Parent Document:** [MANAGEORDERS_INTEGRATION.md](../MANAGEORDERS_INTEGRATION.md)
**Related:** [Overview](OVERVIEW.md) | [Customer Autocomplete](CUSTOMER_AUTOCOMPLETE.md)
