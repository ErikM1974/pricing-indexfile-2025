# Guide for Implementing New Embellishment Pricing Pages

This guide outlines a structured approach to adding new embellishment type pricing pages (e.g., DTG, Embroidery, DTF) to the system, drawing lessons from the screen print implementation. The goal is to achieve correct functionality efficiently by standardizing data flow and interfaces.

## Lessons Learned & Common Challenges

1.  **Evolving/Inconsistent Data Structures:**
    *   The primary challenge was ensuring the data format produced by an embellishment's data source (Caspio, adapter) matched what shared components like `pricing-calculator.js` expected.
    *   **Solution:** Standardize the `window.nwcaPricingData` object structure and the data passed in `pricingDataLoaded` events.

2.  **Browser Caching:**
    *   Changes to JavaScript files often weren't immediately reflected due to browser caching, leading to confusion.
    *   **Solution:** Always perform aggressive cache clearing (hard refresh) after JS changes during development.

3.  **Shared Component Interdependencies:**
    *   Modifying shared scripts (`pricing-calculator.js`, `add-to-cart.js`) requires careful consideration of impacts on all embellishment types using them.
    *   **Solution:** Aim for shared components to have clear, stable APIs. Adapters should conform to these APIs. Use type-specific conditional logic sparingly within shared components, preferring it in adapters or type-specific UI scripts.

4.  **Fee Complexity & Propagation:**
    *   Different embellishments have unique fee structures (setup, per-item, LTM). Ensuring these are calculated, passed to the cart, and correctly summed by the cart system is crucial.
    *   **Solution:** The `pricing-calculator.js` should handle complex fee calculations. `add-to-cart.js` must pass all relevant fee components in `productData.embellishmentOptions`. The cart system (`NWCACart.js`, `cart-ui.js`) must be aware of and correctly use these stored fees.

5.  **Debugging Visibility:**
    *   Lack of detailed console logging initially made troubleshooting difficult.
    *   **Solution:** Implement comprehensive logging at key data handoff points in all new adapters and UI scripts.

## Standardized Data Flow Diagram

```mermaid
graph TD
    A[Raw Data Source: Caspio/API/HTML] --> B{Embellishment-Specific Adapter (e.g., new-adapter.js)};
    B -- Populates --> C[Standardized `window.nwcaPricingData` Object];
    C -- Used by --> D{`add-to-cart.js`};
    D -- Calls with `window.nwcaPricingData` --> E[`pricing-calculator.js v2.0`];
    E -- Returns calculation result --> D;
    D -- Updates --> F[On-Page UI (Est. Total in Add-to-Cart section)];
    D -- Assembles `productData` (with fees in `embellishmentOptions`) --> G{`NWCACart.addToCart()`};
    B -- Dispatches `pricingDataLoaded` event (with `event.detail` for UI) --> H{UI Rendering Script (e.g., `product-pricing-ui.js` or page-specific UI script)};
    H -- Builds/Updates --> I[Main Pricing Tables/Display on Page];
    G -- Stores item with detailed options/fees --> J[Cart System: `NWCACart.js` & Backend];
    J -- Data used by --> K[`cart-price-recalculator.js`];
    K -- Updates prices in cart data --> J;
    J -- Data used by --> L[`cart-ui.js` / Cart Page Rendering];
    L -- Displays --> M[Final Cart View & Totals (including all fees)];
```

## Step-by-Step Guide for New Embellishment Pages

### Phase 1: Data Sourcing & Transformation (New Adapter - e.g., `your-type-adapter.js`)

*   **Objective:** Fetch raw pricing data for the new embellishment type and transform it into two critical, standardized data structures:
    1.  The `window.nwcaPricingData` object.
    2.  The `event.detail` object for the `pricingDataLoaded` event.
*   **Adapter's Responsibilities:**
    1.  **Fetch/Receive Raw Data:** Interface with the data source (Caspio iframe postMessage, API call, etc.).
    2.  **Populate `window.nwcaPricingData`:**
        *   This object is primarily consumed by `pricing-calculator.js` (via `add-to-cart.js`).
        *   **Required Structure for `window.nwcaPricingData` (Contract for `pricing-calculator.js v2.0`):**
            *   `styleNumber`: (String) e.g., "PC61"
            *   `color`: (String) e.g., "Athletic Hthr"
            *   `embellishmentType`: (String) e.g., "dtg", "embroidery" (must match `detectEmbellishmentType()` output)
            *   `uniqueSizes`: (Array of Strings) e.g., `["S", "M", "L", "XL"]`
            *   `prices`: (Object) Maps sizes to an object of tier-prices.
                *   Example: `{"S": {"12-23": 10.00, "24-47": 9.00}, "2XL": {"12-23": 12.00, "24-47": 11.00}}`
            *   `tierData`: (Object) Maps tier labels/keys to tier definitions.
                *   Example: `{"12-23": {MinQuantity: 12, MaxQuantity: 23, LTM_Fee: 50.00}, "24-47": {MinQuantity: 24, MaxQuantity: 47}}`
                *   `LTM_Fee` is optional per tier.
            *   `DEFAULT_SETUP_FEE_PER_COLOR`: (Number, Optional) If setup is per color and uniform.
            *   `DEFAULT_SETUP_FEE_OVERALL`: (Number, Optional) If setup is a single flat fee.
            *   `DEFAULT_FLASH_CHARGE_PER_ITEM`: (Number, Optional) Per-item flash charge if applicable.
            *   `LTM_MINIMUM_QUANTITY`: (Number, Optional) Global LTM minimum if not defined per-tier.
            *   `LTM_FEE_VALUE`: (Number, Optional) Global LTM fee value if not defined per-tier.
            *   `additionalLocationPricing`: (Object, Optional) For additional location costs, structured by color count:
                *   `{"1": {tiers: [{label, minQty, maxQty, pricePerPiece, ltmFee}], setupFee: Number}, "2": { /* for 2 colors */ } ...}`
    3.  **Dispatch `pricingDataLoaded` Event:**
        *   This event is primarily consumed by UI scripts (like `product-pricing-ui.js`) to build tables.
        *   **Required Structure for `event.detail`:**
            *   `embellishmentType`: (String) e.g., "dtg"
            *   `uniqueSizes`: (Array of Strings) e.g., `["S", "M", "L"]`
            *   `tiers`: (Array of Tier Objects for UI) Each tier object should contain prices for all `uniqueSizes` for that specific tier.
                *   Example: `[{label: "12-23", minQty: 12, maxQty: 23, prices: {"S": 10.00, "M": 10.00, "L": 10.00}, ltmFee: 50.00, setupFeePerColor: 30}, ...]`
                *   Note: The `prices` sub-object here maps sizes to their price *within that tier*.
            *   `fees`: (Object, Optional) For display in table footers or notes. e.g., `{setup: "30.00 per color", flash: "0.35 if applicable"}`.
            *   `fullAdditionalLocationPricing`: (Object, Optional) The complete `additionalLocationPricing` object as described above, if applicable.
    4.  **Handle UI Controls:** If the page has specific controls (e.g., DTG print size dropdown, embroidery stitch count input), the adapter should listen to changes, re-fetch/re-calculate data if necessary, update `window.nwcaPricingData`, and re-dispatch the `pricingDataLoaded` event.

### Phase 2: Pricing Calculator (`shared_components/js/pricing-calculator.js v2.0`)

*   **No changes should be needed here** if Phase 1 correctly populates `window.nwcaPricingData`.
*   The calculator will use the `prices`, `tierData`, and default fee/LTM properties from `window.nwcaPricingData` to determine `baseUnitPrice`, `ltmFeePerItem`, `ltmFeeTotal`, `setupFee` (overall), `flashCharge` (overall), and `totalPrice`.

### Phase 3: Add to Cart Logic (`shared_components/js/add-to-cart.js`)

*   This script uses `window.nwcaPricingData` for all embellishment types to feed the calculator.
*   **Customization Point:** Inside `handleAddToCart()`, when creating `embellishmentOptionsForCart`, add any properties specific to the new embellishment type that need to be stored with the cart item (e.g., `dtgPrintSize`, `embroideryThreadColor`).
    ```javascript
    // ... inside handleAddToCart, after calculatedPricing is available ...
    let embellishmentOptionsForCart = {
        numberOfColors: /* ... from UI or calculatedPricing ... */,
        setupFee: typeof window.cartItemData.setupFee === 'number' ? window.cartItemData.setupFee : 0,
        flashCharge: typeof window.cartItemData.flashCharge === 'number' ? window.cartItemData.flashCharge : 0,
        ltmFeeApplies: window.cartItemData.ltmFeeApplies || false,
        ltmFeeTotal: window.cartItemData.ltmFeeTotal || 0
    };

    if (pageEmbType === 'your-new-type') {
        // Add/modify properties specific to 'your-new-type'
        // embellishmentOptionsForCart.yourSpecificOption = document.getElementById('your-option-input').value;
        // embellishmentOptionsForCart.anotherFee = calculatedPricing.anotherFeeSpecificToThisType || 0;
    }
    // ... then productData.embellishmentOptions = embellishmentOptionsForCart; ...
    ```

### Phase 4: UI Display (Page-Specific HTML & JS, or `product-pricing-ui.js`)

*   **HTML:** Create the necessary HTML structure for pricing tables, quantity inputs, and specific option selectors for the new embellishment type.
*   **JavaScript:**
    *   If the table structure is significantly different from screen print, create a new UI script (e.g., `dtg-pricing-ui.js`).
    *   If using/extending `product-pricing-ui.js`:
        *   Ensure the `pricingDataLoaded` event dispatched by your new adapter (Phase 1) provides `event.detail.tiers`, `event.detail.uniqueSizes`, etc., in the format expected by the table-building functions (e.g., `_buildScreenPrintPricingTable` or a new `_buildYourTypeTable` function).
        *   Modify `_handlePricingDataForTable` to call your new table-building function based on `event.detail.embellishmentType`.
        *   Cache any new DOM elements in `_cacheDOMElements`.

### Phase 5: Cart System Integration (`NWCACart.js`, `cart-ui.js`, `cart-price-recalculator.js`)

*   **`NWCACart.js` (Core Cart Logic):**
    *   **Storage:** Ensure `addToCart` method correctly saves the entire `productData.embellishmentOptions` object (containing specific fees like setup, flash, and any custom options for the new type) with the cart item in your backend/Caspio and local storage.
    *   **Retrieval:** Ensure `getCartItems` retrieves and returns these stored `embellishmentOptions` as part of each cart item object.
*   **`cart-price-recalculator.js`:**
    *   If the new embellishment type has complex fee recalculation needs beyond LTM (e.g., setup fees that change based on total cart quantity of that type, or different flash charge logic), you may need to add a specific case for `embellishmentType === 'your-new-type'`.
    *   It should access the item's stored `embellishmentOptions` (retrieved via `NWCACart.getCartItems()`) to apply these fees correctly when recalculating unit prices for the cart.
*   **`cart-ui.js` (Cart Page Rendering):**
    *   **Display:** Update to correctly display any specific options or itemized fees from `item.embellishmentOptions` for the new embellishment type.
    *   **Total Calculation:** Ensure the final line item totals and the grand cart total correctly incorporate all applicable fees. This usually means:
        *   Sum of `(quantity * unitPrice)` for all sizes (where `unitPrice` is the base price for the tier).
        *   Add any one-time `setupFee` from `item.embellishmentOptions`.
        *   Add any total `flashCharge` from `item.embellishmentOptions` (if not already per-item in `unitPrice`).
        *   Add any `ltmFeeTotal` from `item.embellishmentOptions` (if not already per-item in `unitPrice`).

## Key Principles for Success:

1.  **Standardize Data Interfaces:** The structure of `window.nwcaPricingData` (for the calculator) and `event.detail` of `pricingDataLoaded` (for UI) are critical contracts. Define them clearly and make adapters conform.
2.  **Isolate Embellishment Logic:** Keep embellishment-specific data transformation and UI control logic within its dedicated adapter and page-specific UI scripts as much as possible.
3.  **Incremental Testing & Robust Logging:** Test each phase thoroughly. Use `console.log` extensively to inspect data objects at each handoff point.
4.  **Cache Management:** Always use hard refreshes during development.
5.  **Shared Components are Sacred:** Modify shared components (`pricing-calculator.js`, `add-to-cart.js`, `NWCACart.js`) with extreme care, ensuring backward compatibility or a clear migration path for all embellishment types. Prioritize making adapters smarter over making shared components overly complex with type-specific conditional logic.

By adhering to these principles and the phased approach, implementing new embellishment pages should become a more predictable and streamlined process.