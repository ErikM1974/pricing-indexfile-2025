# NWCA Technical Glossary

**Last Updated:** 2026-01-11
**Purpose:** Shared terminology across all 3 NWCA projects

---

## Color Fields

| Term | Definition | Example | Used For |
|------|------------|---------|----------|
| `COLOR_NAME` | Human-readable display name | "Brilliant Orange" | UI, customer quotes |
| `CATALOG_COLOR` | SanMar internal code | "BrillOrng" | API queries, inventory checks |
| `ColorRange` | Color category grouping | "Oranges" | Filtering, search |

**Critical:** Use `CATALOG_COLOR` for inventory API, `COLOR_NAME` for display only!

---

## Identifiers

| Term | Format | Example | System |
|------|--------|---------|--------|
| `QuoteID` | `[PREFIX][MMDD]-[seq]` | `DTG0111-1` | Caspio quote_sessions |
| `ExtOrderID` | `NWCA-[number]` | `NWCA-52083` | ManageOrders → ShopWorks |
| `id_Order` | Integer | `139972` | ShopWorks primary key |
| `order_no` | Integer | `138145` | ShopWorks display number |
| `id_Customer` | Integer | `12279` | ShopWorks customer ID |
| `id_Integration` | Integer | `5` | ShopWorks size translation table |
| `SessionID` | Stripe session | `cs_live_xxx` | Stripe checkout reference |

**Quote Prefixes:**
- `DTG` - Direct-to-Garment
- `DTF` - Direct-to-Film
- `EMB` - Embroidery Contract
- `EMBC` - Customer Supplied Embroidery
- `SPC` - Screen Print Contract
- `LT` - Laser Tumblers
- `PATCH` - Embroidered Emblems
- `CAP` - Cap Embroidery
- `RICH` - Richardson Caps
- `WEB` - Webstore Orders
- `3DT` - 3-Day Tees

---

## ShopWorks Status Fields

All status fields use: **0=No, 1=Yes, 0.5=Partial, 8=N/A, 222=N/A**

| Field | Meaning |
|-------|---------|
| `sts_ArtDone` | Artwork approved |
| `sts_Purchased` | Materials ordered from vendor |
| `sts_PurchasedSub` | Subcontract materials ordered |
| `sts_Received` | Materials received |
| `sts_ReceivedSub` | Subcontract materials received |
| `sts_Produced` | Production completed |
| `sts_Shipped` | Order shipped |
| `sts_Invoiced` | Invoice created |
| `sts_Paid` | Payment received |
| `sts_EnableTax01-04` | Tax flags for line items |

---

## ShopWorks Currency Fields

All prefixed with `cur_`:

| Field | Meaning |
|-------|---------|
| `cur_SubTotal` | Order subtotal before tax/shipping |
| `cur_Shipping` | Shipping charges |
| `cur_SalesTaxTotal` | Tax amount |
| `cur_TotalInvoice` | Grand total |
| `cur_Payments` | Total payments received |
| `cur_Balance` | Outstanding balance |
| `cur_Adjustment` | Price adjustments |

---

## ShopWorks Date Fields

| Field | Note |
|-------|------|
| `date_Ordered` | Order placed |
| `date_Invoiced` | Invoice created |
| `date_RequestedToShip` | Requested ship date |
| `date_Shippied` | ⚠️ Typo in API - actual ship date |
| `date_Produced` | Production completion |
| `date_PaymentApplied` | Payment recorded |

---

## Size Modifiers

ShopWorks uses `_2X` and `_3X` suffixes, NOT `_2XL` and `_3XL`:

| Size | SKU Suffix | Size Field |
|------|------------|------------|
| S-XL | (base SKU) | Size01-Size04 |
| 2XL | `_2X` | Size05 |
| 3XL | `_3X` | Size06 |
| 4XL-6XL | Varies by product | Check mapping |

**Example:** PC54 2XL → SKU `PC54_2X`, uses `Size05` (NOT Size06!)

---

## API Terminology

| Term | Definition |
|------|------------|
| `fetchAllCaspioPages` | Function that handles Caspio pagination (1000 record limit) |
| `makeCaspioRequest` | ⚠️ DEPRECATED - doesn't paginate |
| `TTL` | Time-to-live for cache entries |
| `strictLimiter` | Rate limiter for sensitive endpoints |
| `sanitizeFilterInput` | SQL injection prevention for Caspio |
| `escapeHTML` | XSS prevention for innerHTML |

---

## Caspio Tables

| Table | Purpose |
|-------|---------|
| `quote_sessions` | Quote headers (customer, totals, status) |
| `quote_items` | Quote line items (products, sizes, prices) |
| `Customers` | Customer master data |
| `Inventory` | SanMar stock levels (cached) |
| `Products` | Product catalog |

---

## ManageOrders API

| Term | Definition |
|------|------------|
| **PULL API** | Read data FROM ShopWorks (GET requests) |
| **PUSH API** | Write data TO ShopWorks (POST requests) |
| `LinesOE` | Order Entry line items array |
| `LinesOEP` | Player/personalization items array |

---

## Project-Specific Terms

### Pricing Index
- `APP_CONFIG` - Global configuration object
- `pricingBundle` - Cached pricing data structure
- `adapter` - Pattern for transforming Caspio data

### caspio-pricing-proxy
- `ALLOWED_ORIGINS` - CORS whitelist
- `cacheManager` - In-memory cache with TTL

### Python Inksoft
- `SIZE_MODIFIERS` - Dict mapping sizes to SKU suffixes
- `store config` - Per-store settings in `stores.py`
- `transform.py` - Main order transformation module

---

## Common Abbreviations

| Abbr | Meaning |
|------|---------|
| DTG | Direct-to-Garment printing |
| DTF | Direct-to-Film transfer |
| EMB | Embroidery |
| LTM | Less Than Minimum (fee) |
| EDP | Electronic Data Processing (ShopWorks import) |
| PO | Purchase Order |
| SKU | Stock Keeping Unit |

---

**See also:** [CROSS_PROJECT_HUB.md](./CROSS_PROJECT_HUB.md) for project overview
