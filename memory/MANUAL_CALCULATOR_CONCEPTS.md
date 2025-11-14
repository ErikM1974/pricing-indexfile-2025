# Manual Calculator Concepts & Architecture

**Last Updated:** 2025-11-14
**Purpose:** Overview of manual pricing calculator types and core concepts
**Part:** 1 of 3 - Core Concepts

## 📚 Complete Guide Navigation
- **Part 1: Concepts & Architecture** (this file) - Calculator types, pricing formulas
- **Part 2:** [Implementation & Templates](MANUAL_CALCULATOR_TEMPLATES.md) - HTML/JS code, quote service
- **Part 3:** [Testing & Reference](MANUAL_CALCULATOR_REFERENCE.md) - Testing, quick reference, checklist

---

## Table of Contents
1. [Overview: Three Calculator Categories](#overview)
2. [Shared Architecture & Components](#shared-architecture)
3. [Manual Pricing Calculators](#manual-pricing)
4. [Contract/Corporate Calculators](#contract-corporate)
5. [Specialty Calculators](#specialty)
6. [Pricing Formula & Logic](#pricing-formula)

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

