# DTG Pricing Page Documentation

This document provides a comprehensive overview of the HTML, CSS, and JavaScript code that powers the DTG (Direct to Garment) Pricing page at `/pricing/dtg`.

## Table of Contents

1. [Introduction](#introduction)
2. [Page Structure (HTML)](#page-structure-html)
3. [Core JavaScript Components](#core-javascript-components)
   - [DTG Pricing v4](#dtg-pricing-v4)
   - [DTG Adapter](#dtg-adapter)
   - [DTG Configuration](#dtg-configuration)
   - [DTG Page Setup](#dtg-page-setup)
   - [DTG Integration](#dtg-integration)
4. [CSS Styling](#css-styling)
   - [DTG-specific CSS](#dtg-specific-css)
   - [DTG Pricing Table Fix](#dtg-pricing-table-fix)
   - [DTG Recommendations](#dtg-recommendations)
5. [Component Interactions](#component-interactions)
6. [Workflow and User Experience](#workflow-and-user-experience)
7. [Caspio Integration and Data Processing](#caspio-integration-and-data-processing)
   - [Caspio Datapage Architecture](#caspio-datapage-architecture)
   - [HTML Blocks Functionality](#html-blocks-functionality)
   - [API Endpoint Details](#api-endpoint-details)
   - [Data Flow from API Fetch to Final Bundle Creation](#data-flow-from-api-fetch-to-final-bundle-creation)
   - [Event-Driven Communication Pattern](#event-driven-communication-pattern)
   - [Master Bundle Structure](#master-bundle-structure)
   - [Integration with the Main Application](#integration-with-the-main-application)

## Introduction

The DTG Pricing page is a web application that allows users to calculate pricing for Direct to Garment printing services. It provides an interactive interface where users can:

- Select a product style and color
- Choose a print location (Left Chest, Full Front, etc.)
- Specify quantity
- View pricing based on these selections
- See product recommendations

The application uses a modular architecture with separate components for different functionality, all integrated through event-driven communication.

## Page Structure (HTML)

The main HTML file (`dtg-pricing.html`) provides the structure for the DTG pricing page. Here's a breakdown of its key sections:

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>DTG Pricing | Northwest Custom Apparel</title>
    
    <!-- Shared CSS -->
    <link rel="stylesheet" href="/shared_components/css/shared-pricing-styles.css">
    <link rel="stylesheet" href="/shared_components/css/modern-enhancements.css">
    <link rel="stylesheet" href="/shared_components/css/universal-header.css">
    <link rel="stylesheet" href="/shared_components/css/universal-product-display.css">
    <link rel="stylesheet" href="/shared_components/css/universal-image-gallery.css">
    <link rel="stylesheet" href="/shared_components/css/universal-quick-quote.css">
    <link rel="stylesheet" href="/shared_components/css/universal-pricing-grid.css">
    
    <!-- DTG Specific CSS -->
    <link rel="stylesheet" href="/shared_components/css/dtg-specific.css">
    <link rel="stylesheet" href="/shared_components/css/clean-color-swatches.css">
    <link rel="stylesheet" href="/shared_components/css/image-modal.css">
    <link rel="stylesheet" href="/shared_components/css/dtg-recommendations.css">
    <link rel="stylesheet" href="/shared_components/css/modern-pricing-table.css">
    <link rel="stylesheet" href="/shared_components/css/dtg-pricing-table-fix.css">
    
    <!-- PDF Export Libraries -->
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.23/jspdf.plugin.autotable.min.js"></script>
    
    <!-- Font Awesome for icons -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
</head>
<body class="dtg-pricing-page">
    <!-- Enhanced Pricing Header -->
    <header class="enhanced-pricing-header">
        <!-- Contact Bar -->
        <div class="header-contact-bar">...</div>
        
        <!-- Main Navigation -->
        <div class="header-nav">...</div>
        
        <!-- Pricing Context Bar -->
        <div class="pricing-context-bar">...</div>
    </header>
    
    <!-- Universal Header (hidden now that we have the enhanced header) -->
    <div id="universal-header-container" data-page-type="dtg" style="display: none;"></div>
    
    <div class="container">
        <!-- Hidden elements for legacy compatibility -->
        <h1 style="display: none;">DTG Pricing</h1>
        <input type="text" id="style-search-input" style="display: none;" />
        <button id="search-button" style="display: none;"></button>
        
        <!-- Two-Column Layout -->
        <div class="product-page-columns-container">
            
            <!-- Left Column: Product Context -->
            <div class="product-context-column">
                <div id="product-display"></div>
            </div>
            
            <!-- Right Column: Interactive Elements -->
            <div class="product-interactive-column">
                <!-- DTG v3 Visual Location Selector takes over here -->
                <div class="pricing-content-wrapper">
                    <!-- Quick Quote Calculator (hidden, replaced by v4) -->
                    <div id="quick-quote-container" style="display: none;"></div>
                    
                    <!-- Pricing Grid Container (moved into step 3 by v3) -->
                    <div id="pricing-grid-container"></div>
                </div>
            </div>
        </div>
        
        <!-- Hidden Caspio Data Source -->
        <div id="pricing-calculator" style="display:none !important; position: absolute; left: -9999px;">
            <!-- Caspio datapage will be loaded dynamically to prevent multiple loads -->
        </div>
        
        <!-- Hidden elements for quote system compatibility -->
        <div id="size-quantity-grid-container" style="display: none;"></div>
        <div id="quote-container" style="display: none;"></div>
    </div>
    
    <!-- Core JavaScript -->
    <script src="/shared_components/js/utils.js"></script>
    <script src="/shared_components/js/pricing-matrix-capture.js"></script>
    <script src="/shared_components/js/pricing-matrix-capture-fix.js"></script>
    <script src="/shared_components/js/pricing-matrix-api.js"></script>
    <script src="/shared_components/js/dp5-helper.js"></script>
    <script src="/product-url-handler.js"></script>
    
    <!-- DTG Specific JavaScript -->
    <script src="/shared_components/js/dtg-config.js"></script>
    <script src="/shared_components/js/dtg-page-setup.js"></script>
    <script src="/shared_components/js/dtg-adapter.js"></script>
    <script src="/shared_components/js/pricing-fallback-adapter.js"></script>
    
    <!-- Universal Components -->
    <script src="/shared_components/js/universal-header-component.js"></script>
    <script src="/shared_components/js/universal-product-display.js"></script>
    <script src="/shared_components/js/universal-image-gallery.js"></script>
    <script src="/shared_components/js/universal-quick-quote-calculator.js"></script>
    <script src="/shared_components/js/universal-pricing-grid.js"></script>
    
    <!-- Clean Color Adapter -->
    <script src="/shared_components/js/clean-color-adapter.js"></script>
    
    <!-- DTG Integration Layer -->
    <script src="/shared_components/js/dtg-integration.js"></script>
    
    <!-- DTG v4 Simplified Single-Page Experience -->
    <script src="/shared_components/js/dtg-pricing-v4.js"></script>
    
    <!-- DTG Product Recommendations Modal -->
    <script src="/shared_components/js/dtg-product-recommendations-modal.js"></script>
    
    <!-- Initialization Scripts -->
    <script>
        // Bridge functions for legacy compatibility
        window.loadProductDetails = function(styleNumber) {...};
        
        window.initializeProductFromURL = function() {...};
        
        // Minimal cart integration for DTG adapter
        window.initCartIntegrationWithData = async function(caspioEventData) {...};
        
        // Initialize on DOM ready
        document.addEventListener('DOMContentLoaded', function() {...});
        
        // Image modal setup
        function setupImageModal() {...}
    </script>
</body>
</html>
```

### Key HTML Elements

1. **Enhanced Header**: Contains contact information, navigation, and a pricing context bar that displays the current quantity and price per shirt.

2. **Two-Column Layout**:
   - Left Column: Product display with image, color swatches, and product information
   - Right Column: Interactive pricing elements including location selector and pricing grid

3. **Hidden Elements**:
   - Caspio data source (`pricing-calculator`): Used to load pricing data from Caspio
   - Legacy compatibility elements: Hidden inputs and containers for backward compatibility

4. **Script Loading Order**: The scripts are loaded in a specific order to ensure dependencies are met:
   - Core utilities first
   - DTG-specific configuration and setup
   - Universal components
   - Integration layer
   - DTG v4 implementation
   - Initialization scripts

## Core JavaScript Components

### DTG Pricing v4

The `dtg-pricing-v4.js` file implements the simplified single-page experience for DTG pricing. It provides an instant pricing interface with popular locations and expandable options.

Key features:

```javascript
// Configuration of print locations with metadata
const DTG_LOCATIONS = {
    'LC': {
        name: 'Left Chest',
        size: '4" × 4"',
        image: 'https://cdn.caspio.com/A0E15000/Safety%20Stripes/dtg-location-left-chest-png.png?ver=1',
        isPopular: true,
        displayOrder: 1
    },
    'FF': {
        name: 'Full Front',
        size: '12" × 16"',
        image: 'https://cdn.caspio.com/A0E15000/Safety%20Stripes/dtg-location-full-front.png.png?ver=1',
        isPopular: true,
        displayOrder: 2
    },
    // Additional locations...
};

// State management
let state = {
    selectedLocation: 'LC',
    quantity: 24,
    showAllLocations: false,
    isInitialized: false
};

// Main initialization function
function initialize() {
    // Inject the simplified UI structure
    injectUIStructure();
    
    // Setup event listeners
    setupEventListeners();
    
    // Initialize with default values
    updatePricing();
    
    // Trigger initial pricing load
    // ...
}

// UI Structure injection
function injectUIStructure() {
    // Creates the DOM structure for the DTG pricing interface
    // Including quantity controls, location selection, pricing breakdown, etc.
}

// Event listeners setup
function setupEventListeners() {
    // Sets up event listeners for quantity changes, location selection, etc.
}

// Pricing update functions
function updatePricing() {
    // Updates the pricing display based on the current state
    // Calculates unit price, total price, and applies LTM fee if applicable
}

// Location price updates
function updateLocationPrices() {
    // Updates the prices displayed on each location card
}

// Helper functions
function getPriceTier(quantity) {
    // Determines the appropriate price tier based on quantity
}

// Public API
window.DTGPricingV4 = {
    getState: () => state,
    setLocation: (code) => { /* ... */ },
    setQuantity: (qty) => { /* ... */ }
};
```

The v4 implementation creates a visual interface with location cards, quantity controls, and pricing displays. It communicates with other components through custom events and a global API.

### DTG Adapter

The `dtg-adapter.js` file handles the communication with the Caspio database to fetch pricing data. It processes the "master bundle" of pricing data and makes it available to other components.

Key features:

```javascript
// Constants
const DTG_APP_KEY = 'a0e150002eb9491a50104c1d99d7'; // DTG Specific AppKey
const ERROR_MESSAGE_DIV_ID = 'caspio-dtg-error-message';
const FALLBACK_UI_DIV_ID = 'cart-fallback-ui';
const EXPECTED_CASPIO_ORIGIN_1 = 'https://c3eku948.caspio.com'; // Primary Caspio domain
const EXPECTED_CASPIO_ORIGIN_2 = 'https://nwcustom.caspio.com'; // Custom Caspio domain
const EXPECTED_CASPIO_ORIGIN_3 = 'https://www.teamnwca.com'; // Production website domain

// Global state
let dtgCaspioMessageTimeoutId = null;
let dtgCaspioDataProcessed = false;
let dtgProcessingMasterBundle = false;
window.dtgMasterPriceBundle = null;
window.currentSelectedPrintLocation = "";

// Process the master bundle from Caspio
async function processMasterBundle(masterBundle) {
    // Validates and processes the pricing data bundle
    // Stores it globally and triggers location-specific pricing display
}

// Display pricing for a selected location
async function displayPricingForSelectedLocation(locationCode) {
    // Extracts location-specific pricing from the master bundle
    // Formats it for display and dispatches events for other components
}

// Handle messages from Caspio iframe
function handleCaspioMessage(event) {
    // Validates and processes messages from the Caspio iframe
    // Triggers processing of the master bundle when received
}

// Initialize DTG pricing
async function initDTGPricing() {
    // Sets up message listeners, resets flags, and loads the Caspio datapage
}

// Load Caspio datapage
function loadCaspioDatapage(styleNumber, colorName) {
    // Dynamically creates and loads the Caspio script with parameters
}

// Public API
window.DTGAdapter = {
    APP_KEY: DTG_APP_KEY,
    init: initDTGPricing,
    processMasterBundle: processMasterBundle, 
    displayPricingForSelectedLocation: displayPricingForSelectedLocation
};
```

The adapter acts as a bridge between the Caspio database and the DTG pricing interface. It handles data validation, error states, and transforms the data into a format usable by other components.

### DTG Configuration

The `dtg-config.js` file provides centralized configuration for all DTG-specific settings. It defines constants, helper functions, and configuration objects used throughout the DTG pricing page.

Key features:

```javascript
const DTGConfig = {
    // Page type identifier
    pageType: 'dtg',
    
    // Product settings
    unitLabel: 'shirts',
    productType: 'Direct to Garment Printing',
    
    // Print location configurations
    locations: {
        'LC': {
            name: 'Left Chest Only',
            displayName: 'Left Chest',
            description: 'Standard left chest placement (4" x 4" max)',
            maxSize: '4" x 4"'
        },
        // Additional locations...
    },
    
    // Print size reference
    printSizes: {
        'LC': '4" x 4"',
        'FF': '12" x 16"',
        // Additional sizes...
    },
    
    // Pricing configurations
    pricing: {
        ltmThreshold: 24,
        ltmFee: 50,
        ltmMessage: 'Orders under 24 shirts include a $50 setup fee',
        
        // Size group upcharges
        sizeUpcharges: {
            'S-XL': 0,
            '2XL': 2.00,
            // Additional upcharges...
        },
        
        // Default quantity tiers
        defaultTiers: [
            { min: 1, max: 11, label: '1-11' },
            { min: 12, max: 23, label: '12-23' },
            // Additional tiers...
        ]
    },
    
    // Quick Quote Calculator settings
    quickQuote: {
        enabled: true,
        defaultQuantity: 24,
        showLocationSelector: true,
        defaultLocation: 'LC',
        quickSelectButtons: [
            { label: '1 Dozen', quantity: 12 },
            { label: '2 Dozen', quantity: 24 },
            // Additional buttons...
        ]
    },
    
    // Universal Pricing Grid settings
    pricingGrid: {
        showInventory: true,
        inventoryThreshold: 10,
        loadingAnimation: true,
        showColorIndicator: true,
        showBestValueBadges: true,
        highlightCurrentTier: true
    },
    
    // Helper methods
    helpers: {
        getLocationInfo(locationCode) { /* ... */ },
        getLocationDescription(locationCode) { /* ... */ },
        formatPrice(price) { /* ... */ },
        isLTM(quantity) { /* ... */ },
        getTierForQuantity(quantity) { /* ... */ }
    }
};

// Make available globally
window.DTGConfig = DTGConfig;
```

The configuration file centralizes all settings, making it easier to maintain and update the DTG pricing functionality.

### DTG Page Setup

The `dtg-page-setup.js` file handles the initialization of the DTG pricing page, including product context, color swatches, and image handling.

Key features:

```javascript
// Global state
window.selectedStyleNumber = null;
window.selectedColorName = null;
window.selectedCatalogColor = null;

// Initialize when DOM is ready
function initializeDTGPage() {
    updateProductContext();
    setupBackButton();
    setupImageZoom();
}

// Update product context from URL parameters
function updateProductContext() {
    // Extracts style number and color from URL
    // Updates global state and UI elements
}

// Fetch product details from API
async function fetchProductDetails(styleNumber) {
    // Fetches product data including colors and images
    // Updates product display and color swatches
}

// Handle color swatch clicks
function handleColorSwatchClick(colorData) {
    // Updates global state and UI for color changes
    // Updates URL parameters and triggers pricing updates
}

// Update product image
function updateProductImage(colorData) {
    // Updates the main product image based on selected color
    // Populates thumbnails for different views
}

// Setup image zoom functionality
function setupImageZoom() {
    // Sets up zoom functionality for the main product image
}

// Export key functions for global access
window.DTGPageSetup = {
    updateProductContext,
    setupBackButton,
    fetchProductDetails,
    handleColorSwatchClick,
    updateProductImage,
    updateSelectedColorDisplay,
    populateThumbnails,
    setupImageZoom
};
```

The page setup module handles the product context, color selection, and image display functionality of the DTG pricing page.

### DTG Integration

The `dtg-integration.js` file connects the DTG adapter with universal components, providing a cohesive user experience.

Key features:

```javascript
class DTGIntegration {
    constructor() {
        this.config = window.DTGConfig;
        this.components = {};
        this.state = {
            currentLocation: null,
            currentPricingData: null,
            isInitialized: false,
            lastPricingUpdate: 0,
            isLoadingPricing: false
        };
        
        // Wait for DOM before initializing
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initialize());
        } else {
            this.initialize();
        }
    }
    
    initialize() {
        // Initialize components
        this.initializeComponents();
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Initialize location selector
        this.initializeLocationSelector();
        
        // Mark as initialized
        this.state.isInitialized = true;
        
        // Trigger initial location load if default location is set
        if (this.config.quickQuote.defaultLocation) {
            setTimeout(() => {
                this.handleLocationChange(this.config.quickQuote.defaultLocation);
            }, 500);
        }
    }
    
    initializeComponents() {
        // Initialize Universal Product Display
        this.components.productDisplay = new UniversalProductDisplay({...});
        
        // Initialize Quick Quote Calculator with DTG location support
        this.components.quickQuote = new UniversalQuickQuoteCalculator({...});
        
        // Initialize Universal Pricing Grid
        this.components.pricingGrid = new UniversalPricingGrid({...});
    }
    
    setupEventListeners() {
        // Listen for pricing data from DTG adapter
        window.addEventListener('pricingDataLoaded', (event) => {...});
        
        // Listen for color changes
        window.addEventListener('colorChanged', (event) => {...});
        
        // Listen for quantity changes from Quick Quote
        window.addEventListener('quantityChanged', (event) => {...});
        
        // Listen for location changes from DTG v3
        window.addEventListener('dtgLocationSelected', (event) => {...});
    }
    
    handleLocationChange(locationCode) {
        // Updates the current location and triggers pricing updates
    }
    
    handlePricingDataLoaded(data) {
        // Processes pricing data and updates components
    }
    
    // Additional helper methods and event handlers
    // ...
}

// Initialize when ready
const dtgIntegration = new DTGIntegration();

// Make available globally
window.DTGIntegration = dtgIntegration;
```

The integration module ties together all the components of the DTG pricing page, handling event communication and state management.

## CSS Styling

### DTG-specific CSS

The `dtg-specific.css` file provides custom styles for the DTG pricing page, including layout, colors, and interactive elements.

Key features:

```css
/* DTG Page Layout */
.dtg-pricing-page {
    --dtg-primary: #2e5827;
    --dtg-primary-light: #e8f5e9;
    --dtg-primary-dark: #1b4118;
}

/* Quick Quote Location Selector */
.dtg-pricing-page .location-selector-group {
    margin-bottom: 20px;
    padding: 20px;
    background: linear-gradient(135deg, #f0f5f0 0%, #e8f5e9 100%);
    border-radius: var(--radius-md);
    border: 2px solid var(--dtg-primary-light);
}

/* Location Selector Styling */
.location-selector-container {
    margin-bottom: 20px;
    padding: 20px;
    background: linear-gradient(135deg, var(--neutral-50) 0%, var(--neutral-100) 100%);
    border-radius: var(--radius-lg);
    text-align: center;
    box-shadow: var(--shadow-sm);
    border: 1px solid var(--neutral-200);
    transition: all var(--transition-base);
}

/* Print Location Visual Guide */
.print-location-guide {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: 15px;
    margin-top: 20px;
    padding: 15px;
    background: var(--neutral-50);
    border-radius: var(--radius-md);
}

/* DTG Quote Section Enhancements */
.dtg-quote-section {
    background: white;
    border-radius: var(--radius-lg);
    padding: 25px;
    box-shadow: var(--shadow-md);
    margin-top: 20px;
}

/* Enhanced loading states for DTG */
.dtg-loading-animation {
    position: relative;
    text-align: center;
    padding: 40px;
}

/* Mobile optimizations for DTG */
@media (max-width: 768px) {
    .location-selector-container {
        padding: 15px;
    }
    
    #parent-dtg-location-select {
        width: 100%;
        min-width: unset;
    }
    
    .print-location-guide {
        grid-template-columns: repeat(2, 1fr);
        gap: 10px;
    }
    
    /* Additional mobile styles... */
}
```

The CSS file provides a consistent visual style for the DTG pricing page, with responsive design for different screen sizes.

### DTG Pricing Table Fix

The `dtg-pricing-table-fix.css` file provides specific fixes for the pricing table to ensure consistent styling.

Key features:

```css
/* Override any previous styles - use green headers like embroidery page */
.dtg-pricing-page .pricing-grid thead,
.dtg-pricing-page .pricing-grid thead tr {
    background-color: #3a7c52 !important;
    background: #3a7c52 !important;
}

.dtg-pricing-page .pricing-grid th {
    background-color: #3a7c52 !important;
    background: #3a7c52 !important;
    color: white !important;
}

/* Ensure headers are visible with white text on green background */
.dtg-pricing-page .pricing-grid thead th {
    background-color: #3a7c52 !important;
    color: white !important;
    font-weight: 600 !important;
    font-size: 13px !important;
    text-transform: uppercase !important;
    letter-spacing: 0.03em !important;
    padding: 16px 8px !important;
    border: none !important;
}

/* Active tier highlighting for DTG */
.dtg-pricing-page .pricing-grid tr.active-tier {
    background-color: #e8f5e9 !important;
    box-shadow: inset 0 0 0 2px #3a7c52 !important;
}

.dtg-pricing-page .pricing-grid tr.active-tier td {
    font-weight: 600 !important;
}

/* Additional styling fixes... */
```

This CSS file ensures that the pricing table has consistent styling with green headers and proper highlighting for the active tier.

### DTG Recommendations

The `dtg-recommendations.css` file styles the product recommendations feature, which suggests optimal products for DTG printing.

Key features:

```css
/* Main Recommendations Section */
.dtg-recommendations-section {
    margin: 20px 0 30px 0;
    background: white;
    border-radius: 12px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.08);
    overflow: hidden;
    transition: all 0.3s ease;
}

/* Section Header */
.dtg-recommendations-header {
    background: linear-gradient(135deg, #2e5827 0%, #3a7c52 100%);
    color: white;
    padding: 20px 25px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    cursor: pointer;
    user-select: none;
}

/* Product Grid */
.dtg-products-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 20px;
    margin-bottom: 20px;
}

/* Product Card */
.dtg-product-card {
    background: white;
    border: 2px solid #e1e4e8;
    border-radius: 10px;
    padding: 18px;
    transition: all 0.2s ease;
    cursor: pointer;
    position: relative;
    overflow: hidden;
}

/* Mobile Responsiveness */
@media (max-width: 768px) {
    .dtg-products-grid {
        grid-template-columns: 1fr;
        gap: 15px;
    }
    
    /* Additional mobile styles... */
}
```

This CSS file provides styling for the product recommendations feature, including cards, grids, and responsive design.

## Component Interactions

The DTG pricing page uses an event-driven architecture to enable communication between components. Here's how the components interact:

1. **Page Initialization Flow**:
   - `dtg-page-setup.js` initializes the product context from URL parameters
   - `dtg-adapter.js` loads the Caspio datapage to fetch pricing data
   - `dtg-integration.js` initializes universal components and sets up event listeners
   - `dtg-pricing-v4.js` creates the visual interface for location selection and quantity input

2. **Data Flow**:
   - Caspio datapage sends a message with the master price bundle
   - `dtg-adapter.js` processes the bundle and dispatches a `pricingDataLoaded` event
   - `dtg-integration.js` listens for this event and updates the universal components
   - `dtg-pricing-v4.js` updates its UI based on the pricing data

3. **User Interaction Flow**:
   - User selects a print location:
     - `dtg-pricing-v4.js` updates its state and calls `DTGAdapter.displayPricingForSelectedLocation()`
     - `dtg-adapter.js` extracts location-specific pricing and dispatches a `pricingDataLoaded` event
     - Components update to reflect the new pricing
   
   - User changes quantity:
     - `dtg-pricing-v4.js` updates its state and dispatches a `quantityChanged` event
     - `dtg-integration.js` listens for this event and updates the pricing grid
     - Components update to reflect the new quantity

   - User selects a different color:
     - `dtg-page-setup.js` handles the color change and dispatches a `colorChanged` event
     - `dtg-integration.js` listens for this event and updates the color indicator in the pricing grid

4. **Event Types**:
   - `pricingDataLoaded`: Fired when new pricing data is available
   - `quantityChanged`: Fired when the user changes the quantity
   - `colorChanged`: Fired when the user selects a different color
   - `dtgLocationSelected`: Fired when a print location is selected

## Workflow and User Experience

The DTG pricing page provides a streamlined user experience:

1. **Initial Load**:
   - Page loads with product information from URL parameters
   - Default print location (Left Chest) is selected
   - Default quantity (24) is set
   - Pricing is automatically loaded for these defaults

2. **Product Selection**:
   - User can view product details in the left column
   - User can select different colors using the color swatches
   - Product images update to reflect the selected color

3. **Print Location Selection**:
   - User can select from popular print locations (Left Chest, Full Front, etc.)
   - Each location card shows an image, name, size, and price
   - User can expand to see additional location options

4. **Quantity Selection**:
   - User can adjust quantity using the +/- buttons or direct input
   - Pricing updates automatically based on quantity
   - LTM fee is applied for quantities under 24

5. **Pricing Display**:
   - Unit price an
5. **Pricing Display**:
   - Unit price and total price are prominently displayed
   - Pricing breakdown shows base price, location, and any LTM fees
   - Complete pricing reference table shows all size and quantity combinations
   - Current quantity tier is highlighted in the pricing table

6. **Additional Features**:
   - Product recommendations modal provides guidance on optimal products for DTG printing
   - Image zoom functionality allows detailed view of product images
   - Multiple product views (front, back, side) available through thumbnails

The workflow is designed to be intuitive, with real-time pricing updates as the user makes selections. The visual location selector makes it easy to understand different print options, and the pricing breakdown provides transparency about how the final price is calculated.

## Conclusion

The DTG Pricing page is built with a modular architecture that separates concerns into distinct components:

- **Configuration**: Centralized in `dtg-config.js`
- **Data Fetching**: Handled by `dtg-adapter.js`
- **Product Context**: Managed by `dtg-page-setup.js`
- **Component Integration**: Coordinated by `dtg-integration.js`
- **User Interface**: Implemented in `dtg-pricing-v4.js`

This architecture makes the code maintainable and extensible, allowing for future enhancements while preserving backward compatibility with existing systems.

The page uses modern web development practices including:
- Event-driven communication between components
- Responsive design for mobile and desktop
- Progressive enhancement with fallbacks
- Modular CSS with component-specific styling
- Clean separation of concerns between HTML, CSS, and JavaScript

These practices ensure a robust and user-friendly experience for calculating DTG pricing.

## Manual DTG Pricing Calculator

In addition to the main DTG pricing system, there is a manual DTG pricing calculator available for special cases where custom garment pricing is needed. This calculator is accessible from the Staff Dashboard and provides a simplified interface for calculating DTG pricing on customer-supplied items.

### Location and Access

- **File**: `/calculators/dtg-manual-pricing.html`
- **Access**: Via Staff Dashboard under "Manual Pricing Calculators" section
- **Purpose**: Calculate DTG pricing for customer-supplied garments where base cost needs manual input

### Key Features

1. **Manual Base Cost Input**: Allows staff to enter the exact cost of customer-supplied garments
2. **API Integration**: Uses the same pricing API endpoint as the main DTG system
3. **Location Selection**: Visual cards for all DTG print locations including combo options
4. **Real-time Pricing**: Instant calculation as inputs change
5. **LTM Fee Handling**: Automatic calculation of Less Than Minimum fees for orders under 24 pieces
6. **Quantity Slider**: Interactive "what if" slider to show pricing at different quantities
7. **Detailed Breakdown**: Collapsible section showing all pricing components

### Technical Implementation

The manual calculator uses a single-file architecture with embedded JavaScript that:

- Fetches pricing data from the API endpoint: `https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/pricing-bundle?method=DTG`
- Implements the same pricing formulas as the main system:
  - Base Cost ÷ Margin Denominator (0.6)
  - Plus print cost based on location and quantity tier
  - Plus LTM fee if quantity < 24 ($50 divided by quantity)
  - Rounded to nearest half dollar
- Uses session storage to cache API responses for 30 minutes
- Includes debug mode flag for troubleshooting

### Pricing Tiers

The calculator recognizes these quantity tiers from the API:
- 1-11 (not used in tiersR)
- 12-23 (exists in print costs only)
- 24-47
- 48-71
- 72+

For quantities under 24, it always uses the 24-47 tier pricing and adds the LTM fee.

### Print Locations

All standard DTG locations are supported:
- Single locations: LC, FF, FB, JF, JB
- Combo locations: LC_FB, LC_JB, FF_FB, JF_JB

Combo location pricing is calculated by summing the individual component costs.

## Caspio Integration and Data Processing

This section provides a detailed explanation of how the DTG pricing application integrates with Caspio to fetch, process, and display pricing data.

### Caspio Datapage Architecture

The DTG pricing system uses a Caspio datapage named "DP6_DTG_Pricing_MASTER BUNDLE" (AppKey: a0e150002177c037d053438abf13) as a middleware component for pricing data. This datapage is structured as follows:

1. **Base Configuration**:
   - Type: WebApp
   - Data Source: "Inventory" table
   - Ajax Enabled: True
   - Parameters Allowed: Yes (StyleNumber and COLOR)

2. **Invisible UI**:
   - The datapage is designed to be invisible to the end user
   - CSS in the PageHeader hides all Caspio default elements
   - The datapage functions purely as a data processing service

3. **Data Filtering**:
   - Uses two criteria items in an AND relationship:
     - `catalog_no` equals the StyleNumber parameter
     - `catalog_color` equals the COLOR parameter

4. **Display Fields**:
   - Basic product data: catalog_no, catalog_color, size, SizeSortOrder, case_price
   - Three HTML blocks containing JavaScript for data processing

The datapage is loaded dynamically into a hidden container (`#pricing-calculator`) when pricing data is needed, triggered by product selection in the main application.

### HTML Blocks Functionality

The datapage contains three HTML blocks that work together to fetch, process, and deliver pricing data:

#### Block 1: Data Fetching (v9.2)

```javascript
// FINAL DTG Block 1: Data Fetching (v9.2)
async function getDtgData(styleNo) {
    const cacheKey = `dtgPricingData-${styleNo}`;
    const cachedData = sessionStorage.getItem(cacheKey);
    if (cachedData) {
        console.log(`[DTG B1] Found all data for ${styleNo} in cache.`);
        return JSON.parse(cachedData);
    }
    console.log(`[DTG B1] No cache. Fetching all data for ${styleNo} from API.`);
    const baseUrl = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
    const url = `${baseUrl}/api/pricing-bundle?method=DTG&styleNumber=${styleNo}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`API status: ${response.status}`);
    const allData = await response.json();
    sessionStorage.setItem(cacheKey, JSON.stringify(allData));
    return allData;
}

window.initDp6ApiFetch = async function() {
    console.log('[DTG B1] initDp6ApiFetch triggered.');
    const params = new URLSearchParams(window.location.search);
    const styleNo = params.get('StyleNumber');
    if (!styleNo) {
        document.dispatchEvent(new CustomEvent('dp6DataFailed', {
            detail: { error: 'No StyleNumber' }
        }));
        return;
    }
    try {
        const apiData = await getDtgData(styleNo);
        console.log('[DTG B1] All data fetched successfully.');
        document.dispatchEvent(new CustomEvent('dp6DataReady', {
            detail: {
                styleNumber: styleNo,
                colorName: params.get('COLOR') ? decodeURIComponent(params.get('COLOR').replace(/\+/g, ' ')) : '',
                apiData: apiData
            }
        }));
    } catch (error) {
        document.dispatchEvent(new CustomEvent('dp6DataFailed', {
            detail: { error: `API Fetch Failed: ${error.message}` }
        }));
    }
};
```

This block is responsible for:
- Fetching pricing data from an external API
- Implementing caching using sessionStorage
- Extracting URL parameters
- Dispatching custom events with the fetched data

#### Block 2: Price Calculation Engine (v9.2)

```javascript
// FINAL DTG Block 2: Price Calculation Engine (v9.2 - Switched to Upcharge Logic)
window.dp6_calculateAllLocationPrices = function(apiData) {
    console.log('[DTG B2] Starting all-location price calculations with UPCHARGE logic...');
    const { tiersR, rulesR, allDtgCostsR, sizes, locations, sellingPriceDisplayAddOns } = apiData;
    
    // Determine a single standard garment cost (typically size 'S')
    const sortedSizes = [...sizes].sort((a, b) => (a.sortOrder || Infinity) - (b.sortOrder || Infinity));
    const standardGarment = sortedSizes.find(s => s.size.toUpperCase() === 'S') || sortedSizes[0];
    if (!standardGarment) throw new Error("No sizes available to determine standard garment cost.");
    const standardGarmentCost = parseFloat(standardGarment.price);
    
    // Create the garmentCostMap for sort order reference
    const garmentCostMap = {};
    if (Array.isArray(sizes)) {
        sizes.forEach(s => {
            garmentCostMap[s.size.toUpperCase()] = {
                price: s.price,
                sortOrder: s.sortOrder
            };
        });
    }
    
    // Helper function to round prices to the nearest half dollar
    const roundUpToHalfDollar = (amount) => {
        if (isNaN(amount)) return 0;
        return Math.ceil(amount * 2) / 2;
    };
    
    // Calculate pricing for each location
    const calculatePriceProfileForLocation = (locCode) => {
        const individualLocCodes = locCode.split('_');
        const priceProfile = {};
        
        // Initialize the price profile structure
        for (const size of sortedSizes.map(s => s.size)) {
            priceProfile[size] = {};
        }
        
        // Calculate prices for each tier
        for (const tier of tiersR) {
            const tierLabel = tier.TierLabel;
            
            // Calculate the total print cost for this location and tier
            let dtgCost = null;
            let currentTotal = 0;
            let costMissing = false;
            
            for (const code of individualLocCodes) {
                const costEntry = allDtgCostsR.find(c =>
                    c.PrintLocationCode === code && c.TierLabel === tierLabel
                );
                
                if (costEntry && costEntry.PrintCost !== undefined) {
                    currentTotal += parseFloat(costEntry.PrintCost);
                } else {
                    costMissing = true;
                    break;
                }
            }
            
            if (!costMissing) dtgCost = currentTotal;
            const marginDenom = parseFloat(tier.MarginDenominator);
            
            if (dtgCost === null || !marginDenom) {
                sortedSizes.forEach(s => {
                    priceProfile[s.size][tierLabel] = null;
                });
                continue;
            }
            
            // Calculate the base price using the standard garment
            const markedUpStandardGarment = standardGarmentCost / marginDenom;
            const decoratedStandardPrice = markedUpStandardGarment + dtgCost;
            const roundedStandardPrice = roundUpToHalfDollar(decoratedStandardPrice);
            
            // Apply size-specific upcharges
            for (const sizeInfo of sortedSizes) {
                const sizeKey = sizeInfo.size;
                const upcharge = parseFloat(sellingPriceDisplayAddOns[sizeKey] || 0);
                const finalPrice = roundedStandardPrice + upcharge;
                priceProfile[sizeKey][tierLabel] = parseFloat(finalPrice.toFixed(2));
            }
        }
        
        return priceProfile;
    };
    
    // Calculate prices for all locations
    const allLocationPrices = {};
    locations.forEach(loc => {
        allLocationPrices[loc.code] = calculatePriceProfileForLocation(loc.code);
    });
    
    console.log('[DTG B2] All location calculations complete.');
    return { allLocationPrices, garmentCostMap };
};
```

This block is responsible for:
- Processing the API data to calculate prices for all locations
- Implementing the "upcharge logic" pricing model
- Determining the standard garment cost
- Applying markups, print costs, and size upcharges
- Rounding prices to the nearest half dollar
- Organizing pricing data by location, size, and tier

#### Block 3: Bundle Builder & Dispatcher (v9.2)

```javascript
// FINAL DTG Block 3: Bundle Builder & Dispatcher (v9.2 - Safe Logging)
(function() {
    'use strict';
    
    if (window.dtgMasterBundleListenersAttached) return;
    
    function buildMasterBundle(eventDetail, calculationResult) {
        const { styleNumber, colorName, apiData } = eventDetail;
        const { allLocationPrices, garmentCostMap } = calculationResult;
        
        // Sort sizes by their defined order
        const sortedSizes = Object.keys(garmentCostMap).sort((a, b) =>
            garmentCostMap[a].sortOrder - garmentCostMap[b].sortOrder
        );
        
        // Organize tier data for easier access
        const tierDataObj = {};
        if (Array.isArray(apiData.tiersR)) {
            apiData.tiersR.forEach(tier => {
                if (tier && tier.TierLabel) tierDataObj[tier.TierLabel] = tier;
            });
        }
        
        // Build the complete master bundle
        return {
            styleNumber: styleNumber,
            color: colorName,
            embellishmentType: 'dtg',
            tierData: tierDataObj,
            rulesData: apiData.rulesR,
            uniqueSizes: sortedSizes,
            sellingPriceDisplayAddOns: apiData.sellingPriceDisplayAddOns || {},
            allLocationPrices: allLocationPrices,
            printLocationMeta: apiData.locations || [],
            capturedAt: new Date().toISOString(),
            hasError: false,
            errorMessage: ''
        };
    }
    
    function dispatchToParent(payload) {
        // Log the payload for debugging
        console.log("--- [DTG B3] MASTER BUNDLE PAYLOAD ---");
        console.log(JSON.stringify(payload.detail, null, 2));
        
        // Send the data to the parent window
        if (parent && typeof parent.postMessage === 'function') {
            parent.postMessage(payload, '*');
            console.log(`[DTG B3] SUCCESS: Master bundle sent for Style: ${payload.detail.styleNumber}.`);
        }
    }
    
    function handleDataSuccess(event) {
        console.log('[DTG B3] dp6DataReady event received.');
        try {
            if (typeof window.dp6_calculateAllLocationPrices !== 'function') {
                throw new Error("Calculation function (B2) is not available.");
            }
            
            // Calculate prices using the function from Block 2
            const calculationResult = window.dp6_calculateAllLocationPrices(event.detail.apiData);
            
            // Build the master bundle
            const masterBundle = buildMasterBundle(event.detail, calculationResult);
            
            // Dispatch the bundle to the parent window
            dispatchToParent({
                type: 'caspioDtgMasterBundleReady',
                detail: masterBundle
            });
        } catch (error) {
            console.error('[DTG B3] Error during bundle creation:', error);
            dispatchToParent({
                type: 'caspioDtgMasterBundleFailed',
                detail: { hasError: true, errorMessage: error.message }
            });
        }
    }
    
    function handleDataFailure(event) {
        console.error('[DTG B3] dp6DataFailed event received.', event.detail);
        dispatchToParent({
            type: 'caspioDtgMasterBundleFailed',
            detail: { hasError: true, errorMessage: event.detail.error }
        });
    }
    
    // Attach event listeners
    console.log('[DTG B3] Attaching event listeners.');
    document.addEventListener('dp6DataReady', handleDataSuccess);
    document.addEventListener('dp6DataFailed', handleDataFailure);
    window.dtgMasterBundleListenersAttached = true;
})();
```

This block is responsible for:
- Setting up event listeners for data events
- Building the master bundle with all pricing data
- Sending the bundle to the parent window
- Handling success and error cases
- Preventing duplicate event listener attachment

### API Endpoint Details

The DTG pricing system uses an external API to fetch pricing data:

- **Base URL**: `https://caspio-pricing-proxy-ab30a049961a.herokuapp.com`
- **Endpoint**: `/api/pricing-bundle`
- **Method**: GET
- **Parameters**:
  - `method`: Set to "DTG" for Direct to Garment pricing
  - `styleNumber`: The product style number to get pricing for
- **Full URL Example**: `https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/pricing-bundle?method=DTG&styleNumber=5000`

#### Response Format

The API returns a JSON object with the following structure:

```json
{
  "tiersR": [
    { "TierLabel": "1-11", "MarginDenominator": "0.5", ... },
    { "TierLabel": "12-23", "MarginDenominator": "0.55", ... },
    ...
  ],
  "rulesR": [
    { "RuleID": "1", "RuleName": "LTM Fee", "RuleValue": "50", ... },
    ...
  ],
  "allDtgCostsR": [
    { "PrintLocationCode": "LC", "TierLabel": "1-11", "PrintCost": "3.50", ... },
    { "PrintLocationCode": "FF", "TierLabel": "1-11", "PrintCost": "5.75", ... },
    ...
  ],
  "sizes": [
    { "size": "S", "price": "3.25", "sortOrder": 1 },
    { "size": "M", "price": "3.25", "sortOrder": 2 },
    ...
  ],
  "locations": [
    { "code": "LC", "name": "Left Chest", "description": "4\" x 4\" max", ... },
    { "code": "FF", "name": "Full Front", "description": "12\" x 16\" max", ... },
    ...
  ],
  "sellingPriceDisplayAddOns": {
    "S": "0.00",
    "M": "0.00",
    "L": "0.00",
    "XL": "0.00",
    "2XL": "2.00",
    ...
  }
}
```

### Data Flow from API Fetch to Final Bundle Creation

The complete data flow process follows these steps:

1. **Initialization**:
   - The Caspio datapage loads with URL parameters for StyleNumber and COLOR
   - The PageFooter script listens for the "DataPageReady" event
   - When the event fires, it calls `initDp6ApiFetch()`

2. **API Data Fetching (Block 1)**:
   - `initDp6ApiFetch()` extracts StyleNumber and COLOR from URL parameters
   - It calls `getDtgData(styleNo)` to fetch pricing data
   - `getDtgData()` first checks sessionStorage for cached data
   - If no cache exists, it makes an API request to the pricing-bundle endpoint
   - On success, it caches the response and dispatches a 'dp6DataReady' event
   - On failure, it dispatches a 'dp6DataFailed' event

3. **Price Calculation (Block 2)**:
   - Block 3 listens for the 'dp6DataReady' event
   - When received, it calls `window.dp6_calculateAllLocationPrices(apiData)`
   - This function processes the API data to calculate prices for all locations:
     - It determines a standard garment cost (typically size 'S')
     - For each location and tier, it:
       - Calculates the base price using the standard garment cost and tier margin
       - Adds location-specific print costs
       - Rounds to the nearest half dollar
       - Applies size-specific upcharges
     - It returns an object with `allLocationPrices` and `garmentCostMap`

4. **Master Bundle Creation (Block 3)**:
   - After calculation, Block 3 calls `buildMasterBundle(eventDetail, calculationResult)`
   - This function constructs a comprehensive data bundle with all pricing data
   - The bundle is logged to the console for debugging
   - It's then sent to the parent window using `parent.postMessage()`
   - The message type is 'caspioDtgMasterBundleReady' for success

5. **Parent Window Processing**:
   - The parent window (main application) listens for these messages
   - When received, it uses the master bundle to update the UI with pricing information

### Event-Driven Communication Pattern

The DTG pricing system uses an event-driven architecture for communication:

1. **DOM Events**:
   - `DOMContentLoaded`: Standard browser event for document loading
   - `DataPageReady`: Custom event that signals the Caspio datapage is ready

2. **Custom Events for Data Processing**:
   - `dp6DataReady`: Dispatched when API data is successfully fetched
   - `dp6DataFailed`: Dispatched when API data fetching fails

3. **Event Listeners**:
   - Block 3 sets up listeners for the custom events
   - Listeners are protected against duplication with a flag

4. **Cross-Window Communication**:
   - `postMessage`: Used to send data from the Caspio iframe to the parent window
   - Message Types:
     - `caspioDtgMasterBundleReady`: Sent when the master bundle is ready
     - `caspioDtgMasterBundleFailed`: Sent when there's an error

5. **Event Flow**:
   ```
   DOM loads → DataPageReady → initDp6ApiFetch() → API fetch
   → dp6DataReady → calculateAllLocationPrices() → buildMasterBundle()
   → postMessage to parent → UI update
   ```

### Master Bundle Structure

The master bundle is a comprehensive data structure that contains all pricing information:

```javascript
{
  // Basic product information
  styleNumber: "5000",
  color: "Black",
  embellishmentType: "dtg",
  
  // Pricing tier information
  tierData: {
    "1-11": { TierLabel: "1-11", MarginDenominator: "0.5", ... },
    "12-23": { TierLabel: "12-23", MarginDenominator: "0.55", ... },
    // Additional tiers...
  },
  
  // Business rules
  rulesData: [
    { RuleID: "1", RuleName: "LTM Fee", RuleValue: "50", ... },
    // Additional rules...
  ],
  
  // Available sizes, sorted by order
  uniqueSizes: ["S", "M", "L", "XL", "2XL", ...],
  
  // Size-specific upcharges
  sellingPriceDisplayAddOns: {
    "S": "0.00",
    "M": "0.00",
    "L": "0.00",
    "XL": "0.00",
    "2XL": "2.00",
    // Additional sizes...
  },
  
  // Pricing for each print location, organized by size and tier
  allLocationPrices: {
    "LC": {
      "S": { "1-11": 15.99, "12-23": 13.99, ... },
      "M": { "1-11": 15.99, "12-23": 13.99, ... },
      // Additional sizes...
    },
    "FF": {
      // Similar structure for Full Front location
      // Additional sizes...
    },
    // Additional locations...
  },
  
  // Metadata about print locations
  printLocationMeta: [
    { code: "LC", name: "Left Chest", description: "4\" x 4\" max", ... },
    { code: "FF", name: "Full Front", description: "12\" x 16\" max", ... },
    // Additional locations...
  ],
  
  // Metadata
  capturedAt: "2025-07-12T12:13:45.678Z",
  hasError: false,
  errorMessage: ""
}
```

In error cases, a simplified bundle is sent:

```javascript
{
  hasError: true,
  errorMessage: "API Fetch Failed: Network error"
}
```

### Integration with the Main Application

The DTG pricing page integrates with this Caspio datapage through:

1. **Dynamic Loading**:
   - The Caspio datapage is loaded into a hidden container when needed
   - The loading is triggered by product selection in the main application

2. **Message Listening**:
   - The main application sets up a listener for messages from the Caspio iframe
   - When a 'caspioDtgMasterBundleReady' message is received, it processes the data

3. **Data Processing**:
   - The main application extracts pricing information from the master bundle
   - It updates the UI components with the pricing data
   - It handles error cases by showing appropriate messages

4. **Caching Strategy**:
   - The system uses sessionStorage to cache API responses
   - This reduces API calls and improves performance for repeated product views

This architecture provides a clean separation of concerns, with the Caspio datapage handling data fetching and processing, and the main application handling UI updates and user interaction.