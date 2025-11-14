# Manual Calculator Testing & Quick Reference

**Last Updated:** 2025-11-14
**Purpose:** Testing procedures, debugging tools, and quick reference guide
**Part:** 3 of 3 - Testing & Reference

## 📚 Complete Guide Navigation
- **Part 1:** [Concepts & Architecture](MANUAL_CALCULATOR_CONCEPTS.md) - Calculator types, pricing formulas
- **Part 2:** [Implementation & Templates](MANUAL_CALCULATOR_TEMPLATES.md) - HTML/JS code, quote service
- **Part 3: Testing & Reference** (this file) - Testing, quick reference, checklist

---

## Table of Contents
1. [Testing & Debugging](#testing-debugging)
2. [Quick Reference Matrix](#quick-reference)
3. [Implementation Checklist](#implementation-checklist)

---

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