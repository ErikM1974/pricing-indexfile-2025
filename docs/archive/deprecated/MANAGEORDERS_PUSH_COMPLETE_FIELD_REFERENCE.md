# ManageOrders PUSH API - Complete Field Reference

> **⚠️ DEPRECATED - This file has been split for better performance**
>
> **New Location:** [/memory/manageorders-push/](manageorders-push/)
>
> This 85KB monolithic file (212% over Claude's 40k optimal threshold) has been split into 8 modular files for better performance and navigation:
>
> - **[FIELD_REFERENCE_CORE.md](manageorders-push/FIELD_REFERENCE_CORE.md)** - Master navigation hub (~15k)
> - **[ORDER_FIELDS.md](manageorders-push/ORDER_FIELDS.md)** - Order & Customer fields (54 fields)
> - **[PRODUCT_FIELDS.md](manageorders-push/PRODUCT_FIELDS.md)** - Line Items & Design fields (47 fields)
> - **[PAYMENT_SHIPPING_FIELDS.md](manageorders-push/PAYMENT_SHIPPING_FIELDS.md)** - Payment/Shipping/Notes/Attachments (34 fields)
> - **[FORM_DEVELOPMENT_GUIDE.md](manageorders-push/FORM_DEVELOPMENT_GUIDE.md)** - Custom form patterns
> - **[IMPLEMENTATION_EXAMPLES.md](manageorders-push/IMPLEMENTATION_EXAMPLES.md)** - Working code snippets
> - **[ENHANCEMENT_ROADMAP.md](manageorders-push/ENHANCEMENT_ROADMAP.md)** - Phase planning
> - **[TROUBLESHOOTING.md](manageorders-push/TROUBLESHOOTING.md)** - Common issues & solutions
>
> **Migration Date:** October 29, 2025 (v2.0.0 → v2.0.1)
>
> This file is kept for reference but should not be updated. All future changes go to the modular structure.

---

**Version:** 2.0.0
**Last Updated:** October 29, 2025
**Source:** ShopWorks ManageOrders Swagger Specification + Real-World Production Order NWCA-SAMPLE-1029-2-842
**Purpose:** Comprehensive documentation of all 165 Swagger fields + real-world validation + form development patterns

---

## 📋 Table of Contents

1. [Overview & Statistics](#overview-statistics)
2. [Order-Level Fields](#order-level-fields)
3. [Customer Block Fields](#customer-block-fields)
4. [Line Item Fields](#line-item-fields)
5. [Design Block Fields](#design-block-fields)
6. [Payment Block Fields](#payment-block-fields)
7. [Shipping Address Fields](#shipping-address-fields)
8. [Notes Block Fields](#notes-block-fields)
9. [Attachments Block Fields](#attachments-block-fields)
10. [Field Mapping Quick Reference](#field-mapping-quick-reference)
11. [Implementation Snippets](#implementation-snippets)
12. [Troubleshooting Guide](#troubleshooting-guide)

---

## Overview & Statistics {#overview-statistics}

### Total Fields Available

| Block | Total Fields | Currently Used | Percentage | Status |
|-------|-------------|----------------|------------|--------|
| **Order-Level** | 27 | 12 | 44% | ✅ Partial |
| **Customer** | 27 | 7 | 26% | ✅ Billing Address (v1.1.0) |
| **Line Items** | 20 per item | 8 | 40% | ✅ Partial |
| **Designs** | ~27 (nested) | 0 | 0% | 📝 Future Enhancement |
| **Payments** | 12 per payment | 0 | 0% | 📝 Future Enhancement |
| **Shipping** | 9 per address | 8 | 89% | ✅ Mostly Complete |
| **Notes** | 8 types | 1 | 12.5% | ✅ Basic |
| **Attachments** | 5 per attachment | 0 | 0% | 📝 Future Enhancement |
| **TOTAL** | **165** | ~32 | **19%** | 🚀 **100% Swagger Coverage** ✅ |

### Implementation Phases

**✅ Phase 1: COMPLETE** (Current - Sample Orders)
- Basic order info
- Customer contact
- Line items (products, colors, sizes)
- Shipping address
- Basic notes

**📝 Phase 2: PLANNED** (Quick Wins)
- Line item custom fields (sample tracking)
- Additional note types
- Customer company info
- Enhanced notes

**🔮 Phase 3: FUTURE** (Major Features)
- Design block (artwork tracking)
- Payment integration (Stripe)
- Attachments (design files)
- Advanced custom fields

---

## Real-World Validation {#real-world-validation}

**Source:** Actual production order NWCA-SAMPLE-1029-2-842 (October 29, 2025)

### ✅ Confirmed Working in Production

**Billing/Shipping Separation:**
- Billing address correctly populated in Customer block (7 fields)
- Shipping address correctly populated in ShippingAddresses array (9 fields)
- Separate addresses working as designed ✅

**Contact Information:**
- All contact fields populated (firstName, lastName, email, phone)
- Sales rep assignment working correctly
- Company name preserved in billing ✅

**Line Items:**
- Products importing with correct style, color, size
- Quantities and pricing accurate
- Size translation working (web sizes → OnSite format) ✅

**Notes:**
- Order notes preserved exactly
- Line breaks handled correctly (see below)
- Customer information included in notes ✅

### 📊 Data Type Auto-Conversions (OnSite Automatic)

OnSite automatically converts data types during the hourly import process:

```javascript
// ManageOrders Format → OnSite Format
"TaxExempt": ""        → 0          // Empty string to number
"OnHold": 0            → "0"        // Number to string
"id_CompanyLocation": 2 → "2"       // Number to string
```

**Implication:** You don't need to match exact data types. OnSite handles conversion automatically during import.

### 🔤 Line Break Handling

Line breaks are automatically converted:

```javascript
// What you send (Frontend/Proxy):
"Note": "Line 1\nLine 2\nLine 3"

// What OnSite receives:
"Note": "Line 1\rLine 2\rLine 3"
```

**Implication:** Use standard `\n` line breaks in your code. OnSite converts them to `\r` automatically.

### 💰 Free Sample Pricing Confirmed

**Correct Pricing for Free Samples:**
```javascript
price: 0  // ✅ CORRECT - Zero dollars for free samples
```

**NOT:**
```javascript
price: 0.01  // ❌ WRONG - Don't use penny pricing
```

**User Confirmation:** "It's a free sample, so the pricing should be zero"

### 📋 Empty-But-Available Fields

These fields exist in OnSite but are currently empty (ready for Phase 1 enhancements):

```javascript
"LinesOE": [{
  "CustomField01": "",  // ✅ Ready for Phase 1
  "CustomField02": "",  // ✅ Ready for Phase 1
  "CustomField03": "",  // ✅ Ready for Phase 1
  "CustomField04": "",  // ✅ Ready for Phase 1
  "CustomField05": "",  // ✅ Ready for Phase 1
  "NameFirst": "",      // ✅ Ready for personalization
  "NameLast": "",       // ✅ Ready for personalization
  "WorkOrderNotes": ""  // ✅ Ready for production notes
}]
```

**Business Value:** These fields are confirmed available and can be added without API changes.

### 🔧 OnSite-Specific Fields (Auto-Generated)

These fields are created by OnSite during import (not sent by you):

```javascript
"APIType": "ManageOrders",  // Auto-set by OnSite
"id_Integration": "200",     // 200 = ManageOrders integration
"TaxPartDescription": "",    // Tax line item (if needed)
"TaxPartNumber": ""          // Tax line item (if needed)
```

**Implication:** Don't send these fields - OnSite generates them automatically.

---

## Order-Level Fields {#order-level-fields}

### Required Fields

| Field | Data Type | Status | Proxy Field | Description | Example |
|-------|-----------|--------|-------------|-------------|---------|
| `ExtOrderID` | string | ✅ **AUTO** | N/A | Unique order ID with NWCA prefix | "NWCA-SAMPLE-1027-1" |
| `id_Customer` | number | ✅ **AUTO** | N/A | Customer ID (all orders → 2791) | 2791 |
| `id_OrderType` | number | ✅ **AUTO** | N/A | Order type (6 = web orders) | 6 |

**Notes:**
- `ExtOrderID` automatically generated by proxy: `NWCA-{orderNumber}` (or `NWCA-TEST-{orderNumber}` for test orders)
- `id_Customer` hardcoded to 2791 for all web orders
- `id_OrderType` hardcoded to 6 for web orders

### Order Identification Fields

| Field | Data Type | Status | Proxy Field | Description | Example |
|-------|-----------|--------|-------------|-------------|---------|
| `ExtSource` | string | ✅ Used | N/A | Source system identifier | "NWCA-WEBSTORE" |
| `ExtCustomerID` | string | ✅ **AUTO** | N/A | External customer ID | "NWCA-CUST-SAMPLE-1027-1" |
| `ExtCustomerPref` | string | ✅ **AUTO** | N/A | Customer prefix | "NWCA" |
| `CustomerPurchaseOrder` | string | ✅ **NEW** | `purchaseOrderNumber` | Customer PO number | "SAMPLE-1027-1" |

**Implementation:**
```javascript
purchaseOrderNumber: `SAMPLE-${orderNumber}`,  // For samples
// OR
purchaseOrderNumber: customerData.actualPO,    // For real orders
```

### Date Fields

| Field | Data Type | Status | Proxy Field | Description | Example |
|-------|-----------|--------|-------------|-------------|---------|
| `date_OrderPlaced` | string | ✅ Used | `orderDate` | Order date (MM/DD/YYYY) | "10/27/2025" |
| `date_OrderRequestedToShip` | string | ❌ Not Used | `requestedShipDate` | Requested ship date | "11/03/2025" |
| `date_OrderDropDead` | string | ❌ Not Used | `dropDeadDate` | Drop-dead date | "11/10/2025" |

**Format Note:** Proxy auto-converts YYYY-MM-DD → MM/DD/YYYY

**Implementation:**
```javascript
orderDate: "2025-10-27",              // You send this
requestedShipDate: "2025-11-03",      // Optional
dropDeadDate: "2025-11-10"            // Optional
```

### Contact Fields

| Field | Data Type | Status | Proxy Field | Description | Example |
|-------|-----------|--------|-------------|-------------|---------|
| `ContactNameFirst` | string | ✅ Used | `customer.firstName` | Contact first name | "Mike" |
| `ContactNameLast` | string | ✅ Used | `customer.lastName` | Contact last name | "Test" |
| `ContactEmail` | string | ✅ Used | `customer.email` | Contact email | "erik@go2shirt.com" |
| `ContactPhone` | string | ✅ Used | `customer.phone` | Contact phone | "555-5555" |

### Sales & Billing Fields

| Field | Data Type | Status | Proxy Field | Description | Example |
|-------|-----------|--------|-------------|-------------|---------|
| `CustomerServiceRep` | string | ✅ **NEW** | `salesRep` | Sales rep name/email | "erik@nwcustomapparel.com" |
| `Terms` | string | ✅ **NEW** | `terms` | Payment terms | "FREE SAMPLE" |
| `cur_Shipping` | number | ✅ Used | `shippingAmount` | Shipping cost | 0 |
| `TaxTotal` | number | ❌ Not Used | N/A | Tax amount | 0 |
| `TotalDiscounts` | number | ❌ Not Used | N/A | Total discounts | 0 |
| `DiscountPartNumber` | string | ❌ Not Used | N/A | Discount product SKU | "" |
| `DiscountPartDescription` | string | ❌ Not Used | N/A | Discount description | "" |

**Note:** ShopWorks Swagger shows `CustomerSeviceRep` (typo - missing 'r'), but proxy sends correctly spelled `CustomerServiceRep`.

### Status & Configuration Fields

| Field | Data Type | Status | Proxy Field | Description | Example |
|-------|-----------|--------|-------------|-------------|---------|
| `id_CompanyLocation` | number | ✅ **AUTO** | N/A | Company location ID | 1 |
| `id_EmpCreatedBy` | number | ✅ **AUTO** | N/A | Employee who created | 1 |
| `id_SalesStatus` | number | ❌ Not Used | N/A | Sales status ID | 0 |
| `id_ReceivingStatus` | number | ❌ Not Used | N/A | Receiving status ID | 0 |
| `id_ShippingStatus` | number | ❌ Not Used | N/A | Shipping status ID | 0 |
| `OnHold` | number | ✅ **AUTO** | N/A | Order on hold (0=No, 1=Yes) | 0 |

### Custom Property Fields (NEW from Swagger)

| Field | Data Type | Status | Future Use Case | Description | Example |
|-------|-----------|--------|-----------------|-------------|---------|
| `UserProp1` | string | ❌ Not Used | Campaign tracking | Custom order property 1 | "Sample Program" |
| `UserProp2` | string | ❌ Not Used | Source tracking | Custom order property 2 | "Q4 2025" |
| `UserProp3` | string | ❌ Not Used | Category tracking | Custom order property 3 | "Promotional" |
| `OrderMarkedAsInvoiced` | number | ❌ Not Used | Invoice status | Invoice flag (0/1) | 0 |

**Business Value:**
- `UserProp1-3`: Track custom order metadata without using notes
- `OrderMarkedAsInvoiced`: Flag orders as invoiced for accounting workflows

**Future Implementation:**
```javascript
// Track sample program participation
order: {
  userProp1: "Free Sample Program",
  userProp2: "Top Sellers Showcase",
  userProp3: `Submitted: ${new Date().toLocaleDateString()}`,
  orderMarkedAsInvoiced: 0  // Not invoiced (free sample)
}
```

---

## Customer Block Fields {#customer-block-fields}

**⚠️ IMPORTANT:** Since all web orders go to Customer #2791, the `Customer` block is **NOT currently sent**. However, these fields are available if you need to create new customers or update existing ones.

### Company Information

| Field | Data Type | Current Status | Future Use Case | Example |
|-------|-----------|----------------|-----------------|---------|
| `CompanyName` | string | ❌ Not Used | Create new customers | "ABC Company" |
| `CustomerSource` | string | ❌ Not Used | Track lead source | "Web" |
| `CustomerType` | string | ❌ Not Used | Customer classification | "Retail" |
| `MainEmail` | string | ❌ Not Used | Primary contact email | "sales@abc.com" |
| `WebSite` | string | ❌ Not Used | Company website | "https://abc.com" |
| `SalesGroup` | string | ❌ Not Used | Sales team assignment | "Web Sales" |

### Tax & Billing

| Field | Data Type | Current Status | Future Use Case | Example |
|-------|-----------|----------------|-----------------|---------|
| `TaxExempt` | string | ❌ Not Used | Tax exemption status | "N" or "Y" |
| `TaxExemptNumber` | string | ❌ Not Used | Tax exempt cert number | "EXEMPT-123" |
| `InvoiceNotes` | string | ❌ Not Used | Default invoice notes | "Net 30" |
| `CustomerReminderInvoiceNotes` | string | ❌ Not Used | Payment reminder text | "Payment due" |

### Billing Address Fields

| Field | Data Type | Current Status | Future Use Case | Example |
|-------|-----------|----------------|-----------------|---------|
| `BillingCompany` | string | ❌ Not Used | Bill-to company | "ABC Company" |
| `BillingAddress01` | string | ❌ Not Used | Bill-to address line 1 | "123 Main St" |
| `BillingAddress02` | string | ❌ Not Used | Bill-to address line 2 | "Suite 200" |
| `BillingCity` | string | ❌ Not Used | Bill-to city | "Seattle" |
| `BillingState` | string | ❌ Not Used | Bill-to state | "WA" |
| `BillingZip` | string | ❌ Not Used | Bill-to ZIP | "98101" |
| `BillingCountry` | string | ❌ Not Used | Bill-to country | "USA" |

### Custom Fields (Customer Level)

| Field | Data Type | Current Status | Future Use Case | Example |
|-------|-----------|----------------|-----------------|---------|
| `CustomField01` | string | ❌ Not Used | Custom tracking | "Web Tier 1" |
| `CustomField02` | string | ❌ Not Used | Custom tracking | "Monthly" |
| `CustomField03` | string | ❌ Not Used | Custom tracking | "" |
| `CustomField04` | string | ❌ Not Used | Custom tracking | "" |
| `CustomField05` | string | ❌ Not Used | Custom tracking | "" |
| `CustomField06` | string | ❌ Not Used | Custom tracking | "" |
| `CustomDateField01` | string | ❌ Not Used | Date tracking | "2025-01-01" |
| `CustomDateField02` | string | ❌ Not Used | Date tracking | "" |
| `CustomDateField03` | string | ❌ Not Used | Date tracking | "" |
| `CustomDateField04` | string | ❌ Not Used | Date tracking | "" |

**Future Implementation Example:**
```javascript
Customer: {
  CompanyName: formData.company,
  CustomerType: "Web",
  CustomerSource: "Sample Request",
  TaxExempt: "N",
  BillingCompany: formData.company,
  BillingAddress01: formData.address1,
  BillingCity: formData.city,
  BillingState: formData.state,
  BillingZip: formData.zip,
  BillingCountry: "USA",
  CustomField01: "Top Sellers Showcase"
}
```

---

## Line Item Fields {#line-item-fields}

### Basic Product Fields

| Field | Data Type | Status | Proxy Field | Description | Example |
|-------|-----------|--------|-------------|-------------|---------|
| `PartNumber` | string | ✅ Used | `lineItems[].partNumber` | Product SKU | "PC54" |
| `Description` | string | ✅ Used | `lineItems[].description` | Product name | "Port & Company Tee" |
| `Color` | string | ✅ Used | `lineItems[].color` | Product color | "Lilac" |
| `Size` | string | ✅ Used | `lineItems[].size` | Size (auto-translated) | "L" → translated to OnSite format |
| `Qty` | string | ✅ Used | `lineItems[].quantity` | Quantity | "1" |
| `Price` | string | ✅ Used | `lineItems[].price` | Unit price | "0.01" |

**Size Translation:** Proxy automatically translates web sizes to OnSite format:
- S → Size01
- M → Size02
- L → Size03
- XL → Size04
- 2XL → Size05
- 3XL → Size06
- OSFA → Other XXXL

### Display Override Fields

| Field | Data Type | Status | Proxy Field | Description | Example |
|-------|-----------|--------|-------------|-------------|---------|
| `DisplayAsPartNumber` | string | ❌ Not Used | `lineItems[].displayPartNumber` | Override displayed SKU | "CUSTOM-PC54" |
| `DisplayAsDescription` | string | ❌ Not Used | `lineItems[].displayDescription` | Override displayed name | "Custom Shirt" |

**Use Case:** Show custom name/SKU on invoices while using standard SKU for inventory.

### Personalization Fields

| Field | Data Type | Status | Proxy Field | Description | Example |
|-------|-----------|--------|-------------|-------------|---------|
| `NameFirst` | string | ❌ Not Used | `lineItems[].playerName.first` | Player/recipient first name | "Mike" |
| `NameLast` | string | ❌ Not Used | `lineItems[].playerName.last` | Player/recipient last name | "Johnson" |

**Future Implementation:**
```javascript
lineItems: [{
  partNumber: "PC54",
  description: "Team Jersey",
  color: "Red",
  size: "L",
  quantity: 1,
  price: 25.00,
  playerName: {
    first: "Mike",
    last: "Johnson"
  }
}]
```

### Notes Fields

| Field | Data Type | Status | Proxy Field | Description | Example |
|-------|-----------|--------|-------------|-------------|---------|
| `LineItemNotes` | string | ❌ Not Used | `lineItems[].notes` | Line item notes | "Left chest logo" |
| `WorkOrderNotes` | string | ❌ Not Used | `lineItems[].workOrderNotes` | Production notes | "Use red thread" |

### Design Linking Fields

| Field | Data Type | Status | Proxy Field | Description | Example |
|-------|-----------|--------|-------------|-------------|---------|
| `ExtDesignIDBlock` | string | ❌ Not Used | N/A | External design ID | "DESIGN-001" |
| `DesignIDBlock` | string | ❌ Not Used | N/A | Internal design ID | "123" |
| `ExtShipID` | string | ✅ **AUTO** | N/A | Shipping address link | "SHIP-1" |

### Configuration Fields

| Field | Data Type | Status | Proxy Field | Description | Example |
|-------|-----------|--------|-------------|-------------|---------|
| `id_ProductClass` | number | ✅ **AUTO** | N/A | Product class ID | 1 |

### Cost Tracking Fields (NEW from Swagger)

| Field | Data Type | Status | Future Use Case | Description | Example |
|-------|-----------|--------|-----------------|-------------|---------|
| `CostDollars` | number | ❌ Not Used | Profit margin reporting | Item cost (dollars) | 5 |
| `CostCents` | number | ❌ Not Used | Profit margin reporting | Item cost (cents) | 50 |

**Business Value:**
- Track wholesale cost vs selling price
- Calculate profit margins per item
- Generate profitability reports
- Identify low-margin products

**Use Case Example:**
```javascript
// For paid orders (when implemented)
lineItems: [{
  partNumber: "PC54",
  description: "Core Cotton Tee",
  quantity: 12,
  price: 15.99,           // Selling price
  costDollars: 5,         // Wholesale cost $5.50
  costCents: 50,
  // Profit per item: $15.99 - $5.50 = $10.49
  // Total profit: 12 × $10.49 = $125.88
}]
```

**For Sample Orders:**
```javascript
// Free samples - cost tracking for reporting
costDollars: 5,    // Actual cost to NWCA
costCents: 50,
price: 0           // Selling price (free)
// Tracks cost of giving away free samples
```

### Custom Fields (5 per Line Item)

| Field | Data Type | Status | Future Use Case | Example |
|-------|-----------|--------|-----------------|---------|
| `CustomField01` | string | ❌ Not Used | Sample tracking | "FREE SAMPLE" |
| `CustomField02` | string | ❌ Not Used | Source tracking | "Top Sellers Showcase" |
| `CustomField03` | string | ❌ Not Used | Date tracking | "2025-10-27" |
| `CustomField04` | string | ❌ Not Used | Custom data | "" |
| `CustomField05` | string | ❌ Not Used | Custom data | "" |

**Quick Win Enhancement:**
```javascript
lineItems: samples.map(sample => ({
  partNumber: sample.style,
  description: sample.name,
  color: sample.catalogColor,
  size: sample.size || 'OSFA',
  quantity: 1,
  price: 0.01,
  customFields: {
    CustomField01: 'FREE SAMPLE',
    CustomField02: 'Top Sellers Showcase',
    CustomField03: new Date().toLocaleDateString()
  }
}))
```

---

## Design Block Fields {#design-block-fields}

**Status:** ❌ Not Currently Implemented
**Future Value:** ⭐⭐⭐⭐⭐ **HIGH** - Essential for production workflow

### Design-Level Fields

| Field | Data Type | Description | Example | Use Case |
|-------|-----------|-------------|---------|----------|
| `DesignName` | string | Design name | "Team Logo" | Identify design |
| `ExtDesignID` | string | Your design ID | "DESIGN-001" | Track in your system |
| `id_Design` | number | ShopWorks design ID | 123 | Link existing design |
| `id_DesignType` | number | Design type ID | 1 | Screen print, embroidery, etc. |
| `id_Artist` | number | Artist ID | 5 | Assign to artist |
| `ForProductColor` | string | Product color | "Red" | Color-specific designs |
| `VendorDesignID` | string | Vendor design ID | "VENDOR-123" | Third-party tracking |

### Custom Fields (Design Level)

| Field | Data Type | Description | Example |
|-------|-----------|-------------|---------|
| `CustomField01` | string | Custom data | "Rush" |
| `CustomField02` | string | Custom data | "" |
| `CustomField03` | string | Custom data | "" |
| `CustomField04` | string | Custom data | "" |
| `CustomField05` | string | Custom data | "" |

### Location-Level Fields (Nested)

| Field | Data Type | Description | Example | Critical For |
|-------|-----------|-------------|---------|--------------|
| `Location` | string | Print location | "Left Chest" | Production |
| `TotalColors` | string | Number of colors | "2" | Screen print |
| `TotalFlashes` | string | Number of flashes | "3" | Screen print |
| `TotalStitches` | string | Stitch count | "8000" | Embroidery |
| `DesignCode` | string | Location code | "LC-001" | Tracking |
| `ImageURL` | string | Design image URL | "https://..." | Visual reference |
| `Notes` | string | Location notes | "3 inch logo" | Instructions |

### Custom Fields (Location Level)

| Field | Data Type | Description | Example |
|-------|-----------|-------------|---------|
| `CustomField01` | string | Custom data | "" |
| `CustomField02` | string | Custom data | "" |
| `CustomField03` | string | Custom data | "" |
| `CustomField04` | string | Custom data | "" |
| `CustomField05` | string | Custom data | "" |

### LocationDetails Fields (Nested within Locations)

| Field | Data Type | Description | Example |
|-------|-----------|-------------|---------|
| `Color` | string | Thread/ink color | "Red" |
| `ThreadBreak` | string | Thread break info | "" |
| `ParameterLabel` | string | Parameter name | "Width" |
| `ParameterValue` | string | Parameter value | "3 inches" |
| `Text` | string | Text to print | "TEAM NAME" |

### Custom Fields (LocationDetails Level)

| Field | Data Type | Description |
|-------|-----------|-------------|
| `CustomField01` | string | Custom data |
| `CustomField02` | string | Custom data |
| `CustomField03` | string | Custom data |
| `CustomField04` | string | Custom data |
| `CustomField05` | string | Custom data |

### Complete Design Block Example

```javascript
designs: [
  {
    name: "Team Logo",
    externalId: "DESIGN-001",
    imageUrl: "https://example.com/logo.jpg",
    productColor: "Red",
    locations: [
      {
        location: "Left Chest",
        colors: "2",
        flashes: "0",
        stitches: "8000",
        code: "LC",
        imageUrl: "https://example.com/logo-lc.jpg",
        notes: "3 inch logo centered"
      },
      {
        location: "Full Back",
        colors: "3",
        flashes: "1",
        stitches: "15000",
        code: "FB",
        notes: "12 inch logo, add player name below"
      }
    ]
  }
]
```

---

## Payment Block Fields {#payment-block-fields}

**Status:** ❌ Not Currently Implemented
**Future Value:** ⭐⭐⭐⭐ **HIGH** - Important for paid orders

### Payment Transaction Fields

| Field | Data Type | Description | Example | Source |
|-------|-----------|-------------|---------|--------|
| `date_Payment` | string | Payment date (MM/DD/YYYY) | "10/27/2025" | Payment gateway |
| `Amount` | number | Payment amount | 306.00 | Payment gateway |
| `Status` | string | Payment status | "success" | Payment gateway |
| `Gateway` | string | Payment gateway name | "Stripe" | Your integration |
| `AuthCode` | string | Authorization code | "ch_1234567890" | Payment gateway |
| `AccountNumber` | string | Last 4 of card | "****4242" | Payment gateway |
| `CreditCardCompany` | string | Card brand | "Visa" | Payment gateway |
| `ResponseCode` | string | Gateway response code | "00" | Payment gateway |
| `ResponseReasonCode` | string | Reason code | "1" | Payment gateway |
| `ResponseReasonText` | string | Reason text | "Approved" | Payment gateway |
| `FeeProcessing` | number | Processing fee | 8.97 | Payment gateway |
| `FeeOther` | number | Other fees | 0 | Payment gateway |

### Payment Status Values

- `"success"` - Payment completed successfully
- `"failed"` - Payment failed
- `"pending"` - Payment pending
- `"refunded"` - Payment refunded

### Stripe Integration Example

```javascript
// After successful Stripe payment
payments: [{
  date: new Date().toISOString().split('T')[0], // YYYY-MM-DD (proxy converts)
  amount: stripeCharge.amount / 100, // Convert cents to dollars
  status: "success",
  gateway: "Stripe",
  authCode: stripeCharge.id, // "ch_1234567890"
  accountNumber: `****${stripeCharge.payment_method_details.card.last4}`,
  cardCompany: stripeCharge.payment_method_details.card.brand, // "visa"
  responseCode: stripeCharge.outcome.network_status, // "approved_by_network"
  responseReasonText: "Approved",
  feeProcessing: (stripeCharge.amount * 0.029 + 30) / 100 // 2.9% + $0.30
}]
```

### PayPal Integration Example

```javascript
// After successful PayPal payment
payments: [{
  date: new Date().toISOString().split('T')[0],
  amount: paypalOrder.purchase_units[0].amount.value,
  status: "success",
  gateway: "PayPal",
  authCode: paypalOrder.id,
  accountNumber: paypalOrder.payer.email_address,
  responseReasonText: paypalOrder.status // "COMPLETED"
}]
```

---

## Shipping Address Fields {#shipping-address-fields}

**Status:** ✅ Mostly Implemented (8 of 9 fields)

| Field | Data Type | Status | Proxy Field | Description | Example |
|-------|-----------|--------|-------------|-------------|---------|
| `ShipCompany` | string | ✅ Used | `shipping.company` | Ship-to company | "ABC Company" |
| `ShipAddress01` | string | ✅ Used | `shipping.address1` | Street address | "123 Main St" |
| `ShipAddress02` | string | ✅ Used | `shipping.address2` | Apt/Suite | "Suite 200" |
| `ShipCity` | string | ✅ Used | `shipping.city` | City | "Seattle" |
| `ShipState` | string | ✅ Used | `shipping.state` | State (2-letter) | "WA" |
| `ShipZip` | string | ✅ Used | `shipping.zip` | ZIP code | "98101" |
| `ShipCountry` | string | ✅ Used | `shipping.country` | Country | "USA" |
| `ShipMethod` | string | ✅ **NEW** | `shipping.method` | Shipping method | "UPS Ground" |
| `ShipPhone` | string | ❌ Not Used | `shipping.phone` | Ship-to phone | "253-555-1234" |
| `ExtShipID` | string | ✅ **AUTO** | N/A | Address identifier | "SHIP-1" |

**New Field - ShipPhone:**
- **Business Value:** Delivery driver can contact recipient directly
- **Use Case:** Required for residential deliveries, signature required shipments
- **Future Implementation:**
```javascript
shipping: {
  company: "ABC Company - Warehouse",
  address1: "123 Main St",
  city: "Seattle",
  state: "WA",
  zip: "98101",
  country: "USA",
  method: "UPS Ground",
  phone: "253-555-1234"  // ADD THIS - Shipping contact phone
}
```

### Multiple Addresses

ShopWorks supports multiple shipping addresses per order. Each address gets a unique `ExtShipID`, and line items link to addresses via `ExtShipID`.

**Implementation Example:**
```javascript
// Order with 2 shipping addresses
shipping: [
  {
    company: "ABC Company - Warehouse",
    address1: "123 Main St",
    city: "Seattle",
    state: "WA",
    zip: "98101",
    country: "USA",
    method: "Freight"
  },
  {
    company: "ABC Company - Office",
    address1: "456 Oak Ave",
    city: "Tacoma",
    state: "WA",
    zip: "98402",
    country: "USA",
    method: "UPS Ground"
  }
],
lineItems: [
  {
    partNumber: "PC54",
    quantity: 100,
    // ... other fields ...
    shipToAddressIndex: 0  // Links to first address (SHIP-1)
  },
  {
    partNumber: "C112",
    quantity: 50,
    // ... other fields ...
    shipToAddressIndex: 1  // Links to second address (SHIP-2)
  }
]
```

---

## Notes Block Fields {#notes-block-fields}

**Status:** ✅ Basic Implementation (1 of 8 types used)

### Note Structure

| Field | Data Type | Description | Example |
|-------|-----------|-------------|---------|
| `Type` | string | Note type (see below) | "Notes On Order" |
| `Note` | string | Note text | "Customer requested rush" |

### Valid Note Types

| Type | Current Status | Description | Use Case |
|------|----------------|-------------|----------|
| `"Notes On Order"` | ✅ Used | General order notes | Currently used for customer info |
| `"Notes To Art"` | ❌ Not Used | Art department notes | Design specifications |
| `"Notes To Purchasing"` | ❌ Not Used | Purchasing notes | Special vendor requirements |
| `"Notes To Subcontract"` | ❌ Not Used | Subcontractor notes | Outsourced work instructions |
| `"Notes To Production"` | ❌ Not Used | Production notes | Special handling |
| `"Notes To Receiving"` | ❌ Not Used | Receiving notes | Inspection requirements |
| `"Notes To Shipping"` | ❌ Not Used | Shipping notes | Expedite instructions |
| `"Notes To Accounting"` | ❌ Not Used | Accounting notes | Payment terms |

### Current Implementation

```javascript
notes: [{
  type: 'Notes On Order',
  text: `FREE SAMPLE - Top Sellers Showcase - ${formData.company || formData.lastName}`
}]
```

### Enhanced Multi-Note Implementation

```javascript
notes: [
  {
    type: 'Notes On Order',
    text: `FREE SAMPLE REQUEST\nCompany: ${formData.company || 'Individual'}\nSubmitted: ${new Date().toLocaleString()}\nOrder Type: Top Sellers Showcase`
  },
  {
    type: 'Notes To Shipping',
    text: 'Sample order - expedite shipping if possible. No signature required.'
  },
  {
    type: 'Notes To Production',
    text: 'FREE SAMPLE - Standard production schedule acceptable.'
  }
]
```

---

## Attachments Block Fields {#attachments-block-fields}

**Status:** ❌ Not Currently Implemented
**Future Value:** ⭐⭐⭐ **MEDIUM** - Useful for design files

| Field | Data Type | Description | Example | Use Case |
|-------|-----------|-------------|---------|----------|
| `MediaURL` | string | URL to media file | "https://s3.../design.pdf" | Design files |
| `MediaName` | string | Display name | "Team Logo - Vector" | User-friendly name |
| `LinkURL` | string | URL to external resource | "https://drive.google.com/..." | Google Drive, Dropbox |
| `LinkNote` | string | Note about link | "Final approved design" | Context |
| `Link` | number | Link type (0 or 1) | 1 | Unclear purpose |

### Future Implementation Example

```javascript
attachments: [
  {
    mediaURL: "https://s3.amazonaws.com/nwca/designs/logo-vector.pdf",
    mediaName: "Team Logo - Vector File",
    linkNote: "Final approved design from customer"
  },
  {
    linkURL: "https://drive.google.com/file/d/...",
    mediaName: "Mockup Images",
    linkNote: "Customer mockup folder - 5 files"
  }
]
```

---

## Field Mapping Quick Reference {#field-mapping-quick-reference}

### Order Level

| Your Field | Proxy Transforms To | Swagger Field | Status |
|------------|---------------------|---------------|--------|
| `orderNumber` | ExtOrderID (with prefix) | `ExtOrderID` | ✅ Auto |
| `orderDate` | MM/DD/YYYY format | `date_OrderPlaced` | ✅ Auto |
| `requestedShipDate` | MM/DD/YYYY format | `date_OrderRequestedToShip` | ⚠️ Available |
| `dropDeadDate` | MM/DD/YYYY format | `date_OrderDropDead` | ⚠️ Available |
| `purchaseOrderNumber` | Direct pass-through | `CustomerPurchaseOrder` | ✅ NEW |
| `salesRep` | Direct pass-through | `CustomerServiceRep` | ✅ NEW |
| `terms` | Direct pass-through | `Terms` | ✅ NEW |
| `shippingAmount` | Direct pass-through | `cur_Shipping` | ✅ Used |

### Customer

| Your Field | Proxy Transforms To | Swagger Field | Status |
|------------|---------------------|---------------|--------|
| `customer.firstName` | Direct pass-through | `ContactNameFirst` | ✅ Used |
| `customer.lastName` | Direct pass-through | `ContactNameLast` | ✅ Used |
| `customer.email` | Direct pass-through | `ContactEmail` | ✅ Used |
| `customer.phone` | Direct pass-through | `ContactPhone` | ✅ Used |
| `customer.company` | (not sent) | `Customer.CompanyName` | ⚠️ Available |

### Line Items

| Your Field | Proxy Transforms To | Swagger Field | Status |
|------------|---------------------|---------------|--------|
| `partNumber` | Direct pass-through | `PartNumber` | ✅ Used |
| `description` | Direct pass-through | `Description` | ✅ Used |
| `color` | Direct pass-through | `Color` | ✅ Used |
| `size` | **Translated** (S→Size01, M→Size02, etc.) | `Size` | ✅ Used |
| `quantity` | Direct pass-through | `Qty` | ✅ Used |
| `price` | Direct pass-through | `Price` | ✅ Used |
| `notes` | Direct pass-through | `LineItemNotes` | ⚠️ Available |
| `workOrderNotes` | Direct pass-through | `WorkOrderNotes` | ⚠️ Available |
| `playerName.first` | Direct pass-through | `NameFirst` | ⚠️ Available |
| `playerName.last` | Direct pass-through | `NameLast` | ⚠️ Available |
| `customFields.CustomField01` | Direct pass-through | `CustomField01` | ⚠️ Available |

### Shipping

| Your Field | Proxy Transforms To | Swagger Field | Status |
|------------|---------------------|---------------|--------|
| `shipping.company` | Direct pass-through | `ShipCompany` | ✅ Used |
| `shipping.address1` | Direct pass-through | `ShipAddress01` | ✅ Used |
| `shipping.address2` | Direct pass-through | `ShipAddress02` | ✅ Used |
| `shipping.city` | Direct pass-through | `ShipCity` | ✅ Used |
| `shipping.state` | Direct pass-through | `ShipState` | ✅ Used |
| `shipping.zip` | Direct pass-through | `ShipZip` | ✅ Used |
| `shipping.country` | Direct pass-through | `ShipCountry` | ✅ Used |
| `shipping.method` | Direct pass-through | `ShipMethod` | ✅ NEW |

---

## Implementation Snippets {#implementation-snippets}

### Basic Sample Order (Current)

```javascript
const order = {
  orderNumber: "SAMPLE-1027-1",
  orderDate: "2025-10-27",
  isTest: false,
  purchaseOrderNumber: "SAMPLE-SAMPLE-1027-1",
  salesRep: "erik@nwcustomapparel.com",
  terms: "FREE SAMPLE",

  customer: {
    firstName: "Mike",
    lastName: "Test",
    email: "erik@go2shirt.com",
    phone: "555-5555",
    company: "Test Company"
  },

  shipping: {
    company: "Test Company",
    address1: "123 Main St",
    address2: "",
    city: "Seattle",
    state: "WA",
    zip: "98101",
    country: "USA",
    method: "UPS Ground"
  },

  lineItems: [
    {
      partNumber: "PC54",
      description: "Port & Company Core Cotton Tee",
      color: "Lilac",
      size: "XL",
      quantity: 1,
      price: 0.01
    }
  ],

  notes: [{
    type: 'Notes On Order',
    text: 'FREE SAMPLE - Top Sellers Showcase - Test Company'
  }]
};
```

### Enhanced Sample Order with Custom Fields

```javascript
const order = {
  // ... all fields from basic example ...

  lineItems: samples.map(sample => ({
    partNumber: sample.style,
    description: sample.name,
    color: sample.catalogColor,
    size: sample.size || 'OSFA',
    quantity: 1,
    price: 0.01,

    // ADD CUSTOM FIELDS FOR TRACKING
    customFields: {
      CustomField01: 'FREE SAMPLE',
      CustomField02: 'Top Sellers Showcase',
      CustomField03: sample.addedDate,
      CustomField04: sample.type, // 'free' or 'paid'
      CustomField05: `${sample.color} → ${sample.catalogColor}` // Color mapping log
    }
  })),

  // ENHANCED NOTES
  notes: [
    {
      type: 'Notes On Order',
      text: `FREE SAMPLE REQUEST\nCompany: ${formData.company || 'Individual'}\nSubmitted: ${new Date().toLocaleString()}\nSource: Top Sellers Showcase\nSample Count: ${samples.length}`
    },
    {
      type: 'Notes To Shipping',
      text: 'Sample order - expedite if possible. No signature required.'
    },
    {
      type: 'Notes To Production',
      text: 'FREE SAMPLE - Standard turnaround acceptable. No special handling required.'
    }
  ]
};
```

### Paid Order with Payment Integration

```javascript
// After successful Stripe payment
const order = {
  orderNumber: "WEB-12345",
  orderDate: "2025-10-27",
  isTest: false,
  purchaseOrderNumber: customerData.poNumber || "WEB-12345",
  salesRep: "erik@nwcustomapparel.com",
  terms: "PREPAID - Credit Card",

  customer: {
    firstName: customerData.firstName,
    lastName: customerData.lastName,
    email: customerData.email,
    phone: customerData.phone,
    company: customerData.company
  },

  shipping: {
    company: shippingData.company,
    address1: shippingData.address1,
    address2: shippingData.address2 || '',
    city: shippingData.city,
    state: shippingData.state,
    zip: shippingData.zip,
    country: "USA",
    method: shippingData.selectedMethod // "UPS Ground", "USPS Priority", etc.
  },

  lineItems: cartItems.map(item => ({
    partNumber: item.sku,
    description: item.name,
    color: item.catalogColor,
    size: item.size,
    quantity: item.quantity,
    price: item.unitPrice,
    notes: item.decorationNotes, // e.g., "Left chest logo - 3 inch"
  })),

  // ADD PAYMENT INFORMATION
  payments: [{
    date: new Date().toISOString().split('T')[0],
    amount: stripeCharge.amount / 100,
    status: "success",
    gateway: "Stripe",
    authCode: stripeCharge.id,
    accountNumber: `****${stripeCharge.payment_method_details.card.last4}`,
    cardCompany: stripeCharge.payment_method_details.card.brand,
    responseReasonText: "Approved",
    feeProcessing: (stripeCharge.amount * 0.029 + 30) / 100
  }],

  notes: [
    {
      type: 'Notes On Order',
      text: `Web Order - Prepaid\nPayment: ${stripeCharge.payment_method_details.card.brand} ending in ${stripeCharge.payment_method_details.card.last4}\nAuth Code: ${stripeCharge.id}`
    },
    {
      type: 'Notes To Production',
      text: customerData.productionNotes || 'Standard production'
    }
  ]
};
```

### Order with Design Specifications

```javascript
const order = {
  // ... basic order fields ...

  // ADD DESIGN INFORMATION
  designs: [
    {
      name: "Company Logo",
      externalId: `DESIGN-${Date.now()}`,
      imageUrl: designFileUrl, // S3 or CDN URL
      productColor: "Navy",
      locations: [
        {
          location: "Left Chest",
          colors: "2",
          stitches: "8000",
          code: "LC",
          imageUrl: designFileUrl,
          notes: "3 inch logo centered"
        },
        {
          location: "Full Back",
          colors: "3",
          stitches: "15000",
          code: "FB",
          notes: "12 inch logo with player name below"
        }
      ]
    }
  ],

  lineItems: [
    {
      partNumber: "PC54",
      description: "Team Jersey",
      color: "Navy",
      size: "L",
      quantity: 1,
      price: 35.00,
      playerName: {
        first: "Mike",
        last: "Johnson"
      },
      notes: "Left chest and full back decoration"
    }
  ]
};
```

---

## Troubleshooting Guide {#troubleshooting-guide}

### Fields Not Appearing in ShopWorks

#### Problem: Fields show in console but not in ShopWorks invoice

**Possible Causes:**

1. **Hourly Import Delay**
   - ManageOrders receives orders immediately
   - OnSite imports from ManageOrders **every hour**
   - Some fields may not appear until hourly import runs
   - **Solution:** Wait for next hourly import, then check again

2. **Field Mapping Configuration**
   - Some fields may need to be enabled in ShopWorks OnSite settings
   - Invoice templates may not display certain fields
   - **Solution:** Check ShopWorks OnSite field settings and invoice templates

3. **Field Name Spelling Discrepancy**
   - Swagger shows `CustomerSeviceRep` (missing 'r')
   - Proxy sends `CustomerServiceRep` (correct spelling)
   - If ShopWorks expects the misspelled version, field won't populate
   - **Solution:** Test with both spellings if issues persist

4. **Invalid Field Values**
   - Sales rep must exist in ShopWorks system
   - Terms must match valid ShopWorks terms
   - Ship method must match valid methods
   - **Solution:** Verify values match ShopWorks data

#### Problem: Colors not appearing

**Cause:** Using display color name instead of catalog color

**Solution:**
```javascript
// ❌ WRONG
color: "Forest Green"  // Display name

// ✅ CORRECT
color: "Forest"  // Exact ShopWorks catalog color
```

#### Problem: Size not translated correctly

**Cause:** Sending web size directly instead of letting proxy translate

**Solution:** Let proxy handle translation:
```javascript
// ✅ CORRECT - Let proxy translate
size: "L"  // Proxy translates to Size03

// Don't manually translate:
size: "Size03"  // May cause issues
```

### API Errors

#### 400 Bad Request

**Common Causes:**
- Missing required field (`orderNumber`, `customer`, or `lineItems`)
- Invalid data type (string instead of number)
- Invalid date format (use YYYY-MM-DD)
- Empty line items array

**Solution:** Check console logs for specific error message

#### 401 Unauthorized

**Cause:** API authentication failed

**Solution:** Check that `caspio-pricing-proxy` is running and credentials are configured

#### 500 Internal Server Error

**Cause:** Server-side error in ManageOrders API

**Solution:**
1. Check ManageOrders API status
2. Review error details in proxy logs
3. Contact ShopWorks support if persistent

### Testing Checklist

**Before Going Live:**
- [ ] Test with `isTest: true` flag
- [ ] Verify order appears in ManageOrders
- [ ] Check order imports to OnSite after hourly import
- [ ] Verify all expected fields populate
- [ ] Test with various product types
- [ ] Test with different shipping addresses
- [ ] Test with multiple line items
- [ ] Verify color mapping works (CATALOG_COLOR)
- [ ] Verify size translation works
- [ ] Check notes appear correctly

**After Going Live:**
- [ ] Monitor first 10 orders closely
- [ ] Verify fields consistency
- [ ] Check production can read orders correctly
- [ ] Confirm shipping labels generate properly
- [ ] Verify customer info is accessible

---

## Enhancement Roadmap for Sample Orders

### Overview

This roadmap shows which of the 158 available ManageOrders fields should be added next to improve sample order tracking and workflow integration. Each phase includes:
- **Fields to add** - Which fields from the Swagger spec
- **Business value** - Why these fields matter
- **Implementation effort** - Estimated dev time
- **Code examples** - Ready-to-use snippets

---

### Phase 1: Quick Wins (Next Sprint)

**Timeline:** 1-2 days
**Value:** ⭐⭐⭐⭐⭐ **VERY HIGH** - Immediate tracking improvements
**Effort:** 🔨 **LOW** - Simple additions to existing code

#### 1.1: Line Item Custom Fields (5 fields)

**Fields to Add:**
- `CustomField01` - Sample type indicator
- `CustomField02` - Source tracking
- `CustomField03` - Submission date
- `CustomField04` - Free vs Paid flag
- `CustomField05` - Color mapping log

**Business Value:**
- Track sample lifecycle from request to fulfillment
- Identify trends in sample sources
- Audit trail for free sample approvals
- Troubleshoot color matching issues

**Implementation:**

```javascript
// In sample-order-service.js
lineItems: samples.map(sample => ({
  partNumber: sample.style,
  description: sample.name,
  color: sample.catalogColor,
  size: sample.size || 'OSFA',
  quantity: 1,
  price: 0.01,

  // ADD THESE 5 FIELDS
  customFields: {
    CustomField01: 'FREE SAMPLE',
    CustomField02: 'Top Sellers Showcase',
    CustomField03: new Date().toLocaleDateString(),
    CustomField04: sample.type || 'free',
    CustomField05: `${sample.displayColor} → ${sample.catalogColor}`
  }
}))
```

**Proxy Changes Required:**
```javascript
// In caspio-pricing-proxy/lib/manageorders-push-client.js
// Add to transformLineItems() function (around line 230)

lineItem.CustomField01 = item.customFields?.CustomField01 || '';
lineItem.CustomField02 = item.customFields?.CustomField02 || '';
lineItem.CustomField03 = item.customFields?.CustomField03 || '';
lineItem.CustomField04 = item.customFields?.CustomField04 || '';
lineItem.CustomField05 = item.customFields?.CustomField05 || '';
```

**Verification:**
1. Submit sample order with custom fields
2. Wait for hourly import
3. Open order in OnSite → check line item details
4. Custom fields should appear in line item custom field section

---

#### 1.2: Enhanced Notes (3 new note types)

**Fields to Add:**
- `Notes To Shipping` - Shipping instructions
- `Notes To Production` - Production notes
- `Notes To Art` - Design specifications (if applicable)

**Business Value:**
- Reduce verbal communication overhead
- Clear instructions for each department
- Faster sample fulfillment
- Better customer service

**Implementation:**

```javascript
// In sample-order-service.js
notes: [
  {
    type: 'Notes On Order',
    text: `FREE SAMPLE REQUEST
Company: ${formData.company || 'Individual'}
Contact: ${formData.firstName} ${formData.lastName}
Email: ${formData.email}
Phone: ${formData.phone}
Submitted: ${new Date().toLocaleString()}
Source: Top Sellers Showcase
Sample Count: ${samples.length}`
  },
  {
    type: 'Notes To Shipping',
    text: 'FREE SAMPLE - Expedite if possible. No signature required. Use standard packaging.'
  },
  {
    type: 'Notes To Production',
    text: 'FREE SAMPLE - Standard turnaround acceptable. No special handling required. Mark as SAMPLE on packaging.'
  }
]
```

**No Proxy Changes Required** - Notes already supported

**Verification:**
1. Submit sample order with multiple notes
2. Check OnSite order → each note type appears in correct section
3. Notes should be visible to appropriate departments

---

#### 1.3: Customer Date Fields (1 field)

**Field to Add:**
- `requestedShipDate` - When customer wants samples

**Business Value:**
- Prioritize urgent sample requests
- Manage customer expectations
- Track on-time fulfillment rate

**Implementation:**

```javascript
// In sample-cart.html - Add date picker
<label for="requestedDate">When do you need these samples?</label>
<input type="date"
       id="requestedDate"
       name="requestedDate"
       min="<%= new Date().toISOString().split('T')[0] %>"
       class="form-control">

// In sample-order-service.js
const order = {
  orderNumber: quoteId,
  orderDate: new Date().toISOString().split('T')[0],
  requestedShipDate: formData.requestedDate || null, // ADD THIS
  // ... rest of fields
};
```

**Proxy Changes Required:**
```javascript
// In caspio-pricing-proxy/lib/manageorders-push-client.js
// Add to transformOrderData() function (around line 85)

if (orderData.requestedShipDate) {
  manageOrdersOrder.date_OrderRequestedToShip = formatDateForOnSite(orderData.requestedShipDate);
}
```

**Verification:**
1. Select requested date in sample form
2. Submit order
3. Check OnSite order → "Requested Ship Date" field populated

---

### Phase 2: Medium-Term Enhancements (1-2 Weeks)

**Timeline:** 1-2 weeks
**Value:** ⭐⭐⭐⭐ **HIGH** - Improved workflow integration
**Effort:** 🔨🔨 **MEDIUM** - Requires coordination with ShopWorks setup

#### 2.1: Customer Company Information (6 fields)

**Fields to Add (to Customer Block):**
- `CompanyName` - Company name
- `MainEmail` - Primary company email
- `WebSite` - Company website
- `CustomerSource` - "Web Sample Request"
- `CustomerType` - "Sample Request"
- `SalesGroup` - Assigned sales team

**Business Value:**
- Create new customers automatically from sample requests
- Better lead tracking and conversion
- Link samples to companies for follow-up
- Sales team assignment

**Why Not Currently Used:** All orders go to Customer #2791 (web orders). This enhancement would create unique customer records for companies.

**Implementation Decision Required:**
- Option A: Keep using Customer #2791 (simpler)
- Option B: Create new customers from sample requests (better tracking)

**Implementation (Option B):**

```javascript
// In sample-order-service.js
const order = {
  orderNumber: quoteId,
  orderDate: new Date().toISOString().split('T')[0],

  customer: {
    firstName: formData.firstName,
    lastName: formData.lastName,
    email: formData.email,
    phone: formData.phone,
    company: formData.company,

    // ADD THESE FOR NEW CUSTOMER CREATION
    companyInfo: {
      companyName: formData.company,
      mainEmail: formData.email,
      website: formData.website || '',
      customerSource: 'Web Sample Request',
      customerType: 'Sample Request',
      salesGroup: 'Web Sales'
    }
  },

  // ... rest of order
};
```

**Proxy Changes Required:**
```javascript
// In caspio-pricing-proxy/lib/manageorders-push-client.js
// Modify Customer block creation (lines 117-156)

if (orderData.customer?.companyInfo) {
  manageOrdersOrder.Customer = {
    // Existing billing fields...

    // ADD THESE
    CompanyName: orderData.customer.companyInfo.companyName || '',
    MainEmail: orderData.customer.companyInfo.mainEmail || '',
    WebSite: orderData.customer.companyInfo.website || '',
    CustomerSource: orderData.customer.companyInfo.customerSource || '',
    CustomerType: orderData.customer.companyInfo.customerType || '',
    SalesGroup: orderData.customer.companyInfo.salesGroup || ''
  };
}
```

**ShopWorks Configuration Required:**
- Decide whether to create new customers or continue using #2791
- If creating new customers, configure auto-assignment rules
- Set up customer type "Sample Request" in OnSite

---

#### 2.2: Billing Address Tracking (7 fields)

**Fields to Add (to Customer Block):**
- `BillingCompany` - Bill-to company
- `BillingAddress01` - Bill-to street
- `BillingAddress02` - Bill-to suite/apt
- `BillingCity` - Bill-to city
- `BillingState` - Bill-to state
- `BillingZip` - Bill-to ZIP
- `BillingCountry` - Bill-to country

**Business Value:**
- Track where invoices should go (for paid samples)
- Separate billing address from shipping address
- Required for international samples

**Why Not Currently Used:** All samples are free (no billing needed)

**Implementation (When Paid Samples Added):**

```javascript
// In sample-cart.html - Add billing address section
<div id="billing-section">
  <h3>Billing Address</h3>
  <input type="text" name="billing_company" placeholder="Company Name">
  <input type="text" name="billing_address1" placeholder="Street Address">
  <input type="text" name="billing_address2" placeholder="Suite/Apt">
  <input type="text" name="billing_city" placeholder="City">
  <select name="billing_state"><!-- states --></select>
  <input type="text" name="billing_zip" placeholder="ZIP">

  <label>
    <input type="checkbox" id="sameasshipping" checked>
    Billing address same as shipping
  </label>
</div>

// In sample-order-service.js
const order = {
  // ... other fields

  billing: {
    company: formData.billing_company,
    address1: formData.billing_address1,
    address2: formData.billing_address2,
    city: formData.billing_city,
    state: formData.billing_state,
    zip: formData.billing_zip,
    country: 'USA'
  },

  // ... rest of order
};
```

**Proxy Changes Required:**
```javascript
// Already implemented in v1.1.0! See lines 117-123 of manageorders-push-client.js
// No changes needed - just pass billing object and proxy handles it
```

---

### Phase 3: Long-Term Features (Future Quarters)

**Timeline:** 2-3 months
**Value:** ⭐⭐⭐ **MEDIUM** - Nice-to-have features
**Effort:** 🔨🔨🔨 **HIGH** - Complex integrations

#### 3.1: Design Block Integration

**Fields to Add (nested structure):**
- Design-Level: `DesignName`, `ExtDesignID`, `id_Artist`
- Location-Level: `Location`, `TotalColors`, `TotalStitches`, `ImageURL`
- Details-Level: `Color`, `Text`, `ParameterValue`

**Business Value:**
- Track artwork for samples (if customer provides logo)
- Link design files to sample orders
- Production reference for decorated samples
- Design approval workflow

**Implementation:**
```javascript
// When customer uploads logo for sample decoration
designs: [{
  name: "Company Logo",
  externalId: `SAMPLE-DESIGN-${Date.now()}`,
  imageUrl: uploadedFileUrl,
  locations: [{
    location: "Left Chest",
    stitches: "5000",
    imageUrl: uploadedFileUrl,
    notes: "Standard logo placement for sample"
  }]
}]
```

**Use Case:** Customer requests samples with their logo embroidered/printed to evaluate quality

---

#### 3.2: Payment Integration (Paid Samples)

**Fields to Add:**
- `date_Payment` - Payment date
- `Amount` - Payment amount
- `Status` - "success"
- `Gateway` - "Stripe"
- `AuthCode` - Stripe charge ID
- `AccountNumber` - Last 4 of card
- `CreditCardCompany` - "Visa"

**Business Value:**
- Support paid sample programs ($X per sample)
- Automatic payment tracking
- Reconciliation for accounting
- Prevent free sample abuse

**Implementation:**
```javascript
// After successful Stripe payment
payments: [{
  date: new Date().toISOString().split('T')[0],
  amount: stripeCharge.amount / 100,
  status: "success",
  gateway: "Stripe",
  authCode: stripeCharge.id,
  accountNumber: `****${stripeCharge.payment_method_details.card.last4}`,
  cardCompany: stripeCharge.payment_method_details.card.brand
}]
```

**Use Case:** Switch from 100% free samples to $5/sample program

---

#### 3.3: Attachments (Design Files)

**Fields to Add:**
- `MediaURL` - URL to design file
- `MediaName` - File display name
- `LinkNote` - Description

**Business Value:**
- Attach customer's logo files to sample order
- Production can access files directly from OnSite
- No manual file transfer needed

**Implementation:**
```javascript
attachments: [{
  mediaURL: s3Url,
  mediaName: "Company Logo - Vector",
  linkNote: "Customer provided logo for sample decoration"
}]
```

**Use Case:** Customer uploads logo for decorated sample evaluation

---

## Next Steps & Future Enhancements

### Implementation Priority Matrix

| Enhancement | Business Value | Implementation Effort | Priority | Timeline |
|-------------|----------------|-----------------------|----------|----------|
| **Line Item Custom Fields** | ⭐⭐⭐⭐⭐ | 🔨 Low | **P0** | Next Sprint |
| **Enhanced Notes** | ⭐⭐⭐⭐⭐ | 🔨 Low | **P0** | Next Sprint |
| **Requested Ship Date** | ⭐⭐⭐⭐ | 🔨 Low | **P1** | Next Sprint |
| **Customer Company Info** | ⭐⭐⭐⭐ | 🔨🔨 Medium | **P2** | 1-2 Weeks |
| **Billing Address** | ⭐⭐⭐ | 🔨 Low* | **P2** | 1-2 Weeks |
| **Design Block** | ⭐⭐⭐ | 🔨🔨🔨 High | **P3** | Future |
| **Payment Integration** | ⭐⭐⭐ | 🔨🔨🔨 High | **P3** | Future |
| **Attachments** | ⭐⭐ | 🔨🔨 Medium | **P4** | Future |

*Already implemented in proxy v1.1.0 - just needs frontend work

---

### Quick Start: Implementing Phase 1 (This Week)

**Step 1: Update Frontend** (sample-order-service.js)
```javascript
// Add custom fields to line items
customFields: {
  CustomField01: 'FREE SAMPLE',
  CustomField02: 'Top Sellers Showcase',
  CustomField03: new Date().toLocaleDateString(),
  CustomField04: 'free',
  CustomField05: `${sample.displayColor} → ${sample.catalogColor}`
}

// Add enhanced notes
notes: [
  { type: 'Notes On Order', text: '...' },
  { type: 'Notes To Shipping', text: '...' },
  { type: 'Notes To Production', text: '...' }
]
```

**Step 2: Update Proxy** (caspio-pricing-proxy)
```javascript
// In manageorders-push-client.js, transformLineItems() function
lineItem.CustomField01 = item.customFields?.CustomField01 || '';
lineItem.CustomField02 = item.customFields?.CustomField02 || '';
lineItem.CustomField03 = item.customFields?.CustomField03 || '';
lineItem.CustomField04 = item.customFields?.CustomField04 || '';
lineItem.CustomField05 = item.customFields?.CustomField05 || '';
```

**Step 3: Test**
1. Submit sample order
2. Check console logs for custom fields
3. Wait for hourly import
4. Verify fields appear in OnSite

**Step 4: Monitor**
- First 10 orders: Check every field manually
- Next 100 orders: Spot check
- Ongoing: Review monthly for data quality

---

### Measuring Success

**Phase 1 Metrics:**
- ✅ 100% of sample orders have custom field data
- ✅ Notes reach correct departments automatically
- ✅ Requested ship dates tracked for 90%+ of orders

**Phase 2 Metrics:**
- ✅ Sample-to-customer conversion tracking functional
- ✅ Billing addresses captured for paid samples
- ✅ Sales team can identify sample sources

**Phase 3 Metrics:**
- ✅ Design files attached to 50%+ of decorated samples
- ✅ Payment integration live for paid sample program
- ✅ Zero manual data entry for sample orders

---

### Additional Resources

**For Developers:**
- Complete Swagger field specs in this document
- Working code examples in Implementation Snippets section
- Proxy transformation logic in caspio-pricing-proxy repository

**For Business Users:**
- SAMPLE_ORDER_TESTING_GUIDE.md - Step-by-step testing procedures
- MANAGEORDERS_PUSH_INTEGRATION.md - Complete API documentation

---

## Form Development Guide {#form-development-guide}

**Purpose:** Build custom ManageOrders integration forms with advanced features like file upload, customer autocomplete, and real-time inventory.

**Current Capabilities (v1.1.0):**
- ✅ Unlimited file uploads (20+ file types, max 20MB per file)
- ✅ Smart file routing (artwork → Designs + Attachments, documents → Attachments only)
- ✅ Automatic Caspio upload with externalKey
- ✅ Customer autocomplete (389 customers from last 60 days)
- ✅ Billing/shipping address separation
- ✅ Real-time inventory checks (5-minute cache)

---

### Pattern 1: Basic Sample Request Form

**Use Case:** Simple form for requesting free samples (current implementation)

**HTML Structure:**
```html
<form id="sampleRequestForm">
  <!-- Customer Information -->
  <h3>Contact Information</h3>
  <input type="text" name="firstName" required placeholder="First Name">
  <input type="text" name="lastName" required placeholder="Last Name">
  <input type="email" name="email" required placeholder="Email">
  <input type="tel" name="phone" required placeholder="Phone">
  <input type="text" name="company" placeholder="Company Name">

  <!-- Sales Rep Assignment -->
  <select name="salesRep" required>
    <option value="">Select Sales Rep</option>
    <option value="erik@nwcustomapparel.com">Erik Mickelson</option>
    <option value="nika@nwcustomapparel.com">Nika Lao</option>
    <!-- ... more reps ... -->
  </select>

  <!-- Shipping Address -->
  <h3>Shipping Address</h3>
  <input type="text" name="shipping_address1" required placeholder="Street Address">
  <input type="text" name="shipping_address2" placeholder="Apt/Suite (optional)">
  <input type="text" name="shipping_city" required placeholder="City">
  <select name="shipping_state" required>
    <option value="">Select State</option>
    <!-- ... states ... -->
  </select>
  <input type="text" name="shipping_zip" required placeholder="ZIP Code">

  <!-- Product Selection (hidden - managed by JS) -->
  <input type="hidden" name="samples" id="samplesData">

  <button type="submit">Request Free Samples</button>
</form>
```

**JavaScript Implementation:**
```javascript
// Sample Order Service
class SampleOrderService {
  constructor() {
    this.apiBase = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
  }

  async submitSampleRequest(formData, samples) {
    const order = {
      orderNumber: `SAMPLE-${this.generateSequence()}`,
      orderDate: new Date().toISOString().split('T')[0],
      isTest: false,

      customer: {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        phone: formData.phone,
        company: formData.company || ''
      },

      shipping: {
        company: formData.company || `${formData.firstName} ${formData.lastName}`,
        address1: formData.shipping_address1,
        address2: formData.shipping_address2 || '',
        city: formData.shipping_city,
        state: formData.shipping_state,
        zip: formData.shipping_zip,
        country: 'USA',
        method: 'UPS Ground'
      },

      lineItems: samples.map(sample => ({
        partNumber: sample.style,
        description: sample.name,
        color: sample.catalogColor,
        size: sample.size || 'OSFA',
        quantity: 1,
        price: 0  // Free samples
      })),

      salesRep: formData.salesRep,
      terms: 'FREE SAMPLE',

      notes: [{
        type: 'Notes On Order',
        text: `FREE SAMPLE - ${formData.company || 'Individual'}\nTop Sellers Showcase`
      }]
    };

    const response = await fetch(`${this.apiBase}/api/manageorders/orders/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(order)
    });

    return response.json();
  }
}
```

---

### Pattern 2: Billing/Shipping Address Separation

**Use Case:** Forms that need separate billing and shipping addresses (v1.1.0 feature)

**HTML with Progressive Disclosure:**
```html
<form id="orderForm">
  <!-- Billing Address -->
  <h3>Billing Address</h3>
  <input type="text" name="billing_company" placeholder="Company Name">
  <input type="text" name="billing_address1" required placeholder="Street Address">
  <input type="text" name="billing_address2" placeholder="Apt/Suite">
  <input type="text" name="billing_city" required placeholder="City">
  <select name="billing_state" required><!-- states --></select>
  <input type="text" name="billing_zip" required placeholder="ZIP Code">

  <!-- Ship to Same Address Toggle -->
  <label>
    <input type="checkbox" id="same-as-billing" checked>
    Ship to the same address
  </label>

  <!-- Shipping Address (hidden by default) -->
  <div id="shipping-section" style="display: none;">
    <h3>Shipping Address</h3>
    <input type="text" name="shipping_company" placeholder="Company Name">
    <input type="text" name="shipping_address1" placeholder="Street Address">
    <input type="text" name="shipping_address2" placeholder="Apt/Suite">
    <input type="text" name="shipping_city" placeholder="City">
    <select name="shipping_state"><!-- states --></select>
    <input type="text" name="shipping_zip" placeholder="ZIP Code">
  </div>

  <button type="submit">Submit Order</button>
</form>
```

**JavaScript for Show/Hide Logic:**
```javascript
// Progressive disclosure for shipping address
const sameAsBillingCheckbox = document.getElementById('same-as-billing');
const shippingSection = document.getElementById('shipping-section');

sameAsBillingCheckbox.addEventListener('change', function() {
  if (this.checked) {
    shippingSection.style.display = 'none';
    copyBillingToShipping();
  } else {
    shippingSection.style.display = 'block';
  }
});

function copyBillingToShipping() {
  const billingFields = ['company', 'address1', 'address2', 'city', 'state', 'zip'];
  billingFields.forEach(field => {
    const billingValue = document.querySelector(`[name="billing_${field}"]`).value;
    const shippingField = document.querySelector(`[name="shipping_${field}"]`);
    if (shippingField) {
      shippingField.value = billingValue;
    }
  });
}

// On form submit, ensure shipping fields are populated
document.getElementById('orderForm').addEventListener('submit', function(e) {
  if (sameAsBillingCheckbox.checked) {
    copyBillingToShipping();
  }
  // ... continue with order submission
});
```

**Server Integration (Already Implemented in v1.1.0):**
```javascript
// Just send both billing and shipping objects - proxy handles the rest
const order = {
  // ... other fields ...

  billing: {
    company: formData.billing_company,
    address1: formData.billing_address1,
    address2: formData.billing_address2,
    city: formData.billing_city,
    state: formData.billing_state,
    zip: formData.billing_zip,
    country: 'USA'
  },

  shipping: {
    company: formData.shipping_company,
    address1: formData.shipping_address1,
    address2: formData.shipping_address2,
    city: formData.shipping_city,
    state: formData.shipping_state,
    zip: formData.shipping_zip,
    country: 'USA',
    method: formData.shipping_method || 'UPS Ground'
  }
};

// Proxy automatically maps:
// - billing → Customer.BillingAddress* fields
// - shipping → ShippingAddresses[0].Ship* fields
```

---

### Pattern 3: File Upload Integration (v1.1.0)

**Use Case:** Upload artwork files, design mockups, or supporting documents

**Current Capabilities:**
- Unlimited files per order
- Supported types: AI, PSD, EPS, INDD, PDF, JPG, PNG, GIF, BMP, TIFF, SVG, DOCX, XLSX, PPTX, TXT, ZIP, RAR, 7Z
- Max 20MB per file
- Smart routing: artwork files → `Designs.Locations.ImageURL` + `Attachments`, documents → `Attachments` only

**HTML with File Upload:**
```html
<form id="orderForm" enctype="multipart/form-data">
  <!-- ... customer info ... -->

  <!-- File Upload Section -->
  <h3>Upload Files (Optional)</h3>
  <p>Accepted formats: AI, PSD, EPS, PDF, JPG, PNG, ZIP (Max 20MB per file)</p>

  <div id="file-upload-area">
    <input type="file"
           id="file-input"
           multiple
           accept=".ai,.psd,.eps,.pdf,.jpg,.jpeg,.png,.gif,.zip">

    <div id="file-list"></div>
  </div>

  <!-- Optional: Categorize files -->
  <label>
    <input type="checkbox" name="files-are-artwork" checked>
    These files are artwork/logos (will appear in design section)
  </label>

  <button type="submit">Submit Order</button>
</form>
```

**JavaScript for File Handling:**
```javascript
class FileUploadHandler {
  constructor() {
    this.files = [];
    this.maxFileSize = 20 * 1024 * 1024; // 20MB
  }

  async handleFiles(fileList, category = 'artwork') {
    const filesArray = Array.from(fileList);

    for (const file of filesArray) {
      // Validate file size
      if (file.size > this.maxFileSize) {
        alert(`File ${file.name} exceeds 20MB limit`);
        continue;
      }

      // Convert to base64
      const base64 = await this.fileToBase64(file);

      this.files.push({
        fileName: file.name,
        fileData: base64,
        category: category, // 'artwork' or 'document'
        description: `Uploaded: ${file.name}`
      });
    }

    this.updateFileList();
  }

  fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  updateFileList() {
    const listEl = document.getElementById('file-list');
    listEl.innerHTML = this.files.map((file, index) => `
      <div class="file-item">
        <span>${file.fileName}</span>
        <button type="button" onclick="fileHandler.removeFile(${index})">Remove</button>
      </div>
    `).join('');
  }

  removeFile(index) {
    this.files.splice(index, 1);
    this.updateFileList();
  }

  getFilesForOrder() {
    return this.files;
  }
}

// Initialize handler
const fileHandler = new FileUploadHandler();

// Attach event listener
document.getElementById('file-input').addEventListener('change', function(e) {
  const category = document.querySelector('[name="files-are-artwork"]').checked
    ? 'artwork'
    : 'document';
  fileHandler.handleFiles(e.target.files, category);
});

// On form submit
document.getElementById('orderForm').addEventListener('submit', async function(e) {
  e.preventDefault();

  const order = {
    // ... all order fields ...
    files: fileHandler.getFilesForOrder()
  };

  // Submit to proxy
  const response = await fetch('https://caspio-pricing-proxy.../api/manageorders/orders/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(order)
  });

  const result = await response.json();
  // Files are automatically uploaded to Caspio and linked to order
});
```

**Server-Side Routing (Already Implemented in v1.1.0):**
```javascript
// Proxy automatically handles file upload:
// 1. Uploads file to Caspio file storage
// 2. Gets externalKey from Caspio response
// 3. Routes based on category:
//    - artwork → Designs.Locations[].ImageURL + Attachments[]
//    - document → Attachments[] only
// 4. File URLs: https://caspio-pricing-proxy.../api/files/{externalKey}
```

---

### Pattern 4: Customer Autocomplete Integration

**Use Case:** Help users find existing customers instead of typing manually

**Current Capabilities:**
- 389 customers from last 60 days
- SessionStorage caching (24-hour TTL)
- Smart sorting (exact match first, then starts-with, then contains)
- Auto-populates 5 fields on selection

**HTML with Autocomplete:**
```html
<form id="orderForm">
  <!-- Customer Autocomplete -->
  <h3>Customer Information</h3>
  <div class="autocomplete-wrapper">
    <label for="company-name">Company Name</label>
    <input type="text"
           id="company-name"
           name="company"
           placeholder="Start typing company name..."
           autocomplete="off">
    <div id="autocomplete-results" class="autocomplete-dropdown"></div>
  </div>

  <!-- These fields auto-populate when customer selected -->
  <input type="text" id="customer-name" name="customerName" placeholder="Contact Name">
  <input type="email" id="email" name="email" placeholder="Email">
  <input type="tel" id="phone" name="phone" placeholder="Phone">
  <select id="sales-rep" name="salesRep">
    <option value="">Select Sales Rep</option>
  </select>

  <button type="submit">Submit Order</button>
</form>
```

**JavaScript with Autocomplete Service:**
```javascript
// Use existing ManageOrdersCustomerService from shared_components
class CustomerAutocomplete {
  constructor() {
    this.customerService = new ManageOrdersCustomerService();
    this.debounceTimer = null;
    this.init();
  }

  async init() {
    await this.customerService.initialize();
    this.attachEventListeners();
  }

  attachEventListeners() {
    const input = document.getElementById('company-name');
    const resultsEl = document.getElementById('autocomplete-results');

    // Search on input with debouncing
    input.addEventListener('input', (e) => {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = setTimeout(() => {
        this.search(e.target.value);
      }, 200); // 200ms debounce
    });

    // Hide results when clicking outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.autocomplete-wrapper')) {
        resultsEl.style.display = 'none';
      }
    });
  }

  search(query) {
    const resultsEl = document.getElementById('autocomplete-results');

    if (query.length < 2) {
      resultsEl.style.display = 'none';
      return;
    }

    const results = this.customerService.searchCustomers(query);

    if (results.length === 0) {
      resultsEl.innerHTML = '<div class="no-results">No customers found</div>';
      resultsEl.style.display = 'block';
      return;
    }

    resultsEl.innerHTML = results.slice(0, 10).map(customer => `
      <div class="autocomplete-item" data-customer-id="${customer.id_Customer}">
        <strong>${this.escapeHtml(customer.CustomerName)}</strong><br>
        <small>${this.escapeHtml(customer.ContactFirstName)} ${this.escapeHtml(customer.ContactLastName)}</small>
      </div>
    `).join('');

    // Attach click handlers to results
    resultsEl.querySelectorAll('.autocomplete-item').forEach(item => {
      item.addEventListener('click', () => {
        const customerId = parseInt(item.dataset.customerId);
        this.selectCustomer(customerId);
      });
    });

    resultsEl.style.display = 'block';
  }

  selectCustomer(customerId) {
    const customer = this.customerService.getCustomerById(customerId);
    if (!customer) return;

    // Auto-populate form fields
    document.getElementById('company-name').value = customer.CustomerName;
    document.getElementById('customer-name').value =
      `${customer.ContactFirstName} ${customer.ContactLastName}`;
    document.getElementById('email').value = customer.ContactEmail.replace(/\r/g, '');
    document.getElementById('phone').value = customer.ContactPhone;

    // Map sales rep
    const repMapping = {
      'Nika Lao': 'nika@nwcustomapparel.com',
      'Taneisha Clark': 'taneisha@nwcustomapparel.com',
      // ... more mappings
    };

    const salesRepEmail = repMapping[customer.CustomerServiceRep] || '';
    if (salesRepEmail) {
      document.getElementById('sales-rep').value = salesRepEmail;
    }

    // Hide results
    document.getElementById('autocomplete-results').style.display = 'none';
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  const autocomplete = new CustomerAutocomplete();
});
```

**CSS for Autocomplete:**
```css
.autocomplete-wrapper {
  position: relative;
}

.autocomplete-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: white;
  border: 1px solid #ccc;
  border-top: none;
  max-height: 300px;
  overflow-y: auto;
  z-index: 1000;
  display: none;
}

.autocomplete-item {
  padding: 10px;
  cursor: pointer;
  border-bottom: 1px solid #eee;
}

.autocomplete-item:hover {
  background: #f0f0f0;
}

.no-results {
  padding: 10px;
  color: #999;
  text-align: center;
}
```

---

### Pattern 5: Real-Time Inventory Check

**Use Case:** Show live stock levels before adding products to order

**Current Capabilities:**
- 5-minute cache for inventory levels
- Critical for webstores (prevent overselling)

**JavaScript Implementation:**
```javascript
class InventoryChecker {
  constructor() {
    this.apiBase = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
  }

  async checkStock(partNumber, size = null) {
    // Build query
    let query = `PartNumber=${partNumber}`;
    if (size) {
      query += `&Size=${size}`;
    }

    const response = await fetch(`${this.apiBase}/api/manageorders/inventorylevels?${query}`);
    const data = await response.json();

    if (data.length === 0) {
      return { inStock: false, quantity: 0 };
    }

    // Sum quantities across all matching records
    const totalQty = data.reduce((sum, item) => sum + (item.QuantityOnHand || 0), 0);

    return {
      inStock: totalQty > 0,
      quantity: totalQty,
      locations: data.map(item => ({
        location: item.LocationName,
        quantity: item.QuantityOnHand
      }))
    };
  }

  async displayStock(partNumber, size, targetElementId) {
    const el = document.getElementById(targetElementId);
    el.innerHTML = '<span class="checking">Checking stock...</span>';

    try {
      const stock = await this.checkStock(partNumber, size);

      if (stock.inStock) {
        el.innerHTML = `
          <span class="in-stock">✓ In Stock (${stock.quantity} available)</span>
        `;
      } else {
        el.innerHTML = `
          <span class="out-of-stock">Out of Stock - Allow 2-3 weeks</span>
        `;
      }
    } catch (error) {
      el.innerHTML = '<span class="error">Unable to check stock</span>';
    }
  }
}

// Usage in product selection form
const inventoryChecker = new InventoryChecker();

document.getElementById('product-select').addEventListener('change', function() {
  const partNumber = this.value;
  const size = document.getElementById('size-select').value;

  inventoryChecker.displayStock(partNumber, size, 'stock-status');
});
```

---

### Complete Form Example: Order with All Features

**Comprehensive implementation combining all patterns:**

```javascript
// Complete Order Form Handler
class ComprehensiveOrderForm {
  constructor() {
    this.customerService = new ManageOrdersCustomerService();
    this.fileHandler = new FileUploadHandler();
    this.inventoryChecker = new InventoryChecker();
    this.init();
  }

  async init() {
    await this.customerService.initialize();
    this.attachEventListeners();
  }

  attachEventListeners() {
    // Form submission
    document.getElementById('order-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.submitOrder();
    });

    // Customer autocomplete
    document.getElementById('company').addEventListener('input', (e) => {
      this.searchCustomers(e.target.value);
    });

    // File uploads
    document.getElementById('file-input').addEventListener('change', (e) => {
      this.fileHandler.handleFiles(e.target.files, 'artwork');
    });

    // Billing/shipping toggle
    document.getElementById('same-as-billing').addEventListener('change', (e) => {
      this.toggleShippingAddress(e.target.checked);
    });

    // Product inventory check
    document.getElementById('product-select').addEventListener('change', () => {
      this.checkProductInventory();
    });
  }

  async submitOrder() {
    const formData = new FormData(document.getElementById('order-form'));

    // Build complete order object
    const order = {
      orderNumber: `WEB-${Date.now()}`,
      orderDate: new Date().toISOString().split('T')[0],
      isTest: false,

      customer: {
        firstName: formData.get('firstName'),
        lastName: formData.get('lastName'),
        email: formData.get('email'),
        phone: formData.get('phone'),
        company: formData.get('company')
      },

      billing: {
        company: formData.get('billing_company'),
        address1: formData.get('billing_address1'),
        address2: formData.get('billing_address2') || '',
        city: formData.get('billing_city'),
        state: formData.get('billing_state'),
        zip: formData.get('billing_zip'),
        country: 'USA'
      },

      shipping: {
        company: formData.get('shipping_company'),
        address1: formData.get('shipping_address1'),
        address2: formData.get('shipping_address2') || '',
        city: formData.get('shipping_city'),
        state: formData.get('shipping_state'),
        zip: formData.get('shipping_zip'),
        country: 'USA',
        method: formData.get('shipping_method') || 'UPS Ground'
      },

      lineItems: this.buildLineItems(formData),

      files: this.fileHandler.getFilesForOrder(),

      salesRep: formData.get('salesRep'),
      terms: formData.get('terms') || 'Net 30',

      notes: [
        {
          type: 'Notes On Order',
          text: formData.get('order_notes') || 'Web order'
        },
        {
          type: 'Notes To Production',
          text: formData.get('production_notes') || 'Standard production'
        }
      ]
    };

    try {
      const response = await fetch(
        'https://caspio-pricing-proxy.../api/manageorders/orders/create',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(order)
        }
      );

      const result = await response.json();

      if (result.success) {
        this.showSuccess(result.extOrderId);
      } else {
        this.showError(result.message);
      }
    } catch (error) {
      this.showError('Failed to submit order. Please try again.');
    }
  }

  buildLineItems(formData) {
    // Extract line items from form (implementation depends on your form structure)
    return [];
  }

  showSuccess(orderId) {
    alert(`Order ${orderId} submitted successfully!`);
    document.getElementById('order-form').reset();
  }

  showError(message) {
    alert(`Error: ${message}`);
  }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  const orderForm = new ComprehensiveOrderForm();
});
```

---

### Testing Your Custom Form

**Pre-Launch Checklist:**
- [ ] Test with `isTest: true` flag first
- [ ] Verify customer autocomplete loads 389 customers
- [ ] Test billing/shipping address separation (both same and different)
- [ ] Upload test files (ensure under 20MB)
- [ ] Check inventory for multiple products
- [ ] Verify all form fields map correctly
- [ ] Test form validation (required fields)
- [ ] Check success/error messages display
- [ ] Verify order appears in ManageOrders
- [ ] Wait for hourly import and check OnSite

**Console Testing Commands:**
```javascript
// Check customer service
console.log(customerService.getStatus());

// Check cache
const cache = sessionStorage.getItem('manageorders_customers_cache');
console.log(JSON.parse(cache));

// Test inventory check
const stock = await inventoryChecker.checkStock('PC54', 'L');
console.log(stock);

// Test file handler
console.log(fileHandler.files);
```

---

**Related Resources:**
- **Complete File Upload Docs:** See `caspio-pricing-proxy/memory/ONLINE_STORE_DEVELOPER_GUIDE.md` (lines 1006-1158)
- **Customer Autocomplete Docs:** See `memory/manageorders/CUSTOMER_AUTOCOMPLETE.md`
- **Inventory API Docs:** See `memory/manageorders/API_REFERENCE.md` (Inventory section)

---

## Appendix: Swagger Spec Field Count

### Total Available Fields by Block

| Block | Fields |
|-------|--------|
| Order-Level | **27** ✅ |
| Customer | 27 |
| Designs (per design) | 10 |
| Designs.Locations (per location) | 10 |
| Designs.Locations.LocationDetails (per detail) | 7 |
| LinesOE (per line item) | **20** ✅ |
| Notes (per note) | 2 |
| Payments (per payment) | 12 |
| ShippingAddresses (per address) | **9** ✅ |
| Attachments (per attachment) | 5 |
| **Total** | **165** ✅ **(100% Swagger Coverage)** |

### Implementation Density

- **Heavily Implemented:** Shipping Address (89% - 8 of 9 fields)
- **Moderately Implemented:** Order-Level (44% - 12 of 27), Line Items (40% - 8 of 20)
- **Lightly Implemented:** Notes (12.5%)
- **Not Implemented:** Customer, Designs, Payments, Attachments (0%)

**Overall Implementation:** ~19% of available fields currently in use (32 of 165)

**Growth Potential:** 81% of fields available for future enhancements (133 fields)

**Achievement:** 🎉 **100% Swagger Coverage** - All 165 fields now documented ✅

---

**Documentation Version:** 2.0.0
**Last Updated:** October 29, 2025
**Maintained By:** Erik & Claude AI
**Questions:** Contact erik@nwcustomapparel.com

---

**Related Documentation:**
- [MANAGEORDERS_INTEGRATION.md](MANAGEORDERS_INTEGRATION.md) - PULL API (read data)
- [MANAGEORDERS_PUSH_WEBSTORE.md](MANAGEORDERS_PUSH_WEBSTORE.md) - PUSH API overview
- [ONLINE_STORE_DEVELOPER_GUIDE.md](../caspio-pricing-proxy/memory/ONLINE_STORE_DEVELOPER_GUIDE.md) - Complete PUSH API guide

**Proxy Source Code:**
- `caspio-pricing-proxy/lib/manageorders-push-client.js` - Field transformation logic
- `caspio-pricing-proxy/config/manageorders-push-config.js` - Configuration & defaults
