# Universal Header Component Guide

## Overview

The Universal Header Component is a modular, reusable header that provides consistent navigation across all pricing pages. It automatically configures itself based on the page it's on and handles dynamic product context.

## Features

- **Automatic Page Detection** - Identifies which pricing page it's on
- **Dynamic Breadcrumbs** - Updates based on URL parameters
- **Product Context Aware** - Shows product information when available
- **Back Navigation** - Links back to product page when applicable
- **Responsive Design** - Works on all screen sizes
- **Easy Integration** - Just 3 lines of code to add

## Quick Start

### 1. Add the Header Container

Add this div where you want the header to appear (typically right after `<body>`):

```html
<div id="universal-header-container" data-page-type="embroidery"></div>
```

### 2. Include the CSS

Add to your `<head>`:

```html
<link rel="stylesheet" href="/shared_components/css/universal-header.css">
```

### 3. Include the JavaScript

Add before closing `</body>`:

```html
<script src="/shared_components/js/universal-header-component.js"></script>
```

That's it! The header will automatically initialize and configure itself.

## Configuration Options

### Page Types

Set the `data-page-type` attribute to one of:

- `embroidery` - Embroidery Pricing
- `cap-embroidery` - Cap Embroidery Pricing  
- `dtg` - Direct to Garment Pricing
- `screenprint` - Screen Print Pricing
- `dtf` - Direct to Film Pricing

### Optional Attributes

```html
<div id="universal-header-container" 
     data-page-type="embroidery"
     data-show-back-button="true"
     data-show-breadcrumbs="true">
</div>
```

## URL Parameters

The header automatically reads these URL parameters:

- `StyleNumber` - Product style number (e.g., C112, PC61)
- `COLOR` - Selected color

Example: `/embroidery-pricing.html?StyleNumber=C112&COLOR=Black`

## Dynamic Updates

The header watches for changes to the product title and updates automatically:

```javascript
// The header will detect when this changes
document.getElementById('product-title-context').textContent = 'New Product Name';
```

## Styling Adjustments

### Hide Old Navigation

If your page has existing navigation that conflicts:

```css
/* Hide old back button */
.product-header .navigation-area {
    display: none;
}
```

### Adjust Container Padding

```css
/* Account for header height */
.container {
    padding-top: 20px;
}
```

## Integration Examples

### Embroidery Page

```html
<!DOCTYPE html>
<html>
<head>
    <link rel="stylesheet" href="/shared_components/css/universal-header.css">
</head>
<body>
    <!-- Universal Header -->
    <div id="universal-header-container" data-page-type="embroidery"></div>
    
    <!-- Your page content -->
    <div class="container">
        <!-- ... -->
    </div>
    
    <script src="/shared_components/js/universal-header-component.js"></script>
</body>
</html>
```

### Cap Embroidery Page

```html
<div id="universal-header-container" data-page-type="cap-embroidery"></div>
```

## Breadcrumb Structure

The breadcrumbs follow this pattern:

```
Home > Products > [Product Style] > [Page Name]
```

- Without product: `Home > Products > Embroidery Pricing`
- With product: `Home > Products > C112 > Embroidery Pricing`

## JavaScript API

### Manual Initialization

```javascript
// Header auto-initializes, but you can manually init:
UniversalHeaderComponent.init();
```

### Update Configuration

```javascript
// Update header with new config
UniversalHeaderComponent.update({
    subtitle: 'Custom Subtitle',
    showBackButton: false
});
```

### Access Current Configuration

```javascript
const pageType = UniversalHeaderComponent.detectPageType();
console.log('Current page:', pageType);
```

## Troubleshooting

### Header Not Appearing

1. Check console for errors
2. Ensure container div has correct ID: `universal-header-container`
3. Verify JavaScript file is loading
4. Check that CSS file is linked

### Breadcrumbs Not Updating

1. Verify URL parameters are correct format
2. Check that product links use correct parameter names
3. Ensure JavaScript is executing after DOM loads

### Styling Issues

1. Check for CSS conflicts with existing styles
2. Ensure universal-header.css is loaded
3. Use browser inspector to check computed styles

## Migration Guide

### From Old Header to Universal Header

1. **Remove old header HTML** (h1, navigation, etc.)
2. **Add header container** div
3. **Include CSS and JS** files
4. **Hide conflicting elements** with CSS
5. **Test with various URLs**

## Benefits

1. **Consistency** - Same header across all pages
2. **Maintainability** - Update in one place
3. **Flexibility** - Configure per page
4. **Future-proof** - Easy to add new features
5. **Performance** - Lightweight and fast

## Support

For issues or questions:
- Check the test page: `/test-universal-header.html`
- Review console logs for debug information
- Contact development team

---

*Version 1.0 - January 2025*