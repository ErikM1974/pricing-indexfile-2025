# Pricing Page Unification & Enhancement Plan

**Report Date:** 2025-06-13

**Objective:**
To redesign and unify the interactive pricing sections of the `dtg-pricing.html` and `screen-print-pricing.html` pages. The goal is to achieve:
*   **Branding Consistency:** A cohesive look and feel across both pages.
*   **Improved User Experience (UX):** More intuitive, clearer, and efficient interaction for users.
*   **Enhanced Performance:** Faster load times and smoother interactions, particularly for the DTG page.
*   **Maintainability:** A more modular and easier-to-maintain codebase with reduced redundancy.
*   **Functionality Preservation:** All existing critical functionalities of both pages must be retained and work flawlessly.

**Guiding Principles:**
*   **Hybrid Design:** Leverage the strongest and most user-friendly elements from both existing pages.
*   **Modularity:** Develop reusable HTML structures, CSS components, and JavaScript modules.
*   **Clarity & Transparency:** Ensure pricing, options, and breakdowns are easy to understand.
*   **Performance-First:** Integrate optimization techniques throughout the redesign process.

## Visual Plan: Unified Interactive Column Structure

```mermaid
graph TD
    A[Pricing Page] --> B{Shared Two-Column Layout};
    B --> C[Left: Product Context (UniversalProductDisplay)];
    B --> D[Right: Interactive Pricing Column (NEW Unified Structure)];

    D --> D1[Section 1: Product/Print Options];
    D1 --> D1a[Unified Location Selector (Enhanced DTG Style)];
    D1a --> D1a1[DTG: Collapsible Print Size Guide];
    D1 --> D1b[Screen Print: Color Selection (Dropdowns, Checkboxes)];
    D1 --> D1c[Unified Quantity Inputs (Adapts to DTG/SP needs)];

    D --> D2[Section 2: Pricing Display];
    D2 --> D2a[Unified Pricing Grid/Output Area];
    D2 --> D2b[Collapsible Price Breakdown (Detailed, SP Style)];
    D2 --> D2c[Accordion: Pricing Tiers/Volume Discounts (SP Style)];

    D --> D3[Section 3: Action & Information];
    D3 --> D3a[Unified Call to Action (Clear Buttons, DTG Style)];
    D3 --> D3b[Add to Cart/Quote Functionality];
    D3 --> D3c[Collapsible Notes/FAQ (LTM, Turnaround)];

    subgraph Styling & Logic
        S1[New: universal-interactive-pricing.css];
        S2[Refactor: shared-pricing-styles.css];
        S3[New/Refactored Shared JS Modules];
        D1a <--> S1;
        D1b <--> S1;
        D1c <--> S1;
        D2a <--> S1;
        D2b <--> S1;
        D2c <--> S1;
        D3a <--> S1;
        D1 & D2 & D3 <--> S3;
    end

    subgraph Performance Optimizations
        P1[CSS Minification/Optimization];
        P2[JS Bundling/Deferring/Async];
        P3[Image Optimization/Lazy Loading];
        P4[HTML Cleanup (Remove unused hidden elements)];
        S1 & S2 --> P1;
        S3 --> P2;
    end
```

## Core Affected Files:
*   **HTML:** `dtg-pricing.html`, `screen-print-pricing.html`
*   **CSS:**
    *   `shared_components/css/shared-pricing-styles.css` (to be refactored)
    *   `shared_components/css/dtg-specific.css` (styles to be migrated/refactored)
    *   Inline `<style>` block in `screen-print-pricing.html` (styles to be extracted and migrated)
    *   **New:** `shared_components/css/universal-interactive-pricing.css` (for the unified interactive column)
*   **JavaScript:** Various files within `shared_components/js/`, including page-specific setup scripts and universal components.

## Proposed Unified Structure for "Interactive Pricing Column" (Right-Hand Side):

This new structure will replace the current disparate contents of the right-hand columns on both pages.

### Section 1: Product/Print Options
*   **A. Unified Location Selector:**
    *   **Visual Style:** Adopt the enhanced, more visual style from the DTG page.
    *   **Functionality:**
        *   DTG: Drives pricing based on selected print area. Include the collapsible "Print Size Guide".
        *   Screen Print: Adapt to handle selection of multiple print locations or simplify to a primary location.
*   **B. Decoration-Specific Options:**
    *   **Screen Print:** Number of Colors (dropdown), Additional Logo/Location (checkbox/toggle).
    *   **DTG:** (Primarily covered by location/size).
*   **C. Quantity Inputs:**
    *   **Style:** Unified, clean style.
    *   **Functionality:** Adapt to DTG's per-size grid and Screen Print's general quantity method. Include quick quantity buttons (+/-).

### Section 2: Pricing Display
*   **A. Unified Pricing Grid / Calculator Output Area:**
    *   **Presentation:** Standardized display of core price per item or total. Highlight active pricing tier.
*   **B. Collapsible Price Breakdown:**
    *   **Inspiration:** Screen Print page's detailed breakdown.
    *   **Content:** Base garment price, print/decoration cost, setup fees, LTM fees, upcharges.
    *   **Interaction:** Collapsible (accordion style).
*   **C. Accordion: Pricing Tiers / Volume Discounts:**
    *   **Inspiration:** Screen Print page's pricing tiers table.
    *   **Presentation:** Clearly show price decrease with larger quantities.
    *   **Interaction:** Accordion or collapsible section.

### Section 3: Action & Information
*   **A. Unified Call to Action (CTA):**
    *   **Style:** Clear, prominent button style from DTG page ("Call Us", "Email Quote Request").
*   **B. Add to Cart / Quote Functionality:**
    *   Integrate existing "Add to Cart" or "Add to Quote" buttons. Clear summary of items.
*   **C. Collapsible Notes / FAQ:**
    *   **Content:** LTM fee explanations, turnaround times, disclaimers, FAQ snippets.
    *   **Interaction:** Collapsible sections.

## Styling Strategy:
*   **New Central CSS File:** Create `shared_components/css/universal-interactive-pricing.css`.
*   **Migration & Refactoring:**
    *   Extract inline styles from `screen-print-pricing.html` to the new CSS file.
    *   Migrate relevant styles from `dtg-specific.css` to the new CSS file.
    *   Refactor `shared-pricing-styles.css` to complement the new module.
*   **CSS Variables:** Consistently use existing CSS variables for branding.

## JavaScript Refactoring:
*   **Identify Shared Logic:** Analyze existing scripts for common functionalities.
*   **Create/Enhance Shared Modules:** Develop/refactor JS modules in `shared_components/js/` for location selection, quantity handling, dynamic pricing, collapsible sections, etc.
*   **Externalize Inline Scripts:** Move inline JavaScript to external `.js` files.
*   **Event Handling:** Standardize event handling.

## Speed Optimizations (Integrated into the redesign):
*   **CSS:** Minify all CSS. Ensure efficient selectors.
*   **JavaScript:** Minify and bundle/consolidate JS. Use `async` or `defer` for non-critical scripts. Optimize Caspio script loading.
*   **Images:** Optimize images. Implement lazy loading.
*   **HTML:** Remove unnecessary hidden elements. Ensure semantic structure.

## High-Level Implementation Steps:
1.  **CSS Foundation:** Create `universal-interactive-pricing.css`. Begin style migration.
2.  **HTML Structure Update:** Modify `dtg-pricing.html` and `screen-print-pricing.html` for the new unified structure. Link new CSS.
3.  **JavaScript Logic Unification:** Refactor JS into shared modules. Update page scripts.
4.  **Styling Implementation:** Complete styling in `universal-interactive-pricing.css`. Ensure responsiveness.
5.  **Functionality Integration:** Wire up interactive elements with refactored JS.
6.  **Performance Pass:** Implement JS/CSS minification, image optimization, script loading strategies.
7.  **Thorough Testing:** Test both pages across browsers/devices. Verify all features.

## Success Metrics:
*   Visual consistency in interactive pricing sections.
*   Improved PageSpeed Insights scores.
*   No regressions in functionality.
*   More maintainable codebase.
*   Positive user feedback (if obtainable).