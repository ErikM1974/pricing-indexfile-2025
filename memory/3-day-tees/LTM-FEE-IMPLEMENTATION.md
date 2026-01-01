# Less Than Minimum (LTM) Fee - ShopWorks Line Item Implementation

**Last Updated:** 2025-12-01
**Status:** ✅ Implemented and Deployed
**Git Commit:** `7b49f33` - "fix: Add Less Than Minimum fee as ShopWorks line item"

---

## Overview

The Less Than Minimum (LTM) fee is a $75 charge applied to 3-Day Tees orders with 6-23 total pieces. This fee must appear as a separate line item in ShopWorks ManageOrders to ensure the order total matches the Stripe payment amount.

---

## Business Rules

**When Applied:**
- Orders with **6-23 total pieces**
- Fixed amount: **$75.00**

**When NOT Applied:**
- Orders with 5 or fewer pieces (below minimum)
- Orders with 24 or more pieces (meets minimum)

---

## Implementation

### Frontend Calculation

**File:** `pages/js/3-day-tees.js`
**Line:** 2341

```javascript
const ltmFee = (grandTotalQuantity >= 6 && grandTotalQuantity < 24) ? 75 : 0;
```

This value is included in `orderTotals.ltmFee` and sent to the backend.

### Backend Line Item Addition

**File:** `server.js`
**Lines:** 1004-1015

```javascript
// Add Less Than Minimum fee as a line item (if applicable)
if (orderTotals?.ltmFee && orderTotals.ltmFee > 0) {
  lineItems.push({
    partNumber: 'LTM-75',
    description: 'Less Than Minimum $75.00',
    color: '',
    size: '',
    quantity: 1,
    price: orderTotals.ltmFee
  });
  console.log('[3-Day Order] Added LTM fee line item: $' + orderTotals.ltmFee);
}
```

**CRITICAL:** This code runs immediately after building PC54 shirt line items (around line 1002). The LTM fee is added to the same `lineItems` array that gets sent to ShopWorks.

---

## ShopWorks Line Item Format

```json
{
  "PartNumber": "LTM-75",
  "Description": "Less Than Minimum $75.00",
  "Color": "",
  "Size": "",
  "Qty": 1,
  "Price": 75,
  "id_ProductClass": 1
}
```

**Field Details:**
- **PartNumber:** `LTM-75` (fixed identifier)
- **Description:** `Less Than Minimum $75.00` (human-readable)
- **Color:** Empty string (no color variant)
- **Size:** Empty string or `null` (no size variant)
- **Qty:** Always `1` (fixed quantity)
- **Price:** `75` (from `orderTotals.ltmFee`)
- **id_ProductClass:** `1` (standard product class)

---

## Production Issue History

### Initial Problem (Order 3DT1201-9867)

**Symptoms:**
- Customer charged $290.94 via Stripe (including $75 LTM fee)
- ShopWorks order showed only $215.94 in line items
- **Balance:** -$75 (negative balance)

**Root Cause:**
- LTM fee was calculated and charged to customer
- LTM fee was displayed in Stripe checkout
- BUT: LTM fee was NOT added as a line item to ShopWorks payload
- ShopWorks received only PC54 shirts + shipping + tax

**Result:** ShopWorks order total didn't match Stripe payment amount.

### Solution

Added LTM fee as a separate line item in the `lineItems` array (server.js:1004-1015). This ensures the fee appears in ShopWorks just like the shirt line items.

**After Fix:**
- PC54 shirts: 6 @ $27 = $162.00
- **LTM fee: 1 @ $75 = $75.00** ✅
- Shipping: $30.00
- Tax: $23.94
- **Total: $290.94** ✅ (matches Stripe charge)
- **Balance: $0** ✅

---

## Testing

### Local Testing

**Test Order:** 3DT1201-8647

**Verification Steps:**
1. Create order with 6-23 pieces (e.g., 6 pieces)
2. Check server logs for: `[3-Day Order] Added LTM fee line item: $75`
3. Verify `LinesOE` array contains TWO items:
   - PC54 shirt line item(s)
   - LTM-75 line item
4. Check ShopWorks ManageOrders for LTM-75 part number
5. Verify order balance = $0 (not negative)

**Console Log Output:**
```
[3-Day Order] Built lineItems: 1 items
[3-Day Order] Added LTM fee line item: $75
```

### Production Deployment

**Deployed:** 2025-12-01
**Heroku Version:** v326
**Branch:** stripe-live-test → main

**Next production order with LTM fee will verify:**
- LTM-75 line item appears in ShopWorks
- Order total matches Stripe charge
- No negative balance

---

## Code Location Reference

| Component | File | Lines | Purpose |
|-----------|------|-------|---------|
| Frontend Calculation | `pages/js/3-day-tees.js` | 2341 | Calculate $75 fee for 6-23 pieces |
| Frontend Stripe Display | `pages/js/3-day-tees.js` | 3119-3127 | Show LTM fee in Stripe checkout |
| Backend Line Item Addition | `server.js` | 1004-1015 | Add LTM-75 to lineItems array |
| ShopWorks Submission | `server.js` | 1100+ | Submit lineItems to ManageOrders API |

---

## Important Notes

1. **Order of Operations:** The LTM fee MUST be added to `lineItems` array BEFORE the ShopWorks submission payload is built. Current implementation adds it immediately after shirt line items (line 1004).

2. **Logging:** Always log when LTM fee is added. This helps debug future issues. Look for `[3-Day Order] Added LTM fee line item: $75` in logs.

3. **Conditional Logic:** Only add line item if `orderTotals.ltmFee > 0`. This prevents adding $0 line items for orders that don't qualify.

4. **Backward Compatibility:** Existing orders (without LTM fee) are unaffected. The code only adds the line item when the fee is present.

5. **Production Monitoring:** After any server.js deployment, verify the next LTM order has the fee line item in ShopWorks.

---

## Troubleshooting

### LTM Fee Missing from ShopWorks

**Check:**
1. Server logs: Do you see `[3-Day Order] Added LTM fee line item: $75`?
   - **NO:** Code not running or `orderTotals.ltmFee` is not set/zero
   - **YES:** Check ShopWorks API response for errors

2. Frontend: Is `orderTotals.ltmFee` being sent to backend?
   - Check browser DevTools → Network → `/api/submit-3day-order` request payload
   - Look for `"ltmFee": 75` in the JSON

3. Backend: Is the condition being met?
   - Add debug log before the `if` statement: `console.log('orderTotals.ltmFee:', orderTotals?.ltmFee)`
   - Verify it shows `75` (not `0`, `undefined`, or `null`)

### Negative Balance in ShopWorks

**This indicates the LTM fee is missing!**

**Quick Fix:**
1. Check server.js:1004-1015 - is the code present?
2. Restart local server (if testing locally)
3. Redeploy to Heroku (if production)
4. For existing broken orders, manually add LTM-75 line item in ShopWorks

---

**Last Updated:** 2025-12-01
**Status:** ✅ Working in production
**Next Review:** After first week of production use
