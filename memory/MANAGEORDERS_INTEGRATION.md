# ManageOrders API Integration - Core Guide

**Last Updated:** 2025-10-26
**Purpose:** Master navigation and overview for ShopWorks ManageOrders REST API integration
**Status:** Production-ready - Full ERP integration with 11 endpoints

---

## 📋 Quick Navigation

### Implementation Guides
- **[Overview & Architecture](manageorders/OVERVIEW.md)** - System architecture, authentication flow, getting started
- **[Customer Autocomplete](manageorders/CUSTOMER_AUTOCOMPLETE.md)** - Complete implementation guide for customer autocomplete feature
- **[API Reference](manageorders/API_REFERENCE.md)** - Complete API specification (11 endpoints, all production-ready)
- **[Server Proxy](manageorders/SERVER_PROXY.md)** - caspio-pricing-proxy implementation details
- **[Integration Examples](manageorders/INTEGRATION_EXAMPLES.md)** - Working code examples for orders, inventory, payments, tracking

---

## 🎯 Overview

### What is ManageOrders API?

**ManageOrders** is ShopWorks' REST API that provides programmatic access to order, customer, inventory, and payment data from their OnSite 7 production management system.

**Current Implementation:** Full ERP integration via caspio-pricing-proxy
**API Endpoints Available:** 11 of 11 endpoints - All production-ready
**Status:** ✅ Fully implemented with intelligent caching strategy

### Why ManageOrders Integration Matters

**Problem Without API:**
1. Sales rep enters customer information manually
2. **Risk of typos** in company name, contact info
3. No connection to existing customer records
4. Sales rep assignment requires manual lookup

**Solution With API:**
1. Sales rep starts typing company name
2. **Autocomplete suggests** from 389 existing customers
3. One click populates 5 fields (company, name, email, phone, sales rep)
4. Customer ID links quote to existing ShopWorks records ✅

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Browser (Quote Builder)                  │
│  User types "Arrow" → Instant search in cached customers   │
│                                                             │
│  manageorders-customer-service.js                          │
│  - sessionStorage cache (24 hours)                         │
│  - Client-side filtering                                   │
│  - Smart sorting (exact → starts with → contains)          │
└────────────────────────┬────────────────────────────────────┘
                         ↓
        ┌────────────────┴────────────────┐
        ↓ (only on cache miss)            ↓
┌───────────────────────────────┐         │
│  caspio-pricing-proxy         │         │
│  (Heroku server)              │         │
│                               │         │
│  /api/manageorders/*          │         │
│  - Token caching (1 hour)     │         │
│  - Intelligent caching        │         │
│  - Rate limiting (30/min)     │         │
└────────────────┬──────────────┘         │
                 ↓                        ↓
    ┌────────────┴────────────┐    [Cached Data]
    ↓                         ↓
┌──────────────────────────────┐
│  ManageOrders API            │
│  (ShopWorks OnSite 7)        │
│                              │
│  POST /api/signin            │
│  GET  /api/orders            │
└──────────────────────────────┘
```

**Key Security Feature:** Browser never sees credentials or tokens. All authentication happens server-side.

---

## 🔧 Available Endpoints

### ⭐ Critical Production Endpoints

| Endpoint | Cache | Purpose | Priority |
|----------|-------|---------|----------|
| `inventorylevels` | 5 min | Real-time stock levels | **CRITICAL** for webstore |
| `tracking` | 15 min | Shipment tracking | **HIGH** for customer portal |
| `orders` (query) | 1 hour | Order searches | **HIGH** for sales tools |
| `payments` (query) | 1 hour | Payment status | **MEDIUM** for accounting |

### All Production Endpoints ✅

**Base URL:** `https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/manageorders/`

| Category | Endpoints | Status |
|----------|-----------|--------|
| **Customers** | `customers` | ✅ Deployed (customer autocomplete) |
| **Orders** | `orders` (query), `orders/:order_no`, `getorderno/:ext_id` | ✅ Deployed (3 endpoints) |
| **Line Items** | `lineitems/:order_no` | ✅ Deployed (product details) |
| **Payments** | `payments` (query), `payments/:order_no` | ✅ Deployed (2 endpoints) |
| **Tracking** | `tracking` (query), `tracking/:order_no` | ✅ Deployed (2 endpoints) |
| **Inventory** | `inventorylevels` | ✅ Deployed (real-time stock) |
| **Debug** | `cache-info` | ✅ Deployed (cache diagnostics) |

**Total Endpoints:** 11 production-ready endpoints
**Rate Limiting:** 30 requests/minute per IP
**Documentation:** Complete API specification in [API Reference](manageorders/API_REFERENCE.md)

---

## 🚀 Current Implementation Status

### Customer Autocomplete (Production)

**File:** `/quote-builders/screenprint-quote-builder.html`
**Service:** `/shared_components/js/manageorders-customer-service.js`
**Deployment:** Live in production ✅

**Features:**
- ✅ 389 customers from last 60 days
- ✅ SessionStorage caching (24-hour TTL)
- ✅ Instant search with debouncing (200ms)
- ✅ Smart sorting (exact match first)
- ✅ Auto-populates 5 fields on selection
- ✅ Graceful fallback to manual entry
- ✅ XSS prevention with HTML escaping

**Performance:**
- Initial load: ~2.3 seconds (fetches from server)
- Cached searches: <200ms (client-side filtering)
- Memory footprint: ~120KB sessionStorage

**Fields Auto-Populated:**
1. Company Name (`CustomerName`)
2. Customer Name (`ContactFirstName` + `ContactLastName`)
3. Email (`ContactEmail`, cleaned of `\r` characters)
4. Phone (`ContactPhone`)
5. Sales Rep (mapped from `CustomerServiceRep`)

**Implementation Guide:** See [Customer Autocomplete](manageorders/CUSTOMER_AUTOCOMPLETE.md)

---

## 📊 Data Summary

### Customer Data Structure

**Source:** `GET /api/orders` response → Deduplicated customers
**Fields Available:** 17 customer-related fields
**Records:** 389 unique customers (from 912 orders in last 60 days)

**Key Fields Used:**
```javascript
{
    id_Customer: 123,              // ShopWorks customer ID
    CustomerName: "Arrow Lumber",  // Company name
    ContactFirstName: "John",
    ContactLastName: "Smith",
    ContactEmail: "john@arrow.com",
    ContactPhone: "253-555-1234",
    CustomerServiceRep: "Nika Lao" // Sales rep assignment
}
```

**Fields Available (Not Currently Used):**
- Customer address (Street, City, State, ZIP)
- Tax rates and settings
- Credit status
- Account balances
- Custom fields

**Complete field documentation:** See [API Reference](manageorders/API_REFERENCE.md)

---

## 🔐 Security Architecture

### Three-Layer Security

**Layer 1: Server-Side Credential Storage**
- Credentials stored in Heroku config vars (not in code)
- Environment variables: `MANAGEORDERS_USERNAME`, `MANAGEORDERS_PASSWORD`
- Never exposed to browser

**Layer 2: Token Caching**
- JWT tokens cached server-side (1 hour TTL)
- Reduces authentication calls
- Tokens never sent to browser

**Layer 3: Rate Limiting**
- 30 requests/minute per IP
- Prevents abuse and accidental DoS
- Returns 429 status on limit exceeded

**Additional Security:**
- CORS restrictions (only authorized origins)
- HTTPS required for all API calls
- XSS prevention in autocomplete display
- No sensitive data in browser console logs

**Complete security guide:** See [Overview & Architecture](manageorders/OVERVIEW.md)

---

## 📈 Implementation Roadmap

### Phase 1: Customer Autocomplete ✅ COMPLETE

**Status:** Production-ready in Screen Print Quote Builder
**Completion Date:** 2025-01-27
**Files Created:** 2 (service + integration)
**Lines of Code:** ~440 lines

### Phase 2: Complete ERP Integration ✅ COMPLETE

**Status:** All 11 endpoints deployed and production-ready
**Completion Date:** 2025-10-26
**Endpoints Deployed:** 11 (customers, orders, line items, payments, tracking, inventory)
**Caching Strategy:** Intelligent per-endpoint caching (5min to 24hr)

**Available Integrations:**
- ✅ Customer autocomplete (live in Screen Print Quote Builder)
- ✅ Order history lookup (query and detail endpoints)
- ✅ Real-time inventory (5-minute cache, CRITICAL for webstore)
- ✅ Payment tracking (query and detail endpoints)
- ✅ Shipment tracking (15-minute cache)
- ✅ Quote-to-order mapping (`ExtOrderID` → `OrderNo`)

### Phase 3: Application Development 📝 READY

**Use Cases Ready to Build:**
1. **Webstore Real-Time Inventory** - Show live stock levels during product selection
2. **Customer Portal** - Order history, tracking, and payment status
3. **Sales Dashboard** - Order search and customer history lookup
4. **Accounting Dashboard** - Payment tracking and invoice reconciliation
5. **Order Status Widget** - Embed in any page for customer self-service

**Complete working examples:** See [Integration Examples](manageorders/INTEGRATION_EXAMPLES.md)

---

## 🚀 ManageOrders PUSH API - Online Store Integration

### PUSH API vs PULL API

**PULL API (Reading Data - Phase 1-3 above):**
- 11 GET endpoints for reading data from ShopWorks
- Use cases: Display inventory, show order history, track shipments
- Caching: 5 minutes to 24 hours (depending on data volatility)

**PUSH API (Creating Orders - NEW):**
- 4 endpoints for creating orders in ShopWorks
- Use cases: Webstore checkout, mobile app orders, bulk imports
- No caching (writes must be immediate)

### Complete PUSH API Documentation

**Quick Reference:** See [ManageOrders PUSH API Guide](MANAGEORDERS_PUSH_WEBSTORE.md)

**Complete Developer Guide:** `caspio-pricing-proxy/memory/ONLINE_STORE_DEVELOPER_GUIDE.md`

### Key PUSH API Endpoints

```
POST   /api/manageorders/orders/create          Create new order
GET    /api/manageorders/orders/verify/:id      Verify order was created
POST   /api/manageorders/auth/test              Test API credentials
GET    /api/manageorders/push/health            Health check
```

### Minimal Order Example

```javascript
const order = {
  "orderNumber": "WEB-12345",
  "customer": {
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com",
    "phone": "360-555-1234"
  },
  "lineItems": [
    {
      "partNumber": "PC54",
      "description": "Port & Company Core Cotton Tee",
      "color": "Red",
      "size": "L",
      "quantity": 12,
      "price": 8.50
    }
  ],
  "shipping": {
    "address1": "123 Main St",
    "city": "Seattle",
    "state": "WA",
    "zip": "98101",
    "country": "USA"
  }
};

// Create order
const response = await fetch(
  'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/manageorders/orders/create',
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(order)
  }
);

const result = await response.json();
console.log('Order created:', result.orderNumber); // "NWCA-12345"
```

### Complete Webstore Architecture

**Phase 1: Product Display (PULL API)**
- Fetch products and check real-time inventory
- Display "In Stock" / "Out of Stock" status

**Phase 2: Checkout (PUSH API)**
- Customer completes checkout
- Order automatically created in ShopWorks OnSite

**Phase 3: Order Tracking (PULL API)**
- Customer tracks order status
- View shipment tracking information

**See [PUSH API Guide](MANAGEORDERS_PUSH_WEBSTORE.md) for complete implementation details**

---

### Phase 4: Rollout Customer Autocomplete 📝 PLANNED

**Target Quote Builders:**
- DTG Quote Builder
- Embroidery Quote Builder
- Cap Embroidery Quote Builder
- Laser Tumbler Quote Builder

**Effort:** Low (reuse existing service)
**Timeline:** 1-2 hours per quote builder

---

## 🧪 Testing & Verification

### Testing Customer Autocomplete

**Browser Console Commands:**
```javascript
// Check service initialization
console.log(window.customerService);

// Check cached customer count
const cache = sessionStorage.getItem('manageorders_customers_cache');
const data = JSON.parse(cache);
console.log('Cached customers:', data.count);

// Test search function
const results = customerService.searchCustomers('Arrow');
console.log('Search results:', results);

// Check cache age
const age = Date.now() - data.timestamp;
console.log('Cache age (hours):', (age / 1000 / 60 / 60).toFixed(2));
```

**Expected Console Output:**
```
[ManageOrdersService] Service initialized
[ManageOrdersService] ✓ Loaded from cache: 389 customers
[ManageOrders] ✓ Initialized with 389 customers
```

**Manual Testing Steps:**
1. Open Screen Print Quote Builder
2. Advance to Review phase
3. Start typing "Arrow" in Company Name field
4. Verify dropdown appears with suggestions
5. Click "Arrow Lumber and Hardware"
6. Verify all 5 fields auto-populate
7. Check sales rep dropdown shows "Nika Lao"

**Testing Guide:** See [Customer Autocomplete](manageorders/CUSTOMER_AUTOCOMPLETE.md#testing)

---

## 📞 Support & Resources

### Documentation Quick Links

- **Implementation Guides:** [/memory/manageorders/](manageorders/)
- **API Reference:** [API_REFERENCE.md](manageorders/API_REFERENCE.md)
- **Customer Autocomplete:** [CUSTOMER_AUTOCOMPLETE.md](manageorders/CUSTOMER_AUTOCOMPLETE.md)

### ShopWorks Resources

- **ManageOrders API:** Contact ShopWorks support for credentials
- **OnSite 7 Documentation:** Available through ShopWorks support portal
- **API Endpoint:** Your organization's OnSite 7 server URL

### Internal Resources

- **Server Implementation:** caspio-pricing-proxy repository
- **Browser Service:** `/shared_components/js/manageorders-customer-service.js`
- **Integration Example:** `/quote-builders/screenprint-quote-builder.html`
- **Git Commits:** Check recent commits for implementation history

---

## 🎉 Success Metrics

### Current Implementation (Customer Autocomplete)

✅ **Deployment:** Live in production (Screen Print Quote Builder)
✅ **Performance:** <200ms cached searches, ~2.3s initial load
✅ **Reliability:** 24-hour cache with fallback to expired cache on errors
✅ **Security:** Zero credentials in browser, rate-limited API
✅ **User Experience:** 389 customers available, smart sorting, 5-field auto-population
✅ **Testing:** Verified with real data ("Arrow Lumber", "Northwest Souvenirs")

### Next Milestones

- [ ] Build webstore real-time inventory integration
- [ ] Build customer portal with order history and tracking
- [ ] Build sales dashboard with order search
- [ ] Build accounting dashboard with payment tracking
- [ ] Rollout customer autocomplete to DTG Quote Builder
- [ ] Rollout customer autocomplete to Embroidery Quote Builder
- [ ] Rollout customer autocomplete to Cap Quote Builder

---

## 🔑 Quick Reference

### API Configuration

```javascript
const MANAGEORDERS_CONFIG = {
    proxyURL: 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com',
    endpoint: '/api/manageorders/customers',
    cacheKey: 'manageorders_customers_cache',
    cacheDuration: 24 * 60 * 60 * 1000, // 24 hours
    searchMinLength: 2,
    resultLimit: 10,
    debounceDelay: 200 // milliseconds
};
```

### Service Usage

```javascript
// Initialize service
const customerService = new ManageOrdersCustomerService();
await customerService.initialize();

// Search customers
const results = customerService.searchCustomers('Arrow');

// Get customer by ID
const customer = customerService.getCustomerById(123);

// Check cache status
const status = customerService.getStatus();
```

### Field Mapping

| ManageOrders Field | Quote Builder Field | Transformation |
|-------------------|---------------------|----------------|
| `CustomerName` | Company Name | Direct |
| `ContactFirstName` + `ContactLastName` | Customer Name | Concatenated |
| `ContactEmail` | Email | Cleaned (`\r` removed) |
| `ContactPhone` | Phone | Direct |
| `CustomerServiceRep` | Sales Rep | Mapped to email |

---

**Documentation Type:** Master navigation and overview
**Related Files:** All documentation files in [/memory/manageorders/](manageorders/) directory
**Last Updated:** 2025-10-26
**Status:** Full ERP integration - 11 endpoints production-ready
