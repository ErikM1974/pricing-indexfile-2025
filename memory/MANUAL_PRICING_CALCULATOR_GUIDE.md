# Comprehensive Manual Pricing Calculator Development Guide

**Last Updated:** 2025-01-27
**Purpose:** Complete guide for creating all types of pricing calculators without reinventing the wheel

## Table of Contents
1. [Overview: Three Calculator Categories](#overview)
2. [Shared Architecture & Components](#shared-architecture)
3. [Manual Pricing Calculators](#manual-pricing)
4. [Contract/Corporate Calculators](#contract-corporate)
5. [Specialty Calculators](#specialty)
6. [Pricing Formula & Logic](#pricing-formula)
7. [HTML Template](#html-template)
8. [JavaScript Implementation](#javascript-implementation)
9. [Quote Service Pattern](#quote-service)
10. [Shared CSS System](#shared-css)
11. [Testing & Debugging](#testing-debugging)
12. [Quick Reference Matrix](#quick-reference)

## Overview: Three Calculator Categories {#overview}

### Category 1: Manual Pricing
**Purpose:** Allow sales staff to manually enter base costs and calculate margins
**Examples:** Manual DTG, Manual DTF, Manual Embroidery, Manual Cap Embroidery, Manual Screen Print, Manual Stickers, Manual Laser
**Key Feature:** Base cost input field that drives all calculations

### Category 2: Contract/Corporate Pricing
**Purpose:** Fixed pricing based on pre-negotiated contracts
**Examples:** Contract DTG, Contract Embroidery, Corporate Supplied Embroidery, Corporate Supplied Screen Print
**Key Feature:** No base cost input - uses fixed contract rates

### Category 3: Specialty Calculators
**Purpose:** Product-specific pricing with unique features
**Examples:** Laser Tumblers, Richardson Caps, Webstores, Embroidered Emblems
**Key Feature:** Fixed price tables, case quantities, special options

## Shared Architecture & Components {#shared-architecture}

All calculators share these core components:

```
/calculators/
├── manual-calculator-styles.css      # Shared CSS for all calculators
├── [method]-manual-pricing.html      # Manual pricing calculators
├── [method]-manual-service.js        # Quote service for database/email
├── [product]-calculator.js           # Calculator logic
└── /shared_components/
    ├── /css/
    │   ├── calculator-base.css       # Base styles
    │   └── calculator-modern-enhancements.css
    └── /js/
        ├── base-quote-service.js     # Base class for all quote services
        ├── calculator-utilities.js    # Shared utilities
        └── quote-formatter.js        # Quote formatting utilities
```

## Manual Pricing Calculators {#manual-pricing}

### Core Concept
Manual calculators require base cost input and calculate selling price using margin denominators.

### Key Components

#### 1. Base Cost Input Section
```html
<!-- Base Cost Input - The Heart of Manual Calculators -->
<div class="card" id="baseCostCard">
    <div class="card-header">
        <h2 class="card-title">
            <i class="fas fa-dollar-sign"></i> Base Cost Input
        </h2>
    </div>
    <div class="card-body">
        <div class="form-group highlight-base-cost">
            <div class="base-cost-arrow">
                <i class="fas fa-arrow-down"></i>
            </div>
            <label for="basePrice" class="form-label">
                Enter Base Garment Cost <span class="required">*</span>
            </label>
            <div class="input-group">
                <span class="input-group-text">$</span>
                <input type="number"
                       id="basePrice"
                       class="form-control base-cost-emphasis"
                       placeholder="0.00"
                       step="0.01"
                       min="0"
                       required>
            </div>
            <small class="form-text">
                Enter the actual cost of the garment from vendor
            </small>
        </div>
    </div>
</div>
```

#### 2. Manual Pricing Configuration
```javascript
const MANUAL_CONFIG = {
    // Method-specific settings
    method: 'DTG',
    methodName: 'Direct-to-Garment',

    // Quantity tiers with margin denominators
    tiers: [
        {
            label: '12-23',
            min: 12,
            max: 23,
            marginDenominator: 0.5,  // 100% markup
            ltmFee: 50.00
        },
        {
            label: '24-47',
            min: 24,
            max: 47,
            marginDenominator: 0.55, // ~82% markup
            ltmFee: 0
        },
        {
            label: '48-71',
            min: 48,
            max: 71,
            marginDenominator: 0.60, // ~67% markup
            ltmFee: 0
        },
        {
            label: '72+',
            min: 72,
            max: 9999,
            marginDenominator: 0.65, // ~54% markup
            ltmFee: 0
        }
    ],

    // Decoration costs by tier and location
    decorationCosts: {
        'LC': { // Left Chest
            '12-23': 6.00,
            '24-47': 5.50,
            '48-71': 5.00,
            '72+': 4.50
        },
        'FF': { // Full Front
            '12-23': 9.00,
            '24-47': 8.50,
            '48-71': 8.00,
            '72+': 7.50
        }
    },

    // Minimum thresholds
    ltmThreshold: 24,
    minimumOrder: 12
};
```

#### 3. Calculation Logic
```javascript
class ManualPricingCalculator {
    constructor(config) {
        this.config = config;
        this.state = {
            basePrice: 0,
            quantity: 24,
            selectedLocation: 'LC',
            selectedOptions: {}
        };
    }

    calculatePricing() {
        const { basePrice, quantity, selectedLocation } = this.state;

        // Step 1: Get tier for quantity
        const tier = this.getTierForQuantity(quantity);
        if (!tier) return null;

        // Step 2: Apply margin to base cost
        const garmentWithMargin = basePrice / tier.marginDenominator;

        // Step 3: Add decoration cost
        const decorationCost = this.getDecorationCost(tier.label, selectedLocation);

        // Step 4: Calculate subtotal
        const subtotal = garmentWithMargin + decorationCost;

        // Step 5: Apply LTM fee if under minimum
        let ltmFeePerUnit = 0;
        if (quantity < this.config.ltmThreshold && tier.ltmFee > 0) {
            ltmFeePerUnit = tier.ltmFee / quantity;
        }

        // Step 6: Calculate final price
        const unitPrice = subtotal + ltmFeePerUnit;
        const totalPrice = unitPrice * quantity;

        return {
            basePrice: basePrice,
            garmentWithMargin: garmentWithMargin,
            marginPercent: ((garmentWithMargin - basePrice) / basePrice * 100),
            decorationCost: decorationCost,
            subtotal: subtotal,
            ltmFeePerUnit: ltmFeePerUnit,
            ltmFeeTotal: ltmFeePerUnit * quantity,
            unitPrice: unitPrice,
            totalPrice: totalPrice,
            tier: tier.label,
            marginDenominator: tier.marginDenominator
        };
    }

    getTierForQuantity(quantity) {
        return this.config.tiers.find(tier =>
            quantity >= tier.min && quantity <= tier.max
        );
    }

    getDecorationCost(tierLabel, location) {
        return this.config.decorationCosts[location]?.[tierLabel] || 0;
    }
}
```

#### 4. Hero Display Section
```html
<!-- Pricing Display Hero -->
<div class="hero-section" id="heroSection">
    <div class="hero-summary">
        <span id="heroQuantity">24</span> items ×
        <span id="heroLocation">Left Chest</span> print
    </div>
    <div class="hero-prices">
        <div class="hero-price-container">
            <div class="hero-price-label">Per Item</div>
            <div class="hero-price" id="heroUnitPrice">
                <span class="placeholder">Enter base cost</span>
            </div>
            <div class="hero-price-sublabel" id="heroMargin"></div>
        </div>
        <div class="hero-price-container">
            <div class="hero-price-label">Total</div>
            <div class="hero-price" id="heroTotalPrice">
                <span class="placeholder">Enter base cost</span>
            </div>
            <div class="hero-price-sublabel" id="heroLtmNote"></div>
        </div>
    </div>
</div>
```

## Contract/Corporate Calculators {#contract-corporate}

### Core Concept
Contract calculators use fixed pricing from negotiated contracts - no base cost input needed.

### Contract Configuration
```javascript
const CONTRACT_CONFIG = {
    contractName: 'Corporate DTG Contract 2025',

    // Fixed pricing by tier - no margin calculation
    pricing: {
        'LC': { // Left Chest
            '24-47': 12.50,
            '48-71': 11.00,
            '72-143': 10.00,
            '144+': 9.00
        },
        'FF': { // Full Front
            '24-47': 15.00,
            '48-71': 13.50,
            '72-143': 12.50,
            '144+': 11.50
        }
    },

    // Contract-specific fees
    setupFee: 50.00,
    rushCharge: 1.25, // Multiplier for rush orders

    // No base cost input - prices are fixed
    requiresBaseCost: false
};
```

### Contract Calculator Implementation
```javascript
class ContractPricingCalculator {
    constructor(config) {
        this.config = config;
        this.state = {
            quantity: 48,
            selectedLocation: 'LC',
            rushOrder: false
        };
    }

    calculatePricing() {
        const { quantity, selectedLocation, rushOrder } = this.state;

        // Get tier for quantity
        const tierKey = this.getTierKey(quantity);

        // Get fixed price from contract
        let unitPrice = this.config.pricing[selectedLocation][tierKey];

        // Apply rush charge if needed
        if (rushOrder) {
            unitPrice = unitPrice * this.config.rushCharge;
        }

        // Calculate totals
        const subtotal = unitPrice * quantity;
        const setupFee = quantity < 48 ? this.config.setupFee : 0;
        const totalPrice = subtotal + setupFee;

        return {
            contractName: this.config.contractName,
            unitPrice: unitPrice,
            quantity: quantity,
            subtotal: subtotal,
            setupFee: setupFee,
            totalPrice: totalPrice,
            rushOrder: rushOrder,
            tierKey: tierKey
        };
    }

    getTierKey(quantity) {
        if (quantity < 24) return null; // Below minimum
        if (quantity <= 47) return '24-47';
        if (quantity <= 71) return '48-71';
        if (quantity <= 143) return '72-143';
        return '144+';
    }
}
```

## Specialty Calculators {#specialty}

### Core Concept
Specialty calculators handle unique products with specific pricing structures.

### Example: Laser Tumbler Calculator
```javascript
const LASER_TUMBLER_CONFIG = {
    productName: 'Polar Camel 16 oz. Pint',

    // Fixed pricing by case quantity
    pricing: [
        {
            quantity: 24,
            cases: 1,
            unitPrice: 16.68,
            description: '1 Case'
        },
        {
            quantity: 120,
            cases: 5,
            unitPrice: 16.10,
            description: '5 Cases',
            highlight: true // Best value
        },
        {
            quantity: 240,
            cases: 10,
            unitPrice: 15.53,
            description: '10 Cases'
        }
    ],

    // Additional options
    setupFee: 75.00,
    secondLogoPrice: 3.16,

    // Product features
    features: [
        { icon: '🔥', text: 'Keeps Hot 8+ Hours' },
        { icon: '❄️', text: 'Keeps Cold 24+ Hours' }
    ]
};
```

### Example: Richardson Caps Calculator
```javascript
const RICHARDSON_CAPS_CONFIG = {
    // Multiple cap styles available
    styles: [
        {
            styleNumber: '112',
            name: 'Richardson 112 - Trucker',
            basePrice: 8.50,
            features: ['Mid-Profile', 'Pre-Curved', 'Snapback']
        },
        {
            styleNumber: '115',
            name: 'Richardson 115 - Low Profile',
            basePrice: 7.75,
            features: ['Low-Profile', 'Pre-Curved', 'Snapback']
        }
    ],

    // Embroidery pricing
    embroideryPricing: {
        '5000': 3.50,    // Up to 5K stitches
        '10000': 4.50,   // 5K-10K stitches
        '15000': 5.50    // 10K-15K stitches
    },

    // Leatherette patch option
    patchPricing: {
        '2x2': 4.00,
        '2x3': 4.50,
        '3x3': 5.00
    },

    // Quantity discounts
    quantityDiscounts: [
        { min: 24, max: 47, discount: 0 },
        { min: 48, max: 143, discount: 0.05 },
        { min: 144, max: 999, discount: 0.10 }
    ]
};
```

## Pricing Formula & Logic {#pricing-formula}

### Manual Pricing Formula
```javascript
// Core manual pricing formula
function calculateManualPrice(baseCost, quantity, location) {
    // 1. Get tier configuration
    const tier = getTierForQuantity(quantity);

    // 2. Apply margin
    const garmentWithMargin = baseCost / tier.marginDenominator;

    // 3. Add decoration cost
    const decorationCost = getDecorationCost(tier, location);

    // 4. Calculate subtotal
    const subtotal = garmentWithMargin + decorationCost;

    // 5. Apply LTM fee if needed
    let ltmFeePerUnit = 0;
    if (quantity < LTM_THRESHOLD) {
        ltmFeePerUnit = LTM_FEE / quantity;
    }

    // 6. Final price
    return subtotal + ltmFeePerUnit;
}
```

### Margin Denominator Explanation
```javascript
// Margin denominators determine markup percentage
// Formula: sellingPrice = cost / marginDenominator

// Examples:
// 0.50 = 100% markup (cost $10 → sell $20)
// 0.55 = ~82% markup (cost $10 → sell $18.18)
// 0.60 = ~67% markup (cost $10 → sell $16.67)
// 0.65 = ~54% markup (cost $10 → sell $15.38)
// 0.70 = ~43% markup (cost $10 → sell $14.29)

function calculateMarkupPercentage(marginDenominator) {
    return ((1 / marginDenominator) - 1) * 100;
}
```

## HTML Template {#html-template}

### Complete Manual Pricing Calculator Template
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Manual [METHOD] Pricing - Northwest Custom Apparel</title>

    <!-- Shared Styles -->
    <link href="manual-calculator-styles.css" rel="stylesheet">

    <!-- Font Awesome -->
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">

    <!-- EmailJS -->
    <script src="https://cdn.jsdelivr.net/npm/@emailjs/browser@3/dist/email.min.js"></script>

    <!-- Quote Service -->
    <script src="[method]-manual-service.js"></script>

    <style>
        /* Method-specific styles if needed */
    </style>
</head>
<body>
    <!-- Header -->
    <header class="header">
        <div class="header-container">
            <div class="header-left">
                <img src="[logo-url]" alt="NWCA" class="logo">
                <nav class="breadcrumb">
                    <a href="/staff-dashboard.html">Dashboard</a>
                    <span>/</span>
                    <span>Manual [METHOD] Pricing</span>
                </nav>
            </div>
        </div>
    </header>

    <!-- Main Container -->
    <main class="main-container">
        <!-- Page Title -->
        <h1 class="page-title">Manual [METHOD] Pricing Calculator</h1>
        <p class="page-subtitle">Enter base cost to calculate pricing with margins</p>

        <!-- Hero Pricing Display -->
        <div class="hero-section placeholder-mode" id="heroSection">
            <div class="hero-summary">
                <span id="heroQuantity">24</span> items
            </div>
            <div class="hero-prices">
                <div class="hero-price-container">
                    <div class="hero-price-label">Per Item</div>
                    <div class="hero-price placeholder" id="heroUnitPrice">
                        Enter base cost
                    </div>
                </div>
                <div class="hero-price-container">
                    <div class="hero-price-label">Total</div>
                    <div class="hero-price placeholder" id="heroTotalPrice">
                        Enter base cost
                    </div>
                </div>
            </div>
        </div>

        <!-- Calculator Grid -->
        <div class="calculator-grid">
            <!-- Left Column: Inputs -->
            <div>
                <!-- Base Cost Card -->
                <div class="card">
                    <div class="card-header">
                        <h2 class="card-title">
                            <i class="fas fa-dollar-sign"></i> Base Cost
                        </h2>
                    </div>
                    <div class="form-group">
                        <label for="basePrice" class="form-label">
                            Base Garment Cost <span class="required">*</span>
                        </label>
                        <div class="input-group">
                            <span class="input-group-text">$</span>
                            <input type="number"
                                   id="basePrice"
                                   class="form-control"
                                   step="0.01"
                                   min="0"
                                   placeholder="0.00"
                                   onchange="calculator.updateBasePrice(this.value)">
                        </div>
                    </div>
                </div>

                <!-- Options Card -->
                <div class="card">
                    <div class="card-header">
                        <h2 class="card-title">
                            <i class="fas fa-cogs"></i> Options
                        </h2>
                    </div>

                    <!-- Quantity -->
                    <div class="form-group">
                        <label for="quantity" class="form-label">Quantity</label>
                        <input type="number"
                               id="quantity"
                               class="form-control"
                               value="24"
                               min="12"
                               onchange="calculator.updateQuantity(this.value)">
                    </div>

                    <!-- Location Selection (if applicable) -->
                    <div class="form-group">
                        <label class="form-label">Print Location</label>
                        <div class="location-cards">
                            <div class="location-card active"
                                 data-location="LC"
                                 onclick="calculator.selectLocation('LC')">
                                <div class="location-icon">👔</div>
                                <div class="location-name">Left Chest</div>
                            </div>
                            <div class="location-card"
                                 data-location="FF"
                                 onclick="calculator.selectLocation('FF')">
                                <div class="location-icon">👕</div>
                                <div class="location-name">Full Front</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Right Column: Results -->
            <div>
                <!-- Pricing Breakdown Card -->
                <div class="card">
                    <div class="card-header">
                        <h2 class="card-title">
                            <i class="fas fa-calculator"></i> Pricing Breakdown
                        </h2>
                    </div>

                    <div id="pricingResults">
                        <!-- Placeholder when no base cost -->
                        <div class="pricing-placeholder">
                            <i class="fas fa-arrow-left"></i>
                            <h3>Enter Base Cost to Calculate</h3>
                            <p>Input the garment cost to see pricing</p>
                        </div>
                    </div>

                    <!-- Results template (hidden initially) -->
                    <div id="pricingBreakdown" style="display: none;">
                        <table class="breakdown-table">
                            <tbody>
                                <tr>
                                    <td>Base Cost:</td>
                                    <td class="text-right">
                                        $<span id="breakdownBase">0.00</span>
                                    </td>
                                </tr>
                                <tr class="highlight">
                                    <td>With Margin (<span id="marginPercent">0</span>%):</td>
                                    <td class="text-right">
                                        $<span id="breakdownMargin">0.00</span>
                                    </td>
                                </tr>
                                <tr>
                                    <td>Decoration Cost:</td>
                                    <td class="text-right">
                                        $<span id="breakdownDecoration">0.00</span>
                                    </td>
                                </tr>
                                <tr id="ltmRow" style="display: none;">
                                    <td>LTM Fee:</td>
                                    <td class="text-right">
                                        $<span id="breakdownLTM">0.00</span>
                                    </td>
                                </tr>
                                <tr class="total-row">
                                    <td><strong>Unit Price:</strong></td>
                                    <td class="text-right">
                                        <strong>$<span id="breakdownUnit">0.00</span></strong>
                                    </td>
                                </tr>
                                <tr class="total-row">
                                    <td><strong>Total (<span id="breakdownQty">24</span>):</strong></td>
                                    <td class="text-right">
                                        <strong>$<span id="breakdownTotal">0.00</span></strong>
                                    </td>
                                </tr>
                            </tbody>
                        </table>

                        <!-- Action Buttons -->
                        <div class="button-group">
                            <button class="btn btn-primary" onclick="calculator.generateQuote()">
                                <i class="fas fa-file-invoice"></i> Generate Quote
                            </button>
                            <button class="btn btn-secondary" onclick="calculator.reset()">
                                <i class="fas fa-redo"></i> Reset
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Quote Info (shown after generation) -->
                <div class="card" id="quoteCard" style="display: none;">
                    <div class="success-message">
                        <i class="fas fa-check-circle"></i>
                        <div>
                            <strong>Quote Generated!</strong><br>
                            Quote ID: <span id="quoteId"></span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </main>

    <script>
        // Initialize calculator
        const calculator = new ManualPricingCalculator(MANUAL_CONFIG);
        calculator.init();
    </script>
</body>
</html>
```

## JavaScript Implementation {#javascript-implementation}

### Complete Manual Calculator Class
```javascript
class ManualPricingCalculator {
    constructor(config) {
        this.config = config;
        this.quoteService = new ManualQuoteService();

        this.state = {
            basePrice: 0,
            quantity: 24,
            selectedLocation: 'LC',
            currentPricing: null
        };

        this.init();
    }

    init() {
        // Set initial values
        document.getElementById('quantity').value = this.state.quantity;

        // Add input listeners
        this.attachEventListeners();

        // Focus on base price input
        document.getElementById('basePrice')?.focus();
    }

    attachEventListeners() {
        // Base price input with debounce
        let basePriceTimeout;
        document.getElementById('basePrice')?.addEventListener('input', (e) => {
            clearTimeout(basePriceTimeout);
            basePriceTimeout = setTimeout(() => {
                this.updateBasePrice(e.target.value);
            }, 500);
        });

        // Quantity change
        document.getElementById('quantity')?.addEventListener('change', (e) => {
            this.updateQuantity(e.target.value);
        });

        // Print functionality
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
                e.preventDefault();
                this.printQuote();
            }
        });
    }

    updateBasePrice(value) {
        this.state.basePrice = parseFloat(value) || 0;

        if (this.state.basePrice > 0) {
            // Remove placeholder mode
            document.getElementById('heroSection')?.classList.remove('placeholder-mode');
            document.getElementById('baseCostCard')?.classList.remove('highlight-base-cost');

            // Calculate and display pricing
            this.calculateAndDisplay();
        } else {
            // Show placeholder
            this.showPlaceholder();
        }
    }

    updateQuantity(value) {
        const quantity = parseInt(value) || this.config.minimumOrder;

        // Enforce minimum
        if (quantity < this.config.minimumOrder) {
            document.getElementById('quantity').value = this.config.minimumOrder;
            this.state.quantity = this.config.minimumOrder;
        } else {
            this.state.quantity = quantity;
        }

        // Update display
        document.getElementById('heroQuantity').textContent = this.state.quantity;

        // Recalculate if we have base price
        if (this.state.basePrice > 0) {
            this.calculateAndDisplay();
        }
    }

    selectLocation(locationCode) {
        // Update UI
        document.querySelectorAll('.location-card').forEach(card => {
            card.classList.remove('active');
        });
        document.querySelector(`[data-location="${locationCode}"]`)?.classList.add('active');

        // Update state
        this.state.selectedLocation = locationCode;

        // Update hero display
        const locationName = this.getLocationName(locationCode);
        document.getElementById('heroLocation').textContent = locationName;

        // Recalculate
        if (this.state.basePrice > 0) {
            this.calculateAndDisplay();
        }
    }

    calculateAndDisplay() {
        const pricing = this.calculatePricing();
        if (!pricing) return;

        this.state.currentPricing = pricing;

        // Update hero section
        this.updateHeroDisplay(pricing);

        // Update breakdown
        this.updateBreakdown(pricing);
    }

    updateHeroDisplay(pricing) {
        // Update unit price
        const unitPriceEl = document.getElementById('heroUnitPrice');
        unitPriceEl.innerHTML = `$${pricing.unitPrice.toFixed(2)}`;

        // Update total price
        const totalPriceEl = document.getElementById('heroTotalPrice');
        totalPriceEl.innerHTML = `$${pricing.totalPrice.toFixed(2)}`;

        // Show margin info
        document.getElementById('heroMargin').textContent =
            `${pricing.marginPercent.toFixed(0)}% margin`;

        // Show LTM note if applicable
        if (pricing.ltmFeeTotal > 0) {
            document.getElementById('heroLtmNote').textContent =
                `Includes $${pricing.ltmFeeTotal.toFixed(2)} LTM fee`;
        } else {
            document.getElementById('heroLtmNote').textContent = '';
        }
    }

    updateBreakdown(pricing) {
        // Hide placeholder
        document.querySelector('.pricing-placeholder').style.display = 'none';

        // Show breakdown
        document.getElementById('pricingBreakdown').style.display = 'block';

        // Update values
        document.getElementById('breakdownBase').textContent =
            pricing.basePrice.toFixed(2);
        document.getElementById('breakdownMargin').textContent =
            pricing.garmentWithMargin.toFixed(2);
        document.getElementById('marginPercent').textContent =
            pricing.marginPercent.toFixed(0);
        document.getElementById('breakdownDecoration').textContent =
            pricing.decorationCost.toFixed(2);

        // LTM fee row
        if (pricing.ltmFeePerUnit > 0) {
            document.getElementById('ltmRow').style.display = '';
            document.getElementById('breakdownLTM').textContent =
                pricing.ltmFeePerUnit.toFixed(2);
        } else {
            document.getElementById('ltmRow').style.display = 'none';
        }

        // Totals
        document.getElementById('breakdownUnit').textContent =
            pricing.unitPrice.toFixed(2);
        document.getElementById('breakdownQty').textContent =
            pricing.quantity || this.state.quantity;
        document.getElementById('breakdownTotal').textContent =
            pricing.totalPrice.toFixed(2);
    }

    showPlaceholder() {
        // Add placeholder mode
        document.getElementById('heroSection')?.classList.add('placeholder-mode');

        // Show placeholder in hero
        document.getElementById('heroUnitPrice').innerHTML =
            '<span class="placeholder">Enter base cost</span>';
        document.getElementById('heroTotalPrice').innerHTML =
            '<span class="placeholder">Enter base cost</span>';

        // Hide breakdown, show placeholder
        document.getElementById('pricingBreakdown').style.display = 'none';
        document.querySelector('.pricing-placeholder').style.display = 'block';
    }

    async generateQuote() {
        if (!this.state.currentPricing) {
            alert('Please enter base cost and calculate pricing first');
            return;
        }

        try {
            // Show loading
            this.showLoading();

            // Generate quote
            const result = await this.quoteService.generateQuote({
                method: this.config.method,
                pricing: this.state.currentPricing,
                quantity: this.state.quantity,
                location: this.state.selectedLocation,
                basePrice: this.state.basePrice
            });

            if (result.success) {
                // Show success
                document.getElementById('quoteCard').style.display = 'block';
                document.getElementById('quoteId').textContent = result.quoteId;

                // Optionally send email
                if (confirm('Send quote to customer?')) {
                    await this.quoteService.sendEmail(result.quoteId);
                }
            }

        } catch (error) {
            console.error('Quote generation failed:', error);
            alert('Failed to generate quote. Please try again.');
        } finally {
            this.hideLoading();
        }
    }

    reset() {
        // Reset state
        this.state = {
            basePrice: 0,
            quantity: 24,
            selectedLocation: 'LC',
            currentPricing: null
        };

        // Reset inputs
        document.getElementById('basePrice').value = '';
        document.getElementById('quantity').value = 24;

        // Reset display
        this.showPlaceholder();

        // Hide quote card
        document.getElementById('quoteCard').style.display = 'none';

        // Focus base price
        document.getElementById('basePrice').focus();
    }

    // Helper methods
    getLocationName(code) {
        const locations = {
            'LC': 'Left Chest',
            'FF': 'Full Front',
            'FB': 'Full Back',
            'RS': 'Right Sleeve',
            'LS': 'Left Sleeve'
        };
        return locations[code] || code;
    }

    showLoading() {
        // Implementation depends on UI framework
    }

    hideLoading() {
        // Implementation depends on UI framework
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.manualCalculator = new ManualPricingCalculator(MANUAL_CONFIG);
});
```

## Quote Service Pattern {#quote-service}

### Base Quote Service Class
```javascript
class BaseQuoteService {
    constructor() {
        this.apiBase = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api';
        this.emailjsServiceId = 'service_1c4k67j';
        this.emailjsPublicKey = '4qSbDO-SQs19TbP80';

        // Initialize EmailJS
        emailjs.init(this.emailjsPublicKey);
    }

    generateQuoteID(prefix) {
        const date = new Date();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const random = Math.floor(Math.random() * 10000);
        return `${prefix}${month}${day}-${String(random).padStart(4, '0')}`;
    }

    async saveToDatabase(quoteData) {
        // Save session
        const sessionResponse = await fetch(`${this.apiBase}/quote_sessions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(quoteData.session)
        });

        if (!sessionResponse.ok) {
            throw new Error('Failed to save quote session');
        }

        // Save items
        for (const item of quoteData.items) {
            await fetch(`${this.apiBase}/quote_items`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(item)
            });
        }

        return true;
    }

    async sendEmail(templateId, emailData) {
        return await emailjs.send(
            this.emailjsServiceId,
            templateId,
            emailData
        );
    }
}
```

## Shared CSS System {#shared-css}

The `manual-calculator-styles.css` file provides consistent styling:

```css
/* Root variables - NWCA Green Theme */
:root {
    --primary-color: #4cb354;
    --primary-dark: #2d5f3f;
    --primary-light: #4cb861;
    --primary-lighter: #e8f5e9;
    --bg-color: #f5f7fa;
    --card-bg: #ffffff;
    --border-color: #e5e7eb;
    --text-primary: #1f2937;
    --text-secondary: #6b7280;
}

/* Card Component */
.card {
    background: var(--card-bg);
    border-radius: 12px;
    padding: 2rem;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    margin-bottom: 1.5rem;
}

/* Calculator Grid */
.calculator-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 2rem;
    align-items: start;
}

/* Hero Section */
.hero-section {
    background: linear-gradient(to right, var(--primary-lighter), #f8f9fa);
    border-radius: 8px;
    padding: 20px;
    margin-bottom: 20px;
    text-align: center;
}

/* Form Controls */
.form-control {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    font-size: 1rem;
    transition: all 0.2s;
}

.form-control:focus {
    border-color: var(--primary-color);
    outline: none;
    box-shadow: 0 0 0 0.25rem rgba(76, 179, 84, 0.25);
}

/* Buttons */
.btn {
    padding: 0.75rem 1.5rem;
    border-radius: 6px;
    font-weight: 500;
    font-size: 1rem;
    border: none;
    cursor: pointer;
    transition: all 0.2s;
}

.btn-primary {
    background: var(--primary-color);
    color: white;
}

.btn-primary:hover {
    background: var(--primary-dark);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(76, 179, 84, 0.3);
}
```

## Testing & Debugging {#testing-debugging}

### Console Testing Suite
```javascript
// Add to every manual calculator
window.MANUAL_CALC_DEBUG = {
    // Test pricing calculation
    testPricing: function(baseCost = 10, quantity = 24, location = 'LC') {
        const calculator = window.manualCalculator;
        calculator.state.basePrice = baseCost;
        calculator.state.quantity = quantity;
        calculator.state.selectedLocation = location;

        const pricing = calculator.calculatePricing();
        console.table(pricing);
        return pricing;
    },

    // Test all tiers
    testAllTiers: function(baseCost = 10) {
        const results = [];
        const quantities = [12, 24, 48, 72, 144];

        quantities.forEach(qty => {
            const pricing = this.testPricing(baseCost, qty);
            results.push({
                quantity: qty,
                tier: pricing.tier,
                unitPrice: pricing.unitPrice.toFixed(2),
                margin: pricing.marginPercent.toFixed(0) + '%',
                ltmFee: pricing.ltmFeePerUnit.toFixed(2)
            });
        });

        console.table(results);
        return results;
    },

    // Test margin calculations
    testMargins: function() {
        const denominators = [0.5, 0.55, 0.6, 0.65, 0.7];
        const baseCost = 10;

        denominators.forEach(denom => {
            const sellPrice = baseCost / denom;
            const margin = ((sellPrice - baseCost) / baseCost * 100);
            console.log(`Denominator ${denom}: Cost $${baseCost} → Sell $${sellPrice.toFixed(2)} = ${margin.toFixed(0)}% markup`);
        });
    },

    // Get current state
    getState: function() {
        return window.manualCalculator.state;
    },

    // Force recalculation
    recalculate: function() {
        window.manualCalculator.calculateAndDisplay();
    }
};
```

## Quick Reference Matrix {#quick-reference}

### Calculator Type Selection Guide

| Calculator Type | Use When | Key Features | Base Cost Input |
|----------------|-----------|--------------|-----------------|
| **Manual Pricing** | Need to calculate margins from vendor cost | Margin denominators, tier pricing | Required |
| **Contract** | Using pre-negotiated pricing | Fixed rates, no margin calc | Not needed |
| **Specialty** | Specific products with unique pricing | Fixed price tables, special options | Not applicable |

### Common Configuration Values

```javascript
// Standard Quantity Tiers
const STANDARD_TIERS = {
    small: { min: 12, max: 23 },
    medium: { min: 24, max: 47 },
    large: { min: 48, max: 71 },
    xlarge: { min: 72, max: 143 },
    xxlarge: { min: 144, max: 9999 }
};

// Standard Margin Denominators
const MARGIN_DENOMINATORS = {
    aggressive: 0.50,  // 100% markup
    standard: 0.60,    // 67% markup
    conservative: 0.70 // 43% markup
};

// Standard LTM Fees
const LTM_FEES = {
    standard: 50.00,
    premium: 75.00,
    waived: 0.00
};

// Decoration Methods
const DECORATION_METHODS = {
    DTG: 'Direct-to-Garment',
    DTF: 'Direct-to-Film',
    EMB: 'Embroidery',
    SP: 'Screen Print',
    HTV: 'Heat Transfer Vinyl',
    LASER: 'Laser Engraving'
};
```

## Implementation Checklist

When creating a new manual pricing calculator:

- [ ] Determine calculator type (Manual, Contract, or Specialty)
- [ ] Copy appropriate template HTML file
- [ ] Create configuration object with tiers and pricing
- [ ] Set up margin denominators (if manual)
- [ ] Configure decoration costs/options
- [ ] Create quote service class extending BaseQuoteService
- [ ] Set up EmailJS template
- [ ] Test all quantity tiers
- [ ] Test LTM fee application
- [ ] Verify margin calculations
- [ ] Add to staff dashboard menu
- [ ] Update ACTIVE_FILES.md
- [ ] Create staff training notes

## Summary

This guide provides everything needed to create pricing calculators without reinventing the wheel:

1. **Three distinct patterns** for different business needs
2. **Shared components** for consistency and maintainability
3. **Proven formulas** for margin calculations
4. **Complete templates** ready to customize
5. **Testing utilities** for verification

Use the appropriate pattern, leverage shared components, and follow the established formulas to create new calculators quickly and correctly.

---

*Last updated: 2025-01-27 by Claude & Erik*