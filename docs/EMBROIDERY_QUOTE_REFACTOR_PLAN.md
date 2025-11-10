# Embroidery Quote Builder Refactor Plan - DTG-Inspired Architecture

**Created:** 2025-10-16
**Purpose:** Comprehensive blueprint for refactoring Cap Embroidery and Regular Embroidery quote builders using DTG builder's proven patterns
**Status:** Implementation Ready

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Scope & Objectives](#scope--objectives)
3. [DTG Patterns to Copy](#dtg-patterns-to-copy)
4. [File Structure Changes](#file-structure-changes)
5. [Implementation Roadmap](#implementation-roadmap)
6. [Before/After Comparisons](#beforeafter-comparisons)
7. [Testing Strategy](#testing-strategy)
8. [Preservation Checklist](#preservation-checklist)
9. [Rollback Plan](#rollback-plan)

---

## Executive Summary

### Problem Statement
The Cap Embroidery and Regular Embroidery quote builders suffer from:
- **CSS Architecture Chaos:** 25+ CSS files with overlapping responsibilities
- **Step 2 Broken:** Color swatches non-functional after previous refactor
- **Step 3 "Two Pages":** Duplicate containers creating unprofessional appearance
- **Maintenance Nightmare:** No clear file ownership, conflicting !important wars

### Solution Approach
Use the **DTG Quote Builder** as the model/inspiration. The DTG builder works perfectly with:
- Clean 8-file CSS architecture
- Modern toggle switches
- Professional color swatch system
- Single-container Step 3 layout

### Success Criteria
✅ Step 1: Modern toggle switches (like DTG)
✅ Step 2: Working color swatches (like DTG)
✅ Step 3: Single unified container (like DTG)
✅ All JavaScript/API functionality preserved
✅ Consistent with DTG's professional appearance

---

## Scope & Objectives

### In Scope
- **Cap Embroidery Quote Builder** (`/quote-builders/cap-embroidery-quote-builder.html`)
- **Regular Embroidery Quote Builder** (`/quote-builders/embroidery-quote-builder.html`)
- CSS architecture consolidation
- HTML head section updates
- Step 1, 2, and 3 layout improvements

### Out of Scope
- ❌ DTG Quote Builder (serves as model only - DO NOT MODIFY)
- ❌ JavaScript functionality changes
- ❌ API endpoint modifications
- ❌ Database schema changes
- ❌ EmailJS configuration changes
- ❌ Pricing calculation logic

### Critical Constraints
- **Zero Downtime:** Must work immediately after deployment
- **Backward Compatible:** All existing quotes/data must remain valid
- **JavaScript Preservation:** No changes to `.js` files
- **API Preservation:** All endpoints must continue working

---

## DTG Patterns to Copy

This section documents the EXACT code patterns from DTG that will be copied to the embroidery builders.

### Pattern 1: Clean CSS Load Order

**DTG Source:** `dtg-quote-builder.html` lines 1-50

**DTG's Clean CSS Load Order (8 files):**
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>DTG Quote Builder | Northwest Custom Apparel</title>

    <!-- NWCA Favicon -->
    <link rel="icon" type="image/png" href="https://cdn.caspio.com/A0E15000/Safety%20Stripes/NWCA%20Favicon%20for%20TEAMNWCA.com.png?ver=1">

    <!-- Font Awesome (MUST be before other CSS) -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.6.0/css/all.min.css">

    <!-- Bootstrap CSS (Foundation layer) -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet">

    <!-- EmailJS SDK -->
    <script src="https://cdn.jsdelivr.net/npm/@emailjs/browser@3/dist/email.min.js"></script>

    <!-- Universal Styles (Layer 2) -->
    <link rel="stylesheet" href="/shared_components/css/universal-header.css">
    <link rel="stylesheet" href="/shared_components/css/universal-calculator-theme.css">

    <!-- Base Quote Builder Styles (Layer 3) -->
    <link rel="stylesheet" href="/shared_components/css/embroidery-quote-builder.css">

    <!-- Unified Step Styles (Layer 4) -->
    <link rel="stylesheet" href="/shared_components/css/quote-builder-unified-step1.css">
    <link rel="stylesheet" href="/shared_components/css/quote-builder-unified-step1-v2.css">

    <!-- DTG Specific Overrides (Layer 5 - Highest Priority) -->
    <link rel="stylesheet" href="/shared_components/css/dtg-quote-builder.css?v=20251110c">
</head>
```

**Why This Works:**
1. **Bootstrap first** - Establishes baseline styles
2. **Universal second** - Overrides Bootstrap with NWCA branding
3. **Base third** - Shared quote builder patterns
4. **Unified fourth** - Step 1 modern patterns
5. **Specific last** - Builder-specific overrides (highest priority)

**To Copy for Embroidery Builders:**
Replace the current 25+ file chaos with this clean order:
```html
<!-- Bootstrap CSS (Foundation) -->
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet">

<!-- Universal Styles -->
<link rel="stylesheet" href="/shared_components/css/universal-header.css">
<link rel="stylesheet" href="/shared_components/css/universal-calculator-theme.css">

<!-- Base Quote Builder Styles -->
<link rel="stylesheet" href="/shared_components/css/embroidery-quote-builder.css">

<!-- Unified Step 1 Styles -->
<link rel="stylesheet" href="/shared_components/css/quote-builder-unified-step1.css">
<link rel="stylesheet" href="/shared_components/css/quote-builder-unified-step1-v2.css">

<!-- Embroidery Specific Overrides (NEW FILE) -->
<link rel="stylesheet" href="/shared_components/css/embroidery-quote-builder-modern.css?v=20251016">
<!-- OR for Cap -->
<link rel="stylesheet" href="/shared_components/css/cap-embroidery-quote-builder-modern.css?v=20251016">
```

---

### Pattern 2: Modern Toggle Switches (Step 1)

**DTG Source:** `dtg-quote-builder.css` lines 1-158

**Complete Toggle Switch System:**

```css
/* ============================================================================
   STEP 1: MODERN TOGGLE SWITCHES (DTG Pattern)
   ============================================================================ */

/* Toggle section container */
.toggle-section {
    background: white;
    padding: 24px;
    border-radius: 12px;
    border: 2px solid #e5e7eb;
    margin-bottom: 24px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.toggle-section-title {
    font-size: 1.125rem;
    font-weight: 700;
    color: #1f2937;
    margin-bottom: 16px;
    display: flex;
    align-items: center;
    gap: 12px;
    padding-bottom: 12px;
    border-bottom: 2px solid #e5e7eb;
}

.toggle-section-title i {
    color: #4cb354;
    font-size: 1.25rem;
}

/* Location grid - 2 COLUMNS (professional layout) */
.location-grid {
    display: grid !important;
    grid-template-columns: repeat(2, 1fr) !important;
    gap: 12px !important;
}

/* Mobile: Stack to 1 column */
@media (max-width: 768px) {
    .location-grid {
        grid-template-columns: 1fr !important;
    }
}

/* Toggle item - the clickable card */
.toggle-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border: 2px solid #e5e7eb;
    border-radius: 8px;
    background: white;
    cursor: pointer;
    transition: all 0.3s ease;
    position: relative;
}

.toggle-item:hover {
    border-color: #4cb354;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(76, 179, 84, 0.2);
}

.toggle-item.active {
    background: #e8f5e9;
    border-color: #4cb354;
    border-width: 3px;
    box-shadow: 0 4px 12px rgba(76, 179, 84, 0.3);
}

/* Toggle item label */
.toggle-item-label {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.toggle-item-label span:first-child {
    font-weight: 600;
    color: #1f2937;
    font-size: 0.95rem;
}

.toggle-item.active .toggle-item-label span:first-child {
    color: #4cb354;
}

.toggle-item-size {
    font-size: 0.8rem;
    color: #6b7280;
    font-weight: 500;
}

/* iOS-style toggle switch */
.toggle-switch {
    position: relative;
    width: 56px;
    height: 32px;
    background: #cbd5e0;
    border-radius: 16px;
    transition: background 0.3s ease;
    flex-shrink: 0;
}

.toggle-switch.on {
    background: #4cb354;
}

.toggle-switch-slider {
    position: absolute;
    top: 4px;
    left: 4px;
    width: 24px;
    height: 24px;
    background: white;
    border-radius: 50%;
    transition: transform 0.3s ease;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.toggle-switch.on .toggle-switch-slider {
    transform: translateX(24px);
}
```

**HTML Structure for Toggle Switches:**
```html
<section id="logo-phase" class="phase-section active">
    <div class="phase-header">
        <h2><span class="phase-number">1</span> Logo Setup</h2>
        <p>Select embroidery locations</p>
    </div>

    <div class="content-container">
        <div class="toggle-section">
            <div class="toggle-section-title">
                <i class="fas fa-map-marker-alt"></i>
                Embroidery Locations
            </div>

            <div class="location-grid">
                <!-- Left Chest Toggle -->
                <div class="toggle-item" id="toggle-LC" data-location="LC">
                    <div class="toggle-item-label">
                        <span>Left Chest</span>
                        <span class="toggle-item-size">4"×4"</span>
                    </div>
                    <div class="toggle-switch">
                        <div class="toggle-switch-slider"></div>
                    </div>
                </div>

                <!-- Right Chest Toggle -->
                <div class="toggle-item" id="toggle-RC" data-location="RC">
                    <div class="toggle-item-label">
                        <span>Right Chest</span>
                        <span class="toggle-item-size">4"×4"</span>
                    </div>
                    <div class="toggle-switch">
                        <div class="toggle-switch-slider"></div>
                    </div>
                </div>

                <!-- Full Front Toggle -->
                <div class="toggle-item" id="toggle-FF" data-location="FF">
                    <div class="toggle-item-label">
                        <span>Full Front</span>
                        <span class="toggle-item-size">12"×16"</span>
                    </div>
                    <div class="toggle-switch">
                        <div class="toggle-switch-slider"></div>
                    </div>
                </div>

                <!-- Full Back Toggle -->
                <div class="toggle-item" id="toggle-FB" data-location="FB">
                    <div class="toggle-item-label">
                        <span>Full Back</span>
                        <span class="toggle-item-size">12"×16"</span>
                    </div>
                    <div class="toggle-switch">
                        <div class="toggle-switch-slider"></div>
                    </div>
                </div>
            </div>
        </div>

        <div class="phase-actions">
            <button id="continue-to-products" class="btn btn-primary btn-lg" disabled>
                Continue to Products <i class="fas fa-arrow-right"></i>
            </button>
        </div>
    </div>
</section>
```

**JavaScript Integration (Already Exists - No Changes):**
The existing JavaScript already handles toggle clicks. The new CSS just makes it look modern like DTG.

---

### Pattern 3: Professional Color Swatch System (Step 2)

**DTG Source:** `dtg-quote-builder.css` lines 509-625

**THIS IS THE CRITICAL FIX FOR BROKEN STEP 2**

**Complete Color Swatch System:**

```css
/* ============================================================================
   STEP 2: COLOR SWATCH SYSTEM (DTG Pattern - FIXES BROKEN COLOR SELECTION)
   ============================================================================ */

/* Color selection container */
#color-selection-container {
    background: white;
    border: 2px solid #e5e7eb;
    border-radius: 12px;
    padding: 1.5rem;
    margin-top: 1.5rem;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

#color-selection-container h4 {
    margin: 0 0 1.25rem 0;
    font-size: 1.125rem;
    font-weight: 700;
    color: #1f2937;
    display: flex;
    align-items: center;
    gap: 10px;
}

#color-selection-container h4 i {
    color: #4cb354;
}

/* Color grid - optimized for many colors */
.color-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(65px, 1fr));
    gap: 0.5rem;
    max-width: 100%;
}

@media (max-width: 640px) {
    .color-grid {
        grid-template-columns: repeat(auto-fill, minmax(55px, 1fr));
        gap: 0.375rem;
    }
}

/* Color swatch card */
.color-swatch {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 0.5rem 0.375rem;
    border: 2px solid #e5e7eb;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
    background: white;
    position: relative;
}

.color-swatch:hover {
    border-color: #4cb354;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(76, 179, 84, 0.3);
}

.color-swatch.selected {
    border-color: #4cb354;
    border-width: 3px;
    background: #e8f5e9;
    box-shadow: 0 0 0 3px rgba(76, 179, 84, 0.2);
    padding: 0.5rem 0.3125rem; /* Adjust padding to compensate for thicker border */
}

/* Checkmark for selected swatch */
.color-swatch.selected::after {
    content: '\2713';
    position: absolute;
    top: 2px;
    right: 2px;
    background: #4cb354;
    color: white;
    border-radius: 50%;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: bold;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.color-swatch-image {
    width: 50px;
    height: 50px;
    border-radius: 6px;
    margin-bottom: 0.375rem;
    object-fit: cover;
    border: 1px solid #e5e7eb;
}

.color-swatch.selected .color-swatch-image {
    border-color: #4cb354;
}

.color-swatch-name {
    font-size: 0.7rem;
    text-align: center;
    line-height: 1.1;
    color: #374151;
    font-weight: 500;
    word-break: break-word;
    max-width: 100%;
}

.color-swatch.selected .color-swatch-name {
    color: #4cb354;
    font-weight: 700;
}

/* Color swatch loading state */
.color-grid.loading {
    opacity: 0.5;
    pointer-events: none;
}

/* Empty state */
.color-grid-empty {
    text-align: center;
    padding: 2rem;
    color: #6b7280;
    font-size: 0.95rem;
}

.color-grid-empty i {
    font-size: 2rem;
    margin-bottom: 0.5rem;
    display: block;
    color: #cbd5e0;
}
```

**HTML Structure for Color Swatches:**
```html
<div id="color-selection-container" style="display: none;">
    <h4>
        <i class="fas fa-palette"></i>
        Select Color
    </h4>
    <div id="color-swatches" class="color-grid">
        <!-- Populated dynamically by JavaScript -->
        <!-- Example swatch structure: -->
        <!--
        <div class="color-swatch" data-color-code="BLK" data-color-name="Black">
            <img src="[color-image-url]" alt="Black" class="color-swatch-image">
            <div class="color-swatch-name">Black</div>
        </div>
        -->
    </div>
</div>
```

**JavaScript Pattern (Already Exists - No Changes):**
The existing JavaScript populates `#color-swatches` with color data. The new CSS just makes them look professional and work correctly.

---

### Pattern 4: Single Container Step 3 Layout

**DTG Source:** `dtg-quote-builder.css` lines 1254-1633

**THIS FIXES THE "TWO PAGES" ISSUE**

**Step 3 CSS Variables (Self-Contained):**

```css
/* ============================================================================
   STEP 3: SINGLE CONTAINER LAYOUT (DTG Pattern - FIXES "TWO PAGES" ISSUE)
   ============================================================================ */

/* Embroidery-specific CSS variables */
.embroidery-quote-builder {
    --emb-primary: #4cb354;
    --emb-primary-dark: #409a47;
    --emb-primary-light: #5bc85f;
    --emb-white: #ffffff;
    --emb-gray-50: #f8f9fa;
    --emb-gray-100: #e5e7eb;
    --emb-gray-600: #6b7280;
    --emb-gray-900: #1f2937;
    --emb-red: #dc2626;
    --emb-green-50: #f0fdf4;
}

/* Apply to body for scope */
body.embroidery-quote-builder #review-phase {
    /* Variables available in this scope */
}
```

**Customer Information Section:**

```css
/* Customer Info Section */
.customer-info-section {
    background: var(--emb-white) !important;
    padding: 2rem !important;
    border-radius: 12px !important;
    margin-bottom: 2rem !important;
    border: 2px solid var(--emb-gray-100) !important;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08) !important;
}

.customer-info-section h3 {
    margin: 0 0 1.5rem 0 !important;
    font-size: 1.25rem !important;
    font-weight: 700 !important;
    color: var(--emb-gray-900) !important;
    position: relative !important;
    background: linear-gradient(135deg, var(--emb-gray-50) 0%, var(--emb-white) 100%) !important;
    border-radius: 8px !important;
    padding: 1rem 1rem 1rem 2rem !important;
}

.customer-info-section h3::before {
    content: '' !important;
    position: absolute !important;
    left: 0.5rem !important;
    top: 50% !important;
    transform: translateY(-50%) !important;
    width: 4px !important;
    height: 28px !important;
    background: linear-gradient(180deg, var(--emb-primary), var(--emb-primary-light)) !important;
    border-radius: 2px !important;
}

.customer-info-section .form-group {
    margin-bottom: 1.25rem !important;
}

.customer-info-section label {
    display: block !important;
    margin-bottom: 0.5rem !important;
    font-weight: 600 !important;
    color: var(--emb-gray-900) !important;
    font-size: 0.9rem !important;
}

.customer-info-section label .required {
    color: var(--emb-red) !important;
    margin-left: 0.25rem !important;
}

.customer-info-section input,
.customer-info-section select,
.customer-info-section textarea {
    width: 100% !important;
    padding: 0.75rem 1rem !important;
    border: 2px solid var(--emb-gray-100) !important;
    border-radius: 8px !important;
    font-size: 0.95rem !important;
    transition: all 0.2s ease !important;
    background: var(--emb-white) !important;
}

.customer-info-section input:focus,
.customer-info-section select:focus,
.customer-info-section textarea:focus {
    outline: none !important;
    border-color: var(--emb-primary) !important;
    box-shadow: 0 0 0 3px rgba(76, 179, 84, 0.1) !important;
}

.customer-info-section textarea {
    resize: vertical !important;
    min-height: 100px !important;
}
```

**Quote Summary Section:**

```css
/* Quote Summary Section - SINGLE UNIFIED CONTAINER */
.quote-summary-section {
    background: var(--emb-white) !important;
    padding: 2rem !important;
    border-radius: 12px !important;
    border: 2px solid var(--emb-gray-100) !important;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08) !important;
    margin-bottom: 2rem !important;
}

.quote-summary-section h3 {
    margin: 0 0 1.5rem 0 !important;
    font-size: 1.25rem !important;
    font-weight: 700 !important;
    color: var(--emb-gray-900) !important;
    position: relative !important;
    background: linear-gradient(135deg, var(--emb-gray-50) 0%, var(--emb-white) 100%) !important;
    border-radius: 8px !important;
    padding: 1rem 1rem 1rem 2rem !important;
}

.quote-summary-section h3::before {
    content: '' !important;
    position: absolute !important;
    left: 0.5rem !important;
    top: 50% !important;
    transform: translateY(-50%) !important;
    width: 4px !important;
    height: 28px !important;
    background: linear-gradient(180deg, var(--emb-primary), var(--emb-primary-light)) !important;
    border-radius: 2px !important;
}

/* Product Cards in Summary */
.product-summary-card {
    background: var(--emb-gray-50) !important;
    border: 2px solid var(--emb-gray-100) !important;
    border-radius: 10px !important;
    padding: 1.25rem !important;
    margin-bottom: 1rem !important;
}

.product-summary-card:last-child {
    margin-bottom: 0 !important;
}

.product-summary-header {
    display: flex !important;
    align-items: flex-start !important;
    gap: 1rem !important;
    margin-bottom: 1rem !important;
    padding-bottom: 1rem !important;
    border-bottom: 2px solid var(--emb-gray-100) !important;
}

.product-summary-image {
    width: 80px !important;
    height: 80px !important;
    border-radius: 8px !important;
    object-fit: cover !important;
    border: 2px solid var(--emb-gray-100) !important;
}

.product-summary-info {
    flex: 1 !important;
}

.product-summary-name {
    font-size: 1rem !important;
    font-weight: 700 !important;
    color: var(--emb-gray-900) !important;
    margin-bottom: 0.25rem !important;
}

.product-summary-meta {
    font-size: 0.875rem !important;
    color: var(--emb-gray-600) !important;
    display: flex !important;
    flex-wrap: wrap !important;
    gap: 1rem !important;
}

/* Location Badges */
.location-badge {
    display: inline-flex !important;
    align-items: center !important;
    gap: 0.5rem !important;
    padding: 0.5rem 1rem !important;
    background: var(--emb-green-50) !important;
    border: 2px solid var(--emb-primary) !important;
    border-radius: 8px !important;
    font-size: 0.875rem !important;
    font-weight: 700 !important;
    color: var(--emb-primary) !important;
    margin: 0.5rem 0.5rem 0.5rem 0 !important;
}

.location-badge i {
    font-size: 1rem !important;
}

/* Summary Totals */
.summary-totals {
    background: linear-gradient(135deg, var(--emb-green-50) 0%, var(--emb-white) 100%) !important;
    border: 2px solid var(--emb-primary) !important;
    border-radius: 12px !important;
    padding: 1.5rem !important;
    margin-top: 1.5rem !important;
}

.summary-row {
    display: flex !important;
    justify-content: space-between !important;
    align-items: center !important;
    padding: 0.75rem 0 !important;
    border-bottom: 1px solid var(--emb-gray-100) !important;
}

.summary-row:last-child {
    border-bottom: none !important;
    padding-top: 1rem !important;
    margin-top: 0.5rem !important;
    border-top: 2px solid var(--emb-primary) !important;
}

.summary-label {
    font-size: 0.95rem !important;
    color: var(--emb-gray-600) !important;
    font-weight: 600 !important;
}

.summary-value {
    font-size: 1rem !important;
    font-weight: 700 !important;
    color: var(--emb-gray-900) !important;
}

.summary-row:last-child .summary-label {
    font-size: 1.125rem !important;
    color: var(--emb-gray-900) !important;
}

.summary-row:last-child .summary-value {
    font-size: 1.75rem !important;
    color: var(--emb-primary) !important;
}
```

**HTML Structure for Step 3:**

```html
<section id="review-phase" class="phase-section" style="display: none;">
    <div class="phase-header">
        <h2><span class="phase-number">3</span> Review & Save Quote</h2>
        <p>Review your selections and provide customer information</p>
    </div>

    <div class="content-container">
        <!-- SINGLE QUOTE SUMMARY SECTION (No duplicate containers) -->
        <div class="quote-summary-section">
            <h3>Quote Summary</h3>

            <div id="quote-items-summary">
                <!-- Product cards populated by JavaScript -->
                <!-- Example structure:
                <div class="product-summary-card">
                    <div class="product-summary-header">
                        <img src="[product-image]" class="product-summary-image">
                        <div class="product-summary-info">
                            <div class="product-summary-name">Product Name</div>
                            <div class="product-summary-meta">
                                <span>Color: Black</span>
                                <span>Qty: 48</span>
                            </div>
                        </div>
                    </div>

                    <div class="location-badges">
                        <div class="location-badge">
                            <i class="fas fa-map-marker-alt"></i>
                            Left Chest
                        </div>
                    </div>
                </div>
                -->
            </div>

            <div class="summary-totals">
                <div class="summary-row">
                    <span class="summary-label">Subtotal</span>
                    <span class="summary-value" id="summary-subtotal">$0.00</span>
                </div>
                <div class="summary-row" id="ltm-fee-row" style="display: none;">
                    <span class="summary-label">LTM Fee</span>
                    <span class="summary-value" id="summary-ltm-fee">$0.00</span>
                </div>
                <div class="summary-row">
                    <span class="summary-label">Total</span>
                    <span class="summary-value" id="summary-total">$0.00</span>
                </div>
            </div>
        </div>

        <!-- CUSTOMER INFORMATION SECTION -->
        <div class="customer-info-section">
            <h3>Customer Information</h3>

            <div class="row">
                <div class="col-md-6">
                    <div class="form-group">
                        <label for="customer-name">
                            Customer Name <span class="required">*</span>
                        </label>
                        <input type="text" id="customer-name" required>
                    </div>
                </div>

                <div class="col-md-6">
                    <div class="form-group">
                        <label for="customer-email">
                            Email <span class="required">*</span>
                        </label>
                        <input type="email" id="customer-email" required>
                    </div>
                </div>
            </div>

            <div class="row">
                <div class="col-md-6">
                    <div class="form-group">
                        <label for="company-name">Company Name</label>
                        <input type="text" id="company-name">
                    </div>
                </div>

                <div class="col-md-6">
                    <div class="form-group">
                        <label for="customer-phone">Phone Number</label>
                        <input type="tel" id="customer-phone">
                    </div>
                </div>
            </div>

            <div class="form-group">
                <label for="sales-rep">
                    Sales Representative <span class="required">*</span>
                </label>
                <select id="sales-rep" required>
                    <option value="">Select a sales rep...</option>
                    <option value="sales@nwcustomapparel.com">General Sales</option>
                    <!-- More options populated from STAFF_DIRECTORY.md -->
                </select>
            </div>

            <div class="form-group">
                <label for="customer-notes">Additional Notes</label>
                <textarea id="customer-notes"></textarea>
            </div>
        </div>

        <!-- PHASE ACTIONS -->
        <div class="phase-actions">
            <button id="back-to-products" class="btn btn-secondary">
                <i class="fas fa-arrow-left"></i> Back
            </button>
            <button id="save-quote-btn" class="btn btn-success btn-lg">
                Save & Send Quote <i class="fas fa-check"></i>
            </button>
        </div>
    </div>
</section>
```

---

## File Structure Changes

### Current Structure (Embroidery Builders)

**Cap Embroidery Quote Builder:**
```
cap-embroidery-quote-builder.html
├── 25+ CSS files loaded
├── Multiple overlapping styles
├── No clear architecture
└── Causes "two pages" issue
```

**Regular Embroidery Quote Builder:**
```
embroidery-quote-builder.html
├── 25+ CSS files loaded
├── Inline CSS (lines 36-144) - CRITICAL
├── Multiple overlapping styles
└── Color swatches broken
```

### New Structure (After Refactor)

**Both Builders Will Use:**
```
[builder-name]-quote-builder.html
├── Bootstrap 5.1.3 (foundation)
├── Font Awesome 6.6.0 (icons)
├── universal-header.css (branding)
├── universal-calculator-theme.css (theme)
├── embroidery-quote-builder.css (base - existing)
├── quote-builder-unified-step1.css (modern Step 1)
├── quote-builder-unified-step1-v2.css (Step 1 enhancements)
└── [builder-name]-quote-builder-modern.css (NEW - DTG-inspired overrides)
```

### New Files to Create

1. **`/shared_components/css/embroidery-quote-builder-modern.css`**
   - Purpose: Modern overrides for regular embroidery builder
   - Contains: DTG-inspired patterns for all 3 steps
   - Priority: Highest (loads last)
   - Lines: ~800-1000 (comprehensive)

2. **`/shared_components/css/cap-embroidery-quote-builder-modern.css`**
   - Purpose: Modern overrides for cap embroidery builder
   - Contains: DTG-inspired patterns adapted for caps
   - Priority: Highest (loads last)
   - Lines: ~800-1000 (comprehensive)

### Files to Preserve (No Changes)

- ✅ All JavaScript files
- ✅ `embroidery-quote-builder.css` (base styles)
- ✅ `universal-header.css`
- ✅ `universal-calculator-theme.css`
- ✅ `quote-builder-unified-step1.css`
- ✅ `quote-builder-unified-step1-v2.css`
- ✅ All DTG files (model only)

### Files to Deprecate (Remove from HTML)

These files will NO LONGER be loaded:

```html
<!-- REMOVE THESE FROM CAP/EMBROIDERY BUILDERS -->
<link rel="stylesheet" href="/shared_components/css/phase3-modern-redesign.css">
<link rel="stylesheet" href="/shared_components/css/cap-quote-phase-overrides.css">
<link rel="stylesheet" href="/shared_components/css/quote-builder-step2-modern.css">
<link rel="stylesheet" href="/shared_components/css/quote-indicator-widget.css">
<link rel="stylesheet" href="/shared_components/css/toast-notifications.css">
<!-- And 15+ other conflicting files -->
```

**Why Remove:** These files created the CSS cascade conflicts. The new single comprehensive file replaces all of them with DTG's proven patterns.

---

## Implementation Roadmap

### Phase 1: Preparation (30 minutes)

**1.1 Backup Current State**
```bash
# Create backup branch
git checkout -b embroidery-refactor-backup
git add .
git commit -m "Backup: Pre-refactor state of embroidery builders"
git push origin embroidery-refactor-backup

# Create working branch
git checkout -b embroidery-refactor-dtg-inspired
```

**1.2 Document Current Inline CSS**
- Read `embroidery-quote-builder.html` lines 36-144
- Extract ALL inline CSS (color swatches, custom styles)
- Save to temporary file for migration

**1.3 Test Current Functionality**
- Test Step 1: Location selection
- Test Step 2: Product search, color selection
- Test Step 3: Quote save, email send
- Document any existing bugs

---

### Phase 2: Create New CSS Files (1 hour)

**2.1 Create `embroidery-quote-builder-modern.css`**

Template structure:
```css
/**
 * Embroidery Quote Builder - Modern DTG-Inspired Styles
 * Created: 2025-10-16
 * Purpose: Consolidate 25+ CSS files into DTG-proven patterns
 *
 * CRITICAL: This file loads LAST for highest priority
 * Model: DTG Quote Builder (working perfectly)
 *
 * Architecture:
 * - CSS Variables (self-contained)
 * - Step 1: Toggle switches
 * - Step 2: Color swatches (FIXES broken selection)
 * - Step 3: Single container (FIXES "two pages")
 */

/* ============================================================================
   CSS VARIABLES - EMBROIDERY THEME
   ============================================================================ */

.embroidery-quote-builder {
    /* Copy from DTG pattern */
}

/* ============================================================================
   STEP 1: MODERN TOGGLE SWITCHES
   ============================================================================ */

/* Copy lines 1-158 from dtg-quote-builder.css */
/* Adapt variable names: --dtg-* → --emb-* */

/* ============================================================================
   STEP 2: COLOR SWATCH SYSTEM
   ============================================================================ */

/* Copy lines 509-625 from dtg-quote-builder.css */
/* This FIXES the broken color selection */

/* ============================================================================
   STEP 3: SINGLE CONTAINER LAYOUT
   ============================================================================ */

/* Copy lines 1254-1633 from dtg-quote-builder.css */
/* This FIXES the "two pages" issue */

/* ============================================================================
   RESPONSIVE DESIGN
   ============================================================================ */

/* Mobile breakpoints matching DTG */
```

**2.2 Create `cap-embroidery-quote-builder-modern.css`**

Same structure as regular embroidery, but:
- Adapt location names (cap-specific positions)
- Adjust any cap-specific UI elements
- Keep all DTG patterns intact

---

### Phase 3: Update HTML Files (30 minutes)

**3.1 Update `cap-embroidery-quote-builder.html`**

**In `<head>` section:**

**BEFORE:**
```html
<!-- Current chaos: 25+ CSS files -->
<link rel="stylesheet" href="/shared_components/css/file1.css">
<link rel="stylesheet" href="/shared_components/css/file2.css">
<!-- ... 23 more files ... -->
```

**AFTER:**
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Cap Embroidery Quote Builder | Northwest Custom Apparel</title>

    <!-- NWCA Favicon -->
    <link rel="icon" type="image/png" href="https://cdn.caspio.com/A0E15000/Safety%20Stripes/NWCA%20Favicon%20for%20TEAMNWCA.com.png?ver=1">

    <!-- Font Awesome (MUST be before other CSS) -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.6.0/css/all.min.css">

    <!-- Font Awesome Fix -->
    <style>
    .fas, .far, .fab, .fa {
        font-family: "Font Awesome 6 Free", "Font Awesome 5 Free", FontAwesome !important;
        font-weight: 900 !important;
    }
    </style>

    <!-- Bootstrap CSS (Foundation layer) -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet">

    <!-- EmailJS SDK -->
    <script src="https://cdn.jsdelivr.net/npm/@emailjs/browser@3/dist/email.min.js"></script>

    <!-- Universal Styles (Layer 2) -->
    <link rel="stylesheet" href="/shared_components/css/universal-header.css">
    <link rel="stylesheet" href="/shared_components/css/universal-calculator-theme.css">

    <!-- Base Quote Builder Styles (Layer 3) -->
    <link rel="stylesheet" href="/shared_components/css/embroidery-quote-builder.css">

    <!-- Unified Step 1 Styles (Layer 4) -->
    <link rel="stylesheet" href="/shared_components/css/quote-builder-unified-step1.css">
    <link rel="stylesheet" href="/shared_components/css/quote-builder-unified-step1-v2.css">

    <!-- Cap Embroidery Specific Overrides (Layer 5 - HIGHEST PRIORITY) -->
    <link rel="stylesheet" href="/shared_components/css/cap-embroidery-quote-builder-modern.css?v=20251016">
</head>
<body class="cap-embroidery-quote-builder">
```

**Note:** Add `class="cap-embroidery-quote-builder"` to `<body>` for CSS variable scope.

**3.2 Update `embroidery-quote-builder.html`**

Same changes as cap builder:
- Clean CSS load order (8 files)
- Load `embroidery-quote-builder-modern.css` instead of cap version
- Add `class="embroidery-quote-builder"` to `<body>`
- Remove ALL inline CSS (migrate to external file)

---

### Phase 4: Testing & Validation (1 hour)

**4.1 Visual Regression Testing**

Compare before/after screenshots:
- Step 1: Toggle switches should look modern
- Step 2: Color swatches should be in grid, selectable
- Step 3: Single unified container (no double appearance)

**4.2 Functional Testing**

| Test | Expected Result | Pass/Fail |
|------|----------------|-----------|
| Step 1: Click toggle | Toggle animates, location selected | |
| Step 1: Continue button | Enables after selection | |
| Step 2: Product search | Products load correctly | |
| Step 2: Color swatch click | Color selects, checkmark appears | |
| Step 2: Multiple products | Each product shows in list | |
| Step 3: Customer form | All fields work | |
| Step 3: Quote save | Saves to database | |
| Step 3: Email send | Email received | |
| Responsive: Mobile | All steps work on mobile | |

**4.3 Performance Testing**

Measure CSS load time:
```javascript
// Console command
performance.getEntriesByType('resource')
    .filter(r => r.name.includes('.css'))
    .map(r => ({ file: r.name, duration: r.duration }))
```

**Before:** 25+ files, ~2-3 seconds total
**After:** 8 files, ~0.5-1 second total

---

### Phase 5: Deployment (30 minutes)

**5.1 Pre-Deployment Checklist**

- [ ] All tests passing
- [ ] No console errors
- [ ] CSS files minified (optional)
- [ ] Cache-busting version numbers updated
- [ ] Git commit with detailed message
- [ ] Backup branch created

**5.2 Deployment Steps**

```bash
# Commit changes
git add .
git commit -m "Refactor: Embroidery builders using DTG-inspired architecture

- Consolidated 25+ CSS files to 8 clean files
- Fixed Step 2 color swatches using DTG pattern
- Fixed Step 3 'two pages' issue with single container
- Adopted DTG's modern toggle switches for Step 1
- All JavaScript/API functionality preserved

Files Modified:
- cap-embroidery-quote-builder.html
- embroidery-quote-builder.html

Files Created:
- cap-embroidery-quote-builder-modern.css
- embroidery-quote-builder-modern.css

Testing: All features verified working"

# Push to remote
git push origin embroidery-refactor-dtg-inspired

# If server requires restart
# (Check with Erik - usually not needed for CSS changes)
```

**5.3 Post-Deployment Verification**

- [ ] Test on production URL
- [ ] Verify quote saves to database
- [ ] Verify email sends correctly
- [ ] Check mobile responsiveness
- [ ] Monitor for errors (24 hours)

---

## Before/After Comparisons

### Step 1: Location Selection

**BEFORE (Current State):**
```
┌─────────────────────────────────┐
│ Old Radio Button Style          │
│ ○ Left Chest (4×4)             │
│ ○ Right Chest (4×4)            │
│ ○ Full Front (12×16)           │
│ ○ Full Back (12×16)            │
│                                 │
│ [Continue Button]               │
└─────────────────────────────────┘
```

**AFTER (DTG-Inspired):**
```
┌────────────────────────────────────────────┐
│ 📍 Embroidery Locations                    │
├────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐       │
│  │ Left Chest   │  │ Right Chest  │       │
│  │ 4"×4"        │  │ 4"×4"        │       │
│  │          [○] │  │          [ ] │       │
│  └──────────────┘  └──────────────┘       │
│  ┌──────────────┐  ┌──────────────┐       │
│  │ Full Front   │  │ Full Back    │       │
│  │ 12"×16"      │  │ 12"×16"      │       │
│  │          [ ] │  │          [ ] │       │
│  └──────────────┘  └──────────────┘       │
│                                            │
│  [Continue to Products →]                  │
└────────────────────────────────────────────┘
```

**Key Improvements:**
✅ Professional 2-column grid
✅ iOS-style toggle switches
✅ Hover animations
✅ Green accent when active
✅ Section icon and title

---

### Step 2: Color Selection

**BEFORE (Broken State):**
```
[Swatches overlapping, no structure, selection doesn't work]
```

**AFTER (DTG-Fixed):**
```
┌──────────────────────────────────────────────────┐
│ 🎨 Select Color                                  │
├──────────────────────────────────────────────────┤
│  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐  ┌───┐ │
│  │ ✓    │  │      │  │      │  │      │  │   │ │
│  │[IMG] │  │[IMG] │  │[IMG] │  │[IMG] │  │...│ │
│  │Black │  │White │  │Navy  │  │Red   │  │   │ │
│  └──────┘  └──────┘  └──────┘  └──────┘  └───┘ │
│  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐        │
│  │      │  │      │  │      │  │      │        │
│  │[IMG] │  │[IMG] │  │[IMG] │  │[IMG] │        │
│  │Green │  │Blue  │  │Pink  │  │Gray  │        │
│  └──────┘  └──────┘  └──────┘  └──────┘        │
└──────────────────────────────────────────────────┘
```

**Key Improvements:**
✅ Responsive grid layout
✅ Hover effect (lifts up)
✅ Selected state (green border, checkmark)
✅ Color name below swatch
✅ Professional spacing
✅ **WORKS CORRECTLY** (critical fix)

---

### Step 3: Quote Summary

**BEFORE (Two Pages Issue):**
```
┌────────────────────────────────┐
│ Quote Summary                  │ ← Container 1
│ Product: PC54 Black            │
│ Qty: 48                        │
└────────────────────────────────┘
┌────────────────────────────────┐
│ Quote Summary                  │ ← Container 2 (DUPLICATE!)
│ Product: PC54 Black            │
│ Qty: 48                        │
└────────────────────────────────┘
[Customer Info Form]
```

**AFTER (Single Container - DTG Pattern):**
```
┌───────────────────────────────────────────────────────┐
│ ━━ Quote Summary                                      │
│ ┌─────────────────────────────────────────────────┐  │
│ │ [IMG] PC54 Black                                │  │
│ │       Color: Black  •  Qty: 48                  │  │
│ │                                                  │  │
│ │ 📍 Left Chest                                   │  │
│ └─────────────────────────────────────────────────┘  │
│                                                       │
│ Subtotal:               $500.00                       │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━    │
│ Total:                  $500.00                       │
└───────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────┐
│ ━━ Customer Information                               │
│ [Customer Name]          [Email]                      │
│ [Company]                [Phone]                      │
│ [Sales Rep]                                           │
│ [Notes]                                               │
│                                                       │
│ [← Back]              [Save & Send Quote →]           │
└───────────────────────────────────────────────────────┘
```

**Key Improvements:**
✅ SINGLE unified container
✅ Professional product cards
✅ Green accent bars
✅ Location badges with icons
✅ Clean totals display
✅ **NO "two pages" appearance** (critical fix)

---

## Testing Strategy

### Unit Tests (Component-Level)

**Test 1: Toggle Switch Animation**
```javascript
// Console command
const toggle = document.querySelector('#toggle-LC');
toggle.click();
console.log('Active class:', toggle.classList.contains('active'));
console.log('Switch on:', toggle.querySelector('.toggle-switch').classList.contains('on'));
// Expected: Both should be true
```

**Test 2: Color Swatch Selection**
```javascript
// Console command
const swatch = document.querySelector('.color-swatch');
swatch.click();
console.log('Selected class:', swatch.classList.contains('selected'));
console.log('Checkmark visible:', window.getComputedStyle(swatch, '::after').content);
// Expected: selected class true, checkmark visible
```

**Test 3: Step 3 Container Count**
```javascript
// Console command
const containers = document.querySelectorAll('.quote-summary-section');
console.log('Container count:', containers.length);
// Expected: Should be 1 (not 2!)
```

---

### Integration Tests (Full Flow)

**Test Flow 1: Complete Quote Creation**

1. **Step 1:**
   - [ ] Click "Left Chest" toggle → Animates to ON
   - [ ] Click "Full Back" toggle → Animates to ON
   - [ ] "Continue" button enables
   - [ ] Click "Continue" → Step 2 appears

2. **Step 2:**
   - [ ] Search for "PC54" → Products load
   - [ ] Click product → Color swatches appear
   - [ ] Click "Black" swatch → Checkmark appears, green border
   - [ ] Enter quantity 48
   - [ ] Click "Add Product" → Product appears in list
   - [ ] Click "Continue to Review" → Step 3 appears

3. **Step 3:**
   - [ ] Quote summary shows 1 product card (not 2!)
   - [ ] Locations show: "Left Chest" and "Full Back" badges
   - [ ] Fill customer form → All fields work
   - [ ] Click "Save & Send Quote" → Success modal appears
   - [ ] Check database → Quote saved with correct ID
   - [ ] Check email → Email received with quote details

---

### Regression Tests (Ensure Nothing Broke)

| Feature | Test | Expected | Status |
|---------|------|----------|--------|
| Product Search | Type "PC54" in search | Products load | |
| API Calls | Network tab, check endpoints | All 200 OK | |
| JavaScript | Console for errors | No errors | |
| EmailJS | Quote sends email | Email received | |
| Database | Check Caspio tables | Quote saved | |
| Quote ID | Generated ID format | EMB1016-1 format | |
| Mobile | Resize to 375px width | All steps work | |
| Tablet | Resize to 768px width | 2-column grid maintained | |

---

### Performance Tests

**Metric 1: CSS Load Time**
```javascript
// Console command
const cssFiles = performance.getEntriesByType('resource')
    .filter(r => r.name.includes('.css'));
console.table(cssFiles.map(f => ({
    file: f.name.split('/').pop(),
    duration: f.duration + 'ms'
})));
```

**Expected Improvement:**
- Before: 25+ files, ~2000-3000ms total
- After: 8 files, ~500-1000ms total
- **Target: 50-70% faster CSS load**

**Metric 2: Page Size**
```javascript
// Console command
const totalSize = performance.getEntriesByType('resource')
    .reduce((sum, r) => sum + r.transferSize, 0);
console.log('Total page size:', (totalSize / 1024).toFixed(2), 'KB');
```

**Expected Improvement:**
- Before: ~800-1000 KB (redundant CSS)
- After: ~500-700 KB (consolidated CSS)
- **Target: 20-30% smaller page size**

---

### Browser Compatibility Tests

| Browser | Version | Step 1 | Step 2 | Step 3 | Notes |
|---------|---------|--------|--------|--------|-------|
| Chrome | Latest | | | | Primary development |
| Firefox | Latest | | | | Toggle switch compatibility |
| Safari | Latest | | | | CSS grid, color swatches |
| Edge | Latest | | | | Bootstrap compatibility |
| Mobile Safari | iOS 15+ | | | | Touch interactions |
| Mobile Chrome | Android 10+ | | | | Responsive layout |

**Critical Compatibility Notes:**
- Toggle switches use modern CSS (grid, flexbox)
- Color swatches use `::after` pseudo-element (all modern browsers)
- CSS variables used extensively (IE11 not supported - acceptable)

---

## Preservation Checklist

This section ensures NO functionality is lost during refactor.

### JavaScript Files (Zero Changes)

- [ ] `cap-quote-builder.js` - Untouched
- [ ] `embroidery-quote-builder.js` - Untouched
- [ ] `quote-builder-base.js` - Untouched
- [ ] `quote-formatter.js` - Untouched
- [ ] `quote-persistence.js` - Untouched
- [ ] `quote-session.js` - Untouched
- [ ] `quote-validation.js` - Untouched
- [ ] `quote-ui-feedback.js` - Untouched
- [ ] `toast-notifications.js` - Untouched
- [ ] `quote-indicator-manager.js` - Untouched

**Verification Command:**
```bash
# No JavaScript files should be modified
git status | grep ".js"
# Should return: nothing modified
```

---

### API Endpoints (Zero Changes)

- [ ] Product search: `/api/products/search`
- [ ] Pricing bundle: `/api/pricing-bundle?method=EMB`
- [ ] Quote session save: `/api/quote_sessions`
- [ ] Quote items save: `/api/quote_items`
- [ ] Product details: `/api/products/:id`

**Verification:**
```javascript
// Console commands to test each endpoint
await fetch('https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/products/search?q=PC54')
    .then(r => r.json())
    .then(d => console.log('Search works:', d.length > 0));

await fetch('https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/pricing-bundle?method=EMB&styleNumber=PC54')
    .then(r => r.json())
    .then(d => console.log('Pricing works:', !!d.tiersR));
```

---

### EmailJS Configuration (Zero Changes)

- [ ] Service ID: `service_1c4k67j`
- [ ] Public Key: `4qSbDO-SQs19TbP80`
- [ ] Template ID: (specific to each builder)
- [ ] Email variables: All preserved

**Verification:**
Check that email sends after quote save with all expected fields populated.

---

### Database Schema (Zero Changes)

**quote_sessions table:**
- [ ] QuoteID format: `EMB[MMDD]-[seq]`
- [ ] All fields populated correctly
- [ ] SessionID generated properly

**quote_items table:**
- [ ] LineNumber sequential
- [ ] ProductName, StyleNumber, Color all saved
- [ ] Quantity, prices all correct
- [ ] SizeBreakdown JSON valid

**Verification:**
After test quote, check Caspio tables directly for data integrity.

---

### Functionality Matrix

| Feature | Before Refactor | After Refactor | Preserved? |
|---------|----------------|----------------|------------|
| Toggle location selection | ✅ Works | ✅ Should work | ✓ |
| Product search | ✅ Works | ✅ Should work | ✓ |
| Color swatch selection | ❌ Broken | ✅ Should fix | Improved |
| Add multiple products | ✅ Works | ✅ Should work | ✓ |
| Quantity input | ✅ Works | ✅ Should work | ✓ |
| Price calculation | ✅ Works | ✅ Should work | ✓ |
| LTM fee display | ✅ Works | ✅ Should work | ✓ |
| Customer form validation | ✅ Works | ✅ Should work | ✓ |
| Quote save to database | ✅ Works | ✅ Should work | ✓ |
| Email send | ✅ Works | ✅ Should work | ✓ |
| Mobile responsiveness | ⚠️ Partial | ✅ Should improve | Improved |

---

## Rollback Plan

In case anything goes wrong, here's the step-by-step rollback process.

### Immediate Rollback (< 5 minutes)

**If Critical Issue Discovered:**

```bash
# 1. Switch to backup branch
git checkout embroidery-refactor-backup

# 2. Force push to revert production
git push origin embroidery-refactor-backup:main --force

# 3. Clear browser caches (instruct users)
# Press Ctrl+Shift+Delete → Clear cached images and files
```

---

### Partial Rollback (Specific File)

**If Only One Builder Has Issues:**

```bash
# Rollback just cap builder
git checkout embroidery-refactor-backup -- quote-builders/cap-embroidery-quote-builder.html
git checkout embroidery-refactor-backup -- shared_components/css/cap-embroidery-quote-builder-modern.css
git commit -m "Rollback: Cap builder only"
git push origin embroidery-refactor-dtg-inspired

# Regular embroidery builder remains updated
```

---

### Troubleshooting Common Issues

**Issue 1: Color Swatches Still Broken**

**Diagnosis:**
```javascript
// Check if color swatch CSS loaded
const swatchCSS = Array.from(document.styleSheets)
    .find(s => s.href?.includes('embroidery-quote-builder-modern.css'));
console.log('Swatch CSS loaded:', !!swatchCSS);

// Check if swatches have correct classes
const swatches = document.querySelectorAll('.color-swatch');
console.log('Swatch count:', swatches.length);
console.log('First swatch classes:', swatches[0]?.className);
```

**Fix:**
- Verify CSS file path is correct
- Check for typos in class names
- Ensure cache-busting version number updated
- Hard refresh browser (Ctrl+Shift+R)

---

**Issue 2: "Two Pages" Still Appears**

**Diagnosis:**
```javascript
// Check container count
const containers = document.querySelectorAll('.quote-summary-section');
console.log('Container count (should be 1):', containers.length);

// Check for conflicting CSS
const conflictingCSS = Array.from(document.styleSheets)
    .filter(s => s.href?.includes('phase3-modern-redesign') ||
                 s.href?.includes('cap-quote-phase-overrides'));
console.log('Conflicting CSS files:', conflictingCSS.length);
```

**Fix:**
- Ensure old CSS files removed from HTML
- Check that new CSS has `!important` on critical rules
- Verify body has correct class: `class="embroidery-quote-builder"`
- Check JavaScript isn't duplicating containers

---

**Issue 3: JavaScript Not Working**

**Diagnosis:**
```javascript
// Check for JavaScript errors
console.log('JavaScript errors:',
    window.onerror ? 'Errors present - check console' : 'No errors');

// Check if main objects exist
console.log('Quote builder object:',
    typeof window.embroideryQuoteBuilder !== 'undefined');
console.log('Quote service object:',
    typeof window.embroideryQuoteService !== 'undefined');
```

**Fix:**
- This shouldn't happen (JavaScript not changed)
- If it does, check for accidental HTML structure changes
- Verify all `<script>` tags still present
- Check browser console for specific errors

---

### Emergency Contacts

**If Issues Persist:**

1. **Check Documentation:**
   - This file (EMBROIDERY_QUOTE_REFACTOR_PLAN.md)
   - DTG builder (working reference)
   - Git commit history

2. **Revert Strategy:**
   - Use backup branch (guaranteed working state)
   - Test on staging first before production deploy
   - Have Erik verify before going live

3. **Post-Rollback:**
   - Document what went wrong
   - Update this plan with lessons learned
   - Test fix on development branch before retry

---

## Success Metrics

How we'll know the refactor succeeded:

### Objective Metrics

✅ **CSS File Count:** 25+ → 8 files (68% reduction)
✅ **Page Load Time:** 2-3s → 0.5-1s CSS load (50-70% faster)
✅ **Page Size:** 800-1000 KB → 500-700 KB (20-30% smaller)
✅ **Step 2 Color Swatches:** Broken → Working (100% fixed)
✅ **Step 3 Containers:** 2 → 1 (100% fixed)
✅ **JavaScript Errors:** 0 before, 0 after (preserved)
✅ **API Calls:** All working before, all working after (preserved)

### Subjective Metrics

✅ **Professional Appearance:** Matches DTG's polished look
✅ **User Experience:** Smooth, modern interactions
✅ **Mobile Responsiveness:** Works on all screen sizes
✅ **Maintenance:** Single CSS file per builder (much easier)
✅ **Consistency:** Both builders look and feel the same

### User Acceptance

- [ ] Erik tests and approves
- [ ] Sales team tests quote creation flow
- [ ] No customer complaints about broken functionality
- [ ] Positive feedback on improved appearance

---

## Implementation Timeline

**Total Estimated Time: 3.5 hours**

| Phase | Duration | Activities |
|-------|----------|-----------|
| **Phase 1: Preparation** | 30 min | Backup, document inline CSS, test current state |
| **Phase 2: Create CSS Files** | 1 hour | Build embroidery-quote-builder-modern.css + cap version |
| **Phase 3: Update HTML** | 30 min | Update both HTML files with clean CSS load order |
| **Phase 4: Testing** | 1 hour | Visual, functional, performance tests |
| **Phase 5: Deployment** | 30 min | Git commit, push, verify production |

**Recommended Schedule:**
- **Day 1 Morning:** Phases 1-2 (preparation + CSS creation)
- **Day 1 Afternoon:** Phase 3 (HTML updates)
- **Day 2 Morning:** Phase 4 (comprehensive testing)
- **Day 2 Afternoon:** Phase 5 (deployment + monitoring)

---

## Conclusion

This refactor consolidates 25+ chaotic CSS files into a clean, DTG-inspired architecture that:

1. **Fixes Critical Bugs:**
   - ✅ Step 2 color swatches work correctly
   - ✅ Step 3 shows single unified container (no "two pages")

2. **Improves User Experience:**
   - ✅ Modern toggle switches (like DTG)
   - ✅ Professional appearance throughout
   - ✅ Consistent with DTG's proven design

3. **Improves Maintainability:**
   - ✅ Clear CSS architecture (8 files vs 25+)
   - ✅ Single source of truth per builder
   - ✅ Easy to understand and modify

4. **Preserves Functionality:**
   - ✅ Zero JavaScript changes
   - ✅ All APIs continue working
   - ✅ Database schema unchanged
   - ✅ EmailJS configuration intact

**By following this plan exactly, we'll achieve a successful refactor with minimal risk and maximum benefit.**

---

**Document Version:** 1.0
**Last Updated:** 2025-10-16
**Author:** Claude (with Erik's guidance)
**Status:** Ready for Implementation
**Approved By:** [Pending Erik's review]

---

## Appendix A: DTG Reference Locations

Quick reference for finding DTG patterns:

- **Toggle Switches:** `dtg-quote-builder.css` lines 1-158
- **Color Swatches:** `dtg-quote-builder.css` lines 509-625
- **CSS Variables:** `dtg-quote-builder.css` lines 1254-1266
- **Customer Info Section:** `dtg-quote-builder.css` lines 1268-1383
- **Quote Summary Section:** `dtg-quote-builder.css` lines 1393-1633
- **HTML Structure:** `dtg-quote-builder.html` lines 1-300

## Appendix B: Command Reference

### Git Commands
```bash
# Create backup
git checkout -b embroidery-refactor-backup
git add .
git commit -m "Backup: Pre-refactor state"

# Create working branch
git checkout -b embroidery-refactor-dtg-inspired

# Rollback if needed
git checkout embroidery-refactor-backup
git push origin embroidery-refactor-backup:main --force
```

### Testing Commands
```javascript
// Check CSS loaded
Array.from(document.styleSheets).map(s => s.href)

// Check containers
document.querySelectorAll('.quote-summary-section').length

// Check JavaScript objects
window.embroideryQuoteBuilder
window.embroideryQuoteService

// Test API
await fetch('https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/products/search?q=PC54')
```

---

**END OF DOCUMENT**

**Ready to proceed with implementation? ✓**
