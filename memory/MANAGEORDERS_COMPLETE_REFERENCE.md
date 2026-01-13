# ManageOrders API Complete Reference

The definitive guide to ShopWorks ManageOrders API usage across all NWCA projects. This document covers every field, endpoint, pattern, and gotcha discovered from production use.

**Last Updated:** 2026-01-11
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
| `time_from` | string | No | Time range start (HH-MM-SS) |
| `time_to` | string | No | Time range end (HH-MM-SS) |
| `api_source` | string | No | Filter: `"all"`, `"none"`, or specific source name |

**Response:** Array of OrderJson objects (orders you previously submitted)

**Use Case:** Verify orders were received, retrieve order data for reconciliation.

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
| `Color` | string | No | Color name | `"Red"` |
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

### Designs Array

Artwork/design information.

| Field | Type | Description |
|-------|------|-------------|
| `DesignName` | string | Design name |
| `ExtDesignID` | string | External design ID |
| `id_Design` | number | OnSite design ID |
| `id_DesignType` | number | Design type (3=standard, 45=DTG) |
| `id_Artist` | number | Artist assignment ID |
| `ForProductColor` | string | Applicable colors |
| `VendorDesignID` | string | Vendor's design ID |
| `CustomField01-05` | string | Custom fields |
| `Locations` | array | Print location details |

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
| PC54_2X | S | M | L | XL | **2XL** | - |
| PC54_3X | S | M | L | XL | 2XL | **3XL** |

**PC54_2X uses Size05 for 2XL, NOT Size06!**

---

## Size Modifier Reference

When creating line items, append the correct modifier to the base PartNumber:

| Size | Modifier | Example |
|------|----------|---------|
| S, M, L, XL | (none) | `PC54` |
| 2XL | `_2X` | `PC54_2X` |
| 3XL | `_3X` | `PC54_3X` |
| 4XL | `_4X` | `PC54_4X` |
| 5XL | `_5X` | `PC54_5X` |
| 6XL | `_6X` | `PC54_6X` |
| XXL | `_XXL` | `G500_XXL` |
| XS | `_XS` | `BC3001_XS` |
| OSFA | `_OSFA` | `C112_OSFA` |
| LT, XLT, 2XLT | `_LT`, `_XLT`, `_2XLT` | Tall sizes |
| YS, YM, YL | `_YS`, `_YM`, `_YL` | Youth sizes |

**IMPORTANT:** Use `_2X` NOT `_2XL`. ShopWorks is very particular about this format.

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

### 60-Day Data Limit Workaround

**Problem:** ManageOrders only retains ~60 days of data via the PULL API.

**Solution:** Archive daily sales to Caspio for YTD tracking.

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
| "Size modifier wrong" | Using _2XL | Use _2X format |

---

## ExtOrderID Prefixes

| Prefix | Source | Example |
|--------|--------|---------|
| `NWCA-` | Webstore orders | `NWCA-12345` |
| `NWCA-TEST-` | Test orders | `NWCA-TEST-12345` |
| `NWCA-3DT-` | 3-Day Tees | `NWCA-3DT-010125-12345` |
| `SAMPLE-` | Sample orders | `SAMPLE-0115-1-347` |
| (InkSoft ID) | InkSoft orders | `12345678` |

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
| Pricing Index | `/shared_components/js/manageorders-*.js` | PULL API services |
| caspio-proxy | `/src/routes/manageorders.js` | PULL API routes |
| caspio-proxy | `/lib/manageorders-push-client.js` | PUSH API client |
| caspio-proxy | `/lib/manageorders-push-auth.js` | Authentication |
| Python Inksoft | `/web/transform.py` | InkSoft→OnSite transform |
| Python Inksoft | `/web/stores.py` | Store configurations |

---

*This document is the single source of truth for ManageOrders API usage across all NWCA projects.*
