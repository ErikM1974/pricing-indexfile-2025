// product-pricing-ui.js - UI handling for product pricing pages

/**
 * Product Pricing UI Module for Northwest Custom Apparel
 * Handles dynamic interactions on product pricing pages like embroidery-pricing.html
 */
const NWCAProductPricingUI = (function() {
    'use strict';

    // DOM elements (will be populated in initialize)
    const elements = {
        // Product page specific elements
        pricingGrid: null,
        sizeQuantityInputs: [], // NodeList of all quantity inputs for sizes
        // Elements for dynamic price display per size (e.g., spans next to inputs)
        sizePriceDisplays: [],
        // Sticky cart summary elements
        stickyCartSummaryContainer: null,
        stickyTotalQuantityDisplay: null,
        stickyTotalPriceDisplay: null,
        stickyAddToCartButton: null,
        // Tier info display elements
        tierProgressDisplay: null, // e.g., the .pricing-tier-info container
        // Collapsible section toggles/containers
        collapsibleSectionToggles: [],
        collapsibleSections: []
    };

    // Configuration (example)
    const config = {
        ltmFee: 50.00,
        pricingTiers: [ // Example structure, actual tiers come from pricing data
            { minQty: 1, maxQty: 23, label: "1-23" },
            { minQty: 24, maxQty: 47, label: "24-47" },
            { minQty: 48, maxQty: 71, label: "48-71" },
            { minQty: 72, maxQty: Infinity, label: "72+" }
        ]
    };

    function debugProductUI(level, message, data = null) {
        console.log(`[ProductPricingUI-${level}] ${message}`, data);
    }

    /**
     * Initializes the product pricing UI enhancements.
     */
    function initialize() {
        debugProductUI("INFO", "Initializing Product Pricing UI.");
        _cacheDOMElements();
        _bindEventListeners();
        _initialRenderUpdates(); // Perform any initial UI updates based on page load
    }

    /**
     * Caches references to frequently used DOM elements.
     */
    function _cacheDOMElements() {
        debugProductUI("INFO", "Caching DOM elements.");
        // Example for embroidery-pricing.html structure
        elements.pricingGrid = document.getElementById('custom-pricing-grid');
        elements.sizeQuantityInputs = document.querySelectorAll('.size-card .quantity-input'); // Adjust selector if structure changes
        
        // For dynamic price display, assume a structure like:
        // <div class="size-card">...<span class="dynamic-unit-price">$0.00</span></div>
        elements.sizePriceDisplays = document.querySelectorAll('.size-card .dynamic-unit-price'); // Placeholder selector

        elements.stickyCartSummaryContainer = document.getElementById('sticky-product-cart-summary'); // Assuming a new ID for this
        if (elements.stickyCartSummaryContainer) {
            elements.stickyTotalQuantityDisplay = elements.stickyCartSummaryContainer.querySelector('.total-quantity');
            elements.stickyTotalPriceDisplay = elements.stickyCartSummaryContainer.querySelector('.total-price');
            elements.stickyAddToCartButton = elements.stickyCartSummaryContainer.querySelector('.add-to-cart-button'); // Assuming it's reused or similar
        }
        
        elements.tierProgressDisplay = document.querySelector('.pricing-tier-info'); // From embroidery-pricing.html

        // Example for collapsible sections (if implemented with toggles)
        // elements.collapsibleSectionToggles = document.querySelectorAll('.collapsible-toggle');
        // elements.collapsibleSections = document.querySelectorAll('.collapsible-content');

        debugProductUI("INFO", "DOM elements cached:", elements);
    }

    /**
     * Binds event listeners to interactive elements.
     */
    function _bindEventListeners() {
        debugProductUI("INFO", "Binding event listeners.");
        elements.sizeQuantityInputs.forEach(input => {
            input.addEventListener('change', handleQuantityChangeOnProductPage);
            input.addEventListener('input', handleQuantityChangeOnProductPage); // For more immediate feedback
        });

        // elements.collapsibleSectionToggles.forEach(toggle => {
        //     toggle.addEventListener('click', (event) => toggleMobileCollapsibleSection(event.target));
        // });
    }

    /**
     * Performs initial UI updates on page load.
     */
    function _initialRenderUpdates() {
        debugProductUI("INFO", "Performing initial render updates.");
        // Example: Calculate initial total quantity and update UI
        const initialTotalQuantity = _calculateTotalQuantity();
        updateDynamicPriceDisplays(initialTotalQuantity);
        highlightActivePricingTier(initialTotalQuantity);
        updateStickyCartSummary(initialTotalQuantity);
    }

    /**
     * Calculates the total quantity from all size inputs.
     * @returns {number} The total quantity.
     */
    function _calculateTotalQuantity() {
        let totalQuantity = 0;
        elements.sizeQuantityInputs.forEach(input => {
            totalQuantity += parseInt(input.value, 10) || 0;
        });
        debugProductUI("CALC", "Calculated total quantity:", totalQuantity);
        return totalQuantity;
    }

    /**
     * Handles quantity changes on the product page.
     * @param {Event} event - The input or change event.
     */
    function handleQuantityChangeOnProductPage(event) {
        const input = event.target;
        const newQuantity = parseInt(input.value, 10);

        if (isNaN(newQuantity) || newQuantity < 0) {
            // Optionally reset to a valid value or show a small validation message
            input.value = input.dataset.previousValue || '0'; // Revert if invalid
            debugProductUI("WARN", "Invalid quantity entered.", { value: input.value });
            // Potentially show a small inline error message next to the input
            return;
        }
        input.dataset.previousValue = newQuantity; // Store current valid value

        const totalQuantity = _calculateTotalQuantity();
        
        updateDynamicPriceDisplays(totalQuantity);
        highlightActivePricingTier(totalQuantity);
        updateStickyCartSummary(totalQuantity);
        // Potentially update tier progress display as well
        if (window.updateTierProgressDisplay) { // Check if global function from pricing-pages.js exists
            window.updateTierProgressDisplay(totalQuantity);
        }
    }

    /**
     * Updates the price displayed next to each size's quantity input.
     * This function will need access to the product's pricing matrix/data.
     * @param {number} totalQuantity - The current total quantity for the item.
     */
    function updateDynamicPriceDisplays(totalQuantity) {
        debugProductUI("UI-UPDATE", "Updating dynamic price displays for total quantity:", totalQuantity);
        const currentTier = getCurrentPricingTier(totalQuantity);
        
        // This is a placeholder. Actual pricing logic will be complex.
        // It needs to:
        // 1. Get the base pricing matrix for the product.
        // 2. Determine the correct price column based on `currentTier`.
        // 3. For each size input, find its corresponding price in that column.
        // 4. Update the `dynamic-unit-price` span for that size.

        elements.sizeQuantityInputs.forEach((input, index) => {
            const size = input.dataset.size; // Assuming data-size attribute exists
            const priceDisplayElement = input.closest('.size-card').querySelector('.dynamic-unit-price'); // Adjust selector

            if (priceDisplayElement) {
                // Placeholder: Fetch actual price for this size at this tier
                // This would involve calling a function that has access to the pricing data,
                // similar to how pricing-calculator.js or pricing-matrix-api.js works.
                // For now, let's simulate:
                let unitPrice = "N/A"; 
                if (currentTier) {
                    // Example: const productPricingData = NWCALocalStorage.getItem('currentProductPricingData');
                    // unitPrice = getPriceForSizeAndTier(size, currentTier.label, productPricingData);
                    // For demonstration, let's use a mock price.
                    // This needs to be replaced with actual price lookup logic.
                    const mockBasePrice = parseFloat(input.dataset.basePrice || "10.00"); // Assume a base price for demo
                    unitPrice = calculateTieredPrice(mockBasePrice, currentTier.label); // Simplified mock
                }
                
                priceDisplayElement.textContent = unitPrice !== "N/A" ? `$${unitPrice.toFixed(2)}` : "N/A";
            }
        });
    }
    
    /**
     * MOCK: Calculates a tiered price. Replace with actual logic.
     */
    function calculateTieredPrice(basePrice, tierLabel) {
        if (tierLabel === "72+") return basePrice * 0.8;
        if (tierLabel === "48-71") return basePrice * 0.85;
        if (tierLabel === "24-47") return basePrice * 0.9;
        return basePrice; // 1-23 or LTM
    }

    /**
     * Updates the content of the sticky cart summary.
     * @param {number} totalQuantity - The current total quantity for the item.
     */
    function updateStickyCartSummary(totalQuantity) {
        if (!elements.stickyCartSummaryContainer) return;
        debugProductUI("UI-UPDATE", "Updating sticky cart summary for total quantity:", totalQuantity);

        let estimatedTotalPrice = 0;
        // Calculate estimated total price based on individual size quantities and their dynamic prices
        elements.sizeQuantityInputs.forEach(input => {
            const quantity = parseInt(input.value, 10) || 0;
            const priceDisplayElement = input.closest('.size-card').querySelector('.dynamic-unit-price');
            if (priceDisplayElement && priceDisplayElement.textContent.startsWith('$')) {
                const unitPrice = parseFloat(priceDisplayElement.textContent.substring(1));
                if (!isNaN(unitPrice)) {
                    estimatedTotalPrice += quantity * unitPrice;
                }
            }
        });
        
        // Handle LTM fee if applicable (this logic might be more complex)
        const ltmFeeApplies = totalQuantity > 0 && totalQuantity < getLtmThreshold(); // e.g., 24
        if (ltmFeeApplies) {
            estimatedTotalPrice += config.ltmFee; 
            // TODO: Show LTM fee notice in sticky summary
        }


        if (elements.stickyTotalQuantityDisplay) {
            elements.stickyTotalQuantityDisplay.textContent = totalQuantity;
        }
        if (elements.stickyTotalPriceDisplay) {
            elements.stickyTotalPriceDisplay.textContent = `$${estimatedTotalPrice.toFixed(2)}`;
        }
        if (elements.stickyAddToCartButton) {
            elements.stickyAddToCartButton.disabled = totalQuantity === 0;
        }
    }
    
    function getLtmThreshold() {
        // Find the start of the first tier that doesn't have LTM
        // This assumes tiers are sorted by minQty
        const firstNonLtmTier = config.pricingTiers.find(tier => tier.minQty >= 24); // Example threshold
        return firstNonLtmTier ? firstNonLtmTier.minQty : 24;
    }


    /**
     * Highlights the active pricing tier in the main pricing grid.
     * @param {number} totalQuantity - The current total quantity for the item.
     */
    function highlightActivePricingTier(totalQuantity) {
        if (!elements.pricingGrid) return;
        debugProductUI("UI-UPDATE", "Highlighting active pricing tier for total quantity:", totalQuantity);

        const currentTier = getCurrentPricingTier(totalQuantity);
        if (!currentTier) return;

        // Remove highlight from all tier headers/columns first
        elements.pricingGrid.querySelectorAll('th.active-tier-highlight, td.active-tier-highlight').forEach(el => {
            el.classList.remove('active-tier-highlight');
        });

        // Add highlight to the current tier's header and cells
        // This assumes TH elements have a data-tier-label attribute matching tier.label
        const tierHeader = elements.pricingGrid.querySelector(`thead th[data-tier-label="${currentTier.label}"]`);
        if (tierHeader) {
            tierHeader.classList.add('active-tier-highlight');
        }

        // And for all td cells in that column (assuming a similar data-tier-label or index)
        const columnIndex = tierHeader ? Array.from(tierHeader.parentNode.children).indexOf(tierHeader) : -1;
        if (columnIndex !== -1) {
            elements.pricingGrid.querySelectorAll(`tbody tr`).forEach(row => {
                const cell = row.children[columnIndex];
                if (cell) {
                    cell.classList.add('active-tier-highlight');
                }
            });
        }
    }

    /**
     * Gets the current pricing tier object based on total quantity.
     * @param {number} totalQuantity - The total quantity.
     * @returns {object|null} The tier object or null if not found.
     */
    function getCurrentPricingTier(totalQuantity) {
        for (const tier of config.pricingTiers) {
            if (totalQuantity >= tier.minQty && totalQuantity <= tier.maxQty) {
                return tier;
            }
        }
        return config.pricingTiers[0]; // Default to the first tier if something goes wrong or qty is 0
    }

    /**
     * Toggles the visibility of a collapsible section (for mobile).
     * @param {HTMLElement} toggleButton - The button that was clicked.
     */
    function toggleMobileCollapsibleSection(toggleButton) {
        const targetId = toggleButton.dataset.target; // Assuming button has data-target="#sectionId"
        const section = document.querySelector(targetId);
        if (section) {
            section.classList.toggle('is-expanded'); // CSS will handle the show/hide
            toggleButton.setAttribute('aria-expanded', section.classList.contains('is-expanded'));
            debugProductUI("UI-ACTION", "Toggled collapsible section:", { targetId, expanded: section.classList.contains('is-expanded') });
        }
    }

    // Public API
    return {
        initialize
    };

})();

// Initialize when DOM is loaded and other necessary scripts (like pricing-matrix-api) are ready
document.addEventListener('DOMContentLoaded', function() {
    // Ensure NWCACart (if needed for product page context) and other dependencies are loaded
    // For now, just initialize directly. Dependencies can be checked if complex interactions arise.
    if (document.getElementById('custom-pricing-grid')) { // Check if on a product pricing page
        NWCAProductPricingUI.initialize();
    }
});