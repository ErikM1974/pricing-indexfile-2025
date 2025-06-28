# Cap Pricing Update Documentation
## June 16, 2025

### Executive Summary
This document outlines the comprehensive redesign and technical improvements made to the cap embroidery pricing page for Northwest Custom Apparel. The update addresses critical user experience issues, implements a new pricing calculation system, and provides a more intuitive interface for customers to configure and price custom embroidered caps.

---

## Table of Contents
1. [Overview](#overview)
2. [Problems Addressed](#problems-addressed)
3. [Key Improvements](#key-improvements)
4. [Technical Implementation](#technical-implementation)
5. [Pricing Logic](#pricing-logic)
6. [User Interface Changes](#user-interface-changes)
7. [Testing & Validation](#testing--validation)
8. [Future Enhancements](#future-enhancements)

---

## Overview

### Project Scope
- **Page**: Cap Embroidery Pricing (`/cap-embroidery-pricing`)
- **Date**: June 16, 2025
- **Version**: 3.0
- **Files Modified**: 
  - `cap-embroidery-pricing-integrated.html`
  - `shared_components/js/cap-embroidery-pricing-simple.js`
  - Various CSS components

### Objectives
1. Fix broken Caspio integration and implement direct API pricing
2. Redesign user interface for intuitive pricing configuration
3. Provide transparent, itemized pricing breakdowns
4. Support multiple embroidery locations with dynamic pricing

---

## Problems Addressed

### 1. Technical Issues
- **NWCA namespace missing** - Added required dependencies
- **CaspioDeployment failures** - Implemented direct API approach
- **Missing container IDs** - Fixed universal component initialization
- **Duplicate headers** - Removed redundant HTML elements

### 2. User Experience Issues
- **Disconnected cause and effect** - Controls were at bottom, results at top
- **Premature quote display** - Quote shown before configuration
- **Visual clutter** - Dense wall of numbers overwhelming users
- **Unclear pricing** - Not obvious that prices included embroidery

### 3. Pricing Transparency
- **Hidden fees** - LTM fee not clearly explained
- **Ambiguous adjustments** - Stitch count pricing unclear
- **Missing itemization** - No breakdown of individual costs

---

## Key Improvements

### 1. Redesigned Layout Flow
```
1. Configure Your Order → 2. Your Instant Quote → 3. Price Reference Grid
```

### 2. Enhanced Configuration Controls
- **Quantity input** at the top
- **Front logo slider** with base price at 8,000 stitches
- **Optional logo locations**: Back, Left Side, Right Side
- **Real-time price display** on all sliders
- **Tooltips** showing stitch count and price while dragging

### 3. Transparent Pricing Display
- **Itemized quote breakdown** showing all components
- **Dynamic stitch count display** in quote lines
- **LTM fee calculation** clearly shown per piece
- **Highlighted total price** per piece

### 4. Clear Reference Grid
- Labeled as "Complete Price-Per-Unit Reference Grid"
- Note clarifying prices include cap + embroidery
- Dynamic updates based on front stitch selection

---

## Technical Implementation

### 1. Direct API Integration
```javascript
// Replaced Caspio with direct API calls
const API_BASE_URL = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';

// Fetch pricing components
const tierApiUrl = `${API_BASE_URL}/api/pricing-tiers?method=EmbroideryCaps`;
const ruleApiUrl = `${API_BASE_URL}/api/pricing-rules?method=EmbroideryCaps`;
const sizeDataApiUrl = `${API_BASE_URL}/api/max-prices-by-style?styleNumber=${styleNumber}`;
const costApiUrl = `${API_BASE_URL}/api/embroidery-costs?itemType=Cap&stitchCount=${STITCH_COUNT}`;
```

### 2. Pricing Calculation Engine
```javascript
// Front logo pricing (base: 8,000 stitches)
const BASE_STITCHES = 8000;
const PRICE_PER_THOUSAND = 1.00;
const frontAdjustment = ((stitchCount - BASE_STITCHES) / 1000) * PRICE_PER_THOUSAND;

// Additional logo pricing (base: $5.00 for 5,000 stitches)
const LOGO_BASE_PRICE = 5.00;
const LOGO_BASE_STITCHES = 5000;
const additionalStitches = Math.max(0, stitchCount - LOGO_BASE_STITCHES);
const logoPrice = LOGO_BASE_PRICE + (additionalStitches / 1000) * PRICE_PER_THOUSAND;

// LTM fee distribution
const LTM_FEE = 50.00;
const MIN_QUANTITY = 24;
const ltmPerPiece = quantity < MIN_QUANTITY ? LTM_FEE / quantity : 0;
```

### 3. Rounding Fix
```javascript
// Proper rounding to avoid floating-point errors
pieceTotal = Math.round((pieceTotal + ltmPerPiece) * 100) / 100;
orderTotal = Math.round(pieceTotal * qty * 100) / 100;
```

---

## Pricing Logic

### Base Pricing Structure
| Quantity Tier | Base Price (S/M) | Base Price (M/L) | Base Price (L/XL) |
|--------------|------------------|------------------|-------------------|
| 24-47        | $24.00          | $24.00          | $24.00           |
| 48-71        | $23.00          | $23.00          | $23.00           |
| 72+          | $21.00          | $21.00          | $21.00           |

*Base prices include 8,000 stitch embroidery on front*

### Stitch Count Adjustments
- **Front Logo**: 
  - Base: 8,000 stitches (included in base price)
  - Adjustment: ±$1.00 per 1,000 stitches
  - Range: 5,000 - 20,000 stitches

- **Additional Logos** (Back, Left Side, Right Side):
  - Base: $5.00 for up to 5,000 stitches
  - Additional: +$1.00 per 1,000 stitches above 5,000
  - Range: 5,000 - 20,000 stitches each

### Less Than Minimum (LTM) Fee
- Applies to orders under 24 units
- $50.00 total fee divided by quantity
- Added to per-piece price for transparency

### Example Calculation
```
Quantity: 10 caps
Front Logo: 12,000 stitches (+$4.00 adjustment)
Back Logo: 7,000 stitches ($7.00)

Base Unit Price:        $24.00
+ Front Adjustment:     $ 4.00
+ Back Logo:           $ 7.00
+ LTM Fee (50/10):     $ 5.00
= Total Per Piece:     $40.00

Order Total: $40.00 × 10 = $400.00
```

---

## User Interface Changes

### 1. Visual Hierarchy
- **Step Numbers**: Clear 1-2-3 progression
- **Section Separation**: Distinct bordered sections
- **Color Coding**: 
  - Green for base/savings
  - Red for additional costs
  - Highlighted total in green box

### 2. Interactive Elements
- **Slider Tooltips**: Show both stitch count and price
- **Expandable Sections**: Additional logos hidden by default
- **Real-time Updates**: All changes reflect immediately
- **Price Indicators**: +/- symbols for clarity

### 3. Responsive Design
- Two-column layout on desktop
- Single column on mobile
- Proper spacing and padding throughout

---

## Testing & Validation

### Calculation Accuracy
✅ Front logo pricing adjustments (+/- from 8,000 base)
✅ Back/side logo pricing ($5 base + $1/1000 stitches)
✅ LTM fee distribution (verified $50/23 = $2.17)
✅ Total calculations with proper rounding
✅ Reference grid updates with front stitch changes

### User Experience Testing
✅ Slider functionality with tooltips
✅ Checkbox toggling for additional logos
✅ Dynamic quote updates
✅ Clear pricing transparency

### Browser Compatibility
- Chrome/Edge: Full functionality
- Firefox: Full functionality
- Safari: Full functionality
- Mobile: Responsive layout working

---

## Future Enhancements

### Potential Additions
1. **Save Quote** functionality
2. **Email Quote** with PDF generation
3. **Design preview** with logo placement visualization
4. **Bulk order** special pricing tiers
5. **Thread color** selection interface
6. **Setup fee** handling for new designs

### Technical Improvements
1. **Caching** for faster API responses
2. **Offline mode** with local pricing data
3. **A/B testing** framework for pricing experiments
4. **Analytics integration** for user behavior tracking

---

## Conclusion

The June 16, 2025 cap pricing update successfully transforms a problematic, confusing interface into an intuitive, transparent pricing tool. By reorganizing the layout, implementing clear pricing logic, and providing real-time feedback, we've created a user experience that guides customers naturally through the configuration process while building trust through complete price transparency.

### Key Achievements
- ✅ Fixed all technical issues
- ✅ Implemented intuitive 3-step workflow
- ✅ Provided complete pricing transparency
- ✅ Enhanced user engagement with interactive controls
- ✅ Ensured calculation accuracy to the penny

### Impact
This update is expected to:
- Reduce customer confusion and support calls
- Increase quote-to-order conversion rates
- Build trust through transparent pricing
- Streamline the ordering process

---

*Documentation prepared by: Development Team*  
*Last updated: June 16, 2025*