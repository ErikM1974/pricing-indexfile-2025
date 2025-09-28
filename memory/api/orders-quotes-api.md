# Orders & Quotes APIs Documentation

## 📦 MODULE: ORDERS

### Overview
Order processing, dashboard metrics, and customer management.

### Business Rules
- Orders linked to customers via CustomerID
- Order status workflow: Pending → Processing → Shipped → Delivered
- Dashboard metrics cached for 60 seconds
- Invoice date used for financial reporting (not order date)

### Resource: order-dashboard

#### Get Order Dashboard Metrics
**Endpoint**: `GET /api/order-dashboard`
**Purpose**: Pre-calculated metrics for UI dashboards with CSR performance and order type analysis

**Query Parameters**:
| Parameter | Type | Required | Description | Default |
|-----------|------|----------|-------------|---------|
| days | number | No | Days to look back | 7 |
| includeDetails | boolean | No | Include 10 most recent orders | false |
| compareYoY | boolean | No | Year-over-year comparison (Jan 1 to current) | false |

**Important Notes**:
- **Invoice Date Filtering**: Uses invoice date (not order date) for accurate financial reporting
- **60-Second Cache**: Server caches responses for 60 seconds
- **YoY Period**: Always compares Jan 1 to current date for both years

**Success Response**:
```json
{
  "summary": {
    "totalOrders": 65,
    "totalSales": 37589.93,
    "notInvoiced": 0,
    "notShipped": 45,
    "avgOrderValue": 578.31
  },
  "dateRange": {
    "start": "2025-06-28T00:00:00Z",
    "end": "2025-07-05T23:59:59Z",
    "mostRecentOrder": "2025-07-03T00:00:00"
  },
  "breakdown": {
    "byCsr": [
      {
        "name": "Nika Lao",
        "orders": 21,
        "sales": 19644.55
      },
      {
        "name": "Taylar Hanson",
        "orders": 41,
        "sales": 13407.48
      }
    ],
    "byOrderType": [
      {
        "type": "Custom Embroidery",
        "orders": 16,
        "sales": 14679.15
      },
      {
        "type": "Caps",
        "orders": 4,
        "sales": 5287.54
      }
    ]
  },
  "todayStats": {
    "ordersToday": 0,
    "salesToday": 0,
    "shippedToday": 0
  },
  "recentOrders": [], // Only if includeDetails=true
  "yearOverYear": {    // Only if compareYoY=true
    "currentYear": {
      "period": "2025-01-01 to 2025-07-05",
      "totalSales": 1334954.60,
      "orderCount": 2734
    },
    "previousYear": {
      "period": "2024-01-01 to 2024-07-05",
      "totalSales": 1486904.29,
      "orderCount": 2668
    },
    "comparison": {
      "salesGrowth": -10.22,
      "salesDifference": -151949.69,
      "orderGrowth": 2.47,
      "orderDifference": 66
    }
  }
}
```

**Field Definitions**:
- `notInvoiced`: Orders not yet invoiced
- `notShipped`: Invoiced orders not yet shipped
- `avgOrderValue`: totalSales / totalOrders
- `byCsr`: Customer Service Rep performance breakdown
- `byOrderType`: Sales breakdown by order type (DTG, Embroidery, etc.)
- `yearOverYear`: Year-to-date comparison with previous year

### Resource: orders

#### CREATE - New Order
**Endpoint**: `POST /api/orders`

**Request Body**:
```json
{
  "CustomerID": 789,
  "SessionID": "session_123",
  "TotalAmount": 299.99,
  "OrderStatus": "Pending",
  "PaymentMethod": "Credit Card",
  "ShippingAddress": "123 Main St",
  "OrderDate": "2025-01-30T10:00:00"
}
```

#### Full CRUD Operations
- `GET /api/orders` - List orders with filters
- `PUT /api/orders/:id` - Update order
- `DELETE /api/orders/:id` - Delete order

### Resource: order-odbc

#### Get Detailed Order Records
**Endpoint**: `GET /api/order-odbc`
**Purpose**: Detailed order information from ODBC view

**Query Parameters**:
- `q.where` - SQL filter
- `q.orderBy` - Sort order (default: `date_OrderInvoiced DESC`)
- `q.limit` - Max results

### Resource: customers

#### Full CRUD Operations
- `GET /api/customers` - List customers
- `POST /api/customers` - Create customer
- `PUT /api/customers/:id` - Update customer
- `DELETE /api/customers/:id` - Delete customer

---

## 📦 MODULE: ART REQUESTS & INVOICES

### Overview
Art request management and invoicing system with full CRUD operations.

### Business Rules
- Art requests tracked by status: In Progress, Completed, Cancelled
- Invoices linked to art requests
- Priority levels: Low, Normal, High, Rush

### Resource: artrequests

#### CREATE - New Art Request
**Endpoint**: `POST /api/artrequests`

**Request Body**:
```json
{
  "CompanyName": "ABC Company",
  "Status": "In Progress",
  "CustomerServiceRep": "John Doe",
  "Priority": "High",
  "Mockup": true,
  "GarmentStyle": "PC54",
  "GarmentColor": "Navy",
  "NOTES": "Rush order - need by Friday",
  "CreatedDate": "2025-01-30T10:00:00"
}
```

#### Full CRUD Operations
- `GET /api/artrequests` - List art requests
- `GET /api/artrequests/:id` - Get specific request
- `PUT /api/artrequests/:id` - Update request
- `DELETE /api/artrequests/:id` - Delete request

### Resource: art-invoices

#### Full CRUD Operations
- `GET /api/art-invoices` - List invoices
- `POST /api/art-invoices` - Create invoice
- `PUT /api/art-invoices/:id` - Update invoice
- `DELETE /api/art-invoices/:id` - Delete invoice

---

## 📦 MODULE: QUOTES

### Overview
Quote generation and management system with sessions, items, and analytics tracking.

### Business Rules
- Quote IDs follow pattern: PREFIX+MMDD-sequence (e.g., DTG0130-1)
- Quotes expire after 30 days
- Minimum order fee of $50 applies when quantity < 24
- Cannot delete quotes with status "Converted"

### Resource: quote_sessions

#### CREATE - New Quote Session
**Endpoint**: `POST /api/quote_sessions`

**Request Body Schema**:
```json
{
  "QuoteID": "DTG0130-1",
  "SessionID": "dtg_sess_1234567890",
  "CustomerEmail": "john@example.com",
  "CustomerName": "John Doe",
  "CompanyName": "ABC Company",
  "TotalQuantity": 48,
  "SubtotalAmount": 450.00,
  "LTMFeeTotal": 0,
  "TotalAmount": 450.00,
  "Status": "Open",
  "ExpiresAt": "2025-03-01T12:00:00",
  "Notes": "Rush order needed"
}
```

#### Full CRUD Operations
- `GET /api/quote_sessions` - List sessions
- `PUT /api/quote_sessions/:id` - Update session
- `DELETE /api/quote_sessions/:id` - Delete session

### Resource: quote_items

#### CREATE - Add Quote Item
**Endpoint**: `POST /api/quote_items`

**Request Body**:
```json
{
  "QuoteID": "DTG0130-1",
  "StyleNumber": "PC54",
  "Quantity": 48,
  "UnitPrice": 9.38,
  "LineTotal": 450.00
}
```

#### Full CRUD Operations
- `GET /api/quote_items` - List items
- `PUT /api/quote_items/:id` - Update item
- `DELETE /api/quote_items/:id` - Delete item

### Resource: quote_analytics

#### Track Quote Event
**Endpoint**: `POST /api/quote_analytics`

**Request Body**:
```json
{
  "SessionID": "session_123",
  "EventType": "View",
  "QuoteID": "DTG0130-1",
  "Timestamp": "2025-01-30T10:00:00"
}
```

## Quote System Implementation Examples

### Complete Cart Flow
```javascript
// 1. Create cart session
const cartResponse = await fetch(`${API_BASE}/cart-sessions`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    SessionID: `session_${Date.now()}`,
    IsActive: true
  })
});
const cart = await cartResponse.json();

// 2. Add item to cart
const itemResponse = await fetch(`${API_BASE}/cart-items`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    SessionID: cart.data.SessionID,
    StyleNumber: 'PC54',
    Color: 'Black',
    Method: 'DTG',
    CartStatus: 'Active'
  })
});
const item = await itemResponse.json();

// 3. Add sizes
const sizeResponse = await fetch(`${API_BASE}/cart-item-sizes`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    CartItemID: item.data.ID,
    Size: 'L',
    Quantity: 10,
    UnitPrice: 12.99
  })
});
```

### Quote Generation Pattern
```javascript
class QuoteService {
  generateQuoteID() {
    const date = new Date();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const sequence = Math.floor(Math.random() * 10000);
    return `DTG${month}${day}-${sequence}`;
  }

  async saveQuote(quoteData) {
    const quoteID = this.generateQuoteID();

    // Save session
    await fetch(`${API_BASE}/quote_sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        QuoteID: quoteID,
        ...quoteData.session
      })
    });

    // Save items
    for (const item of quoteData.items) {
      await fetch(`${API_BASE}/quote_items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          QuoteID: quoteID,
          ...item
        })
      });
    }

    return quoteID;
  }
}
```

---

**Base URL**: `https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api`
**Documentation Version**: 2.3.0
**Module**: Orders, Art Requests & Quotes APIs