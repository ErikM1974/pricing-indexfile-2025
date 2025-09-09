# Embroidery Quote Builder - Additional Logos & Monogramming Enhancement Plan

## Executive Summary
This document outlines the implementation plan for adding additional logo support, selective logo application, and monogramming functionality to the existing embroidery quote builder. The enhancement allows sales representatives to create more complex quotes with multiple logos, where not all products receive all logos, and includes personalized monogramming options.

## Current State Analysis

### Existing Functionality
- **Single Logo Application**: All defined logos apply to ALL products uniformly
- **Unified Pricing**: All logos are included in the base garment price
- **Tier-Based Pricing**: Quantity discounts based on total pieces ordered
- **Database Storage**: Two-table structure (quote_sessions + quote_items)

### Limitations
- Cannot specify different logos for different products
- No support for additional logo charges
- No monogramming/personalization options
- No ShopWorks part number generation for additional services

## Business Requirements

### Core Requirements
1. **Primary Logo**: First logo defined, mandatory on all products, included in base price
2. **Additional Logos**: Optional logos with separate pricing
3. **Monogramming**: Personal names at $12.50 flat rate per name
4. **Selective Application**: Choose which products get which additional logos
5. **ShopWorks Integration**: Generate appropriate part numbers (AL, AL-9000, Monogram)

### Pricing Rules

#### Primary Logo (Unchanged)
- Included in base garment price
- Uses standard calculation: `(garmentPrice + embroideryPrice) / 0.6`
- Additional stitches over 8,000: $1.25 per 1,000 stitches

#### Additional Logos
- Base calculation: Use tier embroidery cost directly (NO margin division)
- Additional stitches over 8,000: $1.25 per 1,000 stitches
- **Subset Upcharge**: If quantity < total order, add $3.00 per piece
- Part numbers:
  - "AL" for exactly 8,000 stitches
  - "AL-9000" for 9,000 stitches
  - "AL-10000" for 10,000 stitches, etc.

**Example Calculation:**
```
Order: 48 pieces total (48-71 tier = $11.00)
Additional Logo: 9,000 stitches on 6 pieces only
- Base embroidery cost: $11.00 (tier cost, no division)
- Extra stitches: $1.25 (1,000 extra stitches)
- Subset upcharge: $3.00 (because 6 < 48)
- Final price: $15.25 per piece
```

#### Monogramming
- Flat rate: $12.50 per name
- Part number: "Monogram"
- No stitch count variations

## User Interface Design

### Phase 1: Logo Definition (Enhanced)

#### Visual Hierarchy
```
┌─────────────────────────────────────────────┐
│ Logo 1 [PRIMARY LOGO badge]                 │
│ Position: Left Chest                        │
│ Stitches: 9,000                            │
│ ☐ Needs digitizing ($100)                  │
│ [Edit] [Cannot Delete - Primary]           │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ Logo 2 [ADDITIONAL LOGO badge]              │
│ Position: Right Chest                       │
│ Stitches: 6,000                            │
│ ☐ Needs digitizing ($100)                  │
│ [Edit] [Delete]                            │
└─────────────────────────────────────────────┘

[+ Add Another Logo]
```

### Phase 2: Product Addition (With Logo Selection)

#### Product Card with Logo Options
```
┌─────────────────────────────────────────────┐
│ [Image] J790 - Black/Chrome                 │
│         Port Authority Glacier Jacket       │
│                                             │
│ Size Matrix:                                │
│ ┌─────────────────────────────────────┐    │
│ │ S [5] M [5] L [8] XL [0] 2XL [0]    │    │
│ └─────────────────────────────────────┘    │
│ Total: 18 pieces                           │
│                                             │
│ ─────────────────────────────────────      │
│ Logo Selection:                             │
│                                             │
│ ☑ Left Chest 9,000 - Primary               │
│   [18] pieces (locked - all products)      │
│                                             │
│ ☐ Right Chest 6,000 - Additional           │
│   [  ] of 18 pieces                        │
│                                             │
│ ☐ Monogram                                 │
│   ○ Quick (qty only) [  ] pieces           │
│   ○ Detailed (with names)                  │
│                                             │
│ [Add to Quote]                              │
└─────────────────────────────────────────────┘
```

### Phase 3: Quote Summary (With Additional Services)

#### Summary Layout
```
EMBROIDERY QUOTE SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📍 Embroidery Specifications
1. Left Chest - 9,000 stitches (PRIMARY)
2. Right Chest - 6,000 stitches (ADDITIONAL)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

👕 Products

J790 - Black/Chrome
Port Authority Glacier Soft Shell Jacket
18 pieces total
───────────────────────────────────
S(5) M(5) L(8) @ $67.00 each = $1,206.00

CP91 - Black/Natural  
Port & Co Beanie Cap
24 pieces total
───────────────────────────────────
OSFA(24) @ $14.00 each = $336.00

Products Subtotal: $1,542.00

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

➕ Additional Services

AL Right Chest (6 pieces on J790)
@ $14.00 each = $84.00
*$11 tier + $3 subset upcharge

Monogram (12 pieces)
@ $12.50 each = $150.00

Additional Services Subtotal: $234.00

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💰 Quote Totals
Products & Primary Embroidery: $1,542.00
Additional Services: $234.00
Setup Fees (2 logos): $200.00
─────────────────────────────────────
GRAND TOTAL: $1,976.00
```

## Monogram Implementation

### Entry Modes

#### Quick Mode (Quantity Only)
```
┌─────────────────────────────────────────────┐
│ Monogram Quick Entry                        │
│                                             │
│ How many monograms? [12]                   │
│                                             │
│ Note: Names to be provided separately       │
│                                             │
│ [Confirm]                                   │
└─────────────────────────────────────────────┘
```

#### Detailed Mode (With Names)
```
┌─────────────────────────────────────────────┐
│ Monogram Detailed Entry - J790 Black (18)   │
│                                             │
│ Default Settings:                           │
│ Location: [Right Chest ▼]                  │
│ Font: [Script ▼]                           │
│ Thread: [White ▼]                          │
│                                             │
│ Size Breakdown: S(5) M(5) L(8)             │
│                                             │
│ Enter names (one per line):                │
│ ┌─────────────────────────────────────┐    │
│ │ John Smith - S                      │    │
│ │ Mary Johnson - S                    │    │
│ │ Bob Wilson - S - Gold thread        │    │
│ │ Susan Davis - S                     │    │
│ │ Mike Thompson - S                   │    │
│ │ Sarah Miller - M                    │    │
│ │ ...                                 │    │
│ └─────────────────────────────────────┘    │
│                                             │
│ ☑ Generate monogram sheet                  │
│                                             │
│ [Save Monograms]                           │
└─────────────────────────────────────────────┘
```

### Monogram Sheet Output
```
MONOGRAM SHEET - Order EMB1201-1
Date: January 31, 2025
Customer: ABC Company

Style: J790 - Black/Chrome
─────────────────────────────────────────────
Name            Size    Location      Font    Thread
John Smith      S       Right Chest   Script  White
Mary Johnson    S       Right Chest   Script  White
Bob Wilson      S       Right Chest   Script  Gold
Susan Davis     S       Right Chest   Script  White
...

Total Monograms: 12
```

## Technical Implementation

### Data Structures

#### Enhanced Logo Object
```javascript
{
  id: 1,
  position: "Left Chest",
  stitchCount: 9000,
  needsDigitizing: false,
  isPrimary: true,           // NEW: First logo is always primary
  shopWorksCode: null,        // NEW: Auto-generated for additional
  appliedToProducts: []       // NEW: Track which products use this
}
```

#### Product with Logo Assignments
```javascript
{
  style: "J790",
  color: "Black/Chrome",
  title: "Port Authority Glacier Jacket",
  totalQuantity: 18,
  sizeBreakdown: { S: 5, M: 5, L: 8 },
  
  // NEW: Logo assignments
  logoAssignments: {
    primary: {
      logoId: 1,
      quantity: 18  // Always equals totalQuantity
    },
    additional: [
      {
        logoId: 2,
        quantity: 6,  // Subset of total
        hasSubsetUpcharge: true
      }
    ],
    monogram: {
      quantity: 12,
      mode: "detailed",
      names: [...],  // If detailed mode
      settings: {
        location: "Right Chest",
        font: "Script",
        thread: "White"
      }
    }
  }
}
```

### Pricing Calculations

#### Additional Logo Pricing Function
```javascript
function calculateAdditionalLogoPrice(logo, quantity, totalOrderQty) {
  // Get tier based on total order quantity
  const tier = getTierForQuantity(totalOrderQty);
  const tierEmbCost = tier.embCost; // e.g., $11 for 48-71
  
  // Check if subset pricing applies
  const isSubset = quantity < totalOrderQty;
  const subsetUpcharge = isSubset ? 3.00 : 0;
  
  // Calculate additional stitch cost
  const extraStitches = Math.max(0, logo.stitchCount - 8000);
  const stitchCost = (extraStitches / 1000) * 1.25;
  
  // Final calculation (NO margin division - use tier cost directly)
  const finalPrice = roundUp(tierEmbCost + stitchCost + subsetUpcharge);
  
  // Generate part number
  const partNumber = logo.stitchCount === 8000 ? "AL" : `AL-${logo.stitchCount}`;
  
  return {
    unitPrice: finalPrice,
    total: finalPrice * quantity,
    partNumber: partNumber,
    hasSubsetUpcharge: isSubset
  };
}
```

### Database Schema Updates

#### Additional Logo Line Items
```sql
-- quote_items table entry for additional logo
{
  QuoteID: "EMB1201-1",
  LineNumber: 3,
  StyleNumber: "AL-6000",  -- ShopWorks part number
  ProductName: "Additional Logo - Right Chest",
  Color: "",
  ColorCode: "",
  EmbellishmentType: "embroidery-additional",
  PrintLocation: "Right Chest",
  PrintLocationName: "Right Chest",
  Quantity: 6,
  HasLTM: "No",
  BaseUnitPrice: 11.00,  -- Tier embroidery cost
  LTMPerUnit: 0,
  FinalUnitPrice: 14.00,  -- With margin and upcharge
  LineTotal: 84.00,
  SizeBreakdown: '{}',
  PricingTier: "48-71",
  ImageURL: "",
  Metadata: JSON.stringify({
    logoId: 2,
    stitchCount: 6000,
    appliedToProducts: ["J790"],
    hasSubsetUpcharge: true,
    upchargeAmount: 3.00
  })
}
```

#### Monogram Line Items
```sql
-- quote_items table entry for monograms
{
  QuoteID: "EMB1201-1",
  LineNumber: 4,
  StyleNumber: "Monogram",  -- ShopWorks part number
  ProductName: "Monogram",
  Quantity: 12,
  FinalUnitPrice: 12.50,
  LineTotal: 150.00,
  Metadata: JSON.stringify({
    appliedToProducts: ["J790"],
    location: "Right Chest",
    font: "Script",
    thread: "White",
    names: ["John Smith", "Mary Johnson", ...],  -- If detailed mode
    mode: "detailed"  -- or "quick"
  })
}
```

## Implementation Phases

### Phase 1: Core Infrastructure (Week 1)
1. Update logo data structure with isPrimary flag
2. Modify LogoManager to handle primary/additional distinction
3. Update database schema for new metadata fields
4. Create utility functions for part number generation

### Phase 2: UI Enhancement (Week 1-2)
1. Add logo selection checkboxes to product cards
2. Implement quantity inputs for partial logo application
3. Create monogram entry interfaces (quick and detailed modes)
4. Update summary display with Additional Services section

### Phase 3: Pricing Logic (Week 2)
1. Implement additional logo pricing calculations
2. Add subset upcharge logic ($3 for partial quantities)
3. Integrate monogram flat rate pricing
4. Update total calculations to include additional services

### Phase 4: Integration & Testing (Week 2-3)
1. Update quote save functionality for new item types
2. Test ShopWorks part number generation
3. Implement monogram sheet generation
4. End-to-end testing of all scenarios

## Testing Scenarios

### Scenario 1: Basic Additional Logo
- Order: 48 jackets
- Primary logo: Left Chest 9,000 stitches (all 48)
- Additional logo: Right Chest 6,000 stitches (all 48)
- Expected: No subset upcharge, uses 48-71 tier pricing

### Scenario 2: Subset Additional Logo
- Order: 48 jackets
- Primary logo: Left Chest 9,000 stitches (all 48)
- Additional logo: Right Chest 6,000 stitches (only 6)
- Expected: $3 subset upcharge per piece on additional logo

### Scenario 3: Mixed Products with Monograms
- Product 1: 18 jackets with primary + additional logo
- Product 2: 24 beanies with primary only
- Monograms: 12 on jackets
- Expected: Correct tier pricing (42 total), monograms at flat rate

### Scenario 4: Complex Stitch Counts
- Additional logo with 10,000 stitches
- Expected: Part number "AL-10000", additional stitch charges apply

## Benefits & Impact

### Sales Team Benefits
- **Flexibility**: Create quotes matching exact customer requirements
- **Speed**: Quick quote generation for complex orders
- **Accuracy**: Automated calculations reduce errors
- **Clarity**: Professional quotes with clear breakdowns

### Production Benefits
- **Clear Instructions**: ShopWorks part numbers identify exact requirements
- **Monogram Tracking**: Detailed sheets for personalization
- **Efficiency**: Standardized AL codes for additional logos

### Customer Benefits
- **Transparency**: See exactly what each product includes
- **Options**: Choose which products get additional logos
- **Personalization**: Add individual names with monogramming
- **Value**: Benefit from tier pricing on full order quantity

## Risk Mitigation

### Potential Issues & Solutions

1. **Complexity Overwhelm**
   - Solution: Default to current behavior (all logos on all products)
   - Provide "Apply to All" quick actions

2. **Pricing Confusion**
   - Solution: Clear visual separation of included vs additional
   - Detailed breakdown in summary

3. **Data Migration**
   - Solution: Backward compatible - old quotes still work
   - New fields are optional additions

4. **Training Requirements**
   - Solution: Intuitive UI with tooltips
   - Create training video for sales team

## Success Metrics

### Quantitative Metrics
- Quote creation time: Target 50% reduction for complex quotes
- Error rate: Less than 2% pricing errors
- Adoption rate: 80% of sales team using within 2 weeks

### Qualitative Metrics
- Sales team satisfaction survey
- Customer feedback on quote clarity
- Production team efficiency improvements

## Appendix: API Endpoints Used

### Existing Endpoints (No Changes Needed)
- `/api/pricing-bundle?method=EMB&styleNumber={style}` - Embroidery pricing data
- `/api/size-pricing?styleNumber={style}` - Size-based pricing
- `/api/product-details?styleNumber={style}` - Product information
- `/api/quote_sessions` - Quote persistence
- `/api/quote_items` - Line item persistence

### Data Retrieved from API
- Embroidery tier costs (1-23: $12, 24-47: $12, 48-71: $11, 72+: $10)
- Additional stitch rate: $1.25 per 1,000 stitches
- Base stitch count: 8,000
- Margin denominator: 0.6
- Digitizing fee: $100 per logo

## Conclusion

This enhancement transforms the embroidery quote builder from a simple uniform-application tool to a sophisticated system capable of handling complex, real-world embroidery orders. By maintaining backward compatibility while adding powerful new features, we ensure a smooth transition and immediate value for the sales team.

The implementation is designed to be completed in 2-3 weeks, with clear phases that allow for incremental testing and feedback. The result will be a best-in-class quoting tool that saves time, reduces errors, and provides professional quotes that clearly communicate all details to customers and production staff.

---

**Document Version**: 1.0  
**Date**: January 2025  
**Author**: Northwest Custom Apparel Development Team  
**Status**: Ready for Implementation Review