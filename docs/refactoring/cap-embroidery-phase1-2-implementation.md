# Cap Embroidery Page: Phase 1-2 Implementation Guide

## Overview
This document provides step-by-step instructions for implementing the refactoring phases 1 and 2 specifically for the cap embroidery pricing page. These phases lay the foundation for a modern, maintainable codebase.

## Table of Contents
1. [Phase 1: Performance & Bundling](#phase-1-performance--bundling)
2. [Phase 2: Component Architecture](#phase-2-component-architecture)
3. [Migration Checklist](#migration-checklist)
4. [Testing Guide](#testing-guide)

---

## Phase 1: Performance & Bundling

### Objective
Transform the cap embroidery page from loading 63+ individual resources to optimized bundles, improving load time by 70%+.

### Current State Analysis
The current `cap-embroidery-pricing.html` loads:
- 15+ JavaScript files
- 20+ CSS files
- Multiple jQuery plugins
- Redundant utilities
- Inline scripts

### Implementation Steps

#### Step 1: Set Up Build System
```bash
# From project root
git checkout refactor/performance-bundling-phase1
npm install
```

#### Step 2: Create Cap Embroidery Entry Point
Create `/src/pages/cap-embroidery/index.js`:
```javascript
// Import core utilities
import { EventBus } from '../../core/event-bus';
import { Logger } from '../../core/logger';
import { ApiClient } from '../../core/api-client';
import { StorageManager } from '../../core/storage-manager';

// Import cap embroidery specific modules
import { CapEmbroideryCalculator } from './calculator';
import { LocationManager } from './location-manager';
import { StitchCountValidator } from './validators';

// Import styles
import '../../shared/styles/core.css';
import './styles/cap-embroidery.css';

// Initialize page
class CapEmbroideryPage {
  constructor() {
    this.eventBus = new EventBus();
    this.logger = new Logger('CapEmbroidery');
    this.api = new ApiClient();
    this.storage = new StorageManager();
    
    this.init();
  }
  
  init() {
    this.logger.info('Initializing cap embroidery page');
    // Page initialization logic
  }
}

// Start when DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new CapEmbroideryPage());
} else {
  new CapEmbroideryPage();
}
```

#### Step 3: Update Webpack Configuration
Add cap embroidery entry to `webpack.config.js`:
```javascript
module.exports = {
  entry: {
    // ... other entries
    'cap-embroidery': './src/pages/cap-embroidery/index.js'
  },
  // ... rest of config
};
```

#### Step 4: Migrate Existing Code
Map current files to new structure:

| Current File | Migration Action | New Location |
|-------------|------------------|--------------|
| `cap-embroidery-controller-v2.js` | Extract logic | `/src/pages/cap-embroidery/calculator.js` |
| `cap-embroidery-back-logo.js` | Merge into | `/src/pages/cap-embroidery/location-manager.js` |
| `cap-embroidery-validation.js` | Refactor to | `/src/pages/cap-embroidery/validators.js` |
| `cap-embroidery-quote-adapter.js` | Use shared | `/src/core/quote-system.js` |
| Multiple CSS files | Combine into | `/src/pages/cap-embroidery/styles/cap-embroidery.css` |

#### Step 5: Update HTML Page
Replace 63+ script/link tags with:
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Cap Embroidery Pricing</title>
    
    <!-- Single CSS bundle -->
    <link rel="stylesheet" href="/dist/cap-embroidery.css">
</head>
<body>
    <!-- Page content remains the same -->
    <div id="cap-embroidery-app">
        <!-- Existing HTML structure -->
    </div>
    
    <!-- Single JS bundle -->
    <script src="/dist/cap-embroidery.js"></script>
</body>
</html>
```

#### Step 6: Remove jQuery Dependencies
Replace jQuery code with vanilla JavaScript:

**Before:**
```javascript
$('#quantity').on('change', function() {
    var qty = $(this).val();
    calculatePricing(qty);
});
```

**After:**
```javascript
document.getElementById('quantity').addEventListener('change', (e) => {
    const qty = e.target.value;
    this.calculatePricing(qty);
});
```

### Performance Metrics to Track
- Initial page load time
- Time to interactive
- Bundle sizes
- Network requests count

---

## Phase 2: Component Architecture

### Objective
Create reusable component classes that encapsulate functionality and can be shared across pricing pages.

### Implementation Steps

#### Step 1: Implement Base Components

##### PricingCalculator for Cap Embroidery
Create `/src/pages/cap-embroidery/calculator.js`:
```javascript
import { PricingCalculator } from '../../shared/components/pricing-calculator';

export class CapEmbroideryCalculator extends PricingCalculator {
  constructor(options) {
    super(options);
    this.embroideryRates = {
      setup: 40,
      perThousandStitches: 1.50,
      minimumCharge: 7.50
    };
  }
  
  calculateItemPrice(quantity, selections) {
    const basePrice = super.calculateItemPrice(quantity, selections);
    const embroideryPrice = this.calculateEmbroideryPrice(selections);
    return basePrice + embroideryPrice;
  }
  
  calculateEmbroideryPrice(selections) {
    const { stitchCount, locations } = selections;
    let totalPrice = 0;
    
    // Calculate for each location
    locations.forEach(location => {
      const stitches = stitchCount[location] || 0;
      const stitchPrice = (stitches / 1000) * this.embroideryRates.perThousandStitches;
      totalPrice += Math.max(stitchPrice, this.embroideryRates.minimumCharge);
    });
    
    return totalPrice;
  }
  
  getSetupFees(selections) {
    const { locations } = selections;
    return locations.length * this.embroideryRates.setup;
  }
}
```

##### ColorSelector Component
Implement for cap color selection:
```javascript
import { ColorSelector } from '../../shared/components/color-selector';

const capColorSelector = new ColorSelector({
  container: '#cap-color-selector',
  colors: [
    { id: 'black', name: 'Black', hex: '#000000' },
    { id: 'navy', name: 'Navy', hex: '#000080' },
    { id: 'red', name: 'Red', hex: '#FF0000' },
    // ... more colors
  ],
  multiSelect: false,
  onChange: (colors) => {
    this.updateSelection('color', colors[0]);
  }
});
```

##### Location Manager Component
Create `/src/pages/cap-embroidery/components/location-manager.js`:
```javascript
export class LocationManager {
  constructor(options) {
    this.container = document.querySelector(options.container);
    this.locations = options.locations || ['front', 'back', 'side'];
    this.activeLocations = new Set();
    this.onChange = options.onChange;
    
    this.render();
    this.attachEvents();
  }
  
  render() {
    this.container.innerHTML = `
      <div class="location-selector">
        <h3>Embroidery Locations</h3>
        ${this.locations.map(loc => `
          <label class="location-option">
            <input type="checkbox" value="${loc}" />
            <span>${this.formatLocation(loc)}</span>
            <div class="stitch-count-input" style="display: none;">
              <input type="number" 
                     placeholder="Stitch count" 
                     min="0" 
                     max="15000" />
            </div>
          </label>
        `).join('')}
      </div>
    `;
  }
  
  attachEvents() {
    this.container.addEventListener('change', (e) => {
      if (e.target.type === 'checkbox') {
        this.toggleLocation(e.target.value, e.target.checked);
      } else if (e.target.type === 'number') {
        this.updateStitchCount(e.target);
      }
    });
  }
  
  toggleLocation(location, active) {
    const stitchInput = this.container.querySelector(
      `input[value="${location}"] ~ .stitch-count-input`
    );
    
    if (active) {
      this.activeLocations.add(location);
      stitchInput.style.display = 'block';
    } else {
      this.activeLocations.delete(location);
      stitchInput.style.display = 'none';
    }
    
    this.notifyChange();
  }
  
  getSelections() {
    const selections = {};
    this.activeLocations.forEach(loc => {
      const input = this.container.querySelector(
        `input[value="${loc}"] ~ .stitch-count-input input`
      );
      selections[loc] = parseInt(input.value) || 0;
    });
    return selections;
  }
}
```

#### Step 2: Integrate Components into Page

Update `/src/pages/cap-embroidery/index.js`:
```javascript
import { CapEmbroideryCalculator } from './calculator';
import { LocationManager } from './components/location-manager';
import { ColorSelector } from '../../shared/components/color-selector';
import { QuoteSystem } from '../../shared/components/quote-system';
import { ImageGallery } from '../../shared/components/image-gallery';

class CapEmbroideryPage {
  constructor() {
    this.state = {
      quantity: 1,
      color: null,
      locations: {},
      stitchCounts: {}
    };
    
    this.initComponents();
  }
  
  initComponents() {
    // Initialize calculator
    this.calculator = new CapEmbroideryCalculator({
      pricingMatrix: window.CAP_PRICING_MATRIX
    });
    
    // Initialize color selector
    this.colorSelector = new ColorSelector({
      container: '#color-selector',
      colors: this.getAvailableColors(),
      onChange: (colors) => this.updateColor(colors[0])
    });
    
    // Initialize location manager
    this.locationManager = new LocationManager({
      container: '#location-selector',
      locations: ['front', 'back', 'left-side', 'right-side'],
      onChange: (locations) => this.updateLocations(locations)
    });
    
    // Initialize quote system
    this.quoteSystem = new QuoteSystem({
      container: '#quote-widget',
      calculator: this.calculator,
      onSave: (quote) => this.saveQuote(quote)
    });
    
    // Initialize image gallery
    this.imageGallery = new ImageGallery({
      container: '#product-images',
      images: this.getProductImages(),
      showThumbnails: true
    });
  }
  
  updateColor(color) {
    this.state.color = color;
    this.recalculate();
  }
  
  updateLocations(locations) {
    this.state.locations = locations;
    this.recalculate();
  }
  
  recalculate() {
    const price = this.calculator.calculate(
      this.state.quantity,
      this.state
    );
    
    this.updatePriceDisplay(price);
    this.quoteSystem.updatePrice(price);
  }
}
```

#### Step 3: Style Components

Create modular CSS in `/src/pages/cap-embroidery/styles/cap-embroidery.css`:
```css
/* Import shared component styles */
@import '../../shared/styles/components.css';

/* Cap embroidery specific styles */
.cap-embroidery-container {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2rem;
  max-width: 1200px;
  margin: 0 auto;
}

/* Location selector styles */
.location-selector {
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  padding: var(--spacing-lg);
}

.location-option {
  display: block;
  margin-bottom: var(--spacing-md);
  padding: var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  transition: all 0.2s ease;
}

.location-option:hover {
  border-color: var(--color-primary);
  background: var(--color-primary-light);
}

.stitch-count-input input {
  width: 100%;
  margin-top: var(--spacing-sm);
  padding: var(--spacing-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
}

/* Responsive design */
@media (max-width: 768px) {
  .cap-embroidery-container {
    grid-template-columns: 1fr;
  }
}
```

---

## Migration Checklist

### Phase 1 Checklist
- [ ] Set up webpack build system
- [ ] Create entry point file
- [ ] Migrate JavaScript files to modules
- [ ] Combine CSS files
- [ ] Update HTML to use bundles
- [ ] Remove jQuery dependencies
- [ ] Test bundle generation
- [ ] Verify no functionality lost
- [ ] Measure performance improvements

### Phase 2 Checklist
- [ ] Implement PricingCalculator extension
- [ ] Create LocationManager component
- [ ] Integrate ColorSelector
- [ ] Set up QuoteSystem
- [ ] Add ImageGallery
- [ ] Wire up component communication
- [ ] Update styles to component-based
- [ ] Test all interactions
- [ ] Verify calculations are correct

---

## Testing Guide

### Unit Tests
Create `/src/pages/cap-embroidery/__tests__/calculator.test.js`:
```javascript
import { CapEmbroideryCalculator } from '../calculator';

describe('CapEmbroideryCalculator', () => {
  let calculator;
  
  beforeEach(() => {
    calculator = new CapEmbroideryCalculator({
      pricingMatrix: mockPricingMatrix
    });
  });
  
  test('calculates embroidery price correctly', () => {
    const selections = {
      stitchCount: { front: 5000 },
      locations: ['front']
    };
    
    const price = calculator.calculateEmbroideryPrice(selections);
    expect(price).toBe(7.50); // minimum charge
  });
  
  test('handles multiple locations', () => {
    const selections = {
      stitchCount: { front: 10000, back: 8000 },
      locations: ['front', 'back']
    };
    
    const price = calculator.calculateEmbroideryPrice(selections);
    expect(price).toBe(27.00); // 15 + 12
  });
});
```

### Integration Tests
```javascript
describe('Cap Embroidery Page Integration', () => {
  test('updates price when location added', async () => {
    // Load page
    // Add location
    // Verify price updates
  });
  
  test('saves quote with all selections', async () => {
    // Make selections
    // Save quote
    // Verify quote data
  });
});
```

### Manual Testing Checklist
1. **Component Functionality**
   - [ ] Color selector works
   - [ ] Location checkboxes toggle
   - [ ] Stitch count inputs appear/hide
   - [ ] Gallery images load and zoom
   - [ ] Quote system saves/loads

2. **Calculations**
   - [ ] Base pricing correct
   - [ ] Embroidery charges accurate
   - [ ] Setup fees included
   - [ ] Volume discounts apply

3. **Responsive Design**
   - [ ] Mobile layout works
   - [ ] Touch interactions smooth
   - [ ] All features accessible

4. **Performance**
   - [ ] Page loads in < 2 seconds
   - [ ] No JavaScript errors
   - [ ] Smooth interactions

---

## Troubleshooting

### Common Issues

#### Issue: Components not rendering
**Solution:** Check console for errors, verify container selectors exist

#### Issue: Calculations incorrect
**Solution:** Verify pricing matrix loaded, check calculator logic

#### Issue: Styles not applying
**Solution:** Ensure CSS imports are correct, check build output

#### Issue: Events not firing
**Solution:** Verify event listeners attached, check event bubbling

### Debug Mode
Enable debug logging:
```javascript
// In page initialization
this.logger = new Logger('CapEmbroidery', { debug: true });
```

### Performance Profiling
```javascript
// Measure component initialization
console.time('CapEmbroideryInit');
new CapEmbroideryPage();
console.timeEnd('CapEmbroideryInit');
```

---

## Next Steps

After completing phases 1 and 2 for cap embroidery:

1. **Gather Metrics**
   - Page load improvement
   - User interaction times
   - Error rates

2. **User Testing**
   - A/B test new version
   - Collect feedback
   - Monitor analytics

3. **Prepare for Phase 3**
   - Document state requirements
   - Plan state structure
   - Identify synchronization needs

4. **Apply to Other Pages**
   - Screen print pricing
   - DTG pricing
   - Embroidery pricing
   - DTF pricing

This foundation will make subsequent phases much easier to implement!