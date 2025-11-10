# Product Page Redesign Plan - Sanmar Style
**Date:** January 2025  
**Objective:** Create a Sanmar-like visual experience while prioritizing NWCA's embellishment services

## Executive Summary
Redesign the product page to feel familiar to users accustomed to Sanmar's layout while strategically positioning embellishment options for better visibility and business value.

## Core Problems to Solve
1. **Image Priority:** Currently showing flat products first instead of model shots
2. **Embellishment Visibility:** Decoration options are buried at the bottom of the page
3. **Color Display:** Swatches may be too small with names hidden
4. **Visual Consistency:** Page doesn't feel as polished as Sanmar's

## Implementation Strategy

### Phase 1: Image Gallery Restructuring
**File:** `/product/components/gallery.js`
- **Change:** Reorder image extraction to prioritize model shots
- **New Order:**
  1. Front Model (person wearing product)
  2. Back Model
  3. Side Model  
  4. Front Flat
  5. Back Flat
  6. Additional/lifestyle images
- **Impact:** Immediate visual match to Sanmar's approach

### Phase 2: Embellishment Repositioning
**File:** `/product.html`
- **Current Location:** Bottom of page (after everything else)
- **New Location:** Right after size information, BEFORE color swatches
- **Rationale:** Core business differentiator should be prominent
- **User Flow:** Product → Size → How to Decorate → Color Selection

### Phase 3: Color Swatch Enhancement
**File:** `/product/components/swatches.js`
- **Changes:**
  - Increase swatch size from current to 50x50px
  - Display color names permanently below swatches
  - Show 8-10 swatches per row (like Sanmar)
  - Improve selected state visibility
- **Impact:** Easier color selection, matches Sanmar's clarity

### Phase 4: Visual Polish
**File:** `/product/styles/product-redesign.css`
- **Typography:**
  - Larger product title (24-28px)
  - Clearer hierarchy with consistent spacing
- **Layout:**
  - Add horizontal dividers between sections
  - Increase padding between elements
  - Add subtle shadows to images
- **Buttons:**
  - Rounder corners
  - Better hover states
  - Consistent sizing

## Proposed Page Structure

```
[Header/Navigation]
│
├── [Breadcrumb]
│
├── [Main Product Section]
│   ├── [Left: Thumbnail Strip (vertical)]
│   ├── [Center: Main Product Image]
│   └── [Right: Product Information]
│       ├── Style Number (PC61)
│       ├── Product Title (Large, Serif)
│       ├── Brand Logo
│       ├── Size Range (Adult Sizes: S-6XL)
│       ├── ★ EMBELLISHMENT OPTIONS (MOVED UP) ★
│       ├── Color Swatches (Enhanced)
│       └── Product Description
│
└── [Footer]
```

## What We're NOT Adding
- ❌ Video players (no API support)
- ❌ Complex download features
- ❌ New database connections
- ❌ Logo tool (using existing decoration selector)
- ❌ External spec sheet links (unless already available)

## Files to Modify
1. `/product/components/gallery.js` - Image reordering logic
2. `/product.html` - Structure and embellishment placement
3. `/product/components/swatches.js` - Color swatch improvements
4. `/product/styles/product-redesign.css` - Visual styling
5. `/product/components/decoration-selector.js` - Minor style updates

## Success Criteria
- [ ] Model images appear first in gallery
- [ ] Embellishment options visible without scrolling
- [ ] Color swatches show names and are easily clickable
- [ ] Overall page feels as professional as Sanmar
- [ ] Staff comfortable using our page instead of Sanmar's

## Testing Checklist
- [ ] Image gallery shows correct order
- [ ] Embellishment selector works in new position
- [ ] Color selection updates product image
- [ ] Page responsive on mobile
- [ ] All existing functionality preserved
- [ ] Visual consistency across browsers

## Rollback Plan
All changes are contained to specific files. If issues arise:
1. Revert modified files from git
2. Clear browser cache
3. Restart development server

## Notes
- Keep all existing functionality intact
- Focus on visual similarity, not feature parity
- Prioritize NWCA's business needs (embellishment) over exact Sanmar copying
- Implementation should take 2-3 hours

---
*This plan serves as the blueprint for making NWCA's product page feel familiar to Sanmar users while better showcasing our embellishment services.*