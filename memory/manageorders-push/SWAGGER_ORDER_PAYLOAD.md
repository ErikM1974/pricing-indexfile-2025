# ManageOrders PUSH API - Order Payload Schema

**Last Updated:** 2025-11-14
**Purpose:** Complete ExternalOrderJson schema documentation (165 fields)
**Status:** Production-ready

---

## 📋 Navigation

**Parent:** [SWAGGER_OVERVIEW.md](SWAGGER_OVERVIEW.md) - Complete schema documentation hub

**Related Schemas:**
- [Request Envelope (Orders)](SWAGGER_REQUEST_ENVELOPE.md) - How to wrap this payload
- [Responses](SWAGGER_RESPONSES.md) - Success and error response schemas
- [Examples](SWAGGER_EXAMPLES_VALIDATION.md) - Working examples using this schema

---

## 📄 ExternalOrderJson Schema

### Complete Schema Structure

```typescript
ExternalOrderJson {
  // Order Identification
  ExtOrderID: string              // Your order number (gets NWCA- prefix)
  ExtSource: string               // Source system identifier
  ExtCustomerID: string           // Your customer ID (optional)
  ExtCustomerPref: string         // Customer preferences (optional)

  // Order Dates
  date_OrderPlaced: string        // Format: "MM/DD/YYYY"
  date_OrderRequestedToShip: string   // Requested ship date
  date_OrderDropDead: string      // Drop-dead date

  // Order Type & Assignment
  id_OrderType: number            // 6 = Web Order, 13 = Screen Print, etc.
  id_EmpCreatedBy: number         // Employee ID (optional)
  id_Customer: number             // ShopWorks customer ID
  id_CompanyLocation: number      // Company location ID (optional)

  // Order Status
  id_SalesStatus: number          // Sales status ID (optional)
  id_ReceivingStatus: number      // Receiving status (optional)
  id_ShippingStatus: number       // Shipping status (optional)
  OnHold: number                  // 0 = Not on hold, 1 = On hold

  // Contact Information
  ContactEmail: string            // Primary contact email
  ContactNameFirst: string        // Contact first name
  ContactNameLast: string         // Contact last name
  ContactPhone: string            // Contact phone number

  // Order Details
  CustomerPurchaseOrder: string   // Customer PO number
  CustomerServiceRep: string      // Assigned sales rep name
  Terms: string                   // Payment terms

  // Discounts
  DiscountPartNumber: string      // Discount item number (optional)
  DiscountPartDescription: string // Discount description (optional)

  // Financial Totals
  cur_Shipping: number            // Shipping charges
  TaxTotal: number                // Sales tax total
  TotalDiscounts: number          // Total discounts applied

  // Customer Block (nested object)
  Customer: {
    CompanyName: string           // Company name
    CustomerSource: string        // Source (Web, Phone, etc.)
    CustomerType: string          // Customer type
    InvoiceNotes: string          // Invoice notes
    MainEmail: string             // Main email address
    SalesGroup: string            // Sales group assignment
    TaxExempt: string             // Tax exempt status
    TaxExemptNumber: string       // Tax exempt number
    WebSite: string               // Website URL

    // Custom Date Fields
    CustomDateField01: string     // Custom date 1
    CustomDateField02: string     // Custom date 2
    CustomDateField03: string     // Custom date 3
    CustomDateField04: string     // Custom date 4

    // Custom Text Fields
    CustomField01: string         // Custom field 1
    CustomField02: string         // Custom field 2
    CustomField03: string         // Custom field 3
    CustomField04: string         // Custom field 4
    CustomField05: string         // Custom field 5
    CustomField06: string         // Custom field 6

    CustomerReminderInvoiceNotes: string   // Reminder notes

    // Billing Address
    BillingCompany: string        // Billing company name
    BillingAddress01: string      // Billing address line 1
    BillingAddress02: string      // Billing address line 2
    BillingCity: string           // Billing city
    BillingState: string          // Billing state
    BillingZip: string            // Billing ZIP code
    BillingCountry: string        // Billing country
  }

  // Designs Block (array)
  Designs: [{
    DesignName: string            // Design name
    ExtDesignID: string           // Your design ID
    id_Design: number             // ShopWorks design ID (if exists)
    id_DesignType: number         // Design type ID
    id_Artist: number             // Artist ID (optional)
    ForProductColor: string       // Color this design is for
    VendorDesignID: string        // Vendor design ID (optional)

    // Custom Fields
    CustomField01: string
    CustomField02: string
    CustomField03: string
    CustomField04: string
    CustomField05: string

    // Locations (nested array)
    Locations: [{
      Location: string            // Print location name
      TotalColors: number         // Number of colors
      TotalFlashes: number        // Number of flashes (screen print)
      TotalStitches: number       // Stitch count (embroidery)
      DesignCode: string          // Design code
      CustomField01: string
      CustomField02: string
      CustomField03: string
      CustomField04: string
      CustomField05: string
      ImageURL: string            // Design image URL
      Notes: string               // Location notes

      // Location Details (nested array)
      LocationDetails: [{
        Color: string             // Thread/ink color
        ThreadBreak: string       // Thread break info
        ParameterLabel: string    // Parameter name
        ParameterValue: string    // Parameter value
        Text: string              // Text content
        CustomField01: string
        CustomField02: string
        CustomField03: string
        CustomField04: string
        CustomField05: string
      }]
    }]
  }]

  // Line Items (array)
  LinesOE: [{
    PartNumber: string            // Product part number
    Color: string                 // Product color (CATALOG_COLOR format)
    Description: string           // Product description
    Size: string                  // Size (for single-size items)
    Qty: number                   // Quantity (deprecated, use Size01-06)
    Price: number                 // Unit price
    id_ProductClass: number       // Product class ID (optional)

    // Custom Fields
    CustomField01: string
    CustomField02: string
    CustomField03: string
    CustomField04: string
    CustomField05: string

    // Personalization
    NameFirst: string             // Personalized first name
    NameLast: string              // Personalized last name

    // Notes
    LineItemNotes: string         // Line item notes
    WorkOrderNotes: string        // Work order notes

    // Design References
    ExtDesignIDBlock: string      // External design ID block
    DesignIDBlock: string         // Design ID block

    // Shipping & Display
    ExtShipID: string             // Shipping address ID reference
    DisplayAsPartNumber: string   // Display part number (override)
    DisplayAsDescription: string  // Display description (override)
  }]

  // Notes (array)
  Notes: [{
    Note: string                  // Note text
    Type: string                  // Note type
  }]

  // Payments (array)
  Payments: [{
    date_Payment: string          // Payment date
    AccountNumber: string         // Account number
    Amount: number                // Payment amount
    AuthCode: string              // Authorization code
    CreditCardCompany: string     // CC company
    Gateway: string               // Payment gateway
    ResponseCode: string          // Gateway response code
    ResponseReasonCode: string    // Reason code
    ResponseReasonText: string    // Reason text
    Status: string                // Payment status
    FeeOther: number              // Other fees
    FeeProcessing: number         // Processing fees
  }]

  // Shipping Addresses (array)
  ShippingAddresses: [{
    ShipCompany: string           // Shipping company name
    ShipMethod: string            // Shipping method
    ShipAddress01: string         // Address line 1
    ShipAddress02: string         // Address line 2
    ShipCity: string              // City
    ShipState: string             // State
    ShipZip: string               // ZIP code
    ShipCountry: string           // Country
    ExtShipID: string             // Your shipping ID reference
  }]

  // Attachments (array)
  Attachments: [{
    MediaURL: string              // Media file URL
    MediaName: string             // Media file name
    LinkURL: string               // Link URL
    LinkNote: string              // Link note
    Link: string                  // Link text
  }]
}
```

---

## 🔑 Field Naming Conventions

### Prefixes

**Understanding field prefixes helps identify field purpose:**

| Prefix | Meaning | Example | Purpose |
|--------|---------|---------|---------|
| `Ext*` | External | `ExtOrderID` | Your system's identifiers |
| `id_*` | ID reference | `id_Customer` | ShopWorks internal IDs (numeric) |
| `date_*` | Date field | `date_OrderPlaced` | Date fields (format: "MM/DD/YYYY") |
| `cur_*` | Currency | `cur_Shipping` | Currency fields (numeric) |
| `For*` | "For product" | `ForProductColor` | Product descriptors |

### Case Sensitivity

**CRITICAL:** ALL field names are **case-sensitive**

```javascript
// ❌ WRONG - Case mismatches
extOrderID: "..."        // Wrong case (lowercase 'ext')
ExtOrderId: "..."        // Wrong case (lowercase 'd')
ContactEmail: "..."      // Wrong - missing correct structure

// ✅ CORRECT - Exact case
ExtOrderID: "..."
ContactEmail: "..."
```

**Remember:**
- `ExtOrderID` ≠ `extOrderID` ≠ `ExtOrderId`
- Field names must match **exactly** as shown in schema

---

## 📌 Required vs Optional Fields

### Minimum Required Fields

**To create a basic order, you MUST include:**

| Field | Type | Description |
|-------|------|-------------|
| `ExtOrderID` | string | Your order number |
| `id_Customer` | number | ShopWorks customer ID (e.g., 2791) |
| `id_OrderType` | number | Order type ID (e.g., 6 = Web Order) |
| `ContactNameFirst` | string | Contact first name |
| `ContactNameLast` | string | Contact last name |
| `ContactEmail` | string | Contact email address |
| `LinesOE` | array | At least one line item |

**Within each line item (LinesOE), you MUST include:**

| Field | Type | Description |
|-------|------|-------------|
| `PartNumber` | string | Product part number (e.g., "PC54") |
| `ForProductColor` | string | CATALOG_COLOR format |
| `Size01-06` | number | At least one size field with quantity |
| `cur_UnitPriceUserEntered` | number | Unit price |
| `Quantity` | number | Total quantity (sum of Size01-06) |

### Recommended Optional Fields

**These fields are optional but highly recommended:**

| Field | Purpose | When to Include |
|-------|---------|-----------------|
| `date_OrderPlaced` | Order date | Always (defaults to current date if omitted) |
| `ShippingAddresses` | Shipping info | Always for physical products |
| `CustomerPurchaseOrder` | PO reference | If customer provides PO |
| `Designs` | Artwork info | If order includes custom printing/embroidery |
| `cur_Shipping` | Shipping cost | If charging shipping |
| `TaxTotal` | Sales tax | If applicable (calculated if omitted) |

---

## 🎨 Customer Block (Nested Object)

### Structure

```typescript
Customer: {
  // Company Information
  CompanyName: string
  CustomerSource: string        // "Web", "Phone", "Email", etc.
  CustomerType: string          // "Retail", "Wholesale", etc.
  MainEmail: string
  WebSite: string

  // Tax Information
  TaxExempt: string             // "Yes" or "No"
  TaxExemptNumber: string

  // Notes
  InvoiceNotes: string
  CustomerReminderInvoiceNotes: string

  // Sales Information
  SalesGroup: string

  // Custom Fields (8 total)
  CustomField01-06: string      // 6 text fields
  CustomDateField01-04: string  // 4 date fields

  // Billing Address
  BillingCompany: string
  BillingAddress01: string
  BillingAddress02: string
  BillingCity: string
  BillingState: string
  BillingZip: string
  BillingCountry: string
}
```

### Example Usage

```javascript
Customer: {
  CompanyName: "ABC Company",
  CustomerSource: "Web",
  CustomerType: "Retail",
  MainEmail: "billing@abccompany.com",
  TaxExempt: "No",
  BillingAddress01: "123 Main St",
  BillingCity: "Seattle",
  BillingState: "WA",
  BillingZip: "98101",
  BillingCountry: "USA"
}
```

**Note:** Customer block is **optional**. If omitted, ShopWorks uses existing customer data from `id_Customer` reference.

---

## 🎨 Designs Block (Array)

### Structure

```typescript
Designs: [{
  // Design Identification
  DesignName: string
  ExtDesignID: string           // Your design ID
  id_Design: number             // ShopWorks design ID (if reusing)
  id_DesignType: number         // 1 = Customer supplied, etc.
  id_Artist: number             // Artist assignment
  ForProductColor: string       // Which product color

  // Custom Fields
  CustomField01-05: string

  // Locations (nested array)
  Locations: [{
    Location: string            // "Left Chest", "Full Front", etc.
    TotalColors: number         // For screen print
    TotalFlashes: number        // For screen print
    TotalStitches: number       // For embroidery
    DesignCode: string
    ImageURL: string            // Design file URL
    Notes: string

    CustomField01-05: string

    // Location Details (nested array)
    LocationDetails: [{
      Color: string             // Thread/ink color
      Text: string              // Text content
      ParameterLabel: string
      ParameterValue: string
      ThreadBreak: string
      CustomField01-05: string
    }]
  }]
}]
```

### Example Usage (DTG Print)

```javascript
Designs: [
  {
    ExtDesignID: "upload_abc123.ai",
    DesignName: "Customer Logo - Left Chest",
    id_DesignType: 1,                // 1 = Customer supplied
    ForProductColor: "Forest",

    Locations: [
      {
        Location: "Left Chest",
        TotalColors: 1,              // 1-color DTG
        ImageURL: "https://3daytees.com/uploads/abc123.ai",
        Notes: "3x3 inches, DTG print"
      }
    ]
  }
]
```

**Design Block Use Cases:**
- **DTG/Screen Print:** Specify print location, colors, artwork URL
- **Embroidery:** Specify stitch count, thread colors, location
- **File Upload:** Reference uploaded artwork files via `ExtDesignID` or `ImageURL`

---

## 📦 Line Items (LinesOE Array)

### Structure

```typescript
LinesOE: [{
  // Product Identification
  PartNumber: string
  Color: string                 // CATALOG_COLOR format
  ForProductColor: string       // Alternative to Color
  Description: string
  ForProductDescription: string // Alternative to Description

  // Pricing
  cur_UnitPriceUserEntered: number
  Price: number                 // Alternative to cur_UnitPriceUserEntered

  // Quantity Distribution
  Size01: number                // S
  Size02: number                // M
  Size03: number                // L
  Size04: number                // XL
  Size05: number                // 2XL
  Size06: number                // 3XL, 4XL, XS, etc. (catch-all)
  Quantity: number              // Total (sum of Size01-06)

  // Legacy (deprecated)
  Size: string                  // For single-size items
  Qty: number                   // Use Size01-06 + Quantity instead

  // Product Classification
  id_ProductClass: number

  // Personalization
  NameFirst: string
  NameLast: string

  // Notes
  LineItemNotes: string
  WorkOrderNotes: string

  // Design References
  ExtDesignIDBlock: string
  DesignIDBlock: string

  // Display Overrides
  DisplayAsPartNumber: string
  DisplayAsDescription: string

  // Shipping Reference
  ExtShipID: string             // Links to ShippingAddresses[].ExtShipID

  // Custom Fields
  CustomField01-05: string
}]
```

### Example: Standard Sizes (S, M, L, XL)

```javascript
LinesOE: [
  {
    PartNumber: "PC54",
    ForProductDescription: "Port & Company Core Cotton Tee",
    ForProductColor: "Forest",       // CATALOG_COLOR format
    Size01: 4,                       // S = 4 pieces
    Size02: 8,                       // M = 8 pieces
    Size03: 8,                       // L = 8 pieces
    Size04: 2,                       // XL = 2 pieces
    Size05: 0,                       // No 2XL
    Size06: 0,                       // No 3XL
    cur_UnitPriceUserEntered: 16.00,
    Quantity: 22,                    // Total: 4+8+8+2 = 22
    WorkOrderNotes: "DTG - Left Chest - 3-Day Rush Service"
  }
]
```

### Example: Oversizes (2XL, 3XL)

```javascript
LinesOE: [
  {
    PartNumber: "PC54",              // SAME base part number
    ForProductDescription: "Port & Company Core Cotton Tee",
    ForProductColor: "Forest",
    Size01: 0,                       // No S
    Size02: 0,                       // No M
    Size03: 0,                       // No L
    Size04: 0,                       // No XL
    Size05: 2,                       // 2XL = 2 pieces
    Size06: 1,                       // 3XL = 1 piece
    cur_UnitPriceUserEntered: 18.00, // Upcharged pricing
    Quantity: 3,                     // Total: 2+1 = 3
    WorkOrderNotes: "DTG - Left Chest - 3-Day Rush | 2XL/3XL Upcharge"
  }
]
```

**Key Pattern for Multi-SKU (3-Day Tees):**
- ✅ Use BASE part number ("PC54") for ALL size groups
- ✅ Create separate line items for standard vs oversize
- ✅ ShopWorks routes to PC54/PC54_2X/PC54_3XL based on Size fields
- ❌ Never send PC54_2X or PC54_3X as PartNumber

---

## 📝 Notes (Array)

### Structure

```typescript
Notes: [{
  Note: string                  // Note text
  Type: string                  // Note type/category
}]
```

### Example Usage

```javascript
Notes: [
  {
    Note: "3-DAY RUSH SERVICE - Ship within 72 hours from artwork approval",
    Type: "Order Notes"
  },
  {
    Note: "Customer prefers UPS Ground shipping",
    Type: "Shipping Notes"
  }
]
```

---

## 💳 Payments (Array)

### Structure

```typescript
Payments: [{
  date_Payment: string          // Format: "MM/DD/YYYY"
  Amount: number
  Status: string                // "Approved", "Pending", "Declined"
  Gateway: string               // "Stripe", "PayPal", etc.
  AuthCode: string
  ResponseCode: string
  ResponseReasonText: string
  AccountNumber: string         // Last 4 digits
  CreditCardCompany: string
  FeeProcessing: number
  FeeOther: number
}]
```

### Example Usage (Stripe Payment)

```javascript
Payments: [
  {
    date_Payment: "11/08/2025",
    Amount: 552.90,
    Status: "Approved",
    Gateway: "Stripe",
    AuthCode: "ch_3Q1234567890",
    ResponseCode: "00",
    ResponseReasonText: "Approved",
    AccountNumber: "****4242",
    CreditCardCompany: "Visa",
    FeeProcessing: 16.59         // 3% processing fee
  }
]
```

---

## 📫 Shipping Addresses (Array)

### Structure

```typescript
ShippingAddresses: [{
  ExtShipID: string             // Your shipping ID reference
  ShipCompany: string
  ShipMethod: string            // "UPS Ground", "FedEx 2-Day", etc.
  ShipAddress01: string
  ShipAddress02: string
  ShipCity: string
  ShipState: string
  ShipZip: string
  ShipCountry: string
}]
```

### Example Usage

```javascript
ShippingAddresses: [
  {
    ExtShipID: "SHIP-1",
    ShipCompany: "ABC Company",
    ShipAddress01: "123 Main St",
    ShipAddress02: "Suite 200",
    ShipCity: "Seattle",
    ShipState: "WA",
    ShipZip: "98101",
    ShipCountry: "USA",
    ShipMethod: "UPS Ground"
  }
]
```

**Linking to Line Items:**
- Set `ExtShipID` in ShippingAddresses
- Reference same `ExtShipID` in LinesOE items
- Allows different products to ship to different addresses

---

## 📎 Attachments (Array)

### Structure

```typescript
Attachments: [{
  MediaURL: string              // Direct file URL
  MediaName: string             // File display name
  LinkURL: string               // Web link URL
  LinkNote: string              // Link description
  Link: string                  // Link text
}]
```

### Example Usage (Design File Upload)

```javascript
Attachments: [
  {
    MediaURL: "https://3daytees.com/uploads/logo-file.ai",
    MediaName: "Customer Logo.ai",
    LinkNote: "Vector logo file for Left Chest print"
  }
]
```

---

## 📚 Related Documentation

- **Request Envelope:** [SWAGGER_REQUEST_ENVELOPE.md](SWAGGER_REQUEST_ENVELOPE.md) - How to wrap this payload
- **Field Reference:** [FIELD_REFERENCE_CORE.md](FIELD_REFERENCE_CORE.md) - Detailed field documentation
- **Examples:** [SWAGGER_EXAMPLES_VALIDATION.md](SWAGGER_EXAMPLES_VALIDATION.md) - Complete working examples
- **Main Guide:** [SWAGGER_OVERVIEW.md](SWAGGER_OVERVIEW.md) - Complete schema documentation hub

---

**Documentation Type:** Swagger Order Payload Schema
**Parent:** [SWAGGER_OVERVIEW.md](SWAGGER_OVERVIEW.md)
**Status:** Production-ready
