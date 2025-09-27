# NW Custom Apparel - Online Catalog & Pricing System (2025)

## Quick Start

```bash
npm install  # First time only
npm start    # Runs on http://localhost:3000
```

That's it. No build step. No webpack. Just simple static file serving.

## Directory Structure

- `/calculators/` - Pricing calculators and bundles (51 active files)
- `/dashboards/` - Staff and management dashboards (11 files)
- `/quote-builders/` - Quote generation tools (4 files)
- `/admin/` - Administrative tools (4 files)
- `/vendor-portals/` - Vendor integration pages (3 files)
- `/training/` - Training materials and games (43 files)
- `/shared_components/` - Reusable JS (60+) and CSS (30+) files
  - `/js/` - Adapters, services, utilities
  - `/css/` - Shared stylesheets
- `/docs/` - Documentation and archived materials
- `/tests/` - Test files (16 files)
- `/logs/` - Log files (gitignored)
- **Root directory** - Main HTML entry points and legacy JS files (documented technical debt)

**To add a new feature:** Place in appropriate directory, update ACTIVE_FILES.md
**To deploy:** `npm start` (Express serves static files - that's all!)

## 1. Project Overview

This project is the online catalog and dynamic pricing system for Northwest Custom Apparel (NWCA). It allows users to browse a wide range of apparel products and view estimated pricing for various customization types, including embroidery, cap embroidery, Direct-to-Garment (DTG), Direct-to-Film (DTF), and screen printing.

The system aims to provide customers with an intuitive way to explore products and understand decoration costs. Currently, the final ordering process is handled manually (e.g., users generate a PDF quote and email it, or contact sales), with a full online ordering system being a planned future enhancement.

The frontend is built with HTML, CSS, and JavaScript, interacting with a Caspio backend (for most pricing data) via a Node.js/Express.js proxy server deployed on Heroku.

## 2. Main Entry Point & Navigation

*   **[`index.html`](index.html)**:
    *   **Purpose**: Serves as the main landing page and entry point to the product catalog.
    *   **Key Features**:
        *   Embeds a Caspio script (`https://c3eku948.caspio.com/dp/a0e15000f1348807501f41ef9d03/emb`) for product search and display.
        *   Provides users with a step-by-step guide on how to find products and view decoration pricing.
        *   Features promotional banners, such as a link to the [`c112-bogo-promo.html`](c112-bogo-promo.html) page.
    *   **Navigation Flow**:
        1.  Users utilize the search filters on `index.html` to find apparel items.
        2.  Clicking a product in the search results navigates the user to a generic product detail page (likely [`product.html`](product.html), though this specific file's role needs final verification in the live flow).
        3.  From the product detail page, users select a decoration method. This action then directs them to a dedicated pricing page for that embellishment type (e.g., [`cap-embroidery-pricing.html`](cap-embroidery-pricing.html), [`dtg-pricing.html`](dtg-pricing.html)). These dedicated pages often receive product context (like style number and color) via URL parameters.

## 3. Pricing Pages & Calculators

The system employs separate HTML pages for each embellishment type, each with its own pricing logic and UI. A significant architectural pattern, the "Master Bundle" approach, is used for most Caspio-driven pricing pages.

### 3.1. General Pricing Page Architecture (Master Bundle Approach)

This architecture applies to dynamic pricing pages like Cap Embroidery, DTG, Screen Print, and general Embroidery.

*   **Core HTML Structure**: Most pricing pages adopt a two-column layout:
    *   **Left Column (Product Context)**: Displays product title, style number, an image gallery (main image, thumbnails), and color swatches for the selected product.
    *   **Right Column (Interactive Pricing)**: Contains embellishment-specific option selectors (e.g., stitch count, print locations, number of colors), a dynamic pricing grid/table, quantity input fields (often per size), and an "Add to Cart" section with a summary.
*   **Key Shared JavaScript Modules**: A suite of shared JavaScript files, primarily located in `shared_components/js/`, underpins the functionality of these pages.
    *   **Embellishment-Specific Adapters** (e.g., [`CapEmbroideryAdapter.js`](shared_components/js/cap-embroidery-adapter.js), [`DTGAdapter.js`](shared_components/js/dtg-adapter.js), [`ScreenPrintAdapter.js`](shared_components/js/screenprint-adapter.js)):
        *   Each embellishment type has a dedicated adapter.
        *   The adapter is responsible for:
            1.  Receiving the "Master Bundle" of pricing data from the Caspio iframe (via `postMessage`). This bundle contains pre-calculated pricing for all relevant permutations of options for that embellishment type.
            2.  Storing this master bundle locally within the script.
            3.  Listening to changes in user-selectable options on the HTML page (e.g., stitch count dropdown, print location selector).
            4.  When an option changes, the adapter extracts the relevant slice of pricing data for the new configuration from the stored master bundle.
            5.  It then dispatches a standardized `pricingDataLoaded` custom event, with the extracted data in `event.detail`.
    *   **[`shared_components/js/pricing-pages.js`](shared_components/js/pricing-pages.js) (`NWCAPricingPages` or `PricingPageUI` module)**:
        *   Orchestrates the overall setup of a pricing page.
        *   Handles fetching initial product details (style, color, images) often using URL parameters.
        *   Manages the display of product images, color swatches, and potentially tab navigation.
        *   Initiates the loading of the Caspio iframe that will provide the pricing data.
        *   May contain logic to update various UI elements based on events or data changes.
    *   **[`shared_components/js/pricing-matrix-capture.js`](shared_components/js/pricing-matrix-capture.js)**:
        *   Primarily for pages that might not use the full "Master Bundle" `postMessage` approach or as a fallback.
        *   Detects and extracts pricing data directly from a rendered (possibly hidden) Caspio DataPage table.
        *   Makes this data available globally (e.g., via `window.nwcaPricingData`).
        *   Can also send captured data to the Heroku proxy server (`/api/pricing-matrix`).
    *   **[`shared_components/js/product-pricing-ui.js`](shared_components/js/product-pricing-ui.js) (`NWCAProductPricingUI`)**:
        *   Listens for the `pricingDataLoaded` event dispatched by the active adapter.
        *   Responsible for rendering and updating the main pricing grid/table in the DOM using the data from the event.
        *   Handles highlighting active pricing tiers and updating other dynamic price displays on the page.
        *   Contains specific table-building functions for different embellishment types (e.g., `_buildScreenPrintPricingTable`).
    *   **[`shared_components/js/pricing-calculator.js`](shared_components/js/pricing-calculator.js)**:
        *   Contains the core `calculatePricing` function.
        *   Takes user selections (sizes, quantities), existing cart quantities (for tiered pricing), and the detailed `pricingData` (from `window.nwcaPricingData` or a similar source prepared by the adapter) to compute unit prices, Less Than Minimum (LTM) fees, setup fees, and other embellishment-specific charges.
        *   Returns a detailed breakdown of calculated prices and fees.
    *   **[`shared_components/js/add-to-cart.js`](shared_components/js/add-to-cart.js)**:
        *   Manages the "Add to Cart" section of the pricing page.
        *   Listens for quantity changes and triggers `updateCartTotal` to recalculate and display the estimated total for the items being configured. This function calls the `pricing-calculator.js`.
        *   When the "Add to Cart" button is clicked (`handleAddToCart`):
            *   Gathers all product data, selected quantities per size, and crucial `embellishmentOptions` (stitch count, back logo, print colors, calculated fees like LTM, setup, flash charges).
            *   Passes this comprehensive `productData` object to `NWCACart.addToCart()`.
        *   Displays success notifications.
    *   **[`shared_components/js/cart.js`](shared_components/js/cart.js) (`NWCACart`)**:
        *   The core cart management system.
        *   Handles cart sessions (local and server-side via API calls to the Heroku proxy).
        *   Manages adding, updating, and removing items and their sizes, both in local state and by syncing with the server.
        *   Enforces cart-wide validation rules (e.g., single embellishment type per cart, cap embroidery stitch count consistency).
        *   Calculates cart totals and counts.
        *   Provides an event system for cart updates.
    *   **[`shared_components/js/cart-price-recalculator.js`](shared_components/js/cart-price-recalculator.js)**:
        *   Listens for cart changes.
        *   Recalculates prices for items already in the cart if a change (like adding more items of the same type) affects their pricing tier or LTM fee status. Updates items via API if necessary.
    *   **[`shared_components/js/product-quantity-ui.js`](shared_components/js/product-quantity-ui.js) (`ProductQuantityUI`)**:
        *   Responsible for creating and managing the UI elements for quantity input, typically per size (e.g., using a matrix table or a grid of size cards).
        *   Called by `add-to-cart.js` or adapters to build this section.
    *   **[`shared_components/js/dp5-helper.js`](shared_components/js/dp5-helper.js) (`DP5Helper`)**:
        *   A utility script involved in updating parts of the pricing UI, especially color swatches (with multiple fallback strategies) and inventory indicators.
        *   It can also update the pricing grid and add-to-cart section, potentially as an older system or for specific fallback scenarios. Its interaction with `ProductQuantityUI` for the add-to-cart section is coordinated to avoid DOM conflicts.
    *   **[`shared_components/js/utils.js`](shared_components/js/utils.js) (`NWCAUtils`)**: Provides common utility functions for currency formatting, string manipulation, URL parameter handling, and size sorting.
    *   **[`shared_components/js/order-form-pdf.js`](shared_components/js/order-form-pdf.js)**: Handles the generation of PDF order forms/quotes using the jsPDF library, typically invoked from specific pages like the BOGO promo.

*   **Data Flow for Master Bundle Pricing (Simplified)**:
    ```mermaid
    graph TD
        A[User Navigates to Pricing Page with Product Context] --> B{Adapter (e.g., DTGAdapter.js) Initializes};
        B --> C{Caspio Iframe Loads};
        CaspioIframe --> D[Caspio Calculates ALL Price Permutations];
        D -- postMessage --> B;
        B --> E{Adapter Stores Master Bundle};
        B -- Extracts Default Config Data --> F{Adapter Dispatches 'pricingDataLoaded'};
        F --> G{ProductPricingUI.js Renders Price Grid};
        F --> H{ProductQuantityUI.js Renders Size Inputs};
        F --> I{AddToCart.js Updates Est. Total Section};
        J[User Changes Option (e.g., Print Location)] --> B;
        B -- Extracts New Config Data from Stored Bundle --> F;
    ```

### 3.2. Specific Pricing Pages

*   **C112 BOGO Cap Promotion (`c112-bogo-promo.html`)**
    *   **Purpose**: A standalone landing page for a "Buy One, Get One 25% OFF" deal on C112 embroidered trucker caps.
    *   **JavaScript**: Primarily uses its own [`c112-bogo-promo.js`](c112-bogo-promo.js).
        *   Handles BOGO-specific pricing logic.
        *   Manages selection of C112 cap colors and quantities.
        *   Calculates BOGO-adjusted totals.
        *   Includes a customer information form.
        *   Submits customer data to `/api/customers` via the Heroku proxy.
        *   Generates a PDF quote using jsPDF.
    *   **Functionality**: Allows users to configure an order for the C112 BOGO deal and generate a PDF quote to be emailed for order finalization. It has a two-column layout with product info/videos on one side and interactive order elements on the other.

*   **Cap Embroidery Pricing (`cap-embroidery-pricing.html`)**
    *   **Purpose**: Dynamic pricing calculator for general cap embroidery, supporting various stitch counts and a back logo option.
    *   **JavaScript**: This is the most complex pricing page, utilizing many shared components and several cap-specific modules:
        *   **Adapters**: [`CapEmbroideryAdapter.js`](shared_components/js/cap-embroidery-adapter.js) (base) and [`cap-embroidery-adapter-enhanced.js`](shared_components/js/cap-embroidery-adapter-enhanced.js) (for back logo and other enhancements). These manage data flow for different stitch counts and the back logo option.
        *   **Back Logo**: [`cap-embroidery-back-logo.js`](shared_components/js/cap-embroidery-back-logo.js) defines the configuration (price, stitch count) for the back logo.
        *   **Enhanced UI/Logic**: [`cap-embroidery-enhanced.js`](shared_components/js/cap-embroidery-enhanced.js) controls the UI for enhanced features like the back logo checkbox and improved stitch count selector.
        *   **Validation**: [`cap-embroidery-validation.js`](shared_components/js/cap-embroidery-validation.js) handles specific validation rules:
            *   Product title must contain "Cap".
            *   All caps in the cart must have the same stitch count (user is prompted via modal if a mismatch occurs).
            *   Manages display of LTM fee information.
        *   **Cart Integration**: [`cap-embroidery-cart-integration.js`](shared_components/js/cap-embroidery-cart-integration.js) integrates these validations into the cart process.
    *   **Functionality**: Users select cap style (via URL), color, stitch count (5k, 8k, 10k), and optionally a back logo. The page displays dynamic pricing based on quantity tiers and selected options. It enforces LTM fees ($50 for < 24 caps). Integrates with the main cart system.
    *   **Note**: Several `.md` files detail refactoring efforts and fixes for this page, particularly around stitch count selection, LTM fee display, and back logo pricing display.

*   **DTG Pricing (`dtg-pricing.html`)**
    *   **Purpose**: Dynamic pricing for Direct-to-Garment printing.
    *   **JavaScript**: Uses [`shared_components/js/dtg-adapter.js`](shared_components/js/dtg-adapter.js).
    *   **Functionality**: Follows the "Master Bundle" approach. Users can select print locations (e.g., Full Front, Left Chest) via a dropdown on the page. The adapter receives a master bundle with pricing for all locations and dispatches data for the selected location to shared UI components.

*   **Screen Print Pricing (`screen-print-pricing.html`)**
    *   **Purpose**: Dynamic pricing for screen printing, considering number of print colors and potentially additional locations.
    *   **JavaScript**: Uses [`shared_components/js/screenprint-adapter.js`](shared_components/js/screenprint-adapter.js).
    *   **Functionality**: Planned to follow the "Master Bundle" approach. Caspio will send a bundle with pricing for 1-6 colors for primary and additional locations. The adapter allows users to select the number of colors and an additional location option, then dispatches the relevant pricing data. This page also handles setup fees and flash charges specific to screen printing.
    *   **Note**: `screen-print-refactor-plan.md` details the comprehensive plan for this page.

*   **DTF Pricing (`dtf-pricing.html`)**
    *   **Purpose**: Pricing for Direct-to-Film transfers.
    *   **JavaScript**: Uses [`shared_components/js/dtf-adapter.js`](shared_components/js/dtf-adapter.js).
    *   **Functionality**: **Unique Architecture**: This page **does not use Caspio** for its pricing calculations. Instead, it relies on a custom JavaScript calculator within the adapter (`calculateDTFPrice`) and hardcoded/configured pricing data (`DTF_CONFIG` within the adapter). Users select options like transfer size and number of locations.
    *   **Note**: This is a significant deviation from the Caspio-driven model of other pages.

*   **General Embroidery Pricing (`embroidery-pricing.html`)**
    *   **Purpose**: Dynamic pricing for general (non-cap) embroidery.
    *   **JavaScript**: Likely uses a generic embroidery adapter or is the basis from which `CapEmbroideryAdapter` was derived. It features a stitch count selector (1k-15k) and an additional logo checkbox.
    *   **Note**: This page was mentioned in `unified-pricing-page-plan.md` as a stable reference page.

### 3.3. Cart System Details

*   **Single Embellishment Type**: The cart system, primarily managed by [`shared_components/js/cart.js`](shared_components/js/cart.js), enforces a rule that only one type of embellishment (e.g., DTG, Screen Print) can be in the cart at a time. Users are prompted if they try to mix types.
*   **Cap Embroidery Stitch Count Consistency**: As detailed above, all cap embroidery items in the cart must share the same stitch count.
*   **Fee Handling**: The cart system is designed to store and sum various fees passed in `embellishmentOptions` (LTM, setup, flash charges, back logo fees) for accurate final totals.
*   **Server Sync**: Cart data is persisted locally and synced with the backend via API calls managed by `NWCACart`.

## 4. Shared Components (CSS)

*   **[`shared_components/css/shared-pricing-styles.css`](shared_components/css/shared-pricing-styles.css)**: Provides base styling for consistency across pricing pages (layout, typography, form elements).
*   **[`shared_components/css/modern-enhancements.css`](shared_components/css/modern-enhancements.css)**: Adds further modern styling touches.
*   **[`main.css`](main.css)**: Main stylesheet for `index.html` and potentially global styles.
*   **[`pricing-pages.css`](pricing-pages.css)**: Styles specific to the general structure of pricing pages.
*   **Inline Styles & Page-Specific Styles**: Many pages also contain extensive `<style>` blocks for page-specific adjustments or component-level styling. The `unified-pricing-page-plan.md` suggests a move towards more centralized CSS and design tokens.

## 5. Backend & Data Sources

*   **Caspio**: The primary backend and data source for most product information and detailed pricing matrices. Accessed via embedded DataPages within hidden iframes on the pricing pages.
*   **Heroku Proxy Server ([`server.js`](server.js))**:
    *   A Node.js/Express.js application running on Heroku (e.g., `https://caspio-pricing-proxy-ab30a049961a.herokuapp.com`).
    *   **Serves Static Files**: Delivers all HTML, CSS, and JS files to the client.
    *   **API Proxy**: Relays API requests from the client-side JavaScript to the Caspio backend, handling authentication securely. Key proxied endpoints include:
        *   `/api/inventory`: For stock levels.
        *   `/api/cart-sessions`, `/api/cart-items`, `/api/cart-item-sizes`: For all cart operations.
        *   `/api/customers`: For customer data (e.g., used by BOGO promo).
        *   `/api/pricing-matrix` & `/api/pricing-matrix/lookup`: For fetching or storing pricing matrix data.
        *   `/api/product-colors`: Custom endpoint to fetch product color information and images.
    *   Provides utility endpoints like `/api/image-proxy` (rarely used by pricing pages for display) and `/api/cart-integration.js`.

## 6. Build/Dependencies

*   **[`package.json`](package.json)**: Indicates the use of Node.js and npm, likely for:
    *   Managing server dependencies (Express.js, etc.).
    *   Running the local development server (`npm start` executes `server.js`).
    *   Potentially for build tools, linters, or testing frameworks (though not explicitly detailed in provided docs).
*   **Client-Side Libraries**:
    *   jsPDF & jsPDF-AutoTable: Used for PDF generation (e.g., in `c112-bogo-promo.html` and `order-form-pdf.js`).
    *   Font Awesome: For icons.

## 7. Known Issues & Future Enhancements (Summary from Docs)

*   **Technical Debt**: Code duplication, inconsistencies in styling and JS, hardcoded values.
*   **Caspio Integration**: Can be fragile; "Master Bundle" approach aims to improve this.
*   **DTF Page**: Current custom/hardcoded implementation is an outlier; plans exist to standardize it.
*   **Planned Enhancements**:
    *   Full online ordering system.
    *   New pricing pages for "Laser Engraving" and "Stickers".
    *   UI/UX standardization (component library, design tokens).
    *   Improved performance and accessibility.
    *   Bulk stitch count changes in cart, saving stitch count preferences.

This README provides a detailed overview of the NWCA Online Catalog & Pricing System, intended to help developers understand its architecture, key components, and data flow.

## 8. Potential Areas for Site Improvement

Based on an analysis of the existing codebase and documentation, the following areas present opportunities for enhancement and modernization:

### 8.1. Code Standardization & Consistency
*   **Reduce Duplication**: Systematically identify and refactor repeated code blocks in JavaScript (e.g., common logic in adapters, UI update routines) and CSS (e.g., styling for similar UI elements across different pages).
*   **Naming Conventions**: Establish and enforce consistent naming conventions for files, functions, variables (JavaScript), and CSS classes throughout the project to improve readability and maintainability.
*   **Modern JavaScript Practices**: Standardize on modern ES6+ features (e.g., `async/await` for asynchronous operations, classes for object-oriented patterns, modules for better organization if a build step is introduced) across all JavaScript files.
*   **Separation of Concerns**: Reinforce the separation of logic (JavaScript), structure (HTML), and presentation (CSS). Minimize inline styles and scripts, and ensure JavaScript modules have clearly defined, focused responsibilities.
*   **Configuration Management**: Externalize hardcoded values (e.g., LTM fee amounts, specific UI text strings, non-API URLs) into dedicated configuration files or JavaScript constant modules, as suggested in existing planning documents.

### 8.2. UI/UX Unification & Enhancement
*   **Visual Consistency**: Develop and apply a unified design system or a set of design tokens (as proposed in `docs/pricing-pages-analysis-and-improvement-plan.md`) to standardize button styles, form elements, spacing, padding, and color palettes across all pricing pages.
*   **Interaction Patterns**: Ensure consistent behavior and appearance for common UI elements like dropdown menus, loading state indicators, modal dialogs, and form validation feedback.
*   **Mobile Responsiveness**: Conduct a thorough review and systematically enhance mobile responsiveness for all pricing pages to ensure a consistent and optimal user experience across various devices and screen sizes.
*   **User Feedback**: Standardize the visual appearance, messaging, and behavior of success notifications, error messages, and loading indicators to provide clear and consistent feedback to the user.
*   **Navigation**: Ensure "Back to Product" functionality, URL parameter handling, and any tab-like navigation elements behave consistently across all relevant pages.

### 8.3. Caspio Integration & Data Flow
*   **Master Bundle Refinement**: Continue the rollout and refinement of the "Master Bundle" approach for all Caspio-driven pricing pages. This ensures comprehensive pricing data is fetched once per product context, and UI updates for option changes are handled client-side, improving performance and robustness.
*   **Error Handling & Fallbacks**: Standardize error handling for Caspio data fetching (including `postMessage` communication for Master Bundles). Implement clear user feedback mechanisms or fallback UIs when Caspio data is unavailable or fails to load.

### 8.4. DTF Page Architecture Alignment
*   The [`dtf-pricing.html`](dtf-pricing.html) page currently uses a custom calculator and hardcoded data, deviating from the Caspio-driven model of other pages. Evaluate strategies to align its architecture more closely with the standardized approach. This could involve:
    *   Externalizing its pricing logic into a more manageable configuration file (improving upon the current `DTF_CONFIG` within the adapter).
    *   Exploring if parts of the Master Bundle data flow or adapter pattern could be adapted, even if Caspio isn't the direct data source, to promote consistency in how it interacts with shared UI components.

### 8.5. JavaScript Modularity & Management
*   **File Organization**: Clarify the roles and responsibilities of JavaScript files, particularly where similarly named files exist in the root directory and the `shared_components/js/` directory. Prioritize `shared_components/js/` as the location for active, modular, and reusable code.
*   **Global Scope Management**: Minimize reliance on global `window` objects for sharing data or functionality between modules. Where modules need to interact, prefer well-defined interfaces on shared objects (like `NWCACart`, `NWCAProductPricingUI`) or consider adopting ES6 modules if a build system is introduced in the future.
*   **Adapter Pattern Consistency**: Continue to refine and consistently apply the adapter pattern for each embellishment type. Ensure adapters provide a standardized interface to the shared pricing calculation and UI rendering components.

### 8.6. Performance Optimization
*   **Image Loading**: Implement lazy loading for product images and thumbnails, especially in galleries and long swatch lists.
*   **Code Efficiency**: Review critical JavaScript execution paths, particularly in price calculation loops and DOM manipulation routines, for potential performance bottlenecks.
*   **Caching Strategies**: Beyond browser caching for static assets, explore caching strategies for frequently accessed API data (e.g., product details, pricing matrices if not using the full master bundle immediately) to reduce redundant fetches.

### 8.7. Accessibility (A11y)
*   Conduct a thorough accessibility audit of all pricing pages and cart functionality.
*   Implement improvements to meet WCAG 2.1 AA guidelines, including but not limited to:
    *   Ensuring all interactive elements are keyboard navigable and operable.
    *   Providing appropriate ARIA attributes for dynamic content and custom controls.
    *   Ensuring sufficient color contrast for text and UI elements.
    *   Providing descriptive `alt` text for all informative images.
    *   Managing focus effectively, especially in modals and dynamic UI sections.

### 8.8. API Proxy Server (`server.js`) Enhancements
*   **Endpoint Review**: Implement relevant optimization suggestions from `docs/heroku-api-endpoints.md`, such as consolidating product-related endpoints or adding bulk operations for cart items if these changes would yield performance or maintainability benefits.
*   **Documentation**: Ensure all actively used custom API endpoints (like `/api/product-colors`) are fully documented within `docs/heroku-api-endpoints.md`.
*   **Security & Robustness**: Regularly review security best practices for the proxy server, including dependency updates and input validation on any parameters passed to Caspio.