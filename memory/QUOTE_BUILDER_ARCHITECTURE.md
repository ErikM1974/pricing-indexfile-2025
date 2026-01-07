# Quote Builder Architecture

> **Created:** January 6, 2026
> **Purpose:** Guide for creating new quote builders with consistent UI

---

## Architecture Overview

All quote builders share the same **look and feel** but have **separate pricing logic**.

```
SHARED CSS (Edit once → all builders update)
├── /shared_components/css/quote-builder-universal.css   ← Master layout
├── /shared_components/css/color-picker-shared.css       ← Color picker component
└── /shared_components/css/[builder]-extracted.css       ← Builder-specific overrides

SEPARATE JS (Each has unique pricing logic)
├── /shared_components/js/dtg-quote-pricing.js
├── /shared_components/js/screenprint-quote-pricing.js
├── /shared_components/js/embroidery-quote-pricing.js
└── /shared_components/js/dtf-quote-pricing.js
```

---

## Current Quote Builders

| Builder | Pricing Model | Config Options |
|---------|--------------|----------------|
| **DTG** | Per-piece by quantity tier | Print location (Front/Back/Both) |
| **Screen Print** | Setup + per-color/location | Ink colors (1-8), location |
| **Embroidery** | Per-stitch tiers + digitizing | Stitch count, logo position, digitizing fee |
| **DTF** | Per-transfer by size/quantity | Transfer size, quantity |

---

## How to Request a New Quote Builder

Provide Claude with these 5 pieces of information:

### 1. Embellishment Type
```
"I need a quote builder for [TYPE]"
Examples: Heat Transfers, Patches, Sublimation, Vinyl, Laser Etching
```

### 2. Pricing Model (Most Important!)
```
How is the price calculated?

Examples:
- "Price per piece based on quantity tiers (1-11, 12-23, 24-47, 48+)"
- "Setup fee ($25) + per-color charge ($1.50/color)"
- "Based on size: Small=$2, Medium=$3, Large=$4"
- "Per square inch ($0.50/sq in)"
- "Flat rate per location ($5/location)"
```

### 3. Configuration Options
```
What does the user configure before adding products?

Examples:
- Number of colors (dropdown 1-8)
- Logo position (Front/Back/Left Chest/Right Chest/Sleeve)
- Size selection (Small/Medium/Large)
- Stitch count input (number field)
- Include setup fee (checkbox)
- Artwork provided (yes/no toggle)
```

### 4. Product Compatibility
```
Which products work with this embellishment?

- "All garments in the system"
- "Only caps/hats"
- "Only polo shirts"
- "Products from Caspio table [TABLE_NAME]"
- "Same products as DTG builder"
```

### 5. Special Rules
```
Any pricing exceptions or business rules?

- "2XL and larger has $2 upcharge"
- "Minimum order 24 pieces"
- "Dark garments add $1.50"
- "Quantity breaks at 12/24/48/72"
- "Setup fee waived for reorders"
- "Max 6 colors on light, 4 on dark"
```

---

## Example Request

> "I need a quote builder for **heat transfers**.
>
> Pricing is based on **transfer size**: Small=$2, Medium=$3, Large=$4 per piece.
> There's a **$25 setup fee** for new artwork (waived for reorders).
>
> User selects: **transfer size** (dropdown) and **placement location** (checkboxes for Front/Back/Sleeve).
>
> Works with **all garments** (same product list as DTG).
>
> No minimums, but **48+ pieces gets 10% discount**."

---

## Key Files Reference

### Universal CSS (Edit for global layout changes)
```
/shared_components/css/quote-builder-universal.css
```

**CSS Variables to customize:**
```css
:root {
    --sidebar-width: 300px;        /* Sidebar width */
    --search-max-width: 300px;     /* Search bar width */
    --header-height: 60px;         /* Header height */
    --nwca-blue: #003f7f;          /* Brand blue */
    --nwca-green: #28a745;         /* Brand green */
}
```

### Builder HTML Files
```
/quote-builders/dtg-quote-builder.html
/quote-builders/screenprint-quote-builder.html
/quote-builders/embroidery-quote-builder.html
/quote-builders/dtf-quote-builder.html
```

### Builder-Specific CSS (for unique styles only)
```
/shared_components/css/dtg-quote-builder-extracted.css
/shared_components/css/screenprint-quote-builder-extracted.css
/shared_components/css/embroidery-quote-builder-extracted.css
/shared_components/css/dtf-quote-builder.css
```

### Pricing JavaScript
```
/shared_components/js/dtg-quote-pricing.js
/shared_components/js/screenprint-quote-pricing.js
/shared_components/js/embroidery-quote-pricing.js
/shared_components/js/dtf-quote-pricing.js
```

---

## Why Separate Pricing Logic?

Each embellishment has fundamentally different pricing:

| Type | Pricing Basis | Why It's Different |
|------|--------------|-------------------|
| DTG | Per piece × quantity tier | Ink cost is fixed per print |
| Screen Print | Setup + per color × locations | Each color = separate screen |
| Embroidery | Stitch count tier + digitizing | More stitches = more time |
| DTF | Transfer size × quantity | Transfer cost varies by size |

**These cannot be unified** without creating confusing, error-prone code.

---

## CSS Unification History

**January 6, 2026:** Extracted inline CSS from all quote builders

| Builder | Before | After | Reduction |
|---------|--------|-------|-----------|
| DTG | 5,876 lines | 3,934 lines | -1,942 |
| Screen Print | 5,835 lines | 3,977 lines | -1,858 |
| Embroidery | 6,084 lines | 4,291 lines | -1,793 |

Created `quote-builder-universal.css` (1,890 lines) containing all shared styles.

---

## Quick Reference: Making Layout Changes

**Change sidebar width (all builders):**
```css
/* In quote-builder-universal.css */
:root {
    --sidebar-width: 320px;
}
```

**Change table column widths:**
```css
.product-table th.size-col {
    width: 60px;
    min-width: 60px;
}
```

**Change search bar width:**
```css
:root {
    --search-max-width: 400px;
}
```

**Change header color (theming):**
```css
:root {
    --nwca-blue: #1a365d;  /* Darker blue */
}
```
