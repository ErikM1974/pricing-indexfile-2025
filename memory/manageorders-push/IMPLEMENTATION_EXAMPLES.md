# Implementation Examples - ManageOrders PUSH API

**Version:** 2.0.1
**Last Updated:** October 29, 2025
**Part of:** ManageOrders PUSH API Documentation
**Parent Document:** [Field Reference Core](FIELD_REFERENCE_CORE.md)

---

## 📋 Navigation

**< Back to [Field Reference Core](FIELD_REFERENCE_CORE.md)**

**Related Documentation:**
- [Order & Customer Fields](ORDER_FIELDS.md) - Order-level field specifications
- [Product Fields](PRODUCT_FIELDS.md) - Line item field specifications
- [Payment & Shipping Fields](PAYMENT_SHIPPING_FIELDS.md) - Payment and shipping fields
- [Form Development Guide](FORM_DEVELOPMENT_GUIDE.md) - Building custom forms
- [Troubleshooting](TROUBLESHOOTING.md) - Common issues

---

## Overview

This document provides **working code examples** for common ManageOrders PUSH API scenarios:
- Basic sample orders (current implementation)
- Enhanced orders with custom fields
- Paid orders with payment integration
- Orders with design specifications
- Multi-product and multi-address orders

All examples use the proxy API at `https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/manageorders/orders/create`

---

## Basic Sample Order (Current Implementation)

**Use Case:** Free sample request from Top Sellers Showcase

**Features:**
- Minimal required fields
- Single product
- Simple shipping
- Basic order notes

```javascript
const order = {
  orderNumber: "SAMPLE-1027-1",
  orderDate: "2025-10-27",
  isTest: false,
  purchaseOrderNumber: "SAMPLE-SAMPLE-1027-1",
  salesRep: "erik@nwcustomapparel.com",
  terms: "FREE SAMPLE",

  customer: {
    firstName: "Mike",
    lastName: "Test",
    email: "erik@go2shirt.com",
    phone: "555-5555",
    company: "Test Company"
  },

  shipping: {
    company: "Test Company",
    address1: "123 Main St",
    address2: "",
    city: "Seattle",
    state: "WA",
    zip: "98101",
    country: "USA",
    method: "UPS Ground"
  },

  lineItems: [
    {
      partNumber: "PC54",
      description: "Port & Company Core Cotton Tee",
      color: "Lilac",
      size: "XL",
      quantity: 1,
      price: 0.01
    }
  ],

  notes: [{
    type: 'Notes On Order',
    text: 'FREE SAMPLE - Top Sellers Showcase - Test Company'
  }]
};

// Submit order
const response = await fetch(
  'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/manageorders/orders/create',
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(order)
  }
);

const result = await response.json();
console.log('Order created:', result.orderNumber); // "NWCA-SAMPLE-1027-1"
```

---

## Enhanced Sample Order with Custom Fields

**Use Case:** Sample request with tracking and metadata

**Enhancements:**
- Line item custom fields for sample tracking
- Multiple note types for different departments
- Color mapping logging
- Source tracking

```javascript
const order = {
  orderNumber: "SAMPLE-1027-1",
  orderDate: "2025-10-27",
  isTest: false,
  purchaseOrderNumber: "SAMPLE-SAMPLE-1027-1",
  salesRep: "erik@nwcustomapparel.com",
  terms: "FREE SAMPLE",

  customer: {
    firstName: "Mike",
    lastName: "Test",
    email: "erik@go2shirt.com",
    phone: "555-5555",
    company: "Test Company"
  },

  shipping: {
    company: "Test Company",
    address1: "123 Main St",
    address2: "",
    city: "Seattle",
    state: "WA",
    zip: "98101",
    country: "USA",
    method: "UPS Ground"
  },

  lineItems: samples.map(sample => ({
    partNumber: sample.style,
    description: sample.name,
    color: sample.catalogColor,
    size: sample.size || 'OSFA',
    quantity: 1,
    price: 0.01,

    // ADD CUSTOM FIELDS FOR TRACKING
    customFields: {
      CustomField01: 'FREE SAMPLE',
      CustomField02: 'Top Sellers Showcase',
      CustomField03: sample.addedDate,
      CustomField04: sample.type, // 'free' or 'paid'
      CustomField05: `${sample.color} → ${sample.catalogColor}` // Color mapping log
    }
  })),

  // ENHANCED NOTES
  notes: [
    {
      type: 'Notes On Order',
      text: `FREE SAMPLE REQUEST\nCompany: ${formData.company || 'Individual'}\nSubmitted: ${new Date().toLocaleString()}\nSource: Top Sellers Showcase\nSample Count: ${samples.length}`
    },
    {
      type: 'Notes To Shipping',
      text: 'Sample order - expedite if possible. No signature required.'
    },
    {
      type: 'Notes To Production',
      text: 'FREE SAMPLE - Standard turnaround acceptable. No special handling required.'
    }
  ]
};
```

---

## Paid Order with Payment Integration

**Use Case:** E-commerce webstore order with Stripe payment

**Features:**
- Payment tracking
- Credit card information (last 4)
- Processing fees
- Prepaid order terms

```javascript
// After successful Stripe payment
const order = {
  orderNumber: "WEB-12345",
  orderDate: "2025-10-27",
  isTest: false,
  purchaseOrderNumber: customerData.poNumber || "WEB-12345",
  salesRep: "erik@nwcustomapparel.com",
  terms: "PREPAID - Credit Card",

  customer: {
    firstName: customerData.firstName,
    lastName: customerData.lastName,
    email: customerData.email,
    phone: customerData.phone,
    company: customerData.company
  },

  shipping: {
    company: shippingData.company,
    address1: shippingData.address1,
    address2: shippingData.address2 || '',
    city: shippingData.city,
    state: shippingData.state,
    zip: shippingData.zip,
    country: "USA",
    method: shippingData.selectedMethod // "UPS Ground", "USPS Priority", etc.
  },

  lineItems: cartItems.map(item => ({
    partNumber: item.sku,
    description: item.name,
    color: item.catalogColor,
    size: item.size,
    quantity: item.quantity,
    price: item.unitPrice,
    notes: item.decorationNotes, // e.g., "Left chest logo - 3 inch"
  })),

  // ADD PAYMENT INFORMATION
  payments: [{
    date: new Date().toISOString().split('T')[0],
    amount: stripeCharge.amount / 100,
    status: "success",
    gateway: "Stripe",
    authCode: stripeCharge.id,
    accountNumber: `****${stripeCharge.payment_method_details.card.last4}`,
    cardCompany: stripeCharge.payment_method_details.card.brand,
    responseReasonText: "Approved",
    feeProcessing: (stripeCharge.amount * 0.029 + 30) / 100
  }],

  notes: [
    {
      type: 'Notes On Order',
      text: `Web Order - Prepaid\nPayment: ${stripeCharge.payment_method_details.card.brand} ending in ${stripeCharge.payment_method_details.card.last4}\nAuth Code: ${stripeCharge.id}`
    },
    {
      type: 'Notes To Production',
      text: customerData.productionNotes || 'Standard production'
    }
  ]
};
```

---

## Order with Design Specifications

**Use Case:** Custom decorated apparel with artwork tracking

**Features:**
- Design block with locations
- Stitch counts for embroidery
- Color counts for screen print
- Player name personalization

```javascript
const order = {
  orderNumber: "CUSTOM-12345",
  orderDate: "2025-10-27",
  isTest: false,
  purchaseOrderNumber: "PO-12345",
  salesRep: "erik@nwcustomapparel.com",
  terms: "Net 30",

  customer: {
    firstName: "John",
    lastName: "Smith",
    email: "john@teamxyz.com",
    phone: "253-555-1234",
    company: "Team XYZ"
  },

  shipping: {
    company: "Team XYZ",
    address1: "456 Stadium Dr",
    city: "Seattle",
    state: "WA",
    zip: "98109",
    country: "USA",
    method: "UPS Ground"
  },

  // ADD DESIGN INFORMATION
  designs: [
    {
      name: "Team Logo",
      externalId: `DESIGN-${Date.now()}`,
      imageUrl: designFileUrl, // S3 or CDN URL
      productColor: "Navy",
      locations: [
        {
          location: "Left Chest",
          colors: "2",
          stitches: "8000",
          code: "LC",
          imageUrl: designFileUrl,
          notes: "3 inch logo centered"
        },
        {
          location: "Full Back",
          colors: "3",
          stitches: "15000",
          code: "FB",
          notes: "12 inch logo with player name below"
        }
      ]
    }
  ],

  lineItems: [
    {
      partNumber: "PC54",
      description: "Team Jersey",
      color: "Navy",
      size: "L",
      quantity: 1,
      price: 35.00,
      playerName: {
        first: "Mike",
        last: "Johnson"
      },
      notes: "Left chest and full back decoration"
    }
  ],

  notes: [
    {
      type: 'Notes On Order',
      text: 'Team order - Rush production requested'
    },
    {
      type: 'Notes To Art',
      text: 'Use team logo file DESIGN-12345. Navy thread on navy fabric.'
    }
  ]
};
```

---

## Multi-Product Order

**Use Case:** Mixed product order with different items

**Features:**
- Multiple line items
- Different products, colors, sizes
- Varied quantities
- Individual line item notes

```javascript
const order = {
  orderNumber: "MULTI-12345",
  orderDate: "2025-10-27",
  isTest: false,

  customer: {
    firstName: "Jane",
    lastName: "Doe",
    email: "jane@company.com",
    phone: "253-555-5678",
    company: "ABC Corp"
  },

  shipping: {
    company: "ABC Corp",
    address1: "789 Business Blvd",
    city: "Tacoma",
    state: "WA",
    zip: "98402",
    country: "USA",
    method: "UPS Ground"
  },

  lineItems: [
    {
      partNumber: "PC54",
      description: "Core Cotton Tee",
      color: "Navy",
      size: "L",
      quantity: 24,
      price: 8.50,
      notes: "Left chest logo"
    },
    {
      partNumber: "PC61",
      description: "Essential Tee",
      color: "Red",
      size: "XL",
      quantity: 12,
      price: 9.00,
      notes: "Full front design"
    },
    {
      partNumber: "C112",
      description: "Port Authority Cap",
      color: "Black",
      size: "OSFA",
      quantity: 24,
      price: 15.00,
      notes: "Embroidered front logo"
    }
  ],

  notes: [{
    type: 'Notes On Order',
    text: 'Corporate order - standard delivery schedule'
  }]
};
```

---

## Multi-Address Order

**Use Case:** Order shipping to multiple locations

**Features:**
- Multiple shipping addresses
- Line items linked to specific addresses
- Different shipping methods per address

```javascript
const order = {
  orderNumber: "MULTISHIP-12345",
  orderDate: "2025-10-27",
  isTest: false,

  customer: {
    firstName: "John",
    lastName: "Manager",
    email: "john@bigcorp.com",
    phone: "253-555-9999",
    company: "Big Corp"
  },

  // Multiple shipping addresses
  shipping: [
    {
      company: "Big Corp - Warehouse",
      address1: "123 Warehouse Rd",
      city: "Seattle",
      state: "WA",
      zip: "98101",
      country: "USA",
      method: "Freight"
    },
    {
      company: "Big Corp - Retail Store",
      address1: "456 Mall Ave",
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
      description: "Bulk Order - Tees",
      color: "Navy",
      size: "L",
      quantity: 500,
      price: 6.50,
      shipToAddressIndex: 0  // Ships to warehouse (SHIP-1)
    },
    {
      partNumber: "C112",
      description: "Retail Display - Caps",
      color: "Black",
      size: "OSFA",
      quantity: 50,
      price: 12.00,
      shipToAddressIndex: 1  // Ships to retail store (SHIP-2)
    }
  ],

  notes: [{
    type: 'Notes On Order',
    text: 'Split shipment - warehouse (500) and retail (50)'
  }]
};
```

---

## Error Handling Pattern

**Best Practice:** Always handle errors gracefully

```javascript
async function submitOrder(orderData) {
  try {
    const response = await fetch(
      'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/manageorders/orders/create',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData)
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Order submission failed');
    }

    const result = await response.json();

    // Success!
    console.log('✅ Order created:', result.orderNumber);
    return {
      success: true,
      orderNumber: result.orderNumber,
      message: `Order ${result.orderNumber} created successfully`
    };

  } catch (error) {
    console.error('❌ Order submission error:', error);

    // Show user-friendly error
    return {
      success: false,
      error: error.message,
      message: 'Failed to submit order. Please try again or contact support.'
    };
  }
}

// Usage
const result = await submitOrder(order);
if (result.success) {
  alert(`Order ${result.orderNumber} submitted successfully!`);
} else {
  alert(`Error: ${result.message}`);
}
```

---

## Testing Pattern

**Use Test Mode:** Set `isTest: true` to create test orders

```javascript
// Development/Testing
const order = {
  orderNumber: "TEST-12345",
  isTest: true,  // ⚠️ Creates NWCA-TEST-12345 in ShopWorks
  // ... rest of order data
};

// Production
const order = {
  orderNumber: "PROD-12345",
  isTest: false,  // ✅ Creates NWCA-PROD-12345 in ShopWorks
  // ... rest of order data
};
```

**Clean Up Test Orders:**
```bash
# Query test orders
curl "https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/manageorders/orders?ExtOrderID=NWCA-TEST-*"

# Delete test orders from ShopWorks manually or via support
```

---

## Related Documentation

**Field Specifications:**
- [Order & Customer Fields](ORDER_FIELDS.md) - Complete field reference
- [Product Fields](PRODUCT_FIELDS.md) - Line item specifications
- [Payment & Shipping Fields](PAYMENT_SHIPPING_FIELDS.md) - Payment and address fields

**Implementation Guides:**
- [Form Development Guide](FORM_DEVELOPMENT_GUIDE.md) - Building custom forms
- [Enhancement Roadmap](ENHANCEMENT_ROADMAP.md) - Future features
- [Troubleshooting](TROUBLESHOOTING.md) - Common issues and solutions

**Parent Documentation:**
- [Field Reference Core](FIELD_REFERENCE_CORE.md) - Complete field documentation
- [MANAGEORDERS_PUSH_WEBSTORE.md](../MANAGEORDERS_PUSH_WEBSTORE.md) - PUSH API overview
- [ONLINE_STORE_DEVELOPER_GUIDE.md](../../caspio-pricing-proxy/memory/ONLINE_STORE_DEVELOPER_GUIDE.md) - Complete developer guide

---

**Version:** 2.0.1
**Last Updated:** October 29, 2025
**Maintained By:** Erik & Claude AI
**Questions:** Contact erik@nwcustomapparel.com
