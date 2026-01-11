# ManageOrders CRM & Order Entry Capability Reference

**Last Updated:** 2026-01-11
**Purpose:** Complete reference for building CRM/Order Entry systems with ManageOrders + Caspio
**Status:** VERIFIED 100% CAPABLE

---

## Quick Summary

**Can we build a complete Order Entry System / CRM?** **YES - 100% CAPABLE**

The infrastructure exists and is proven in production (3-Day Tees). This document serves as the definitive reference for understanding every capability.

---

## PART 1: COMPLETE FIELD GLOSSARY

### Date Fields

| Field | API Name | Meaning | When Populated |
|-------|----------|---------|----------------|
| **Date Ordered** | `date_Ordered` | When order was placed in system | Order creation |
| **Date Invoiced** | `date_Invoiced` | When invoice was created/revenue recognized | When order invoiced |
| **Date Ship (Requested)** | `date_RequestedToShip` | Customer's requested ship date | Order creation |
| **Date Shipped** | `date_Shippied` (⚠️ typo in API) | Actual ship date | When carrier picks up |
| **Date Produced** | `date_Produced` | Production completion date | After production done |
| **Date Payment Applied** | `date_PaymentApplied` | When payment was recorded | Payment entry |
| **Date Creation** | `date_Creation` | Record creation timestamp | Auto on create |
| **Date Modification** | `date_Modification` | Last modification timestamp | Auto on update |

### Order Identification Fields

| Field | API Name | Meaning | Example |
|-------|----------|---------|---------|
| **Order ID** | `id_Order` | Unique ShopWorks order ID (primary key) | `139972` |
| **Order Number** | `order_no` | Human-readable order number | `138145` |
| **External Order ID** | `ext_order_id` / `ExtOrderID` | ID from external system | `NWCA-52083` |
| **Customer PO** | `CustomerPurchaseOrder` | Customer's purchase order number | `PO-2026-001` |
| **URL ID** | `id_URL` | Hash for customer portal links | `abc123xyz` |
| **Customer ID** | `id_Customer` | Customer record ID | `12279` |

### Status Fields

All status fields use consistent encoding: **0=No, 1=Yes, .5=Partial, 8=N/A, 222=N/A**

| Field | API Name | Meaning |
|-------|----------|---------|
| **Art Done** | `sts_ArtDone` | Design/artwork approval completed |
| **Purchased** | `sts_Purchased` | Materials purchased from vendor |
| **Purchased Sub** | `sts_PurchasedSub` | Subcontract materials purchased |
| **Received** | `sts_Received` | Materials received from vendor |
| **Received Sub** | `sts_ReceivedSub` | Subcontract materials received |
| **Produced** | `sts_Produced` | Production completed |
| **Shipped** | `sts_Shipped` | Order shipped |
| **Invoiced** | `sts_Invoiced` | Invoice created |
| **Paid** | `sts_Paid` | Payment received in full |

### Financial Fields

| Field | API Name | Meaning | Example |
|-------|----------|---------|---------|
| **Subtotal** | `cur_SubTotal` | Order subtotal before tax/shipping | `150.00` |
| **Shipping** | `cur_Shipping` | Shipping charges | `15.00` |
| **Sales Tax** | `cur_SalesTaxTotal` | Tax amount | `12.50` |
| **Total Invoice** | `cur_TotalInvoice` | Grand total | `177.50` |
| **Payments** | `cur_Payments` | Total payments received | `177.50` |
| **Balance** | `cur_Balance` | Outstanding balance | `0.00` |
| **Adjustment** | `cur_Adjustment` | Price adjustments | `-10.00` |

### Customer Fields

| Field | API Name | Meaning |
|-------|----------|---------|
| **Customer Name** | `CustomerName` | Company/business name |
| **Contact First** | `ContactFirstName` | Primary contact first name |
| **Contact Last** | `ContactLastName` | Primary contact last name |
| **Contact Email** | `ContactEmail` | Primary contact email |
| **Contact Phone** | `ContactPhone` | Primary contact phone (auto-cleaned) |
| **Sales Rep** | `CustomerServiceRep` | Assigned sales representative |

### Line Item Fields

| Field | API Name | Meaning |
|-------|----------|---------|
| **Part Number** | `PartNumber` | Product SKU (e.g., `PC54`) |
| **Description** | `PartDescription` | Product name |
| **Color** | `PartColor` | Product color |
| **Quantity** | `LineQuantity` | Total pieces |
| **Unit Price** | `LineUnitPrice` | Price per unit |
| **Size01-06** | `Size01`-`Size06` | Quantity per size column |
| **Name** | `Name` | Player/personalization name |
| **Invoice Notes** | `InvoiceNotes` | Notes displayed on invoice |
| **Custom01-05** | `Custom01`-`Custom05` | Custom line item fields |

### Inventory Fields

| Field | API Name | Meaning |
|-------|----------|---------|
| **Part Number** | `PartNumber` | Product SKU |
| **Color** | `Color` | Product color (display name) |
| **Color Range** | `ColorRange` | Color category |
| **Size01-06** | `Size01`-`Size06` | Stock quantity per size |
| **SKU** | `SKU` | Full SKU code |
| **Unit Cost** | `UnitCost` | Cost per unit |
| **Total Cost** | `TotalCost` | Total inventory value |
| **Vendor** | `VendorName` | Supplier name |
| **Warehouse** | Location identifier |

### Payment Fields

| Field | API Name | Meaning |
|-------|----------|---------|
| **Payment ID** | `id_SubPayment` | Unique payment record ID |
| **Payment Type** | `PaymentType` | Method (Visa, Mastercard, Check, EFT) |
| **Payment Number** | `PaymentNumber` | Check #, last 4 of card, or reference |
| **Amount** | `Amount` | Payment amount |
| **Date Applied** | `date_PaymentApplied` | When payment was applied |

### Tracking Fields

| Field | API Name | Meaning |
|-------|----------|---------|
| **Tracking Number** | `TrackingNumber` | Carrier tracking number |
| **Weight** | `Weight` | Package weight (lbs) |
| **Cost** | `Cost` | Shipping cost |
| **Type** | `Type` | Carrier (UPS, FedEx, USPS) |
| **Ship Address** | `Address1`, `AddressCity`, etc. | Destination |

---

## PART 2: API ENDPOINTS REFERENCE

### PULL API (Read from ShopWorks)

| Endpoint | Method | Purpose | Cache |
|----------|--------|---------|-------|
| `/api/manageorders/customers` | GET | Customer list (60-day lookback) | 24hr |
| `/api/manageorders/orders` | GET | Orders by date range | 1hr |
| `/api/manageorders/orders/:order_no` | GET | Single order details | None |
| `/api/manageorders/getorderno/:ext_id` | GET | External ID → ShopWorks ID | None |
| `/api/manageorders/lineitems/:order_no` | GET | Line items with size breakdown | None |
| `/api/manageorders/payments` | GET | Payments by date range | None |
| `/api/manageorders/payments/:order_no` | GET | Payments for single order | None |
| `/api/manageorders/tracking` | GET | Tracking by date range | 15min |
| `/api/manageorders/tracking/:order_no` | GET | Tracking for single order | 15min |
| `/api/manageorders/inventorylevels` | GET | Real-time warehouse inventory | 5min |

### PUSH API (Write to ShopWorks)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/manageorders/orders/create` | POST | Create new order |
| `/api/manageorders/orders/verify/:extOrderId` | GET | Verify order received |
| `/api/manageorders/auth/test` | POST | Test authentication |
| `/api/manageorders/push/health` | GET | Health check |
| `/api/manageorders/tracking/push` | POST | Push tracking number |
| `/api/manageorders/tracking/pull` | GET | Pull tracking data |
| `/api/manageorders/tracking/verify/:extOrderId` | GET | Verify tracking |

### File API (Artwork/Attachments)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/files/upload` | POST | Upload file to Caspio |
| `/api/files/:externalKey` | GET | Download file |
| `/api/files/:externalKey/info` | GET | File metadata |
| `/api/files/:externalKey` | DELETE | Delete file |

---

## PART 3: STRIPE PAYMENT FLOW

### Complete Flow

```
Customer Checkout → Caspio Save → Stripe Session → Payment → Webhook → ManageOrders → ShopWorks
```

### Key Code Locations (Pricing Index server.js)

| Step | File:Line | Purpose |
|------|-----------|---------|
| Create Session | server.js:869-982 | Create Stripe Checkout Session |
| Webhook Handler | server.js:178-317 | Process payment events |
| Order Submission | server.js:1046-1337 | Build ManageOrders payload |
| Payment Payload | server.js:1281-1292 | Payment array structure |

### Payment Payload Structure

```javascript
payments: [{
  date: '2026-01-11',           // YYYY-MM-DD format
  amount: 156.78,                // Dollars (not cents!)
  status: 'success',             // MUST be "success"
  gateway: 'Stripe',
  authCode: 'cs_live_xxx',       // Stripe session ID
  accountNumber: 'cs_live_xxx',
  cardCompany: 'Stripe Checkout',
  responseCode: 'approved',
  responseReasonCode: 'checkout_complete',
  responseReasonText: 'Payment completed via Stripe Checkout'
}]
```

### Critical Notes

1. **Payment status MUST be "success"** or payment won't be recorded in ShopWorks
2. **Amount is in dollars** (convert from Stripe cents: `amount_total / 100`)
3. **Webhook signature verification** is required for security
4. **Idempotency** - check Caspio status before processing to prevent duplicates

---

## PART 4: ARTWORK UPLOAD FLOW

### Complete Flow

```
Customer Upload → Proxy Validation → Caspio Files API → URL Generation → Order Attachment → ShopWorks
```

### Supported File Types (20+)

- **Images:** PNG, JPG, GIF, SVG, WebP
- **Design Files:** AI, PSD, EPS, INDD, CDR
- **Documents:** PDF, DOCX, XLSX
- **Compressed:** ZIP, RAR

### Size Limits

- **Max per file:** 20MB
- **Files per order:** Unlimited
- **Caspio folder:** `b91133c3-4413-4cb9-8337-444c730754dd`

### Attachment Structures

**Designs Array (Production View):**
```javascript
designs: [{
  name: 'ORDER-123 - Customer Logo',
  locations: [{
    location: 'Left Chest',
    colors: 'Full Color',
    imageUrl: 'https://caspio-pricing-proxy.../api/files/abc123',
    notes: 'Customer uploaded artwork'
  }]
}]
```

**Attachments Array (All Staff View):**
```javascript
attachments: [{
  mediaUrl: 'https://caspio-pricing-proxy.../api/files/abc123',
  mediaName: 'ORDER-123 - Front Artwork',
  linkNote: 'Customer uploaded artwork (front)'
}]
```

---

## PART 5: CRM CAPABILITIES

### What's Available NOW

| Capability | Endpoint | Status |
|------------|----------|--------|
| Customer Lookup | `/api/manageorders/customers` | ✅ Ready |
| Customer Autocomplete | Smart search | ✅ In production |
| Order History | `/api/manageorders/orders?id_Customer=X` | ✅ Ready |
| Order Details | `/api/manageorders/orders/:order_no` | ✅ Ready |
| Line Items | `/api/manageorders/lineitems/:order_no` | ✅ Ready |
| Payment History | `/api/manageorders/payments/:order_no` | ✅ Ready |
| Shipment Tracking | `/api/manageorders/tracking/:order_no` | ✅ Ready |
| Real-time Inventory | `/api/manageorders/inventorylevels` | ✅ Ready |
| Order Creation | `POST /api/manageorders/orders/create` | ✅ Ready |
| File Upload | `/api/files/upload` | ✅ Ready |
| Stripe Payments | Checkout Sessions | ✅ Ready |
| Quote Storage | Caspio quote_sessions | ✅ Ready |

### What Needs UI Only

| Feature | Backend | UI Status |
|---------|---------|-----------|
| Order Entry Form | ✅ Ready | Needs build |
| Order Dashboard | ✅ Ready | Needs build |
| Customer Search UI | ✅ Ready | Exists in quote builders |
| Product Catalog | ✅ Ready | Needs build |
| Order Detail View | ✅ Ready | Needs build |

---

## PART 6: CASPIO DATA STORAGE

### Tables

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `quote_sessions` | Quote headers | QuoteID, CustomerEmail, Status, TotalAmount |
| `quote_items` | Quote line items | QuoteID, StyleNumber, Color, Quantity, Price |
| `Customers` | Customer master | Name, Email, Phone, Company |
| `Inventory` | SanMar stock | PartNumber, Color, Size01-06, Warehouse |

### Quote Session Fields

| Field | Type | Purpose |
|-------|------|---------|
| `QuoteID` | String | Unique ID (e.g., `3DT-0111-001`) |
| `SessionID` | String | Stripe session reference |
| `CustomerEmail` | String | Customer email |
| `CustomerName` | String | Customer full name |
| `CompanyName` | String | Company name |
| `TotalAmount` | Number | Grand total |
| `Status` | String | Checkout Created / Payment Confirmed / Processed |
| `CustomerDataJSON` | JSON | Full customer data blob |
| `ColorConfigsJSON` | JSON | Size/color selections |
| `OrderTotalsJSON` | JSON | Pricing breakdown |
| `OrderSettingsJSON` | JSON | Print location, artwork URLs |

---

## PART 7: ADDITIONAL FEATURE IDEAS

### Customer Management
- Credit limit tracking
- Payment terms (Net 10, Net 30, COD)
- Customer price lists
- Sales rep commissions
- Customer portal

### Order Enhancements
- Reorder from previous
- Order templates
- Bulk CSV import
- Multi-ship addresses
- Rush order flags

### Inventory Features
- Low stock alerts
- Back-order management
- Inventory reservation
- Warehouse transfers
- Auto-reorder triggers

### Automation
- Order confirmation emails (EmailJS ready)
- Shipping notifications
- Invoice delivery
- Payment reminders
- Satisfaction surveys

---

## CONCLUSION

**VERIFIED: Complete Order Entry System / CRM is 100% achievable.**

The backend infrastructure is complete and proven in production (3-Day Tees). Building additional CRM features requires only UI development - all APIs, authentication, caching, and data flows are ready.

### Success Pattern (3-Day Tees Proof)

1. ✅ Customer goes online
2. ✅ Uploads artwork (to Caspio)
3. ✅ Selects products (with inventory check)
4. ✅ Enters payment info (Stripe)
5. ✅ Order created in ShopWorks (ManageOrders PUSH)
6. ✅ Payment recorded in ShopWorks
7. ✅ Artwork attached for production

This exact flow works TODAY and can be replicated for any order entry scenario.

---

## Related Documentation

| Document | Location | Purpose |
|----------|----------|---------|
| ManageOrders PUSH Integration | `../caspio-pricing-proxy/memory/MANAGEORDERS_PUSH_INTEGRATION.md` | Full PUSH API docs |
| ManageOrders PUSH Template | `../caspio-pricing-proxy/memory/MANAGEORDERS_PUSH_TEMPLATE.md` | Order payload template |
| 3-Day Tees Order Flow | `memory/3-day-tees/ORDER_PUSH_FLOW.md` | Proven implementation |
| Field Glossary | This document | Complete field reference |

---

**Document Type:** Reference Guide
**Last Verified:** January 2026
