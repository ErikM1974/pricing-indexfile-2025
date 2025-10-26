# ManageOrders API Integration - Core Guide

**Last Updated:** 2025-01-27
**Purpose:** Master navigation and overview for ShopWorks ManageOrders REST API integration
**Status:** Production-ready for Customer Autocomplete (Screen Print Quote Builder)

---

## 📋 Quick Navigation

### Implementation Guides
- **[Overview & Architecture](manageorders/OVERVIEW.md)** - System architecture, authentication flow, getting started
- **[Customer Autocomplete](manageorders/CUSTOMER_AUTOCOMPLETE.md)** - Complete implementation guide for current feature
- **[API Reference](manageorders/API_REFERENCE.md)** - Complete Swagger specification (10 endpoints)
- **[Server Proxy](manageorders/SERVER_PROXY.md)** - caspio-pricing-proxy implementation details
- **[Future Integrations](manageorders/FUTURE_INTEGRATIONS.md)** - Order history, inventory sync, payment tracking

---

## 🎯 Overview

### What is ManageOrders API?

**ManageOrders** is ShopWorks' REST API that provides programmatic access to order, customer, inventory, and payment data from their OnSite 7 production management system.

**Current Implementation:** Customer Autocomplete in Screen Print Quote Builder
**API Endpoints Used:** 1 of 10 available endpoints
**Status:** ✅ Production-ready with 389 customers cached

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
│  /api/manageorders/customers  │         │
│  - Token caching (1 hour)     │         │
│  - Customer caching (1 day)   │         │
│  - Rate limiting (10/min)     │         │
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

### Currently Implemented ✅

| Endpoint | Method | Purpose | Status |
|----------|--------|---------|--------|
| `/api/orders` | GET | Fetch orders → Extract unique customers | ✅ Deployed |

**Proxy Endpoint:** `https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/manageorders/customers`

### Available for Future Use 📝

| Category | Endpoints | Use Cases |
|----------|-----------|-----------|
| **Authentication** | `POST /api/signin` | Required for all API calls |
| **Orders** | `GET /api/orders`<br>`POST /api/orders`<br>`PUT /api/orders/{id}`<br>`DELETE /api/orders/{id}` | Order history, quote conversion tracking |
| **Order Line Items** | `GET /api/lineItems` | Product breakdown, reorder suggestions |
| **Order Shipments** | `GET /api/shipments` | Delivery tracking |
| **Order Payments** | `GET /api/payments` | Payment status, invoice reconciliation |
| **Inventory** | `GET /api/inventoryLevels` | Real-time stock availability |

**Total Available:** 10 endpoints
**Currently Using:** 1 endpoint (10%)
**Documentation:** Complete Swagger specification in [API Reference](manageorders/API_REFERENCE.md)

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
- 10 requests/minute per IP
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

### Phase 2: Rollout to Other Quote Builders 📝 PLANNED

**Target Quote Builders:**
- DTG Quote Builder
- Embroidery Quote Builder
- Cap Embroidery Quote Builder
- Laser Tumbler Quote Builder

**Effort:** Low (reuse existing service)
**Timeline:** 1-2 hours per quote builder

### Phase 3: Order History Lookup 📝 FUTURE

**Use Case:** Sales rep wants to see customer's previous orders
**Implementation:**
- Add "View Order History" button next to autocomplete
- Fetch orders filtered by `id_Customer`
- Display modal with recent orders

**Endpoints Required:**
- `GET /api/orders?id_Customer={id}` (already available)
- `GET /api/lineItems?id_Order={id}` (for order details)

### Phase 4: Inventory Integration 📝 FUTURE

**Use Case:** Show real-time stock availability for products
**Implementation:**
- Fetch inventory levels during product selection
- Display "In Stock: 500" badge on product cards
- Warn when quantity exceeds available inventory

**Endpoints Required:**
- `GET /api/inventoryLevels?styleNumber={style}`

### Phase 5: Payment Tracking 📝 FUTURE

**Use Case:** Track quote conversion and payment status
**Implementation:**
- Link quote to order via `ExtOrderID`
- Check payment status when viewing quote
- Display "Paid", "Pending", or "Past Due"

**Endpoints Required:**
- `GET /api/payments?id_Order={id}`

**Complete roadmap:** See [Future Integrations](manageorders/FUTURE_INTEGRATIONS.md)

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

- [ ] Rollout to DTG Quote Builder
- [ ] Rollout to Embroidery Quote Builder
- [ ] Rollout to Cap Quote Builder
- [ ] Implement order history lookup
- [ ] Implement inventory integration
- [ ] Implement payment tracking

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
**Last Updated:** 2025-01-27
**Status:** Production-ready, actively expanded
