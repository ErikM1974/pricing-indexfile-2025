# Product Showcase APIs Documentation

## Overview
This document contains API documentation for managing product showcase features on the Top Sellers page, including New Products and Top Sellers sections.

**Base URL**: `https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api`
**Documentation Version**: 2.5.0
**Last Updated**: 2025-11-14

---

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
**Purpose**: Get complete product information for any product
**Status**: ✅ Active
**Use Case**: Fetch detailed info for products before marking as new
**Documentation**: See [products-api.md](products-api.md) for complete details

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
**Purpose**: Get complete product information for any product
**Status**: ✅ Active
**Use Case**: Fetch detailed info for products before marking as top seller
**Documentation**: See [products-api.md](products-api.md) for complete details

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

## Related Documentation

- **Core Product APIs**: [products-api.md](products-api.md) - Product search, details, colors, inventory
- **Cart & Pricing APIs**: [cart-pricing-api.md](cart-pricing-api.md) - Cart management, pricing bundles
- **Main Documentation**: [CASPIO_API_CORE.md](../CASPIO_API_CORE.md) - Complete API overview

---

**Documentation Type**: Product Showcase API Module
**Parent Document**: [CASPIO_API_CORE.md](../CASPIO_API_CORE.md)
**Related**: [products-api.md](products-api.md)
