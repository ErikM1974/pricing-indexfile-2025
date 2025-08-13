# Plan for Unified Embellishment Pricing Pages (Revised)

## Goal
To create a consistent look, feel, and functionality across all embellishment pricing pages (`embroidery-pricing.html`, `cap-embroidery-pricing.html`, `dtg-pricing.html`, `screen-print-pricing.html`, `dtf-pricing.html`), with the primary variation being the Caspio datapage used for pricing. This plan prioritizes the stability of the existing `embroidery-pricing.html` while developing a reusable component system.

## Guiding Principles
*   **Safety First:** The original `embroidery-pricing.html` will not be modified until the new shared system is proven and stable with other pages.
*   **Incremental Development:** Build and test one new page at a time using the shared components.
*   **`embroidery-pricing.html` as Template:** The structure, styles, and logic of the existing `embroidery-pricing.html` will serve as the primary reference for creating the shared components.
*   **Modularity:** Design shared components (HTML, CSS, JS) that are focused and reusable.
*   **Clear Separation:** Isolate page-specific logic (especially data fetching and minor behavioral/cosmetic tweaks) from shared core logic.

## Phases of Development

### Phase 1: Foundation and First New Page (e.g., Cap Embroidery)

1.  **Snapshot & Isolate Development Environment:**
    *   Create a dedicated directory (e.g., `shared_components/`) or a clear file naming convention for the new shared assets.
    *   **Copy, Don't Move:**
        *   Copy the HTML structure from `embroidery-pricing.html` to serve as a base for shared HTML templates/partials.
        *   Copy relevant CSS (e.g., from `pricing-pages-enhanced.css`) into a new `shared-pricing-styles.css` file.
        *   Copy relevant JavaScript files (e.g., `pricing-pages.js`, `product-pricing-ui.js`, `product-quantity-ui.js`, `utils.js`, `cart.js`, `add-to-cart.js`, `cart-price-recalculator.js`, `pricing-calculator.js`) into the `shared_components/js/` directory.
    *   The original `embroidery-pricing.html` and its direct dependencies remain untouched.

2.  **Develop Shared Core Components (from Copied Assets):**
    *   **Shared HTML Structure:** Refine the copied HTML into reusable partials or a main template structure.
    *   **Shared CSS (`shared-pricing-styles.css`):** Generalize the copied CSS. Implement CSS Custom Properties (variables) for themable aspects.
    *   **Shared JavaScript Modules:** Refactor the copied JS files into modular, reusable components (e.g., `shared-ui-manager.js`, `shared-quantity-input.js`, `shared-pricing-display.js`). Ensure existing cart logic (`cart.js`, etc.) is integrated as shared modules.

3.  **Develop First Data Adapter (`CapEmbroideryAdapter.js`):**
    *   Create a new JavaScript file responsible for:
        *   Knowing the specific Caspio datapage for cap embroidery.
        *   Interfacing with `pricing-matrix-capture.js` (or a shared version) to fetch and parse data.
        *   Transforming this data into a standardized format consumable by shared pricing logic.

4.  **Build `cap-embroidery-pricing.html`:**
    *   Create the new HTML file.
    *   Structure it using the shared HTML components.
    *   Link `shared-pricing-styles.css`.
    *   Include shared JS modules and `CapEmbroideryAdapter.js`.
    *   Add a small page-specific script for initialization and any minor unique behaviors/styles (see "Handling Variations" below).
    *   Thoroughly test this page.

### Phase 2: Extend to Other Pages

5.  **Replicate for Other Embellishments:**
    *   Once `cap-embroidery-pricing.html` is stable:
        *   Create `dtg-pricing.html`, `screen-print-pricing.html`, `dtf-pricing.html`.
        *   For each, develop its specific Data Adapter (e.g., `DTGAdapter.js`, `ScreenPrintAdapter.js`, `DTFAdapter.js`).
        *   These pages will use the same shared HTML, CSS, and JS components, differing primarily in their Data Adapter and any minor page-specific configurations.
    *   Test each new page thoroughly.

### Phase 3: (Optional) Retrofit Original `embroidery-pricing.html`

6.  **Consider Retrofitting:**
    *   Only after all *new* pricing pages are stable and functioning correctly with the shared system, evaluate retrofitting `embroidery-pricing.html`.
    *   This would involve updating it to use the shared components and an `EmbroideryAdapter.js`.
    *   This step is optional and should be undertaken if the benefits of 100% consistency and reduced duplication outweigh the risk and effort of modifying the stable original page.

## Handling Variations and Page-Specific Needs

*   **CSS Changes:**
    *   **Shared:** Modifications to `shared-pricing-styles.css` affect all linked pages. Test all dependent pages after such changes.
    *   **Minor Page-Specific Cosmetic:**
        1.  Use a page-specific `<style>` block in the HTML `<head>`.
        2.  Use inline `style` attributes for extremely isolated, single-element tweaks.
        3.  Utilize CSS Custom Properties defined in shared CSS and overridden in page-specific style blocks.
        4.  Employ page-specific body classes (e.g., `class="page-dtg"`) for targeted overrides.
*   **JavaScript Behavioral Changes:**
    *   **Minor Page-Specific:**
        1.  Use a small, page-specific JS file or inline `<script>` at the end of the page's body. This script runs after shared scripts and can:
            *   Add unique event listeners.
            *   Call shared functions with page-specific parameters.
            *   Slightly modify behavior by decorating or wrapping shared functions (use with care).
        2.  Design shared modules to accept configuration objects during initialization, allowing pages to pass different settings.
        3.  Implement custom events or callback mechanisms in shared modules for well-defined extension points.
    *   **Avoid:** Page-specific conditional logic (`if (pageName === '...')`) directly within shared JS modules.

## Managing Changes to Shared Components

*   **During Initial Development (e.g., for `cap-embroidery-pricing.html`):** Changes to the evolving shared components will directly affect the page being built. This is part of the development process. The original `embroidery-pricing.html` remains isolated.
*   **After First Page is Stable:** When modifying an established shared component (HTML, CSS, or JS) while developing subsequent pages:
    *   Assess the potential impact on all existing pages that use that component.
    *   **Test all dependent pages** to ensure no regressions.
    *   Aim for backward-compatible changes.
*   **Version Control (Git):** Develop the shared system and new pages in a separate branch to isolate work and allow for easy rollbacks if needed.

This plan aims for a robust, maintainable, and consistent system for all embellishment pricing pages while safeguarding the functionality of the existing `embroidery-pricing.html`.