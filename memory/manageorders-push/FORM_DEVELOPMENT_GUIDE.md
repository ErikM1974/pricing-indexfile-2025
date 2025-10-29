# Form Development Guide - ManageOrders PUSH API

**Version:** 2.0.1
**Last Updated:** October 29, 2025
**Part of:** ManageOrders PUSH API Documentation
**Parent Document:** [Field Reference Core](FIELD_REFERENCE_CORE.md)

---

## 📋 Navigation

**< Back to [Field Reference Core](FIELD_REFERENCE_CORE.md)**

**Related Documentation:**
- [Implementation Examples](IMPLEMENTATION_EXAMPLES.md) - Working code snippets
- [Order & Customer Fields](ORDER_FIELDS.md) - Available order fields
- [Product Fields](PRODUCT_FIELDS.md) - Available product fields
- [Troubleshooting](TROUBLESHOOTING.md) - Common issues

---

## Overview

Build custom ManageOrders integration forms with advanced features:
- ✅ Unlimited file uploads (20+ file types, max 20MB per file)
- ✅ Smart file routing (artwork → Designs + Attachments)
- ✅ Automatic Caspio upload with externalKey
- ✅ Customer autocomplete (389 customers from last 60 days)
- ✅ Billing/shipping address separation
- ✅ Real-time inventory checks (5-minute cache)

---

## Pattern 1: Basic Sample Request Form

**Use Case:** Simple form for requesting free samples (current implementation)

**Features:**
- Customer contact information
- Sales rep assignment
- Shipping address
- Product selection (managed by JavaScript)

**HTML Structure:**
```html
<form id="sampleRequestForm">
  <!-- Customer Information -->
  <h3>Contact Information</h3>
  <input type="text" name="firstName" required placeholder="First Name">
  <input type="text" name="lastName" required placeholder="Last Name">
  <input type="email" name="email" required placeholder="Email">
  <input type="tel" name="phone" required placeholder="Phone">
  <input type="text" name="company" placeholder="Company Name">

  <!-- Sales Rep Assignment -->
  <select name="salesRep" required>
    <option value="">Select Sales Rep</option>
    <option value="erik@nwcustomapparel.com">Erik Mickelson</option>
    <option value="nika@nwcustomapparel.com">Nika Lao</option>
  </select>

  <!-- Shipping Address -->
  <h3>Shipping Address</h3>
  <input type="text" name="shipping_address1" required placeholder="Street Address">
  <input type="text" name="shipping_address2" placeholder="Apt/Suite (optional)">
  <input type="text" name="shipping_city" required placeholder="City">
  <select name="shipping_state" required>
    <option value="">Select State</option>
    <!-- ... states ... -->
  </select>
  <input type="text" name="shipping_zip" required placeholder="ZIP Code">

  <!-- Product Selection (hidden - managed by JS) -->
  <input type="hidden" name="samples" id="samplesData">

  <button type="submit">Request Free Samples</button>
</form>
```

**JavaScript Handler:**
```javascript
document.getElementById('sampleRequestForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const formData = new FormData(e.target);

  const order = {
    orderNumber: `SAMPLE-${Date.now()}`,
    orderDate: new Date().toISOString().split('T')[0],
    salesRep: formData.get('salesRep'),
    terms: 'FREE SAMPLE',
    customer: {
      firstName: formData.get('firstName'),
      lastName: formData.get('lastName'),
      email: formData.get('email'),
      phone: formData.get('phone'),
      company: formData.get('company')
    },
    shipping: {
      company: formData.get('company') || `${formData.get('firstName')} ${formData.get('lastName')}`,
      address1: formData.get('shipping_address1'),
      address2: formData.get('shipping_address2') || '',
      city: formData.get('shipping_city'),
      state: formData.get('shipping_state'),
      zip: formData.get('shipping_zip'),
      country: 'USA',
      method: 'UPS Ground'
    },
    lineItems: JSON.parse(formData.get('samples')),
    notes: [{
      type: 'Notes On Order',
      text: `FREE SAMPLE - Top Sellers Showcase - ${formData.get('company')}`
    }]
  };

  const result = await submitOrder(order);
  if (result.success) {
    alert(`Order ${result.orderNumber} submitted!`);
  }
});
```

---

## Pattern 2: Customer Autocomplete Integration

**Use Case:** Pre-fill customer information from existing ShopWorks customers

**Features:**
- Search 389 customers from last 60 days
- Auto-populate name, email, phone, company
- Smart sorting (exact → starts with → contains)

**HTML:**
```html
<div class="autocomplete-wrapper">
  <input type="text" id="companySearch" placeholder="Search company name...">
  <div id="autocompleteResults" class="autocomplete-results"></div>
</div>

<!-- Auto-populated fields -->
<input type="text" id="company" readonly placeholder="Company (auto-filled)">
<input type="text" id="firstName" readonly placeholder="First Name (auto-filled)">
<input type="text" id="lastName" readonly placeholder="Last Name (auto-filled)">
<input type="email" id="email" readonly placeholder="Email (auto-filled)">
<input type="tel" id="phone" readonly placeholder="Phone (auto-filled)">
```

**JavaScript Implementation:**
```javascript
// Load customer service
const customerService = new ManageOrdersCustomerService();
await customerService.initialize();

// Search on input
document.getElementById('companySearch').addEventListener('input', debounce((e) => {
  const query = e.target.value;
  if (query.length < 2) return;

  const results = customerService.searchCustomers(query);
  displayAutocompleteResults(results);
}, 200));

// Display results
function displayAutocompleteResults(customers) {
  const resultsDiv = document.getElementById('autocompleteResults');
  resultsDiv.innerHTML = customers.map(customer => `
    <div class="autocomplete-item" onclick="selectCustomer(${customer.id_Customer})">
      <strong>${escapeHtml(customer.CustomerName)}</strong><br>
      <small>${escapeHtml(customer.ContactFirstName)} ${escapeHtml(customer.ContactLastName)} - ${escapeHtml(customer.ContactEmail)}</small>
    </div>
  `).join('');
}

// Select customer
function selectCustomer(customerId) {
  const customer = customerService.getCustomerById(customerId);
  document.getElementById('company').value = customer.CustomerName;
  document.getElementById('firstName').value = customer.ContactFirstName;
  document.getElementById('lastName').value = customer.ContactLastName;
  document.getElementById('email').value = customer.ContactEmail;
  document.getElementById('phone').value = customer.ContactPhone;
  document.getElementById('autocompleteResults').innerHTML = '';
}
```

**Complete Implementation:** See `memory/manageorders/CUSTOMER_AUTOCOMPLETE.md`

---

## Pattern 3: File Upload Integration

**Use Case:** Upload design files with orders

**Features:**
- Unlimited file uploads (max 20MB per file)
- 20+ supported file types
- Auto-upload to Caspio
- Smart routing (artwork vs documents)

**HTML:**
```html
<div class="file-upload-section">
  <label for="designFiles">Upload Design Files (optional)</label>
  <input type="file" id="designFiles" multiple accept="image/*,.pdf,.ai,.eps,.svg">
  <div id="filePreview" class="file-preview"></div>
</div>
```

**JavaScript:**
```javascript
document.getElementById('designFiles').addEventListener('change', async (e) => {
  const files = Array.from(e.target.files);

  for (const file of files) {
    // Validate file
    if (file.size > 20 * 1024 * 1024) {
      alert(`${file.name} is too large (max 20MB)`);
      continue;
    }

    // Upload to Caspio
    const uploadResult = await uploadFileToCaspio(file, orderNumber);

    if (uploadResult.success) {
      // Add to order attachments
      attachments.push({
        mediaURL: uploadResult.url,
        mediaName: file.name,
        linkNote: `Uploaded ${new Date().toLocaleDateString()}`
      });
    }
  }
});

async function uploadFileToCaspio(file, externalKey) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('externalKey', externalKey);

  const response = await fetch(
    'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/upload',
    {
      method: 'POST',
      body: formData
    }
  );

  return response.json();
}
```

**Complete File Upload Documentation:**
- See `caspio-pricing-proxy/memory/ONLINE_STORE_DEVELOPER_GUIDE.md` (lines 1006-1158)
- Full specification in Field Reference Core (lines 1707-2528)

---

## Pattern 4: Real-Time Inventory Check

**Use Case:** Verify product availability before order submission

**Features:**
- Real-time stock levels (5-minute cache)
- "In Stock" / "Out of Stock" display
- Quantity available indicator

**HTML:**
```html
<div class="product-card">
  <img src="product.jpg" alt="PC54">
  <h3>PC54 - Core Cotton Tee</h3>
  <div id="stock-PC54" class="stock-indicator">Checking availability...</div>
  <button id="add-PC54" disabled>Add to Cart</button>
</div>
```

**JavaScript:**
```javascript
async function checkInventory(partNumber) {
  const response = await fetch(
    `https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/manageorders/inventorylevels?PartNumber=${partNumber}`
  );

  const inventory = await response.json();

  if (inventory.length > 0) {
    const item = inventory[0];
    const available = item.QtyAvailable || 0;

    const stockDiv = document.getElementById(`stock-${partNumber}`);
    const addBtn = document.getElementById(`add-${partNumber}`);

    if (available > 0) {
      stockDiv.innerHTML = `<span class="in-stock">✓ In Stock (${available})</span>`;
      addBtn.disabled = false;
    } else {
      stockDiv.innerHTML = `<span class="out-of-stock">✗ Out of Stock</span>`;
      addBtn.disabled = true;
    }
  }
}

// Check inventory for all products
['PC54', 'PC61', 'C112'].forEach(checkInventory);
```

**Complete Inventory API Documentation:**
- See `memory/manageorders/API_REFERENCE.md` (Inventory section)

---

## Pattern 5: Billing/Shipping Address Separation

**Use Case:** Different billing and shipping addresses

**Features:**
- Checkbox to copy billing to shipping
- Separate address validation
- Optional billing address

**HTML:**
```html
<!-- Billing Address (for Customer block) -->
<h3>Billing Address</h3>
<input type="text" name="billing_company" placeholder="Company">
<input type="text" name="billing_address1" placeholder="Street Address">
<input type="text" name="billing_city" placeholder="City">
<input type="text" name="billing_state" placeholder="State">
<input type="text" name="billing_zip" placeholder="ZIP">

<!-- Copy to Shipping -->
<label>
  <input type="checkbox" id="sameAsShipping"> Same as shipping address
</label>

<!-- Shipping Address (for ShippingAddresses array) -->
<h3>Shipping Address</h3>
<input type="text" name="shipping_company" placeholder="Company">
<input type="text" name="shipping_address1" placeholder="Street Address">
<input type="text" name="shipping_city" placeholder="City">
<input type="text" name="shipping_state" placeholder="State">
<input type="text" name="shipping_zip" placeholder="ZIP">
```

**JavaScript:**
```javascript
document.getElementById('sameAsShipping').addEventListener('change', (e) => {
  if (e.target.checked) {
    document.querySelector('[name="billing_company"]').value =
      document.querySelector('[name="shipping_company"]').value;
    document.querySelector('[name="billing_address1"]').value =
      document.querySelector('[name="shipping_address1"]').value;
    // ... copy other fields
  }
});

// Build order with separate addresses
const order = {
  // ... other fields ...

  // Billing address (Customer block - NOT currently sent)
  customer: {
    firstName: formData.get('firstName'),
    lastName: formData.get('lastName'),
    email: formData.get('email'),
    phone: formData.get('phone'),
    // Note: Billing address fields available but not used for Customer #2791
  },

  // Shipping address (ShippingAddresses array - SENT)
  shipping: {
    company: formData.get('shipping_company'),
    address1: formData.get('shipping_address1'),
    address2: formData.get('shipping_address2') || '',
    city: formData.get('shipping_city'),
    state: formData.get('shipping_state'),
    zip: formData.get('shipping_zip'),
    country: 'USA',
    method: 'UPS Ground'
  }
};
```

---

## Utility Functions

### Debounce (for autocomplete)
```javascript
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}
```

### XSS Prevention (for autocomplete)
```javascript
function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
```

### Form Validation
```javascript
function validateForm(formData) {
  const errors = [];

  if (!formData.get('firstName')) errors.push('First name is required');
  if (!formData.get('lastName')) errors.push('Last name is required');
  if (!formData.get('email')) errors.push('Email is required');

  const email = formData.get('email');
  if (email && !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
    errors.push('Valid email is required');
  }

  return errors;
}
```

---

## Complete Form Development Guide

**For detailed implementation including:**
- 5 complete form patterns
- File upload integration
- Customer autocomplete
- Real-time inventory
- Testing procedures
- Security best practices

**See:** [FIELD_REFERENCE_CORE.md - Form Development Guide](FIELD_REFERENCE_CORE.md#form-development-guide) (lines 1707-2528)

---

## Related Resources

**Implementation Examples:**
- [Implementation Examples](IMPLEMENTATION_EXAMPLES.md) - Working code snippets
- [Troubleshooting](TROUBLESHOOTING.md) - Common issues

**API Documentation:**
- [Customer Autocomplete](../manageorders/CUSTOMER_AUTOCOMPLETE.md) - Complete autocomplete guide
- [Inventory API](../manageorders/API_REFERENCE.md) - Real-time inventory checks
- [File Upload](../../caspio-pricing-proxy/memory/ONLINE_STORE_DEVELOPER_GUIDE.md) - Complete upload docs

**Field Specifications:**
- [Order & Customer Fields](ORDER_FIELDS.md) - Order-level fields
- [Product Fields](PRODUCT_FIELDS.md) - Line item fields
- [Payment & Shipping Fields](PAYMENT_SHIPPING_FIELDS.md) - Payment and address fields

---

**Version:** 2.0.1
**Last Updated:** October 29, 2025
**Maintained By:** Erik & Claude AI
**Questions:** Contact erik@nwcustomapparel.com
