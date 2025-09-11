# Screen Print Pricing Decisions & Implementation Guide

## Date: 2025-01-10
## Author: Erik Mickelson & Claude

---

## 📋 Executive Summary

This document captures all pricing formula decisions and implementation requirements for the Screen Print Quote Builder. These decisions were made to align the quote builder with the existing Screen Print Pricing Calculator while improving clarity for customers and account executives.

---

## 🔢 Core Pricing Formula

### Base Calculation
```
1. Base Print Cost (from API) + Flash Charge ($0.35) = Total Cost
2. Total Cost / Margin Denominator = Print Selling Price  
3. Print Selling Price + Garment Selling Price = Final Unit Price
4. Round UP to nearest $0.50 (HalfDollarCeil_Final)
```

### API Endpoint
- **URL**: `https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/pricing-bundle?method=ScreenPrint&styleNumber={style}`
- **Returns**: Tier data with LTM fees, pricing matrices, setup fees

---

## 📊 Pricing Tiers & LTM Fees

### Current Tier Structure (from API)
| Quantity Range | Tier Label | LTM Fee | Margin Denominator |
|---------------|------------|---------|-------------------|
| 13-36 pieces  | 13-36      | $75     | 0.45             |
| 37-72 pieces  | 37-72      | $50     | 0.50             |
| 73-144 pieces | 73-144     | $0      | 0.55             |
| 145-576 pieces| 145-576    | $0      | 0.60             |

### Key Decisions
- **Minimum Order**: 24 pieces (business rule, even though API supports 13+)
- **LTM Fee Source**: Use API tier data, NOT hardcoded values
- **LTM Display**: Include in per-unit price with breakdown on hover

---

## 🎨 Dark Garment Handling

### Decision: Transparent Total (Option A)
- **User Experience**: Show total colors transparently
- **Example**: "2 design colors + 1 white base = 3 colors total"
- **Pricing Impact**: 
  - Unit price based on 3-color tier
  - Setup fee: $90 (3 screens × $30)
- **Rationale**: Educates customer, prevents pricing surprises

### Implementation
```javascript
// When dark garment is selected with 2 colors
displayColors = "2 design colors + 1 white base = 3 colors total"
effectiveColors = designColors + 1
setupFee = effectiveColors * 30
```

---

## 🦺 Safety Stripe Pricing

### Decision: Simplified Surcharge (Option 3)
- **Implementation**: Simple checkbox per location
- **Surcharge**: $2.00 per piece per location
- **Color Handling**: Treat as regular design (typically 4 colors)
- **Tooltip Text**: "Safety stripes typically require 4 colors: white base + 2 stripe colors + company logo"

### UI Design
```
Front Design:
Colors: [1] [2] [3] [4] [5] [6]
☐ Safety stripe elements (+$2.00/piece) ⓘ

Back Design:  
Colors: [0] [1] [2] [3] [4] [5] [6]
☐ Safety stripe elements (+$2.00/piece) ⓘ
```

---

## 💰 Price Display Strategy

### Decision: All-Inclusive with Hover Breakdown (Option C)

#### Main Display
```
$13.56
per shirt
```

#### On Hover/Expand
```
Price Breakdown:
Base (garment + 4-color print): $12.00
Small batch fee (distributed): $1.56
Safety stripe surcharge: $2.00
─────────────────────────────────
Total per shirt: $15.56
```

### Benefits
- Reduces decision friction
- Provides transparency when needed
- Clean interface
- Industry standard approach

---

## 🚫 Minimum Order Enforcement

### Decision: Soft Warning with Alternatives

#### For Orders < 24 Pieces
```
⚠️ Screen printing requires a minimum of 24 pieces

For smaller quantities, we recommend:
• Direct to Garment (DTG) - Best for 1-23 pieces
• Direct to Film (DTF) Transfers - Great for small batches

[Switch to DTG Calculator] [Switch to DTF Calculator] [Continue Anyway]
```

### Implementation
- Allow quantity input >= 1
- Show warning banner when < 24
- Disable "Generate Quote" but allow viewing
- Provide calculator alternatives

---

## 💵 Setup Fees

### Standard Setup
- **Cost**: $30 per color per location
- **Source**: API `rulesR.SetupFeePerColor`
- **Dark Garment**: Adds +1 screen for white underbase
- **Example**: Front 2-color on dark = 3 screens × $30 = $90

---

## ⚡ Flash Charge

### Current Implementation
- **Amount**: $0.35 per piece (from API)
- **Application**: Added to base print cost before margin
- **Visibility**: Built into final price, not shown separately

---

## 🐛 Current Issues to Fix

### 1. LTM Fee Not Using API Data
**Problem**: Hardcoded to `const ltmFeeTotal = 0`
**Solution**: Use tier data from API response

### 2. Size Matrix Not Displaying
**Problem**: Using wrong API response property
**Solution**: Fixed - use `data.sizes` instead of `data.data`

### 3. Incorrect Totals in Step 3
**Problem**: Not including LTM fees in calculations
**Solution**: Apply tier-based LTM fees to totals

---

## ✅ Testing Requirements

### Test Cases
1. **24 pieces PC54, 1 color front**
   - Products: $X × 24
   - Setup: $30
   - LTM: $75
   - Total should match existing calculator

2. **48 pieces PC54, 1 color front**
   - Products: $576 (48 × $12)
   - Setup: $30
   - LTM: $50
   - Total: $656

3. **73 pieces PC54, 1 color front**
   - No LTM fee should apply
   - Only products + setup

4. **Dark Garment Test**
   - 2 colors selected + dark garment
   - Should show as 3 colors total
   - Setup: $90 (3 × $30)

5. **Safety Stripe Test**
   - 4 colors + safety stripe checkbox
   - Should add $2.00 per piece
   - Clear in pricing breakdown

---

## 📝 Implementation Priority

1. **Critical**: Fix LTM fee logic to use API data
2. **Critical**: Ensure setup fees calculate correctly
3. **High**: Implement dark garment transparent display
4. **High**: Simplify safety stripe to checkbox
5. **Medium**: Add price breakdown on hover
6. **Medium**: Add soft warning for < 24 pieces
7. **Low**: Add links to alternative calculators

---

## 🔗 Related Files

- `/shared_components/js/screenprint-quote-pricing.js` - Core pricing logic
- `/shared_components/js/screenprint-pricing-service.js` - API integration
- `/screenprint-quote-builder.html` - Main quote builder interface
- `/shared_components/js/screenprint-pricing-v2.js` - Existing calculator (reference)

---

## 📌 Key Takeaways

1. **Always use API data** for pricing tiers and LTM fees
2. **Be transparent** about color counts and fees
3. **Guide customers** to appropriate decoration methods
4. **Match existing calculator** functionality exactly
5. **Simplify where possible** without losing accuracy

---

## 🚀 Next Steps

1. Implement LTM fee fixes
2. Update UI for dark garment handling
3. Simplify safety stripe interface
4. Add pricing breakdowns
5. Test against existing calculator
6. Deploy to production

---

*This document serves as the single source of truth for Screen Print pricing decisions.*