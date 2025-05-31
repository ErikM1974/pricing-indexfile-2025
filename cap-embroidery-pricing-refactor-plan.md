# Plan: Refactor Cap Embroidery Pricing with Client-Side Stitch Count Selection

**Objective:** Modify the cap embroidery pricing page (`cap-embroidery-pricing.html`) to allow users to select stitch counts (5000, 8000, 10000) via a dropdown on the main page. Caspio will calculate all price sets upfront and provide them as a data bundle. The main page will then dynamically display prices based on the user's selection from this new dropdown and enforce specific cart rules.

## Part 1: Caspio Datapage Modifications

**Goal:** Configure the Caspio datapage to calculate price profiles for all relevant stitch counts upon load, bundle this data, and dispatch it to the parent HTML page. The datapage should also remain fully functional for internal preview with its existing interactive dropdown and table.

**1. JavaScript Logic Enhancements (within Caspio HTML Blocks):**

    *   **Triggering Mechanism (in `Footer` script):**
        *   The `document.addEventListener('DataPageReady', ...)` will initiate a new master function (e.g., `initiateMasterPriceBundleGeneration`) responsible for generating and dispatching the complete price data bundle for all stitch counts.
        *   The existing `attachDp7DropdownListener()` and `triggerDp7Processing()` functions (driven by the internal Caspio dropdown) will be preserved to ensure the Caspio preview works as it does currently for a single selected stitch count. When `triggerDp7Processing` is called by the *internal* Caspio dropdown, it will update Caspio's *internal* table for preview purposes but will not need to re-dispatch the master data bundle.

    *   **Master Data Bundle Generation (New/Modified logic, likely in `HTML Block 1` or a new `HTML Block 4`):**
        *   A new primary function, e.g., `async function generateAndDispatchMasterPriceBundle()`, will be created.
        *   This function will:
            1.  Call `fetchInitialDp7Data()` (from existing `HTML Block 1`) once to retrieve common data:
                *   Tier Definitions (`window.dp7ApiTierData`)
                *   Pricing Rules (`window.dp7ApiRulesData`)
                *   Base Item Prices for the style (`window.dp7ApiSizeData`)
                *   Size Headers (`window.dp7GroupedHeaders` - derived after `window.dp7ApiSizeData` is processed)
            2.  Define the target stitch counts: `const stitchCountsToProcess = ["5000", "8000", "10000"];`
            3.  Initialize an empty object: `let allCalculatedPriceProfiles = {};`
            4.  Loop (asynchronously if needed due to API calls) through each `sCount` in `stitchCountsToProcess`:
                *   Call a modified version of `fetchCostsAndCalculateDp7Prices(sCount)` (see modification below). This function will now *return* the calculated price profile object for the given `sCount`.
                *   Store the returned profile: `allCalculatedPriceProfiles[sCount] = await fetchAndCalcProfileForStitchCount(sCount);` (assuming `fetchCostsAndCalculateDp7Prices` is refactored to be awaitable and return the profile).
            5.  After the loop, `allCalculatedPriceProfiles` will contain the price data for all specified stitch counts.
            6.  Call the modified `dispatchCaspioCalculatedEvent` (see below) to send the bundled data.

    *   **Price Profile Calculation (Modified `fetchCostsAndCalculateDp7Prices` in `HTML Block 2`):**
        *   This function will be refactored to:
            *   Accept `selectedStitchCount` as a parameter.
            *   Perform its existing logic to fetch embroidery costs for that *specific* stitch count and calculate the price profile (prices for all sizes and tiers for that stitch count).
            *   Instead of setting global variables like `window.dp7FullPriceProfiles` directly for UI update *within Caspio for this specific call*, it will **return** the calculated price profile object.
            *   The part of this function that calls `groupAndBuildDp7Table` might only be invoked if the function is called by the *internal* Caspio dropdown flow, not by the master bundle generation loop, to avoid unnecessary DOM updates in the hidden iframe.

    *   **Data Dispatch (Modified `dispatchCaspioCalculatedEvent` in `HTML Block 3`):**
        *   This function will be updated to accept the `allCalculatedPriceProfiles` bundle, `groupedHeaders`, `tierDefinitions`, and `pricingRules`.
        *   It will construct the `event.detail` object for the `caspioCapPricingCalculated` custom event to include:
            *   `allPriceProfiles`: The `allCalculatedPriceProfiles` object.
            *   `groupedHeaders`: The array of size headers.
            *   `tierDefinitions`: The object/array of tier definitions.
            *   `pricingRules`: The object of pricing rules.
        *   The `groupAndBuildDp7Table()` function (also in `HTML Block 3`) will primarily serve the Caspio preview functionality when its internal dropdown is used.

**2. Data Structure for Dispatched Bundle (Example):**
    ```javascript
    // Structure of event.detail for 'caspioCapPricingCalculated'
    {
      success: true,
      allPriceProfiles: {
        "5000": { /* e.g., {"S/M": {"1-23": 16.00, "24-47": 15.00}, "L/XL": {...}} */ },
        "8000": { /* ... */ },
        "10000": { /* ... */ }
      },
      groupedHeaders: ["S/M", "L/XL", "2XL"], // Example
      tierDefinitions: { /* Object or array of tier details */ },
      pricingRules: { /* RoundingMethod, etc. */ }
    }
    ```

## Part 2: Client-Side Modifications (`cap-embroidery-pricing.html` & Associated JavaScript)

**Goal:** Implement a client-side stitch count dropdown, receive the bundled price data from the (hidden) Caspio iframe, dynamically update the pricing display, and enforce cart business rules.

**1. HTML Changes (`cap-embroidery-pricing.html`):**
    *   Add a new, visible stitch count dropdown menu:
        ```html
        <div class="stitch-count-selector-container" style="text-align: center; margin-bottom: 20px;">
            <label for="client-stitch-select" style="margin-right: 10px; font-weight: bold;">Select Stitch Count:</label>
            <select id="client-stitch-select" style="padding: 8px; border-radius: 4px;">
                <option value="5000">5,000 Stitches (Low)</option>
                <option value="8000" selected>8,000 Stitches (Standard)</option>
                <option value="10000">10,000 Stitches (High)</option>
            </select>
        </div>
        ```
    *   The Caspio iframe container (e.g., `<div id="pricing-calculator">`) will be styled to be hidden (e.g., `display: none;`) but must remain in the DOM for its scripts to execute.

**2. JavaScript Logic Changes (Main Page Scripts):**

    *   **Data Reception and Storage (e.g., in `shared_components/js/cap-embroidery-adapter.js` or `shared_components/js/pricing-pages.js`):**
        *   Listen for the `caspioCapPricingCalculated` custom event dispatched by the Caspio iframe.
        *   On event receipt, extract and store the `allPriceProfiles`, `groupedHeaders`, `tierDefinitions`, and `pricingRules` from `event.detail` into accessible JavaScript variables (e.g., a `masterPricingData` object).
        *   Once data is stored, trigger an initial display update for the default selected stitch count.

    *   **Dynamic Pricing Display (e.g., in `shared_components/js/pricing-pages.js` and `shared_components/js/product-pricing-ui.js`):**
        *   Create/use a function `displayPricesForStitchCount(selectedStitchValue)`:
            *   Retrieves the specific price profile for `selectedStitchValue` from the stored `masterPricingData.allPriceProfiles`.
            *   Uses this profile, along with stored `groupedHeaders` and `tierDefinitions`, to populate/update the main page's pricing table (e.g., `#custom-pricing-grid`) via `product-pricing-ui.js`.
        *   Attach an event listener to the new `#client-stitch-select` dropdown. On change, call `displayPricesForStitchCount` with the new value.

    *   **Cart Integration and Business Rules (e.g., in `shared_components/js/add-to-cart.js`, `shared_components/js/cart.js`, `shared_components/js/cart-integration.js`):**
        *   **Item Data:** When adding items to the cart:
            *   Include the currently selected `stitchCount` from `#client-stitch-select`.
            *   Include an `embellishmentType` property (e.g., `embellishmentType: "CapEmbroidery"`). This might be hardcoded for this page or derived from page context.
        *   **Cart Validation Logic:**
            1.  **Single Embellishment Type:** Before adding an item, check if the cart contains items with a different `embellishmentType`. If so, prevent adding and notify the user (e.g., "Please clear cart or complete existing order before adding items with a different decoration type.").
            2.  **Single Stitch Count for Cap Embroidery:** If the item being added is `embellishmentType: "CapEmbroidery"`, check if other "CapEmbroidery" items already in the cart have a *different* `stitchCount`. If so, prevent adding and notify the user (e.g., "Only one stitch count for cap embroidery is allowed per order. Current cart has X stitches.").
        *   Ensure unit prices used for cart calculations are sourced from the currently displayed price profile (based on selected stitch count and quantity).

## Implementation Workflow:

1.  **Plan Approval:** User approves this markdown plan.
2.  **Caspio JavaScript Modification:**
    *   User provides current code for Caspio HTML Blocks (Footer, Block 1, 2, 3).
    *   A "Code" mode assistant rewrites these scripts according to Part 1 of this plan.
    *   User pastes updated code back into Caspio.
    *   User tests Caspio preview and verifies it still works as expected for single stitch count display.
3.  **Client-Side HTML & JavaScript Modification:**
    *   A "Code" mode assistant implements the changes outlined in Part 2 of this plan on `cap-embroidery-pricing.html` and its associated JS files.
4.  **Testing:**
    *   Verify the main page correctly receives the data bundle from the hidden Caspio iframe.
    *   Test the new client-side stitch count dropdown: ensure it correctly updates the pricing table.
    *   Test "Add to Cart" functionality, including the new cart validation rules.
    *   Test quantity-based price changes with the new setup.

This plan should provide a clear roadmap for the required changes.