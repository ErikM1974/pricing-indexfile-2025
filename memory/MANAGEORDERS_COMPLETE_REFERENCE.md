# ManageOrders API Complete Reference

The definitive guide to ShopWorks ManageOrders API usage across all NWCA projects. This document covers every field, endpoint, pattern, and gotcha discovered from production use.

> **Official API docs**: `/memory/manageorders-api-guide-2024.pdf` (37 pages, v05.22.24)
> Key sections: PULL API (p5-16), PUSH API (p17-37), Authentication (p2-4), Errors (p11)
>
> **Official Swaggers (2, both Swagger 2.0):**
> - **PUSH** — <https://app.swaggerhub.com/apis-docs/ShopWorks/OnSiteExternalAPI/1.0.0> "ManageOrders Push API" (host `manageordersapi.com/onsite`). Snapshot: `manageorders-push-swagger-2026-07-10.json`. Every `ExternalOrderJson` field (LinesOE/Designs/Payments/etc.).
> - **PULL** — <https://app.swaggerhub.com/apis-docs/ShopWorks/ManageOrdersAPI/1.0.0> "ManageOrders API" (host `manageordersapi.com/v1`). Snapshot: `manageorders-pull-swagger-2026-07-10.json`. Response models: `Orders`(42), `LineItems`(20, Size01–06 positional), `Tracking`, `OnSite/WebPayments`, `InventoryLevels`.
> Re-fetch either: `curl -s -H "Accept: application/json" https://api.swaggerhub.com/apis/ShopWorks/{OnSiteExternalAPI|ManageOrdersAPI}/1.0.0`. **NO field descriptions in either spec — the gotchas in THIS doc + the cheat-sheet page are the value-add. See §"Official Swagger vs Reality" (spec omits tax flags, uses ISO dates; reality = MM/DD/YYYY, marks all optional).**
>
> **Staff cheat sheet (Erik-buildable, admin-only)**: `/dashboards/manageorders-api-reference.html` — every endpoint + field with the gotchas, live filter. Renders from an embedded snapshot; **this file stays the single source of truth (update HERE, not the page's JS).**

**Last Updated:** 2026-02-22
**Applies To:** Pricing Index File 2025, caspio-pricing-proxy, Python Inksoft

---

## Table of Contents
1. [Executive Summary](#executive-summary)
2. [Architecture Overview](#architecture-overview)
3. [PULL API Reference](#pull-api-reference)
4. [PUSH API Reference](#push-api-reference)
5. [Field Reference Tables](#field-reference-tables)
6. [Critical Patterns & Gotchas](#critical-patterns--gotchas)
7. [Authentication](#authentication)
8. [Caching Strategy](#caching-strategy)
9. [Project-Specific Implementation](#project-specific-implementation)
10. [Real-World Implementations](#real-world-implementations)
11. [Quick Reference Cheat Sheet](#quick-reference-cheat-sheet)

---

# Executive Summary

## What is ManageOrders API?

ManageOrders is ShopWorks OnSite 7's REST API for order management. It has TWO distinct APIs:

| API | Purpose | Direction | Base URL |
|-----|---------|-----------|----------|
| **PULL API** | Read data from OnSite | OnSite → Your App | `https://manageordersapi.com/v1/manageorders/*` |
| **PUSH API** | Create orders in OnSite | Your App → OnSite | `https://manageordersapi.com/onsite/*` |

## How Our Three Projects Use ManageOrders

```
┌─────────────────────────────────────────────────────────────────────┐
│                     PRICING INDEX FILE 2025                         │
│                        (Frontend/Browser)                           │
│  - 3-Day Tees order submission                                      │
│  - Sample order submission                                          │
│  - Customer autocomplete in quote builders                          │
│  - Inventory display                                                │
└───────────────────────────┬─────────────────────────────────────────┘
                            │ HTTP calls
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     CASPIO-PRICING-PROXY                            │
│                    (Backend/Middleware)                             │
│  - Authenticates with ManageOrders                                  │
│  - Exposes 13 PULL API endpoints                                    │
│  - Handles PUSH API order creation                                  │
│  - Caching (1min - 24hr)                                            │
│  - Rate limiting (30/min)                                           │
└───────────────────────────┬─────────────────────────────────────────┘
                            │ Authenticated calls
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     MANAGEORDERS API                                │
│                   (ShopWorks OnSite 7)                              │
│  - PULL: Orders, Line Items, Payments, Tracking, Inventory          │
│  - PUSH: Create external orders                                     │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                      PYTHON INKSOFT                                 │
│                  (Separate Integration)                             │
│  - Transforms InkSoft orders → ExternalOrderJson                    │
│  - Uses ManageOrders PULL API for order verification                │
│  - Does NOT use caspio-pricing-proxy                                │
└─────────────────────────────────────────────────────────────────────┘
```

---

# Architecture Overview

## API Base URLs

| Environment | PULL API | PUSH API | Proxy |
|-------------|----------|----------|-------|
| Production | `https://manageordersapi.com/v1` | `https://manageordersapi.com/onsite` | `https://caspio-pricing-proxy-ab30a049961a.herokuapp.com` |

**Official Swagger Documentation:**
- PULL API: `https://app.swaggerhub.com/apis-docs/ShopWorks/ManageOrdersAPI/1.0.0`
- PUSH API: `https://app.swaggerhub.com/apis-docs/ShopWorks/OnSiteExternalAPI/1.0.0`

## Authentication Flow

```
1. POST /signin with credentials
   ↓
2. Receive { id_token, access_token, refresh_token, expires_in }
   ↓
3. Cache token (1 hour, with 60-second buffer)
   ↓
4. Use Authorization: Bearer {id_token} on all requests
```

## Environment Variables Required

```bash
MANAGEORDERS_USERNAME=your_username
MANAGEORDERS_PASSWORD=your_password
```

---

# PULL API Reference

## Overview

The PULL API retrieves data FROM ShopWorks OnSite. All endpoints require Bearer token authentication.

**Proxy Base URL:** `https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/manageorders`

---

## GET /orders

Retrieves orders for a date range.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `date_Ordered_start` | string | Yes | Start date (YYYY-MM-DD) |
| `date_Ordered_end` | string | Yes | End date (YYYY-MM-DD) |

**Response Fields:**
| Field | Type | Description |
|-------|------|-------------|
| `id_Order` | number | ShopWorks order ID |
| `id_Customer` | number | Customer ID |
| `id_OrderType` | number | Order type ID |
| `id_CustomerInternal` | number | Internal customer reference |
| `id_Design` | number | Primary design ID |
| `id_URL` | string | Order URL identifier |
| `date_Ordered` | string | Order date |
| `date_Invoiced` | string | Invoice date |
| `date_RequestedToShip` | string | Requested ship date |
| `date_Shippied` | string | Actual ship date (note: typo in API) |
| `date_Produced` | string | Production date |
| `CustomerName` | string | Company/customer name |
| `ContactFirstName` | string | Contact first name |
| `ContactLastName` | string | Contact last name |
| `ContactEmail` | string | Contact email |
| `ContactPhone` | string | Contact phone |
| `ContactFax` | string | Contact fax |
| `ContactTitle` | string | Contact title |
| `ContactDepartment` | string | Contact department |
| `CustomerServiceRep` | string | Assigned CSR name |
| `CustomerPurchaseOrder` | string | PO number |
| `DesignName` | string | Primary design name |
| `TotalProductQuantity` | number | Total items ordered |
| `cur_Balance` | number | Outstanding balance |
| `cur_SalesTaxTotal` | number | Sales tax amount |
| `cur_TotalInvoice` | number | Total invoice amount |
| `cur_Adjustment` | number | Adjustments |
| `cur_Payments` | number | Total payments received |
| `cur_Shipping` | number | Shipping charges |
| `cur_SubTotal` | number | Subtotal |
| `TermsDays` | number | Payment terms (days) |
| `TermsName` | string | Terms description |
| `sts_SizingType` | number | Sizing type status |
| `sts_Invoiced` | string | Invoice status |
| `sts_Paid` | string | Payment status |
| `sts_Produced` | string | Production status |
| `sts_Purchased` | string | Purchase status |
| `sts_Received` | string | Receiving status |
| `sts_ReceivedSub` | number | Sub-receiving status |
| `sts_PurchasedSub` | number | Sub-purchase status |
| `sts_Shipped` | number | Shipping status |
| `sts_ArtDone` | number | Art completion status |

**Cache:** 1 hour (date range queries)

---

## GET /getorderno/{ext_order_id}

Maps external order ID to ShopWorks order number.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `ext_order_id` | string | Yes | External order ID (e.g., "NWCA-3DT-12345") |

**Response:**
```json
{
  "result": [{
    "id_Order": 12345
  }]
}
```

**Cache:** 24 hours

---

### Per-Box Receiving Label field map (verified live 2026-06-24)

For the SanMar per-box receiving label (extends `/api/sanmar-orders/inbound-today`), the extra header fields map as follows. **All come from `/v1/orders` (`fetchOrderByNumber`) and are also in the SYNCED Caspio `ManageOrders_Orders` table** (keyed by `id_Order`), EXCEPT ship method which is not available at receiving stage.

| Label field | MO source field | Where to get it | Verified sample (WO 142254 Alexandria / 142241 HARTS) |
|---|---|---|---|
| Company name | `CustomerName` | Synced `ManageOrders_Orders` (or live `/v1/orders`) | "Alexandria" / "HARTS Services" |
| Due / in-hands date | `date_RequestedToShip` (ISO datetime) | Synced or live — **there is NO `date_Due` field** | 2026-07-06 / 2026-07-03 |
| Design number | `id_Design` (number, may be decimal e.g. 38464.01) | Synced or live | 30647 / 38464.01 |
| Design name (bonus) | `DesignName` | Synced or live | "Alexandria Light house one color LC" / "Harts New Logo - Jackets" |
| Contact name | `ContactFirstName` + `ContactLastName` | Synced or live | "Paul Macy" / "Julie Burr" |
| Ship method | **NOT AVAILABLE** | n/a — see note below | (none) |

**SHIP METHOD GOTCHA:** The `/v1/orders` response has NO ship-method field of any kind (verified by dumping all 41 keys for WO 142254 — only `date_RequestedToShip`, `date_Shippied` [typo, null until shipped], `sts_Shipped`, `cur_Shipping`). `ShipMethod` only lives in the PUSH-side `/order-pull` `ShippingAddresses[]` (returns `pushed:null` for orders entered directly in ShopWorks like these SanMar inbound WOs) and `ShippingMethod` in `/v1/tracking` (empty `[]` until the order ships — useless at receiving time). **Conclusion: ship method cannot be put on a receiving label from ManageOrders.** Options: omit it, or have OnSite/ShopWorks expose it via a separate field, or read it from the source order entry.

**RECOMMENDATION:** Gather these from the synced `ManageOrders_Orders` Caspio table (same pattern as `src/routes/box-labels-data.js` — fast, no live MO call). That route ALREADY returns `company`, `contact`, `salesRep`, `designName`, `designNumber`, `requestedShipDate` via `q.select` on `ManageOrders_Orders`. The inbound-today list already has `id_Order`; join to `ManageOrders_Orders` on `id_Order` to enrich. Live `/v1/orders` is the fallback if a brand-new WO hasn't synced yet (sync runs daily; FileMaker MO-UPDATE every 15 min 07:00-19:00 Pacific).

---

## GET /lineitems/{order_no}

Retrieves line items for a specific order.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `order_no` | string | Yes | ShopWorks order number |

**Response Fields:**
| Field | Type | Description |
|-------|------|-------------|
| `id_Order` | number | Order ID |
| `PartNumber` | string | Product SKU |
| `PartDescription` | string | Product description |
| `PartColor` | string | Color name |
| `Name` | string | Line item name |
| `LineQuantity` | number | Total quantity |
| `LineUnitPrice` | number | Unit price |
| `SortOrder` | number | Display order |
| `Size01` | string | Size column 1 qty |
| `Size02` | string | Size column 2 qty |
| `Size03` | string | Size column 3 qty |
| `Size04` | string | Size column 4 qty |
| `Size05` | string | Size column 5 qty |
| `Size06` | string | Size column 6 qty |
| `Custom01` | string | Custom field 1 |
| `Custom02` | string | Custom field 2 |
| `Custom03` | string | Custom field 3 |
| `Custom04` | string | Custom field 4 |
| `Custom05` | string | Custom field 5 |
| `InvoiceNotes` | string | Notes on invoice |

**Cache:** 24 hours

**CRITICAL:** Size01-Size06 columns map to different sizes depending on product. See [Size Column Mapping](#size-column-mapping).

---

## GET /payments

Query payments by date range.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `date_PaymentApplied_start` | string | Yes | Start date (YYYY-MM-DD) |
| `date_PaymentApplied_end` | string | Yes | End date (YYYY-MM-DD) |

**Response Fields:**
| Field | Type | Description |
|-------|------|-------------|
| `id_Order` | number | Order ID |
| `id_SubPayment` | number | Sub-payment ID |
| `FirstName` | string | Payer first name |
| `LastName` | string | Payer last name |
| `BillingCompnay` | string | Billing company (note: typo in API) |
| `BillingAddress` | string | Billing address |
| `BillingCity` | string | Billing city |
| `BillingState` | string | Billing state |
| `BillingZip` | string | Billing ZIP |
| `BillingCountry` | string | Billing country |
| `PaymentNumber` | string | Payment reference |
| `PaymentType` | string | Payment method |
| `Amount` | number | Payment amount |
| `date_PaymentApplied` | string | Application date |
| `sts_Approved` | number | Approval status |

**Cache:** 1 hour

---

## GET /payments/{order_no}

Get payments for a specific order.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `order_no` | string | Yes | ShopWorks order number |

**Response:** Same fields as `/payments` query.

**Cache:** 24 hours

---

## GET /tracking

Query tracking numbers by date range.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `date_Imported_start` | string | No | Import start date |
| `date_Imported_end` | string | No | Import end date |
| `date_Creation_start` | string | No | Creation start date |
| `date_Creation_end` | string | No | Creation end date |

**Response Fields:**
| Field | Type | Description |
|-------|------|-------------|
| `id_Order` | number | Order ID |
| `TrackingNumber` | string | Carrier tracking number |
| `AddressCompany` | string | Ship-to company |
| `Address1` | string | Ship-to address line 1 |
| `Address2` | string | Ship-to address line 2 |
| `AddressCity` | string | Ship-to city |
| `AddressState` | string | Ship-to state |
| `AddressZip` | string | Ship-to ZIP |
| `AddressCountry` | string | Ship-to country |
| `date_Creation` | string | Tracking created date |
| `date_Imported` | string | Tracking imported date |
| `Weight` | string | Package weight |
| `Cost` | string | Shipping cost |
| `Type` | string | Carrier/service type |

**Cache:** 15 minutes (tracking is time-sensitive)

---

## GET /tracking/{order_no}

Get tracking for a specific order.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `order_no` | string | Yes | ShopWorks order number |

**Response:** Same fields as `/tracking` query.

**Cache:** 15 minutes

---

## GET /inventorylevels

**CRITICAL ENDPOINT** - Real-time warehouse inventory.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `date_Modification_start` | string | No | Modification start date |
| `date_Modification_end` | string | No | Modification end date |
| `PartNumber` | string | No | Filter by part number |
| `Color` | string | No | Filter by color |
| `ColorRange` | string | No | Filter by color range |
| `GLAccount` | string | No | Filter by GL account |
| `SKU` | string | No | Filter by SKU |
| `PreprintGroup` | string | No | Filter by preprint group |
| `ProductType` | string | No | Filter by product type |
| `FindCode` | string | No | Filter by find code |
| `id_Vendor` | number | No | Filter by vendor ID |
| `VendorName` | string | No | Filter by vendor name |

**Response Fields:**
| Field | Type | Description |
|-------|------|-------------|
| `id_InventoryLevel` | number | Inventory record ID |
| `PartNumber` | string | Product SKU |
| `PartDescription` | string | Product description |
| `Color` | string | Color name |
| `ColorRange` | string | Color category |
| `Size01` | number | Qty in size column 1 |
| `Size02` | number | Qty in size column 2 |
| `Size03` | number | Qty in size column 3 |
| `Size04` | number | Qty in size column 4 |
| `Size05` | number | Qty in size column 5 |
| `Size06` | number | Qty in size column 6 |
| `UnitCost` | number | Cost per unit |
| `TotalCost` | number | Total inventory cost |
| `GLAccount` | string | GL account code |
| `SKU` | string | SKU identifier |
| `PreprintGroup` | string | Preprint group |
| `ProductType` | string | Product type |
| `FindCode` | string | Find code |
| `id_Vendor` | number | Vendor ID |
| `VendorName` | string | Vendor name |

**Cache:** 1 minute (real-time critical)

**Usage in Pricing Index:**
```javascript
const service = new ManageOrdersInventoryService();
const inventory = await service.checkInventory('PC54', 'Red');
// Returns: { available: true, totalStock: 150, sizeBreakdown: {...} }
```

---

# PUSH API Reference

## Overview

The PUSH API creates orders IN ShopWorks OnSite. It accepts an `ExternalOrderJson` structure.

**Base URL:** `https://manageordersapi.com/onsite`

**Endpoints:**
- `POST /signin` - Authenticate and get token
- `POST /order-push` - Create order (via proxy: `POST /api/manageorders/orders/create`)
- `GET /order-pull` - Download previously-pushed orders

---

## Official Swagger vs Reality

⚠️ **Important discrepancies between official Swagger and actual API behavior:**

| Topic | Swagger Says | Reality |
|-------|--------------|---------|
| **Tax flags** | Not documented | `sts_EnableTax01-04` are REQUIRED for tax calculation |
| **Date format** | YYYY-MM-DD | OnSite requires **MM/DD/YYYY** |
| **Required fields** | All optional | Many are required in practice (see tables below) |
| **Field spelling** | `CustomerServiceRep` | PUSH uses correct spelling; PULL sometimes returns `CustomerSeviceRep` (typo) |

**This documentation reflects actual tested behavior, not just official spec.**

---

## GET /order-pull

Download orders that were previously pushed via the API.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `date_from` | string | Yes | Upload date range start (YYYY-MM-DD) |
| `date_to` | string | Yes | Upload date range end (YYYY-MM-DD) |
| `time_from` | string | No | Time range start (HH-MM-SS — note the DASHES, not colons) |
| `time_to` | string | No | Time range end (HH-MM-SS) |
| `api_source` | string | No | Filter: `"all"`, `"none"`, or specific source name (e.g. `"OrderForm"`) |

**Response:** `{ result: [order1, order2, ...] }`

**⚠ RESPONSE SHAPE WARNING (verified 2026-05-20):** The official Swagger spec shows `result: [{ order_json: {} }]` (objects wrapped in `order_json` key). The ACTUAL API returns the order fields directly at the top level of each result entry: `result: [{ ExtOrderID, ExtSource, ContactNameFirst, date_OrderPlaced, ... }]`. The proxy's `verifyOrder()` function in `lib/manageorders-push-client.js` reads `order.order_json.ExtOrderID` which always returns undefined — bug to fix.

**Verified retention (2026-05-20):** Pulled 469-day-old orders (placed 02/05/2025) successfully. Retention is **at least 15.6 months and likely 2 years** per ManageOrders's documented API guide — NOT the 60 days previously claimed. See `caspio-pricing-proxy/scripts/test-mo-retention.js` for the probe script. The 60-day claim originated from an early misreading + has lived in our docs since 2025; corrected here.

**Use Case:** Verify orders were received, retrieve order data for reconciliation, historical lookups for the YTD/archive system.

---

## POST /onsite/track-push

Send tracking information TO ManageOrders. Use this to push shipping/tracking data for orders you've previously created.

**Request:**
```
POST https://manageordersapi.com/onsite/track-push
Authorization: Bearer {id_token}
Content-Type: application/json
```

**Request Body:** `TrackingJsonArray` (array of tracking objects)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `ExtOrderID` | string | **YES** | External order ID (must match existing order) |
| `ExtShipID` | string | No | External shipping ID (for split shipments) |
| `TrackingNumber` | string | **YES** | Carrier tracking number |
| `ShippingMethod` | string | No | Carrier service (e.g., "UPS Ground") |
| `Cost` | number | No | Shipping cost |
| `Weight` | number | No | Package weight |
| `CustomField01` | string | No | Custom tracking field 1 |
| `CustomField02` | string | No | Custom tracking field 2 |
| `CustomField03` | string | No | Custom tracking field 3 |
| `CustomField04` | string | No | Custom tracking field 4 |
| `CustomField05` | string | No | Custom tracking field 5 |

**Example:**
```json
[{
    "ExtOrderID": "NWCA-3DT-010125-12345",
    "TrackingNumber": "1Z999AA10123456784",
    "ShippingMethod": "UPS Ground",
    "Cost": 12.95,
    "Weight": 2.5
}]
```

**Official API Guide (v05.22.24) also documents an address-based tracking structure:**

| Field | Type | Description |
|-------|------|-------------|
| `APISource` | string | Filters tracking records in PULL API |
| `ExtOrderID` | string | External order ID (must match existing order) |
| `Name` | string | Shipping contact name |
| `Address01` | string | Street address line 1 |
| `Address02` | string | Street address line 2 |
| `City` | string | City |
| `State` | string | State/province |
| `Zip` | string | Postal code |
| `Country` | string | Country |
| `Tracking` | string | Tracking number |
| `Weight` | string | Package weight |
| `Date_Shipped` | string | Ship date (**MM/DD/YYYY** format) |

**Note:** The Swagger spec and the official PDF show slightly different field sets. The Swagger version (above) uses `TrackingNumber`/`ShippingMethod`/`Cost`/`CustomField01-05`. The PDF version uses `Tracking`/`Name`/`Address`/`Date_Shipped`. Both are valid — use whichever matches your OnSite version (v12 required for tracking push).

**Use Case:** Push tracking numbers to OnSite after shipping orders.

---

## GET /onsite/track-pull

Retrieve tracking information by upload date/time range.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `date_from` | string | Yes | Start date (YYYY-MM-DD) |
| `date_to` | string | Yes | End date (YYYY-MM-DD) |
| `time_from` | string | No | Start time (HH-MM-SS) |
| `time_to` | string | No | End time (HH-MM-SS) |
| `api_source` | string | No | Filter: `"all"`, `"none"`, or specific source name |

**Response:** Array of tracking records matching criteria.

**Use Case:** Reconcile tracking data, verify shipments were recorded.

---

## ExternalOrderJson Structure

### Root Fields (Order Level)

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| `APISource` | string | No | Filters orders in PULL API. Set in OnSite API Integration Settings | `"NWCA"` |
| `ExtOrderID` | string | **YES** | External order identifier | `"NWCA-3DT-010125-12345"` |
| `ExtSource` | string | **YES** | Source system identifier | `"NWCA"`, `"InkSoft"` |
| `ExtCustomerID` | string | No | External customer ID | `"0"` (webstore) or user ID |
| `ExtCustomerPref` | string | No | Customer preference | `""` |
| `id_Customer` | number | **YES** | ShopWorks customer ID | `2791` (webstore default) |
| `id_OrderType` | number | **YES** | Order type ID | `6` (web), `31` (sales) |
| `id_CompanyLocation` | number | **YES** | Company location ID | `2` |
| `id_EmpCreatedBy` | number | **YES** | Creating employee ID | `222` (API user) |
| `id_SalesStatus` | number | No | Sales status ID | |
| `id_ReceivingStatus` | number | No | Receiving status ID | |
| `id_ShippingStatus` | number | No | Shipping status ID | |
| `date_OrderPlaced` | string | **YES** | Order date | `"01/15/2025"` (MM/DD/YYYY) |
| `date_OrderRequestedToShip` | string | **YES** | Requested ship date | `"01/20/2025"` |
| `date_OrderDropDead` | string | No | Drop-dead date | |
| `ContactEmail` | string | **YES** | Contact email | |
| `ContactNameFirst` | string | **YES** | Contact first name | |
| `ContactNameLast` | string | **YES** | Contact last name | |
| `ContactPhone` | string | No | Contact phone | |
| `CustomerPurchaseOrder` | string | No | PO number | |
| `CustomerServiceRep` | string | No | CSR name (correct spelling for PUSH) | |
| `OnHold` | number | No | Hold status | `0` (no hold) |
| `Terms` | string | No | Payment terms | `"Prepaid"`, `"Net 10"` |
| `DiscountPartNumber` | string | No | Discount line part number | |
| `DiscountPartDescription` | string | No | Discount description | |
| `cur_Shipping` | number | No | Shipping amount | `12.95` |
| `TaxTotal` | number | No | Tax amount | `0` (let OnSite calculate) |
| `TotalDiscounts` | number | No | Total discounts | |
| `TaxPartNumber` | string | No | Tax line item part number | `"TAX"` |
| `TaxPartDescription` | string | No | Tax line item description | `"Sales Tax"` |

---

### Customer Object

Nested customer information. Only used when creating NEW customers.

| Field | Type | Description |
|-------|------|-------------|
| `CompanyName` | string | Company name |
| `CustomerSource` | string | Lead source |
| `CustomerType` | string | Customer classification |
| `InvoiceNotes` | string | Default invoice notes |
| `MainEmail` | string | Primary email |
| `SalesGroup` | string | Sales group assignment |
| `TaxExempt` | string | Tax exempt status (`"0"` or `"1"`) |
| `TaxExemptNumber` | string | Tax exempt certificate |
| `WebSite` | string | Website URL |
| `BillingCompany` | string | Billing company name |
| `BillingAddress01` | string | Billing address line 1 |
| `BillingAddress02` | string | Billing address line 2 |
| `BillingCity` | string | Billing city |
| `BillingState` | string | Billing state |
| `BillingZip` | string | Billing ZIP |
| `BillingCountry` | string | Billing country |
| `CustomField01-06` | string | Custom text fields |
| `CustomDateField01-04` | string | Custom date fields |
| `CustomerReminderInvoiceNotes` | string | Reminder notes |

---

### LinesOE Array (Line Items)

**CRITICAL:** Each product/size combination = one line item.

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| `PartNumber` | string | **YES** | Product SKU with size modifier | `"PC54"`, `"PC54_2X"` |
| `Color` | string | No | **CATALOG_COLOR** (mainframe code), NOT COLOR_NAME — see ⚠️ rule below | `"Bk/Bk/LtGy"`, `"BrillOrng"` |
| `Description` | string | No | Product description | |
| `Size` | string | No | Size (OnSite translates) | `"XL"`, `"2XL"` |
| `Qty` | string | **YES** | Quantity | `"5"` |
| `Price` | string | **YES** | Unit price | `"12.50"` |
| `id_ProductClass` | number | No | Product class ID | `1` (standard), `16` (gift cert) |
| `NameFirst` | string | No | Personalization first name | |
| `NameLast` | string | No | Personalization last name | |
| `LineItemNotes` | string | No | Line-specific notes | |
| `WorkOrderNotes` | string | No | Work order notes | |
| `ExtDesignIDBlock` | string | No | External design ID | |
| `DesignIDBlock` | string | No | OnSite design ID | |
| `ExtShipID` | string | No | External shipping ID | `"SHIP-1"` |
| `DisplayAsPartNumber` | string | No | Override display PN | |
| `DisplayAsDescription` | string | No | Override display desc | |
| `CustomField01-05` | string | No | Custom fields | |

**TAX FLAGS (CRITICAL):**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `sts_EnableTax01` | number | **YES** | Tax flag 1 | Must be `1` |
| `sts_EnableTax02` | number | **YES** | Tax flag 2 | Must be `1` |
| `sts_EnableTax03` | number | **YES** | Tax flag 3 | Must be `1` |
| `sts_EnableTax04` | number | **YES** | Tax flag 4 | Must be `1` |

---

### ⚠️ `Color` Field MUST Be CATALOG_COLOR (mainframe code), NOT COLOR_NAME

**Rule:** Send the abbreviated mainframe code (`"Bk/Bk/LtGy"`, `"BrillOrng"`) — same as Caspio's `CATALOG_COLOR` column. **Never send the friendly display name** (`"Black/ Black/ Light Grey"`, `"Brilliant Orange"`).

**Why:**
- ShopWorks must forward the `Color` value verbatim on the SanMar PO. If the value isn't a SanMar mainframe code, ShopWorks tries to translate via its own internal product table — and any translation miss produces a bad SanMar PO that gets rejected.
- **SanMar's PromoStandards `getProduct.colorName` IS the abbreviated mainframe code** — it's not a "friendly" alias. Verified for style 112 (2026-05-02): all 112 Caspio `CATALOG_COLOR` values match SanMar's `colorName` 1:1 (`Bk/Bk/LtGy`, `HotPink/Wh`, `Biscuit/TB`, `Wht/Wht/Rd`, …). So Caspio's `CATALOG_COLOR` IS the SanMar key.

**Implementation (single chokepoint):**
The proxy's `transformLineItems()` in [`caspio-pricing-proxy/lib/manageorders-push-client.js:279`](../../caspio-pricing-proxy/lib/manageorders-push-client.js) is the only place the outbound `Color` field is built:
```js
Color: item.catalogColor || item.color || '',   // prefer mainframe code; fall back for legacy callers
```
- Order form sends both `color` (display, for QuoteItems audit) and `catalogColor` (mainframe code, for ShopWorks).
- Legacy callers (3-Day Tees push, embroidery push) that don't send `catalogColor` keep working through the `|| item.color` fallback.

**Other places this rule applies:**
- SanMar inventory query (`/api/sanmar/inventory/:style?color=…`) — pass CATALOG_COLOR
- SanMar sellable check — pass CATALOG_COLOR
- ManageOrders `/inventorylevels?Color=…` — pass CATALOG_COLOR
- **Reserve `COLOR_NAME` strictly for UI display** (customer quotes, line-item display, dropdown labels)

**How to audit a style:**
```bash
curl 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/sanmar/product-colors/<STYLE>' | jq '.activeColors'
```
Compare the returned `colorName` values against Caspio's `CATALOG_COLOR` rows. Mismatches = drift candidates worth investigating.

**History:**
- 2026-05-02 — proxy v606. Switched outbound `Color` from `item.color` to `item.catalogColor || item.color`. Root cause of intermittent SanMar rejections on Richardson 112 caps. See [LESSONS_LEARNED.md](LESSONS_LEARNED.md) "ShopWorks PO `Color` Field Must Be CATALOG_COLOR".

---

### Designs Array

Artwork/design information.

| Field | Type | Description |
|-------|------|-------------|
| `DesignName` | string | Design name |
| `ExtDesignID` | string | External design ID |
| `id_Design` | number | OnSite design ID — **OMIT entirely when unknown; do NOT send `0`** (see ⚠️ rule below) |
| `id_DesignType` | number | Design type (3=standard, 45=DTG) |
| `id_Artist` | number | Artist assignment ID |
| `ForProductColor` | string | Applicable colors — **use CATALOG_COLOR codes**, comma-separated; should list ALL colors the design covers (see ⚠️ rule below) |
| `VendorDesignID` | string | Vendor's design ID |
| `CustomField01-05` | string | Custom fields |
| `Locations` | array | Print location details |

#### ⚠️ `id_Design` MUST be omitted (not 0) when unknown

Sending `id_Design: 0` makes ShopWorks attach line items to a **sentinel orphan-design row** instead of creating a fresh design from `DesignName + ExtDesignID`. The proxy's `transformDesigns()` ([`caspio-pricing-proxy/lib/manageorders-push-client.js:372`](../../caspio-pricing-proxy/lib/manageorders-push-client.js)) uses a conditional spread to enforce this:
```js
const resolvedDesignId = design.idDesign || design.id_Design;
const transformedDesign = {
  DesignName: ...,
  ExtDesignID: ...,
  ...(resolvedDesignId ? { id_Design: resolvedDesignId } : {}),  // omit when 0/null/undefined
  ...
};
```

**Caller contract** (Pricing Index `server.js`): set `base.idDesign = N` (singular) on each design entry when a real ShopWorks design ID is resolved via `/api/embroidery-designs/lookup`. The proxy reads `idDesign` / `id_Design` (singular) — `linkedDesigns` (array) is currently a no-op, kept only for future multi-design# support. Fixed in proxy v607 + Pricing Index 2026-05-02.

#### ⚠️ `ForProductColor` MUST use CATALOG_COLOR codes (not COLOR_NAME) AND list ALL colors

Same rule as `LinesOE.Color` — abbreviated mainframe codes (`Bk/Bk/LtGy`, `HotPink/Wh`), not friendly display names. Caller side: `[...new Set(rows.map(r => r.catalogColor || r.colorName || r.color).filter(Boolean))].join(', ')`. **Don't filter rows by `deco === method`** — that drops rows where `deco` defaulted to embroidery without being explicitly stamped, which made OF-0025's design list only 3 of 11 colors. Filter as `r => !r.deco || r.deco === method` instead.

**Locations Array (nested in Designs):**
| Field | Type | Description |
|-------|------|-------------|
| `Location` | string | Print location (`"Left Chest"`, `"Full Back"`) |
| `TotalColors` | string | Number of colors |
| `TotalFlashes` | string | Flash count (screen print) |
| `TotalStitches` | string | Stitch count (embroidery) |
| `DesignCode` | string | Design code |
| `ImageURL` | string | Artwork image URL |
| `Notes` | string | Location notes |
| `CustomField01-05` | string | Custom fields |
| `LocationDetails` | array | Color/thread details |

**LocationDetails Array (nested in Locations):**
| Field | Type | Description |
|-------|------|-------------|
| `Color` | string | Ink/thread color |
| `ThreadBreak` | string | Thread break setting |
| `ParameterLabel` | string | Parameter name |
| `ParameterValue` | string | Parameter value |
| `Text` | string | Text content |
| `CustomField01-05` | string | Custom fields |

---

### Notes Array

Order notes with type classification.

| Field | Type | Description |
|-------|------|-------------|
| `Type` | string | Note type (see below) |
| `Note` | string | Note content |

**Valid Note Types:**
1. `"Notes On Order"` - General order notes (accounting sees these)
2. `"Notes To Art"` - Art department notes
3. `"Notes To Purchasing"` - Purchasing department
4. `"Notes To Subcontract"` - Subcontractor notes
5. `"Notes To Production"` - Production floor notes
6. `"Notes To Receiving"` - Receiving department
7. `"Notes To Shipping"` - Shipping department
8. `"Notes To Accounting"` - Accounting notes
9. `"Notes On Customer"` - Customer record notes (new customers only)

---

### Payments Array

Payment records.

| Field | Type | Description |
|-------|------|-------------|
| `date_Payment` | string | Payment date (MM/DD/YYYY) |
| `AccountNumber` | string | Last 4 digits or account |
| `Amount` | number | Payment amount |
| `AuthCode` | string | Authorization code |
| `CreditCardCompany` | string | Card type (`"Visa"`, `"Stripe Checkout"`) |
| `Gateway` | string | Payment gateway |
| `ResponseCode` | string | Gateway response code |
| `ResponseReasonCode` | string | Detailed response code |
| `ResponseReasonText` | string | Response description |
| `Status` | string | Status (`"success"`, `"pending"`) |
| `FeeOther` | number | Other fees |
| `FeeProcessing` | number | Processing fees |

---

### ShippingAddresses Array

Shipping destinations (supports multiple).

| Field | Type | Description |
|-------|------|-------------|
| `ShipCompany` | string | Ship-to company |
| `ShipMethod` | string | Shipping method (`"UPS Ground"`) |
| `ShipAddress01` | string | Address line 1 |
| `ShipAddress02` | string | Address line 2 |
| `ShipCity` | string | City |
| `ShipState` | string | State |
| `ShipZip` | string | ZIP code |
| `ShipCountry` | string | Country |
| `ExtShipID` | string | External ship ID (for split orders) |

---

### Attachments Array

File attachments.

| Field | Type | Description |
|-------|------|-------------|
| `MediaURL` | string | File URL |
| `MediaName` | string | Display name |
| `LinkURL` | string | External link (if not hosted) |
| `LinkNote` | string | Link description |
| `Link` | number | `0` = hosted file, `1` = external URL |

---

# Field Reference Tables

## Required vs Optional Fields

### REQUIRED (Order will fail without these)

| Field | Location | Why Required |
|-------|----------|--------------|
| `ExtOrderID` | Root | Links to external system |
| `ExtSource` | Root | Identifies source |
| `id_Customer` | Root | Routes to customer account |
| `id_OrderType` | Root | Determines order workflow |
| `date_OrderPlaced` | Root | Order timestamp |
| `date_OrderRequestedToShip` | Root | Production scheduling |
| `ContactNameFirst` | Root | Customer identification |
| `ContactNameLast` | Root | Customer identification |
| `PartNumber` | LinesOE | Product identification |
| `Qty` | LinesOE | Order quantity |
| `Price` | LinesOE | Pricing |
| `sts_EnableTax01-04` | LinesOE | **Tax calculation** |

### OPTIONAL (Can be empty or omitted)

| Field | Default When Missing |
|-------|---------------------|
| `ContactPhone` | Empty |
| `ContactEmail` | Empty |
| `ShippingAddresses` | Empty array (pickup order) |
| `Designs` | No designs attached |
| `Attachments` | No attachments |
| `Notes` | No notes |
| `Payments` | No payment record |
| `CustomerPurchaseOrder` | Blank |

---

## Hardcoded Values

Values that should ALWAYS be set to specific values:

| Field | Value | Reason |
|-------|-------|--------|
| `id_CompanyLocation` | `2` | Always main location |
| `id_EmpCreatedBy` | `222` | API user ID |
| `OnHold` | `0` | Don't auto-hold orders |
| `sts_EnableTax01` | `1` | **ShopWorks bug fix** |
| `sts_EnableTax02` | `1` | **ShopWorks bug fix** |
| `sts_EnableTax03` | `1` | **ShopWorks bug fix** |
| `sts_EnableTax04` | `1` | **ShopWorks bug fix** |
| `TaxTotal` | `0` | Let OnSite calculate |

---

## Size Column Mapping

OnSite has 6 size columns (Size01-Size06). The mapping depends on product type.

### Single-SKU Products (Most products)

| Column | Typical Size |
|--------|--------------|
| Size01 | S or XS |
| Size02 | M |
| Size03 | L |
| Size04 | XL |
| Size05 | 2XL |
| Size06 | 3XL+ |

### Multi-SKU Products (PC54 Example)

**CRITICAL:** Multi-SKU products have DIFFERENT mappings per SKU!

| SKU | Size01 | Size02 | Size03 | Size04 | Size05 | Size06 |
|-----|--------|--------|--------|--------|--------|--------|
| PC54 | S | M | L | XL | - | - |
| PC54_2X | - | - | - | - | **2XL** | - |
| PC54_3XL | - | - | - | - | - | **3XL** |

**PC54_2X uses Size05 for 2XL, NOT Size06!** Each extended-size SKU only has ONE active size column.

---

## Size Modifier Reference

When creating line items, append the correct modifier to the base PartNumber:

| Size | Modifier | Example | Notes |
|------|----------|---------|-------|
| S, M, L, XL | (none) | `PC54` | Base SKU, Size01-04 |
| 2XL | `_2X` | `PC54_2X` | **Short form** (2,123 products) |
| XXL | `_XXL` | `L500_XXL` | Ladies/Womens ONLY (589 products, DISTINCT from 2XL) |
| 3XL | `_3XL` | `PC54_3XL` | **Full form** (2,446 products) |
| 4XL | `_4XL` | `PC54_4XL` | **Full form** |
| 5XL | `_5XL` | `S608ES_5XL` | Full form |
| 6XL | `_6XL` | `S608ES_6XL` | Full form |
| 7XL | `_7XL` | `S608ES_7XL` | Full form |
| XS | `_XS` | `BC3001_XS` | |
| OSFA | `_OSFA` | `C112_OSFA` | Caps, bags, towels |
| LT, XLT, 2XLT, 3XLT, 4XLT | `_LT`, `_XLT`, `_2XLT`, `_3XLT`, `_4XLT` | Tall sizes | |
| YS, YM, YL, YXL | `_YS`, `_YM`, `_YL`, `_YXL` | Youth sizes | |
| S/M, M/L, L/XL | `_S/M`, `_M/L`, `_L/XL` | Flexfit caps | Slashes, not concatenated |
| 4/5X | `_4/5X` | Safety vests | CornerStone only (8 products) |

**CRITICAL SIZE RULES (verified Feb 2026 from 15,152-row ShopWorks CSV):**
- **Only 2XL uses short form:** `_2X` (NOT `_2XL` — zero products use `_2XL`)
- **All others use full form:** `_3XL`, `_4XL`, `_5XL`, `_6XL`, `_7XL`
- **XXL ≠ 2XL:** XXL is ladies/womens (`_XXL`), 2XL is men's/unisex (`_2X`). Zero overlap. Both use Size05.
- **Size values in PUSH API** must match entries in the OnSite ManageOrders API Integration size translation table.

---

# Critical Patterns & Gotchas

## 1. id_Integration is MANDATORY

**Problem:** All sizes show as Adult/S in OnSite
**Cause:** Missing `id_Integration` in store config
**Solution:** Every store MUST have a valid integration ID from ShopWorks

Get it from: **Tools > Configuration > Order API Integrations**

```python
# Python Inksoft store config
{
    "StoreName": "Arrow Lumber",
    "id_Customer": 1821,
    "id_Integration": 131,  # CRITICAL - without this, sizes fail!
}
```

---

## 2. Tax Flags Must ALL Be 1

**Problem:** Tax doesn't calculate on imported orders
**Cause:** ShopWorks API has a bug - doesn't set tax flags
**Solution:** ALWAYS set all 4 tax flags to 1 on every line item

```javascript
// EVERY line item needs this
{
    "PartNumber": "PC54",
    "Qty": "5",
    "Price": "12.50",
    "sts_EnableTax01": 1,  // REQUIRED
    "sts_EnableTax02": 1,  // REQUIRED
    "sts_EnableTax03": 1,  // REQUIRED
    "sts_EnableTax04": 1   // REQUIRED
}
```

---

## 3. Date Format Must Be MM/DD/YYYY

**Problem:** Dates not parsing correctly
**Cause:** OnSite expects MM/DD/YYYY, not YYYY-MM-DD
**Solution:** Always convert dates

```javascript
// Convert ISO to OnSite format
function formatDateForOnSite(isoDate) {
    const [year, month, day] = isoDate.split('T')[0].split('-');
    return `${month}/${day}/${year}`;
}
// "2025-01-15" → "01/15/2025"
```

---

## 4. Gift Certificates Are Line Items, Not Payments

**Problem:** Gift certs disappearing or consolidating
**Cause:** Adding to Payments array
**Solution:** Add as LinesOE with unique PartNumbers

```javascript
// Gift certificate as line item
{
    "PartNumber": "Gift Code 1",  // Unique per cert!
    "Description": "$50.00 - GIFTCODE123",
    "Price": "0",
    "Qty": "1",
    "id_ProductClass": 16,  // Special class
    "sts_EnableTax01": 0,   // No tax on gift certs
    "sts_EnableTax02": 0,
    "sts_EnableTax03": 0,
    "sts_EnableTax04": 0
}
```

---

## 5. Customer #2791 Pattern (Webstore Orders)

**Problem:** Need to track actual customer but route to webstore account
**Solution:** Use id_Customer 2791, put real info in Contact fields

```javascript
{
    "id_Customer": 2791,  // All webstore orders
    "ContactNameFirst": "John",      // Actual customer
    "ContactNameLast": "Smith",      // Actual customer
    "ContactEmail": "john@email.com" // Actual customer
}
```

---

## 6. COLOR_NAME vs CATALOG_COLOR

**Problem:** Inventory lookup returns "Unable to Verify"
**Cause:** Using display color name instead of API color code
**Solution:** Use CATALOG_COLOR for API calls

| Field | Use For | Example |
|-------|---------|---------|
| `COLOR_NAME` | Display to users | "Brilliant Orange" |
| `CATALOG_COLOR` | API queries | "BrillOrng" |

```javascript
// WRONG
inventoryAPI.check({ color: product.COLOR_NAME });

// CORRECT
inventoryAPI.check({ color: product.CATALOG_COLOR });
```

---

## 7. 3-Day Tees Code Path

**Problem:** Changes to order service not taking effect
**Cause:** Order submission is in server.js, not a service class
**Solution:** Edit server.js directly

**Correct code path:**
```
Frontend: pages/3-day-tees-success.html (line 884-937)
    ↓
Backend: server.js (line 749-1050) ← EDIT HERE
    ↓
Proxy: caspio-pricing-proxy/lib/manageorders-push-client.js
```

**The ThreeDayTeesOrderService class was DELETED in Nov 2024.**

---

## 8. Silent API Failures

**Problem:** Wrong data displayed without error
**Cause:** Using fallback/cached data when API fails
**Solution:** ALWAYS throw errors, never silently fallback

```javascript
// WRONG - Silent failure
try {
    const data = await fetchAPI();
} catch (error) {
    return cachedData; // User sees wrong data!
}

// CORRECT - Visible failure
try {
    const data = await fetchAPI();
} catch (error) {
    showErrorBanner('Unable to load data. Please refresh.');
    throw error;
}
```

---

## 9. Token Expiry Buffer

**Problem:** Random auth failures mid-request
**Cause:** Token expiring during request
**Solution:** Check with 60-second buffer

```javascript
function isTokenValid() {
    const bufferMs = 60 * 1000; // 60 seconds
    return tokenExpiry && Date.now() < (tokenExpiry - bufferMs);
}
```

---

## 10. Business Day Ship Dates

**Problem:** Orders landing on weekends/holidays
**Cause:** No business day adjustment
**Solution:** Python Inksoft auto-adjusts (transform.py:220-301)

Holidays skipped:
- New Year's Day, MLK Day, Presidents Day
- Memorial Day, Independence Day, Labor Day
- Thanksgiving + day after
- Christmas Eve, Christmas, Dec 26
- New Year's Eve, Jan 2

---

## 11. Data Sync Timing (Hourly Updates)

**Problem:** Recent orders not appearing in PULL API
**Cause:** OnSite updates ManageOrders data **hourly**, not real-time
**Solution:** Wait up to 1 hour for data to appear in PULL API

**Important:**
- Data in PULL API may be up to 1 hour old
- Recently created orders may not appear immediately
- Use PUSH API `/order-pull` for immediate verification of pushed orders

---

## 12. Payment Status Rules

**Problem:** Payments not appearing in OnSite
**Cause:** Only `"success"` status payments create actual records

```javascript
// Payment status behavior:
"success"  → Creates payment record in OnSite
"pending"  → Does NOT create payment record
"failed"   → Does NOT create payment record
"error"    → Does NOT create payment record
```

**Solution:** Always set `Status: "success"` for completed payments.

---

## 13. Image Attachment Limits

**Problem:** Attachments failing silently
**Cause:** Image exceeds size limits

**Limits:**
- **Maximum size:** 2MB per image
- **Recommended formats:** .jpg, .png
- Images exceeding 2MB will fail silently or be rejected

**Solution:** Compress images before attaching. Convert to .jpg for photos.

---

## 14. Customer Matching Priority (ExtCustomerID)

**Problem:** Order linking to wrong customer
**Cause:** Confusion about which ID takes precedence

**Priority Order:**
1. `ExtCustomerID` is checked **first** (if provided)
2. System searches for matching ExtCustomerID
3. If found → links to that customer
4. If not found → falls back to `id_Customer`
5. If neither found → creates new customer (if Customer object provided)

```javascript
// ExtCustomerID takes precedence
{
    "id_Customer": 2791,        // Fallback
    "ExtCustomerID": "STORE-123" // Checked FIRST
}
```

---

## 15. Design Assignment Rules (DesignIDBlock)

**Problem:** Line items not appearing on Production Spec
**Cause:** Incorrect DesignIDBlock/ExtDesignIDBlock usage

| Scenario | Behavior |
|----------|----------|
| Field **NOT present** | Line item assigned to ALL designs |
| Field present but **empty** | Line item NOT assigned, "Apply Designs" turned OFF |
| Field present **with value** | Assigned to matching design only |

```javascript
// Assigned to ALL designs (omit field)
{ "PartNumber": "PC54", "Qty": "5" }

// NOT assigned to any design
{ "PartNumber": "PC54", "Qty": "5", "DesignIDBlock": "" }

// Assigned to specific design
{ "PartNumber": "PC54", "Qty": "5", "ExtDesignIDBlock": "DESIGN-001" }
```

---

## 16. Shipping Spec Rules (ExtShipID)

**Problem:** Line items not assigned to shipping addresses
**Cause:** Incorrect ExtShipID usage

| Scenario | Behavior |
|----------|----------|
| ExtShipID **NOT included** | Line item not assigned to any address |
| ExtShipID **empty** | Shipping turned OFF for this line |
| ExtShipID **with value** | Creates shipping spec, assigns to matching address |

```javascript
// ShippingAddresses array
"ShippingAddresses": [{
    "ExtShipID": "SHIP-1",
    "ShipAddress01": "123 Main St",
    ...
}]

// Line item assigned to SHIP-1
"LinesOE": [{
    "PartNumber": "PC54",
    "ExtShipID": "SHIP-1"  // Links to shipping address above
}]
```

---

# Authentication

## Token Request

```javascript
// PULL API
POST https://manageordersapi.com/v1/manageorders/signin
Content-Type: application/json

{
    "username": process.env.MANAGEORDERS_USERNAME,
    "password": process.env.MANAGEORDERS_PASSWORD
}

// PUSH API
POST https://manageordersapi.com/onsite/signin
Content-Type: application/json

{
    "username": process.env.MANAGEORDERS_USERNAME,
    "password": process.env.MANAGEORDERS_PASSWORD
}
```

## Token Response

```json
{
    "id_token": "eyJ...",
    "access_token": "eyJ...",
    "refresh_token": "...",
    "expires_in": 3600
}
```

## Using the Token

```javascript
GET /manageorders/orders
Authorization: Bearer {id_token}
```

## Token Caching

- Cache duration: 1 hour
- Check with 60-second buffer before expiry
- Auto-refresh when expired

---

# Caching Strategy

| Data Type | Cache TTL | Reason |
|-----------|-----------|--------|
| **Inventory** | 1 minute | Real-time stock critical |
| **Tracking** | 15 minutes | Shipments update frequently |
| **Orders (date range)** | 1 hour | Intraday accuracy |
| **Orders (by ID)** | 24 hours | Historical, rarely changes |
| **Line Items** | 24 hours | Historical |
| **Payments (date range)** | 1 hour | Intraday accuracy |
| **Payments (by ID)** | 24 hours | Historical |
| **Customers** | 24 hours | Changes infrequently |
| **Auth Token** | 1 hour | Per token expiry |

**Cache Bypass:** Add `?refresh=true` to any endpoint to bypass cache.

---

# Project-Specific Implementation

## Pricing Index File 2025

**Files:**
- `/shared_components/js/manageorders-inventory-service.js` - Inventory checks
- `/shared_components/js/manageorders-customer-service.js` - Customer autocomplete
- `/shared_components/js/sample-order-service.js` - Sample order submission
- `/server.js` (lines 1046-1337) - 3-Day Tees order submission

**Usage:**
```javascript
// Inventory check
const inventoryService = new ManageOrdersInventoryService();
const stock = await inventoryService.checkInventory('PC54', 'Red');

// Customer autocomplete (60-day lookback)
const customerService = new ManageOrdersCustomerService();
const customers = await customerService.getCustomers();
```

### Future: Embroidery Quote Builder → ShopWorks PUSH

**Status:** Planned (as of 2026-02-22). Will add "Push to ShopWorks" button on saved embroidery quotes.

**Critical requirements (from 3-Day Tees experience):**
- `sts_EnableTax01-04: 1` on EVERY line item (including fee items like DD, AS-Garm, etc.)
- `id_Integration` for correct size mapping (use OnSite integration ID)
- Size values must match OnSite translation table exactly
- Use `CATALOG_COLOR` (not `COLOR_NAME`) for inventory matching
- `ExtOrderID` with unique prefix: `NWCA-EMB-{quoteId}` (e.g., `NWCA-EMB-EMB-0222-001`)
- Date format: `MM/DD/YYYY` (not ISO)
- Design array with `StitchesTotal`, location info from embroidery config
- Shipping address from quote Ship To fields (already parsed/saved)
- Set `TaxTotal: 0` to let OnSite calculate tax (we store rate for display only)
- Transform `quote_sessions` + `quote_items` → ManageOrders `ExternalOrderJson` format
- Reuse existing auth from `manageorders-push-auth.js` in caspio-proxy
- Backend route: `POST /api/manageorders/push-embroidery` in caspio-proxy

---

## caspio-pricing-proxy

**Files:**
- `/src/routes/manageorders.js` - PULL API endpoints (13 routes)
- `/lib/manageorders-push-client.js` - PUSH API client (674 lines)
- `/lib/manageorders-push-auth.js` - Authentication (143 lines)
- `/config/manageorders-push-config.js` - Configuration & mappings

**Exposed Endpoints:**
```
GET  /api/manageorders/customers
GET  /api/manageorders/orders
GET  /api/manageorders/orders/:order_no
GET  /api/manageorders/getorderno/:ext_order_id
GET  /api/manageorders/lineitems/:order_no
GET  /api/manageorders/payments
GET  /api/manageorders/payments/:order_no
GET  /api/manageorders/tracking
GET  /api/manageorders/tracking/:order_no
GET  /api/manageorders/inventorylevels
POST /api/manageorders/orders/create
GET  /api/manageorders/orders/verify/:extOrderId
POST /api/manageorders/auth/test
GET  /api/manageorders/push/health
```

---

## Python Inksoft

**Files:**
- `/web/transform.py` - Main transformation (1160 lines)
- `/web/app.py` - Flask API routes (1218 lines)
- `/web/stores.py` - Store configurations
- `/json_transform_gui.py` - Desktop GUI

**Key Functions:**
```python
# Transform InkSoft order to OnSite JSON
onsite_json = transform_inksoft_to_onsite(inksoft_data, store_config)

# Lookup order in ManageOrders
order = lookup_order_by_external_id(ext_order_id)
```

**Store Config Structure:**
```python
{
    "StoreName": "Arrow Lumber",
    "StoreId": 119508,
    "id_Customer": 1821,
    "id_Integration": 131,  # CRITICAL
    "id_CompanyLocation": 2,
    "id_OrderType": 31,
    "id_EmpCreatedBy": 222,
    "id_ProductClass": 1
}
```

---

# Real-World Implementations

## Staff Dashboard

The Staff Dashboard (`/staff-dashboard.html`) uses ManageOrders PULL API extensively for business intelligence and team performance tracking.

### Features Using ManageOrders

**Files:**
- `/staff-dashboard.html` - Dashboard HTML
- `/shared_components/js/staff-dashboard-service.js` - Core service (1492 lines)
- `/shared_components/js/staff-dashboard-init.js` - Initialization (1330 lines)

**ManageOrders Fields Used:**

| Field | Usage | Notes |
|-------|-------|-------|
| `cur_SubTotal` | Revenue calculations | 7/30/60-day revenue metrics |
| `date_Invoiced` | Date filtering | For time-based aggregations |
| `CustomerServiceRep` | Team attribution | **Requires name normalization** |
| `id_OrderType` | Order type filtering | 21, 41 = embroidery |
| `id_Order` | Line item lookup | Links to `/lineitems/{order_no}` |
| `PartNumber` | Product matching | Used for Garment Tracker |
| `Size01-Size06` | Quantity extraction | **Must parseInt() - returns strings!** |

### Daily Sales Archive Pattern (formerly "60-Day Limit Workaround")

**⚠ RETENTION CORRECTION (2026-05-20):** The "60-day retention" claim historically documented in our memory was WRONG. We empirically verified via `caspio-pricing-proxy/scripts/test-mo-retention.js` that ManageOrders `/order-pull` retrieves orders as old as **02/05/2025 (469 days / 15.6 months)** still today — and likely 2 years per the official ManageOrders API guide. NWCA's customer-autocomplete 60-day window is a chosen design constraint for performance + freshness, not an MO API limit.

**Why the archive pattern still makes sense:**
- Pulling 2 years of orders on every Staff Dashboard load = slow + heavy
- Caspio archive gives sub-second YTD totals
- Long-term reliability — if MO ever goes offline or rate-limits aggressively, our YTD numbers survive

**Solution:** Archive daily sales to Caspio for YTD tracking. The Caspio archive is the source of truth for older periods; ManageOrders is queried for the rolling 60-day window for freshness.

```javascript
// Staff Dashboard pattern
async function getYTDRevenue() {
    // Last 60 days from ManageOrders
    const recentData = await manageOrdersService.getOrders(last60Days);

    // Older data from Caspio archive
    const archivedData = await caspioService.getDailySales(yearStart, past60Days);

    // Combine for full YTD
    return combineRevenue(archivedData, recentData);
}
```

**Key Insight:** The Caspio `daily-sales` table is populated by a scheduled job that queries ManageOrders daily and archives the results before they age out.

### Rep Name Normalization

**Problem:** `CustomerServiceRep` field has inconsistent names.

**Examples of variations:**
- `"ruth nhoung"` → `"Ruthie Nhoung"`
- `"JOHN SMITH"` → `"John Smith"`
- `"erik"` → `"Erik Lundberg"`

**Solution:** Rep name normalization map in `staff-dashboard-service.js`:

```javascript
const REP_NAME_NORMALIZATION = {
    'ruth nhoung': 'Ruthie Nhoung',
    'ruthie': 'Ruthie Nhoung',
    // ... more mappings
};

function normalizeRepName(rawName) {
    const key = rawName.toLowerCase().trim();
    return REP_NAME_NORMALIZATION[key] || properCase(rawName);
}
```

### Order Type Filtering

| id_OrderType | Description | Usage |
|--------------|-------------|-------|
| 21 | Embroidery Contract | Team tracking |
| 41 | Embroidery Retail | Team tracking |
| 6 | Web Order | Revenue metrics |
| 31 | Sales Order | Revenue metrics |

---

## Garment Tracker

The Garment Tracker tracks premium items with sales rep bonuses. Uses ManageOrders line items API.

### Premium Items with Bonuses

| PartNumber | Item | Bonus |
|------------|------|-------|
| `CT104670` | Carhartt Storm Defender Jacket | $5.00/item |
| `EB550` | Eddie Bauer Rain Jacket | $5.00/item |
| `CT103828` | Carhartt Duck Detroit Jacket | $5.00/item |
| `CT102286` | Carhartt Gilliam Vest | $3.00/item |
| `NF0A52S7` | North Face Dyno Backpack | $2.00/item |
| `112`, `112FP`, `168`, `169`, `174`, `172`, `256`, `115` | Richardson Caps | $0.50/cap |

### Part Number Matching Pattern

**Problem:** ShopWorks uses size variant SKUs (e.g., `CT104670_2X`).

**Solution:** Base part number matching:

```javascript
const PREMIUM_ITEMS = {
    'CT104670': { name: 'Carhartt Storm Defender', bonus: 5.00 },
    'EB550': { name: 'Eddie Bauer Rain Jacket', bonus: 5.00 },
    // ...
};

function matchPremiumItem(partNumber) {
    // Remove size suffix for matching
    const basePart = partNumber.split('_')[0];
    return PREMIUM_ITEMS[basePart] || null;
}

// "CT104670_2X" → matches "CT104670" → $5 bonus
```

### Rate Limiting Pattern

**Problem:** Fetching line items for many orders overwhelms ManageOrders API.

**Solution:** Throttled requests with exponential backoff:

```javascript
async function fetchAllLineItems(orderIds) {
    const results = [];

    for (const orderId of orderIds) {
        try {
            const lineItems = await fetchLineItems(orderId);
            results.push({ orderId, lineItems });

            // 500ms delay between requests
            await delay(500);
        } catch (error) {
            if (error.status === 429) {
                // Exponential backoff on rate limit
                await delay(2000);
                // Retry once
                const lineItems = await fetchLineItems(orderId);
                results.push({ orderId, lineItems });
            }
        }
    }

    return results;
}
```

### Size Field Extraction

**CRITICAL:** Size01-Size06 fields return strings, must convert to numbers.

```javascript
// WRONG - sizes are strings!
const totalQty = lineItem.Size01 + lineItem.Size02; // "5" + "3" = "53"

// CORRECT - parseInt each size
const totalQty =
    parseInt(lineItem.Size01 || 0) +
    parseInt(lineItem.Size02 || 0) +
    parseInt(lineItem.Size03 || 0) +
    parseInt(lineItem.Size04 || 0) +
    parseInt(lineItem.Size05 || 0) +
    parseInt(lineItem.Size06 || 0);
```

### Garment Tracker API Flow

```
1. GET /api/manageorders/orders (last 60 days, embroidery types)
   ↓
2. Filter orders by CustomerServiceRep
   ↓
3. For each order: GET /api/manageorders/lineitems/{id_Order}
   (with 500ms delay between calls)
   ↓
4. Match PartNumbers against premium items list
   ↓
5. Sum quantities (parseInt Size01-06)
   ↓
6. Calculate bonus = quantity × item bonus rate
```

### Garment Tracker Files

| File | Purpose |
|------|---------|
| `/shared_components/js/staff-dashboard-service.js` | Premium item definitions, bonus rates |
| `/src/routes/garment-tracker.js` (caspio-proxy) | CRUD endpoints for tracking |
| `/src/routes/daily-sales-by-rep.js` (caspio-proxy) | Team performance aggregation |

---

# Quick Reference Cheat Sheet

## Common Tasks

### Check Inventory
```javascript
const response = await fetch(
    `${PROXY_URL}/api/manageorders/inventorylevels?PartNumber=PC54&Color=Red`
);
const data = await response.json();
// data.result[0].Size01, Size02, etc.
```

### Create an Order
```javascript
const response = await fetch(`${PROXY_URL}/api/manageorders/orders/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        ExtOrderID: 'NWCA-WEB-12345',
        ExtSource: 'NWCA',
        id_Customer: 2791,
        id_OrderType: 6,
        id_CompanyLocation: 2,
        id_EmpCreatedBy: 222,
        date_OrderPlaced: '01/15/2025',
        date_OrderRequestedToShip: '01/20/2025',
        ContactNameFirst: 'John',
        ContactNameLast: 'Smith',
        ContactEmail: 'john@email.com',
        LinesOE: [{
            PartNumber: 'PC54',
            Color: 'Red',
            Size: 'L',
            Qty: '5',
            Price: '12.50',
            sts_EnableTax01: 1,
            sts_EnableTax02: 1,
            sts_EnableTax03: 1,
            sts_EnableTax04: 1
        }]
    })
});
```

### Verify Order Was Created
```javascript
const response = await fetch(
    `${PROXY_URL}/api/manageorders/orders/verify/NWCA-WEB-12345`
);
const data = await response.json();
// data.found === true if order exists
```

### Get Customer List (for Autocomplete)
```javascript
const response = await fetch(`${PROXY_URL}/api/manageorders/customers`);
const customers = await response.json();
// Array of { id_Customer, CustomerName, ContactFirstName, ... }
```

---

## Error Troubleshooting

| Error | Cause | Solution |
|-------|-------|----------|
| "All sizes show as Adult/S" | Missing id_Integration | Add valid integration ID to store config |
| "Tax not calculating" | Missing tax flags | Set sts_EnableTax01-04 to 1 |
| "Unable to Verify inventory" | Wrong color field | Use CATALOG_COLOR, not COLOR_NAME |
| "Date parse error" | Wrong format | Use MM/DD/YYYY, not YYYY-MM-DD |
| "Order not found" | Wrong ExtOrderID format | Check prefix (NWCA-, NWCA-TEST-, etc.) |
| "Auth failed" | Token expired | Check 60-second buffer, force refresh |
| "Gift certs merged" | In Payments array | Move to LinesOE with unique PartNumber |
| "Size modifier wrong" | Using _2XL | Use _2X (only 2XL is short form; 3XL+ use full form _3XL/_4XL) |

---

## ExtOrderID Prefixes

| Prefix | Source | Example |
|--------|--------|---------|
| `NWCA-` | Webstore orders | `NWCA-12345` |
| `NWCA-TEST-` | Test orders | `NWCA-TEST-12345` |
| `NWCA-3DT-` | 3-Day Tees | `NWCA-3DT-010125-12345` |
| `SAMPLE-` | Sample orders | `SAMPLE-0115-1-347` |
| `OF-` | Online Order Form (all flows — staff-direct + shared customer link, globally sequential) | `OF-0001`, `OF-0042` |
| (InkSoft ID) | InkSoft orders | `12345678` |

---

## Online Order Form (ExtSource: `NWCA-OrderForm`)

**Added:** 2026-04-21 · **Updated:** 2026-04-22 (switched to `OF-NNNN` global-sequential format)

New browser form at `/pages/order-form.html`. Staff-facing by default; supports a **shareable customer link** (`/order-form/OF-NNNN`) where staff pre-fill what they know and the customer fills the rest.

**Routing:**
- Frontend: `pages/order-form.html` + `pages/order-form/` (React via CDN + Babel standalone)
- Backend: `server.js`
  - `POST /api/order-form-drafts` — allocate an `OF-NNNN` ID via `/api/quote-sequence/OF` + save partial state to `quote_sessions`, `Status: "Draft"`
  - `POST /api/submit-order-form` — push to ShopWorks via caspio-proxy `/api/manageorders/orders/create`. If no `draftId` present, allocates a fresh `OF-NNNN` and pre-creates a `quote_sessions` row first.
  - `GET /order-form/:draftId` — short share link, redirects to `/pages/order-form.html?draftId=...`
- Storage: reuses `quote_sessions` / `quote_items` (same tables as 3-Day Tees + quote builders); `Notes` column holds the form-state JSON blob (mirrors `CustomerDataJSON` pattern)

**ID format (both flows identical):** `OF-NNNN` — zero-padded 4 digits, globally sequential, allocated via the proxy's `/api/quote-sequence/OF` endpoint (same race-safe counter Embroidery uses — see `shared_components/js/embroidery-quote-service.js:69`). Grows past 9999 naturally as more digits. Fallback to `OF-<timestamp>` if the counter endpoint is down. Year-scoped at the counter (resets Jan 1) — idempotency check on `Status === 'Processed'` catches any accidental cross-year collision.

**Payload differentiators vs 3-Day Tees (UPDATED 2026-05-02 with proxy v608 + main v903+):**
- `ExtSource: "NWCA-OrderForm"` (the proxy's hardcoded `ONSITE_DEFAULTS.ExtSource` actually overrides this to `"NWCA"` at push time — filter via `CustomerPurchaseOrder` prefix `OF-…` or the Notes header instead)
- `apiSource: "OrderForm"` → ShopWorks `APISource` field, routes to the dedicated **"Order Form" ManageOrders integration** (separate from the existing "Northwest Embroidery-Store" integration which handles 3-Day Tees + embroidery push). Set the new integration's APISource field to `"OrderForm"` verbatim.
- `ExtOrderID` = `OF-NNNN` (identical shape for staff-direct and share-link submits — after proxy prepends, becomes `NWCA-OF-0042` in ShopWorks)
- `rushOrder: false`
- `payments: []` (paid offline via invoice — no Stripe)
- `taxTotal: 0`, `cur_Shipping: 0` (OnSite calculates; tax flags set by proxy)
- **`idCustomer: Number(info.companyId) || 2791`** — when the rep picks a known company from the autocomplete (Caspio CompanyContactsMerge2026), `info.companyId` carries the real ShopWorks `id_Customer` (e.g. 1276 for Aaberg's). Falls back to 2791 catch-all for brand-new typed names. **Proxy now strips the Customer{...} block when idCustomer is non-default** to avoid overwriting canonical billing records with form-typed data.
- **`idOrderType` per decoration method** (CORRECTED 2026-05-02 after OF-0027 — original CSV had every ID wrong; verified against the live ShopWorks Order Types list):
  | Method | OrderType ID | ShopWorks Name | Revenue Account |
  |---|---|---|---|
  | Embroidery | **21** | Custom Embroidery | 4050 Custom Embroidered Sales |
  | Screen Print | **13** | Screen Print Subcontract | 4200 Subcontract Screenprinted Sales |
  | DTG | **5** | Digital Printing | 4001 Digital Printing Sales |
  | DTF | **18** | Transfers | 4005 Transfer Sales |
  | Stickers | **41** | Laser/Ad Specialties | 4400 Ad Specialty Sales |
  | Emblems | **7** | Emblem | 4002 Emblem Sales |
  | _no method picked_ | **6** | Online Store | 4003 Online Store Sales |
  - Per Erik 2026-05-02: ShopWorks does NOT allow mixed order types. An order is single-method; we take `methodsUsed[0]`. If the form UI ever lets a multi-method order through, the first method wins.
- **`id_DesignType` per method (CORRECTED 2026-05-02 — old values were wrong for everything except DTG)**:
  | Method | Design Type ID |
  |---|---|
  | Screenprint | 1 |
  | Embroidery | 2 |
  | Stickers | 4 (Advertising Specialty) |
  | Emblem | 5 |
  | DTF | 8 (Transfer) |
  | DTG | 45 |
- **Sales rep**: `info.salesRep` is a slug (`"taneisha"`); server.js translates via `SALES_REP_FULL_NAMES` → full name (`"Taneisha Clark"`) before sending. Authoritative table: see [server.js](../../../OneDrive%20-%20Northwest%20Custom%20Apparel/2025/Pricing%20Index%20File%202025/server.js) above the `/api/submit-order-form` route handler.
- Size handling: server does `orderFormSizeSuffix()` (in `server.js`) — `2XL → _2X`, `3XL → _3XL`, etc. Same conventions as §Size Modifier Reference.
- Artwork uploaded to `POST /api/files/upload` on caspio-proxy (same as 3-Day Tees), hosted URL sent as `imageUrl` + `mediaUrl`.

**Design auto-link (Phase B, v906 2026-05-02):**
- The form has a "Design #" autocomplete next to Sales Rep that fetches `/api/digitized-designs/by-customer?customerId=N` when the company is picked.
- **Key insight**: Caspio's `Design_Lookup_2026.Design_Number` IS ShopWorks's `id_Design` (same integer, different column name — the table's `ID_Unique` column is empty). So when rep picks design 9449, the order pushes with `idDesign: 9449` and ShopWorks links to the existing design row. No secondary lookup, no orphan, no duplicate.
- Empty design# → `Designs: []` (no design attached; rep links in ShopWorks if needed). Erik's preference: better to leave blank than create orphans.
- Non-numeric typed input ("abc") also → `Designs: []` (filter at server.js).
- Frontend cache: 5 min in-memory per `customerId`, in-flight dedupe so two focus events don't double-fetch.
- ⚠️ A latent bug was fixed: server.js was calling `/api/embroidery-designs/lookup` (404 — wrong path; correct is `/api/digitized-designs/lookup`). Design# resolution had been silently failing on every push since the form launched. Phase A's `Designs:[]` fallback masked it. v906 replaces the HTTP fetch with direct integer validation.

**Sales Rep → Employee ID mapping (Phase A, v906 2026-05-02):**
The form's `id_EmpCreatedBy` is now mapped per the picked Sales Rep (was hardcoded 2 / Erik for every order):

| Form slug | Display | id_EmpCreatedBy |
|---|---|---|
| jim | Jim Mickelson | 1 |
| erik | Erik Mickelson | 2 |
| ruth | Ruthie Nhoung | 24 |
| nika | Nika Lao | 169 |
| taneisha | Taneisha Clark | 281 |

Note: form's slug `ruth` → display "Ruthie Nhoung" (ShopWorks's exact spelling). Slug stays `ruth` for back-compat with saved drafts.

**ShopWorks integration setup (2026-05-02):**
- New integration "Order Form" created alongside existing "Northwest Embroidery-Store"
- Both share URL `manageordersapi.com/onsite` (ManageOrders SaaS endpoint, fixed)
- New integration's **Supplemental Settings**:
  - APISource = `OrderForm` (routing key — must match what we send in payload)
  - Customer Number = blank (form supplies via `idCustomer`)
  - Order Type ID = blank (form supplies via `idOrderType`)
  - Employee Created By = blank (defaults to 2; future: tie to picked rep)
  - DesignType ID = blank (form supplies via `id_DesignType` per method)
  - Company Location ID = 2 (NWCA Milton — kept)
  - Artist Created By = 224 (kept)
  - ProductClass = 1 (kept)
  - Tax: Tax_10.1 / 2200.101 (Milton 10.1%, same as existing)
- ⚠️ **Known transitional issue**: existing "Northwest Embroidery-Store" integration has APISource blank, which per ShopWorks tooltip means it pulls **all** orders. This means order-form orders may be duplicate-ingested by both integrations during the soak period. To finalize cleanup, set the existing integration's APISource to `Embroidery` (or similar) AND update 3-Day Tees + embroidery push code to send matching APISource — coordinate as a follow-up change.

**Add-On System (Phase 2 SHIPPED 2026-05-03, v909→v912 → v913 + proxy v609 sync):**

Reps can attach **29 NWCA fee/service codes** to an order via the picker UI. Each add-on becomes a separate ShopWorks LinesOE entry alongside the garment lines.

**Canonical service code list (source of truth: ShopWorks part numbers, verified by Erik 2026-05-03):**

| # | Code | Description | Preprint Group |
|---|---|---|---|
| 1 | SEG | Sew emblems to garments | Sewing |
| 2 | DECG | Direct Embroider Customer Supplied | Embroidery |
| 3 | DECC | Direct Embroider Customer Supplied | Embroidery |
| 4 | Monogram | Dir. Embroider Names on Garments | Embroidery |
| 5 | RUSH | Rush Charge | Fees |
| 6 | Freight | Freight Charges | Fees |
| 7 | DD | Digitizing Setup | Digitizing |
| 8 | DDE | Edit Digitizing | Digitizing |
| 9 | DDT | Text Digitizing Setup Fee | Digitizing |
| 10 | AL | Additional Logo Garment | Embroidery |
| 11 | DT | Transfer Customer design and run | Fees |
| 12 | Discount | Customer Discount | Fees |
| 13 | Pallet | Pallet Change | Digital Print |
| 14 | Art | Art Charges | Graphic Art |
| 15 | AS-Garm | Additional Stitches in Garment Logo | Embroidery |
| 16 | CDP | Customer Supplied Shirts Digital Print | Digital Print |
| 17 | AS-CAP | Additional Stitches in Cap Logo | Embroidery |
| 18 | LTM | Less Than Minimum Fee | Embroidery |
| 19 | CTR-Garmt | Contract Embroidered Garments | Embroidery |
| 20 | CTR-Cap | Contract Embroidered Caps | Embroidery |
| 21 | AL-CAP | Additional Logo CAP | Embroidery |
| 22 | DECG-FB | Full Back Embroidery | Embroidery |
| 23 | 3D-EMB | 3D Puff Embroidery | Embroidery |
| 24 | GRT-50 | Logo Mockup & Print Review | GRT (Graphic) |
| 25 | GRT-75 | Graphic design services | GRT (Graphic) |
| 26 | SPRESET | Re-Order Screenprint Setup | Screenprint (LPP) |
| 27 | SPSU | Screen Print Set Up Charge | Screenprint (LPP) |
| 28 | Laser Patch | Laser Faux Leather Patch | Embroidery |
| 29 | SECC | Sew emblems to caps | Sewing |
| 30 | Vellum | Vellum Print | Screenprint (LPP) |
| 31 | Color Chg | Color Change | Screenprint (LPP) |

**Screen-print setup parts (Erik's official list, 2026-06-27):** SPSU $30/screen (new), SPRESET $30/screen (reorder), Vellum $10 (film positive), Color Chg $15 (press-run color change — note the literal space in the part #). All four in Caspio `Service_Codes` (ServiceType SCREENPRINT, RailGroup "Setup Fees") + proxy `KNOWN_FEE_PNS`. The SCP push transformer synthesizes SPSU/Vellum/Color Chg LinesOE from the quote `Notes`; the SCP builder exposes Vellum + Color Change qty inputs (not SPRESET — reorder is not a builder option per Erik 2026-06-27). SPRESET stays a recognized part: a saved quote_item carrying it passes through `buildLinesOE`, and the import parser classifies it as a screen-print fee.

**Case rule:** All three layers (Caspio Service_Codes table, proxy `KNOWN_FEE_PNS`, frontend picker) carry the EXACT mixed-case spelling from the table above. ShopWorks part numbers are case-sensitive on the receiving end. Proxy comparison normalizes via `isKnownFeeCode()` (case-insensitive helper, [config/manageorders-emb-config.js](../caspio-pricing-proxy/config/manageorders-emb-config.js)) so case-mismatched callers still route to LinesOE correctly — but the value sent to ShopWorks preserves the canonical spelling.

**LTM is auto-baked, not a picker code** — distributed into per-piece pricing for embroidery `qty <= 7`. The Caspio row exists for legacy reasons but reps don't add it manually.

**Removed 2026-05-03 (verified to NOT exist in ShopWorks):** HW-SURCHG, Name/Number — hard-deleted from Caspio (PK 222 + 142). Removed from picker constants in `add-on-picker.jsx`. If a heavyweight surcharge or name/number service is needed in the future, the SW part must be created first, then added to the canonical list.

**Size:"S" stamping rule (proxy v609, 2026-05-03):** [`transformLineItems()`](../caspio-pricing-proxy/lib/manageorders-push-client.js) detects fee/service lines via `isKnownFeeCode(item.partNumber)` and stamps `Size: "S"` plus puts qty in `Size01` (zeros Size02-06). Each ShopWorks service part has Size Restriction = `S` only. Without this stamp, the empty `Size` value falls through ShopWorks's Size Translation Table to its default (last column / "Other XXXL"), violating the part's Size Restriction. Garment/cap lines unchanged — they still translate via SIZE_MAPPING (S/M/L/XL/2XL→_2X/3XL→_3XL/etc.).

**Data flow:**
1. Form load → [service-codes.js](pages/order-form/components/service-codes.js) hits `/api/service-codes` → caches 31 service definitions (1h TTL)
2. Form load → [tiered-pricing.js](pages/order-form/components/tiered-pricing.js) preloads `/api/al-pricing` + `/api/decg-pricing` + `/api/contract-pricing` (5min TTL)
3. Rep clicks "+ Add fee or service" in [add-on-picker.jsx](pages/order-form/components/add-on-picker.jsx) → categorized modal opens (Setup Fees / Per-Cap / Per-Garment / Order-Level)
4. Rep picks service → ParamsDialog collects required inputs per `PricingMethod`:
   - `FIXED`/`FLAT`: just confirm
   - `TIERED`: row + qty + stitch input → auto-resolves unit price via `tiered-pricing.resolveSync()`. Manual override allowed.
   - `CALCULATED` (RUSH): percent input (default 25). Live preview against current subtotal.
   - `HOURLY` (Art): hours input. Live preview against $75/hr rate.
   - `PASSTHROUGH` (Freight, Pallet, Discount, CDP): rep enters dollar amount.
5. Confirm → `addOrReplace()` enforces order-level singleton (replace + toast); per-row appends.
6. Active chips display on form between line items + totals. Drag-reassign supported (chip → row or chip → order-level).
7. Submit → server.js iterates `addOns`, looks up Service_Codes, computes price per `PricingMethod`, appends to `lineItems` array. Proxy → ShopWorks LinesOE.

**Pricing-method resolver (server.js):**
| Method | Source | Formula |
|---|---|---|
| FIXED | Service_Codes.SellPrice | `sellPrice` |
| FLAT | Service_Codes.SellPrice | `sellPrice` (qty=1 typical) |
| TIERED | picker's `params.unitPrice` (auto or manual) | rep-supplied; resolver in tiered-pricing.js auto-fills picker |
| CALCULATED (RUSH) | server-side | `subtotal × params.percent / 100` |
| HOURLY | Service_Codes.SellPrice (rate) | `sellPrice × params.hours` |
| PASSTHROUGH | `params.amount` | rep-supplied |

**TIERED auto-resolve (tiered-pricing.js):**
| Code | API | Formula (per piece) |
|---|---|---|
| AL | /api/al-pricing | `garments.basePrices[tier] + max(0, stitches - 8000) / 1000 × 1.25` |
| AL-CAP | /api/al-pricing | `caps.basePrices[tier] + max(0, stitches - 5000) / 1000 × 1.00` |
| AS-Garm | /api/pricing-bundle?method=EMB | **Flat tier**: $0 ≤10K, $4 ≤15K, $10 ≤25K (reads `Embroidery_Costs` `ItemType='AS-Garm'`+`TierLabel='ALL'`) |
| AS-CAP | /api/pricing-bundle?method=EMB | **Flat tier**: $0 ≤10K, $4 ≤15K, $10 ≤25K (reads `Embroidery_Costs` `ItemType='AS-Cap'`+`TierLabel='ALL'`) |
| DECG | /api/decg-pricing | `garments.basePrices[tier]` |
| DECC | /api/decg-pricing | `caps.basePrices[tier]` |
| DECG-FB | /api/decg-pricing | `fullBack.ratesPerThousand[tier] × max(stitches, 25000) / 1000` |
| CTR-Garmt | /api/contract-pricing | `garments.perThousandRates[tier] × stitches / 1000` |
| CTR-Cap | /api/contract-pricing | `caps.perThousandRates[tier] × stitches / 1000` |

**Critical:** AS-Garm/AS-CAP are NOT part of the AL family. They use a different Caspio source and a different formula. Conflating them caused OF-0032 to overcharge AS-CAP by ~$5/cap on a 10K-stitch design (correct = $0). Fixed in main v913 (Phase 2d.1) via `asStitchSurcharge()` helper. **Canonical NWCA AS policy:** flat-tier $0/$4/$10 same scale for caps and garments, switching to DECG-FB above 25K.

**Pricing parity verification (Phase 2d, 2026-05-03):**
- 13 representative scenarios tested across all 9 TIERED codes covering tier boundaries (1-7, 24-47, 72+) and stitch transitions (base, 50% over, 88% over)
- All 13 produced `delta = 0` between Order Form's resolveSync() and Quote Builder's reference formulas (embroidery-quote-pricing.js:2099-2102)
- Methodology: hit each API, run both code paths against the response, compare `Math.abs(qb - of) < 0.01`
- Re-run verification when any of these change: Service_Codes table, AL/DECG/Contract pricing tables, tiered-pricing.js formulas, embroidery-quote-pricing.js formulas

**KNOWN_FEE_PNS proxy whitelist** ([caspio-pricing-proxy/config/manageorders-emb-config.js:56](../caspio-pricing-proxy/config/manageorders-emb-config.js#L56)) — all 29 canonical service codes pre-approved for ShopWorks LinesOE. Codes outside this set fall through to Notes On Order in the embroidery-push transformer ([lib/embroidery-push-transformer.js:202](../caspio-pricing-proxy/lib/embroidery-push-transformer.js#L202)). Membership check uses `isKnownFeeCode()` for case-insensitive matching.

**ORDER_LEVEL_FEES** (TAX, SHIP, DISCOUNT) — per the embroidery push config; these are order-header fields, never LinesOE entries. The Order Form handles TAX/SHIP at the order level too.

**Customer-view locks (when opened via `/order-form/OF-…`):**
- Sales Rep dropdown: disabled
- PO # input: readonly
- Per-line Price column: hidden (pricing handled offline by sales)
- Everything else: editable (customer can correct staff typos)

**Status progression in `quote_sessions`:**
`Draft` → (customer opens + edits, optional) → `Processed` (pushed to ShopWorks) or `Processed - ShopWorks Failed` (push failed, manual retry).

**Idempotency:** submit endpoint checks `quote_sessions.Status === 'Processed'` for the `draftId` before pushing — returns `mode: 'already-processed'` if so.

**Gotchas learned during initial rollout (2026-04-22):**

1. **`ExtSource` is hardcoded at the proxy.** `manageorders-push-client.js` line 72 sets `ExtSource: ONSITE_DEFAULTS.ExtSource` regardless of what the caller sends. Payloads with `extSource: "NWCA-OrderForm"` still arrive at OnSite as `ExtSource: "NWCA"`. For per-integration filtering, key off `CustomerPurchaseOrder` prefix (`OF-…`, `WEB-OF-…`, `3DT-…`) or the Notes header (`Source: NWCA-OrderForm`). OnSite's "APISource" setting is also blank at the connection level — there's no server-side consumer.

2. **Proxy expects specific camelCase date field names.** manageorders-push-client.js reads `orderData.orderDate`, `orderData.requestedShipDate`, `orderData.dropDeadDate` and converts them to `date_OrderPlaced` / `date_OrderRequestedToShip` / `date_OrderDropDead` (MM/DD/YYYY). **NOT** `dateOrdered`/`dateRequestedToShip`/`dateDue` — those silently drop to `null`. First Order Form push had `date_OrderRequestedToShip: null` because I used the wrong camelCase.

3. **Caspio `PUT /quote_sessions?filter=QuoteID='…'` silently no-ops.** The URL is accepted with 200 OK, but the Status change is NOT persisted. MUST use the PK_ID path: `PUT /quote_sessions/{PK_ID}`. Server.js now does a filter GET first to read PK_ID, then a PK-based PUT for the Status flip. Direct-curl test confirmed `/quote_sessions/{PK_ID}` works for both `Status` alone and `Status + Notes` together.

4. **Caspio `GET /quote_sessions?filter=...` is cached ~5min.** A customer reloading `/order-form/OF-...` within a few minutes of submit may still see `Status: "Draft"` on the public endpoint, even though the underlying row is `Processed`. Direct `GET /quote_sessions/{PK_ID}` is fresh. The Order Form UI surfaces the submit result from the live response — not from re-fetch — so the user always sees the correct success/fail state on the current page. A full reload before the cache expires is the only visible symptom.

5. **`id_Artist: 224` is the integration default, not a 3-Day Tees artifact.** Set at OnSite connection level ("Artist Created By: 224"). Every order through this integration inherits it unless `designs[n].artistId` is explicitly passed. Safe to leave for the Order Form.

6. **Size Translation Table in OnSite integration config APPENDS suffixes — DO NOT pre-suffix on push (CORRECTED 2026-05-01).** The integration's "OnSite Part Number Modifier" column actively appends modifiers on ingest: `2XL` → `_2X`; `3XL`/`4XL`/`5XL`/`6XL`/`XS` → `_3XL`/`_4XL`/`_5XL`/`_6XL`/`_XS`. **Push the BASE part number** (`PC61Y`, `112`, `NE1000`) plus the plain `size` field — OnSite produces `PC61Y_XS`, `112_OSFA`, `NE1000_S/M`. Pre-suffixing in code → double-stamp (`PC61Y_XS_XS`). The frontend breakdown row + `inventory-check.js` STILL use `orderFormSizeSuffix()` because (a) display must match what OnSite eventually outputs and (b) the SanMar inventory API genuinely requires the suffixed PN — only this push is base-PN.

---

## Service Rail Architecture (Phase 3, SHIPPED 2026-05-03, v915–v916)

Replaces the bottom-of-form dropdown picker with a sticky left-side drag-and-drop catalog. Reps drag service cards directly onto product rows or an order-level zone — McDonald's-style point-and-click order entry.

**Caspio `Service_Codes` table (Phase 3a additions):**

| Column | Type | Purpose |
|---|---|---|
| `RailGroup` | text | UI section: "Stitch Surcharges", "Cap Extras", "Garment Extras", "Setup Fees", "Order Fees" |
| `RailOrder` | number | Sort order within group (1, 2, 3...) |
| `Tier` | text | "Standard" / "Mid" / "Large" (only for AS-CAP / AS-Garm 3-row split) |
| `Visible` | yes/no | Admin can hide a service from rail without deleting (LTM is hidden — auto-baked) |

**AS surcharge 3-row split:** `AS-CAP` and `AS-Garm` each have 3 Caspio rows now (Standard $0, Mid $4, Large $10) with the canonical NWCA flat-tier prices baked in. ShopWorks still receives PartNumber `AS-CAP` / `AS-Garm` (one canonical part); the `DisplayAsDescription` carries the tier label. Picking from the rail = picking the tier directly.

**Method-aware filtering:** each pricing engine declares `getRailServices()` returning the filtered Service_Codes subset. Implementation in [shared.js `filterRailServices()`](pages/order-form/pricing/shared.js); per-method allow-lists:
- embroidery → `['EMBROIDERY','DIGITIZING','UNIVERSAL']`
- screenprint → `['SCREENPRINT','UNIVERSAL']`
- dtg → `['DTG','UNIVERSAL']`
- dtf / sticker / emblem → `['<METHOD>','UNIVERSAL']`

Universal services (RUSH, Freight, Discount, Pallet, Art, GRT-50, GRT-75, DT) appear on every method.

**Drag-and-drop architecture:**
- Cards are `<div draggable=true>` (HTML5 native, no library)
- ServiceRail component manages drag state; on dragStart it sets `window.__railDragPayload` and dispatches `railDragStart` CustomEvent
- PaperRow listens for the event, reads payload, decides eligibility (`scopeOf(code)` → cap/flat/any), shows visual feedback (`pf-row--rail-eligible` green outline / `pf-row--rail-ineligible` red dim)
- Drop calls `window.__railHandleDrop({zoneType, rowId, rowKind})` — exposed by ServiceRail via useEffect
- ServiceRail also renders fallback drop zones in the rail itself (per-row + order-level) for the case where the rep drags back into the rail

**Mobile/iPad fallback:** `(hover: none)` media query detects touch devices. Cards become non-draggable; instead, `onClick` triggers `onTap(payload)` which sets selectedCard state. Same `__railDragPayload` + dispatch flow — rows visually respond identically. Tap row to place. Tap same card again to cancel.

**Drop bounce + chip slide-in:** CSS keyframe animations on `.pf-row--just-dropped` (800ms green flash on the affected row) and `.addon-chip--just-added` (slide from left).

**Files:**
- [components/service-rail/service-rail.jsx](pages/order-form/components/service-rail/service-rail.jsx) — orchestrator
- [components/service-rail/rail-section.jsx](pages/order-form/components/service-rail/rail-section.jsx) — collapsible groups
- [components/service-rail/rail-card.jsx](pages/order-form/components/service-rail/rail-card.jsx) — 6 PricingMethod renderers (FIXED/FLAT/TIERED/CALCULATED/HOURLY/PASSTHROUGH)
- [components/service-rail/drop-zone.jsx](pages/order-form/components/service-rail/drop-zone.jsx) — eligibility validator (also exports `scopeOf()`)
- [components/service-rail/service-rail.css](pages/order-form/components/service-rail/service-rail.css) — all rail + drop styles
- [components/paper-form.jsx](pages/order-form/components/paper-form.jsx) — wraps in `.of-layout` 2-col grid; PaperRow has rail drop handlers

**Add-on-picker.jsx is now deprecated** but stays in code as a fallback. Trigger button is hidden when rail is mounted. Will delete in Phase 4.

**Per-customer auto-suggest deferred to Phase 4** (no `Accounts` Caspio table — needs to be created or use a different data home like `nwca-accounts` Heroku app).

---

## API Response Codes

| Code | Meaning | Action |
|------|---------|--------|
| 200 | Success | Process response |
| 403 | Forbidden | Check credentials |
| 404 | Not Found | Verify endpoint/ID |
| 429 | Rate Limited | Wait and retry |
| 500 | Server Error | Check payload format |

---

## Key Files Reference

| Project | File | Purpose |
|---------|------|---------|
| Pricing Index | `/server.js:1046-1337` | 3-Day Tees order creation |
| Pricing Index | `/server.js:~1654-1840` | Online Order Form submit + draft + share route |
| Pricing Index | `/pages/order-form/shopworks.js` | Order Form browser client (routes to `/api/submit-order-form`) |
| Pricing Index | `/shared_components/js/manageorders-*.js` | PULL API services |
| caspio-proxy | `/src/routes/manageorders.js` | PULL API routes |
| caspio-proxy | `/lib/manageorders-push-client.js` | PUSH API client |
| caspio-proxy | `/lib/manageorders-push-auth.js` | Authentication |
| Python Inksoft | `/web/transform.py` | InkSoft→OnSite transform |
| Python Inksoft | `/web/stores.py` | Store configurations |

---

*This document is the single source of truth for ManageOrders API usage across all NWCA projects.*
