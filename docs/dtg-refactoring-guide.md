# DTG Page Refactoring Guide

## Overview
This document outlines the refactoring of the DTG (Direct to Garment) pricing page from a monolithic 1,075-line HTML file to a modular, maintainable architecture using universal components.

## What Changed

### Before (Original)
- **File**: `dtg-pricing.html` (1,075 lines)
- **Structure**: Everything in one file
- **CSS**: 700+ lines of inline styles
- **Components**: Custom implementations
- **Maintenance**: Difficult due to size and complexity

### After (Refactored)
- **File**: `dtg-pricing-refactored.html` (~300 lines)
- **Structure**: Modular component-based
- **CSS**: Separated into logical files
- **Components**: Reusable universal components
- **Maintenance**: Easy with clear separation of concerns

## New File Structure

```
/shared_components/
├── css/
│   ├── dtg-specific.css         # DTG-specific styles
│   ├── universal-quick-quote.css # Quick quote component
│   └── universal-pricing-grid.css # Pricing grid component
└── js/
    ├── dtg-config.js            # Configuration module
    ├── dtg-integration.js       # Integration layer
    ├── universal-quick-quote-calculator.js
    └── universal-pricing-grid.js
```

## Key Components

### 1. DTG Configuration Module (`dtg-config.js`)
Centralizes all DTG-specific settings:
- Print locations and upcharges
- Pricing tiers and LTM settings
- Component configurations
- Helper methods

### 2. DTG Integration Layer (`dtg-integration.js`)
Connects all components:
- Initializes universal components
- Handles location selection
- Manages data flow between components
- Maintains backward compatibility

### 3. Universal Quick Quote Calculator
Provides instant pricing:
- Quantity input with quick select buttons
- Real-time price calculations
- LTM warnings
- Savings tips

### 4. Universal Pricing Grid
Displays pricing tiers:
- Dynamic loading animations
- Inventory indicators
- Best value badges
- Active tier highlighting

## Migration Guide

### For Developers

1. **Replace the old page**:
   ```bash
   # Backup original
   mv dtg-pricing.html dtg-pricing-original.html
   
   # Use refactored version
   mv dtg-pricing-refactored.html dtg-pricing.html
   ```

2. **Update any direct links** that might reference specific IDs or classes

3. **Test thoroughly** using the test dashboard at `/test-dtg-refactored.html`

### For Content Updates

1. **Print Locations**: Edit `dtg-config.js` → `locations` object
2. **Pricing Tiers**: Edit `dtg-config.js` → `pricing.defaultTiers`
3. **LTM Settings**: Edit `dtg-config.js` → `pricing.ltmThreshold` and `ltmFee`
4. **Styling**: Edit `dtg-specific.css` for DTG-specific styles

## Component Communication

```javascript
// Flow of data through components
User selects location
    ↓
DTGIntegration.handleLocationChange()
    ↓
DTG Adapter loads pricing
    ↓
'pricingDataLoaded' event fired
    ↓
Components update:
    - Quick Quote Calculator
    - Pricing Grid
    - Quote System
```

## Customization Examples

### Adding a New Print Location
```javascript
// In dtg-config.js
locations: {
    'NEW_LOC': {
        name: 'New Location Name',
        displayName: 'New Location',
        description: 'Description here',
        maxSize: '10" x 10"',
        upcharge: 3.00
    }
}
```

### Changing Quick Quote Buttons
```javascript
// In dtg-config.js
quickQuote: {
    quickSelectButtons: [
        { label: 'Small Order', quantity: 6 },
        { label: 'Medium Order', quantity: 24 },
        { label: 'Large Order', quantity: 100 }
    ]
}
```

### Modifying Pricing Grid Behavior
```javascript
// In dtg-config.js
pricingGrid: {
    showInventory: false,        // Hide inventory indicators
    loadingAnimation: false,     // Disable loading animation
    showBestValueBadges: true    // Show value badges
}
```

## Performance Improvements

1. **Code Splitting**: Components load only when needed
2. **CSS Organization**: Styles are cached efficiently
3. **Progressive Enhancement**: Core functionality loads first
4. **Reduced Payload**: 72% reduction in HTML size

## Troubleshooting

### Common Issues

1. **Location dropdown not populating**
   - Check: Is `dtg-config.js` loaded before `dtg-integration.js`?
   - Check: Console for any JavaScript errors

2. **Pricing not updating**
   - Check: Is the Caspio embed script included?
   - Check: Network tab for API calls to pricing proxy

3. **Styles not applying**
   - Check: Are all CSS files linked in the correct order?
   - Check: Browser cache (try hard refresh)

### Debug Mode
Add `?debug=true` to URL for verbose console logging:
```
/dtg-pricing.html?style=G500&color=Black&debug=true
```

## Benefits of Refactoring

1. **Maintainability**: Easier to update and debug
2. **Reusability**: Components shared with other pages
3. **Performance**: Faster initial load, better caching
4. **Consistency**: Unified UI/UX across all pricing pages
5. **Scalability**: Easy to add new features

## Future Enhancements

1. **Visual Print Preview**: Show where prints will appear on garment
2. **Advanced Filtering**: Filter by garment type, brand, etc.
3. **Comparison Tool**: Compare different location options
4. **Bulk Upload**: CSV upload for large orders
5. **API Integration**: Direct API access without Caspio

## Questions?

For questions about the refactoring:
1. Check this documentation
2. Review the test dashboard
3. Examine the component source code
4. Contact the development team

---

*Last Updated: January 2025*
*Refactored by: Claude with Sir Erik*