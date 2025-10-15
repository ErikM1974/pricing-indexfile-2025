# Screen Print LTM Fee Fix - Testing Guide

**Date:** 2025-10-12
**Bug Fixed:** LTM (Less Than Minimum) fee missing from quote builder
**Root Cause:** Wrong parameter passed to `calculateLTMFee` method
**Fix Applied:** Line 2665-2676 in `screenprint-quote-builder.html`

---

## 🐛 The Bug

### What Was Wrong
```javascript
// LINE 2665 - BEFORE (WRONG)
const ltmFee = this.calculateLTMFee(totalQuantity, pricingDataByStyle);
//                                                  ^^^^^^^^^^^^^^^^^^
//                         This is { "PC61": {...}, "PC54": {...} }
//                         But method expects pricingData object directly!
```

The `calculateLTMFee` method was checking for `pricingDataByStyle.tierData`, but `pricingDataByStyle` is actually a **collection** of pricing data objects keyed by style number (like `{ "PC61": {tierData: ...}, "PC54": {tierData: ...} }`).

Since `pricingDataByStyle.tierData` doesn't exist, the method always returned `0`.

### The Fix
```javascript
// LINES 2666-2669 - AFTER (CORRECT)
const firstStyle = Object.keys(pricingDataByStyle)[0];
const pricingData = pricingDataByStyle[firstStyle];
const ltmFee = this.calculateLTMFee(totalQuantity, pricingData);
```

Now we extract the first product's pricing data (all products share the same tier structure anyway), and pass the correct object.

---

## ✅ LTM Fee Structure

| Quantity Range | LTM Fee | Notes |
|----------------|---------|-------|
| 24-36 pieces | **$75.00** | Higher small batch fee |
| 37-72 pieces | **$50.00** | Lower small batch fee |
| 73+ pieces | **$0.00** | No fee (standard minimum met) |

These values come from the API's `tierData` structure:
```javascript
tierData: {
    "24-36": { MinQuantity: 24, MaxQuantity: 36, LTM_Fee: 75.00 },
    "37-72": { MinQuantity: 37, MaxQuantity: 72, LTM_Fee: 50.00 },
    "73-144": { MinQuantity: 73, MaxQuantity: 144, LTM_Fee: 0 }
}
```

---

## 🧪 Testing Protocol

### Test Setup
1. Clear browser cache
2. Open both calculators in separate tabs:
   - **Tab 1:** `/calculators/screen-print-pricing.html?StyleNumber=PC61`
   - **Tab 2:** `/quote-builders/screenprint-quote-builder.html`

### Test Case Matrix

| Test # | Qty | Front Colors | Expected LTM | Expected Price/pc | Expected Total | Notes |
|--------|-----|--------------|--------------|-------------------|----------------|-------|
| **1** | **24** | 1 + underbase | **$75.00** | $14.00 + $3.13 = $17.13 | $486.00 + $60 = $546 | Lower 24-36 boundary |
| **2** | **30** | 1 + underbase | **$75.00** | $14.00 + $2.50 = $16.50 | $495.00 + $60 = $555 | Mid 24-36 tier |
| **3** | **36** | 1 + underbase | **$75.00** | $14.00 + $2.08 = $16.08 | $579.00 + $60 = $639 | Upper 24-36 boundary |
| **4** | **37** | 1 + underbase | **$50.00** | ~$14.00 + $1.35 | ~$568.00 + $60 | Tier change |
| **5** | **48** | 1 + underbase | **$50.00** | $14.00 + $1.04 = **$15.04** | $722.00 + $60 = **$782** | **YOUR TEST** |
| **6** | **72** | 1 + underbase | **$50.00** | $14.00 + $0.69 = $14.69 | $1058.00 + $60 = $1118 | Upper 37-72 boundary |
| **7** | **73** | 1 + underbase | **$0.00** | ~$13.50 | ~$986.00 + $60 = $1046 | Tier change, no fee |
| **8** | **100** | 1 + underbase | **$0.00** | ~$13.50 | ~$1350.00 + $60 = $1410 | Mid 73-144 tier |

### Test Procedure for Each Case

#### Pricing Page:
1. Navigate to `/calculators/screen-print-pricing.html?StyleNumber=PC61`
2. Select color: **Jet Black**
3. Select tier or enter quantity
4. Set front colors to **1**
5. Check "Dark Garment" (adds underbase)
6. **Record:**
   - Price per shirt (includes LTM if applicable)
   - Total setup fee
   - LTM fee amount (if shown)
   - Grand total

#### Quote Builder:
1. Navigate to `/quote-builders/screenprint-quote-builder.html`
2. **Step 1:** Set front colors to **1**, check "Dark Garment"
3. **Step 2:** Search for **PC61**, select **Jet Black**
4. **Step 3:** Enter quantity in size M (all in one size for simplicity)
5. Click "Continue to Summary"
6. **Record:**
   - Products Subtotal
   - Setup Fees
   - Small Batch Fee (should show if qty < 73)
   - Grand Total

#### Verification:
```
✅ PASS if:
- LTM fees match between both calculators
- Grand totals match (within $0.01 due to rounding)
- LTM fee displays in quote builder summary
- Console shows: "[ScreenPrintQuote] LTM Fee Calculation: {...}"

❌ FAIL if:
- LTM fee is $0 when it should be $50 or $75
- Totals don't match between calculators
- No LTM fee line shows in quote builder
```

---

## 🔍 Console Debugging

After the fix, the quote builder will log LTM calculation:

```javascript
[ScreenPrintQuote] LTM Fee Calculation: {
    totalQuantity: 48,
    tierData: "Found",  // ← Should say "Found" not "Missing"
    ltmFee: 50          // ← Should show correct fee, not 0
}
```

**If you see:**
- `tierData: "Missing"` → Bug not fixed, still passing wrong data
- `ltmFee: 0` when quantity < 73 → Check API tier data has LTM_Fee values

---

## 📊 Expected Results for Test Case #5 (Your Original Test)

### Configuration:
- Product: PC61 Jet Black
- Quantity: 48 pieces (all size M)
- Front: 1 color + 1 underbase (dark garment)
- Additional locations: None

### Pricing Page Result:
```
Price per shirt: $15.04
(all fees included)

Breakdown:
- Shirt: $7.50
- Print (1 + underbase): $6.50
- Subtotal: $14.00
- Small Batch Fee: $50.00 ÷ 48 = $1.04/shirt
= $15.04 per shirt

Setup Fees:
- 2 colors × $30.00 = $60.00

Order Total:
- 48 × $15.04 = $722.00
- Setup: $60.00
= $782.00
```

### Quote Builder Result (AFTER FIX):
```
Products Subtotal: $672.00
(48 × $14.00)

Setup Fees: $60.00
(2 screens × $30)

Small Batch Fee (48 pieces): $50.00
← THIS LINE SHOULD NOW APPEAR!

GRAND TOTAL: $782.00
```

### Comparison:
```
Pricing Page:  $782.00 ✅
Quote Builder: $782.00 ✅
MATCH! ✅
```

---

## 🎯 Critical Verification Points

### 1. LTM Fee Displays in Quote Builder
**Location:** Quote summary (Step 3)

Should see:
```html
<div class="summary-row" style="color: #ff9800;">
    <span>Small Batch Fee (48 pieces):</span>
    <span>$50.00</span>
</div>
```

### 2. LTM Fee Included in Grand Total
```javascript
grandTotal = subtotal + setupFee + ltmFee
           = $672.00 + $60.00 + $50.00
           = $782.00 ✅
```

### 3. Console Log Confirms Calculation
```
[ScreenPrintQuote] LTM Fee Calculation: {
    totalQuantity: 48,
    tierData: "Found",
    ltmFee: 50
}
```

### 4. Database Save Includes LTM Fee
Check the quote service saves ltmFee:
```javascript
this.currentPricing = {
    totalQuantity: 48,
    productPricing: [...],
    subtotal: 672.00,
    setupFee: 60.00,
    ltmFee: 50.00,      // ← Should NOT be 0
    grandTotal: 782.00
};
```

---

## 🐛 Troubleshooting

### Issue: Still showing $0 LTM fee

**Check 1:** Browser cache cleared?
```bash
# Hard refresh
Ctrl + Shift + R (Windows/Linux)
Cmd + Shift + R (Mac)
```

**Check 2:** Console shows correct data?
```javascript
// Should see:
[ScreenPrintQuote] LTM Fee Calculation: {
    totalQuantity: 48,
    tierData: "Found",  // ← If "Missing", fix didn't work
    ltmFee: 50
}
```

**Check 3:** File saved correctly?
```bash
# Check line 2666-2669 exists:
grep -n "const firstStyle = Object.keys" screenprint-quote-builder.html
# Should show line number around 2666
```

### Issue: LTM fee shows wrong amount

**Check:** API tier data
```javascript
// Test in pricing page console:
window.screenPrintCalc.state.pricingData.tierData

// Should show:
{
    "24-36": { LTM_Fee: 75 },
    "37-72": { LTM_Fee: 50 },
    "73-144": { LTM_Fee: 0 }
}
```

### Issue: Totals still don't match

**Check:** Other differences (setup fees, print costs)
```javascript
// Compare base product pricing first:
// Should both show $14.00 for base (before LTM)
```

---

## 📝 Post-Testing Checklist

After all tests pass:

- [ ] Test Case #1 (24 qty, $75 LTM) - PASS
- [ ] Test Case #2 (30 qty, $75 LTM) - PASS
- [ ] Test Case #3 (36 qty, $75 LTM) - PASS
- [ ] Test Case #4 (37 qty, $50 LTM) - PASS
- [ ] Test Case #5 (48 qty, $50 LTM) - PASS ← **YOUR ORIGINAL TEST**
- [ ] Test Case #6 (72 qty, $50 LTM) - PASS
- [ ] Test Case #7 (73 qty, $0 LTM) - PASS
- [ ] Test Case #8 (100 qty, $0 LTM) - PASS
- [ ] Console logs confirm LTM calculation
- [ ] LTM fee displays in quote summary
- [ ] Grand totals match between calculators
- [ ] Database save includes LTM fee
- [ ] Test with 2+ products in quote (should still work)
- [ ] Test with different styles (PC54, PC61, etc.)

---

## 🎉 Success Criteria

✅ **COMPLETE SUCCESS** when:
1. All 8 test cases show correct LTM fees
2. Quote builder totals match pricing page exactly
3. LTM fee line appears in quote summary (when applicable)
4. Console logs confirm calculation is working
5. No JavaScript errors in console

---

## 📞 If Issues Persist

1. **Check the fix was applied:** Look at line 2666-2669
2. **Check browser console:** Any JavaScript errors?
3. **Check API data:** Does tier data have LTM_Fee fields?
4. **Compare specific numbers:** Where exactly do they diverge?

**Report format:**
```
Test Case: #5 (48 qty)
Pricing Page Result: $782.00
Quote Builder Result: $732.00
Difference: $50.00
Expected LTM: $50.00
Actual LTM shown: $0.00
Console log: [paste here]
```

---

**Status:** Fix Applied ✅
**Ready for Testing:** Yes
**Expected Duration:** 30-45 minutes for full test matrix
**Critical Test:** Test Case #5 (your original 48-piece test)
