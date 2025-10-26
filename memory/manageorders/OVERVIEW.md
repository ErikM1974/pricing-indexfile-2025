# ManageOrders API - Overview & Architecture

**Last Updated:** 2025-01-27
**Purpose:** System architecture, authentication flow, and getting started guide
**Parent Document:** [MANAGEORDERS_INTEGRATION.md](../MANAGEORDERS_INTEGRATION.md)

---

## 📋 Table of Contents

1. [What is ManageOrders API?](#what-is-manageorders-api)
2. [System Architecture](#system-architecture)
3. [Authentication Flow](#authentication-flow)
4. [Security Best Practices](#security-best-practices)
5. [Getting Started](#getting-started)
6. [Error Handling](#error-handling)

---

## What is ManageOrders API?

### Overview

**ManageOrders** is a RESTful API provided by ShopWorks that enables programmatic access to data in their OnSite 7 production management system.

**Base Concepts:**
- REST architecture (JSON request/response)
- JWT (JSON Web Token) authentication
- Rate-limited for protection
- Real-time data from production system

### API Capabilities

**Current Data Access:**
- Orders (quotes, production orders, completed orders)
- Customers (company info, contacts, addresses)
- Line Items (products, quantities, pricing)
- Shipments (tracking, delivery dates)
- Payments (invoices, payment status)
- Inventory (stock levels, product availability)

**Potential Use Cases:**
1. Customer autocomplete in quote builders ✅ **IMPLEMENTED**
2. Order history lookup for sales reps
3. Real-time inventory availability
4. Payment status tracking
5. Shipment tracking integration
6. Automated reorder suggestions

### Why Use the API?

**Without API:**
- Manual data entry (prone to errors)
- No connection between web quotes and ShopWorks
- Sales reps must look up customer info separately
- No real-time inventory visibility

**With API:**
- Automated data synchronization
- Web quotes linked to ShopWorks records
- Instant customer information lookup
- Live inventory checks
- Reduced data entry time by 60-80%

---

## System Architecture

### Three-Tier Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  TIER 1: Browser (Client Side)                             │
│  ────────────────────────────────────────────────────────   │
│                                                             │
│  Quote Builder HTML Page                                    │
│  └─ manageorders-customer-service.js                       │
│     ├─ sessionStorage cache (24-hour TTL)                  │
│     ├─ Client-side search/filtering                        │
│     └─ XSS prevention (HTML escaping)                      │
│                                                             │
│  Security: No credentials, no tokens, no direct API access │
└────────────────────────┬────────────────────────────────────┘
                         ↓ HTTPS Only
┌────────────────────────┴────────────────────────────────────┐
│  TIER 2: Proxy Server (caspio-pricing-proxy)               │
│  ────────────────────────────────────────────────────────   │
│                                                             │
│  Heroku Server (Node.js + Express)                         │
│  └─ /api/manageorders/customers endpoint                   │
│     ├─ Token caching (1-hour TTL, in-memory)               │
│     ├─ Customer data caching (1-day TTL, in-memory)        │
│     ├─ Rate limiting (10 requests/minute)                  │
│     ├─ CORS restrictions (authorized origins only)         │
│     └─ Error handling with fallback responses              │
│                                                             │
│  Security: Credentials in env vars, never exposed          │
└────────────────────────┬────────────────────────────────────┘
                         ↓ HTTPS + Bearer Token
┌────────────────────────┴────────────────────────────────────┐
│  TIER 3: ManageOrders API (ShopWorks OnSite 7)             │
│  ────────────────────────────────────────────────────────   │
│                                                             │
│  ShopWorks REST API                                         │
│  └─ 10 available endpoints                                  │
│     ├─ POST /api/signin (authentication)                   │
│     ├─ GET  /api/orders (order data)                       │
│     ├─ GET  /api/lineItems (product details)               │
│     ├─ GET  /api/shipments (delivery tracking)             │
│     ├─ GET  /api/payments (invoice status)                 │
│     └─ GET  /api/inventoryLevels (stock data)              │
│                                                             │
│  Security: JWT tokens, role-based access control           │
└─────────────────────────────────────────────────────────────┘
```

### Why Three Tiers?

**Tier 1 (Browser):**
- **Purpose:** User interface and client-side caching
- **Benefit:** Instant search without network calls
- **Security:** No sensitive data or credentials

**Tier 2 (Proxy Server):**
- **Purpose:** Credential management and caching layer
- **Benefit:** Reduces API calls, protects credentials
- **Security:** Credentials in environment variables

**Tier 3 (ManageOrders API):**
- **Purpose:** Source of truth for production data
- **Benefit:** Real-time data from ShopWorks
- **Security:** Authentication required for all access

---

## Authentication Flow

### JWT Token-Based Authentication

**Step-by-Step Flow:**

```
1. Browser Request
   GET /api/manageorders/customers
   ↓

2. Proxy Server Checks Token Cache
   if (tokenCache.has('manageorders_token')) {
       if (Date.now() - tokenCache.timestamp < 1 hour) {
           use cached token ✓
       } else {
           authenticate again ↓
       }
   } else {
       authenticate ↓
   }

3. Proxy Authenticates with ManageOrders
   POST https://your-shopworks.com/api/signin
   Body: {
       "username": process.env.MANAGEORDERS_USERNAME,
       "password": process.env.MANAGEORDERS_PASSWORD
   }
   ↓

4. ManageOrders Returns JWT Token
   Response: {
       "id_token": "eyJhbGciOiJIUzI1NiIs...",
       "expires_in": 3600
   }
   ↓

5. Proxy Caches Token (1 hour)
   tokenCache.set('manageorders_token', {
       token: response.id_token,
       timestamp: Date.now()
   });
   ↓

6. Proxy Makes Authenticated Request
   GET https://your-shopworks.com/api/orders
   Headers: {
       Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
   }
   ↓

7. Proxy Processes Response
   - Extract unique customers from orders
   - Cache customer data (24 hours)
   - Return to browser
   ↓

8. Browser Receives Data
   - Store in sessionStorage (24 hours)
   - Enable autocomplete
```

### Token Lifecycle

**Token Properties:**
- **Format:** JWT (JSON Web Token)
- **Expiration:** 3600 seconds (1 hour)
- **Renewal:** Automatic when expired
- **Storage:** Server-side in-memory cache only
- **Transmission:** Never sent to browser

**Token Caching Benefits:**
1. **Performance:** Eliminates signin API call for 1 hour
2. **Reliability:** Reduces authentication failures
3. **Cost:** Fewer API calls to ManageOrders
4. **User Experience:** Faster response times

---

## Security Best Practices

### Credential Management

**DO:**
- ✅ Store credentials in environment variables
- ✅ Use Heroku config vars or similar
- ✅ Rotate credentials periodically
- ✅ Use read-only API accounts when possible
- ✅ Document credential requirements

**DON'T:**
- ❌ Hard-code credentials in any file
- ❌ Commit credentials to Git
- ❌ Expose credentials in browser
- ❌ Share credentials via email/Slack
- ❌ Use admin accounts for API access

**Example: Heroku Config Vars**
```bash
heroku config:set MANAGEORDERS_USERNAME=api_readonly
heroku config:set MANAGEORDERS_PASSWORD=secure_password_here
heroku config:set MANAGEORDERS_API_URL=https://your-shopworks.com
```

### Token Security

**Server-Side Token Storage:**
```javascript
// ✅ CORRECT - In-memory cache (server-side only)
const tokenCache = new Map();

async function getAuthToken() {
    const cached = tokenCache.get('manageorders_token');

    if (cached && (Date.now() - cached.timestamp < 3600000)) {
        return cached.token; // Use cached token
    }

    // Authenticate and cache new token
    const token = await authenticateWithManageOrders();
    tokenCache.set('manageorders_token', {
        token: token,
        timestamp: Date.now()
    });

    return token;
}
```

```javascript
// ❌ WRONG - Never send token to browser
res.json({
    customers: data,
    token: authToken  // NEVER DO THIS
});
```

### Rate Limiting

**Implementation:**
```javascript
const rateLimit = require('express-rate-limit');

const manageOrdersLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 10, // 10 requests per minute
    message: 'Too many ManageOrders requests, please try again later.',
    standardHeaders: true,
    legacyHeaders: false
});

app.get('/api/manageorders/customers', manageOrdersLimiter, async (req, res) => {
    // Handler code
});
```

**Why Rate Limiting:**
1. Prevents accidental DoS of ManageOrders API
2. Protects against abuse
3. Ensures fair usage across all users
4. Reduces costs if API has usage limits

### CORS Configuration

**Restrict to Authorized Origins:**
```javascript
const cors = require('cors');

const corsOptions = {
    origin: [
        'https://www.nwcustomapparel.com',
        'https://teamnwca.com',
        'http://localhost:3000' // Development only
    ],
    methods: ['GET'],
    credentials: false
};

app.use('/api/manageorders', cors(corsOptions));
```

### XSS Prevention

**Browser-Side HTML Escaping:**
```javascript
// ✅ CORRECT - Escape HTML entities
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Display customer name safely
dropdown.innerHTML = `
    <div class="autocomplete-item-company">
        ${escapeHtml(customer.CustomerName)}
    </div>
`;
```

```javascript
// ❌ WRONG - Direct HTML injection
dropdown.innerHTML = `
    <div class="autocomplete-item-company">
        ${customer.CustomerName}  // Vulnerable to XSS
    </div>
`;
```

---

## Getting Started

### Prerequisites

**ShopWorks Side:**
1. OnSite 7 installation with ManageOrders API enabled
2. API credentials (username + password)
3. API base URL (e.g., `https://your-company.shopworks.com`)
4. Network access (firewall rules if needed)

**Server Side:**
1. Node.js server (caspio-pricing-proxy or similar)
2. Environment variable support (Heroku, AWS, etc.)
3. HTTPS certificate
4. npm packages: `express`, `node-fetch`, `express-rate-limit`, `cors`

**Browser Side:**
1. Modern browser with sessionStorage support
2. JavaScript enabled
3. HTTPS page (for secure contexts)

### Basic Implementation Steps

**Step 1: Set Up Server Endpoint**

```javascript
// server.js
const express = require('express');
const fetch = require('node-fetch');
const app = express();

const MANAGEORDERS_API_URL = process.env.MANAGEORDERS_API_URL;
const MANAGEORDERS_USERNAME = process.env.MANAGEORDERS_USERNAME;
const MANAGEORDERS_PASSWORD = process.env.MANAGEORDERS_PASSWORD;

// Token cache
const tokenCache = new Map();

// Authenticate with ManageOrders
async function getAuthToken() {
    // Check cache first
    const cached = tokenCache.get('token');
    if (cached && (Date.now() - cached.timestamp < 3600000)) {
        return cached.token;
    }

    // Authenticate
    const response = await fetch(`${MANAGEORDERS_API_URL}/api/signin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            username: MANAGEORDERS_USERNAME,
            password: MANAGEORDERS_PASSWORD
        })
    });

    const data = await response.json();

    // Cache token
    tokenCache.set('token', {
        token: data.id_token,
        timestamp: Date.now()
    });

    return data.id_token;
}

// Customer endpoint
app.get('/api/manageorders/customers', async (req, res) => {
    try {
        const token = await getAuthToken();

        // Fetch orders from ManageOrders
        const response = await fetch(`${MANAGEORDERS_API_URL}/api/orders`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        const orders = await response.json();

        // Extract unique customers
        const customersMap = new Map();
        orders.forEach(order => {
            if (!customersMap.has(order.id_Customer)) {
                customersMap.set(order.id_Customer, {
                    id_Customer: order.id_Customer,
                    CustomerName: order.CustomerName,
                    ContactFirstName: order.ContactFirstName,
                    ContactLastName: order.ContactLastName,
                    ContactEmail: order.ContactEmail,
                    ContactPhone: order.ContactPhone,
                    CustomerServiceRep: order.CustomerServiceRep
                });
            }
        });

        const customers = Array.from(customersMap.values());

        res.json({ customers, count: customers.length });

    } catch (error) {
        console.error('ManageOrders error:', error);
        res.status(500).json({ error: 'Failed to fetch customers' });
    }
});
```

**Step 2: Create Browser Service**

See complete implementation in [Customer Autocomplete](CUSTOMER_AUTOCOMPLETE.md)

**Step 3: Test Integration**

```bash
# Test server endpoint
curl https://your-proxy.herokuapp.com/api/manageorders/customers

# Expected response
{
    "customers": [ /* array of customers */ ],
    "count": 389
}
```

---

## Error Handling

### Common Errors

**Authentication Failure (401)**
```json
{
    "error": "Unauthorized",
    "message": "Invalid credentials"
}
```

**Fix:** Check username/password environment variables

**Rate Limit Exceeded (429)**
```json
{
    "error": "Too Many Requests",
    "message": "Rate limit exceeded. Try again in 60 seconds."
}
```

**Fix:** Wait for rate limit window to reset

**Token Expired (401)**
```json
{
    "error": "Token expired",
    "message": "JWT token is no longer valid"
}
```

**Fix:** Token cache will automatically re-authenticate

**Network Timeout**
```json
{
    "error": "Request timeout",
    "message": "ManageOrders API did not respond"
}
```

**Fix:** Check ManageOrders server status, firewall rules

### Error Handling Best Practices

**Server-Side:**
```javascript
try {
    const data = await fetchFromManageOrders();
    res.json(data);
} catch (error) {
    console.error('[ManageOrders] Error:', error);

    // Return user-friendly error
    res.status(500).json({
        error: 'Service temporarily unavailable',
        message: 'Please try again or enter information manually'
    });
}
```

**Browser-Side:**
```javascript
try {
    await customerService.initialize();
    console.log('✓ Customer autocomplete enabled');
} catch (error) {
    console.error('✗ Autocomplete failed:', error);

    // Fallback to manual entry
    document.getElementById('autocomplete-status').textContent = '(manual entry)';

    // Don't block the form - user can still enter data manually
}
```

---

**Documentation Type:** Architecture and Getting Started Guide
**Parent Document:** [MANAGEORDERS_INTEGRATION.md](../MANAGEORDERS_INTEGRATION.md)
**Related:** [Customer Autocomplete](CUSTOMER_AUTOCOMPLETE.md) | [API Reference](API_REFERENCE.md)
