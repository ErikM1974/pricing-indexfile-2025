# Product APIs Documentation

## 📦 MODULE: PRODUCTS

### Overview
Enhanced product search with faceted filtering, product details, colors, and inventory management.

### Business Rules
- Products grouped by style to eliminate duplicates
- Active products shown by default (use status=all for everything)
- Faceted search provides filter counts for UI
- Maximum 100 results per page

### Resource: products/search (Enhanced)

#### Enhanced Product Search with Facets
**Endpoint**: `GET /api/products/search`
**Purpose**: Advanced product search with smart grouping and faceted filtering

**Query Parameters**:
| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| q | string | No | Search across style, title, description, keywords, brand | "polo shirt" |
| category | array | No | Filter by categories | category[]=Polos&category[]=T-Shirts |
| brand | array | No | Filter by brands | brand[]=Port Authority |
| color | array | No | Filter by colors | color[]=Black&color[]=Navy |
| size | array | No | Filter by sizes | size[]=L&size[]=XL |
| minPrice | number | No | Minimum price filter | 10 |
| maxPrice | number | No | Maximum price filter | 50 |
| status | string | No | Product status filter | Active/Discontinued/all |
| sort | string | No | Sort order | name_asc, price_asc, newest |
| page | number | No | Page number (default: 1) | 1 |
| limit | number | No | Results per page (max: 100) | 24 |
| includeFacets | boolean | No | Include filter counts | true |

**Success Response with Facets (200 OK)**:
```json
{
  "products": [
    {
      "style": "PC54",
      "title": "Port & Company Core Blend Tee",
      "brand": "Port & Company",
      "category": "T-Shirts",
      "subcategory": "Short Sleeve",
      "description": "5.5-ounce, 50/50 cotton/poly",
      "keywords": "tshirt, cotton, blend",
      "minPrice": 4.42,
      "maxPrice": 6.64,
      "colors": ["Jet Black", "Navy", "Red", "Royal"],
      "sizes": ["XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL"],
      "imageUrl": "https://...",
      "status": "Active",
      "isNew": false,
      "isBestSeller": true
    }
  ],
  "facets": {
    "categories": {
      "T-Shirts": 156,
      "Polos": 89,
      "Outerwear": 45
    },
    "brands": {
      "Port & Company": 78,
      "Port Authority": 65,
      "District": 43
    },
    "colors": {
      "Black": 234,
      "Navy": 198,
      "White": 187
    },
    "sizes": {
      "S": 300,
      "M": 300,
      "L": 300,
      "XL": 285
    },
    "priceRanges": {
      "0-10": 123,
      "10-25": 187,
      "25-50": 98,
      "50+": 34
    }
  },
  "pagination": {
    "page": 1,
    "limit": 24,
    "total": 442,
    "totalPages": 19,
    "hasMore": true
  }
}
```

### Resource: product-details

#### Get Product Details
**Endpoint**: `GET /api/product-details`
**Purpose**: Get complete product information

**Query Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| styleNumber | string | Yes | Product style number |
| color | string | No | Specific color (optional) |

**Success Response**:
```json
{
  "data": {
    "STYLE": "PC54",
    "ProductTitle": "Port & Company Core Blend Tee",
    "Brand": "Port & Company",
    "Category": "T-Shirts",
    "Description": "5.5-ounce, 50/50 cotton/poly",
    "BasePrice": 4.42,
    "Colors": ["Black", "Navy", "Red"],
    "Sizes": ["S", "M", "L", "XL"],
    "Status": "Active"
  }
}
```

### Resource: color-swatches

#### Get Color Swatches
**Endpoint**: `GET /api/color-swatches`
**Purpose**: Get color swatches for a style

**Query Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| styleNumber | string | Yes | Product style number |

**Success Response**:
```json
{
  "data": [
    {
      "color": "Black",
      "colorCode": "BLK",
      "hexCode": "#000000",
      "swatchUrl": "https://..."
    }
  ]
}
```

### Resource: product-colors

#### Get Product Colors
**Endpoint**: `GET /api/product-colors`
**Purpose**: Get available colors for a style

**Query Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| styleNumber | string | Yes | Product style number |

**Success Response**:
```json
{
  "data": ["Black", "Navy", "Red", "Royal", "Sport Grey"]
}
```

### Additional Product Endpoints

- `GET /api/stylesearch?term=PC5` - Style number autocomplete
- `GET /api/related-products?styleNumber=PC54` - Get related products
- `GET /api/compare-products?styles=PC54,PC61` - Compare multiple products
- `GET /api/quick-view?styleNumber=PC54` - Quick view data
- `GET /api/featured-products?limit=10` - Featured products
- `GET /api/products-by-brand?brand=Port Authority` - Products by brand
- `GET /api/products-by-category?category=T-Shirts` - Products by category
- `GET /api/products-by-subcategory?subcategory=Long Sleeve` - Products by subcategory

## 📦 MODULE: INVENTORY

### Overview
Product inventory levels and size availability.

### Business Rules
- Real-time inventory levels
- Sizes vary by style and color combination
- Inventory tracked at SKU level (style + color + size)

### Resource: inventory

#### Get Inventory Levels
**Endpoint**: `GET /api/inventory`

**Query Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| styleNumber | string | No | Filter by style |
| color | string | No | Filter by color |

### Resource: sizes-by-style-color

#### Get Available Sizes
**Endpoint**: `GET /api/sizes-by-style-color`

**Query Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| styleNumber | string | Yes | Product style |
| color | string | Yes | Product color |

**Success Response**:
```json
{
  "data": ["XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL"]
}
```

### Additional Inventory Endpoints

- `GET /api/product-variant-sizes?styleNumber=PC54&color=Black` - Variant sizes with prices
- `GET /api/prices-by-style-color?styleNumber=PC54&color=Black` - Prices for each size

## 🚀 OPTIMIZED ENDPOINT: DTG Product Bundle

#### Get Complete DTG Data Bundle
**Endpoint**: `GET /api/dtg/product-bundle`
**Purpose**: 🚀 **PERFORMANCE OPTIMIZED**: Get complete DTG product data in one request instead of 3-4 separate calls

**Query Parameters**:
| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| styleNumber | string | Yes | Product style number | PC54 |
| color | string | No | Focus on specific color | Black |

**Success Response**:
```json
{
  "product": {
    "styleNumber": "PC54",
    "title": "Port & Company Core Blend Tee",
    "brand": "Port & Company",
    "category": "T-Shirts",
    "description": "5.5-ounce, 50/50 cotton/poly",
    "colors": [
      {
        "COLOR_NAME": "Black",
        "HEX_CODE": "#000000",
        "COLOR_SQUARE_IMAGE": "https://...",
        "MAIN_IMAGE_URL": "https://..."
      }
    ],
    "selectedColor": {...} // If color param provided
  },
  "pricing": {
    "tiers": [
      {
        "TierLabel": "24-47",
        "MinQuantity": 24,
        "MaxQuantity": 47,
        "MarginDenominator": 0.6,
        "TargetMargin": 40,
        "LTM_Fee": 50.00
      }
    ],
    "costs": [
      {
        "PrintLocationCode": "LC",
        "TierLabel": "24-47",
        "PrintCost": 8.50
      }
    ],
    "sizes": [
      {
        "size": "S",
        "maxCasePrice": 4.42
      }
    ],
    "upcharges": {
      "2XL": 2.00,
      "3XL": 4.00,
      "4XL": 6.00
    },
    "locations": [
      {
        "code": "LC",
        "name": "Left Chest"
      },
      {
        "code": "FF",
        "name": "Full Front"
      }
    ]
  },
  "metadata": {
    "cachedAt": "2025-08-30T17:00:00",
    "ttl": 300, // Cache for 5 minutes
    "source": "dtg-bundle-v1"
  }
}
```

**Performance Benefits**:
- ✅ Replaces 4 separate API calls: `/api/product-colors`, `/api/pricing-tiers`, `/api/dtg-costs`, `/api/max-prices-by-style`
- ✅ ~2-3x faster page load times for DTG pricing pages
- ✅ Atomic data consistency across all components
- ✅ 5-minute server-side cache for optimal performance
- ✅ Backwards compatible - existing endpoints remain available

**Use Cases**:
- DTG pricing calculator initialization
- Product detail pages with DTG pricing
- Bulk pricing comparisons
- Quote generation workflows

## 🆕 NEW PRODUCTS MANAGEMENT

### Overview
**Purpose**: Manage the "New Products" showcase section on Top Sellers page
**Architecture**: API-driven dynamic content (unlike other filters which use static arrays)
**Status**: ✅ Production-ready (implemented in top-sellers-showcase.html)
**Key Feature**: Products automatically appear/disappear when IsNew flag is toggled in database

### Business Rules
- Products marked with `IsNew=1` flag automatically appear in "New Products" section
- DISCONTINUED products automatically filtered out by frontend
- Color variants grouped by style number (one card per style)
- 5-minute API cache delay for database changes to appear
- Image priority: COLOR_PRODUCT_IMAGE → PRODUCT_IMAGE → THUMBNAIL_IMAGE → brand placeholder

---

### Consumer Endpoints

#### 1. Get New Products
**Endpoint**: `GET /api/products/new`
**Purpose**: Returns products marked with IsNew flag for "New Products" showcase
**Status**: ✅ Active (used in top-sellers-showcase.html)
**Cache**: 5 minutes server-side

**Query Parameters**:
| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| limit | number | No | Max results (default: 100) | 50 |

**Success Response (200 OK)**:
```json
{
  "products": [
    {
      "STYLE": "NE215",
      "PRODUCT_TITLE": "New Era 9TWENTY Unstructured Mesh Snapback Cap",
      "MILL": "New Era",
      "PRODUCT_DESCRIPTION": "Unstructured crown with moisture-wicking sweatband...",
      "COLOR_PRODUCT_IMAGE": "https://cdn.caspio.com/...",
      "PRODUCT_IMAGE": "https://cdn.caspio.com/...",
      "THUMBNAIL_IMAGE": "https://cdn.caspio.com/...",
      "IsNew": 1,
      "Status": "Active"
    }
  ],
  "count": 1
}
```

**Example Usage**:
```bash
# Get all new products
curl "https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/products/new"

# Get limited results
curl "https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/products/new?limit=10"
```

**Frontend Integration**:
```javascript
// From top-sellers-showcase.html
const response = await fetch('https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/products/top-sellers?limit=100');
const result = await response.json();
const products = result.products || [];

// Group by style to eliminate color variant duplicates
const uniqueProducts = new Map();
products.forEach(p => {
    const style = p.STYLE;
    if (!uniqueProducts.has(style)) {
        uniqueProducts.set(style, p);
    }
});

// Filter out DISCONTINUED products
const activeProducts = Array.from(uniqueProducts.values()).filter(p =>
    !p.PRODUCT_TITLE?.includes('DISCONTINUED') &&
    !p.PRODUCT_DESCRIPTION?.includes('DISCONTINUED')
);
```

#### 2. Get Product Details
**Endpoint**: `GET /api/product-details`
**Purpose**: Get complete product information for any product (documented above in Products section)
**Status**: ✅ Active
**Use Case**: Fetch detailed info for products before marking as new

---

### Admin Endpoints

#### 3. Update Product (Individual)
**Endpoint**: `PUT /api/products/{styleNumber}`
**Purpose**: Update individual product fields including IsNew flag
**Status**: ✅ Active
**Authentication**: None required (internal tool)

**URL Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| styleNumber | string | Yes | Product style number (e.g., NE215) |

**Request Body**:
```json
{
  "IsNew": 1,
  "Status": "Active",
  "PRODUCT_TITLE": "Updated Product Title"
}
```

**Success Response (200 OK)**:
```json
{
  "success": true,
  "message": "Product NE215 updated successfully",
  "updated": {
    "IsNew": 1,
    "Status": "Active"
  }
}
```

**Example Usage**:
```bash
# Mark single product as new
curl -X PUT "https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/products/NE215" \
  -H "Content-Type: application/json" \
  -d '{"IsNew": 1}'

# Unmark single product
curl -X PUT "https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/products/NE215" \
  -H "Content-Type: application/json" \
  -d '{"IsNew": 0}'
```

#### 4. Mark Products as New (Bulk)
**Endpoint**: `POST /api/admin/products/mark-as-new`
**Purpose**: Mark multiple products as new in one operation
**Status**: ✅ Active
**Authentication**: None required (internal tool)

**Request Body**:
```json
{
  "styles": ["EB120", "EB121", "DT620", "NE410", "ST850"]
}
```

**Success Response (200 OK)**:
```json
{
  "success": true,
  "message": "Marked 5 products as new",
  "updated": ["EB120", "EB121", "DT620", "NE410", "ST850"],
  "failed": []
}
```

**Example Usage**:
```bash
# Mark multiple products as new
curl -X POST "https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/admin/products/mark-as-new" \
  -H "Content-Type: application/json" \
  -d '{"styles": ["EB120", "EB121", "DT620"]}'

# Mark single product as new
curl -X POST "https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/admin/products/mark-as-new" \
  -H "Content-Type: application/json" \
  -d '{"styles": ["NE215"]}'
```

**Use Cases**:
- Adding multiple new products at once
- Seasonal product launches
- Promotional product batches

#### 5. Clear IsNew Flag (Bulk Reset)
**Endpoint**: `POST /api/admin/products/clear-isnew`
**Purpose**: Remove IsNew flag from ALL products (reset to clean slate)
**Status**: ✅ Active
**Authentication**: None required (internal tool)
**⚠️ Warning**: This affects ALL products marked as new

**Request Body**:
```json
{
  "confirm": true
}
```

**Success Response (200 OK)**:
```json
{
  "success": true,
  "message": "Cleared IsNew flag from all products",
  "count": 15
}
```

**Example Usage**:
```bash
# Clear all IsNew flags
curl -X POST "https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/admin/products/clear-isnew" \
  -H "Content-Type: application/json" \
  -d '{"confirm": true}'
```

**Use Cases**:
- Seasonal reset (e.g., clearing last season's "new" products)
- Starting fresh with new product selection
- Testing individual product display
- Fixing accidental bulk marking

**Common Workflow**:
```bash
# 1. Clear all existing new products
curl -X POST "https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/admin/products/clear-isnew" \
  -H "Content-Type: application/json" \
  -d '{"confirm": true}'

# 2. Mark fresh set of new products
curl -X POST "https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/admin/products/mark-as-new" \
  -H "Content-Type: application/json" \
  -d '{"styles": ["NE215", "EB120", "DT620"]}'

# 3. Verify (wait 5 minutes for cache or force refresh)
curl "https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/products/new"
```

---

### Infrastructure Endpoints (Caspio Direct)

These endpoints interact directly with Caspio REST API for one-time field management. **Rarely needed** - only for initial setup or field schema changes.

#### 6. Create Database Field
**Endpoint**: `POST /api/tables/{tableName}/fields`
**Purpose**: Create new field in Caspio table (one-time setup)
**Status**: ✅ Active (infrastructure only)
**Use Case**: Adding IsNew field to products table (already done)

**URL Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| tableName | string | Yes | Caspio table name |

**Request Body**:
```json
{
  "Name": "IsNew",
  "Type": "NUMBER",
  "Description": "Flag for new products showcase",
  "Unique": false,
  "UniqueAllowNulls": false
}
```

**Success Response (201 Created)**:
```json
{
  "Result": {
    "Name": "IsNew",
    "Type": "NUMBER",
    "Unique": false,
    "Description": "Flag for new products showcase",
    "DisplayOrder": 150,
    "Label": "Is New Product",
    "UniqueAllowNulls": false,
    "OnInsert": true,
    "OnUpdate": true
  },
  "Status": 201,
  "Message": "Success"
}
```

**Example Usage**:
```bash
# Create IsNew field (one-time setup - already done)
curl -X POST "https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/tables/Sanmar_Products_Master/fields" \
  -H "Content-Type: application/json" \
  -d '{
    "Name": "IsNew",
    "Type": "NUMBER",
    "Description": "Flag for new products showcase"
  }'
```

#### 7. Get Field Schema
**Endpoint**: `GET /api/tables/{tableName}/fields/{fieldName}`
**Purpose**: Get field definition and metadata
**Status**: ✅ Active (infrastructure only)
**Use Case**: Verify field exists and check configuration

**URL Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| tableName | string | Yes | Caspio table name |
| fieldName | string | Yes | Field name to query |

**Success Response (200 OK)**:
```json
{
  "Result": {
    "Name": "IsNew",
    "Type": "NUMBER",
    "Unique": false,
    "Description": "Flag for new products showcase",
    "DisplayOrder": 150,
    "Label": "Is New Product"
  },
  "Status": 200,
  "Message": "Success"
}
```

**Example Usage**:
```bash
# Check IsNew field configuration
curl "https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/tables/Sanmar_Products_Master/fields/IsNew"

# Check product style field
curl "https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/tables/Sanmar_Products_Master/fields/STYLE"
```

---

### Complete Workflow Examples

#### Scenario 1: Add Single New Product
```bash
# Step 1: Mark product as new
curl -X POST "https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/admin/products/mark-as-new" \
  -H "Content-Type: application/json" \
  -d '{"styles": ["NE215"]}'

# Step 2: Wait 5 minutes for cache to expire (or force refresh in browser)

# Step 3: Verify on website
# Navigate to: http://localhost:3000/pages/top-sellers-showcase.html
# Click "New Products" filter button
# Confirm NE215 appears
```

#### Scenario 2: Replace All New Products
```bash
# Step 1: Clear existing new products
curl -X POST "https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/admin/products/clear-isnew" \
  -H "Content-Type: application/json" \
  -d '{"confirm": true}'

# Step 2: Mark new set
curl -X POST "https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/admin/products/mark-as-new" \
  -H "Content-Type: application/json" \
  -d '{"styles": ["EB120", "EB121", "DT620", "NE410", "ST850"]}'

# Step 3: Verify API response (5 minutes later)
curl "https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/products/new"
```

#### Scenario 3: Remove Single Product
```bash
# Option A: Use individual update endpoint
curl -X PUT "https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/products/NE215" \
  -H "Content-Type: application/json" \
  -d '{"IsNew": 0}'

# Option B: Clear all and re-mark others
curl -X POST "https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/admin/products/clear-isnew" \
  -H "Content-Type: application/json" \
  -d '{"confirm": true}'

curl -X POST "https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/admin/products/mark-as-new" \
  -H "Content-Type: application/json" \
  -d '{"styles": ["EB120", "EB121", "DT620"]}'
```

---

### Troubleshooting

#### Problem: Products not appearing after marking as new
**Solutions**:
1. Wait 5 minutes for server cache to expire
2. Check product is not DISCONTINUED (filtered out automatically)
3. Verify API response: `curl "https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/products/new"`
4. Check browser console for JavaScript errors

#### Problem: Wrong products showing
**Solutions**:
1. Verify which products have IsNew=1 via API
2. Use clear-isnew endpoint to reset all
3. Re-mark only desired products
4. Check for duplicate style numbers (frontend groups by style)

#### Problem: Images not loading
**Solutions**:
1. Check product has COLOR_PRODUCT_IMAGE, PRODUCT_IMAGE, or THUMBNAIL_IMAGE field
2. Verify image URLs are accessible
3. Check imageOverrides in top-sellers-showcase.html for manual overrides
4. Fallback to brand placeholder if no image available

#### Problem: Endpoint returning empty results
**Solutions**:
1. Verify products actually marked in database (use mark-as-new endpoint)
2. Wait for 5-minute cache to expire
3. Check server logs for errors
4. Verify Caspio connection is working

---

### API Endpoint Summary

| Endpoint | Method | Purpose | Status | Auth Required |
|----------|--------|---------|--------|---------------|
| `/api/products/new` | GET | Get new products | ✅ Active | No |
| `/api/product-details` | GET | Get product info | ✅ Active | No |
| `/api/products/{style}` | PUT | Update product | ✅ Active | No |
| `/api/admin/products/mark-as-new` | POST | Mark products as new | ✅ Active | No |
| `/api/admin/products/clear-isnew` | POST | Clear all IsNew flags | ✅ Active | No |
| `/api/tables/{table}/fields` | POST | Create field | ✅ Active | No |
| `/api/tables/{table}/fields/{field}` | GET | Get field schema | ✅ Active | No |

**Total Endpoints**: 7 (2 consumer, 3 admin, 2 infrastructure)

## 🏆 TOP SELLERS MANAGEMENT

### Overview
**Purpose**: Manage the "Top Sellers" showcase section on Top Sellers page
**Architecture**: API-driven dynamic content (migrated from hardcoded arrays on 2025-11-03)
**Status**: ✅ Production-ready (implemented in top-sellers-showcase.html)
**Key Feature**: Products automatically appear/disappear when IsTopSeller flag is toggled in database

### Business Rules
- Products marked with `IsTopSeller=1` flag automatically appear in "Top Sellers" section
- DISCONTINUED products automatically filtered out by frontend
- Color variants grouped by style number (one card per style)
- 5-minute API cache delay for database changes to appear
- Image priority: COLOR_PRODUCT_IMAGE → PRODUCT_IMAGE → THUMBNAIL_IMAGE → brand placeholder
- Sample pricing badges automatically displayed (free vs paid based on $10 threshold)

### Migration History
- **Before 2025-11-03**: Used hardcoded array of 9 Sanmar products
- **After 2025-11-03**: Dynamic API-driven from IsTopSeller flag
- **Initial Migration**: 9 Sanmar products marked as top sellers
- **Current Set**: 4 Carhartt products (CT104670, CT103828, CTK121, CT104597)

---

### Consumer Endpoints

#### 1. Get Top Sellers
**Endpoint**: `GET /api/products/top-sellers`
**Purpose**: Returns products marked with IsTopSeller flag for "Top Sellers" showcase
**Status**: ✅ Active (used in top-sellers-showcase.html)
**Cache**: 5 minutes server-side

**Query Parameters**:
| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| limit | number | No | Max results (default: 100) | 50 |

**Success Response (200 OK)**:
```json
{
  "products": [
    {
      "STYLE": "CT104670",
      "PRODUCT_TITLE": "Carhartt Duck Detroit Jacket",
      "MILL": "Carhartt",
      "PRODUCT_DESCRIPTION": "12-ounce, firm-hand, 100% ring-spun cotton duck...",
      "COLOR_PRODUCT_IMAGE": "https://cdn.caspio.com/...",
      "PRODUCT_IMAGE": "https://cdn.caspio.com/...",
      "THUMBNAIL_IMAGE": "https://cdn.caspio.com/...",
      "IsTopSeller": 1,
      "Status": "Active"
    }
  ],
  "count": 4
}
```

**Example Usage**:
```bash
# Get all top sellers
curl "https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/products/top-sellers"

# Get limited results
curl "https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/products/top-sellers?limit=10"
```

**Frontend Integration**:
```javascript
// From top-sellers-showcase.html
const response = await fetch('https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/products/top-sellers?limit=100');
const result = await response.json();
const products = result.products || [];

// Group by style to eliminate color variant duplicates
const uniqueProducts = new Map();
products.forEach(p => {
    const style = p.STYLE;
    if (!uniqueProducts.has(style)) {
        uniqueProducts.set(style, p);
    }
});

// Filter out DISCONTINUED products
const activeProducts = Array.from(uniqueProducts.values()).filter(p =>
    !p.PRODUCT_TITLE?.includes('DISCONTINUED') &&
    !p.PRODUCT_DESCRIPTION?.includes('DISCONTINUED')
);

// Check sample pricing eligibility
const productsWithPricing = await Promise.all(
    activeProducts.map(async product => {
        const eligibility = await window.sampleCart.checkEligibility(product.STYLE);
        return {
            ...product,
            isFree: eligibility.type === 'free',
            price: eligibility.price || 0,
            eligible: eligibility.eligible
        };
    })
);
```

#### 2. Get Product Details
**Endpoint**: `GET /api/product-details`
**Purpose**: Get complete product information for any product (documented above in Products section)
**Status**: ✅ Active
**Use Case**: Fetch detailed info for products before marking as top seller

---

### Admin Endpoints

#### 3. Update Product (Individual)
**Endpoint**: `PUT /api/products/{styleNumber}`
**Purpose**: Update individual product fields including IsTopSeller flag
**Status**: ✅ Active
**Authentication**: None required (internal tool)

**URL Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| styleNumber | string | Yes | Product style number (e.g., CT104670) |

**Request Body**:
```json
{
  "IsTopSeller": 1,
  "Status": "Active",
  "PRODUCT_TITLE": "Updated Product Title"
}
```

**Success Response (200 OK)**:
```json
{
  "success": true,
  "message": "Product CT104670 updated successfully",
  "updated": {
    "IsTopSeller": 1,
    "Status": "Active"
  }
}
```

**Example Usage**:
```bash
# Mark single product as top seller
curl -X PUT "https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/products/CT104670" \
  -H "Content-Type: application/json" \
  -d '{"IsTopSeller": 1}'

# Unmark single product
curl -X PUT "https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/products/CT104670" \
  -H "Content-Type: application/json" \
  -d '{"IsTopSeller": 0}'
```

#### 4. Mark Products as Top Sellers (Bulk)
**Endpoint**: `POST /api/admin/products/mark-as-top-seller`
**Purpose**: Mark multiple products as top sellers in one operation
**Status**: ✅ Active
**Authentication**: None required (internal tool)

**Request Body**:
```json
{
  "styles": ["CT104670", "CT103828", "CTK121", "CT104597"]
}
```

**Success Response (200 OK)**:
```json
{
  "success": true,
  "message": "Marked 4 products as top sellers",
  "updated": ["CT104670", "CT103828", "CTK121", "CT104597"],
  "failed": []
}
```

**Example Usage**:
```bash
# Mark Carhartt products as top sellers (current set)
curl -X POST "https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/admin/products/mark-as-top-seller" \
  -H "Content-Type: application/json" \
  -d '{"styles": ["CT104670", "CT103828", "CTK121", "CT104597"]}'

# Mark single product as top seller
curl -X POST "https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/admin/products/mark-as-top-seller" \
  -H "Content-Type: application/json" \
  -d '{"styles": ["PC54"]}'
```

**Use Cases**:
- Updating seasonal top sellers
- Promotional product features
- Managing featured product rotations
- Migrating from hardcoded arrays

#### 5. Clear IsTopSeller Flag (Bulk Reset)
**Endpoint**: `POST /api/admin/products/clear-istopseller`
**Purpose**: Remove IsTopSeller flag from ALL products (reset to clean slate)
**Status**: ✅ Active
**Authentication**: None required (internal tool)
**⚠️ Warning**: This affects ALL products marked as top sellers

**Request Body**:
```json
{
  "confirm": true
}
```

**Success Response (200 OK)**:
```json
{
  "success": true,
  "message": "Cleared IsTopSeller flag from all products",
  "count": 4
}
```

**Example Usage**:
```bash
# Clear all IsTopSeller flags
curl -X POST "https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/admin/products/clear-istopseller" \
  -H "Content-Type: application/json" \
  -d '{"confirm": true}'
```

**Use Cases**:
- Seasonal rotation (e.g., clearing last season's top sellers)
- Starting fresh with new product selection
- Testing individual product display
- Fixing accidental bulk marking

**Common Workflow**:
```bash
# 1. Clear all existing top sellers
curl -X POST "https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/admin/products/clear-istopseller" \
  -H "Content-Type: application/json" \
  -d '{"confirm": true}'

# 2. Mark fresh set of top sellers
curl -X POST "https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/admin/products/mark-as-top-seller" \
  -H "Content-Type: application/json" \
  -d '{"styles": ["CT104670", "CT103828", "CTK121", "CT104597"]}'

# 3. Verify (wait 5 minutes for cache or force refresh)
curl "https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/products/top-sellers"
```

---

### Complete Workflow Examples

#### Scenario 1: Replace All Top Sellers
```bash
# Step 1: Clear existing top sellers
curl -X POST "https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/admin/products/clear-istopseller" \
  -H "Content-Type: application/json" \
  -d '{"confirm": true}'

# Step 2: Mark new set (4 Carhartt products)
curl -X POST "https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/admin/products/mark-as-top-seller" \
  -H "Content-Type: application/json" \
  -d '{"styles": ["CT104670", "CT103828", "CTK121", "CT104597"]}'

# Step 3: Wait 5 minutes for cache to expire (or force browser refresh)

# Step 4: Verify on website
# Navigate to: http://localhost:3000/pages/top-sellers-showcase.html
# Carousel should show 4 Carhartt products with "★ TOP SELLER" badge
```

#### Scenario 2: Add Single Top Seller
```bash
# Step 1: Mark product as top seller
curl -X POST "https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/admin/products/mark-as-top-seller" \
  -H "Content-Type: application/json" \
  -d '{"styles": ["PC54"]}'

# Step 2: Wait 5 minutes for cache to expire

# Step 3: Verify API response
curl "https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/products/top-sellers"
```

#### Scenario 3: Remove Single Top Seller
```bash
# Option A: Use individual update endpoint
curl -X PUT "https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/products/CT104670" \
  -H "Content-Type: application/json" \
  -d '{"IsTopSeller": 0}'

# Option B: Clear all and re-mark others
curl -X POST "https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/admin/products/clear-istopseller" \
  -H "Content-Type: application/json" \
  -d '{"confirm": true}'

curl -X POST "https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/admin/products/mark-as-top-seller" \
  -H "Content-Type: application/json" \
  -d '{"styles": ["CT103828", "CTK121", "CT104597"]}'
```

---

### Troubleshooting

#### Problem: Products not appearing after marking as top seller
**Solutions**:
1. Wait 5 minutes for server cache to expire
2. Check product is not DISCONTINUED (filtered out automatically)
3. Verify API response: `curl "https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/products/top-sellers"`
4. Check browser console for JavaScript errors
5. Verify carousel is limited to 4 products (horizontal scrolling removed)

#### Problem: Sample pricing badges not showing
**Solutions**:
1. Verify `window.sampleCart.checkEligibility()` function is available
2. Check API endpoint `/api/size-pricing?styleNumber={style}` is working
3. Verify product has pricing data in database
4. Check browser console for JavaScript errors in pricing check

#### Problem: Wrong products showing
**Solutions**:
1. Verify which products have IsTopSeller=1 via API
2. Use clear-istopseller endpoint to reset all
3. Re-mark only desired products
4. Check for duplicate style numbers (frontend groups by style)

#### Problem: Images not loading
**Solutions**:
1. Check product has COLOR_PRODUCT_IMAGE, PRODUCT_IMAGE, or THUMBNAIL_IMAGE field
2. Verify image URLs are accessible
3. Check imageOverrides in top-sellers-showcase.html for manual overrides
4. Fallback to brand placeholder if no image available

---

### API Endpoint Summary

| Endpoint | Method | Purpose | Status | Auth Required |
|----------|--------|---------|--------|---------------|
| `/api/products/top-sellers` | GET | Get top seller products | ✅ Active | No |
| `/api/product-details` | GET | Get product info | ✅ Active | No |
| `/api/products/{style}` | PUT | Update product | ✅ Active | No |
| `/api/admin/products/mark-as-top-seller` | POST | Mark as top sellers | ✅ Active | No |
| `/api/admin/products/clear-istopseller` | POST | Clear all flags | ✅ Active | No |

**Total Endpoints**: 5 (2 consumer, 3 admin)

**Sample Pricing Integration**: All top seller products automatically check eligibility via `/api/size-pricing` endpoint and display pricing badges (free vs paid based on $10 threshold).

---

## 🔄 SANMAR TO SHOPWORKS MAPPING

### Overview
**Purpose**: Centralized API for Sanmar product data transformation and ShopWorks integration
**Architecture**: Provides programmatic access to ShopWorks-ready JSON or granular mapping data
**Status**: ✅ Production-ready (deployed 2025-11-09)
**Recommended**: Use `/import-format` endpoint for direct ShopWorks imports (returns pre-mapped JSON)
**Key Features**: ShopWorks-ready JSON export, SKU pattern detection, Size06 field reuse patterns, CATALOG_COLOR mapping

### Business Rules
- **SKU Pattern Detection**: Single-SKU vs multi-SKU variants (standard 3 or extended 4-6 SKUs)
- **Suffix Mapping**: _2XL/_2X use Size05 (ONLY exceptions), all other suffixes use Size06
- **Color Normalization**: COLOR_NAME (display) vs CATALOG_COLOR (API/ShopWorks queries)
- **Size06 Field Reuse**: Multiple SKUs can reuse Size06 field position in separate records
- **1-hour cache**: In-memory caching for mapping data to optimize performance

### Use Cases
- Programmatic product catalog transformation
- Automated ShopWorks data import preparation
- Size field mapping automation
- Color name standardization for inventory systems
- SKU variant detection for order processing

---

### Mapping Endpoints

#### ⭐ RECOMMENDED: Import Format Endpoint (ShopWorks-Ready JSON)
**Endpoint**: `GET /api/sanmar-shopworks/import-format`
**Purpose**: Get ShopWorks-ready JSON with Size01-06 fields pre-mapped and CASE_PRICE included
**Status**: ✅ Active (1-hour cache)
**Cache**: 1 hour in-memory
**Use Case**: Direct import into ShopWorks - no transformation needed

**Query Parameters**:
| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| styleNumber | string | Yes | Product style number | PC850 |
| color | string | Yes | CATALOG_COLOR value | Cardinal |

**Success Response (200 OK)**:
```json
[
  {
    "ID_Product": "PC850_XS",
    "CATALOG_COLOR": "Team Cardinal",
    "COLOR_NAME": "Team Cardinal",
    "Description": "Port & Co Fan Favorite Fleece Crewneck Sweatshirt",
    "Brand": "Port & Company",
    "CASE_PRICE": 10.51,
    "Size01": null,
    "Size02": null,
    "Size03": null,
    "Size04": null,
    "Size05": null,
    "Size06": "XS"
  },
  {
    "ID_Product": "PC850",
    "CATALOG_COLOR": "Team Cardinal",
    "COLOR_NAME": "Team Cardinal",
    "Description": "Port & Co Fan Favorite Fleece Crewneck Sweatshirt",
    "Brand": "Port & Company",
    "CASE_PRICE": 10.51,
    "Size01": "S",
    "Size02": "M",
    "Size03": "L",
    "Size04": "XL",
    "Size05": null,
    "Size06": null
  }
]
```

**Key Features**:
- Returns only exact style matches (PC850 returns 5 SKUs, not 22)
- Size fields pre-mapped (Size01-Size06 already assigned, null = disabled)
- Current CASE_PRICE from Sanmar_Bulk table
- Handles all extended sizes (5XL, 6XL, LT, XLT, etc.)
- Sorted by price (lowest to highest)
- One API call gets everything you need

**Example Request**:
```bash
curl "https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/sanmar-shopworks/import-format?styleNumber=PC850&color=Cardinal"
```

**Complete Documentation**: See memory/SANMAR_TO_SHOPWORKS_GUIDE.md

---

#### 2. Detailed Mapping Endpoint (Advanced Use)
**Endpoint**: `GET /api/sanmar-shopworks/mapping`
**Purpose**: Complete product mapping with SKU pattern detection, size fields, and color normalization
**Status**: ✅ Active (1-hour cache)
**Cache**: 1 hour in-memory
**Use Case**: Advanced automation requiring SKU pattern detection and metadata

**Query Parameters**:
| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| styleNumber | string | Yes | Product style number | PC61 |
| includeInventory | boolean | No | Include inventory placeholder | true |
| colors | string | No | Filter colors (comma-separated) | Forest,Black |

**Success Response (200 OK)**:
```json
{
  "styleNumber": "PC61",
  "productTitle": "Port & Co Essential Tee. PC61",
  "brand": "Port & Company",
  "skuPattern": "single-sku",
  "skuCount": 1,
  "skus": [
    {
      "sku": "PC61",
      "type": "base",
      "fields": ["Size01", "Size02", "Size03", "Size04"],
      "sizes": ["S", "M", "L", "XL"],
      "suffix": null
    }
  ],
  "colors": [
    {
      "displayName": "Forest Green",
      "catalogName": "Forest Green",
      "imageUrl": "https://cdnm.sanmar.com/swatch/gifs/port_darkgreen.gif"
    }
  ],
  "mappingRules": {
    "_2XL": "Size05",
    "_2X": "Size05",
    "_3XL": "Size06",
    "_4XL": "Size06",
    "_5XL": "Size06",
    "_6XL": "Size06"
  },
  "cached": false
}
```

**Example Usage**:
```bash
# Get complete mapping for PC61
curl "https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/sanmar-shopworks/mapping?styleNumber=PC61"

# Get mapping with color filter
curl "https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/sanmar-shopworks/mapping?styleNumber=PC61&colors=Forest,Black"

# Get mapping with inventory placeholder
curl "https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/sanmar-shopworks/mapping?styleNumber=PC61&includeInventory=true"
```

**SKU Pattern Types**:
- **single-sku**: All sizes in one SKU (e.g., hoodies, jackets)
- **standard-multi-sku**: Base + _2XL + _3XL pattern (e.g., PC54) - 3 SKUs
- **extended-multi-sku**: Extended pattern with 4-6 SKUs (e.g., PC61)

**Field Mapping Examples**:
```javascript
// Base SKU (PC61)
{
  "fields": ["Size01", "Size02", "Size03", "Size04"],
  "sizes": ["S", "M", "L", "XL"]
}

// _2XL SKU (PC61_2XL) - ONLY suffix using Size05
{
  "fields": ["Size05"],
  "sizes": ["2XL"]
}

// _3XL SKU (PC61_3XL) - Uses Size06
{
  "fields": ["Size06"],
  "sizes": ["3XL"]
}

// _4XL SKU (PC61_4XL) - Reuses Size06 in separate record
{
  "fields": ["Size06"],
  "sizes": ["4XL"]
}
```

#### 3. Suffix Mapping Rules (Advanced Reference)
**Endpoint**: `GET /api/sanmar-shopworks/suffix-mapping`
**Purpose**: Reference for all suffix-to-field mappings and Size06 reuse pattern
**Status**: ✅ Active (static data, no cache needed)
**Use Case**: Advanced automation requiring suffix-to-field rule lookup

**Success Response (200 OK)**:
```json
{
  "mappingRules": {
    "_2XL": "Size05",
    "_2X": "Size05",
    "_3XL": "Size06",
    "_3X": "Size06",
    "_4XL": "Size06",
    "_4X": "Size06",
    "_5XL": "Size06",
    "_5X": "Size06",
    "_6XL": "Size06",
    "_6X": "Size06",
    "_XXL": "Size06",
    "_OSFA": "Size06",
    "_XS": "Size06",
    "_LT": "Size06",
    "_XLT": "Size06",
    "_2XLT": "Size06",
    "_3XLT": "Size06",
    "_4XLT": "Size06",
    "_YXS": "Size06",
    "_YS": "Size06",
    "_YM": "Size06",
    "_YL": "Size06",
    "_YXL": "Size06"
  },
  "notes": {
    "Size05Exception": "_2XL and _2X are the ONLY suffixes using Size05",
    "Size06Reuse": "All other suffixes use Size06 (field reuse pattern)",
    "Examples": {
      "_2XL": "Size05 - Standard 2XL",
      "_XXL": "Size06 - Womens 2XL (different from _2XL!)",
      "_3XL": "Size06 - First use of Size06",
      "_4XL": "Size06 - Reuses Size06 field",
      "_OSFA": "Size06 - One size fits all"
    }
  }
}
```

**Example Usage**:
```bash
# Get all suffix mapping rules
curl "https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/sanmar-shopworks/suffix-mapping"
```

**Key Concepts**:
- **Size05 Exception**: ONLY _2XL and _2X use Size05
- **Size06 Reuse**: All other suffixes (23 total) use Size06 field
- **Field Reuse Pattern**: Multiple SKUs can share Size06 by creating separate records
- **Youth Sizes**: _YXS, _YS, _YM, _YL, _YXL all use Size06
- **Tall Sizes**: _LT, _XLT, _2XLT, _3XLT, _4XLT all use Size06

#### 4. Color Mapping (Advanced Reference)
**Endpoint**: `GET /api/sanmar-shopworks/color-mapping`
**Purpose**: Color name normalization (display names vs catalog names for API queries)
**Status**: ✅ Active (1-hour cache)
**Cache**: 1 hour in-memory
**Use Case**: Advanced automation requiring COLOR_NAME to CATALOG_COLOR mapping

**Query Parameters**:
| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| styleNumber | string | Yes | Product style number | PC61 |

**Success Response (200 OK)**:
```json
{
  "styleNumber": "PC61",
  "colorCount": 62,
  "colors": [
    {
      "displayName": "Forest Green",
      "catalogName": "Forest Green",
      "imageUrl": "https://cdnm.sanmar.com/swatch/gifs/port_darkgreen.gif"
    },
    {
      "displayName": "Jet Black",
      "catalogName": "Jet Black",
      "imageUrl": "https://cdnm.sanmar.com/swatch/gifs/port_black.gif"
    }
  ],
  "usage": {
    "displayName": "Use for UI display",
    "catalogName": "Use for API queries and ShopWorks imports"
  }
}
```

**Example Usage**:
```bash
# Get all colors for PC61
curl "https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/sanmar-shopworks/color-mapping?styleNumber=PC61"

# Get all colors for CT104670
curl "https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/sanmar-shopworks/color-mapping?styleNumber=CT104670"
```

**Color Field Distinction**:
- **displayName (COLOR_NAME)**: User-friendly display name for UI
- **catalogName (CATALOG_COLOR)**: Exact name for ShopWorks catalog matching
- **imageUrl (COLOR_SQUARE_IMAGE)**: Color swatch image URL

**Use Cases**:
- Building product color selectors
- Normalizing color names for inventory queries
- Generating ShopWorks import files
- Color swatch image display

---

### Integration Examples

#### Example 1: Detect SKU Pattern
```javascript
// Check if product has multiple SKUs
const response = await fetch(
  'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/sanmar-shopworks/mapping?styleNumber=PC54'
);
const data = await response.json();

console.log(`SKU Pattern: ${data.skuPattern}`);
console.log(`SKU Count: ${data.skuCount}`);
console.log(`SKUs: ${data.skus.map(s => s.sku).join(', ')}`);

// Output:
// SKU Pattern: standard-multi-sku
// SKU Count: 3
// SKUs: PC54, PC54_2XL, PC54_3XL
```

#### Example 2: Map Suffix to ShopWorks Field
```javascript
// Get field mapping for a specific suffix
const response = await fetch(
  'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/sanmar-shopworks/suffix-mapping'
);
const data = await response.json();

const suffix = '_4XL';
const field = data.mappingRules[suffix];
console.log(`${suffix} → ${field}`);

// Output: _4XL → Size06
```

#### Example 3: Get Color for ShopWorks Import
```javascript
// Get catalog color name for ShopWorks
const response = await fetch(
  'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/sanmar-shopworks/color-mapping?styleNumber=PC61'
);
const data = await response.json();

// Find specific color
const color = data.colors.find(c => c.displayName === 'Forest Green');
console.log(`Use for ShopWorks: ${color.catalogName}`);

// Output: Use for ShopWorks: Forest Green
```

---

### API Endpoint Summary

| Endpoint | Method | Purpose | Status | Cache | Priority |
|----------|--------|---------|--------|-------|----------|
| ⭐ `/api/sanmar-shopworks/import-format` | GET | ShopWorks-ready JSON | ✅ Active | 1 hour | **RECOMMENDED** |
| `/api/sanmar-shopworks/mapping` | GET | Complete product mapping | ✅ Active | 1 hour | Advanced |
| `/api/sanmar-shopworks/suffix-mapping` | GET | Suffix-to-field rules | ✅ Active | None (static) | Advanced |
| `/api/sanmar-shopworks/color-mapping` | GET | Color normalization | ✅ Active | 1 hour | Advanced |

**Total Endpoints**: 4
**Recommended Endpoint**: Use `/import-format` for direct ShopWorks imports (no transformation needed)
**Documentation**: See memory/SANMAR_TO_SHOPWORKS_GUIDE.md for complete import guide

---

**Base URL**: `https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api`
**Documentation Version**: 2.5.0
**Last Updated**: 2025-11-09
**Module**: Products & Inventory APIs
