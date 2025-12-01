# 3-Day Tees Stripe Production Deployment Checklist

**Last Updated:** 2025-12-01
**First Production Deployment:** December 1, 2025
**Status:** Live and working ✅

---

## 🚨 CRITICAL: Do NOT Skip These Steps

### Step 0: BASE_URL Environment Variable (CRITICAL!)

**⚠️ FAILING TO SET THIS WILL CAUSE WEBHOOK FAILURES ⚠️**

```bash
# MUST set this BEFORE deploying
heroku config:set BASE_URL=https://www.teamnwca.com --app sanmar-inventory-app
```

**Why This Matters:**
- The webhook handler calls `/api/submit-3day-order` internally
- On Heroku, `localhost` refers to the dyno itself, NOT the public URL
- Without `BASE_URL`, webhooks will show 200 OK but fail to create ShopWorks orders
- Error you'll see: `connect ECONNREFUSED 127.0.0.1:443`

**Lesson Learned:** First production deployment failed because BASE_URL wasn't set. Order 3DT1201-9867 payment processed but ShopWorks submission failed. Had to set BASE_URL and resend webhook to recover.

---

## 📋 Pre-Deployment Checklist

### 1. Stripe Account Setup

- [ ] Stripe account activated
- [ ] Business verification complete
- [ ] Bank account connected
- [ ] Test mode verified working

### 2. Environment Variables Configuration

**Required Heroku Config Vars:**

```bash
# CRITICAL: Set this first!
heroku config:set BASE_URL=https://www.teamnwca.com --app sanmar-inventory-app

# Stripe Configuration
heroku config:set STRIPE_MODE=production --app sanmar-inventory-app
heroku config:set STRIPE_LIVE_PUBLIC_KEY=pk_live_... --app sanmar-inventory-app
heroku config:set STRIPE_LIVE_SECRET_KEY=sk_live_... --app sanmar-inventory-app
heroku config:set STRIPE_WEBHOOK_SECRET_LIVE=whsec_... --app sanmar-inventory-app
```

**Verification:**
```bash
# Verify all variables are set
heroku config --app sanmar-inventory-app | grep -E "(BASE_URL|STRIPE_MODE|STRIPE_LIVE)"
```

### 3. Webhook Configuration in Stripe Dashboard

- [ ] Navigate to: Dashboard → Developers → Webhooks
- [ ] Click "Add endpoint"
- [ ] **Endpoint URL:** `https://www.teamnwca.com/api/stripe/webhook`
- [ ] **Events to send:** Select `checkout.session.completed`
- [ ] Click "Add endpoint"
- [ ] **Copy Signing Secret** (starts with `whsec_`)
- [ ] Add to Heroku: `heroku config:set STRIPE_WEBHOOK_SECRET_LIVE=whsec_...`

### 4. Code Deployment

```bash
# Push code to Heroku
git push heroku main

# Monitor deployment
heroku logs --tail --app sanmar-inventory-app
```

### 5. Restart Heroku (IMPORTANT!)

```bash
# Restart to load all environment variables
heroku restart --app sanmar-inventory-app

# Wait 30 seconds for restart
sleep 30
```

**Why restart is critical:** Environment variables don't take effect until Heroku restarts. Skipping this means webhooks will use old/missing config.

---

## 🧪 Production Testing

### Test with Small Real Charge

**DO NOT skip this step!**

1. **Create Test Order ($0.50 - $5.00 range)**
   - Use real credit card (your own)
   - Complete entire checkout flow
   - Wait for Stripe redirect to success page

2. **Verify Order Creation**
   ```bash
   # Check Caspio for order status
   curl -s "https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/quote_sessions?filter=QuoteID='3DT1201-XXXX'" | python -m json.tool
   ```

   **Expected Result:**
   - `Status`: "Processed" ✅
   - `SessionID`: Stripe session ID present
   - `Notes`: Contains "Payment Confirmed" message

   **Bad Result (means BASE_URL not set):**
   - `Status`: "Payment Confirmed - ShopWorks Failed" ❌
   - `Notes`: Contains "connect ECONNREFUSED 127.0.0.1:443"

3. **Check ShopWorks ManageOrders**
   - [ ] Order created with correct order number
   - [ ] Customer information complete
   - [ ] Line items correct
   - [ ] Payment information in Order Notes
   - [ ] Stripe Session ID visible

4. **Verify Emails Sent**
   - [ ] Customer confirmation email received
   - [ ] Sales team notification received

5. **Check Stripe Dashboard**
   - [ ] Navigate to: Developers → Webhooks → Your endpoint
   - [ ] Click on latest event
   - [ ] Status should be: "Succeeded" with 200 response

6. **Refund Test Payment**
   - [ ] Stripe Dashboard → Payments → Find test payment
   - [ ] Click "Refund" button
   - [ ] Confirm refund processed

---

## 🔍 Troubleshooting

### Webhook Shows 200 OK But No ShopWorks Order

**This was the exact issue on first deployment!**

**Symptoms:**
- ✅ Webhook delivered (200 OK in Stripe)
- ✅ Payment successful
- ❌ No ShopWorks order
- ❌ No emails sent

**Diagnosis:**
```bash
# Check Caspio order status
curl -s "https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/quote_sessions?filter=QuoteID='3DT1201-XXXX'" | python -m json.tool

# Look for:
# Status: "Payment Confirmed - ShopWorks Failed"
# Notes: "connect ECONNREFUSED 127.0.0.1:443"
```

**Fix:**
```bash
# 1. Set BASE_URL
heroku config:set BASE_URL=https://www.teamnwca.com --app sanmar-inventory-app

# 2. Restart Heroku
heroku restart --app sanmar-inventory-app

# 3. Resend webhook from Stripe Dashboard
# Dashboard → Webhooks → Click endpoint → Find event → ... menu → Resend
```

**Verification:**
- Check ShopWorks ManageOrders for new order
- Query Caspio again - Status should now be "Processed"

### Webhook Not Receiving Events

**Check webhook URL:**
```bash
# Should be custom domain, NOT herokuapp.com
https://www.teamnwca.com/api/stripe/webhook  # ✅ Correct
https://sanmar-inventory-app.herokuapp.com/api/stripe/webhook  # ❌ Wrong
```

**Fix:** Update webhook URL in Stripe Dashboard to use custom domain.

---

## ✅ Post-Deployment Monitoring

### First 24 Hours

**Check every hour:**

1. **Stripe Webhook Logs**
   - Dashboard → Developers → Webhooks → Your endpoint
   - Verify all events showing 200 OK

2. **Caspio Order Status**
   ```bash
   # Check for any failed orders
   curl -s "https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/quote_sessions?filter=Status='Payment Confirmed - ShopWorks Failed'"
   ```

3. **ShopWorks Orders**
   - Verify all Stripe payments have corresponding ManageOrders entries
   - Cross-reference via Order Notes (contains Stripe Session ID)

4. **Heroku Logs**
   ```bash
   heroku logs --tail --app sanmar-inventory-app
   ```

### Cross-Referencing Stripe ↔ ShopWorks

**From Stripe to ShopWorks:**
1. Copy Stripe Session ID (e.g., `cs_live_b1Pg3iIvqWf7bi5...`)
2. Search ShopWorks Order Notes for this session ID
3. Order Notes contain: `Payment Information: Stripe Session: cs_live_...`

**From ShopWorks to Stripe:**
1. Find Stripe Session ID in Order Notes or Payment AuthCode
2. Search Stripe Dashboard → Payments → Search by session ID

---

## 📊 Production History

### Deployment #1 - December 1, 2025

**Status:** ✅ Successful (after BASE_URL fix)

**Timeline:**
- Deployed code to Heroku
- Set Stripe live keys
- Configured webhook in Stripe Dashboard
- Made test payment: $290.94 (Order 3DT1201-9867)
- **Issue:** Webhook 200 OK but no ShopWorks order
- **Diagnosis:** Caspio showed "connect ECONNREFUSED 127.0.0.1:443"
- **Fix:** Set `BASE_URL=https://www.teamnwca.com`
- **Recovery:** Resent webhook from Stripe Dashboard
- **Result:** Order #139337 created successfully in ShopWorks
- Refunded test payment
- **Status:** Live and working ✅

**Git Commits:**
- `187ce9b` - "fix: Use BASE_URL for webhook ShopWorks submission"

**Key Takeaway:** Always set BASE_URL environment variable BEFORE testing webhooks in production.

---

## 🎯 Quick Reference Commands

```bash
# Check Heroku config
heroku config --app sanmar-inventory-app

# Set environment variable
heroku config:set BASE_URL=https://www.teemnwca.com --app sanmar-inventory-app

# Restart Heroku
heroku restart --app sanmar-inventory-app

# View logs
heroku logs --tail --app sanmar-inventory-app

# Check Caspio order
curl -s "https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/quote_sessions?filter=QuoteID='3DT1201-XXXX'" | python -m json.tool

# Find failed orders
curl -s "https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/quote_sessions?filter=Status='Payment Confirmed - ShopWorks Failed'"
```

---

## 📚 Related Documentation

- [STRIPE-PRODUCTION-READINESS.md](STRIPE-PRODUCTION-READINESS.md) - Complete production guide
- [PHASE-2-STATUS.md](PHASE-2-STATUS.md) - Implementation status and history
- [STRIPE-TESTING-GUIDE.md](STRIPE-TESTING-GUIDE.md) - Testing procedures
- [STRIPE-PREREQUISITES.md](STRIPE-PREREQUISITES.md) - Initial setup guide

---

**Last Updated:** 2025-12-01
**Next Review:** After first week of production use
**Production Status:** ✅ Live and processing payments
