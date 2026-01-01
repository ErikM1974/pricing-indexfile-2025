# Sample Inventory Integration Guide

**Last Updated:** 2025-11-02
**Purpose:** Complete guide for implementing Sanmar vendor inventory checks on any product page
**Status:** Production-ready based on real implementation and testing

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Critical Concepts](#critical-concepts)
3. [Implementation Checklist](#implementation-checklist)
4. [Code Patterns](#code-patterns)
5. [Common Issues & Solutions](#common-issues--solutions)
6. [Testing Procedures](#testing-procedures)
7. [API Reference](#api-reference)
8. [Real-World Examples](#real-world-examples)

---

## 🎯 Overview

### What is the Sample Inventory System?

The **Sample Inventory System** checks real-time Sanmar vendor inventory levels before allowing customers to order samples. This prevents orders for out-of-stock items.

**Key Components:**
- **Data Source:** Sanmar vendor inventory (via Caspio API)
- **Caching:** 5-minute client-side cache (sessionStorage)
- **Coverage:** All Sanmar products with style number + color
- **Integration Points:** Product pages, sample cart, checkout

### Architecture

```
Product Page → Store CATALOG_COLOR → Cart → Inventory Service → Caspio API → Sanmar Inventory
     ↓              ↓                  ↓            ↓              ↓              ↓
  User selects   Correct format   Check stock  Query API   Get real-time  Display badge
   color/size      stored        before display  with color    inventory    (In Stock/Out)
```

### When to Use Inventory Checks

✅ **Use inventory checks for:**
- Sample cart items (paid and free samples)
- Product pages with "Add to Cart" buttons
- Showcase pages with quick-add functionality
- Any page where users select products for sampling

❌ **Don't use inventory checks for:**
- Quote builders (production orders, not samples)
- Informational product displays (no cart interaction)
- Products not available through Sanmar

---

## 🔑 Critical Concepts

### 1. Two Color Field System (MOST CRITICAL)

**This is the #1 cause of inventory check failures.**

Every product has TWO color fields:

| Field | Purpose | Example | Used For |
|-------|---------|---------|----------|
| **COLOR_NAME** | Display to users | "Brilliant Orange" | UI, user-facing text |
| **CATALOG_COLOR** | API queries | "BrillOrng" | Inventory API, database queries |

**Why Two Fields?**
- Sanmar's inventory system uses abbreviated, no-space format
- Users expect full, readable color names
- Caspio stores both formats from vendor data

**Critical Rule:**
```javascript
// ❌ WRONG - Will fail inventory checks
cartItem.catalogColor = product.COLOR_NAME;  // "Cool Grey"

// ✅ CORRECT - Works with inventory API
cartItem.catalogColor = product.CATALOG_COLOR;  // "CoolGrey"
```

### 2. API Endpoint Structure

**Endpoint:**
```
GET /api/sizes-by-style-color?styleNumber={style}&color={catalogColor}
```

**Response Structure:**
```json
{
  "style": "NKDC1963",
  "color": "BrillOrng",
  "sizes": ["XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL"],
  "warehouses": [
    {
      "name": "Seattle, WA",
      "inventory": [286, 893, 1573, 4294, 2417, 1780, 524, 192],
      "total": 11959
    }
  ],
  "sizeTotals": [286, 893, 1573, 4294, 2417, 1780, 524, 192],
  "grandTotal": 11959
}
```

**Important:** API returns an **object with properties**, not a direct array.

### 3. Size Availability by Color

**Key Insight:** Different colors have different size availability.

**Example: Nike NKDC1963**
- **Brilliant Orange:** Only standard sizes (XS-4XL)
- **Cool Grey:** Has tall sizes (LT, XLT, 2XLT, 3XLT, 4XLT)
- **Blue Tint:** Has tall sizes
- **Anthracite:** Has tall sizes

**Impact:** Size selector must update dynamically when user changes colors.

### 4. Inventory Service Architecture

**File:** `shared_components/js/sample-inventory-service.js`

**Class:** `SampleInventoryService`

**Key Methods:**
- `fetchInventoryLevels(styleNumber, colorName)` - Get inventory for style+color
- `checkSizeAvailability(styleNumber, colorName, size, qty)` - Check specific size
- `checkCartInventory(samples)` - Bulk check for cart items
- `validateCheckout(samples)` - Pre-checkout validation

**Cache Strategy:**
- 5-minute TTL (matches API cache)
- Stored in sessionStorage
- Automatic cleanup on expiration

---

## ✅ Implementation Checklist

### Phase 1: Product Data Setup

- [ ] Verify product data includes both COLOR_NAME and CATALOG_COLOR
- [ ] Test API endpoint with CATALOG_COLOR values
- [ ] Confirm available sizes vary by color

### Phase 2: Product Page Integration

- [ ] **Store CATALOG_COLOR in cart items** (CRITICAL)
  ```javascript
  const cartItem = {
      style: styleNumber,
      color: product.COLOR_NAME,        // Display name
      catalogColor: product.CATALOG_COLOR,  // ✅ API name
      // ... other fields
  };
  ```

- [ ] **Filter size selector by color availability**
  ```javascript
  const response = await fetch(
      `/api/sizes-by-style-color?styleNumber=${style}&color=${catalogColor}`
  );
  const data = await response.json();
  const availableSizes = data.sizes || [];  // ✅ Extract array
  ```

- [ ] **Update sizes when color changes**
  ```javascript
  function selectColor(colorIndex) {
      selectedColorIndex = colorIndex;
      updateSizeSelector();  // Re-fetch sizes for new color
  }
  ```

### Phase 3: Cart Page Integration

- [ ] Load inventory service script
  ```html
  <script src="/shared_components/js/sample-inventory-service.js"></script>
  ```

- [ ] Check inventory on cart load
  ```javascript
  const cartItems = getCartSamples();
  const withInventory = await window.sampleInventoryService.checkCartInventory(cartItems);
  ```

- [ ] Display inventory badges
  ```javascript
  // Status options: 'in_stock', 'low_stock', 'out_of_stock', 'unknown'
  const badge = item.inventoryStatus === 'in_stock'
      ? '<span class="badge bg-success">In Stock</span>'
      : '<span class="badge bg-danger">Out of Stock</span>';
  ```

### Phase 4: Testing

- [ ] Test with products that have tall sizes
- [ ] Test with products that don't have tall sizes
- [ ] Test color switching updates size selector
- [ ] Test cart shows accurate inventory badges
- [ ] Test with multiple products in cart
- [ ] Test cache behavior (5-minute TTL)

---

## 💻 Code Patterns

### Pattern 1: Product Page - Add to Cart

**File:** `pages/top-sellers-product.html` (line 1727)

```javascript
function addSampleToCart() {
    const product = currentProducts[selectedColorIndex];

    const cartItem = {
        style: params.style,
        name: params.name,
        color: product.COLOR_NAME,           // ✅ Display name for UI
        catalogColor: product.CATALOG_COLOR, // ✅ API name for inventory
        imageUrl: product.FRONT_MODEL || product.FRONT_FLAT || '',
        sizes: selectedSamples,
        type: params.sampleType,
        price: parseFloat(params.price),
        sampleType: params.sampleType,
        addedAt: new Date().toISOString(),
        upcharges: pricingData?.pricing?.upcharges || {}
    };

    addToCart(cartItem);
}
```

**Critical:** Both fields must be included!

### Pattern 2: Size Selector - Filter by Color

**File:** `pages/top-sellers-product.html` (lines 1534-1549)

```javascript
async function populateSizeQuantityGrid() {
    const params = getUrlParams();
    const gridContainer = document.getElementById('sizeQuantityGrid');

    // Get current color (CATALOG_COLOR format)
    const currentColor = currentProducts[selectedColorIndex]?.CATALOG_COLOR || '';

    try {
        // Fetch color-specific sizes
        const response = await fetch(
            `https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/sizes-by-style-color?styleNumber=${params.style}&color=${encodeURIComponent(currentColor)}`
        );

        if (response.ok) {
            const data = await response.json();
            const sizes = data.sizes || [];  // ✅ Extract array from object

            if (!Array.isArray(sizes) || sizes.length === 0) {
                console.warn(`No sizes for ${params.style} ${currentColor}`);
                displayStandardSizes(gridContainer);
                return;
            }

            console.log(`Received ${sizes.length} sizes for ${currentColor}:`, sizes);

            // Sort and display sizes
            displaySizes(gridContainer, sortSizes(sizes));
        }
    } catch (error) {
        console.error('Error fetching sizes:', error);
        displayStandardSizes(gridContainer);
    }
}
```

**Key Points:**
- Uses `CATALOG_COLOR` for API query
- Extracts `data.sizes` from response (not direct array)
- Includes fallback for errors

### Pattern 3: Cart - Check Inventory

**File:** `pages/sample-cart.html` (lines 1388-1415)

```javascript
async function loadCart() {
    let cart = getCartSamples();

    // Check inventory for all cart items
    console.log('[Sample Cart] Checking inventory for cart items...');

    const cartWithInventory = await window.sampleInventoryService.checkCartInventory(cart);

    console.log('[Sample Cart] ✓ Inventory check complete');

    // Save updated cart with inventory status
    sessionStorage.setItem('sampleCart', JSON.stringify({
        samples: cartWithInventory,
        timestamp: new Date().toISOString()
    }));

    // Display cart items with badges
    displayCart(cartWithInventory);
}
```

**Result:** Each cart item gets inventory status properties:
```javascript
{
    // ... existing item fields
    inventoryStatus: 'in_stock',        // 'in_stock', 'low_stock', 'out_of_stock', 'unknown'
    inventoryMessage: 'All sizes in stock',
    sizeAvailability: {                 // Per-size details
        'S': { available: true, qtyInStock: 893, hasRecord: true, isLowStock: false },
        'M': { available: true, qtyInStock: 1573, hasRecord: true, isLowStock: false }
    },
    allAvailable: true,
    hasWarnings: false,
    lastInventoryCheck: '2025-11-02T16:04:59.572Z'
}
```

### Pattern 4: Display Inventory Badges

```javascript
function getInventoryBadge(item) {
    if (!item.inventoryStatus) {
        return '<span class="badge bg-secondary">Checking...</span>';
    }

    switch (item.inventoryStatus) {
        case 'in_stock':
            return '<span class="badge bg-success"><i class="fas fa-check-circle"></i> In Stock</span>';
        case 'low_stock':
            return '<span class="badge bg-warning"><i class="fas fa-exclamation-triangle"></i> Low Stock</span>';
        case 'out_of_stock':
            return '<span class="badge bg-danger"><i class="fas fa-times-circle"></i> Out of Stock</span>';
        default:
            return '<span class="badge bg-secondary"><i class="fas fa-question-circle"></i> Unable to Verify</span>';
    }
}
```

---

## 🚨 Common Issues & Solutions

### Issue 1: "Unable to Verify" Badges on In-Stock Products

**Symptoms:**
- Cart shows "Unable to Verify" badge
- Console shows 404 errors from inventory API
- Products have plenty of inventory in Sanmar system

**Root Cause:**
Using `COLOR_NAME` instead of `CATALOG_COLOR` for API queries.

**Example:**
```javascript
// ❌ WRONG (causes 404)
fetch(`/api/sizes-by-style-color?styleNumber=NKDC1963&color=Cool Grey`)
// API looks for "Cool Grey" → Not found

// ✅ CORRECT (returns data)
fetch(`/api/sizes-by-style-color?styleNumber=NKDC1963&color=CoolGrey`)
// API finds "CoolGrey" → Returns inventory
```

**Solution:**
1. **Find where cart items are created** (usually product page)
2. **Change to use CATALOG_COLOR:**
   ```javascript
   // In addToCart or similar function
   catalogColor: product.CATALOG_COLOR  // ✅ Not COLOR_NAME
   ```
3. **Test with multiple colors** to verify fix works universally

**Files to Check:**
- `pages/top-sellers-product.html` - Line 1732
- `pages/top-sellers-showcase.html` - Line 257
- Any custom product pages

---

### Issue 2: Size Selector Shows Wrong Sizes for Color

**Symptoms:**
- Brilliant Orange shows tall sizes (LT, XLT, etc.)
- Those tall sizes don't exist in inventory
- Cart shows "Out of Stock" even though standard sizes are available

**Root Cause:**
Size selector shows ALL possible sizes for the style, not color-specific sizes.

**Solution:**
1. **Query API per color:**
   ```javascript
   const response = await fetch(
       `/api/sizes-by-style-color?styleNumber=${style}&color=${catalogColor}`
   );
   const data = await response.json();
   const sizes = data.sizes || [];  // Color-specific sizes
   ```

2. **Update size selector when color changes:**
   ```javascript
   function selectColor(colorIndex) {
       selectedColorIndex = colorIndex;
       populateSizeQuantityGrid();  // Re-fetch sizes
   }
   ```

**Real Example:**
- NKDC1963 Brilliant Orange: `["XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL"]` (8 sizes)
- NKDC1963 Anthracite: `["XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL", "LT", "XLT", "2XLT", "3XLT", "4XLT"]` (13 sizes)

---

### Issue 3: API Returns No Sizes (Fallback to Standard)

**Symptoms:**
- Console shows: `[SizeGrid] No sizes returned, using fallback`
- Size selector shows generic sizes instead of actual sizes
- Happens for EVERY color

**Root Cause:**
Incorrect API response parsing - expecting array but API returns object.

**Wrong Code:**
```javascript
const sizes = await response.json();  // This is an object!
if (!Array.isArray(sizes)) {          // Object is not array → false
    // Fallback triggered incorrectly
}
```

**Correct Code:**
```javascript
const data = await response.json();    // Get full object
const sizes = data.sizes || [];        // Extract sizes array
if (!Array.isArray(sizes)) {           // Now checking actual array
    // Only fallback if sizes truly missing
}
```

**Solution:**
- **File:** `pages/top-sellers-product.html` (lines 1539-1540)
- **Change:** Add extraction step to get `sizes` array from response object

---

### Issue 4: Cart Inventory Not Updating

**Symptoms:**
- Add item to cart
- Cart shows old inventory status
- Refresh doesn't help

**Root Cause:**
Client-side cache or cart not re-checking inventory.

**Solutions:**

**Option 1: Clear Cache**
```javascript
window.sampleInventoryService.clearCache();
location.reload();
```

**Option 2: Force Refresh**
```javascript
// In cart page
const cartWithInventory = await window.sampleInventoryService.checkCartInventory(cart);
```

**Option 3: Check Cache TTL**
- Cache expires after 5 minutes
- If checking within 5 minutes, will use cached data
- This is intentional for performance

---

### Issue 5: Multi-SKU Bulk API Response Parsing (CRITICAL)

**Symptoms:**
- Size inventory displays "0 units" for all sizes
- Console shows correct API responses with inventory data
- Individual color loads work, but multi-color bulk loads fail
- No JavaScript errors in console (silent failure)

**Root Cause:**
Bulk inventory endpoint (`/api/manageorders/bulk-inventory`) has different response structure than individual endpoint (`/api/sizes-by-style-color`). Code attempts to access fields from individual endpoint structure that don't exist in bulk response.

**Wrong Code:**
```javascript
// Tries to use individual endpoint structure on bulk API response
const bulkResponse = await fetch(`/api/manageorders/bulk-inventory?colors=Forest,Navy`);
const bulkData = await bulkResponse.json();
const colorData = bulkData.colors['Forest'];

const sizeInventory = {
    'S': colorData.standardData?.result?.[0]?.Size01 || 0,   // ❌ undefined → 0
    'M': colorData.standardData?.result?.[0]?.Size02 || 0,   // ❌ undefined → 0
    'L': colorData.standardData?.result?.[0]?.Size03 || 0,   // ❌ undefined → 0
    'XL': colorData.standardData?.result?.[0]?.Size04 || 0,  // ❌ undefined → 0
    '2XL': colorData.twoXLData?.result?.[0]?.Size05 || 0,    // ❌ undefined → 0
    '3XL': colorData.threeXLData?.result?.[0]?.Size06 || 0   // ❌ undefined → 0
};
// Result: {S: 0, M: 0, L: 0, XL: 0, 2XL: 0, 3XL: 0} despite API returning correct data
```

**Correct Code:**
```javascript
// Uses bulk endpoint structure correctly
const bulkResponse = await fetch(`/api/manageorders/bulk-inventory?colors=Forest,Navy`);
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

**Why This Was Difficult to Debug:**
1. Individual color loads worked (different API structure) - created false sense of working code
2. Only bulk endpoint failed - intermittent symptoms based on code path
3. Optional chaining (`?.`) masked errors silently - no console errors thrown
4. Console showed "correct" API responses - data looked good, parsing was wrong
5. API response structure difference was subtle and not immediately obvious

**Solution:**

1. **Verify which endpoint you're using:**
   ```javascript
   // Individual endpoint structure
   const individualData = await fetch(`/api/sizes-by-style-color?styleNumber=PC54&color=Forest`);
   // Access: data.sizes (array), data.grandTotal, data.sizeTotals

   // Bulk endpoint structure
   const bulkData = await fetch(`/api/manageorders/bulk-inventory?colors=Forest,Navy`);
   // Access: data.colors[colorName].sizes (object), data.colors[colorName].total
   ```

2. **Use correct field paths for bulk API:**
   ```javascript
   // Bulk API response has this structure:
   // {
   //   colors: {
   //     "Forest": {
   //       sizes: { S: 50, M: 100, L: 150, ... },  ← Object with counts
   //       total: 605,
   //       skus: [...]
   //     }
   //   }
   // }
   ```

3. **Cross-reference detailed documentation:**
   - Complete bulk API documentation: `memory/3-day-tees/API-PATTERNS.md` § 2.5
   - Multi-SKU inventory patterns: `memory/3-day-tees/INVENTORY-INTEGRATION.md` § "Bulk API Response Structure"
   - Pitfall reference: `memory/3-day-tees/INVENTORY-INTEGRATION.md` § "Pitfall 4"

**Verification Console Commands:**
```javascript
// Test bulk API structure
fetch('/api/manageorders/bulk-inventory?colors=Forest')
    .then(r => r.json())
    .then(data => {
        console.log('Bulk API structure:', {
            hasColorsObject: 'colors' in data,
            firstColor: Object.keys(data.colors)[0],
            hasSizesObject: 'sizes' in data.colors['Forest'],
            sizesStructure: typeof data.colors['Forest'].sizes,  // "object"
            sampleSize: data.colors['Forest'].sizes?.S           // Should be number
        });
    });

// Compare with individual API structure
fetch('/api/sizes-by-style-color?styleNumber=PC54&color=Forest')
    .then(r => r.json())
    .then(data => {
        console.log('Individual API structure:', {
            hasSizesArray: Array.isArray(data.sizes),  // true
            hasGrandTotal: 'grandTotal' in data,       // true
            firstSize: data.sizes?.[0]                  // "S"
        });
    });
```

**Prevention:**
- Always inspect API response structure before accessing nested properties
- Don't assume bulk and individual endpoints return same structure
- Test both single-color and multi-color load paths
- Add console.log() to verify actual API response shape during development

---

### Issue 6: Console Errors About Missing Service

**Symptoms:**
```
Uncaught TypeError: Cannot read property 'checkCartInventory' of undefined
```

**Root Cause:**
Inventory service script not loaded or failed to initialize.

**Solution:**

1. **Check script tag exists:**
   ```html
   <script src="/shared_components/js/sample-inventory-service.js"></script>
   ```

2. **Verify service initialized:**
   ```javascript
   console.log(window.sampleInventoryService);
   // Should show SampleInventoryService object
   ```

3. **Wait for DOM ready:**
   ```javascript
   document.addEventListener('DOMContentLoaded', async function() {
       // Now safe to use inventory service
       const cart = await window.sampleInventoryService.checkCartInventory(items);
   });
   ```

---

## 🧪 Testing Procedures

### Test Case 1: CATALOG_COLOR Verification

**Purpose:** Verify cart stores correct color format

**Steps:**
1. Go to product page: `NKDC1963`
2. Select color: "Brilliant Orange"
3. Add to cart
4. Open console and run:
   ```javascript
   const cart = JSON.parse(sessionStorage.getItem('sampleCart'));
   console.log(cart.samples[0].catalogColor);
   ```

**Expected:** `"BrillOrng"` (not "Brilliant Orange")

**If Wrong:** Check line where cart items are created (top-sellers-product.html:1732)

---

### Test Case 2: Color-Specific Sizes

**Purpose:** Verify size selector updates per color

**Product:** NKDC1963 (has both standard and tall sizes in different colors)

**Steps:**
1. Go to product page
2. Select "Brilliant Orange"
3. Note sizes shown: Should be XS, S, M, L, XL, 2XL, 3XL, 4XL (8 sizes)
4. Select "Anthracite"
5. Note sizes shown: Should include tall sizes (LT, XLT, etc.) - 13 sizes

**Console Verification:**
```javascript
// Should see logs like:
[SizeGrid] Style NKDC1963, Color BrillOrng: Received 8 color-specific sizes
[SizeGrid] Style NKDC1963, Color Anthracite: Received 13 color-specific sizes
```

**If Wrong:** Check populateSizeQuantityGrid() function

---

### Test Case 3: Cart Inventory Badges

**Purpose:** Verify inventory checks work in cart

**Steps:**
1. Add multiple products to cart:
   - NKDC1963 Brilliant Orange
   - C112 Flame Red/Black
   - Any other product
2. Go to sample cart page
3. Verify badges appear:
   - Should show "In Stock" (green) for available items
   - Should show "Out of Stock" (red) for unavailable items

**Console Verification:**
```javascript
// Should see logs like:
[SampleInventory] Checking inventory for 3 samples...
[SampleInventory] ✓ Processed sample 0, status: in_stock
[SampleInventory] ✓ Processed sample 1, status: in_stock
[SampleInventory] ✓ Check complete
```

**If Shows "Unable to Verify":**
- Check console for 404 errors
- Verify catalogColor field exists in cart items
- Verify catalogColor uses CATALOG_COLOR format

---

### Test Case 4: API Response Structure

**Purpose:** Verify API returns expected format

**Console Command:**
```javascript
fetch('https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/sizes-by-style-color?styleNumber=NKDC1963&color=BrillOrng')
    .then(r => r.json())
    .then(data => {
        console.log('Response structure:', {
            hasStyle: 'style' in data,
            hasColor: 'color' in data,
            hasSizes: 'sizes' in data,
            hasWarehouses: 'warehouses' in data,
            sizesIsArray: Array.isArray(data.sizes),
            sizeCount: data.sizes?.length,
            firstSize: data.sizes?.[0],
            grandTotal: data.grandTotal
        });
    });
```

**Expected Output:**
```javascript
{
    hasStyle: true,
    hasColor: true,
    hasSizes: true,
    hasWarehouses: true,
    sizesIsArray: true,
    sizeCount: 8,
    firstSize: "XS",
    grandTotal: 11959
}
```

---

### Test Case 5: Cache Behavior

**Purpose:** Verify 5-minute cache works correctly

**Steps:**
1. Add item to cart (triggers inventory check)
2. Wait 1 minute
3. Refresh cart page
4. Check console

**Expected:** `[SampleInventory] ✓ Using cached data for NKDC1963_BrillOrng`

**Then:**
1. Wait 5+ minutes
2. Refresh cart page

**Expected:** `[SampleInventory] Fetching Sanmar inventory for NKDC1963 BrillOrng...`

**Manual Cache Clear:**
```javascript
window.sampleInventoryService.clearCache();
```

---

## 📚 API Reference

### Endpoint: Get Sizes by Style and Color

**URL:** `GET /api/sizes-by-style-color`

**Base URL:** `https://caspio-pricing-proxy-ab30a049961a.herokuapp.com`

**Parameters:**
| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| `styleNumber` | string | Yes | Product style number | `NKDC1963` |
| `color` | string | Yes | CATALOG_COLOR value | `BrillOrng` |

**Example Request:**
```javascript
const response = await fetch(
    'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/sizes-by-style-color?styleNumber=NKDC1963&color=BrillOrng'
);
const data = await response.json();
```

**Response Structure:**
```json
{
  "style": "NKDC1963",
  "color": "BrillOrng",
  "sizes": ["XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL"],
  "warehouses": [
    {
      "name": "Seattle, WA",
      "inventory": [286, 893, 1573, 4294, 2417, 1780, 524, 192],
      "total": 11959
    },
    {
      "name": "Reno, NV",
      "inventory": [0, 0, 0, 0, 0, 0, 0, 0],
      "total": 0
    }
  ],
  "sizeTotals": [286, 893, 1573, 4294, 2417, 1780, 524, 192],
  "grandTotal": 11959
}
```

**Response Fields:**
| Field | Type | Description |
|-------|------|-------------|
| `style` | string | Product style number |
| `color` | string | CATALOG_COLOR value |
| `sizes` | array | Available sizes for this style+color combo |
| `warehouses` | array | Per-warehouse inventory details |
| `sizeTotals` | array | Total inventory per size (sum across warehouses) |
| `grandTotal` | number | Total units available across all sizes and warehouses |

**Status Codes:**
| Code | Meaning | Action |
|------|---------|--------|
| 200 | Success | Use returned data |
| 404 | Not Found | Product/color combo doesn't exist or wrong CATALOG_COLOR |
| 500 | Server Error | Retry or fallback to standard sizes |

**Cache Behavior:**
- **Server-side:** 5 minutes (API level)
- **Client-side:** 5 minutes (sessionStorage)
- **Total:** Cached for 5 minutes, then fresh data fetched

---

## 🌟 Real-World Examples

### Example 1: Nike Polo (Multiple Color Variations)

**Product:** NKDC1963 - Nike Dri-Fit Micro Pique 2.0 Polo

**Challenge:** Different colors have different size availability

**Color Variations:**
1. **Brilliant Orange** (`BrillOrng`)
   - Sizes: XS, S, M, L, XL, 2XL, 3XL, 4XL (8 sizes)
   - Total: 11,959 units
   - No tall sizes

2. **Anthracite** (`Anthracite`)
   - Sizes: XS, S, M, L, XL, 2XL, 3XL, 4XL, LT, XLT, 2XLT, 3XLT, 4XLT (13 sizes)
   - Total: 72,040 units
   - Has tall sizes

3. **Cool Grey** (`CoolGrey`)
   - Sizes: XS, S, M, L, XL, 2XL, 3XL, 4XL (8 sizes)
   - Total: 51,729 units
   - No tall sizes

**Implementation:**
- Size selector queries API when color changes
- Shows only available sizes for selected color
- Cart stores CATALOG_COLOR for accurate inventory checks
- Inventory badges show real-time availability

**Files Modified:**
- `pages/top-sellers-product.html` (lines 1536, 1539-1540, 1732)

---

### Example 2: Port Authority Trucker Cap (Single Size)

**Product:** C112 - Port Authority Snapback Trucker Cap

**Challenge:** One-size-fits-all product with multiple color options

**Color Variations:**
1. **Flame Red/Black** (`Flame Red/Blk`)
   - Size: OSFA
   - Total: 1,770 units

2. **Patriot Blue/Flame Red/White** (`Pat Bl/F Rd/Wh`)
   - Size: OSFA
   - Total: 1,234 units

3. **Orange/White** (`Orng/White`)
   - Size: OSFA
   - Total: 892 units

**Implementation:**
- API returns single size: `["OSFA"]`
- Size selector shows single option
- Color selection updates inventory count
- Free sample type (no upcharges)

**Special Handling:**
```javascript
if (sizes.length === 1 && sizes[0] === 'OSFA') {
    // Single-size product - simplified display
    displaySingleSizeOption(gridContainer, sizes[0]);
}
```

---

### Example 3: Top Sellers Showcase Quick Add

**Location:** `/pages/top-sellers-showcase.html`

**Challenge:** Users can quick-add samples directly from showcase without visiting product page

**Implementation:**
```javascript
// Line 257 - Already using CATALOG_COLOR correctly
const sample = {
    style: product.style,
    name: product.description,
    color: product.colorName,              // Display name
    catalogColor: product.catalogColor,    // ✅ API name
    imageUrl: product.imageUrl,
    sizes: { 'M': 1 },                    // Default to Medium
    type: 'free',
    price: 0,
    sampleType: 'free',
    addedAt: new Date().toISOString()
};
```

**Key Points:**
- Uses existing product object's `catalogColor` field
- No need to fetch from API (already in product data)
- Works because showcase pre-loads product data with both color fields

---

## 📝 Quick Reference Cheat Sheet

### ✅ Do's

✅ Always store `CATALOG_COLOR` in cart items
✅ Query API with `CATALOG_COLOR` parameter
✅ Extract `data.sizes` from API response (not direct array)
✅ Update size selector when color changes
✅ Include both `color` and `catalogColor` fields
✅ Use 5-minute cache for performance
✅ Show inventory badges after items added to cart
✅ Test with products that have tall sizes

### ❌ Don'ts

❌ Never use `COLOR_NAME` for API queries
❌ Don't expect API to return direct array
❌ Don't show all sizes for all colors
❌ Don't skip the `catalogColor` field in cart
❌ Don't bypass the inventory service
❌ Don't check inventory on every page load (use cache)
❌ Don't show inventory before cart (check at cart time)

### 🔍 Debug Commands

```javascript
// Check service status
console.log(window.sampleInventoryService.getStatus());

// View cart with inventory
const cart = JSON.parse(sessionStorage.getItem('sampleCart'));
console.table(cart.samples);

// Clear cache and re-check
window.sampleInventoryService.clearCache();

// Test API directly
fetch('/api/sizes-by-style-color?styleNumber=NKDC1963&color=BrillOrng')
    .then(r => r.json())
    .then(console.log);
```

---

## 🎯 Summary

### Key Takeaways

1. **Two color fields are critical:** COLOR_NAME for display, CATALOG_COLOR for API
2. **Size availability varies by color:** Must query API per color
3. **API returns object, not array:** Extract `data.sizes` from response
4. **5-minute cache:** Balances performance with accuracy
5. **Cart-time inventory check:** Most accurate timing for stock verification

### Files to Remember

| File | Purpose | Key Lines |
|------|---------|-----------|
| `sample-inventory-service.js` | Core inventory service | Complete file |
| `top-sellers-product.html` | Product page integration | 1536, 1539-1540, 1732 |
| `top-sellers-showcase.html` | Showcase quick-add | 257 |
| `sample-cart.html` | Cart inventory display | 1388-1415 |

### When You Need to Add Inventory to a New Page

1. Include inventory service script
2. Store CATALOG_COLOR in cart items
3. Check inventory after cart loads
4. Display badges based on status
5. Test with real products
6. Reference this guide for patterns

---

**Last Updated:** 2025-11-02
**Tested With:** NKDC1963, C112, multiple color variations
**Status:** ✅ Production-ready
**Contact:** See DOCS_INDEX.md for support resources
