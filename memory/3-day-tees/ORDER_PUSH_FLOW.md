# 3-Day Tees - Complete Order Push Flow

**Last Updated:** 2026-01-11
**Purpose:** Comprehensive documentation of Stripe payment + ManageOrders PUSH to ShopWorks
**Status:** Production-Ready (v2026.01)

---

## Overview

This document covers the complete order flow from customer checkout to ShopWorks order creation:
1. Stripe Checkout Session creation
2. Payment processing via webhook
3. ManageOrders payload transformation
4. Payment info storage in ShopWorks

---

## Complete Flow Diagram

```
                    CUSTOMER CHECKOUT FLOW
                    ═══════════════════════

┌─────────────────────────────────────────────────────────────────┐
│  PHASE 1: Customer fills out order form                         │
│  File: pages/3-day-tees.html + pages/js/3-day-tees.js          │
│                                                                 │
│  - Three-step wizard: Print Location → Colors & Quantities →   │
│    Checkout                                                     │
│  - Customer enters: email, name, addresses, phone, notes       │
│  - System calculates: pricing, tax (10.1%), rush fee           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 2: Create Checkout Session                               │
│  File: server.js:869-982                                        │
│                                                                 │
│  POST /api/create-checkout-session                              │
│  1. Generate QuoteID (e.g., "3DT-0111-001")                    │
│  2. SAVE TO CASPIO FIRST (prevents data loss)                  │
│     - Stores: customerData, colorConfigs, orderTotals,         │
│       orderSettings as JSON                                     │
│  3. Create Stripe Checkout Session                              │
│  4. Update Caspio with Stripe session ID                        │
│  5. Return session URL for redirect                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 3: Stripe Hosted Checkout                                │
│  External: checkout.stripe.com                                  │
│                                                                 │
│  - Customer enters payment details on Stripe's secure page     │
│  - On success: redirects to 3-day-tees-success.html            │
│  - On cancel: redirects to 3-day-tees.html                     │
│                                                                 │
│  CRITICAL: Order data is in CASPIO (not Stripe metadata)       │
│            Stripe metadata only contains: quoteID, source      │
└─────────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┴───────────────────┐
          │                                       │
          ▼                                       ▼
┌─────────────────────────┐         ┌─────────────────────────────┐
│  PRODUCTION PATH        │         │  LOCALHOST PATH (Fallback)  │
│  (Stripe Webhook)       │         │  (Success Page Auto-Submit) │
│                         │         │                             │
│  File: server.js:178-317│         │  File: 3-day-tees-success   │
│  POST /api/stripe/      │         │        .html:845-998        │
│       webhook           │         │                             │
│                         │         │  If Status != "Processed":  │
│  Event: checkout.       │         │  Auto-submit order via      │
│  session.completed      │         │  /api/submit-3day-order     │
└─────────────────────────┘         └─────────────────────────────┘
          │                                       │
          └───────────────────┬───────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 4: Order Submission                                      │
│  File: server.js:1046-1337                                      │
│                                                                 │
│  POST /api/submit-3day-order                                    │
│  1. Retrieve order data (from request body or Caspio)          │
│  2. Build line items with pricing                               │
│  3. Add designs (artwork URLs for production)                   │
│  4. Add attachments (downloadable files)                        │
│  5. Build ManageOrders payload                                  │
│  6. Add payment record (if payment confirmed)                   │
│  7. POST to ManageOrders PUSH API                               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 5: ManageOrders PUSH API (caspio-pricing-proxy)         │
│  File: lib/manageorders-push-client.js                          │
│                                                                 │
│  POST /api/manageorders/orders/create                           │
│  1. Transform camelCase → PascalCase                           │
│  2. Add NWCA- prefix to order number                           │
│  3. Format dates (YYYY-MM-DD → MM/DD/YYYY)                     │
│  4. Normalize sizes (e.g., "Large" → "L")                      │
│  5. Forward to ManageOrders API                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 6: ManageOrders → ShopWorks OnSite                      │
│  External: ManageOrders cloud service                          │
│                                                                 │
│  - Order queued for import to ShopWorks                        │
│  - Typically imports within 1-5 minutes                        │
│  - Appears in ShopWorks with full details                      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 7: Update Caspio Status                                  │
│  Both paths update quote_sessions table                         │
│                                                                 │
│  Status progression:                                            │
│  "Checkout Created" → "Payment Confirmed" → "Processed"        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 8: Email Notifications                                   │
│  File: pages/3-day-tees-success.html                           │
│                                                                 │
│  - Customer confirmation email (EmailJS)                        │
│  - Admin notification email                                     │
│  - Success page displays order summary                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## Key Code Locations

### 1. Stripe Checkout Session Creation

**File:** `server.js`
**Lines:** 869-982
**Endpoint:** `POST /api/create-checkout-session`

```javascript
// Line 869-982 - Key operations:

// 1. Generate QuoteID (line 893)
const quoteID = generate3DTQuoteID();

// 2. Save to Caspio BEFORE Stripe redirect (lines 897-915)
await save3DTQuoteSession({
  quoteID,
  customerData,
  orderTotals,
  colorConfigs,
  orderSettings,
  stripeSessionId: null
});

// 3. Create Stripe session with minimal metadata (lines 930-944)
const sessionConfig = {
  payment_method_types: ['card'],
  line_items: line_items || [],
  mode: 'payment',
  customer_email: customer_email,
  success_url: successUrl + `&quote_id=${quoteID}`,
  cancel_url: cancelUrl,
  metadata: {
    quoteID: quoteID,
    source: '3day-tees'
    // NOTE: Full order data stored in Caspio (not Stripe metadata)
    // This eliminates Stripe's 500-character metadata limit
  }
};
```

### 2. Stripe Webhook Handler

**File:** `server.js`
**Lines:** 178-317
**Endpoint:** `POST /api/stripe/webhook`

```javascript
// CRITICAL: Raw body required for signature verification (line 178)
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {

  // 1. Verify webhook signature (lines 197-204)
  const sig = req.headers['stripe-signature'];
  const event = stripeInstance.webhooks.constructEvent(req.body, sig, endpointSecret);

  // 2. Handle checkout.session.completed event (line 208)
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const quoteID = session.metadata.quoteID;

    // 3. Check idempotency - prevent duplicate processing (lines 220-232)
    if (quoteSession.Status === 'Payment Confirmed' || quoteSession.Status === 'Processed') {
      return res.json({ received: true, status: 'duplicate' });
    }

    // 4. Retrieve full order data from Caspio (lines 249-256)
    const orderData = {
      customerData: JSON.parse(quoteSession.CustomerDataJSON || '{}'),
      colorConfigs: JSON.parse(quoteSession.ColorConfigsJSON || '{}'),
      orderTotals: JSON.parse(quoteSession.OrderTotalsJSON || '{}'),
      orderSettings: JSON.parse(quoteSession.OrderSettingsJSON || '{}')
    };

    // 5. Submit to ShopWorks (lines 260-276)
    const shopWorksResponse = await fetch(`${baseUrl}/api/submit-3day-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tempOrderNumber: quoteID,
        customerData: orderData.customerData,
        colorConfigs: orderData.colorConfigs,
        orderTotals: orderData.orderTotals,
        orderSettings: orderData.orderSettings,
        paymentConfirmed: true,
        stripeSessionId: session.id,
        paymentAmount: session.amount_total
      })
    });
  }
});
```

### 3. ManageOrders Payload Construction

**File:** `server.js`
**Lines:** 1211-1293
**Endpoint:** `POST /api/submit-3day-order`

```javascript
// Line 1211-1293 - Complete ManageOrders payload

const manageOrdersPayload = {
  // Order identification
  orderNumber: tempOrderNumber,           // e.g., "3DT-0111-001"
  customerPurchaseOrder: tempOrderNumber, // PO Number in ShopWorks

  // Customer contact info (line 1214-1220)
  customer: {
    company: customerData.company || '',
    firstName: customerData.firstName || '',
    lastName: customerData.lastName || '',
    email: customerData.email || '',
    phone: customerData.phone || ''
  },

  // Products to fulfill
  lineItems: lineItems,     // Built earlier in function
  designs: designs,         // Artwork URLs for production
  attachments: attachments, // Downloadable file links

  // Shipping address (lines 1224-1235)
  shipping: {
    company: customerData.company || '',
    firstName: customerData.firstName || '',
    lastName: customerData.lastName || '',
    address1: customerData.address1 || customerData.address || '',
    address2: customerData.address2 || '',
    city: customerData.city || '',
    state: customerData.state || '',
    zip: customerData.zip || customerData.zipCode || '',
    country: 'USA',
    method: 'UPS Ground'
  },

  // Billing address (lines 1237-1245)
  billing: {
    company: customerData.billingCompany || customerData.company || '',
    address1: customerData.billingAddress1 || customerData.address1 || '',
    address2: '',
    city: customerData.billingCity || customerData.city || '',
    state: customerData.billingState || customerData.state || '',
    zip: customerData.billingZip || customerData.zip || '',
    country: 'USA'
  },

  // Order notes with payment info (lines 1247-1264)
  notes: [{
    type: 'Notes On Order',
    note: `3-DAY RUSH SERVICE - Ship within 72 hours from artwork approval.

Customer: ${customerData.firstName} ${customerData.lastName}
Email: ${customerData.email}
Phone: ${customerData.phone}
Company: ${customerData.company || 'N/A'}
Bill To: ${billingAddress}
Special Instructions: ${customerData.notes || 'None'}

Payment Information:
Stripe Session: ${stripeSessionId || 'N/A'}
Payment Amount: $${paymentAmount}
Payment Status: ${paymentConfirmed ? 'succeeded' : 'pending'}

Total: $${orderTotals?.grandTotal || 0} (includes sales tax 10.1%)`
  }],

  // Rush order flag
  rushOrder: true,
  printLocation: orderSettings?.printLocationName || 'Left Chest',

  // Tax fields (lines 1267-1270)
  taxTotal: orderTotals?.salesTax || 0,
  taxPartNumber: 'Tax_10.1',
  taxPartDescription: 'City of Milton Sales Tax 10.1%',

  // Shipping charge
  cur_Shipping: orderTotals?.shipping || 0,

  // Order totals (lines 1273-1279)
  totals: {
    subtotal: orderTotals?.subtotal || 0,
    rushFee: orderTotals?.rushFee || 0,
    salesTax: orderTotals?.salesTax || 0,
    shipping: orderTotals?.shipping || 0,
    grandTotal: orderTotals?.grandTotal || 0
  },

  // PAYMENT RECORD (lines 1281-1292) - CRITICAL FOR SHOPWORKS
  payments: paymentConfirmed ? [{
    date: new Date().toISOString().split('T')[0],  // YYYY-MM-DD
    amount: parseFloat((paymentAmount / 100).toFixed(2)), // Cents to dollars
    status: 'success',                              // MUST be "success"
    gateway: 'Stripe',
    authCode: stripeSessionId || '',
    accountNumber: String(stripeSessionId || ''),
    cardCompany: 'Stripe Checkout',
    responseCode: 'approved',
    responseReasonCode: 'checkout_complete',
    responseReasonText: 'Payment completed via Stripe Checkout'
  }] : []
};
```

---

## Payment Info in ShopWorks

Payment information appears in TWO places in ShopWorks:

### 1. Payments Array → ShopWorks Payments Tab

```javascript
// server.js:1281-1292
payments: [{
  date: '2026-01-11',           // → Payment Date
  amount: 156.78,               // → Payment Amount
  status: 'success',            // CRITICAL: Must be "success"
  gateway: 'Stripe',            // → Gateway field
  authCode: 'cs_live_xxx',      // → Auth Code field
  accountNumber: 'cs_live_xxx', // → Account Number field
  cardCompany: 'Stripe Checkout', // → Card Company field
  responseCode: 'approved',
  responseReasonCode: 'checkout_complete',
  responseReasonText: 'Payment completed via Stripe Checkout'
}]
```

**In ShopWorks:** Order → Payments tab shows:
- Date: 01/11/2026
- Amount: $156.78
- Gateway: Stripe
- Auth Code: cs_live_xxx
- Status: success

### 2. Notes Array → ShopWorks Order Notes

```javascript
// server.js:1247-1264
notes: [{
  type: 'Notes On Order',
  note: `...
Payment Information:
Stripe Session: cs_live_a1b2c3d4e5f6...
Payment Amount: $156.78
Payment Status: succeeded
...`
}]
```

**In ShopWorks:** Order → Notes tab shows full customer and payment details.

---

## Caspio quote_sessions Table

All order data is stored in Caspio for reliability:

### Table Structure

| Column | Purpose | Example |
|--------|---------|---------|
| `PK_ID` | Primary key | 12345 |
| `QuoteID` | Order identifier | "3DT-0111-001" |
| `Status` | Order status | "Checkout Created", "Payment Confirmed", "Processed" |
| `SessionID` | Stripe session | "stripe_cs_live_xxx" |
| `CustomerDataJSON` | Full customer data | JSON blob |
| `ColorConfigsJSON` | Color/size selections | JSON blob |
| `OrderTotalsJSON` | Pricing breakdown | JSON blob |
| `OrderSettingsJSON` | Print location, etc. | JSON blob |
| `Notes` | Status history | Timestamped log |

### Status Progression

```
1. "Checkout Created"          - Initial save when Stripe session created
2. "Payment Confirmed"         - Webhook received successful payment
3. "Processed"                 - Order submitted to ShopWorks
4. "Payment Confirmed -        - Webhook payment OK but ShopWorks failed
    ShopWorks Failed"            (requires manual processing)
```

---

## Two-Path Order Submission

### Production Path (Webhook)

```
Stripe Payment → Webhook Event → server.js:178 → Submit Order
```

- **When:** Stripe webhook is configured and reachable
- **Reliability:** Stripe retries failed webhooks for up to 3 days
- **Idempotency:** Checks Caspio status before processing

### Localhost/Fallback Path (Success Page)

```
Stripe Payment → Success Page → Poll Caspio → Submit if needed
```

- **When:** Running locally (no webhook) OR webhook failed
- **Location:** `pages/3-day-tees-success.html:845-998`
- **Safety:** Only submits if Status is NOT "Processed"

---

## API Endpoints Summary

| Endpoint | Method | File:Line | Purpose |
|----------|--------|-----------|---------|
| `/api/create-checkout-session` | POST | server.js:869 | Create Stripe session |
| `/api/stripe/webhook` | POST | server.js:178 | Process payment events |
| `/api/verify-checkout-session` | POST | server.js:984 | Verify session status |
| `/api/submit-3day-order` | POST | server.js:1046 | Submit to ShopWorks |

---

## Troubleshooting

### Order Not Appearing in ShopWorks

1. **Check Caspio Status:**
   ```
   GET /api/quote_sessions?filter=QuoteID='3DT-0111-001'
   ```
   - If "Checkout Created": Payment not completed
   - If "Payment Confirmed": ShopWorks submission pending
   - If "Payment Confirmed - ShopWorks Failed": Manual intervention needed

2. **Check Server Logs:**
   ```
   heroku logs --tail --app pricing-index-proxy
   ```
   Look for `[3-Day Order]` and `[Webhook]` log entries.

3. **Verify Webhook Configuration:**
   - Stripe Dashboard → Webhooks → Check for failed events
   - Ensure endpoint URL matches production URL

### Payment Shows in Stripe but Not ShopWorks

1. Check Caspio quote_sessions for status
2. Verify webhook endpoint is receiving events
3. Check if `paymentConfirmed` was true when submitting

### Duplicate Orders

The system has idempotency protection:
- Webhook checks: `Status === 'Processed'` → skip
- Success page checks: `Status !== 'Processed'` → auto-submit

If duplicates occur, check for:
- Multiple webhook retries with race condition
- Both webhook AND success page submitting

---

## Related Documentation

| Document | Purpose |
|----------|---------|
| [SHOPWORKS-INTEGRATION.md](SHOPWORKS-INTEGRATION.md) | Code path reference (older) |
| [STRIPE-PREREQUISITES.md](STRIPE-PREREQUISITES.md) | Stripe setup requirements |
| [STRIPE-TESTING-GUIDE.md](STRIPE-TESTING-GUIDE.md) | Test card numbers, etc. |
| [../MANAGEORDERS_PUSH_INTEGRATION.md](../MANAGEORDERS_PUSH_INTEGRATION.md) | Full ManageOrders API docs |

---

## Quick Reference

### Need to modify order payload?
Edit `server.js:1211-1293`

### Need to modify payment handling?
Edit `server.js:1281-1292` (payments array)

### Need to modify webhook logic?
Edit `server.js:178-317`

### Need to add new fields to ShopWorks?
1. Add to payload in `server.js`
2. Ensure `caspio-pricing-proxy/lib/manageorders-push-client.js` transforms correctly

---

**Document Type:** Integration Reference
**Last Code Review:** January 2026
