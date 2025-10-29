# ManageOrders PUSH API - Field Reference Core

**Version:** 2.0.1
**Last Updated:** October 29, 2025
**Purpose:** Master navigation hub for all ManageOrders PUSH API field documentation
**Status:** 🎉 **100% Swagger Coverage** - All 165 fields documented

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
