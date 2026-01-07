# Quote Builder API Integration Guide

API endpoints and patterns used by quote builders. All endpoints use the caspio-pricing-proxy backend.

**Base URL**: `https://caspio-pricing-proxy-ab30a049961a.herokuapp.com`

---

## Quick Reference

| Endpoint | Purpose | Quote Builder Usage |
|----------|---------|---------------------|
| `/api/pricing-bundle` | Pricing tiers, margins, LTM | Core pricing |
| `/api/sanmar-products/details` | Product info | Product display |
| `/api/sanmar-products/colors` | Available colors | Color picker |
| `/api/sanmar-products/styles` | Style search | Autocomplete |
| `/api/quote_sessions` | Save quote header | Quote save |
| `/api/quote_items` | Save quote line items | Quote save |
| `/api/inventory` | Stock availability | Inventory check |

---

## 1. Pricing Bundle Endpoint

**Most important endpoint** - contains all pricing data for a method type.

### Request

```
GET /api/pricing-bundle?method={METHOD}&styleNumber={STYLE}
```

| Parameter | Required | Values |
|-----------|----------|--------|
| `method` | Yes | `DTF`, `DTG`, `Embroidery`, `ScreenPrint`, `Sticker` |
| `styleNumber` | No | If provided, returns product-specific pricing |

### Example Request

```javascript
const response = await fetch(
    `https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/pricing-bundle?method=DTF&styleNumber=PC54`
);
const data = await response.json();
```

### Response Structure

```javascript
{
    // Tier pricing (array of tiers)
    "tiersR": [
        {
            "minQuantity": 10,
            "maxQuantity": 23,
            "tierLabel": "10-23",
            "ltmFee": 50.00,           // Less Than Minimum fee
            "marginDenominator": 0.57   // For pricing formula
        },
        {
            "minQuantity": 24,
            "maxQuantity": 47,
            "tierLabel": "24-47",
            "ltmFee": 0,
            "marginDenominator": 0.57
        }
        // ... more tiers
    ],

    // Transfer costs (DTF specific)
    "transferPricing": {
        "Small": { "transferCost": 1.50 },
        "Medium": { "transferCost": 3.00 },
        "Large": { "transferCost": 5.00 },
        "Oversized": { "transferCost": 8.00 }
    },

    // Labor and freight per location
    "laborCostPerLocation": 0.30,
    "freightPerTransfer": 0.25,

    // Rounding rule
    "roundingMethod": "HalfDollarCeil_Final"
}
```

### Using Tier Data

```javascript
// Get correct tier for quantity
getTierForQuantity(qty) {
    const tier = this.tiersR.find(t =>
        qty >= t.minQuantity && qty <= t.maxQuantity
    );
    return tier || this.tiersR[this.tiersR.length - 1]; // Default to highest
}

// Calculate LTM per unit
calculateLTMPerUnit(qty) {
    const tier = this.getTierForQuantity(qty);
    if (tier.ltmFee > 0 && qty > 0) {
        return tier.ltmFee / qty;
    }
    return 0;
}
```

---

## 2. Product Details Endpoint

Get full product information for display.

### Request

```
GET /api/sanmar-products/details?style={STYLE}
```

### Example

```javascript
const response = await fetch(
    `https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/sanmar-products/details?style=PC54`
);
const product = await response.json();
```

### Response

```javascript
{
    "STYLE_NUMBER": "PC54",
    "PRODUCT_TITLE": "Port & Company® - Core Cotton Tee",
    "SHORT_DESCRIPTION": "Heavyweight 5.4-oz, 100% cotton",
    "CATEGORY": "T-Shirts",
    "BRAND": "Port & Company",
    "MSRP": 12.98,
    "WHOLESALE_PRICE": 5.98,
    "SIZE_RANGE": "S-6XL",
    "PRODUCT_IMAGE": "https://..."
}
```

---

## 3. Colors Endpoint

Get available colors with swatches for color picker.

### Request

```
GET /api/sanmar-products/colors?style={STYLE}
```

### Example

```javascript
const response = await fetch(
    `https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/sanmar-products/colors?style=PC54`
);
const colors = await response.json();
```

### Response

```javascript
[
    {
        "COLOR_NAME": "Athletic Heather",      // Display name
        "CATALOG_COLOR": "Athletic Hthr",      // Use for API/inventory
        "HEX_CODE": "#B5B5B5",                 // Fallback color
        "COLOR_SQUARE_IMAGE": "https://..."   // Swatch image
    },
    {
        "COLOR_NAME": "Black",
        "CATALOG_COLOR": "Black",
        "HEX_CODE": "#000000",
        "COLOR_SQUARE_IMAGE": "https://..."
    }
    // ... more colors
]
```

### Important: COLOR_NAME vs CATALOG_COLOR

| Field | Use For | Example |
|-------|---------|---------|
| `COLOR_NAME` | Display to user | "Athletic Heather" |
| `CATALOG_COLOR` | API calls, inventory, ShopWorks | "Athletic Hthr" |

**Always store both** - display COLOR_NAME but use CATALOG_COLOR for API calls.

---

## 4. Style Search Endpoint

Search for products by style number (used by autocomplete).

### Request

```
GET /api/sanmar-products/styles?search={QUERY}&limit={LIMIT}
```

### Example

```javascript
const response = await fetch(
    `https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/sanmar-products/styles?search=PC54&limit=10`
);
const results = await response.json();
```

### Response

```javascript
[
    {
        "value": "PC54",
        "label": "Port & Company® - Core Cotton Tee"
    },
    {
        "value": "PC54Y",
        "label": "Port & Company® - Youth Core Cotton Tee"
    }
    // ... more results
]
```

---

## 5. Quote Save Endpoints

### Save Quote Session (Header)

```javascript
const response = await fetch(`${API_BASE}/api/quote_sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        quoteID: 'DTF0107-1234',
        customerName: 'John Doe',
        customerEmail: 'john@example.com',
        customerPhone: '253-555-1234',
        method: 'DTF',
        totalPieces: 50,
        grandTotal: 750.00,
        status: 'Draft',
        createdAt: new Date().toISOString()
    })
});
```

### Save Quote Items (Line Items)

```javascript
const response = await fetch(`${API_BASE}/api/quote_items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        quoteID: 'DTF0107-1234',
        styleNumber: 'PC54',
        partNumber: 'PC54_2X',        // With size suffix
        catalogColor: 'Athletic Hthr', // CATALOG_COLOR, not COLOR_NAME
        size: '2XL',
        quantity: 10,
        unitPrice: 15.00,
        lineTotal: 150.00
    })
});
```

---

## 6. Inventory Check Endpoint

Verify stock before quote finalization.

### Request

```
GET /api/inventory?style={STYLE}&color={CATALOG_COLOR}
```

**Important**: Use `CATALOG_COLOR`, not `COLOR_NAME`.

### Example

```javascript
const response = await fetch(
    `https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/inventory?style=PC54&color=Athletic%20Hthr`
);
const inventory = await response.json();
```

### Response

```javascript
{
    "style": "PC54",
    "color": "Athletic Hthr",
    "sizes": {
        "S": 1500,
        "M": 2000,
        "L": 2500,
        "XL": 1800,
        "2XL": 900,
        "3XL": 400
    },
    "lastUpdated": "2026-01-07T10:30:00Z"
}
```

---

## 7. Parallel API Fetching Pattern

Always fetch multiple endpoints in parallel using `Promise.all()`.

```javascript
async loadProductData(styleNumber) {
    const baseURL = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';

    try {
        const [pricingRes, detailsRes, colorsRes] = await Promise.all([
            fetch(`${baseURL}/api/pricing-bundle?method=DTF&styleNumber=${styleNumber}`),
            fetch(`${baseURL}/api/sanmar-products/details?style=${styleNumber}`),
            fetch(`${baseURL}/api/sanmar-products/colors?style=${styleNumber}`)
        ]);

        // Check responses
        if (!pricingRes.ok) throw new Error('Pricing API failed');
        if (!detailsRes.ok) throw new Error('Details API failed');
        if (!colorsRes.ok) throw new Error('Colors API failed');

        const [pricing, details, colors] = await Promise.all([
            pricingRes.json(),
            detailsRes.json(),
            colorsRes.json()
        ]);

        return { pricing, details, colors };

    } catch (error) {
        console.error('[API] Error:', error);
        this.showError('Unable to load data. Please refresh.');
        throw error; // Never silently fail
    }
}
```

---

## 8. Error Handling Rules

### DO

```javascript
// Show error to user
this.showError('Unable to load pricing. Please refresh.');

// Disable submit button
document.getElementById('continue-btn').disabled = true;

// Log for debugging
console.error('[QuoteBuilder] API failed:', error);

// Re-throw to stop execution
throw error;
```

### DON'T

```javascript
// WRONG - Silent fallback
catch (error) {
    const data = getHardcodedFallback(); // NO!
}

// WRONG - Ignore error
catch (error) {
    // do nothing
}

// WRONG - Use cached data without telling user
catch (error) {
    const data = localStorage.getItem('lastPricing'); // NO!
}
```

---

## 9. Caching Strategy

| Data Type | Cache Duration | Storage |
|-----------|----------------|---------|
| Pricing bundle | None (always fresh) | - |
| Product details | 24 hours | localStorage |
| Colors | 24 hours | localStorage |
| Search results | 5 minutes | Memory only |

### Example Cache Implementation

```javascript
async getProductDetails(styleNumber) {
    const cacheKey = `product_${styleNumber}`;
    const cached = localStorage.getItem(cacheKey);

    if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        const age = Date.now() - timestamp;
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours

        if (age < maxAge) {
            return data;
        }
    }

    // Fetch fresh data
    const response = await fetch(`${API_BASE}/api/sanmar-products/details?style=${styleNumber}`);
    const data = await response.json();

    // Cache it
    localStorage.setItem(cacheKey, JSON.stringify({
        data,
        timestamp: Date.now()
    }));

    return data;
}
```

---

## 10. Method-Specific Endpoints

Each quote builder type may have additional endpoints:

### DTF
- `/api/pricing-bundle?method=DTF` - Transfer sizes & costs

### DTG
- `/api/pricing-bundle?method=DTG` - Print costs by garment type

### Embroidery
- `/api/pricing-bundle?method=Embroidery` - Stitch count pricing
- `/api/embroidery/digitizing-fees` - Digitizing costs

### Screen Print
- `/api/pricing-bundle?method=ScreenPrint` - Per-color setup fees
- `/api/screenprint/ink-colors` - Available ink options

### Sticker (Future)
- `/api/pricing-bundle?method=Sticker` - Size/quantity pricing
- `/api/sticker/materials` - Vinyl, paper, etc.

---

## API Response Codes

| Code | Meaning | Action |
|------|---------|--------|
| 200 | Success | Process data |
| 400 | Bad request | Check parameters |
| 404 | Not found | Product doesn't exist |
| 500 | Server error | Show error, retry later |
| 503 | Service unavailable | Show error, API down |

---

## Testing API Calls

Use browser console or curl:

```bash
# Test pricing bundle
curl "https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/pricing-bundle?method=DTF&styleNumber=PC54"

# Test colors
curl "https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/sanmar-products/colors?style=PC54"

# Test search
curl "https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/sanmar-products/styles?search=PC54&limit=5"
```
