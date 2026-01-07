/**
 * Quote Builder Integration Example
 *
 * This file demonstrates how to integrate the shared modules into a quote builder.
 * The 2026 consolidation project created 4 shared modules that can be used by any
 * quote builder: DTG, Screen Print, DTF, Embroidery, etc.
 *
 * SHARED MODULES:
 * 1. extended-sizes-config.js   - Extended size handling (XS, 2XL-10XL, Youth, etc.)
 * 2. color-picker-component.js  - Unified color picker with swatches
 * 3. quote-builder-core.js      - Core functionality (rows, quotes, products)
 * 4. pricing-sidebar-component.js - Unified pricing sidebar
 *
 * @version 1.0.0
 * @created 2026-01-07
 */

// ==================== HTML SCRIPT INCLUDES ====================
// Add these script tags to your quote builder HTML (in this order):

/*
<!-- Shared Components (2026 Consolidation) -->
<script src="/shared_components/js/extended-sizes-config.js"></script>
<script src="/shared_components/js/color-picker-component.js"></script>
<script src="/shared_components/js/quote-builder-core.js"></script>
<script src="/shared_components/js/pricing-sidebar-component.js"></script>

<!-- Your quote builder's specific JS -->
<script src="/shared_components/js/your-quote-builder.js"></script>
*/

// ==================== EXTENDED SIZES CONFIG ====================
// Use for: Part number generation, extended size popups, child row sorting

// Example 1: Get part number for ShopWorks
function getShopWorksPartNumber(baseStyle, size) {
    // Uses shared SIZE_TO_SUFFIX mapping
    const config = window.ExtendedSizesConfig;
    return config.getPartNumber(baseStyle, size);
    // 'PC61' + '3XL' => 'PC61_3X'
}

// Example 2: Fetch available extended sizes for a product (API-driven)
async function loadExtendedSizesForProduct(styleNumber) {
    const config = window.ExtendedSizesConfig;

    // Returns only sizes available for this specific product
    const availableSizes = await config.getAvailableExtendedSizes(styleNumber);
    // e.g., ['XS', '2XL', '3XL', '4XL'] - varies by product

    return availableSizes;
}

// Example 3: Sort extended sizes for display
function sortChildRows(sizes) {
    const config = window.ExtendedSizesConfig;
    return config.sortSizes(sizes);
    // Sorts: XS, 2XL, 3XL, 4XL... (consistent order)
}

// Example 4: Check if size goes in Size05 vs Size06 column
function getColumnForSize(size) {
    const config = window.ExtendedSizesConfig;
    return config.isSize05(size) ? 'Size05' : 'Size06';
    // 2XL/XXL -> Size05, everything else -> Size06
}


// ==================== COLOR PICKER COMPONENT ====================
// Use for: Color selection dropdowns with swatches

// Example 1: Initialize color picker on your quote builder
function initializeColorPicker() {
    window.colorPicker = new ColorPickerComponent({
        // Enable duplicate color detection (prevents same color twice)
        enableDuplicateCheck: true,

        // Enable arrow key navigation in dropdown
        enableArrowNavigation: true,

        // Scroll selected option into view
        enableScrollIntoView: true,

        // Callback when color is selected
        onColorSelect: (productId, colorData) => {
            console.log(`Product ${productId} color set to:`, colorData);
            // colorData = { displayName: 'Red', catalogColor: 'RED', imageUrl: '...' }

            // Update your pricing calculations here
            updatePricing(productId);
        },

        // Get child row map for a parent (for cascading color to children)
        getChildRowMap: () => {
            return window.childRowMap || {};
        }
    });
}

// Example 2: Open/close color dropdown
function handleColorClick(productId) {
    window.colorPicker.toggleColorPicker(productId);
}

// Example 3: Programmatically set color (e.g., when loading saved quote)
function restoreProductColor(productId, colorName, catalogColor, imageUrl) {
    window.colorPicker.selectColor(productId, colorName, catalogColor, imageUrl);
}


// ==================== QUOTE BUILDER CORE ====================
// Use for: Row management, quote generation, product collection

// Example 1: Initialize core module
function initializeQuoteBuilderCore() {
    window.quoteCore = new QuoteBuilderCore({
        // Quote ID prefix (DTG, RICH, EMB, SPC, etc.)
        prefix: 'DTG',

        // Builder name for logging
        builderName: 'DTG Quote Builder',

        // DOM element IDs
        tableBodyId: 'product-tbody',
        totalQtyId: 'total-quantity',
        pricingTierId: 'pricing-tier',

        // Feature flags
        enableDuplicateCheck: true,  // Prevent same style+color twice
        enableAutoFocus: true,       // Auto-focus on new inputs

        // Callback when row is added
        onRowAdded: (rowId) => {
            console.log(`Row ${rowId} added`);
        },

        // Callback when row is deleted
        onRowDeleted: (rowId) => {
            console.log(`Row ${rowId} deleted`);
            updatePricing();
        },

        // Callback when size input changes
        onSizeChange: (rowId, size, qty) => {
            console.log(`Row ${rowId} size ${size} changed to ${qty}`);
        },

        // Callback to trigger pricing recalculation
        onPricingRecalc: () => {
            updatePricing();
        }
    });
}

// Example 2: Generate unique quote ID
function createNewQuote() {
    const quoteId = window.quoteCore.generateQuoteId();
    // Returns: 'DTG0107-1' (prefix + MMDD + sequence)
    return quoteId;
}

// Example 3: Delete row (handles parent/child relationships)
function deleteRow(rowId) {
    // If parent row: deletes all children first
    // If child row: removes from parent's childRowMap
    window.quoteCore.deleteRow(rowId);
}

// Example 4: Collect all products from table for quote submission
function collectQuoteProducts() {
    const products = window.quoteCore.collectProductsFromTable(
        '#product-tbody',  // Table body selector
        (row) => {
            // Custom extraction logic for your builder
            return {
                styleNumber: row.dataset.styleNumber,
                color: row.dataset.color,
                // Add your specific fields...
            };
        }
    );
    return products;
}


// ==================== PRICING SIDEBAR COMPONENT ====================
// Use for: Consistent pricing display across all builders

// Example 1: Initialize sidebar for your builder type
function initializePricingSidebar() {
    window.pricingSidebar = new PricingSidebarComponent({
        // Builder type determines which sections are shown
        builderType: 'dtf',  // 'dtg', 'screenprint', 'embroidery', or 'dtf'

        // Container element ID
        containerId: 'pricing-summary',

        // Builder-specific options
        showLocations: true,        // DTF: show location badges
        showPrintConfig: false,     // Screen Print: show colors/screens
        showCostBreakdown: true,    // DTF: show transfer costs
        showMixedQuote: false,      // Embroidery: show cap/flat mix

        // LTM configuration
        ltmThreshold: 24,
        ltmFee: 50.00,

        // Callbacks
        onLtmToggle: (distributed) => {
            console.log('LTM distributed:', distributed);
            recalculateAllPrices();
        }
    });
}

// Example 2: Update sidebar with current quote data
function updateSidebar() {
    window.pricingSidebar.update({
        totalQuantity: 48,
        tier: 'Tier 2 (24-47)',

        // Line items breakdown
        lineItems: [
            { label: 'PC61 - Red (24)', price: 12.50, subtotal: 300.00 },
            { label: 'G500 - Navy (24)', price: 11.00, subtotal: 264.00 }
        ],

        // Summary totals
        subtotal: 564.00,
        ltmFee: 0,  // Zero because qty >= 24
        grandTotal: 564.00,

        // DTF-specific: selected locations
        locations: ['Full Front', 'Left Sleeve'],

        // Screen Print-specific: print config
        printConfig: { colors: 3, screens: 4 }
    });
}


// ==================== FULL INTEGRATION EXAMPLE ====================
// Complete setup for a new quote builder

class MyQuoteBuilder {
    constructor() {
        this.childRowMap = {};
        this.initializeSharedModules();
    }

    initializeSharedModules() {
        // 1. Extended Sizes - Available globally as window.ExtendedSizesConfig
        //    No initialization needed, just use the functions

        // 2. Color Picker
        this.colorPicker = new ColorPickerComponent({
            enableDuplicateCheck: true,
            onColorSelect: (id, data) => this.onColorSelected(id, data),
            getChildRowMap: () => this.childRowMap  // Returns full map, component extracts per-parent
        });

        // 3. Quote Builder Core
        this.quoteCore = new QuoteBuilderCore({
            prefix: 'MY',
            builderName: 'My Quote Builder',
            tableBodyId: 'my-table-body',
            onRowDeleted: () => this.recalculate(),
            onPricingRecalc: () => this.recalculate()
        });

        // 4. Pricing Sidebar
        this.sidebar = new PricingSidebarComponent({
            builderType: 'generic',
            containerId: 'my-sidebar'
        });
    }

    onColorSelected(productId, colorData) {
        // Color was selected, update pricing
        this.recalculate();
    }

    async openExtendedSizes(productId, styleNumber) {
        // Get available sizes from API
        const sizes = await window.ExtendedSizesConfig.getAvailableExtendedSizes(styleNumber);

        // Render popup with only available sizes
        this.renderSizePopup(productId, sizes);
    }

    recalculate() {
        // Collect products and update sidebar
        const products = this.quoteCore.collectProductsFromTable('#my-table tbody');
        const totals = this.calculateTotals(products);
        this.sidebar.update(totals);
    }

    calculateTotals(products) {
        // Your pricing logic here
        return {
            totalQuantity: 0,
            subtotal: 0,
            grandTotal: 0
        };
    }
}


// ==================== MIGRATION CHECKLIST ====================
/*
To migrate an existing quote builder to use shared modules:

□ 1. Add script includes (in order) to HTML
□ 2. Replace hardcoded SIZE_TO_SUFFIX with window.ExtendedSizesConfig.SIZE_TO_SUFFIX
□ 3. Replace hardcoded EXTENDED_SIZE_ORDER with window.ExtendedSizesConfig.EXTENDED_SIZE_ORDER
□ 4. Update extended size popup to call getAvailableExtendedSizes(styleNumber)
□ 5. Initialize ColorPickerComponent instead of inline color picker code
□ 6. Initialize QuoteBuilderCore for row/quote management
□ 7. Initialize PricingSidebarComponent for sidebar updates
□ 8. Test all functionality:
   - Color selection and cascade to child rows
   - Extended size popup shows product-specific sizes
   - Part numbers generate correctly (PC61 + 3XL = PC61_3X)
   - Child rows sort in correct order
   - Sidebar updates correctly
   - Quote ID generates with correct prefix
*/

console.log('[Integration Example] This file is for reference only');
