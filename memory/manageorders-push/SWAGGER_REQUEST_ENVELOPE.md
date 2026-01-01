# ManageOrders PUSH API - Request Envelope Schema

**Last Updated:** 2025-11-14
**Purpose:** Complete Orders schema documentation for request wrapping pattern
**Status:** Production-ready

---

## 📋 Navigation

**Parent:** [SWAGGER_OVERVIEW.md](SWAGGER_OVERVIEW.md) - Complete schema documentation hub

**Related Schemas:**
- [Authentication (SignIn)](SWAGGER_AUTHENTICATION.md) - How to get JWT token
- [Order Payload (ExternalOrderJson)](SWAGGER_ORDER_PAYLOAD.md) - What goes inside the envelope
- [Responses](SWAGGER_RESPONSES.md) - Success and error response schemas

---

## 📦 Orders Schema

### Schema Structure

```typescript
Orders {
  order_json: {
    ExternalOrderJson: { ... }  // Complete order payload
  }
}
```

---

## 🎯 Critical Insight: Request Envelope

The `ExternalOrderJson` payload **must be wrapped** in an `order_json` object:

### Wrong vs Correct Structure

```javascript
// ❌ WRONG - Direct payload
{
  "ExtOrderID": "NWCA-3DT1108-1",
  "LinesOE": [...]
}

// ✅ CORRECT - Wrapped in order_json
{
  "order_json": {
    "ExternalOrderJson": {
      "ExtOrderID": "NWCA-3DT1108-1",
      "LinesOE": [...]
    }
  }
}
```

### Why This Matters

**The ManageOrders API expects a specific nesting structure:**
1. Top level: `order_json` object
2. Second level: `ExternalOrderJson` object
3. Third level: Your order data

**If the structure is incorrect:**
- API returns 400 Bad Request
- Error message: "Invalid request structure"
- Order is not created

---

## 📝 Example Request

### Complete Request Structure

```javascript
POST /api/orders/create
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "order_json": {
    "ExternalOrderJson": {
      "ExtOrderID": "NWCA-3DT1108-1",
      "ExtSource": "3-Day Tees",
      "id_Customer": 2791,
      "id_OrderType": 6,
      "date_OrderPlaced": "11/08/2025",
      "ContactNameFirst": "John",
      "ContactNameLast": "Smith",
      "ContactEmail": "john@example.com",
      "ContactPhone": "253-555-1234",
      "LinesOE": [
        {
          "PartNumber": "PC54",
          "ForProductDescription": "Port & Company Core Cotton Tee - 3-Day Rush",
          "ForProductColor": "Forest",
          "Size01": 4,
          "Size02": 8,
          "Size03": 8,
          "Size04": 2,
          "cur_UnitPriceUserEntered": 16.00,
          "Quantity": 22
        }
      ],
      "ShippingAddresses": [
        {
          "ExtShipID": "SHIP-1",
          "ShipAddress01": "123 Main St",
          "ShipCity": "Seattle",
          "ShipState": "WA",
          "ShipZip": "98101",
          "ShipCountry": "USA"
        }
      ]
    }
  }
}
```

---

## 🔧 Implementation Patterns

### Manual Wrapping

```javascript
// Build your order data
const orderData = {
  ExtOrderID: "NWCA-3DT1108-1",
  id_Customer: 2791,
  id_OrderType: 6,
  ContactNameFirst: "John",
  ContactNameLast: "Smith",
  ContactEmail: "john@example.com",
  LinesOE: [...]
  // ... other fields
};

// Wrap in correct structure
const request = {
  order_json: {
    ExternalOrderJson: orderData
  }
};

// Send request
const response = await fetch(apiUrl, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(request)
});
```

### Helper Function for Wrapping

```javascript
// Create reusable wrapper function
function wrapOrderRequest(externalOrderJson) {
  return {
    order_json: {
      ExternalOrderJson: externalOrderJson
    }
  };
}

// Use helper
const orderData = {
  ExtOrderID: "NWCA-3DT1108-1",
  // ... all order fields
};

const request = wrapOrderRequest(orderData);
await sendOrderRequest(request);
```

### Proxy Automatic Wrapping

**If using caspio-pricing-proxy, wrapping is automatic:**

```javascript
// You send simplified format
const simplifiedOrder = {
  orderNumber: "3DT1108-1",
  customer: {
    firstName: "John",
    lastName: "Smith",
    email: "john@example.com"
  },
  lineItems: [...]
};

// Proxy automatically wraps in Orders schema
// No manual wrapping needed
```

---

## ⚠️ Common Mistakes

### Mistake 1: Missing order_json Wrapper

```javascript
// ❌ WRONG - No order_json wrapper
const request = {
  ExternalOrderJson: {
    ExtOrderID: "NWCA-3DT1108-1",
    // ...
  }
};
```

**Error:** `400 Bad Request: Invalid request structure`

**Fix:** Add `order_json` wrapper:
```javascript
// ✅ CORRECT
const request = {
  order_json: {
    ExternalOrderJson: {
      ExtOrderID: "NWCA-3DT1108-1",
      // ...
    }
  }
};
```

### Mistake 2: Wrong Field Name

```javascript
// ❌ WRONG - orderJson instead of order_json
const request = {
  orderJson: {  // Wrong casing!
    ExternalOrderJson: { ... }
  }
};
```

**Error:** `400 Bad Request: Invalid request structure`

**Fix:** Use exact field name `order_json` (lowercase with underscore):
```javascript
// ✅ CORRECT
const request = {
  order_json: {
    ExternalOrderJson: { ... }
  }
};
```

### Mistake 3: Direct Payload

```javascript
// ❌ WRONG - Payload not wrapped at all
const request = {
  ExtOrderID: "NWCA-3DT1108-1",
  id_Customer: 2791,
  // ...
};
```

**Error:** `400 Bad Request: Missing required fields`

**Fix:** Wrap in both `order_json` and `ExternalOrderJson`:
```javascript
// ✅ CORRECT
const request = {
  order_json: {
    ExternalOrderJson: {
      ExtOrderID: "NWCA-3DT1108-1",
      id_Customer: 2791,
      // ...
    }
  }
};
```

---

## 🎯 Key Points

### Structure Requirements

- **Exact structure required:** `order_json` → `ExternalOrderJson` → payload
- **Field names case-sensitive:** Must match exactly
- **Nesting matters:** Incorrect nesting causes API rejection
- **Proxy handles this:** If using caspio-pricing-proxy, wrapping is automatic

### Field Name Rules

| Field | Case | Separator |
|-------|------|-----------|
| `order_json` | lowercase | underscore |
| `ExternalOrderJson` | PascalCase | none |

**Remember:** Both field names are **case-sensitive** and must match exactly!

---

## 🔍 Validation Checklist

Before sending a request, verify:

- [ ] Request wrapped in `order_json` object
- [ ] `ExternalOrderJson` nested inside `order_json`
- [ ] Field names use exact casing (`order_json`, not `orderJson`)
- [ ] All required ExternalOrderJson fields present
- [ ] Field names in payload match [SWAGGER_ORDER_PAYLOAD.md](SWAGGER_ORDER_PAYLOAD.md) schema
- [ ] Authorization header includes Bearer token

### Validation Code Example

```javascript
function validateOrderRequest(request) {
  const errors = [];

  // Check top-level structure
  if (!request.order_json) {
    errors.push('Missing order_json wrapper');
  }

  // Check second-level structure
  if (!request.order_json?.ExternalOrderJson) {
    errors.push('Missing ExternalOrderJson object');
  }

  // Check required fields in ExternalOrderJson
  const order = request.order_json?.ExternalOrderJson;
  if (!order?.ExtOrderID) errors.push('Missing ExtOrderID');
  if (!order?.id_Customer) errors.push('Missing id_Customer');
  if (!order?.id_OrderType) errors.push('Missing id_OrderType');

  if (errors.length > 0) {
    console.error('Request validation failed:', errors);
    return false;
  }

  return true;
}

// Use before sending
if (!validateOrderRequest(request)) {
  throw new Error('Invalid request structure');
}
```

---

## 📚 Related Documentation

- **Order Payload Schema:** [SWAGGER_ORDER_PAYLOAD.md](SWAGGER_ORDER_PAYLOAD.md) - Complete ExternalOrderJson structure
- **Response Schemas:** [SWAGGER_RESPONSES.md](SWAGGER_RESPONSES.md) - How to parse responses
- **Complete Examples:** [SWAGGER_EXAMPLES_VALIDATION.md](SWAGGER_EXAMPLES_VALIDATION.md) - Working request examples
- **Main Guide:** [SWAGGER_OVERVIEW.md](SWAGGER_OVERVIEW.md) - Complete schema documentation hub

---

## 🔗 Quick Reference

### Minimal Valid Request

```javascript
{
  "order_json": {
    "ExternalOrderJson": {
      "ExtOrderID": "NWCA-TEST-001",
      "id_Customer": 2791,
      "id_OrderType": 6,
      "ContactNameFirst": "Test",
      "ContactNameLast": "User",
      "ContactEmail": "test@example.com",
      "LinesOE": [
        {
          "PartNumber": "PC54",
          "ForProductColor": "Black",
          "Size03": 1,
          "cur_UnitPriceUserEntered": 10.00,
          "Quantity": 1
        }
      ]
    }
  }
}
```

### Request Template

```javascript
const request = {
  order_json: {
    ExternalOrderJson: {
      // Required fields
      ExtOrderID: "string",
      id_Customer: number,
      id_OrderType: number,
      ContactNameFirst: "string",
      ContactNameLast: "string",
      ContactEmail: "string",

      // Line items (required)
      LinesOE: [
        {
          PartNumber: "string",
          ForProductColor: "string",
          Size01-06: number,
          cur_UnitPriceUserEntered: number,
          Quantity: number
        }
      ],

      // Optional but recommended
      date_OrderPlaced: "MM/DD/YYYY",
      ShippingAddresses: [...],
      // ... other optional fields
    }
  }
};
```

---

**Documentation Type:** Swagger Request Envelope Schema
**Parent:** [SWAGGER_OVERVIEW.md](SWAGGER_OVERVIEW.md)
**Status:** Production-ready
