# Day 6 Test Execution Checklist

**Date:** 2025-11-20
**Status:** Ready for manual testing
**Duration:** 2-3 hours (morning session)
**Reference:** See STRIPE-TESTING-GUIDE.md for detailed procedures

---

## 🚀 Quick Start

1. **Start the server:**
   ```bash
   cd "c:\Users\erik\OneDrive - Northwest Custom Apparel\2025\Pricing Index File 2025"
   npm start
   ```

2. **Open browser:**
   Navigate to: `http://localhost:3000/pages/3-day-tees.html`

3. **Open testing guide:**
   Open `memory/3-day-tees/STRIPE-TESTING-GUIDE.md` for detailed test procedures

---

## ✅ Pre-Testing Checklist

- [ ] Server running on port 3000
- [ ] Browser open to 3-day-tees.html
- [ ] Stripe dashboard open (Test mode): https://dashboard.stripe.com/test/payments
- [ ] STRIPE-TESTING-GUIDE.md open for reference
- [ ] Email client open to check customer/sales emails
- [ ] ShopWorks OnSite open (optional - for order verification)
- [ ] Console open (F12) for debugging logs

---

## 📋 Test Scenarios to Execute

### Priority 1: Critical Path (Must Pass)

- [ ] **Test Case 1: Successful Payment** (test card: 4242 4242 4242 4242)
  - Verify order submission
  - Check payment ID in ShopWorks order notes
  - Verify customer email with green "Payment Confirmed" box
  - Verify sales team email with green "PAYMENT RECEIVED" banner

### Priority 2: Error Handling (Must Work)

- [ ] **Test Case 2: Generic Decline** (test card: 4000 0000 0000 0002)
  - Verify user-friendly error message: "Your card was declined..."
  - Verify 10-second display time
  - Verify retry allowed

- [ ] **Test Case 3: Lost Card** (test card: 4000 0000 0000 9987)
  - Verify error message: "This card has been reported lost..."
  - Verify NO retry allowed
  - Verify 15-second display time

- [ ] **Test Case 4: Insufficient Funds** (test card: 4000 0000 0000 9995)
  - Verify error message: "Insufficient funds..."
  - Verify actionable guidance
  - Verify retry allowed

### Priority 3: Authentication (Should Work)

- [ ] **Test Case 5: 3D Secure Required** (test card: 4000 0027 6000 3184)
  - Verify authentication modal appears
  - Complete authentication flow
  - Verify payment success after authentication

### Priority 4: Edge Cases (Nice to Have)

- [ ] **Test Case 6: Expired Card** (test card: 4000 0000 0000 0069)
- [ ] **Test Case 7: Incorrect CVC** (test card: 4000 0000 0000 0127)
- [ ] **Test Case 8: Processing Error** (test card: 4000 0000 0000 0119)

---

## 🔍 Verification Checklist

For each successful test:

### ShopWorks Verification
- [ ] Order created with correct order number
- [ ] OrderNotes contains: `| PAYMENT CONFIRMED: Stripe pi_xxxxxxxxxxxxx`
- [ ] Payment ID matches Stripe dashboard

### Email Verification
- [ ] Customer email received
- [ ] Green "Payment Confirmed" box visible
- [ ] Stripe payment ID displayed
- [ ] Sales team email received
- [ ] Green "PAYMENT RECEIVED" banner visible

### Stripe Dashboard Verification
- [ ] Payment appears in Test payments
- [ ] Payment status: Succeeded
- [ ] Amount matches order total
- [ ] Customer email matches order

### Console Verification
- [ ] No JavaScript errors
- [ ] Payment success log: `[Payment] Payment succeeded: pi_xxxxxxxxxxxxx`
- [ ] No error logs during successful flow

---

## 🐛 Issue Tracking

If any test fails, document:

| Test Case | Expected Result | Actual Result | Action Taken |
|-----------|----------------|---------------|--------------|
| | | | |

---

## 📊 Test Results Summary

**Successful Tests:** __ / 8

**Failed Tests:** __ / 8

**Blocked Tests:** __ / 8

**Notes:**
-
-
-

---

## ✅ Sign-Off

Once all Priority 1 and Priority 2 tests pass:

- [ ] All critical path tests passed
- [ ] All error handling tests passed
- [ ] Authentication flow tested (if applicable)
- [ ] All verification steps completed
- [ ] No critical issues found
- [ ] Ready for production deployment

**Tested By:** ___________________

**Date:** ___________________

**Time Spent:** ___________________

---

## 🚀 Next Step After Testing

Once testing is complete and all Priority 1-2 tests pass:

**Day 6 Afternoon: Switch to Live Keys and Deploy**
1. Update `.env` with live Stripe keys
2. Change `STRIPE_MODE=production`
3. Final end-to-end test with real card
4. Deploy to production
5. Monitor first production orders

See STRIPE-TESTING-GUIDE.md for detailed production deployment procedures.

---

**Status:** ⏸️ Ready for user testing
**Completion:** Day 6 Morning work 100% complete
**Phase 2 Progress:** 80% complete
