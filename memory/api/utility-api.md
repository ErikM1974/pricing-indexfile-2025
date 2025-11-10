# Utility APIs Documentation

## 📦 MODULE: TRANSFERS

### Overview
Transfer printing pricing and management.

### Business Rules
- Different pricing for Adult, Youth, and Toddler sizes
- Price types: Regular, Special, Premium
- Quantity-based pricing tiers

### Resource: transfers/lookup

#### Get Transfer Price
**Endpoint**: `GET /api/transfers/lookup`

**Query Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| size | string | Yes | Adult, Youth, Toddler |
| quantity | number | Yes | Order quantity |
| price_type | string | No | Regular, Special, Premium |

**Success Response**:
```json
{
  "size": "Adult",
  "quantity": 50,
  "priceType": "Regular",
  "unitPrice": 2.85,
  "totalPrice": 142.50
}
```

### Additional Transfer Endpoints

- `GET /api/transfers/matrix?size=Adult` - Get pricing matrix
- `GET /api/transfers/sizes` - Get all available sizes
- `GET /api/transfers` - List all transfers

---

## 📦 MODULE: PRODUCTION

### Overview
Production schedule management and tracking.

### Resource: production-schedules

#### Get Production Schedules
**Endpoint**: `GET /api/production-schedules`

**Query Parameters**:
| Parameter | Type | Required | Description | Default |
|-----------|------|----------|-------------|---------|
| q.where | string | No | SQL filter | - |
| q.orderBy | string | No | Sort order | Date DESC |
| q.limit | number | No | Max results | 100 |

**Success Response**:
```json
{
  "data": [
    {
      "ID": 1,
      "OrderNumber": "ORD-2025-001",
      "CustomerName": "ABC Company",
      "ProductionDate": "2025-02-01",
      "Status": "In Progress",
      "Quantity": 500,
      "Method": "Screen Print"
    }
  ]
}
```

---

## 📦 MODULE: UTILITIES

### Overview
Utility endpoints for reference data and system status.

### Resource: health & status

#### Health Check
**Endpoint**: `GET /api/health`
**Response**: `{ "status": "healthy", "timestamp": "2025-01-30T10:00:00" }`

#### API Status
**Endpoint**: `GET /api/status`
**Response**: `{ "api": "running", "database": "connected", "cache": "active" }`

### Resource: reference-data

#### Get All Brands
**Endpoint**: `GET /api/all-brands`
**Response**: `{ "data": ["Port Authority", "Port & Company", "District", "Nike", "OGIO"] }`

#### Get All Categories
**Endpoint**: `GET /api/all-categories`
**Response**: `{ "data": ["T-Shirts", "Polos", "Outerwear", "Bags", "Headwear"] }`

#### Get All Subcategories
**Endpoint**: `GET /api/all-subcategories`
**Response**: `{ "data": ["Short Sleeve", "Long Sleeve", "Tank Tops", "Performance"] }`

### Additional Utility Endpoints

- `GET /api/subcategories-by-category?category=T-Shirts` - Subcategories for category
- `GET /api/products-by-category-subcategory?category=T-Shirts&subcategory=Long Sleeve`
- `GET /api/filter-products?category=T-Shirts&minPrice=10&maxPrice=50` - Multi-criteria filter
- `GET /api/recommendations?styleNumber=PC54` - Product recommendations
- `GET /api/staff-announcements` - Staff announcements

---

## Implementation Examples

### Product Search with Facets
```javascript
async function searchProducts(filters) {
  const params = new URLSearchParams({
    q: filters.searchText || '',
    page: filters.page || 1,
    limit: 24,
    includeFacets: true,
    sort: filters.sort || 'name_asc'
  });

  // Add array filters
  if (filters.categories?.length) {
    filters.categories.forEach(cat =>
      params.append('category[]', cat)
    );
  }

  const response = await fetch(
    `${API_BASE}/products/search?${params}`
  );
  return response.json();
}
```

### Health Check Monitoring
```javascript
// Regular health check monitoring
async function monitorHealth() {
  try {
    const response = await fetch(`${API_BASE}/health`);
    const data = await response.json();

    if (data.status !== 'healthy') {
      console.error('API unhealthy:', data);
      showWarningBanner('API experiencing issues');
    }
  } catch (error) {
    console.error('API unreachable:', error);
    showErrorBanner('API is currently offline');
  }
}

// Check every 5 minutes
setInterval(monitorHealth, 5 * 60 * 1000);
```

### Loading Reference Data
```javascript
class ReferenceDataService {
  constructor() {
    this.cache = new Map();
    this.cacheExpiry = 30 * 60 * 1000; // 30 minutes
  }

  async getBrands() {
    return this.getCachedData('brands', '/api/all-brands');
  }

  async getCategories() {
    return this.getCachedData('categories', '/api/all-categories');
  }

  async getCachedData(key, endpoint) {
    // Check cache
    if (this.cache.has(key)) {
      const cached = this.cache.get(key);
      if (Date.now() - cached.timestamp < this.cacheExpiry) {
        return cached.data;
      }
    }

    // Fetch fresh data
    const response = await fetch(`${API_BASE}${endpoint}`);
    const data = await response.json();

    // Update cache
    this.cache.set(key, {
      data: data.data,
      timestamp: Date.now()
    });

    return data.data;
  }
}
```

### Production Schedule Integration
```javascript
async function getProductionSchedule(filters = {}) {
  const params = new URLSearchParams();

  // Add filters
  if (filters.status) {
    params.append('q.where', `Status='${filters.status}'`);
  }
  if (filters.method) {
    params.append('q.where', `Method='${filters.method}'`);
  }

  // Add sorting
  params.append('q.orderBy', 'ProductionDate DESC');
  params.append('q.limit', '50');

  const response = await fetch(
    `${API_BASE}/production-schedules?${params}`
  );
  return response.json();
}
```

### Transfer Pricing Calculator
```javascript
class TransferPricingCalculator {
  async calculatePrice(size, quantity, priceType = 'Regular') {
    const response = await fetch(
      `${API_BASE}/transfers/lookup?` +
      `size=${size}&quantity=${quantity}&price_type=${priceType}`
    );

    const data = await response.json();
    return {
      unitPrice: data.unitPrice,
      totalPrice: data.totalPrice,
      savings: this.calculateSavings(data)
    };
  }

  calculateSavings(pricing) {
    // Calculate volume discount savings
    const basePrice = pricing.unitPrice * 1.2; // Assume 20% markup at low qty
    const savings = (basePrice - pricing.unitPrice) * pricing.quantity;
    return savings > 0 ? savings : 0;
  }
}
```

---

**Base URL**: `https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api`
**Documentation Version**: 2.3.0
**Module**: Utility, Transfer & Production APIs