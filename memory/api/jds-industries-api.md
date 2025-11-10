# JDS Industries API - Engravable Products

**Quick Reference:** Laser-engravable products (mugs, tumblers, cutting boards, keychains, awards)

## 🎯 Overview

The JDS Industries API provides access to thousands of engravable products with real-time pricing and inventory. Perfect for:
- Adding specialty items to quote calculators
- Building product catalogs for laser engraving
- Real-time inventory checks
- Dynamic pricing based on quantity tiers

**Base URL:** `https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/jds`

**Cache Duration:** 1 hour (parameter-aware)

**Rate Limit:** 60 requests per minute per IP

---

## 📚 Available Endpoints

### 1. Batch Product Search (POST)
```
POST /api/jds/products
```

Search for multiple products at once by SKU. Returns partial results if some SKUs aren't found.

**Request Body:**
```json
{
  "skus": ["LPB004", "LTM7216", "LWB101"]
}
```

**Use Cases:**
- Loading multiple products for catalog page
- Featured products section
- Related products display
- Bulk inventory checks

**Response:**
```json
{
  "result": [
    {
      "sku": "LTM7216",
      "name": "Polar Camel 20 oz. Black Ringneck Tumbler with Logo Lid",
      "description": "20 oz. Stainless Steel...",
      "caseQuantity": 24,
      "lessThanCasePrice": 9.95,
      "oneCase": 8.30,
      "fiveCases": 7.95,
      "tenCases": 7.60,
      "twentyCases": 7.60,
      "fortyCases": 7.60,
      "availableQuantity": 78171,
      "localQuantity": 1190,
      "images": {
        "full": "https://...",
        "thumbnail": "https://...",
        "icon": "https://..."
      }
    }
  ],
  "count": 3,
  "cached": false
}
```

---

### 2. Single Product Details (GET)
```
GET /api/jds/products/:sku
```

Get complete details for one product including all pricing tiers and inventory.

**Parameters:**
- `:sku` - Product SKU (e.g., "LTM7216")
- `refresh` (optional) - Set to `true` to bypass cache

**Examples:**
```
GET /api/jds/products/LTM7216
GET /api/jds/products/LPB004?refresh=true
```

**Use Cases:**
- Product detail page
- Quote calculator product selection
- Price breakdown display

**Response:** Same structure as batch search, but with single product in `result` object (not array).

---

### 3. Inventory Check (GET)
```
GET /api/jds/inventory/:sku
```

Quick inventory-only check without loading full product data. **Lightweight and faster** for "Add to Cart" validation.

**Parameters:**
- `:sku` - Product SKU
- `refresh` (optional) - Cache bypass

**Examples:**
```
GET /api/jds/inventory/LTM7216
GET /api/jds/inventory/LPB004?refresh=true
```

**Use Cases:**
- Pre-checkout inventory validation
- Real-time stock indicators
- Availability badges
- Cart validation

**Response:**
```json
{
  "result": {
    "sku": "LTM7216",
    "availableQuantity": 78171,
    "localQuantity": 1190,
    "caseQuantity": 24,
    "inStock": true
  },
  "cached": false
}
```

---

### 4. Health Check (GET)
```
GET /api/jds/health
```

Check service status and configuration. No parameters required.

**Response:**
```json
{
  "status": "healthy",
  "service": "JDS Industries API",
  "timestamp": "2025-11-06T10:30:00Z",
  "config": {
    "cacheEnabled": true,
    "cacheDuration": "1 hour",
    "rateLimit": "60 req/min"
  },
  "endpoints": {
    "batchSearch": "POST /api/jds/products",
    "singleProduct": "GET /api/jds/products/:sku",
    "inventory": "GET /api/jds/inventory/:sku",
    "health": "GET /api/jds/health"
  }
}
```

---

## 💰 Pricing Tiers Explained

JDS uses **price-per-unit** tiers based on total quantity:

| Tier | Quantity Range | Field Name |
|------|----------------|------------|
| Less than case | 1 - (case qty - 1) | `lessThanCasePrice` |
| 1 Case | case qty - (5 cases - 1) | `oneCase` |
| 5 Cases | 5 cases - (10 cases - 1) | `fiveCases` |
| 10 Cases | 10 cases - (20 cases - 1) | `tenCases` |
| 20 Cases | 20 cases - (40 cases - 1) | `twentyCases` |
| 40+ Cases | 40 cases or more | `fortyCases` |

**Example:** LTM7216 (Case Qty: 24)
- **1-23 units:** $9.95 each
- **24-119 units:** $8.30 each
- **120-239 units:** $7.95 each
- **240-479 units:** $7.60 each
- **480+ units:** $7.60 each

### Calculating Price for Quote
```javascript
function calculateJDSPrice(product, quantity) {
  const caseQty = product.caseQuantity;

  if (quantity < caseQty) {
    return product.lessThanCasePrice * quantity;
  } else if (quantity < caseQty * 5) {
    return product.oneCase * quantity;
  } else if (quantity < caseQty * 10) {
    return product.fiveCases * quantity;
  } else if (quantity < caseQty * 20) {
    return product.tenCases * quantity;
  } else if (quantity < caseQty * 40) {
    return product.twentyCases * quantity;
  } else {
    return product.fortyCases * quantity;
  }
}

// Example:
// calculateJDSPrice(product, 50) → 50 × $8.30 = $415.00
```

---

## 📦 Product Object Structure

### Key Fields for UI

**Product Info:**
- `sku` (string) - Product SKU
- `name` (string) - Full product name
- `description` (string) - Detailed description
- `caseQuantity` (number) - Units per case

**Pricing (price per unit):**
- `lessThanCasePrice` (number)
- `oneCase` (number)
- `fiveCases` (number)
- `tenCases` (number)
- `twentyCases` (number)
- `fortyCases` (number)

**Inventory:**
- `availableQuantity` (number) - Total stock across all warehouses
- `localQuantity` (number) - Stock in nearest warehouse
- `inStock` (boolean) - Quick availability flag

**Images:**
- `images.full` (string) - High-res product image
- `images.thumbnail` (string) - 300×300 thumbnail
- `images.icon` (string) - 60×60 icon

**Legacy Image Fields (also available):**
- `image` - Same as `images.full`
- `thumbnail` - Same as `images.thumbnail`
- `quickImage` - Same as `images.icon`

---

## 🛠️ Integration Examples

### JavaScript Fetch - Single Product

```javascript
async function loadJDSProduct(sku) {
  const url = `https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/jds/products/${sku}`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return data.result;
  } catch (error) {
    console.error('Failed to load JDS product:', error);
    return null;
  }
}

// Usage:
const product = await loadJDSProduct('LTM7216');
if (product) {
  console.log(`${product.name}: $${product.oneCase} (24+ units)`);
  console.log(`In stock: ${product.availableQuantity} units`);
}
```

### JavaScript Fetch - Batch Products

```javascript
async function loadJDSProducts(skus) {
  const url = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/jds/products';

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ skus })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    return data.result; // Array of products
  } catch (error) {
    console.error('Failed to load JDS products:', error);
    return [];
  }
}

// Usage:
const products = await loadJDSProducts(['LTM7216', 'LPB004', 'LWB101']);
products.forEach(product => {
  console.log(`${product.sku}: ${product.name}`);
});
```

### HTML Integration - Product Card

```html
<div id="jds-product-card"></div>

<script>
async function displayJDSProduct(sku) {
  const product = await loadJDSProduct(sku);

  if (!product) {
    document.getElementById('jds-product-card').innerHTML =
      '<p>Product not found</p>';
    return;
  }

  const card = `
    <div class="product-card">
      <img src="${product.images.thumbnail}" alt="${product.name}">
      <h3>${product.name}</h3>
      <p>${product.description}</p>

      <div class="pricing">
        <h4>Pricing Tiers:</h4>
        <ul>
          <li>1-${product.caseQuantity - 1}: $${product.lessThanCasePrice}</li>
          <li>${product.caseQuantity}+: $${product.oneCase}</li>
          <li>${product.caseQuantity * 5}+: $${product.fiveCases}</li>
        </ul>
      </div>

      <div class="stock ${product.availableQuantity > 0 ? 'in-stock' : 'out-of-stock'}">
        ${product.availableQuantity > 0
          ? `In Stock: ${product.availableQuantity} units`
          : 'Out of Stock'}
      </div>
    </div>
  `;

  document.getElementById('jds-product-card').innerHTML = card;
}

// Load product
displayJDSProduct('LTM7216');
</script>
```

### Inventory Check Before Add to Cart

```javascript
async function checkJDSInventory(sku, requestedQty) {
  const url = `https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/jds/inventory/${sku}`;

  try {
    const response = await fetch(url);
    const data = await response.json();
    const inventory = data.result;

    if (inventory.availableQuantity >= requestedQty) {
      return {
        available: true,
        message: `${requestedQty} units available`
      };
    } else {
      return {
        available: false,
        message: `Only ${inventory.availableQuantity} units in stock`
      };
    }
  } catch (error) {
    return {
      available: false,
      message: 'Unable to check inventory'
    };
  }
}

// Usage:
const check = await checkJDSInventory('LTM7216', 50);
if (check.available) {
  // Add to cart
  console.log('Adding to cart...');
} else {
  alert(check.message);
}
```

---

## 🎨 Common Use Cases

### 1. Pricing Calculator Integration

Add JDS products to a quote calculator:

```javascript
// In your pricing calculator
async function addJDSProductToQuote(sku, quantity) {
  const product = await loadJDSProduct(sku);

  if (!product) {
    alert('Product not found');
    return;
  }

  const unitPrice = calculateJDSPrice(product, quantity);
  const total = unitPrice * quantity;

  // Add to quote
  addLineItem({
    sku: product.sku,
    name: product.name,
    quantity: quantity,
    unitPrice: unitPrice,
    total: total,
    image: product.images.thumbnail
  });
}
```

### 2. Product Catalog Page

Display multiple JDS products:

```javascript
async function loadJDSCatalog() {
  // Featured JDS products
  const skus = ['LTM7216', 'LPB004', 'LWB101', 'LKC018'];

  const products = await loadJDSProducts(skus);

  const catalogHTML = products.map(product => `
    <div class="catalog-item">
      <img src="${product.images.thumbnail}" alt="${product.name}">
      <h4>${product.name}</h4>
      <p class="price">Starting at $${product.oneCase}</p>
      <button onclick="viewProduct('${product.sku}')">View Details</button>
    </div>
  `).join('');

  document.getElementById('jds-catalog').innerHTML = catalogHTML;
}
```

### 3. Real-Time Stock Indicator

Show availability badge:

```javascript
async function updateStockBadge(sku) {
  const inventory = await fetch(
    `https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/jds/inventory/${sku}`
  ).then(r => r.json());

  const badge = document.getElementById(`stock-${sku}`);

  if (inventory.result.availableQuantity > 100) {
    badge.className = 'badge in-stock';
    badge.textContent = 'In Stock';
  } else if (inventory.result.availableQuantity > 0) {
    badge.className = 'badge low-stock';
    badge.textContent = `Only ${inventory.result.availableQuantity} left`;
  } else {
    badge.className = 'badge out-of-stock';
    badge.textContent = 'Out of Stock';
  }
}
```

---

## ⚡ Cache Behavior

**What You Need to Know:**

- **Duration:** 1 hour (responses cached for 60 minutes)
- **Parameter-Aware:** Different SKUs cached separately
- **Order-Independent:** Batch requests with same SKUs (different order) share cache
- **Bypass:** Add `?refresh=true` to force fresh data
- **Indicator:** Response includes `"cached": true/false` field

**When to Use Cache Bypass:**

✅ **Use `?refresh=true` when:**
- User explicitly clicks "Refresh"
- Critical inventory check before checkout
- After system update notifications

❌ **Don't use `?refresh=true` for:**
- Normal page loads (wastes API calls)
- Background updates
- Catalog browsing

**Example:**
```javascript
// Normal load - uses cache
const product = await loadJDSProduct('LTM7216');

// Force refresh - bypasses cache
const freshProduct = await loadJDSProduct('LTM7216?refresh=true');
```

---

## 🚨 Rate Limiting

**Limit:** 60 requests per minute per IP address

**What Happens When Exceeded:**
- HTTP 429 (Too Many Requests)
- Response includes `retryAfter` field (seconds to wait)
- Response headers: `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`

**Best Practices:**

1. **Use Batch Endpoint** - Load multiple products in one request
2. **Respect Cache** - Don't use `?refresh=true` unnecessarily
3. **Debounce User Input** - Wait for typing to stop before searching
4. **Handle 429 Gracefully** - Show friendly message, retry after delay

**Example Rate Limit Handler:**
```javascript
async function fetchWithRateLimit(url) {
  const response = await fetch(url);

  if (response.status === 429) {
    const retryAfter = response.headers.get('Retry-After') || 60;
    console.warn(`Rate limited. Retry after ${retryAfter} seconds`);

    // Show user message
    alert(`Please wait ${retryAfter} seconds before trying again`);
    return null;
  }

  return response.json();
}
```

---

## 📝 Test Products

Use these SKUs for testing:

| SKU | Product | Case Qty | Price Range |
|-----|---------|----------|-------------|
| LTM7216 | Polar Camel 20 oz. Tumbler | 24 | $7.60 - $9.95 |
| LPB004 | Polar Camel 18 oz. Pet Bowl | 12 | Varies |
| LWB101 | Polar Camel 20 oz. Water Bottle | Varies | Varies |

**Live Test URLs:**
```
GET https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/jds/products/LTM7216
GET https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/jds/inventory/LPB004
POST https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/jds/products
     Body: {"skus": ["LTM7216", "LPB004"]}
```

---

## 🔗 Related Documentation

- **Provider Docs:** `caspio-pricing-proxy/memory/JDS_INTEGRATION.md` (implementation details)
- **Core API Reference:** `memory/CASPIO_API_CORE.md`
- **Product API:** `memory/api/products-api.md` (Sanmar products)

---

## 💡 Quick Tips

1. **Batch when possible** - Use POST endpoint for multiple products
2. **Cache is your friend** - 1-hour cache reduces load time significantly
3. **Inventory endpoint is faster** - Use for quick stock checks
4. **Calculate prices client-side** - Use tier structure to show price breaks
5. **Handle missing products gracefully** - Batch endpoint returns partial results
6. **Check `cached` field** - Know if you're seeing fresh data
7. **Monitor rate limit headers** - Stay under 60 req/min

---

**Last Updated:** November 6, 2025
**API Version:** 1.0
**Base URL:** https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/jds
