# DTF Transfer Pricing Calculator V2 - Refactor Summary

## Overview
Complete refactor of the DTF (Direct-to-Film) Transfer Pricing Calculator following the successful patterns from Screen Print V2 and DTG calculators. The new implementation provides a clean, user-friendly interface for calculating total pricing including garment cost, transfer costs, and labor.

## Key Features Implemented

### 1. Dynamic Transfer Management
- Add/remove multiple transfer locations (up to 8)
- Location-based size constraints
- Visual numbering system for easy tracking
- First location cannot be removed (minimum 1 required)
- Minimum order quantity: 10 pieces (firm minimum)

### 2. Pricing Structure
Based on the provided pricing data:

#### Transfer Sizes & Pricing (Simplified Customer Tiers)
- **Left Chest (Up to 5" x 5")**
  - 10-23: $6.00 (+$50 LTM fee)
  - 24-47: $5.25
  - 48-71: $4.00
  - 72+: $3.25

- **Medium (Up to 9" x 12")**
  - 10-23: $9.50 (+$50 LTM fee)
  - 24-47: $8.25
  - 48-71: $6.50
  - 72+: $5.00

- **Large (Up to 12" x 16.5")**
  - 10-23: $14.50 (+$50 LTM fee)
  - 24-47: $12.50
  - 48-71: $10.00
  - 72+: $8.00

**Note**: Minimum order is 10 pieces (vendor constraint)

#### Labor Costs
- Pressing cost: $2.00 per location
- Formula: $2.00 × number of locations

#### Freight Costs (NEW)
Tiered structure based on order quantity:
- 10-49: $1.00 per transfer
- 50-99: $0.75 per transfer
- 100-199: $0.50 per transfer
- 200+: $0.35 per transfer

#### Total Pricing Formula
```
Total Per Shirt = (Garment Cost ÷ 0.6) + Sum(Transfer Costs) + ($2 × Locations) + (Freight × Locations) + LTM Fee
```

Key changes:
- **Margin vs Markup**: Now using 40% margin (divide by 0.6) instead of 40% markup
- **Labor**: Simplified to $2 per location (no longer doubles)
- **Freight**: Added tiered freight per transfer based on order quantity
- **Simplified Tiers**: Reduced from 10 vendor tiers to 4 customer-facing tiers
- **LTM Fee**: $50 for orders under 24 pieces
- **Minimum Order**: 10 pieces (due to vendor constraints)

### 3. User Interface Features
- Two-column layout (calculator left, summary right)
- Accordion sections for:
  - Size Guide
  - Pricing Tiers
  - Pricing Formula
- Real-time pricing updates
- Mobile responsive design
- Clear visual hierarchy

### 4. Technical Architecture

#### File Structure
```
/dtf-pricing-v2.html              - Main pricing page
/test-dtf-v2.html                 - Test page with mock data
/shared_components/
  js/
    dtf-config.js                 - Hardcoded pricing data & configuration
    dtf-pricing-calculator.js     - Main calculator component
    dtf-integration.js            - Component orchestration
    dtf-adapter.js                - Caspio adapter (updated for v2)
  css/
    dtf-calculator.css           - DTF-specific styles
```

#### Key Components
1. **DTFConfig** - Central configuration with all pricing data
2. **DTFPricingCalculator** - Main calculator class with UI and logic
3. **DTFIntegration** - Coordinates between components
4. **DTFCaspioAdapter** - Handles data from Caspio/external sources

### 5. Data Integration
- Receives garment data from product page via:
  - URL parameters
  - Custom events
  - PostMessage (iframe scenarios)
  - Direct API calls
- Stores data in sessionStorage for persistence
- Dispatches events for external components

### 6. Location Constraints
Different locations allow different transfer sizes:
- **Front/Back Center**: All sizes
- **Left/Right Chest**: Left Chest size only
- **Sleeves**: Left Chest size only
- **Neck Label**: Left Chest size only
- **Bottom Hem**: Left Chest and Medium sizes

## Testing
Access the test page at `/test-dtf-v2.html` to:
- Test with different garment costs
- Try various quantities to see pricing tier changes
- Add multiple locations to see labor cost progression
- Use preset buttons for common garment types

## Integration Guide

### Basic Integration
```html
<!-- Include required files -->
<link rel="stylesheet" href="/shared_components/css/dtf-calculator.css">
<script src="/shared_components/js/dtf-config.js"></script>
<script src="/shared_components/js/dtf-pricing-calculator.js"></script>
<script src="/shared_components/js/dtf-adapter.js"></script>
<script src="/shared_components/js/dtf-integration.js"></script>

<!-- Add calculator container -->
<div id="dtf-calculator-container"></div>
```

### Sending Data to Calculator
```javascript
// Option 1: Via DTF Adapter API
window.DTFAdapter.updateData({
    garmentCost: 10.00,
    quantity: 50,
    freight: 2.50,
    ltmFee: 1.00,
    productInfo: {
        name: 'Premium T-Shirt',
        sku: 'PRM-001'
    }
});

// Option 2: Via Custom Event
window.dispatchEvent(new CustomEvent('updateDTFPricing', {
    detail: {
        garmentCost: 10.00,
        quantity: 50
    }
}));

// Option 3: Via URL Parameters
// dtf-pricing-v2.html?garmentCost=10&quantity=50&productName=Premium+Shirt
```

### Listening for Pricing Updates
```javascript
window.addEventListener('dtfPricingCalculated', function(event) {
    console.log('Price per shirt:', event.detail.totalPerShirt);
    console.log('Total order:', event.detail.totalOrder);
    console.log('Full details:', event.detail);
});
```

## Future Enhancements (Not Implemented)
- Gang sheet optimization suggestions
- Rush order pricing
- Custom size inputs
- Bulk order discounts
- White/dark garment pricing variations
- Save/load quote functionality

## Summary
The DTF Transfer Pricing Calculator V2 provides a clean, intuitive interface for calculating DTF transfer pricing with multiple locations. It follows established patterns from other calculators while being specifically optimized for DTF requirements. The hardcoded pricing structure ensures fast performance and easy maintenance.