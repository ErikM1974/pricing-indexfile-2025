# Stripe Payment Testing Guide - 3-Day Tees

**Last Updated:** 2025-11-11
**Purpose:** Comprehensive testing scenarios and verification procedures for Stripe payment integration
**Status:** Ready for Day 6 testing

---

## 📋 Table of Contents

1. [Stripe Test Cards Reference](#stripe-test-cards-reference)
2. [Test Scenarios](#test-scenarios)
3. [Verification Procedures](#verification-procedures)
4. [Error Message Validation](#error-message-validation)
5. [Testing Checklist](#testing-checklist)
6. [Known Issues & Solutions](#known-issues--solutions)

---

## 💳 Stripe Test Cards Reference

### Successful Payments

| Card Number | Description | Use Case |
|-------------|-------------|----------|
| `4242 4242 4242 4242` | Standard success | Basic payment testing |
| `4000 0566 5566 5556` | 3D Secure authentication (optional) | Test optional 3D Secure flow |
| `5555 5555 5555 4444` | Mastercard success | Test non-Visa card |
| `3782 822463 10005` | American Express success | Test Amex processing |
| `6011 1111 1111 1117` | Discover success | Test Discover card |

**Expiration:** Use any future date (e.g., `12/25`)
**CVC:** Use any 3 digits (e.g., `123`) or 4 for Amex (e.g., `1234`)
**ZIP:** Use any valid US ZIP (e.g., `98101`)

### Failed Payments - Card Declines

| Card Number | Error Code | User Message | Use Case |
|-------------|------------|--------------|----------|
| `4000 0000 0000 0002` | `generic_decline` | "Your card was declined. Please contact your bank or try a different card." | General decline test |
| `4000 0000 0000 9995` | `insufficient_funds` | "Insufficient funds. Please try a different card or add funds to your account." | Low balance |
| `4000 0000 0000 9987` | `lost_card` | "This card has been reported lost. Please use a different card." | Lost card (no retry) |
| `4000 0000 0000 9979` | `stolen_card` | "This card has been reported stolen. Please use a different card." | Stolen card (no retry) |
| `4000 0000 0000 0069` | `expired_card` | "Your card has expired. Please check the expiration date or use a different card." | Expired card |

### Failed Payments - Card Errors

| Card Number | Error Code | User Message | Use Case |
|-------------|------------|--------------|----------|
| `4000 0000 0000 0127` | `incorrect_cvc` | "Incorrect security code (CVC). Please check the 3-digit code on the back of your card." | Wrong CVC |
| `4242 4242 4242 4241` | `incorrect_number` | "Invalid card number. Please check your card number and try again." | Invalid card number |

### 3D Secure Authentication

| Card Number | Behavior | Use Case |
|-------------|----------|----------|
| `4000 0025 0000 3155` | 3D Secure required (succeeds) | Test successful 3D Secure |
| `4000 0000 0000 3220` | 3D Secure required (fails) | Test failed authentication |
| `4000 0027 6000 3184` | 3D Secure optional | Test optional auth flow |

### Processing Errors

| Card Number | Error Code | User Message | Use Case |
|-------------|------------|--------------|----------|
| `4000 0000 0000 0119` | `processing_error` | "Error processing your payment. Please try again in a moment." | Temporary processing issue |
| `4000 0000 0000 0101` | `processing_error` | "Error processing your payment. Please try again in a moment." | Alternate processing error |

**Complete reference:** https://stripe.com/docs/testing

---

## 🧪 Test Scenarios

### Test Case 1: Successful Payment Flow ✅

**Objective:** Verify complete successful payment and order submission

**Prerequisites:**
- Server running (`npm start`)
- Valid Stripe test keys in `.env`
- Browser at `http://localhost:3000/pages/3-day-tees.html`

**Test Steps:**
1. Select product color(s) and sizes
2. Select print location
3. Fill customer information:
   - First Name: "Test"
   - Last Name: "Customer"
   - Email: "test@example.com"
   - Phone: "253-555-1234"
4. Click "Proceed to Payment"
5. Enter card details:
   - Number: `4242 4242 4242 4242`
   - Expiration: `12/25`
   - CVC: `123`
   - ZIP: `98101`
6. Click "Submit Order"

**Expected Results:**
- ✅ Payment modal shows processing spinner
- ✅ Payment succeeds (no errors)
- ✅ Success toast: "Order submitted successfully!"
- ✅ Order number displayed: "3DT[MMDD]-[sequence]"
- ✅ Modal closes automatically after 3 seconds

**Verification:**
```bash
# Check server logs for payment intent creation
[Stripe] Creating payment intent: { amount: 10000, currency: 'usd', mode: 'development' }
[Stripe] Payment intent created: pi_xxxxxxxxxxxxx

# Check order submission
[ThreeDayTeesOrderService] ✓ Order submitted successfully: 3DT1111-1
[ThreeDayTeesOrderService] ✓ Emails sent
```

**Database Verification:**
- Order created in ShopWorks (or quote database if API fails)
- Order notes contain: `| PAYMENT CONFIRMED: Stripe pi_xxxxxxxxxxxxx`

**Email Verification:**
- Customer receives email with green "Payment Confirmed" box
- Sales team receives email with green "PAYMENT RECEIVED" box
- Both emails show transaction ID

---

### Test Case 2: Card Declined - Insufficient Funds ❌

**Objective:** Verify clear error message for insufficient funds

**Test Steps:**
1. Complete steps 1-4 from Test Case 1
2. Enter card details:
   - Number: `4000 0000 0000 9995`
   - Expiration: `12/25`
   - CVC: `123`
   - ZIP: `98101`
3. Click "Submit Order"

**Expected Results:**
- ✅ Payment modal shows processing spinner
- ✅ Error toast appears (10 seconds): "Insufficient funds. Please try a different card or add funds to your account."
- ✅ Payment modal remains open (user can retry)
- ✅ No order created
- ✅ No emails sent

**Console Verification:**
```javascript
[Payment] Payment failed: insufficient_funds Insufficient funds. Please try a different card or add funds to your account.
[Payment] Full error details: {
  code: 'insufficient_funds',
  decline_code: undefined,
  type: 'card_error',
  message: 'Your card has insufficient funds.',
  canRetry: true
}
```

---

### Test Case 3: Lost Card - No Retry ❌

**Objective:** Verify longer error display for non-retriable errors

**Test Steps:**
1. Complete steps 1-4 from Test Case 1
2. Enter card details:
   - Number: `4000 0000 0000 9987`
   - Expiration: `12/25`
   - CVC: `123`
   - ZIP: `98101`
3. Click "Submit Order"

**Expected Results:**
- ✅ Payment modal shows processing spinner
- ✅ Error toast appears (15 seconds): "This card has been reported lost. Please use a different card."
- ✅ `canRetry: false` in console logs
- ✅ Payment modal remains open
- ✅ No order created

**Console Verification:**
```javascript
[Payment] Full error details: {
  code: 'lost_card',
  decline_code: undefined,
  type: 'card_error',
  message: 'Your card has been reported lost.',
  canRetry: false
}
```

---

### Test Case 4: 3D Secure Authentication (Success) 🔐

**Objective:** Verify 3D Secure authentication flow

**Test Steps:**
1. Complete steps 1-4 from Test Case 1
2. Enter card details:
   - Number: `4000 0025 0000 3155`
   - Expiration: `12/25`
   - CVC: `123`
   - ZIP: `98101`
3. Click "Submit Order"
4. **3D Secure modal appears** - Click "Complete authentication"
5. **Choose authentication result:** Select "Succeed"

**Expected Results:**
- ✅ Payment modal shows processing spinner
- ✅ 3D Secure authentication modal opens
- ✅ After authentication: Payment succeeds
- ✅ Order submitted successfully
- ✅ Payment ID in order notes

**Note:** 3D Secure testing may require special Stripe dashboard configuration

---

### Test Case 5: 3D Secure Authentication (Failed) ❌

**Objective:** Verify failed 3D Secure handling

**Test Steps:**
1. Complete steps 1-4 from Test Case 1
2. Enter card details:
   - Number: `4000 0000 0000 3220`
   - Expiration: `12/25`
   - CVC: `123`
   - ZIP: `98101`
3. Click "Submit Order"
4. **3D Secure modal appears** - Click "Fail authentication"

**Expected Results:**
- ✅ Payment modal shows processing spinner
- ✅ 3D Secure authentication modal opens
- ✅ After failed authentication: Error toast appears
- ✅ Message: "Additional authentication required. Please complete the verification step."
- ✅ No order created

---

### Test Case 6: Incorrect CVC ❌

**Objective:** Verify specific error message for wrong security code

**Test Steps:**
1. Complete steps 1-4 from Test Case 1
2. Enter card details:
   - Number: `4000 0000 0000 0127`
   - Expiration: `12/25`
   - CVC: `123`
   - ZIP: `98101`
3. Click "Submit Order"

**Expected Results:**
- ✅ Error toast: "Incorrect security code (CVC). Please check the 3-digit code on the back of your card."
- ✅ User can correct CVC and retry

---

### Test Case 7: Network Error 🌐

**Objective:** Verify network error handling

**Test Steps:**
1. Start order process
2. Fill all customer information
3. Enter valid test card
4. **Disconnect internet/WiFi**
5. Click "Submit Order"

**Expected Results:**
- ✅ Error toast: "Network error. Please check your internet connection and try again."
- ✅ No duplicate charges
- ✅ Payment modal remains open
- ✅ User can retry after reconnecting

**Recovery Steps:**
1. Reconnect internet
2. Refresh page (order data may be lost)
3. Resubmit order

---

### Test Case 8: Processing Error ⚠️

**Objective:** Verify handling of temporary processing issues

**Test Steps:**
1. Complete steps 1-4 from Test Case 1
2. Enter card details:
   - Number: `4000 0000 0000 0119`
   - Expiration: `12/25`
   - CVC: `123`
   - ZIP: `98101`
3. Click "Submit Order"

**Expected Results:**
- ✅ Error toast: "Error processing your payment. Please try again in a moment."
- ✅ User can retry immediately
- ✅ No order created on first attempt

---

### Test Case 9: ManageOrders API Failure with Successful Payment ⚠️

**Objective:** Verify payment ID is preserved when order API fails

**Prerequisites:**
- Temporarily disable ManageOrders API (or simulate failure)
- OR wait for actual API timeout/error

**Test Steps:**
1. Complete successful payment (Test Case 1)
2. ManageOrders API fails during order creation

**Expected Results:**
- ✅ Payment succeeds (Stripe charged)
- ✅ Order saved to fallback quote database
- ✅ Payment ID preserved in database notes
- ✅ Customer email sent with payment confirmation
- ✅ Sales team email shows payment received + API failure warning
- ✅ Admin can manually reconcile order in ShopWorks

**Verification:**
```sql
-- Check quote_sessions table
SELECT Notes FROM quote_sessions WHERE SessionID LIKE '3DT%'
-- Should contain: "ORDER FAILED - ManageOrders API error. Payment ID: pi_xxxxx"
```

---

### Test Case 10: Multiple Payment Attempts ♻️

**Objective:** Verify user can retry after initial failure

**Test Steps:**
1. Complete steps 1-4 from Test Case 1
2. **First attempt** - Enter declined card: `4000 0000 0000 0002`
3. Click "Submit Order"
4. Verify error message
5. **Second attempt** - Clear card details
6. Enter successful card: `4242 4242 4242 4242`
7. Click "Submit Order"

**Expected Results:**
- ✅ First attempt: Clear decline error message
- ✅ Card details can be changed
- ✅ Second attempt: Payment succeeds
- ✅ Only one charge created (second attempt)
- ✅ Order submitted successfully

---

## ✅ Verification Procedures

### 1. ShopWorks Order Verification

**Manual Check:**
1. Open ShopWorks OnSite 7
2. Navigate to Orders → Search
3. Search for order number (e.g., `3DT1111-1`)
4. Verify order details:
   - Customer information matches
   - Products and quantities correct
   - Order notes contain payment ID

**Expected Notes Format:**
```
3-DAY RUSH SERVICE - Ship within 72 hours from artwork approval. Total: 529.00 (includes sales tax 10.1%) | PAYMENT CONFIRMED: Stripe pi_xxxxxxxxxxxxx
```

### 2. Email Verification

**Customer Email:**
- [ ] From: erik@nwcustomapparel.com
- [ ] Subject: "3-Day Tees Order Confirmation - [Order Number]"
- [ ] Body includes:
  - [ ] Green "Payment Confirmed" box
  - [ ] Transaction ID displayed
  - [ ] Order details table
  - [ ] Total amount matches

**Sales Team Email:**
- [ ] To: erik@nwcustomapparel.com
- [ ] Subject: "New 3-Day Tees Order - [Order Number]"
- [ ] Body includes:
  - [ ] Green "PAYMENT RECEIVED" box
  - [ ] Stripe payment ID
  - [ ] Status: "Confirmed and processed"
  - [ ] Customer information
  - [ ] Order details

### 3. Stripe Dashboard Verification

**Steps:**
1. Log into Stripe Dashboard: https://dashboard.stripe.com
2. Ensure "Test mode" toggle is ON
3. Navigate to Payments → All payments
4. Find payment by transaction ID
5. Verify:
   - [ ] Amount matches order total
   - [ ] Status: "Succeeded"
   - [ ] Customer email matches
   - [ ] Description contains order context

**Payment Intent Details:**
- Amount: Matches calculated total (in cents)
- Currency: USD
- Status: Succeeded
- Payment method: Card (last 4 digits)

### 4. Console Log Verification

**Success Scenario Logs:**
```
[Stripe] Creating payment intent: { amount: 52900, currency: 'usd', mode: 'development' }
[Stripe] Payment intent created: pi_3xxxxxxxxxxxxx
[Payment] Payment succeeded: pi_3xxxxxxxxxxxxx
[ThreeDayTeesOrderService] ✓ Order submitted successfully: 3DT1111-1
[ThreeDayTeesOrderService] ✓ Customer email sent
[ThreeDayTeesOrderService] ✓ Sales team email sent
```

**Error Scenario Logs:**
```
[Payment] Stripe error: { code: 'insufficient_funds', type: 'card_error', ... }
[Payment] Payment failed: insufficient_funds Insufficient funds. Please try a different card or add funds to your account.
[Payment] Full error details: { code: 'insufficient_funds', decline_code: undefined, type: 'card_error', message: '...', canRetry: true }
```

---

## 📝 Error Message Validation

### User-Friendly Messages Checklist

**Card Errors:**
- [ ] `card_declined` → "Your card was declined. Please try a different payment method or contact your bank."
- [ ] `insufficient_funds` → "Insufficient funds. Please try a different card or add funds to your account."
- [ ] `lost_card` → "This card has been reported lost. Please use a different card."
- [ ] `stolen_card` → "This card has been reported stolen. Please use a different card."
- [ ] `expired_card` → "Your card has expired. Please check the expiration date or use a different card."
- [ ] `incorrect_cvc` → "Incorrect security code (CVC). Please check the 3-digit code on the back of your card."
- [ ] `incorrect_number` → "Invalid card number. Please check your card number and try again."

**Processing Errors:**
- [ ] `processing_error` → "Error processing your payment. Please try again in a moment."
- [ ] `rate_limit` → "Too many payment attempts. Please wait a moment before trying again."

**Authentication:**
- [ ] `authentication_required` → "Your bank requires additional authentication. Please complete the verification step."

**System Errors:**
- [ ] Network error → "Network error. Please check your internet connection and try again."
- [ ] API error → "Payment system error. Please try again or contact support at 253-922-5793."

**No Technical Jargon:**
- [ ] No raw error codes shown to users
- [ ] No stack traces visible
- [ ] Clear actionable steps provided
- [ ] Contact information included when appropriate

---

## ✅ Testing Checklist

### Pre-Testing Setup
- [ ] Server running: `npm start`
- [ ] Stripe test mode enabled in `.env`: `STRIPE_MODE=development`
- [ ] Valid test keys in `.env`:
  - [ ] `STRIPE_TEST_PUBLIC_KEY=pk_test_...`
  - [ ] `STRIPE_TEST_SECRET_KEY=sk_test_...`
- [ ] Browser console open (F12)
- [ ] Network tab monitoring enabled

### Payment Success Testing
- [ ] Test Case 1: Successful payment with basic card
- [ ] Verify order created in ShopWorks
- [ ] Verify payment ID in order notes
- [ ] Verify customer email received
- [ ] Verify sales team email received
- [ ] Verify Stripe dashboard shows payment

### Payment Failure Testing
- [ ] Test Case 2: Insufficient funds decline
- [ ] Test Case 3: Lost card (no retry)
- [ ] Test Case 6: Incorrect CVC
- [ ] Test generic decline
- [ ] Verify no order created on failures
- [ ] Verify no emails sent on failures

### Authentication Testing
- [ ] Test Case 4: 3D Secure success
- [ ] Test Case 5: 3D Secure failure
- [ ] Verify proper authentication flow

### Error Handling Testing
- [ ] Test Case 7: Network error
- [ ] Test Case 8: Processing error
- [ ] Test Case 10: Multiple retry attempts

### Edge Cases
- [ ] Test Case 9: API failure with successful payment
- [ ] Test with different card brands (Visa, Mastercard, Amex, Discover)
- [ ] Test with very small amounts ($0.50 minimum)
- [ ] Test with large amounts ($9,999.99)

### User Experience Validation
- [ ] Loading spinner shows during processing
- [ ] Error messages display for appropriate time (10-15 seconds)
- [ ] Success message shows order number
- [ ] Modal closes automatically on success
- [ ] User can correct errors and retry
- [ ] No double-charging on retry

### Logging & Debugging
- [ ] Console logs show detailed error information
- [ ] No sensitive data (card numbers) in logs
- [ ] Payment IDs logged for reconciliation
- [ ] Error codes logged for debugging

---

## 🐛 Known Issues & Solutions

### Issue 1: Payment Success but Order Not Created

**Symptom:** Payment charge appears in Stripe but no order in ShopWorks

**Cause:** ManageOrders API failure after payment

**Solution:**
1. Check quote database for fallback save
2. Verify payment ID in database notes
3. Manually create order in ShopWorks using payment ID
4. Mark quote as converted

**Prevention:**
- Monitor server logs for API errors
- Set up alert for ManageOrders API failures

---

### Issue 2: 3D Secure Modal Not Appearing

**Symptom:** No authentication modal for 3D Secure required cards

**Cause:** Stripe.js not properly initialized or configuration issue

**Solution:**
1. Verify Stripe.js script loaded: Check `window.Stripe` exists
2. Verify test mode enabled
3. Check browser console for Stripe errors
4. Ensure card element properly mounted

**Verification:**
```javascript
// Browser console
console.log(window.Stripe); // Should show Stripe function
console.log(stripe);        // Should show Stripe instance
console.log(cardElement);   // Should show CardElement instance
```

---

### Issue 3: "Payment System Not Ready" Error

**Symptom:** Error toast immediately when trying to submit

**Cause:** Stripe not initialized or card element not mounted

**Root Causes:**
1. Stripe.js script failed to load
2. Invalid publishable key
3. Card element mount failed
4. JavaScript error before initialization

**Solution:**
1. Check network tab for Stripe.js load
2. Verify publishable key: `pk_test_...` format
3. Check console for initialization errors
4. Verify card element div exists: `<div id="card-element"></div>`

---

### Issue 4: Network Timeout During Payment

**Symptom:** Payment processing hangs, then timeout error

**Cause:** Poor network connection or Stripe API timeout

**User Impact:** Uncertain payment status

**Solution:**
1. Check Stripe dashboard for payment status
2. If payment succeeded: Process order manually
3. If payment failed: Safe to retry
4. **Never charge twice** - always verify in Stripe dashboard first

**Prevention:**
- Implement client-side timeout (30 seconds)
- Show "checking payment status..." message on timeout
- Add "Verify Payment" button for stuck payments

---

### Issue 5: Error: "Invalid API Key"

**Symptom:** Server error creating payment intent

**Cause:** Wrong API key format or test/live key mismatch

**Solution:**
1. Verify `.env` file has correct keys:
   - Test keys start with `pk_test_` and `sk_test_`
   - Live keys start with `pk_live_` and `sk_live_`
2. Verify `STRIPE_MODE=development` for testing
3. Restart server after changing `.env`: `npm start`

**Verification:**
```bash
# Check environment variables
curl http://localhost:3000/api/stripe-config
# Should return: {"publishableKey":"pk_test_..."}
```

---

## 📊 Testing Progress Tracker

| Test Case | Status | Date Tested | Notes |
|-----------|--------|-------------|-------|
| 1. Successful Payment | ⏸️ Pending | | |
| 2. Insufficient Funds | ⏸️ Pending | | |
| 3. Lost Card | ⏸️ Pending | | |
| 4. 3D Secure Success | ⏸️ Pending | | |
| 5. 3D Secure Failed | ⏸️ Pending | | |
| 6. Incorrect CVC | ⏸️ Pending | | |
| 7. Network Error | ⏸️ Pending | | |
| 8. Processing Error | ⏸️ Pending | | |
| 9. API Failure | ⏸️ Pending | | |
| 10. Multiple Retries | ⏸️ Pending | | |

**Legend:**
- ⏸️ Pending - Not yet tested
- ✅ Passed - Test successful
- ❌ Failed - Test failed, needs attention
- ⚠️ Warning - Passed with notes/issues

---

## 🎯 Day 6 Testing Plan

### Morning Session (2-3 hours)

**9:00 AM - Setup & Basic Tests**
- [ ] Verify test environment
- [ ] Run Test Case 1-3 (success, decline, lost card)
- [ ] Verify email delivery
- [ ] Check ShopWorks order creation

**10:00 AM - Advanced Error Scenarios**
- [ ] Run Test Case 6-8 (CVC, network, processing errors)
- [ ] Run Test Case 10 (multiple retries)
- [ ] Verify error message clarity
- [ ] Check console logging

**11:00 AM - Authentication & Edge Cases**
- [ ] Run Test Case 4-5 (3D Secure)
- [ ] Run Test Case 9 (API failure)
- [ ] Test different card brands
- [ ] Document any issues

### Afternoon Session (1-2 hours)

**1:00 PM - Bug Fixes**
- [ ] Address any issues from morning
- [ ] Retest failed scenarios
- [ ] Verify fixes work correctly

**2:00 PM - Final Verification**
- [ ] Complete testing checklist
- [ ] Update testing tracker
- [ ] Document known issues
- [ ] Prepare for production switch

**3:00 PM - Documentation**
- [ ] Update testing results
- [ ] Create production deployment checklist
- [ ] Document any configuration changes needed

---

## 🔗 Related Documentation

- **Day 5 Morning Summary:** `memory/3-day-tees/DAY-5-MORNING-SUMMARY.md`
- **Day 5 Afternoon Summary:** `memory/3-day-tees/DAY-5-AFTERNOON-SUMMARY.md`
- **Stripe Prerequisites:** `memory/3-day-tees/STRIPE-PREREQUISITES.md`
- **Stripe Documentation:** https://stripe.com/docs/testing
- **Test Cards Reference:** https://stripe.com/docs/testing#cards

---

**Status:** ✅ Testing documentation complete - Ready for Day 6 testing
**Next Step:** Execute test scenarios and document results
**Production Switch:** After all tests pass, switch to live keys (Day 6 Afternoon)
