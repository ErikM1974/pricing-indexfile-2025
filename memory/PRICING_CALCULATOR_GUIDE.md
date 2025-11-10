# Comprehensive Pricing Calculator Development Guide

**Last Updated:** 2025-01-27
**Purpose:** Complete guide for creating new pricing calculators for Northwest Custom Apparel's product pages

## Table of Contents
1. [Overview: Pricing Calculators vs Quote Builders](#overview)
2. [Architecture Patterns](#architecture-patterns)
3. [Master Bundle Data Structure](#master-bundle-data-structure)
4. [Pricing Calculation Logic](#pricing-calculation-logic)
5. [HTML Template](#html-template)
6. [Adapter Pattern Template](#adapter-pattern-template)
7. [Service Pattern Template](#service-pattern-template)
8. [API Integration](#api-integration)
9. [Testing & Debugging](#testing-debugging)
10. [Common Issues & Solutions](#common-issues)

## Overview: Pricing Calculators vs Quote Builders {#overview}

### Pricing Calculators
- **Purpose:** Show pricing for individual products on product pages
- **Scope:** Single product, multiple decoration options
- **Persistence:** No database storage, session only
- **Examples:** DTG, Screen Print, DTF, Embroidery, Cap Embroidery
- **URL Pattern:** `/calculators/[method]-pricing.html?styleNumber=PC61`
- **Key Feature:** Real-time pricing display as user changes options

### Quote Builders
- **Purpose:** Create multi-product quotes with database persistence
- **Scope:** Multiple products, full quote generation
- **Persistence:** Saved to database (quote_sessions + quote_items)
- **Examples:** DTG Quote, Embroidery Quote, Screen Print Quote
- **URL Pattern:** `/quote-builders/[method]-quote-builder.html`
- **Key Feature:** 3-phase workflow (Setup → Add Products → Review & Save)

## Architecture Patterns {#architecture-patterns}

### Pattern 1: Adapter Pattern (DTG/DTF Style)
- **When to Use:** Complex pricing with multiple locations/options
- **Key Files:**
  - Adapter: `/shared_components/js/[method]-adapter.js`
  - Service: `/shared_components/js/[method]-pricing-service.js`
  - Integration: `/shared_components/js/[method]-integration.js`
- **Data Flow:** Caspio → PostMessage → Adapter → Event Dispatch → UI
- **Advantages:** Separation of concerns, reusable adapter

### Pattern 2: Service Pattern (Screen Print/Embroidery Style)
- **When to Use:** Direct API integration, simpler pricing models
- **Key Files:**
  - Service: `/shared_components/js/[method]-pricing-service.js`
  - Calculator: `/shared_components/js/[method]-pricing-v2.js`
- **Data Flow:** API → Service → Calculator → UI
- **Advantages:** Simpler architecture, direct control

## Master Bundle Data Structure {#master-bundle-data-structure}

All pricing calculators receive a "master bundle" containing comprehensive pricing data:

```javascript
{
    styleNumber: "PC61",
    embellishmentType: "dtg|screenprint|dtf|embroidery",

    // Tier definitions
    tierData: {
        "24-47": {
            TierLabel: "24-47",
            MinQuantity: 24,
            MaxQuantity: 47,
            MarginDenominator: 0.6,  // Critical for price calculation
            LTM_Fee: 50.00            // Less Than Minimum fee
        },
        "48-71": { /* ... */ },
        "72+": { /* ... */ }
    },

    // Size information with base costs
    sizes: [
        { size: "S", price: 5.50, sortOrder: 1 },
        { size: "M", price: 5.50, sortOrder: 2 },
        { size: "L", price: 5.50, sortOrder: 3 },
        { size: "XL", price: 5.50, sortOrder: 4 },
        { size: "2XL", price: 7.50, sortOrder: 5 }  // Upcharge sizes
    ],

    // Size upcharges for display pricing
    sellingPriceDisplayAddOns: {
        "S": 0, "M": 0, "L": 0, "XL": 0,
        "2XL": 2.00, "3XL": 3.00, "4XL": 4.00
    },

    // Method-specific pricing data
    // DTG Example:
    locations: [
        { code: "LC", name: "Left Chest" },
        { code: "FF", name: "Full Front" },
        { code: "FB", name: "Full Back" }
    ],

    // Screen Print Example:
    primaryLocationPricing: {
        "1": { tiers: [/* tier pricing by color count */] },
        "2": { tiers: [/* ... */] }
    },

    // Embroidery Example:
    stitchCounts: [
        { label: "Up to 5K", min: 0, max: 5000, cost: 3.50 },
        { label: "5K-10K", min: 5001, max: 10000, cost: 4.50 }
    ]
}
```

## Pricing Calculation Logic {#pricing-calculation-logic}

### Core Formula
```javascript
// Step 1: Get base garment cost (lowest size price)
const baseGarmentCost = Math.min(...sizes.map(s => s.price));

// Step 2: Apply margin based on quantity tier
const tier = getTierForQuantity(quantity);
const markedUpGarment = baseGarmentCost / tier.MarginDenominator;

// Step 3: Add decoration cost (method-specific)
const decorationCost = getDecorationCost(method, options);
const basePrice = markedUpGarment + decorationCost;

// Step 4: Round to pricing rules (usually half-dollar ceiling)
const roundedPrice = Math.ceil(basePrice * 2) / 2;

// Step 5: Apply size upcharges
const finalPrice = roundedPrice + (upcharges[size] || 0);

// Step 6: Check for LTM (Less Than Minimum)
if (quantity < 24) {
    const ltmFee = 50.00;  // Flat fee for small orders
    // Apply LTM fee to total order, not per piece
}
```

### Tier Selection Logic
```javascript
function getTierForQuantity(quantity, tiers) {
    // Special handling for quantities under minimum
    if (quantity < 24) {
        // Use 24-47 tier pricing but will add LTM fee
        return tiers.find(t => t.TierLabel === '24-47') || tiers[0];
    }

    // Find matching tier
    return tiers.find(t =>
        quantity >= t.MinQuantity &&
        quantity <= t.MaxQuantity
    );
}
```

## HTML Template {#html-template}

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>[METHOD] Pricing | Northwest Custom Apparel</title>

    <!-- Universal Pricing CSS - Load FIRST for theming -->
    <link rel="stylesheet" href="/shared_components/css/universal-pricing-header.css">
    <link rel="stylesheet" href="/shared_components/css/universal-pricing-layout.css">
    <link rel="stylesheet" href="/shared_components/css/universal-calculator-theme.css">
    <link rel="stylesheet" href="/shared_components/css/universal-pricing-components.css">

    <!-- Shared CSS -->
    <link rel="stylesheet" href="/shared_components/css/shared-pricing-styles.css">
    <link rel="stylesheet" href="/shared_components/css/modern-enhancements.css">
    <link rel="stylesheet" href="/shared_components/css/universal-header.css">
    <link rel="stylesheet" href="/shared_components/css/universal-product-display.css">
    <link rel="stylesheet" href="/shared_components/css/universal-image-gallery.css">
    <link rel="stylesheet" href="/shared_components/css/universal-quick-quote.css">
    <link rel="stylesheet" href="/shared_components/css/universal-pricing-grid.css">

    <!-- Method-Specific CSS -->
    <link rel="stylesheet" href="/shared_components/css/[method]-specific.css">

    <!-- Font Awesome for icons -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">

    <style>
        /* Enhanced Header Styles */
        body.[method]-pricing-page {
            padding-top: 180px;
        }

        .enhanced-pricing-header {
            background: white;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            z-index: 1000;
        }

        .header-contact-bar {
            background: #2d5f3f;
            color: white;
            padding: 10px 0;
            font-size: 14px;
        }

        /* Additional styles from templates... */
    </style>
</head>
<body class="[method]-pricing-page">
    <!-- Enhanced Pricing Header -->
    <header class="enhanced-pricing-header">
        <!-- Contact Bar -->
        <div class="header-contact-bar">
            <div class="contact-bar-content">
                <div class="contact-info">
                    <div class="contact-item">
                        <i class="fas fa-phone"></i>
                        <span>(253) 922-5793</span>
                    </div>
                    <div class="contact-item">
                        <i class="fas fa-envelope"></i>
                        <span>sales@nwcustomapparel.com</span>
                    </div>
                </div>
                <div class="business-hours">
                    <i class="fas fa-clock"></i>
                    Monday - Friday: 8:30 AM - 5:00 PM PST
                </div>
            </div>
        </div>

        <!-- Main Navigation -->
        <div class="header-nav">
            <div class="nav-content">
                <div class="logo-section">
                    <a href="/" class="logo-link">
                        <img src="https://cdn.caspio.com/A0E15000/Safety%20Stripes/web%20northwest%20custom%20apparel%20logo.png?ver=1"
                             alt="Northwest Custom Apparel"
                             class="logo-image">
                    </a>
                </div>
            </div>
        </div>

        <!-- Pricing Context Bar -->
        <div class="pricing-context-bar">
            <div class="context-bar-content">
                <div class="breadcrumb">
                    <span>[METHOD] Pricing Calculator</span>
                </div>

                <!-- Live Pricing Display -->
                <div class="header-live-pricing">
                    <div class="header-price-item">
                        <span class="header-price-label">Qty:</span>
                        <span id="header-quantity" class="header-price-value">24</span>
                    </div>
                    <div class="header-price-item">
                        <span class="header-price-label">Per Item:</span>
                        <span id="header-unit-price" class="header-price-value highlight">$0.00</span>
                    </div>
                </div>
            </div>
        </div>
    </header>

    <!-- Main Container -->
    <div class="container">
        <div class="product-page-columns-container">
            <!-- Left Column: Product Display -->
            <div class="product-context-column">
                <div id="product-display"></div>
            </div>

            <!-- Right Column: Pricing Calculator -->
            <div class="product-interactive-column">
                <div id="[method]-calculator-container">
                    <!-- Calculator UI inserted by JavaScript -->
                </div>
            </div>
        </div>
    </div>

    <!-- Core Scripts -->
    <script src="/shared_components/js/utils.js"></script>
    <script src="/shared_components/js/pricing-matrix-api.js"></script>

    <!-- Universal Components -->
    <script src="/shared_components/js/universal-product-display.js"></script>
    <script src="/shared_components/js/universal-image-gallery.js"></script>

    <!-- Method-Specific Scripts -->
    <script src="/shared_components/js/[method]-pricing-service.js"></script>
    <script src="/shared_components/js/[method]-adapter.js"></script>
    <script src="/shared_components/js/[method]-calculator.js"></script>

    <!-- Initialization -->
    <script>
        document.addEventListener('DOMContentLoaded', function() {
            // Initialize product display
            const productDisplay = new UniversalProductDisplay({
                containerId: 'product-display',
                pageType: '[method]',
                showBackButton: true,
                showInfoBox: true,
                infoBoxContent: '[Method-specific information]'
            });

            // Initialize calculator
            const calculator = new [METHOD]Calculator();

            // API Testing utilities
            window.[METHOD]_API_TEST = {
                testAPI: async function(styleNumber = 'PC61') {
                    const service = new [METHOD]PricingService();
                    const data = await service.fetchPricingData(styleNumber);
                    console.log('API Response:', data);
                    return data;
                },
                clearCache: function() {
                    if (calculator?.pricingService) {
                        calculator.pricingService.clearCache();
                        console.log('Cache cleared');
                    }
                }
            };
        });
    </script>
</body>
</html>
```

## Adapter Pattern Template {#adapter-pattern-template}

```javascript
/**
 * [METHOD] Adapter - Extends BaseAdapter
 * Handles master bundle data and pricing calculations
 */
class [METHOD]Adapter extends BaseAdapter {
    constructor() {
        super();
        this.embellishmentType = '[method]';
        this.pricingData = null;
        this.locations = [
            // Define available decoration locations
            { code: 'LC', name: 'Left Chest' },
            { code: 'FF', name: 'Full Front' }
        ];

        console.log('[METHOD]Adapter initialized');
        this.init();
    }

    init() {
        // Set up event listeners
        this.setupEventListeners();

        // Check for URL parameters
        this.checkUrlParams();
    }

    setupEventListeners() {
        // Listen for pricing data from Caspio
        window.addEventListener('message', (e) => {
            if (e.data && e.data.type === '[method]PricingData') {
                this.handlePricingData(e.data);
            }
        });

        // Listen for calculator requests
        document.addEventListener('[method]RequestPricing', (e) => {
            this.providePricing(e.detail);
        });
    }

    handlePricingData(data) {
        console.log('[METHOD]Adapter: Received pricing data', data);

        // Store the master bundle
        this.pricingData = data;

        // Extract and process data
        const processed = this.processPricingData(data);

        // Dispatch event for UI components
        this.dispatchPricingUpdate(processed);
    }

    processPricingData(data) {
        const { tierData, sizes, sellingPriceDisplayAddOns } = data;

        // Calculate prices for all combinations
        const pricing = {};

        Object.keys(tierData).forEach(tierLabel => {
            const tier = tierData[tierLabel];
            pricing[tierLabel] = this.calculateTierPricing(
                tier,
                sizes,
                sellingPriceDisplayAddOns
            );
        });

        return {
            styleNumber: data.styleNumber,
            pricing: pricing,
            locations: this.locations,
            sizes: sizes.map(s => s.size),
            tiers: tierData
        };
    }

    calculateTierPricing(tier, sizes, upcharges) {
        // Find base garment cost
        const baseCost = Math.min(...sizes.map(s => parseFloat(s.price)));

        // Apply margin
        const markedUpPrice = baseCost / tier.MarginDenominator;

        // Add decoration cost (method-specific)
        const decorationCost = this.getDecorationCost(tier);

        // Calculate base price
        const basePrice = markedUpPrice + decorationCost;

        // Round to half dollar
        const roundedPrice = Math.ceil(basePrice * 2) / 2;

        // Build size-specific prices
        const sizesPricing = {};
        sizes.forEach(sizeInfo => {
            const upcharge = upcharges[sizeInfo.size] || 0;
            sizesPricing[sizeInfo.size] = roundedPrice + upcharge;
        });

        return sizesPricing;
    }

    getDecorationCost(tier) {
        // Override in specific implementations
        // Example: return fixed cost or calculate based on options
        return 5.00; // Default decoration cost
    }

    dispatchPricingUpdate(data) {
        const event = new CustomEvent('[method]PricingUpdated', {
            detail: data,
            bubbles: true
        });
        document.dispatchEvent(event);
    }

    // Helper method to get current pricing
    getCurrentPricing(quantity, location, size = 'M') {
        if (!this.pricingData) return null;

        const tier = this.getTierForQuantity(quantity);
        if (!tier) return null;

        return this.pricingData.pricing[tier.TierLabel]?.[size] || 0;
    }

    getTierForQuantity(quantity) {
        if (!this.pricingData?.tierData) return null;

        // Handle LTM quantities
        if (quantity < 24) {
            return this.pricingData.tierData['24-47'];
        }

        // Find matching tier
        for (const tierLabel in this.pricingData.tierData) {
            const tier = this.pricingData.tierData[tierLabel];
            if (quantity >= tier.MinQuantity && quantity <= tier.MaxQuantity) {
                return tier;
            }
        }

        return null;
    }

    // Check URL parameters on load
    async checkUrlParams() {
        const params = new URLSearchParams(window.location.search);
        const styleNumber = params.get('styleNumber');

        if (styleNumber) {
            // Fetch pricing data from API
            await this.fetchPricingData(styleNumber);
        }
    }

    async fetchPricingData(styleNumber) {
        try {
            const service = new [METHOD]PricingService();
            const data = await service.fetchPricingData(styleNumber);
            this.handlePricingData(data);
        } catch (error) {
            console.error('[METHOD]Adapter: Error fetching pricing data', error);
        }
    }
}

// Initialize adapter when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.[method]Adapter = new [METHOD]Adapter();
});
```

## Service Pattern Template {#service-pattern-template}

```javascript
/**
 * [METHOD] Pricing Service
 * Direct API implementation for pricing calculations
 */
class [METHOD]PricingService {
    constructor() {
        this.baseURL = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
        this.cachePrefix = '[method]PricingData';
        this.cacheDuration = 5 * 60 * 1000; // 5 minutes
        this.cache = new Map();

        console.log('[METHOD]PricingService initialized');
    }

    /**
     * Fetch pricing data from API
     * @param {string} styleNumber - Product style number
     * @param {Object} options - Additional options
     * @returns {Object} Pricing data bundle
     */
    async fetchPricingData(styleNumber, options = {}) {
        console.log(`[METHOD]PricingService: Fetching data for ${styleNumber}`);

        // Check cache first
        const cacheKey = `${this.cachePrefix}-${styleNumber}`;
        if (!options.forceRefresh && this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheDuration) {
                console.log('[METHOD]PricingService: Returning cached data');
                return cached.data;
            }
        }

        try {
            // Fetch from bundle endpoint
            const url = `${this.baseURL}/api/pricing-bundle?method=[METHOD]&styleNumber=${styleNumber}`;
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`API request failed: ${response.status}`);
            }

            const data = await response.json();
            console.log('[METHOD]PricingService: Data received', data);

            // Process and calculate pricing
            const processed = this.processPricingData(data);

            // Cache the result
            this.cache.set(cacheKey, {
                data: processed,
                timestamp: Date.now()
            });

            return processed;

        } catch (error) {
            console.error('[METHOD]PricingService: Error fetching data', error);
            throw error;
        }
    }

    /**
     * Process raw API data into usable format
     */
    processPricingData(apiData) {
        const { tiers, sizes, sellingPriceDisplayAddOns } = apiData;

        // Build pricing structure
        const pricing = this.calculateAllPricing(
            tiers,
            sizes,
            sellingPriceDisplayAddOns
        );

        return {
            styleNumber: apiData.styleNumber,
            tierData: this.buildTierData(tiers),
            sizes: sizes,
            upcharges: sellingPriceDisplayAddOns,
            pricing: pricing,
            // Method-specific data
            options: apiData.options || {},
            metadata: {
                timestamp: new Date().toISOString(),
                source: 'API'
            }
        };
    }

    /**
     * Calculate all pricing combinations
     */
    calculateAllPricing(tiers, sizes, upcharges) {
        const pricing = {};

        tiers.forEach(tier => {
            pricing[tier.TierLabel] = this.calculateTierPricing(
                tier,
                sizes,
                upcharges
            );
        });

        return pricing;
    }

    /**
     * Calculate pricing for a specific tier
     */
    calculateTierPricing(tier, sizes, upcharges) {
        // Get base garment cost (lowest size price)
        const baseCost = Math.min(
            ...sizes.map(s => parseFloat(s.price)).filter(p => p > 0)
        );

        // Apply margin denominator
        const markedUpGarment = baseCost / tier.MarginDenominator;

        // Add decoration cost (method-specific)
        const decorationCost = this.getDecorationCost(tier);
        const basePrice = markedUpGarment + decorationCost;

        // Round to half dollar
        const roundedBase = Math.ceil(basePrice * 2) / 2;

        // Calculate per-size pricing
        const sizePricing = {};
        sizes.forEach(sizeInfo => {
            const upcharge = parseFloat(upcharges[sizeInfo.size] || 0);
            sizePricing[sizeInfo.size] = roundedBase + upcharge;
        });

        return sizePricing;
    }

    /**
     * Get decoration cost for method
     * Override this in specific implementations
     */
    getDecorationCost(tier) {
        // Default implementation - override as needed
        return 0;
    }

    /**
     * Build tier data structure
     */
    buildTierData(tiers) {
        const tierData = {};

        tiers.forEach(tier => {
            tierData[tier.TierLabel] = {
                TierLabel: tier.TierLabel,
                MinQuantity: tier.MinQuantity,
                MaxQuantity: tier.MaxQuantity,
                MarginDenominator: tier.MarginDenominator,
                LTM_Fee: tier.LTM_Fee || 0
            };
        });

        return tierData;
    }

    /**
     * Get pricing for specific quantity
     */
    getPriceForQuantity(pricingData, quantity, size = 'M', options = {}) {
        // Find appropriate tier
        const tier = this.getTierForQuantity(pricingData.tierData, quantity);
        if (!tier) return null;

        // Get base price
        let price = pricingData.pricing[tier.TierLabel]?.[size] || 0;

        // Apply LTM fee if under minimum
        if (quantity < 24) {
            // LTM is typically added to total, not per piece
            // Return both values
            return {
                unitPrice: price,
                ltmFee: tier.LTM_Fee || 50,
                total: (price * quantity) + (tier.LTM_Fee || 50)
            };
        }

        return {
            unitPrice: price,
            ltmFee: 0,
            total: price * quantity
        };
    }

    /**
     * Find tier for quantity
     */
    getTierForQuantity(tierData, quantity) {
        // Handle under-minimum quantities
        if (quantity < 24) {
            return tierData['24-47'] || Object.values(tierData)[0];
        }

        // Find matching tier
        for (const tierLabel in tierData) {
            const tier = tierData[tierLabel];
            if (quantity >= tier.MinQuantity &&
                (!tier.MaxQuantity || quantity <= tier.MaxQuantity)) {
                return tier;
            }
        }

        return null;
    }

    /**
     * Clear cache
     */
    clearCache() {
        this.cache.clear();
        console.log('[METHOD]PricingService: Cache cleared');
    }

    /**
     * Get service status
     */
    getStatus() {
        return {
            service: '[METHOD]PricingService',
            apiEndpoint: `${this.baseURL}/api/pricing-bundle`,
            cacheSize: this.cache.size,
            cacheDuration: this.cacheDuration
        };
    }
}

// Make service globally available
window.[METHOD]PricingService = [METHOD]PricingService;
```

## API Integration {#api-integration}

### Bundle Endpoint Pattern
All pricing calculators use the bundle endpoint for efficient data fetching:

```javascript
// API endpoint format
GET /api/pricing-bundle?method=[METHOD]&styleNumber=[STYLE]

// Response format
{
    "styleNumber": "PC61",
    "method": "dtg",
    "tiers": [...],
    "sizes": [...],
    "sellingPriceDisplayAddOns": {...},
    // Method-specific data
    "locations": [...],      // DTG
    "stitchCounts": [...],   // Embroidery
    "colorCounts": [...]     // Screen Print
}
```

### Caching Strategy
```javascript
// Session storage for quick access
sessionStorage.setItem(cacheKey, JSON.stringify({
    timestamp: Date.now(),
    data: pricingData
}));

// Memory cache for service pattern
this.cache = new Map();
this.cache.set(cacheKey, {
    data: processed,
    timestamp: Date.now()
});
```

## Testing & Debugging {#testing-debugging}

### Console Testing Utilities
```javascript
// Add to every calculator for easy testing
window.[METHOD]_API_TEST = {
    // Test API endpoint
    testAPI: async function(styleNumber = 'PC61') {
        console.log('🧪 Testing [METHOD] API for:', styleNumber);
        const service = new [METHOD]PricingService();
        const data = await service.fetchPricingData(styleNumber);
        console.log('✅ API Response:', data);
        return data;
    },

    // Compare pricing calculations
    testCalculation: function(qty = 48, size = 'M') {
        const calculator = window.[method]Calculator;
        if (!calculator) {
            console.error('Calculator not initialized');
            return;
        }

        const pricing = calculator.calculatePricing(qty, size);
        console.log(`📊 Price for ${qty} ${size}:`, pricing);
        return pricing;
    },

    // Check service status
    checkStatus: function() {
        const service = new [METHOD]PricingService();
        const status = service.getStatus();
        console.log('📊 Service Status:', status);
        return status;
    },

    // Clear cache
    clearCache: function() {
        const service = new [METHOD]PricingService();
        service.clearCache();
        console.log('🗑️ Cache cleared');
    },

    // Debug current state
    debug: function() {
        console.log('===== [METHOD] Calculator Debug =====');
        console.log('Style Number:', window.[method]Calculator?.styleNumber);
        console.log('Current Quantity:', window.[method]Calculator?.quantity);
        console.log('Pricing Data Loaded:', !!window.[method]Calculator?.pricingData);
        console.log('=====================================');
    }
};
```

### Performance Monitoring
```javascript
// Track load times
window.[METHOD]_PERFORMANCE = {
    startTime: performance.now(),
    metrics: {},

    track: function(event, data) {
        this.metrics[event] = {
            time: performance.now() - this.startTime,
            data: data
        };
        console.log(`⏱️ [${event}]: ${this.metrics[event].time.toFixed(2)}ms`);
    }
};

// Use in code
[METHOD]_PERFORMANCE.track('api_start');
const data = await fetch(url);
[METHOD]_PERFORMANCE.track('api_complete', data);
```

## Common Issues & Solutions {#common-issues}

### Issue 1: Pricing Not Loading
**Symptoms:** Calculator shows $0.00 or loading spinner forever
**Solutions:**
1. Check API endpoint is accessible
2. Verify styleNumber parameter is correct
3. Check browser console for errors
4. Clear cache and retry
5. Verify API response has required fields

### Issue 2: Wrong Tier Selected
**Symptoms:** Price jumps unexpectedly at certain quantities
**Solutions:**
1. Verify tier boundaries (MinQuantity, MaxQuantity)
2. Check LTM handling for quantities under 24
3. Ensure tier data is sorted correctly
4. Debug with: `getTierForQuantity(quantity)`

### Issue 3: Size Upcharges Not Applied
**Symptoms:** All sizes show same price
**Solutions:**
1. Check `sellingPriceDisplayAddOns` object
2. Verify size names match exactly (case-sensitive)
3. Ensure upcharge is added after rounding
4. Debug: `console.log(upcharges, size, upcharges[size])`

### Issue 4: Caspio Data Not Received (Adapter Pattern)
**Symptoms:** No pricing data despite Caspio form loading
**Solutions:**
1. Check iframe postMessage origin
2. Verify event listener is set up before Caspio loads
3. Check message format matches expected structure
4. Add debug logging to message handler

### Issue 5: Cache Not Updating
**Symptoms:** Old prices persist after changes
**Solutions:**
1. Clear session storage: `sessionStorage.clear()`
2. Force refresh: `fetchPricingData(style, {forceRefresh: true})`
3. Check cache TTL (should be 5 minutes)
4. Verify timestamp is being updated

### Issue 6: Calculator Not Initializing
**Symptoms:** Nothing happens when page loads
**Solutions:**
1. Check DOMContentLoaded listener
2. Verify script load order (service before calculator)
3. Check for JavaScript errors in console
4. Ensure container element exists in DOM

## Method-Specific Implementations

### DTG (Direct-to-Garment)
- **Pattern:** Adapter
- **Unique Features:** Multiple print locations, location combinations
- **Key Files:** dtg-adapter.js, dtg-pricing-service.js, dtg-pricing-v4-cleaned.js

### Screen Print
- **Pattern:** Service
- **Unique Features:** Color count pricing, setup fees per color
- **Key Files:** screenprint-pricing-service.js, screenprint-pricing-v2.js

### DTF (Direct-to-Film)
- **Pattern:** Adapter
- **Unique Features:** Transfer sizes, gang sheet options
- **Key Files:** dtf-adapter.js, dtf-calculator.js

### Embroidery
- **Pattern:** Service
- **Unique Features:** Stitch count tiers, thread color limits
- **Key Files:** embroidery-pricing-service.js

### Cap Embroidery
- **Pattern:** Service
- **Unique Features:** 3D puff options, structured vs unstructured
- **Key Files:** cap-embroidery-service.js

## Deployment Checklist

When creating a new pricing calculator:

- [ ] Choose pattern (Adapter or Service)
- [ ] Create HTML file in `/calculators/`
- [ ] Create service file in `/shared_components/js/`
- [ ] Create adapter file if using Adapter pattern
- [ ] Create calculator UI file
- [ ] Add method-specific CSS if needed
- [ ] Configure API bundle endpoint
- [ ] Add to ACTIVE_FILES.md
- [ ] Test all quantity tiers
- [ ] Test size upcharges
- [ ] Test LTM fee application
- [ ] Add console testing utilities
- [ ] Test on mobile devices
- [ ] Verify header live pricing updates

## Summary

Pricing calculators are simpler than quote builders but require careful attention to:
1. **Pricing Logic:** Margin denominators, tier selection, upcharges
2. **API Integration:** Efficient data fetching and caching
3. **User Experience:** Real-time updates, clear pricing display
4. **Testing:** Console utilities for debugging

Use this guide to create consistent, maintainable pricing calculators that integrate seamlessly with the existing system.

---

*Last updated: 2025-01-27 by Claude & Erik*