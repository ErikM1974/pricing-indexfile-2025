# API Documentation - Caspio Pricing Proxy

## Base URL
`https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api`

## Architecture (2025 Modular)
- `/src/routes/cart.js` - Cart sessions, items, sizes
- `/src/routes/orders.js` - Orders, customers, dashboard
- `/src/routes/products.js` - Product search, details, colors
- `/src/routes/inventory.js` - Inventory lookup, sizes
- `/src/routes/pricing.js` - Pricing tiers, costs, rules
- `/src/routes/pricing-matrix.js` - Pricing matrix operations
- `/src/routes/quotes.js` - Quote analytics, items, sessions
- `/src/routes/transfers.js` - Transfer pricing
- `/src/routes/misc.js` - Utility endpoints

## Standard CRUD Pattern
All resources follow RESTful conventions:
- `GET /resource` - List with optional filters
- `GET /resource/:id` - Get specific item
- `POST /resource` - Create new item
- `PUT /resource/:id` - Update existing item
- `DELETE /resource/:id` - Delete item

## Key Endpoints Reference

### Cart Management
| Endpoint | Method | Description | Key Params |
|----------|--------|-------------|------------|
| `/cart-sessions` | GET/POST/PUT/DELETE | Cart session management | sessionID, userID, isActive |
| `/cart-items` | GET/POST/PUT/DELETE | Cart items | sessionID, productID, styleNumber |
| `/cart-item-sizes` | GET/POST/PUT/DELETE | Size breakdown | cartItemID, size, quantity |

### Pricing & Products
| Endpoint | Method | Description | Key Params |
|----------|--------|-------------|------------|
| **`/products/search`** | **GET** | **Advanced product search** | **q, category, brand, color, size, minPrice, maxPrice, sort, page, limit, includeFacets** |
| `/pricing-tiers` | GET | Get pricing tiers | method (DTG/ScreenPrint/Embroidery) |
| `/embroidery-costs` | GET | Embroidery pricing | itemType, stitchCount |
| `/dtg-costs` | GET | DTG pricing | - |
| `/screenprint-costs` | GET | Screen print costs | costType (Primary/Additional) |
| `/stylesearch` | GET | Style suggestions | term (min 2 chars) |
| `/product-details` | GET | Product info | styleNumber, color |
| `/color-swatches` | GET | Available colors | styleNumber |
| `/inventory` | GET | Stock levels | styleNumber, color |

#### Products Search Endpoint (NEW - Live August 2025)
The `/products/search` endpoint provides Google-like search with faceted filtering:

**Query Parameters:**
- `q` - Search text across style, title, description, keywords
- `category` - Filter by category (supports arrays)
- `brand` - Filter by brand (supports arrays)  
- `color` - Filter by color (supports arrays)
- `size` - Filter by size (supports arrays)
- `minPrice`/`maxPrice` - Price range filtering
- `status` - Active/Discontinued/all (default: Active)
- `isTopSeller` - Boolean for top sellers
- `sort` - name_asc/desc, price_asc/desc, newest, style
- `page`/`limit` - Pagination (default: page 1, limit 24)
- `includeFacets` - Include filter counts for UI

**Response includes:**
- Grouped products by style number
- Comprehensive images (thumbnail, main, model, flat, swatches)
- Aggregated colors and sizes per style
- Price ranges across variants
- Optional facet counts for dynamic filtering
- Pagination metadata

Example: `GET /api/products/search?q=polo&category=Polos/Knits&includeFacets=true`

### Quote System (Critical for Calculators)
| Endpoint | Method | Description | Key Fields |
|----------|--------|-------------|------------|
| `/quote_sessions` | POST | Create quote | QuoteID, CustomerEmail, TotalAmount, Status |
| `/quote_sessions` | GET | List quotes | quoteID, customerEmail, status |
| `/quote_items` | POST | Add line items | QuoteID, ProductName, Quantity, FinalUnitPrice |

#### Quote Session Schema
```javascript
{
  QuoteID: "DTG0127-1",        // Format: PREFIX+MMDD-sequence
  SessionID: "unique_session",
  CustomerEmail: "email@example.com",
  CustomerName: "John Doe",
  TotalQuantity: 48,
  SubtotalAmount: 500.00,
  LTMFeeTotal: 50.00,
  TotalAmount: 550.00,
  Status: "Open",
  ExpiresAt: "2025-02-26T12:00:00",
  Notes: "Customer notes"
}
```

#### Quote Item Schema
```javascript
{
  QuoteID: "DTG0127-1",
  LineNumber: 1,
  StyleNumber: "PC54",
  ProductName: "Cotton T-Shirt",
  Quantity: 48,
  FinalUnitPrice: 11.54,
  LineTotal: 554.00,
  PricingTier: "48-71",
  SizeBreakdown: "{}"  // JSON string
}
```

### Orders & Customers
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/orders` | CRUD | Order management |
| `/customers` | CRUD | Customer records |
| `/order-dashboard` | GET | Dashboard metrics (days, includeDetails, compareYoY) |
| `/order-odbc` | GET | Legacy order data (q.where, q.orderBy, q.limit) |

### Art Management
| Endpoint | Method | Description | Notes |
|----------|--------|-------------|-------|
| `/artrequests` | CRUD | Art request tracking | Dynamic fields from Caspio |
| `/art-invoices` | CRUD | Art invoice management | Auto-handles new fields |
| `/production-schedules` | GET | Production availability | DTG, Embroidery, Screen dates |

## Common Query Patterns

### Filtering
```
GET /api/resource?field1=value1&field2=value2
```

### Pagination
```
GET /api/resource?pageNumber=1&pageSize=25
```

### Sorting
```
GET /api/resource?orderBy=field%20DESC
```

### Complex Queries (order-odbc style)
```
GET /api/order-odbc?q.where=date>'2021-03-01'&q.orderBy=date DESC&q.limit=100
```

## Critical Implementation Notes

1. **Date Format**: ISO format, remove milliseconds: `.replace(/\.\d{3}Z$/, '')`
2. **Quote IDs**: Always use PREFIX+MMDD-sequence format
3. **Number Fields**: Use `parseFloat()` with `.toFixed(2)` for currency
4. **SizeBreakdown**: Store as JSON string, not object
5. **Dynamic Fields**: Art endpoints accept any fields from Caspio tables

## Testing Endpoints
```bash
# Quick health check
curl https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/status

# Get pricing tiers
curl "BASE_URL/api/pricing-tiers?method=DTG"

# Create quote session (critical for calculators)
curl -X POST BASE_URL/api/quote_sessions \
  -H "Content-Type: application/json" \
  -d '{"QuoteID":"TEST0127-1","CustomerEmail":"test@example.com","TotalAmount":100}'
```

## Error Handling
- 404: Resource not found or no matching products
- 400: Invalid parameters or data format
- 500: Server error (often special characters in PUT operations)

For complete endpoint details, check the modular route files in `/src/routes/`.