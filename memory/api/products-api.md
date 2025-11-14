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

---

## 📚 Related API Documentation

### Product Showcase Management
For complete documentation on New Products and Top Sellers showcase features, see:
- **[Product Showcase APIs](product-showcase-api.md)** - New Products Management (7 endpoints) + Top Sellers Management (5 endpoints)

**Quick Links:**
- Manage "New Products" showcase: `GET /api/products/new`, `POST /api/admin/products/mark-as-new`
- Manage "Top Sellers" showcase: `GET /api/products/top-sellers`, `POST /api/admin/products/mark-as-top-seller`

### Sanmar to ShopWorks Mapping
For complete documentation on transforming Sanmar products for ShopWorks integration, see:
- **[Sanmar to ShopWorks Guide](../SANMAR_TO_SHOPWORKS_GUIDE.md)** - Complete import guide with ShopWorks-ready JSON format

**Quick Link:**
- ShopWorks import endpoint: `GET /api/sanmar-shopworks/import-format?styleNumber={style}&color={color}`

---

**Base URL**: `https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api`
**Documentation Version**: 2.6.0
**Last Updated**: 2025-11-14
**Module**: Products & Inventory APIs (Core)
