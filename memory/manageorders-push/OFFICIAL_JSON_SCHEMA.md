# ManageOrders External Order JSON Documentation

This document describes the JSON structure used for creating and managing orders in the ManageOrders system via external integrations.

## Overview

The `ExternalOrderJson` object is the root structure for submitting orders from external sources (e.g., e-commerce platforms, custom order forms) into the ManageOrders system.

---

## Root Object: `ExternalOrderJson`

### Order Identification & Source

| Field | Type | Description |
|-------|------|-------------|
| `ExtOrderID` | string | External system's unique order identifier |
| `ExtSource` | string | Name/identifier of the external source system |
| `ExtCustomerID` | string | Customer ID from the external system |
| `ExtCustomerPref` | string | Customer preference identifier from external system |

### Order Dates

| Field | Type | Description |
|-------|------|-------------|
| `date_OrderPlaced` | string | Date the order was placed |
| `date_OrderRequestedToShip` | string | Requested ship date |
| `date_OrderDropDead` | string | Final deadline date (order must ship by this date) |

### Internal Reference IDs

| Field | Type | Description |
|-------|------|-------------|
| `id_OrderType` | number | Order type identifier |
| `id_EmpCreatedBy` | number | Employee ID who created the order |
| `id_Customer` | number | Internal customer ID |
| `id_CompanyLocation` | number | Company location identifier |
| `id_SalesStatus` | number | Current sales status ID |
| `id_ReceivingStatus` | number | Current receiving status ID |
| `id_ShippingStatus` | number | Current shipping status ID |

### Contact Information

| Field | Type | Description |
|-------|------|-------------|
| `ContactEmail` | string | Order contact email address |
| `ContactNameFirst` | string | Contact first name |
| `ContactNameLast` | string | Contact last name |
| `ContactPhone` | string | Contact phone number |

### Order Details

| Field | Type | Description |
|-------|------|-------------|
| `CustomerPurchaseOrder` | string | Customer's PO number |
| `CustomerSeviceRep` | string | Assigned customer service representative |
| `OnHold` | number | Hold status flag (0 = not on hold, 1 = on hold) |
| `Terms` | string | Payment terms |
| `DiscountPartNumber` | string | Part number for discount applied |
| `DiscountPartDescription` | string | Description of discount |

### Financial Fields

| Field | Type | Description |
|-------|------|-------------|
| `cur_Shipping` | number | Shipping cost (currency) |
| `TaxTotal` | number | Total tax amount |
| `TotalDiscounts` | number | Total discounts applied |

---

## Nested Object: `Customer`

Customer billing and company information.

### Company Information

| Field | Type | Description |
|-------|------|-------------|
| `CompanyName` | string | Customer's company name |
| `CustomerSource` | string | How the customer was acquired |
| `CustomerType` | string | Classification of customer |
| `InvoiceNotes` | string | Notes to appear on invoices |
| `MainEmail` | string | Primary email address |
| `SalesGroup` | string | Sales group assignment |
| `WebSite` | string | Customer website URL |

### Tax Information

| Field | Type | Description |
|-------|------|-------------|
| `TaxExempt` | string | Tax exempt status |
| `TaxExemptNumber` | string | Tax exemption certificate number |

### Custom Fields

| Field | Type | Description |
|-------|------|-------------|
| `CustomDateField01` - `CustomDateField04` | string | Custom date fields for flexible data storage |
| `CustomField01` - `CustomField06` | string | Custom text fields for flexible data storage |
| `CustomerReminderInvoiceNotes` | string | Reminder notes for invoicing |

### Billing Address

| Field | Type | Description |
|-------|------|-------------|
| `BillingCompany` | string | Billing company name (if different) |
| `BillingAddress01` | string | Billing address line 1 |
| `BillingAddress02` | string | Billing address line 2 |
| `BillingCity` | string | Billing city |
| `BillingState` | string | Billing state/province |
| `BillingZip` | string | Billing postal code |
| `BillingCountry` | string | Billing country |

---

## Array: `Designs[]`

Array of design objects associated with the order.

### Design Root Fields

| Field | Type | Description |
|-------|------|-------------|
| `DesignName` | string | Name of the design |
| `ExtDesignID` | string | External system's design identifier |
| `id_Design` | number | Internal design ID |
| `id_DesignType` | number | Design type identifier (embroidery, screen print, DTG, etc.) |
| `id_Artist` | number | Assigned artist ID |
| `ForProductColor` | string | Product color this design is intended for |
| `VendorDesignID` | string | Vendor's design reference ID |
| `CustomField01` - `CustomField05` | string | Custom fields for design metadata |

### Nested Array: `Locations[]`

Each design can have multiple decoration locations.

| Field | Type | Description |
|-------|------|-------------|
| `Location` | string | Location name (e.g., "Left Chest", "Full Back") |
| `TotalColors` | string | Number of colors in this location |
| `TotalFlashes` | string | Number of flashes (screen printing) |
| `TotalStitches` | string | Stitch count (embroidery) |
| `DesignCode` | string | Design code/reference |
| `CustomField01` - `CustomField05` | string | Custom location fields |
| `ImageURL` | string | URL to design proof/mockup image |
| `Notes` | string | Location-specific notes |

### Nested Array: `LocationDetails[]`

Detailed breakdown of each location (colors, threads, text, etc.).

| Field | Type | Description |
|-------|------|-------------|
| `Color` | string | Color name or value |
| `ThreadBreak` | string | Thread break information (embroidery) |
| `ParameterLabel` | string | Custom parameter label |
| `ParameterValue` | string | Custom parameter value |
| `Text` | string | Text content (for text-based designs) |
| `CustomField01` - `CustomField05` | string | Custom detail fields |

---

## Array: `LinesOE[]`

Order line items (products being ordered).

| Field | Type | Description |
|-------|------|-------------|
| `PartNumber` | string | Product part/SKU number |
| `Color` | string | Product color |
| `Description` | string | Product description |
| `Size` | string | Product size |
| `Qty` | string | Quantity ordered |
| `Price` | string | Unit price |
| `id_ProductClass` | number | Product classification ID |
| `CustomField01` - `CustomField05` | string | Custom line item fields |
| `NameFirst` | string | Personalization first name |
| `NameLast` | string | Personalization last name |
| `LineItemNotes` | string | Notes for this line item |
| `WorkOrderNotes` | string | Production/work order notes |
| `ExtDesignIDBlock` | string | External design ID reference block |
| `DesignIDBlock` | string | Internal design ID reference block |
| `ExtShipID` | string | External shipping ID (for split shipments) |
| `DisplayAsPartNumber` | string | Override display part number |
| `DisplayAsDescription` | string | Override display description |

---

## Array: `Notes[]`

Order-level notes.

| Field | Type | Description |
|-------|------|-------------|
| `Note` | string | Note content |
| `Type` | string | Note type/category |

---

## Array: `Payments[]`

Payment records associated with the order.

| Field | Type | Description |
|-------|------|-------------|
| `date_Payment` | string | Payment date |
| `AccountNumber` | string | Account/card number (masked) |
| `Amount` | number | Payment amount |
| `AuthCode` | string | Authorization code |
| `CreditCardCompany` | string | Card type (Visa, MC, etc.) |
| `Gateway` | string | Payment gateway used |
| `ResponseCode` | string | Gateway response code |
| `ResponseReasonCode` | string | Detailed response reason code |
| `ResponseReasonText` | string | Human-readable response message |
| `Status` | string | Payment status |
| `FeeOther` | number | Other fees |
| `FeeProcessing` | number | Processing fees |

---

## Array: `ShippingAddresses[]`

Shipping destinations (supports multiple ship-to addresses).

| Field | Type | Description |
|-------|------|-------------|
| `ShipCompany` | string | Ship-to company name |
| `ShipMethod` | string | Shipping method/carrier |
| `ShipAddress01` | string | Ship-to address line 1 |
| `ShipAddress02` | string | Ship-to address line 2 |
| `ShipCity` | string | Ship-to city |
| `ShipState` | string | Ship-to state/province |
| `ShipZip` | string | Ship-to postal code |
| `ShipCountry` | string | Ship-to country |
| `ExtShipID` | string | External shipping ID (links to LinesOE for split shipments) |

---

## Array: `Attachments[]`

File attachments and links associated with the order.

| Field | Type | Description |
|-------|------|-------------|
| `MediaURL` | string | URL to media file |
| `MediaName` | string | Display name for media |
| `LinkURL` | string | External link URL |
| `LinkNote` | string | Notes about the link |
| `Link` | number | Link type identifier |

---

## Example JSON Structure

```json
{
  "ExtOrderID": "WEB-12345",
  "ExtSource": "Shopify",
  "ExtCustomerID": "CUST-789",
  "ExtCustomerPref": "",
  "date_OrderPlaced": "2024-01-15",
  "date_OrderRequestedToShip": "2024-01-22",
  "date_OrderDropDead": "2024-01-25",
  "id_OrderType": 1,
  "id_EmpCreatedBy": 100,
  "id_Customer": 5432,
  "id_CompanyLocation": 1,
  "id_SalesStatus": 2,
  "id_ReceivingStatus": 1,
  "id_ShippingStatus": 1,
  "ContactEmail": "john.doe@example.com",
  "ContactNameFirst": "John",
  "ContactNameLast": "Doe",
  "ContactPhone": "555-123-4567",
  "CustomerPurchaseOrder": "PO-2024-001",
  "CustomerSeviceRep": "Jane Smith",
  "OnHold": 0,
  "Terms": "Net 30",
  "DiscountPartNumber": "",
  "DiscountPartDescription": "",
  "cur_Shipping": 15.99,
  "TaxTotal": 12.50,
  "TotalDiscounts": 0,
  "Customer": {
    "CompanyName": "ABC Corporation",
    "CustomerSource": "Web",
    "CustomerType": "Commercial",
    "InvoiceNotes": "",
    "MainEmail": "orders@abccorp.com",
    "SalesGroup": "Corporate",
    "TaxExempt": "N",
    "TaxExemptNumber": "",
    "WebSite": "https://abccorp.com",
    "CustomDateField01": "",
    "CustomDateField02": "",
    "CustomDateField03": "",
    "CustomDateField04": "",
    "CustomField01": "",
    "CustomField02": "",
    "CustomField03": "",
    "CustomField04": "",
    "CustomField05": "",
    "CustomField06": "",
    "CustomerReminderInvoiceNotes": "",
    "BillingCompany": "ABC Corporation",
    "BillingAddress01": "123 Main Street",
    "BillingAddress02": "Suite 100",
    "BillingCity": "Seattle",
    "BillingState": "WA",
    "BillingZip": "98101",
    "BillingCountry": "USA"
  },
  "Designs": [
    {
      "DesignName": "Company Logo",
      "ExtDesignID": "DES-001",
      "id_Design": 0,
      "id_DesignType": 1,
      "id_Artist": 0,
      "ForProductColor": "Navy",
      "VendorDesignID": "",
      "CustomField01": "",
      "CustomField02": "",
      "CustomField03": "",
      "CustomField04": "",
      "CustomField05": "",
      "Locations": [
        {
          "Location": "Left Chest",
          "TotalColors": "3",
          "TotalFlashes": "0",
          "TotalStitches": "8500",
          "DesignCode": "LC-LOGO-001",
          "CustomField01": "",
          "CustomField02": "",
          "CustomField03": "",
          "CustomField04": "",
          "CustomField05": "",
          "ImageURL": "https://example.com/proofs/logo-lc.png",
          "Notes": "",
          "LocationDetails": [
            {
              "Color": "Navy",
              "ThreadBreak": "N",
              "ParameterLabel": "",
              "ParameterValue": "",
              "Text": "",
              "CustomField01": "",
              "CustomField02": "",
              "CustomField03": "",
              "CustomField04": "",
              "CustomField05": ""
            }
          ]
        }
      ]
    }
  ],
  "LinesOE": [
    {
      "PartNumber": "PC61",
      "Color": "Navy",
      "Description": "Port & Company Essential Tee",
      "Size": "L",
      "Qty": "25",
      "Price": "8.50",
      "id_ProductClass": 1,
      "CustomField01": "",
      "CustomField02": "",
      "CustomField03": "",
      "CustomField04": "",
      "CustomField05": "",
      "NameFirst": "",
      "NameLast": "",
      "LineItemNotes": "",
      "WorkOrderNotes": "",
      "ExtDesignIDBlock": "DES-001",
      "DesignIDBlock": "",
      "ExtShipID": "SHIP-001",
      "DisplayAsPartNumber": "",
      "DisplayAsDescription": ""
    }
  ],
  "Notes": [
    {
      "Note": "Customer requested gift wrapping",
      "Type": "Production"
    }
  ],
  "Payments": [
    {
      "date_Payment": "2024-01-15",
      "AccountNumber": "****1234",
      "Amount": 240.99,
      "AuthCode": "ABC123",
      "CreditCardCompany": "Visa",
      "Gateway": "Authorize.net",
      "ResponseCode": "1",
      "ResponseReasonCode": "1",
      "ResponseReasonText": "Approved",
      "Status": "Approved",
      "FeeOther": 0,
      "FeeProcessing": 7.23
    }
  ],
  "ShippingAddresses": [
    {
      "ShipCompany": "ABC Corporation",
      "ShipMethod": "UPS Ground",
      "ShipAddress01": "456 Corporate Blvd",
      "ShipAddress02": "",
      "ShipCity": "Bellevue",
      "ShipState": "WA",
      "ShipZip": "98004",
      "ShipCountry": "USA",
      "ExtShipID": "SHIP-001"
    }
  ],
  "Attachments": [
    {
      "MediaURL": "https://example.com/files/logo.ai",
      "MediaName": "Original Logo File",
      "LinkURL": "",
      "LinkNote": "Vector artwork from customer",
      "Link": 0
    }
  ]
}
```

---

## Usage Notes

1. **External ID Linking**: Use `ExtOrderID`, `ExtCustomerID`, `ExtDesignID`, and `ExtShipID` to maintain relationships with external systems.

2. **Split Shipments**: Link line items to specific shipping addresses using matching `ExtShipID` values in both `LinesOE` and `ShippingAddresses`.

3. **Design Assignment**: Connect line items to designs using `ExtDesignIDBlock` or `DesignIDBlock` fields.

4. **Custom Fields**: All custom fields (`CustomField01` through `CustomField05/06`) can be used for client-specific data requirements.

5. **Date Formats**: Date fields should use consistent formatting (ISO 8601 recommended: `YYYY-MM-DD`).

6. **Status IDs**: The various status ID fields (`id_SalesStatus`, `id_ReceivingStatus`, `id_ShippingStatus`) reference lookup tables in ManageOrders.
