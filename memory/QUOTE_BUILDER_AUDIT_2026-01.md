# Quote Builder Comprehensive Audit & Standardization Plan
**Created:** 2026-01-27
**Status:** Implementation in progress

## Executive Summary

This audit examines all four quote builders (DTG, Screen Print, DTF, Embroidery) across three dimensions:
1. **CSS/Visual Consistency** - Header styling, sidebars, buttons, tables
2. **Functional Parity** - Quote saving, PDF generation, quote view display
3. **Data Architecture** - API endpoints, payload structures, quote ID formats

**Key Finding:** Embroidery is the most feature-complete builder and should serve as the template for standardization. DTF has the cleanest CSS architecture. All builders need alignment.

---

## Visual Comparison (From Screenshots)

### Header Styling Differences

| Builder | Header Color | Title | Subtitle | Extra Buttons |
|---------|--------------|-------|----------|---------------|
| **Embroidery** | Dark teal (#003f7f) | "2026 Embroidery Quote Builder" | "Garments + Caps \| Embroidery, 3D Puff & Laser Patches" | New Quote (green) + Dashboard |
| **DTG** | Dark teal (#003f7f) | "2026 DTG Quote Builder" | "Direct-to-Garment Printing" | Dashboard only |
| **Screen Print** | Dark teal (#003f7f) | "2026 Screen Print Quote Builder" | "Screen Printing" | Dashboard only |
| **DTF** | Dark green (#065f46) | "DTF Quote Builder 2026" | "Direct-to-Film Transfers" | Dashboard only |

**Issue:** DTF has different header color (green instead of blue). Title format inconsistent ("2026 X" vs "X 2026").

### Sidebar/Quote Summary Panel

| Builder | Panel Title | Key Rows | Collapsible Sections |
|---------|-------------|----------|----------------------|
| **Embroidery** | "Quote Summary" | Total Pieces, Pricing Tier, Products (Base BK), Additional Charges | Yes (Additional Charges, Save & Share) |
| **DTG** | "Quote Summary" | Print Location, Total Pieces, Pricing Tier, Products Subtotal | No |
| **Screen Print** | "Pricing Summary" | Front Print, Total Screens, Total Pieces, Pricing Tier, Products Subtotal, Setup Fee | No |
| **DTF** | "Quote Summary" | Print Location, Total Pieces, Pricing Tier, Products Subtotal | No |

**Issues:**
- Panel titles vary ("Quote Summary" vs "Pricing Summary")
- Embroidery has collapsible sections, others don't
- Screen Print shows setup fees, others don't have them

### Save & Share Section

| Builder | Location | Customer Fields | Primary Button Color |
|---------|----------|-----------------|---------------------|
| **Embroidery** | Collapsible in sidebar | Name, Email, Company, Phone, Sales Rep | Orange (#e67e22) |
| **DTG** | Inline in sidebar | Name, Email, Company, Phone, Sales Rep | Green (#4cb354) |
| **Screen Print** | Inline in sidebar | Name, Email, Company, Phone, Sales Rep | Green |
| **DTF** | Inline in sidebar | Name, Email, Company, Phone, Sales Rep | Green (#10b981) |

**Issue:** Embroidery uses orange save button while all others use green variations.

### Action Buttons

| Builder | Buttons | Order |
|---------|---------|-------|
| **Embroidery** | Copy Quote, Print Quote | Copy first |
| **DTG** | Copy Quote, Print Quote | Copy first |
| **Screen Print** | Save & Get Link, Copy Quote, Print Quote | Save first |
| **DTF** | Save & Get Link, Copy Quote, Print Quote | Save first |

**Issue:** Inconsistent button ordering - some have Save first, others have Copy first.

---

## CSS Architecture Analysis

### Current State

| Builder | Main CSS File | Uses quote-builder-common.css | Inline style= Count |
|---------|---------------|-------------------------------|---------------------|
| **DTG** | dtg-quote-builder-extracted.css (2,215 lines) | YES | 54 |
| **Screen Print** | screenprint-quote-builder-extracted.css (2,154 lines) | YES | 77 |
| **Embroidery** | embroidery-quote-builder-extracted.css (2,780 lines) | YES | 126 |
| **DTF** | dtf-quote-builder.css (2,112 lines) | YES (original) | 22 |

### CSS Variable Inconsistencies

```css
/* DTG/Screen Print/Embroidery */
--nwca-blue: #003f7f;
--nwca-green: #28a745;
--builder-primary: #4cb354;  /* Green save button */

/* DTF - Different scheme */
--dtf-primary: #10b981;      /* Emerald green */
--dtf-header-bg: #065f46;    /* Dark green header */

/* Embroidery - Override */
--builder-primary: #e67e22;  /* Orange save button */
```

### Recommended CSS Architecture

```
/shared_components/css/
├── quote-builder-common.css     ← Base styles (loading, toasts, validation, utilities)
├── quote-builder-layout.css     ← NEW: Shared layout (header, sidebar, table structure)
├── quote-builder-theme-blue.css ← NEW: Blue theme (DTG, Screen Print, Embroidery)
├── quote-builder-theme-green.css← NEW: Green theme (DTF)
├── dtg-quote-builder-specific.css       ← DTG-only overrides
├── screenprint-quote-builder-specific.css
├── embroidery-quote-builder-specific.css
└── dtf-quote-builder-specific.css
```

---

## Functional Parity Analysis

### Quote Saving

| Feature | DTG | Screen Print | DTF | Embroidery |
|---------|-----|--------------|-----|------------|
| **Quote ID Format** | DTG0127-1 | SP0127-1 | DTF0127-1 | EMB-2026-001 |
| **Sequence Type** | Daily (client) | Daily (client) | Daily (client) | Annual (API-backed) |
| **API Base** | /api/quote_sessions | /api/quote_sessions | /api/quote_sessions | /api/quote_sessions |
| **Session Fields** | ~15 | ~15 | ~15 | ~40+ |
| **Notes Field** | JSON (config) | JSON (config) | JSON (config) | String (customer notes) |

**Issues:**
1. Embroidery uses different quote ID format (year-based vs date-based)
2. Embroidery has API-backed sequence, others use sessionStorage (collision risk)
3. Embroidery session table is bloated with 40+ fields vs 15 for others
4. Notes field usage inconsistent (JSON config vs plain text)

### PDF Generation

| Feature | DTG | Screen Print | DTF | Embroidery |
|---------|-----|--------------|-----|------------|
| **PDF Method** | Inline in service | Inline in service | Inline in service | Separate EmbroideryInvoiceGenerator class |
| **Tax Included** | No (web only) | No (web only) | No (web only) | Yes (10.1%) |
| **jsPDF/html2canvas** | Yes | Yes | Yes | Yes |
| **Print Button** | Yes | Yes | Yes | Yes |

**Issues:**
1. Tax calculation only in quote-view.js and embroidery-invoice.js, not saved to database
2. PDF generation code duplicated across services instead of shared class

### Quote View Display

| Feature | DTG | Screen Print | DTF | Embroidery |
|---------|-----|--------------|-----|------------|
| **URL Format** | /quote/DTG0127-1 | /quote/SP0127-1 | /quote/DTF0127-1 | /quote/EMB-2026-001 |
| **Type Detection** | QuoteID prefix | QuoteID prefix | QuoteID prefix | QuoteID prefix |
| **Special Sections** | Print Location | Print Setup, Ink Colors, Setup Fee | Transfer Locations | Logo Specs, Stitch Counts |
| **Line Items** | Standard table | Standard table | Standard table | Standard table |

**Quote View Works Correctly** - All builders display properly with type-specific sections.

### Location Selection UI

| Builder | Selection Type | Options |
|---------|---------------|---------|
| **DTG** | Radio buttons | Front: LC/FF/JF, Back: None/FB/JB |
| **Screen Print** | Radio buttons | Front: LC/FF/JF, Back: None/FB/JB + Ink colors (1-6) |
| **DTF** | Checkboxes | Small: LC/RC/LS/RS/BN, Medium: CF/CB, Large: FF/FB |
| **Embroidery** | Dropdown | Left Chest/Right Chest/Center Chest |

**By Design:** Each builder has different location models appropriate for its decoration method.

---

## Product Table Inconsistencies

### Size Column Headers

| Builder | Size Columns |
|---------|--------------|
| **DTG** | S, M, L, XL, 2XL, More Sizes |
| **Screen Print** | S, M, LG, XL, XXL, More Sizes |
| **DTF** | S, M, L, XL, 2XL, More Sizes |
| **Embroidery** | S, M, L, XL, 2XL, More Sizes |

**Issue:** Screen Print uses "LG" and "XXL" while others use "L" and "2XL". Should standardize.

### Color Picker

| Builder | Has Color Picker | Location |
|---------|------------------|----------|
| **DTG** | Yes | In product table row |
| **Screen Print** | No | Colors set in config section |
| **DTF** | Yes | In product table row |
| **Embroidery** | Yes | In product table row |

**Issue:** Screen Print missing per-row color picker (by design for ink colors, but inconsistent UX).

### Table Features

| Feature | DTG | Screen Print | DTF | Embroidery |
|---------|-----|--------------|-----|------------|
| **Total Column** | No | No | No | Yes |
| **Extended Sizes (3XL+)** | Popup | Popup | Popup | Popup |
| **Child Rows** | Yes (green) | Yes (green) | Yes (yellow if diff color) | Yes |

**Issue:** Only Embroidery shows per-row totals. Others should add this for better UX.

---

## Data Structure Issues

### Quote ID Formats

```
DTG:         DTG0127-1     (prefix + MMDD + daily sequence)
Screen Print: SP0127-1
DTF:         DTF0127-1
Embroidery:  EMB-2026-001  (prefix + year + annual sequence)
```

**Recommendation:** Standardize all to `PREFIX-YYYY-NNN` format for:
- Global uniqueness (no collision risk)
- Easier sorting/filtering by year
- Professional appearance

### Session Payload Comparison

**Minimal (DTG/ScreenPrint/DTF):**
```javascript
{
  QuoteID, SessionID, CustomerEmail, CustomerName, CompanyName, Phone,
  TotalQuantity, SubtotalAmount, LTMFeeTotal, TotalAmount,
  Status, ExpiresAt, Notes (JSON config)
}
```

**Extended (Embroidery):**
```javascript
{
  // All above PLUS:
  SalesRepEmail, SalesRepName,
  PrintLocation, StitchCount, DigitizingFee,
  AdditionalLogoLocation, AdditionalStitchCount,
  CapPrintLocation, CapStitchCount, CapDigitizingFee, CapEmbellishmentType,
  GarmentStitchCharge, CapStitchCharge, AdditionalStitchCharge,
  ALChargeGarment, ALChargeCap, GarmentDigitizing, CapDigitizing,
  ArtCharge, GraphicDesignHours, GraphicDesignCharge,
  RushFee, SampleFee, SampleQty,
  LTM_Garment, LTM_Cap,
  Discount, DiscountPercent, DiscountReason,
  RevisionNumber, RevisedAt, RevisedBy, RevisionNotes
}
```

**Issue:** Embroidery session is overloaded. Many fields should be in a separate `quote_embroidery_config` table.

### Line Item EmbellishmentType Values

```
DTG:         "dtg"
Screen Print: "screenprint"
DTF:         "dtf" (assumed)
Embroidery:  "embroidery", "embroidery-additional", "monogram"
```

**Recommendation:** Standardize to kebab-case: `"dtg"`, `"screen-print"`, `"dtf"`, `"embroidery"`

---

## Priority Fixes

### P0: Critical (Visual Consistency)

1. **Standardize header colors** - DTF should match blue theme or document green as intentional
2. **Standardize save button colors** - All green OR all match their theme
3. **Fix size column headers** - Screen Print: "LG" → "L", "XXL" → "2XL"
4. **Add Total column** - DTG, Screen Print, DTF should show per-row totals like Embroidery

### P1: High (Functional Alignment)

5. **Standardize quote ID format** - Move all to `PREFIX-YYYY-NNN` with API-backed sequence
6. **Add tax to saved quotes** - Calculate and store TotalWithTax in database
7. **Create shared PDF generator** - Extend EmbroideryInvoiceGenerator for all builders
8. **Standardize button order** - All: Save & Get Link → Copy Quote → Print Quote

### P2: Medium (Architecture)

9. **Extract Embroidery session fields** - Move logo/stitch config to separate table
10. **Create shared quote service base** - Extend base-quote-service.js for all builders
11. **Unify Notes field usage** - All use JSON for config, add separate CustomerNotes field
12. **Standardize EmbellishmentType values** - Consistent kebab-case naming

### P3: Low (Polish)

13. **Align sidebar layouts** - Match Embroidery's collapsible sections pattern
14. **Add unsaved indicator** - DTG/ScreenPrint/DTF should have indicator like Embroidery
15. **Add "New Quote" button** - DTG/ScreenPrint/DTF should match Embroidery
16. **CSS consolidation** - Create theme files to reduce duplication

---

## Key Files

### HTML Files
- `/quote-builders/dtg-quote-builder.html`
- `/quote-builders/screenprint-quote-builder.html`
- `/quote-builders/dtf-quote-builder.html`
- `/quote-builders/embroidery-quote-builder.html`

### CSS Files
- `/shared_components/css/dtg-quote-builder-extracted.css`
- `/shared_components/css/screenprint-quote-builder-extracted.css`
- `/shared_components/css/dtf-quote-builder.css`
- `/shared_components/css/embroidery-quote-builder-extracted.css`
- `/shared_components/css/quote-builder-common.css`

### JavaScript Service Files
- `/shared_components/js/dtg-quote-service.js`
- `/shared_components/js/screenprint-quote-service.js`
- `/shared_components/js/dtf-quote-service.js`
- `/shared_components/js/embroidery-quote-service.js`
- `/shared_components/js/embroidery-quote-invoice.js` (PDF generation)

### Quote View
- `/pages/quote-view.html`
- `/pages/js/quote-view.js`

---

## Verification Checklist

### After Visual Fixes
- [ ] All headers same color (or DTF green documented)
- [ ] All save buttons consistent color
- [ ] Size columns: S, M, L, XL, 2XL across all builders
- [ ] Total column visible in DTG, Screen Print, DTF tables
- [ ] Button order: Save → Copy → Print

### After Functional Fixes
- [ ] Create quote in each builder → QuoteID format is PREFIX-YYYY-NNN
- [ ] View quote → Tax displayed and saved
- [ ] Print PDF → Generates correctly with tax
- [ ] Email quote (Embroidery) → Sends with correct data

### Cross-Builder Regression Test
For each builder (DTG, Screen Print, DTF, Embroidery):
- [ ] Add 2 products with different colors
- [ ] Add extended sizes (3XL)
- [ ] Save quote → Get shareable link
- [ ] Open link → All line items display correctly
- [ ] Print PDF → Looks professional, includes all data
- [ ] Edit mode → Can modify and re-save
