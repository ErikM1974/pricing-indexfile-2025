# Quote Builder Feature Parity Audit

**Date:** 2026-01-13
**Purpose:** Document feature gaps, inconsistencies, and architecture across all four quote builders
**Status:** Living document - update as features are added

---

## Quick Reference: What Each Builder Has

| Feature | DTF | DTG | Screen Print | Embroidery |
|---------|:---:|:---:|:------------:|:----------:|
| Save to database | ✅ | ✅ | ✅ | ✅ |
| Shareable URL | ✅ | ✅ | ✅ | ✅ |
| PDF generation | ✅ | ✅ | ✅ | ✅ |
| Auto-save drafts | ❌ | ❌ | ❌ | ❌ |
| Sales rep dropdown | ❌ | ✅ | ✅ | ✅ |
| Keyboard hints | ✅ | ❌ | ❌ | ❌ |

---

## Architecture Overview

### All 4 Builders Share:
- **Database tables:** `quote_sessions` + `quote_items` (Caspio)
- **Quote ID format:** `[PREFIX][MMDD]-[seq]` (e.g., DTF0113-1, EMB0113-2)
- **Quote share modal:** `/shared_components/js/quote-share-modal.js`
- **Product search:** ExactMatchSearch module
- **Size grid:** S, M, L, XL, XXL + extended sizes popup
- **Child row system:** Extended sizes create child rows with optional color override
- **LTM fee:** $50 for orders < 24 pieces
- **30-day expiration:** All quotes expire after 30 days

### Files Per Builder:

| Builder | HTML | Service JS | Pricing JS | CSS |
|---------|------|------------|------------|-----|
| DTF | `dtf-quote-builder.html` | `dtf-quote-service.js` | `dtf-quote-pricing.js` | `dtf-quote-builder.css` |
| DTG | `dtg-quote-builder.html` | `dtg-quote-service.js` | `dtg-quote-pricing.js` | `dtg-quote-builder-extracted.css` |
| Screen Print | `screenprint-quote-builder.html` | `screenprint-quote-service.js` | `screenprint-quote-pricing.js` | `screenprint-quote-builder-extracted.css` |
| Embroidery | `embroidery-quote-builder.html` | `embroidery-quote-service.js` | `embroidery-quote-pricing.js` | `embroidery-quote-builder-extracted.css` |

---

## Detailed Feature Matrix

### Configuration Options

| Feature | DTF | DTG | Screen Print | Embroidery |
|---------|-----|-----|--------------|------------|
| **Location Selection** |
| Max locations | 8 | 2 (1 front + 1 back) | 2 (front + back) | Multiple (primary + AL) |
| Location conflict zones | ✅ Smart zones | ✅ Simple exclusivity | ✅ Simple | ✅ Per product type |
| **Method-Specific** |
| Stitch count (1K-50K) | - | - | - | ✅ |
| Ink colors (1-6) | - | - | ✅ | - |
| Dark garment/underbase | - | - | ✅ | - |
| Safety stripes ($2/pc) | - | - | ✅ | - |
| Digitizing fee ($100) | - | - | - | ✅ |
| Additional logos (AL) | - | - | - | ✅ |
| Mixed garment + cap | - | - | - | ✅ |

### Pricing Calculations

| Factor | DTF | DTG | Screen Print | Embroidery |
|--------|-----|-----|--------------|------------|
| Base pricing | Transfer cost + labor + freight | Flat rate per tier | Per color count | Per stitch count |
| Location multiplier | ✅ Labor × locations | ❌ Single location | ❌ | ❌ |
| Size upcharges | ✅ From API | ✅ From config | ✅ From API | ✅ From API |
| Setup fees | ❌ | ❌ | $30/screen | $100/logo digitizing |
| LTM fee | $50 if < 24 | $50 if < 24 | $50 if < 24 | $50/type if < 24 |
| Rounding | Half-dollar ceiling | Half-dollar ceiling | Half-dollar ceiling | Half-dollar (caps differ) |

### Customer Information Fields

| Field | DTF | DTG | Screen Print | Embroidery |
|-------|-----|-----|--------------|------------|
| Name (required) | ✅ | ✅ | ✅ | ✅ |
| Email (required) | ✅ | ✅ | ✅ | ✅ |
| Company | ✅ | ✅ | ✅ | ✅ |
| Phone | ✅ | ✅ | ✅ | ✅ |
| Sales rep dropdown | ❌ Auto-assigns | ✅ | ✅ | ✅ |
| Project name | ❌ | ✅ | ❌ | ❌ |
| Special notes | ❌ | ✅ | ❌ | ❌ |

### UI/UX Patterns

| Feature | DTF | DTG | Screen Print | Embroidery |
|---------|-----|-----|--------------|------------|
| Layout | Single-page | 3-phase wizard | Single-page | Single-page |
| Phase navigation | ❌ | ✅ | ❌ | ❌ |
| Keyboard hints visible | ✅ | ❌ | ❌ | ❌ |
| Color swatch auto-load | ❌ | ✅ | ❌ | ❌ |
| Success modal | ✅ | ✅ | ✅ | ✅ |

---

## Critical Gaps (Priority Order)

### 1. Auto-Save/Draft Recovery - NONE Have It
**Impact:** Medium - All quote data lost on browser refresh

**Current state:**
- `quote-persistence.js` EXISTS (427 lines) but NO builder uses it
- `quote-session.js` EXISTS (537 lines) but NO builder uses it
- All builders have custom session storage for pricing cache only

**Solution:** Integrate existing quote-persistence.js into all 4 builders

### 2. Sales Rep Dropdown - Missing from DTF
**Impact:** Low - DTF auto-assigns sales@nwcustomapparel.com

**Solution:** Copy dropdown from DTG/Embroidery to DTF

### 3. Keyboard Hints - Only DTF Shows Them
**Impact:** Low - Users don't discover Tab/Enter/Ctrl+S shortcuts

**Solution:** Add keyboard hint section to DTG, Screen Print, Embroidery

---

## Code Duplication Found

### Functions Duplicated 4 Times (Identical Code)

These functions exist in ALL 4 service files with identical logic:

```javascript
generateQuoteID()        // Date + daily sequence
generateSessionID()      // Random ID generation
cleanupOldSequences()    // SessionStorage cleanup
formatDateForCaspio()    // Date formatting (3 of 4)
```

**Location of duplicates:**
- `/shared_components/js/dtf-quote-service.js`
- `/shared_components/js/dtg-quote-service.js`
- `/shared_components/js/screenprint-quote-service.js`
- `/shared_components/js/embroidery-quote-service.js`

### BaseQuoteService Exists But Unused

**File:** `/shared_components/js/base-quote-service.js` (237 lines)

This base class was created but NO builder actually inherits from it. All 4 implement their own versions of the same methods.

**Future refactor:** Move duplicated functions to BaseQuoteService, have all services extend it.

---

## Unique Features by Builder

### DTF-Only Features
- Multi-location support (up to 8 locations)
- Per-location labor cost multiplier
- Transfer size categorization (Small/Medium/Large visual grouping)
- Keyboard shortcuts visible in UI

### DTG-Only Features
- 3-phase wizard UI with step navigation
- Phase tracking (highestPhaseReached)
- Color swatch click auto-loads product
- Project name and special notes fields

### Screen Print-Only Features
- Dark garment toggle (adds white underbase)
- Safety stripes option ($2/piece/location)
- Ink color count selection (1-6 colors)
- Screen count calculator display

### Embroidery-Only Features
- Stitch count configuration (1,000 - 50,000)
- Digitizing fee option ($100 per logo)
- Additional Logo (AL) support with separate pricing
- Mixed garment + cap quotes in single order
- PDF generation
- Email sending (via EmailJS)

---

## Shared Infrastructure Status

| Component | File | Used By | Status |
|-----------|------|---------|--------|
| Quote Share Modal | `quote-share-modal.js` | All 4 | ✅ Active |
| PDF Generator | `embroidery-quote-invoice.js` | All 4 | ✅ Active |
| Base Quote Service | `base-quote-service.js` | None | ❌ Unused |
| Quote Persistence | `quote-persistence.js` | None | ❌ Unused |
| Quote Session | `quote-session.js` | None | ❌ Unused |

---

## Database Schema (Shared by All)

### quote_sessions table
```
QuoteID          VARCHAR(50)   - e.g., "DTF0113-1"
SessionID        VARCHAR(100)  - Internal tracking
CustomerEmail    VARCHAR(255)  - Required
CustomerName     VARCHAR(255)  - Required
CompanyName      VARCHAR(255)  - Optional
Phone            VARCHAR(50)   - Optional
SalesRep         VARCHAR(100)  - Optional
TotalQuantity    INT
SubtotalAmount   DECIMAL(10,2)
LTMFeeTotal      DECIMAL(10,2)
TotalAmount      DECIMAL(10,2)
Status           VARCHAR(20)   - "Active", "Accepted", "Expired"
ExpiresAt        DATETIME      - 30 days from creation
Notes            TEXT          - JSON with method-specific data
CreatedAt        DATETIME
```

### quote_items table
```
QuoteID              VARCHAR(50)   - Foreign key
LineNumber           INT
StyleNumber          VARCHAR(50)
ProductName          VARCHAR(255)
Color                VARCHAR(100)
ColorCode            VARCHAR(50)   - CATALOG_COLOR for inventory
EmbellishmentType    VARCHAR(20)   - "dtf", "dtg", "embroidery", "screenprint"
PrintLocation        VARCHAR(50)
PrintLocationName    VARCHAR(100)
Quantity             INT
HasLTM               BOOLEAN
BaseUnitPrice        DECIMAL(10,2)
LTMPerUnit           DECIMAL(10,2)
FinalUnitPrice       DECIMAL(10,2)
LineTotal            DECIMAL(10,2)
SizeBreakdown        TEXT          - JSON
PricingTier          VARCHAR(20)
ImageURL             VARCHAR(500)
AddedAt              DATETIME
```

---

## Implementation Roadmap

### Completed
- [x] Mobile responsiveness for all 4 builders (2026-01-13)
- [x] Quote share modal shared across all 4 (2026-01-13)
- [x] Remove email UI confusion (2026-01-13)
- [x] PDF generation for all 4 builders (already existed - verified 2026-01-13)

### Planned
- [ ] Auto-save/draft recovery for all 4
- [ ] Sales rep dropdown for DTF
- [ ] Keyboard hints for DTG, Screen Print, Embroidery
- [ ] Refactor duplicated service code to BaseQuoteService

---

## Testing Checklist

When modifying any quote builder, verify:

- [ ] Product search works (style number + name)
- [ ] Size grid accepts quantities
- [ ] Extended sizes popup works
- [ ] Pricing calculates correctly per tier
- [ ] LTM fee applies when < 24 pieces
- [ ] Size upcharges apply to 2XL+
- [ ] Customer info saves
- [ ] Quote saves to database
- [ ] Shareable URL works
- [ ] Quote view page displays correctly
- [ ] Mobile layout works (1024px, 768px, 480px)
- [ ] Print layout works (Ctrl+P)

---

## Related Documentation

- `/memory/QUOTE_BUILDER_GUIDE.md` - How to build new quote builders
- `/memory/LESSONS_LEARNED.md` - Past bugs and solutions
- `/memory/quote-builders/SHAREABLE_QUOTE_BLUEPRINT.md` - Shareable URL implementation
