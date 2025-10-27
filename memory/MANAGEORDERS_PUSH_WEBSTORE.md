# ManageOrders PUSH API - Webstore Integration Reference

**Last Updated:** 2025-10-27
**Purpose:** Reference guide for creating orders in ShopWorks OnSite using the ManageOrders PUSH API
**Status:** Production-ready for online store integration

---

## 📋 Quick Navigation

**Complete Developer Guide:** See `caspio-pricing-proxy/memory/ONLINE_STORE_DEVELOPER_GUIDE.md` for full documentation (1267 lines, 19.5k chars)

**Related Documentation:**
- **[ManageOrders PULL API](MANAGEORDERS_INTEGRATION.md)** - Reading data from ShopWorks (11 endpoints)
- **[API Reference](manageorders/API_REFERENCE.md)** - Complete PULL API endpoint specifications
- **[Integration Examples](manageorders/INTEGRATION_EXAMPLES.md)** - Working code for inventory, orders, tracking

---

## 🎯 Overview & Purpose

### What is the ManageOrders PUSH API?

The **ManageOrders PUSH API** allows you to programmatically **create orders** in ShopWorks OnSite 7 from external systems like online stores, mobile apps, or custom order forms.

### PUSH API vs PULL API

| Feature | PULL API (Read) | PUSH API (Write) |
|---------|-----------------|------------------|
| **Purpose** | Retrieve data from ShopWorks | Create orders in ShopWorks |
| **Endpoints** | 11 GET endpoints | 4 endpoints (1 POST, 2 GET, 1 health) |
| **Use Cases** | Inventory checks, order history, tracking | Webstore checkout, reorders, bulk imports |
| **Caching** | 5 minutes to 24 hours | No caching (writes are immediate) |
| **Authentication** | Server-side JWT (1-hour cache) | Server-side JWT (1-hour cache) |
| **Rate Limiting** | 30 requests/minute | 30 requests/minute |

**Architecture:**
```
Customer Checkout → Your Website → NWCA Proxy → ManageOrders API → OnSite ERP
                                   (validates)   (authenticates)   (imports hourly)
```

### Why Use the PUSH API?

**Problem Without PUSH API:**
1. Customer places order on website
2. **Manual data entry** into ShopWorks by staff
3. Risk of typos and data entry errors
4. Delayed order processing

**Solution With PUSH API:**
1. Customer places order on website
2. **Automatic order creation** in ShopWorks
3. Order appears in OnSite for production ✅
4. No manual entry required

---

## 🚀 Quick Reference

### Base URL
```
https://caspio-pricing-proxy-ab30a049961a.herokuapp.com
```

### Available Endpoints

```
POST   /api/manageorders/orders/create          Create new order
GET    /api/manageorders/orders/verify/:id      Verify order was created
POST   /api/manageorders/auth/test              Test API credentials
GET    /api/manageorders/push/health            Health check
```

### Minimal Working Order Example

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

// Send order
const response = await fetch(
  'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/manageorders/orders/create',
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(order)
  }
);

const result = await response.json();
console.log('Order created:', result.orderNumber);
// Output: "Order created: NWCA-12345"
```

**Result:** Order appears in ShopWorks OnSite ready for production

---

## 💡 Integration Scenarios

### Scenario 1: Online Store Checkout

**Use Case:** Customer adds products to cart, proceeds to checkout, order is automatically sent to OnSite

**Flow:**
1. Customer selects products (using PULL API for real-time inventory)
2. Customer enters shipping/billing information
3. Customer completes payment (Stripe, PayPal, etc.)
4. Website sends order to PUSH API
5. Order appears in ShopWorks for production
6. Confirmation email sent to customer

**Key Features:**
- Real-time inventory validation (PULL API: `inventorylevels`)
- Automatic size translation (webstore "L" → OnSite Size03)
- Order tracking (PULL API: `tracking/:order_no`)

### Scenario 2: Customer Reorder Portal

**Use Case:** Existing customer logs in and reorders previous items

**Flow:**
1. Customer logs in with email
2. System retrieves order history (PULL API: `orders?customerEmail=...`)
3. Customer selects previous order to duplicate
4. System creates new order (PUSH API: `orders/create`)
5. Order confirmation sent

**Key Features:**
- Order history lookup (PULL API: `orders`)
- One-click reorder
- Automatic customer information prefill

### Scenario 3: Bulk Order Import

**Use Case:** Import multiple orders from external system (marketplace, CRM, etc.)

**Flow:**
1. Export orders from external system (CSV, JSON)
2. Parse and validate orders
3. Loop through orders, sending each to PUSH API
4. Track success/failure for each order
5. Generate import report

**Key Features:**
- Batch processing
- Error handling and retry logic
- Test mode for validation (`isTest: true`)

### Scenario 4: Mobile App Ordering

**Use Case:** Sales reps create orders via mobile app while on-site with customer

**Flow:**
1. Sales rep logs into mobile app
2. Searches for products (PULL API: `inventorylevels`)
3. Builds order with customer
4. Submits order (PUSH API: `orders/create`)
5. Order syncs to OnSite immediately

**Key Features:**
- Offline capability (queue orders, sync when online)
- Real-time inventory checks
- Mobile-optimized interface

---

## 📚 Complete Documentation Reference

### Full Developer Guide Location

**File:** `caspio-pricing-proxy/memory/ONLINE_STORE_DEVELOPER_GUIDE.md`

**Path:** `C:\Users\erik\OneDrive - Northwest Custom Apparel\2025\caspio-pricing-proxy\memory\ONLINE_STORE_DEVELOPER_GUIDE.md`

**Size:** 1267 lines, 19.5k characters

### What's in the Complete Guide

1. **Overview** - Architecture, authentication, order flow
2. **Quick Start** - Get your first order working in 5 minutes
3. **API Endpoints** - Complete specification for all 4 endpoints
4. **Order Structure** - Required and optional fields
5. **Field Reference** - Detailed documentation for all 40+ fields
6. **Size Translation** - Automatic size mapping (50+ size variations)
7. **Code Examples** - JavaScript, Node.js, Python, PHP implementations
8. **Testing Guide** - Test mode, common test cases, verification
9. **Production Checklist** - Pre-launch requirements
10. **Troubleshooting** - Common errors and solutions

### Code Examples Included

**Languages:**
- JavaScript (browser-based)
- Node.js (server-side)
- Python (backend integration)
- PHP (legacy system integration)

**Features:**
- Complete order submission
- Error handling and retry logic
- Size translation utilities
- Order verification
- Test mode examples

---

## 🔍 Key Differences: PUSH vs PULL

### Data Flow

**PULL API (Reading Data):**
```
Your App → NWCA Proxy → ShopWorks → Returns Data
         (cache check)  (authenticated)
```

**PUSH API (Writing Data):**
```
Your App → NWCA Proxy → ManageOrders → OnSite (hourly import)
         (validates)   (creates order)  (production)
```

### Authentication

**Both use the same authentication:**
- Server-side JWT token management
- 1-hour token cache
- Automatic token refresh
- No credentials exposed to browser

### Caching

**PULL API:** Intelligent caching (5 minutes to 24 hours)
**PUSH API:** No caching (writes must be immediate)

### Error Handling

**PULL API:**
- Empty arrays for "not found" (200 status)
- No exceptions for missing data
- Cache can serve stale data on errors

**PUSH API:**
- Returns error details for validation failures
- Order number returned on success
- No retry - app must handle failures

---

## 🏗️ Building a Complete Webstore

### Step-by-Step Implementation

**Phase 1: Product Display (PULL API)**
1. Fetch product catalog from your database
2. Check real-time inventory: `GET /api/manageorders/inventorylevels?PartNumber=PC54`
3. Display "In Stock" / "Out of Stock" based on inventory levels
4. Update inventory every 5 minutes (cache duration)

**Phase 2: Shopping Cart**
1. Store cart in browser (localStorage or session)
2. Validate inventory before checkout
3. Calculate totals (products + decoration + shipping)
4. Apply discounts/promotions

**Phase 3: Checkout (PUSH API)**
1. Collect customer information (name, email, phone, address)
2. Process payment (Stripe, PayPal, etc.)
3. Build order object with line items
4. Send order: `POST /api/manageorders/orders/create`
5. Verify order: `GET /api/manageorders/orders/verify/:id`
6. Send confirmation email to customer

**Phase 4: Order Tracking (PULL API)**
1. Store order number from PUSH API response
2. Provide customer with order lookup page
3. Fetch order status: `GET /api/manageorders/orders/:order_no`
4. Fetch tracking info: `GET /api/manageorders/tracking/:order_no`
5. Display shipment details to customer

### Architecture Pattern

```javascript
class WebstoreIntegration {
  constructor() {
    this.apiBase = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
  }

  // PULL API - Check inventory
  async checkInventory(partNumber) {
    const response = await fetch(
      `${this.apiBase}/api/manageorders/inventorylevels?PartNumber=${partNumber}`
    );
    return response.json();
  }

  // PUSH API - Create order
  async createOrder(orderData) {
    const response = await fetch(
      `${this.apiBase}/api/manageorders/orders/create`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData)
      }
    );
    return response.json();
  }

  // PULL API - Track order
  async trackOrder(orderNumber) {
    const response = await fetch(
      `${this.apiBase}/api/manageorders/tracking/${orderNumber}`
    );
    return response.json();
  }
}
```

---

## ✅ Integration Checklist

### Before Development

- [ ] Read complete developer guide in caspio-pricing-proxy repository
- [ ] Understand PUSH vs PULL API differences
- [ ] Review order structure and required fields
- [ ] Test API credentials: `POST /api/manageorders/auth/test`
- [ ] Check health endpoint: `GET /api/manageorders/push/health`

### During Development

- [ ] Use test mode (`isTest: true`) for all testing
- [ ] Implement size translation for webstore sizes
- [ ] Add error handling and user-friendly messages
- [ ] Validate inventory before order submission (PULL API)
- [ ] Test with multiple size variations
- [ ] Test with multiple products per order
- [ ] Implement order verification after creation

### Before Production

- [ ] Remove all test orders from ShopWorks
- [ ] Switch to production mode (`isTest: false`)
- [ ] Test complete checkout flow end-to-end
- [ ] Verify orders appear in ShopWorks OnSite
- [ ] Test order tracking functionality
- [ ] Set up monitoring for failed orders
- [ ] Document customer support procedures

### After Launch

- [ ] Monitor order creation success rate
- [ ] Track inventory synchronization
- [ ] Review order accuracy in ShopWorks
- [ ] Collect customer feedback
- [ ] Optimize performance (caching, batching)

---

## 🚨 Critical Concepts

### 1. ExtOrderID Format

**Your Order Number:** `WEB-12345` (your internal ID)
**OnSite Order Number:** `NWCA-12345` (NWCA prefix added automatically)

**Test Orders:** `NWCA-TEST-12345` (TEST prefix added when `isTest: true`)

### 2. Size Translation

**Automatic translation happens for 50+ size variations:**

```
Webstore Size → OnSite Column
"S"           → Size01
"M"           → Size02
"L"           → Size03
"XL"          → Size04
"2XL"         → Size05
"3XL"         → Size06
```

**Full translation table in complete developer guide**

### 3. Customer Assignment

**All webstore orders assigned to Customer #2791**
- Actual customer info stored in Contact fields
- Name, email, phone, address all preserved
- Allows tracking without creating new customers for every order

### 4. Date Format

**Required format:** `YYYY-MM-DD`

```javascript
// ✅ CORRECT
dateOrdered: "2025-10-27"
dateShip: "2025-11-03"

// ❌ WRONG
dateOrdered: "10/27/2025"
dateShip: "2025-11-03T10:30:00"
```

### 5. Hourly Import

**Orders imported from ManageOrders into OnSite every hour**
- Order appears in ManageOrders immediately
- OnSite import happens on the hour
- Production can begin after import completes

---

## 📞 Support & Resources

### Documentation Quick Links

- **Complete PUSH API Guide:** `caspio-pricing-proxy/memory/ONLINE_STORE_DEVELOPER_GUIDE.md`
- **PULL API Integration:** [MANAGEORDERS_INTEGRATION.md](MANAGEORDERS_INTEGRATION.md)
- **API Reference:** [manageorders/API_REFERENCE.md](manageorders/API_REFERENCE.md)
- **Code Examples:** [manageorders/INTEGRATION_EXAMPLES.md](manageorders/INTEGRATION_EXAMPLES.md)

### Testing Resources

- **Test Endpoint:** `POST /api/manageorders/auth/test`
- **Health Check:** `GET /api/manageorders/push/health`
- **Test Mode:** Set `isTest: true` in order object

### Rate Limiting

- **30 requests/minute** per IP
- Applies to both PULL and PUSH APIs
- 429 status returned when limit exceeded
- Use batch operations when possible

---

## 🎉 Success Metrics

### Webstore Integration Checklist

✅ **Product Display:** Real-time inventory from PULL API (5-minute cache)
✅ **Checkout Flow:** Orders created via PUSH API
✅ **Order Verification:** Confirmation via verify endpoint
✅ **Order Tracking:** Customer self-service via PULL API
✅ **Customer Portal:** Order history and tracking
✅ **Error Handling:** User-friendly messages for all failures
✅ **Testing:** Complete test coverage with `isTest: true`
✅ **Production Ready:** All checklist items completed

### Next Steps

1. Read complete developer guide in caspio-pricing-proxy repository
2. Test API credentials and health endpoint
3. Implement product display with real-time inventory (PULL API)
4. Build checkout flow with order creation (PUSH API)
5. Add order tracking functionality (PULL API)
6. Test end-to-end with test orders
7. Launch and monitor

---

**Documentation Type:** Reference guide with links to complete implementation
**Related Files:** Complete guide in caspio-pricing-proxy repository
**Last Updated:** 2025-10-27
**Status:** Production-ready for online store integration
