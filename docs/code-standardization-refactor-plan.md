# Refactoring Plan: Code Standardization & Consistency

This document outlines a phased approach to refactor the existing JavaScript and CSS codebase for improved standardization and consistency. The primary goal is to enhance maintainability, readability, and reduce technical debt while minimizing the risk of breaking existing functionality.

## 1. Guiding Principles

*   **Incremental Changes**: All refactoring will be done in small, manageable steps. Avoid large, sweeping changes across many files at once.
*   **Test After Each Step**: After each significant change or set of related changes within a file or module, thoroughly test the affected functionality on the relevant pricing pages.
*   **Version Control**: Commit changes frequently with clear messages (e.g., "Refactor: Externalize LTM fee config from cap-embroidery-validation.js"). Use branches for larger refactoring tasks within a phase.
*   **Prioritize Shared Components**: Initial focus will be on files within `shared_components/js/` and `shared_components/css/` as these have the broadest impact.
*   **No New Features**: This refactoring effort is focused solely on improving existing code quality, not adding new functionality.
*   **Documentation**: Briefly document significant changes or new patterns introduced (e.g., in this plan or a separate style guide).

## 2. Phase-Based Refactoring Approach

We will tackle the standardization in the following phases, ordered to generally start with lower-risk, higher-impact changes:

### Phase 1: Configuration Management & Basic JS Modernization

**Objective**: Externalize hardcoded values and introduce basic modern JavaScript syntax for improved clarity and easier updates.
**Risk Level**: Low to Medium.

**A. Externalize Hardcoded Values**
    *   **Strategy**:
        1.  Create `shared_components/js/app-config.js`. This file will hold global configuration constants.
        2.  Identify hardcoded values (magic numbers, strings for UI messages, fee amounts, thresholds) in key JavaScript files.
        3.  Move these values into `app-config.js`, organizing them into logical objects (e.g., `APP_CONFIG.FEES.LTM_AMOUNT`, `APP_CONFIG.MESSAGES.STITCH_MISMATCH`).
        4.  Update the original JavaScript files to reference these values from `app-config.js`. (Initially, `app-config.js` can expose a global `APP_CONFIG` object if ES6 modules are not yet in place).
 *   **Notes on Script Dependencies and Initialization:**
     *   When centralizing configurations (e.g., into `app-config.js`) or utilities (e.g., into `utils.js`), ensure these core/shared scripts are loaded and fully initialized *before* any dependent scripts attempt to access their global objects (e.g., `window.NWCA_APP_CONFIG`, `window.NWCAUtils`).
     *   Verify script load order in HTML files. For critical early dependencies, direct script inclusion in the HTML `<head>` or at the beginning of the `<body>` (before other scripts) is more reliable than relying on dynamic loading by other scripts if timing is critical (e.g., functions needed during `DOMContentLoaded` by multiple scripts).
     *   If `DOMContentLoaded` event listeners in one script rely on global objects set up by another script that also runs on `DOMContentLoaded` or is an IIFE, race conditions can occur. Consider using custom events to signal readiness of core utilities if complex dependencies arise (e.g., `NWCAUtilsReady`, `AppConfigReady` events that other modules can listen for before initializing fully).
     *   When refactoring functions into a shared utility object (e.g., `NWCAUtils`), ensure the utility object is assigned to the global scope (e.g., `window.NWCAUtils = ...`) if it's intended to be accessed globally by other scripts not using ES6 module imports.
     *   Browser caching can sometimes mask the effects of JavaScript changes. Always perform a hard refresh (Ctrl+Shift+R or Cmd+Shift+R) and, if issues persist, clear site data or test in an incognito window to ensure the latest script versions are being executed.
 *   **Initial Target Files**:
     *   [`shared_components/js/cap-embroidery-validation.js`](../shared_components/js/cap-embroidery-validation.js) (LTM fee details, warning messages)
        *   [`shared_components/js/cap-embroidery-back-logo.js`](../shared_components/js/cap-embroidery-back-logo.js) (back logo price, stitch count)
        *   [`shared_components/js/add-to-cart.js`](../shared_components/js/add-to-cart.js) (any default messages or parameters)
        *   Adapters (e.g., default stitch counts, specific fee names if hardcoded).
    *   **Testing**:
        *   **Cap Embroidery**: Test LTM fee calculation and display with quantities above/below threshold. Test back logo pricing. Trigger validation scenarios (non-cap product, stitch mismatch) and verify correct messages from config are shown.
        *   **General Cart**: Verify any UI messages sourced from config.

**B. `var` to `let`/`const` and Basic Naming Conventions (JavaScript)**
    *   **Strategy (Iterate per file, one at a time):**
        1.  Scan the chosen file for `var` declarations. Replace with `let` for variables that are reassigned, and `const` for variables assigned only once.
        2.  While in the file, review variable and function names. Ensure:
            *   `camelCase` for variables and functions (e.g., `totalPrice`, `calculateTierPrice`).
            *   `UPPER_SNAKE_CASE` for any local constants defined within the file (e.g., `MAX_ITEMS`).
            *   (PascalCase for classes/constructors is generally good but will be a focus in a later phase if converting IIFEs).
    *   **Initial Target Files**: Start with smaller utility files or modules less central to core pricing logic to build confidence.
        *   [`shared_components/js/utils.js`](../shared_components/js/utils.js)
        *   [`shared_components/js/dp5-helper.js`](../shared_components/js/dp5-helper.js) (can be done section by section)
        *   Then move to adapters and UI components one by one.
    *   **Testing**: After refactoring each file:
        *   Thoroughly test all functionalities provided by that script or the pricing page it primarily affects. For example, if `utils.js` is changed, test features using its utility functions across multiple pages. If an adapter is changed, test its specific pricing page interactions.

### Phase 2: Reducing Duplication & Improving Separation of Concerns

**Objective**: Centralize common logic and styles, and ensure HTML, CSS, and JS have distinct responsibilities.
**Risk Level**: Medium.

**A. Consolidate Utility Functions (JavaScript)**
    *   **Strategy**:
        1.  Identify small, stateless, purely functional pieces of logic duplicated across multiple files (e.g., formatting currency, normalizing strings, simple DOM element selections, URL parameter parsing, specific data transformations).
        2.  Move these identified functions into [`shared_components/js/utils.js`](../shared_components/js/utils.js), ensuring they are generic and well-named.
        3.  Update all calling locations to use the centralized utility function (e.g., `NWCAUtils.formatCurrency()`).
        4.  When moving a function to a shared utility like `utils.js`, if that function is called very early in the page lifecycle by multiple scripts (e.g., during `DOMContentLoaded`), ensure the `utils.js` script itself is loaded and `NWCAUtils` is globally available before these calls. If timing issues persist, temporarily keeping a local copy of a critical, early-needed function within the dependent script might be a pragmatic short-term solution while a more robust event-based or module-loading dependency management strategy is implemented.
    *   **Initial Areas of Focus**:
        *   Currency formatting (already in `utils.js`, ensure it's used everywhere).
        *   URL parameter getting (already in `utils.js`, ensure consistent use).
        *   Common DOM query patterns (e.g., `document.getElementById` if used frequently for same IDs).
        *   String manipulation for display (e.g., title casing).
    *   **Testing**: For each utility consolidated:
        *   Identify all pages/features that previously used the duplicated logic.
        *   Manually test these specific functionalities to ensure they behave identically using the new shared utility.

**B. Minimize Inline Styles & Scripts (HTML/CSS)**
    *   **Strategy (Iterate per HTML page):**
        1.  Scan HTML files for any `<style>` tags within the `<body>` and `style="..."` attributes on elements.
        2.  For inline `style` attributes: Create new, descriptive CSS classes. Move the style declarations to an appropriate shared CSS file (e.g., [`shared_components/css/shared-pricing-styles.css`](../shared_components/css/shared-pricing-styles.css) or [`pricing-pages.css`](../pricing-pages.css)). Replace the inline style with the new class.
        3.  For inline `<script>` tags containing logic (not just `src`): Move the JavaScript logic into an existing relevant `.js` file or create a new one if the logic is substantial and page-specific. Ensure the script logic is executed at the correct time (e.g., within `DOMContentLoaded` listener or called by an existing page initialization function).
    *   **Initial Target Files**:
        *   Start with less complex pages like [`dtf-pricing.html`](../dtf-pricing.html) or [`index.html`](../index.html).
        *   Then move to more complex pricing pages like [`cap-embroidery-pricing.html`](../cap-embroidery-pricing.html).
    *   **Testing (per page modified)**:
        *   Visually inspect the page thoroughly across different viewport sizes to ensure styles are applied correctly and layout is not broken.
        *   Functionally test any features that were previously handled by inline scripts.

**C. Standardize CSS Naming Conventions & Reduce CSS Duplication**
    *   **Strategy**:
        1.  Establish a CSS naming convention (e.g., strict kebab-case: `primary-button`, `product-image-gallery`).
        2.  Review CSS files ([`shared_components/css/shared-pricing-styles.css`](../shared_components/css/shared-pricing-styles.css), [`pricing-pages.css`](../pricing-pages.css), [`main.css`](../main.css)) and page-specific `<style>` blocks.
        3.  Identify duplicated style blocks or very similar rule sets. Consolidate these into common classes in shared CSS files.
        4.  Rename existing classes to conform to the chosen convention, updating all HTML references. This should be done carefully, file by file or component by component.
        5.  Consider introducing utility classes for common patterns (e.g., `.text-center`, `.margin-bottom-small`, `.hidden`).
    *   **Testing**:
        *   After refactoring CSS for a component or page, perform thorough visual testing on that component/page across browsers and screen sizes.
        *   Pay attention to layout, spacing, typography, and colors.

### Phase 3: Advanced JavaScript Refactoring

**Objective**: Improve the structure of more complex JavaScript modules and further reduce duplication in application logic.
**Risk Level**: Medium to High.

**A. Refactor Shared Adapter Logic**
    *   **Strategy**:
        1.  Deeply analyze the common patterns in adapters ([`CapEmbroideryAdapter.js`](../shared_components/js/cap-embroidery-adapter.js), [`DTGAdapter.js`](../shared_components/js/dtg-adapter.js), [`ScreenPrintAdapter.js`](../shared_components/js/screenprint-adapter.js)) for handling the "Master Bundle" flow:
            *   Receiving and storing the master bundle.
            *   Listening to UI option changes.
            *   Extracting the correct data slice based on selections.
            *   Formatting the `event.detail` payload for `pricingDataLoaded`.
            *   Dispatching the `pricingDataLoaded` event.
        2.  Design a `BaseAdapter` class or a set of composable helper functions (`adapter-utils.js`) to encapsulate this common logic.
            *   The `BaseAdapter` could have methods like `_receiveMasterBundle(data)`, `_getSelectedOptions()` (to be implemented by subclasses), `_extractPricingProfile(options)`, `_dispatchPricingData(profile)`.
        3.  Refactor one adapter (e.g., `DTGAdapter.js`) to use this base class/helpers.
        4.  Thoroughly test the refactored adapter's pricing page.
        5.  Incrementally refactor other adapters, testing each one.
    *   **Testing**: For each refactored adapter:
        *   Verify initial price display on page load.
        *   Test all user-selectable options specific to that embellishment type and confirm the pricing grid updates correctly.
        *   Confirm that adding items to the cart from this page works, and prices in the cart are correct.

**B. Convert Key IIFE Modules to ES6 Classes**
    *   **Strategy**:
        1.  Identify large IIFE-based modules that manage significant state and expose a public API (e.g., `NWCACart`, `NWCAProductPricingUI`, `ProductQuantityUI`).
        2.  For each module:
            *   Plan the class structure: constructor, private/public properties, methods.
            *   Rewrite the IIFE as an ES6 class. Use `#` for private instance members if targeting modern browsers, or `_` prefix convention otherwise.
            *   Update all instantiation points (e.g., `const cart = NWCACart();` becomes `const cart = new NWCACart();`).
    *   **Initial Target Modules**:
        *   [`shared_components/js/cart.js`](../shared_components/js/cart.js) (`NWCACart`)
        *   [`shared_components/js/product-pricing-ui.js`](../shared_components/js/product-pricing-ui.js) (`NWCAProductPricingUI`)
    *   **Testing**: This is high risk. After refactoring each class:
        *   **NWCACart**: Test ALL cart functionalities: adding items from multiple different pricing pages, updating quantities in cart, removing items, LTM fee recalculations, stitch count consistency checks, single embellishment type rule, session persistence (if applicable).
        *   **NWCAProductPricingUI**: Test price grid rendering and updates on ALL pages that use it, with ALL possible options for each embellishment type.

**C. `async/await` for Complex Asynchronous Operations**
    *   **Strategy**:
        1.  Identify more complex Promise chains or nested callbacks, especially in [`shared_components/js/cart.js`](../shared_components/js/cart.js) (API calls) and [`server.js`](../server.js).
        2.  Refactor these using `async/await` to simplify asynchronous flow control and improve error handling with `try/catch` blocks.
    *   **Testing**: Test all asynchronous operations thoroughly, including success and error paths (e.g., simulate API failures if possible to check error handling).

## 4. Post-Refactoring

*   **Final Review**: Conduct a final review of all changes.
*   **Documentation Update**: Update the main `README.md` or other relevant documents if architectural patterns have significantly changed or new conventions are established.

This phased plan allows for systematic improvement while managing risk. Each step should be validated before moving to the next.