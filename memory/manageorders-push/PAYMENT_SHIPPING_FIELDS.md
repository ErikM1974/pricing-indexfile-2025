# Payment, Shipping, Notes & Attachments - ManageOrders PUSH API

**Version:** 2.0.1
**Last Updated:** October 29, 2025
**Part of:** ManageOrders PUSH API Documentation
**Parent Document:** [Field Reference Core](FIELD_REFERENCE_CORE.md)

---

## 📋 Navigation

**< Back to [Field Reference Core](FIELD_REFERENCE_CORE.md)**

**Related Documentation:**
- [Order & Customer Fields](ORDER_FIELDS.md) - Order-level and customer data
- [Product Fields](PRODUCT_FIELDS.md) - Line items and design blocks
- [Implementation Examples](IMPLEMENTATION_EXAMPLES.md) - Working code snippets
- [Enhancement Roadmap](ENHANCEMENT_ROADMAP.md) - Future field additions

---

## Overview

This document covers **34 fields** across four blocks:
- **Payment Block:** 12 fields for payment processing and tracking
- **Shipping Address:** 9 fields for delivery addresses
- **Notes Block:** 8 note types for different departments
- **Attachments:** 5 fields for design files and media

**Current Implementation:** 8 of 9 shipping fields (89%), 1 of 8 note types (12.5%), 0 payment/attachment fields (0%)

---

## Payment Block Fields {#payment-block-fields}

**Status:** ❌ Not Currently Implemented
**Future Value:** ⭐⭐⭐⭐ **HIGH** - Important for paid orders

### Payment Transaction Fields

| Field | Data Type | Description | Example | Source |
|-------|-----------|-------------|---------|--------|
| `date_Payment` | string | Payment date (MM/DD/YYYY) | "10/27/2025" | Payment gateway |
| `Amount` | number | Payment amount | 306.00 | Payment gateway |
| `Status` | string | Payment status | "success" | Payment gateway |
| `Gateway` | string | Payment gateway name | "Stripe" | Your integration |
| `AuthCode` | string | Authorization code | "ch_1234567890" | Payment gateway |
| `AccountNumber` | string | Last 4 of card | "****4242" | Payment gateway |
| `CreditCardCompany` | string | Card brand | "Visa" | Payment gateway |
| `ResponseCode` | string | Gateway response code | "00" | Payment gateway |
| `ResponseReasonCode` | string | Reason code | "1" | Payment gateway |
| `ResponseReasonText` | string | Reason text | "Approved" | Payment gateway |
| `FeeProcessing` | number | Processing fee | 8.97 | Payment gateway |
| `FeeOther` | number | Other fees | 0 | Payment gateway |

### Payment Status Values

- `"success"` - Payment completed successfully
- `"failed"` - Payment failed
- `"pending"` - Payment pending
- `"refunded"` - Payment refunded

### Stripe Integration Example

```javascript
// After successful Stripe payment
payments: [{
  date: new Date().toISOString().split('T')[0], // YYYY-MM-DD (proxy converts)
  amount: stripeCharge.amount / 100, // Convert cents to dollars
  status: "success",
  gateway: "Stripe",
  authCode: stripeCharge.id, // "ch_1234567890"
  accountNumber: `****${stripeCharge.payment_method_details.card.last4}`,
  cardCompany: stripeCharge.payment_method_details.card.brand, // "visa"
  responseCode: stripeCharge.outcome.network_status, // "approved_by_network"
  responseReasonText: "Approved",
  feeProcessing: (stripeCharge.amount * 0.029 + 30) / 100 // 2.9% + $0.30
}]
```

### PayPal Integration Example

```javascript
// After successful PayPal payment
payments: [{
  date: new Date().toISOString().split('T')[0],
  amount: paypalOrder.purchase_units[0].amount.value,
  status: "success",
  gateway: "PayPal",
  authCode: paypalOrder.id,
  accountNumber: paypalOrder.payer.email_address,
  responseReasonText: paypalOrder.status // "COMPLETED"
}]
```

---

## Shipping Address Fields {#shipping-address-fields}

**Status:** ✅ Mostly Implemented (8 of 9 fields)

| Field | Data Type | Status | Proxy Field | Description | Example |
|-------|-----------|--------|-------------|-------------|---------|
| `ShipCompany` | string | ✅ Used | `shipping.company` | Ship-to company | "ABC Company" |
| `ShipAddress01` | string | ✅ Used | `shipping.address1` | Street address | "123 Main St" |
| `ShipAddress02` | string | ✅ Used | `shipping.address2` | Apt/Suite | "Suite 200" |
| `ShipCity` | string | ✅ Used | `shipping.city` | City | "Seattle" |
| `ShipState` | string | ✅ Used | `shipping.state` | State (2-letter) | "WA" |
| `ShipZip` | string | ✅ Used | `shipping.zip` | ZIP code | "98101" |
| `ShipCountry` | string | ✅ Used | `shipping.country` | Country | "USA" |
| `ShipMethod` | string | ✅ **NEW** | `shipping.method` | Shipping method | "UPS Ground" |
| `ShipPhone` | string | ❌ Not Used | `shipping.phone` | Ship-to phone | "253-555-1234" |
| `ExtShipID` | string | ✅ **AUTO** | N/A | Address identifier | "SHIP-1" |

**New Field - ShipPhone:**
- **Business Value:** Delivery driver can contact recipient directly
- **Use Case:** Required for residential deliveries, signature required shipments
- **Future Implementation:**
```javascript
shipping: {
  company: "ABC Company - Warehouse",
  address1: "123 Main St",
  city: "Seattle",
  state: "WA",
  zip: "98101",
  country: "USA",
  method: "UPS Ground",
  phone: "253-555-1234"  // ADD THIS - Shipping contact phone
}
```

### Multiple Addresses

ShopWorks supports multiple shipping addresses per order. Each address gets a unique `ExtShipID`, and line items link to addresses via `ExtShipID`.

**Implementation Example:**
```javascript
// Order with 2 shipping addresses
shipping: [
  {
    company: "ABC Company - Warehouse",
    address1: "123 Main St",
    city: "Seattle",
    state: "WA",
    zip: "98101",
    country: "USA",
    method: "Freight"
  },
  {
    company: "ABC Company - Office",
    address1: "456 Oak Ave",
    city: "Tacoma",
    state: "WA",
    zip: "98402",
    country: "USA",
    method: "UPS Ground"
  }
],
lineItems: [
  {
    partNumber: "PC54",
    quantity: 100,
    // ... other fields ...
    shipToAddressIndex: 0  // Links to first address (SHIP-1)
  },
  {
    partNumber: "C112",
    quantity: 50,
    // ... other fields ...
    shipToAddressIndex: 1  // Links to second address (SHIP-2)
  }
]
```

---

## Notes Block Fields {#notes-block-fields}

**Status:** ✅ Basic Implementation (1 of 8 types used)

### Note Structure

| Field | Data Type | Description | Example |
|-------|-----------|-------------|---------|
| `Type` | string | Note type (see below) | "Notes On Order" |
| `Note` | string | Note text | "Customer requested rush" |

### Valid Note Types

| Type | Current Status | Description | Use Case |
|------|----------------|-------------|----------|
| `"Notes On Order"` | ✅ Used | General order notes | Currently used for customer info |
| `"Notes To Art"` | ❌ Not Used | Art department notes | Design specifications |
| `"Notes To Purchasing"` | ❌ Not Used | Purchasing notes | Special vendor requirements |
| `"Notes To Subcontract"` | ❌ Not Used | Subcontractor notes | Outsourced work instructions |
| `"Notes To Production"` | ❌ Not Used | Production notes | Special handling |
| `"Notes To Receiving"` | ❌ Not Used | Receiving notes | Inspection requirements |
| `"Notes To Shipping"` | ❌ Not Used | Shipping notes | Expedite instructions |
| `"Notes To Accounting"` | ❌ Not Used | Accounting notes | Payment terms |

### Current Implementation

```javascript
notes: [{
  type: 'Notes On Order',
  text: `FREE SAMPLE - Top Sellers Showcase - ${formData.company || formData.lastName}`
}]
```

### Enhanced Multi-Note Implementation

```javascript
notes: [
  {
    type: 'Notes On Order',
    text: `FREE SAMPLE REQUEST\nCompany: ${formData.company || 'Individual'}\nSubmitted: ${new Date().toLocaleString()}\nOrder Type: Top Sellers Showcase`
  },
  {
    type: 'Notes To Shipping',
    text: 'Sample order - expedite shipping if possible. No signature required.'
  },
  {
    type: 'Notes To Production',
    text: 'FREE SAMPLE - Standard production schedule acceptable.'
  }
]
```

---

## Attachments Block Fields {#attachments-block-fields}

**Status:** ❌ Not Currently Implemented
**Future Value:** ⭐⭐⭐ **MEDIUM** - Useful for design files

| Field | Data Type | Description | Example | Use Case |
|-------|-----------|-------------|---------|----------|
| `MediaURL` | string | URL to media file | "https://s3.../design.pdf" | Design files |
| `MediaName` | string | Display name | "Team Logo - Vector" | User-friendly name |
| `LinkURL` | string | URL to external resource | "https://drive.google.com/..." | Google Drive, Dropbox |
| `LinkNote` | string | Note about link | "Final approved design" | Context |
| `Link` | number | Link type (0 or 1) | 1 | Unclear purpose |

### Future Implementation Example

```javascript
attachments: [
  {
    mediaURL: "https://s3.amazonaws.com/nwca/designs/logo-vector.pdf",
    mediaName: "Team Logo - Vector File",
    linkNote: "Final approved design from customer"
  },
  {
    linkURL: "https://drive.google.com/file/d/...",
    mediaName: "Mockup Images",
    linkNote: "Customer mockup folder - 5 files"
  }
]
```

---

## Enhancement Opportunities

### Phase 1: Multi-Note Implementation (Quick Win)
**Timeline:** 1 day
**Value:** ⭐⭐⭐ **MEDIUM**
**Effort:** 🔨 **LOW**

Add department-specific notes:
```javascript
notes: [
  { type: 'Notes On Order', text: orderSummary },
  { type: 'Notes To Shipping', text: shippingInstructions },
  { type: 'Notes To Production', text: productionNotes }
]
```

### Phase 2: Payment Integration
**Timeline:** 1-2 weeks
**Value:** ⭐⭐⭐⭐ **HIGH**
**Effort:** 🔨🔨 **MEDIUM**

Integrate Stripe/PayPal:
- Capture payment info automatically
- Track payment status
- Calculate processing fees
- Link payments to orders

### Phase 3: Attachment Support
**Timeline:** 1 week
**Value:** ⭐⭐⭐ **MEDIUM**
**Effort:** 🔨🔨 **MEDIUM**

Upload design files:
- S3/cloud storage integration
- Link files to orders
- Visual reference for production
- Customer mockup sharing

See [Enhancement Roadmap](ENHANCEMENT_ROADMAP.md) for complete implementation details.

---

## Related Documentation

**Field Reference Documentation:**
- [Order & Customer Fields](ORDER_FIELDS.md) - Order-level and customer data
- [Product Fields](PRODUCT_FIELDS.md) - Line items and design blocks
- [Implementation Examples](IMPLEMENTATION_EXAMPLES.md) - Working code examples
- [Enhancement Roadmap](ENHANCEMENT_ROADMAP.md) - Future field additions

**Implementation Guides:**
- [Form Development Guide](FORM_DEVELOPMENT_GUIDE.md) - Building custom forms
- [Troubleshooting Guide](TROUBLESHOOTING.md) - Common issues

**Parent Documentation:**
- [Field Reference Core](FIELD_REFERENCE_CORE.md) - Complete field reference
- [MANAGEORDERS_PUSH_WEBSTORE.md](../MANAGEORDERS_PUSH_WEBSTORE.md) - PUSH API overview

---

**Version:** 2.0.1
**Last Updated:** October 29, 2025
**Maintained By:** Erik & Claude AI
**Questions:** Contact erik@nwcustomapparel.com
