# Inline CSS Extracted from embroidery-quote-builder.html

**Date:** 2025-10-16
**Source:** Lines 36-144 of embroidery-quote-builder.html
**Purpose:** Document critical CSS that must be preserved/migrated during refactor

## Critical Color Swatch CSS (Lines 36-144)

This CSS was in the `<style>` tag in the HTML head and is CRITICAL for color swatch functionality.

```css
/* FORCE form-group containing swatches to break out of flex constraints */
.search-row .form-group:has(#color-swatches-container) {
    flex-basis: 100% !important;
    width: 100% !important;
    order: 10 !important;  /* Move to its own row */
}

/* Color Swatch Styles - FORCE GRID LAYOUT WITH MAXIMUM SPECIFICITY */
#product-phase .search-row #color-swatches-container,
#product-phase .product-search-container .color-swatch-container,
.color-swatch-container {
    display: grid !important;
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)) !important;
    gap: 16px !important;
    margin-top: 16px !important;
    max-height: 400px !important;
    overflow-y: auto !important;
    padding: 10px !important;
    border: 1px solid #e5e7eb !important;
    border-radius: 8px !important;
    background: #f9fafb !important;
    width: 100% !important;
}

/* Individual color swatch styling - prevent full width */
#color-swatches-container .color-swatch,
.color-swatch-container .color-swatch {
    display: flex !important;
    flex-direction: column !important;
    align-items: center !important;
    gap: 8px !important;
    padding: 12px !important;
    border: 2px solid transparent !important;
    border-radius: 12px !important;
    background: white !important;
    cursor: pointer !important;
    transition: all 0.2s ease !important;
    position: relative !important;
    width: auto !important;
    max-width: none !important;
    min-width: 0 !important;
}

.color-swatch:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    border-color: #d1d5db;
}

.color-swatch.selected {
    border-color: #3a7c52;
    background: #e8f5e9;
    box-shadow: 0 0 0 3px rgba(58, 124, 82, 0.2);
}

.color-swatch.selected::after {
    content: '\2713';
    position: absolute;
    top: 8px;
    right: 8px;
    width: 24px;
    height: 24px;
    background: #3a7c52;
    color: white;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    font-weight: bold;
}

.color-swatch-image {
    width: 60px;
    height: 60px;
    object-fit: cover;
    border-radius: 8px;
    border: 1px solid #e5e7eb;
}

.color-swatch-name {
    font-size: 12px;
    font-weight: 500;
    color: #374151;
    text-align: center;
    line-height: 1.3;
    word-break: break-word;
}

.color-swatch.disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.color-swatch.disabled:hover {
    transform: none;
    box-shadow: none;
}

/* Loading state for color swatches */
.color-swatch-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 40px;
    color: #6b7280;
}

.color-swatch-loading i {
    margin-right: 8px;
}

/* Hide original dropdown when swatches are shown */
#color-select.swatch-mode {
    display: none;
}
```

## Notes

**Current Status:** This CSS is INLINE in the HTML head section.

**Refactor Plan:**
- Will be migrated to external CSS file: `embroidery-quote-builder-modern.css`
- DTG has similar patterns (lines 509-625 of dtg-quote-builder.css)
- DTG's version is cleaner and better organized
- Will use DTG's pattern as base, adapt color values to match embroidery theme

**Color Differences (Embroidery vs DTG):**
- Embroidery primary: `#3a7c52` (darker green)
- DTG primary: `#4cb354` (brighter green)
- Will preserve embroidery's darker green in new CSS

**Critical for:** Step 2 color swatch selection functionality

**Status:** ✅ Extracted and documented
