# Stripe Payment Integration - Prerequisites Checklist

**Last Updated:** 2025-11-11
**Purpose:** Step-by-step guide to complete Stripe account setup before Phase 2 implementation
**Status:** Prerequisites Required Before Day 5

---

## 🎯 Overview

Before we can implement Stripe payment processing in the 3-Day Tees page, we need to complete the Stripe account setup and gather API credentials. **Estimated time: 30-60 minutes** (plus 1-2 business days for bank verification).

---

## ✅ Prerequisites Checklist

### Step 1: Stripe Account Setup (10 minutes)

- [ ] **1.1: Create or Access Stripe Account**
  - Visit: https://dashboard.stripe.com/register
  - Or log in if account exists: https://dashboard.stripe.com/login
  - Use business email: `accounts@nwcustomapparel.com` (or primary business email)

- [ ] **1.2: Complete Business Profile**
  - Navigate to: Settings → Business settings → Public details
  - Fill in:
    - Business name: **Northwest Custom Apparel**
    - Support email: `sales@nwcustomapparel.com`
    - Support phone: **253-922-5793**
    - Business address: **2025 Freeman Road East, Milton, WA 98354**
    - Website: `https://www.nwcustomapparel.com`

- [ ] **1.3: Activate Payments**
  - Navigate to: Home → Activate payments
  - Follow prompts to activate your account
  - Provide business details and tax information

---

### Step 2: Bank Account Connection (5 minutes + 1-2 day wait)

- [ ] **2.1: Add Bank Account**
  - Navigate to: Settings → Business settings → Bank accounts and scheduling
  - Click "Add bank account"
  - Enter:
    - **Routing number:** [Your bank routing number]
    - **Account number:** [Your bank account number]
    - **Account holder name:** Northwest Custom Apparel LLC (or official business name)

- [ ] **2.2: Verify Micro-Deposits**
  - Stripe will send 2 small deposits (under $1 each) within 1-2 business days
  - Check your bank account in 1-2 days
  - Return to Stripe dashboard and verify the amounts
  - Navigate to: Settings → Business settings → Bank accounts
  - Click "Verify" and enter the two deposit amounts

**⏰ WAIT TIME:** 1-2 business days for micro-deposits to appear

---

### Step 3: Collect API Keys (5 minutes)

#### Test Keys (for Development)

- [ ] **3.1: Get Test Public Key**
  - Navigate to: Developers → API keys
  - Find section: **Test mode**
  - Copy "Publishable key" (starts with `pk_test_`)
  - **Save to:** `.env` file as `STRIPE_TEST_PUBLIC_KEY`

- [ ] **3.2: Get Test Secret Key**
  - In same section (Test mode)
  - Click "Reveal test key" next to "Secret key"
  - Copy the secret key (starts with `sk_test_`)
  - **Save to:** `.env` file as `STRIPE_TEST_SECRET_KEY`
  - **⚠️ IMPORTANT:** Never share or commit this key!

#### Live Keys (for Production - DO NOT USE UNTIL TESTING COMPLETE)

- [ ] **3.3: Get Live Public Key** (DO LATER)
  - Same page, find section: **Live mode**
  - Copy "Publishable key" (starts with `pk_live_`)
  - **Save to:** `.env` file as `STRIPE_LIVE_PUBLIC_KEY`
  - **Note:** We'll use this only after all testing is complete

- [ ] **3.4: Get Live Secret Key** (DO LATER)
  - In Live mode section
  - Click "Reveal live key" next to "Secret key"
  - Copy the secret key (starts with `sk_live_`)
  - **Save to:** `.env` file as `STRIPE_LIVE_SECRET_KEY`
  - **⚠️ CRITICAL:** Keep this extremely secure!

---

### Step 4: Webhook Configuration (10 minutes)

- [ ] **4.1: Create Webhook Endpoint**
  - Navigate to: Developers → Webhooks
  - Click "Add endpoint"
  - **Endpoint URL:** `https://your-domain.com/api/webhook/stripe`
    - *Note: We'll update this after server deployment*
  - **Description:** "3-Day Tees Payment Webhook"
  - **Events to send:** Select these events:
    - `payment_intent.succeeded`
    - `payment_intent.payment_failed`
    - `charge.refunded`

- [ ] **4.2: Get Webhook Signing Secret**
  - After creating webhook, click on the webhook name
  - Find "Signing secret" section
  - Click "Reveal" to show the secret
  - Copy the secret (starts with `whsec_`)
  - **Save to:** `.env` file as `STRIPE_WEBHOOK_SECRET`

- [ ] **4.3: Test Webhook (DO LATER)**
  - We'll test webhooks after implementation using Stripe CLI
  - For now, just having the secret is enough

---

### Step 5: Security Configuration (5 minutes)

- [ ] **5.1: Verify .gitignore**
  - Ensure `.env` is in `.gitignore` file ✅ (Already done)
  - **Never commit .env file to Git!**

- [ ] **5.2: Update .env File**
  - Copy `.env.example` to `.env` (if not exists)
  - Add all Stripe keys collected above
  - Set `STRIPE_MODE=development` for testing
  - Example `.env` content:
    ```
    STRIPE_TEST_PUBLIC_KEY=pk_test_abc123...
    STRIPE_TEST_SECRET_KEY=sk_test_def456...
    STRIPE_LIVE_PUBLIC_KEY=pk_live_ghi789... (leave blank for now)
    STRIPE_LIVE_SECRET_KEY=sk_live_jkl012... (leave blank for now)
    STRIPE_WEBHOOK_SECRET=whsec_mno345...
    STRIPE_MODE=development
    ```

- [ ] **5.3: Enable HTTPS (Production Only)**
  - Stripe requires HTTPS for live payments
  - Development (localhost) can use HTTP
  - Production server must have SSL certificate

---

### Step 6: Test Cards Documentation (Reference Only)

For development testing, Stripe provides test cards. **No action needed now** - just reference during testing:

| Purpose | Card Number | Expiry | CVC | ZIP |
|---------|-------------|--------|-----|-----|
| **Success** | 4242 4242 4242 4242 | 12/25 | 123 | 98354 |
| **Decline** | 4000 0000 0000 0002 | 12/25 | 123 | 98354 |
| **3D Secure** | 4000 0027 6000 3184 | 12/25 | 123 | 98354 |
| **Insufficient Funds** | 4000 0000 0000 9995 | 12/25 | 123 | 98354 |

**More test cards:** https://stripe.com/docs/testing

---

## 📋 Prerequisites Complete Checklist

Before starting Day 5 implementation, confirm:

- [ ] Stripe account activated
- [ ] Business profile completed
- [ ] Bank account added (micro-deposits pending or verified)
- [ ] Test public key saved to `.env`
- [ ] Test secret key saved to `.env`
- [ ] Webhook endpoint created
- [ ] Webhook secret saved to `.env`
- [ ] `.env` file not committed to Git
- [ ] `STRIPE_MODE=development` set in `.env`

**Status Check Command:**
```bash
# Run this to verify .env has Stripe keys
grep -c "STRIPE_" .env
# Should return 6 (6 Stripe variables)
```

---

## 🚨 Common Issues & Solutions

### Issue 1: "Account not activated"
**Solution:** Complete business profile and activate payments in dashboard

### Issue 2: "Bank account verification pending"
**Solution:** Wait 1-2 business days for micro-deposits, then verify amounts

### Issue 3: "API keys not working"
**Solution:** Ensure you copied the correct keys (test vs. live) and saved to `.env`

### Issue 4: "Webhook signing failed"
**Solution:** Verify webhook secret starts with `whsec_` and matches dashboard

---

## 📞 Support Resources

### Stripe Documentation
- **Getting Started:** https://stripe.com/docs/development/quickstart
- **API Keys:** https://stripe.com/docs/keys
- **Webhooks:** https://stripe.com/docs/webhooks
- **Testing:** https://stripe.com/docs/testing

### Stripe Support
- **Email:** support@stripe.com
- **Phone:** 1-888-926-2289
- **Dashboard:** https://dashboard.stripe.com

### Internal Contact
- **Implementation Questions:** erik@nwcustomapparel.com
- **Business Questions:** jim@nwcustomapparel.com

---

## ✅ Ready to Proceed?

Once all prerequisites are complete (except bank verification, which can happen in parallel), we can begin Day 5 implementation:

1. ✅ Test API keys obtained and saved to `.env`
2. ✅ Webhook secret obtained and saved to `.env`
3. ✅ `.env` file secure (in `.gitignore`)
4. ⏳ Bank verification (can complete during development)

**Next Steps:**
1. Confirm prerequisites complete
2. Begin Day 5: Stripe dependencies and Elements UI
3. Test with Stripe test cards
4. Deploy after all testing passes

---

**Documentation Type:** Prerequisites Checklist
**Parent Document:** [IMPLEMENTATION-TIMELINE.md](IMPLEMENTATION-TIMELINE.md)
**Phase:** Phase 2 - Stripe Payment Integration
**Status:** Action Required Before Implementation
