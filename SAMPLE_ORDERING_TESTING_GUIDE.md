# Sample Ordering System - Testing Guide

**Last Updated:** 2025-10-27
**Status:** Ready for Testing
**Implementation:** Cart Drawer UX with Manual Invoicing Workflow

---

## 🎯 Testing Overview

This guide covers testing the complete sample ordering system from product selection through order confirmation.

### System Components
1. **Top Sellers Showcase** - Product browsing and cart widget
2. **Cart Drawer** - Visual color/size selection and cart management
3. **Checkout Review** - Customer information and order review
4. **Order Submission** - ManageOrders PUSH API integration
5. **Order Confirmation** - Success page with order number

---

## ✅ Pre-Testing Checklist

### Required Services
- [ ] Heroku Proxy API: `caspio-pricing-proxy-ab30a049961a.herokuapp.com`
- [ ] ManageOrders PUSH API credentials configured
- [ ] EmailJS configured (service_1c4k67j)
- [ ] Browser supports sessionStorage

### Test Environment
- [ ] Clear browser cache and sessionStorage
- [ ] Open browser console for debugging
- [ ] Test on Chrome (primary) and Firefox/Safari
- [ ] Test on mobile device (iOS/Android)

---

## 📋 Test Scenarios

### Scenario 1: ALL FREE Samples (Most Common)
**Goal:** Verify basic flow with 3 free samples

**Steps:**
1. Navigate to `/pages/top-sellers-showcase.html`
2. Click "Request Sample" on PC54 (Forest Green)
3. **Cart Drawer Opens:**
   - [ ] Product info displays correctly
   - [ ] Color swatches show with visual circles
   - [ ] Size buttons show in grid layout
4. Select color (Forest Green)
5. Select size (M)
6. Click "Add to Cart"
7. **Verify:**
   - [ ] Item appears in cart list with FREE badge
   - [ ] Cart count shows "1/3"
   - [ ] Success toast shows "PC54 added - FREE sample"
8. Repeat for 2 more products (different styles)
9. **Verify:**
   - [ ] Cart count shows "3/3"
   - [ ] Widget shows red "FULL" indicator
10. Click cart widget to review
11. **Verify Cart Display:**
    - [ ] All 3 items show
    - [ ] Each has FREE badge
    - [ ] Remove buttons work
12. Click "Checkout"
13. **Checkout Review Page:**
    - [ ] All 3 samples display correctly
    - [ ] Shows "FREE SAMPLES!" notice (green)
    - [ ] Total shows $0.00
14. Fill customer form:
    - First Name: Test
    - Last Name: User
    - Email: test@example.com
    - Phone: 253-555-1234
    - Company: Test Company
    - Full address
15. Click "Submit Sample Request"
16. **Verify:**
    - [ ] Loading spinner shows
    - [ ] Redirects to confirmation page
17. **Order Confirmation Page:**
    - [ ] Success checkmark animates
    - [ ] Order number shows (SAMPLE-MMDD-#)
    - [ ] "What Happens Next" section displays
    - [ ] No payment mention (all free)
18. **Check ShopWorks:**
    - [ ] Order appears in OnSite 7
    - [ ] Order Type: 6 (web orders)
    - [ ] Customer #2791
    - [ ] Terms: "FREE SAMPLE"
    - [ ] All 3 line items with $0.01 price
    - [ ] Notes: "FREE SAMPLE - Top Sellers Showcase"
19. **Check Email:**
    - [ ] erik@nwcustomapparel.com received notification
    - [ ] Contains order number
    - [ ] Lists all 3 samples

**Expected Result:** ✅ Order submitted, no payment required

---

### Scenario 2: ALL PAID Samples
**Goal:** Verify pricing calculation and invoicing workflow

**Steps:**
1. Clear cart (if not empty)
2. Add 3 PAID samples (products with price ≥ $10)
3. **Verify in drawer:**
   - [ ] Each shows PAID badge
   - [ ] Price displays correctly (e.g., "$12.50")
4. Go to checkout
5. **Checkout Review:**
   - [ ] Shows "Payment Required" notice (yellow)
   - [ ] Subtotal calculates correctly
   - [ ] Each item shows price
6. Submit order
7. **Verify ShopWorks Order:**
   - [ ] Terms: "MIXED ORDER - Invoice $XX.XX" (shows total)
   - [ ] Line items have actual prices ($10.00, $12.50, etc.)
   - [ ] Each line item note: "PAID SAMPLE - Invoice customer $XX.XX"
   - [ ] Order notes: "MIXED ORDER - 3 PAID ($XX.XX) + 0 FREE"
8. **Verify Email:**
   - [ ] Shows total to invoice
   - [ ] Lists all prices

**Expected Result:** ✅ Order shows prices in ShopWorks, staff will invoice customer

---

### Scenario 3: MIXED Samples (FREE + PAID)
**Goal:** Verify system handles both types in one order

**Steps:**
1. Clear cart
2. Add 1 FREE sample (e.g., PC54 at $8.50)
3. Add 2 PAID samples (e.g., products at $12.50 each)
4. **Verify drawer:**
   - [ ] 1 item with FREE badge
   - [ ] 2 items with PAID badges
   - [ ] Cart count: "3/3"
5. Go to checkout
6. **Checkout Review:**
   - [ ] FREE items show "FREE" badge
   - [ ] PAID items show price
   - [ ] Total = sum of paid items only
   - [ ] Shows "Payment Required" notice
7. Submit order
8. **Verify ShopWorks:**
   - [ ] Terms: "MIXED ORDER - Invoice $25.00" (example)
   - [ ] FREE line item: $0.01 with note "FREE SAMPLE"
   - [ ] PAID line items: actual prices with note "PAID SAMPLE - Invoice customer $XX.XX"
   - [ ] Order notes: "MIXED ORDER - 2 PAID ($25.00) + 1 FREE - Company"

**Expected Result:** ✅ Correct pricing breakdown, staff knows what to invoice

---

### Scenario 4: Cart Drawer UX Testing
**Goal:** Verify drawer interactions work smoothly

**Tests:**
1. **Open/Close:**
   - [ ] Click cart widget → drawer opens
   - [ ] Click overlay → drawer closes
   - [ ] Click X button → drawer closes
   - [ ] Press ESC key → drawer closes

2. **Color Selection:**
   - [ ] Swatches display as circles with correct colors
   - [ ] Click swatch → checkmark appears
   - [ ] Selected swatch has border highlight
   - [ ] Can change selection

3. **Size Selection:**
   - [ ] Buttons display in grid layout
   - [ ] Click size → button highlights
   - [ ] Selected size has green background
   - [ ] Can change selection

4. **Add to Cart Button:**
   - [ ] Disabled when no color/size selected
   - [ ] Enables when both selected
   - [ ] Click → item added to cart
   - [ ] Product selection section hides
   - [ ] Cart items section updates

5. **Cart Management:**
   - [ ] Items display with images (or icon fallback)
   - [ ] Shows style, color, size
   - [ ] Shows FREE or PAID badge
   - [ ] Remove button works
   - [ ] Cart count updates

6. **Mobile Responsive:**
   - [ ] Drawer takes full width on mobile
   - [ ] Touch interactions work
   - [ ] Scrolling works properly
   - [ ] Footer buttons stack vertically

---

### Scenario 5: Edge Cases

#### 5.1 Maximum Samples (3 limit)
1. Add 3 samples to cart
2. Try to add 4th sample
3. **Verify:**
   - [ ] Warning notification appears
   - [ ] "Maximum 3 samples per request"
   - [ ] 4th item not added
   - [ ] Cart stays at 3 items

#### 5.2 Duplicate Product
1. Add PC54 in Forest Green, size M
2. Try to add PC54 again (any color/size)
3. **Verify:**
   - [ ] Info notification: "This item is already in your sample cart"
   - [ ] Duplicate not added
   - [ ] Original item remains

#### 5.3 Empty Cart Checkout
1. Clear cart completely
2. Navigate directly to `/pages/checkout-review.html`
3. **Verify:**
   - [ ] Shows "Your cart is empty" message
   - [ ] No checkout form visible
   - [ ] "Browse Products" button works

#### 5.4 Form Validation
1. Go to checkout with items in cart
2. Click "Submit" without filling form
3. **Verify:**
   - [ ] Browser validation triggers
   - [ ] Required fields highlighted
4. Fill form with invalid data:
   - Email: "notanemail"
   - Phone: "abc"
   - ZIP: "123"
5. **Verify:**
   - [ ] Validation prevents submission
   - [ ] Error messages clear

#### 5.5 Network Error
1. Turn off WiFi/disable network
2. Try to submit order
3. **Verify:**
   - [ ] Error message shows
   - [ ] "Unable to submit your order"
   - [ ] "Please try again or call 253-922-5793"
   - [ ] Button re-enables
   - [ ] Cart data preserved

---

## 🔍 Console Testing Commands

### Check Cart Data
```javascript
// View current cart contents
console.log(JSON.parse(sessionStorage.getItem('sampleCart')));

// Check cart structure
const cart = JSON.parse(sessionStorage.getItem('sampleCart'));
console.log('Samples:', cart.samples);
console.log('Count:', cart.samples.length);

// Verify pricing data
cart.samples.forEach(s => {
    console.log(`${s.name}: ${s.type} - $${s.price}`);
});
```

### Manually Clear Cart
```javascript
sessionStorage.removeItem('sampleCart');
window.location.reload();
```

### Test Service Status
```javascript
// Check if services loaded
console.log('CartDrawer:', typeof window.cartDrawer);
console.log('SampleCart:', typeof window.sampleCart);
console.log('SampleOrderService:', typeof window.sampleOrderService);

// Verify cart state
console.log('Samples in cart:', window.sampleCart.samples.length);
```

### Manually Generate Order Number
```javascript
window.sampleOrderService.generateOrderNumber();
// Should return format: SAMPLE-MMDD-#
```

---

## 🐛 Known Issues & Solutions

### Issue 1: Cart Count Not Updating
**Symptom:** Cart widget shows wrong count
**Solution:** Check SampleCart.updateUI() is being called after add/remove
**Test:** `window.sampleCart.updateUI()`

### Issue 2: Drawer Won't Open
**Symptom:** Click cart widget, nothing happens
**Solution:** Check CartDrawer initialized
**Test:** `console.log(window.cartDrawer)`

### Issue 3: Colors Not Displaying
**Symptom:** Color swatches show gray
**Solution:** Verify product data includes hex color codes
**Check:** Product eligibility API response

### Issue 4: Checkout Form Resets
**Symptom:** Form data lost on page navigation
**Solution:** Expected behavior - cart preserved in sessionStorage, form data not

### Issue 5: Order Number Not Showing
**Symptom:** Confirmation page shows "Loading..."
**Solution:** Check URL parameter passed correctly
**Test:** Look for `?orderNumber=SAMPLE-MMDD-#` in URL

---

## 📊 Success Criteria

### Functional Requirements
- [x] Users can browse products
- [x] Users can select color/size visually
- [x] Cart persists in sessionStorage
- [x] Maximum 3 samples enforced
- [x] FREE vs PAID properly distinguished
- [x] Order submits to ShopWorks OnSite 7
- [x] Email notifications sent
- [x] Order confirmation displays

### UX Requirements
- [x] Drawer animations smooth
- [x] Mobile responsive
- [x] Visual color swatches (not dropdowns)
- [x] Size buttons (not dropdowns)
- [x] Clear FREE/PAID badges
- [x] Professional checkout flow
- [x] Success feedback

### Business Requirements
- [x] Orders appear in ShopWorks
- [x] Order Type 6 (web orders)
- [x] Customer #2791
- [x] catalogColor field correct
- [x] Pricing shows in ShopWorks (for invoicing)
- [x] Email to erik@nwcustomapparel.com
- [x] Manual invoicing workflow supported

---

## 🚀 Deployment Checklist

Before going live:

### Code Review
- [ ] All console.log statements reviewed
- [ ] No test data hardcoded
- [ ] Error messages user-friendly
- [ ] Loading states present
- [ ] Success messages clear

### Configuration
- [ ] API endpoints correct
- [ ] EmailJS service ID: service_1c4k67j
- [ ] EmailJS public key: 4qSbDO-SQs19TbP80
- [ ] Email template: template_wjxuice (Sample-Order-API)
- [ ] ManageOrders credentials configured

### Testing
- [ ] All 5 test scenarios passed
- [ ] Mobile testing complete
- [ ] Cross-browser testing done
- [ ] Edge cases handled
- [ ] Console errors resolved

### Documentation
- [ ] Staff training guide created
- [ ] Order fulfillment workflow documented
- [ ] Invoicing process documented
- [ ] Troubleshooting guide available

---

## 📞 Support Information

### For Technical Issues
- **Developer:** Erik Mickelson
- **Email:** erik@nwcustomapparel.com
- **Phone:** (253) 922-5793

### For Testing Help
- **This Guide:** `/SAMPLE_ORDERING_TESTING_GUIDE.md`
- **Console Commands:** See "Console Testing Commands" section above
- **Related Files:**
  - `/pages/top-sellers-showcase.html`
  - `/pages/checkout-review.html`
  - `/pages/order-confirmation.html`
  - `/shared_components/js/cart-drawer.js`
  - `/shared_components/js/sample-order-service.js`

---

**Test Status:** 🟡 Ready for Testing
**Next Step:** Run all 5 test scenarios and document results
