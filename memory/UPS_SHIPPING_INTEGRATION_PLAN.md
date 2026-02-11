# UPS Shipping Rate Integration — Embroidery Quote Builder (FUTURE)

## Context

Sales reps currently have no way to estimate shipping costs within the quote builder. They either quote shipping separately or look it up manually. This plan adds UPS real-time rate calculation directly in the embroidery quote builder so shipping can be included in the quote total.

**Scope**: Embroidery quote builder only (other builders later). UPS only (direct API, not aggregator).
**Status**: PLANNED — not yet implemented. Researched 2026-02-10.

## Prerequisites (Erik must do manually)

1. **Register at [developer.ups.com](https://developer.ups.com)**
   - Create an app, enable "Rating" API
   - Get: `Client ID`, `Client Secret`, `UPS Account Number`
   - Use **production** credentials (sandbox rates aren't accurate)
2. **Set Heroku env vars** on caspio-pricing-proxy:
   ```
   heroku config:set UPS_CLIENT_ID=xxx UPS_CLIENT_SECRET=xxx UPS_ACCOUNT_NUMBER=xxx
   ```
3. **Confirm origin ZIP** — currently `APP_CONFIG.COMPANY.ADDRESS.ZIP = '98402'` (Tacoma, WA). Is this correct for embroidery shipments?

---

## Files to Create/Modify

| # | File | Action | Description |
|---|------|--------|-------------|
| 1 | `caspio-pricing-proxy/src/routes/shipping.js` | **CREATE** | Backend: UPS OAuth, weight estimation, rate fetching |
| 2 | `caspio-pricing-proxy/server.js` | Modify (~line 496) | Register shipping route with rate limiter |
| 3 | `quote-builders/embroidery-quote-builder.html` | Modify | Shipping panel HTML + fee row + JS functions |
| 4 | `shared_components/js/embroidery-quote-service.js` | Modify | Add shipping fields to save/update + SHIP fee item |

---

## Step 1: Backend — `shipping.js` route

**New file**: `caspio-pricing-proxy/src/routes/shipping.js`

### UPS OAuth Token Management
- Same pattern as Caspio token caching in `src/utils/caspio.js` (lines 8-47)
- In-memory cache with 60s expiry buffer
- `getUPSAccessToken()` → POST to `https://onlinetools.ups.com/security/v1/oauth/token`
- Basic Auth header with `base64(clientId:clientSecret)`
- UPS tokens last ~4 hours

### Weight Estimation (category-based)
Product weight estimated by `CATEGORY_NAME` already available in product data:
```
T-Shirts: 5.5 oz | Polos/Knits: 8 oz | Sweatshirts/Fleece: 16 oz
Outerwear/Jackets: 24 oz | Woven Shirts: 8 oz | Caps/Headwear: 3.5 oz
Bags: 8 oz | Accessories: 4 oz | Default: 6 oz
```
- Frontend sends `items: [{ category, quantity, isCap }]`
- Backend sums `weight × qty` + packaging overhead (4-32 oz based on total weight)
- Optional `weightOverrideLbs` param for manual override
- Round up to nearest 0.5 lbs for UPS

### Box Dimension Estimation
Simple weight-based tiers:
- ≤5 lbs → 12×10×6" | ≤15 lbs → 16×12×8" | ≤30 lbs → 20×16×12"
- ≤50 lbs → 24×18×14" | >50 lbs → split into multiple 24×18×14" boxes

### UPS Rating API Call
- Endpoint: `POST https://onlinetools.ups.com/api/rating/v2408/Rate`
- `RequestOption: "Shop"` → returns all service rates at once (Ground, 3 Day, 2nd Day, Next Day)
- Origin: NWCA address (hardcoded from env or config)
- For multi-box: `Package` array with weight split evenly

### Endpoint
```
POST /api/shipping/ups-rates

Request:  { destination: { address1, city, state, zip }, items: [...], weightOverrideLbs? }
Response: { success, rates: [{ service, serviceCode, totalCharge, deliveryDays }],
            packageDetails: { totalWeightLbs, estimatedBoxes, weightSource } }
```

### Error handling
- Missing UPS credentials → 503 with friendly message
- UPS API timeout/error → 502 with "Unable to get UPS rates"
- Invalid address / no rates → 400 with "No rates found"

---

## Step 2: Register Route in `server.js`

Add after last route block (~line 496), following existing `manageOrdersLimiter` pattern:
```javascript
const shippingLimiter = rateLimit({ windowMs: 60000, max: 20, ... });
const shippingRoutes = require('./src/routes/shipping');
app.use('/api', shippingLimiter, shippingRoutes);
```

---

## Step 3: Frontend — Quote Builder HTML & JS

### 3a. Shipping Panel (HTML)
**Location**: Between "Additional Charges" panel (ends line 660) and "Totals Section" (line 662).

Collapsible panel matching existing style (blue theme `#eff6ff` / `#93c5fd`):
- Street Address input
- City / State dropdown / ZIP row (flex layout)
- Weight Override input (optional, "leave blank for auto-estimate")
- "Calculate Shipping" button
- Results area: shows est. weight, box count, and rate options as radio cards
- Error display area

### 3b. Shipping Fee Row (HTML)
**Location**: After discount row (line 445), before `</tbody>` (line 446).

Follows exact pattern of existing fee rows (e.g., rush-fee-row at line 427):
```html
<tr id="shipping-fee-row" class="fee-row" style="display: none;">
    <td colspan="10" class="fee-label">
        <i class="fas fa-truck"></i> Shipping - <span id="shipping-service-label">UPS Ground</span>
    </td>
    <td class="cell-qty">1</td>
    <td class="cell-price" id="shipping-fee-unit">$0.00</td>
    <td class="cell-total" id="shipping-fee-total">$0.00</td>
    <td class="cell-actions">
        <button class="btn-remove-size" onclick="clearShippingRate()" title="Remove shipping">
            <i class="fas fa-times"></i>
        </button>
    </td>
</tr>
```

### 3c. JavaScript Functions
Add after `updateFeeTableRows()` (~line 7258):

| Function | Purpose |
|----------|---------|
| `toggleShippingPanel()` | Collapse/expand shipping section |
| `calculateShippingRates()` | Validate ZIP, collect items, call API, show results |
| `displayShippingRates(data)` | Render rate radio cards in results area |
| `selectShippingRate(radio)` | Update fee row, badge, call `updateTaxCalculation()` |
| `clearShippingRate()` | Hide fee row, uncheck radios, update totals |
| `getShippingCharge()` | Returns `currentShippingRate?.charge || 0` |

### 3d. Store Category on Product Rows
In `onStyleChange()` / product lookup, add `row.dataset.category = product.CATEGORY_NAME` when setting product data. `CATEGORY_NAME` is already returned by `/api/product-details`.

### 3e. Include Shipping in Totals

**`calculateDiscountableSubtotal()`** (line 6506): Add `getShippingCharge()` to `additionalCharges` sum at line 6518:
```javascript
const shippingCharge = getShippingCharge();
const additionalCharges = artCharge + designFee + rushFee + (sampleFee * sampleQty) + shippingCharge;
```
This flows through to `updateTaxCalculation()` automatically since it calls `calculateDiscountableSubtotal()`.

---

## Step 4: Save/Load Integration

### 4a. `customerData` in `saveAndGetLink()` (line 6663)
Add to the customerData object:
```javascript
shippingCharge: getShippingCharge(),
shippingService: currentShippingRate?.service || '',
shippingAddress: {
    address1: document.getElementById('ship-address1')?.value?.trim() || '',
    city: document.getElementById('ship-city')?.value?.trim() || '',
    state: document.getElementById('ship-state')?.value || '',
    zip: document.getElementById('ship-zip')?.value?.trim() || ''
}
```

### 4b. `sessionData` in `embroidery-quote-service.js`
Add to `saveQuote()` sessionData (after line 219 TotalAmount):
```javascript
ShippingCharge: parseFloat((customerData.shippingCharge || 0).toFixed(2)),
ShippingService: customerData.shippingService || '',
```
Same fields in `updateQuote()` sessionData (~line 1165).

**`TotalAmount` formula** (line 212): Add `+ (customerData.shippingCharge || 0)` to the sum.

### 4c. SHIP fee in `_saveFeeLineItems()` (after line 635)
```javascript
if (sessionData.ShippingCharge > 0) {
    feeItems.push({
        StyleNumber: 'SHIP',
        ProductName: `Shipping - ${sessionData.ShippingService || 'UPS'}`,
        Quantity: 1,
        BaseUnitPrice: sessionData.ShippingCharge,
        FinalUnitPrice: sessionData.ShippingCharge,
        LineTotal: sessionData.ShippingCharge
    });
}
```

---

## What This Does NOT Include (future enhancements)
- Address autocomplete (Google Places API)
- Other quote builders (DTG, DTF, Screenprint)
- Saving/restoring shipping address on quote load/draft restore
- SanMar API weight data (would replace category estimation)
- FedEx/USPS rates (would need aggregator API)

---

## Verification

1. **Backend**: Set UPS env vars locally → `POST /api/shipping/ups-rates` with test address → verify rates returned
2. **Frontend**: Open embroidery builder → add products → expand Shipping panel → enter address → click Calculate → verify rate cards appear
3. **Rate selection**: Click a rate → verify fee row appears in product table → verify Subtotal and Grand Total include shipping
4. **Save**: Save quote → verify `SHIP` fee item in `quote_items` table → verify `TotalAmount` includes shipping
5. **Edge cases**: No products (should show error), invalid ZIP, UPS API down (graceful error), clear shipping (fee row disappears, totals update)
