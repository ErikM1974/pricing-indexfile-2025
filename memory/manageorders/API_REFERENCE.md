# ManageOrders API - Complete Reference

**Last Updated:** 2025-01-27
**Purpose:** Complete API specification for caspio-pricing-proxy ManageOrders endpoints
**Parent Document:** [MANAGEORDERS_INTEGRATION.md](../MANAGEORDERS_INTEGRATION.md)
**API Version:** 1.0
**Base URL:** `https://caspio-pricing-proxy-ab30a049961a.herokuapp.com`

---

## 📋 Table of Contents

1. [API Overview](#api-overview)
2. [Authentication](#authentication)
3. [Common Response Codes](#common-response-codes)
4. [Customers Endpoint](#customers-endpoint)
5. [Orders Endpoints](#orders-endpoints)
6. [Line Items Endpoint](#line-items-endpoint)
7. [Payments Endpoints](#payments-endpoints)
8. [Tracking Endpoints](#tracking-endpoints)
9. [Inventory Endpoint](#inventory-endpoint)
10. [Caching & Performance](#caching-performance)
11. [Data Structures](#data-structures)

---

## API Overview

### Base Information

```yaml
openapi: 3.0.0
info:
  title: ManageOrders Proxy API
  description: Proxy server for ShopWorks OnSite 7 ManageOrders API with intelligent caching
  version: 1.0
  contact:
    name: NWCA Development Team
servers:
  - url: https://caspio-pricing-proxy-ab30a049961a.herokuapp.com
    description: Heroku production proxy server
```

### Endpoint Categories

| Category | Endpoints | Cache Duration | Purpose | Status |
|----------|-----------|----------------|---------|--------|
| Customers | 1 | 24 hours | Unique customer list for autocomplete | ✅ Production |
| Orders | 3 | 1 hour / 24 hours | Order queries and lookups | ✅ Production |
| Line Items | 1 | 24 hours | Product details within orders | ✅ Production |
| Payments | 2 | 1 hour / 24 hours | Payment and invoice tracking | ✅ Production |
| Tracking | 2 | 15 minutes | Shipment tracking | ✅ Production |
| Inventory | 1 | **5 minutes** | Real-time stock levels ⭐ | ✅ Production |
| Utilities | 1 | None | Cache diagnostics | ✅ Production |

**Total Endpoints:** 11
**All Implemented and Production-Ready** ✅

### Key Features

- **No Authentication Required** - Browser can call directly (credentials managed server-side)
- **Intelligent Caching** - 5 minutes to 24 hours based on data volatility
- **Rate Limiting** - 30 requests/minute per IP
- **Cache Bypass** - Add `?refresh=true` to force fresh data
- **CORS Enabled** - Authorized origins only

---

## Authentication

### Server-Side Only

**IMPORTANT:** All ManageOrders API authentication is handled server-side by the proxy. Browser applications require **no authentication** to call these endpoints.

**Server-Side Flow:**
1. Proxy receives request from browser
2. Checks token cache (1-hour TTL)
3. If expired, authenticates with ShopWorks ManageOrders API
4. Caches new token server-side
5. Makes authenticated request to ShopWorks
6. Returns data to browser (never exposes token)

**Security Benefits:**
- ✅ No credentials in browser code
- ✅ No tokens sent to client
- ✅ Reduced authentication API calls (1-hour token cache)
- ✅ CORS protection limits access to authorized origins

**Browser Usage:**
```javascript
// No auth headers needed!
const response = await fetch(
  'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/manageorders/customers'
);
const data = await response.json();
```

---

## Common Response Codes

| Code | Status | Description |
|------|--------|-------------|
| 200 | OK | Request succeeded |
| 304 | Not Modified | Cache still valid (ETag match) |
| 400 | Bad Request | Invalid query parameters |
| 404 | Not Found | Resource doesn't exist |
| 429 | Too Many Requests | Rate limit exceeded (30/min) |
| 500 | Internal Server Error | Proxy or ShopWorks error |
| 502 | Bad Gateway | ShopWorks API unavailable |

---

## Customers Endpoint

### GET /api/manageorders/customers

**Description:** Get unique customers from last 60 days of orders for autocomplete functionality

**Cache Duration:** 24 hours (data changes slowly)

**Headers:**
```http
GET /api/manageorders/customers HTTP/1.1
```

**Query Parameters:** None

**Response (200 OK):**
```json
{
  "customers": [
    {
      "id_Customer": 123,
      "CustomerName": "Arrow Lumber and Hardware",
      "ContactFirstName": "John",
      "ContactLastName": "Smith",
      "ContactEmail": "john@arrowlumber.com",
      "ContactPhone": "253-555-1234",
      "CustomerServiceRep": "Nika Lao"
    }
  ],
  "count": 389,
  "metadata": {
    "dateRange": "Last 60 days",
    "cached": true,
    "cacheAge": "2 hours"
  }
}
```

**Example Usage:**
```javascript
// Initialize customer service
const service = new ManageOrdersCustomerService();
await service.initialize();

// Search customers
const results = service.searchCustomers('arrow');
// Returns matching customers sorted by relevance
```

**Use Cases:**
- Customer autocomplete in quote builders
- Customer search in order forms
- Sales rep customer lists

**Implementation:** See [CUSTOMER_AUTOCOMPLETE.md](CUSTOMER_AUTOCOMPLETE.md)

---

## Orders Endpoints

### GET /api/manageorders/orders

**Description:** Query orders with date range and customer filters

**Cache Duration:** 1 hour (intraday changes possible)

**Headers:**
```http
GET /api/manageorders/orders?date_Ordered_start=2025-01-01&date_Ordered_end=2025-01-27 HTTP/1.1
```

**Query Parameters:**

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| `date_Ordered_start` | string | No | Start of order date range (YYYY-MM-DD) | `2025-01-01` |
| `date_Ordered_end` | string | No | End of order date range (YYYY-MM-DD) | `2025-01-27` |
| `date_Invoiced_start` | string | No | Start of invoice date range | `2025-01-01` |
| `date_Invoiced_end` | string | No | End of invoice date range | `2025-01-27` |
| `date_Shipped_start` | string | No | Start of ship date range | `2025-01-01` |
| `date_Shipped_end` | string | No | End of ship date range | `2025-01-27` |
| `id_Customer` | integer | No | Filter by customer ID | `123` |

**Response (200 OK):**
```json
{
  "result": [
    {
      "order_no": 12345,
      "ext_order_id": "SP0127-1",
      "id_Customer": 123,
      "CustomerName": "Arrow Lumber and Hardware",
      "date_Ordered": "2025-01-27",
      "date_Due": "2025-02-05",
      "date_InHand": "2025-02-04",
      "date_Shipped": null,
      "date_Invoiced": null,
      "Subtotal": 500.00,
      "SalesTax": 45.00,
      "Shipping": 0.00,
      "Total": 545.00,
      "Status": "Open",
      "Notes": "Rush order - need by Feb 5"
    }
  ],
  "count": 1,
  "cached": true
}
```

**Cache Bypass:**
```javascript
// Force fresh data
const response = await fetch(
  'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/manageorders/orders?refresh=true'
);
```

---

### GET /api/manageorders/orders/:order_no

**Description:** Get specific order by order number

**Cache Duration:** 24 hours (historical data)

**Path Parameters:**
- `order_no` (integer): ShopWorks order number

**Request Example:**
```http
GET /api/manageorders/orders/12345 HTTP/1.1
```

**Response (200 OK):**
```json
{
  "result": [
    {
      "order_no": 12345,
      "ext_order_id": "SP0127-1",
      "id_Customer": 123,
      "CustomerName": "Arrow Lumber and Hardware",
      "ContactName": "John Smith",
      "ContactEmail": "john@arrowlumber.com",
      "ContactPhone": "253-555-1234",
      "date_Ordered": "2025-01-27",
      "date_Due": "2025-02-05",
      "Subtotal": 500.00,
      "Total": 545.00,
      "Status": "Open"
    }
  ]
}
```

---

### GET /api/manageorders/getorderno/:ext_order_id

**Description:** Map external order ID (quote ID) to ShopWorks order number

**Cache Duration:** 24 hours (mapping doesn't change)

**Path Parameters:**
- `ext_order_id` (string): External order ID from quote system (e.g., "SP0127-1")

**Request Example:**
```http
GET /api/manageorders/getorderno/SP0127-1 HTTP/1.1
```

**Response (200 OK):**
```json
{
  "result": [
    {
      "order_no": 12345,
      "ext_order_id": "SP0127-1"
    }
  ]
}
```

**Use Case:**
```javascript
// Customer has quote ID, need to look up order status
async function findOrderByQuoteID(quoteID) {
  // Step 1: Get ShopWorks order number
  const mappingResponse = await fetch(
    `https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/manageorders/getorderno/${quoteID}`
  );
  const mappingData = await mappingResponse.json();

  if (!mappingData.result || mappingData.result.length === 0) {
    return { error: 'Quote not found in ShopWorks' };
  }

  const orderNo = mappingData.result[0].order_no;

  // Step 2: Get full order details
  const orderResponse = await fetch(
    `https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/manageorders/orders/${orderNo}`
  );
  return await orderResponse.json();
}
```

---

## Line Items Endpoint

### GET /api/manageorders/lineitems/:order_no

**Description:** Get product line items for a specific order

**Cache Duration:** 24 hours (historical data)

**Path Parameters:**
- `order_no` (integer): ShopWorks order number

**Request Example:**
```http
GET /api/manageorders/lineitems/12345 HTTP/1.1
```

**Response (200 OK):**
```json
{
  "result": [
    {
      "line_no": 1,
      "order_no": 12345,
      "PartNumber": "PC54",
      "Color": "Forest",
      "Description": "Port & Company Core Cotton Tee - Forest Green",
      "Size01": 3,
      "Size02": 12,
      "Size03": 18,
      "Size04": 12,
      "Size05": 3,
      "Size06": 0,
      "Quantity": 48,
      "UnitPrice": 10.50,
      "ExtPrice": 504.00,
      "Notes": "Screen print front and back"
    }
  ]
}
```

**Size Field Mapping:**

| Field | Size | Common Label |
|-------|------|--------------|
| `Size01` | XS | Extra Small |
| `Size02` | S | Small |
| `Size03` | M | Medium |
| `Size04` | L | Large |
| `Size05` | XL | Extra Large |
| `Size06` | 2XL | 2X Large |

**Example: Calculate Size Distribution:**
```javascript
function parseSizeBreakdown(lineItem) {
  return {
    'XS': lineItem.Size01 || 0,
    'S': lineItem.Size02 || 0,
    'M': lineItem.Size03 || 0,
    'L': lineItem.Size04 || 0,
    'XL': lineItem.Size05 || 0,
    '2XL': lineItem.Size06 || 0
  };
}
```

---

## Payments Endpoints

### GET /api/manageorders/payments

**Description:** Query payments with date range filters

**Cache Duration:** 1 hour (intraday changes)

**Query Parameters:**

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| `date_start` | string | No | Start date (YYYY-MM-DD) | `2025-01-01` |
| `date_end` | string | No | End date (YYYY-MM-DD) | `2025-01-27` |

**Request Example:**
```http
GET /api/manageorders/payments?date_start=2025-01-01&date_end=2025-01-27 HTTP/1.1
```

**Response (200 OK):**
```json
{
  "result": [
    {
      "order_no": 12345,
      "InvoiceNumber": "INV-2025-0127",
      "InvoiceDate": "2025-01-27",
      "InvoiceAmount": 545.00,
      "AmountPaid": 545.00,
      "Balance": 0.00,
      "PaymentDate": "2025-01-29",
      "PaymentMethod": "Credit Card",
      "Status": "Paid"
    }
  ]
}
```

---

### GET /api/manageorders/payments/:order_no

**Description:** Get payments for specific order

**Cache Duration:** 24 hours (historical data)

**Path Parameters:**
- `order_no` (integer): ShopWorks order number

**Request Example:**
```http
GET /api/manageorders/payments/12345 HTTP/1.1
```

**Response (200 OK):**
```json
{
  "result": [
    {
      "order_no": 12345,
      "InvoiceNumber": "INV-2025-0127",
      "InvoiceAmount": 545.00,
      "AmountPaid": 545.00,
      "Balance": 0.00,
      "PaymentDate": "2025-01-29",
      "Status": "Paid"
    }
  ]
}
```

---

## Tracking Endpoints

### GET /api/manageorders/tracking

**Description:** Query shipment tracking with date range filters

**Cache Duration:** 15 minutes (updates during shipping)

**Query Parameters:**

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| `date_start` | string | No | Start date (YYYY-MM-DD) | `2025-01-01` |
| `date_end` | string | No | End date (YYYY-MM-DD) | `2025-01-27` |

**Request Example:**
```http
GET /api/manageorders/tracking?date_start=2025-01-20&date_end=2025-01-27 HTTP/1.1
```

**Response (200 OK):**
```json
{
  "result": [
    {
      "order_no": 12345,
      "ShipDate": "2025-01-26",
      "Carrier": "UPS",
      "TrackingNumber": "1Z999AA10123456784",
      "EstimatedDelivery": "2025-01-30",
      "Status": "In Transit"
    }
  ]
}
```

---

### GET /api/manageorders/tracking/:order_no

**Description:** Get tracking for specific order

**Cache Duration:** 15 minutes (updates frequently)

**Path Parameters:**
- `order_no` (integer): ShopWorks order number

**Request Example:**
```http
GET /api/manageorders/tracking/12345 HTTP/1.1
```

**Response (200 OK):**
```json
{
  "result": [
    {
      "order_no": 12345,
      "ShipDate": "2025-01-26",
      "Carrier": "UPS",
      "TrackingNumber": "1Z999AA10123456784",
      "Status": "Delivered"
    }
  ]
}
```

---

## Inventory Endpoint

### GET /api/manageorders/inventorylevels

**Description:** ⭐ Real-time inventory levels with 5-minute cache (CRITICAL for webstore)

**Cache Duration:** **5 minutes** (most aggressive caching for real-time needs)

**Query Parameters:**

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| `PartNumber` | string | No | Filter by style/part number | `PC54` |
| `Color` | string | No | Filter by exact color name | `Jet Black` |
| `ColorRange` | string | No | Filter by color range | `Black` |
| `SKU` | string | No | Filter by vendor SKU | `PC54-BLK-M` |
| `VendorName` | string | No | Filter by vendor | `Port & Company` |

**Request Example:**
```http
GET /api/manageorders/inventorylevels?PartNumber=PC54&Color=Jet%20Black HTTP/1.1
```

**Response (200 OK):**
```json
{
  "result": [
    {
      "Color": "Jet Black",
      "PartNumber": "PC54",
      "Size01": 4,
      "Size02": 10,
      "Size03": 11,
      "Size04": 79,
      "Size05": 0,
      "Size06": 0,
      "Description": "Port & Company Core Cotton Tee",
      "VendorName": "Port & Company",
      "SKU": "PC54-BLK"
    }
  ],
  "cached": true,
  "cacheAge": "3 minutes"
}
```

**Size Field Mapping (Same as Line Items):**

| Field | Size |
|-------|------|
| `Size01` | XS |
| `Size02` | S |
| `Size03` | M |
| `Size04` | L |
| `Size05` | XL |
| `Size06` | 2XL |

**Example: Check Stock Availability:**
```javascript
async function checkInventory(partNumber, color) {
  const response = await fetch(
    `https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/manageorders/inventorylevels?PartNumber=${partNumber}&Color=${encodeURIComponent(color)}`
  );
  const data = await response.json();

  if (!data.result || data.result.length === 0) {
    return { available: false, message: 'Product not found' };
  }

  const inventory = data.result[0];
  const totalStock =
    (inventory.Size01 || 0) +
    (inventory.Size02 || 0) +
    (inventory.Size03 || 0) +
    (inventory.Size04 || 0) +
    (inventory.Size05 || 0) +
    (inventory.Size06 || 0);

  return {
    available: totalStock > 0,
    totalStock: totalStock,
    sizeBreakdown: {
      'XS': inventory.Size01 || 0,
      'S': inventory.Size02 || 0,
      'M': inventory.Size03 || 0,
      'L': inventory.Size04 || 0,
      'XL': inventory.Size05 || 0,
      '2XL': inventory.Size06 || 0
    },
    cacheAge: data.cacheAge
  };
}

// Usage in webstore
const stock = await checkInventory('PC54', 'Jet Black');
if (!stock.available) {
  showOutOfStockMessage();
} else {
  enableSizeSelector(stock.sizeBreakdown);
}
```

**Webstore Integration Pattern:**
```javascript
// Check inventory before allowing "Add to Cart"
document.getElementById('addToCart').addEventListener('click', async () => {
  const partNumber = document.getElementById('styleSelect').value;
  const color = document.getElementById('colorSelect').value;

  const stock = await checkInventory(partNumber, color);

  if (!stock.available) {
    alert('This product is currently out of stock. Please choose another color or contact us.');
    return;
  }

  // Show size selector with only available sizes
  showSizeSelector(stock.sizeBreakdown);
});
```

---

## Caching & Performance

### GET /api/manageorders/cache-info

**Description:** Debug endpoint showing cache status for all ManageOrders endpoints

**Cache Duration:** None (always fresh)

**Request Example:**
```http
GET /api/manageorders/cache-info HTTP/1.1
```

**Response (200 OK):**
```json
{
  "customers": {
    "cached": true,
    "age": "2 hours 15 minutes",
    "size": "45 KB",
    "ttl": "24 hours"
  },
  "orders": {
    "cached": false,
    "message": "No cached data",
    "ttl": "1 hour"
  },
  "inventorylevels": {
    "cached": true,
    "age": "3 minutes",
    "size": "120 KB",
    "ttl": "5 minutes"
  }
}
```

### Cache Strategy Summary

| Endpoint | Cache Duration | Rationale |
|----------|----------------|-----------|
| `inventorylevels` | **5 minutes** | Real-time stock critical for webstore |
| `tracking` | 15 minutes | Updates during shipping day |
| `tracking/:order_no` | 15 minutes | Same as tracking queries |
| `orders` (query) | 1 hour | Intraday changes possible |
| `payments` (query) | 1 hour | Payment status can change |
| `orders/:order_no` | 24 hours | Historical data stable |
| `getorderno/:ext_id` | 24 hours | Mapping doesn't change |
| `lineitems/:order_no` | 24 hours | Order contents final |
| `payments/:order_no` | 24 hours | Payment history stable |
| `customers` | 24 hours | Customer list changes slowly |

### Cache Bypass

**Force Fresh Data:**
```javascript
// Add ?refresh=true to any endpoint
const response = await fetch(
  'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/manageorders/inventorylevels?PartNumber=PC54&refresh=true'
);
```

**When to Use Cache Bypass:**
- User clicks "Refresh" button
- Critical decision (e.g., final checkout)
- Debugging cache issues
- Testing new integrations

**When NOT to Use:**
- Regular page loads (wastes API quota)
- Autocomplete searches (use cached data)
- Display-only information

---

## Data Structures

### Customer Object

```javascript
{
  "id_Customer": 123,              // Primary key
  "CustomerName": "Arrow Lumber and Hardware",
  "ContactFirstName": "John",
  "ContactLastName": "Smith",
  "ContactEmail": "john@arrowlumber.com",
  "ContactPhone": "253-555-1234",
  "CustomerServiceRep": "Nika Lao"
}
```

### Order Object

```javascript
{
  "order_no": 12345,               // ShopWorks order number
  "ext_order_id": "SP0127-1",      // External/quote ID
  "id_Customer": 123,
  "CustomerName": "Arrow Lumber and Hardware",
  "ContactName": "John Smith",
  "ContactEmail": "john@arrowlumber.com",
  "ContactPhone": "253-555-1234",
  "date_Ordered": "2025-01-27",
  "date_Due": "2025-02-05",
  "date_InHand": "2025-02-04",
  "date_Shipped": null,
  "date_Invoiced": null,
  "Subtotal": 500.00,
  "SalesTax": 45.00,
  "Shipping": 0.00,
  "Total": 545.00,
  "Status": "Open",
  "Notes": "Rush order - need by Feb 5"
}
```

### Line Item Object

```javascript
{
  "line_no": 1,
  "order_no": 12345,
  "PartNumber": "PC54",
  "Color": "Forest",
  "Description": "Port & Company Core Cotton Tee - Forest Green",
  "Size01": 3,    // XS
  "Size02": 12,   // S
  "Size03": 18,   // M
  "Size04": 12,   // L
  "Size05": 3,    // XL
  "Size06": 0,    // 2XL
  "Quantity": 48,
  "UnitPrice": 10.50,
  "ExtPrice": 504.00,
  "Notes": "Screen print front and back"
}
```

### Inventory Object

```javascript
{
  "Color": "Jet Black",
  "PartNumber": "PC54",
  "Size01": 4,    // XS quantity
  "Size02": 10,   // S quantity
  "Size03": 11,   // M quantity
  "Size04": 79,   // L quantity
  "Size05": 0,    // XL quantity (OUT OF STOCK)
  "Size06": 0,    // 2XL quantity (OUT OF STOCK)
  "Description": "Port & Company Core Cotton Tee",
  "VendorName": "Port & Company",
  "SKU": "PC54-BLK"
}
```

### Payment Object

```javascript
{
  "order_no": 12345,
  "InvoiceNumber": "INV-2025-0127",
  "InvoiceDate": "2025-01-27",
  "InvoiceAmount": 545.00,
  "AmountPaid": 545.00,
  "Balance": 0.00,
  "PaymentDate": "2025-01-29",
  "PaymentMethod": "Credit Card",
  "Status": "Paid"
}
```

### Tracking Object

```javascript
{
  "order_no": 12345,
  "ShipDate": "2025-01-26",
  "Carrier": "UPS",
  "TrackingNumber": "1Z999AA10123456784",
  "EstimatedDelivery": "2025-01-30",
  "Status": "In Transit"
}
```

---

## Rate Limits

**Current Limits:**
- 30 requests per minute per IP
- Applies to all ManageOrders endpoints
- Resets every 60 seconds

**Rate Limit Headers:**
```http
X-RateLimit-Limit: 30
X-RateLimit-Remaining: 25
X-RateLimit-Reset: 1706371200
```

**429 Response:**
```json
{
  "error": "Too many ManageOrders requests",
  "message": "Please try again later",
  "retryAfter": 45
}
```

**Best Practices:**
- Use caching aggressively (don't bypass unnecessarily)
- Batch requests when possible
- Use sessionStorage to cache customer list browser-side (24 hours)

---

## Security & CORS

### CORS Configuration

**Allowed Origins:**
- `https://www.nwcustomapparel.com`
- `https://teamnwca.com`
- `http://localhost:3000` (development only)

**Allowed Methods:**
- `GET` only (read-only API)

**Credentials:**
- Not allowed (authentication handled server-side)

### Security Features

- ✅ No credentials exposed to browser
- ✅ JWT tokens cached server-side only (1-hour TTL)
- ✅ Rate limiting prevents abuse
- ✅ CORS restrictions limit access
- ✅ All traffic over HTTPS

---

## Integration Examples

### Customer Autocomplete (Complete)
See [CUSTOMER_AUTOCOMPLETE.md](CUSTOMER_AUTOCOMPLETE.md)

### Order Status Lookup
See [INTEGRATION_EXAMPLES.md](INTEGRATION_EXAMPLES.md#order-status-lookup)

### Real-Time Inventory Webstore
See [INTEGRATION_EXAMPLES.md](INTEGRATION_EXAMPLES.md#webstore-inventory)

### Payment Status Dashboard
See [INTEGRATION_EXAMPLES.md](INTEGRATION_EXAMPLES.md#payment-dashboard)

### Shipment Tracking Widget
See [INTEGRATION_EXAMPLES.md](INTEGRATION_EXAMPLES.md#tracking-widget)

---

**Documentation Type:** Complete API Reference
**Parent Document:** [MANAGEORDERS_INTEGRATION.md](../MANAGEORDERS_INTEGRATION.md)
**Related:** [Overview](OVERVIEW.md) | [Integration Examples](INTEGRATION_EXAMPLES.md) | [Customer Autocomplete](CUSTOMER_AUTOCOMPLETE.md)
