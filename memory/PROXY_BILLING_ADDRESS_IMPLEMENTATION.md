# caspio-pricing-proxy: Billing Address Implementation Required

**Date Created:** 2025-10-29
**Purpose:** Document required changes to caspio-pricing-proxy for billing address support
**Related Feature:** Billing + Shipping address separation in sample order form

---

## ⚠️ IMPORTANT: Proxy Changes Required

The **Pricing Index File 2025** (this repository) has been updated to send separate billing and shipping addresses. However, the **caspio-pricing-proxy** (separate repository) needs to be updated to properly transform and forward these fields to the ManageOrders API.

**Without these proxy changes, billing address data will not reach ShopWorks OnSite.**

---

## Current Implementation Status

### ✅ Frontend (Pricing Index - COMPLETE)

**Files Modified:**
1. `shared_components/js/sample-order-service.js` - Now sends `billing` object
2. `pages/sample-cart.html` - Separate billing/shipping forms with checkbox

**Data Structure Being Sent:**
```javascript
const order = {
    // ... other fields
    billing: {
        company: "ABC Company",
        address1: "123 Main St",
        address2: "Suite 400",
        city: "Seattle",
        state: "WA",
        zip: "98101",
        country: "USA"
    },
    shipping: {
        company: "ABC Company",
        address1: "456 Oak Ave",
        address2: "Warehouse B",
        city: "Tacoma",
        state: "WA",
        zip: "98402",
        country: "USA",
        method: "UPS Ground"
    }
};
```

### ❌ Backend (caspio-pricing-proxy - NEEDS UPDATE)

**Repository:** caspio-pricing-proxy (separate from this repo)
**File Requiring Changes:** `lib/manageorders-push-client.js`

---

## Required Proxy Changes

### Change 1: Add Billing Fields to Customer Block

**Location:** `lib/manageorders-push-client.js` (around line 99-110)

**Current Code:**
```javascript
// Add Customer block
manageOrdersOrder.Customer = {
  id_Customer: 2791,  // Web orders customer
  ContactFirstName: orderData.customer.firstName,
  ContactLastName: orderData.customer.lastName,
  ContactEmail: orderData.customer.email,
  ContactPhone: orderData.customer.phone,
};
```

**Updated Code:**
```javascript
// Add Customer block with billing address
manageOrdersOrder.Customer = {
  id_Customer: 2791,  // Web orders customer
  ContactFirstName: orderData.customer.firstName,
  ContactLastName: orderData.customer.lastName,
  ContactEmail: orderData.customer.email,
  ContactPhone: orderData.customer.phone,

  // Billing address fields (NEW)
  BillingCompany: orderData.billing?.company || orderData.customer.company || '',
  BillingAddress01: orderData.billing?.address1 || '',
  BillingAddress02: orderData.billing?.address2 || '',
  BillingCity: orderData.billing?.city || '',
  BillingState: orderData.billing?.state || '',
  BillingZip: orderData.billing?.zip || '',
  BillingCountry: orderData.billing?.country || 'USA'
};
```

### Change 2: Ensure ShippingAddresses is Array

**Location:** `lib/manageorders-push-client.js` (around line 207-219)

**Current Code:**
```javascript
function transformShippingAddress(shipping) {
  return {
    ShipCompany: shipping.company || '',
    ShipAddress01: shipping.address1 || '',
    ShipAddress02: shipping.address2 || '',
    ShipCity: shipping.city || '',
    ShipState: shipping.state || '',
    ShipZip: shipping.zip || '',
    ShipCountry: shipping.country || 'USA',
    ShipMethod: shipping.method || 'UPS Ground',
  };
}
```

**Verify it's being used in array format:**
```javascript
// In transformOrder() function:
manageOrdersOrder.ShippingAddresses = [
  transformShippingAddress(orderData.shipping)
];
```

---

## ManageOrders API Field Mapping

### Billing Fields (Customer Block)
| Frontend Field | Proxy Field | API Field | Purpose |
|----------------|-------------|-----------|---------|
| `billing.company` | `billing.company` | `BillingCompany` | Company name for billing |
| `billing.address1` | `billing.address1` | `BillingAddress01` | Street address |
| `billing.address2` | `billing.address2` | `BillingAddress02` | Apt/Suite |
| `billing.city` | `billing.city` | `BillingCity` | City |
| `billing.state` | `billing.state` | `BillingState` | State (2-letter) |
| `billing.zip` | `billing.zip` | `BillingZip` | ZIP code |
| `billing.country` | `billing.country` | `BillingCountry` | Country (USA) |

### Shipping Fields (ShippingAddresses Array)
| Frontend Field | Proxy Field | API Field | Purpose |
|----------------|-------------|-----------|---------|
| `shipping.company` | `shipping.company` | `ShipCompany` | Company name for shipping |
| `shipping.address1` | `shipping.address1` | `ShipAddress01` | Street address |
| `shipping.address2` | `shipping.address2` | `ShipAddress02` | Apt/Suite |
| `shipping.city` | `shipping.city` | `ShipCity` | City |
| `shipping.state` | `shipping.state` | `ShipState` | State (2-letter) |
| `shipping.zip` | `shipping.zip` | `ShipZip` or `ShipPostalCode` | ZIP code |
| `shipping.country` | `shipping.country` | `ShipCountry` | Country (USA) |
| `shipping.method` | `shipping.method` | `ShipMethod` | Shipping method |

---

## Testing Procedure

### After Implementing Proxy Changes:

1. **Submit Test Order:**
   - Fill out sample request form
   - Use billing address: 123 Main St, Seattle, WA 98101
   - Uncheck "Same as billing"
   - Use shipping address: 456 Oak Ave, Tacoma, WA 98402
   - Set `isTest: true` in sample-order-service.js

2. **Verify API Payload:**
   ```javascript
   // Check caspio-pricing-proxy console logs
   console.log('Order to ManageOrders:', transformedOrder);

   // Should see:
   {
     Customer: {
       BillingAddress01: "123 Main St",
       BillingCity: "Seattle",
       BillingZip: "98101"
     },
     ShippingAddresses: [{
       ShipAddress01: "456 Oak Ave",
       ShipCity: "Tacoma",
       ShipZip: "98402"
     }]
   }
   ```

3. **Check ShopWorks OnSite:**
   - Wait for hourly import
   - Open order in OnSite 7
   - Verify Customer block shows billing address
   - Verify Shipping block shows shipping address

4. **Test Same-as-Billing:**
   - Submit order with "Same as billing" checked
   - Verify both addresses are identical in OnSite

---

## Fallback Behavior

**If billing address is missing** (shouldn't happen with frontend validation, but defensive coding):

```javascript
// Use shipping address as fallback for billing
BillingAddress01: orderData.billing?.address1 || orderData.shipping?.address1 || '',
BillingCity: orderData.billing?.city || orderData.shipping?.city || '',
// ... etc
```

---

## Git Commits

### Pricing Index File 2025 (This Repo)
- Commit: [to be created]
- Files: `sample-cart.html`, `sample-order-service.js`
- Summary: Added billing/shipping address separation with "same as billing" checkbox

### caspio-pricing-proxy (Separate Repo)
- Commit: [to be created after implementation]
- File: `lib/manageorders-push-client.js`
- Summary: Added billing address transformation to Customer block

---

## Related Documentation

- **ManageOrders PUSH API:** `memory/MANAGEORDERS_PUSH_WEBSTORE.md`
- **Complete Field Reference:** `memory/MANAGEORDERS_PUSH_COMPLETE_FIELD_REFERENCE.md`
- **API Specification:** Swagger spec (158+ fields documented)

---

## Status Tracking

- [x] Frontend implementation complete (Pricing Index File 2025)
- [ ] Proxy implementation needed (caspio-pricing-proxy)
- [ ] Testing with separate addresses
- [ ] Testing with same-as-billing checked
- [ ] Production deployment

**Last Updated:** 2025-10-29
