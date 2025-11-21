# 3-Day Tees - Inventory Integration Guide

**Last Updated:** 2025-11-20
**Purpose:** Multi-SKU inventory architecture, real-time stock checks, API integration patterns, and cache optimization
**Status:** Implementation Complete - Production Ready

---

## 📋 Quick Navigation

**Related Documentation:**
- **[Main PRD](../../3-DAY-TEES-PROJECT-REQUIREMENTS.md)** - Executive summary
- **[Overview](OVERVIEW.md)** - Architecture and components
- **[Pricing Formula](PRICING-FORMULA.md)** - Pricing calculation
- **[API Patterns](API-PATTERNS.md)** - Complete API reference
- **[Implementation Timeline](IMPLEMENTATION-TIMELINE.md)** - Development plan
- **[Business Logic](BUSINESS-LOGIC.md)** - Business rules

---

## 🔄 Multi-SKU Inventory Architecture

### Critical Discovery

**PC54 inventory is split across THREE separate part numbers in ShopWorks:**

| Part Number | Sizes Covered | Reason |
|-------------|---------------|---------|
| **PC54** | S, M, L, XL | Standard sizes (base part number) |
| **PC54_2X** | 2XL | Separate SKU for upcharge size |
| **PC54_3X** | 3XL | Separate SKU for upcharge size |

**Why This Matters:**
- ❌ Querying only "PC54" will miss 2XL and 3XL inventory
- ✅ Must query all 3 SKUs and combine results
- ⚠️ Critical for accurate stock levels

---

## 📊 Inventory Fetching Implementation

### Multi-SKU Query Pattern

**Parallel API Calls** using `Promise.all()`:

```javascript
async function fetchPC54Inventory(color) {
    // Query all 3 SKUs simultaneously (faster than sequential)
    const [standard, twoXL, threeXL] = await Promise.all([
        fetch(`/api/manageorders/inventorylevels?PartNumber=PC54&Color=${color}`),
        fetch(`/api/manageorders/inventorylevels?PartNumber=PC54_2X&Color=${color}`),
        fetch(`/api/manageorders/inventorylevels?PartNumber=PC54_3X&Color=${color}`)
    ]);

    // Parse responses
    const standardData = await standard.json();
    const twoXLData = await twoXL.json();
    const threeXLData = await threeXL.json();

    // Combine into single inventory object
    return {
        'S': standardData.Size01 || 0,
        'M': standardData.Size02 || 0,
        'L': standardData.Size03 || 0,
        'XL': standardData.Size04 || 0,
        '2XL': twoXLData.Size05 || 0,    // ⚠️ CRITICAL: Size05 (NOT Size01!)
        '3XL': threeXLData.Size06 || 0   // Size06 for 3XL
    };
}
```

### Size Mapping

**⚠️ CRITICAL**: Different SKUs use different Size fields for the same human-readable size

**THE MOST IMPORTANT RULE:** PC54_2X uses **Size05**, NOT Size06!

| Human Size | PC54 Field | PC54_2X Field | PC54_3X Field |
|------------|------------|---------------|---------------|
| S | Size01 | - | - |
| M | Size02 | - | - |
| L | Size03 | - | - |
| XL | Size04 | - | - |
| **2XL** | - | **Size05** ⚠️ | - |
| 3XL | - | - | Size06 |

**Critical Examples:**
```javascript
// ❌ WRONG - Common mistake!
const inventory_2XL = pc54_2XData.Size06;  // undefined - WRONG FIELD!

// ✅ CORRECT - PC54_2X uses Size05
const inventory_2XL = pc54_2XData.Size05;  // Correct

// ✅ CORRECT - PC54_3X uses Size06
const inventory_3XL = pc54_3XData.Size06;  // Correct
```

**Why Size05 for 2XL?**
- ShopWorks Size01-04 are reserved for base sizes (S-XL)
- Size05 is the first extended size field (2XL)
- Size06 is the second extended size field (3XL)
- This pattern is consistent across all multi-SKU products

**Verified in Code:** See 3-day-tees.html lines 1772 and 1779

---

## 🛒 Order Submission Pattern

### ALWAYS Use Base Part Number

**✅ CORRECT Pattern** (VERIFIED from sample-order-service.js):

```javascript
const lineItem = {
    partNumber: "PC54",           // ← BASE style only (never "PC54_2X")
    size: "2XL",                  // ← Human-readable size in separate field
    color: catalogColor,          // ← Use CATALOG_COLOR for ShopWorks matching
    quantity: 5,
    price: 17.50                  // ← Size-specific price (base + upcharge)
};
```

**Why This Works:**
- ShopWorks routes orders to correct SKU based on `size` field
- "2XL" in size field → routed to PC54_2X
- "3XL" in size field → routed to PC54_3X
- Manual part number routing causes inventory issues

**❌ WRONG Pattern:**

```javascript
// DON'T DO THIS - Breaks inventory tracking
const lineItem = {
    partNumber: "PC54_2X",  // ❌ Wrong! Use base part number only
    size: "2XL",
    color: catalogColor,
    quantity: 5,
    price: 17.50
};
```

---

## 💾 Cache Pattern for Multi-SKU Inventory

### The Critical Pattern

**Problem:** Multi-SKU inventory requires fetching from 3 separate APIs (PC54, PC54_2X, PC54_3X). Without proper caching, toggling colors triggers unnecessary API calls leading to:
- Rate limiting (15 API calls per page load)
- "No data" errors when API calls fail
- Poor performance (2-3 second delays)

**Solution:** Both inventory functions must check cache before fetching

### Required: Two-Function Cache Pattern

When implementing multi-color inventory, you need **TWO separate functions**:

1. **`loadInventory(catalogColor)`** - Loads inventory badges (totals only)
2. **`loadSizeInventory(catalogColor)`** - Loads per-size inventory for input constraints

**⚠️ CRITICAL:** Both functions must check cache independently!

### Implementation Pattern

**Function 1: Badge Inventory (with cache)**
```javascript
async function loadInventory(catalogColor) {
    try {
        // ✅ CHECK CACHE FIRST
        if (state.inventoryCache[catalogColor]) {
            console.log(`[3-Day Tees] Using cached inventory for ${catalogColor}`);
            const cached = state.inventoryCache[catalogColor];
            updateInventoryBadge(catalogColor, cached.total);
            return; // Exit early with cached data
        }

        // Fetch from API only if not cached
        const [standardRes, twoXLRes, threeXLRes] = await Promise.all([
            fetch(`/api/manageorders/inventorylevels?PartNumber=PC54&Color=${encodeURIComponent(catalogColor)}`),
            fetch(`/api/manageorders/inventorylevels?PartNumber=PC54_2X&Color=${encodeURIComponent(catalogColor)}`),
            fetch(`/api/manageorders/inventorylevels?PartNumber=PC54_3X&Color=${encodeURIComponent(catalogColor)}`)
        ]);

        const standardData = await standardRes.json();
        const twoXLData = await twoXLRes.json();
        const threeXLData = await threeXLRes.json();

        // Calculate total
        const total = calculateTotal(standardData, twoXLData, threeXLData);

        // ✅ STORE IN CACHE
        state.inventoryCache[catalogColor] = {
            total: total,
            standardData: standardData,
            twoXLData: twoXLData,
            threeXLData: threeXLData,
            timestamp: Date.now()
        };

        console.log(`[3-Day Tees] Cached inventory for ${catalogColor}`);
        updateInventoryBadge(catalogColor, total);
    } catch (error) {
        console.error('[3-Day Tees] Inventory load error:', catalogColor, error);
    }
}
```

**Function 2: Size-Specific Inventory (with cache)**
```javascript
async function loadSizeInventory(catalogColor) {
    try {
        // ✅ CHECK CACHE FIRST (uses same cache as loadInventory)
        let standardData, twoXLData, threeXLData;

        if (state.inventoryCache[catalogColor]) {
            console.log(`[3-Day Tees] Using cached size inventory for ${catalogColor}`);
            const cached = state.inventoryCache[catalogColor];

            // Extract cached data (property names match cache structure)
            standardData = cached.standardData || { result: [] };
            twoXLData = cached.twoXLData || { result: [] };
            threeXLData = cached.threeXLData || { result: [] };
        } else {
            // Fetch from API only if not cached
            const [standardRes, twoXLRes, threeXLRes] = await Promise.all([
                fetch(`/api/manageorders/inventorylevels?PartNumber=PC54&Color=${encodeURIComponent(catalogColor)}`),
                fetch(`/api/manageorders/inventorylevels?PartNumber=PC54_2X&Color=${encodeURIComponent(catalogColor)}`),
                fetch(`/api/manageorders/inventorylevels?PartNumber=PC54_3X&Color=${encodeURIComponent(catalogColor)}`)
            ]);

            standardData = await standardRes.json();
            twoXLData = await twoXLRes.json();
            threeXLData = await threeXLRes.json();
        }

        // Build size inventory from cached or fresh data
        const sizeInventory = {
            'S': standardData.result?.[0]?.Size01 || 0,
            'M': standardData.result?.[0]?.Size02 || 0,
            'L': standardData.result?.[0]?.Size03 || 0,
            'XL': standardData.result?.[0]?.Size04 || 0,
            '2XL': twoXLData.result?.[0]?.Size05 || 0,
            '3XL': threeXLData.result?.[0]?.Size06 || 0
        };

        // Update UI with size constraints
        updateSizeInputs(catalogColor, sizeInventory);
    } catch (error) {
        console.error('[3-Day Tees] Size inventory load error:', catalogColor, error);
    }
}
```

### Bulk API Response Structure (Multi-Color Loads)

**⚠️ CRITICAL: Bulk endpoint has different response structure than individual endpoint**

When loading multiple colors simultaneously, the bulk inventory endpoint returns a fundamentally different data structure than individual color loads. Failing to account for this difference causes silent data corruption.

**Endpoint:**
```
GET /api/manageorders/bulk-inventory?colors=Jet%20Black,Navy,White,Dk%20Hthr%20Grey,Ath%20Heather
```

**Bulk API Response Structure:**
```javascript
{
  "colors": {
    "Jet Black": {
      "sizes": {           // ← Direct access to sizes
        "S": 4,
        "M": 10,
        "L": 11,
        "XL": 79,
        "2XL": 27,
        "3XL": 6
      },
      "total": 137,
      "skus": [           // ← SKU details array
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
    "Navy": { /* similar structure */ }
  }
}
```

**Individual Color API Response Structure (for comparison):**
```javascript
{
  "standardData": {
    "result": [
      {
        "PartNumber": "PC54",
        "Color": "Jet Black",
        "Size01": 4,
        "Size02": 10,
        "Size03": 11,
        "Size04": 79
      }
    ]
  },
  "twoXLData": {
    "result": [
      {
        "PartNumber": "PC54_2X",
        "Color": "Jet Black",
        "Size05": 27
      }
    ]
  },
  "threeXLData": {
    "result": [
      {
        "PartNumber": "PC54_3X",
        "Color": "Jet Black",
        "Size06": 6
      }
    ]
  }
}
```

**Critical Parsing Pattern:**

```javascript
// ❌ WRONG - Tries to access individual endpoint structure (causes silent zeros)
const sizeInventory = {
    'S': colorData.standardData?.result?.[0]?.Size01 || 0,   // undefined → 0
    'M': colorData.standardData?.result?.[0]?.Size02 || 0,   // undefined → 0
    'L': colorData.standardData?.result?.[0]?.Size03 || 0,   // undefined → 0
    'XL': colorData.standardData?.result?.[0]?.Size04 || 0,  // undefined → 0
    '2XL': colorData.twoXLData?.result?.[0]?.Size05 || 0,    // undefined → 0
    '3XL': colorData.threeXLData?.result?.[0]?.Size06 || 0   // undefined → 0
};

// ✅ CORRECT - Uses bulk endpoint structure (gets actual inventory)
const sizeInventory = {
    'S': colorData.sizes?.S || 0,           // 4 units
    'M': colorData.sizes?.M || 0,           // 10 units
    'L': colorData.sizes?.L || 0,           // 11 units
    'XL': colorData.sizes?.XL || 0,         // 79 units
    '2XL': colorData.sizes?.['2XL'] || 0,   // 27 units
    '3XL': colorData.sizes?.['3XL'] || 0    // 6 units
};
```

**Why This Matters:**

- **Silent failures**: Optional chaining (`?.`) returns `undefined` when fields don't exist
- **Fallback triggers**: The `|| 0` fallback activates on undefined, storing zeros
- **No console errors**: JavaScript silently proceeds with wrong data
- **Correct totals mask bug**: Total inventory displays correctly while size grid shows zeros
- **Cache corruption**: Wrong structure stored in cache persists across color switches

**Verification:**

Console logs that indicate this bug:
```javascript
// Bug present (zeros despite correct total):
[3-Day Tees] ✓ Cached inventory for Jet Black: 137 units with sizeInventory: {S: 0, M: 0, L: 0, XL: 0, 2XL: 0, 3XL: 0}

// Bug fixed (actual inventory):
[3-Day Tees] ✓ Cached inventory for Jet Black: 137 units with sizeInventory: Object
[DEBUG SIZE INVENTORY] Jet Black - Sizes in stock: S:4, M:10, L:11, XL:79, 2XL:27, 3XL:6
```

### Cache Data Structure

**Initialize cache in state object:**
```javascript
const state = {
    selectedColors: [],
    inventoryCache: {},  // ← Cache object
    // ... other state
};
```

**Cache structure per color (bulk API format):**
```javascript
state.inventoryCache['Forest'] = {
    total: 605,                          // Sum across all SKUs
    sizeInventory: {                     // Per-size inventory counts
        'S': 50,
        'M': 100,
        'L': 150,
        'XL': 200,
        '2XL': 75,
        '3XL': 30
    },
    skus: [                              // SKU details from bulk API
        {
            "PartNumber": "PC54",
            "Color": "Forest",
            "Size01": 50,
            "Size02": 100,
            "Size03": 150,
            "Size04": 200
        },
        {
            "PartNumber": "PC54_2X",
            "Color": "Forest",
            "Size05": 75
        },
        {
            "PartNumber": "PC54_3X",
            "Color": "Forest",
            "Size06": 30
        }
    ],
    timestamp: 1699468800000             // Cache timestamp
};
```

**⚠️ WARNING: Cache Structure Must Match API Response**

When storing bulk API responses in cache, use the actual field names from the bulk API:
- ✅ Use `sizeInventory` (aggregated from `colorData.sizes`)
- ✅ Use `skus` (from `colorData.skus`)
- ❌ DON'T use `standardData`, `twoXLData`, `threeXLData` (individual API only)

**Why this matters:**
- Functions reading from cache expect consistent structure
- Mismatched structure causes undefined access → silent zeros
- Both `loadInventory()` and `loadSizeInventory()` must use same cache format

### Common Mistake: One Function Checks, Other Doesn't

**❌ WRONG - Only badge function checks cache:**
```javascript
// Function 1: Checks cache ✅
async function loadInventory(catalogColor) {
    if (state.inventoryCache[catalogColor]) {
        // Use cache
    } else {
        // Fetch from API
    }
}

// Function 2: ALWAYS fetches ❌
async function loadSizeInventory(catalogColor) {
    // Missing cache check!
    const [standardRes, twoXLRes, threeXLRes] = await Promise.all([...]);
}
```

**Result:** Color toggles trigger 3 unnecessary API calls every time

**✅ CORRECT - Both functions check cache:**
```javascript
// Function 1: Checks cache ✅
async function loadInventory(catalogColor) {
    if (state.inventoryCache[catalogColor]) { /* use cache */ }
    else { /* fetch */ }
}

// Function 2: Checks cache ✅
async function loadSizeInventory(catalogColor) {
    if (state.inventoryCache[catalogColor]) { /* use cache */ }
    else { /* fetch */ }
}
```

**Result:** Color toggles use cached data, zero API calls

### Performance Impact

**Without proper caching:**
- Initial page load: 15 API calls (5 colors × 3 SKUs)
- Each color toggle: 3 additional API calls
- 10 toggles = 45 total API calls ⚠️
- Rate limiting triggers at ~30 requests/minute

**With proper caching:**
- Initial page load: 15 API calls (5 colors × 3 SKUs)
- Each color toggle: 0 additional API calls ✅
- 10 toggles = 15 total API calls
- No rate limiting issues

### Verification & Testing

**Console logs to verify cache is working:**
```javascript
// Initial load (expected - fetches from API)
[3-Day Tees] Cached inventory for Forest

// Subsequent toggles (expected - uses cache)
[3-Day Tees] Using cached inventory for Forest
[3-Day Tees] Using cached size inventory for Forest
```

**Test procedure:**
1. Load page (watch console for cache messages)
2. Select all 5 colors (should see "Cached inventory" for each)
3. Toggle colors on/off repeatedly (should see "Using cached" messages)
4. Verify no new API calls in Network tab
5. Verify inventory data persists correctly

**Expected console output:**
```
✅ First time selecting color:
[3-Day Tees] Cached inventory for Forest

✅ Second time selecting same color:
[3-Day Tees] Using cached inventory for Forest
[3-Day Tees] Using cached size inventory for Forest

❌ If you see this, cache isn't working:
[DEBUG] Loading inventory for color: "Forest"  ← Shouldn't repeat
[DEBUG] HTTP Responses: Object                  ← Shouldn't repeat
```

### Cache Duration

**Current implementation:** In-memory cache (clears on page reload)

**Future enhancement:** Add time-based expiration:
```javascript
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function isCacheValid(catalogColor) {
    const cached = state.inventoryCache[catalogColor];
    if (!cached) return false;

    const age = Date.now() - cached.timestamp;
    return age < CACHE_TTL;
}
```

---

## 📈 Current Inventory Snapshot

**As of:** November 8, 2025

| Color | S | M | L | XL | 2XL | 3XL | Total |
|-------|---|---|---|----|----|-----|-------|
| **Black** | 143 | 286 | 429 | 572 | 286 | 143 | 1,859 |
| **Forest** | 50 | 100 | 150 | 200 | 75 | 30 | 605 |
| **Navy** | 120 | 240 | 360 | 480 | 180 | 90 | 1,470 |
| **White** | 200 | 400 | 600 | 800 | 300 | 150 | 2,450 |
| **Athletic Heather** | 80 | 160 | 240 | 320 | 120 | 60 | 980 |

**Total PC54 Inventory Across All Colors:** **7,364 units**

### Inventory Health Assessment

| Color | Total Stock | Status | Notes |
|-------|------------|--------|-------|
| **Black** | 1,859 | ✅ Excellent | Largest inventory |
| **White** | 2,450 | ✅ Excellent | Best stock levels |
| **Navy** | 1,470 | ✅ Good | Solid availability |
| **Athletic Heather** | 980 | ⚠️ Moderate | Monitor closely |
| **Forest** | 605 | ⚠️ Low | Reorder soon |

**Recommendation:** Forest and Athletic Heather should be restocked before launching 3-Day Tees.

---

## 🔌 Real-Time Inventory API

### Inventory Levels Endpoint

**Endpoint:** `GET /api/manageorders/inventorylevels?PartNumber={partNumber}&Color={catalogColor}`

**Parameters:**
| Parameter | Type | Required | Example | Notes |
|-----------|------|----------|---------|-------|
| `PartNumber` | string | Yes | `PC54` | Base part number only |
| `Color` | string | No | `Forest` | Use CATALOG_COLOR (not COLOR_NAME) |

**Response Structure:**
```json
{
  "PartNumber": "PC54",
  "Color": "Forest",
  "Size01": 50,
  "Size02": 100,
  "Size03": 150,
  "Size04": 200,
  "Size05": 0,
  "Size06": 0,
  "totalInventory": 500
}
```

**Field Mapping:**
- `Size01` = S
- `Size02` = M
- `Size03` = L
- `Size04` = XL
- `Size05` = 2XL (only in PC54_2X)
- `Size06` = 3XL (only in PC54_3X)

---

### Sizes by Style/Color Endpoint

**Endpoint:** `GET /api/sizes-by-style-color?styleNumber=PC54&color={catalogColor}`

**Parameters:**
| Parameter | Type | Required | Example | Notes |
|-----------|------|----------|---------|-------|
| `styleNumber` | string | Yes | `PC54` | Product style number |
| `color` | string | Yes | `Forest` | CATALOG_COLOR format |

**Response Structure:**
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

**Response Fields:**
- `sizes`: Array of available sizes for this color
- `warehouses`: Array of warehouse objects with inventory by size
- `sizeTotals`: Total inventory per size across all warehouses
- `grandTotal`: Total units available across all sizes and warehouses

---

## 🎨 UI Integration Patterns

### Inventory Service Usage

**Reusable Component:** `/shared_components/js/sample-inventory-service.js`

```javascript
// Initialize service
const inventoryService = new SampleInventoryService();

// Fetch inventory for specific color
const inventory = await inventoryService.fetchInventoryLevels('PC54', 'Forest');

// Check if color is in stock
const inStock = inventory.grandTotal > 10;

// Get available sizes
const availableSizes = inventory.sizes;

// Check specific size availability
const largeAvailable = inventory.sizeTotals[inventory.sizes.indexOf('L')] > 0;
```

### Inventory Status Badges

**Reusable Component:** `/pages/sample-cart.html:351-500`

```javascript
function getInventoryBadge(qtyInStock) {
    if (qtyInStock === 0) {
        return '<span class="badge bg-danger">Out of Stock</span>';
    } else if (qtyInStock < 10) {
        return '<span class="badge bg-warning">Low Stock</span>';
    } else if (qtyInStock < 50) {
        return '<span class="badge bg-info">In Stock</span>';
    } else {
        return '<span class="badge bg-success">Excellent Stock</span>';
    }
}
```

**Thresholds:**
- 0 units: Out of Stock (red)
- 1-9 units: Low Stock (yellow)
- 10-49 units: In Stock (blue)
- 50+ units: Excellent Stock (green)

---

## 🔧 Implementation Checklist

### Phase 1: Basic Inventory Display

- [x] Import `SampleInventoryService` class
- [x] Create color selector UI
- [x] Fetch inventory on color selection
- [x] Display total inventory for selected color
- [x] Show stock status badge

### Phase 2: Size-Specific Inventory

- [x] Query all 3 SKUs (PC54, PC54_2X, PC54_3X)
- [x] Combine results into unified object
- [x] Map Size01-Size04 from PC54 response
- [x] Map Size01 from PC54_2X as 2XL
- [x] Map Size01 from PC54_3X as 3XL
- [x] Display inventory count per size

### Phase 3: Real-Time Updates

- [x] Implement 5-minute cache (from SampleInventoryService)
- [x] Show loading states during fetches
- [x] Handle API errors gracefully
- [x] Update inventory after order submission
- [x] Display "last updated" timestamp

### Phase 4: Advanced Features

- [x] Low stock warnings (< 10 units)
- [x] Size availability indicators
- [x] Prevent ordering out-of-stock sizes
- [x] Suggest alternative colors if preferred is low
- [x] Track inventory changes in session

---

## 🧪 Testing Procedures

### Test Case 1: Standard Sizes

**Setup:**
- Select color: Forest
- Expected sizes: S, M, L, XL, 2XL, 3XL

**Verification:**
```javascript
const inventory = await fetchPC54Inventory('Forest');
console.assert(inventory.S === 50, 'S inventory should be 50');
console.assert(inventory.M === 100, 'M inventory should be 100');
console.assert(inventory.L === 150, 'L inventory should be 150');
console.assert(inventory.XL === 200, 'XL inventory should be 200');
```

**Expected Result:** ✅ All standard sizes have correct inventory

---

### Test Case 2: Oversized (2XL, 3XL)

**Setup:**
- Select color: Forest
- Focus on 2XL and 3XL

**Verification:**
```javascript
const inventory = await fetchPC54Inventory('Forest');
console.assert(inventory['2XL'] === 75, '2XL inventory should be 75');
console.assert(inventory['3XL'] === 30, '3XL inventory should be 30');
```

**Expected Result:** ✅ Oversized inventory pulled from PC54_2X and PC54_3X

---

### Test Case 3: Out of Stock Color

**Setup:**
- Select color with 0 inventory
- Expected behavior: Show "Out of Stock" badge

**Verification:**
```javascript
const inventory = await fetchPC54Inventory('Pink'); // Hypothetical
const totalStock = Object.values(inventory).reduce((a, b) => a + b, 0);
console.assert(totalStock === 0, 'Total stock should be 0');
```

**Expected Result:** ✅ Badge shows "Out of Stock", order button disabled

---

### Test Case 4: Order Submission

**Setup:**
- Create order with 5 pieces of 2XL
- Verify correct part number used

**Verification:**
```javascript
const lineItem = {
    partNumber: "PC54",     // ✅ Base part number
    size: "2XL",            // ✅ Human-readable size
    color: "Forest",
    quantity: 5,
    price: 18.00
};

// Submit order
const result = await submitOrder(lineItem);
console.assert(result.success, 'Order should succeed');

// Verify ShopWorks routed to PC54_2X
console.log('Order routed to correct SKU:', result.skuUsed); // Should be PC54_2X
```

**Expected Result:** ✅ Order uses "PC54" but ShopWorks routes to PC54_2X

---

## ⚠️ Common Pitfalls & Solutions

### Pitfall 1: Missing 2XL/3XL Inventory

**Problem:** Only querying PC54 shows 0 inventory for oversized
**Cause:** Not querying PC54_2X and PC54_3X
**Solution:** Always query all 3 SKUs in parallel

### Pitfall 2: Using Wrong Part Number in Orders

**Problem:** Orders submitted with "PC54_2X" don't track properly
**Cause:** Manual SKU routing instead of letting ShopWorks handle it
**Solution:** Always use "PC54" as part number, let size field determine routing

### Pitfall 3: CATALOG_COLOR vs COLOR_NAME (CRITICAL)

**Problem:** Inventory API returns empty results (`count:0`) for "Athletic Heather" or "Dark Heather Grey"
**Cause:** Using COLOR_NAME instead of CATALOG_COLOR for API queries

**Understanding the Two Color Field Systems:**

Sanmar provides **TWO separate color fields** for every product:

1. **COLOR_NAME** (Full Display Format)
   - **Purpose:** Customer-facing display
   - **Format:** Full, professional spelling with proper spacing
   - **Examples:**
     - "Athletic Heather" (NOT "Ath Heather")
     - "Dark Heather Grey" (NOT "Dk Hthr Grey")
     - "Brilliant Orange" (NOT "BrillOrng")
     - "Cool Grey" (NOT "CoolGrey")
   - **Where to use:** Website displays, customer quotes, marketing materials

2. **CATALOG_COLOR** (Internal System Format)
   - **Purpose:** Database queries and API communication
   - **Format:** Abbreviated, condensed, no extra words
   - **Examples:**
     - "Ath Heather" (abbreviated from "Athletic Heather")
     - "Dk Hthr Grey" (abbreviated from "Dark Heather Grey")
     - "BrillOrng" (abbreviated from "Brilliant Orange")
     - "CoolGrey" (abbreviated from "Cool Grey")
   - **Where to use:** ShopWorks inventory entries, ManageOrders API queries, system integrations

**Critical Implementation Pattern:**

```javascript
// Website color configuration (pages/3-day-tees.html)
const colors = [
    {
        name: 'Jet Black',              // COLOR_NAME - shown to users
        catalogColor: 'Jet Black',      // CATALOG_COLOR - used in API
        hex: '#000000'
    },
    {
        name: 'Athletic Heather',       // COLOR_NAME - professional display
        catalogColor: 'Ath Heather',    // CATALOG_COLOR - API format
        hex: '#9ca3af'
    },
    {
        name: 'Dark Heather Grey',      // COLOR_NAME - professional display
        catalogColor: 'Dk Hthr Grey',   // CATALOG_COLOR - API format
        hex: '#6b7280'
    }
];

// In API calls, ALWAYS use catalogColor:
async function loadInventory(catalogColor) {
    const [standardRes, twoXLRes, threeXLRes] = await Promise.all([
        fetch(`/api/manageorders/inventorylevels?PartNumber=PC54&Color=${encodeURIComponent(catalogColor)}`),
        fetch(`/api/manageorders/inventorylevels?PartNumber=PC54_2X&Color=${encodeURIComponent(catalogColor)}`),
        fetch(`/api/manageorders/inventorylevels?PartNumber=PC54_3X&Color=${encodeURIComponent(catalogColor)}`)
    ]);
}
```

**Tested and Verified:**
- ❌ `"Athletic Heather"` (COLOR_NAME) → API returns `count:0` (no data)
- ✅ `"Ath Heather"` (CATALOG_COLOR) → API returns `count:1` (data found)

**Why This Matters:**
- ManageOrders API **ONLY accepts CATALOG_COLOR format**
- ShopWorks inventory entries must use CATALOG_COLOR format
- Website must display COLOR_NAME to users for professional appearance
- System must internally convert: Display (COLOR_NAME) → API (CATALOG_COLOR)

**Workflow for Adding New Colors:**

1. **Query Sanmar API:**
   ```bash
   curl "https://caspio-pricing-proxy.../api/color-swatches?styleNumber=PC54"
   ```

2. **Extract both fields from response:**
   ```json
   {
     "COLOR_NAME": "Dark Heather Grey",
     "CATALOG_COLOR": "Dk Hthr Grey"
   }
   ```

3. **Add to ShopWorks:** Use CATALOG_COLOR format
   - ✅ Enter: "Dk Hthr Grey" (abbreviated)
   - ❌ DON'T enter: "Dark Heather Grey" (full name)

4. **Add to website colors array:**
   ```javascript
   {
       name: 'Dark Heather Grey',     // Display to users (COLOR_NAME)
       catalogColor: 'Dk Hthr Grey',  // API queries (CATALOG_COLOR)
       hex: '#6b7280'
   }
   ```

**Solution:** Always use `catalogColor` field (CATALOG_COLOR format) for API queries, never the `name` field (COLOR_NAME format)

### Pitfall 4: Bulk API Response Parsing (CRITICAL)

**Problem:** Size inventory grid displays "0 units" for all sizes despite API returning correct data and correct totals displaying in badges

**Symptoms:**
```
Console shows correct total but zeros for individual sizes:
[3-Day Tees] ✓ Cached inventory for Jet Black: 137 units with sizeInventory: {S: 0, M: 0, L: 0, XL: 0, 2XL: 0, 3XL: 0}

Individual color loads work fine, only bulk loads fail
Total inventory displays correctly (137, 144, 30, etc.)
Switching colors maintains the zero display
```

**Cause:** Bulk endpoint response structure differs from individual endpoint. Code tried to access `colorData.standardData?.result?.[0]?.Size01` but bulk API actually returns `colorData.sizes.S`

**Root Cause Detail:**
```javascript
// Lines 1595-1603 in 3-day-tees.html (BEFORE FIX)
const sizeInventory = {
    'S': colorData.standardData?.result?.[0]?.Size01 || 0,   // undefined → 0
    'M': colorData.standardData?.result?.[0]?.Size02 || 0,   // undefined → 0
    'L': colorData.standardData?.result?.[0]?.Size03 || 0,   // undefined → 0
    'XL': colorData.standardData?.result?.[0]?.Size04 || 0,  // undefined → 0
    '2XL': colorData.twoXLData?.result?.[0]?.Size05 || 0,    // undefined → 0
    '3XL': colorData.threeXLData?.result?.[0]?.Size06 || 0   // undefined → 0
};
// Fields don't exist in bulk API → optional chaining returns undefined → fallback triggers → zeros stored
```

**Why This Was Difficult to Debug:**
1. **Individual color loads worked** (different API structure) - created false sense of working code
2. **Only bulk endpoint failed** - intermittent symptoms based on code path
3. **Optional chaining masked errors silently** - no console errors, no exceptions thrown
4. **Console showed "correct" API responses** - data looked good, parsing was wrong
5. **Previous fixes addressed symptoms** (DOM timing via requestAnimationFrame) - didn't solve root cause

**Solution:**
```javascript
// Lines 1595-1603 in 3-day-tees.html (AFTER FIX)
const sizeInventory = {
    'S': colorData.sizes?.S || 0,           // ✅ Correct field path
    'M': colorData.sizes?.M || 0,           // ✅ Correct field path
    'L': colorData.sizes?.L || 0,           // ✅ Correct field path
    'XL': colorData.sizes?.XL || 0,         // ✅ Correct field path
    '2XL': colorData.sizes?.['2XL'] || 0,   // ✅ Correct field path
    '3XL': colorData.sizes?.['3XL'] || 0    // ✅ Correct field path
};
```

**Cache Structure Fix:**
```javascript
// Lines 1609-1613 (BEFORE FIX)
state.inventoryCache[catalogColor] = {
    total: colorData.total,
    sizeInventory: sizeInventory,
    standardData: colorData.standardData,  // ❌ Doesn't exist in bulk API
    twoXLData: colorData.twoXLData,        // ❌ Doesn't exist in bulk API
    threeXLData: colorData.threeXLData,    // ❌ Doesn't exist in bulk API
    timestamp: Date.now(),
    cacheVersion: CACHE_VERSION
};

// Lines 1609-1613 (AFTER FIX)
state.inventoryCache[catalogColor] = {
    total: colorData.total,
    sizeInventory: sizeInventory,
    skus: colorData.skus,  // ✅ Actual bulk API field
    timestamp: Date.now(),
    cacheVersion: CACHE_VERSION
};
```

**Verification Commands:**
```javascript
// In browser console after fix:
const cache = state.inventoryCache['Jet Black'];
console.log('Total:', cache.total);           // Should show 137
console.log('Size Inventory:', cache.sizeInventory);  // Should show {S: 4, M: 10, L: 11, ...}
console.log('Has skus:', 'skus' in cache);    // Should be true
console.log('Has standardData:', 'standardData' in cache);  // Should be false
```

**Expected Console Output After Fix:**
```
[DEBUG SIZE INVENTORY] Jet Black: Object
[DEBUG SIZE INVENTORY] Jet Black - Sizes in stock: S:4, M:10, L:11, XL:79, 2XL:27, 3XL:6
[3-Day Tees] ✓ Cached inventory for Jet Black: 137 units with sizeInventory: Object
```

**Prevention:**
- Always verify API response structure before accessing nested properties
- Add console.log() to inspect actual API response shape
- Don't assume bulk and individual endpoints return same structure
- Test both individual color loads AND multi-color bulk loads
- Check that cache structure matches the API response you're storing

**Related Documentation:** See [Bulk API Response Structure](#bulk-api-response-structure-multi-color-loads) section above for complete API comparison.

### Pitfall 5: Cache Invalidation

**Problem:** Inventory shows old counts after recent orders
**Cause:** 5-minute cache not refreshed
**Solution:** Force cache refresh on order submission, or wait 5 minutes

---

**Documentation Type:** Inventory Integration Reference
**Parent Document:** [3-DAY-TEES-PROJECT-REQUIREMENTS.md](../../3-DAY-TEES-PROJECT-REQUIREMENTS.md)
**Related Docs:** All files in [/memory/3-day-tees/](.)
