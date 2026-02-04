# Non-SanMar Products API Documentation

## Overview

CRUD API for managing products from vendors other than SanMar (Brooks Brothers, Carhartt direct, specialty items, etc.). Data is stored in the Caspio `Non_SanMar_Products` table.

**Use Cases:**
- Products ordered directly from manufacturers (not via SanMar)
- Specialty items with fixed pricing
- Vendor-specific products that need custom pricing rules

### Business Rules
- Products use fixed pricing by default (`PricingMethod: "FIXED"`)
- Size upcharges apply to 2XL, 3XL (and optionally XL)
- Soft delete by default (sets `IsActive = false`)
- 5-minute server-side cache for GET requests
- StyleNumber must be unique across all products

---

## API Reference

**Base URL:** `https://caspio-pricing-proxy-ab30a049961a.herokuapp.com`

### Endpoints Summary

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/non-sanmar-products` | List all products (with filters) |
| GET | `/api/non-sanmar-products/:id` | Get product by ID_Product |
| GET | `/api/non-sanmar-products/style/:style` | Get product by StyleNumber |
| GET | `/api/non-sanmar-products/cache/clear` | Clear server cache |
| POST | `/api/non-sanmar-products` | Create new product |
| POST | `/api/non-sanmar-products/seed` | Seed initial product data |
| PUT | `/api/non-sanmar-products/:id` | Update product by ID |
| DELETE | `/api/non-sanmar-products/:id` | Soft delete (or hard delete) |

---

## GET /api/non-sanmar-products

Returns all non-SanMar products, optionally filtered.

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| brand | string | - | Filter by Brand (partial match, case-insensitive) |
| category | string | - | Filter by Category (partial match, case-insensitive) |
| vendor | string | - | Filter by VendorCode (exact match, case-insensitive) |
| active | string | "true" | Filter by IsActive ("true", "false", or omit for all) |
| refresh | string | "false" | Set to "true" to bypass 5-minute cache |

### Response

```json
{
  "success": true,
  "data": [
    {
      "PK_ID": 7,
      "ID_Product": 7,
      "StyleNumber": "CTJ140",
      "Brand": "Carhartt",
      "ProductName": "Duck Active Jac",
      "Category": "Jackets",
      "DefaultCost": 65,
      "DefaultSellPrice": 130,
      "PricingMethod": "FIXED",
      "MarginPercent": null,
      "SizeUpchargeXL": 0,
      "SizeUpcharge2XL": 5,
      "SizeUpcharge3XL": 10,
      "AvailableSizes": "S,M,L,XL,2XL,3XL,4XL",
      "DefaultColors": "",
      "VendorCode": "CARH",
      "VendorURL": "",
      "ImageURL": "",
      "Notes": "",
      "Date_Added": "2026-02-03T09:59:09",
      "IsActive": true
    }
  ],
  "count": 1,
  "source": "caspio"
}
```

### Examples

```bash
# Get all active products
curl "https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/non-sanmar-products"

# Filter by brand
curl "https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/non-sanmar-products?brand=Brooks"

# Filter by vendor code
curl "https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/non-sanmar-products?vendor=CARH"

# Filter by category
curl "https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/non-sanmar-products?category=Jackets"

# Include inactive products
curl "https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/non-sanmar-products?active=false"

# Force cache refresh
curl "https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/non-sanmar-products?refresh=true"
```

---

## GET /api/non-sanmar-products/:id

Get a single product by its `ID_Product` (primary key).

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| id | number | The ID_Product value (numeric) |

### Response

```json
{
  "success": true,
  "data": {
    "PK_ID": 6,
    "ID_Product": 6,
    "StyleNumber": "CTK87",
    "Brand": "Carhartt",
    "ProductName": "Workwear Pocket T-Shirt",
    ...
  }
}
```

### Error Response (404)

```json
{
  "success": false,
  "error": "Product with ID_Product=999 not found"
}
```

---

## GET /api/non-sanmar-products/style/:style

Get a single product by its StyleNumber.

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| style | string | The StyleNumber (e.g., "BB18200", "CTK87") |

### Response

```json
{
  "success": true,
  "data": {
    "PK_ID": 4,
    "ID_Product": 4,
    "StyleNumber": "BB18200",
    "Brand": "Brooks Brothers",
    ...
  }
}
```

### Example

```bash
curl "https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/non-sanmar-products/style/CTJ140"
```

---

## GET /api/non-sanmar-products/cache/clear

Clears the server-side product cache. Use after making changes directly in Caspio.

### Response

```json
{
  "success": true,
  "message": "Non-SanMar products cache cleared"
}
```

---

## POST /api/non-sanmar-products

Create a new non-SanMar product.

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| StyleNumber | string | Unique product style number |
| Brand | string | Brand name (e.g., "Brooks Brothers") |
| ProductName | string | Product display name |

### Optional Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| Category | string | "" | Product category |
| DefaultCost | number | 0 | Base cost from vendor |
| DefaultSellPrice | number | 0 | Base sell price |
| PricingMethod | string | "FIXED" | "FIXED" or "MARGIN" |
| MarginPercent | number | 0 | Margin % (if PricingMethod=MARGIN) |
| SizeUpchargeXL | number | 0 | Upcharge for XL sizes |
| SizeUpcharge2XL | number | 0 | Upcharge for 2XL sizes |
| SizeUpcharge3XL | number | 0 | Upcharge for 3XL+ sizes |
| AvailableSizes | string | "" | Comma-separated sizes |
| DefaultColors | string | "" | Comma-separated colors |
| VendorCode | string | "" | Short vendor code (BB, CARH, CS) |
| VendorURL | string | "" | Link to vendor product page |
| ImageURL | string | "" | Product image URL |
| Notes | string | "" | Internal notes |
| IsActive | boolean | true | Product visibility |

### Request Body Example

```json
{
  "StyleNumber": "CTK126",
  "Brand": "Carhartt",
  "ProductName": "Carhartt Midweight Hooded Sweatshirt",
  "Category": "Sweatshirts",
  "DefaultCost": 42.00,
  "DefaultSellPrice": 85.00,
  "PricingMethod": "FIXED",
  "VendorCode": "CARH",
  "AvailableSizes": "S,M,L,XL,2XL,3XL",
  "SizeUpcharge2XL": 5,
  "SizeUpcharge3XL": 8
}
```

### Response (201 Created)

```json
{
  "success": true,
  "message": "Product 'CTK126' created successfully",
  "data": {
    "StyleNumber": "CTK126",
    "Brand": "Carhartt",
    "ProductName": "Carhartt Midweight Hooded Sweatshirt",
    "ID_Product": 9,
    ...
  }
}
```

---

## PUT /api/non-sanmar-products/:id

Update an existing product by ID_Product.

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| id | number | The ID_Product value |

### Request Body

Include only the fields you want to update. `ID_Product` cannot be changed.

```json
{
  "DefaultSellPrice": 90.00,
  "Notes": "Price increased Feb 2026"
}
```

### Response

```json
{
  "success": true,
  "message": "Product ID_Product=9 updated successfully",
  "updatedFields": ["DefaultSellPrice", "Notes"]
}
```

---

## DELETE /api/non-sanmar-products/:id

Delete a product. By default, performs a soft delete (sets `IsActive = false`).

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| id | number | The ID_Product value |

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| hard | string | "false" | Set to "true" for permanent deletion |

### Soft Delete Response

```json
{
  "success": true,
  "message": "Product ID_Product=9 deactivated (soft delete)",
  "note": "Use ?hard=true to permanently delete"
}
```

### Hard Delete Example

```bash
curl -X DELETE "https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/non-sanmar-products/9?hard=true"
```

---

## POST /api/non-sanmar-products/seed

Seeds the database with initial product data. Safe to run multiple times - only inserts records that don't already exist (checked by StyleNumber).

### Response

```json
{
  "success": true,
  "message": "Seed complete: 1 inserted, 0 skipped (already exist), 0 failed",
  "results": {
    "inserted": 1,
    "skipped": 0,
    "failed": 0,
    "errors": []
  },
  "summary": {
    "expected": 1,
    "nowInDatabase": 1,
    "missing": 0
  }
}
```

---

## Database Schema

### Caspio Table: `Non_SanMar_Products`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| PK_ID | AutoNumber | Auto | Caspio primary key |
| ID_Product | Number | Auto | Unique product ID |
| StyleNumber | Text(50) | Yes | Unique style number |
| Brand | Text(100) | Yes | Brand name |
| ProductName | Text(200) | Yes | Product display name |
| Category | Text(100) | No | Product category |
| DefaultCost | Number | No | Base cost from vendor |
| DefaultSellPrice | Number | No | Base sell price |
| PricingMethod | Text(20) | No | "FIXED" or "MARGIN" |
| MarginPercent | Number | No | Margin % if using MARGIN pricing |
| SizeUpchargeXL | Number | No | XL size upcharge |
| SizeUpcharge2XL | Number | No | 2XL size upcharge |
| SizeUpcharge3XL | Number | No | 3XL+ size upcharge |
| AvailableSizes | Text(200) | No | Comma-separated sizes |
| DefaultColors | Text(500) | No | Comma-separated colors |
| VendorCode | Text(20) | No | Short vendor code |
| VendorURL | Text(500) | No | Vendor product page URL |
| ImageURL | Text(500) | No | Product image URL |
| Notes | Text(1000) | No | Internal notes |
| Date_Added | DateTime | Auto | Record creation timestamp |
| IsActive | Yes/No | No | Active status (default: true) |

---

## Seeded Products (Feb 2026)

### Carhartt (VendorCode: CARH)
| StyleNumber | Product | Category | Cost | Sell |
|-------------|---------|----------|------|------|
| CTJ140 | Duck Active Jac | Jackets | $65 | $130 |

**Cleanup Note (Feb 2026):** The following products were removed from Non_SanMar_Products because they are now available in the SanMar 2026 catalog:
- BB18200, BB18201, BB18202, BB18203 (Brooks Brothers)
- CTK87 (Carhartt Workwear Pocket T-Shirt)
- CSV400 (CornerStone Safety Vest)

Use the SanMar Products API for these items instead - they have real-time inventory and accurate SanMar pricing.

---

## Products Awaiting Addition (Feb 2026)

**Source:** Classification of 20,380 order line items (Jan 2025 - Feb 2026)
**Status:** 76 unique non-SanMar products identified, priority items listed below

### Richardson Caps (VendorCode: RICH)
High-volume caps ordered directly from Richardson.

| StyleNumber | Orders | Product | Category | Est. Cost | Est. Sell |
|-------------|--------|---------|----------|-----------|-----------|
| 112 | 497 | Trucker Cap | Caps | $8 | $16 |
| 110 | 12 | R-Flex Cap | Caps | $10 | $20 |
| 115 | 8 | Low Pro Trucker | Caps | $9 | $18 |
| 258 | 8 | 5 Panel Rope Cap | Caps | $12 | $24 |
| 511 | 7 | Flatbill Trucker | Caps | $10 | $20 |
| PTS65 | 5 | Surge Fitted Cap | Caps | $14 | $28 |

### Callaway Golf (VendorCode: CALL)
Premium golf polos, ordered direct.

| StyleNumber | Orders | Product | Category | Est. Cost | Est. Sell |
|-------------|--------|---------|----------|-----------|-----------|
| CGM211 | 60 | Core Performance Polo (M) | Polos | $35 | $70 |
| CGW212 | 15 | Core Performance Polo (W) | Polos | $35 | $70 |

### Cutter & Buck (VendorCode: CB)
Premium apparel, ordered direct.

| StyleNumber | Orders | Product | Category | Est. Cost | Est. Sell |
|-------------|--------|---------|----------|-----------|-----------|
| MQK00075 | 6 | Spin Pique Polo | Polos | $45 | $90 |
| MCK01127 | 4 | Advantage Polo | Polos | $42 | $84 |
| MCK01144 | 3 | Forge Heather Polo | Polos | $40 | $80 |

### Hi-Vis Safety (VendorCode: HIVIS)
Safety vests and jackets from various suppliers.

| StyleNumber | Orders | Product | Category | Est. Cost | Est. Sell |
|-------------|--------|---------|----------|-----------|-----------|
| 1712 | 24 | Hype-Lite Vest | Safety | $18 | $36 |
| 1715 | 9 | VPO Vest | Safety | $20 | $40 |
| 8001 | 9 | Safety Bomber Jacket | Jackets | $45 | $90 |
| 3131 | 5 | GSS Visibility Vest | Safety | $15 | $30 |
| 6005 | 3 | Safety Hoodie | Sweatshirts | $35 | $70 |

### Promotional Items (VendorCode: PROMO)
Drinkware from Polar Camel and similar vendors.

| StyleNumber | Orders | Product | Category | Est. Cost | Est. Sell |
|-------------|--------|---------|----------|-----------|-----------|
| LTM752 | 294 | 16 oz Pint Glass | Drinkware | $5 | $12 |
| LTM761 | 12 | 20 oz Tumbler | Drinkware | $8 | $18 |
| LTM765 | 4 | Pint with Slider Lid | Drinkware | $7 | $15 |
| LTM768 | 2 | Pint with Slider Lid (Alt) | Drinkware | $7 | $15 |

### Specialty Items (VendorCode: SPEC)
Custom and specialty products.

| StyleNumber | Orders | Product | Category | Est. Cost | Est. Sell |
|-------------|--------|---------|----------|-----------|-----------|
| CP96 | 76 | Hops n Drops Custom Hat | Caps | $12 | $24 |
| HT01 | 23 | Skull Cap | Caps | $6 | $12 |
| 470CB | 6 | Velcro Strap Cap | Caps | $10 | $20 |
| 2375 | 7 | Badger Pacesetter Hoodie | Sweatshirts | $28 | $56 |
| STK-GLS-SQR | 92 | 2.5" Glossy Square Sticker | Stickers | $0.50 | $1.50 |

### From ShopWorks Match (NOT in SanMar)
Products found in ShopWorks database but not available through SanMar.

| StyleNumber | Orders | Product | Category | Est. Cost | Est. Sell |
|-------------|--------|---------|----------|-----------|-----------|
| CE701 | 7 | Core 365 Fleece Bonded Vest | Vests | $35 | $70 |
| BA920 | 8 | Bayside Quarter-Zip Pullover | Sweatshirts | $25 | $50 |
| OC771 | 2 | Outdoor Cap Trucker Cap | Caps | $8 | $16 |

### Implementation Notes

**Priority Order for Adding to Caspio:**
1. **High (≥50 orders):** 112, LTM752, STK-GLS-SQR, CP96, CGM211
2. **Medium (10-49 orders):** 1712, HT01, CGW212, 110, LTM761
3. **Low (<10 orders):** Remaining items

**Pricing Notes:**
- Estimated costs/prices shown above - verify with vendor before entry
- Richardson caps: Use Richardson wholesale price list
- Callaway/Cutter & Buck: Premium pricing, verify direct order minimums
- Hi-Vis: Multiple suppliers, match existing order pricing

---

## Related Documentation

- [Service Codes Table](../SERVICE_CODES_TABLE.md) - Service codes (DD, AL, FB, DECG) also stored in Caspio
- [Products API](products-api.md) - SanMar products API
- [CASPIO_API_CORE.md](../CASPIO_API_CORE.md) - Core Caspio proxy patterns

---

**Base URL**: `https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api`
**Documentation Version**: 1.0.0
**Last Updated**: 2026-02-03
**Module**: Non-SanMar Products CRUD API
