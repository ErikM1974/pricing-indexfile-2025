# Quote Builder CSS Alignment Audit Report

**Date:** January 6, 2026
**Purpose:** Document current CSS differences across quote builders to enable universal styling
**Prepared for:** Erik - NWCA

---

## Executive Summary

This audit compares 4 quote builders (DTF, DTG, Embroidery, Screen Print) to identify CSS differences that must be aligned before creating a universal stylesheet.

### Current State Overview

| Builder | CSS Location | HTML Lines | External CSS Files |
|---------|--------------|------------|-------------------|
| **DTF** | External only | ~478 | `dtf-quote-builder.css` (800+ lines) |
| **DTG** | External only | ~3,934 | `dtg-quote-builder-extracted.css` (2,009 lines) |
| **Embroidery** | External only | ~4,291 | `embroidery-quote-builder-extracted.css` (1,857 lines) |
| **Screen Print** | External only | ~3,977 | `screenprint-quote-builder-extracted.css` (1,926 lines) |

**Status (January 6, 2026):** ✅ CSS extraction COMPLETE. All builders now use external CSS files. Created `quote-builder-universal.css` (1,890 lines) containing all shared styles.

---

## Section 1: Header Comparison

### Current Differences

| Property | DTF | DTG | Embroidery | Screen Print |
|----------|-----|-----|------------|--------------|
| **Background Color** | `#065f46` (dark green) | `#003f7f` (blue) | `#003f7f` (blue) | `#003f7f` (blue) |
| **Header Height** | 60px (implied) | 60px (implied) | 60px (implied) | 60px (implied) |
| **Logo Height** | 40px | 40px | 40px | 40px |
| **Button Style** | `rgba(255,255,255,0.2)` | `rgba(255,255,255,0.2)` | `rgba(255,255,255,0.2)` | `rgba(255,255,255,0.2)` |
| **Padding** | `10px 20px` | `10px 20px` | `10px 20px` | `10px 20px` |

### Alignment Needed

| Element | Current Status | Action Required |
|---------|----------------|-----------------|
| Header structure | IDENTICAL | None - already aligned |
| Header padding | IDENTICAL | None |
| Logo size | IDENTICAL | None |
| Button styles | IDENTICAL | None |
| **Background color** | DIFFERENT | Use CSS variable `--header-bg` |

### Recommended Universal Header CSS

```css
.power-header {
    background: var(--header-bg);  /* Set per builder via theme */
    color: white;
    padding: 10px 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.power-header .logo {
    height: 40px;
}

.power-header .btn-header {
    background: rgba(255,255,255,0.2);
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
    transition: background 0.2s;
}

.power-header .btn-header:hover {
    background: rgba(255,255,255,0.3);
}
```

---

## Section 2: Main Layout Comparison

### Current Differences

| Property | DTF | DTG | Embroidery | Screen Print |
|----------|-----|-----|------------|--------------|
| **Sidebar Width** | `320px` | `300px` | `300px` | `300px` |
| **Main Height** | `calc(100vh - 60px)` | `calc(100vh - 60px)` | `calc(100vh - 60px)` | `calc(100vh - 60px)` |
| **Content Padding** | `16px 20px` | `15px 20px` | `15px 20px` | `15px 20px` |
| **Sidebar BG** | `#f1f3f5` | `#f1f3f5` | `#f1f3f5` | `#f1f3f5` |

### Alignment Needed

| Element | Current Status | Action Required |
|---------|----------------|-----------------|
| Main flex layout | IDENTICAL | None |
| **Sidebar width** | DTF=320px, Others=300px | Standardize to 320px |
| **Content padding** | DTF=16px, Others=15px | Standardize to 16px |
| Sidebar background | IDENTICAL | None |

### Recommended Universal Layout CSS

```css
.power-main {
    display: flex;
    height: calc(100vh - 60px);
    overflow: hidden;
}

.power-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

.power-sidebar {
    width: 320px;  /* Standardized from DTF */
    background: var(--bg-sidebar);
    border-left: 1px solid var(--border-color);
    display: flex;
    flex-direction: column;
    overflow-y: auto;
}

.product-grid-section {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: 16px 20px;  /* Standardized from DTF */
    overflow: hidden;
}
```

---

## Section 3: Product Table Comparison

### Table Header Colors

| Column | DTF | DTG/EMB/SP |
|--------|-----|------------|
| **Header BG** | `#1f2937` | `#2c3e50` |
| **Header Border** | `#374151` | `#34495e` |
| **Qty Column BG** | `#1e40af` | `#1a5276` |
| **Price Column BG** | `var(--dtf-primary-dark)` (#059669) | `#1e8449` |
| **Actions Column BG** | `#6b7280` | `#7f8c8d` |

### Table Column Widths

| Column | DTF | DTG | Embroidery | Screen Print |
|--------|-----|-----|------------|--------------|
| Style | 90px | 100px | 100px | 100px |
| Description | min 160px | min 180px | min 180px | min 180px |
| Color | 180px | 200px | 200px | 200px |
| Size (each) | 55px | 55px | 55px | 55px |
| Qty | 60px | 60px | 60px | 60px |
| Price | 80px | 80px | 80px | 80px |
| Actions | 40px | 40px | 40px | 40px |

### Alignment Needed

| Element | Current Status | Action Required |
|---------|----------------|-----------------|
| **Header background** | DTF darker gray, others slate | Standardize to `#2c3e50` |
| **Style column** | DTF=90px, others=100px | Standardize to 100px |
| **Desc column** | DTF=160px, others=180px | Standardize to 180px |
| **Color column** | DTF=180px, others=200px | Standardize to 200px |
| Size columns | IDENTICAL | None |
| **Qty header BG** | DTF=`#1e40af`, others=`#1a5276` | Standardize to `#1a5276` |
| **Price header BG** | DTF=green, others=green (diff shades) | Use CSS variable |

### Recommended Universal Table CSS

```css
.product-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
}

.product-table thead {
    position: sticky;
    top: 0;
    z-index: 10;
}

.product-table th {
    background: #2c3e50;  /* Standardized */
    color: white;
    padding: 10px 8px;
    text-align: center;
    font-weight: 600;
    font-size: 12px;
    border-right: 1px solid #34495e;
    white-space: nowrap;
}

.product-table th:first-child {
    text-align: left;
    padding-left: 12px;
}

.product-table th.style-col { width: 100px; }
.product-table th.desc-col { width: auto; min-width: 180px; }
.product-table th.color-col { width: 200px; min-width: 200px; }
.product-table th.size-col { width: 55px; min-width: 55px; }
.product-table th.qty-col { width: 60px; background: #1a5276; }
.product-table th.price-col { width: 80px; background: var(--price-header-bg); }
.product-table th.actions-col { width: 40px; background: #7f8c8d; }
```

---

## Section 4: Search Bar Comparison

### Current Differences

| Property | DTF | DTG/EMB/SP |
|----------|-----|------------|
| **Max Width** | 400px | 300px |
| **Border Radius** | 8px | 6px |
| **Border Style** | `2px solid #e5e7eb` | `2px solid var(--border-color)` |
| **Focus Color** | `var(--dtf-primary)` | `var(--nwca-blue)` |
| **Padding** | `10px 12px 10px 38px` | `10px 12px 10px 36px` |

### Alignment Needed

| Element | Action Required |
|---------|-----------------|
| Max width | Standardize to 400px (DTF's is better) |
| Border radius | Standardize to 8px |
| Focus color | Use CSS variable `--primary-color` |
| Padding | Standardize to 38px left padding |

### Recommended Universal Search CSS

```css
.search-input-wrapper {
    flex: 1;
    position: relative;
    max-width: 400px;  /* Standardized from DTF */
}

.search-icon {
    position: absolute;
    left: 12px;
    top: 50%;
    transform: translateY(-50%);
    color: #9ca3af;
}

.search-input {
    width: 100%;
    padding: 10px 12px 10px 38px;  /* Standardized */
    border: 2px solid var(--border-color);
    border-radius: 8px;  /* Standardized from DTF */
    font-size: 14px;
    transition: border-color 0.2s;
}

.search-input:focus {
    outline: none;
    border-color: var(--primary-color);
}
```

---

## Section 5: Sidebar Pricing Panel Comparison

### Current Differences

| Property | DTF | DTG/EMB/SP |
|----------|-----|------------|
| **Panel Structure** | Card-based with `.sidebar-panel` | Direct `.pricing-panel` div |
| **Panel Margin** | 12px | 0 |
| **Panel Border Radius** | 8px | 0 |
| **Title Background** | `#f8f9fa` | None |
| **Pricing Row Padding** | 8px 0 | 8px 0 |

### Alignment Needed

DTF has a more modern card-based panel system. The other builders use a simpler flat layout.

**Recommendation:** Adopt DTF's card-based panel system for cleaner visual hierarchy.

### Recommended Universal Sidebar CSS

```css
.sidebar-panel {
    background: white;
    margin: 12px;
    border-radius: 8px;
    border: 1px solid var(--border-color);
    overflow: hidden;
}

.panel-title {
    background: #f8f9fa;
    padding: 10px 14px;
    font-weight: 600;
    font-size: 13px;
    color: var(--text-dark);
    border-bottom: 1px solid var(--border-color);
}

.panel-title i {
    margin-right: 8px;
    color: var(--primary-color);
}

.pricing-row {
    display: flex;
    justify-content: space-between;
    padding: 8px 14px;
    font-size: 14px;
    border-bottom: 1px solid #eee;
}

.pricing-row .label {
    color: #666;
}

.pricing-row .value {
    font-weight: 600;
}

.pricing-row.grand-total {
    font-size: 16px;
    font-weight: 700;
    color: var(--primary-color);
    border-top: 2px solid var(--primary-color);
    border-bottom: none;
    padding-top: 12px;
    margin-top: 8px;
    background: var(--primary-light-bg);
}
```

---

## Section 6: Button Styles Comparison

### Sidebar Action Buttons

| Button | DTF | DTG/EMB/SP |
|--------|-----|------------|
| Copy Quote | `.btn-copy-quote` | `.btn-action.btn-secondary-action` |
| Continue | `.btn-continue` | `.btn-action.btn-primary-action` |
| Save Draft | `.btn-save-draft` | N/A or coming soon |
| Clear All | `.btn-clear-all` | N/A or coming soon |

### Button Colors

| Type | DTF | DTG/EMB/SP |
|------|-----|------------|
| Primary | Green (`--dtf-primary`) | Green (`--nwca-green`) |
| Secondary | Gray/white border | White on dark background |
| Danger | Red (`#dc2626`) | Red (`--nwca-red`) |

### Alignment Needed

DTF has more granular button classes. Standardize to a unified button system.

### Recommended Universal Button CSS

```css
/* Base button reset */
.btn {
    padding: 10px 16px;
    border: none;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    transition: all 0.2s;
}

/* Primary action (continue, save) */
.btn-primary {
    background: var(--primary-color);
    color: white;
}

.btn-primary:hover {
    filter: brightness(1.1);
}

.btn-primary:disabled {
    background: #d1d5db;
    cursor: not-allowed;
}

/* Secondary action (copy, draft) */
.btn-secondary {
    background: white;
    color: var(--text-dark);
    border: 1px solid var(--border-color);
}

.btn-secondary:hover {
    background: #f8f9fa;
    border-color: var(--primary-color);
}

/* Danger action (clear, delete) */
.btn-danger {
    background: white;
    color: #dc2626;
    border: 1px solid #fecaca;
}

.btn-danger:hover {
    background: #fef2f2;
    border-color: #dc2626;
}

/* Full width sidebar buttons */
.sidebar-actions {
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.sidebar-actions .btn {
    width: 100%;
}
```

---

## Section 7: CSS Variables (Theme System)

### Current Variables by Builder

**DTF Variables:**
```css
:root {
    --dtf-primary: #10b981;
    --dtf-primary-dark: #059669;
    --dtf-primary-light: #34d399;
    --dtf-primary-50: #d1fae5;
    --dtf-header-bg: #065f46;
}
```

**DTG/Embroidery/Screen Print Variables:**
```css
:root {
    --nwca-blue: #003f7f;
    --nwca-green: #28a745;
    --nwca-red: #dc3545;
    --border-color: #dee2e6;
    --bg-light: #f8f9fa;
    --bg-sidebar: #f1f3f5;
}
```

### Recommended Universal Theme System

```css
/* ============================================
   UNIVERSAL QUOTE BUILDER THEME SYSTEM
   ============================================ */

/* Shared constants (never change per builder) */
:root {
    /* Neutrals */
    --border-color: #dee2e6;
    --bg-light: #f8f9fa;
    --bg-sidebar: #f1f3f5;
    --text-dark: #1f2937;
    --text-muted: #6b7280;

    /* Status colors */
    --success: #22c55e;
    --warning: #f59e0b;
    --danger: #dc2626;

    /* Table colors */
    --table-header-bg: #2c3e50;
    --table-header-border: #34495e;
    --table-qty-bg: #1a5276;
    --table-actions-bg: #7f8c8d;
}

/* DTF Theme */
.dtf-quote-builder {
    --primary-color: #10b981;
    --primary-dark: #059669;
    --primary-light: #34d399;
    --primary-50: #d1fae5;
    --header-bg: #065f46;
    --price-header-bg: #059669;
}

/* DTG Theme */
.dtg-quote-builder {
    --primary-color: #28a745;
    --primary-dark: #218838;
    --primary-light: #48c774;
    --primary-50: #d4edda;
    --header-bg: #003f7f;
    --price-header-bg: #1e8449;
}

/* Embroidery Theme */
.embroidery-quote-builder {
    --primary-color: #28a745;
    --primary-dark: #218838;
    --primary-light: #48c774;
    --primary-50: #d4edda;
    --header-bg: #003f7f;
    --price-header-bg: #1e8449;
}

/* Screen Print Theme */
.screenprint-quote-builder {
    --primary-color: #2563eb;
    --primary-dark: #1d4ed8;
    --primary-light: #60a5fa;
    --primary-50: #dbeafe;
    --header-bg: #003f7f;
    --price-header-bg: #1e8449;
}
```

---

## Section 8: Critical Differences Summary

### Must Align (Breaking Visual Differences)

| Item | DTF Value | Others Value | Standardize To |
|------|-----------|--------------|----------------|
| Sidebar width | 320px | 300px | **320px** |
| Search max-width | 400px | 300px | **400px** |
| Border radius (inputs) | 8px | 6px | **8px** |
| Table header BG | `#1f2937` | `#2c3e50` | **#2c3e50** |
| Style column width | 90px | 100px | **100px** |
| Color column width | 180px | 200px | **200px** |
| Content padding | 16px 20px | 15px 20px | **16px 20px** |

### Already Aligned (No Changes Needed)

- Header structure and padding
- Logo size (40px)
- Header button styles
- Main flex layout
- Size column widths (55px each)
- Qty/Price/Actions column widths
- Font family (system stack)
- Row hover effects
- Keyboard navigation classes

### Intentionally Different (Keep Separate)

- Header background color (theme-based)
- Price column header color (theme-based)
- Primary accent color (theme-based)
- Focus highlight color (theme-based)
- Builder-specific sections:
  - DTF: Location checkboxes with zone conflict
  - DTG: Print location radios
  - Embroidery: Stitch count inputs, cap toggle
  - Screen Print: Ink color buttons

---

## Section 9: Implementation Roadmap

### Phase 1: Extract Inline CSS ✅ COMPLETED

**Completed January 6, 2026:**
- `dtg-quote-builder.html` - Extracted to `dtg-quote-builder-extracted.css` (2,009 lines)
- `embroidery-quote-builder.html` - Extracted to `embroidery-quote-builder-extracted.css` (1,857 lines)
- `screenprint-quote-builder.html` - Extracted to `screenprint-quote-builder-extracted.css` (1,926 lines)

**Results:**
| Builder | Before | After | Reduction |
|---------|--------|-------|-----------|
| DTG | 5,876 lines | 3,934 lines | -1,942 |
| Screen Print | 5,835 lines | 3,977 lines | -1,858 |
| Embroidery | 6,084 lines | 4,291 lines | -1,793 |

### Phase 2: Create Universal Base CSS ✅ COMPLETED

Created: `/shared_components/css/quote-builder-universal.css` (1,890 lines)

**Contents:**
1. CSS reset and base styles
2. Layout system (`.power-main`, `.power-content`, `.power-sidebar`)
3. Header styles
4. Product table base styles
5. Search bar styles
6. Sidebar panel styles
7. Button system
8. Form controls

### Phase 3: Create Theme Files

Create theme override files:
- `/shared_components/css/theme-dtf.css`
- `/shared_components/css/theme-dtg.css`
- `/shared_components/css/theme-embroidery.css`
- `/shared_components/css/theme-screenprint.css`

Each theme file only contains CSS variables (10-20 lines each).

**Estimated effort:** 1-2 hours

### Phase 4: Update HTML Files

Modify each quote builder HTML to:
1. Remove inline `<style>` blocks
2. Link to `quote-builder-universal.css`
3. Link to appropriate theme file
4. Add theme class to body (e.g., `class="dtf-quote-builder"`)

**Estimated effort:** 1 hour per file

### Phase 5: Testing and Refinement

- Visual comparison testing
- Cross-browser testing
- Mobile responsiveness check
- Fix any regressions

**Estimated effort:** 2-4 hours

---

## Section 10: Files Reference

### Current CSS Files (Quote Builder Related)

```
/shared_components/css/
├── quote-builder-universal.css           ← SHARED: All common styles (1,890 lines)
├── dtf-quote-builder.css                 ← DTF-specific styles
├── dtg-quote-builder-extracted.css       ← DTG-specific styles (extracted)
├── embroidery-quote-builder-extracted.css ← Embroidery-specific styles (extracted)
├── screenprint-quote-builder-extracted.css ← Screen Print-specific styles (extracted)
├── color-picker-shared.css               ← Shared color picker component
└── quote-print.css                       ← Print styles (shared)
```

### Quote Builder HTML Files

```
/quote-builders/
├── dtf-quote-builder.html         ← 478 lines, external CSS
├── dtg-quote-builder.html         ← 3,934 lines, external CSS ✅
├── embroidery-quote-builder.html  ← 4,291 lines, external CSS ✅
└── screenprint-quote-builder.html ← 3,977 lines, external CSS ✅
```

---

## Conclusion

**Status: ✅ PHASES 1-2 COMPLETE**

The CSS unification project has successfully completed the core extraction and universal stylesheet creation:

1. ✅ Extracted inline CSS from DTG, Embroidery, and Screen Print builders
2. ✅ Created `quote-builder-universal.css` with all shared styles
3. ✅ Reduced HTML file sizes by ~1,800-1,950 lines each

**Current Architecture:**
- **Universal CSS** (`quote-builder-universal.css`) - Edit once → all builders update
- **Builder-specific CSS** (`*-extracted.css`) - Per-builder customizations
- **Separate pricing JS** - Each builder has unique pricing logic

**Remaining Optional Work:**
- Phase 3: Create theme override files for color variations
- Phase 4: Further consolidation of builder-specific CSS

**See also:** `/memory/QUOTE_BUILDER_ARCHITECTURE.md` for complete documentation on creating new quote builders.

---

*Report generated by Claude Code - January 6, 2026*
*Updated: January 6, 2026 - Phases 1-2 completed*
