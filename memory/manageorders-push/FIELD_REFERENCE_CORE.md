# ManageOrders PUSH API - Field Reference Core

**Version:** 2.1.0
**Last Updated:** November 28, 2025
**Purpose:** Master navigation hub for all ManageOrders PUSH API field documentation
**Status:** 🎉 **100% Field Mapping Complete** - Backend proxy supports ALL ExternalOrderJson fields

> **Backend Finalized (v2.1.0):** The caspio-pricing-proxy now maps 100% of ManageOrders ExternalOrderJson fields. Future applications only need frontend changes - no backend modifications required for field mappings.

---

## 📋 Quick Navigation

This is the master navigation hub for ManageOrders PUSH API field documentation. The complete field reference has been split into focused modules for optimal performance and usability.

### Field Block Documentation

| Block | Fields | File | Status |
|-------|--------|------|--------|
| **Order-Level + Customer** | 54 | [ORDER_FIELDS.md](ORDER_FIELDS.md) | ✅ Complete |
| **Line Items + Design** | ~47 | [PRODUCT_FIELDS.md](PRODUCT_FIELDS.md) | ✅ Complete |
| **Payment/Shipping/Notes/Attachments** | 34 | [PAYMENT_SHIPPING_FIELDS.md](PAYMENT_SHIPPING_FIELDS.md) | ✅ Complete |

### Implementation Guides

| Guide | Purpose | File | Status |
|-------|---------|------|--------|
| **Swagger Schema Reference** | Complete API schema specification | [SWAGGER_OVERVIEW.md](SWAGGER_OVERVIEW.md) | ✅ Complete |
| **Form Development** | Complete form patterns (v2.0) | [FORM_DEVELOPMENT_GUIDE.md](FORM_DEVELOPMENT_GUIDE.md) | ✅ Complete |
| **Code Examples** | Working implementation snippets | [IMPLEMENTATION_EXAMPLES.md](IMPLEMENTATION_EXAMPLES.md) | ✅ Complete |
| **Troubleshooting** | Common issues & solutions | [TROUBLESHOOTING.md](TROUBLESHOOTING.md) | ✅ Complete |
| **Enhancement Roadmap** | Phase planning & future features | [ENHANCEMENT_ROADMAP.md](ENHANCEMENT_ROADMAP.md) | ✅ Complete |

### Related Documentation

| Document | Purpose | Location |
|----------|---------|----------|
| **PUSH API Overview** | Quick reference guide | [../MANAGEORDERS_PUSH_WEBSTORE.md](../MANAGEORDERS_PUSH_WEBSTORE.md) |
| **Complete Developer Guide** | Full PUSH API documentation | caspio-pricing-proxy/memory/ONLINE_STORE_DEVELOPER_GUIDE.md |
| **PULL API Integration** | Read data from ManageOrders | [../MANAGEORDERS_INTEGRATION.md](../MANAGEORDERS_INTEGRATION.md) |

---

## 📊 Overview & Statistics

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

## ✅ Real-World Validation

**Source:** Actual production order **NWCA-SAMPLE-1029-2-842** (October 29, 2025)

### Confirmed Working in Production

✅ **Billing/Shipping Separation:**
- Billing address in Customer block (7 fields)
- Shipping address in ShippingAddresses array (9 fields)
- Separate addresses working as designed

✅ **Contact Information:**
- All contact fields (firstName, lastName, email, phone)
- Sales rep assignment
- Company name preserved

✅ **Line Items:**
- Products importing with correct style, color, size
- Quantities and pricing accurate
- Size translation working (web → OnSite format)

✅ **Notes:**
- Order notes preserved exactly
- Line breaks handled correctly
- Customer information included

### Data Type Auto-Conversions (OnSite Automatic)

OnSite automatically converts data types during hourly import:

```javascript
// ManageOrders Format → OnSite Format
"TaxExempt": ""        → 0          // Empty string to number
"OnHold": 0            → "0"        // Number to string
"id_CompanyLocation": 2 → "2"       // Number to string
```

**Implication:** You don't need to match exact data types - OnSite handles conversion automatically.

### Line Break Handling

```javascript
// What you send:
"Note": "Line 1\nLine 2\nLine 3"

// What OnSite receives:
"Note": "Line 1\rLine 2\rLine 3"
```

**Implication:** Use standard `\n` line breaks - OnSite converts to `\r` automatically.

### Free Sample Pricing

```javascript
price: 0  // ✅ CORRECT - Zero dollars for free samples
```

**NOT:** `price: 0.01` (penny pricing unnecessary)

### Empty-But-Available Fields

These fields exist in OnSite and are ready for Phase 2 enhancements (no API changes needed):

```javascript
"LinesOE": [{
  "CustomField01": "",  // ✅ Ready for Phase 2
  "CustomField02": "",  // ✅ Ready for Phase 2
  "CustomField03": "",  // ✅ Ready for Phase 2
  "CustomField04": "",  // ✅ Ready for Phase 2
  "CustomField05": "",  // ✅ Ready for Phase 2
  "NameFirst": "",      // ✅ Ready for personalization
  "NameLast": "",       // ✅ Ready for personalization
  "WorkOrderNotes": ""  // ✅ Ready for production notes
}]
```

### OnSite-Specific Auto-Generated Fields

These fields are created by OnSite during import (don't send them):

```javascript
"APIType": "ManageOrders",  // Auto-set by OnSite
"id_Integration": "200",     // 200 = ManageOrders integration
"TaxPartDescription": "",    // Tax line item (if needed)
"TaxPartNumber": ""          // Tax line item (if needed)
```

---

## 🎯 Quick Start by Use Case

### "I want to build a sample request form"
1. Read [FORM_DEVELOPMENT_GUIDE.md](FORM_DEVELOPMENT_GUIDE.md) → Pattern 1: Basic Sample Request Form
2. Check [ORDER_FIELDS.md](ORDER_FIELDS.md) for required order fields
3. Check [PRODUCT_FIELDS.md](PRODUCT_FIELDS.md) for line item fields
4. Copy examples from [IMPLEMENTATION_EXAMPLES.md](IMPLEMENTATION_EXAMPLES.md)

### "I want to add file upload capability"
1. Read [FORM_DEVELOPMENT_GUIDE.md](FORM_DEVELOPMENT_GUIDE.md) → Pattern 3: File Upload Integration
2. Note: v1.1.0 already supports unlimited files (20+ types, 20MB max)
3. Smart routing: Artwork → Designs + Attachments, Documents → Attachments only

### "I want to add customer autocomplete"
1. Read [FORM_DEVELOPMENT_GUIDE.md](FORM_DEVELOPMENT_GUIDE.md) → Pattern 4: Customer Autocomplete
2. Note: 389 customers available from last 60 days
3. SessionStorage caching (24-hour TTL)
4. Auto-populates 5 fields (company, name, email, phone, sales rep)

### "I want to add billing/shipping address separation"
1. Read [FORM_DEVELOPMENT_GUIDE.md](FORM_DEVELOPMENT_GUIDE.md) → Pattern 2: Address Separation
2. Check [ORDER_FIELDS.md](ORDER_FIELDS.md) → Customer Block (billing, 7 fields)
3. Check [PAYMENT_SHIPPING_FIELDS.md](PAYMENT_SHIPPING_FIELDS.md) → Shipping (9 fields)
4. Note: Already implemented in production ✅

### "I want to check real-time inventory"
1. Read [FORM_DEVELOPMENT_GUIDE.md](FORM_DEVELOPMENT_GUIDE.md) → Pattern 5: Inventory Check
2. Note: 5-minute cache for inventory levels
3. Uses PULL API: `/api/manageorders/inventorylevels`

### "I want to add Phase 2 enhancements"
1. Check [ENHANCEMENT_ROADMAP.md](ENHANCEMENT_ROADMAP.md) → Phase 2 section
2. Confirmed available: 9 custom fields ready to use
3. Check [PRODUCT_FIELDS.md](PRODUCT_FIELDS.md) for CustomField01-05 specs
4. No API changes needed - fields already exist in OnSite

### "I'm getting an error during import"
1. Read [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
2. Check common errors section
3. Verify field mapping in [Field Mapping Quick Reference](#field-mapping-quick-reference)
4. Check OnSite import logs

---

## 📋 Field Mapping Quick Reference

This table shows how your frontend fields map to proxy fields and finally to Swagger specification fields.

### Order-Level Fields

| Your Field | Proxy Field | Swagger Field | Required | Example |
|------------|-------------|---------------|----------|---------|
| `orderNumber` | `extOrderId` | `ExtOrderID` | ✅ Yes | "WEB-12345" |
| `orderDate` | `date_Order` | `date_Order` | ✅ Yes | "2025-01-27" |
| `isTest` | *(determines prefix)* | *(adds TEST-)* | No | false |

**Complete mapping:** See [ORDER_FIELDS.md](ORDER_FIELDS.md#field-mapping)

### Customer Block Fields

| Your Field | Proxy Field | Swagger Field | Required | Example |
|------------|-------------|---------------|----------|---------|
| `customer.firstName` | `Customer.NameFirst` | `NameFirst` | ✅ Yes | "John" |
| `customer.email` | `Customer.Email` | `Email` | ✅ Yes | "john@example.com" |

**Complete mapping:** See [ORDER_FIELDS.md](ORDER_FIELDS.md#customer-block-mapping)

### Line Item Fields

| Your Field | Proxy Field | Swagger Field | Required | Example |
|------------|-------------|---------------|----------|---------|
| `partNumber` | `LinesOE[].PartNumber` | `PartNumber` | ✅ Yes | "PC54" |
| `quantity` | `LinesOE[].Quantity` | `Quantity` | ✅ Yes | 12 |
| `price` | `LinesOE[].cur_UnitPriceUserEntered` | `cur_UnitPriceUserEntered` | ✅ Yes | 15.99 |

**Complete mapping:** See [PRODUCT_FIELDS.md](PRODUCT_FIELDS.md#field-mapping)

### Shipping Fields

| Your Field | Proxy Field | Swagger Field | Required | Example |
|------------|-------------|---------------|----------|---------|
| `shipping.address1` | `ShippingAddresses[].ShipAddress01` | `ShipAddress01` | ✅ Yes | "123 Main St" |
| `shipping.city` | `ShippingAddresses[].ShipCity` | `ShipCity` | ✅ Yes | "Seattle" |

**Complete mapping:** See [PAYMENT_SHIPPING_FIELDS.md](PAYMENT_SHIPPING_FIELDS.md#shipping-mapping)

---

## 🔄 Proxy Transformations Reference

**CRITICAL:** The caspio-pricing-proxy server automatically transforms your frontend data before sending to ManageOrders API. Understanding these transformations is essential for debugging and development.

### Overview

Your frontend code sends data in a simple, developer-friendly format. The proxy server automatically:
- Adds required prefixes
- Converts date formats
- Translates sizes to ShopWorks format
- Applies fallback logic for missing fields
- Maps camelCase to Swagger field names

**You don't need to handle these transformations in your frontend code** - the proxy does it all automatically.

### 1. ExtOrderID Prefix

**What it does:** Adds "NWCA-" prefix (or "NWCA-TEST-" in test mode)

```javascript
// ✅ You send:
orderNumber: "SAMPLE-1027-1"

// ✅ Proxy transforms to:
ExtOrderID: "NWCA-SAMPLE-1027-1"        // Production mode (isTest: false)
ExtOrderID: "NWCA-TEST-SAMPLE-1027-1"   // Test mode (isTest: true)
```

**Why it matters:** Identifies orders as coming from your webstore/form in ShopWorks

**Debug tip:** Search OnSite for "NWCA-TEST-" to find test orders

### 2. Date Format Conversion

**What it does:** Converts ISO format (YYYY-MM-DD) to US format (MM/DD/YYYY)

```javascript
// ✅ You send (ISO format):
orderDate: "2025-11-14"

// ✅ Proxy transforms to:
date_OrderPlaced: "11/14/2025"
```

**Why it matters:** ShopWorks OnSite expects US date format

**Debug tip:** Always send dates in YYYY-MM-DD format - proxy handles conversion

### 3. Size Translation (SIZE_MAPPING)

**What it does:** Converts frontend size names to ShopWorks Size01-06 format

**Complete SIZE_MAPPING Table:**

| Frontend Size | ShopWorks Field | Notes |
|---------------|-----------------|-------|
| `"S"` | `Size01` | Standard |
| `"M"` | `Size02` | Standard |
| `"L"` | `Size03` | Standard |
| `"XL"` | `Size04` | Standard |
| `"2XL"` | `Size05` | Oversize |
| `"3XL"` | `Size06` | Oversize |
| `"4XL"` | `Other S` | Extended |
| `"5XL"` | `Other M` | Extended |
| `"6XL"` | `Other L` | Extended |
| `"XS"` | `Other XS` | Youth/Small |
| `"YXS"` | `Other YXS` | Youth |
| `"YS"` | `Other YS` | Youth |
| `"YM"` | `Other YM` | Youth |
| `"YL"` | `Other YL` | Youth |
| `"YXL"` | `Other YXL` | Youth |
| `"LT"` | `Other LT` | Tall |
| `"XLT"` | `Other XLT` | Tall |
| `"2XLT"` | `Other 2XLT` | Tall |
| `"3XLT"` | `Other 3XLT` | Tall |
| `"4XLT"` | `Other 4XLT` | Tall |
| `"OSFA"` | `Other XXXL` | One Size Fits All |
| `"OS"` | `Other XXXL` | One Size (alternate) |

**Example usage:**

```javascript
// ✅ You send:
lineItems: [{
  size: "2XL",
  quantity: 3
}]

// ✅ Proxy transforms to:
LinesOE: [{
  Size05: 3,
  Size01: 0,
  Size02: 0,
  Size03: 0,
  Size04: 0,
  Size06: 0
}]
```

**Why it matters:** ShopWorks uses numbered size fields (Size01-06) plus "Other" fields for extended sizes

**Debug tip:** Check OnSite import logs if sizes aren't appearing correctly

### 4. Fallback Logic

**What it does:** Auto-populates missing fields with intelligent defaults

```javascript
// ✅ Scenario 1: Missing BillingCompany
customer: {
  firstName: "John",
  lastName: "Doe"
  // No company provided
}

// ✅ Proxy fills in:
Customer: {
  BillingCompany: "John Doe",  // Fallback to full name
  NameFirst: "John",
  NameLast: "Doe"
}

// ✅ Scenario 2: Missing ShipCompany
shipping: {
  address1: "123 Main St",
  city: "Seattle"
  // No company provided
}

// ✅ Proxy fills in:
ShippingAddresses: [{
  ShipCompany: "John Doe",     // Fallback to customer name
  ShipAddress01: "123 Main St",
  ShipCity: "Seattle"
}]
```

**Why it matters:** Prevents import errors from missing company names

**Debug tip:** Company fields are NOT required in your frontend - proxy handles them

### 5. Auto-Generated Fields

**What it does:** Creates required fields you don't need to send

```javascript
// ✅ You send:
orderNumber: "SAMPLE-1027-1",
shipping: {
  address1: "123 Main St"
}

// ✅ Proxy auto-generates:
ExtShipID: "SHIP-1",                     // Always "SHIP-1"
ExtSource: "NWCA Web Form",              // Identifies source
Notes: [{
  Note: "Customer: John Doe\nEmail: john@example.com\nPhone: 253-555-1234"
}]
```

**Why it matters:** Reduces fields you need to track in frontend

**Debug tip:** ExtShipID is always "SHIP-1" - OnSite uses this for single-address orders

### 6. Field Name Mapping (camelCase → Swagger)

**What it does:** Converts developer-friendly names to Swagger API format

**Common Mappings:**

| Your Field (camelCase) | Proxy Maps To | Swagger Field |
|------------------------|---------------|---------------|
| `orderNumber` | `extOrderId` | `ExtOrderID` |
| `orderDate` | `date_Order` | `date_Order` |
| `partNumber` | `PartNumber` | `PartNumber` |
| `productColor` | `ForProductColor` | `ForProductColor` |
| `designTypeId` | `id_DesignType` | `id_DesignType` |
| `firstName` | `NameFirst` | `NameFirst` |
| `lastName` | `NameLast` | `NameLast` |

**Example:**

```javascript
// ✅ You send (camelCase - developer friendly):
{
  orderNumber: "SAMPLE-1027-1",
  customer: {
    firstName: "John",
    lastName: "Doe"
  }
}

// ✅ Proxy transforms to (Swagger format):
{
  ExtOrderID: "NWCA-SAMPLE-1027-1",
  Customer: {
    NameFirst: "John",
    NameLast: "Doe"
  }
}
```

**Why it matters:** You can use familiar camelCase naming - proxy handles Swagger format

**Debug tip:** Always check proxy client code for latest field mappings

### 7. Default Values

**What it does:** Sets reasonable defaults for optional fields

```javascript
// ✅ Defaults applied automatically:
TaxExempt: ""                            // Empty string (converts to 0)
OnHold: 0                                // Not on hold by default
DropShipAllow: 1                         // Allow drop shipping
id_CompanyLocation: 2                    // Default location ID
InHandsDate: ""                          // Optional rush date
ShipEarly: 0                             // Don't ship early
TaxTotal: 0                              // No tax by default
```

**Why it matters:** Reduces required fields - only send what you need

### 8. Address Smart Routing

**What it does:** Routes billing vs shipping addresses to correct blocks

```javascript
// ✅ You send:
customer: {
  firstName: "John",
  address: "123 Main St",      // Billing address
  city: "Seattle"
}
shipping: {
  address1: "456 Oak Ave",     // Shipping address (different)
  city: "Portland"
}

// ✅ Proxy routes to:
Customer: {
  NameFirst: "John",
  BillingAddress01: "123 Main St",     // Billing goes here
  BillingCity: "Seattle"
}
ShippingAddresses: [{
  ShipAddress01: "456 Oak Ave",        // Shipping goes here
  ShipCity: "Portland"
}]
```

**Why it matters:** Supports separate billing/shipping addresses

**Debug tip:** If shipping address is same as billing, only send shipping block

### 9. Email Cleaning

**What it does:** Removes invisible characters from email addresses

```javascript
// ✅ You send (may contain \r from database):
customer: {
  email: "john@example.com\r"
}

// ✅ Proxy cleans to:
Customer: {
  Email: "john@example.com"              // \r removed
}
```

**Why it matters:** Prevents email validation errors in OnSite

**Debug tip:** If emails aren't working, check for hidden characters

### 10. Phone Format Preservation

**What it does:** Preserves phone formatting without validation

```javascript
// ✅ You send (any format):
customer: {
  phone: "(253) 555-1234"
}

// ✅ Proxy preserves:
Customer: {
  Phone: "(253) 555-1234"                // Exact format preserved
}
```

**Why it matters:** OnSite handles phone validation - proxy doesn't modify

**Debug tip:** Send phone in any format your users prefer

---

### Testing Proxy Transformations

**View transformed data before sending:**

```javascript
// Enable debug mode in proxy client
const client = new ManageOrdersPushClient({
  debug: true  // Logs transformed data
});

// Check console for:
// "[ManageOrdersPushClient] Transformed order: {...}"
```

**Common debugging steps:**

1. Check proxy client logs for transformation details
2. Verify SIZE_MAPPING for size translation issues
3. Check ExtOrderID includes correct prefix
4. Confirm dates are in MM/DD/YYYY format in OnSite
5. Verify auto-generated fields (ExtShipID, Notes) appear

**Production implementations:**
- 3-Day Tees: `shared_components/js/three-day-tees-order-service.js`
- Sample Cart: `pages/sample-order-service.js`
- Proxy Client: `caspio-pricing-proxy/lib/manageorders-push-client.js`

---

## 🚀 Version History

### v2.0.1 (October 29, 2025)
- **MAJOR:** Split 85k monolithic file into 8 modular files
- Created manageorders-push directory structure
- Optimized all files to stay under 40k threshold
- Added master navigation hub (this file)

### v2.0.0 (October 29, 2025)
- Added Real-World Validation section (~120 lines)
- Added 7 missing Swagger fields (158 → 165 fields)
- Added Form Development Guide (~820 lines)
- Achievement: 100% Swagger coverage ✅

### v1.0.0 (October 27, 2025)
- Initial comprehensive field reference
- Documented 158 Swagger fields
- Implementation examples
- Enhancement roadmap

---

## 📞 Support & Resources

### Internal Resources
- **Proxy Source Code:** caspio-pricing-proxy/lib/manageorders-push-client.js
- **Configuration:** caspio-pricing-proxy/config/manageorders-push-config.js
- **Testing Guide:** memory/SAMPLE_ORDER_TESTING_GUIDE.md

### External Resources
- **ShopWorks ManageOrders API:** Contact ShopWorks support for credentials
- **OnSite 7 Documentation:** Available through ShopWorks support portal

### Questions?
Contact erik@nwcustomapparel.com

---

**Documentation Type:** Master Navigation Hub
**Parent Document:** [INDEX.md](../INDEX.md)
**Last Updated:** October 29, 2025
**Maintained By:** Erik & Claude AI
