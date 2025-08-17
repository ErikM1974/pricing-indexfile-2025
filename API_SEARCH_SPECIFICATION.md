# Enhanced Product Search API Specification

## Overview
This document specifies the requirements for creating an enhanced product search API layer for Northwest Custom Apparel, leveraging the existing Sanmar_Bulk_251816_Feb2024 Caspio table.

## Base Configuration
- **Heroku API Base URL**: `https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api`
- **Source Table**: `Sanmar_Bulk_251816_Feb2024`
- **Implementation Location**: `/src/routes/products.js` (extend existing file)

## Primary Endpoint: `/api/products/search`

### Method: GET

### Query Parameters

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `q` | string | Search query for text matching | `q=polo shirt` |
| `category` | string[] | Filter by category names | `category=Polos/Knits,T-Shirts` |
| `subcategory` | string[] | Filter by subcategory | `subcategory=Ladies,Youth` |
| `brand` | string[] | Filter by brand names | `brand=OGIO,Port Authority` |
| `color` | string[] | Filter by color names | `color=Black,Navy,White` |
| `size` | string[] | Filter by available sizes | `size=S,M,L,XL` |
| `minPrice` | number | Minimum price filter | `minPrice=10.00` |
| `maxPrice` | number | Maximum price filter | `maxPrice=50.00` |
| `minQty` | number | Minimum inventory quantity | `minQty=10` |
| `status` | string | Product status filter | `status=Active` |
| `isTopSeller` | boolean | Filter for top sellers only | `isTopSeller=true` |
| `hasInventory` | boolean | Only show in-stock items | `hasInventory=true` |
| `sort` | string | Sort order | `sort=price_asc` |
| `page` | number | Page number (default: 1) | `page=2` |
| `limit` | number | Results per page (default: 24, max: 100) | `limit=48` |
| `includeFacets` | boolean | Include aggregation counts | `includeFacets=true` |

### Sort Options
- `relevance` (default when search query present)
- `price_asc` - Price low to high
- `price_desc` - Price high to low
- `name_asc` - Name A-Z
- `name_desc` - Name Z-A
- `newest` - Recently updated first
- `inventory_desc` - Highest stock first
- `popularity` - Top sellers first

### Required Fields from Sanmar_Bulk_251816_Feb2024 Table

```javascript
const REQUIRED_FIELDS = {
  // Core Product Information
  'PK_ID': 'Unique identifier',
  'UNIQUE_KEY': 'Product unique key',
  'STYLE': 'Style number (primary search field)',
  'PRODUCT_TITLE': 'Full product name',
  'PRODUCT_DESCRIPTION': 'Detailed description',
  'PRODUCT_STATUS': 'Active/Discontinued status',
  
  // Categorization
  'CATEGORY_NAME': 'Main category',
  'SUBCATEGORY_NAME': 'Subcategory',
  'CATEGORY': 'Combined categories for search',
  'BRAND_NAME': 'Brand name',
  'MILL': 'Manufacturer/Mill name',
  
  // Pricing
  'PIECE_PRICE': 'Individual unit price',
  'DOZEN_PRICE': 'Price per dozen',
  'CASE_PRICE': 'Case price',
  'PIECE_SALE_PRICE': 'Sale price per piece',
  'DOZEN_SALE_PRICE': 'Sale price per dozen',
  'CASE_SALE_PRICE': 'Sale price per case',
  'SALE_START_DATE': 'Sale start date',
  'SALE_END_DATE': 'Sale end date',
  'MSRP': 'Manufacturer suggested retail price',
  'MAP_PRICING': 'Minimum advertised price',
  
  // Inventory & Sizing
  'QTY': 'Available quantity',
  'SIZE': 'Size value',
  'AVAILABLE_SIZES': 'All available sizes text',
  'SIZE_INDEX': 'Size sort order',
  'CASE_SIZE': 'Units per case',
  
  // Colors
  'COLOR_NAME': 'Color name',
  'CATALOG_COLOR': 'Catalog color name',
  'SANMAR_MAINFRAME_COLOR': 'System color name',
  'PMS_COLOR': 'Pantone color code',
  
  // Images
  'THUMBNAIL_IMAGE': 'Small thumbnail',
  'PRODUCT_IMAGE': 'Main product image',
  'COLOR_SWATCH_IMAGE': 'Color swatch strip',
  'COLOR_SQUARE_IMAGE': 'Individual color square',
  'COLOR_PRODUCT_IMAGE': 'Product in specific color',
  'COLOR_PRODUCT_IMAGE_THUMBNAIL': 'Color product thumbnail',
  'FRONT_MODEL': 'Front model image URL',
  'BACK_MODEL': 'Back model image URL',
  'FRONT_FLAT': 'Front flat lay image',
  'BACK_FLAT': 'Back flat lay image',
  'Display_Image_URL': 'Primary display image',
  
  // Additional Data
  'KEYWORDS': 'Search keywords',
  'COMPANION_STYLES': 'Related style numbers',
  'PRICE_GROUP': 'Pricing group code',
  'PRICE_CODE': 'Price code',
  'IsTopSeller': 'Top seller flag',
  'Date_Updated': 'Last update timestamp',
  'GTIN': 'Global Trade Item Number',
  
  // Documentation
  'SPEC_SHEET': 'Specification sheet URL',
  'DECORATION_SPEC_SHEET': 'Decoration specifications URL',
  'PRODUCT_MEASUREMENTS': 'Size chart PDF'
};
```

### Response Format

```json
{
  "success": true,
  "data": {
    "products": [
      {
        "id": 1,
        "styleNumber": "LOG105",
        "productName": "OGIO - Glam Polo",
        "description": "Designed to handle the curves...",
        "brand": "OGIO",
        "category": "Polos/Knits",
        "subcategory": "Ladies",
        "status": "Active",
        
        "pricing": {
          "current": 21.99,
          "original": 45.00,
          "sale": 13.17,
          "msrp": 43.98,
          "onSale": true,
          "saleEndDate": "2050-08-30T00:00:00"
        },
        
        "inventory": {
          "totalQty": 128,
          "inStock": true,
          "lowStock": false,
          "bySize": {
            "XS": 106,
            "S": 22
          }
        },
        
        "colors": [
          {
            "name": "Shock Green",
            "code": "382 C",
            "swatchUrl": "https://cdnm.sanmar.com/swatch/gifs/ogio_shockgreen.gif",
            "productImageUrl": "https://cdnm.sanmar.com/catalog/images/imglib/catl/2015/f5/LOG105_shockgreen_model_front_022015.jpg"
          },
          {
            "name": "Signal Red",
            "code": "7427C",
            "swatchUrl": "https://cdnm.sanmar.com/swatch/gifs/ogio_signalred.gif",
            "productImageUrl": "https://cdnm.sanmar.com/catalog/images/imglib/catl/2015/f5/LOG105_signalred_model_front_022015.jpg"
          }
        ],
        
        "images": {
          "thumbnail": "https://cdnm.sanmar.com/catalog/images/LOG105TN.jpg",
          "main": "https://cdnm.sanmar.com/catalog/images/LOG105.jpg",
          "colorSwatch": "https://cdnm.sanmar.com/catalog/images/LOG105sw.jpg",
          "model": {
            "front": "https://cdnm.sanmar.com/imglib/mresjpg/2015/f5/LOG105_shockgreen_model_front_022015.jpg",
            "back": "https://cdnm.sanmar.com/imglib/mresjpg/2015/f5/LOG105_shockgreen_model_back_022015.jpg"
          }
        },
        
        "sizes": ["XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL"],
        "availableSizes": "Ladies Sizes: XS-4XL",
        
        "features": {
          "isTopSeller": false,
          "hasInventory": true,
          "decorationMethods": ["embroidery", "screen printing", "heat transfer"]
        },
        
        "relevanceScore": 0.95
      }
    ],
    
    "facets": {
      "categories": [
        { "name": "Polos/Knits", "count": 245, "selected": false },
        { "name": "T-Shirts", "count": 189, "selected": false },
        { "name": "Sweatshirts/Fleece", "count": 156, "selected": false }
      ],
      "brands": [
        { "name": "Port Authority", "count": 134, "selected": false },
        { "name": "OGIO", "count": 89, "selected": false },
        { "name": "Sport-Tek", "count": 67, "selected": false }
      ],
      "colors": [
        { "name": "Black", "count": 423, "selected": false },
        { "name": "White", "count": 398, "selected": false },
        { "name": "Navy", "count": 367, "selected": false }
      ],
      "sizes": [
        { "name": "S", "count": 512, "selected": false },
        { "name": "M", "count": 508, "selected": false },
        { "name": "L", "count": 506, "selected": false }
      ],
      "priceRanges": [
        { "label": "Under $25", "min": 0, "max": 25, "count": 234 },
        { "label": "$25-$50", "min": 25, "max": 50, "count": 189 },
        { "label": "$50-$100", "min": 50, "max": 100, "count": 67 },
        { "label": "Over $100", "min": 100, "max": null, "count": 12 }
      ]
    },
    
    "pagination": {
      "page": 1,
      "limit": 24,
      "total": 502,
      "totalPages": 21,
      "hasNext": true,
      "hasPrev": false
    },
    
    "metadata": {
      "query": "polo shirt",
      "executionTime": 145,
      "filters": {
        "category": ["Polos/Knits"],
        "priceRange": [10, 50]
      }
    }
  }
}
```

## Secondary Endpoint: `/api/products/bulk`

### Method: POST
Fetch multiple products by style numbers in a single request.

### Request Body
```json
{
  "styleNumbers": ["LOG105", "PC54", "K500"],
  "includeInventory": true,
  "includeColors": true
}
```

## Aggregation Endpoint: `/api/products/filters`

### Method: GET
Get available filter options based on current search context.

### Query Parameters
Same as search endpoint, returns only facet counts.

## Implementation Requirements

### 1. Search Algorithm
- **Text Matching**: Search across STYLE, PRODUCT_TITLE, PRODUCT_DESCRIPTION, KEYWORDS
- **Fuzzy Matching**: Handle typos and partial matches
- **Relevance Scoring**: Weight matches by field importance:
  - STYLE exact match: 1.0
  - PRODUCT_TITLE match: 0.8
  - KEYWORDS match: 0.6
  - DESCRIPTION match: 0.4

### 2. Performance Optimizations
- **Caching Strategy**:
  - Cache facet counts for 5 minutes
  - Cache product details for 15 minutes
  - Cache search results for 2 minutes
- **Database Indexing**: Ensure indexes on:
  - STYLE
  - CATEGORY_NAME
  - BRAND_NAME
  - COLOR_NAME
  - PRODUCT_STATUS
  - QTY
- **Pagination**: Limit default 24, max 100 results

### 3. Data Aggregation Logic
- Group products by STYLE number
- Aggregate inventory across all sizes/colors
- Calculate total inventory per style
- Determine price range per style
- Collect all unique colors per style

### 4. Business Rules
- Hide products where PRODUCT_STATUS = 'Discontinued' unless specifically requested
- Show sale prices when current date is between SALE_START_DATE and SALE_END_DATE
- Mark as "Low Stock" when total QTY < 10
- Mark as "New" when Date_Updated is within last 30 days

### 5. Error Handling
```json
{
  "success": false,
  "error": {
    "code": "INVALID_PARAMETER",
    "message": "Invalid price range: minPrice must be less than maxPrice",
    "field": "minPrice"
  }
}
```

## Testing Requirements

### Test Queries
1. Basic search: `/api/products/search?q=polo`
2. Category filter: `/api/products/search?category=Polos/Knits`
3. Multi-filter: `/api/products/search?brand=OGIO&minPrice=20&maxPrice=50`
4. With facets: `/api/products/search?q=shirt&includeFacets=true`
5. Inventory filter: `/api/products/search?hasInventory=true&minQty=50`

### Expected Performance
- Response time < 500ms for standard queries
- Response time < 1000ms with full facet aggregation
- Support 100+ concurrent requests

## Migration Path

### Phase 1: Implement Core Search
- Basic text search
- Category/brand filtering
- Pagination

### Phase 2: Add Advanced Features
- Faceted filtering with counts
- Relevance scoring
- Inventory aggregation

### Phase 3: Optimize Performance
- Implement caching
- Add database indexes
- Bulk operations

## Notes for Implementation

1. **Use existing Heroku proxy structure** - Extend the current `/src/routes/products.js` file
2. **Leverage existing Caspio connection** - Use the established database connection methods
3. **Follow existing patterns** - Match the coding style and error handling of other endpoints
4. **Consider rate limiting** - Implement rate limiting to prevent abuse
5. **Add monitoring** - Log search queries for analytics and optimization

## Example Implementation Starter

```javascript
// In /src/routes/products.js

router.get('/search', async (req, res) => {
  try {
    const {
      q,
      category,
      brand,
      color,
      minPrice,
      maxPrice,
      sort = 'relevance',
      page = 1,
      limit = 24,
      includeFacets = false
    } = req.query;

    // Build WHERE clause
    let whereConditions = ['PRODUCT_STATUS != \'Discontinued\''];
    
    if (q) {
      whereConditions.push(`(
        STYLE LIKE '%${q}%' OR 
        PRODUCT_TITLE LIKE '%${q}%' OR 
        KEYWORDS LIKE '%${q}%'
      )`);
    }
    
    if (category) {
      const categories = Array.isArray(category) ? category : [category];
      whereConditions.push(`CATEGORY_NAME IN ('${categories.join("','")}')`);
    }
    
    // Add other filters...
    
    const whereClause = whereConditions.join(' AND ');
    
    // Execute search query
    const searchQuery = `
      SELECT * FROM Sanmar_Bulk_251816_Feb2024
      WHERE ${whereClause}
      ORDER BY ${getSortClause(sort)}
      LIMIT ${limit} OFFSET ${(page - 1) * limit}
    `;
    
    // Execute and return results
    const results = await executeCaspioQuery(searchQuery);
    
    // Transform and return response
    res.json({
      success: true,
      data: {
        products: transformProducts(results),
        facets: includeFacets ? await getFacets(whereClause) : null,
        pagination: {
          page,
          limit,
          total: await getTotalCount(whereClause)
        }
      }
    });
    
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SEARCH_ERROR',
        message: 'Failed to execute search'
      }
    });
  }
});
```

## Success Criteria

1. **Functional**: All specified endpoints working with correct data
2. **Fast**: Sub-second response times for 95% of queries
3. **Accurate**: Relevant results with proper filtering
4. **Scalable**: Handles increased load without degradation
5. **Maintainable**: Clean, documented code following existing patterns

---

This specification provides everything needed to implement a modern, performant product search API that will dramatically improve the user experience compared to the current Caspio DataPage approach.