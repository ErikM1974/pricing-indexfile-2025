# 3-Day Tees - API Integration Patterns

**Last Updated:** 2025-11-08
**Purpose:** Complete API endpoint specifications, request/response patterns, and error handling strategies
**Status:** Implementation Ready

---

## 📋 Quick Navigation

**Related Documentation:**
- **[Main PRD](../../3-DAY-TEES-PROJECT-REQUIREMENTS.md)** - Executive summary
- **[Overview](OVERVIEW.md)** - Architecture overview
- **[Pricing Formula](PRICING-FORMULA.md)** - Pricing calculations
- **[Inventory Integration](INVENTORY-INTEGRATION.md)** - Multi-SKU patterns
- **[Implementation Timeline](IMPLEMENTATION-TIMELINE.md)** - Development plan
- **[Business Logic](BUSINESS-LOGIC.md)** - Business rules
- **[Swagger Schema Overview](../manageorders-push/SWAGGER_OVERVIEW.md)** - Complete API schema specification (NEW)

---

## 🔌 API Endpoints Overview

| API | Endpoint | Method | Purpose | Caching |
|-----|----------|--------|---------|---------|
| **DTG Pricing** | `/api/pricing-bundle` | GET | Get PC54 DTG pricing data | 5 min |
| **Inventory** | `/api/sizes-by-style-color` | GET | Get real-time stock levels | 5 min |
| **Order Creation** | `/api/manageorders/orders/create` | POST | Submit order to ShopWorks | None |
| **File Upload** | `/api/files/upload` | POST | Upload artwork files | None |

---

## 1. DTG Pricing API

### Endpoint

```
GET /api/pricing-bundle?method=DTG&styleNumber=PC54
```

### Parameters

| Parameter | Type | Required | Example | Notes |
|-----------|------|----------|---------|-------|
| `method` | string | Yes | `DTG` | Decoration method |
| `styleNumber` | string | Yes | `PC54` | Product style number |

### Response Structure

```json
{
  "styleNumber": "PC54",
  "tiers": [
    {
      "TierLabel": "24-47",
      "MinQuantity": 24,
      "MaxQuantity": 47,
      "MarginDenominator": 0.6
    },
    {
      "TierLabel": "48-71",
      "MinQuantity": 48,
      "MaxQuantity": 71,
      "MarginDenominator": 0.6
    },
    {
      "TierLabel": "72+",
      "MinQuantity": 72,
      "MaxQuantity": 9999,
      "MarginDenominator": 0.6
    }
  ],
  "costs": [
    {
      "PrintLocationCode": "LC",
      "LocationName": "Left Chest",
      "TierLabel": "24-47",
      "PrintCost": 5.00
    },
    {
      "PrintLocationCode": "FF",
      "LocationName": "Full Front",
      "TierLabel": "24-47",
      "PrintCost": 7.00
    },
    {
      "PrintLocationCode": "FB",
      "LocationName": "Full Back",
      "TierLabel": "24-47",
      "PrintCost": 8.00
    }
  ],
  "sizes": [
    { "size": "S", "price": 4.50, "sortOrder": 1 },
    { "size": "M", "price": 4.50, "sortOrder": 2 },
    { "size": "L", "price": 4.50, "sortOrder": 3 },
    { "size": "XL", "price": 4.50, "sortOrder": 4 },
    { "size": "2XL", "price": 6.50, "sortOrder": 5 },
    { "size": "3XL", "price": 7.50, "sortOrder": 6 }
  ],
  "upcharges": {
    "S": 0,
    "M": 0,
    "L": 0,
    "XL": 0,
    "2XL": 2.00,
    "3XL": 3.00,
    "4XL": 4.00
  }
}
```

### Usage Example

```javascript
// Import service
const pricingService = new DTGPricingService();

// Fetch pricing data
const data = await pricingService.fetchBundledData('PC54');

// Calculate base DTG price (before rush fee)
const baseDTGPrice = calculateDTGPrice(data, quantity, location, size);

// Apply 25% rush fee
const rushPrice = baseDTGPrice * 1.25;

// Final rounding to half dollar
const finalPrice = Math.ceil(rushPrice * 2) / 2;
```

### Response Field Reference

**Tiers Array:**
- `TierLabel`: Display label (e.g., "24-47")
- `MinQuantity`: Minimum pieces for this tier
- `MaxQuantity`: Maximum pieces for this tier
- `MarginDenominator`: Markup denominator (0.6 = 67% markup)

**Costs Array:**
- `PrintLocationCode`: Location code (LC, FF, FB, etc.)
- `LocationName`: Human-readable location name
- `TierLabel`: Matching tier label
- `PrintCost`: Print cost for this location/tier combo

**Sizes Array:**
- `size`: Size code (S, M, L, XL, 2XL, 3XL)
- `price`: Base garment cost for this size
- `sortOrder`: Display order (1 = first)

**Upcharges Object:**
- Key = size code
- Value = additional charge for oversized (0 for standard)

---

## 2. Inventory API

### Endpoint

```
GET /api/sizes-by-style-color?styleNumber=PC54&color={catalogColor}
```

### Parameters

| Parameter | Type | Required | Example | Notes |
|-----------|------|----------|---------|-------|
| `styleNumber` | string | Yes | `PC54` | Product style number |
| `color` | string | Yes | `Forest` | CATALOG_COLOR (not COLOR_NAME) |

### Response Structure

```json
{
  "style": "PC54",
  "color": "Forest",
  "sizes": ["S", "M", "L", "XL", "2XL", "3XL"],
  "warehouses": [
    {
      "name": "Seattle, WA",
      "inventory": [50, 100, 150, 200, 75, 30],
      "total": 605
    }
  ],
  "sizeTotals": [50, 100, 150, 200, 75, 30],
  "grandTotal": 605
}
```

### Usage Example

```javascript
// Import service
const inventoryService = new SampleInventoryService();

// Fetch inventory for specific color
const inventory = await inventoryService.fetchInventoryLevels('PC54', 'Forest');

// Check if color is in stock
const inStock = inventory.grandTotal > 10;

// Get available sizes
const availableSizes = inventory.sizes;

// Check specific size availability
const largeQty = inventory.sizeTotals[inventory.sizes.indexOf('L')];
const largeAvailable = largeQty > 0;
```

### Response Field Reference

**Top-Level Fields:**
- `style`: Product style number
- `color`: CATALOG_COLOR value
- `sizes`: Array of available sizes for this color
- `grandTotal`: Total units across all sizes and warehouses

**Warehouses Array:**
- `name`: Warehouse location name
- `inventory`: Array of inventory quantities (indexed by size)
- `total`: Total units in this warehouse

**Size Totals Array:**
- Index 0 = First size in `sizes` array
- Index 1 = Second size in `sizes` array
- etc.

---

## 3. Order Creation API

### Endpoint

```
POST /api/manageorders/orders/create
```

### ⚠️ CRITICAL PATTERN

**ALWAYS use BASE part number ("PC54") - NEVER use size suffixes like "PC54_2X"**

**Why:** ShopWorks routes orders to correct SKU (PC54, PC54_2X, PC54_3X) based on SIZE field. The partNumber field should ALWAYS be the base style.

**Verified Source:** `/shared_components/js/sample-order-service.js:75-121` (expandSampleIntoLineItems function)

### Schema Validation

**Before implementing order submission, review the complete Swagger schema structure:**

📘 **[SWAGGER_OVERVIEW.md](../manageorders-push/SWAGGER_OVERVIEW.md)** - Complete API specification

**Key Schemas for 3-Day Tees:**
- **[Orders Schema](../manageorders-push/SWAGGER_REQUEST_ENVELOPE.md)** - Request envelope structure (`order_json` wrapper)
- **[ExternalOrderJson](../manageorders-push/SWAGGER_ORDER_PAYLOAD.md)** - Complete order payload (165 fields)
- **[LinesOE](../manageorders-push/SWAGGER_ORDER_PAYLOAD.md#linesoe-array-line-items)** - Line item structure with Size01-06 fields
- **[3-Day Tees Examples](../manageorders-push/SWAGGER_EXAMPLES_VALIDATION.md#scenario-2-3-day-tees-multi-sku-approach)** - Complete multi-SKU implementation

**Validation Checklist:**
- [ ] Request uses `order_json.ExternalOrderJson` envelope
- [ ] All LinesOE items use `PartNumber: "PC54"` (base style)
- [ ] Colors use CATALOG_COLOR format (e.g., "Forest" not "Forest Green")
- [ ] Dates use MM/DD/YYYY format
- [ ] Numeric fields are numbers (not strings)
- [ ] Size distribution across Size01-06 fields

### Request Structure (Simplified)

```json
{
  "orderNumber": "3DT1108-1",
  "orderDate": "2025-11-08",
  "dateNeeded": "2025-11-13",
  "salesRep": "erik@nwcustomapparel.com",
  "terms": "Net 30",
  "customer": {
    "firstName": "John",
    "lastName": "Smith",
    "email": "john@example.com",
    "phone": "253-555-1234",
    "company": "ABC Company"
  },
  "shipping": {
    "company": "ABC Company",
    "address1": "123 Main St",
    "city": "Seattle",
    "state": "WA",
    "zip": "98101",
    "country": "USA",
    "method": "UPS Ground"
  },
  "lineItems": [
    {
      "partNumber": "PC54",
      "description": "Port & Company Core Cotton Tee - 3-Day Rush",
      "color": "Forest",
      "size": "S",
      "quantity": 4,
      "price": 16.00,
      "notes": "DTG - Left Chest - 3-Day Rush Service (+25%)"
    },
    {
      "partNumber": "PC54",
      "description": "Port & Company Core Cotton Tee - 3-Day Rush",
      "color": "Forest",
      "size": "M",
      "quantity": 8,
      "price": 16.00,
      "notes": "DTG - Left Chest - 3-Day Rush Service (+25%)"
    },
    {
      "partNumber": "PC54",
      "description": "Port & Company Core Cotton Tee - 3-Day Rush",
      "color": "Forest",
      "size": "L",
      "quantity": 8,
      "price": 16.00,
      "notes": "DTG - Left Chest - 3-Day Rush Service (+25%)"
    },
    {
      "partNumber": "PC54",
      "description": "Port & Company Core Cotton Tee - 3-Day Rush",
      "color": "Forest",
      "size": "XL",
      "quantity": 2,
      "price": 16.00,
      "notes": "DTG - Left Chest - 3-Day Rush Service (+25%)"
    },
    {
      "partNumber": "PC54",
      "description": "Port & Company Core Cotton Tee - 3-Day Rush",
      "color": "Forest",
      "size": "2XL",
      "quantity": 2,
      "price": 18.00,
      "notes": "DTG - Left Chest - 3-Day Rush Service (+25%) | 2XL Upcharge: +$2.00"
    }
  ],
  "designs": [
    {
      "name": "Customer Logo - Left Chest",
      "externalKey": "upload_abc123.ai",
      "instructions": "DTG print on left chest, 3x3 inches, full color"
    }
  ],
  "notes": [
    {
      "type": "Notes On Order",
      "text": "3-DAY RUSH SERVICE - Ship within 72 hours from artwork approval. UPS Ground shipping ($30.00). Total: $457.19 (includes sales tax 10.1%)"
    }
  ]
}
```

### Line Item Generation Pattern

**Each size becomes a SEPARATE line item:**

```javascript
function createLineItems(product, sizeBreakdown) {
    const lineItems = [];

    // Iterate through size breakdown
    Object.entries(sizeBreakdown).forEach(([size, details]) => {
        if (details.quantity === 0) return; // Skip sizes with 0 quantity

        lineItems.push({
            partNumber: "PC54",              // ✅ BASE style (not "PC54_2X")
            description: "Port & Company Core Cotton Tee - 3-Day Rush",
            color: product.catalogColor,     // ✅ Use CATALOG_COLOR (e.g., "Forest")
            size: size,                      // ✅ Human-readable ("S", "M", "2XL", "3XL")
            quantity: details.quantity,      // Actual quantity for this size
            price: details.unitPrice,        // Size-specific price (includes rush + upcharge)
            notes: `DTG - ${product.location} - 3-Day Rush Service (+25%)`
        });
    });

    return lineItems;
}
```

### Response Structure

```json
{
  "success": true,
  "orderNumber": "NWCA-12345",
  "message": "Order created successfully"
}
```

### Error Handling & Fallback Strategy

```javascript
try {
    // Attempt to create order via ManageOrders API
    const response = await createOrder(orderData);
    showSuccess(`Order ${response.orderNumber} created successfully!`);

} catch (error) {
    console.error('Order creation failed:', error);

    // Fallback: Save to quote database
    const quoteID = await saveToQuoteDatabase(orderData);

    // Show user-friendly error
    showError(`Order creation failed. Saved as quote ${quoteID}. Please call 253-922-5793.`);

    // Email alert to Erik
    await emailjs.send('service_1c4k67j', 'template_error_alert', {
        error: error.message,
        quoteID: quoteID,
        customerEmail: orderData.customer.email,
        orderData: JSON.stringify(orderData, null, 2)
    });
}
```

### Quote Database Fallback Pattern

**Tables Used:**
- `quote_sessions` - Main quote record
- `quote_items` - Individual line items

```javascript
async function saveToQuoteDatabase(orderData) {
    const quoteID = generateQuoteID(); // e.g., "3DT1108-1"

    // Save quote session
    await fetch('/api/quote_sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            SessionID: quoteID,
            QuoteID: quoteID,
            DecorationType: '3-Day Tees',
            CustomerName: `${orderData.customer.firstName} ${orderData.customer.lastName}`,
            CustomerEmail: orderData.customer.email,
            CustomerPhone: orderData.customer.phone || '',
            CompanyName: orderData.customer.company || '',
            TotalAmount: orderData.total,
            Status: 'Active',
            Notes: 'ORDER FAILED - See quote items for details',
            CreatedDate: new Date().toISOString().replace(/\.\d{3}Z$/, ''),
            ModifiedDate: new Date().toISOString().replace(/\.\d{3}Z$/, '')
        })
    });

    // Save line items
    for (const item of orderData.lineItems) {
        await fetch('/api/quote_items', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                SessionID: quoteID,
                ItemType: 'Product',
                StyleNumber: item.partNumber,
                Description: item.description,
                Color: item.color,
                Size: item.size,
                Quantity: item.quantity,
                UnitPrice: item.price,
                TotalPrice: item.price * item.quantity,
                Notes: item.notes
            })
        });
    }

    return quoteID;
}
```

### Complete Schema Reference

**For production implementation, consult the complete Swagger schemas:**

📘 **[SWAGGER_OVERVIEW.md](../manageorders-push/SWAGGER_OVERVIEW.md)**

This document provides:
- Complete `ExternalOrderJson` structure (all 165 fields)
- Authentication flow (`SignIn` schema)
- Request envelope (`Orders` schema with `order_json` wrapper)
- Success/error response formats
- Complete 3-Day Tees multi-SKU examples
- Field type validation reference
- Transformation comparison (simplified → Swagger format)

**The request structure shown above is simplified.** For the actual implementation, the proxy transforms it into the full Swagger format automatically. Review the Swagger documentation to understand the complete structure and all available fields.

---

## 4. File Upload API

### Endpoint

```
POST /api/files/upload
```

### Request

**Content-Type:** `multipart/form-data`

```javascript
const formData = new FormData();
formData.append('file', artworkFile);
formData.append('orderNumber', '3DT1108-1');
formData.append('type', 'artwork');

const response = await fetch('/api/files/upload', {
  method: 'POST',
  body: formData // No headers needed - browser sets automatically
});

const result = await response.json();
```

### Response Structure

```json
{
  "success": true,
  "externalKey": "upload_abc123.ai",
  "filename": "customer-logo.ai",
  "size": 1536000,
  "type": "application/postscript"
}
```

### Response Field Reference

- `success`: Boolean indicating upload success
- `externalKey`: Unique identifier for uploaded file
- `filename`: Original filename
- `size`: File size in bytes
- `type`: MIME type of uploaded file

### Supported File Types

**Vector Formats:**
- .ai (Adobe Illustrator)
- .eps (Encapsulated PostScript)
- .svg (Scalable Vector Graphics)
- .pdf (Portable Document Format)

**Raster Formats:**
- .png (Portable Network Graphics)
- .jpg/.jpeg (JPEG)
- .tiff/.tif (Tagged Image File Format)
- .psd (Photoshop Document)

**Maximum File Size:** 20 MB per file
**Maximum Files:** Unlimited

---

## 🔧 Implementation Checklist

### Phase 1: API Integration Setup

- [ ] Import `DTGPricingService` class
- [ ] Import `SampleInventoryService` class
- [ ] Import `SampleOrderService` class
- [ ] Configure API base URLs
- [ ] Set up error handling utilities

### Phase 2: Pricing Integration

- [ ] Fetch pricing bundle on page load
- [ ] Parse tier data
- [ ] Parse print location costs
- [ ] Parse size upcharges
- [ ] Implement 7-step pricing formula
- [ ] Add 25% rush fee modifier
- [ ] Test with all quantity tiers

### Phase 3: Inventory Integration

- [ ] Fetch inventory on color selection
- [ ] Query all 3 SKUs (PC54, PC54_2X, PC54_3X)
- [ ] Combine inventory results
- [ ] Display stock status badges
- [ ] Update inventory after order submission
- [ ] Implement 5-minute cache

### Phase 4: Order Submission

- [ ] Build line items from size breakdown
- [ ] Use BASE part number ("PC54")
- [ ] Use CATALOG_COLOR for color field
- [ ] Include design/file references
- [ ] Add order notes with rush service details
- [ ] Implement error handling
- [ ] Implement quote database fallback
- [ ] Send email notifications

### Phase 5: File Upload

- [ ] Create file upload UI
- [ ] Validate file types and sizes
- [ ] Show upload progress
- [ ] Handle upload errors
- [ ] Link uploaded files to order

---

**Documentation Type:** API Integration Reference
**Parent Document:** [3-DAY-TEES-PROJECT-REQUIREMENTS.md](../../3-DAY-TEES-PROJECT-REQUIREMENTS.md)
**Related Docs:** All files in [/memory/3-day-tees/](.)
