# ManageOrders PUSH API - Examples & Validation

**Last Updated:** 2025-11-14
**Purpose:** Complete working examples and validation strategies for PUSH API integration
**Status:** Production-ready

---

## 📋 Navigation

**Parent:** [SWAGGER_OVERVIEW.md](SWAGGER_OVERVIEW.md) - Complete schema documentation hub

**Related Schemas:**
- [Authentication (SignIn)](SWAGGER_AUTHENTICATION.md) - How to get JWT token
- [Request Envelope (Orders)](SWAGGER_REQUEST_ENVELOPE.md) - How to wrap requests
- [Order Payload (ExternalOrderJson)](SWAGGER_ORDER_PAYLOAD.md) - What goes in requests
- [Response Schemas](SWAGGER_RESPONSES.md) - Success and error responses

---

## 🎯 Complete 3-Day Tees Example

### Scenario

Customer orders 22 PC54 shirts (4 S, 8 M, 8 L, 2 XL) + 3 oversize (2 2XL, 1 3XL) in Forest Green with DTG left chest logo, 3-day rush service.

### Step 1: Authentication

```javascript
// SignIn schema
const authResponse = await fetch(
  'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/manageorders/auth/signin',
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'api-user',
      password: 'secure-password'
    })
  }
);

const { token } = await authResponse.json();
```

### Step 2: Create Order Request

```javascript
// Orders schema wrapping ExternalOrderJson schema
const orderRequest = {
  order_json: {
    ExternalOrderJson: {
      // Order Identification
      ExtOrderID: "3DT1108-1",           // Your order number
      ExtSource: "3-Day Tees",           // Source system

      // Order Type & Customer
      id_OrderType: 6,                   // 6 = Web Order
      id_Customer: 2791,                 // All webstore orders
      date_OrderPlaced: "11/08/2025",

      // Contact Information
      ContactNameFirst: "John",
      ContactNameLast: "Smith",
      ContactEmail: "john@example.com",
      ContactPhone: "253-555-1234",

      // Customer PO & Service Rep
      CustomerPurchaseOrder: "3-Day Rush - DTG Left Chest",
      CustomerServiceRep: "3-Day Tees System",

      // Financial Totals
      cur_Shipping: 15.00,
      TaxTotal: 52.90,
      TotalDiscounts: 0,

      // Line Items - CRITICAL PATTERN
      LinesOE: [
        // Standard sizes (S, M, L, XL) - Use PC54
        {
          PartNumber: "PC54",                    // ✅ BASE style (not PC54_2X)
          ForProductDescription: "Port & Company Core Cotton Tee - 3-Day Rush",
          ForProductColor: "Forest",             // ✅ CATALOG_COLOR format
          Size01: 4,                             // S = 4 pieces
          Size02: 8,                             // M = 8 pieces
          Size03: 8,                             // L = 8 pieces
          Size04: 2,                             // XL = 2 pieces
          Size05: 0,                             // No 2XL in this item
          Size06: 0,                             // No 3XL in this item
          cur_UnitPriceUserEntered: 16.00,       // Standard size pricing
          Quantity: 22,                          // Total: 4+8+8+2 = 22
          WorkOrderNotes: "DTG - Left Chest - 3-Day Rush Service (+25%)"
        },

        // Oversizes (2XL, 3XL) - STILL use PC54 (not PC54_2X!)
        {
          PartNumber: "PC54",                    // ✅ STILL BASE STYLE
          ForProductDescription: "Port & Company Core Cotton Tee - 3-Day Rush",
          ForProductColor: "Forest",
          Size01: 0,                             // No S in this item
          Size02: 0,                             // No M in this item
          Size03: 0,                             // No L in this item
          Size04: 0,                             // No XL in this item
          Size05: 2,                             // 2XL = 2 pieces
          Size06: 1,                             // 3XL = 1 piece
          cur_UnitPriceUserEntered: 18.00,       // Upcharged pricing (+$2)
          Quantity: 3,                           // Total: 2+1 = 3
          WorkOrderNotes: "DTG - Left Chest - 3-Day Rush Service (+25%) | 2XL/3XL Upcharge"
        }
      ],

      // Design Block (artwork upload)
      Designs: [
        {
          ExtDesignID: "upload_abc123.ai",       // File upload reference
          DesignName: "Customer Logo - Left Chest",
          id_DesignType: 1,                      // 1 = Customer supplied
          ForProductColor: "Forest",             // Design is for this color

          Locations: [
            {
              Location: "Left Chest",
              TotalColors: 1,                    // 1-color DTG
              ImageURL: "https://3daytees.com/uploads/abc123.ai",
              Notes: "3x3 inches, DTG print"
            }
          ]
        }
      ],

      // Shipping Address
      ShippingAddresses: [
        {
          ExtShipID: "SHIP-1",
          ShipCompany: "ABC Company",
          ShipAddress01: "123 Main St",
          ShipCity: "Seattle",
          ShipState: "WA",
          ShipZip: "98101",
          ShipCountry: "USA",
          ShipMethod: "UPS Ground"
        }
      ],

      // Order Notes
      Notes: [
        {
          Note: "3-DAY RUSH SERVICE - Ship within 72 hours from artwork approval",
          Type: "Order Notes"
        }
      ]
    }
  }
};
```

### Step 3: Send Order

```javascript
const response = await fetch(
  'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/manageorders/orders/create',
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(orderRequest)
  }
);
```

### Step 4: Handle Response

```javascript
const data = await response.json();

if (response.ok) {
  // OrderPushResult schema
  console.log('✓ Order created:', data.result.orderNumber);
  // Output: "✓ Order created: NWCA-12345"

  // Show confirmation to customer
  showConfirmation({
    orderNumber: data.result.orderNumber,
    extOrderID: "3DT1108-1",
    total: 552.90,
    estimatedShip: "11/11/2025"  // 3 days from order
  });

} else {
  // Error schema (401/403/500)
  console.error('Order failed:', data.result);
  showError(`Order creation failed: ${data.result}`);
}
```

### Key Insights from This Example

1. **Multi-SKU Pattern:**
   - Two line items, BOTH use `PartNumber: "PC54"`
   - ShopWorks routes to PC54/PC54_2X/PC54_3X based on Size fields
   - Never send PC54_2X or PC54_3X as part number

2. **Size Distribution:**
   - Standard sizes in first item (Size01-04)
   - Oversizes in second item (Size05-06)
   - Quantity field = sum of size fields

3. **CATALOG_COLOR:**
   - Use "Forest" not "Forest Green"
   - Must match exact Sanmar catalog color
   - Critical for inventory matching

4. **Request Envelope:**
   - Entire payload wrapped in `order_json.ExternalOrderJson`
   - This wrapping is required by Orders schema

5. **Response Parsing:**
   - Success data in `result.orderNumber`
   - Error messages in `result` string

---

## 🔄 Transformation Comparison

### Simplified Format vs Swagger Format

Understanding how the caspio-pricing-proxy transforms your simplified requests into Swagger format.

#### Order Number Transformation

| You Send | Proxy Transforms | Swagger Receives |
|----------|------------------|------------------|
| `orderNumber: "3DT1108-1"` | Adds NWCA prefix | `ExtOrderID: "NWCA-3DT1108-1"` |
| `orderNumber: "TEST-123"` | Adds TEST indicator | `ExtOrderID: "NWCA-TEST-123"` |

#### Customer Information Transformation

| You Send (Simplified) | Proxy Transforms | Swagger Field |
|-----------------------|------------------|---------------|
| `customer.firstName: "John"` | Direct mapping | `ContactNameFirst: "John"` |
| `customer.lastName: "Smith"` | Direct mapping | `ContactNameLast: "Smith"` |
| `customer.email: "john@example.com"` | Direct mapping | `ContactEmail: "john@example.com"` |
| `customer.phone: "253-555-1234"` | Direct mapping | `ContactPhone: "253-555-1234"` |

#### Line Items Transformation

| You Send (Simplified) | Proxy Transforms | Swagger Field |
|-----------------------|------------------|---------------|
| `lineItems: [{ partNumber: "PC54" }]` | Wraps in array | `LinesOE: [{ PartNumber: "PC54" }]` |
| `size: "S"` | Maps to size field | `Size01: 1` (or quantity) |
| `size: "M"` | Maps to size field | `Size02: 1` |
| `size: "L"` | Maps to size field | `Size03: 1` |
| `size: "XL"` | Maps to size field | `Size04: 1` |
| `size: "2XL"` | Maps to size field | `Size05: 1` |
| `size: "3XL"` | Maps to size field | `Size06: 1` |
| `color: "Forest Green"` | Direct mapping | `ForProductColor: "Forest Green"` |
| `description: "T-Shirt"` | Direct mapping | `ForProductDescription: "T-Shirt"` |

#### Shipping Address Transformation

| You Send (Simplified) | Proxy Transforms | Swagger Field |
|-----------------------|------------------|---------------|
| `shipping.address: "123 Main St"` | Direct mapping | `ShipAddress01: "123 Main St"` |
| `shipping.city: "Seattle"` | Direct mapping | `ShipCity: "Seattle"` |
| `shipping.state: "WA"` | Direct mapping | `ShipState: "WA"` |
| `shipping.zip: "98101"` | Direct mapping | `ShipZip: "98101"` |
| `shipping.country: "USA"` | Direct mapping | `ShipCountry: "USA"` |

#### Complete Transformation Example

**You Send (Simplified):**
```javascript
{
  orderNumber: "3DT1108-1",
  customer: {
    firstName: "John",
    lastName: "Smith",
    email: "john@example.com"
  },
  lineItems: [
    {
      partNumber: "PC54",
      color: "Forest",
      size: "L",
      quantity: 8,
      price: 16.00
    }
  ],
  shipping: {
    address: "123 Main St",
    city: "Seattle",
    state: "WA",
    zip: "98101"
  }
}
```

**Proxy Transforms To (Swagger):**
```javascript
{
  order_json: {
    ExternalOrderJson: {
      ExtOrderID: "NWCA-3DT1108-1",
      id_Customer: 2791,
      id_OrderType: 6,
      ContactNameFirst: "John",
      ContactNameLast: "Smith",
      ContactEmail: "john@example.com",
      LinesOE: [
        {
          PartNumber: "PC54",
          ForProductColor: "Forest",
          Size03: 8,              // L mapped to Size03
          cur_UnitPriceUserEntered: 16.00,
          Quantity: 8
        }
      ],
      ShippingAddresses: [
        {
          ExtShipID: "SHIP-1",
          ShipAddress01: "123 Main St",
          ShipCity: "Seattle",
          ShipState: "WA",
          ShipZip: "98101",
          ShipCountry: "USA"
        }
      ]
    }
  }
}
```

### Size Translation Table

**Complete size mapping reference:**

| Your Size String | Swagger Field | Field Value | Notes |
|------------------|---------------|-------------|-------|
| `"XS"` | `Size06` | quantity | Catch-all field |
| `"S"` | `Size01` | quantity | Standard |
| `"M"` | `Size02` | quantity | Standard |
| `"L"` | `Size03` | quantity | Standard |
| `"XL"` | `Size04` | quantity | Standard |
| `"2XL"` or `"2X"` | `Size05` | quantity | Oversize |
| `"3XL"` or `"3X"` | `Size06` | quantity | Oversize |
| `"4XL"` or `"4X"` | `Size06` | quantity | Catch-all |
| `"5XL"` or `"5X"` | `Size06` | quantity | Catch-all |
| `"6XL"` or `"6X"` | `Size06` | quantity | Catch-all |
| `"LT"` | `Size06` | quantity | Tall |
| `"XLT"` | `Size06` | quantity | Tall |
| `"2XLT"` | `Size05` | quantity | Tall oversize |
| `"3XLT"` | `Size06` | quantity | Tall oversize |

---

## 🔍 Validation & Debugging

### Pre-Flight Schema Validation Checklist

Before sending an order, verify against Swagger schemas:

#### Request Structure Validation

- [ ] **Authentication header present?**
  ```javascript
  headers: { 'Authorization': `Bearer ${token}` }
  ```

- [ ] **Request wrapped correctly?**
  ```javascript
  { order_json: { ExternalOrderJson: { ... } } }
  ```

- [ ] **Required fields present?**
  - `ExtOrderID` (string)
  - `id_Customer` (number)
  - `id_OrderType` (number)
  - `ContactNameFirst` (string)
  - `ContactNameLast` (string)
  - `ContactEmail` (string)

- [ ] **Field names match exactly?** (case-sensitive)

- [ ] **Date format correct?** (MM/DD/YYYY)

#### Line Items Validation

- [ ] **Using BASE part number?** (PC54, not PC54_2X)

- [ ] **CATALOG_COLOR format?** (Not display name)

- [ ] **Size fields used correctly?**
  - Standard: Size01-04
  - Oversize: Size05-06

- [ ] **Quantity matches size totals?**
  ```javascript
  Quantity === Size01 + Size02 + Size03 + Size04 + Size05 + Size06
  ```

- [ ] **Separate line items for different size groups?**
  - Standard sizes (S-XL) in one item
  - Oversizes (2XL-3XL) in separate item

#### Shipping Address Validation

- [ ] **ShippingAddresses is array?** (Even if one address)

- [ ] **Required address fields present?**
  - `ShipAddress01`
  - `ShipCity`
  - `ShipState`
  - `ShipZip`

### Common Validation Errors

#### Error: "Invalid field name"

**Cause:** Field name doesn't match Swagger schema exactly

**Examples:**
```javascript
// ❌ WRONG
ExtOrderId: "..."        // Wrong case (lowercase 'd')
extOrderID: "..."        // Wrong case (lowercase 'ext')
ContactEmail: "..."      // Missing 'Contact' prefix

// ✅ CORRECT
ExtOrderID: "..."
ContactEmail: "..."
```

#### Error: "Missing required field"

**Cause:** Required field not included in request

**Required Fields:**
- `ExtOrderID`
- `id_Customer`
- `id_OrderType`
- `ContactNameFirst`
- `ContactNameLast`
- `ContactEmail`

**Solution:** Verify all required fields present before sending

#### Error: "Invalid date format"

**Cause:** Date not in MM/DD/YYYY format

**Examples:**
```javascript
// ❌ WRONG
date_OrderPlaced: "2025-11-08"           // ISO format
date_OrderPlaced: "11-08-2025"           // Dashes
date_OrderPlaced: "November 8, 2025"     // Written out

// ✅ CORRECT
date_OrderPlaced: "11/08/2025"           // MM/DD/YYYY
```

#### Error: "Invalid part number"

**Cause:** Using size suffix instead of base style

**Examples:**
```javascript
// ❌ WRONG - 3-Day Tees Multi-SKU
LinesOE: [
  { PartNumber: "PC54" },      // Standard sizes - OK
  { PartNumber: "PC54_2X" }    // WRONG! Should still be "PC54"
]

// ✅ CORRECT
LinesOE: [
  { PartNumber: "PC54", Size01: 4, Size02: 8 },    // Standards
  { PartNumber: "PC54", Size05: 2, Size06: 1 }     // Oversizes
]
```

### Debug Strategies Using Schemas

#### Strategy 1: Compare Request to Schema

**Before sending request:**
1. Print request JSON
2. Compare field names to ExternalOrderJson schema
3. Verify nesting structure matches Orders schema
4. Check data types (string vs number)

```javascript
console.log('Request structure:');
console.log(JSON.stringify(orderRequest, null, 2));

// Manually verify against schema:
// - order_json wrapper? ✓
// - ExternalOrderJson nested inside? ✓
// - All field names exact match? ✓
// - Required fields present? ✓
```

#### Strategy 2: Validate Response Format

**After receiving response:**
1. Check status code
2. Parse response JSON
3. Match to appropriate schema (OrderPushResult or Error)

```javascript
const response = await fetch(url, options);
const data = await response.json();

console.log('Response status:', response.status);
console.log('Response data:', data);

// Validate against schema:
if (response.status === 200) {
  // Should match OrderPushResult schema
  console.assert('result' in data, 'Missing result object');
  console.assert('orderNumber' in data.result, 'Missing orderNumber');
} else {
  // Should match Error schema
  console.assert('result' in data, 'Missing result field');
  console.assert(typeof data.result === 'string', 'Result should be string');
}
```

#### Strategy 3: Field-by-Field Validation

**Create validation function:**
```javascript
function validateExternalOrderJson(order) {
  const errors = [];

  // Required fields
  if (!order.ExtOrderID) errors.push('Missing ExtOrderID');
  if (!order.id_Customer) errors.push('Missing id_Customer');
  if (!order.id_OrderType) errors.push('Missing id_OrderType');
  if (!order.ContactNameFirst) errors.push('Missing ContactNameFirst');
  if (!order.ContactNameLast) errors.push('Missing ContactNameLast');
  if (!order.ContactEmail) errors.push('Missing ContactEmail');

  // Field types
  if (typeof order.id_Customer !== 'number') {
    errors.push('id_Customer must be number');
  }
  if (typeof order.id_OrderType !== 'number') {
    errors.push('id_OrderType must be number');
  }

  // Date format
  if (order.date_OrderPlaced) {
    const datePattern = /^\d{2}\/\d{2}\/\d{4}$/;
    if (!datePattern.test(order.date_OrderPlaced)) {
      errors.push('date_OrderPlaced must be MM/DD/YYYY format');
    }
  }

  // Line items
  if (!order.LinesOE || !Array.isArray(order.LinesOE)) {
    errors.push('LinesOE must be array');
  } else {
    order.LinesOE.forEach((item, index) => {
      if (!item.PartNumber) {
        errors.push(`Line item ${index}: Missing PartNumber`);
      }
      // Check for size suffix error
      if (item.PartNumber && /_\d+X/.test(item.PartNumber)) {
        errors.push(`Line item ${index}: Don't use size suffix (${item.PartNumber}), use base style`);
      }
    });
  }

  return errors;
}

// Use before sending
const errors = validateExternalOrderJson(orderData.order_json.ExternalOrderJson);
if (errors.length > 0) {
  console.error('Validation errors:', errors);
  return;
}
```

### Testing Procedures

#### Test 1: Minimal Valid Order

**Purpose:** Verify basic structure works

```javascript
const minimalOrder = {
  order_json: {
    ExternalOrderJson: {
      ExtOrderID: "TEST-001",
      id_Customer: 2791,
      id_OrderType: 6,
      ContactNameFirst: "Test",
      ContactNameLast: "User",
      ContactEmail: "test@example.com",
      LinesOE: [
        {
          PartNumber: "PC54",
          ForProductColor: "Black",
          Size03: 1,
          cur_UnitPriceUserEntered: 10.00,
          Quantity: 1
        }
      ]
    }
  }
};

// Send and verify 200 response
```

#### Test 2: Multi-SKU Order (3-Day Tees Pattern)

**Purpose:** Verify multi-item line handling

```javascript
const multiSKUOrder = {
  order_json: {
    ExternalOrderJson: {
      ExtOrderID: "TEST-002",
      id_Customer: 2791,
      id_OrderType: 6,
      ContactNameFirst: "Test",
      ContactNameLast: "User",
      ContactEmail: "test@example.com",
      LinesOE: [
        {
          PartNumber: "PC54",         // Base style
          ForProductColor: "Navy",
          Size01: 2,
          Size02: 4,
          Size03: 4,
          Size04: 2,
          Quantity: 12
        },
        {
          PartNumber: "PC54",         // SAME base style
          ForProductColor: "Navy",
          Size05: 2,
          Size06: 1,
          Quantity: 3
        }
      ]
    }
  }
};

// Verify both items processed correctly
// Check ShopWorks routes to PC54/PC54_2X/PC54_3X
```

#### Test 3: Error Handling

**Purpose:** Verify error responses match schemas

```javascript
// Test 401 (invalid token)
const response401 = await fetch(url, {
  headers: { 'Authorization': 'Bearer invalid-token' }
});
console.assert(response401.status === 401);
const data401 = await response401.json();
console.assert(typeof data401.result === 'string');

// Test 400 (bad request - missing field)
const badOrder = {
  order_json: {
    ExternalOrderJson: {
      // Missing required fields
      ExtOrderID: "TEST-003"
    }
  }
};
const response400 = await fetch(url, {
  method: 'POST',
  body: JSON.stringify(badOrder)
});
// Should return error with helpful message
```

---

## 📚 Related Documentation

- **Field Reference Core:** [FIELD_REFERENCE_CORE.md](FIELD_REFERENCE_CORE.md) - Master navigation for all 165 fields
- **Order Fields:** [ORDER_FIELDS.md](ORDER_FIELDS.md) - Order-level & customer fields (54 fields)
- **Product Fields:** [PRODUCT_FIELDS.md](PRODUCT_FIELDS.md) - Line items & design fields (47 fields)
- **Payment/Shipping:** [PAYMENT_SHIPPING_FIELDS.md](PAYMENT_SHIPPING_FIELDS.md) - Auxiliary blocks (34 fields)
- **Troubleshooting:** [TROUBLESHOOTING.md](TROUBLESHOOTING.md) - Common issues & solutions
- **Main Guide:** [SWAGGER_OVERVIEW.md](SWAGGER_OVERVIEW.md) - Complete schema documentation hub

---

**Documentation Type:** Swagger Examples & Validation
**Parent:** [SWAGGER_OVERVIEW.md](SWAGGER_OVERVIEW.md)
**Status:** Production-ready
