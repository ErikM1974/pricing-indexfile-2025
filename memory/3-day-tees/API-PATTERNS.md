# 3-Day Tees - API Integration Patterns

**Last Updated:** 2025-11-20
**Purpose:** Complete API endpoint specifications, request/response patterns, and error handling strategies
**Status:** Implementation Complete - Ready for Testing

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

## 2.5. Bulk Inventory API (Multi-Color Loads)

**⚠️ CRITICAL: Different response structure than individual inventory endpoint**

### Endpoint

```
GET /api/manageorders/bulk-inventory?colors={color1},{color2},{color3}...
```

### Parameters

| Parameter | Type | Required | Example | Notes |
|-----------|------|----------|---------|-------|
| `colors` | string | Yes | `Jet Black,Navy,White` | Comma-separated CATALOG_COLOR values (URL encoded) |

**Example URL:**
```
GET /api/manageorders/bulk-inventory?colors=Jet%20Black,Navy,White,Dk%20Hthr%20Grey,Ath%20Heather
```

### Response Structure

**⚠️ CRITICAL DIFFERENCE:** Bulk endpoint returns nested object structure, NOT the same format as individual endpoint.

```json
{
  "colors": {
    "Jet Black": {
      "sizes": {
        "S": 4,
        "M": 10,
        "L": 11,
        "XL": 79,
        "2XL": 27,
        "3XL": 6
      },
      "total": 137,
      "skus": [
        {
          "PartNumber": "PC54",
          "Color": "Jet Black",
          "Size01": 4,
          "Size02": 10,
          "Size03": 11,
          "Size04": 79
        },
        {
          "PartNumber": "PC54_2X",
          "Color": "Jet Black",
          "Size05": 27
        },
        {
          "PartNumber": "PC54_3X",
          "Color": "Jet Black",
          "Size06": 6
        }
      ]
    },
    "Navy": {
      "sizes": { /* same structure */ },
      "total": 144,
      "skus": [ /* same structure */ ]
    }
    /* ...other colors */
  }
}
```

### Key Differences from Individual Endpoint

| Feature | Individual (`/sizes-by-style-color`) | Bulk (`/bulk-inventory`) |
|---------|-------------------------------------|--------------------------|
| **Response Root** | Direct object with data | Nested under `colors.{colorName}` |
| **Sizes Field** | `response.sizes` (array) | `response.colors[colorName].sizes` (object with counts) |
| **Access Pattern** | `response.grandTotal` | `response.colors[colorName].total` |
| **SKU Data** | Separate fields (`standardData`, `twoXLData`, `threeXLData`) | Single `skus` array |
| **Size Values** | Array of size names | Object with size counts |

### Critical Parsing Pattern

**❌ WRONG - Uses individual endpoint structure:**
```javascript
// This pattern ONLY works for individual endpoint
const inventory = await fetch(`/api/sizes-by-style-color?styleNumber=PC54&color=Forest`);
const data = await inventory.json();
const sizeInventory = {
    'S': data.standardData?.result?.[0]?.Size01 || 0,  // ✅ Works for individual
    'M': data.standardData?.result?.[0]?.Size02 || 0
};
```

**❌ WRONG - Tries to use individual structure on bulk endpoint:**
```javascript
// This FAILS silently - returns all zeros
const bulkResponse = await fetch(`/api/manageorders/bulk-inventory?colors=Forest`);
const bulkData = await bulkResponse.json();
const colorData = bulkData.colors['Forest'];

const sizeInventory = {
    'S': colorData.standardData?.result?.[0]?.Size01 || 0,  // ❌ undefined → 0
    'M': colorData.standardData?.result?.[0]?.Size02 || 0   // ❌ undefined → 0
};
// Result: {S: 0, M: 0, L: 0, XL: 0, 2XL: 0, 3XL: 0} despite correct data exists
```

**✅ CORRECT - Uses bulk endpoint structure:**
```javascript
// This WORKS - accesses correct fields
const bulkResponse = await fetch(`/api/manageorders/bulk-inventory?colors=Forest`);
const bulkData = await bulkResponse.json();
const colorData = bulkData.colors['Forest'];

const sizeInventory = {
    'S': colorData.sizes?.S || 0,           // ✅ 50 units
    'M': colorData.sizes?.M || 0,           // ✅ 100 units
    'L': colorData.sizes?.L || 0,           // ✅ 150 units
    'XL': colorData.sizes?.XL || 0,         // ✅ 200 units
    '2XL': colorData.sizes?.['2XL'] || 0,   // ✅ 75 units
    '3XL': colorData.sizes?.['3XL'] || 0    // ✅ 30 units
};
```

### Usage Example

```javascript
// Fetch inventory for multiple colors simultaneously
async function loadAllColorInventory() {
    const colors = ['Jet Black', 'Navy', 'White', 'Dk Hthr Grey', 'Ath Heather'];
    const encodedColors = colors.map(c => encodeURIComponent(c)).join(',');

    const response = await fetch(
        `/api/manageorders/bulk-inventory?colors=${encodedColors}`
    );
    const data = await response.json();

    // Process each color
    colors.forEach(colorName => {
        const colorData = data.colors[colorName];

        if (!colorData) {
            console.warn(`No data for color: ${colorName}`);
            return;
        }

        // ✅ Correct access pattern for bulk endpoint
        const sizeInventory = {
            'S': colorData.sizes?.S || 0,
            'M': colorData.sizes?.M || 0,
            'L': colorData.sizes?.L || 0,
            'XL': colorData.sizes?.XL || 0,
            '2XL': colorData.sizes?.['2XL'] || 0,
            '3XL': colorData.sizes?.['3XL'] || 0
        };

        // Cache with correct structure
        state.inventoryCache[colorName] = {
            total: colorData.total,
            sizeInventory: sizeInventory,
            skus: colorData.skus,  // ✅ Use actual bulk API field
            timestamp: Date.now()
        };
    });
}
```

### When to Use Bulk vs Individual

| Scenario | Use Endpoint | Reason |
|----------|--------------|--------|
| **Initial page load (5 colors)** | Bulk | One API call instead of 5 |
| **User switches color** | Cache first, then individual if miss | Faster UX with caching |
| **Single color update** | Individual | Less data transfer for one color |
| **Background refresh** | Bulk | Efficiently update all colors at once |

### Performance Benefits

**Individual Endpoint (5 separate calls):**
```javascript
// 5 separate API calls
await fetch('/api/sizes-by-style-color?styleNumber=PC54&color=Jet%20Black');
await fetch('/api/sizes-by-style-color?styleNumber=PC54&color=Navy');
await fetch('/api/sizes-by-style-color?styleNumber=PC54&color=White');
await fetch('/api/sizes-by-style-color?styleNumber=PC54&color=Dk%20Hthr%20Grey');
await fetch('/api/sizes-by-style-color?styleNumber=PC54&color=Ath%20Heather');
// Total: 5 API requests, ~2-3 seconds
```

**Bulk Endpoint (1 call):**
```javascript
// 1 API call gets all 5 colors
await fetch('/api/manageorders/bulk-inventory?colors=Jet%20Black,Navy,White,Dk%20Hthr%20Grey,Ath%20Heather');
// Total: 1 API request, ~0.8-1.2 seconds
```

### Error Handling

```javascript
async function loadBulkInventorySafely(colors) {
    try {
        const encodedColors = colors.map(c => encodeURIComponent(c)).join(',');
        const response = await fetch(`/api/manageorders/bulk-inventory?colors=${encodedColors}`);

        if (!response.ok) {
            throw new Error(`Bulk inventory API failed: ${response.status}`);
        }

        const data = await response.json();

        // Validate response structure
        if (!data.colors || typeof data.colors !== 'object') {
            throw new Error('Invalid bulk inventory response structure');
        }

        // Process each color, handling missing data gracefully
        colors.forEach(colorName => {
            const colorData = data.colors[colorName];

            if (!colorData) {
                console.warn(`[Bulk Inventory] No data returned for color: ${colorName}`);
                state.inventoryCache[colorName] = {
                    total: 0,
                    sizeInventory: { S: 0, M: 0, L: 0, XL: 0, '2XL': 0, '3XL': 0 },
                    skus: [],
                    timestamp: Date.now()
                };
                return;
            }

            // ✅ Safe access with fallbacks
            const sizeInventory = {
                'S': colorData.sizes?.S || 0,
                'M': colorData.sizes?.M || 0,
                'L': colorData.sizes?.L || 0,
                'XL': colorData.sizes?.XL || 0,
                '2XL': colorData.sizes?.['2XL'] || 0,
                '3XL': colorData.sizes?.['3XL'] || 0
            };

            state.inventoryCache[colorName] = {
                total: colorData.total || 0,
                sizeInventory: sizeInventory,
                skus: colorData.skus || [],
                timestamp: Date.now()
            };
        });

        return true;

    } catch (error) {
        console.error('[Bulk Inventory] Error:', error);

        // Fallback to individual calls on bulk failure
        console.log('[Bulk Inventory] Falling back to individual calls');
        for (const colorName of colors) {
            await loadIndividualColorInventory(colorName);
        }

        return false;
    }
}
```

### Common Mistakes

1. **Accessing wrong fields** - Using `standardData` instead of `sizes`
2. **Wrong cache structure** - Storing individual endpoint structure when using bulk
3. **No error handling** - Not handling missing colors gracefully
4. **No fallback** - Not falling back to individual calls when bulk fails
5. **Wrong size access** - Using array index instead of object key access

**Related Documentation:** See [Inventory Integration Guide](INVENTORY-INTEGRATION.md#bulk-api-response-structure-multi-color-loads) for complete cache patterns and debugging.

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

### Phase 1: API Integration Setup ✅ COMPLETE

- [x] Import `DTGPricingService` class
- [x] Import `SampleInventoryService` class
- [x] Import `SampleOrderService` class
- [x] Configure API base URLs
- [x] Set up error handling utilities

### Phase 2: Pricing Integration ✅ COMPLETE

- [x] Fetch pricing bundle on page load
- [x] Parse tier data
- [x] Parse print location costs
- [x] Parse size upcharges
- [x] Implement 7-step pricing formula
- [x] Add 25% rush fee modifier
- [x] Test with all quantity tiers

### Phase 3: Inventory Integration ✅ COMPLETE

- [x] Fetch inventory on color selection
- [x] Query all 3 SKUs (PC54, PC54_2X, PC54_3X)
- [x] Combine inventory results
- [x] Display stock status badges
- [x] Update inventory after order submission
- [x] Implement 5-minute cache

### Phase 4: Order Submission ✅ COMPLETE

- [x] Build line items from size breakdown
- [x] Use BASE part number ("PC54")
- [x] Use CATALOG_COLOR for color field
- [x] Include design/file references
- [x] Add order notes with rush service details
- [x] Implement error handling
- [x] Implement quote database fallback
- [x] Send email notifications

### Phase 5: File Upload ✅ COMPLETE

- [x] Create file upload UI
- [x] Validate file types and sizes
- [x] Show upload progress
- [x] Handle upload errors
- [x] Link uploaded files to order

---

## 🛠️ Debugging & Performance Monitoring

The 3-Day Tees implementation includes a comprehensive debug toolkit (`/pages/js/3-day-tees-debug.js`) that provides API monitoring capabilities:

### API Performance Tracking

The performance monitor automatically tracks all API calls:

```javascript
// Access performance metrics in browser console (DEV mode only)
ThreeDayDebug.performance.summary()

// View detailed API call history
ThreeDayDebug.performance.apiCalls

// Monitor specific API endpoints
ThreeDayDebug.performance.getApiMetrics('/api/pricing-bundle')
ThreeDayDebug.performance.getApiMetrics('/api/manageorders/inventorylevels')
```

**Metrics Tracked:**
- API call count per endpoint
- Average response time
- Success/failure rates
- Cache hit rates (for inventory)
- Total time spent in API calls

### Real-Time API Debugging

Console logging provides detailed API debugging information:

```javascript
// Pricing API
[3-Day Tees] Fetching DTG pricing for PC54...
[DTG Pricing] API Response: {tierData: {...}, locations: [...]}

// Inventory API
[3-Day Tees] Loading inventory for color: "Forest"
[3-Day Tees] ✓ Cached inventory for Forest: 605 units

// Order Submission API
[3-Day Tees] Submitting order to ManageOrders API...
[3-Day Tees] ✓ Order created: NWCA-1120-1234
```

**Complete Debug Toolkit Documentation:** See [OVERVIEW.md](OVERVIEW.md#developer-tools-6-components) for full debug console reference

---

**Documentation Type:** API Integration Reference
**Parent Document:** [3-DAY-TEES-PROJECT-REQUIREMENTS.md](../../3-DAY-TEES-PROJECT-REQUIREMENTS.md)
**Related Docs:** All files in [/memory/3-day-tees/](.)
