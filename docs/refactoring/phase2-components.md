# Phase 2: Component Architecture

## Overview
This phase introduces reusable component classes that provide core functionality for all pricing pages. These components are designed to be framework-agnostic and can be used standalone or integrated with React/Vue/Angular.

## Components Implemented

### 1. PricingCalculator
**Location:** `src/shared/components/pricing-calculator.js`

A comprehensive pricing calculation engine that handles:
- Tier-based pricing logic
- LTM (Less Than Minimum) fee calculations
- Cumulative pricing support
- Add-on pricing (back logos, rush orders, etc.)
- Multi-size quantity calculations
- Savings calculations

**Key Features:**
```javascript
const calculator = new PricingCalculator({
  embellishmentType: 'cap-embroidery',
  eventBus: eventBus
});

const pricing = calculator.calculate({
  quantity: 50,
  sizeBreakdown: { 'S/M': 20, 'L/XL': 30 },
  additionalOptions: { backLogo: true },
  cumulativePricing: true,
  existingQuantity: 25
});
```

### 2. QuoteSystem
**Location:** `src/shared/components/quote-system.js`

Base quote management system with:
- Quote creation and management
- Item addition/removal/updates
- Customer information handling
- Auto-save functionality
- Quote history
- Export capabilities (JSON, CSV)

**Key Features:**
```javascript
const quoteSystem = new QuoteSystem({
  autoSave: true,
  expirationDays: 30
});

quoteSystem.addItem({
  productName: 'Custom Cap',
  quantity: 50,
  unitPrice: 25.00
});
```

### 3. ColorSelector
**Location:** `src/shared/components/color-selector.js`

Interactive color swatch selector with:
- Visual color swatches
- Pattern support (stripes, dots, gradients)
- Stock validation
- Multi-select support
- Keyboard navigation
- Accessibility features

**Key Features:**
```javascript
const colorSelector = new ColorSelector({
  container: '#color-selector',
  allowMultiple: false,
  validateStock: true
});

colorSelector.setColors([
  { id: 'red', name: 'Red', hex: '#FF0000', stock: 'in' },
  { id: 'blue', name: 'Blue', hex: '#0000FF', stock: 'low' }
]);
```

### 4. ImageGallery
**Location:** `src/shared/components/image-gallery.js`

Product image gallery with:
- Thumbnail navigation
- Zoom functionality
- Fullscreen mode
- Touch gesture support
- Lazy loading
- Auto-rotation
- Color coordination

**Key Features:**
```javascript
const gallery = new ImageGallery({
  container: '#product-images',
  enableZoom: true,
  lazyLoad: true,
  autoRotate: true
});

gallery.setImages([
  { src: 'image1.jpg', thumb: 'thumb1.jpg', colorId: 'red' },
  { src: 'image2.jpg', thumb: 'thumb2.jpg', colorId: 'blue' }
]);
```

### 5. PricingMatrix
**Location:** `src/shared/components/pricing-matrix.js`

Dynamic pricing table display with:
- Responsive table layout
- Active tier highlighting
- Hover interactions
- Multiple data format support
- Export functionality
- Print-friendly styling

**Key Features:**
```javascript
const matrix = new PricingMatrix({
  container: '#pricing-table',
  highlightActiveTier: true,
  showTierLabels: true
});

matrix.setPricingData({
  headers: ['S/M', 'L/XL', '2XL'],
  prices: {
    'S/M': { '1-23': 25, '24-47': 23, '48+': 21 },
    'L/XL': { '1-23': 27, '24-47': 25, '48+': 23 }
  }
});
```

## Component Benefits

### 1. Reusability
- All components can be used across different pricing pages
- No dependencies on specific embellishment types
- Clean APIs for easy integration

### 2. Modularity
- Each component is self-contained
- Can be imported individually as needed
- No global namespace pollution

### 3. Event-Driven Architecture
- Components communicate via EventBus
- Loose coupling between components
- Easy to extend with new features

### 4. Performance
- Components only load when needed
- Efficient DOM manipulation
- Built-in lazy loading support

### 5. Accessibility
- ARIA labels and roles
- Keyboard navigation
- Screen reader friendly

## Usage Example

Here's how these components work together:

```javascript
import {
  EventBus,
  PricingCalculator,
  QuoteSystem,
  ColorSelector,
  ImageGallery,
  PricingMatrix
} from './src/core';

// Create shared event bus
const eventBus = new EventBus();

// Initialize components
const calculator = new PricingCalculator({ eventBus });
const quoteSystem = new QuoteSystem({ eventBus });
const colorSelector = new ColorSelector({ eventBus });
const gallery = new ImageGallery({ eventBus });
const matrix = new PricingMatrix({ eventBus });

// Components automatically communicate via events
eventBus.on('colorSelector:selected', (data) => {
  gallery.showImageByColor(data.color.id);
});

eventBus.on('pricing:calculated', (pricing) => {
  matrix.setCurrentQuantity(pricing.totalQuantity);
});
```

## Next Steps

1. Create page-specific adapters that use these components
2. Implement state management for complex interactions
3. Add unit tests for each component
4. Create Storybook documentation
5. Build React/Vue wrappers for framework integration

## Migration Path

To use these components in existing pages:

1. Import the component you need
2. Initialize with appropriate container
3. Replace existing functionality gradually
4. Remove old code once component is working

## Commit Information
- Branch: `refactor/component-architecture-phase2`
- Components created: 5
- Provides foundation for all pricing page functionality