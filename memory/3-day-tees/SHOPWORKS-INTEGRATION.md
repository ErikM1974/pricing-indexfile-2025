# 3-Day Tees - ShopWorks Integration Code Path

**Last Updated:** 2026-01-11
**Purpose:** Critical documentation about the ACTUAL code path for 3-Day Tees order submission
**Status:** CRITICAL - Read this before modifying order submission code!

> **NEW: For complete Stripe → ShopWorks flow documentation, see [ORDER_PUSH_FLOW.md](ORDER_PUSH_FLOW.md)**
>
> This document covers code paths only. For the full 8-phase flow diagram, webhook handling,
> ManageOrders payload structure, and payment info handling, see the comprehensive ORDER_PUSH_FLOW.md.

---

## 🚨 CRITICAL WARNING

**The 3-Day Tees order submission does NOT use the obvious code path!**

In November 2024, we spent hours debugging why edits to `three-day-tees-order-service.js` weren't working. That file was **completely unused dead code** and has been deleted. This document prevents that from happening again.

---

## ✅ The CORRECT Code Path

### Order Submission Flow

```
1. User completes Stripe Checkout
   ↓
2. Stripe redirects to: pages/3-day-tees-success.html
   ↓
3. Success page retrieves order data from sessionStorage
   ↓
4. Success page calls: POST /api/submit-3day-order
   ↓
5. server.js:749 handles the endpoint
   ↓
6. server.js builds ManageOrders payload (lines 901-970)
   ↓
7. Calls ManageOrders PUSH API via caspio-pricing-proxy
   ↓
8. Backend (manageorders-push-client.js) transforms and sends to ShopWorks
```

### Files in the CORRECT Code Path

| File | Lines | Purpose | Repository |
|------|-------|---------|------------|
| **pages/3-day-tees-success.html** | 884-937 | Stripe success page, calls API endpoint | pricing-indexfile-2025 |
| **server.js** | 749-1050 | `/api/submit-3day-order` endpoint - **THIS IS WHERE ORDER PAYLOAD IS BUILT** | pricing-indexfile-2025 |
| **caspio-pricing-proxy/lib/manageorders-push-client.js** | 1-673 | Backend transformation for ShopWorks API | caspio-pricing-proxy |

---

## ❌ Files That Are NOT Used (Deleted)

| File | Status | Why It Existed |
|------|--------|----------------|
| **shared_components/js/three-day-tees-order-service.js** | DELETED (Nov 2024) | Early prototype that was never integrated with Stripe flow |

**If you see ANY reference to `ThreeDayTeesOrderService` class - IT'S WRONG!**

---

## 🔧 Where to Make Changes

### To Modify Order Payload Structure

**File:** `server.js` (lines 901-970)
**Location:** `/api/submit-3day-order` endpoint

**Key fields in the payload:**

```javascript
const manageOrdersPayload = {
  orderNumber: tempOrderNumber,           // Required
  customerPurchaseOrder: tempOrderNumber, // Required for ShopWorks PO field
  customer: {
    company: customerData.company || '',
    firstName: customerData.firstName || '',
    lastName: customerData.lastName || '',
    email: customerData.email || '',
    phone: customerData.phone || ''
  },
  lineItems: lineItems,                   // Array of product items
  designs: designs,                       // Artwork URLs
  attachments: attachments,               // File attachments
  shipping: { ... },                      // Shipping address
  billing: { ... },                       // Billing address
  notes: [{                               // CRITICAL: Full order details
    type: 'Notes On Order',               // NOT "Notes To Production"
    note: `...full customer/payment info...`
  }],
  rushOrder: true,
  printLocation: orderSettings?.printLocationName || 'Left Chest',
  taxTotal: orderTotals?.salesTax || 0,
  taxPartNumber: 'Tax_10.1',
  cur_Shipping: orderTotals?.shipping || 0,
  totals: { ... },
  payments: paymentConfirmed ? [...] : []
};
```

### To Modify Success Page Behavior

**File:** `pages/3-day-tees-success.html` (lines 884-937)
**Function:** `submitOrderToShopWorks()`

This function:
1. Retrieves order data from `sessionStorage.getItem('3day_pending_order')`
2. Adds Stripe payment data
3. Posts to `/api/submit-3day-order`

### To Modify Backend Transformation

**File:** `caspio-pricing-proxy/lib/manageorders-push-client.js`
**Function:** `transformOrder()` (lines 80-130)

This transforms frontend camelCase fields → ShopWorks PascalCase fields.

**Example field mapping:**
- Frontend: `customerPurchaseOrder` → Backend: `CustomerPurchaseOrder`
- Frontend: `orderNumber` → Backend: `ExtOrderID: 'NWCA-{orderNumber}'`

---

## 🐛 Common Mistakes to Avoid

### ❌ WRONG: Editing the service file
```javascript
// DON'T EDIT THIS FILE - IT'S DELETED!
class ThreeDayTeesOrderService {
  static async submitOrder(orderData) {
    // This code is never called!
  }
}
```

### ✅ CORRECT: Editing server.js endpoint
```javascript
// server.js - Line 749
app.post('/api/submit-3day-order', async (req, res) => {
  // THIS is the actual code path!
});
```

---

## 📝 Critical Fields That Were Missing (Fixed Nov 2024)

### Issue #1: Empty CustomerPurchaseOrder Field

**Problem:** ShopWorks payload had empty `CustomerPurchaseOrder` field

**Root Cause:** Field wasn't added to payload in server.js

**Fix Applied (server.js:903):**
```javascript
const manageOrdersPayload = {
  orderNumber: tempOrderNumber,
  customerPurchaseOrder: tempOrderNumber,  // ← ADDED
  // ...
};
```

### Issue #2: Incomplete Notes

**Problem:** Notes only contained "3-Day Rush Order - Stripe Session: xxx"

**Root Cause:** server.js had minimal note text (lines 936-946)

**Fix Applied (server.js:937-954):**
```javascript
notes: [{
  type: 'Notes On Order',  // Changed from "Notes To Production"
  note: `3-DAY RUSH SERVICE - Ship within 72 hours from artwork approval.

Customer: ${customerData.firstName} ${customerData.lastName}
Email: ${customerData.email}
Phone: ${customerData.phone}
Company: ${customerData.company || 'N/A'}
Bill To: ${customerData.billingAddress1 || customerData.address1 || ''}, ${customerData.billingCity || customerData.city || ''}, ${customerData.billingState || customerData.state || ''} ${customerData.billingZip || customerData.zip || ''}
Special Instructions: ${customerData.notes || 'None'}

Payment Information:
Stripe Session: ${stripeSessionId || 'N/A'}
Payment Amount: $${paymentAmount ? (paymentAmount / 100).toFixed(2) : orderTotals?.grandTotal || 0}
Payment Status: ${paymentConfirmed ? 'succeeded' : 'pending'}

Total: $${orderTotals?.grandTotal || 0} (includes sales tax 10.1%)`
}]
```

### Issue #3: Wrong Note Type

**Problem:** Note type was "Notes To Production" (shows in work order, not customer notes)

**Fix:** Changed to "Notes On Order" (shows in customer-facing order notes)

---

## 🧪 Testing Checklist

After making changes to order submission:

- [ ] Restart Express server (`npm start`)
- [ ] Clear browser cache (Ctrl+Shift+R)
- [ ] Submit test order through Stripe
- [ ] Check server console logs for payload
- [ ] Verify ShopWorks payload contains:
  - [ ] `CustomerPurchaseOrder`: "3DT-MMDD-seq-ms"
  - [ ] `Notes` with Type: "Notes On Order"
  - [ ] Full customer details in notes
  - [ ] Billing address in notes
  - [ ] Payment information in notes
  - [ ] Special instructions in notes

---

## 🔗 Related Documentation

- **[ORDER_PUSH_FLOW.md](ORDER_PUSH_FLOW.md)** - Complete Stripe → ShopWorks flow (RECOMMENDED)
- [API-PATTERNS.md](API-PATTERNS.md) - API integration patterns
- [CODE-ORGANIZATION.md](CODE-ORGANIZATION.md) - File structure
- [../../memory/MANAGEORDERS_INTEGRATION.md](../MANAGEORDERS_INTEGRATION.md) - ShopWorks PULL API (different from PUSH)
- [../../memory/MANAGEORDERS_PUSH_INTEGRATION.md](../MANAGEORDERS_PUSH_INTEGRATION.md) - ManageOrders PUSH API reference

---

## 📋 Quick Reference

### Need to modify order submission?

1. **Frontend changes** → Edit `server.js:749-1050`
2. **Backend transformation** → Edit `caspio-pricing-proxy/lib/manageorders-push-client.js`
3. **Success page** → Edit `pages/3-day-tees-success.html:884-937`

### Need to debug order submission?

```javascript
// Add to server.js endpoint (around line 900)
console.log('Order payload being sent:', JSON.stringify(manageOrdersPayload, null, 2));
```

### Backend already supports:

- ✅ Both `customerPurchaseOrder` and `purchaseOrderNumber` field names (deployed Heroku v204)
- ✅ Note type "Notes On Order"
- ✅ Full note text with customer/billing/payment details

---

**Documentation Type:** Critical Integration Reference
**Parent Document:** [3-DAY-TEES-PROJECT-REQUIREMENTS.md](../../3-DAY-TEES-PROJECT-REQUIREMENTS.md)
**Related Docs:** All files in [/memory/3-day-tees/](.)
