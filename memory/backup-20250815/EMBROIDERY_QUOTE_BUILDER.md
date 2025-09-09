# Embroidery Quote Builder Documentation

## Overview
A comprehensive quote builder tool for sales representatives to quickly create professional **flat embroidery** quotes with multiple product styles, dynamic sizing, and automatic pricing calculations. This tool streamlines the complex process of quoting embroidery orders that combine different garment styles with shared logo designs.

**Important**: This calculator is for **flat embroidery** on shirts, apparel, and beanies. Beanies are embroidered flat before assembly and can be combined with other garments for quantity pricing discounts. For structured caps (baseball caps, trucker hats, etc.), use the separate Cap Embroidery Calculator.

## Purpose & Benefits

### Business Need
Sales reps need a fast, accurate way to quote embroidery orders that often include:
- Multiple garment styles (PC54, J790, PC90H, etc.)
- Various sizes with different quantities per size
- Multiple logo placements with different stitch counts
- Automatic tier pricing based on total quantity
- Professional output for customers

### Key Benefits
- **Speed**: Create complex quotes in under 2 minutes
- **Accuracy**: API-driven product data and automatic calculations
- **Visual Confirmation**: Product images and color swatches prevent errors
- **Professional Output**: Clean, branded quotes with all specifications
- **Database Persistence**: Save, retrieve, and edit quotes
- **Tier Optimization**: Customers benefit from aggregate quantity pricing

## User Workflow

### 1. Logo Definition Phase
**Purpose**: Define all embroidery specifications that will apply to ALL garments

**Interface**:
```
EMBROIDERY SETUP
┌─────────────────────────────────────────────────────────┐
│ ✓ Logo 1: Left Chest - 8,000 stitches                  │
│   ☑ Needs digitizing ($100)              [Edit] [Delete]│
│                                                         │
│ ✓ Logo 2: Full Back - 12,000 stitches                  │
│   ☐ Needs digitizing ($100)              [Edit] [Delete]│
│                                                         │
│ [+ Add Another Logo]                                    │
└─────────────────────────────────────────────────────────┘
```

**Fields per Logo**:
- Position dropdown (dynamically loaded from API - shirts only, no cap positions)
- Stitch count input (minimum 1,000, increment by 1,000)
- Digitizing checkbox ($100 per logo if needed - configurable via API)

### 2. Product Addition Phase
**Purpose**: Build line items with style-specific sizing

**Interface**:
```
ADD PRODUCTS
┌─────────────────────────────────────────────────────────┐
│ Style: [PC54___] 🔍  Color: [Black ▼]                  │
│                                                         │
│ [IMG] PC54 - Core Cotton Tee                           │
│       Port & Company                                    │
│                                                         │
│ Size Matrix:                                           │
│ S [10] M [10] L [10] XL [5] 2XL [2] 3XL [1] 4XL [0]  │
│                                                         │
│ [Add to Quote]                                         │
└─────────────────────────────────────────────────────────┘
```

**Dynamic Features**:
- Style autocomplete with API lookup
- Product image and description display
- Available sizes fetched from API
- Color dropdown with swatches
- Size inputs only show available sizes

### 3. Quote Summary Phase
**Purpose**: Review, edit, and finalize the quote

**Interface**:
```
QUOTE SUMMARY
┌─────────────────────────────────────────────────────────┐
│ Style    Description              Qty    Price    Total │
│ ────────────────────────────────────────────────────── │
│ [img] PC54  Core Cotton Tee       30                   │
│       Black S(10) M(10) L(10) XL(5)    $24.25  $606.25│
│            2XL(3)                       $26.25   $78.75│
│            3XL(2)                       $27.25   $54.50│
│                                                 [Delete]│
│ ────────────────────────────────────────────────────── │
│ [img] J790  Port Authority Polo   18                   │
│       Navy  S(5) M(5) L(8)             $24.25  $436.50│
│            2XL(2)                       $26.25   $52.50│
│                                                 [Delete]│
│ ────────────────────────────────────────────────────── │
│ Total Pieces: 48            Subtotal: $1,228.50        │
│ Setup Fees (2 logos): $200.00                          │
│ GRAND TOTAL: $1,428.50                                 │
└─────────────────────────────────────────────────────────┘
```

## Pricing Logic

### Embroidery Tier Pricing (Flat Embroidery - Shirts & Beanies)
Based on TOTAL quantity across ALL styles and sizes:

| Quantity Range | Embroidery Cost | Notes |
|---------------|------------|-------|
| 1-23 pieces | $12.00 | Plus $50 LTM fee distributed |
| 24-47 pieces | $12.00 | Standard tier |
| 48-71 pieces | $11.00 | Volume discount |
| 72+ pieces | $10.00 | Best pricing |

**Note**: These prices are fetched dynamically from the API (Embroidery_Costs table) and may be updated in Caspio without code changes. All tiers use 0.6 margin denominator.

### Additional Stitch Pricing
- Base included stitches: 8,000 (configurable via API)
- Additional stitches: $1.25 per 1,000 stitches for shirts/beanies
- Each logo priced separately, then summed
- Minimum stitch count: 1,000 (rounded to nearest 1,000)

### Size Upcharges
Applied to final decorated price (style-specific from API):
- **Common pattern**: 2XL: +$2.00, 3XL: +$3.00, 4XL: +$4.00, 5XL: +$6.00, 6XL: +$7.00
- **Ladies styles**: May use XXL instead of 2XL
- **Must fetch from**: `/api/size-pricing?styleNumber={style}` for accurate upcharges

### LTM (Less Than Minimum) Fee
- Applies when total quantity < 24 pieces
- $50 total fee distributed across all units
- Example: 20 pieces = $50 ÷ 20 = $2.50 added per unit
- Note on quote: "*Includes small batch pricing for orders under 24 pieces"

### Calculation Formula
```javascript
// Per garment calculation (using actual API logic)
// 1. Get tier based on TOTAL quantity across ALL products
const tier = getTierForQuantity(totalQuantity); // e.g., 48 = "48-71"
const embCost = tier.EmbroideryCost; // e.g., $11 for 48-71

// 2. Get style-specific pricing
const sizePricing = await fetch(`/api/size-pricing?styleNumber=${style}`);
const baseGarmentPrice = sizePricing.basePrices[size];
const sizeUpcharge = sizePricing.sizeUpcharges[size] || 0;

// 3. Calculate decorated price
const garmentPrice = baseGarmentPrice / 0.6; // Apply margin
const embroideryPrice = embCost + additionalStitchCost;
const decoratedPrice = garmentPrice + embroideryPrice;

// 4. Apply size upcharge and rounding
const finalPrice = Math.ceil((decoratedPrice + sizeUpcharge) * 2) / 2; // Round UP to $0.50

// 5. Apply LTM if needed
if (totalQuantity < 24) {
  const ltmPerUnit = 50 / totalQuantity;
  finalPrice += ltmPerUnit;
}

lineTotal = finalPrice * quantity
```

## Quote Output Format

### Screen Display
```
EMBROIDERY QUOTE #EMB1201-1
Valid for 30 days (Expires: January 31, 2025)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

EMBROIDERY SPECIFICATIONS:
• Left Chest Logo - 8,000 stitches ✓ Digitizing: $100
• Full Back Logo - 12,000 stitches
*Includes small batch pricing for orders under 24 pieces

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PRODUCTS:

Style PC54 - Black - 30 pieces
Port & Company Core Cotton Tee
S(10) M(10) L(10) XL(5) @ $24.25 each = $606.25
2XL(3) @ $26.25 each = $78.75
3XL(2) @ $27.25 each = $54.50
Subtotal: $739.50

Style J790 - Navy - 18 pieces
Port Authority Polo
S(5) M(5) L(8) @ $24.25 each = $436.50
2XL(2) @ $26.25 each = $52.50
Subtotal: $489.00

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Total Quantity: 48 pieces
Products & Embroidery: $1,228.50
Setup Fees (2 logos @ $100): $200.00

GRAND TOTAL: $1,428.50

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Special Instructions:
[Any notes entered by sales rep]

Contact: [Sales Rep Name]
Email: [sales@nwcustomapparel.com]
Phone: 253-922-5793
```

## Database Structure

### quote_sessions Table
```sql
QuoteID: "EMB1201-1"
SessionID: "emb_quote_builder_[timestamp]"
CustomerEmail: "[customer email]"
CustomerName: "[customer name]"
CompanyName: "[company]"
TotalQuantity: 48
SubtotalAmount: 1228.50
LTMFeeTotal: 0 (or 50 if < 24 pieces)
TotalAmount: 1428.50
Status: "Open"
ExpiresAt: "[30 days from creation]"
Notes: JSON with logo specs and instructions
```

### quote_items Table
Each line item stored separately:
```sql
QuoteID: "EMB1201-1"
LineNumber: 1
StyleNumber: "PC54"
ProductName: "Core Cotton Tee - Black"
Color: "Black"
Quantity: 25 (S-XL sizes)
FinalUnitPrice: 24.25
LineTotal: 606.25
SizeBreakdown: '{"S":10,"M":10,"L":10,"XL":5}'
```

Separate entries for 2XL+:
```sql
LineNumber: 2
StyleNumber: "PC54"
ProductName: "Core Cotton Tee - Black (2XL)"
Quantity: 3
FinalUnitPrice: 26.25
LineTotal: 78.75
```

## Technical Implementation

### Required API Endpoints
1. **Product Search**: `/api/products/search?q={styleNumber}` - Search for products
2. **Product Details**: `/api/product-details?styleNumber={style}` - Get product info
3. **Product Colors**: `/api/product-colors?styleNumber={style}` - Available colors
4. **Color Swatches**: `/api/color-swatches?styleNumber={style}` - Visual swatches
5. **Available Sizes**: `/api/sizes-by-style-color?styleNumber={style}&color={color}` - Size availability
6. **Size Pricing**: `/api/size-pricing?styleNumber={style}` - Base prices and upcharges per size
7. **Embroidery Bundle**: `/api/pricing-bundle?method=EMB&styleNumber={style}` - Complete embroidery pricing data
8. **Quote Save**: `/api/quote_sessions` and `/api/quote_items` - Database persistence

### Key JavaScript Classes

#### EmbroideryQuoteBuilder
Main controller class managing the entire interface

#### LogoManager
Handles logo definition, editing, and calculations

#### ProductLineManager
Manages product additions, size matrices, and line items

#### PricingCalculator
Implements tier logic, LTM distribution, and totals

#### QuoteRenderer
Handles display formatting and print layout

### File Structure
```
/embroidery-quote-builder.html       # Main page
/shared_components/js/
  ├── embroidery-quote-service.js   # API and database operations
  ├── embroidery-quote-pricing.js   # Pricing calculations (uses EmbroideryPricingService)
  ├── embroidery-quote-logos.js     # Logo management
  ├── embroidery-quote-products.js  # Product line management
  └── embroidery-quote-ui.js        # UI components and interactions
/shared_components/css/
  └── embroidery-quote-builder.css  # Styling (NWCA green theme #4cb354)
```

### Implementation Notes
- **Uses EmbroideryPricingService**: Leverages existing `/shared_components/js/embroidery-pricing-service.js` for pricing logic
- **Aggregate Pricing**: Total quantity across ALL products determines the tier
- **Style-Specific Upcharges**: Each style requires API call to `/api/size-pricing`
- **Rounding**: Always UP to nearest $0.50 using `Math.ceil(price * 2) / 2`

## User Permissions & Access

### Location
- Lives on staff-dashboard.html
- Internal tool for sales representatives only
- Not customer-facing

### Features by Role
- **Sales Reps**: Full access to create, edit, save quotes
- **Managers**: Additionally can view all quotes, not just their own
- **Admin**: Can modify pricing tiers and rules

## Quote Management Features

### Quote List View
- Search by customer name, email, or quote number
- Filter by date range
- Sort by creation date, total amount, or status
- Quick actions: View, Edit, Duplicate, Print

### Quote Operations
- **Save**: Stores to database with unique ID
- **Edit**: Load existing quote for modifications
- **Duplicate**: Copy quote as template for similar orders
- **Print**: Generate PDF with company branding
- **Email**: Send to customer with PDF attachment

## Special Considerations

### Visual Elements
- Product thumbnails (40x40px) for line items
- Color swatches for visual confirmation
- Logo position diagram (optional enhancement)

### Validation Rules
- Minimum 1 logo required
- Minimum 1 piece per line item
- Style must exist in system
- Email required for save

### Performance
- Cache product lookups during session
- Debounce API calls on style input
- Lazy load product images

## Future Enhancements

### Phase 2 Possibilities
1. **Template System**: Save common logo setups
2. **Customer Database**: Auto-fill from previous orders
3. **Approval Workflow**: Route to manager for large quotes
4. **Integration**: Connect to production system
5. **Mobile Version**: Responsive design for tablets

### Reporting
- Quote conversion rates
- Average quote values
- Popular product combinations
- Sales rep performance

## Success Metrics

### Efficiency Gains
- Target: 70% reduction in quote creation time
- Current: 5-7 minutes manual → Goal: Under 2 minutes

### Accuracy Improvements
- Eliminate manual calculation errors
- Consistent pricing across all reps
- Visual confirmation reduces wrong products

### Customer Experience
- Professional branded quotes
- Fast turnaround time
- Clear pricing breakdown
- 30-day validity clearly stated

## Troubleshooting Guide

### Common Issues

#### "Style not found"
- Verify style number is correct
- Check if product is active in system
- Try partial search

#### Pricing seems wrong
- Confirm total quantity for tier
- Check if LTM is being applied
- Verify size upcharges

#### Can't save quote
- Ensure customer email is entered
- Check for required fields
- Verify database connection

## Training Notes

### For New Sales Reps
1. Start by defining ALL logos first
2. Logos apply to every garment
3. Use visual confirmation (images/swatches)
4. Extended sizes cost more - separate lines
5. Save frequently during complex quotes
6. Print preview before sending to customer

### Best Practices
- Always verify product images match customer expectations
- Double-check stitch counts with art department
- Note thread colors in special instructions
- Use digitizing checkbox for new logos only
- Save quote before making major changes

---

**Last Updated**: January 2025
**Version**: 1.1
**Author**: Northwest Custom Apparel Development Team
**Status**: Ready for Implementation

## Change Log
- **v1.1 (Jan 2025)**: Updated with correct API-verified pricing tiers and endpoints
  - Fixed embroidery tier pricing (1-23: $12, 24-47: $12, 48-71: $11, 72+: $10)
  - Added style-specific size upcharges via `/api/size-pricing`
  - Updated API endpoints list with all 8 required endpoints
  - Corrected calculation formula to match production logic
  - Added implementation notes about using EmbroideryPricingService