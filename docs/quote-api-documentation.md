# Quote API Documentation

**Northwest Custom Apparel - Quote Management System**  
**Version:** 1.0  
**Last Updated:** May 31, 2025  
**Base URL:** `https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api`

## Overview

The Quote API provides a comprehensive system for managing customer quotes across multiple embellishment types (DTG, Embroidery, Screen Print, DTF, etc.). The system is built on three core entities:

1. **Quote Sessions** - Customer quote containers
2. **Quote Items** - Individual products within quotes  
3. **Quote Analytics** - Usage tracking and customer behavior

## Authentication

All API requests are proxied through the NWCA server to the Caspio backend. No additional authentication headers are required for client-side requests.

## Base URL

```
https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api
```

---

## Quote Sessions

Quote Sessions represent a customer's quote container that can hold multiple quote items across different embellishment types.

### Data Model

```typescript
interface QuoteSession {
  PK_ID?: number;           // Auto-generated primary key
  QuoteID: string;          // Unique quote identifier (e.g., "Q_20250531123456")
  SessionID: string;        // Browser session identifier
  CustomerEmail?: string;   // Customer email address
  CustomerName?: string;    // Customer full name
  CompanyName?: string;     // Customer company name
  Status: string;          // "Active", "Completed", "Expired"
  Notes?: string;          // Additional notes about the quote
  CreatedAt?: string;      // ISO timestamp of creation
  UpdatedAt?: string;      // ISO timestamp of last update
}
```

### Endpoints

#### Create Quote Session

```http
POST /quote_sessions
Content-Type: application/json

{
  "QuoteID": "Q_20250531123456",
  "SessionID": "sess_abc123def456",
  "CustomerEmail": "customer@example.com",
  "CustomerName": "John Smith",
  "CompanyName": "Smith Industries",
  "Status": "Active",
  "Notes": "Corporate event quote - 100+ employees"
}
```

**Response (201 Created):**
```json
{
  "PK_ID": 123,
  "QuoteID": "Q_20250531123456",
  "SessionID": "sess_abc123def456",
  "CustomerEmail": "customer@example.com",
  "CustomerName": "John Smith",
  "CompanyName": "Smith Industries",
  "Status": "Active",
  "Notes": "Corporate event quote - 100+ employees",
  "CreatedAt": "2025-05-31T14:30:00Z"
}
```

#### Get All Quote Sessions

```http
GET /quote_sessions
```

**Response (200 OK):**
```json
[
  {
    "PK_ID": 123,
    "QuoteID": "Q_20250531123456",
    "SessionID": "sess_abc123def456",
    "CustomerName": "John Smith",
    "Status": "Active",
    "CreatedAt": "2025-05-31T14:30:00Z"
  }
]
```

#### Get Quote Session by ID

```http
GET /quote_sessions/{id}
```

#### Get Quote Sessions by QuoteID

```http
GET /quote_sessions?quoteID={quoteID}
```

**Example:**
```http
GET /quote_sessions?quoteID=Q_20250531123456
```

#### Update Quote Session

```http
PUT /quote_sessions/{id}
Content-Type: application/json

{
  "Status": "Completed",
  "CustomerEmail": "newemail@example.com"
}
```

#### Delete Quote Session

```http
DELETE /quote_sessions/{id}
```

---

## Quote Items

Quote Items represent individual products within a quote, supporting all embellishment types.

### Data Model

```typescript
interface QuoteItem {
  PK_ID?: number;              // Auto-generated primary key
  QuoteID: string;             // Reference to parent quote
  LineNumber: number;          // Line item number (1, 2, 3, etc.)
  StyleNumber: string;         // Product style (e.g., "PC61", "PC90H")
  ProductName: string;         // Human-readable product name
  Color: string;               // Product color name
  ColorCode: string;           // Standardized color code
  EmbellishmentType: string;   // "dtg", "embroidery", "screen-print", "dtf", etc.
  PrintLocation: string;       // Location code ("FF", "FB", "LC", etc.)
  PrintLocationName: string;   // Human-readable location name
  Quantity: number;            // Total quantity for this line item
  HasLTM: string;             // "Yes" or "No" (Less Than Minimum fee applies)
  BaseUnitPrice: number;       // Base price per unit before fees
  LTMPerUnit: number;         // LTM fee distributed per unit (0 if no LTM)
  FinalUnitPrice: number;     // Final price per unit (Base + LTM)
  LineTotal: number;          // Total for this line (FinalUnitPrice * Quantity)
  SizeBreakdown: string;      // JSON string of size distribution
  PricingTier: string;        // Pricing tier ("24-47", "48-71", "72+")
  ImageURL?: string;          // Product image URL
  AddedAt: string;           // ISO timestamp when added
  ItemID?: number;           // Additional identifier
}
```

### Supported Embellishment Types

- `"dtg"` - Direct-to-Garment printing
- `"embroidery"` - Traditional embroidery
- `"cap-embroidery"` - Cap/hat embroidery
- `"screen-print"` - Screen printing
- `"dtf"` - Direct-to-Film printing
- `"laser-engraving"` - Laser engraving (future)
- `"stickers"` - Custom stickers (future)

### Print Location Codes

| Code | Description |
|------|-------------|
| `FF` | Full Front |
| `FB` | Full Back |
| `LC` | Left Chest |
| `RC` | Right Chest |
| `JF` | Jumbo Front |
| `JB` | Jumbo Back |
| `LS` | Left Sleeve |
| `RS` | Right Sleeve |

### Endpoints

#### Create Quote Item

```http
POST /quote_items
Content-Type: application/json

{
  "QuoteID": "Q_20250531123456",
  "LineNumber": 1,
  "StyleNumber": "PC61",
  "ProductName": "Port & Company Essential T-Shirt",
  "Color": "Navy",
  "ColorCode": "NAVY",
  "EmbellishmentType": "dtg",
  "PrintLocation": "FF",
  "PrintLocationName": "Full Front",
  "Quantity": 48,
  "HasLTM": "No",
  "BaseUnitPrice": 15.99,
  "LTMPerUnit": 0,
  "FinalUnitPrice": 15.99,
  "LineTotal": 767.52,
  "SizeBreakdown": "{\"S\":12,\"M\":12,\"L\":12,\"XL\":12}",
  "PricingTier": "48-71",
  "ImageURL": "https://example.com/pc61-navy.jpg",
  "AddedAt": "2025-05-31T14:35:00Z"
}
```

**Response (201 Created):**
```json
{
  "PK_ID": 456,
  "QuoteID": "Q_20250531123456",
  "LineNumber": 1,
  "StyleNumber": "PC61",
  "ProductName": "Port & Company Essential T-Shirt",
  "Color": "Navy",
  "ColorCode": "NAVY",
  "EmbellishmentType": "dtg",
  "PrintLocation": "FF",
  "PrintLocationName": "Full Front",
  "Quantity": 48,
  "HasLTM": "No",
  "BaseUnitPrice": 15.99,
  "LTMPerUnit": 0,
  "FinalUnitPrice": 15.99,
  "LineTotal": 767.52,
  "SizeBreakdown": "{\"S\":12,\"M\":12,\"L\":12,\"XL\":12}",
  "PricingTier": "48-71",
  "ImageURL": "https://example.com/pc61-navy.jpg",
  "AddedAt": "2025-05-31T14:35:00Z",
  "ItemID": 789
}
```

#### Get All Quote Items

```http
GET /quote_items
```

#### Get Quote Items by QuoteID

```http
GET /quote_items?quoteID={quoteID}
```

**Example:**
```http
GET /quote_items?quoteID=Q_20250531123456
```

#### Update Quote Item

```http
PUT /quote_items/{id}
Content-Type: application/json

{
  "Quantity": 60,
  "LineTotal": 959.40
}
```

#### Delete Quote Item

```http
DELETE /quote_items/{id}
```

---

## Quote Analytics

Quote Analytics track customer behavior and system usage for reporting and optimization.

### Data Model

```typescript
interface QuoteAnalytics {
  PK_ID?: number;           // Auto-generated primary key
  SessionID: string;        // Browser session identifier
  QuoteID?: string;         // Associated quote ID (if applicable)
  EventType: string;        // Type of event being tracked
  StyleNumber?: string;     // Product style involved
  Color?: string;           // Product color involved
  PrintLocation?: string;   // Print location involved
  Quantity?: number;        // Quantity involved
  PriceShown?: number;      // Price displayed to customer
  Timestamp?: string;       // ISO timestamp of event
  UserAgent?: string;       // Browser user agent
  IPAddress?: string;       // Customer IP address
}
```

### Event Types

| Event Type | Description |
|------------|-------------|
| `quote_started` | Customer initiated a new quote |
| `item_added` | Item added to quote |
| `item_removed` | Item removed from quote |
| `pricing_calculated` | Pricing calculation performed |
| `quote_saved` | Quote saved to database |
| `quote_loaded` | Existing quote loaded |
| `quote_exported` | Quote exported as PDF |
| `quote_emailed` | Quote emailed to customer |
| `quote_completed` | Quote marked as completed |
| `page_view` | Pricing page viewed |
| `api_error` | API error occurred |

### Endpoints

#### Create Analytics Event

```http
POST /quote_analytics
Content-Type: application/json

{
  "SessionID": "sess_abc123def456",
  "QuoteID": "Q_20250531123456",
  "EventType": "item_added",
  "StyleNumber": "PC61",
  "Color": "Navy",
  "PrintLocation": "FF",
  "Quantity": 48,
  "PriceShown": 15.99
}
```

**Response (201 Created):**
```json
{
  "PK_ID": 789,
  "SessionID": "sess_abc123def456",
  "QuoteID": "Q_20250531123456",
  "EventType": "item_added",
  "StyleNumber": "PC61",
  "Color": "Navy",
  "PrintLocation": "FF",
  "Quantity": 48,
  "PriceShown": 15.99,
  "Timestamp": "2025-05-31T14:35:30Z"
}
```

#### Get Analytics Events

```http
GET /quote_analytics
```

#### Get Analytics by Session

```http
GET /quote_analytics?sessionID={sessionID}
```

#### Get Analytics by Quote

```http
GET /quote_analytics?quoteID={quoteID}
```

---

## Complete Workflow Example

### 1. Create a New Quote Session

```javascript
const quoteSession = {
  QuoteID: 'Q_' + new Date().toISOString().replace(/[-:T]/g, '').substr(0, 15),
  SessionID: 'sess_' + Math.random().toString(36).substr(2, 9),
  CustomerEmail: 'customer@example.com',
  CustomerName: 'John Smith',
  CompanyName: 'Smith Industries',
  Status: 'Active',
  Notes: 'Multi-item corporate quote'
};

const sessionResponse = await fetch('/api/quote_sessions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(quoteSession)
});
```

### 2. Add Items to Quote

```javascript
// DTG Item
const dtgItem = {
  QuoteID: quoteSession.QuoteID,
  LineNumber: 1,
  StyleNumber: 'PC61',
  ProductName: 'Essential T-Shirt',
  Color: 'Navy',
  ColorCode: 'NAVY',
  EmbellishmentType: 'dtg',
  PrintLocation: 'FF',
  PrintLocationName: 'Full Front',
  Quantity: 48,
  HasLTM: 'No',
  BaseUnitPrice: 15.99,
  LTMPerUnit: 0,
  FinalUnitPrice: 15.99,
  LineTotal: 767.52,
  SizeBreakdown: '{"S":12,"M":12,"L":12,"XL":12}',
  PricingTier: '48-71',
  AddedAt: new Date().toISOString()
};

// Embroidery Item
const embroideryItem = {
  QuoteID: quoteSession.QuoteID,
  LineNumber: 2,
  StyleNumber: 'PC90H',
  ProductName: 'Pullover Hoodie',
  Color: 'Black',
  ColorCode: 'BLACK',
  EmbellishmentType: 'embroidery',
  PrintLocation: 'LC',
  PrintLocationName: 'Left Chest',
  Quantity: 24,
  HasLTM: 'Yes',
  BaseUnitPrice: 24.99,
  LTMPerUnit: 2.08,
  FinalUnitPrice: 27.07,
  LineTotal: 649.68,
  SizeBreakdown: '{"S":6,"M":6,"L":6,"XL":6}',
  PricingTier: '24-47',
  AddedAt: new Date().toISOString()
};

// Add both items
await Promise.all([
  fetch('/api/quote_items', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dtgItem)
  }),
  fetch('/api/quote_items', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(embroideryItem)
  })
]);
```

### 3. Track Analytics

```javascript
// Log quote completion
await fetch('/api/quote_analytics', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    SessionID: quoteSession.SessionID,
    QuoteID: quoteSession.QuoteID,
    EventType: 'quote_completed',
    Quantity: 72, // Total items
    PriceShown: 1417.20 // Total value
  })
});
```

### 4. Retrieve Complete Quote

```javascript
// Get quote session
const session = await fetch(`/api/quote_sessions?quoteID=${quoteSession.QuoteID}`)
  .then(res => res.json());

// Get quote items
const items = await fetch(`/api/quote_items?quoteID=${quoteSession.QuoteID}`)
  .then(res => res.json());

// Get analytics
const analytics = await fetch(`/api/quote_analytics?quoteID=${quoteSession.QuoteID}`)
  .then(res => res.json());

console.log('Complete Quote:', {
  session: session[0],
  items: items,
  analytics: analytics
});
```

---

## Error Handling

All endpoints return standard HTTP status codes:

- `200 OK` - Successful GET request
- `201 Created` - Successful POST request
- `400 Bad Request` - Invalid request data
- `404 Not Found` - Resource not found
- `500 Internal Server Error` - Server error

**Error Response Format:**
```json
{
  "error": "Error description",
  "message": "Detailed error message",
  "details": "Additional error details"
}
```

---

## Rate Limiting

No rate limiting is currently enforced, but best practices recommend:
- Maximum 100 requests per minute per session
- Batch operations when possible
- Implement client-side caching for repeated requests

---

## Data Validation

### Required Fields

**Quote Sessions:**
- `QuoteID` (string, unique)
- `SessionID` (string)
- `Status` (string: "Active", "Completed", "Expired")

**Quote Items:**
- `QuoteID` (string, must exist in quote_sessions)
- `LineNumber` (integer > 0)
- `StyleNumber` (string)
- `EmbellishmentType` (string, valid embellishment type)
- `Quantity` (integer > 0)
- `HasLTM` (string: "Yes" or "No")

### Field Constraints

- `QuoteID`: Must follow format `Q_YYYYMMDDHHMMSS`
- `HasLTM`: Must be exactly "Yes" or "No" (case-sensitive)
- `SizeBreakdown`: Must be valid JSON string
- `PriceShown`, `BaseUnitPrice`, `FinalUnitPrice`: Must be positive numbers
- `Quantity`: Must be positive integer

---

## Integration Examples

### React Hook for Quote Management

```javascript
import { useState, useEffect } from 'react';

export const useQuoteManager = () => {
  const [currentQuote, setCurrentQuote] = useState(null);
  const [loading, setLoading] = useState(false);

  const createQuote = async (customerInfo) => {
    setLoading(true);
    try {
      const quoteSession = {
        QuoteID: 'Q_' + new Date().toISOString().replace(/[-:T]/g, '').substr(0, 15),
        SessionID: 'sess_' + Math.random().toString(36).substr(2, 9),
        ...customerInfo,
        Status: 'Active'
      };

      const response = await fetch('/api/quote_sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(quoteSession)
      });

      const savedQuote = await response.json();
      setCurrentQuote(savedQuote);
      return savedQuote;
    } finally {
      setLoading(false);
    }
  };

  const addItem = async (itemData) => {
    if (!currentQuote) throw new Error('No active quote');

    const response = await fetch('/api/quote_items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...itemData,
        QuoteID: currentQuote.QuoteID,
        AddedAt: new Date().toISOString()
      })
    });

    return response.json();
  };

  const loadQuote = async (quoteID) => {
    setLoading(true);
    try {
      const [sessionResponse, itemsResponse] = await Promise.all([
        fetch(`/api/quote_sessions?quoteID=${quoteID}`),
        fetch(`/api/quote_items?quoteID=${quoteID}`)
      ]);

      const [sessions, items] = await Promise.all([
        sessionResponse.json(),
        itemsResponse.json()
      ]);

      const quote = {
        session: sessions[0],
        items: items
      };

      setCurrentQuote(quote);
      return quote;
    } finally {
      setLoading(false);
    }
  };

  return {
    currentQuote,
    loading,
    createQuote,
    addItem,
    loadQuote
  };
};
```

### Vue.js Composition API

```javascript
import { ref, reactive } from 'vue';

export function useQuoteSystem() {
  const currentQuote = ref(null);
  const loading = ref(false);

  const quoteManager = reactive({
    async createSession(customerData) {
      loading.value = true;
      try {
        const response = await fetch('/api/quote_sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            QuoteID: 'Q_' + Date.now(),
            SessionID: 'sess_' + Math.random().toString(36).substr(2, 9),
            Status: 'Active',
            ...customerData
          })
        });
        
        currentQuote.value = await response.json();
        return currentQuote.value;
      } finally {
        loading.value = false;
      }
    },

    async addQuoteItem(itemData) {
      const response = await fetch('/api/quote_items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...itemData,
          QuoteID: currentQuote.value.QuoteID,
          AddedAt: new Date().toISOString()
        })
      });
      
      return response.json();
    }
  });

  return {
    currentQuote,
    loading,
    ...quoteManager
  };
}
```

---

## Testing

### Example Test Data

```javascript
// Test Quote Session
const testQuoteSession = {
  QuoteID: "Q_TEST_20250531143000",
  SessionID: "sess_test_12345",
  CustomerEmail: "test@example.com",
  CustomerName: "Test Customer",
  CompanyName: "Test Company",
  Status: "Active",
  Notes: "API Testing Quote"
};

// Test Quote Items
const testQuoteItems = [
  {
    QuoteID: "Q_TEST_20250531143000",
    LineNumber: 1,
    StyleNumber: "PC61",
    ProductName: "Test T-Shirt",
    Color: "Navy",
    ColorCode: "NAVY",
    EmbellishmentType: "dtg",
    PrintLocation: "FF",
    PrintLocationName: "Full Front",
    Quantity: 24,
    HasLTM: "Yes",
    BaseUnitPrice: 15.99,
    LTMPerUnit: 2.08,
    FinalUnitPrice: 18.07,
    LineTotal: 433.68,
    SizeBreakdown: '{"S":6,"M":6,"L":6,"XL":6}',
    PricingTier: "24-47",
    AddedAt: "2025-05-31T14:30:00Z"
  }
];
```

### API Testing Script

```bash
#!/bin/bash
BASE_URL="https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api"

# Test Quote Session Creation
curl -X POST "$BASE_URL/quote_sessions" \
  -H "Content-Type: application/json" \
  -d '{
    "QuoteID": "Q_TEST_'$(date +%s)'",
    "SessionID": "sess_test_'$(date +%s)'",
    "CustomerEmail": "test@example.com",
    "Status": "Active"
  }'

# Test Quote Items Retrieval
curl -X GET "$BASE_URL/quote_items"

# Test Analytics Creation
curl -X POST "$BASE_URL/quote_analytics" \
  -H "Content-Type: application/json" \
  -d '{
    "SessionID": "sess_test_123",
    "EventType": "api_test",
    "Timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"
  }'
```

---

## Changelog

### Version 1.0 (May 31, 2025)
- Initial API documentation
- Core quote session, item, and analytics endpoints
- Support for multiple embellishment types
- Complete workflow examples
- Integration guides for React and Vue.js

---

## Support

For technical support or questions about this API:

- **GitHub Issues**: [Report issues here]
- **Documentation Updates**: [Submit documentation improvements]
- **API Questions**: Contact the development team

---

**End of Documentation**