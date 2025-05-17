# Screen Print Pricing Page Refactor Plan (Master Bundle Approach)

This document outlines the technical plan for refactoring the `screen-print-pricing.html` page to utilize the "Master Bundle" approach for pricing data, aligning its architecture with `dtg-pricing.html` and `embroidery-pricing.html`. This approach leverages a Caspio DataPage to fetch comprehensive pricing data, processes it into a "Master Bundle" structure, and integrates it with shared UI modules via a JavaScript adapter, promoting code reuse and maintainability. The plan incorporates detailed feedback and recommendations for a robust and user-friendly implementation, including specific implementation notes for the Caspio DataPage.

## 1. Caspio DataPage Modifications

The existing Screen Print Caspio XML (DP8 Screen Print Pricing_Caspio-Proxy) needs significant modifications to fetch and process pricing for all relevant color permutations (1-6 colors for primary and additional locations) within a single DataPage load and dispatch this data via `postMessage` instead of rendering UI directly. Specific implementation notes are included below to guide these changes within the 10,000-character limit per HTML block.

*   **Data Fetching:** Modify the data source queries within the Caspio DataPage to retrieve pricing data for all required color counts (1-color, 2-color, ..., 6-color) for both primary and additional locations. This might involve joining or querying the pricing tables multiple times or restructuring the Caspio data source if necessary to efficiently retrieve this comprehensive dataset. Leverage parallel API calls via `Promise.all` as already implemented in the existing XML to minimize latency. Update `initDp8ApiFetch` in HTML Block 1 to fetch data for all colors (1–6) without relying on a selected color count.
*   **Implementing `postMessage` for Master Bundle:** In HTML Block 3, construct the `screenPrintMasterBundle` JSON object using the data stored in `window.dp8State` and dispatch it via `window.parent.postMessage()` with the type `'caspioScreenPrintMasterBundleReady'`. The structure should be detailed, including quantity breaks, prices per size/piece, and relevant fees (LTM, setup, flash charges) within each nested object:

```json
{
  "primaryLocation": {
    "1": {
      "tiers": [
        { "label": "13-36", "minQty": 13, "maxQty": 36, "prices": { "S": 10.50, "M": 11.00, "L": 11.50 }, "ltmFee": 5.00 },
        { "label": "37-72", "minQty": 37, "maxQty": 72, "prices": { "S": 9.50, "M": 10.00, "L": 10.50 }, "ltmFee": 0 }
        // ... more tiers
      ],
      "setupFee": 30.00,
      "flashCharge": 0.50
    },
    "2": { /* pricing data for 2 colors */ },
    // ... up to 6
    "6": { /* pricing data for 6 colors */ }
  },
  "additionalLocation": {
    "1": {
      "tiers": [
        { "label": "13-36", "minQty": 13, "maxQty": 36, "pricePerPiece": 2.50, "ltmFee": 5.00 },
        { "label": "37-72", "minQty": 37, "maxQty": 72, "pricePerPiece": 2.00, "ltmFee": 0 }
        // ... more tiers
      ],
      "setupFee": 30.00,
      "flashCharge": 0.50
    },
    "2": { /* pricing data for 2 colors */ },
    // ... up to 6
    "6": { /* pricing data for 6 colors */ }
  }
}
```
Example implementation snippet for HTML Block 3 (ensure it stays within the character limit):
```javascript
const bundle = {
  primaryLocation: {}, // Populate from window.dp8State
  additionalLocation: {} // Populate from window.dp8State
};
// Logic to populate bundle from dp8State...

window.parent.postMessage({type: 'caspioScreenPrintMasterBundleReady', data: bundle}, '*');
```

*   **Removing UI Rendering:** Delete all HTML and CSS from the `<PageHeader>`, including `<table>` and `<select id="sp-color-select">`. Remove UI-related logic from HTML Blocks 1–4, such as `mainTableBody.innerHTML` and `noteDiv.textContent` updates. Delete HTML Block 4 entirely, as it handles table building which will now be done on the parent page.
*   **Decoupling Color Dropdown:** Remove the change event listener on `sp-color-select` from the footer (e.g., remove the call to `attachDp8DropdownListener`). The dropdown's function within the Caspio environment should be limited to internal preview or debugging if desired, but it should not trigger data fetching or UI updates relevant to the parent page.
*   **Avoiding Hardcoded Values:** Replace hardcoded values found in the existing XML, such as the LTM tier ('13-36'), default setup fee ($30.00), and the "37+" note, with dynamic logic based on fetched pricing rules and tier information stored in `window.dp8State`. For example, dynamically determine the LTM tier:
    ```javascript
    const ltmTier = Object.keys(window.dp8State.tierData).find(label => window.dp8State.tierData[label].LTM_Fee > 0);
    ```
    Use `window.dp8State.rulesData['SetupFeePerColor']` for setup fees instead of hardcoding $30.00, with a fallback only if explicitly configured.
*   **Enhancing Error Handling:** Implement more robust error handling. Add retry logic for failed API fetches in HTML Block 2 using a function like `fetchWithRetry`:
    ```javascript
    async function fetchWithRetry(url, retries = 3) {
      for (let i = 0; i < retries; i++) {
        try {
          const res = await fetch(url);
          if (res.ok) return await res.json();
          throw new Error(res.statusText);
        } catch (error) {
          if (i === retries - 1) throw error;
          await new Promise(r => setTimeout(r, 1000 * 2 ** i));
        }
      }
    }
    ```
    Use a static fallback dataset if retries fail after the maximum number of attempts. Provide user-friendly error messages on the parent page if data fetching fails. Log failures to a monitoring service (e.g., Sentry).
*   **Optimizing Global Variables:** Use a single namespaced object `window.dp8State` initialized in the footer to store all fetched data and state:
    ```javascript
    window.dp8State = {
      tierData: null,
      rulesData: null,
      sizeData: null,
      spCostsPrimary: null,
      spCostsAdditional: null,
      fullPriceProfiles: null,
      uniqueSizes: null,
      apiBaseUrl: 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com'
    };
    ```
    Clear `window.dp8State` after dispatching the `postMessage` in HTML Block 3 to prevent memory leaks.
*   **Improving Scalability:** Consider strategies like pagination or lazy loading for API data if the number of tiers, sizes, or colors is expected to grow significantly (e.g., >100 sizes or >10 tiers). Implement caching for API responses in `sessionStorage` with a TTL in HTML Block 1:
    ```javascript
    const cacheKey = `dp8_pricing_${styleNumber}`; // Assuming styleNumber is available
    const cacheTTL = 24 * 60 * 60 * 1000; // 24 hours
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      const cachedData = JSON.parse(cached);
      if (Date.now() - cachedData.timestamp < cacheTTL) {
        Object.assign(window.dp8State, cachedData.data);
        // Signal that data is loaded from cache, potentially skip API calls
      } else {
        sessionStorage.removeItem(cacheKey); // Cache expired
      }
    }

    // After successful API fetch and processing:
    sessionStorage.setItem(cacheKey, JSON.stringify({ data: window.dp8State, timestamp: Date.now() }));
    ```
*   **Removing Embedded CSS:** Delete all `<style>` tags and move DataPage-specific styles to the parent page's CSS files (`pricing-pages.css` or a new screen-print-specific file).

## 2. Parent Page (`screen-print-pricing.html`) Modifications

The `screen-print-pricing.html` page needs to be restructured to match the layout and component integration of the other refactored pricing pages.

*   **HTML Structure:** Update the HTML to implement a two-column layout. The left column will typically contain product details and options, while the right column will house the dynamic pricing grid and add-to-cart elements.
*   **Container Elements:** Include the necessary `div` elements that serve as mounting points for the shared JavaScript components:
    *   `<div id="custom-pricing-grid"></div>` for the dynamic pricing matrix.
    *   `<div id="size-grid-container"></div>` or a similar container for the quantity/size selection UI.
    *   A container for the add-to-cart button and related elements.
    *   Include a container for the fallback UI in case of Caspio failures, initially hidden.
    ```html
    <div id="pricing-fallback" style="display: none;">
      <p>Pricing unavailable. Please contact support at support@example.com.</p>
    </div>
    ```
    *   Include a container for the Caspio iframe, which will be hidden.
    ```html
    <div id="caspio-iframe-container" style="display: none;"></div>
    ```
*   **Number of Ink Colors Dropdown:** Add a standard HTML `select` element on the parent page for the user to select the number of ink colors (1 to 6). This dropdown will drive the pricing displayed via the adapter.
*   **Additional Logo Location Option:** Include a mechanism for the user to indicate if an additional logo location is desired. This could be a checkbox, a radio button, or another select element.
*   **Script Includes:** Update the `<script>` tags to include the shared JavaScript files (`pricing-pages.js`, `utils.js`, `pricing-matrix-capture.js`, `pricing-matrix-api.js`, `product-quantity-ui.js`, `cart.js`, `cart-integration.js`, `cart-price-recalculator.js`, `add-to-cart.js`, `pricing-calculator.js`, `product-pricing-ui.js`, `order-form-pdf.js`) and the new or modified `screenprint-adapter.js`. Ensure these scripts are loaded in the correct order, typically at the end of the `<body>`. The `dp5-helper.js` script can likely be removed if its only function was iframe loading; a simple iframe setup can be done in `pricing-pages.js`.

## 3. JavaScript Adapter (`screenprint-adapter.js`) Creation/Modification

A dedicated JavaScript file will act as the intermediary between the Caspio DataPage and the shared UI modules.

*   **File Creation:** Create a new file named `screenprint-adapter.js` in a suitable location (e.g., `shared_components/js/`).
*   **`postMessage` Listener:** Implement an event listener for the `message` event on the `window` object. This listener will check for messages with the type `'caspioScreenPrintMasterBundleReady'`. Validate the event's origin to enhance security.
    ```javascript
    window.addEventListener('message', (event) => {
      // Validate origin for security
      if (event.origin !== 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com') {
        console.warn('Received postMessage from unknown origin:', event.origin);
        return;
      }

      if (event.data.type === 'caspioScreenPrintMasterBundleReady') {
        console.log('Received screen print master bundle:', event.data.data);
        screenPrintAdapter.storeMasterBundle(event.data.data);
        // Trigger initial UI update
        screenPrintAdapter.handleUiChange();
      }
    });
    ```
*   **Store Master Bundle:** When a message with the correct type and origin is received, extract the `screenPrintMasterBundle` object from the event data and store it in a variable within the adapter's scope.
*   **Handle UI Changes:** Add event listeners to the "Number of Colors" dropdown and the "Additional Logo" option on the parent page. Debounce rapid changes to prevent excessive processing.
    ```javascript
    const colorSelect = document.getElementById('color-select');
    const additionalLogoCheckbox = document.getElementById('additional-logo-checkbox'); // Example ID

    let debounceTimeout;
    const handleUiChange = () => {
      clearTimeout(debounceTimeout);
      debounceTimeout = setTimeout(() => {
        screenPrintAdapter.extractAndDispatchPricingData();
      }, 100); // Debounce time
    };

    colorSelect.addEventListener('change', handleUiChange);
    additionalLogoCheckbox.addEventListener('change', handleUiChange);
    ```
*   **Extract and Dispatch Pricing Data:** When the number of colors or the additional logo option changes:
    *   Retrieve the selected number of colors and the state of the additional logo option.
    *   Use these values to look up the corresponding pricing data within the stored `screenPrintMasterBundle`. For example, if 3 colors are selected and an additional location is chosen, retrieve the data from `screenPrintMasterBundle.additionalLocation["3"]`.
    *   Format the extracted pricing data into the structure expected by the shared pricing UI modules. Define this structure explicitly.
    *   Dispatch a custom event, such as `pricingDataLoaded`, on a relevant DOM element (e.g., `document`) and include the formatted pricing data in the event's `detail` property. This signals to the shared UI modules that new pricing data is available.
    ```javascript
    screenPrintAdapter.extractAndDispatchPricingData = () => {
      const selectedColors = colorSelect.value;
      const isAdditionalLocation = additionalLogoCheckbox.checked;
      const locationKey = isAdditionalLocation ? 'additionalLocation' : 'primaryLocation';

      const pricingData = screenPrintAdapter.masterBundle[locationKey][selectedColors];

      if (pricingData) {
        // Format data for shared modules (example structure)
        const formattedData = {
          tiers: pricingData.tiers,
          fees: {
            setup: pricingData.setupFee,
            flash: pricingData.flashCharge
          }
        };

        document.dispatchEvent(new CustomEvent('pricingDataLoaded', {
          detail: formattedData
        }));
        console.log('Dispatched pricingDataLoaded event with:', formattedData);
      } else {
        console.error('Pricing data not found for selected configuration.');
        // Handle case where data is missing for a configuration
      }
    };
    ```
*   **Handle Caspio Failures:** Implement a timeout to detect cases where the DataPage fails to load or dispatch the master bundle within a reasonable time (e.g., 5-10 seconds). If the bundle is not received, display the fallback UI and log an error.
    ```javascript
    const CASPIO_TIMEOUT = 8000; // 8 seconds
    let masterBundleReceived = false;

    window.addEventListener('message', (event) => {
      // ... origin validation and bundle handling ...
      if (event.data.type === 'caspioScreenPrintMasterBundleReady') {
        masterBundleReceived = true;
        // ... store bundle and trigger UI update ...
      }
    });

    setTimeout(() => {
      if (!masterBundleReceived) {
        console.error('Screen print master bundle not received within timeout.');
        document.getElementById('pricing-fallback').style.display = 'block';
        // Log to monitoring service
      }
    }, CASPIO_TIMEOUT);
    ```
*   **Cache Price Calculations:** Implement caching for calculated prices within the adapter to avoid redundant computations when quantities change.
    ```javascript
    const priceCache = new Map();

    screenPrintAdapter.getCachedPrice = (colorCount, location, quantities) => {
      const key = `${colorCount}_${location}_${JSON.stringify(quantities)}`;
      if (priceCache.has(key)) {
        console.log('Price cache hit for key:', key);
        return priceCache.get(key);
      }
      // Calculate price using pricing-calculator.js
      const price = pricingCalculator.calculate(screenPrintAdapter.masterBundle, colorCount, location, quantities); // Assuming pricingCalculator is available
      priceCache.set(key, price);
      console.log('Price cached for key:', key, 'price:', price);
      return price;
    };
    ```

## 4. Integration with Shared Modules

The refactored page and adapter will interact with the existing shared JavaScript modules to render the UI and handle pricing calculations.

*   **`pricing-pages.js`:** This module likely handles the overall initialization and coordination of the pricing page components. It will need to be updated to recognize the Screen Print page and initialize the `screenprint-adapter.js`. If `dp5-helper.js` is removed, `pricing-pages.js` should handle the simple iframe setup.
    ```javascript
    // In pricing-pages.js initialization logic for screen print page
    const iframeContainer = document.getElementById('caspio-iframe-container');
    if (iframeContainer) {
      const iframe = document.createElement('iframe');
      // Pass necessary parameters like StyleNumber and COLOR via URL
      const urlParams = new URLSearchParams(window.location.search);
      const styleNumber = urlParams.get('StyleNumber');
      const color = urlParams.get('COLOR');
      iframe.src = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com?StyleNumber=' + styleNumber + '&COLOR=' + color;
      iframe.style.display = 'none'; // Hide the iframe
      iframeContainer.appendChild(iframe);
    }
    ```
*   **`utils.js`:** Standard utility functions will be used as needed by the adapter and other scripts.
*   **`pricing-matrix-capture.js` and `pricing-matrix-api.js`:** These modules are responsible for capturing data from the pricing matrix UI and potentially interacting with an API. The adapter will provide the data that these modules operate on via the `pricingDataLoaded` event. Ensure the adapter's output format (`formattedData` in the example above) is compatible with these modules' expectations.
*   **`product-quantity-ui.js`:** This module handles the UI for selecting quantities per size. It will receive pricing data from the adapter via the `pricingDataLoaded` event and enable/disable quantity inputs based on the available sizes and pricing.
*   **`cart.js`:** This module manages the shopping cart state. It will be involved in the embellishment constraint check.
*   **`cart-integration.js`:** This module handles integration with backend cart services.
*   **`cart-price-recalculator.js`:** This module recalculates prices when quantities or options change. It will use the pricing data provided by the adapter.
*   **`add-to-cart.js`:** This module handles the logic for adding the configured product to the cart. It will rely on the data provided by the adapter and the state managed by the quantity UI. Defer its initialization until the `pricingDataLoaded` event is received to avoid race conditions.
    ```javascript
    document.addEventListener('pricingDataLoaded', () => {
      initializeAddToCart(); // Function defined in add-to-cart.js
    });
    ```
*   **`pricing-calculator.js`:** This module performs the actual price calculations based on the pricing data and selected quantities. The adapter provides the necessary pricing data for this module to use. Ensure it accounts for LTM fees, setup fees, flash charges, and additional charges as provided in the `screenPrintMasterBundle`.
*   **`product-pricing-ui.js`:** This module is responsible for rendering the dynamic pricing grid based on the data provided by the adapter via the `pricingDataLoaded` event. Ensure its expected data format is compatible with the adapter's output.
*   **`order-form-pdf.js`:** This module likely handles generating a PDF order form. It will need to be updated to correctly pull screen print pricing and configuration details from the refactored page's state, which is managed by the adapter and shared UI modules.

## 5. Add to Cart Logic

The add-to-cart functionality needs to correctly handle the screen print specific pricing and options.

*   **Price Calculation:** When the user clicks "Add to Cart", the logic will need to:
    *   Get the selected number of colors and additional logo location state from the parent page UI.
    *   Retrieve the corresponding pricing data from the stored `screenPrintMasterBundle` based on the selected configuration.
    *   Get the quantities entered for each size from the quantity UI.
    *   Use the `pricing-calculator.js` module (potentially via the adapter's caching function) to calculate the total price based on the retrieved pricing data (including tiers, prices, and fees) and quantities. Leverage the price calculation cache in the adapter.
*   **Cart Embellishment Constraint:** The system has a constraint that the cart can only contain items with a single embellishment type. The add-to-cart logic must enforce this:
    *   Implement this check in `cart.js` or `add-to-cart.js`. Before adding a screen print item, check if the cart is not empty and contains items with a different embellishment type (e.g., DTG or Embroidery).
    *   If a different embellishment type is present, prevent the addition and inform the user with a user-friendly notification (e.g., a Bootstrap modal).
    ```javascript
    // Example logic in add-to-cart.js or cart.js
    function addItemToCart(item) {
      const currentEmbellishment = cart.getEmbellishmentType();
      if (cart.isEmpty() || currentEmbellishment === 'ScreenPrint') {
        // Add item to cart
        // ...
      } else {
        // Show conflict notification
        showEmbellishmentConflictModal();
      }
    }

    function showEmbellishmentConflictModal() {
      const modalElement = document.getElementById('embellishment-error-modal');
      if (modalElement) {
        const modal = new bootstrap.Modal(modalElement);
        modal.show();
      } else {
        alert('Cannot add screen print items to a cart with other embellishment types.');
      }
    }
    ```
    Add the necessary HTML for the modal to `screen-print-pricing.html`:
    ```html
    <div id="embellishment-error-modal" class="modal fade" tabindex="-1" aria-labelledby="embellishmentErrorModalLabel" aria-hidden="true">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="embellishmentErrorModalLabel">Cart Conflict</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body">
            <p>Cannot add screen print items to a cart with other embellishment types.</p>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-primary" data-bs-dismiss="modal">OK</button>
          </div>
        </div>
      </div>
    </div>
    ```

## 6. CSS Adjustments

Minor CSS adjustments may be needed to ensure the refactored Screen Print page maintains a consistent look and feel with the other pricing pages and correctly displays the new elements.

*   **`pricing-pages.css` (or new file):** Consolidate styles in `pricing-pages.css` unless screen-print-specific styles are extensive and unique, in which case create `screenprint-pricing.css`. Use CSS custom properties (e.g., `--primary-color`, `--table-border-color`, `--highlight-bg`) to ensure consistency across pages. Update or add styles to:
    *   Ensure the two-column layout is responsive using media queries for different screen sizes.
    *   Style the new "Number of Colors" dropdown and "Additional Logo" option.
    *   Adjust spacing and alignment as needed to accommodate the screen print specific UI elements while maintaining harmony with the shared components.
    *   Style the fallback UI element.

## 7. Testing Considerations

Thorough testing is essential to ensure the refactored page functions correctly across all scenarios.

*   **Caspio DataPage:**
    *   Verify that the Caspio DataPage successfully fetches and includes pricing data for all color counts (1-6) for both primary and additional locations in the `screenPrintMasterBundle`.
    *   Confirm that the `postMessage` is dispatched correctly with the expected data structure and type, and that origin validation works.
    *   Test the retry logic for API failures and the static fallback dataset.
    *   Verify that global variables are properly namespaced and cleared.
    *   Confirm that embedded CSS is removed.
    *   Test the caching mechanism in HTML Block 1.
*   **Parent Page and Adapter:**
    *   Verify that the `screenprint-adapter.js` correctly receives and stores the `screenPrintMasterBundle` via `postMessage`.
    *   Test that changing the "Number of Colors" dropdown and the "Additional Logo" option on the parent page correctly triggers the adapter to extract and dispatch the relevant pricing data.
    *   Test that debouncing of UI changes works correctly.
    *   Confirm that the `pricingDataLoaded` event is dispatched with the correct data structure and content for various combinations of colors and locations.
    *   Test the timeout and fallback UI for Caspio failures, ensuring the fallback message is displayed.
    *   Verify that price calculation caching in the adapter works.
*   **Shared UI Integration:**
    *   Verify that the `product-pricing-ui.js` correctly renders the pricing grid based on the data provided by the adapter for all color/location combinations.
    *   Test that the `product-quantity-ui.js` correctly updates based on the available sizes and pricing data.
    *   Confirm that `add-to-cart.js` initialization is deferred until `pricingDataLoaded`.
    *   Verify that `pricing-calculator.js` correctly uses the data structure provided by the adapter, including fees.
*   **Add to Cart:**
    *   Test adding items to the cart with different numbers of colors (1-6).
    *   Test adding items with and without the additional logo location selected.
    *   Verify that the total price calculated in the cart is correct for all combinations of colors, locations, quantities, and sizes, including all fees and charges.
    *   Test the cart embellishment constraint: attempt to add a screen print item when the cart contains a different embellishment type and ensure the correct behavior (prevention and user-friendly modal notification).
    *   Test adding multiple sizes and quantities for a single screen print configuration.
*   **Edge Cases:**
    *   Test scenarios with minimum and maximum quantities.
    *   Test with different product sizes.
    *   Test with invalid or missing URL parameters (`StyleNumber`, `COLOR`).
    *   Simulate API failures or slow responses to verify error handling and fallback.
    *   Test rapid dropdown changes to ensure the adapter handles state updates correctly.
*   **Performance Tests:**
    *   Measure DataPage load time and API fetch latency to ensure performance is acceptable (<2 seconds for initial load).
    *   Test with large datasets (e.g., 100+ sizes, 10+ tiers) to verify scalability and the effectiveness of caching/pagination strategies.
    *   Conduct load testing to simulate high traffic (e.g., 1000 concurrent users) and verify API proxy and page performance under load.
*   **Cross-Browser Testing:**
    *   Test on Chrome, Firefox, Safari, and Edge to ensure `postMessage`, CSS, and UI rendering work consistently.
    *   Verify mobile responsiveness for the two-column layout on various devices.
*   **Accessibility Testing:**
    *   Ensure the pricing grid, dropdown, and add-to-cart button are accessible using appropriate ARIA roles and attributes.
    *   Verify that color contrast meets WCAG 2.1 AA requirements.
    *   Test with screen readers (e.g., NVDA, VoiceOver) to ensure all relevant information is conveyed.
    *   Ensure error messages and notes are screen-reader-friendly.
    *   Verify keyboard navigation and focus management.
*   **Automated Testing:**
    *   Implement automated end-to-end tests using a framework like Cypress or Selenium to cover key user flows (e.g., selecting colors, adding to cart, verifying pricing).
    ```javascript
    // Example Cypress test
    describe('Screen Print Pricing Page', () => {
      beforeEach(() => {
        // Visit the page with specific parameters
        cy.visit('/screen-print-pricing.html?StyleNumber=ABC123&COLOR=Black');
        // Wait for the master bundle to be loaded (can use a custom command or wait for a UI element)
        cy.window().should('have.property', 'screenPrintAdapter').then(adapter => {
           cy.wrap(adapter).should('have.property', 'masterBundle').and('not.be.null');
        });
      });

      it('should display correct pricing for 3 colors', () => {
        cy.get('#color-select').select('3');
        // Verify pricing grid content
        cy.get('#custom-pricing-grid').should('contain', '$10.50'); // Example price
        // Add more assertions for different tiers and sizes
      });

      it('should handle adding to cart with additional logo', () => {
        cy.get('#color-select').select('4');
        cy.get('#additional-logo-checkbox').check();
        // Enter quantities
        cy.get('.quantity-input[data-size="S"]').type('24');
        cy.get('.quantity-input[data-size="M"]').type('36');
        cy.get('#add-to-cart-button').click();
        // Verify cart content and total price
        cy.get('#cart-items').should('contain', 'Screen Print - 4 Colors - Additional Location');
        cy.get('#cart-total').should('contain', '$XXX.XX'); // Verify calculated total
      });

      it('should show embellishment conflict modal', () => {
        // Add a DTG item first (requires setting up test data or a separate test)
        // ...
        cy.visit('/screen-print-pricing.html?StyleNumber=ABC123&COLOR=Black');
        cy.get('#color-select').select('1');
        cy.get('.quantity-input[data-size="S"]').type('12');
        cy.get('#add-to-cart-button').click();
        cy.get('#embellishment-error-modal').should('be.visible');
      });
    });
    ```

## Conclusion

This comprehensively revised plan incorporates all the detailed feedback and recommendations, including specific implementation notes for the Caspio DataPage. It provides a robust and actionable roadmap for refactoring the screen print pricing page. By addressing the discrepancies with the existing Caspio XML, detailing the implementation steps for the adapter and shared modules, enhancing error handling, scalability, and providing specific testing considerations (including performance, accessibility, and automation), the refactored page will be more maintainable, performant, and user-friendly, aligning fully with the Master Bundle approach used on other pricing pages. The plan is now ready to guide the implementation phase.