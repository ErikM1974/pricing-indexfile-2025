# SanMar Web Services API Reference

**Source:** SanMar Web Services Integration Guide **v24.4 (June 2026, 127 pages)**
**Created:** 2026-02-22 (from v22.8) · **Updated:** 2026-06-23 (to v24.4)
**Purpose:** Documents how ShopWorks/NWCA communicates with SanMar for product info, inventory, pricing, order status/shipment, invoicing, and packing slips.

> **What changed v22.8 → v24.4** (SanMar change log): Feb 2025 added brands A4 + Stanley/Stella · Mar 2025 renamed **Edev → Test** environment · Jul 2025 PromoStandards GetProduct V2 params + getProductInfoByCategory categories + GetPackingSlip LPN info · Sep 2025 + Feb 2026 Brand Restrictions · Feb 2026 per-warehouse qty in GetInventory + "Port & Co" name · Jun 2026 SoapUI URL + getProduct getBrand/getCategory process + **getProduct MAP pricing field**.

---

## Overview

SanMar provides a free **XML-based SOAP API** (proprietary "SanMar Standard" methods **and** PromoStandards methods) covering product info, inventory, pricing, order shipment/status, invoicing, and packing slips. Real-time; requires TLS 1.2. Request API access via **sanmarintegrations@sanmar.com**.

PO **submission** requires separate **Test-environment** testing + SanMar approval (not covered here). PO **tracking** — Order Status V2 + Order Shipment Notification — are read-only services usable today with standard credentials (see below).

## Authentication

Create production SanMar.com web credentials at **https://www.sanmar.com/signup/webuser**. Test credentials are separate and issued on request.

| SanMar Standard field | Req | Type | Notes |
|---|---|---|---|
| `SanMarCustomerNumber` / `sanMarCustomerNumber` | Yes | INT | SanMar customer number |
| `SanMarUserName` / `sanMarUserName` | Yes | STRING | SanMar.com username |
| `SanMarUserPassword` / `sanMarUserPassword` | Yes | STRING | SanMar.com password |
| `senderId` / `senderPassword` | No | — | **Not currently used by SanMar** ("Do Not Use") |

| PromoStandards field | Req | Notes |
|---|---|---|
| `id` | Yes | SanMar.com username |
| `password` | Yes | SanMar.com password |

Auth failure → `errorOccurred=true`, message `"ERROR: User authenticating failed"`. (Standard SOAP fields are camelCase inside `arg1`; PromoStandards uses `shar:id` / `shar:password`.)

---

## Endpoints

**Production host:** `ws.sanmar.com:8080` · **Test host:** `test-ws.sanmar.com:8080` (same paths; was "Edev" before Mar 2025). All URLs are **`https://`** + port **8080** (bare host:port is not a valid endpoint).

| Service | Path (prefix with `https://<host>:8080`) |
|---|---|
| Product Info (Standard) | `/SanMarWebService/SanMarProductInfoServicePort?wsdl` |
| Inventory (Standard) | `/SanMarWebService/SanMarWebServicePort?wsdl` |
| Pricing (Standard) | `/SanMarWebService/SanMarPricingServicePort?wsdl` |
| Invoicing (Standard) | `/SanMarWebService/InvoicePort?wsdl` |
| LPN / Packing Slip | `/SanMarWebService/webservices/PackingSlipService?wsdl` |
| PromoStandards Product Data V2.0.0 | `/promostandards/ProductDataServiceBindingV2` (✅ what our proxy uses in prod) |
| PromoStandards Media Content V1.1.0 | `/promostandards/MediaContentServiceBinding?wsdl` |
| PromoStandards Inventory V2.0.0 | `/promostandards/InventoryServiceBindingV2final?WSDL` |
| PromoStandards Pricing & Configuration V1.0.0 | `/promostandards/PricingAndConfigurationServiceBinding?WSDL` |
| PromoStandards Order Shipment Notification V1.0.0 | `/promostandards/OrderShipmentNotificationServiceBinding?wsdl` |
| PromoStandards Order Status V2.0.0 | `/promostandards/OrderStatusServiceBindingV2?wsdl` |
| PromoStandards Invoice V1.0.0 | `/promostandards/InvoiceServiceBindingV1_0_0?WSDL` |

The guide gives two forms for Product Data V2: `…/ProductDataServiceBindingV2?WSDL` (p.8) and `…/ProductDataServiceV2.xml?wsdl` (p.30). **Our `caspio-pricing-proxy` already uses `…/ProductDataServiceBindingV2` in production successfully** (`src/routes/sanmar-product-data.js`) — prefer that form.

**Connectivity:** API IP `63.251.12.134`, port **8080** must be open inbound/outbound. A browser timeout on a WSDL = firewall/port block.

**Test with SoapUI** (p.9): download `https://www.soapui.org/downloads/latest-release/` → New SOAP Project → paste a **Test** WSDL (e.g. Pricing). Order Status V1.0.0 was removed Aug 2024 — do not re-add it.

### Common Errors

- **Standard:** `Invalid Style + Color + Size specified` · `User authentication failed` · `Invalid warehouse specified`.
- **PromoStandards codes:** 100 ID not found · 104 unauthorized · 105 auth failed · 110 auth required · 115 wsVersion not found · 120 required fields · 125 Not Supported · 130 ProductId not found · 135 Product color not found · 140 PartId not found · 145 Part color not found · 150 Part size not found · 155 Invalid Date Format · 160 No Results · 200 Product Data not found · 300 queryType not found · **301 Reference#/PO/Invoice not found** · 302 timestamp invalid · **303 input date >7 days old** · 999 General Error.

---

## Best Practices & Data-Usage Cadence (NEW — guide pp.13-17)

No hard call limits, but **use discretion** (don't make thousands of requests/day). Prefer FTP files / PromoStandards methods for bulk; call services at **style/productId level, not SKU level**. Use **production** WSDLs even for testing product/inventory/pricing (the Test env lacks current data).

| Need | Best option | Cadence / rule |
|---|---|---|
| **Invoices** | `Daily Invoice File` (FTP, 6am PT, prior-day) | Invoiced daily after **9pm PT**; wait 1 extra day to pull. PromoStandards `GetInvoices` only **after 3pm PT**. 1-2 calls/day max when pulling by reference#. |
| **Inventory (bulk)** | `sanmar_dip.txt` (FTP, **hourly**) | Service-based pull at Product/Style level ≈ **3000 API calls** per occurrence — use the file instead. |
| **Inventory (live)** | PromoStandards Inventory V2.0.0 | At time of ordering only. |
| **Pricing — sale** | `sanmar_dip.txt`, pulled **Mon & Wed** | Sale pricing changes every Mon & Wed. |
| **Pricing — case/MSRP/program** | `Sanmar_epdd.csv` / Incentive Pricing File, **monthly** | Base pricing (MSRP/case/negotiated) changes only **1-2× per year**. |
| **Order status** | PromoStandards Order Status V2.0.0, **≤3×/day** | Wait **2h** after PO. Stop polling once status = **Complete/Canceled**. |
| **Shipment notification** | `Daily Status File` (FTP, nightly) | Alt: Order Shipment Notification V1.0.0, ≤3×/day. |
| **Full catalog** | `sanmar_dip.txt` or EPDD/SDL file, monthly | One-time: `getProductBulkInfo`; deltas: `getProductDeltaInfo` (→ FTP `SanMarPI` folder). |
| **Media** | `getMediaContent` at **productId** level | productId-level returns all variant images in one call. |

**301-error handling** (order status & shipment): hold off ≥24h; if 301 persists past **48h** the order may not have landed → flag for review, contact your AE, and **pause the service** until resolved. **303** = your search date is older than 7 days. **Backorder:** after getting an in-hands date from SanMar, pause polling that order until the date passes.

**Inventory `discontinued` rule (sanmar_dip.txt):** discontinued items flagged by `discontinued_code = S` **and** `quantity = 0`; a discontinued style still lists all sizes for a color while any size has ≥12 units; zero qty can rebound from returns (resume checking when it does).

### FTP Data Files (access via sanmarintegrations@sanmar.com)

`sanmar_dip.txt` (hourly base inventory + piece/case/sale pricing) · `Sanmar_epdd.csv` (case price + MSRP) · `SanMar_SDL_N.csv` (valid styles/mainframe colors/sizes + **GTINs** + COLOR_NAME/SANMAR_MAINFRAME_COLOR) · `Daily Invoice File` (6am PT) · `Daily Status File` (nightly shipments) · Incentive/Daily Pricing File (program pricing) · `SanMarPI` folder (`SanMarPI-Bulk-<cust#>.csv` monthly, `SanMarPI-Delta-<cust#>.csv` daily; merge on `unique_key`).

---

## SanMar↔ShopWorks Data Bridge

### Size Format Translation

SanMar API uses **human-readable sizes**; ShopWorks uses **SKU suffixes** (NWCA-internal — not a SanMar field).

| SanMar Size | ShopWorks Suffix | Size Field | Notes |
|---|---|---|---|
| S, M, L, XL | _(none)_ | Size01-04 | Base product |
| 2XL | `_2X` | Size05 | **Short form** only |
| XXL | `_XXL` | Size05 | Ladies/Womens ONLY (distinct from 2XL) |
| 3XL | `_3XL` | Size06 | Full form |
| 4XL | `_4XL` | Size06 | Full form |
| XS, 5XL, 6XL, 7XL | `_XS`, `_5XL`, etc. | Size06 | Full form |
| OSFA | `_OSFA` | Size06 | Caps, bags, towels |

**Key rule:** Only 2XL uses the short form (`_2X`). All others use full form.

### sizeIndex — small ordinal (⚠️ corrected v24.4)

SanMar's `sizeIndex` is a **small ordinal**, NOT a hundreds-based scheme. Verified in both services: getPricing returns `sizeIndex 3` for **M**; getProductInfoByStyleColorSize returns `sizeIndex 2` for **S**.

| sizeIndex | Size |
|---|---|
| 1 | XS |
| 2 | S |
| 3 | M |
| 4 | L |
| 5 | XL |
| 6+ | 2XL, 3XL, … (continue incrementally — confirm exact 2XL+ values from the live response) |

> **Prior versions of this doc wrongly listed XS=0/S=100/M=200/…/2XL=500. That was incorrect and is contradicted by two services.** The ShopWorks `Size01-Size06` mapping above is separate and unrelated.

### Color System

| Live SOAP field | Bulk/Delta CSV col | Purpose | Example |
|---|---|---|---|
| `color` | `COLOR_NAME` | Display name (customer-facing) | "Brilliant Orange" |
| `catalogColor` | `CATALOG_COLOR` | **Mainframe color = API/order key** | "BrillOrng" |

PromoStandards `GetProduct` names these `standardColorName` (display, ← CSV `COLOR_NAME`) and `colorName` (API key, ← CSV `SANMAR_MAINFRAME_COLOR`). `primaryColor` is unused by SanMar; `approximatePms` is informational. **ALWAYS use `catalogColor`/`colorName` for SanMar API & inventory calls**, never the display name.

### Unique Identifiers

- **`uniqueKey`** (= `partId` in PromoStandards / `unique_key` in CSV) = **`inventoryKey` string-concatenated with `sizeIndex`** (e.g. inventoryKey `11803` + sizeIndex `2` = `118032`). Recommended merge key for bulk/delta updates.
- **`inventoryKey`** = SanMar's per-style+color identifier.

---

## SanMar Standard Product Information Service

Five functions:
- **`getProductBulkInfo`** — full-catalog CSV → FTP `SanMarPI` ~20 min after request; **once/month**; `SanMarPI-Bulk-<cust#>.csv`.
- **`getProductDeltaInfo`** — incremental CSV (changes since last bulk/delta); **daily**; `SanMarPI-Delta-<cust#>.csv`.
- **`getProductInfoByBrand`** / **`getProductInfoByCategory`** — **asynchronous**: SOAP returns only an ack ("Your file will be available shortly in the SanMarPI folder…"); data is written to FTP as `Brand_<Brand>_<MM-DD-YYYY>.csv` / `Category_<Category>_<MM-DD-YYYY>.csv`. (Process/brand+category lists updated Jun 2026.)
- **`getProductInfoByStyleColorSize`** — live SOAP query; search by `style` (req), `color` (CATALOGCOLOR, opt), `size` (opt) → style / style-color / style-size / style-color-size.

**Valid Categories** (Jul 2025): Activewear, Accessories, Bags, Bottoms, Caps, Infant & Toddler, Juniors & Young Men, Outerwear, Personal Protection, Polos/Knits, Sweatshirts/Fleece, T-Shirts, Tall, Women's, Workwear, Woven Shirts, Youth.

**Notable response fields** (bulk CSV cols / live camelCase): `mapPrice`/`MAP_PRICE` (col AP — **Minimum Advertised Price, NEW Jun 2026**) · `piecePrice` (≤5 pieces) · `casePrice` (per-piece in a full case) · `pieceSalePrice`, `caseSalePrice`, `saleStartDate`/`saleEndDate` · `dozenPrice`/`dozenSalePrice` (**DEPRECATED — echoes piece price**) · `caseSize` · `priceCode` (A/P=50%, B/Q=45%, C/R=40%, D/S=35%, E/T=30% suggested retail) + `priceText` (sizes the price applies to) · `productStatus` (Active / Coming Soon / New / Regular / Discontinued) · `category`, `keywords`, image URLs.

---

## PromoStandards Product Data V2.0.0 (NEW coverage)

Four functions:
- **`getProduct`** — full product detail. Request: `wsVersion 2.0.0`, `id`, `password`, `localizationCountry=us`, `localizationLanguage=en`, `productId` (req), `partId` (opt), `colorName` (mainframe color, opt), optional `ApparelSizeArray` (apparelStyle/labelSize/customSize — case-sensitive; needs both productId+partId). Response: productName, description array, productBrand, ProductCategoryArray, RelatedProductArray, primaryImageUrl, **`ProductPriceGroupArray` (groupName e.g. `MSRP`, currency USD, qtyMin/qtyMax/price — Jun 2026 MAP/MSRP field)**, ProductPartArray (partId, ColorArray, ApparelSize, Dimension+weight, `gtin`, isRushService, ShippingPackageArray, isCloseout/isCaution/isOnDemand/isHazmat), ISO-8601 date fields, FobPointArray.
- **`getProductCloseOut`** — all discontinued SKUs (`{productId, partId}`); request = credentials + wsVersion only.
- **`getProductDateModified`** — `{productId, partId}` changed since `changeTimeStamp` (ISO-8601 w/ offset). Best for incremental sync.
- **`getProductSellable`** — `{productId, partId}` filtered by `isSellable` (`true`/`false`); optional productId/partId.

## PromoStandards Media Content V1.1.0 (NEW coverage)

- **`getMediaContent`** — request `wsVersion 1.1.0`, `cultureName` (e.g. en-us), `mediaType` ∈ **{Image, Document} only** (no Audio/Video), `productId` (req), `partId` (opt), `classType` (INT: 1004 Swatch, 1006 Primary, 1007 Front, 1008 Rear, 2001 High). Response `MediaContentArray`: productId, partId, `url`, mediaType, ClassTypeArray (classTypeId/classTypeName), color, singlePart. **Pull at productId level** to get all variant images in one call.
- **`getMediaDateModified`** — **NOT supported by SanMar**.

---

## Inventory Services

### SanMar Product Inventory Service (Standard)

- **`getInventoryQtyForStyleColorSize`** — qty from **all** warehouses. Args: customerNo, username, password, `Style` (req), `Color` (Catalog/Mainframe Color, opt), `Size` (opt) → query at **Style / Style+Color / Style+Size**.
- **`getInventoryQtyForStyleColorSizeByWhse`** — same + `Warehouse Number` (req).

**Response** (`xsi:type ns2:Inventory`): `<style>` → `<skus>` → one `<sku>` per color+size with `<color>`, `<size>`, and repeating `<whse>` blocks of `<whseID>`, `<whseName>`, `<qty>`. Warehouses returned in **descending** numeric order. Uses Catalog/Mainframe color, **not** Color_Name.

### PromoStandards Inventory V2.0.0

- **`getInventoryLevels`** (only function — **`getFilterValues` NOT supported**). Three query types: (1) productId + `labelSize` + `partColor` (catalog color name); (2) productId only; (3) **`partIdArray`** — up to **200 PartIds** per call (any valid productId in the envelope; PartId need not match) → batch a whole cart at checkout in one request.
- **Response:** `PartInventory` { partId, partColor, labelSize, `quantityAvailable` (uom EA), manufacturedItem, buyToOrder, `InventoryLocationArray` of { inventoryLocationId, inventoryLocationName, postalCode, country, `inventoryLocationQuantity` } }.

> ⚠️ **3000-qty cap (both inventory services):** the max quantity returned **per warehouse is 3000** — a value of `3000` means "≥3000," not an exact count.

### Warehouse Locations

| ID | Location | Postal |
|---|---|---|
| 1 | Seattle, WA | 98027 |
| 2 | Cincinnati, OH | 45069 |
| 3 | Dallas, TX | 75038 |
| 4 | Reno, NV | 89441 |
| 5 | Robbinsville, NJ | 08691 |
| 6 | Jacksonville, FL | 32219 |
| 7 | Minneapolis, MN | 55379 |
| 12 | Phoenix, AZ | 85323 |
| 31 | Richmond, VA | — |

(`fobId` for pricing accepts exactly these IDs: 1-7, 12, 31.)

---

## Pricing Services

### SanMar getPricing (Standard) — one function

Request by **`style`** [`/color`(Catalog Color)`/size`] **OR** by **`inventoryKey` + `sizeIndex`**. Style-only returns all SKUs for the style.

**Response fields:** `piecePrice` (per-piece, ≤5 pcs) · `casePrice` (per-piece in a full case = best volume price) · `dozenPrice` (deprecated; echoes piece) · `salePrice` + `saleStartDate`/`saleEndDate` (active window) · `myPrice` (customer-negotiated) · `incentivePrice` · `inventoryKey` · `sizeIndex` · `style`/`color`/`size`.

```xml
<casePrice>2.59</casePrice>  <color>lime</color>     <dozenPrice>3.59</dozenPrice>
<inventoryKey>46389</inventoryKey>  <myPrice>1.76</myPrice>  <piecePrice>3.59</piecePrice>
<salePrice>1.99</salePrice>  <size>m</size>  <sizeIndex>3</sizeIndex>  <style>lpc61</style>
<saleStartDate>2017-06-26</saleStartDate>  <saleEndDate>2017-07-02</saleEndDate>
<incentivePrice>1.76</incentivePrice>
```

> The Standard getPricing service returns **cost tiers**, not MSRP. **Price varies by color** (e.g. White cheaper than colored) — same style+size can differ per color.

### PromoStandards Pricing & Configuration V1.0.0 — two functions

- **`getConfigurationAndPricing`** — returns **Net** (customer cost) / **List** (= MSRP, A/R coded) / **Customer** (TVBP/special) pricing via `priceType`. Request: `wsVersion 1.0.0`, id, password, `productID`, `partId`, `currency=USD`, `fobId` (1-7,12,31), `priceType`, `localizationCountry=US`, `localizationLanguage=EN`, `configurationType=Blank`. Response: price breaks via `minQuantity` + `price` (DECIMAL 12,4) + `priceUom` {BX, CA, DZ, EA, KT, PR, PK, RL, ST, SL, TH} + `priceEffectiveDate`/`priceExpiryDate`.
- **`getFobPoints`** — fobId/fobCity/fobState/fobPostalCode/fobCountry per product.
- SanMar does **NOT** implement `GetAvailableLocations` / `GetDecorationColors` / `GetDecorationPricing`.

---

## Order Tracking (read-only — distinct from PO submission)

### PromoStandards Order Status V2.0.0

Functions: **`getOrderStatus`**, **`getServiceMethods`** (capability probe); **`getIssue` NOT supported**.

`getOrderStatus` request: `wsVersion 2.0.0`, id, password, `queryType` ∈ **poSearch** (customer PO#) / **soSearch** (SanMar SO#) / **lastUpdate** (`statusTimeStamp` ISO-8601 UTC; max **30 days**, drop to 7 on timeout) / **allOpen** / **allOpenIssues**; `referenceNumber` (poSearch/soSearch); `returnIssueDetailType` (noIssues/openIssues/allIssues, req); `returnProductDetail` (BOOLEAN, req).

**Status values:** Received · Confirmed · Partially Shipped · Shipped · **Complete** (shipped+invoiced — terminal) · **Canceled** (terminal). Stop polling on Complete/Canceled.
**Issues:** `issueStatus` (Open/Pending), `issueCategory` (`generalHold` / `backOrderHold`), `urgentResponseRequired` (always false).
**Response:** purchaseOrderNumber, salesOrderNumber, status, ContactType (default Sales / AE), `validTimestamp`, and (if `returnProductDetail=true`) a Product array (productId, partId, salesOrderLineNumber, QuantityOrdered/QuantityShipped {value, uom EA}, line status).

### PromoStandards Order Shipment Notification V1.0.0

**`getOrderShipmentNotification`** — request `wsVersion 1.0.0`, id, password, `queryType` ∈ **1** (customer PO#) / **2** (SanMar SO#, e.g. 71490386) / **3** (`shipmentDateTimeStamp` UTC, **7-day max** window). Types 1/2 omit the timestamp; type 3 omits referenceNumber. Response: ShipToAddress, ShipFromAddress, **trackingNumber**, shipmentDate, carrier (e.g. UPS), shipmentMethod (e.g. Ground), per-package Item array (supplierProductId, supplierPartId, quantity). (Daily Status File on FTP is the recommended bulk alternative.)

---

## Invoicing Services

### SanMar Standard Invoicing — 10 functions

`GetInvoiceByInvoiceNo` · `GetInvoices` (incremental) · `GetInvoicesByInvoiceDateRange` (≤3 months) · `GetInvoicesByOrderDate` · `GetInvoicesByPurchaseOrderNo` · 3 Header-only variants · `GetUnpaidInvoices` · `GetUnpaidInvoicesHeader`. (PO# input ≤13 chars, invoice# ≤10.)

**Header fields:** SubTotal, SalesTax (returns `0.0`), ShippingHandlingCharges, TotalAmount, Terms, DueDate, FreightSavings, TrackingIDs.
**Line-item fields:** StyleNo, StyleColor, StyleSize, StyleDescription, Quantity, UnitPrice, Amount, UniqueKey.

```xml
<StyleNo>PC55P</StyleNo>  <StyleColor>Safety Green</StyleColor>  <StyleSize>S</StyleSize>
```

### PromoStandards Invoice V1.0.0

**`getInvoices`** (camelCase: invoiceAmountDue, taxAmount, productId, partId, extendedPrice); `queryType` 1=PO / 2=invoice# / 3=date / 4=availableTimeStamp. `getVoidedInvoices` **NOT supported**.

> **Timing:** invoiced daily after **9pm PT**; pull next day (PromoStandards `GetInvoices` after **3pm PT**). The 6am-PT **Daily Invoice File** (FTP) carries the same data.

---

## SanMar License Plate Number (LPN) / Packing Slip Service

**`GetPackingSlip`** (`/SanMarWebService/webservices/PackingSlipService`). Request: `wsVersion 1.0.0`, `UserId`, `Password`, `PackingSlipId` = **LPN** (e.g. `LP000123456789`; prefixes **LP / L / S / R**).
**Decorator accounts:** call succeeds only if the order Ship-To matches the decorator account address, else "Data Not Found."

**Response Header:** ShipmentDate, **`ShipmentUnitIndex` (= box number)**, ShipmentUnitQuantity, OrderNumber, InvoiceNumber, PurchaseOrderReference, Weight (lb), Carrier (Name / ShippingMethod / TrackingId).
**Body Item:** SkuId, StyleNo, Description, Color, Size, Quantity, **GTIN** (14-digit). *(LPN/GTIN info added Jul 2025.)*

---

## Brand Restrictions (updated v24.4)

Prohibited from sale on **Amazon, eBay, Etsy, Craigslist, or any other third-party or direct-to-consumer website** (without embellishment) — **13 brands**:

> Brooks Brothers · Carhartt · Cotopaxi · Eddie Bauer · New Era · Nike · OGIO · **Outdoor Research** · **Stanley/Stella** · **tentree** · The North Face · Tommy Bahama · Travis Mathew

(Bold = added since our prior doc.)

## MAP Pricing (rebuilt v24.4)

Customers may not advertise discounts greater than the brand's MAP tier. **No discount may be advertised on OGIO bags.**

| MAP tier | Brands |
|---|---|
| **10% off MSRP** | Alternative Apparel, Brooks Brothers, Bulwark, Champion, Cotopaxi, Eddie Bauer, New Era, Nike, OGIO, Outdoor Research, Red House, Red Kap, Richardson Apparel, Russell Outdoors, Spacecraft, Stanley/Stella, tentree, The North Face, Travis Mathew, Wink |
| **20% off MSRP** | AllMade, CornerStone (excl. Richardson caps below), District, Mercer+Mettle, Port & Company, Port Authority, Sport-Tek, Volunteer Knitwear |
| **25% off MSRP** | A4, Anvil, Bella+Canvas, Comfort Colors, Fruit of the Loom, Gildan, Jerzees, Next Level, Rabbit Skins |
| **MAP = $9.75** | Richardson caps: styles **115, 112 / 112FP, 112PFC / 112PFR** (carved out of CornerStone's 20%) |
| **MAP = MSRP** (no discount) | Carhartt, Nike Bags, Tommy Bahama |
| **No MAP** | *(empty in v24.4 — no brands listed)* |

> The "No MAP" column is empty: the basics/blanks brands are capped at **25% off**, not unrestricted. MSRP for these calculations = PromoStandards `getConfigurationAndPricing` with `priceType=List`, or the per-SKU `mapPrice` field from getProduct.

## GTIN (NEW)

GTINs (Global Trade Item Numbers) for these brands are in `SanMar_SDL_N.csv` and `SanMar_EPDD.csv` on the FTP server: A4, Allmade, Alternative, Anvil, Bella+Canvas, Brooks Brothers, Bulwark, Carhartt, Champion, Comfort Colors, CornerStone, Cotopaxi, District, Eddie Bauer, Fruit of the Loom, Gildan, Jerzees, Mercer+Mettle, Next Level, Nike, OGIO, Outdoor Research, Port & Co, Port Authority, Precious Cargo, Rabbit Skins, Red House, Red Kap, Russell Outdoors, Spacecraft, Sport-Tek, Stanley/Stella, tentree, The North Face, Tommy Bahama, TravisMathew, Volunteer Knitwear, Wink.

## Hemmed Pants (NEW)

SanMar does **not** provide integrated data or support integrated PO submittal for **hemmed pants** (extra sourcing/processing) — order via SanMar.com / phone / email. **Unhemmed** pants are fully supported in the integrated feed and PO submittal.

---

## PO Submission

PO **submission** (the outbound WRITE side — placing blank orders to SanMar) is documented separately in **[sanmar-po/README.md](./sanmar-po/README.md)** — feasibility/plan, Caspio→PO field mapping, onboarding checklist, and buildable PO templates (`submitPO` / `getPreSubmitInfo` SOAP skeletons + a JSON PO schema/sample). Reviewed 2026-06-23 from PO Integration Guide v24.3; 🟡 not built.

It requires a separate **Test environment** (renamed from "Edev" in Mar 2025), multi-line test order, and SanMar approval. Test orders are manually invoiced by SanMar in 24-48 hrs (email the integration team your test PO#s). Order **tracking** (Order Status V2 + Order Shipment Notification V1) is usable today with standard credentials — see *Order Tracking* above.

---

## Related Documentation

- [SHOPWORKS_SIZE_MAPPING.md](./SHOPWORKS_SIZE_MAPPING.md) — ShopWorks Import CSV analysis
- [SANMAR_TO_SHOPWORKS_GUIDE.md](./SANMAR_TO_SHOPWORKS_GUIDE.md) — SanMar → ShopWorks transform
- [SHOPWORKS_EXTENDED_SKU_PATTERNS.md](./SHOPWORKS_EXTENDED_SKU_PATTERNS.md) — Extended SKU suffixes
