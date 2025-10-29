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
const response = await fetch('https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/products/new?limit=100');
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

---

**Base URL**: `https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api`
**Documentation Version**: 2.3.0
**Module**: Products & Inventory APIs