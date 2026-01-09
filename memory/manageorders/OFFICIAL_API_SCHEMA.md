# ManageOrders API - Official Schema Reference

**Source:** ShopWorks OnSite 7 API Documentation
**Last Updated:** 2026-01-08

This document contains the official field schemas for both GET (pull) and POST (push) operations.

---

# PART 1: GET API (Reading Orders)

## GET /manageorders/orders

Retrieves a list of Orders for a date range.

**Parameters:**
| Parameter | Type | Location | Description |
|-----------|------|----------|-------------|
| Authorization | string | header | id_token from Sign-In API |
| date_Ordered_start | string | query | Order Start Date (YYYY-MM-DD) |
| date_Ordered_end | string | query | Order End Date (YYYY-MM-DD) |

**Response Fields:**
```
result: [{
    // Dates
    date_Invoiced: string
    date_Ordered: string
    date_RequestedToShip: string
    date_Shippied: string          // NOTE: Typo in API ("Shippied")
    date_Produced: string

    // Order IDs
    id_Order: number               // ShopWorks internal order ID
    id_OrderType: number
    id_Customer: number
    id_CustomerInternal: number
    id_URL: string
    id_Design: number

    // Customer Info
    CustomerName: string
    ContactFirstName: string
    ContactLastName: string
    ContactEmail: string
    ContactFax: string
    ContactPhone: string
    ContactTitle: string
    ContactDepartment: string
    CustomerServiceRep: string     // Sales rep name
    CustomerPurchaseOrder: string

    // Status Fields
    sts_SizingType: number
    sts_Invoiced: string
    sts_Paid: string
    sts_Produced: string
    sts_Purchased: string
    sts_Received: string
    sts_ReceivedSub: number
    sts_PurchasedSub: number
    sts_Shipped: number
    sts_ArtDone: number

    // Financial
    TotalProductQuantity: number
    cur_Balance: number
    cur_SalesTaxTotal: number
    cur_TotalInvoice: number
    cur_Adjustment: number
    cur_Payments: number
    cur_Shipping: number
    cur_SubTotal: number
    TermsDays: number
    TermsName: string

    // Design
    DesignName: string
}]
```

---

## GET /manageorders/getorderno/{ext_order_id}

Retrieves the Order Number that matches an External Order ID.

**Parameters:**
| Parameter | Type | Location | Description |
|-----------|------|----------|-------------|
| Authorization | string | header | id_token from Sign-In API |
| ext_order_id | string | path | External Order ID |

**Response Fields:**
```
result: [{
    id_Order: number
}]
```

---

## GET /manageorders/lineitems/{order_no}

Retrieves line items for a specific Order.

**Parameters:**
| Parameter | Type | Location | Description |
|-----------|------|----------|-------------|
| Authorization | string | header | id_token from Sign-In API |
| order_no | string | path | Order Number |

**Response Fields:**
```
result: [{
    id_Order: number
    LineQuantity: number
    LineUnitPrice: number
    Name: string
    SortOrder: number

    // Size Quantities (S, M, L, XL, 2XL, catch-all)
    Size01: string               // S quantity
    Size02: string               // M quantity
    Size03: string               // L quantity
    Size04: string               // XL quantity
    Size05: string               // 2XL quantity
    Size06: string               // catch-all (XS, 3XL+, LT, etc.)

    // Custom Fields
    Custom01: string
    Custom02: string
    Custom03: string
    Custom04: string
    Custom05: string

    // Product Info
    InvoiceNotes: string
    PartColor: string            // Product color
    PartDescription: string      // Product description
    PartNumber: string           // Product SKU
}]
```

---

## GET /manageorders/payments

Retrieves payments for a date range.

**Parameters:**
| Parameter | Type | Location | Description |
|-----------|------|----------|-------------|
| Authorization | string | header | id_token from Sign-In API |
| date_PaymentApplied_start | string | query | Applied Start Date (YYYY-MM-DD) |
| date_PaymentApplied_end | string | query | Applied End Date (YYYY-MM-DD) |

**Response Fields:**
```
result: [{
    id_Order: number
    FirstName: string
    LastName: string
    BillingCompnay: string       // NOTE: Typo in API ("Compnay")
    BillingAddress: string
    BillingCity: string
    BillingState: string
    BillingZip: string
    BillingCountry: string
    sts_Approved: number
    PaymentNumber: string
    Amount: number
    id_SubPayment: number
    date_PaymentApplied: string
    PaymentType: string
}]
```

---

## GET /manageorders/payments/{order_no}

Retrieves payments for a specific Order.

**Parameters:**
| Parameter | Type | Location | Description |
|-----------|------|----------|-------------|
| Authorization | string | header | id_token from Sign-In API |
| order_no | string | path | Order Number |

**Response:** Same as GET /manageorders/payments

---

## GET /manageorders/tracking

Retrieves tracking numbers for a date range.

**Parameters:**
| Parameter | Type | Location | Description |
|-----------|------|----------|-------------|
| Authorization | string | header | id_token from Sign-In API |
| date_Imported_start | string | query | Imported Start Date (YYYY-MM-DD) |
| date_Imported_end | string | query | Imported End Date (YYYY-MM-DD) |
| date_Creation_start | string | query | Creation Start Date (YYYY-MM-DD) |
| date_Creation_end | string | query | Creation End Date (YYYY-MM-DD) |

**Response Fields:**
```
result: [{
    id_Order: number
    TrackingNumber: string
    AddressCompany: string
    Address1: string
    Address2: string
    AddressCity: string
    AddressState: string
    AddressZip: string
    AddressCountry: string
    date_Creation: string
    date_Imported: string
    Weight: string
    Cost: string
    Type: string
}]
```

---

## GET /manageorders/tracking/{order_no}

Retrieves tracking numbers for a specific Order.

**Parameters:**
| Parameter | Type | Location | Description |
|-----------|------|----------|-------------|
| Authorization | string | header | id_token from Sign-In API |
| order_no | string | path | Order Number |

**Response:** Same as GET /manageorders/tracking

---

## GET /manageorders/inventorylevels

Retrieves inventory levels.

**Parameters:**
| Parameter | Type | Location | Description |
|-----------|------|----------|-------------|
| Authorization | string | header | id_token from Sign-In API |
| date_Modification_start | string | query | Modification Start Date |
| date_Modification_end | string | query | Modification End Date |
| PartNumber | string | query | Filter by Part Number |
| ColorRange | string | query | Filter by Color Range |
| Color | string | query | Filter by Color |
| GLAccount | string | query | Filter by GL Account |
| SKU | string | query | Filter by SKU |
| PreprintGroup | string | query | Filter by Preprint Group |
| ProductType | string | query | Filter by Product Type |
| FindCode | string | query | Filter by Find Code |
| id_Vendor | number | query | Filter by Vendor ID |
| VendorName | string | query | Filter by Vendor Name |

**Response Fields:**
```
result: [{
    id_InventoryLevel: number
    PartNumber: string
    ColorRange: string
    Color: string
    PartDescription: string
    Size01: number
    Size02: number
    Size03: number
    Size04: number
    Size05: number
    Size06: number
    UnitCost: number
    TotalCost: number
    GLAccount: string
    SKU: string
    PreprintGroup: string
    ProductType: string
    FindCode: string
    id_Vendor: number
    VendorName: string
}]
```

---

## Error Responses (All GET Endpoints)

**403 Forbidden:**
```
{ result: string }
```

**500 Internal Server Error:**
```
{ result: string }
```

---

# PART 2: POST API (Creating Orders)

## POST /manageorders/externalorderjson

Creates or updates an order in ShopWorks.

### Root Object: ExternalOrderJson

```
ExternalOrderJson {
    // Order Identifiers
    ExtOrderID: string              // Your external order ID (e.g., "SP0108-1")
    ExtSource: string               // Source system identifier
    ExtCustomerID: string           // External customer ID
    ExtCustomerPref: string         // Customer preferences

    // Dates
    date_OrderPlaced: string        // Order placement date
    date_OrderRequestedToShip: string  // Requested ship date
    date_OrderDropDead: string      // Drop-dead date

    // ShopWorks Internal IDs
    id_OrderType: number            // Order type ID
    id_EmpCreatedBy: number         // Employee ID who created
    id_Customer: number             // ShopWorks customer ID
    id_CompanyLocation: number      // Company location ID
    id_SalesStatus: number          // Sales status ID
    id_ReceivingStatus: number      // Receiving status ID
    id_ShippingStatus: number       // Shipping status ID

    // Contact Information
    ContactEmail: string            // Primary contact email
    ContactNameFirst: string        // Contact first name
    ContactNameLast: string         // Contact last name
    ContactPhone: string            // Contact phone

    // Order Details
    CustomerPurchaseOrder: string   // Customer PO number
    CustomerSeviceRep: string       // Sales rep name (NOTE: API typo - "Sevice")
    OnHold: number                  // Hold status (0 or 1)
    Terms: string                   // Payment terms

    // Discounts
    DiscountPartNumber: string      // Discount part number
    DiscountPartDescription: string // Discount description

    // Totals
    cur_Shipping: number            // Shipping cost
    TaxTotal: number                // Tax total
    TotalDiscounts: number          // Total discounts applied

    // Nested Objects
    Customer { ... }                // Customer details
    Designs [{ ... }]               // Design/decoration details
    LinesOE [{ ... }]               // Order line items
    Notes [{ ... }]                 // Order notes
    Payments [{ ... }]              // Payment records
    ShippingAddresses [{ ... }]     // Shipping addresses
    Attachments [{ ... }]           // File attachments
}
```

### Customer Object

```
Customer {
    CompanyName: string             // Company name
    CustomerSource: string          // How customer was acquired
    CustomerType: string            // Customer classification
    InvoiceNotes: string            // Invoice notes
    MainEmail: string               // Main company email
    SalesGroup: string              // Sales group
    TaxExempt: string               // Tax exempt status
    TaxExemptNumber: string         // Tax exempt number
    WebSite: string                 // Company website

    // Custom Fields
    CustomDateField01-04: string
    CustomField01-06: string
    CustomerReminderInvoiceNotes: string

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

### Designs Array

```
Designs [{
    DesignName: string
    ExtDesignID: string
    id_Design: number
    id_DesignType: number
    id_Artist: number
    ForProductColor: string
    VendorDesignID: string
    CustomField01-05: string

    Locations [{
        Location: string            // e.g., "Left Chest"
        TotalColors: string
        TotalFlashes: string
        TotalStitches: string
        DesignCode: string
        CustomField01-05: string
        ImageURL: string
        Notes: string

        LocationDetails [{
            Color: string
            ThreadBreak: string
            ParameterLabel: string
            ParameterValue: string
            Text: string            // For personalization
            CustomField01-05: string
        }]
    }]
}]
```

### LinesOE Array (Line Items)

```
LinesOE [{
    PartNumber: string              // Product SKU (includes size suffix for extended sizes)
    Color: string                   // Product color
    Description: string             // Product description
    Size: string                    // Size (e.g., "3XL", "2XLT")
    Qty: string                     // Quantity
    Price: string                   // Unit price
    id_ProductClass: number
    CustomField01-05: string

    // Personalization
    NameFirst: string
    NameLast: string

    // Notes
    LineItemNotes: string
    WorkOrderNotes: string

    // Design Linking
    ExtDesignIDBlock: string
    DesignIDBlock: string

    // Shipping
    ExtShipID: string

    // Display Overrides
    DisplayAsPartNumber: string
    DisplayAsDescription: string
}]
```

### Notes Array

```
Notes [{
    Note: string
    Type: string                    // e.g., "Production", "Internal"
}]
```

### Payments Array

```
Payments [{
    date_Payment: string
    AccountNumber: string
    Amount: number
    AuthCode: string
    CreditCardCompany: string
    Gateway: string
    ResponseCode: string
    ResponseReasonCode: string
    ResponseReasonText: string
    Status: string
    FeeOther: number
    FeeProcessing: number
}]
```

### ShippingAddresses Array

```
ShippingAddresses [{
    ShipCompany: string
    ShipMethod: string
    ShipAddress01: string
    ShipAddress02: string
    ShipCity: string
    ShipState: string
    ShipZip: string
    ShipCountry: string
    ExtShipID: string               // Links to LinesOE.ExtShipID
}]
```

### Attachments Array

```
Attachments [{
    MediaURL: string
    MediaName: string
    LinkURL: string
    LinkNote: string
    Link: number
}]
```

---

# PART 3: Extended Size Handling

## The Problem

ManageOrders GET API has only 6 size columns (Size01-Size06) for XS through 2XL.
For sizes beyond 2XL (3XL, 4XL, LT, XLT, etc.), a different approach is needed.

## The Solution: PartNumber Suffixes

**Extended sizes use PartNumber suffixes instead of Size01-Size06 columns.**

Create separate line items with the size suffix appended to the PartNumber:

| Size | PartNumber Example | Size Suffix |
|------|-------------------|-------------|
| S, M, L, XL | PC54 | (none) |
| 2XL | PC54_2X | _2X |
| 3XL | PC54_3X | _3X |
| 4XL | PC54_4X | _4X |
| 5XL | PC54_5X | _5X |
| 6XL | PC54_6X | _6X |
| LT | PC54_LT | _LT |
| XLT | PC54_XLT | _XLT |
| 2XLT | PC54_2XLT | _2XLT |
| 3XLT | PC54_3XLT | _3XLT |
| 4XLT | PC54_4XLT | _4XLT |

**CRITICAL:** Use `_2X`, `_3X`, `_4X` (NOT `_2XL`, `_3XL`, `_4XL`)

## Complete Size Modifier Reference

```javascript
const SIZE_MODIFIERS = {
    // Standard sizes - NO suffix
    "XS": "",  "S": "",  "M": "",  "L": "",  "XL": "",

    // Extended sizes - CRITICAL: Use _2X not _2XL
    "2XL": "_2X",    "3XL": "_3X",    "4XL": "_4X",
    "5XL": "_5X",    "6XL": "_6X",    "7XL": "_7XL",
    "8XL": "_8XL",   "9XL": "_9XL",   "10XL": "_10XL",

    // Tall sizes
    "LT": "_LT",     "XLT": "_XLT",   "2XLT": "_2XLT",
    "3XLT": "_3XLT", "4XLT": "_4XLT", "5XLT": "_5XLT",
    "6XLT": "_6XLT", "ST": "_ST",     "MT": "_MT",
    "XST": "_XST",

    // Youth sizes
    "YXS": "_YXS",   "YS": "_YS",     "YM": "_YM",
    "YL": "_YL",     "YXL": "_YXL",

    // Toddler sizes
    "2T": "_2T",     "3T": "_3T",     "4T": "_4T",
    "5T": "_5T",     "5/6T": "_5/6T",

    // Big sizes
    "LB": "_LB",     "XLB": "_XLB",   "2XLB": "_2XLB"
};
```

## Line Item Structure for Extended Sizes

Each size gets its own line item with the modified PartNumber:

```javascript
// Example: Ordering 2 PC54 in 3XL Navy
{
    "PartNumber": "PC54_3X",      // Base + size suffix
    "Color": "Navy",
    "Description": "Port & Company Core Cotton Tee",
    "Size": "3XL",                // Original size for display
    "Qty": "2",
    "Price": "12.50"
}
```

## Inventory Slot Mapping

When querying inventory, ShopWorks maps sizes to slots:

| Size Category | Inventory Slots |
|--------------|-----------------|
| S, M, L, XL | Size01-Size04 |
| 2XL | Size05 |
| Everything else (XS, 3XL+, LT, XLT, etc.) | Size06 |

---

# API Field Name Quirks/Typos

| Field | Issue | Notes |
|-------|-------|-------|
| `date_Shippied` | Typo | Should be "Shipped" |
| `BillingCompnay` | Typo | Should be "Company" |
| `CustomerSeviceRep` | Typo | Should be "Service" |

These typos exist in the official ShopWorks API - use them exactly as documented.

---

# Size Field Mapping (Standard Sizes Only)

GET API returns size quantities in fields Size01-Size06:

| Field | Standard Size | Notes |
|-------|---------------|-------|
| Size01 | S | |
| Size02 | M | |
| Size03 | L | |
| Size04 | XL | |
| Size05 | 2XL | |
| Size06 | catch-all | XS, 3XL+, LT, XLT, OSFA, etc. |

**Important:** Size06 is a catch-all for all extended sizes. The actual size is determined by the PartNumber suffix (e.g., `PC54_3X` = 3XL).

For sizes beyond 2XL, use the PartNumber suffix approach described above.

---

# Related Documentation

- `/memory/manageorders/API_REFERENCE.md` - Detailed endpoint guide
- `/memory/manageorders-push/SWAGGER_ORDER_PAYLOAD.md` - PUSH examples
- `/memory/MANAGEORDERS_INTEGRATION.md` - Integration overview
