# 3-Day Tees - Inventory Integration Guide

**Last Updated:** 2025-11-08
**Purpose:** Multi-SKU inventory architecture, real-time stock checks, and API integration patterns
**Status:** Implementation Ready

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
        '2XL': twoXLData.Size01 || 0,    // 2XL is Size01 of PC54_2X
        '3XL': threeXLData.Size01 || 0   // 3XL is Size01 of PC54_3X
    };
}
```

### Size Mapping

**CRITICAL**: Different SKUs use different Size fields for the same human-readable size

| Human Size | PC54 Field | PC54_2X Field | PC54_3X Field |
|------------|------------|---------------|---------------|
| S | Size01 | - | - |
| M | Size02 | - | - |
| L | Size03 | - | - |
| XL | Size04 | - | - |
| 2XL | - | Size01 | - |
| 3XL | - | - | Size01 |

**Example:**
- To get 2XL inventory: Query `PC54_2X` and read `Size01` field
- To get 3XL inventory: Query `PC54_3X` and read `Size01` field

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

- [ ] Import `SampleInventoryService` class
- [ ] Create color selector UI
- [ ] Fetch inventory on color selection
- [ ] Display total inventory for selected color
- [ ] Show stock status badge

### Phase 2: Size-Specific Inventory

- [ ] Query all 3 SKUs (PC54, PC54_2X, PC54_3X)
- [ ] Combine results into unified object
- [ ] Map Size01-Size04 from PC54 response
- [ ] Map Size01 from PC54_2X as 2XL
- [ ] Map Size01 from PC54_3X as 3XL
- [ ] Display inventory count per size

### Phase 3: Real-Time Updates

- [ ] Implement 5-minute cache (from SampleInventoryService)
- [ ] Show loading states during fetches
- [ ] Handle API errors gracefully
- [ ] Update inventory after order submission
- [ ] Display "last updated" timestamp

### Phase 4: Advanced Features

- [ ] Low stock warnings (< 10 units)
- [ ] Size availability indicators
- [ ] Prevent ordering out-of-stock sizes
- [ ] Suggest alternative colors if preferred is low
- [ ] Track inventory changes in session

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

### Pitfall 3: CATALOG_COLOR vs COLOR_NAME

**Problem:** Inventory API returns 404 for "Forest Green"
**Cause:** Using COLOR_NAME instead of CATALOG_COLOR
**Solution:** Use "Forest" (CATALOG_COLOR) not "Forest Green" (COLOR_NAME)

### Pitfall 4: Cache Invalidation

**Problem:** Inventory shows old counts after recent orders
**Cause:** 5-minute cache not refreshed
**Solution:** Force cache refresh on order submission, or wait 5 minutes

---

**Documentation Type:** Inventory Integration Reference
**Parent Document:** [3-DAY-TEES-PROJECT-REQUIREMENTS.md](../../3-DAY-TEES-PROJECT-REQUIREMENTS.md)
**Related Docs:** All files in [/memory/3-day-tees/](.)
