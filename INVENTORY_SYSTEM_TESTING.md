# Sample Inventory System - Testing & Documentation

**Created:** 2025-01-30
**Status:** Ready for Testing
**Purpose:** Real-time inventory checking for sample cart to prevent out-of-stock orders

---

## 🎯 Overview

The inventory system integrates with the ManageOrders PULL API to check real-time inventory levels before allowing customers to order samples. This prevents ordering out-of-stock items and provides clear visibility into stock availability.

### Key Features Implemented

✅ **Real-time inventory checks** via ManageOrders API
✅ **5-minute client-side cache** (matches API cache)
✅ **Color matching** using CATALOG_COLOR (ShopWorks internal code)
✅ **Size-specific availability** validation
✅ **Stock status badges** (In Stock, Low Stock, Out of Stock)
✅ **Checkout validation** to prevent ordering unavailable items
✅ **Graceful error handling** (allows ordering if API fails)

---

## 📁 Files Created/Modified

### NEW FILES

1. **`/shared_components/js/sample-inventory-service.js`** (~390 lines)
   - SampleInventoryService class
   - API integration with ManageOrders
   - Cache management (5-minute TTL)
   - Availability checking methods
   - Checkout validation

### MODIFIED FILES

1. **`/pages/sample-cart.html`**
   - Added inventory service script tag
   - Added CSS for stock status badges and warnings (~190 lines)
   - Enhanced `loadCart()` to check inventory on page load
   - Updated cart item display to show stock status badges
   - Added size-specific availability indicators
   - Added checkout validation to block out-of-stock orders

2. **`/pages/top-sellers-showcase.html`**
   - Added inventory service script tag
   - Enhanced `addSample()` method to check inventory before adding
   - Added inventory warnings for out-of-stock and low-stock items

---

## 🔧 Technical Implementation

### Architecture

```
Customer Views Cart
    ↓
Sample Cart Page Loads
    ↓
Inventory Service Checks Stock (ManageOrders API)
    ↓ (5-minute cache)
Display Stock Status Badges
    ↓
Customer Attempts Checkout
    ↓
Validate Inventory
    ↓
Block if Out of Stock / Allow if Available
```

### API Integration

**Endpoint:** `GET /api/manageorders/inventorylevels`
**Parameters:**
- `PartNumber` - Product style number (e.g., "PC54")
- `Color` - ShopWorks CATALOG_COLOR (e.g., "Forest")

**Response Example:**
```json
{
  "inventory": [
    {
      "PartNumber": "PC54",
      "Color": "Forest",
      "Size": "M",
      "QtyAvailable": 150,
      "Warehouse": "Main"
    }
  ]
}
```

### Color Matching Logic

**Critical:** Uses CATALOG_COLOR for inventory lookups, not display COLOR_NAME

```javascript
// Sample cart stores both:
{
  color: "Forest Green",     // Display name (shown to user)
  catalogColor: "Forest"     // ShopWorks internal code (for API)
}

// Inventory API matches on:
PartNumber="PC54" + Color="Forest" (catalogColor)
```

### Cache Strategy

- **Client-side cache:** 5 minutes (matches API cache)
- **Storage:** sessionStorage (survives page refreshes, not browser restarts)
- **Cache key:** `${partNumber}_${catalogColor}`
- **Auto-refresh:** Cache expires after 5 minutes, fetches fresh data

---

## 🧪 Testing Checklist

### Phase 1: Service Initialization

- [ ] Open browser console on sample cart page
- [ ] Check for: `[SampleInventory] Service initialized`
- [ ] Check for: `[SampleInventory] Service ready`
- [ ] Verify service is available: `window.sampleInventoryService`

**Console Command:**
```javascript
console.log(window.sampleInventoryService.getStatus());
// Expected: Service info with API endpoint and cache size
```

### Phase 2: Sample Cart Inventory Display

**Test Scenario:** Cart with samples already added

1. **Navigate to Sample Cart:**
   - URL: `/pages/sample-cart.html`

2. **Expected Behavior:**
   - Loading spinner appears: "Checking inventory..."
   - After ~1-3 seconds, items display with stock badges:
     - ✅ Green "In Stock" badge (all sizes available)
     - ⚠️ Yellow "Low Stock" badge (some sizes low/unavailable)
     - ❌ Red "Out of Stock" badge (no sizes available)

3. **Check Console Logs:**
   ```
   [Sample Cart] Checking inventory for cart items...
   [SampleInventory] Fetching inventory for PC54 Forest...
   [SampleInventory] ✓ Fetched 7 inventory records
   [Sample Cart] ✓ Inventory check complete
   ```

4. **Verify Stock Badges:**
   - [ ] Badge displays correct color
   - [ ] Icon shows (check circle, exclamation triangle, x circle)
   - [ ] Hover effects work
   - [ ] Badge styling matches design

5. **Verify Size Availability:**
   - [ ] Out-of-stock sizes show with strikethrough
   - [ ] Red diagonal line across unavailable sizes
   - [ ] Tooltip shows "Out of Stock" on hover

6. **Verify Warnings:**
   - [ ] Yellow warning box appears if some sizes unavailable
   - [ ] Lists specific unavailable sizes
   - [ ] Clear icon and messaging

### Phase 3: Checkout Validation

**Test Scenario:** Try to checkout with out-of-stock items

1. **Add out-of-stock item to cart** (simulate by checking a product with no inventory)

2. **Fill out checkout form** (all required fields)

3. **Click "Place Order" button**

4. **Expected Behavior:**
   - ❌ Order is BLOCKED
   - Red validation alert appears with:
     - "Cannot Complete Order" heading
     - List of out-of-stock items
     - Clear instructions to remove items
   - Console shows: `[Sample Cart] ❌ Checkout blocked: Out of stock items`
   - Page scrolls to alert

5. **Remove out-of-stock item:**
   - [ ] Click remove button (X icon)
   - [ ] Validation alert disappears
   - [ ] Can now proceed with checkout

### Phase 4: Add-to-Cart Validation

**Test Scenario:** Try to add out-of-stock item from product page

1. **Navigate to Top Sellers page:**
   - URL: `/pages/top-sellers-showcase.html`

2. **Click "Request Sample" on a product**

3. **Select:**
   - Color (choose one with low/no inventory if possible)
   - Size (choose unavailable size)
   - Quantity: 1

4. **Click "Add to Cart"**

5. **Expected Behavior (Out of Stock):**
   - ❌ Item is NOT added to cart
   - Warning toast appears: "[Product] ([Color]) - Size [S] is currently out of stock"
   - Cart count badge does NOT increment
   - Console shows: `[Sample Cart] ❌ Out of stock: PC54 Forest size M`

6. **Expected Behavior (Low Stock):**
   - ✅ Item IS added to cart
   - Warning toast appears: "Added to cart (only X left in stock)"
   - Cart count badge increments
   - Console shows: `[Sample Cart] ⚠️ Low stock: PC54 Forest size M (8 left)`

7. **Expected Behavior (In Stock):**
   - ✅ Item IS added to cart
   - Success toast appears
   - Console shows: `[Sample Cart] ✓ In stock: PC54 Forest size M`

### Phase 5: Cache Testing

**Test Scenario:** Verify caching works correctly

1. **Add item to cart** (triggers inventory check)

2. **Check console:**
   ```
   [SampleInventory] Fetching inventory for PC54 Forest...
   [SampleInventory] ✓ Fetched 7 inventory records
   ```

3. **Navigate to another page and back** (within 5 minutes)

4. **Check console:**
   ```
   [SampleInventory] ✓ Using cached data for PC54_Forest
   ```
   - [ ] Should NOT fetch from API
   - [ ] Should use cached data

5. **Wait 5+ minutes** (or clear cache)

6. **Reload page:**
   ```
   [SampleInventory] Cache expired, will fetch fresh data
   [SampleInventory] Fetching inventory for PC54 Forest...
   ```
   - [ ] Should fetch fresh data from API

**Console Command to Force Cache Clear:**
```javascript
window.sampleInventoryService.clearCache();
// Expected: "Cache cleared"
```

### Phase 6: Error Handling

**Test Scenario:** API failure graceful degradation

1. **Simulate API failure** (block network or use invalid product)

2. **Expected Behavior:**
   - ⚠️ Allows ordering (graceful degradation)
   - Shows "Unable to verify inventory" message
   - Does NOT block checkout
   - Console shows: `[SampleInventory] Error fetching inventory: ...`

3. **Verify:**
   - [ ] User can still complete order
   - [ ] Clear messaging about inventory verification failure
   - [ ] No JavaScript errors or crashes

### Phase 7: Edge Cases

**Test these scenarios:**

1. **Empty Cart:**
   - [ ] No inventory checks run
   - [ ] Empty cart message displays
   - [ ] No errors in console

2. **Mixed Stock Levels:**
   - [ ] Cart with in-stock + low-stock + out-of-stock items
   - [ ] Each shows appropriate badge
   - [ ] Checkout blocked only if any out-of-stock
   - [ ] Warnings show for low-stock items

3. **Product Without CATALOG_COLOR:**
   - [ ] Fallback to COLOR_NAME
   - [ ] Warning in console
   - [ ] Allows ordering (graceful degradation)

4. **Invalid Size Code:**
   - [ ] Shows "Unable to verify inventory"
   - [ ] Allows ordering
   - [ ] No errors

5. **Multiple Tabs:**
   - [ ] Cache shared across tabs (sessionStorage)
   - [ ] Opening cart in multiple tabs uses same cache
   - [ ] Adding item in one tab updates cache for others (on next load)

---

## 🐛 Common Issues & Solutions

### Issue 1: Stock Badge Not Showing

**Symptoms:**
- No stock badge appears on cart items
- Console shows: `[SampleInventory] Service not available`

**Solutions:**
1. Check inventory service script is loaded:
   ```javascript
   console.log(typeof window.SampleInventoryService);
   // Should be: "function"
   ```

2. Check service initialized:
   ```javascript
   console.log(window.sampleInventoryService);
   // Should be: SampleInventoryService {apiBase: "...", ...}
   ```

3. Clear browser cache and hard refresh (Ctrl+Shift+R)

### Issue 2: "Cannot read property 'checkCartInventory' of undefined"

**Cause:** Inventory service not loaded before cart page tries to use it

**Solution:**
- Ensure script tag is in correct order in HTML
- Check browser console for script load errors
- Verify file path: `/shared_components/js/sample-inventory-service.js`

### Issue 3: Inventory Always Shows "Checking..."

**Symptoms:**
- Gray "Checking..." badge never changes
- API calls failing in Network tab

**Solutions:**
1. Check ManageOrders API is accessible:
   ```javascript
   fetch('https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/manageorders/inventorylevels?PartNumber=PC54&Color=Forest')
     .then(r => r.json())
     .then(d => console.log(d));
   ```

2. Check CATALOG_COLOR field exists:
   ```javascript
   const cart = JSON.parse(sessionStorage.getItem('sampleCart'));
   console.log(cart.samples.map(s => ({
     style: s.style,
     color: s.color,
     catalogColor: s.catalogColor
   })));
   ```

3. Verify API response format matches expected structure

### Issue 4: Checkout Not Blocked for Out-of-Stock

**Cause:** Validation not running or validation result not checked

**Solution:**
1. Check console for validation logs:
   ```
   [Sample Cart] ❌ Checkout blocked: Out of stock items
   ```

2. Verify inventory status on items:
   ```javascript
   const cart = JSON.parse(sessionStorage.getItem('sampleCart'));
   console.log(cart.samples.map(s => ({
     name: s.name,
     inventoryStatus: s.inventoryStatus,
     allAvailable: s.allAvailable
   })));
   ```

3. Test validation directly:
   ```javascript
   const cart = JSON.parse(sessionStorage.getItem('sampleCart')).samples;
   const validation = window.sampleInventoryService.validateCheckout(cart);
   console.log(validation);
   ```

### Issue 5: Wrong Color Matched

**Symptoms:**
- Shows "No inventory record found"
- Inventory check fails for valid product

**Cause:** CATALOG_COLOR mismatch

**Solutions:**
1. Check CATALOG_COLOR field:
   ```javascript
   const cart = JSON.parse(sessionStorage.getItem('sampleCart'));
   console.log(cart.samples[0].catalogColor);
   // Should be ShopWorks internal code (e.g., "Forest" not "Forest Green")
   ```

2. Check API response color field:
   ```
   GET /api/manageorders/inventorylevels?PartNumber=PC54&Color=Forest
   ```

3. Verify color mapping in top-sellers-showcase.html:
   - Line ~214: `catalogColor: product.catalogColor || product.color`
   - Should use CATALOG_COLOR from color swatches API

---

## 📊 Performance Metrics

### Expected Performance

| Metric | Target | Measured |
|--------|--------|----------|
| Initial inventory check | <3 seconds | |
| Cached inventory check | <200ms | |
| Add-to-cart with check | <1 second | |
| Checkout validation | <500ms | |
| API response time | <2 seconds | |
| Cache hit rate | >80% | |

### Monitoring

**Console Commands for Performance Testing:**

```javascript
// Start performance timer
window.INVENTORY_PERF = { start: performance.now() };

// After inventory check
window.INVENTORY_PERF.end = performance.now();
console.log(`Inventory check took: ${(window.INVENTORY_PERF.end - window.INVENTORY_PERF.start).toFixed(2)}ms`);

// Check cache statistics
console.log(window.sampleInventoryService.cache.size + ' products cached');
```

---

## ✅ Final Testing Sign-Off

**Tester:** _______________
**Date:** _______________
**Version:** 1.0.0

### Core Functionality

- [ ] Inventory checks run on cart page load
- [ ] Stock badges display correctly (green/yellow/red)
- [ ] Size availability indicators work (strikethrough)
- [ ] Checkout validation blocks out-of-stock orders
- [ ] Add-to-cart validation prevents adding unavailable items
- [ ] Cache works correctly (5-minute TTL)
- [ ] Error handling graceful (allows ordering on API failure)

### User Experience

- [ ] Clear, user-friendly messages
- [ ] No confusing technical jargon
- [ ] Loading states show during API calls
- [ ] Smooth animations and transitions
- [ ] Mobile responsive (test on phone)
- [ ] Accessible (keyboard navigation, screen readers)

### Edge Cases

- [ ] Empty cart handled
- [ ] Mixed stock levels handled
- [ ] Invalid data handled gracefully
- [ ] API failures don't block checkout
- [ ] Multiple tabs work correctly

### Browser Compatibility

- [ ] Chrome (desktop)
- [ ] Firefox (desktop)
- [ ] Safari (desktop)
- [ ] Edge (desktop)
- [ ] Chrome (mobile)
- [ ] Safari (mobile iOS)

---

## 🚀 Deployment Checklist

**Before going live:**

- [ ] All tests pass
- [ ] No console errors
- [ ] Performance acceptable (<3s for inventory checks)
- [ ] Error handling tested
- [ ] Mobile tested
- [ ] Cross-browser tested
- [ ] Staging environment tested
- [ ] Erik approval

**After deployment:**

- [ ] Monitor console logs for errors
- [ ] Check API call volume (should use cache 80%+)
- [ ] Monitor order success rate
- [ ] Collect user feedback
- [ ] Track out-of-stock prevention metrics

---

## 📞 Support & Documentation

**Related Documentation:**
- ManageOrders PULL API: `/memory/MANAGEORDERS_INTEGRATION.md`
- API Reference: `/memory/manageorders/API_REFERENCE.md`
- Sample Cart Service: `/shared_components/js/sample-order-service.js`

**Key Contacts:**
- Erik Mickelson: Operations Manager
- API Integration: ManageOrders Support

**Console Debug Commands:**
```javascript
// Service status
window.sampleInventoryService.getStatus()

// Check specific product
await window.sampleInventoryService.checkSizeAvailability('PC54', 'Forest', 'M', 1)

// Clear cache
window.sampleInventoryService.clearCache()

// View cart with inventory
JSON.parse(sessionStorage.getItem('sampleCart'))
```

---

**Version:** 1.0.0
**Last Updated:** 2025-01-30
**Status:** ✅ Ready for Testing
