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

### 💳 Stripe Payment Field Mapping

**CRITICAL:** Always use actual Stripe API response fields. DO NOT hardcode payment response values.

When integrating Stripe Payment Intents, map Stripe API response fields to ManageOrders fields:

| ManageOrders Field | Stripe API Path | Data Type | Example | Notes |
|-------------------|-----------------|-----------|---------|-------|
| `accountNumber` | `payment_intent.id` | string | "pi_3QRabcdef123" | Full Payment Intent ID |
| `authCode` | `payment_intent.id` | string | "pi_3QRabcdef123" | Same as accountNumber |
| `amount` | `payment_intent.amount / 100` | number | 144.00 | Convert cents → dollars |
| `responseCode` | `payment_intent.outcome.network_status` | string | "approved_by_network" | Actual network response |
| `responseReasonCode` | `payment_intent.outcome.seller_message` | string | "approved" | Seller-facing message |
| `responseReasonText` | `payment_intent.outcome.reason` | string | "Payment successful" | Human-readable reason |
| `cardCompany` | `payment_method.card.brand` | string | "visa" | Card brand (lowercase) |
| `status` | `payment_intent.status` | string | "succeeded" | Payment status |
| `feeProcessing` | Calculated | number | 4.48 | (amount × 0.029) + 0.30 |

**Complete Stripe Integration Example:**

```javascript
// After successful Stripe Payment Intent
const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
const paymentMethod = await stripe.paymentMethods.retrieve(paymentIntent.payment_method);

payments: [{
  date: new Date().toISOString().split('T')[0], // YYYY-MM-DD (proxy converts to MM/DD/YYYY)
  amount: paymentIntent.amount / 100, // Convert cents to dollars
  status: paymentIntent.status, // "succeeded"
  gateway: "Stripe",
  authCode: paymentIntent.id, // "pi_3QRabcdef123"
  accountNumber: paymentIntent.id, // Same as authCode
  cardCompany: paymentMethod.card.brand, // "visa", "mastercard", "amex", etc.
  responseCode: paymentIntent.outcome?.network_status || 'approved_by_network',
  responseReasonCode: paymentIntent.outcome?.seller_message || 'approved',
  responseReasonText: paymentIntent.outcome?.reason || 'Payment successful',
  feeProcessing: (paymentIntent.amount * 0.029 + 30) / 100 // Stripe standard fees
}]
```

**Common Mistake - Hardcoding Values:**

```javascript
// ❌ WRONG - Payment tracking data will be inaccurate
payments: [{
  responseCode: '200',              // ❌ Hardcoded
  responseReasonCode: '1',          // ❌ Hardcoded
  responseReasonText: 'Payment successful',  // ❌ Hardcoded
  cardCompany: 'Stripe'             // ❌ Should be card brand
}]
```

**Why This Matters:**

If Stripe payment has issues (declined, fraud detection, network error), hardcoded values will show "success" in ShopWorks OnSite even though payment failed. Using actual Stripe response fields ensures accurate payment tracking.

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

**Status:** ✅ **Implemented in v1.1.0** - File upload support with smart routing
**Current Value:** ⭐⭐⭐ **HIGH** - Essential for artwork tracking

| Field | Data Type | Status | Description | Example |
|-------|-----------|--------|-------------|---------|
| `MediaURL` | string | ✅ Used | URL to uploaded file | "https://c3eku948.caspio.com/..." |
| `MediaName` | string | ✅ Used | Original filename | "team-logo.pdf" |
| `LinkURL` | string | ❌ Not Used | External resource URL | "https://drive.google.com/..." |
| `LinkNote` | string | ❌ Not Used | Note about link | "Final approved design" |
| `Link` | number | ❌ Not Used | Link type (unclear) | 1 |

---

### 🚨 Critical File Upload Implementation Notes

#### 1MB Payload Limit (CRITICAL)

**The Problem:**
- ManageOrders API has a **1MB total JSON payload limit**
- A single high-resolution design file can easily exceed this limit
- Base64 encoding increases file size by ~33%

**The Solution:**
Files must be uploaded **separately to Caspio** BEFORE creating the order:

```javascript
// ❌ WRONG - Including base64 in order payload
const order = {
    lineItems: [...],
    attachments: [{
        mediaName: "logo.pdf",
        fileData: "JVBERi0xLjQKJeLjz9MKNCAwIG9iaiA8PC9MZW5..."  // ❌ 5MB base64
    }]
};
// Result: 413 Payload Too Large error

// ✅ CORRECT - Upload file first, then reference
// Step 1: Upload file to Caspio
const uploadResponse = await fetch('/api/upload-file', {
    method: 'POST',
    body: formData  // Contains actual file
});
const { fileUrl } = await uploadResponse.json();

// Step 2: Create order with file URL reference only
const order = {
    lineItems: [...],
    attachments: [{
        mediaURL: fileUrl,                    // ✅ Reference to uploaded file
        mediaName: "logo.pdf"                 // ✅ Metadata only
    }]
};
```

#### Separate Upload Process

**Implementation Pattern:**

```javascript
// Complete file upload workflow
async function createOrderWithFiles(orderData, files) {
    // 1. Upload files to Caspio first
    const uploadedFiles = [];
    for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);

        const uploadResponse = await fetch(
            'https://caspio-pricing-proxy.../api/upload-file',
            {
                method: 'POST',
                body: formData
            }
        );

        const result = await uploadResponse.json();
        uploadedFiles.push({
            mediaURL: result.fileUrl,
            mediaName: file.name,
            fileSize: file.size,
            fileType: file.type
        });
    }

    // 2. Create order with file references
    const order = {
        ...orderData,
        attachments: uploadedFiles  // Only metadata, not file data
    };

    const orderResponse = await fetch('/api/manageorders/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(order)
    });

    return orderResponse.json();
}
```

#### Smart Routing (Artwork vs Documents)

**v1.1.0 automatically routes files based on type:**

**Artwork Files** (images, vector files) → Added to BOTH:
1. **Designs Block:** `Designs.Locations[].ImageURL`
2. **Attachments Block:** For reference/download

**Document Files** (PDF, Word, Excel) → Added to:
1. **Attachments Block** only

**Supported File Types (20+ types):**

| Category | Types | Routing |
|----------|-------|---------|
| **Artwork** | .ai, .eps, .svg, .psd, .png, .jpg, .jpeg, .gif | Designs + Attachments |
| **Documents** | .pdf, .doc, .docx, .xls, .xlsx, .txt | Attachments only |
| **Compressed** | .zip, .rar, .7z | Attachments only |

**Example:**

```javascript
const files = [
    { name: "team-logo.ai", type: "image/ai" },        // Artwork
    { name: "mockup.png", type: "image/png" },         // Artwork
    { name: "quote.pdf", type: "application/pdf" }     // Document
];

// After upload and smart routing:
// Designs.Locations[0].ImageURL = "https://.../team-logo.ai"
// Designs.Locations[1].ImageURL = "https://.../mockup.png"
// Attachments[0] = { mediaURL: "https://.../team-logo.ai", mediaName: "team-logo.ai" }
// Attachments[1] = { mediaURL: "https://.../mockup.png", mediaName: "mockup.png" }
// Attachments[2] = { mediaURL: "https://.../quote.pdf", mediaName: "quote.pdf" }
```

### Current Implementation Example (v1.1.0)

```javascript
// Upload files (done separately before order creation)
const uploadedFiles = await uploadFilesToCaspio([
    logoFile,
    mockupFile,
    quoteFile
]);

// Create order with file metadata only
const order = {
    orderNumber: "SAMPLE-1027-1",
    lineItems: [
        {
            partNumber: "PC54",
            quantity: 48,
            price: 10.00
        }
    ],
    attachments: [
        {
            mediaURL: "https://c3eku948.caspio.com/dp/A0E15000/files/team-logo.ai",
            mediaName: "team-logo.ai",
            fileSize: 245000,      // Optional metadata
            fileType: "image/ai"   // Optional metadata
        },
        {
            mediaURL: "https://c3eku948.caspio.com/dp/A0E15000/files/mockup.png",
            mediaName: "mockup.png",
            fileSize: 180000,
            fileType: "image/png"
        },
        {
            mediaURL: "https://c3eku948.caspio.com/dp/A0E15000/files/quote.pdf",
            mediaName: "quote.pdf",
            fileSize: 95000,
            fileType: "application/pdf"
        }
    ]
};

// Send to ManageOrders API
const response = await fetch('/api/manageorders/orders/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(order)
});
```

### File Upload Limits

| Limit | Value | Notes |
|-------|-------|-------|
| **Max file size** | 20MB | Per individual file |
| **Max files per order** | Unlimited | No hard limit |
| **Max total payload** | 1MB | JSON payload only (NOT file data) |
| **Supported file types** | 20+ types | See table above |

### Troubleshooting File Upload

| Problem | Cause | Solution |
|---------|-------|----------|
| **413 Payload Too Large** | Including file data in order payload | Upload files separately first |
| **File not appearing in Designs** | Wrong file type or routing | Check file type - only artwork goes to Designs |
| **Upload fails** | File too large (>20MB) | Compress or split file |
| **Missing MediaURL** | File upload failed | Check upload response for errors |

### Production Implementation

**3-Day Tees (v1.1.0):**
- Supports file upload for artwork files
- Smart routing to Designs block
- 20MB max file size
- 20+ file type support

**File Upload Endpoint:**
```
POST https://caspio-pricing-proxy.../api/upload-file
Content-Type: multipart/form-data

Response:
{
  "success": true,
  "fileUrl": "https://c3eku948.caspio.com/dp/A0E15000/files/filename.ext",
  "fileName": "filename.ext",
  "fileSize": 245000
}
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
