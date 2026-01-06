# PR: DTG Quote Builder - Excel-Style Layout

## Overview

Create a new DTG Quote Builder with an Excel-style spreadsheet layout, matching the UI pattern established in the Embroidery/Cap Quote Builder 2026.

**Branch:** `dtg-excel-quote-builder` (to be created)
**Priority:** Next project after embroidery deploy
**Estimated Effort:** 2-3 focused sessions

---

## Problem Statement

The current DTG Quote Builder uses a 3-phase wizard layout:
1. Location Setup → 2. Product Addition → 3. Review & Save

While functional, this differs from the new Embroidery Quote Builder which uses a more efficient Excel-style spreadsheet layout that sales reps prefer. Creating a consistent UI pattern across quote builders will:
- Reduce training time for sales reps
- Allow faster quote creation
- Provide better visibility of all products at once
- Enable easier editing without navigating between phases

---

## Proposed Solution

Fork the `embroidery-quote-builder-new.html` and adapt it for DTG printing, replacing embroidery-specific features (stitch counts, digitizing) with DTG-specific features (print locations, print costs).

### Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Print location selection | Global (top of page) | Matches embroidery logo config pattern |
| Combo locations | Yes (LC_FB, FF_FB, etc.) | Required for front+back orders |
| Separate from embroidery | Yes | Prevents confusion between embellishment types |

---

## Features

### From Embroidery (100% Reusable)
- [x] Product table with S/M/L/XL/2XL columns
- [x] Child rows for extended sizes (3XL, 4XL, youth, tall)
- [x] Custom color picker with swatches
- [x] Style search with autocomplete
- [x] Real-time pricing sidebar
- [x] Quote saving to database
- [x] PDF/Email export

### DTG-Specific (New/Modified)
- [ ] Print location toggle selector (LC, FF, FB, JF, JB)
- [ ] Front+Back combo support (LC_FB, FF_FB, JF_JB)
- [ ] DTG pricing integration (print costs, not stitch counts)
- [ ] Size upcharge display ($2 for 2XL, $3 for 3XL, etc.)
- [ ] LTM fee for orders < 24 pieces
- [ ] Cap product blocking (DTG can't print caps)

---

## Technical Specification

### Files to Create

| File | Purpose |
|------|---------|
| `/quote-builders/dtg-quote-builder-new.html` | Main HTML (fork from embroidery) |
| `/shared_components/js/dtg-quote-pricing-new.js` | Pricing display adapter |
| `/shared_components/css/dtg-quote-builder-new.css` | DTG-specific styles |
| `/memory/DTG_QUOTE_BUILDER.md` | Documentation |

### Files to Reuse (No Changes)

| File | Purpose |
|------|---------|
| `/shared_components/js/dtg-pricing-service.js` | Core pricing engine |
| `/shared_components/js/dtg-quote-service.js` | Quote save/load |
| `/shared_components/js/exact-match-search.js` | Style search |

### API Endpoints

| Endpoint | Purpose |
|----------|---------|
| `/api/pricing-bundle?method=DTG&styleNumber=X` | DTG pricing data |
| `/api/product-colors?styleNumber=X` | Color swatches |
| `/api/sizes-by-style-color?styleNumber=X&color=Y` | Available sizes |
| `/api/quote_sessions` | Save/load quotes |

---

## Print Location Configuration

### Single Locations
| Code | Name | Size |
|------|------|------|
| LC | Left Chest | 4" × 4" |
| FF | Full Front | 12" × 16" |
| FB | Full Back | 12" × 16" |
| JF | Jumbo Front | 16" × 20" |
| JB | Jumbo Back | 16" × 20" |

### Combo Locations (Front + Back)
| Code | Components | Pricing |
|------|------------|---------|
| LC_FB | Left Chest + Full Back | LC cost + FB cost |
| FF_FB | Full Front + Full Back | FF cost + FB cost |
| JF_JB | Jumbo Front + Jumbo Back | JF cost + JB cost |
| LC_JB | Left Chest + Jumbo Back | LC cost + JB cost |

### UI Constraints
- **Front locations:** LC, FF, JF are mutually exclusive (pick one)
- **Back locations:** FB, JB are mutually exclusive (pick one)
- **Combos:** Can select one front + one back

---

## Pricing Logic

### Formula
```
Unit Price = HalfDollarUp(GarmentCost / MarginDenominator + PrintCost) + SizeUpcharge + LTM
```

### Components
| Factor | Source | Notes |
|--------|--------|-------|
| Garment Cost | API `sizes[].price` | Base cost from SanMar |
| Margin Denominator | API `tiersR[].MarginDenominator` | Typically 0.57-0.65 |
| Print Cost | API `allDtgCostsR[].PrintCost` | By location + tier |
| Size Upcharge | API `sellingPriceDisplayAddOns` | 2XL: $2, 3XL: $3, etc. |
| LTM | $50 / qty (if qty < 24) | Math.floor() rounding |

### Quantity Tiers
| Tier | Qty Range | Notes |
|------|-----------|-------|
| 1-11 | 1-11 | Uses 12-23 pricing + LTM |
| 12-23 | 12-23 | LTM applies |
| 24-47 | 24-47 | No LTM |
| 48-71 | 48-71 | Better pricing |
| 72+ | 72+ | Best pricing |

---

## UI Mockup

```
┌─────────────────────────────────────────────────────────────────────────┐
│ 🖨️ DTG Quote Builder 2026                              [Save] [Print]  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  PRINT LOCATIONS                          │  PRICING SUMMARY            │
│  ┌─────────────────────────┐              │  ┌───────────────────────┐  │
│  │ FRONT (pick one)        │              │  │ Total Pieces: 48      │  │
│  │ ○ Left Chest (4"×4")    │              │  │ Tier: 48-71           │  │
│  │ ● Full Front (12"×16")  │              │  │                       │  │
│  │ ○ Jumbo Front (16"×20") │              │  │ Print: Full Front     │  │
│  │                         │              │  │ Cost: $7.50/ea        │  │
│  │ BACK (optional)         │              │  │                       │  │
│  │ ☑ Full Back (12"×16")   │              │  │ Subtotal: $1,248.00   │  │
│  │ ○ Jumbo Back (16"×20")  │              │  │ Grand Total: $1,248   │  │
│  └─────────────────────────┘              │  └───────────────────────┘  │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│ PRODUCTS                                                     [+ Add Row]│
├─────────┬──────────────┬───────┬───┬───┬───┬────┬─────┬────┬──────┬────┤
│ Style   │ Description  │ Color │ S │ M │ L │ XL │ 2XL │ +  │ Qty  │ $  │
├─────────┼──────────────┼───────┼───┼───┼───┼────┼─────┼────┼──────┼────┤
│ PC54    │ Core Cotton  │ Black │ 5 │10 │15 │ 10 │  8  │[+] │  48  │$26 │
│  └─3XL  │ Size upcharge│ Black │   │   │   │    │     │    │   3  │$29 │
├─────────┼──────────────┼───────┼───┼───┼───┼────┼─────┼────┼──────┼────┤
│ [input] │              │       │   │   │   │    │     │    │      │    │
└─────────┴──────────────┴───────┴───┴───┴───┴────┴─────┴────┴──────┴────┘
```

---

## Implementation Phases

### Phase 1: Fork & Clean (Session 1)
- [ ] Create branch `dtg-excel-quote-builder`
- [ ] Copy `embroidery-quote-builder-new.html` → `dtg-quote-builder-new.html`
- [ ] Remove embroidery-specific code (stitch counts, digitizing, AL)
- [ ] Remove cap detection (DTG can't print caps)
- [ ] Update header/branding to "DTG Quote Builder"

### Phase 2: Print Location Integration (Session 1-2)
- [ ] Create print location toggle UI in sidebar
- [ ] Implement front location selection (LC/FF/JF - mutually exclusive)
- [ ] Implement back location selection (FB/JB - optional)
- [ ] Wire up combo location pricing (sum of both costs)
- [ ] Update pricing sidebar to show location costs

### Phase 3: Pricing Integration (Session 2)
- [ ] Connect to `dtg-pricing-service.js`
- [ ] Implement tier display (12-23, 24-47, 48-71, 72+)
- [ ] Add LTM warning for <24 pieces
- [ ] Size upcharge handling (2XL: +$2, 3XL: +$3, etc.)
- [ ] Real-time total calculation

### Phase 4: Invoice & Save (Session 2-3)
- [ ] Adapt invoice generation for DTG format
- [ ] Quote ID generation (DTG[MMDD]-seq)
- [ ] Customer info form
- [ ] Email/PDF export

### Phase 5: Testing & Polish (Session 3)
- [ ] Verify pricing matches existing DTG calculator
- [ ] Test all print location combinations
- [ ] Test extended sizes (child rows)
- [ ] Test edge cases (OSFA, youth sizes)
- [ ] Cross-browser testing
- [ ] Update documentation

---

## Success Criteria

- [ ] Products can be added with style/color/sizes in Excel-style table
- [ ] Print locations selectable (single or combo)
- [ ] Pricing matches existing DTG pricing calculator exactly
- [ ] LTM fee applied correctly for <24 pieces
- [ ] Size upcharges working (2XL+)
- [ ] Child rows work for extended sizes
- [ ] Quote saves to database with DTG prefix
- [ ] PDF/Email export functional
- [ ] Caps are blocked with helpful error message

---

## Testing Checklist

### Pricing Verification
- [ ] PC54 Black, 48 qty, Left Chest = matches DTG calculator
- [ ] PC54 Black, 48 qty, Full Front + Full Back = sum of both locations
- [ ] PC54 Black, 18 qty, Left Chest = includes LTM fee
- [ ] 2XL size = +$2 upcharge
- [ ] 3XL size = +$3 upcharge

### Product Handling
- [ ] Style search finds products
- [ ] Color picker shows swatches
- [ ] Extended sizes create child rows
- [ ] OSFA products work correctly
- [ ] Youth sizes work correctly
- [ ] Cap styles show error (DTG can't print caps)

### Quote Operations
- [ ] Save quote generates DTG[MMDD]-seq ID
- [ ] Customer info saves correctly
- [ ] PDF export works
- [ ] Email sends correctly

---

## Related Documentation

- `/memory/DTG_PRICING_CONSISTENCY.md` - DTG pricing rules
- `/memory/EMBROIDERY_QUOTE_BUILDER.md` - Source UI pattern
- `/memory/QUOTE_BUILDER_GUIDE.md` - General quote builder patterns

---

## Notes

- DTG tier structure starts at 12 (not 24 like embroidery)
- DTG uses HalfDollarUp rounding (same as embroidery)
- LTM uses Math.floor() to prevent overcharging (critical)
- Print costs vary by location AND tier (fetch from API)

---

**Created:** 2026-01-05
**Author:** Erik Mickelson + Claude Code
**Status:** Ready for Implementation
