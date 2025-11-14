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

**Size Translation:** Proxy automatically translates web sizes to OnSite format.

**Complete SIZE_MAPPING Table:**

| Frontend Size | ShopWorks Field | Category | Notes |
|---------------|-----------------|----------|-------|
| **Standard Sizes** | | | |
| "S" | Size01 | Standard | Most common |
| "M" | Size02 | Standard | Most common |
| "L" | Size03 | Standard | Most common |
| "XL" | Size04 | Standard | Most common |
| "2XL" | Size05 | Oversize | Standard oversize |
| "3XL" | Size06 | Oversize | Standard oversize |
| **Extended Sizes** | | | |
| "4XL" | Other S | Extended | Uses "Other" fields |
| "5XL" | Other M | Extended | Uses "Other" fields |
| "6XL" | Other L | Extended | Uses "Other" fields |
| **Youth Sizes** | | | |
| "XS" | Other XS | Youth/Small | Extra small |
| "YXS" | Other YXS | Youth | Youth extra small |
| "YS" | Other YS | Youth | Youth small |
| "YM" | Other YM | Youth | Youth medium |
| "YL" | Other YL | Youth | Youth large |
| "YXL" | Other YXL | Youth | Youth extra large |
| **Tall Sizes** | | | |
| "LT" | Other LT | Tall | Large tall |
| "XLT" | Other XLT | Tall | Extra large tall |
| "2XLT" | Other 2XLT | Tall | 2XL tall |
| "3XLT" | Other 3XLT | Tall | 3XL tall |
| "4XLT" | Other 4XLT | Tall | 4XL tall |
| **Special Sizes** | | | |
| "OSFA" | Other XXXL | One Size | One Size Fits All |
| "OS" | Other XXXL | One Size | One Size (alternate) |

**Implementation Example:**
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

**Complete size translation logic documented in:** [FIELD_REFERENCE_CORE.md § Size Translation](FIELD_REFERENCE_CORE.md#3-size-translation)

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

| Field | Data Type | Proxy Maps From | Description | Example | Use Case |
|-------|-----------|-----------------|-------------|---------|----------|
| `DesignName` | string | `designName` | Design name | "Team Logo" | Identify design |
| `ExtDesignID` | string | `designId` | Your design ID | "DESIGN-001" | Track in your system |
| `id_Design` | number | `shopworksDesignId` | ShopWorks design ID | 123 | Link existing design |
| `id_DesignType` | number | `designTypeId` | Design type ID | 1 | Screen print, embroidery, etc. |
| `id_Artist` | number | `artistId` | Artist ID | 5 | Assign to artist |
| `ForProductColor` | string | `productColor` | Product color | "Red" | Color-specific designs |
| `VendorDesignID` | string | `vendorDesignId` | Vendor design ID | "VENDOR-123" | Third-party tracking |

**⚠️ Frontend Field Names:**
Use camelCase names in your frontend code - the proxy automatically maps them to Swagger format:
- `designName` → `DesignName`
- `designId` → `ExtDesignID`
- `shopworksDesignId` → `id_Design`
- `designTypeId` → `id_DesignType`
- `artistId` → `id_Artist`
- `productColor` → `ForProductColor`
- `vendorDesignId` → `VendorDesignID`

**Complete field name mapping documented in:** [FIELD_REFERENCE_CORE.md § Proxy Transformations](FIELD_REFERENCE_CORE.md#proxy-transformations-reference)

---

### 🎨 Design Type IDs Reference

These are standard design type IDs in ShopWorks OnSite 7. Verify these match your system configuration.

| ID | Design Type | Use Case | Quote Builder |
|----|-------------|----------|---------------|
| 1 | Screen Print | Traditional screen printing | Screen Print Quote Builder |
| 15 | DTG (Direct-to-Garment) | Water-based digital printing | DTG Quote Builder |
| 17 | Embroidery | Thread-based decoration | Embroidery Quote Builder |
| 18 | Cap Embroidery | Structured cap embroidery | Cap Quote Builder |
| 45 | DTG Alternate | Some systems use this for DTG | **3-Day Tees uses this** |

**Important Notes:**
- **3-Day Tees currently uses `id_DesignType: 45`** - Verify this matches your ShopWorks DTG configuration
- DTG systems may use either ID 15 or ID 45 depending on setup
- To find design type IDs in ShopWorks: **Settings → Design Types → View ID column**

**Implementation:**
```javascript
// Screen Print Quote Builder
designs: [{
  designName: "Team Logo",
  designTypeId: 1,  // Screen Print
  locations: [{
    location: "Full Front",
    totalColors: "4",
    totalFlashes: "1"
  }]
}]

// 3-Day Tees (DTG)
designs: [{
  designName: "Logo",
  designTypeId: 45,  // DTG (verify your system uses 45 not 15)
  artistId: 224,
  locations: [{
    location: "Left Chest"
  }]
}]
```

### 👨‍🎨 Artist ID Assignment

The `id_Artist` field assigns design work to a specific artist in ShopWorks for production routing.

**3-Day Tees Configuration:**
- **Artist ID: 224** - Verify this corresponds to correct artist in your system

**How to Find Artist IDs:**
1. Open ShopWorks OnSite 7
2. Navigate to: **Settings → Artists**
3. View the **ID column** to see artist IDs
4. Match the ID to the correct artist for your workflow

**Implementation Example:**
```javascript
// Assign to specific artist
designs: [{
  designName: "Customer Logo",
  designTypeId: 15,  // DTG
  artistId: 224,     // Artist ID from ShopWorks
  locations: [...]
}]

// No artist assignment (OnSite will use default routing)
designs: [{
  designName: "Standard Design",
  designTypeId: 1,   // Screen Print
  // artistId omitted - uses default routing
  locations: [...]
}]
```

**When to Use Artist ID:**
- **Rush orders** - Route to specific artist for faster turnaround
- **Specialized work** - Route to artist with specific skills (e.g., complex embroidery)
- **Workflow routing** - Automatically assign based on decoration type
- **3-Day Tees** - Always routes to Artist 224 for DTG work

**When to Omit Artist ID:**
- Standard orders using default ShopWorks routing
- When artist assignment happens manually in OnSite
- Testing/sample orders

---

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
