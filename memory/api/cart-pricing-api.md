# Cart & Pricing APIs Documentation

## 📦 MODULE: CART

### Overview
Shopping cart session and item management with full CRUD operations.

### Business Rules
- One active cart per session
- Cart items linked to session via SessionID
- Sizes stored separately in cart_item_sizes table
- Cart status can be: Active, Saved, Abandoned, Converted

### Resource: cart-sessions

#### CREATE - New Cart Session
**Endpoint**: `POST /api/cart-sessions`
**Purpose**: Create a new shopping cart session

**Request Body**:
```json
{
  "SessionID": "session_1234567890",
  "IsActive": true,
  "CreatedDate": "2025-01-30T10:00:00",
  "LastActivity": "2025-01-30T10:00:00"
}
```

**Success Response (201 Created)**:
```json
{
  "data": {
    "ID": 123,
    "SessionID": "session_1234567890",
    "IsActive": true
  }
}
```

#### READ - Get Cart Sessions
**Endpoint**: `GET /api/cart-sessions`
**Query Parameters**:
- `q.where` - SQL filter (e.g., `IsActive=true`)
- `q.limit` - Max results

#### UPDATE - Modify Cart Session
**Endpoint**: `PUT /api/cart-sessions/:id`
**Request Body**: Any fields to update

#### DELETE - Remove Cart Session
**Endpoint**: `DELETE /api/cart-sessions/:id`

### Resource: cart-items

#### CREATE - Add Item to Cart
**Endpoint**: `POST /api/cart-items`

**Request Body**:
```json
{
  "SessionID": "session_1234567890",
  "StyleNumber": "PC54",
  "Color": "Black",
  "Method": "DTG",
  "CartStatus": "Active",
  "CreatedDate": "2025-01-30T10:00:00"
}
```

#### READ - Get Cart Items
**Endpoint**: `GET /api/cart-items`
**Query Parameters**:
- `q.where` - e.g., `SessionID='session_123' AND CartStatus='Active'`

#### UPDATE/DELETE - Similar pattern
- `PUT /api/cart-items/:id`
- `DELETE /api/cart-items/:id`

### Resource: cart-item-sizes

#### CREATE - Add Size to Cart Item
**Endpoint**: `POST /api/cart-item-sizes`

**Request Body**:
```json
{
  "CartItemID": 456,
  "Size": "L",
  "Quantity": 5,
  "UnitPrice": 12.99
}
```

#### Full CRUD Operations
- `GET /api/cart-item-sizes`
- `PUT /api/cart-item-sizes/:id`
- `DELETE /api/cart-item-sizes/:id`

---

## 📦 MODULE: PRICING

### Overview
Pricing calculations for various decoration methods including DTG, embroidery, and screen printing.

### Business Rules
- Tiered pricing based on quantity breaks
- Less Than Minimum (LTM) fee applies when quantity < 24
- Different pricing for contract vs retail
- Size upcharges for 2XL and above

### Resource: pricing-tiers

#### Get Pricing Tiers
**Endpoint**: `GET /api/pricing-tiers`
**Purpose**: Get pricing tiers by decoration method

**Query Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| method | string | Yes | DTG, Embroidery, ScreenPrint, HTV |

**Success Response**:
```json
{
  "data": [
    {
      "quantity_min": 1,
      "quantity_max": 23,
      "price": 15.00,
      "has_ltm": true
    },
    {
      "quantity_min": 24,
      "quantity_max": 47,
      "price": 12.50,
      "has_ltm": false
    }
  ]
}
```

### Resource: embroidery-costs

#### Calculate Embroidery Cost
**Endpoint**: `GET /api/embroidery-costs`

**Query Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| stitchCount | number | Yes | Number of stitches |
| quantity | number | Yes | Order quantity |

**Success Response**:
```json
{
  "stitchCount": 5000,
  "quantity": 24,
  "pricePerItem": 8.50,
  "totalCost": 204.00,
  "tier": "24-47"
}
```

### Additional Pricing Endpoints

- `GET /api/dtg-costs?styleNumber=PC54&color=Black&printSize=Full&quantity=24`
- `GET /api/screenprint-costs?colors=3&quantity=48&locations=1`
- `GET /api/pricing-rules` - Get all pricing rules and markups
- `GET /api/base-item-costs?styleNumber=PC54` - Base garment costs
- `GET /api/size-pricing?styleNumber=PC54&size=2XL` - Size-based pricing
- `GET /api/max-prices-by-style?styleNumber=PC54` - Maximum prices

### ✅ DTF Pricing Bundle

#### Get DTF Transfer Pricing Data
**Endpoint**: `GET /api/pricing-bundle?method=DTF`
**Purpose**: Get complete DTF (Direct-to-Film) transfer pricing data
**Status**: ✅ DEPLOYED - Live in Production

**Query Parameters**:
| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| method | string | Yes | Must be "DTF" | DTF |
| styleNumber | string | No | Product style (optional) | PC54 |

**Expected Response**:
```json
{
  "tiersR": [
    {
      "TierLabel": "10-23",
      "MinQuantity": 10,
      "MaxQuantity": 23,
      "MarginDenominator": 0.6,
      "LTM_Fee": 50
    }
  ],
  "allDtfCostsR": [
    {
      "size": "Up to 5\" x 5\"",
      "price_type": "Small",
      "quantity_range": "10-23",
      "min_quantity": 10,
      "max_quantity": 23,
      "unit_price": 6.00,
      "PressingLaborCost": 2
    }
  ],
  "freightR": [
    {
      "min_quantity": 10,
      "max_quantity": 49,
      "cost_per_transfer": 0.50
    }
  ],
  "rulesR": {
    "RoundingMethod": "HalfDollarCeil_Final"
  },
  "sizes": [],
  "sellingPriceDisplayAddOns": {}
}
```

### ✅ EMB-AL: Embroidery Additional Logo Pricing

#### Get Embroidery Additional Logo Pricing
**Endpoint**: `GET /api/pricing-bundle?method=EMB-AL`
**Purpose**: Get pricing for additional embroidery logos (beyond primary logo)
**Status**: ✅ DEPLOYED (2025-09-04) - Live in Production

**Query Parameters**:
| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| method | string | Yes | Must be "EMB-AL" | EMB-AL |
| styleNumber | string | No | Product style (optional) | PC54 |

**Response Structure**:
```json
{
  "tiersR": [...],
  "allEmbroideryCostsR": [
    {
      "PK_ID": 18,
      "EmbroideryCostID": 17,
      "ItemType": "AL",
      "StitchCount": 8000,
      "TierLabel": "1-23",
      "EmbroideryCost": 12.5,
      "DigitizingFee": 100,
      "AdditionalStitchRate": 1.25,
      "BaseStitchCount": 8000,
      "StitchIncrement": 1000,
      "LogoPositions": "Left Chest,Right Chest,Full Front,Full Back,Left Sleeve,Right Sleeve"
    }
  ],
  "rulesR": {...},
  "locations": [...]
}
```

**Use Case**: Used in embroidery quote builder when customers need multiple logo placements

### ✅ CAP-AL: Cap Additional Logo Pricing

#### Get Cap Additional Logo Pricing
**Endpoint**: `GET /api/pricing-bundle?method=CAP-AL`
**Purpose**: Get pricing for additional logos on caps
**Status**: ✅ DEPLOYED (2025-09-04) - Live in Production

**Query Parameters**:
| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| method | string | Yes | Must be "CAP-AL" | CAP-AL |
| styleNumber | string | No | Product style (optional) | C112 |

**Response Structure**:
```json
{
  "tiersR": [...],
  "allEmbroideryCostsR": [
    {
      "PK_ID": 22,
      "EmbroideryCostID": 21,
      "ItemType": "AL-CAP",
      "StitchCount": 5000,
      "TierLabel": "1-23",
      "EmbroideryCost": 6.75,
      "DigitizingFee": 100,
      "AdditionalStitchRate": 1,
      "BaseStitchCount": 5000,
      "StitchIncrement": 1000,
      "LogoPositions": "Cap Front,Cap Back,Cap Side"
    }
  ],
  "rulesR": {...},
  "locations": [...]
}
```

**Use Case**: For future cap embroidery applications requiring additional logo positions

## 📦 MODULE: PRICING MATRIX

### Overview
Advanced pricing matrix management for complex pricing scenarios.

### Resource: pricing-matrix

#### Lookup Pricing Matrix
**Endpoint**: `GET /api/pricing-matrix/lookup`

**Query Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| method | string | Yes | Decoration method |
| quantity | number | Yes | Order quantity |

#### Full CRUD Operations
- `GET /api/pricing-matrix` - List matrices
- `GET /api/pricing-matrix/:id` - Get specific matrix
- `POST /api/pricing-matrix` - Create matrix
- `PUT /api/pricing-matrix/:id` - Update matrix
- `DELETE /api/pricing-matrix/:id` - Delete matrix

## Cart Integration Architecture

### NWCACart Module Pattern
```javascript
window.NWCACart = (function() {
    // Local state with server sync
    let cartState = {
        sessionId: null,
        items: [],
        loading: false,
        error: null
    };

    async function syncWithServer() {
        // Sync strategy:
        // 1. If server has items, use them
        // 2. If server empty but local has items, push to server
        // 3. Handle conflicts gracefully

        if (serverItems.length > 0) {
            cartState.items = serverItems;
        } else if (cartState.items.length > 0) {
            await pushLocalItemsToServer();
        }
    }
})();
```

**Integration Features**:
- **Dual Storage**: localStorage for offline + database for persistence
- **Session Management**: Generates unique session IDs for tracking
- **Embellishment Validation**: Warns when mixing different decoration types
- **Real-time Sync**: Updates across tabs/windows via storage events

**Business Rules**: Single embellishment type per cart (warns on conflicts)

---

**Base URL**: `https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api`
**Documentation Version**: 2.3.0
**Module**: Cart Management & Pricing APIs