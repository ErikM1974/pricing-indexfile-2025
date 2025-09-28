# Manual Pricing Calculator Core Guide

**Last Updated:** 2025-01-27
**Purpose:** Core concepts and logic for manual pricing calculators

## Overview: Three Calculator Categories

### Category 1: Manual Pricing
- **Purpose:** Allow sales staff to manually enter base costs and calculate margins
- **Examples:** Manual DTG, DTF, Embroidery, Cap Embroidery, Screen Print, Stickers, Laser
- **Key Feature:** Base cost input field that drives all calculations

### Category 2: Contract/Corporate Pricing
- **Purpose:** Fixed pricing based on pre-negotiated contracts
- **Examples:** Contract DTG, Contract Embroidery, Corporate Supplied variants
- **Key Feature:** No base cost input - uses fixed contract rates

### Category 3: Specialty Calculators
- **Purpose:** Product-specific pricing with unique features
- **Examples:** Laser Tumblers, Richardson Caps, Webstores, Embroidered Emblems
- **Key Feature:** Fixed price tables, case quantities, special options

## Shared Architecture

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

## Core Pricing Formula & Logic

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

### Margin Denominator System

Margin denominators determine markup percentage:
```javascript
// Formula: sellingPrice = cost / marginDenominator

// Standard margin denominators:
// 0.50 = 100% markup (cost $10 → sell $20)
// 0.55 = ~82% markup (cost $10 → sell $18.18)
// 0.60 = ~67% markup (cost $10 → sell $16.67)
// 0.65 = ~54% markup (cost $10 → sell $15.38)
// 0.70 = ~43% markup (cost $10 → sell $14.29)

function calculateMarkupPercentage(marginDenominator) {
    return ((1 / marginDenominator) - 1) * 100;
}
```

### Standard Configuration Values

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

## Base Quote Service Pattern

All calculators extend this base service:

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
}
```

## Quick Reference Matrix

| Calculator Type | Use When | Key Features | Base Cost Input |
|----------------|-----------|--------------|-----------------|
| **Manual Pricing** | Need to calculate margins from vendor cost | Margin denominators, tier pricing | Required |
| **Contract** | Using pre-negotiated pricing | Fixed rates, no margin calc | Not needed |
| **Specialty** | Specific products with unique pricing | Fixed price tables, special options | Not applicable |

## Testing & Debugging Utilities

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
    }
};
```

## Implementation Checklist

When creating a new manual pricing calculator:

- [ ] Determine calculator type (Manual, Contract, or Specialty)
- [ ] Copy appropriate template from /memory/templates/
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

## Related Documentation

- **Templates**: See `/memory/templates/` for complete HTML and JavaScript templates
- **Manual Calculator Template**: `/memory/templates/manual-calculator-template.md`
- **Contract Calculator Template**: `/memory/templates/contract-calculator-template.md`
- **Specialty Calculator Template**: `/memory/templates/specialty-calculator-template.md`
- **Shared Components**: `/memory/templates/calculator-components.md`

---

**Documentation Type**: Core Calculator Logic
**Parent Document**: Main calculator documentation
**Related**: Template files in /memory/templates/