# Manual Pricing Mode - Staff Training Guide

**Last Updated:** January 29, 2025
**Version:** 1.0
**For:** Sales Staff & Account Executives

---

## Overview

Manual Pricing Mode allows you to calculate pricing for products from **non-SanMar vendors** (S&S Activewear, Alphabroder, Cutter & Buck, etc.) using our existing pricing calculators.

### What It Does
- Uses a base garment cost you provide to calculate final pricing
- Applies the same margin formulas as our SanMar products
- Works on all 5 main pricing pages (DTG, Embroidery, Screen Print, Cap Embroidery, DTF)
- Shows pricing instantly without needing product images or catalog data

### When to Use It
- Customer wants products not available in SanMar catalog
- Pricing items from S&S, Alphabroder, Active, Cutter & Buck, etc.
- Need quick pricing estimates for non-catalog items
- Creating internal quotes for special vendor relationships

### Limitations
- **No product images or swatches will display** (acceptable trade-off)
- Internal use only - don't share these URLs with customers
- You must know the base garment cost from the vendor

---

## How to Use Manual Pricing Mode

### Step 1: Get the Base Garment Cost

Before using manual pricing mode, you need the **base garment cost** from your vendor:

**Example:** S&S Activewear T-Shirt costs you $6.25 per piece

### Step 2: Add the URL Parameter

Add `?manualCost=X.XX` to the end of any pricing page URL, where `X.XX` is your base cost.

#### Example URLs:

**DTG Pricing:**
```
https://teamnwca.com/calculators/dtg-pricing.html?manualCost=6.25
```

**Embroidery Pricing:**
```
https://teamnwca.com/calculators/embroidery-pricing.html?manualCost=8.50
```

**Screen Print Pricing:**
```
https://teamnwca.com/calculators/screenprint-pricing.html?manualCost=5.75
```

**Cap Embroidery:**
```
https://teamnwca.com/calculators/cap-embroidery-pricing.html?manualCost=7.00
```

**DTF Pricing:**
```
https://teamnwca.com/calculators/dtf-pricing.html?manualCost=6.50
```

### Step 3: Use the Calculator Normally

Once the page loads with the manual cost parameter:

1. **Orange banner appears** at the top showing you're in Manual Pricing Mode
2. **Banner displays your base cost** so you can verify it's correct
3. **Use calculator as normal** - select quantities, print locations, options, etc.
4. **Pricing updates automatically** based on your manual cost and selections

### Step 4: Exit Manual Mode

When you're done pricing this item:

1. Click the **"Exit Manual Mode"** button in the orange banner, OR
2. Simply navigate to a different page without the `?manualCost` parameter

---

## Visual Guide

### What You'll See

When Manual Pricing Mode is active, you'll see an **orange warning banner** at the top:

```
⚠️ INTERNAL MANUAL PRICING MODE
Base Cost: $6.25 | No product images/swatches will display
[Exit Manual Mode] ←--- Click to exit
```

### What Won't Display
- Product images
- Color swatches
- Product descriptions
- Style numbers (will show as "MANUAL")

### What WILL Work
- All pricing calculations
- Quantity tier pricing
- Print location options
- Size selection and upcharges
- LTM fees (if quantity < 24)
- Quote generation

---

## Pricing Calculation Details

### How Pricing is Calculated

Manual mode uses the **same exact formulas** as our SanMar products:

1. **Start with your base cost:** The garment cost you entered
2. **Apply margin:** Divided by margin denominator (typically 0.6 = ~67% markup)
3. **Add decoration cost:** Print/embroidery/transfer costs based on method
4. **Round up:** To nearest $0.50
5. **Add size upcharges:** 2XL, 3XL, 4XL get standard upcharges

### Default Settings Used

When you use manual pricing mode, these defaults are applied:

#### Quantity Tiers
- 24-47 pieces
- 48-71 pieces
- 72+ pieces

#### Margin Denominators
- 0.6 for all tiers (~67% markup)

#### Decoration Costs

**DTG:**
- Left Chest: $6.00
- Full Front: $8.00
- Full Back: $8.00
- Sleeve: $5.00

**Embroidery:**
- Up to 8,000 stitches: $5.00 (24-47), $4.50 (48-71), $4.00 (72+)

**Screen Print:**
- Varies by color count (1-6 colors)
- Primary location base: $2.00 + ($1.50 × colors)
- Flash charge: $0.35 per color

**Cap Embroidery:**
- 8,000 stitch count: $5.00 (24-47), $4.50 (48-71), $4.00 (72+)

**DTF:**
- Small transfer (5x7"): $1.25
- Medium transfer (11x17"): $2.50
- Large transfer (13x19"): $3.75
- XL transfer (16x20"): $5.00
- Plus $2.00 labor per location

#### Size Upcharges
- S, M, L, XL: No upcharge
- 2XL: +$2.00
- 3XL: +$3.00
- 4XL: +$4.00

#### LTM Fee
- Orders under 24 pieces: $50 flat fee

---

## Common Scenarios

### Scenario 1: Pricing a Premium Polo

**Situation:** Customer wants Nike Dri-FIT polos with left chest embroidery

**Your vendor cost:** $18.50 per polo

**Steps:**
1. Go to: `https://teamnwca.com/calculators/embroidery-pricing.html?manualCost=18.50`
2. Select quantity: 48 pieces
3. Select left chest embroidery
4. Review pricing
5. Generate quote as normal

**Expected Pricing:**
- Garment markup: $18.50 ÷ 0.6 = $30.83
- Embroidery: +$4.50 (48-71 tier)
- Rounded: $35.50 per piece
- 2XL upcharge: +$2.00 = $37.50

---

### Scenario 2: DTG on Premium Tri-Blend

**Situation:** Customer wants soft tri-blend tees with full front print

**Your vendor cost:** $8.75 per shirt

**Steps:**
1. Go to: `https://teamnwca.com/calculators/dtg-pricing.html?manualCost=8.75`
2. Select quantity: 72 pieces
3. Select Full Front location
4. Review pricing

**Expected Pricing:**
- Garment markup: $8.75 ÷ 0.6 = $14.58
- Full Front print: +$8.00
- Rounded: $22.50 per piece

---

### Scenario 3: Small Order with LTM Fee

**Situation:** Customer wants 18 screen printed caps

**Your vendor cost:** $4.50 per cap

**Steps:**
1. Go to: `https://teamnwca.com/calculators/cap-embroidery-pricing.html?manualCost=4.50`
2. Enter quantity: 18 pieces
3. Note the LTM warning

**Expected Pricing:**
- Garment markup: $4.50 ÷ 0.6 = $7.50
- Embroidery: +$5.00 (uses 24-47 tier pricing)
- Rounded: $12.50 per piece
- **LTM Fee:** +$50.00 total order
- Total: (18 × $12.50) + $50 = $275.00

---

## Pro Tips

### 1. Bookmark Common Costs
Create bookmarks for frequently used vendor costs:
- "DTG - S&S Premium ($6.25)"
- "Embroidery - Cutter & Buck Polo ($18.50)"

### 2. Double-Check Your Cost
The orange banner shows your entered cost - verify it's correct before quoting

### 3. Add Notes to Quote
When generating quotes, add a note like:
```
"Pricing based on Cutter & Buck product line"
```

### 4. Compare to SanMar
If similar SanMar products exist, compare pricing to ensure competitiveness

### 5. Watch for Size Runs
Remember that 2XL+ sizes automatically get upcharges - factor this into total cost

---

## Troubleshooting

### Problem: Page looks normal, no orange banner
**Solution:** Check your URL - the `?manualCost=` parameter may be missing or typed incorrectly

### Problem: Pricing seems too high/low
**Solution:**
- Verify the base cost in the orange banner
- Remember our standard ~67% markup is applied
- Check if LTM fee is being added for small orders

### Problem: Can't see product image
**Solution:** This is expected - manual mode doesn't display images for non-catalog items

### Problem: Want to exit but banner is gone
**Solution:** Just navigate to any page without the URL parameter, or refresh the page

### Problem: Entered wrong cost
**Solution:**
- Click "Exit Manual Mode" button
- Change the number in the URL and reload, OR
- Navigate to the page with corrected cost parameter

---

## Quick Reference Card

### URL Format
```
[pricing-page-url]?manualCost=[your-cost]
```

### Example Costs by Vendor
| Vendor | Product Type | Typical Cost Range |
|--------|-------------|-------------------|
| S&S Activewear | Basic Tees | $3.50 - $6.00 |
| Alphabroder | Premium Tees | $6.00 - $10.00 |
| Cutter & Buck | Polos | $15.00 - $25.00 |
| Nike | Performance Wear | $18.00 - $35.00 |
| Caps | Structured/Unstructured | $4.00 - $8.00 |

### Quick Links

**DTG:** `teamnwca.com/calculators/dtg-pricing.html?manualCost=`
**Embroidery:** `teamnwca.com/calculators/embroidery-pricing.html?manualCost=`
**Screen Print:** `teamnwca.com/calculators/screenprint-pricing.html?manualCost=`
**Caps:** `teamnwca.com/calculators/cap-embroidery-pricing.html?manualCost=`
**DTF:** `teamnwca.com/calculators/dtf-pricing.html?manualCost=`

---

## FAQ

**Q: Can I share these manual pricing URLs with customers?**
A: No - these are for internal use only. Generate a quote and send that to customers.

**Q: Will the pricing be accurate for my quotes?**
A: Yes - it uses the exact same pricing formulas as our SanMar products.

**Q: Can I save manual pricing quotes to our database?**
A: Yes - the quote generation works the same as normal pricing pages.

**Q: What if I need different margin percentages?**
A: Contact Erik - we can create custom margin settings if needed for special accounts.

**Q: Can I use this for webstore pricing?**
A: Yes, but remember to factor in the webstore surcharge when quoting.

**Q: Does this work on mobile?**
A: Yes - works on all devices. The orange banner will stack vertically on mobile.

**Q: What happens if I forget to exit manual mode?**
A: It only persists during your current session. Closing the browser or opening a regular pricing page will reset it.

---

## Getting Help

**Questions about this feature:**
Contact Erik Mickelson - erik@nwcustomapparel.com

**Technical issues:**
Contact Erik with:
- URL you're using
- Expected vs actual pricing
- Screenshot of the issue

**Pricing questions:**
Contact your sales manager for margin guidance on non-catalog items

---

## Version History

**v1.0 - January 29, 2025**
- Initial release
- Support for all 5 pricing methods
- Orange banner indicator
- SessionStorage persistence
