# Sample Order Testing Guide

**Version:** 1.0.0
**Last Updated:** October 29, 2025
**Purpose:** Step-by-step testing procedures for sample order submission with billing/shipping separation

---

## 📋 Table of Contents

1. [Pre-Test Checklist](#pre-test-checklist)
2. [Test Scenario 1: Same Billing & Shipping](#test-scenario-1)
3. [Test Scenario 2: Different Billing & Shipping](#test-scenario-2)
4. [Verification Steps](#verification-steps)
5. [Expected Console Logs](#expected-console-logs)
6. [OnSite Verification (After Hourly Import)](#onsite-verification)
7. [Troubleshooting](#troubleshooting)

---

## Pre-Test Checklist {#pre-test-checklist}

### Server Status
- [ ] Local server running on `http://localhost:3000`
- [ ] caspio-pricing-proxy deployed and accessible
- [ ] Browser console open (F12) for monitoring

### Form Access
- [ ] Navigate to: `http://localhost:3000/sample-cart.html`
- [ ] Page loads without JavaScript errors
- [ ] Form elements render correctly
- [ ] Billing/shipping sections visible

### Cart Status
- [ ] At least 1 sample product in cart
- [ ] Cart displays products correctly
- [ ] No console errors on page load

---

## Test Scenario 1: Same Billing & Shipping {#test-scenario-1}

**Purpose:** Verify default behavior where shipping address equals billing address

### Step 1: Add Sample Products
1. Navigate to Top Sellers Showcase page
2. Add 2-3 products to cart
3. Click "Request Samples" button
4. Verify cart shows selected products

### Step 2: Fill Contact Information
```
First Name: Test
Last Name: User
Email: test@example.com
Phone: 253-555-1234
Company: Test Company LLC
Sales Representative: Select "erik@nwcustomapparel.com"
```

### Step 3: Fill Billing Address
```
Street Address: 123 Billing St
Apt/Suite: Suite 400
City: Seattle
State: WA
ZIP Code: 98101
```

### Step 4: Shipping Address
- [ ] "Ship to the same address" checkbox is CHECKED
- [ ] Shipping section is HIDDEN
- [ ] No action needed

### Step 5: Add Notes (Optional)
```
Additional Notes: Test order - Same billing and shipping address
```

### Step 6: Submit Order
1. Click "Submit Request" button
2. Watch for success modal
3. Note the Quote ID displayed

### Expected Results

**Success Modal:**
```
✓ Success! Your sample request has been submitted.
Your quote ID is: SAMPLE-1029-X

We'll review your request and be in touch soon!
```

**Console Logs:**
```
[Address] Copied billing to shipping
[Form] Submitting sample request...
[Service] Creating order with 2 samples
[Service] Order response: { success: true, quoteId: "SAMPLE-1029-X" }
[Form] ✓ Sample request successful: SAMPLE-1029-X
```

**Expected Behavior:**
- ✅ No console errors
- ✅ Success modal appears
- ✅ Quote ID follows format: SAMPLE-MMDD-X
- ✅ Shipping fields were auto-populated from billing

---

## Test Scenario 2: Different Billing & Shipping {#test-scenario-2}

**Purpose:** Verify separate billing and shipping addresses work correctly

### Step 1-2: (Same as Scenario 1)
Fill contact info and billing address as above

### Step 3: Uncheck "Ship to same address"
- [ ] Click checkbox to UNCHECK it
- [ ] Shipping section becomes VISIBLE
- [ ] Console logs: `[Address] Shipping address shown (different from billing)`

### Step 4: Fill Shipping Address
```
Street Address: 456 Shipping Ave
Apt/Suite: Building B
City: Tacoma
State: WA
ZIP Code: 98402
```

### Step 5: Submit Order
Submit and watch console logs

### Expected Results

**Success Modal:** (Same as Scenario 1)

**Console Logs:**
```
[Address] Shipping address shown (different from billing)
[Form] Submitting sample request...
[Service] Billing: 123 Billing St, Seattle, WA 98101
[Service] Shipping: 456 Shipping Ave, Tacoma, WA 98402
[Service] Creating order with 2 samples
[Service] Order response: { success: true, quoteId: "SAMPLE-1029-Y" }
[Form] ✓ Sample request successful: SAMPLE-1029-Y
```

**Data Verification:**
Open browser DevTools Network tab → Find POST request → Check payload:
```json
{
  "firstName": "Test",
  "lastName": "User",
  "email": "test@example.com",
  "company": "Test Company LLC",
  "salesRep": "erik@nwcustomapparel.com",
  "billing_address1": "123 Billing St",
  "billing_address2": "Suite 400",
  "billing_city": "Seattle",
  "billing_state": "WA",
  "billing_zip": "98101",
  "shipping_address1": "456 Shipping Ave",
  "shipping_address2": "Building B",
  "shipping_city": "Tacoma",
  "shipping_state": "WA",
  "shipping_zip": "98402"
}
```

---

## Verification Steps {#verification-steps}

### Frontend Verification (Immediate)

1. **Success Modal Appears:**
   - Shows quote ID
   - "We'll be in touch" message
   - Close button works

2. **Console Logs Clean:**
   - No red errors
   - All steps logged successfully
   - Order creation logged

3. **Form Clears:**
   - Form resets after success
   - Cart empties
   - User can submit another request

### Server Response Verification

**Check Network Tab:**
1. Find POST request to `/api/manageorders/orders/create`
2. Status: 200 OK
3. Response body:
```json
{
  "success": true,
  "extOrderId": "NWCA-SAMPLE-1029-X",
  "message": "Order successfully pushed to ManageOrders",
  "timestamp": "2025-10-29T...",
  "onsiteImportExpected": "2025-10-29T..."
}
```

### Proxy Logs Verification

**Check Heroku logs** (if accessible):
```bash
heroku logs --tail --app caspio-pricing-proxy
```

Expected log entries:
```
[ManageOrders PUSH] Transforming order: SAMPLE-1029-X
[ManageOrders PUSH] Customer block: 7 billing fields populated
[ManageOrders PUSH] ShippingAddresses: 1 address added
[ManageOrders PUSH] ✓ Order NWCA-SAMPLE-1029-X pushed successfully
```

---

## Expected Console Logs {#expected-console-logs}

### Successful Order Submission (Full Log)

```javascript
// Page load
[ManageOrdersService] Service initialized
[ManageOrdersService] ✓ Loaded from cache: 389 customers
[Cart] Loaded 2 samples from cart

// Address interaction (Scenario 1 - Same address)
[Address] Copied billing to shipping

// Form submission
[Form] Submitting sample request...
[Service] Customer data prepared
[Service] Creating order with 2 samples
[Service] Sample 1: PC54 - Forest Green
[Service] Sample 2: NE100 - Black

// API communication
[Service] POST /api/manageorders/orders/create
[Service] Request payload: {...}
[Service] Response status: 200
[Service] Response body: {success: true, extOrderId: "NWCA-SAMPLE-1029-1"}

// Success handling
[Form] ✓ Sample request successful: SAMPLE-1029-1
[Form] Displaying success modal
[Form] Clearing cart
```

### Address Toggle Interaction

```javascript
// When unchecking "same as billing"
[Address] Shipping address shown (different from billing)

// When typing in billing field (with checkbox checked)
[Address] Copied billing to shipping

// On form submit (ensures sync)
[Address] Ensured shipping fields populated before submission
```

### Error Scenarios

**Network Error:**
```javascript
[Service] POST /api/manageorders/orders/create
[Service] Network error: Failed to fetch
[Form] ✗ Error submitting request
[Form] Alert: Failed to submit request. Please try again or call 253-922-5793.
```

**Validation Error:**
```javascript
[Form] Validation failed: Email is required
[Form] Validation failed: Phone is required
[Form] Validation failed: Billing address is required
```

---

## OnSite Verification (After Hourly Import) {#onsite-verification}

**Wait Time:** Orders import into OnSite every hour on the hour

### Step 1: Check Last Import Time
1. Open ShopWorks OnSite Order Entry
2. Check "Last Server Import" timestamp
3. Wait for next import if needed

### Step 2: Search for Order
1. Search by Order Number: `NWCA-SAMPLE-1029-X`
2. Or search by ExtOrderID
3. Order should appear in search results

### Step 3: Verify Order Details

**Customer Information:**
- Customer #2791 (all web orders)
- Contact Name: Test User
- Contact Email: test@example.com
- Contact Phone: 253-555-1234

**Billing Address (in Customer Block):**
- BillingCompany: Test Company LLC
- BillingAddress01: 123 Billing St
- BillingAddress02: Suite 400
- BillingCity: Seattle
- BillingState: WA
- BillingZip: 98101

**Shipping Address (in Shipping Block):**
- **Scenario 1 (Same address):**
  - ShipAddress01: 123 Billing St
  - ShipCity: Seattle
  - ShipState: WA
  - ShipZip: 98101

- **Scenario 2 (Different address):**
  - ShipAddress01: 456 Shipping Ave
  - ShipCity: Tacoma
  - ShipState: WA
  - ShipZip: 98402

**Line Items:**
- Product 1: PC54, Color: Forest, Size: OSFA, Qty: 1, Price: $0.01
- Product 2: NE100, Color: Black, Size: OSFA, Qty: 1, Price: $0.01

**Order Notes:**
```
FREE SAMPLE - Top Sellers Showcase - Test Company LLC

Customer: Test User
Email: test@example.com
Phone: 253-555-1234
Company: Test Company LLC
```

### Step 4: Verification Checklist

- [ ] Order number matches quote ID
- [ ] Customer #2791
- [ ] Contact info correct
- [ ] Billing address matches form input
- [ ] Shipping address matches (same or different as expected)
- [ ] All line items present
- [ ] Quantities correct (1 each for samples)
- [ ] Prices = $0.01 each (penny for tracking)
- [ ] Order notes include customer info
- [ ] Sales rep field populated (if applicable)

---

## Troubleshooting {#troubleshooting}

### Issue: "Ship to same address" checkbox doesn't work

**Symptoms:**
- Clicking checkbox doesn't show/hide shipping section
- Console shows no logs when clicking

**Diagnosis:**
```javascript
// Test in console
document.getElementById('same-as-billing');  // Should return element
document.getElementById('shipping-section'); // Should return element
```

**Solution:**
- Check IDs match between HTML and JavaScript
- Verify event listener is attached
- Check for JavaScript errors on page load

---

### Issue: Shipping fields not populated when checkbox is checked

**Symptoms:**
- Checkbox is checked but shipping fields empty
- Form submission fails validation

**Diagnosis:**
```javascript
// Check if copy function works
copyBillingToShipping();
// Check shipping field values
document.getElementById('shipping-address1').value;
```

**Solution:**
- Ensure `copyBillingToShipping()` function is defined
- Check field IDs match between billing and shipping
- Verify function is called on form submit

---

### Issue: Order submission fails with 400 error

**Symptoms:**
- Network tab shows 400 Bad Request
- Console shows API error

**Common Causes:**
1. Missing required fields (check payload)
2. Invalid data format (dates, phone numbers)
3. Missing customer data

**Solution:**
```javascript
// Check payload in Network tab
// Verify all required fields present:
{
  orderNumber: "SAMPLE-1029-X",
  customer: { firstName, lastName, email, phone },
  billing: { address1, city, state, zip },
  shipping: { address1, city, state, zip },
  lineItems: [...]
}
```

---

### Issue: Order appears in OnSite but addresses are wrong

**Symptoms:**
- Order imports successfully
- But billing shows in shipping or vice versa

**Diagnosis:**
Check proxy transformation:
```bash
# Check Heroku logs
heroku logs --tail --app caspio-pricing-proxy | grep "SAMPLE-1029"
```

**Solution:**
- Verify proxy version is v1.1.0 or later
- Check field mapping in manageorders-push-client.js
- Confirm Customer block has BillingAddress* fields
- Confirm ShippingAddresses array has ShipAddress* fields

---

### Issue: Console shows "Cannot read property 'company' of undefined"

**Symptoms:**
- Error on form submission
- Refers to billing or shipping object

**Diagnosis:**
```javascript
// Check FormData collection
const formData = new FormData(document.getElementById('sampleRequestForm'));
console.log([...formData.entries()]);
```

**Solution:**
- Ensure all form fields have `name` attributes
- Check field names match what service expects
- Use optional chaining in service: `formData.billing?.company`

---

### Issue: Quote ID format is wrong

**Symptoms:**
- ID doesn't follow SAMPLE-MMDD-X format
- Or shows as NWCA-SAMPLE-... instead of SAMPLE-...

**Expected Format:**
- Frontend generates: `SAMPLE-1029-1`
- Proxy prefixes: `NWCA-SAMPLE-1029-1`

**Check:**
```javascript
// In sample-order-service.js
const orderNumber = `SAMPLE-${formattedDate}-${sequence}`;
console.log('Generated order number:', orderNumber);
```

---

## Test Results Template

### Test #1: Same Billing & Shipping
- **Date:** YYYY-MM-DD
- **Tester:** Your name
- **Quote ID:** SAMPLE-MMDD-X
- **Result:** ✅ Pass / ❌ Fail
- **Notes:** Any observations or issues

**Checklist:**
- [ ] Form submitted successfully
- [ ] Console logs clean
- [ ] Quote ID correct format
- [ ] Success modal displayed
- [ ] Cart cleared after submission

**Issues Found:** (if any)

---

### Test #2: Different Billing & Shipping
- **Date:** YYYY-MM-DD
- **Tester:** Your name
- **Quote ID:** SAMPLE-MMDD-Y
- **Result:** ✅ Pass / ❌ Fail
- **Notes:** Any observations or issues

**Checklist:**
- [ ] Shipping section showed correctly
- [ ] Different addresses sent to API
- [ ] Network payload shows both addresses
- [ ] Console logs show both addresses
- [ ] Order created successfully

**Issues Found:** (if any)

---

### OnSite Verification (After Import)
- **Import Time:** HH:MM (when order appeared in OnSite)
- **Order Found:** ✅ Yes / ❌ No
- **Billing Address Correct:** ✅ Yes / ❌ No
- **Shipping Address Correct:** ✅ Yes / ❌ No
- **Line Items Correct:** ✅ Yes / ❌ No

**Issues Found:** (if any)

---

## Quick Reference: Testing Commands

### Browser Console Commands
```javascript
// Check form state
document.getElementById('sampleRequestForm');

// Check billing fields
document.getElementById('billing-address1').value;

// Check shipping fields
document.getElementById('shipping-address1').value;

// Check checkbox state
document.getElementById('same-as-billing').checked;

// Test copy function
copyBillingToShipping();

// Check cart
getCartSamples();

// View customer service cache
sessionStorage.getItem('manageorders_customers_cache');
```

### Network Tab Filters
- Filter by: `manageorders`
- Look for: POST requests
- Check: Request payload, Response body, Status code

---

## Success Criteria

**Test is considered SUCCESSFUL if:**

✅ **Frontend:**
- Form submits without console errors
- Success modal appears with correct quote ID
- Cart clears after submission
- All address fields handled correctly

✅ **Network:**
- POST request returns 200 status
- Response includes success: true and extOrderId
- Request payload contains all expected fields
- Billing and shipping sent separately

✅ **OnSite (After Import):**
- Order appears in Order Entry
- Customer #2791 assigned
- Contact info matches form input
- Billing address in Customer block
- Shipping address in Shipping block
- All line items present
- Notes include customer info

---

**Documentation Type:** Testing Guide
**Related Files:**
- sample-cart.html (form)
- sample-order-service.js (service)
- manageorders-push-client.js (proxy transformation)
**Last Updated:** October 29, 2025
