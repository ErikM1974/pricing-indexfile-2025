# Cap Embroidery File Status Documentation

Last Updated: January 6, 2025

## Active Files (Currently in Use)

### HTML
- `cap-embroidery-pricing.html` - Main pricing page (flagship template)

### JavaScript (in /shared_components/js/)
- `cap-embroidery-controller-v2.js` - Main controller using NWCA namespace (V2)
- `cap-embroidery-quote-adapter.js` - Quote system adapter
- `cap-embroidery-back-logo.js` - Back logo functionality
- `cap-embroidery-validation.js` - Product validation utilities
- `cap-embroidery-cart-integration.js` - Cart integration functionality

### CSS (in /shared_components/css/)
- `cap-embroidery-specific.css` - Cap embroidery specific styles

## Deprecated/Archived Files

### JavaScript (moved to /archived-test-files/js-duplicates/)
- `cap-embroidery-controller.js` - V1 controller (replaced by V2)
- `cap-embroidery-adapter.js` - Original adapter (functionality merged into V2)
- `cap-embroidery-adapter-enhanced.js` - Enhanced adapter (functionality merged into V2)
- `cap-embroidery-enhanced.js` - Enhancement utilities (merged into V2)
- `cap-embroidery-enhanced-loading.js` - Loading animations (merged into V2)

### Test Files (moved to /archived-test-files/)
- `test-cap-embroidery-controller.html`
- `test-cap-embroidery-quote.html`
- `test-back-logo-increment-arrows.html`
- `test-embroidery-additional-logo.html`
- `test-embroidery-quote.html`
- `test-cap-embroidery-dollar-fix.html`

## File Dependencies

The cap-embroidery-pricing.html page depends on:

1. **Core Dependencies**
   - NWCA namespace (`nwca-namespace.js`)
   - Constants (`constants.js`)
   - Utils (`utils.js`)

2. **Pricing System**
   - `pricing-matrix-capture.js`
   - `pricing-matrix-api.js`
   - `pricing-calculator.js`

3. **UI Components**
   - `universal-header.js`
   - `hero-quantity-calculator.js`
   - `product-quantity-ui.js`
   - `product-pricing-ui.js`

4. **Cap Embroidery Specific**
   - `cap-embroidery-controller-v2.js` (main controller)
   - `cap-embroidery-quote-adapter.js`
   - Supporting utilities listed above

## Notes

- The V2 controller consolidates functionality from 6 separate files into one cohesive module
- All deprecated files have been archived rather than deleted for reference
- The cap-embroidery-pricing.html serves as the flagship template for other pricing pages
- Quote workflow has replaced the traditional cart workflow for cap embroidery