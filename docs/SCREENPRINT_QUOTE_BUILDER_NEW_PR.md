# PR: Screen Print Quote Builder - Excel-Style Layout

## Overview

Convert the existing Screen Print Quote Builder from a 3-phase wizard layout to an Excel-style spreadsheet layout, matching the UI pattern established in the DTG and Embroidery Quote Builders.

**Branch:** `screenprint-excel-quote-builder` (to be created)
**Priority:** Next project after DTG deploy
**Estimated Effort:** 2-3 focused sessions (9-11 hours)

---

## Problem Statement

The current Screen Print Quote Builder uses a 3-phase wizard layout:
1. Print Setup (locations, colors, dark garment) → 2. Add Products → 3. Review & Save

While functional, this differs from the new DTG and Embroidery Quote Builders which use a more efficient Excel-style spreadsheet layout. Creating a consistent UI pattern across ALL quote builders will:
- Reduce training time for sales reps (one UI pattern to learn)
- Allow faster quote creation
- Provide better visibility of all products at once
- Enable easier editing without navigating between phases

---

## Current State Analysis

### Existing Screen Print Quote Builder
| Aspect | Details |
|--------|---------|
| **File** | `/quote-builders/screenprint-quote-builder.html` |
| **Lines** | 4,138 |
| **Layout** | 3-phase wizard |
| **Phase 1** | Print Setup: locations, ink colors (1-6), dark garment toggle |
| **Phase 2** | Add Products: search, color select, size quantities |
| **Phase 3** | Review & Save: summary, customer info, export |

### Screen Print Pricing Services (7,454 lines total)
| File | Lines | Purpose |
|------|-------|---------|
| `screenprint-pricing-v2.js` | 2,514 | Main calculator + calculations |
| `screenprint-manual-pricing.js` | 2,379 | Manual mode variant |
| `screenprint-pricing-service.js` | 656 | API service class |
| `screenprint-quote-pricing.js` | 627 | Quote builder pricing |
| `screenprint-quote-products.js` | 471 | Product management |
| `screenprint-quote-service.js` | 314 | Database operations |
| `screenprint-fast-quote-service.js` | 252 | Simplified submission |
| `screenprint-shopworks-guide-generator.js` | 241 | ShopWorks integration |

---

## Key Difference: Screen Print vs DTG

### The Critical Complexity: Ink Color Count

| Factor | DTG | Screen Print |
|--------|-----|--------------|
| **Primary Pricing** | Location (LC, FF, FB, JF, JB) | Location + **Ink Colors (1-6)** |
| **Setup Fees** | None | $30 per screen (color × location) |
| **Dark Garment** | No impact | +1 screen (white underbase) |
| **Pricing Dimensions** | 2D: Location × Tier | **3D: Location × Colors × Tier** |

### Screen Print Pricing Formula
```
Setup Fee = (colorCount + underbase) × $30 × numberOfLocations
Print Cost = basePrintCost[colorCount][tier] + flashCharge × colorCount
Unit Price = HalfDollarUp(garmentCost / MarginDenominator + printCost)
```

---

## Design Decisions (Confirmed Jan 6, 2026)

| Decision | Choice | Notes |
|----------|--------|-------|
| **Ink color scope** | Per-location | Each location can have different color counts (e.g., 3-color front, 1-color back) |
| **Safety stripes** | Yes, include | Keep +$2/piece/location toggle for Hi-Vis jobs |
| **Location limit** | 4 locations max | 1 primary (Front) + up to 3 additional (Back, Sleeves, Pocket, etc.) |

---

## Proposed Solution

Fork the `dtg-quote-builder-new.html` and adapt it for Screen Print, adding the ink color selection UI that's unique to screen printing.

---

## Features

### From DTG/Embroidery (100% Reusable)
- [x] Product table with S/M/L/XL/2XL columns
- [x] Child rows for extended sizes (3XL, 4XL, youth, tall)
- [x] Custom color picker with swatches
- [x] Style search with autocomplete
- [x] Real-time pricing sidebar
- [x] Quote saving to database
- [x] PDF/Email export

### Screen Print Specific (New/Modified)
- [ ] Print location selector (1 primary + up to 3 additional)
- [ ] **Ink color count selector (1-6) PER LOCATION** - NEW
- [ ] **Dark garment toggle** (adds underbase to ALL locations) - NEW
- [ ] **Safety stripes toggle** (+$2/piece/location) - INCLUDED
- [ ] **Setup fee calculator** ($30/screen) - NEW
- [ ] Screen print pricing integration (uses existing services)
- [ ] Size upcharge display
- [ ] LTM fee for orders < 24 pieces (API-driven)

---

## Technical Specification

### Files to Create

| File | Purpose |
|------|---------|
| `/quote-builders/screenprint-quote-builder-new.html` | Main HTML (fork from DTG) |
| `/shared_components/css/screenprint-quote-builder-new.css` | SP-specific styles (if needed) |
| `/memory/SCREENPRINT_QUOTE_BUILDER.md` | Documentation |

### Files to Reuse (No Changes)

| File | Purpose |
|------|---------|
| `/shared_components/js/screenprint-pricing-service.js` | Core pricing engine |
| `/shared_components/js/screenprint-quote-service.js` | Quote save/load |
| `/shared_components/js/screenprint-quote-pricing.js` | Pricing calculations |
| `/shared_components/js/exact-match-search.js` | Style search |

---

## Print Configuration UI Design

### Location + Ink Color Selection (NEW)

```
┌─────────────────────────────────────────────────────────────────────────┐
│ 🎨 Print Configuration                                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ☑ Dark Garment (adds white underbase to all locations)                │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ FRONT LOCATION                                                   │   │
│  │ ○ Left Chest (4"×4")  ○ Full Front (12"×16")  ○ Jumbo (16"×20") │   │
│  │                                                                   │   │
│  │ INK COLORS:  ① ② ③ ④ ⑤ ⑥                                        │   │
│  │              ●  ○  ○  ○  ○  ○   [1-color selected]               │   │
│  │                                                                   │   │
│  │ Setup: 1 screen × $30 = $30.00                                   │   │
│  │ (Dark garment: +1 underbase = 2 screens × $30 = $60.00)          │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ☑ Add Back Location                                                   │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ BACK LOCATION                                                    │   │
│  │ ○ Full Back (12"×16")  ○ Jumbo Back (16"×20")                   │   │
│  │                                                                   │   │
│  │ INK COLORS:  ① ② ③ ④ ⑤ ⑥                                        │   │
│  │              ○  ●  ○  ○  ○  ○   [2-color selected]               │   │
│  │                                                                   │   │
│  │ Setup: 2 screens × $30 = $60.00                                  │   │
│  │ (Dark garment: +1 underbase = 3 screens × $30 = $90.00)          │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  TOTAL SETUP FEE: $150.00 (5 screens)                                  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Phases

### Phase 1: Fork & Clean (Session 1, ~2 hours)
- [ ] Create branch `screenprint-excel-quote-builder`
- [ ] Copy `dtg-quote-builder-new.html` → `screenprint-quote-builder-new.html`
- [ ] Update header/branding to "Screen Print Quote Builder"
- [ ] Remove DTG-specific code (location-only pricing)
- [ ] Keep: table structure, color picker, child rows, search

### Phase 2: Ink Color UI (Session 1-2, ~3 hours)
- [ ] Create print configuration section with location + color count
- [ ] Implement ink color selector (1-6 radio buttons per location)
- [ ] Add dark garment toggle with underbase calculation
- [ ] Create setup fee calculator display
- [ ] Wire up real-time setup fee updates

### Phase 3: Pricing Integration (Session 2, ~2-3 hours)
- [ ] Connect to `screenprint-pricing-service.js`
- [ ] Implement tier display (24-36, 37-72, 73-144, 145+)
- [ ] Add LTM warning for <24 pieces
- [ ] Per-piece pricing by location + color count
- [ ] Size upcharge handling (2XL+)
- [ ] Real-time total calculation including setup fees

### Phase 4: Invoice & Save (Session 2-3, ~2 hours)
- [ ] Adapt invoice generation for screen print format
- [ ] Quote ID generation (SPC[MMDD]-seq)
- [ ] Customer info form
- [ ] ShopWorks EDP export
- [ ] Email/PDF export

### Phase 5: Testing & Polish (Session 3, ~2 hours)
- [ ] Verify pricing matches existing screen print calculator
- [ ] Test all ink color combinations (1-6 per location)
- [ ] Test dark garment underbase calculations
- [ ] Test extended sizes (child rows)
- [ ] Test edge cases (OSFA, youth sizes)
- [ ] Cross-browser testing
- [ ] Update staff dashboard link

---

## Success Criteria

- [ ] Products can be added with style/color/sizes in Excel-style table
- [ ] Print locations selectable with ink color count (1-6) per location
- [ ] Dark garment toggle adds underbase screen cost
- [ ] Setup fees calculated correctly ($30 × screens)
- [ ] Pricing matches existing screen print calculator exactly
- [ ] LTM fee applied correctly for <24 pieces
- [ ] Size upcharges working (2XL+)
- [ ] Child rows work for extended sizes
- [ ] Quote saves to database with SPC prefix
- [ ] PDF/Email export functional
- [ ] ShopWorks EDP export working

---

## Testing Checklist

### Setup Fee Verification
- [ ] 1-color front, light garment = 1 screen × $30 = $30
- [ ] 3-color front, light garment = 3 screens × $30 = $90
- [ ] 3-color front, dark garment = 4 screens × $30 = $120 (incl. underbase)
- [ ] 2-color front + 2-color back, dark garment = (3+3) × $30 = $180

### Pricing Verification
- [ ] PC54 Black, 48 qty, 1-color LC = matches SP calculator
- [ ] PC54 Black, 48 qty, 3-color FF = matches SP calculator
- [ ] PC54 Black, 48 qty, 2-color LC + 2-color FB = matches SP calculator
- [ ] 2XL size = +$2 upcharge
- [ ] 3XL size = +$3 upcharge

---

## Comparison: What Changes from DTG

| Component | DTG | Screen Print | Change Needed |
|-----------|-----|--------------|---------------|
| Header | "DTG Quote Builder" | "Screen Print Quote Builder" | Text only |
| Location UI | Radio buttons | Radio buttons + color count | Add color selector |
| Pricing factor | Location only | Location + colors | Add color dimension |
| Setup fees | None | $30/screen | Add calculation |
| Dark garment | N/A | +1 underbase screen | Add toggle |
| Pricing service | DTGPricingService | ScreenPrintPricingService | Swap service |
| Quote prefix | DTG | SPC | Update constant |

---

## Related Documentation

- `/docs/DTG_QUOTE_BUILDER_NEW_PR.md` - DTG builder PR (similar pattern)
- `/memory/QUOTE_BUILDER_GUIDE.md` - General quote builder patterns

---

**Created:** 2026-01-06
**Author:** Erik Mickelson + Claude Code
**Status:** Approved - Ready for Implementation
