# Product & Design Fields - ManageOrders PUSH API

**Version:** 2.0.1
**Last Updated:** October 29, 2025
**Part of:** ManageOrders PUSH API Documentation
**Parent Document:** [Field Reference Core](FIELD_REFERENCE_CORE.md)

---

## 📋 Navigation

**< Back to [Field Reference Core](FIELD_REFERENCE_CORE.md)**

**Related Documentation:**
- [Order & Customer Fields](ORDER_FIELDS.md) - Order-level and customer data
- [Payment & Shipping Fields](PAYMENT_SHIPPING_FIELDS.md) - Payment and shipping data
- [Implementation Examples](IMPLEMENTATION_EXAMPLES.md) - Working code snippets
- [Enhancement Roadmap](ENHANCEMENT_ROADMAP.md) - Future field additions

---

## Overview

This document covers **67 fields** across two blocks:
- **Line Item Fields:** 20 fields per product (basic info, personalization, notes, custom fields)
- **Design Block Fields:** ~47 fields for artwork specifications (designs, locations, details)

**Current Implementation:** 8 of 20 line item fields (40%), 0 of 47 design fields (0%)

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

## Enhancement Opportunities

### Phase 1: Line Item Custom Fields (Quick Win)
**Timeline:** 1-2 days
**Value:** ⭐⭐⭐⭐⭐ **VERY HIGH**
**Effort:** 🔨 **LOW**

Add 5 custom fields to track sample metadata:
```javascript
lineItems: samples.map(sample => ({
  // ... existing fields ...
  customFields: {
    CustomField01: 'FREE SAMPLE',
    CustomField02: 'Top Sellers Showcase',
    CustomField03: new Date().toLocaleDateString(),
    CustomField04: sample.type || 'free',
    CustomField05: `${sample.displayColor} → ${sample.catalogColor}`
  }
}))
```

### Phase 2: Design Block Implementation
**Timeline:** 1-2 weeks
**Value:** ⭐⭐⭐⭐⭐ **VERY HIGH**
**Effort:** 🔨🔨 **MEDIUM**

Implement design tracking for production workflow:
- Track artwork specifications
- Link designs to products
- Record color/stitch counts
- Store design images

See [Enhancement Roadmap](ENHANCEMENT_ROADMAP.md) for complete implementation details.

---

## Related Documentation

**Field Reference Documentation:**
- [Order & Customer Fields](ORDER_FIELDS.md) - Order-level and customer data
- [Payment & Shipping Fields](PAYMENT_SHIPPING_FIELDS.md) - Payment and shipping data
- [Implementation Examples](IMPLEMENTATION_EXAMPLES.md) - Working code examples
- [Enhancement Roadmap](ENHANCEMENT_ROADMAP.md) - Future field additions

**Implementation Guides:**
- [Form Development Guide](FORM_DEVELOPMENT_GUIDE.md) - Building custom forms
- [Troubleshooting Guide](TROUBLESHOOTING.md) - Common issues

**Parent Documentation:**
- [Field Reference Core](FIELD_REFERENCE_CORE.md) - Complete field reference
- [MANAGEORDERS_PUSH_WEBSTORE.md](../MANAGEORDERS_PUSH_WEBSTORE.md) - PUSH API overview

---

**Version:** 2.0.1
**Last Updated:** October 29, 2025
**Maintained By:** Erik & Claude AI
**Questions:** Contact erik@nwcustomapparel.com
