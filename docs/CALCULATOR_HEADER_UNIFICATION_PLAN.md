# Calculator Header Unification Plan

**Created:** 2025-01-10
**Purpose:** Establish a consistent, modern header design across all pricing calculators
**Affected Pages:** Embroidery, Cap Embroidery, DTG, Screen Print, DTF

---

## Executive Summary

After analyzing all five calculator pages, I've identified **three distinct header patterns** currently in use:

1. **Simple Header** (Embroidery, DTG, Screen Print) - Minimal design with breadcrumb + search
2. **Enhanced Header** (DTF) - Three-tier design with contact bar, logo, and context bar
3. **Logo-Only Header** (Cap Embroidery Manual) - Basic logo without search functionality

**Recommendation:** Adopt the **Enhanced Header (DTF-style)** as the universal standard with improvements.

---

## Current State Analysis

### 1. Embroidery Pricing (`embroidery-pricing.html`)
**Header Type:** Simple Header
**Structure:**
```html
<header class="header">
    <div class="header-content">
        <nav class="breadcrumb">
            <a href="/">Home</a> /
            <a href="/product.html">Products</a> /
            <span>Embroidery Pricing</span>
        </nav>
        <div class="search-wrapper">
            <input class="search-input" placeholder="Search by style number or name...">
            <button class="search-btn"><i class="fas fa-search"></i></button>
        </div>
    </div>
</header>
```

**Pros:**
- Clean and minimal
- Good breadcrumb navigation
- Search functionality present
- White background for autocomplete dropdown ✅

**Cons:**
- No company logo/branding
- No contact information
- No clear page identifier (relies on breadcrumb only)
- Header doesn't feel substantial enough for a professional B2B tool

**Page Identifier:** Only in breadcrumb (not prominent)

---

### 2. DTG Pricing (`dtg-pricing.html`)
**Header Type:** Simple Header (identical to Embroidery)
**Structure:** Same as Embroidery

**Pros/Cons:** Identical to Embroidery
**Page Identifier:** Only in breadcrumb (not prominent)

**Notable Features:**
- Product badge below header says "DTG"
- Uses white background for search results ✅

---

### 3. Screen Print Pricing (`screen-print-pricing.html`)
**Header Type:** Simple Header with enhanced accessibility
**Structure:** Same as Embroidery/DTG but with ARIA labels

**Pros:**
- All benefits of simple header
- Enhanced accessibility with ARIA attributes
- White background for search results ✅

**Cons:**
- Same limitations as Embroidery/DTG

**Page Identifier:** Only in breadcrumb (not prominent)

**Additional Notes:**
- Most accessibility-friendly implementation
- aria-label, role, aria-controls attributes present

---

### 4. DTF Pricing (`dtf-pricing.html`)
**Header Type:** Enhanced Three-Tier Header ⭐ **BEST IMPLEMENTATION**
**Structure:**
```html
<header class="enhanced-pricing-header">
    <!-- Tier 1: Contact Bar -->
    <div class="header-contact-bar">
        <div class="contact-bar-content">
            <div class="contact-info">
                <div class="contact-item">
                    <i class="fas fa-phone"></i>
                    <a href="tel:253-922-5793">253-922-5793</a>
                </div>
                <div class="contact-item">
                    <i class="fas fa-envelope"></i>
                    <a href="mailto:sales@nwcustomapparel.com">sales@nwcustomapparel.com</a>
                </div>
            </div>
            <div class="business-hours">
                <i class="fas fa-clock"></i>
                Monday - Friday: 8:30 AM - 5:00 PM PST
            </div>
        </div>
    </div>

    <!-- Tier 2: Logo/Navigation -->
    <div class="header-nav">
        <div class="nav-content">
            <div class="logo-section">
                <a href="/" class="logo-link">
                    <img src="[NWCA Logo]" alt="Northwest Custom Apparel" class="logo-image">
                </a>
            </div>
        </div>
    </div>

    <!-- Tier 3: Pricing Context Bar -->
    <div class="pricing-context-bar">
        <div class="context-bar-content">
            <div class="context-left">
                <nav class="breadcrumb">
                    <a href="/">Home</a> /
                    <a href="/product.html">Products</a> /
                    <span>DTF Pricing</span>
                </nav>
            </div>
            <div class="search-wrapper">
                <input class="search-input" placeholder="Search by style number or name...">
                <button class="search-btn"><i class="fas fa-search"></i></button>
            </div>
        </div>
    </div>
</header>
```

**Pros:** ✅✅✅
- Professional, complete header with all business information
- Prominent company branding with logo
- Contact information always visible (builds trust)
- Business hours displayed
- Clear visual hierarchy (three distinct tiers)
- Search functionality maintained
- Fixed/sticky header keeps info accessible while scrolling
- Most modern, 2025-appropriate design

**Cons:**
- Takes more vertical space (~180px vs ~60px)
- More complex CSS required
- **CRITICAL ISSUE:** Green background on autocomplete ❌

**Page Identifier:** In breadcrumb (could be more prominent)

---

### 5. Cap Embroidery Manual (`cap-embroidery-manual-pricing.html`)
**Header Type:** Logo-Only Header (Staff Tool)
**Structure:**
```html
<header class="header">
    <div class="header-content">
        <img src="[NWCA Logo]" alt="Northwest Custom Apparel" class="logo">
        <span class="company-name">Northwest Custom Apparel</span>
    </div>
</header>

<!-- Separate calculator header below -->
<div class="calculator-header">
    <div class="breadcrumb">
        <a href="/staff-dashboard.html">Staff Dashboard</a> /
        <span>Manual Calculators</span> /
        <span>Cap Embroidery Pricing</span>
    </div>
    <h1><i class="fas fa-hat-cowboy"></i> Manual Cap Embroidery Pricing Calculator</h1>
</div>
```

**Pros:**
- Clear page title with icon
- Simple and focused (staff tool, not public-facing)

**Cons:**
- No search functionality
- No contact info
- Different pattern from public calculators
- Not suitable for customer-facing tools

**Page Identifier:** Clear H1 title with icon ✅ (but below header)

**Note:** This is a staff tool, so different standards may apply

---

## Autocomplete Background Issue Analysis

### Problem Statement
DTF and Screen Print calculators show **green background** on autocomplete dropdown, making it hard to see product details. Other calculators show **white background** which is much better for readability.

### Root Cause
Looking at the CSS:

**DTF (Green Background - PROBLEM):**
```css
.search-result-item:hover {
    background-color: #f9fafb;  /* Light gray on hover only */
}
/* No base background color specified = inherits green */
```

**DTG/Embroidery (White Background - CORRECT):**
```css
.search-results {
    background: white;  /* Explicitly white container */
    border: 1px solid var(--border-color);
}

.search-result-item:hover {
    background: var(--primary-light);  /* Green only on hover */
}
```

### Solution
Ensure `.search-results` container has explicit `background: white` and individual items have `background: transparent` or `background: white` by default.

---

## Recommended Universal Header Design

### Design Choice: Enhanced Three-Tier Header (DTF-style) with Improvements

**Why This Design:**
1. **Professional & Modern** - Looks like 2025, not 2005
2. **Complete Business Info** - Phone, email, hours always visible (builds credibility)
3. **Strong Branding** - Logo prominently displayed
4. **Functional** - Breadcrumbs + search in dedicated space
5. **Scalable** - Room for future additions (cart icon, user menu, etc.)
6. **Mobile-Friendly** - Can collapse/stack on smaller screens

### Proposed Improvements to DTF Header

#### Improvement #1: Add Prominent Page Identifier
**Current:** Page type only shown in breadcrumb
**Proposed:** Add calculator type badge next to breadcrumb

```html
<div class="pricing-context-bar">
    <div class="context-bar-content">
        <div class="context-left">
            <nav class="breadcrumb">
                <a href="/">Home</a> /
                <a href="/product.html">Products</a> /
                <span>DTG Pricing</span>
            </nav>
            <!-- NEW: Calculator Badge -->
            <div class="calculator-type-badge">
                <i class="fas fa-tshirt"></i>
                <span>DTG Pricing Calculator</span>
            </div>
        </div>
        <div class="search-wrapper">
            ...
        </div>
    </div>
</div>
```

**Visual:** Badge with icon + text, green background, white text, slightly elevated

#### Improvement #2: Fix Autocomplete Background
Ensure all search dropdowns have white background:

```css
.search-results {
    background: white !important;  /* Force white background */
    border: 1px solid var(--border-color);
    border-radius: 8px;
    box-shadow: var(--shadow-md);
}

.search-result-item {
    background: transparent;  /* Default transparent */
    padding: 10px 12px;
    cursor: pointer;
    border-bottom: 1px solid #f3f4f6;
}

.search-result-item:hover {
    background-color: #f9fafb;  /* Light gray hover, NOT green */
}
```

#### Improvement #3: Add Calculator Icon to Each Page
Unique icon for each calculator type in the badge:

- **DTG:** `<i class="fas fa-tshirt"></i>`
- **DTF:** `<i class="fas fa-file-image"></i>`
- **Screen Print:** `<i class="fas fa-print"></i>`
- **Embroidery:** `<i class="fas fa-sewing-machine"></i>`
- **Cap Embroidery:** `<i class="fas fa-hat-cowboy"></i>`

#### Improvement #4: Enhance Mobile Responsiveness
Add media queries to stack header elements on mobile:

```css
@media (max-width: 768px) {
    .contact-bar-content {
        flex-direction: column;
        text-align: center;
        gap: 10px;
    }

    .contact-info {
        flex-direction: column;
        gap: 10px;
    }

    .context-bar-content {
        flex-direction: column;
        gap: 15px;
    }

    .calculator-type-badge {
        width: 100%;
        justify-content: center;
    }
}
```

---

## Proposed Universal Header Template

### HTML Structure
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>[METHOD] Pricing | Northwest Custom Apparel</title>

    <!-- Favicon -->
    <link rel="icon" type="image/png" href="https://cdn.caspio.com/A0E15000/Safety%20Stripes/NWCA%20Favicon%20for%20TEAMNWCA.com.png?ver=1">

    <!-- Font Awesome -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">

    <!-- Google Fonts -->
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Poppins:wght@600;700&display=swap" rel="stylesheet">

    <!-- Universal Pricing Header CSS -->
    <link rel="stylesheet" href="/shared_components/css/universal-pricing-header.css?v=20250110">

    <!-- Other CSS files... -->

    <style>
        /* Page-specific overrides if needed */
    </style>
</head>
<body class="[method]-pricing-page">

    <!-- ========================================
         UNIVERSAL PRICING CALCULATOR HEADER
         ======================================== -->
    <header class="enhanced-pricing-header">

        <!-- TIER 1: Contact Bar -->
        <div class="header-contact-bar">
            <div class="contact-bar-content">
                <div class="contact-info">
                    <div class="contact-item">
                        <i class="fas fa-phone"></i>
                        <a href="tel:253-922-5793" class="contact-link">253-922-5793</a>
                    </div>
                    <div class="contact-item">
                        <i class="fas fa-envelope"></i>
                        <a href="mailto:sales@nwcustomapparel.com" class="contact-link">sales@nwcustomapparel.com</a>
                    </div>
                </div>
                <div class="business-hours">
                    <i class="fas fa-clock"></i>
                    Monday - Friday: 8:30 AM - 5:00 PM PST
                </div>
            </div>
        </div>

        <!-- TIER 2: Logo/Navigation Bar -->
        <div class="header-nav">
            <div class="nav-content">
                <div class="logo-section">
                    <a href="/" class="logo-link">
                        <img src="https://cdn.caspio.com/A0E15000/Safety%20Stripes/web%20northwest%20custom%20apparel%20logo.png?ver=1"
                             alt="Northwest Custom Apparel"
                             class="logo-image">
                    </a>
                </div>
            </div>
        </div>

        <!-- TIER 3: Pricing Context Bar with Breadcrumb + Calculator Badge + Search -->
        <div class="pricing-context-bar">
            <div class="context-bar-content">
                <div class="context-left">
                    <!-- Breadcrumb Navigation -->
                    <nav class="breadcrumb" aria-label="Breadcrumb">
                        <a href="/">Home</a>
                        <span class="breadcrumb-separator">/</span>
                        <a href="/product.html" id="products-breadcrumb">Products</a>
                        <span class="breadcrumb-separator">/</span>
                        <span class="breadcrumb-current">[Method] Pricing</span>
                    </nav>

                    <!-- NEW: Calculator Type Badge -->
                    <div class="calculator-type-badge">
                        <i class="fas fa-[icon]"></i>
                        <span class="badge-text">[Method] Pricing Calculator</span>
                    </div>
                </div>

                <!-- Product Search -->
                <div class="search-wrapper">
                    <input
                        type="text"
                        class="search-input"
                        id="styleSearch"
                        placeholder="Search by style number or name..."
                        autocomplete="off"
                        aria-label="Search for product by style number or name"
                        aria-describedby="search-results-live"
                        role="combobox"
                        aria-expanded="false"
                        aria-controls="searchResults"
                    >
                    <button class="search-btn" id="searchBtn" aria-label="Search for products">
                        <i class="fas fa-search" aria-hidden="true"></i>
                    </button>

                    <!-- Search Results Dropdown -->
                    <div class="search-results"
                         id="searchResults"
                         role="listbox"
                         aria-label="Product search results">
                        <!-- Results populated by JavaScript -->
                    </div>

                    <!-- Live region for screen readers -->
                    <div id="search-results-live" class="sr-only" role="status" aria-live="polite" aria-atomic="true"></div>
                </div>
            </div>
        </div>

    </header>

    <!-- Main Content -->
    <div class="main-container">
        <!-- Calculator content here -->
    </div>

    <!-- JavaScript -->
    <script src="/shared_components/js/universal-header-search.js?v=20250110"></script>
</body>
</html>
```

---

## CSS Implementation

### File: `/shared_components/css/universal-pricing-header.css`

```css
/**
 * UNIVERSAL PRICING HEADER
 * Consistent header design for all pricing calculators
 * Version: 1.0
 * Created: 2025-01-10
 */

/* ==========================================
   CSS VARIABLES
   ========================================== */
:root {
    --primary-color: #4cb354;  /* NWCA Green */
    --primary-dark: #409a47;   /* Dark Green */
    --primary-light: #e8f5e9;  /* Light Green */
    --text-primary: #333333;
    --text-secondary: #666666;
    --border-color: #e5e7eb;
    --bg-white: #ffffff;
    --bg-light: #f9f9f9;
    --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
    --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
}

/* ==========================================
   BODY ADJUSTMENT
   ========================================== */
body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    margin: 0;
    padding: 0;
    padding-top: 180px;  /* Space for fixed header */
}

/* ==========================================
   HEADER CONTAINER
   ========================================== */
.enhanced-pricing-header {
    background: white;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 1000;
}

/* ==========================================
   TIER 1: CONTACT BAR
   ========================================== */
.header-contact-bar {
    background: var(--primary-dark);  /* Dark green background */
    color: white;
    padding: 10px 0;
    font-size: 14px;
}

.contact-bar-content {
    max-width: 1400px;
    margin: 0 auto;
    padding: 0 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.contact-info {
    display: flex;
    gap: 25px;
    align-items: center;
}

.contact-item {
    display: flex;
    align-items: center;
    gap: 8px;
}

.contact-item i {
    font-size: 13px;
    opacity: 0.9;
}

.contact-link {
    color: white;
    text-decoration: none;
    transition: opacity 0.2s ease;
}

.contact-link:hover {
    opacity: 0.8;
    text-decoration: underline;
}

.business-hours {
    font-size: 13px;
    opacity: 0.9;
    display: flex;
    align-items: center;
    gap: 8px;
}

/* ==========================================
   TIER 2: LOGO/NAVIGATION BAR
   ========================================== */
.header-nav {
    padding: 15px 0;
    background: white;
    border-bottom: 1px solid var(--border-color);
}

.nav-content {
    max-width: 1400px;
    margin: 0 auto;
    padding: 0 20px;
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.logo-section {
    display: flex;
    align-items: center;
}

.logo-link {
    display: inline-block;
    line-height: 0;  /* Remove extra space around image */
}

.logo-image {
    height: 40px;
    width: auto;
    display: block;
}

/* ==========================================
   TIER 3: PRICING CONTEXT BAR
   ========================================== */
.pricing-context-bar {
    background: var(--bg-light);
    border-bottom: 2px solid var(--primary-color);
    padding: 15px 0;
}

.context-bar-content {
    max-width: 1400px;
    margin: 0 auto;
    padding: 0 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 20px;
}

.context-left {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

/* ==========================================
   BREADCRUMB NAVIGATION
   ========================================== */
.breadcrumb {
    color: var(--text-secondary);
    font-size: 14px;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 8px;
}

.breadcrumb a {
    color: var(--primary-color);
    text-decoration: none;
    transition: color 0.2s ease;
}

.breadcrumb a:hover {
    color: var(--primary-dark);
    text-decoration: underline;
}

.breadcrumb-separator {
    color: var(--text-secondary);
    opacity: 0.5;
}

.breadcrumb-current {
    color: var(--text-primary);
    font-weight: 600;
}

/* ==========================================
   CALCULATOR TYPE BADGE (NEW)
   ========================================== */
.calculator-type-badge {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: var(--primary-color);
    color: white;
    padding: 6px 16px;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 600;
    box-shadow: var(--shadow-sm);
}

.calculator-type-badge i {
    font-size: 16px;
}

.badge-text {
    white-space: nowrap;
}

/* ==========================================
   SEARCH WRAPPER
   ========================================== */
.search-wrapper {
    display: flex;
    align-items: center;
    gap: 10px;
    position: relative;
    min-width: 350px;
}

.search-input {
    flex: 1;
    padding: 10px 16px;
    border: 1px solid var(--border-color);
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.search-input:focus {
    outline: none;
    border-color: var(--primary-color);
    box-shadow: 0 0 0 3px rgba(76, 179, 84, 0.1);
}

.search-btn {
    background: var(--primary-color);
    color: white;
    border: none;
    padding: 10px 16px;
    border-radius: 8px;
    cursor: pointer;
    transition: background-color 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
}

.search-btn:hover {
    background: var(--primary-dark);
}

.search-btn i {
    font-size: 16px;
}

/* ==========================================
   SEARCH RESULTS DROPDOWN
   ========================================== */
.search-results {
    position: absolute;
    top: calc(100% + 8px);
    left: 0;
    right: 50px;  /* Account for search button */
    background: white !important;  /* CRITICAL: Force white background */
    border: 1px solid var(--border-color);
    border-radius: 8px;
    max-height: 400px;
    overflow-y: auto;
    display: none;
    z-index: 2000;
    box-shadow: var(--shadow-md);
}

.search-results.active {
    display: block;
}

.search-loading,
.search-no-results {
    padding: 16px;
    text-align: center;
    color: var(--text-secondary);
    font-size: 14px;
}

.search-result-item {
    background: transparent;  /* CRITICAL: Transparent by default */
    padding: 12px 16px;
    cursor: pointer;
    border-bottom: 1px solid #f3f4f6;
    transition: background-color 0.2s ease;
}

.search-result-item:hover {
    background-color: #f9fafb !important;  /* CRITICAL: Light gray, NOT green */
}

.search-result-item:last-child {
    border-bottom: none;
}

.search-result-style {
    font-weight: 600;
    color: var(--text-primary);
    font-size: 15px;
    display: block;
    margin-bottom: 4px;
}

.search-result-desc {
    color: var(--text-secondary);
    font-size: 13px;
    display: block;
}

/* ==========================================
   ACCESSIBILITY
   ========================================== */
.sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
}

/* ==========================================
   MOBILE RESPONSIVE
   ========================================== */
@media (max-width: 1024px) {
    .search-wrapper {
        min-width: 300px;
    }
}

@media (max-width: 768px) {
    body {
        padding-top: 220px;  /* More space for stacked header */
    }

    .contact-bar-content {
        flex-direction: column;
        text-align: center;
        gap: 10px;
    }

    .contact-info {
        flex-direction: column;
        gap: 10px;
    }

    .context-bar-content {
        flex-direction: column;
        align-items: stretch;
    }

    .context-left {
        width: 100%;
    }

    .calculator-type-badge {
        justify-content: center;
    }

    .search-wrapper {
        width: 100%;
        min-width: unset;
    }

    .breadcrumb {
        font-size: 12px;
        flex-wrap: wrap;
    }
}

@media (max-width: 480px) {
    .logo-image {
        height: 32px;
    }

    .calculator-type-badge {
        font-size: 12px;
        padding: 5px 12px;
    }

    .search-input {
        font-size: 13px;
        padding: 8px 12px;
    }
}
```

---

## Implementation Plan

### Phase 1: Create Universal CSS File
**Timeline:** 1-2 hours
**Tasks:**
1. ✅ Create `/shared_components/css/universal-pricing-header.css`
2. ✅ Copy CSS from plan above
3. ✅ Test independently to ensure no syntax errors
4. ✅ Add cache-busting version parameter: `?v=20250110`

### Phase 2: Update DTG Calculator (Test Implementation)
**Timeline:** 1 hour
**Why DTG First:** Already has clean structure, good test case
**Tasks:**
1. Backup current `dtg-pricing.html`
2. Replace header HTML with universal template
3. Update page title and icon to `fa-tshirt`
4. Link to universal CSS file
5. Test thoroughly:
   - Header displays correctly
   - Breadcrumbs work
   - Search functionality works
   - Autocomplete has WHITE background ✅
   - Mobile responsive
   - No CSS conflicts

### Phase 3: Update Remaining Calculators
**Timeline:** 3-4 hours (30-45 min per calculator)
**Order of Implementation:**
1. **Screen Print** - Similar to DTG, should be straightforward
   - Icon: `fa-print`
   - Page title: "Screen Print Pricing Calculator"
2. **Embroidery** - Similar structure
   - Icon: `fa-sewing-machine` or `fa-thread`
   - Page title: "Embroidery Pricing Calculator"
3. **DTF** - Replace existing enhanced header
   - Icon: `fa-file-image`
   - Page title: "DTF Transfer Pricing Calculator"
   - Fix green autocomplete background ✅
4. **Cap Embroidery Manual** - Most different structure
   - Icon: `fa-hat-cowboy`
   - Page title: "Cap Embroidery Pricing Calculator"
   - May need adjustments if it's a staff tool

**For Each Calculator:**
1. Backup existing file
2. Replace header HTML
3. Update calculator-specific values (icon, title)
4. Link to universal CSS
5. Remove redundant header CSS from inline styles
6. Test all functionality
7. Verify no visual regressions

### Phase 4: Testing & Quality Assurance
**Timeline:** 1-2 hours
**Test Matrix:**

| Feature | DTG | Screen Print | Embroidery | DTF | Cap Embroidery |
|---------|-----|--------------|------------|-----|----------------|
| Header displays | ☐ | ☐ | ☐ | ☐ | ☐ |
| Logo clickable | ☐ | ☐ | ☐ | ☐ | ☐ |
| Contact links work | ☐ | ☐ | ☐ | ☐ | ☐ |
| Breadcrumbs work | ☐ | ☐ | ☐ | ☐ | ☐ |
| Badge shows correct text | ☐ | ☐ | ☐ | ☐ | ☐ |
| Search opens dropdown | ☐ | ☐ | ☐ | ☐ | ☐ |
| Autocomplete WHITE bg | ☐ | ☐ | ☐ | ☐ | ☐ |
| Hover is light gray | ☐ | ☐ | ☐ | ☐ | ☐ |
| Mobile responsive | ☐ | ☐ | ☐ | ☐ | ☐ |
| No CSS conflicts | ☐ | ☐ | ☐ | ☐ | ☐ |

**Browser Testing:**
- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)
- Mobile Safari (iOS)
- Chrome Mobile (Android)

### Phase 5: Documentation & Training
**Timeline:** 30 minutes
**Tasks:**
1. Update `ACTIVE_FILES.md` with new CSS file
2. Add comment to CLAUDE.md about universal header
3. Create screenshot showing new header for reference
4. Document calculator icons and their meanings

---

## Calculator Icon Reference

| Calculator | Icon Class | Visual Icon | Purpose |
|------------|-----------|-------------|---------|
| DTG | `fa-tshirt` | 👕 | Direct-to-garment printing |
| DTF | `fa-file-image` | 🖼️ | Transfer printing |
| Screen Print | `fa-print` | 🖨️ | Traditional screen printing |
| Embroidery | `fa-sewing-machine` | 🧵 | Thread embroidery |
| Cap Embroidery | `fa-hat-cowboy` | 🎩 | Hat/cap embroidery |

---

## Benefits of This Approach

### User Experience
✅ **Consistency** - Same header experience across all calculators
✅ **Professional** - Modern, polished design builds trust
✅ **Clear Navigation** - Always know where you are and how to get back
✅ **Contact Info** - Phone/email always visible for questions
✅ **Search Readability** - White background makes products easy to see

### Developer Experience
✅ **DRY Principle** - Single CSS file, no duplication
✅ **Easy Updates** - Change once, updates everywhere
✅ **Maintainable** - Clear structure and documentation
✅ **Scalable** - Easy to add new calculators with same header

### Business Benefits
✅ **Brand Consistency** - Logo and colors always present
✅ **Conversion Optimization** - Contact info = lower barriers
✅ **Mobile-Friendly** - Works on all devices
✅ **Accessibility** - WCAG-compliant with ARIA labels

---

## Risk Assessment

### Low Risk
- Adding new CSS file
- DTG as test implementation
- Backup before changes

### Medium Risk
- Potential CSS conflicts with existing styles
- Mobile layout may need tweaking per calculator
- Search JavaScript may need adjustments

### Mitigation Strategies
1. **Test on DTG First** - Validate approach before rolling out
2. **Keep Backups** - Original files preserved
3. **Incremental Rollout** - One calculator at a time
4. **Version Control** - Use Git to track all changes
5. **Rollback Plan** - Can revert individual calculators if issues arise

---

## Success Metrics

### Before Implementation
- 5 different header designs
- Inconsistent branding
- Green autocomplete backgrounds (poor UX)
- No clear page identifiers
- Contact info inconsistent

### After Implementation
- ✅ 1 universal header design
- ✅ Consistent NWCA branding on all pages
- ✅ White autocomplete backgrounds (great UX)
- ✅ Clear calculator badges on every page
- ✅ Contact info always visible
- ✅ Professional, modern appearance
- ✅ Mobile-responsive design
- ✅ Improved accessibility

---

## Conclusion

**Recommendation:** Adopt the Enhanced Three-Tier Header (DTF-style) as the universal standard with the improvements outlined in this plan.

**Key Improvements:**
1. Add prominent calculator type badge with icon
2. Fix autocomplete background to white
3. Ensure mobile responsiveness
4. Add accessibility attributes
5. Single CSS file for maintainability

**Next Steps:**
1. Get approval from Erik
2. Create universal CSS file
3. Test on DTG calculator
4. Roll out to remaining calculators
5. Document and train

**Estimated Total Time:** 6-8 hours for complete implementation and testing

---

**End of Plan - Ready for Review** 🎯
