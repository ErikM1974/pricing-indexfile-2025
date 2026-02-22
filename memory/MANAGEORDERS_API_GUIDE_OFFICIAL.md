# ManageOrders API Guide — Official Field Reference

**Source:** ManageOrders API Guide v05.22.24 (ShopWorks, 37 pages)
**Created:** 2026-02-22
**Purpose:** Complete field lists from the official PDF for quick lookup when building PUSH payloads

For implementation details, patterns, and gotchas, see [MANAGEORDERS_COMPLETE_REFERENCE.md](./MANAGEORDERS_COMPLETE_REFERENCE.md).

---

## PULL API (8 Capabilities)

1. Orders by date range (`/manageorders/orders`)
2. Specific order by ID (`/manageorders/orders/{id}`)
3. Order by External Order ID (`/manageorders/getorderno/{ext_id}`)
4. Line items for order (`/manageorders/lineitems/{order_no}`)
5. Payments by date range (`/manageorders/payments`)
6. Payments for order (`/manageorders/payments/{order_no}`)
7. Tracking by date range (`/manageorders/tracking`)
8. Tracking for order (`/manageorders/tracking/{order_no}`)

**Date pairs:** If only start date provided, API assumes end = start. Multiple date pairs are AND-combined.

---

## PUSH API — Complete Field Structure

### Order Object (root)

| Field | Required | Description |
|-------|----------|-------------|
| `APISource` | | Alphanumeric filter value for pull queries |
| `ExtOrderID` * | **YES** | External order ID |
| `ExtSource` | | Source description |
| `id_Customer` | Conditional | OnSite customer ID (fallback if no ExtCustomerID) |
| `id_CompanyLocation` | | Location ID (default from OnSite settings) |
| `id_EmpCreatedBy` | | Employee ID (default from OnSite settings) |
| `id_OrderType` | | Order type ID (default from OnSite settings) |
| `ExtCustomerID` | | External customer ID (**takes precedence** over id_Customer) |
| `ExtCustomerPref` | | Appended to ExtCustomerID for new customer uniqueness |
| `date_OrderPlaced` | | Order date |
| `date_OrderRequestedToShip` | | Required ship date |
| `date_OrderDropDead` | | Drop-dead date |
| `ContactEmail` | | Order contact email |
| `ContactNameFirst` | | Order contact first name |
| `ContactNameLast` | | Order contact last name |
| `ContactPhone` | | Order contact phone |
| `CustomerPurchaseOrder` | | Customer PO number |
| `CustomerServiceRep` | | Salesperson name |
| `id_SalesStatus` | | Sales status ID (OnSite 12+) |
| `id_ReceivingStatus` | | Receiving status ID (OnSite 12+) |
| `id_ShippingStatus` | | Shipping status ID (OnSite 12+) |
| `OnHold` | | `"1"` = on hold, `"0"` or blank = not |
| `Terms` | | Payment terms (must match OnSite value) |
| `DiscountPartNumber` | | Part number for discount line item |
| `DiscountPartDescription` | | Description for discount line item |
| `TaxTotal` | | Sales tax total (applied as single line item) |
| `cur_Shipping` | | Total shipping amount |
| `TotalDiscounts` | | Total discount amount (creates discount line item) |

### Customer Object (nested, for new customer creation only)

| Field | Description |
|-------|-------------|
| `BillingCompany` | Billing company name |
| `BillingAddress01` | Billing street address |
| `BillingAddress02` | Additional billing address |
| `BillingCity` | Billing city |
| `BillingState` | Billing state/province |
| `BillingZip` | Billing postal code |
| `BillingCountry` | Billing country |
| `CompanyName` | Customer company name |
| `CustomDateField01-04` | Custom date fields (dates only) |
| `CustomField01-06` | Custom text fields |
| `CustomerReminderInvoiceNotes` | Pop-up reminder when order is invoiced |
| `CustomerSource` | Lead source (trade show, website, etc.) |
| `CustomerType` | Classification (school, large business, etc.) |
| `InvoiceNotes` | Printed on invoices for this customer |
| `MainEmail` | Primary email address |
| `SalesGroup` | Sales group assignment |
| `TaxExempt` | `"1"` = exempt, `"0"` = not |
| `TaxExemptNumber` | Tax exempt certificate number |
| `Website` | Customer website URL |

### Designs Array (multiple per order)

| Field | Description |
|-------|-------------|
| `CustomField01-05` | Design-specific custom values |
| `DesignName` | Name of the design |
| `ExtDesignID` | External design ID (used if no id_Design; creates new if not found) |
| `VendorDesignID` | Vendor's design ID |
| `id_Artist` | OnSite artist/user ID (default from settings) |
| `id_Customer` | Customer ID for design ownership |
| `id_Design` | OnSite design ID (**takes precedence** over ExtDesignID) |
| `id_DesignType` | Design type ID (default from settings) |

**Precedence:** `id_Design` > `ExtDesignID`. If `id_Design` matches an OnSite design, all other JSON values for that design are ignored.

#### Design Locations (nested array per design)

| Field | Description |
|-------|-------------|
| `CustomField01-05` | Location-specific custom values |
| `DesignCode` | Secondary design ID (reference only) |
| `ImageURL` | Thumbnail URL (max 2MB, .jpg/.png recommended) |
| `Location` | Embellishment location description |
| `Notes` | Location-specific notes |
| `TotalColors` | Color count (screen printing) |
| `FlashesTotal` | Flash count (screen printing) |
| `StitchesTotal` | Stitch count (embroidery) |

If no locations provided, defaults are created from DesignType settings.

#### Location Details (nested array per location)

| Field | Description |
|-------|-------------|
| `ThreadBreak` | Thread break description (embroidery) |
| `Color` | Ink/thread color description |
| `CustomField01-05` | Detail-specific custom values |
| `ParameterLabel` | Parameter name (digital designs) |
| `ParameterValue` | Parameter value (links auto-created for URLs/emails) |
| `Text` | Text content (text design types only) |

### LinesOE Array (line items, multiple per order)

| Field | Description |
|-------|-------------|
| `PartNumber` * | Product SKU with size modifier |
| `Description` | Product description |
| `DisplayAsPartNumber` | Invoice display override for part number |
| `DisplayAsDescription` | Invoice display override for description |
| `Color` | Product color |
| `Size` | Size value (**must match OnSite translation table**) |
| `Qty` * | Quantity |
| `Price` * | Unit price |
| `ExtShipID` | Links to ShippingAddress (omit = no address, empty = shipping off) |
| `DesignIDBlock` | OnSite design IDs, comma-separated (omit = all designs) |
| `ExtDesignIDBlock` | External design IDs, comma-separated (omit = all designs) |
| `CustomField01-05` | Line item custom values |
| `NameFirst` | Player/person first name |
| `NameLast` | Player/person last name |
| `LineItemNotes` | Invoice-specific line item notes |
| `WorkOrderNotes` | Work order-specific line item notes |
| `id_ProductClass` | OnSite product class ID (default from settings) |

### Notes Array (multiple per order)

| Field | Description |
|-------|-------------|
| `Note` | Note content |
| `Type` | One of: `Notes On Order`, `Notes To Art`, `Notes To Purchasing`, `Notes To Subcontract`, `Notes To Production`, `Notes To Receiving`, `Notes To Shipping`, `Notes To Accounting`, `Notes On Customer` (new customers only) |

### Payments Array (multiple per order)

| Field | Description |
|-------|-------------|
| `Date_Payment` * | Payment date |
| `AccountNumber` | Account number |
| `Amount` * | Payment amount |
| `AuthCode` | Bank authorization code |
| `CreditCardCompany` | Card issuer name |
| `Gateway` | Payment gateway name |
| `ResponseCode` | Transaction status code |
| `ResponseReasonCode` | Detailed reason code |
| `ResponseReasonText` | Status description |
| `Status` | Only `"success"` creates actual payment records |

### ShippingAddresses Array (multiple per order)

| Field | Description |
|-------|-------------|
| `ShipCompany` | Ship-to company |
| `ShipMethod` | Shipping method |
| `ShippingAddress01` | Street address line 1 |
| `ShippingAddress02` | Street address line 2 |
| `ShipCity` | City |
| `ShipState` | State/province |
| `ShipZip` | Postal code |
| `ShipCountry` | Country |
| `ExtShipID` | Links to line items via matching ExtShipID |

### Attachments Array (multiple per order)

| Field | Description |
|-------|-------------|
| `MediaURL` | Download URL (max 2MB, takes precedence over LinkURL) |
| `MediaName` | Downloaded file name |
| `LinkURL` | External link (stored as URL, not downloaded) |
| `LinkNote` | Link description |
| `Link` | Must be `"1"` if LinkURL is used |

---

## Tracking PUSH API

**URL:** `POST https://manageordersapi.com/onsite/track-push`
**Requires:** OnSite v12+. Authentication via `/onsite/signin` → use `id_token` as Bearer.

| Field | Description |
|-------|-------------|
| `APISource` | Filter value for tracking pull queries |
| `ExtOrderID` | External order ID |
| `Name` | Shipping contact |
| `Address01` | Street address line 1 |
| `Address02` | Street address line 2 |
| `City` | City |
| `State` | State/province |
| `Zip` | Postal code |
| `Country` | Country |
| `Tracking` | Tracking number |
| `Weight` | Package weight |
| `Date_Shipped` | Ship date (**MM/DD/YYYY** format) |

## Tracking PULL API

**URL:** `GET https://manageordersapi.com/onsite/track-pull`

| Parameter | Description |
|-----------|-------------|
| `date_from` | Start date (YYYY-MM-DD) |
| `date_to` | End date (YYYY-MM-DD) |
| `time_from` | Start time (HH:MM:SS) |
| `time_to` | End time (HH:MM:SS) |
| `api_source` | Filter by API source |
