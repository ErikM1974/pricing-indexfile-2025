# Flagship Quote System - Development Plan

## Executive Summary

This document outlines the development of a **flagship quote system** that will serve as the foundation for all pricing pages across the platform. Starting with cap embroidery, this system will be designed for reusability and adaptability across different embellishment types (embroidery, DTG, DTF, screen print).

### Vision
Create a modular, extensible quote system that:
- Handles cumulative quantity pricing
- Adapts to different embellishment rules
- Provides consistent user experience
- Enables rapid deployment to new pricing pages

## Business Requirements

### Core Concept
- All caps in a quote contribute to the total quantity for pricing tier calculation
- Users see immediate savings when combining items
- Simple, clear pricing display that doesn't overwhelm users
- 30-day quote persistence with API storage

### Pricing Rules
1. **Quantity Tiers:**
   - 1-23: Base price + $50 LTM fee
   - 24-47: Tier 1 pricing (no LTM)
   - 48-71: Tier 2 pricing
   - 72+: Tier 3 pricing

2. **Bundle Benefits:**
   - Show price if ordered alone
   - Show price when combined with existing quote
   - Display savings amount

## Phase 1: Basic Implementation (2-3 hours)

### Goals
- Implement cumulative quantity tracking
- Show comparative pricing (alone vs. bundled)
- Basic quote persistence with API
- Single page implementation (cap-embroidery-pricing.html)

### Features

#### 1.1 Quote Session Management
```javascript
// On page load
- Check for existing active quote via API
- Display quote summary if exists
- Initialize pricing with cumulative quantities
```

#### 1.2 Pricing Display
```
Quick Quote Calculator:
- Current selection: X caps @ $Y each
- If quote exists: "Bundle with existing Z caps for better pricing!"
- Show savings amount
```

#### 1.3 Add to Quote Flow
```
1. Calculate standalone pricing
2. Calculate bundle pricing (if quote exists)
3. Show comparison
4. Add item with current pricing tier
5. Save to API
```

### Technical Implementation

#### Data Structure (Phase 1)
```javascript
{
  sessionId: "sess_xxx",
  quoteId: "Q_xxx",
  status: "draft",
  totalQuantity: 30,
  metadata: {
    source: "web",
    createdFrom: "cap-embroidery"
  },
  items: [
    {
      style: "C112",
      color: "Black",
      quantity: 20,
      unitPrice: 15.00,  // Price at time of adding
      sizes: { "OSFA": 20 },  // Dynamic from pricing table
      imageURL: "...",  // Captured at add time
      stitchCount: "8000",  // Current selection
      hasBackLogo: false,
      capturedPrice: {  // Store what user saw
        perCap: 15.00,
        total: 300.00,
        ltmFee: 0
      }
    }
  ]
}
```

#### Implementation Decisions
1. **Size Capture**: Read from `window.availableSizesFromTable` (set by pricing-matrix-capture.js)
2. **Price Capture**: Read from Quick Quote DOM to match displayed values
3. **Image Capture**: Capture at "Add to Quote" with 200ms delay and color validation
4. **Quote Persistence**: Save to API immediately, check on page load

#### API Endpoints Used
- `POST /api/quote_sessions` - Create quote
- `GET /api/quote_sessions?sessionID={id}` - Get active quote
- `POST /api/quote_items` - Add items
- `PUT /api/quote_sessions/{id}` - Update totals

### User Interface Changes

#### Quick Quote Section
```
Before (No Quote):
┌─────────────────────────────┐
│ 10 caps @ $18.00 each       │
│ Total: $180.00              │
│ (Includes $50 LTM fee)      │
│ [Add to Quote]              │
└─────────────────────────────┘

After (With Quote):
┌─────────────────────────────┐
│ 10 caps                     │
│ Alone: $18.00 each          │
│ With Quote (30 total):      │
│ $15.00 each - Save $30!     │
│ [Add to Quote Bundle]       │
└─────────────────────────────┘
```

### Implementation Flow (Phase 1)

```javascript
// 1. Page Load
async function initializeQuote() {
  const activeQuote = await checkForActiveQuote();
  if (activeQuote) {
    displayQuoteSummary(activeQuote);
    updatePricingDisplay(activeQuote.totalQuantity);
  }
}

// 2. Add to Quote Click
async function handleAddToQuote() {
  // Capture current state
  const quickQuoteData = captureQuickQuoteValues();
  const sizes = window.availableSizesFromTable;
  const imageUrl = await captureProductImage();
  
  // Show comparison if quote exists
  if (activeQuote) {
    showBundleSavings(quickQuoteData, activeQuote);
  }
  
  // Add to quote
  await addItemToQuote(itemData);
}

// 3. Price Comparison Display
function showBundleSavings(currentItem, existingQuote) {
  const alonePrice = currentItem.perCap;
  const bundleTotal = existingQuote.totalQuantity + currentItem.quantity;
  const bundlePrice = calculateTierPrice(bundleTotal);
  const savings = (alonePrice - bundlePrice) * currentItem.quantity;
  
  displayComparison(alonePrice, bundlePrice, savings);
}
```

### Limitations (Phase 1)
- No stitch count validation
- No cross-page persistence (each page visit checks API)
- No floating quote widget
- No automatic price recalculation of existing items
- Single embellishment type (cap embroidery only)

## Phase 2: Advanced Features (4-6 hours)

### Goals
- Stitch count requirement validation
- Cross-page quote persistence
- Floating quote widget
- Real-time price recalculation
- Enhanced user experience

### Features

#### 2.1 Quote Requirements
```javascript
requirements: {
  frontStitchCount: "8000",
  hasBackLogo: true,
  backLogoStitchCount: "5000"
}
```

#### 2.2 Validation System
- First item sets requirements
- Subsequent items must match
- Clear mismatch warnings
- Option to start new quote

#### 2.3 Price Recalculation
When adding items:
1. Calculate new total quantity
2. Determine new pricing tier
3. Update all existing items with new tier pricing
4. Show before/after comparison

#### 2.4 Floating Quote Widget
```
┌────────────────────┐
│ 📦 Quote: 30 caps  │
│ View | Clear       │
└────────────────────┘
```

### Enhanced Data Structure (Phase 2)
```javascript
{
  sessionId: "sess_xxx",
  quoteId: "Q_xxx",
  requirements: {
    frontStitchCount: "8000",
    hasBackLogo: true,
    backLogoStitchCount: "5000"
  },
  totalQuantity: 30,
  originalPricing: { /* snapshot */ },
  currentPricing: { /* after recalc */ },
  items: [
    {
      // All Phase 1 fields plus:
      originalUnitPrice: 18.00,
      currentUnitPrice: 15.00,
      frontStitchCount: "8000",
      hasBackLogo: true,
      backLogoDetails: { /* ... */ }
    }
  ]
}
```

## Implementation Timeline

### Week 1
- [ ] Phase 1 development
- [ ] Basic testing
- [ ] API integration verification

### Week 2
- [ ] User testing and feedback
- [ ] Bug fixes and refinements
- [ ] Phase 2 planning refinement

### Week 3-4
- [ ] Phase 2 development
- [ ] Cross-page testing
- [ ] Performance optimization

## Success Metrics

### Phase 1
- Users can add items to cumulative quote
- Correct pricing tiers applied
- Quote persists via API
- Clear savings display

### Phase 2
- Stitch count validation working
- Cross-page persistence functional
- All items repriced correctly
- Enhanced user experience

## Risk Mitigation

### Technical Risks
1. **API Performance** - Cache quote data locally
2. **Complex Calculations** - Extensive testing of edge cases
3. **Browser Compatibility** - Test across browsers

### User Experience Risks
1. **Confusion** - Clear messaging and UI
2. **Lost Quotes** - Robust error handling
3. **Price Shock** - Show savings prominently

## Testing Plan

### Phase 1 Tests
1. Empty quote → Add first item
2. Existing quote → Add compatible item
3. Navigate away and return
4. Various quantity combinations
5. API failure scenarios

### Phase 2 Tests
1. Stitch count mismatch scenarios
2. Cross-page navigation
3. Price recalculation accuracy
4. Widget functionality
5. Performance with large quotes

## Rollback Plan

If issues arise:
1. Feature flag to disable cumulative pricing
2. Revert to individual item pricing
3. Preserve quote data for recovery

## Flagship System Architecture

### Base Quote System (Shared Core)
```javascript
class BaseQuoteSystem {
  // Core functionality for ALL embellishment types
  - Quote session management
  - API integration
  - Cumulative quantity tracking
  - Price tier calculation
  - UI components
  - Save/load functionality
}
```

### Embellishment-Specific Adapters
```javascript
class CapEmbroideryQuoteAdapter extends BaseQuoteSystem {
  // Cap-specific rules
  - Stitch count validation
  - Back logo handling
  - Cap-specific pricing
}

class DTGQuoteAdapter extends BaseQuoteSystem {
  // DTG-specific rules
  - Print size tiers
  - Color/location validation
  - DTG pricing logic
}

class ScreenPrintQuoteAdapter extends BaseQuoteSystem {
  // Screen print rules
  - Color count restrictions
  - Setup fee distribution
  - Location limitations
}
```

### Adapter Pattern Benefits
1. **Reusability** - Core logic shared across all types
2. **Flexibility** - Each type can override specific behaviors
3. **Maintainability** - Fix once, deploy everywhere
4. **Scalability** - Easy to add new embellishment types

### Implementation Strategy

#### Phase 1.5: Flagship Foundation
After basic cap embroidery works:
1. Extract core functionality to BaseQuoteSystem
2. Create CapEmbroideryQuoteAdapter
3. Test adapter pattern
4. Document adapter API

#### Future Rollout Plan
1. **Embroidery** (non-cap): Minor tweaks to cap adapter
2. **DTG**: New adapter with print size logic
3. **DTF**: Similar to DTG with material differences  
4. **Screen Print**: Complex adapter with color/setup rules

### Configuration-Driven Design
```javascript
const EMBELLISHMENT_CONFIGS = {
  'cap-embroidery': {
    requiresMatching: ['stitchCount', 'backLogo'],
    allowedLocations: ['front', 'back'],
    pricingFactors: ['stitchCount', 'logoCount'],
    sizeOptions: 'dynamic' // from pricing table
  },
  'dtg': {
    requiresMatching: ['printSize'],
    allowedLocations: ['front', 'back', 'sleeve'],
    pricingFactors: ['printSize', 'locationCount'],
    sizeOptions: 'standard' // S,M,L,XL,2XL
  }
};
```

### Shared UI Components
1. **Quote Calculator Widget** - Adapts to embellishment type
2. **Bundle Pricing Display** - Consistent across pages
3. **Quote Summary Panel** - Reusable component
4. **Size Entry Grid** - Configurable for different products

## Phase 1 Implementation Approach

### File Structure
```
shared_components/js/
├── base-quote-system.js          // Core quote functionality (NEW)
├── cap-embroidery-cumulative.js  // Cap-specific adapter (NEW) 
└── quote-api-client.js           // Existing API client

shared_components/css/
└── cumulative-quote.css          // Styling for bundle display (NEW)
```

### Key Functions to Implement
1. **checkForActiveQuote()** - Load existing quote on page load
2. **captureQuickQuoteValues()** - Read DOM values from quick quote
3. **captureProductImage()** - Smart image capture with validation
4. **showBundleSavings()** - Display price comparison
5. **calculateTierPrice()** - Determine price based on total quantity
6. **addItemToQuote()** - Add item and save to API

### Integration Points
- Hook into existing "Add to Quote" button
- Extend current quote adapter (don't replace)
- Use existing API client methods
- Leverage pricing-matrix-capture.js data

## Questions for Stakeholders

1. Maximum items per quote?
2. Quote expiration handling?
3. Email notification preferences?
4. Reporting requirements?
5. Priority order for embellishment rollout?

---

**Document Version:** 3.0  
**Created:** June 4, 2025  
**Updated:** June 5, 2025 - Added Phase 1 implementation details  
**Author:** Development Team  
**Status:** Ready for Phase 1 Implementation as Flagship System