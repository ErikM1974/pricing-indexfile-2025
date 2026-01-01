# Stripe Integration Guide for 3-Day Tees

**Last Updated:** 2025-11-25
**Purpose:** Comprehensive guide for Stripe payment integration, debugging, and best practices
**Status:** Production-ready

---

## 📋 Quick Navigation

- [Architecture Overview](#architecture-overview)
- [Issue Diagnosis & Fixes](#issue-diagnosis--fixes)
- [Code Patterns](#code-patterns)
- [Security Best Practices](#security-best-practices)
- [Testing Guide](#testing-guide)
- [Troubleshooting](#troubleshooting)

---

## 🏗️ Architecture Overview

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Browser (3-Day Tees Page)                │
│                                                             │
│  stripe-service.js (StripePaymentService class)            │
│  - Initializes Stripe.js with publishable key              │
│  - Creates card elements (split or combined)               │
│  - Handles payment confirmation                            │
│  - Provides human-readable error messages                  │
└────────────────────────┬────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│                    Express Server (server.js)               │
│                                                             │
│  /api/stripe-config                                        │
│  - Returns publishable key based on STRIPE_MODE            │
│                                                             │
│  /api/create-payment-intent                                │
│  - Creates PaymentIntent with secret key                   │
│  - Supports idempotency keys                               │
│  - Returns clientSecret for frontend confirmation          │
└────────────────────────┬────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│                    Stripe API                               │
│                                                             │
│  - PaymentIntents API for secure payments                  │
│  - Webhook events for async updates                        │
└─────────────────────────────────────────────────────────────┘
```

### Key Files

| File | Purpose | Location |
|------|---------|----------|
| `server.js` | Express server with Stripe endpoints | Root directory |
| `stripe-service.js` | Frontend Stripe service class | `pages/js/` |
| `.env` | Environment variables (API keys) | Root directory |
| `3-day-tees.html` | Payment page UI | `pages/` |

### Environment Variables

```env
# Stripe Environment (development | production)
STRIPE_MODE=development

# Test Keys (for development)
STRIPE_TEST_PUBLIC_KEY=pk_test_51QG3F7...
STRIPE_TEST_SECRET_KEY=sk_test_51QG3F7...

# Live Keys (for production)
STRIPE_LIVE_PUBLIC_KEY=pk_live_...
STRIPE_LIVE_SECRET_KEY=sk_live_...

# Webhook Secret
STRIPE_WEBHOOK_SECRET=whsec_...
```

---

## 🔧 Issue Diagnosis & Fixes

### Issue 1: "Invalid API Key provided"

**Symptoms:**
- `/api/create-payment-intent` returns 500 error
- Error message: "Invalid API Key provided: undefined"

**Root Causes:**
1. `.env` file not loaded (missing `require('dotenv').config()`)
2. Wrong environment variable names
3. STRIPE_MODE mismatch with available keys

**Diagnostic Steps:**
```javascript
// Add to server.js to debug key loading
console.log('[Stripe Debug] Mode:', process.env.STRIPE_MODE);
console.log('[Stripe Debug] Key exists:', !!secretKey);
console.log('[Stripe Debug] Key prefix:', secretKey?.substring(0, 12) + '...');
console.log('[Stripe Debug] Key length:', secretKey?.length);
```

**Fix:**
```javascript
// Ensure dotenv is loaded at the very top of server.js
require('dotenv').config();

// Use correct key based on mode
const stripeMode = process.env.STRIPE_MODE || 'development';
const secretKey = stripeMode === 'production'
    ? process.env.STRIPE_LIVE_SECRET_KEY
    : process.env.STRIPE_TEST_SECRET_KEY;
```

### Issue 2: "Unknown arguments ([object Object])"

**Symptoms:**
- Payment intent creation fails
- Keys are loading correctly (verified via debug logs)
- Error from Stripe SDK

**Root Cause:**
Passing empty `requestOptions` object as second argument to `paymentIntents.create()`:

```javascript
// ❌ WRONG - Empty object causes error
const requestOptions = {};
if (idempotencyKey) {
    requestOptions.idempotencyKey = idempotencyKey;
}
const paymentIntent = await stripe.paymentIntents.create(createOptions, requestOptions);
```

**Fix:**
```javascript
// ✅ CORRECT - Only pass options when needed
let paymentIntent;
if (idempotencyKey) {
    paymentIntent = await stripe.paymentIntents.create(createOptions, {
        idempotencyKey: idempotencyKey
    });
} else {
    paymentIntent = await stripe.paymentIntents.create(createOptions);
}
```

### Issue 3: Stripe.js Not Loading

**Symptoms:**
- `Stripe is undefined` error in browser console
- Card elements don't appear

**Fix:**
Ensure Stripe.js is loaded before your scripts:
```html
<!-- Load Stripe.js FIRST -->
<script src="https://js.stripe.com/v3/"></script>

<!-- Then load your service -->
<script src="/pages/js/stripe-service.js"></script>
```

---

## 💻 Code Patterns

### Frontend: StripePaymentService Class

**Location:** `pages/js/stripe-service.js`

```javascript
class StripePaymentService {
    constructor() {
        this.stripe = null;
        this.elements = null;
        this.cardElements = {};
        this.isInitialized = false;
        this.initializationPromise = null;
    }

    // Singleton initialization pattern
    async initialize() {
        if (this.initializationPromise) {
            return this.initializationPromise;
        }
        if (this.isInitialized) {
            return true;
        }
        this.initializationPromise = this._doInitialize();
        return this.initializationPromise;
    }

    async _doInitialize() {
        // Fetch publishable key from server
        const response = await fetch('/api/stripe-config');
        const { publishableKey } = await response.json();

        // Initialize Stripe
        this.stripe = Stripe(publishableKey);
        this.elements = this.stripe.elements();
        this.isInitialized = true;
        return true;
    }

    // Process payment with idempotency
    async processPayment(amount, billingDetails, orderId = null) {
        const idempotencyKey = orderId
            ? `${orderId}_${Date.now()}`
            : `payment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // Create payment intent
        const intentResponse = await fetch('/api/create-payment-intent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                amount: Math.round(amount * 100), // Convert to cents
                currency: 'usd',
                orderId,
                idempotencyKey
            })
        });

        const { clientSecret } = await intentResponse.json();

        // Confirm payment
        const { error, paymentIntent } = await this.stripe.confirmCardPayment(
            clientSecret,
            {
                payment_method: {
                    card: this.getCardElement(),
                    billing_details: billingDetails
                }
            }
        );

        if (error) {
            return {
                success: false,
                error: this.getHumanReadableError(error)
            };
        }

        return {
            success: paymentIntent.status === 'succeeded',
            paymentIntentId: paymentIntent.id
        };
    }
}

// Export as singleton
window.StripePaymentService = new StripePaymentService();
```

### Backend: Express Endpoints

**Location:** `server.js`

```javascript
// GET /api/stripe-config
app.get('/api/stripe-config', (req, res) => {
    const stripeMode = process.env.STRIPE_MODE || 'development';
    const publishableKey = stripeMode === 'production'
        ? process.env.STRIPE_LIVE_PUBLIC_KEY
        : process.env.STRIPE_TEST_PUBLIC_KEY;

    res.json({ publishableKey });
});

// POST /api/create-payment-intent
app.post('/api/create-payment-intent', async (req, res) => {
    try {
        const { amount, currency = 'usd', orderId, idempotencyKey } = req.body;

        // Validate amount
        if (!amount || amount < 50) {
            return res.status(400).json({
                error: 'Amount must be at least 50 cents'
            });
        }

        // Get appropriate Stripe instance
        const stripeMode = process.env.STRIPE_MODE || 'development';
        const secretKey = stripeMode === 'production'
            ? process.env.STRIPE_LIVE_SECRET_KEY
            : process.env.STRIPE_TEST_SECRET_KEY;

        const stripe = require('stripe')(secretKey);

        // Create payment intent options
        const createOptions = {
            amount: Math.round(amount),
            currency,
            automatic_payment_methods: { enabled: true }
        };

        if (orderId) {
            createOptions.metadata = { orderId };
        }

        // Create with or without idempotency key
        let paymentIntent;
        if (idempotencyKey) {
            paymentIntent = await stripe.paymentIntents.create(createOptions, {
                idempotencyKey
            });
        } else {
            paymentIntent = await stripe.paymentIntents.create(createOptions);
        }

        res.json({
            clientSecret: paymentIntent.client_secret,
            paymentIntentId: paymentIntent.id
        });

    } catch (error) {
        console.error('[Stripe] Error:', error.message);
        res.status(500).json({
            error: error.message || 'Payment creation failed'
        });
    }
});
```

---

## 🔒 Security Best Practices

### 1. Never Expose Secret Keys

```javascript
// ❌ WRONG - Secret key in frontend code
const stripe = Stripe('sk_test_...');

// ✅ CORRECT - Only publishable key in frontend
const stripe = Stripe('pk_test_...');
```

### 2. Server-Side Amount Calculation

```javascript
// ❌ WRONG - Trust client-provided amount
const { amount } = req.body;
await stripe.paymentIntents.create({ amount });

// ✅ CORRECT - Calculate amount server-side
const cartItems = await getCartItems(orderId);
const amount = calculateTotal(cartItems);
await stripe.paymentIntents.create({ amount });
```

### 3. Use Idempotency Keys

```javascript
// Prevent duplicate charges from retries
const idempotencyKey = `order_${orderId}_${timestamp}`;
await stripe.paymentIntents.create(options, { idempotencyKey });
```

### 4. Validate Webhook Signatures

```javascript
app.post('/webhook', (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        event = stripe.webhooks.constructEvent(
            req.rawBody,
            sig,
            process.env.STRIPE_WEBHOOK_SECRET
        );
    } catch (err) {
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle event
    res.json({ received: true });
});
```

### 5. Environment Separation

```javascript
// Always check mode before using keys
const stripeMode = process.env.STRIPE_MODE || 'development';

// Never use live keys in development
if (stripeMode === 'development' && secretKey.startsWith('sk_live_')) {
    throw new Error('Live keys cannot be used in development mode');
}
```

---

## 🧪 Testing Guide

### Test Card Numbers

| Card Number | Scenario |
|-------------|----------|
| `4242 4242 4242 4242` | Success |
| `4000 0000 0000 9995` | Insufficient funds |
| `4000 0000 0000 0002` | Card declined |
| `4000 0025 0000 3155` | Requires 3D Secure |
| `4000 0000 0000 0069` | Expired card |

### API Testing with cURL

```bash
# Test config endpoint
curl http://localhost:3000/api/stripe-config

# Test payment intent creation
curl -X POST http://localhost:3000/api/create-payment-intent \
  -H "Content-Type: application/json" \
  -d '{"amount": 1000, "currency": "usd", "orderId": "test-123"}'

# Expected response:
# {"clientSecret":"pi_xxx_secret_xxx","paymentIntentId":"pi_xxx"}
```

### Console Debugging

```javascript
// Check service status
console.log('Stripe initialized:', window.StripePaymentService.isReady());

// Test payment flow
const result = await window.StripePaymentService.processPayment(
    50.00,
    { name: 'Test User', email: 'test@example.com' },
    'test-order-123'
);
console.log('Payment result:', result);
```

---

## 🔍 Troubleshooting

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `Invalid API Key provided` | Wrong/missing secret key | Check `.env` and STRIPE_MODE |
| `Unknown arguments` | Empty options object | Only pass options when needed |
| `Stripe is not defined` | Stripe.js not loaded | Add script tag before service |
| `Payment requires action` | 3D Secure required | Handle `requires_action` status |
| `No such payment_method` | Card element not mounted | Verify element mounting |

### Debug Checklist

1. **Server-side:**
   - [ ] `dotenv` loaded at top of server.js
   - [ ] Correct environment variable names
   - [ ] STRIPE_MODE matches available keys
   - [ ] Debug logging enabled

2. **Client-side:**
   - [ ] Stripe.js loaded before custom scripts
   - [ ] Service initialized before use
   - [ ] Card elements mounted to DOM
   - [ ] Error handling for all responses

3. **Environment:**
   - [ ] `.env` file exists in root directory
   - [ ] No spaces around `=` in `.env`
   - [ ] No quotes around values in `.env`
   - [ ] Keys match test/live mode

### Server Debug Logging

Add this to `server.js` for troubleshooting:

```javascript
// Add at the payment intent endpoint
console.log('[Stripe Debug] Mode:', process.env.STRIPE_MODE);
console.log('[Stripe Debug] Key exists:', !!secretKey);
console.log('[Stripe Debug] Key prefix:', secretKey?.substring(0, 12) + '...');
console.log('[Stripe Debug] Key length:', secretKey?.length);
console.log('[Stripe Debug] ENV STRIPE_MODE:', process.env.STRIPE_MODE);
console.log('[Stripe Debug] ENV TEST_KEY exists:', !!process.env.STRIPE_TEST_SECRET_KEY);
console.log('[Stripe Debug] ENV LIVE_KEY exists:', !!process.env.STRIPE_LIVE_SECRET_KEY);
```

---

## 📚 Related Documentation

- **Stripe Official Docs:** https://stripe.com/docs
- **Payment Intents API:** https://stripe.com/docs/payments/payment-intents
- **Testing:** https://stripe.com/docs/testing
- **Webhooks:** https://stripe.com/docs/webhooks

---

## 🎯 Summary

### Key Fixes Applied (2025-11-25)

1. **"Invalid API Key" Error:**
   - Root cause: Not actual key issue - debug logs proved keys loaded correctly
   - Was a secondary symptom of the real issue below

2. **"Unknown arguments" Error:**
   - Root cause: Passing empty `{}` as second argument to `paymentIntents.create()`
   - Fix: Conditional call - only pass options object when idempotencyKey exists
   - Location: `server.js` lines 546-555

### Files Modified

| File | Change |
|------|--------|
| `server.js` | Fixed idempotency key handling, added debug logging |
| `pages/js/stripe-service.js` | Created StripePaymentService class (prior session) |

### Verification

```bash
# Test payment intent creation
curl -s -X POST http://localhost:3000/api/create-payment-intent \
  -H "Content-Type: application/json" \
  -d '{"amount": 1000, "currency": "usd"}'

# Expected: {"clientSecret":"pi_xxx_secret_xxx","paymentIntentId":"pi_xxx"}
```

---

**Documentation Type:** Integration Guide
**Related Files:** server.js, pages/js/stripe-service.js, .env
**Last Tested:** 2025-11-25 (Payment intent creation successful)
