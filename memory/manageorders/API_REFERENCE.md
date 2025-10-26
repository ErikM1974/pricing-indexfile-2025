# ManageOrders API - Complete Reference

**Last Updated:** 2025-01-27
**Purpose:** Complete Swagger/OpenAPI specification for ShopWorks ManageOrders API
**Parent Document:** [MANAGEORDERS_INTEGRATION.md](../MANAGEORDERS_INTEGRATION.md)
**API Version:** 1.0
**Base URL:** `https://your-shopworks-server.com` (replace with your server)

---

## 📋 Table of Contents

1. [API Overview](#api-overview)
2. [Authentication](#authentication)
3. [Common Response Codes](#common-response-codes)
4. [Orders Endpoints](#orders-endpoints)
5. [Line Items Endpoints](#line-items-endpoints)
6. [Shipments Endpoints](#shipments-endpoints)
7. [Payments Endpoints](#payments-endpoints)
8. [Inventory Endpoints](#inventory-endpoints)
9. [Data Structures](#data-structures)

---

## API Overview

### Base Information

```yaml
openapi: 3.0.0
info:
  title: ManageOrders API
  description: REST API for ShopWorks OnSite 7 production management system
  version: 1.0
  contact:
    name: ShopWorks Support
    url: https://www.shopworks.com
servers:
  - url: https://your-shopworks-server.com
    description: Your ShopWorks OnSite 7 server
```

### Endpoint Categories

| Category | Endpoints | Purpose | Current Use |
|----------|-----------|---------|-------------|
| Authentication | 1 | Get JWT token for API access | ✅ Used |
| Orders | 4 | CRUD operations on orders | ✅ Read-only |
| Line Items | 1 | Product line items within orders | 📝 Available |
| Shipments | 1 | Delivery tracking information | 📝 Available |
| Payments | 1 | Invoice and payment status | 📝 Available |
| Inventory | 1 | Product availability and stock levels | 📝 Available |

**Total Endpoints:** 10
**Currently Implemented:** 2 (Authentication + Orders GET)

---

## Authentication

### POST /api/signin

**Description:** Authenticate with ManageOrders API and receive JWT token

**Request:**
```http
POST /api/signin HTTP/1.1
Content-Type: application/json

{
  "username": "your_api_username",
  "password": "your_api_password"
}
```

**Response (200 OK):**
```json
{
  "id_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expires_in": 3600,
  "token_type": "Bearer"
}
```

**Response Fields:**
- `id_token` (string): JWT token for authenticated requests
- `expires_in` (integer): Token lifetime in seconds (3600 = 1 hour)
- `token_type` (string): Always "Bearer"

**Error Responses:**

**401 Unauthorized:**
```json
{
  "error": "Unauthorized",
  "message": "Invalid username or password"
}
```

**Example Usage:**
```javascript
const response = await fetch('https://your-server.com/api/signin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        username: 'api_readonly',
        password: 'secure_password'
    })
});

const data = await response.json();
const token = data.id_token;
```

---

## Common Response Codes

| Code | Status | Description |
|------|--------|-------------|
| 200 | OK | Request succeeded |
| 201 | Created | Resource created (POST) |
| 204 | No Content | Delete succeeded |
| 400 | Bad Request | Invalid request parameters |
| 401 | Unauthorized | Missing or invalid token |
| 404 | Not Found | Resource doesn't exist |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error |

---

## Orders Endpoints

### GET /api/orders

**Description:** Retrieve list of orders with optional filtering

**Headers:**
```http
Authorization: Bearer {token}
Content-Type: application/json
```

**Query Parameters:**

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| `fromDate` | string | No | Filter orders from date (ISO 8601) | `2025-01-01` |
| `toDate` | string | No | Filter orders to date (ISO 8601) | `2025-01-27` |
| `id_Customer` | integer | No | Filter by customer ID | `123` |
| `id_OrderType` | integer | No | Filter by order type | `13` |
| `Status` | string | No | Filter by status | `Open`, `Complete` |

**Request Example:**
```http
GET /api/orders?fromDate=2024-12-01&toDate=2025-01-27 HTTP/1.1
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

**Response (200 OK):**
```json
[
  {
    "id_Order": 12345,
    "ExtOrderID": "SP0127-1",
    "id_Customer": 456,
    "CustomerName": "Arrow Lumber and Hardware",
    "ContactFirstName": "John",
    "ContactLastName": "Smith",
    "ContactEmail": "john@arrowlumber.com",
    "ContactPhone": "253-555-1234",
    "CustomerServiceRep": "Nika Lao",
    "OrderDate": "2025-01-27T10:30:00",
    "DueDate": "2025-02-05T17:00:00",
    "Status": "Open",
    "Subtotal": 500.00,
    "Tax": 45.00,
    "Total": 545.00,
    "Notes": "Rush order - need by Feb 5",

    // Additional order fields (see Data Structures section)
    "id_OrderType": 13,
    "CustomerPO": "PO-2025-001",
    "ShipToName": "John Smith",
    "ShipToStreet": "123 Main St",
    "ShipToCity": "Seattle",
    "ShipToState": "WA",
    "ShipToZIP": "98101",
    "ShipToCountry": "USA",
    "ShippingMethod": "UPS Ground",
    "TrackingNumber": "",
    "ShipDate": null,
    "InvoiceNumber": "",
    "InvoiceDate": null,
    "Terms": "Net 30",
    "SalesTaxRate": 0.09,
    "SalesTaxAmount": 45.00,
    "DiscountPercent": 0,
    "DiscountAmount": 0,
    "ShippingCharge": 0,
    "OrderSource": "Web Quote",
    "CreatedBy": "sales@nwcustomapparel.com",
    "CreatedDate": "2025-01-27T10:30:00",
    "ModifiedBy": "sales@nwcustomapparel.com",
    "ModifiedDate": "2025-01-27T10:30:00"
  }
]
```

**Complete Order Object Fields: 54 fields** (see [Order Data Structure](#order-data-structure))

---

### POST /api/orders

**Description:** Create a new order

**Headers:**
```http
Authorization: Bearer {token}
Content-Type: application/json
```

**Request Body:**
```json
{
  "ExtOrderID": "DTG0127-5",
  "id_Customer": 456,
  "id_OrderType": 15,
  "CustomerPO": "Web Quote - DTG0127-5",
  "OrderDate": "2025-01-27T10:30:00",
  "DueDate": "2025-02-10T17:00:00",
  "Status": "Open",
  "Subtotal": 850.00,
  "Tax": 76.50,
  "Total": 926.50,
  "Notes": "Direct-to-garment printing on black shirts",
  "ShipToName": "Jane Doe",
  "ShipToStreet": "456 Oak Ave",
  "ShipToCity": "Tacoma",
  "ShipToState": "WA",
  "ShipToZIP": "98402",
  "ShippingMethod": "Standard",
  "OrderSource": "Web Quote Builder"
}
```

**Response (201 Created):**
```json
{
  "id_Order": 12346,
  "ExtOrderID": "DTG0127-5",
  "message": "Order created successfully"
}
```

---

### PUT /api/orders/{id}

**Description:** Update an existing order

**Headers:**
```http
Authorization: Bearer {token}
Content-Type: application/json
```

**Path Parameters:**
- `id` (integer): Order ID (`id_Order`)

**Request Body:** (partial updates supported)
```json
{
  "Status": "In Production",
  "Notes": "Started production on 2025-01-28",
  "TrackingNumber": "1Z999AA10123456784"
}
```

**Response (200 OK):**
```json
{
  "id_Order": 12345,
  "message": "Order updated successfully"
}
```

---

### DELETE /api/orders/{id}

**Description:** Delete an order (soft delete - marks as canceled)

**Headers:**
```http
Authorization: Bearer {token}
```

**Path Parameters:**
- `id` (integer): Order ID (`id_Order`)

**Response (204 No Content):** Empty body

---

## Line Items Endpoints

### GET /api/lineItems

**Description:** Retrieve line items (products) for orders

**Headers:**
```http
Authorization: Bearer {token}
```

**Query Parameters:**

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| `id_Order` | integer | Yes | Order ID to fetch line items | `12345` |

**Request Example:**
```http
GET /api/lineItems?id_Order=12345 HTTP/1.1
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

**Response (200 OK):**
```json
[
  {
    "id_LineItem": 67890,
    "id_Order": 12345,
    "LineNumber": 1,
    "ProductDescription": "Gildan 5000 - Black T-Shirt",
    "StyleNumber": "G5000",
    "Color": "Black",
    "Quantity": 48,
    "UnitPrice": 10.50,
    "TotalPrice": 504.00,
    "PrintLocation": "Full Front",
    "PrintMethod": "DTG",
    "Notes": "White ink on black",

    // Size breakdown (JSON string)
    "SizeBreakdown": "{\"S\":6,\"M\":12,\"L\":18,\"XL\":12}",

    // Additional line item fields
    "ProductCategory": "Apparel",
    "VendorSKU": "G5000-BLK",
    "Weight": 0.35,
    "Cost": 5.25,
    "Margin": 100.00,
    "TaxExempt": false,
    "DiscountPercent": 0,
    "DiscountAmount": 0,
    "CreatedDate": "2025-01-27T10:30:00"
  }
]
```

**Complete LineItem Object Fields: 18 fields** (see [LineItem Data Structure](#lineitem-data-structure))

---

## Shipments Endpoints

### GET /api/shipments

**Description:** Retrieve shipment tracking information

**Headers:**
```http
Authorization: Bearer {token}
```

**Query Parameters:**

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| `id_Order` | integer | No | Filter by order ID | `12345` |
| `fromDate` | string | No | Filter from ship date | `2025-01-01` |
| `toDate` | string | No | Filter to ship date | `2025-01-27` |

**Request Example:**
```http
GET /api/shipments?id_Order=12345 HTTP/1.1
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

**Response (200 OK):**
```json
[
  {
    "id_Shipment": 789,
    "id_Order": 12345,
    "ShipDate": "2025-02-03T14:30:00",
    "Carrier": "UPS",
    "ShippingMethod": "Ground",
    "TrackingNumber": "1Z999AA10123456784",
    "ShippingCost": 15.50,
    "Weight": 5.2,
    "PackageCount": 1,
    "ShipToName": "John Smith",
    "ShipToStreet": "123 Main St",
    "ShipToCity": "Seattle",
    "ShipToState": "WA",
    "ShipToZIP": "98101",
    "EstimatedDelivery": "2025-02-08T17:00:00",
    "ActualDelivery": null,
    "Status": "In Transit",
    "Notes": "Signature required",
    "CreatedDate": "2025-02-03T14:30:00"
  }
]
```

---

## Payments Endpoints

### GET /api/payments

**Description:** Retrieve payment and invoice information

**Headers:**
```http
Authorization: Bearer {token}
```

**Query Parameters:**

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| `id_Order` | integer | No | Filter by order ID | `12345` |
| `id_Customer` | integer | No | Filter by customer ID | `456` |
| `Status` | string | No | Filter by payment status | `Paid`, `Pending`, `Overdue` |

**Request Example:**
```http
GET /api/payments?id_Order=12345 HTTP/1.1
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

**Response (200 OK):**
```json
[
  {
    "id_Payment": 567,
    "id_Order": 12345,
    "id_Customer": 456,
    "InvoiceNumber": "INV-2025-0127",
    "InvoiceDate": "2025-01-27T10:30:00",
    "InvoiceAmount": 545.00,
    "AmountPaid": 545.00,
    "Balance": 0.00,
    "PaymentDate": "2025-01-29T09:15:00",
    "PaymentMethod": "Credit Card",
    "PaymentReference": "CH_3abc123xyz",
    "Status": "Paid",
    "DueDate": "2025-02-26T17:00:00",
    "Terms": "Net 30",
    "Notes": "Paid via Stripe",
    "CreatedDate": "2025-01-27T10:30:00",
    "ModifiedDate": "2025-01-29T09:15:00"
  }
]
```

---

## Inventory Endpoints

### GET /api/inventoryLevels

**Description:** Retrieve product inventory levels and availability

**Headers:**
```http
Authorization: Bearer {token}
```

**Query Parameters:**

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| `styleNumber` | string | No | Filter by product style | `G5000` |
| `color` | string | No | Filter by color | `Black` |
| `location` | string | No | Filter by warehouse location | `Main Warehouse` |

**Request Example:**
```http
GET /api/inventoryLevels?styleNumber=G5000&color=Black HTTP/1.1
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

**Response (200 OK):**
```json
[
  {
    "id_InventoryLevel": 1001,
    "StyleNumber": "G5000",
    "Color": "Black",
    "Size": "Medium",
    "Location": "Main Warehouse",
    "QuantityOnHand": 500,
    "QuantityAvailable": 450,
    "QuantityReserved": 50,
    "QuantityOnOrder": 1000,
    "ReorderPoint": 200,
    "ReorderQuantity": 500,
    "Cost": 5.25,
    "AverageCost": 5.18,
    "LastReceived": "2025-01-15T10:00:00",
    "LastSold": "2025-01-26T14:30:00",
    "Notes": "Popular size",
    "CreatedDate": "2024-01-01T00:00:00",
    "ModifiedDate": "2025-01-26T14:30:00"
  }
]
```

**Complete InventoryLevel Object Fields: 17 fields** (see [InventoryLevel Data Structure](#inventorylevel-data-structure))

---

## Data Structures

### Order Data Structure

**Complete Order Object (54 fields):**

```javascript
{
  // Core Identification (4 fields)
  "id_Order": 12345,              // Primary key (integer)
  "ExtOrderID": "SP0127-1",       // External/web quote ID (string)
  "id_Customer": 456,             // Foreign key to customer (integer)
  "id_OrderType": 13,             // Order type ID (integer)

  // Customer Information (7 fields)
  "CustomerName": "Arrow Lumber and Hardware",
  "ContactFirstName": "John",
  "ContactLastName": "Smith",
  "ContactEmail": "john@arrowlumber.com",
  "ContactPhone": "253-555-1234",
  "CustomerStreet": "123 Main St",
  "CustomerCity": "Seattle",
  "CustomerState": "WA",
  "CustomerZIP": "98101",
  "CustomerCountry": "USA",

  // Sales Rep & Source (3 fields)
  "CustomerServiceRep": "Nika Lao",
  "OrderSource": "Web Quote",     // e.g., "Web Quote", "Phone", "Email"
  "CustomerPO": "PO-2025-001",    // Customer purchase order number

  // Dates (6 fields)
  "OrderDate": "2025-01-27T10:30:00",
  "DueDate": "2025-02-05T17:00:00",
  "InHandDate": "2025-02-04T17:00:00",  // When customer needs it
  "ShipDate": null,
  "InvoiceDate": null,
  "CreatedDate": "2025-01-27T10:30:00",
  "ModifiedDate": "2025-01-27T10:30:00",

  // Status & Tracking (4 fields)
  "Status": "Open",               // Open, In Production, Complete, Shipped, Canceled
  "InvoiceNumber": "",
  "TrackingNumber": "",
  "PONumber": "",                 // Internal PO number

  // Shipping Address (8 fields)
  "ShipToName": "John Smith",
  "ShipToCompany": "Arrow Lumber",
  "ShipToStreet": "123 Main St",
  "ShipToCity": "Seattle",
  "ShipToState": "WA",
  "ShipToZIP": "98101",
  "ShipToCountry": "USA",
  "ShipToPhone": "253-555-1234",

  // Shipping Details (2 fields)
  "ShippingMethod": "UPS Ground",
  "ShippingCharge": 0.00,

  // Financial Details (9 fields)
  "Subtotal": 500.00,
  "Tax": 45.00,
  "Total": 545.00,
  "SalesTaxRate": 0.09,
  "SalesTaxAmount": 45.00,
  "DiscountPercent": 0,
  "DiscountAmount": 0,
  "Terms": "Net 30",               // Payment terms
  "CreditLimit": 5000.00,

  // Production & Notes (5 fields)
  "Notes": "Rush order - need by Feb 5",
  "ProductionNotes": "Use black ink on white shirts",
  "ShippingNotes": "Call before delivery",
  "InternalNotes": "VIP customer",
  "SpecialInstructions": "Signature required",

  // Audit Fields (2 fields)
  "CreatedBy": "sales@nwcustomapparel.com",
  "ModifiedBy": "sales@nwcustomapparel.com",

  // Department & Priority (2 fields)
  "Department": "Screen Print",    // NEW in OnSite 7
  "Priority": "Rush"               // Standard, Rush, Super Rush
}
```

### LineItem Data Structure

**Complete LineItem Object (18 fields):**

```javascript
{
  // Core Identification (3 fields)
  "id_LineItem": 67890,
  "id_Order": 12345,
  "LineNumber": 1,

  // Product Information (5 fields)
  "ProductDescription": "Gildan 5000 - Black T-Shirt",
  "StyleNumber": "G5000",
  "Color": "Black",
  "ProductCategory": "Apparel",
  "VendorSKU": "G5000-BLK",

  // Quantity & Sizing (2 fields)
  "Quantity": 48,
  "SizeBreakdown": "{\"S\":6,\"M\":12,\"L\":18,\"XL\":12}",  // JSON string

  // Pricing (5 fields)
  "UnitPrice": 10.50,
  "TotalPrice": 504.00,
  "Cost": 5.25,                    // Wholesale cost
  "Margin": 100.00,                // Margin percentage
  "DiscountPercent": 0,
  "DiscountAmount": 0,

  // Production Details (6 fields)
  "PrintLocation": "Full Front",
  "PrintMethod": "DTG",
  "PrintColors": "White",
  "StitchCount": 0,                // For embroidery
  "ThreadColors": "",              // For embroidery
  "Notes": "White ink on black",

  // Additional Details (3 fields)
  "Weight": 0.35,                  // Pounds per item
  "TaxExempt": false,
  "CreatedDate": "2025-01-27T10:30:00"
}
```

### InventoryLevel Data Structure

**Complete InventoryLevel Object (17 fields):**

```javascript
{
  // Core Identification (5 fields)
  "id_InventoryLevel": 1001,
  "StyleNumber": "G5000",
  "Color": "Black",
  "Size": "Medium",
  "Location": "Main Warehouse",

  // Stock Levels (4 fields)
  "QuantityOnHand": 500,          // Physical inventory
  "QuantityAvailable": 450,        // Available for sale (OnHand - Reserved)
  "QuantityReserved": 50,          // Reserved for orders
  "QuantityOnOrder": 1000,         // Incoming from vendor

  // Reorder Information (2 fields)
  "ReorderPoint": 200,             // When to reorder
  "ReorderQuantity": 500,          // How much to reorder

  // Cost Information (2 fields)
  "Cost": 5.25,                    // Current cost
  "AverageCost": 5.18,             // Average cost over time

  // Activity Tracking (2 fields)
  "LastReceived": "2025-01-15T10:00:00",
  "LastSold": "2025-01-26T14:30:00",

  // Metadata (3 fields)
  "Notes": "Popular size",
  "CreatedDate": "2024-01-01T00:00:00",
  "ModifiedDate": "2025-01-26T14:30:00"
}
```

---

## Order Type IDs

Common order type IDs in ShopWorks OnSite 7:

| ID | Type | Description |
|----|------|-------------|
| 13 | Screen Print | Screen printing orders |
| 15 | DTG | Direct-to-garment printing |
| 17 | Embroidery | Embroidery orders |
| 18 | Cap | Cap embroidery |
| 20 | Promotional | Promotional products |

**Note:** Order type IDs are configured in your ShopWorks system and may vary.

---

## Rate Limits

**Recommended Rate Limits:**
- 10 requests per minute per IP (authentication endpoint)
- 60 requests per minute per IP (data endpoints)
- 1000 requests per hour per IP (total across all endpoints)

**Rate Limit Headers:**
```http
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1706371200
```

---

## Security Best Practices

### Token Management

**DO:**
- ✅ Cache tokens server-side (reduce authentication calls)
- ✅ Refresh tokens before expiration (within last 5 minutes)
- ✅ Use HTTPS for all API calls
- ✅ Store credentials in environment variables only

**DON'T:**
- ❌ Send tokens to browser/client
- ❌ Hard-code credentials in any file
- ❌ Share tokens between different applications
- ❌ Log tokens in console or files

### API Key Rotation

Rotate API credentials every 90 days:
1. Create new API user in ShopWorks
2. Update environment variables
3. Test new credentials
4. Deactivate old API user

---

**Documentation Type:** Complete API Reference (Swagger Specification)
**Parent Document:** [MANAGEORDERS_INTEGRATION.md](../MANAGEORDERS_INTEGRATION.md)
**Related:** [Overview](OVERVIEW.md) | [Customer Autocomplete](CUSTOMER_AUTOCOMPLETE.md)
